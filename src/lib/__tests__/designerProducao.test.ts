import { describe, expect, it } from 'vitest'
import {
  artesDoDesigner, contarAprovadas, resumoDesigner, disputaDoMes,
  serieDiariaAprovadas, aprovadasDoMes, momentoAprovacao, isAprovada,
  contarEntre, aprovadasEntre, porClienteEntre,
  relatorioAprovadasDia, relatorioAprovadasMes,
} from '../designerProducao'
import { criarPainel, editarPainel, paineisDaArea, PAINEIS_VAZIO, type Atribuicoes, type PaineisStore } from '../paineis'
import type { ContentItem, ItemState, Status } from '../../types'

// ── Fixtures ──────────────────────────────────────────────────────────
function item(i: number, over: Partial<ContentItem> = {}): ContentItem {
  return { i, c: 'Frango d\'Água', dt: new Date('2026-09-01'), tp: 'Post', n: `Arte ${i}`, s: 0, ...over }
}
function state(over: Partial<ItemState> = {}): ItemState {
  return { status: 0, title: '', link: '', caption: '', notes: '', ...over }
}

/** 10/09/2026 às 10h local. */
const DIA = new Date(2026, 8, 10, 10, 0, 0).getTime()
const DIA_MS = 86_400_000

/** Painel de Design ligado a um designer. */
function painelDe(designer: string): { paineis: PaineisStore; painelId: string } {
  const paineis = criarPainel(PAINEIS_VAZIO, 'des', designer, designer)
  return { paineis, painelId: paineisDaArea(paineis, 'des')[0].id }
}

const AP: Status = 5   // Aprovado cliente
const AGUARD: Status = 4
const CORRECAO: Status = 6
const PRODUCAO: Status = 1

// ── As regras do item 18 (contagem) ───────────────────────────────────
describe('contagem de artes aprovadas', () => {
  it('arte pendente NÃO contabiliza', () => {
    const artes = artesDoDesigner(
      [item(1)], { 1: state({ status: PRODUCAO, responsible: 'julio' }) }, {}, PAINEIS_VAZIO, 'julio',
    )
    expect(contarAprovadas(artes)).toBe(0)
  })

  it('arte aprovada contabiliza 1', () => {
    const artes = artesDoDesigner(
      [item(1)], { 1: state({ status: AP, responsible: 'julio', approvedByClientAt: DIA }) }, {}, PAINEIS_VAZIO, 'julio',
    )
    expect(contarAprovadas(artes)).toBe(1)
  })

  it('aprovar duas vezes não conta duas vezes (idempotente pelo estado)', () => {
    // O mesmo card, mesmo status aprovado — a leitura repetida não muda o número.
    const states = { 1: state({ status: AP, responsible: 'julio', approvedByClientAt: DIA }) }
    const a1 = contarAprovadas(artesDoDesigner([item(1)], states, {}, PAINEIS_VAZIO, 'julio'))
    const a2 = contarAprovadas(artesDoDesigner([item(1)], states, {}, PAINEIS_VAZIO, 'julio'))
    expect(a1).toBe(1)
    expect(a2).toBe(1)
  })

  it('aprovada e depois reprovada (ajuste) deixa de contabilizar', () => {
    const artes = artesDoDesigner(
      [item(1)], { 1: state({ status: CORRECAO, responsible: 'julio', rejectionText: 'trocar a cor' }) }, {}, PAINEIS_VAZIO, 'julio',
    )
    expect(contarAprovadas(artes)).toBe(0)
    expect(resumoDesigner(artes, new Date(DIA)).correcao).toBe(1)
  })

  it('reprovada e aprovada de novo contabiliza exatamente 1', () => {
    const artes = artesDoDesigner(
      [item(1)], {
        1: state({
          status: AP, responsible: 'julio', approvedByClientAt: DIA,
          history: [
            { action: '→ Aprovado cliente', ts: DIA - 3 * DIA_MS, user: 'cliente' },
            { action: '→ Ajuste solicitado', ts: DIA - 2 * DIA_MS, user: 'cliente' },
            { action: '→ Aprovado cliente', ts: DIA, user: 'cliente' },
          ],
        }),
      }, {}, PAINEIS_VAZIO, 'julio',
    )
    expect(contarAprovadas(artes)).toBe(1)
  })

  it('troca de designer transfere a contagem', () => {
    const de = painelDe('julio')
    // Card do Julio, aprovado.
    const st = { 1: state({ status: AP, approvedByClientAt: DIA }) }
    const atribJulio: Atribuicoes = { 1: de.painelId }
    expect(contarAprovadas(artesDoDesigner([item(1)], st, atribJulio, de.paineis, 'julio'))).toBe(1)
    // Admin troca o responsável: aponta a gaveta para Jhones.
    const paineisJhones = editarPainel(de.paineis, de.painelId, { membro: 'jhones' })
    expect(contarAprovadas(artesDoDesigner([item(1)], st, { 1: de.painelId }, paineisJhones, 'julio'))).toBe(0)
    expect(contarAprovadas(artesDoDesigner([item(1)], st, { 1: de.painelId }, paineisJhones, 'jhones'))).toBe(1)
  })

  it('arte excluída/cancelada (sm_deleted) deixa de contabilizar', () => {
    const st = { 1: state({ status: AP, responsible: 'julio', approvedByClientAt: DIA }) }
    expect(contarAprovadas(artesDoDesigner([item(1)], st, {}, PAINEIS_VAZIO, 'julio'))).toBe(1)
    const excluidos = new Set([1])
    expect(contarAprovadas(artesDoDesigner([item(1)], st, {}, PAINEIS_VAZIO, 'julio', excluidos))).toBe(0)
  })
})

