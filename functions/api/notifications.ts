interface Env { DB: D1Database }

interface PushNotification {
  id:         string
  type:       'approved' | 'rejected'
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
const TTL = 48 * 60 * 60 * 1000  // prune entries older than 48h

async function read(db: D1Database): Promise<PushNotification[]> {
  const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(KEY).first<{ value: string }>()
  return row ? (JSON.parse(row.value) as PushNotification[]) : []
}

export async function writeNotification(db: D1Database, notif: PushNotification): Promise<void> {
  const existing = await read(db)
  const cutoff   = Date.now() - TTL
  const fresh    = existing.filter(n => n.ts > cutoff)
  fresh.push(notif)
  await db.prepare(`
    INSERT INTO app_data (key, value)
    VALUES (?1, ?2)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = CURRENT_TIMESTAMP
  `).bind(KEY, JSON.stringify(fresh)).run()
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS })

  const since = parseInt(new URL(request.url).searchParams.get('since') ?? '0', 10)
  const all   = await read(env.DB)
  const fresh = all.filter(n => n.ts > since)

  return new Response(JSON.stringify({ ok: true, notifications: fresh }), { headers: CORS })
}
