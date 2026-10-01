/* functions/api/instagram.ts
   Publicação automática no Instagram e na Página do Facebook do cliente.

   O fluxo: o cliente aprova → o Social revisa (conteúdo, descrição, redes,
   perfil, colab, dia e hora) e programa → esta rota guarda um agendamento POR
   REDE → o cron chama `run` a cada minuto e publica quando o horário chega →
   o card vira Publicado com o link do post.

   As APIs não agendam por nós: publicam na hora da chamada. O "agendado" mora
   aqui, em `ig_scheduled` (nome histórico — guarda as duas redes), e quem
   segura até o horário é o nosso cron.

   GET  ?action=status                        → contas conectadas + agendamentos (sem token)
   GET  ?action=previa&itemId=                → o que sairia em cada rede, antes de programar
   POST { action:'setup', clientName, accessToken, igUserId?, fbPageId? } → conecta (sócio)
   POST { action:'discover', accessToken }                    → Páginas e Instagrams que o token vê (sócio)
   POST { action:'disconnect', clientName }                   → desconecta (sócio)
   POST { action:'schedule', itemId, scheduledAt, redes?, legenda?, colaboradores? }
   POST { action:'reschedule', itemId, scheduledAt }          → muda só o horário do pendente
   POST { action:'cancel', itemId }                           → cancela o que está pendente
   POST { action:'run' }                                      → publica o que venceu (cron)

   ⚠️ Esta rota PUBLICA no perfil do cliente. Por isso exige sessão e cargo
   sempre — não entra no "modo observação" do panel-guard.
*/

import { verifySession, type SessionEnv } from './_lib/session'
import { usuarioDaSessao } from './_lib/access-policy'
import { cargoDe, isSocio } from '../../src/lib/access'
import { classifyCreativeLink, type CreativeFile } from '../../src/lib/creativeLink'
import { customItem, isItemDeleted, itemFields, patchItemFields } from './_lib/appdata'
import { seededItem } from './_lib/catalog'
import { ensureColumn } from './_lib/schema-guard'
import { getAccessToken } from './_lib/google-auth'
import { arquivosDaPasta } from './creative-set'
import { chaveValida } from './midia'
import { dispatchNotification } from './notifications'
import {
  ESTADO_VAZIO, chamar, normalizarColaboradores, perfilDoToken, permalinkDe, planejar, preparar, publicar,
  type ArquivoCriativo, type Graph, type IgEstado, type IgPlano,
} from './_lib/ig-publish'
import { contasDoToken, paginaDoToken, permalinkFacebook, planejarFacebook, publicarNaPagina, type FbPlano } from './_lib/fb-publish'

interface Env extends SessionEnv {
  DB: D1Database
  CRON_SECRET?: string
  GOOGLE_SA_KEY?: string
  APPS_SCRIPT_URL?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_PUBLIC_KEY?: string
  /** Só para teste local: aponta para o simulador em vez da Meta. */
  IG_GRAPH_BASE?: string
}

type Rede = 'instagram' | 'facebook'
const REDES: Rede[] = ['instagram', 'facebook']
const NOME_REDE: Record<Rede, string> = { instagram: 'Instagram', facebook: 'Facebook' }

const GRAPH_PADRAO = 'https://graph.facebook.com/v23.0'
const STATUS_PROGRAMADO = 9
const STATUS_PUBLICADO = 7
/** Limite de legenda do Instagram. */
const MAX_LEGENDA_IG = 2200

/** Quanto antes do horário a mídia começa a ser preparada (Reel demora a processar). */
const ANTECEDENCIA_MS = 20 * 60_000
/** Passou disto do horário sem publicar: desiste e avisa, em vez de postar fora de hora. */
const ATRASO_MAX_MS = 60 * 60_000
const TRAVA_MS = 90_000
const POR_RODADA = 4

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS })
const erro = (msg: string, status = 400) => json({ ok: false, error: msg }, status)
const iso = (ms: number) => new Date(ms).toISOString()

let esquemaOk = false
async function garantirEsquema(db: D1Database): Promise<void> {
  if (esquemaOk) return
  for (const [col, def] of [
    ['plano', 'TEXT'], ['estado', 'TEXT'], ['permalink', 'TEXT'], ['ig_media_id', 'TEXT'],
    ['lock_until', 'INTEGER'], ['created_by', 'TEXT'], ['updated_at', 'TEXT'], ['titulo', 'TEXT'],
    ['rede', "TEXT NOT NULL DEFAULT 'instagram'"],
  ] as const) await ensureColumn(db, 'ig_scheduled', col, def)
  for (const col of ['fb_page_id', 'fb_page_token', 'fb_page_name']) await ensureColumn(db, 'ig_tokens', col, 'TEXT')
  esquemaOk = true
}

// ── Quem está chamando ───────────────────────────────────────────────────

