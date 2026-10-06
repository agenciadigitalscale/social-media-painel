import { describe, it, expect } from 'vitest'
import {
  preferenciasDoMes, comPreferencias, garantirMes, ativoNoMes, naCarteira, chaveMes,
  situacaoNoMes, historicoDoCliente, migrarCarteiraLegada, ordenarClientes, moverNaOrdem,
  vagasDoMes, comVagas, moverVaga, removerVaga, restaurarMes,
  type PrefMesStore, type CarteiraStore,
} from '../planejamentoMes'
import { diasPreferidosNoMes, semanaDoMes, gerarVagas, type PadraoCliente, type PadroesStore } from '../padraoEditorial'
import { lerCapacidade, reordenarEntregas } from '../datasEntrega'
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

describe('Cadastro de clientes', () => {
  const carteira: CarteiraStore = { Lareiras: { tipo: 'mensal', entrada: '2026-10' }, ABC: { tipo: 'mensal', saida: '2026-10' } }

  it('situação no mês: vai entrar, ativo, saiu', () => {
    expect(situacaoNoMes(carteira, 'Lareiras', ANO, 8)).toBe('futuro')
    expect(situacaoNoMes(carteira, 'Lareiras', ANO, OUT)).toBe('ativo')
    expect(situacaoNoMes(carteira, 'ABC', ANO, OUT)).toBe('saiu')
  })

  it('histórico mês a mês preserva os meses em que estava na carteira', () => {
    const h = historicoDoCliente(carteira, 'ABC', new Date(ANO, OUT, 15), 3)
    expect(h.map(x => [x.rotulo, x.ativo])).toEqual([['out/2026', false], ['set/2026', true], ['ago/2026', true]])
  })

  it('migra o que só existia no navegador sem sobrescrever a carteira', () => {
    const m = migrarCarteiraLegada({ ABC: { tipo: 'mensal', saida: '2026-11' } }, {
      tipos: { Avulso: 'freelancer', Mensal: 'mensal' },
      removidoDesde: { Velho: '2026-9', ABC: '2026-8' },
      mesesFreelancer: { Avulso: ['2026-10', '2026-8'] },
      nomes: { Velho: 'Velho Ltda', Mensal: 'Mensal' },
    })
    expect(m.ABC.saida).toBe('2026-11')             // carteira manda
    expect(m.Velho).toEqual({ tipo: 'mensal', saida: '2026-10', nome: 'Velho Ltda' })
    expect(m.Avulso).toEqual({ tipo: 'freelancer', entrada: '2026-09' })
    expect(m.Mensal).toBeUndefined()                // nada novo a dizer
  })

  it('ordem manual, A→Z e Z→A; quem não está na ordem vai para o fim', () => {
    const lista = [{ name: 'Beta' }, { name: 'alfa' }, { name: 'Gama' }]
    expect(ordenarClientes(lista, ['Gama'], 'manual').map(c => c.name)).toEqual(['Gama', 'alfa', 'Beta'])
    expect(ordenarClientes(lista, [], 'az').map(c => c.name)).toEqual(['alfa', 'Beta', 'Gama'])
    expect(ordenarClientes(lista, [], 'za').map(c => c.name)).toEqual(['Gama', 'Beta', 'alfa'])
    expect(moverNaOrdem(['A', 'B', 'C'], 'C', -1)).toEqual(['A', 'C', 'B'])
    expect(moverNaOrdem(['A', 'B'], 'A', -1)).toEqual(['A', 'B'])
  })
})

describe('Plano 6+6 — semana forte e semana fraca', () => {
  const P66: PadraoCliente = {
    plano: '6+6',
    dias: { Reel: [1, 3], Post: [2, 4], Feed: [] },
    diasFraca: { Reel: [1], Post: [4] },
  }
  it('alterna forte/fraca pela semana do mês', () => {
    expect(semanaDoMes(new Date(ANO, OUT, 1))).toBe(0)
    expect(semanaDoMes(new Date(ANO, OUT, 4))).toBe(1) // domingo abre a 2ª semana
  })
  it('as vagas usam TODAS as semanas, respeitando forte/fraca', () => {
    const reels = diasPreferidosNoMes(P66, 'Reel', ANO, OUT).map(d => d.getDate())
    // sem.0 (1–3): forte, sem segunda/quarta no mês · sem.1 (4–10): fraca → seg 5
    // sem.2 (11–17): forte → seg 12, qua 14 · sem.3 (18–24): fraca → seg 19
    // sem.4 (25–31): forte → seg 26, qua 28
    expect(reels).toEqual([5, 12, 14, 19, 26, 28])
    expect(gerarVagas(P66, ANO, OUT).filter(v => v.tipo === 'Reel').map(v => v.dia)).toEqual([5, 12, 14, 19, 26, 28])
  })
})

