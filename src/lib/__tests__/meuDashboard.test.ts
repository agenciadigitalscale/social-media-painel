import { describe, it, expect } from 'vitest'
import { computeMeuDashboard, computeCopyDashboard } from '../meuDashboard'
import type { ContentItem, ItemState, Status } from '../../types'

const NOW = new Date(2026, 8, 28, 12)
const d = (y: number, m: number, day: number, h = 10) => new Date(y, m, day, h)
const item = (i: number, dt: Date, s: Status = 1): ContentItem => ({ i, c: 'A', dt, tp: 'Post', n: 'x', s, custom: true })
const st = (status: Status, extra: Partial<ItemState> = {}): ItemState =>
  ({ status, title: '', link: '', caption: '', notes: '', ...extra }) as ItemState

describe('dashboard individual', () => {
  const items = [
    item(1, d(2026, 8, 20)),           // jhones — entregue no prazo em setembro
    item(2, d(2026, 8, 10)),           // jhones — entregue ATRASADO em setembro
    item(3, d(2026, 8, 30)),           // jhones — em andamento
    item(4, d(2026, 8, 25)),           // jhones — em ajuste
    item(5, d(2026, 8, 20)),           // julio — NÃO pode entrar na conta do jhones
    item(6, d(2026, 6, 5)),            // jhones — entregue em julho
  ]
  const states: Record<number, ItemState> = {
    1: st(2, { assignedEditor: 'jhones', history: [{ action: 'x', ts: d(2026, 8, 18).getTime() }], sentToClientAt: d(2026, 8, 19).getTime() }),
    2: st(4, { assignedEditor: 'jhones', sentToClientAt: d(2026, 8, 12).getTime() }),
    3: st(1, { assignedEditor: 'jhones' }),
    4: st(6, { assignedEditor: 'jhones' }),
    5: st(4, { assignedEditor: 'julio', sentToClientAt: d(2026, 8, 19).getTime() }),
    6: st(7, { assignedEditor: 'jhones', publishedAt: d(2026, 6, 6).getTime() }),
  }
  const r = computeMeuDashboard({ user: 'jhones', items, states, atrib: {}, paineis: { paineis: [] }, now: NOW })

  it('conta só o que é do próprio usuário', () => {
    expect(r.recebidos).toBe(5)
    expect(r.concluidos).toBe(3)
    expect(r.concluidosMes).toBe(2)
  })

  it('andamento, ajuste e prazo', () => {
    expect(r.emAjuste).toBe(1)
    expect(r.emAndamento).toBe(2) // o 3 (produção) e o 4 (ajuste ainda está aberto)
    expect(r.noPrazoPct).toBe(50)
    expect(r.tempoMedioDias).toBe(1)
  })

  it('evolução dos últimos 6 meses, terminando no atual', () => {
    expect(r.evolucao.map(m => m.rotulo)).toEqual(['Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set'])
    expect(r.evolucao[3].n).toBe(1)
    expect(r.evolucao[5].n).toBe(2)
  })
})

describe('dashboard da copy', () => {
  it('roteiros do mês por status e legendas do mês', () => {
    const r = computeCopyDashboard({
      roteiros: { A: [
        { id: '1', clientName: 'A', title: 't', type: 'Reel', distributed: false, status: 'pronto', year: 2026, month: 8 },
        { id: '2', clientName: 'A', title: 't', type: 'Reel', distributed: false, year: 2026, month: 8 },
        { id: '3', clientName: 'A', title: 't', type: 'Reel', distributed: false, status: 'pronto', year: 2026, month: 7 },
      ] },
      items: [item(1, d(2026, 8, 20)), item(2, d(2026, 8, 21)), item(3, d(2026, 7, 21))],
      states: { 1: st(1, { caption: 'legenda' }) },
      now: NOW,
    })
    expect(r.roteirosMesTotal).toBe(2)
    expect(r.roteirosMes).toEqual({ ideia: 1, escrevendo: 0, revisao: 0, pronto: 1 })
    expect(r.legendasFeitasMes).toBe(1)
    expect(r.legendasPendentesMes).toBe(1)
  })
})
