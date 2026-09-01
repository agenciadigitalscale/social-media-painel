/* _lib/stream-video.ts — Cloudflare Stream: transcodificação e entrega adaptativa.

   ── O problema, medido em 01/09/2026 ──────────────────────────────────
   O cliente recebe o arquivo de EDIÇÃO. Medido em `drive_videos`: média de
   87 MB nos últimos 30 dias, 97 de 148 acima de 70 MB. No registro do viewer
   (300 eventos, 6 dias), o Android travou em **15 de 42** reproduções — 36%,
   contra 7% no iOS. O vídeo não baixa na velocidade em que toca.

   Aumentar o buffer não resolve: é aritmética. O que resolve é o vídeo ter
   versões mais leves para quando a conexão cai — que é o que o Stream faz.

   E resolve o segundo problema de graça: `.mov` (metade dos exports dos
   últimos 30 dias) é recusado pelo Android antes mesmo de decodificar. O
   Stream normaliza tudo para HLS/DASH, então o contêiner de origem deixa de
   importar.

   ── Por que "copy by URL" e não upload ────────────────────────────────
   O Worker teria que ler o arquivo inteiro na memória para subir por
   multipart, e são ~87 MB por vídeo. O Stream aceita buscar sozinho a partir
   de uma URL pública — e o `/api/stream` já serve o arquivo (do R2, que o
   espelho preencheu). Ou seja: o Cloudflare puxa de nós, sem o Worker
   carregar um byte.

   ── Falha aberta ──────────────────────────────────────────────────────
   Nada aqui pode derrubar o espelho nem o envio. Se o Stream não responder,
   o vídeo continua sendo servido como hoje, direto do R2. A transcodificação
   é uma MELHORIA da entrega, não um pré-requisito dela.
*/

export interface StreamEnv {
  /** Token com permissão Account · Stream · Edit. Sem ele, nada acontece. */
  STREAM_API_TOKEN?: string
  /** Conta do Cloudflare. Cai no padrão quando ausente. */
  CF_ACCOUNT_ID?: string
}

/** Conta da agência — não é segredo, aparece em qualquer URL da API. */
const CONTA_PADRAO = '28b4d31a82dfd80b38bd214bbaa3feee'

export const streamDisponivel = (env: StreamEnv): boolean => !!env.STREAM_API_TOKEN

function apiBase(env: StreamEnv): string {
  return `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID || CONTA_PADRAO}/stream`
}

/**
 * De onde o Stream vai buscar o arquivo.
 *
 * Aponta para o nosso próprio `/api/stream`, que serve do R2 quando o espelho
 * já tem o arquivo. `kind=video` está aí porque o Drive devolve
 * `application/octet-stream` em parte dos arquivos, e o Stream precisa saber
 * que aquilo é vídeo.
 */
export function urlDeOrigem(origem: string, fileId: string): string {
  return `${origem.replace(/\/+$/, '')}/api/stream?id=${encodeURIComponent(fileId)}&kind=video`
}

export interface RespostaStream {
  ok: boolean
  uid?: string
  /** `ready` quando dá para tocar; `inprogress` enquanto transcodifica. */
  estado?: 'ready' | 'inprogress' | 'error' | 'queued'
  erro?: string
}

/**
 * Lê a resposta da API do Stream.
 *
 * Separado da requisição de propósito: é a parte que erra, e é a única que dá
 * para testar sem rede. A API devolve `success: false` com uma lista de erros,
 * ou `result` com `uid` e `status.state`.
 */
export function interpretarResposta(dados: unknown): RespostaStream {
  const d = dados as {
    success?: boolean
    errors?: { message?: string }[]
    result?: { uid?: string; status?: { state?: string; errorReasonText?: string } }
  }
  if (!d || typeof d !== 'object') return { ok: false, erro: 'resposta vazia' }
  if (d.success === false) {
    const msg = d.errors?.map(e => e.message).filter(Boolean).join('; ')
    return { ok: false, erro: msg || 'a API do Stream recusou' }
  }
  const uid = d.result?.uid
  if (!uid) return { ok: false, erro: 'resposta sem uid' }

  const bruto = d.result?.status?.state
  const estado: RespostaStream['estado'] =
    bruto === 'ready' ? 'ready'
    : bruto === 'error' ? 'error'
    : bruto === 'queued' ? 'queued'
    : 'inprogress'

  return {
    ok: true,
    uid,
    estado,
    // O motivo do erro vem num campo à parte; sem ele, um vídeo que falhou na
    // transcodificação viraria só "error" e ninguém saberia por quê.
    erro: estado === 'error' ? (d.result?.status?.errorReasonText || 'falhou ao transcodificar') : undefined,
  }
}

