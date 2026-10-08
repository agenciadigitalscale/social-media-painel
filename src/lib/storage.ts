import type { Client, ContentItem, ContentType, ItemState, Roteiro } from '../types'
import { migrateStatus } from '../types'
import { DATA } from '../data'
import { reconcile } from './reconcile'

export function serializeItem(item: ContentItem) {
  return { ...item, dt: item.dt.toISOString() }
}

export function deserializeItem(raw: Record<string, unknown>): ContentItem {
  return { ...raw, dt: new Date(raw.dt as string) } as ContentItem
}

export function loadStates(): Record<number, ItemState> {
  const MIGRATION_KEY = 'sm_v2_migrated'
  try {
    const raw = localStorage.getItem('sm_states')
    if (raw) {
      const parsed = JSON.parse(raw) as Record<number, ItemState>
      if (!localStorage.getItem(MIGRATION_KEY)) {
        const migrated: Record<number, ItemState> = {}
        for (const [id, s] of Object.entries(parsed)) {
          migrated[Number(id)] = { ...s, status: migrateStatus(s.status) }
        }
        localStorage.setItem('sm_states', JSON.stringify(migrated))
        localStorage.setItem(MIGRATION_KEY, '1')
        return migrated
      }
      return parsed
    }
  } catch {}
  localStorage.setItem(MIGRATION_KEY, '1')
  const initial: Record<number, ItemState> = {}
  DATA.forEach(item => {
    initial[item.i] = { status: migrateStatus(item.s), title: '', link: '', caption: '', notes: '' }
  })
  return initial
}

export function loadCustomItems(): ContentItem[] {
  try {
    const raw = localStorage.getItem('sm_custom')
    if (!raw) return []
    return JSON.parse(raw).map(deserializeItem)
  } catch { return [] }
}

