interface Env {
  GOOGLE_DRIVE_API_KEY?: string
}

interface DriveFile {
  name: string
  id: string
  mimeType: string
}

interface DriveResponse {
  files?: DriveFile[]
  error?: { message: string; code: number }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }

  const url = new URL(request.url)
  const folderId = url.searchParams.get('folderId')

  if (!folderId) {
    return new Response(JSON.stringify({ error: 'folderId obrigatório' }), { status: 400, headers })
  }

  if (!env.GOOGLE_DRIVE_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'GOOGLE_DRIVE_API_KEY não configurada. Adicione em Cloudflare Pages → Settings → Environment Variables.' }),
      { status: 500, headers }
    )
  }

  const apiUrl =
    `https://www.googleapis.com/drive/v3/files` +
    `?q=%27${folderId}%27+in+parents` +
    `&fields=files(name,id,mimeType)` +
    `&orderBy=name` +
    `&pageSize=100` +
    `&key=${env.GOOGLE_DRIVE_API_KEY}`

  try {
    const res = await fetch(apiUrl)
    const data = await res.json() as DriveResponse

    if (data.error) {
      return new Response(
        JSON.stringify({ error: `Drive API: ${data.error.message}` }),
        { status: res.status, headers }
      )
    }

    const files = (data.files ?? []).map(f => ({
      name: f.name,
      id: f.id,
      isFolder: f.mimeType === 'application/vnd.google-apps.folder',
    }))

    return new Response(JSON.stringify({ files }), { headers })
  } catch {
    return new Response(JSON.stringify({ error: 'Falha ao conectar com o Google Drive' }), { status: 500, headers })
  }
}
