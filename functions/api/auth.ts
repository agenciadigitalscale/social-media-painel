import { verifySession, issueSession } from './_lib/session'

interface Env {
  SESSION_SECRET?: string
  ALLOWED_EMAILS?: string
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
  const allowed = (env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  const origin = request.headers.get('Origin') ?? '*'
  const c = cors(origin)

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: c })
  }

  // GET — verifica sessão existente e a RENOVA
  if (request.method === 'GET') {
    const email = await verifySession(request.headers.get('Cookie'), env)
    if (!email) return Response.json({ ok: false }, { headers: c })

    /**
     * Renova a validade a cada verificação — a sessão passa a expirar por
     * INATIVIDADE, não pelo relógio.
     *
     * Antes eram 8h corridas a partir do login: quem entrava às 8h era expulso
     * às 16h no meio do trabalho, sem aviso. Como o painel consulta este
     * endpoint ao abrir, quem está usando nunca perde a sessão; quem parou de
     * usar perde depois de 8h, que é o que a expiração deveria significar.
     */
    const renovada = await issueSession(email, env, c)
    return new Response(JSON.stringify({ ok: true, email }), {
      status: 200,
      headers: new Headers(renovada.headers),
    })
  }

  // POST — verifica token do Google e cria sessão
  if (request.method === 'POST') {
    // Sem segredo não se emite sessão. O valor de antes vinha de um `??` com uma
    // string escrita neste repositório: quem a conhecesse forjava um cookie
    // válido, e todo o resto do cadeado seria enfeite.
    if (!env.SESSION_SECRET) {
      return Response.json(
        { ok: false, error: 'Login indisponível: SESSION_SECRET não configurado.' },
        { status: 503, headers: c },
      )
    }
    // Lista vazia liberava QUALQUER conta Google do mundo — o `allowed.length > 0`
    // de antes transformava "esqueci de configurar" em "entra quem quiser".
    if (allowed.length === 0) {
      return Response.json(
        { ok: false, error: 'Login indisponível: ALLOWED_EMAILS não configurado.' },
        { status: 503, headers: c },
      )
    }

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

    if (!allowed.includes(email)) {
      return Response.json(
        { ok: false, error: 'Esse e-mail não tem permissão de acesso ao DS HUB.' },
        { status: 403, headers: c },
      )
    }

    // Cookie de sessão pelo emissor compartilhado — o mesmo que a senha do
    // cargo usa, para o resto do sistema não precisar saber por qual porta a
    // pessoa entrou.
    const sessionRes = await issueSession(email, env, c)
    // O e-mail volta junto: é com ele que o painel descobre QUEM entrou e já
    // abre como a pessoa, sem passar pela splash de novo.
    return new Response(
      JSON.stringify({ ok: sessionRes.ok, email: sessionRes.ok ? email : undefined }),
      { status: sessionRes.status, headers: new Headers(sessionRes.headers) },
    )
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
