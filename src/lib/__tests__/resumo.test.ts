import { describe, it, expect } from 'vitest'
import { computeResumo, summarizeBriefings, summarizeEntregas, type ResumoInput } from '../resumo'
import type { ContentItem, ItemState, Status } from '../../types'

// Segunda-feira, 28/09/2026, meio-dia.
const NOW = new Date(2026, 8, 28, 12)
const day = (offset: number) => new Date(2026, 8, 28 + offset, 10)

let nextId = 1
function item(dt: Date, s: Status, custom = true): ContentItem {
  return { i: nextId++, c: 'Cliente A', dt, tp: 'Post', n: 'x', s, custom }
}
const st = (status: Status, extra: Partial<ItemState> = {}): ItemState =>
  ({ status, title: '', link: '', caption: '', notes: '', ...extra }) as ItemState

function input(items: ContentItem[], states: Record<number, ItemState> = {}, over: Partial<ResumoInput> = {}): ResumoInput {
  return {
    items, states,
    clientNames: ['Cliente A', 'Cliente B', 'Cliente C'],
    recordings: [],
    onboarding: { active: 2, late: 1, completedThisMonth: 3 },
    now: NOW,
    ...over,
  }
}

describe('computeResumo', () => {
  it('KPIs: atrasado de verdade, vence hoje, com o cliente e publicados no mês', () => {
    const lateReal = item(day(-3), 1)
    const lateGhost = item(day(-3), 0, false)     // semeado e nunca tocado: não conta
    const todayOpen = item(day(0), 1)
    const withClient = item(day(2), 4)
    const published = item(day(-1), 7)
    const r = computeResumo(input([lateReal, lateGhost, todayOpen, withClient, published]))
    expect(r.kpis).toEqual({ late: 1, dueToday: 1, withClient: 1, publishedMonth: 1 })
  })

  it('status salvo no estado vence o do item', () => {
    const a = item(day(1), 0)
    const r = computeResumo(input([a], { [a.i]: st(7) }))
    expect(r.kpis.publishedMonth).toBe(1)
    expect(r.pipeline.find(p => p.status === 7)?.n).toBe(1)
    expect(r.pipeline.find(p => p.status === 0)?.n).toBe(0)
  })

  it('funil só conta o mês corrente e segue a ordem oficial', () => {
    const r = computeResumo(input([item(day(0), 1), item(new Date(2026, 9, 5), 1)]))
    expect(r.monthTotal).toBe(1)
    expect(r.pipeline.map(p => p.status)).toEqual([0, 1, 8, 2, 3, 4, 5, 6, 7])
  })

  it('semana de segunda a domingo, marcando hoje', () => {
    const r = computeResumo(input([item(day(0), 1), item(day(0), 2), item(day(6), 1), item(day(7), 1)]))
    expect(r.week.map(d => d.label)).toEqual(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'])
    expect(r.week[0]).toEqual({ label: 'Seg', n: 2, isToday: true })
    expect(r.week[6].n).toBe(1)
    expect(r.weekTotal).toBe(3)
  })

  it('risco do cliente usa atraso DE VERDADE — card semeado nunca tocado não conta', () => {
    const mk = (c: string, off: number, s: Status, custom = true) => ({ ...item(day(off), s, custom), c })
    const itens = [
      mk('Cliente A', -2, 1), mk('Cliente A', -3, 1), mk('Cliente A', -4, 1),  // 3 atrasados reais → crítico
      mk('Cliente B', 1, 6),                                                   // 1 ajuste → atenção
      mk('Cliente C', -5, 0, false), mk('Cliente C', -6, 0, false),            // fantasmas → em dia
    ]
    expect(computeResumo(input(itens)).clients).toEqual({ total: 3, saudavel: 1, atencao: 1, critico: 1 })
  })

  it('gravações: próximas agendadas em ordem e as em edição', () => {
    const rec = (date: string, status: ResumoInput['recordings'][number]['status'], time = '09:00') =>
      ({ client: 'A', title: date, date, time, status })
    const r = computeResumo(input([], {}, {
      recordings: [rec('2026-10-02', 'agendado'), rec('2026-09-29', 'agendado'), rec('2026-09-20', 'agendado'),
        rec('2026-09-25', 'em_edicao'), rec('2026-09-26', 'gravado'), rec('2026-09-27', 'publicado')],
    }))
    expect(r.recordings.upcoming).toBe(2)
    expect(r.recordings.next.map(x => x.date)).toEqual(['2026-09-29', '2026-10-02'])
    expect(r.recordings.editing).toBe(2)
  })

  it('equipe: só trabalho aberto com responsável, do mais carregado ao menos', () => {
    const a = item(day(1), 1), b = item(day(1), 1), c = item(day(1), 1), d = item(day(1), 7)
    const r = computeResumo(input([a, b, c, d], {
      [a.i]: st(1, { responsible: 'kaique' }), [b.i]: st(1, { responsible: 'kaique' }),
      [c.i]: st(1, { responsible: 'jhones' }), [d.i]: st(7, { responsible: 'jhones' }),
    }))
    expect(r.team).toEqual([{ user: 'kaique', n: 2 }, { user: 'jhones', n: 1 }])
  })
})

describe('cartões novos do Resumo', () => {
  it('áreas: Design (Post/Story/Carrossel) e Vídeo (Reel) separados', () => {
    const post = { ...item(day(-2), 1), tp: 'Post' as const }
    const story = { ...item(day(1), 2), tp: 'Story' as const }
    const reel = { ...item(day(1), 3), tp: 'Reel' as const }
    const reelPub = { ...item(day(1), 7), tp: 'Reel' as const }
    const r = computeResumo(input([post, story, reel, reelPub]))
    expect(r.areas.design).toEqual({ open: 2, late: 1, review: 1, ready: 0 })
    expect(r.areas.video).toEqual({ open: 1, late: 0, review: 0, ready: 1 })
  })

  it('briefings: preenchido, aguardando (com link) e não iniciado', () => {
    expect(summarizeBriefings(['A', 'B', 'C', 'D'], { A: { token: 't', filled: true }, B: { token: 't' }, Z: { filled: true } }))
      .toEqual({ total: 4, preenchido: 1, aguardando: 1, naoIniciado: 2 })
  })

  it('entregas: últimos 7 dias, criativos distintos que rodaram e com falha', () => {
    const t = (d: number) => NOW.getTime() - d * 86_400_000
    const ev = (itemId: number, event: 'opened' | 'playing' | 'error', d: number) => ({ ts: t(d), client: 'A', itemId, event })
    const r = summarizeEntregas([
      ev(1, 'opened', 1), ev(1, 'playing', 1), ev(1, 'playing', 1), // mesmo criativo tocando 2x = 1
      ev(2, 'opened', 2), ev(2, 'error', 2),
      ev(3, 'opened', 9),                                            // fora da janela
    ], NOW)
    expect(r).toEqual({ opened: 2, played: 1, failedItems: 1 })
  })
})
