/**
 * Números do Dashboard INDIVIDUAL — só do próprio usuário (2026-09-28).
 *
 * Regra do dono: "Você concluiu 18 conteúdos neste mês" pode; "você 18, o outro
 * 24" nunca. Por isso as funções recebem UM usuário e não existe versão que
 * devolva a equipe. A autoria é a mesma do resto do painel (`donoDoCard`) e a
 * entrega é o `momentoDaEntrega` da produção — sem regra paralela.
 */
import type { ContentItem, ItemState, Roteiro, RoteiroStatus } from '../types'
import { isOpenStatus } from '../types'
import { donoDoCard, type Atribuicoes, type PaineisStore } from './access'
import { isRealLate } from './todaySignals'
import { momentoDaEntrega } from './producaoEditor'

const DAY = 86_400_000
const mesmoMes = (ts: number, ref: Date) => {
  const d = new Date(ts)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}
const fimDoDia = (d: Date | number) => new Date(d).setHours(23, 59, 59, 999)

export interface MeuDashboard {
  recebidos: number
  recebidosMes: number
  concluidos: number
  concluidosMes: number
  emAndamento: number
  emAjuste: number
  atrasados: number
  /** % das entregas do mês que saíram até a data do card. `null` sem entrega no mês. */
  noPrazoPct: number | null
  /** Dias, em média, do primeiro registro do card até a entrega. `null` sem base. */
  tempoMedioDias: number | null
  /** Entregas por mês, do mais antigo (há 5 meses) ao atual. */
  evolucao: { rotulo: string; n: number }[]
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function computeMeuDashboard(args: {
  user: string
  items: ContentItem[]
  states: Record<number, ItemState>
  atrib: Atribuicoes
  paineis: PaineisStore
  now: Date
}): MeuDashboard {
  const { user, items, states, atrib, paineis, now } = args
  const meus = items.filter(i => donoDoCard(i.i, states[i.i], atrib, paineis) === user)

  let recebidosMes = 0, concluidos = 0, concluidosMes = 0, emAndamento = 0, emAjuste = 0, atrasados = 0
  let noPrazo = 0
  const duracoes: number[] = []
  const porMes = new Map<string, number>()

  for (const i of meus) {
    const st = states[i.i]
    const status = st?.status ?? i.s
    const entrega = momentoDaEntrega(st)
    if (mesmoMes(new Date(i.dt).getTime(), now)) recebidosMes++
    if (status === 6) emAjuste++
    if (isRealLate(i, st, now)) atrasados++
    if (entrega) {
      concluidos++
      const d = new Date(entrega.ts)
      const chave = `${d.getFullYear()}-${d.getMonth()}`
      porMes.set(chave, (porMes.get(chave) ?? 0) + 1)
      if (mesmoMes(entrega.ts, now)) {
        concluidosMes++
        if (entrega.ts <= fimDoDia(i.dt)) noPrazo++
      }
      const inicio = st?.history?.length ? Math.min(...st.history.map(h => h.ts)) : null
      if (inicio !== null && entrega.ts > inicio) duracoes.push((entrega.ts - inicio) / DAY)
    } else if (isOpenStatus(status)) {
      emAndamento++
    }
  }

  const evolucao = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - k), 1)
    return { rotulo: MESES[d.getMonth()], n: porMes.get(`${d.getFullYear()}-${d.getMonth()}`) ?? 0 }
  })

  return {
    recebidos: meus.length,
    recebidosMes,
    concluidos,
    concluidosMes,
    emAndamento,
    emAjuste,
    atrasados,
    noPrazoPct: concluidosMes > 0 ? Math.round((noPrazo / concluidosMes) * 100) : null,
    tempoMedioDias: duracoes.length ? Math.round((duracoes.reduce((a, b) => a + b, 0) / duracoes.length) * 10) / 10 : null,
    evolucao,
  }
}

// ── Copy (Geovana): roteiros e legendas ──────────────────────────────────────

export interface CopyDashboard {
  roteirosMes: Record<RoteiroStatus, number>
  roteirosMesTotal: number
  legendasFeitasMes: number
  legendasPendentesMes: number
}

export function computeCopyDashboard(args: {
  roteiros: Record<string, Roteiro[]>
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
}): CopyDashboard {
  const { roteiros, items, states, now } = args
  const roteirosMes: Record<RoteiroStatus, number> = { ideia: 0, escrevendo: 0, revisao: 0, pronto: 0 }
  let roteirosMesTotal = 0
  for (const lista of Object.values(roteiros)) {
    for (const r of lista) {
      const doMes = (r.year ?? now.getFullYear()) === now.getFullYear() && (r.month ?? now.getMonth()) === now.getMonth()
      if (!doMes) continue
      roteirosMes[r.status ?? 'ideia']++
      roteirosMesTotal++
    }
  }
  let legendasFeitasMes = 0, legendasPendentesMes = 0
  for (const i of items) {
    if (!mesmoMes(new Date(i.dt).getTime(), now)) continue
    const st = states[i.i]
    if (st?.caption?.trim()) legendasFeitasMes++
    else if (isOpenStatus(st?.status ?? i.s)) legendasPendentesMes++
  }
  return { roteirosMes, roteirosMesTotal, legendasFeitasMes, legendasPendentesMes }
}
