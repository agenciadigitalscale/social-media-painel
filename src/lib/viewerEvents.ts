import { useSyncExternalStore } from 'react'

/**
 * O que aconteceu na tela do cliente — lido uma vez, usado em todo lugar.
 *
 * O `/api/viewer-log` já registrava desde 2026-07-22, mas o painel só sabia
 * disso na aba Entregas. A informação que muda o trabalho do dia, porém, é a
 * que aparece **no card**: mandar o criativo e não saber se o cliente chegou a
 * abrir transforma toda cobrança num chute. "Enviado há 2 dias e nunca aberto"
 * e "abriu três vezes e não respondeu" pedem mensagens diferentes.
 *
 * Poller **único no app inteiro**, com refcount: o `ContentCard` é montado às
 * centenas, e cada um assinando não pode virar centenas de requisições. Montar
 * o hook de novo só adiciona um ouvinte.
 */

export type ViewerEventKind = 'opened' | 'playing' | 'stalled' | 'error' | 'fallback'

export interface ViewerEvent {
  ts: number
  client: string
  itemId: number
  event: ViewerEventKind
  detail?: string
  platform?: string
}

export interface ItemViewerSummary {
  /** Quantas vezes o cliente abriu o link deste criativo. */
  opens: number
  lastOpenedAt?: number
  /** O vídeo chegou a rodar pelo menos uma vez. */
  played: boolean
  /** Engasgos: `stalled` explícito + os inferidos do histórico antigo. */
  struggles: number
  lastStruggleAt?: number
  lastFailureAt?: number
  lastFailureDetail?: string
  lastFailurePlatform?: string
}

/**
 * `playing` que volta a disparar dentro desta janela é retomada depois de
 * travar, não uma nova sessão. Foi assim que o Lareiras Grill acumulou oito
 * `playing` em dez segundos e o painel leu como "assistiu bem".
 */
const REBUFFER_MS = 30_000

/**
 * Reabrir o mesmo link em minutos é o gesto de quem desistiu e tentou de novo.
 * A Kátia fez isso às 13:45 e 13:47, e reclamou às 13:48.
 */
const RETRY_MS = 10 * 60_000

/** Uma leitura a cada 5 min basta: isto orienta cobrança, não é tempo real. */
const POLL_MS = 5 * 60_000
/** Consumidor que chega com dado mais velho que isto força uma busca na hora. */
const STALE_MS = 60_000

interface Snapshot {
  events: ViewerEvent[]
  byItem: Map<number, ItemViewerSummary>
  loading: boolean
  error: string | null
}

const EMPTY: Snapshot = { events: [], byItem: new Map(), loading: true, error: null }

let snapshot: Snapshot = EMPTY
/** Assinatura do último payload — payload igual não re-renderiza ninguém. */
let lastSignature = ''
const listeners = new Set<() => void>()
let inFlight: Promise<void> | null = null
let lastFetchAt = 0
let refCount = 0
let pollTimer: ReturnType<typeof setInterval> | null = null

const emit = () => { listeners.forEach(l => l()) }

/** "iPhone ou Android?" é a única parte do user agent que muda o que a equipe faz. */
export function describePlatform(ua?: string): string {
  if (!ua) return 'Desconhecido'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone/iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Mac OS X/i.test(ua)) return 'Mac'
  return 'Outro'
}

/**
 * O `detail` chega como o viewer gravou (`video code=4`). São os códigos do
 * `MediaError` do HTML — traduzir importa porque cada um pede uma ação
 * diferente da equipe, e "code=4" não diz isso a ninguém.
 */
