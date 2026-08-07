import { describe, expect, it } from 'vitest'
import {
  auditVerdict, parseRoutes, QUIET_MS,
  type AuditPayload, type AuditRoute,
} from '../authAudit'

const NOW = 1_800_000_000_000
const H = 60 * 60 * 1000

const route = (p: Partial<AuditRoute>): AuditRoute => ({
  route: 'GET /api/sync', count: 2987, lastAt: NOW - 40 * H, auth: 13786, lastAuthAt: NOW - 1 * H, ...p,
})

const payload = (p: Partial<AuditPayload>): AuditPayload => ({
  ok: true, configured: true, enforcing: false, routes: [], ...p,
})

describe('parseRoutes', () => {
  it('transforma o mapa gravado em lista, com o nome da rota', () => {
    const r = parseRoutes({ 'GET /api/sync': { count: 5, lastAt: 100, auth: 9, lastAuthAt: 200, sample: 'Chrome' } })
    expect(r).toEqual([{ route: 'GET /api/sync', count: 5, lastAt: 100, auth: 9, lastAuthAt: 200, sample: 'Chrome' }])
  })

  it('campo ausente vira zero em vez de NaN', () => {
    const r = parseRoutes({ 'POST /api/sync': {} })[0]
    expect(r.count).toBe(0)
    expect(r.auth).toBe(0)
    expect(r.lastAuthAt).toBeUndefined()
  })

  it('nada gravado não quebra', () => {
    expect(parseRoutes(null)).toEqual([])
    expect(parseRoutes(undefined)).toEqual([])
  })
})

describe('auditVerdict', () => {
  it('sem SESSION_SECRET não manda fechar nada', () => {
    const v = auditVerdict(payload({ configured: false }), NOW)
    expect(v.status).toBe('unconfigured')
  })

  it('já fechado é dito, para ninguém pedir de novo', () => {
    expect(auditVerdict(payload({ enforcing: true }), NOW).status).toBe('enforcing')
  })

  it('falha ao ler não vira "está seguro"', () => {
    // Não conseguir olhar é diferente de olhar e não ver problema.
    const v = auditVerdict(payload({ error: 'HTTP 500' }), NOW)
    expect(v.status).toBe('error')
    expect(v.detail).toContain('não deu para olhar')
  })

  it('acesso anônimo recente bloqueia e aparece na lista', () => {
    const v = auditVerdict(payload({ routes: [route({ lastAt: NOW - 2 * H })] }), NOW)
    expect(v.status).toBe('blocked')
    expect(v.blocking).toHaveLength(1)
    expect(v.detail).toContain('logout/login')
  })

  it('o sinal é o lastAt, NÃO o total acumulado', () => {
    // `count` inclui a era anterior ao SESSION_SECRET e nunca zera; ler o total
    // faria a porta parecer eternamente aberta.
    const v = auditVerdict(payload({ routes: [route({ count: 999_999, lastAt: NOW - 40 * H })] }), NOW)
    expect(v.status).toBe('ready')
  })

  it('anônimo parado E autenticado parado não é sinal verde', () => {
    // Contador congelado pode ser "todo mundo autenticado" ou "ninguém usando".
    const v = auditVerdict(payload({
      routes: [route({ lastAt: NOW - 40 * H, lastAuthAt: NOW - 40 * H })],
    }), NOW)
    expect(v.status).toBe('no_signal')
    expect(v.detail).toContain('ninguém está usando')
  })

  it('anônimo parado com autenticado vivo libera', () => {
    const v = auditVerdict(payload({
      routes: [route({ lastAt: NOW - 40 * H, lastAuthAt: NOW - 30 * 60 * 1000 })],
    }), NOW)
    expect(v.status).toBe('ready')
    expect(v.detail).toContain('SYNC_REQUIRE_AUTH')
  })

  it('uma rota limpa não salva a outra suja', () => {
    // POST congelado e GET ainda recebendo anônimo foi exatamente o estado real
    // em 2026-07-30 — fechar ali teria dado 401 na leitura de quem trabalhava.
    const v = auditVerdict(payload({
      routes: [
        route({ route: 'POST /api/sync', lastAt: NOW - 40 * H }),
        route({ route: 'GET /api/sync',  lastAt: NOW - 3 * H }),
      ],
    }), NOW)
    expect(v.status).toBe('blocked')
    expect(v.blocking.map(r => r.route)).toEqual(['GET /api/sync'])
  })

  it('sem rota nenhuma não conclui nada', () => {
    expect(auditVerdict(payload({ routes: [] }), NOW).status).toBe('no_signal')
  })

  it('a janela é de 24h, exatamente', () => {
    const naBorda = auditVerdict(payload({ routes: [route({ lastAt: NOW - QUIET_MS })] }), NOW)
    expect(naBorda.status).toBe('ready')
    const dentro = auditVerdict(payload({ routes: [route({ lastAt: NOW - QUIET_MS + 1000 })] }), NOW)
    expect(dentro.status).toBe('blocked')
  })
})
