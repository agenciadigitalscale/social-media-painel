import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ContentItem } from '../types'
import {
  getInboxState, subscribeInboxState, markFilesSeen, isPending, needsToast,
  type InboxStateMap,
} from './driveInbox'
import { reconcileMediaLinksFromDrive, type DrivePresence, type DriveVideoRow } from './mediaLinks'

export interface DriveVideo extends DriveVideoRow {
  file_size_bytes: number | null
  thumbnail_url: string | null
  detected_at: number
}

interface DriveVideosResponse {
  ok: boolean
  videos?: DriveVideo[]
  presence?: DrivePresence | null
}

const POLL_MS = 60_000
const SCAN_MS = 90_000

export function useInboxState(): InboxStateMap {
  return useSyncExternalStore(subscribeInboxState, getInboxState, getInboxState)
}

/**
 * Busca os vídeos do Drive, reconcilia os vínculos e diz quantos arquivos ainda
 * esperam decisão. Nada aqui abre modal — quem abre é o usuário.
 */
export function useDriveInbox({ items, onNewFiles }: {
  items: ContentItem[]
  /** Chamado uma única vez por lote de arquivos ainda não vistos. */
  onNewFiles?: (videos: DriveVideo[]) => void
}) {
  const [videos, setVideos] = useState<DriveVideo[]>([])
  const [loading, setLoading] = useState(true)
  const inboxState = useInboxState()

  const itemClientById = useMemo(() => new Map(items.map(i => [i.i, i.c])), [items])
  const itemClientRef = useRef(itemClientById)
  itemClientRef.current = itemClientById
  const lastErrorRef = useRef<string | null>(null)
  const onNewFilesRef = useRef(onNewFiles)
  onNewFilesRef.current = onNewFiles

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/drive-videos?status=all')
      if (!res.ok) throw new Error(`drive-videos ${res.status}`)
      const data = await res.json() as DriveVideosResponse
      const fresh = data.videos ?? []
      setVideos(fresh)
      lastErrorRef.current = null
      reconcileMediaLinksFromDrive(fresh, data.presence ?? null, itemClientRef.current)

      // Toast uma única vez por arquivo novo — depois ele vive no contador.
      const state = getInboxState()
      const unseen = fresh.filter(v => v.status === 'inbox' && needsToast(state[v.drive_file_id]))
      if (unseen.length) {
        onNewFilesRef.current?.(unseen)
        markFilesSeen(unseen.map(v => v.drive_file_id))
      }
    } catch (e) {
      // O poll é de 60s: sem esta dedupe, uma indisponibilidade de alguns minutos
      // enterra o console em linhas idênticas. Erro novo continua aparecendo.
      const msg = e instanceof Error ? e.message : String(e)
      if (msg !== lastErrorRef.current) {
        lastErrorRef.current = msg
        console.error('[driveInbox] falha ao buscar vídeos do Drive', e)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus) }
  }, [refresh])

  // Scan do Drive em background — silencioso, ignora rate-limit
  useEffect(() => {
    const triggerScan = () => {
      fetch('/api/drive-scan', { method: 'POST', headers: { 'X-App-Manual': '1' } })
        .then(r => r.ok ? r.json() as Promise<{ new_videos?: number }> : null)
        .then(data => { if (data?.new_videos) refresh() })
        .catch(() => {})
    }
    triggerScan()
    const id = setInterval(triggerScan, SCAN_MS)
    return () => clearInterval(id)
  }, [refresh])

  const pendingVideos = useMemo(
    () => videos.filter(v => v.status === 'inbox' && isPending(inboxState[v.drive_file_id])),
    [videos, inboxState],
  )

  const ignoredVideos = useMemo(
    () => videos.filter(v => v.status === 'inbox' && inboxState[v.drive_file_id]?.ignoredAt),
    [videos, inboxState],
  )

  return {
    videos, setVideos, loading, refresh,
    inboxState, pendingVideos, ignoredVideos,
    pendingCount: pendingVideos.length,
  }
}
