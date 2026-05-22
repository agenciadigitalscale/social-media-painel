import { useState, useMemo, useEffect } from 'react'
import {
  Box, Typography, Paper, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Divider,
  IconButton, Tooltip, Stack,
} from '@mui/material'
import AttachMoneyIcon    from '@mui/icons-material/AttachMoney'
import EditIcon           from '@mui/icons-material/Edit'
import CheckCircleIcon    from '@mui/icons-material/CheckCircle'
import WarningAmberIcon   from '@mui/icons-material/WarningAmber'
import ErrorIcon          from '@mui/icons-material/Error'
import WhatsAppIcon       from '@mui/icons-material/WhatsApp'
import FileDownloadIcon   from '@mui/icons-material/FileDownload'
import ChevronLeftIcon    from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon   from '@mui/icons-material/ChevronRight'
import DoneAllIcon        from '@mui/icons-material/DoneAll'
import TrendingUpIcon     from '@mui/icons-material/TrendingUp'
import type { Client } from '../types'
import { syncToCloud } from '../lib/storage'

// ── Types ────────────────────────────────────────────────────────────────────

type PayStatus = 'pago' | 'pendente' | 'atrasado'
type FilterKey = 'todos' | PayStatus

interface FinanceEntry {
  valor:      number
  vencimento: number    // dia do mês
  status:     PayStatus
  notes:      string
  phone?:     string    // WhatsApp de cobrança
}

// ── Storage helpers ──────────────────────────────────────────────────────────

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function skMonth(mk: string) { return `sm_financeiro_${mk}` }

function loadMonth(mk: string): Record<string, FinanceEntry> {
  try {
    const saved = localStorage.getItem(skMonth(mk))
    if (saved) return JSON.parse(saved)
    // migrate legacy key on first call for current month
    const legacy = localStorage.getItem('sm_financeiro')
    if (legacy) {
      const parsed = JSON.parse(legacy) as Record<string, FinanceEntry>
      saveMonth(mk, parsed)
      return parsed
    }
    return {}
  } catch { return {} }
}

function saveMonth(mk: string, data: Record<string, FinanceEntry>) {
  localStorage.setItem(skMonth(mk), JSON.stringify(data))
  syncToCloud(skMonth(mk), data)
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<PayStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pago:     { label: 'Pago',     color: '#00C47A', icon: <CheckCircleIcon  sx={{ fontSize: 14 }} /> },
  pendente: { label: 'Pendente', color: '#FFD700', icon: <WarningAmberIcon sx={{ fontSize: 14 }} /> },
  atrasado: { label: 'Atrasado', color: '#FF4545', icon: <ErrorIcon        sx={{ fontSize: 14 }} /> },
}

