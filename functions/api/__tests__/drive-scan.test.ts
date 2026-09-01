import { describe, expect, it, vi } from 'vitest'
import { onRequest } from '../drive-scan'

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
}) as unknown as Parameters<typeof onRequest>[0]

describe('/api/drive-scan auth', () => {
  it('deve retornar 401 quando CRON_SECRET está definido e a autorização está inválida', async () => {
    const request = new Request('https://localhost/api/drive-scan', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret-errado' },
    })

    const ctx = makeCtx(request, { DB: makeFakeDB(), CRON_SECRET: 'segredo-correcto' })
    const response = await onRequest(ctx)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: 'Cron auth inválido. Verifique CRON_SECRET no worker e no Pages.',
    })
  })

  it('deve retornar 401 quando falta Authorization e não é execução manual', async () => {
    const request = new Request('https://localhost/api/drive-scan', {
      method: 'POST',
    })

    const ctx = makeCtx(request, { DB: makeFakeDB(), CRON_SECRET: 'segredo-correcto' })
    const response = await onRequest(ctx)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })
})
