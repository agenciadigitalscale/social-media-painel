import { verifySession } from './_lib/session'
import { noteAnonymous } from './_lib/audit'

interface Env {
  DB: D1Database
  SESSION_SECRET?: string
  /** '1' vira a chave: sem sessão, 401. Só depois da observação limpar. */
  SYNC_REQUIRE_AUTH?: string
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

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  try {
    await ensureTable(env.DB)
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }

  /**
   * Etapa 1 de fechar a porta: quem chega sem sessão é REGISTRADO e passa.
   *
   * Hoje este endpoint entrega o banco inteiro — e aceita escrita — para quem
   * tiver a URL (verificado em produção: 858 KB no GET, `{"ok":true}` no POST,
   * sem credencial). Bloquear de uma vez trancaria a equipe fora se algum
   * caminho legítimo não carregasse o cookie. Uns dias de observação dizem
   * exatamente o que falta antes de virar a chave — `SYNC_REQUIRE_AUTH=1`.
   */
  const email = await verifySession(request.headers.get('Cookie'), env)
  if (!email) {
    noteAnonymous(env.DB, request, ctx.waitUntil.bind(ctx))
    if (env.SYNC_REQUIRE_AUTH === '1') {
      return json({ ok: false, error: 'Sessão necessária' }, 401)
    }
  }

  // GET /api/sync — retorna todos os pares ou filtra por ?key= ou ?since=
  if (request.method === 'GET') {
    try {
      const url = new URL(request.url)
      const filterKey = url.searchParams.get('key')
      const since     = url.searchParams.get('since')
      const serverTs  = new Date().toISOString()

      if (filterKey) {
        const row = await env.DB.prepare('SELECT value FROM app_data WHERE key = ?1').bind(filterKey).first<{ value: string }>()
        return json({ ok: true, value: row?.value ?? null, ts: serverTs })
      }

      if (since) {
        // Converte ISO 8601 → SQLite datetime: "2024-01-01T12:34:56.000Z" → "2024-01-01 12:34:56"
        const sqliteTs = since.replace('T', ' ').split('.')[0].replace('Z', '')
        const { results } = await env.DB.prepare(
          'SELECT key, value FROM app_data WHERE updated > ?1 ORDER BY updated ASC'
        ).bind(sqliteTs).all()
        return json({ ok: true, data: results, ts: serverTs })
      }

      const { results } = await env.DB.prepare('SELECT key, value FROM app_data').all()
      return json({ ok: true, data: results, ts: serverTs })
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500)
    }
  }

  // POST /api/sync — upsert de um par chave/valor, ou merge de um patch
  if (request.method === 'POST') {
    try {
      const body = await request.json() as { key: string; value?: string; patch?: string }
      if (!body.key) return json({ ok: false, error: 'Missing key' }, 400)

      /**
       * `patch` = só as entradas que mudaram naquele navegador.
       *
       * Antes só existia `value`, e o painel mandava o bloco inteiro a cada
       * gravação — ~360 KB de `sm_states`. Como cada aba só puxa mudança alheia
       * a cada 20s, uma cópia velha substituía trabalho de outra pessoa sem
       * aviso. Pior: a aprovação que o cliente dá pelo portal é gravada aqui
       * pelo servidor, então ela era apagada por qualquer save do painel feito
       * na janela seguinte — o card voltava para "Enviado ao cliente" sozinho.
       *
       * O merge é seguro porque essas chaves nunca perdem entrada: excluir
       * conteúdo é registrado em `sm_deleted`, não removendo de `sm_states`.
       */
      if (body.patch !== undefined) {
        const incoming = JSON.parse(body.patch) as Record<string, unknown>
        if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
          return json({ ok: false, error: 'Patch inválido' }, 400)
        }
        // Patch vazio: nada mudou, e gravar só empurraria o `updated` para
        // frente — fazendo o poll dos outros baixar dado igual à toa.
        if (Object.keys(incoming).length === 0) return json({ ok: true, merged: 0 })

        const row = await env.DB.prepare('SELECT value FROM app_data WHERE key = ?1')
          .bind(body.key).first<{ value: string }>()
        let current: Record<string, unknown> = {}
        if (row?.value) {
          try {
            const parsed = JSON.parse(row.value) as unknown
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              current = parsed as Record<string, unknown>
            }
          } catch { /* valor corrompido: o patch reconstrói o que importa */ }
        }

        const merged = JSON.stringify({ ...current, ...incoming })
        await env.DB.prepare(`
          INSERT INTO app_data (key, value)
          VALUES (?1, ?2)
          ON CONFLICT(key) DO UPDATE SET
            value   = excluded.value,
            updated = CURRENT_TIMESTAMP
        `).bind(body.key, merged).run()
        return json({ ok: true, merged: Object.keys(incoming).length })
      }

      if (body.value === undefined) return json({ ok: false, error: 'Missing value' }, 400)
      await env.DB.prepare(`
        INSERT INTO app_data (key, value)
        VALUES (?1, ?2)
        ON CONFLICT(key) DO UPDATE SET
          value   = excluded.value,
          updated = CURRENT_TIMESTAMP
      `).bind(body.key, body.value).run()
      return json({ ok: true })
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500)
    }
  }

  return json({ ok: false, error: 'Method not allowed' }, 405)
}
