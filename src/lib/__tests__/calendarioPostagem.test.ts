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
