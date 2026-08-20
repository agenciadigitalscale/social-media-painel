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
  /** Espelho dos criativos. Ausente = tudo segue vindo do Drive, como antes. */
  CRIATIVOS?: R2Bucket
}

/** Chave do espelho — um arquivo do Drive, um objeto. */
export function mirrorKey(fileId: string): string {
  return `drive/${fileId}`
}

/**
 * O cabeçalho que decide "assistir aqui" x "salvar no aparelho".
 *
 * O padrão é `inline` e continua sendo: `attachment` faz o navegador tratar a
 * resposta como download e abandonar o player — foi assim que o link do cliente
 * passou a abrir em tela preta quando caía no caminho público do Drive.
 *
 * `?dl=1` inverte a escolha DE PROPÓSITO, e só a pedido de um clique. Existe
 * porque aprovar e publicar são trabalhos diferentes: para aprovar o cliente
 * quer que comece em dois segundos; para publicar ele quer o arquivo inteiro,
 * na qualidade que saiu da edição. Um link só servindo aos dois servia mal aos
 * dois, e o resultado era o cliente pedindo "manda aberto" no WhatsApp.
 */
export function contentDisposition(download: boolean, filename: string | null): string {
  if (!download) return 'inline'
  if (!filename) return 'attachment'
  // Aspas, barra e quebra de linha quebram o cabeçalho — e quebra de linha
  // permite injetar outros cabeçalhos. O nome vem do Drive, que aceita quase tudo.
  // eslint-disable-next-line no-control-regex
  const safe = filename.replace(/["\\\r\n\x00-\x1f]/g, '').trim().slice(0, 120)
  if (!safe) return 'attachment'
  // `filename*` carrega o acento (RFC 5987); o `filename` simples fica de
  // reserva para quem não entende, com os não-ASCII trocados por "_".
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`
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

function buildHeaders(source: Response, hint: string | null, cache: string, disposition = 'inline'): Headers {
  const out = new Headers(CORS)
  out.set('Accept-Ranges', 'bytes')
  out.set('Cache-Control', cache)
  out.set('Content-Disposition', disposition)

  const ct = resolveContentType(source.headers.get('Content-Type'), hint)
  if (ct) out.set('Content-Type', ct)

  for (const h of ['Content-Length', 'Content-Range']) {
    const v = source.headers.get(h)
    if (v) out.set(h, v)
  }
  return out
}

/**
 * Espelho no R2. É o caminho preferido: a Cloudflare já está com o arquivo, o
 * Range é nativo e o link do cliente deixa de depender de o arquivo continuar
 * na pasta Publicar — hoje, apagar do Drive mata o link sem aviso.
 */
async function streamFromMirror(
  fileId: string, request: Request, env: Env, hint: string | null, disposition = 'inline',
): Promise<Response | null> {
  if (!env.CRIATIVOS) return null

  let object: R2ObjectBody | null = null
  try {
    // A própria API do R2 lê o cabeçalho Range — inclusive `bytes=-N`.
    object = await env.CRIATIVOS.get(mirrorKey(fileId), { range: request.headers })
  } catch {
    return null
  }
  if (!object || !object.body) return null

  const headers = new Headers(CORS)
  object.writeHttpMetadata(headers)
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Content-Disposition', disposition)
  headers.set('Cache-Control', 'public, max-age=86400')
  headers.set('X-DS-Source', 'r2')

  const ct = resolveContentType(headers.get('Content-Type'), hint)
  if (ct) headers.set('Content-Type', ct)

  const range = object.range
  if (request.headers.get('Range') && range) {
    const offset = 'offset' in range && range.offset !== undefined
      ? range.offset
      : object.size - (('suffix' in range && range.suffix) || 0)
    const length = 'length' in range && range.length !== undefined
      ? range.length
      : object.size - offset
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`)
    headers.set('Content-Length', String(length))
    return new Response(object.body, { status: 206, headers })
  }

  headers.set('Content-Length', String(object.size))
  return new Response(object.body, { status: 200, headers })
}

async function streamAuthenticated(
  fileId: string, request: Request, env: Env, hint: string | null, disposition = 'inline',
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

  return new Response(res.body, { status: res.status, headers: buildHeaders(res, hint, 'private, max-age=600', disposition) })
}

async function streamPublic(
  fileId: string, request: Request, hint: string | null, disposition = 'inline',
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

  return new Response(res.body, { status: res.status, headers: buildHeaders(res, hint, 'public, max-age=3600', disposition) })
}

