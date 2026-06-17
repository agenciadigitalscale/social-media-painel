import { getAccessToken } from './_lib/google-auth'
import { writeNotification } from './notifications'

interface Env {
  DB: D1Database
  GOOGLE_SA_KEY: string
  CRON_SECRET: string
}

interface DriveFolder {
  client_name: string
  folder_id:   string
  page_token:  string | null
}

interface DriveFile {
  id:            string
  name:          string
  size?:         string
  thumbnailLink?: string
}

interface DriveListResponse {
  nextPageToken?: string
  files:          DriveFile[]
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

const MANUAL_COOLDOWN_MS = 90_000 // 90s entre scans manuais
const MANUAL_TS_KEY      = '_drive_scan_last_manual'

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const auth     = request.headers.get('Authorization') ?? ''
  const isManual = request.headers.get('X-App-Manual') === '1'
  const isCron   = env.CRON_SECRET && auth === `Bearer ${env.CRON_SECRET}`

  if (!isCron && !isManual) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
  }

  // Rate limit: scans manuais respeitam cooldown de 90s
  if (isManual) {
    const row = await env.DB.prepare('SELECT value FROM app_data WHERE key = ?').bind(MANUAL_TS_KEY).first<{ value: string }>()
    const lastTs = row ? parseInt(row.value, 10) : 0
    const remaining = Math.ceil((MANUAL_COOLDOWN_MS - (Date.now() - lastTs)) / 1000)
    if (remaining > 0) {
      return new Response(JSON.stringify({ error: 'rate_limited', remaining }), { status: 429, headers: CORS })
    }
    await env.DB.prepare(`
      INSERT INTO app_data (key, value) VALUES (?1, ?2)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = CURRENT_TIMESTAMP
    `).bind(MANUAL_TS_KEY, String(Date.now())).run()
  }

  let accessToken: string
  try {
    accessToken = await getAccessToken(env)
  } catch (e) {
    return new Response(JSON.stringify({ error: `Auth failed: ${(e as Error).message}` }), { status: 500, headers: CORS })
  }

  const { results: folders } = await env.DB.prepare(
    'SELECT client_name, folder_id, page_token FROM drive_folders WHERE is_active = 1',
  ).all<DriveFolder>()

  const summary: Record<string, { new_videos: number; error?: string }> = {}

  for (const folder of folders) {
    const entry: { new_videos: number; error?: string } = { new_videos: 0 }
    summary[folder.client_name] = entry

    try {
      // No primeiro scan (sem page_token), limita aos últimos 7 dias para evitar flood de arquivos antigos
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')
      const dateFilter = folder.page_token ? '' : ` and createdTime >= '${sevenDaysAgo}'`
      const params = new URLSearchParams({
        q: `'${folder.folder_id}' in parents and mimeType contains 'video/' and trashed = false${dateFilter}`,
        fields: 'nextPageToken,files(id,name,size,thumbnailLink,createdTime)',
        pageSize: '50',
        orderBy: 'createdTime desc',
      })
      if (folder.page_token) params.set('pageToken', folder.page_token)

      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!res.ok) {
        const text = await res.text()
        entry.error = `Drive API ${res.status}: ${text.slice(0, 200)}`
        continue
      }

      const data = await res.json<DriveListResponse>()

      for (const file of data.files) {
        const result = await env.DB.prepare(`
          INSERT OR IGNORE INTO drive_videos
            (drive_file_id, client_name, filename, file_size_bytes, thumbnail_url,
             status, detected_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'inbox', unixepoch(), unixepoch(), unixepoch())
        `).bind(
          file.id,
          folder.client_name,
          file.name,
          file.size ? parseInt(file.size, 10) : null,
          file.thumbnailLink ?? null,
        ).run()

        if (result.meta.changes > 0) entry.new_videos++
      }

      const newToken = data.nextPageToken ?? null
      await env.DB.prepare(`
        UPDATE drive_folders
        SET page_token = ?, last_scanned_at = unixepoch(), updated_at = unixepoch()
        WHERE client_name = ?
      `).bind(newToken, folder.client_name).run()

    } catch (e) {
      entry.error = (e as Error).message
    }
  }

  const totalNew = Object.values(summary).reduce((s, v) => s + v.new_videos, 0)

  // Notifica a equipe quando novos vídeos são detectados
  if (totalNew > 0) {
    const clients = Object.entries(summary)
      .filter(([, v]) => v.new_videos > 0)
      .map(([c]) => c)
      .join(', ')
    await writeNotification(env.DB, {
      id:         crypto.randomUUID(),
      type:       'new_video',
      clientName: clients,
      itemId:     0,
      itemTitle:  `${totalNew} vídeo${totalNew > 1 ? 's' : ''} novo${totalNew > 1 ? 's' : ''} na pasta Publicar`,
      ts:         Date.now(),
    })
  }

  return new Response(JSON.stringify({ ok: true, scanned: folders.length, new_videos: totalNew, summary }), { headers: CORS })
}
