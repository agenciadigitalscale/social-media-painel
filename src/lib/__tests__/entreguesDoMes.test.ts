import { describe, it, expect } from 'vitest'
import { entreguesDoMes } from '../entreguesDoMes'
import type { ContentItem, ItemState, Status } from '../../types'

let seq = 0
const card = (tp: ContentItem['tp'], dia: number, mes = 9): ContentItem =>
  ({ i: ++seq, c: 'Aventur', dt: new Date(2026, mes, dia, 12), tp, n: `${tp} ${dia}`, s: 0, custom: true })
const st = (status: Status, extra: Partial<ItemState> = {}): ItemState => ({ status, title: '', link: '', caption: '', notes: '', ...extra })
const ehVideo = (it: ContentItem) => it.tp === 'Reel'

describe('Entregues no mês (Minha esteira)', () => {
  const publicado = card('Reel', 10), enviado = card('Reel', 12), producao = card('Reel', 14)
  const deSetembro = card('Reel', 28, 8), arte = card('Post', 11), semCarimbo = card('Reel', 20)
  const states: Record<number, ItemState> = {
    [publicado.i]: st(7, { publishedAt: new Date(2026, 9, 11, 10).getTime() }),
    [enviado.i]: st(4, { sentToClientAt: new Date(2026, 9, 9, 15).getTime() }),
    [producao.i]: st(1),
    // entregue em 30/09, publicado em outubro: conta em SETEMBRO (mês da entrega)
    [deSetembro.i]: st(7, { sentToClientAt: new Date(2026, 8, 30, 9).getTime(), publishedAt: new Date(2026, 9, 2).getTime() }),
    [arte.i]: st(7, { publishedAt: new Date(2026, 9, 12).getTime() }),
    [semCarimbo.i]: st(3),
  }
  const lista = entreguesDoMes([publicado, enviado, producao, deSetembro, arte, semCarimbo], states, 2026, 9, ehVideo)

  it('só o que passou da Revisão, do quadro e do mês da entrega', () => {
    expect(lista.map(e => e.item.i).sort()).toEqual([publicado.i, enviado.i, semCarimbo.i].sort())
  })
  it('a data é a da entrega (o carimbo mais antigo), mais recente primeiro', () => {
    expect(lista[0].item.i).toBe(semCarimbo.i)
    expect(new Date(lista.find(e => e.item.i === publicado.i)!.quando).getDate()).toBe(11)
    expect(new Date(lista.find(e => e.item.i === enviado.i)!.quando).getDate()).toBe(9)
  })
  it('sem carimbo de entrega vale o mês da postagem', () => {
    expect(lista.find(e => e.item.i === semCarimbo.i)!.comCarimbo).toBe(false)
  })
})
