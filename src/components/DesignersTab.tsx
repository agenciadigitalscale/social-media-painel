/* DesignersTab — a área administrativa de produção dos designers.

   Visível só para quem tem `canViewDesignerManagement` (Mateus Testa e Arthur).
   Mostra, por período, quantas artes APROVADAS cada designer produziu — o número
   que a gestão usa para fechar o mês. A conta vem toda de `lib/designerProducao`
   (pura e testada); aqui é só apresentação.

   A contagem é idempotente por construção (deriva do status atual do card), então
   nada aqui soma evento: a mesma arte nunca vira dois. Ver a lib para as regras.
*/
import { useMemo, useState, type ReactNode } from 'react'
import {
  Box, Paper, Typography, Tooltip, Collapse, TextField, MenuItem, Divider,
} from '@mui/material'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import PaletteIcon from '@mui/icons-material/Palette'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import BoltIcon from '@mui/icons-material/Bolt'
import type { Client, ContentItem, ItemState } from '../types'
import { STATUS_CONFIG } from '../types'
import {
  artesDoDesigner, resumoDesigner, contarEntre, aprovadasEntre, porClienteEntre,
  serieDiariaAprovadas, type ArteDesigner,
} from '../lib/designerProducao'
import { carregarPaineis, carregarAtribuicoes } from '../lib/paineis'
import { NAME_MAP, getDisplayName } from '../lib/users'
import { DS, ctaGradient } from '../theme'
import { clickable } from '../shared/a11y'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients?: Client[]
  now: Date
}

/** Cores da disputa: distintas entre si (o NAME_MAP deixa os dois cinza). */
const CORES_DESIGNER = [DS.accent, DS.purpleSoft, DS.cyan, DS.pink]

/** Designers que este módulo acompanha — cargo Design no NAME_MAP. Julio primeiro
    para casar com o "Julio × Jhones" que a gestão usa. */
function designersDoSistema(): string[] {
  const todos = Object.keys(NAME_MAP).filter(u => NAME_MAP[u].role === 'Design')
  const ordem = ['julio', 'jhones']
  return todos.sort((a, b) => {
    const ia = ordem.indexOf(a), ib = ordem.indexOf(b)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return getDisplayName(a).localeCompare(getDisplayName(b))
  })
}

type PeriodoKey = 'hoje' | 'ontem' | 'semana' | 'mes' | 'mesAnterior' | 'custom'

function startOfDay(d: Date): number { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() }
function endOfDay(d: Date): number { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime() }
function inputDoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Janela { inicio: number; fim: number; label: string; ref: Date; dias: number }

function janelaDoPeriodo(p: PeriodoKey, now: Date, de: string, ate: string): Janela {
  const nomeMes = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'long' })
  if (p === 'hoje') return { inicio: startOfDay(now), fim: endOfDay(now), label: 'Hoje', ref: now, dias: 1 }
  if (p === 'ontem') {
    const o = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    return { inicio: startOfDay(o), fim: endOfDay(o), label: 'Ontem', ref: o, dias: 1 }
  }
  if (p === 'semana') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dow = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - dow)
    return { inicio: startOfDay(d), fim: endOfDay(now), label: 'Esta semana', ref: now, dias: 7 }
  }
  if (p === 'mesAnterior') {
    const ini = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const fim = new Date(now.getFullYear(), now.getMonth(), 0)
    return { inicio: startOfDay(ini), fim: endOfDay(fim), label: getDisplayName(nomeMes(ini)), ref: ini, dias: fim.getDate() }
  }
  if (p === 'custom') {
    const di = de ? new Date(`${de}T12:00:00`) : now
    const af = ate ? new Date(`${ate}T12:00:00`) : now
    const [lo, hi] = di.getTime() <= af.getTime() ? [di, af] : [af, di]
    const dias = Math.min(45, Math.max(1, Math.round((startOfDay(hi) - startOfDay(lo)) / 86_400_000) + 1))
    return { inicio: startOfDay(lo), fim: endOfDay(hi), label: 'Período', ref: hi, dias }
  }
  // mês atual
  const ini = new Date(now.getFullYear(), now.getMonth(), 1)
  const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { inicio: startOfDay(ini), fim: endOfDay(now), label: getDisplayName(nomeMes(now)), ref: now, dias: fim.getDate() }
}

