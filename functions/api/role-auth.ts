/**
 * /api/role-auth — Senhas por cargo (D1)
 *
 * POST { action: 'check' }                         → { configured: string[] }
 * POST { action: 'verify', role, password, user? } → { ok: boolean, noPassword?: boolean }
 *      senha correta emite o cookie de sessão (o mesmo do login Google)
 * POST { action: 'set',    role, password, adminPassword? } → { ok: boolean, error?: string }
 * POST { action: 'remove', role, adminPassword? }  → { ok: boolean, error?: string }
 */

import { issueSession } from './_lib/session'
import { ADMIN_USERS, isValidUser } from './_lib/users'

interface Env {
  DB: D1Database
  SESSION_SECRET?: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

async function hashPassword(password: string, role: string): Promise<string> {
  const data = new TextEncoder().encode(`ds2026:${role.toLowerCase()}:${password}`)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Confere a senha de administrador contra os cargos que REALMENTE administram.
 *
 * Antes isto consultava `role = 'Sócio'` — uma linha que nunca existiu no banco
 * (os cargos são gravados por nome de usuário: `pradox`, `kaique`…). Sem a
 * linha, `getSocioHash` devolvia `null` e a função caía num `return true`:
 * `set` e `remove` ficavam **sem conferência nenhuma no servidor**, e a única
 * barreira era o formulário do AccessManager, no navegador. Qualquer um trocava
 * a senha de qualquer cargo por requisição direta.
 *
 * Agora vale a mesma regra que a tela já aplica (`adminUsers`): a senha tem de
 * bater com a de um administrador de verdade. O hash é salgado com o cargo, daí
 * conferir um a um em vez de comparar um hash só.
 */
async function verifyAdmin(adminPassword: string | undefined, env: Env): Promise<boolean> {
  const rows = await env.DB
    .prepare(
      `SELECT role, hash FROM role_passwords WHERE role IN (${ADMIN_USERS.map(() => '?').join(', ')})`,
    )
    .bind(...ADMIN_USERS)
    .all<{ role: string; hash: string }>()

  const admins = rows.results ?? []

  // Instalação nova, sem nenhum administrador com senha: é preciso deixar a
  // PRIMEIRA senha ser definida, senão o painel nasce sem como se configurar.
  // A exceção morre no instante em que existir um admin com senha — é bootstrap,
  // não fallback permanente.
  if (admins.length === 0) return true

  if (!adminPassword) return false

  for (const { role, hash } of admins) {
    if ((await hashPassword(adminPassword, role)) === hash) return true
  }
  return false
}

type Body = {
  action: string
  role?: string
  password?: string
  adminPassword?: string
  /** Quem está entrando (chave do NAME_MAP) — vai para a identidade da sessão. */
  user?: string
}

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { headers: CORS })

async function ensureTable(env: Env): Promise<void> {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS role_passwords (
      role       TEXT    PRIMARY KEY,
      hash       TEXT    NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT 0
    )
  `).run()
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await ensureTable(env)
    const body = await request.json() as Body

    // ── check: quais cargos têm senha definida ────────────────────
    if (body.action === 'check') {
      const rows = await env.DB.prepare('SELECT role FROM role_passwords').all()
      const configured = rows.results.map(r => (r as Record<string, unknown>).role as string)
      return new Response(JSON.stringify({ configured }), { headers: CORS })
    }

    // ── verify: verifica senha de um cargo ────────────────────────
    if (body.action === 'verify') {
      const { role, password, user } = body
      if (!role)
        return new Response(JSON.stringify({ ok: false }), { headers: CORS })

      /**
       * Cargo tem de EXISTIR antes de qualquer coisa.
       *
       * Sem esta linha, um nome inventado não achava linha em `role_passwords`,
       * caía no ramo `!row` logo abaixo ("cargo sem senha entra direto") e saía
       * com cookie de sessão assinado — sem senha, numa requisição. A conferência
       * vem ANTES da consulta de propósito: o banco não deve nem ser perguntado
       * sobre alguém que não é da equipe.
       */
      if (!isValidUser(role))
        return new Response(JSON.stringify({ ok: false }), { headers: CORS })

      const row = await env.DB
        .prepare('SELECT hash FROM role_passwords WHERE role = ?')
        .bind(role)
        .first<{ hash: string }>()

      /**
       * Cargo sem senha definida entra direto — mas AINDA ASSIM ganha sessão.
       *
       * Antes este caminho devolvia só `noPassword` e seguia sem cookie. Enquanto
       * todo mundo tem senha ele fica dormente, mas basta um Sócio remover a
       * senha de alguém (a tela de Gerenciar Senhas faz isso) para essa pessoa
       * virar sessionless em silêncio — e ser trancada fora no dia em que o
       * `SYNC_REQUIRE_AUTH` for ligado. Entrar sem senha é decisão de quem
       * administra; ficar sem credencial nenhuma é acidente.
       */
      if (!row) {
        if (!env.SESSION_SECRET) {
          return new Response(JSON.stringify({ ok: true, noPassword: true, noSession: true }), { headers: CORS })
        }
        const res = await issueSession(`${user || role}@role.dshub`, env, CORS)
        // `sessionBody`, não `body`: reusar o nome sombrearia o corpo da
        // requisição alguns escopos acima.
        const sessionBody = await res.json() as Record<string, unknown>
        const setCookie = res.headers.get('Set-Cookie')
        return new Response(JSON.stringify({ ...sessionBody, noPassword: true }), {
          status: res.status,
          headers: { ...CORS, ...(setCookie ? { 'Set-Cookie': setCookie } : {}) },
        })
      }

      // Daqui para baixo o cargo TEM senha — e ela é obrigatória. A conferência
      // vem depois da consulta de propósito: exigi-la antes impediria o caminho
      // sem senha de pedir sessão, que é o que o cliente passou a fazer.
      if (!password)
        return new Response(JSON.stringify({ ok: false }), { headers: CORS })

      const hash = await hashPassword(password, role)
      if (hash !== row.hash) {
        return new Response(JSON.stringify({ ok: false }), { headers: CORS })
      }

      /**
       * Senha certa vira SESSÃO de verdade — o mesmo cookie assinado que o login
       * Google emite. Até aqui esta conferência morria no navegador e não
       * guardava dado nenhum: o `/api/sync` continuava aberto para o mundo.
       *
       * É o que permite fechar o endpoint sem esperar todo mundo ter Google:
       * quem tem entra pelo Google, quem não tem entra pela senha do cargo, e os
       * dois saem daqui com uma credencial que o servidor reconhece.
       *
       * SEM o segredo configurado, entra assim mesmo — só não ganha o cookie.
       * A senha já foi conferida; recusar aqui trancaria a equipe INTEIRA fora do
       * painel por causa de uma variável de ambiente que ainda não existe. O
       * `/api/sync` só passa a exigir sessão quando alguém liga `SYNC_REQUIRE_AUTH`,
       * e essa é a hora de o segredo já estar no lugar.
       */
      if (!env.SESSION_SECRET) {
        return new Response(JSON.stringify({ ok: true, noSession: true }), { headers: CORS })
      }
      return await issueSession(`${user || role}@role.dshub`, env, CORS)
    }

    // ── set: define ou altera senha de um cargo ───────────────────
    if (body.action === 'set') {
      const { role, password, adminPassword } = body
      if (!role || !password)
        return new Response(JSON.stringify({ ok: false, error: 'Campos obrigatórios' }), { headers: CORS })

      // Senha só existe para quem é da equipe. Sem isto, um `set` com nome
      // qualquer criaria uma credencial órfã — exatamente o que a `geovana`
      // virou depois de sair, e o que a whitelist do `verify` passou a barrar.
      if (!isValidUser(role))
        return new Response(JSON.stringify({ ok: false, error: 'Cargo desconhecido' }), { headers: CORS })

      if (!(await verifyAdmin(adminPassword, env)))
        return new Response(JSON.stringify({ ok: false, error: 'Senha de administrador incorreta' }), { headers: CORS })

      const hash = await hashPassword(password, role)
      await env.DB.prepare(`
        INSERT INTO role_passwords (role, hash, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(role) DO UPDATE SET hash = excluded.hash, updated_at = excluded.updated_at
      `).bind(role, hash, Date.now()).run()

      return new Response(JSON.stringify({ ok: true }), { headers: CORS })
    }

    // ── remove: remove senha de um cargo ─────────────────────────
    if (body.action === 'remove') {
      const { role, adminPassword } = body
      if (!role)
        return new Response(JSON.stringify({ ok: false, error: 'Cargo obrigatório' }), { headers: CORS })

      if (!(await verifyAdmin(adminPassword, env)))
        return new Response(JSON.stringify({ ok: false, error: 'Senha de administrador incorreta' }), { headers: CORS })

      // De propósito SEM whitelist: remover é justamente como se limpa uma
      // credencial órfã — alguém que saiu da equipe e por isso não está mais na
      // lista. Exigir `isValidUser` aqui tornaria a sobra impossível de apagar.
      await env.DB.prepare('DELETE FROM role_passwords WHERE role = ?').bind(role).run()
      return new Response(JSON.stringify({ ok: true }), { headers: CORS })
    }

    return new Response(JSON.stringify({ ok: false, error: 'Ação inválida' }), { status: 400, headers: CORS })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: CORS })
  }
}
