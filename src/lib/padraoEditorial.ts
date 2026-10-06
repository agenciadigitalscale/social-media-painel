/* lib/padraoEditorial.ts — o Padrão Editorial de cada cliente (2026-09-29).

   Padrão Editorial → cria a base do mês → o sistema distribui → a pessoa edita tudo.

   O padrão é BASE, não trava: diz em que dias da semana cada tipo costuma sair
   (ex.: Reel às quartas, Post às sextas) e quantos o plano pede no mês. O
   calendário continua aceitando qualquer conteúdo em qualquer dia — o que foge do
   padrão é só uma exceção daquele mês, e nada aqui a impede.

   Tudo o que decide datas é função pura (testada em __tests__/padraoEditorial);
   quem cria/apaga cards é o App, pelo mesmo caminho do resto do painel. */
import type { Client, ContentItem, ContentType } from '../types'
import { syncToCloud } from './storage'
import { COR_TIPO_CONTEUDO } from '../theme'

/** Os três tipos que o padrão organiza. Post = arte do Design; Feed = foto da empresa. */
export type TipoPadrao = 'Reel' | 'Post' | 'Feed'
export const TIPOS_PADRAO: TipoPadrao[] = ['Reel', 'Post', 'Feed']
/** Como a equipe chama cada tipo (2026-10-05): Reel · Design · Feed. Internamente o Design segue sendo "Post". */
export const ROTULO_TIPO: Record<TipoPadrao, string> = { Reel: 'Reel', Post: 'Design', Feed: 'Feed' }

/**
 * Os tipos que se CRIAM hoje (2026-10-06): Reel · Design · Feed. Story e
 * Carrossel continuam válidos nos cards antigos (o tipo segue no dado), só não
 * são oferecidos para conteúdo novo.
 */
export const TIPOS_CRIACAO: { tp: ContentType; rotulo: string }[] = [
  { tp: 'Reel', rotulo: 'Reel' }, { tp: 'Post', rotulo: 'Design' }, { tp: 'Feed', rotulo: 'Feed' },
]
/** Rótulo de qualquer tipo de card (os antigos mantêm o nome deles). */
export function rotuloDoTipo(tp: ContentType): string {
  return TIPOS_CRIACAO.find(t => t.tp === tp)?.rotulo ?? tp
}

/** A que tipo do padrão um card pertence (Carrossel conta como Post Design; Story fica fora). */
export function tipoDoPadrao(tp: ContentType): TipoPadrao | null {
  if (tp === 'Reel') return 'Reel'
  if (tp === 'Post' || tp === 'Carrossel') return 'Post'
  if (tp === 'Feed') return 'Feed'
  return null
}

/** A cor do tipo — a mesma no card, na vaga, no filtro, no padrão e na distribuição. */
export const COR_TIPO: Record<TipoPadrao, string> = { Reel: COR_TIPO_CONTEUDO.Reel, Post: COR_TIPO_CONTEUDO.Design, Feed: COR_TIPO_CONTEUDO.Feed }
/** Cor de um card pelo tipo dele (Story e afins, fora do padrão: cinza). */
export function corDoConteudo(tp: ContentType): string {
  const t = tipoDoPadrao(tp)
  return t ? COR_TIPO[t] : '#A8A09A'
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
  /** Segundo tipo do cliente, além do Reel: Design (Post) ou Feed. Ausente = deduzido (Design). */
  segundo?: SegundoTipo
  /** 6+6: o mês começa pela semana FRACA (padrão: forte, fraca, forte…). */
  comecaFraca?: boolean
}
export type SegundoTipo = 'Post' | 'Feed'
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
  return p ? { dias: { ...PADRAO_VAZIO.dias, ...p.dias }, meta: p.meta, plano: p.plano, diasFraca: p.diasFraca, segundo: p.segundo, comecaFraca: p.comecaFraca } : PADRAO_VAZIO
}

/**
 * O segundo tipo do cliente (Reel + Design, ou Reel + Feed). Sem escolha
 * gravada, vale o que o padrão já usa: só Feed configurado = Feed; senão Design.
 */
export function segundoTipo(p: Pick<PadraoCliente, 'segundo' | 'dias' | 'meta'>): SegundoTipo {
  if (p.segundo) return p.segundo
  const usaFeed = (p.dias.Feed?.length ?? 0) > 0 || (p.meta?.Feed ?? 0) > 0
  const usaPost = (p.dias.Post?.length ?? 0) > 0 || (p.meta?.Post ?? 0) > 0
  return usaFeed && !usaPost ? 'Feed' : 'Post'
}

/**
 * Meta permanente: o que o padrão fixar; senão o plano do cliente — o número de
 * "posts" do plano vai para o SEGUNDO tipo dele (Design ou Feed).
 */
export function metaDoMes(padrao: PadraoCliente, cliente: Pick<Client, 'postsPerMonth' | 'reelsPerMonth'> | undefined): Record<TipoPadrao, number> {
  const seg = segundoTipo(padrao)
  return {
    Reel: padrao.meta?.Reel ?? cliente?.reelsPerMonth ?? 0,
    Post: padrao.meta?.Post ?? (seg === 'Post' ? cliente?.postsPerMonth ?? 0 : 0),
    Feed: padrao.meta?.Feed ?? (seg === 'Feed' ? cliente?.postsPerMonth ?? 0 : 0),
  }
}

/**
 * Meta de UM mês: a exceção daquele mês (quando alguém a fixou) e, no que ela
 * não disser, a meta permanente do cliente. Novembro sem exceção volta ao padrão.
 */
