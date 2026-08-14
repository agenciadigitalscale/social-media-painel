import { describe, expect, it } from 'vitest'
import { computeTodayBuckets, countRealLate, daysLate, hasBeenTouched, isRealLate, isRealWork, realLateItems } from '../todaySignals'
import type { ContentItem, ItemState, Status } from '../../types'

const HOJE = new Date(2026, 7, 12, 10, 0, 0)

/**
 * Datas LOCAIS, como o `data.ts` monta (`new Date(2026, 5, dia)`).
 * `new Date('2026-08-10')` seria meia-noite UTC e, num fuso negativo, cairia no
 * dia anterior — o teste acusaria um dia a mais de atraso sem nenhum bug.
 */
const d = (ano: number, mes: number, dia: number, hora = 12) => new Date(ano, mes - 1, dia, hora)

const item = (i: number, dt: Date, s: Status = 0): ContentItem =>
  ({ i, c: 'Lareiras Grill', dt, tp: 'Reel', n: 'Conteúdo ' + i, s })

const st = (p: Partial<ItemState>): ItemState =>
  ({ status: 0, title: '', link: '', caption: '', notes: '', ...p })

describe('hasBeenTouched', () => {
  it('sem estado nenhum, ninguém tocou', () => {
    expect(hasBeenTouched(undefined)).toBe(false)
  })

  it('estado vazio em "A fazer" não conta como tocado', () => {
    // É o formato de um item semeado que só existe porque alguma migração
    // criou a linha — não houve trabalho.
    expect(hasBeenTouched(st({}))).toBe(false)
  })

  it('qualquer status além de "A fazer" é toque', () => {
    expect(hasBeenTouched(st({ status: 1 }))).toBe(true)
    expect(hasBeenTouched(st({ status: 7 }))).toBe(true)
  })

  it('campo preenchido conta, mesmo em "A fazer"', () => {
    expect(hasBeenTouched(st({ title: 'Reel do dia dos pais' }))).toBe(true)
    expect(hasBeenTouched(st({ responsible: 'kaique' }))).toBe(true)
    expect(hasBeenTouched(st({ history: [{ action: 'criado', ts: 1 }] }))).toBe(true)
  })
})

describe('computeTodayBuckets', () => {
  it('separa atraso de verdade de plano que não aconteceu', () => {
    // Este é o caso medido em produção: 452 itens semeados de meses fechados,
    // nunca tocados, aparecendo como "atrasados" e afogando os reais.
    const items = [
      item(1, d(2026, 6, 10)),  // semeado, nunca tocado
      item(2, d(2026, 6, 11)),  // semeado, nunca tocado
      item(3, d(2026, 7, 20)),  // começou e parou
    ]
    const states = { 3: st({ status: 1, title: 'Em produção' }) }

    const b = computeTodayBuckets(items, states, HOJE)
    expect(b.late.map(i => i.i)).toEqual([3])
    expect(b.neverStarted).toBe(2)
  })

  it('o que vence hoje não é atraso', () => {
    const b = computeTodayBuckets([item(1, d(2026, 8, 12))], { 1: st({ status: 1 }) }, HOJE)
    expect(b.today.map(i => i.i)).toEqual([1])
    expect(b.late).toHaveLength(0)
  })

  it('publicado nunca é atraso, por mais velho que seja', () => {
    const b = computeTodayBuckets([item(1, d(2026, 5, 1))], { 1: st({ status: 7 }) }, HOJE)
    expect(b.late).toHaveLength(0)
    expect(b.neverStarted).toBe(0)
  })

  it('enviado e ajuste vão para lados OPOSTOS — a bola está em campos diferentes', () => {
    // Enviado: o cliente é quem deve responder, não é atraso da equipe.
    // Ajuste pedido: a bola VOLTOU, e alguém de fora está esperando.
    const items = [item(1, d(2026, 7, 1)), item(2, d(2026, 7, 2))]
    const states = { 1: st({ status: 4 }), 2: st({ status: 6 }) }
    const b = computeTodayBuckets(items, states, HOJE)
    expect(b.withClient.map(i => i.i)).toEqual([1])
    expect(b.needsFix.map(i => i.i)).toEqual([2])
    expect(b.late).toHaveLength(0)
  })

  it('cada card aparece em UM balde só', () => {
    // Numa tela de celular, o mesmo card em três seções é pior que não ter tela.
    const items = [item(1, d(2026, 7, 1)), item(2, d(2026, 7, 2)), item(3, d(2026, 7, 3)), item(4, d(2026, 8, 12))]
    const states = {
      1: st({ status: 6 }), 2: st({ status: 4 }), 3: st({ status: 2 }), 4: st({ status: 1 }),
    }
    const b = computeTodayBuckets(items, states, HOJE)
    const todos = [...b.needsFix, ...b.late, ...b.today, ...b.inReview, ...b.withClient].map(i => i.i)
    expect(todos).toHaveLength(new Set(todos).size)
    expect(todos.sort()).toEqual([1, 2, 3, 4])
  })

  it('revisão interna aparece à parte — é a equipe que trava', () => {
    const b = computeTodayBuckets([item(1, d(2026, 7, 1))], { 1: st({ status: 2 }) }, HOJE)
    expect(b.inReview.map(i => i.i)).toEqual([1])
  })

  it('ordena por data: o mais velho primeiro', () => {
    const items = [item(1, d(2026, 7, 20)), item(2, d(2026, 6, 5)), item(3, d(2026, 7, 1))]
    const states = { 1: st({ status: 1 }), 2: st({ status: 1 }), 3: st({ status: 1 }) }
    expect(computeTodayBuckets(items, states, HOJE).late.map(i => i.i)).toEqual([2, 3, 1])
  })

  it('lista vazia não quebra nem inventa número', () => {
    const b = computeTodayBuckets([], {}, HOJE)
    expect(b).toMatchObject({ late: [], today: [], withClient: [], inReview: [], neverStarted: 0 })
  })
})

