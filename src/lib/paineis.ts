/* lib/paineis.ts — painéis por responsável dentro de Vídeo e Design.

   O board já separa o QUE é (Reels no Vídeo, artes no Design). O que faltava
   era separar de QUEM é: com três pessoas produzindo na mesma coluna, cada uma
   precisa varrer o quadro inteiro para achar o que é dela.

   Painel aqui é uma gaveta com nome, criada pela equipe na tela — não um cargo
   do sistema. Isso é de propósito: quem trabalha na arte muda (freelancer que
   entra num mês, sócio que assume uma conta), e depender de deploy para
   renomear uma gaveta significa que ninguém vai renomear.

   O `NAME_MAP` continua sendo a identidade REAL de quem usa o painel; um
   painel pode apontar para um membro (`membro`), e aí ele herda tudo que já
   está atribuído àquela pessoa em `states[i].responsible`. Sem essa ponte, a
   estreia do recurso seria três gavetas vazias ao lado de um board cheio.
*/

import { syncToCloud } from './storage'
import { DS } from '../theme'
import type { ItemState } from '../types'

export const PAINEIS_KEY    = 'sm_paineis'
export const ATRIBUICOES_KEY = 'sm_card_painel'

export type PainelArea = 'vid' | 'des'

export interface Painel {
  id: string
  area: PainelArea
  nome: string
  cor: string
  /** Chave do NAME_MAP, quando o painel é de alguém da equipe. */
  membro?: string
  ordem: number
  criadoEm: number
}

export interface PaineisStore {
  paineis: Painel[]
  /** Áreas que já receberam os painéis iniciais — semear duas vezes duplicaria. */
  semeado: Partial<Record<PainelArea, boolean>>
}

/** Mapa card → painel. Atribuição explícita, feita por alguém na tela. */
export type Atribuicoes = Record<number, string>

export const PAINEIS_VAZIO: PaineisStore = { paineis: [], semeado: {} }

/** Nomes de estreia. Ninguém precisa ficar com eles — é só ter por onde começar. */
export const NOMES_PADRAO: Record<PainelArea, string[]> = {
  vid: ['Editor 1', 'Editor 2', 'Editor 3'],
  des: ['Designer 1', 'Designer 2', 'Designer 3'],
}

/** Cores de gaveta: distinguem à distância sem competir com o status do card. */
export const CORES_PAINEL = [DS.accent, DS.purpleSoft, DS.cyan, DS.pink, DS.green, DS.amber, DS.blueSoft, DS.violet]

export function corDaVez(existentes: Painel[]): string {
  return CORES_PAINEL[existentes.length % CORES_PAINEL.length]
}

