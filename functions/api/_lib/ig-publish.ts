/**
 * Publicação no Instagram — o núcleo, sem banco e sem rota.
 *
 * Duas metades:
 *  1. `planejar`: decide, a partir do TIPO do card e dos arquivos do criativo, o
 *     que vai para o Instagram (imagem, Reel, story ou carrossel) — ou explica
 *     por que aquilo não pode ser publicado pela integração.
 *  2. O cliente da Graph API e a máquina de passos (`preparar`), com o `fetch`
 *     injetado para o teste nunca encostar na Meta.
 *
 * A API do Instagram NÃO agenda: ela publica na hora em que é chamada. Quem
 * segura até o horário é o nosso cron (ver `instagram.ts`, ação `run`).
 */

export type IgTipo = 'IMAGE' | 'REELS' | 'STORIES' | 'CAROUSEL'

export interface ArquivoCriativo {
  id: string
  name: string
  mimeType?: string
  /** Chave no R2 quando o arquivo foi anexado direto no painel (não é do Drive). */
  anexo?: string
}
export interface IgMidia { url: string; video: boolean; nome: string }
export interface IgPlano {
  tipo: IgTipo
  midias: IgMidia[]
  /** Perfis convidados para colab (até 3, sem @). Não vale para story. */
  colaboradores?: string[]
}

/** Teto do próprio Instagram para convites de colab num post. */
export const MAX_COLABORADORES = 3

/**
 * Normaliza os @ digitados: tira o @, espaços e repetidos. Devolve o motivo
 * quando algum não tem cara de usuário do Instagram — melhor barrar aqui do
 * que a Meta recusar o post inteiro na hora de publicar.
 */
export function normalizarColaboradores(lista: unknown): { ok: true; lista: string[] } | { ok: false; motivo: string } {
  if (lista == null) return { ok: true, lista: [] }
  if (!Array.isArray(lista)) return { ok: false, motivo: 'Colaboradores em formato inválido.' }
  const limpos = [...new Set(lista.map(x => String(x).trim().replace(/^@+/, '').toLowerCase()).filter(Boolean))]
  const ruim = limpos.find(u => !/^[a-z0-9._]{1,30}$/.test(u))
  if (ruim) return { ok: false, motivo: `"@${ruim}" não é um usuário válido do Instagram.` }
  if (limpos.length > MAX_COLABORADORES) return { ok: false, motivo: `O Instagram aceita até ${MAX_COLABORADORES} colaboradores por post.` }
  return { ok: true, lista: limpos }
}

export type PlanoResultado = { ok: true; plano: IgPlano } | { ok: false; motivo: string }

/** Teto do próprio Instagram para carrossel. */
export const MAX_CARROSSEL = 10

function ehVideo(f: ArquivoCriativo): boolean {
  if (f.mimeType) return f.mimeType.startsWith('video/')
  return /\.(mp4|mov|m4v)$/i.test(f.name)
}

/**
 * A integração só aceita imagem JPEG — PNG, WEBP e HEIC são recusados pela
 * Meta. Melhor barrar aqui, com o nome do arquivo, do que descobrir na hora de
 * publicar.
 */
function ehJpeg(f: ArquivoCriativo): boolean {
  if (f.mimeType) return f.mimeType === 'image/jpeg' || f.mimeType === 'image/jpg'
  return /\.jpe?g$/i.test(f.name)
}

function ehVideoAceito(f: ArquivoCriativo): boolean {
  if (f.mimeType) return f.mimeType === 'video/mp4' || f.mimeType === 'video/quicktime'
  return /\.(mp4|mov)$/i.test(f.name)
}

/**
 * O que publicar. `urlDe` monta a URL pública de cada arquivo (o Instagram
 * busca a mídia por conta própria, então ela precisa abrir sem login).
 */
