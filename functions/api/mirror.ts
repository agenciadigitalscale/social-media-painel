// Cópia do criativo para o nosso storage (R2).
//
// Duas coisas mudam quando o arquivo está espelhado:
//  1. O cliente assiste da Cloudflare, não do Drive — o Google sai do caminho
//     crítico de cada exibição.
//  2. O link para de depender de o arquivo continuar na pasta Publicar. Hoje,
//     alguém arrastar o vídeo para outra pasta (ou apagar) mata o link do
//     cliente sem nenhum aviso.
//
// Roda quando a esteira vincula um arquivo. Idempotente: se já existe, não faz
// nada. Não é caminho crítico de ninguém — falhar aqui só significa continuar
// servindo do Drive, que é o comportamento de antes.

import { getAccessToken } from './_lib/google-auth'
import { ensureColumn } from './_lib/schema-guard'
import {
  diagnosticar, enviarParaStream, estadoDoStream, streamDisponivel, valeTranscodificar,
  type StreamEnv,
} from './_lib/stream-video'
import { mirrorKey } from './stream'
import { itemsWithStatus } from './_lib/appdata'

interface Env extends StreamEnv {
  DB: D1Database
  GOOGLE_SA_KEY?: string
  CRIATIVOS?: R2Bucket
  CRON_SECRET?: string
}

/**
 * Faxina do espelho: criativo publicado há mais de 30 dias não vai ser reaberto
 * por cliente nenhum, e ocupar 10 GB de graça é o que separa o espelho de virar
 * depósito. Medido em 2026-07-22: dos 132 arquivos vinculados, 91 já estavam
 * publicados — a limpeza é o que mantém a conta em pé.
 */
const KEEP_AFTER_PUBLISH_MS = 30 * 24 * 60 * 60 * 1000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/** Vídeo de 15s em 4K passa longe disto; acima é sinal de arquivo errado. */
export const MAX_BYTES = 600 * 1024 * 1024

/** Status "está com o cliente": 4 enviado, 5 aprovado. */
const WITH_CLIENT = [4, 5]

/**
 * Teto de arquivos conferidos numa checagem. Cada um custa um `head` no R2;
 * uma fila normal tem dezenas, mas um dia ruim (alguém reenviando o mês todo)
 * não pode virar centenas de operações numa requisição.
 */
const COVERAGE_LIMIT = 80

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

interface StateRow { status?: number; publishedAt?: number }

/**
 * Apaga do espelho o que já cumpriu seu papel. Regra conservadora de propósito:
 * só sai o que a gente SABE que está publicado e velho. Na dúvida — arquivo sem
 * vínculo, status desconhecido, data ausente — fica. Apagar por engano tira o
 * criativo do ar para o cliente; deixar sobrando custa centavos.
 */
async function sweep(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get('Authorization') ?? ''
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return json({ ok: false, error: 'Unauthorized' }, 401)
  }
  if (!env.CRIATIVOS) return json({ ok: false, error: 'Sem espelho configurado' }, 501)

  const statesRow = await env.DB.prepare('SELECT value FROM app_data WHERE key = ?')
    .bind('sm_states').first<{ value: string }>()
  const states = statesRow ? JSON.parse(statesRow.value) as Record<string, StateRow> : {}

  const { results } = await env.DB.prepare(
    'SELECT drive_file_id, linked_item_id, updated_at FROM drive_videos WHERE linked_item_id IS NOT NULL',
  ).all<{ drive_file_id: string; linked_item_id: number; updated_at: number | null }>()

  const now = Date.now()
  const removed: string[] = []

  for (const row of results) {
    const state = states[String(row.linked_item_id)]
    if (!state || state.status !== 7) continue

    // `publishedAt` é a data boa; sem ela, a última atualização da linha serve de
    // piso — nunca apaga algo mexido recentemente.
    const referenceMs = state.publishedAt ?? (row.updated_at ? row.updated_at * 1000 : null)
    if (!referenceMs || now - referenceMs < KEEP_AFTER_PUBLISH_MS) continue

    const key = mirrorKey(row.drive_file_id)
    if (!(await env.CRIATIVOS.head(key))) continue
    await env.CRIATIVOS.delete(key)
    removed.push(row.drive_file_id)
  }

  return json({ ok: true, swept: removed.length, removed })
}

export interface CoverageFile {
  fileId: string
  itemId: number
  client: string
  filename: string
  bytes: number | null
  mirrored: boolean
  /** Acima do teto: nunca vai ser espelhado, e insistir só gasta banda. */
  tooBig: boolean
}

