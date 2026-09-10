/* statusReconcile — o card movido à mão NÃO volta sozinho.
 *
 * O board sincroniza o `sm_states` inteiro a cada poll: o servidor manda o mapa
 * e o cliente aplicava `setStates(() => parsed)`, substituindo tudo. Enquanto a
 * gravação do arraste ainda não subiu, esse mapa vem com a coluna VELHA — e o
 * card volta para onde estava, a cada ciclo. O filtro `getPendingKeys` fecha a
 * janela enquanto a chave está na fila; isto fecha o resto: uma vez movido à
 * mão, o status local vence o remoto até o servidor CONFIRMAR o mesmo status.
 *
 * A exceção é a única que o dono do painel pediu para deixar passar: quando o
 * servidor traz uma DECISÃO DO CLIENTE (aprovou → 5, reprovou → 6), ela vence
 * qualquer movimento local. O cliente decidiu de fato, e a coluna tem de
 * refletir isso mesmo que alguém tenha arrastado o card no mesmo minuto.
 */

export interface ManualStamp {
  status: number
  ts: number
}

/**
 * Quanto tempo um movimento local é preservado sem o servidor confirmar.
 *
 * Generoso de propósito: o POST costuma confirmar em segundos, e este é só a
 * rede de segurança para a janela entre o flush terminar e o servidor propagar
 * o merge. Passado o prazo sem confirmação, o remoto volta a mandar — a essa
 * altura, se a mudança não subiu, o problema é conectividade, não corrida.
 */
export const MANUAL_MOVE_TTL_MS = 90_000

/**
 * Status que representam decisão do CLIENTE, não movimento da equipe.
 * Quando o servidor traz um destes, ele vence o movimento local: foi o portal
 * do cliente que gravou, é automação externa, e a coluna deve segui-la.
 */
const CLIENT_DECISION = new Set([5, 6])

// ── Registro dos movimentos manuais (memória de módulo) ────────────────
// Sobrevive a re-render (não é estado de componente) e morre no F5 — depois de
// um F5 o `beforeunload` já fez o flush, então não há movimento pendente a
// proteger.
const _stamps = new Map<number, ManualStamp>()

/** Carimba um movimento feito na tela (arraste, chip, seta, botão). */
export function markManualMove(id: number, status: number, now: number = Date.now()): void {
  _stamps.set(id, { status, ts: now })
}

export function getManualStamps(): Map<number, ManualStamp> {
  return _stamps
}

export function clearManualStamps(ids: number[]): void {
  for (const id of ids) _stamps.delete(id)
}

/**
 * Mescla o `sm_states` do servidor preservando movimentos locais recentes.
 *
 * Devolve o mapa a aplicar e a lista de itens cujo carimbo pode ser descartado
 * — porque o servidor já confirmou o status, ou porque a decisão do cliente
 * assumiu, ou porque o prazo expirou.
 */
export function reconcileRemoteStates<T extends { status: number }>(
  remote: Record<string, T>,
  stamps: Map<number, ManualStamp>,
  now: number = Date.now(),
): { states: Record<string, T>; confirmed: number[] } {
  const confirmed: number[] = []
  const out: Record<string, T> = {}

  for (const [idStr, r] of Object.entries(remote)) {
    const stamp = stamps.get(Number(idStr))
    if (!stamp) { out[idStr] = r; continue }

    // Decisão do cliente vence — a única exceção pedida.
    if (CLIENT_DECISION.has(r.status)) { out[idStr] = r; confirmed.push(Number(idStr)); continue }

    // O servidor já reflete o que movi: nada a proteger.
    if (r.status === stamp.status) { out[idStr] = r; confirmed.push(Number(idStr)); continue }

    // Ainda dentro do prazo: preserva a COLUNA local, aceita os demais campos
    // do servidor (legenda, comentários que outra pessoa editou no card).
    if (now - stamp.ts < MANUAL_MOVE_TTL_MS) { out[idStr] = { ...r, status: stamp.status }; continue }

    // Prazo esgotado sem confirmação: o remoto assume.
    out[idStr] = r
    confirmed.push(Number(idStr))
  }

  return { states: out, confirmed }
}
