import { describe, expect, it } from 'vitest'
import { artesDoDesigner, CONTA_POR_ENTREGA, contarEntre, entregasPorDia, resumoDesigner } from '../designerProducao'
import type { ContentItem, ItemState } from '../../types'

const item = (i: number): ContentItem => ({ i, c: 'Kátia', dt: new Date('2026-11-01'), tp: 'Reel', n: `Vídeo ${i}`, s: 0 })
const st = (over: Partial<ItemState>): ItemState => ({ status: 0, title: '', link: '', caption: '', notes: '', assignedEditor: 'emanuelly', ...over })
const D = (dia: number, h = 10) => new Date(2026, 10, dia, h).getTime()
const rev = (ts: number) => ({ user: 'emanuelly', action: '→ Revisão', ts })
const aj = (ts: number) => ({ user: 'arthur', action: '→ Ajuste', ts })

function linhas(states: Record<number, ItemState>, ids: number[]) {
  return entregasPorDia(artesDoDesigner(ids.map(item), states, {}, { paineis: [] } as never, 'emanuelly', new Set(), CONTA_POR_ENTREGA), states)
}

describe('quantos fez por dia (caso Manu, 16/11: fez 5, contava 3)', () => {
  it('ajuste reenviado conta no dia em que foi reenviado, marcado como ajuste', () => {
    const states = {
      1: st({ status: 2, history: [rev(D(14)), aj(D(15)), rev(D(16, 10))] }),
      2: st({ status: 2, history: [rev(D(16, 11))] }),
    }
    const l = linhas(states, [1, 2])
    expect(contarEntre(l, D(16, 0), D(16, 23))).toBe(2)
    expect(contarEntre(l, D(14, 0), D(14, 23))).toBe(1)
    expect(l.filter(x => x.dia && x.ajuste).map(x => x.itemId)).toEqual([1])
    expect(contarEntre(l, D(1, 0), D(30, 23))).toBe(3)
  })

  it('várias idas e voltas no MESMO dia contam 1', () => {
    const l = linhas({ 1: st({ status: 2, history: [rev(D(16, 9)), aj(D(16, 10)), rev(D(16, 11)), aj(D(16, 12)), rev(D(16, 13))] }) }, [1])
    expect(contarEntre(l, D(16, 0), D(16, 23))).toBe(1)
  })

  it('card que voltou para produção mantém o dia em que entregou', () => {
    const l = linhas({ 1: st({ status: 1, history: [rev(D(10))] }) }, [1])
    expect(contarEntre(l, D(10, 0), D(10, 23))).toBe(1)
  })

  it('em ajuste conta 1 vez na fila, mesmo com várias linhas de dia', () => {
    const l = linhas({ 1: st({ status: 6, history: [rev(D(10)), aj(D(11)), rev(D(12)), aj(D(13))] }) }, [1])
    expect(resumoDesigner(l, new Date(2026, 10, 13)).correcao).toBe(1)
  })
})
