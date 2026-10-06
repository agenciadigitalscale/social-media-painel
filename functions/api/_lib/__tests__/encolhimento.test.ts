import { describe, it, expect } from 'vitest'
import { encolhimentoSuspeito } from '../encolhimento'
import { reconcile } from '../../../../src/lib/reconcile'

const cards = (n: number) => Array.from({ length: n }, (_, k) => ({ i: k + 1, c: 'X', n: `card ${k + 1}` }))

describe('encolhimentoSuspeito', () => {
  it('recusa a lista de 1391 virando 1 (o incidente)', () => {
    expect(encolhimentoSuspeito(JSON.stringify(cards(1391)), JSON.stringify([{ i: 9999 }]))).toBe(true)
  })
  it('recusa mapa e lista de números esvaziando', () => {
    const mapa = Object.fromEntries(cards(155).map(c => [c.i, c]))
    expect(encolhimentoSuspeito(JSON.stringify(mapa), '{}')).toBe(true)
    expect(encolhimentoSuspeito(JSON.stringify(cards(980).map(c => c.i)), '[5]')).toBe(true)
  })
  it('deixa passar o dia a dia: criar, excluir alguns, chave pequena, chave nova', () => {
    expect(encolhimentoSuspeito(JSON.stringify(cards(100)), JSON.stringify(cards(101)))).toBe(false)
    expect(encolhimentoSuspeito(JSON.stringify(cards(100)), JSON.stringify(cards(60)))).toBe(false)
    expect(encolhimentoSuspeito(JSON.stringify(cards(10)), '[]')).toBe(false)
    expect(encolhimentoSuspeito(null, '[]')).toBe(false)
    expect(encolhimentoSuspeito('"texto"', '""')).toBe(false)
  })
  it('com base vazia a reconciliação soma o card novo aos 1391', () => {
    const servidor = cards(1391)
    const meu = [{ i: 9999, c: 'Y', n: 'novo' }]
    const r = reconcile([], meu, servidor) as unknown[]
    expect(r).toHaveLength(1392)
    expect(encolhimentoSuspeito(JSON.stringify(servidor), JSON.stringify(r))).toBe(false)
  })
})
