import { dispatchNotification } from './notifications'
import { ownerOfItem, seededItem, itemsOfClient } from './_lib/catalog'
import {
  clientForToken, customItem, customItemsOfClient, deletedIds, isItemDeleted,
  itemFields, jsonAt, patchItemStatus, projectItems, type Scalar,
} from './_lib/appdata'
import { ensureColumn } from './_lib/schema-guard'

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

/**
 * O vídeo deste card já foi transcodificado pelo Cloudflare Stream?
 *
 * Quando sim, a página do cliente usa o player adaptativo: em conexão ruim ele
 * troca para uma rendição mais leve e CONTINUA tocando, em vez de travar. É a
 * resposta para os 36% de reproduções que engasgavam no Android (medido em
 * 01/09/2026) e para o .mov que o Android recusa antes de decodificar.
 *
 * Falha em silêncio de propósito: sem UID a página serve o arquivo original,
 * que é exatamente o comportamento de sempre. Nada aqui pode impedir o cliente
 * de ver o criativo.
 */
async function streamDoLink(db: D1Database, link: string): Promise<string | null> {
  const m = link.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/) || link.match(/[?&]id=([a-zA-Z0-9_-]{10,})/)
  if (!m) return null
  try {
    const r = await db.prepare(
      'SELECT stream_uid, stream_status FROM drive_videos WHERE drive_file_id = ? LIMIT 1',
    ).bind(m[1]).first<{ stream_uid?: string; stream_status?: string }>()
    // Só 'ready' vale. Entregar o player de um vídeo que ainda transcodifica
    // mostraria uma tela preta — pior que o arquivo original pesado.
    if (r?.stream_uid && r.stream_status === 'ready') return r.stream_uid
    return null
  } catch {
    // A coluna pode ainda não existir neste deployment.
    return null
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

/** `''` quando não é texto — para os campos que caem em `||` encadeado. */
function text(v: Scalar): string {
  return typeof v === 'string' ? v : ''
}

/** Mantém a diferença entre "gravado como vazio" e "nunca gravado" (`??`). */
function nullableText(v: Scalar): string | null {
  return typeof v === 'string' ? v : null
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function ensureTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS app_data (
      key     TEXT PRIMARY KEY,
      value   TEXT NOT NULL DEFAULT '{}',
      updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run()
  // O `rev` nasceu depois da tabela, criado pelo `sync.ts`. Aqui ele também é
  // escrito — e um banco onde só o `/api/portal` rodou primeiro não o teria.
  await ensureColumn(db, 'app_data', 'rev', 'INTEGER NOT NULL DEFAULT 0')
}

async function getKey(db: D1Database, key: string): Promise<unknown> {
  const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(key).first<{ value: string }>()
  return row ? JSON.parse(row.value) : null
}

/**
 * O `rev` sobe junto — e isso não é detalhe. É por ele que o `/api/sync` recusa
 * uma escrita feita sobre cópia velha (reconciliação de três vias, 2026-07-23).
 * Sem o incremento, o painel de quem estava com a aba aberta regravava por cima
 * da decisão do cliente na sincronização seguinte, em silêncio.
 */
async function setKey(db: D1Database, key: string, value: unknown): Promise<void> {
  await db.prepare(`
    INSERT INTO app_data (key, value) VALUES (?1, ?2)
    ON CONFLICT(key) DO UPDATE SET
      value   = excluded.value,
      rev     = app_data.rev + 1,
      updated = CURRENT_TIMESTAMP
  `).bind(key, JSON.stringify(value)).run()
}

interface FeedbackEntry {
  approved: boolean
  text: string
  date: string
}

// Os campos que a tela pública mostra são nomeados na hora da consulta, em
// `itemFields`/`projectItems` — o resto do estado nem sai do banco.

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
  //
  // ⚠️ Nada aqui pode fazer `JSON.parse` de linha inteira do `app_data`. Este é
  // o endpoint que a tela do cliente chama assim que abre; `sm_states` sozinho
  // passa de meio mega, e parsear isso por abertura estourou o orçamento de CPU
  // do Worker (Error 1102 na cara do cliente, 2026-08-06). Quem lê campo aqui é
  // o SQLite, via `_lib/appdata.ts`.
  if (request.method === 'GET') {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    if (!token) return json({ ok: false, error: 'Missing token' }, 400)

    const clientName = await clientForToken(env.DB, token)
    if (!clientName) return json({ ok: false, error: 'Invalid token' }, 404)

    // Um item só: o viewer de criativo único não precisa (nem deve) puxar o
    // `/api/sync` inteiro — são 748 KB com o estado de todos os clientes, o
    // financeiro e as inscrições de push. Aqui sai apenas o que a tela mostra.
    const itemId = url.searchParams.get('itemId')
    if (itemId) {
      if (!/^\d+$/.test(itemId)) return json({ ok: false, error: 'Not found' }, 404)
      const id = Number(itemId)

      // Dono resolvido no servidor: sem isso, um token válido pediria qualquer
      // itemId e leria título, legenda e link de outro cliente.
      //
      // O catálogo semeado já está no bundle e responde de graça; só card criado
      // à mão desce ao `sm_custom` — que é a segunda maior linha do banco.
      const seeded = seededItem(id)
      let base: { n?: string; tp?: string; dt?: string } | null = seeded
      let owner: string | null = seeded ? ownerOfItem(id, []) : null
      if (!owner) {
        const custom = await customItem(env.DB, id)
        if (custom) { owner = custom.c; base = { n: custom.n, tp: custom.tp, dt: custom.dt } }
      }

      if (!owner) return json({ ok: false, error: 'Not found' }, 404)
      if (owner !== clientName) return json({ ok: false, error: 'Invalid token' }, 403)
      if (await isItemDeleted(env.DB, id)) return json({ ok: false, error: 'Deleted' }, 404)

      const [state, edit, rawFeedback] = await Promise.all([
        itemFields(env.DB, 'sm_states', id, ['title', 'caption', 'link', 'status']),
        itemFields(env.DB, 'sm_edits',  id, ['n', 'tp', 'dt']),
        jsonAt(env.DB, 'sm_feedback', [token, itemId]),
      ])
      const s = state.fields
      const e = edit.fields
      const link = nullableText(s.link) ?? ''
      const streamUid = link ? await streamDoLink(env.DB, link) : null

      return json({
        ok: true,
        clientName,
        item: {
          id,
          title:   text(s.title) || text(e.n) || base?.n || '',
          caption: nullableText(s.caption) ?? '',
          link,
          /** UID do Cloudflare Stream, quando o vídeo já está transcodificado. */
          streamUid,
          type:    nullableText(e.tp) ?? base?.tp ?? null,
          date:    nullableText(e.dt) ?? base?.dt ?? null,
          status:  typeof s.status === 'number' ? s.status : null,
          known:   true,
        },
        feedback: parseJson<FeedbackEntry>(rawFeedback),
      })
    }

    // Portal completo: só o conteúdo DESTE cliente, com o estado de cada item.
    // Antes a página baixava `/api/sync` inteiro para depois filtrar no
    // navegador — o filtro protegia a tela, não os dados.
    if (url.searchParams.get('list') === '1') {
      const [custom, deleted] = await Promise.all([
        customItemsOfClient(env.DB, clientName),
        deletedIds(env.DB),
      ])

      const mine = itemsOfClient(clientName, custom).filter(i => !deleted.has(i.i))
      const ids  = mine.map(i => i.i)

      const [states, edits, rawFeedback] = await Promise.all([
        projectItems(env.DB, 'sm_states', ids, ['title', 'caption', 'link', 'status']),
        projectItems(env.DB, 'sm_edits',  ids, ['n', 'tp', 'dt']),
        jsonAt(env.DB, 'sm_feedback', [token]),
      ])

      const items = mine.map(i => {
        const s = states.get(String(i.i)) ?? {}
        const e = edits.get(String(i.i)) ?? {}
        return {
          id:      i.i,
          name:    nullableText(e.n)  ?? i.n,
          type:    nullableText(e.tp) ?? i.tp,
          date:    nullableText(e.dt) ?? i.dt,
          title:   nullableText(s.title)   ?? '',
          caption: nullableText(s.caption) ?? '',
          link:    nullableText(s.link)    ?? '',
          status:  typeof s.status === 'number' ? s.status : 0,
        }
      })

      return json({
        ok: true, clientName, items,
        feedback: parseJson<Record<string, FeedbackEntry>>(rawFeedback) ?? {},
      })
    }

    const rawFeedback = await jsonAt(env.DB, 'sm_feedback', [token])
    return json({
      ok: true, clientName,
      feedback: parseJson<Record<string, FeedbackEntry>>(rawFeedback) ?? {},
    })
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
      //
      // Caminho rápido: o SQLite mexe nos dois campos dentro do documento. O
      // caminho antigo trazia `sm_states` inteiro (~600 KB) para o Worker,
      // parseava e reescrevia — no clique de "Aprovar", que é exatamente o que
      // não pode falhar por limite de recurso. Se o patch não pegar (linha
      // ainda não existe), cai no ler-mesclar-gravar de sempre.
      const status  = body.approved ? 5 : 6
      const reject  = !body.approved && body.text ? body.text : null
      const patched = await patchItemStatus(env.DB, body.itemId!, status, reject)

      if (!patched) {
        const allStates = (await getKey(env.DB, 'sm_states') ?? {}) as Record<string, Record<string, unknown>>
        if (!allStates[String(body.itemId)]) {
          allStates[String(body.itemId)] = { status: 0, title: '', link: '', caption: '', notes: '' }
        }
        allStates[String(body.itemId)].status = status
        if (reject) allStates[String(body.itemId)].rejectionText = reject
        else delete allStates[String(body.itemId)].rejectionText
        await setKey(env.DB, 'sm_states', allStates)
      }

      // Notificação em tempo real para a equipe
      const { fields: titleField } = await itemFields(env.DB, 'sm_states', body.itemId!, ['title'])
      const itemTitle = text(titleField.title) || `Item ${body.itemId}`
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
