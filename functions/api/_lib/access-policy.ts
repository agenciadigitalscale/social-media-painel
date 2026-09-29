// Isolamento na CAMADA DE DADOS — o que o /api/sync entrega e aceita por cargo.
//
// Esconder na tela não basta: o painel é offline-first e o /api/sync entregava o
// banco inteiro a qualquer sessão. Um designer abrindo o DevTools via a fila do
// colega. Aqui a regra de `src/lib/access.ts` vira filtro de leitura e mescla de
// gravação no servidor.
//
// ⚠ A mescla é o ponto mais delicado. O navegador de um isolado só conhece os
// cards DELE; se o servidor aceitasse a lista/mapa dele como "o valor", apagaria
// o trabalho de todo o resto da equipe. Por isso, para um isolado, gravar NUNCA
// substitui: o servidor parte do que ele tem e troca só as entradas do usuário.
// Vale também para a "última tentativa sem baseRev" do cliente.
//
// Tudo aqui é função pura (sem D1): o sync.ts carrega o contexto e chama.

import {
  CHAVES_MAPA_POR_AUTOR, CHAVES_POR_AUTOR, CHAVES_POR_CARD, CHAVE_CARDS_CRIADOS,
  chaveSoDeSocio, donoDoCard, isIsolado, isSocio,
} from '../../../src/lib/access'
import { EMAIL_TO_USER } from '../../../src/lib/users'
import type { ItemState } from '../../../src/types'
import type { Atribuicoes, PaineisStore } from '../../../src/lib/access'

/** O que é preciso saber para decidir de quem é cada card: vem do próprio banco. */
export interface ContextoPosse {
  states: Record<string, Pick<ItemState, 'assignedEditor' | 'responsible'>>
  atrib: Atribuicoes
  paineis: PaineisStore
}

/** Chaves que carregam o contexto de posse — o sync.ts lê estas três. */
export const CHAVES_CONTEXTO = ['sm_states', 'sm_card_painel', 'sm_paineis'] as const

/**
 * Chaves que um isolado não lê nem grava, além das de sócio: o log de atividade
 * é o histórico de TODA a equipe (quem moveu o quê, quando), e exclusão de
 * conteúdo não é ação de editor/designer.
 */
const ISOLADO_SEM_ACESSO = new Set(['sm_activity_log'])
const ISOLADO_SO_LEITURA = new Set(['sm_deleted', 'sm_card_painel', 'sm_paineis'])

/** Membro da equipe dono da sessão, ou `null` (sessão desconhecida/anônima). */
export function usuarioDaSessao(identidade: string | null | undefined): string | null {
  if (!identidade) return null
  const id = identidade.toLowerCase().trim()
  if (id.endsWith('@role.dshub')) return id.slice(0, -'@role.dshub'.length) || null
  return EMAIL_TO_USER[id] ?? null
}

/** Precisa carregar o contexto de posse para esta requisição? Só para isolado. */
export function precisaContexto(user: string | null): boolean {
  return isIsolado(user)
}