describe('Preferências por data (vagas) — o mês é independente', () => {
  it('sem vaga gravada, o mês usa as vagas do padrão', () => {
    expect(vagasDoMes({}, PADROES, 'Lareiras', ANO, OUT).filter(v => v.tipo === 'Reel').map(v => v.dia)).toEqual([5, 12, 19, 26])
  })
  it('pôr, mover e tirar vaga vale só para aquele mês; o padrão não muda', () => {
    let vagas = vagasDoMes({}, PADROES, 'Lareiras', ANO, OUT)
    vagas = moverVaga(vagas, { dia: 5, tipo: 'Reel' }, 7)          // Reel de segunda 5 → quarta 7
    vagas = [...vagas, { dia: 8, tipo: 'Feed' }]                    // Feed no dia clicado
    vagas = removerVaga(vagas, { dia: 26, tipo: 'Reel' })
    const store = comVagas({}, PADROES, 'Lareiras', ANO, OUT, vagas)
    const out = vagasDoMes(store, PADROES, 'Lareiras', ANO, OUT)
    expect(out.filter(v => v.tipo === 'Reel').map(v => v.dia)).toEqual([7, 12, 19])
    expect(out.some(v => v.tipo === 'Feed' && v.dia === 8)).toBe(true)
    // novembro e o padrão continuam como estavam
    expect(vagasDoMes(store, PADROES, 'Lareiras', ANO, 10).filter(v => v.tipo === 'Reel')).toHaveLength(5)
    expect(PADROES.Lareiras.dias.Reel).toEqual([1])
  })
  it('"Restaurar padrão" substitui as vagas manuais pelas do padrão atual', () => {
    const manual = comVagas({}, PADROES, 'Lareiras', ANO, OUT, [{ dia: 3, tipo: 'Reel' }])
    const novoPadrao: PadroesStore = { Lareiras: { dias: { Reel: [3], Post: [], Feed: [] } } }
    const r = restaurarMes(manual, novoPadrao, 'Lareiras', ANO, OUT)
    expect(vagasDoMes(r, novoPadrao, 'Lareiras', ANO, OUT).map(v => v.dia)).toEqual([7, 14, 21, 28])
  })
  it('mover para o mesmo dia ou vaga inexistente não muda nada', () => {
    const v = [{ dia: 5, tipo: 'Reel' as const }]
    expect(moverVaga(v, { dia: 5, tipo: 'Reel' }, 5)).toBe(v)
    expect(moverVaga(v, { dia: 6, tipo: 'Reel' }, 9)).toBe(v)
  })
})

