/* lib/clientes.ts — o cadastro OFICIAL de clientes (2026-10-14).

   ID do cliente = a chave que os cards já guardam em `item.c` (o nome original).
   Ela nunca muda: renomear é trocar o NOME DE EXIBIÇÃO (`sm_carteira[id].nome`),
   e toda tela mostra o nome por `nomeCliente`. Por isso não há regravação de
   card: 1.500 cards, pastas, portal, telefones e as tabelas do servidor já estão
   presos a essa chave.

   Nasceu do caso Compostela: o cliente estava marcado como "saiu em 05/2026",
   a equipe seguiu produzindo (cards em set/out), e quando ele voltou foi
   cadastrado de novo como "Compostela Grill" — sem cards. Clientes e Calendário
   filtravam pela carteira e o escondiam; Produção não filtrava e o mostrava.
   Daqui saem as regras que todas as telas passam a usar:
   - `visiveisNoMes`: ativo na carteira OU com conteúdo no mês (com o selo
     "fora da carteira"). Cliente com trabalho no mês não some de tela nenhuma.
   - `resolverCliente`: id, nome de exibição ou apelido → id oficial.
   - `conferirClientes`: órfãos, conteúdo fora da carteira e possíveis
     duplicados — só aponta, nunca corrige sozinho. */
import { useEffect, useState } from 'react'
import type { ContentItem, ItemState } from '../types'
import { clientKey } from './clientRoster'
import { findSimilarClient } from './clientFolders'
import { EVENTO_PADRAO } from './padraoEditorial'
import { postagemDoCard } from './programacao'
import { ativoNoMes, carregarCarteira, chaveMes, type CarteiraStore } from './planejamentoMes'

/** Nome de exibição do cliente. Sem nome definido, o próprio id. */
export function nomeCliente(id: string, carteira: CarteiraStore): string {
  return carteira[id]?.nome?.trim() || id
}

/**
 * Id oficial a partir de qualquer nome pelo qual o cliente é conhecido: o id,
 * o nome de exibição ou um apelido — ignorando maiúscula, espaço e apóstrofo.
 * Nome que não bate com ninguém devolve `undefined` (não se adivinha cliente).
 */
export function resolverCliente(nome: string, ids: readonly string[], carteira: CarteiraStore): string | undefined {
  const k = clientKey(nome)
  if (!k) return undefined
  const porId = ids.find(id => clientKey(id) === k)
  if (porId) return porId
  return ids.find(id => {
    const c = carteira[id]
    if (c?.nome && clientKey(c.nome) === k) return true
    return (c?.apelidos ?? []).some(a => clientKey(a) === k)
  })
}

export interface ClienteRemovido {
  id: string
  nome: string
  /** Mês em que saiu da carteira ("AAAA-MM"). */
  saida: string
}

/**
 * Quem foi removido da carteira (o "Remover cliente" da aba Clientes) e já está
 * fora no mês de `hoje` — mais recente primeiro. Nada disso foi apagado.
 */
export function clientesRemovidos(ids: readonly string[], carteira: CarteiraStore, hoje: Date): ClienteRemovido[] {
  const ym = chaveMes(hoje.getFullYear(), hoje.getMonth())
  return ids
    .filter(id => { const s = carteira[id]?.saida; return !!s && s <= ym })
    .map(id => ({ id, nome: nomeCliente(id, carteira), saida: carteira[id]!.saida! }))
    .sort((a, b) => b.saida.localeCompare(a.saida) || a.nome.localeCompare(b.nome))
}

/** Volta o cliente para a carteira: tira a saída e mantém o resto (nome, tipo, nicho, entrada). */
export function voltarParaCarteira(carteira: CarteiraStore, id: string): CarteiraStore {
  const c = carteira[id]
  if (!c?.saida) return carteira
  const { saida: _s, ...resto } = c
  return { ...carteira, [id]: resto }
}

/** Clientes com conteúdo (pela data de postagem, a mesma do Calendário) no mês. */
export function clientesComConteudoNoMes(items: readonly ContentItem[], states: Record<number, ItemState>, ano: number, mes: number): Set<string> {
  const out = new Set<string>()
  for (const it of items) {
    const d = postagemDoCard(it, states[it.i]).quando
    if (d.getFullYear() === ano && d.getMonth() === mes) out.add(it.c)
  }
  return out
}

export interface VisivelNoMes {
  id: string
  /** Fora da carteira no mês, mas com conteúdo nele — aparece com aviso. */
  foraDaCarteira: boolean
}

/**
 * Quem aparece num mês: ativo na carteira, OU com conteúdo nele. A regra única
 * de Clientes, Calendário e Cronograma — Produção já mostrava todo card.
 */
