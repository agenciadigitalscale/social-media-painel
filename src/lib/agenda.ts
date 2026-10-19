/* lib/agenda.ts — o calendário da aba Agendamento (2026-10-19), no estilo do
   Meta Business Suite: semana ou mês, com os posts no dia em que vão ao ar.

   Entram só as três situações que o Social acompanha aqui: aguardando a
   aprovação dele (Cliente ok, 5), agendado (Programado, 9) e publicado (7). A
   data é a de postagem — a mesma do Calendário de postagem e do Cronograma. */
import type { ContentItem, ItemState } from '../types'
import { postagemDoCard } from './programacao'

export type SituacaoAgenda = 'aprovar' | 'agendado' | 'publicado'

export interface PostDaAgenda {
  item: ContentItem
  quando: Date
  hora: string | null
  situacao: SituacaoAgenda
}

const SITUACAO: Partial<Record<number, SituacaoAgenda>> = { 5: 'aprovar', 9: 'agendado', 7: 'publicado' }

const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** Os 7 dias da semana (domingo a sábado) que contém `ref`. */
export function diasDaSemana(ref: Date): Date[] {
  const inicio = meiaNoite(ref)
  inicio.setDate(inicio.getDate() - inicio.getDay())
  return Array.from({ length: 7 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i))
}

/** A grade do mês: semanas inteiras (domingo a sábado) que cobrem o mês de `ref`. */
export function gradeDoMes(ref: Date): Date[] {
  const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const ultimo = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
  const inicio = new Date(primeiro); inicio.setDate(1 - primeiro.getDay())
  const fim = new Date(ultimo); fim.setDate(ultimo.getDate() + (6 - ultimo.getDay()))
  const dias: Date[] = []
  for (let d = new Date(inicio); d <= fim; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) dias.push(d)
  return dias
}

/**
 * Posts da agenda entre `de` e `ate` (dias inteiros), agrupados por dia e em
 * ordem de horário (sem horário no fim). `filtro` aplica cliente/tipo/busca.
 */
export function postsPorDia(
  items: readonly ContentItem[], states: Record<number, ItemState>, de: Date, ate: Date,
  filtro: (it: ContentItem) => boolean = () => true,
): Map<string, PostDaAgenda[]> {
  const ini = meiaNoite(de).getTime()
  const fim = meiaNoite(ate).getTime() + 86_400_000
  const out = new Map<string, PostDaAgenda[]>()
  for (const it of items) {
    const st = states[it.i]
    const situacao = SITUACAO[st?.status ?? it.s]
    if (!situacao || !filtro(it)) continue
    // Publicado conta no dia em que saiu, quando o painel sabe.
    const p = postagemDoCard(it, st)
    const quando = situacao === 'publicado' && st?.publishedAt ? new Date(st.publishedAt) : p.quando
    const hora = situacao === 'publicado' && st?.publishedAt
      ? `${String(quando.getHours()).padStart(2, '0')}:${String(quando.getMinutes()).padStart(2, '0')}`
      : p.hora
    const t = quando.getTime()
    if (t < ini || t >= fim) continue
    const k = chaveDia(quando)
    const lista = out.get(k) ?? []
    lista.push({ item: it, quando, hora, situacao })
    out.set(k, lista)
  }
  for (const lista of out.values()) {
    lista.sort((a, b) => {
      if (a.hora && b.hora) return a.hora.localeCompare(b.hora) || a.item.i - b.item.i
      if (!!a.hora !== !!b.hora) return a.hora ? -1 : 1
      return a.item.i - b.item.i
    })
  }
  return out
}