describe('daysLate', () => {
  it('conta em dias inteiros', () => {
    expect(daysLate(item(1, d(2026, 8, 10)), HOJE)).toBe(2)
    expect(daysLate(item(1, d(2026, 8, 12)), HOJE)).toBe(0)
  })

  it('hora do dia não muda a conta', () => {
    // Sem normalizar para o começo do dia, um item das 23h "atrasaria" menos
    // que um das 8h da mesma data.
    expect(daysLate(item(1, d(2026, 8, 10, 23)), HOJE)).toBe(2)
    expect(daysLate(item(1, d(2026, 8, 10, 0)), HOJE)).toBe(2)
  })
})

describe('isRealLate / countRealLate — o número das telas de desktop', () => {
  it('item semeado de mês fechado que ninguém tocou NÃO é atraso', () => {
    // O caso que motivou tudo: 452 destes faziam o painel abrir anunciando
    // "452 atrasados", e o alerta de pipeline ficava vermelho para sempre.
    expect(isRealLate(item(1001, d(2026, 6, 10)), undefined, HOJE)).toBe(false)
  })

  it('item que alguém começou e parou É atraso', () => {
    expect(isRealLate(item(1002, d(2026, 6, 10)), st({ status: 1 }), HOJE)).toBe(true)
  })

  it('publicado nunca é atraso, mesmo com data velha', () => {
    expect(isRealLate(item(1003, d(2026, 6, 10)), st({ status: 7 }), HOJE)).toBe(false)
  })

  it('item de hoje não é atraso — a comparação é por DIA, não por instante', () => {
    // HOJE são 10h; um card de hoje às 12h não pode contar como atrasado.
    expect(isRealLate(item(1004, d(2026, 8, 12)), st({ status: 1 }), HOJE)).toBe(false)
  })

  it('item de amanhã não é atraso', () => {
    expect(isRealLate(item(1005, d(2026, 8, 13)), st({ status: 1 }), HOJE)).toBe(false)
  })

  it('status 8 legado conta como atraso — era o furo do `status < 7`', () => {
    // 8 é numericamente MAIOR que 7, então `< 7` deixava passar card parado
    // ali. Ainda existe 8 gravado no D1 de quem não abriu o painel desde a
    // migração 8→2.
    expect(isRealLate(item(1006, d(2026, 6, 10)), st({ status: 8 as Status }), HOJE)).toBe(true)
  })

  it('aprovado pelo cliente (5) ainda conta — não foi publicado', () => {
    expect(isRealLate(item(1007, d(2026, 6, 10)), st({ status: 5 }), HOJE)).toBe(true)
  })

  it('conta só os tocados no meio de uma pilha de fantasmas', () => {
    const items = [
      item(1, d(2026, 6, 1)), item(2, d(2026, 6, 2)), item(3, d(2026, 6, 3)),
      item(4, d(2026, 6, 4)), item(5, d(2026, 6, 5)),
    ]
    const states = { 3: st({ status: 1 }), 5: st({ responsible: 'kaique' }) }
    expect(countRealLate(items, states, HOJE)).toBe(2)
  })

  it('realLateItems devolve os mesmos itens que countRealLate conta', () => {
    const items = [item(1, d(2026, 6, 1)), item(2, d(2026, 6, 2))]
    const states = { 2: st({ status: 1 }) }
    const lista = realLateItems(items, states, HOJE)
    expect(lista.map(i => i.i)).toEqual([2])
    expect(lista.length).toBe(countRealLate(items, states, HOJE))
  })

  it('concorda com o balde `late`, tirando os status que viram balde próprio', () => {
    // As duas regras precisam contar a mesma coisa para o caso comum: se
    // divergirem, o celular e o desktop mostram números diferentes para a
    // mesma pergunta, e ninguém sabe em qual acreditar.
    const items = [item(1, d(2026, 6, 1)), item(2, d(2026, 6, 2)), item(3, d(2026, 6, 3))]
    const states = { 1: st({ status: 1 }), 2: st({ status: 3 }) }
    const buckets = computeTodayBuckets(items, states, HOJE)
    expect(buckets.late.map(i => i.i)).toEqual([1, 2])
    expect(countRealLate(items, states, HOJE)).toBe(2)
    expect(buckets.neverStarted).toBe(1)
  })
})

