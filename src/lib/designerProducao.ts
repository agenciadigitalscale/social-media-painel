/* lib/designerProducao.ts — quantas artes APROVADAS cada designer produziu.

   O foco é um só: contar sem erro, por dia e por mês, as artes aprovadas de
   cada designer (Julio, Jhones…). O pagamento é calculado à parte, fora do
   painel — aqui só entra o número.

   ── Por que a contagem NÃO usa eventos +1/-1 ──────────────────────────────
   Contar por evento é onde o erro mora: um refresh, um re-sync ou um clique
   repetido geram outro +1, e o total infla sem ninguém perceber. Aqui a arte é
   uma UNIDADE derivada do estado ATUAL do card:

     status atual ∈ {Aprovado cliente, Publicado}  →  conta 1
     qualquer outro status                          →  conta 0

   Isso torna a regra idempotente de graça:
     • Aprovada → Aprovada          = 1  (o estado não mudou)
     • Aprovada → Ajuste (reprovada) = 0  (saiu do conjunto aprovado)
     • Ajuste → Aprovada de novo     = 1  (nunca 2)
     • trocar o designer responsável = a arte anda junto (a autoria é do card)
     • card excluído (sm_deleted)    = 0  (nem entra na lista)

   O HISTÓRICO de status continua no próprio card (`state.history`) e nunca é
   apagado para mexer num número — a contagem é uma leitura do histórico, não o
   contrário.
*/
import { STATUS_CONFIG, statusRank } from '../types'
import type { ContentItem, ItemState, Status } from '../types'
import type { Atribuicoes, PaineisStore } from './paineis'
import { autorDoCard, type EntregaManual } from './producaoEditor'

/* Status que representam uma arte APROVADA pelo cliente. O 7 (Publicado) entra
   porque publicar pressupõe ter sido aprovado — um card publicado que não
   contasse sumiria da produção no dia em que fosse ao ar. */
export const STATUS_APROVADA: Status[] = [5, 7]

/* O 4 é "aguardando aprovação"; o 6 é "ajuste solicitado" (a reprovação /
   correção do fluxo de design). Não há um status "reprovada" separado no DS
   HUB — a devolução do cliente é o 6. */
const STATUS_AGUARDANDO: Status = 4
const STATUS_CORRECAO: Status = 6

export function isAprovada(status: Status): boolean {
  return STATUS_APROVADA.includes(status)
}

/* Contagem por FINALIZAÇÃO (perfil de vídeo, ex.: Kaique): conta quando o card
   chega em "Pronto p/ enviar" (3) e dali em diante — o editor já finalizou. Em
   "A fazer" (0) e "Produção" (1) não conta; se voltar para produção, deixa de
   contar. Deriva do status ATUAL, então é idempotente igual à de aprovados.

   Usa o RANK do fluxo (STATUS_ORDER), não o número: assim 2 (Revisão) e o 8
   aposentado — que vêm ANTES do 3 no fluxo — ficam de fora, e 3,4,5,6,7 entram. */
const RANK_FINALIZADO = statusRank(3)

export function isFinalizado(status: Status): boolean {
  return statusRank(status) >= RANK_FINALIZADO
}

/* Rótulos de história que provam que o card chegou à finalização (3 em diante).
   O 6 (Ajuste) fica de fora daqui porque é um retorno, não uma finalização — o
   momento vale pelo primeiro carimbo de P/ enviar, Enviado, Aprovado ou Publicado. */
const ACAO_FINALIZADO = new Set([3, 4, 5, 7].map(s => `→ ${STATUS_CONFIG[s as Status].label}`))

/**
 * Quando o vídeo foi finalizado (chegou a P/ enviar+), ou `null`. Vale o carimbo
 * mais ANTIGO — o dia em que o trabalho de fato terminou. Mesma ideia do
 * `momentoDaEntrega` de producaoEditor, com o limiar em P/ enviar.
 */
