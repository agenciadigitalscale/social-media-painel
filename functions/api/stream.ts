// Proxy de streaming para vídeos do Google Drive
// Encaminha range requests corretamente para permitir seek no player nativo

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range',
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

  const driveUrl = `https://drive.google.com/uc?export=view&id=${fileId}`

  const upstreamHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (compatible; AppleWebKit)',
  }
  const rangeHeader = request.headers.get('Range')
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
