import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * "Failed to execute 'setItem' on 'Storage': Setting the value of 'sm_sync_queue'
 * exceeded the quota" (2026-10-26) — o painel caía na tela de erro ao atribuir
 * cards à Emanuelly. O `sm_states` tem 2 MB e a fila guardava OUTRA cópia inteira
 * dele: o navegador (~5 MB) estourava. Sem espaço, a fila tem de continuar
 * funcionando — e o painel, de pé.
 */

const LIMITE = 3000 // bytes do armazenamento de mentira (só o tamanho importa)

function storageLimitado(): Storage {
  const data = new Map<string, string>()
  const usado = () => [...data].reduce((s, [k, v]) => s + k.length + v.length, 0)
  return {
    get length() { return data.size },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      const antes = data.get(k)
      const novo = usado() - (antes ? k.length + antes.length : 0) + k.length + String(v).length
      if (novo > LIMITE) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e }
      data.set(k, String(v))
    },
    removeItem: (k: string) => { data.delete(k) },
    clear: () => { data.clear() },
  } as Storage
}

const srv = { gravado: [] as string[], online: true }
vi.stubGlobal('localStorage', storageLimitado())
vi.stubGlobal('navigator', { onLine: true })
vi.stubGlobal('console', { ...console, warn: vi.fn(), error: vi.fn() })
vi.stubGlobal('window', { addEventListener: vi.fn(), dispatchEvent: vi.fn() })
vi.stubGlobal('fetch', vi.fn(async (_u: string, init?: RequestInit) => {
  if (!srv.online) return new Response('{}', { status: 503 })
  const b = JSON.parse(String(init?.body ?? '{}')) as { value?: string; patch?: string }
  srv.gravado.push(b.patch ?? b.value ?? '')
  return new Response(JSON.stringify({ ok: true, rev: 1 }), { status: 200 })
}))

const { syncToCloud, forceSync, getPendingKeys, gravarLocal } = await import('../storage')

const grande = () => Object.fromEntries(Array.from({ length: 40 }, (_, i) => [String(i), { status: 1, title: `card ${i} ${'x'.repeat(20)}` }]))

beforeEach(() => { localStorage.clear(); srv.gravado = []; srv.online = true })

describe('fila de gravação sem espaço no navegador', () => {
  it('não derruba o painel: enfileira mesmo sem espaço para outra cópia', () => {
    const v = grande()
    localStorage.setItem('sm_states', JSON.stringify(v)) // o mapa ocupa quase tudo
    srv.online = false
    expect(() => syncToCloud('sm_states', v)).not.toThrow()
    expect(getPendingKeys().has('sm_states')).toBe(true)
  })

  it('e o envio leva o valor inteiro ao servidor quando a rede volta', async () => {
    const v = grande()
    localStorage.setItem('sm_states', JSON.stringify(v))
    srv.online = false
    syncToCloud('sm_states', v)
    srv.online = true
    await forceSync()
    expect(srv.gravado.length).toBeGreaterThan(0)
    expect(srv.gravado[srv.gravado.length - 1]).toContain('card 39')
    expect(getPendingKeys().has('sm_states')).toBe(false)
  })

  it('gravarLocal: sem espaço, avisa e segue (nunca lança)', () => {
    expect(() => gravarLocal('sm_x', 'y'.repeat(LIMITE * 2))).not.toThrow()
  })
})