export function momentoFinalizacao(state: ItemState | undefined): number | null {
  if (!state) return null
  const cand: number[] = []
  const push = (ts?: number) => { if (typeof ts === 'number' && Number.isFinite(ts) && ts > 0) cand.push(ts) }
  push(state.reviewAutomationCompletedAt)
  push(state.sentToClientAt)
  push(state.approvedByClientAt)
  push(state.publishedAt)
  for (const h of state.history ?? []) if (ACAO_FINALIZADO.has(h.action)) push(h.ts)
  return cand.length ? Math.min(...cand) : null
}

/* Rótulo de história gravado no App.tsx como `→ ${label}`. Derivar do
   STATUS_CONFIG (em vez de repetir a string) é o que impede a conta de parar
   em silêncio no dia em que alguém renomear o status. */
const ACAO_APROVADO = `→ ${STATUS_CONFIG[5].label}`

/**
 * Quando a arte foi aprovada, ou `null` se não dá para saber.
 *
 * Prioriza o carimbo direto (`approvedByClientAt`, gravado pelo portal na
 * aprovação); cai no último `→ Aprovado cliente` do histórico; e, para uma arte
 * publicada sem carimbo de aprovação, usa a data de publicação. Devolver `null`
 * é a resposta honesta para "não sei quando" — ela entra no total mas não num
 * dia específico, em vez de chutar hoje.
 */
export function momentoAprovacao(state: ItemState | undefined): number | null {
  if (!state) return null
  if (typeof state.approvedByClientAt === 'number' && state.approvedByClientAt > 0) {
    return state.approvedByClientAt
  }
  let ultimo: number | null = null
  for (const h of state.history ?? []) {
    if (h.action === ACAO_APROVADO && typeof h.ts === 'number' && h.ts > 0) {
      if (ultimo === null || h.ts > ultimo) ultimo = h.ts
    }
  }
  if (ultimo !== null) return ultimo
  if (state.publishedAt && typeof state.publishedAt === 'number' && state.publishedAt > 0) {
    return state.publishedAt
  }
  return null
}

/** Uma arte/vídeo de uma pessoa — o card, com o que a auditoria precisa ver. */
export interface ArteDesigner {
  itemId: number
  cliente: string
  titulo: string
  designer: string
  status: Status
  /** Entra na conta? (aprovada, no perfil design; finalizada, no de vídeo.) */
  aprovada: boolean
  /** Momento em que passou a contar (para agrupar por dia/mês). `null` = sem carimbo. */
  aprovadaEm: number | null
  aprovadaPor?: string
  /** Motivo da última devolução, quando houver. */
  motivoCorrecao?: string
  /** Veio de registro manual — só essas podem ser removidas na tela. */
  manual?: boolean
  manualId?: string
}

/**
 * Como contar: o que vale (predicado) e quando passou a valer (momento).
 *
 * Padrão = APROVADO (status 5/7), o caso dos designers. O perfil de vídeo passa
 * `conta: isFinalizado` + `momento: momentoFinalizacao` para contar a partir de
 * "P/ enviar". `manuais` são os registros à mão, mesclados com a MESMA regra do
 * producaoEditor: o card sempre vence (não conta duas vezes).
 */
export interface ContagemOpts {
  conta?: (status: Status) => boolean
  momento?: (state: ItemState | undefined) => number | null
  manuais?: EntregaManual[]
}

/** Chave única de uma linha — manual pelo próprio id, card pelo itemId. Sem isto
    dois registros manuais (itemId -1) colidiriam e a conta cairia para 1. */
function chaveArte(a: ArteDesigner): string {
  return a.manual ? `m:${a.manualId}` : `i:${a.itemId}`
}

/**
 * Todas as peças atribuídas a `designer`, exceto as excluídas.
 *
 * A autoria vem de `autorDoCard` (a mesma de `producaoEditor`): gaveta → editor
 * → responsável. Reusar essa função é o que faz a troca de responsável e a
 * atribuição por gaveta valerem aqui sem código novo.
 */
