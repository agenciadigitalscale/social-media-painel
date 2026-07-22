// Proxy de streaming para arquivos do Google Drive.
//
// **Nunca redireciona o cliente para o Google.** Até 2026-07-22 existia um
// "caminho rápido": quando o pedido chegava sem `Range`, o Worker devolvia 302
// para `drive.usercontent.google.com`. Aquela URL é feita para download, não
// para tocar dentro de uma página — volta com `Cross-Origin-Resource-Policy:
// same-site`, `Content-Disposition: attachment` e `Content-Security-Policy:
// sandbox`, e um <video> apontado para ela morre com MEDIA_ERR_SRC_NOT_SUPPORTED
// (verificado). Quem manda `Range` (iPhone sempre manda) escapava; quem não
// manda — WebView do WhatsApp em parte dos Androids, player que sonda com HEAD —
// via tela preta. Era o "alguns clientes não conseguem visualizar".
//
// Ordem: service account primeiro (mime correto, Range honrado, funciona em
// pasta privada), download público como plano B (arquivo fora das pastas da
// agência, colado à mão de outro Drive).

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
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
}

/** Drive devolve HTML (tela de login/aviso) em vez do arquivo quando não pode servir. */
function looksLikeHtml(res: Response): boolean {
  return (res.headers.get('Content-Type') ?? '').includes('text/html')
}

/**
 * `application/octet-stream` faz o Safari recusar o vídeo sem nem tentar. Quando
 * o upstream não sabe dizer o que é, o cliente diz — o viewer conhece o tipo do
 * card. Sem palpite: na ausência dos dois, passa o que veio.
 */
function resolveContentType(upstream: string | null, hint: string | null): string | null {
  const vague = !upstream || upstream.includes('octet-stream') || upstream.includes('binary')
  if (!vague) return upstream
  if (hint === 'video') return 'video/mp4'
  if (hint === 'image') return 'image/jpeg'
  return upstream
}

function buildHeaders(source: Response, hint: string | null, cache: string): Headers {
  const out = new Headers(CORS)
  out.set('Accept-Ranges', 'bytes')
  out.set('Cache-Control', cache)
  // O arquivo é para ser assistido aqui dentro, não baixado: `attachment` faz
  // parte dos navegadores tratarem a resposta como download e abandonarem o player.
  out.set('Content-Disposition', 'inline')

  const ct = resolveContentType(source.headers.get('Content-Type'), hint)
  if (ct) out.set('Content-Type', ct)

  for (const h of ['Content-Length', 'Content-Range']) {
    const v = source.headers.get(h)
    if (v) out.set(h, v)
  }
  return out
}

async function streamAuthenticated(
  fileId: string, request: Request, env: Env, hint: string | null,
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

  let res: Response
  try {
    res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      { method: request.method === 'HEAD' ? 'HEAD' : 'GET', headers },
    )
  } catch {
    return null
  }
  if (!res.ok && res.status !== 206) {
    try { res.body?.cancel() } catch { /* corpo já consumido */ }
    return null
  }

  return new Response(res.body, { status: res.status, headers: buildHeaders(res, hint, 'private, max-age=600') })
}

async function streamPublic(
  fileId: string, request: Request, hint: string | null,
): Promise<Response | null> {
  // confirm=t bypassa o aviso de vírus que o Drive põe em arquivo grande.
  const driveUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  }
  const range = request.headers.get('Range')
  if (range) headers['Range'] = range

  let res: Response
  try {
    res = await fetch(driveUrl, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers,
      redirect: 'follow',
    })
  } catch {
    return null
  }

  // Privado: 4xx, ou 200 com a página de aviso do Drive. Devolver essa página
  // como se fosse o arquivo faria o player falhar sem dizer por quê.
  if ((!res.ok && res.status !== 206) || looksLikeHtml(res)) {
    try { res.body?.cancel() } catch { /* corpo já consumido */ }
    return null
  }

  return new Response(res.body, { status: res.status, headers: buildHeaders(res, hint, 'public, max-age=3600') })
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  const url    = new URL(request.url)
  const fileId = url.searchParams.get('id')
  const hint   = url.searchParams.get('kind')   // 'video' | 'image' — dica de mime

  if (!fileId || !/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
    return new Response('Invalid file ID', { status: 400, headers: CORS })
  }

  const authed = await streamAuthenticated(fileId, request, env, hint)
  if (authed) return authed

  const open = await streamPublic(fileId, request, hint)
  if (open) return open

  return new Response(
    'Arquivo indisponível: não é público e a conta de serviço não tem acesso.',
    { status: 403, headers: CORS },
  )
}
