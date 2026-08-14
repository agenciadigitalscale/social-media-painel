import type { ContentItem, ItemState } from '../types'
import { isOpenStatus } from '../types'

/**
 * O que realmente precisa de alguém hoje.
 *
 * Nasceu de uma medição: o painel anuncia **452 atrasados**, e o `data.ts` tem
 * exatamente 452 itens semeados (226 de Junho + 226 de Julho). Desses, só 11
 * foram tocados alguma vez. A operação real roda em 894 cards criados à mão,
 * dos quais 679 já foram publicados.
 *
 * Ou seja: o alarme principal é o calendário automático inteiro, que ninguém
 * usa. Um número que nunca muda e nunca fica verde deixa de ser lido — e um
 * card genuinamente parado some no meio de 452 fantasmas.
 *
 * A distinção que este módulo faz:
 *
 * - **atrasado**: alguém começou (existe estado gravado), a data passou e não
 *   foi publicado. É trabalho de verdade, parado.
 * - **nunca iniciado**: item do calendário semeado que ninguém tocou, de um mês
 *   que já fechou. Não é atraso — é plano que não aconteceu.
 *
 * Na tela do celular só o primeiro grupo aparece. O segundo não é escondido por
 * conveniência: ele simplesmente não é uma lista de tarefas.
 */

/**
 * Os baldes são MUTUAMENTE EXCLUSIVOS: cada card aparece uma vez só. Uma tela
 * de celular com o mesmo card em três seções é pior que não ter tela.
 *
 * A ordem abaixo é a de urgência, e ela segue de quem é a bola:
 */
export interface TodayBuckets {
  /**
   * Cliente pediu ajuste e a bola voltou para a equipe. É o mais urgente da
   * lista: alguém do lado de fora está esperando. Medido em produção: 12 cards
   * assim, com mediana de 55 dias.
   */
  needsFix: ContentItem[]
  /** Começou, passou da data, não publicou — e a bola é da equipe. */
  late: ContentItem[]
  /** Vence hoje. */
  today: ContentItem[]
  /** Em revisão interna: trava interna, antes de ir ao cliente. */
  inReview: ContentItem[]
  /** Enviado e aguardando resposta — a bola é do cliente, não é atraso nosso. */
  withClient: ContentItem[]
  /** Item do calendário semeado, de mês fechado, nunca tocado. */
  neverStarted: number
}

function startOfDay(d: Date): number {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c.getTime()
}

/**
 * O card foi tocado por alguém?
 *
 * Ter linha em `states` já é sinal de toque — o `updateItem` só grava quando
 * alguém mexe. Mas um estado que só carrega `status: 0` e nada mais pode ter
 * vindo de migração, então o critério exige status avançado OU algum campo
 * preenchido.
 */
export function hasBeenTouched(state: ItemState | undefined): boolean {
  if (!state) return false
  if (state.status !== 0) return true
  return !!(state.title || state.link || state.caption || state.notes
    || state.responsible || state.footageLink || state.assignedEditor
    || (state.history && state.history.length > 0))
}

/**
 * O card representa trabalho de alguém?
 *
 * `hasBeenTouched` olha só o estado, e isso deixa um buraco: **card criado à
 * mão é trabalho por definição** — alguém abriu o diálogo e digitou. Hoje o
 * `addItem` grava `title` junto, então o `hasBeenTouched` acerta por
 * consequência; mas basta um card salvo com título vazio para ele virar
 * "fantasma" e sumir da lista de atrasados. Sumir da contagem por excesso é
 * bem pior que aparecer a mais: some trabalho real da tela de quem precisa
 * fazê-lo.
 *
 * A operação inteira roda em card criado à mão (894 deles contra 452
 * semeados), então este é o caminho comum, não a exceção.
 */
export function isRealWork(item: ContentItem, state: ItemState | undefined): boolean {
  return item.custom === true || hasBeenTouched(state)
}

