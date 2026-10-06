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
import { EVENTO_PADRAO, gerarVagas, ordenarVagas, padraoDo, type PadraoCliente, type PadroesStore, type Vaga } from './padraoEditorial'

// ── Preferências do mês ─────────────────────────────────────────────────

export const PREF_MES_KEY = 'sm_pref_mes'
/**
 * cliente → "AAAA-MM" → preferências daquele mês. `vagas` (2026-10-05) são as
 * preferências por DATA; ausentes, o mês usa as que o padrão do mês gera.
 */
export type MesDoCliente = PadraoCliente & { vagas?: Vaga[] }
export type PrefMesStore = Record<string, Record<string, MesDoCliente>>

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

/** O padrão sem a meta: criar o mês copia os DIAS; a meta só vira exceção quando alguém a fixa no mês. */
function semMeta(p: PadraoCliente): PadraoCliente {
  const { meta: _meta, ...resto } = p
  return resto
}

/** "Criar o mês": copia o padrão para o mês só se ele ainda não tem preferências próprias. */
export function garantirMes(prefs: PrefMesStore, padroes: PadroesStore, cliente: string, ano: number, mes: number): PrefMesStore {
  if (prefs[cliente]?.[chaveMes(ano, mes)]) return prefs
  return comPreferencias(prefs, cliente, ano, mes, semMeta(padraoDo(padroes, cliente)))
}

/** A exceção de meta de um mês (ausente = o mês segue a meta permanente do cliente). */
export function excecaoDeMeta(prefs: PrefMesStore, cliente: string, ano: number, mes: number): MesDoCliente['meta'] {
  const m = prefs[cliente]?.[chaveMes(ano, mes)]?.meta
  return m && Object.keys(m).length ? m : undefined
}

/** As vagas (preferências por data) do mês: as gravadas, ou as que o padrão do mês gera. */
export function vagasDoMes(prefs: PrefMesStore, padroes: PadroesStore, cliente: string, ano: number, mes: number): Vaga[] {
  const doMes = prefs[cliente]?.[chaveMes(ano, mes)]
  if (doMes?.vagas) return doMes.vagas.map(v => ({ ...v }))
  return gerarVagas(preferenciasDoMes(prefs, padroes, cliente, ano, mes).padrao, ano, mes)
}

/** Grava as vagas do mês (criar, mover ou tirar vaga vale SÓ para este mês). */
export function comVagas(prefs: PrefMesStore, padroes: PadroesStore, cliente: string, ano: number, mes: number, vagas: Vaga[]): PrefMesStore {
  const base = garantirMes(prefs, padroes, cliente, ano, mes)
  const k = chaveMes(ano, mes)
  return { ...base, [cliente]: { ...base[cliente], [k]: { ...base[cliente][k], vagas: ordenarVagas(vagas) } } }
}

/** Move a vaga de um dia para outro (a primeira igual àquela). */
export function moverVaga(vagas: Vaga[], de: Vaga, paraDia: number): Vaga[] {
  const i = vagas.findIndex(v => v.dia === de.dia && v.tipo === de.tipo)
  if (i < 0 || de.dia === paraDia) return vagas
  return vagas.map((v, j) => (j === i ? { ...v, dia: paraDia } : v))
}

export function removerVaga(vagas: Vaga[], alvo: Vaga): Vaga[] {
  const i = vagas.findIndex(v => v.dia === alvo.dia && v.tipo === alvo.tipo)
  return i < 0 ? vagas : vagas.filter((_, j) => j !== i)
}

/**
 * "Restaurar padrão": o mês volta a ser uma cópia do Padrão Editorial ATUAL —
 * as vagas manuais saem e as do padrão voltam. Mexe só em preferência; nenhum
 * conteúdo é apagado nem movido.
 */
