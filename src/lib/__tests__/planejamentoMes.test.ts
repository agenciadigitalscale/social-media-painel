import { describe, it, expect } from 'vitest'
import {
  preferenciasDoMes, comPreferencias, garantirMes, ativoNoMes, naCarteira, chaveMes,
  type PrefMesStore, type CarteiraStore,
} from '../planejamentoMes'
import { diasPreferidosNoMes, semanaDoMes, planejarDistribuicao, type PadraoCliente, type PadroesStore } from '../padraoEditorial'
import { entregaInicial, entregaPadrao, reordenarEntregas } from '../datasEntrega'
import type { ContentItem, ItemState, Status } from '../../types'

const ANO = 2026, OUT = 9 // outubro/2026 começa numa quinta
const PADROES: PadroesStore = { Lareiras: { dias: { Reel: [1], Post: [5], Feed: [] } } }

describe('Preferências do mês', () => {
  it('sem preferências próprias, o mês segue o padrão', () => {
    const r = preferenciasDoMes({}, PADROES, 'Lareiras', ANO, OUT)
    expect(r.proprio).toBe(false)
    expect(r.padrao.dias.Reel).toEqual([1])
  })

  it('mudar outubro não mexe no padrão nem em setembro', () => {
    let prefs: PrefMesStore = garantirMes({}, PADROES, 'Lareiras', ANO, OUT)
    const out = preferenciasDoMes(prefs, PADROES, 'Lareiras', ANO, OUT).padrao
    prefs = comPreferencias(prefs, 'Lareiras', ANO, OUT, { ...out, dias: { ...out.dias, Reel: [3] } })
    expect(preferenciasDoMes(prefs, PADROES, 'Lareiras', ANO, OUT).padrao.dias.Reel).toEqual([3])
    expect(PADROES.Lareiras.dias.Reel).toEqual([1])
    expect(preferenciasDoMes(prefs, PADROES, 'Lareiras', ANO, OUT - 1).padrao.dias.Reel).toEqual([1])
  })

  it('criar o mês copia — editar o padrão depois não reescreve o mês já criado', () => {
    const padroes: PadroesStore = JSON.parse(JSON.stringify(PADROES))
    const prefs = garantirMes({}, padroes, 'Lareiras', ANO, OUT)
    padroes.Lareiras.dias.Reel = [4]
    expect(preferenciasDoMes(prefs, padroes, 'Lareiras', ANO, OUT).padrao.dias.Reel).toEqual([1])
    expect(garantirMes(prefs, padroes, 'Lareiras', ANO, OUT)).toBe(prefs) // já criado: não recopia
  })
})

describe('Carteira mensal', () => {
  const carteira: CarteiraStore = {
    Novo: { tipo: 'mensal', entrada: '2026-10' },
    Saiu: { tipo: 'mensal', saida: '2026-10' },
    Avulso: { tipo: 'freelancer' },
  }
  it('entrou em outubro: fora de setembro, dentro de outubro', () => {
    expect(ativoNoMes(carteira, 'Novo', ANO, 8)).toBe(false)
    expect(ativoNoMes(carteira, 'Novo', ANO, OUT)).toBe(true)
  })
  it('saiu em outubro: dentro de setembro, fora de outubro', () => {
    expect(ativoNoMes(carteira, 'Saiu', ANO, 8)).toBe(true)
    expect(ativoNoMes(carteira, 'Saiu', ANO, OUT)).toBe(false)
  })
  it('sem cadastro é mensal e ativo; freelancer guarda o tipo', () => {
    expect(naCarteira(carteira, 'Qualquer')).toEqual({ tipo: 'mensal' })
    expect(ativoNoMes(carteira, 'Qualquer', ANO, OUT)).toBe(true)
    expect(naCarteira(carteira, 'Avulso').tipo).toBe('freelancer')
    expect(chaveMes(ANO, OUT)).toBe('2026-10')
  })
})

describe('Plano 6+6 — semana forte e semana fraca', () => {
  // Reel: forte = seg+qua, fraca = seg. Post: forte = ter+qui, fraca = qui.
  const P66: PadraoCliente = {
    plano: '6+6',
    dias: { Reel: [1, 3], Post: [2, 4], Feed: [] },
    diasFraca: { Reel: [1], Post: [4] },
  }
  it('alterna forte/fraca pela semana do mês', () => {
    expect(semanaDoMes(new Date(ANO, OUT, 1))).toBe(0)
    expect(semanaDoMes(new Date(ANO, OUT, 4))).toBe(1) // domingo abre a 2ª semana
  })
  it('a distribuição usa os dias de TODAS as semanas, respeitando forte/fraca', () => {
    const reels = diasPreferidosNoMes(P66, 'Reel', ANO, OUT).map(d => d.getDate())
    // sem.0 (1–3): forte, sem quarta/segunda no mês · sem.1 (4–10): fraca → seg 5
    // sem.2 (11–17): forte → seg 12, qua 14 · sem.3 (18–24): fraca → seg 19
    // sem.4 (25–31): forte → seg 26, qua 28
    expect(reels).toEqual([5, 12, 14, 19, 26, 28])
    const plano = planejarDistribuicao({ ano: ANO, mes: OUT, padrao: P66, meta: { Reel: 6, Post: 0, Feed: 0 }, existentes: [], hoje: new Date(2026, 8, 1) })
    expect(plano.map(p => p.data.getDate())).toEqual([5, 12, 14, 19, 26, 28])
  })
  it('distribuir só os tipos marcados, na quantidade informada', () => {
    const plano = planejarDistribuicao({
      ano: ANO, mes: OUT, padrao: P66, meta: { Reel: 6, Post: 6, Feed: 0 }, existentes: [], hoje: new Date(2026, 8, 1),
      tipos: ['Post'], quantidade: { Post: 2 },
    })
    expect(plano).toHaveLength(2)
    expect(plano.every(p => p.tipo === 'Post')).toBe(true)
  })
})