type Chamador = { tipo: 'cron' } | { tipo: 'membro'; user: string } | null

async function quemChama(request: Request, env: Env): Promise<Chamador> {
  const auth = request.headers.get('Authorization') ?? ''
  if (env.CRON_SECRET && auth === `Bearer ${env.CRON_SECRET}`) return { tipo: 'cron' }
  const user = usuarioDaSessao(await verifySession(request.headers.get('Cookie'), env))
  return user ? { tipo: 'membro', user } : null
}

/** Programar e cancelar: quem cuida da programação — sócio e Social Media. */
const podeProgramar = (user: string) => isSocio(user) || cargoDe(user) === 'social'

// ── Contas do cliente ────────────────────────────────────────────────────

interface Conta {
  ig_user_id: string; access_token: string; display_name: string
  fb_page_id: string | null; fb_page_token: string | null; fb_page_name: string | null
}

const temInstagram = (c: Conta | null) => !!c?.ig_user_id && !!c.access_token
const temFacebook = (c: Conta | null) => !!c?.fb_page_id && !!c.fb_page_token

async function contaDo(db: D1Database, cliente: string): Promise<Conta | null> {
  return db.prepare('SELECT ig_user_id, access_token, display_name, fb_page_id, fb_page_token, fb_page_name FROM ig_tokens WHERE client_name = ?')
    .bind(cliente).first<Conta>()
}

// ── O card e o criativo dele ─────────────────────────────────────────────

interface Anexo { key: string; nome: string; tipo: string }
interface CardInfo { cliente: string; tipo: string; titulo: string; link: string; legenda: string; anexos: Anexo[] }

/**
 * Mídia trocada na revisão ("Trocar mídia"): chega no corpo porque o card pode
 * ainda não ter sincronizado. `null` = não veio (vale o que está no card).
 */
function anexosDoCorpo(v: unknown): Anexo[] | null {
  if (!Array.isArray(v)) return null
  const ok = (v as Anexo[]).filter(a => chaveValida(a?.key) && typeof a.tipo === 'string' && typeof a.nome === 'string')
  return ok.length ? ok.map(a => ({ key: a.key, nome: a.nome, tipo: a.tipo })) : null
}

/** Anexos gravados no card (JSON do json_extract), só os de chave válida. */
function lerAnexos(v: unknown): Anexo[] {
  if (typeof v !== 'string' || !v) return []
  try {
    const arr = JSON.parse(v) as Anexo[]
    return Array.isArray(arr) ? arr.filter(a => chaveValida(a?.key) && typeof a.tipo === 'string') : []
  } catch { return [] }
}

async function lerCard(db: D1Database, itemId: number): Promise<CardInfo | null> {
  if (await isItemDeleted(db, itemId)) return null
  const base = seededItem(itemId) ?? await customItem(db, itemId)
  if (!base) return null
  const [st, ed] = await Promise.all([
    itemFields(db, 'sm_states', itemId, ['link', 'caption', 'title', 'anexos']),
    itemFields(db, 'sm_edits', itemId, ['tp', 'n']),
  ])
  const txt = (v: unknown) => (typeof v === 'string' ? v : '')
  return {
    cliente: base.c,
    tipo: txt(ed.fields.tp) || base.tp || 'Post',
    titulo: txt(st.fields.title) || txt(ed.fields.n) || base.n || '',
    link: txt(st.fields.link),
    legenda: txt(st.fields.caption),
    anexos: lerAnexos(st.fields.anexos),
  }
}

/** Nome e tipo de UM arquivo do Drive — do nosso registro, ou do próprio Drive. */
async function metaDoArquivo(env: Env, fileId: string): Promise<ArquivoCriativo | null> {
  const row = await env.DB.prepare('SELECT filename, mime_type FROM drive_videos WHERE drive_file_id = ?')
    .bind(fileId).first<{ filename: string; mime_type: string | null }>().catch(() => null)
  if (row?.filename && row.mime_type) return { id: fileId, name: row.filename, mimeType: row.mime_type }
  if (!env.GOOGLE_SA_KEY) return row?.filename ? { id: fileId, name: row.filename } : null
  try {
    const token = await getAccessToken({ DB: env.DB, GOOGLE_SA_KEY: env.GOOGLE_SA_KEY })
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return row?.filename ? { id: fileId, name: row.filename } : null
    const d = await res.json<{ name?: string; mimeType?: string }>()
    return d.name ? { id: fileId, name: d.name, mimeType: d.mimeType } : null
  } catch {
    return row?.filename ? { id: fileId, name: row.filename } : null
  }
}

type Criativo = { ok: true; arquivos: ArquivoCriativo[] } | { ok: false; motivo: string }

