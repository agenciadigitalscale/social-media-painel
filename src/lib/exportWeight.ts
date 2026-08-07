/**
 * O peso do export, dito onde a decisão acontece.
 *
 * Medido em produção (2026-08-06, 100 vídeos rastreados): a MEDIANA de um
 * export é 91 MB, o p90 é 142 MB, o maior tem 1,5 GB. Isso não compra qualidade
 * nenhuma — o arquivo que o cliente aprova é o mesmo que vai para o Instagram,
 * e **o Instagram recomprime tudo**: um export de 91 MB e um de 25 MB chegam
 * praticamente idênticos no feed.
 *
 * Quem paga a diferença é o cliente, na franquia de dados dele, no momento em
 * que abre o link para aprovar. E o arquivo grande ainda fica fora do espelho,
 * o que deixa o link preso a o vídeo continuar na pasta Publicar.
 *
 * Preset em documento ninguém segue por muito tempo. Este módulo existe para o
 * painel dizer o peso na hora em que o arquivo chega, em vez de deixar passar
 * em silêncio.
 */

/** Vídeo de 15s em 4K passa longe disto; é o teto do espelho no R2. */
export const MIRROR_LIMIT_BYTES = 600 * 1024 * 1024

/**
 * Acima disto o arquivo é grande o bastante para o cliente sentir no 4G.
 *
 * Um Reel de 60s no preset recomendado (1080×1920, H.264, ~8 Mbps) dá ~60 MB —
 * então o limite fica logo acima disso, para não acusar quem já está fazendo
 * certo num vídeo longo. O objetivo é mudar comportamento, e aviso que dispara
 * em tudo vira aviso que ninguém lê.
 */
export const HEAVY_BYTES = 70 * 1024 * 1024

/**
 * O preset de entrega. Os cinco valores importam, e o `.mp4` não é detalhe:
 * `.mov` o Android recusa antes de tentar decodificar.
 */
export const EXPORT_PRESET = 'MP4 · 1080×1920 · H.264 · 30 fps · ~8 Mbps'

export type WeightLevel = 'ok' | 'heavy' | 'huge'

export interface WeightVerdict {
  level: WeightLevel
  /** Frase curta para o chip. */
  label: string
  /** O porquê, para o tooltip. */
  hint: string
}

export function formatBytes(b: number | null | undefined): string {
  if (!b) return '—'
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  const mb = b / (1024 * 1024)
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}

/**
 * Pesa um export. Devolve `null` quando não há o que dizer — imagem (que já é
 * leve por natureza: mediana de 1,2 MB) ou arquivo sem tamanho conhecido.
 *
 * Silêncio quando não sabe é regra em todo este painel: chutar "está pesado"
 * sobre tamanho ausente treinaria a equipe a ignorar o aviso.
 */
export function weighExport(
  bytes: number | null | undefined,
  mimeType?: string | null,
): WeightVerdict | null {
  if (!bytes || bytes <= 0) return null
  if (mimeType && mimeType.startsWith('image/')) return null

  const size = formatBytes(bytes)

  if (bytes > MIRROR_LIMIT_BYTES) {
    return {
      level: 'huge',
      label: `não cabe no espelho · ${size}`,
      hint: `Acima de ${formatBytes(MIRROR_LIMIT_BYTES)}, o arquivo nunca é copiado para a Cloudflare: `
        + 'o link do cliente fica dependendo de o vídeo continuar na pasta Publicar. '
        + `Reexporte em ${EXPORT_PRESET}.`,
    }
  }

  if (bytes > HEAVY_BYTES) {
    return {
      level: 'heavy',
      label: `export pesado · ${size}`,
      hint: `O cliente vai baixar ${size} no celular para aprovar. O Instagram recomprime tudo, `
        + `então isso não melhora o post — só a conta de dados dele. Preset: ${EXPORT_PRESET}.`,
    }
  }

  return { level: 'ok', label: size, hint: `Tamanho saudável para o 4G do cliente. Preset: ${EXPORT_PRESET}.` }
}

// ── Formato de entrega ───────────────────────────────────────────────────────
//
// Peso não é o único jeito de um criativo não chegar. Medido em produção
// (2026-08-07): **24 dos 113 vídeos rastreados são `video/quicktime` (.mov)** e
// há um `.psd` na pasta Publicar.
//
// O `.mov` é a bomba-relógio: o Safari toca, então ninguém percebeu — mas o
// Android **recusa `video/quicktime` antes de tentar decodificar**, e a falha
// chega ao registro como `code=4`, com cara de "problema do aparelho dele".
// Enquanto os clientes que abriram vídeo eram de iPhone, isso ficou invisível.

export type FormatLevel = 'ok' | 'risky' | 'unplayable'

export interface FormatVerdict {
  level: FormatLevel
  label: string
  hint: string
}

/** Nada aqui abre num navegador — nem com boa vontade. */
const UNPLAYABLE = /\.(psd|ai|eps|tiff?|raw|cr2|nef|dng|prproj|aep)$/i
const UNPLAYABLE_MIME = /^(image\/x-photoshop|image\/vnd\.adobe\.photoshop|application\/)/i

/** Abre em alguns aparelhos e falha em outros — o pior dos mundos. */
const RISKY_VIDEO = /\.(mov|avi|wmv|mkv|flv|m4v)$/i
const RISKY_IMAGE = /\.(heic|heif|avif|bmp)$/i

export function checkFormat(
  mimeType?: string | null,
  filename?: string | null,
): FormatVerdict | null {
  const name = filename ?? ''
  const mime = mimeType ?? ''

  if (UNPLAYABLE.test(name) || UNPLAYABLE_MIME.test(mime)) {
    return {
      level: 'unplayable',
      label: 'formato não abre no navegador',
      hint: 'Arquivo de projeto/edição, não de entrega — o cliente vai ver a tela de erro. '
        + 'Exporte o criativo final antes de mandar.',
    }
  }

  if (mime === 'video/quicktime' || RISKY_VIDEO.test(name)) {
    return {
      level: 'risky',
      label: 'formato .mov',
      hint: 'O Safari toca, mas o Android costuma RECUSAR video/quicktime antes de tentar — '
        + 'e a falha chega com cara de "problema do aparelho do cliente". Exporte em .mp4 (H.264).',
    }
  }

  if (RISKY_IMAGE.test(name)) {
    return {
      level: 'risky',
      label: 'formato de imagem arriscado',
      hint: 'HEIC/HEIF e afins não abrem em boa parte dos Android. Exporte em JPG ou PNG.',
    }
  }

  return null
}

/** Mediana em bytes, ou `null` quando não há amostra. */
export function medianBytes(list: (number | null | undefined)[]): number | null {
  const s = list.filter((n): n is number => !!n && n > 0).sort((a, b) => a - b)
  if (s.length === 0) return null
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

export interface WeightTrend {
  median: number | null
  sample: number
  heavy: number
  /** `true` quando a mediana já está no alvo — o que o preset deveria produzir. */
  onTarget: boolean
}

/**
 * A curva, para a aba Entregas. Serve para ver o peso CAINDO depois da mudança
 * de preset — sem isso, "mudamos o export" continua sendo afirmação sem prova.
 */
export function weightTrend(sizes: (number | null | undefined)[]): WeightTrend {
  const clean = sizes.filter((n): n is number => !!n && n > 0)
  const median = medianBytes(clean)
  return {
    median,
    sample: clean.length,
    heavy: clean.filter(n => n > HEAVY_BYTES).length,
    onTarget: median !== null && median <= HEAVY_BYTES,
  }
}
