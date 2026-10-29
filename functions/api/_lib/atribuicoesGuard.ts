/**
 * Trava do `sm_card_painel` (card → gaveta), que decide de quem é cada card e,
 * por isso, a contagem de entregas e o fechamento (2026-10-29).
 *
 * A Produção guardava o mapa de quando foi aberta e gravava ele INTEIRO ao
 * atribuir um card: o que outra pessoa atribuiu nesse meio-tempo sumia, e o card
 * saía da conta de quem o fez. O `encolhimentoSuspeito` só pega quando o mapa cai
 * pela metade; aqui, tirar mais que um punhado de atribuições num gesto é
 * tratado como cópia velha — as que sumiram voltam. Trocar de gaveta passa.
 */
const REMOCOES_POR_GRAVACAO = 10

function mapa(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
  } catch { return null }
}

export function protegerAtribuicoes(atualRaw: string | null | undefined, novoRaw: string): { value: string; restaurados: number } {
  const atual = mapa(atualRaw)
  const novo = mapa(novoRaw)
  if (!atual || !novo) return { value: novoRaw, restaurados: 0 }
  const sumidos = Object.keys(atual).filter(id => !(id in novo))
  if (sumidos.length <= REMOCOES_POR_GRAVACAO) return { value: novoRaw, restaurados: 0 }
  const out = { ...novo }
  for (const id of sumidos) out[id] = atual[id]
  return { value: JSON.stringify(out), restaurados: sumidos.length }
}
