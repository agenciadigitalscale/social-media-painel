import { describe, expect, it } from 'vitest'
import {
  agruparPorDia, autorDoCard, chaveDoDia, entregasDoAutor, jaEntregue, mediaPorDiaTrabalhado,
  melhorDia, momentoDaEntrega, resumoDoDia, resumoDoMes, serieDiaria,
  adicionarManual, removerManual, type EntregaManual,
} from '../producaoEditor'
import { criarPainel, paineisDaArea, PAINEIS_VAZIO, type Atribuicoes, type PaineisStore } from '../paineis'
import type { ContentItem, ItemState, Status } from '../../types'

// ── Fixtures ──────────────────────────────────────────────────────────
function item(i: number, over: Partial<ContentItem> = {}): ContentItem {
  return { i, c: 'Lorenzeti', dt: new Date('2026-09-01'), tp: 'Reel', n: `Vídeo ${i}`, s: 0, ...over }
}

function state(over: Partial<ItemState> = {}): ItemState {
  return { status: 3, title: '', link: '', caption: '', notes: '', ...over }
}

/** 12/08/2026 às 10h, horário local. */
const DIA = new Date(2026, 7, 12, 10, 0, 0).getTime()
const DIA_MS = 86_400_000

function comPainelDoKaique(): { paineis: PaineisStore; painelId: string } {
  const paineis = criarPainel(PAINEIS_VAZIO, 'vid', 'Kaique', 'kaique')
  return { paineis, painelId: paineisDaArea(paineis, 'vid')[0].id }
}

// ── Autoria ───────────────────────────────────────────────────────────
describe('de quem é o card', () => {
  it('a gaveta do painel vence o campo de editor', () => {
    const { paineis, painelId } = comPainelDoKaique()
    const atrib: Atribuicoes = { 1: painelId }
    expect(autorDoCard(1, state({ assignedEditor: 'jhones' }), atrib, paineis)).toBe('kaique')
  })

  it('sem gaveta, vale o editor marcado no card', () => {
    expect(autorDoCard(1, state({ assignedEditor: 'kaique', responsible: 'jhones' }), {}, PAINEIS_VAZIO))
      .toBe('kaique')
  })

  it('sem editor, cai no responsável — senão a conta zera para quase todo mundo', () => {
    expect(autorDoCard(1, state({ responsible: 'kaique' }), {}, PAINEIS_VAZIO)).toBe('kaique')
  })

  it('gaveta sem membro não inventa autor', () => {
    const paineis = criarPainel(PAINEIS_VAZIO, 'vid', 'Freela de setembro')
    const painelId = paineisDaArea(paineis, 'vid')[0].id
    expect(autorDoCard(1, state(), { 1: painelId }, paineis)).toBeUndefined()
  })

  it('card sem marca nenhuma não é de ninguém', () => {
    expect(autorDoCard(1, state(), {}, PAINEIS_VAZIO)).toBeUndefined()
  })
})

// ── O momento da entrega ──────────────────────────────────────────────
describe('quando o vídeo passou a contar', () => {
  it('vale o carimbo mais ANTIGO — o dia em que o trabalho terminou', () => {
    const m = momentoDaEntrega(state({
      reviewAutomationCompletedAt: DIA,
      approvedByClientAt: DIA + 3 * DIA_MS,
    }))
    expect(m).toEqual({ ts: DIA, motivo: 'detectado' })
  })

  it('lê o histórico do board — arrastar para "Pronto p/ enviar" conta', () => {
    const m = momentoDaEntrega(state({
      history: [
        { action: '→ Em produção', ts: DIA - DIA_MS },
        { action: '→ Pronto p/ enviar', ts: DIA },
      ],
    }))
    expect(m).toEqual({ ts: DIA, motivo: 'finalizado' })
  })

  it('aprovação do cliente conta mesmo sem nenhum outro carimbo', () => {
    expect(momentoDaEntrega(state({ approvedByClientAt: DIA }))).toEqual({ ts: DIA, motivo: 'aprovado' })
  })

  it('"Ajuste solicitado" não é entrega — é o caminho de volta', () => {
    expect(momentoDaEntrega(state({ history: [{ action: '→ Ajuste solicitado', ts: DIA }] }))).toBeNull()
  })

  it('sem carimbo nenhum devolve null em vez de chutar hoje', () => {
    expect(momentoDaEntrega(state({ status: 5 }))).toBeNull()
    expect(momentoDaEntrega(undefined)).toBeNull()
  })

  it('carimbo zerado ou inválido não vira entrega da década de 1970', () => {
    expect(momentoDaEntrega(state({ approvedByClientAt: 0 }))).toBeNull()
    expect(momentoDaEntrega(state({ publishedAt: Number.NaN }))).toBeNull()
  })
})

