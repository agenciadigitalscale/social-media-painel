import { verifySession } from './_lib/session'
import { noteAccess } from './_lib/audit'
import { ensureColumn, ensureIndex } from './_lib/schema-guard'
import { protectMediaLinksValue } from './_lib/drive-video-links'
import { resolveWorkspace, scopedKey, workspaceKeyPrefix, unscopeKey } from './_lib/workspace'

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

/**
 * Devolve as linhas do bulk GET com a chave DESescopada (sem o `ws:<id>:`), para
 * o navegador receber os próprios nomes `sm_*`. Para o tenant nº 1 (prefixo vazio)
 * é um no-op — as linhas voltam idênticas, então o comportamento atual não muda.
 */
function unscopeRows(ws: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  if (!workspaceKeyPrefix(ws)) return rows
  return rows.map(r => ({ ...r, key: unscopeKey(ws, String(r.key)) }))
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
  if (env.SYNC_REQUIRE_AUTH === '1' && !env.SESSION_SECRET) {
    return json({ ok: false, error: 'SYNC_REQUIRE_AUTH está ativo, mas SESSION_SECRET não está configurado.' }, 500)
  }
  if (!email && env.SYNC_REQUIRE_AUTH === '1') {
    return json({ ok: false, error: 'Sessão necessária' }, 401)
  }

  /**
   * De QUAL agência é esta requisição (Onda 1b). Hoje nada emite workspace, então
   * `ws` é sempre 'digital-scale' e `prefix` é '' — o caminho abaixo fica byte a
   * byte igual ao de antes, porque não existe nenhuma chave `ws:%` no banco ainda.
   * O prefixo isola os tenants novos: cada um só lê e grava as próprias chaves.
   */
  const ws = resolveWorkspace(request)
  const prefix = workspaceKeyPrefix(ws)

  // GET /api/sync — retorna todos os pares ou filtra por ?key= ou ?since=
  if (request.method === 'GET') {
    try {
      const url = new URL(request.url)
      const filterKey = url.searchParams.get('key')
      const since     = url.searchParams.get('since')
      const serverTs  = new Date().toISOString()

      if (filterKey) {
        const row = await env.DB.prepare('SELECT value, rev FROM app_data WHERE key = ?1')
          .bind(scopedKey(ws, filterKey)).first<{ value: string; rev: number }>()
        return json({ ok: true, value: row?.value ?? null, rev: row?.rev ?? 0, ts: serverTs })
      }

      /**
       * Bulk (since e "tudo") tem de ser escopado por tenant, senão a Digital
       * Scale receberia as chaves `ws:%` de outras agências e um tenant novo
       * receberia o banco inteiro. O nº 1 lê só o que NÃO tem prefixo; os demais,
       * só o próprio `ws:<id>:%`, e as chaves voltam DESescopadas (`unscopeKey`)
       * para o navegador ver os próprios nomes `sm_*`. O prefixo é livre de
       * curinga (só `a-z0-9-`), então vai direto no LIKE.
       */
      if (since) {
        // Sem índice em `updated`, este WHERE varria a app_data inteira a cada
        // poll (~20s por aba) — foi o que estourou a quota de leitura do D1.
        await ensureIndex(env.DB, 'idx_app_data_updated', 'app_data', 'updated')
        // Converte ISO 8601 → SQLite datetime: "2024-01-01T12:34:56.000Z" → "2024-01-01 12:34:56"
        const sqliteTs = since.replace('T', ' ').split('.')[0].replace('Z', '')
        const { results } = prefix
          ? await env.DB.prepare(
              'SELECT key, value, rev FROM app_data WHERE updated > ?1 AND key LIKE ?2 ORDER BY updated ASC'
            ).bind(sqliteTs, prefix + '%').all()
          : await env.DB.prepare(
              "SELECT key, value, rev FROM app_data WHERE updated > ?1 AND key NOT LIKE 'ws:%' ORDER BY updated ASC"
            ).bind(sqliteTs).all()
        return json({ ok: true, data: unscopeRows(ws, results), ts: serverTs })
      }

      const { results } = prefix
        ? await env.DB.prepare('SELECT key, value, rev FROM app_data WHERE key LIKE ?1')
            .bind(prefix + '%').all()
        : await env.DB.prepare("SELECT key, value, rev FROM app_data WHERE key NOT LIKE 'ws:%'").all()
      return json({ ok: true, data: unscopeRows(ws, results), ts: serverTs })
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

        const dbKey = scopedKey(ws, body.key)
        const row = await env.DB.prepare('SELECT value FROM app_data WHERE key = ?1')
          .bind(dbKey).first<{ value: string }>()
        let current: Record<string, unknown> = {}
        if (row?.value) {
          try {
            const parsed = JSON.parse(row.value) as unknown
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              current = parsed as Record<string, unknown>
            }
          } catch { /* valor corrompido: o patch reconstrói o que importa */ }
        }

        const rawMerged = JSON.stringify({ ...current, ...incoming })
        const merged = body.key === 'sm_media_links'
          ? protectMediaLinksValue(rawMerged)
          : rawMerged
        const after = await env.DB.prepare(`
          INSERT INTO app_data (key, value, rev)
          VALUES (?1, ?2, 1)
          ON CONFLICT(key) DO UPDATE SET
            value   = excluded.value,
            rev     = app_data.rev + 1,
            updated = CURRENT_TIMESTAMP
          RETURNING rev
        `).bind(dbKey, merged).first<{ rev: number }>()
        return json({ ok: true, merged: Object.keys(incoming).length, rev: after?.rev ?? 0 })
      }

      if (body.value === undefined) return json({ ok: false, error: 'Missing value' }, 400)

      const dbKey = scopedKey(ws, body.key)

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
          .bind(dbKey).first<{ rev: number }>()
        const currentRev = row?.rev ?? 0
        if (currentRev !== body.baseRev) {
          const fresh = await env.DB.prepare('SELECT value, rev FROM app_data WHERE key = ?1')
            .bind(dbKey).first<{ value: string; rev: number }>()
          return json({
            ok: false, conflict: true,
            value: fresh?.value ?? null,
            rev: fresh?.rev ?? 0,
          }, 409)
        }
      }

      const protectedValue = body.key === 'sm_media_links'
        ? protectMediaLinksValue(body.value)
        : body.value
      const after = await env.DB.prepare(`
        INSERT INTO app_data (key, value, rev)
        VALUES (?1, ?2, 1)
        ON CONFLICT(key) DO UPDATE SET
          value   = excluded.value,
          rev     = app_data.rev + 1,
          updated = CURRENT_TIMESTAMP
        RETURNING rev
      `).bind(dbKey, protectedValue).first<{ rev: number }>()
      return json({ ok: true, rev: after?.rev ?? 0 })
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500)
    }
  }

  return json({ ok: false, error: 'Method not allowed' }, 405)
}
