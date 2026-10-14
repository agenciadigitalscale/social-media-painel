/* lib/cronograma.ts — o cronograma de postagens de um cliente no mês (2026-10-06).

   Lê os MESMOS cards do Calendário de postagem (não há cópia): a data é a de
   postagem do card (o horário programado quando está em Programado), então
   conteúdo novo, remarcado ou excluído no calendário aparece aqui na hora. */
import type { ContentItem, ContentType, ItemState, Status } from '../types'
import { postagemDoCard } from './programacao'
import { ROTULO_TIPO, semPrefixo, tipoDoPadrao } from './padraoEditorial'

export interface LinhaCronograma {
  id: number
  data: Date
  /** Rótulo da equipe: Reel · Design · Feed (Story e afins com o próprio nome). */
  tipo: string
  tp: ContentType
  titulo: string
  publicado: boolean
}

export interface ResumoCronograma { reels: number; design: number; feed: number; outros: number; total: number }

export function cronogramaDoMes(opts: {
  items: ContentItem[]
  states: Record<number, ItemState>
  cliente: string
  ano: number
  mes: number
  /** Só o que já foi ao ar (status Publicado). */
  soPublicados?: boolean
}): { linhas: LinhaCronograma[]; resumo: ResumoCronograma } {
  const { items, states, cliente, ano, mes, soPublicados } = opts
  const linhas: LinhaCronograma[] = []
  for (const it of items) {
    if (it.c !== cliente) continue
    const st = states[it.i]
    const publicado = (st?.status ?? it.s) === 7
    if (soPublicados && !publicado) continue
    const data = postagemDoCard(it, st).quando
    if (data.getFullYear() !== ano || data.getMonth() !== mes) continue
    const t = tipoDoPadrao(it.tp)
    linhas.push({
      id: it.i, data, tp: it.tp, publicado,
      tipo: t ? ROTULO_TIPO[t] : it.tp,
      titulo: semPrefixo(st?.title || it.n) || st?.title || it.n,
    })
  }
  linhas.sort((a, b) => a.data.getTime() - b.data.getTime() || a.id - b.id)
  const resumo: ResumoCronograma = { reels: 0, design: 0, feed: 0, outros: 0, total: linhas.length }
  for (const l of linhas) {
    const t = tipoDoPadrao(l.tp)
    if (t === 'Reel') resumo.reels++
    else if (t === 'Post') resumo.design++
    else if (t === 'Feed') resumo.feed++
    else resumo.outros++
  }
  return { linhas, resumo }
}

/* ── Geral do dia (2026-10-14) ───────────────────────────────────────────
   Tudo o que vai ao ar num dia, de TODOS os clientes — a mesma data de
   postagem do Calendário. A situação diz se o post está garantido: já saiu,
   está programado, está pronto esperando programar, ou ainda está em produção
   (e, se o dia já passou, "não saiu"). */

export type SituacaoDoDia = 'publicado' | 'programado' | 'pronto' | 'producao' | 'naoSaiu'

export interface LinhaDoDia extends LinhaCronograma {
  cliente: string
  /** "HH:MM" quando o card tem horário; `null` = só o dia. */
  hora: string | null
  status: Status
  situacao: SituacaoDoDia
}

export interface ResumoDoDia extends ResumoCronograma {
  clientes: number
  publicados: number
  programados: number
  prontos: number
  emProducao: number
  naoSairam: number
}

/** Aprovado internamente, enviado ou aprovado pelo cliente: pronto, falta programar/publicar. */
const PRONTOS: Status[] = [3, 4, 5, 8]

export function situacaoNoDia(status: Status, dia: Date, hoje: Date): SituacaoDoDia {
  if (status === 7) return 'publicado'
  if (status === 9) return 'programado'
  const passou = new Date(dia).setHours(0, 0, 0, 0) < new Date(hoje).setHours(0, 0, 0, 0)
  if (passou) return 'naoSaiu'
  return PRONTOS.includes(status) ? 'pronto' : 'producao'
}

export function geralDoDia(opts: {
  items: ContentItem[]
  states: Record<number, ItemState>
  dia: Date
  hoje: Date
}): { linhas: LinhaDoDia[]; resumo: ResumoDoDia } {
  const { items, states, dia, hoje } = opts
  const linhas: LinhaDoDia[] = []
  for (const it of items) {
    const st = states[it.i]
    const p = postagemDoCard(it, st)
    const d = p.quando
    if (d.getFullYear() !== dia.getFullYear() || d.getMonth() !== dia.getMonth() || d.getDate() !== dia.getDate()) continue
    const status = (st?.status ?? it.s) as Status
    const t = tipoDoPadrao(it.tp)
    linhas.push({
      id: it.i, data: d, tp: it.tp, cliente: it.c, hora: p.hora, status,
      publicado: status === 7,
      situacao: situacaoNoDia(status, d, hoje),
      tipo: t ? ROTULO_TIPO[t] : it.tp,
      titulo: semPrefixo(st?.title || it.n) || st?.title || it.n,
    })
  }
  // Com horário primeiro, em ordem; sem horário no fim. Empate: cliente A→Z.
  linhas.sort((a, b) => {
    if (a.hora && b.hora && a.hora !== b.hora) return a.hora.localeCompare(b.hora)
    if (!!a.hora !== !!b.hora) return a.hora ? -1 : 1
    return a.cliente.localeCompare(b.cliente) || a.id - b.id
  })
  const resumo: ResumoDoDia = {
    reels: 0, design: 0, feed: 0, outros: 0, total: linhas.length,
    clientes: new Set(linhas.map(l => l.cliente)).size,
    publicados: 0, programados: 0, prontos: 0, emProducao: 0, naoSairam: 0,
  }
  for (const l of linhas) {
    const t = tipoDoPadrao(l.tp)
    if (t === 'Reel') resumo.reels++
    else if (t === 'Post') resumo.design++
    else if (t === 'Feed') resumo.feed++
    else resumo.outros++
    if (l.situacao === 'publicado') resumo.publicados++
    else if (l.situacao === 'programado') resumo.programados++
    else if (l.situacao === 'pronto') resumo.prontos++
    else if (l.situacao === 'producao') resumo.emProducao++
    else resumo.naoSairam++
  }
  return { linhas, resumo }
}
