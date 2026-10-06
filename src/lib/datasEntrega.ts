/* lib/datasEntrega.ts — a fila inteligente de entrega da produção (2026-10-05).

   A DATA DE PUBLICAÇÃO é a prioridade: publicação mais próxima = entrega mais
   cedo. Não existe mais "entrega = publicação − 12 dias" — a fila começa hoje e
   enche cada dia útil até a CAPACIDADE da frente (vídeo e design têm a sua).

   Exemplo (capacidade 10): publicações do dia 1 (4), dia 2 (5) e dia 3 (3) →
   o primeiro dia de entrega leva os 4 do dia 1, os 5 do dia 2 e 1 do dia 3; os
   outros 2 do dia 3 vão para o próximo dia útil.

   Regras da agência:
   - Só entra na fila o que ainda está sendo PRODUZIDO (A fazer, Produção,
     Ajuste). Entregue, aprovado, programado ou publicado não ocupa vaga e não é
     mexido — etapa final não volta para a fila.
   - Programar um conteúdo NÃO repõe a vaga: se 3 de 10 viram Programados, ficam
     7 naquele dia e ninguém é puxado para o lugar deles (dá para ver que a
     produção está adiantada). Por isso o automático (conteúdo novo, data de
     publicação mudada) só EMPURRA em cascata o necessário; só o botão
     "Reordenar datas" refaz a fila inteira a partir de hoje.
   - Nunca mexe na data de PUBLICAÇÃO — só na de entrega. */
import type { ContentItem, ContentType, ItemState, Status } from '../types'
import { syncToCloud } from './storage'
import { EVENTO_PADRAO } from './padraoEditorial'

const DIA_MS = 86_400_000

/** Etapas que ainda dependem de quem produz — as únicas que a fila organiza. */
export const STATUS_NA_FILA: readonly Status[] = [0, 1, 6]

/** Frente de produção: vídeo (editor) ou design (designers). Cada uma tem capacidade própria. */
export type Frente = 'video' | 'design'
export const frenteDo = (tp: ContentType): Frente => (tp === 'Reel' || tp === 'Story' ? 'video' : 'design')
export const ROTULO_FRENTE: Record<Frente, string> = { video: 'Vídeos', design: 'Designs' }

export interface Capacidade { video: number; design: number }
export const CAPACIDADE_PADRAO: Capacidade = { video: 10, design: 6 }

const inicioDoDia = (ms: number) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime() }
const ehFimDeSemana = (ms: number) => { const w = new Date(ms).getDay(); return w === 0 || w === 6 }

export interface EntregaNova { id: number; entrega: number; antes?: number }

/**
 * A fila encaixada na capacidade. Devolve só os conteúdos cuja entrega mudou.
 *
 * `modo: 'completo'` — o botão "Reordenar datas": todos recomeçam de hoje.
 * `modo: 'empurrar'` — automático: ninguém vai para antes da entrega que já tem;
 *  quem não cabe é empurrado em cascata. `recolocar` são os que acabaram de
 *  entrar ou mudaram de publicação — esses disputam a vaga desde hoje.
 */
