import type { ContentItem, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'

/**
 * Visão operacional de UM cliente (aba Clientes, 2026-10-02). Tudo aqui é
 * deduzido do que os cards já têm — status, data de postagem, entrega e
 * histórico. Nada de número inventado: sem dado, o campo volta vazio e a tela
 * diz "sem pauta" em vez de chutar.
 */

export type GrupoTipo = 'Reel' | 'Post'

/** Reel conta como Reel; Post, Carrossel e Feed contam como Post. Story fica fora da meta. */
export function grupoDoTipo(tp: ContentItem['tp']): GrupoTipo | null {
  if (tp === 'Reel') return 'Reel'
  if (tp === 'Post' || tp === 'Carrossel' || tp === 'Feed') return 'Post'
  return null
}

/** Pronto para ir ao ar: aprovado (3), com o cliente (4), cliente ok (5), programado (9). */
export const STATUS_EM_ESTOQUE: readonly Status[] = [3, 4, 5, 9]
/** Ainda nas mãos da equipe. */
const STATUS_EM_PRODUCAO: readonly Status[] = [0, 1, 2, 6]

const DIA = 86_400_000
const inicioDoDia = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }

export const statusDe = (item: ContentItem, states: Record<number, ItemState>): Status =>
  (states[item.i]?.status ?? item.s) as Status

/** Data de postagem: o horário programado quando o card está em Programado; senão a pauta. */
export function dataDePostagem(item: ContentItem, state: ItemState | undefined): number {
  if (state?.status === 9 && state.programadoPara) return state.programadoPara
  return item.dt.getTime()
}

export interface Alerta {
  nivel: 'urgente' | 'risco'
  titulo: string
  detalhe: string
  itemId: number
  /** Para ordenar: o mais antigo/próximo primeiro. */
  quando: number
}

export interface Cobertura {
  /** Último dia coberto por conteúdo pronto, sem buraco desde hoje. null = nada coberto. */
  cobertoAte: number | null
  /** Primeira data com conteúdo que ainda não está pronto. null = sem pauta futura descoberta. */
  proximaSemCobertura: number | null
  /** Há pauta futura deste tipo? */
  temPauta: boolean
}

export interface VisaoCliente {
  meta: Record<GrupoTipo, { meta: number; publicados: number }>
  publicadosNoMes: number
  extrasNoMes: number
  estoque: Record<GrupoTipo, number>
  alertas: Alerta[]
  cobertura: Record<GrupoTipo, Cobertura>
  pipeline: { chave: string; rotulo: string; total: number }[]
  proximaPublicacao: number | null
  ultimaMovimentacao: number | null
}

const rotuloStatus = (s: Status) => `na etapa "${STATUS_CONFIG[s]?.label ?? ''}"`
const dm = (t: number) => { const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }

/** Quem destrava o card agora — o texto do alerta diz isso. */
function quemDepende(item: ContentItem, s: Status): string {
  if (s === 2) return 'Depende da revisão interna.'
  if (s === 0) return 'Depende de começar a produção.'
  return item.tp === 'Reel' ? 'Depende de editor.' : 'Depende de designer.'
}

