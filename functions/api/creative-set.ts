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

/**
 * O que a pasta tinha da última vez.
 *
 * Descoberto na verificação em produção (2026-08-31): a equipe **arquiva o
 * carrossel depois de publicar** — os arquivos saem da pasta e vão para
 * `1 - Postados/9 - SETEMBRO`. A pasta continua existindo, o link do card
 * continua apontando para ela, e a listagem volta vazia. Os arquivos, esses,
 * continuam perfeitamente legíveis pelo id (conferido: `/api/thumb` responde
 * 200 para eles).
 *
 * Ou seja: sem memória, o link que já foi entregue ao cliente morre no dia em
 * que a equipe organiza o Drive — inclusive de um card que ainda está em
 * "ajuste solicitado", que é conversa aberta. É a mesma fragilidade que o
 * espelho no R2 resolveu para arquivo único, e a resposta é a mesma: lembrar.
 *
 * A memória só entra quando a listagem ao vivo vem VAZIA ou falha. Pasta com
 * conteúdo sempre vence — se a arte foi trocada, é a nova que o cliente vê.
 */
const MEMORIA_KEY = 'sm_creative_sets'
const MEMORIA_MAX = 300

interface MemoriaEntrada { files: CreativeFile[]; ts: number }
type Memoria = Record<string, MemoriaEntrada>

async function lerMemoria(db: D1Database, folderId: string): Promise<CreativeFile[] | null> {
  try {
    const row = await db
      .prepare(`SELECT json_extract(value, '$.' || ?) AS entrada FROM app_data WHERE key = ?`)
      .bind(folderId, MEMORIA_KEY)
      .first<{ entrada: string | null }>()
    if (!row?.entrada) return null
    const parsed = JSON.parse(row.entrada) as MemoriaEntrada
    return Array.isArray(parsed?.files) && parsed.files.length > 0 ? parsed.files : null
  } catch {
    return null
  }
}

async function gravarMemoria(db: D1Database, folderId: string, files: CreativeFile[]): Promise<void> {
  try {
    const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(MEMORIA_KEY).first<{ value: string }>()
    const atual: Memoria = row ? JSON.parse(row.value) : {}
    if (atual[folderId] && JSON.stringify(atual[folderId].files) === JSON.stringify(files)) return

    atual[folderId] = { files, ts: Date.now() }

    // Teto por antiguidade: isto é cache, não acervo — e `app_data` é uma linha
    // só, que rota pública nenhuma pode deixar crescer sem limite.
    const chaves = Object.keys(atual)
    if (chaves.length > MEMORIA_MAX) {
      const ordenadas = chaves.sort((a, b) => (atual[a].ts ?? 0) - (atual[b].ts ?? 0))
      for (const k of ordenadas.slice(0, chaves.length - MEMORIA_MAX)) delete atual[k]
    }

    await db.prepare(`
      INSERT INTO app_data (key, value) VALUES (?1, ?2)
      ON CONFLICT(key) DO UPDATE SET
        value   = excluded.value,
        rev     = app_data.rev + 1,
        updated = CURRENT_TIMESTAMP
    `).bind(MEMORIA_KEY, JSON.stringify(atual)).run()
  } catch { /* memória é conforto, não requisito */ }
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx
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

  /**
   * A pasta é de OUTRO cliente?
   *
   * Medido em 2026-08-31: **17 cards apontam para a pasta Publicar de outro
   * cliente** (5 da Casa de Ração para a do Frango d'Água, 12 da LuzioPan para
   * a da Kátia), 16 deles já enviados. Link colado errado, provavelmente na
   * pressa — e antes deste endpoint isso só quebrava a imagem.
   *
   * Com a resolução de pasta funcionando, o mesmo erro passaria a ENTREGAR o
   * criativo de um cliente para outro, com token válido e tudo. Hoje essas
   * pastas respondem vazias e nada vazou, mas isso é sorte, não desenho.
   *
   * A checagem só pega pasta registrada em `drive_folders` — subpasta e pasta
   * avulsa continuam fora do alcance sem custar uma volta extra no Drive por
   * abertura. É o corte que dá para fazer com uma consulta local.
   *
   * Vale só para o token do PORTAL (`clientName` preenchido). Na revisão
   * interna quem abre é a agência, que já enxerga o Drive inteiro — barrar ali
   * esconderia o problema de quem precisa corrigi-lo.
   */
  const donaDaPasta = await env.DB
    .prepare('SELECT client_name FROM drive_folders WHERE folder_id = ? LIMIT 1')
    .bind(kind.id)
    .first<{ client_name: string }>()
    .catch(() => null)

  if (donaDaPasta?.client_name && clientName && donaDaPasta.client_name !== clientName) {
    return json({ ok: false, kind: 'folder', files: [], error: 'folder_outro_cliente' }, 403, 'no-store')
  }

  // Lista vazia NÃO prova pasta vazia: a conta de serviço enxerga a pasta (ela
  // aparece na listagem do pai) e mesmo assim pode não enxergar o conteúdo. Por
  // isso o Apps Script é tentado também quando o primeiro caminho volta vazio, e
  // não só quando ele falha.
  const viaSA = await listWithServiceAccount(kind.id, env)
  const raw = viaSA && viaSA.length > 0
    ? viaSA
    : ((await listWithAppsScript(kind.id, env)) ?? viaSA)

  const files: CreativeFile[] = creativeFilesOf((raw ?? []).map(f => ({
    id: f.id, name: f.name, mimeType: f.mimeType ?? '',
  })))

  if (files.length > 0) {
    ctx.waitUntil(gravarMemoria(env.DB, kind.id, files))
    return json({
      ok: true, kind: 'folder', folderId: kind.id, lembrado: false,
      files: files.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType })),
    }, 200, CACHE)
  }

  // Pasta vazia ou ilegível agora: vale o que ela tinha da última vez. Os
  // arquivos continuam sendo lidos pelo id, mesmo depois de arquivados.
  const lembrados = await lerMemoria(env.DB, kind.id)
  if (lembrados) {
    return json({
      ok: true, kind: 'folder', folderId: kind.id, lembrado: true,
      files: lembrados.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType })),
    }, 200, CACHE)
  }

  return json({
    ok: false, kind: 'folder', files: [],
    error: raw === null ? 'folder_unreadable' : 'folder_empty',
  }, 200, 'no-store')
}