async function criativoDoCard(env: Env, card: CardInfo): Promise<Criativo> {
  // Anexado no painel manda sobre o link: é o que a pessoa escolheu ao criar a publicação.
  if (card.anexos.length) return { ok: true, arquivos: card.anexos.map(a => ({ id: a.key, name: a.nome, mimeType: a.tipo, anexo: a.key })) }
  const c = classifyCreativeLink(card.link)
  if (c.kind === 'none') return { ok: false, motivo: 'O card não tem criativo anexado.' }
  if (c.kind === 'file' && c.id) {
    const meta = await metaDoArquivo(env, c.id)
    if (!meta) return { ok: false, motivo: 'Não consegui ler o arquivo do criativo no Drive (ele está compartilhado com a agência?).' }
    return { ok: true, arquivos: [meta] }
  }
  if (c.kind === 'folder' && c.id) {
    const files: CreativeFile[] = await arquivosDaPasta(c.id, env)
    if (files.length === 0) return { ok: false, motivo: 'A pasta do criativo está vazia ou não pôde ser lida.' }
    return { ok: true, arquivos: files }
  }
  return { ok: false, motivo: 'O criativo precisa ser um arquivo ou pasta do Drive para publicar sozinho.' }
}

function graphDe(env: Env, token: string): Graph {
  return { base: (env.IG_GRAPH_BASE || GRAPH_PADRAO).replace(/\/$/, ''), token }
}

const urlDaMidia = (origem: string) => (f: ArquivoCriativo, video: boolean) => f.anexo
  ? `${origem}/api/midia?k=${encodeURIComponent(f.anexo)}`
  : `${origem}/api/stream?id=${encodeURIComponent(f.id)}&kind=${video ? 'video' : 'image'}`

// O que sairia em cada rede: o mesmo cálculo da prévia e do agendamento.
type PlanoRede =
  | { rede: 'instagram'; ok: true; plano: IgPlano }
  | { rede: 'facebook'; ok: true; plano: FbPlano }
  | { rede: Rede; ok: false; motivo: string }

function planoDaRede(rede: Rede, conta: Conta | null, card: CardInfo, arquivos: ArquivoCriativo[], origem: string): PlanoRede {
  if (rede === 'instagram') {
    if (!temInstagram(conta)) return { rede, ok: false, motivo: `${card.cliente} não tem Instagram conectado ao painel.` }
    const p = planejar(card.tipo, arquivos, urlDaMidia(origem))
    return p.ok ? { rede, ok: true, plano: p.plano } : { rede, ok: false, motivo: p.motivo }
  }
  if (!temFacebook(conta)) return { rede, ok: false, motivo: `${card.cliente} não tem Página do Facebook conectada ao painel.` }
  const p = planejarFacebook(card.tipo, arquivos, urlDaMidia(origem))
  return p.ok ? { rede, ok: true, plano: p.plano } : { rede, ok: false, motivo: p.motivo }
}

const descricaoDoPlano = (p: PlanoRede) => !p.ok ? null
  : p.rede === 'instagram' ? { tipo: p.plano.tipo, pecas: p.plano.midias.length }
  : { tipo: p.plano.tipo, pecas: p.plano.midias.length }

// ── Ações do painel ──────────────────────────────────────────────────────

async function status(env: Env): Promise<Response> {
  const [contas, ags] = await Promise.all([
    env.DB.prepare('SELECT client_name, ig_user_id, display_name, fb_page_id, fb_page_name, updated FROM ig_tokens ORDER BY client_name')
      .all<{ client_name: string; ig_user_id: string; display_name: string; fb_page_id: string | null; fb_page_name: string | null; updated: string }>(),
    env.DB.prepare(`
      SELECT item_id, client_name, scheduled_at, media_type, status, error, permalink, rede
        FROM ig_scheduled
       WHERE status IN ('pending', 'publishing', 'failed')
          OR (status = 'published' AND published_at >= datetime('now', '-14 days'))
       ORDER BY created_at ASC
       LIMIT 600
    `).all<{ item_id: number; client_name: string; scheduled_at: string; media_type: string; status: string; error: string | null; permalink: string | null; rede: string | null }>(),
  ])
  return json({
    ok: true,
    conectados: contas.results.map(c => ({
      clientName: c.client_name,
      perfil: c.ig_user_id ? c.display_name : '',
      pagina: c.fb_page_id ? (c.fb_page_name ?? '') : '',
      desde: c.updated,
    })),
    agendamentos: ags.results.map(a => ({
      itemId: a.item_id, clientName: a.client_name, quando: a.scheduled_at, tipo: a.media_type,
      status: a.status, erro: a.error, permalink: a.permalink, rede: (a.rede ?? 'instagram') as Rede,
    })),
  })
}

