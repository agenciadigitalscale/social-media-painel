import { useState, useMemo, lazy, Suspense } from 'react'

const ResolveWithAIModal = lazy(() => import('./ResolveWithAIModal'))
import {
  Box, Typography, Button, Snackbar, Alert,
  Chip, Stack, Paper, Divider, Fab, Tooltip,
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
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import LinkIcon from '@mui/icons-material/Link'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import type { Client, ContentItem, ContentType, ItemEditPatch, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'
import ContentCard from './ContentCard'
import HintCard from './HintCard'
import WhatsAppLoteDialog, { buildLoteClients } from './WhatsAppLoteDialog'
import CursorGlow from './CursorGlow'

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
  onBulkSendToClient?: (clientName: string, itemIds: number[]) => Promise<void>
  clientPhones?: Record<string, string>
}

// ── Clientes em risco (sem publicações no mês) ───────────────────────────
function ClientRiskBanner({ items, states, now }: {
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
}) {
  const riskyClients = useMemo(() => {
    const month = now.getMonth()
    const year  = now.getFullYear()
    const today = new Date(now); today.setHours(0, 0, 0, 0)

    const byClient: Record<string, ContentItem[]> = {}
    items.forEach(item => {
      if (item.dt.getMonth() !== month || item.dt.getFullYear() !== year) return
      if (!byClient[item.c]) byClient[item.c] = []
      byClient[item.c].push(item)
    })

    return Object.entries(byClient)
      .filter(([, clientItems]) => {
        if (clientItems.length < 3) return false
        const published = clientItems.filter(i => (states[i.i]?.status ?? i.s) === 7).length
        if (published > 0) return false
        const overdue = clientItems.filter(i => i.dt < today && (states[i.i]?.status ?? i.s) !== 7).length
        return overdue > 0
      })
      .map(([name, clientItems]) => {
        const overdue = clientItems.filter(i => i.dt < today && (states[i.i]?.status ?? i.s) !== 7).length
        return { name, overdue, total: clientItems.length }
      })
      .sort((a, b) => b.overdue - a.overdue)
  }, [items, states, now])

  if (riskyClients.length === 0) return null

  return (
    <Paper sx={{
      p: 1.5, border: '1px solid rgba(255,69,69,0.22)', borderRadius: 2,
      bgcolor: 'rgba(255,69,69,0.08)',
      position: 'relative', overflow: 'hidden',
      '&::after': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,69,69,0.6) 30%, rgba(255,69,69,0.9) 50%, rgba(255,69,69,0.6) 70%, transparent)', pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit' },
    }}>
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, bgcolor: '#FF4545', borderRadius: '4px 0 0 4px' }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, pl: 0.8 }}>
        <WarningAmberIcon sx={{ fontSize: 15, color: '#FF4545', filter: 'drop-shadow(0 0 5px rgba(255,69,69,0.6))', flexShrink: 0 }} />
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#FF4545', boxShadow: '0 0 6px #FF454599', animation: 'pulse 1.5s ease infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#FF4545' }}>
          {riskyClients.length} cliente{riskyClients.length !== 1 ? 's' : ''} sem publicação este mês
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
        {riskyClients.map(c => (
          <Chip
            key={c.name}
            label={`${c.name} · ${c.overdue} atrasado${c.overdue !== 1 ? 's' : ''}`}
            size="small"
            sx={{
              fontSize: '0.62rem', height: 22,
              bgcolor: 'rgba(255,69,69,0.12)', color: '#FF8080',
              border: '1px solid rgba(255,69,69,0.25)',
            }}
          />
        ))}
      </Box>
    </Paper>
  )
}

