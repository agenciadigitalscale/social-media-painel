// Leitura pontual de `app_data` — sem trazer a linha inteira para o Worker.
//
// `app_data` é key-value e `sm_states` é UMA linha com o estado de **todos** os
// itens de **todos** os clientes. Ler o título de um criativo com `JSON.parse`
// dessa linha custa centenas de KB de parse a cada abertura de link. Foi o que
// derrubou a página do cliente em 2026-08-06 com "Error 1102: Worker exceeded
// resource limits" — o Worker estourou o orçamento de CPU antes de renderizar.
//
// SQLite tem JSON1 e o D1 expõe: `json_extract` e `json_each` rodam em C dentro
// do banco e devolvem só os campos pedidos. O Worker deixa de tocar no JSON —
// o custo passa a ser o do campo, não o da linha.
//
// **Regra ao usar isto:** só serve para LER. Escrita continua sendo ler-mesclar-
// gravar no `sync.ts`, que tem a reconciliação de três vias; fazer `json_set`
// por fora passaria por cima do `rev` e reabriria a perda de trabalho de
// 2026-07-23.

/**
 * Chave que pode entrar num caminho JSON do SQLite.
 *
 * O parser de caminho do SQLite não tem escape dentro de `$."..."`: uma chave
 * com aspas ou barra invertida não é representável, e montar o caminho assim
 * mesmo produziria erro de sintaxe (que derruba a query inteira, não só o
 * campo). Por isso a whitelist — quem chamar trata o `null` caindo no caminho
 * antigo.
 *
 * Cobre o que de fato vira chave aqui: id de item (dígitos) e token (UUID).
 */
export function jsonKeySegment(key: string | number): string | null {
  const raw = String(key)
  if (!/^[A-Za-z0-9_.\- ]{1,128}$/.test(raw)) return null
  return `"${raw}"`
}

/** `$."2007"."title"` — id numérico não é caminho válido cru, daí as aspas. */
export function jsonPath(...keys: (string | number)[]): string | null {
  const parts: string[] = []
  for (const k of keys) {
    const seg = jsonKeySegment(k)
    if (!seg) return null
    parts.push(seg)
  }
  return `$.${parts.join('.')}`
}

export type Scalar = string | number | null

export interface ItemFieldsResult {
  /** `false` quando não deu para consultar (JSON inválido, D1 fora, caminho impossível). */
  ok: boolean
  fields: Record<string, Scalar>
}

const EMPTY: ItemFieldsResult = { ok: false, fields: {} }

/**
 * Campos avulsos de UM item dentro de uma chave por-item (`sm_states`,
 * `sm_edits`). Uma query, um round-trip, custo proporcional ao campo.
 *
 * O caminho vai **ligado como parâmetro**, não concatenado na query: o
 * `json_extract` aceita qualquer expressão como caminho, e assim nada do que
 * vem de fora chega a virar SQL.
 *
 * Campo que guarda objeto/array (`history`, `comments`) volta como texto JSON —
 * é o comportamento do `json_extract`. Nenhuma tela pública pede esses hoje.
 */
export async function itemFields(
  db: D1Database,
  key: string,
  itemId: string | number,
  fields: string[],
): Promise<ItemFieldsResult> {
  if (fields.length === 0) return EMPTY

  const paths: string[] = []
  for (const f of fields) {
    const p = jsonPath(itemId, f)
    if (!p) return EMPTY
    paths.push(p)
  }

  const cols = paths.map((_, n) => `json_extract(value, ?${n + 2}) AS f${n}`).join(', ')

  try {
    const row = await db.prepare(`SELECT ${cols} FROM app_data WHERE key = ?1`)
      .bind(key, ...paths).first<Record<string, Scalar>>()
    if (!row) return { ok: true, fields: {} }

    const out: Record<string, Scalar> = {}
    fields.forEach((f, n) => { out[f] = row[`f${n}`] ?? null })
    return { ok: true, fields: out }
  } catch {
    // JSON inválido na linha faz o json_extract levantar erro. Melhor devolver
    // "não sei" e deixar o chamador seguir com o padrão do que derrubar a página.
    return EMPTY
  }
}

/**
 * JSON cru de um ponto qualquer da linha — para quando o valor é um objeto
 * (ex.: `sm_feedback` → tudo que aquele token já respondeu).
 */
