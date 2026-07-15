import { useMemo, useState, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Box, Typography, Paper, Chip, Tooltip, IconButton, Stack, Avatar, MenuItem, TextField,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import LinkIcon from '@mui/icons-material/Link'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import BrushIcon from '@mui/icons-material/Brush'
import type { ContentItem, ItemState, Status } from '../types'
import { NAME_MAP, getDisplayName } from '../lib/users'

// ── Column definitions ────────────────────────────────────

const DESIGN_COLUMNS: { status: Status; label: string; color: string }[] = [
  { status: 0, label: 'Fila',       color: '#888888' },
  { status: 1, label: 'Em Design',  color: '#3B82F6' },
  { status: 2, label: 'Revisão',    color: '#3B82F6' },
  { status: 3, label: 'Publicado',  color: '#31D17C' },
]

// ── Type badge helpers ────────────────────────────────────

const TYPE_EMOJI: Record<string, string> = {
  Post:      '📷',
  Reel:      '🎬',
  Story:     '📖',
  Carrossel: '🗂️',
}

// Reels em destaque DS orange; demais tipos neutros
const TYPE_COLOR: Record<string, string> = {
  Post:      '#888',
  Reel:      '#3B82F6',
  Story:     '#888',
  Carrossel: '#888',
}

// ── Urgency helpers ───────────────────────────────────────

function getUrgency(dt: Date, today: Date): 'overdue' | 'today' | 'tomorrow' | 'future' {
  const d = new Date(dt); d.setHours(0, 0, 0, 0)
  const t = new Date(today); t.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000)
  if (diff < 0)  return 'overdue'
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return 'future'
}

const URGENCY_COLOR: Record<string, string> = {
  overdue:  '#EF4444',
  today:    '#60A5FA',
  tomorrow: '#F59E0B',
  future:   '#71717A',
}

// ── DesignCard ────────────────────────────────────────────

