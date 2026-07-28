import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * O que acontece com o trabalho pendente quando o servidor recusa por falta de
 * sessão (401) — o cenário exato do dia em que `SYNC_REQUIRE_AUTH` for ligado.
 *
 * A fila é a última linha de defesa: se ela descartar uma gravação que NÃO
 * subiu, o trabalho some sem ninguém perceber. Era o que acontecia — a entrada
 * saía da fila por ter sido *tentada*, não por ter sido *confirmada*.
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

const srv = { autorizado: true, gravacoes: [] as string[], chamadas: 0 }

vi.stubGlobal('localStorage', makeStorage())
vi.stubGlobal('navigator', { onLine: true })
vi.stubGlobal('console', { ...console, warn: vi.fn(), error: vi.fn() })
vi.stubGlobal('window', { addEventListener: vi.fn(), dispatchEvent: vi.fn() })
vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
  srv.chamadas++
  if (!srv.autorizado) {
    return new Response(JSON.stringify({ ok: false, error: 'Sessão necessária' }), { status: 401 })
  }
  // `sm_states` é chave patchável: depois do primeiro envio o cliente manda
  // `patch` em vez de `value`. Um mock que só olha `value` daria falso negativo.
  const body = JSON.parse(String(init?.body ?? '{}')) as { key: string; value?: string; patch?: string }
  const gravado = body.value ?? body.patch
  if (gravado !== undefined) srv.gravacoes.push(gravado)
  return new Response(JSON.stringify({ ok: true, rev: 1, merged: 1 }), { status: 200 })
}))

const { syncToCloud, forceSync } = await import('../storage')

const FILA = 'sm_sync_queue'
const fila = () => JSON.parse(localStorage.getItem(FILA) ?? '[]') as Array<{ key: string; value: string }>

beforeEach(() => {
  localStorage.clear()
  srv.autorizado = true
  srv.gravacoes = []
  srv.chamadas = 0
})

describe('401 no /api/sync — o dia em que a porta fechar', () => {
  it('NÃO descarta a gravação recusada: ela fica na fila', async () => {
    srv.autorizado = false
    syncToCloud('sm_states', { 1: { status: 2 } })
    await forceSync()

    expect(srv.gravacoes).toHaveLength(0)
    expect(fila().map(e => e.key)).toContain('sm_states')
  })

  it('depois do login, o que ficou na fila sobe', async () => {
    srv.autorizado = false
    syncToCloud('sm_states', { 1: { status: 2 } })
    await forceSync()
    expect(srv.gravacoes).toHaveLength(0)

    // A pessoa refaz o login e uma nova gravação dispara o flush.
    srv.autorizado = true
    await forceSync()

    expect(srv.gravacoes).toHaveLength(1)
    expect(fila()).toHaveLength(0)
  })

  /**
   * Sem esta trava o conserto acima vira um problema pior: a fila nunca esvazia
   * sem sessão, e o reencadeamento automático martelaria o servidor sem parar.
   */
  it('não entra em loop quente enquanto não há sessão', async () => {
    srv.autorizado = false
    syncToCloud('sm_states', { 1: { status: 2 } })
    await forceSync()

    // Uma tentativa por chave, e para. Não reencadeia por não ter progredido.
    expect(srv.chamadas).toBeLessThanOrEqual(2)
  })

  it('gravação confirmada continua saindo da fila normalmente', async () => {
    syncToCloud('sm_states', { 1: { status: 2 } })
    await forceSync()

    expect(srv.gravacoes).toHaveLength(1)
    expect(fila()).toHaveLength(0)
  })
})
