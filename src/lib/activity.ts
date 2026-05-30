// ── Activity Log — rastreia ações da equipe ──────────────────────────────────
// Persistido em localStorage. Máximo de 500 entradas (LIFO).
// ─────────────────────────────────────────────────────────────────────────────

export type ActionType =
  | 'criou'
  | 'excluiu'
  | 'moveu_status'
  | 'editou_titulo'
  | 'reagendou'
  | 'duplicou'
  | 'enviou_cliente'
  | 'vinculou_criativo'
  | 'aprovou_interno'

export interface ActivityEntry {
  id: string
  user: string        // key do NAME_MAP (ex: 'kerges')
  action: ActionType
  itemId: number
  itemTitle: string
  clientName: string
  detail?: string     // ex: 'Em edição → Aprovação interna'
  ts: number          // epoch ms
}

const KEY      = 'sm_activity_log'
const MAX      = 500

export function loadActivity(): ActivityEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function logActivity(entry: Omit<ActivityEntry, 'id'>): void {
  if (!entry.user) return       // sem usuário logado, não loga
  const list = loadActivity()
  const next = [{ ...entry, id: crypto.randomUUID() }, ...list].slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(next))
}

export function clearActivity(): void {
  localStorage.removeItem(KEY)
}

export const ACTION_LABEL: Record<ActionType, string> = {
  criou:              'criou',
  excluiu:            'excluiu',
  moveu_status:       'moveu',
  editou_titulo:      'editou',
  reagendou:          'reagendou',
  duplicou:           'duplicou',
  enviou_cliente:     'enviou ao cliente',
  vinculou_criativo:  'vinculou criativo',
  aprovou_interno:    'aprovou internamente',
}

export const ACTION_EMOJI: Record<ActionType, string> = {
  criou:              '✨',
  excluiu:            '🗑️',
  moveu_status:       '→',
  editou_titulo:      '✏️',
  reagendou:          '📅',
  duplicou:           '📋',
  enviou_cliente:     '📤',
  vinculou_criativo:  '🔗',
  aprovou_interno:    '✅',
}
