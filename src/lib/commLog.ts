export type CommEvent = 'sent_to_client' | 'approved_client' | 'rejected_client' | 'published' | 'note'

export interface CommLogEntry {
  id: string
  clientName: string
  itemId: number
  itemTitle: string
  event: CommEvent
  actor?: string
  note?: string
  ts: number
}

const KEY = 'sm_comm_log'
const MAX = 2000

export function loadCommLog(): CommLogEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function appendCommLog(entry: Omit<CommLogEntry, 'id'>): void {
  const log = loadCommLog()
  log.unshift({ ...entry, id: `${entry.ts}-${entry.itemId}` })
  localStorage.setItem(KEY, JSON.stringify(log.slice(0, MAX)))
}

export function getClientLog(clientName: string): CommLogEntry[] {
  return loadCommLog().filter(e => e.clientName === clientName)
}

export const EVENT_META: Record<CommEvent, { label: string; color: string; emoji: string }> = {
  sent_to_client:   { label: 'Enviado ao cliente',       color: '#FF9A3D', emoji: '📤' },
  approved_client:  { label: 'Aprovado pelo cliente',    color: '#00C47A', emoji: '✅' },
  rejected_client:  { label: 'Reprovado pelo cliente',   color: '#FF4545', emoji: '🔄' },
  published:        { label: 'Publicado',                color: '#3B8EFF', emoji: '🚀' },
  note:             { label: 'Anotação',                 color: '#C084FC', emoji: '📝' },
}
