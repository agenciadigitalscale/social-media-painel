/**
 * Cargos e isolamento — as regras de QUEM VÊ O QUÊ (2026-09-28).
 *
 * Ponto único, usado pelo PAINEL (o que aparece) e pelo SERVIDOR (o que o
 * `/api/sync` entrega e aceita). Os dois lados importando a mesma regra é o que
 * impede a tela dizer uma coisa e o banco fazer outra. Por isso este arquivo
 * não importa nada com efeito colateral (nem MUI, nem localStorage) — só tipos.
 *
 * A regra central, nas palavras do dono:
 *   Sócios enxergam tudo.
 *   Social Media enxerga os conteúdos que administra (hoje: todos os clientes).
 *   Designer enxerga apenas os trabalhos atribuídos a ele.
 *   Editor enxerga apenas os vídeos atribuídos a ele.
 *   Nenhum membro operacional enxerga carga, quantidade de trabalhos ou
 *   desempenho de outro membro.
 */
import type { ItemState } from '../types'

/**
 * Formato mínimo de `sm_card_painel` e `sm_paineis` (lib/paineis) que a regra
 * precisa. Declarado aqui, e não importado, porque o servidor compila este
 * arquivo e `lib/paineis` depende de localStorage.
 */
export type Atribuicoes = Record<number, string>
export interface PaineisStore { paineis: { id: string; membro?: string }[]; semeado?: unknown }

export type Cargo = 'socio' | 'social' | 'copy' | 'editor' | 'design'

export const CARGO_DO_USUARIO: Readonly<Record<string, Cargo>> = {
  pradox: 'socio',
  testa: 'socio',
  arthur: 'social',
  // Robson segue com o acesso de antes por enquanto (decisão do dono): conteúdo
  // sim, visão de equipe não. Não entra nas listas de quem recebe trabalho.
  robson: 'social',
  kerges: 'copy',
  kaique: 'editor',
  jhones: 'design',
  julio: 'design',
}

/** Cargo do usuário. Desconhecido = o mais restrito que ainda não vê trabalho alheio. */
export function cargoDe(user: string | null | undefined): Cargo | null {
  if (!user) return null
  return CARGO_DO_USUARIO[user.toLowerCase().trim()] ?? null
}

export function isSocio(user: string | null | undefined): boolean {
  return cargoDe(user) === 'socio'
}

/**
 * Isolado = só enxerga os CARDS atribuídos a ele (Editor e Designer).
 *
 * Copy NÃO é isolada por card: legenda e roteiro são de todo conteúdo, e
 * isolar a Geovana a deixaria sem ter o que legendar.
 */
export function isIsolado(user: string | null | undefined): boolean {
  const c = cargoDe(user)
  return c === 'editor' || c === 'design'
}

/** Pode ver carga, quantidade, desempenho e comparação entre membros? Só sócio. */
export function podeVerEquipe(user: string | null | undefined): boolean {
  return isSocio(user)
}

/** Quem pode receber trabalho, por área — é a lista do "atribuir a". */
export function membrosDoCargo(cargo: Cargo): string[] {
  return Object.entries(CARGO_DO_USUARIO).filter(([, c]) => c === cargo).map(([u]) => u)
}

// ── Dono do card ──────────────────────────────────────────────────────────────

/**
 * De quem é este card — a MESMA ordem do `autorDoCard` (lib/producaoEditor):
 * gaveta atribuída → `assignedEditor` → `responsible`. Reescrita aqui, sem
 * importar aquele módulo, para o servidor não arrastar dependência de navegador.
 */
export function donoDoCard(
  itemId: number,
  state: Pick<ItemState, 'assignedEditor' | 'responsible'> | undefined,
  atrib: Atribuicoes,
  paineis: PaineisStore | undefined,
): string | undefined {
  const painelId = atrib[itemId]
  if (painelId) {
    const membro = paineis?.paineis?.find(p => p.id === painelId)?.membro
    if (membro) return membro
  }
  return state?.assignedEditor || state?.responsible || undefined
}

/** Este usuário pode ver este card? Não isolado vê tudo; isolado só o que é dele. */
export function podeVerCard(
  user: string | null | undefined,
  itemId: number,
  state: Pick<ItemState, 'assignedEditor' | 'responsible'> | undefined,
  atrib: Atribuicoes,
  paineis: PaineisStore | undefined,
): boolean {
  if (!isIsolado(user)) return true
  return donoDoCard(itemId, state, atrib, paineis) === user!.toLowerCase().trim()
}

// ── Chaves de dados ───────────────────────────────────────────────────────────

/**
 * Dados que só SÓCIO lê: dinheiro, desempenho da equipe, fechamento,
 * auditoria. Qualquer outro cargo recebe como se a chave não existisse.
 */
export function chaveSoDeSocio(key: string): boolean {
  return key === 'sm_financeiro'
    || key.startsWith('sm_financeiro2_')
    || key === 'sm_caixa_empresa'
    || key.startsWith('sm_prospeccao')
    || key.startsWith('sm_leads')
    || key.startsWith('sm_trafego')
    || key === 'sm_auth_audit'
    || key === 'sm_designer_fechamento'
    || key === 'sm_customer_health'
    || key === 'sm_health_history'
}

/** Mapas `idDoCard → dado` — o isolado recebe e grava só as entradas dos cards dele. */
export const CHAVES_POR_CARD: ReadonlySet<string> = new Set([
  'sm_states', 'sm_edits', 'sm_media_links', 'sm_ready_automation', 'sm_card_painel',
])

/** Lista de cards criados à mão (`{ i, c, ... }[]`). */
export const CHAVE_CARDS_CRIADOS = 'sm_custom'

/** Listas de registros com `autor` — o isolado lê e grava só os dele. */
export const CHAVES_POR_AUTOR: ReadonlySet<string> = new Set(['sm_producao_manual', 'sm_producao_ajuste_manual'])

/** Mapa `autor → dado` — o isolado lê e grava só a entrada dele. */
export const CHAVES_MAPA_POR_AUTOR: ReadonlySet<string> = new Set(['sm_producao_excluir'])
