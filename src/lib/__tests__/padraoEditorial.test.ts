import { describe, it, expect } from 'vitest'
import {
  gerarVagas, vagasLivres, distribuirNasVagas, metaDoMes, tipoDoPadrao, padraoDo, ROTULO_TIPO, corDoConteudo,
  type PadraoCliente,
} from '../padraoEditorial'

// Outubro/2026: segundas 5,12,19,26 · quartas 7,14,21,28 · sextas 2,9,16,23,30
const ANO = 2026, OUT = 9
const PADRAO: PadraoCliente = { dias: { Reel: [3], Post: [5], Feed: [] } }
const ANTES_DO_MES = new Date(2026, 8, 1)

describe('Vagas do mês — o padrão gera TODAS as ocorrências', () => {
  it('quarta e sexta: 4 quartas e 5 sextas em outubro, sem forçar 4/6/8', () => {
    const v = gerarVagas(PADRAO, ANO, OUT)
    expect(v.filter(x => x.tipo === 'Reel').map(x => x.dia)).toEqual([7, 14, 21, 28])
    expect(v.filter(x => x.tipo === 'Post').map(x => x.dia)).toEqual([2, 9, 16, 23, 30])
  })
  it('Reel segunda + sexta: toda segunda e toda sexta recebem vaga (9 no mês)', () => {
    const v = gerarVagas({ dias: { Reel: [1, 5], Post: [], Feed: [] } }, ANO, OUT)
    expect(v).toHaveLength(9)
  })
  it('sem padrão: nenhuma vaga (o mês começa vazio e a pessoa põe à mão)', () => {
    expect(gerarVagas(padraoDo({}, 'Novo'), ANO, OUT)).toEqual([])
  })
})

describe('Vaga ocupada some da tela e volta quando o conteúdo sai', () => {
  const v = gerarVagas(PADRAO, ANO, OUT)
  it('um Reel no dia 7 ocupa a vaga de Reel do dia 7', () => {
    const livres = vagasLivres(v, [{ dia: 7, tipo: 'Reel' }])
    expect(livres.some(x => x.dia === 7 && x.tipo === 'Reel')).toBe(false)
    expect(livres).toHaveLength(v.length - 1)
  })
  it('conteúdo de outro tipo não ocupa; conteúdo fora do padrão (Story) também não', () => {
    expect(vagasLivres(v, [{ dia: 7, tipo: 'Post' }, { dia: 7, tipo: null }])).toHaveLength(v.length)
  })
  it('sem ocupante, todas aparecem (a vaga nunca foi apagada)', () => {
    expect(vagasLivres(v, [])).toEqual(v)
  })
})

describe('Distribuir conteúdos — só vagas compatíveis, em ordem de data', () => {
  const livres = gerarVagas(PADRAO, ANO, OUT)
  it('cada conteúdo vai para a próxima vaga livre do tipo, cronologicamente', () => {
    const r = distribuirNasVagas({ ano: ANO, mes: OUT, livres, pedidos: { Reel: 2, Post: 3 }, hoje: ANTES_DO_MES })
    expect(r.plano.filter(p => p.tipo === 'Reel').map(p => p.data.getDate())).toEqual([7, 14])
    expect(r.plano.filter(p => p.tipo === 'Post').map(p => p.data.getDate())).toEqual([2, 9, 16])
    expect(r.sobra).toEqual({})
  })
  it('mês em curso: só de hoje em diante', () => {
    const r = distribuirNasVagas({ ano: ANO, mes: OUT, livres, pedidos: { Reel: 2 }, hoje: new Date(ANO, OUT, 15) })
    expect(r.plano.map(p => p.data.getDate())).toEqual([21, 28])
  })
  it('mais conteúdos que vagas: o que não cabe volta em "sobra" (nada vai para dia sem preferência)', () => {
    const r = distribuirNasVagas({ ano: ANO, mes: OUT, livres, pedidos: { Reel: 6 }, hoje: ANTES_DO_MES })
    expect(r.plano).toHaveLength(4)
    expect(r.sobra).toEqual({ Reel: 2 })
  })
  it('tipo sem vaga nenhuma (Feed): tudo sobra', () => {
    const r = distribuirNasVagas({ ano: ANO, mes: OUT, livres, pedidos: { Feed: 2 }, hoje: ANTES_DO_MES })
    expect(r.plano).toEqual([])
    expect(r.sobra).toEqual({ Feed: 2 })
  })
})

describe('Tipos, rótulos e cores', () => {
  it('a equipe chama de Reel · Design · Feed', () => {
    expect(ROTULO_TIPO).toEqual({ Reel: 'Reel', Post: 'Design', Feed: 'Feed' })
  })
  it('Carrossel conta como Design; Story fica fora do padrão', () => {
    expect(tipoDoPadrao('Carrossel')).toBe('Post')
    expect(tipoDoPadrao('Story')).toBeNull()
  })
  it('a mesma cor por tipo: Reel azul · Design amarelo · Feed roxo', () => {
    expect(corDoConteudo('Reel')).toBe('#4C8DFF')
    expect(corDoConteudo('Post')).toBe('#FFD400')
    expect(corDoConteudo('Carrossel')).toBe('#FFD400')
    expect(corDoConteudo('Feed')).toBe('#A78BFA')
  })
  it('meta vem do plano do cliente, e o padrão pode sobrescrever', () => {
    expect(metaDoMes(PADRAO, { postsPerMonth: 4, reelsPerMonth: 4 })).toEqual({ Reel: 4, Post: 4, Feed: 0 })
    expect(metaDoMes({ ...PADRAO, meta: { Reel: 6, Feed: 2 } }, { postsPerMonth: 4, reelsPerMonth: 4 })).toEqual({ Reel: 6, Post: 4, Feed: 2 })
  })
})