function DesignCard({
  item,
  state,
  clientFolders,
  now,
  isDragging,
}: {
  item: ContentItem
  state: ItemState
  clientFolders: Record<string, string>
  now: Date
  isDragging?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const today = useMemo(() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d }, [now])
  const urgency = getUrgency(item.dt, today)
  const urgencyColor = URGENCY_COLOR[urgency]
  const colCfg = DESIGN_COLUMNS.find(c => c.status === state.status) ?? DESIGN_COLUMNS[0]

  const dateLabel = () => {
    const d = new Date(item.dt); d.setHours(0, 0, 0, 0)
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
    if (diff < 0)  return `${Math.abs(diff)}d atraso`
    if (diff === 0) return 'Hoje'
    if (diff === 1) return 'Amanhã'
    return item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(state.title || item.n).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  const driveLink = clientFolders[item.c]
  const contentLink = state.link

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.4,
        borderRadius: 2.5,
        bgcolor: isDragging ? `${colCfg.color}10` : 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${urgency === 'overdue' ? '#FF454444' : urgency === 'today' ? 'rgba(96,165,250,0.4)' : `${colCfg.color}22`}`,
        opacity: isDragging ? 0.45 : 1,
        cursor: 'grab',
        transition: 'border 0.18s, background 0.18s',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', border: `1px solid ${colCfg.color}44` },
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          bgcolor: urgencyColor,
          borderRadius: '2px 0 0 2px',
        },
      }}
    >
      {/* Type badge + client */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 0.6, pl: 0.4 }}>
        <Chip
          label={`${TYPE_EMOJI[item.tp] ?? '📄'} ${item.tp}`}
          size="small"
          sx={{
            height: 16,
            fontSize: '0.48rem',
            fontWeight: 700,
            bgcolor: `${TYPE_COLOR[item.tp] ?? '#888'}18`,
            color: TYPE_COLOR[item.tp] ?? '#888',
            border: `1px solid ${TYPE_COLOR[item.tp] ?? '#888'}33`,
            flexShrink: 0,
          }}
        />
        <Typography
          sx={{ fontSize: '0.62rem', fontWeight: 800, color: colCfg.color, flex: 1, lineHeight: 1 }}
          noWrap
        >
          {item.c}
        </Typography>
      </Box>

      {/* Title */}
      <Typography
        sx={{ fontSize: '0.76rem', fontWeight: 700, color: 'rgba(255,255,255,0.88)', lineHeight: 1.3, mb: 0.9, pl: 0.4 }}
        noWrap
      >
        {state.title || item.n}
      </Typography>

      {/* Footer: date + actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, pl: 0.4 }}>
        <AccessTimeIcon sx={{ fontSize: 9, color: urgencyColor, flexShrink: 0 }} />
        <Typography
          sx={{
            fontSize: '0.58rem',
            color: urgencyColor,
            fontWeight: urgency === 'overdue' || urgency === 'today' ? 700 : 400,
            flex: 1,
            lineHeight: 1,
          }}
        >
          {dateLabel()}
        </Typography>

        {/* Quick action buttons — stop drag propagation */}
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 0.2 }}
          onPointerDown={e => e.stopPropagation()}
        >
          {driveLink && (
            <Tooltip title="Pasta Drive do cliente">
              <IconButton
                size="small"
                component="a"
                href={driveLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                sx={{ p: 0.35, color: '#31D17C', '&:hover': { bgcolor: 'rgba(52,211,153,0.12)' } }}
              >
                <FolderOpenIcon sx={{ fontSize: 11 }} />
              </IconButton>
            </Tooltip>
          )}
          {contentLink && (
            <Tooltip title="Ver criativo">
              <IconButton
                size="small"
                component="a"
                href={contentLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                sx={{ p: 0.35, color: '#3B82F6', '&:hover': { bgcolor: 'rgba(59,130,246,0.12)' } }}
              >
                <LinkIcon sx={{ fontSize: 11 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={copied ? 'Copiado!' : 'Copiar título'}>
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{
                p: 0.35,
                color: copied ? '#31D17C' : 'rgba(255,255,255,0.3)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
              }}
            >
              <ContentCopyIcon sx={{ fontSize: 11 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  )
}

// ── DraggableCard wrapper ─────────────────────────────────

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  return (
    <Box
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 999 : undefined,
        position: 'relative',
      }}
    >
      {children}
    </Box>
  )
}

// ── DroppableZone ─────────────────────────────────────────

function DroppableZone({
  status,
  color,
  children,
}: {
  status: Status
  color: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `design-col-${status}` })
  return (
    <Box
      ref={setNodeRef}
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 0.5,
        borderRadius: 2,
        minHeight: 80,
        border: `1px dashed ${isOver ? color + '66' : 'transparent'}`,
        bgcolor: isOver ? `${color}08` : 'transparent',
        transition: 'all 0.18s',
      }}
    >
      {children}
    </Box>
  )
}

// ── Props ─────────────────────────────────────────────────

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, status: Status) => void
  clientFolders: Record<string, string>
  now: Date
}

// ── Main DesignTab ────────────────────────────────────────

// Month key helpers
function toMonthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function parseMonthKey(key: string) { const [y, m] = key.split('-').map(Number); return { year: y, month: m - 1 } }
function monthLabel(key: string) {
  const { year, month } = parseMonthKey(key)
  return new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function DesignTab({ items, states, onStatusChange, clientFolders, now }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)

  // ── Month selector ───────────────────────────────────
  const [selectedMonthKey, setSelectedMonthKey] = useState(() => toMonthKey(now))

  const availableMonths = useMemo(() => {
    const keys = new Set<string>()
    items.forEach(i => { if (i.tp !== 'Reel') keys.add(toMonthKey(new Date(i.dt))) })
    return Array.from(keys).sort().reverse()
  }, [items])

  function stepMonth(dir: -1 | 1) {
    const idx = availableMonths.indexOf(selectedMonthKey)
    const next = availableMonths[idx + dir]
    if (next) setSelectedMonthKey(next)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  // Filter to design-relevant items — APENAS posts (sem Reels), statuses 0–3
  const designItems = useMemo(() =>
    items.filter(item => {
      if (item.tp === 'Reel') return false          // Reels ficam no painel do Editor
      const st = states[item.i]?.status ?? item.s
      return DESIGN_COLUMNS.some(c => c.status === st)
    }),
    [items, states],
  )

  // Group and sort by urgency (overdue first, then today, then future ascending)
  const itemsByStatus = useMemo(() => {
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    const map: Record<number, ContentItem[]> = {}
    DESIGN_COLUMNS.forEach(col => { map[col.status] = [] })

    designItems.forEach(item => {
      const st = states[item.i]?.status ?? item.s
      if (map[st] !== undefined) map[st].push(item)
    })

    const urgencyOrder = { overdue: 0, today: 1, tomorrow: 2, future: 3 }
    Object.keys(map).forEach(k => {
      map[Number(k)].sort((a, b) => {
        const ua = urgencyOrder[getUrgency(a.dt, today)]
        const ub = urgencyOrder[getUrgency(b.dt, today)]
        if (ua !== ub) return ua - ub
        return new Date(a.dt).getTime() - new Date(b.dt).getTime()
      })
    })

    return map
  }, [designItems, states, now])

  const activeItem = useMemo(
    () => (activeId ? items.find(i => String(i.i) === activeId) ?? null : null),
    [activeId, items],
  )

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const colId = String(over.id)
    if (!colId.startsWith('design-col-')) return
    const newStatus = Number(colId.replace('design-col-', '')) as Status
    const itemId = Number(active.id)
    const currentStatus = states[itemId]?.status ?? 0
    if (newStatus === currentStatus) return
    onStatusChange(itemId, newStatus)
  }, [states, onStatusChange])

  // ── KPIs ─────────────────────────────────────────────────
  const today = useMemo(() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d }, [now])

  const kpis = useMemo(() => {
    const todoCount = (itemsByStatus[0]?.length ?? 0) + (itemsByStatus[1]?.length ?? 0)
    const { month: selMonth, year: selYear } = parseMonthKey(selectedMonthKey)
    const isCurrentMonth = selMonth === now.getMonth() && selYear === now.getFullYear()

    const concluidos = isCurrentMonth ? items.filter(item => {
      if (item.tp === 'Reel') return false
      const st = states[item.i]?.status ?? item.s
      if (st < 5) return false
      const dt = new Date(item.dt); dt.setHours(0, 0, 0, 0)
      return dt.getTime() === today.getTime()
    }).length : null

    const entregues = items.filter(item => {
      if (item.tp === 'Reel') return false
      const st = states[item.i]?.status ?? item.s
      if (st < 5) return false
      const dt = new Date(item.dt)
      return dt.getMonth() === selMonth && dt.getFullYear() === selYear
    }).length

    const totalMonth = items.filter(item => {
      if (item.tp === 'Reel') return false
      const dt = new Date(item.dt)
      return dt.getMonth() === selMonth && dt.getFullYear() === selYear
    }).length

    const pct = totalMonth > 0 ? Math.round((entregues / totalMonth) * 100) : 0

    const aprovadoCliente = items.filter(item => {
      if (item.tp === 'Reel') return false
      const st = states[item.i]?.status ?? item.s
      const dt = new Date(item.dt)
      return (st === 5 || st === 7) && dt.getMonth() === selMonth && dt.getFullYear() === selYear
    }).length

    // Por tipo no mês selecionado
    const byType: Record<string, number> = {}
    items.forEach(item => {
      if (item.tp === 'Reel') return
      const dt = new Date(item.dt)
      if (dt.getMonth() !== selMonth || dt.getFullYear() !== selYear) return
      const st = states[item.i]?.status ?? item.s
      if (st < 5) return
      byType[item.tp] = (byType[item.tp] ?? 0) + 1
    })

    return { todoCount, concluidos, entregues, pct, aprovadoCliente, totalMonth, byType, isCurrentMonth }
  }, [itemsByStatus, items, states, today, now, selectedMonthKey])

  const jhones = NAME_MAP['jhones']

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Identidade + legenda ── */}
      <Stack direction="row" alignItems="center" justifyContent="space-between"
        flexWrap="wrap" gap={1} sx={{ px: { xs: 1.5, xl: 2.5 }, pt: { xs: 1, xl: 1.5 }, pb: 0.5, flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" gap={1.2}>
          <BrushIcon sx={{ color: jhones.color, fontSize: { xs: '1.1rem', xl: '1.4rem' } }} />
          <Typography fontWeight={700} sx={{ fontSize: { xs: '0.95rem', xl: '1.2rem' } }}>
            Painel de Design
          </Typography>
          <Chip
            avatar={<Avatar sx={{ bgcolor: jhones.color, fontSize: '0.7rem' }}>{jhones.emoji}</Avatar>}
            label={`${getDisplayName('jhones')} · ${jhones.role}`}
            size="small"
            sx={{ bgcolor: `${jhones.color}18`, border: `1px solid ${jhones.color}40`, color: jhones.color, fontWeight: 600, fontSize: '0.72rem' }}
          />
        </Stack>
        {/* Legenda de urgência */}
        <Stack direction="row" gap={1} flexWrap="wrap">
          {[
            { color: '#EF4444', label: 'Atrasado' },
            { color: '#60A5FA', label: 'Hoje' },
            { color: '#F59E0B', label: 'Amanhã' },
            { color: '#71717A', label: 'Futuro' },
          ].map(({ color, label }) => (
            <Stack key={label} direction="row" alignItems="center" gap={0.4}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
              <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>{label}</Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>

      {/* ── Month selector + KPIs ── */}
      <Box sx={{ px: { xs: 1.5, xl: 2.5 }, pt: 0.5, pb: 0, flexShrink: 0 }}>
        {/* Month nav */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <IconButton size="small" onClick={() => stepMonth(1)}
            disabled={availableMonths.indexOf(selectedMonthKey) >= availableMonths.length - 1}
            sx={{ p: 0.4, color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' }, '&.Mui-disabled': { color: 'rgba(255,255,255,0.1)' } }}>
            <ChevronLeftIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <TextField
            select size="small" value={selectedMonthKey}
            onChange={e => setSelectedMonthKey(e.target.value)}
            sx={{
              '& .MuiInputBase-root': { fontSize: '0.7rem', height: 26, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', fontWeight: 700 },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            {availableMonths.map(k => (
              <MenuItem key={k} value={k} sx={{ fontSize: '0.7rem' }}>
                {monthLabel(k)}{k === toMonthKey(now) ? ' · atual' : ''}
              </MenuItem>
            ))}
          </TextField>
          <IconButton size="small" onClick={() => stepMonth(-1)}
            disabled={availableMonths.indexOf(selectedMonthKey) === 0}
            sx={{ p: 0.4, color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' }, '&.Mui-disabled': { color: 'rgba(255,255,255,0.1)' } }}>
            <ChevronRightIcon sx={{ fontSize: 16 }} />
          </IconButton>
          {selectedMonthKey !== toMonthKey(now) && (
            <Chip label="Voltar ao mês atual" size="small" onClick={() => setSelectedMonthKey(toMonthKey(now))}
              sx={{ height: 20, fontSize: '0.58rem', cursor: 'pointer', bgcolor: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)' }} />
          )}
        </Box>

        {/* KPI cards */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
          {[
            { label: 'A fazer (fila atual)',  value: kpis.todoCount,       color: '#888' },
            ...(kpis.isCurrentMonth ? [{ label: 'Concluídos hoje', value: kpis.concluidos ?? 0, color: '#3B82F6' }] : []),
            { label: `Total no mês`,          value: kpis.totalMonth,      color: '#9CA3AF' },
            { label: `Entregues no mês`,      value: kpis.entregues,       color: '#3B82F6' },
            { label: '% concluído',           value: `${kpis.pct}%`,       color: '#31D17C' },
            { label: '🎉 Aprov. cliente',     value: kpis.aprovadoCliente, color: '#31D17C' },
          ].map(kpi => (
            <Box key={kpi.label} sx={{
              flex: 1, minWidth: { xs: 'calc(50% - 6px)', sm: 0 },
              p: 1.2, borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.04)',
              border: `1px solid ${kpi.color}22`,
            }}>
              <Typography sx={{ fontSize: '0.56rem', color: 'text.secondary', lineHeight: 1, mb: 0.4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {kpi.label}
              </Typography>
              <Typography sx={{ fontSize: '1.3rem', fontWeight: 900, color: kpi.color, lineHeight: 1 }}>
                {kpi.value}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Por tipo no mês */}
        {Object.keys(kpis.byType).length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.8, mt: 0.8, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.25)', alignSelf: 'center' }}>por tipo:</Typography>
            {Object.entries(kpis.byType).map(([tp, n]) => (
              <Chip key={tp} label={`${TYPE_EMOJI[tp] ?? ''} ${tp} · ${n}`} size="small"
                sx={{ height: 20, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' }} />
            ))}
          </Box>
        )}
      </Box>

      {/* ── Board ── */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Box sx={{
          flex: 1,
          overflowX: { xs: 'hidden', md: 'auto' },
          overflowY: { xs: 'auto', md: 'hidden' },
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 1.5,
          p: 1.5,
          alignItems: 'flex-start',
        }}>
          {DESIGN_COLUMNS.map(col => {
            const colItems = itemsByStatus[col.status] ?? []
            return (
              <Box
                key={col.status}
                sx={{
                  flex: { xs: 'unset', md: '0 0 240px', xl: '0 0 280px' },
                  width: { xs: '100%', md: 240, xl: 280 },
                  maxHeight: { xs: 'unset', md: '100%' },
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Column header */}
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 0.8, mb: 1, px: 1.2, py: 0.9,
                  borderRadius: 2,
                  bgcolor: `${col.color}0c`,
                  border: `1px solid ${col.color}22`,
                  flexShrink: 0,
                }}>
                  <Box sx={{
                    width: 7, height: 7, borderRadius: '50%',
                    bgcolor: col.color,
                    flexShrink: 0,
                  }} />
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: col.color, flex: 1, lineHeight: 1 }} noWrap>
                    {col.label}
                  </Typography>
                  <Box sx={{
                    minWidth: 20, height: 18, borderRadius: 3,
                    bgcolor: `${col.color}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.7,
                  }}>
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: col.color, lineHeight: 1 }}>
                      {colItems.length}
                    </Typography>
                  </Box>
                </Box>

                {/* Cards scroll area */}
                <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 300 }}>
                  <DroppableZone status={col.status} color={col.color}>
                    {colItems.map(item => {
                      const itemState = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
                      return (
                        <DraggableCard key={item.i} id={String(item.i)}>
                          <DesignCard
                            item={item}
                            state={itemState}
                            clientFolders={clientFolders}
                            now={now}
                            isDragging={activeId === String(item.i)}
                          />
                        </DraggableCard>
                      )
                    })}
                    {colItems.length === 0 && (
                      <Box sx={{ py: 4, textAlign: 'center', opacity: 0.25 }}>
                        <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>Vazio</Typography>
                      </Box>
                    )}
                  </DroppableZone>
                </Box>
              </Box>
            )
          })}
        </Box>

        {/* Drag overlay */}
        <DragOverlay dropAnimation={{ duration: 160, easing: 'ease-out' }}>
          {activeItem && (
            <Box sx={{ transform: 'rotate(2deg)', opacity: 0.9 }}>
              <DesignCard
                item={activeItem}
                state={states[activeItem.i] ?? { status: activeItem.s, title: '', link: '', caption: '', notes: '' }}
                clientFolders={clientFolders}
                now={now}
              />
            </Box>
          )}
        </DragOverlay>
      </DndContext>
    </Box>
  )
}
