import { describe, it, expect } from 'vitest'
import { protegerAtribuicoes } from '../atribuicoesGuard'

const banco = JSON.stringify(Object.fromEntries(Array.from({ length: 40 }, (_, i) => [String(1000 + i), i % 2 ? 'pn_k' : 'pn_j'])))

describe('sm_card_painel no servidor', () => {
  it('cópia velha que perdeu muitas atribuições: as que sumiram voltam', () => {
    const velha = JSON.stringify({ 1000: 'pn_j', 1001: 'pn_k', 9999: 'pn_k' })
    const r = protegerAtribuicoes(banco, velha)
    const out = JSON.parse(r.value)
    expect(r.restaurados).toBe(38)
    expect(Object.keys(out)).toHaveLength(41)
    expect(out[9999]).toBe('pn_k')
  })
  it('tirar poucos cards do painel e trocar de gaveta passam', () => {
    const atual = JSON.parse(banco)
    delete atual[1000]; delete atual[1001]
    atual[1002] = 'pn_novo'
    const novo = JSON.stringify(atual)
    expect(protegerAtribuicoes(banco, novo)).toEqual({ value: novo, restaurados: 0 })
  })
  it('sem valor no banco ou JSON estranho: grava como veio', () => {
    expect(protegerAtribuicoes(null, '{"1":"a"}').restaurados).toBe(0)
    expect(protegerAtribuicoes(banco, 'lixo').value).toBe('lixo')
  })
})
