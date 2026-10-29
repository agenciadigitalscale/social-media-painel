/* lib/equipeProducao.ts — Encarregados e Painéis, editáveis na tela (2026-10-29).

   Pedido do dono: "adicionar alguém novo precisa virar uma configuração feita
   dentro do painel, e não algo que exige mexer no código toda vez".

   Encarregado = a PESSOA que produz: nome, uma ou mais funções, perfil do DS HUB
   (opcional) e ativo/inativo. Painel = um grupo de encarregados (Edição →
   Kaique + Emanuelly; Design → Jhones + Julio; ou personalizado), usado como
   filtro na Produção.

   Nada de lista paralela: o encarregado É a gaveta de sempre (`sm_paineis`).
   Cada função de produção vira a gaveta daquela área (Editor → Vídeo, Designer
   → Design), com o MESMO mecanismo que já decide de quem é o card — no board,
   na contagem, na "Minha esteira" e no servidor (`donoDoCard`). Por isso:
   - quem tem perfil: a gaveta aponta para o perfil (`membro`) e a esteira dele
     já sai filtrada, no painel e no servidor;
   - quem não tem perfil: a gaveta aponta para a chave do encarregado
     (`enc_<id>`), que nunca é um login — ninguém "herda" os cards dele;
   - gavetas que já existiam são ADOTADAS pelo id (`gavetas`), então nenhum card
     muda de dono na estreia;
   - gaveta nova tem id fixo por pessoa e área: dois aparelhos derivam a mesma.

   Persistência: `sm_equipe_producao` (SYNC_KEYS + ramo no applyRemoteSync). */
import { syncToCloud } from './storage'
import { NAME_MAP, getDisplayName } from './users'
import { CARGO_DO_USUARIO } from './access'
import { DS } from '../theme'
import type { Atribuicoes, Painel, PainelArea, PaineisStore } from './paineis'

export const EQUIPE_KEY = 'sm_equipe_producao'
export const EVENTO_EQUIPE = 'ds:equipeProducao'

export type Funcao = 'editor' | 'design' | 'social'
export const FUNCOES: { id: Funcao; rotulo: string; area?: PainelArea }[] = [
  { id: 'editor', rotulo: 'Editor de vídeo', area: 'vid' },
  { id: 'design', rotulo: 'Designer', area: 'des' },
  { id: 'social', rotulo: 'Social Media' },
]
const AREA_DA_FUNCAO: Partial<Record<Funcao, PainelArea>> = { editor: 'vid', design: 'des' }

export interface Encarregado {
  id: string
  nome: string
  funcoes: Funcao[]
  /** Perfil do DS HUB (chave do NAME_MAP), quando a pessoa entra no sistema. */
  perfil?: string
  ativo: boolean
  cor: string
  /** Gavetas que já existiam antes do cadastro, adotadas pelo id (por área). */
  gavetas?: Partial<Record<PainelArea, string>>
  criadoEm: number
  atualizadoEm: number
}

export interface GrupoPainel {
  id: string
  nome: string
  /** Ids de encarregado. */
  membros: string[]
  ordem: number
  criadoEm: number
}

export interface EquipeStore {
  encarregados: Record<string, Encarregado>
  grupos: Record<string, GrupoPainel>
}

export const EQUIPE_VAZIA: EquipeStore = { encarregados: {}, grupos: {} }

export const CORES_ENCARREGADO = [DS.accent, DS.purpleSoft, DS.cyan, DS.pink, DS.green, DS.amber, DS.blueSoft, DS.violet]

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'pessoa'

// ── Leitura ───────────────────────────────────────────────────────────

/** A chave que vai no card e na gaveta: o perfil, ou `enc_<id>` sem perfil. */
export const chaveDoEncarregado = (e: Encarregado) => e.perfil || `enc_${e.id}`

export function listaEncarregados(eq: EquipeStore, opts: { incluirInativos?: boolean } = {}): Encarregado[] {
  return Object.values(eq.encarregados)
    .filter(e => opts.incluirInativos || e.ativo)
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome))
}

export function encarregadosDaFuncao(eq: EquipeStore, funcao: Funcao): Encarregado[] {
  return listaEncarregados(eq).filter(e => e.funcoes.includes(funcao))
}

export function encarregadoDoPerfil(eq: EquipeStore, perfil: string | null | undefined): Encarregado | undefined {
  if (!perfil) return undefined
  return Object.values(eq.encarregados).find(e => e.ativo && e.perfil === perfil)
}

