import { describe, it, expect } from 'vitest'
import { mesclarEntrada, mesclarEstados, statusPodeEntrar } from '../mergeStates'

const T = 1_790_000_000_000

describe('sm_states: gravação antiga nunca vence a mais nova', () => {
  it('o caso real: aparelho com cópia velha edita só a observação → o status novo fica', () => {
    const servidor = { '9': { status: 4, statusAt: T + 1000, notes: '', title: 'X' } }
    // código novo: só o campo mudado
    const parcial = mesclarEstados(servidor, { '9': { notes: 'obs' } }, true, T + 2000)
    expect(parcial['9']).toMatchObject({ status: 4, statusAt: T + 1000, notes: 'obs', title: 'X' })
    // card inteiro com o status velho = cópia velha: ignorado INTEIRO (2026-10-22).
    // Antes o status era recusado e o resto gravava — foi assim que, em 20/10, uma
    // cópia de semanas atrás apagou histórico, link e envio de 18 vídeos.
    const inteiro = mesclarEstados(servidor, { '9': { status: 3, statusAt: T, notes: 'obs', title: 'X' } }, false, T + 2000)
    expect(inteiro['9']).toEqual(servidor['9'])
    // card inteiro SEM versão (painel aberto com código antigo): mesma coisa
    const legado = mesclarEstados(servidor, { '9': { status: 3, notes: 'obs', title: 'X' } }, false, T + 2000)
    expect(legado['9']).toEqual(servidor['9'])
  })

  it('a mudança mais nova entra; a última ação vence numa sequência', () => {
    let s: Record<string, unknown> = { '9': { status: 3, statusAt: T } }
    s = mesclarEstados(s, { '9': { status: 4, statusAt: T + 10 } }, true, T + 20)
    s = mesclarEstados(s, { '9': { status: 5, statusAt: T + 30 } }, true, T + 40)
    s = mesclarEstados(s, { '9': { status: 4, statusAt: T + 10 } }, true, T + 50) // resposta atrasada
    expect(s['9']).toMatchObject({ status: 5, statusAt: T + 30 })
  })

  it('dados de antes da regra (sem versão nos dois lados) continuam podendo mudar', () => {
    expect(statusPodeEntrar({ status: 3 }, { status: 4 })).toBe(true)
    expect(statusPodeEntrar({ status: 3 }, { status: 4, statusAt: T })).toBe(true)
    expect(statusPodeEntrar({ status: 3, statusAt: T }, { status: 4 })).toBe(false)
  })

  it('campo removido (null) sai; card novo entra inteiro', () => {
    const s = mesclarEstados({ '1': { status: 0, deliveryDate: T } }, { '1': { deliveryDate: null }, '2': { status: 1, statusAt: T, title: 'novo' } }, true, T)
    expect(s['1']).toEqual({ status: 0 })
    expect(s['2']).toEqual({ status: 1, statusAt: T, title: 'novo' })
  })

  it('relógio adiantado não trava o card no futuro', () => {
    const e = mesclarEntrada({ status: 3, statusAt: T }, { status: 4, statusAt: T + 3_600_000 }, true, T + 1000)
    expect(e).toMatchObject({ status: 4, statusAt: T + 1000 })
  })

  it('mesmo status: o carimbo não anda para trás', () => {
    const e = mesclarEntrada({ status: 4, statusAt: T + 50 }, { status: 4, statusAt: T + 10 }, true, T + 100)
    expect(e.statusAt).toBe(T + 50)
  })
})

