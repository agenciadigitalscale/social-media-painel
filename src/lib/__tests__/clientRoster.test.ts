import { describe, it, expect } from 'vitest'
import { buildRoster, clientKey, inactiveClientKeys, ARCHIVED_CLIENTS } from '../clientRoster'
import { CLIENTS } from '../../data'
import type { Client } from '../../types'

const c = (name: string, postsPerMonth = 4): Client => ({ name, postsPerMonth, reelsPerMonth: 4 })

describe('buildRoster', () => {
  it('tira arquivados e ocultos', () => {
    const r = buildRoster([c('A'), c('LuzioPan'), c('B')], [], ['B'])
    expect(r.map(x => x.name)).toEqual(['A'])
  })

  it('cliente criado pela tela vence o da base com o mesmo nome — sem duplicar', () => {
    const r = buildRoster([c('Arca de Noé', 4)], [c('arca de noé ', 12)], [])
    expect(r).toHaveLength(1)
    expect(r[0].postsPerMonth).toBe(12)
  })

  it('apóstrofo curvo e reto são o mesmo nome', () => {
    expect(clientKey('Frango d’Água')).toBe(clientKey("Frango d'Água"))
    expect(inactiveClientKeys(['Frango d’Água']).has(clientKey("Frango d'Água"))).toBe(true)
  })
})

describe('lista de clientes ativos (2026-09-28)', () => {
  const ATIVOS = [
    'Alto da Represa', 'Arca de Noé', 'Aventur', 'Casa de Ração 2 Irmãos', 'Casarão Bragança Paulista',
    'Chalés Alto da Represa', 'Compostela', "Frango d'Água", 'Genitex', 'Hidro Elétrica Andrade',
    'Home Elevadores', 'Kátia Bigatello', 'Lareiras Grill', 'Padaria Luanda', 'Luthita', 'Magia dos Temáticos',
    'Marina Fenix', 'Padaria R.A', 'PESQ', 'Pousada Dukuka',
  ]

  it('o painel abre exatamente com os 20 ativos', () => {
    const nomes = buildRoster(CLIENTS, [], []).map(x => clientKey(x.name)).sort()
    expect(nomes).toEqual(ATIVOS.map(clientKey).sort())
  })

  it('os 5 arquivados continuam na base (histórico guardado), só fora do painel', () => {
    const base = CLIENTS.map(x => clientKey(x.name))
    for (const a of ['LuzioPan', 'Quero Bolo', 'ViniPlas', 'Rosângela Varas', 'Suh Maya']) {
      expect(base).toContain(clientKey(a))
      expect(ARCHIVED_CLIENTS.map(clientKey)).toContain(clientKey(a))
    }
  })

  it('arquivado criado pela tela (sm_extra_clients) também sai do painel', () => {
    const extras = [{ name: 'HOPESTEEL', postsPerMonth: 4, reelsPerMonth: 4 }, { name: 'Lambari', postsPerMonth: 4, reelsPerMonth: 4 }]
    const nomes = buildRoster(CLIENTS, extras, []).map(x => x.name)
    expect(nomes).toContain('HOPESTEEL')
    expect(nomes).not.toContain('Lambari')
  })

  it("'PADARIA LUANDA' da tela e 'Padaria Luanda' da base são um cliente só", () => {
    const extras = [{ name: 'PADARIA LUANDA', postsPerMonth: 4, reelsPerMonth: 4 }]
    const nomes = buildRoster(CLIENTS, extras, []).map(x => clientKey(x.name))
    expect(nomes.filter(n => n === clientKey('Padaria Luanda'))).toHaveLength(1)
  })
})