export function loadDeletedIds(): number[] {
  try {
    const raw = localStorage.getItem('sm_deleted')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function loadEditedItems(): Record<number, { dt?: string; tp?: ContentType; n?: string }> {
  try {
    const raw = localStorage.getItem('sm_edits')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function loadRoteiros(): Record<string, Roteiro[]> {
  try {
    const raw = localStorage.getItem('sm_roteiros')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function loadClientFolders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sm_client_folders')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function loadExtraClients(): Client[] {
  try {
    const raw = localStorage.getItem('sm_extra_clients')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function loadHiddenClients(): string[] {
  try {
    const raw = localStorage.getItem('sm_hidden_clients')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function loadClientColors(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sm_client_colors')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function loadClientHashtags(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem('sm_client_hashtags')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function loadCaptionTemplates(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem('sm_caption_templates')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function loadPublishFolders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sm_publish_folders')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export const SYNC_KEYS = [
  'sm_states',
  'sm_custom',
  'sm_deleted',
  'sm_edits',
  'sm_roteiros',
  'sm_client_folders',
  'sm_extra_clients',
  'sm_hidden_clients',
  'sm_client_colors',
  'sm_client_hashtags',
  'sm_caption_templates',
  'sm_financeiro',
  'sm_trafego',
  'sm_roteiro_ideias_junho_2026',
  'sm_upload_notifications',
  'sm_upload_tasks',
  'sm_publish_folders',
  'sm_client_phones',
  'sm_client_groups',
  'sm_handoffs',
  'sm_assets',
  'sm_creatives',
  'sm_creative_presets',
  'sm_onboardings',
  'sm_customer_health',
  'sm_health_history',
  'sm_media_links',
  'sm_drive_inbox_state',
  'sm_ready_automation',
  'sm_pesq_publicacoes',
  'sm_pesq_config',
  'sm_paineis',
  'sm_card_painel',
  'sm_producao_manual',
  'sm_producao_ajuste_manual',
  'sm_producao_excluir',
  'sm_designer_fechamento',
  'sm_padrao_editorial',
  // Calendário (2026-10-01): preferências por mês, carteira mensal e capacidade da fila.
  // Ramo próprio no applyRemoteSync do App (junto com o do padrão).
  'sm_pref_mes',
  'sm_carteira',
  'sm_capacidade_entrega',
  'sm_ordem_clientes',
  // Base global de etiquetas (nome + cor) — 2026-10-06.
  'sm_etiquetas',
] as const

export type SyncKey = (typeof SYNC_KEYS)[number]

// ── Fila de sync offline ──────────────────────────────────────────────────────
// Cada entrada representa uma chave que precisa ser sincronizada com o D1.
// Se offline, as entradas ficam na fila até a conexão ser restaurada.

const QUEUE_KEY     = 'sm_sync_queue'

// ── Diagnóstico de sincronização (opt-in) ──────────────────────────────────
// Liga com localStorage.ds_debug_sync = '1' e F5. Escreve no console cada
// passo do status de um card: fila, envio, confirmação e o que chega do
// servidor. Desligado, não custa nada.
let _reqSeq = 0
export function debugSyncOn(): boolean {
  try { return localStorage.getItem('ds_debug_sync') === '1' } catch { return false }
}
export function debugSync(tag: string, data: Record<string, unknown>): void {
  if (!debugSyncOn()) return
  console.info(`[${tag}]`, new Date().toISOString().slice(11, 23), data)
}
/** id → status das entradas de um patch/valor de sm_states (só para o log). */
function statusDasEntradas(raw: string): Record<string, unknown> {
  const m = parseMap(raw); const out: Record<string, unknown> = {}
  if (!m) return out
  for (const [id, e] of Object.entries(m)) out[id] = (e as { status?: unknown })?.status
  return out
}
let   _pendingCount = 0

/*
 * FILA POR ABA (2026-10-08). A fila mora no localStorage, que é COMPARTILHADO
 * entre as abas do mesmo navegador — mas a base de comparação de cada chave
 * (`_sentSnapshot`) é de cada aba. Uma aba enviava a gravação da outra
 * comparando com a base errada: subia a cópia velha da outra aba como se fosse
 * mudança, e mostrava "Salvando…" por um trabalho que não era dela. Agora cada
 * entrada leva a aba dona; a aba só envia as próprias, e herda as de uma aba que
 * fechou (sem batimento há mais de VIVA_MS) — trabalho de aba fechada não se perde.
 */
type EntradaFila = { key: string; value: string; at?: number; tab?: string }
const TAB_ID   = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `tab-${Date.now()}-${Math.random()}`
const TABS_KEY = 'sm_sync_tabs'
const VIVA_MS  = 3 * 60_000

function abasVivas(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(TABS_KEY) ?? '{}') as Record<string, number> } catch { return {} }
}
function batimento(): void {
  try {
    const m = abasVivas(); const agora = Date.now()
    m[TAB_ID] = agora
    for (const [k, t] of Object.entries(m)) if (agora - t > 10 * VIVA_MS) delete m[k]
    localStorage.setItem(TABS_KEY, JSON.stringify(m))
  } catch { /* sem armazenamento */ }
}
/** A entrada é desta aba — ou de uma aba que já fechou (herança). */
function ehMinha(e: EntradaFila, vivas: Record<string, number> = abasVivas()): boolean {
  if (!e.tab || e.tab === TAB_ID) return true
  const visto = vivas[e.tab]
  return !visto || Date.now() - visto > VIVA_MS
}
if (typeof window !== 'undefined') {
  batimento()
  setInterval(batimento, 30_000)
  window.addEventListener('pagehide', () => {
    try { const m = abasVivas(); delete m[TAB_ID]; localStorage.setItem(TABS_KEY, JSON.stringify(m)) } catch { /* nada */ }
  })
}

/**
 * Chaves cujo valor é um mapa `id → objeto` e que **nunca perdem chave**
 * (exclusão de conteúdo vive em `sm_deleted`, não aqui). Só para essas dá para
 * enviar o que mudou em vez do bloco inteiro.
 *
 * Por que isso importa: cada gravação mandava os ~360 KB de `sm_states` e o
 * servidor SUBSTITUÍA. Como o painel só puxa mudança dos outros a cada 20s, uma
 * cópia velha sobrescrevia trabalho alheio em silêncio — inclusive a aprovação
 * que o cliente acabara de dar pelo portal, que o servidor grava direto no
 * `sm_states`. O card voltava para "Enviado ao cliente" e ninguém entendia.
 */
const PATCHABLE_KEYS = new Set(['sm_states'])

/** Última versão que o servidor confirmou ter recebido, por chave. */
const _sentSnapshot = new Map<string, Record<string, unknown>>()

/**
 * Base do PRIMEIRO envio: o que já estava no localStorage quando a página abriu.
 *
 * Sem isto, a primeira gravação depois de um F5 saía sem base e carimbava o
 * servidor com o mapa inteiro desta aba — inclusive cards que outra pessoa tinha
 * acabado de mover. Era o motivo de o card "voltar para a coluna de origem":
 * a gravação de quem arrastou era desfeita pela primeira gravação de outra aba,
 * que reafirmava o estado antigo de TODOS os cards que ela conhecia.
 *
 * Semeando aqui, o primeiro envio manda só o que MUDOU desde que a página abriu
 * — que é exatamente o que a pessoa acabou de fazer.
 *
 * Exceção: se ficou fila da sessão anterior, aquelas mudanças ainda não chegaram
 * ao servidor e precisam ir. Aí não semeia, e o envio volta a levar tudo (como
 * patch, que mescla e nunca apaga).
 */
function seedSnapshotsFromDisk(): void {
  try {
    const fila = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as EntradaFila[]
    const pendentes = new Set(fila.filter(e => ehMinha(e)).map(e => e.key))
    for (const key of PATCHABLE_KEYS) {
      if (pendentes.has(key)) continue
      const bruto = localStorage.getItem(key)
      if (!bruto) continue
      const mapa = parseMap(bruto)
      if (mapa) _sentSnapshot.set(key, { ...mapa })
    }
  } catch { /* sem base: cai no envio completo, que mescla */ }
}

/**
 * Base da reconciliação: o valor que este navegador tinha em mãos, e a `rev` do
 * servidor correspondente. É o que permite distinguir "eu apaguei" de "nunca
 * tive" quando duas pessoas salvam a mesma chave.
 */
const _baseValue = new Map<string, unknown>()
const _baseRev   = new Map<string, number>()

/** Quantas vezes reconciliar antes de desistir e gravar assim mesmo. */
const MAX_RETRIES = 2

/**
 * O servidor recusou por falta de sessão.
 *
 * Existe porque quem já tinha o usuário salvo na aba entrava direto, pulando o
 * login — e portanto sem credencial nenhuma. Medido na auditoria: milhares de
 * leituras e escritas assim. No dia em que `SYNC_REQUIRE_AUTH` for ligado, essas
 * abas passariam a falhar em SILÊNCIO: a pessoa continuaria trabalhando e nada
 * seria salvo.
 *
 * Com isto, um 401 manda a pessoa fazer login de novo em vez de deixá-la
 * digitando no vazio.
 */
const _sessionListeners = new Set<() => void>()
let _sessionWarned = false

export function onSessionExpired(fn: () => void): () => void {
  _sessionListeners.add(fn)
  return () => { _sessionListeners.delete(fn) }
}

function notifySessionExpired(): void {
  if (_sessionWarned) return   // um aviso por sessão, não um por chave da fila
  _sessionWarned = true
  emit('error')
  _sessionListeners.forEach(fn => { try { fn() } catch { /* nada a fazer */ } })
}

function safeParse(raw: string): unknown {
  try { return JSON.parse(raw) } catch { return undefined }
}

/** O servidor mandou a versão dele — passa a ser a base do próximo envio. */
export function noteServerRev(key: string, rev: number, value?: unknown): void {
  _baseRev.set(key, rev)
  if (value !== undefined) { _baseValue.set(key, value); _ultimoConfirmado.set(key, JSON.stringify(value)) }
}

/** O que o servidor tem de cada chave (texto), para não enfileirar gravação que não muda nada. */
const _ultimoConfirmado = new Map<string, string>()

type EntryMap = Record<string, unknown>

function parseMap(raw: string): EntryMap | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as EntryMap
      : null
  } catch {
    return null
  }
}

/**
 * Entradas que mudaram entre duas versões. `null` quando não dá para comparar —
 * aí o chamador manda o bloco inteiro, que é o comportamento antigo.
 */
export function diffEntries(previous: EntryMap, next: EntryMap): EntryMap {
  const patch: EntryMap = {}
  for (const [id, value] of Object.entries(next)) {
    const before = previous[id]
    if (before === undefined || JSON.stringify(before) !== JSON.stringify(value)) {
      patch[id] = value
    }
  }
  return patch
}

/**
 * Diferença CAMPO A CAMPO (2026-10-08): de cada card que mudou, só os campos que
 * mudaram (`null` = campo removido). Antes ia o card inteiro, e o servidor
 * trocava o card todo — uma aba/aparelho com a cópia velha que editasse só a
 * observação devolvia junto o status ANTIGO, e o card "voltava sozinho"
 * (reproduzido). Mudou o status sem trazer a versão? Carimba `statusAt` agora:
 * é ela que o servidor usa para recusar status mais velho (_lib/mergeStates).
 */
export function diffCampos(previous: EntryMap, next: EntryMap, agora: number = Date.now()): EntryMap {
  const ehObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  const patch: EntryMap = {}
  for (const [id, value] of Object.entries(next)) {
    const before = previous[id]
    if (!ehObj(before) || !ehObj(value)) {
      if (JSON.stringify(before) === JSON.stringify(value)) continue
      patch[id] = ehObj(value) && 'status' in value && !('statusAt' in value) ? { ...value, statusAt: agora } : value
      continue
    }
    const campos: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) if (JSON.stringify(before[k]) !== JSON.stringify(v)) campos[k] = v
    for (const k of Object.keys(before)) if (!(k in value)) campos[k] = null
    if (!Object.keys(campos).length) continue
    if ('status' in campos && !('statusAt' in campos)) campos.statusAt = agora
    patch[id] = campos
  }
  return patch
}

/**
 * Registra o que já está no servidor, para o próximo envio ser só a diferença.
 * Chamado depois de aplicar dados vindos do D1 — sem isso, a primeira gravação
 * após um F5 voltaria a mandar o bloco inteiro.
 */
export function noteSyncedValue(key: string, value: unknown): void {
  if (!PATCHABLE_KEYS.has(key)) return
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    _sentSnapshot.set(key, { ...(value as EntryMap) })
  }
}

/**
 * Corpo do POST: patch quando dá, bloco inteiro só quando o valor nem é um mapa.
 *
 * **Nunca manda `value` para chave patchável sem base.** `_sentSnapshot` vive em
 * memória e nasce vazio a cada F5 — então a primeira gravação depois de recarregar
 * mandava o bloco INTEIRO, e o servidor substitui a linha toda. Uma aba com cópia
 * velha ou incompleta apagava do servidor todo card que ela não tinha; esses cards
 * caíam no valor padrão da semente e reapareciam em "A fazer", já feitos.
 * Aconteceu em produção com mais de 20 vídeos de uma vez.
 *
 * Sem base, mandamos tudo o que temos COMO PATCH: o servidor mescla. O pior caso
 * passa a ser reescrever com valor velho o que esta aba conhece — recuperável —
 * em vez de apagar o que ela nunca viu.
 */
function buildSyncBody(key: string, value: string): string {
  if (!PATCHABLE_KEYS.has(key)) return JSON.stringify({ key, value })

  const current = parseMap(value)
  // Não é um mapa de entradas: não há como mesclar, vai inteiro (comportamento antigo).
  if (!current) return JSON.stringify({ key, value })

  const snapshot = _sentSnapshot.get(key)
  // Com base: só os campos que mudaram. Sem base (primeiro envio depois de F5 com
  // fila antiga): os cards inteiros — o servidor ainda recusa status mais velho.
  if (!snapshot) return JSON.stringify({ key, patch: JSON.stringify(current) })
  return JSON.stringify({ key, patch: JSON.stringify(diffCampos(snapshot, current)), campos: true })
}

// Roda na importação, antes de qualquer gravação: é o que faz o primeiro envio
// depois de um F5 levar só a mudança recém-feita, e não o mapa inteiro desta aba.
seedSnapshotsFromDisk()

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'
let _syncStatus: SyncStatus = 'idle'
export function getSyncStatus(): SyncStatus { return _syncStatus }
const _listeners = new Set<(s: SyncStatus, pending: number) => void>()

export function onSyncStatus(fn: (s: SyncStatus, pending: number) => void): () => void {
  _listeners.add(fn)
  return () => { _listeners.delete(fn) }
}

function emit(s: SyncStatus) {
  _syncStatus = s
  _listeners.forEach(fn => fn(s, _pendingCount))
}

function loadQueue(): EntradaFila[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') } catch { return [] }
}

/** Só as entradas desta aba (ou herdadas de aba fechada). */
function minhaFila(): EntradaFila[] {
  const vivas = abasVivas()
  return loadQueue().filter(e => ehMinha(e, vivas))
}

function saveQueue(q: EntradaFila[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  const vivas = abasVivas()
  _pendingCount = q.filter(e => ehMinha(e, vivas)).length
}

/**
 * Envia UMA chave, reconciliando se alguém tiver gravado no meio.
 *
 * O servidor recusa (409) quando a versão que eu tinha não é mais a atual, e
 * devolve o que está lá. Aí a mudança DESTE navegador é reaplicada sobre o dado
 * fresco e a gravação tenta de novo.
 *
 * Se não convergir em `MAX_RETRIES`, grava assim mesmo — o pior caso passa a ser
 * o comportamento de sempre. Recusar a gravação seria trocar "perdi o trabalho
 * do outro" por "perdi o meu", que é pior: ao menos o antigo era invisível ao
 * usuário no momento, este travaria o painel na cara dele.
 *
 * Devolve `true` só quando o servidor CONFIRMOU. Quem chama usa isso para decidir
 * o que sai da fila — sem essa distinção, uma recusa por falta de sessão fazia a
 * gravação ser descartada como se tivesse subido, e o trabalho sumia.
 */
/**
 * Garante que temos a versão do servidor ANTES de gravar um bloco inteiro.
 *
 * `_baseRev` só é preenchido por `applyRemoteSync`, ou seja, depois da leitura
 * inicial. Uma gravação que saia antes disso ia sem `baseRev` — e o servidor
 * aceita sem conferir versão. Para chave em formato de LISTA isso não reverte
 * status: apaga registro. `sm_custom` guarda os 889 cards criados à mão; uma aba
 * com cópia velha gravando ali derruba os cards que outra pessoa acabou de criar.
 *
 * É a mesma armadilha que fez vídeos prontos voltarem para "A fazer", numa porta
 * onde o estrago é pior. Uma leitura extra na primeira gravação de cada chave
 * (por sessão) troca "sobrescrever às cegas" por "conferir versão".
 */
async function ensureBase(key: string): Promise<void> {
  if (PATCHABLE_KEYS.has(key) || _baseRev.has(key)) return
  try {
    const res = await fetch(`/api/sync?key=${encodeURIComponent(key)}`)
    if (!res.ok) return
    const d = await res.json() as { value?: string | null; rev?: number }
    if (d.rev !== undefined) {
      noteServerRev(key, d.rev, d.value != null ? safeParse(d.value) : undefined)
    }
  } catch { /* offline: segue sem base, como antes */ }
}

async function pushKey(key: string, value: string): Promise<boolean> {
  await ensureBase(key)

  let corpo = buildSyncBody(key, value)
  let meuValor = safeParse(value)

  for (let tentativa = 0; tentativa <= MAX_RETRIES; tentativa++) {
    const enviarCom = (extra: Record<string, unknown>) =>
      JSON.stringify({ ...JSON.parse(corpo), ...extra })

    const rev = _baseRev.get(key)
    const body = rev !== undefined && !corpo.includes('"patch"')
      ? enviarCom({ baseRev: rev })
      : corpo

    const requestId = `req-${++_reqSeq}`
    if (key === 'sm_states' && debugSyncOn()) {
      const p = JSON.parse(body) as { patch?: string; value?: string }
      debugSync('SAVE START', { requestId, key, cards: statusDasEntradas(p.patch ?? p.value ?? '{}') })
    }
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    // Sem sessão o servidor recusou: a gravação NÃO subiu. Devolver `false`
    // mantém a entrada na fila para depois do login — antes ela era removida
    // como se tivesse ido, e o trabalho da aba morria ali.
    if (res.status === 401) { notifySessionExpired(); return false }

    if (res.status === 409) {
      const conflito = await res.json().catch(() => null) as
        { value?: string | null; rev?: number; encolhimento?: boolean } | null
      const deles = conflito?.value != null ? safeParse(conflito.value) : undefined
      // Encolhimento: a cópia local estava vazia/incompleta. Com base vazia a
      // reconciliação SOMA o que é meu ao que está lá, em vez de ler o que falta
      // como exclusão.
      const base  = conflito?.encolhimento
        ? (Array.isArray(deles) ? [] : {})
        : _baseValue.get(key)

      // Reaplica a minha intenção sobre o que está no servidor.
      meuValor = reconcile(base, meuValor, deles)
      corpo = JSON.stringify({ key, value: JSON.stringify(meuValor) })
      if (conflito?.rev !== undefined) _baseRev.set(key, conflito.rev)
      if (deles !== undefined) _baseValue.set(key, deles)

      if (tentativa === MAX_RETRIES) {
        // Última tentativa: sem `baseRev`, o servidor aceita incondicionalmente.
        const ultima = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value: JSON.stringify(meuValor) }),
        })
        if (ultima.status === 401) { notifySessionExpired(); return false }
        if (ultima.status === 409) return false
        console.warn(`[sync] ${key}: gravado sem checagem de versão após ${MAX_RETRIES + 1} tentativas`)
        return ultima.ok
      }
      continue
    }

    if (res.ok) {
      const ok = await res.json().catch(() => null) as { rev?: number } | null
      if (key === 'sm_states') debugSync('SAVE OK', { requestId, key, rev: ok?.rev })
      if (ok?.rev !== undefined) _baseRev.set(key, ok.rev)
      _baseValue.set(key, meuValor)
      _ultimoConfirmado.set(key, value)
      // Só avança o snapshot com confirmação do servidor: marcar antes faria a
      // próxima diferença omitir justamente o que não chegou lá.
      noteSyncedValue(key, parseMap(value))
      return true
    }
    // Qualquer outra recusa (500, 400…) também não subiu: fica na fila.
    return false
  }
  return false
}

