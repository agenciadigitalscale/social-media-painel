// Fila de edição do Kaique Studio — o card que o editor precisa editar.
//
// O Studio (app desktop) chama GET /api/studio-queue e recebe os cards em
// produção, para o editor não abrir o painel só para saber o que fazer. Este
// módulo é a montagem PURA (sem D1) para ser testada sozinha; o endpoint só
// alimenta com os dados lidos do app_data via JSON1.

// Alfabeto Crockford sem I, L, O, U — PORTADO de src/lib/videoMatch.ts
// (exportCodeFor). Tem de bater caractere a caractere com o painel, senão o selo
// que o Studio põe no nome não casaria com o card na esteira. Mudou lá? Mude aqui.
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 4
const CODE_SPACE = CODE_ALPHABET.length ** CODE_LENGTH

export function exportCodeFor(cardId: number): string {
  let n = Math.abs(Math.trunc(cardId)) % CODE_SPACE
  let code = ''
  do {
    code = CODE_ALPHABET[n % CODE_ALPHABET.length] + code
    n = Math.floor(n / CODE_ALPHABET.length)
  } while (n > 0)
  return code.padStart(CODE_LENGTH, '0')
}

export interface QueueTask {
  card_id: string
  cliente: string
  titulo: string
  selo: string
  /** Status efetivo do card (0 A fazer · 1 Em produção · 6 Ajuste solicitado). */
  status: number
  /** Só quando status 6: o que o cliente pediu para ajustar (rejectionText). */
  nota?: string
}

interface CardLike {
  i?: unknown  // id
  c?: unknown  // cliente
  tp?: unknown // tipo (Reel/Story/…)
  n?: unknown  // título
  s?: unknown  // status inicial
}

// Tipos que o editor de vídeo edita, e status que ainda pedem edição: A fazer (0),
// Em produção (1) e Ajuste solicitado (6) — o Reel que o cliente reprovou é
// retrabalho, e o editor precisa vê-lo na fila com o motivo do ajuste.
const DEFAULT_TYPES = ['Reel']
const DEFAULT_STATUSES = [0, 1, 6]

/**
 * Monta a fila a partir dos cards (`sm_custom`, já como array) e do status
 * efetivo por id (`sm_states`, já reduzido a `{id: status}`). Puro e determinístico.
 *
 * O status efetivo é o do `sm_states` quando existe, senão o `s` do próprio card
 * — o painel guarda o andamento em `sm_states`, mas um card recém-criado pode só
 * ter o `s` inicial.
 */
export function buildQueue(
  custom: unknown,
  statusById: Record<string, number>,
  opts: { types?: string[]; statuses?: number[]; notaById?: Record<string, string> } = {},
): QueueTask[] {
  const types = opts.types ?? DEFAULT_TYPES
  const statuses = opts.statuses ?? DEFAULT_STATUSES
  const notaById = opts.notaById ?? {}
  const cards = Array.isArray(custom) ? (custom as CardLike[]) : []
  const out: QueueTask[] = []
  for (const card of cards) {
    if (!card || typeof card !== 'object') continue
    const id = Number(card.i)
    if (!Number.isFinite(id)) continue
    const tp = String(card.tp ?? '')
    if (!types.includes(tp)) continue
    const status = statusById[String(id)] ?? (typeof card.s === 'number' ? card.s : 0)
    if (!statuses.includes(status)) continue
    const titulo = String(card.n ?? '').trim()
    if (!titulo) continue
    const task: QueueTask = { card_id: String(id), cliente: String(card.c ?? ''), titulo, selo: exportCodeFor(id), status }
    // Ajuste solicitado (6): leva o motivo do cliente junto, para o editor saber
    // o que corrigir sem abrir o painel.
    const nota = notaById[String(id)]
    if (status === 6 && typeof nota === 'string' && nota.trim()) task.nota = nota.trim()
    out.push(task)
  }
  return out
}
