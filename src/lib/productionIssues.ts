import type { ContentItem, ItemState } from '../types'
import { getCardPreview, type MediaLinkMap } from './mediaLinks'
import type { ReadyAutomationMap } from './readyAutomation'

/**
 * Cards que precisam de uma mão humana.
 *
 * Sem isto, um vínculo que falhou fica invisível: o card senta numa coluna com
 * um selo discreto e só aparece quando alguém tropeça nele — normalmente na
 * hora de enviar ao cliente, que é tarde. Aqui eles são reunidos com o motivo
 * em português e a ação prática correspondente.
 *
 * A detecção é deliberadamente ESTREITA. Varrer todo card sem arquivo geraria
 * uma lista de dezenas de itens legítimos (post de feed, conteúdo que nem passa
 * pelo Drive) e a área viraria ruído que ninguém abre.
 */

export type IssueKind =
  | 'review_without_file'  // está em Revisão interna, mas não há prévia para revisar
  | 'preview_failed'       // achou o arquivo, mas ele não abre
  | 'ambiguous'            // vários arquivos compatíveis — alguém precisa escolher
  | 'scan_error'           // não foi possível ler a pasta Publicar
  | 'linked_but_parked'    // o vídeo existe e está vinculado, mas o card não andou

export type IssueAction = 'link_manually' | 'retry_detect' | 'pick_file' | 'move_to_review'

export interface ProductionIssue {
  itemId: number
  clientName: string
  title: string
  kind: IssueKind
  /** Frase pronta para a tela — sem jargão, dizendo o que houve. */
  message: string
  /** Detalhe técnico quando existir (motivo da falha, nome do arquivo). */
  detail?: string
  action: IssueAction
  actionLabel: string
}

const ACTION_LABEL: Record<IssueAction, string> = {
  link_manually: 'Vincular arquivo',
  retry_detect: 'Tentar detectar de novo',
  pick_file: 'Escolher arquivo',
  move_to_review: 'Mover para Revisão',
}

function issue(
  item: ContentItem,
  title: string,
  kind: IssueKind,
  message: string,
  action: IssueAction,
  detail?: string,
): ProductionIssue {
  return {
    itemId: item.i,
    clientName: item.c,
    title,
    kind,
    message,
    detail,
    action,
    actionLabel: ACTION_LABEL[action],
  }
}

export function computeProductionIssues(
  items: ContentItem[],
  states: Record<number, ItemState>,
  links: MediaLinkMap,
  readyStates: ReadyAutomationMap,
): ProductionIssue[] {
  const out: ProductionIssue[] = []

  for (const item of items) {
    const state = states[item.i]
    const status = state?.status ?? item.s
    const title = state?.title || item.n
    const ready = readyStates[item.i]

    // A esteira parou num estado que só um humano resolve. Vale em qualquer
    // coluna: o card pode ter sido movido à mão depois da falha.
    if (ready?.phase === 'ambiguous') {
      out.push(issue(
        item, title, 'ambiguous',
        `Encontramos ${ready.candidates?.length ?? 2} arquivos compatíveis na pasta Publicar.`,
        'pick_file',
      ))
      continue
    }
    if (ready?.phase === 'invalid') {
      out.push(issue(
        item, title, 'preview_failed',
        'O arquivo foi encontrado, mas não pôde ser aberto.',
        'link_manually',
        ready.error ?? ready.filename,
      ))
      continue
    }
    if (ready?.phase === 'error') {
      out.push(issue(
        item, title, 'scan_error',
        ready.error === 'no_folder'
          ? 'A pasta Publicar não está configurada para este cliente.'
          : 'Não foi possível consultar a pasta Publicar.',
        'retry_detect',
        ready.error === 'no_folder' ? undefined : ready.error,
      ))
      continue
    }

    /**
     * O vídeo EXISTE, está vinculado e confirmado — e o card continua em "A
     * fazer"/"Produção". Visto em produção: cards com arquivo exportado e
     * vinculado parados em "A fazer", parecendo trabalho que nunca começou.
     *
     * Acontece quando o vínculo veio pela Inbox (o "Vincular" anexa o arquivo
     * mas não mexe no status) ou quando alguém arrastou o card de volta depois
     * de vinculado. Nos dois casos ninguém percebe: o card fica na primeira
     * coluna, com a entrega pronta dentro dele.
     */
    const link = links[item.i]
    if ((status === 0 || status === 1) && link?.confirmed && link.clientId === item.c) {
      out.push(issue(
        item, title, 'linked_but_parked',
        'O vídeo já está vinculado a este card, mas ele não saiu da primeira coluna.',
        'move_to_review',
        link.filename,
      ))
      continue
    }

    // Está em Revisão interna sem nada para revisar. É o caso que mais dói: a
    // revisão não acontece e ninguém percebe que o arquivo nunca chegou.
    if (status === 2 && getCardPreview(item, links, status).kind !== 'ready') {
      out.push(issue(
        item, title, 'review_without_file',
        'Está em Revisão interna, mas ainda não há prévia para revisar.',
        'link_manually',
      ))
    }
  }

  return out
}