export function describeDetail(detail?: string): string {
  if (!detail) return 'Motivo não registrado'
  const code = detail.match(/code=(\d)/)?.[1]
  if (code === '1') return 'Reprodução cancelada pelo aparelho'
  if (code === '2') return 'A conexão caiu no meio do vídeo'
  if (code === '3') return 'Arquivo corrompido ou que o aparelho não decodifica'
  if (code === '4') return 'O aparelho recusou o arquivo sem tentar (mime/formato)'

  // Registro antigo, de quando a falha de imagem não dizia a causa.
  if (detail === 'imagem: todas as fontes falharam') return 'Nenhuma fonte da imagem carregou'

  // As mensagens novas já vêm em português e distinguem o motivo — achatar
  // todas em "nenhuma fonte carregou" jogaria fora exatamente a informação que
  // separa "mandaram vazio" de "arquivo do Drive inacessível".
  if (detail.startsWith('imagem: ')) {
    const dito = detail.slice('imagem: '.length)
    return dito.charAt(0).toUpperCase() + dito.slice(1)
  }

  return detail
}

/**
 * Resume o que aconteceu com cada criativo.
 *
 * O `stalled` só existe desde 2026-08-07 — todo o histórico anterior não tem
 * esse evento. Por isso o engasgo também é **inferido**: `playing` repetido em
 * segundos é retomada depois de travar, e `opened` repetido em minutos é o
 * cliente desistindo e tentando de novo. Sem a inferência, os casos que
 * motivaram esta correção continuariam aparecendo como verdes.
 */
export function summarize(events: ViewerEvent[]): Map<number, ItemViewerSummary> {
  const out = new Map<number, ItemViewerSummary>()
  // Ordem cronológica: a inferência compara com o evento anterior do MESMO item.
  const ordered = [...events].sort((a, b) => a.ts - b.ts)
  const prevPlaying = new Map<number, number>()
  const prevOpened  = new Map<number, number>()

  const struggle = (s: ItemViewerSummary, ts: number) => {
    s.struggles += 1
    if (!s.lastStruggleAt || ts > s.lastStruggleAt) s.lastStruggleAt = ts
  }

  for (const e of ordered) {
    const s = out.get(e.itemId) ?? { opens: 0, played: false, struggles: 0 }

    if (e.event === 'opened') {
      s.opens += 1
      if (!s.lastOpenedAt || e.ts > s.lastOpenedAt) s.lastOpenedAt = e.ts
      const before = prevOpened.get(e.itemId)
      if (before !== undefined && e.ts - before < RETRY_MS) struggle(s, e.ts)
      prevOpened.set(e.itemId, e.ts)
    }

    if (e.event === 'playing') {
      s.played = true
      const before = prevPlaying.get(e.itemId)
      if (before !== undefined && e.ts - before < REBUFFER_MS) struggle(s, e.ts)
      prevPlaying.set(e.itemId, e.ts)
    }

    // O evento explícito vale mais que qualquer inferência.
    if (e.event === 'stalled') struggle(s, e.ts)

    if (e.event === 'error' || e.event === 'fallback') {
      if (!s.lastFailureAt || e.ts > s.lastFailureAt) {
        s.lastFailureAt = e.ts
        s.lastFailureDetail = e.detail
        s.lastFailurePlatform = e.platform
      }
    }

    out.set(e.itemId, s)
  }
  return out
}

export type ReachKind =
  /** O cliente tentou e não conseguiu — o estado mais urgente. */
  | 'failed'
  /**
   * Abriu e o vídeo travou. Tecnicamente não falhou; na prática ele não
   * assistiu — e era exatamente isto que o painel pintava de verde.
   */
  | 'struggled'
  /** Abriu o link. `played` diz se o vídeo chegou a rodar. */
  | 'opened'
  /** Há registro de outros criativos, nenhum deste: afirmação com base. */
  | 'not_opened'
  /** Não dá para afirmar nada — a faixa se cala. */
  | 'unknown'

export interface Reach {
  kind: ReachKind
  at?: number
  opens?: number
  played?: boolean
  struggles?: number
  detail?: string
  platform?: string
}

/**
 * Falha vence abertura porque é o que exige ação: se o cliente abriu e o vídeo
 * morreu, dizer "cliente abriu" seria tecnicamente verdade e praticamente uma
 * mentira. A janela de 1 min existe porque `opened` e `error` da mesma sessão
 * chegam quase juntos, e o `error` costuma vir depois — comparar só por
 * "mais recente" faria a falha ganhar sempre, inclusive quando o cliente voltou
 * depois e conseguiu ver.
 */
