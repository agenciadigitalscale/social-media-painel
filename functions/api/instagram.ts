/* functions/api/instagram.ts
   Proxy para Meta Graph API — publicação e agendamento no Instagram

   Endpoints:
   POST { action:'setup',   clientName, igUserId, accessToken }   → salva token no D1
   GET  { action:'tokens',  clientName }                          → retorna config salva
   POST { action:'schedule',clientName,itemId,scheduledAt,
          imageUrl,caption,mediaType }                            → agenda post no D1
   GET  { action:'pending' }                                      → posts pendentes (para cron client-side)
   POST { action:'publish', scheduleId }                         → publica agora no Instagram
   POST { action:'cancel',  scheduleId }                         → cancela agendamento
   GET  { action:'list',    clientName? }                        → lista agendamentos
*/

interface Env {
  DB: D1Database
}

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

function err(msg: string, status = 400) {
  return json({ ok: false, error: msg }, status)
}

// ── Extrai file ID do Google Drive de um link qualquer ────────────
function extractDriveId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)\//,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

// Converte link Google Drive → URL pública direta (funciona se arquivo for público)
function driveToPublic(url: string): string {
  const id = extractDriveId(url)
  if (id) return `https://drive.google.com/uc?export=view&id=${id}`
  return url
}

// ── Verifica se token é válido consultando /me ────────────────────
async function verifyToken(igUserId: string, token: string): Promise<{ ok: boolean; name?: string; error?: string }> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}?fields=username,name&access_token=${token}`
  )
  const data = await res.json() as { username?: string; name?: string; error?: { message: string } }
  if (data.error) return { ok: false, error: data.error.message }
  return { ok: true, name: data.username || data.name }
}

// ── Publica imagem no Instagram (IMAGE ou REELS) ─────────────────
async function publishToInstagram(
  igUserId: string,
  token: string,
  imageUrl: string,
  caption: string,
  mediaType: 'IMAGE' | 'REELS'
): Promise<{ ok: boolean; postId?: string; error?: string }> {
  const base = `https://graph.facebook.com/v19.0/${igUserId}`

  // 1. Criar container de mídia
  const containerBody: Record<string, string> = { access_token: token, caption }

  if (mediaType === 'REELS') {
    containerBody.media_type = 'REELS'
    containerBody.video_url  = imageUrl
    containerBody.share_to_feed = 'true'
  } else {
    containerBody.image_url = imageUrl
  }

  const containerRes = await fetch(`${base}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(containerBody),
  })
  const containerData = await containerRes.json() as { id?: string; error?: { message: string } }
  if (containerData.error) return { ok: false, error: `Container: ${containerData.error.message}` }
  if (!containerData.id) return { ok: false, error: 'Instagram não retornou container ID' }

  const containerId = containerData.id

  // 2. Para Reels, aguardar processamento (até 30s)
  if (mediaType === 'REELS') {
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise(r => setTimeout(r, 5000))
      const statusRes = await fetch(
        `${base}?fields=status_code&access_token=${token}&media_container_id=${containerId}`
      )
      const statusData = await statusRes.json() as { status_code?: string }
      if (statusData.status_code === 'FINISHED') break
      if (statusData.status_code === 'ERROR') return { ok: false, error: 'Falha no processamento do vídeo' }
    }
  }

  // 3. Publicar
  const publishRes = await fetch(`${base}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: token }),
  })
  const publishData = await publishRes.json() as { id?: string; error?: { message: string } }
  if (publishData.error) return { ok: false, error: `Publicação: ${publishData.error.message}` }
  if (!publishData.id) return { ok: false, error: 'Instagram não confirmou a publicação' }

  return { ok: true, postId: publishData.id }
}

