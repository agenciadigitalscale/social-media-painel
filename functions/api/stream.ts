// Proxy / redirect de streaming para arquivos do Google Drive
//
// Caminho rápido: resolve o redirect do Drive e manda o cliente direto ao CDN do
// Google, tirando o Worker do meio. Só funciona com arquivo público.
//
// Caminho autenticado (fallback): quando o público falha — pasta não
// compartilhada, que é o padrão do Drive — busca com a service account. Sem ele,
// a validação da esteira e o player da revisão quebrariam em toda pasta privada,
// e a mensagem que aparece ("não pôde ser reproduzido") não deixaria claro que o
// problema é permissão, não o arquivo.

import { getAccessToken } from './_lib/google-auth'

interface Env {
  // getAccessToken guarda o token no D1 — por isso o binding entra aqui também.
  DB: D1Database
  GOOGLE_SA_KEY?: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
}

/** Drive devolve HTML (tela de login/aviso) em vez do arquivo quando não pode servir. */
function looksLikeHtml(res: Response): boolean {
  return (res.headers.get('Content-Type') ?? '').includes('text/html')
}

async function streamAuthenticated(
  fileId: string, request: Request, env: Env,
): Promise<Response | null> {
  if (!env.GOOGLE_SA_KEY || !env.DB) return null

  let token: string
  try {
    token = await getAccessToken({ DB: env.DB, GOOGLE_SA_KEY: env.GOOGLE_SA_KEY })
  } catch {
    return null
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  const range = request.headers.get('Range')
  if (range) headers['Range'] = range

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { method: request.method === 'HEAD' ? 'HEAD' : 'GET', headers },
  )
  if (!res.ok && res.status !== 206) return null

  const out = new Headers(CORS)
  out.set('Accept-Ranges', 'bytes')
  out.set('Cache-Control', 'private, max-age=600')
  for (const h of ['Content-Type', 'Content-Length', 'Content-Range']) {
    const v = res.headers.get(h)
    if (v) out.set(h, v)
  }
  return new Response(res.body, { status: res.status, headers: out })
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx

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

  let upstream: Response | null = null
  try {
    upstream = await fetch(driveUrl, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: upstreamHeaders,
      redirect: 'follow',
    })
  } catch { /* cai no caminho autenticado abaixo */ }

  // Arquivo privado: o Drive responde 4xx, ou 200 com a página de aviso em HTML.
  if (!upstream || (!upstream.ok && upstream.status !== 206) || looksLikeHtml(upstream)) {
    try { upstream?.body?.cancel() } catch { /* corpo já consumido */ }
    const authed = await streamAuthenticated(fileId, request, env)
    if (authed) return authed
    // Nem público nem acessível pela service account. Devolver a página de aviso
    // do Drive como se fosse o arquivo faria o player falhar sem dizer por quê.
    return new Response(
      'Arquivo indisponível: não é público e a conta de serviço não tem acesso.',
      { status: 403, headers: CORS },
    )
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