/**
 * Envio em curso. `flushQueue` devolve ESTA promessa quando já há um rodando —
 * antes retornava na hora, e quem esperava (`forceSync`, o botão "Forçar sync",
 * o `beforeunload`) achava que o envio tinha terminado sem ter terminado.
 */
let _flushPromise: Promise<void> | null = null

/** Algo foi confirmado pelo servidor no último flush? Governa o reencadeamento. */
let _houveProgresso = false

function flushQueue(): Promise<void> {
  if (_flushPromise) return _flushPromise
  const queue = minhaFila()
  if (!queue.length) { emit('synced'); return Promise.resolve() }

  emit('syncing')
  debugSync('FLUSH', { keys: queue.map(e => e.key) })

  _flushPromise = (async () => {
    try {
      // Cada chave uma vez, com o último valor. Guardado para saber depois
      // EXATAMENTE o que subiu — nem tudo que está na fila agora vai subir.
      const deduped = new Map<string, string>()
      queue.forEach(e => deduped.set(e.key, e.value))

      const resultados = await Promise.all(
        Array.from(deduped.entries()).map(
          async ([key, value]) => [key, await pushKey(key, value)] as const,
        ),
      )

      // Só sai da fila o que o servidor CONFIRMOU. Antes bastava ter sido
      // tentado: uma recusa por falta de sessão (401) descartava a gravação como
      // se tivesse subido, e o trabalho pendente daquela aba morria em silêncio.
      // Agora ele espera o login e vai no flush seguinte.
      const confirmados = new Map(
        resultados.filter(([, ok]) => ok).map(([key]) => [key, deduped.get(key)!]),
      )

      // NÃO limpar a fila inteira. Enquanto o envio acima estava no ar, uma nova
      // gravação pode ter entrado — foi assim que o card arrastado "voltava": a
      // mudança ficava na fila, o `saveQueue([])` a apagava e ela nunca chegava
      // ao servidor. Removo só as entradas cujo valor é o que EU acabei de subir;
      // o que mudou no meio-tempo fica para o próximo flush.
      const vivas = abasVivas()
      const fila = loadQueue().filter(e => !(ehMinha(e, vivas) && confirmados.get(e.key) === e.value))
      saveQueue(fila)
      const restante = fila.filter(e => ehMinha(e, vivas))
      _houveProgresso = confirmados.size > 0
      // Tentamos enviar e NADA subiu, estando online = o servidor está recusando
      // tudo (ex.: quota do D1 estourada, 500). Isso é ERRO, não "sincronizando".
      // Sem esta distinção, um apagão do banco deixava o indicador em
      // "sincronizando…" para sempre e a equipe não sabia que nada estava salvando
      // — a mudança ficava na fila em silêncio, com cara de lentidão, não de falha.
      const nadaSubiu = deduped.size > 0 && confirmados.size === 0
      if (!restante.length) emit('synced')
      else emit(nadaSubiu && navigator.onLine ? 'error' : 'syncing')
    } catch {
      _houveProgresso = false
      emit(navigator.onLine ? 'error' : 'offline')
    } finally {
      _flushPromise = null
    }
  })()

  // Sobrou trabalho que chegou durante o envio? Encadeia outro flush — sem isto,
  // a mudança ficaria parada na fila até a próxima gravação disparar um flush.
  //
  // Só encadeia se ALGO subiu. Desde que o 401 passou a preservar a fila, um
  // encadeamento incondicional viraria loop quente: sem sessão nada é confirmado,
  // a fila nunca esvazia e o painel martelaria o servidor. Sem progresso, espera
  // o próximo gatilho natural (nova gravação, foco na aba, volta da rede) — que é
  // também quando a pessoa já terá refeito o login.
  return _flushPromise.then(() => {
    if (_houveProgresso && minhaFila().length && !_flushPromise) return flushQueue()
  })
}

