import { describe, it, expect } from 'vitest'
import { CLIENT_PALETTE, toBrandColor, brandClientColors, clientColorByIndex } from '../brandColors'
import { DS } from '../../theme'

describe('cores de cliente na identidade', () => {
  it('mantém cor da paleta, ignorando caixa', () => {
    expect(toBrandColor(DS.cyan)).toBe(DS.cyan)
    expect(toBrandColor(DS.accent.toLowerCase())).toBe(DS.accent.toLowerCase())
  })

  it('cor antiga fora da paleta (roxo, azul) vira laranja', () => {
    expect(toBrandColor('#7C5CFC')).toBe(DS.accent)
    expect(toBrandColor('#3B82F6')).toBe(DS.accent)
    expect(toBrandColor(undefined)).toBe(DS.accent)
  })

  it('traduz o mapa inteiro sem perder cliente', () => {
    expect(brandClientColors({ A: '#FF69B4', B: DS.amber })).toEqual({ A: DS.accent, B: DS.amber })
  })

  it('paleta não tem verde nem vermelho de status', () => {
    expect(CLIENT_PALETTE).not.toContain(DS.green)
    expect(CLIENT_PALETTE).not.toContain(DS.red)
  })

  it('índice sempre cai dentro da paleta', () => {
    for (const i of [0, 5, 6, 17, -1]) expect(CLIENT_PALETTE).toContain(clientColorByIndex(i))
  })
})
