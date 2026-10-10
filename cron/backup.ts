/**
 * Backup do D1 → R2: uma cópia por HORA (guardada 7 dias) + uma por dia (30 dias).
 *
 * Até aqui o único seguro do banco era o Time Travel do próprio D1: se a conta
 * da Cloudflare for comprometida, ou o banco apagado, ele vai junto. Este
 * módulo tira uma cópia completa por dia para um balde PRIVADO separado
 * (`ds-hub-backups`), guarda 30 dias e apaga o resto.
 *
 * Formato: um JSON gzipado com o CREATE de cada tabela e todas as linhas. É
 * legível, independe do wrangler e o `scripts/backup-restaurar.mjs` transforma
 * de volta em SQL — backup que não se sabe restaurar é só esperança.
 *
 * O cron dispara a cada 5 min; o `head` de cada objeto faz a cópia da hora
 * sair UMA vez por hora, e a do dia uma vez a partir das 06h UTC (03h de
 * Brasília) — falhou, tenta de novo no disparo seguinte.
 *
 * Por que de hora em hora (2026-10-08): só com a diária, um card criado de
 * manhã e perdido à tarde não estava em backup nenhum. Uma cópia gzipada tem
 * ~0,5 MB; 7 dias de horárias são ~80 MB no R2, longe da cota.
 */

export interface BackupEnv {
  DB: D1Database
  BACKUPS: R2Bucket
}

export const BACKUP_FORMAT = 'ds-hub-d1-backup'
export const BACKUP_VERSION = 1
/** Dias guardados no R2. O Time Travel do D1 cobre o mesmo período por outro caminho. */
export const KEEP_DAYS = 30
/** Dias de cópias horárias. Depois disso sobra a diária. */
export const KEEP_HOURLY_DAYS = 7
export const HOURLY_PREFIX = 'd1/hora/'
/** Hora UTC a partir da qual o backup do dia pode sair (06h UTC = 03h Brasília). */
export const BACKUP_HOUR_UTC = 6
/** Linhas por consulta — mantém cada resposta do D1 pequena. */
const PAGE = 500

export const STATUS_KEY = 'status.json'

export interface TableDump {
  name: string
  sql: string
  rows: Record<string, unknown>[]
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  createdAt: string
  tables: TableDump[]
  indexes: string[]
}

export interface BackupStatus {
  ok: boolean
  at: string
  key?: string
  bytes?: number
  sha256?: string
  /** Chaves gravadas nesta rodada (a da hora e, uma vez por dia, a diária). */
  keys?: string[]
  rows?: Record<string, number>
  /** Tamanho das listas de cards — a queda de uma cópia para a outra denuncia perda. */
  cards?: CardCounts
  deleted?: string[]
  error?: string
}

/** `d1/AAAA-MM-DD.json.gz`, na data UTC. */
export function backupKey(now: Date): string {
  return `d1/${now.toISOString().slice(0, 10)}.json.gz`
}

/** `d1/hora/AAAA-MM-DDTHH.json.gz`, na hora UTC. */
export function hourlyBackupKey(now: Date): string {
  return `${HOURLY_PREFIX}${now.toISOString().slice(0, 13)}.json.gz`
}

export function shouldRunBackup(now: Date): boolean {
  return now.getUTCHours() >= BACKUP_HOUR_UTC
}

/**
 * Chaves de backup mais velhas que `keepDays`. Só olha o que segue o padrão
 * `d1/AAAA-MM-DD.json.gz` — qualquer outro arquivo que alguém ponha no balde
 * fica intocado.
 */
export function expiredKeys(keys: string[], now: Date, keepDays = KEEP_DAYS): string[] {
  const cutoff = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - keepDays * 86_400_000
  return keys.filter(k => {
    const m = /^d1\/(\d{4}-\d{2}-\d{2})\.json\.gz$/.exec(k)
    if (!m) return false
    const t = Date.parse(`${m[1]}T00:00:00Z`)
    return !Number.isNaN(t) && t < cutoff
  })
}