export function syncToCloud(key: string, value: unknown): void {
  const serialized = JSON.stringify(value)
  if (debugSyncOn()) debugSync('QUEUE', { key, origem: new Error().stack?.split(String.fromCharCode(10)).slice(2, 5).map(l => l.trim()).join(' < ') })

  // Atualiza a entrada na fila (deduplicado por chave). Carimba a HORA: uma
  // gravação que fica presa (offline/401/quota) não pode bloquear para sempre o
  // poll de aplicar o valor do servidor — ver getFreshPendingKeys. Reenfileirar a
  // mesma chave reinicia o relógio (a pessoa está mexendo nela agora).
  const tenhoPendente = minhaFila().some(e => e.key === key)
  // Nada mudou de verdade? Não grava — era isto que fazia o "Salvando…" aparecer
  // sozinho (rotina regravando o mesmo valor). Com algo meu na fila, grava sempre:
  // a pessoa pode ter mudado e desfeito, e a última versão tem de valer.
  if (!tenhoPendente) {
    if (PATCHABLE_KEYS.has(key) && _sentSnapshot.has(key)) {
      const atual = parseMap(serialized)
      if (atual && !Object.keys(diffCampos(_sentSnapshot.get(key)!, atual)).length) return
    } else if (_ultimoConfirmado.get(key) === serialized) return
  }

  const vivas = abasVivas()
  const queue = loadQueue().filter(e => !(e.key === key && ehMinha(e, vivas)))
  queue.push({ key, value: serialized, at: Date.now(), tab: TAB_ID })
  saveQueue(queue)

  // Tenta flush imediato
  flushQueue()
}