export function planejar(
  tp: string,
  arquivos: ArquivoCriativo[],
  urlDe: (f: ArquivoCriativo, video: boolean) => string,
): PlanoResultado {
  if (arquivos.length === 0) return { ok: false, motivo: 'O card não tem criativo anexado.' }

  const midia = (f: ArquivoCriativo): IgMidia => ({ url: urlDe(f, ehVideo(f)), video: ehVideo(f), nome: f.name })
  const invalido = arquivos.find(f => (ehVideo(f) ? !ehVideoAceito(f) : !ehJpeg(f)))
  const motivoFormato = (f: ArquivoCriativo) => ehVideo(f)
    ? `"${f.name}" não é MP4 nem MOV — o Instagram recusa esse formato de vídeo.`
    : `"${f.name}" não é JPG — pela integração o Instagram só aceita imagem em JPG.`

  // Reel com vídeo sai como Reel. Reel em que o Social anexou só arte: quem manda
  // é o que foi anexado (pedido do dono) — cai no post/carrossel abaixo.
  const videoDoReel = tp === 'Reel' ? arquivos.find(ehVideo) : undefined
  if (videoDoReel) {
    if (!ehVideoAceito(videoDoReel)) return { ok: false, motivo: motivoFormato(videoDoReel) }
    return { ok: true, plano: { tipo: 'REELS', midias: [midia(videoDoReel)] } }
  }

  if (tp === 'Story') {
    const f = arquivos[0]
    if (ehVideo(f) ? !ehVideoAceito(f) : !ehJpeg(f)) return { ok: false, motivo: motivoFormato(f) }
    return { ok: true, plano: { tipo: 'STORIES', midias: [midia(f)] } }
  }

  // Post, Carrossel e Feed: uma peça vira post; várias viram carrossel.
  if (invalido) return { ok: false, motivo: motivoFormato(invalido) }
  if (arquivos.length === 1) {
    const f = arquivos[0]
    // Vídeo solto no feed é Reel — o Instagram não tem mais "post de vídeo".
    return { ok: true, plano: { tipo: ehVideo(f) ? 'REELS' : 'IMAGE', midias: [midia(f)] } }
  }
  if (arquivos.length > MAX_CARROSSEL) {
    return { ok: false, motivo: `A pasta tem ${arquivos.length} peças e o Instagram aceita até ${MAX_CARROSSEL} por carrossel.` }
  }
  return { ok: true, plano: { tipo: 'CAROUSEL', midias: arquivos.map(midia) } }
}

// ── Graph API ────────────────────────────────────────────────────────────

export interface Graph {
  /** Ex.: `https://graph.facebook.com/v23.0` — trocável para o simulador local. */
  base: string
  token: string
  fetchFn?: typeof fetch
}

type Resposta<T> = { ok: true; data: T } | { ok: false; erro: string; codigo?: number }

interface ErroMeta { message?: string; code?: number; error_user_msg?: string }

/** Mensagem da Meta traduzida para o que a equipe consegue resolver. */
export function traduzErro(e: ErroMeta | undefined): string {
  if (!e) return 'O Instagram não respondeu.'
  if (e.code === 190) return 'O acesso ao Instagram deste cliente venceu ou foi revogado — é preciso reconectar.'
  if (e.code === 10 || e.code === 200) return 'Falta permissão para publicar neste perfil — confira a conexão do cliente.'
  if (e.code === 4 || e.code === 17 || e.code === 32 || e.code === 613) return 'O Instagram limitou as chamadas agora — tente de novo em alguns minutos.'
  return e.error_user_msg || e.message || 'O Instagram recusou a publicação.'
}