/**
 * Quantos criativos que estão com o cliente AGORA saem do nosso espelho.
 *
 * Sem este número o espelho é fé: ele pode estar falhando por quota do R2, por
 * arquivo grande demais ou porque o `warmMirror` não pegou — e as três falhas
 * são silenciosas. A que mais dói é a terceira consequência: enquanto o arquivo
 * não está espelhado, o link do cliente continua dependendo de o vídeo seguir
 * na pasta Publicar. Alguém mover a pasta e o link morre sem aviso.
 *
 * Só olha o que a agência já rastreia (`drive_videos`), que é exatamente o
 * universo que o `/api/mirror` aceita copiar.
 */
async function coverage(env: Env): Promise<Response> {
  if (!env.CRIATIVOS) {
    return json({ ok: false, error: 'Sem espelho configurado', configured: false }, 200)
  }

  const itemIds = await itemsWithStatus(env.DB, WITH_CLIENT)
  if (itemIds.length === 0) {
    return json({ ok: true, configured: true, total: 0, mirrored: 0, files: [] })
  }

  const holes = itemIds.slice(0, COVERAGE_LIMIT * 4).map((_, n) => `?${n + 1}`).join(',')
  const { results } = await env.DB.prepare(`
    SELECT drive_file_id, linked_item_id, client_name, filename, file_size_bytes
      FROM drive_videos
     WHERE linked_item_id IN (${holes})
     ORDER BY updated_at DESC
     LIMIT ${COVERAGE_LIMIT}
  `).bind(...itemIds.slice(0, COVERAGE_LIMIT * 4)).all<{
    drive_file_id: string
    linked_item_id: number
    client_name: string
    filename: string
    file_size_bytes: number | null
  }>()

  const files: CoverageFile[] = []
  for (const row of results ?? []) {
    const bytes = row.file_size_bytes
    let mirrored = false
    try {
      mirrored = !!(await env.CRIATIVOS.head(mirrorKey(row.drive_file_id)))
    } catch {
      // Não conseguir perguntar ao R2 não é o mesmo que "não está lá". Marcar
      // como espelhado esconderia o problema; marcar como faltando gera um
      // "Espelhar agora" que também vai falhar — e é o comportamento honesto.
      mirrored = false
    }
    files.push({
      fileId:   row.drive_file_id,
      itemId:   row.linked_item_id,
      client:   row.client_name,
      filename: row.filename,
      bytes,
      mirrored,
      tooBig:   !!bytes && bytes > MAX_BYTES,
    })
  }

  return json({
    ok: true,
    configured: true,
    total: files.length,
    mirrored: files.filter(f => f.mirrored).length,
    files,
  })
}

/**
 * Manda o vídeo para o Cloudflare Stream depois que ele já está no espelho.
 *
 * FALHA ABERTA, e isso é o ponto: se o Stream não responder, o vídeo continua
 * sendo servido do R2 como sempre foi. A transcodificação melhora a entrega
 * (versões mais leves quando a conexão cai, e HLS em vez do contêiner original
 * — que resolve o .mov recusado pelo Android); ela não é pré-requisito de
 * nada. Um erro aqui nunca pode impedir o espelho de funcionar.
 */
