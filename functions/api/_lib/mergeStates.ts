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

type Mov = { action?: unknown; ts?: unknown }
const ehLista = (v: unknown): v is Mov[] => Array.isArray(v)
const ultimoTs = (h: Mov[]) => h.reduce((m, x) => Math.max(m, num(x?.ts)), 0)

/**
 * Histórico só cresce (2026-10-22): soma os dois lados, sem repetir, em ordem.
 * Ele é um registro do que aconteceu — e é dele que sai a data da entrega que
 * conta na produção. Uma gravação com o histórico mais curto não apaga o resto.
 */
export function somarHistorico(a: unknown, b: unknown): Mov[] | undefined {
  if (!ehLista(a) && !ehLista(b)) return undefined
  const vistos = new Set<string>()
  const out: Mov[] = []
  for (const h of [...(ehLista(a) ? a : []), ...(ehLista(b) ? b : [])]) {
    if (!h || typeof h !== 'object') continue
    const k = `${num(h.ts)}|${String(h.action)}`
    if (vistos.has(k)) continue
    vistos.add(k)
    out.push(h)
  }
  return out.sort((x, y) => num(x.ts) - num(y.ts))
}

/**
 * O card inteiro que chega é uma CÓPIA VELHA? (2026-10-22, caso de 20/10: um
 * computador com dados de semanas atrás regravou 18 vídeos do editor — o status
 * ficou, mas o histórico, o link e o "enviado ao cliente" sumiram e a entrega
 * voltou para uma data antiga.) Velha = status mais antigo que o gravado, ou o
 * histórico mais curto E terminando antes do gravado.
 */
export function ehCopiaVelha(atual: Entrada | undefined, chegando: Entrada): boolean {
  if (!atual) return false
  if ('status' in chegando && !statusPodeEntrar(atual, chegando)) return true
  const ha = ehLista(atual.history) ? atual.history : [], hc = ehLista(chegando.history) ? chegando.history : []
  return ha.length > 0 && hc.length < ha.length && ultimoTs(hc) < ultimoTs(ha)
}

/** Junta UMA entrada. `parcial` = só os campos que mudaram (null = remover o campo). */
export function mesclarEntrada(atual: Entrada | undefined, chegando: Entrada, parcial: boolean, agora: number): Entrada {
  // Card inteiro vindo de cópia velha: ignorado INTEIRO — não só o status.
  if (!parcial && atual && ehCopiaVelha(atual, chegando)) return atual
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
    // Card inteiro: o que chegou sobrepõe o gravado, mas NUNCA apaga campo que
    // ele não traz (antes trocava o card todo — link e carimbos sumiam). Apagar
    // de propósito é só pela gravação campo a campo (`null`).
    const out: Entrada = { ...(atual ?? {}), ...entrada }
    if (atual && !('status' in entrada)) {
      out.status = atual.status
      if (atual.statusAt !== undefined) out.statusAt = atual.statusAt
    }
    const h = somarHistorico(atual?.history, entrada.history)
    if (h) out.history = h
    return out
  }

  const out: Entrada = { ...(atual ?? {}) }
  for (const [k, v] of Object.entries(entrada)) {
    if (k === 'history') continue
    if (v === null) delete out[k]
    else out[k] = v
  }
  if ('history' in entrada) {
    const h = somarHistorico(atual?.history, entrada.history)
    if (h) out.history = h
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
