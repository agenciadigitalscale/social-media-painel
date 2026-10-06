/**
 * Recusa a gravação de bloco inteiro que faria uma lista/mapa encolher de vez.
 *
 * Incidente de 2026-10-06: um navegador sem os dados carregados (lista local
 * vazia) criou um card e gravou `sm_custom` com 1 item por cima de 1391 — o
 * `baseRev` conferia, porque ele leu a versão antes de gravar, só não tinha o
 * conteúdo. Na sequência, `sm_deleted` (980 → 1) e `sm_media_links` (155 → 0).
 * Ninguém apaga metade dos cards num gesto: exclusão vai para `sm_deleted`,
 * que cresce. Encolher muito é sintoma de cópia local vazia, não de intenção.
 */
const MIN_ATUAL = 20

function tamanho(v: unknown): number | null {
  if (Array.isArray(v)) return v.length
  if (v && typeof v === 'object') return Object.keys(v).length
  return null
}

export function encolhimentoSuspeito(atual: string | null | undefined, novo: string): boolean {
  if (!atual) return false
  let a: unknown, n: unknown
  try { a = JSON.parse(atual); n = JSON.parse(novo) } catch { return false }
  const ta = tamanho(a), tn = tamanho(n)
  if (ta === null || tn === null) return false
  if (ta < MIN_ATUAL) return false
  return tn < ta / 2
}
