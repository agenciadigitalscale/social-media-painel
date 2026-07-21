/**
 * Marca o card que acabou de mudar de coluna.
 *
 * O card não "se move" no Kanban: ele desmonta de uma coluna e monta em outra,
 * então não há como animar a viagem nem guardar a informação num estado local —
 * ela morre no desmonte. Este registro sobrevive à troca e diz ao card recém
 * montado: você acabou de chegar, dê um sinal.
 *
 * Só memória: é enfeite de um segundo, não faz sentido persistir nem sincronizar.
 */

const ARRIVAL_MS = 2000
const arrivals = new Map<number, number>()

export function markArrived(itemId: number): void {
  arrivals.set(itemId, Date.now())
  // Sem limpeza a Map cresceria a cada arraste da sessão inteira.
  if (arrivals.size > 60) {
    const cutoff = Date.now() - ARRIVAL_MS
    for (const [id, at] of arrivals) if (at < cutoff) arrivals.delete(id)
  }
}

/** Chegou agora? Consultado na montagem do card. */
export function justArrived(itemId: number, now = Date.now()): boolean {
  const at = arrivals.get(itemId)
  return at !== undefined && now - at < ARRIVAL_MS
}

export const ARRIVAL_DURATION_MS = ARRIVAL_MS
