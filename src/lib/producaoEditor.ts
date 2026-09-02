/* lib/producaoEditor.ts — quanto cada editor entregou, por dia e por mês.

   O painel já sabia contar o que está PARADO (atrasados, fila, workload). Não
   sabia contar o que foi FEITO. Existia um registro (`sm_editor_sessions`), mas
   ele só valia dentro do navegador de quem clicou — não sincronizava, não
   guardava autor, e só era gravado num gatilho (o botão "Entregar" do Editor).
   Vídeo aprovado pelo cliente, arrastado no board ou detectado na pasta
   Publicar não gerava linha nenhuma. Daí "não está contabilizando".

   Aqui não se cria registro novo: a entrega é DEDUZIDA dos carimbos que o card
   já guarda. Isso é de propósito — significa que o histórico existente conta
   desde já, em vez de o mês nascer zerado esperando gente clicar no lugar novo.

   ── Uma entrega por vídeo ──────────────────────────────────────────────
   Detectar o export, mover para "Pronto p/ enviar" e o cliente aprovar são três
   momentos do MESMO vídeo. Contar os três daria três. Conta-se o PRIMEIRO
   carimbo que provar que saiu da produção, e o vídeo entra uma vez só, na data
   em que o trabalho de fato terminou.

   Um card que volta em "Ajuste solicitado" e é reentregue também não conta de
   novo: a pergunta é "quantos vídeos fiz", e o vídeo continua sendo um.
*/
import { STATUS_CONFIG } from '../types'
import type { ContentItem, ContentType, ItemState, Status } from '../types'
import type { Atribuicoes, PaineisStore } from './paineis'
import { syncToCloud } from './storage'

/** Por que este card entrou na conta — o carimbo que chegou primeiro. */
export type MotivoEntrega = 'detectado' | 'finalizado' | 'aprovado' | 'publicado' | 'manual'

export const MOTIVO_LABEL: Record<MotivoEntrega, string> = {
  detectado:  'Detectado na pasta Publicar',
  finalizado: 'Finalizado e enviado para a fila',
  aprovado:   'Aprovado pelo cliente',
  publicado:  'Publicado',
  manual:     'Registrado à mão',
}

export interface Entrega {
  itemId: number
  cliente: string
  titulo: string
  tipo: ContentType
  autor: string
  /** Momento em que o vídeo passou a contar. */
  ts: number
  motivo: MotivoEntrega
  /** Veio de registro manual — só essas podem ser removidas na tela. */
  manual?: boolean
  /** Id do registro manual, para poder apagá-lo. */
  manualId?: string
}

/**
 * Entrega registrada À MÃO.
 *
 * A contagem automática é deduzida dos carimbos do card, e por isso é cega
 * para o que aconteceu fora do painel: vídeo feito sem card, card de outra
 * pessoa que na verdade quem editou foi você, trabalho de antes de o registro
 * existir. Isso não é um defeito da dedução — é o limite dela. Em vez de
 * afrouxar a regra automática (o que encheria a conta de palpite), a pessoa
 * acrescenta o que faltou.
 */
export interface EntregaManual {
  id: string
  autor: string
  cliente: string
  titulo: string
  tipo: ContentType
  /** Quando o trabalho foi feito — não quando foi registrado. */
  ts: number
  /**
   * Card correspondente, quando existe um.
   *
   * É o que impede a contagem dobrada: se o card já entrou pela dedução, o
   * registro manual do mesmo card é ignorado. Sem isso, carimbar um card que
   * alguém já tinha lançado à mão faria o mês crescer sozinho.
   */
  itemId?: number
  criadoEm: number
}

/* Status que provam que a peça saiu das mãos de quem produz. O 6 (Ajuste
   solicitado) fica de fora de propósito: ele é o caminho de VOLTA. O 8 é o
   "Pronto" aposentado — continua gravado no D1 de quem não abriu o painel
   desde a migração, e ignorá-lo apagaria entregas reais do histórico. */
const STATUS_ENTREGUE: Status[] = [2, 3, 4, 5, 7, 8 as Status]

const MOTIVO_POR_STATUS: Partial<Record<Status, MotivoEntrega>> = {
  2: 'finalizado',
  3: 'finalizado',
  4: 'finalizado',
  5: 'aprovado',
  7: 'publicado',
  [8 as Status]: 'finalizado',
}

/* As ações do histórico são escritas como `→ ${STATUS_CONFIG[s].label}` no
   App.tsx. Derivar os rótulos daqui, em vez de repetir as strings, é o que
   impede a conta de parar em silêncio no dia em que alguém renomear um status. */
const ACAO_POR_STATUS = new Map<string, Status>(
  STATUS_ENTREGUE.map(s => [`→ ${STATUS_CONFIG[s].label}`, s]),
)

