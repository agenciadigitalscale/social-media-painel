import { describe, it, expect } from 'vitest'
import { atribuirAoMembro, type PaineisStore } from '../paineis'
import { donoDoCard } from '../access'

const STORE = {
  paineis: [
    { id: 'pn_k', area: 'vid', nome: 'Kaique', cor: '#fff', ordem: 0, membro: 'kaique' },
    { id: 'pn_j', area: 'des', nome: 'Jhones', cor: '#fff', ordem: 0, membro: 'jhones' },
  ],
  semeado: {},
} as unknown as PaineisStore

describe('trocar o profissional de um card', () => {
  it('quem tem gaveta na área recebe o card nela', () => {
    expect(atribuirAoMembro({}, STORE, [1], 'kaique', 'vid')).toEqual({ 1: 'pn_k' })
  })

  it('sócio (sem gaveta) tira o card da gaveta antiga — senão ela continuaria mandando', () => {
    const atrib = atribuirAoMembro({ 1: 'pn_k' }, STORE, [1], 'testa', 'vid')
    expect(atrib).toEqual({})
    // o chamador grava assignedEditor; aí o dono passa a ser o sócio
    expect(donoDoCard(1, { assignedEditor: 'testa' }, atrib, STORE)).toBe('testa')
  })

  it('gaveta é por área: designer não recebe card de vídeo na gaveta de design', () => {
    expect(atribuirAoMembro({}, STORE, [1], 'jhones', 'vid')).toEqual({})
  })
})
