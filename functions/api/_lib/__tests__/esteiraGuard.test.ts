import { describe, it, expect } from 'vitest'
import { protegerEsteira } from '../esteiraGuard'

const card = (id: string, extra: Record<string, unknown> = {}) => ({
  id, tipo: 'fixo', origem: 'automatico', clienteId: id, mes: '2026-11', status: 'a_fazer',
  responsavel: 'kerges', entradaEm: 100, atualizadoEm: 200, ...extra,
})
const banco = (n = 12): Record<string, Record<string, unknown>> => Object.fromEntries(Array.from({ length: n }, (_, i) => {
  const id = `auto:2026-11:C${i}`
  return [id, card(id, { link: `https://docs.google.com/d/${i}`, quantidade: 8, observacao: 'ok' })]
}))
const aplicar = (atual: object, novo: object) => JSON.parse(protegerEsteira(JSON.stringify(atual), JSON.stringify(novo)).value)

describe('sm_esteira_roteiros: cópia velha não apaga link (2026-10-26)', () => {
  it('cards RECRIADOS vazios (navegador sem os dados) não substituem os que têm link', () => {
    const atual = banco()
    const recriado = Object.fromEntries(Object.keys(atual).map(id => [id, card(id, { entradaEm: 9999, atualizadoEm: 9999 })]))
    const out = aplicar(atual, recriado)
    expect(Object.values(out).every(c => (c as { link?: string }).link)).toBe(true)
    expect(out).toEqual(atual)
  })
  it('cópia mais velha sem link não tira o link; edição mais nova que apaga, apaga', () => {
    const atual = banco(1); const id = Object.keys(atual)[0]
    expect(aplicar(atual, { [id]: card(id, { atualizadoEm: 150 }) })[id].link).toBe(atual[id].link)
    expect(aplicar(atual, { [id]: card(id, { atualizadoEm: 300 }) })[id].link).toBeUndefined()
  })
  it('mudança legítima passa: mover para Prontos, colar link novo', () => {
    const atual = banco(3); const id = Object.keys(atual)[0]
    const novo = { ...atual, [id]: { ...atual[id], status: 'pronto', link: 'https://x/novo', atualizadoEm: 500 } }
    expect(aplicar(atual, novo)).toEqual(novo)
  })
  it('card sumido volta; excluir de vez 1 card feito à mão continua valendo', () => {
    const atual = { ...banco(3), rot_a: card('rot_a', { origem: 'manual' }) }
    const { rot_a: _x, ...semManual } = atual
    expect(aplicar(atual, semManual)).toEqual(semManual)
    expect(Object.keys(aplicar(atual, {}))).toHaveLength(4)
  })
  it('sem valor no banco ou valor inválido: passa como veio', () => {
    expect(protegerEsteira(null, '{"a":1}').value).toBe('{"a":1}')
    expect(protegerEsteira('x', '{"a":1}').value).toBe('{"a":1}')
  })
})
