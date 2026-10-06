import { describe, it, expect } from 'vitest'
import { cronogramaDoMes } from '../cronograma'
import type { ContentItem, ItemState, Status } from '../../types'

let seq = 0
const item = (dia: number, tp: ContentItem['tp'], n: string, c = 'Marina', mes = 9, s: Status = 0): ContentItem =>
  ({ i: ++seq, c, dt: new Date(2026, mes, dia, 12), tp, n, s, custom: true })
const st = (status: Status, extra: Partial<ItemState> = {}): ItemState => ({ status, title: '', link: '', caption: '', notes: '', ...extra })

describe('Cronograma de postagens', () => {
  const its = [
    item(4, 'Reel', 'VIDEO - Luau Marina Fênix'),
    item(2, 'Reel', 'Pizza Chef Gazal'),
    item(3, 'Post', 'POST - Informação Festival Kids'),
    item(14, 'Feed', 'Post 5'),
    item(9, 'Carrossel', 'Day Use'),
    item(5, 'Reel', 'De outro cliente', 'Lareiras'),
    item(28, 'Reel', 'De setembro', 'Marina', 8),
  ]
  const { linhas, resumo } = cronogramaDoMes({ items: its, states: {}, cliente: 'Marina', ano: 2026, mes: 9 })

  it('só o cliente e o mês escolhidos, em ordem de data', () => {
    expect(linhas.map(l => l.data.getDate())).toEqual([2, 3, 4, 9, 14])
  })
  it('tipos com os nomes da equipe e títulos sem prefixo', () => {
    expect(linhas.map(l => l.tipo)).toEqual(['Reel', 'Design', 'Reel', 'Design', 'Feed'])
    expect(linhas[1].titulo).toBe('Informação Festival Kids')
    expect(linhas[2].titulo).toBe('Luau Marina Fênix')
  })
  it('resumo do mês', () => {
    expect(resumo).toEqual({ reels: 2, design: 2, feed: 1, outros: 0, total: 5 })
  })
  it('o título do card (editado no calendário) manda sobre o nome original', () => {
    const r = cronogramaDoMes({ items: its, states: { [its[1].i]: st(0, { title: 'Pizza do Chef' }) }, cliente: 'Marina', ano: 2026, mes: 9 })
    expect(r.linhas[0].titulo).toBe('Pizza do Chef')
  })
  it('Programado usa o dia programado (remarcar no calendário muda o cronograma)', () => {
    const r = cronogramaDoMes({ items: its, states: { [its[1].i]: st(9, { programadoPara: new Date(2026, 9, 20, 18).getTime() }) }, cliente: 'Marina', ano: 2026, mes: 9 })
    expect(r.linhas.find(l => l.id === its[1].i)!.data.getDate()).toBe(20)
  })
  it('"só publicados" deixa só o que foi ao ar', () => {
    const r = cronogramaDoMes({ items: its, states: { [its[0].i]: st(7) }, cliente: 'Marina', ano: 2026, mes: 9, soPublicados: true })
    expect(r.linhas.map(l => l.id)).toEqual([its[0].i])
  })
})
