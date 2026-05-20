interface Env { DB: D1Database }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

async function hashPassword(password: string, role: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(`ds2026:${role.toLowerCase()}:${password}`)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

type AuthBody = {
  action: string
  role?: string
  password?: string
  adminPassword?: string
}

async function getSocioHash(env: Env): Promise<string | null> {
  const row = await env.DB
    .prepare("SELECT hash FROM role_passwords WHERE role = 'Sócio'")
    .first<{ hash: string }>()
  return row?.hash ?? null
}

async function verifyAdmin(adminPassword: string | undefined, env: Env): Promise<boolean> {
  const socioHash = await getSocioHash(env)
  if (!socioHash) return true // no admin password set yet — allow
  if (!adminPassword) return false
  return (await hashPassword(adminPassword, 'Sócio')) === socioHash
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json() as AuthBody

    // ── check: which roles have passwords ────────────────
    if (body.action === 'check') {
      const rows = await env.DB.prepare('SELECT role FROM role_passwords').all()
      return new Response(
        JSON.stringify({ configured: rows.results.map((r) => (r as Record<string, unknown>).role as string) }),
        { headers: CORS }
      )
    }

    // ── verify: check password for a specific role ───────
    if (body.action === 'verify') {
      const { role, password } = body
      if (!role || !password) return new Response(JSON.stringify({ ok: false }), { headers: CORS })

      const row = await env.DB
        .prepare('SELECT hash FROM role_passwords WHERE role = ?')
        .bind(role)
        .first<{ hash: string }>()

      if (!row) return new Response(JSON.stringify({ ok: true, noPassword: true }), { headers: CORS })

      const hash = await hashPassword(password, role)
      return new Response(JSON.stringify({ ok: hash === row.hash }), { headers: CORS })
    }

    // ── set: create or update password for a role ────────
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

    // ── remove: delete password for a role ───────────────
    if (body.action === 'remove') {
      const { role, adminPassword } = body
      if (!role)
        return new Response(JSON.stringify({ ok: false, error: 'Função obrigatória' }), { headers: CORS })

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

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
