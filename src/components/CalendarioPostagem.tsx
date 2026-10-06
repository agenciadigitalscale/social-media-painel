import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Menu, MenuItem, Snackbar, TextField, Tooltip, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import type { Client, ContentItem, ContentType, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'
import { DS } from '../theme'
import { clickable } from '../shared/a11y'
import { isRealLate } from '../lib/todaySignals'
import {
  TIPOS_PADRAO, ROTULO_TIPO, TIPO_DO_CARD, EVENTO_PADRAO, PADRAO_VAZIO, COR_TIPO, TIPOS_CRIACAO,
  carregarPadroes, salvarPadroes, padraoDo, metaEfetiva, tipoDoPadrao, corDoConteudo, rotuloDoTipo, segundoTipo,
  doClienteNoMes, gerarVagas, vagasLivres,
  type PadroesStore, type TipoPadrao, type Vaga,
} from '../lib/padraoEditorial'
import {
  carregarPrefMes, salvarPrefMes, preferenciasDoMes, comPreferencias, garantirMes, chaveMes,
  vagasDoMes, comVagas, moverVaga, removerVaga, restaurarMes, excecaoDeMeta,
  carregarCarteira, salvarCarteira, ativoNoMes, naCarteira,
  type PrefMesStore, type CarteiraStore,
} from '../lib/planejamentoMes'
import { carregarCapacidade, salvarCapacidade, cargaPorDia, ROTULO_FRENTE, type Capacidade } from '../lib/datasEntrega'
import PadraoDialog from './calendario/PadraoDialog'
import DistribuirDialog from './calendario/DistribuirDialog'
import EditarConteudoPainel, { type EdicaoConteudo } from './calendario/EditarConteudoPainel'
import NovoConteudoDialog, { type NovoConteudo } from './calendario/NovoConteudoDialog'
import EtiquetasDialog from './calendario/EtiquetasDialog'
import ArquivadosDialog from './calendario/ArquivadosDialog'
import { ETAPAS_CONTEUDO, nomeDe } from './calendario/equipe'
import { adicionarEtiqueta, carregarEtiquetas, corDaEtiqueta, editarEtiqueta, etiquetasConhecidas, removerEtiqueta, renomearNoCard, salvarEtiquetas, type Etiqueta } from '../lib/etiquetas'
import { donoDoCard } from '../lib/access'
import { carregarAtribuicoes, carregarPaineis, EVENTO_ATRIBUICOES } from '../lib/paineis'
import { aguardandoSocial, horaValida, postagemDoCard } from '../lib/programacao'
import { useIgStatus, type AgendamentosDoCard, type IgConta } from '../lib/instagram'
import { MarcaIG, SituacaoIG, destinosDa } from './calendario/ProgramacaoIG'

const DIA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/**
 * Calendário de postagem (2026-09-29): a data de postagem que o Social coloca no
 * card vira um calendário. Só leitura do que já existe — o card é o mesmo da
 * Produção; aqui muda a forma de olhar. Arrastar para outro dia remarca a data
 * (quem pode editar), e clicar no dia abre todos os conteúdos dele.
 */

type Etapa = 'todas' | 'producao' | 'aprovado' | 'cliente' | 'programado' | 'publicado'

const ETAPAS: { key: Etapa; label: string; status: Status[] }[] = [
  { key: 'todas',      label: 'Todas as etapas', status: [] },
  { key: 'producao',   label: 'Em produção',     status: [0, 1, 2, 6, 8] },
  { key: 'aprovado',   label: 'Aprovado',        status: [3] },
  { key: 'cliente',    label: 'Com o cliente',   status: [4, 5] },
  { key: 'programado', label: 'Programado',      status: [9] },
  { key: 'publicado',  label: 'Publicado',       status: [7] },
]


const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const POR_CELULA = 3

const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const mesmoDia = (a: Date, b: Date) => chaveDia(a) === chaveDia(b)

/** Programado com hora marcada vale mais que a data da pauta; senão, dia + hora do card. */
function dataDePostagem(item: ContentItem, st: ItemState | undefined): Date {
  return postagemDoCard(item, st).quando
}

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
  clients: string[]
  podeRemarcar: boolean
  onReschedule: (id: number, dt: Date) => void
  onAbrirProducao: () => void
  /** Plano de cada cliente (posts/reels por mês) — a meta do "Distribuir mês". */
  planos: Client[]
  /** Sócio exclui qualquer conteúdo; o Social só o que ainda está em "A fazer". */
  podeExcluirTudo: boolean
  /** Novo conteúdo pela janela do dia (cliente, nome, tipo, postagem, entrega, responsável, etapa). */
  onAdicionar: (n: NovoConteudo) => unknown
  onMudarTipo: (id: number, tipo: ContentType) => void
  /** Arquivar: o conteúdo sai das telas de trabalho, mas continua salvo (Arquivados). */
  onArquivar: (id: number) => void
  /** Conteúdos arquivados (criados à mão) — a "lixeira". */
  arquivados: ContentItem[]
  onRestaurar: (id: number) => void
  /** Exclusão definitiva (só sócio). */
  onExcluirDefinitivo?: (id: number) => void
  /** "Aprovar e programar": leva o card a Programado no dia e hora dele. */
  onProgramar: (id: number) => void
  /** Hora de postagem do card ("HH:MM"). */
  onMudarHora: (id: number, hora: string) => void
  /** Abre a escolha de dia e hora de novo (falhou no Instagram, ou horário vencido). */
  onReprogramar: (id: number) => void
  /** Abre a aba "Aprovar e programar". */
  onAbrirFila: () => void
  /** Painel lateral: cliente, nome, tipo, data/hora, etapa, observação, etiquetas. */
  onEditarConteudo: (id: number, e: EdicaoConteudo) => void
  /** Distribuição: cria vários de uma vez (com entrega e encaixe na fila). */
  onAdicionarVarios: (lista: NovoConteudo[]) => void
  /** "Reordenar datas": refaz a fila de entrega na capacidade de cada frente. Devolve quantos mudaram. */
  onReordenar: (modo: 'completo' | 'empurrar', capacidade?: Capacidade) => number
  /** Cards criados à mão — só esses trocam de cliente. */
  idsCriadosAMao: Set<number>
}

