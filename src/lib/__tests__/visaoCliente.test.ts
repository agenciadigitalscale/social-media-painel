import { describe, it, expect } from 'vitest'
import { visaoDoCliente, seloDoCliente, proximaGravacao } from '../visaoCliente'
import type { ContentItem, ItemState, Status } from '../../types'

const AGORA = new Date(2026, 9, 2, 10).getTime() // 02/10/2026
const dia = (d: number, m = 9) => new Date(2026, m, d, 12)
let seq = 1
const item = (tp: ContentItem['tp'], dt: Date, s: Status = 0, c = 'Alto'): ContentItem => ({ i: seq++, c, dt, tp, n: `${tp} ${seq}`, s, custom: true })
const st = (status: Status, extra: Partial<ItemState> = {}): ItemState => ({ status, title: '', link: '', caption: '', notes: '', ...extra })

const META = { Reel: 6, Post: 6 }

describe('visão do cliente', () => {
  it('conta publicados do mês contra a meta e separa o que não é Reel/Post', () => {
    const its = [item('Reel', dia(1), 7), item('Feed', dia(1), 7), item('Story', dia(1), 7), item('Reel', dia(1, 8), 7)]
    const v = visaoDoCliente({ items: its, states: {}, cliente: 'Alto', ano: 2026, mes: 9, meta: META, agora: AGORA })
    expect(v.meta.Reel.publicados).toBe(1)
    expect(v.meta.Post.publicados).toBe(1)
    expect(v.publicadosNoMes).toBe(3)
    expect(v.extrasNoMes).toBe(1)
  })

  it('estoque = aprovado, com o cliente, cliente ok e programado', () => {
    const its = [item('Reel', dia(5), 3), item('Reel', dia(6), 4), item('Post', dia(7), 9), item('Post', dia(8), 1)]
    const v = visaoDoCliente({ items: its, states: {}, cliente: 'Alto', ano: 2026, mes: 9, meta: META, agora: AGORA })
    expect(v.estoque).toEqual({ Reel: 2, Post: 1 })
  })

  it('cobertura para no primeiro conteúdo que ainda não está pronto', () => {
    const a = item('Reel', dia(4), 3), b = item('Reel', dia(8), 5), c = item('Reel', dia(11), 1), d = item('Reel', dia(15), 3)
    const v = visaoDoCliente({ items: [a, b, c, d], states: {}, cliente: 'Alto', ano: 2026, mes: 9, meta: META, agora: AGORA })
    expect(v.cobertura.Reel.cobertoAte).toBe(dia(8).getTime())
    expect(v.cobertura.Reel.proximaSemCobertura).toBe(dia(11).getTime())
    expect(v.cobertura.Post.temPauta).toBe(false)
  })

  it('entrega vencida em produção é urgente; publicação perto ainda em produção é risco', () => {
    const atrasado = item('Reel', dia(20), 1)
    const perto = item('Post', dia(4), 1)
    const longe = item('Post', dia(25), 1)
    const states = { [atrasado.i]: st(1, { deliveryDate: dia(22, 8).getTime() }) }
    const v = visaoDoCliente({ items: [atrasado, perto, longe], states, cliente: 'Alto', ano: 2026, mes: 9, meta: META, agora: AGORA })
    expect(v.alertas.map(a => [a.nivel, a.itemId])).toEqual([['urgente', atrasado.i], ['risco', perto.i]])
    expect(v.alertas[0].detalhe).toContain('22/09')
    expect(v.alertas[1].detalhe).toContain('faltam 2 dias')
    expect(seloDoCliente(v.alertas)).toBe('urgente')
  })

  it('publicado e programado não geram alerta, nem pauta vencida', () => {
    const its = [item('Reel', dia(1), 7), item('Reel', dia(3), 9), item('Reel', dia(20, 8), 3)]
    const v = visaoDoCliente({ items: its, states: {}, cliente: 'Alto', ano: 2026, mes: 9, meta: META, agora: AGORA })
    expect(v.alertas).toEqual([])
    expect(seloDoCliente(v.alertas)).toBe('emdia')
  })

  it('a data do Programado manda na postagem', () => {
    const p = item('Reel', dia(1), 9)
    const states = { [p.i]: st(9, { programadoPara: dia(9).getTime() }) }
    const v = visaoDoCliente({ items: [p], states, cliente: 'Alto', ano: 2026, mes: 9, meta: META, agora: AGORA })
    expect(v.proximaPublicacao).toBe(dia(9).getTime())
  })

  it('ignora conteúdo de outro cliente', () => {
    const v = visaoDoCliente({ items: [item('Reel', dia(1), 7, 'Outro')], states: {}, cliente: 'Alto', ano: 2026, mes: 9, meta: META, agora: AGORA })
    expect(v.publicadosNoMes).toBe(0)
  })
})

describe('próxima gravação', () => {
  it('a mais próxima de hoje em diante, só do cliente', () => {
    const g = [
      { client: 'Alto', date: '2026-09-30' },
      { client: 'Alto', date: '2026-10-16' },
      { client: 'Alto', date: '2026-10-09' },
      { client: 'Outro', date: '2026-10-03' },
    ]
    expect(proximaGravacao(g, 'Alto', AGORA)).toBe(new Date(2026, 9, 9).getTime())
    expect(proximaGravacao(g, 'Nada', AGORA)).toBeNull()
  })
})
