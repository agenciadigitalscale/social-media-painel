// O que existe dentro da pasta que o card aponta.
//
// Carrossel, na prática da agência, é uma PASTA do Drive com várias imagens —
// e o link que vai para o cliente é o link dessa pasta. Medido em produção
// (2026-08-31): 344 cards com link de pasta, 61 já enviados, e nenhum abria.
// O viewer tentava usar a URL da pasta como `src` de uma imagem, o cliente via
// "não foi possível carregar" e pedia o arquivo por WhatsApp.
//
// Este endpoint resolve a pasta em uma lista ordenada de arquivos. Cada arquivo
// depois é servido pelos caminhos que já existem (`/api/stream`, `/api/thumb`),
// que sabem lidar com pasta privada pela conta de serviço.

import { getAccessToken } from './_lib/google-auth'
import { ownerOfItem, seededItem } from './_lib/catalog'
import { clientForToken, customItem, isItemDeleted, itemFields, jsonAt } from './_lib/appdata'
import { classifyCreativeLink, creativeFilesOf, type CreativeFile } from '../../src/lib/creativeLink'

interface Env {
  DB: D1Database
  GOOGLE_SA_KEY?: string
  APPS_SCRIPT_URL?: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Conteúdo de pasta de criativo praticamente não muda depois de entregue, e o
// link costuma ser aberto várias vezes (o cliente volta, repassa no grupo).
// Cache na borda tira o Drive do caminho dessas visitas.
const CACHE = 'public, max-age=60, s-maxage=600, stale-while-revalidate=3600'

function json(data: unknown, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cache, ...CORS },
  })
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
}

/** Caminho principal: conta de serviço. Enxerga pasta privada, que é a regra aqui. */
async function listWithServiceAccount(folderId: string, env: Env): Promise<DriveFile[] | null> {
  if (!env.GOOGLE_SA_KEY || !env.DB) return null

  let token: string
  try {
    token = await getAccessToken({ DB: env.DB, GOOGLE_SA_KEY: env.GOOGLE_SA_KEY })
  } catch {
    return null
  }

  try {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType)',
      pageSize: '100',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    })
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = await res.json<{ files?: DriveFile[] }>()
    return data.files ?? []
  } catch {
    return null
  }
}

/**
 * Plano B: o Apps Script, que roda na conta da agência.
 *
 * Existe porque as duas contas não enxergam exatamente as mesmas pastas — a de
 * serviço só vê o que foi compartilhado com ela, e parte das pastas de
 * carrossel foi criada à mão pela equipe. Cair para o segundo caminho é a
 * diferença entre o cliente ver o carrossel e ver uma tela de erro.
 */
async function listWithAppsScript(folderId: string, env: Env): Promise<DriveFile[] | null> {
  if (!env.APPS_SCRIPT_URL) return null
  try {
    const res = await fetch(`${env.APPS_SCRIPT_URL}?folderId=${encodeURIComponent(folderId)}`, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json<{ files?: { id: string; name: string; isFolder?: boolean }[] }>()
    if (!data.files) return null
    // O Apps Script não devolve mime; o nome do arquivo decide, e o
    // `creativeFilesOf` já sabe trabalhar assim.
    return data.files
      .filter(f => !f.isFolder)
      .map(f => ({ id: f.id, name: f.name, mimeType: '' }))
  } catch {
    return null
  }
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed' }, 405)

  const url    = new URL(request.url)
  const token  = url.searchParams.get('token')
  const itemId = url.searchParams.get('itemId')

  if (!token || !itemId || !/^\d+$/.test(itemId)) {
    return json({ ok: false, error: 'token e itemId obrigatórios' }, 400)
  }
  const id = Number(itemId)

  // Dono decidido no servidor, como no `/api/portal`: sem isto, um token válido
  // pediria a pasta de qualquer item e leria o criativo de outro cliente.
  //
  // Dois tipos de token chegam aqui, e os dois provam posse à sua maneira: o do
  // PORTAL é por cliente (então é preciso conferir de quem é o item), e o da
  // REVISÃO INTERNA é por item — casar o token com o item já é a prova. A
  // revisão precisa disto pelo mesmo motivo que o cliente: com link de pasta a
  // página dizia "nenhum arquivo anexado", que é mentira, e o revisor ia parar
  // no Drive para conseguir olhar o carrossel.
  const clientName = await clientForToken(env.DB, token)
  if (clientName) {
    const seeded = seededItem(id)
    let owner: string | null = seeded ? ownerOfItem(id, []) : null
    if (!owner) {
      const custom = await customItem(env.DB, id)
      if (custom) owner = custom.c
    }
    if (!owner) return json({ ok: false, error: 'Not found' }, 404)
    if (owner !== clientName) return json({ ok: false, error: 'Invalid token' }, 403)
  } else {
    const reviewToken = await jsonAt(env.DB, 'sm_review_tokens', [itemId])
    if (reviewToken !== token) return json({ ok: false, error: 'Invalid token' }, 404)
  }

  if (await isItemDeleted(env.DB, id)) return json({ ok: false, error: 'Deleted' }, 404)

  // Só o campo `link`, via JSON1 — nunca `JSON.parse` da linha inteira do
  // `app_data`: foi isso que derrubou o Worker na cara do cliente (Error 1102).
  const state = await itemFields(env.DB, 'sm_states', id, ['link'])
  const link  = typeof state.fields.link === 'string' ? state.fields.link : ''
  const kind  = classifyCreativeLink(link)

  if (kind.kind !== 'folder' || !kind.id) {
    // Não é pasta: a tela já sabe lidar sozinha. Respondemos o tipo para ela
    // não precisar de uma segunda regra do lado dela.
    return json({ ok: true, kind: kind.kind, files: [] }, 200, CACHE)
  }

  const raw = (await listWithServiceAccount(kind.id, env)) ?? (await listWithAppsScript(kind.id, env))
  if (!raw) {
    return json({ ok: false, kind: 'folder', error: 'folder_unreadable', files: [] }, 200, 'no-store')
  }

  const files: CreativeFile[] = creativeFilesOf(raw.map(f => ({
    id: f.id, name: f.name, mimeType: f.mimeType ?? '',
  })))

  return json({
    ok: true,
    kind: 'folder',
    folderId: kind.id,
    files: files.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType })),
  }, 200, CACHE)
}