// Reconectar: flush automático quando voltar online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flushQueue())
  window.addEventListener('focus', () => {
    if (minhaFila().length > 0) flushQueue()
  })
}

/** Retorna quantas mudanças ainda não foram salvas no servidor. */
export function getPendingCount(): number {
  return minhaFila().length
}

/** Retorna o set de chaves com writes locais pendentes (não enviados ao D1 ainda). */
export function getPendingKeys(): Set<string> {
  return new Set(minhaFila().map(e => e.key))
}

/**
 * Chaves com gravação pendente RECENTE (mais nova que `maxAgeMs`) — as que ainda
 * estão "em voo". O poll usa isto no lugar de `getPendingKeys` para decidir o que
 * NÃO sobrescrever com o valor do servidor.
 *
 * Por que a idade importa: se uma gravação trava (offline, sessão expirada, quota
 * do D1 estourada), ela fica na fila indefinidamente. Com o filtro cru, os dois
 * polls param de aplicar o `sm_states` do servidor PARA SEMPRE — o aparelho
 * congela e a pessoa deixa de ver o que os outros (e o cliente, pelo portal)
 * mudaram. Passado o limite, a gravação é considerada presa e não bloqueia mais:
 * o valor do servidor volta a entrar (pela reconciliação, que ainda preserva o
 * arraste recente via manual stamps). Entrada sem carimbo (fila da versão antiga)
 * conta como velha de propósito, para destravar quem já estava preso.
 */
