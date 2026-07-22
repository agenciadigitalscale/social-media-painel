import { dispatchNotification } from './notifications'
import { ownerOfItem, seededItem, itemsOfClient, type CustomRow } from './_lib/catalog'

interface Env {
  DB:                D1Database
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

interface FeedbackEntry {
  approved: boolean
  text: string
  date: string
}

/** Só os campos que a tela pública mostra — o resto do estado não sai daqui. */
interface ItemStateRow {
  title?: string
  caption?: string
  link?: string
  status?: number
}

interface EditRow {
  n?: string
  tp?: string
  dt?: string
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
  // GET /api/portal?token=TOKEN&itemId=N — devolve SÓ aquele criativo
  if (request.method === 'GET') {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    if (!token) return json({ ok: false, error: 'Missing token' }, 400)

    const tokens = (await getKey(env.DB, 'sm_portal_tokens') ?? {}) as Record<string, string>
    const clientName = Object.entries(tokens).find(([, t]) => t === token)?.[0]
    if (!clientName) return json({ ok: false, error: 'Invalid token' }, 404)

    const allFeedback = (await getKey(env.DB, 'sm_feedback') ?? {}) as Record<string, Record<string, FeedbackEntry>>

    // Um item só: o viewer de criativo único não precisa (nem deve) puxar o
    // `/api/sync` inteiro — são 748 KB com o estado de todos os clientes, o
    // financeiro e as inscrições de push. Aqui sai apenas o que a tela mostra.
    const itemId = url.searchParams.get('itemId')
    if (itemId) {
      const id      = Number(itemId)
      const states  = (await getKey(env.DB, 'sm_states') ?? {}) as Record<string, ItemStateRow>
      const edits   = (await getKey(env.DB, 'sm_edits') ?? {}) as Record<string, EditRow>
      const custom  = (await getKey(env.DB, 'sm_custom') ?? []) as CustomRow[]
      const deleted = (await getKey(env.DB, 'sm_deleted') ?? []) as number[]

      // Dono resolvido no servidor: sem isso, um token válido pediria qualquer
      // itemId e leria título, legenda e link de outro cliente.
      const owner = ownerOfItem(id, custom)
      if (!owner) return json({ ok: false, error: 'Not found' }, 404)
      if (owner !== clientName) return json({ ok: false, error: 'Invalid token' }, 403)
      if (deleted.includes(id)) return json({ ok: false, error: 'Deleted' }, 404)

      const state = states[itemId] ?? {}
      const edit  = edits[itemId] ?? {}
      const base  = seededItem(id) ?? custom.find(c => c.i === id) ?? null

      return json({
        ok: true,
        clientName,
        item: {
          id,
          title:   state.title || edit.n || base?.n || '',
          caption: state.caption ?? '',
          link:    state.link ?? '',
          type:    edit.tp ?? base?.tp ?? null,
          date:    edit.dt ?? base?.dt ?? null,
          status:  typeof state.status === 'number' ? state.status : null,
          known:   true,
        },
        feedback: allFeedback[token]?.[itemId] ?? null,
      })
    }

    // Portal completo: só o conteúdo DESTE cliente, com o estado de cada item.
    // Antes a página baixava `/api/sync` inteiro para depois filtrar no
    // navegador — o filtro protegia a tela, não os dados.
    if (url.searchParams.get('list') === '1') {
      const states  = (await getKey(env.DB, 'sm_states') ?? {}) as Record<string, ItemStateRow>
      const edits   = (await getKey(env.DB, 'sm_edits') ?? {}) as Record<string, EditRow>
      const custom  = (await getKey(env.DB, 'sm_custom') ?? []) as CustomRow[]
      const deleted = new Set((await getKey(env.DB, 'sm_deleted') ?? []) as number[])

      const mine = itemsOfClient(clientName, custom).filter(i => !deleted.has(i.i))
      const items = mine.map(i => {
        const state = states[String(i.i)] ?? {}
        const edit  = edits[String(i.i)] ?? {}
        return {
          id:      i.i,
          name:    edit.n ?? i.n,
          type:    edit.tp ?? i.tp,
          date:    edit.dt ?? i.dt,
          title:   state.title ?? '',
          caption: state.caption ?? '',
          link:    state.link ?? '',
          status:  typeof state.status === 'number' ? state.status : 0,
        }
      })

      return json({ ok: true, clientName, items, feedback: allFeedback[token] ?? {} })
    }

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

      // Notificação em tempo real para a equipe
      const itemTitle = String((allStates[String(body.itemId!)] as Record<string, unknown>)?.title ?? `Item ${body.itemId}`)
      await dispatchNotification(env, {
        id:         crypto.randomUUID(),
        type:       body.approved ? 'approved' : 'rejected',
        clientName,
        itemId:     body.itemId!,
        itemTitle,
        ts:         Date.now(),
      })

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

    // Limpar o veredito anterior de UM item — usado ao reenviar um criativo
    // refeito: sem isso o viewer do cliente mostra "você já respondeu" e não
    // deixa avaliar de novo. Não mexe no token (o link continua o mesmo).
    if (body.action === 'reset-feedback') {
      if (!body.token || body.itemId === undefined) {
        return json({ ok: false, error: 'Missing fields' }, 400)
      }
      const key = String(body.itemId)
      const allFeedback = (await getKey(env.DB, 'sm_feedback') ?? {}) as Record<string, Record<string, FeedbackEntry>>
      if (allFeedback[body.token] && key in allFeedback[body.token]) {
        delete allFeedback[body.token][key]
        await setKey(env.DB, 'sm_feedback', allFeedback)
      }
      const tokens = (await getKey(env.DB, 'sm_portal_tokens') ?? {}) as Record<string, string>
      const clientName = Object.entries(tokens).find(([, t]) => t === body.token)?.[0]
      if (clientName) {
        const appFeedback = (await getKey(env.DB, 'sm_client_feedback') ?? {}) as Record<string, Record<string, FeedbackEntry>>
        if (appFeedback[clientName] && key in appFeedback[clientName]) {
          delete appFeedback[clientName][key]
          await setKey(env.DB, 'sm_client_feedback', appFeedback)
        }
      }
      return json({ ok: true })
    }
  }

  return json({ ok: false, error: 'Method not allowed' }, 405)
}
