import { guardPanelRoute, type PanelGuardEnv } from './_lib/panel-guard'
import { buildQueue } from './_lib/studio-queue'

interface Env extends PanelGuardEnv {
  DB: D1Database
  // Segredo do app desktop (wrangler pages secret put STUDIO_KEY). O Studio não
  // tem sessão de navegador; ele se identifica por esta chave no cabeçalho
  // X-Studio-Key. Ausente = ninguém passa por aqui (cai no panel-guard).
  STUDIO_KEY?: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  })
}

// A fila expõe cliente e título dos cards em produção — dado interno. Entra sob o
// panel-guard (modo observação até PANEL_REQUIRE_AUTH=1), como as outras rotas de
// leitura interna. O consumidor é o Studio (app desktop); a autenticação própria
// dele virá junto com a entrega. Só LEITURA aqui.
export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed' }, 405)

  // O Studio se identifica pela chave própria; o painel logado passa pela sessão.
  const provided = request.headers.get('X-Studio-Key') ?? ''
  const keyOk = !!env.STUDIO_KEY && provided === env.STUDIO_KEY
  if (!keyOk) {
    const blocked = await guardPanelRoute({ request, env, waitUntil: ctx.waitUntil.bind(ctx) }, CORS)
    if (blocked) return blocked
  }

  try {
    // JSON1 no BANCO: nunca parsear a linha inteira do app_data no Worker
    // (sm_states passa de 800 KB — foi o que derrubou uma rota com Error 1102).
    // json_each roda em C dentro do SQLite e devolve só os campos pedidos.
    const cardsRes = await env.DB.prepare(
      `SELECT json_extract(value,'$.i') AS i, json_extract(value,'$.c') AS c,
              json_extract(value,'$.tp') AS tp, json_extract(value,'$.n') AS n,
              json_extract(value,'$.s') AS s
       FROM json_each(COALESCE((SELECT value FROM app_data WHERE key='sm_custom'), '[]'))`,
    ).all<{ i: number; c: string; tp: string; n: string; s: number }>()

    const statusRes = await env.DB.prepare(
      `SELECT je.key AS id, json_extract(je.value,'$.status') AS status
       FROM json_each(COALESCE((SELECT value FROM app_data WHERE key='sm_states'), '{}')) je`,
    ).all<{ id: string; status: number }>()

    const statusById: Record<string, number> = {}
    for (const row of statusRes.results ?? []) {
      if (row.id != null && typeof row.status === 'number') statusById[String(row.id)] = row.status
    }
    const queue = buildQueue(cardsRes.results ?? [], statusById)
    // Cache curto: o Studio consulta ao abrir; a fila muda em minutos, não segundos.
    return json({ queue }, 200, { 'Cache-Control': 'private, max-age=30' })
  } catch {
    // D1 fora / JSON torto não pode virar erro na cara do editor: fila vazia é a
    // degradação certa (o Studio diz "sem itens na fila"), nunca uma tela de erro.
    return json({ queue: [] })
  }
}