export function computeTodayBuckets(
  items: ContentItem[],
  states: Record<number, ItemState>,
  now: Date,
): TodayBuckets {
  const todayMs = startOfDay(now)
  const tomorrowMs = todayMs + 86_400_000

  const needsFix: ContentItem[] = []
  const late: ContentItem[] = []
  const today: ContentItem[] = []
  const withClient: ContentItem[] = []
  const inReview: ContentItem[] = []
  let neverStarted = 0

  for (const item of items) {
    const state = states[item.i]
    const status = state?.status ?? item.s
    const dtMs = startOfDay(new Date(item.dt))

    // Publicado e aprovado saem do radar de trabalho.
    if (!isOpenStatus(status)) continue

    // Primeiro a origem da espera; depois o prazo. Um card em ajuste há dois
    // meses não deve competir por atenção com um que vence hoje — ele ganha.
    if (status === 6) { needsFix.push(item); continue }
    if (status === 4) { withClient.push(item); continue }
    if (status === 2) { inReview.push(item); continue }

    if (dtMs >= todayMs && dtMs < tomorrowMs) {
      today.push(item)
      continue
    }

    if (dtMs < todayMs) {
      // A distinção que faz o número voltar a significar alguma coisa.
      if (isRealWork(item, state)) late.push(item)
      else neverStarted += 1
    }
  }

  const porData = (a: ContentItem, b: ContentItem) =>
    new Date(a.dt).getTime() - new Date(b.dt).getTime()

  return {
    needsFix: needsFix.sort(porData),
    late: late.sort(porData),
    today: today.sort(porData),
    inReview: inReview.sort(porData),
    withClient: withClient.sort(porData),
    neverStarted,
  }
}

/** Há quantos dias o item passou da data. */
export function daysLate(item: ContentItem, now: Date): number {
  return Math.floor((startOfDay(now) - startOfDay(new Date(item.dt))) / 86_400_000)
}

/**
 * Este card está atrasado DE VERDADE?
 *
 * Os baldes acima resolvem a tela do celular, onde cada card aparece uma vez só
 * e em uma seção específica. Mas as telas de desktop não querem baldes — querem
 * **um número**: "Atrasados: N" no Meu Dia, no Dashboard, por cliente na lista.
 * Elas calculavam esse número à mão, cada uma com uma variação sutil, e todas
 * contando os fantasmas — foi o que fez o painel abrir anunciando 452.
 *
 * Aqui a mesma regra do balde `late` vira predicado reutilizável, para que a
 * decisão exista em UM lugar. Três condições:
 *
 *  1. `isOpenStatus` — e não `status < 7`, que PARECE dizer o mesmo e não diz:
 *     o status 8 legado é numericamente maior que o 7, então card parado nele
 *     sumia da contagem. Ainda existe 8 gravado no D1 de quem não abriu o painel
 *     desde a migração.
 *  2. A data passou (comparada por DIA, não por instante — senão um card de
 *     hoje de manhã conta como atrasado à tarde).
 *  3. **Alguém tocou.** É esta que faz o número voltar a significar algo.
 *
 * Diferente do balde `late`, este predicado NÃO tira os status 2/4/6 do bolo:
 * as telas de desktop sempre contaram "tudo que passou da data e não publicou",
 * e mudar isso aqui alteraria o significado de cada contador de uma vez. O bug
 * é o fantasma; o resto do recorte é decisão de produto e fica como está.
 */
export function isRealLate(
  item: ContentItem,
  state: ItemState | undefined,
  now: Date,
): boolean {
  if (!isOpenStatus(state?.status ?? item.s)) return false
  if (startOfDay(new Date(item.dt)) >= startOfDay(now)) return false
  return isRealWork(item, state)
}

/** Os itens atrasados de verdade — para quem precisa da lista, não só do total. */
export function realLateItems(
  items: ContentItem[],
  states: Record<number, ItemState>,
  now: Date,
): ContentItem[] {
  return items.filter(i => isRealLate(i, states[i.i], now))
}

/** Quantos atrasados de verdade — o número que vai na tela. */
export function countRealLate(
  items: ContentItem[],
  states: Record<number, ItemState>,
  now: Date,
): number {
  let n = 0
  for (const i of items) if (isRealLate(i, states[i.i], now)) n += 1
  return n
}
