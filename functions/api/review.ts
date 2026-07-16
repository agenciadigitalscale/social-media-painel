import { dispatchNotification } from './notifications'

interface Env {
  DB:                 D1Database
  VAPID_PRIVATE_KEY?: string
  VAPID_PUBLIC_KEY?:  string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

async function ensureTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS app_data (
      key     TEXT PRIMARY KEY,
      value   TEXT NOT NULL DEFAULT '{}',
      updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run()
}

async function getKey(db: D1Database, key: string): Promise<unknown> {
  const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(key).first<{ value: string }>()
  return row ? JSON.parse(row.value) : null
}

async function setKey(db: D1Database, key: string, value: unknown): Promise<void> {
  await db.prepare(`
    INSERT INTO app_data (key, value) VALUES (?1, ?2)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = CURRENT_TIMESTAMP
  `).bind(key, JSON.stringify(value)).run()
}

interface ReviewEntry {
  approved: boolean
  text:     string
  reviewer: string
  date:     string
}

type TokenMap  = Record<string, string>       // itemId → token
type ReviewMap = Record<string, ReviewEntry>  // itemId → decisão

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx

  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    await ensureTable(env.DB)
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }

  // GET /api/review?token=TOKEN&itemId=123 — valida o link e devolve a decisão já tomada
  if (request.method === 'GET') {
    const url    = new URL(request.url)
    const token  = url.searchParams.get('token')
    const itemId = url.searchParams.get('itemId')
    if (!token || !itemId) return json({ ok: false, error: 'Missing token or itemId' }, 400)

    const tokens = (await getKey(env.DB, 'sm_review_tokens') ?? {}) as TokenMap
    if (tokens[itemId] !== token) return json({ ok: false, error: 'Invalid token' }, 404)

    const reviews = (await getKey(env.DB, 'sm_review_feedback') ?? {}) as ReviewMap
    return json({ ok: true, review: reviews[itemId] ?? null })
  }

  if (request.method === 'POST') {
    let body: { action: string; itemId?: number; token?: string; approved?: boolean; text?: string; reviewer?: string }
    try {
      body = await request.json()
    } catch {
      return json({ ok: false, error: 'Invalid JSON' }, 400)
    }

    // Gera (ou reaproveita) o token de revisão interna de um item
    if (body.action === 'generate') {
      if (body.itemId === undefined) return json({ ok: false, error: 'Missing itemId' }, 400)

      const tokens = (await getKey(env.DB, 'sm_review_tokens') ?? {}) as TokenMap
      let token = tokens[String(body.itemId)]
      if (!token) {
        token = crypto.randomUUID()
        tokens[String(body.itemId)] = token
        await setKey(env.DB, 'sm_review_tokens', tokens)
      }
      return json({ ok: true, token })
    }

    // Decisão da revisão interna: aprovado → 3 (Pronto p/ enviar), reprovado → 1 (Em produção)
    if (body.action === 'decide') {
      if (!body.token || body.itemId === undefined || body.approved === undefined) {
        return json({ ok: false, error: 'Missing fields' }, 400)
      }
      const itemKey = String(body.itemId)
      const tokens  = (await getKey(env.DB, 'sm_review_tokens') ?? {}) as TokenMap
      if (tokens[itemKey] !== body.token) return json({ ok: false, error: 'Invalid token' }, 403)

      const reviewer = (body.reviewer ?? '').trim() || 'Equipe'
      const entry: ReviewEntry = {
        approved: body.approved,
        text:     body.text ?? '',
        reviewer,
        date:     new Date().toISOString(),
      }

      const reviews = (await getKey(env.DB, 'sm_review_feedback') ?? {}) as ReviewMap
      reviews[itemKey] = entry
      await setKey(env.DB, 'sm_review_feedback', reviews)

      const allStates = (await getKey(env.DB, 'sm_states') ?? {}) as Record<string, Record<string, unknown>>
      if (!allStates[itemKey]) {
        allStates[itemKey] = { status: 0, title: '', link: '', caption: '', notes: '' }
      }
      const state = allStates[itemKey]
      state.status = body.approved ? 3 : 1
      if (!body.approved && body.text) {
        state.rejectionText = body.text
      } else {
        delete state.rejectionText
      }
      const history = Array.isArray(state.history) ? state.history as unknown[] : []
      history.push({
        user:   reviewer,
        action: body.approved ? 'Aprovado na revisão interna' : `Ajuste pedido na revisão interna: ${body.text ?? ''}`.trim(),
        ts:     Date.now(),
      })
      state.history = history
      await setKey(env.DB, 'sm_states', allStates)

      const itemTitle = String(state.title || `Item ${body.itemId}`)
      await dispatchNotification(env, {
        id:         crypto.randomUUID(),
        type:       body.approved ? 'review_ok' : 'review_fix',
        clientName: reviewer,
        itemId:     body.itemId,
        itemTitle,
        ts:         Date.now(),
      })

      return json({ ok: true })
    }
  }

  return json({ ok: false, error: 'Method not allowed' }, 405)
}
