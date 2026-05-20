import { useState, useMemo } from 'react'
import {
  Box, Typography, Button, Snackbar, Alert,
  Chip, Stack, Paper, Divider, Fab,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, ToggleButton, ToggleButtonGroup,
  CircularProgress, LinearProgress,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ScheduleIcon from '@mui/icons-material/Schedule'
import ChecklistIcon from '@mui/icons-material/Checklist'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff'
import CalendarViewWeekIcon from '@mui/icons-material/CalendarViewWeek'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import type { Client, ContentItem, ContentType, ItemEditPatch, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'
import ContentCard from './ContentCard'
import HintCard from './HintCard'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, s: Status) => void
  onUpdate: (id: number, patch: Partial<ItemState>) => void
  onDelete?: (id: number) => void
  onEdit?: (id: number, patch: ItemEditPatch) => void
  onDuplicate?: (id: number) => void
  onAddItem?: (clientName: string, title: string, type: ContentType, date: Date, status: Status) => void
  clientColors?: Record<string, string>
  clientHashtags?: Record<string, string[]>
  onSaveHashtags?: (clientName: string, tags: string[]) => void
  captionTemplates?: Record<string, string[]>
  onSaveTemplates?: (clientName: string, templates: string[]) => void
  allClients?: Client[]
  now: Date
  currentUser?: string
}

