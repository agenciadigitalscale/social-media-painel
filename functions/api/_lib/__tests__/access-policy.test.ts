import { describe, it, expect } from 'vitest'
import { contextoDe, decidirEscrita, usuarioDaSessao, valorVisivel, type ContextoPosse } from '../access-policy'

// Card 1 → Jhones (gaveta), card 2 → Julio (assignedEditor), card 3 → Kaique
// (responsible), card 4 → ninguém.
const ctx: ContextoPosse = contextoDe([
  { key: 'sm_states', value: JSON.stringify({
    '1': { status: 1 },
    '2': { status: 1, assignedEditor: 'julio' },
    '3': { status: 2, responsible: 'kaique' },
    '4': { status: 0 },
  }) },
  { key: 'sm_card_painel', value: JSON.stringify({ '1': 'pn_jh' }) },
  { key: 'sm_paineis', value: JSON.stringify({ paineis: [{ id: 'pn_jh', membro: 'jhones' }], semeado: {} }) },
])

const STATES = JSON.stringify({
  '1': { status: 1, title: 'arte do jhones' },
  '2': { status: 1, title: 'arte do julio', assignedEditor: 'julio' },
  '3': { status: 2, title: 'video do kaique', responsible: 'kaique' },
  '4': { status: 0, title: 'sem dono' },
})
const parse = (s: string | null) => JSON.parse(s ?? 'null')

describe('quem é o usuário da sessão', () => {
  it('login por senha e por Google', () => {
    expect(usuarioDaSessao('julio@role.dshub')).toBe('julio')
    expect(usuarioDaSessao('kaiquedigitalscale@gmail.com')).toBe('kaique')
    expect(usuarioDaSessao('estranho@gmail.com')).toBeNull()
    expect(usuarioDaSessao(null)).toBeNull()
  })
})

describe('leitura', () => {
  it('sócio e social veem tudo', () => {
    expect(valorVisivel('pradox', 'sm_states', STATES, null)).toBe(STATES)
    expect(valorVisivel('arthur', 'sm_states', STATES, null)).toBe(STATES)
  })

  it('Jhones NÃO vê nada do Julio — só o card dele', () => {
    expect(Object.keys(parse(valorVisivel('jhones', 'sm_states', STATES, ctx)))).toEqual(['1'])
    expect(Object.keys(parse(valorVisivel('julio', 'sm_states', STATES, ctx)))).toEqual(['2'])
    expect(Object.keys(parse(valorVisivel('kaique', 'sm_states', STATES, ctx)))).toEqual(['3'])
  })

  it('dados de sócio somem para qualquer outro cargo', () => {
    for (const u of ['arthur', 'kerges', 'jhones', 'kaique']) {
      expect(valorVisivel(u, 'sm_financeiro2_2026-09', '{"x":1}', ctx)).toBeNull()
      expect(valorVisivel(u, 'sm_designer_fechamento', '{"x":1}', ctx)).toBeNull()
      expect(valorVisivel(u, 'sm_customer_health', '{"x":1}', ctx)).toBeNull()
    }
    expect(valorVisivel('testa', 'sm_designer_fechamento', '{"x":1}', ctx)).toBe('{"x":1}')
  })

  it('isolado: cards criados, produção manual e log de atividade', () => {
    const custom = JSON.stringify([{ i: 1, c: 'A' }, { i: 2, c: 'B' }])
    expect(parse(valorVisivel('julio', 'sm_custom', custom, ctx))).toEqual([{ i: 2, c: 'B' }])
    const manual = JSON.stringify([{ id: 'a', autor: 'jhones' }, { id: 'b', autor: 'julio' }])
    expect(parse(valorVisivel('jhones', 'sm_producao_manual', manual, ctx))).toEqual([{ id: 'a', autor: 'jhones' }])
    expect(parse(valorVisivel('julio', 'sm_producao_excluir', '{"jhones":[1],"julio":[2]}', ctx))).toEqual({ julio: [2] })
    expect(valorVisivel('jhones', 'sm_activity_log', '[]', ctx)).toBeNull()
  })

  it('isolado sem contexto: fecha, nunca abre', () => {
    expect(valorVisivel('jhones', 'sm_states', STATES, null)).toBeNull()
  })
})