export async function jsonAt(
  db: D1Database, key: string, path: (string | number)[],
): Promise<string | null> {
  const p = jsonPath(...path)
  if (!p) return null
  try {
    const row = await db.prepare('SELECT json_extract(value, ?2) AS v FROM app_data WHERE key = ?1')
      .bind(key, p).first<{ v: string | null }>()
    return row?.v ?? null
  } catch {
    return null
  }
}

/**
 * Dono do token do portal, resolvido dentro do banco.
 *
 * `sm_portal_tokens` é `{ [cliente]: uuid }` — a busca é pelo VALOR, então
 * `json_each` e comparação em SQL. Nome de cliente tem apóstrofo e acento
 * ("Frango d'Água"), o que o desqualifica como segmento de caminho JSON; aqui
 * ele só sai como resultado, nunca entra numa query.
 */
export async function clientForToken(db: D1Database, token: string): Promise<string | null> {
  if (!token) return null
  try {
    const row = await db.prepare(`
      SELECT je.key AS client
        FROM app_data, json_each(app_data.value) je
       WHERE app_data.key = 'sm_portal_tokens' AND je.value = ?1
       LIMIT 1
    `).bind(token).first<{ client: string }>()
    return row?.client ?? null
  } catch {
    return null
  }
}

/** O item está na lista `sm_deleted`? Comparação numérica: a lista é de números. */
export async function isItemDeleted(db: D1Database, itemId: number): Promise<boolean> {
  try {
    const row = await db.prepare(`
      SELECT 1 AS hit
        FROM app_data, json_each(app_data.value) je
       WHERE app_data.key = 'sm_deleted' AND CAST(je.value AS INTEGER) = ?1
       LIMIT 1
    `).bind(itemId).first<{ hit: number }>()
    return !!row
  } catch {
    return false
  }
}

export interface CustomItemRow {
  i: number
  c: string
  n?: string
  tp?: string
  dt?: string
}

/**
 * UMA entrada de `sm_custom` (que é uma LISTA, e a maior linha depois do
 * `sm_states` — 111 KB medidos). Card semeado nem chega aqui: o catálogo do
 * bundle já responde, e só cai neste caminho o que foi criado à mão.
 */
export async function customItem(db: D1Database, itemId: number): Promise<CustomItemRow | null> {
  try {
    const row = await db.prepare(`
      SELECT je.value AS row
        FROM app_data, json_each(app_data.value) je
       WHERE app_data.key = 'sm_custom' AND json_extract(je.value, '$.i') = ?1
       LIMIT 1
    `).bind(itemId).first<{ row: string }>()
    return row?.row ? JSON.parse(row.row) as CustomItemRow : null
  } catch {
    return null
  }
}

/** Todas as entradas de `sm_custom` de um cliente — para o portal completo. */
export async function customItemsOfClient(db: D1Database, clientName: string): Promise<CustomItemRow[]> {
  try {
    const { results } = await db.prepare(`
      SELECT je.value AS row
        FROM app_data, json_each(app_data.value) je
       WHERE app_data.key = 'sm_custom' AND json_extract(je.value, '$.c') = ?1
    `).bind(clientName).all<{ row: string }>()
    return (results ?? []).map(r => JSON.parse(r.row) as CustomItemRow)
  } catch {
    return []
  }
}

/**
 * Grava o veredito do cliente direto dentro de `sm_states`, sem trazer a linha.
 *
 * Este é o trecho mais pesado do caminho do cliente: o caminho antigo fazia
 * `JSON.parse` + `JSON.stringify` da linha inteira (~600 KB) só para mexer em
 * dois campos de um item — e é o clique de "Aprovar", justamente o que não pode
 * falhar. Com `json_set` quem reescreve o documento é o SQLite, em C.
 *
 * Devolve `false` quando não deu (linha ainda não existe, JSON inválido); o
 * chamador cai no caminho ler-mesclar-gravar de sempre. Falhar aqui não pode
 * custar a aprovação do cliente.
 *
 * O `rev` sobe junto: é o que impede um painel com cópia velha de regravar por
 * cima da decisão do cliente na sincronização seguinte.
 */
