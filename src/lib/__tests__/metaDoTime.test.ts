import { describe, it, expect } from 'vitest'
import { esperadoNoMes, diasUteisRestantes, andamento } from '../metaDoTime'
import type { Client } from '../../types'

const cli = (name: string, reels: number, posts: number): Client => ({ name, reelsPerMonth: reels, postsPerMonth: posts } as Client)

describe('total esperado do time no mês', () => {
  const clientes = [cli('A', 8, 8), cli('B', 4, 4), cli('Saiu', 6, 6), cli('Free', 3, 3), cli('Novo', 4, 4), cli('Exc', 6, 6)]
  const carteira = {
    Saiu: { tipo: 'mensal' as const, saida: '2026-10' },
    Free: { tipo: 'freelancer' as const },
    Novo: { tipo: 'mensal' as const, entrada: '2026-11' },
  }
  const padroes = { B: { dias: { Reel: [], Post: [], Feed: [] }, meta: { Reel: 6, Feed: 6 }, segundo: 'Feed' as const } }
  const prefs = { Exc: { '2026-10': { dias: { Reel: [], Post: [], Feed: [] }, meta: { Reel: 2 } } } }
  const m = esperadoNoMes(clientes, carteira, padroes, prefs, 2026, 9)

  it('só mensais ativos no mês (sem quem saiu, freelancer, quem ainda não entrou)', () => {
    expect(m.porCliente.map(c => c.cliente).sort()).toEqual(['A', 'B', 'Exc'])
  })
  it('meta de cada um: padrão > plano; exceção do mês vale', () => {
    expect(m.porCliente.find(c => c.cliente === 'A')).toMatchObject({ videos: 8, artes: 8 })
    expect(m.porCliente.find(c => c.cliente === 'B')).toMatchObject({ videos: 6, artes: 0 }) // Feed não conta como arte
    expect(m.porCliente.find(c => c.cliente === 'Exc')!.videos).toBe(2)
    expect(m.videos).toBe(16)
  })
  it('dias úteis restantes e o ritmo para fechar', () => {
    expect(diasUteisRestantes(new Date(2026, 9, 22))).toBe(6) // 23, 26, 27, 28, 29, 30
  })
})

describe('andamento', () => {
  it('feito × esperado, faltam e por dia', () => {
    const a = andamento(100, 70, new Date(2026, 9, 22))
    expect(a).toMatchObject({ esperado: 100, feito: 70, faltam: 30, pct: 70 })
    expect(a.porDia).toBeGreaterThan(0)
  })
  it('passou da meta: falta 0', () => {
    expect(andamento(10, 12, new Date(2026, 9, 22))).toMatchObject({ faltam: 0, pct: 100, porDia: 0 })
  })
})