async function previa(env: Env, request: Request, itemId: number, anexos: Anexo[] | null = null): Promise<Response> {
  const lido = await lerCard(env.DB, itemId)
  if (!lido) return erro('Card não encontrado.', 404)
  const card = anexos ? { ...lido, anexos } : lido
  const conta = await contaDo(env.DB, card.cliente)
  const criativo = await criativoDoCard(env, card)
  const origem = new URL(request.url).origin
  const redes = Object.fromEntries(REDES.map(rede => {
    const conectado = rede === 'instagram' ? temInstagram(conta) : temFacebook(conta)
    const destino = rede === 'instagram' ? (conta?.display_name ?? '') : (conta?.fb_page_name ?? '')
    if (!criativo.ok) return [rede, { conectado, destino, ok: false, motivo: criativo.motivo }]
    const p = planoDaRede(rede, conta, card, criativo.arquivos, origem)
    return [rede, p.ok ? { conectado, destino, ok: true, ...descricaoDoPlano(p) } : { conectado, destino, ok: false, motivo: p.motivo }]
  }))
  return json({
    ok: true,
    cliente: card.cliente, tipo: card.tipo, titulo: card.titulo, legenda: card.legenda,
    arquivos: criativo.ok ? criativo.arquivos.map(f => ({
      id: f.id, name: f.name,
      video: /^video\//.test(f.mimeType ?? '') || /\.(mp4|mov|m4v)$/i.test(f.name),
      // Anexo não é do Drive: a prévia sai do próprio arquivo, não do /api/thumb.
      url: f.anexo ? `/api/midia?k=${encodeURIComponent(f.anexo)}` : null,
    })) : [],
    motivoCriativo: criativo.ok ? null : criativo.motivo,
    ...redes,
  })
}

async function conectar(env: Env, body: Record<string, unknown>): Promise<Response> {
  const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const clientName = txt(body.clientName)
  const igUserId = txt(body.igUserId)
  const fbPageId = txt(body.fbPageId)
  const accessToken = txt(body.accessToken) || await tokenSalvo(env)
  if (!clientName || !accessToken) return erro('Cliente e token são obrigatórios.')
  if (!igUserId && !fbPageId) return erro('Informe o ID do Instagram, o da Página do Facebook, ou os dois.')
  if (igUserId && !/^\d{5,25}$/.test(igUserId)) return erro('O ID do Instagram é só números (o "Instagram Business Account ID").')
  if (fbPageId && !/^\d{5,25}$/.test(fbPageId)) return erro('O ID da Página do Facebook é só números.')

  const g = graphDe(env, accessToken)
  let perfil = ''
  if (igUserId) {
    const r = await perfilDoToken(g, igUserId)
    if (!r.ok) return erro(`O Instagram recusou esse token: ${r.erro}`)
    perfil = r.data.username ? `@${r.data.username}` : (r.data.name ?? '')
  }
  let pagina = '', paginaToken = ''
  if (fbPageId) {
    const r = await paginaDoToken(g, fbPageId)
    if (!r.ok) return erro(`O Facebook recusou esse token para a Página: ${r.erro}`)
    if (!r.data.access_token) return erro('O token não tem permissão para publicar nessa Página (falta pages_manage_posts).')
    pagina = r.data.name ?? ''
    paginaToken = r.data.access_token
  }

  await env.DB.prepare(`
    INSERT INTO ig_tokens (client_name, ig_user_id, access_token, display_name, fb_page_id, fb_page_token, fb_page_name, updated)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP)
    ON CONFLICT(client_name) DO UPDATE SET
      ig_user_id = excluded.ig_user_id, access_token = excluded.access_token, display_name = excluded.display_name,
      fb_page_id = excluded.fb_page_id, fb_page_token = excluded.fb_page_token, fb_page_name = excluded.fb_page_name,
      updated = CURRENT_TIMESTAMP
  `).bind(clientName, igUserId, accessToken, perfil, fbPageId || null, paginaToken || null, pagina || null).run()
  return json({ ok: true, perfil, pagina })
}

const PERMISSOES_NECESSARIAS = [
  'instagram_basic', 'instagram_content_publish', 'pages_show_list',
  'pages_read_engagement', 'pages_manage_posts', 'business_management',
]

/** O que o token enxerga — para conectar vários clientes sem caçar ID na Meta. */
/**
 * O token já salvo (o mesmo usuário do sistema para todos os clientes): permite
 * buscar e conectar contas novas sem colar o token de novo. Nunca volta para o
 * navegador — só é usado aqui no servidor.
 */
async function tokenSalvo(env: Env): Promise<string> {
  const row = await env.DB.prepare(
    "SELECT access_token FROM ig_tokens WHERE access_token IS NOT NULL AND access_token <> '' ORDER BY updated DESC LIMIT 1",
  ).first<{ access_token: string }>().catch(() => null)
  return row?.access_token ?? ''
}

