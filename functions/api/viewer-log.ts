// O que aconteceu na tela do cliente.
//
// "Alguns não conseguem visualizar, não sei se varia Android/Apple" era uma
// pergunta sem resposta possível: o viewer nunca contou nada de volta. Agora ele
// avisa quando abriu, quando o vídeo começou e quando falhou — com o código de
// erro do player e a plataforma. Sem isso, todo diagnóstico é chute.
//
// Guarda os últimos eventos numa chave do app_data. Nada de dado pessoal: só o
// que a própria equipe já sabe (cliente, item) e o que o navegador declara.

import { dispatchNotification } from './notifications'
import { guardPanelRoute, type PanelGuardEnv } from './_lib/panel-guard'

interface Env extends PanelGuardEnv {
  DB: D1Database
  VAPID_PRIVATE_KEY?: string
  VAPID_PUBLIC_KEY?: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const KEY = 'sm_viewer_events'
/** Fila circular: o histórico serve para achar padrão recente, não para auditoria. */
const MAX_EVENTS = 300
const TTL_MS = 30 * 24 * 60 * 60 * 1000
/** Um aviso por item nesta janela — aparelho que erra em loop não vira enxurrada. */
const NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000

/** "iPhone ou Android?" é a única parte do user agent que muda o que a equipe faz. */
function describePlatform(ua?: string): string {
  if (!ua) return 'aparelho desconhecido'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone/iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Mac OS X/i.test(ua)) return 'Mac'
  return 'outro aparelho'
}

/**
 * `stalled` entrou depois dos outros, em 2026-08-07, e é o mais importante.
 *
 * Uma cliente reclamou que "nunca carrega", e o registro mostrava `opened` +
 * `playing` sem nenhum erro — porque tecnicamente nada falhou: o vídeo começava
 * e travava por falta de dados. Sem este evento, a experiência que mais importa
 * (o cliente esperando a barra andar) era exatamente a única não registrada.
 */
type ViewerEvent = 'opened' | 'playing' | 'stalled' | 'error' | 'fallback' | 'download'

interface StoredEvent {
  ts: number
  client: string
  itemId: number
  event: ViewerEvent
  detail?: string
  platform?: string
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

async function read(db: D1Database): Promise<StoredEvent[]> {
  const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(KEY).first<{ value: string }>()
  if (!row?.value) return []
  try {
    const parsed = JSON.parse(row.value) as StoredEvent[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

  // A LEITURA é interna: só a aba Entregas e a faixa do card consomem daqui
  // (`src/lib/viewerEvents.ts`, `src/lib/useViewerEvents.ts`). Aberta, ela
  // entregava a qualquer um o nome de todo cliente da agência, o que cada um
  // recebeu e de que aparelho abriu — 300 eventos por requisição.
  //
  // A ESCRITA continua pública de propósito: quem chama é a página do cliente,
  // que não tem sessão nenhuma. O que a protege é o token do portal, conferido
  // logo abaixo — e é por isso que a guarda entra só neste ramo.
  if (request.method === 'GET') {
    const blocked = await guardPanelRoute(
      { request, env, waitUntil: ctx.waitUntil.bind(ctx) },
      CORS,
    )
    if (blocked) return blocked
    return json({ ok: true, events: await read(env.DB) })
  }

  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  let body: { token?: string; itemId?: number; event?: ViewerEvent; detail?: string; platform?: string }
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const valid: ViewerEvent[] = ['opened', 'playing', 'stalled', 'error', 'fallback', 'download']
  if (!body.token || body.itemId === undefined || !body.event || !valid.includes(body.event)) {
    return json({ ok: false, error: 'Missing fields' }, 400)
  }

  const tokenRow = await env.DB.prepare('SELECT value FROM app_data WHERE key = ?').bind('sm_portal_tokens').first<{ value: string }>()
  const tokens = tokenRow ? JSON.parse(tokenRow.value) as Record<string, string> : {}
  const client = Object.entries(tokens).find(([, t]) => t === body.token)?.[0]
  // Token inválido não vira registro: a fila é curta e não pode ser entupida de fora.
  if (!client) return json({ ok: false, error: 'Invalid token' }, 403)

  const cutoff = Date.now() - TTL_MS
  const events = (await read(env.DB)).filter(e => e.ts > cutoff)
  const itemId = Number(body.itemId)

  // Problema na mão do cliente é urgente: ele está com o link aberto AGORA.
  // Mas um aparelho que erra em loop não pode virar enxurrada de push — um
  // aviso por item a cada 6h basta para a equipe agir.
  //
  // `stalled` entrou aqui em 2026-08-07, junto com o evento. Sem ele, o caso
  // que motivou tudo isto (vídeo que trava até o cliente desistir) era
  // registrado com perfeição e não avisava ninguém: o painel contava a verdade
  // só para quem fosse olhar, e a reclamação continuava chegando por WhatsApp.
  const isProblem = body.event === 'error' || body.event === 'fallback' || body.event === 'stalled'
  const notifiedRecently = events.some(e =>
    e.itemId === itemId
    && (e.event === 'error' || e.event === 'fallback' || e.event === 'stalled')
    && Date.now() - e.ts < NOTIFY_COOLDOWN_MS,
  )

  // Travar e não abrir pedem ações diferentes: a primeira é reexportar mais
  // leve, a segunda é investigar formato/acesso. Um texto só para os dois
  // mandaria a equipe pelo caminho errado metade das vezes.
  const aviso = body.event === 'stalled'
    ? `travou o vídeo no meio (${describePlatform(body.platform)}) — arquivo pesado para a conexão dele`
    : `não conseguiu abrir o criativo (${describePlatform(body.platform)})`

  events.push({
    ts: Date.now(),
    client,
    itemId,
    event: body.event,
    detail: body.detail?.slice(0, 200),
    platform: body.platform?.slice(0, 160),
  })

  await env.DB.prepare(`
    INSERT INTO app_data (key, value) VALUES (?1, ?2)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = CURRENT_TIMESTAMP
  `).bind(KEY, JSON.stringify(events.slice(-MAX_EVENTS))).run()

  if (isProblem && !notifiedRecently) {
    await dispatchNotification(env, {
      id:         crypto.randomUUID(),
      type:       'rejected',
      clientName: client,
      itemId,
      itemTitle:  aviso,
      ts:         Date.now(),
    })
  }

  return json({ ok: true })
}