export async function patchItemStatus(
  db: D1Database, itemId: number, status: number, rejectionText: string | null,
): Promise<boolean> {
  const itemPath = jsonPath(itemId)
  const statusPath = jsonPath(itemId, 'status')
  const rejectPath = jsonPath(itemId, 'rejectionText')
  if (!itemPath || !statusPath || !rejectPath) return false

  // O item pode nunca ter sido tocado: `json_set` cria a folha, mas não o objeto
  // que a contém. O CASE garante o objeto antes de escrever dentro dele.
  const withItem = `CASE WHEN json_type(value, ?2) IS NULL
                         THEN json_set(value, ?2, json('{"status":0,"title":"","link":"","caption":"","notes":""}'))
                         ELSE value END`

  const setStatus = `json_set(${withItem}, ?3, ?4)`
  const body = rejectionText
    ? `json_set(${setStatus}, ?5, ?6)`
    : `json_remove(${setStatus}, ?5)`

  const binds: (string | number)[] = [itemPath, statusPath, status, rejectPath]
  if (rejectionText) binds.push(rejectionText)

  try {
    const res = await db.prepare(`
      UPDATE app_data
         SET value = ${body}, rev = rev + 1, updated = CURRENT_TIMESTAMP
       WHERE key = ?1
    `).bind('sm_states', ...binds).run()
    return (res.meta?.changes ?? 0) > 0
  } catch {
    return false
  }
}

/**
 * Ids dos itens em determinados status, resolvidos dentro do banco.
 *
 * Serve para perguntar "o que está com o cliente agora?" sem trazer o
 * `sm_states` inteiro — a mesma regra que vale para todo o resto deste arquivo.
 */
export async function itemsWithStatus(db: D1Database, statuses: number[]): Promise<number[]> {
  if (statuses.length === 0) return []
  const holes = statuses.map((_, n) => `?${n + 2}`).join(',')
  try {
    const { results } = await db.prepare(`
      SELECT CAST(je.key AS INTEGER) AS id
        FROM app_data, json_each(app_data.value) je
       WHERE app_data.key = ?1 AND json_extract(je.value, '$.status') IN (${holes})
    `).bind('sm_states', ...statuses).all<{ id: number }>()
    return (results ?? []).map(r => r.id).filter(n => Number.isFinite(n))
  } catch {
    return []
  }
}

/** Ids em `sm_deleted`, como conjunto. Lista de números — barata de trazer. */
export async function deletedIds(db: D1Database): Promise<Set<number>> {
  try {
    const { results } = await db.prepare(`
      SELECT CAST(je.value AS INTEGER) AS id
        FROM app_data, json_each(app_data.value) je
       WHERE app_data.key = 'sm_deleted'
    `).all<{ id: number }>()
    return new Set((results ?? []).map(r => r.id))
  } catch {
    return new Set()
  }
}

/**
 * Campos de VÁRIOS itens de uma vez, de uma chave por-item.
 *
 * O `json_each` percorre a linha dentro do SQLite e devolve uma linha por item;
 * o Worker recebe um rowset pequeno em vez de reconstruir o grafo de objetos
 * inteiro. O filtro por id acontece no SQL — sem ele, um cliente com 90 itens
 * ainda pagaria pelos 1.582 do calendário.
 */
export async function projectItems(
  db: D1Database, key: string, ids: number[], fields: string[],
): Promise<Map<string, Record<string, Scalar>>> {
  const out = new Map<string, Record<string, Scalar>>()
  if (ids.length === 0 || fields.length === 0) return out

  const paths: string[] = []
  for (const f of fields) {
    const p = jsonPath(f)
    if (!p) return out
    paths.push(p)
  }

  // SQLite tem teto de variáveis por statement (999 no padrão). Os clientes
  // maiores passam de 200 itens ao longo dos 7 meses — daí o fatiamento.
  const CHUNK = 200
  for (let start = 0; start < ids.length; start += CHUNK) {
    const slice = ids.slice(start, start + CHUNK)
    const base  = 1 + paths.length
    const cols  = paths.map((_, n) => `json_extract(je.value, ?${n + 2}) AS f${n}`).join(', ')
    const holes = slice.map((_, n) => `?${base + n + 1}`).join(',')

    try {
      const { results } = await db.prepare(`
        SELECT je.key AS id, ${cols}
          FROM app_data, json_each(app_data.value) je
         WHERE app_data.key = ?1 AND je.key IN (${holes})
      `).bind(key, ...paths, ...slice.map(String)).all<Record<string, Scalar>>()

      for (const r of results ?? []) {
        const row: Record<string, Scalar> = {}
        fields.forEach((f, n) => { row[f] = r[`f${n}`] ?? null })
        out.set(String(r.id), row)
      }
    } catch {
      // Uma fatia que falha não pode levar as outras junto: item sem estado
      // aparece como "ainda não produzido", que é a verdade mais próxima.
    }
  }
  return out
}