const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MONTH_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysFromToday(vencimento: number, viewDate: Date): number {
  const today = new Date()
  const due   = new Date(viewDate.getFullYear(), viewDate.getMonth(), vencimento)
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

function buildWaMessage(clientName: string, entry: FinanceEntry, monthLabel: string): string {
  return encodeURIComponent(
    `Olá! 😊 Aqui é a *Digital Scale* — passando para lembrar que a mensalidade de *${monthLabel}* ` +
    `(cliente *${clientName}*) no valor de *${fmt(entry.valor)}* vence no dia *${entry.vencimento}*. ` +
    `Qualquer dúvida, estamos à disposição! 🚀`
  )
}

// ── MRR Chart ────────────────────────────────────────────────────────────────

interface MrrBarProps {
  viewDate: Date
}

function MrrChart({ viewDate }: MrrBarProps) {
  const months = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(viewDate.getFullYear(), viewDate.getMonth() - 5 + i, 1)
      const mk = getMonthKey(d)
      const data = loadMonth(mk)
      const mrr  = Object.values(data).reduce((s, e) => s + (e.valor || 0), 0)
      const col  = Object.values(data).filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)
      return { mk, label: MONTH_SHORT[d.getMonth()], year: d.getFullYear(), mrr, col, isCurrent: mk === getMonthKey(viewDate) }
    })
  }, [viewDate])

  const maxMrr = Math.max(...months.map(m => m.mrr), 1)

  if (months.every(m => m.mrr === 0)) return null

  return (
    <Paper sx={{ p: 2, border: '1px solid rgba(255,255,255,0.06)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <TrendingUpIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
          MRR — Últimos 6 meses
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75, height: 72 }}>
        {months.map(m => {
          const pct    = maxMrr > 0 ? (m.mrr / maxMrr) * 64 : 2
          const colPct = m.mrr > 0 ? (m.col / m.mrr) * pct : 0
          return (
            <Tooltip
              key={m.mk}
              title={`${m.label}/${m.year}: ${fmt(m.mrr)} | Coletado: ${fmt(m.col)}`}
            >
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default' }}>
                <Box sx={{ width: '100%', position: 'relative', height: `${Math.max(pct, 3)}px` }}>
                  {/* Total bar */}
                  <Box sx={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: '100%',
                    bgcolor: m.isCurrent ? 'rgba(255,144,57,0.25)' : 'rgba(255,255,255,0.08)',
                    borderRadius: '3px 3px 0 0',
                    border: m.isCurrent ? '1px solid rgba(255,144,57,0.5)' : 'none',
                  }} />
                  {/* Collected bar */}
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

// ── History dots (last 3 months) ─────────────────────────────────────────────

function HistoryDots({ clientName, viewDate }: { clientName: string; viewDate: Date }) {
  const dots = useMemo(() =>
    [-2, -1, 0].map(offset => {
      const d  = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1)
      const mk = getMonthKey(d)
      const st = loadMonth(mk)[clientName]?.status ?? null
      return { label: MONTH_SHORT[d.getMonth()], st }
    }), [clientName, viewDate])

  return (
    <Box sx={{ display: 'flex', gap: 0.35, alignItems: 'center' }}>
      {dots.map(({ label, st }) => (
        <Tooltip key={label} title={`${label}: ${st ?? '—'}`}>
          <Box sx={{
            width: 6, height: 6, borderRadius: '50%',
            bgcolor: st === 'pago' ? '#00C47A' : st === 'atrasado' ? '#FF4545' : st === 'pendente' ? '#FFD700' : 'rgba(255,255,255,0.15)',
          }} />
        </Tooltip>
      ))}
    </Box>
  )
}

// ── Days badge ────────────────────────────────────────────────────────────────

function DaysBadge({ entry, viewDate }: { entry: FinanceEntry | undefined; viewDate: Date }) {
  if (!entry?.vencimento || entry.status === 'pago') return null
  const days = daysFromToday(entry.vencimento, viewDate)
  const isCurrentMonth = getMonthKey(viewDate) === getMonthKey(new Date())
  if (!isCurrentMonth) return null

  const color = days < 0 ? '#FF4545' : days <= 3 ? '#FFD700' : '#00C47A'
  const label = days < 0 ? `${Math.abs(days)}d atrasado` : days === 0 ? 'vence hoje' : `vence ${days}d`

  return (
    <Chip
      label={label}
      size="small"
      sx={{ fontSize: '0.52rem', height: 16, bgcolor: `${color}18`, color, border: `1px solid ${color}40`, flexShrink: 0 }}
    />
  )
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props { allClients: Client[] }

export default function FinanceiroTab({ allClients }: Props) {
  const [viewDate, setViewDate] = useState(new Date())
  const mk = getMonthKey(viewDate)

  const [data, setData] = useState<Record<string, FinanceEntry>>(() => loadMonth(mk))
  const [filter, setFilter] = useState<FilterKey>('todos')

  const [editClient, setEditClient] = useState<string | null>(null)
  const [editValor,  setEditValor]  = useState('')
  const [editVenc,   setEditVenc]   = useState('1')
  const [editStatus, setEditStatus] = useState<PayStatus>('pendente')
  const [editNotes,  setEditNotes]  = useState('')
  const [editPhone,  setEditPhone]  = useState('')

  // Load data when month changes
  useEffect(() => {
    setData(loadMonth(mk))
  }, [mk])

  // Auto-mark overdue on mount (current month only)
  useEffect(() => {
    if (getMonthKey(viewDate) !== getMonthKey(new Date())) return
    const today = new Date().getDate()
    const loaded = loadMonth(mk)
    let changed = false
    const updated = { ...loaded }
    Object.entries(loaded).forEach(([client, entry]) => {
      if (entry.status === 'pendente' && entry.vencimento > 0 && today > entry.vencimento) {
        updated[client] = { ...entry, status: 'atrasado' }
        changed = true
      }
    })
    if (changed) { setData(updated); saveMonth(mk, updated) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mk])

  const summary = useMemo(() => {
    const entries  = Object.values(data)
    const total    = entries.reduce((s, e) => s + (e.valor || 0), 0)
    const recebido = entries.filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)
    const pendente = entries.filter(e => e.status === 'pendente').reduce((s, e) => s + e.valor, 0)
    const atrasado = entries.filter(e => e.status === 'atrasado').reduce((s, e) => s + e.valor, 0)
    const taxa     = total > 0 ? Math.round((recebido / total) * 100) : 0
    return { total, recebido, pendente, atrasado, taxa }
  }, [data])

  const sortedClients = useMemo(() => {
    const order: Record<PayStatus, number> = { atrasado: 0, pendente: 1, pago: 2 }
    return [...allClients].sort((a, b) => {
      const sa = data[a.name]?.status ?? 'pendente'
      const sb = data[b.name]?.status ?? 'pendente'
      return order[sa] - order[sb] || a.name.localeCompare(b.name)
    })
  }, [allClients, data])

  const filtered = useMemo(() =>
    filter === 'todos' ? sortedClients : sortedClients.filter(c => (data[c.name]?.status ?? 'pendente') === filter),
    [sortedClients, filter, data])

  const counts = useMemo(() => ({
    pago:     Object.values(data).filter(e => e.status === 'pago').length,
    pendente: Object.values(data).filter(e => e.status === 'pendente').length,
    atrasado: Object.values(data).filter(e => e.status === 'atrasado').length,
  }), [data])

  // ── Actions ──────────────────────────────────────────────────────────────

  function prevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    setFilter('todos')
  }

  function nextMonth() {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)
    if (next <= new Date()) { setViewDate(next); setFilter('todos') }
  }

  const isCurrentMonth = getMonthKey(viewDate) === getMonthKey(new Date())

  function openEdit(clientName: string) {
    const e = data[clientName]
    setEditClient(clientName)
    setEditValor(e ? String(e.valor) : '')
    setEditVenc(e ? String(e.vencimento) : '5')
    setEditStatus(e?.status ?? 'pendente')
    setEditNotes(e?.notes ?? '')
    setEditPhone(e?.phone ?? '')
  }

  function handleSave() {
    if (!editClient) return
    const next: Record<string, FinanceEntry> = {
      ...data,
      [editClient]: {
        valor:      Number(editValor) || 0,
        vencimento: Number(editVenc)  || 1,
        status:     editStatus,
        notes:      editNotes,
        phone:      editPhone,
      },
    }
    setData(next); saveMonth(mk, next); setEditClient(null)
  }

  function quickStatus(clientName: string, st: PayStatus) {
    const base = data[clientName] ?? { valor: 0, vencimento: 1, status: 'pendente', notes: '' }
    const next = { ...data, [clientName]: { ...base, status: st } }
    setData(next); saveMonth(mk, next)
  }

  function markAllPaid() {
    const next = { ...data }
    allClients.forEach(c => {
      const base = next[c.name] ?? { valor: 0, vencimento: 1, status: 'pendente', notes: '' }
      next[c.name] = { ...base, status: 'pago' }
    })
    setData(next); saveMonth(mk, next)
  }

  function exportCSV() {
    const headers = ['Cliente', 'Valor (R$)', 'Dia Vencimento', 'Status', 'Telefone', 'Notas']
    const rows = allClients.map(c => {
      const e = data[c.name]
      return [c.name, e?.valor ?? 0, e?.vencimento ?? '', e?.status ?? 'pendente', e?.phone ?? '', `"${e?.notes ?? ''}"`]
    })
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `financeiro-${mk}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const monthLabel = `${MONTH_FULL[viewDate.getMonth()]} ${viewDate.getFullYear()}`

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3.5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <AttachMoneyIcon sx={{ color: 'primary.main', fontSize: 22 }} />
        <Typography fontWeight={800} sx={{ fontSize: { xs: '1rem', md: '1.1rem' } }}>Financeiro</Typography>

        {/* Month navigator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2, px: 1, py: 0.25 }}>
          <IconButton size="small" onClick={prevMonth} sx={{ p: 0.3 }}>
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, minWidth: 130, textAlign: 'center' }}>
            {monthLabel}
          </Typography>
          <IconButton size="small" onClick={nextMonth} disabled={isCurrentMonth} sx={{ p: 0.3 }}>
            <ChevronRightIcon sx={{ fontSize: 18, opacity: isCurrentMonth ? 0.2 : 1 }} />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Actions */}
        <Tooltip title="Marcar todos como Pago neste mês">
          <Button size="small" variant="outlined" color="success" startIcon={<DoneAllIcon />}
            onClick={markAllPaid} sx={{ fontSize: '0.7rem' }}>
            Marcar todos pago
          </Button>
        </Tooltip>
        <Tooltip title="Exportar CSV">
          <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />}
            onClick={exportCSV} sx={{ fontSize: '0.7rem' }}>
            CSV
          </Button>
        </Tooltip>
      </Box>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', xl: 'repeat(5,1fr)' }, gap: 1 }}>
        {[
          { label: 'MRR Total',       value: fmt(summary.total),    sub: `${allClients.length} clientes`,         color: '#ff9039', num: true },
          { label: 'Coletado',        value: fmt(summary.recebido), sub: `${counts.pago} pagos`,                  color: '#00C47A', num: true },
          { label: 'Pendente',        value: fmt(summary.pendente), sub: `${counts.pendente} clientes`,           color: '#FFD700', num: true },
          { label: 'Em atraso',       value: fmt(summary.atrasado), sub: `${counts.atrasado} clientes`,           color: '#FF4545', num: true },
          { label: 'Taxa de cobrança',value: `${summary.taxa}%`,    sub: summary.taxa >= 80 ? '✅ Saudável' : '⚠️ Atenção', color: summary.taxa >= 80 ? '#00C47A' : summary.taxa >= 50 ? '#FFD700' : '#FF4545', num: false },
        ].map(s => (
          <Paper key={s.label} sx={{
            p: { xs: 1.2, md: 1.8 }, border: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center', position: 'relative', overflow: 'hidden',
            '&::before': {
              content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
              bgcolor: s.color, opacity: 0.7,
            },
          }}>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: '1rem', md: '1.3rem', xl: '1.7rem' }, color: s.color, lineHeight: 1 }}>
              {s.value}
            </Typography>
            <Typography variant="caption" color="text.secondary"
              sx={{ fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', mt: 0.3 }}>
              {s.label}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>
              {s.sub}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* ── MRR Chart ──────────────────────────────────────────────────── */}
      <MrrChart viewDate={viewDate} />

      {/* ── Filter tabs ────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {([
          { key: 'todos',    label: `Todos (${allClients.length})` },
          { key: 'pago',     label: `Pago (${counts.pago})` },
          { key: 'pendente', label: `Pendente (${counts.pendente})` },
          { key: 'atrasado', label: `Atrasado (${counts.atrasado})` },
        ] as { key: FilterKey; label: string }[]).map(f => (
          <Chip
            key={f.key}
            label={f.label}
            size="small"
            onClick={() => setFilter(f.key)}
            sx={{
              fontSize: '0.62rem', cursor: 'pointer',
              bgcolor: filter === f.key
                ? f.key === 'pago' ? 'rgba(0,196,122,0.2)'
                : f.key === 'pendente' ? 'rgba(255,215,0,0.2)'
                : f.key === 'atrasado' ? 'rgba(255,69,69,0.2)'
                : 'rgba(255,144,57,0.2)'
                : 'rgba(255,255,255,0.05)',
              color: filter === f.key
                ? f.key === 'pago' ? '#00C47A'
                : f.key === 'pendente' ? '#FFD700'
                : f.key === 'atrasado' ? '#FF4545'
                : 'primary.main'
                : 'text.secondary',
              border: '1px solid',
              borderColor: filter === f.key ? 'currentColor' : 'rgba(255,255,255,0.1)',
              fontWeight: filter === f.key ? 700 : 400,
            }}
          />
        ))}
      </Box>

      {/* ── Client list ────────────────────────────────────────────────── */}
      <Stack spacing={0.6}>
        {filtered.map(client => {
          const entry = data[client.name]
          const st    = entry?.status ?? 'pendente'
          const cfg   = STATUS_CFG[st]
          const waMsg = entry?.phone
            ? `https://wa.me/55${entry.phone.replace(/\D/g, '')}?text=${buildWaMessage(client.name, entry, monthLabel)}`
            : null

          return (
            <Paper key={client.name} sx={{
              px: { xs: 1, md: 1.5 }, py: 1,
              border: '1px solid',
              borderColor: st === 'atrasado' ? 'rgba(255,69,69,0.3)'
                : st === 'pago' ? 'rgba(0,196,122,0.15)' : 'rgba(255,255,255,0.06)',
              bgcolor: st === 'atrasado' ? 'rgba(255,69,69,0.04)' : 'transparent',
              display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
              transition: 'border-color 0.2s',
              '&:hover': { borderColor: st === 'atrasado' ? 'rgba(255,69,69,0.5)' : 'rgba(255,255,255,0.15)' },
            }}>
              {/* Status icon */}
              <Box sx={{ color: cfg.color, display: 'flex', alignItems: 'center', flexShrink: 0 }}>{cfg.icon}</Box>

              {/* Name */}
              <Typography sx={{ flex: 1, fontSize: { xs: '0.75rem', md: '0.85rem' }, fontWeight: 600, minWidth: 120 }} noWrap>
                {client.name}
              </Typography>

              {/* Valor */}
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: entry?.valor ? '#fff' : 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                {entry?.valor ? fmt(entry.valor) : '—'}
              </Typography>

              {/* Vencimento */}
              {entry?.vencimento ? (
                <Chip label={`Dia ${entry.vencimento}`} size="small" variant="outlined"
                  sx={{ fontSize: '0.52rem', height: 16, color: 'text.secondary', borderColor: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
              ) : null}

              {/* Days badge */}
              <DaysBadge entry={entry} viewDate={viewDate} />

              {/* History dots */}
              <HistoryDots clientName={client.name} viewDate={viewDate} />

              {/* Status chip — click to cycle */}
              <Chip
                label={cfg.label}
                size="small"
                onClick={() => {
                  const cycle: PayStatus[] = ['pago', 'pendente', 'atrasado']
                  quickStatus(client.name, cycle[(cycle.indexOf(st) + 1) % cycle.length])
                }}
                sx={{
                  fontSize: '0.55rem', height: 18, fontWeight: 700, flexShrink: 0,
                  bgcolor: `${cfg.color}18`, color: cfg.color,
                  border: `1px solid ${cfg.color}40`, cursor: 'pointer',
                  '&:hover': { bgcolor: `${cfg.color}30` },
                }}
              />

              {/* WhatsApp button */}
              <Tooltip title={entry?.phone ? `Cobrar via WhatsApp (${entry.phone})` : 'Adicione o telefone no cadastro para cobrar via WA'}>
                <span>
                  <IconButton
                    size="small"
                    component="a"
                    href={waMsg ?? undefined}
                    target="_blank"
                    disabled={!waMsg}
                    sx={{ p: 0.4, color: waMsg ? '#25D366' : 'rgba(255,255,255,0.2)', flexShrink: 0 }}
                  >
                    <WhatsAppIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>

              {/* Edit */}
              <Tooltip title="Editar dados financeiros">
                <IconButton size="small" onClick={() => openEdit(client.name)} sx={{ p: 0.4, flexShrink: 0 }}>
                  <EditIcon sx={{ fontSize: 14, color: 'primary.main', opacity: 0.7 }} />
                </IconButton>
              </Tooltip>
            </Paper>
          )
        })}

        {filtered.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <CheckCircleIcon sx={{ fontSize: 40, opacity: 0.2, mb: 1 }} />
            <Typography variant="body2">Nenhum cliente nesta categoria</Typography>
          </Box>
        )}
      </Stack>

      {/* ── Tip ────────────────────────────────────────────────────────── */}
      <Paper sx={{ p: 1.5, border: '1px solid rgba(255,144,57,0.12)', bgcolor: 'rgba(255,144,57,0.04)' }}>
        <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
          💡 Clique no status para alternar. Configure o telefone de cada cliente para ativar o botão de cobrança WhatsApp. Os dados são salvos separadamente por mês — navegue entre meses com as setas.
        </Typography>
      </Paper>

      {/* ── Edit dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!editClient} onClose={() => setEditClient(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#111', border: '1px solid rgba(255,144,57,0.2)' } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AttachMoneyIcon sx={{ color: 'primary.main', fontSize: 18 }} />
            <Typography fontWeight={700} fontSize="0.95rem">{editClient}</Typography>
            <Chip label={monthLabel} size="small" sx={{ fontSize: '0.6rem', height: 18, ml: 'auto', opacity: 0.6 }} />
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="Valor mensal (R$)" type="number" size="small" fullWidth
            value={editValor} onChange={e => setEditValor(e.target.value)}
            InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, color: 'text.secondary', fontSize: '0.85rem' }}>R$</Typography> }}
          />
          <TextField
            label="Dia de vencimento" type="number" size="small" fullWidth
            value={editVenc} onChange={e => setEditVenc(e.target.value)}
            inputProps={{ min: 1, max: 31 }}
          />
          <TextField
            select label="Status" size="small" fullWidth
            value={editStatus} onChange={e => setEditStatus(e.target.value as PayStatus)}
          >
            {(['pago', 'pendente', 'atrasado'] as PayStatus[]).map(s => (
              <MenuItem key={s} value={s}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_CFG[s].color }} />
                  {STATUS_CFG[s].label}
                </Box>
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Telefone WhatsApp (DDD+número)"
            placeholder="11999998888"
            size="small" fullWidth
            value={editPhone} onChange={e => setEditPhone(e.target.value)}
            helperText="Para ativar o botão de cobrança WA"
          />
          <TextField
            label="Notas (opcional)" multiline rows={2} size="small" fullWidth
            value={editNotes} onChange={e => setEditNotes(e.target.value)}
            placeholder="Observações..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setEditClient(null)}>Cancelar</Button>
          <Button size="small" variant="contained" onClick={handleSave}
            sx={{ background: 'linear-gradient(135deg,#ff9039,#ff5339)', fontWeight: 700 }}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