/** Cópias horárias mais velhas que `keepDays`. Mesmo cuidado: só o padrão exato. */
export function expiredHourlyKeys(keys: string[], now: Date, keepDays = KEEP_HOURLY_DAYS): string[] {
  const cutoff = now.getTime() - keepDays * 86_400_000
  return keys.filter(k => {
    const m = /^d1\/hora\/(\d{4}-\d{2}-\d{2}T\d{2})\.json\.gz$/.exec(k)
    if (!m) return false
    const t = Date.parse(`${m[1]}:00:00Z`)
    return !Number.isNaN(t) && t < cutoff
  })
}

export interface CardCounts {
  custom: number
  states: number
  deleted: number
}

/** Tamanho de `sm_custom`, `sm_states` e `sm_deleted` no dump. Valor ilegível conta -1. */
export function countCards(dump: BackupFile): CardCounts {
  const rows = dump.tables.find(t => t.name === 'app_data')?.rows ?? []
  const size = (key: string): number => {
    const row = rows.find(r => r.key === key)
    if (!row) return 0
    try {
      const v = JSON.parse(String(row.value)) as unknown
      if (Array.isArray(v)) return v.length
      if (v && typeof v === 'object') return Object.keys(v).length
      return 0
    } catch { return -1 }
  }
  return { custom: size('sm_custom'), states: size('sm_states'), deleted: size('sm_deleted') }
}

/**
 * BLOB vira `{ $blob: base64 }` — JSON não tem binário. O D1 entrega BLOB como
 * `number[]` (o SQLite do Node, como `Uint8Array`); coluna de texto nunca vem
 * como array, então array aqui só pode ser BLOB.
 */
export function encodeValue(v: unknown): unknown {
  if (Array.isArray(v)) v = Uint8Array.from(v as number[])
  if (v instanceof ArrayBuffer) v = new Uint8Array(v)
  if (v instanceof Uint8Array) {
    let s = ''
    for (const b of v) s += String.fromCharCode(b)
    return { $blob: btoa(s) }
  }
  return v
}

/** Tabelas internas do SQLite/D1 ficam de fora: o próprio banco as recria. */
export function isUserTable(name: string): boolean {
  return !name.startsWith('sqlite_') && !name.startsWith('_cf_') && !name.startsWith('d1_')
}

export async function dumpDatabase(db: D1Database, now: Date): Promise<BackupFile> {
  const master = await db
    .prepare("SELECT type, name, sql FROM sqlite_master WHERE type IN ('table', 'index') AND sql IS NOT NULL ORDER BY name")
    .all<{ type: string; name: string; sql: string }>()

  const tables: TableDump[] = []
  const indexes: string[] = []

  for (const row of master.results ?? []) {
    if (!isUserTable(row.name)) continue
    if (row.type === 'index') { indexes.push(row.sql); continue }

    const rows: Record<string, unknown>[] = []
    const quoted = `"${row.name.replace(/"/g, '""')}"`
    for (let offset = 0; ; offset += PAGE) {
      const page = await db
        .prepare(`SELECT * FROM ${quoted} ORDER BY rowid LIMIT ? OFFSET ?`)
        .bind(PAGE, offset)
        .all<Record<string, unknown>>()
      const got = page.results ?? []
      for (const r of got) {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(r)) out[k] = encodeValue(v)
        rows.push(out)
      }
      if (got.length < PAGE) break
    }
    tables.push({ name: row.name, sql: row.sql, rows })
  }

  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: now.toISOString(), tables, indexes }
}

/** Literal SQL de um valor já passado por `encodeValue`. */
export function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (typeof v === 'bigint') return v.toString()
  if (typeof v === 'object' && v !== null && typeof (v as { $blob?: unknown }).$blob === 'string') {
    const bin = atob((v as { $blob: string }).$blob)
    let hex = ''
    for (let i = 0; i < bin.length; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, '0')
    return `X'${hex}'`
  }
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return `'${s.replace(/'/g, "''")}'`
}