const SAME_SESSION_MS = 60_000

export function reachState(summary: ItemViewerSummary | undefined, sentAt?: number): Reach {
  if (!sentAt || !summary) return { kind: 'unknown' }

  if (summary.lastFailureAt) {
    const reopenedAfter = summary.lastOpenedAt !== undefined
      && summary.lastOpenedAt - summary.lastFailureAt > SAME_SESSION_MS
    if (!reopenedAfter) {
      return {
        kind: 'failed',
        at: summary.lastFailureAt,
        detail: summary.lastFailureDetail,
        platform: summary.lastFailurePlatform,
      }
    }
  }

  // Engasgo perde para falha, mas ganha de "abriu": o cliente não assistiu.
  // Mesma regra de convivência da falha — se ele voltou depois, numa sessão
  // nova, e não travou mais, o card não fica preso no amarelo para sempre.
  if (summary.lastStruggleAt) {
    const smoothLater = summary.lastOpenedAt !== undefined
      && summary.lastOpenedAt - summary.lastStruggleAt > SAME_SESSION_MS
    if (!smoothLater) {
      return {
        kind: 'struggled',
        at: summary.lastStruggleAt,
        opens: summary.opens,
        struggles: summary.struggles,
        played: summary.played,
      }
    }
  }

  if (summary.lastOpenedAt) {
    return { kind: 'opened', at: summary.lastOpenedAt, opens: summary.opens, played: summary.played }
  }

  return { kind: 'not_opened', at: sentAt }
}

export function refreshViewerEvents(): Promise<void> {
  // Intervalo, foco e clique manual coincidem com frequência: uma busca só.
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const res = await fetch('/api/viewer-log')
      if (!res.ok) throw new Error(`viewer-log ${res.status}`)
      const data = await res.json() as { ok: boolean; events?: ViewerEvent[] }
      const events = Array.isArray(data.events) ? data.events : []

      // Nada mudou desde a última leitura: não mexer no snapshot evita
      // re-renderizar todo card aberto a cada 5 minutos por nada.
      const signature = `${events.length}:${events[events.length - 1]?.ts ?? 0}`
      if (signature === lastSignature && !snapshot.loading && !snapshot.error) return

      lastSignature = signature
      snapshot = { events, byItem: summarize(events), loading: false, error: null }
      emit()
    } catch (e) {
      // Não conseguir LER não é o mesmo que "não houve evento": zerar o
      // snapshot aqui faria o card afirmar "cliente não abriu" sem base.
      snapshot = { ...snapshot, loading: false, error: e instanceof Error ? e.message : 'falha ao ler' }
      emit()
    } finally {
      lastFetchAt = Date.now()
      inFlight = null
    }
  })()

  return inFlight
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  refCount += 1

  if (refCount === 1) {
    pollTimer = setInterval(() => { void refreshViewerEvents() }, POLL_MS)
  }
  if (Date.now() - lastFetchAt > STALE_MS) void refreshViewerEvents()

  return () => {
    listeners.delete(fn)
    refCount -= 1
    if (refCount === 0 && pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }
}

const getSnapshot = () => snapshot

/** Tudo que se sabe — para a aba Entregas. */
export function useViewerEvents(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * Só o resumo de UM card. Devolve `undefined` quando não há registro para ele —
 * que é diferente de "não abriu": o registro guarda 300 eventos por 30 dias, e
 * criativo antigo simplesmente sai da janela.
 */
export function useItemViewerSummary(itemId: number): ItemViewerSummary | undefined {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return snap.byItem.get(itemId)
}

/** Só para teste — o estado é de módulo e vaza entre casos. */
export function __resetViewerEvents(): void {
  snapshot = EMPTY
  lastSignature = ''
  lastFetchAt = 0
  inFlight = null
  listeners.clear()
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  refCount = 0
}
