import { syncToCloud } from './storage'
import { statusAllowsPreview, type Status } from '../types'
import { normalizeClientName, parseCardIdFromFilename } from './videoMatch'

/**
 * Registro central de vínculos arquivo ↔ conteúdo.
 *
 * Antes, a prévia do card saía de `states[id].link` — uma string livre. Qualquer
 * coisa que escrevesse ali (auto-link do Drive chutando o card, colagem manual,
 * resto de um vínculo antigo) virava thumbnail, inclusive em card "A fazer" e
 * inclusive de vídeo de outro conteúdo. A string não sabe de quem ela é.
 *
 * Aqui o vínculo é um registro com dono: item, arquivo, cliente e etapa. A prévia
 * é decidida por UMA função (`getCardPreview`) que exige os quatro casando.
 */

export type FolderStage = 'inbox' | 'revisao' | 'publicar' | 'removido'
export type LinkSource = 'drive' | 'manual'

export type MatchedBy = 'card_id' | 'exact_normalized_title' | 'manual'

export interface MediaLink {
  id: string
  itemId: number
  fileId: string
  clientId: string
  url: string
  folderStage: FolderStage
  source: LinkSource
  /** Vínculo explícito: ID no nome do arquivo ou escolha humana. Palpite = false. */
  confirmed: boolean
  filename?: string
  linkedAt: number
  updatedAt: number
  // Campos da esteira "Pronto" — de onde veio o arquivo e por qual critério
  folderId?: string
  mimeType?: string
  matchedBy?: MatchedBy
  matchConfidence?: number
  createdAt?: number
  previewStatus?: 'detected' | 'processing' | 'ready' | 'attention'
  previewAttempts?: number
  previewNextRetryAt?: number
  previewLastError?: string
}

/** Um card tem no máximo um vínculo — a chave é o itemId. */
export type MediaLinkMap = Record<number, MediaLink>

export const MEDIA_LINKS_KEY = 'sm_media_links'
const MIGRATION_KEY = 'sm_media_links_migrated'

// ── Extração de IDs ───────────────────────────────────────────────────────────

export function extractDriveId(url: string): string | null {
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (m1) return m1[1]
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (m2) return m2[1]
  return null
}

function extractStreamableId(url: string): string | null {
  const m = url.match(/streamable\.com\/(?:e\/)?([a-zA-Z0-9]+)/)
  return m ? m[1] : null
}

function isDirectImage(url: string): boolean {
  return /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)
}

/**
 * Identidade estável do arquivo dentro de uma URL. Sem ID reconhecível não há
 * vínculo — é o que impede "link parecido" de virar prévia.
 */
export function fileIdFromUrl(url: string): string | null {
  const clean = (url ?? '').trim()
  if (!clean) return null
  const drive = extractDriveId(clean)
  if (drive) return `drive:${drive}`
  const streamable = extractStreamableId(clean)
  if (streamable) return `streamable:${streamable}`
  if (isDirectImage(clean)) return `img:${clean}`
  return null
}

/** URL da miniatura para um fileId do registro. */
export function thumbUrlFor(fileId: string): string | null {
  if (fileId.startsWith('drive:')) return `/api/thumb?id=${encodeURIComponent(fileId.slice(6))}&sz=400`
  if (fileId.startsWith('streamable:')) return `https://cdn-cf-east.streamable.com/image/${fileId.slice(11)}.jpg`
  if (fileId.startsWith('img:')) return fileId.slice(4)
  return null
}

/**
 * ID do card declarado no nome do arquivo, quando o nome traz o número
 * (`DSHUB-2007_...`, `2007 - Unboxing.mp4`). O selo novo (`[05MT]`) não devolve
 * ID: ele é um resto de divisão, então só dá para conferir contra um card —
 * é o que `fileDeclaresCard` faz. A regra completa vive em `videoMatch`.
 */
export function parseLeadingItemId(filename: string): number | null {
  return parseCardIdFromFilename(filename)
}

// ── Regra única de prévia ─────────────────────────────────────────────────────

export type CardPreview =
  | { kind: 'none' }
  | { kind: 'pending'; label: string }
  | { kind: 'ready'; thumbUrl: string; fileId: string }

export const PREVIEW_PENDING_LABEL = 'Arquivo vinculado — aguardando publicação'
export const PREVIEW_UNCONFIRMED_LABEL = 'Vínculo a confirmar'
export const PREVIEW_DETECTED_LABEL = 'Arquivo detectado — identificando card'
export const PREVIEW_PROCESSING_LABEL = 'Arquivo detectado — gerando prévia'
export const PREVIEW_ATTENTION_LABEL = 'Prévia precisa de atenção'

