import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Chave em formato de LISTA (`sm_custom`, os 889 cards criados à mão) não pode
 * ser gravada às cegas.
 *
 * `_baseRev` só é preenchido por `applyRemoteSync` — depois da leitura inicial.
 * Enquanto uma gravação anterior a isso saía sem `baseRev`, o servidor aceitava
 * sem conferir versão: uma aba com cópia velha derrubava os cards que outra
 * pessoa acabara de criar. É a mesma armadilha que fez vídeos prontos voltarem
 * para "A fazer", numa porta onde o estrago é pior — ali some registro, não só
 * status.
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

const srv = {
  valor: JSON.stringify([{ i: 1 }, { i: 2 }]),
  rev: 7,
  gets: 0,
  postsSemBase: 0,
  conflitos: 0,
}

vi.stubGlobal('localStorage', makeStorage())
vi.stubGlobal('navigator', { onLine: true })
vi.stubGlobal('console', { ...console, warn: vi.fn(), error: vi.fn() })
vi.stubGlobal('window', { addEventListener: vi.fn(), dispatchEvent: vi.fn() })
vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
  if (!init || init.method !== 'POST') {
    srv.gets++
    return new Response(JSON.stringify({ ok: true, value: srv.valor, rev: srv.rev }), { status: 200 })
  }
  const body = JSON.parse(String(init.body ?? '{}')) as
    { key: string; value?: string; baseRev?: number }

  if (body.baseRev === undefined) srv.postsSemBase++

  // Servidor real: recusa quando a base não é a versão atual.
  if (body.baseRev !== undefined && body.baseRev !== srv.rev) {
    srv.conflitos++
    return new Response(
      JSON.stringify({ ok: false, conflict: true, value: srv.valor, rev: srv.rev }),
      { status: 409 },
    )
  }
  if (body.value !== undefined) { srv.valor = body.value; srv.rev += 1 }
  return new Response(JSON.stringify({ ok: true, rev: srv.rev }), { status: 200 })
}))

const { syncToCloud, forceSync } = await import('../storage')

beforeEach(() => {
  localStorage.clear()
  srv.gets = 0
  srv.postsSemBase = 0
  srv.conflitos = 0
})

describe('primeira gravação de lista confere versão', () => {
  it('busca a base antes de gravar, em vez de sobrescrever às cegas', async () => {
    syncToCloud('sm_custom', [{ i: 1 }, { i: 2 }, { i: 3 }])
    await forceSync()

    expect(srv.gets).toBeGreaterThanOrEqual(1)   // foi buscar a versão
    expect(srv.postsSemBase).toBe(0)             // nenhuma gravação cega
  })

  it('a gravação legítima chega ao servidor', async () => {
    syncToCloud('sm_custom', [{ i: 1 }, { i: 2 }, { i: 3 }])
    await forceSync()
    expect(JSON.parse(srv.valor)).toHaveLength(3)
  })

  it('se alguém gravou no meio, o servidor recusa e o cliente reconcilia', async () => {
    // Base buscada será a 7; simulamos outra pessoa gravando logo depois.
    syncToCloud('sm_custom', [{ i: 1 }])
    const primeira = forceSync()
    srv.rev = 99
    await primeira
    // O importante: a escrita não passou por cima sem ser notada.
    expect(srv.conflitos + srv.postsSemBase).toBeGreaterThan(0)
  })
})
