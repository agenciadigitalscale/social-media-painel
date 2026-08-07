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

// ── GET /api/mirror — cobertura do espelho ───────────────────────────────────

/**
 * D1 que responde às duas consultas da cobertura: os itens em status 4/5
 * (`json_each` sobre sm_states) e as linhas de `drive_videos`.
 */
const coverageDB = (itemIds: number[], rows: unknown[]) => ({
  prepare: vi.fn((sql: string) => ({
    bind: vi.fn(function (this: unknown) { return this }),
    run:  vi.fn(async () => ({ meta: { changes: 0 } })),
    first: vi.fn(async () => undefined),
    all: vi.fn(async () => (
      sql.includes('drive_videos')
        ? { results: rows }
        : { results: itemIds.map(id => ({ id })) }
    )),
  })),
})

const row = (p: Record<string, unknown> = {}) => ({
  drive_file_id: 'file-aaaaaaaaaa', linked_item_id: 1005,
  client_name: 'Lareiras Grill', filename: 'video.mp4',
  file_size_bytes: 91 * 1024 * 1024, ...p,
})

const getReq = () => new Request('https://localhost/api/mirror')

describe('GET /api/mirror — cobertura', () => {
  it('diz quantos criativos no ar estão no espelho', async () => {
    const head = vi.fn(async (key: string) => (key.includes('esta') ? { size: 10 } : null))
    const env = {
      DB: coverageDB([1005, 1006], [row({ drive_file_id: 'esta-no-espelho' }), row({ drive_file_id: 'falta-aaaaa', linked_item_id: 1006 })]),
      CRIATIVOS: { head },
    }

    const body = await (await onRequest(makeCtx(getReq(), env))).json() as {
      ok: boolean; total: number; mirrored: number; files: { fileId: string; mirrored: boolean }[]
    }

    expect(body).toMatchObject({ ok: true, total: 2, mirrored: 1 })
    expect(body.files.find(f => f.fileId === 'falta-aaaaa')!.mirrored).toBe(false)
  })

  it('marca o arquivo acima do teto de 600 MB', async () => {
    // Insistir nele só gastaria banda: o POST recusa por Content-Length.
    const env = {
      DB: coverageDB([1005], [row({ file_size_bytes: 1_600_000_000 })]),
      CRIATIVOS: { head: vi.fn(async () => null) },
    }
    const body = await (await onRequest(makeCtx(getReq(), env))).json() as { files: { tooBig: boolean }[] }
    expect(body.files[0].tooBig).toBe(true)
  })

  it('R2 que estoura vira "não espelhado", não "espelhado"', async () => {
    // Falhar para o lado seguro: marcar como espelhado esconderia o problema
    // exatamente quando ele importa.
    const env = {
      DB: coverageDB([1005], [row()]),
      CRIATIVOS: { head: vi.fn(async () => { throw new Error('R2 fora') }) },
    }
    const body = await (await onRequest(makeCtx(getReq(), env))).json() as { mirrored: number; files: { mirrored: boolean }[] }
    expect(body.mirrored).toBe(0)
    expect(body.files[0].mirrored).toBe(false)
  })

  it('sem espelho configurado responde configured=false, não erro de servidor', async () => {
    const res = await onRequest(makeCtx(getReq(), { DB: coverageDB([], []) }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ configured: false })
  })

  it('nenhum criativo com o cliente não consulta drive_videos nem o R2', async () => {
    const head = vi.fn()
    const db = coverageDB([], [])
    const body = await (await onRequest(makeCtx(getReq(), { DB: db, CRIATIVOS: { head } }))).json() as { total: number }
    expect(body.total).toBe(0)
    expect(head).not.toHaveBeenCalled()
  })
})
