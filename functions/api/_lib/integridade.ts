/**
 * Alarme de perda de dados (2026-10-23) — "não pode perder nada, nada mesmo".
 *
 * A cada hora o servidor tira uma IMPRESSÃO dos cards (o que cada um tem, não o
 * conteúdo) e compara com a da hora anterior. Dado de card só CRESCE no uso
 * normal: histórico só aumenta, link/datas/anexo só aparecem. O que encolher é
 * sinal de perda — o caso de 20/10 (74 cards regravados por um computador com
 * cópia velha) teria tocado o celular dos sócios em uma hora, e não dias depois.
 *
 * Só aponta: nada é corrigido sozinho. A cópia de hora em hora (cron/backup)
 * tem o estado anterior para recuperar.
 */

/** Campos que, uma vez preenchidos, não somem no uso normal. */
export const CAMPOS_GUARDADOS = [
  'link', 'linkMaterial', 'footageLink', 'sentToClientAt', 'approvedByClientAt',
  'publishedAt', 'anexos', 'igPermalink', 'fbPermalink', 'caption',
] as const

export interface ImpressaoCard { h: number; f: string[] }
export interface Impressao {
  em: number
  cards: Record<string, ImpressaoCard>
  /** ids do cadastro de cards (sm_custom). */
  cadastro: number[]
  arquivados: number
  roteiros: string[]
}

const cheio = (v: unknown) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)

export function impressao(dados: {
  states: Record<string, unknown>
  custom: unknown[]
  deleted: unknown[]
  roteiros: Record<string, unknown>
}, em: number): Impressao {
  const cards: Record<string, ImpressaoCard> = {}
  for (const [id, e] of Object.entries(dados.states)) {
    if (!e || typeof e !== 'object') continue
    const o = e as Record<string, unknown>
    const h = Array.isArray(o.history) ? o.history.length : 0
    const f = CAMPOS_GUARDADOS.filter(c => cheio(o[c]))
    cards[id] = { h, f }
  }
  return {
    em, cards,
    cadastro: dados.custom.map(c => Number((c as { i?: unknown })?.i)).filter(Number.isFinite),
    arquivados: dados.deleted.length,
    roteiros: Object.keys(dados.roteiros),
  }
}

export interface Achados {
  sumiramDoCadastro: number[]
  cardsQueSumiram: string[]
  perderamHistorico: { id: string; de: number; para: number }[]
  perderamCampos: { id: string; campos: string[] }[]
  arquivadosNaHora: number
  roteirosQueSumiram: string[]
}

/** Muitos arquivados de uma vez também é suspeito (uma pessoa arquivando um a um não passa disso). */
export const LIMITE_ARQUIVADOS_NA_HORA = 15

export function comparar(antes: Impressao, agora: Impressao): Achados {
  const cadAgora = new Set(agora.cadastro)
  const rotAgora = new Set(agora.roteiros)
  const perderamHistorico: Achados['perderamHistorico'] = []
  const perderamCampos: Achados['perderamCampos'] = []
  const cardsQueSumiram: string[] = []
  for (const [id, a] of Object.entries(antes.cards)) {
    const n = agora.cards[id]
    if (!n) { cardsQueSumiram.push(id); continue }
    if (n.h < a.h) perderamHistorico.push({ id, de: a.h, para: n.h })
    const foram = a.f.filter(c => !n.f.includes(c))
    if (foram.length) perderamCampos.push({ id, campos: foram })
  }
  return {
    sumiramDoCadastro: antes.cadastro.filter(i => !cadAgora.has(i)),
    cardsQueSumiram,
    perderamHistorico,
    perderamCampos,
    arquivadosNaHora: Math.max(0, agora.arquivados - antes.arquivados),
    roteirosQueSumiram: antes.roteiros.filter(r => !rotAgora.has(r)),
  }
}

/**
 * Campos que somem DE PROPÓSITO no uso normal e não devem tocar o alarme sozinhos:
 * "Desagendar" tira a programação, trocar o criativo troca o link. Por isso só
 * os carimbos e o histórico pesam — um link sumindo sozinho num card é ruído;
 * vários juntos, não.
 */
const CARIMBOS = new Set(['sentToClientAt', 'approvedByClientAt', 'publishedAt', 'igPermalink', 'fbPermalink'])

export function grave(a: Achados): boolean {
  const camposGraves = a.perderamCampos.filter(p => p.campos.some(c => CARIMBOS.has(c))).length
  const camposLeves = a.perderamCampos.length - camposGraves
  return a.sumiramDoCadastro.length > 0
    || a.cardsQueSumiram.length > 0
    || a.perderamHistorico.length > 0
    || camposGraves > 0
    || camposLeves >= 3
    || a.arquivadosNaHora >= LIMITE_ARQUIVADOS_NA_HORA
    || a.roteirosQueSumiram.length > 0
}

/** Uma frase para o celular. */
export function resumir(a: Achados): string {
  const partes: string[] = []
  if (a.sumiramDoCadastro.length) partes.push(`${a.sumiramDoCadastro.length} card(s) sumiram do cadastro`)
  if (a.cardsQueSumiram.length) partes.push(`${a.cardsQueSumiram.length} card(s) perderam o estado`)
  if (a.perderamHistorico.length) partes.push(`${a.perderamHistorico.length} card(s) perderam histórico`)
  if (a.perderamCampos.length) partes.push(`${a.perderamCampos.length} card(s) perderam link/datas/anexo`)
  if (a.arquivadosNaHora >= LIMITE_ARQUIVADOS_NA_HORA) partes.push(`${a.arquivadosNaHora} arquivados na última hora`)
  if (a.roteirosQueSumiram.length) partes.push(`${a.roteirosQueSumiram.length} roteiro(s) sumiram`)
  return partes.join(' · ')
}
