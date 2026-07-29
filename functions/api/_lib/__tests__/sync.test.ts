import { describe, expect, it, vi } from 'vitest'
import { onRequest } from '../../sync'

const makeFakeDB = () => ({
  prepare: vi.fn(() => ({
    run: vi.fn(async () => ({})),
    first: vi.fn(async () => undefined),
    all: vi.fn(async () => ({ results: [] })),
  })),
})

const makeCtx = (request: Request, env: Record<string, unknown>) => ({
  request,
  env: env as any,
  waitUntil: vi.fn() as unknown as (p: Promise<unknown>) => void,
})

describe('/api/sync guard', () => {
  it('deve retornar 500 se SYNC_REQUIRE_AUTH=1 e SESSION_SECRET não está definido', async () => {
    const request = new Request('https://localhost/api/sync')
    const ctx = makeCtx(request, { DB: makeFakeDB(), SYNC_REQUIRE_AUTH: '1' })

    const response = await onRequest(ctx)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body).toMatchObject({ ok: false, error: expect.stringContaining('SESSION_SECRET') })
  })

  it('deve retornar 401 sem sessão quando SYNC_REQUIRE_AUTH=1 e SESSION_SECRET está definido', async () => {
    const request = new Request('https://localhost/api/sync')
    const ctx = makeCtx(request, { DB: makeFakeDB(), SYNC_REQUIRE_AUTH: '1', SESSION_SECRET: 'segredo-de-teste' })

    const response = await onRequest(ctx)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toMatchObject({ ok: false, error: 'Sessão necessária' })
  })
})