// ── Handler principal ────────────────────────────────────────────
export const onRequest = async (ctx: { request: Request; env: Env }) => {
  const { request, env } = ctx

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' } })
  }

  const url = new URL(request.url)
  const action = url.searchParams.get('action') ?? ''

  // ── GET ──────────────────────────────────────────────────────
  if (request.method === 'GET') {

    // Tokens salvos para um cliente
    if (action === 'tokens') {
      const clientName = url.searchParams.get('clientName') || ''
      if (!clientName) return err('clientName obrigatório')
      const row = await env.DB.prepare(
        `SELECT ig_user_id, display_name FROM ig_tokens WHERE client_name = ?`
      ).bind(clientName).first<{ ig_user_id: string; display_name: string }>()
      if (!row) return json({ ok: true, configured: false })
      return json({ ok: true, configured: true, igUserId: row.ig_user_id, displayName: row.display_name })
    }

    // Posts pendentes (para o polling client-side)
    if (action === 'pending') {
      const now = new Date().toISOString()
      const rows = await env.DB.prepare(
        `SELECT s.*, t.ig_user_id, t.access_token
         FROM ig_scheduled s
         JOIN ig_tokens t ON t.client_name = s.client_name
         WHERE s.status = 'pending' AND s.scheduled_at <= ?
         ORDER BY s.scheduled_at ASC
         LIMIT 10`
      ).bind(now).all<{
        id: string; client_name: string; item_id: number; scheduled_at: string
        image_url: string; caption: string; media_type: string
        ig_user_id: string; access_token: string
      }>()
      return json({ ok: true, pending: rows.results })
    }

    // Listar agendamentos
    if (action === 'list') {
      const clientName = url.searchParams.get('clientName') || ''
      const q = clientName
        ? `SELECT id,client_name,item_id,scheduled_at,media_type,status,error,published_at FROM ig_scheduled WHERE client_name = ? ORDER BY scheduled_at DESC LIMIT 100`
        : `SELECT id,client_name,item_id,scheduled_at,media_type,status,error,published_at FROM ig_scheduled ORDER BY scheduled_at DESC LIMIT 100`
      const rows = clientName
        ? await env.DB.prepare(q).bind(clientName).all()
        : await env.DB.prepare(q).all()
      return json({ ok: true, schedules: rows.results })
    }

    return err('Ação GET inválida. Use: tokens, pending, list', 400)
  }

  // ── POST ─────────────────────────────────────────────────────
  if (request.method === 'POST') {
    let body: Record<string, unknown>
    try { body = await request.json() as Record<string, unknown> }
    catch { return err('Body JSON inválido') }

    const act = (body.action as string) || action

    // ── Salvar token de um cliente ────────────────────────────
    if (act === 'setup') {
      const { clientName, igUserId, accessToken } = body as {
        clientName?: string; igUserId?: string; accessToken?: string
      }
      if (!clientName || !igUserId || !accessToken)
        return err('clientName, igUserId e accessToken são obrigatórios')

      // Verifica token antes de salvar
      const check = await verifyToken(igUserId, accessToken)
      if (!check.ok) return err(`Token inválido: ${check.error}`)

      await env.DB.prepare(`
        INSERT INTO ig_tokens (client_name, ig_user_id, access_token, display_name, updated)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT (client_name) DO UPDATE SET
          ig_user_id = excluded.ig_user_id,
          access_token = excluded.access_token,
          display_name = excluded.display_name,
          updated = CURRENT_TIMESTAMP
      `).bind(clientName, igUserId, accessToken, check.name ?? clientName).run()

      return json({ ok: true, message: `Token configurado para ${clientName} (${check.name})` })
    }

    // ── Agendar post ──────────────────────────────────────────
    if (act === 'schedule') {
      const { clientName, itemId, scheduledAt, imageUrl, caption, mediaType } = body as {
        clientName?: string; itemId?: number; scheduledAt?: string
        imageUrl?: string; caption?: string; mediaType?: string
      }
      if (!clientName || !itemId || !scheduledAt || !imageUrl)
        return err('clientName, itemId, scheduledAt e imageUrl são obrigatórios')

      // Verifica se cliente tem token configurado
      const token = await env.DB.prepare(
        `SELECT ig_user_id FROM ig_tokens WHERE client_name = ?`
      ).bind(clientName).first<{ ig_user_id: string }>()
      if (!token) return err(`Instagram não configurado para ${clientName}. Configure o token primeiro.`)

      // Converte URL do Drive para URL pública se necessário
      const publicUrl = imageUrl.includes('drive.google.com')
        ? driveToPublic(imageUrl)
        : imageUrl

      const id = crypto.randomUUID()
      await env.DB.prepare(`
        INSERT INTO ig_scheduled (id, client_name, item_id, scheduled_at, image_url, caption, media_type, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
      `).bind(id, clientName, itemId, scheduledAt, publicUrl, caption ?? '', mediaType ?? 'IMAGE').run()

      return json({ ok: true, scheduleId: id, message: `Agendado para ${new Date(scheduledAt).toLocaleString('pt-BR')}` })
    }

    // ── Publicar agora ────────────────────────────────────────
    if (act === 'publish') {
      const { scheduleId } = body as { scheduleId?: string }
      if (!scheduleId) return err('scheduleId obrigatório')

      const row = await env.DB.prepare(`
        SELECT s.*, t.ig_user_id, t.access_token
        FROM ig_scheduled s
        JOIN ig_tokens t ON t.client_name = s.client_name
        WHERE s.id = ?
      `).bind(scheduleId).first<{
        id: string; client_name: string; item_id: number
        image_url: string; caption: string; media_type: string
        ig_user_id: string; access_token: string; status: string
      }>()

      if (!row) return err('Agendamento não encontrado')
      if (row.status === 'published') return err('Este post já foi publicado')
      if (row.status === 'cancelled') return err('Este agendamento foi cancelado')

      const result = await publishToInstagram(
        row.ig_user_id, row.access_token,
        row.image_url, row.caption,
        (row.media_type as 'IMAGE' | 'REELS')
      )

      if (!result.ok) {
        await env.DB.prepare(
          `UPDATE ig_scheduled SET status = 'failed', error = ? WHERE id = ?`
        ).bind(result.error, scheduleId).run()
        return json({ ok: false, error: result.error }, 502)
      }

      await env.DB.prepare(`
        UPDATE ig_scheduled SET status = 'published', published_at = CURRENT_TIMESTAMP, error = NULL
        WHERE id = ?
      `).bind(scheduleId).run()

      return json({ ok: true, postId: result.postId, itemId: row.item_id })
    }

    // ── Cancelar agendamento ─────────────────────────────────
    if (act === 'cancel') {
      const { scheduleId } = body as { scheduleId?: string }
      if (!scheduleId) return err('scheduleId obrigatório')
      await env.DB.prepare(
        `UPDATE ig_scheduled SET status = 'cancelled' WHERE id = ?`
      ).bind(scheduleId).run()
      return json({ ok: true })
    }

    return err('Ação POST inválida. Use: setup, schedule, publish, cancel')
  }

  return err('Método não suportado', 405)
}