async function descobrir(env: Env, body: Record<string, unknown>): Promise<Response> {
  const colado = typeof body.accessToken === 'string' ? body.accessToken.trim() : ''
  const accessToken = colado || await tokenSalvo(env)
  if (!accessToken) return erro('Cole o token de acesso.')
  const g = graphDe(env, accessToken)
  const r = await contasDoToken(g)
  if (!r.ok) return erro(`A Meta recusou esse token: ${r.erro}`)
  // Sem instagram_basic a Meta devolve a Página "sem Instagram" em silêncio —
  // dizer qual permissão falta poupa a caça no Gerenciador.
  const perms = await chamar<{ data?: { permission: string; status: string }[] }>(g, 'GET', '/me/permissions', {})
  const concedidas = perms.ok ? new Set((perms.data.data ?? []).filter(p => p.status === 'granted').map(p => p.permission)) : null
  const faltando = concedidas ? PERMISSOES_NECESSARIAS.filter(p => !concedidas.has(p)) : []
  // De quem é o token: é a ESSE usuário do sistema que as Páginas novas precisam ser dadas.
  const me = await chamar<{ name?: string }>(g, 'GET', '/me', { fields: 'name' })
  return json({ ok: true, contas: r.contas, faltando, usuario: me.ok ? (me.data.name ?? '') : '', tokenSalvo: !colado })
}

async function desconectar(env: Env, body: Record<string, unknown>): Promise<Response> {
  const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : ''
  if (!clientName) return erro('Cliente obrigatório.')
  await env.DB.batch([
    env.DB.prepare('DELETE FROM ig_tokens WHERE client_name = ?').bind(clientName),
    env.DB.prepare(`UPDATE ig_scheduled SET status = 'cancelled', error = 'As contas do cliente foram desconectadas.', updated_at = ?2
                     WHERE client_name = ?1 AND status = 'pending'`).bind(clientName, iso(Date.now())),
  ])
  return json({ ok: true })
}

async function agendar(env: Env, request: Request, body: Record<string, unknown>, user: string): Promise<Response> {
  const itemId = Number(body.itemId)
  const quando = Number(body.scheduledAt)
  if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isFinite(quando)) return erro('itemId e scheduledAt são obrigatórios.')
  if (quando < Date.now() - 60_000) return erro('O horário escolhido já passou.')

  const colab = normalizarColaboradores(body.colaboradores)
  if (!colab.ok) return erro(colab.motivo)

  const lido = await lerCard(env.DB, itemId)
  if (!lido) return erro('Card não encontrado.', 404)
  const trocados = anexosDoCorpo(body.anexos)
  const card = trocados ? { ...lido, anexos: trocados } : lido
  // A descrição revisada na tela vale sobre a do card (o card pode ainda não
  // ter sincronizado a edição quando esta chamada chega).
  const legenda = typeof body.legenda === 'string' ? body.legenda : card.legenda

  const pedidas: Rede[] = Array.isArray(body.redes)
    ? REDES.filter(r => (body.redes as unknown[]).includes(r))
    : REDES

  // Um card, um agendamento por rede: o que estava pendente sai.
  await env.DB.prepare(`UPDATE ig_scheduled SET status = 'cancelled', updated_at = ?2 WHERE item_id = ?1 AND status = 'pending'`)
    .bind(itemId, iso(Date.now())).run()

  const conta = await contaDo(env.DB, card.cliente)
  const criativo = pedidas.length ? await criativoDoCard(env, card) : null
  const origem = new URL(request.url).origin
  const agora = iso(Date.now())
  const resultado: Record<string, unknown> = {}

  for (const rede of pedidas) {
    const destino = rede === 'instagram' ? (conta?.display_name ?? '') : (conta?.fb_page_name ?? '')
    if (!criativo?.ok) { resultado[rede] = { automatico: false, destino, motivo: criativo?.motivo ?? '' }; continue }
    if (rede === 'instagram' && legenda.length > MAX_LEGENDA_IG) {
      resultado[rede] = { automatico: false, destino, motivo: `A descrição tem ${legenda.length} caracteres; o Instagram aceita até ${MAX_LEGENDA_IG}.` }
      continue
    }
    const p = planoDaRede(rede, conta, card, criativo.arquivos, origem)
    if (!p.ok) { resultado[rede] = { automatico: false, destino, motivo: p.motivo }; continue }
    const plano = p.rede === 'instagram' ? { ...p.plano, colaboradores: colab.lista } : p.plano
    await env.DB.prepare(`
      INSERT INTO ig_scheduled (id, client_name, item_id, scheduled_at, image_url, caption, media_type, status, created_at, plano, estado, created_by, updated_at, titulo, rede)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?9, ?10, ?11, ?8, ?12, ?13)
    `).bind(
      crypto.randomUUID(), card.cliente, itemId, iso(quando), plano.midias[0].url, legenda,
      plano.tipo, agora, JSON.stringify(plano), JSON.stringify(ESTADO_VAZIO), user, card.titulo, rede,
    ).run()
    resultado[rede] = { automatico: true, destino, ...descricaoDoPlano(p) }
  }

  return json({ ok: true, ...resultado })
}

