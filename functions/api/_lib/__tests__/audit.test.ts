import { describe, it, expect } from 'vitest'
import { mergeRouteStats } from '../audit'

/**
 * Este número é o que decide se dá para fechar o `/api/sync`.
 *
 * Errar aqui não quebra nada visivelmente — só faz alguém trancar a equipe
 * inteira fora do painel, ou deixar a porta aberta achando que fechou. Daí os
 * testes: o sinal que estamos esperando é "auth subindo, count congelado", e
 * ele precisa ser confiável.
 */

const ROTA = 'POST /api/sync'
const anon = (count: number, lastAt: number, sample?: string) => ({ count, lastAt, sample })
const auth = (n: number, lastAuthAt: number) => ({ count: 0, lastAt: 0, auth: n, lastAuthAt })

describe('mergeRouteStats — acumulação', () => {
  it('soma anônimos sobre o que já estava gravado', () => {
    const out = mergeRouteStats({ [ROTA]: anon(100, 1000) }, [[ROTA, anon(5, 2000)]])
    expect(out[ROTA].count).toBe(105)
    expect(out[ROTA].lastAt).toBe(2000)
  })

  it('soma autenticados sem inventar anônimo', () => {
    const out = mergeRouteStats({}, [[ROTA, auth(3, 5000)]])
    expect(out[ROTA].count).toBe(0)
    expect(out[ROTA].auth).toBe(3)
    expect(out[ROTA].lastAuthAt).toBe(5000)
  })

  it('parte do zero quando a rota é nova', () => {
    const out = mergeRouteStats({}, [[ROTA, anon(1, 10)]])
    expect(out[ROTA]).toMatchObject({ count: 1, lastAt: 10 })
  })
})

describe('mergeRouteStats — o sinal de que dá para fechar', () => {
  /**
   * O caso que motivou o campo: depois de configurar o SESSION_SECRET, os
   * lotes passam a ser só de autenticados. Se `lastAt` andasse junto, quem
   * lesse a auditoria veria "acesso sem sessão agora há pouco" para sempre e
   * nunca teria coragem de virar a chave.
   */
  it('lote só de autenticados NÃO avança o carimbo dos anônimos', () => {
    const antes = { [ROTA]: anon(5126, 1000, 'Chrome') }
    const out = mergeRouteStats(antes, [[ROTA, auth(40, 9000)]])
    expect(out[ROTA].count).toBe(5126)
    expect(out[ROTA].lastAt).toBe(1000)     // congelado — é o sinal
    expect(out[ROTA].auth).toBe(40)
    expect(out[ROTA].lastAuthAt).toBe(9000)
  })

  it('um anônimo perdido no meio REAPARECE no carimbo', () => {
    const antes = { [ROTA]: { count: 5126, lastAt: 1000, auth: 40, lastAuthAt: 9000 } }
    const out = mergeRouteStats(antes, [[ROTA, { count: 1, lastAt: 12000, auth: 10, lastAuthAt: 12000 }]])
    expect(out[ROTA].count).toBe(5127)
    expect(out[ROTA].lastAt).toBe(12000)    // voltou a andar: ainda não pode fechar
    expect(out[ROTA].auth).toBe(50)
  })

  it('preserva o histórico de auth quando o lote é só anônimo', () => {
    const antes = { [ROTA]: { count: 1, lastAt: 100, auth: 40, lastAuthAt: 9000 } }
    const out = mergeRouteStats(antes, [[ROTA, anon(2, 200)]])
    expect(out[ROTA].auth).toBe(40)
    expect(out[ROTA].lastAuthAt).toBe(9000)
  })
})

describe('mergeRouteStats — amostra e limite', () => {
  it('mantém a amostra de User-Agent já registrada', () => {
    const antes = { [ROTA]: anon(1, 100, 'Chrome/Windows') }
    const out = mergeRouteStats(antes, [[ROTA, anon(1, 200)]])
    expect(out[ROTA].sample).toBe('Chrome/Windows')
  })

  it('não deixa a lista crescer sem fim', () => {
    const lote: Array<[string, ReturnType<typeof anon>]> = []
    for (let i = 0; i < 80; i++) lote.push([`GET /rota-${i}`, anon(1, i)])
    const out = mergeRouteStats({}, lote)
    expect(Object.keys(out).length).toBeLessThanOrEqual(60)
  })

  it('ao podar, mantém as rotas mais recentes — inclusive as só-autenticadas', () => {
    const lote: Array<[string, { count: number; lastAt: number; auth?: number; lastAuthAt?: number }]> = []
    for (let i = 0; i < 70; i++) lote.push([`GET /velha-${i}`, anon(1, i)])
    lote.push(['POST /api/sync', auth(1, 999999)])
    const out = mergeRouteStats({}, lote)
    expect(out['POST /api/sync']).toBeDefined()
  })
})
