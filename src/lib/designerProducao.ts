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
import { STATUS_CONFIG } from '../types'
import type { ContentItem, ItemState, Status } from '../types'
import type { Atribuicoes, PaineisStore } from './paineis'
import { autorDoCard } from './producaoEditor'

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

/** Uma arte de um designer — o card, com o que a auditoria precisa ver. */
export interface ArteDesigner {
  itemId: number
  cliente: string
  titulo: string
  designer: string
  status: Status
  aprovada: boolean
  /** Momento da aprovação (para agrupar por dia/mês). `null` = aprovada sem carimbo. */
  aprovadaEm: number | null
  aprovadaPor?: string
  /** Motivo da última devolução, quando houver. */
  motivoCorrecao?: string
}

/**
 * Todas as artes atribuídas a `designer`, exceto as excluídas.
 *
 * A autoria vem de `autorDoCard` (a mesma de `producaoEditor`): gaveta do painel
 * de Design → `assignedEditor` → `responsible`. Reusar essa função é o que faz a
 * troca de designer e a atribuição por gaveta valerem aqui sem código novo.
 */
export function artesDoDesigner(
  items: ContentItem[],
  states: Record<number, ItemState>,
  atrib: Atribuicoes,
  paineis: PaineisStore,
  designer: string,
  excluidos: ReadonlySet<number> = new Set(),
): ArteDesigner[] {
  const out: ArteDesigner[] = []
  for (const item of items) {
    if (excluidos.has(item.i)) continue
    const state = states[item.i]
    if (autorDoCard(item.i, state, atrib, paineis) !== designer) continue
    const status = (state?.status ?? item.s) as Status
    const aprovada = isAprovada(status)
    out.push({
      itemId: item.i,
      cliente: item.c,
      titulo: state?.title || item.n,
      designer,
      status,
      aprovada,
      aprovadaEm: aprovada ? momentoAprovacao(state) : null,
      aprovadaPor: state?.approvedByClientAt ? 'cliente' : undefined,
      motivoCorrecao: status === STATUS_CORRECAO ? state?.rejectionText : undefined,
    })
  }
  return out
}

/** Só as artes aprovadas agora — a base de qualquer total. */
export function aprovadas(artes: ArteDesigner[]): ArteDesigner[] {
  return artes.filter(a => a.aprovada)
}

/**
 * Quantas artes aprovadas — nunca conta a mesma duas vezes.
 *
 * O `itemId` único é a chave: mesmo que a lista trouxesse o mesmo card repetido
 * (não traz, mas a garantia é barata), ele entra uma vez só.
 */
export function contarAprovadas(artes: ArteDesigner[]): number {
  const ids = new Set<number>()
  for (const a of artes) if (a.aprovada) ids.add(a.itemId)
  return ids.size
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

  const contadas = new Set<number>()
  for (const a of artes) {
    if (a.status === STATUS_AGUARDANDO) aguardando++
    if (a.status === STATUS_CORRECAO) correcao++
    if (!a.aprovada || contadas.has(a.itemId)) continue
    contadas.add(a.itemId)
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