/**
 * O caminho de volta: backup → SQL que recria o banco do zero.
 *
 * APAGA cada tabela antes de recriar (`DROP TABLE`). É o que se quer num banco
 * local de teste ou numa restauração de desastre — e o motivo de o
 * `scripts/backup-restaurar.mjs` só aplicar sozinho no D1 LOCAL.
 */
export function backupToSql(file: BackupFile): string {
  if (file.format !== BACKUP_FORMAT) throw new Error(`Arquivo não é um backup do DS HUB (format=${String(file.format)})`)
  if (file.version !== BACKUP_VERSION) throw new Error(`Versão de backup não suportada: ${String(file.version)}`)

  const out: string[] = [`-- Backup DS HUB de ${file.createdAt}`, 'PRAGMA defer_foreign_keys = on;']
  for (const t of file.tables) {
    const quoted = `"${t.name.replace(/"/g, '""')}"`
    out.push(`DROP TABLE IF EXISTS ${quoted};`, `${t.sql};`)
    for (const row of t.rows) {
      const cols = Object.keys(row)
      out.push(
        `INSERT INTO ${quoted} (${cols.map(c => `"${c.replace(/"/g, '""')}"`).join(', ')}) VALUES (${cols.map(c => sqlLiteral(row[c])).join(', ')});`,
      )
    }
  }
  for (const idx of file.indexes) out.push(`${idx};`)
  return out.join('\n') + '\n'
}

async function gzip(text: string): Promise<ArrayBuffer> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Response(stream).arrayBuffer()
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function listAllKeys(bucket: R2Bucket, prefix: string): Promise<string[]> {
  const keys: string[] = []
  let cursor: string | undefined
  do {
    const page = await bucket.list({ prefix, cursor })
    for (const o of page.objects) keys.push(o.key)
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return keys
}

/**
 * Faz a cópia da hora (e, a partir das 06h UTC, a do dia) se ainda não
 * existirem — um dump só serve as duas. Devolve o status gravado, ou `null`
 * quando não havia nada a fazer.
 *
 * O status vai para `status.json` no próprio balde — e não para o `app_data`,
 * que é sincronizado com os navegadores da equipe a cada 20s.
 */
export async function runBackup(env: BackupEnv, now = new Date()): Promise<BackupStatus | null> {
  const due: string[] = []
  const hourly = hourlyBackupKey(now)
  if (!(await env.BACKUPS.head(hourly))) due.push(hourly)
  if (shouldRunBackup(now)) {
    const daily = backupKey(now)
    if (!(await env.BACKUPS.head(daily))) due.push(daily)
  }
  if (!due.length) return null

  let status: BackupStatus
  try {
    const dump = await dumpDatabase(env.DB, now)
    const body = await gzip(JSON.stringify(dump))
    const sha256 = await sha256Hex(body)
    const rows = Object.fromEntries(dump.tables.map(t => [t.name, t.rows.length]))
    const cards = countCards(dump)

    for (const key of due) {
      await env.BACKUPS.put(key, body, {
        httpMetadata: { contentType: 'application/json', contentEncoding: 'gzip' },
        customMetadata: {
          sha256, createdAt: dump.createdAt, tables: String(dump.tables.length),
          custom: String(cards.custom), states: String(cards.states), deleted: String(cards.deleted),
        },
      })
    }

    // Retenção só DEPOIS de a cópia nova estar gravada: se ela falhar, as
    // antigas continuam lá.
    const all = await listAllKeys(env.BACKUPS, 'd1/')
    const deleted = [...expiredKeys(all, now), ...expiredHourlyKeys(all, now)]
    if (deleted.length) await env.BACKUPS.delete(deleted)

    status = { ok: true, at: now.toISOString(), key: due[0], keys: due, bytes: body.byteLength, sha256, rows, cards, deleted }
  } catch (e) {
    status = { ok: false, at: now.toISOString(), key: due[0], keys: due, error: e instanceof Error ? e.message : String(e) }
  }

  try {
    await env.BACKUPS.put(STATUS_KEY, JSON.stringify(status, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    })
  } catch { /* o status é diagnóstico — não vale derrubar o backup por ele */ }

  return status
}
