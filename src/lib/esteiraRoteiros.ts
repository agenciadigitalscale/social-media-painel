/* lib/esteiraRoteiros.ts — a esteira de roteiros do mês (aba 37, 2026-10-20).

   Um card por CLIENTE por MÊS (ou por job avulso): o documento de roteiros
   daquele mês, de "A fazer" para "Prontos". Não confundir com a Central de
   Roteiros de Produções, que acompanha cada roteiro de cada conteúdo.

   Persistência: `sm_esteira_roteiros` — mapa id → card (localStorage +
   syncToCloud, em SYNC_KEYS, com ramo no applyRemoteSync do App). Mapa e não
   lista: a reconciliação de três vias do storage.ts junta por entrada, então
   duas pessoas mexendo em cards diferentes ao mesmo tempo não se apagam.

   Cliente fixo guarda o ID oficial (lib/clientes) — o nome mostrado vem do
   cadastro, e renomear o cliente reflete aqui. Freelancer/avulso guarda um nome
   livre, sem precisar cadastrar na aba Clientes. Arquivar não apaga: muda o
   status e lembra de onde veio, para restaurar. */
import { syncToCloud } from './storage'
import { ativoNoMes, naCarteira, type CarteiraStore } from './planejamentoMes'

export const ESTEIRA_ROTEIROS_KEY = 'sm_esteira_roteiros'
export const EVENTO_ESTEIRA_ROTEIROS = 'ds:esteiraRoteiros'
export const RESPONSAVEL_PADRAO = 'kerges'

export type TipoRoteiro = 'fixo' | 'freelancer'
export type StatusRoteiro = 'a_fazer' | 'pronto' | 'arquivado'

export interface CardRoteiro {
  id: string
  tipo: TipoRoteiro
  origem: 'automatico' | 'manual'
  /** Cliente fixo: o ID oficial do cliente. */
  clienteId?: string
  /** Freelancer/avulso: o nome do cliente ou projeto. */
  nomeLivre?: string
  /** Mês de referência, "AAAA-MM". */
  mes: string
  /** Prazo de entrega, "AAAA-MM-DD". */
  prazo?: string
  status: StatusRoteiro
  /** De onde veio o card arquivado — é para onde ele volta ao restaurar. */
  statusAntes?: 'a_fazer' | 'pronto'
  link?: string
  /** Quantos roteiros o documento do mês traz. */
  quantidade?: number
  observacao?: string
  responsavel: string
  entradaEm: number
  prontoEm?: number
  atualizadoEm: number
}

export type EsteiraStore = Record<string, CardRoteiro>

export const chaveDoMes = (ano: number, mes: number) => `${ano}-${String(mes + 1).padStart(2, '0')}`