/**
 * ÚNICO lugar que decide se um card pode mostrar prévia.
 *
 * Exige, cumulativamente: vínculo explícito para ESTE item, arquivo do MESMO
 * cliente, arquivo na etapa "publicar" e o card já na revisão interna ou
 * adiante. Sem nome parecido, sem primeiro arquivo do cliente, sem data, sem
 * thumbnail salva antes.
 *
 * O status entra na regra porque card em "A fazer", "Produção" ou "Pronto ainda
 * procurando" não tem criativo aprovado para mostrar — mesmo que o cliente tenha
 * outros vídeos publicados.
 */
export function getCardPreview(
  item: { i: number; c: string },
  links: MediaLinkMap,
  status?: Status,
): CardPreview {
  const link = links[item.i]
  if (!link) return { kind: 'none' }
  if (link.itemId !== item.i) return { kind: 'none' }
  // O Drive conserva o nome configurado na pasta, enquanto o calendário pode
  // usar outra capitalização/pontuação ("Padaria R.A" ↔ "Padaria RA"). É o
  // mesmo cliente; comparar a string crua fazia a prévia desaparecer em outro
  // aparelho logo depois de um vínculo correto.
  if (normalizeClientName(link.clientId) !== normalizeClientName(item.c)) return { kind: 'none' }
  if (!link.fileId) return { kind: 'none' }
  // A trava de status existe contra vínculo AUTOMÁTICO em card que ainda não tem
  // criativo. Link colado à mão é o contrário disso: alguém afirmou que o arquivo
  // é aquele. Segurar a prévia nesse caso só fazia a pessoa achar que o painel
  // engoliu o link — foi exatamente o que aconteceu.
  if (status !== undefined && !statusAllowsPreview(status) && link.source !== 'manual') {
    return { kind: 'none' }
  }
  if (link.previewStatus === 'detected') return { kind: 'pending', label: PREVIEW_DETECTED_LABEL }
  if (link.previewStatus === 'processing') return { kind: 'pending', label: PREVIEW_PROCESSING_LABEL }
  if (link.previewStatus === 'attention') return { kind: 'pending', label: PREVIEW_ATTENTION_LABEL }
  if (!link.confirmed) return { kind: 'pending', label: PREVIEW_UNCONFIRMED_LABEL }
  if (link.folderStage !== 'publicar') return { kind: 'pending', label: PREVIEW_PENDING_LABEL }
  const thumbUrl = thumbUrlFor(link.fileId)
  if (!thumbUrl) return { kind: 'pending', label: PREVIEW_PENDING_LABEL }
  return { kind: 'ready', thumbUrl, fileId: link.fileId }
}

// ── Operações puras sobre o mapa ──────────────────────────────────────────────

function stripFile(map: MediaLinkMap, fileId: string, keepItemId?: number): MediaLinkMap {
  let changed = false
  const next: MediaLinkMap = {}
  for (const [id, link] of Object.entries(map)) {
    if (link.fileId === fileId && Number(id) !== keepItemId) { changed = true; continue }
    next[Number(id)] = link
  }
  return changed ? next : map
}

interface UpsertInput {
  itemId: number
  clientId: string
  url: string
  fileId?: string | null
  folderStage?: FolderStage
  source?: LinkSource
  confirmed?: boolean
  filename?: string
  folderId?: string
  mimeType?: string
  matchedBy?: MatchedBy
  matchConfidence?: number
  previewStatus?: 'detected' | 'processing' | 'ready' | 'attention'
  previewAttempts?: number
  previewNextRetryAt?: number
  previewLastError?: string
}

/**
 * Grava o vínculo. Um arquivo pertence a um conteúdo só: qualquer outro card
 * apontando para o mesmo fileId perde o vínculo aqui.
 */
