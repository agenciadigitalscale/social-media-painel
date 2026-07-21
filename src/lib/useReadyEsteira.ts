import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { ContentItem, ItemState, Status } from '../types'
import {
  runReadyAutomation, getReadyState, patchReadyState, isLocked, isStalePhase,
  validateMediaPreview, PHASE_MESSAGE,
  type DriveFilesResponse, type ReadyAutomationMap,
} from './readyAutomation'
import { useReadyAutomation } from './useReadyAutomation'
import { driveViewUrlFor, type DriveFile } from './videoMatch'
import { upsertMediaLink } from './mediaLinks'
import { markFileLinked } from './driveInbox'

/**
 * Motor da coluna "Pronto", compartilhado entre o board do desktop e o do
 * celular. Ficava dentro do `ProducaoTab`, o que deixava o mobile com a coluna
 * mas sem busca nenhuma: o card entrava lá e não acontecia nada, para sempre.
 *
 * A UI (dialog de seleção, modal de revisão, bottom sheet) fica de fora — cada
 * plataforma desenha a sua e recebe os ganchos por aqui.
 */

const READY_SWEEP_MS = 90_000
/** Janela menor que a varredura: nunca serve dado velho para uma busca nova. */
const FILES_CACHE_MS = 20_000

export interface ReadyEsteiraOptions {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, s: Status) => void
  onUpdateState?: (id: number, patch: Partial<ItemState>) => void
  onAppendHistory?: (id: number, action: string) => void
  onReviewNotify?: (itemId: number, clientName: string, reservedTab?: Window | null) => Promise<boolean>
  /** Chamado quando há um arquivo pronto para ser revisado na tela. */
  onOpenReview?: (info: { itemId: number; fileId: string; filename?: string }) => void
  /** O celular não roda a varredura de fundo do desktop quando ambos estão abertos. */
  enableSweep?: boolean
}

export interface ReadyEsteira {
  readyStates: ReadyAutomationMap
  fetchPublishFiles: (clientName: string) => Promise<DriveFilesResponse>
  handleReadyDrop: (itemId: number) => void
  handleRetryReady: (itemId: number) => void
  handleSendReadyToReview: (itemId: number) => void
  listCandidates: (itemId: number) => Promise<{ files: DriveFile[]; error?: string }>
  linkFileManually: (itemId: number, file: DriveFile) => Promise<void>
}

async function patchVideo(
  fileId: string,
  updates: { status?: string; linked_item_id?: number | null },
  identity?: { client_name: string; filename: string },
) {
  const res = await fetch('/api/drive-videos', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drive_file_id: fileId, ...updates, ...identity }),
  })
  if (!res.ok) throw new Error(`drive-videos PATCH ${res.status}`)
}

