import type { ContentItem, ContentType, ItemState, RoteiroStatus, Status } from '../../types'
import { STATUS_CONFIG } from '../../types'
import { DS } from '../../theme'

/**
 * Peças usadas pelo board de Produções E pelo board de Roteiros.
 *
 * Existe para quebrar o ciclo de import: o `ProducaoTab` renderiza o
 * `RoteirosBoard`, e os dois liam as mesmas constantes quando moravam no mesmo
 * arquivo de 5.563 linhas. Sem este módulo, separá-los faria um importar o
 * outro nos dois sentidos.
 */

// ── Colunas ───────────────────────────────────────────────────────────────────

export interface ColDef { status: Status; label: string; color: string }

/** Colunas derivam do STATUS_CONFIG (fonte única) — o board só escolhe quais mostra. */
export const col = (status: Status): ColDef => ({
  status,
  label: STATUS_CONFIG[status].shortLabel,
  color: STATUS_CONFIG[status].color,
})

/** Assinatura do filtro que cada board aplica sobre os itens. */
export type BoardFilterFn = (item: ContentItem, state: ItemState) => boolean

// ── Datas ─────────────────────────────────────────────────────────────────────

/** `<input type="date">` espera AAAA-MM-DD no fuso local — `toISOString` erra o dia. */
export const toLocalDateInput = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

// ── Tipos de conteúdo ─────────────────────────────────────────────────────────

export const ALL_TYPES: ContentType[] = ['Post', 'Reel', 'Story', 'Carrossel', 'Feed']

// ── Roteiros ──────────────────────────────────────────────────────────────────

export const MONTH_NAMES_ROT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
export const ROT_COLOR = '#FB7185'

export const ROTEIRO_STATUS_FLOW: RoteiroStatus[] = ['ideia', 'escrevendo', 'revisao', 'pronto']

export const ROTEIRO_STATUS_CFG: Record<RoteiroStatus, { label: string; color: string; icon: string }> = {
  ideia:      { label: 'Ideia',      color: DS.neutral, icon: '💡' },
  escrevendo: { label: 'Escrevendo', color: DS.accent, icon: '✏️' },
  revisao:    { label: 'Revisão',    color: DS.amber, icon: '👀' },
  pronto:     { label: 'Pronto',     color: DS.green, icon: '✅' },
}
