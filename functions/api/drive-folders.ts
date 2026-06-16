const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

interface Env {
  DB: D1Database
}

function extractFolderId(url: string): string {
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : url.trim()
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

  // Ensure tables exist (idempotent)
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS drive_folders (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name     TEXT    NOT NULL UNIQUE,
      folder_id       TEXT    NOT NULL,
      is_active       INTEGER NOT NULL DEFAULT 1,
      last_scanned_at INTEGER,
      page_token      TEXT,
      created_at      INTEGER DEFAULT (unixepoch()),
      updated_at      INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS drive_videos (
      drive_file_id   TEXT    PRIMARY KEY,
      client_name     TEXT    NOT NULL,
      filename        TEXT    NOT NULL,
      file_size_bytes INTEGER,
      thumbnail_url   TEXT,
      detected_at     INTEGER DEFAULT (unixepoch()),
      linked_item_id  INTEGER,
      status          TEXT    NOT NULL DEFAULT 'inbox',
      approval_token  TEXT    UNIQUE,
      created_at      INTEGER DEFAULT (unixepoch()),
      updated_at      INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_dv_client ON drive_videos(client_name);
    CREATE INDEX IF NOT EXISTS idx_dv_status  ON drive_videos(status);
  `)

  const method = request.method.toUpperCase()
  const url    = new URL(request.url)

  if (method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, client_name, folder_id, is_active, last_scanned_at FROM drive_folders ORDER BY client_name',
    ).all()
    return new Response(JSON.stringify({ ok: true, folders: results }), { headers: CORS })
  }

  if (method === 'POST') {
    let body: { client_name?: string; folder_url?: string; is_active?: number }
    try { body = await request.json() } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS }) }

    if (!body.client_name || !body.folder_url) {
      return new Response(JSON.stringify({ error: 'client_name and folder_url are required' }), { status: 400, headers: CORS })
    }

    const folderId = extractFolderId(body.folder_url)
    await env.DB.prepare(`
      INSERT INTO drive_folders (client_name, folder_id, is_active, updated_at)
      VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(client_name) DO UPDATE SET
        folder_id  = excluded.folder_id,
        is_active  = excluded.is_active,
        page_token = NULL,
        updated_at = unixepoch()
    `).bind(body.client_name, folderId, body.is_active ?? 1).run()

    return new Response(JSON.stringify({ ok: true, folder_id: folderId }), { headers: CORS })
  }

  if (method === 'DELETE') {
    const client = url.searchParams.get('client')
    if (!client) return new Response(JSON.stringify({ error: 'client param required' }), { status: 400, headers: CORS })
    await env.DB.prepare('DELETE FROM drive_folders WHERE client_name = ?').bind(client).run()
    return new Response(JSON.stringify({ ok: true }), { headers: CORS })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS })
}
