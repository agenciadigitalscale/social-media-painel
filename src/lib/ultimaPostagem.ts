/* lib/ultimaPostagem.ts — a aba "Última postagem" (2026-10-20): o aviso para
   nenhum cliente ficar sem post.

   Para cada cliente: o último VÍDEO e a última FOTO que foram ao ar, e há quantos
   dias. UMA fonte por cliente (2026-10-22 — antes as duas se misturavam e um card
   "Publicado" com data de postagem no FUTURO passava por cima do real):
   - conta conectada e lida: só ela — o Instagram (ou a Página do Facebook, para
     quem não tem Instagram), pela /api/instagram ?action=ultimas;
   - sem conta: o último card em Publicado (7), pela data em que saiu — nunca futura.
   E a próxima postagem planejada, para ver se o buraco já está coberto. */
import type { ContentItem, ContentType, ItemState } from '../types'
import { postagemDoCard } from './programacao'
import { lerResposta } from './respostaApi'

export type Fonte = 'instagram' | 'facebook' | 'painel'
export type NivelAviso = 'ok' | 'atencao' | 'atrasado' | 'nunca'

export interface Postagem {
  quando: number
  fonte: Fonte
  link: string | null
  capa: string | null
  /** Título do card (fonte painel). */
  titulo?: string
  formato?: string
}

export interface UltimasDoCliente {
  video: Postagem | null
  foto: Postagem | null
}

/** Vídeo = Reel (Story some em 24h e não conta). Foto = post, arte, feed, carrossel. */
const ehVideo = (tp: ContentType) => tp === 'Reel'
const ehFoto = (tp: ContentType) => tp === 'Post' || tp === 'Feed' || tp === 'Carrossel'

/**
 * Último vídeo e última foto PUBLICADOS no painel para o cliente. Data = quando
 * foi marcado publicado; sem ela, a data de postagem — e nunca no futuro (card
 * marcado "Publicado" com a pauta lá na frente não diz quando saiu).
 */
export function ultimasDoPainel(items: readonly ContentItem[], states: Record<number, ItemState>, cliente: string, agora: number = Date.now()): UltimasDoCliente {
  let video: Postagem | null = null
  let foto: Postagem | null = null
  for (const it of items) {
    if (it.c !== cliente) continue
    const st = states[it.i]
    if ((st?.status ?? it.s) !== 7) continue
    const quando = st?.publishedAt ?? postagemDoCard(it, st).quando.getTime()
    if (quando > agora) continue
    const p: Postagem = { quando, fonte: 'painel', link: st?.igPermalink || st?.fbPermalink || null, capa: st?.anexos?.[0]?.url ?? null, titulo: st?.title || it.n }
    if (ehVideo(it.tp) && (!video || quando > video.quando)) video = p
    if (ehFoto(it.tp) && (!foto || quando > foto.quando)) foto = p
  }
  return { video, foto }
}

/**
 * A fonte do cliente: a conta conectada (lida sem erro) manda; sem ela, o painel.
 * Se a conta não tem NENHUM post de um tipo, esse tipo vem do painel — caso
 * Genitex: a Página do Facebook só recebe foto, os vídeos saem no Instagram (que
 * não está ligado), e "vídeo: nunca" seria falso.
 */
export function ultimasDoCliente(painel: UltimasDoCliente, conta?: UltimasIG): UltimasDoCliente {
  if (!conta || conta.erro) return painel
  const c = ultimasDoIG(conta)
  return { video: c.video ?? painel.video, foto: c.foto ?? painel.foto }
}

export function diasDesde(quando: number, agora: number): number {
  const d0 = new Date(quando); d0.setHours(0, 0, 0, 0)
  const d1 = new Date(agora); d1.setHours(0, 0, 0, 0)
  return Math.round((d1.getTime() - d0.getTime()) / 86_400_000)
}

/** Até 7 dias em dia; 8 a 14 atenção; mais de 14 (ou nunca) atrasado. */
export function nivelDoAviso(p: Postagem | null, agora: number): NivelAviso {
  if (!p) return 'nunca'
  const d = diasDesde(p.quando, agora)
  return d <= 7 ? 'ok' : d <= 14 ? 'atencao' : 'atrasado'
}

const PESO: Record<NivelAviso, number> = { nunca: 3, atrasado: 2, atencao: 1, ok: 0 }

/** O pior dos dois tipos — é ele que manda na ordem da lista. */
export function piorNivel(u: UltimasDoCliente, agora: number): NivelAviso {
  const a = nivelDoAviso(u.video, agora), b = nivelDoAviso(u.foto, agora)
  return PESO[a] >= PESO[b] ? a : b
}

export interface Proxima { quando: number; tp: ContentType; titulo: string; status: number }

/** A próxima postagem planejada do cliente (de hoje em diante, ainda não publicada). */
export function proximaDoCliente(items: readonly ContentItem[], states: Record<number, ItemState>, cliente: string, agora: number): Proxima | null {
  const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0)
  let melhor: Proxima | null = null
  for (const it of items) {
    if (it.c !== cliente) continue
    const st = states[it.i]
    const status = st?.status ?? it.s
    if (status === 7) continue
    const q = postagemDoCard(it, st).quando.getTime()
    if (q < hoje.getTime()) continue
    if (!melhor || q < melhor.quando) melhor = { quando: q, tp: it.tp, titulo: st?.title || it.n, status }
  }
  return melhor
}

/** Ordem da aba: o mais urgente primeiro (pior aviso, depois o mais tempo sem postar). */
export function ordenarPorUrgencia<T extends { ultimas: UltimasDoCliente; nome: string }>(lista: T[], agora: number): T[] {
  const maisVelha = (u: UltimasDoCliente) => Math.min(u.video?.quando ?? 0, u.foto?.quando ?? 0)
  return [...lista].sort((a, b) =>
    PESO[piorNivel(b.ultimas, agora)] - PESO[piorNivel(a.ultimas, agora)]
    || maisVelha(a.ultimas) - maisVelha(b.ultimas)
    || a.nome.localeCompare(b.nome))
}

// ── Instagram (fonte real) ───────────────────────────────────────────────

interface PostagemIG { quando: string; link: string | null; capa: string | null; formato: string }
export interface UltimasIG { clientName: string; perfil: string; fonte?: 'instagram' | 'facebook'; erro?: string; video?: PostagemIG | null; foto?: PostagemIG | null }

export function ultimasDoIG(c: UltimasIG): UltimasDoCliente {
  const fonte: Fonte = c.fonte === 'facebook' ? 'facebook' : 'instagram'
  const da = (p?: PostagemIG | null): Postagem | null => p ? { quando: Date.parse(p.quando), fonte, link: p.link, capa: p.capa, formato: p.formato } : null
  return { video: da(c.video), foto: da(c.foto) }
}

/** Busca no servidor a última postagem real de cada perfil conectado (só leitura). */
export async function buscarUltimasIG(): Promise<{ ok: boolean; contas: UltimasIG[]; error?: string }> {
  try {
    const d = await lerResposta<{ contas?: UltimasIG[] }>(await fetch('/api/instagram?action=ultimas'))
    return { ok: d.ok, contas: d.contas ?? [], error: d.error }
  } catch {
    return { ok: false, contas: [], error: 'Sem conexão com o servidor.' }
  }
}