export function useReadyEsteira({
  items, states, onStatusChange, onUpdateState, onAppendHistory,
  onReviewNotify, onOpenReview, enableSweep = true,
}: ReadyEsteiraOptions): ReadyEsteira {
  const readyStates = useReadyAutomation()

  const filesCache = useRef(new Map<string, { at: number; res: DriveFilesResponse }>())
  const fetchPublishFiles = useCallback(async (clientName: string): Promise<DriveFilesResponse> => {
    const hit = filesCache.current.get(clientName)
    if (hit && Date.now() - hit.at < FILES_CACHE_MS) return hit.res
    try {
      const res = await fetch(`/api/drive-files?client=${encodeURIComponent(clientName)}`)
      const data = await res.json() as DriveFilesResponse
      if (!res.ok) return { ok: false, error: data.error ?? `HTTP ${res.status}` }
      filesCache.current.set(clientName, { at: Date.now(), res: data })
      return data
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }, [])

  const audit = useCallback((itemId: number, action: string) => {
    onAppendHistory?.(itemId, action)
  }, [onAppendHistory])

  /** Grava o vínculo em todos os lugares que precisam saber dele. */
  const linkFile = useCallback((item: ContentItem, file: DriveFile, extra: {
    folderId?: string
    matchedBy: 'card_id' | 'exact_normalized_title' | 'manual'
    matchConfidence: number
  }) => {
    const url = driveViewUrlFor(file.id)
    upsertMediaLink({
      itemId: item.i, clientId: item.c, url,
      fileId: `drive:${file.id}`,
      folderStage: 'publicar', source: 'drive', confirmed: true,
      filename: file.name, folderId: extra.folderId, mimeType: file.mimeType,
      matchedBy: extra.matchedBy, matchConfidence: extra.matchConfidence,
    })
    onUpdateState?.(item.i, { link: url, footageLink: url })
    markFileLinked(file.id)
    // Registra no D1 para o arquivo não reaparecer como novidade na Inbox.
    void patchVideo(file.id, { status: 'linked', linked_item_id: item.i }, { client_name: item.c, filename: file.name })
      .catch(e => console.error('[esteira] não consegui marcar o vídeo como vinculado', e))
  }, [onUpdateState])

  /**
   * Ponto único da automação. `reservedTab` só existe quando veio de um gesto —
   * é a aba em branco aberta ali, para o WhatsApp não cair no bloqueador.
   */
  const startReadyAutomation = useCallback(async (
    itemId: number,
    reservedTab?: Window | null,
    mode: 'interactive' | 'background' = 'interactive',
  ) => {
    const item = items.find(i => i.i === itemId)
    if (!item) { try { reservedTab?.close() } catch { /* nada a fechar */ } return }
    const state = states[itemId]

    const result = await runReadyAutomation({
      item: { i: item.i, c: item.c, tp: item.tp, n: item.n },
      title: state?.title || item.n,
      mode,
      alreadyCompleted: !!state?.reviewAutomationCompletedAt,
      whatsappAlreadyOpened: !!state?.whatsappOpenedAt,
      fetchFiles: fetchPublishFiles,
      onLinkFile: ({ file, folderId, matchedBy, matchConfidence }) =>
        linkFile(item, file, { folderId, matchedBy, matchConfidence }),
      onMoveToReview: () => {
        onStatusChange(itemId, 2)
        onUpdateState?.(itemId, { reviewAutomationCompletedAt: Date.now() })
      },
      onAudit: action => audit(itemId, action),
      onOpenReviewModal: file => onOpenReview?.({ itemId, fileId: file.id, filename: file.name }),
      onNotify: async () => {
        const opened = await (onReviewNotify?.(itemId, item.c, reservedTab) ?? Promise.resolve(false))
        if (opened) onUpdateState?.(itemId, { whatsappOpenedAt: Date.now() })
        return opened
      },
    })

    // Falhou (ou nem chegou a notificar): a aba em branco não pode ficar órfã.
    if (result?.phase !== 'done' || !onReviewNotify) {
      try { if (reservedTab && !reservedTab.closed) reservedTab.close() } catch { /* já fechada */ }
    }
    return result
  }, [items, states, fetchPublishFiles, linkFile, onUpdateState, onStatusChange, onReviewNotify, onOpenReview, audit])

  const handleReadyDrop = useCallback((itemId: number) => {
    if (isLocked(itemId)) return
    const state = states[itemId]
    // Aba reservada aqui, síncrona, dentro do gesto — depois do await o
    // navegador já não considera mais isso "ação do usuário" e bloqueia.
    const reservedTab = state?.reviewAutomationCompletedAt || state?.whatsappOpenedAt
      ? null
      : window.open('', '_blank')
    if (reservedTab) {
      try {
        reservedTab.document.write(
          '<title>DS HUB</title><body style="margin:0;background:#050912;color:#94A3B8;font:600 14px/1.6 system-ui;display:flex;align-items:center;justify-content:center;height:100vh">Preparando a revisão…</body>'
        )
        reservedTab.document.close()
      } catch { /* aba sem permissão de escrita — segue em branco */ }
    }
    void startReadyAutomation(itemId, reservedTab)
  }, [states, startReadyAutomation])

  const handleRetryReady = useCallback((itemId: number) => {
    if (isLocked(itemId)) return
    void startReadyAutomation(itemId, null)
  }, [startReadyAutomation])

  /**
   * Card esperando em Pronto: revarre a pasta sozinho, porque o editor exporta
   * depois de arrastar e ninguém deveria ficar clicando "Tentar novamente".
   */
  const waitingIds = useMemo(() => items
    .filter(i => (states[i.i]?.status ?? i.s) === 8)
    .filter(i => {
      const phase = readyStates[i.i]?.phase
      if (phase === undefined || phase === 'idle' || phase === 'not_found' || phase === 'error' || phase === 'invalid') return true
      // Busca/validação interrompida por reload: a revarredura retoma.
      return isStalePhase(readyStates[i.i])
    })
    .map(i => i.i)
    .join(','),
    [items, states, readyStates])

  useEffect(() => {
    if (!enableSweep || !waitingIds) return
    const ids = waitingIds.split(',').map(Number)

    // Roda mesmo com a aba em segundo plano: o fluxo real é sair para o Drive,
    // exportar e voltar — se a varredura parasse aí, ela pararia justamente
    // quando é útil. Voltar para a aba dispara uma imediata.
    const sweep = async () => {
      // Sequencial: um cliente por vez, para não disparar 17 listagens de uma vez.
      for (const id of ids) {
        if (isLocked(id)) continue
        await startReadyAutomation(id, null, 'background')
      }
    }

    const timer = setInterval(sweep, READY_SWEEP_MS)
    const onVisible = () => { if (!document.hidden) void sweep() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enableSweep, waitingIds, startReadyAutomation])

  /** Envia para revisão o card que a revarredura já vinculou e validou. */
  const handleSendReadyToReview = useCallback((itemId: number) => {
    const item = items.find(i => i.i === itemId)
    if (!item) return
    const ready = getReadyState(itemId)
    // Aba reservada no clique — é o gesto que o navegador exige.
    const reservedTab = states[itemId]?.whatsappOpenedAt ? null : window.open('', '_blank')

    onStatusChange(itemId, 2)
    onUpdateState?.(itemId, { reviewAutomationCompletedAt: Date.now() })
    audit(itemId, 'Enviado para revisão interna a partir da coluna Pronto')
    patchReadyState(itemId, { phase: 'done', message: PHASE_MESSAGE.done })
    if (ready?.fileId) onOpenReview?.({ itemId, fileId: ready.fileId, filename: ready.filename })

    if (onReviewNotify) {
      void onReviewNotify(itemId, item.c, reservedTab).then(opened => {
        if (opened) onUpdateState?.(itemId, { whatsappOpenedAt: Date.now() })
      })
    } else {
      try { reservedTab?.close() } catch { /* já fechada */ }
    }
  }, [items, states, onStatusChange, onUpdateState, onReviewNotify, onOpenReview, audit])

  /** Candidatos para escolha manual: os da ambiguidade, ou a pasta inteira. */
  const listCandidates = useCallback(async (itemId: number) => {
    const item = items.find(i => i.i === itemId)
    if (!item) return { files: [], error: 'Conteúdo não encontrado' }

    const ready = getReadyState(itemId)
    if (ready?.candidates?.length) {
      return { files: ready.candidates.map(c => ({ id: c.id, name: c.name, mimeType: c.mimeType })) }
    }
    const res = await fetchPublishFiles(item.c)
    if (!res.ok || !res.files) {
      return { files: [], error: res.error ?? 'Não foi possível ler a pasta Publicar' }
    }
    return { files: res.files }
  }, [items, fetchPublishFiles])

  /** Escolha humana: vincula, valida e segue a mesma esteira do automático. */
  const linkFileManually = useCallback(async (itemId: number, file: DriveFile) => {
    const item = items.find(i => i.i === itemId)
    if (!item) return
    patchReadyState(itemId, {
      phase: 'found', message: PHASE_MESSAGE.found,
      fileId: file.id, filename: file.name, matchedBy: 'manual',
    })

    const validation = await validateMediaPreview(file.id, file.mimeType)
    if (!validation.ok) {
      patchReadyState(itemId, { phase: 'invalid', message: PHASE_MESSAGE.invalid, error: validation.reason })
      audit(itemId, `Prévia não validou (seleção manual): ${validation.reason ?? 'erro'}`)
      return
    }

    linkFile(item, file, { matchedBy: 'manual', matchConfidence: 1 })
    audit(itemId, `Arquivo vinculado manualmente: ${file.name}`)

    onStatusChange(itemId, 2)
    onUpdateState?.(itemId, { reviewAutomationCompletedAt: Date.now() })
    audit(itemId, 'Movido para Revisão interna após seleção manual')
    patchReadyState(itemId, { phase: 'done', message: PHASE_MESSAGE.done, candidates: undefined })
    onOpenReview?.({ itemId, fileId: file.id, filename: file.name })
  }, [items, linkFile, onStatusChange, onUpdateState, onOpenReview, audit])

  return {
    readyStates,
    fetchPublishFiles,
    handleReadyDrop,
    handleRetryReady,
    handleSendReadyToReview,
    listCandidates,
    linkFileManually,
  }
}
