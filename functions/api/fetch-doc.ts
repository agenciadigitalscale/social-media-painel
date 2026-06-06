const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

export const onRequestGet: PagesFunction = async (ctx) => {
  const url = new URL(ctx.request.url)
  const docUrl = url.searchParams.get('url')

  if (!docUrl) {
    return new Response(JSON.stringify({ ok: false, error: 'missing url' }), { status: 400, headers: corsHeaders })
  }

  const match = docUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) {
    return new Response(JSON.stringify({ ok: false, error: 'URL inválida — esperado link do Google Docs' }), { status: 400, headers: corsHeaders })
  }

  const docId = match[1]
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`

  try {
    const res = await fetch(exportUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 DS-HUB/1.0' },
      redirect: 'follow',
    })

    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: `Google Docs retornou ${res.status} — o documento precisa ser público ("qualquer pessoa com o link")` }), { status: 502, headers: corsHeaders })
    }

    const text = await res.text()
    return new Response(JSON.stringify({ ok: true, text }), { headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
