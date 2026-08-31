import { describe, expect, it } from 'vitest'
import {
  atribuirCards, contarPorPainel, criarPainel, editarPainel, painelDoCard, paineisDaArea,
  removerPainel, reordenarPainel, semearPadrao, PAINEIS_VAZIO,
  type Atribuicoes, type PaineisStore,
} from '../paineis'

function comPaineis(): { store: PaineisStore; kaique: string; prado: string } {
  let store = criarPainel(PAINEIS_VAZIO, 'vid', 'Kaique', 'kaique')
  store = criarPainel(store, 'vid', 'Prado')
  const [kaique, prado] = paineisDaArea(store, 'vid')
  return { store, kaique: kaique.id, prado: prado.id }
}

describe('gavetas por área', () => {
  it('Vídeo e Design não se misturam', () => {
    let store = criarPainel(PAINEIS_VAZIO, 'vid', 'Kaique')
    store = criarPainel(store, 'des', 'Diones')
    expect(paineisDaArea(store, 'vid').map(p => p.nome)).toEqual(['Kaique'])
    expect(paineisDaArea(store, 'des').map(p => p.nome)).toEqual(['Diones'])
  })

  it('a estreia traz três painéis, e só uma vez', () => {
    const store = semearPadrao(PAINEIS_VAZIO, 'des')
    expect(paineisDaArea(store, 'des').map(p => p.nome)).toEqual(['Designer 1', 'Designer 2', 'Designer 3'])
    const denovo = semearPadrao(store, 'des')
    expect(paineisDaArea(denovo, 'des')).toHaveLength(3)
  })

  it('não semeia por cima de painel que a equipe já criou', () => {
    const meu = criarPainel(PAINEIS_VAZIO, 'des', 'Diones')
    const store = semearPadrao(meu, 'des')
    expect(paineisDaArea(store, 'des').map(p => p.nome)).toEqual(['Diones'])
  })

  it('renomear é o caso de uso principal: "Editor 1" vira "Kaique"', () => {
    const store = semearPadrao(PAINEIS_VAZIO, 'vid')
    const alvo = paineisDaArea(store, 'vid')[0]
    const renomeado = editarPainel(store, alvo.id, { nome: 'Kaique', membro: 'kaique' })
    const p = paineisDaArea(renomeado, 'vid')[0]
    expect(p.nome).toBe('Kaique')
    expect(p.membro).toBe('kaique')
  })

  it('nome vazio não apaga o nome que estava lá', () => {
    const { store, prado } = comPaineis()
    expect(editarPainel(store, prado, { nome: '   ' }).paineis.find(p => p.id === prado)?.nome).toBe('Prado')
  })

  it('desvincular o membro é possível (string vazia)', () => {
    const { store, kaique } = comPaineis()
    expect(editarPainel(store, kaique, { membro: '' }).paineis.find(p => p.id === kaique)?.membro).toBeUndefined()
  })

  it('ordem muda pela tela, sem mexer em código', () => {
    const { store, kaique, prado } = comPaineis()
    const trocado = reordenarPainel(store, 'vid', kaique, 1)
    expect(paineisDaArea(trocado, 'vid').map(p => p.id)).toEqual([prado, kaique])
  })
})

describe('excluir painel', () => {
  it('devolve os cards para "sem painel" — não apaga trabalho', () => {
    const { store, prado } = comPaineis()
    const atrib: Atribuicoes = { 1: prado, 2: prado, 3: 'outro' }
    const r = removerPainel(store, atrib, prado)
    expect(paineisDaArea(r.store, 'vid').map(p => p.nome)).toEqual(['Kaique'])
    expect(r.atrib).toEqual({ 3: 'outro' })
  })
})

describe('de quem é o card', () => {
  it('a atribuição explícita manda', () => {
    const { store, kaique, prado } = comPaineis()
    const atrib = atribuirCards({}, [10], prado)
    // O card é do Kaique pelo responsible, mas alguém o moveu para o Prado.
    expect(painelDoCard(10, { responsible: 'kaique' }, atrib, paineisDaArea(store, 'vid'))).toBe(prado)
    expect(kaique).not.toBe(prado)
  })

  it('sem atribuição, o painel vinculado a um membro adota o que já é dele', () => {
    const { store, kaique } = comPaineis()
    expect(painelDoCard(11, { responsible: 'kaique' }, {}, paineisDaArea(store, 'vid'))).toBe(kaique)
  })

  it('card de ninguém fica sem painel — e continua no board', () => {
    const { store } = comPaineis()
    expect(painelDoCard(12, { responsible: undefined }, {}, paineisDaArea(store, 'vid'))).toBeNull()
  })

  it('atribuição para painel que não existe mais não sequestra o card', () => {
    const { store } = comPaineis()
    expect(painelDoCard(13, undefined, { 13: 'pn_fantasma' }, paineisDaArea(store, 'vid'))).toBeNull()
  })

  it('desatribuir devolve para "sem painel"', () => {
    const { prado } = comPaineis()
    const atrib = atribuirCards({ 14: prado }, [14], null)
    expect(atrib[14]).toBeUndefined()
  })
})

describe('contagem que aparece na gaveta', () => {
  it('soma explícitos, herdados e sobras', () => {
    const { store, kaique, prado } = comPaineis()
    const paineis = paineisDaArea(store, 'vid')
    const atrib = atribuirCards({}, [3], prado)
    const contagem = contarPorPainel([
      { itemId: 1, state: { responsible: 'kaique' } },   // herdado
      { itemId: 2, state: { responsible: 'kaique' } },   // herdado
      { itemId: 3, state: { responsible: 'kaique' } },   // movido para o Prado
      { itemId: 4, state: { responsible: undefined } },  // sem dono
    ], atrib, paineis)

    expect(contagem.porPainel[kaique]).toBe(2)
    expect(contagem.porPainel[prado]).toBe(1)
    expect(contagem.semPainel).toBe(1)
    expect(contagem.total).toBe(4)
  })
})