/**
 * Só o horário muda (card arrastado para outro dia, hora trocada). Redes,
 * descrição e colab ficam como o Social revisou. A mídia já preparada no
 * Instagram não depende do horário, então o estado é mantido.
 */
async function remarcar(env: Env, body: Record<string, unknown>): Promise<Response> {
  const itemId = Number(body.itemId)
  const quando = Number(body.scheduledAt)
  if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isFinite(quando)) return erro('itemId e scheduledAt são obrigatórios.')
  if (quando < Date.now() - 60_000) return erro('O horário escolhido já passou.')
  const res = await env.DB.prepare(
    `UPDATE ig_scheduled SET scheduled_at = ?2, updated_at = ?3 WHERE item_id = ?1 AND status = 'pending'`,
  ).bind(itemId, iso(quando), iso(Date.now())).run()
  return json({ ok: true, movidos: res.meta?.changes ?? 0 })
}

async function cancelar(env: Env, body: Record<string, unknown>): Promise<Response> {
  const itemId = Number(body.itemId)
  if (!Number.isInteger(itemId) || itemId <= 0) return erro('itemId obrigatório.')
  const res = await env.DB.prepare(
    `UPDATE ig_scheduled SET status = 'cancelled', updated_at = ?2 WHERE item_id = ?1 AND status IN ('pending', 'failed')`,
  ).bind(itemId, iso(Date.now())).run()
  return json({ ok: true, cancelados: res.meta?.changes ?? 0 })
}

// ── O relógio: publica o que venceu ──────────────────────────────────────

interface Linha {
  id: string; client_name: string; item_id: number; scheduled_at: string; caption: string
  plano: string | null; estado: string | null; titulo: string | null; rede: string | null
  ig_user_id: string | null; access_token: string | null; fb_page_id: string | null; fb_page_token: string | null
}

async function encerrar(env: Env, l: Linha, statusFinal: 'failed' | 'cancelled', motivo: string): Promise<void> {
  await env.DB.prepare(`UPDATE ig_scheduled SET status = ?2, error = ?3, updated_at = ?4 WHERE id = ?1`)
    .bind(l.id, statusFinal, motivo, iso(Date.now())).run()
  if (statusFinal === 'failed') {
    const rede = NOME_REDE[(l.rede ?? 'instagram') as Rede]
    await dispatchNotification(env, {
      id: crypto.randomUUID(), type: 'ig_failed', clientName: l.client_name,
      itemId: l.item_id, itemTitle: l.titulo || 'Conteúdo', ts: Date.now(), note: `${rede}: ${motivo}`,
    }).catch(() => {})
  }
}

/** Marca o card como publicado — o status só na PRIMEIRA rede que sair; o link de cada uma. */
async function marcarPublicado(env: Env, l: Linha, cardStatus: number, link: string | null): Promise<void> {
  const quando = Date.now()
  const rede = (l.rede ?? 'instagram') as Rede
  const campos: Record<string, string | number> = {}
  if (cardStatus !== STATUS_PUBLICADO) { campos.status = STATUS_PUBLICADO; campos.publishedAt = quando }
  if (link) campos[rede === 'instagram' ? 'igPermalink' : 'fbPermalink'] = link
  if (Object.keys(campos).length) await patchItemFields(env.DB, l.item_id, campos)
  await dispatchNotification(env, {
    id: crypto.randomUUID(), type: 'ig_published', clientName: l.client_name,
    itemId: l.item_id, itemTitle: l.titulo || 'Conteúdo', ts: quando, note: NOME_REDE[rede],
  }).catch(() => {})
}