describe('gravação — NINGUÉM perde trabalho', () => {
  it('Jhones grava o mapa dele (sem os outros) e os cards dos outros continuam lá', () => {
    const doJhones = JSON.stringify({ '1': { status: 2, title: 'arte do jhones' } })
    const d = decidirEscrita('jhones', 'sm_states', doJhones, STATES, ctx)
    expect(d.tipo).toBe('mesclado')
    const v = parse(d.tipo === 'mesclado' ? d.valor : null)
    expect(v['1'].status).toBe(2)
    expect(v['2'].title).toBe('arte do julio')
    expect(v['3'].title).toBe('video do kaique')
    expect(v['4'].title).toBe('sem dono')
  })

  it('não dá para tomar card alheio escrevendo "eu" nele', () => {
    const golpe = JSON.stringify({ '2': { status: 7, assignedEditor: 'jhones' } })
    const d = decidirEscrita('jhones', 'sm_states', golpe, STATES, ctx)
    const v = parse(d.tipo === 'mesclado' ? d.valor : null)
    expect(v['2']).toEqual({ status: 1, title: 'arte do julio', assignedEditor: 'julio' })
  })

  it('lista de cards criados: troca só os meus, mantém ordem e os alheios', () => {
    const atual = JSON.stringify([{ i: 1, n: 'velho' }, { i: 2, n: 'julio' }, { i: 3, n: 'kaique' }])
    const meu = JSON.stringify([{ i: 1, n: 'novo' }])
    const d = decidirEscrita('jhones', 'sm_custom', meu, atual, ctx)
    expect(parse(d.tipo === 'mesclado' ? d.valor : null)).toEqual([{ i: 1, n: 'novo' }, { i: 2, n: 'julio' }, { i: 3, n: 'kaique' }])
  })

  it('produção manual: a lista do Jhones não apaga a do Julio', () => {
    const atual = JSON.stringify([{ id: 'a', autor: 'jhones' }, { id: 'b', autor: 'julio' }])
    const d = decidirEscrita('jhones', 'sm_producao_manual', JSON.stringify([{ id: 'c', autor: 'jhones' }]), atual, ctx)
    expect(parse(d.tipo === 'mesclado' ? d.valor : null)).toEqual([{ id: 'b', autor: 'julio' }, { id: 'c', autor: 'jhones' }])
  })

  it('isolado não mexe em atribuição, exclusão, log nem dado de sócio', () => {
    for (const key of ['sm_card_painel', 'sm_paineis', 'sm_deleted', 'sm_activity_log', 'sm_designer_fechamento']) {
      expect(decidirEscrita('julio', key, '{}', '{}', ctx).tipo).toBe('ignorar')
    }
  })

  it('social grava normalmente (inclusive atribuir), mas não dado de sócio', () => {
    expect(decidirEscrita('arthur', 'sm_card_painel', '{}', '{}', ctx).tipo).toBe('normal')
    expect(decidirEscrita('arthur', 'sm_states', '{}', '{}', ctx).tipo).toBe('normal')
    expect(decidirEscrita('arthur', 'sm_financeiro', '{}', '{}', ctx).tipo).toBe('ignorar')
  })

  it('sócio e sessão desconhecida seguem o caminho de sempre', () => {
    expect(decidirEscrita('testa', 'sm_designer_fechamento', '{}', '{}', ctx).tipo).toBe('normal')
    expect(decidirEscrita(null, 'sm_states', '{}', '{}', ctx).tipo).toBe('normal')
  })
})

describe('esteira única no servidor — quem produz não aprova', () => {
  it('Jhones leva o card dele para a Revisão, mas não consegue aprová-lo', () => {
    const paraRevisao = decidirEscrita('jhones', 'sm_states', JSON.stringify({ '1': { status: 2, title: 'arte do jhones' } }), STATES, ctx)
    expect(JSON.parse(paraRevisao.tipo === 'mesclado' ? paraRevisao.valor : '{}')['1'].status).toBe(2)

    const emRevisao = JSON.stringify({ ...JSON.parse(STATES), '1': { status: 2, title: 'arte do jhones' } })
    const aprovar = decidirEscrita('jhones', 'sm_states', JSON.stringify({ '1': { status: 3, title: 'arte do jhones (editada)' } }), emRevisao, ctx)
    const v = JSON.parse(aprovar.tipo === 'mesclado' ? aprovar.valor : '{}')['1']
    expect(v.status).toBe(2)                         // status bloqueado
    expect(v.title).toBe('arte do jhones (editada)') // o resto da edição passa
  })

  it('Social Media aprova normalmente', () => {
    expect(decidirEscrita('arthur', 'sm_states', JSON.stringify({ '1': { status: 3 } }), STATES, ctx).tipo).toBe('normal')
  })
})
