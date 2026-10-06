import { describe, it, expect } from 'vitest'
import { diasPreferidosNoMes, gerarVagas, metaDoMes, metaEfetiva, segundoTipo, semanaForte, type PadraoCliente } from '../padraoEditorial'
import { comPreferencias, excecaoDeMeta, garantirMes, restaurarMes, comVagas } from '../planejamentoMes'
import { adicionarEtiqueta, corDaEtiqueta, editarEtiqueta, etiquetasConhecidas, removerEtiqueta, renomearNoCard, COR_NEUTRA } from '../etiquetas'

const plano = { reelsPerMonth: 6, postsPerMonth: 6 }
const base = (extra: Partial<PadraoCliente> = {}): PadraoCliente => ({ dias: { Reel: [1, 5], Post: [2, 4], Feed: [] }, plano: '6+6', ...extra })

describe('Cliente: segundo tipo (Design ou Feed)', () => {
  it('sem escolha, Design; com só Feed configurado, Feed', () => {
    expect(segundoTipo(base())).toBe('Post')
    expect(segundoTipo({ dias: { Reel: [1], Post: [], Feed: [3] } })).toBe('Feed')
    expect(segundoTipo(base({ segundo: 'Feed' }))).toBe('Feed')
  })
  it('a meta do plano vai para o segundo tipo do cliente', () => {
    expect(metaDoMes(base(), plano)).toEqual({ Reel: 6, Post: 6, Feed: 0 })
    expect(metaDoMes(base({ segundo: 'Feed' }), plano)).toEqual({ Reel: 6, Post: 0, Feed: 6 })
  })
})

describe('Meta: exceção de um mês', () => {
  it('outubro com exceção, novembro volta ao padrão', () => {
    const p = base({ meta: { Reel: 6, Post: 6 } })
    expect(metaEfetiva({ Reel: 8 }, p, plano)).toEqual({ Reel: 8, Post: 6, Feed: 0 })
    expect(metaEfetiva(undefined, p, plano)).toEqual({ Reel: 6, Post: 6, Feed: 0 })
  })
  it('criar o mês (distribuir/mexer em preferência) NÃO congela a meta', () => {
    const padroes = { X: base({ meta: { Reel: 6, Post: 6 } }) }
    const prefs = garantirMes({}, padroes, 'X', 2026, 9)
    expect(excecaoDeMeta(prefs, 'X', 2026, 9)).toBeUndefined()
    const v = comVagas({}, padroes, 'X', 2026, 9, [{ dia: 3, tipo: 'Reel' }])
    expect(excecaoDeMeta(v, 'X', 2026, 9)).toBeUndefined()
  })
  it('salvar as preferências do mês com meta é exceção só daquele mês', () => {
    const prefs = comPreferencias({}, 'X', 2026, 9, { ...base(), meta: { Reel: 8 } })
    expect(excecaoDeMeta(prefs, 'X', 2026, 9)).toEqual({ Reel: 8 })
    expect(excecaoDeMeta(prefs, 'X', 2026, 10)).toBeUndefined()
  })
  it('Restaurar padrão refaz as preferências e mantém a exceção de meta', () => {
    const padroes = { X: base() }
    let prefs = comPreferencias({}, 'X', 2026, 9, { ...base(), meta: { Reel: 8 } })
    prefs = comVagas(prefs, padroes, 'X', 2026, 9, [{ dia: 1, tipo: 'Feed' }])
    const r = restaurarMes(prefs, padroes, 'X', 2026, 9)
    expect(r.X['2026-10'].vagas).toBeUndefined()
    expect(excecaoDeMeta(r, 'X', 2026, 9)).toEqual({ Reel: 8 })
  })
})

describe('6+6: forte/fraca alternando e invertendo', () => {
  // Outubro/2026 começa numa quinta: semana 0 = 1–3, semana 1 = 4–10…
  it('padrão: começa forte; comecaFraca inverte', () => {
    const d1 = new Date(2026, 9, 2, 12), d2 = new Date(2026, 9, 6, 12)
    expect([semanaForte({}, d1), semanaForte({}, d2)]).toEqual([true, false])
    expect([semanaForte({ comecaFraca: true }, d1), semanaForte({ comecaFraca: true }, d2)]).toEqual([false, true])
  })
  it('semana fraca usa 1 dia; invertido, as fracas e fortes trocam', () => {
    const normal = diasPreferidosNoMes(base(), 'Reel', 2026, 9).map(d => d.getDate())
    const inv = diasPreferidosNoMes(base({ comecaFraca: true }), 'Reel', 2026, 9).map(d => d.getDate())
    expect(normal).not.toEqual(inv)
    expect(inv).toContain(9) // sexta da semana 1, forte quando invertido
  })
  it('8+8 / 4+4 usam TODAS as ocorrências dos dias, sem forte/fraca', () => {
    const v = gerarVagas({ dias: { Reel: [1, 5], Post: [], Feed: [] }, plano: '8+8' }, 2026, 9).filter(x => x.tipo === 'Reel')
    expect(v).toHaveLength(9) // 4 segundas + 5 sextas em outubro/2026
  })
})

describe('Etiquetas: base global', () => {
  it('criar, sem duplicar (maiúscula/minúscula)', () => {
    const b = adicionarEtiqueta(adicionarEtiqueta([], 'Urgente', '#FF5F6D'), 'urgente')
    expect(b).toEqual([{ nome: 'Urgente', cor: '#FF5F6D' }])
  })
  it('editar nome e cor; não deixa colidir com outra', () => {
    const b = [{ nome: 'A', cor: '#111111' }, { nome: 'B', cor: '#222222' }]
    expect(editarEtiqueta(b, 'A', { nome: 'C', cor: '#333333' })[0]).toEqual({ nome: 'C', cor: '#333333' })
    expect(editarEtiqueta(b, 'A', { nome: 'b', cor: '#333333' })).toBe(b)
  })
  it('etiqueta antiga (só no card) aparece com cor neutra', () => {
    const k = etiquetasConhecidas([{ nome: 'A', cor: '#111111' }], ['a', 'Velha'])
    expect(k.map(e => e.nome)).toEqual(['A', 'Velha'])
    expect(corDaEtiqueta(k, 'velha')).toBe(COR_NEUTRA)
  })
  it('renomear no card e remover da base', () => {
    expect(renomearNoCard(['x', 'Y'], 'y', 'X')).toEqual(['x'])
    expect(removerEtiqueta([{ nome: 'A', cor: '#1' }], 'a')).toEqual([])
  })
})
