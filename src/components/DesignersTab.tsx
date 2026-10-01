/* DesignersTab — "Entregas do time" (aba 25).

   Era a área só dos designers; em 2026-10-01 (pedido do dono) virou a visão das
   entregas do time inteiro: VÍDEOS do editor e ARTES dos designers, com filtro
   de pessoa, tipo e cliente. Visível só para quem tem `canViewDesignerManagement`.

   A conta é a mesma da produção (`CONTA_POR_ENTREGA`, lib/designerProducao):
   vídeo e arte contam quando quem produziu ENTREGA para a Revisão, um card uma
   vez só, com o dono pelo `autorDoCard`. Aqui é só apresentação.
*/
import { useMemo, useState, useEffect, type ReactNode } from 'react'
import {
  Box, Paper, Typography, Tooltip, Collapse, TextField, MenuItem,
} from '@mui/material'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import GroupsIcon from '@mui/icons-material/Groups'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import BoltIcon from '@mui/icons-material/Bolt'
import type { Client, ContentItem, ItemState } from '../types'
import { STATUS_CONFIG } from '../types'
import {
  artesDoDesigner, resumoDesigner, contarEntre, aprovadasEntre, porClienteEntre,
  serieDiariaAprovadas, CONTA_POR_ENTREGA, TIPOS_VIDEO, type ArteDesigner,
} from '../lib/designerProducao'
import { carregarManuais } from '../lib/producaoEditor'
import { carregarPaineis, carregarAtribuicoes } from '../lib/paineis'
import { membrosDoCargo } from '../lib/access'
import { NAME_MAP, getDisplayName } from '../lib/users'
import { DS, ctaGradient } from '../theme'
import { clickable } from '../shared/a11y'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients?: Client[]
  now: Date
}

/** Uma cor por pessoa — o NAME_MAP deixa quase todos cinza, e aqui é preciso distinguir. */
const CORES_PESSOA = [DS.accent, DS.cyan, DS.green, DS.purple, DS.amber]

type Tipo = 'video' | 'arte'
type TipoFiltro = 'todos' | Tipo
/** Uma entrega com o tipo — vídeo (Reel) ou arte (o resto). */
type Entrega = ArteDesigner & { tipo: Tipo }

/** Quem produz: editor(es) primeiro, depois designers. */
function pessoasDoTime(): string[] {
  const editores = membrosDoCargo('editor')
  const designers = membrosDoCargo('design').sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
  return [...editores, ...designers]
}

const ehEditor = (u: string) => membrosDoCargo('editor').includes(u)
const funcaoDe = (u: string) => (ehEditor(u) ? 'Vídeo' : 'Design')

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

