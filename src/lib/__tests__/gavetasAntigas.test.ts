import { describe, it, expect } from 'vitest'
import { donoDoCard, membroDaGaveta, GAVETAS_ANTIGAS } from '../access'
import { autorDoCard } from '../producaoEditor'
import { painelDoCard } from '../paineis'
import type { Painel } from '../paineis'

// Gavetas que sumiram do sm_paineis em 28/09/2026 com cards ainda apontando para
// elas. Sem a tradução, 330 cards ficavam sem dono e a produção do mês caía.
const VIVAS = { paineis: [{ id: 'pn_kaique_novo', membro: 'kaique' }], semeado: {} }

describe('gavetas antigas (sumiram do sm_paineis)', () => {
  it('"Editor 1" antiga é do Kaique — no painel, na contagem e no servidor', () => {
    const atrib = { 7: 'pn_mthnnie4_zk9u' }
    expect(donoDoCard(7, undefined, atrib, VIVAS)).toBe('kaique')
    expect(autorDoCard(7, undefined, atrib, VIVAS as never)).toBe('kaique')
  })

  it('gavetas de design vão para o designer certo; a do sócio não conta para designer', () => {
    expect(membroDaGaveta('pn_mtho2gj2_xceu', VIVAS)).toBe('jhones')
    expect(membroDaGaveta('pn_mtxbrftj_r7h0', VIVAS)).toBe('julio')
    expect(membroDaGaveta('pn_mtho2gj2_74w1', VIVAS)).toBe('testa')
  })

  it('gaveta VIVA manda: o mapa antigo nunca passa por cima de uma gaveta que existe', () => {
    const viva = { paineis: [{ id: 'pn_mthnnie4_zk9u', membro: 'julio' }], semeado: {} }
    expect(membroDaGaveta('pn_mthnnie4_zk9u', viva)).toBe('julio')
  })

  it('no board, o card da gaveta antiga aparece na gaveta viva do mesmo dono', () => {
    const area = [{ id: 'pn_kaique_novo', nome: 'kaique', membro: 'kaique' }] as unknown as Painel[]
    expect(painelDoCard(7, undefined, { 7: 'pn_muid6sxm_7x4i' }, area)).toBe('pn_kaique_novo')
  })

  it('gaveta desconhecida continua sem dono (cai no responsável do card)', () => {
    expect(donoDoCard(1, { responsible: 'arthur' }, { 1: 'pn_nao_existe' }, VIVAS)).toBe('arthur')
    expect(Object.keys(GAVETAS_ANTIGAS)).toHaveLength(6)
  })
})
