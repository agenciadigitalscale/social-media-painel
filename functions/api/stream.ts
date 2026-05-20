// Proxy / redirect de streaming para vídeos do Google Drive
// Lógica: resolve o redirect do Drive e manda o cliente diretamente ao CDN do Google,
// eliminando o Worker do caminho de streaming (Cliente → CDN Google, sem intermediário).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
}

export const onRequest: PagesFunction = async (ctx) => {
  const { request } = ctx

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  const url    = new URL(request.url)
  const fileId = url.searchParams.get('id')

  if (!fileId || !/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
    return new Response('Invalid file ID', { status: 400 })
  }

  const rangeHeader = request.headers.get('Range')

  // export=download&confirm=t: mais direto que export=view, bypassa aviso de arquivo grande
  const driveUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`

  const upstreamHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  }
  if (rangeHeader) upstreamHeaders['Range'] = rangeHeader

  let upstream: Response
  try {
    upstream = await fetch(driveUrl, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: upstreamHeaders,
      redirect: 'follow',
    })
  } catch (e) {
    return new Response('Upstream fetch failed: ' + String(e), { status: 502 })
  }

  // Na requisição inicial (sem Range), se o Google redirecionou para um CDN URL diferente,
  // retorna 302 direto para o cliente — o Worker sai do caminho de streaming.
  // Todas as requisições Range subsequentes vão direto ao CDN do Google (rápido).
  if (!rangeHeader && upstream.url && upstream.url !== driveUrl && upstream.ok) {
    const ct = upstream.headers.get('Content-Type') ?? ''
    if (ct.includes('video') || ct.includes('octet-stream') || ct.includes('mp4')) {
      try { upstream.body?.cancel() } catch {}
      return new Response(null, {
        status: 302,
        headers: { Location: upstream.url, ...CORS },
      })
    }
  }

  // Fallback: proxy direto (Range requests ou sem redirect detectado)
  const respHeaders = new Headers(CORS)
  respHeaders.set('Accept-Ranges', 'bytes')
  respHeaders.set('Cache-Control', 'public, max-age=3600')

  const ct = upstream.headers.get('Content-Type')
  if (ct) respHeaders.set('Content-Type', ct)

  const cl = upstream.headers.get('Content-Length')
  if (cl) respHeaders.set('Content-Length', cl)

  const cr = upstream.headers.get('Content-Range')
  if (cr) respHeaders.set('Content-Range', cr)

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  })
}
