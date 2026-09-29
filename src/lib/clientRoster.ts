/**
 * Quem é cliente ATIVO do painel — ponto único.
 *
 * Antes, "ocultar cliente" só escondia os posts dele no Calendário: Produções,
 * Dashboard e o resto seguiam mostrando os cards. Agora a lista de clientes e a
 * de itens passam pelo mesmo filtro, e arquivar vale para o painel inteiro.
 *
 * Arquivar NÃO apaga nada: os itens, aprovações e relatórios continuam
 * guardados. Para reativar um cliente, basta tirá-lo de `ARCHIVED_CLIENTS`.
 */
import type { Client } from '../types'

/**
 * Arquivados em 2026-09-28, a pedido do dono (não estão na lista de clientes
 * ativos). O histórico fica guardado.
 */
export const ARCHIVED_CLIENTS: readonly string[] = [
  'LuzioPan',
  'Quero Bolo',
  'ViniPlas',
  'Rosângela Varas',
  'Suh Maya',
  // 2026-09-29, na subida para produção: clientes criados pela tela SEM
  // demanda em aberto (todos os cards publicados, ou nenhum card).
  'Lambari',
  'CASA GARDEN',
  'COSTELÃO FOGO DE CHÃO',
  'RESTAURANTE MUNDO ANIMAL',
  'LZ ARENA',
  'Euclides',
  'teste',
  'SUPER VINIL',
  'Eletro',
  'Destaque Ford',
  'DIGITAL SCALE APROVAÇÃO',
  'Na Melhor moda feminina',
  'DAMILE',
  'Gustavo e Lourença',
  'loja celular -free robinho',
]

/** Compara nomes sem tropeçar em maiúscula, espaço sobrando ou apóstrofo curvo (’ vs '). */
export function clientKey(name: string): string {
  return name.normalize('NFC').replace(/[‘’´`]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Conjunto de chaves dos clientes fora do painel: ocultos pela tela + arquivados. */
export function inactiveClientKeys(hidden: readonly string[]): Set<string> {
  return new Set([...hidden, ...ARCHIVED_CLIENTS].map(clientKey))
}

/**
 * A lista de clientes ativos.
 *
 * Base do código + criados pela tela (`sm_extra_clients`). Nome repetido:
 * vale o da tela — é o que alguém configurou (postagens/mês, nicho), e o
 * cliente não aparece duas vezes se ele já tinha sido criado por lá.
 */
export function buildRoster(base: readonly Client[], extras: readonly Client[], hidden: readonly string[]): Client[] {
  const inactive = inactiveClientKeys(hidden)
  const byKey = new Map<string, Client>()
  for (const c of [...base, ...extras]) {
    const k = clientKey(c.name)
    if (inactive.has(k)) continue
    if (byKey.has(k)) byKey.delete(k) // o de depois (tela) vence, e vai para o fim
    byKey.set(k, c)
  }
  return [...byKey.values()]
}
