interface Env {
  DB: D1Database
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

async function ensureTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS app_data (
      key     TEXT PRIMARY KEY,
      value   TEXT NOT NULL DEFAULT '{}',
      updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run()
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  try {
    await ensureTable(env.DB)
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }

  // GET /api/sync — retorna todos os pares ou filtra por ?key=
  if (request.method === 'GET') {
    try {
      const url = new URL(request.url)
      const filterKey = url.searchParams.get('key')
      if (filterKey) {
        const row = await env.DB.prepare('SELECT value FROM app_data WHERE key = ?1').bind(filterKey).first<{ value: string }>()
        return json({ ok: true, value: row?.value ?? null })
      }
      const { results } = await env.DB.prepare('SELECT key, value FROM app_data').all()
      return json({ ok: true, data: results })
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500)
    }
  }

  // POST /api/sync — upsert de um par chave/valor
  if (request.method === 'POST') {
    try {
      const body = await request.json() as { key: string; value: string }
      await env.DB.prepare(`
        INSERT INTO app_data (key, value)
        VALUES (?1, ?2)
        ON CONFLICT(key) DO UPDATE SET
          value   = excluded.value,
          updated = CURRENT_TIMESTAMP
      `).bind(body.key, body.value).run()
      return json({ ok: true })
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500)
    }
  }

  return json({ ok: false, error: 'Method not allowed' }, 405)
}
