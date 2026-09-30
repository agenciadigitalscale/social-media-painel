import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Snackbar, TextField, Tooltip, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import type { Client, ContentItem, ContentType, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'
import { DS } from '../theme'
import { clickable } from '../shared/a11y'
import { isRealLate } from '../lib/todaySignals'
import { ALL_TYPES } from './producao/shared'
import {
  TIPOS_PADRAO, ROTULO_TIPO, TIPO_DO_CARD, EVENTO_PADRAO, PADRAO_VAZIO,
  carregarPadroes, salvarPadroes, padraoDo, metaDoMes, tipoDoPadrao,
  doClienteNoMes, planejarDistribuicao, planejarRestauracao, tituloPlanejado,
  type PadraoCliente, type PadroesStore, type TipoPadrao,
} from '../lib/padraoEditorial'
import { aguardandoSocial, horaValida, postagemDoCard } from '../lib/programacao'
import { useIgStatus, type AgendamentosDoCard, type IgConta } from '../lib/instagram'
import { MarcaIG, SituacaoIG, destinosDa } from './calendario/ProgramacaoIG'

/** Tipos que dá para criar direto no calendário (rótulo que a equipe usa). */
const TIPOS_NOVO: { tp: ContentType; rotulo: string }[] = [
  { tp: 'Reel', rotulo: 'Reel' }, { tp: 'Post', rotulo: 'Post Design' }, { tp: 'Feed', rotulo: 'Post Feed' },
  { tp: 'Carrossel', rotulo: 'Carrossel' }, { tp: 'Story', rotulo: 'Story' },
]
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

// Painel sóbrio (2026-09-29): tipo em cinza — o rótulo já diz o tipo; cor fica
// para o que pede atenção (etapa, atraso).
const COR_TIPO: Record<ContentType, string> = {
  Reel: '#C8CED8', Story: '#C8CED8', Post: '#C8CED8', Carrossel: '#C8CED8', Feed: '#C8CED8',
}

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
  onAdicionar: (cliente: string, tipo: ContentType, titulo: string, data: Date, hora?: string) => unknown
  onMudarTipo: (id: number, tipo: ContentType) => void
  onExcluir: (id: number) => void
  /** "Aprovar e programar": leva o card a Programado no dia e hora dele. */
  onProgramar: (id: number) => void
  /** Hora de postagem do card ("HH:MM"). */
  onMudarHora: (id: number, hora: string) => void
  /** Abre a escolha de dia e hora de novo (falhou no Instagram, ou horário vencido). */
  onReprogramar: (id: number) => void
  /** Abre a aba "Aprovar e programar". */
  onAbrirFila: () => void
}

