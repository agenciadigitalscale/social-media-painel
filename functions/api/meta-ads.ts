// Meta Ads API proxy — stores credentials in D1, proxies to Meta Graph API
// Credentials: META_ACCESS_TOKEN e META_AD_ACCOUNT_ID armazenados em app_data

import { guardPanelRoute, type PanelGuardEnv } from './_lib/panel-guard'

interface Env extends PanelGuardEnv {
  DB: D1Database
}

/** Token do Meta guardado pela agência: nem ler campanha nem salvar credencial é público. */
const META_CORS = { 'Content-Type': 'application/json' }

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

async function getCreds(db: D1Database): Promise<{ token: string; adAccount: string } | null> {
  const rows = await db.prepare(
    `SELECT key, value FROM app_data WHERE key IN ('meta_access_token','meta_ad_account_id')`
  ).all()
  if (!rows.results?.length) return null
  const map: Record<string, string> = {}
  rows.results.forEach((r: Record<string, unknown>) => {
    map[r.key as string] = r.value as string
  })
  const token = map['meta_access_token']
  const adAccount = map['meta_ad_account_id']
  return token && adAccount ? { token, adAccount } : null
}

async function saveCreds(db: D1Database, token: string, adAccount: string): Promise<void> {
  await db.batch([
    db.prepare(`INSERT INTO app_data (key, value) VALUES ('meta_access_token', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`).bind(token),
    db.prepare(`INSERT INTO app_data (key, value) VALUES ('meta_ad_account_id', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`).bind(adAccount),
  ])
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { env } = ctx
  const blocked = await guardPanelRoute(
    { request: ctx.request, env, waitUntil: ctx.waitUntil.bind(ctx) },
    META_CORS,
  )
  if (blocked) return blocked

  const creds = await getCreds(env.DB)
  if (!creds) return Response.json({ ok: false, error: 'not_configured' }, { status: 404 })

  const fields = 'name,status,daily_budget,lifetime_budget,spend_cap,insights{spend,reach,clicks,cpm,ctr,actions}'
  const url = `${GRAPH_BASE}/act_${creds.adAccount}/campaigns?fields=${fields}&access_token=${creds.token}&limit=50`

  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } }
    return Response.json({ ok: false, error: err?.error?.message ?? 'Meta API error' }, { status: res.status })
  }

  const data = await res.json() as { data: unknown[] }
  return Response.json({ ok: true, campaigns: data.data ?? [] })
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx
  const blocked = await guardPanelRoute(
    { request, env, waitUntil: ctx.waitUntil.bind(ctx) },
    META_CORS,
  )
  if (blocked) return blocked

  const body = await request.json() as { action: string; token?: string; adAccount?: string }

  if (body.action === 'save_credentials') {
    if (!body.token?.trim() || !body.adAccount?.trim()) {
      return Response.json({ ok: false, error: 'token and adAccount required' }, { status: 400 })
    }
    // Validate token against Meta API before saving
    const testUrl = `${GRAPH_BASE}/me?fields=id,name&access_token=${body.token}`
    const testRes = await fetch(testUrl)
    if (!testRes.ok) {
      const err = await testRes.json() as { error?: { message?: string } }
      return Response.json({ ok: false, error: err?.error?.message ?? 'Token inválido' }, { status: 400 })
    }
    await saveCreds(env.DB, body.token, body.adAccount)
    return Response.json({ ok: true })
  }

  if (body.action === 'clear_credentials') {
    await env.DB.prepare(`DELETE FROM app_data WHERE key IN ('meta_access_token','meta_ad_account_id')`).run()
    return Response.json({ ok: true })
  }

  return Response.json({ ok: false, error: 'unknown action' }, { status: 400 })
}
