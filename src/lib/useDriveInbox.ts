import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
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
/** Consumidor que chega com dado mais velho que isto força uma busca na hora. */
const STALE_MS = 15_000

/**
 * Busca os vídeos do Drive, reconcilia os vínculos e diz quantos arquivos ainda
 * esperam decisão. Nada aqui abre modal — quem abre é o usuário.
 *
 * O poller é **um só no app inteiro**. Ele nasceu dentro deste hook, que só era
 * montado pelo ProducaoTab: quem estivesse em qualquer outra aba não recebia
 * arquivo nenhum, e o vídeo exportado ficava esperando alguém abrir Produções.
 * Agora o App liga o poller no login e todos os consumidores leem do mesmo
 * estado — montar o hook de novo não duplica requisição nem timer.
 */

interface Snapshot { videos: DriveVideo[]; loading: boolean }

let snapshot: Snapshot = { videos: [], loading: true }
const listeners = new Set<() => void>()
const newFileListeners = new Set<(videos: DriveVideo[]) => void>()
let itemClient = new Map<number, string>()
let lastError: string | null = null
let lastFetchAt = 0
let inFlight: Promise<void> | null = null
let refCount = 0
let pollTimer: ReturnType<typeof setInterval> | null = null
let scanTimer: ReturnType<typeof setInterval> | null = null

const emit = () => { listeners.forEach(l => l()) }
const getSnapshot = () => snapshot
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }

/** Quem é o cliente de cada card — a reconciliação de vínculos depende disso. */
function setItemIndex(items: ContentItem[]) {
  itemClient = new Map(items.map(i => [i.i, i.c]))
}

export function refreshDriveInbox(): Promise<void> {
  // Intervalo, foco e clique manual coincidem com frequência: uma busca só.
  if (inFlight) return inFlight
  inFlight = (async () => {
    // Marca a TENTATIVA: com a API fora do ar, cada tela nova pediria de novo.
    lastFetchAt = Date.now()
    try {
      const res = await fetch('/api/drive-videos?status=all')
      if (!res.ok) throw new Error(`drive-videos ${res.status}`)
      const data = await res.json() as DriveVideosResponse
      const fresh = data.videos ?? []
      lastError = null
      snapshot = { videos: fresh, loading: false }
      emit()
      reconcileMediaLinksFromDrive(fresh, data.presence ?? null, itemClient)

      // Aviso uma única vez por arquivo novo — depois ele vive no contador.
      const state = getInboxState()
      const unseen = fresh.filter(v => v.status === 'inbox' && needsToast(state[v.drive_file_id]))
      if (unseen.length) {
        newFileListeners.forEach(l => l(unseen))
        markFilesSeen(unseen.map(v => v.drive_file_id))
      }
    } catch (e) {
      // O poll é de 60s: sem esta dedupe, uma indisponibilidade de alguns minutos
      // enterra o console em linhas idênticas. Erro novo continua aparecendo.
      const msg = e instanceof Error ? e.message : String(e)
      if (msg !== lastError) {
        lastError = msg
        console.error('[driveInbox] falha ao buscar vídeos do Drive', e)
      }
      if (snapshot.loading) { snapshot = { ...snapshot, loading: false }; emit() }
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

/** Scan do Drive em background — silencioso, ignora rate-limit. */
function triggerScan() {
  fetch('/api/drive-scan', { method: 'POST', headers: { 'X-App-Manual': '1' } })
    .then(r => r.ok ? r.json() as Promise<{ new_videos?: number }> : null)
    .then(data => { if (data?.new_videos) void refreshDriveInbox() })
    .catch(() => {})
}

const onFocus = () => { void refreshDriveInbox() }

function startPolling(): () => void {
  refCount += 1
  if (refCount === 1) {
    void refreshDriveInbox()
    pollTimer = setInterval(() => { void refreshDriveInbox() }, POLL_MS)
    window.addEventListener('focus', onFocus)
    triggerScan()
    scanTimer = setInterval(triggerScan, SCAN_MS)
  } else if (Date.now() - lastFetchAt > STALE_MS) {
    void refreshDriveInbox()
  }
  return () => {
    refCount = Math.max(0, refCount - 1)
    if (refCount > 0) return
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null }
    window.removeEventListener('focus', onFocus)
  }
}

export function useInboxState(): InboxStateMap {
  return useSyncExternalStore(subscribeInboxState, getInboxState, getInboxState)
}

export function useDriveInbox({ items, onNewFiles, enabled = true }: {
  items: ContentItem[]
  /** Chamado uma única vez por lote de arquivos ainda não vistos. */
  onNewFiles?: (videos: DriveVideo[]) => void
  /** O App só liga a busca depois do login; os boards apenas consomem. */
  enabled?: boolean
}) {
  const { videos, loading } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const inboxState = useInboxState()

  useEffect(() => { setItemIndex(items) }, [items])

  const onNewFilesRef = useRef(onNewFiles)
  onNewFilesRef.current = onNewFiles
  const wantsNewFiles = !!onNewFiles
  useEffect(() => {
    if (!wantsNewFiles) return
    const listener = (fresh: DriveVideo[]) => onNewFilesRef.current?.(fresh)
    newFileListeners.add(listener)
    return () => { newFileListeners.delete(listener) }
  }, [wantsNewFiles])

  useEffect(() => {
    if (!enabled) return
    return startPolling()
  }, [enabled])

  const pendingVideos = useMemo(
    () => videos.filter(v => v.status === 'inbox' && isPending(inboxState[v.drive_file_id])),
    [videos, inboxState],
  )

  const ignoredVideos = useMemo(
    () => videos.filter(v => v.status === 'inbox' && inboxState[v.drive_file_id]?.ignoredAt),
    [videos, inboxState],
  )

  return {
    videos, loading, refresh: refreshDriveInbox,
    inboxState, pendingVideos, ignoredVideos,
    pendingCount: pendingVideos.length,
  }
}
