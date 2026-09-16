/* lib/designerFechamento.ts — travar o montante do mês (Julio, Jhones).

   A contagem das abas é DERIVADA do estado atual dos cards, o que é ótimo para
   não errar no dia a dia — mas ruim para pagamento: mexer num card de setembro
   em outubro mudaria o total de setembro RETROATIVAMENTE, e você já pode ter
   pago em cima do número antigo.

   O fechamento resolve isso: no fim do mês, tira um SNAPSHOT do que foi feito e
   trava. A partir daí o mês fechado mostra o número congelado, não o derivado.

   Escopo: só Julio e Jhones (o Kaique é gerente, fica fora). Sem valores — só a
   contagem de peças; o pagamento a gestão calcula à parte, por fora do painel.

   Persistência: `sm_designer_fechamento` (localStorage + syncToCloud). Está em
   SYNC_KEYS E tem ramo próprio no applyRemoteSync do App — sem o ramo, o
   fechamento feito num aparelho subiria e nunca apareceria no outro. */
import { syncToCloud } from './storage'
import type { ArteDesigner } from './designerProducao'

export const FECHAMENTO_KEY = 'sm_designer_fechamento'

/** Os designers cujo mês é fechado para pagamento. Kaique (gerente) fica de fora. */
export const DESIGNERS_FECHAMENTO: readonly string[] = ['julio', 'jhones']

/** Uma peça congelada no fechamento — guardada para auditoria depois. */
export interface ArteFechada {
  itemId: number
  cliente: string
  titulo: string
  aprovadaEm: number | null
}

export interface DesignerFechado {
  designer: string
  total: number
  artes: ArteFechada[]
}

export interface FechamentoMes {
  mes: string            // 'YYYY-MM'
  fechadoEm: number
  fechadoPor: string
  designers: DesignerFechado[]
}

export type FechamentosStore = Record<string, FechamentoMes>

/** Chave 'YYYY-MM' de uma data, em horário LOCAL (mesma convenção das contagens). */
export function chaveMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Rótulo humano do mês, ex.: "setembro de 2026". */
export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split('-').map(Number)
  return new Date(ano, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

/**
 * Monta o snapshot de um mês a partir das artes aprovadas NAQUELE mês de cada
 * designer (o que a aba já calcula). O total é o número de peças; a lista fica
 * guardada para conferência. Congela só o que foi passado — quem chama garante
 * que são as artes do mês certo.
 */
export function construirFechamento(
  mes: string,
  porDesigner: { designer: string; artesDoMes: ArteDesigner[] }[],
  quem: string,
): FechamentoMes {
  return {
    mes,
    fechadoEm: Date.now(),
    fechadoPor: quem,
    designers: porDesigner.map(d => ({
      designer: d.designer,
      total: d.artesDoMes.length,
      artes: d.artesDoMes.map(a => ({
        itemId: a.itemId, cliente: a.cliente, titulo: a.titulo, aprovadaEm: a.aprovadaEm,
      })),
    })),
  }
}

export function mesFechado(store: FechamentosStore, mes: string): FechamentoMes | undefined {
  return store[mes]
}

/** Total travado de um designer num mês fechado, ou null se o mês não foi fechado. */
export function totalFechado(store: FechamentosStore, mes: string, designer: string): number | null {
  const f = store[mes]
  if (!f) return null
  return f.designers.find(d => d.designer === designer)?.total ?? 0
}

export function aplicarFechamento(store: FechamentosStore, fechamento: FechamentoMes): FechamentosStore {
  return { ...store, [fechamento.mes]: fechamento }
}

export function reabrirMes(store: FechamentosStore, mes: string): FechamentosStore {
  const out = { ...store }
  delete out[mes]
  return out
}

/** Meses fechados, do mais recente para o mais antigo. */
export function mesesFechados(store: FechamentosStore): FechamentoMes[] {
  return Object.values(store).sort((a, b) => b.mes.localeCompare(a.mes))
}

// ── Persistência ──────────────────────────────────────────────────────
export function carregarFechamentos(): FechamentosStore {
  try {
    const raw = JSON.parse(localStorage.getItem(FECHAMENTO_KEY) ?? '{}') as FechamentosStore
    return raw && typeof raw === 'object' ? raw : {}
  } catch { return {} }
}

export function salvarFechamentos(store: FechamentosStore): void {
  localStorage.setItem(FECHAMENTO_KEY, JSON.stringify(store))
  syncToCloud(FECHAMENTO_KEY, store)
}
