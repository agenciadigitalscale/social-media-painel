/**
 * /api/role-auth — Senhas por cargo (D1)
 *
 * POST { action: 'check' }                         → { configured: string[] }
 * POST { action: 'verify', role, password }        → { ok: boolean, noPassword?: boolean }
 * POST { action: 'set',    role, password, adminPassword? } → { ok: boolean, error?: string }
 * POST { action: 'remove', role, adminPassword? }  → { ok: boolean, error?: string }
 */

interface Env { DB: D1Database }

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

async function getSocioHash(env: Env): Promise<string | null> {
  const row = await env.DB
    .prepare("SELECT hash FROM role_passwords WHERE role = 'Sócio'")
    .first<{ hash: string }>()
  return row?.hash ?? null
}

async function verifyAdmin(adminPassword: string | undefined, env: Env): Promise<boolean> {
  const socioHash = await getSocioHash(env)
  if (!socioHash) return true // nenhuma senha de Sócio definida ainda — permite
  if (!adminPassword) return false
  return (await hashPassword(adminPassword, 'Sócio')) === socioHash
}

type Body = {
  action: string
  role?: string
  password?: string
  adminPassword?: string
}

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { headers: CORS })

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json() as Body

    // ── check: quais cargos têm senha definida ────────────────────
    if (body.action === 'check') {
      const rows = await env.DB.prepare('SELECT role FROM role_passwords').all()
      const configured = rows.results.map(r => (r as Record<string, unknown>).role as string)
      return new Response(JSON.stringify({ configured }), { headers: CORS })
    }

    // ── verify: verifica senha de um cargo ────────────────────────
    if (body.action === 'verify') {
      const { role, password } = body
      if (!role || !password)
        return new Response(JSON.stringify({ ok: false }), { headers: CORS })

      const row = await env.DB
        .prepare('SELECT hash FROM role_passwords WHERE role = ?')
        .bind(role)
        .first<{ hash: string }>()

      if (!row)
        return new Response(JSON.stringify({ ok: true, noPassword: true }), { headers: CORS })

      const hash = await hashPassword(password, role)
      return new Response(JSON.stringify({ ok: hash === row.hash }), { headers: CORS })
    }

    // ── set: define ou altera senha de um cargo ───────────────────
    if (body.action === 'set') {
      const { role, password, adminPassword } = body
      if (!role || !password)
        return new Response(JSON.stringify({ ok: false, error: 'Campos obrigatórios' }), { headers: CORS })

      if (!(await verifyAdmin(adminPassword, env)))
        return new Response(JSON.stringify({ ok: false, error: 'Senha do Sócio incorreta' }), { headers: CORS })

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
        return new Response(JSON.stringify({ ok: false, error: 'Senha do Sócio incorreta' }), { headers: CORS })

      await env.DB.prepare('DELETE FROM role_passwords WHERE role = ?').bind(role).run()
      return new Response(JSON.stringify({ ok: true }), { headers: CORS })
    }

    return new Response(JSON.stringify({ ok: false, error: 'Ação inválida' }), { status: 400, headers: CORS })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: CORS })
  }
}