function parse(raw: string | null | undefined): unknown {
  if (raw == null) return undefined
  try { return JSON.parse(raw) } catch { return undefined }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

export function contextoDe(rows: { key: string; value: string | null }[]): ContextoPosse {
  const get = (k: string) => parse(rows.find(r => r.key === k)?.value)
  const states = get('sm_states')
  const atrib = get('sm_card_painel')
  const paineis = get('sm_paineis')
  return {
    states: isObj(states) ? states as ContextoPosse['states'] : {},
    atrib: isObj(atrib) ? atrib as Atribuicoes : {},
    paineis: isObj(paineis) && Array.isArray((paineis as { paineis?: unknown }).paineis)
      ? paineis as unknown as PaineisStore
      : { paineis: [], semeado: {} },
  }
}

function eDoUsuario(user: string, id: number | string, ctx: ContextoPosse): boolean {
  const n = Number(id)
  if (!Number.isFinite(n)) return false
  return donoDoCard(n, ctx.states[String(n)], ctx.atrib, ctx.paineis) === user
}

// ── Leitura ──────────────────────────────────────────────────────────────────

/**
 * O valor que ESTE usuário pode ver desta chave. `null` = a chave "não existe"
 * para ele. Sessão sem identidade conhecida passa como antes — quem barra
 * anônimo é o SYNC_REQUIRE_AUTH, não esta camada.
 */
export function valorVisivel(
  user: string | null,
  key: string,
  raw: string | null,
  ctx: ContextoPosse | null,
): string | null {
  if (raw == null || !user || isSocio(user)) return raw
  if (chaveSoDeSocio(key)) return null
  if (!isIsolado(user)) return raw
  if (ISOLADO_SEM_ACESSO.has(key)) return null
  if (!ctx) return null // isolado sem contexto: fecha, nunca abre

  const v = parse(raw)
  if (CHAVES_POR_CARD.has(key) && isObj(v)) {
    const out: Record<string, unknown> = {}
    for (const [id, e] of Object.entries(v)) if (eDoUsuario(user, id, ctx)) out[id] = e
    return JSON.stringify(out)
  }
  if (key === CHAVE_CARDS_CRIADOS && Array.isArray(v)) {
    return JSON.stringify(v.filter(e => isObj(e) && eDoUsuario(user, e.i as number, ctx)))
  }
  if (CHAVES_POR_AUTOR.has(key) && Array.isArray(v)) {
    return JSON.stringify(v.filter(e => isObj(e) && e.autor === user))
  }
  if (CHAVES_MAPA_POR_AUTOR.has(key) && isObj(v)) {
    return JSON.stringify(user in v ? { [user]: v[user] } : {})
  }
  return raw
}

// ── Gravação ─────────────────────────────────────────────────────────────────

export type DecisaoEscrita =
  | { tipo: 'normal' }                 // segue o caminho de sempre (não isolado / sem regra)
  | { tipo: 'ignorar' }                // aceita e descarta: o usuário não grava esta chave
  | { tipo: 'mesclado'; valor: string } // grava ESTE valor, já mesclado com o dos outros

/**
 * O que fazer com uma gravação. `entrada` é o `value` (bloco inteiro) ou o
 * `patch` (só entradas) que o navegador mandou; `atual` é o que está no banco.
 */
export function decidirEscrita(
  user: string | null,
  key: string,
  entrada: string,
  atual: string | null,
  ctx: ContextoPosse | null,
): DecisaoEscrita {
  if (!user || isSocio(user)) return { tipo: 'normal' }
  if (chaveSoDeSocio(key)) return { tipo: 'ignorar' }
  if (!isIsolado(user)) return { tipo: 'normal' }
  if (ISOLADO_SEM_ACESSO.has(key) || ISOLADO_SO_LEITURA.has(key)) return { tipo: 'ignorar' }
  if (!ctx) return { tipo: 'ignorar' }

  const novo = parse(entrada)
  const velho = parse(atual)

  if (CHAVES_POR_CARD.has(key)) {
    if (!isObj(novo)) return { tipo: 'ignorar' }
    const base: Record<string, unknown> = isObj(velho) ? { ...velho } : {}
    for (const [id, e] of Object.entries(novo)) {
      // Posse pelo que está no BANCO, não pelo que ele mandou: senão bastaria
      // escrever `assignedEditor: eu` num card alheio para tomá-lo.
      if (eDoUsuario(user, id, ctx)) base[id] = e
    }
    return { tipo: 'mesclado', valor: JSON.stringify(base) }
  }

  if (key === CHAVE_CARDS_CRIADOS) {
    if (!Array.isArray(novo)) return { tipo: 'ignorar' }
    const atualLista = Array.isArray(velho) ? velho : []
    const meusNovos = new Map<number, unknown>()
    for (const e of novo) if (isObj(e) && typeof e.i === 'number' && eDoUsuario(user, e.i, ctx)) meusNovos.set(e.i, e)
    // Mantém a ordem e TODO card alheio; troca só os meus pela versão nova.
    // Card meu que sumiu da minha lista NÃO é apagado (isolado não exclui).
    const out = atualLista.map(e => (isObj(e) && typeof e.i === 'number' && meusNovos.has(e.i)) ? meusNovos.get(e.i) : e)
    return { tipo: 'mesclado', valor: JSON.stringify(out) }
  }

  if (CHAVES_POR_AUTOR.has(key)) {
    if (!Array.isArray(novo)) return { tipo: 'ignorar' }
    const atualLista = Array.isArray(velho) ? velho : []
    const dosOutros = atualLista.filter(e => !(isObj(e) && e.autor === user))
    const meus = novo.filter(e => isObj(e) && e.autor === user)
    return { tipo: 'mesclado', valor: JSON.stringify([...dosOutros, ...meus]) }
  }

  if (CHAVES_MAPA_POR_AUTOR.has(key)) {
    if (!isObj(novo)) return { tipo: 'ignorar' }
    const base: Record<string, unknown> = isObj(velho) ? { ...velho } : {}
    if (user in novo) base[user] = novo[user]
    return { tipo: 'mesclado', valor: JSON.stringify(base) }
  }

  return { tipo: 'normal' }
}
