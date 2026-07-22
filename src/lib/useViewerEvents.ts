import { useEffect, useSyncExternalStore } from 'react'

/**
 * O que aconteceu na tela do cliente, do lado do painel.
 *
 * O viewer público passou a reportar `opened`/`playing`/`error` (ver
 * `functions/api/viewer-log.ts`), mas dado guardado que ninguém vê não muda
 * nada: a equipe continuaria sabendo do problema pelo WhatsApp do cliente — ou
 * não sabendo. Aqui o painel lê esses eventos e o card mostra.
 *
 * Poller único no app, como o da Inbox: montar o hook de novo não cria timer.
 */

export type ViewerEventKind = 'opened' | 'playing' | 'error' | 'fallback'

export interface ViewerEvent {
  ts: number
  client: string
  itemId: number
  event: ViewerEventKind
  detail?: string
  platform?: string
}

/** O que o card precisa saber, já resumido. */
export interface ViewerSummary {
  /** Última vez que alguém abriu o link. */
  openedAt?: number
  /** Chegou a tocar/carregar de fato. */
  playedAt?: number
  /** Falha mais recente ainda não superada por um sucesso posterior. */
  failedAt?: number
  failDetail?: string
  platform?: string
}

const POLL_MS = 5 * 60_000

let summaries: Map<number, ViewerSummary> = new Map()
const listeners = new Set<() => void>()
let refCount = 0
let timer: ReturnType<typeof setInterval> | null = null
let lastError: string | null = null

const emit = () => { listeners.forEach(l => l()) }
const getSnapshot = () => summaries
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }

export function summarize(events: ViewerEvent[]): Map<number, ViewerSummary> {
  const map = new Map<number, ViewerSummary>()
  // Em ordem cronológica: um sucesso posterior apaga a falha anterior — o
  // cliente que tentou, falhou e depois assistiu não é um problema aberto.
  for (const e of [...events].sort((a, b) => a.ts - b.ts)) {
    const cur = map.get(e.itemId) ?? {}
    if (e.event === 'opened') cur.openedAt = e.ts
    if (e.event === 'playing') { cur.playedAt = e.ts; cur.failedAt = undefined; cur.failDetail = undefined }
    if (e.event === 'error' || e.event === 'fallback') {
      cur.failedAt = e.ts
      cur.failDetail = e.detail
    }
    if (e.platform) cur.platform = e.platform
    map.set(e.itemId, cur)
  }
  return map
}

/** Nome curto do aparelho — o que interessa é "iPhone ou Android?". */
export function shortPlatform(ua?: string): string {
  if (!ua) return 'aparelho desconhecido'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone/iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Mac OS X/i.test(ua)) return 'Mac'
  return 'outro aparelho'
}

async function refresh(): Promise<void> {
  try {
    const res = await fetch('/api/viewer-log')
    if (!res.ok) throw new Error(`viewer-log ${res.status}`)
    const data = await res.json() as { ok: boolean; events?: ViewerEvent[] }
    summaries = summarize(data.events ?? [])
    lastError = null
    emit()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg !== lastError) {
      lastError = msg
      console.error('[viewerEvents] falha ao buscar eventos do viewer', e)
    }
  }
}

function startPolling(): () => void {
  refCount += 1
  if (refCount === 1) {
    void refresh()
    timer = setInterval(() => { void refresh() }, POLL_MS)
  }
  return () => {
    refCount = Math.max(0, refCount - 1)
    if (refCount > 0) return
    if (timer) { clearInterval(timer); timer = null }
  }
}

export function useViewerEvents({ enabled = true }: { enabled?: boolean } = {}): Map<number, ViewerSummary> {
  const map = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  useEffect(() => {
    if (!enabled) return
    return startPolling()
  }, [enabled])
  return map
}
