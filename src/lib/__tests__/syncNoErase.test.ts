import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * A aba recém-carregada não pode apagar do servidor o que ela não conhece.
 *
 * `_sentSnapshot` vive em memória e nasce vazio a cada F5. Enquanto a primeira
 * gravação mandava o bloco INTEIRO, o servidor substituía a linha toda — e uma
 * aba com cópia velha apagava todo card que ela não tinha. Esses cards caíam no
 * status padrão da semente (0) e reapareciam em "A fazer", já feitos.
 *
 * Aconteceu em produção: mais de 20 vídeos prontos voltaram para a primeira
 * coluna de uma vez.
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

/** Servidor de mentira que se comporta como o `/api/sync`: patch mescla, value substitui. */
const srv = {
  linha: {} as Record<string, unknown>,
  recebidos: [] as Array<{ patch?: string; value?: string }>,
}

vi.stubGlobal('localStorage', makeStorage())
vi.stubGlobal('navigator', { onLine: true })
vi.stubGlobal('console', { ...console, warn: vi.fn(), error: vi.fn() })
vi.stubGlobal('window', { addEventListener: vi.fn(), dispatchEvent: vi.fn() })
vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body ?? '{}')) as
    { key: string; value?: string; patch?: string }
  srv.recebidos.push({ patch: body.patch, value: body.value })

  if (body.patch !== undefined) {
    srv.linha = { ...srv.linha, ...JSON.parse(body.patch) as Record<string, unknown> }
  } else if (body.value !== undefined) {
    srv.linha = JSON.parse(body.value) as Record<string, unknown>   // SUBSTITUI
  }
  return new Response(JSON.stringify({ ok: true, rev: 1 }), { status: 200 })
}))

const { syncToCloud, forceSync } = await import('../storage')

beforeEach(() => {
  localStorage.clear()
  srv.linha = {}
  srv.recebidos = []
})

describe('primeira gravação depois do F5 não apaga trabalho alheio', () => {
  it('manda PATCH, nunca o bloco inteiro, mesmo sem snapshot', async () => {
    syncToCloud('sm_states', { 10: { status: 5 } })
    await forceSync()

    expect(srv.recebidos).toHaveLength(1)
    expect(srv.recebidos[0].patch).toBeDefined()
    expect(srv.recebidos[0].value).toBeUndefined()
  })

  it('o card que esta aba nunca viu CONTINUA no servidor', async () => {
    // O servidor já tem 3 cards aprovados, feitos por outras pessoas.
    srv.linha = {
      1: { status: 5 }, 2: { status: 5 }, 3: { status: 7 },
    }

    // Uma aba recém-carregada, que só conhece o card 10, grava.
    syncToCloud('sm_states', { 10: { status: 1 } })
    await forceSync()

    // Os três continuam lá — antes viravam status 0 na tela ao sumirem daqui.
    expect(Object.keys(srv.linha).sort()).toEqual(['1', '10', '2', '3'])
    expect(srv.linha['1']).toEqual({ status: 5 })
    expect(srv.linha['2']).toEqual({ status: 5 })
    expect(srv.linha['3']).toEqual({ status: 7 })
  })

  it('a gravação da aba realmente chega', async () => {
    srv.linha = { 1: { status: 5 } }
    syncToCloud('sm_states', { 10: { status: 2 } })
    await forceSync()
    expect(srv.linha['10']).toEqual({ status: 2 })
  })

  it('chave não-patchável continua indo inteira (lista precisa substituir)', async () => {
    syncToCloud('sm_custom', [{ i: 1 }])
    await forceSync()
    expect(srv.recebidos[0].value).toBeDefined()
    expect(srv.recebidos[0].patch).toBeUndefined()
  })
})
