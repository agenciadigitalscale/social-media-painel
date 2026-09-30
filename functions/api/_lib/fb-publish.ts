/**
 * Publicação na Página do Facebook do cliente — o par do `ig-publish.ts`.
 *
 * Diferente do Instagram, a Página publica numa chamada só (não há container
 * para preparar), então tudo acontece no horário: foto, várias fotos num post,
 * ou vídeo. Story de Página não sai pela API — o plano diz isso em vez de
 * fingir que vai publicar.
 */
import { chamar, type ArquivoCriativo, type Graph } from './ig-publish'

export type FbTipo = 'FOTO' | 'FOTOS' | 'VIDEO'
export interface FbMidia { url: string; video: boolean; nome: string }
export interface FbPlano { tipo: FbTipo; midias: FbMidia[] }
export type FbPlanoResultado = { ok: true; plano: FbPlano } | { ok: false; motivo: string }

/** Teto prático de fotos num post de Página. */
export const MAX_FOTOS_FB = 10

function ehVideo(f: ArquivoCriativo): boolean {
  if (f.mimeType) return f.mimeType.startsWith('video/')
  return /\.(mp4|mov|m4v)$/i.test(f.name)
}

/** O Facebook aceita JPG e PNG (ao contrário da integração do Instagram). */
function imagemAceita(f: ArquivoCriativo): boolean {
  if (f.mimeType) return ['image/jpeg', 'image/jpg', 'image/png'].includes(f.mimeType)
  return /\.(jpe?g|png)$/i.test(f.name)
}

export function planejarFacebook(
  tp: string,
  arquivos: ArquivoCriativo[],
  urlDe: (f: ArquivoCriativo, video: boolean) => string,
): FbPlanoResultado {
  if (arquivos.length === 0) return { ok: false, motivo: 'O card não tem criativo anexado.' }
  if (tp === 'Story') return { ok: false, motivo: 'Story de Página do Facebook não pode ser publicado pela integração — publique pelo app.' }
  const midia = (f: ArquivoCriativo): FbMidia => ({ url: urlDe(f, ehVideo(f)), video: ehVideo(f), nome: f.name })

  const videos = arquivos.filter(ehVideo)
  if (tp === 'Reel' || (arquivos.length === 1 && videos.length === 1)) {
    if (videos.length === 0) return { ok: false, motivo: 'O criativo do card não é um vídeo.' }
    return { ok: true, plano: { tipo: 'VIDEO', midias: [midia(videos[0])] } }
  }
  if (videos.length > 0) return { ok: false, motivo: 'O Facebook não aceita vídeo misturado com fotos num mesmo post.' }
  const ruim = arquivos.find(f => !imagemAceita(f))
  if (ruim) return { ok: false, motivo: `"${ruim.name}" não é JPG nem PNG.` }
  if (arquivos.length > MAX_FOTOS_FB) return { ok: false, motivo: `A pasta tem ${arquivos.length} peças; o post da Página aceita até ${MAX_FOTOS_FB}.` }
  return { ok: true, plano: { tipo: arquivos.length === 1 ? 'FOTO' : 'FOTOS', midias: arquivos.map(midia) } }
}

export interface ContaEncontrada {
  pageId: string
  pageName: string
  igUserId: string | null
  igUsername: string | null
}

/**
 * Todas as Páginas (e o Instagram ligado a cada uma) que o token enxerga — é o
 * que dispensa a pessoa de caçar ID por ID no Gerenciador de Negócios. O token
 * das Páginas NÃO sai daqui: quem conecta pega de novo, no servidor.
 */
export async function contasDoToken(g: Graph): Promise<{ ok: true; contas: ContaEncontrada[] } | { ok: false; erro: string }> {
  const contas: ContaEncontrada[] = []
  let depois = ''
  for (let pagina = 0; pagina < 10; pagina++) {
    const params: Record<string, string> = { fields: 'id,name,instagram_business_account{id,username}', limit: '100' }
    if (depois) params.after = depois
    const r = await chamar<{
      data?: { id: string; name?: string; instagram_business_account?: { id: string; username?: string } }[]
      paging?: { cursors?: { after?: string }; next?: string }
    }>(g, 'GET', '/me/accounts', params)
    if (!r.ok) return { ok: false, erro: r.erro }
    for (const p of r.data.data ?? []) {
      contas.push({
        pageId: p.id, pageName: p.name ?? '',
        igUserId: p.instagram_business_account?.id ?? null,
        igUsername: p.instagram_business_account?.username ?? null,
      })
    }
    depois = r.data.paging?.next ? (r.data.paging.cursors?.after ?? '') : ''
    if (!depois) break
  }
  return { ok: true, contas }
}

/** Nome da Página e o token DELA — a Página publica com o próprio token. */
export async function paginaDoToken(g: Graph, pageId: string) {
  return chamar<{ name?: string; access_token?: string }>(g, 'GET', `/${pageId}`, { fields: 'name,access_token' })
}

/**
 * Publica o post inteiro. Devolve o id do post. Várias fotos: cada uma sobe
 * como não publicada e o post junta todas — assim sai UM post, não dez.
 */
export async function publicarNaPagina(g: Graph, pageId: string, plano: FbPlano, legenda: string): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  if (plano.tipo === 'VIDEO') {
    const r = await chamar<{ id?: string }>(g, 'POST', `/${pageId}/videos`, { file_url: plano.midias[0].url, description: legenda })
    if (!r.ok) return { ok: false, erro: r.erro }
    return r.data.id ? { ok: true, id: r.data.id } : { ok: false, erro: 'O Facebook não confirmou o vídeo.' }
  }
  if (plano.tipo === 'FOTO') {
    const r = await chamar<{ id?: string; post_id?: string }>(g, 'POST', `/${pageId}/photos`, { url: plano.midias[0].url, message: legenda, published: 'true' })
    if (!r.ok) return { ok: false, erro: r.erro }
    const id = r.data.post_id ?? r.data.id
    return id ? { ok: true, id } : { ok: false, erro: 'O Facebook não confirmou a foto.' }
  }
  const ids: string[] = []
  for (let i = 0; i < plano.midias.length; i++) {
    const r = await chamar<{ id?: string }>(g, 'POST', `/${pageId}/photos`, { url: plano.midias[i].url, published: 'false' })
    if (!r.ok) return { ok: false, erro: `Foto ${i + 1}: ${r.erro}` }
    if (!r.data.id) return { ok: false, erro: `Foto ${i + 1}: sem identificador.` }
    ids.push(r.data.id)
  }
  const params: Record<string, string> = { message: legenda }
  ids.forEach((id, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }) })
  const post = await chamar<{ id?: string }>(g, 'POST', `/${pageId}/feed`, params)
  if (!post.ok) return { ok: false, erro: post.erro }
  return post.data.id ? { ok: true, id: post.data.id } : { ok: false, erro: 'O Facebook não confirmou o post.' }
}

export async function permalinkFacebook(g: Graph, postId: string): Promise<string | null> {
  const r = await chamar<{ permalink_url?: string }>(g, 'GET', `/${postId}`, { fields: 'permalink_url' })
  return r.ok ? r.data.permalink_url ?? null : null
}
