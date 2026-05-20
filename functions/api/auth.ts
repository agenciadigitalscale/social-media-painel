interface Env {
  SESSION_SECRET: string
  ALLOWED_EMAILS: string
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

function getCookie(header: string | null, name: string): string | null {
  if (!header) return null
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function verifySession(cookieHeader: string | null, secret: string): Promise<string | null> {
  const val = getCookie(cookieHeader, 'ds_session')
  if (!val) return null
  const dot = val.lastIndexOf('.')
  if (dot < 0) return null
  const payload = val.slice(0, dot)
  const sig     = val.slice(dot + 1)
  const expected = await hmacSign(payload, secret)
  if (sig !== expected) return null
  try {
    const [email, expiry] = atob(payload).split(':')
    if (Date.now() > Number(expiry)) return null
    return email
  } catch {
    return null
  }
}

function cors(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  }
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const secret  = env.SESSION_SECRET ?? 'ds-hub-change-this-secret'
  const allowed = (env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  const origin = request.headers.get('Origin') ?? '*'
  const c = cors(origin)

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: c })
  }

  // GET — verifica sessão existente
  if (request.method === 'GET') {
    const email = await verifySession(request.headers.get('Cookie'), secret)
    return Response.json(
      email ? { ok: true, email } : { ok: false },
      { headers: c },
    )
  }

  // POST — verifica token do Google e cria sessão
  if (request.method === 'POST') {
    const body = await request.json() as { credential?: string }
    if (!body.credential) {
      return Response.json({ ok: false, error: 'Credencial ausente' }, { status: 400, headers: c })
    }

    const res  = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${body.credential}`)
    const data = await res.json() as { email?: string; error_description?: string }

    if (!data.email) {
      return Response.json({ ok: false, error: 'Token Google inválido.' }, { status: 401, headers: c })
    }

    const email = data.email.toLowerCase()

    if (allowed.length > 0 && !allowed.includes(email)) {
      return Response.json(
        { ok: false, error: 'Esse e-mail não tem permissão de acesso ao DS HUB.' },
        { status: 403, headers: c },
      )
    }

    // Cria cookie de sessão assinado (8h)
    const expiry   = Date.now() + 8 * 60 * 60 * 1000
    const payload  = btoa(`${email}:${expiry}`)
    const sig      = await hmacSign(payload, secret)
    const cookieVal = `${payload}.${sig}`

    return Response.json({ ok: true, email }, {
      headers: {
        ...c,
        'Set-Cookie': `ds_session=${cookieVal}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`,
      },
    })
  }

  // DELETE — logout
  if (request.method === 'DELETE') {
    return Response.json({ ok: true }, {
      headers: {
        ...c,
        'Set-Cookie': 'ds_session=; Path=/; HttpOnly; Secure; Max-Age=0',
      },
    })
  }

  return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405, headers: c })
}
