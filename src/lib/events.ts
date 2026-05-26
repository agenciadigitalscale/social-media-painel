// ── Sistema de Eventos Operacionais ────────────────────────
// Camada de eventos que registra todas as ações do sistema.
// Atualmente localStorage-backed. Preparado para migrar para D1/Supabase.

export type EventType =
  | 'VIDEO_CREATED'
  | 'VIDEO_STATUS_CHANGED'
  | 'VIDEO_RECORDED'
  | 'VIDEO_SENT_TO_EDITING'
  | 'VIDEO_SENT_TO_CLIENT'
  | 'VIDEO_APPROVED_BY_CLIENT'
  | 'VIDEO_REJECTED_BY_CLIENT'
  | 'VIDEO_PUBLISHED'
  | 'CLIENT_CREATED'
  | 'CLIENT_WITHOUT_POST_ALERT'
  | 'TASK_OVERDUE'
  | 'RECORDING_CREATED'
  | 'DESIGN_APPROVED'
  | 'CAPTION_GENERATED'
  | 'FINANCIAL_PAYMENT_RECEIVED'
  | 'FINANCIAL_PAYMENT_OVERDUE'
  | 'LEAD_STAGE_CHANGED'

export type EventSeverity = 'info' | 'warning' | 'success' | 'error'

export interface OperationalEvent {
  id: string
  type: EventType
  severity: EventSeverity
  // Context
  itemId?: number
  clientName?: string
  userId?: string
  // Payload
  payload?: Record<string, unknown>
  // Display
  title: string
  description?: string
  // Time
  ts: number                // Unix timestamp ms
  date: string              // YYYY-MM-DD (for grouping/querying)
}

// ── Storage ─────────────────────────────────────────────────

const STORAGE_KEY = 'sm_event_log'
const MAX_EVENTS  = 500

function loadEvents(): OperationalEvent[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch { return [] }
}

function saveEvents(events: OperationalEvent[]) {
  // Keep only last MAX_EVENTS to prevent localStorage bloat
  const trimmed = events.slice(-MAX_EVENTS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
}

// ── EventBus ─────────────────────────────────────────────────

type EventListener = (event: OperationalEvent) => void
const listeners: Set<EventListener> = new Set()

export const EventBus = {
  /** Emit a new operational event */
  emit(event: Omit<OperationalEvent, 'id' | 'ts' | 'date'>): OperationalEvent {
    const now = Date.now()
    const full: OperationalEvent = {
      ...event,
      id:   `${event.type}_${now}_${Math.random().toString(36).slice(2, 7)}`,
      ts:   now,
      date: new Date(now).toISOString().slice(0, 10),
    }
    const events = loadEvents()
    events.push(full)
    saveEvents(events)
    listeners.forEach(fn => fn(full))
    return full
  },

  /** Subscribe to real-time events in this session */
  subscribe(fn: EventListener): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },

  /** Load all stored events, optionally filtered */
  getAll(filters?: {
    type?: EventType
    clientName?: string
    itemId?: number
    since?: number    // Unix ms
    limit?: number
  }): OperationalEvent[] {
    let events = loadEvents()
    if (filters?.type)       events = events.filter(e => e.type === filters.type)
    if (filters?.clientName) events = events.filter(e => e.clientName === filters.clientName)
    if (filters?.itemId)     events = events.filter(e => e.itemId === filters.itemId)
    if (filters?.since)      events = events.filter(e => e.ts >= filters.since!)
    const sorted = events.sort((a, b) => b.ts - a.ts)
    return filters?.limit ? sorted.slice(0, filters.limit) : sorted
  },

  /** Get events for a specific item (for timeline) */
  getItemTimeline(itemId: number): OperationalEvent[] {
    return loadEvents()
      .filter(e => e.itemId === itemId)
      .sort((a, b) => a.ts - b.ts)
  },

  /** Get events for a specific client */
  getClientTimeline(clientName: string): OperationalEvent[] {
    return loadEvents()
      .filter(e => e.clientName === clientName)
      .sort((a, b) => a.ts - b.ts)
  },

  /** Today's event count by type */
  todayStats(): Record<string, number> {
    const today = new Date().toISOString().slice(0, 10)
    const events = loadEvents().filter(e => e.date === today)
    return events.reduce<Record<string, number>>((acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1
      return acc
    }, {})
  },

  /** Clear all events (admin use) */
  clear() {
    localStorage.removeItem(STORAGE_KEY)
  },
}

// ── Convenience factories ─────────────────────────────────────

export function emitVideoStatusChanged(params: {
  itemId: number
  clientName: string
  fromStatus: number
  toStatus: number
  userId?: string
  title?: string
}) {
  const STATUS_LABELS: Record<number, string> = {
    0: 'Pendente', 1: 'Em edição', 2: 'Aprovação interna', 3: 'Aprovado interno',
    4: 'Enviado ao cliente', 5: 'Aprovado pelo cliente', 6: 'Reprovado', 7: 'Publicado',
  }
  const toLabel = STATUS_LABELS[params.toStatus] ?? String(params.toStatus)

  const typeMap: Record<number, EventType> = {
    1: 'VIDEO_SENT_TO_EDITING',
    4: 'VIDEO_SENT_TO_CLIENT',
    5: 'VIDEO_APPROVED_BY_CLIENT',
    6: 'VIDEO_REJECTED_BY_CLIENT',
    7: 'VIDEO_PUBLISHED',
  }

  const sevMap: Record<number, EventSeverity> = {
    1: 'info', 4: 'info', 5: 'success', 6: 'error', 7: 'success',
  }

  return EventBus.emit({
    type:        typeMap[params.toStatus] ?? 'VIDEO_STATUS_CHANGED',
    severity:    sevMap[params.toStatus] ?? 'info',
    itemId:      params.itemId,
    clientName:  params.clientName,
    userId:      params.userId,
    title:       `${params.clientName} → ${toLabel}`,
    description: params.title ? `"${params.title}"` : undefined,
    payload:     { fromStatus: params.fromStatus, toStatus: params.toStatus },
  })
}

export function emitTaskOverdue(params: {
  itemId: number
  clientName: string
  title?: string
  daysLate: number
}) {
  return EventBus.emit({
    type:       'TASK_OVERDUE',
    severity:   'warning',
    itemId:     params.itemId,
    clientName: params.clientName,
    title:      `Conteúdo atrasado ${params.daysLate}d — ${params.clientName}`,
    description: params.title,
    payload:    { daysLate: params.daysLate },
  })
}

export function emitVideoPublished(params: {
  itemId: number
  clientName: string
  title?: string
  userId?: string
}) {
  return EventBus.emit({
    type:       'VIDEO_PUBLISHED',
    severity:   'success',
    itemId:     params.itemId,
    clientName: params.clientName,
    userId:     params.userId,
    title:      `✅ Publicado — ${params.clientName}`,
    description: params.title,
  })
}