function novoId(): string {
  return `pn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

// ── Leitura da área ───────────────────────────────────────────────────
export function paineisDaArea(store: PaineisStore, area: PainelArea): Painel[] {
  return store.paineis.filter(p => p.area === area).sort((a, b) => a.ordem - b.ordem)
}

// ── Edição ────────────────────────────────────────────────────────────
export function criarPainel(store: PaineisStore, area: PainelArea, nome: string, membro?: string): PaineisStore {
  const daArea = paineisDaArea(store, area)
  const painel: Painel = {
    id: novoId(),
    area,
    nome: nome.trim() || `Painel ${daArea.length + 1}`,
    cor: corDaVez(daArea),
    membro,
    ordem: daArea.length,
    criadoEm: Date.now(),
  }
  return { ...store, paineis: [...store.paineis, painel] }
}

export function editarPainel(store: PaineisStore, id: string, patch: Partial<Pick<Painel, 'nome' | 'cor' | 'membro'>>): PaineisStore {
  return {
    ...store,
    paineis: store.paineis.map(p => (p.id === id
      ? {
        ...p,
        ...patch,
        nome: patch.nome !== undefined ? (patch.nome.trim() || p.nome) : p.nome,
        // `membro: ''` desvincula de propósito — é como a tela desfaz a ponte.
        membro: patch.membro === '' ? undefined : (patch.membro ?? p.membro),
      }
      : p)),
  }
}

/**
 * Remover um painel **não** apaga card nenhum: os cards dele voltam para "sem
 * painel" e continuam no board. Uma gaveta é organização, não conteúdo — e
 * apagar trabalho junto com a gaveta seria a pior surpresa possível.
 */
export function removerPainel(store: PaineisStore, atrib: Atribuicoes, id: string): { store: PaineisStore; atrib: Atribuicoes } {
  const limpo: Atribuicoes = {}
  for (const [card, painel] of Object.entries(atrib)) {
    if (painel !== id) limpo[Number(card)] = painel
  }
  return { store: { ...store, paineis: store.paineis.filter(p => p.id !== id) }, atrib: limpo }
}

export function reordenarPainel(store: PaineisStore, area: PainelArea, id: string, direcao: -1 | 1): PaineisStore {
  const lista = paineisDaArea(store, area)
  const i = lista.findIndex(p => p.id === id)
  const j = i + direcao
  if (i < 0 || j < 0 || j >= lista.length) return store
  const trocada = [...lista]
  ;[trocada[i], trocada[j]] = [trocada[j], trocada[i]]
  const ordens = new Map(trocada.map((p, idx) => [p.id, idx]))
  return {
    ...store,
    paineis: store.paineis.map(p => (ordens.has(p.id) ? { ...p, ordem: ordens.get(p.id)! } : p)),
  }
}

/** Painéis de estreia da área, uma vez só. */
export function semearPadrao(store: PaineisStore, area: PainelArea): PaineisStore {
  if (store.semeado[area] || paineisDaArea(store, area).length > 0) {
    return { ...store, semeado: { ...store.semeado, [area]: true } }
  }
  let out = store
  for (const nome of NOMES_PADRAO[area]) out = criarPainel(out, area, nome)
  return { ...out, semeado: { ...out.semeado, [area]: true } }
}

// ── Atribuição ────────────────────────────────────────────────────────
export function atribuirCards(atrib: Atribuicoes, ids: number[], painelId: string | null): Atribuicoes {
  const out = { ...atrib }
  for (const id of ids) {
    if (painelId) out[id] = painelId
    else delete out[id]
  }
  return out
}

/**
 * De qual painel é este card?
 *
 * A atribuição explícita manda. Na falta dela, um painel vinculado a um membro
 * adota o que já está no `responsible` do card — é o que faz o recurso nascer
 * com o board organizado em vez de com três gavetas vazias.
 */
export function painelDoCard(
  itemId: number,
  state: Pick<ItemState, 'responsible'> | undefined,
  atrib: Atribuicoes,
  paineisArea: Painel[],
): string | null {
  const explicito = atrib[itemId]
  if (explicito && paineisArea.some(p => p.id === explicito)) return explicito
  if (state?.responsible) {
    const doMembro = paineisArea.find(p => p.membro === state.responsible)
    if (doMembro) return doMembro.id
  }
  return null
}

export interface ContagemPainel {
  /** Por id de painel. */
  porPainel: Record<string, number>
  semPainel: number
  total: number
}

export function contarPorPainel(
  cards: { itemId: number; state?: Pick<ItemState, 'responsible'> }[],
  atrib: Atribuicoes,
  paineisArea: Painel[],
): ContagemPainel {
  const porPainel: Record<string, number> = {}
  let semPainel = 0
  for (const c of cards) {
    const id = painelDoCard(c.itemId, c.state, atrib, paineisArea)
    if (id) porPainel[id] = (porPainel[id] ?? 0) + 1
    else semPainel += 1
  }
  return { porPainel, semPainel, total: cards.length }
}

// ── Persistência ──────────────────────────────────────────────────────
export function carregarPaineis(): PaineisStore {
  try {
    const raw = JSON.parse(localStorage.getItem(PAINEIS_KEY) ?? 'null') as PaineisStore | null
    if (!raw || !Array.isArray(raw.paineis)) return { ...PAINEIS_VAZIO }
    return { paineis: raw.paineis.filter(p => p && p.id && p.area), semeado: raw.semeado ?? {} }
  } catch { return { ...PAINEIS_VAZIO } }
}

export function salvarPaineis(store: PaineisStore): void {
  localStorage.setItem(PAINEIS_KEY, JSON.stringify(store))
  syncToCloud(PAINEIS_KEY, store)
}

export function carregarAtribuicoes(): Atribuicoes {
  try {
    const raw = JSON.parse(localStorage.getItem(ATRIBUICOES_KEY) ?? '{}') as Atribuicoes
    return raw && typeof raw === 'object' ? raw : {}
  } catch { return {} }
}

export function salvarAtribuicoes(atrib: Atribuicoes): void {
  localStorage.setItem(ATRIBUICOES_KEY, JSON.stringify(atrib))
  syncToCloud(ATRIBUICOES_KEY, atrib)
}
