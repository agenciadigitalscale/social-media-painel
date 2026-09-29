import { describe, it, expect } from 'vitest'
import { podeMover, motivoDoBloqueio } from '../fluxo'
import type { Status } from '../../types'

describe('esteira única — quem move o quê', () => {
  it('Designer/Editor levam até a Revisão e trabalham o Ajuste', () => {
    for (const u of ['jhones', 'julio', 'kaique']) {
      expect(podeMover(u, 0, 1)).toBe(true)
      expect(podeMover(u, 1, 2)).toBe(true)
      expect(podeMover(u, 1, 0)).toBe(true)
      expect(podeMover(u, 6, 1)).toBe(true)
      expect(podeMover(u, 6, 2)).toBe(true)
    }
  })

  it('Designer/Editor NÃO aprovam, não devolvem, não pulam etapa, não publicam', () => {
    const proibidos: [Status, Status][] = [[2, 3], [2, 6], [2, 1], [1, 3], [0, 2], [3, 4], [3, 9], [5, 7], [9, 7], [1, 7]]
    for (const [de, para] of proibidos) {
      expect(podeMover('jhones', de, para)).toBe(false)
      expect(podeMover('kaique', de, para)).toBe(false)
    }
  })

  it('Social Media e Sócios movem qualquer etapa (revisão, programação, publicação)', () => {
    for (const u of ['arthur', 'robson', 'pradox', 'testa']) {
      expect(podeMover(u, 2, 3)).toBe(true)
      expect(podeMover(u, 2, 6)).toBe(true)
      expect(podeMover(u, 3, 9)).toBe(true)
      expect(podeMover(u, 9, 7)).toBe(true)
    }
  })

  it('Copy não move card; ficar parado sempre pode', () => {
    expect(podeMover('kerges', 0, 1)).toBe(false)
    expect(podeMover('jhones', 2, 2)).toBe(true)
  })

  it('o motivo explica o que aconteceu', () => {
    expect(motivoDoBloqueio('jhones', 2, 3)).toMatch(/Revisão/)
    expect(motivoDoBloqueio('jhones', 1, 9)).toMatch(/Social Media/)
    expect(motivoDoBloqueio('kerges', 0, 1)).toMatch(/Roteiros/)
  })
})
