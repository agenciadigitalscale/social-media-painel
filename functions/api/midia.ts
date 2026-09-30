/* functions/api/midia.ts
   Arquivos anexados direto no painel ("Criar publicação") — guardados no R2.

   Por que R2 e não o Drive: o Instagram e o Facebook BUSCAM a mídia por conta
   própria, então ela precisa de um endereço público e estável. O arquivo sobe
   em partes (o Worker recebe no máximo ~100 MB por requisição, e Reel passa
   disso), direto do navegador para o R2, sem passar por conta de ninguém.

   POST { action:'iniciar', nome, tipo, tamanho }         → { key, uploadId }       (sócio/social)
   PUT  ?action=parte&key=&uploadId=&n=   (corpo = parte) → { n, etag }             (sócio/social)
   POST { action:'concluir', key, uploadId, partes }      → { key, url, nome, tipo } (sócio/social)
   GET  ?k=anexos/...                                      → o arquivo (público — a Meta busca daqui)

   A chave leva um UUID: quem não recebeu o endereço não adivinha.
*/

import { verifySession, type SessionEnv } from './_lib/session'
import { usuarioDaSessao } from './_lib/access-policy'
import { cargoDe, isSocio } from '../../src/lib/access'

interface Env extends SessionEnv {
  CRIATIVOS?: R2Bucket
}

/** O que a integração da Meta aceita publicar. */
const TIPOS_ACEITOS = new Set(['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'])
const MAX_BYTES = 1024 * 1024 * 1024
const PREFIXO = 'anexos/'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const erro = (msg: string, status = 400) => json({ ok: false, error: msg }, status)

/** Nome seguro para a chave: sem barra, sem controle, com tamanho limitado. */
export function nomeSeguro(nome: string): string {
  const limpo = nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._ -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(-80)
  return limpo.replace(/^[.-]+/, '') || 'arquivo'
}

export function chaveValida(k: string | null): k is string {
  return !!k && k.startsWith(PREFIXO) && !k.includes('..') && /^anexos\/[0-9a-f-]{36}\/[A-Za-z0-9._ -]{1,80}$/.test(k)
}

async function podeAnexar(request: Request, env: Env): Promise<boolean> {
  const user = usuarioDaSessao(await verifySession(request.headers.get('Cookie'), env))
  return !!user && (isSocio(user) || cargoDe(user) === 'social')
}

async function servir(request: Request, env: Env, key: string): Promise<Response> {
  const bucket = env.CRIATIVOS!
  const range = request.headers.get('Range')
  const head = await bucket.head(key)
  if (!head) return new Response('Não encontrado', { status: 404 })

  const headers = new Headers()
  head.writeHttpMetadata(headers)
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'public, max-age=86400')
  headers.set('Content-Disposition', 'inline')

  const m = range?.match(/^bytes=(\d*)-(\d*)$/)
  if (m && (m[1] || m[2])) {
    const size = head.size
    const inicio = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]))
    const fim = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
    if (inicio >= size || inicio > fim) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    const obj = await bucket.get(key, { range: { offset: inicio, length: fim - inicio + 1 } })
    if (!obj) return new Response('Não encontrado', { status: 404 })
    headers.set('Content-Range', `bytes ${inicio}-${fim}/${size}`)
    headers.set('Content-Length', String(fim - inicio + 1))
    return new Response(obj.body, { status: 206, headers })
  }
  const obj = await bucket.get(key)
  if (!obj) return new Response('Não encontrado', { status: 404 })
  headers.set('Content-Length', String(head.size))
  return new Response(request.method === 'HEAD' ? null : obj.body, { status: 200, headers })
}

export const onRequest = async (ctx: { request: Request; env: Env }) => {
  const { request, env } = ctx
  if (!env.CRIATIVOS) return erro('Armazenamento de arquivos não configurado.', 501)
  const url = new URL(request.url)

  if (request.method === 'GET' || request.method === 'HEAD') {
    const k = url.searchParams.get('k')
    if (!chaveValida(k)) return new Response('Não encontrado', { status: 404 })
    return servir(request, env, k)
  }

  if (!(await podeAnexar(request, env))) return erro('Só sócios e Social Media anexam arquivos.', 403)

  if (request.method === 'PUT' && url.searchParams.get('action') === 'parte') {
    const key = url.searchParams.get('key')
    const uploadId = url.searchParams.get('uploadId') ?? ''
    const n = Number(url.searchParams.get('n'))
    if (!chaveValida(key) || !uploadId || !Number.isInteger(n) || n < 1 || n > 10_000) return erro('Parte inválida.')
    const parte = await env.CRIATIVOS.resumeMultipartUpload(key, uploadId).uploadPart(n, await request.arrayBuffer())
    return json({ ok: true, n: parte.partNumber, etag: parte.etag })
  }

  if (request.method !== 'POST') return erro('Método não suportado.', 405)
  const body = await request.json().catch(() => ({})) as Record<string, unknown>

  if (body.action === 'iniciar') {
    const nome = typeof body.nome === 'string' ? body.nome : ''
    const tipo = typeof body.tipo === 'string' ? body.tipo : ''
    const tamanho = Number(body.tamanho)
    if (!nome) return erro('Arquivo sem nome.')
    if (!TIPOS_ACEITOS.has(tipo)) return erro(`"${nome}" não é JPG, PNG, MP4 ou MOV — o Instagram e o Facebook não aceitam esse formato.`)
    if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > MAX_BYTES) return erro(`"${nome}" passa de 1 GB.`)
    const key = `${PREFIXO}${crypto.randomUUID()}/${nomeSeguro(nome)}`
    const up = await env.CRIATIVOS.createMultipartUpload(key, { httpMetadata: { contentType: tipo }, customMetadata: { nome } })
    return json({ ok: true, key, uploadId: up.uploadId })
  }

  if (body.action === 'concluir') {
    const key = typeof body.key === 'string' ? body.key : null
    const uploadId = typeof body.uploadId === 'string' ? body.uploadId : ''
    const partes = Array.isArray(body.partes) ? body.partes as { n: number; etag: string }[] : []
    if (!chaveValida(key) || !uploadId || partes.length === 0) return erro('Envio incompleto.')
    const obj = await env.CRIATIVOS.resumeMultipartUpload(key, uploadId)
      .complete(partes.map(p => ({ partNumber: Number(p.n), etag: String(p.etag) })))
    return json({
      ok: true, key,
      url: `${url.origin}/api/midia?k=${encodeURIComponent(key)}`,
      nome: obj.customMetadata?.nome ?? key.split('/').pop(),
      tipo: obj.httpMetadata?.contentType ?? '',
      tamanho: obj.size,
    })
  }

  return erro('Ação desconhecida.')
}
