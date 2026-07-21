/**
 * Correspondência entre um card e o arquivo finalizado na pasta Publicar.
 *
 * Regra de ouro: **na dúvida, não escolhe**. Um palpite aqui manda o vídeo errado
 * para a revisão e, pior, carimba a prévia errada no card — foi exatamente assim
 * que o auto-link antigo errou. Duas prioridades, ambas exatas:
 *
 *   1. ID do card no nome do arquivo (`DSHUB-5821_...` ou `5821 - ...`)
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

/** Nome que o editor deve dar ao arquivo: `DSHUB-5821_VIDEO-PONTO-FIXO.mp4` */
export function buildExportFileName(cardId: number, title: string, ext = 'mp4'): string {
  const slug = normalizeTitle(title)
    .replace(/\s+/g, '-')
    .toUpperCase()
    .slice(0, 60)
    .replace(/-+$/, '')
  return `${EXPORT_PREFIX}-${cardId}${slug ? `_${slug}` : ''}.${ext}`
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
  const byId = videos.filter(f => parseCardIdFromFilename(f.name) === cardId)
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

/** URL de reprodução — sempre o proxy do projeto, que suporta Range. */
export function streamUrlFor(driveFileId: string): string {
  return `/api/stream?id=${driveFileId}`
}

export function driveViewUrlFor(driveFileId: string): string {
  return `https://drive.google.com/file/d/${driveFileId}/view`
}
