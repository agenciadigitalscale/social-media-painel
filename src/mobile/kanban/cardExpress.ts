import type { Status } from '../../types'

export type ExpressActionTone = 'blue' | 'cyan' | 'green' | 'amber' | 'red' | 'neutral'

export type ExpressAction = {
  kind: 'preview' | 'send' | 'done' | 'status'
  label: string
  tone: ExpressActionTone
  helper?: string
  targetStatus?: Status
}

export function getCardExpressAction(status: Status, previewReady: boolean): ExpressAction {
  if (previewReady) {
    return { kind: 'preview', label: 'Ver prévia', tone: 'blue', helper: 'Prévia disponível para revisão' }
  }

  if (status === 7) {
    return { kind: 'done', label: 'Publicado', tone: 'green', helper: 'Conteúdo publicado' }
  }

  return { kind: 'done', label: 'Sem ação', tone: 'neutral', helper: 'Nenhuma ação disponível no momento' }
}
