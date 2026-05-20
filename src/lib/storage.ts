import type { Client, ContentItem, ContentType, ItemState, Roteiro } from '../types'
import { DATA } from '../data'

export function serializeItem(item: ContentItem) {
  return { ...item, dt: item.dt.toISOString() }
}

export function deserializeItem(raw: Record<string, unknown>): ContentItem {
  return { ...raw, dt: new Date(raw.dt as string) } as ContentItem
}

export function loadStates(): Record<number, ItemState> {
  try {
    const raw = localStorage.getItem('sm_states')
    if (raw) return JSON.parse(raw)
  } catch {}
  const initial: Record<number, ItemState> = {}
  DATA.forEach(item => {
    initial[item.i] = { status: item.s, title: '', link: '', caption: '', notes: '' }
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
] as const

export type SyncKey = (typeof SYNC_KEYS)[number]

export function syncToCloud(key: string, value: unknown) {
  fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value: JSON.stringify(value) }),
  }).catch(() => {})
}