export function visaoDoCliente(opts: {
  items: ContentItem[]
  states: Record<number, ItemState>
  cliente: string
  ano: number
  mes: number
  meta: Record<GrupoTipo, number>
  agora: number
  /** Janela do "prazo em risco": publicação em até N dias ainda em produção. */
  diasDeRisco?: number
}): VisaoCliente {
  const { states, cliente, ano, mes, agora } = opts
  const diasDeRisco = opts.diasDeRisco ?? 3
  const hoje = inicioDoDia(agora)
  const doCliente = opts.items.filter(i => i.c === cliente)

  const noMes = doCliente.filter(i => { const t = new Date(dataDePostagem(i, states[i.i])); return t.getFullYear() === ano && t.getMonth() === mes })
  const meta: VisaoCliente['meta'] = { Reel: { meta: opts.meta.Reel, publicados: 0 }, Post: { meta: opts.meta.Post, publicados: 0 } }
  let publicadosNoMes = 0
  let extrasNoMes = 0
  for (const i of noMes) {
    if (statusDe(i, states) !== 7) continue
    publicadosNoMes++
    const g = grupoDoTipo(i.tp)
    if (g) meta[g].publicados++
    else extrasNoMes++
  }

  const estoque: Record<GrupoTipo, number> = { Reel: 0, Post: 0 }
  const alertas: Alerta[] = []
  let ultimaMovimentacao: number | null = null
  let proximaPublicacao: number | null = null

  for (const i of doCliente) {
    const st = states[i.i]
    const s = statusDe(i, states)
    const g = grupoDoTipo(i.tp)
    if (g && STATUS_EM_ESTOQUE.includes(s)) estoque[g]++

    for (const h of st?.history ?? []) {
      if (h.ts && (ultimaMovimentacao === null || h.ts > ultimaMovimentacao)) ultimaMovimentacao = h.ts
    }

    if (s === 7 || s === 8) continue
    const pub = dataDePostagem(i, st)
    if (pub >= hoje && (proximaPublicacao === null || pub < proximaPublicacao)) proximaPublicacao = pub

    if (!STATUS_EM_PRODUCAO.includes(s)) continue
    const titulo = st?.title || i.n
    const entrega = st?.deliveryDate
    if (entrega && inicioDoDia(entrega) < hoje && s !== 2) {
      alertas.push({
        nivel: 'urgente', titulo: 'Conteúdo atrasado', itemId: i.i, quando: entrega,
        detalhe: `${titulo}: entregar até era ${dm(entrega)} e o conteúdo está ${rotuloStatus(s)}. ${quemDepende(i, s)}`,
      })
    } else if (inicioDoDia(pub) < hoje) {
      alertas.push({
        nivel: 'urgente', titulo: 'Publicação atrasada', itemId: i.i, quando: pub,
        detalhe: `${titulo}: era para ir ao ar em ${dm(pub)} e ainda está ${rotuloStatus(s)}. ${quemDepende(i, s)}`,
      })
    } else {
      const faltam = Math.round((inicioDoDia(pub) - hoje) / DIA)
      if (faltam <= diasDeRisco) {
        alertas.push({
          nivel: 'risco', titulo: 'Prazo de publicação em risco', itemId: i.i, quando: pub,
          detalhe: `${titulo}: ${faltam === 0 ? 'vai ao ar hoje' : `faltam ${faltam} dia${faltam > 1 ? 's' : ''}`} e o conteúdo ainda está ${rotuloStatus(s)}. ${quemDepende(i, s)}`,
        })
      }
    }
  }
  alertas.sort((a, b) => (a.nivel === b.nivel ? a.quando - b.quando : a.nivel === 'urgente' ? -1 : 1))

  const cobertura = { Reel: coberturaDo('Reel'), Post: coberturaDo('Post') }
  function coberturaDo(g: GrupoTipo): Cobertura {
    const futuros = doCliente
      .filter(i => grupoDoTipo(i.tp) === g && statusDe(i, states) !== 7 && statusDe(i, states) !== 8)
      .map(i => ({ t: dataDePostagem(i, states[i.i]), pronto: STATUS_EM_ESTOQUE.includes(statusDe(i, states)) }))
      .filter(x => inicioDoDia(x.t) >= hoje)
      .sort((a, b) => a.t - b.t)
    let cobertoAte: number | null = null
    for (const x of futuros) {
      if (!x.pronto) return { cobertoAte, proximaSemCobertura: x.t, temPauta: true }
      cobertoAte = x.t
    }
    return { cobertoAte, proximaSemCobertura: null, temPauta: futuros.length > 0 }
  }

  const abertos = doCliente.map(i => statusDe(i, states))
  const conta = (lista: readonly Status[]) => abertos.filter(s => lista.includes(s)).length
  const pipeline = [
    { chave: 'afazer', rotulo: 'A fazer', total: conta([0]) },
    { chave: 'producao', rotulo: 'Em produção', total: conta([1]) },
    { chave: 'revisao', rotulo: 'Revisão e ajuste', total: conta([2, 6]) },
    { chave: 'aprovado', rotulo: 'Aprovados', total: conta([3]) },
    { chave: 'cliente', rotulo: 'Aguardando cliente', total: conta([4]) },
    { chave: 'clienteok', rotulo: 'Cliente ok', total: conta([5]) },
    { chave: 'programado', rotulo: 'Programados', total: conta([9]) },
  ]

  return { meta, publicadosNoMes, extrasNoMes, estoque, alertas, cobertura, pipeline, proximaPublicacao, ultimaMovimentacao }
}

/** Selo do cliente: urgente se há atraso, atenção se há risco, em dia caso contrário. */
export function seloDoCliente(alertas: Alerta[]): 'urgente' | 'atencao' | 'emdia' {
  if (alertas.some(a => a.nivel === 'urgente')) return 'urgente'
  if (alertas.length) return 'atencao'
  return 'emdia'
}

/** Próxima gravação agendada do cliente (data "AAAA-MM-DD" a partir de hoje). */
export function proximaGravacao(gravacoes: { client: string; date: string; status?: string }[], cliente: string, agora: number): number | null {
  const hoje = inicioDoDia(agora)
  let melhor: number | null = null
  for (const g of gravacoes) {
    if (g.client !== cliente || !g.date || g.status === 'cancelado') continue
    const [a, m, d] = g.date.split('-').map(Number)
    if (!a || !m || !d) continue
    const t = new Date(a, m - 1, d).getTime()
    if (t >= hoje && (melhor === null || t < melhor)) melhor = t
  }
  return melhor
}