const TIPOS: { key: TipoFiltro; rotulo: string }[] = [
  { key: 'todos', rotulo: 'Tudo' },
  { key: 'video', rotulo: 'Vídeos' },
  { key: 'arte', rotulo: 'Artes' },
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

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Box {...clickable(onClick)} aria-pressed={ativo} sx={{
      px: 1.2, py: 0.55, borderRadius: '8px', cursor: 'pointer',
      fontSize: { xs: '0.68rem', xl: '0.76rem' }, fontWeight: 700,
      color: ativo ? DS.onAccent : DS.t3,
      background: ativo ? ctaGradient(90) : DS.field,
      border: `1px solid ${ativo ? 'transparent' : DS.border}`,
      transition: 'all 0.18s ease', '&:hover': { color: ativo ? DS.onAccent : DS.t1 },
    }}>
      {children}
    </Box>
  )
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export default function DesignersTab({ items, states, now }: Props) {
  const [periodo, setPeriodo] = useState<PeriodoKey>('mes')
  const [de, setDe] = useState(() => inputDoDia(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [ate, setAte] = useState(() => inputDoDia(now))
  const [pessoaFiltro, setPessoaFiltro] = useState<'todos' | string>('todos')
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos')
  const [clienteFiltro, setClienteFiltro] = useState<'todos' | string>('todos')
  const [auditoriaAberta, setAuditoriaAberta] = useState(false)

  const paineis = useMemo(() => carregarPaineis(), [])
  const atrib = useMemo(() => carregarAtribuicoes(), [])
  const pessoas = useMemo(() => pessoasDoTime(), [])

  const janela = useMemo(() => janelaDoPeriodo(periodo, now, de, ate), [periodo, now, de, ate])

  // Tipo de cada card: Reel é vídeo, o resto é arte. Registro manual (sem card)
  // segue a função de quem lançou.
  const tipoDoItem = useMemo(() => {
    const m = new Map<number, Tipo>()
    for (const it of items) m.set(it.i, TIPOS_VIDEO.has(it.tp) ? 'video' : 'arte')
    return m
  }, [items])

  // Tudo de cada pessoa, já com tipo — os filtros de tipo e cliente cortam daqui.
  const todasPorPessoa = useMemo(() => {
    const manuais = carregarManuais()
    const m: Record<string, Entrega[]> = {}
    for (const p of pessoas) {
      m[p] = artesDoDesigner(items, states, atrib, paineis, p, new Set(), { ...CONTA_POR_ENTREGA, manuais })
        .map(a => ({ ...a, tipo: tipoDoItem.get(a.itemId) ?? (ehEditor(p) ? 'video' : 'arte') }))
    }
    return m
  }, [items, states, atrib, paineis, pessoas, tipoDoItem])

  const dados = useMemo(() => {
    const mostrados = pessoaFiltro === 'todos' ? pessoas : [pessoaFiltro]
    return mostrados.map(p => {
      const artes = (todasPorPessoa[p] ?? []).filter(a =>
        (tipoFiltro === 'todos' || a.tipo === tipoFiltro) && (clienteFiltro === 'todos' || a.cliente === clienteFiltro))
      const doPeriodo = aprovadasEntre(artes, janela.inicio, janela.fim) as Entrega[]
      return {
        designer: p,
        cor: CORES_PESSOA[pessoas.indexOf(p) % CORES_PESSOA.length] || DS.accent,
        artes,
        resumo: resumoDesigner(artes, janela.ref),
        noPeriodo: contarEntre(artes, janela.inicio, janela.fim),
        videos: doPeriodo.filter(a => a.tipo === 'video').length,
        artesN: doPeriodo.filter(a => a.tipo === 'arte').length,
      }
    })
  }, [pessoaFiltro, pessoas, todasPorPessoa, janela, tipoFiltro, clienteFiltro])

  const total = dados.reduce((s, d) => s + d.noPeriodo, 0)
  const totalVideos = dados.reduce((s, d) => s + d.videos, 0)
  const totalArtes = dados.reduce((s, d) => s + d.artesN, 0)

  const ranking = [...dados].sort((a, b) => b.noPeriodo - a.noPeriodo)
  const maxPeriodo = Math.max(1, ...dados.map(d => d.noPeriodo))
  const comparar = dados.length >= 2
  const lider = comparar && ranking[0].noPeriodo > ranking[1].noPeriodo ? ranking[0] : null
  const diff = comparar ? ranking[0].noPeriodo - ranking[1].noPeriodo : 0

  const auditoria = useMemo(() => {
    const linhas: Entrega[] = []
    for (const d of dados) linhas.push(...(aprovadasEntre(d.artes, janela.inicio, janela.fim) as Entrega[]))
    return linhas.sort((a, b) => (b.aprovadaEm ?? 0) - (a.aprovadaEm ?? 0))
  }, [dados, janela])

  // Clientes com alguma entrega no período (antes do filtro de cliente, senão a lista some ao escolher).
  const clientesDisponiveis = useMemo(() => {
    const s = new Set<string>()
    for (const p of pessoas) for (const a of aprovadasEntre(todasPorPessoa[p] ?? [], janela.inicio, janela.fim)) s.add(a.cliente)
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [pessoas, todasPorPessoa, janela])

  const unidade = tipoFiltro === 'video' ? ['vídeo', 'vídeos'] : tipoFiltro === 'arte' ? ['arte', 'artes'] : ['entrega', 'entregas']
  const colunasCartoes = dados.length > 2 ? 'repeat(3, 1fr)' : dados.length > 1 ? '1fr 1fr' : '1fr'

  return (
    <Box sx={{ maxWidth: { xs: 1160, xl: 1400 }, mx: 'auto', px: { xs: 0, md: 0.5 }, animation: 'fadeInUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
      {/* ── Cabeçalho ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4, mb: 2 }}>
        <Box sx={{
          width: 42, height: 42, borderRadius: '12px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${DS.accent}14`, border: `1px solid ${DS.accent}44`, color: DS.accent,
        }}>
          <GroupsIcon />
        </Box>
        <Box>
          <Typography sx={{ fontSize: { xs: '1.15rem', md: '1.45rem', xl: '1.7rem' }, fontWeight: 800, color: DS.t1, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Entregas do time
          </Typography>
          <Typography sx={{ fontSize: { xs: '0.72rem', xl: '0.8rem' }, color: DS.t3 }}>
            Vídeos e artes entregues por pessoa — {janela.label}. Conta quando o card é entregue para a Revisão.
          </Typography>
        </Box>
      </Box>

      {/* ── Filtros ── */}
      <Paper sx={{ p: 1.4, mb: 2, display: 'flex', flexDirection: 'column', gap: 1.2, border: `1px solid ${DS.border}`, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
            {PERIODOS.map(p => <Chip key={p.key} ativo={periodo === p.key} onClick={() => setPeriodo(p.key)}>{p.rotulo}</Chip>)}
          </Box>
          {periodo === 'custom' && (
            <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
              <TextField size="small" type="date" label="De" value={de} onChange={e => setDe(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: inputDoDia(now) } }} sx={{ width: 150, '& input': { colorScheme: 'dark' } }} />
              <TextField size="small" type="date" label="Até" value={ate} onChange={e => setAte(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: inputDoDia(now) } }} sx={{ width: 150, '& input': { colorScheme: 'dark' } }} />
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: DS.t3, letterSpacing: '0.08em', mr: 0.4 }}>TIPO</Typography>
            {TIPOS.map(t => <Chip key={t.key} ativo={tipoFiltro === t.key} onClick={() => setTipoFiltro(t.key)}>{t.rotulo}</Chip>)}
          </Box>
          <Box sx={{ flex: 1 }} />
          <TextField select size="small" label="Pessoa" value={pessoaFiltro} onChange={e => setPessoaFiltro(e.target.value)} sx={{ minWidth: 170 }}>
            <MenuItem value="todos" sx={{ fontSize: '0.8rem' }}>Todo o time</MenuItem>
            {pessoas.map(p => (
              <MenuItem key={p} value={p} sx={{ fontSize: '0.8rem' }}>{getDisplayName(p)} · {funcaoDe(p)}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Cliente" value={clienteFiltro} onChange={e => setClienteFiltro(e.target.value)} sx={{ minWidth: 190 }}>
            <MenuItem value="todos" sx={{ fontSize: '0.8rem' }}>Todos os clientes</MenuItem>
            {clientesDisponiveis.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{c}</MenuItem>)}
          </TextField>
        </Box>
      </Paper>

      {/* ── Totais do período ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 1.5, mb: 2 }}>
        {[
          { rotulo: `Total · ${janela.label}`, valor: total },
          { rotulo: 'Vídeos', valor: totalVideos },
          { rotulo: 'Artes', valor: totalArtes },
        ].map(k => (
          <Paper key={k.rotulo} sx={{ p: 2, borderRadius: 3, border: `1px solid ${DS.border}` }}>
            <Typography sx={{ fontSize: { xs: '0.6rem', xl: '0.68rem' }, fontWeight: 800, color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.8 }}>{k.rotulo}</Typography>
            <Numero valor={k.valor} cor={DS.t1} tamanho="2.2rem" />
          </Paper>
        ))}
      </Box>

      {/* ── Ranking (quando há mais de uma pessoa na tela) ── */}
      {comparar && (
        <Paper sx={{ p: { xs: 2, md: 2.6 }, mb: 2, borderRadius: 3, border: `1px solid ${DS.border}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1.8 }}>
            <EmojiEventsIcon sx={{ fontSize: 20, color: DS.accent }} />
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: DS.t2 }}>
              Ranking · {janela.label}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.1, mb: 1.6 }}>
            {ranking.map((d, i) => (
              <Box key={d.designer} sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Typography sx={{ width: 18, fontSize: '0.8rem', fontWeight: 900, color: i === 0 && d.noPeriodo > 0 ? DS.accent : DS.t3, textAlign: 'right' }}>{i + 1}</Typography>
                <Box sx={{ width: { xs: 90, md: 130 }, flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: DS.t1, lineHeight: 1.1 }} noWrap>{getDisplayName(d.designer)}</Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: DS.t3 }}>{funcaoDe(d.designer)}</Typography>
                </Box>
                <Box sx={{ flex: 1, height: 14, borderRadius: '7px', bgcolor: DS.field, overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', borderRadius: '7px', width: `${(d.noPeriodo / maxPeriodo) * 100}%`, background: d.cor, transition: 'width 0.7s cubic-bezier(0.16,1,0.3,1)' }} />
                </Box>
                <Box sx={{ width: { xs: 70, md: 160 }, textAlign: 'right', flexShrink: 0 }}>
                  <Typography component="span" sx={{ fontSize: '1.05rem', fontWeight: 900, color: DS.t1 }}>{d.noPeriodo}</Typography>
                  <Typography component="span" sx={{ display: { xs: 'none', md: 'inline' }, fontSize: '0.62rem', color: DS.t3, ml: 0.8 }}>
                    {plural(d.videos, 'vídeo', 'vídeos')} · {plural(d.artesN, 'arte', 'artes')}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            {lider ? (
              <>
                <LocalFireDepartmentIcon sx={{ fontSize: 16, color: lider.cor }} />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: DS.t1 }}>
                  {getDisplayName(lider.designer)} lidera, {plural(diff, unidade[0], unidade[1])} na frente
                </Typography>
              </>
            ) : (
              <>
                <BoltIcon sx={{ fontSize: 16, color: DS.amber }} />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: DS.t1 }}>
                  {total === 0 ? 'Nenhuma entrega no período ainda.' : `Empate no topo: ${ranking[0].noPeriodo} x ${ranking[1].noPeriodo}`}
                </Typography>
              </>
            )}
          </Box>
        </Paper>
      )}

      {/* ── Cartões por pessoa ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: dados.length > 1 ? '1fr 1fr' : '1fr', lg: colunasCartoes }, gap: 2, mb: 2 }}>
        {dados.map(d => (
          <Paper key={d.designer} sx={{ p: 2.2, borderRadius: 3, border: `1px solid ${d.cor}33`, background: DS.surface }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.6 }}>
              <Box sx={{
                width: 34, height: 34, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${d.cor}1e`, border: `1px solid ${d.cor}44`, fontSize: '0.8rem', fontWeight: 800, color: DS.t1,
              }}>
                {NAME_MAP[d.designer]?.initials}
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: DS.t1, lineHeight: 1.1 }}>{getDisplayName(d.designer)}</Typography>
                <Typography sx={{ fontSize: '0.62rem', color: DS.t3 }}>{funcaoDe(d.designer)}</Typography>
              </Box>
              <Box sx={{ ml: 'auto', textAlign: 'right' }}>
                <Numero valor={d.noPeriodo} cor={d.cor} />
                <Typography sx={{ fontSize: '0.58rem', color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {unidade[1]} · {janela.label.toLowerCase()}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <MiniStat rotulo="Vídeos" valor={d.videos} />
              <MiniStat rotulo="Artes" valor={d.artesN} />
              <MiniStat rotulo="Hoje" valor={d.resumo.aprovadasHoje} />
              <MiniStat rotulo="Semana" valor={d.resumo.aprovadasSemana} />
              <MiniStat rotulo="Mês" valor={d.resumo.aprovadasMes} />
              <MiniStat rotulo="Em ajuste" valor={d.resumo.correcao} cor={DS.red} />
            </Box>
          </Paper>
        ))}
      </Box>

      {/* ── Produção diária ── */}
      <CalendarioDiario dados={dados} janela={janela} now={now}
        onSelectDia={chave => { setDe(chave); setAte(chave); setPeriodo('custom') }} />

      {/* ── Por cliente ── */}
      <PorCliente dados={dados} janela={janela} />

      {/* ── Auditoria ── */}
      <Paper sx={{ p: { xs: 1.6, md: 2 }, borderRadius: 3, border: `1px solid ${DS.border}` }}>
        <Box {...clickable(() => setAuditoriaAberta(v => !v))}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', mb: auditoriaAberta ? 1.4 : 0 }}>
          <ExpandMoreIcon sx={{ fontSize: 20, color: DS.t2, transition: 'transform 0.2s ease', transform: auditoriaAberta ? 'rotate(180deg)' : 'none' }} />
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: DS.t1 }}>
            Entregas contabilizadas ({auditoria.length})
          </Typography>
        </Box>
        <Collapse in={auditoriaAberta} unmountOnExit>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1.1fr 1.6fr 0.6fr 0.7fr 0.9fr auto', gap: 0.5, alignItems: 'center' }}>
            {['Cliente', 'Conteúdo', 'Tipo', 'Data', 'Quem', 'Status'].map(h => (
              <Typography key={h} sx={{ fontSize: '0.58rem', fontWeight: 800, color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.07em', pb: 0.5 }}>{h}</Typography>
            ))}
            {auditoria.length === 0 && (
              <Typography sx={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: DS.t3, py: 2, textAlign: 'center' }}>
                Nenhuma entrega neste período.
              </Typography>
            )}
            {auditoria.map(a => {
              const cfg = STATUS_CONFIG[a.status]
              return (
                <Box key={`${a.designer}-${a.manual ? a.manualId : a.itemId}`} sx={{ display: 'contents' }}>
                  <Cel>{a.cliente}</Cel>
                  <Cel forte>{a.titulo}</Cel>
                  <Cel>{a.tipo === 'video' ? 'Vídeo' : 'Arte'}</Cel>
                  <Cel>{a.aprovadaEm ? new Date(a.aprovadaEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}</Cel>
                  <Cel>{getDisplayName(a.designer)}</Cel>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, py: 0.6 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cfg?.color, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.66rem', color: DS.t2 }} noWrap>{a.manual ? 'Registro manual' : cfg?.shortLabel}</Typography>
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
const DIAS_SEMANA_D = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/**
 * Calendário mensal de produção para a gestão (Testa/Arthur) metrificar por dia:
 * cada célula mostra os números de cada designer naquele dia. Clicar num dia foca
 * a aba inteira (cards, competição, por cliente, auditoria) naquele dia. Navega
 * entre meses de forma independente (‹ ›), seguindo o período quando ele muda.
 */
function CalendarioDiario({ dados, janela, now, onSelectDia }: {
  dados: { designer: string; cor: string; artes: ArteDesigner[] }[]
  janela: Janela
  now: Date
  onSelectDia?: (chave: string) => void
}) {
  const [mesRef, setMesRef] = useState(() => new Date(janela.fim))
  // Segue o período quando ele muda (chip Mês anterior, etc.); clicar num dia não
  // salta de mês porque a data escolhida cai no mês já exibido.
  useEffect(() => { setMesRef(new Date(janela.fim)) }, [janela.fim])

  const ano = mesRef.getFullYear(), mes = mesRef.getMonth()
  const lastDay = new Date(ano, mes + 1, 0).getDate()
  const firstWeekday = new Date(ano, mes, 1).getDay()
  // Série diária de cada designer no mês inteiro (dia 1..último).
  const series = dados.map(d => ({
    designer: d.designer, cor: d.cor,
    serie: serieDiariaAprovadas(d.artes, new Date(ano, mes, lastDay, 12), lastDay),
  }))

  const hojeMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const selMs = janela.dias <= 1 ? new Date(janela.fim).setHours(0, 0, 0, 0) : -1
  const podeAvancar = new Date(ano, mes, 1).getTime() < new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const nomeMes = mesRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const celulas: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: lastDay }, (_, i) => i + 1),
  ]

  const navBtn = {
    width: 28, height: 28, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: DS.t2, border: `1px solid ${DS.border}`, bgcolor: DS.field, cursor: 'pointer',
    '&:hover': { color: DS.t1, borderColor: DS.borderHov },
  } as const

  return (
    <Paper sx={{ p: { xs: 1.6, md: 2.2 }, mb: 2, borderRadius: 3, border: `1px solid ${DS.border}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2, gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: DS.t2, textTransform: 'uppercase', letterSpacing: '0.09em' }}>
          Calendário de produção
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.4 }}>
          {series.map(s => (
            <Box key={s.designer} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: s.cor }} />
              <Typography sx={{ fontSize: '0.64rem', color: DS.t2 }}>{getDisplayName(s.designer)}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Navegação de mês */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box {...clickable(() => setMesRef(new Date(ano, mes - 1, 1)))} aria-label="Mês anterior" sx={navBtn}>‹</Box>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: DS.t1, textTransform: 'capitalize' }}>{nomeMes}</Typography>
        <Box {...clickable(() => podeAvancar && setMesRef(new Date(ano, mes + 1, 1)))} aria-label="Próximo mês"
          sx={{ ...navBtn, opacity: podeAvancar ? 1 : 0.4, cursor: podeAvancar ? 'pointer' : 'default' }}>›</Box>
      </Box>

      {/* Dias da semana */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.6, mb: 0.6 }}>
        {DIAS_SEMANA_D.map(d => (
          <Typography key={d} sx={{ fontSize: '0.56rem', fontWeight: 800, color: DS.t3, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d}</Typography>
        ))}
      </Box>

      {/* Grade do mês */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.6 }}>
        {celulas.map((dia, i) => {
          if (dia === null) return <Box key={`b${i}`} />
          const chave = series[0]?.serie[dia - 1]?.dia ?? ''
          const perDesigner = series.map(s => ({ designer: s.designer, cor: s.cor, n: s.serie[dia - 1]?.n ?? 0 }))
          const total = perDesigner.reduce((a, b) => a + b.n, 0)
          const dMs = new Date(ano, mes, dia).getTime()
          const futuro = dMs > hojeMs
          const hoje = dMs === hojeMs
          const sel = dMs === selMs
          return (
            <Tooltip key={dia} title={perDesigner.map(p => `${getDisplayName(p.designer)}: ${p.n}`).join(' · ')}>
              <Box
                {...(futuro || !onSelectDia ? {} : clickable(() => onSelectDia(chave)))}
                aria-label={`Dia ${dia}, ${total} no total`}
                sx={{
                  minHeight: 66, borderRadius: '10px', p: 0.6,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  cursor: futuro ? 'default' : 'pointer',
                  border: sel ? `1.5px solid ${DS.accent}` : `1px solid ${total > 0 ? `${DS.accent}2e` : DS.border}`,
                  bgcolor: sel ? `${DS.accent}1e` : total > 0 ? `${DS.accent}0c` : DS.field,
                  opacity: futuro ? 0.35 : 1, transition: 'all 0.14s ease',
                  '&:hover': futuro ? undefined : { borderColor: DS.accent, bgcolor: `${DS.accent}16` },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, width: '100%', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '0.66rem', fontWeight: hoje ? 900 : 600, color: sel ? DS.accent : hoje ? DS.t1 : DS.t3, lineHeight: 1 }}>{dia}</Typography>
                  {hoje && <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: DS.green, flexShrink: 0 }} />}
                </Box>
                {total > 0 && (
                  <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                    {/* Total do dia, grande — a métrica que a gestão lê primeiro. */}
                    <Typography sx={{ fontSize: '1.05rem', fontWeight: 900, color: DS.t1, lineHeight: 1 }}>{total}</Typography>
                    {/* Quebra por designer, nas cores deles — só quando há mais de um. */}
                    {perDesigner.length > 1 && (
                      <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'center' }}>
                        {perDesigner.map(p => (
                          <Typography key={p.designer} sx={{ fontSize: '0.62rem', fontWeight: 800, color: p.n > 0 ? p.cor : DS.t4, lineHeight: 1 }}>{p.n}</Typography>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            </Tooltip>
          )
        })}
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
              <Typography sx={{ fontSize: '0.72rem', color: DS.t3, py: 1 }}>Nenhuma entrega no período.</Typography>
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