// ── Data de aprovação ─────────────────────────────────────────────────
describe('quando a arte foi aprovada', () => {
  it('usa o carimbo direto do portal', () => {
    expect(momentoAprovacao(state({ status: AP, approvedByClientAt: DIA }))).toBe(DIA)
  })
  it('cai no último "Aprovado cliente" do histórico', () => {
    const ts = momentoAprovacao(state({
      status: AP,
      history: [
        { action: '→ Aprovado cliente', ts: DIA - 3 * DIA_MS, user: 'x' },
        { action: '→ Aprovado cliente', ts: DIA, user: 'x' },
      ],
    }))
    expect(ts).toBe(DIA)
  })
  it('publicada sem carimbo de aprovação usa a data de publicação', () => {
    expect(momentoAprovacao(state({ status: 7 as Status, publishedAt: DIA }))).toBe(DIA)
  })
  it('aprovada sem nenhum carimbo devolve null (entra no total, não no dia)', () => {
    expect(momentoAprovacao(state({ status: AP }))).toBeNull()
  })
  it('7 (Publicado) conta como aprovada', () => {
    expect(isAprovada(7 as Status)).toBe(true)
  })
})

// ── Resumo por período ────────────────────────────────────────────────
describe('resumo do designer por período', () => {
  const st: Record<number, ItemState> = {
    1: state({ status: AP, approvedByClientAt: DIA, responsible: 'julio' }),                  // hoje
    2: state({ status: AP, approvedByClientAt: DIA - 2 * DIA_MS, responsible: 'julio' }),      // esta semana (mesma semana)
    3: state({ status: AP, approvedByClientAt: new Date(2026, 7, 20).getTime(), responsible: 'julio' }), // agosto (outro mês)
    4: state({ status: AGUARD, responsible: 'julio' }),                                        // aguardando
    5: state({ status: CORRECAO, responsible: 'julio', rejectionText: 'x' }),                  // correção
    6: state({ status: PRODUCAO, responsible: 'julio' }),                                      // em produção
  }
  const items = [1, 2, 3, 4, 5, 6].map(i => item(i, { c: i === 2 ? 'Luthita' : 'Frango d\'Água' }))
  const artes = artesDoDesigner(items, st, {}, PAINEIS_VAZIO, 'julio')
  const r = resumoDesigner(artes, new Date(DIA))

  it('conta hoje, semana e mês pela data de aprovação', () => {
    expect(r.aprovadasHoje).toBe(1)
    expect(r.aprovadasSemana).toBe(2)  // hoje + 2 dias atrás
    expect(r.aprovadasMes).toBe(2)     // setembro (o de agosto não entra)
  })
  it('conta aguardando e correção pelo status atual', () => {
    expect(r.aguardando).toBe(1)
    expect(r.correcao).toBe(1)
  })
  it('total aprovado inclui todo mês/estado aprovado vivo', () => {
    expect(r.aprovadasTotal).toBe(3) // itens 1,2,3
  })
  it('quebra por cliente no mês', () => {
    expect(r.porClienteMes).toEqual({ 'Frango d\'Água': 1, 'Luthita': 1 })
  })
})

// ── Série diária e mês ────────────────────────────────────────────────
describe('série diária e auditoria do mês', () => {
  const st: Record<number, ItemState> = {
    1: state({ status: AP, approvedByClientAt: DIA, responsible: 'julio' }),
    2: state({ status: AP, approvedByClientAt: DIA, responsible: 'julio' }),
    3: state({ status: AP, approvedByClientAt: DIA - DIA_MS, responsible: 'julio' }),
  }
  const artes = artesDoDesigner([item(1), item(2), item(3)], st, {}, PAINEIS_VAZIO, 'julio')

  it('série diária soma as aprovadas por dia', () => {
    const serie = serieDiariaAprovadas(artes, new Date(DIA), 3)
    expect(serie[serie.length - 1].n).toBe(2) // hoje: 2
    expect(serie[serie.length - 2].n).toBe(1) // ontem: 1
  })
  it('lista de auditoria do mês traz as aprovadas', () => {
    expect(aprovadasDoMes(artes, new Date(DIA))).toHaveLength(3)
  })
})