// ── Autoria ───────────────────────────────────────────────────────────
/**
 * De quem é este card? O painel tem três marcas possíveis e nenhuma é
 * obrigatória, então vale a primeira que existir:
 *
 * 1. a gaveta do painel (`sm_card_painel` → `Painel.membro`) — é o gesto mais
 *    explícito e mais recente, feito na tela sobre o card;
 * 2. `assignedEditor` — o campo de editor do vídeo;
 * 3. `responsible` — o dono do card.
 *
 * Aceitar as três é o que evita a conta depender de a pessoa ter marcado no
 * lugar certo: medido em 2026-08-31, 260 de 263 cards abertos não tinham
 * `responsible` — exigir um campo só zeraria o relatório de quase todo mundo.
 */
export function autorDoCard(
  itemId: number,
  state: ItemState | undefined,
  atribuicoes: Atribuicoes,
  paineis: PaineisStore,
): string | undefined {
  const painelId = atribuicoes[itemId]
  if (painelId) {
    const membro = paineis.paineis.find(p => p.id === painelId)?.membro
    if (membro) return membro
  }
  return state?.assignedEditor || state?.responsible || undefined
}

// ── O momento da entrega ──────────────────────────────────────────────
/**
 * O primeiro carimbo que prova que a peça saiu da produção, ou `null` quando
 * não há nenhum. Devolver `null` é a resposta honesta para "não sei quando":
 * chutar a data de hoje jogaria trabalho antigo no relatório de hoje.
 */
export function momentoDaEntrega(
  state: ItemState | undefined,
): { ts: number; motivo: MotivoEntrega } | null {
  if (!state) return null
  const candidatos: { ts: number; motivo: MotivoEntrega }[] = []

  const push = (ts: number | undefined, motivo: MotivoEntrega) => {
    if (typeof ts === 'number' && Number.isFinite(ts) && ts > 0) candidatos.push({ ts, motivo })
  }

  push(state.reviewAutomationCompletedAt, 'detectado')
  push(state.sentToClientAt, 'finalizado')
  push(state.approvedByClientAt, 'aprovado')
  push(state.publishedAt, 'publicado')

  for (const h of state.history ?? []) {
    const status = ACAO_POR_STATUS.get(h.action)
    if (status !== undefined) push(h.ts, MOTIVO_POR_STATUS[status] ?? 'finalizado')
  }

  if (candidatos.length === 0) return null
  return candidatos.reduce((a, b) => (b.ts < a.ts ? b : a))
}

/** O card está num status que já saiu da produção? */
export function jaEntregue(state: ItemState | undefined, item: ContentItem): boolean {
  const status = state?.status ?? item.s
  return STATUS_ENTREGUE.includes(status)
}

// ── A lista ───────────────────────────────────────────────────────────
export interface ApuracaoOpts {
  /** Só conta estes tipos. Sem isso, conta tudo. */
  tipos?: ContentType[]
}

/**
 * Todas as entregas creditadas a `autor`, mais novas primeiro.
 * `semData` são as que estão entregues mas sem carimbo — reportadas à parte
 * para o total do mês não parecer menor do que é sem explicação.
 */
export function entregasDoAutor(
  items: ContentItem[],
  states: Record<number, ItemState>,
  atribuicoes: Atribuicoes,
  paineis: PaineisStore,
  autor: string,
  opts: ApuracaoOpts = {},
  manuais: EntregaManual[] = [],
): { entregas: Entrega[]; semData: number } {
  const entregas: Entrega[] = []
  let semData = 0

  for (const item of items) {
    if (opts.tipos && !opts.tipos.includes(item.tp)) continue
    const state = states[item.i]
    if (!jaEntregue(state, item)) continue
    if (autorDoCard(item.i, state, atribuicoes, paineis) !== autor) continue

    const momento = momentoDaEntrega(state)
    if (!momento) { semData++; continue }

    entregas.push({
      itemId: item.i,
      cliente: item.c,
      titulo: state?.title || item.n,
      tipo: item.tp,
      autor,
      ts: momento.ts,
      motivo: momento.motivo,
    })
  }

  /* Registros manuais entram depois, e o card SEMPRE vence.

     Se a pessoa lançou à mão um vídeo que ainda não tinha carimbo e o card for
     carimbado depois, os dois passariam a descrever a mesma entrega — o mês
     cresceria sozinho e ninguém entenderia por quê. Por isso o `itemId` do
     registro manual é conferido contra o que já entrou. */
  const jaContados = new Set(entregas.map(e => e.itemId))
  for (const m of manuais) {
    if (m.autor !== autor) continue
    if (opts.tipos && !opts.tipos.includes(m.tipo)) continue
    if (m.itemId !== undefined && jaContados.has(m.itemId)) continue
    entregas.push({
      /* Sem card correspondente não há id de item. O -1 NÃO identifica a
         entrega: dois registros à mão sem card teriam o mesmo. Quem identifica
         é o `manualId` logo abaixo — e é ele que a tela precisa usar como
         chave de lista. */
      itemId: m.itemId ?? -1,
      cliente: m.cliente,
      titulo: m.titulo,
      tipo: m.tipo,
      autor,
      ts: m.ts,
      motivo: 'manual',
      manual: true,
      manualId: m.id,
    })
  }

  entregas.sort((a, b) => b.ts - a.ts)
  return { entregas, semData }
}

