import { describe, it, expect } from 'vitest'
import { mesclarEntrada, mesclarEstados, statusPodeEntrar } from '../mergeStates'

const T = 1_790_000_000_000

describe('sm_states: gravação antiga nunca vence a mais nova', () => {
  it('o caso real: aparelho com cópia velha edita só a observação → o status novo fica', () => {
    const servidor = { '9': { status: 4, statusAt: T + 1000, notes: '', title: 'X' } }
    // código novo: só o campo mudado
    const parcial = mesclarEstados(servidor, { '9': { notes: 'obs' } }, true, T + 2000)
    expect(parcial['9']).toMatchObject({ status: 4, statusAt: T + 1000, notes: 'obs', title: 'X' })
    // código antigo: card inteiro com o status velho → status recusado, observação grava
    const inteiro = mesclarEstados(servidor, { '9': { status: 3, statusAt: T, notes: 'obs', title: 'X' } }, false, T + 2000)
    expect(inteiro['9']).toMatchObject({ status: 4, statusAt: T + 1000, notes: 'obs' })
    // card inteiro SEM versão (painel aberto com código antigo)
    const legado = mesclarEstados(servidor, { '9': { status: 3, notes: 'obs', title: 'X' } }, false, T + 2000)
    expect(legado['9']).toMatchObject({ status: 4, statusAt: T + 1000, notes: 'obs' })
  })

  it('a mudança mais nova entra; a última ação vence numa sequência', () => {
    let s: Record<string, unknown> = { '9': { status: 3, statusAt: T } }
    s = mesclarEstados(s, { '9': { status: 4, statusAt: T + 10 } }, true, T + 20)
    s = mesclarEstados(s, { '9': { status: 5, statusAt: T + 30 } }, true, T + 40)
    s = mesclarEstados(s, { '9': { status: 4, statusAt: T + 10 } }, true, T + 50) // resposta atrasada
    expect(s['9']).toMatchObject({ status: 5, statusAt: T + 30 })
  })

  it('dados de antes da regra (sem versão nos dois lados) continuam podendo mudar', () => {
    expect(statusPodeEntrar({ status: 3 }, { status: 4 })).toBe(true)
    expect(statusPodeEntrar({ status: 3 }, { status: 4, statusAt: T })).toBe(true)
    expect(statusPodeEntrar({ status: 3, statusAt: T }, { status: 4 })).toBe(false)
  })

  it('campo removido (null) sai; card novo entra inteiro', () => {
    const s = mesclarEstados({ '1': { status: 0, deliveryDate: T } }, { '1': { deliveryDate: null }, '2': { status: 1, statusAt: T, title: 'novo' } }, true, T)
    expect(s['1']).toEqual({ status: 0 })
    expect(s['2']).toEqual({ status: 1, statusAt: T, title: 'novo' })
  })

  it('relógio adiantado não trava o card no futuro', () => {
    const e = mesclarEntrada({ status: 3, statusAt: T }, { status: 4, statusAt: T + 3_600_000 }, true, T + 1000)
    expect(e).toMatchObject({ status: 4, statusAt: T + 1000 })
  })

  it('mesmo status: o carimbo não anda para trás', () => {
    const e = mesclarEntrada({ status: 4, statusAt: T + 50 }, { status: 4, statusAt: T + 10 }, true, T + 100)
    expect(e.statusAt).toBe(T + 50)
  })
})
