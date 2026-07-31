import { getAccessToken } from './_lib/google-auth'
import { dispatchNotification } from './notifications'
import { ensureColumn } from './_lib/schema-guard'

interface Env {
  DB: D1Database
  GOOGLE_SA_KEY: string
  CRON_SECRET: string
  // Sem estas duas o aviso só entra na fila do D1 — nenhum celular apita.
  VAPID_PRIVATE_KEY?: string
  VAPID_PUBLIC_KEY?: string
}

interface DriveFolder {
  client_name:     string
  folder_id:       string
  last_scanned_at: number | null
}

interface DriveFile {
  id:            string
  name:          string
  size?:         string
  mimeType?:     string
  thumbnailLink?: string
  createdTime?:  string
}

/**
 * Vídeo **e** imagem. Design e Feed exportam criativo estático, e a coluna
 * Pronto já os aceitava pela listagem ao vivo do `/api/drive-files` — só o scan
 * continuava cego. O buraco não era estético: a presença (abaixo) é a prova de
 * que o arquivo continua na pasta, e o que ela não vê o painel trata como
 * removido. Imagem vinculada perdia a prévia na varredura seguinte.
 */
const MEDIA_FILTER = "(mimeType contains 'video/' or mimeType contains 'image/')"

interface DriveListResponse {
  nextPageToken?: string
  files:          DriveFile[]
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

const MANUAL_COOLDOWN_MS = 25_000 // detecção rápida sem sobrecarregar o Drive
const MANUAL_TS_KEY      = '_drive_scan_last_manual'
const PRESENCE_KEY       = '_drive_presence'
const HEALTH_KEY         = '_drive_scan_health'

/**
 * Registro de saúde da automação, lido pelo painel "Saúde da automação" via
 * `GET /api/sync?key=_drive_scan_health`. O merge preserva os campos que ESTE
 * run não tocou — em especial `lastCronAt`/`lastManualAt`/`lastError`, para o
 * painel distinguir "o cron parou" (provável 401 de CRON_SECRET) de "o último
 * scan manual deu certo".
 */
async function saveHealth(db: D1Database, patch: Record<string, unknown>): Promise<void> {
  let cur: Record<string, unknown> = {}
  try {
    const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(HEALTH_KEY).first<{ value: string }>()
    if (row?.value) cur = JSON.parse(row.value) as Record<string, unknown>
  } catch { /* valor ausente/corrompido: recomeça do patch */ }
  await db.prepare(`
    INSERT INTO app_data (key, value) VALUES (?1, ?2)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = CURRENT_TIMESTAMP
  `).bind(HEALTH_KEY, JSON.stringify({ ...cur, ...patch })).run()
}

/** Recusa registrada no máximo uma vez por minuto — é diagnóstico, não log. */
const CRON_REJECT_THROTTLE_MS = 60_000

/**
 * Carimba que ALGUÉM tentou se autenticar como cron e foi recusado.
 *
 * Sem isto o 401 voltava antes de qualquer escrita, e o painel só sabia dizer
 * "cron: nunca" — a mesma frase para dois problemas opostos: o worker não está
 * chamando, ou está chamando e o `CRON_SECRET` diverge entre os dois lados.
 * São correções diferentes, e a diferença custa este carimbo.
 */
async function noteCronRejected(db: D1Database, reason: string): Promise<void> {
  try {
    const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(HEALTH_KEY).first<{ value: string }>()
    const cur = row?.value ? JSON.parse(row.value) as Record<string, unknown> : {}
    const last = typeof cur.lastCronRejectedAt === 'number' ? cur.lastCronRejectedAt : 0
    const now = Date.now()
    if (now - last < CRON_REJECT_THROTTLE_MS) return
    await db.prepare(`
      INSERT INTO app_data (key, value) VALUES (?1, ?2)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = CURRENT_TIMESTAMP
    `).bind(HEALTH_KEY, JSON.stringify({ ...cur, lastCronRejectedAt: now, cronRejectReason: reason })).run()
  } catch { /* diagnóstico nunca derruba a resposta */ }
}

async function loadPresence(db: D1Database): Promise<Record<string, number>> {
  const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(PRESENCE_KEY).first<{ value: string }>()
  if (!row?.value) return {}
  try {
    const parsed = JSON.parse(row.value) as Record<string, number>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function savePresence(db: D1Database, presence: Record<string, number>): Promise<void> {
  await db.prepare(`
    INSERT INTO app_data (key, value) VALUES (?1, ?2)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = CURRENT_TIMESTAMP
  `).bind(PRESENCE_KEY, JSON.stringify(presence)).run()
}

/**
 * TODOS os arquivos de mídia que estão na pasta agora, com metadados.
 *
 * É a única listagem do scan — serve de uma vez para detectar o que chegou e
 * para registrar a presença. Antes eram duas requisições por cliente: uma
 * filtrada por `createdTime` (para achar novidade) e esta, só com os IDs.
 *
 * A filtrada por data era um buraco silencioso: `createdTime` é quando o arquivo
 * NASCEU, não quando entrou na pasta. Arquivo movido de outra pasta, restaurado
 * da lixeira ou subido preservando o carimbo original entrava com data velha,
 * ficava fora da janela e **nunca mais era detectado** — estava lá, visível para
 * qualquer humano, e o painel jurava que a pasta não tinha novidade.
 */
async function listFolderFiles(
  folderId: string,
  accessToken: string,
): Promise<{ ok: true; files: DriveFile[] } | { ok: false; error: string }> {
  const files: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and ${MEDIA_FILTER} and trashed = false`,
      fields: 'nextPageToken,files(id,name,size,mimeType,thumbnailLink,createdTime)',
      pageSize: '1000',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `Drive API ${res.status}: ${text.slice(0, 200)}` }
    }

    const data = await res.json<DriveListResponse>()
    for (const f of data.files) files.push(f)
    pageToken = data.nextPageToken
  } while (pageToken)

  return { ok: true, files }
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const auth     = request.headers.get('Authorization') ?? ''
  const isManual = request.headers.get('X-App-Manual') === '1'
  const isCron   = env.CRON_SECRET && auth === `Bearer ${env.CRON_SECRET}`

  if (!isCron && !isManual) {
    const message = auth
      ? 'Cron auth inválido. Verifique CRON_SECRET no worker e no Pages.'
      : 'Unauthorized'
    // Só quem chega com Bearer está tentando ser o cron. Requisição anônima não
    // vira escrita: o endpoint é público e isso seria porta para inundar o D1.
    if (auth.startsWith('Bearer ')) {
      await noteCronRejected(env.DB, env.CRON_SECRET
        ? 'CRON_SECRET diferente entre o worker e o Pages'
        : 'CRON_SECRET ausente no Pages')
    }
    return new Response(JSON.stringify({ error: message }), { status: 401, headers: CORS })
  }

  // Rate limit: scans manuais respeitam cooldown de 90s
  if (isManual) {
    const row = await env.DB.prepare('SELECT value FROM app_data WHERE key = ?').bind(MANUAL_TS_KEY).first<{ value: string }>()
    const lastTs = row ? parseInt(row.value, 10) : 0
    const remaining = Math.ceil((MANUAL_COOLDOWN_MS - (Date.now() - lastTs)) / 1000)
    if (remaining > 0) {
      return new Response(JSON.stringify({ error: 'rate_limited', remaining }), { status: 429, headers: CORS })
    }
    await env.DB.prepare(`
      INSERT INTO app_data (key, value) VALUES (?1, ?2)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = CURRENT_TIMESTAMP
    `).bind(MANUAL_TS_KEY, String(Date.now())).run()
  }

  // O mime é gravado logo abaixo: sem a coluna, o INSERT falha e o scan para de
  // registrar arquivo. Não depender da migração ter rodado antes do deploy.
  await ensureColumn(env.DB, 'drive_videos', 'mime_type', 'TEXT')

  const runSource = isCron ? 'cron' : 'manual'
  const runAt = Date.now()

  let accessToken: string
  try {
    accessToken = await getAccessToken(env)
  } catch (e) {
    const msg = (e as Error).message
    await saveHealth(env.DB, {
      lastRunAt: runAt, source: runSource, ok: false,
      [runSource === 'cron' ? 'lastCronAt' : 'lastManualAt']: runAt,
      lastError: { at: runAt, msg: `Auth (service account) falhou: ${msg}`.slice(0, 300) },
    }).catch(() => {})
    return new Response(JSON.stringify({ error: `Auth failed: ${msg}` }), { status: 500, headers: CORS })
  }

  const { results: folders } = await env.DB.prepare(
    'SELECT client_name, folder_id, last_scanned_at FROM drive_folders WHERE is_active = 1',
  ).all<DriveFolder>()

  /**
   * Só na PRIMEIRA varredura de uma pasta: sem presença anterior, "tudo que está
   * lá" seria novidade e a Inbox receberia o histórico inteiro do cliente de uma
   * vez. Nesse caso — e só nele — vale a data de criação como corte.
   */
  const FIRST_RUN_MS = 48 * 60 * 60 * 1000
  const nowSec       = Math.floor(Date.now() / 1000)

  const summary: Record<string, { new_videos: number; error?: string }> = {}

  // Presença: quem está AGORA na pasta Publicar de cada cliente. É o que permite
  // a prévia sumir do card quando o arquivo sai da pasta — a listagem por
  // createdTime abaixo só enxerga o que chega, nunca o que saiu.
  const presence: Record<string, number> = await loadPresence(env.DB)
  const reconciledClients = new Set<string>()

  for (const folder of folders) {
    const entry: { new_videos: number; error?: string } = { new_videos: 0 }
    summary[folder.client_name] = entry

    try {
      const prefix = `${folder.client_name}::`
      const previousIds = new Set<string>()
      for (const key of Object.keys(presence)) {
        if (key.startsWith(prefix)) previousIds.add(key.slice(prefix.length))
      }
      const firstRun = previousIds.size === 0
      const firstRunCutoff = Date.now() - FIRST_RUN_MS

      const listing = await listFolderFiles(folder.folder_id, accessToken)
      if (!listing.ok) {
        entry.error = listing.error
        continue
      }

      /**
       * Chegou agora = está na pasta e não estava na varredura anterior. Sem
       * carimbo de data no meio: quem entra na pasta é detectado, tenha o
       * arquivo sido criado hoje ou no ano passado.
       */
      const chegouAgora = (file: DriveFile): boolean => {
        if (!firstRun) return !previousIds.has(file.id)
        const created = file.createdTime ? Date.parse(file.createdTime) : NaN
        return Number.isFinite(created) && created >= firstRunCutoff
      }

      for (const file of listing.files) {
        if (!chegouAgora(file)) continue
        const result = await env.DB.prepare(`
          INSERT OR IGNORE INTO drive_videos
            (drive_file_id, client_name, filename, file_size_bytes, thumbnail_url,
             mime_type, status, detected_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'inbox', unixepoch(), unixepoch(), unixepoch())
        `).bind(
          file.id,
          folder.client_name,
          file.name,
          file.size ? parseInt(file.size, 10) : null,
          file.thumbnailLink ?? null,
          file.mimeType ?? null,
        ).run()

        if (result.meta.changes > 0) entry.new_videos++
      }

      // A mesma listagem vira a presença — a prova de que o arquivo continua na
      // pasta, e o que permite a prévia cair quando ele sai de lá.
      reconciledClients.add(folder.client_name)
      for (const key of Object.keys(presence)) {
        if (key.startsWith(prefix)) delete presence[key]
      }
      for (const file of listing.files) presence[`${prefix}${file.id}`] = nowSec

      await env.DB.prepare(`
        UPDATE drive_folders
        SET last_scanned_at = unixepoch(), updated_at = unixepoch()
        WHERE client_name = ?
      `).bind(folder.client_name).run()

    } catch (e) {
      entry.error = (e as Error).message
    }
  }

  if (reconciledClients.size > 0) await savePresence(env.DB, presence)

  const totalNew = Object.values(summary).reduce((s, v) => s + v.new_videos, 0)

  // Notifica a equipe quando novos vídeos são detectados. Passa o `env` inteiro:
  // com só o DB o aviso ficava preso na fila, e era justamente o push que faz o
  // celular apitar quando ninguém está com o painel aberto.
  if (totalNew > 0) {
    const clients = Object.entries(summary)
      .filter(([, v]) => v.new_videos > 0)
      .map(([c]) => c)
      .join(', ')
    await dispatchNotification(env, {
      id:         crypto.randomUUID(),
      type:       'new_video',
      clientName: clients,
      itemId:     0,
      itemTitle:  `${totalNew} arquivo${totalNew > 1 ? 's' : ''} novo${totalNew > 1 ? 's' : ''} na pasta Publicar`,
      ts:         Date.now(),
    })
  }

  const failed = Object.entries(summary).filter(([, v]) => v.error)
  await saveHealth(env.DB, {
    lastRunAt: runAt,
    source: runSource,
    ok: failed.length === 0,
    scanned: folders.length,
    newVideos: totalNew,
    [runSource === 'cron' ? 'lastCronAt' : 'lastManualAt']: runAt,
    // Só carimba erro quando houve erro — assim um scan limpo não apaga o rastro
    // do último problema (permissão revogada, pasta sumida) que o painel mostra.
    ...(failed.length > 0
      ? { lastError: { at: runAt, msg: failed.map(([c, v]) => `${c}: ${v.error}`).join(' · ').slice(0, 300) } }
      : {}),
  }).catch(() => {})

  return new Response(JSON.stringify({
    ok: failed.length === 0,
    scanned: folders.length,
    new_videos: totalNew,
    summary,
  }), { headers: CORS })
}
