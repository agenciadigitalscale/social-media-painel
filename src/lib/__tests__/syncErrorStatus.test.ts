import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * O indicador de sync tem de dizer a verdade quando o servidor está RECUSANDO
 * tudo (ex.: quota do D1 estourada → 500). Antes, um 500 deixava a fila cheia e
 * emitia "syncing" para sempre: a equipe via um spinner eterno, achava que era
 * lentidão e não sabia que NADA estava salvando. Agora, nada subiu + online =
 * "error".
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

const srv = { httpStatus: 200 }

vi.stubGlobal('localStorage', makeStorage())
vi.stubGlobal('navigator', { onLine: true })
vi.stubGlobal('console', { ...console, warn: vi.fn(), error: vi.fn() })
vi.stubGlobal('window', { addEventListener: vi.fn(), dispatchEvent: vi.fn() })
vi.stubGlobal('fetch', vi.fn(async () => {
  if (srv.httpStatus !== 200) {
    return new Response(JSON.stringify({ ok: false, error: 'D1 read limit' }), { status: srv.httpStatus })
  }
  return new Response(JSON.stringify({ ok: true, rev: 1 }), { status: 200 })
}))

const { syncToCloud, forceSync, getSyncStatus } = await import('../storage')

beforeEach(() => {
  localStorage.clear()
  srv.httpStatus = 200
})

describe('status de sync quando o servidor recusa tudo', () => {
  it('500 estando online vira ERRO, não "syncing" eterno', async () => {
    srv.httpStatus = 500
    syncToCloud('sm_states', { 1: { status: 2 } })
    await forceSync()
    expect(getSyncStatus()).toBe('error')
  })

  it('gravação confirmada volta para "synced"', async () => {
    srv.httpStatus = 200
    syncToCloud('sm_states', { 1: { status: 3 } })
    await forceSync()
    expect(getSyncStatus()).toBe('synced')
  })
})
