import { describe, it, expect } from 'vitest'
import { signSession, verifySession } from '../session'
import { acessoBloqueado } from '../../../../src/lib/access'
import { canViewDesignerManagement, getUserPerms } from '../../../../src/lib/roles'

const env = { SESSION_SECRET: 'segredo-de-teste' }
const cookie = async (id: string) => `ds_session=${await signSession(id, Date.now() + 60_000, env.SESSION_SECRET)}`

describe('acesso bloqueado', () => {
  it('a sessão do Kaique que já existia deixa de valer, pela senha e pelo Google', async () => {
    expect(acessoBloqueado('Kaique')).toBe(true)
    expect(await verifySession(await cookie('kaique@role.dshub'), env)).toBeNull()
    expect(await verifySession(await cookie('kaiquedigitalscale@gmail.com'), env)).toBeNull()
  })
  it('os demais seguem entrando', async () => {
    expect(await verifySession(await cookie('arthur@role.dshub'), env)).toBe('arthur@role.dshub')
    expect(acessoBloqueado('emanuelly')).toBe(false)
  })
})

describe('Entregas do time', () => {
  it('Arthur vê; Robson (mesmo cargo) não; sócio vê', () => {
    expect(canViewDesignerManagement('arthur')).toBe(true)
    expect(getUserPerms('arthur').hiddenTabs).not.toContain(25)
    expect(canViewDesignerManagement('robson')).toBe(false)
    expect(getUserPerms('robson').hiddenTabs).toContain(25)
    expect(canViewDesignerManagement('pradox')).toBe(true)
  })
})
