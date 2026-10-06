/* lib/etiquetas.ts — base GLOBAL de etiquetas (2026-10-06).

   O card guarda as etiquetas pelo NOME (`ItemState.tags`), como sempre guardou.
   Esta base dá cor e ordem a cada nome e é a mesma para o painel inteiro —
   Calendário, Produções e o painel do conteúdo leem daqui. Etiqueta usada em
   card antigo e ainda fora da base aparece com a cor neutra (nada se perde). */
import { syncToCloud } from './storage'
import { EVENTO_PADRAO } from './padraoEditorial'
import { CORES_ETIQUETA } from '../theme'

export interface Etiqueta { nome: string; cor: string }

export const ETIQUETAS_KEY = 'sm_etiquetas'
export const COR_NEUTRA = CORES_ETIQUETA[0]

const chave = (nome: string) => nome.trim().toLowerCase()

export function limparNome(nome: string): string {
  return nome.replace(/\s+/g, ' ').trim().slice(0, 40)
}

/** A base + as etiquetas já usadas nos cards que ainda não estão nela. */
export function etiquetasConhecidas(base: Etiqueta[], usadas: Iterable<string>): Etiqueta[] {
  const out = [...base]
  const vistos = new Set(base.map(e => chave(e.nome)))
  for (const n of usadas) {
    const nome = limparNome(n)
    if (!nome || vistos.has(chave(nome))) continue
    vistos.add(chave(nome))
    out.push({ nome, cor: COR_NEUTRA })
  }
  return out
}

export function corDaEtiqueta(base: Etiqueta[], nome: string): string {
  return base.find(e => chave(e.nome) === chave(nome))?.cor ?? COR_NEUTRA
}

/** Cria (ou devolve a base igual, se já existe com esse nome). */
export function adicionarEtiqueta(base: Etiqueta[], nome: string, cor: string = COR_NEUTRA): Etiqueta[] {
  const n = limparNome(nome)
  if (!n || base.some(e => chave(e.nome) === chave(n))) return base
  return [...base, { nome: n, cor }]
}

/** Edita nome e/ou cor. Recusa (devolve igual) se o novo nome já é de outra etiqueta. */
export function editarEtiqueta(base: Etiqueta[], de: string, novo: Etiqueta): Etiqueta[] {
  const n = limparNome(novo.nome)
  if (!n) return base
  if (chave(n) !== chave(de) && base.some(e => chave(e.nome) === chave(n))) return base
  const existe = base.some(e => chave(e.nome) === chave(de))
  return existe
    ? base.map(e => (chave(e.nome) === chave(de) ? { nome: n, cor: novo.cor } : e))
    : [...base, { nome: n, cor: novo.cor }]
}

export function removerEtiqueta(base: Etiqueta[], nome: string): Etiqueta[] {
  return base.filter(e => chave(e.nome) !== chave(nome))
}

/** As etiquetas de um card depois de renomear `de` → `para` (sem duplicar). */
export function renomearNoCard(tags: string[], de: string, para: string): string[] {
  const out: string[] = []
  for (const t of tags) {
    const v = chave(t) === chave(de) ? para : t
    if (!out.some(x => chave(x) === chave(v))) out.push(v)
  }
  return out
}

export function carregarEtiquetas(): Etiqueta[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ETIQUETAS_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((e): e is Etiqueta => !!e && typeof (e as Etiqueta).nome === 'string').map(e => ({ nome: e.nome, cor: e.cor || COR_NEUTRA })) : []
  } catch { return [] }
}

export function salvarEtiquetas(base: Etiqueta[]): void {
  try { localStorage.setItem(ETIQUETAS_KEY, JSON.stringify(base)) } catch { /* sem armazenamento */ }
  syncToCloud(ETIQUETAS_KEY, base)
  window.dispatchEvent(new Event(EVENTO_PADRAO))
}
