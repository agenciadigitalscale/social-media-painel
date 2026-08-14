import { describe, it, expect, vi } from 'vitest'
import { guardPanelRoute } from '../panel-guard'
import { signSession } from '../session'

const SECRET = 'segredo-de-teste'
const CORS = { 'Access-Control-Allow-Origin': '*' }

function req(cookie?: string) {
  return new Request('https://painel.exemplo/api/ai', {
    method: 'POST',
    headers: cookie ? { Cookie: cookie } : {},
  })
}

async function validCookie() {
  return `ds_session=${await signSession('kaique', Date.now() + 60_000, SECRET)}`
}

/** D1 falso: só precisa não explodir — a auditoria não pode derrubar requisição. */
function fakeDb() {
  const run = vi.fn().mockResolvedValue({})
  const first = vi.fn().mockResolvedValue(null)
  return { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run, first })) })) } as unknown as D1Database
}

describe('guardPanelRoute — modo observação (padrão)', () => {
  it('deixa passar sem sessão quando PANEL_REQUIRE_AUTH não está ligado', async () => {
    const blocked = await guardPanelRoute({ request: req(), env: { SESSION_SECRET: SECRET } }, CORS)
    expect(blocked).toBeNull()
  })

  it('deixa passar sem sessão nem segredo — o padrão não pode quebrar nada', async () => {
    const blocked = await guardPanelRoute({ request: req(), env: {} }, CORS)
    expect(blocked).toBeNull()
  })

  it('registra o acesso quando há DB, sem bloquear', async () => {
    const db = fakeDb()
    const blocked = await guardPanelRoute({ request: req(), env: { DB: db } }, CORS)
    expect(blocked).toBeNull()
    expect(db.prepare).toHaveBeenCalled()
  })

  it('funciona sem DB — endpoints como /api/ai nunca declararam o binding', async () => {
    const blocked = await guardPanelRoute({ request: req(), env: { SESSION_SECRET: SECRET } }, CORS)
    expect(blocked).toBeNull()
  })

  it('waitUntil que estoura NÃO derruba a requisição', async () => {
    // O caso real: `ctx.waitUntil` passado sem `.bind(ctx)` perde o `this` e
    // lança ao ser chamado. Como o flush do `audit.ts` é throttled em 1 min,
    // isso vira 500 INTERMITENTE — endpoint saudável que falha uma vez a cada
    // tantas. Medir o acesso não pode custar o acesso.
    //
    // `resetModules` é OBRIGATÓRIO aqui: o `lastFlush` do `audit.ts` é estado de
    // módulo, e os testes acima já gastaram a janela de 1 minuto. Sem o reset
    // este teste passa mesmo SEM a proteção — foi o que aconteceu na primeira
    // versão dele, e um teste que passa dos dois jeitos não vale nada.
    vi.resetModules()
    const { guardPanelRoute: fresh } = await import('../panel-guard')
    const explode = () => { throw new TypeError('Illegal invocation') }
    const blocked = await fresh(
      { request: req(), env: { DB: fakeDb() }, waitUntil: explode },
      CORS,
    )
    expect(blocked).toBeNull()
  })

  it('DB que estoura também não derruba a requisição', async () => {
    const brokenDb = { prepare: () => { throw new Error('D1 fora do ar') } } as unknown as D1Database
    const blocked = await guardPanelRoute({ request: req(), env: { DB: brokenDb } }, CORS)
    expect(blocked).toBeNull()
  })
})

describe('guardPanelRoute — chave virada', () => {
  const env = { SESSION_SECRET: SECRET, PANEL_REQUIRE_AUTH: '1' }

  it('recusa com 401 quem chega sem sessão', async () => {
    const blocked = await guardPanelRoute({ request: req(), env }, CORS)
    expect(blocked?.status).toBe(401)
  })

  it('deixa passar quem tem sessão válida', async () => {
    const blocked = await guardPanelRoute({ request: req(await validCookie()), env }, CORS)
    expect(blocked).toBeNull()
  })

  it('recusa cookie assinado com outro segredo', async () => {
    const forjado = `ds_session=${await signSession('kaique', Date.now() + 60_000, 'outro-segredo')}`
    const blocked = await guardPanelRoute({ request: req(forjado), env }, CORS)
    expect(blocked?.status).toBe(401)
  })

  it('recusa sessão expirada', async () => {
    const velho = `ds_session=${await signSession('kaique', Date.now() - 1000, SECRET)}`
    const blocked = await guardPanelRoute({ request: req(velho), env }, CORS)
    expect(blocked?.status).toBe(401)
  })

  it('responde 500 explicando quando falta SESSION_SECRET, em vez de trancar em silêncio', async () => {
    const blocked = await guardPanelRoute({ request: req(), env: { PANEL_REQUIRE_AUTH: '1' } }, CORS)
    expect(blocked?.status).toBe(500)
    const body = await blocked!.json() as { error: string }
    expect(body.error).toContain('SESSION_SECRET')
  })

  it('devolve o CORS de quem chamou — senão o painel vê erro de rede, não o 401', async () => {
    const blocked = await guardPanelRoute({ request: req(), env }, CORS)
    expect(blocked?.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('não deixa a recusa ser cacheada', async () => {
    const blocked = await guardPanelRoute({ request: req(), env }, CORS)
    expect(blocked?.headers.get('Cache-Control')).toBe('no-store')
  })
})
