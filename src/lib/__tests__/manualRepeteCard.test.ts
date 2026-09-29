import { describe, it, expect } from 'vitest'
import { manuaisQueRepetemCard, type EntregaManual } from '../producaoEditor'

// Caso real de 29/09/2026: 4 vídeos do dia registrados à mão enquanto os cards
// estavam sem dono; quando os cards passaram a contar, o dia foi de 9 para 13.
const DIA = new Date(2026, 8, 29, 12).getTime()
const m = (id: string, cliente: string, titulo: string, over: Partial<EntregaManual> = {}): EntregaManual =>
  ({ id, autor: 'kaique', cliente, titulo, tipo: 'Reel', ts: DIA, criadoEm: DIA, ...over })
const card = (itemId: number, cliente: string, titulo: string, ts = DIA + 3_600_000) => ({ itemId, cliente, titulo, ts })

describe('registro manual que repete um card', () => {
  const cards = [
    card(1, 'HOPESTEEL', 'VIDEO - TREND - QUANTOS ANOS VOCÊ TEM'),
    card(2, 'Lareiras Grill', 'VIDEO - A ESCOLHA DO CLIENTE'),
    card(3, 'Home Elevadores', 'VIDEO - VISITA PERCURSO'),
    card(4, 'PADARIA LUANDA', 'VIDEO - TREND'),
  ]

  it('os 4 casos reais de 29/09 saem da conta', () => {
    const fora = manuaisQueRepetemCard([
      m('a', 'HOPESTEEL', 'TREND - QUANTOS ANOS VOCE TEM DE EMPRESA'),
      m('b', 'Lareiras Grill', 'A ESCOLHA DO CLIENTE'),
      m('c', 'Home Elevadores', 'GRAVAÇÃO PERCURSO'),
      m('d', 'PADARIA LUANDA', 'TREND- VOCE SE CONFUNDIU'),
    ], cards)
    expect([...fora].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('outro cliente, outro dia ou título sem nada em comum: continua contando', () => {
    const fora = manuaisQueRepetemCard([
      m('x', 'Compostela', 'A ESCOLHA DO CLIENTE'),
      m('y', 'Lareiras Grill', 'A ESCOLHA DO CLIENTE', { ts: DIA + 5 * 86_400_000 }),
      m('z', 'HOPESTEEL', 'INSTITUCIONAL FÁBRICA'),
    ], cards)
    expect(fora.size).toBe(0)
  })

  it('cada card absorve UM registro — dois vídeos parecidos no dia contam dois', () => {
    const fora = manuaisQueRepetemCard([
      m('a', 'Lareiras Grill', 'A ESCOLHA DO CLIENTE'),
      m('b', 'Lareiras Grill', 'A ESCOLHA DO CLIENTE parte 2'),
    ], [cards[1]])
    expect(fora.size).toBe(1)
  })

  it('registro LIGADO a card segue a regra antiga (o itemId decide)', () => {
    expect(manuaisQueRepetemCard([m('a', 'Lareiras Grill', 'A ESCOLHA DO CLIENTE', { itemId: 99 })], cards).size).toBe(0)
  })
})
