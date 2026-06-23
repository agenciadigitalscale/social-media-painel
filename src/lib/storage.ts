import type { Client, ContentItem, ContentType, ItemState, Roteiro } from '../types'
import { migrateStatus } from '../types'
import { DATA } from '../data'

export function serializeItem(item: ContentItem) {
  return { ...item, dt: item.dt.toISOString() }
}

export function deserializeItem(raw: Record<string, unknown>): ContentItem {
  return { ...raw, dt: new Date(raw.dt as string) } as ContentItem
}

export function loadStates(): Record<number, ItemState> {
  const MIGRATION_KEY = 'sm_v2_migrated'
  try {
    const raw = localStorage.getItem('sm_states')
    if (raw) {
      const parsed = JSON.parse(raw) as Record<number, ItemState>
      if (!localStorage.getItem(MIGRATION_KEY)) {
        const migrated: Record<number, ItemState> = {}
        for (const [id, s] of Object.entries(parsed)) {
          migrated[Number(id)] = { ...s, status: migrateStatus(s.status) }
        }
        localStorage.setItem('sm_states', JSON.stringify(migrated))
        localStorage.setItem(MIGRATION_KEY, '1')
        return migrated
      }
      return parsed
    }
  } catch {}
  localStorage.setItem(MIGRATION_KEY, '1')
  const initial: Record<number, ItemState> = {}
  DATA.forEach(item => {
    initial[item.i] = { status: migrateStatus(item.s), title: '', link: '', caption: '', notes: '' }
  })
  return initial
}

export function loadCustomItems(): ContentItem[] {
  try {
    const raw = localStorage.getItem('sm_custom')
    if (!raw) return []
    return JSON.parse(raw).map(deserializeItem)
  } catch { return [] }
}

export function loadDeletedIds(): number[] {
  try {
    const raw = localStorage.getItem('sm_deleted')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function loadEditedItems(): Record<number, { dt?: string; tp?: ContentType; n?: string }> {
  try {
    const raw = localStorage.getItem('sm_edits')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function loadRoteiros(): Record<string, Roteiro[]> {
  try {
    const raw = localStorage.getItem('sm_roteiros')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function loadClientFolders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sm_client_folders')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function loadExtraClients(): Client[] {
  try {
    const raw = localStorage.getItem('sm_extra_clients')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function loadHiddenClients(): string[] {
  try {
    const raw = localStorage.getItem('sm_hidden_clients')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function loadClientColors(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sm_client_colors')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function loadClientHashtags(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem('sm_client_hashtags')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function loadCaptionTemplates(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem('sm_caption_templates')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function loadPublishFolders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sm_publish_folders')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export const SYNC_KEYS = [
  'sm_states',
  'sm_custom',
  'sm_deleted',
  'sm_edits',
  'sm_roteiros',
  'sm_client_folders',
  'sm_extra_clients',
  'sm_hidden_clients',
  'sm_client_colors',
  'sm_client_hashtags',
  'sm_caption_templates',
  'sm_financeiro',
  'sm_trafego',
  'sm_roteiro_ideias_junho_2026',
  'sm_upload_notifications',
  'sm_upload_tasks',
  'sm_publish_folders',
  'sm_client_phones',
  'sm_client_groups',
  'sm_handoffs',
  'sm_assets',
] as const

export type SyncKey = (typeof SYNC_KEYS)[number]

// ── Fila de sync offline ──────────────────────────────────────────────────────
// Cada entrada representa uma chave que precisa ser sincronizada com o D1.
// Se offline, as entradas ficam na fila até a conexão ser restaurada.

const QUEUE_KEY     = 'sm_sync_queue'
let   _isFlushing   = false
let   _pendingCount = 0

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'
let _syncStatus: SyncStatus = 'idle'
export function getSyncStatus(): SyncStatus { return _syncStatus }
const _listeners = new Set<(s: SyncStatus, pending: number) => void>()

export function onSyncStatus(fn: (s: SyncStatus, pending: number) => void): () => void {
  _listeners.add(fn)
  return () => { _listeners.delete(fn) }
}

function emit(s: SyncStatus) {
  _syncStatus = s
  _listeners.forEach(fn => fn(s, _pendingCount))
}

function loadQueue(): Array<{ key: string; value: string }> {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') } catch { return [] }
}

function saveQueue(q: Array<{ key: string; value: string }>) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  _pendingCount = q.length
}

async function flushQueue() {
  if (_isFlushing) return
  const queue = loadQueue()
  if (!queue.length) { emit('synced'); return }

  _isFlushing = true
  emit('syncing')

  try {
    // Flush all pending in parallel (each key once, latest value wins)
    const deduped = new Map<string, string>()
    queue.forEach(e => deduped.set(e.key, e.value))

    await Promise.all(
      Array.from(deduped.entries()).map(([key, value]) =>
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value }),
        })
      )
    )
    saveQueue([])
    emit('synced')
  } catch {
    emit(navigator.onLine ? 'error' : 'offline')
  } finally {
    _isFlushing = false
  }
}

export function syncToCloud(key: string, value: unknown): void {
  const serialized = JSON.stringify(value)

  // Atualiza a entrada na fila (deduplicado por chave)
  const queue = loadQueue().filter(e => e.key !== key)
  queue.push({ key, value: serialized })
  saveQueue(queue)

  // Tenta flush imediato
  flushQueue()
}

// Reconectar: flush automático quando voltar online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flushQueue())
  window.addEventListener('focus', () => {
    if (loadQueue().length > 0) flushQueue()
  })
}

/** Retorna quantas mudanças ainda não foram salvas no servidor. */
export function getPendingCount(): number {
  return loadQueue().length
}

/** Retorna o set de chaves com writes locais pendentes (não enviados ao D1 ainda). */
export function getPendingKeys(): Set<string> {
  return new Set(loadQueue().map(e => e.key))
}

/** Força um flush imediato da fila. */
export function forceSync(): Promise<void> {
  return flushQueue()
}

/**
 * Flush síncrono via sendBeacon — usar no beforeunload.
 * Garante que dados pendentes chegam ao D1 mesmo no F5/Ctrl+Shift+R.
 */
export function flushQueueBeforeUnload(): void {
  const queue = loadQueue()
  if (!queue.length) return

  const deduped = new Map<string, string>()
  queue.forEach(e => deduped.set(e.key, e.value))

  deduped.forEach((value, key) => {
    const body = JSON.stringify({ key, value })
    // sendBeacon é enviado mesmo quando a página está descarregando
    navigator.sendBeacon(
      '/api/sync',
      new Blob([body], { type: 'application/json' }),
    )
  })
  saveQueue([])
}
