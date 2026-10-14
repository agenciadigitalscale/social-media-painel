import { describe, it, expect } from 'vitest'
import { nomeCliente, resolverCliente, clientesComConteudoNoMes, visiveisNoMes, conferirClientes } from '../clientes'
import type { ContentItem } from '../../types'
import type { CarteiraStore } from '../planejamentoMes'

let seq = 0
const card = (c: string, mes: number, dia = 10): ContentItem =>
  ({ i: ++seq, c, dt: new Date(2026, mes, dia, 12), tp: 'Reel', n: 'x', s: 0, custom: true })

// O caso real: saiu em maio, seguiu com conteúdo em set/out, voltou com outro nome.
const carteira: CarteiraStore = {
  Compostela: { tipo: 'mensal', saida: '2026-05' },
  Aventur: { tipo: 'mensal' },
  'Cerise Flores': { tipo: 'mensal', entrada: '2026-10' },
}
const ids = ['Compostela', 'Aventur', 'Cerise Flores', 'Compostela Grill']
const items = [card('Compostela', 8), card('Compostela', 9), card('Compostela', 9), card('Aventur', 9), card('Fazendinha', 9), card('LuzioPan', 3)]

describe('cadastro oficial de clientes', () => {
  it('o nome mostrado vem do cadastro; o id nunca muda', () => {
    const c2: CarteiraStore = { Compostela: { tipo: 'mensal', nome: 'Compostela Grill' } }
    expect(nomeCliente('Compostela', c2)).toBe('Compostela Grill')
    expect(nomeCliente('Aventur', c2)).toBe('Aventur')
  })

  it('id, nome de exibição ou apelido levam ao MESMO id', () => {
    const c2: CarteiraStore = { Compostela: { tipo: 'mensal', nome: 'Compostela Grill', apelidos: ['Compostela Restaurante'] } }
    const so = ['Compostela', 'Aventur']
    expect(resolverCliente('compostela', so, c2)).toBe('Compostela')
    expect(resolverCliente('COMPOSTELA GRILL ', so, c2)).toBe('Compostela')
    expect(resolverCliente('Compostela Restaurante', so, c2)).toBe('Compostela')
    expect(resolverCliente('Outro', so, c2)).toBeUndefined()
  })

  it('cliente fora da carteira COM conteúdo no mês continua visível, com aviso', () => {
    const out = visiveisNoMes(ids, carteira, clientesComConteudoNoMes(items, {}, 2026, 9), 2026, 9)
    expect(out).toContainEqual({ id: 'Compostela', foraDaCarteira: true })
    expect(out).toContainEqual({ id: 'Aventur', foraDaCarteira: false })
  })

  it('fora da carteira e SEM conteúdo não aparece; quem ainda vai entrar também não', () => {
    const out = visiveisNoMes(ids, carteira, clientesComConteudoNoMes(items, {}, 2026, 7), 2026, 7).map(v => v.id)
    expect(out).not.toContain('Compostela')
    expect(out).not.toContain('Cerise Flores')
  })

  it('conferência aponta órfão, conteúdo fora da carteira e duplicado — sem corrigir', () => {
    const r = conferirClientes({ items, states: {}, ids, arquivados: ['LuzioPan'], carteira })
    expect(r.orfaos).toEqual([{ nome: 'Fazendinha', cards: 1 }])
    expect(r.foraDaCarteira).toEqual([{ id: 'Compostela', nome: 'Compostela', meses: ['2026-09', '2026-10'], cards: 3 }])
    expect(r.duplicados).toContainEqual({ a: 'Compostela', b: 'Compostela Grill', motivo: 'nomes parecidos' })
  })

  it('arquivado de propósito não é órfão', () => {
    const r = conferirClientes({ items, states: {}, ids, arquivados: ['LuzioPan'], carteira })
    expect(r.orfaos.map(o => o.nome)).not.toContain('LuzioPan')
  })
})
