import { describe, it, expect, beforeEach } from 'vitest'
import {
  reconcileRemoteStates, markManualMove, getManualStamps, clearManualStamps,
  MANUAL_MOVE_TTL_MS, type ManualStamp,
} from '../statusReconcile'

const remoteOf = (m: Record<number, number>): Record<string, { status: number; title: string }> =>
  Object.fromEntries(Object.entries(m).map(([id, s]) => [id, { status: s, title: `item ${id}` }]))

const stampsOf = (m: Record<number, ManualStamp>): Map<number, ManualStamp> =>
  new Map(Object.entries(m).map(([id, v]) => [Number(id), v]))

const NOW = 1_000_000_000_000

describe('reconcileRemoteStates', () => {
  it('sem carimbo, aplica o servidor como está', () => {
    const { states } = reconcileRemoteStates(remoteOf({ 1: 3 }), new Map(), NOW)
    expect(states['1'].status).toBe(3)
  })

  it('preserva a coluna movida à mão quando o servidor ainda tem a velha', () => {
    // movi para Aprovado (5); o servidor ainda manda 3 (o meu POST não subiu)
    const { states, confirmed } = reconcileRemoteStates(
      remoteOf({ 1: 3 }),
      stampsOf({ 1: { status: 5, ts: NOW } }),
      NOW + 5_000,
    )
    expect(states['1'].status).toBe(5)      // NÃO voltou
    expect(confirmed).toEqual([])           // carimbo permanece até confirmar
  })

  it('mantém os demais campos do servidor, só força o status', () => {
    const remote = { 1: { status: 3, title: 'legenda nova do outro' } }
    const { states } = reconcileRemoteStates(remote, stampsOf({ 1: { status: 5, ts: NOW } }), NOW + 1000)
    expect(states['1']).toEqual({ status: 5, title: 'legenda nova do outro' })
  })

  it('DECISÃO DO CLIENTE (5) vence o movimento local', () => {
    // arrastei para Pronto (3); o cliente aprovou (servidor manda 5)
    const { states, confirmed } = reconcileRemoteStates(
      remoteOf({ 1: 5 }),
      stampsOf({ 1: { status: 3, ts: NOW } }),
      NOW + 1000,
    )
    expect(states['1'].status).toBe(5)      // automação passa
    expect(confirmed).toEqual([1])          // carimbo descartado
  })

  it('DECISÃO DO CLIENTE (6, reprovado) vence o movimento local', () => {
    const { states } = reconcileRemoteStates(
      remoteOf({ 1: 6 }),
      stampsOf({ 1: { status: 5, ts: NOW } }),
      NOW + 1000,
    )
    expect(states['1'].status).toBe(6)
  })

  it('servidor confirmou o meu status: descarta o carimbo', () => {
    const { states, confirmed } = reconcileRemoteStates(
      remoteOf({ 1: 5 }),
      stampsOf({ 1: { status: 5, ts: NOW } }),
      NOW + 1000,
    )
    expect(states['1'].status).toBe(5)
    expect(confirmed).toEqual([1])
  })

  it('prazo esgotado sem confirmação: o remoto volta a mandar', () => {
    const { states, confirmed } = reconcileRemoteStates(
      remoteOf({ 1: 3 }),
      stampsOf({ 1: { status: 5, ts: NOW } }),
      NOW + MANUAL_MOVE_TTL_MS + 1,
    )
    expect(states['1'].status).toBe(3)
    expect(confirmed).toEqual([1])
  })

  it('não mexe em cards sem carimbo, só no movido', () => {
    const { states } = reconcileRemoteStates(
      remoteOf({ 1: 3, 2: 4 }),
      stampsOf({ 1: { status: 5, ts: NOW } }),
      NOW + 1000,
    )
    expect(states['1'].status).toBe(5)   // preservado
    expect(states['2'].status).toBe(4)   // intocado
  })
})

describe('registro de movimentos manuais', () => {
  beforeEach(() => clearManualStamps([...getManualStamps().keys()]))

  it('marca e lê', () => {
    markManualMove(42, 5, NOW)
    expect(getManualStamps().get(42)).toEqual({ status: 5, ts: NOW })
  })

  it('o último movimento do mesmo card vence', () => {
    markManualMove(42, 3, NOW)
    markManualMove(42, 5, NOW + 100)
    expect(getManualStamps().get(42)?.status).toBe(5)
  })

  it('clear remove só os confirmados', () => {
    markManualMove(1, 3, NOW)
    markManualMove(2, 4, NOW)
    clearManualStamps([1])
    expect(getManualStamps().has(1)).toBe(false)
    expect(getManualStamps().has(2)).toBe(true)
  })
})