// ── Banner para quando não há itens hoje ─────────────────────────────────
function EmptyToday({ items, now }: { items: ContentItem[]; now: Date }) {
  const today = useMemo(() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d }, [now])
  const nextItem = useMemo(() =>
    items
      .filter(i => { const d = new Date(i.dt); d.setHours(0, 0, 0, 0); return d > today })
      .sort((a, b) => a.dt.getTime() - b.dt.getTime())[0]
  , [items, today])

  if (!nextItem) {
    return (
      <Paper sx={{ py: 5, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.08)', bgcolor: 'transparent', borderRadius: 2 }}>
        <CheckCircleIcon sx={{ fontSize: 36, color: 'success.main', mb: 1, display: 'block', mx: 'auto' }} />
        <Typography variant="body2" color="text.secondary">Nenhum conteúdo agendado</Typography>
      </Paper>
    )
  }

  const daysUntil = Math.round((new Date(nextItem.dt).setHours(0,0,0,0) - today.getTime()) / 86_400_000)
  const dateLabel = nextItem.dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  const nextDayStart = new Date(nextItem.dt); nextDayStart.setHours(0,0,0,0)
  const nextDayEnd   = new Date(nextDayStart.getTime() + 86_400_000)
  const nextDayItems = items.filter(i => i.dt >= nextDayStart && i.dt < nextDayEnd)

  return (
    <Paper sx={{ py: 3, px: 3, textAlign: 'center', border: '1px dashed rgba(255,144,57,0.2)', bgcolor: 'rgba(255,144,57,0.04)', borderRadius: 2 }}>
      <ScheduleIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1, display: 'block', mx: 'auto' }} />
      <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>Nenhuma publicação hoje</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Próximo conteúdo em{' '}
        <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>
          {daysUntil === 1 ? 'amanhã' : `${daysUntil} dias`}
        </Box>
        {' '}— {dateLabel}
      </Typography>
      <Box sx={{ display: 'inline-flex', gap: 0.8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {nextDayItems.slice(0, 5).map(i => (
          <Paper key={i.i} sx={{ px: 1, py: 0.4, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1, border: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{i.tp === 'Reel' ? '🎬' : '📷'} {i.c}</Typography>
          </Paper>
        ))}
        {nextDayItems.length > 5 && (
          <Paper sx={{ px: 1, py: 0.4, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1, border: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>+{nextDayItems.length - 5} mais</Typography>
          </Paper>
        )}
      </Box>
    </Paper>
  )
}

// ── TypeGroupedCards — renders items in 3 type sections ──────────────────
interface GroupedCardsProps {
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
  onStatusChange: (id: number, s: Status) => void
  onUpdate: (id: number, patch: Partial<ItemState>) => void
  onDelete?: (id: number) => void
  onEdit?: (id: number, patch: ItemEditPatch) => void
  onDuplicate?: (id: number) => void
  clientColors?: Record<string, string>
  clientHashtags?: Record<string, string[]>
  onSaveHashtags?: (clientName: string, tags: string[]) => void
  captionTemplates?: Record<string, string[]>
  onSaveTemplates?: (clientName: string, templates: string[]) => void
  currentUser?: string
  selectMode: boolean
  selectedIds: Set<number>
  onToggleSelect: (id: number) => void
}

const TYPE_SECTIONS: { key: string; label: string; emoji: string; match: (tp: ContentType) => boolean }[] = [
  { key: 'feed',  label: 'Feed',         emoji: '📸', match: tp => tp === 'Feed' },
  { key: 'video', label: 'Vídeo',        emoji: '🎬', match: tp => tp === 'Reel' || tp === 'Story' },
  { key: 'post',  label: 'Post & Outros', emoji: '📝', match: tp => tp === 'Post' || tp === 'Carrossel' },
]

function TypeGroupedCards({
  items, states, now, onStatusChange, onUpdate, onDelete, onEdit, onDuplicate,
  clientColors, clientHashtags, onSaveHashtags, captionTemplates, onSaveTemplates,
  currentUser, selectMode, selectedIds, onToggleSelect,
}: GroupedCardsProps) {
  const sections = TYPE_SECTIONS.map(sec => ({
    ...sec,
    filtered: items.filter(i => sec.match(i.tp)),
  })).filter(sec => sec.filtered.length > 0)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {sections.map((sec, idx) => (
        <Box key={sec.key}>
          {idx > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)', mb: 1.5 }} />}
          {/* Section header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.35)' }}>
              {sec.emoji} {sec.label}
            </Typography>
            <Chip
              label={sec.filtered.length}
              size="small"
              sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: 'none' }}
            />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1 }}>
            {sec.filtered.map(item => (
              <ContentCard
                key={item.i}
                item={item}
                state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }}
                now={now}
                onStatusChange={onStatusChange}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                clientColor={clientColors?.[item.c]}
                clientHashtags={clientHashtags?.[item.c]}
                onSaveHashtags={onSaveHashtags ? (tags) => onSaveHashtags(item.c, tags) : undefined}
                captionTemplates={captionTemplates?.[item.c]}
                onSaveTemplates={onSaveTemplates}
                currentUser={currentUser}
                selected={selectMode ? selectedIds.has(item.i) : undefined}
                onSelect={selectMode ? () => onToggleSelect(item.i) : undefined}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export default function TodayTab({ items, states, onStatusChange, onUpdate, onDelete, onEdit, onDuplicate, onAddItem, clientColors, clientHashtags, onSaveHashtags, captionTemplates, onSaveTemplates, allClients, now, currentUser, onBulkSendToClient, clientPhones = {} }: Props) {
  const [copied, setCopied] = useState(false)
  const [weeklyCopied, setWeeklyCopied] = useState(false)
  const [captionCopied, setCaptionCopied] = useState(false)
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
  const [loteOpen, setLoteOpen] = useState(false)
  const [aiItem, setAiItem] = useState<ContentItem | null>(null)

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

  // Fila de publicação: aprovados (status 2 ou 3) com data <= hoje, ainda não publicados
  const readyToPublish = useMemo(() =>
    items
      .filter(i => {
        const st = states[i.i]?.status ?? i.s
        return [2, 3].includes(st) && i.dt < tomorrow
      })
      .sort((a, b) => a.dt.getTime() - b.dt.getTime()),
    [items, states, tomorrow],
  )

  // v2: "late" = still in internal workflow (status < 4) past due date
  const late      = useMemo(() => items.filter(i => (states[i.i]?.status ?? i.s) < 4 && i.dt < today).sort((a, b) => a.dt.getTime() - b.dt.getTime()), [items, states, today])
  const todayItems = useMemo(() => items.filter(i => i.dt >= today && i.dt < tomorrow), [items, today, tomorrow])
  const dayAfterTomorrow = useMemo(() => new Date(tomorrow.getTime() + 86_400_000), [tomorrow])
  const riskItems = useMemo(() => items.filter(i => {
    const st = states[i.i]?.status ?? i.s
    return i.dt > today && i.dt < dayAfterTomorrow && st < 3
  }), [items, states, today, dayAfterTomorrow])

  // Itens com status 3 (Aprovado interno) prontos para enviar ao cliente
  const loteClients = useMemo(
    () => buildLoteClients(items, states, allClients ?? [], clientPhones),
    [items, states, allClients, clientPhones],
  )
  const loteTotalItems = loteClients.reduce((s, c) => s + c.items.length, 0)

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
    const dateStr = today.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    const lines: string[] = [
      `*🗓️ Operação Digital Scale*`,
      `_${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}_`,
      '',
    ]

    // Progress summary
    const publishedToday = todayItems.filter(i => (states[i.i]?.status ?? i.s) === 7).length
    lines.push(`📊 *${publishedToday}/${todayItems.length}* publicados hoje · *${late.length}* atrasados`)
    lines.push('')

    // Late items grouped by client
    if (late.length) {
      lines.push(`*⚠️ Atrasados*`)
      const byClient = new Map<string, typeof late>()
      late.forEach(i => { const arr = byClient.get(i.c) ?? []; arr.push(i); byClient.set(i.c, arr) })
      byClient.forEach((items, client) => {
        lines.push(`  • *${client}* (${items.length}x)`)
        items.slice(0, 3).forEach(i => lines.push(`    ↳ ${STATUS_CONFIG[states[i.i]?.status ?? i.s]?.emoji ?? '⏳'} ${i.n} — ${i.tp}`))
        if (items.length > 3) lines.push(`    ↳ +${items.length - 3} mais`)
      })
      lines.push('')
    }

    // Today items grouped by client
    if (todayItems.length) {
      lines.push(`*📅 Hoje*`)
      const byClient = new Map<string, typeof todayItems>()
      todayItems.forEach(i => { const arr = byClient.get(i.c) ?? []; arr.push(i); byClient.set(i.c, arr) })
      byClient.forEach((items, client) => {
        const done = items.filter(i => (states[i.i]?.status ?? i.s) === 7).length
        lines.push(`  • *${client}* ${done === items.length ? '✅' : `${done}/${items.length}`}`)
        items.forEach(i => {
          const s = states[i.i]?.status ?? i.s
          const cfg = STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]
          lines.push(`    ↳ ${cfg?.emoji ?? '⏳'} ${i.n} (${i.tp})`)
        })
      })
    }

    lines.push('')
    lines.push(`_Digital Scale · ScaleOS_`)
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
        px: { xs: 2, md: 3, xl: 5 }, pt: { xs: 2, md: 2.5, xl: 3.5 }, pb: { xs: 2, md: 2.5, xl: 3.5 },
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
              fontSize: { xs: '0.62rem', xl: '0.82rem' }, fontWeight: 700, color: 'primary.main',
              textTransform: 'uppercase', letterSpacing: 1.5, mb: 0.3,
            }}>
              DS HUB · Hoje
            </Typography>
            <Typography sx={{
              fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.025em',
              fontSize: { xs: '1.3rem', md: '1.65rem', xl: '2.6rem' },
              textTransform: 'capitalize',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,200,120,0.85) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              {dayLabel}
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.72rem', xl: '0.95rem' }, color: 'text.secondary', mt: 0.3, mb: 0.8 }}>
              {dateLabel}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', alignItems: 'center' }}>
              {late.length > 0 ? (
                <Chip
                  icon={<WarningAmberIcon sx={{ fontSize: '11px !important' }} />}
                  label={`${late.length} atrasado${late.length > 1 ? 's' : ''}`}
                  size="small" color="error" variant="outlined"
                  sx={{ fontSize: { xs: '0.6rem', xl: '0.75rem' }, height: { xs: 20, xl: 26 } }}
                />
              ) : (
                <Chip
                  icon={<CheckCircleIcon sx={{ fontSize: '11px !important' }} />}
                  label="Sem atrasos"
                  size="small" color="success" variant="outlined"
                  sx={{ fontSize: { xs: '0.6rem', xl: '0.75rem' }, height: { xs: 20, xl: 26 } }}
                />
              )}
              {todayPct === 100 && todayItems.length > 0 && (
                <Chip label="✨ Dia completo!" size="small" color="success"
                  sx={{ fontSize: { xs: '0.6rem', xl: '0.75rem' }, height: { xs: 20, xl: 26 } }} />
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
        <Box sx={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, mt: 2,
          '@keyframes kpiEnter': {
            from: { opacity: 0, transform: 'scale(0.72) translateY(8px)' },
            to:   { opacity: 1, transform: 'scale(1) translateY(0)' },
          },
          '@keyframes glowPulse': {
            '0%,100%': { boxShadow: '0 0 0 0 rgba(255,69,69,0)' },
            '50%':     { boxShadow: '0 0 14px 2px rgba(255,69,69,0.28)' },
          },
        }}>
          {[
            { value: late.length,            label: 'Atrasados',  color: '#FF4545', bg: 'rgba(255,69,69,0.09)',   border: 'rgba(255,69,69,0.2)',   emoji: '⚠️', pulse: late.length > 0 },
            { value: todayEditing,           label: 'Em edição',  color: '#FFD700', bg: 'rgba(255,215,0,0.07)',   border: 'rgba(255,215,0,0.18)',  emoji: '✏️', pulse: false },
            { value: readyToPublish.length,  label: 'Pub. hoje',  color: '#34D399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.2)',  emoji: '🚀', pulse: false },
            { value: todaySentClient,        label: 'No cliente', color: '#FF9A3D', bg: 'rgba(255,154,61,0.08)',  border: 'rgba(255,154,61,0.2)',  emoji: '📤', pulse: false },
            { value: todayDone,              label: 'Publicados', color: '#00C47A', bg: 'rgba(0,196,122,0.08)',   border: 'rgba(0,196,122,0.18)',  emoji: '✅', pulse: false },
          ].map((s, i) => (
            <Box key={s.label} sx={{
              textAlign: 'center', py: { xs: 0.8, md: 1, xl: 1.5 }, px: 0.5, borderRadius: 2,
              bgcolor: s.bg, border: `1px solid ${s.border}`,
              transition: 'all 0.22s ease',
              animation: s.pulse
                ? `kpiEnter 0.45s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s both, glowPulse 2s ease-in-out ${0.45 + i * 0.07}s infinite`
                : `kpiEnter 0.45s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s both`,
              position: 'relative',
              overflow: 'hidden',
              '&:hover': { transform: 'translateY(-2px) scale(1.02)', borderColor: s.color, boxShadow: `0 6px 18px ${s.color}20` },
              '&::after': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${s.color}55 30%, ${s.color}88 50%, ${s.color}55 70%, transparent)`, pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit' },
            }}>
              <Typography sx={{ fontSize: { xs: '0.75rem', md: '0.85rem' }, lineHeight: 1, mb: 0.2 }}>
                {s.emoji}
              </Typography>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.25rem', md: '1.55rem', xl: '2.2rem' }, color: s.color, lineHeight: 1, mb: 0.15, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>
                {s.value}
              </Typography>
              <Typography sx={{ fontSize: { xs: '0.5rem', xl: '0.68rem' }, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
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
            },
          }} />
        </Box>
      </Box>

      {/* ════════════════════════════════════════════════
          BODY
          ════════════════════════════════════════════════ */}
      <Box sx={{ p: { xs: 1.5, md: 2, xl: 3 }, display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>

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

      {/* ── Prontos para enviar ao cliente (WhatsApp em lote) ── */}
      {loteTotalItems > 0 && onBulkSendToClient && (
        <Paper
          onClick={() => setLoteOpen(true)}
          sx={{
            px: 1.8, py: 1.1,
            border: '1px solid rgba(37,211,102,0.3)',
            background: 'rgba(37,211,102,0.05)',
            borderRadius: 2.5,
            display: 'flex', alignItems: 'center', gap: 1.2,
            cursor: 'pointer', position: 'relative',
            transition: 'all 0.18s',
            '&:hover': { border: '1px solid rgba(37,211,102,0.55)', background: 'rgba(37,211,102,0.09)', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(37,211,102,0.12)' },
            '&::after': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(37,211,102,0.5) 30%, rgba(37,211,102,0.82) 50%, rgba(37,211,102,0.5) 70%, transparent)', pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit' },
          }}
        >
          <Box
            sx={{
              width: 32, height: 32, borderRadius: 1.5, flexShrink: 0,
              background: 'linear-gradient(135deg,#25D366,#128C7E)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px rgba(37,211,102,0.3)',
            }}
          >
            <WhatsAppIcon sx={{ color: '#fff', fontSize: 16 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#25D366', lineHeight: 1.2 }}>
              {loteTotalItems} item{loteTotalItems !== 1 ? 's' : ''} prontos para enviar ao cliente
            </Typography>
            <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)' }}>
              {loteClients.length} cliente{loteClients.length !== 1 ? 's' : ''} · aprovados internamente · clique para enviar via WhatsApp
            </Typography>
          </Box>
          <Chip
            label={`📤 Enviar em lote`}
            size="small"
            sx={{ fontSize: '0.6rem', height: 22, bgcolor: 'rgba(37,211,102,0.12)', color: '#25D366', border: '1px solid rgba(37,211,102,0.3)', cursor: 'pointer' }}
          />
        </Paper>
      )}

      {/* ── Clientes silenciosos ──────────────────────── */}
      {silentClients.length > 0 && (
        <Paper sx={{
          px: 1.8, py: 1.2,
          border: '1px solid rgba(59,142,255,0.25)',
          background: 'rgba(59,142,255,0.05)',
          borderRadius: 2.5,
          display: 'flex', alignItems: 'flex-start', gap: 1.2,
          position: 'relative',
          '&::after': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(59,142,255,0.5) 30%, rgba(59,142,255,0.82) 50%, rgba(59,142,255,0.5) 70%, transparent)', pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit' },
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
          position: 'relative',
          '&::after': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,144,57,0.5) 30%, rgba(255,144,57,0.82) 50%, rgba(255,144,57,0.5) 70%, transparent)', pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit' },
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

      {/* ── 🚀 Prontos para publicar ──────────────────── */}
      {readyToPublish.length > 0 && (
        <Paper sx={{
          border: '1px solid rgba(0,196,122,0.4)',
          background: 'linear-gradient(135deg, rgba(0,196,122,0.06) 0%, rgba(0,196,122,0.02) 100%)',
          borderRadius: 2.5, overflow: 'hidden',
          '@keyframes readyPulse': {
            '0%,100%': { boxShadow: '0 0 0 0 rgba(0,196,122,0)' },
            '50%':     { boxShadow: '0 0 0 4px rgba(0,196,122,0.12)' },
          },
          animation: 'readyPulse 2.5s ease-in-out infinite',
        }}>
          {/* Header */}
          <Box sx={{ px: 2, py: 1.2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(0,196,122,0.15)' }}>
            <RocketLaunchIcon sx={{ fontSize: 16, color: 'success.main' }} />
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: 'success.main' }}>
              Prontos para publicar
            </Typography>
            <Chip
              label={readyToPublish.length}
              size="small" color="success"
              sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }}
            />
            <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', ml: 'auto' }}>
              Aprovados · aguardando publicação
            </Typography>
          </Box>

          {/* Items */}
          <Stack spacing={0.6} sx={{ p: 1 }}>
            {readyToPublish.map(item => {
              const st    = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
              const hasLink    = !!st.link
              const hasCaption = !!st.caption
              const isToday    = item.dt >= today
              const daysAgo    = isToday ? 0 : Math.floor((today.getTime() - item.dt.getTime()) / 86400000)
              const dotColor   = clientColors?.[item.c] || '#00C47A'

              return (
                <Box key={item.i} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
                  px: 1.5, py: 1,
                  bgcolor: 'rgba(0,0,0,0.25)', borderRadius: 1.5,
                  border: '1px solid rgba(0,196,122,0.1)',
                  transition: 'border-color 0.2s',
                  '&:hover': { borderColor: 'rgba(0,196,122,0.3)' },
                }}>
                  {/* Client dot */}
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />

                  {/* Info */}
                  <Box sx={{ flex: 1, minWidth: 100 }}>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1.2 }} noWrap>
                      {item.c} · {item.tp}
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.3 }} noWrap>
                      {st.title || item.n}
                    </Typography>
                  </Box>

                  {/* Date badge */}
                  <Chip
                    label={isToday ? '📅 Hoje' : `${daysAgo}d atrás`}
                    size="small"
                    sx={{
                      fontSize: '0.55rem', height: 18, flexShrink: 0,
                      bgcolor: isToday ? 'rgba(0,196,122,0.15)' : 'rgba(255,69,69,0.12)',
                      color: isToday ? '#00C47A' : '#FF6B6B',
                      border: '1px solid',
                      borderColor: isToday ? 'rgba(0,196,122,0.3)' : 'rgba(255,69,69,0.25)',
                    }}
                  />

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                    {hasLink ? (
                      <Tooltip title="Abrir criativo no Drive">
                        <Button
                          size="small" variant="outlined" color="info"
                          component="a" href={st.link} target="_blank"
                          startIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
                          sx={{ fontSize: '0.6rem', py: 0.3, px: 0.8, minWidth: 0 }}
                        >
                          Drive
                        </Button>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Nenhum link configurado — adicione o link do criativo no card">
                        <Box component="span">
                          <Button
                            size="small" disabled
                            startIcon={<LinkIcon sx={{ fontSize: 12 }} />}
                            sx={{ fontSize: '0.6rem', py: 0.3, px: 0.8, minWidth: 0 }}
                          >
                            Drive
                          </Button>
                        </Box>
                      </Tooltip>
                    )}

                    {hasCaption && (
                      <Tooltip title="Copiar legenda">
                        <Button
                          size="small" variant="outlined"
                          startIcon={<ContentCopyIcon sx={{ fontSize: 12 }} />}
                          onClick={() => { navigator.clipboard.writeText(st.caption); setCaptionCopied(true) }}
                          sx={{ fontSize: '0.6rem', py: 0.3, px: 0.8, minWidth: 0, color: 'text.secondary', borderColor: 'rgba(255,255,255,0.15)' }}
                        >
                          Legenda
                        </Button>
                      </Tooltip>
                    )}

                    <Tooltip title="Marcar como Publicado e remover da fila">
                      <Button
                        size="small" variant="contained" color="success"
                        startIcon={<CheckCircleIcon sx={{ fontSize: 12 }} />}
                        onClick={() => onStatusChange(item.i, 7 as Status)}
                        sx={{ fontSize: '0.62rem', py: 0.3, px: 1, fontWeight: 700 }}
                      >
                        Publicar
                      </Button>
                    </Tooltip>
                  </Box>
                </Box>
              )
            })}
          </Stack>
        </Paper>
      )}

      {/* ── Hint ──────────────────────────────────────── */}
      <HintCard text="Toque no chip de status para avançar a etapa. Expanda o card com ▾ para adicionar link, legenda e observações." />

      {/* ── Clientes em risco ────────────────────────── */}
      <ClientRiskBanner items={items} states={states} now={now} />

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2, pb: 1, borderBottom: '1px solid rgba(255,69,69,0.1)' }}>
            <Box sx={{ width: 3, height: 16, borderRadius: 1, bgcolor: '#FF4545' }} />
            <WarningAmberIcon sx={{ fontSize: 14, color: '#FF4545' }} />
            <Typography sx={{ fontSize: { xs: '0.62rem', xl: '0.72rem' }, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)' }}>
              Atrasados
            </Typography>
            <Chip
              label={filter(late).length}
              size="small"
              sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgba(255,69,69,0.15)', color: '#FF4545', border: '1px solid rgba(255,69,69,0.3)' }}
            />
            {filter(late).length > 0 && (
              <Tooltip title="Usar IA para resolver os itens atrasados">
                <Button
                  size="small"
                  startIcon={<AutoAwesomeIcon sx={{ fontSize: 13 }} />}
                  onClick={() => setAiItem(filter(late)[0])}
                  sx={{
                    fontSize: '0.6rem', fontWeight: 700, px: 1.2, py: 0.3,
                    border: '1px solid rgba(255,144,57,0.35)', color: '#ff9039',
                    borderRadius: 2, minHeight: 0,
                    '&:hover': { bgcolor: 'rgba(255,144,57,0.1)', borderColor: 'rgba(255,144,57,0.6)' },
                  }}
                >
                  Resolver com IA
                </Button>
              </Tooltip>
            )}
            {onAddItem && (
              <Button
                size="small"
                startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                onClick={() => setAddOpen(true)}
                sx={{ ml: filter(late).length > 0 ? 0 : 'auto', fontSize: '0.62rem', color: 'error.main', borderColor: 'rgba(255,69,69,0.35)', border: '1px solid', borderRadius: 2, px: 1, py: 0.3, minHeight: 0, '&:hover': { bgcolor: 'rgba(255,69,69,0.08)' } }}
              >
                Adicionar
              </Button>
            )}
          </Box>
          <TypeGroupedCards
            items={filter(late)}
            states={states}
            now={now}
            onStatusChange={onStatusChange}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            clientColors={clientColors}
            clientHashtags={clientHashtags}
            onSaveHashtags={onSaveHashtags}
            captionTemplates={captionTemplates}
            onSaveTemplates={onSaveTemplates}
            currentUser={currentUser}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        </Box>
      )}

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

      {/* ── Publicar hoje ─────────────────────────────── */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2, pb: 1, borderBottom: '1px solid rgba(255,144,57,0.1)' }}>
          <Box sx={{ width: 3, height: 16, borderRadius: 1, bgcolor: 'primary.main' }} />
          <ScheduleIcon sx={{ fontSize: 14, color: 'primary.main' }} />
          <Typography sx={{ fontSize: { xs: '0.62rem', xl: '0.72rem' }, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)' }}>
            Publicar hoje
          </Typography>
          <Chip
            label={filter(todayItems).length}
            size="small"
            sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgba(255,144,57,0.15)', color: '#ff9039', border: '1px solid rgba(255,144,57,0.3)' }}
          />
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <TrendingUpIcon sx={{ fontSize: 14, color: todayPct === 100 ? 'success.main' : 'text.disabled' }} />
            <Typography sx={{ fontSize: '0.62rem', color: todayPct === 100 ? 'success.main' : 'text.disabled', fontWeight: 700 }}>
              {todayPct}%
            </Typography>
          </Box>
        </Box>

        {filter(todayItems).length === 0 ? (
          <EmptyToday items={items} now={now} />

        ) : (
          <TypeGroupedCards
            items={filter(todayItems)}
            states={states}
            now={now}
            onStatusChange={onStatusChange}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            clientColors={clientColors}
            clientHashtags={clientHashtags}
            onSaveHashtags={onSaveHashtags}
            captionTemplates={captionTemplates}
            onSaveTemplates={onSaveTemplates}
            currentUser={currentUser}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
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
      <Snackbar open={captionCopied} autoHideDuration={2000} onClose={() => setCaptionCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" variant="filled">Legenda copiada — cole direto no Instagram!</Alert>
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
              <ToggleButton value="Post"      sx={{ fontSize: '0.68rem', fontWeight: 700 }}>Post</ToggleButton>
              <ToggleButton value="Reel"      sx={{ fontSize: '0.68rem', fontWeight: 700 }}>Reel</ToggleButton>
              <ToggleButton value="Story"     sx={{ fontSize: '0.68rem', fontWeight: 700 }}>Story</ToggleButton>
              <ToggleButton value="Carrossel" sx={{ fontSize: '0.68rem', fontWeight: 700 }}>Carros.</ToggleButton>
              <ToggleButton value="Feed"      sx={{ fontSize: '0.68rem', fontWeight: 700 }}>📸 Feed</ToggleButton>
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

      {/* ── WhatsApp em lote ── */}
      {onBulkSendToClient && (
        <WhatsAppLoteDialog
          open={loteOpen}
          onClose={() => setLoteOpen(false)}
          clients={loteClients}
          onSendToClient={onBulkSendToClient}
        />
      )}

      {/* ── Resolver com IA ── */}
      <Suspense fallback={null}>
        {aiItem && (
          <ResolveWithAIModal
            open={aiItem !== null}
            onClose={() => setAiItem(null)}
            item={aiItem}
            state={states[aiItem.i]}
            onUpdate={onUpdate}
            onStatusChange={onStatusChange}
          />
        )}
      </Suspense>
      </Box>
    </Box>
  )
}