/** Vídeo de 15s em 4K passa longe disto; acima é sinal de arquivo errado. */
const MIRROR_MAX_BYTES = 600 * 1024 * 1024

/**
 * Só a PRIMEIRA requisição de uma sessão de playback vale como gatilho.
 *
 * Tocar um vídeo no celular gera dezenas de pedidos com `Range` conforme o
 * player busca e avança. Sem esta trava, cada um deles agendaria uma cópia do
 * mesmo arquivo — a agência pagaria a banda do Drive várias vezes pelo mesmo
 * espelho. O primeiro pedido é sempre o do começo do arquivo (ou sem `Range`).
 */
function startsPlayback(request: Request): boolean {
  const range = request.headers.get('Range')
  if (!range) return true
  return /^bytes=0-/.test(range.trim())
}

/**
 * Copia para o R2 o que ainda não está espelhado, depois de já ter respondido.
 *
 * O espelho existe desde 2026-07-22, mas só era preenchido no momento em que a
 * esteira vinculava o arquivo. Tudo que foi vinculado antes disso — ou onde a
 * chamada ao `/api/mirror` falhou — continua sendo servido do Drive: cada
 * exibição no celular do cliente atravessa o Google, e o link morre se alguém
 * mexer na pasta Publicar. Aqui a primeira exibição paga a cópia e todas as
 * seguintes saem da Cloudflare.
 *
 * Roda em `waitUntil`: o cliente já recebeu o vídeo antes disto começar. Falhar
 * não muda nada para ninguém — continua servindo do Drive, como antes.
 */
async function backfillMirror(fileId: string, env: Env): Promise<void> {
  if (!env.CRIATIVOS || !env.GOOGLE_SA_KEY || !env.DB) return

  // Mesma trava do `/api/mirror`: só espelha arquivo que a agência já rastreia.
  // Sem ela, um endpoint público mandaria a gente pagar o armazenamento de
  // qualquer arquivo que a service account enxergue.
  const known = await env.DB.prepare(
    'SELECT 1 FROM drive_videos WHERE drive_file_id = ? LIMIT 1',
  ).bind(fileId).first()
  if (!known) return

  const key = mirrorKey(fileId)
  if (await env.CRIATIVOS.head(key)) return

  const token = await getAccessToken({ DB: env.DB, GOOGLE_SA_KEY: env.GOOGLE_SA_KEY })
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok || !res.body) {
    try { res.body?.cancel() } catch { /* corpo já consumido */ }
    return
  }

  if (Number(res.headers.get('Content-Length') ?? 0) > MIRROR_MAX_BYTES) {
    try { res.body.cancel() } catch { /* corpo já consumido */ }
    return
  }

  await env.CRIATIVOS.put(key, res.body, {
    httpMetadata: {
      contentType:  res.headers.get('Content-Type') ?? 'application/octet-stream',
      cacheControl: 'public, max-age=86400',
    },
  })
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  // `waitUntil` fica no `ctx`: desestruturar perde o `this` e estoura em
  // runtime — o `sync.ts` já resolvia isso com `.bind(ctx)`.
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

  // `?dl=1` — o cliente pediu o arquivo, não a exibição. O nome vem do banco,
  // nunca da URL: aceitar `?name=` deixaria qualquer um escolher o texto de um
  // cabeçalho de resposta nosso.
  const wantsDownload = url.searchParams.get('dl') === '1'
  let disposition = 'inline'
  if (wantsDownload) {
    let filename: string | null = null
    try {
      const row = await env.DB.prepare('SELECT filename FROM drive_videos WHERE drive_file_id = ?')
        .bind(fileId).first<{ filename: string }>()
      filename = row?.filename ?? null
    } catch { /* sem nome o download ainda funciona, só sai genérico */ }
    disposition = contentDisposition(true, filename)
  }

  const mirrored = await streamFromMirror(fileId, request, env, hint, disposition)
  if (mirrored) return mirrored

  // Chegou aqui: não está no espelho. Serve do Drive agora e espelha depois,
  // para a próxima pessoa que abrir o link não passar mais pelo Google.
  if (request.method === 'GET' && startsPlayback(request)) {
    ctx.waitUntil(backfillMirror(fileId, env).catch(() => { /* segue servindo do Drive */ }))
  }

  const authed = await streamAuthenticated(fileId, request, env, hint, disposition)
  if (authed) return authed

  const open = await streamPublic(fileId, request, hint, disposition)
  if (open) return open

  return new Response(
    'Arquivo indisponível: não é público e a conta de serviço não tem acesso.',
    { status: 403, headers: CORS },
  )
}
