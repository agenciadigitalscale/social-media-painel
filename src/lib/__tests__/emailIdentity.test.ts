import { describe, it, expect } from 'vitest'
import { userFromEmail, EMAIL_TO_USER, NAME_MAP } from '../users'
import { getUserRole, getUserPerms } from '../roles'

/**
 * O mapa e-mail → membro decide COM QUAL CARGO a pessoa entra. Errar aqui não
 * dá erro na tela: dá acesso indevido — alguém abriria o Financeiro por causa
 * de uma linha trocada. Por isso cada entrada é conferida contra o cargo.
 */

describe('mapa de contas Google', () => {
  it('todo e-mail aponta para um membro que existe', () => {
    for (const [email, user] of Object.entries(EMAIL_TO_USER)) {
      expect(NAME_MAP[user], `${email} → ${user} não existe no NAME_MAP`).toBeDefined()
    }
  })

  it('nenhum membro tem duas contas apontando para ele', () => {
    const usuarios = Object.values(EMAIL_TO_USER)
    expect(new Set(usuarios).size).toBe(usuarios.length)
  })

  it('os e-mails estão em minúsculas (a busca normaliza, o mapa precisa bater)', () => {
    for (const email of Object.keys(EMAIL_TO_USER)) {
      expect(email).toBe(email.toLowerCase())
    }
  })
})

describe('quem entra com qual cargo', () => {
  const esperado: Array<[string, string, string]> = [
    ['kaiquedigitalscale@gmail.com',        'kaique', 'head'],
    ['arthurdigitalscale@gmail.com',        'arthur', 'social'],
    ['robsondigitalscale@gmail.com',        'robson', 'trafego'],
    ['geovanakergesdigitalscale@gmail.com', 'kerges', 'copy'],
    ['mateuspradomendes123@gmail.com',      'pradox', 'socio'],
  ]

  it.each(esperado)('%s entra como %s (cargo %s)', (email, user, role) => {
    expect(userFromEmail(email)).toBe(user)
    expect(getUserRole(user)).toBe(role)
  })

  it('só o sócio confirmado enxerga o Financeiro', () => {
    expect(getUserPerms('pradox').canViewFinanceiro).toBe(true)
    expect(getUserPerms('arthur').canViewFinanceiro).toBe(false)
    expect(getUserPerms('robson').canViewFinanceiro).toBe(false)
    expect(getUserPerms('kerges').canViewFinanceiro).toBe(false)
  })
})

describe('quem não está no mapa', () => {
  it('e-mail de fora não vira membro nenhum', () => {
    expect(userFromEmail('estranho@gmail.com')).toBeNull()
  })

  it('jhones e testa ainda não têm conta — entram pela splash', () => {
    expect(Object.values(EMAIL_TO_USER)).not.toContain('jhones')
    expect(Object.values(EMAIL_TO_USER)).not.toContain('testa')
  })

  it('normaliza caixa e espaço', () => {
    expect(userFromEmail('  KaiqueDigitalScale@Gmail.com ')).toBe('kaique')
  })
})
