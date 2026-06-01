import React from 'react'
import {
  Box, Typography, Paper, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, IconButton,
  Tooltip, Stack, Tabs, Tab, Divider, InputAdornment,
} from '@mui/material'
import AttachMoneyIcon    from '@mui/icons-material/AttachMoney'
import LockIcon           from '@mui/icons-material/Lock'
import VisibilityIcon     from '@mui/icons-material/Visibility'
import VisibilityOffIcon  from '@mui/icons-material/VisibilityOff'
import AddIcon            from '@mui/icons-material/Add'
import DeleteIcon         from '@mui/icons-material/Delete'
import EditIcon           from '@mui/icons-material/Edit'
import CheckCircleIcon    from '@mui/icons-material/CheckCircle'
import WarningAmberIcon   from '@mui/icons-material/WarningAmber'
import ErrorIcon          from '@mui/icons-material/Error'
import WhatsAppIcon       from '@mui/icons-material/WhatsApp'
import ChevronLeftIcon    from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon   from '@mui/icons-material/ChevronRight'
import TrendingUpIcon     from '@mui/icons-material/TrendingUp'
import TrendingDownIcon   from '@mui/icons-material/TrendingDown'
import StarIcon           from '@mui/icons-material/Star'
import StarBorderIcon     from '@mui/icons-material/StarBorder'
import SearchIcon         from '@mui/icons-material/Search'
import FilterListIcon     from '@mui/icons-material/FilterList'
import ContentCopyIcon    from '@mui/icons-material/ContentCopy'
import type {
  Client,
  ContentItem,
  ItemState,
  PayStatus,
  MeioPagamento,
  CategoriaEntrada,
  CategoriaSaida,
  CategoriaFixo,
  RecorrenciaEntry,
  CaixaEntrada,
  CaixaSaida,
  CustoFixo,
  FinanceiroMes,
  CaixaEmpresaEntry,
  CaixaEmpresaCategoria,
  CaixaEmpresaTipo,
} from '../types'
import { syncToCloud } from '../lib/storage'
import RentabilidadePanel from './RentabilidadePanel'
import ProjecaoPanel      from './ProjecaoPanel'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function loadFinanceiro2(mk: string): FinanceiroMes {
  try {
    const saved = localStorage.getItem(`sm_financeiro2_${mk}`)
    if (saved) return JSON.parse(saved) as FinanceiroMes
    return { recorrencia: [], entradas: [], saidas: [], custosFixos: [] }
  } catch { return { recorrencia: [], entradas: [], saidas: [], custosFixos: [] } }
}

function saveFinanceiro2(mk: string, data: FinanceiroMes) {
  localStorage.setItem(`sm_financeiro2_${mk}`, JSON.stringify(data))
  syncToCloud(`sm_financeiro2_${mk}`, data)
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })

const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MONTH_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<PayStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pago:     { label: 'Pago',     color: '#00C47A', icon: <CheckCircleIcon  sx={{ fontSize: 13 }} /> },
  pendente: { label: 'Pendente', color: '#FFD700', icon: <WarningAmberIcon sx={{ fontSize: 13 }} /> },
  atrasado: { label: 'Atrasado', color: '#FF4545', icon: <ErrorIcon        sx={{ fontSize: 13 }} /> },
}

const MEIO_LABELS: Record<MeioPagamento, string> = {
  pix: 'PIX', dinheiro: 'Dinheiro', cartao: 'Cartão',
  transferencia: 'Transferência', boleto: 'Boleto',
}

const CAT_ENTRADA_LABELS: Record<CategoriaEntrada, string> = {
  mensalidade: 'Mensalidade', projeto: 'Projeto', consultoria: 'Consultoria',
  trafego: 'Tráfego', design: 'Design', outros: 'Outros',
}

const CAT_SAIDA_LABELS: Record<CategoriaSaida, string> = {
  salario: 'Salário', software: 'Software', imposto: 'Imposto',
  marketing: 'Marketing', equipamento: 'Equipamento', servico: 'Serviço', outros: 'Outros',
}

const CAT_FIXO_LABELS: Record<CategoriaFixo, string> = {
  salario: 'Salário', software: 'Software', imposto: 'Imposto',
  cartao: 'Cartão', ferramenta: 'Ferramenta', assinatura: 'Assinatura',
  internet: 'Internet', aluguel: 'Aluguel', outros: 'Outros',
}

// ── Card style ────────────────────────────────────────────────────────────────

const cardSx = {
  bgcolor: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 2,
  p: { xs: 1.5, md: 2 },
}

// ── StatusChip ────────────────────────────────────────────────────────────────

function StatusBadge({ status, onClick }: { status: PayStatus; onClick?: () => void }) {
  const cfg = STATUS_CFG[status]
  return (
    <Chip
      label={cfg.label}
      size="small"
      icon={<Box sx={{ color: cfg.color, display: 'flex', pl: 0.5 }}>{cfg.icon}</Box>}
      onClick={onClick}
      sx={{
        fontSize: '0.6rem', height: 20, fontWeight: 700,
        bgcolor: `${cfg.color}18`, color: cfg.color,
        border: `1px solid ${cfg.color}40`,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { bgcolor: `${cfg.color}28` } : {},
        '& .MuiChip-icon': { color: cfg.color },
      }}
    />
  )
}

// ── MRR Chart ─────────────────────────────────────────────────────────────────

