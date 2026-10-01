/* lib/datasEntrega.ts — data de entrega automática e a fila de produção (2026-10-01).

   Regra padrão: ENTREGA = PUBLICAÇÃO − 12 dias corridos. É o prazo para quem
   produz (editor/designer) — a publicação é do Social.

   "Reordenar datas" encaixa a fila numa CAPACIDADE DIÁRIA (ex.: 10 por dia):
   cada conteúdo ainda em produção vai para o dia ideal (publicação − 12) e, se o
   dia já está cheio, para o próximo dia útil com vaga. Duas regras da agência:

   - Só entra na fila o que ainda está sendo PRODUZIDO (A fazer, Produção,
     Ajuste). O que já foi entregue, aprovado, programado ou publicado não ocupa
     vaga e não é mexido — etapa final não é substituída pela fila.
   - Programar um conteúdo NÃO puxa outro para o lugar dele. Por isso a
     reorganização automática (quando entra conteúdo novo) só EMPURRA para frente:
     ninguém volta para antes da entrega que já tinha. Só o botão "Reordenar
     datas" refaz a fila inteira a partir do dia ideal. */
import type { ContentItem, ItemState, Status } from '../types'
import { syncToCloud } from './storage'
import { EVENTO_PADRAO } from './padraoEditorial'

export const DIAS_ANTES_DA_POSTAGEM = 12
const DIA_MS = 86_400_000

/** Etapas que ainda dependem de quem produz — as únicas que a fila organiza. */
export const STATUS_NA_FILA: readonly Status[] = [0, 1, 6]

const inicioDoDia = (ms: number) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime() }
const ehFimDeSemana = (ms: number) => { const w = new Date(ms).getDay(); return w === 0 || w === 6 }

/** Entrega padrão: publicação − 12 dias corridos, ao meio-dia (evita virar o dia no fuso). */
export function entregaPadrao(publicacao: Date): number {
  return inicioDoDia(publicacao.getTime() - DIAS_ANTES_DA_POSTAGEM * DIA_MS)
}

/**
 * Entrega de quem ACABOU de entrar na fila (card novo ou data mudada): a padrão,
 * mas nunca no passado nem no fim de semana — publicação daqui a 9 dias não pode
 * nascer com entrega para 3 dias atrás. A capacidade é encaixada depois, pela fila.
 */
export function entregaInicial(publicacao: Date, hoje: Date): number {
  let d = Math.max(entregaPadrao(publicacao), inicioDoDia(hoje.getTime()))
  while (ehFimDeSemana(d)) d = inicioDoDia(d + DIA_MS)
  return d
}

export interface EntregaNova { id: number; entrega: number; antes?: number }

/**
 * A fila encaixada na capacidade. Devolve só os conteúdos cuja entrega mudou.
 *
 * `modo: 'completo'` — o botão: todos partem do dia ideal.
 * `modo: 'empurrar'` — automático, quando entra conteúdo novo: ninguém vai para
 *  antes da entrega que já tem; só o necessário é empurrado para frente.
 */
export function reordenarEntregas(opts: {
  itens: ContentItem[]
  states: Record<number, ItemState>
  capacidade: number
  hoje: Date
  modo: 'completo' | 'empurrar'
  /** Sábado e domingo não recebem entrega (padrão: true). */
  soDiasUteis?: boolean
}): EntregaNova[] {
  const { itens, states, hoje, modo } = opts
  const capacidade = Math.max(1, Math.floor(opts.capacidade) || 1)
  const soUteis = opts.soDiasUteis ?? true
  const hojeMs = inicioDoDia(hoje.getTime())
  const proximoUtil = (ms: number) => { let d = ms; while (soUteis && ehFimDeSemana(d)) d = inicioDoDia(d + DIA_MS); return d }

  const prioridade = (st?: ItemState) => (st?.priority === 'alta' ? 0 : st?.priority === 'media' ? 1 : st?.priority === 'baixa' ? 3 : 2)
  const fila = itens
    .filter(it => STATUS_NA_FILA.includes((states[it.i]?.status ?? it.s) as Status))
    // Automático não DÁ entrega a quem não tem: isso seria uma gravação em massa
    // na fila do time sem ninguém pedir. Card novo já nasce com a dele.
    .filter(it => modo === 'completo' || !!states[it.i]?.deliveryDate)
    .map(it => {
      const st = states[it.i]
      const ideal = Math.max(hojeMs, entregaPadrao(it.dt))
      const atual = st?.deliveryDate ? inicioDoDia(st.deliveryDate) : undefined
      // Automático: quem já tem entrega fica nela (mesmo atrasada) e só sai se o
      // dia lotar. O botão recomeça todos do dia ideal.
      const inicio = modo === 'empurrar' && atual !== undefined ? atual : proximoUtil(ideal)
      return { it, st, inicio, atual }
    })
    .sort((a, b) => a.inicio - b.inicio || prioridade(a.st) - prioridade(b.st)
      || a.it.dt.getTime() - b.it.dt.getTime() || a.it.i - b.it.i)

  const ocupacao = new Map<number, number>()
  const out: EntregaNova[] = []
  for (const f of fila) {
    let dia = f.inicio
    // Dia passado não tem "vaga" a disputar: fica onde está (o atraso aparece no painel).
    if (dia >= hojeMs) while ((ocupacao.get(dia) ?? 0) >= capacidade) dia = proximoUtil(inicioDoDia(dia + DIA_MS))
    ocupacao.set(dia, (ocupacao.get(dia) ?? 0) + 1)
    if (f.atual !== dia) out.push({ id: f.it.i, entrega: dia, antes: f.st?.deliveryDate })
  }
  return out
}

/** Quantos conteúdos da fila caem em cada dia — para mostrar a carga na tela. */
export function cargaPorDia(itens: ContentItem[], states: Record<number, ItemState>): Map<string, number> {
  const m = new Map<string, number>()
  for (const it of itens) {
    const st = states[it.i]
    if (!STATUS_NA_FILA.includes((st?.status ?? it.s) as Status) || !st?.deliveryDate) continue
    const d = new Date(st.deliveryDate)
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

// ── Capacidade diária (configurável, sincronizada) ──────────────────────

export const CAPACIDADE_KEY = 'sm_capacidade_entrega'
export const CAPACIDADE_PADRAO = 10

export function carregarCapacidade(): number {
  try {
    const n = Number(JSON.parse(localStorage.getItem(CAPACIDADE_KEY) ?? 'null'))
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : CAPACIDADE_PADRAO
  } catch { return CAPACIDADE_PADRAO }
}

export function salvarCapacidade(n: number): void {
  const v = Math.max(1, Math.floor(n) || CAPACIDADE_PADRAO)
  try { localStorage.setItem(CAPACIDADE_KEY, JSON.stringify(v)) } catch { /* sem armazenamento */ }
  syncToCloud(CAPACIDADE_KEY, v)
  window.dispatchEvent(new Event(EVENTO_PADRAO))
}
