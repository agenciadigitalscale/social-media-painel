import { describe, it, expect } from 'vitest'
import { reconcile } from '../reconcile'

/**
 * Cada teste aqui é um caso que já custava trabalho perdido em produção. O
 * cenário base: dois navegadores partem do mesmo estado, cada um faz a sua
 * alteração, e o segundo a salvar precisa preservar o que o primeiro fez.
 */

const cardA = { i: 1, c: 'Padaria Sol', n: 'Reel institucional' }
const cardB = { i: 2, c: 'Padaria Sol', n: 'Post da semana' }
const cardC = { i: 3, c: 'Luthita',     n: 'Vídeo do chuveiro' }

describe('listas — sm_custom, os cards criados à mão', () => {
  it('dois cards criados ao mesmo tempo: os DOIS sobrevivem', () => {
    const base   = [cardA]
    const meu    = [cardA, cardB]   // Kaique criou o B
    const server = [cardA, cardC]   // Jhones já salvou o C

    const r = reconcile(base, meu, server) as typeof base
    expect(r.map(x => x.i).sort()).toEqual([1, 2, 3])
  })

  it('o que eu apaguei some, mesmo com o outro tendo salvo depois', () => {
    const base   = [cardA, cardB]
    const meu    = [cardA]              // apaguei o B
    const server = [cardA, cardB, cardC]

    const r = reconcile(base, meu, server) as typeof base
    expect(r.map(x => x.i).sort()).toEqual([1, 3])
  })

  it('editar e apagar ao mesmo tempo: o trabalho do outro vence a minha remoção', () => {
    const base   = [cardA, cardB]
    const meu    = [cardA]                                    // apaguei o B
    const server = [cardA, { ...cardB, n: 'Post reescrito' }] // ele reescreveu o B

    const r = reconcile(base, meu, server) as typeof base
    expect(r.find(x => x.i === 2)?.n).toBe('Post reescrito')
  })

  it('minha edição vence a versão do servidor quando só eu mexi', () => {
    const base   = [cardA]
    const meu    = [{ ...cardA, n: 'Reel renomeado' }]
    const server = [cardA, cardC]

    const r = reconcile(base, meu, server) as typeof base
    expect(r.find(x => x.i === 1)?.n).toBe('Reel renomeado')
    expect(r.find(x => x.i === 3)).toBeDefined()
  })

  it('lista de números (sm_deleted) também reconcilia', () => {
    expect(reconcile([1, 2], [1, 2, 3], [1, 2, 4])).toEqual([1, 2, 4, 3])
  })

  it('desfazer uma exclusão não é engolido pela mescla', () => {
    // Base já sem o card; eu desfiz e ele voltou. O servidor não tem.
    const r = reconcile([cardA], [cardA, cardB], [cardA]) as typeof cardA[]
    expect(r.map(x => x.i)).toEqual([1, 2])
  })
})

describe('mapas — sm_states, sm_media_links, financeiro', () => {
  it('cada um mexeu num item: nenhum se perde', () => {
    const base   = { 1: { status: 1 }, 2: { status: 1 } }
    const meu    = { 1: { status: 2 }, 2: { status: 1 } }
    const server = { 1: { status: 1 }, 2: { status: 5 } }

    expect(reconcile(base, meu, server)).toEqual({ 1: { status: 2 }, 2: { status: 5 } })
  })

  it('entrada nova do servidor sobrevive à minha gravação', () => {
    const r = reconcile({ 1: 'a' }, { 1: 'b' }, { 1: 'a', 9: 'novo' })
    expect(r).toEqual({ 1: 'b', 9: 'novo' })
  })

  it('o que eu removi sai do resultado', () => {
    expect(reconcile({ 1: 'a', 2: 'b' }, { 1: 'a' }, { 1: 'a', 2: 'b' })).toEqual({ 1: 'a' })
  })
})

describe('quando não dá para reconciliar, fica o meu (comportamento antigo)', () => {
  it('sem base — não dá para saber o que apaguei', () => {
    expect(reconcile(null, { a: 1 }, { b: 2 })).toEqual({ a: 1 })
  })

  it('formatos diferentes dos dois lados', () => {
    expect(reconcile([], { a: 1 }, [1, 2])).toEqual({ a: 1 })
  })

  it('lista sem id reconhecível', () => {
    expect(reconcile([['x']], [['x'], ['y']], [['x'], ['z']])).toEqual([['x'], ['y']])
  })

  it('nada mudou do outro lado', () => {
    expect(reconcile({ a: 1 }, { a: 2 }, { a: 2 })).toEqual({ a: 2 })
  })
})