export async function chamar<T>(g: Graph, method: 'GET' | 'POST', path: string, params: Record<string, string>): Promise<Resposta<T>> {
  const f = g.fetchFn ?? fetch
  // O token vai no cabeçalho, nunca na URL: URL aparece em log.
  const headers: Record<string, string> = { Authorization: `Bearer ${g.token}` }
  let url = `${g.base}${path}`
  let body: string | undefined
  if (method === 'GET') {
    const q = new URLSearchParams(params).toString()
    if (q) url += `?${q}`
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = new URLSearchParams(params).toString()
  }
  try {
    const res = await f(url, { method, headers, body })
    const data = await res.json().catch(() => null) as (T & { error?: ErroMeta }) | null
    if (!data) return { ok: false, erro: `O Instagram respondeu ${res.status} sem conteúdo.` }
    if (data.error) return { ok: false, erro: traduzErro(data.error), codigo: data.error.code }
    return { ok: true, data }
  } catch {
    return { ok: false, erro: 'Não deu para falar com o Instagram (rede).' }
  }
}

/** Confere o token e devolve o @ do perfil. */
export async function perfilDoToken(g: Graph, igUserId: string): Promise<Resposta<{ username?: string; name?: string }>> {
  return chamar(g, 'GET', `/${igUserId}`, { fields: 'username,name' })
}

function paramsDaMidia(tipo: IgTipo, m: IgMidia, legenda: string, filhoDeCarrossel: boolean, colaboradores: string[] = []): Record<string, string> {
  const p: Record<string, string> = {}
  if (filhoDeCarrossel) {
    p.is_carousel_item = 'true'
    if (m.video) { p.media_type = 'VIDEO'; p.video_url = m.url } else p.image_url = m.url
    return p
  }
  if (tipo === 'REELS') { p.media_type = 'REELS'; p.video_url = m.url; p.share_to_feed = 'true' }
  else if (tipo === 'STORIES') { p.media_type = 'STORIES'; if (m.video) p.video_url = m.url; else p.image_url = m.url }
  else p.image_url = m.url
  // Story não tem legenda.
  if (tipo !== 'STORIES' && legenda) p.caption = legenda
  if (tipo !== 'STORIES' && colaboradores.length) p.collaborators = JSON.stringify(colaboradores)
  return p
}

export type StatusContainer = 'FINISHED' | 'IN_PROGRESS' | 'ERROR' | 'EXPIRED' | 'PUBLISHED' | 'DESCONHECIDO'

export async function statusDoContainer(g: Graph, id: string): Promise<StatusContainer> {
  const r = await chamar<{ status_code?: string }>(g, 'GET', `/${id}`, { fields: 'status_code' })
  if (!r.ok) return 'DESCONHECIDO'
  const s = r.data.status_code
  return s === 'FINISHED' || s === 'IN_PROGRESS' || s === 'ERROR' || s === 'EXPIRED' || s === 'PUBLISHED' ? s : 'DESCONHECIDO'
}

/** O que já foi criado na Meta para este agendamento — guardado entre um tick e outro. */
export interface IgEstado {
  /** Containers das peças do carrossel, na ordem. Vazio fora de carrossel. */
  filhos: string[]
  /** O container que será publicado (a peça única, ou o pai do carrossel). */
  criacao: string | null
}

export const ESTADO_VAZIO: IgEstado = { filhos: [], criacao: null }

export type Passo =
  | { tipo: 'esperar'; estado: IgEstado }
  | { tipo: 'pronto'; estado: IgEstado }
  | { tipo: 'falhou'; erro: string; estado: IgEstado }

/**
 * Avança a preparação até onde der SEM publicar: cria os containers que faltam
 * e confere se a Meta terminou de processar. Devolve o estado novo para o
 * chamador gravar — assim um tick interrompido não recria o que já existe.
 */
