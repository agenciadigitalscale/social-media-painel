interface Env {
  DB: D1Database
  ZAPI_INSTANCE_ID?: string
  ZAPI_TOKEN?: string
  ZAPI_CLIENT_TOKEN?: string
  ZAPI_TEAM_PHONE?: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

async function sendZApiText(env: Env, phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  if (!env.ZAPI_INSTANCE_ID || !env.ZAPI_TOKEN) {
    return { ok: false, error: 'Z-API not configured' }
  }

  const url = `https://api.z-api.io/instances/${env.ZAPI_INSTANCE_ID}/token/${env.ZAPI_TOKEN}/send-text`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (env.ZAPI_CLIENT_TOKEN) headers['client-token'] = env.ZAPI_CLIENT_TOKEN

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone, message }),
    })

    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `Z-API ${res.status}: ${text.slice(0, 200)}` }
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx

  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  let body: { action?: string; phone?: string; message?: string }
  try {
    body = await request.json() as typeof body
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const { action = 'send-text', phone, message } = body

  // Health check — tells frontend whether Z-API is configured
  if (action === 'check') {
    return json({ ok: true, configured: !!(env.ZAPI_INSTANCE_ID && env.ZAPI_TOKEN) })
  }

  // Send to team phone/group configured in env
  if (action === 'send-team-alert') {
    if (!message) return json({ ok: false, error: 'Missing message' }, 400)
    if (!env.ZAPI_TEAM_PHONE) return json({ ok: false, error: 'ZAPI_TEAM_PHONE not configured' }, 503)
    const result = await sendZApiText(env, env.ZAPI_TEAM_PHONE, message)
    return json(result, result.ok ? 200 : 502)
  }

  // Send to arbitrary phone (client approvals, reports, etc.)
  if (action === 'send-text') {
    if (!phone || !message) return json({ ok: false, error: 'Missing phone or message' }, 400)
    const result = await sendZApiText(env, phone, message)
    return json(result, result.ok ? 200 : 502)
  }

  // Bulk send: array of { phone, message } pairs, best-effort
  if (action === 'send-bulk') {
    const items = (body as unknown as { items?: { phone: string; message: string }[] }).items ?? []
    if (!items.length) return json({ ok: false, error: 'Missing items' }, 400)

    const results = await Promise.allSettled(
      items.map(({ phone: p, message: m }) => sendZApiText(env, p, m))
    )

    const sent = results.filter(r => r.status === 'fulfilled' && r.value.ok).length
    const failed = items.length - sent
    return json({ ok: sent > 0, sent, failed })
  }

  return json({ ok: false, error: 'Unknown action' }, 400)
}