export function novoId(agora: number): string {
  return `rot_${agora.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Já existe card (não arquivado ou arquivado — tanto faz) deste cliente fixo neste mês? */
export function jaTemCard(store: EsteiraStore, clienteId: string, mes: string): boolean {
  return Object.values(store).some(c => c.tipo === 'fixo' && c.clienteId === clienteId && c.mes === mes)
}

/**
 * Card automático do cliente no mês — usado quando um cliente novo é cadastrado
 * e pelo "Trazer clientes do mês". Não duplica: se já existe, devolve o mesmo store.
 */
export function garantirCardDoCliente(store: EsteiraStore, clienteId: string, mes: string, agora: number): EsteiraStore {
  if (!clienteId.trim() || jaTemCard(store, clienteId, mes)) return store
  // ID fixo (cliente + mês): dois aparelhos criando ao mesmo tempo geram o MESMO
  // card — a reconciliação junta por id, então não nasce duplicado.
  const id = idAutomatico(clienteId, mes)
  return {
    ...store,
    [id]: {
      id, tipo: 'fixo', origem: 'automatico', clienteId, mes, status: 'a_fazer',
      responsavel: RESPONSAVEL_PADRAO, entradaEm: agora, atualizadoEm: agora,
    },
  }
}

export const idAutomatico = (clienteId: string, mes: string) => `auto:${mes}:${clienteId}`

/**
 * Virada do mês: todo cliente MENSAL ativo na carteira no mês ganha o card em
 * "A fazer". Quem saiu não entra; quem já tem card (até arquivado) não repete.
 * Freelancer fica de fora — job avulso entra pelo "+ Novo roteiro".
 */
export function preencherMes(store: EsteiraStore, ids: readonly string[], carteira: CarteiraStore, ano: number, mes: number, agora: number): EsteiraStore {
  const ym = chaveDoMes(ano, mes)
  let s = store
  for (const id of ids) {
    if (naCarteira(carteira, id).tipo !== 'mensal' || !ativoNoMes(carteira, id, ano, mes)) continue
    s = garantirCardDoCliente(s, id, ym, agora)
  }
  return s
}

export interface NovoCardRoteiro {
  tipo: TipoRoteiro
  clienteId?: string
  nomeLivre?: string
  mes: string
  prazo?: string
  link?: string
  quantidade?: number
  observacao?: string
  responsavel?: string
}

/** Card criado à mão ("+ Novo roteiro"). Nasce em "A fazer". */
export function criarCard(store: EsteiraStore, n: NovoCardRoteiro, agora: number): { store: EsteiraStore; id: string } {
  const id = novoId(agora)
  const card: CardRoteiro = {
    id, tipo: n.tipo, origem: 'manual', mes: n.mes, status: 'a_fazer',
    responsavel: n.responsavel || RESPONSAVEL_PADRAO, entradaEm: agora, atualizadoEm: agora,
    ...(n.tipo === 'fixo' ? { clienteId: n.clienteId } : { nomeLivre: n.nomeLivre?.trim() }),
    ...(n.prazo ? { prazo: n.prazo } : {}),
    ...(n.link?.trim() ? { link: n.link.trim() } : {}),
    ...(quantidadeValida(n.quantidade) ? { quantidade: n.quantidade } : {}),
    ...(n.observacao?.trim() ? { observacao: n.observacao.trim() } : {}),
  }
  return { store: { ...store, [id]: card }, id }
}

/** Edita campos de um card (sem mexer no status nem nas datas automáticas). */
export function editarCard(store: EsteiraStore, id: string, campos: Partial<Omit<CardRoteiro, 'id' | 'status' | 'entradaEm' | 'prontoEm'>>, agora: number): EsteiraStore {
  const c = store[id]
  if (!c) return store
  return { ...store, [id]: { ...c, ...campos, atualizadoEm: agora } }
}

/** Move entre "A fazer" e "Prontos". Ir para Prontos carimba data e hora. */
export function moverCard(store: EsteiraStore, id: string, para: 'a_fazer' | 'pronto', agora: number): EsteiraStore {
  const c = store[id]
  if (!c || c.status === para) return store
  const { prontoEm: _p, ...semPronto } = c
  const novo: CardRoteiro = para === 'pronto'
    ? { ...c, status: 'pronto', prontoEm: agora, atualizadoEm: agora }
    : { ...semPronto, status: 'a_fazer', atualizadoEm: agora }
  return { ...store, [id]: novo }
}

export function arquivarCard(store: EsteiraStore, id: string, agora: number): EsteiraStore {
  const c = store[id]
  if (!c || c.status === 'arquivado') return store
  return { ...store, [id]: { ...c, status: 'arquivado', statusAntes: c.status, atualizadoEm: agora } }
}

export function restaurarCard(store: EsteiraStore, id: string, agora: number): EsteiraStore {
  const c = store[id]
  if (!c || c.status !== 'arquivado') return store
  const { statusAntes, ...resto } = c
  return { ...store, [id]: { ...resto, status: statusAntes ?? 'a_fazer', atualizadoEm: agora } }
}

/** Excluir de vez — só card criado à mão (o automático se arquiva). */
export function excluirCard(store: EsteiraStore, id: string): EsteiraStore {
  if (store[id]?.origem !== 'manual') return store
  const { [id]: _fora, ...resto } = store
  return resto
}

export const linkValido = (link?: string) => !!link && /^https?:\/\/\S+$/i.test(link.trim())

/** Quantidade de roteiros: inteiro de 1 a 999 (vazio = não informado). */
export const quantidadeValida = (n?: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 999

/** Nome mostrado no card: cadastro oficial (fixo) ou o nome livre (freelancer). */
export function nomeDoCard(c: CardRoteiro, nomeDoCliente: (id: string) => string): string {
  return c.tipo === 'fixo' && c.clienteId ? nomeDoCliente(c.clienteId) : (c.nomeLivre || 'Sem nome')
}

/**
 * Freelancer = job avulso OU cliente cadastrado como freelancer na carteira.
 * `tipoDoCliente` vem da carteira (lib/planejamentoMes).
 */
export function ehFreelancer(c: CardRoteiro, tipoDoCliente: (id: string) => 'mensal' | 'freelancer'): boolean {
  return c.tipo === 'freelancer' || (!!c.clienteId && tipoDoCliente(c.clienteId) === 'freelancer')
}

export interface FiltroEsteira {
  mes: string
  tipo: 'todos' | 'fixos' | 'freelancer'
  busca: string
  arquivados: boolean
}

/** Os cards da tela: do mês, do tipo e da busca; arquivados só na vista própria. */
export function cardsDaTela(
  store: EsteiraStore, f: FiltroEsteira,
  nomeDoCliente: (id: string) => string, tipoDoCliente: (id: string) => 'mensal' | 'freelancer',
): CardRoteiro[] {
  const q = f.busca.trim().toLowerCase()
  return Object.values(store)
    .filter(c => c.mes === f.mes)
    .filter(c => f.arquivados ? c.status === 'arquivado' : c.status !== 'arquivado')
    .filter(c => f.tipo === 'todos' || (f.tipo === 'freelancer') === ehFreelancer(c, tipoDoCliente))
    .filter(c => !q || `${nomeDoCard(c, nomeDoCliente)} ${c.clienteId ?? ''} ${c.observacao ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999') || a.entradaEm - b.entradaEm)
}

export function carregarEsteira(): EsteiraStore {
  try {
    const raw = JSON.parse(localStorage.getItem(ESTEIRA_ROTEIROS_KEY) ?? '{}') as unknown
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as EsteiraStore : {}
  } catch { return {} }
}

export function salvarEsteira(store: EsteiraStore): void {
  try { localStorage.setItem(ESTEIRA_ROTEIROS_KEY, JSON.stringify(store)) } catch { /* sem armazenamento */ }
  syncToCloud(ESTEIRA_ROTEIROS_KEY, store)
  window.dispatchEvent(new Event(EVENTO_ESTEIRA_ROTEIROS))
}
