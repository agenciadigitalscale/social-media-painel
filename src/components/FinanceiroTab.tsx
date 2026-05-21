import { useState, useMemo, useEffect } from 'react'
import {
  Box, Typography, Paper, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Divider, IconButton,
  Tooltip,
} from '@mui/material'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import EditIcon from '@mui/icons-material/Edit'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ErrorIcon from '@mui/icons-material/Error'
import AddIcon from '@mui/icons-material/Add'
import type { Client } from '../types'
import { syncToCloud } from '../lib/storage'

type PayStatus = 'pago' | 'pendente' | 'atrasado'

interface FinanceEntry {
  valor: number
  vencimento: number   // dia do mês
  status: PayStatus
  notes: string
}

const STORAGE_KEY = 'sm_financeiro'

function loadFinanceiro(): Record<string, FinanceEntry> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}

function saveFinanceiro(data: Record<string, FinanceEntry>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  syncToCloud(STORAGE_KEY, data)
}

interface Props {
  allClients: Client[]
}

const STATUS_CFG: Record<PayStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pago:      { label: 'Pago',     color: '#00C47A', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
  pendente:  { label: 'Pendente', color: '#FFD700', icon: <WarningAmberIcon sx={{ fontSize: 14 }} /> },
  atrasado:  { label: 'Atrasado', color: '#FF4545', icon: <ErrorIcon       sx={{ fontSize: 14 }} /> },
}

