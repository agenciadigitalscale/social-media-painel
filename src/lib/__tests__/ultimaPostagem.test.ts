import { describe, it, expect } from 'vitest'
import { ultimasDoPainel, ultimasDoCliente, nivelDoAviso, piorNivel, proximaDoCliente, ordenarPorUrgencia, ultimasDoIG } from '../ultimaPostagem'
import type { ContentItem, ItemState, Status } from '../../types'

let seq = 0
const card = (c: string, tp: ContentItem['tp'], dia: number, mes = 9): ContentItem =>
  ({ i: ++seq, c, dt: new Date(2026, mes, dia, 12), tp, n: `${tp} ${dia}`, s: 0, custom: true })
const st = (status: Status, extra: Partial<ItemState> = {}): ItemState => ({ status, title: '', link: '', caption: '', notes: '', ...extra })
const AGORA = new Date(2026, 9, 20, 15).getTime()

describe('última postagem (aviso)', () => {
  const r1 = card('Aventur', 'Reel', 5), r2 = card('Aventur', 'Reel', 12), f1 = card('Aventur', 'Feed', 14)
  const p1 = card('Aventur', 'Post', 18), prox = card('Aventur', 'Reel', 22), outro = card('Moreira', 'Reel', 19)
  const states: Record<number, ItemState> = {
    [r1.i]: st(7), [r2.i]: st(7, { publishedAt: new Date(2026, 9, 13, 10).getTime(), igPermalink: 'ig/r2' }),
    [f1.i]: st(7), [p1.i]: st(4), [prox.i]: st(9, { programadoPara: new Date(2026, 9, 22, 18).getTime() }), [outro.i]: st(7),
  }
  const itens = [r1, r2, f1, p1, prox, outro]

  it('do painel: último vídeo e última foto publicados, pela data em que saíram', () => {
    const u = ultimasDoPainel(itens, states, 'Aventur')
    expect(new Date(u.video!.quando).getDate()).toBe(13)
    expect(u.video!.link).toBe('ig/r2')
    expect(new Date(u.foto!.quando).getDate()).toBe(14)
  })

  it('conta conectada manda SOZINHA — o painel não entra (nem para "melhorar")', () => {
    const painel = ultimasDoPainel(itens, states, 'Aventur', AGORA)
    const conta = { clientName: 'Aventur', perfil: '@a', video: { quando: '2026-10-19T12:00:00Z', link: 'x', capa: null, formato: 'reel' }, foto: { quando: '2026-10-01T12:00:00Z', link: 'y', capa: null, formato: 'foto' } }
    const c = ultimasDoCliente(painel, conta)
    expect(c.video!.fonte).toBe('instagram')
    expect(c.foto!.fonte).toBe('instagram')
    expect(new Date(c.foto!.quando).getDate()).toBe(1)
  })

  it('conta com erro (token vencido): cai para o painel', () => {
    const painel = ultimasDoPainel(itens, states, 'Aventur', AGORA)
    expect(ultimasDoCliente(painel, { clientName: 'Aventur', perfil: '@a', erro: 'venceu' })).toBe(painel)
  })

  it('Página do Facebook (cliente sem Instagram) aparece como Facebook', () => {
    const u = ultimasDoIG({ clientName: 'Genitex', perfil: 'Genitex', fonte: 'facebook', foto: { quando: '2026-10-21T12:00:00Z', link: 'f', capa: null, formato: 'foto' } })
    expect(u.foto!.fonte).toBe('facebook')
    expect(u.video).toBeNull()
  })

  it('caso real: card "Publicado" com postagem no FUTURO não conta (Alto da Represa 09/11)', () => {
    const futuro = card('Alto', 'Reel', 9, 10) // 09/11
    const real = card('Alto', 'Reel', 18)
    const s2 = { [futuro.i]: st(7), [real.i]: st(7) }
    const u = ultimasDoPainel([futuro, real], s2, 'Alto', AGORA)
    expect(new Date(u.video!.quando).getDate()).toBe(18)
  })

  it('níveis: até 7 dias em dia, 8–14 atenção, mais que isso atrasado, sem nada = nunca', () => {
    const d = (dias: number) => ({ quando: AGORA - dias * 86_400_000, fonte: 'painel' as const, link: null, capa: null })
    expect(nivelDoAviso(d(7), AGORA)).toBe('ok')
    expect(nivelDoAviso(d(8), AGORA)).toBe('atencao')
    expect(nivelDoAviso(d(15), AGORA)).toBe('atrasado')
    expect(nivelDoAviso(null, AGORA)).toBe('nunca')
    expect(piorNivel({ video: d(1), foto: null }, AGORA)).toBe('nunca')
  })

  it('próxima postagem planejada: a mais perto, de hoje em diante, não publicada', () => {
    const p = proximaDoCliente(itens, states, 'Aventur', AGORA)
    expect(p?.tp).toBe('Reel')
    expect(new Date(p!.quando).getDate()).toBe(22)
  })

  it('ordem: o mais urgente primeiro', () => {
    const d = (dias: number) => ({ quando: AGORA - dias * 86_400_000, fonte: 'painel' as const, link: null, capa: null })
    const lista = [
      { nome: 'Em dia', ultimas: { video: d(2), foto: d(3) } },
      { nome: 'Sem foto', ultimas: { video: d(2), foto: null } },
      { nome: 'Atrasado', ultimas: { video: d(20), foto: d(3) } },
    ]
    expect(ordenarPorUrgencia(lista, AGORA).map(x => x.nome)).toEqual(['Sem foto', 'Atrasado', 'Em dia'])
  })
})
