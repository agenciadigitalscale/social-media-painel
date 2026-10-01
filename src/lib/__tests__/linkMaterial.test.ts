import { describe, expect, it } from 'vitest'
import { mensagemDoMaterial, normalizarLinkMaterial } from '../linkMaterial'
import { normalizarHora } from '../programacao'
import type { ContentItem, ItemState } from '../../types'

describe('normalizarLinkMaterial', () => {
  it('aceita link completo', () => {
    expect(normalizarLinkMaterial(' https://drive.google.com/file/d/abc/view ')).toBe('https://drive.google.com/file/d/abc/view')
  })
  it('completa o protocolo de link colado sem ele', () => {
    expect(normalizarLinkMaterial('drive.google.com/file/d/abc')).toBe('https://drive.google.com/file/d/abc')
  })
  it('recusa texto que não é link', () => {
    expect(normalizarLinkMaterial('video final')).toBeNull()
    expect(normalizarLinkMaterial('abc')).toBeNull()
    expect(normalizarLinkMaterial('')).toBeNull()
  })
})

describe('mensagemDoMaterial', () => {
  const item = { i: 1, c: 'Lorenzeti', n: 'Chuveiro', tp: 'Reel', dt: new Date(), s: 0 } as ContentItem
  it('é a mensagem padrão do cliente com o link colado', () => {
    const msg = mensagemDoMaterial(item, { status: 3, title: 'Vídeo Chuveiro' } as ItemState, 'https://drive.google.com/x')
    expect(msg).toContain('Olá, Lorenzeti!')
    expect(msg).toContain('*Vídeo Chuveiro* está pronto para aprovação.')
    expect(msg).toContain('https://drive.google.com/x')
  })
  it('avisa quando é tráfego pago', () => {
    const msg = mensagemDoMaterial(item, { status: 3, isTraffic: true } as ItemState, 'https://x.com/a')
    expect(msg).toContain('tráfego pago')
    expect(msg).toContain('*Chuveiro*')
  })
})

describe('normalizarHora', () => {
  it.each([
    ['1437', '14:37'], ['14:37', '14:37'], ['9', '09:00'], ['930', '09:30'],
    ['9:5', '09:05'], ['14h30', '14:30'], ['14h', '14:00'], ['0', '00:00'],
  ])('%s → %s', (entrada, saida) => {
    expect(normalizarHora(entrada)).toBe(saida)
  })
  it.each(['24', '2460', '12345', 'abc', '', '14:3x'])('recusa %s', entrada => {
    expect(normalizarHora(entrada)).toBeNull()
  })
})
