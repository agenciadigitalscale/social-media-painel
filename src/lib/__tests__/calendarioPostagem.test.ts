import { describe, it, expect } from 'vitest'
import { getUserPerms } from '../roles'

// Aba 32 — Calendário de postagem. Postagem é organização do Social Media:
// quem produz (editor, designer) e a copy trabalham pela entrega.
describe('Calendário de postagem (aba 32)', () => {
  it('sócios e Social Media veem', () => {
    for (const u of ['pradox', 'testa', 'arthur']) {
      expect(getUserPerms(u).hiddenTabs).not.toContain(32)
    }
  })

  it('editor, designers e copy não veem', () => {
    for (const u of ['kaique', 'jhones', 'julio', 'kerges']) {
      expect(getUserPerms(u).hiddenTabs).toContain(32)
    }
  })
})

// Aba 33 — Agendamento: a parte de agendar do Social. Mesma regra do calendário.
describe('Agendamento (aba 33)', () => {
  it('sócios e Social Media veem', () => {
    for (const u of ['pradox', 'testa', 'arthur']) {
      expect(getUserPerms(u).hiddenTabs).not.toContain(33)
    }
  })

  it('editor, designers e copy não veem', () => {
    for (const u of ['kaique', 'jhones', 'julio', 'kerges']) {
      expect(getUserPerms(u).hiddenTabs).toContain(33)
    }
  })
})

// Aba 34 — Painel de Tráfego: sócios e o gestor de tráfego (liberação por pessoa).
describe('Painel de Tráfego (aba 34)', () => {
  it('sócios e o gestor de tráfego veem', () => {
    for (const u of ['pradox', 'testa', 'robson', 'Robson ']) {
      expect(getUserPerms(u).hiddenTabs).not.toContain(34)
    }
  })

  it('Social, editor, designers e copy não veem', () => {
    for (const u of ['arthur', 'kaique', 'jhones', 'julio', 'kerges', 'desconhecido']) {
      expect(getUserPerms(u).hiddenTabs).toContain(34)
    }
  })
})

// Aba 35 — Proposta: só sócios.
describe('Proposta (aba 35)', () => {
  it('só sócios veem', () => {
    for (const u of ['pradox', 'testa']) expect(getUserPerms(u).hiddenTabs).not.toContain(35)
    for (const u of ['robson', 'arthur', 'kaique', 'jhones', 'julio', 'kerges']) expect(getUserPerms(u).hiddenTabs).toContain(35)
  })
})