export default function FinanceiroTab({ allClients }: Props) {
  const [data, setData] = useState<Record<string, FinanceEntry>>(loadFinanceiro)
  const [editClient, setEditClient] = useState<string | null>(null)
  const [editValor, setEditValor] = useState('')
  const [editVenc, setEditVenc] = useState('1')
  const [editStatus, setEditStatus] = useState<PayStatus>('pendente')
  const [editNotes, setEditNotes] = useState('')

  // Auto-detect overdue on mount: if status is 'pendente' and today's day > vencimento
  useEffect(() => {
    const today = new Date()
    const dayOfMonth = today.getDate()
    const loaded = loadFinanceiro()
    let changed = false
    const updated = { ...loaded }
    Object.entries(loaded).forEach(([client, entry]) => {
      if (entry.status === 'pendente' && entry.vencimento > 0 && dayOfMonth > entry.vencimento) {
        updated[client] = { ...entry, status: 'atrasado' }
        changed = true
      }
    })
    if (changed) {
      setData(updated)
      saveFinanceiro(updated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const summary = useMemo(() => {
    const entries = Object.values(data)
    const total    = entries.reduce((s, e) => s + (e.valor || 0), 0)
    const recebido = entries.filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)
    const pendente = entries.filter(e => e.status === 'pendente').reduce((s, e) => s + e.valor, 0)
    const atrasado = entries.filter(e => e.status === 'atrasado').reduce((s, e) => s + e.valor, 0)
    return { total, recebido, pendente, atrasado }
  }, [data])

  const sorted = useMemo(() =>
    [...allClients].sort((a, b) => {
      const order: Record<PayStatus, number> = { atrasado: 0, pendente: 1, pago: 2 }
      const sa = data[a.name]?.status ?? 'pendente'
      const sb = data[b.name]?.status ?? 'pendente'
      return order[sa] - order[sb]
    }),
    [allClients, data],
  )

  function openEdit(clientName: string) {
    const e = data[clientName]
    setEditClient(clientName)
    setEditValor(e ? String(e.valor) : '')
    setEditVenc(e ? String(e.vencimento) : '1')
    setEditStatus(e?.status ?? 'pendente')
    setEditNotes(e?.notes ?? '')
  }

  function handleSave() {
    if (!editClient) return
    const next = {
      ...data,
      [editClient]: {
        valor: Number(editValor) || 0,
        vencimento: Number(editVenc) || 1,
        status: editStatus,
        notes: editNotes,
      },
    }
    setData(next)
    saveFinanceiro(next)
    setEditClient(null)
  }

  function quickStatus(clientName: string, st: PayStatus) {
    const entry = data[clientName] ?? { valor: 0, vencimento: 1, status: 'pendente', notes: '' }
    const next = { ...data, [clientName]: { ...entry, status: st } }
    setData(next)
    saveFinanceiro(next)
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3.5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AttachMoneyIcon sx={{ color: 'primary.main', fontSize: 22 }} />
        <Typography fontWeight={800} sx={{ fontSize: { xs: '1rem', md: '1.1rem', xl: '1.3rem' } }}>Financeiro</Typography>
        <Chip label={`${allClients.length} clientes`} size="small" variant="outlined" sx={{ fontSize: '0.6rem', ml: 'auto' }} />
      </Box>

      {/* ── Summary cards ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1 }}>
        {[
          { label: 'Receita Total',  value: summary.total,    color: '#ff9039' },
          { label: 'Recebido',       value: summary.recebido, color: '#00C47A' },
          { label: 'Pendente',       value: summary.pendente, color: '#FFD700' },
          { label: 'Em atraso',      value: summary.atrasado, color: '#FF4545' },
        ].map(s => (
          <Paper key={s.label} sx={{ p: { xs: 1.2, md: 1.8 }, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.1rem', md: '1.4rem', xl: '1.9rem' }, color: s.color, lineHeight: 1 }}>
              {fmt(s.value)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {s.label}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* ── Client list ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7 }}>
        <Typography variant="overline" color="primary.main" fontWeight={700} sx={{ letterSpacing: 1, fontSize: '0.62rem' }}>
          Clientes
        </Typography>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

        {sorted.map(client => {
          const entry  = data[client.name]
          const st     = entry?.status ?? 'pendente'
          const cfg    = STATUS_CFG[st]

          return (
            <Paper key={client.name} sx={{
              p: { xs: 1, md: 1.4 },
              border: '1px solid',
              borderColor: st === 'atrasado' ? 'rgba(255,69,69,0.25)' : st === 'pago' ? 'rgba(0,196,122,0.15)' : 'rgba(255,255,255,0.06)',
              bgcolor: st === 'atrasado' ? 'rgba(255,69,69,0.04)' : 'transparent',
              display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
            }}>
              {/* Status icon */}
              <Box sx={{ color: cfg.color, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {cfg.icon}
              </Box>

              {/* Name */}
              <Typography sx={{ flex: 1, fontSize: { xs: '0.75rem', md: '0.85rem', xl: '1rem' }, fontWeight: 600 }} noWrap>
                {client.name}
              </Typography>

              {/* Valor */}
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: entry?.valor ? '#fff' : 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                {entry?.valor ? fmt(entry.valor) : '—'}
              </Typography>

              {/* Vencimento */}
              {entry?.vencimento && (
                <Chip label={`Dia ${entry.vencimento}`} size="small" variant="outlined"
                  sx={{ fontSize: '0.52rem', height: 16, color: 'text.secondary', borderColor: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
              )}

              {/* Status chip */}
              <Chip
                label={cfg.label}
                size="small"
                sx={{
                  fontSize: '0.55rem', height: 18,
                  bgcolor: `${cfg.color}18`,
                  color: cfg.color,
                  border: `1px solid ${cfg.color}40`,
                  fontWeight: 700, flexShrink: 0,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  const next: PayStatus[] = ['pago', 'pendente', 'atrasado']
                  const idx = next.indexOf(st)
                  quickStatus(client.name, next[(idx + 1) % next.length])
                }}
              />

              {/* Edit button */}
              <Tooltip title="Editar dados financeiros">
                <IconButton size="small" onClick={() => openEdit(client.name)} sx={{ p: 0.4, flexShrink: 0 }}>
                  <EditIcon sx={{ fontSize: 14, color: 'primary.main', opacity: 0.7 }} />
                </IconButton>
              </Tooltip>
            </Paper>
          )
        })}
      </Box>

      {/* ── Notes/tip ── */}
      <Paper sx={{ p: 1.5, border: '1px solid rgba(255,144,57,0.12)', bgcolor: 'rgba(255,144,57,0.04)' }}>
        <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
          💡 Clique no status colorido para alternar entre Pago / Pendente / Atrasado. Ao abrir, clientes com pagamento vencido são marcados automaticamente como Atrasado.
        </Typography>
      </Paper>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editClient} onClose={() => setEditClient(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#111', border: '1px solid rgba(255,144,57,0.2)' } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AttachMoneyIcon sx={{ color: 'primary.main', fontSize: 18 }} />
            <Typography fontWeight={700} fontSize="0.95rem">{editClient}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="Valor mensal (R$)"
            type="number"
            value={editValor}
            onChange={e => setEditValor(e.target.value)}
            size="small" fullWidth
            InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, color: 'text.secondary', fontSize: '0.85rem' }}>R$</Typography> }}
          />
          <TextField
            label="Dia de vencimento"
            type="number"
            value={editVenc}
            onChange={e => setEditVenc(e.target.value)}
            size="small" fullWidth
            inputProps={{ min: 1, max: 31 }}
          />
          <TextField
            select label="Status"
            value={editStatus}
            onChange={e => setEditStatus(e.target.value as PayStatus)}
            size="small" fullWidth
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
            label="Notas (opcional)"
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            size="small" fullWidth multiline rows={2}
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
