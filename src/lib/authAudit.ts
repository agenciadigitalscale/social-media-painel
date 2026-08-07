/**
 * "Já dá para fechar o `/api/sync`?" — respondido por leitura, não por palpite.
 *
 * O endpoint entrega o banco inteiro (858 KB medidos) e aceita escrita, sem
 * credencial. Fechar de uma vez trancaria a equipe fora se algum caminho
 * legítimo não carregasse a sessão, então o plano é observar antes: quem chega
 * sem sessão é contado e passa.
 *
 * Duas armadilhas moram nesse número, e as duas já custaram leitura errada:
 *
 *  1. **`count` é cumulativo e nunca zera.** Ele inclui a era anterior ao
 *     `SESSION_SECRET`. O sinal real é o `lastAt` — quando foi a última vez que
 *     alguém chegou sem sessão.
 *  2. **Contador anônimo parado não é prova sozinho.** Pode significar "todo
 *     mundo já entra autenticado" ou "ninguém está usando o painel". Por isso a
 *     conclusão exige ver o lado AUTENTICADO se mexendo também.
 */

export interface AuditRoute {
  route: string
  /** Acessos SEM sessão — cumulativo, nunca zera. */
  count: number
  lastAt: number
  sample?: string
  /** Acessos COM sessão. */
  auth: number
  lastAuthAt?: number
}

export interface AuditPayload {
  ok: boolean
  configured: boolean
  enforcing: boolean
  routes: AuditRoute[]
  error?: string
}

export type AuditStatus =
  /** Sem `SESSION_SECRET`: não há sessão para conferir. */
  | 'unconfigured'
  /** Já fechado — `SYNC_REQUIRE_AUTH=1`. */
  | 'enforcing'
  /** Ainda chega gente sem sessão. */
  | 'blocked'
  /** Ninguém chegou sem sessão, mas também ninguém autenticado apareceu. */
  | 'no_signal'
  /** Pode virar a chave. */
  | 'ready'
  | 'error'

export interface AuditVerdict {
  status: AuditStatus
  title: string
  detail: string
  /** As rotas que ainda recebem acesso anônimo — o que precisa ser consertado. */
  blocking: AuditRoute[]
}

/** Silêncio de 24h no lado anônimo é o que o plano pede antes de fechar. */
export const QUIET_MS = 24 * 60 * 60 * 1000

export function parseRoutes(raw: Record<string, unknown> | undefined | null): AuditRoute[] {
  if (!raw) return []
  return Object.entries(raw).map(([route, v]) => {
    const s = (v ?? {}) as Partial<AuditRoute>
    return {
      route,
      count: typeof s.count === 'number' ? s.count : 0,
      lastAt: typeof s.lastAt === 'number' ? s.lastAt : 0,
      sample: typeof s.sample === 'string' ? s.sample : undefined,
      auth: typeof s.auth === 'number' ? s.auth : 0,
      lastAuthAt: typeof s.lastAuthAt === 'number' ? s.lastAuthAt : undefined,
    }
  })
}

export function since(ts: number, now: number): string {
  const mins = Math.round((now - ts) / 60000)
  if (mins < 60) return `há ${Math.max(mins, 1)} min`
  if (mins < 60 * 24) return `há ${Math.round(mins / 60)} h`
  return `há ${Math.round(mins / 1440)} d`
}

export function auditVerdict(payload: AuditPayload, now: number): AuditVerdict {
  if (payload.error) {
    return {
      status: 'error',
      title: 'Não consegui ler a auditoria',
      detail: `${payload.error} — isto não diz que a porta está segura, diz que não deu para olhar.`,
      blocking: [],
    }
  }

  if (!payload.configured) {
    return {
      status: 'unconfigured',
      title: 'SESSION_SECRET não configurado',
      detail: 'Sem ele não existe sessão para conferir — e fechar o endpoint trancaria todo mundo do lado de fora.',
      blocking: [],
    }
  }

  if (payload.enforcing) {
    return {
      status: 'enforcing',
      title: 'O /api/sync já está fechado',
      detail: 'SYNC_REQUIRE_AUTH está ativo: quem chega sem sessão recebe 401.',
      blocking: [],
    }
  }

  const routes = payload.routes
  if (routes.length === 0) {
    return {
      status: 'no_signal',
      title: 'Sem registro de acesso ainda',
      detail: 'A auditoria ainda não gravou nada. Sem dado não dá para concluir nem que está limpo, nem que não está.',
      blocking: [],
    }
  }

  const cutoff = now - QUIET_MS
  const blocking = routes
    .filter(r => r.lastAt > cutoff)
    .sort((a, b) => b.lastAt - a.lastAt)

  if (blocking.length > 0) {
    return {
      status: 'blocked',
      title: 'Ainda chega gente sem sessão',
      detail: 'Fechar agora faria essas rotas responderem 401 para quem está trabalhando. '
        + 'A causa mais comum é aba deixada aberta com a sessão de 8h vencida: um logout/login mata.',
      blocking,
    }
  }

  // Contador anônimo parado não prova nada sozinho — pode ser que ninguém
  // esteja usando o painel. O lado autenticado precisa estar vivo.
  const authAlive = routes.some(r => (r.lastAuthAt ?? 0) > cutoff)
  if (!authAlive) {
    return {
      status: 'no_signal',
      title: 'Ninguém acessou nas últimas 24h',
      detail: 'O lado anônimo está parado, mas o autenticado também — isso não distingue '
        + '"todo mundo entra com sessão" de "ninguém está usando o painel". Espere um dia de uso normal.',
      blocking: [],
    }
  }

  return {
    status: 'ready',
    title: 'Pode fechar o /api/sync',
    detail: 'Ninguém chegou sem sessão nas últimas 24h e o acesso autenticado segue vivo. '
      + 'Rode: wrangler pages secret put SYNC_REQUIRE_AUTH (valor 1).',
    blocking: [],
  }
}

export async function fetchAudit(): Promise<AuditPayload> {
  try {
    const res = await fetch('/api/auth-audit')
    const data = await res.json() as {
      ok?: boolean; configured?: boolean; enforcing?: boolean
      routes?: Record<string, unknown>; error?: string
    }
    if (!res.ok && res.status !== 200) {
      return { ok: false, configured: true, enforcing: false, routes: [], error: data.error ?? `HTTP ${res.status}` }
    }
    return {
      ok: data.ok !== false,
      configured: data.configured !== false,
      enforcing: !!data.enforcing,
      routes: parseRoutes(data.routes),
      error: data.ok === false && data.configured !== false ? data.error : undefined,
    }
  } catch (e) {
    return {
      ok: false, configured: true, enforcing: false, routes: [],
      error: e instanceof Error ? e.message : 'falha ao consultar',
    }
  }
}
