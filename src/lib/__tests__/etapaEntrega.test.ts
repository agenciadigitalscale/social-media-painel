import { describe, it, expect } from 'vitest'
import { naEtapa } from '../etapaEntrega'
import type { Status } from '../../types'

const card = (s: Status) => ({ status: s })

describe('naEtapa', () => {
  it('todos aceita qualquer etapa', () => {
    for (const s of [2, 3, 6, 7] as Status[]) expect(naEtapa(card(s), 'todos')).toBe(true)
  })
  it('finalizados = aprovado em diante; revisão e ajuste ficam fora', () => {
    for (const s of [3, 4, 5, 9, 7] as Status[]) expect(naEtapa(card(s), 'finalizados')).toBe(true)
    for (const s of [2, 6, 8] as Status[]) expect(naEtapa(card(s), 'finalizados')).toBe(false)
  })
  it('etapas isoladas', () => {
    expect(naEtapa(card(6), 'ajuste')).toBe(true)
    expect(naEtapa(card(7), 'ajuste')).toBe(false)
    expect(naEtapa(card(8), 'revisao')).toBe(true)
    expect(naEtapa(card(7), 'publicado')).toBe(true)
    expect(naEtapa(card(9), 'programado')).toBe(true)
  })
  it('registro manual conta como finalizado e não aparece em etapa de card', () => {
    const m = { status: 3 as Status, manual: true }
    expect(naEtapa(m, 'finalizados')).toBe(true)
    expect(naEtapa(m, 'todos')).toBe(true)
    expect(naEtapa(m, 'aprovado')).toBe(false)
    expect(naEtapa(m, 'publicado')).toBe(false)
  })
})
