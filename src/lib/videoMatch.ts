/**
 * Correspondência entre um card e o arquivo finalizado na pasta Publicar.
 *
 * Regra de ouro: **na dúvida, não escolhe**. Um palpite aqui manda o vídeo errado
 * para a revisão e, pior, carimba a prévia errada no card — foi exatamente assim
 * que o auto-link antigo errou. Duas prioridades, ambas exatas:
 *
 *   1. card declarado no nome — selo `[05MT]`, ou os formatos antigos
 *      (`DSHUB-5821_...` e `5821 - ...`, que continuam valendo)
 *   2. título normalizado IGUAL, com resultado ÚNICO
 *
 * Sem `includes` amplo, sem "primeiro da lista", sem data, sem índice.
 */

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: number | null
  thumbnailLink?: string | null
  modifiedTime?: string | null
}

export type MatchedBy = 'card_id' | 'exact_normalized_title' | 'manual'

export interface MatchResult {
  outcome: 'matched' | 'not_found' | 'ambiguous'
  file?: DriveFile
  matchedBy?: MatchedBy
  matchConfidence?: number
  candidates: DriveFile[]
}

export const EXPORT_PREFIX = 'DSHUB'

/**
 * O que conta como criativo para aquele card.
 * - `video`: Reel e Story, que só existem em vídeo.
 * - `media`: Post, Carrossel e Feed, que podem sair como imagem ou vídeo.
 */
export type AcceptKind = 'video' | 'media'

/** Tipo de conteúdo do DS HUB → o que a esteira aceita como arquivo final. */
export function acceptForContentType(tp: string): AcceptKind {
  return tp === 'Reel' || tp === 'Story' ? 'video' : 'media'
}

export function isVideoFile(file: DriveFile): boolean {
  return typeof file.mimeType === 'string' && file.mimeType.startsWith('video/')
}

export function isImageFile(file: DriveFile): boolean {
  return typeof file.mimeType === 'string' && file.mimeType.startsWith('image/')
}

/** Filtra o lixo da pasta (.txt, .psd, projeto do editor) antes de comparar nomes. */
export function isAcceptedFile(file: DriveFile, accept: AcceptKind = 'video'): boolean {
  return accept === 'video' ? isVideoFile(file) : isVideoFile(file) || isImageFile(file)
}

/**
 * Este card pode receber este arquivo?
 *
 * A regra é a mesma que a esteira automática usa há tempos — mas o vínculo
 * MANUAL a ignorava (corrigido 2026-08-08). Na prática: ao vincular um `.jpg`,
 * o diálogo oferecia Reels; ao vincular um `.mp4`, oferecia Posts. Com 35
 * imagens e 53 vídeos parados na Inbox, metade da atenção de quem vincula ia
 * embora só descartando candidato impossível.
 *
 * Mime desconhecido passa: `drive_videos.mime_type` nasceu depois de parte dos
 * registros, e esconder o card por falta de dado seria pior que oferecer um a
 * mais — quem decide é o clique humano.
 */
export function cardAcceptsMime(contentType: string, mimeType?: string | null): boolean {
  if (!mimeType) return true
  if (acceptForContentType(contentType) === 'media') return true
  return mimeType.startsWith('video/')
}

function stripExtension(name: string): string {
  // Trim antes: "Promoção .mp4 " também precisa perder a extensão.
  return name.trim().replace(/\.[a-z0-9]{2,5}$/i, '')
}

/**
 * "VÍDEO - PONTO FIXO" e "video-ponto-fixo.mp4" viram a mesma coisa.
 * Acentos fora, hífen/underscore viram espaço, espaço duplo colapsa.
 */
