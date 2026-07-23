import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * O caminho do conflito, de ponta a ponta: servidor recusa por versão velha, o
 * cliente reaplica a mudança dele sobre o dado fresco e grava. Testado com um
 * servidor de mentira que se comporta como o `/api/sync` real.
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

/** Estado do servidor falso. */
const srv = { value: '', rev: 0, recusasRestantes: 0, gravacoes: [] as string[] }

vi.stubGlobal('localStorage', makeStorage())
vi.stubGlobal('navigator', { onLine: true })
vi.stubGlobal('console', { ...console, warn: vi.fn(), error: vi.fn() })
vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body ?? '{}')) as
    { key: string; value?: string; baseRev?: number }

  if (srv.recusasRestantes > 0 && body.baseRev !== undefined && body.baseRev !== srv.rev) {
    srv.recusasRestantes--
    return new Response(JSON.stringify({ ok: false, conflict: true, value: srv.value, rev: srv.rev }), { status: 409 })
  }
  if (body.value !== undefined) {
    srv.value = body.value
    srv.rev += 1
    srv.gravacoes.push(body.value)
  }
  return new Response(JSON.stringify({ ok: true, rev: srv.rev }), { status: 200 })
}))

const { syncToCloud, forceSync, noteServerRev } = await import('../storage')

const cardA = { i: 1, c: 'Padaria Sol', n: 'Reel institucional' }
const cardB = { i: 2, c: 'Padaria Sol', n: 'Post da semana' }
const cardC = { i: 3, c: 'Luthita',     n: 'Vídeo do chuveiro' }

beforeEach(() => {
  localStorage.clear()
  srv.value = ''
  srv.rev = 0
  srv.recusasRestantes = 0
  srv.gravacoes = []
})

describe('conflito ao salvar sm_custom', () => {
  it('o card do outro sobrevive à minha gravação', async () => {
    // Os dois partiram de [A]. O outro já gravou [A, C] no servidor.
    noteServerRev('sm_custom', 5, [cardA])
    srv.value = JSON.stringify([cardA, cardC])
    srv.rev = 6
    srv.recusasRestantes = 1

    // Eu crio o B e salvo com a versão 5, que já está velha.
    syncToCloud('sm_custom', [cardA, cardB])
    await forceSync()

    const gravado = JSON.parse(srv.gravacoes[srv.gravacoes.length - 1]) as typeof cardA[]
    expect(gravado.map(c => c.i).sort()).toEqual([1, 2, 3])
  })

  it('sem conflito, grava direto — uma requisição só', async () => {
    noteServerRev('sm_custom', 3, [cardA])
    srv.rev = 3

    syncToCloud('sm_custom', [cardA, cardB])
    await forceSync()

    expect(srv.gravacoes).toHaveLength(1)
    expect(JSON.parse(srv.gravacoes[0])).toEqual([cardA, cardB])
  })

  it('conflito que não cede: grava assim mesmo em vez de travar o usuário', async () => {
    noteServerRev('sm_custom', 1, [cardA])
    srv.value = JSON.stringify([cardA, cardC])
    srv.rev = 99
    srv.recusasRestantes = 10   // recusa sempre

    syncToCloud('sm_custom', [cardA, cardB])
    await forceSync()

    // O trabalho do usuário chegou ao servidor de qualquer forma.
    expect(srv.gravacoes.length).toBeGreaterThan(0)
    const ultimo = JSON.parse(srv.gravacoes[srv.gravacoes.length - 1]) as typeof cardA[]
    expect(ultimo.some(c => c.i === 2)).toBe(true)
  })
})