export function encarregadoDaChave(eq: EquipeStore, chave: string | null | undefined): Encarregado | undefined {
  if (!chave) return undefined
  return Object.values(eq.encarregados).find(e => chaveDoEncarregado(e) === chave || e.perfil === chave)
}

/** Nome para mostrar de uma chave de responsável (perfil ou `enc_<id>`). */
export function nomeDoResponsavel(eq: EquipeStore, chave: string): string {
  const e = encarregadoDaChave(eq, chave)
  if (e) return e.nome
  return NAME_MAP[chave]?.fullName ?? getDisplayName(chave)
}

export function listaGrupos(eq: EquipeStore): GrupoPainel[] {
  return Object.values(eq.grupos).sort((a, b) => a.ordem - b.ordem || a.criadoEm - b.criadoEm)
}

/** As chaves de responsável dos encarregados ATIVOS de um painel. */
export function chavesDoGrupo(eq: EquipeStore, grupo: GrupoPainel): Set<string> {
  return new Set(grupo.membros.map(id => eq.encarregados[id]).filter(e => e?.ativo).map(e => chaveDoEncarregado(e!)))
}

export const gruposDoEncarregado = (eq: EquipeStore, id: string) => listaGrupos(eq).filter(g => g.membros.includes(id))

// ── Gavetas ───────────────────────────────────────────────────────────

export const idGaveta = (area: PainelArea, encId: string) => `pn_enc_${area}_${encId}`

/**
 * As gavetas como o cadastro manda: uma por função de produção de cada
 * encarregado. Desativar a pessoa ou tirar a função deixa a gaveta `inativa`
 * (some das listas de escolha), sem soltar os cards que já estão nela. Gaveta
 * que não é de encarregado nenhum fica como está. Pura e determinística.
 */
export function aplicarNasGavetas(eq: EquipeStore, store: PaineisStore): PaineisStore {
  const porId = new Map(store.paineis.map(p => [p.id, p]))
  const novos: Painel[] = []
  let mudou = false
  for (const e of Object.values(eq.encarregados)) {
    for (const area of ['vid', 'des'] as PainelArea[]) {
      const quer = e.ativo && e.funcoes.some(f => AREA_DA_FUNCAO[f] === area)
      const id = e.gavetas?.[area] ?? idGaveta(area, e.id)
      const atual = porId.get(id)
      if (!atual && !quer) continue
      const base: Painel = atual ?? {
        id, area, nome: e.nome, cor: e.cor,
        ordem: store.paineis.filter(p => p.area === area).length + novos.filter(p => p.area === area).length,
        criadoEm: e.criadoEm,
      }
      const desejado: Painel = { ...base, nome: e.nome, cor: e.cor, membro: chaveDoEncarregado(e), encarregado: e.id, inativa: !quer }
      if (!desejado.inativa) delete desejado.inativa
      if (!atual) { novos.push(desejado); mudou = true; continue }
      if (JSON.stringify(atual) !== JSON.stringify(desejado)) { porId.set(id, desejado); mudou = true }
    }
  }
  if (!mudou) return store
  return { ...store, paineis: [...store.paineis.map(p => porId.get(p.id) ?? p), ...novos] }
}

/** O card está com este encarregado? (gaveta dele, ou o perfil/chave marcado no card.) */
export function cardEhDoEncarregado(dono: string | undefined, e: Encarregado): boolean {
  return !!dono && (dono === chaveDoEncarregado(e) || (!!e.perfil && dono === e.perfil))
}

// ── Estreia: o cadastro nasce do que já existe ────────────────────────

const FUNCAO_DO_CARGO: Record<string, Funcao | undefined> = { editor: 'editor', design: 'design', social: 'social' }

/**
 * Monta o cadastro a partir das gavetas de hoje e do time do código. Cada
 * gaveta com dono (perfil) ou com cards vira encarregado, e é ADOTADA pelo id —
 * os cards dela continuam exatamente onde estão. Gaveta genérica vazia
 * ("Editor 2") não vira gente.
 */
