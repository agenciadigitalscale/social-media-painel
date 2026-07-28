import { describe, it, expect, vi } from 'vitest'

/**
 * O card volta para a coluna de origem.
 *
 * Sintoma relatado em produção: arrastar vários cards para "Aprovado" e, minutos
 * depois, todos de volta onde estavam. Não era o arraste falhando — era OUTRA
 * aba desfazendo.
 *
 * `_sentSnapshot` vive em memória. Enquanto ele nascia vazio a cada F5, a
 * primeira gravação de uma aba recém-aberta saía SEM base e reafirmava o estado
 * de todos os cards que ela conhecia — inclusive os que outra pessoa tinha
 * acabado de mover. A gravação de quem arrastou era sobrescrita pela abertura de
 * página de qualquer colega.
 *
 * A base agora é semeada do localStorage na importação do módulo: a primeira
 * gravação leva só o que mudou DESDE que a página abriu.
 */

function makeStorage(inicial: Record<string, string> = {}): Storage {
  const data = new Map<string, string>(Object.entries(inicial))
  return {
    get length() { return data.size },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, String(v)) },
    removeItem: (k: string) => { data.delete(k) },
    clear: () => { data.clear() },
  } as Storage
}

/**
 * Estado do disco quando a "aba do colega" abre: ele tem os cards 1 e 2 em "A
 * fazer" (0), porque a cópia dele é de antes de alguém arrastá-los.
 */
const DISCO_ANTIGO = {
  sm_states: JSON.stringify({
    1: { status: 0 }, 2: { status: 0 }, 3: { status: 1 },
  }),
}

const srv = { linha: {} as Record<string, unknown>, recebidos: [] as Array<{ patch?: string; value?: string }> }

vi.stubGlobal('localStorage', makeStorage(DISCO_ANTIGO))
vi.stubGlobal('navigator', { onLine: true })
vi.stubGlobal('console', { ...console, warn: vi.fn(), error: vi.fn() })
vi.stubGlobal('window', { addEventListener: vi.fn(), dispatchEvent: vi.fn() })
vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body ?? '{}')) as { key: string; value?: string; patch?: string }
  srv.recebidos.push({ patch: body.patch, value: body.value })
  if (body.patch !== undefined) {
    srv.linha = { ...srv.linha, ...JSON.parse(body.patch) as Record<string, unknown> }
  } else if (body.value !== undefined) {
    srv.linha = JSON.parse(body.value) as Record<string, unknown>
  }
  return new Response(JSON.stringify({ ok: true, rev: 1 }), { status: 200 })
}))

// A importação acontece com o disco já povoado — é o que semeia a base.
const { syncToCloud, forceSync } = await import('../storage')

describe('arraste não é desfeito pela abertura de página de um colega', () => {
  it('a primeira gravação leva só o que mudou depois do F5', async () => {
    // Enquanto isso, outra pessoa arrastou os cards 1 e 2 para Aprovado (5).
    srv.linha = { 1: { status: 5 }, 2: { status: 5 }, 3: { status: 1 } }

    // Esta aba (cópia velha) mexe APENAS no card 3.
    syncToCloud('sm_states', { 1: { status: 0 }, 2: { status: 0 }, 3: { status: 2 } })
    await forceSync()

    const ultimo = srv.recebidos[srv.recebidos.length - 1]
    const patch = JSON.parse(ultimo.patch!) as Record<string, unknown>

    // Só o card 3 viaja. Os cards 1 e 2 nem são mencionados.
    expect(Object.keys(patch)).toEqual(['3'])

    // E no servidor o arraste do colega continua de pé.
    expect(srv.linha['1']).toEqual({ status: 5 })
    expect(srv.linha['2']).toEqual({ status: 5 })
    expect(srv.linha['3']).toEqual({ status: 2 })
  })
})
