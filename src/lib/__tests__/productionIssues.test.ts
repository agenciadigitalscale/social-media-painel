import { describe, it, expect } from 'vitest'
import { computeProductionIssues } from '../productionIssues'
import type { ContentItem, ItemState, Status } from '../../types'
import type { MediaLinkMap } from '../mediaLinks'
import type { ReadyAutomationMap } from '../readyAutomation'

/**
 * A área "Problemas para resolver" só é útil se for ESTREITA. Uma lista que
 * acusa todo card sem arquivo vira ruído que ninguém abre — e o card que
 * realmente travou a entrega se esconde no meio. Estes testes fixam a fronteira.
 */

const item = (i: number, over: Partial<ContentItem> = {}): ContentItem => ({
  i, c: 'Lorenzeti', dt: new Date('2026-07-20'), tp: 'Reel', n: `Vídeo ${i}`, s: 1 as Status, ...over,
})

const state = (status: Status, over: Partial<ItemState> = {}): ItemState => ({
  status, title: '', link: '', caption: '', notes: '', ...over,
})

/** Vínculo completo e válido: mesmo item, mesmo cliente, na pasta Publicar. */
const linkOk = (itemId: number, clientId = 'Lorenzeti'): MediaLinkMap => ({
  [itemId]: {
    id: `l${itemId}`, itemId, clientId, fileId: 'drive:abc',
    url: 'https://drive.google.com/file/d/abc/view',
    folderStage: 'publicar', source: 'drive', confirmed: true,
    linkedAt: Date.now(), updatedAt: Date.now(),
  },
})

const ready = (phase: string, over: Record<string, unknown> = {}): ReadyAutomationMap => ({
  1: {
    itemId: 1, phase, message: '', startedAt: 0, updatedAt: Date.now(), ...over,
  } as ReadyAutomationMap[number],
})

describe('computeProductionIssues', () => {
  it('card em Revisão sem prévia é problema — a revisão não teria o que revisar', () => {
    const out = computeProductionIssues([item(1)], { 1: state(2) }, {}, {})
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('review_without_file')
    expect(out[0].action).toBe('link_manually')
  })

  it('card em Revisão COM prévia válida não aparece', () => {
    const out = computeProductionIssues([item(1)], { 1: state(2) }, linkOk(1), {})
    expect(out).toHaveLength(0)
  })

  it('card em Produção sem arquivo NÃO é problema — ainda está sendo feito', () => {
    const out = computeProductionIssues([item(1)], { 1: state(1) }, {}, {})
    expect(out).toHaveLength(0)
  })

  it('card "A fazer" e card já publicado ficam de fora', () => {
    const items = [item(1), item(2)]
    const states = { 1: state(0), 2: state(7) }
    expect(computeProductionIssues(items, states, {}, {})).toHaveLength(0)
  })

  it('vínculo de OUTRO cliente não conta como prévia válida', () => {
    const out = computeProductionIssues([item(1)], { 1: state(2) }, linkOk(1, 'Outro Cliente'), {})
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('review_without_file')
  })

  it('esteira ambígua vira escolha manual, com a contagem de candidatos', () => {
    const out = computeProductionIssues(
      [item(1)], { 1: state(1) }, {},
      ready('ambiguous', { candidates: [{ id: 'a', name: 'a.mp4', mimeType: 'video/mp4' }, { id: 'b', name: 'b.mp4', mimeType: 'video/mp4' }] }),
    )
    expect(out[0].kind).toBe('ambiguous')
    expect(out[0].action).toBe('pick_file')
    expect(out[0].message).toContain('2 arquivos')
  })

  it('arquivo que não abre pede novo vínculo e mostra o motivo', () => {
    const out = computeProductionIssues(
      [item(1)], { 1: state(1) }, {},
      ready('invalid', { error: 'sem permissão de acesso ao arquivo no Drive' }),
    )
    expect(out[0].kind).toBe('preview_failed')
    expect(out[0].detail).toContain('sem permissão')
  })

  it('pasta não configurada explica isso em vez de "erro desconhecido"', () => {
    const out = computeProductionIssues([item(1)], { 1: state(1) }, {}, ready('error', { error: 'no_folder' }))
    expect(out[0].kind).toBe('scan_error')
    expect(out[0].message).toContain('não está configurada')
    expect(out[0].action).toBe('retry_detect')
  })

  it('cada card entra uma vez só, mesmo cumprindo dois critérios', () => {
    // Em Revisão sem prévia E com a esteira inválida: o motivo mais específico vence.
    const out = computeProductionIssues([item(1)], { 1: state(2) }, {}, ready('invalid', { error: 'x' }))
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('preview_failed')
  })

  it('board limpo devolve lista vazia', () => {
    const items = [item(1), item(2, { i: 2 })]
    const states = { 1: state(1), 2: state(2) }
    expect(computeProductionIssues(items, states, linkOk(2), {})).toHaveLength(0)
  })
})
