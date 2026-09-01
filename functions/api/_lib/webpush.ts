// Web Push (RFC 8291) + VAPID (RFC 8292) — Cloudflare Workers / Web Crypto API

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const byte of b) s += String.fromCharCode(byte)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (s.length % 4)) % 4)
  return Uint8Array.from(atob(pad), c => c.charCodeAt(0))
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0))
  let i = 0; for (const a of arrays) { out.set(a, i); i += a.length }
  return out
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data))
}

// HKDF-Extract(salt, IKM) + HKDF-Expand(PRK, info, length) in one call
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hmacSha256(salt, ikm)
  const result = new Uint8Array(length)
  /* Anotado como `Uint8Array<ArrayBufferLike>` porque é o que `hmacSha256`
     devolve. Sem a anotação o TS infere `Uint8Array<ArrayBuffer>` do valor
     inicial e recusa a reatribuição — variância de typed array introduzida no
     TS 5.7. O código não muda; só o tipo do slot. */
  let t: Uint8Array<ArrayBufferLike> = new Uint8Array(0)
  let offset = 0
  for (let i = 1; offset < length; i++) {
    t = await hmacSha256(prk, concat(t, info, new Uint8Array([i])))
    result.set(t.slice(0, Math.min(t.length, length - offset)), offset)
    offset += t.length
  }
  return result
}

// Encrypts plaintext using RFC 8291 aes128gcm content encoding
export async function encryptPayload(
  plaintext: string,
  p256dhB64: string,
  authB64: string,
): Promise<Uint8Array> {
  const enc       = new TextEncoder()
  const uaPublic  = fromB64url(p256dhB64)
  const authSecret = fromB64url(authB64)

  // Server ephemeral ECDH key pair
  /* `generateKey` é tipado como `CryptoKey | CryptoKeyPair` e o TS não estreita
     sozinho. Para ECDH o retorno é SEMPRE um par — a conversão diz ao
     compilador o que o algoritmo já garante. */
  const serverKP = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  ) as CryptoKeyPair
  /* exportKey e tipado como ArrayBuffer | JsonWebKey; com o formato 'raw' o
     retorno e sempre ArrayBuffer. O TS nao consegue estreitar pelo argumento. */
  const asPublic = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKP.publicKey) as ArrayBuffer,
  )

  // ECDH shared secret
  const clientKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  /* O `workers-types` declara este campo como `$public`; o runtime do Worker e
     a spec do WebCrypto usam `public`. Trocar o nome para agradar o compilador
     QUEBRARIA o push em produção — a conversão mantém o nome certo no ar. */
  const ecdhAlg = { name: 'ECDH', public: clientKey } as unknown as Parameters<
    typeof crypto.subtle.deriveBits
  >[0]
  const ecdhBits = new Uint8Array(await crypto.subtle.deriveBits(ecdhAlg, serverKP.privateKey, 256))

  // RFC 8291 §3.3 — derive IKM
  const keyInfo = concat(enc.encode('WebPush: info\x00'), uaPublic, asPublic)
  const ikm     = await hkdf(authSecret, ecdhBits, keyInfo, 32)

  // Content-Encoding keys
  const salt  = crypto.getRandomValues(new Uint8Array(16))
  const cek   = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\x00'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\x00'), 12)

  // Encrypt
  const cekKey     = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const padded     = concat(enc.encode(plaintext), new Uint8Array([2]))  // 0x02 = last record delimiter
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cekKey, padded))

  // RFC 8188 body: salt(16) || rs(4 BE) || idlen(1) || server_public(65) || ciphertext
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096, false)
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext)
}

// Build VAPID Authorization header (RFC 8292)
export async function vapidAuthHeader(
  endpoint: string,
  privateKeyJwk: JsonWebKey,
  publicKeyB64: string,
): Promise<string> {
  const { protocol, host } = new URL(endpoint)
  const aud = `${protocol}//${host}`
  const exp = Math.floor(Date.now() / 1000) + 43200  // 12h

  const hdr = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const pay = b64url(new TextEncoder().encode(JSON.stringify({ aud, exp, sub: 'mailto:agenciadigitalscale@gmail.com' })))
  const unsigned = `${hdr}.${pay}`

  const sigKey = await crypto.subtle.importKey('jwk', privateKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig    = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, sigKey, new TextEncoder().encode(unsigned))

  return `vapid t=${unsigned}.${b64url(sig)},k=${publicKeyB64}`
}

export interface StoredSubscription {
  userId:   string
  endpoint: string
  p256dh:   string
  auth:     string
  ts:       number
}

export interface PushPayload {
  title: string
  body:  string
  tag?:  string
  tab?:  number   // deep-link tab index
  data?: unknown
}

// Sends a push notification to a single subscription. Returns false if subscription expired.
export async function sendWebPush(
  sub: StoredSubscription,
  payload: PushPayload,
  privateKeyJwk: JsonWebKey,
  publicKeyB64: string,
): Promise<{ ok: boolean; expired: boolean }> {
  try {
    const body   = await encryptPayload(JSON.stringify(payload), sub.p256dh, sub.auth)
    const vapid  = await vapidAuthHeader(sub.endpoint, privateKeyJwk, publicKeyB64)
    const resp   = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization:      vapid,
        'Content-Type':     'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        TTL:                '86400',
      },
      body,
    })
    const expired = resp.status === 404 || resp.status === 410
    return { ok: resp.ok || resp.status === 201, expired }
  } catch {
    return { ok: false, expired: false }
  }
}

// Sends to all subscriptions, pruning expired ones from db
export async function broadcastPush(
  db: D1Database,
  payload: PushPayload,
  privateKeyJwkStr: string,
  publicKeyB64: string,
): Promise<void> {
  const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind('push_subscriptions').first<{ value: string }>()
  if (!row) return
  const subs: StoredSubscription[] = JSON.parse(row.value)
  if (!subs.length) return

  const privateKeyJwk: JsonWebKey = JSON.parse(privateKeyJwkStr)
  const results = await Promise.all(subs.map(s => sendWebPush(s, payload, privateKeyJwk, publicKeyB64)))

  // Remove expired subscriptions
  const active = subs.filter((_, i) => !results[i].expired)
  if (active.length !== subs.length) {
    await db.prepare(`INSERT INTO app_data (key, value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated=CURRENT_TIMESTAMP`)
      .bind('push_subscriptions', JSON.stringify(active)).run()
  }
}
