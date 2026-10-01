/* lib/padraoEditorial.ts — o Padrão Editorial de cada cliente (2026-09-29).

   Padrão Editorial → cria a base do mês → o sistema distribui → a pessoa edita tudo.

   O padrão é BASE, não trava: diz em que dias da semana cada tipo costuma sair
   (ex.: Reel às quartas, Post às sextas) e quantos o plano pede no mês. O
   calendário continua aceitando qualquer conteúdo em qualquer dia — o que foge do
   padrão é só uma exceção daquele mês, e nada aqui a impede.

   Tudo o que decide datas é função pura (testada em __tests__/padraoEditorial);
   quem cria/apaga cards é o App, pelo mesmo caminho do resto do painel. */
import type { Client, ContentItem, ContentType, ItemState } from '../types'
import { syncToCloud } from './storage'

/** Os três tipos que o padrão organiza. Post = arte do Design; Feed = foto da empresa. */
export type TipoPadrao = 'Reel' | 'Post' | 'Feed'
export const TIPOS_PADRAO: TipoPadrao[] = ['Reel', 'Post', 'Feed']
export const ROTULO_TIPO: Record<TipoPadrao, string> = { Reel: 'Reel', Post: 'Post Design', Feed: 'Post Feed' }

/** A que tipo do padrão um card pertence (Carrossel conta como Post Design; Story fica fora). */
export function tipoDoPadrao(tp: ContentType): TipoPadrao | null {
  if (tp === 'Reel') return 'Reel'
  if (tp === 'Post' || tp === 'Carrossel') return 'Post'
  if (tp === 'Feed') return 'Feed'
  return null
}

/** Planos de conteúdo da agência: quantos Reels + quantos Posts por mês. */
export type PlanoEditorial = '4+4' | '6+6' | '8+8' | 'livre'

/**
 * O que cada plano pede. No 6+6 o mês alterna SEMANA FORTE (2 dias de cada) e
 * SEMANA FRACA (1 dia de cada), começando pela forte — 2+1+2+1 = 6.
 */
export const PLANOS: Record<Exclude<PlanoEditorial, 'livre'>, { meta: number; forte: number; fraca: number }> = {
  '4+4': { meta: 4, forte: 1, fraca: 1 },
  '6+6': { meta: 6, forte: 2, fraca: 1 },
  '8+8': { meta: 8, forte: 2, fraca: 2 },
}

export interface PadraoCliente {
  /** Dias da semana preferidos por tipo (0 = domingo … 6 = sábado). No 6+6, os da semana FORTE. */
  dias: Record<TipoPadrao, number[]>
  /** Meta do mês por tipo. Ausente = vem do plano do cliente (Reel/Post) ou 0 (Feed). */
  meta?: Partial<Record<TipoPadrao, number>>
  /** Plano do cliente. Só o 6+6 muda a distribuição (semanas forte/fraca). */
  plano?: PlanoEditorial
  /** 6+6: dias da semana FRACA, por tipo. Ausente = o primeiro dia da semana forte. */
  diasFraca?: Partial<Record<TipoPadrao, number[]>>
}
export type PadroesStore = Record<string, PadraoCliente>

export const PADRAO_KEY = 'sm_padrao_editorial'
export const EVENTO_PADRAO = 'ds:padraoEditorial'

export const PADRAO_VAZIO: PadraoCliente = { dias: { Reel: [], Post: [], Feed: [] } }

export function carregarPadroes(): PadroesStore {
  try {
    const raw = JSON.parse(localStorage.getItem(PADRAO_KEY) ?? '{}') as PadroesStore
    return raw && typeof raw === 'object' ? raw : {}
  } catch { return {} }
}

export function salvarPadroes(store: PadroesStore): void {
  try { localStorage.setItem(PADRAO_KEY, JSON.stringify(store)) } catch { /* sem armazenamento */ }
  syncToCloud(PADRAO_KEY, store)
  window.dispatchEvent(new Event(EVENTO_PADRAO))
}

export function padraoDo(store: PadroesStore, cliente: string): PadraoCliente {
  const p = store[cliente]
  return p ? { dias: { ...PADRAO_VAZIO.dias, ...p.dias }, meta: p.meta, plano: p.plano, diasFraca: p.diasFraca } : PADRAO_VAZIO
}

