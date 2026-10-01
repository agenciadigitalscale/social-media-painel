/* lib/planejamentoMes.ts — o que o Calendário sabe de cada MÊS (2026-10-01).

   Duas coisas que o Padrão Editorial sozinho não guardava:

   1. PREFERÊNCIAS DO MÊS. Quando o mês de um cliente é criado (a primeira
      distribuição, ou a primeira edição das preferências dele), o padrão é
      COPIADO para o mês. Daí em diante os dois são independentes: mudar outubro
      não mexe no padrão, e mudar o padrão não reescreve outubro — senão o
      histórico de setembro seria reescrito toda vez que alguém ajustasse o
      padrão. "Restaurar padrão" é o único caminho que sobrescreve o mês.

   2. CARTEIRA MENSAL. Cliente que entrou em outubro não aparece em setembro;
      cliente que saiu em outubro some de outubro em diante — mas os conteúdos
      antigos dele continuam onde estavam. E o tipo do cliente: o MENSAL tem
      padrão, meta e distribuição; o FREELANCER é demanda avulsa e não recebe
      essas regras automaticamente.

   Tudo puro e testado; a gravação segue o caminho de sempre (localStorage +
   syncToCloud, com ramo próprio no applyRemoteSync do App). */
import { syncToCloud } from './storage'
import { EVENTO_PADRAO, padraoDo, type PadraoCliente, type PadroesStore } from './padraoEditorial'

// ── Preferências do mês ─────────────────────────────────────────────────

export const PREF_MES_KEY = 'sm_pref_mes'
/** cliente → "AAAA-MM" → preferências daquele mês. */
export type PrefMesStore = Record<string, Record<string, PadraoCliente>>

export const chaveMes = (ano: number, mes: number) => `${ano}-${String(mes + 1).padStart(2, '0')}`

export interface PrefDoMes {
  padrao: PadraoCliente
  /** true = o mês já tem preferências próprias; false = ainda segue o padrão. */
  proprio: boolean
}

/** As preferências que valem num mês: as do mês, se já existirem; senão o padrão do cliente. */
export function preferenciasDoMes(prefs: PrefMesStore, padroes: PadroesStore, cliente: string, ano: number, mes: number): PrefDoMes {
  const doMes = prefs[cliente]?.[chaveMes(ano, mes)]
  if (doMes) {
    const base = padraoDo({ [cliente]: doMes }, cliente)
    return { padrao: base, proprio: true }
  }
  return { padrao: padraoDo(padroes, cliente), proprio: false }
}

/** Grava as preferências de um mês (cópia — editar depois não mexe no padrão). */
export function comPreferencias(prefs: PrefMesStore, cliente: string, ano: number, mes: number, padrao: PadraoCliente): PrefMesStore {
  const copia: PadraoCliente = JSON.parse(JSON.stringify(padrao))
  return { ...prefs, [cliente]: { ...(prefs[cliente] ?? {}), [chaveMes(ano, mes)]: copia } }
}

/** "Criar o mês": copia o padrão para o mês só se ele ainda não tem preferências próprias. */
export function garantirMes(prefs: PrefMesStore, padroes: PadroesStore, cliente: string, ano: number, mes: number): PrefMesStore {
  if (prefs[cliente]?.[chaveMes(ano, mes)]) return prefs
  return comPreferencias(prefs, cliente, ano, mes, padraoDo(padroes, cliente))
}

export function carregarPrefMes(): PrefMesStore {
  try {
    const raw = JSON.parse(localStorage.getItem(PREF_MES_KEY) ?? '{}') as PrefMesStore
    return raw && typeof raw === 'object' ? raw : {}
  } catch { return {} }
}

export function salvarPrefMes(store: PrefMesStore): void {
  try { localStorage.setItem(PREF_MES_KEY, JSON.stringify(store)) } catch { /* sem armazenamento */ }
  syncToCloud(PREF_MES_KEY, store)
  window.dispatchEvent(new Event(EVENTO_PADRAO))
}

// ── Carteira mensal ─────────────────────────────────────────────────────

export const CARTEIRA_KEY = 'sm_carteira'
export type TipoCliente = 'mensal' | 'freelancer'

export interface ClienteNaCarteira {
  tipo: TipoCliente
  /** Primeiro mês ativo ("AAAA-MM"). Ausente = desde sempre. */
  entrada?: string
  /** Primeiro mês em que JÁ NÃO está ativo ("AAAA-MM"). Ausente = continua. */
  saida?: string
}
export type CarteiraStore = Record<string, ClienteNaCarteira>

/** Sem cadastro, o cliente é mensal e ativo — é o caso de todos os de hoje. */
export function naCarteira(carteira: CarteiraStore, cliente: string): ClienteNaCarteira {
  return carteira[cliente] ?? { tipo: 'mensal' }
}

/** O cliente está na carteira deste mês? Entrou em outubro → não está em setembro; saiu em outubro → não está em outubro. */
export function ativoNoMes(carteira: CarteiraStore, cliente: string, ano: number, mes: number): boolean {
  const c = naCarteira(carteira, cliente)
  const ym = chaveMes(ano, mes)
  if (c.entrada && ym < c.entrada) return false
  if (c.saida && ym >= c.saida) return false
  return true
}

export function carregarCarteira(): CarteiraStore {
  try {
    const raw = JSON.parse(localStorage.getItem(CARTEIRA_KEY) ?? '{}') as CarteiraStore
    return raw && typeof raw === 'object' ? raw : {}
  } catch { return {} }
}

export function salvarCarteira(store: CarteiraStore): void {
  try { localStorage.setItem(CARTEIRA_KEY, JSON.stringify(store)) } catch { /* sem armazenamento */ }
  syncToCloud(CARTEIRA_KEY, store)
  window.dispatchEvent(new Event(EVENTO_PADRAO))
}
