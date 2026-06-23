import type { StoredSubscription } from './_lib/webpush'

interface Env { DB: D1Database }

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

const VALID_USERS = ['pradox','testa','kaique','jhones','kerges','arthur','robson']
const KEY = 'push_subscriptions'
const MAX_AGE = 30 * 24 * 60 * 60 * 1000  // 30 dias

async function readSubs(db: D1Database): Promise<StoredSubscription[]> {
  const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(KEY).first<{ value: string }>()
  return row ? JSON.parse(row.value) : []
}

async function writeSubs(db: D1Database, subs: StoredSubscription[]): Promise<void> {
  await db.prepare(`INSERT INTO app_data (key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated=CURRENT_TIMESTAMP`)
    .bind(KEY, JSON.stringify(subs)).run()
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

  if (request.method === 'POST') {
    const body = await request.json() as { userId?: string; p256dh?: string; auth?: string; endpoint?: string }
    const { userId, p256dh, auth, endpoint } = body
    if (!userId || !VALID_USERS.includes(userId) || !p256dh || !auth || !endpoint) {
      return new Response(JSON.stringify({ error: 'invalid' }), { status: 400, headers: CORS })
    }
    const cutoff = Date.now() - MAX_AGE
    const subs   = (await readSubs(env.DB))
      .filter(s => s.ts > cutoff && !(s.userId === userId && s.endpoint === endpoint))
    subs.push({ userId, endpoint, p256dh, auth, ts: Date.now() })
    await writeSubs(env.DB, subs)
    return new Response(JSON.stringify({ ok: true }), { headers: CORS })
  }

  if (request.method === 'DELETE') {
    const body = await request.json() as { userId?: string; endpoint?: string }
    if (!body.userId) return new Response(JSON.stringify({ error: 'invalid' }), { status: 400, headers: CORS })
    const subs = (await readSubs(env.DB)).filter(s =>
      !(s.userId === body.userId && (!body.endpoint || s.endpoint === body.endpoint))
    )
    await writeSubs(env.DB, subs)
    return new Response(JSON.stringify({ ok: true }), { headers: CORS })
  }

  return new Response('Method not allowed', { status: 405, headers: CORS })
}
