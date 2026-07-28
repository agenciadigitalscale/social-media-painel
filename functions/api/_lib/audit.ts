// Quem chega sem credencial — etapa 1 de fechar o `/api/sync`.
//
// Fechar o endpoint de uma vez tranca a equipe fora do painel se algum caminho
// legítimo não carregar a sessão. Então primeiro observamos: durante alguns
// dias, o acesso sem credencial é REGISTRADO e segue passando. O que aparecer
// aqui é a lista do que precisa ser consertado antes de trancar a porta.
//
// Escrever no D1 a cada requisição seria pior que o problema: acumula em memória
// no isolate e persiste no máximo uma vez por minuto.

const KEY = 'sm_auth_audit'
const FLUSH_EVERY_MS = 60_000
const MAX_ROUTES = 60

interface RouteStat {
  /** Acessos SEM sessão — os que quebrariam se a porta fechasse hoje. */
  count: number
  lastAt: number
  sample?: string
  /**
   * Acessos COM sessão. Contar só o lado anônimo dizia se havia problema, mas
   * não se a solução estava funcionando: com o contador parado não dá para
   * distinguir "todo mundo já entra autenticado" de "ninguém está usando o
   * painel". Com os dois lados, a decisão de fechar vira leitura direta —
   * `auth` subindo e `count` congelado é o sinal de que pode virar a chave.
   */
  auth?: number
  lastAuthAt?: number
}

let pending = new Map<string, RouteStat>()
let lastFlush = 0
let flushing: Promise<void> | null = null

async function flush(db: D1Database): Promise<void> {
  if (pending.size === 0) return
  const batch = pending
  pending = new Map()

  try {
    const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(KEY).first<{ value: string }>()
    const stored: Record<string, RouteStat> = row?.value ? JSON.parse(row.value) : {}

    for (const [route, stat] of batch) {
      const cur = stored[route]
      const anon = (cur?.count ?? 0) + stat.count
      const auth = (cur?.auth ?? 0) + (stat.auth ?? 0)
      stored[route] = {
        count: anon,
        // Só avança o carimbo de quem realmente apareceu neste lote: senão um
        // lote puramente autenticado empurraria `lastAt` para frente e daria a
        // impressão de que ainda chega gente sem sessão.
        lastAt: stat.count > 0 ? stat.lastAt : (cur?.lastAt ?? stat.lastAt),
        sample: stat.sample ?? cur?.sample,
        ...(auth > 0 ? { auth } : {}),
        ...(stat.auth ? { lastAuthAt: stat.lastAuthAt } : cur?.lastAuthAt ? { lastAuthAt: cur.lastAuthAt } : {}),
      }
    }

    // Mantém as rotas mais recentes; a lista serve para agir, não para arquivo.
    const trimmed = Object.entries(stored)
      .sort((a, b) => Math.max(b[1].lastAt, b[1].lastAuthAt ?? 0) - Math.max(a[1].lastAt, a[1].lastAuthAt ?? 0))
      .slice(0, MAX_ROUTES)

    await db.prepare(`
      INSERT INTO app_data (key, value) VALUES (?1, ?2)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = CURRENT_TIMESTAMP
    `).bind(KEY, JSON.stringify(Object.fromEntries(trimmed))).run()
  } catch (e) {
    // Auditoria não pode derrubar requisição de ninguém.
    console.error('[audit] não consegui gravar', e)
  }
}

/**
 * Registra um acesso. Não bloqueia nada — só conta, dos dois lados.
 * `ctx.waitUntil` mantém a gravação fora do caminho da resposta.
 */
export function noteAccess(
  db: D1Database,
  request: Request,
  authenticated: boolean,
  waitUntil?: (p: Promise<unknown>) => void,
): void {
  const url = new URL(request.url)
  const route = `${request.method} ${url.pathname}`
  const cur = pending.get(route)
  const now = Date.now()

  pending.set(route, {
    count: (cur?.count ?? 0) + (authenticated ? 0 : 1),
    lastAt: authenticated ? (cur?.lastAt ?? now) : now,
    // A amostra de User-Agent só interessa para o lado anônimo: é ela que
    // identifica QUEM ainda precisa ser consertado antes de fechar a porta.
    sample: authenticated
      ? cur?.sample
      : cur?.sample ?? (request.headers.get('User-Agent') ?? '').slice(0, 120),
    ...(authenticated ? { auth: (cur?.auth ?? 0) + 1, lastAuthAt: now } : cur?.auth ? { auth: cur.auth, lastAuthAt: cur.lastAuthAt } : {}),
  })

  if (now - lastFlush < FLUSH_EVERY_MS || flushing) return
  lastFlush = now
  flushing = flush(db).finally(() => { flushing = null })
  waitUntil?.(flushing)
}

/** @deprecated use `noteAccess(db, request, false, waitUntil)` */
export function noteAnonymous(
  db: D1Database,
  request: Request,
  waitUntil?: (p: Promise<unknown>) => void,
): void {
  noteAccess(db, request, false, waitUntil)
}

export async function readAudit(db: D1Database): Promise<Record<string, RouteStat>> {
  const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(KEY).first<{ value: string }>()
  return row?.value ? JSON.parse(row.value) as Record<string, RouteStat> : {}
}