describe('que status já saiu da produção', () => {
  it.each([2, 3, 4, 5, 7])('status %i conta como entregue', s => {
    expect(jaEntregue(state({ status: s as Status }), item(1))).toBe(true)
  })

  it.each([0, 1, 6])('status %i ainda não é entrega', s => {
    expect(jaEntregue(state({ status: s as Status }), item(1))).toBe(false)
  })

  it('o 8 aposentado ainda conta — está gravado no D1 de quem não abriu o painel', () => {
    expect(jaEntregue(state({ status: 8 as Status }), item(1))).toBe(true)
  })
})

// ── A conta ───────────────────────────────────────────────────────────
describe('entregas do autor', () => {
  const { paineis, painelId } = comPainelDoKaique()

  it('um vídeo conta UMA vez, mesmo com detecção, envio e aprovação', () => {
    const { entregas } = entregasDoAutor(
      [item(1)],
      { 1: state({
        status: 5,
        assignedEditor: 'kaique',
        reviewAutomationCompletedAt: DIA,
        sentToClientAt: DIA + DIA_MS,
        approvedByClientAt: DIA + 2 * DIA_MS,
        history: [{ action: '→ Pronto p/ enviar', ts: DIA + 60_000 }],
      }) },
      {}, PAINEIS_VAZIO, 'kaique',
    )
    expect(entregas).toHaveLength(1)
    expect(entregas[0].motivo).toBe('detectado')
  })

  it('reentrega depois de um ajuste não conta de novo', () => {
    const { entregas } = entregasDoAutor(
      [item(1)],
      { 1: state({
        status: 3,
        assignedEditor: 'kaique',
        history: [
          { action: '→ Pronto p/ enviar', ts: DIA },
          { action: '→ Ajuste solicitado', ts: DIA + DIA_MS },
          { action: '→ Pronto p/ enviar', ts: DIA + 2 * DIA_MS },
        ],
      }) },
      {}, PAINEIS_VAZIO, 'kaique',
    )
    expect(entregas).toHaveLength(1)
    expect(entregas[0].ts).toBe(DIA)
  })

  it('não credita o que é de outra pessoa', () => {
    const { entregas } = entregasDoAutor(
      [item(1), item(2)],
      {
        1: state({ status: 3, assignedEditor: 'kaique', approvedByClientAt: DIA }),
        2: state({ status: 3, assignedEditor: 'jhones', approvedByClientAt: DIA }),
      },
      {}, PAINEIS_VAZIO, 'kaique',
    )
    expect(entregas.map(e => e.itemId)).toEqual([1])
  })

  it('a gaveta do painel credita mesmo sem editor no card', () => {
    const { entregas } = entregasDoAutor(
      [item(1)],
      { 1: state({ status: 3, approvedByClientAt: DIA }) },
      { 1: painelId }, paineis, 'kaique',
    )
    expect(entregas).toHaveLength(1)
  })

  it('entregue sem carimbo entra em semData, não no silêncio', () => {
    const { entregas, semData } = entregasDoAutor(
      [item(1)],
      { 1: state({ status: 5, assignedEditor: 'kaique' }) },
      {}, PAINEIS_VAZIO, 'kaique',
    )
    expect(entregas).toHaveLength(0)
    expect(semData).toBe(1)
  })

  it('filtra por tipo quando pedido', () => {
    const items = [item(1), item(2, { tp: 'Post' })]
    const states = {
      1: state({ status: 3, assignedEditor: 'kaique', approvedByClientAt: DIA }),
      2: state({ status: 3, assignedEditor: 'kaique', approvedByClientAt: DIA }),
    }
    expect(entregasDoAutor(items, states, {}, PAINEIS_VAZIO, 'kaique', { tipos: ['Reel'] }).entregas)
      .toHaveLength(1)
    expect(entregasDoAutor(items, states, {}, PAINEIS_VAZIO, 'kaique').entregas).toHaveLength(2)
  })

  it('vem ordenado do mais novo para o mais antigo', () => {
    const { entregas } = entregasDoAutor(
      [item(1), item(2), item(3)],
      {
        1: state({ status: 3, assignedEditor: 'kaique', approvedByClientAt: DIA }),
        2: state({ status: 3, assignedEditor: 'kaique', approvedByClientAt: DIA + 2 * DIA_MS }),
        3: state({ status: 3, assignedEditor: 'kaique', approvedByClientAt: DIA + DIA_MS }),
      },
      {}, PAINEIS_VAZIO, 'kaique',
    )
    expect(entregas.map(e => e.itemId)).toEqual([2, 3, 1])
  })
})

