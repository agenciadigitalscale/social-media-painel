interface Env {
  DB: D1Database
  GOOGLE_SA_KEY: string
}

interface ServiceAccountKey {
  client_email: string
  private_key: string
  token_uri: string
}

interface CachedToken {
  token: string
  expiry: number
}

const TOKEN_CACHE_KEY = '_gsa_access_token'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\r?\n/g, '')
    .trim()
  const binary = atob(b64)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return buf.buffer
}

function b64url(input: ArrayBuffer | string): string {
  let s = ''
  if (typeof input === 'string') {
    s = input
  } else {
    const bytes = new Uint8Array(input)
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function buildJwt(sa: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: DRIVE_SCOPE,
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  }))
  const toSign = `${header}.${payload}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(toSign))
  return `${toSign}.${b64url(sig)}`
}

export async function getAccessToken(env: Env): Promise<string> {
  // Check D1 cache
  const cached = await env.DB.prepare('SELECT value FROM app_data WHERE key = ?')
    .bind(TOKEN_CACHE_KEY)
    .first<{ value: string }>()

  if (cached) {
    try {
      const { token, expiry } = JSON.parse(cached.value) as CachedToken
      if (expiry - Date.now() > 60_000) return token
    } catch {}
  }

  const sa: ServiceAccountKey = JSON.parse(env.GOOGLE_SA_KEY)
  const jwt = await buildJwt(sa)

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${text}`)
  }

  const { access_token, expires_in } = await res.json<{ access_token: string; expires_in: number }>()
  const expiry = Date.now() + (expires_in - 120) * 1000

  await env.DB.prepare(
    'INSERT OR REPLACE INTO app_data (key, value, updated) VALUES (?, ?, CURRENT_TIMESTAMP)',
  ).bind(TOKEN_CACHE_KEY, JSON.stringify({ token: access_token, expiry })).run()

  return access_token
}
