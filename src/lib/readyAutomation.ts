import { syncToCloud } from './storage'
import {
  matchCardToFile, streamUrlFor, acceptForContentType,
  type DriveFile, type MatchedBy,
} from './videoMatch'

/**
 * Automação da coluna "Pronto".
 *
 * Arrastar um card para Pronto declara: *o vídeo está exportado na pasta
 * Publicar*. A partir daí o sistema procura, valida e — só se tudo bater —
 * empurra o card para Revisão interna e avisa no WhatsApp.
 *
 * Tudo que decide vive aqui, fora do componente da coluna, porque este fluxo tem
 * três armadilhas que UI não resolve: repetição (polling, re-render, arraste
 * duplo), ordem (WhatsApp só depois da validação) e idempotência (o card volta
 * pra tela mil vezes e não pode reabrir aba nenhuma).
 */

export type ReadyPhase =
  | 'idle'          // em Pronto, ainda sem busca registrada
  | 'searching'     // procurando na pasta Publicar
  | 'found'         // arquivo encontrado, validando prévia
  | 'awaiting_send' // achado e validado pela revarredura — espera um clique
  | 'not_found'     // nada compatível na pasta
  | 'ambiguous'     // mais de um compatível — humano decide
  | 'invalid'       // achou, mas o arquivo não abre
  | 'error'         // falha de rede/permissão
  | 'done'          // vinculado, validado e movido para Revisão

export interface ReadyCandidate {
  id: string
  name: string
  mimeType: string
}

export interface ReadyAutomationState {
  itemId: number
  phase: ReadyPhase
  message: string
  candidates?: ReadyCandidate[]
  fileId?: string
  filename?: string
  matchedBy?: MatchedBy
  startedAt: number
  updatedAt: number
  /** Lock persistido: sobrevive a F5 no meio do processo. */
  lockedAt?: number
  error?: string
}

export type ReadyAutomationMap = Record<number, ReadyAutomationState>

export const READY_AUTOMATION_KEY = 'sm_ready_automation'
/** Depois disso o lock é considerado órfão (aba fechada no meio, crash). */
export const LOCK_TTL_MS = 90_000
const VALIDATION_TIMEOUT_MS = 20_000

export const PHASE_MESSAGE: Record<ReadyPhase, string> = {
  idle:          'Pronto para buscar na pasta Publicar',
  searching:     'Procurando arquivo na pasta Publicar…',
  found:         'Arquivo encontrado. Validando prévia…',
  awaiting_send: 'Arquivo encontrado — enviar para revisão',
  not_found:     'Arquivo não encontrado na pasta Publicar',
  ambiguous:     'Encontramos mais de um arquivo compatível',
  invalid:       'O arquivo foi encontrado, mas não pôde ser aberto',
  error:         'Não foi possível consultar a pasta Publicar',
  done:          'Enviado para revisão interna',
}

// ── Store ─────────────────────────────────────────────────────────────────────

let _map: ReadyAutomationMap = {}
let _loaded = false
const _listeners = new Set<() => void>()

