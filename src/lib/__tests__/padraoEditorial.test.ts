import { describe, it, expect } from 'vitest'
import {
  planejarDistribuicao, planejarRestauracao, substituiveisNoRestaurar, metaDoMes, tipoDoPadrao, padraoDo,
  type PadraoCliente,
} from '../padraoEditorial'
import type { ContentItem, ItemState, Status } from '../../types'

// Outubro/2026: quartas 7,14,21,28 · sextas 2,9,16,23,30
const ANO = 2026, OUT = 9
const PADRAO: PadraoCliente = { dias: { Reel: [3], Post: [5], Feed: [] } }
const META_4_4 = { Reel: 4, Post: 4, Feed: 0 }
const ANTES_DO_MES = new Date(2026, 8, 1)
const item = (i: number, tp: ContentItem['tp'], dia: number, s: Status = 0): ContentItem =>
  ({ i, c: 'Cliente', dt: new Date(ANO, OUT, dia, 12), tp, n: `c${i}`, s, custom: true })

describe('Padrão Editorial — distribuir o mês', () => {
  it('plano 4+4: Reel nas quartas e Post nas sextas', () => {
    const plano = planejarDistribuicao({ ano: ANO, mes: OUT, padrao: PADRAO, meta: META_4_4, existentes: [], hoje: ANTES_DO_MES })
    const reels = plano.filter(p => p.tipo === 'Reel')
    const posts = plano.filter(p => p.tipo === 'Post')
    expect(reels).toHaveLength(4)
    expect(posts).toHaveLength(4)
    expect(reels.every(p => p.data.getDay() === 3)).toBe(true)
    expect(posts.every(p => p.data.getDay() === 5)).toBe(true)
    expect(new Set(posts.map(p => p.data.getDate())).size).toBe(4) // sem repetir dia
  })

  it('só cria o que FALTA: o que já existe no mês (inclusive exceção manual) conta', () => {
    // um Reel manual numa segunda (exceção ao padrão) + um Post na sexta 9
    const existentes = [item(1, 'Reel', 5), item(2, 'Post', 9)]
    const plano = planejarDistribuicao({ ano: ANO, mes: OUT, padrao: PADRAO, meta: META_4_4, existentes, hoje: ANTES_DO_MES })
    expect(plano.filter(p => p.tipo === 'Reel')).toHaveLength(3)
    const posts = plano.filter(p => p.tipo === 'Post')
    expect(posts).toHaveLength(3)
    expect(posts.some(p => p.data.getDate() === 9)).toBe(false) // não repete o dia ocupado
  })

  it('mês em curso: prefere de hoje em diante (não nasce card atrasado)', () => {
    const hoje = new Date(ANO, OUT, 15)
    const plano = planejarDistribuicao({ ano: ANO, mes: OUT, padrao: PADRAO, meta: { Reel: 2, Post: 0, Feed: 0 }, existentes: [], hoje })
    expect(plano.map(p => p.data.getDate())).toEqual([21, 28])
  })

  it('sem padrão configurado: espalha de segunda a sexta', () => {
    const plano = planejarDistribuicao({ ano: ANO, mes: OUT, padrao: padraoDo({}, 'Novo'), meta: { Reel: 3, Post: 0, Feed: 0 }, existentes: [], hoje: ANTES_DO_MES })
    expect(plano).toHaveLength(3)
    expect(plano.every(p => p.data.getDay() >= 1 && p.data.getDay() <= 5)).toBe(true)
  })

  it('meta maior que os dias do padrão: completa repetindo os dias preferidos', () => {
    const plano = planejarDistribuicao({ ano: ANO, mes: OUT, padrao: PADRAO, meta: { Reel: 6, Post: 0, Feed: 0 }, existentes: [], hoje: ANTES_DO_MES })
    expect(plano).toHaveLength(6)
    expect(plano.every(p => p.data.getDay() === 3)).toBe(true)
  })

  it('meta vem do plano do cliente, e o padrão pode sobrescrever', () => {
    expect(metaDoMes(PADRAO, { postsPerMonth: 4, reelsPerMonth: 4 })).toEqual({ Reel: 4, Post: 4, Feed: 0 })
    expect(metaDoMes({ ...PADRAO, meta: { Reel: 6, Feed: 2 } }, { postsPerMonth: 4, reelsPerMonth: 4 })).toEqual({ Reel: 6, Post: 4, Feed: 2 })
  })

  it('Carrossel conta como Post Design; Story fica fora do padrão', () => {
    expect(tipoDoPadrao('Carrossel')).toBe('Post')
    expect(tipoDoPadrao('Story')).toBeNull()
  })
})

describe('Restaurar padrão — sem apagar pauta', () => {
  const vazio: Record<number, ItemState> = {}
  it('devolve os "A fazer" para os dias do padrão e cria só o que falta', () => {
    // Reel com pauta numa segunda (exceção manual) + Post numa terça
    const itens = [item(1, 'Reel', 5), item(2, 'Post', 6)]
    const r = planejarRestauracao({ ano: ANO, mes: OUT, padrao: PADRAO, meta: META_4_4, itensDoMes: itens, states: vazio, hoje: ANTES_DO_MES })
    expect(r.mover.map(m => m.id).sort()).toEqual([1, 2])
    expect(r.mover.find(m => m.id === 1)!.data.getDay()).toBe(3) // Reel → quarta
    expect(r.mover.find(m => m.id === 2)!.data.getDay()).toBe(5) // Post → sexta
    expect(r.criar.filter(c => c.tipo === 'Reel')).toHaveLength(3)
    expect(r.criar.filter(c => c.tipo === 'Post')).toHaveLength(3)
  })

  it('o que já está em produção não se mexe e conta para a meta', () => {
    const itens = [item(1, 'Reel', 5, 1), item(2, 'Reel', 6, 0)]
    const r = planejarRestauracao({ ano: ANO, mes: OUT, padrao: PADRAO, meta: { Reel: 2, Post: 0, Feed: 0 }, itensDoMes: itens, states: vazio, hoje: ANTES_DO_MES })
    expect(r.mover.map(m => m.id)).toEqual([2])
    expect(r.criar).toHaveLength(0)
  })

  it('mais "A fazer" que a meta: nenhum some — todos ganham dia do padrão', () => {
    const itens = [item(1, 'Reel', 5), item(2, 'Reel', 6), item(3, 'Reel', 8)]
    const r = planejarRestauracao({ ano: ANO, mes: OUT, padrao: PADRAO, meta: { Reel: 1, Post: 0, Feed: 0 }, itensDoMes: itens, states: vazio, hoje: ANTES_DO_MES })
    expect(r.mover).toHaveLength(3)
    expect(r.mover.every(m => m.data.getDay() === 3)).toBe(true)
  })
})

describe('Restaurar padrão', () => {
  it('substitui só o que está em "A fazer"; o que já entrou em produção fica', () => {
    const itens = [item(1, 'Reel', 7, 0), item(2, 'Reel', 14, 1), item(3, 'Post', 9, 0)]
    const states: Record<number, ItemState> = { 2: { status: 1 as Status, title: '', link: '', caption: '', notes: '' } }
    expect(substituiveisNoRestaurar(itens, states).map(i => i.i)).toEqual([1, 3])
  })
})