describe('Fila inteligente de entrega', () => {
  const HOJE = new Date(2026, 9, 1, 9) // quinta 01/10
  let seq = 0
  const item = (diaPub: number, tp: ContentItem['tp'] = 'Reel', s: Status = 0): ContentItem =>
    ({ i: ++seq, c: 'C', dt: new Date(2026, 9, diaPub, 12), tp, n: `c${seq}`, s, custom: true })
  const st = (s: Status, entrega?: Date): ItemState =>
    ({ status: s, title: '', link: '', caption: '', notes: '', ...(entrega ? { deliveryDate: entrega.getTime() } : {}) })
  const CAP = { video: 10, design: 6 }
  const diaDe = (r: { id: number; entrega: number }[], id: number) => new Date(r.find(x => x.id === id)!.entrega).getDate()

  it('publicação mais próxima entrega primeiro: 4 do dia 10 + 5 do dia 11 + 1 do dia 12 no 1º dia', () => {
    const d10 = Array.from({ length: 4 }, () => item(10))
    const d11 = Array.from({ length: 5 }, () => item(11))
    const d12 = Array.from({ length: 3 }, () => item(12))
    const r = reordenarEntregas({ itens: [...d12, ...d11, ...d10], states: {}, capacidade: CAP, hoje: HOJE, modo: 'completo' })
    expect(d10.every(i => diaDe(r, i.i) === 1)).toBe(true)
    expect(d11.every(i => diaDe(r, i.i) === 1)).toBe(true)
    expect(d12.map(i => diaDe(r, i.i))).toEqual([1, 2, 2])
  })

  it('não usa a regra dos 12 dias: publicação distante começa hoje se houver vaga', () => {
    const it1 = item(30)
    const r = reordenarEntregas({ itens: [it1], states: {}, capacidade: CAP, hoje: HOJE, modo: 'completo' })
    expect(diaDe(r, it1.i)).toBe(1)
  })

  it('vídeo e design têm capacidade própria', () => {
    const reels = Array.from({ length: 10 }, () => item(10, 'Reel'))
    const posts = Array.from({ length: 7 }, () => item(10, 'Post'))
    const r = reordenarEntregas({ itens: [...reels, ...posts], states: {}, capacidade: CAP, hoje: HOJE, modo: 'completo' })
    expect(reels.every(i => diaDe(r, i.i) === 1)).toBe(true)
    expect(posts.filter(i => diaDe(r, i.i) === 1)).toHaveLength(6)
    expect(posts.filter(i => diaDe(r, i.i) === 2)).toHaveLength(1)
  })

  it('não usa sábado e domingo: cheio na sexta vai para segunda', () => {
    const a = item(20), b = item(20)
    const r = reordenarEntregas({ itens: [a, b], states: {}, capacidade: { video: 1, design: 1 }, hoje: new Date(2026, 9, 2, 9), modo: 'completo' })
    expect([diaDe(r, a.i), diaDe(r, b.i)].sort((x, y) => x - y)).toEqual([2, 5])
  })

  it('conteúdo novo empurra só o necessário, em cascata', () => {
    // dia 1: 4 do dia 10, 5 do dia 11, 1 do dia 12 (cheio). Entra +1 do dia 11.
    const um = new Date(2026, 9, 1, 12)
    const d10 = Array.from({ length: 4 }, () => item(10))
    const d11 = Array.from({ length: 5 }, () => item(11))
    const d12 = item(12)
    const novo = item(11)
    const states: Record<number, ItemState> = Object.fromEntries([...d10, ...d11, d12].map(i => [i.i, st(0, um)]))
    const r = reordenarEntregas({ itens: [...d10, ...d11, d12, novo], states, capacidade: CAP, hoje: HOJE, modo: 'empurrar', recolocar: new Set([novo.i]) })
    expect(diaDe(r, novo.i)).toBe(1)        // o novo do dia 11 entra no dia 1
    expect(diaDe(r, d12.i)).toBe(2)         // o do dia 12 é empurrado
    expect(r).toHaveLength(2)               // ninguém mais se mexe
  })

  it('Programado não repõe vaga: os outros não são puxados', () => {
    const um = new Date(2026, 9, 1, 12), dois = new Date(2026, 9, 2, 12)
    const a = item(10), b = item(10), c = item(11)
    const states = { [a.i]: st(9 as Status, um), [b.i]: st(0, um), [c.i]: st(0, dois) }
    expect(reordenarEntregas({ itens: [a, b, c], states, capacidade: { video: 2, design: 2 }, hoje: HOJE, modo: 'empurrar' })).toEqual([])
  })

  it('Etapa final não volta para a fila nem é mexida', () => {
    const a = item(10), b = item(10)
    const states = { [a.i]: st(9 as Status, new Date(2026, 9, 15, 12)), [b.i]: st(0) }
    const r = reordenarEntregas({ itens: [a, b], states, capacidade: CAP, hoje: HOJE, modo: 'completo' })
    expect(r.map(x => x.id)).toEqual([b.i])
  })

  it('automático não dá entrega a card antigo que nunca teve', () => {
    const a = item(27)
    expect(reordenarEntregas({ itens: [a], states: { [a.i]: st(0) }, capacidade: CAP, hoje: HOJE, modo: 'empurrar' })).toEqual([])
  })

  it('capacidade antiga (um número só) vale para as duas frentes', () => {
    expect(lerCapacidade(8)).toEqual({ video: 8, design: 8 })
    expect(lerCapacidade(null)).toEqual({ video: 10, design: 6 })
    expect(lerCapacidade({ video: 12 })).toEqual({ video: 12, design: 6 })
  })
})