describe('Datas de entrega e reordenação', () => {
  const HOJE = new Date(2026, 9, 1, 9) // quinta 01/10
  const item = (i: number, diaPub: number, s: Status = 0): ContentItem =>
    ({ i, c: 'C', dt: new Date(2026, 9, diaPub, 12), tp: 'Reel', n: `c${i}`, s, custom: true })
  const st = (s: Status, entrega?: Date): ItemState =>
    ({ status: s, title: '', link: '', caption: '', notes: '', ...(entrega ? { deliveryDate: entrega.getTime() } : {}) })

  it('entrega = publicação − 12 dias corridos', () => {
    expect(new Date(entregaPadrao(new Date(2026, 9, 20, 18))).getDate()).toBe(8)
  })

  it('card novo nunca nasce com entrega no passado nem no fim de semana', () => {
    // Publicação 09/10 → padrão 27/09 (domingo, passado) → hoje, quinta 01/10.
    expect(new Date(entregaInicial(new Date(2026, 9, 9, 12), HOJE)).getDate()).toBe(1)
    // Publicação 30/10 → padrão 18/10 (domingo) → segunda 19/10.
    expect(new Date(entregaInicial(new Date(2026, 9, 30, 12), HOJE)).getDate()).toBe(19)
  })

  it('respeita a capacidade: o que não cabe vai para o próximo dia útil', () => {
    // Publicação 27/10 → ideal 15/10 (quinta). Capacidade 2: o 3º vai para sexta 16.
    const itens = [item(1, 27), item(2, 27), item(3, 27)]
    const r = reordenarEntregas({ itens, states: {}, capacidade: 2, hoje: HOJE, modo: 'completo' })
    const dias = r.map(x => new Date(x.entrega).getDate()).sort((a, b) => a - b)
    expect(dias).toEqual([15, 15, 16])
  })

  it('não usa sábado e domingo: cheio na sexta vai para segunda', () => {
    const itens = [item(1, 28), item(2, 28)] // ideal sexta 16/10
    const r = reordenarEntregas({ itens, states: {}, capacidade: 1, hoje: HOJE, modo: 'completo' })
    expect(r.map(x => new Date(x.entrega).getDate()).sort((a, b) => a - b)).toEqual([16, 19])
  })

  it('o que já saiu da produção não ocupa vaga e não é mexido', () => {
    const itens = [item(1, 27), item(2, 27)]
    const states = { 1: st(9 as Status, new Date(2026, 9, 15, 12)), 2: st(0) }
    const r = reordenarEntregas({ itens, states, capacidade: 1, hoje: HOJE, modo: 'completo' })
    expect(r.map(x => x.id)).toEqual([2]) // o programado (9) não entra
    expect(new Date(r[0].entrega).getDate()).toBe(15)
  })

  it('automático só empurra: programar um não puxa outro para o lugar', () => {
    // 1 foi programado (saiu da fila). 2 estava empurrado para 16/10 e continua lá.
    const itens = [item(1, 27), item(2, 27)]
    const states = { 1: st(9 as Status, new Date(2026, 9, 15, 12)), 2: st(0, new Date(2026, 9, 16, 12)) }
    expect(reordenarEntregas({ itens, states, capacidade: 1, hoje: HOJE, modo: 'empurrar' })).toEqual([])
  })

  it('conteúdo novo num dia cheio empurra só o necessário', () => {
    // 3 é novo e nasceu com a entrega dele (15/10) — o dia já tinha 2, capacidade 2.
    const itens = [item(1, 27), item(2, 27), item(3, 27)]
    const states = { 1: st(0, new Date(2026, 9, 15, 12)), 2: st(0, new Date(2026, 9, 15, 12)), 3: st(0, new Date(2026, 9, 15, 12)) }
    const r = reordenarEntregas({ itens, states, capacidade: 2, hoje: HOJE, modo: 'empurrar' })
    // só UM sai, para o próximo dia útil (sexta 16)
    expect(r).toHaveLength(1)
    expect(new Date(r[0].entrega).getDate()).toBe(16)
  })

  it('automático não dá entrega para card antigo que nunca teve', () => {
    const r = reordenarEntregas({ itens: [item(1, 27)], states: { 1: st(0) }, capacidade: 10, hoje: HOJE, modo: 'empurrar' })
    expect(r).toEqual([])
  })
})
