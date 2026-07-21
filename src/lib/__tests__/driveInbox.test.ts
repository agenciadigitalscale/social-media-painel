import { describe, it, expect } from 'vitest'
import {
  isPending, needsToast, countPending, applyPatch, applyMarkSeen, REMIND_LATER_MS,
  type InboxStateMap,
} from '../driveInbox'

const NOW = 1_700_000_000_000

describe('isPending', () => {
  it('arquivo novo está pendente', () => {
    expect(isPending(undefined, NOW)).toBe(true)
  })

  it('arquivo apenas visto continua pendente (contador não zera sozinho)', () => {
    expect(isPending({ seenAt: NOW - 1000 }, NOW)).toBe(true)
  })

  it('Cenário 8 — fechar a Inbox não some com o arquivo, mas ele não alerta de novo', () => {
    const dismissed = { seenAt: NOW - 2000, dismissedAt: NOW - 1000 }
    expect(isPending(dismissed, NOW)).toBe(true)
    expect(needsToast(dismissed)).toBe(false)
  })

  it('Cenário 9 — arquivo ignorado sai dos pendentes e não gera alerta', () => {
    const ignored = { seenAt: NOW - 2000, ignoredAt: NOW - 1000 }
    expect(isPending(ignored, NOW)).toBe(false)
    expect(needsToast(ignored)).toBe(false)
  })

  it('"lembrar depois" adia e depois volta', () => {
    const later = { seenAt: NOW, remindAt: NOW + REMIND_LATER_MS }
    expect(isPending(later, NOW)).toBe(false)
    expect(isPending(later, NOW + REMIND_LATER_MS + 1)).toBe(true)
  })

  it('arquivo vinculado sai dos pendentes', () => {
    expect(isPending({ linkedAt: NOW }, NOW)).toBe(false)
  })
})

describe('needsToast', () => {
  it('Cenário 7 — só o arquivo nunca visto dispara toast', () => {
    expect(needsToast(undefined)).toBe(true)
    expect(needsToast({ seenAt: NOW })).toBe(false)
  })
})

describe('countPending', () => {
  it('conta apenas o que espera decisão', () => {
    const map: InboxStateMap = {
      a: { seenAt: NOW },
      b: { ignoredAt: NOW },
      c: { linkedAt: NOW },
      d: { remindAt: NOW + 10_000 },
    }
    expect(countPending(['a', 'b', 'c', 'd', 'e'], map, NOW)).toBe(2) // a e e
  })
})

describe('applyPatch / applyMarkSeen', () => {
  it('patch sem mudança mantém a mesma referência (não dispara re-render)', () => {
    const map: InboxStateMap = { a: { seenAt: NOW } }
    expect(applyPatch(map, 'a', { seenAt: NOW })).toBe(map)
  })

  it('marca vistos preservando quem já tinha sido visto', () => {
    const map: InboxStateMap = { a: { seenAt: 1 } }
    const next = applyMarkSeen(map, ['a', 'b'], NOW)
    expect(next.a.seenAt).toBe(1)
    expect(next.b.seenAt).toBe(NOW)
  })
})
