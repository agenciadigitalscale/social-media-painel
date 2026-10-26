import { describe, it, expect } from 'vitest'
import { getUserPerms } from '../roles'
import { cargoDe, isIsolado, membrosDoCargo } from '../access'
import { NAME_MAP } from '../users'
import { isValidUser } from '../../../functions/api/_lib/users'

describe('acesso da Emanuelly (editora de vídeo, 2026-10-26)', () => {
  it('é editora, isolada nos cards dela, e conta como editor', () => {
    expect(cargoDe('emanuelly')).toBe('editor')
    expect(isIsolado('emanuelly')).toBe(true)
    expect(membrosDoCargo('editor')).toEqual(expect.arrayContaining(['kaique', 'emanuelly']))
  })
  it('vê exatamente as mesmas abas do cargo editor (sem a Roteiros, que é liberada por pessoa ao Kaique)', () => {
    const e = new Set(getUserPerms('emanuelly').hiddenTabs)
    const k = new Set(getUserPerms('kaique').hiddenTabs)
    k.add(37) // Roteiros: liberada ao Kaique por pessoa
    expect([...e].sort((a, b) => a - b)).toEqual([...k].sort((a, b) => a - b))
  })
  it('aparece na tela de acesso e pode ter senha no servidor', () => {
    expect(NAME_MAP.emanuelly.fullName).toBe('Emanuelly Souza')
    expect(isValidUser('emanuelly')).toBe(true)
  })
})