export default function CalendarioPostagem({ items, states, now, clients, podeRemarcar, onReschedule, onAbrirProducao, planos, podeExcluirTudo, onAdicionar, onMudarTipo, onArquivar, arquivados, onRestaurar, onExcluirDefinitivo, onProgramar, onMudarHora, onReprogramar, onAbrirFila, onEditarConteudo, onAdicionarVarios, onReordenar, idsCriadosAMao }: Props) {
  const [ref, setRef] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [modo, setModo] = useState<'mes' | 'semana'>('mes')
  const [cliente, setCliente] = useState('todos')
  const [tipo, setTipo] = useState<'todos' | TipoPadrao>('todos')
  const [etapa, setEtapa] = useState<Etapa>('todas')
  const [busca, setBusca] = useState('')
  const [diaAberto, setDiaAberto] = useState<Date | null>(null)
  const [arrastando, setArrastando] = useState<number | null>(null)
  // Preferência (vaga) sendo arrastada para outro dia — vale só para o mês da tela.
  const [arrastandoVaga, setArrastandoVaga] = useState<Vaga | null>(null)
  const [alvo, setAlvo] = useState<string | null>(null)

  // Padrão Editorial, preferências do mês, carteira e capacidade — relidos quando
  // mudam aqui ou chegam de outro aparelho (mesmo evento).
  const [padroes, setPadroes] = useState<PadroesStore>(() => carregarPadroes())
  const [prefs, setPrefs] = useState<PrefMesStore>(() => carregarPrefMes())
  const [carteira, setCarteira] = useState<CarteiraStore>(() => carregarCarteira())
  const [capacidade, setCapacidade] = useState(() => carregarCapacidade())
  const [baseEtiquetas, setBaseEtiquetas] = useState<Etiqueta[]>(() => carregarEtiquetas())
  // Dono do card (responsável) — a mesma regra da Produção: gaveta → editor → responsável.
  const [atrib, setAtrib] = useState(() => carregarAtribuicoes())
  const [paineis, setPaineis] = useState(() => carregarPaineis())
  useEffect(() => {
    const reler = () => {
      setPadroes(carregarPadroes()); setPrefs(carregarPrefMes()); setCarteira(carregarCarteira()); setCapacidade(carregarCapacidade())
      setBaseEtiquetas(carregarEtiquetas())
    }
    const relerDono = () => { setAtrib(carregarAtribuicoes()); setPaineis(carregarPaineis()) }
    window.addEventListener(EVENTO_PADRAO, reler)
    window.addEventListener(EVENTO_ATRIBUICOES, relerDono)
    return () => { window.removeEventListener(EVENTO_PADRAO, reler); window.removeEventListener(EVENTO_ATRIBUICOES, relerDono) }
  }, [])
  const responsavelDe = (id: number) => donoDoCard(id, states[id], atrib, paineis)
  const [padraoAberto, setPadraoAberto] = useState<'padrao' | 'mes' | null>(null)
  const [distribuirAberto, setDistribuirAberto] = useState(false)
  const [reordenarAberto, setReordenarAberto] = useState(false)
  const [capTxt, setCapTxt] = useState({ video: '', design: '' })
  const [editando, setEditando] = useState<number | null>(null)
  // Postagem = pela data de publicação · Entregas = pela data de entrega (fila de produção)
  const [visao, setVisao] = useState<'postagem' | 'entregas'>('postagem')
  const [etiqueta, setEtiqueta] = useState('todas')
  // Adicionar conteúdo num dia qualquer (exceção ao padrão é normal) — janela própria.
  const [novoDia, setNovoDia] = useState<Date | null>(null)
  const [etiquetasAberto, setEtiquetasAberto] = useState(false)
  const [arquivadosAberto, setArquivadosAberto] = useState(false)
  // Status rápido na lista do dia: o menu com as etapas reais da esteira.
  const [menuStatus, setMenuStatus] = useState<{ id: number; el: HTMLElement } | null>(null)
  // Instagram: quem programa acompanha o que vai sair sozinho.
  const ig = useIgStatus(podeRemarcar)
  const contaDe = (c: string) => ig.conectados.find(x => x.clientName === c)
  const [confirmarRestaurar, setConfirmarRestaurar] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const clienteSel = cliente !== 'todos' ? cliente : null
  // O mês da tela (vale na visão Semana também).
  const anoRef = ref.getFullYear(), mesRef = ref.getMonth()
  const prefDoMes = clienteSel ? preferenciasDoMes(prefs, padroes, clienteSel, anoRef, mesRef) : { padrao: PADRAO_VAZIO, proprio: false }
  const padrao = prefDoMes.padrao
  const padraoBase = clienteSel ? padraoDo(padroes, clienteSel) : PADRAO_VAZIO
  const plano = clienteSel ? planos.find(p => p.name === clienteSel) : undefined
  // Meta: a exceção deste mês (se alguém fixou) e, no resto, a meta permanente do cliente.
  const meta = metaEfetiva(clienteSel ? excecaoDeMeta(prefs, clienteSel, anoRef, mesRef) : undefined, padraoBase, plano)
  const segundo = segundoTipo(padraoBase)
  const outro: TipoPadrao = segundo === 'Post' ? 'Feed' : 'Post'
  const freelancer = clienteSel ? naCarteira(carteira, clienteSel).tipo === 'freelancer' : false
  // Carteira mensal: só quem está ativo no mês aparece na escolha de cliente.
  const clientesDoMes = useMemo(() => clients.filter(c => ativoNoMes(carteira, c, anoRef, mesRef)), [clients, carteira, anoRef, mesRef])
  const etiquetasBase = useMemo(() => etiquetasConhecidas(baseEtiquetas, items.flatMap(it => states[it.i]?.tags ?? [])), [baseEtiquetas, items, states])
  const usoEtiquetas = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of items) for (const t of states[it.i]?.tags ?? []) m.set(t.toLowerCase(), (m.get(t.toLowerCase()) ?? 0) + 1)
    return m
  }, [items, states])
  const comEtiqueta = (nome: string) => items.filter(it => (states[it.i]?.tags ?? []).some(t => t.toLowerCase() === nome.toLowerCase()))
  const editarEtiquetaGlobal = (de: string, para: Etiqueta) => {
    const nova = editarEtiqueta(baseEtiquetas, de, para)
    if (nova === baseEtiquetas) return
    setBaseEtiquetas(nova); salvarEtiquetas(nova)
    if (para.nome !== de) {
      for (const it of comEtiqueta(de)) onEditarConteudo(it.i, { etiquetas: renomearNoCard(states[it.i]?.tags ?? [], de, para.nome) })
      if (etiqueta.toLowerCase() === de.toLowerCase()) setEtiqueta(para.nome)
    }
  }
  const excluirEtiquetaGlobal = (nome: string) => {
    const nova = removerEtiqueta(baseEtiquetas, nome)
    setBaseEtiquetas(nova); salvarEtiquetas(nova)
    for (const it of comEtiqueta(nome)) onEditarConteudo(it.i, { etiquetas: (states[it.i]?.tags ?? []).filter(t => t.toLowerCase() !== nome.toLowerCase()) })
    if (etiqueta.toLowerCase() === nome.toLowerCase()) setEtiqueta('todas')
  }
  /** Etiqueta digitada no conteúdo e ainda fora da base entra nela (cor neutra). */
  const registrarEtiquetas = (nomes: string[]) => {
    let nova = baseEtiquetas
    for (const n of nomes) nova = adicionarEtiqueta(nova, n)
    if (nova !== baseEtiquetas) { setBaseEtiquetas(nova); salvarEtiquetas(nova) }
  }
  // Arquivar segue a regra de antes do "excluir": sócio tudo, Social só o que está em "A fazer".
  const podeArquivar = (it: ContentItem) => podeRemarcar && (podeExcluirTudo || (states[it.i]?.status ?? it.s) === 0)
  const arquivar = (it: ContentItem) => {
    if (!window.confirm(`Arquivar "${states[it.i]?.title || it.n}" (${it.c})? Sai do Calendário e da Produção, mas fica em Arquivados e pode ser restaurado.`)) return
    onArquivar(it.i); setEditando(null)
    setAviso('Conteúdo arquivado — está em "Arquivados", dá para restaurar.')
  }
  const excluirDeVez = onExcluirDefinitivo ? (it: ContentItem) => {
    if (!window.confirm(`Excluir DEFINITIVAMENTE "${states[it.i]?.title || it.n}" (${it.c})? Não dá para desfazer. Para guardar, use Arquivar.`)) return
    onExcluirDefinitivo(it.i); setEditando(null)
    setAviso('Conteúdo excluído definitivamente.')
  } : undefined

  const filtrados = useMemo(() => {
    const permitidos = ETAPAS.find(e => e.key === etapa)!.status
    const q = busca.trim().toLowerCase()
    return items.filter(it => {
      const st = states[it.i]
      const s = st?.status ?? it.s
      if (cliente !== 'todos' && it.c !== cliente) return false
      if (tipo !== 'todos' && tipoDoPadrao(it.tp) !== tipo) return false
      if (permitidos.length && !permitidos.includes(s)) return false
      if (q && !`${it.c} ${st?.title || ''} ${it.n}`.toLowerCase().includes(q)) return false
      if (etiqueta !== 'todas' && !(st?.tags ?? []).some(t => t.toLowerCase() === etiqueta.toLowerCase())) return false
      return true
    })
  }, [items, states, cliente, tipo, etapa, busca, etiqueta])

  const porDia = useMemo(() => {
    const m = new Map<string, ContentItem[]>()
    for (const it of filtrados) {
      const st = states[it.i]
      // Entregas: só o que tem data de entrega (a fila de produção).
      if (visao === 'entregas' && !st?.deliveryDate) continue
      const k = chaveDia(visao === 'entregas' ? new Date(st!.deliveryDate!) : dataDePostagem(it, st))
      const lista = m.get(k)
      if (lista) lista.push(it); else m.set(k, [it])
    }
    for (const lista of m.values()) lista.sort((a, b) => dataDePostagem(a, states[a.i]).getTime() - dataDePostagem(b, states[b.i]).getTime())
    return m
  }, [filtrados, states, visao])
  // Carga da fila por dia (todos os clientes) — para comparar com a capacidade.
  const carga = useMemo(() => cargaPorDia(items, states), [items, states])

  // Dias da grade: mês inteiro (semanas completas, domingo a sábado) ou uma semana.
  const dias = useMemo(() => {
    const inicio = modo === 'mes'
      ? new Date(ref.getFullYear(), ref.getMonth(), 1 - new Date(ref.getFullYear(), ref.getMonth(), 1).getDay())
      : new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - ref.getDay())
    const total = modo === 'mes'
      ? Math.ceil((new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate() + new Date(ref.getFullYear(), ref.getMonth(), 1).getDay()) / 7) * 7
      : 7
    return Array.from({ length: total }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i))
  }, [ref, modo])

  const resumo = useMemo(() => {
    const doPeriodo = dias.flatMap(d => (modo === 'semana' || d.getMonth() === ref.getMonth()) ? porDia.get(chaveDia(d)) ?? [] : [])
    const n = (fn: (it: ContentItem, s: Status) => boolean) => doPeriodo.filter(it => fn(it, states[it.i]?.status ?? it.s)).length
    return {
      total: doPeriodo.length,
      reels: n(it => it.tp === 'Reel' || it.tp === 'Story'),
      posts: n(it => it.tp === 'Post' || it.tp === 'Carrossel'),
      feed: n(it => it.tp === 'Feed'),
      programados: n((_, s) => s === 9),
      publicados: n((_, s) => s === 7),
      atrasados: doPeriodo.filter(it => isRealLate(it, states[it.i], now)).length,
    }
  }, [dias, porDia, states, now, modo, ref])


  const andar = (dir: -1 | 1) => setRef(r => modo === 'mes'
    ? new Date(r.getFullYear(), r.getMonth() + dir, 1)
    : new Date(r.getFullYear(), r.getMonth(), r.getDate() + dir * 7))
  const irHoje = () => setRef(modo === 'mes' ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now))
  const trocarModo = (m: 'mes' | 'semana') => {
    setModo(m)
    setRef(m === 'mes' ? new Date(ref.getFullYear(), ref.getMonth(), 1)
      : (ref.getMonth() === now.getMonth() && ref.getFullYear() === now.getFullYear() ? new Date(now) : new Date(ref)))
  }

  const titulo = modo === 'mes'
    ? `${MESES[ref.getMonth()]} de ${ref.getFullYear()}`
    : `${dias[0].getDate()}/${dias[0].getMonth() + 1} – ${dias[6].getDate()}/${dias[6].getMonth() + 1} de ${dias[6].getFullYear()}`

  const soltar = (dia: Date) => {
    if (arrastandoVaga) {
      const v = arrastandoVaga
      setArrastandoVaga(null); setAlvo(null)
      // Preferência vale só no mês dela: soltar fora do mês não faz nada.
      if (dia.getFullYear() !== anoRef || dia.getMonth() !== mesRef || dia.getDate() === v.dia) return
      salvarVagas(moverVaga(vagas, v, dia.getDate()))
      setAviso(`Preferência de ${ROTULO_TIPO[v.tipo]} movida do dia ${v.dia} para o dia ${dia.getDate()} — vale só para ${nomeMes}.`)
      return
    }
    if (arrastando === null) return
    const it = items.find(x => x.i === arrastando)
    setArrastando(null); setAlvo(null)
    if (!it || mesmoDia(new Date(it.dt), dia)) return
    const antiga = new Date(it.dt)
    onReschedule(it.i, new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), antiga.getHours() || 12, antiga.getMinutes()))
  }

  const conteudosDoDia = diaAberto ? porDia.get(chaveDia(diaAberto)) ?? [] : []
  const editandoItem = editando !== null ? items.find(i => i.i === editando) ?? null : null
  // Fila de aprovação: respeita os filtros de cliente e tipo da tela.
  const fila = useMemo(() => podeRemarcar
    ? aguardandoSocial(items.filter(it => (cliente === 'todos' || it.c === cliente) && (tipo === 'todos' || tipoDoPadrao(it.tp) === tipo)), states)
    : [], [podeRemarcar, items, states, cliente, tipo])

  // ── Padrão Editorial: o mês de referência é o da tela (vale na visão Semana também).
  const nomeMes = `${MESES[mesRef].toLowerCase()} de ${anoRef}`
  const itensDoMes = clienteSel ? doClienteNoMes(items, clienteSel, anoRef, mesRef) : []
  const faltam = TIPOS_PADRAO.map(t => ({ t, n: Math.max(0, meta[t] - itensDoMes.filter(i => tipoDoPadrao(i.tp) === t).length) }))

  // ── Vagas do mês (preferências por DATA). Ocupada por um conteúdo do mesmo tipo
  // no mesmo dia, a vaga continua salva mas some da tela — quem aparece é o conteúdo.
  const comVagasNoMes = !!clienteSel && !freelancer
  const vagas = useMemo(() => comVagasNoMes ? vagasDoMes(prefs, padroes, clienteSel!, anoRef, mesRef) : [],
    [comVagasNoMes, prefs, padroes, clienteSel, anoRef, mesRef])
  const vagasManuais = comVagasNoMes && !!prefs[clienteSel!]?.[chaveMes(anoRef, mesRef)]?.vagas
  const livres = useMemo(() => {
    if (!comVagasNoMes) return []
    const ocupantes = items.filter(i => i.c === clienteSel).flatMap(i => {
      const d = dataDePostagem(i, states[i.i])
      return d.getFullYear() === anoRef && d.getMonth() === mesRef ? [{ dia: d.getDate(), tipo: tipoDoPadrao(i.tp) }] : []
    })
    return vagasLivres(vagas, ocupantes)
  }, [comVagasNoMes, items, states, clienteSel, vagas, anoRef, mesRef])
  const livresDoDia = (dia: Date) => dia.getFullYear() === anoRef && dia.getMonth() === mesRef
    ? livres.filter(v => v.dia === dia.getDate() && (tipo === 'todos' || tipo === v.tipo))
    : []
  const salvarVagas = (nova: Vaga[]) => {
    if (!clienteSel) return
    const store = comVagas(prefs, padroes, clienteSel, anoRef, mesRef, nova)
    setPrefs(store); salvarPrefMes(store)
  }

  // Indicadores do cliente no mês: feitos × meta, programados, restantes e progresso.
  const progresso = useMemo(() => {
    const doTipo = (t: (typeof TIPOS_PADRAO)[number]) => itensDoMes.filter(i => tipoDoPadrao(i.tp) === t).length
    const feitos = { Reel: doTipo('Reel'), Post: doTipo('Post'), Feed: doTipo('Feed') }
    const metaTotal = meta.Reel + meta.Post + meta.Feed
    const total = Math.min(feitos.Reel, meta.Reel || feitos.Reel) + Math.min(feitos.Post, meta.Post || feitos.Post) + Math.min(feitos.Feed, meta.Feed || feitos.Feed)
    return {
      feitos,
      programados: itensDoMes.filter(i => (states[i.i]?.status ?? i.s) === 9).length,
      restantes: faltam.reduce((a, f) => a + f.n, 0),
      pct: metaTotal > 0 ? Math.min(100, Math.round((total / metaTotal) * 100)) : null,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itensDoMes.length, states, meta.Reel, meta.Post, meta.Feed, clienteSel, anoRef, mesRef])

  // "Criar o mês": a primeira distribuição copia o padrão para as preferências do mês.
  const fixarMes = () => {
    if (!clienteSel) return
    const novo = garantirMes(prefs, padroes, clienteSel, anoRef, mesRef)
    if (novo !== prefs) { setPrefs(novo); salvarPrefMes(novo) }
  }
  const distribuirLista = (lista: { tipo: (typeof TIPOS_PADRAO)[number]; data: Date; titulo: string }[]) => {
    if (!clienteSel) return
    fixarMes()
    onAdicionarVarios(lista.map(x => ({ cliente: clienteSel, tipo: TIPO_DO_CARD[x.tipo], titulo: x.titulo, data: x.data, status: 0 as Status })))
    setDistribuirAberto(false)
    setAviso(`${lista.length} conteúdo${lista.length !== 1 ? 's' : ''} distribuído${lista.length !== 1 ? 's' : ''} em ${nomeMes} para ${clienteSel}. As entregas entraram na fila pela data de publicação.`)
  }
  // Restaurar: o padrão ATUAL substitui as preferências do mês (inclusive as vagas
  // postas, movidas ou tiradas à mão). Só preferência — nenhum conteúdo é apagado nem movido.
  const vagasDoPadrao = clienteSel && confirmarRestaurar ? gerarVagas(padraoBase, anoRef, mesRef).length : 0
  const restaurar = () => {
    if (!clienteSel) return
    const novo = restaurarMes(prefs, padroes, clienteSel, anoRef, mesRef)
    setPrefs(novo); salvarPrefMes(novo)
    setConfirmarRestaurar(false)
    setAviso(`Preferências de ${nomeMes} de ${clienteSel} recriadas pelo padrão: ${vagasDoPadrao} vaga${vagasDoPadrao !== 1 ? 's' : ''}. Nenhum conteúdo foi mexido.`)
  }
  const resumoDe = (pp: typeof padrao) => TIPOS_PADRAO
    .filter(t => pp.dias[t].length)
    .map(t => `${ROTULO_TIPO[t]}: ${pp.dias[t].map(d => DIA_SEMANA[d]).join(', ')}${pp.plano === '6+6' && pp.diasFraca?.[t]?.length ? ` (fraca: ${pp.diasFraca[t]!.map(d => DIA_SEMANA[d]).join(', ')})` : ''}`)
    .join(' · ')
  const resumoPadrao = resumoDe(padraoBase)
  const resumoMes = resumoDe(padrao)

  const reordenar = () => {
    const ler = (txt: string, atual: number) => Math.max(1, Math.floor(Number(txt)) || atual)
    const cap: Capacidade = { video: ler(capTxt.video, capacidade.video), design: ler(capTxt.design, capacidade.design) }
    if (cap.video !== capacidade.video || cap.design !== capacidade.design) { setCapacidade(cap); salvarCapacidade(cap) }
    const n = onReordenar('completo', cap)
    setReordenarAberto(false)
    const limite = `${cap.video} vídeos e ${cap.design} designs por dia`
    setAviso(n ? `Fila reordenada: ${n} entrega${n !== 1 ? 's mudaram' : ' mudou'} de data (até ${limite}). Nenhuma publicação foi mexida.` : `A fila já respeita ${limite} — nada mudou.`)
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3.5 }, maxWidth: { xl: 1800 }, mx: 'auto' }}>
      {/* Cabeçalho: navegação + título | Mês/Semana */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <NavBtn onClick={() => andar(-1)} label="Anterior">←</NavBtn>
        <NavBtn onClick={() => andar(1)} label="Próximo">→</NavBtn>
        <NavBtn onClick={irHoje} label="Hoje">Hoje</NavBtn>
        <Typography sx={{ ml: 1, fontSize: { xs: '1.1rem', md: '1.4rem', xl: '1.7rem' }, fontWeight: 800, letterSpacing: '-0.02em', color: DS.t1 }}>
          {titulo}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {podeRemarcar && (
          <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
            {([
              ['Padrão editorial', () => setPadraoAberto('padrao'), !clienteSel, 'Escolha um cliente no filtro'],
              ['Preferências do mês', () => setPadraoAberto('mes'), !clienteSel || freelancer, freelancer ? 'Freelancer não tem preferências mensais' : 'Escolha um cliente no filtro'],
              ['Distribuir conteúdos', () => setDistribuirAberto(true), !clienteSel || freelancer, freelancer ? 'Freelancer não recebe distribuição automática' : 'Escolha um cliente no filtro'],
              ['Restaurar padrão', () => setConfirmarRestaurar(true), !clienteSel || freelancer, freelancer ? 'Freelancer não tem padrão para restaurar' : 'Escolha um cliente no filtro'],
              ['Reordenar datas', () => { setCapTxt({ video: String(capacidade.video), design: String(capacidade.design) }); setReordenarAberto(true) }, false, ''],
              ['Etiquetas', () => setEtiquetasAberto(true), false, ''],
              [arquivados.length ? `Arquivados (${arquivados.length})` : 'Arquivados', () => setArquivadosAberto(true), false, ''],
            ] as const).map(([rotulo, acao, bloqueado, porque]) => (
              <Tooltip key={rotulo} title={bloqueado ? porque : ''}>
                <span>
                  <Button size="small" onClick={acao} disabled={bloqueado} sx={{
                    height: 36, px: 1.6, borderRadius: '9px', fontSize: '0.76rem', fontWeight: 700, textTransform: 'none',
                    border: `1px solid ${DS.border}`, bgcolor: DS.surface, color: DS.t1,
                    '&:hover': { borderColor: DS.borderHov, color: DS.accent, bgcolor: DS.surface },
                    '&.Mui-disabled': { color: DS.t4, borderColor: DS.border },
                  }}>
                    {rotulo}
                  </Button>
                </span>
              </Tooltip>
            ))}
          </Box>
        )}
        <Box sx={{ display: 'flex', p: 0.4, borderRadius: '10px', border: `1px solid ${DS.border}`, bgcolor: DS.surface }}>
          {(['postagem', 'entregas'] as const).map(v => (
            <Tooltip key={v} title={v === 'entregas' ? 'Pela data de ENTREGA da produção (fila: publicação mais próxima entrega primeiro), com a carga de cada dia' : 'Pela data de publicação'}>
              <Box {...clickable(() => setVisao(v))} aria-pressed={visao === v} sx={{
                px: 1.6, py: 0.7, borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
                bgcolor: visao === v ? `${DS.accent}1f` : 'transparent', color: visao === v ? DS.accent : DS.t2,
                transition: 'all 0.18s ease',
              }}>
                {v === 'postagem' ? 'Postagem' : 'Entregas'}
              </Box>
            </Tooltip>
          ))}
        </Box>
        <Box sx={{ display: 'flex', p: 0.4, borderRadius: '10px', border: `1px solid ${DS.border}`, bgcolor: DS.surface }}>
          {(['mes', 'semana'] as const).map(m => (
            <Box key={m} {...clickable(() => trocarModo(m))} sx={{
              px: 1.6, py: 0.7, borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
              bgcolor: modo === m ? `${DS.accent}1f` : 'transparent', color: modo === m ? DS.accent : DS.t2,
              transition: 'all 0.18s ease',
            }}>
              {m === 'mes' ? 'Mês' : 'Semana'}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Filtros | resumo do período */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.2, flexWrap: 'wrap', mb: 1.5 }}>
        <Filtro rotulo="Cliente" value={cliente} onChange={setCliente} largura={200}>
          <MenuItem value="todos" sx={{ fontSize: '0.75rem' }}>Todos os clientes</MenuItem>
          {/* Carteira do mês; o escolhido continua na lista mesmo fora dela, para não sumir da tela. */}
          {[...new Set([...clientesDoMes, ...(clienteSel ? [clienteSel] : [])])].sort((a, b) => a.localeCompare(b)).map(c => (
            <MenuItem key={c} value={c} sx={{ fontSize: '0.75rem' }}>
              {c}{naCarteira(carteira, c).tipo === 'freelancer' ? ' · freelancer' : ''}{!clientesDoMes.includes(c) ? ' · fora da carteira' : ''}
            </MenuItem>
          ))}
        </Filtro>
        <Filtro rotulo="Tipo" value={tipo} onChange={v => setTipo(v as 'todos' | TipoPadrao)} largura={140}>
          <MenuItem value="todos" sx={{ fontSize: '0.75rem' }}>Todos</MenuItem>
          {TIPOS_PADRAO.map(t => (
            <MenuItem key={t} value={t} sx={{ fontSize: '0.75rem', gap: 0.8 }}>
              <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: COR_TIPO[t], display: 'inline-block' }} />
              {ROTULO_TIPO[t]}
            </MenuItem>
          ))}
        </Filtro>
        <Filtro rotulo="Status" value={etapa} onChange={v => setEtapa(v as Etapa)} largura={170}>
          {ETAPAS.map(e => <MenuItem key={e.key} value={e.key} sx={{ fontSize: '0.75rem' }}>{e.label}</MenuItem>)}
        </Filtro>
        {etiquetasBase.length > 0 && (
          <Filtro rotulo="Etiqueta" value={etiqueta} onChange={setEtiqueta} largura={150}>
            <MenuItem value="todas" sx={{ fontSize: '0.75rem' }}>Todas</MenuItem>
            {etiquetasBase.map(e => (
              <MenuItem key={e.nome} value={e.nome} sx={{ fontSize: '0.75rem', gap: 0.8 }}>
                <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: e.cor, display: 'inline-block' }} />{e.nome}
              </MenuItem>
            ))}
          </Filtro>
        )}
        <Box>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: DS.t2, mb: 0.5 }}>Buscar</Typography>
          <TextField size="small" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Título ou cliente…"
            sx={{ width: { xs: 160, md: 200 }, ...CAMPO_SX }} />
        </Box>
        {(cliente !== 'todos' || tipo !== 'todos' || etapa !== 'todas' || busca || etiqueta !== 'todas') && (
          <Button size="small" onClick={() => { setCliente('todos'); setTipo('todos'); setEtapa('todas'); setBusca(''); setEtiqueta('todas') }}
            sx={{ fontSize: '0.7rem', color: DS.t2, height: 34, '&:hover': { color: DS.t1, bgcolor: 'transparent' } }}>
            Limpar
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {clienteSel && !freelancer ? (
          <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Contador n={`${progresso.feitos.Reel}/${meta.Reel}`} rotulo="reels" ponto={COR_TIPO.Reel} />
            <Contador n={`${progresso.feitos[segundo]}/${meta[segundo]}`} rotulo={ROTULO_TIPO[segundo].toLowerCase()} ponto={COR_TIPO[segundo]} />
            {(meta[outro] > 0 || progresso.feitos[outro] > 0) && <Contador n={`${progresso.feitos[outro]}/${meta[outro]}`} rotulo={ROTULO_TIPO[outro].toLowerCase()} ponto={COR_TIPO[outro]} />}
            <Contador n={progresso.programados} rotulo="programados" />
            <Contador n={progresso.restantes} rotulo="faltantes" cor={progresso.restantes > 0 ? DS.amber : DS.green} />
            {progresso.pct !== null && (
              <Tooltip title={`${progresso.pct}% da meta de ${MESES[mesRef].toLowerCase()} já no calendário`}>
                <Box sx={{ width: 110, height: 34, px: 1.1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.4, borderRadius: '9px', border: `1px solid ${DS.border}`, bgcolor: DS.surface }}>
                  <Typography sx={{ fontSize: '0.62rem', color: DS.t2, lineHeight: 1 }}>meta <b style={{ color: DS.t1 }}>{progresso.pct}%</b></Typography>
                  <Box sx={{ height: 4, borderRadius: 2, bgcolor: DS.field, overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${progresso.pct}%`, bgcolor: progresso.pct >= 100 ? DS.green : DS.accent, transition: 'width 0.4s ease' }} />
                  </Box>
                </Box>
              </Tooltip>
            )}
          </Box>
        ) : (
        <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
          <Contador n={resumo.total} rotulo="no período" />
          <Contador n={resumo.reels} rotulo="reels" ponto={COR_TIPO.Reel} />
          <Contador n={resumo.posts} rotulo="design" ponto={COR_TIPO.Post} />
          {resumo.feed > 0 && <Contador n={resumo.feed} rotulo="feed" ponto={COR_TIPO.Feed} />}
          <Contador n={resumo.programados} rotulo="programados" />
          <Contador n={resumo.publicados} rotulo="publicados" />
          {resumo.atrasados > 0 && <Contador n={resumo.atrasados} rotulo="atrasados" cor={DS.red} />}
        </Box>
        )}
      </Box>

      {/* Legenda */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }}>
        {podeRemarcar && (
          <Typography sx={{ fontSize: '0.68rem', color: DS.t3 }}>
            Arraste para remarcar · + no dia para adicionar conteúdo{comVagasNoMes ? ' · clique no dia para pôr preferência · arraste a preferência para outro dia' : ''}
          </Typography>
        )}
      </Box>

      {/* Padrão Editorial do cliente escolhido: a base do mês (não é trava). */}
      {clienteSel && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap', mb: 1.5, px: 1.4, py: 1,
          borderRadius: '11px', border: `1px solid ${DS.border}`, bgcolor: DS.surface,
        }}>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: DS.t3 }}>
            {freelancer ? 'Freelancer' : prefDoMes.proprio ? `Preferências de ${MESES[mesRef].toLowerCase()}` : 'Padrão editorial'}
          </Typography>
          <Typography sx={{ fontSize: '0.74rem', color: resumoMes ? DS.t1 : DS.t3 }}>
            {freelancer
              ? 'demanda avulsa — sem padrão, meta ou distribuição automática'
              : (resumoMes || 'sem dias definidos — a distribuição usa segunda a sexta')
                + (padrao.plano && padrao.plano !== 'livre' ? ` · plano ${padrao.plano}` : '')}
          </Typography>
          {!freelancer && ((prefDoMes.proprio && resumoMes !== resumoPadrao) || vagasManuais) && (
            <Typography sx={{ fontSize: '0.66rem', color: DS.t3 }}>({vagasManuais ? 'preferências ajustadas à mão neste mês' : 'diferente do padrão'} — "Restaurar padrão" volta)</Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: '0.72rem', color: DS.t2 }}>
            Meta de {MESES[mesRef].toLowerCase()}: {TIPOS_PADRAO.filter(t => meta[t] > 0).map(t => `${meta[t]} ${ROTULO_TIPO[t]}`).join(' + ') || 'nenhuma'}
            {faltam.some(f => f.n > 0) && (
              <Box component="span" sx={{ color: DS.amber, fontWeight: 700, ml: 0.8 }}>
                · faltam {faltam.filter(f => f.n > 0).map(f => `${f.n} ${ROTULO_TIPO[f.t]}`).join(', ')}
              </Box>
            )}
          </Typography>
        </Box>
      )}

      {/* A fila mora na aba "Aprovar e programar"; aqui só o aviso de que há o que programar. */}
      {fila.length > 0 && (
        <Box {...clickable(onAbrirFila)} sx={{
          display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 1.6, py: 1, cursor: 'pointer',
          borderRadius: '11px', border: `1px solid ${DS.border}`, bgcolor: DS.surface,
          transition: 'border-color 0.18s ease', '&:hover': { borderColor: DS.borderHov },
        }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: DS.accent }}>{fila.length}</Typography>
          <Typography sx={{ fontSize: '0.78rem', color: DS.t1 }}>
            aprovado{fila.length !== 1 ? 's' : ''} pelo cliente aguardando você programar
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: DS.accent }}>Agendamento →</Typography>
        </Box>
      )}

      {/* Grade */}
      <Box sx={{ border: `1px solid ${DS.border}`, borderRadius: '14px', overflow: 'hidden', bgcolor: DS.surface }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', bgcolor: DS.surfaceAlt, borderBottom: `1px solid ${DS.border}` }}>
          {DIAS.map((d, i) => (
            <Typography key={i} sx={{ textAlign: 'center', py: 1, fontSize: '0.68rem', fontWeight: 700, color: DS.t2 }}>{d}</Typography>
          ))}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {dias.map((dia, idx) => {
            const k = chaveDia(dia)
            const lista = porDia.get(k) ?? []
            const fora = modo === 'mes' && dia.getMonth() !== ref.getMonth()
            const hoje = mesmoDia(dia, now)
            const sobre = alvo === k
            return (
              <Box
                key={k}
                {...clickable(() => setDiaAberto(dia))}
                aria-label={`${dia.getDate()}/${dia.getMonth() + 1}: ${lista.length} conteúdo${lista.length !== 1 ? 's' : ''}`}
                onDragOver={podeRemarcar && visao === 'postagem' ? e => { e.preventDefault(); if (alvo !== k) setAlvo(k) } : undefined}
                onDragLeave={podeRemarcar && visao === 'postagem' ? () => setAlvo(a => (a === k ? null : a)) : undefined}
                onDrop={podeRemarcar && visao === 'postagem' ? e => { e.preventDefault(); soltar(dia) } : undefined}
                sx={{
                  minHeight: modo === 'mes' ? { xs: 84, md: 120, xl: 150 } : { xs: 220, md: 420 },
                  p: { xs: 0.5, md: 0.9 }, cursor: 'pointer', position: 'relative',
                  borderRight: (idx % 7) !== 6 ? `1px solid ${DS.border}` : 'none',
                  borderBottom: idx < dias.length - 7 ? `1px solid ${DS.border}` : 'none',
                  bgcolor: sobre ? `${DS.accent}14` : 'transparent',
                  outline: hoje ? `1.5px solid ${DS.accent}` : 'none', outlineOffset: -1.5,
                  opacity: fora ? 0.45 : 1,
                  transition: 'background-color 0.18s ease',
                  '&:hover': { bgcolor: sobre ? `${DS.accent}14` : 'rgba(146,152,165,0.04)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.7 }}>
                  <Box sx={{
                    minWidth: 24, height: 24, px: 0.5, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: hoje ? DS.accent : 'transparent',
                  }}>
                    <Typography sx={{ fontSize: { xs: '0.7rem', md: '0.8rem' }, fontWeight: 800, color: hoje ? DS.onAccent : DS.t1 }}>
                      {dia.getDate()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, ml: 'auto' }}>
                    {visao === 'entregas' ? (() => {
                      const c = carga.get(k)
                      if (!c || (!c.video && !c.design)) return null
                      return (
                        <Tooltip title={`Entregas da produção neste dia (todos os clientes): ${c.video} vídeo${c.video !== 1 ? 's' : ''} de ${capacidade.video} · ${c.design} design${c.design !== 1 ? 's' : ''} de ${capacidade.design}`}>
                          <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: DS.t2, whiteSpace: 'nowrap' }}>
                            <Box component="span" sx={{ color: c.video > capacidade.video ? DS.red : DS.t2 }}>V {c.video}/{capacidade.video}</Box>
                            {' · '}
                            <Box component="span" sx={{ color: c.design > capacidade.design ? DS.red : DS.t2 }}>D {c.design}/{capacidade.design}</Box>
                          </Typography>
                        </Tooltip>
                      )
                    })() : lista.length > 0 && (
                      <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: DS.t3 }}>{lista.length}</Typography>
                    )}
                    {podeRemarcar && (
                      <Tooltip title="Adicionar conteúdo neste dia">
                        <IconButton size="small" aria-label={`Adicionar conteúdo em ${dia.getDate()}/${dia.getMonth() + 1}`}
                          onClick={e => { e.stopPropagation(); setNovoDia(dia) }}
                          sx={{ p: 0.2, color: DS.t4, '&:hover': { color: DS.accent } }}>
                          <AddIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                  {(modo === 'mes' ? lista.slice(0, POR_CELULA) : lista).map(it => (
                    <MiniConteudo key={it.i} item={it} st={states[it.i]} arrastavel={podeRemarcar && visao === 'postagem'} ig={ig.porItem[it.i]} etiquetasBase={etiquetasBase}
                      onAbrir={podeRemarcar ? () => setEditando(it.i) : undefined}
                      onDragStart={() => setArrastando(it.i)} onDragEnd={() => { setArrastando(null); setAlvo(null) }} />
                  ))}
                  {modo === 'mes' && lista.length > POR_CELULA && (
                    <Typography sx={{ fontSize: '0.66rem', fontWeight: 800, color: DS.accent, pl: 0.5, '&:hover': { textDecoration: 'underline' } }}>
                      +{lista.length - POR_CELULA} conteúdo{lista.length - POR_CELULA !== 1 ? 's' : ''}
                    </Typography>
                  )}
                  {/* Vagas livres: preferência é planejamento — some quando um conteúdo do tipo ocupa o dia. */}
                  {visao === 'postagem' && !fora && livresDoDia(dia).length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                      {livresDoDia(dia).map((v, j) => (
                        <VagaChip key={`${v.tipo}-${j}`} vaga={v} arrastavel={podeRemarcar}
                          onDragStart={() => setArrastandoVaga(v)} onDragEnd={() => { setArrastandoVaga(null); setAlvo(null) }} />
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* Dia aberto: todos os conteúdos */}
      <Dialog open={!!diaAberto} onClose={() => setDiaAberto(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: DS.t1 }}>
              {diaAberto?.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: DS.t2 }}>
              {conteudosDoDia.length} conteúdo{conteudosDoDia.length !== 1 ? 's' : ''} {visao === 'entregas' ? 'para entregar' : 'para postar'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setDiaAberto(null)} aria-label="Fechar"><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
          {/* Preferências deste dia (vagas): pôr, tirar. A data é o próprio dia clicado. */}
          {podeRemarcar && comVagasNoMes && diaAberto && diaAberto.getFullYear() === anoRef && diaAberto.getMonth() === mesRef && visao === 'postagem' && (() => {
            const doDia = vagas.filter(v => v.dia === diaAberto.getDate())
            const livresAqui = livres.filter(v => v.dia === diaAberto.getDate())
            const ocupadas = doDia.length - livresAqui.length
            return (
              <Box sx={{ p: 1.2, borderRadius: '11px', border: `1px solid ${DS.border}`, bgcolor: DS.surfaceAlt, display: 'flex', flexDirection: 'column', gap: 0.9 }}>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', color: DS.t3 }}>
                  PREFERÊNCIAS DESTE DIA · {clienteSel}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {livresAqui.length === 0 && <Typography sx={{ fontSize: '0.74rem', color: DS.t3 }}>{ocupadas ? 'Todas ocupadas por conteúdo.' : 'Nenhuma.'}</Typography>}
                  {livresAqui.map((v, j) => (
                    <Box key={`${v.tipo}-${j}`} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, pl: 1, pr: 0.4, height: 28, borderRadius: '8px', border: `1px dashed ${COR_TIPO[v.tipo]}`, color: DS.t1 }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: COR_TIPO[v.tipo] }} />
                      <Typography sx={{ fontSize: '0.74rem', fontWeight: 700 }}>{ROTULO_TIPO[v.tipo]}</Typography>
                      <IconButton size="small" aria-label={`Tirar preferência de ${ROTULO_TIPO[v.tipo]}`}
                        onClick={() => salvarVagas(removerVaga(vagas, v))} sx={{ p: 0.2, color: DS.t3, '&:hover': { color: DS.red } }}>
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ))}
                  {ocupadas > 0 && livresAqui.length > 0 && <Typography sx={{ fontSize: '0.68rem', color: DS.t3 }}>+{ocupadas} ocupada{ocupadas !== 1 ? 's' : ''} por conteúdo</Typography>}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.7rem', color: DS.t2 }}>Adicionar preferência:</Typography>
                  {TIPOS_PADRAO.map(t => (
                    <Button key={t} size="small" startIcon={<AddIcon sx={{ fontSize: '14px !important' }} />}
                      onClick={() => {
                        salvarVagas([...vagas, { dia: diaAberto.getDate(), tipo: t }])
                        setAviso(`Preferência de ${ROTULO_TIPO[t]} no dia ${diaAberto.getDate()} — vale só para ${nomeMes}.`)
                      }}
                      sx={{ height: 28, px: 1, fontSize: '0.72rem', fontWeight: 800, textTransform: 'none', color: DS.t1, border: `1px solid ${COR_TIPO[t]}66`, borderRadius: '8px', '&:hover': { bgcolor: `${COR_TIPO[t]}14`, borderColor: COR_TIPO[t] } }}>
                      {ROTULO_TIPO[t]}
                    </Button>
                  ))}
                </Box>
              </Box>
            )
          })()}
          {/* Adicionar — abre a janela própria de novo conteúdo (o dia vem preenchido). */}
          {podeRemarcar && diaAberto && (
            <Button size="small" startIcon={<AddIcon sx={{ fontSize: '16px !important' }} />} onClick={() => setNovoDia(diaAberto)}
              sx={{ alignSelf: 'flex-start', fontSize: '0.74rem', fontWeight: 700, color: DS.accent, px: 0.5 }}>
              Adicionar conteúdo neste dia
            </Button>
          )}
          {conteudosDoDia.length === 0 && (
            <Typography sx={{ fontSize: '0.8rem', color: DS.t3, py: 3, textAlign: 'center' }}>Nada marcado para este dia.</Typography>
          )}
          {conteudosDoDia.map(it => {
            return (
              <DetalheConteudo key={it.i} item={it} st={states[it.i]} podeRemarcar={podeRemarcar}
                onEditar={podeRemarcar ? () => setEditando(it.i) : undefined}
                ig={ig.porItem[it.i]} conta={contaDe(it.c)}
                onProgramar={() => onProgramar(it.i)}
                onMudarHora={h => onMudarHora(it.i, h)}
                onReprogramar={() => { setDiaAberto(null); onReprogramar(it.i) }}
                onReschedule={d => onReschedule(it.i, d)}
                onMudarTipo={tp => onMudarTipo(it.i, tp)}
                responsavel={responsavelDe(it.i)}
                etiquetasBase={etiquetasBase}
                onStatus={podeRemarcar ? el => setMenuStatus({ id: it.i, el }) : undefined}
                onArquivar={podeArquivar(it) ? () => arquivar(it) : undefined}
                onExcluir={excluirDeVez ? () => excluirDeVez(it) : undefined} />
            )
          })}
          {conteudosDoDia.length > 0 && (
            <Button size="small" onClick={() => { setDiaAberto(null); onAbrirProducao() }}
              sx={{ alignSelf: 'flex-start', fontSize: '0.72rem', color: DS.accent, px: 0 }}>
              Abrir Produções →
            </Button>
          )}
        </DialogContent>
      </Dialog>


      {clienteSel && (
        <PadraoDialog
          open={padraoAberto !== null}
          modo={padraoAberto ?? 'padrao'}
          cliente={clienteSel}
          nomeMes={nomeMes}
          inicial={padraoAberto === 'mes' ? padrao : padraoBase}
          plano={plano}
          carteira={naCarteira(carteira, clienteSel)}
          segundoCliente={segundo}
          metaInicial={padraoAberto === 'mes' ? excecaoDeMeta(prefs, clienteSel, anoRef, mesRef) : padraoBase.meta}
          metaHerdada={padraoAberto === 'mes' ? metaEfetiva(undefined, padraoBase, plano) : undefined}
          onClose={() => setPadraoAberto(null)}
          onSalvar={(novo, cart) => {
            if (padraoAberto === 'mes') {
              const store = comPreferencias(prefs, clienteSel, anoRef, mesRef, novo)
              setPrefs(store); salvarPrefMes(store)
              setAviso(`Preferências de ${nomeMes} salvas para ${clienteSel}. O padrão editorial continua como estava.`)
            } else {
              const store = { ...padroes, [clienteSel]: novo }
              setPadroes(store); salvarPadroes(store)
              if (cart) { const c = { ...carteira, [clienteSel]: cart }; setCarteira(c); salvarCarteira(c) }
              setAviso(`Padrão editorial de ${clienteSel} salvo. Vale para os meses que ainda não foram criados — os já criados mudam só com "Restaurar padrão".`)
            }
            setPadraoAberto(null)
          }}
        />
      )}

      {clienteSel && (
        <DistribuirDialog
          open={distribuirAberto}
          cliente={clienteSel}
          nomeMes={nomeMes}
          ano={anoRef} mes={mesRef}
          livres={livres}
          meta={meta}
          existentes={itensDoMes}
          segundo={segundo}
          hoje={now}
          onClose={() => setDistribuirAberto(false)}
          onConfirmar={distribuirLista}
        />
      )}

      <Dialog open={reordenarAberto} onClose={() => setReordenarAberto(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1rem' }}>Reordenar datas de entrega</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.82rem', color: DS.t2, lineHeight: 1.6, mb: 1.6 }}>
            Mexe só nas datas de <strong style={{ color: DS.t1 }}>entrega</strong> — a publicação nunca muda. A publicação mais
            próxima entrega primeiro: a fila começa hoje e enche cada dia útil até a capacidade da frente. Só entra o que
            ainda está em produção (A fazer, Produção, Ajuste); o que já foi entregue, aprovado, programado ou publicado não é mexido.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.2 }}>
            {(['video', 'design'] as const).map(f => (
              <TextField key={f} size="small" type="number" label={`${ROTULO_FRENTE[f]} por dia`} value={capTxt[f]}
                onChange={e => setCapTxt(c => ({ ...c, [f]: e.target.value }))} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 1 } }} sx={{ flex: 1 }} />
            ))}
          </Box>
          <Typography sx={{ fontSize: '0.72rem', color: DS.t3, mt: 1.2, lineHeight: 1.5 }}>
            Conteúdo novo ou publicação mudada já entra na fila sozinho, empurrando só o necessário. Programar um conteúdo não puxa outro para o lugar dele.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReordenarAberto(false)} sx={{ color: DS.t2 }}>Cancelar</Button>
          <Button variant="contained" onClick={reordenar}>Reordenar</Button>
        </DialogActions>
      </Dialog>

      <EditarConteudoPainel
        item={editando !== null ? items.find(i => i.i === editando) ?? null : null}
        st={editando !== null ? states[editando] : undefined}
        clientes={clientesDoMes}
        podeTrocarCliente={editando !== null && idsCriadosAMao.has(editando)}
        etiquetasBase={etiquetasBase}
        responsavelAtual={editando !== null ? responsavelDe(editando) : undefined}
        onClose={() => setEditando(null)}
        onSalvar={(id, e) => {
          if (e.etiquetas) registrarEtiquetas(e.etiquetas)
          onEditarConteudo(id, e)
          if (Object.keys(e).length) setAviso('Conteúdo atualizado — vale para o Calendário e para a Produção.')
        }}
        onArquivar={editandoItem && podeArquivar(editandoItem) ? () => arquivar(editandoItem) : undefined}
        onExcluir={editandoItem && excluirDeVez ? () => excluirDeVez(editandoItem) : undefined}
      />

      <NovoConteudoDialog
        open={!!novoDia} dia={novoDia}
        clientes={clientesDoMes}
        clientePadrao={clienteSel}
        tipoPadrao={tipo !== 'todos' ? TIPO_DO_CARD[tipo] : undefined}
        onClose={() => setNovoDia(null)}
        onCriar={n => {
          onAdicionar(n)
          setNovoDia(null)
          setAviso(`${rotuloDoTipo(n.tipo)} criado em ${n.data.getDate()}/${n.data.getMonth() + 1} para ${n.cliente}.`)
        }}
      />

      <EtiquetasDialog open={etiquetasAberto} base={etiquetasBase} uso={usoEtiquetas}
        onClose={() => setEtiquetasAberto(false)}
        onCriar={e => { const nova = adicionarEtiqueta(baseEtiquetas, e.nome, e.cor); setBaseEtiquetas(nova); salvarEtiquetas(nova) }}
        onEditar={editarEtiquetaGlobal}
        onExcluir={excluirEtiquetaGlobal} />

      <ArquivadosDialog open={arquivadosAberto} itens={arquivados} states={states}
        onClose={() => setArquivadosAberto(false)}
        onRestaurar={id => { onRestaurar(id); setAviso('Conteúdo restaurado — voltou para o Calendário e a Produção.') }}
        onExcluirDefinitivo={onExcluirDefinitivo} />

      {/* Status rápido: as etapas reais da esteira (passa pela mesma regra de quem move o quê). */}
      <Menu open={!!menuStatus && !!diaAberto && conteudosDoDia.some(i => i.i === menuStatus.id)} anchorEl={menuStatus?.el} onClose={() => setMenuStatus(null)}>
        {ETAPAS_CONTEUDO.map(st => {
          const atual = menuStatus ? (states[menuStatus.id]?.status ?? items.find(i => i.i === menuStatus.id)?.s) : null
          return (
            <MenuItem key={st} selected={atual === st} sx={{ fontSize: '0.8rem', gap: 1 }}
              onClick={() => { if (menuStatus && atual !== st) onEditarConteudo(menuStatus.id, { status: st }); setMenuStatus(null) }}>
              <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_CONFIG[st].color, display: 'inline-block' }} />
              {STATUS_CONFIG[st].label}
            </MenuItem>
          )
        })}
      </Menu>

      {/* Restaurar: sempre com confirmação — substitui as escolhas manuais do mês. */}
      <Dialog open={confirmarRestaurar && !!clienteSel} onClose={() => setConfirmarRestaurar(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1rem' }}>Restaurar padrão de {nomeMes}?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.84rem', color: DS.t2, lineHeight: 1.6 }}>
            As preferências manuais de <strong style={{ color: DS.t1 }}>{clienteSel}</strong> em {nomeMes} — vagas postas,
            movidas ou tiradas — serão substituídas pelo Padrão Editorial atual{resumoPadrao ? ` (${resumoPadrao})` : ''}:
            <strong style={{ color: DS.t1 }}> {vagasDoPadrao} vaga{vagasDoPadrao !== 1 ? 's' : ''}</strong> no mês.
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: DS.t3, mt: 1.2, lineHeight: 1.6 }}>
            Só as preferências mudam. Nenhum conteúdo é apagado nem muda de data.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmarRestaurar(false)} sx={{ color: DS.t2 }}>Cancelar</Button>
          <Button variant="contained" onClick={restaurar}>Restaurar padrão</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!aviso} autoHideDuration={6000} onClose={() => setAviso(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setAviso(null)} sx={{ fontSize: '0.8rem' }}>{aviso}</Alert>
      </Snackbar>
    </Box>
  )
}

// ── Peças ────────────────────────────────────────────────────────────────────

const CAMPO_SX = {
  '& .MuiInputBase-root': { fontSize: '0.75rem', height: 34, bgcolor: DS.field, borderRadius: '8px' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: DS.border, borderRadius: '8px' },
  '& .MuiSelect-icon': { color: DS.t3 },
} as const

function NavBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <Box {...clickable(onClick)} aria-label={label} sx={{
      minWidth: 38, height: 36, px: 1.3, display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: '9px', border: `1px solid ${DS.border}`, bgcolor: DS.surface, cursor: 'pointer',
      fontSize: '0.8rem', fontWeight: 700, color: DS.t1, transition: 'all 0.18s ease',
      '&:hover': { borderColor: DS.borderHov, color: DS.accent },
    }}>
      {children}
    </Box>
  )
}

function Filtro({ rotulo, value, onChange, largura, children }: {
  rotulo: string; value: string; onChange: (v: string) => void; largura: number; children: React.ReactNode
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: DS.t2, mb: 0.5 }}>{rotulo}</Typography>
      <TextField select size="small" value={value} onChange={e => onChange(e.target.value)} sx={{ width: largura, ...CAMPO_SX }}>
        {children}
      </TextField>
    </Box>
  )
}

function Contador({ n, rotulo, cor, ponto }: { n: number | string; rotulo: string; cor?: string; ponto?: string }) {
  return (
    <Box sx={{ px: 1.2, height: 34, display: 'flex', alignItems: 'center', gap: 0.6, borderRadius: '9px', border: `1px solid ${DS.border}`, bgcolor: DS.surface }}>
      {ponto && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ponto, flexShrink: 0 }} />}
      <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: cor ?? DS.t1, fontVariantNumeric: 'tabular-nums' }}>{n}</Typography>
      <Typography sx={{ fontSize: '0.7rem', color: DS.t2 }}>{rotulo}</Typography>
    </Box>
  )
}

/** Vaga livre na grade: planejamento, não conteúdo — tracejada, na cor do tipo, arrastável. */
function VagaChip({ vaga, arrastavel, onDragStart, onDragEnd }: { vaga: Vaga; arrastavel: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  const cor = COR_TIPO[vaga.tipo]
  return (
    <Tooltip title={`Preferência de ${ROTULO_TIPO[vaga.tipo]} — arraste para outro dia; clique no dia para tirar ou pôr`} enterDelay={500}>
      <Box draggable={arrastavel}
        onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
        onDragEnd={onDragEnd}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.7, height: 20, borderRadius: '6px',
          border: `1px dashed ${cor}aa`, bgcolor: `${cor}10`, cursor: arrastavel ? 'grab' : 'default',
        }}>
        <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: cor }} />
        <Typography sx={{ fontSize: { xs: '0.52rem', md: '0.58rem', xl: '0.64rem' }, fontWeight: 800, color: cor, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {ROTULO_TIPO[vaga.tipo]}
        </Typography>
      </Box>
    </Tooltip>
  )
}

function StatusPill({ s, seta }: { s: Status; seta?: boolean }) {
  const cfg = STATUS_CONFIG[s]
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.7, py: '2px', borderRadius: '999px', border: `1px solid ${cfg.color}66`, bgcolor: `${cfg.color}14`, maxWidth: '100%' }}>
      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: cfg.color, flexShrink: 0 }} />
      <Typography noWrap sx={{ fontSize: seta ? '0.66rem' : '0.56rem', fontWeight: 800, color: cfg.color, lineHeight: 1.2 }}>{cfg.shortLabel}{seta ? ' ▾' : ''}</Typography>
    </Box>
  )
}

function MiniConteudo({ item, st, arrastavel, onDragStart, onDragEnd, ig, onAbrir, etiquetasBase }: {
  item: ContentItem; st: ItemState | undefined; arrastavel: boolean; onDragStart: () => void; onDragEnd: () => void
  etiquetasBase: Etiqueta[]
  ig?: AgendamentosDoCard
  /** Abre o painel lateral de edição. */
  onAbrir?: () => void
}) {
  const p = postagemDoCard(item, st)
  const s = st?.status ?? item.s
  const cor = corDoConteudo(item.tp)
  const titulo = st?.title || item.n
  return (
    <Tooltip title={`${item.c} · ${titulo}`} placement="top" enterDelay={500}>
      <Box
        draggable={arrastavel}
        onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
        onDragEnd={onDragEnd}
        {...(onAbrir ? { onClick: (e: React.MouseEvent) => { e.stopPropagation(); onAbrir() }, role: 'button', tabIndex: 0,
          onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onAbrir() } } } : {})}
        sx={{
          pl: 0.8, pr: 0.6, py: 0.6, borderRadius: '7px', bgcolor: DS.surfaceAlt,
          borderLeft: `2.5px solid ${cor}`, cursor: arrastavel ? 'grab' : 'pointer', minWidth: 0,
          opacity: s === 7 ? 0.7 : 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.54rem', fontWeight: 800, color: cor, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {rotuloDoTipo(item.tp)}
          </Typography>
          <Typography noWrap sx={{ fontSize: '0.56rem', color: DS.t3, fontWeight: 600, minWidth: 0 }}>{item.c}</Typography>
        </Box>
        <Typography sx={{
          fontSize: { xs: '0.62rem', md: '0.68rem', xl: '0.74rem' }, fontWeight: 700, color: DS.t1, lineHeight: 1.25, mb: 0.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {titulo}
        </Typography>
        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5 }}>
          <StatusPill s={s} />
          {p.hora && (
            <Typography sx={{ fontSize: '0.56rem', color: p.firme ? DS.t1 : DS.t3, fontWeight: 700 }}>{p.hora}</Typography>
          )}
          <MarcaIG agendamentos={ig} st={st} />
        </Box>
        {!!st?.tags?.length && (
          <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', mt: 0.4 }}>
            {st.tags.slice(0, 2).map(t => (
              <Box key={t} sx={{ px: 0.6, py: '1px', borderRadius: '5px', bgcolor: `${corDaEtiqueta(etiquetasBase, t)}1f`, border: `1px solid ${corDaEtiqueta(etiquetasBase, t)}77` }}>
                <Typography noWrap sx={{ fontSize: '0.52rem', fontWeight: 700, color: DS.t2, maxWidth: 80 }}>{t}</Typography>
              </Box>
            ))}
            {st.tags.length > 2 && <Typography sx={{ fontSize: '0.52rem', color: DS.t3 }}>+{st.tags.length - 2}</Typography>}
          </Box>
        )}
      </Box>
    </Tooltip>
  )
}

function DetalheConteudo({ item, st, podeRemarcar, onReschedule, onMudarTipo, onArquivar, onExcluir, ig, conta, onProgramar, onMudarHora, onReprogramar, onEditar, onStatus, responsavel, etiquetasBase }: {
  item: ContentItem; st: ItemState | undefined; podeRemarcar: boolean; onReschedule: (d: Date) => void
  /** Status clicável: abre as etapas da esteira. */
  onStatus?: (el: HTMLElement) => void
  responsavel?: string
  etiquetasBase: Etiqueta[]
  onArquivar?: () => void
  /** Abre o painel lateral com todos os campos. */
  onEditar?: () => void
  onMudarTipo: (tp: ContentType) => void
  ig?: AgendamentosDoCard
  conta?: IgConta
  onProgramar: () => void
  onMudarHora: (hora: string) => void
  onReprogramar: () => void
  /** Exclusão definitiva. Ausente = quem vê não pode. */
  onExcluir?: () => void
}) {
  const s = st?.status ?? item.s
  const tiposDoCard = TIPOS_CRIACAO.some(t => t.tp === item.tp) ? TIPOS_CRIACAO : [...TIPOS_CRIACAO, { tp: item.tp, rotulo: rotuloDoTipo(item.tp) }]
  const cor = corDoConteudo(item.tp)
  const dt = new Date(item.dt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const links = [
    st?.link && { rotulo: 'Criativo', url: st.link },
    st?.footageLink && { rotulo: 'Material', url: st.footageLink },
    st?.roteiroLink && { rotulo: 'Roteiro', url: st.roteiroLink },
  ].filter(Boolean) as { rotulo: string; url: string }[]
  return (
    <Box sx={{ p: 1.4, borderRadius: '11px', bgcolor: DS.surfaceAlt, border: `1px solid ${DS.border}`, borderLeft: `3px solid ${cor}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5, flexWrap: 'wrap' }}>
        {podeRemarcar ? (
          <TextField select size="small" value={item.tp} onChange={e => onMudarTipo(e.target.value as ContentType)}
            aria-label="Tipo do conteúdo"
            sx={{ width: 130, '& .MuiInputBase-root': { fontSize: '0.66rem', fontWeight: 800, height: 26, color: cor, bgcolor: DS.field, borderRadius: '7px' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: `${cor}55` } }}>
            {tiposDoCard.map(t => <MenuItem key={t.tp} value={t.tp} sx={{ fontSize: '0.72rem' }}>{t.rotulo}</MenuItem>)}
          </TextField>
        ) : (
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: cor, textTransform: 'uppercase' }}>{rotuloDoTipo(item.tp)}</Typography>
        )}
        <Typography sx={{ fontSize: '0.7rem', color: DS.t2, fontWeight: 600 }}>{item.c}</Typography>
        <Box sx={{ flex: 1 }} />
        {onStatus ? (
          <Tooltip title="Mudar etapa">
            <Box component="button" type="button" onClick={e => onStatus(e.currentTarget)} aria-label={`Etapa: ${STATUS_CONFIG[s]?.label}. Mudar`}
              sx={{ p: 0, border: 0, bgcolor: 'transparent', cursor: 'pointer', font: 'inherit', borderRadius: '999px', '&:hover': { filter: 'brightness(1.25)' } }}>
              <StatusPill s={s} seta />
            </Box>
          </Tooltip>
        ) : <StatusPill s={s} />}
        {onEditar && (
          <Button size="small" onClick={onEditar} sx={{ minWidth: 0, px: 1, fontSize: '0.68rem', fontWeight: 700, color: DS.accent }}>Editar</Button>
        )}
      </Box>
      <Typography sx={{ fontSize: '0.88rem', fontWeight: 800, color: DS.t1, mb: 0.6 }}>{st?.title || item.n}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap', mb: 0.8 }}>
        <Typography sx={{ fontSize: '0.7rem', color: responsavel ? DS.t1 : DS.t3, fontWeight: 600 }}>
          {responsavel ? `Responsável: ${nomeDe(responsavel)}` : 'Sem responsável'}
        </Typography>
        {(st?.tags ?? []).map(t => (
          <Box key={t} sx={{ px: 0.7, py: '1px', borderRadius: '6px', bgcolor: `${corDaEtiqueta(etiquetasBase, t)}1f`, border: `1px solid ${corDaEtiqueta(etiquetasBase, t)}77` }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: DS.t1 }}>{t}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
        {s === 9 && st?.programadoPara && (
          <Typography sx={{ fontSize: '0.7rem', color: DS.t1, fontWeight: 700 }}>
            Programado para {new Date(st.programadoPara).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às {postagemDoCard(item, st).hora}
          </Typography>
        )}
        {st?.deliveryDate && (
          <Typography sx={{ fontSize: '0.7rem', color: DS.t3 }}>Entrega {new Date(st.deliveryDate).toLocaleDateString('pt-BR')}</Typography>
        )}
        {links.map(l => (
          <Box key={l.rotulo} component="a" href={l.url} target="_blank" rel="noreferrer"
            sx={{ fontSize: '0.7rem', fontWeight: 700, color: DS.accent, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            {l.rotulo} ↗
          </Box>
        ))}
        <Box sx={{ flex: 1 }} />
        {podeRemarcar && (
          <TextField
            type="date" size="small" label="Data de postagem"
            value={`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`}
            onChange={e => {
              const [y, m, d] = e.target.value.split('-').map(Number)
              if (y && m && d) onReschedule(new Date(y, m - 1, d, dt.getHours() || 12, dt.getMinutes()))
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 170, ...CAMPO_SX }}
          />
        )}
        {podeRemarcar && (
          <TextField
            type="time" size="small" label="Horário"
            // Sem estado local: grava ao sair do campo, e o card segue sendo a fonte.
            defaultValue={postagemDoCard(item, st).hora ?? ''}
            key={`${item.i}-${st?.horaPostagem ?? ''}-${st?.programadoPara ?? ''}`}
            onBlur={e => { const h = e.target.value; if (h !== (postagemDoCard(item, st).hora ?? '') && (h === '' || horaValida(h))) onMudarHora(h) }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 118, ...CAMPO_SX }}
          />
        )}
      </Box>
      {podeRemarcar && s === 5 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: '0.72rem', color: DS.t2 }}>O cliente aprovou.</Typography>
          <Button size="small" variant="contained" onClick={onProgramar} sx={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'none' }}>
            Aprovar e programar
          </Button>
          <Typography sx={{ fontSize: '0.68rem', color: DS.t3 }}>
            {destinosDa(conta) ? `pode publicar sozinho em ${destinosDa(conta)}` : 'publicação manual (cliente sem Instagram nem Facebook conectado)'}
          </Typography>
        </Box>
      )}
      {podeRemarcar && <SituacaoIG item={item} st={st} agendamentos={ig} conta={conta} onReprogramar={onReprogramar} />}
      {(onArquivar || onExcluir) && (
        <Box sx={{ display: 'flex', gap: 0.8, mt: 1, pt: 1, borderTop: `1px solid ${DS.border}` }}>
          {onArquivar && <Button size="small" onClick={onArquivar} sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'none', color: DS.t2, border: `1px solid ${DS.border}`, px: 1.2 }}>Arquivar</Button>}
          {onExcluir && <Button size="small" onClick={onExcluir} sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'none', color: DS.red, border: `1px solid ${DS.red}44`, px: 1.2 }}>Excluir</Button>}
        </Box>
      )}
    </Box>
  )
}
