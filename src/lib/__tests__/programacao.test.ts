import { describe, expect, it } from 'vitest'
import type { ContentItem, ItemState } from '../../types'
import { aguardandoSocial, horaValida, patchDaHora, postagemDoCard, programacaoAutomatica } from '../programacao'

const item = (i: number, dia: number, s = 0): ContentItem =>
  ({ i, c: 'Cliente', dt: new Date(2026, 9, dia, 12), tp: 'Reel', n: `Card ${i}`, s } as ContentItem)
const st = (p: Partial<ItemState>): ItemState => ({ status: 0, title: '', link: '', caption: '', notes: '', ...p } as ItemState)

describe('programacao', () => {
  it('valida hora HH:MM', () => {
    expect(horaValida('18:30')).toBe(true)
    expect(horaValida('24:00')).toBe(false)
    expect(horaValida('9:00')).toBe(false)
    expect(horaValida(undefined)).toBe(false)
  })

  it('programado manda sobre a pauta', () => {
    const ts = new Date(2026, 9, 5, 19, 15).getTime()
    const p = postagemDoCard(item(1, 2), st({ status: 9, programadoPara: ts, horaPostagem: '10:00' }))
    expect(p).toMatchObject({ hora: '19:15', firme: true })
    expect(p.quando.getDate()).toBe(5)
  })

  it('sem programar: dia da pauta + hora do card', () => {
    const p = postagemDoCard(item(1, 2), st({ horaPostagem: '08:40' }))
    expect(p.firme).toBe(false)
    expect([p.quando.getDate(), p.quando.getHours(), p.quando.getMinutes()]).toEqual([2, 8, 40])
  })

  it('programa sem perguntar só quando tem hora e ainda não passou', () => {
    const agora = new Date(2026, 9, 2, 9).getTime()
    expect(programacaoAutomatica(item(1, 2), st({ horaPostagem: '18:00' }), agora)).toBe(new Date(2026, 9, 2, 18).getTime())
    expect(programacaoAutomatica(item(1, 2), st({ horaPostagem: '08:00' }), agora)).toBeNull()
    expect(programacaoAutomatica(item(1, 2), st({}), agora)).toBeNull()
  })

  it('fila do Social: só aprovados pelo cliente, em ordem de postagem', () => {
    const itens = [item(1, 9), item(2, 3), item(3, 1)]
    const states = { 1: st({ status: 5 }), 2: st({ status: 5 }), 3: st({ status: 4 }) }
    expect(aguardandoSocial(itens, states).map(i => i.i)).toEqual([2, 1])
  })

  it('mudar a hora de um card programado move o horário marcado junto', () => {
    const ts = new Date(2026, 9, 5, 19, 0).getTime()
    const p = patchDaHora(st({ status: 9, programadoPara: ts }), '07:30')
    expect(new Date(p.programadoPara!).getHours()).toBe(7)
    expect(new Date(p.programadoPara!).getDate()).toBe(5)
    expect(patchDaHora(st({}), '07:30')).toEqual({ horaPostagem: '07:30' })
  })
})