function readStorage(): ReadyAutomationMap {
  try {
    const raw = localStorage.getItem(READY_AUTOMATION_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ReadyAutomationMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Card que já foi para a revisão semanas atrás não precisa carregar o rastro. */
const DONE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function prune(map: ReadyAutomationMap, now = Date.now()): ReadyAutomationMap {
  const stale = Object.values(map).filter(s => s.phase === 'done' && now - s.updatedAt > DONE_TTL_MS)
  if (stale.length === 0) return map
  const next = { ...map }
  stale.forEach(s => { delete next[s.itemId] })
  return next
}

function commit(raw: ReadyAutomationMap): void {
  const next = prune(raw)
  if (next === _map) return
  _map = next
  try {
    localStorage.setItem(READY_AUTOMATION_KEY, JSON.stringify(next))
  } catch (e) {
    console.error('[readyAutomation] falha ao gravar no localStorage', e)
  }
  syncToCloud(READY_AUTOMATION_KEY, next)
  _listeners.forEach(fn => fn())
}

export function getReadyStates(): ReadyAutomationMap {
  if (!_loaded) {
    _map = readStorage()
    _loaded = true
  }
  return _map
}

export function subscribeReadyStates(fn: () => void): () => void {
  _listeners.add(fn)
  return () => { _listeners.delete(fn) }
}

export function reloadReadyStates(): void {
  _loaded = true
  _map = readStorage()
  _listeners.forEach(fn => fn())
}

export function getReadyState(itemId: number): ReadyAutomationState | undefined {
  return getReadyStates()[itemId]
}

export function patchReadyState(itemId: number, patch: Partial<ReadyAutomationState>): void {
  const now = Date.now()
  const current = getReadyStates()[itemId]
  const base: ReadyAutomationState = current ?? {
    itemId,
    phase: 'searching',
    message: PHASE_MESSAGE.searching,
    startedAt: now,
    updatedAt: now,
  }
  const next: ReadyAutomationState = { ...base, ...patch, itemId, updatedAt: now }
  commit({ ...getReadyStates(), [itemId]: next })
}

export function clearReadyState(itemId: number): void {
  const map = getReadyStates()
  if (!map[itemId]) return
  const next = { ...map }
  delete next[itemId]
  commit(next)
}

// ── Lock ──────────────────────────────────────────────────────────────────────

/** Locks desta aba. O persistido cobre outras abas e o F5; este cobre o React. */
const inFlight = new Set<number>()

export function isLocked(itemId: number, now = Date.now()): boolean {
  if (inFlight.has(itemId)) return true
  const lockedAt = getReadyStates()[itemId]?.lockedAt
  return !!lockedAt && now - lockedAt < LOCK_TTL_MS
}

function acquireLock(itemId: number): boolean {
  if (isLocked(itemId)) return false
  inFlight.add(itemId)
  patchReadyState(itemId, { lockedAt: Date.now() })
  return true
}

function releaseLock(itemId: number): void {
  inFlight.delete(itemId)
  const current = getReadyStates()[itemId]
  if (current?.lockedAt) patchReadyState(itemId, { lockedAt: undefined })
}

// ── Validação da prévia ───────────────────────────────────────────────────────

export interface PreviewValidation {
  ok: boolean
  durationSec?: number
  reason?: string
}

/**
 * Carrega só os metadados do vídeo pela URL de streaming do projeto (que
 * responde a Range). Prova três coisas de uma vez: a URL foi gerada certo, o
 * arquivo ainda está lá e o navegador consegue abrir o vídeo.
 *
 * Sem object URL — a fonte é uma URL persistente do servidor, então não há nada
 * para revogar. O elemento é descartado no fim, com ou sem sucesso.
 */
export function validateVideoPreview(driveFileId: string, timeoutMs = VALIDATION_TIMEOUT_MS): Promise<PreviewValidation> {
  return new Promise(resolve => {
    if (typeof document === 'undefined') {
      resolve({ ok: false, reason: 'sem DOM' })
      return
    }

    const video = document.createElement('video')
    let settled = false

    const cleanup = () => {
      video.onloadedmetadata = null
      video.onerror = null
      clearTimeout(timer)
      try {
        video.removeAttribute('src')
        video.load()
      } catch { /* elemento já descartado */ }
    }

    const finish = (result: PreviewValidation) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }

    const timer = setTimeout(() => finish({ ok: false, reason: 'tempo esgotado ao carregar metadados' }), timeoutMs)

    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.onloadedmetadata = () => {
      const d = video.duration
      if (!Number.isFinite(d) || d <= 0) {
        finish({ ok: false, reason: 'duração inválida' })
        return
      }
      finish({ ok: true, durationSec: d })
    }
    video.onerror = () => finish({ ok: false, reason: 'o navegador não conseguiu abrir o arquivo' })
    video.src = streamUrlFor(driveFileId)
  })
}

/**
 * Criativo estático (Post, Carrossel, Feed). Imagem não tem metadados de
 * duração, então a prova é o próprio decode: carregou com largura > 0, existe e
 * abre. Mesma URL de streaming do vídeo — nada de caminho local.
 */
export function validateImagePreview(driveFileId: string, timeoutMs = VALIDATION_TIMEOUT_MS): Promise<PreviewValidation> {
  return new Promise(resolve => {
    if (typeof Image === 'undefined') {
      resolve({ ok: false, reason: 'sem DOM' })
      return
    }

    const img = new Image()
    let settled = false

    const finish = (result: PreviewValidation) => {
      if (settled) return
      settled = true
      img.onload = null
      img.onerror = null
      clearTimeout(timer)
      img.src = ''
      resolve(result)
    }

    const timer = setTimeout(() => finish({ ok: false, reason: 'tempo esgotado ao carregar a imagem' }), timeoutMs)

    img.onload = () => finish(img.naturalWidth > 0
      ? { ok: true }
      : { ok: false, reason: 'imagem vazia' })
    img.onerror = () => finish({ ok: false, reason: 'o navegador não conseguiu abrir o arquivo' })
    img.src = streamUrlFor(driveFileId)
  })
}

/** Escolhe a prova certa pelo mime do arquivo encontrado. */
export function validateMediaPreview(driveFileId: string, mimeType?: string): Promise<PreviewValidation> {
  return mimeType?.startsWith('image/')
    ? validateImagePreview(driveFileId)
    : validateVideoPreview(driveFileId)
}

// ── Orquestração ──────────────────────────────────────────────────────────────

export interface DriveFilesResponse {
  ok: boolean
  reason?: string
  folderId?: string | null
  files?: DriveFile[]
  error?: string
}

export interface ReadyAutomationDeps {
  item: { i: number; c: string; tp: string; n: string }
  title: string
  /**
   * `interactive` (arraste, "Tentar novamente"): vai até o fim — move o card e
   * avisa no WhatsApp.
   * `background` (revarredura enquanto o card espera em Pronto): acha, valida e
   * PARA em `awaiting_send`. Não move nem notifica sem um clique — em parte
   * porque o navegador só abre aba dentro de um gesto, e em parte porque card
   * que anda sozinho sem ninguém receber o link vira revisão que não acontece.
   */
  mode?: 'interactive' | 'background'
  /**
   * Já concluída antes (vem do ItemState, sobrevive a reload e a outros
   * aparelhos). Não impede rodar de novo — arrastar outra vez é um pedido
   * explícito, e repetir a busca é inofensivo: o vínculo é upsert e o status já
   * é o mesmo. O que ela impede é o efeito irreversível: reabrir o WhatsApp.
   */
  alreadyCompleted: boolean
  whatsappAlreadyOpened: boolean
  fetchFiles: (clientName: string) => Promise<DriveFilesResponse>
  validatePreview?: (fileId: string, mimeType?: string) => Promise<PreviewValidation>
  onLinkFile: (info: { file: DriveFile; folderId: string; matchedBy: MatchedBy; matchConfidence: number }) => void
  onMoveToReview: () => void
  onAudit: (action: string) => void
  /** Retorna true se a notificação foi realmente aberta. */
  onNotify?: () => Promise<boolean> | boolean
  onOpenReviewModal?: (file: DriveFile) => void
}

export interface ReadyAutomationResult {
  phase: ReadyPhase
  skipped?: 'locked' | 'already_done'
  fileId?: string
}

/**
 * Roda a esteira para um card. No modo interativo vem do arraste ou do botão;
 * no modo de fundo, da revarredura da pasta enquanto o card espera em Pronto.
 */
export async function runReadyAutomation(deps: ReadyAutomationDeps): Promise<ReadyAutomationResult> {
  const { item, title } = deps
  const itemId = item.i

  if (!acquireLock(itemId)) {
    return { phase: getReadyState(itemId)?.phase ?? 'searching', skipped: 'locked' }
  }

  try {
    patchReadyState(itemId, {
      phase: 'searching', message: PHASE_MESSAGE.searching,
      startedAt: Date.now(), candidates: undefined, fileId: undefined,
      filename: undefined, matchedBy: undefined, error: undefined,
    })
    deps.onAudit('Busca iniciada na pasta Publicar')

    const res = await deps.fetchFiles(item.c)

    if (!res.ok) {
      patchReadyState(itemId, { phase: 'error', message: PHASE_MESSAGE.error, error: res.error })
      deps.onAudit(`Erro na busca: ${res.error ?? 'desconhecido'}`)
      return { phase: 'error' }
    }
    if (res.reason === 'no_folder' || !res.folderId) {
      patchReadyState(itemId, {
        phase: 'error',
        message: 'Pasta Publicar não configurada para este cliente',
        error: 'no_folder',
      })
      deps.onAudit('Pasta Publicar não configurada para o cliente')
      return { phase: 'error' }
    }

    const match = matchCardToFile({
      cardId: itemId, title: title || item.n, files: res.files ?? [],
      accept: acceptForContentType(item.tp),
    })

    if (match.outcome === 'not_found') {
      patchReadyState(itemId, { phase: 'not_found', message: PHASE_MESSAGE.not_found })
      deps.onAudit('Arquivo não encontrado na pasta Publicar')
      return { phase: 'not_found' }
    }

    if (match.outcome === 'ambiguous') {
      patchReadyState(itemId, {
        phase: 'ambiguous',
        message: PHASE_MESSAGE.ambiguous,
        candidates: match.candidates.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType })),
      })
      deps.onAudit(`Vários arquivos compatíveis (${match.candidates.length}) — seleção manual necessária`)
      return { phase: 'ambiguous' }
    }

    const file = match.file!
    patchReadyState(itemId, {
      phase: 'found', message: PHASE_MESSAGE.found,
      fileId: file.id, filename: file.name, matchedBy: match.matchedBy,
    })
    deps.onAudit(`Arquivo encontrado por ${match.matchedBy === 'card_id' ? 'ID do card' : 'título normalizado'}: ${file.name}`)

    const validate = deps.validatePreview ?? validateMediaPreview
    const validation = await validate(file.id, file.mimeType)
    if (!validation.ok) {
      patchReadyState(itemId, {
        phase: 'invalid', message: PHASE_MESSAGE.invalid,
        fileId: file.id, filename: file.name, error: validation.reason,
      })
      deps.onAudit(`Prévia não validou: ${validation.reason ?? 'erro desconhecido'}`)
      return { phase: 'invalid', fileId: file.id }
    }

    deps.onLinkFile({
      file,
      folderId: res.folderId,
      matchedBy: match.matchedBy!,
      matchConfidence: match.matchConfidence ?? 1,
    })
    deps.onAudit('Arquivo vinculado e prévia validada')

    // Revarredura: para aqui. O card só sai de Pronto por um clique — abrir o
    // WhatsApp exige gesto do usuário, e mover sem avisar ninguém criaria uma
    // revisão que nunca acontece.
    if (deps.mode === 'background') {
      patchReadyState(itemId, {
        phase: 'awaiting_send', message: PHASE_MESSAGE.awaiting_send,
        fileId: file.id, filename: file.name, matchedBy: match.matchedBy,
        candidates: undefined,
      })
      return { phase: 'awaiting_send', fileId: file.id }
    }

    deps.onMoveToReview()
    deps.onAudit('Movido automaticamente para Revisão interna')

    patchReadyState(itemId, {
      phase: 'done', message: PHASE_MESSAGE.done,
      fileId: file.id, filename: file.name, matchedBy: match.matchedBy,
      candidates: undefined,
    })

    deps.onOpenReviewModal?.(file)

    const notifyBlocked = deps.whatsappAlreadyOpened || deps.alreadyCompleted
    if (!notifyBlocked && deps.onNotify) {
      const opened = await deps.onNotify()
      deps.onAudit(opened ? 'WhatsApp aberto para a revisão' : 'WhatsApp não aberto (sem contato configurado)')
    }

    return { phase: 'done', fileId: file.id, skipped: notifyBlocked ? 'already_done' : undefined }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    patchReadyState(itemId, { phase: 'error', message: PHASE_MESSAGE.error, error: msg })
    deps.onAudit(`Erro na automação: ${msg}`)
    console.error('[readyAutomation] falhou', e)
    return { phase: 'error' }
  } finally {
    releaseLock(itemId)
  }
}
