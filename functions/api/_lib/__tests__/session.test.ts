import { describe, it, expect } from 'vitest'
import { signSession, verifySession, getCookie, SESSION_MS } from '../session'

/**
 * A sessão é a única credencial que o painel terá quando o `/api/sync` fechar.
 * Até aqui ela não tinha teste nenhum — e um cadeado sem teste é enfeite.
 *
 * O que estes testes fixam, em ordem de gravidade: cookie forjado não entra,
 * cookie vencido não entra, e a falta de segredo recusa em vez de liberar.
 */

const SECRET = 'segredo-de-teste-nao-usar-em-producao'
const EMAIL  = 'kaique@role.dshub'

/** Monta o header Cookie como o navegador manda. */
const cookieHeader = (val: string, name = 'ds_session') => `${name}=${encodeURIComponent(val)}`

const daqui = (ms: number) => Date.now() + ms

describe('verifySession — quem entra', () => {
  it('aceita cookie válido e devolve a identidade', async () => {
    const token = await signSession(EMAIL, daqui(SESSION_MS), SECRET)
    expect(await verifySession(cookieHeader(token), { SESSION_SECRET: SECRET })).toBe(EMAIL)
  })

  it('convive com outros cookies no mesmo header', async () => {
    const token = await signSession(EMAIL, daqui(SESSION_MS), SECRET)
    const header = `theme=dark; ds_session=${encodeURIComponent(token)}; outro=1`
    expect(await verifySession(header, { SESSION_SECRET: SECRET })).toBe(EMAIL)
  })
})

describe('verifySession — quem NÃO entra', () => {
  it('recusa sem cookie nenhum', async () => {
    expect(await verifySession(null, { SESSION_SECRET: SECRET })).toBeNull()
    expect(await verifySession('', { SESSION_SECRET: SECRET })).toBeNull()
    expect(await verifySession('theme=dark', { SESSION_SECRET: SECRET })).toBeNull()
  })

  it('recusa sessão VENCIDA — é o que faz as 8h significarem alguma coisa', async () => {
    const token = await signSession(EMAIL, Date.now() - 1000, SECRET)
    expect(await verifySession(cookieHeader(token), { SESSION_SECRET: SECRET })).toBeNull()
  })

  it('recusa assinatura trocada', async () => {
    const token = await signSession(EMAIL, daqui(SESSION_MS), SECRET)
    const adulterado = token.slice(0, token.lastIndexOf('.') + 1) + 'assinaturaFalsa'
    expect(await verifySession(cookieHeader(adulterado), { SESSION_SECRET: SECRET })).toBeNull()
  })

  it('recusa payload adulterado — trocar de identidade invalida a assinatura', async () => {
    const token = await signSession('convidado@role.dshub', daqui(SESSION_MS), SECRET)
    const sig = token.slice(token.lastIndexOf('.'))
    // Mesma assinatura, outro dono: é a tentativa óbvia de escalar privilégio.
    const forjado = btoa(`pradox@role.dshub:${daqui(SESSION_MS)}`) + sig
    expect(await verifySession(cookieHeader(forjado), { SESSION_SECRET: SECRET })).toBeNull()
  })

  it('recusa validade esticada — remarcar o prazo invalida a assinatura', async () => {
    const token = await signSession(EMAIL, Date.now() - 1000, SECRET)
    const sig = token.slice(token.lastIndexOf('.'))
    const esticado = btoa(`${EMAIL}:${daqui(SESSION_MS)}`) + sig
    expect(await verifySession(cookieHeader(esticado), { SESSION_SECRET: SECRET })).toBeNull()
  })

  it('recusa cookie assinado com OUTRO segredo', async () => {
    const token = await signSession(EMAIL, daqui(SESSION_MS), 'outro-segredo')
    expect(await verifySession(cookieHeader(token), { SESSION_SECRET: SECRET })).toBeNull()
  })

  it('recusa lixo sem ponto separador', async () => {
    expect(await verifySession(cookieHeader('cookie-sem-assinatura'), { SESSION_SECRET: SECRET })).toBeNull()
  })

  /**
   * Falha FECHADA. O auth.ts já caiu num `?? 'ds-hub-change-this-secret'` — um
   * valor escrito neste repositório, que tornava qualquer cookie forjável.
   */
  it('sem SESSION_SECRET não valida NADA, nem cookie legítimo', async () => {
    const token = await signSession(EMAIL, daqui(SESSION_MS), SECRET)
    expect(await verifySession(cookieHeader(token), {})).toBeNull()
    expect(await verifySession(cookieHeader(token), { SESSION_SECRET: '' })).toBeNull()
  })
})

describe('getCookie', () => {
  it('acha o cookie no meio do header e decodifica', () => {
    expect(getCookie('a=1; ds_session=abc%2Bdef; b=2', 'ds_session')).toBe('abc+def')
  })

  it('não confunde com cookie de nome parecido', () => {
    // `ds_session_backup` contém o nome inteiro: casar por substring pegaria o
    // valor errado e a pessoa entraria com uma credencial que não é a dela.
    expect(getCookie('ds_session_backup=xyz', 'ds_session')).toBeNull()
  })

  it('devolve null quando não há header', () => {
    expect(getCookie(null, 'ds_session')).toBeNull()
  })
})