export function normalizeTitle(raw: string): string {
  return stripExtension(raw ?? '')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Identidade tolerante a pontuação/capitalização usada nos nomes de clientes. */
export function normalizeClientName(raw: string): string {
  return normalizeTitle(raw).replace(/\s+/g, '')
}

const TYPE_PREFIXES = ['video', 'reel', 'story', 'post', 'carrossel', 'feed']

/**
 * Remove o prefixo de tipo ("video ponto fixo" → "ponto fixo"). Só é aplicado
 * quando os dois lados sobrevivem à remoção: tirar o prefixo de um título que é
 * *só* "Vídeo" criaria colisão com qualquer outro card sem título.
 */
export function stripTypePrefix(normalized: string): string {
  for (const p of TYPE_PREFIXES) {
    if (normalized.startsWith(p + ' ')) {
      const rest = normalized.slice(p.length + 1).trim()
      if (rest.length >= 3) return rest
    }
  }
  return normalized
}

/**
 * Alfabeto Crockford sem I, L, O e U — nada que se confunda com 1 ou 0 quando
 * alguém digita o código à mão. Quatro dígitos dão 1.048.576 combinações, muito
 * acima dos 7.226 IDs do calendário: card semeado nunca colide com outro.
 * Card criado à mão usa o relógio como ID e entra aqui pelo resto da divisão —
 * duas colisões possíveis viram `ambiguous`, que é a saída segura de sempre.
 */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH   = 4
const CODE_SPACE    = CODE_ALPHABET.length ** CODE_LENGTH

/** Selo do card no nome do arquivo — os 4 caracteres entre colchetes. */
export function exportCodeFor(cardId: number): string {
  let n = Math.abs(Math.trunc(cardId)) % CODE_SPACE
  let code = ''
  do {
    code = CODE_ALPHABET[n % CODE_ALPHABET.length] + code
    n = Math.floor(n / CODE_ALPHABET.length)
  } while (n > 0)
  return code.padStart(CODE_LENGTH, '0')
}

/** Windows é o mais restritivo: o que ele proíbe, ninguém usa. */
const ILLEGAL_IN_FILENAME = /[\\/:*?"<>|]+/g

function cleanForFilename(raw: string): string {
  return (raw ?? '').replace(ILLEGAL_IN_FILENAME, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Nome que o editor cola na exportação: `Lorenzeti - Vídeo Chuveiro [05MT]`.
 *
 * **Sem extensão de propósito** — o campo de nome do CapCut (e do Premiere) já
 * põe a dele, e colar ".mp4" ali produz "arquivo.mp4.mp4".
 *
 * Acento e espaço ficam: o que viaja para o Drive, a revisão e o WhatsApp é o
 * `fileId`, nunca o nome — então o nome existe só para o humano ler. O selo é o
 * que a esteira lê, e por isso nunca é truncado: quem encurta é o título.
 */
export function buildExportName(cardId: number, clientName: string, title: string): string {
  const head = [cleanForFilename(clientName), cleanForFilename(title).slice(0, 70).trim()]
    .filter(Boolean)
    .join(' - ')
  return `${head ? `${head} ` : ''}[${exportCodeFor(cardId)}]`
}

/**
 * Extrai o ID do card declarado no nome do arquivo.
 *
 * Aceita o formato novo (`DSHUB-5821_...`) em qualquer posição — o prefixo torna
 * o número inequívoco — e o formato antigo (`5821 - ...`, `#5821 ...`) **só no
 * começo**: os IDs de julho vão de 2001 a 2226 e o ano 2026 cai no meio dessa
 * faixa, então procurar número solto em qualquer posição faria `reel 2026.mp4`
 * casar com o item 2026 por acidente.
 */
export function parseCardIdFromFilename(filename: string): number | null {
  const tagged = filename.match(new RegExp(`${EXPORT_PREFIX}[-_ ]?(\\d{1,10})`, 'i'))
  if (tagged) {
    const n = Number(tagged[1])
    if (n > 0) return n
  }
  const leading = filename.match(/^\s*#?(\d{1,10})(?:\D|$)/)
  if (leading) {
    const n = Number(leading[1])
    if (n > 0) return n
  }
  return null
}

/** Selo `[05MT]` em qualquer posição — o colchete é o que o torna inequívoco. */
export function parseCardCodeFromFilename(filename: string): string | null {
  const m = filename.match(/\[([0-9A-HJKMNP-TV-Z]{4})\]/i)
  return m ? m[1].toUpperCase() : null
}

/**
 * O arquivo diz ser deste card? Aceita o selo novo e os dois formatos antigos —
 * arquivo exportado semana passada tem que continuar sendo reconhecido.
 * Quando há selo, é ele que manda: foi a declaração mais explícita do editor.
 */
export function fileDeclaresCard(filename: string, cardId: number): boolean {
  const code = parseCardCodeFromFilename(filename)
  if (code) return code === exportCodeFor(cardId)
  return parseCardIdFromFilename(filename) === cardId
}

export interface MatchInput {
  cardId: number
  title: string
  files: DriveFile[]
  accept?: AcceptKind
}

/**
 * Roda a correspondência sobre os arquivos **já filtrados para a pasta Publicar
 * daquele cliente** (quem garante o cliente e a pasta é o endpoint, que só sabe
 * listar a pasta registrada para aquele nome).
 */
export function matchCardToFile({ cardId, title, files, accept = 'video' }: MatchInput): MatchResult {
  const videos = files.filter(f => isAcceptedFile(f, accept))
  if (videos.length === 0) return { outcome: 'not_found', candidates: [] }

  // Prioridade 1 — o editor declarou o card no nome. Não é palpite.
  const byId = videos.filter(f => fileDeclaresCard(f.name, cardId))
  if (byId.length === 1) {
    return { outcome: 'matched', file: byId[0], matchedBy: 'card_id', matchConfidence: 1, candidates: byId }
  }
  if (byId.length > 1) {
    // Dois arquivos dizendo ser do mesmo card (re-export, v2, cópia): humano decide.
    return { outcome: 'ambiguous', candidates: byId }
  }

  // Prioridade 2 — arquivos antigos, sem ID no nome: título normalizado exato.
  const wanted = normalizeTitle(title)
  if (!wanted) return { outcome: 'not_found', candidates: [] }

  const exact = videos.filter(f => normalizeTitle(f.name) === wanted)
  if (exact.length === 1) {
    return { outcome: 'matched', file: exact[0], matchedBy: 'exact_normalized_title', matchConfidence: 0.9, candidates: exact }
  }
  if (exact.length > 1) return { outcome: 'ambiguous', candidates: exact }

  // Mesma comparação ignorando o prefixo de tipo ("Vídeo - X" ↔ "X").
  const wantedNoPrefix = stripTypePrefix(wanted)
  const loose = videos.filter(f => stripTypePrefix(normalizeTitle(f.name)) === wantedNoPrefix)
  if (loose.length === 1) {
    return { outcome: 'matched', file: loose[0], matchedBy: 'exact_normalized_title', matchConfidence: 0.75, candidates: loose }
  }
  if (loose.length > 1) return { outcome: 'ambiguous', candidates: loose }

  return { outcome: 'not_found', candidates: [] }
}

/** Card enxuto usado pela Inbox para decidir um vínculo sem abrir o seletor. */
export interface InboxMatchCard {
  id: number
  clientName: string
  title: string
  contentType: string
  status: number
}

/** Arquivo enxuto vindo da API drive-videos. */
export interface InboxMatchFile extends DriveFile {
  clientName: string
}

export interface InboxCardMatchResult {
  outcome: 'matched' | 'not_found' | 'ambiguous'
  card?: InboxMatchCard
  matchedBy?: Exclude<MatchedBy, 'manual'>
  matchConfidence?: number
  candidates: InboxMatchCard[]
}

export interface InboxAutoLinkPlan {
  file: InboxMatchFile
  card: InboxMatchCard
  matchedBy: Exclude<MatchedBy, 'manual'>
  matchConfidence: number
}

const AUTO_LINK_STATUSES = new Set([1, 2, 8])

/**
 * Remove apenas o prefixo EXATO do cliente. Ex.: Luthita - VIDEO - X.mp4
 * vira video x. Não usamos includes: um pedaço parecido nunca basta.
 */
function normalizeInboxFileTitle(filename: string, clientName: string): string {
  const normalized = normalizeTitle(filename)
  const client = normalizeTitle(clientName)
  if (client && normalized.startsWith(client + ' ')) {
    return normalized.slice(client.length + 1).trim()
  }
  return normalized
}

/**
 * Encontra o card de UM arquivo da Inbox. Código/ID explícito é autoritativo:
 * se ele não aponta para um card elegível, não há fallback por título.
 */
export function matchInboxFileToCard(
  file: InboxMatchFile,
  cards: InboxMatchCard[],
): InboxCardMatchResult {
  const sameClient = cards.filter(card =>
    AUTO_LINK_STATUSES.has(card.status)
    && normalizeClientName(card.clientName) === normalizeClientName(file.clientName)
    && isAcceptedFile(file, acceptForContentType(card.contentType)),
  )
  if (sameClient.length === 0) return { outcome: 'not_found', candidates: [] }

  const code = parseCardCodeFromFilename(file.name)
  if (code) {
    const byCode = sameClient.filter(card => exportCodeFor(card.id) === code)
    if (byCode.length === 1) {
      return { outcome: 'matched', card: byCode[0], matchedBy: 'card_id', matchConfidence: 1, candidates: byCode }
    }
    return { outcome: byCode.length > 1 ? 'ambiguous' : 'not_found', candidates: byCode }
  }

  const declaredId = parseCardIdFromFilename(file.name)
  if (declaredId !== null) {
    const byId = sameClient.filter(card => card.id === declaredId)
    if (byId.length === 1) {
      return { outcome: 'matched', card: byId[0], matchedBy: 'card_id', matchConfidence: 1, candidates: byId }
    }
    return { outcome: byId.length > 1 ? 'ambiguous' : 'not_found', candidates: byId }
  }

  const fileTitle = normalizeInboxFileTitle(file.name, file.clientName)
  if (!fileTitle) return { outcome: 'not_found', candidates: [] }

  const exact = sameClient.filter(card => normalizeTitle(card.title) === fileTitle)
  if (exact.length === 1) {
    return { outcome: 'matched', card: exact[0], matchedBy: 'exact_normalized_title', matchConfidence: 0.9, candidates: exact }
  }
  if (exact.length > 1) return { outcome: 'ambiguous', candidates: exact }

  const withoutType = stripTypePrefix(fileTitle)
  const loose = sameClient.filter(card => stripTypePrefix(normalizeTitle(card.title)) === withoutType)
  if (loose.length === 1) {
    return { outcome: 'matched', card: loose[0], matchedBy: 'exact_normalized_title', matchConfidence: 0.75, candidates: loose }
  }
  return { outcome: loose.length > 1 ? 'ambiguous' : 'not_found', candidates: loose }
}

/**
 * Planeja o lote inteiro. Se dois arquivos apontam para o mesmo card (final e
 * v2, por exemplo), nenhum deles entra sozinho: o humano escolhe na Inbox.
 */
export function planInboxAutoLinks(
  files: InboxMatchFile[],
  cards: InboxMatchCard[],
): InboxAutoLinkPlan[] {
  const matched = files.flatMap(file => {
    const result = matchInboxFileToCard(file, cards)
    return result.outcome === 'matched' && result.card && result.matchedBy && result.matchConfidence !== undefined
      ? [{ file, card: result.card, matchedBy: result.matchedBy, matchConfidence: result.matchConfidence }]
      : []
  })
  const countByCard = new Map<number, number>()
  matched.forEach(match => countByCard.set(match.card.id, (countByCard.get(match.card.id) ?? 0) + 1))
  return matched.filter(match => countByCard.get(match.card.id) === 1)
}

/**
 * URL de reprodução — sempre o proxy do projeto, que suporta Range.
 *
 * `kind` é a dica de mime que o `/api/stream` usa quando o Drive devolve
 * `application/octet-stream`: sem ela o Safari recusa o arquivo sem nem tentar.
 */
export function streamUrlFor(driveFileId: string, kind?: 'video' | 'image'): string {
  const base = `/api/stream?id=${driveFileId}`
  return kind ? `${base}&kind=${kind}` : base
}

export function driveViewUrlFor(driveFileId: string): string {
  return `https://drive.google.com/file/d/${driveFileId}/view`
}
