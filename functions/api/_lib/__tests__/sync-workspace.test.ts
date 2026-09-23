import { describe, expect, it, vi } from 'vitest'
import { onRequest } from '../../sync'

/**
 * Onda 1b: prova de que o `/api/sync` isola tenants DE VERDADE, pelo handler real.
 * Sem sessão exigida (SYNC_REQUIRE_AUTH ausente) — o foco aqui é o escopo, não a
 * autenticação, que tem os próprios testes.
 *
 * O que trava: a Digital Scale (sem header) grava `sm_states` SEM prefixo; a
 * Studio X (X-DS-Workspace) grava em `ws:studio-x:sm_states`; e o bulk GET de cada
 * uma devolve só as próprias chaves, já com o nome lógico `sm_states`.
 */

// D1 em memória mínimo: guarda por chave e entende as consultas que o sync usa.
function makeStoreDB() {
  const store = new Map<string, { value: string; rev: number }>()
  const prep = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => ({}),
      first: async () => {
        if (sql.includes('INSERT INTO app_data')) {
          const key = String(args[0]); const value = String(args[1])
          const rev = (store.get(key)?.rev ?? 0) + 1
          store.set(key, { value, rev })
          return { rev }
        }
        if (sql.includes('SELECT value, rev FROM app_data WHERE key = ?1')) {
          const r = store.get(String(args[0]))
          return r ? { value: r.value, rev: r.rev } : undefined
        }
        if (sql.includes('SELECT rev FROM app_data WHERE key = ?1')) {
          const r = store.get(String(args[0])); return r ? { rev: r.rev } : undefined
        }
        if (sql.includes('SELECT value FROM app_data WHERE key = ?1')) {
          const r = store.get(String(args[0])); return r ? { value: r.value } : undefined
        }
        return undefined
      },
      all: async () => {
        // PRAGMA table_info → diz que a coluna `rev` já existe (não dispara ALTER).
        if (sql.includes('PRAGMA')) {
          return { results: [{ name: 'key' }, { name: 'value' }, { name: 'updated' }, { name: 'rev' }] }
        }
        const rows = [...store.entries()].map(([key, v]) => ({ key, value: v.value, rev: v.rev }))
        if (sql.includes("NOT LIKE 'ws:%'")) return { results: rows.filter(r => !r.key.startsWith('ws:')) }
        if (sql.includes('key LIKE ?1')) {
          const pat = String(args[0]).replace(/%$/, '')
          return { results: rows.filter(r => r.key.startsWith(pat)) }
        }
        return { results: [] }
      },
    }
    return api
  }
  return { store, prepare: (sql: string) => prep(sql) }
}

const makeCtx = (request: Request, env: Record<string, unknown>) => ({
  request, env: env as any, waitUntil: vi.fn() as unknown as (p: Promise<unknown>) => void,
}) as unknown as Parameters<typeof onRequest>[0]

const post = (db: unknown, key: string, value: string, workspace?: string) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (workspace) headers['X-DS-Workspace'] = workspace
  return onRequest(makeCtx(
    new Request('https://x/api/sync', { method: 'POST', headers, body: JSON.stringify({ key, value }) }),
    { DB: db },
  ))
}

const getAll = async (db: unknown, workspace?: string) => {
  const headers: Record<string, string> = {}
  if (workspace) headers['X-DS-Workspace'] = workspace
  const res = await onRequest(makeCtx(new Request('https://x/api/sync', { headers }), { DB: db }))
  return (await res.json()) as { data: { key: string; value: string }[] }
}

describe('/api/sync — isolamento por workspace (Onda 1b)', () => {
  it('grava a Digital Scale sem prefixo e a Studio X com ws:studio-x:', async () => {
    const db = makeStoreDB()
    await post(db, 'sm_states', '{"digital":1}')
    await post(db, 'sm_states', '{"studio":1}', 'studio-x')

    expect(db.store.get('sm_states')?.value).toBe('{"digital":1}')
    expect(db.store.get('ws:studio-x:sm_states')?.value).toBe('{"studio":1}')
    // não vazou um no outro
    expect(db.store.has('ws:digital-scale:sm_states')).toBe(false)
  })

  it('cada workspace lê só as próprias chaves, com o nome lógico sm_states', async () => {
    const db = makeStoreDB()
    await post(db, 'sm_states', '{"digital":1}')
    await post(db, 'sm_states', '{"studio":1}', 'studio-x')

    const digital = await getAll(db)
    expect(digital.data).toEqual([{ key: 'sm_states', value: '{"digital":1}', rev: 1 }])

    const studio = await getAll(db, 'studio-x')
    expect(studio.data).toEqual([{ key: 'sm_states', value: '{"studio":1}', rev: 1 }])
  })

  it('a Digital Scale NÃO enxerga as chaves ws:% de outro tenant', async () => {
    const db = makeStoreDB()
    await post(db, 'sm_states', '{"studio":1}', 'studio-x')
    const digital = await getAll(db)
    expect(digital.data).toEqual([]) // só existe chave da studio-x, e ela é prefixada
  })
})
