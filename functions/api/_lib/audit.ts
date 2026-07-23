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
  count: number
  lastAt: number
  sample?: string
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
      stored[route] = {
        count: (cur?.count ?? 0) + stat.count,
        lastAt: stat.lastAt,
        sample: stat.sample ?? cur?.sample,
      }
    }

    // Mantém as rotas mais recentes; a lista serve para agir, não para arquivo.
    const trimmed = Object.entries(stored)
      .sort((a, b) => b[1].lastAt - a[1].lastAt)
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
 * Registra um acesso sem sessão. Não bloqueia nada — só conta.
 * `ctx.waitUntil` mantém a gravação fora do caminho da resposta.
 */
export function noteAnonymous(
  db: D1Database,
  request: Request,
  waitUntil?: (p: Promise<unknown>) => void,
): void {
  const url = new URL(request.url)
  const route = `${request.method} ${url.pathname}`
  const cur = pending.get(route)
  pending.set(route, {
    count: (cur?.count ?? 0) + 1,
    lastAt: Date.now(),
    sample: cur?.sample ?? (request.headers.get('User-Agent') ?? '').slice(0, 120),
  })

  if (Date.now() - lastFlush < FLUSH_EVERY_MS || flushing) return
  lastFlush = Date.now()
  flushing = flush(db).finally(() => { flushing = null })
  waitUntil?.(flushing)
}

export async function readAudit(db: D1Database): Promise<Record<string, RouteStat>> {
  const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(KEY).first<{ value: string }>()
  return row?.value ? JSON.parse(row.value) as Record<string, RouteStat> : {}
}