export function artesDoDesigner(
  items: ContentItem[],
  states: Record<number, ItemState>,
  atrib: Atribuicoes,
  paineis: PaineisStore,
  designer: string,
  excluidos: ReadonlySet<number> = new Set(),
  opts: ContagemOpts = {},
): ArteDesigner[] {
  const conta = opts.conta ?? isAprovada
  const momento = opts.momento ?? momentoAprovacao
  const out: ArteDesigner[] = []
  const idsContados = new Set<number>()
  for (const item of items) {
    if (excluidos.has(item.i)) continue
    const state = states[item.i]
    if (autorDoCard(item.i, state, atrib, paineis) !== designer) continue
    const status = (state?.status ?? item.s) as Status
    const aprovada = conta(status)
    if (aprovada) idsContados.add(item.i)
    out.push({
      itemId: item.i,
      cliente: item.c,
      titulo: state?.title || item.n,
      designer,
      status,
      aprovada,
      aprovadaEm: aprovada ? momento(state) : null,
      aprovadaPor: state?.approvedByClientAt ? 'cliente' : undefined,
      motivoCorrecao: status === STATUS_CORRECAO ? state?.rejectionText : undefined,
    })
  }
  // Registros à mão — o card SEMPRE vence: um manual que aponta para um card já
  // contado é ignorado, senão o mês cresceria sozinho.
  for (const m of opts.manuais ?? []) {
    if (m.autor !== designer) continue
    if (m.itemId !== undefined && idsContados.has(m.itemId)) continue
    if (m.itemId !== undefined) idsContados.add(m.itemId)
    out.push({
      itemId: m.itemId ?? -1,
      cliente: m.cliente,
      titulo: m.titulo,
      designer,
      status: 3 as Status,
      aprovada: true,
      aprovadaEm: m.ts,
      manual: true,
      manualId: m.id,
    })
  }
  return out
}

/** Só as peças que contam agora — a base de qualquer total. */
export function aprovadas(artes: ArteDesigner[]): ArteDesigner[] {
  return artes.filter(a => a.aprovada)
}

/**
 * Quantas peças contam — nunca conta a mesma duas vezes (chave por card ou por
 * id do registro manual).
 */
export function contarAprovadas(artes: ArteDesigner[]): number {
  const chaves = new Set<string>()
  for (const a of artes) if (a.aprovada) chaves.add(chaveArte(a))
  return chaves.size
}

// ── Chaves de data em horário LOCAL ───────────────────────────────────
/* `toISOString()` converte para UTC e no Brasil (UTC-3) joga o que foi
   aprovado depois das 21h para o dia seguinte. */
