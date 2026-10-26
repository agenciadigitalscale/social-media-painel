import { describe, it, expect, vi } from 'vitest'
import { getUserPerms } from '../roles'
import { cargoDe, isIsolado, membrosDoCargo, donoDoCard, podeVerCard, membroDaGavetaAutomatica } from '../access'
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

describe('gaveta da Emanuelly — atribuir card existente (2026-10-26)', () => {
  it('aparece no carregarPaineis mesmo sem estar gravada no sm_paineis', async () => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, String(v)) },
      removeItem: (k: string) => { data.delete(k) },
    })
    data.set('sm_paineis', JSON.stringify({ paineis: [{ id: 'p1', area: 'vid', membro: 'kaique', nome: 'kaique', cor: '#fff', ordem: 0, criadoEm: 1 }], semeado: { vid: true } }))
    const { carregarPaineis, paineisDaArea, paineisGravados } = await import('../paineis')
    const vid = paineisDaArea(carregarPaineis(), 'vid')
    expect(vid.map(p => p.membro)).toEqual(['kaique', 'emanuelly'])
    expect(vid.filter(p => p.membro === 'kaique')).toHaveLength(1)
    expect(paineisGravados().map(p => p.id)).toEqual(['p1'])
    vi.unstubAllGlobals()
  })

  it('o servidor sabe de quem é o card na gaveta automática, mesmo sem ela no sm_paineis', () => {
    const vazio = { paineis: [], semeado: {} }
    expect(donoDoCard(10, undefined, { 10: 'pn_auto_vid_emanuelly' }, vazio)).toBe('emanuelly')
    expect(podeVerCard('emanuelly', 10, undefined, { 10: 'pn_auto_vid_emanuelly' }, vazio)).toBe(true)
    expect(podeVerCard('kaique', 10, undefined, { 10: 'pn_auto_vid_emanuelly' }, vazio)).toBe(false)
    expect(membroDaGavetaAutomatica('pn_auto_vid_ninguem')).toBeUndefined()
  })
})