export function reordenarEntregas(opts: {
  itens: ContentItem[]
  states: Record<number, ItemState>
  capacidade: Capacidade
  hoje: Date
  modo: 'completo' | 'empurrar'
  recolocar?: ReadonlySet<number>
  /** Sábado e domingo não recebem entrega (padrão: true). */
  soDiasUteis?: boolean
}): EntregaNova[] {
  const { itens, states, hoje, modo } = opts
  const recolocar = opts.recolocar ?? new Set<number>()
  const cap = (f: Frente) => Math.max(1, Math.floor(opts.capacidade[f]) || 1)
  const soUteis = opts.soDiasUteis ?? true
  const proximoUtil = (ms: number) => { let d = ms; while (soUteis && ehFimDeSemana(d)) d = inicioDoDia(d + DIA_MS); return d }
  const hojeMs = proximoUtil(inicioDoDia(hoje.getTime()))

  const prioridade = (st?: ItemState) => (st?.priority === 'alta' ? 0 : st?.priority === 'media' ? 1 : st?.priority === 'baixa' ? 3 : 2)
  const fila = itens
    .filter(it => STATUS_NA_FILA.includes((states[it.i]?.status ?? it.s) as Status))
    // Automático não DÁ entrega a card antigo que nunca teve: seria uma gravação
    // em massa na fila do time sem ninguém pedir. Só os recolocados entram.
    .filter(it => modo === 'completo' || !!states[it.i]?.deliveryDate || recolocar.has(it.i))
    .sort((a, b) => a.dt.getTime() - b.dt.getTime() || prioridade(states[a.i]) - prioridade(states[b.i]) || a.i - b.i)

  const ocupacao = new Map<string, number>()
  const out: EntregaNova[] = []
  for (const it of fila) {
    const st = states[it.i]
    const atual = st?.deliveryDate ? inicioDoDia(st.deliveryDate) : undefined
    const livre = modo === 'completo' || recolocar.has(it.i)
    // Atrasado (entrega já passou) no automático: fica onde está — o atraso aparece
    // no painel em vez de sumir — e não disputa vaga com quem está em dia.
    if (!livre && atual !== undefined && atual < inicioDoDia(hoje.getTime())) continue
    const f = frenteDo(it.tp)
    let dia = livre || atual === undefined ? hojeMs : proximoUtil(Math.max(atual, hojeMs))
    while ((ocupacao.get(`${f}:${dia}`) ?? 0) >= cap(f)) dia = proximoUtil(inicioDoDia(dia + DIA_MS))
    ocupacao.set(`${f}:${dia}`, (ocupacao.get(`${f}:${dia}`) ?? 0) + 1)
    if (atual !== dia) out.push({ id: it.i, entrega: dia, antes: st?.deliveryDate })
  }
  return out
}

/** Quantos conteúdos da fila caem em cada dia, por frente — a carga na tela. */
export function cargaPorDia(itens: ContentItem[], states: Record<number, ItemState>): Map<string, Capacidade> {
  const m = new Map<string, Capacidade>()
  for (const it of itens) {
    const st = states[it.i]
    if (!STATUS_NA_FILA.includes((st?.status ?? it.s) as Status) || !st?.deliveryDate) continue
    const d = new Date(st.deliveryDate)
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const atual = m.get(k) ?? { video: 0, design: 0 }
    atual[frenteDo(it.tp)]++
    m.set(k, atual)
  }
  return m
}

// ── Capacidade diária (configurável, sincronizada) ──────────────────────

export const CAPACIDADE_KEY = 'sm_capacidade_entrega'

/** Aceita o formato antigo (um número só, para o time todo) — vira o mesmo número nas duas frentes. */
export function lerCapacidade(bruto: unknown): Capacidade {
  if (typeof bruto === 'number' && Number.isFinite(bruto) && bruto >= 1) return { video: Math.floor(bruto), design: Math.floor(bruto) }
  if (bruto && typeof bruto === 'object') {
    const o = bruto as Partial<Capacidade>
    const ok = (n: unknown, padrao: number) => (typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.floor(n) : padrao)
    return { video: ok(o.video, CAPACIDADE_PADRAO.video), design: ok(o.design, CAPACIDADE_PADRAO.design) }
  }
  return { ...CAPACIDADE_PADRAO }
}

export function carregarCapacidade(): Capacidade {
  try { return lerCapacidade(JSON.parse(localStorage.getItem(CAPACIDADE_KEY) ?? 'null')) } catch { return { ...CAPACIDADE_PADRAO } }
}

export function salvarCapacidade(c: Capacidade): void {
  const v = lerCapacidade(c)
  try { localStorage.setItem(CAPACIDADE_KEY, JSON.stringify(v)) } catch { /* sem armazenamento */ }
  syncToCloud(CAPACIDADE_KEY, v)
  window.dispatchEvent(new Event(EVENTO_PADRAO))
}