describe('isRealWork — card criado à mão nunca é fantasma', () => {
  const custom = (i: number, dt: Date): ContentItem =>
    ({ ...item(i, dt), custom: true })

  it('card custom sem estado nenhum ainda é trabalho', () => {
    // Sumir por excesso é pior que aparecer a mais: tira da tela um card que
    // alguém digitou e precisa fazer. A operação roda em 894 cards assim.
    expect(isRealWork(custom(9001, d(2026, 6, 10)), undefined)).toBe(true)
  })

  it('card custom com título vazio e status 0 continua sendo trabalho', () => {
    // É o buraco que o `hasBeenTouched` sozinho deixava: ele só acertava porque
    // o `addItem` grava `title` junto.
    expect(hasBeenTouched(st({}))).toBe(false)
    expect(isRealWork(custom(9002, d(2026, 6, 10)), st({}))).toBe(true)
  })

  it('card custom atrasado entra na contagem das telas', () => {
    expect(isRealLate(custom(9003, d(2026, 6, 10)), undefined, HOJE)).toBe(true)
  })

  it('card custom publicado não é atraso', () => {
    expect(isRealLate(custom(9004, d(2026, 6, 10)), st({ status: 7 }), HOJE)).toBe(false)
  })

  it('semeado sem estado continua fantasma — a distinção não foi perdida', () => {
    expect(isRealWork(item(1001, d(2026, 6, 10)), undefined)).toBe(false)
  })

  it('o balde `late` do celular conta o custom igual ao desktop', () => {
    // Se as duas regras divergirem, celular e desktop mostram números
    // diferentes para a mesma pergunta.
    const items = [custom(9005, d(2026, 6, 1)), item(1001, d(2026, 6, 2))]
    const buckets = computeTodayBuckets(items, {}, HOJE)
    expect(buckets.late.map(i => i.i)).toEqual([9005])
    expect(buckets.neverStarted).toBe(1)
    expect(countRealLate(items, {}, HOJE)).toBe(1)
  })
})
