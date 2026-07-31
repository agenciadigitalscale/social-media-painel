const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

import { ensureColumn } from './_lib/schema-guard'
import {
  canonicalizeLinkedDriveVideos,
  repairCanonicalDriveLinks,
  type DriveVideoLinkRow,
} from './_lib/drive-video-links'

interface Env {
  DB: D1Database
}

const PRESENCE_KEY = '_drive_presence'

/** `${cliente}::${driveFileId}` → timestamp da última vez visto na pasta Publicar. */
async function loadPresence(db: D1Database): Promise<Record<string, number> | null> {
  try {
    const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(PRESENCE_KEY).first<{ value: string }>()
    if (!row?.value) return null
    const parsed = JSON.parse(row.value) as Record<string, number>
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const url    = new URL(request.url)
  const method = request.method.toUpperCase()

  // GET /api/drive-videos?status=inbox|linked|ignored|all&client=X
  if (method === 'GET') {
    const status = url.searchParams.get('status') ?? 'inbox'
    const client = url.searchParams.get('client')

    let query = 'SELECT * FROM drive_videos'
    const params: (string | number)[] = []

    const conditions: string[] = []
    if (status !== 'all') { conditions.push('status = ?'); params.push(status) }
    if (client)           { conditions.push('client_name = ?'); params.push(client) }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')
    query += ' ORDER BY detected_at DESC LIMIT 200'

    try {
      const { results } = await env.DB.prepare(query).bind(...params).all()
      // A presença ("quem está na pasta Publicar agora") vai junto: é ela que
      // decide se o card pode mostrar prévia. Sem ela o cliente assume o estado
      // conhecido e não apaga nada — ausência de dado não é prova de remoção.
      const presence = await loadPresence(env.DB)
      const rawVideos = results as unknown as DriveVideoLinkRow[]
      const videos = canonicalizeLinkedDriveVideos(rawVideos, presence)

      // O vínculo é uma decisão central. Repara o estado compartilhado antes de
      // responder e devolve só a versão canônica, impedindo que um navegador com
      // cache antigo restaure confirmed=false ou uma reexportação removida.
      try {
        await ensureColumn(env.DB, 'app_data', 'rev', 'INTEGER NOT NULL DEFAULT 0')
        await repairCanonicalDriveLinks(env.DB, videos, rawVideos, presence)
      } catch (repairError) {
        // A Inbox continua disponível mesmo se a autorreparação falhar; o poll
        // seguinte tenta de novo.
        console.error('[drive-videos] falha ao reparar vínculos centrais', repairError)
      }

      return new Response(JSON.stringify({ ok: true, videos, presence }), { headers: CORS })
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, videos: [], error: String(e) }), { status: 500, headers: CORS })
    }
  }

  // PATCH /api/drive-videos — update status / linked_item_id
  if (method === 'PATCH') {
    let body: { drive_file_id?: string; status?: string; linked_item_id?: number | null; client_name?: string; filename?: string; mime_type?: string }
    try { body = await request.json() } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS }) }

    if (!body.drive_file_id) {
      return new Response(JSON.stringify({ error: 'drive_file_id required' }), { status: 400, headers: CORS })
    }

    const fields: string[] = ['updated_at = unixepoch()']
    const params: (string | number | null)[] = []

    if (body.status !== undefined)          { fields.push('status = ?');          params.push(body.status) }
    if (body.linked_item_id !== undefined)  { fields.push('linked_item_id = ?');  params.push(body.linked_item_id) }

    if (fields.length === 1) return new Response(JSON.stringify({ error: 'Nothing to update' }), { status: 400, headers: CORS })

    params.push(body.drive_file_id)
    const res = await env.DB.prepare(
      `UPDATE drive_videos SET ${fields.join(', ')} WHERE drive_file_id = ?`
    ).bind(...params).run()

    // Linha ainda não existe: é um arquivo que a esteira da coluna "Pronto" achou
    // direto na pasta Publicar, antes de qualquer varredura. Sem gravá-lo aqui, o
    // próximo scan o inseriria como 'inbox' e ele apareceria como arquivo novo,
    // com toast e tudo — já estando vinculado a um card.
    if (res.meta.changes === 0 && body.client_name && body.filename) {
      await ensureColumn(env.DB, 'drive_videos', 'mime_type', 'TEXT')
      await env.DB.prepare(`
        INSERT INTO drive_videos
          (drive_file_id, client_name, filename, mime_type, status, linked_item_id, detected_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch(), unixepoch())
        ON CONFLICT(drive_file_id) DO UPDATE SET
          status = excluded.status,
          linked_item_id = excluded.linked_item_id,
          -- Linha antiga não tem mime: aceita o que a esteira acabou de ver, mas
          -- nunca troca um valor conhecido por nulo.
          mime_type = COALESCE(excluded.mime_type, drive_videos.mime_type),
          updated_at = unixepoch()
      `).bind(
        body.drive_file_id,
        body.client_name,
        body.filename,
        body.mime_type ?? null,
        body.status ?? 'linked',
        body.linked_item_id ?? null,
      ).run()
    }

    return new Response(JSON.stringify({ ok: true }), { headers: CORS })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS })
}
