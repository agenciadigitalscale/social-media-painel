/* lib/cronograma.ts — o cronograma de postagens de um cliente no mês (2026-10-06).

   Lê os MESMOS cards do Calendário de postagem (não há cópia): a data é a de
   postagem do card (o horário programado quando está em Programado), então
   conteúdo novo, remarcado ou excluído no calendário aparece aqui na hora. */
import type { ContentItem, ContentType, ItemState } from '../types'
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
