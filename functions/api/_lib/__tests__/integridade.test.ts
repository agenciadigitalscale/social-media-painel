import { describe, it, expect } from 'vitest'
import { impressao, comparar, grave, resumir } from '../integridade'

const base = () => ({
  states: {
    '1': { status: 7, history: [{ ts: 1 }, { ts: 2 }, { ts: 3 }], link: 'l', sentToClientAt: 5, publishedAt: 9, caption: 'x' },
    '2': { status: 1, history: [{ ts: 1 }], link: 'l2' },
    '3': { status: 9, history: [{ ts: 1 }], anexos: [{ url: 'u' }], caption: 'c' },
  } as Record<string, unknown>,
  custom: [{ i: 1 }, { i: 2 }, { i: 3 }],
  deleted: [] as unknown[],
  roteiros: { 'auto:2026-10:A': {}, 'auto:2026-10:B': {} } as Record<string, unknown>,
})

describe('alarme de perda de dados', () => {
  it('uso normal (cresceu, card novo, arquivou um) não toca', () => {
    const a = impressao(base(), 1)
    const d = base()
    ;(d.states['2'] as any).history.push({ ts: 9 })
    d.states['4'] = { status: 0 }
    d.custom.push({ i: 4 })
    d.deleted.push(2)
    const r = comparar(a, impressao(d, 2))
    expect(grave(r)).toBe(false)
  })

  it('o caso de 20/10: histórico encolheu e carimbos sumiram → toca', () => {
    const a = impressao(base(), 1)
    const d = base()
    d.states['1'] = { status: 7, history: [{ ts: 1 }], link: '' }
    const r = comparar(a, impressao(d, 2))
    expect(r.perderamHistorico).toEqual([{ id: '1', de: 3, para: 1 }])
    expect(r.perderamCampos[0].campos).toEqual(expect.arrayContaining(['link', 'sentToClientAt', 'publishedAt', 'caption']))
    expect(grave(r)).toBe(true)
    expect(resumir(r)).toContain('perderam histórico')
  })

  it('card apagado do cadastro ou roteiro sumido → toca', () => {
    const a = impressao(base(), 1)
    const d = base()
    d.custom = [{ i: 1 }, { i: 3 }]
    delete d.roteiros['auto:2026-10:B']
    const r = comparar(a, impressao(d, 2))
    expect(r.sumiramDoCadastro).toEqual([2])
    expect(r.roteirosQueSumiram).toEqual(['auto:2026-10:B'])
    expect(grave(r)).toBe(true)
  })

  it('um link trocado/removido sozinho é ruído; vários juntos tocam', () => {
    const a = impressao(base(), 1)
    const um = base(); (um.states['2'] as any).link = ''
    expect(grave(comparar(a, impressao(um, 2)))).toBe(false)
    const tres = base(); (tres.states['1'] as any).caption = ''; (tres.states['2'] as any).link = ''; (tres.states['3'] as any).caption = ''
    expect(grave(comparar(a, impressao(tres, 2)))).toBe(true)
  })

  it('muitos arquivados de uma vez → toca', () => {
    const a = impressao(base(), 1)
    const d = base(); d.deleted = Array.from({ length: 15 }, (_, i) => i)
    expect(grave(comparar(a, impressao(d, 2)))).toBe(true)
  })
})
