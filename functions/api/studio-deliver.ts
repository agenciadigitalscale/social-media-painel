import { guardPanelRoute, type PanelGuardEnv } from './_lib/panel-guard'
import { markStudioDelivery } from './_lib/appdata'

interface Env extends PanelGuardEnv {
  DB: D1Database
  STUDIO_KEY?: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Studio-Key',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

// Reel finalizado vai para "Pronto p/ enviar" (3) — a fila do board Social, o
// mesmo destino do botão "Finalizei" e da esteira (src/lib/entrega.ts). A fila
// que o Studio puxa só traz Reels, então o destino é 3.
const DELIVERY_STATUS = 3

// O Studio entrega o export aqui: marca o card e registra o link do vídeo. Mesma
// identificação do studio-queue (X-Studio-Key), ou sessão do painel.
export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const provided = request.headers.get('X-Studio-Key') ?? ''
  const keyOk = !!env.STUDIO_KEY && provided === env.STUDIO_KEY
  if (!keyOk) {
    const blocked = await guardPanelRoute({ request, env, waitUntil: ctx.waitUntil.bind(ctx) }, CORS)
    if (blocked) return blocked
  }

  let body: { card_id?: unknown; link?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'JSON inválido.' }, 400)
  }
  const id = Number(body.card_id)
  const link = typeof body.link === 'string' ? body.link.trim() : ''
  if (!Number.isFinite(id) || id <= 0) return json({ ok: false, error: 'card_id inválido.' }, 400)
  if (!link) return json({ ok: false, error: 'Informe o link do vídeo exportado.' }, 400)

  const ok = await markStudioDelivery(env.DB, id, DELIVERY_STATUS, link)
  if (!ok) return json({ ok: false, error: 'Não foi possível registrar a entrega.' }, 502)
  return json({ ok: true, card_id: String(id), status: DELIVERY_STATUS })
}