export function applyUpsert(map: MediaLinkMap, input: UpsertInput): MediaLinkMap {
  const fileId = input.fileId ?? fileIdFromUrl(input.url)
  if (!fileId || !input.clientId || !Number.isFinite(input.itemId)) return map

  const now = Date.now()
  const existing = map[input.itemId]
  const sameFile = existing?.fileId === fileId

  const link: MediaLink = {
    id: `${input.clientId}::${fileId}`,
    itemId: input.itemId,
    clientId: input.clientId,
    fileId,
    url: input.url || existing?.url || '',
    // Trocar o arquivo reinicia a etapa; o mesmo arquivo mantém o que já sabíamos
    // (evita que uma colagem manual "promova" um vínculo do Drive ainda em triagem).
    folderStage: input.folderStage ?? (sameFile ? existing.folderStage : 'publicar'),
    source: input.source ?? (sameFile ? existing.source : 'manual'),
    confirmed: input.confirmed ?? (sameFile ? existing.confirmed : true),
    filename: input.filename ?? (sameFile ? existing.filename : undefined),
    linkedAt: sameFile ? existing.linkedAt : now,
    updatedAt: now,
    folderId: input.folderId ?? (sameFile ? existing.folderId : undefined),
    mimeType: input.mimeType ?? (sameFile ? existing.mimeType : undefined),
    matchedBy: input.matchedBy ?? (sameFile ? existing.matchedBy : undefined),
    matchConfidence: input.matchConfidence ?? (sameFile ? existing.matchConfidence : undefined),
    createdAt: sameFile ? (existing.createdAt ?? existing.linkedAt) : now,
    previewStatus: input.previewStatus ?? (sameFile ? existing.previewStatus : undefined),
    previewAttempts: input.previewAttempts ?? (sameFile ? existing.previewAttempts : undefined),
    previewNextRetryAt: input.previewNextRetryAt ?? (sameFile ? existing.previewNextRetryAt : undefined),
    previewLastError: input.previewLastError ?? (sameFile ? existing.previewLastError : undefined),
  }

  if (sameFile && shallowEqualLink(existing, link)) return map
  return { ...stripFile(map, fileId, input.itemId), [input.itemId]: link }
}

function shallowEqualLink(a: MediaLink, b: MediaLink): boolean {
  return a.itemId === b.itemId && a.fileId === b.fileId && a.clientId === b.clientId
    && a.folderStage === b.folderStage && a.source === b.source && a.confirmed === b.confirmed
    && a.url === b.url && a.filename === b.filename && a.matchedBy === b.matchedBy
    && a.folderId === b.folderId && a.mimeType === b.mimeType
    && a.previewStatus === b.previewStatus && a.previewAttempts === b.previewAttempts
    && a.previewNextRetryAt === b.previewNextRetryAt && a.previewLastError === b.previewLastError
}

export function applyRemoveItem(map: MediaLinkMap, itemId: number): MediaLinkMap {
  if (!map[itemId]) return map
  const next = { ...map }
  delete next[itemId]
  return next
}

export function applyRemoveFile(map: MediaLinkMap, fileId: string): MediaLinkMap {
  return stripFile(map, fileId)
}

// ── Reconciliação com o Drive ─────────────────────────────────────────────────

export interface DriveVideoRow {
  drive_file_id: string
  client_name: string
  filename: string
  linked_item_id: number | null
  status: 'inbox' | 'linked' | 'ignored'
  /** Ausente nas linhas gravadas antes da varredura passar a aceitar imagem. */
  mime_type?: string | null
  /** Usado para escolher a versão mais recente quando há reexportações. */
  detected_at?: number
  preview_status?: 'detected' | 'processing' | 'ready' | 'attention' | null
  preview_attempts?: number | null
  preview_next_retry_at?: number | null
  preview_last_error?: string | null
  active_version?: number | null
}

/** fileId (`drive:xxx`) → timestamp em que o arquivo foi visto na pasta Publicar. */
export type DrivePresence = Record<string, number>

/**
 * Traduz a coluna `drive_videos.preview_status` para o registro local.
 *
 * `'detected'` é o DEFAULT do schema — toda linha nasce com ele e nenhum
 * endpoint o atualiza. Tratá-lo como estado bloqueia a prévia de qualquer
 * arquivo vinculado. `null` é linha antiga, de antes da coluna existir: essas
 * já tinham prévia funcionando e continuam tendo.
 */
export function previewStatusFromDrive(
  raw: DriveVideoRow['preview_status'],
): MediaLink['previewStatus'] {
  if (raw === null || raw === undefined) return 'ready'
  return raw === 'detected' ? undefined : raw
}

