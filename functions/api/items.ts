interface Env {
  DB: D1Database
}

interface ItemBody {
  id: number
  status: 0 | 1 | 2 | 3
  link: string
  caption: string
  notes: string
}

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

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  // GET /api/items — retorna todos os itens salvos
  if (request.method === 'GET') {
    try {
      const { results } = await env.DB.prepare(
        'SELECT id, status, link, caption, notes FROM items'
      ).all()
      return json({ ok: true, data: results })
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500)
    }
  }

  // POST /api/items — salva/atualiza um item
  if (request.method === 'POST') {
    try {
      const body = await request.json() as ItemBody
      await env.DB.prepare(`
        INSERT INTO items (id, status, link, caption, notes)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(id) DO UPDATE SET
          status  = excluded.status,
          link    = excluded.link,
          caption = excluded.caption,
          notes   = excluded.notes,
          updated = CURRENT_TIMESTAMP
      `).bind(body.id, body.status, body.link ?? '', body.caption ?? '', body.notes ?? '').run()

      return json({ ok: true })
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500)
    }
  }

  return json({ ok: false, error: 'Method not allowed' }, 405)
}