/** Meta do mês: o que o padrão fixar; senão o plano do cliente (ex.: 4+4). */
export function metaDoMes(padrao: PadraoCliente, cliente: Pick<Client, 'postsPerMonth' | 'reelsPerMonth'> | undefined): Record<TipoPadrao, number> {
  return {
    Reel: padrao.meta?.Reel ?? cliente?.reelsPerMonth ?? 0,
    Post: padrao.meta?.Post ?? cliente?.postsPerMonth ?? 0,
    Feed: padrao.meta?.Feed ?? 0,
  }
}

// ── Datas ──────────────────────────────────────────────────────────────
const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

function diasDoMes(ano: number, mes: number): Date[] {
  const n = new Date(ano, mes + 1, 0).getDate()
  return Array.from({ length: n }, (_, i) => new Date(ano, mes, i + 1, 12))
}

/**
 * Semana do mês de uma data, contando como a grade do calendário (domingo a
 * sábado): a semana do dia 1 é a 0. No 6+6 as pares são fortes e as ímpares fracas.
 */
export function semanaDoMes(d: Date): number {
  const primeiro = new Date(d.getFullYear(), d.getMonth(), 1).getDay()
  return Math.floor((d.getDate() - 1 + primeiro) / 7)
}

/** Dias da semana que valem para um tipo numa data — forte ou fraca no 6+6. */
export function diasDaSemana(padrao: PadraoCliente, tipo: TipoPadrao, d: Date): number[] {
  const fortes = padrao.dias[tipo] ?? []
  if (padrao.plano !== '6+6' || semanaDoMes(d) % 2 === 0) return fortes
  const fracos = padrao.diasFraca?.[tipo]
  return fracos?.length ? fracos : fortes.slice(0, 1)
}

/**
 * TODOS os dias do mês em que o tipo pode sair pelo padrão — é a preferência que
 * diz ONDE o tipo vai, e a distribuição olha o mês inteiro, não as primeiras datas.
 */
export function diasPreferidosNoMes(padrao: PadraoCliente, tipo: TipoPadrao, ano: number, mes: number): Date[] {
  return diasDoMes(ano, mes).filter(d => diasDaSemana(padrao, tipo, d).includes(d.getDay()))
}

/** Os conteúdos de um cliente num mês. */
export function doClienteNoMes(items: ContentItem[], cliente: string, ano: number, mes: number): ContentItem[] {
  return items.filter(i => i.c === cliente && i.dt.getFullYear() === ano && i.dt.getMonth() === mes)
}

export interface Planejado { tipo: TipoPadrao; data: Date }

/**
 * O que falta para bater a meta do mês, já com data — a "Distribuição".
 *
 * Para cada tipo: quantos faltam = meta − o que o cliente já tem naquele mês.
 * As datas saem dos dias preferidos do padrão (sem padrão: segunda a sexta),
 * espalhadas pelo mês, evitando dia em que o cliente já tem o mesmo tipo. Num
 * mês em curso, prefere de hoje em diante — distribuir no passado criaria card
 * nascendo atrasado; só volta ao passado se não houver dia suficiente à frente.
 */
export function planejarDistribuicao(opts: {
  ano: number
  mes: number
  padrao: PadraoCliente
  meta: Record<TipoPadrao, number>
  existentes: Pick<ContentItem, 'tp' | 'dt'>[]
  hoje: Date
  /** Só estes tipos (a tela deixa marcar Reel / Feed / Post). Ausente = os três. */
  tipos?: TipoPadrao[]
  /** Quantos criar de cada tipo, ignorando a meta — quando a pessoa informa os conteúdos. */
  quantidade?: Partial<Record<TipoPadrao, number>>
}): Planejado[] {
  const { ano, mes, padrao, meta, existentes, hoje, tipos, quantidade } = opts
  const todos = diasDoMes(ano, mes)
  const hojeMs = inicioDoDia(hoje)
  const out: Planejado[] = []

  for (const tipo of TIPOS_PADRAO) {
    if (tipos && !tipos.includes(tipo)) continue
    const ja = existentes.filter(e => tipoDoPadrao(e.tp) === tipo)
    const falta = quantidade?.[tipo] ?? ((meta[tipo] ?? 0) - ja.length)
    if (falta <= 0) continue

    const ocupados = new Set(ja.map(e => chaveDia(e.dt)))
    const doPadrao = padrao.dias[tipo]?.length
      ? diasPreferidosNoMes(padrao, tipo, ano, mes)
      : todos.filter(d => d.getDay() >= 1 && d.getDay() <= 5)
    const livres = doPadrao.filter(d => !ocupados.has(chaveDia(d)))
    const aFrente = livres.filter(d => d.getTime() >= hojeMs)
    const base = aFrente.length >= falta ? aFrente : livres

    let escolhidos: Date[]
    if (base.length >= falta) {
      // Espalha: o k-ésimo pega o meio da k-ésima fatia da lista.
      escolhidos = Array.from({ length: falta }, (_, k) => base[Math.floor(((k + 0.5) * base.length) / falta)])
    } else {
      // Não há dia preferido livre suficiente: usa todos e repete os dias do padrão.
      escolhidos = [...base]
      const ciclo = doPadrao.length ? doPadrao : todos
      for (let k = 0; escolhidos.length < falta; k++) escolhidos.push(ciclo[k % ciclo.length])
    }
    for (const d of escolhidos) out.push({ tipo, data: new Date(d) })
  }
  return out.sort((a, b) => a.data.getTime() - b.data.getTime())
}