export function visiveisNoMes(
  ids: readonly string[], carteira: CarteiraStore, comConteudo: Set<string>, ano: number, mes: number,
): VisivelNoMes[] {
  const out: VisivelNoMes[] = []
  for (const id of ids) {
    if (ativoNoMes(carteira, id, ano, mes)) out.push({ id, foraDaCarteira: false })
    else if (comConteudo.has(id)) out.push({ id, foraDaCarteira: true })
  }
  return out
}

export interface ConferenciaClientes {
  /** Cards cujo cliente não está no cadastro (nem como apelido). */
  orfaos: { nome: string; cards: number; sugestao?: string }[]
  /** Cliente com conteúdo em mês em que não está na carteira. */
  foraDaCarteira: { id: string; nome: string; meses: string[]; cards: number }[]
  /** Pares parecidos demais para serem clientes diferentes — decidir na mão. */
  duplicados: { a: string; b: string; motivo: string }[]
}

export function conferirClientes(opts: {
  items: readonly ContentItem[]
  states: Record<number, ItemState>
  /** Ids do cadastro (base + criados pela tela), já sem os arquivados. */
  ids: readonly string[]
  /** Ids arquivados de propósito: cards deles não são órfãos. */
  arquivados: readonly string[]
  carteira: CarteiraStore
}): ConferenciaClientes {
  const { items, states, ids, arquivados, carteira } = opts
  const conhecidos = new Set([...ids, ...arquivados].map(clientKey))

  const orfaosMap = new Map<string, number>()
  const fora = new Map<string, { meses: Set<string>; cards: number }>()
  for (const it of items) {
    if (!conhecidos.has(clientKey(it.c))) {
      orfaosMap.set(it.c, (orfaosMap.get(it.c) ?? 0) + 1)
      continue
    }
    if (!ids.includes(it.c)) continue
    const d = postagemDoCard(it, states[it.i]).quando
    if (ativoNoMes(carteira, it.c, d.getFullYear(), d.getMonth())) continue
    const f = fora.get(it.c) ?? { meses: new Set<string>(), cards: 0 }
    f.meses.add(chaveMes(d.getFullYear(), d.getMonth()))
    f.cards++
    fora.set(it.c, f)
  }

  const orfaos = [...orfaosMap].map(([nome, cards]) => {
    const sugestao = resolverCliente(nome, ids, carteira) ?? findSimilarClient(nome, [...ids])
    return { nome, cards, ...(sugestao ? { sugestao } : {}) }
  }).sort((a, b) => b.cards - a.cards)

  const foraDaCarteira = [...fora].map(([id, f]) => ({ id, nome: nomeCliente(id, carteira), meses: [...f.meses].sort(), cards: f.cards }))
    .sort((a, b) => b.cards - a.cards)

  const duplicados: ConferenciaClientes['duplicados'] = []
  const vistos = new Set<string>()
  const par = (a: string, b: string, motivo: string) => {
    const k = [a, b].sort().join('\u0000')
    if (a === b || vistos.has(k)) return
    vistos.add(k)
    duplicados.push({ a, b, motivo })
  }
  for (const a of ids) {
    for (const b of ids) {
      if (a >= b) continue
      const na = nomeCliente(a, carteira), nb = nomeCliente(b, carteira)
      if (clientKey(na) === clientKey(nb)) par(a, b, 'mesmo nome de exibição')
      else if (findSimilarClient(a, [b]) || findSimilarClient(na, [nb])) par(a, b, 'nomes parecidos')
    }
  }
  return { orfaos, foraDaCarteira, duplicados }
}

/*
 * `nomeDoCliente(id)` sem hook — para os ~80 pontos que mostram cliente (card
 * da Produção, Calendário, Agendamento…). A carteira fica em cache e é relida
 * quando muda (nesta aba, pelo sync ou em outra aba).
 */
let _carteiraCache: CarteiraStore | null = null
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  const limpar = () => { _carteiraCache = null }
  window.addEventListener(EVENTO_PADRAO, limpar)
  window.addEventListener('storage', limpar)
}
export function nomeDoCliente(id: string): string {
  if (!_carteiraCache) _carteiraCache = carregarCarteira()
  return nomeCliente(id, _carteiraCache)
}

/** A carteira viva: relê quando ela muda (nesta aba ou vinda do sync). */
export function useCarteira(): CarteiraStore {
  const [carteira, setCarteira] = useState<CarteiraStore>(() => carregarCarteira())
  useEffect(() => {
    const reler = () => setCarteira(carregarCarteira())
    window.addEventListener(EVENTO_PADRAO, reler)
    return () => window.removeEventListener(EVENTO_PADRAO, reler)
  }, [])
  return carteira
}

/** `nome(id)` com a carteira viva — para mostrar cliente em qualquer tela. */
export function useNomeCliente(): (id: string) => string {
  const carteira = useCarteira()
  return (id: string) => nomeCliente(id, carteira)
}

