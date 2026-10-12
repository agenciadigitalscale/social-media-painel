import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * "Não foi possível salvar o movimento" (2026-10-12): o Worker do /api/sync
 * morria por limite de CPU em ~10–25% das chamadas (Error 1102 → 503) e o
 * MESMO arraste, feito de novo, passava. A gravação tem de tentar de novo
 * sozinha numa falha passageira — e só nela.
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

const srv = { falhas: 0, statusFalha: 503, chamadas: 0, gravacoes: 0 }

vi.stubGlobal('localStorage', makeStorage())
vi.stubGlobal('navigator', { onLine: true })
vi.stubGlobal('console', { ...console, warn: vi.fn(), error: vi.fn() })
vi.stubGlobal('window', { addEventListener: vi.fn(), dispatchEvent: vi.fn() })
vi.stubGlobal('fetch', vi.fn(async () => {
  srv.chamadas++
  if (srv.falhas > 0) {
    srv.falhas--
    // O que a Cloudflare devolve quando o Worker estoura: HTML, não JSON.
    return new Response('<html>Error 1102 Worker exceeded resource limits</html>', { status: srv.statusFalha })
  }
  srv.gravacoes++
  return new Response(JSON.stringify({ ok: true, rev: 1, merged: 1 }), { status: 200 })
}))

const { syncToCloud, forceSync, getSyncStatus } = await import('../storage')

const fila = () => JSON.parse(localStorage.getItem('sm_sync_queue') ?? '[]') as unknown[]

beforeEach(() => {
  localStorage.clear()
  Object.assign(srv, { falhas: 0, statusFalha: 503, chamadas: 0, gravacoes: 0 })
})

describe('falha passageira do servidor ao salvar o movimento', () => {
  it('503 uma vez: tenta de novo sozinho, grava e fica "synced"', async () => {
    srv.falhas = 1
    syncToCloud('sm_states', { 7: { status: 1 } })
    await forceSync()

    expect(srv.gravacoes).toBe(1)
    expect(fila()).toHaveLength(0)
    expect(getSyncStatus()).toBe('synced')
  })

  it('duas quedas seguidas também passam', async () => {
    srv.falhas = 2
    syncToCloud('sm_states', { 8: { status: 1 } })
    await forceSync()

    expect(srv.gravacoes).toBe(1)
    expect(getSyncStatus()).toBe('synced')
  })

  it('400 NÃO é repetido — é resposta de verdade, não queda', async () => {
    srv.falhas = 1
    srv.statusFalha = 400
    syncToCloud('sm_states', { 9: { status: 1 } })
    await forceSync()

    expect(srv.chamadas).toBe(1)
    expect(fila()).toHaveLength(1)
  })
})
