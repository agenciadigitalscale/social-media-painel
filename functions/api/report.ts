interface Env { DB: D1Database }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

async function ensureTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS reports (
      token   TEXT PRIMARY KEY,
      data    TEXT NOT NULL,
      created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run()
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx

  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try { await ensureTable(env.DB) } catch {}

  if (request.method === 'GET') {
    const token = new URL(request.url).searchParams.get('token')
    if (!token) return json({ ok: false, error: 'Token obrigatório' }, 400)
    try {
      const row = await env.DB.prepare('SELECT data FROM reports WHERE token = ?').bind(token).first()
      if (!row) return json({ ok: false, error: 'Relatório não encontrado' }, 404)
      return json({ ok: true, data: JSON.parse(row.data as string) })
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500)
    }
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json() as { token: string; data: unknown }
      if (!body.token) return json({ ok: false, error: 'Token obrigatório' }, 400)
      await env.DB.prepare(`
        INSERT INTO reports (token, data) VALUES (?1, ?2)
        ON CONFLICT(token) DO UPDATE SET data = excluded.data, created = CURRENT_TIMESTAMP
      `).bind(body.token, JSON.stringify(body.data)).run()
      return json({ ok: true, token: body.token })
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500)
    }
  }

  return json({ ok: false, error: 'Método não permitido' }, 405)
}