export function getFreshPendingKeys(maxAgeMs: number): Set<string> {
  const agora = Date.now()
  return new Set(minhaFila().filter(e => typeof e.at === 'number' && agora - e.at < maxAgeMs).map(e => e.key))
}

/** Força um flush imediato da fila. */
export function forceSync(): Promise<void> {
  return flushQueue()
}

/**
 * Flush síncrono via sendBeacon — usar no beforeunload.
 * Garante que dados pendentes chegam ao D1 mesmo no F5/Ctrl+Shift+R.
 */
export function flushQueueBeforeUnload(): void {
  const vivas = abasVivas()
  const queue = loadQueue().filter(e => ehMinha(e, vivas))
  if (!queue.length) return

  const deduped = new Map<string, string>()
  queue.forEach(e => deduped.set(e.key, e.value))

  deduped.forEach((value, key) => {
    // Também vai por diferença: a saída da página não é motivo para apagar o
    // trabalho de quem ficou.
    const body = buildSyncBody(key, value)
    // sendBeacon é enviado mesmo quando a página está descarregando
    navigator.sendBeacon(
      '/api/sync',
      new Blob([body], { type: 'application/json' }),
    )
  })
  // Só as minhas saem: a fila das outras abas abertas continua com elas.
  saveQueue(loadQueue().filter(e => !ehMinha(e, vivas)))
}