/**
 * O que o "Restaurar padrão" substitui: os conteúdos do cliente naquele mês que
 * ainda estão em "A fazer" (0) — o planejamento, automático ou manual. O que já
 * entrou em produção (1 em diante) fica: apagar trabalho começado não é
 * "restaurar preferência".
 */
export function substituiveisNoRestaurar(itensDoMes: ContentItem[], states: Record<number, ItemState>): ContentItem[] {
  return itensDoMes.filter(i => (states[i.i]?.status ?? i.s) === 0)
}

export interface Restauracao {
  /** Conteúdos em "A fazer" que voltam para um dia do padrão (id → nova data). */
  mover: { id: number; data: Date }[]
  /** O que falta para a meta, já com data. */
  criar: Planejado[]
}

/**
 * "Restaurar padrão": desfaz as escolhas manuais de DATA do mês e reconstrói pelo
 * padrão — sem apagar pauta de ninguém. Testado no navegador em 29/09: apagar os
 * conteúdos em "A fazer" levava junto pauta escrita ("Vídeo - Restaurante
 * polêmica"), e o que se quer desfazer é a preferência, não o trabalho.
 *
 * Por tipo: o que já entrou em produção fica onde está; os em "A fazer" são
 * redistribuídos nos dias do padrão (na ordem em que estavam); se ainda faltar
 * para a meta, cria. Nada sai do calendário. Tipos fora do padrão (Story) ficam.
 */
export function planejarRestauracao(opts: {
  ano: number
  mes: number
  padrao: PadraoCliente
  meta: Record<TipoPadrao, number>
  itensDoMes: ContentItem[]
  states: Record<number, ItemState>
  hoje: Date
}): Restauracao {
  const { ano, mes, padrao, meta, itensDoMes, states, hoje } = opts
  const moviveis = substituiveisNoRestaurar(itensDoMes, states).filter(i => tipoDoPadrao(i.tp) !== null)
  const idsMoviveis = new Set(moviveis.map(i => i.i))
  const fixos = itensDoMes.filter(i => !idsMoviveis.has(i.i))
  // Vagas por tipo: o suficiente para a meta E para todos os que vão ser movidos.
  const vagas = Object.fromEntries(TIPOS_PADRAO.map(t => {
    const nFixos = fixos.filter(i => tipoDoPadrao(i.tp) === t).length
    const nMov = moviveis.filter(i => tipoDoPadrao(i.tp) === t).length
    return [t, Math.max(meta[t] ?? 0, nFixos + nMov)]
  })) as Record<TipoPadrao, number>
  const slots = planejarDistribuicao({ ano, mes, padrao, meta: vagas, existentes: fixos, hoje })

  const mover: Restauracao['mover'] = []
  const criar: Planejado[] = []
  for (const t of TIPOS_PADRAO) {
    const doTipo = slots.filter(s => s.tipo === t)
    const fila = moviveis.filter(i => tipoDoPadrao(i.tp) === t).sort((a, b) => a.dt.getTime() - b.dt.getTime())
    doTipo.forEach((s, k) => {
      if (k < fila.length) mover.push({ id: fila[k].i, data: s.data })
      else criar.push(s)
    })
  }
  return { mover, criar }
}

/** Título de um conteúdo criado pela distribuição — a pauta é definida depois. */
export function tituloPlanejado(tipo: TipoPadrao): string {
  return `${ROTULO_TIPO[tipo]} — pauta a definir`
}

/** O tipo de card que cada tipo do padrão cria. */
export const TIPO_DO_CARD: Record<TipoPadrao, ContentType> = { Reel: 'Reel', Post: 'Post', Feed: 'Feed' }
