/**
 * A VERSÃO do status de um card — quando ele mudou pela última vez (2026-10-08).
 *
 * Fonte principal: `statusAt`, carimbado a cada mudança de status. Sem ele
 * (card de antes da regra, ou gravação de painel aberto com o código antigo),
 * vale o horário do último movimento do HISTÓRICO ("→ Aprovado", com `ts`), que
 * todo painel grava desde sempre.
 *
 * Isso importa nos dois sentidos:
 * - o movimento de verdade feito numa aba antiga (sem `statusAt`) é MAIS NOVO e
 *   tem de valer — sem a inferência ele era recusado e o card voltava;
 * - a cópia velha de uma aba esquecida tem o histórico velho, e continua recusada.
 *
 * Usada pelo servidor (functions/api/_lib/mergeStates) e pela tela
 * (statusReconcile), para os dois decidirem igual.
 */
export function versaoDoStatus(e: unknown): number {
  if (!e || typeof e !== 'object') return 0
  const { statusAt, history } = e as { statusAt?: unknown; history?: unknown }
  if (typeof statusAt === 'number' && Number.isFinite(statusAt) && statusAt > 0) return statusAt
  if (!Array.isArray(history)) return 0
  let ultima = 0
  for (const h of history) {
    if (!h || typeof h !== 'object') continue
    const { action, ts } = h as { action?: unknown; ts?: unknown }
    if (typeof action === 'string' && action.startsWith('→') && typeof ts === 'number' && ts > ultima) ultima = ts
  }
  return ultima
}
