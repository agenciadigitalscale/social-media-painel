import { describe, expect, it } from 'vitest'
import {
  construirFechamento, aplicarFechamento, reabrirMes, mesFechado, totalFechado,
  chaveMes, mesesFechados, type FechamentosStore,
} from '../designerFechamento'
import type { ArteDesigner } from '../designerProducao'

function arte(itemId: number, over: Partial<ArteDesigner> = {}): ArteDesigner {
  return {
    itemId, cliente: 'Frango d\'Água', titulo: `Arte ${itemId}`, designer: 'julio',
    status: 5, aprovada: true, aprovadaEm: Date.now(), ...over,
  }
}

describe('designerFechamento', () => {
  it('constrói o snapshot com total = nº de peças por designer', () => {
    const f = construirFechamento('2026-09', [
      { designer: 'julio', artesDoMes: [arte(1), arte(2), arte(3)] },
      { designer: 'jhones', artesDoMes: [arte(4, { designer: 'jhones' })] },
    ], 'testa')
    expect(f.mes).toBe('2026-09')
    expect(f.fechadoPor).toBe('testa')
    expect(f.designers.find(d => d.designer === 'julio')?.total).toBe(3)
    expect(f.designers.find(d => d.designer === 'jhones')?.total).toBe(1)
  })

  it('congela a lista de artes para auditoria', () => {
    const f = construirFechamento('2026-09', [{ designer: 'julio', artesDoMes: [arte(1)] }], 'testa')
    expect(f.designers[0].artes).toEqual([{ itemId: 1, cliente: 'Frango d\'Água', titulo: 'Arte 1', aprovadaEm: expect.any(Number) }])
  })

  it('aplicar e ler o total travado', () => {
    let store: FechamentosStore = {}
    store = aplicarFechamento(store, construirFechamento('2026-09', [
      { designer: 'julio', artesDoMes: [arte(1), arte(2)] },
      { designer: 'jhones', artesDoMes: [] },
    ], 'testa'))
    expect(totalFechado(store, '2026-09', 'julio')).toBe(2)
    expect(totalFechado(store, '2026-09', 'jhones')).toBe(0)
    expect(mesFechado(store, '2026-09')).toBeDefined()
  })

  it('mês não fechado devolve null (a leitura cai no ao vivo)', () => {
    expect(totalFechado({}, '2026-09', 'julio')).toBeNull()
    expect(mesFechado({}, '2026-09')).toBeUndefined()
  })

  it('o número travado NÃO muda quando os cards mudam depois', () => {
    // Fecha com 2; depois "os cards mudam" (novo snapshot só existiria se refechasse).
    let store: FechamentosStore = {}
    store = aplicarFechamento(store, construirFechamento('2026-09', [{ designer: 'julio', artesDoMes: [arte(1), arte(2)] }], 'testa'))
    // Estado atual agora seria 1, mas o fechado continua 2 até reabrir/refechar.
    expect(totalFechado(store, '2026-09', 'julio')).toBe(2)
  })

  it('reabrir remove o snapshot (volta a contar ao vivo)', () => {
    let store: FechamentosStore = aplicarFechamento({}, construirFechamento('2026-09', [{ designer: 'julio', artesDoMes: [arte(1)] }], 'testa'))
    store = reabrirMes(store, '2026-09')
    expect(mesFechado(store, '2026-09')).toBeUndefined()
  })

  it('meses fechados vêm do mais recente para o mais antigo', () => {
    let store: FechamentosStore = {}
    store = aplicarFechamento(store, construirFechamento('2026-08', [], 'testa'))
    store = aplicarFechamento(store, construirFechamento('2026-10', [], 'testa'))
    store = aplicarFechamento(store, construirFechamento('2026-09', [], 'testa'))
    expect(mesesFechados(store).map(f => f.mes)).toEqual(['2026-10', '2026-09', '2026-08'])
  })

  it('chaveMes é local (mês do fuso, não UTC)', () => {
    expect(chaveMes(new Date(2026, 8, 30, 22, 0, 0))).toBe('2026-09')
  })
})
