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
      if (hasBeenTouched(state)) late.push(item)
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
