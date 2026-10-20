import { describe, it, expect } from 'vitest'
import { getUserPerms, ABA_ROTEIROS } from '../roles'

const ve = (u: string) => !getUserPerms(u).hiddenTabs.includes(ABA_ROTEIROS)

describe('aba Roteiros (esteira do mês)', () => {
  it('Kaique, Arthur, Kerges e os sócios veem', () => {
    for (const u of ['kaique', 'arthur', 'kerges', 'pradox', 'testa']) expect(ve(u), u).toBe(true)
  })
  it('o resto da equipe não vê', () => {
    for (const u of ['robson', 'jhones', 'julio']) expect(ve(u), u).toBe(false)
  })
  it('liberar a aba não libera outra coisa (o Kerges segue sem o Painel de Tráfego)', () => {
    expect(getUserPerms('kerges').hiddenTabs.includes(34)).toBe(true)
  })
})