/**
 * Lê a resposta HTTP com o status na mão.
 *
 * A primeira versão fazia `await res.json()` direto, e quando a API respondia
 * algo que não é JSON — 401 com corpo vazio, página de erro em HTML — o erro
 * gravado era "Unexpected end of JSON input". Isso não diz nada: some o código
 * HTTP, some o motivo, e o diagnóstico vira adivinhação. Aconteceu na primeira
 * chamada real (01/09/2026) e custou uma rodada inteira para descobrir.
 */
export async function lerResposta(res: Response): Promise<RespostaStream> {
  const texto = await res.text()
  if (!texto.trim()) {
    return { ok: false, erro: `HTTP ${res.status} com corpo vazio` }
  }
  let dados: unknown
  try {
    dados = JSON.parse(texto)
  } catch {
    // Mantém um pedaço do corpo: é o que identifica página de erro, redirect
    // para login, bloqueio de WAF.
    return { ok: false, erro: `HTTP ${res.status}: ${texto.slice(0, 160)}` }
  }
  const r = interpretarResposta(dados)
  // Status ruim com JSON válido: o corpo já traz o motivo, mas sem o código
  // não dá para separar "token errado" (403) de "conta sem Stream" (404).
  if (!r.ok && !String(r.erro ?? '').includes('HTTP')) {
    return { ...r, erro: `HTTP ${res.status}: ${r.erro}` }
  }
  return r
}

/** URL do player. É a única forma de tocar HLS sem biblioteca no navegador. */
export function urlDoPlayer(uid: string): string {
  return `https://iframe.cloudflarestream.com/${uid}`
}

/** Miniatura gerada pelo próprio Stream — evita mais uma volta ao Drive. */
export function urlDaMiniatura(uid: string): string {
  return `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`
}

/**
 * Manda o Stream buscar e transcodificar o arquivo.
 *
 * `meta.name` aparece no painel do Cloudflare — sem ele a lista vira uma
 * parede de UIDs e não dá para saber o que é o quê.
 */
export async function enviarParaStream(
  env: StreamEnv,
  fileId: string,
  origem: string,
  nome?: string,
): Promise<RespostaStream> {
  if (!env.STREAM_API_TOKEN) return { ok: false, erro: 'STREAM_API_TOKEN não configurado' }
  try {
    const res = await fetch(`${apiBase(env)}/copy`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STREAM_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: urlDeOrigem(origem, fileId),
        meta: { name: nome || fileId, driveFileId: fileId },
        // O link do cliente não expira; o vídeo também não deve.
        requireSignedURLs: false,
      }),
    })
    return lerResposta(res)
  } catch (e) {
    return { ok: false, erro: (e as Error).message }
  }
}

/** Já dá para tocar? Chamado enquanto o estado não é `ready`. */
export async function estadoDoStream(env: StreamEnv, uid: string): Promise<RespostaStream> {
  if (!env.STREAM_API_TOKEN) return { ok: false, erro: 'STREAM_API_TOKEN não configurado' }
  try {
    const res = await fetch(`${apiBase(env)}/${uid}`, {
      headers: { Authorization: `Bearer ${env.STREAM_API_TOKEN}` },
    })
    return lerResposta(res)
  } catch (e) {
    return { ok: false, erro: (e as Error).message }
  }
}

/**
 * Vale a pena mandar este arquivo para o Stream?
 *
 * Imagem não: o Stream é de vídeo, e a mediana das imagens é 1,2 MB — não há
 * o que ganhar. Arquivo minúsculo também não: transcodificar um vídeo de 3 MB
 * gasta minuto de armazenamento para resolver um problema que não existe.
 */
export function valeTranscodificar(mime: string | null | undefined, nome: string, bytes: number): boolean {
  const ehVideo = (mime ?? '').startsWith('video/')
    || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(nome)
  if (!ehVideo) return false
  // 8 MB: abaixo disso o arquivo já chega rápido em qualquer conexão.
  return bytes > 8 * 1024 * 1024
}