export function restaurarMes(prefs: PrefMesStore, padroes: PadroesStore, cliente: string, ano: number, mes: number): PrefMesStore {
  // A exceção de META do mês não é preferência: continua valendo.
  const meta = excecaoDeMeta(prefs, cliente, ano, mes)
  return comPreferencias(prefs, cliente, ano, mes, { ...semMeta(padraoDo(padroes, cliente)), ...(meta ? { meta } : {}) })
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
  /** Nome de EXIBIÇÃO. O nome original continua sendo a chave dos conteúdos — trocá-lo quebraria o vínculo. */
  nome?: string
  /** Nicho (sobrescreve o do cadastro original). */
  nicho?: 'gastronomico' | 'variados'
  /** Segmento livre: "Restaurante", "Pet shop"… */
  segmento?: string
  cidade?: string
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

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const rotuloMes = (ym: string) => { const [a, m] = ym.split('-').map(Number); return `${MESES_CURTOS[m - 1]}/${a}` }

/** Situação do cliente no mês: ativo, ainda vai entrar, ou já saiu. */
export function situacaoNoMes(carteira: CarteiraStore, cliente: string, ano: number, mes: number): 'ativo' | 'futuro' | 'saiu' {
  const c = naCarteira(carteira, cliente)
  const ym = chaveMes(ano, mes)
  if (c.entrada && ym < c.entrada) return 'futuro'
  if (c.saida && ym >= c.saida) return 'saiu'
  return 'ativo'
}

/** Histórico mês a mês (mais recente primeiro): quem estava na carteira em cada mês. Nada é apagado. */
export function historicoDoCliente(carteira: CarteiraStore, cliente: string, ate: Date, meses = 12): { ym: string; rotulo: string; ativo: boolean }[] {
  return Array.from({ length: meses }, (_, i) => {
    const d = new Date(ate.getFullYear(), ate.getMonth() - i, 1)
    const ym = chaveMes(d.getFullYear(), d.getMonth())
    return { ym, rotulo: rotuloMes(ym), ativo: ativoNoMes(carteira, cliente, d.getFullYear(), d.getMonth()) }
  })
}

/**
 * Traz para a carteira (sincronizada) o que a aba Clientes antiga guardava SÓ no
 * navegador: tipo, "removido a partir do mês" (mês 0-based, "2026-9" = outubro),
 * meses de freelancer (o primeiro vira a entrada) e nome de exibição. Só preenche
 * o que a carteira ainda não tem — o que já foi decidido nela vale mais.
 */
export function migrarCarteiraLegada(carteira: CarteiraStore, legado: {
  tipos?: Record<string, TipoCliente>
  removidoDesde?: Record<string, string>
  mesesFreelancer?: Record<string, string[]>
  nomes?: Record<string, string>
}): CarteiraStore {
  const out: CarteiraStore = { ...carteira }
  const ymDoLegado = (k: string) => { const [a, m] = k.split('-').map(Number); return Number.isFinite(a) && Number.isFinite(m) ? chaveMes(a, m) : undefined }
  const nomes = new Set([
    ...Object.keys(legado.tipos ?? {}), ...Object.keys(legado.removidoDesde ?? {}),
    ...Object.keys(legado.mesesFreelancer ?? {}), ...Object.keys(legado.nomes ?? {}),
  ])
  for (const n of nomes) {
    const atual: ClienteNaCarteira = { ...(out[n] ?? { tipo: 'mensal' }) }
    const antes = JSON.stringify(out[n] ?? null)
    if (!out[n] && legado.tipos?.[n]) atual.tipo = legado.tipos[n]
    if (!atual.saida && legado.removidoDesde?.[n]) atual.saida = ymDoLegado(legado.removidoDesde[n])
    const fl = (legado.mesesFreelancer?.[n] ?? []).map(ymDoLegado).filter((x): x is string => !!x).sort()
    if (!atual.entrada && fl.length && atual.tipo === 'freelancer') atual.entrada = fl[0]
    if (!atual.nome && legado.nomes?.[n] && legado.nomes[n] !== n) atual.nome = legado.nomes[n]
    for (const k of Object.keys(atual) as (keyof ClienteNaCarteira)[]) if (atual[k] === undefined) delete atual[k]
    if (JSON.stringify(atual) !== antes && !(antes === 'null' && JSON.stringify(atual) === JSON.stringify({ tipo: 'mensal' }))) out[n] = atual
  }
  return out
}

// ── Ordem manual da lista de clientes ───────────────────────────────────

export const ORDEM_KEY = 'sm_ordem_clientes'

/** Ordena pela ordem manual; quem não está nela vai para o fim, em ordem alfabética. */
export function ordenarClientes<T extends { name: string }>(lista: T[], ordem: string[], modo: 'manual' | 'az' | 'za'): T[] {
  const az = (a: T, b: T) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true })
  if (modo === 'az') return [...lista].sort(az)
  if (modo === 'za') return [...lista].sort((a, b) => az(b, a))
  const pos = new Map(ordem.map((n, i) => [n, i]))
  return [...lista].sort((a, b) => (pos.get(a.name) ?? 1e9) - (pos.get(b.name) ?? 1e9) || az(a, b))
}

/** Sobe ou desce um cliente na ordem manual (a partir da lista como está na tela). */
export function moverNaOrdem(visiveis: string[], cliente: string, dir: -1 | 1): string[] {
  const i = visiveis.indexOf(cliente)
  const j = i + dir
  if (i < 0 || j < 0 || j >= visiveis.length) return visiveis
  const out = [...visiveis]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

export function carregarOrdem(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ORDEM_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}

export function salvarOrdem(ordem: string[]): void {
  try { localStorage.setItem(ORDEM_KEY, JSON.stringify(ordem)) } catch { /* sem armazenamento */ }
  syncToCloud(ORDEM_KEY, ordem)
  window.dispatchEvent(new Event(EVENTO_PADRAO))
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
