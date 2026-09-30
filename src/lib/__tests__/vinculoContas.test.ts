import { describe, expect, it } from 'vitest'
import { pontuar, sugerirVinculos, type ContaMeta } from '../vinculoContas'

const conta = (pageId: string, pageName: string, igUsername: string | null = null): ContaMeta =>
  ({ pageId, pageName, igUserId: igUsername ? `ig${pageId}` : null, igUsername })

describe('vínculo de contas da Meta com clientes', () => {
  it('casa pelo nome da Página ou pelo @, ignorando acento e pontuação', () => {
    expect(pontuar("Frango d'Água", conta('1', 'Frango dAgua Oficial'))).toBeGreaterThanOrEqual(2)
    expect(pontuar('Luthita', conta('2', 'Loja XPTO', 'luthita.oficial'))).toBe(2)
    expect(pontuar('Padaria R.A', conta('3', 'Padaria RA'))).toBe(3)
  })

  it('nome curto não sugere nada — "RA" não pode casar com qualquer coisa', () => {
    expect(pontuar('RA', conta('4', 'Padaria RA'))).toBe(0)
  })

  it('uma conta, um cliente; o par mais forte escolhe primeiro', () => {
    const r = sugerirVinculos(['Pesq', 'Padaria R.A', 'Padaria Luanda'], [
      conta('10', 'Padaria RA', 'padaria.ra'),
      conta('11', 'Padaria Luanda'),
      conta('12', 'PESQ Pesca Esportiva', 'pesq'),
    ])
    expect(r).toEqual({ '10': 'Padaria R.A', '11': 'Padaria Luanda', '12': 'Pesq' })
  })

  it('na dúvida (empate), deixa sem sugestão', () => {
    const r = sugerirVinculos(['Padaria Centro', 'Padaria Norte'], [conta('20', 'Padaria Grupo')])
    expect(r).toEqual({})
  })
})