const PERIODOS: { key: PeriodoKey; rotulo: string }[] = [
  { key: 'hoje', rotulo: 'Hoje' },
  { key: 'ontem', rotulo: 'Ontem' },
  { key: 'semana', rotulo: 'Semana' },
  { key: 'mes', rotulo: 'Mês atual' },
  { key: 'mesAnterior', rotulo: 'Mês anterior' },
  { key: 'custom', rotulo: 'Personalizado' },
]

function Numero({ valor, cor, tamanho = '2.4rem' }: { valor: number; cor: string; tamanho?: string }) {
  return (
    <Typography key={valor} sx={{
      fontWeight: 900, lineHeight: 1, color: cor, fontSize: tamanho,
      letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
      animation: 'countUp 0.5s cubic-bezier(0.16,1,0.3,1) both',
    }}>
      {valor}
    </Typography>
  )
}

export default function DesignersTab({ items, states, allClients, now }: Props) {
  const [periodo, setPeriodo] = useState<PeriodoKey>('mes')
  const [de, setDe] = useState(() => inputDoDia(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [ate, setAte] = useState(() => inputDoDia(now))
  const [designerFiltro, setDesignerFiltro] = useState<'todos' | string>('todos')
  const [clienteFiltro, setClienteFiltro] = useState<'todos' | string>('todos')
  const [auditoriaAberta, setAuditoriaAberta] = useState(false)

  const paineis = useMemo(() => carregarPaineis(), [])
  const atrib = useMemo(() => carregarAtribuicoes(), [])
  const designers = useMemo(() => designersDoSistema(), [])

  const janela = useMemo(() => janelaDoPeriodo(periodo, now, de, ate), [periodo, now, de, ate])

  // Artes de cada designer (todas, para poder contar por período e por status).
  const artesPorDesigner = useMemo(() => {
    const m: Record<string, ArteDesigner[]> = {}
    for (const d of designers) m[d] = artesDoDesigner(items, states, atrib, paineis, d)
    return m
  }, [items, states, atrib, paineis, designers])

  const mostrados = designerFiltro === 'todos' ? designers : [designerFiltro]

  // Números por designer no período selecionado.
  const dados = useMemo(() => mostrados.map((d, i) => {
    const artes = artesPorDesigner[d] ?? []
    const resumo = resumoDesigner(artes, janela.ref)
    const noPeriodo = contarEntre(artes, janela.inicio, janela.fim)
    return { designer: d, cor: CORES_DESIGNER[designers.indexOf(d) % CORES_DESIGNER.length] || DS.accent, resumo, noPeriodo, artes }
  }), [mostrados, artesPorDesigner, janela, designers])

  const maxPeriodo = Math.max(1, ...dados.map(d => d.noPeriodo))
  const disputaAtiva = designerFiltro === 'todos' && dados.length === 2
  const lider = disputaAtiva
    ? (dados[0].noPeriodo === dados[1].noPeriodo ? null : dados[0].noPeriodo > dados[1].noPeriodo ? dados[0] : dados[1])
    : null
  const diff = disputaAtiva ? Math.abs(dados[0].noPeriodo - dados[1].noPeriodo) : 0

  // Auditoria: artes aprovadas do período, opcionalmente filtradas por cliente.
  const auditoria = useMemo(() => {
    const linhas: ArteDesigner[] = []
    for (const d of mostrados) {
      for (const a of aprovadasEntre(artesPorDesigner[d] ?? [], janela.inicio, janela.fim)) {
        if (clienteFiltro !== 'todos' && a.cliente !== clienteFiltro) continue
        linhas.push(a)
      }
    }
    return linhas.sort((a, b) => (b.aprovadaEm ?? 0) - (a.aprovadaEm ?? 0))
  }, [mostrados, artesPorDesigner, janela, clienteFiltro])

  const clientesDisponiveis = useMemo(() => {
    const s = new Set<string>()
    for (const d of designers) for (const a of aprovadasEntre(artesPorDesigner[d] ?? [], janela.inicio, janela.fim)) s.add(a.cliente)
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [designers, artesPorDesigner, janela])

  return (
    <Box sx={{ maxWidth: 1160, mx: 'auto', px: { xs: 0, md: 0.5 }, animation: 'fadeInUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
      {/* ── Cabeçalho ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4, mb: 2 }}>
        <Box sx={{
          width: 42, height: 42, borderRadius: '12px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(135deg, ${DS.accent}22, ${DS.purpleSoft}22)`,
          border: `1px solid ${DS.accent}44`, color: DS.accent,
        }}>
          <PaletteIcon />
        </Box>
        <Box>
          <Typography sx={{ fontSize: { xs: '1.15rem', md: '1.45rem' }, fontWeight: 800, color: DS.t1, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Designers
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', color: DS.t3 }}>
            Artes aprovadas por designer — {janela.label}
          </Typography>
        </Box>
      </Box>

      {/* ── Filtros ── */}
      <Paper sx={{ p: 1.4, mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', border: `1px solid ${DS.border}`, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
          {PERIODOS.map(p => (
            <Box
              key={p.key}
              {...clickable(() => setPeriodo(p.key))}
              sx={{
                px: 1.2, py: 0.55, borderRadius: '8px', cursor: 'pointer',
                fontSize: '0.68rem', fontWeight: 700,
                color: periodo === p.key ? '#fff' : DS.t3,
                background: periodo === p.key ? ctaGradient(90) : DS.field,
                border: `1px solid ${periodo === p.key ? 'transparent' : DS.border}`,
                transition: 'all 0.18s ease', '&:hover': { color: periodo === p.key ? '#fff' : DS.t1 },
              }}
            >
              {p.rotulo}
            </Box>
          ))}
        </Box>
        {periodo === 'custom' && (
          <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
            <TextField size="small" type="date" label="De" value={de} onChange={e => setDe(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: inputDoDia(now) } }} sx={{ width: 150 }} />
            <TextField size="small" type="date" label="Até" value={ate} onChange={e => setAte(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: inputDoDia(now) } }} sx={{ width: 150 }} />
          </Box>
        )}
        <Box sx={{ flex: 1 }} />
        <TextField
          select size="small" label="Designer" value={designerFiltro}
          onChange={e => setDesignerFiltro(e.target.value)} sx={{ minWidth: 140 }}
        >
          <MenuItem value="todos" sx={{ fontSize: '0.8rem' }}>Todos</MenuItem>
          {designers.map(d => (
            <MenuItem key={d} value={d} sx={{ fontSize: '0.8rem' }}>{getDisplayName(d)}</MenuItem>
          ))}
        </TextField>
      </Paper>

      {/* ── Bloco 1: Competição (só na visão dos dois) ── */}
      {disputaAtiva && (
        <Paper sx={{
          p: { xs: 2, md: 2.6 }, mb: 2, borderRadius: 3, position: 'relative', overflow: 'hidden',
          background: `linear-gradient(120deg, ${dados[0].cor}10, ${DS.surface} 45%, ${dados[1].cor}10)`,
          border: `1px solid ${DS.border}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 2, justifyContent: 'center' }}>
            <EmojiEventsIcon sx={{ fontSize: 20, color: DS.amber }} />
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: DS.t2 }}>
              Disputa · {janela.label}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: { xs: 2, md: 4 }, alignItems: 'flex-end', justifyContent: 'center', mb: 2 }}>
            {dados.map(d => {
              const ganhando = lider?.designer === d.designer
              return (
                <Box key={d.designer} sx={{ flex: 1, maxWidth: 240, textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                    {ganhando && <EmojiEventsIcon sx={{ fontSize: 16, color: DS.amber, animation: 'glowPulse 2.4s ease-in-out infinite' }} />}
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: ganhando ? DS.t1 : DS.t2, letterSpacing: '-0.01em' }}>
                      {NAME_MAP[d.designer]?.emoji} {getDisplayName(d.designer)}
                    </Typography>
                  </Box>
                  <Numero valor={d.noPeriodo} cor={d.cor} tamanho="3rem" />
                  <Typography sx={{ fontSize: '0.6rem', color: DS.t3, mt: 0.3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    aprovadas
                  </Typography>
                </Box>
              )
            })}
          </Box>

          {/* Barras proporcionais — a animação é o preenchimento suave da largura. */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.9, maxWidth: 640, mx: 'auto', mb: 1.6 }}>
            {dados.map(d => (
              <Box key={d.designer} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ width: 58, fontSize: '0.66rem', color: DS.t3, textAlign: 'right', flexShrink: 0 }} noWrap>
                  {getDisplayName(d.designer)}
                </Typography>
                <Box sx={{ flex: 1, height: 14, borderRadius: '7px', bgcolor: DS.field, overflow: 'hidden' }}>
                  <Box sx={{
                    height: '100%', borderRadius: '7px',
                    width: `${(d.noPeriodo / maxPeriodo) * 100}%`,
                    background: `linear-gradient(90deg, ${d.cor}bb, ${d.cor})`,
                    transition: 'width 0.7s cubic-bezier(0.16,1,0.3,1)',
                    boxShadow: lider?.designer === d.designer ? `0 0 12px ${d.cor}66` : 'none',
                  }} />
                </Box>
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6 }}>
            {lider ? (
              <>
                <LocalFireDepartmentIcon sx={{ fontSize: 16, color: lider.cor }} />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: DS.t1 }}>
                  {getDisplayName(lider.designer)} está {diff} {diff === 1 ? 'arte' : 'artes'} na frente
                </Typography>
              </>
            ) : (
              <>
                <BoltIcon sx={{ fontSize: 16, color: DS.amber }} />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: DS.t1 }}>
                  Empate! {dados[0].noPeriodo} x {dados[1].noPeriodo}
                </Typography>
              </>
            )}
          </Box>
        </Paper>
      )}

      {/* ── Bloco 2: Cartões por designer ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: mostrados.length > 1 ? '1fr 1fr' : '1fr' }, gap: 2, mb: 2 }}>
        {dados.map(d => (
          <Paper key={d.designer} sx={{
            p: 2.2, borderRadius: 3, border: `1px solid ${d.cor}33`,
            background: `linear-gradient(135deg, ${d.cor}0e, ${DS.surface} 60%)`,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.6 }}>
              <Box sx={{
                width: 34, height: 34, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${d.cor}1e`, border: `1px solid ${d.cor}44`, fontSize: '1rem',
              }}>
                {NAME_MAP[d.designer]?.emoji}
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: DS.t1, lineHeight: 1.1 }}>
                  {getDisplayName(d.designer)}
                </Typography>
                <Typography sx={{ fontSize: '0.62rem', color: DS.t3 }}>Design</Typography>
              </Box>
              <Box sx={{ ml: 'auto', textAlign: 'right' }}>
                <Numero valor={d.noPeriodo} cor={d.cor} />
                <Typography sx={{ fontSize: '0.58rem', color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  aprovadas · {janela.label.toLowerCase()}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <MiniStat rotulo="Hoje" valor={d.resumo.aprovadasHoje} />
              <MiniStat rotulo="Semana" valor={d.resumo.aprovadasSemana} />
              <MiniStat rotulo="Mês" valor={d.resumo.aprovadasMes} />
              <MiniStat rotulo="Aguardando" valor={d.resumo.aguardando} cor={DS.amber} />
              <MiniStat rotulo="Em correção" valor={d.resumo.correcao} cor={DS.red} />
            </Box>
          </Paper>
        ))}
      </Box>

      {/* ── Bloco 3: Produção diária ── */}
      <GraficoDiario dados={dados} janela={janela} />

      {/* ── Bloco 4: Por cliente ── */}
      <PorCliente dados={dados} janela={janela} />

      {/* ── Bloco 5: Auditoria das artes aprovadas ── */}
      <Paper sx={{ p: { xs: 1.6, md: 2 }, borderRadius: 3, border: `1px solid ${DS.border}` }}>
        <Box
          {...clickable(() => setAuditoriaAberta(v => !v))}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', mb: auditoriaAberta ? 1.4 : 0 }}
        >
          <ExpandMoreIcon sx={{ fontSize: 20, color: DS.t2, transition: 'transform 0.2s ease', transform: auditoriaAberta ? 'rotate(180deg)' : 'none' }} />
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: DS.t1 }}>
            Artes contabilizadas ({auditoria.length})
          </Typography>
          <Box sx={{ flex: 1 }} />
          <TextField
            select size="small" label="Cliente" value={clienteFiltro}
            onClick={e => e.stopPropagation()}
            onChange={e => setClienteFiltro(e.target.value)} sx={{ minWidth: 150 }}
          >
            <MenuItem value="todos" sx={{ fontSize: '0.8rem' }}>Todos os clientes</MenuItem>
            {clientesDisponiveis.map(c => (
              <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{c}</MenuItem>
            ))}
          </TextField>
        </Box>
        <Collapse in={auditoriaAberta} unmountOnExit>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 0.8fr 1fr auto', gap: 0.5, alignItems: 'center' }}>
            {['Cliente', 'Arte', 'Data', 'Designer', 'Status'].map(h => (
              <Typography key={h} sx={{ fontSize: '0.58rem', fontWeight: 800, color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.07em', pb: 0.5 }}>
                {h}
              </Typography>
            ))}
            {auditoria.length === 0 && (
              <Typography sx={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: DS.t3, py: 2, textAlign: 'center' }}>
                Nenhuma arte aprovada neste período.
              </Typography>
            )}
            {auditoria.map(a => {
              const cfg = STATUS_CONFIG[a.status]
              return (
                <Box key={`${a.designer}-${a.itemId}`} sx={{ display: 'contents' }}>
                  <Cel>{a.cliente}</Cel>
                  <Cel forte>{a.titulo}</Cel>
                  <Cel>{a.aprovadaEm ? new Date(a.aprovadaEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}</Cel>
                  <Cel>{getDisplayName(a.designer)}</Cel>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, py: 0.6 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cfg?.color, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.66rem', color: DS.t2 }} noWrap>{cfg?.shortLabel}</Typography>
                  </Box>
                </Box>
              )
            })}
          </Box>
        </Collapse>
      </Paper>
    </Box>
  )
}

function Cel({ children, forte }: { children: ReactNode; forte?: boolean }) {
  return (
    <Typography sx={{ fontSize: '0.72rem', color: forte ? DS.t1 : DS.t2, fontWeight: forte ? 600 : 400, py: 0.6, borderTop: `1px solid ${DS.border}` }} noWrap>
      {children}
    </Typography>
  )
}

function MiniStat({ rotulo, valor, cor }: { rotulo: string; valor: number; cor?: string }) {
  return (
    <Box sx={{ px: 1.1, py: 0.7, borderRadius: '9px', bgcolor: DS.field, border: `1px solid ${DS.border}`, minWidth: 68 }}>
      <Typography sx={{ fontSize: '0.55rem', color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.2 }}>{rotulo}</Typography>
      <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: cor ?? DS.t1, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{valor}</Typography>
    </Box>
  )
}

/** Barras diárias — cada dia do período, uma barra fina por designer. */
function GraficoDiario({ dados, janela }: { dados: { designer: string; cor: string; artes: ArteDesigner[] }[]; janela: Janela }) {
  const dias = Math.min(45, Math.max(1, janela.dias))
  const series = dados.map(d => ({
    designer: d.designer, cor: d.cor,
    serie: serieDiariaAprovadas(d.artes, new Date(janela.fim), dias),
  }))
  const pico = Math.max(1, ...series.flatMap(s => s.serie.map(x => x.n)))
  const nDias = series[0]?.serie.length ?? 0
  if (nDias === 0) return null

  const nomeDia = (chave: string) => {
    const [a, m, dd] = chave.split('-').map(Number)
    return new Date(a, m - 1, dd).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <Paper sx={{ p: { xs: 1.6, md: 2.2 }, mb: 2, borderRadius: 3, border: `1px solid ${DS.border}` }}>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: DS.t2, textTransform: 'uppercase', letterSpacing: '0.09em', mb: 1.4 }}>
        Produção diária
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 96, overflowX: 'auto', pb: 0.5 }}>
        {Array.from({ length: nDias }).map((_, i) => {
          const chave = series[0].serie[i].dia
          return (
            <Tooltip key={chave} title={`${nomeDia(chave)} · ${series.map(s => `${getDisplayName(s.designer)}: ${s.serie[i].n}`).join(' · ')}`}>
              <Box sx={{ flex: '1 0 14px', minWidth: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.2, height: 76 }}>
                  {series.map(s => {
                    const n = s.serie[i].n
                    return (
                      <Box key={s.designer} sx={{
                        width: series.length > 1 ? 5 : 10, borderRadius: '3px 3px 1px 1px',
                        height: n === 0 ? 2 : `${Math.max(8, (n / pico) * 100)}%`,
                        bgcolor: n === 0 ? DS.border : s.cor,
                        transition: 'height 0.4s cubic-bezier(0.16,1,0.3,1)',
                      }} />
                    )
                  })}
                </Box>
                {nDias <= 16 && (
                  <Typography sx={{ fontSize: '0.5rem', color: DS.t4, transform: 'rotate(0deg)' }}>{chave.slice(8)}</Typography>
                )}
              </Box>
            </Tooltip>
          )
        })}
      </Box>
      <Box sx={{ display: 'flex', gap: 1.6, mt: 1.2, justifyContent: 'center' }}>
        {series.map(s => (
          <Box key={s.designer} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: s.cor }} />
            <Typography sx={{ fontSize: '0.66rem', color: DS.t2 }}>{getDisplayName(s.designer)}</Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  )
}

/** Aprovadas por cliente no período, por designer. */
function PorCliente({ dados, janela }: { dados: { designer: string; cor: string; artes: ArteDesigner[] }[]; janela: Janela }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: dados.length > 1 ? '1fr 1fr' : '1fr' }, gap: 2, mb: 2 }}>
      {dados.map(d => {
        const porCliente = porClienteEntre(d.artes, janela.inicio, janela.fim)
        return (
          <Paper key={d.designer} sx={{ p: 2, borderRadius: 3, border: `1px solid ${DS.border}` }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: DS.t2, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.2 }}>
              {getDisplayName(d.designer)} · por cliente
            </Typography>
            {porCliente.length === 0 ? (
              <Typography sx={{ fontSize: '0.72rem', color: DS.t3, py: 1 }}>Nenhuma arte aprovada no período.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                {porCliente.slice(0, 8).map(c => (
                  <Box key={c.cliente} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: '0.74rem', color: DS.t1, flex: 1, minWidth: 0 }} noWrap>{c.cliente}</Typography>
                    <Box sx={{ width: 80, height: 6, borderRadius: '3px', bgcolor: DS.field, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${(c.n / porCliente[0].n) * 100}%`, bgcolor: d.cor, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: d.cor, width: 22, textAlign: 'right' }}>{c.n}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        )
      })}
    </Box>
  )
}