// ── Datas ─────────────────────────────────────────────────────────────
describe('a data é local, não UTC', () => {
  it('vídeo fechado às 22h fica no dia de hoje, não no de amanhã', () => {
    const noite = new Date(2026, 7, 12, 22, 30).getTime()
    expect(chaveDoDia(noite)).toBe('2026-08-12')
  })

  it('e a virada do mês não escorrega', () => {
    expect(chaveDoDia(new Date(2026, 7, 31, 23, 59).getTime())).toBe('2026-08-31')
  })
})

// ── Relatórios ────────────────────────────────────────────────────────
describe('relatório do dia e do mês', () => {
  const entregas = [
    { itemId: 1, cliente: 'Lorenzeti', titulo: 'A', tipo: 'Reel' as const, autor: 'kaique', ts: DIA, motivo: 'detectado' as const },
    { itemId: 2, cliente: 'Lorenzeti', titulo: 'B', tipo: 'Reel' as const, autor: 'kaique', ts: DIA + 3600_000, motivo: 'aprovado' as const },
    { itemId: 3, cliente: 'Kátia', titulo: 'C', tipo: 'Post' as const, autor: 'kaique', ts: DIA + 2 * DIA_MS, motivo: 'finalizado' as const },
    { itemId: 4, cliente: 'Kátia', titulo: 'D', tipo: 'Reel' as const, autor: 'kaique', ts: DIA - 40 * DIA_MS, motivo: 'aprovado' as const },
  ]

  it('o dia soma só o que é do dia', () => {
    const r = resumoDoDia(entregas, new Date(DIA))
    expect(r.total).toBe(2)
    expect(r.porCliente).toEqual({ Lorenzeti: 2 })
    expect(r.porMotivo.detectado).toBe(1)
    expect(r.porMotivo.aprovado).toBe(1)
  })

  it('o mês soma o mês e ignora o que caiu fora', () => {
    const r = resumoDoMes(entregas, new Date(DIA))
    expect(r.total).toBe(3)
    expect(r.porTipo).toEqual({ Reel: 2, Post: 1 })
  })

  it('agrupa por dia', () => {
    expect(Object.keys(agruparPorDia(entregas)).sort()).toEqual(['2026-07-03', '2026-08-12', '2026-08-14'])
  })

  it('a série cobre todos os dias do intervalo, inclusive os zerados', () => {
    const s = serieDiaria(entregas, new Date(DIA + 2 * DIA_MS), 3)
    expect(s.map(d => d.n)).toEqual([2, 0, 1])
    expect(s.map(d => d.dia)).toEqual(['2026-08-12', '2026-08-13', '2026-08-14'])
  })

  it('acha o melhor dia', () => {
    expect(melhorDia(entregas)).toEqual({ dia: '2026-08-12', n: 2 })
    expect(melhorDia([])).toBeNull()
  })

  it('a média é por dia TRABALHADO, não por dia de calendário', () => {
    // 4 entregas em 3 dias distintos — e não 4 dividido por um mês inteiro.
    expect(mediaPorDiaTrabalhado(entregas)).toBeCloseTo(4 / 3, 5)
    expect(mediaPorDiaTrabalhado([])).toBe(0)
  })
})

// ── Registros manuais ─────────────────────────────────────────────────
function manual(over: Partial<EntregaManual> = {}): EntregaManual {
  return {
    id: 'pm_1', autor: 'kaique', cliente: 'Lorenzeti', titulo: 'Feito fora do painel',
    tipo: 'Reel', ts: DIA, criadoEm: DIA, ...over,
  }
}

