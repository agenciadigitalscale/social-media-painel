import { verifySession } from './_lib/session'
import { noteAccess } from './_lib/audit'
import { ensureColumn } from './_lib/schema-guard'

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
  /**
   * `rev` sobe a cada gravação e é o que permite recusar uma escrita feita sobre
   * dado velho. Sem ela, o único carimbo era `updated`, com resolução de UM
   * SEGUNDO — duas pessoas salvando no mesmo segundo pareceriam a mesma versão,
   * que é exatamente o caso que precisamos pegar.
   */
  await ensureColumn(db, 'app_data', 'rev', 'INTEGER NOT NULL DEFAULT 0')
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
  noteAccess(env.DB, request, !!email, ctx.waitUntil.bind(ctx))
  if (!email && env.SYNC_REQUIRE_AUTH === '1') {
    return json({ ok: false, error: 'Sessão necessária' }, 401)
  }

  // GET /api/sync — retorna todos os pares ou filtra por ?key= ou ?since=
  if (request.method === 'GET') {
    try {
      const url = new URL(request.url)
      const filterKey = url.searchParams.get('key')
      const since     = url.searchParams.get('since')
      const serverTs  = new Date().toISOString()

      if (filterKey) {
        const row = await env.DB.prepare('SELECT value, rev FROM app_data WHERE key = ?1')
          .bind(filterKey).first<{ value: string; rev: number }>()
        return json({ ok: true, value: row?.value ?? null, rev: row?.rev ?? 0, ts: serverTs })
      }

      if (since) {
        // Converte ISO 8601 → SQLite datetime: "2024-01-01T12:34:56.000Z" → "2024-01-01 12:34:56"
        const sqliteTs = since.replace('T', ' ').split('.')[0].replace('Z', '')
        const { results } = await env.DB.prepare(
          'SELECT key, value, rev FROM app_data WHERE updated > ?1 ORDER BY updated ASC'
        ).bind(sqliteTs).all()
        return json({ ok: true, data: results, ts: serverTs })
      }

      const { results } = await env.DB.prepare('SELECT key, value, rev FROM app_data').all()
      return json({ ok: true, data: results, ts: serverTs })
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500)
    }
  }

  // POST /api/sync — upsert de um par chave/valor, ou merge de um patch
  if (request.method === 'POST') {
    try {
      const body = await request.json() as { key: string; value?: string; patch?: string; baseRev?: number }
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
        const after = await env.DB.prepare(`
          INSERT INTO app_data (key, value, rev)
          VALUES (?1, ?2, 1)
          ON CONFLICT(key) DO UPDATE SET
            value   = excluded.value,
            rev     = app_data.rev + 1,
            updated = CURRENT_TIMESTAMP
          RETURNING rev
        `).bind(body.key, merged).first<{ rev: number }>()
        return json({ ok: true, merged: Object.keys(incoming).length, rev: after?.rev ?? 0 })
      }

      if (body.value === undefined) return json({ ok: false, error: 'Missing value' }, 400)

      /**
       * `baseRev` = a versão que aquele navegador tinha em mãos ao montar este
       * valor. Se o servidor já avançou, alguém gravou no meio: recusar e
       * devolver o que está lá para o cliente reaplicar a mudança dele em cima.
       *
       * Sem isto, chave em formato de LISTA (`sm_custom`, os cards criados à
       * mão) perdia registro inteiro: duas pessoas criando um card no mesmo
       * minuto, e o card de quem salvou primeiro simplesmente sumia. O truque de
       * mandar só a diferença não serve nessas — ali entradas somem de verdade
       * (exclusão e Ctrl+Z), e mesclar ressuscitaria o que foi apagado.
       *
       * Sem `baseRev` a escrita passa direto, como sempre passou: é o que mantém
       * o fallback do cliente funcionando quando a reconciliação não converge.
       */
      if (body.baseRev !== undefined) {
        const row = await env.DB.prepare('SELECT rev FROM app_data WHERE key = ?1')
          .bind(body.key).first<{ rev: number }>()
        const currentRev = row?.rev ?? 0
        if (currentRev !== body.baseRev) {
          const fresh = await env.DB.prepare('SELECT value, rev FROM app_data WHERE key = ?1')
            .bind(body.key).first<{ value: string; rev: number }>()
          return json({
            ok: false, conflict: true,
            value: fresh?.value ?? null,
            rev: fresh?.rev ?? 0,
          }, 409)
        }
      }

      const after = await env.DB.prepare(`
        INSERT INTO app_data (key, value, rev)
        VALUES (?1, ?2, 1)
        ON CONFLICT(key) DO UPDATE SET
          value   = excluded.value,
          rev     = app_data.rev + 1,
          updated = CURRENT_TIMESTAMP
        RETURNING rev
      `).bind(body.key, body.value).first<{ rev: number }>()
      return json({ ok: true, rev: after?.rev ?? 0 })
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500)
    }
  }

  return json({ ok: false, error: 'Method not allowed' }, 405)
}