// ── Filtros por data (item 18: "filtros por data retornam valores corretos") ──
describe('filtro por intervalo de datas', () => {
  const st: Record<number, ItemState> = {
    1: state({ status: AP, approvedByClientAt: DIA, responsible: 'julio', title: 'Hoje A' }),
    2: state({ status: AP, approvedByClientAt: DIA, responsible: 'julio', title: 'Hoje B' }),
    3: state({ status: AP, approvedByClientAt: DIA - 2 * DIA_MS, responsible: 'julio', title: 'Antes' }),
    4: state({ status: AP, approvedByClientAt: DIA + 5 * DIA_MS, responsible: 'julio', title: 'Depois' }),
  }
  const items = [1, 2, 3, 4].map(i => item(i, { c: i === 3 ? 'Luthita' : 'Frango d\'Água' }))
  const artes = artesDoDesigner(items, st, {}, PAINEIS_VAZIO, 'julio')
  const dia = new Date(DIA)
  const inicioDoDia = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate()).getTime()
  const fimDoDia = inicioDoDia + DIA_MS - 1

  it('conta só o que caiu no intervalo pedido', () => {
    expect(contarEntre(artes, inicioDoDia, fimDoDia)).toBe(2) // só as duas de hoje
  })
  it('intervalo mais largo pega os vizinhos', () => {
    const largo = contarEntre(artes, inicioDoDia - 3 * DIA_MS, fimDoDia)
    expect(largo).toBe(3) // hoje (2) + a de 2 dias atrás; a de +5 dias fica fora
  })
  it('lista e quebra por cliente respeitam o intervalo', () => {
    expect(aprovadasEntre(artes, inicioDoDia, fimDoDia)).toHaveLength(2)
    expect(porClienteEntre(artes, inicioDoDia, fimDoDia)).toEqual([{ cliente: 'Frango d\'Água', n: 2 }])
  })
})

// ── Relatório (mesmo texto para dia e mês, consistente com a tela) ─────
describe('relatório dos aprovados', () => {
  const st: Record<number, ItemState> = {
    1: state({ status: AP, approvedByClientAt: DIA, responsible: 'kaique', title: 'Reel A' }),
    2: state({ status: AP, approvedByClientAt: DIA, responsible: 'kaique', title: 'Reel B' }),
    3: state({ status: AP, approvedByClientAt: new Date(2026, 7, 20).getTime(), responsible: 'kaique', title: 'Agosto' }),
  }
  const items = [1, 2, 3].map(i => item(i, { c: 'Frango d\'Água' }))
  const artes = artesDoDesigner(items, st, {}, PAINEIS_VAZIO, 'kaique')

  it('dia lista só o que foi aprovado naquele dia, com a palavra certa', () => {
    const r = relatorioAprovadasDia(artes, new Date(DIA), 'Kaique', 'vídeo', new Date(DIA))
    expect(r.vazio).toBe(false)
    expect(r.texto).toContain('2 vídeos aprovados')
    expect(r.texto).toContain('Reel A')
    expect(r.texto).not.toContain('Agosto')
  })

  it('dia sem aprovados diz "neste dia" quando não é hoje', () => {
    const r = relatorioAprovadasDia(artes, new Date(DIA - 5 * DIA_MS), 'Kaique', 'vídeo', new Date(DIA))
    expect(r.vazio).toBe(true)
    expect(r.texto).toContain('Nada aprovado neste dia')
  })

  it('mês traz o total aprovado e a quebra por cliente', () => {
    const r = relatorioAprovadasMes(artes, new Date(DIA), 'Kaique', 'vídeo')
    expect(r.texto).toContain('Total aprovado: 2') // só setembro
    expect(r.texto).toContain('Frango d\'Água — 2')
  })
})

// ── A disputa (só a conta; a permissão decide quem vê) ─────────────────
describe('disputa do mês', () => {
  function artesCom(designer: string, n: number): ReturnType<typeof artesDoDesigner> {
    const st: Record<number, ItemState> = {}
    const its: ContentItem[] = []
    for (let k = 0; k < n; k++) {
      st[k] = state({ status: AP, approvedByClientAt: DIA, responsible: designer })
      its.push(item(k))
    }
    return artesDoDesigner(its, st, {}, PAINEIS_VAZIO, designer)
  }

  it('aponta o líder e a diferença', () => {
    const d = disputaDoMes(artesCom('julio', 42), 'julio', artesCom('jhones', 38), 'jhones', new Date(DIA))
    expect(d.lider).toBe('julio')
    expect(d.diff).toBe(4)
    expect(d.empate).toBe(false)
  })
  it('reconhece empate', () => {
    const d = disputaDoMes(artesCom('julio', 32), 'julio', artesCom('jhones', 32), 'jhones', new Date(DIA))
    expect(d.empate).toBe(true)
    expect(d.lider).toBeNull()
    expect(d.diff).toBe(0)
  })
})
