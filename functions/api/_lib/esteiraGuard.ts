/**
 * Trava do `sm_esteira_roteiros` (2026-10-26): "tínhamos anexado todos os links
 * de roteiro e sumiu tudo".
 *
 * Um navegador sem espaço não conseguia guardar o que baixava do servidor; lia a
 * cópia local vazia, recriava os cards automáticos (id fixo `auto:<mês>:<cliente>`)
 * sem link e gravava o mapa inteiro — o `baseRev` conferia, então passava. A
 * gravação de bloco inteiro desta chave agora é conferida card a card contra o
 * que está no banco:
 *
 * - card RECRIADO (mesmo id, `entradaEm` mais novo) não substitui o que existe;
 * - cópia mais VELHA (ou da mesma hora) não tira link, quantidade nem observação;
 * - card que SUMIU do valor novo volta — exceto até 2 cards feitos à mão, que é
 *   o "Excluir de vez" de alguém (ninguém exclui dez num gesto).
 */
type Card = Record<string, unknown> & { entradaEm?: number; atualizadoEm?: number; origem?: string }

const CAMPOS_GUARDADOS = ['link', 'quantidade', 'observacao', 'prazo'] as const
const EXCLUSOES_POR_GRAVACAO = 2

function mapa(raw: string | null | undefined): Record<string, Card> | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, Card> : null
  } catch { return null }
}

const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0)

export function protegerEsteira(atualRaw: string | null | undefined, novoRaw: string): { value: string; corrigidos: number } {
  const atual = mapa(atualRaw)
  const novo = mapa(novoRaw)
  if (!atual || !novo) return { value: novoRaw, corrigidos: 0 }

  const out: Record<string, Card> = { ...novo }
  let corrigidos = 0

  const sumidos = Object.keys(atual).filter(id => !(id in novo))
  const manuaisSumidos = sumidos.filter(id => atual[id]?.origem === 'manual')
  const exclusaoDeliberada = sumidos.length === manuaisSumidos.length && manuaisSumidos.length <= EXCLUSOES_POR_GRAVACAO
  if (!exclusaoDeliberada) {
    for (const id of sumidos) { out[id] = atual[id]; corrigidos++ }
  }

  for (const [id, n] of Object.entries(novo)) {
    const a = atual[id]
    if (!a || !n || typeof n !== 'object') continue
    if (num(n.entradaEm) > num(a.entradaEm)) { out[id] = a; corrigidos++; continue }
    if (num(n.atualizadoEm) > num(a.atualizadoEm)) continue
    let c: Card | null = null
    for (const campo of CAMPOS_GUARDADOS) {
      if (a[campo] !== undefined && a[campo] !== '' && (n[campo] === undefined || n[campo] === '')) {
        c = c ?? { ...n }
        c[campo] = a[campo]
      }
    }
    if (c) { out[id] = c; corrigidos++ }
  }

  return corrigidos ? { value: JSON.stringify(out), corrigidos } : { value: novoRaw, corrigidos: 0 }
}