export async function preparar(g: Graph, igUserId: string, plano: IgPlano, legenda: string, estado: IgEstado): Promise<Passo> {
  let atual: IgEstado = { filhos: [...estado.filhos], criacao: estado.criacao }

  if (!atual.criacao && plano.tipo !== 'CAROUSEL') {
    const r = await chamar<{ id?: string }>(g, 'POST', `/${igUserId}/media`, paramsDaMidia(plano.tipo, plano.midias[0], legenda, false, plano.colaboradores))
    if (!r.ok) return { tipo: 'falhou', erro: r.erro, estado: atual }
    if (!r.data.id) return { tipo: 'falhou', erro: 'O Instagram não devolveu o identificador da mídia.', estado: atual }
    atual = { ...atual, criacao: r.data.id }
  }

  if (!atual.criacao && plano.tipo === 'CAROUSEL') {
    // Uma peça por vez, gravando o progresso: se cair no meio, o próximo tick
    // continua da peça seguinte em vez de recriar o carrossel inteiro.
    for (let i = atual.filhos.length; i < plano.midias.length; i++) {
      const r = await chamar<{ id?: string }>(g, 'POST', `/${igUserId}/media`, paramsDaMidia('CAROUSEL', plano.midias[i], '', true))
      if (!r.ok) return { tipo: 'falhou', erro: `Peça ${i + 1} do carrossel: ${r.erro}`, estado: atual }
      if (!r.data.id) return { tipo: 'falhou', erro: `Peça ${i + 1} do carrossel: sem identificador.`, estado: atual }
      atual = { ...atual, filhos: [...atual.filhos, r.data.id] }
    }
    // Vídeo dentro do carrossel precisa terminar de processar antes do pai.
    for (let i = 0; i < atual.filhos.length; i++) {
      if (!plano.midias[i].video) continue
      const s = await statusDoContainer(g, atual.filhos[i])
      if (s === 'ERROR' || s === 'EXPIRED') return { tipo: 'falhou', erro: `O Instagram não conseguiu processar a peça ${i + 1} do carrossel.`, estado: atual }
      if (s !== 'FINISHED') return { tipo: 'esperar', estado: atual }
    }
    const params: Record<string, string> = { media_type: 'CAROUSEL', children: atual.filhos.join(',') }
    if (legenda) params.caption = legenda
    if (plano.colaboradores?.length) params.collaborators = JSON.stringify(plano.colaboradores)
    const pai = await chamar<{ id?: string }>(g, 'POST', `/${igUserId}/media`, params)
    if (!pai.ok) return { tipo: 'falhou', erro: `Carrossel: ${pai.erro}`, estado: atual }
    if (!pai.data.id) return { tipo: 'falhou', erro: 'Carrossel: sem identificador.', estado: atual }
    atual = { ...atual, criacao: pai.data.id }
  }

  const s = await statusDoContainer(g, atual.criacao!)
  if (s === 'FINISHED') return { tipo: 'pronto', estado: atual }
  if (s === 'ERROR') return { tipo: 'falhou', erro: 'O Instagram não conseguiu processar a mídia (formato, duração ou proporção fora do aceito).', estado: atual }
  if (s === 'EXPIRED') return { tipo: 'falhou', erro: 'A mídia ficou mais de 24h preparada e venceu no Instagram.', estado: atual }
  if (s === 'PUBLISHED') return { tipo: 'falhou', erro: 'Esta mídia já consta como publicada no Instagram — confira o perfil.', estado: atual }
  return { tipo: 'esperar', estado: atual }
}

/** Publica o container pronto. É o único passo que não tem volta. */
export async function publicar(g: Graph, igUserId: string, criacao: string): Promise<Resposta<{ id: string }>> {
  const r = await chamar<{ id?: string }>(g, 'POST', `/${igUserId}/media_publish`, { creation_id: criacao })
  if (!r.ok) return r
  if (!r.data.id) return { ok: false, erro: 'O Instagram não confirmou a publicação.' }
  return { ok: true, data: { id: r.data.id } }
}

/** Link do post publicado — enfeite: falhar aqui não desfaz a publicação. */
export async function permalinkDe(g: Graph, mediaId: string): Promise<string | null> {
  const r = await chamar<{ permalink?: string }>(g, 'GET', `/${mediaId}`, { fields: 'permalink' })
  return r.ok ? r.data.permalink ?? null : null
}