// ── Registros manuais: persistência ───────────────────────────────────
export const MANUAIS_KEY = 'sm_producao_manual'

export function carregarManuais(): EntregaManual[] {
  try {
    const raw = JSON.parse(localStorage.getItem(MANUAIS_KEY) ?? '[]') as EntregaManual[]
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function salvarManuais(lista: EntregaManual[]): void {
  localStorage.setItem(MANUAIS_KEY, JSON.stringify(lista))
  syncToCloud(MANUAIS_KEY, lista)
}

export function adicionarManual(
  lista: EntregaManual[],
  dados: Omit<EntregaManual, 'id' | 'criadoEm'>,
): EntregaManual[] {
  const nova: EntregaManual = {
    ...dados,
    id: `pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    criadoEm: Date.now(),
  }
  return [...lista, nova]
}

export function removerManual(lista: EntregaManual[], id: string): EntregaManual[] {
  return lista.filter(m => m.id !== id)
}

// ── Agrupamento por dia e por mês ─────────────────────────────────────
/* Chaves de data em horário LOCAL. `toISOString()` converte para UTC e no
   Brasil (UTC-3) joga tudo que foi entregue depois das 21h para o dia
   seguinte — um vídeo fechado às 22h apareceria no relatório de amanhã. */
export function chaveDoDia(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function chaveDoMes(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function agruparPorDia(entregas: Entrega[]): Record<string, Entrega[]> {
  const out: Record<string, Entrega[]> = {}
  for (const e of entregas) (out[chaveDoDia(e.ts)] ??= []).push(e)
  return out
}

export interface Resumo {
  total: number
  porTipo: Record<string, number>
  porCliente: Record<string, number>
  porMotivo: Record<MotivoEntrega, number>
  entregas: Entrega[]
}

function resumir(entregas: Entrega[]): Resumo {
  const porTipo: Record<string, number> = {}
  const porCliente: Record<string, number> = {}
  const porMotivo: Record<MotivoEntrega, number> = {
    detectado: 0, finalizado: 0, aprovado: 0, publicado: 0, manual: 0,
  }
  for (const e of entregas) {
    porTipo[e.tipo] = (porTipo[e.tipo] ?? 0) + 1
    porCliente[e.cliente] = (porCliente[e.cliente] ?? 0) + 1
    porMotivo[e.motivo]++
  }
  return { total: entregas.length, porTipo, porCliente, porMotivo, entregas }
}

export function resumoDoDia(entregas: Entrega[], dia: Date): Resumo {
  const chave = chaveDoDia(dia.getTime())
  return resumir(entregas.filter(e => chaveDoDia(e.ts) === chave))
}

export function resumoDoMes(entregas: Entrega[], mes: Date): Resumo {
  const chave = chaveDoMes(mes.getTime())
  return resumir(entregas.filter(e => chaveDoMes(e.ts) === chave))
}

/** Série diária para o gráfico — do dia mais antigo ao mais recente. */
export function serieDiaria(entregas: Entrega[], ate: Date, dias: number): { dia: string; n: number }[] {
  const porDia = agruparPorDia(entregas)
  const out: { dia: string; n: number }[] = []
  const cursor = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate())
  cursor.setDate(cursor.getDate() - (dias - 1))
  for (let i = 0; i < dias; i++) {
    const chave = chaveDoDia(cursor.getTime())
    out.push({ dia: chave, n: porDia[chave]?.length ?? 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

/** Melhor dia do período — o recorde, para o relatório ter um ápice. */
export function melhorDia(entregas: Entrega[]): { dia: string; n: number } | null {
  const porDia = agruparPorDia(entregas)
  const chaves = Object.keys(porDia)
  if (chaves.length === 0) return null
  const melhor = chaves.reduce((a, b) => (porDia[b].length > porDia[a].length ? b : a))
  return { dia: melhor, n: porDia[melhor].length }
}

/**
 * Média por dia TRABALHADO, não por dia do calendário. Dividir por 30 num mês
 * em que se trabalhou 12 dias produz um número que não descreve nada.
 */
export function mediaPorDiaTrabalhado(entregas: Entrega[]): number {
  const dias = Object.keys(agruparPorDia(entregas)).length
  return dias === 0 ? 0 : entregas.length / dias
}
