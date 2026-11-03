import type { Status } from '../types'

/*
  Filtro por ETAPA ATUAL na aba "Entregas do time" (2026-11-03, pedido do dono:
  "saber quantos realmente foram finalizados"). A entrega conta quando o card vai
  para a Revisão; daí em diante ele pode voltar para Ajuste ou seguir até
  Publicado. Este filtro olha onde o card está AGORA.

  Finalizado = aprovado pela agência ou adiante (3, 4, 5, 9, 7). Revisão e Ajuste
  ainda não terminaram. Registro manual entra como finalizado: quem lança à mão
  está dizendo que fez.
*/

export type EtapaFiltro =
  | 'todos' | 'finalizados' | 'revisao' | 'ajuste'
  | 'aprovado' | 'enviado' | 'clienteOk' | 'programado' | 'publicado'

export const ETAPAS: { key: EtapaFiltro; rotulo: string; status: readonly Status[] | null; manual: boolean }[] = [
  { key: 'todos',       rotulo: 'Todos',            status: null,             manual: true },
  { key: 'finalizados', rotulo: 'Finalizados',      status: [3, 4, 5, 9, 7],  manual: true },
  { key: 'revisao',     rotulo: 'Em revisão',       status: [2, 8],           manual: false },
  { key: 'ajuste',      rotulo: 'Em ajuste',        status: [6],              manual: false },
  { key: 'aprovado',    rotulo: 'Aprovado',         status: [3],              manual: false },
  { key: 'enviado',     rotulo: 'Com o cliente',    status: [4],              manual: false },
  { key: 'clienteOk',   rotulo: 'Cliente ok',       status: [5],              manual: false },
  { key: 'programado',  rotulo: 'Programado',       status: [9],              manual: false },
  { key: 'publicado',   rotulo: 'Publicado',        status: [7],              manual: false },
]

export function naEtapa(e: { status: Status; manual?: boolean }, etapa: EtapaFiltro): boolean {
  const def = ETAPAS.find(x => x.key === etapa)
  if (!def || def.status === null) return true
  if (e.manual) return def.manual
  return def.status.includes(e.status)
}