function MrrChart({ viewDate }: { viewDate: Date }) {
  const months = React.useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d  = new Date(viewDate.getFullYear(), viewDate.getMonth() - 5 + i, 1)
      const mk = getMonthKey(d)
      const data = loadFinanceiro2(mk)
      const mrr = data.recorrencia.reduce((s, e) => s + e.valor, 0)
      const col = data.recorrencia.filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)
      return { mk, label: MONTH_SHORT[d.getMonth()], year: d.getFullYear(), mrr, col, isCurrent: mk === getMonthKey(viewDate) }
    })
  }, [viewDate])

  const maxMrr = Math.max(...months.map(m => m.mrr), 1)
  if (months.every(m => m.mrr === 0)) return null

  return (
    <Paper sx={{ ...cardSx, p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <TrendingUpIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        <Typography variant="caption" fontWeight={700}
          sx={{ textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
          MRR — Últimos 6 meses
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75, height: 72 }}>
        {months.map(m => {
          const pct    = maxMrr > 0 ? (m.mrr / maxMrr) * 64 : 2
          const colPct = m.mrr > 0 ? (m.col / m.mrr) * pct : 0
          return (
            <Tooltip key={m.mk} title={`${m.label}/${m.year}: ${fmt(m.mrr)} | Coletado: ${fmt(m.col)}`}>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default' }}>
                <Box sx={{ width: '100%', position: 'relative', height: `${Math.max(pct, 3)}px` }}>
                  <Box sx={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%',
                    bgcolor: m.isCurrent ? 'rgba(255,144,57,0.25)' : 'rgba(255,255,255,0.08)',
                    borderRadius: '3px 3px 0 0',
                    border: m.isCurrent ? '1px solid rgba(255,144,57,0.5)' : 'none',
                  }} />
                  {m.col > 0 && (
                    <Box sx={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: `${colPct}px`,
                      bgcolor: m.isCurrent ? 'primary.main' : '#00C47A',
                      borderRadius: '3px 3px 0 0',
                      opacity: 0.85,
                    }} />
                  )}
                </Box>
                <Typography sx={{
                  fontSize: '0.52rem', color: m.isCurrent ? 'primary.main' : 'text.secondary',
                  mt: 0.4, fontWeight: m.isCurrent ? 700 : 400,
                }}>
                  {m.label}
                </Typography>
              </Box>
            </Tooltip>
          )
        })}
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>Coletado</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)' }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>MRR contratado</Typography>
        </Box>
      </Box>
    </Paper>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color, prefix,
}: {
  label: string; value: string | number; sub?: string; color: string; prefix?: string
}) {
  return (
    <Paper sx={{
      ...cardSx,
      textAlign: 'center', position: 'relative', overflow: 'hidden',
      '&::before': {
        content: '""', position: 'absolute', top: 0, left: 0, right: 0,
        height: '2px', bgcolor: color, opacity: 0.8,
      },
    }}>
      {prefix && (
        <Typography sx={{ fontSize: '1rem', mb: -0.5 }}>{prefix}</Typography>
      )}
      <Typography sx={{
        fontWeight: 900,
        fontSize: { xs: '0.95rem', md: '1.2rem', xl: '1.5rem' },
        color, lineHeight: 1.2,
      }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary"
        sx={{ fontSize: '0.57rem', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', mt: 0.3 }}>
        {label}
      </Typography>
      {sub && (
        <Typography variant="caption"
          sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.28)' }}>
          {sub}
        </Typography>
      )}
    </Paper>
  )
}

// ── TAB 1: Recorrência ────────────────────────────────────────────────────────

interface RecorrenciaTabProps {
  data: FinanceiroMes
  onChange: (d: FinanceiroMes) => void
  viewDate: Date
  allClients: Client[]
}

const EMPTY_REC: Omit<RecorrenciaEntry, 'id'> = {
  clientName: '',
  valor: 0,
  diaCobranca: 5,
  status: 'pendente',
  meioPagamento: 'pix',
  dataRealPagamento: '',
  observacoes: '',
  phone: '',
  isTemplate: true,
}

function RecorrenciaTabPanel({ data, onChange, viewDate, allClients }: RecorrenciaTabProps) {
  const [search, setSearch]         = React.useState('')
  const [filterStatus, setFilterStatus] = React.useState<PayStatus | 'todos'>('todos')
  const [filterMeio, setFilterMeio]     = React.useState<MeioPagamento | 'todos'>('todos')
  const [editOpen, setEditOpen]         = React.useState(false)
  const [editEntry, setEditEntry]       = React.useState<RecorrenciaEntry | null>(null)
  const [form, setForm]                 = React.useState<Omit<RecorrenciaEntry, 'id'>>(EMPTY_REC)
  const [inlineEdit, setInlineEdit]     = React.useState<{ id: string; field: 'valor' | 'diaCobranca'; value: string } | null>(null)

  const today = new Date()
  const isCurrentMonth = getMonthKey(viewDate) === getMonthKey(today)
  const monthLabel = `${MONTH_FULL[viewDate.getMonth()]} ${viewDate.getFullYear()}`

  // Auto-mark atrasado
  React.useEffect(() => {
    if (!isCurrentMonth) return
    const day = today.getDate()
    let changed = false
    const updated = data.recorrencia.map(e => {
      if (e.status === 'pendente' && e.diaCobranca > 0 && day > e.diaCobranca) {
        changed = true
        return { ...e, status: 'atrasado' as PayStatus }
      }
      return e
    })
    if (changed) onChange({ ...data, recorrencia: updated })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const summary = React.useMemo(() => {
    const r = data.recorrencia
    const total    = r.reduce((s, e) => s + e.valor, 0)
    const pago     = r.filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)
    const pendente = r.filter(e => e.status === 'pendente').reduce((s, e) => s + e.valor, 0)
    const atrasado = r.filter(e => e.status === 'atrasado').reduce((s, e) => s + e.valor, 0)
    const cntPago  = r.filter(e => e.status === 'pago').length
    const cntPend  = r.filter(e => e.status !== 'pago').length
    return { total, pago, pendente, atrasado, cntPago, cntPend }
  }, [data.recorrencia])

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase()
    return data.recorrencia
      .filter(e =>
        (filterStatus === 'todos' || e.status === filterStatus) &&
        (filterMeio === 'todos' || e.meioPagamento === filterMeio) &&
        (q === '' || e.clientName.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const ord: Record<PayStatus, number> = { atrasado: 0, pendente: 1, pago: 2 }
        return ord[a.status] - ord[b.status] || a.diaCobranca - b.diaCobranca
      })
  }, [data.recorrencia, filterStatus, filterMeio, search])

  function openNew() {
    setEditEntry(null)
    setForm(EMPTY_REC)
    setEditOpen(true)
  }

  function openEditEntry(e: RecorrenciaEntry) {
    setEditEntry(e)
    setForm({
      clientName: e.clientName, valor: e.valor, diaCobranca: e.diaCobranca,
      status: e.status, meioPagamento: e.meioPagamento,
      dataRealPagamento: e.dataRealPagamento ?? '',
      observacoes: e.observacoes ?? '', phone: e.phone ?? '',
      isTemplate: e.isTemplate ?? true,
    })
    setEditOpen(true)
  }

  function handleSave() {
    if (!form.clientName) return
    const entry: RecorrenciaEntry = { id: editEntry?.id ?? genId(), ...form }
    const updated = editEntry
      ? data.recorrencia.map(e => e.id === editEntry.id ? entry : e)
      : [...data.recorrencia, entry]
    onChange({ ...data, recorrencia: updated })
    setEditOpen(false)
  }

  function handleDelete(id: string) {
    onChange({ ...data, recorrencia: data.recorrencia.filter(e => e.id !== id) })
  }

  function cycleStatus(e: RecorrenciaEntry) {
    const cycle: PayStatus[] = ['pago', 'pendente', 'atrasado']
    const next = cycle[(cycle.indexOf(e.status) + 1) % cycle.length]
    const updated = data.recorrencia.map(r => r.id === e.id ? { ...r, status: next } : r)
    onChange({ ...data, recorrencia: updated })
  }

  function toggleTemplate(e: RecorrenciaEntry) {
    const updated = data.recorrencia.map(r => r.id === e.id ? { ...r, isTemplate: !r.isTemplate } : r)
    onChange({ ...data, recorrencia: updated })
  }

  function commitInlineEdit() {
    if (!inlineEdit) return
    const updated = data.recorrencia.map(e => {
      if (e.id !== inlineEdit.id) return e
      if (inlineEdit.field === 'valor') return { ...e, valor: Number(inlineEdit.value) || 0 }
      return { ...e, diaCobranca: Number(inlineEdit.value) || 1 }
    })
    onChange({ ...data, recorrencia: updated })
    setInlineEdit(null)
  }

  function buildWa(e: RecorrenciaEntry): string | null {
    if (!e.phone) return null
    const msg = encodeURIComponent(
      `Olá! 😊 Aqui é a *Digital Scale* — passando para lembrar que a mensalidade de *${monthLabel}* ` +
      `(cliente *${e.clientName}*) no valor de *${fmt(e.valor)}* vence no dia *${e.diaCobranca}*. ` +
      `Qualquer dúvida, estamos à disposição! 🚀`
    )
    return `https://wa.me/55${e.phone.replace(/\D/g, '')}?text=${msg}`
  }

  const clientNames = allClients.map(c => c.name)

  const atrasados = data.recorrencia.filter(e => e.status === 'atrasado')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Alerta de inadimplência ─────────────────────────────────────── */}
      {atrasados.length > 0 && (
        <Paper sx={{
          p: 1.5, borderRadius: 2,
          bgcolor: 'rgba(255,69,69,0.06)',
          border: '1px solid rgba(255,69,69,0.25)',
          display: 'flex', flexDirection: 'column', gap: 0.8,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <ErrorIcon sx={{ fontSize: 16, color: '#FF4545' }} />
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#FF4545' }}>
              {atrasados.length} cliente{atrasados.length !== 1 ? 's' : ''} com pagamento atrasado
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
            {atrasados.map(e => {
              const wa = e.phone
                ? `https://wa.me/55${e.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá! Seu pagamento de ${monthLabel} (${fmt(e.valor)}) está em atraso. Podemos regularizar?`)}`
                : null
              return (
                <Chip
                  key={e.id}
                  label={`${e.clientName} · ${fmt(e.valor)}`}
                  size="small"
                  icon={wa ? <WhatsAppIcon sx={{ fontSize: '12px !important', color: '#25D366 !important' }} /> : undefined}
                  component={wa ? 'a' : 'div'}
                  href={wa ?? undefined}
                  target={wa ? '_blank' : undefined}
                  clickable={!!wa}
                  sx={{
                    fontSize: '0.62rem', height: 22, fontWeight: 700,
                    bgcolor: 'rgba(255,69,69,0.12)', color: '#FF8080',
                    border: '1px solid rgba(255,69,69,0.3)',
                    cursor: wa ? 'pointer' : 'default',
                    '&:hover': wa ? { bgcolor: 'rgba(255,69,69,0.2)' } : {},
                    textDecoration: 'none',
                  }}
                />
              )
            })}
          </Box>
        </Paper>
      )}

      {/* KPIs */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', xl: 'repeat(6,1fr)' }, gap: 1 }}>
        <KpiCard label="Total Previsto"    value={fmt(summary.total)}    color="#ff9039" sub={`${data.recorrencia.length} clientes`} />
        <KpiCard label="Total Pago"        value={fmt(summary.pago)}     color="#00C47A" sub={`${summary.cntPago} pagos`} />
        <KpiCard label="Total Pendente"    value={fmt(summary.pendente)} color="#FFD700" />
        <KpiCard label="Total Atrasado"    value={fmt(summary.atrasado)} color="#FF4545" />
        <KpiCard label="Clientes Pagos"    value={summary.cntPago}       color="#00C47A" sub="neste mês" />
        <KpiCard label="Clientes Pendentes" value={summary.cntPend}      color="#FFD700" sub="aguardando" />
      </Box>

      {/* Filters + actions */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small" placeholder="Buscar cliente…"
          value={search} onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment> }}
          sx={{ width: 200, '& .MuiInputBase-root': { fontSize: '0.8rem', height: 32 } }}
        />
        <TextField
          select size="small" value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as PayStatus | 'todos')}
          sx={{ width: 130, '& .MuiInputBase-root': { fontSize: '0.75rem', height: 32 } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><FilterListIcon sx={{ fontSize: 14, color: 'text.secondary' }} /></InputAdornment> }}
        >
          <MenuItem value="todos" sx={{ fontSize: '0.78rem' }}>Todos status</MenuItem>
          {(['pago','pendente','atrasado'] as PayStatus[]).map(s => (
            <MenuItem key={s} value={s} sx={{ fontSize: '0.78rem' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: STATUS_CFG[s].color }} />
                {STATUS_CFG[s].label}
              </Box>
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select size="small" value={filterMeio}
          onChange={e => setFilterMeio(e.target.value as MeioPagamento | 'todos')}
          sx={{ width: 140, '& .MuiInputBase-root': { fontSize: '0.75rem', height: 32 } }}
        >
          <MenuItem value="todos" sx={{ fontSize: '0.78rem' }}>Todos meios</MenuItem>
          {(Object.keys(MEIO_LABELS) as MeioPagamento[]).map(m => (
            <MenuItem key={m} value={m} sx={{ fontSize: '0.78rem' }}>{MEIO_LABELS[m]}</MenuItem>
          ))}
        </TextField>
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openNew}
          sx={{ background: '#F97316', fontWeight: 700, fontSize: '0.72rem', height: 32 }}>
          Novo Cliente
        </Button>
      </Box>

      {/* Table */}
      <Paper sx={{ ...cardSx, p: 0, overflow: 'hidden' }}>
        {/* Header */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: '48px 1fr 100px 110px 100px 110px 1fr 80px',
          px: 1.5, py: 0.75,
          bgcolor: 'rgba(255,255,255,0.04)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          {['Dia', 'Cliente', 'Valor', 'Meio', 'Status', 'Data Pgto', 'Observações', 'Ações'].map(h => (
            <Typography key={h} sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>
              {h}
            </Typography>
          ))}
        </Box>

        {filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
            <AttachMoneyIcon sx={{ fontSize: 36, opacity: 0.15, mb: 1 }} />
            <Typography variant="body2" sx={{ opacity: 0.4 }}>Nenhum registro encontrado</Typography>
          </Box>
        ) : (
          <Stack divider={<Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />}>
            {filtered.map(e => {
              const cfg = STATUS_CFG[e.status]
              const wa  = buildWa(e)
              const isEditing = inlineEdit?.id === e.id

              return (
                <Box
                  key={e.id}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '48px 1fr 100px 110px 100px 110px 1fr 80px',
                    px: 1.5, py: 0.9, alignItems: 'center',
                    bgcolor: e.status === 'atrasado' ? 'rgba(255,69,69,0.04)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                    transition: 'background-color 0.15s',
                  }}
                >
                  {/* Dia */}
                  <Box>
                    {isEditing && inlineEdit?.field === 'diaCobranca' ? (
                      <TextField
                        size="small" type="number" autoFocus
                        value={inlineEdit.value}
                        onChange={ev => setInlineEdit({ ...inlineEdit, value: ev.target.value })}
                        onBlur={commitInlineEdit}
                        onKeyDown={ev => { if (ev.key === 'Enter') commitInlineEdit() }}
                        sx={{ width: 44, '& input': { fontSize: '0.75rem', p: '2px 4px', textAlign: 'center' } }}
                        inputProps={{ min: 1, max: 31 }}
                      />
                    ) : (
                      <Chip
                        label={`${e.diaCobranca}`}
                        size="small"
                        onClick={() => setInlineEdit({ id: e.id, field: 'diaCobranca', value: String(e.diaCobranca) })}
                        sx={{ fontSize: '0.65rem', height: 20, cursor: 'text', bgcolor: 'rgba(255,255,255,0.06)' }}
                      />
                    )}
                  </Box>

                  {/* Cliente */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                    <Tooltip title={e.isTemplate ? 'Recorrente (replica todo mês)' : 'Não recorrente'}>
                      <Box sx={{ color: e.isTemplate ? '#FFD700' : 'rgba(255,255,255,0.2)', display: 'flex', cursor: 'pointer' }}
                        onClick={() => toggleTemplate(e)}>
                        {e.isTemplate ? <StarIcon sx={{ fontSize: 12 }} /> : <StarBorderIcon sx={{ fontSize: 12 }} />}
                      </Box>
                    </Tooltip>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }} noWrap>{e.clientName}</Typography>
                  </Box>

                  {/* Valor */}
                  <Box>
                    {isEditing && inlineEdit?.field === 'valor' ? (
                      <TextField
                        size="small" type="number" autoFocus
                        value={inlineEdit.value}
                        onChange={ev => setInlineEdit({ ...inlineEdit, value: ev.target.value })}
                        onBlur={commitInlineEdit}
                        onKeyDown={ev => { if (ev.key === 'Enter') commitInlineEdit() }}
                        sx={{ width: 90, '& input': { fontSize: '0.75rem', p: '2px 4px' } }}
                      />
                    ) : (
                      <Typography
                        sx={{ fontSize: '0.8rem', fontWeight: 700, cursor: 'text', color: e.valor ? '#fff' : 'rgba(255,255,255,0.25)' }}
                        onClick={() => setInlineEdit({ id: e.id, field: 'valor', value: String(e.valor) })}
                      >
                        {e.valor ? fmt(e.valor) : '—'}
                      </Typography>
                    )}
                  </Box>

                  {/* Meio */}
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{MEIO_LABELS[e.meioPagamento]}</Typography>

                  {/* Status */}
                  <StatusBadge status={e.status} onClick={() => cycleStatus(e)} />

                  {/* Data Pgto */}
                  <Typography sx={{ fontSize: '0.72rem', color: e.dataRealPagamento ? 'text.primary' : 'text.secondary' }}>
                    {e.dataRealPagamento || '—'}
                  </Typography>

                  {/* Observações */}
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }} noWrap>
                    {e.observacoes || '—'}
                  </Typography>

                  {/* Ações */}
                  <Box sx={{ display: 'flex', gap: 0.25 }}>
                    <Tooltip title={wa ? `WhatsApp: ${e.phone}` : 'Sem telefone cadastrado'}>
                      <span>
                        <IconButton size="small" component="a" href={wa ?? undefined} target="_blank"
                          disabled={!wa} sx={{ p: 0.3, color: wa ? '#25D366' : 'rgba(255,255,255,0.15)' }}>
                          <WhatsAppIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => openEditEntry(e)} sx={{ p: 0.3 }}>
                        <EditIcon sx={{ fontSize: 13, color: 'primary.main', opacity: 0.7 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton size="small" onClick={() => handleDelete(e.id)} sx={{ p: 0.3 }}>
                        <DeleteIcon sx={{ fontSize: 13, color: '#FF4545', opacity: 0.5, '&:hover': { opacity: 1 } }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              )
            })}
          </Stack>
        )}
      </Paper>

      {/* MRR Chart */}
      <MrrChart viewDate={viewDate} />

      {/* Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#111', border: '1px solid rgba(255,144,57,0.2)' } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AttachMoneyIcon sx={{ color: 'primary.main', fontSize: 18 }} />
            <Typography fontWeight={700} fontSize="0.95rem">
              {editEntry ? 'Editar Recorrência' : 'Nova Recorrência'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            select label="Cliente" size="small" fullWidth
            value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
          >
            {clientNames.map(n => <MenuItem key={n} value={n} sx={{ fontSize: '0.82rem' }}>{n}</MenuItem>)}
            <MenuItem value="__custom" sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
              — Digitar manualmente —
            </MenuItem>
          </TextField>
          {(form.clientName === '__custom' || !clientNames.includes(form.clientName)) && (
            <TextField
              label="Nome do cliente (manual)" size="small" fullWidth
              value={form.clientName === '__custom' ? '' : form.clientName}
              onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
            />
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Valor (R$)" type="number" size="small" sx={{ flex: 1 }}
              value={form.valor || ''} onChange={e => setForm(f => ({ ...f, valor: Number(e.target.value) }))}
              InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>R$</Typography></InputAdornment> }}
            />
            <TextField
              label="Dia cobrança" type="number" size="small" sx={{ width: 120 }}
              value={form.diaCobranca} onChange={e => setForm(f => ({ ...f, diaCobranca: Number(e.target.value) }))}
              inputProps={{ min: 1, max: 31 }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              select label="Status" size="small" sx={{ flex: 1 }}
              value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as PayStatus }))}
            >
              {(['pago','pendente','atrasado'] as PayStatus[]).map(s => (
                <MenuItem key={s} value={s} sx={{ fontSize: '0.82rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: STATUS_CFG[s].color }} />
                    {STATUS_CFG[s].label}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select label="Meio" size="small" sx={{ flex: 1 }}
              value={form.meioPagamento}
              onChange={e => setForm(f => ({ ...f, meioPagamento: e.target.value as MeioPagamento }))}
            >
              {(Object.keys(MEIO_LABELS) as MeioPagamento[]).map(m => (
                <MenuItem key={m} value={m} sx={{ fontSize: '0.82rem' }}>{MEIO_LABELS[m]}</MenuItem>
              ))}
            </TextField>
          </Box>
          <TextField
            label="Data real do pagamento" type="date" size="small" fullWidth
            value={form.dataRealPagamento}
            onChange={e => setForm(f => ({ ...f, dataRealPagamento: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Telefone WhatsApp (DDD+número)" placeholder="11999998888"
            size="small" fullWidth value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            helperText="Para ativar o botão de cobrança WA"
          />
          <TextField
            label="Observações" multiline rows={2} size="small" fullWidth
            value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Entradas recorrentes são copiadas automaticamente ao criar um novo mês">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer' }}
                onClick={() => setForm(f => ({ ...f, isTemplate: !f.isTemplate }))}>
                <Box sx={{ color: form.isTemplate ? '#FFD700' : 'rgba(255,255,255,0.3)', display: 'flex' }}>
                  {form.isTemplate ? <StarIcon sx={{ fontSize: 16 }} /> : <StarBorderIcon sx={{ fontSize: 16 }} />}
                </Box>
                <Typography sx={{ fontSize: '0.78rem', color: form.isTemplate ? '#FFD700' : 'text.secondary' }}>
                  {form.isTemplate ? 'Recorrente (copia todo mês)' : 'Não recorrente'}
                </Typography>
              </Box>
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button size="small" variant="contained" onClick={handleSave}
            disabled={!form.clientName || form.clientName === '__custom'}
            sx={{ background: '#F97316', fontWeight: 700 }}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// ── TAB 2: Caixa Giro ─────────────────────────────────────────────────────────

interface CaixaGiroProps {
  data: FinanceiroMes
  onChange: (d: FinanceiroMes) => void
  viewDate: Date
}

type CaixaSection = 'entradas' | 'saidas' | 'fixos'

const EMPTY_ENTRADA: Omit<CaixaEntrada, 'id'> = {
  data: todayStr(), descricao: '', clienteOuOrigem: '', valor: 0,
  meioPagamento: 'pix', categoria: 'mensalidade', status: 'recebido', observacoes: '',
}

const EMPTY_SAIDA: Omit<CaixaSaida, 'id'> = {
  data: todayStr(), descricao: '', categoria: 'software', valor: 0,
  meioPagamento: 'pix', status: 'pago', observacoes: '',
}

const EMPTY_FIXO: Omit<CustoFixo, 'id'> = {
  nome: '', categoria: 'software', valor: 0, vencimento: 10,
  status: 'pendente', observacoes: '', isTemplate: true,
}

function CaixaGiroPanel({ data, onChange, viewDate }: CaixaGiroProps) {
  const [section, setSection] = React.useState<CaixaSection>('entradas')
  const [dialogType, setDialogType] = React.useState<CaixaSection | null>(null)
  const [editId, setEditId]         = React.useState<string | null>(null)
  const [fEntrada, setFEntrada]     = React.useState<Omit<CaixaEntrada, 'id'>>(EMPTY_ENTRADA)
  const [fSaida, setFSaida]         = React.useState<Omit<CaixaSaida, 'id'>>(EMPTY_SAIDA)
  const [fFixo, setFFixo]           = React.useState<Omit<CustoFixo, 'id'>>(EMPTY_FIXO)

  const kpis = React.useMemo(() => {
    const recebido = data.entradas.filter(e => e.status === 'recebido').reduce((s, e) => s + e.valor, 0)
    const entradaPend = data.entradas.filter(e => e.status === 'pendente').reduce((s, e) => s + e.valor, 0)
    const despesas = data.saidas.filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)
    const saidaPend = data.saidas.filter(e => e.status === 'pendente').reduce((s, e) => s + e.valor, 0)
    const fixosPago = data.custosFixos.filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)
    const fixosPend = data.custosFixos.filter(e => e.status !== 'pago').reduce((s, e) => s + e.valor, 0)
    const saldo  = recebido - despesas - fixosPago
    const margem = recebido > 0 ? Math.round((saldo / recebido) * 100) : 0
    const pendente = entradaPend + saidaPend + fixosPend
    return { recebido, despesas, fixosPago, saldo, margem, pendente }
  }, [data])

  // ── Entradas actions ──────────────────────────────────────────────────────

  function openEntrada(e?: CaixaEntrada) {
    setEditId(e?.id ?? null)
    setFEntrada(e ? { data: e.data, descricao: e.descricao, clienteOuOrigem: e.clienteOuOrigem, valor: e.valor, meioPagamento: e.meioPagamento, categoria: e.categoria, status: e.status, observacoes: e.observacoes ?? '' } : { ...EMPTY_ENTRADA, data: todayStr() })
    setDialogType('entradas')
  }

  function saveEntrada() {
    const entry: CaixaEntrada = { id: editId ?? genId(), ...fEntrada }
    const updated = editId
      ? data.entradas.map(e => e.id === editId ? entry : e)
      : [...data.entradas, entry]
    onChange({ ...data, entradas: updated })
    setDialogType(null)
  }

  function deleteEntrada(id: string) {
    onChange({ ...data, entradas: data.entradas.filter(e => e.id !== id) })
  }

  function cycleEntradaStatus(e: CaixaEntrada) {
    const next = e.status === 'recebido' ? 'pendente' : 'recebido'
    onChange({ ...data, entradas: data.entradas.map(r => r.id === e.id ? { ...r, status: next } : r) })
  }

  // ── Saídas actions ────────────────────────────────────────────────────────

  function openSaida(e?: CaixaSaida) {
    setEditId(e?.id ?? null)
    setFSaida(e ? { data: e.data, descricao: e.descricao, categoria: e.categoria, valor: e.valor, meioPagamento: e.meioPagamento, status: e.status, observacoes: e.observacoes ?? '' } : { ...EMPTY_SAIDA, data: todayStr() })
    setDialogType('saidas')
  }

  function saveSaida() {
    const entry: CaixaSaida = { id: editId ?? genId(), ...fSaida }
    const updated = editId
      ? data.saidas.map(e => e.id === editId ? entry : e)
      : [...data.saidas, entry]
    onChange({ ...data, saidas: updated })
    setDialogType(null)
  }

  function deleteSaida(id: string) {
    onChange({ ...data, saidas: data.saidas.filter(e => e.id !== id) })
  }

  function cycleSaidaStatus(e: CaixaSaida) {
    const next = e.status === 'pago' ? 'pendente' : 'pago'
    onChange({ ...data, saidas: data.saidas.map(r => r.id === e.id ? { ...r, status: next } : r) })
  }

  // ── Custos Fixos actions ──────────────────────────────────────────────────

  function openFixo(e?: CustoFixo) {
    setEditId(e?.id ?? null)
    setFFixo(e ? { nome: e.nome, categoria: e.categoria, valor: e.valor, vencimento: e.vencimento, status: e.status, observacoes: e.observacoes ?? '', isTemplate: e.isTemplate ?? true } : EMPTY_FIXO)
    setDialogType('fixos')
  }

  function saveFixo() {
    const entry: CustoFixo = { id: editId ?? genId(), ...fFixo }
    const updated = editId
      ? data.custosFixos.map(e => e.id === editId ? entry : e)
      : [...data.custosFixos, entry]
    onChange({ ...data, custosFixos: updated })
    setDialogType(null)
  }

  function deleteFixo(id: string) {
    onChange({ ...data, custosFixos: data.custosFixos.filter(e => e.id !== id) })
  }

  function cycleFixoStatus(e: CustoFixo) {
    const cycle: PayStatus[] = ['pago', 'pendente', 'atrasado']
    const next = cycle[(cycle.indexOf(e.status) + 1) % cycle.length]
    onChange({ ...data, custosFixos: data.custosFixos.map(r => r.id === e.id ? { ...r, status: next } : r) })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const marginColor = kpis.margem >= 40 ? '#00C47A' : kpis.margem >= 15 ? '#FFD700' : '#FF4545'
  const saldoColor  = kpis.saldo >= 0 ? '#00C47A' : '#FF4545'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* KPIs */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', xl: 'repeat(6,1fr)' }, gap: 1 }}>
        <KpiCard label="Receita Total"   value={fmt(kpis.recebido)} color="#00C47A" prefix="💚" />
        <KpiCard label="Despesas"        value={fmt(kpis.despesas)} color="#FF4545" prefix="🔴" />
        <KpiCard label="Custos Fixos"    value={fmt(kpis.fixosPago)} color="#FF9800" prefix="🟡" />
        <KpiCard label="Saldo Final"     value={fmt(kpis.saldo)}    color={saldoColor} prefix="💰" />
        <KpiCard label="Margem"          value={`${kpis.margem}%`}  color={marginColor} prefix="📊" sub={kpis.margem >= 40 ? 'Saudável' : kpis.margem >= 15 ? 'Atenção' : 'Crítico'} />
        <KpiCard label="Pendentes"       value={fmt(kpis.pendente)} color="#FFD700" prefix="⏳" />
      </Box>

      {/* DRE simplificado */}
      {(kpis.recebido > 0 || kpis.despesas > 0 || kpis.fixosPago > 0) && (
        <Paper sx={{ ...cardSx, p: 1.5, background: 'linear-gradient(135deg,rgba(20,20,20,0.9),rgba(14,14,14,0.9))' }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', mb: 1.2 }}>
            DRE — Demonstrativo Simplificado
          </Typography>
          {[
            { label: 'Receita Bruta',           value: kpis.recebido,              indent: 0, color: '#00C47A', bold: true },
            { label: '(−) Despesas variáveis',  value: -kpis.despesas,             indent: 1, color: kpis.despesas > 0 ? '#FF4545' : 'text.secondary', bold: false },
            { label: '(−) Custos fixos',        value: -kpis.fixosPago,            indent: 1, color: kpis.fixosPago > 0 ? '#FF9800' : 'text.secondary', bold: false },
            { label: '= Resultado Operacional', value: kpis.saldo,                 indent: 0, color: kpis.saldo >= 0 ? '#00C47A' : '#FF4545', bold: true },
            { label: 'Margem %',                value: null, pct: kpis.margem,     indent: 0, color: marginColor, bold: false },
          ].map(row => (
            <Box key={row.label} sx={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              pl: row.indent * 2, py: 0.35,
              borderBottom: row.bold ? '1px solid rgba(255,255,255,0.06)' : 'none',
              mb: row.bold ? 0.5 : 0,
            }}>
              <Typography sx={{ fontSize: '0.72rem', color: row.bold ? 'text.primary' : 'text.secondary', fontWeight: row.bold ? 700 : 400 }}>
                {row.label}
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: row.bold ? 800 : 600, color: row.color, fontVariantNumeric: 'tabular-nums' }}>
                {row.value !== null ? fmt(row.value) : `${kpis.margem}%`}
              </Typography>
            </Box>
          ))}
        </Paper>
      )}

      {/* Section tabs */}
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        {([
          { key: 'entradas', label: `💚 Entradas (${data.entradas.length})` },
          { key: 'saidas',   label: `🔴 Saídas (${data.saidas.length})` },
          { key: 'fixos',    label: `🟡 Custos Fixos (${data.custosFixos.length})` },
        ] as { key: CaixaSection; label: string }[]).map(s => (
          <Chip
            key={s.key}
            label={s.label}
            size="small"
            onClick={() => setSection(s.key)}
            sx={{
              fontSize: '0.68rem', cursor: 'pointer', height: 26,
              bgcolor: section === s.key ? 'rgba(255,144,57,0.18)' : 'rgba(255,255,255,0.05)',
              color: section === s.key ? 'primary.main' : 'text.secondary',
              border: '1px solid', fontWeight: section === s.key ? 700 : 400,
              borderColor: section === s.key ? 'rgba(255,144,57,0.4)' : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </Box>

      {/* ── Entradas section ─────────────────────────────────────────────── */}
      {section === 'entradas' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
              💚 Entradas — {fmt(data.entradas.reduce((s, e) => s + e.valor, 0))}
            </Typography>
            <Button size="small" variant="outlined" color="success" startIcon={<AddIcon />}
              onClick={() => openEntrada()}
              sx={{ fontSize: '0.7rem', height: 30 }}>
              Adicionar
            </Button>
          </Box>

          <Paper sx={{ ...cardSx, p: 0, overflow: 'hidden' }}>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 130px 100px 90px 90px 60px',
              px: 1.5, py: 0.75,
              bgcolor: 'rgba(255,255,255,0.04)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}>
              {['Data','Descrição / Origem','Categoria','Valor','Meio','Status','Ações'].map(h => (
                <Typography key={h} sx={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>{h}</Typography>
              ))}
            </Box>
            {data.entradas.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                <Typography variant="body2" sx={{ opacity: 0.4 }}>Nenhuma entrada registrada</Typography>
              </Box>
            ) : (
              <Stack divider={<Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />}>
                {[...data.entradas].sort((a, b) => b.data.localeCompare(a.data)).map(e => (
                  <Box key={e.id} sx={{
                    display: 'grid',
                    gridTemplateColumns: '90px 1fr 130px 100px 90px 90px 60px',
                    px: 1.5, py: 0.8, alignItems: 'center',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                  }}>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{e.data}</Typography>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 600 }} noWrap>{e.descricao}</Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }} noWrap>{e.clienteOuOrigem}</Typography>
                    </Box>
                    <Chip label={CAT_ENTRADA_LABELS[e.categoria]} size="small"
                      sx={{ fontSize: '0.58rem', height: 18, bgcolor: 'rgba(255,255,255,0.06)', justifySelf: 'start' }} />
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#00C47A' }}>{fmt(e.valor)}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{MEIO_LABELS[e.meioPagamento]}</Typography>
                    <Chip
                      label={e.status === 'recebido' ? 'Recebido' : 'Pendente'}
                      size="small"
                      onClick={() => cycleEntradaStatus(e)}
                      sx={{
                        fontSize: '0.6rem', height: 20, cursor: 'pointer', fontWeight: 700,
                        bgcolor: e.status === 'recebido' ? 'rgba(0,196,122,0.15)' : 'rgba(255,215,0,0.15)',
                        color: e.status === 'recebido' ? '#00C47A' : '#FFD700',
                        border: `1px solid ${e.status === 'recebido' ? 'rgba(0,196,122,0.3)' : 'rgba(255,215,0,0.3)'}`,
                      }}
                    />
                    <Box sx={{ display: 'flex', gap: 0.25 }}>
                      <IconButton size="small" onClick={() => openEntrada(e)} sx={{ p: 0.3 }}>
                        <EditIcon sx={{ fontSize: 13, color: 'primary.main', opacity: 0.7 }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => deleteEntrada(e.id)} sx={{ p: 0.3 }}>
                        <DeleteIcon sx={{ fontSize: 13, color: '#FF4545', opacity: 0.4, '&:hover': { opacity: 1 } }} />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Box>
      )}

      {/* ── Saídas section ───────────────────────────────────────────────── */}
      {section === 'saidas' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
              🔴 Saídas — {fmt(data.saidas.reduce((s, e) => s + e.valor, 0))}
            </Typography>
            <Button size="small" variant="outlined" color="error" startIcon={<AddIcon />}
              onClick={() => openSaida()}
              sx={{ fontSize: '0.7rem', height: 30 }}>
              Adicionar
            </Button>
          </Box>

          <Paper sx={{ ...cardSx, p: 0, overflow: 'hidden' }}>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 130px 100px 90px 90px 60px',
              px: 1.5, py: 0.75,
              bgcolor: 'rgba(255,255,255,0.04)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}>
              {['Data','Descrição','Categoria','Valor','Meio','Status','Ações'].map(h => (
                <Typography key={h} sx={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>{h}</Typography>
              ))}
            </Box>
            {data.saidas.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                <Typography variant="body2" sx={{ opacity: 0.4 }}>Nenhuma saída registrada</Typography>
              </Box>
            ) : (
              <Stack divider={<Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />}>
                {[...data.saidas].sort((a, b) => b.data.localeCompare(a.data)).map(e => (
                  <Box key={e.id} sx={{
                    display: 'grid',
                    gridTemplateColumns: '90px 1fr 130px 100px 90px 90px 60px',
                    px: 1.5, py: 0.8, alignItems: 'center',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                  }}>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{e.data}</Typography>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 600 }} noWrap>{e.descricao}</Typography>
                    <Chip label={CAT_SAIDA_LABELS[e.categoria]} size="small"
                      sx={{ fontSize: '0.58rem', height: 18, bgcolor: 'rgba(255,255,255,0.06)', justifySelf: 'start' }} />
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#FF4545' }}>{fmt(e.valor)}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{MEIO_LABELS[e.meioPagamento]}</Typography>
                    <Chip
                      label={e.status === 'pago' ? 'Pago' : 'Pendente'}
                      size="small"
                      onClick={() => cycleSaidaStatus(e)}
                      sx={{
                        fontSize: '0.6rem', height: 20, cursor: 'pointer', fontWeight: 700,
                        bgcolor: e.status === 'pago' ? 'rgba(0,196,122,0.15)' : 'rgba(255,215,0,0.15)',
                        color: e.status === 'pago' ? '#00C47A' : '#FFD700',
                        border: `1px solid ${e.status === 'pago' ? 'rgba(0,196,122,0.3)' : 'rgba(255,215,0,0.3)'}`,
                      }}
                    />
                    <Box sx={{ display: 'flex', gap: 0.25 }}>
                      <IconButton size="small" onClick={() => openSaida(e)} sx={{ p: 0.3 }}>
                        <EditIcon sx={{ fontSize: 13, color: 'primary.main', opacity: 0.7 }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => deleteSaida(e.id)} sx={{ p: 0.3 }}>
                        <DeleteIcon sx={{ fontSize: 13, color: '#FF4545', opacity: 0.4, '&:hover': { opacity: 1 } }} />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Box>
      )}

      {/* ── Custos Fixos section ──────────────────────────────────────────── */}
      {section === 'fixos' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
              🟡 Custos Fixos — {fmt(data.custosFixos.reduce((s, e) => s + e.valor, 0))}
            </Typography>
            <Button size="small" variant="outlined" startIcon={<AddIcon />}
              onClick={() => openFixo()}
              sx={{ fontSize: '0.7rem', height: 30, borderColor: '#FF9800', color: '#FF9800', '&:hover': { borderColor: '#FF9800', bgcolor: 'rgba(255,152,0,0.08)' } }}>
              Adicionar
            </Button>
          </Box>

          <Paper sx={{ ...cardSx, p: 0, overflow: 'hidden' }}>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: '36px 1fr 130px 100px 60px 90px 60px',
              px: 1.5, py: 0.75,
              bgcolor: 'rgba(255,255,255,0.04)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}>
              {['Dia','Nome','Categoria','Valor','Recor.','Status','Ações'].map(h => (
                <Typography key={h} sx={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>{h}</Typography>
              ))}
            </Box>
            {data.custosFixos.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                <Typography variant="body2" sx={{ opacity: 0.4 }}>Nenhum custo fixo cadastrado</Typography>
              </Box>
            ) : (
              <Stack divider={<Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />}>
                {[...data.custosFixos].sort((a, b) => a.vencimento - b.vencimento).map(e => (
                  <Box key={e.id} sx={{
                    display: 'grid',
                    gridTemplateColumns: '36px 1fr 130px 100px 60px 90px 60px',
                    px: 1.5, py: 0.8, alignItems: 'center',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                  }}>
                    <Chip label={`${e.vencimento}`} size="small"
                      sx={{ fontSize: '0.62rem', height: 18, bgcolor: 'rgba(255,255,255,0.06)' }} />
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 600 }} noWrap>{e.nome}</Typography>
                    <Chip label={CAT_FIXO_LABELS[e.categoria]} size="small"
                      sx={{ fontSize: '0.58rem', height: 18, bgcolor: 'rgba(255,255,255,0.06)', justifySelf: 'start' }} />
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#FF9800' }}>{fmt(e.valor)}</Typography>
                    <Tooltip title={e.isTemplate ? 'Recorrente' : 'Não recorrente'}>
                      <Box sx={{ color: e.isTemplate ? '#FFD700' : 'rgba(255,255,255,0.2)', display: 'flex' }}>
                        {e.isTemplate ? <StarIcon sx={{ fontSize: 14 }} /> : <StarBorderIcon sx={{ fontSize: 14 }} />}
                      </Box>
                    </Tooltip>
                    <StatusBadge status={e.status} onClick={() => cycleFixoStatus(e)} />
                    <Box sx={{ display: 'flex', gap: 0.25 }}>
                      <IconButton size="small" onClick={() => openFixo(e)} sx={{ p: 0.3 }}>
                        <EditIcon sx={{ fontSize: 13, color: 'primary.main', opacity: 0.7 }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => deleteFixo(e.id)} sx={{ p: 0.3 }}>
                        <DeleteIcon sx={{ fontSize: 13, color: '#FF4545', opacity: 0.4, '&:hover': { opacity: 1 } }} />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Box>
      )}

      {/* ── Dialog: Entrada ───────────────────────────────────────────────── */}
      <Dialog open={dialogType === 'entradas'} onClose={() => setDialogType(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#111', border: '1px solid rgba(0,196,122,0.2)' } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography fontWeight={700} fontSize="0.95rem">
            {editId ? 'Editar Entrada' : 'Nova Entrada'}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField label="Data" type="date" size="small" sx={{ flex: 1 }}
              value={fEntrada.data} onChange={e => setFEntrada(f => ({ ...f, data: e.target.value }))}
              InputLabelProps={{ shrink: true }} />
            <TextField label="Valor (R$)" type="number" size="small" sx={{ flex: 1 }}
              value={fEntrada.valor || ''} onChange={e => setFEntrada(f => ({ ...f, valor: Number(e.target.value) }))}
              InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>R$</Typography></InputAdornment> }} />
          </Box>
          <TextField label="Descrição" size="small" fullWidth
            value={fEntrada.descricao} onChange={e => setFEntrada(f => ({ ...f, descricao: e.target.value }))} />
          <TextField label="Cliente / Origem" size="small" fullWidth
            value={fEntrada.clienteOuOrigem} onChange={e => setFEntrada(f => ({ ...f, clienteOuOrigem: e.target.value }))} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField select label="Categoria" size="small" sx={{ flex: 1 }}
              value={fEntrada.categoria} onChange={e => setFEntrada(f => ({ ...f, categoria: e.target.value as CategoriaEntrada }))}>
              {(Object.keys(CAT_ENTRADA_LABELS) as CategoriaEntrada[]).map(c => (
                <MenuItem key={c} value={c} sx={{ fontSize: '0.82rem' }}>{CAT_ENTRADA_LABELS[c]}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Meio" size="small" sx={{ flex: 1 }}
              value={fEntrada.meioPagamento} onChange={e => setFEntrada(f => ({ ...f, meioPagamento: e.target.value as MeioPagamento }))}>
              {(Object.keys(MEIO_LABELS) as MeioPagamento[]).map(m => (
                <MenuItem key={m} value={m} sx={{ fontSize: '0.82rem' }}>{MEIO_LABELS[m]}</MenuItem>
              ))}
            </TextField>
          </Box>
          <TextField select label="Status" size="small" fullWidth
            value={fEntrada.status} onChange={e => setFEntrada(f => ({ ...f, status: e.target.value as 'recebido' | 'pendente' }))}>
            <MenuItem value="recebido" sx={{ fontSize: '0.82rem' }}>Recebido</MenuItem>
            <MenuItem value="pendente" sx={{ fontSize: '0.82rem' }}>Pendente</MenuItem>
          </TextField>
          <TextField label="Observações" multiline rows={2} size="small" fullWidth
            value={fEntrada.observacoes} onChange={e => setFEntrada(f => ({ ...f, observacoes: e.target.value }))} />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setDialogType(null)}>Cancelar</Button>
          <Button size="small" variant="contained" onClick={saveEntrada}
            sx={{ background: '#00C47A', fontWeight: 700 }}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Saída ─────────────────────────────────────────────────── */}
      <Dialog open={dialogType === 'saidas'} onClose={() => setDialogType(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#111', border: '1px solid rgba(255,69,69,0.2)' } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography fontWeight={700} fontSize="0.95rem">
            {editId ? 'Editar Saída' : 'Nova Saída'}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField label="Data" type="date" size="small" sx={{ flex: 1 }}
              value={fSaida.data} onChange={e => setFSaida(f => ({ ...f, data: e.target.value }))}
              InputLabelProps={{ shrink: true }} />
            <TextField label="Valor (R$)" type="number" size="small" sx={{ flex: 1 }}
              value={fSaida.valor || ''} onChange={e => setFSaida(f => ({ ...f, valor: Number(e.target.value) }))}
              InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>R$</Typography></InputAdornment> }} />
          </Box>
          <TextField label="Descrição" size="small" fullWidth
            value={fSaida.descricao} onChange={e => setFSaida(f => ({ ...f, descricao: e.target.value }))} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField select label="Categoria" size="small" sx={{ flex: 1 }}
              value={fSaida.categoria} onChange={e => setFSaida(f => ({ ...f, categoria: e.target.value as CategoriaSaida }))}>
              {(Object.keys(CAT_SAIDA_LABELS) as CategoriaSaida[]).map(c => (
                <MenuItem key={c} value={c} sx={{ fontSize: '0.82rem' }}>{CAT_SAIDA_LABELS[c]}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Meio" size="small" sx={{ flex: 1 }}
              value={fSaida.meioPagamento} onChange={e => setFSaida(f => ({ ...f, meioPagamento: e.target.value as MeioPagamento }))}>
              {(Object.keys(MEIO_LABELS) as MeioPagamento[]).map(m => (
                <MenuItem key={m} value={m} sx={{ fontSize: '0.82rem' }}>{MEIO_LABELS[m]}</MenuItem>
              ))}
            </TextField>
          </Box>
          <TextField select label="Status" size="small" fullWidth
            value={fSaida.status} onChange={e => setFSaida(f => ({ ...f, status: e.target.value as 'pago' | 'pendente' }))}>
            <MenuItem value="pago" sx={{ fontSize: '0.82rem' }}>Pago</MenuItem>
            <MenuItem value="pendente" sx={{ fontSize: '0.82rem' }}>Pendente</MenuItem>
          </TextField>
          <TextField label="Observações" multiline rows={2} size="small" fullWidth
            value={fSaida.observacoes} onChange={e => setFSaida(f => ({ ...f, observacoes: e.target.value }))} />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setDialogType(null)}>Cancelar</Button>
          <Button size="small" variant="contained" onClick={saveSaida}
            sx={{ background: '#FF4545', fontWeight: 700 }}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Custo Fixo ────────────────────────────────────────────── */}
      <Dialog open={dialogType === 'fixos'} onClose={() => setDialogType(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#111', border: '1px solid rgba(255,152,0,0.2)' } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography fontWeight={700} fontSize="0.95rem">
            {editId ? 'Editar Custo Fixo' : 'Novo Custo Fixo'}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField label="Nome" size="small" fullWidth
            value={fFixo.nome} onChange={e => setFFixo(f => ({ ...f, nome: e.target.value }))} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField label="Valor (R$)" type="number" size="small" sx={{ flex: 1 }}
              value={fFixo.valor || ''} onChange={e => setFFixo(f => ({ ...f, valor: Number(e.target.value) }))}
              InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>R$</Typography></InputAdornment> }} />
            <TextField label="Dia vencimento" type="number" size="small" sx={{ width: 130 }}
              value={fFixo.vencimento} onChange={e => setFFixo(f => ({ ...f, vencimento: Number(e.target.value) }))}
              inputProps={{ min: 1, max: 31 }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField select label="Categoria" size="small" sx={{ flex: 1 }}
              value={fFixo.categoria} onChange={e => setFFixo(f => ({ ...f, categoria: e.target.value as CategoriaFixo }))}>
              {(Object.keys(CAT_FIXO_LABELS) as CategoriaFixo[]).map(c => (
                <MenuItem key={c} value={c} sx={{ fontSize: '0.82rem' }}>{CAT_FIXO_LABELS[c]}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Status" size="small" sx={{ flex: 1 }}
              value={fFixo.status} onChange={e => setFFixo(f => ({ ...f, status: e.target.value as PayStatus }))}>
              {(['pago','pendente','atrasado'] as PayStatus[]).map(s => (
                <MenuItem key={s} value={s} sx={{ fontSize: '0.82rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: STATUS_CFG[s].color }} />
                    {STATUS_CFG[s].label}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <TextField label="Observações" multiline rows={2} size="small" fullWidth
            value={fFixo.observacoes} onChange={e => setFFixo(f => ({ ...f, observacoes: e.target.value }))} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer' }}
            onClick={() => setFFixo(f => ({ ...f, isTemplate: !f.isTemplate }))}>
            <Box sx={{ color: fFixo.isTemplate ? '#FFD700' : 'rgba(255,255,255,0.3)', display: 'flex' }}>
              {fFixo.isTemplate ? <StarIcon sx={{ fontSize: 16 }} /> : <StarBorderIcon sx={{ fontSize: 16 }} />}
            </Box>
            <Typography sx={{ fontSize: '0.78rem', color: fFixo.isTemplate ? '#FFD700' : 'text.secondary' }}>
              {fFixo.isTemplate ? 'Recorrente (copia todo mês)' : 'Não recorrente'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setDialogType(null)}>Cancelar</Button>
          <Button size="small" variant="contained" onClick={saveFixo}
            disabled={!fFixo.nome}
            sx={{ background: '#FF9800', fontWeight: 700 }}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// CAIXA EMPRESA
// ══════════════════════════════════════════════════════════════════════════════

const CAT_EMPRESA_LABELS: Record<CaixaEmpresaCategoria, string> = {
  lucro_mes:   'Lucro do Mês',
  aporte:      'Aporte',
  investimento:'Investimento',
  rendimento:  'Rendimento',
  retirada:    'Retirada',
  equipamento: 'Equipamento',
  infra:       'Infraestrutura',
  taxa:        'Taxa',
  imposto:     'Imposto',
  outros:      'Outros',
}

const CAT_ENTRADA: CaixaEmpresaCategoria[] = ['lucro_mes', 'aporte', 'investimento', 'rendimento', 'outros']
const CAT_SAIDA: CaixaEmpresaCategoria[]   = ['retirada', 'equipamento', 'infra', 'taxa', 'imposto', 'outros']

function loadCaixaEmpresa(): CaixaEmpresaEntry[] {
  try {
    const raw = localStorage.getItem('sm_caixa_empresa')
    return raw ? (JSON.parse(raw) as CaixaEmpresaEntry[]) : []
  } catch { return [] }
}

function saveCaixaEmpresa(entries: CaixaEmpresaEntry[]) {
  localStorage.setItem('sm_caixa_empresa', JSON.stringify(entries))
  syncToCloud('sm_caixa_empresa', entries)
}

function CaixaEmpresaPanel() {
  const [entries, setEntries] = React.useState<CaixaEmpresaEntry[]>(loadCaixaEmpresa)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CaixaEmpresaEntry | null>(null)
  const [tipo, setTipo] = React.useState<CaixaEmpresaTipo>('entrada')
  const [valor, setValor] = React.useState('')
  const [data, setData] = React.useState(todayStr())
  const [descricao, setDescricao] = React.useState('')
  const [categoria, setCategoria] = React.useState<CaixaEmpresaCategoria>('lucro_mes')
  const [observacao, setObservacao] = React.useState('')
  const [filterTipo, setFilterTipo] = React.useState<CaixaEmpresaTipo | 'todos'>('todos')

  const totalEntradas = React.useMemo(
    () => entries.filter(e => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0),
    [entries],
  )
  const totalSaidas = React.useMemo(
    () => entries.filter(e => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0),
    [entries],
  )
  const saldo = totalEntradas - totalSaidas

  const filtered = React.useMemo(
    () => [...entries]
      .filter(e => filterTipo === 'todos' || e.tipo === filterTipo)
      .sort((a, b) => b.data.localeCompare(a.data)),
    [entries, filterTipo],
  )

  function openNew() {
    setEditing(null)
    setTipo('entrada')
    setValor('')
    setData(todayStr())
    setDescricao('')
    setCategoria('lucro_mes')
    setObservacao('')
    setOpen(true)
  }

  function openEdit(e: CaixaEmpresaEntry) {
    setEditing(e)
    setTipo(e.tipo)
    setValor(String(e.valor))
    setData(e.data)
    setDescricao(e.descricao)
    setCategoria(e.categoria)
    setObservacao(e.observacao ?? '')
    setOpen(true)
  }

  function handleSave() {
    const v = parseFloat(valor.replace(',', '.'))
    if (!descricao.trim() || isNaN(v) || v <= 0) return
    const entry: CaixaEmpresaEntry = {
      id: editing?.id ?? genId(),
      tipo, valor: v, data, descricao: descricao.trim(),
      categoria,
      ...(observacao.trim() && { observacao: observacao.trim() }),
    }
    const next = editing
      ? entries.map(e => e.id === editing.id ? entry : e)
      : [...entries, entry]
    setEntries(next)
    saveCaixaEmpresa(next)
    setOpen(false)
  }

  function handleDelete(id: string) {
    const next = entries.filter(e => e.id !== id)
    setEntries(next)
    saveCaixaEmpresa(next)
  }

  const catOptions = tipo === 'entrada' ? CAT_ENTRADA : CAT_SAIDA

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3.5 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: { xs: 1, md: 1.5 } }}>
        {[
          { label: 'Total Entradas', value: totalEntradas, color: '#00C47A', icon: <TrendingUpIcon sx={{ fontSize: 18 }} /> },
          { label: 'Total Saídas',   value: totalSaidas,   color: '#FF4545', icon: <TrendingDownIcon sx={{ fontSize: 18 }} /> },
          { label: 'Saldo Atual',    value: saldo,         color: saldo >= 0 ? '#00C47A' : '#FF4545', icon: <AttachMoneyIcon sx={{ fontSize: 18 }} /> },
        ].map(kpi => (
          <Paper key={kpi.label} sx={{
            ...cardSx, p: { xs: 1.5, md: 2 },
            background: `${kpi.color}08`,
            borderColor: `${kpi.color}25`,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.8, color: kpi.color }}>
              {kpi.icon}
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary' }}>
                {kpi.label}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: { xs: '1.2rem', md: '1.5rem', xl: '1.8rem' }, fontWeight: 900, color: kpi.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
              {fmt(kpi.value)}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={openNew}
          variant="contained"
          sx={{
            background: '#F97316',
            color: '#000', fontWeight: 800, fontSize: '0.72rem', borderRadius: 2,
            boxShadow: 'none', '&:hover': { filter: 'brightness(1.08)', boxShadow: 'none' },
          }}
        >
          Nova entrada/saída
        </Button>
        <Box sx={{ flex: 1 }} />
        {(['todos', 'entrada', 'saida'] as const).map(t => (
          <Chip
            key={t}
            label={t === 'todos' ? 'Todos' : t === 'entrada' ? '↑ Entradas' : '↓ Saídas'}
            size="small"
            onClick={() => setFilterTipo(t)}
            sx={{
              fontSize: '0.65rem', height: 24, fontWeight: 600,
              bgcolor: filterTipo === t
                ? t === 'entrada' ? 'rgba(0,196,122,0.18)' : t === 'saida' ? 'rgba(255,69,69,0.18)' : 'rgba(255,144,57,0.18)'
                : 'rgba(255,255,255,0.05)',
              color: filterTipo === t
                ? t === 'entrada' ? '#00C47A' : t === 'saida' ? '#FF4545' : 'primary.main'
                : 'text.secondary',
              border: '1px solid',
              borderColor: filterTipo === t
                ? t === 'entrada' ? 'rgba(0,196,122,0.35)' : t === 'saida' ? 'rgba(255,69,69,0.35)' : 'rgba(255,144,57,0.35)'
                : 'rgba(255,255,255,0.1)',
              cursor: 'pointer',
            }}
          />
        ))}
      </Box>

      {/* ── Extrato ───────────────────────────────────────────────────────── */}
      <Paper sx={{ ...cardSx, p: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>
              Nenhum lançamento ainda
            </Typography>
            <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', mt: 0.5 }}>
              Adicione o lucro de cada mês para acompanhar o caixa acumulado
            </Typography>
          </Box>
        ) : (
          filtered.map((e, idx) => (
            <Box
              key={e.id}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: { xs: 1.5, md: 2 }, py: 1.2,
                borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                transition: 'background 0.15s',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.025)' },
                position: 'relative',
                '&::before': {
                  content: '""', position: 'absolute', left: 0, top: '15%', bottom: '15%',
                  width: 2.5, borderRadius: '0 2px 2px 0',
                  bgcolor: e.tipo === 'entrada' ? '#00C47A' : '#FF4545',
                },
              }}
            >
              {/* Type icon */}
              <Box sx={{
                width: 30, height: 30, borderRadius: 1.5, flexShrink: 0,
                bgcolor: e.tipo === 'entrada' ? 'rgba(0,196,122,0.12)' : 'rgba(255,69,69,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {e.tipo === 'entrada'
                  ? <TrendingUpIcon sx={{ fontSize: 15, color: '#00C47A' }} />
                  : <TrendingDownIcon sx={{ fontSize: 15, color: '#FF4545' }} />
                }
              </Box>

              {/* Info */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'text.primary' }} noWrap>
                    {e.descricao}
                  </Typography>
                  <Chip
                    label={CAT_EMPRESA_LABELS[e.categoria]}
                    size="small"
                    sx={{
                      fontSize: '0.55rem', height: 17, fontWeight: 700,
                      bgcolor: 'rgba(255,255,255,0.06)',
                      color: 'text.secondary',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.2 }}>
                  <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>
                    {new Date(e.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Typography>
                  {e.observacao && (
                    <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', fontStyle: 'italic' }} noWrap>
                      · {e.observacao}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Value */}
              <Typography sx={{
                fontSize: { xs: '0.9rem', md: '1rem' }, fontWeight: 900,
                color: e.tipo === 'entrada' ? '#00C47A' : '#FF4545',
                letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', flexShrink: 0,
              }}>
                {e.tipo === 'entrada' ? '+' : '-'}{fmt(e.valor)}
              </Typography>

              {/* Actions */}
              <Box sx={{ display: 'flex', gap: 0.3, flexShrink: 0 }}>
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={() => openEdit(e)}
                    sx={{ p: 0.5, color: 'rgba(255,255,255,0.25)', '&:hover': { color: 'primary.main' } }}>
                    <EditIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Excluir">
                  <IconButton size="small" onClick={() => handleDelete(e.id)}
                    sx={{ p: 0.5, color: 'rgba(255,255,255,0.25)', '&:hover': { color: '#FF4545' } }}>
                    <DeleteIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          ))
        )}
      </Paper>

      {/* ── Dialog ────────────────────────────────────────────────────────── */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3 } }}>
        <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: 800, pb: 1 }}>
          {editing ? 'Editar lançamento' : 'Novo lançamento'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>

          {/* Tipo toggle */}
          <Box sx={{ display: 'flex', borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            {(['entrada', 'saida'] as const).map(t => (
              <Box key={t} onClick={() => { setTipo(t); setCategoria(t === 'entrada' ? 'lucro_mes' : 'retirada') }}
                sx={{
                  flex: 1, py: 1, textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
                  fontSize: '0.82rem', fontWeight: 700,
                  bgcolor: tipo === t ? (t === 'entrada' ? 'rgba(0,196,122,0.18)' : 'rgba(255,69,69,0.18)') : 'transparent',
                  color: tipo === t ? (t === 'entrada' ? '#00C47A' : '#FF4545') : 'rgba(255,255,255,0.35)',
                  borderRight: t === 'entrada' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                }}>
                {t === 'entrada' ? '↑ Entrada' : '↓ Saída'}
              </Box>
            ))}
          </Box>

          <TextField
            label="Descrição"
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            fullWidth size="small"
            placeholder="Ex: Lucro Maio 2026"
          />

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              label="Valor (R$)"
              value={valor}
              onChange={e => setValor(e.target.value)}
              size="small"
              type="number"
              inputProps={{ min: 0, step: '0.01' }}
              InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Data"
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          <TextField
            select label="Categoria"
            value={categoria}
            onChange={e => setCategoria(e.target.value as CaixaEmpresaCategoria)}
            fullWidth size="small">
            {catOptions.map(c => (
              <MenuItem key={c} value={c}>{CAT_EMPRESA_LABELS[c]}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Observação (opcional)"
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            fullWidth size="small" multiline rows={2}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!descricao.trim() || !valor || parseFloat(valor.replace(',', '.')) <= 0}
            variant="contained"
            sx={{
              background: '#F97316',
              color: '#000', fontWeight: 800, fontSize: '0.8rem', borderRadius: 2,
              boxShadow: 'none',
            }}
          >
            {editing ? 'Salvar' : 'Adicionar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// ── Tela de senha ─────────────────────────────────────────────────────────────

const FIN_HASH = btoa('136810') // ofuscação mínima — não é criptografia

function FinanceiroLock({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin]           = React.useState('')
  const [show, setShow]         = React.useState(false)
  const [shake, setShake]       = React.useState(false)
  const [wrong, setWrong]       = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => { setTimeout(() => inputRef.current?.focus(), 120) }, [])

  function attempt() {
    if (btoa(pin) === FIN_HASH) {
      onUnlock()
    } else {
      setWrong(true)
      setShake(true)
      setPin('')
      setTimeout(() => { setShake(false); inputRef.current?.focus() }, 520)
    }
  }

  return (
    <Box sx={{
      minHeight: '72vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      '@keyframes lockShake': {
        '0%,100%': { transform: 'translateX(0)' },
        '18%,54%': { transform: 'translateX(-7px)' },
        '36%,72%': { transform: 'translateX(7px)' },
      },
      '@keyframes lockFadeIn': {
        from: { opacity: 0, transform: 'translateY(14px) scale(0.97)' },
        to:   { opacity: 1, transform: 'translateY(0) scale(1)' },
      },
    }}>
      <Paper sx={{
        p: { xs: 3, md: 4 }, borderRadius: 3, minWidth: 320, maxWidth: 380,
        bgcolor: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)',
        border: `1.5px solid ${wrong ? 'rgba(255,69,69,0.35)' : 'rgba(255,144,57,0.15)'}`,
        boxShadow: '0 16px 56px rgba(0,0,0,0.6)',
        animation: shake
          ? 'lockShake 0.5s ease'
          : 'lockFadeIn 0.32s cubic-bezier(0.16,1,0.3,1)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5,
        transition: 'border-color 0.2s',
      }}>
        {/* Ícone */}
        <Box sx={{
          width: 56, height: 56, borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: wrong
            ? 'rgba(255,69,69,0.12)'
            : 'rgba(249,115,22,0.12)',
          border: `1px solid ${wrong ? 'rgba(255,69,69,0.3)' : 'rgba(255,144,57,0.25)'}`,
          transition: 'all 0.2s',
        }}>
          <LockIcon sx={{ fontSize: 26, color: wrong ? '#FF4545' : 'primary.main' }} />
        </Box>

        {/* Título */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography fontWeight={800} sx={{ fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
            Financeiro
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.4 }}>
            Área restrita — insira a senha para acessar
          </Typography>
        </Box>

        {/* Campo de PIN */}
        <Box sx={{ width: '100%' }}>
          <TextField
            inputRef={inputRef}
            fullWidth
            type={show ? 'text' : 'password'}
            placeholder="••••••"
            value={pin}
            onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 10)); setWrong(false) }}
            onKeyDown={e => e.key === 'Enter' && pin.length > 0 && attempt()}
            error={wrong}
            inputProps={{ inputMode: 'numeric', style: { letterSpacing: show ? '0.18em' : '0.3em', fontSize: '1.1rem', textAlign: 'center' } }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShow(s => !s)} edge="end"
                    sx={{ color: 'text.secondary', p: 0.5, '&:hover': { color: 'primary.main' } }}>
                    {show ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.04)',
                '& fieldset': { borderColor: wrong ? 'rgba(255,69,69,0.5)' : 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: wrong ? 'rgba(255,69,69,0.7)' : 'rgba(255,255,255,0.2)' },
                '&.Mui-focused fieldset': { borderColor: wrong ? '#FF4545' : 'primary.main' },
              },
            }}
          />
          {wrong && (
            <Typography sx={{ fontSize: '0.68rem', color: '#FF4545', mt: 0.8, textAlign: 'center', fontWeight: 600 }}>
              Senha incorreta. Tente novamente.
            </Typography>
          )}
        </Box>

        {/* Botão */}
        <Button
          fullWidth
          disabled={pin.length === 0}
          onClick={attempt}
          sx={{
            background: '#F97316',
            color: '#000', fontWeight: 800, fontSize: '0.82rem',
            borderRadius: 2, py: 1.1, letterSpacing: '0.02em',
            boxShadow: '0 4px 16px rgba(255,144,57,0.28)',
            '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
            '&:disabled': { opacity: 0.35, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' },
            transition: 'all 0.2s',
          }}
        >
          Entrar
        </Button>
      </Paper>
    </Box>
  )
}

// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  allClients: Client[]
  now: Date
  items?: ContentItem[]
  states?: Record<number, ItemState>
}

export default function FinanceiroTab(props: Props) {
  const [unlocked, setUnlocked] = React.useState(false)
  if (!unlocked) return <FinanceiroLock onUnlock={() => setUnlocked(true)} />
  return <FinanceiroContent {...props} />
}

function FinanceiroContent({ allClients, now, items = [], states = {} }: Props) {
  const [viewDate, setViewDate] = React.useState<Date>(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const mk = getMonthKey(viewDate)

  const [data, setData] = React.useState<FinanceiroMes>(() => loadFinanceiro2(mk))
  const [mainTab, setMainTab] = React.useState(0)

  React.useEffect(() => {
    setData(loadFinanceiro2(mk))
  }, [mk])

  const handleChange = React.useCallback((next: FinanceiroMes) => {
    setData(next)
    saveFinanceiro2(mk, next)
  }, [mk])

  function prevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }

  function nextMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  function handleNovoMes() {
    const current = loadFinanceiro2(mk)
    if (
      current.recorrencia.length > 0 ||
      current.entradas.length > 0 ||
      current.saidas.length > 0 ||
      current.custosFixos.length > 0
    ) return // already has data

    // Search last 3 months for templates
    let templates: FinanceiroMes | null = null
    for (let i = 1; i <= 3; i++) {
      const prevDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - i, 1)
      const prevData = loadFinanceiro2(getMonthKey(prevDate))
      if (
        prevData.recorrencia.length > 0 ||
        prevData.custosFixos.length > 0
      ) { templates = prevData; break }
    }

    if (!templates) return

    const fresh: FinanceiroMes = {
      recorrencia: templates.recorrencia
        .filter(e => e.isTemplate)
        .map(e => ({ ...e, id: genId(), status: 'pendente', dataRealPagamento: '' })),
      entradas: [],
      saidas: [],
      custosFixos: templates.custosFixos
        .filter(e => e.isTemplate)
        .map(e => ({ ...e, id: genId(), status: 'pendente' })),
    }

    handleChange(fresh)
  }

  const isCurrentMonth = getMonthKey(viewDate) === getMonthKey(now)
  const monthLabel = `${MONTH_FULL[viewDate.getMonth()]} ${viewDate.getFullYear()}`
  const hasData = data.recorrencia.length > 0 || data.entradas.length > 0 || data.saidas.length > 0 || data.custosFixos.length > 0

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3.5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <AttachMoneyIcon sx={{ color: 'primary.main', fontSize: 22 }} />
        <Typography fontWeight={800} sx={{ fontSize: { xs: '1rem', md: '1.1rem' } }}>Financeiro</Typography>

        {/* Month navigator — hidden on Caixa Empresa and Projeção tabs */}
        {mainTab !== 2 && mainTab !== 4 && (
          <>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.5, ml: 1,
              bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2, px: 1, py: 0.25,
            }}>
              <IconButton size="small" onClick={prevMonth} sx={{ p: 0.3 }}>
                <ChevronLeftIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, minWidth: 140, textAlign: 'center' }}>
                {monthLabel}
              </Typography>
              <IconButton size="small" onClick={nextMonth} sx={{ p: 0.3 }}>
                <ChevronRightIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>

            {isCurrentMonth && (
              <Chip label="Mês atual" size="small"
                sx={{ fontSize: '0.6rem', height: 18, bgcolor: 'rgba(255,144,57,0.15)', color: 'primary.main', border: '1px solid rgba(255,144,57,0.3)' }} />
            )}

            <Box sx={{ flex: 1 }} />

            {!hasData && (
              <Tooltip title="Copia entradas recorrentes do mês anterior marcadas com ⭐">
                <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />}
                  onClick={handleNovoMes}
                  sx={{ fontSize: '0.7rem', height: 30, borderColor: 'rgba(255,144,57,0.4)', color: 'primary.main' }}>
                  Duplicar mês anterior
                </Button>
              </Tooltip>
            )}
          </>
        )}
        {(mainTab === 2 || mainTab === 4) && (
          <Box sx={{ flex: 1 }} />
        )}
      </Box>

      {/* ── Main tabs ───────────────────────────────────────────────────────── */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
        <Tabs
          value={mainTab}
          onChange={(_e, v: number) => setMainTab(v)}
          sx={{
            minHeight: 36,
            '& .MuiTab-root': { fontSize: '0.78rem', minHeight: 36, py: 0.75, fontWeight: 600 },
            '& .Mui-selected': { color: 'primary.main' },
            '& .MuiTabs-indicator': { bgcolor: 'primary.main' },
          }}
        >
          <Tab label="💳 Recorrência" />
          <Tab label="💰 Caixa Giro" />
          <Tab label="🏦 Caixa Empresa" />
          <Tab label="📊 Rentabilidade" />
          <Tab label="📈 Projeção" />
        </Tabs>
      </Box>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      {mainTab === 0 && (
        <RecorrenciaTabPanel
          data={data}
          onChange={handleChange}
          viewDate={viewDate}
          allClients={allClients}
        />
      )}
      {mainTab === 1 && (
        <CaixaGiroPanel
          data={data}
          onChange={handleChange}
          viewDate={viewDate}
        />
      )}
      {mainTab === 2 && (
        <CaixaEmpresaPanel />
      )}
      {mainTab === 3 && (
        <RentabilidadePanel allClients={allClients} items={items} states={states} now={now} />
      )}
      {mainTab === 4 && (
        <ProjecaoPanel now={now} />
      )}
    </Box>
  )
}
