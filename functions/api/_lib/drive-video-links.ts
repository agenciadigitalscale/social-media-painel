export interface DriveVideoLinkRow {
  drive_file_id: string
  client_name: string
  filename: string
  mime_type: string
  status: string
  linked_item_id: number | null
  detected_at: number
  created_at: number
  updated_at: number
  preview_status?: string | null
  active_version?: number | null
}

const ALLOWED_FOLDER_STAGES = new Set(['inbox', 'revisao', 'publicar', 'removido'])
const ALLOWED_SOURCES = new Set(['drive', 'manual'])
const ALLOWED_PREVIEW_STATUS = new Set(['detected', 'processing', 'ready', 'attention'])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function normalizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function normalizeNumber(value: unknown, fallback: number): number {
  return Number.isFinite(value as number) ? Number(value) : fallback
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function sanitizeMediaLinkEntry(entry: Record<string, unknown>): Record<string, unknown> | null {
  const itemId = Number(entry.itemId)
  const fileId = normalizeString(entry.fileId)
  const clientId = normalizeString(entry.clientId)
  const url = normalizeString(entry.url)
  if (!Number.isFinite(itemId) || !fileId || !clientId || !url) return null

  const folderStage = ALLOWED_FOLDER_STAGES.has(String(entry.folderStage))
    ? String(entry.folderStage)
    : 'publicar'
  const source = ALLOWED_SOURCES.has(String(entry.source))
    ? String(entry.source)
    : 'manual'
  const confirmed = typeof entry.confirmed === 'boolean' ? entry.confirmed : true

  const previewStatus = typeof entry.previewStatus === 'string' && ALLOWED_PREVIEW_STATUS.has(entry.previewStatus)
    ? entry.previewStatus
    : undefined
  const previewAttempts = Number.isFinite(entry.previewAttempts as number)
    ? Number(entry.previewAttempts)
    : undefined
  const previewNextRetryAt = Number.isFinite(entry.previewNextRetryAt as number)
    ? Number(entry.previewNextRetryAt)
    : undefined
  const previewLastError = normalizeString(entry.previewLastError)

  const filename = normalizeString(entry.filename)
  const folderId = normalizeString(entry.folderId)
  const mimeType = normalizeString(entry.mimeType)
  const matchedBy = normalizeString(entry.matchedBy) as string | undefined
  const matchConfidence = Number.isFinite(entry.matchConfidence as number)
    ? Number(entry.matchConfidence)
    : undefined
  const createdAt = Number.isFinite(entry.createdAt as number)
    ? Number(entry.createdAt)
    : undefined
  const linkedAt = normalizeNumber(entry.linkedAt, Date.now())
  const updatedAt = normalizeNumber(entry.updatedAt, Date.now())

  const normalized: Record<string, unknown> = {
    id: `${clientId}::${fileId}`,
    itemId,
    clientId,
    fileId,
    url,
    folderStage,
    source,
    confirmed,
    filename: filename || undefined,
    folderId: folderId || undefined,
    mimeType: mimeType || undefined,
    matchedBy: matchedBy || undefined,
    matchConfidence: matchConfidence ?? undefined,
    createdAt,
    linkedAt,
    updatedAt,
    previewStatus,
    previewAttempts,
    previewNextRetryAt,
    previewLastError: previewLastError || undefined,
  }

  return normalized
}

export function canonicalizeLinkedDriveVideos(rows: DriveVideoLinkRow[], presence: Record<string, number> | null) {
  return rows.map(row => ({
    ...row,
    confirmed: true,
    present: presence ? Boolean(presence[`${row.client_name}::${row.drive_file_id}`]) : false,
  }))
}

export async function repairCanonicalDriveLinks(
  db: D1Database,
  videos: any[],
  rawRows: DriveVideoLinkRow[],
  presence: Record<string, number> | null,
) {
  const linkedGroups = new Map<number, DriveVideoLinkRow[]>()

  for (const row of rawRows) {
    if (row.status === 'linked' && Number.isFinite(row.linked_item_id)) {
      const itemId = row.linked_item_id as number
      const group = linkedGroups.get(itemId) ?? []
      group.push(row)
      linkedGroups.set(itemId, group)
    }
  }

  const presentKey = (row: DriveVideoLinkRow) =>
    Boolean(presence?.[`${row.client_name}::${row.drive_file_id}`])

  for (const [itemId, rows] of linkedGroups.entries()) {
    if (rows.length <= 1) continue

    rows.sort((a, b) => {
      const aPinned = a.active_version === 1 ? 1 : 0
      const bPinned = b.active_version === 1 ? 1 : 0
      const aReady = a.preview_status === 'ready' || !a.preview_status ? 1 : 0
      const bReady = b.preview_status === 'ready' || !b.preview_status ? 1 : 0
      const aPresent = presentKey(a) ? 1 : 0
      const bPresent = presentKey(b) ? 1 : 0
      return bPinned - aPinned || bReady - aReady || bPresent - aPresent || (b.detected_at ?? 0) - (a.detected_at ?? 0)
    })

    const canonical = rows[0]
    for (const row of rows.slice(1)) {
      if (row.drive_file_id === canonical.drive_file_id) continue
      if (row.status === 'linked') {
        await db.prepare(
          'UPDATE drive_videos SET status = ?, updated_at = unixepoch() WHERE drive_file_id = ?'
        ).bind('ignored', row.drive_file_id).run()
      }
    }

    if (canonical.status !== 'linked') {
      await db.prepare(
        'UPDATE drive_videos SET status = ?, updated_at = unixepoch() WHERE drive_file_id = ?'
      ).bind('linked', canonical.drive_file_id).run()
    }
  }
}

export function protectMediaLinksValue(value: unknown): unknown {
  let parsed: unknown = value
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return '{}'
    }
  }

  if (!isPlainObject(parsed)) return '{}'

  const sanitized: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(parsed)) {
    if (!/^[0-9]+$/.test(key) || !isPlainObject(entry)) continue
    const normalized = sanitizeMediaLinkEntry(entry)
    if (normalized) sanitized[key] = normalized
  }

  return JSON.stringify(sanitized)
}
