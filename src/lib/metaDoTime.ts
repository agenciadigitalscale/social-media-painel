/* lib/metaDoTime.ts — "Total esperado no mês" da aba Entregas do time (2026-10-22).

   Quanto o time precisa entregar no mês, somando a meta de cada cliente MENSAL
   ativo na carteira naquele mês, e quanto já entregou. A meta de cada cliente é a
   mesma do Calendário (metaEfetiva): a exceção do mês, senão o padrão editorial,
   senão o plano. Vídeo = Reel; arte = Design (Post). Feed (fotos da empresa) não entra:
   não é produção dos designers, e somá-lo inflava a meta de artes (180 contra 30). */
import type { Client } from '../types'
import { metaEfetiva, padraoDo, type PadroesStore } from './padraoEditorial'
import { ativoNoMes, excecaoDeMeta, naCarteira, type CarteiraStore, type PrefMesStore } from './planejamentoMes'

export interface MetaCliente { cliente: string; videos: number; artes: number }
export interface MetaDoMes { videos: number; artes: number; porCliente: MetaCliente[] }

export function esperadoNoMes(
  clientes: readonly Client[], carteira: CarteiraStore, padroes: PadroesStore, prefs: PrefMesStore, ano: number, mes: number,
): MetaDoMes {
  const porCliente: MetaCliente[] = []
  for (const c of clientes) {
    if (naCarteira(carteira, c.name).tipo !== 'mensal' || !ativoNoMes(carteira, c.name, ano, mes)) continue
    const m = metaEfetiva(excecaoDeMeta(prefs, c.name, ano, mes), padraoDo(padroes, c.name), c)
    if (!m.Reel && !m.Post) continue
    porCliente.push({ cliente: c.name, videos: m.Reel, artes: m.Post })
  }
  porCliente.sort((a, b) => b.videos - a.videos || a.cliente.localeCompare(b.cliente))
  return {
    videos: porCliente.reduce((s, c) => s + c.videos, 0),
    artes: porCliente.reduce((s, c) => s + c.artes, 0),
    porCliente,
  }
}

/** Dias úteis (seg–sex) de amanhã até o fim do mês — para o "por dia" do ritmo. */
export function diasUteisRestantes(agora: Date): number {
  const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0)
  let n = 0
  for (let d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1); d <= fim; d.setDate(d.getDate() + 1)) {
    const dia = d.getDay()
    if (dia !== 0 && dia !== 6) n++
  }
  return n
}

export interface Andamento { esperado: number; feito: number; faltam: number; pct: number; porDia: number | null }

/** Feito × esperado, quanto falta e quantos por dia útil para fechar. */
export function andamento(esperado: number, feito: number, agora: Date): Andamento {
  const faltam = Math.max(0, esperado - feito)
  const dias = diasUteisRestantes(agora)
  return {
    esperado, feito, faltam,
    pct: esperado > 0 ? Math.min(100, Math.round((feito / esperado) * 100)) : 0,
    porDia: faltam === 0 ? 0 : dias > 0 ? Math.ceil((faltam / dias) * 10) / 10 : null,
  }
}