export default function CalendarioPostagem({ items, states, now, clients, podeRemarcar, onReschedule, onAbrirProducao, planos, podeExcluirTudo, onAdicionar, onMudarTipo, onExcluir, onProgramar, onMudarHora, onReprogramar, onAbrirFila }: Props) {
  const [ref, setRef] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [modo, setModo] = useState<'mes' | 'semana'>('mes')
  const [cliente, setCliente] = useState('todos')
  const [tipo, setTipo] = useState<'todos' | ContentType>('todos')
  const [etapa, setEtapa] = useState<Etapa>('todas')
  const [busca, setBusca] = useState('')
  const [diaAberto, setDiaAberto] = useState<Date | null>(null)
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [alvo, setAlvo] = useState<string | null>(null)

  // Padrão Editorial — relido quando muda aqui ou chega de outro aparelho.
  const [padroes, setPadroes] = useState<PadroesStore>(() => carregarPadroes())
  useEffect(() => {
    const reler = () => setPadroes(carregarPadroes())
    window.addEventListener(EVENTO_PADRAO, reler)
    return () => window.removeEventListener(EVENTO_PADRAO, reler)
  }, [])
  const [padraoAberto, setPadraoAberto] = useState(false)
  // Adicionar conteúdo num dia qualquer (exceção ao padrão é normal).
  const [novoAberto, setNovoAberto] = useState(false)
  const [novoCliente, setNovoCliente] = useState('')
  const [novoTipo, setNovoTipo] = useState<ContentType>('Reel')
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novoHora, setNovoHora] = useState('')
  // Instagram: quem programa acompanha o que vai sair sozinho.
  const ig = useIgStatus(podeRemarcar)
  const contaDe = (c: string) => ig.conectados.find(x => x.clientName === c)
  const [confirmarRestaurar, setConfirmarRestaurar] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const clienteSel = cliente !== 'todos' ? cliente : null
  const padrao = clienteSel ? padraoDo(padroes, clienteSel) : PADRAO_VAZIO
  const plano = clienteSel ? planos.find(p => p.name === clienteSel) : undefined
  const meta = metaDoMes(padrao, plano)

  const filtrados = useMemo(() => {
    const permitidos = ETAPAS.find(e => e.key === etapa)!.status
    const q = busca.trim().toLowerCase()
    return items.filter(it => {
      const st = states[it.i]
      const s = st?.status ?? it.s
      if (cliente !== 'todos' && it.c !== cliente) return false
      if (tipo !== 'todos' && it.tp !== tipo) return false
      if (permitidos.length && !permitidos.includes(s)) return false
      if (q && !`${it.c} ${st?.title || ''} ${it.n}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, states, cliente, tipo, etapa, busca])

  const porDia = useMemo(() => {
    const m = new Map<string, ContentItem[]>()
    for (const it of filtrados) {
      const k = chaveDia(dataDePostagem(it, states[it.i]))
      const lista = m.get(k)
      if (lista) lista.push(it); else m.set(k, [it])
    }
    for (const lista of m.values()) lista.sort((a, b) => dataDePostagem(a, states[a.i]).getTime() - dataDePostagem(b, states[b.i]).getTime())
    return m
  }, [filtrados, states])

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
    if (arrastando === null) return
    const it = items.find(x => x.i === arrastando)
    setArrastando(null); setAlvo(null)
    if (!it || mesmoDia(new Date(it.dt), dia)) return
    const antiga = new Date(it.dt)
    onReschedule(it.i, new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), antiga.getHours() || 12, antiga.getMinutes()))
  }

  const conteudosDoDia = diaAberto ? porDia.get(chaveDia(diaAberto)) ?? [] : []
  // Fila de aprovação: respeita os filtros de cliente e tipo da tela.
  const fila = useMemo(() => podeRemarcar
    ? aguardandoSocial(items.filter(it => (cliente === 'todos' || it.c === cliente) && (tipo === 'todos' || it.tp === tipo)), states)
    : [], [podeRemarcar, items, states, cliente, tipo])

  // ── Padrão Editorial: o mês de referência é o da tela (vale na visão Semana também).
  const anoRef = ref.getFullYear(), mesRef = ref.getMonth()
  const nomeMes = `${MESES[mesRef].toLowerCase()} de ${anoRef}`
  const itensDoMes = clienteSel ? doClienteNoMes(items, clienteSel, anoRef, mesRef) : []
  const faltam = TIPOS_PADRAO.map(t => ({ t, n: Math.max(0, meta[t] - itensDoMes.filter(i => tipoDoPadrao(i.tp) === t).length) }))

  const criarPlanejados = (existentes: ContentItem[]): number => {
    if (!clienteSel) return 0
    const planejados = planejarDistribuicao({ ano: anoRef, mes: mesRef, padrao, meta, existentes, hoje: now })
    for (const p of planejados) onAdicionar(clienteSel, TIPO_DO_CARD[p.tipo], tituloPlanejado(p.tipo), p.data)
    return planejados.length
  }
  const distribuir = () => {
    const n = criarPlanejados(itensDoMes)
    setAviso(n ? `${n} conteúdo${n !== 1 ? 's' : ''} distribuído${n !== 1 ? 's' : ''} em ${nomeMes} pelo padrão de ${clienteSel}.`
      : `${clienteSel} já tem a meta de ${nomeMes} completa — nada a distribuir.`)
  }
  // Restaurar desfaz as DATAS escolhidas à mão, sem apagar pauta (ver lib).
  const restauracao = clienteSel && confirmarRestaurar
    ? planejarRestauracao({ ano: anoRef, mes: mesRef, padrao, meta, itensDoMes, states, hoje: now })
    : { mover: [], criar: [] }
  const restaurar = () => {
    if (!clienteSel) return
    for (const m of restauracao.mover) onReschedule(m.id, m.data)
    for (const p of restauracao.criar) onAdicionar(clienteSel, TIPO_DO_CARD[p.tipo], tituloPlanejado(p.tipo), p.data)
    setConfirmarRestaurar(false)
    const nm = restauracao.mover.length, nc = restauracao.criar.length
    setAviso(`${nomeMes[0].toUpperCase()}${nomeMes.slice(1)} de ${clienteSel} reconstruído pelo padrão: ${nm} voltaram para os dias do padrão, ${nc} criado${nc !== 1 ? 's' : ''}.`)
  }
  const resumoPadrao = TIPOS_PADRAO
    .filter(t => padrao.dias[t].length)
    .map(t => `${ROTULO_TIPO[t]}: ${padrao.dias[t].map(d => DIA_SEMANA[d]).join(', ')}`)
    .join(' · ')

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
              ['Padrão editorial', () => setPadraoAberto(true)],
              ['Distribuir mês', distribuir],
              ['Restaurar padrão', () => setConfirmarRestaurar(true)],
            ] as const).map(([rotulo, acao]) => (
              <Tooltip key={rotulo} title={clienteSel ? '' : 'Escolha um cliente no filtro para usar o Padrão Editorial'}>
                <span>
                  <Button size="small" onClick={acao} disabled={!clienteSel} sx={{
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
          {clients.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.75rem' }}>{c}</MenuItem>)}
        </Filtro>
        <Filtro rotulo="Tipo" value={tipo} onChange={v => setTipo(v as 'todos' | ContentType)} largura={140}>
          <MenuItem value="todos" sx={{ fontSize: '0.75rem' }}>Todos</MenuItem>
          {ALL_TYPES.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '0.75rem' }}>{t}</MenuItem>)}
        </Filtro>
        <Filtro rotulo="Status" value={etapa} onChange={v => setEtapa(v as Etapa)} largura={170}>
          {ETAPAS.map(e => <MenuItem key={e.key} value={e.key} sx={{ fontSize: '0.75rem' }}>{e.label}</MenuItem>)}
        </Filtro>
        <Box>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: DS.t2, mb: 0.5 }}>Buscar</Typography>
          <TextField size="small" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Título ou cliente…"
            sx={{ width: { xs: 160, md: 200 }, ...CAMPO_SX }} />
        </Box>
        {(cliente !== 'todos' || tipo !== 'todos' || etapa !== 'todas' || busca) && (
          <Button size="small" onClick={() => { setCliente('todos'); setTipo('todos'); setEtapa('todas'); setBusca('') }}
            sx={{ fontSize: '0.7rem', color: DS.t2, height: 34, '&:hover': { color: DS.t1, bgcolor: 'transparent' } }}>
            Limpar
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
          <Contador n={resumo.total} rotulo="no período" />
          <Contador n={resumo.reels} rotulo="reels/stories" />
          <Contador n={resumo.posts} rotulo="posts/carrosséis" />
          {resumo.feed > 0 && <Contador n={resumo.feed} rotulo="feed" />}
          <Contador n={resumo.programados} rotulo="programados" />
          <Contador n={resumo.publicados} rotulo="publicados" />
          {resumo.atrasados > 0 && <Contador n={resumo.atrasados} rotulo="atrasados" cor={DS.red} />}
        </Box>
      </Box>

      {/* Legenda */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }}>
        {podeRemarcar && (
          <Typography sx={{ fontSize: '0.68rem', color: DS.t3 }}>Arraste para remarcar · + no dia para adicionar</Typography>
        )}
      </Box>

      {/* Padrão Editorial do cliente escolhido: a base do mês (não é trava). */}
      {clienteSel && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap', mb: 1.5, px: 1.4, py: 1,
          borderRadius: '11px', border: `1px solid ${DS.border}`, bgcolor: DS.surface,
        }}>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: DS.t3 }}>
            Padrão editorial
          </Typography>
          <Typography sx={{ fontSize: '0.74rem', color: resumoPadrao ? DS.t1 : DS.t3 }}>
            {resumoPadrao || 'sem dias definidos — a distribuição usa segunda a sexta'}
          </Typography>
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
                onDragOver={podeRemarcar ? e => { e.preventDefault(); if (alvo !== k) setAlvo(k) } : undefined}
                onDragLeave={podeRemarcar ? () => setAlvo(a => (a === k ? null : a)) : undefined}
                onDrop={podeRemarcar ? e => { e.preventDefault(); soltar(dia) } : undefined}
                sx={{
                  minHeight: modo === 'mes' ? { xs: 84, md: 120, xl: 150 } : { xs: 220, md: 420 },
                  p: { xs: 0.5, md: 0.9 }, cursor: 'pointer', position: 'relative',
                  borderRight: (idx % 7) !== 6 ? `1px solid ${DS.border}` : 'none',
                  borderBottom: idx < dias.length - 7 ? `1px solid ${DS.border}` : 'none',
                  bgcolor: sobre ? `${DS.accent}14` : 'transparent',
                  outline: hoje ? `1.5px solid ${DS.accent}` : 'none', outlineOffset: -1.5,
                  opacity: fora ? 0.45 : 1,
                  transition: 'background-color 0.18s ease',
                  '&:hover': { bgcolor: sobre ? `${DS.accent}14` : 'rgba(148,163,184,0.04)' },
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
                  {/* Dia do padrão: só uma dica discreta de qual tipo costuma sair aqui. */}
                  {clienteSel && !fora && (
                    <Typography noWrap sx={{ fontSize: '0.52rem', fontWeight: 700, color: DS.t4, textTransform: 'uppercase', letterSpacing: '0.04em', mx: 0.5, minWidth: 0 }}>
                      {TIPOS_PADRAO.filter(t => padrao.dias[t].includes(dia.getDay())).map(t => ROTULO_TIPO[t]).join(' · ')}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, ml: 'auto' }}>
                    {lista.length > 0 && (
                      <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: DS.t3 }}>{lista.length}</Typography>
                    )}
                    {podeRemarcar && (
                      <Tooltip title="Adicionar conteúdo neste dia">
                        <IconButton size="small" aria-label={`Adicionar conteúdo em ${dia.getDate()}/${dia.getMonth() + 1}`}
                          onClick={e => { e.stopPropagation(); setNovoAberto(true); setDiaAberto(dia) }}
                          sx={{ p: 0.2, color: DS.t4, '&:hover': { color: DS.accent } }}>
                          <AddIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                  {(modo === 'mes' ? lista.slice(0, POR_CELULA) : lista).map(it => (
                    <MiniConteudo key={it.i} item={it} st={states[it.i]} arrastavel={podeRemarcar} ig={ig.porItem[it.i]}
                      onDragStart={() => setArrastando(it.i)} onDragEnd={() => { setArrastando(null); setAlvo(null) }} />
                  ))}
                  {modo === 'mes' && lista.length > POR_CELULA && (
                    <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: DS.t2, pl: 0.5 }}>
                      + {lista.length - POR_CELULA} mais
                    </Typography>
                  )}
                </Box>
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* Dia aberto: todos os conteúdos */}
      <Dialog open={!!diaAberto} onClose={() => { setDiaAberto(null); setNovoAberto(false) }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: DS.t1 }}>
              {diaAberto?.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: DS.t2 }}>
              {conteudosDoDia.length} conteúdo{conteudosDoDia.length !== 1 ? 's' : ''} para postar
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setDiaAberto(null)} aria-label="Fechar"><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
          {/* Adicionar — em qualquer dia, com ou sem padrão para ele. */}
          {podeRemarcar && diaAberto && (novoAberto ? (
            <Box sx={{ p: 1.4, borderRadius: '11px', border: `1px dashed ${DS.borderHov}`, bgcolor: `${DS.accent}08`, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: DS.t1 }}>Novo conteúdo neste dia</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <TextField select size="small" label="Cliente" value={novoCliente || clienteSel || ''}
                  onChange={e => setNovoCliente(e.target.value)} sx={{ minWidth: 190, flex: 1, ...CAMPO_SX }}
                  slotProps={{ inputLabel: { shrink: true } }}>
                  {clients.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.75rem' }}>{c}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Tipo" value={novoTipo} onChange={e => setNovoTipo(e.target.value as ContentType)}
                  sx={{ width: 150, ...CAMPO_SX }} slotProps={{ inputLabel: { shrink: true } }}>
                  {TIPOS_NOVO.map(t => <MenuItem key={t.tp} value={t.tp} sx={{ fontSize: '0.75rem' }}>{t.rotulo}</MenuItem>)}
                </TextField>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField size="small" label="Nome do conteúdo" value={novoTitulo} onChange={e => setNovoTitulo(e.target.value)}
                  placeholder="Se deixar em branco: pauta a definir" slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ flex: 1, '& .MuiInputBase-root': { fontSize: '0.78rem', bgcolor: DS.field, borderRadius: '8px' } }} />
                <TextField size="small" label="Horário" type="time" value={novoHora} onChange={e => setNovoHora(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 120, ...CAMPO_SX }} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button size="small" onClick={() => setNovoAberto(false)} sx={{ color: DS.t2 }}>Cancelar</Button>
                <Button size="small" variant="contained" disabled={!(novoCliente || clienteSel)}
                  onClick={() => {
                    const c = novoCliente || clienteSel!
                    const tp = tipoDoPadrao(novoTipo)
                    const titulo = novoTitulo.trim() || (tp ? tituloPlanejado(tp) : `${novoTipo} — pauta a definir`)
                    onAdicionar(c, novoTipo, titulo, new Date(diaAberto.getFullYear(), diaAberto.getMonth(), diaAberto.getDate(), 12), horaValida(novoHora) ? novoHora : undefined)
                    setNovoTitulo(''); setNovoHora(''); setNovoAberto(false)
                    setAviso(`${TIPOS_NOVO.find(t => t.tp === novoTipo)?.rotulo} adicionado em ${diaAberto.getDate()}/${diaAberto.getMonth() + 1} para ${c}.`)
                  }}>
                  Adicionar
                </Button>
              </Box>
            </Box>
          ) : (
            <Button size="small" startIcon={<AddIcon sx={{ fontSize: '16px !important' }} />} onClick={() => setNovoAberto(true)}
              sx={{ alignSelf: 'flex-start', fontSize: '0.74rem', fontWeight: 700, color: DS.accent, px: 0.5 }}>
              Adicionar conteúdo neste dia
            </Button>
          ))}
          {conteudosDoDia.length === 0 && !novoAberto && (
            <Typography sx={{ fontSize: '0.8rem', color: DS.t3, py: 3, textAlign: 'center' }}>Nada marcado para este dia.</Typography>
          )}
          {conteudosDoDia.map(it => {
            const s = states[it.i]?.status ?? it.s
            return (
              <DetalheConteudo key={it.i} item={it} st={states[it.i]} podeRemarcar={podeRemarcar}
                ig={ig.porItem[it.i]} conta={contaDe(it.c)}
                onProgramar={() => onProgramar(it.i)}
                onMudarHora={h => onMudarHora(it.i, h)}
                onReprogramar={() => { setDiaAberto(null); onReprogramar(it.i) }}
                onReschedule={d => onReschedule(it.i, d)}
                onMudarTipo={tp => onMudarTipo(it.i, tp)}
                onExcluir={podeRemarcar && (podeExcluirTudo || s === 0) ? () => {
                  if (window.confirm(`Excluir "${states[it.i]?.title || it.n}" (${it.c}) do calendário?`)) onExcluir(it.i)
                } : undefined} />
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
          open={padraoAberto}
          cliente={clienteSel}
          inicial={padrao}
          plano={plano}
          onClose={() => setPadraoAberto(false)}
          onSalvar={novo => {
            const store = { ...padroes, [clienteSel]: novo }
            setPadroes(store); salvarPadroes(store); setPadraoAberto(false)
            setAviso(`Padrão editorial de ${clienteSel} salvo. Ele vale como base — nada no calendário muda até você distribuir ou restaurar.`)
          }}
        />
      )}

      {/* Restaurar: sempre com confirmação — substitui as escolhas manuais do mês. */}
      <Dialog open={confirmarRestaurar && !!clienteSel} onClose={() => setConfirmarRestaurar(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1rem' }}>Restaurar padrão de {nomeMes}?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.84rem', color: DS.t2, lineHeight: 1.6 }}>
            As preferências manuais de <strong style={{ color: DS.t1 }}>{clienteSel}</strong> em {nomeMes} serão substituídas
            pelo Padrão Editorial atual{resumoPadrao ? ` (${resumoPadrao})` : ''}:
          </Typography>
          <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.4, color: DS.t2, fontSize: '0.82rem', lineHeight: 1.7 }}>
            <li><strong style={{ color: DS.t1 }}>{restauracao.mover.length}</strong> conteúdo{restauracao.mover.length !== 1 ? 's' : ''} em "A fazer" volta{restauracao.mover.length !== 1 ? 'm' : ''} para os dias do padrão (as datas escolhidas à mão se perdem)</li>
            <li><strong style={{ color: DS.t1 }}>{restauracao.criar.length}</strong> novo{restauracao.criar.length !== 1 ? 's' : ''} para completar a meta</li>
          </Box>
          <Typography sx={{ fontSize: '0.78rem', color: DS.t3, mt: 1.2, lineHeight: 1.6 }}>
            Nenhuma pauta é apagada. O que já entrou em produção fica onde está e conta para a meta.
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

/** Editar o Padrão Editorial de um cliente: dias da semana por tipo + meta do mês. */
function PadraoDialog({ open, cliente, inicial, plano, onClose, onSalvar }: {
  open: boolean
  cliente: string
  inicial: PadraoCliente
  plano: Client | undefined
  onClose: () => void
  onSalvar: (p: PadraoCliente) => void
}) {
  const [dias, setDias] = useState(inicial.dias)
  const [meta, setMeta] = useState<Partial<Record<TipoPadrao, string>>>({})
  useEffect(() => {
    if (!open) return
    setDias(inicial.dias)
    setMeta(Object.fromEntries(TIPOS_PADRAO.map(t => [t, inicial.meta?.[t] !== undefined ? String(inicial.meta[t]) : ''])))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cliente])
  const doPlano: Record<TipoPadrao, number> = { Reel: plano?.reelsPerMonth ?? 0, Post: plano?.postsPerMonth ?? 0, Feed: 0 }
  const alternar = (t: TipoPadrao, d: number) =>
    setDias(prev => ({ ...prev, [t]: prev[t].includes(d) ? prev[t].filter(x => x !== d) : [...prev[t], d].sort() }))

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 800 }}>Padrão editorial — {cliente}</Typography>
        <Typography sx={{ fontSize: '0.72rem', color: DS.t2, mt: 0.3 }}>
          Dias preferidos de cada tipo e a meta do mês. É a base da distribuição — o calendário continua aceitando qualquer dia.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        {TIPOS_PADRAO.map(t => (
          <Box key={t}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: DS.t1, flex: 1 }}>{ROTULO_TIPO[t]}</Typography>
              <TextField size="small" type="number" label="Meta no mês" value={meta[t] ?? ''}
                onChange={e => setMeta(m => ({ ...m, [t]: e.target.value }))}
                placeholder={String(doPlano[t])} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 0 } }}
                helperText={t !== 'Feed' ? `vazio = plano (${doPlano[t]})` : 'vazio = 0'}
                sx={{ width: 130, '& .MuiInputBase-root': { fontSize: '0.78rem', height: 32, bgcolor: DS.field } }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
              {DIAS.map((rotulo, d) => {
                const on = dias[t].includes(d)
                return (
                  <Tooltip key={d} title={DIA_SEMANA[d]}>
                    <Box {...clickable(() => alternar(t, d))} aria-pressed={on} aria-label={`${ROTULO_TIPO[t]} às ${DIA_SEMANA[d]}s`} sx={{
                      width: 36, height: 32, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: '0.74rem', fontWeight: 800, transition: 'all 0.15s ease',
                      bgcolor: on ? DS.accent : 'transparent', color: on ? DS.onAccent : DS.t2,
                      border: `1px solid ${on ? DS.accent : DS.border}`,
                      '&:hover': { borderColor: DS.accent },
                    }}>
                      {rotulo}
                    </Box>
                  </Tooltip>
                )
              })}
            </Box>
          </Box>
        ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: DS.t2 }}>Cancelar</Button>
        <Button variant="contained" onClick={() => onSalvar({
          dias,
          meta: Object.fromEntries(TIPOS_PADRAO
            .filter(t => (meta[t] ?? '').trim() !== '' && Number.isFinite(Number(meta[t])))
            .map(t => [t, Math.max(0, Math.round(Number(meta[t])))])) as Partial<Record<TipoPadrao, number>>,
        })}>
          Salvar padrão
        </Button>
      </DialogActions>
    </Dialog>
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

function Contador({ n, rotulo, cor }: { n: number; rotulo: string; cor?: string }) {
  return (
    <Box sx={{ px: 1.2, height: 34, display: 'flex', alignItems: 'center', gap: 0.6, borderRadius: '9px', border: `1px solid ${DS.border}`, bgcolor: DS.surface }}>
      <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: cor ?? DS.t1, fontVariantNumeric: 'tabular-nums' }}>{n}</Typography>
      <Typography sx={{ fontSize: '0.7rem', color: DS.t2 }}>{rotulo}</Typography>
    </Box>
  )
}

function StatusPill({ s }: { s: Status }) {
  const cfg = STATUS_CONFIG[s]
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.7, py: '2px', borderRadius: '999px', border: `1px solid ${cfg.color}66`, bgcolor: `${cfg.color}14`, maxWidth: '100%' }}>
      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: cfg.color, flexShrink: 0 }} />
      <Typography noWrap sx={{ fontSize: '0.56rem', fontWeight: 800, color: cfg.color, lineHeight: 1.2 }}>{cfg.shortLabel}</Typography>
    </Box>
  )
}

function MiniConteudo({ item, st, arrastavel, onDragStart, onDragEnd, ig }: {
  item: ContentItem; st: ItemState | undefined; arrastavel: boolean; onDragStart: () => void; onDragEnd: () => void
  ig?: AgendamentosDoCard
}) {
  const p = postagemDoCard(item, st)
  const s = st?.status ?? item.s
  const cor = COR_TIPO[item.tp] ?? DS.neutral
  const titulo = st?.title || item.n
  return (
    <Tooltip title={`${item.c} · ${titulo}`} placement="top" enterDelay={500}>
      <Box
        draggable={arrastavel}
        onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
        onDragEnd={onDragEnd}
        sx={{
          pl: 0.8, pr: 0.6, py: 0.6, borderRadius: '7px', bgcolor: DS.surfaceAlt,
          borderLeft: `2.5px solid ${cor}`, cursor: arrastavel ? 'grab' : 'pointer', minWidth: 0,
          opacity: s === 7 ? 0.7 : 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.54rem', fontWeight: 800, color: cor, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {item.tp}
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
      </Box>
    </Tooltip>
  )
}

function DetalheConteudo({ item, st, podeRemarcar, onReschedule, onMudarTipo, onExcluir, ig, conta, onProgramar, onMudarHora, onReprogramar }: {
  item: ContentItem; st: ItemState | undefined; podeRemarcar: boolean; onReschedule: (d: Date) => void
  onMudarTipo: (tp: ContentType) => void
  ig?: AgendamentosDoCard
  conta?: IgConta
  onProgramar: () => void
  onMudarHora: (hora: string) => void
  onReprogramar: () => void
  /** Ausente = quem vê não pode excluir este conteúdo. */
  onExcluir?: () => void
}) {
  const s = st?.status ?? item.s
  const cor = COR_TIPO[item.tp] ?? DS.neutral
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
            {TIPOS_NOVO.map(t => <MenuItem key={t.tp} value={t.tp} sx={{ fontSize: '0.72rem' }}>{t.rotulo}</MenuItem>)}
          </TextField>
        ) : (
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: cor, textTransform: 'uppercase' }}>{item.tp}</Typography>
        )}
        <Typography sx={{ fontSize: '0.7rem', color: DS.t2, fontWeight: 600 }}>{item.c}</Typography>
        <Box sx={{ flex: 1 }} />
        <StatusPill s={s} />
        {onExcluir && (
          <Tooltip title="Excluir do calendário">
            <IconButton size="small" onClick={onExcluir} aria-label={`Excluir ${st?.title || item.n}`}
              sx={{ p: 0.4, color: DS.t4, '&:hover': { color: DS.red } }}>
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Typography sx={{ fontSize: '0.88rem', fontWeight: 800, color: DS.t1, mb: 0.8 }}>{st?.title || item.n}</Typography>
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
    </Box>
  )
}
