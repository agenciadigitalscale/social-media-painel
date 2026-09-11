import { describe, it, expect } from 'vitest'
import { normalizeCatalog } from '../studio-catalog'

const boom = {
  id: 'up_boom', kind: 'Efeitos sonoros', title: 'Boom',
  category: 'Impacto', ext: '.mp3', url: 'https://exemplo/boom.mp3',
}
const neon = {
  id: 'up_neon', kind: 'Presets', title: 'Neon',
  preset: { name: 'Neon', style: { filter: 'Vívido' } },
}

describe('normalizeCatalog', () => {
  it('aceita manifesto válido (string JSON ou objeto)', () => {
    expect(normalizeCatalog({ packs: [boom, neon] }).packs).toHaveLength(2)
    expect(normalizeCatalog(JSON.stringify({ packs: [boom] })).packs).toHaveLength(1)
  })

  it('degrada para {packs:[]} em entrada malformada', () => {
    expect(normalizeCatalog(null).packs).toEqual([])
    expect(normalizeCatalog('nao-e-json').packs).toEqual([])
    expect(normalizeCatalog({ nope: 1 }).packs).toEqual([])
    expect(normalizeCatalog({ packs: 'x' }).packs).toEqual([])
  })

  it('descarta pacote ruim sem derrubar os bons', () => {
    const packs = normalizeCatalog({ packs: [
      boom,
      { id: 'x', kind: 'Foguetes', title: 't', ext: '.mp3', url: 'https://a/b' }, // tipo desconhecido
      { id: 'y', kind: 'Músicas', title: 't', ext: '.exe', url: 'https://a/b' },   // extensão inválida
      { id: 'z', kind: 'Músicas', title: 't', ext: '.mp3', url: 'file:///etc' },   // URL não http
      { id: '', kind: 'Músicas', title: 't', ext: '.mp3', url: 'https://a/b' },     // sem id
      neon,
    ] }).packs
    expect(packs.map(p => p.id)).toEqual(['up_boom', 'up_neon'])
  })

  it('descarta preset embutido inválido', () => {
    const packs = normalizeCatalog({ packs: [
      { id: 'p1', kind: 'Presets', title: 't', preset: { name: '', style: { filter: 'x' } } },
      { id: 'p2', kind: 'Presets', title: 't', preset: { name: 'ok', style: {} } },
    ] }).packs
    expect(packs).toEqual([])
  })

  it('deduplica por id (o primeiro vence)', () => {
    const packs = normalizeCatalog({ packs: [boom, { ...boom, title: 'Outro' }] }).packs
    expect(packs).toHaveLength(1)
    expect(packs[0].title).toBe('Boom')
  })
})
