import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { onRequest } from '../drive-scan'

/**
 * A detecção do scan. O caso que estes testes trancam é o que sumia em silêncio:
 * arquivo que ENTRA na pasta com data de criação antiga (movido de outra pasta,
 * restaurado da lixeira, subido preservando o carimbo) ficava fora da janela de
 * `createdTime` e nunca era detectado — estava lá, e o painel jurava que não.
 */

interface Row { key: string; value: string }

function makeDB(presence: Record<string, number> | null, folders: Array<{ client_name: string; folder_id: string }>) {
  const store = new Map<string, string>()
  if (presence) store.set('_drive_presence', JSON.stringify(presence))
  const inserted: string[] = []

  const db = {
    inserted,
    store,
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes('FROM app_data')) {
                const v = store.get(String(params[0]))
                return (v ? { key: params[0], value: v } : undefined) as T
              }
              return undefined as T
            },
            async run() {
              if (sql.includes('INSERT OR IGNORE INTO drive_videos')) {
                const id = String(params[0])
                if (inserted.includes(id)) return { meta: { changes: 0 } }
                inserted.push(id)
                return { meta: { changes: 1 } }
              }
              if (sql.includes('INSERT INTO app_data')) {
                store.set(String(params[0]), String(params[1]))
              }
              return { meta: { changes: 1 } }
            },
            async all() { return { results: [] } },
          }
        },
        async run() { return { meta: { changes: 0 } } },
        async first<T>() { return undefined as T },
        async all<T>() {
          if (sql.includes('FROM drive_folders')) return { results: folders as T[] }
          return { results: [] as T[] }
        },
      }
    },
  }
  return db
}

const ctx = (db: unknown) => ({
  request: new Request('https://localhost/api/drive-scan', {
    method: 'POST',
    headers: { 'X-App-Manual': '1' },
  }),
  env: { DB: db, GOOGLE_SA_KEY: 'x' } as any,
  waitUntil: vi.fn() as unknown as (p: Promise<unknown>) => void,
})

/**
 * O mock HONRA o `createdTime >= ...` que vier no `q`, como o Drive faz. Sem
 * isso o teste passaria também na implementação antiga — que filtrava por data
 * no servidor — e não trancaria regressão nenhuma.
 */
function mockDrive(files: Array<{ id: string; name: string; createdTime: string }>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const href = String(url)
    if (!href.includes('googleapis.com/drive')) return new Response('{}', { status: 200 })
    const q = new URL(href).searchParams.get('q') ?? ''
    const cutoff = q.match(/createdTime >= '([^']+)'/)?.[1]
    const visible = cutoff
      ? files.filter(f => Date.parse(f.createdTime) >= Date.parse(cutoff))
      : files
    return new Response(JSON.stringify({ files: visible }), { status: 200 })
  }))
}

vi.mock('../_lib/google-auth', () => ({ getAccessToken: async () => 'token' }))
vi.mock('../_lib/schema-guard', () => ({ ensureColumn: async () => {} }))
vi.mock('../notifications', () => ({ dispatchNotification: async () => {} }))

describe('drive-scan — detecção por presença', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-31T12:00:00Z')) })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  const FOLDERS = [{ client_name: 'Lareiras Grill', folder_id: 'FOLDER1' }]

  it('detecta arquivo que ENTROU na pasta mesmo com createdTime antigo', async () => {
    // A pasta já foi varrida antes (tem presença) e conhecia só o ANTIGO.
    const db = makeDB({ 'Lareiras Grill::ANTIGO': 1_700_000_000 }, FOLDERS)
    mockDrive([
      { id: 'ANTIGO', name: 'velho.mp4', createdTime: '2026-01-01T10:00:00Z' },
      // Criado meses atrás, mas só agora entrou na pasta Publicar.
      { id: 'MOVIDO', name: 'Lareiras Grill - Dia dos Pais [05NX].mp4', createdTime: '2026-03-02T10:00:00Z' },
    ])

    const res = await onRequest(ctx(db) as never)
    const body = await res.json() as { new_videos: number }

    expect(body.new_videos).toBe(1)
    expect(db.inserted).toEqual(['MOVIDO'])
  })

  it('não redetecta o que já estava na pasta na varredura anterior', async () => {
    const db = makeDB({
      'Lareiras Grill::A': 1_700_000_000,
      'Lareiras Grill::B': 1_700_000_000,
    }, FOLDERS)
    mockDrive([
      { id: 'A', name: 'a.mp4', createdTime: '2026-07-31T11:00:00Z' },
      { id: 'B', name: 'b.mp4', createdTime: '2026-07-31T11:30:00Z' },
    ])

    const res = await onRequest(ctx(db) as never)
    expect((await res.json() as { new_videos: number }).new_videos).toBe(0)
    expect(db.inserted).toEqual([])
  })

  it('primeira varredura da pasta só pega as últimas 48h — não despeja o histórico', async () => {
    const db = makeDB(null, FOLDERS)
    mockDrive([
      { id: 'RECENTE', name: 'hoje.mp4', createdTime: '2026-07-31T09:00:00Z' },
      { id: 'HISTORICO', name: 'ano-passado.mp4', createdTime: '2025-08-01T09:00:00Z' },
    ])

    const res = await onRequest(ctx(db) as never)
    expect(db.inserted).toEqual(['RECENTE'])
    expect((await res.json() as { new_videos: number }).new_videos).toBe(1)
  })

  it('grava a presença com a listagem inteira, inclusive o que não é novidade', async () => {
    const db = makeDB({ 'Lareiras Grill::A': 1_700_000_000 }, FOLDERS)
    mockDrive([
      { id: 'A', name: 'a.mp4', createdTime: '2026-07-31T09:00:00Z' },
      { id: 'NOVO', name: 'b.mp4', createdTime: '2026-07-31T11:00:00Z' },
    ])

    await onRequest(ctx(db) as never)
    const presence = JSON.parse(db.store.get('_drive_presence') ?? '{}') as Record<string, number>
    expect(Object.keys(presence).sort()).toEqual(['Lareiras Grill::A', 'Lareiras Grill::NOVO'])
  })
})
