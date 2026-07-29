import { describe, expect, it, vi } from 'vitest'
import { onRequest } from '../mirror'

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

describe('/api/mirror sweep auth', () => {
  it('deve retornar 401 quando CRON_SECRET está definido mas Authorization está inválido', async () => {
    const request = new Request('https://localhost/api/mirror', {
      method: 'POST',
      headers: { Authorization: 'Bearer segredo-errado', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sweep' }),
    })

    const ctx = makeCtx(request, { DB: makeFakeDB(), CRON_SECRET: 'segredo-correcto', CRIATIVOS: { head: vi.fn(), delete: vi.fn() } })
    const response = await onRequest(ctx)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'Unauthorized' })
  })

  it('deve retornar 401 quando falta Authorization em sweep', async () => {
    const request = new Request('https://localhost/api/mirror', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sweep' }),
    })

    const ctx = makeCtx(request, { DB: makeFakeDB(), CRON_SECRET: 'segredo-correcto', CRIATIVOS: { head: vi.fn(), delete: vi.fn() } })
    const response = await onRequest(ctx)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'Unauthorized' })
  })
})
