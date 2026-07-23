// Sessão assinada do painel — a mesma que o /api/auth emite.
//
// Vive aqui, e não dentro do auth.ts, porque quem precisa CONFERIR a sessão são
// os outros endpoints. Enquanto isso morava só no arquivo de login, o
// `/api/sync` seguia aberto: qualquer um lia (e escrevia) o banco inteiro sem
// credencial nenhuma.

export interface SessionEnv {
  SESSION_SECRET?: string
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

export function getCookie(header: string | null, name: string): string | null {
  if (!header) return null
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

export async function signSession(email: string, expiry: number, secret: string): Promise<string> {
  const payload = btoa(`${email}:${expiry}`)
  return `${payload}.${await hmacSign(payload, secret)}`
}

/**
 * E-mail de quem está logado, ou `null`.
 *
 * **Sem segredo, ninguém entra.** Antes o `auth.ts` caía num
 * `'ds-hub-change-this-secret'` quando `SESSION_SECRET` faltava — um valor que
 * está escrito no repositório. Quem o conhecesse forjaria um cookie válido, e o
 * cadeado inteiro seria enfeite. Falha fechada é a única postura defensável aqui.
 */
export async function verifySession(
  cookieHeader: string | null,
  env: SessionEnv,
): Promise<string | null> {
  const secret = env.SESSION_SECRET
  if (!secret) return null

  const val = getCookie(cookieHeader, 'ds_session')
  if (!val) return null

  const dot = val.lastIndexOf('.')
  if (dot < 0) return null

  const payload = val.slice(0, dot)
  const sig     = val.slice(dot + 1)
  if (sig !== await hmacSign(payload, secret)) return null

  try {
    const [email, expiry] = atob(payload).split(':')
    if (!email || Date.now() > Number(expiry)) return null
    return email
  } catch {
    return null
  }
}