export function chaveDoDia(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function chaveDoMes(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function inicioDaSemana(ref: Date): number {
  // Semana começa na segunda — o padrão da agência para "esta semana".
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const dow = (d.getDay() + 6) % 7 // 0 = segunda
  d.setDate(d.getDate() - dow)
  return d.getTime()
}

export interface ResumoDesigner {
  designer: string
  aprovadasHoje: number
  aprovadasSemana: number
  aprovadasMes: number
  /** Total aprovado em toda a base (para o card "total aprovado"). */
  aprovadasTotal: number
  aguardando: number
  correcao: number
  /** Aprovadas sem carimbo de data — entram no total, não num dia. */
  semData: number
  /** Aprovadas do mês por cliente, para a quebra da auditoria. */
  porClienteMes: Record<string, number>
}

/**
 * Os números de um designer para a tela.
 *
 * Hoje / semana / mês contam pela DATA DE APROVAÇÃO — é quando a arte passou a
 * valer. Aguardando e correção contam pelo status atual (são fila, não
 * histórico). `aprovadasTotal` é a produção aprovada viva na base inteira.
 */
export function resumoDesigner(artes: ArteDesigner[], ref: Date): ResumoDesigner {
  const chaveHoje = chaveDoDia(ref.getTime())
  const chaveMes = chaveDoMes(ref.getTime())
  const semanaInicio = inicioDaSemana(ref)
  const fimDoDia = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999).getTime()

  let aprovadasHoje = 0, aprovadasSemana = 0, aprovadasMes = 0, aprovadasTotal = 0
  let aguardando = 0, correcao = 0, semData = 0
  const porClienteMes: Record<string, number> = {}

  const contadas = new Set<string>()
  for (const a of artes) {
    if (!a.manual && a.status === STATUS_AGUARDANDO) aguardando++
    if (!a.manual && a.status === STATUS_CORRECAO) correcao++
    const chave = chaveArte(a)
    if (!a.aprovada || contadas.has(chave)) continue
    contadas.add(chave)
    aprovadasTotal++
    if (a.aprovadaEm === null) { semData++; continue }
    const ts = a.aprovadaEm
    if (chaveDoDia(ts) === chaveHoje) aprovadasHoje++
    if (ts >= semanaInicio && ts <= fimDoDia) aprovadasSemana++
    if (chaveDoMes(ts) === chaveMes) {
      aprovadasMes++
      porClienteMes[a.cliente] = (porClienteMes[a.cliente] ?? 0) + 1
    }
  }

  return {
    designer: artes[0]?.designer ?? '',
    aprovadasHoje, aprovadasSemana, aprovadasMes, aprovadasTotal,
    aguardando, correcao, semData, porClienteMes,
  }
}

/** Série diária de aprovadas — do dia mais antigo ao mais recente. */
export function serieDiariaAprovadas(artes: ArteDesigner[], ate: Date, dias: number): { dia: string; n: number }[] {
  const porDia: Record<string, number> = {}
  for (const a of aprovadas(artes)) {
    if (a.aprovadaEm === null) continue
    const k = chaveDoDia(a.aprovadaEm)
    porDia[k] = (porDia[k] ?? 0) + 1
  }
  const out: { dia: string; n: number }[] = []
  const cursor = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate())
  cursor.setDate(cursor.getDate() - (dias - 1))
  for (let i = 0; i < dias; i++) {
    const k = chaveDoDia(cursor.getTime())
    out.push({ dia: k, n: porDia[k] ?? 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

/**
 * Aprovadas num intervalo [inicio, fim] pela data de aprovação — a base dos
 * filtros de período (hoje, ontem, semana, mês, personalizado). Datas sem
 * carimbo ficam de fora do intervalo de propósito: só entram no total geral.
 */
export function aprovadasEntre(artes: ArteDesigner[], inicio: number, fim: number): ArteDesigner[] {
  return aprovadas(artes)
    .filter(a => a.aprovadaEm !== null && a.aprovadaEm >= inicio && a.aprovadaEm <= fim)
    .sort((a, b) => (b.aprovadaEm ?? 0) - (a.aprovadaEm ?? 0))
}

/** Contagem de aprovadas no intervalo — nunca conta o mesmo card duas vezes. */
export function contarEntre(artes: ArteDesigner[], inicio: number, fim: number): number {
  const ids = new Set<number>()
  for (const a of aprovadasEntre(artes, inicio, fim)) ids.add(a.itemId)
  return ids.size
}

/** Aprovadas por cliente num intervalo, mais produtivo primeiro. */
export function porClienteEntre(artes: ArteDesigner[], inicio: number, fim: number): { cliente: string; n: number }[] {
  const porCliente: Record<string, number> = {}
  for (const a of aprovadasEntre(artes, inicio, fim)) {
    porCliente[a.cliente] = (porCliente[a.cliente] ?? 0) + 1
  }
  return Object.entries(porCliente).map(([cliente, n]) => ({ cliente, n })).sort((a, b) => b.n - a.n)
}

/** Aprovadas do mês, por cliente, mais produtivo primeiro. */
export function aprovadasPorClienteMes(artes: ArteDesigner[], ref: Date): { cliente: string; n: number }[] {
  const chaveMes = chaveDoMes(ref.getTime())
  const porCliente: Record<string, number> = {}
  for (const a of aprovadas(artes)) {
    if (a.aprovadaEm === null || chaveDoMes(a.aprovadaEm) !== chaveMes) continue
    porCliente[a.cliente] = (porCliente[a.cliente] ?? 0) + 1
  }
  return Object.entries(porCliente).map(([cliente, n]) => ({ cliente, n })).sort((a, b) => b.n - a.n)
}

/** As artes aprovadas do mês, para a lista de auditoria. */
export function aprovadasDoMes(artes: ArteDesigner[], ref: Date): ArteDesigner[] {
  const chaveMes = chaveDoMes(ref.getTime())
  return aprovadas(artes)
    .filter(a => a.aprovadaEm !== null && chaveDoMes(a.aprovadaEm) === chaveMes)
    .sort((a, b) => (b.aprovadaEm ?? 0) - (a.aprovadaEm ?? 0))
}

// ── Relatório (texto para mandar no grupo) ────────────────────────────
export interface RelatorioProd {
  titulo: string
  linhas: string[]
  texto: string
  vazio: boolean
}

function nomeDoMes(d: Date): string {
  return d.toLocaleDateString('pt-BR', { month: 'long' })
}

/** Relatório de UM dia — os aprovados daquele dia, por cliente. `hoje` decide só
    o texto do dia vazio ("hoje" vs "neste dia"); sem ele, assume que é hoje. */
export function relatorioAprovadasDia(artes: ArteDesigner[], quando: Date, quem: string, subst: string, hoje?: Date): RelatorioProd {
  const chave = chaveDoDia(quando.getTime())
  const doDia = aprovadas(artes).filter(a => a.aprovadaEm !== null && chaveDoDia(a.aprovadaEm) === chave)
  const dataLonga = quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const titulo = `Produção de ${quem} · ${dataLonga}`
  const ehHoje = !hoje || chaveDoDia(hoje.getTime()) === chave
  if (doDia.length === 0) {
    return { titulo, linhas: [], vazio: true, texto: `${titulo}\nNada aprovado ${ehHoje ? 'hoje' : 'neste dia'}.` }
  }
  const linhas = doDia.map(a => `• ${a.cliente} — ${a.titulo}`)
  const quantos = doDia.length === 1 ? `1 ${subst} aprovado` : `${doDia.length} ${subst}s aprovados`
  return { titulo, linhas, vazio: false, texto: [titulo, quantos, '', ...linhas].join('\n') }
}

/** Relatório do MÊS — total aprovado e o ranking de clientes. */
export function relatorioAprovadasMes(artes: ArteDesigner[], quando: Date, quem: string, subst: string): RelatorioProd {
  const doMes = aprovadasDoMes(artes, quando)
  const titulo = `Produção de ${quem} · ${nomeDoMes(quando)} de ${quando.getFullYear()}`
  if (doMes.length === 0) {
    return { titulo, linhas: [], vazio: true, texto: `${titulo}\nNenhum ${subst} aprovado.` }
  }
  const clientes = porClienteEntre(artes,
    new Date(quando.getFullYear(), quando.getMonth(), 1).getTime(),
    new Date(quando.getFullYear(), quando.getMonth() + 1, 0, 23, 59, 59, 999).getTime())
  const linhas = [
    `Total aprovado: ${doMes.length}`,
    '',
    'Por cliente:',
    ...clientes.map(c => `• ${c.cliente} — ${c.n}`),
  ]
  return { titulo, linhas, vazio: false, texto: [titulo, '', ...linhas].join('\n') }
}

// ── A disputa Julio × Jhones ──────────────────────────────────────────
export interface Disputa {
  a: { designer: string; n: number }
  b: { designer: string; n: number }
  lider: string | null   // designer na frente, ou null no empate
  diff: number           // diferença absoluta
  empate: boolean
}

/**
 * A comparação do mês entre dois designers. Pura de propósito: quem decide se
 * PODE ver isto é a permissão (a competição é só da gestão) — a função só faz a
 * conta, e assim ela é testável sem tela nem sessão.
 */
export function disputaDoMes(
  artesA: ArteDesigner[], designerA: string,
  artesB: ArteDesigner[], designerB: string,
  ref: Date,
): Disputa {
  const na = resumoDesigner(artesA, ref).aprovadasMes
  const nb = resumoDesigner(artesB, ref).aprovadasMes
  const empate = na === nb
  return {
    a: { designer: designerA, n: na },
    b: { designer: designerB, n: nb },
    lider: empate ? null : na > nb ? designerA : designerB,
    diff: Math.abs(na - nb),
    empate,
  }
}
