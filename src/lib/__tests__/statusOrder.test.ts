import { describe, it, expect } from 'vitest'
import { STATUS_ORDER, statusRank, isOpenStatus, statusBefore, isPreClientStatus } from '../../types'
import type { Status } from '../../types'

/**
 * O status 8 ("Pronto") nasceu depois do 7 e é numericamente MAIOR, mas no fluxo
 * fica entre o 1 e o 2. Todo `status < 7` espalhado pelo app dizia "ainda não
 * publicado" e silenciosamente excluía o 8 — card parado em Pronto sumia das
 * contagens de atraso, dos badges e do score de saúde do cliente. Justamente o
 * lugar onde o card espera a esteira achar o arquivo, e onde pode ficar dias.
 */

const TODOS: Status[] = [0, 1, 2, 3, 4, 5, 6, 7, 8]

describe('ordem do fluxo', () => {
  it('o 8 fica entre o 1 e o 2, não depois do 7', () => {
    expect(STATUS_ORDER).toEqual([0, 1, 8, 2, 3, 4, 5, 6, 7])
    expect(statusRank(8)).toBeGreaterThan(statusRank(1))
    expect(statusRank(8)).toBeLessThan(statusRank(2))
  })

  it('publicado é o último de todos', () => {
    for (const s of TODOS) {
      if (s !== 7) expect(statusRank(s)).toBeLessThan(statusRank(7))
    }
  })
})

describe('isOpenStatus — o que a comparação numérica errava', () => {
  it('Pronto (8) é trabalho aberto — era isto que sumia', () => {
    expect(isOpenStatus(8)).toBe(true)
    expect(8 < 7).toBe(false)   // a forma antiga dizia o contrário
  })

  it('só o publicado está fechado', () => {
    for (const s of TODOS) expect(isOpenStatus(s)).toBe(s !== 7)
  })
})

describe('statusBefore', () => {
  it('Pronto vem antes da revisão interna e do envio', () => {
    expect(statusBefore(8, 2)).toBe(true)
    expect(statusBefore(8, 3)).toBe(true)
    expect(8 < 3).toBe(false)   // a forma antiga dizia o contrário
  })

  it('não muda nada para os status 0–7', () => {
    for (const s of [0, 1, 2, 3, 4, 5, 6] as Status[]) {
      expect(statusBefore(s, 3)).toBe(s < 3)
    }
  })

  it('nada vem antes do primeiro', () => {
    expect(statusBefore(0, 0)).toBe(false)
  })
})

describe('coerência com os grupos', () => {
  it('tudo que é interno vem antes de "enviado ao cliente"', () => {
    for (const s of TODOS) {
      if (isPreClientStatus(s)) expect(statusBefore(s, 4)).toBe(true)
    }
  })
})
