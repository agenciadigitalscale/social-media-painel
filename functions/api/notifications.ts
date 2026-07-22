import { broadcastPush } from './_lib/webpush'

interface Env {
  DB:                D1Database
  VAPID_PRIVATE_KEY?: string
  VAPID_PUBLIC_KEY?:  string
}

export interface PushNotification {
  id:         string
  type:       'approved' | 'rejected' | 'new_video' | 'review_ok' | 'review_fix'
  clientName: string
  itemId:     number
  itemTitle:  string
  ts:         number   // unix ms
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

const KEY = 'sm_push_notifications'
const TTL = 48 * 60 * 60 * 1000

async function read(db: D1Database): Promise<PushNotification[]> {
  const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(KEY).first<{ value: string }>()
  return row ? (JSON.parse(row.value) as PushNotification[]) : []
}

function notifToPayload(n: PushNotification): { title: string; body: string; tag: string; tab: number } {
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
  return {
    title: `📥 Novo vídeo — ${n.clientName}`,
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

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS })

  const since = parseInt(new URL(request.url).searchParams.get('since') ?? '0', 10)
  const all   = await read(env.DB)
  const fresh = all.filter(n => n.ts > since)

  return new Response(JSON.stringify({ ok: true, notifications: fresh }), { headers: CORS })
}