/**
 * Traz o estado do Drive para o registro:
 * - vídeo vinculado no D1 → mantém/cria o vínculo, com a etapa vinda da presença
 *   na pasta Publicar do cliente;
 * - vídeo ignorado, ou vinculado a OUTRO card → este card perde o vínculo;
 * - arquivo que sumiu da pasta Publicar → etapa "removido" (sem prévia).
 *
 * Duas coisas que esta função deliberadamente NÃO faz:
 *
 * 1. `status = 'inbox'` não desfaz vínculo. A esteira da coluna Pronto acha o
 *    arquivo direto na pasta, sem passar pelo Inbox; a varredura seguinte insere
 *    esse mesmo arquivo como 'inbox' e, se isso desfizesse o vínculo, a prévia
 *    sumia do card sozinha minutos depois de ele entrar em revisão.
 * 2. Arquivo ausente da lista de vídeos não é tratado como removido — a listagem
 *    tem LIMIT e ausência ali não é prova de nada. Quem prova remoção é a
 *    presença, que é uma varredura completa da pasta.
 */
export function applyDriveReconcile(
  map: MediaLinkMap,
  videos: DriveVideoRow[],
  presence: DrivePresence | null,
  itemClientById: Map<number, string>,
): MediaLinkMap {
  let next = map
  const clientKey = (name: string) => normalizeClientName(name)
  const presenceCanonicalKey = (clientName: string, driveFileId: string) =>
    `${clientKey(clientName)}::${driveFileId}`

  // Momento da última varredura de cada cliente. Todas as entradas de presença de
  // um cliente são gravadas no mesmo scan, então o maior valor é a data dele.
  const lastScanByClient = new Map<string, number>()
  const presentFiles = new Set<string>()
  if (presence) {
    for (const [key, seenAtSec] of Object.entries(presence)) {
      const client = presenceClientOf(key)
      if (!client) continue
      const driveFileId = key.slice(key.indexOf('::') + 2)
      const canonicalClient = clientKey(client)
      const ms = seenAtSec * 1000
      presentFiles.add(presenceCanonicalKey(client, driveFileId))
      if (ms > (lastScanByClient.get(canonicalClient) ?? 0)) lastScanByClient.set(canonicalClient, ms)
    }
  }

  /**
   * Ausente da presença só significa "removido" se a pasta foi varrida DEPOIS de
   * o vínculo existir. A varredura roda a cada 90s: um arquivo que a esteira
   * acabou de achar ainda não está na presença, e tratá-lo como removido fazia a
   * prévia sumir do card segundos depois de ele entrar em revisão.
   */
  const stageFor = (clientName: string, driveFileId: string, linkedAtMs?: number): FolderStage => {
    const lastScan = lastScanByClient.get(clientKey(clientName))
    if (presence === null || lastScan === undefined) return 'publicar'
    if (presentFiles.has(presenceCanonicalKey(clientName, driveFileId))) return 'publicar'
    if (linkedAtMs !== undefined && linkedAtMs > lastScan) return 'publicar'
    return 'removido'
  }

  // Cards já decididos pelo laço dos vídeos — a varredura final não os reavalia.
  const decided = new Set<number>()
  const linkedByItem = new Map<number, DriveVideoRow[]>()

  for (const video of videos) {
    const fileId = `drive:${video.drive_file_id}`

    if (video.status === 'ignored') {
      next = applyRemoveFile(next, fileId)
      continue
    }

    if (video.status !== 'linked' || !video.linked_item_id) continue
    const group = linkedByItem.get(video.linked_item_id) ?? []
    group.push(video)
    linkedByItem.set(video.linked_item_id, group)
  }

  for (const [itemId, candidates] of linkedByItem) {
    const itemClient = itemClientById.get(itemId)
    const compatible = candidates.filter(video =>
      !!itemClient && clientKey(itemClient) === clientKey(video.client_name),
    )

    // Vínculo órfão ou realmente entre clientes diferentes: não vira prévia.
    for (const video of candidates) {
      if (!compatible.includes(video)) next = applyRemoveFile(next, `drive:${video.drive_file_id}`)
    }
    if (!itemClient || compatible.length === 0) continue

    // Reexportações podem deixar duas linhas "linked" no D1. A versão que ainda
    // está em Publicar vence; entre duas ativas, vence a detectada por último.
    const ordered = [...compatible].sort((a, b) => {
      const aPinned = a.active_version === 1 ? 1 : 0
      const bPinned = b.active_version === 1 ? 1 : 0
      const aReady = a.preview_status === 'ready' || !a.preview_status ? 1 : 0
      const bReady = b.preview_status === 'ready' || !b.preview_status ? 1 : 0
      const aPresent = presentFiles.has(presenceCanonicalKey(a.client_name, a.drive_file_id)) ? 1 : 0
      const bPresent = presentFiles.has(presenceCanonicalKey(b.client_name, b.drive_file_id)) ? 1 : 0
      return bPinned - aPinned || bReady - aReady || bPresent - aPresent || (b.detected_at ?? 0) - (a.detected_at ?? 0)
    })
    const video = ordered[0]
    const fileId = `drive:${video.drive_file_id}`
    const existing = next[itemId]

    next = applyUpsert(next, {
      itemId,
      clientId: itemClient,
      url: `https://drive.google.com/file/d/${video.drive_file_id}/view`,
      fileId,
      folderStage: stageFor(video.client_name, video.drive_file_id, existing?.fileId === fileId ? existing.linkedAt : undefined),
      source: 'drive',
      // status=linked + linked_item_id é a decisão central compartilhada. Ela só
      // é gravada após escolha humana ou auto-link validado, portanto continua
      // confirmada em todos os aparelhos mesmo com nome truncado.
      confirmed: true,
      filename: video.filename,
      // `'detected'` é o DEFAULT da coluna em `schema.sql`, não uma medição: ele
      // diz "ninguém olhou ainda", não "a prévia não está pronta". Importá-lo
      // como estado real apagava a prévia ~20s depois de a esteira vincular o
      // arquivo — e como nada no servidor escreve essa coluna, o card ficava
      // preso em "identificando card" para sempre, com o envio à revisão
      // desabilitado. Só valor efetivamente escrito por alguém conta.
      previewStatus: previewStatusFromDrive(video.preview_status),
      previewAttempts: video.preview_attempts ?? 0,
      previewNextRetryAt: video.preview_next_retry_at ? video.preview_next_retry_at * 1000 : undefined,
      previewLastError: video.preview_last_error ?? undefined,
    })
    decided.add(itemId)
  }

  // Arquivo apagado da pasta Publicar depois de vinculado: a prévia cai na hora,
  // mesmo que o arquivo nunca tenha passado pelo Inbox (caso da esteira Pronto).
  if (presence !== null) {
    for (const [rawId, link] of Object.entries(next)) {
      if (decided.has(Number(rawId))) continue
      if (link.source !== 'drive' || !link.fileId.startsWith('drive:')) continue
      if (!lastScanByClient.has(clientKey(link.clientId))) continue
      const stage = stageFor(link.clientId, link.fileId.slice(6), link.linkedAt)
      if (stage === link.folderStage) continue
      next = { ...next, [Number(rawId)]: { ...link, folderStage: stage, updatedAt: Date.now() } }
    }
  }

  return next
}