describe('entrega registrada à mão', () => {
  it('entra na conta quando não há card nenhum', () => {
    const { entregas } = entregasDoAutor([], {}, {}, PAINEIS_VAZIO, 'kaique', {}, [manual()])
    expect(entregas).toHaveLength(1)
    expect(entregas[0].motivo).toBe('manual')
    expect(entregas[0].manual).toBe(true)
    expect(entregas[0].manualId).toBe('pm_1')
  })

  it('NÃO conta duas vezes o card que já entrou pela dedução', () => {
    const { entregas } = entregasDoAutor(
      [item(1)],
      { 1: state({ status: 5, assignedEditor: 'kaique', approvedByClientAt: DIA }) },
      {}, PAINEIS_VAZIO, 'kaique', {},
      [manual({ itemId: 1 })],
    )
    expect(entregas).toHaveLength(1)
    // O card vence: o motivo é o carimbo, não o registro à mão.
    expect(entregas[0].motivo).toBe('aprovado')
  })

  it('mas conta o registro cujo card ainda não tem carimbo', () => {
    const { entregas } = entregasDoAutor(
      [item(1)],
      // status 1 = ainda em produção, não entra pela dedução
      { 1: state({ status: 1, assignedEditor: 'kaique' }) },
      {}, PAINEIS_VAZIO, 'kaique', {},
      [manual({ itemId: 1 })],
    )
    expect(entregas).toHaveLength(1)
    expect(entregas[0].motivo).toBe('manual')
  })

  it('não credita registro de outra pessoa', () => {
    const { entregas } = entregasDoAutor([], {}, {}, PAINEIS_VAZIO, 'kaique', {}, [
      manual({ autor: 'jhones' }),
    ])
    expect(entregas).toHaveLength(0)
  })

  it('respeita o filtro de tipo', () => {
    const manuais = [manual({ tipo: 'Post' })]
    expect(entregasDoAutor([], {}, {}, PAINEIS_VAZIO, 'kaique', { tipos: ['Reel'] }, manuais).entregas)
      .toHaveLength(0)
    expect(entregasDoAutor([], {}, {}, PAINEIS_VAZIO, 'kaique', {}, manuais).entregas)
      .toHaveLength(1)
  })

  it('entra na ordem certa junto com as deduzidas', () => {
    const { entregas } = entregasDoAutor(
      [item(1)],
      { 1: state({ status: 5, assignedEditor: 'kaique', approvedByClientAt: DIA }) },
      {}, PAINEIS_VAZIO, 'kaique', {},
      [manual({ id: 'pm_novo', ts: DIA + DIA_MS })],
    )
    expect(entregas.map(e => e.motivo)).toEqual(['manual', 'aprovado'])
  })

  it('conta no dia e no mês como qualquer outra', () => {
    const { entregas } = entregasDoAutor([], {}, {}, PAINEIS_VAZIO, 'kaique', {}, [manual()])
    expect(resumoDoDia(entregas, new Date(DIA)).total).toBe(1)
    expect(resumoDoMes(entregas, new Date(DIA)).porCliente).toEqual({ Lorenzeti: 1 })
  })
})

describe('lista de registros manuais', () => {
  it('adicionar gera id próprio e carimbo de criação', () => {
    const lista = adicionarManual([], {
      autor: 'kaique', cliente: 'Kátia', titulo: 'Reel do salão', tipo: 'Reel', ts: DIA,
    })
    expect(lista).toHaveLength(1)
    expect(lista[0].id).toMatch(/^pm_/)
    expect(lista[0].criadoEm).toBeGreaterThan(0)
    // A data do trabalho é a que a pessoa informou, não a de agora.
    expect(lista[0].ts).toBe(DIA)
  })

  it('adicionar não muda a lista original', () => {
    const antes: EntregaManual[] = []
    adicionarManual(antes, { autor: 'kaique', cliente: 'X', titulo: 'Y', tipo: 'Reel', ts: DIA })
    expect(antes).toHaveLength(0)
  })

  it('remover tira só o id pedido', () => {
    const lista = [manual({ id: 'a' }), manual({ id: 'b' })]
    expect(removerManual(lista, 'a').map(m => m.id)).toEqual(['b'])
    expect(removerManual(lista, 'inexistente')).toHaveLength(2)
  })
})