async function processar(env: Env, l: Linha, agora: number): Promise<string> {
  const horario = Date.parse(l.scheduled_at)
  const rede = (l.rede ?? 'instagram') as Rede

  // O CARD manda: se saiu de Programado, ou mudou de horário, não publica. A
  // exceção é a outra rede do mesmo card já ter publicado (ele virou 7 por nós).
  const card = await itemFields(env.DB, 'sm_states', l.item_id, ['status', 'programadoPara'])
  if (!card.ok) return 'card ilegível — tenta no próximo minuto'
  const status = Number(card.fields.status)
  let valido = status === STATUS_PROGRAMADO && Math.abs(Number(card.fields.programadoPara) - horario) < 60_000
  if (!valido && status === STATUS_PUBLICADO) {
    const irma = await env.DB.prepare(`SELECT 1 FROM ig_scheduled WHERE item_id = ?1 AND id != ?2 AND status = 'published' LIMIT 1`)
      .bind(l.item_id, l.id).first()
    valido = !!irma
  }
  if (!valido) {
    // O card recém-programado pode ainda não ter sincronizado: folga antes de cancelar.
    if (agora < horario - 2 * 60_000) return 'aguardando o card sincronizar'
    await encerrar(env, l, 'cancelled', 'O card saiu de Programado (ou mudou de horário) antes da publicação.')
    return 'cancelado — card não está mais programado'
  }

  if (agora - horario > ATRASO_MAX_MS) {
    await encerrar(env, l, 'failed', 'Passou mais de 1h do horário sem conseguir publicar. Programe de novo.')
    return 'falhou — atraso'
  }

  // ── Facebook: sem preparação, tudo no horário ──
  if (rede === 'facebook') {
    if (!l.fb_page_id || !l.fb_page_token) {
      await encerrar(env, l, 'failed', 'A Página do Facebook do cliente foi desconectada do painel.')
      return 'falhou — sem conexão'
    }
    if (agora < horario) return 'aguardando o horário'
    let plano: FbPlano
    try { plano = JSON.parse(l.plano ?? '') as FbPlano } catch { await encerrar(env, l, 'failed', 'Agendamento corrompido — programe de novo.'); return 'falhou' }
    const posse = await env.DB.prepare(`UPDATE ig_scheduled SET status = 'publishing', updated_at = ?2 WHERE id = ?1 AND status = 'pending'`)
      .bind(l.id, iso(Date.now())).run()
    if ((posse.meta?.changes ?? 0) !== 1) return 'já em andamento'
    const g = graphDe(env, l.fb_page_token)
    const r = await publicarNaPagina(g, l.fb_page_id, plano, l.caption)
    if (!r.ok) { await encerrar(env, l, 'failed', r.erro); return `falhou — ${r.erro}` }
    const link = await permalinkFacebook(g, r.id)
    await env.DB.prepare(`UPDATE ig_scheduled SET status = 'published', published_at = CURRENT_TIMESTAMP, error = NULL, ig_media_id = ?2, permalink = ?3, updated_at = ?4 WHERE id = ?1`)
      .bind(l.id, r.id, link, iso(Date.now())).run()
    await marcarPublicado(env, l, status, link)
    return 'publicado'
  }

  // ── Instagram: prepara antes, publica no horário ──
  if (!l.ig_user_id || !l.access_token) {
    await encerrar(env, l, 'failed', 'O Instagram do cliente foi desconectado do painel.')
    return 'falhou — sem conexão'
  }
  let plano: IgPlano
  let estado: IgEstado
  try {
    plano = JSON.parse(l.plano ?? '') as IgPlano
    estado = l.estado ? JSON.parse(l.estado) as IgEstado : ESTADO_VAZIO
  } catch {
    await encerrar(env, l, 'failed', 'Agendamento corrompido — programe o card de novo.')
    return 'falhou'
  }

  const g = graphDe(env, l.access_token)
  const passo = await preparar(g, l.ig_user_id, plano, l.caption, estado)
  await env.DB.prepare(`UPDATE ig_scheduled SET estado = ?2, updated_at = ?3 WHERE id = ?1`)
    .bind(l.id, JSON.stringify(passo.estado), iso(Date.now())).run()

  if (passo.tipo === 'falhou') { await encerrar(env, l, 'failed', passo.erro); return `falhou — ${passo.erro}` }
  if (passo.tipo === 'esperar') return 'Instagram processando a mídia'
  if (agora < horario) return 'pronto, aguardando o horário'

  // Daqui não tem volta. A marca "publicando" entra ANTES da chamada: se o
  // processo cair no meio, a linha não volta a ser tentada sozinha.
  const posse = await env.DB.prepare(`UPDATE ig_scheduled SET status = 'publishing', updated_at = ?2 WHERE id = ?1 AND status = 'pending'`)
    .bind(l.id, iso(Date.now())).run()
  if ((posse.meta?.changes ?? 0) !== 1) return 'já em andamento'

  const pub = await publicar(g, l.ig_user_id, passo.estado.criacao!)
  if (!pub.ok) { await encerrar(env, l, 'failed', pub.erro); return `falhou — ${pub.erro}` }

  const link = await permalinkDe(g, pub.data.id)
  await env.DB.prepare(`UPDATE ig_scheduled SET status = 'published', published_at = CURRENT_TIMESTAMP, error = NULL, ig_media_id = ?2, permalink = ?3, updated_at = ?4 WHERE id = ?1`)
    .bind(l.id, pub.data.id, link, iso(Date.now())).run()
  await marcarPublicado(env, l, status, link)
  return 'publicado'
}

