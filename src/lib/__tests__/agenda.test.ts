import { describe, it, expect } from 'vitest'
import { chaveDia, diasDaSemana, gradeDoMes, postsPorDia } from '../agenda'
import type { ContentItem, ItemState, Status } from '../../types'

let seq = 0
const card = (dia: number, c = 'Aventur'): ContentItem =>
  ({ i: ++seq, c, dt: new Date(2026, 9, dia, 12), tp: 'Reel', n: 'x', s: 0, custom: true })
const st = (status: Status, extra: Partial<ItemState> = {}): ItemState => ({ status, title: '', link: '', caption: '', notes: '', ...extra })

describe('agenda (aba Agendamento)', () => {
  it('semana vai de domingo a sábado', () => {
    const d = diasDaSemana(new Date(2026, 9, 21))
    expect(d.map(x => x.getDate())).toEqual([18, 19, 20, 21, 22, 23, 24])
    expect(d[0].getDay()).toBe(0)
  })

  it('grade do mês cobre semanas inteiras', () => {
    const g = gradeDoMes(new Date(2026, 9, 5))
    expect(g.length % 7).toBe(0)
    expect(g[0].getDay()).toBe(0)
    expect(g.some(x => x.getMonth() === 9 && x.getDate() === 31)).toBe(true)
  })

  const a = card(19), b = card(19), c = card(20), d = card(21), e = card(19)
  const states: Record<number, ItemState> = {
    [a.i]: st(9, { programadoPara: new Date(2026, 9, 19, 18, 0).getTime() }),
    [b.i]: st(5, { horaPostagem: '09:00' }),
    [c.i]: st(7, { publishedAt: new Date(2026, 9, 20, 10, 30).getTime() }),
    [d.i]: st(1),
    [e.i]: st(5),
  }
  const m = postsPorDia([a, b, c, d, e], states, new Date(2026, 9, 18), new Date(2026, 9, 24))

  it('só aprovar, agendado e publicado entram; produção fica de fora', () => {
    expect(m.get(chaveDia(new Date(2026, 9, 21)))).toBeUndefined()
    expect(m.get(chaveDia(new Date(2026, 9, 20)))!.map(p => p.situacao)).toEqual(['publicado'])
  })

  it('no dia: por horário, sem horário no fim', () => {
    const dia = m.get(chaveDia(new Date(2026, 9, 19)))!
    expect(dia.map(p => [p.item.i, p.hora, p.situacao])).toEqual([[b.i, '09:00', 'aprovar'], [a.i, '18:00', 'agendado'], [e.i, null, 'aprovar']])
  })

  it('publicado aparece no dia e hora em que saiu', () => {
    expect(m.get(chaveDia(new Date(2026, 9, 20)))![0].hora).toBe('10:30')
  })

  it('o filtro vale', () => {
    const so = postsPorDia([a, b], states, new Date(2026, 9, 18), new Date(2026, 9, 24), it => it.i === a.i)
    expect([...so.values()].flat().map(p => p.item.i)).toEqual([a.i])
  })
})