async function mandarParaStream(env: Env, fileId: string, origem: string): Promise<void> {
  if (!streamDisponivel(env)) return
  try {
    /* As colunas nascem ANTES da primeira leitura, e a ordem importa: o
       `SELECT stream_uid` numa tabela sem a coluna lança, o `catch` lá embaixo
       engoliria, e a coluna nunca seria criada — ficaria quebrado para sempre
       e em silêncio. Deploy do Pages e migração do D1 são atos separados. */
    await ensureColumn(env.DB, 'drive_videos', 'stream_uid', 'TEXT')
    await ensureColumn(env.DB, 'drive_videos', 'stream_status', 'TEXT')

    const reg = await env.DB.prepare(
      'SELECT filename, mime_type, file_size_bytes, stream_uid, stream_status FROM drive_videos WHERE drive_file_id = ? LIMIT 1',
    ).bind(fileId).first<{
      filename?: string; mime_type?: string; file_size_bytes?: number
      stream_uid?: string; stream_status?: string
    }>()
    if (!reg) return

    /* Já tem UID: não manda de novo (gastaria minuto à toa), mas ATUALIZA o
       estado se ainda não terminou.

       Sem isto o registro ficava preso em `inprogress` para sempre — o envio
       responde antes de a transcodificação acabar, e nada mais voltava a
       perguntar. O portal só entrega o player quando o estado é `ready`, então
       o vídeo transcodificava e ninguém usava. */
    if (reg.stream_uid) {
      if (reg.stream_status === 'ready' || String(reg.stream_status ?? '').startsWith('erro')) return
      const atual = await estadoDoStream(env, reg.stream_uid)
      if (!atual.ok) return
      await env.DB.prepare('UPDATE drive_videos SET stream_status = ? WHERE drive_file_id = ?')
        .bind(atual.estado ?? 'inprogress', fileId).run()
      return
    }
    if (!valeTranscodificar(reg.mime_type, reg.filename ?? '', reg.file_size_bytes ?? 0)) return

    const r = await enviarParaStream(env, fileId, origem, reg.filename)
    // Falhou: sonda a API para separar "token/assinatura" de "payload recusado".
    // Sem isso, um 400 manda mexer no corpo quando o problema é a conta.
    const detalhe = r.ok ? "" : ` | ${await diagnosticar(env)}`
    await env.DB.prepare(
      'UPDATE drive_videos SET stream_uid = ?, stream_status = ? WHERE drive_file_id = ?',
    ).bind(r.uid ?? null, r.ok ? (r.estado ?? 'inprogress') : `erro: ${r.erro ?? '?'}${detalhe}`, fileId).run()
  } catch {
    /* medir e transcodificar nunca derrubam o espelho */
  }
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method === 'GET') return coverage(env)
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)
  if (!env.CRIATIVOS) return json({ ok: false, error: 'Sem espelho configurado' }, 501)

  let body: { fileId?: string; action?: string }
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  if (body.action === 'sweep') return sweep(request, env)

  const fileId = body.fileId?.replace(/^drive:/, '')
  if (!fileId || !/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
    return json({ ok: false, error: 'fileId inválido' }, 400)
  }

  // Só espelha arquivo que a agência já rastreia. O endpoint é público como
  // todos os outros aqui; sem esta trava, qualquer um mandaria a gente copiar
  // qualquer arquivo que a service account enxergue, e pagar o armazenamento.
  const known = await env.DB.prepare(
    'SELECT 1 FROM drive_videos WHERE drive_file_id = ? LIMIT 1',
  ).bind(fileId).first()
  if (!known) return json({ ok: false, error: 'Arquivo desconhecido' }, 404)

  const key = mirrorKey(fileId)
  const existing = await env.CRIATIVOS.head(key)
  if (existing) {
    // Já espelhado antes de o Stream existir: aproveita a passagem para
    // mandar transcodificar. Sem isso, só vídeo novo ganharia o player leve.
    ctx.waitUntil(mandarParaStream(env, fileId, new URL(request.url).origin))
    return json({ ok: true, mirrored: true, cached: true, size: existing.size })
  }

  if (!env.GOOGLE_SA_KEY) return json({ ok: false, error: 'Sem credencial do Drive' }, 501)

  let token: string
  try {
    token = await getAccessToken({ DB: env.DB, GOOGLE_SA_KEY: env.GOOGLE_SA_KEY })
  } catch (e) {
    return json({ ok: false, error: `Auth: ${(e as Error).message}` }, 502)
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok || !res.body) {
    try { res.body?.cancel() } catch { /* corpo já consumido */ }
    return json({ ok: false, error: `Drive ${res.status}` }, 502)
  }

  const declared = Number(res.headers.get('Content-Length') ?? 0)
  if (declared > MAX_BYTES) {
    try { res.body.cancel() } catch { /* corpo já consumido */ }
    return json({ ok: false, error: 'Arquivo grande demais para espelhar' }, 413)
  }

  try {
    await env.CRIATIVOS.put(key, res.body, {
      httpMetadata: {
        contentType: res.headers.get('Content-Type') ?? 'application/octet-stream',
        cacheControl: 'public, max-age=86400',
      },
    })
  } catch (e) {
    return json({ ok: false, error: `R2: ${(e as Error).message}` }, 502)
  }

  // Depois do espelho, e sem segurar a resposta: quem chamou não precisa
  // esperar o Cloudflare buscar 87 MB.
  ctx.waitUntil(mandarParaStream(env, fileId, new URL(request.url).origin))

  return json({ ok: true, mirrored: true, cached: false, size: declared || null })
}