export function metaEfetiva(
  excecao: Partial<Record<TipoPadrao, number>> | undefined,
  base: PadraoCliente,
  cliente: Pick<Client, 'postsPerMonth' | 'reelsPerMonth'> | undefined,
): Record<TipoPadrao, number> {
  const perm = metaDoMes(base, cliente)
  return { Reel: excecao?.Reel ?? perm.Reel, Post: excecao?.Post ?? perm.Post, Feed: excecao?.Feed ?? perm.Feed }
}

// ── Datas ──────────────────────────────────────────────────────────────
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

/** No 6+6, esta semana do mês é forte? Alterna sozinha; `comecaFraca` inverte. */
export function semanaForte(padrao: Pick<PadraoCliente, 'comecaFraca'>, d: Date): boolean {
  return (semanaDoMes(d) % 2 === 0) !== !!padrao.comecaFraca
}

/** Dias da semana que valem para um tipo numa data — forte ou fraca no 6+6. */
export function diasDaSemana(padrao: PadraoCliente, tipo: TipoPadrao, d: Date): number[] {
  const fortes = padrao.dias[tipo] ?? []
  if (padrao.plano !== '6+6' || semanaForte(padrao, d)) return fortes
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

// ── Vagas do mês (preferências por DATA) ────────────────────────────────
//
// Preferência é PLANEJAMENTO, não conteúdo: "neste dia sai um Reel". O padrão
// gera as vagas iniciais do mês — TODAS as ocorrências dos dias configurados,
// sem forçar 4/6/8 (segunda + sexta num mês com 9 delas = 9 vagas). Depois o mês
// é independente: dá para pôr vaga em qualquer dia e arrastar de um dia para outro.

export interface Vaga { dia: number; tipo: TipoPadrao }

/** As vagas que o padrão dá para o mês (ordem: dia, depois Reel → Design → Feed). */
export function gerarVagas(padrao: PadraoCliente, ano: number, mes: number): Vaga[] {
  const out: Vaga[] = []
  for (const tipo of TIPOS_PADRAO) for (const d of diasPreferidosNoMes(padrao, tipo, ano, mes)) out.push({ dia: d.getDate(), tipo })
  return ordenarVagas(out)
}

export function ordenarVagas(vagas: Vaga[]): Vaga[] {
  return [...vagas].sort((a, b) => a.dia - b.dia || TIPOS_PADRAO.indexOf(a.tipo) - TIPOS_PADRAO.indexOf(b.tipo))
}

/**
 * Vaga OCUPADA continua guardada, mas some da tela: quem aparece é o conteúdo.
 * Cada conteúdo do tipo, naquele dia, ocupa uma vaga do mesmo tipo. Tirou o
 * conteúdo do dia, a vaga reaparece sozinha (nada é apagado).
 */
export function vagasLivres(vagas: Vaga[], ocupantes: { dia: number; tipo: TipoPadrao | null }[]): Vaga[] {
  const uso = new Map<string, number>()
  for (const o of ocupantes) if (o.tipo) uso.set(`${o.dia}:${o.tipo}`, (uso.get(`${o.dia}:${o.tipo}`) ?? 0) + 1)
  const livres: Vaga[] = []
  for (const v of ordenarVagas(vagas)) {
    const k = `${v.dia}:${v.tipo}`
    const n = uso.get(k) ?? 0
    if (n > 0) uso.set(k, n - 1); else livres.push(v)
  }
  return livres
}

/**
 * "Distribuir conteúdos": cada conteúdo vai para a próxima vaga LIVRE do mesmo
 * tipo, em ordem de data — só vagas compatíveis. Num mês em curso, só de hoje em
 * diante (criar conteúdo no passado nasceria atrasado). O que não couber volta
 * em `sobra`, para a tela avisar: falta vaga, não falta regra.
 */
export function distribuirNasVagas(opts: {
  ano: number
  mes: number
  livres: Vaga[]
  pedidos: Partial<Record<TipoPadrao, number>>
  hoje: Date
}): { plano: Planejado[]; sobra: Partial<Record<TipoPadrao, number>> } {
  const { ano, mes, livres, pedidos, hoje } = opts
  const hojeMs = inicioDoDia(hoje)
  const plano: Planejado[] = []
  const sobra: Partial<Record<TipoPadrao, number>> = {}
  for (const tipo of TIPOS_PADRAO) {
    const n = Math.max(0, Math.floor(pedidos[tipo] ?? 0))
    if (!n) continue
    const datas = ordenarVagas(livres.filter(v => v.tipo === tipo))
      .map(v => new Date(ano, mes, v.dia, 12))
      .filter(d => d.getMonth() === mes && d.getTime() >= hojeMs)
    datas.slice(0, n).forEach(data => plano.push({ tipo, data }))
    if (datas.length < n) sobra[tipo] = n - datas.length
  }
  return { plano: plano.sort((a, b) => a.data.getTime() - b.data.getTime()), sobra }
}

/** Tira o prefixo que a equipe costuma digitar ("VIDEO - ", "Post: ") — o campo já é o tipo. */
export function semPrefixo(linha: string): string {
  return linha.replace(/^\s*(v[ií]deo|reels?|posts?|design|arte|feed|foto)\s*[-–—:|]\s*/i, '').trim()
}

/** Título de um conteúdo criado pela distribuição — a pauta é definida depois. */
export function tituloPlanejado(tipo: TipoPadrao): string {
  return `${ROTULO_TIPO[tipo]} — pauta a definir`
}

/** O tipo de card que cada tipo do padrão cria. */
export const TIPO_DO_CARD: Record<TipoPadrao, ContentType> = { Reel: 'Reel', Post: 'Post', Feed: 'Feed' }
