interface Env { DB: D1Database }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...CORS },
  })
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

function makeToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20)
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

  // GET /api/briefing?token=xxx — retorna dados do cliente e briefing preenchido
  if (request.method === 'GET') {
    const token = new URL(request.url).searchParams.get('token')
    if (!token) return json({ ok: false, error: 'Token ausente' }, 400)

    const tokens = (await getKey(env.DB, 'briefing_tokens') ?? {}) as Record<string, string>
    const clientName = tokens[token]
    if (!clientName) return json({ ok: false, error: 'Link inválido ou expirado' }, 404)

    const data = await getKey(env.DB, `briefing_${token}`)
    return json({ ok: true, clientName, data })
  }

  if (request.method === 'POST') {
    let body: { action: string; clientName?: string; token?: string; data?: Record<string, unknown> }
    try { body = await request.json() as typeof body } catch { return json({ ok: false, error: 'JSON inválido' }, 400) }

    // Gerar link de briefing para um cliente
    if (body.action === 'generate') {
      if (!body.clientName) return json({ ok: false, error: 'clientName obrigatório' }, 400)
      const tokens = (await getKey(env.DB, 'briefing_tokens') ?? {}) as Record<string, string>

      // Reutiliza token existente se já tiver um para este cliente
      const existing = Object.entries(tokens).find(([, cn]) => cn === body.clientName)
      const token = existing ? existing[0] : makeToken()

      if (!existing) {
        tokens[token] = body.clientName
        await setKey(env.DB, 'briefing_tokens', tokens)
      }

      return json({ ok: true, token })
    }

    // Salvar respostas do briefing
    if (body.action === 'submit') {
      if (!body.token || !body.data) return json({ ok: false, error: 'token e data obrigatórios' }, 400)
      const tokens = (await getKey(env.DB, 'briefing_tokens') ?? {}) as Record<string, string>
      if (!tokens[body.token]) return json({ ok: false, error: 'Token inválido' }, 404)

      await setKey(env.DB, `briefing_${body.token}`, {
        ...body.data,
        _submittedAt: new Date().toISOString(),
        _clientName: tokens[body.token],
      })

      return json({ ok: true })
    }

    // Buscar todos os briefings preenchidos (para o painel interno)
    if (body.action === 'list') {
      const tokens = (await getKey(env.DB, 'briefing_tokens') ?? {}) as Record<string, string>
      const result: Record<string, { token: string; filled: boolean; data?: unknown }> = {}
      for (const [token, clientName] of Object.entries(tokens)) {
        const data = await getKey(env.DB, `briefing_${token}`)
        result[clientName] = { token, filled: !!data, data }
      }
      return json({ ok: true, briefings: result })
    }

    return json({ ok: false, error: 'Ação desconhecida' }, 400)
  }

  return json({ ok: false, error: 'Método não permitido' }, 405)
}