async function rodar(env: Env): Promise<Response> {
  const agora = Date.now()

  // Ficou em "publicando" e o processo morreu: NÃO tenta de novo sozinho — o
  // post pode ter saído. Vira falha com aviso para alguém conferir o perfil.
  await env.DB.prepare(`
    UPDATE ig_scheduled
       SET status = 'failed', updated_at = ?2,
           error = 'A publicação foi interrompida no meio. Confira o perfil antes de programar de novo — o post pode ter saído.'
     WHERE status = 'publishing' AND updated_at < ?1
  `).bind(iso(agora - 10 * 60_000), iso(agora)).run()

  const { results } = await env.DB.prepare(`
    SELECT s.id, s.client_name, s.item_id, s.scheduled_at, s.caption, s.plano, s.estado, s.titulo, s.rede,
           t.ig_user_id, t.access_token, t.fb_page_id, t.fb_page_token
      FROM ig_scheduled s
      LEFT JOIN ig_tokens t ON t.client_name = s.client_name
     WHERE s.status = 'pending' AND s.scheduled_at <= ?1
       AND (s.lock_until IS NULL OR s.lock_until < ?2)
     ORDER BY s.scheduled_at ASC, s.rede DESC
     LIMIT ?3
  `).bind(iso(agora + ANTECEDENCIA_MS), agora, POR_RODADA).all<Linha>()

  const feito: { itemId: number; rede: string; resultado: string }[] = []
  for (const l of results) {
    // Trava a linha: dois ticks do cron não podem pegar o mesmo post.
    const trava = await env.DB.prepare(`
      UPDATE ig_scheduled SET lock_until = ?2
       WHERE id = ?1 AND status = 'pending' AND (lock_until IS NULL OR lock_until < ?3)
    `).bind(l.id, agora + TRAVA_MS, agora).run()
    if ((trava.meta?.changes ?? 0) !== 1) continue
    try {
      feito.push({ itemId: l.item_id, rede: l.rede ?? 'instagram', resultado: await processar(env, l, agora) })
    } finally {
      // Terminado o trabalho a trava sai — senão o tick seguinte pularia a linha.
      await env.DB.prepare('UPDATE ig_scheduled SET lock_until = NULL WHERE id = ?').bind(l.id).run().catch(() => {})
    }
  }
  return json({ ok: true, processados: feito })
}

// ── Rota ─────────────────────────────────────────────────────────────────

async function tratar(ctx: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = ctx
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })

  const quem = await quemChama(request, env)
  if (!quem) return erro('Sessão necessária.', 401)

  try {
    await garantirEsquema(env.DB)

    if (request.method === 'GET') {
      if (quem.tipo !== 'membro' || !podeProgramar(quem.user)) return erro('Sem permissão.', 403)
      const url = new URL(request.url)
      const action = url.searchParams.get('action')
      if (action === 'status') return status(env)
      if (action === 'previa') {
        const itemId = Number(url.searchParams.get('itemId'))
        if (!Number.isInteger(itemId) || itemId <= 0) return erro('itemId obrigatório.')
        return previa(env, request, itemId)
      }
      return erro('Ação desconhecida.')
    }

    if (request.method !== 'POST') return erro('Método não suportado.', 405)
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action : ''

    if (action === 'run') {
      if (quem.tipo !== 'cron' && !podeProgramar(quem.user)) return erro('Sem permissão.', 403)
      return rodar(env)
    }

    if (quem.tipo !== 'membro') return erro('Sem permissão.', 403)
    if (action === 'setup' || action === 'disconnect' || action === 'discover') {
      // Conectar as contas de um cliente é entregar a chave dele: só sócio.
      if (!isSocio(quem.user)) return erro('Só os sócios conectam ou desconectam as contas de um cliente.', 403)
      if (action === 'discover') return descobrir(env, body)
      return action === 'setup' ? conectar(env, body) : desconectar(env, body)
    }
    if (!podeProgramar(quem.user)) return erro('Sem permissão.', 403)
    if (action === 'schedule') return agendar(env, request, body, quem.user)
    if (action === 'previa') {
      const itemId = Number(body.itemId)
      if (!Number.isInteger(itemId) || itemId <= 0) return erro('itemId obrigatório.')
      return previa(env, request, itemId, anexosDoCorpo(body.anexos))
    }
    if (action === 'reschedule') return remarcar(env, body)
    if (action === 'cancel') return cancelar(env, body)
    return erro('Ação desconhecida.')
  } catch (e) {
    console.error('[instagram]', e instanceof Error ? e.stack : e)
    return erro(e instanceof Error ? e.message : 'Erro interno.', 500)
  }
}

/**
 * Nenhuma falha sai como página de erro da Cloudflare: o painel mostrava só
 * "Erro 500" e ninguém sabia o motivo. Aqui vira JSON com a mensagem, e o
 * stack vai para o log (`wrangler pages deployment tail`).
 */
export const onRequest = async (ctx: { request: Request; env: Env }): Promise<Response> => {
  try {
    return await tratar(ctx)
  } catch (e) {
    console.error('[instagram] falha fora do tratamento', e instanceof Error ? e.stack : e)
    return erro(`Falha interna: ${e instanceof Error ? e.message : String(e)}`, 500)
  }
}
