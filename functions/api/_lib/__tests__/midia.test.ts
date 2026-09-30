import { describe, expect, it } from 'vitest'
import { chaveValida, nomeSeguro } from '../../midia'

describe('anexos do painel (R2)', () => {
  it('nome seguro: sem barra, acento ou caractere de controle', () => {
    expect(nomeSeguro('Promoção de sexta.JPG')).toBe('Promocao-de-sexta.JPG')
    expect(nomeSeguro('../../etc/passwd')).toBe('etcpasswd')
    expect(nomeSeguro('')).toBe('arquivo')
  })

  it('só serve chave de anexo com UUID — nada fora da pasta, nada de ..', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000'
    expect(chaveValida(`anexos/${uuid}/arte.jpg`)).toBe(true)
    expect(chaveValida(`drive/${uuid}`)).toBe(false)
    expect(chaveValida(`anexos/${uuid}/../drive/x`)).toBe(false)
    expect(chaveValida('anexos/nao-e-uuid/arte.jpg')).toBe(false)
    expect(chaveValida(null)).toBe(false)
  })
})
