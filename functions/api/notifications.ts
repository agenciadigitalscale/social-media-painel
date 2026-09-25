import { broadcastPush } from './_lib/webpush'
import { guardPanelRoute, type PanelGuardEnv } from './_lib/panel-guard'

interface Env extends PanelGuardEnv {
  DB:                D1Database
  VAPID_PRIVATE_KEY?: string
  VAPID_PUBLIC_KEY?:  string
}

export interface PushNotification {
  id:         string
  type:       'approved' | 'rejected' | 'new_video' | 'review_ok' | 'review_fix' | 'briefing' | 'studio_done' | 'impediment'
  clientName: string
  itemId:     number
  itemTitle:  string
  ts:         number   // unix ms
  /** Texto do impedimento, quando type === 'impediment'. */
  note?:      string
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

const KEY = 'sm_push_notifications'
const TTL = 48 * 60 * 60 * 1000

async function read(db: D1Database): Promise<PushNotification[]> {
  const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(KEY).first<{ value: string }>()
  return row ? (JSON.parse(row.value) as PushNotification[]) : []
}

export function notifToPayload(n: PushNotification): { title: string; body: string; tag: string; tab: number } {
  if (n.type === 'approved') return {
    title: `✅ ${n.clientName} aprovou!`,
    body:  n.itemTitle,
    tag:   `approved-${n.itemId}`,
    tab:   3,  // Produções
  }
  if (n.type === 'rejected') return {
    title: `🔄 ${n.clientName} solicitou alteração`,
    body:  n.itemTitle,
    tag:   `rejected-${n.itemId}`,
    tab:   3,
  }
  // Na revisão interna quem decide é a equipe — clientName carrega o nome do revisor
  if (n.type === 'review_ok') return {
    title: `👁️ Revisão interna aprovada`,
    body:  `${n.itemTitle} — por ${n.clientName}`,
    tag:   `review-${n.itemId}`,
    tab:   3,
  }
  if (n.type === 'review_fix') return {
    title: `👁️ Revisão interna pediu ajuste`,
    body:  `${n.itemTitle} — por ${n.clientName}`,
    tag:   `review-${n.itemId}`,
    tab:   3,
  }
  // Kaique finalizou um vídeo no Studio e ele entrou como "Pronto p/ enviar".
  // tab 4 = Produções (onde o card aparece pronto para mandar ao cliente).
  if (n.type === 'studio_done') return {
    title: `🎬 Vídeo finalizado — ${n.clientName}`,
    body:  n.itemTitle,
    tag:   `studio-${n.itemId}`,
    tab:   4,
  }
  // Impedimento escrito à mão — o card travou por um motivo. tab 4 = Produções.
  // O tag por item faz um novo impedimento do mesmo card SUBSTITUIR o anterior no
  // celular, em vez de empilhar.
  if (n.type === 'impediment') return {
    title: `🚩 Travou: ${n.clientName}`,
    body:  n.note ? `${n.itemTitle} — ${n.note}` : n.itemTitle,
    tag:   `impediment-${n.itemId}`,
    tab:   4,
  }
  // Cliente preencheu o briefing — avisa a equipe toda. tab 30 = Central de Briefings.
  if (n.type === 'briefing') return {
    title: `📋 ${n.clientName} preencheu o briefing!`,
    body:  n.itemTitle,
    tag:   `briefing-${n.clientName}`,
    tab:   30,
  }
  // 'new_video' é o nome histórico do tipo; hoje cobre vídeo e criativo estático.
  return {
    title: `📥 Novo arquivo — ${n.clientName}`,
    body:  n.itemTitle,
    tag:   'new-video',
    tab:   3,
  }
}

// Writes to D1 queue (for polling) and fires Web Push to all subscribed devices
export async function dispatchNotification(env: Env, notif: PushNotification): Promise<void> {
  const existing = await read(env.DB)
  const cutoff   = Date.now() - TTL
  const fresh    = existing.filter(n => n.ts > cutoff)
  fresh.push(notif)
  await env.DB.prepare(`
    INSERT INTO app_data (key, value)
    VALUES (?1, ?2)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = CURRENT_TIMESTAMP
  `).bind(KEY, JSON.stringify(fresh)).run()

  if (env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY) {
    await broadcastPush(env.DB, notifToPayload(notif), env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY)
  }
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

  // POST — disparo de push de IMPEDIMENTO pelo painel. Só este tipo entra por
  // aqui: os demais (aprovado, revisão, briefing…) são disparados pelo próprio
  // servidor, e aceitá-los de fora deixaria alguém forjar "cliente aprovou".
  if (request.method === 'POST') {
    const blocked = await guardPanelRoute({ request, env, waitUntil: ctx.waitUntil.bind(ctx) }, CORS)
    if (blocked) return blocked
    let body: { clientName?: unknown; itemId?: unknown; itemTitle?: unknown; note?: unknown } | null = null
    try { body = await request.json() } catch { /* corpo inválido cai na validação abaixo */ }
    if (typeof body?.itemId !== 'number' || typeof body?.itemTitle !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'Campos inválidos' }), { status: 400, headers: CORS })
    }
    const notif: PushNotification = {
      id:         crypto.randomUUID(),
      type:       'impediment',
      clientName: typeof body.clientName === 'string' ? body.clientName.slice(0, 80) : '',
      itemId:     body.itemId,
      itemTitle:  body.itemTitle.slice(0, 160),
      note:       typeof body.note === 'string' && body.note.trim() ? body.note.slice(0, 160) : undefined,
      ts:         Date.now(),
    }
    await dispatchNotification(env, notif)
    return new Response(JSON.stringify({ ok: true }), { headers: CORS })
  }

  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS })

  const blocked = await guardPanelRoute({ request, env, waitUntil: ctx.waitUntil.bind(ctx) }, CORS)
  if (blocked) return blocked

  const since = parseInt(new URL(request.url).searchParams.get('since') ?? '0', 10)
  const all   = await read(env.DB)
  const fresh = all.filter(n => n.ts > since)

  return new Response(JSON.stringify({ ok: true, notifications: fresh }), { headers: CORS })
}
