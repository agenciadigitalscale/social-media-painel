import { getAccessToken } from './_lib/google-auth'

/**
 * Listagem AO VIVO da pasta Publicar de um cliente.
 *
 * É o que garante três das regras do fluxo Pronto → Revisão sem depender do
 * cache: o arquivo existe agora, está nesta pasta e pertence a este cliente —
 * porque a única pasta que este endpoint sabe listar é a registrada em
 * `drive_folders` para o nome pedido. Não há parâmetro de pasta livre.
 */

interface Env {
  DB: D1Database
  GOOGLE_SA_KEY: string
}

interface DriveApiFile {
  id: string
  name: string
  mimeType: string
  size?: string
  thumbnailLink?: string
  modifiedTime?: string
}

interface DriveListResponse {
  nextPageToken?: string
  files: DriveApiFile[]
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed' }, 405)

  const client = new URL(request.url).searchParams.get('client')
  if (!client) return json({ ok: false, error: 'client obrigatório' }, 400)

  const folder = await env.DB
    .prepare('SELECT folder_id FROM drive_folders WHERE client_name = ? AND is_active = 1')
    .bind(client)
    .first<{ folder_id: string }>()

  if (!folder?.folder_id) {
    return json({ ok: true, reason: 'no_folder', clientName: client, folderId: null, files: [] })
  }

  let accessToken: string
  try {
    accessToken = await getAccessToken(env)
  } catch (e) {
    return json({ ok: false, error: `Auth failed: ${(e as Error).message}` }, 500)
  }

  const files: DriveApiFile[] = []
  let pageToken: string | undefined

  try {
    do {
      const params = new URLSearchParams({
        q: `'${folder.folder_id}' in parents and trashed = false`,
        fields: 'nextPageToken,files(id,name,mimeType,size,thumbnailLink,modifiedTime)',
        pageSize: '1000',
        orderBy: 'modifiedTime desc',
      })
      if (pageToken) params.set('pageToken', pageToken)

      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        const text = await res.text()
        return json({ ok: false, error: `Drive API ${res.status}: ${text.slice(0, 200)}` }, 502)
      }

      const data = await res.json<DriveListResponse>()
      files.push(...data.files)
      pageToken = data.nextPageToken
    } while (pageToken)
  } catch (e) {
    return json({ ok: false, error: `Listagem falhou: ${(e as Error).message}` }, 502)
  }

  return json({
    ok: true,
    clientName: client,
    folderId: folder.folder_id,
    files: files.map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size ? parseInt(f.size, 10) : null,
      thumbnailLink: f.thumbnailLink ?? null,
      modifiedTime: f.modifiedTime ?? null,
    })),
  })
}
