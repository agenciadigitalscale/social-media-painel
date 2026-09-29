import { useMemo, useState } from 'react'
import { Box, Button, Dialog, DialogContent, DialogTitle, IconButton, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import type { ContentItem, ContentType, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'
import { DS } from '../theme'
import { clickable } from '../shared/a11y'
import { isRealLate } from '../lib/todaySignals'
import { ALL_TYPES } from './producao/shared'

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

// Paleta sóbria: laranja, amarelo e cinza — o rótulo diz o tipo, a cor só ajuda.
const COR_TIPO: Record<ContentType, string> = {
  Reel: DS.accent, Story: DS.accent,
  Post: DS.cyan, Carrossel: DS.cyan,
  Feed: DS.neutral,
}

const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const POR_CELULA = 3

const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const mesmoDia = (a: Date, b: Date) => chaveDia(a) === chaveDia(b)
const hora = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Programado com hora marcada vale mais que a data da pauta. */
function dataDePostagem(item: ContentItem, st: ItemState | undefined): Date {
  return st?.status === 9 && st.programadoPara ? new Date(st.programadoPara) : new Date(item.dt)
}

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
  clients: string[]
  podeRemarcar: boolean
  onReschedule: (id: number, dt: Date) => void
  onAbrirProducao: () => void
}

export default function CalendarioPostagem({ items, states, now, clients, podeRemarcar, onReschedule, onAbrirProducao }: Props) {
  const [ref, setRef] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [modo, setModo] = useState<'mes' | 'semana'>('mes')
  const [cliente, setCliente] = useState('todos')
  const [tipo, setTipo] = useState<'todos' | ContentType>('todos')
  const [etapa, setEtapa] = useState<Etapa>('todas')
  const [busca, setBusca] = useState('')
  const [diaAberto, setDiaAberto] = useState<Date | null>(null)
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [alvo, setAlvo] = useState<string | null>(null)

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
          <Contador n={resumo.publicados} rotulo="publicados" cor={DS.green} />
          {resumo.atrasados > 0 && <Contador n={resumo.atrasados} rotulo="atrasados" cor={DS.red} />}
        </Box>
      </Box>

      {/* Legenda */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }}>
        {([['Reel / Story', DS.accent], ['Post / Carrossel', DS.cyan], ['Feed', DS.neutral]] as const).map(([l, c]) => (
          <Box key={l} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} />
            <Typography sx={{ fontSize: '0.7rem', color: DS.t2 }}>{l}</Typography>
          </Box>
        ))}
        {podeRemarcar && (
          <Typography sx={{ fontSize: '0.68rem', color: DS.t3 }}>· arraste um conteúdo para outro dia para remarcar</Typography>
        )}
      </Box>

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
                  {lista.length > 0 && (
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: DS.t3 }}>{lista.length}</Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                  {(modo === 'mes' ? lista.slice(0, POR_CELULA) : lista).map(it => (
                    <MiniConteudo key={it.i} item={it} st={states[it.i]} arrastavel={podeRemarcar}
                      onDragStart={() => setArrastando(it.i)} onDragEnd={() => { setArrastando(null); setAlvo(null) }} />
                  ))}
                  {modo === 'mes' && lista.length > POR_CELULA && (
                    <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: DS.accent, pl: 0.5 }}>
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
      <Dialog open={!!diaAberto} onClose={() => setDiaAberto(null)} maxWidth="sm" fullWidth>
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
          {conteudosDoDia.length === 0 && (
            <Typography sx={{ fontSize: '0.8rem', color: DS.t3, py: 3, textAlign: 'center' }}>Nada marcado para este dia.</Typography>
          )}
          {conteudosDoDia.map(it => (
            <DetalheConteudo key={it.i} item={it} st={states[it.i]} podeRemarcar={podeRemarcar}
              onReschedule={d => onReschedule(it.i, d)} />
          ))}
          {conteudosDoDia.length > 0 && (
            <Button size="small" onClick={() => { setDiaAberto(null); onAbrirProducao() }}
              sx={{ alignSelf: 'flex-start', fontSize: '0.72rem', color: DS.accent, px: 0 }}>
              Abrir Produções →
            </Button>
          )}
        </DialogContent>
      </Dialog>
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

function MiniConteudo({ item, st, arrastavel, onDragStart, onDragEnd }: {
  item: ContentItem; st: ItemState | undefined; arrastavel: boolean; onDragStart: () => void; onDragEnd: () => void
}) {
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
          {s === 9 && st?.programadoPara && (
            <Typography sx={{ fontSize: '0.56rem', color: DS.t2, fontWeight: 700 }}>{hora(st.programadoPara)}</Typography>
          )}
        </Box>
      </Box>
    </Tooltip>
  )
}

function DetalheConteudo({ item, st, podeRemarcar, onReschedule }: {
  item: ContentItem; st: ItemState | undefined; podeRemarcar: boolean; onReschedule: (d: Date) => void
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
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: cor, textTransform: 'uppercase' }}>{item.tp}</Typography>
        <Typography sx={{ fontSize: '0.7rem', color: DS.t2, fontWeight: 600 }}>{item.c}</Typography>
        <Box sx={{ flex: 1 }} />
        <StatusPill s={s} />
      </Box>
      <Typography sx={{ fontSize: '0.88rem', fontWeight: 800, color: DS.t1, mb: 0.8 }}>{st?.title || item.n}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
        {s === 9 && st?.programadoPara && (
          <Typography sx={{ fontSize: '0.7rem', color: DS.t2 }}>Programado para {hora(st.programadoPara)}</Typography>
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
      </Box>
    </Box>
  )
}
