import { describe, it, expect } from 'vitest'
import { aplicarMudancaAtribuicoes } from '../paineis'

describe('Produção grava só o que mudou', () => {
  it('a tela com o mapa de quando abriu não apaga o que outra pessoa atribuiu', () => {
    const daTela = { 1: 'pn_k' }
    const noNavegador = { 1: 'pn_k', 2: 'pn_e', 3: 'pn_j' } // chegou do servidor depois
    const depois = { 1: 'pn_k', 10: 'pn_j' }               // atribuí o card 10
    expect(aplicarMudancaAtribuicoes(noNavegador, daTela, depois)).toEqual({ 1: 'pn_k', 2: 'pn_e', 3: 'pn_j', 10: 'pn_j' })
  })
  it('tirar do painel e trocar de gaveta valem', () => {
    const antes = { 1: 'pn_k', 2: 'pn_e' }
    const depois = { 2: 'pn_j' }
    expect(aplicarMudancaAtribuicoes({ 1: 'pn_k', 2: 'pn_e', 5: 'pn_x' }, antes, depois)).toEqual({ 2: 'pn_j', 5: 'pn_x' })
  })
})