export function montarDoQueExiste(store: PaineisStore, atrib: Atribuicoes, agora: number): EquipeStore {
  const comCard = new Set(Object.values(atrib))
  const encs: Record<string, Encarregado> = {}
  const porChave = new Map<string, string>()
  const garantir = (chave: string, nome: string, perfil?: string): Encarregado => {
    const existente = porChave.get(chave)
    if (existente) return encs[existente]
    let id = slug(perfil ?? nome)
    while (encs[id]) id += '_'
    const e: Encarregado = {
      id, nome, funcoes: [], ativo: true, criadoEm: agora, atualizadoEm: agora,
      cor: CORES_ENCARREGADO[Object.keys(encs).length % CORES_ENCARREGADO.length],
      ...(perfil ? { perfil } : {}),
    }
    encs[id] = e
    porChave.set(chave, id)
    return e
  }
  const ordenadas = [...store.paineis].sort((a, b) => a.area.localeCompare(b.area) || a.ordem - b.ordem)
  for (const p of ordenadas) {
    const perfil = p.membro && NAME_MAP[p.membro] ? p.membro : undefined
    if (!perfil && !comCard.has(p.id)) continue
    // O nome é o que a equipe já deu à gaveta ("Jhones"), não o do perfil.
    const nomeGaveta = p.nome.trim().charAt(0).toUpperCase() + p.nome.trim().slice(1)
    const e = garantir(perfil ? `p:${perfil}` : `n:${p.nome.trim().toLowerCase()}`, nomeGaveta, perfil)
    const funcao: Funcao = p.area === 'vid' ? 'editor' : 'design'
    if (!e.funcoes.includes(funcao)) e.funcoes.push(funcao)
    if (!e.gavetas?.[p.area]) e.gavetas = { ...e.gavetas, [p.area]: p.id }
    e.cor = p.cor || e.cor
  }
  for (const [perfil, cargo] of Object.entries(CARGO_DO_USUARIO)) {
    const funcao = FUNCAO_DO_CARGO[cargo]
    if (!funcao || !NAME_MAP[perfil]) continue
    const e = garantir(`p:${perfil}`, NAME_MAP[perfil].fullName.split(' ')[0], perfil)
    if (!e.funcoes.includes(funcao)) e.funcoes.push(funcao)
  }
  const grupos: Record<string, GrupoPainel> = {}
  const padrao: [string, string, Funcao][] = [['edicao', 'Edição', 'editor'], ['design', 'Design', 'design']]
  padrao.forEach(([id, nome, funcao], ordem) => {
    grupos[id] = { id, nome, ordem, criadoEm: agora, membros: Object.values(encs).filter(e => e.funcoes.includes(funcao)).map(e => e.id) }
  })
  return { encarregados: encs, grupos }
}

// ── Edição ────────────────────────────────────────────────────────────

export interface DadosEncarregado {
  nome: string
  funcoes: Funcao[]
  perfil?: string
  ativo: boolean
  /** Ids dos painéis (grupos) de que participa. */
  grupos: string[]
}

function comGrupos(eq: EquipeStore, encId: string, grupos: string[]): Record<string, GrupoPainel> {
  const out: Record<string, GrupoPainel> = {}
  for (const g of Object.values(eq.grupos)) {
    const quer = grupos.includes(g.id)
    const tem = g.membros.includes(encId)
    out[g.id] = quer === tem ? g : { ...g, membros: quer ? [...g.membros, encId] : g.membros.filter(m => m !== encId) }
  }
  return out
}

export function criarEncarregado(eq: EquipeStore, d: DadosEncarregado, agora: number): { eq: EquipeStore; id: string } {
  let id = slug(d.perfil || d.nome)
  while (eq.encarregados[id]) id = `${slug(d.perfil || d.nome)}_${agora.toString(36).slice(-4)}`
  const e: Encarregado = {
    id, nome: d.nome.trim(), funcoes: [...d.funcoes], ativo: d.ativo, criadoEm: agora, atualizadoEm: agora,
    cor: CORES_ENCARREGADO[Object.keys(eq.encarregados).length % CORES_ENCARREGADO.length],
    ...(d.perfil ? { perfil: d.perfil } : {}),
  }
  const comEnc = { ...eq, encarregados: { ...eq.encarregados, [id]: e } }
  return { eq: { ...comEnc, grupos: comGrupos(comEnc, id, d.grupos) }, id }
}

export function editarEncarregado(eq: EquipeStore, id: string, d: DadosEncarregado, agora: number): EquipeStore {
  const e = eq.encarregados[id]
  if (!e) return eq
  const { perfil: _p, ...semPerfil } = e
  const novo: Encarregado = {
    ...semPerfil, nome: d.nome.trim() || e.nome, funcoes: [...d.funcoes], ativo: d.ativo, atualizadoEm: agora,
    ...(d.perfil ? { perfil: d.perfil } : {}),
  }
  return { encarregados: { ...eq.encarregados, [id]: novo }, grupos: comGrupos(eq, id, d.grupos) }
}

