import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mesclarEstados } from '../../../functions/api/_lib/mergeStates'
import { reconcileRemoteStates } from '../statusReconcile'

/**
 * "Movi o card, salvou, e depois ele voltou sozinho" (2026-10-08).
 *
 * Reproduzido no painel local: um segundo aparelho com a cópia VELHA do card
 * editou só a observação; como cada gravação levava o card inteiro, o servidor
 * recebeu o status antigo junto e o card voltou. Estes testes passam pelo mesmo
 * caminho de verdade — fila do painel → POST → regra do servidor (mergeStates).
 */

function makeStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, String(v)) },
    removeItem: (k: string) => { data.delete(k) },
    clear: () => { data.clear() },
  } as Storage
}

const srv = { linha: {} as Record<string, unknown>, posts: 0, ultimo: null as null | { patch?: string; campos?: boolean } }

vi.stubGlobal('localStorage', makeStorage())
vi.stubGlobal('navigator', { onLine: true })
vi.stubGlobal('console', { ...console, warn: vi.fn(), error: vi.fn() })
vi.stubGlobal('window', { addEventListener: vi.fn(), dispatchEvent: vi.fn() })
vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
  if (init?.method !== 'POST') return new Response(JSON.stringify({ ok: true, value: null, rev: 0 }), { status: 200 })
  const body = JSON.parse(String(init?.body ?? '{}')) as { key: string; patch?: string; campos?: boolean }
  srv.posts++; srv.ultimo = body
  // A MESMA regra do /api/sync.
  if (body.patch !== undefined) srv.linha = mesclarEstados(srv.linha, JSON.parse(body.patch), body.campos === true)
  return new Response(JSON.stringify({ ok: true, rev: srv.posts }), { status: 200 })
}))

const { syncToCloud, forceSync, noteSyncedValue, getPendingKeys } = await import('../storage')

beforeEach(() => {
  localStorage.clear()
  srv.linha = {}; srv.posts = 0; srv.ultimo = null
})

const T = 1_790_000_000_000

describe('o card não volta sozinho', () => {
  it('editar outro campo com a cópia velha NÃO leva o status junto', async () => {
    // Esta aba viu o card em Aprovado (3)…
    noteSyncedValue('sm_states', { 9: { status: 3, statusAt: T, notes: '' } })
    // …enquanto outro aparelho já o moveu para Enviado (4).
    srv.linha = { 9: { status: 4, statusAt: T + 1000, notes: '' } }

    syncToCloud('sm_states', { 9: { status: 3, statusAt: T, notes: 'obs nova' } })
    await forceSync()

    expect(JSON.parse(srv.ultimo!.patch!)).toEqual({ 9: { notes: 'obs nova' } })
    expect(srv.linha['9']).toMatchObject({ status: 4, notes: 'obs nova' })
  })

  it('mover o card leva o status com a versão; uma versão velha depois não desfaz', async () => {
    noteSyncedValue('sm_states', { 9: { status: 3, statusAt: T } })
    srv.linha = { 9: { status: 3, statusAt: T } }

    syncToCloud('sm_states', { 9: { status: 4, statusAt: T + 500 } })
    await forceSync()
    expect(srv.linha['9']).toMatchObject({ status: 4, statusAt: T + 500 })

    // Gravação atrasada / outra aba com o status anterior: ignorada.
    srv.linha = mesclarEstados(srv.linha, { 9: { status: 3, statusAt: T } }, true)
    expect(srv.linha['9']).toMatchObject({ status: 4 })
  })

  it('gravar o MESMO valor não enfileira nada (sem "Salvando…" fantasma)', async () => {
    noteSyncedValue('sm_states', { 9: { status: 4, statusAt: T } })
    syncToCloud('sm_states', { 9: { status: 4, statusAt: T } })
    expect(getPendingKeys().has('sm_states')).toBe(false)
    await forceSync()
    expect(srv.posts).toBe(0)
  })
})

describe('fila por aba', () => {
  it('não envia a gravação de OUTRA aba aberta (base dela é outra)', async () => {
    localStorage.setItem('sm_sync_tabs', JSON.stringify({ outra: Date.now() }))
    localStorage.setItem('sm_sync_queue', JSON.stringify([{ key: 'sm_states', value: JSON.stringify({ 9: { status: 3 } }), at: Date.now(), tab: 'outra' }]))
    await forceSync()
    expect(srv.posts).toBe(0)
    expect(getPendingKeys().has('sm_states')).toBe(false)
    expect(JSON.parse(localStorage.getItem('sm_sync_queue')!)).toHaveLength(1) // continua lá, para a dona
  })

  it('herda a gravação de uma aba que FECHOU (trabalho não se perde)', async () => {
    localStorage.setItem('sm_sync_tabs', JSON.stringify({ fechada: Date.now() - 10 * 60_000 }))
    localStorage.setItem('sm_sync_queue', JSON.stringify([{ key: 'sm_states', value: JSON.stringify({ 9: { status: 5, statusAt: T } }), at: Date.now(), tab: 'fechada' }]))
    await forceSync()
    expect(srv.posts).toBe(1)
    expect(srv.linha['9']).toMatchObject({ status: 5 })
  })
})

describe('tela: status do servidor mais velho que o da tela não entra', () => {
  it('resposta atrasada do servidor não desfaz o movimento', () => {
    const remoto = { 9: { status: 3, statusAt: T, notes: 'do servidor' } }
    const tela = { 9: { status: 4, statusAt: T + 500, notes: '' } }
    const { states } = reconcileRemoteStates(remoto, new Map(), T + 600_000, tela)
    expect(states['9']).toMatchObject({ status: 4, statusAt: T + 500, notes: 'do servidor' })
  })

  it('status mais NOVO do servidor (outra pessoa, ou o cliente) entra', () => {
    const remoto = { 9: { status: 5, statusAt: T + 900 } }
    const tela = { 9: { status: 4, statusAt: T + 500 } }
    expect(reconcileRemoteStates(remoto, new Map(), T + 1000, tela).states['9']).toMatchObject({ status: 5 })
  })
})
