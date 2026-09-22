import { describe, it, expect } from 'vitest'
import { buildQueue, exportCodeFor } from '../studio-queue'

describe('exportCodeFor', () => {
  it('gera 4 chars do alfabeto Crockford e é estável', () => {
    const code = exportCodeFor(2007)
    expect(code).toHaveLength(4)
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}$/)
    expect(exportCodeFor(2007)).toBe(code)  // determinístico
  })
})

const custom = [
  { i: 2007, c: 'Lorenzeti', tp: 'Reel', n: 'Vídeo Chuveiro', s: 1 },
  { i: 3012, c: 'Kátia', tp: 'Reel', n: 'Receita', s: 0 },
  { i: 4001, c: 'X', tp: 'Reel', n: 'Já publicado', s: 7 },   // status fora da fila
  { i: 5001, c: 'Y', tp: 'Story', n: 'Story qualquer', s: 1 },// tipo fora da fila
  { i: 6001, c: 'Z', tp: 'Reel', n: '', s: 1 },               // sem título
]

describe('buildQueue', () => {
  it('devolve só os Reels em produção/a-fazer, com selo', () => {
    const q = buildQueue(custom, {})
    expect(q.map(t => t.card_id)).toEqual(['2007', '3012'])
    expect(q[0]).toEqual({ card_id: '2007', cliente: 'Lorenzeti', titulo: 'Vídeo Chuveiro', selo: exportCodeFor(2007), status: 1 })
  })

  it('inclui Reel em Ajuste solicitado (6) com o motivo do cliente', () => {
    const q = buildQueue(custom, { '4001': 6 }, { notaById: { '4001': 'Trocar a música' } })
    const ajuste = q.find(t => t.card_id === '4001')
    expect(ajuste).toMatchObject({ card_id: '4001', status: 6, nota: 'Trocar a música' })
  })

  it('nota só vale para status 6 — em produção não carrega motivo', () => {
    const q = buildQueue(custom, { '2007': 1 }, { notaById: { '2007': 'não deveria aparecer' } })
    expect(q.find(t => t.card_id === '2007')?.nota).toBeUndefined()
  })

  it('status do sm_states vence o s inicial do card', () => {
    // 2007 foi publicado (7) segundo o sm_states → sai da fila; 4001 voltou p/ produção
    const q = buildQueue(custom, { '2007': 7, '4001': 1 })
    expect(q.map(t => t.card_id)).toEqual(['3012', '4001'])
  })

  it('degrada com entrada inválida', () => {
    expect(buildQueue(null, {})).toEqual([])
    expect(buildQueue('nao-array', {})).toEqual([])
    expect(buildQueue([{}, 3, null], {})).toEqual([])
  })

  it('respeita tipos/status customizados', () => {
    const q = buildQueue(custom, {}, { types: ['Story'], statuses: [1] })
    expect(q.map(t => t.card_id)).toEqual(['5001'])
  })
})
