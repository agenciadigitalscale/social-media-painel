import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { gunzipSync } from 'node:zlib'
import {
  backupKey, shouldRunBackup, expiredKeys, dumpDatabase, backupToSql, runBackup,
  sqlLiteral, encodeValue, STATUS_KEY, type BackupFile, type BackupStatus,
} from '../backup'

// SQLite embutido do Node 22+. Via `require` porque o Vite 5 não conhece o
// `node:sqlite` como módulo nativo e tenta resolvê-lo como pacote.
interface SqliteStmt { all(...p: unknown[]): unknown[]; run(...p: unknown[]): unknown }
interface SqliteDb { exec(sql: string): void; prepare(sql: string): SqliteStmt }
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as {
  DatabaseSync: new (path: string) => SqliteDb
}
type DatabaseSync = SqliteDb

/** D1 de mentira sobre o SQLite embutido do Node — só o que o backup usa. */
function fakeD1(db: DatabaseSync): D1Database {
  return {
    prepare(sql: string) {
      let params: unknown[] = []
      const stmt = {
        bind(...p: unknown[]) { params = p; return stmt },
        async all() { return { results: db.prepare(sql).all(...(params as never[])) } },
      }
      return stmt
    },
  } as unknown as D1Database
}

/** R2 de mentira em memória. */
function fakeR2(opts: { failPut?: boolean } = {}) {
  const store = new Map<string, ArrayBuffer | string>()
  const bucket = {
    store,
    async head(k: string) { return store.has(k) ? { key: k } : null },
    async put(k: string, v: ArrayBuffer | string) {
      if (opts.failPut && k !== STATUS_KEY) throw new Error('R2 fora do ar')
      store.set(k, v)
    },
    async list({ prefix }: { prefix: string }) {
      return { objects: [...store.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })), truncated: false }
    },
    async delete(keys: string | string[]) { for (const k of [keys].flat()) store.delete(k) },
  }
  return bucket
}

