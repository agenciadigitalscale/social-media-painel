import { DS } from '../theme'

/**
 * As únicas cores que um CLIENTE pode ter no painel — tons da identidade
 * (laranja, amarelo, âmbar e neutros), no padrão sóbrio do painel-facebook.
 *
 * Verde e vermelho ficam de fora de propósito: são cores de STATUS (aprovado,
 * ajuste), e um cliente "verde" leria como "tudo certo" sem estar.
 */
export const CLIENT_PALETTE = [DS.accent, DS.orangeDim, DS.cyan, DS.amber, '#C8CED8', DS.neutral] as const

const ALLOWED = new Set(CLIENT_PALETTE.map(c => c.toUpperCase()))

/** Cor salva fora da paleta (roxo, azul… de antes da identidade laranja) → laranja. */
export function toBrandColor(color: string | undefined): string {
  return color && ALLOWED.has(color.toUpperCase()) ? color : DS.accent
}

/**
 * Traduz o mapa `sm_client_colors` para a paleta NA EXIBIÇÃO. O dado salvo
 * não muda — quem escolher uma cor nova no seletor grava uma da paleta.
 */
export function brandClientColors(stored: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, color] of Object.entries(stored)) out[name] = toBrandColor(color)
  return out
}

/** Cor de cliente por posição na lista (calendário), sem arco-íris. */
export function clientColorByIndex(idx: number): string {
  return CLIENT_PALETTE[((idx % CLIENT_PALETTE.length) + CLIENT_PALETTE.length) % CLIENT_PALETTE.length]
}
