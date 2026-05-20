interface Env {
  DB: D1Database
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

interface FeedbackEntry {
  approved: boolean
  text: string
  date: string
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx

  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    await ensureTable(env.DB)
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }

  // GET /api/portal?token=TOKEN — valida token e retorna dados do cliente
  if (request.method === 'GET') {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    if (!token) return json({ ok: false, error: 'Missing token' }, 400)

    const tokens = (await getKey(env.DB, 'sm_portal_tokens') ?? {}) as Record<string, string>
    const clientName = Object.entries(tokens).find(([, t]) => t === token)?.[0]
    if (!clientName) return json({ ok: false, error: 'Invalid token' }, 404)

    const allFeedback = (await getKey(env.DB, 'sm_feedback') ?? {}) as Record<string, Record<string, FeedbackEntry>>
    return json({ ok: true, clientName, feedback: allFeedback[token] ?? {} })
  }

  if (request.method === 'POST') {
    let body: { action: string; clientName?: string; token?: string; itemId?: number; approved?: boolean; text?: string }
    try {
      body = await request.json()
    } catch {
      return json({ ok: false, error: 'Invalid JSON' }, 400)
    }

    // Gerar token para um cliente
    if (body.action === 'generate') {
      if (!body.clientName) return json({ ok: false, error: 'Missing clientName' }, 400)

      const tokens = (await getKey(env.DB, 'sm_portal_tokens') ?? {}) as Record<string, string>
      let token = tokens[body.clientName]
      if (!token) {
        token = crypto.randomUUID()
        tokens[body.clientName] = token
        await setKey(env.DB, 'sm_portal_tokens', tokens)
      }
      return json({ ok: true, token })
    }

    // Salvar feedback do cliente (aprovação/reprovação)
    if (body.action === 'feedback') {
      if (!body.token || body.itemId === undefined || body.approved === undefined) {
        return json({ ok: false, error: 'Missing fields' }, 400)
      }
      const tokens = (await getKey(env.DB, 'sm_portal_tokens') ?? {}) as Record<string, string>
      const clientName = Object.entries(tokens).find(([, t]) => t === body.token)?.[0]
      if (!clientName) return json({ ok: false, error: 'Invalid token' }, 403)

      const allFeedback = (await getKey(env.DB, 'sm_feedback') ?? {}) as Record<string, Record<string, FeedbackEntry>>
      if (!allFeedback[body.token!]) allFeedback[body.token!] = {}
      allFeedback[body.token!][String(body.itemId)] = {
        approved: body.approved,
        text: body.text ?? '',
        date: new Date().toISOString(),
      }
      await setKey(env.DB, 'sm_feedback', allFeedback)

      // Também persiste no app_data geral para o painel ver
      const appFeedback = (await getKey(env.DB, 'sm_client_feedback') ?? {}) as Record<string, Record<string, FeedbackEntry>>
      if (!appFeedback[clientName]) appFeedback[clientName] = {}
      appFeedback[clientName][String(body.itemId)] = {
        approved: body.approved,
        text: body.text ?? '',
        date: new Date().toISOString(),
      }
      await setKey(env.DB, 'sm_client_feedback', appFeedback)

      // Atualiza status do item no painel principal (v2: 5=Aprovado pelo cliente, 6=Reprovado pelo cliente)
      const allStates = (await getKey(env.DB, 'sm_states') ?? {}) as Record<string, Record<string, unknown>>
      if (!allStates[String(body.itemId)]) {
        allStates[String(body.itemId)] = { status: 0, title: '', link: '', caption: '', notes: '' }
      }
      allStates[String(body.itemId)].status = body.approved ? 5 : 6
      if (!body.approved && body.text) {
        allStates[String(body.itemId)].rejectionText = body.text
      } else {
        delete allStates[String(body.itemId)].rejectionText
      }
      await setKey(env.DB, 'sm_states', allStates)

      return json({ ok: true })
    }

    // Revogar token (regerar)
    if (body.action === 'revoke') {
      if (!body.clientName) return json({ ok: false, error: 'Missing clientName' }, 400)
      const tokens = (await getKey(env.DB, 'sm_portal_tokens') ?? {}) as Record<string, string>
      const newToken = crypto.randomUUID()
      tokens[body.clientName] = newToken
      await setKey(env.DB, 'sm_portal_tokens', tokens)
      return json({ ok: true, token: newToken })
    }
  }

  return json({ ok: false, error: 'Method not allowed' }, 405)
}