function seed(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE app_data (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '{}', updated TEXT, rev INTEGER DEFAULT 0);
    CREATE TABLE items (id INTEGER PRIMARY KEY, status INTEGER, caption TEXT, thumb BLOB);
    CREATE INDEX idx_app_data_updated ON app_data(updated);
  `)
  const ins = db.prepare('INSERT INTO app_data (key, value, updated, rev) VALUES (?, ?, ?, ?)')
  ins.run('sm_states', JSON.stringify({ '1': { status: 5 } }), '2026-09-28 10:00:00', 3)
  ins.run('sm_nota', "texto com 'aspas' e ; ponto e vírgula\nquebra", '2026-09-28 10:00:01', 0)
  db.prepare('INSERT INTO items (id, status, caption, thumb) VALUES (?, ?, ?, ?)').run(1, 2, null, new Uint8Array([0, 255, 16]))
  // Mais de uma página (PAGE = 500) para exercitar a paginação.
  const many = db.prepare('INSERT INTO items (id, status, caption) VALUES (?, ?, ?)')
  for (let i = 2; i <= 1203; i++) many.run(i, i % 8, `post ${i}`)
  return db
}

const NOW = new Date('2026-09-28T06:05:00Z')

describe('agenda', () => {
  it('só roda a partir das 06h UTC (03h de Brasília)', () => {
    expect(shouldRunBackup(new Date('2026-09-28T05:59:00Z'))).toBe(false)
    expect(shouldRunBackup(new Date('2026-09-28T06:00:00Z'))).toBe(true)
    expect(shouldRunBackup(new Date('2026-09-28T23:55:00Z'))).toBe(true)
  })

  it('uma chave por dia', () => {
    expect(backupKey(NOW)).toBe('d1/2026-09-28.json.gz')
  })
})

describe('retenção', () => {
  it('apaga só backups com mais de 30 dias e ignora outros arquivos', () => {
    const keys = ['d1/2026-08-28.json.gz', 'd1/2026-08-29.json.gz', 'd1/2026-09-27.json.gz', 'status.json', 'd1/manual.json.gz']
    expect(expiredKeys(keys, NOW)).toEqual(['d1/2026-08-28.json.gz'])
  })
})

describe('ida e volta', () => {
  it('backup → SQL → banco novo com os mesmos dados', async () => {
    const original = seed()
    const dump = await dumpDatabase(fakeD1(original), NOW)

    expect(dump.tables.map(t => t.name).sort()).toEqual(['app_data', 'items'])
    expect(dump.tables.find(t => t.name === 'items')!.rows).toHaveLength(1203)

    const restored = new DatabaseSync(':memory:')
    // Sai JSON e volta: é o caminho real (gravado no R2, lido do disco).
    restored.exec(backupToSql(JSON.parse(JSON.stringify(dump)) as BackupFile))

    for (const q of ['SELECT * FROM app_data ORDER BY key', 'SELECT id, status, caption, hex(thumb) h FROM items ORDER BY id']) {
      expect(restored.prepare(q).all()).toEqual(original.prepare(q).all())
    }
    const idx = restored.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_app_data_updated'").all()
    expect(idx).toHaveLength(1)
  })

  it('recusa arquivo que não é backup do DS HUB', () => {
    expect(() => backupToSql({ format: 'outro' } as unknown as BackupFile)).toThrow(/não é um backup/)
  })

  it('BLOB no formato do D1 (number[]) volta como binário', () => {
    expect(sqlLiteral(encodeValue([0, 255, 16]))).toBe("X'00ff10'")
  })

  it('escapa aspas em texto', () => {
    expect(sqlLiteral("d'água")).toBe("'d''água'")
    expect(sqlLiteral(null)).toBe('NULL')
  })
})

describe('runBackup', () => {
  it('grava o backup do dia, o status e apaga os vencidos', async () => {
    const r2 = fakeR2()
    r2.store.set('d1/2026-08-01.json.gz', 'velho')
    r2.store.set('d1/2026-09-27.json.gz', 'ontem')

    const status = await runBackup({ DB: fakeD1(seed()), BACKUPS: r2 as unknown as R2Bucket }, NOW)

    expect(status?.ok).toBe(true)
    expect(status?.rows).toEqual({ app_data: 2, items: 1203 })
    expect(status?.deleted).toEqual(['d1/2026-08-01.json.gz'])
    expect(r2.store.has('d1/2026-09-27.json.gz')).toBe(true)

    const gz = r2.store.get('d1/2026-09-28.json.gz') as ArrayBuffer
    const file = JSON.parse(gunzipSync(Buffer.from(gz)).toString('utf8')) as BackupFile
    expect(file.format).toBe('ds-hub-d1-backup')

    const saved = JSON.parse(r2.store.get(STATUS_KEY) as string) as BackupStatus
    expect(saved.ok).toBe(true)
  })

  it('não refaz se o backup do dia já existe, nem roda antes do horário', async () => {
    const r2 = fakeR2()
    r2.store.set('d1/2026-09-28.json.gz', 'já feito')
    const env = { DB: fakeD1(seed()), BACKUPS: r2 as unknown as R2Bucket }
    expect(await runBackup(env, NOW)).toBeNull()
    expect(await runBackup(env, new Date('2026-09-29T03:00:00Z'))).toBeNull()
  })

  it('falha fica registrada no status e NÃO apaga backups antigos', async () => {
    const r2 = fakeR2({ failPut: true })
    r2.store.set('d1/2026-08-01.json.gz', 'velho')

    const status = await runBackup({ DB: fakeD1(seed()), BACKUPS: r2 as unknown as R2Bucket }, NOW)

    expect(status).toMatchObject({ ok: false, error: 'R2 fora do ar' })
    expect(r2.store.has('d1/2026-08-01.json.gz')).toBe(true)
    expect(JSON.parse(r2.store.get(STATUS_KEY) as string).ok).toBe(false)
  })
})
