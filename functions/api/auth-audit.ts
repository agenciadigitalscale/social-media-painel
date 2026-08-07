// A auditoria de acesso, legível de dentro do painel.
//
// O sinal que decide se dá para fechar o `/api/sync` é o `lastAt` do lado
// anônimo congelar. Só que a única forma de ler esse número era
// `GET /api/sync?key=sm_auth_audit` — e **essa leitura conta como acesso
// anônimo**, empurrando para frente exatamente o carimbo que se espera ver
// parado. Quem media estragava a medição.
//
// Este endpoint existe para quebrar esse ciclo. Duas regras o definem:
//
//  1. **Não chama `noteAccess`.** Ler a auditoria não pode alterar a auditoria.
//  2. **Exige sessão.** O conteúdo diz quais rotas estão abertas e com que
//     User-Agent — é mapa para quem quiser entrar. E, de quebra, ler daqui é
//     por definição um acesso autenticado.

import { verifySession, type SessionEnv } from './_lib/session'
import { readAudit } from './_lib/audit'

interface Env extends SessionEnv {
  DB: D1Database
  SYNC_REQUIRE_AUTH?: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS },
  })
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed' }, 405)

  // Sem segredo configurado não há sessão possível: dizer isso é mais útil que
  // devolver 401 e deixar alguém procurando cookie que não existe.
  if (!env.SESSION_SECRET) {
    return json({
      ok: false,
      error: 'SESSION_SECRET não está configurado — sem ele não há sessão para conferir.',
      configured: false,
    }, 200)
  }

  const email = await verifySession(request.headers.get('Cookie'), env)
  if (!email) return json({ ok: false, error: 'Sessão necessária' }, 401)

  try {
    const routes = await readAudit(env.DB)
    return json({
      ok: true,
      configured: true,
      /** Já está fechado? A tela precisa saber para não pedir de novo. */
      enforcing: env.SYNC_REQUIRE_AUTH === '1',
      routes,
    })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'falha ao ler' }, 500)
  }
}
