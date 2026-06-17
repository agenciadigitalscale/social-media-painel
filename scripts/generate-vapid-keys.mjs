// Gera par de chaves VAPID para Web Push
// Uso: node scripts/generate-vapid-keys.mjs
import { webcrypto } from 'node:crypto'
const { subtle } = webcrypto

const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const priv = await subtle.exportKey('jwk', kp.privateKey)
const pubRaw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey))
const b64url = buf => Buffer.from(buf).toString('base64url')

console.log('\n=== VAPID Keys geradas ===\n')
console.log('1. Cloudflare secret  VAPID_PRIVATE_KEY:')
console.log(JSON.stringify(priv))
console.log('\n2. Cloudflare secret  VAPID_PUBLIC_KEY:')
console.log(b64url(pubRaw))
console.log('\n3. Cole em src/App.tsx (linha VAPID_PUBLIC_KEY):')
console.log(`const VAPID_PUBLIC_KEY = '${b64url(pubRaw)}'`)
console.log()
