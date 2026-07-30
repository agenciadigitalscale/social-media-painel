import { describe, expect, it, vi } from 'vitest'
import { onRequestPost } from '../../role-auth'

/**
 * O buraco que estes testes fecham, medido em produção em 2026-07-30:
 *
 *   POST /api/role-auth {"action":"verify","role":"nao-existe"}
 *   → 200 + Set-Cookie: ds_session=…  (sem senha nenhuma)
 *
 * Um cargo inventado não achava linha em `role_passwords`, caía no ramo "cargo
 * sem senha entra direto" e ganhava sessão assinada de 8h. Com o `/api/sync`
 * fechado por `SYNC_REQUIRE_AUTH`, isso seria a chave pendurada na fechadura.
 */

const SECRET = 'segredo-de-teste'

/** D1 de mentira: devolve as linhas que o teste declarar, por prefixo de SQL. */
function makeDB(rows: { role: string; hash: string }[]) {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...args: unknown[]) => ({
        run: vi.fn(async () => ({})),
        first: vi.fn(async () => rows.find(r => r.role === args[0])),
        all: vi.fn(async () => ({ results: rows.filter(r => args.includes(r.role)) })),
      })),
      run: vi.fn(async () => ({})),
      first: vi.fn(async () => undefined),
      all: vi.fn(async () => ({ results: sql.includes('SELECT role FROM') ? rows : [] })),
    })),
  }
}

const post = (body: unknown, db: ReturnType<typeof makeDB>, env: Record<string, unknown> = {}) =>
  onRequestPost({
    request: new Request('https://localhost/api/role-auth', { method: 'POST', body: JSON.stringify(body) }),
    env: { DB: db, SESSION_SECRET: SECRET, ...env } as any,
    waitUntil: vi.fn(),
  } as any)

/** SHA-256 de `ds2026:<cargo>:<senha>` — a mesma fórmula do endpoint. */
async function hashFor(password: string, role: string): Promise<string> {
  const data = new TextEncoder().encode(`ds2026:${role.toLowerCase()}:${password}`)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

describe('verify — whitelist de cargo', () => {
  it('cargo inventado NÃO emite sessão', async () => {
    const res  = await post({ action: 'verify', role: 'nao-existe-teste' }, makeDB([]))
    const body = await res.json() as { ok: boolean }

    expect(body.ok).toBe(false)
    expect(res.headers.get('Set-Cookie')).toBeNull()
  })

  it('cargo que saiu da equipe NÃO emite sessão, mesmo com linha no banco', async () => {
    const db   = makeDB([{ role: 'geovana', hash: await hashFor('senha-dela', 'geovana') }])
    const res  = await post({ action: 'verify', role: 'geovana', password: 'senha-dela' }, db)
    const body = await res.json() as { ok: boolean }

    expect(body.ok).toBe(false)
    expect(res.headers.get('Set-Cookie')).toBeNull()
  })

  it('membro da equipe SEM senha entra e ganha sessão', async () => {
    const res  = await post({ action: 'verify', role: 'kaique' }, makeDB([]))
    const body = await res.json() as { ok: boolean; noPassword?: boolean }

    expect(body.ok).toBe(true)
    expect(body.noPassword).toBe(true)
    expect(res.headers.get('Set-Cookie')).toContain('ds_session=')
  })

  it('membro da equipe COM senha certa ganha sessão', async () => {
    const db  = makeDB([{ role: 'kaique', hash: await hashFor('certa', 'kaique') }])
    const res = await post({ action: 'verify', role: 'kaique', password: 'certa' }, db)

    expect((await res.json() as { ok: boolean }).ok).toBe(true)
    expect(res.headers.get('Set-Cookie')).toContain('ds_session=')
  })

  it('membro da equipe com senha ERRADA não ganha sessão', async () => {
    const db  = makeDB([{ role: 'kaique', hash: await hashFor('certa', 'kaique') }])
    const res = await post({ action: 'verify', role: 'kaique', password: 'errada' }, db)

    expect((await res.json() as { ok: boolean }).ok).toBe(false)
    expect(res.headers.get('Set-Cookie')).toBeNull()
  })
})

describe('set/remove — senha de administrador é conferida no SERVIDOR', () => {
  it('sem senha de admin, um `set` é recusado quando existe admin com senha', async () => {
    const db  = makeDB([{ role: 'kaique', hash: await hashFor('senha-do-kaique', 'kaique') }])
    const res = await post({ action: 'set', role: 'jhones', password: 'nova' }, db)

    expect((await res.json() as { ok: boolean }).ok).toBe(false)
  })

  it('senha de admin errada é recusada', async () => {
    const db  = makeDB([{ role: 'kaique', hash: await hashFor('senha-do-kaique', 'kaique') }])
    const res = await post({ action: 'set', role: 'jhones', password: 'nova', adminPassword: 'chute' }, db)

    expect((await res.json() as { ok: boolean }).ok).toBe(false)
  })

  it('senha de admin correta é aceita', async () => {
    const db  = makeDB([{ role: 'kaique', hash: await hashFor('senha-do-kaique', 'kaique') }])
    const res = await post({ action: 'set', role: 'jhones', password: 'nova', adminPassword: 'senha-do-kaique' }, db)

    expect((await res.json() as { ok: boolean }).ok).toBe(true)
  })

  it('`set` em cargo fora da equipe é recusado — não se cria credencial órfã', async () => {
    const db  = makeDB([{ role: 'kaique', hash: await hashFor('senha-do-kaique', 'kaique') }])
    const res = await post({ action: 'set', role: 'estranho', password: 'x', adminPassword: 'senha-do-kaique' }, db)

    expect((await res.json() as { ok: boolean }).ok).toBe(false)
  })

  it('`remove` aceita cargo FORA da lista — é assim que se limpa uma órfã', async () => {
    const db  = makeDB([{ role: 'kaique', hash: await hashFor('senha-do-kaique', 'kaique') }])
    const res = await post({ action: 'remove', role: 'geovana', adminPassword: 'senha-do-kaique' }, db)

    expect((await res.json() as { ok: boolean }).ok).toBe(true)
  })

  it('instalação nova (nenhum admin com senha) ainda deixa definir a primeira', async () => {
    const res = await post({ action: 'set', role: 'kaique', password: 'primeira' }, makeDB([]))

    expect((await res.json() as { ok: boolean }).ok).toBe(true)
  })
})
