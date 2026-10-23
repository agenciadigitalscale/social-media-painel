/**
 * /api/integridade — o alarme de perda de dados (2026-10-23).
 *
 * POST (cron, `Bearer CRON_SECRET`, de hora em hora): tira a impressão dos cards
 * (_lib/integridade), compara com a da hora anterior e, se algo encolheu,
 * avisa os SÓCIOS no celular e registra o alerta. Só LÊ os dados da equipe.
 * GET (sessão de sócio): os últimos alertas.
 */
import { broadcastPush } from './_lib/webpush'
import { verifySession, type SessionEnv } from './_lib/session'
import { usuarioDaSessao } from './_lib/access-policy'
import { isSocio } from '../../src/lib/access'
import { ADMIN_USERS } from './_lib/users'
import { comparar, grave, impressao, resumir, type Achados, type Impressao } from './_lib/integridade'

interface Env extends SessionEnv {
  DB: D1Database
  CRON_SECRET?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_PUBLIC_KEY?: string
}

const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } })

async function garantirTabelas(db: D1Database): Promise<void> {
  await db.prepare('CREATE TABLE IF NOT EXISTS integridade_snap (id INTEGER PRIMARY KEY CHECK (id = 1), dados TEXT NOT NULL, em TEXT NOT NULL)').run()
  await db.prepare('CREATE TABLE IF NOT EXISTS integridade_alertas (id INTEGER PRIMARY KEY AUTOINCREMENT, em TEXT NOT NULL, resumo TEXT NOT NULL, detalhes TEXT NOT NULL)').run()
}

async function ler(db: D1Database, key: string, vazio: unknown): Promise<unknown> {
  const r = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(key).first<{ value: string }>()
  try { return r?.value ? JSON.parse(r.value) : vazio } catch { return vazio }
}

/** Nomes legíveis dos cards afetados (cliente — título), para o aviso. */
function nomes(ids: (string | number)[], custom: { i: number; c?: string; n?: string }[], states: Record<string, { title?: string }>): string[] {
  const porId = new Map(custom.map(c => [String(c.i), c]))
  return ids.slice(0, 6).map(id => {
    const c = porId.get(String(id))
    return `${c?.c ?? '?'} — ${states[String(id)]?.title || c?.n || id}`
  })
}

async function verificar(env: Env): Promise<Response> {
  await garantirTabelas(env.DB)
  const [states, custom, deleted, roteiros] = await Promise.all([
    ler(env.DB, 'sm_states', {}), ler(env.DB, 'sm_custom', []), ler(env.DB, 'sm_deleted', []), ler(env.DB, 'sm_esteira_roteiros', {}),
  ]) as [Record<string, { title?: string }>, { i: number; c?: string; n?: string }[], unknown[], Record<string, unknown>]
  const agora = impressao({ states, custom, deleted, roteiros }, Date.now())

  const ant = await env.DB.prepare('SELECT dados FROM integridade_snap WHERE id = 1').first<{ dados: string }>()
  let achados: Achados | null = null
  if (ant?.dados) {
    const antes = JSON.parse(ant.dados) as Impressao
    achados = comparar(antes, agora)
    if (grave(achados)) {
      const deletados = new Set(deleted.map(Number))
      const excluidosDeVez = achados.sumiramDoCadastro.filter(i => deletados.has(i))
      const resumo = resumir(achados) + (excluidosDeVez.length ? ` (${excluidosDeVez.length} excluído(s) de vez por alguém)` : '')
      const afetados = [...achados.perderamHistorico.map(p => p.id), ...achados.perderamCampos.map(p => p.id), ...achados.sumiramDoCadastro.map(String)]
      const lista = nomes([...new Set(afetados)], custom, states)
      await env.DB.prepare('INSERT INTO integridade_alertas (em, resumo, detalhes) VALUES (?, ?, ?)')
        .bind(new Date().toISOString(), resumo, JSON.stringify({ ...achados, nomes: lista, antesEm: antes.em })).run()
      if (env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY) {
        await broadcastPush(env.DB, {
          title: '⚠ Possível perda de dados no painel',
          body: `${resumo}${lista.length ? ` — ${lista.slice(0, 3).join('; ')}` : ''}. Há cópia de hora em hora para recuperar.`,
          tag: `integridade-${Date.now()}`,
          tab: 0,
        }, env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY, ADMIN_USERS)
      }
    }
  }
  await env.DB.prepare('INSERT INTO integridade_snap (id, dados, em) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, em = excluded.em')
    .bind(JSON.stringify(agora), new Date().toISOString()).run()
  return json({ ok: true, alarme: !!achados && grave(achados), resumo: achados ? resumir(achados) : 'primeira impressão' })
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const auth = request.headers.get('Authorization') ?? ''
    if (request.method === 'POST') {
      if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) return json({ ok: false, error: 'Só o cron.' }, 401)
      return await verificar(env)
    }
    if (request.method === 'GET') {
      const user = usuarioDaSessao(await verifySession(request.headers.get('Cookie'), env))
      if (!user || !isSocio(user)) return json({ ok: false, error: 'Só sócios.' }, 403)
      await garantirTabelas(env.DB)
      const r = await env.DB.prepare('SELECT em, resumo, detalhes FROM integridade_alertas ORDER BY id DESC LIMIT 20').all<{ em: string; resumo: string; detalhes: string }>()
      return json({ ok: true, alertas: r.results.map(a => ({ em: a.em, resumo: a.resumo, nomes: (JSON.parse(a.detalhes) as { nomes?: string[] }).nomes ?? [] })) })
    }
    return json({ ok: false, error: 'Método não suportado.' }, 405)
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
}
