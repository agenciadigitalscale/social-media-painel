interface Env {
  APPS_SCRIPT_URL?: string
}

interface AppsScriptFile {
  name: string
  id: string
  isFolder: boolean
}

interface AppsScriptResponse {
  files?: AppsScriptFile[]
  error?: string
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

  if (!env.APPS_SCRIPT_URL) {
    return new Response(
      JSON.stringify({ error: 'APPS_SCRIPT_URL não configurada. Adicione em Cloudflare Pages → Settings → Environment Variables.' }),
      { status: 500, headers }
    )
  }

  const apiUrl = `${env.APPS_SCRIPT_URL}?folderId=${encodeURIComponent(folderId)}`

  try {
    const res = await fetch(apiUrl, { redirect: 'follow' })
    const data = await res.json() as AppsScriptResponse

    if (data.error) {
      return new Response(
        JSON.stringify({ error: `Apps Script: ${data.error}` }),
        { status: 500, headers }
      )
    }

    return new Response(JSON.stringify({ files: data.files ?? [] }), { headers })
  } catch {
    return new Response(JSON.stringify({ error: 'Falha ao conectar com o Google Apps Script' }), { status: 500, headers })
  }
}
