/**
 * Como o servidor junta uma gravação no `sm_states` (2026-10-08).
 *
 * O bug que isto fecha: "movi o card, salvou, e minutos depois ele voltou
 * sozinho". Reproduzido: um segundo aparelho com a cópia VELHA do card editou
 * só a observação — e, como cada gravação trocava o card INTEIRO, o status
 * antigo voltou junto. Duas regras, as duas aqui:
 *
 * 1. CAMPO A CAMPO. Com `parcial`, cada entrada traz só os campos que mudaram
 *    (e `null` para campo removido). Editar a observação não toca no status.
 *
 * 2. STATUS COM VERSÃO. Toda mudança de status leva `statusAt` (quando
 *    aconteceu). Um status mais VELHO que o gravado é ignorado — o resto da
 *    entrada ainda grava. Vale também para quem manda o card inteiro (painel
 *    aberto com código antigo, envio sem base): o status dele só passa se for
 *    mais novo.
 *
 * Sem `statusAt`, a versão é o horário do último movimento do histórico
 * (src/lib/versaoStatus): o movimento real de uma aba antiga vale, a cópia velha
 * não. Sem versão nenhuma dos dois lados, vale o que vier, como sempre foi.
 */

import { versaoDoStatus } from '../../../src/lib/versaoStatus'

type Entrada = Record<string, unknown>

/** Carimbo de quem grava no futuro além disto é tratado como "agora" (relógio adiantado). */
const FOLGA_FUTURO_MS = 5 * 60_000

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/**
 * O status que chega pode substituir o atual?
 * - igual: não importa (fica o carimbo mais novo);
 * - quem chega sem versão contra um atual versionado: não (é cópia velha);
 * - quem chega com versão: só se for mais novo.
 */
export function statusPodeEntrar(atual: Entrada | undefined, chegando: Entrada): boolean {
  if (!atual || !('status' in chegando) || chegando.status === atual.status) return true
  const a = versaoDoStatus(atual), c = versaoDoStatus(chegando)
  if (!a) return true
  return c > a
}

/** Junta UMA entrada. `parcial` = só os campos que mudaram (null = remover o campo). */
export function mesclarEntrada(atual: Entrada | undefined, chegando: Entrada, parcial: boolean, agora: number): Entrada {
  const entrada: Entrada = { ...chegando }
  if (num(entrada.statusAt) > agora + FOLGA_FUTURO_MS) entrada.statusAt = agora

  // Aceito sem carimbo (aba com código antigo): grava a versão que o histórico prova.
  if ('status' in entrada && !num(entrada.statusAt) && versaoDoStatus(entrada)) entrada.statusAt = versaoDoStatus(entrada)

  if (!statusPodeEntrar(atual, entrada)) {
    delete entrada.status
    delete entrada.statusAt
  } else if (atual && 'status' in entrada && entrada.status === atual.status && num(atual.statusAt) > num(entrada.statusAt)) {
    // Mesmo status: o carimbo nunca anda para trás.
    entrada.statusAt = atual.statusAt
  }

  if (!parcial) {
    // Card inteiro: o que chegou é o card — exceto o status recusado, que
    // continua o do servidor.
    const out: Entrada = { ...entrada }
    if (atual && !('status' in entrada)) {
      out.status = atual.status
      if (atual.statusAt !== undefined) out.statusAt = atual.statusAt
    }
    return out
  }

  const out: Entrada = { ...(atual ?? {}) }
  for (const [k, v] of Object.entries(entrada)) {
    if (v === null) delete out[k]
    else out[k] = v
  }
  return out
}

/** Junta o patch inteiro no mapa atual. */
export function mesclarEstados(
  atual: Record<string, unknown>,
  chegando: Record<string, unknown>,
  parcial: boolean,
  agora: number = Date.now(),
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...atual }
  for (const [id, e] of Object.entries(chegando)) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) continue
    const a = atual[id]
    out[id] = mesclarEntrada(a && typeof a === 'object' && !Array.isArray(a) ? a as Entrada : undefined, e as Entrada, parcial, agora)
  }
  return out
}
