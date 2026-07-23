import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * O bug do "card volta para a coluna de origem": uma gravação que chega enquanto
 * outro flush está em andamento não pode ser descartada. O flush terminava com
 * `saveQueue([])`, que limpava a fila inteira — inclusive o que entrou no meio.
 * Como o flush ficou mais lento (retry de conflito), a janela para isso alargou.
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

const gravacoes: Array<{ key: string; value?: string }> = []
let atrasoMs = 0

vi.stubGlobal('localStorage', makeStorage())
vi.stubGlobal('navigator', { onLine: true })
vi.stubGlobal('console', { ...console, warn: vi.fn(), error: vi.fn() })
vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body ?? '{}')) as { key: string; value?: string }
  if (atrasoMs) await new Promise(r => setTimeout(r, atrasoMs))
  gravacoes.push(body)
  return new Response(JSON.stringify({ ok: true, rev: 1 }), { status: 200 })
}))

const { syncToCloud, forceSync } = await import('../storage')

beforeEach(() => {
  localStorage.clear()
  gravacoes.length = 0
  atrasoMs = 0
})

describe('gravação concorrente ao flush', () => {
  it('o que entra na fila durante um flush lento não se perde', async () => {
    atrasoMs = 40

    // Primeira gravação começa a subir (flush lento em voo).
    syncToCloud('sm_states', { 1: { status: 1 } })
    const primeiro = forceSync()

    // Enquanto o primeiro está no ar, o usuário arrasta o card: nova gravação.
    await new Promise(r => setTimeout(r, 10))
    syncToCloud('sm_states', { 1: { status: 2 } })

    await primeiro
    await forceSync()

    // O último valor gravado tem que ser o do arraste (status 2), não o antigo.
    const ultimo = gravacoes[gravacoes.length - 1]
    const enviado = ultimo.value ? JSON.parse(ultimo.value) : JSON.parse(String((ultimo as { patch?: string }).patch ?? '{}'))
    expect(JSON.stringify(enviado)).toContain('"status":2')

    // E a fila tem que estar vazia no fim — nada preso.
    expect(JSON.parse(localStorage.getItem('sm_sync_queue') ?? '[]')).toHaveLength(0)
  })

  it('chaves diferentes durante o flush: nenhuma some', async () => {
    atrasoMs = 30
    syncToCloud('sm_roteiros', { a: 1 })
    const p = forceSync()
    await new Promise(r => setTimeout(r, 8))
    syncToCloud('sm_custom', [{ i: 9 }])
    await p
    await forceSync()

    const chaves = gravacoes.map(g => g.key)
    expect(chaves).toContain('sm_roteiros')
    expect(chaves).toContain('sm_custom')
  })
})
