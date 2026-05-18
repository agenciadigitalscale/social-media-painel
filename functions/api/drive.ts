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
      JSON.stringify({ error: 'APPS_SCRIPT_URL não configurada.' }),
      { status: 500, headers }
    )
  }

  const apiUrl = `${env.APPS_SCRIPT_URL}?folderId=${encodeURIComponent(folderId)}`

  let res: Response
  try {
    res = await fetch(apiUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json, text/plain, */*',
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Fetch falhou: ${String(err)}` }),
      { status: 500, headers }
    )
  }

  let text: string
  try {
    text = await res.text()
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Leitura da resposta falhou: ${String(err)}` }),
      { status: 500, headers }
    )
  }

  let data: AppsScriptResponse
  try {
    data = JSON.parse(text) as AppsScriptResponse
  } catch {
    return new Response(
      JSON.stringify({ error: `Apps Script retornou resposta inválida (status ${res.status}): ${text.slice(0, 300)}` }),
      { status: 500, headers }
    )
  }

  if (data.error) {
    return new Response(
      JSON.stringify({ error: `Apps Script: ${data.error}` }),
      { status: 500, headers }
    )
  }

  return new Response(JSON.stringify({ files: data.files ?? [] }), { headers })
}
