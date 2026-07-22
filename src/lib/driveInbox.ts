import { syncToCloud } from './storage'

/**
 * Estado por arquivo da Inbox do Drive.
 *
 * Existe porque a Inbox abria o dialog "Vincular vídeo a um item" sozinha: o
 * `checkAutoLink` chamava `setLinkVideo` sempre que não sabia de qual card era o
 * arquivo, e isso rodava a cada fetch — montagem, polling de 60s, troca de
 * filtro e toda mudança de `states`. O usuário fechava, o próximo tick reabria.
 *
 * Agora nada abre sozinho. O que o arquivo já provocou fica gravado aqui, então
 * um arquivo alerta uma vez só — e continua assim depois do F5.
 */

export interface InboxFileState {
  seenAt?: number
  dismissedAt?: number
  ignoredAt?: number
  linkedAt?: number
  /** "Lembrar depois": volta a contar como pendente a partir deste instante. */
  remindAt?: number
}

export type InboxStateMap = Record<string, InboxFileState>

export const DRIVE_INBOX_KEY = 'sm_drive_inbox_state'

export const REMIND_LATER_MS = 4 * 60 * 60 * 1000

// ── Regras puras ──────────────────────────────────────────────────────────────

/** Arquivo que ainda espera uma decisão do usuário. */
export function isPending(fileState: InboxFileState | undefined, now = Date.now()): boolean {
  if (!fileState) return true
  if (fileState.ignoredAt) return false
  if (fileState.linkedAt) return false
  if (fileState.remindAt && fileState.remindAt > now) return false
  return true
}

/** Toast só para arquivo nunca visto. Depois disso ele vive no contador. */
export function needsToast(fileState: InboxFileState | undefined): boolean {
  return !fileState?.seenAt && !fileState?.ignoredAt && !fileState?.linkedAt
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|heic|heif|avif|tiff?)$/i

/**
 * Criativo estático ou vídeo. Linha gravada antes de a varredura aceitar imagem
 * não tem mime — aí a extensão é o que sobra, e errar aqui só troca um ícone.
 */
export function isImageFile(file: { mime_type?: string | null; filename: string }): boolean {
  if (file.mime_type) return file.mime_type.startsWith('image/')
  return IMAGE_EXT.test(file.filename)
}

export function countPending(fileIds: string[], map: InboxStateMap, now = Date.now()): number {
  return fileIds.filter(id => isPending(map[id], now)).length
}

export function applyPatch(map: InboxStateMap, fileId: string, patch: InboxFileState): InboxStateMap {
  const current = map[fileId] ?? {}
  const next = { ...current, ...patch }
  let unchanged = true
  for (const key of Object.keys(patch) as (keyof InboxFileState)[]) {
    if (current[key] !== next[key]) { unchanged = false; break }
  }
  if (unchanged) return map
  return { ...map, [fileId]: next }
}

export function applyMarkSeen(map: InboxStateMap, fileIds: string[], now = Date.now()): InboxStateMap {
  let next = map
  for (const id of fileIds) {
    if (next[id]?.seenAt) continue
    next = applyPatch(next, id, { seenAt: now })
  }
  return next
}

// ── Store (localStorage + sync + assinantes) ──────────────────────────────────

let _map: InboxStateMap = {}
let _loaded = false
const _listeners = new Set<() => void>()

function readStorage(): InboxStateMap {
  try {
    const raw = localStorage.getItem(DRIVE_INBOX_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as InboxStateMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function commit(next: InboxStateMap): void {
  if (next === _map) return
  _map = next
  try {
    localStorage.setItem(DRIVE_INBOX_KEY, JSON.stringify(next))
  } catch (e) {
    console.error('[driveInbox] falha ao gravar no localStorage', e)
  }
  syncToCloud(DRIVE_INBOX_KEY, next)
  _listeners.forEach(fn => fn())
}

export function getInboxState(): InboxStateMap {
  if (!_loaded) {
    _map = readStorage()
    _loaded = true
  }
  return _map
}

export function subscribeInboxState(fn: () => void): () => void {
  _listeners.add(fn)
  return () => { _listeners.delete(fn) }
}

export function patchInboxFile(fileId: string, patch: InboxFileState): void {
  commit(applyPatch(getInboxState(), fileId, patch))
}

export function markFilesSeen(fileIds: string[]): void {
  commit(applyMarkSeen(getInboxState(), fileIds))
}

export function markFileIgnored(fileId: string): void {
  patchInboxFile(fileId, { ignoredAt: Date.now(), seenAt: getInboxState()[fileId]?.seenAt ?? Date.now() })
}

export function markFileLinked(fileId: string): void {
  patchInboxFile(fileId, { linkedAt: Date.now() })
}

export function remindFileLater(fileId: string, ms = REMIND_LATER_MS): void {
  patchInboxFile(fileId, { remindAt: Date.now() + ms, dismissedAt: Date.now() })
}

export function restoreIgnoredFile(fileId: string): void {
  const current = getInboxState()[fileId]
  if (!current) return
  const next = { ...current }
  delete next.ignoredAt
  delete next.remindAt
  commit({ ...getInboxState(), [fileId]: next })
}

/** Fechar o painel: registra a dispensa para o arquivo não voltar a alertar. */
export function dismissFiles(fileIds: string[]): void {
  const now = Date.now()
  let next = getInboxState()
  for (const id of fileIds) next = applyPatch(next, id, { dismissedAt: now, seenAt: next[id]?.seenAt ?? now })
  commit(next)
}
