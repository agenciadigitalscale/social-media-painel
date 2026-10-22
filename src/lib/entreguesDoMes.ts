/* lib/entreguesDoMes.ts — "Entregues no mês" da Minha esteira (2026-10-22).

   A esteira do editor/designer só tem as colunas da produção (A fazer → Aprovado).
   Quando o card segue para o cliente, é programado ou publicado, ele passa para
   o quadro do Social e SOME da tela de quem fez — o relato foi "sumiram os cards
   dos vídeos que fiz este mês" (eram 95 do Kaique, nenhum perdido). Esta lista
   devolve a quem produziu a visão do que já entregou, sem mexer no fluxo.

   Entregue = passou da Revisão (Aprovado e adiante). O mês é o da ENTREGA
   (momentoDaEntrega, a mesma conta da produção); sem carimbo, vale o mês da
   postagem. */
import type { ContentItem, ItemState, Status } from '../types'
import { momentoDaEntrega } from './producaoEditor'
import { postagemDoCard } from './programacao'

const DEPOIS_DA_REVISAO: Status[] = [3, 4, 5, 7, 8, 9]

export interface Entregue { item: ContentItem; status: Status; quando: number; comCarimbo: boolean }

export function entreguesDoMes(
  items: readonly ContentItem[], states: Record<number, ItemState>, ano: number, mes: number,
  doQuadro: (it: ContentItem) => boolean,
): Entregue[] {
  const out: Entregue[] = []
  for (const it of items) {
    if (!doQuadro(it)) continue
    const st = states[it.i]
    const status = (st?.status ?? it.s) as Status
    if (!DEPOIS_DA_REVISAO.includes(status)) continue
    const m = momentoDaEntrega(st)
    const quando = m?.ts ?? postagemDoCard(it, st).quando.getTime()
    const d = new Date(quando)
    if (d.getFullYear() !== ano || d.getMonth() !== mes) continue
    out.push({ item: it, status, quando, comCarimbo: !!m })
  }
  return out.sort((a, b) => b.quando - a.quando)
}
