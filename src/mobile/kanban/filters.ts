import type { ContentItem, ItemState, Status, ContentType, Client } from '../../types'
import { isOpenStatus, statusBefore } from '../../types'

// ── Estado de filtro do Kanban mobile ──────────────────────
export type QuickKey =
  | 'hoje' | 'atrasados' | 'meus' | 'urgentes'
  | 'sem-editor' | 'sem-roteiro' | 'pronto-social' | 'aprovacao' | 'publicar-hoje'

export type PrazoKey = 'hoje' | 'semana' | 'atrasado' | 'futuro'

export interface KanbanFilters {
  quick: QuickKey[]
  client?: string
  responsible?: string
  type?: ContentType
  priority?: 'alta' | 'media' | 'baixa'
  prazo?: PrazoKey
  creative?: 'missing' | 'processing' | 'ready'
  approval?: 'internal' | 'client' | 'adjustment' | 'approved'
  nicho?: 'gastronomico' | 'variados'
}

export const EMPTY_FILTERS: KanbanFilters = { quick: [] }

export const QUICK_DEFS: { key: QuickKey; label: string; emoji: string }[] = [
  { key: 'hoje',          label: 'Hoje',            emoji: '📅' },
  { key: 'atrasados',     label: 'Atrasados',       emoji: '🔴' },
  { key: 'meus',          label: 'Meus',            emoji: '👤' },
  { key: 'urgentes',      label: 'Urgentes',        emoji: '⚡' },
  { key: 'sem-editor',    label: 'Sem editor',      emoji: '✂️' },
  { key: 'sem-roteiro',   label: 'Sem roteiro',     emoji: '📝' },
  { key: 'pronto-social', label: 'Pronto p/ Social', emoji: '🚀' },
  { key: 'aprovacao',     label: 'Em aprovação',    emoji: '👁️' },
  { key: 'publicar-hoje', label: 'Publicar hoje',   emoji: '📤' },
]

const dayMs = 86_400_000

function quickPass(key: QuickKey, item: ContentItem, s: ItemState, now: Date, currentUser: string): boolean {
  const todayMs = new Date(now).setHours(0, 0, 0, 0)
  const dtMs = new Date(item.dt).setHours(0, 0, 0, 0)
  const status = s.status
  switch (key) {
    case 'hoje':          return dtMs === todayMs
    case 'atrasados':     return isOpenStatus(status) && dtMs < todayMs
    case 'meus':          return s.responsible === currentUser || s.assignedEditor === currentUser
    case 'urgentes':      return s.priority === 'alta' || (isOpenStatus(status) && dtMs <= todayMs + dayMs)
    case 'sem-editor':    return !s.assignedEditor && statusBefore(status, 3)
    case 'sem-roteiro':   return !s.roteiroLink && statusBefore(status, 2)
    case 'pronto-social': return status === 3
    case 'aprovacao':     return status === 2 || status === 4
    case 'publicar-hoje': return (status === 3 || status === 5) && dtMs <= todayMs
  }
}

export function makePredicate(
  filters: KanbanFilters,
  now: Date,
  currentUser: string,
  clientsByName: Record<string, Client>,
): (item: ContentItem, s: ItemState) => boolean {
  const todayMs = new Date(now).setHours(0, 0, 0, 0)
  return (item, s) => {
    for (const q of filters.quick) if (!quickPass(q, item, s, now, currentUser)) return false
    if (filters.client && item.c !== filters.client) return false
    if (filters.responsible && s.responsible !== filters.responsible && s.assignedEditor !== filters.responsible) return false
    if (filters.type && item.tp !== filters.type) return false
    if (filters.priority && (s.priority ?? 'media') !== filters.priority) return false
    if (filters.nicho && clientsByName[item.c]?.nicho !== filters.nicho) return false
    if (filters.prazo) {
      const dtMs = new Date(item.dt).setHours(0, 0, 0, 0)
      if (filters.prazo === 'hoje' && dtMs !== todayMs) return false
      if (filters.prazo === 'atrasado' && !(isOpenStatus(s.status) && dtMs < todayMs)) return false
      if (filters.prazo === 'semana' && !(dtMs >= todayMs && dtMs <= todayMs + 7 * dayMs)) return false
      if (filters.prazo === 'futuro' && !(dtMs > todayMs)) return false
    }
    return true
  }
}

export function countActive(f: KanbanFilters): number {
  return f.quick.length + (f.client ? 1 : 0) + (f.responsible ? 1 : 0) + (f.type ? 1 : 0)
    + (f.priority ? 1 : 0) + (f.prazo ? 1 : 0) + (f.creative ? 1 : 0)
    + (f.approval ? 1 : 0) + (f.nicho ? 1 : 0)
}

export function toggleQuick(f: KanbanFilters, key: QuickKey): KanbanFilters {
  const has = f.quick.includes(key)
  return { ...f, quick: has ? f.quick.filter(k => k !== key) : [...f.quick, key] }
}

// ── Filtros salvos (localStorage + sync) ───────────────────
export interface SavedFilter { id: string; name: string; emoji: string; filters: KanbanFilters }

export const PRESET_FILTERS: SavedFilter[] = [
  { id: 'p-meus-hoje',   name: 'Meus hoje',       emoji: '🎯', filters: { quick: ['meus', 'hoje'] } },
  { id: 'p-publicar',    name: 'Publicar hoje',   emoji: '📤', filters: { quick: ['publicar-hoje'] } },
  { id: 'p-urgentes',    name: 'Urgentes',        emoji: '⚡', filters: { quick: ['urgentes'] } },
  { id: 'p-social',      name: 'Aguardando Social', emoji: '🚀', filters: { quick: ['pronto-social'] } },
  { id: 'p-atrasados',   name: 'Atrasados',       emoji: '🔴', filters: { quick: ['atrasados'] } },
]

const SAVED_KEY = 'sm_mobile_saved_filters'

export function loadSavedFilters(): SavedFilter[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    return raw ? (JSON.parse(raw) as SavedFilter[]) : []
  } catch { return [] }
}

export function persistSavedFilters(list: SavedFilter[]): void {
  localStorage.setItem(SAVED_KEY, JSON.stringify(list))
}