/** Chave de presença: cliente + arquivo, para não confundir pastas homônimas. */
export function presenceKey(clientName: string, driveFileId: string): string {
  return `${clientName}::${driveFileId}`
}

function presenceClientOf(key: string): string | null {
  const idx = key.indexOf('::')
  return idx > 0 ? key.slice(0, idx) : null
}

// ── Migração dos vínculos antigos (não destrutiva) ────────────────────────────

export interface LegacyItem { i: number; c: string }
export interface LegacyState { link?: string; footageLink?: string }

/**
 * Converte o que existe hoje em `states[].link` para vínculos, sem apagar nada
 * do usuário — o `link` do card continua lá, só deixa de mandar sozinho na prévia.
 *
 * Descarta o que é inválido por definição: sem item, item inexistente, sem ID de
 * arquivo reconhecível.
 *
 * `link === footageLink` num arquivo do Drive é assinatura do auto-link antigo
 * (ele escrevia os dois campos com a mesma URL) — esses entram como não
 * confirmados, porque é exatamente essa população que pode estar apontando para
 * o card errado. Colagem manual entra confirmada: quem digitou escolheu o card.
 */
export function buildLegacyLinks(
  items: LegacyItem[],
  states: Record<number, LegacyState>,
): MediaLinkMap {
  let map: MediaLinkMap = {}
  const byId = new Map(items.map(i => [i.i, i]))

  for (const [rawId, state] of Object.entries(states)) {
    const itemId = Number(rawId)
    const item = byId.get(itemId)
    if (!item) continue
    const url = (state?.link ?? '').trim()
    if (!url) continue
    const fileId = fileIdFromUrl(url)
    if (!fileId) continue

    const fromAutoLink = fileId.startsWith('drive:') && url === (state.footageLink ?? '').trim()

    map = applyUpsert(map, {
      itemId,
      clientId: item.c,
      url,
      fileId,
      folderStage: 'publicar',
      source: fromAutoLink ? 'drive' : 'manual',
      confirmed: !fromAutoLink,
    })
  }

  return map
}