export default function TodayTab({ items, states, onStatusChange, onUpdate, onDelete, onEdit, onDuplicate, onAddItem, clientColors, clientHashtags, onSaveHashtags, captionTemplates, onSaveTemplates, allClients, now, currentUser }: Props) {
  const [copied, setCopied] = useState(false)
  const [weeklyCopied, setWeeklyCopied] = useState(false)
  const [filterClient, setFilterClient] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [addClient, setAddClient] = useState('')
  const [addTitle, setAddTitle] = useState('')
  const [addType, setAddType] = useState<ContentType>('Post')
  const [addDate, setAddDate] = useState(() => new Date().toISOString().split('T')[0])
  const [addStatus, setAddStatus] = useState<Status>(0)
  const [weeklyOpen, setWeeklyOpen] = useState(false)

  const clientOptions = useMemo(() => {
    const fromItems = Array.from(new Set(items.map(i => i.c))).sort()
    const fromClients = (allClients ?? []).map(c => c.name)
    return Array.from(new Set([...fromClients, ...fromItems])).sort()
  }, [items, allClients])

  const handleAddSubmit = () => {
    if (!addClient || !addTitle) return
    onAddItem?.(addClient, addTitle, addType, new Date(addDate + 'T12:00:00'), addStatus)
    setAddOpen(false)
    setAddClient('')
    setAddTitle('')
    setAddType('Post')
    setAddDate(new Date().toISOString().split('T')[0])
    setAddStatus(0)
  }

  const today = useMemo(() => {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d
  }, [now])
  const tomorrow = useMemo(() => new Date(today.getTime() + 86_400_000), [today])

  // v2: "late" = still in internal workflow (status < 4) past due date
  const late      = useMemo(() => items.filter(i => (states[i.i]?.status ?? i.s) < 4 && i.dt < today).sort((a, b) => a.dt.getTime() - b.dt.getTime()), [items, states, today])
  const todayItems = useMemo(() => items.filter(i => i.dt >= today && i.dt < tomorrow), [items, today, tomorrow])
  const dayAfterTomorrow = useMemo(() => new Date(tomorrow.getTime() + 86_400_000), [tomorrow])
  const riskItems = useMemo(() => items.filter(i => {
    const st = states[i.i]?.status ?? i.s
    return i.dt > today && i.dt < dayAfterTomorrow && st < 3
  }), [items, states, today, dayAfterTomorrow])

  const todayDone       = todayItems.filter(i => (states[i.i]?.status ?? i.s) === 7).length
  const todayEditing    = todayItems.filter(i => (states[i.i]?.status ?? i.s) === 1).length
  const todaySentClient = todayItems.filter(i => (states[i.i]?.status ?? i.s) === 4).length
  const todayApproved   = todayItems.filter(i => [2, 3].includes(states[i.i]?.status ?? i.s)).length

  // Clientes silenciosos: têm conteúdo nos últimos 3 dias mas nenhum publicado (v2: status 7)
  const silentClients = useMemo(() => {
    const threeDaysAgo = new Date(today.getTime() - 3 * 86_400_000)
    const byClient = new Map<string, { total: number; published: number }>()
    items.forEach(i => {
      if (i.dt < threeDaysAgo || i.dt >= tomorrow) return
      const cur = byClient.get(i.c) ?? { total: 0, published: 0 }
      cur.total++
      if ((states[i.i]?.status ?? i.s) === 7) cur.published++
      byClient.set(i.c, cur)
    })
    return Array.from(byClient.entries())
      .filter(([, v]) => v.total > 0 && v.published === 0)
      .map(([name, v]) => ({ name, total: v.total }))
  }, [items, states, today, tomorrow])

  // Estatísticas semanais (últimos 7 dias) — v2: publicado = status 7
  const weeklyStats = useMemo(() => {
    const weekStart = new Date(today.getTime() - 6 * 86_400_000)
    const byClient = new Map<string, { planned: number; published: number }>()
    items.forEach(i => {
      if (i.dt < weekStart || i.dt >= tomorrow) return
      const cur = byClient.get(i.c) ?? { planned: 0, published: 0 }
      cur.planned++
      if ((states[i.i]?.status ?? i.s) === 7) cur.published++
      byClient.set(i.c, cur)
    })
    return Array.from(byClient.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, v]) => ({ name, ...v }))
  }, [items, states, today, tomorrow])

  const buildWeeklyReport = () => {
    const weekStart = new Date(today.getTime() - 6 * 86_400_000)
    const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    const total = weeklyStats.reduce((s, c) => s + c.published, 0)
    const planned = weeklyStats.reduce((s, c) => s + c.planned, 0)
    const lines = [
      `*Resumo semanal — ${fmt(weekStart)} a ${fmt(today)}*`,
      `✅ ${total}/${planned} publicados na semana`,
      '',
      ...weeklyStats.map(c => `• ${c.name}: ${c.published}/${c.planned}`),
    ]
    return lines.join('\n')
  }

  const clients = useMemo(() => {
    const set = new Set([...late, ...todayItems].map(i => i.c))
    return Array.from(set).sort()
  }, [late, todayItems])

  const filter = (arr: ContentItem[]) =>
    filterClient ? arr.filter(i => i.c === filterClient) : arr

  const buildReportLines = () => {
    const lines = [
      `*Resumo — ${today.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}*`,
      '',
    ]
    if (late.length) {
      lines.push(`*⚠️ Atrasados (${late.length}):*`)
      late.forEach(i => lines.push(`• ${i.c} — ${i.n} (${i.tp})`))
      lines.push('')
    }
    if (todayItems.length) {
      lines.push(`*📅 Hoje (${todayItems.length}):*`)
      todayItems.forEach(i => {
        const s = states[i.i]?.status ?? i.s
        const label = STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.shortLabel ?? String(s)
        lines.push(`• ${i.c} — ${i.n} (${i.tp}) → ${label}`)
      })
    }
    return lines.join('\n')
  }

  const handleCopyReport = () => {
    navigator.clipboard.writeText(buildReportLines())
    setCopied(true)
  }

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildReportLines())}`, '_blank')
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const batchSetStatus = (status: Status) => {
    selectedIds.forEach(id => onStatusChange(id, status))
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  const todayPublished = todayItems.filter(i => (states[i.i]?.status ?? i.s) === 7).length
  const todayPct = todayItems.length > 0 ? Math.round((todayPublished / todayItems.length) * 100) : 0
  const dayLabel = now.toLocaleDateString('pt-BR', { weekday: 'long' })
  const dateLabel = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* ════════════════════════════════════════════════
          HERO SECTION — DS HUB Today
          ════════════════════════════════════════════════ */}
      <Box sx={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(255,144,57,0.07) 0%, rgba(255,83,57,0.03) 60%, transparent 100%)',
        borderBottom: '1px solid rgba(255,144,57,0.12)',
        px: { xs: 2, md: 3 }, pt: { xs: 2, md: 2.5 }, pb: { xs: 2, md: 2.5 },
        '@keyframes heroGlow': {
          '0%,100%': { opacity: 0.5 },
          '50%':     { opacity: 1 },
        },
      }}>
        {/* Decorative glow orb */}
        <Box sx={{
          position: 'absolute', top: -60, right: -60,
          width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,144,57,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
          animation: 'heroGlow 4s ease-in-out infinite',
        }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, md: 3 } }}>

          {/* ── Anel de progresso do dia ── */}
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <CircularProgress variant="determinate" value={100}
              size={80} thickness={3}
              sx={{ color: 'rgba(255,255,255,0.06)', display: 'block' }}
            />
            <CircularProgress variant="determinate"
              value={todayPct}
              size={80} thickness={3}
              sx={{
                color: todayPct === 100 ? 'success.main' : late.length > 0 ? 'error.main' : 'primary.main',
                position: 'absolute', top: 0, left: 0,
                filter: `drop-shadow(0 0 6px ${todayPct === 100 ? 'rgba(0,196,122,0.6)' : late.length > 0 ? 'rgba(255,69,69,0.5)' : 'rgba(255,144,57,0.5)'})`,
                transition: 'color 0.5s',
              }}
            />
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.4rem', md: '1.7rem' }, lineHeight: 1, color: 'text.primary' }}>
                {todayDone}
              </Typography>
              <Typography sx={{ fontSize: '0.48rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1 }}>
                /{todayItems.length}
              </Typography>
            </Box>
          </Box>

          {/* ── Texto do dia ── */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{
              fontSize: '0.62rem', fontWeight: 700, color: 'primary.main',
              textTransform: 'uppercase', letterSpacing: 1.5, mb: 0.3,
            }}>
              DS HUB · Hoje
            </Typography>
            <Typography sx={{
              fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.025em',
              fontSize: { xs: '1.3rem', md: '1.65rem' },
              textTransform: 'capitalize',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,200,120,0.85) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              {dayLabel}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.3, mb: 0.8 }}>
              {dateLabel}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', alignItems: 'center' }}>
              {late.length > 0 ? (
                <Chip
                  icon={<WarningAmberIcon sx={{ fontSize: '11px !important' }} />}
                  label={`${late.length} atrasado${late.length > 1 ? 's' : ''}`}
                  size="small" color="error" variant="outlined"
                  sx={{ fontSize: '0.6rem', height: 20 }}
                />
              ) : (
                <Chip
                  icon={<CheckCircleIcon sx={{ fontSize: '11px !important' }} />}
                  label="Sem atrasos"
                  size="small" color="success" variant="outlined"
                  sx={{ fontSize: '0.6rem', height: 20 }}
                />
              )}
              {todayPct === 100 && todayItems.length > 0 && (
                <Chip label="✨ Dia completo!" size="small" color="success"
                  sx={{ fontSize: '0.6rem', height: 20 }} />
              )}
            </Box>
          </Box>

          {/* ── Ações rápidas ── */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6, flexShrink: 0 }}>
            <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 12 }} />}
              onClick={handleCopyReport}
              sx={{ fontSize: '0.6rem', py: 0.5, px: 1, borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.1)', color: 'text.secondary', '&:hover': { color: 'primary.main', borderColor: 'rgba(255,144,57,0.3)' } }}
            >Copiar</Button>
            <Button size="small" startIcon={<WhatsAppIcon sx={{ fontSize: 12 }} />}
              onClick={handleWhatsApp}
              sx={{ fontSize: '0.6rem', py: 0.5, px: 1, borderRadius: 1.5, border: '1px solid rgba(37,211,102,0.2)', color: '#25D366', '&:hover': { bgcolor: 'rgba(37,211,102,0.08)' } }}
            >WhatsApp</Button>
            <Button size="small" startIcon={<CalendarViewWeekIcon sx={{ fontSize: 12 }} />}
              onClick={() => setWeeklyOpen(v => !v)}
              sx={{ fontSize: '0.6rem', py: 0.5, px: 1, borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.08)', color: weeklyOpen ? 'primary.main' : 'text.secondary' }}
            >Semana</Button>
          </Box>
        </Box>

        {/* ── Stats strip ── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, mt: 2 }}>
          {[
            { value: late.length,       label: 'Atrasados',  color: '#FF4545', bg: 'rgba(255,69,69,0.09)',   border: 'rgba(255,69,69,0.2)'   },
            { value: todayEditing,      label: 'Em edição',  color: '#FFD700', bg: 'rgba(255,215,0,0.07)',   border: 'rgba(255,215,0,0.18)'  },
            { value: todayApproved,     label: 'Aprovados',  color: '#2F80ED', bg: 'rgba(47,128,237,0.08)',  border: 'rgba(47,128,237,0.18)' },
            { value: todaySentClient,   label: 'No cliente', color: '#FF9A3D', bg: 'rgba(255,154,61,0.08)',  border: 'rgba(255,154,61,0.2)'  },
            { value: todayDone,         label: 'Publicados', color: '#00C47A', bg: 'rgba(0,196,122,0.08)',   border: 'rgba(0,196,122,0.18)'  },
          ].map(s => (
            <Box key={s.label} sx={{
              textAlign: 'center', py: { xs: 0.8, md: 1 }, borderRadius: 2,
              bgcolor: s.bg, border: `1px solid ${s.border}`,
              transition: 'all 0.2s',
              '&:hover': { transform: 'scale(1.02)', boxShadow: `0 0 12px ${s.border}` },
            }}>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.25rem', md: '1.55rem' }, color: s.color, lineHeight: 1, mb: 0.15 }}>
                {s.value}
              </Typography>
              <Typography sx={{ fontSize: '0.5rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {s.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* ── Barra de progresso linear ── */}
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
            <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>
              Progresso do dia
            </Typography>
            <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: todayPct === 100 ? 'success.main' : 'primary.main' }}>
              {todayPct}%
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={todayPct} sx={{
            height: 5, borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.06)',
            '& .MuiLinearProgress-bar': {
              bgcolor: todayPct === 100 ? 'success.main' : 'primary.main',
              borderRadius: 3,
              boxShadow: `0 0 8px ${todayPct === 100 ? 'rgba(0,196,122,0.5)' : 'rgba(255,144,57,0.5)'}`,
            },
          }} />
        </Box>
      </Box>

      {/* ════════════════════════════════════════════════
          BODY
          ════════════════════════════════════════════════ */}
      <Box sx={{ p: { xs: 1.5, md: 2 }, display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>

      {/* ── Ações de seleção inline ── */}
      {(late.length > 0 || todayItems.length > 0) && (
        <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', alignItems: 'center' }}>
          {onAddItem && (
            <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} onClick={() => setAddOpen(true)}
              sx={{ fontSize: '0.62rem', border: '1px solid rgba(255,255,255,0.1)', color: 'text.secondary', borderRadius: 1.5, px: 1, py: 0.4, '&:hover': { borderColor: 'rgba(255,144,57,0.3)', color: 'primary.main' } }}>
              Adicionar
            </Button>
          )}
          <Button size="small" startIcon={<ChecklistIcon sx={{ fontSize: 14 }} />}
            onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()) }}
            sx={{ fontSize: '0.62rem', border: '1px solid rgba(255,255,255,0.08)', color: selectMode ? 'primary.main' : 'text.secondary', borderRadius: 1.5, px: 1, py: 0.4 }}>
            {selectMode ? 'Cancelar' : 'Selecionar'}
          </Button>
          {riskItems.length > 0 && (
            <Chip
              icon={<ErrorOutlineIcon sx={{ fontSize: '11px !important' }} />}
              label={`${riskItems.length} pub. amanhã sem aprovação`}
              size="small" color="warning" variant="outlined"
              sx={{ fontSize: '0.6rem', height: 24, cursor: 'pointer' }}
              onClick={() => onStatusChange(riskItems[0]?.i, 2)}
            />
          )}
        </Box>
      )}

      {/* ── Clientes silenciosos ──────────────────────── */}
      {silentClients.length > 0 && (
        <Paper sx={{
          px: 1.8, py: 1.2,
          border: '1px solid rgba(59,142,255,0.25)',
          background: 'rgba(59,142,255,0.05)',
          borderRadius: 2.5,
          display: 'flex', alignItems: 'flex-start', gap: 1.2,
        }}>
          <NotificationsOffIcon sx={{ color: 'info.main', fontSize: 18, flexShrink: 0, mt: 0.1 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: 'info.main', lineHeight: 1.2 }}>
              {silentClients.length} cliente{silentClients.length > 1 ? 's' : ''} sem publicação nos últimos 3 dias
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {silentClients.map(({ name, total }) => (
                <Chip key={name} label={`${name} (${total})`} size="small" variant="outlined"
                  sx={{ fontSize: '0.58rem', height: 18, borderColor: 'rgba(59,142,255,0.3)', color: 'info.main' }} />
              ))}
            </Box>
          </Box>
        </Paper>
      )}

      {/* ── Resumo semanal ────────────────────────────── */}
      {weeklyOpen && (
        <Paper sx={{
          px: 1.8, py: 1.5,
          border: '1px solid rgba(255,144,57,0.2)',
          borderRadius: 2.5,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <CalendarViewWeekIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: 'primary.main' }}>
                Últimos 7 dias
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>
                · {weeklyStats.reduce((s, c) => s + c.published, 0)}/{weeklyStats.reduce((s, c) => s + c.planned, 0)} publicados
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 12 }} />}
                onClick={() => { navigator.clipboard.writeText(buildWeeklyReport()); setWeeklyCopied(true) }}
                sx={{ fontSize: '0.6rem', minWidth: 0, px: 0.8 }}>
                Copiar
              </Button>
              <Button size="small" startIcon={<WhatsAppIcon sx={{ fontSize: 12 }} />}
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(buildWeeklyReport())}`, '_blank')}
                sx={{ fontSize: '0.6rem', color: '#25D366', minWidth: 0, px: 0.8 }}>
                WA
              </Button>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
            {weeklyStats.map(({ name, planned, published }) => {
              const pct = planned > 0 ? (published / planned) * 100 : 0
              return (
                <Box key={name}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 600 }} noWrap>{name}</Typography>
                    <Typography sx={{ fontSize: '0.62rem', color: published === planned && planned > 0 ? 'success.main' : 'text.secondary', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {published}/{planned}
                    </Typography>
                  </Box>
                  <Box sx={{ height: 4, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: pct === 100 ? 'success.main' : 'primary.main', borderRadius: 2, transition: 'width 0.4s' }} />
                  </Box>
                </Box>
              )
            })}
          </Box>
        </Paper>
      )}

      {/* ── Hint ──────────────────────────────────────── */}
      <HintCard text="Toque no chip de status para avançar a etapa. Expanda o card com ▾ para adicionar link, legenda e observações." />

      {/* ── Client filter ─────────────────────────────── */}
      {clients.length > 1 && (
        <Stack direction="row" spacing={0.8} sx={{ overflowX: 'auto', pb: 0.5 }}>
          <Chip label="Todos" size="small" variant={filterClient ? 'outlined' : 'filled'} color="primary" onClick={() => setFilterClient(null)} sx={{ flexShrink: 0 }} />
          {clients.map(c => (
            <Chip key={c} label={c} size="small" variant={filterClient === c ? 'filled' : 'outlined'} onClick={() => setFilterClient(c)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }} />
          ))}
        </Stack>
      )}

      {/* ── Atrasados ─────────────────────────────────── */}
      {(filter(late).length > 0 || onAddItem) && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
            <WarningAmberIcon sx={{ fontSize: 14, color: 'error.main' }} />
            <Typography variant="overline" color="error.main" fontWeight={700} sx={{ letterSpacing: 1, lineHeight: 1 }}>
              Atrasados ({filter(late).length})
            </Typography>
            {onAddItem && (
              <Button
                size="small"
                startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                onClick={() => setAddOpen(true)}
                sx={{ ml: 'auto', fontSize: '0.62rem', color: 'error.main', borderColor: 'rgba(255,69,69,0.35)', border: '1px solid', borderRadius: 2, px: 1, py: 0.3, minHeight: 0, '&:hover': { bgcolor: 'rgba(255,69,69,0.08)' } }}
              >
                Adicionar
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1 }}>
            {filter(late).map(item => (
              <ContentCard key={item.i} item={item} state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }} now={now} onStatusChange={onStatusChange} onUpdate={onUpdate} onDelete={onDelete} onEdit={onEdit} onDuplicate={onDuplicate} clientColor={clientColors?.[item.c]} clientHashtags={clientHashtags?.[item.c]} onSaveHashtags={onSaveHashtags ? (tags) => onSaveHashtags(item.c, tags) : undefined} captionTemplates={captionTemplates?.[item.c]} onSaveTemplates={onSaveTemplates} currentUser={currentUser}
                selected={selectMode ? selectedIds.has(item.i) : undefined}
                onSelect={selectMode ? () => toggleSelect(item.i) : undefined}
              />
            ))}
          </Box>
        </Box>
      )}

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

      {/* ── Publicar hoje ─────────────────────────────── */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
          <ScheduleIcon sx={{ fontSize: 14, color: 'primary.main' }} />
          <Typography variant="overline" color="primary.main" fontWeight={700} sx={{ letterSpacing: 1, lineHeight: 1 }}>
            Publicar hoje ({filter(todayItems).length})
          </Typography>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
            <TrendingUpIcon sx={{ fontSize: 14, color: todayPct === 100 ? 'success.main' : 'text.disabled' }} />
            <Typography sx={{ fontSize: '0.62rem', color: todayPct === 100 ? 'success.main' : 'text.disabled', fontWeight: 700 }}>
              {todayPct}%
            </Typography>
          </Box>
        </Box>

        {filter(todayItems).length === 0 ? (
          <Paper sx={{ py: 4, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.08)', bgcolor: 'transparent' }}>
            <CheckCircleIcon sx={{ fontSize: 32, color: 'success.main', mb: 1, display: 'block', mx: 'auto' }} />
            <Typography variant="body2" color="text.secondary">
              Nenhum conteúdo para publicar hoje
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1 }}>
            {filter(todayItems).map(item => (
              <ContentCard key={item.i} item={item} state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }} now={now} onStatusChange={onStatusChange} onUpdate={onUpdate} onDelete={onDelete} onEdit={onEdit} onDuplicate={onDuplicate} clientColor={clientColors?.[item.c]} clientHashtags={clientHashtags?.[item.c]} onSaveHashtags={onSaveHashtags ? (tags) => onSaveHashtags(item.c, tags) : undefined} captionTemplates={captionTemplates?.[item.c]} onSaveTemplates={onSaveTemplates} currentUser={currentUser}
                selected={selectMode ? selectedIds.has(item.i) : undefined}
                onSelect={selectMode ? () => toggleSelect(item.i) : undefined}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* ── Bottom hint ───────────────────────────────── */}
      <HintCard text="O resumo copiado vai para a área de transferência formatado para WhatsApp. Cole direto no grupo da equipe." />

      {/* ── Barra de seleção em massa ─────────────────── */}
      {selectMode && selectedIds.size > 0 && (
        <Box sx={{
          position: 'fixed', bottom: 72, left: 0, right: 0, zIndex: 1100,
          display: 'flex', gap: 0.8, px: 2, py: 1.2,
          bgcolor: '#1a1208', borderTop: '1px solid rgba(255,144,57,0.3)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.6)',
          alignItems: 'center',
        }}>
          <Typography sx={{ fontSize: '0.68rem', color: 'primary.main', fontWeight: 700, mr: 0.5 }}>
            {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
          </Typography>
          {([0, 1, 2, 3, 7] as Status[]).map(s => (
            <Chip
              key={s}
              label={STATUS_CONFIG[s].shortLabel}
              size="small"
              onClick={() => batchSetStatus(s)}
              sx={{
                fontSize: '0.58rem', cursor: 'pointer', height: 22,
                bgcolor: `${STATUS_CONFIG[s].color}15`,
                color: STATUS_CONFIG[s].color,
                border: `1px solid ${STATUS_CONFIG[s].color}35`,
              }}
            />
          ))}
          <Fab size="small" onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}
            sx={{ ml: 'auto', width: 28, height: 28, minHeight: 28, bgcolor: 'rgba(255,255,255,0.08)', boxShadow: 'none' }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </Fab>
        </Box>
      )}

      <Snackbar open={copied} autoHideDuration={2500} onClose={() => setCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled">Resumo copiado — pronto para colar no WhatsApp</Alert>
      </Snackbar>
      <Snackbar open={weeklyCopied} autoHideDuration={2500} onClose={() => setWeeklyCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled">Resumo semanal copiado!</Alert>
      </Snackbar>

      {/* ── Dialog: Adicionar conteúdo atrasado ────────── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AddIcon sx={{ color: 'error.main', fontSize: 18 }} />
            <Typography fontWeight={700} sx={{ fontSize: '0.95rem' }}>Adicionar conteúdo</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

          {/* Cliente */}
          <TextField
            label="Cliente" size="small" fullWidth select autoFocus
            value={addClient}
            onChange={e => setAddClient(e.target.value)}
          >
            {clientOptions.map(c => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>

          {/* Título */}
          <TextField
            label="Título do conteúdo" size="small" fullWidth
            value={addTitle}
            onChange={e => setAddTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddSubmit()}
          />

          {/* Tipo */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tipo</Typography>
            <ToggleButtonGroup exclusive value={addType} onChange={(_, v) => v && setAddType(v)} size="small" fullWidth>
              <ToggleButton value="Post"  sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Post</ToggleButton>
              <ToggleButton value="Reel"  sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Reel</ToggleButton>
              <ToggleButton value="Story" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Story</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Data */}
          <TextField
            label="Data" size="small" fullWidth type="date"
            value={addDate}
            onChange={e => setAddDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          {/* Status inicial */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status inicial</Typography>
            <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
              {(['Pendente', 'Em edição', 'Aprovado', 'Publicado'] as const).map((label, idx) => (
                <Chip
                  key={label} label={label} size="small"
                  onClick={() => setAddStatus(idx as Status)}
                  variant={addStatus === idx ? 'filled' : 'outlined'}
                  color={(['default', 'warning', 'info', 'success'] as const)[idx]}
                  sx={{ cursor: 'pointer', fontSize: '0.62rem' }}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setAddOpen(false)}>Cancelar</Button>
          <Button
            size="small" variant="contained" color="error"
            disabled={!addClient || !addTitle}
            startIcon={<AddIcon />}
            onClick={handleAddSubmit}
            sx={{ fontWeight: 700 }}
          >
            Adicionar
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  )
}
