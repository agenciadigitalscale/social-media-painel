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
import { mirrorKey } from './stream'

interface Env {
  DB: D1Database
  GOOGLE_SA_KEY?: string
  CRIATIVOS?: R2Bucket
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/** Vídeo de 15s em 4K passa longe disto; acima é sinal de arquivo errado. */
const MAX_BYTES = 600 * 1024 * 1024

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)
  if (!env.CRIATIVOS) return json({ ok: false, error: 'Sem espelho configurado' }, 501)

  let body: { fileId?: string }
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

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
  if (existing) return json({ ok: true, mirrored: true, cached: true, size: existing.size })

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

  return json({ ok: true, mirrored: true, cached: false, size: declared || null })
}