// ── Store (localStorage + sync + assinantes) ──────────────────────────────────

let _map: MediaLinkMap = {}
let _loaded = false
const _listeners = new Set<() => void>()

function readStorage(): MediaLinkMap {
  try {
    const raw = localStorage.getItem(MEDIA_LINKS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as MediaLinkMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function commit(next: MediaLinkMap, persist = true): void {
  if (next === _map) return
  _map = next
  if (persist) {
    try {
      localStorage.setItem(MEDIA_LINKS_KEY, JSON.stringify(next))
    } catch (e) {
      console.error('[mediaLinks] falha ao gravar no localStorage', e)
    }
    syncToCloud(MEDIA_LINKS_KEY, next)
  }
  _listeners.forEach(fn => fn())
}

export function getMediaLinks(): MediaLinkMap {
  if (!_loaded) {
    _map = readStorage()
    _loaded = true
  }
  return _map
}

export function subscribeMediaLinks(fn: () => void): () => void {
  _listeners.add(fn)
  return () => { _listeners.delete(fn) }
}

/** Recarrega do localStorage (usado quando o sync do servidor sobrescreve a chave). */
export function reloadMediaLinks(): void {
  _loaded = true
  commit(readStorage(), false)
}

export function upsertMediaLink(input: UpsertInput): void {
  commit(applyUpsert(getMediaLinks(), input))
}

export function removeMediaLinkForItem(itemId: number): void {
  commit(applyRemoveItem(getMediaLinks(), itemId))
}

export function removeMediaLinkForFile(fileId: string): void {
  commit(applyRemoveFile(getMediaLinks(), fileId))
}

export function confirmMediaLink(itemId: number): void {
  const current = getMediaLinks()[itemId]
  if (!current || current.confirmed) return
  commit({ ...getMediaLinks(), [itemId]: { ...current, confirmed: true, updatedAt: Date.now() } })
}

export function reconcileMediaLinksFromDrive(
  videos: DriveVideoRow[],
  presence: DrivePresence | null,
  itemClientById: Map<number, string>,
): void {
  commit(applyDriveReconcile(getMediaLinks(), videos, presence, itemClientById))
}

/**
 * Vínculo vindo de uma edição manual do campo de link do card. Não promove um
 * vínculo do Drive que ainda está em triagem: se o arquivo é o mesmo, só toca a
 * data (ver `applyUpsert`).
 */
const pendingRemoval = new Map<number, ReturnType<typeof setTimeout>>()
/** Tempo sem digitar que transforma "texto pela metade" em "não é um arquivo". */
const TYPING_GRACE_MS = 1500

export function syncManualLink(itemId: number, clientId: string, url: string): void {
  const pending = pendingRemoval.get(itemId)
  if (pending) { clearTimeout(pending); pendingRemoval.delete(itemId) }

  const clean = (url ?? '').trim()
  const fileId = clean ? fileIdFromUrl(clean) : null

  if (fileId) {
    upsertMediaLink({ itemId, clientId, url: clean })
    return
  }

  // Campo vazio é decisão explícita de quem editou: desfaz na hora.
  if (!clean) {
    removeMediaLinkForItem(itemId)
    return
  }

  /**
   * Texto que ainda não é um arquivo reconhecível. O campo salva a cada tecla, e
   * colar uma URL passa por vários estados intermediários ("h", "http", "https:/…")
   * — desfazer o vínculo em cada um apagava a prévia que a esteira tinha criado,
   * bem debaixo do dedo de quem estava colando o link. Só desfaz quando o texto
   * para de mudar: aí é mesmo um link que não aponta para arquivo nenhum.
   */
  pendingRemoval.set(itemId, setTimeout(() => {
    pendingRemoval.delete(itemId)
    removeMediaLinkForItem(itemId)
  }, TYPING_GRACE_MS))
}

/** Roda uma vez: converte `states[].link` em vínculos. Reversível — nada é apagado. */
export function migrateLegacyMediaLinks(items: LegacyItem[], states: Record<number, LegacyState>): void {
  if (localStorage.getItem(MIGRATION_KEY) === '1') return
  const existing = getMediaLinks()
  const legacy = buildLegacyLinks(items, states)
  // O que já existe no registro vence a migração.
  commit({ ...legacy, ...existing })
  localStorage.setItem(MIGRATION_KEY, '1')
}