describe('aba com código antigo (sem statusAt): vale o histórico', () => {
  it('versaoDoStatus: statusAt manda; sem ele, o último movimento do histórico', async () => {
    const { versaoDoStatus } = await import('../../../../src/lib/versaoStatus')
    expect(versaoDoStatus({ statusAt: T, history: [{ action: '→ Enviado', ts: T + 9 }] })).toBe(T)
    expect(versaoDoStatus({ history: [{ action: '→ Revisão', ts: T + 1 }, { action: 'Comentou', ts: T + 50 }, { action: '→ Aprovado', ts: T + 7 }] })).toBe(T + 7)
    expect(versaoDoStatus({ status: 3 })).toBe(0)
    expect(versaoDoStatus(null)).toBe(0)
  })

  it('movimento REAL feito numa aba antiga (histórico mais novo) entra', () => {
    const servidor = { '9': { status: 3, statusAt: T, history: [{ action: '→ Aprovado', ts: T }] } }
    const chegando = { '9': { status: 4, history: [{ action: '→ Aprovado', ts: T }, { action: '→ Enviado ao cliente', ts: T + 60_000 }] } }
    const out = mesclarEstados(servidor, chegando, false, T + 70_000)
    expect(out['9']).toMatchObject({ status: 4, statusAt: T + 60_000 })
  })

  it('cópia velha de aba antiga (histórico mais velho) continua recusada — inteira', () => {
    const servidor = { '9': { status: 4, statusAt: T + 60_000 } }
    const chegando = { '9': { status: 3, notes: 'obs', history: [{ action: '→ Aprovado', ts: T }] } }
    const out = mesclarEstados(servidor, chegando, false, T + 70_000)
    expect(out['9']).toEqual(servidor['9'])
  })
})

describe('cópia velha de outro computador (caso 20/10: histórico, link e envio apagados)', () => {
  const H_NOVO = [
    { action: '→ Em produção', ts: 100 },
    { action: '→ Revisão', ts: 200, user: 'kaique' },
    { action: '→ Publicado', ts: 300 },
  ]
  const atual = {
    status: 7, statusAt: 300, history: H_NOVO,
    link: 'https://drive/v', footageLink: 'https://drive/v', sentToClientAt: 250, deliveryDate: 9000,
  }

  it('card inteiro com status mais velho: ignorado inteiro — nada volta, nada some', () => {
    const velho = { status: 1, history: [{ action: '→ Em produção', ts: 100 }], deliveryDate: 1000 }
    expect(mesclarEstados({ '1': atual }, { '1': velho }, false, 1000)['1']).toEqual(atual)
  })

  it('card inteiro com mesmo status mas histórico mais curto e mais velho: também é cópia velha', () => {
    const velho = { status: 7, history: H_NOVO.slice(0, 2), deliveryDate: 1000 }
    expect(mesclarEstados({ '1': atual }, { '1': velho }, false, 1000)['1']).toEqual(atual)
  })

  it('card inteiro legítimo nunca apaga campo que ele não traz', () => {
    const novo = { status: 7, statusAt: 300, history: [...H_NOVO, { action: 'Comentário', ts: 400 }], caption: 'legenda' }
    const r = mesclarEstados({ '1': atual }, { '1': novo }, false, 1000)['1'] as Record<string, unknown>
    expect(r.link).toBe('https://drive/v')
    expect(r.sentToClientAt).toBe(250)
    expect(r.caption).toBe('legenda')
    expect((r.history as unknown[]).length).toBe(4)
  })

  it('histórico só cresce, até em gravação campo a campo', () => {
    const r = mesclarEstados({ '1': atual }, { '1': { history: H_NOVO.slice(0, 1) } }, true, 1000)['1'] as Record<string, unknown>
    expect(r.history).toEqual(H_NOVO)
  })

  it('histórico de dois lados se soma, sem repetir, em ordem', () => {
    const r = mesclarEstados({ '1': atual }, { '1': { history: [...H_NOVO.slice(0, 2), { action: 'Nota', ts: 350 }] } }, true, 1000)['1'] as Record<string, unknown>
    expect((r.history as { ts: number }[]).map(h => h.ts)).toEqual([100, 200, 300, 350])
  })

  it('campo a campo continua podendo remover de propósito (null)', () => {
    const r = mesclarEstados({ '1': atual }, { '1': { footageLink: null } }, true, 1000)['1'] as Record<string, unknown>
    expect(r.footageLink).toBeUndefined()
  })
})