/** Apagar só quem não tem card nenhum — com card, desativa (a contagem dele fica). */
export function removerEncarregado(eq: EquipeStore, id: string): EquipeStore {
  const { [id]: _fora, ...resto } = eq.encarregados
  const grupos: Record<string, GrupoPainel> = {}
  for (const g of Object.values(eq.grupos)) grupos[g.id] = g.membros.includes(id) ? { ...g, membros: g.membros.filter(m => m !== id) } : g
  return { encarregados: resto, grupos }
}

export function salvarGrupo(eq: EquipeStore, g: { id?: string; nome: string; membros: string[] }, agora: number): EquipeStore {
  const id = g.id ?? `grp_${agora.toString(36)}`
  const atual = eq.grupos[id]
  return {
    ...eq,
    grupos: {
      ...eq.grupos,
      [id]: { id, nome: g.nome.trim() || atual?.nome || 'Painel', membros: [...g.membros], ordem: atual?.ordem ?? Object.keys(eq.grupos).length, criadoEm: atual?.criadoEm ?? agora },
    },
  }
}

export function removerGrupo(eq: EquipeStore, id: string): EquipeStore {
  const { [id]: _fora, ...grupos } = eq.grupos
  return { ...eq, grupos }
}

export function moverGrupo(eq: EquipeStore, id: string, direcao: -1 | 1): EquipeStore {
  const lista = listaGrupos(eq)
  const i = lista.findIndex(g => g.id === id)
  const j = i + direcao
  if (i < 0 || j < 0 || j >= lista.length) return eq
  ;[lista[i], lista[j]] = [lista[j], lista[i]]
  const grupos: Record<string, GrupoPainel> = {}
  lista.forEach((g, ordem) => { grupos[g.id] = { ...g, ordem } })
  return { ...eq, grupos }
}

// ── Persistência ──────────────────────────────────────────────────────

export function carregarEquipe(): EquipeStore | null {
  try {
    const raw = JSON.parse(localStorage.getItem(EQUIPE_KEY) ?? 'null') as EquipeStore | null
    if (!raw || typeof raw.encarregados !== 'object' || !raw.encarregados) return null
    return { encarregados: raw.encarregados, grupos: raw.grupos && typeof raw.grupos === 'object' ? raw.grupos : {} }
  } catch { return null }
}

export function salvarEquipe(eq: EquipeStore): void {
  try { localStorage.setItem(EQUIPE_KEY, JSON.stringify(eq)) } catch { /* sem armazenamento */ }
  syncToCloud(EQUIPE_KEY, eq)
  window.dispatchEvent(new Event(EVENTO_EQUIPE))
}

/**
 * O cadastro em uso. Antes da estreia (ninguém de Social/sócio abriu o painel
 * ainda), monta na hora a partir das gavetas e do time — as listas já aparecem.
 */
export function equipeAtual(): EquipeStore {
  const salvo = carregarEquipe()
  if (salvo) return salvo
  try {
    const paineis = JSON.parse(localStorage.getItem('sm_paineis') ?? 'null') as PaineisStore | null
    const atrib = JSON.parse(localStorage.getItem('sm_card_painel') ?? '{}') as Atribuicoes
    return montarDoQueExiste(paineis && Array.isArray(paineis.paineis) ? paineis : { paineis: [], semeado: {} }, atrib ?? {}, 0)
  } catch { return montarDoQueExiste({ paineis: [], semeado: {} }, {}, 0) }
}

/** Funções de produção de um perfil, pelo cadastro (Minha esteira). */
export function funcoesDoPerfil(eq: EquipeStore, perfil: string | null | undefined): Funcao[] {
  return encarregadoDoPerfil(eq, perfil)?.funcoes ?? []
}

/** Quem pode receber card de uma área: os encarregados ativos com a função. */
export function responsaveisDaArea(eq: EquipeStore, area: 'video' | 'design' | 'todas'): Encarregado[] {
  const lista = listaEncarregados(eq).filter(e =>
    area === 'todas' ? e.funcoes.some(f => f !== 'social') : e.funcoes.includes(area === 'video' ? 'editor' : 'design'))
  return lista
}
