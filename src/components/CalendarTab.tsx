import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Box, Typography, Paper, IconButton, Chip, Stack,
  Dialog, DialogTitle, DialogContent, Divider, Button,
  TextField, MenuItem, ToggleButtonGroup, ToggleButton, Tooltip,
  DialogActions, useMediaQuery,
} from '@mui/material'
import InstagramIcon from '@mui/icons-material/Instagram'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import InstagramScheduleModal from './InstagramScheduleModal'
import EditItemDialog from './EditItemDialog'
import { fetchAllIGSchedules, type IGSchedule } from '../lib/instagram'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { STATUS_CONFIG, type Client, type ContentItem, type ContentType, type ItemEditPatch, type ItemState, type Status } from '../types'
import { NAME_MAP } from '../lib/users'
import ContentCard from './ContentCard'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
  onStatusChange?: (id: number, s: Status) => void
  onUpdate?: (id: number, patch: Partial<ItemState>) => void
  onDelete?: (id: number) => void
  onEdit?: (id: number, patch: ItemEditPatch) => void
  onDuplicate?: (id: number) => void
  clientColors?: Record<string, string>
  clientHashtags?: Record<string, string[]>
  onSaveHashtags?: (clientName: string, tags: string[]) => void
  captionTemplates?: Record<string, string[]>
  onSaveTemplates?: (clientName: string, templates: string[]) => void
  onReschedule?: (id: number, newDate: Date) => void
  onAddItem?: (clientName: string, title: string, type: ContentType, date: Date, status: Status, responsible?: string, notes?: string, footageLink?: string, roteiroLink?: string, deliveryDate?: number) => void
  allClients?: Client[]
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const CLIENT_COLORS = [
  '#ff9039','#3B8EFF','#00C47A','#FFD700','#FF4545',
  '#B47AFF','#FF69B4','#00CED1','#FFA500','#7CFC00',
  '#FF6347','#9370DB','#20B2AA','#F08080','#98FB98',
  '#87CEEB','#DDA0DD',
]

function getClientColor(clientName: string, clientList: string[]): string {
  const idx = clientList.indexOf(clientName)
  return CLIENT_COLORS[idx % CLIENT_COLORS.length] ?? '#ff9039'
}

function shortName(name: string): string {
  const words = name.split(' ')
  const skip = ['de', 'da', 'do', 'e', 'a', 'o', "d'"]
  const first = words.find(w => !skip.includes(w.toLowerCase())) ?? words[0]
  return first.length > 8 ? first.slice(0, 8) : first
}

// ── Item arrastável ───────────────────────────────────
function DraggableItem({
  item, color, isDraggingActive,
}: { item: ContentItem; color: string; isDraggingActive: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.i })

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title={`${item.n} — ${item.c} (${item.tp})`}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.3,
        width: '100%', minHeight: 14, px: 0.5,
        borderRadius: 0.5,
        borderLeft: `2.5px solid ${color}`,
        bgcolor: isDragging ? 'transparent' : `${color}18`,
        opacity: isDragging ? 0 : isDraggingActive ? 0.5 : 1,
        cursor: 'grab',
        touchAction: 'none',
        userSelect: 'none',
        overflow: 'hidden',
        flexShrink: 0,
        transition: 'opacity 0.1s, background 0.1s',
        '&:active': { cursor: 'grabbing', bgcolor: `${color}30` },
      }}
    >
      <Box sx={{ width: 4, height: 4, borderRadius: item.tp === 'Reel' ? 0.5 : '50%', bgcolor: color, flexShrink: 0 }} />
      <Typography sx={{ fontSize: '0.4rem', color, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.1, flex: 1 }}>
        {shortName(item.c)}
      </Typography>
    </Box>
  )
}

// ── Célula do dia (droppável) ─────────────────────────
function DroppableDay({
  day, info, isToday, isPast, allDone, hasLate, isWeekend, clientList,
  dayItems, isDraggingActive, onClick, canCreate, isOverloaded,
}: {
  day: number
  info: { count: number; published: number; clients: string[] } | undefined
  isToday: boolean
  isPast?: boolean
  allDone: boolean
  hasLate: boolean
  isWeekend: boolean
  clientList: string[]
  dayItems: ContentItem[]
  isDraggingActive: boolean
  onClick: () => void
  canCreate: boolean
  isOverloaded?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` })
  const hasItems = info && info.count > 0

  return (
    <Paper
      ref={setNodeRef}
      onClick={onClick}
      sx={{
        p: 0.6, minHeight: { xs: 60, sm: 76 },
        display: 'flex', flexDirection: 'column', gap: 0.25,
        borderRadius: 2, border: '1px solid',
        borderColor: isOver ? 'primary.main' : isToday ? 'primary.main' : allDone ? 'rgba(0,196,122,0.3)' : hasLate ? 'rgba(255,69,69,0.25)' : 'rgba(255,255,255,0.05)',
        bgcolor: isOver ? 'rgba(255,144,57,0.12)' : isToday ? 'rgba(255,144,57,0.08)' : allDone ? 'rgba(0,196,122,0.05)' : hasLate ? 'rgba(255,69,69,0.05)' : isWeekend ? 'rgba(255,255,255,0.01)' : 'background.paper',
        cursor: 'pointer',
        transition: 'all 0.12s',
        boxShadow: isToday ? '0 0 0 1px rgba(255,144,57,0.3)' : isOver ? '0 0 12px rgba(255,144,57,0.2)' : 'none',
        '&:hover': {
          borderColor: hasItems ? 'primary.main' : canCreate ? 'rgba(255,144,57,0.3)' : undefined,
          transform: 'scale(1.015)',
          '& .add-hint': { opacity: 1 },
        },
        position: 'relative', overflow: 'hidden',
      }}
    >
      {isToday && (
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#ff9039,#ff5339)' }} />
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: { xs: '0.65rem', sm: '0.8rem' }, fontWeight: isToday ? 800 : 600, color: isToday ? 'primary.main' : isWeekend ? 'text.disabled' : 'text.primary', lineHeight: 1 }}>
          {day}
        </Typography>
        {isOverloaded && (
          <Box sx={{ width: 13, height: 13, borderRadius: '50%', bgcolor: '#FF9A3D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Typography sx={{ fontSize: '0.45rem', color: '#000', fontWeight: 900, lineHeight: 1 }}>!</Typography>
          </Box>
        )}
      </Box>

      {hasItems ? (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2, flex: 1, width: '100%', overflow: 'hidden' }}>
            {dayItems.slice(0, 4).map(item => (
              <DraggableItem key={item.i} item={item} color={getClientColor(item.c, clientList)} isDraggingActive={isDraggingActive} />
            ))}
            {dayItems.length > 4 && (
              <Typography sx={{ fontSize: '0.38rem', color: 'text.disabled', pl: 0.5, lineHeight: 1 }}>
                +{dayItems.length - 4}
              </Typography>
            )}
          </Box>
          <Box sx={{ width: '100%', height: 2, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${(info.published / info.count) * 100}%`, bgcolor: allDone ? 'success.main' : 'primary.main', borderRadius: 1 }} />
          </Box>
        </>
      ) : (
        /* Empty day — hint to create */
        canCreate && !isDraggingActive && (
          <Box className="add-hint" sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}>
            <Box sx={{ width: 16, height: 16, borderRadius: '50%', border: '1px dashed rgba(255,144,57,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,144,57,0.6)', lineHeight: 1 }}>+</Typography>
            </Box>
          </Box>
        )
      )}

      {isDraggingActive && !hasItems && (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: '0.45rem', color: 'text.disabled' }}>+</Typography>
        </Box>
      )}
    </Paper>
  )
}

// ── CalendarTab ────────────────────────────────────────
export default function CalendarTab({
  items, states, now, onStatusChange, onUpdate, onDelete, onEdit, onDuplicate,
  clientColors, clientHashtags, onSaveHashtags, captionTemplates, onSaveTemplates,
  onReschedule, onAddItem, allClients,
}: Props) {
  const isMobile = useMediaQuery('(max-width:600px)')

  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [filterClient, setFilterClient] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'producao' | 'cliente' | 'aprovado' | 'reprovado' | 'publicado'>('all')
  const [activeId, setActiveId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'month' | 'week'>(isMobile ? 'week' : 'month')
  const [weekOffset, setWeekOffset] = useState(0)

  // ── Instagram schedule state ──────────────────────────
  const [igModalOpen, setIgModalOpen] = useState(false)
  const [igItem, setIgItem] = useState<ContentItem | null>(null)
  const [igSchedules, setIgSchedules] = useState<IGSchedule[]>([])

  const handleIgPublished = useCallback((itemId: number) => {
    onStatusChange?.(itemId, 7 as Status)
  }, [onStatusChange])

  // Busca agendamentos IG a cada 60s para mostrar badges
  useEffect(() => {
    fetchAllIGSchedules().then(setIgSchedules)
    const id = setInterval(() => fetchAllIGSchedules().then(setIgSchedules), 60_000)
    return () => clearInterval(id)
  }, [])

  // Mapa item_id → agendamento mais recente ativo
  const igByItemId = useMemo(() => {
    const map = new Map<number, IGSchedule>()
    igSchedules.forEach(s => {
      const existing = map.get(s.item_id)
      if (!existing || s.status === 'published' || (existing.status === 'cancelled' && s.status !== 'cancelled')) {
        map.set(s.item_id, s)
      }
    })
    return map
  }, [igSchedules])

  // ── Edit item state ───────────────────────────────────
  const [editCalItem, setEditCalItem] = useState<ContentItem | null>(null)

  // ── Create dialog state ───────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [createDay, setCreateDay] = useState<number>(now.getDate())
  const [createClient, setCreateClient] = useState('')
  const [createTitle, setCreateTitle] = useState('')
  const [createType, setCreateType] = useState<ContentType>('Post')
  const [createTime, setCreateTime] = useState('09:00')
  const [createResponsible, setCreateResponsible] = useState('')
  const [createNotes, setCreateNotes] = useState('')
  const [createStatus, setCreateStatus] = useState<Status>(0)
  const [createDeliveryDate, setCreateDeliveryDate] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today        = now.getDate()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month

  const clientList = useMemo(() => Array.from(new Set(items.map(i => i.c))).sort(), [items])
  const clientNameList = useMemo(() => allClients?.map(c => c.name).sort() ?? clientList, [allClients, clientList])

  const filteredItems = useMemo(() => {
    let list = filterClient ? items.filter(i => i.c === filterClient) : items
    if (filterStatus !== 'all') {
      list = list.filter(i => {
        const s = states[i.i]?.status ?? i.s
        if (filterStatus === 'producao') return s <= 3
        if (filterStatus === 'cliente')  return s === 4
        if (filterStatus === 'aprovado') return s === 5
        if (filterStatus === 'reprovado') return s === 6
        if (filterStatus === 'publicado') return s === 7
        return true
      })
    }
    return list
  }, [items, states, filterClient, filterStatus])

  const monthKpis = useMemo(() => {
    const base = filterClient ? items.filter(i => i.c === filterClient) : items
    const thisMonth = base.filter(i => i.dt.getFullYear() === year && i.dt.getMonth() === month)
    let total = 0, producao = 0, cliente = 0, aprovado = 0, reprovado = 0, publicado = 0
    thisMonth.forEach(i => {
      const s = states[i.i]?.status ?? i.s
      total++
      if (s <= 3) producao++
      else if (s === 4) cliente++
      else if (s === 5) aprovado++
      else if (s === 6) reprovado++
      else if (s === 7) publicado++
    })
    return { total, producao, cliente, aprovado, reprovado, publicado }
  }, [items, states, filterClient, year, month])

  const dayMap = useMemo(() => {
    const map = new Map<number, { count: number; published: number; clients: string[] }>()
    filteredItems
      .filter(i => i.dt.getFullYear() === year && i.dt.getMonth() === month)
      .forEach(item => {
        const d   = item.dt.getDate()
        const cur = map.get(d) ?? { count: 0, published: 0, clients: [] }
        const s   = states[item.i]?.status ?? item.s
        const sc  = shortName(item.c)
        map.set(d, {
          count:     cur.count + 1,
          published: cur.published + (s === 7 ? 1 : 0),
          clients:   cur.clients.includes(sc) ? cur.clients : [...cur.clients, sc],
        })
      })
    return map
  }, [filteredItems, states, year, month])

  const itemsByDay = useMemo(() => {
    const map = new Map<number, ContentItem[]>()
    filteredItems
      .filter(i => i.dt.getFullYear() === year && i.dt.getMonth() === month)
      .forEach(item => {
        const d = item.dt.getDate()
        if (!map.has(d)) map.set(d, [])
        map.get(d)!.push(item)
      })
    return map
  }, [filteredItems, year, month])

  const monthTotals = useMemo(() => {
    let count = 0, published = 0
    dayMap.forEach(v => { count += v.count; published += v.published })
    return { count, published, pct: count ? Math.round((published / count) * 100) : 0 }
  }, [dayMap])

  // ── Overload detection: client with ≥2 unpublished posts same day ──
  const overloadMap = useMemo(() => {
    const result = new Map<number, { client: string; items: ContentItem[] }[]>()
    const byDayClient = new Map<number, Map<string, ContentItem[]>>()
    items
      .filter(i => i.dt.getFullYear() === year && i.dt.getMonth() === month && (states[i.i]?.status ?? i.s) !== 7)
      .forEach(item => {
        const d = item.dt.getDate()
        if (!byDayClient.has(d)) byDayClient.set(d, new Map())
        const cm = byDayClient.get(d)!
        if (!cm.has(item.c)) cm.set(item.c, [])
        cm.get(item.c)!.push(item)
      })
    byDayClient.forEach((cm, day) => {
      const overloads: { client: string; items: ContentItem[] }[] = []
      cm.forEach((clientItems, client) => { if (clientItems.length >= 2) overloads.push({ client, items: clientItems }) })
      if (overloads.length > 0) result.set(day, overloads)
    })
    return result
  }, [items, states, year, month])

  const handleRedistribute = useCallback((day: number, clientName: string) => {
    if (!onReschedule) return
    const clientMonthItems = items.filter(i =>
      i.dt.getFullYear() === year && i.dt.getMonth() === month &&
      i.c === clientName && (states[i.i]?.status ?? i.s) !== 7
    )
    const occupiedDays = new Set(clientMonthItems.map(i => i.dt.getDate()))
    const itemsOnDay = clientMonthItems.filter(i => i.dt.getDate() === day).sort((a, b) => a.i - b.i)
    let searchDay = day + 1
    for (const item of itemsOnDay.slice(1)) {
      while (searchDay <= daysInMonth && occupiedDays.has(searchDay)) searchDay++
      if (searchDay > daysInMonth) break
      onReschedule(item.i, new Date(year, month, searchDay))
      occupiedDays.add(searchDay)
      searchDay++
    }
    setSelectedDay(null)
  }, [items, states, year, month, daysInMonth, onReschedule])

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const selectedItems = useMemo(() => {
    if (!selectedDay) return []
    return filteredItems.filter(i => i.dt.getFullYear() === year && i.dt.getMonth() === month && i.dt.getDate() === selectedDay)
  }, [selectedDay, year, month, filteredItems])

  const activeItem = useMemo(() =>
    activeId != null ? items.find(i => i.i === activeId) ?? null : null,
    [activeId, items])

  // ── Week view ─────────────────────────────────────────
  const weekDays = useMemo(() => {
    const todayDate = new Date(now); todayDate.setHours(0, 0, 0, 0)
    const dayOfWeek = todayDate.getDay() === 0 ? 6 : todayDate.getDay() - 1
    const monday = new Date(todayDate.getTime() - dayOfWeek * 86_400_000 + weekOffset * 7 * 86_400_000)
    return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86_400_000))
  }, [now, weekOffset])

  const weekItems = useMemo(() => {
    const map = new Map<string, ContentItem[]>()
    weekDays.forEach(d => map.set(d.toISOString().slice(0, 10), []))
    filteredItems.forEach(item => {
      const key = item.dt.toISOString().slice(0, 10)
      if (map.has(key)) map.get(key)!.push(item)
    })
    return map
  }, [filteredItems, weekDays])

  function handleDragStart(e: DragStartEvent) { setActiveId(e.active.id as number) }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { over, active } = e
    if (!over || !onReschedule) return
    const droppableId = String(over.id)
    if (!droppableId.startsWith('day-')) return
    const newDay = parseInt(droppableId.replace('day-', ''), 10)
    const itemId = active.id as number
    const currentItem = items.find(i => i.i === itemId)
    if (!currentItem) return
    const currentDay = currentItem.dt.getDate()
    if (newDay === currentDay && currentItem.dt.getMonth() === month && currentItem.dt.getFullYear() === year) return
    onReschedule(itemId, new Date(year, month, newDay))
  }

  // ── Create handlers ───────────────────────────────────
  function openCreateForDay(day: number) {
    setCreateDay(day)
    setCreateClient(filterClient ?? clientNameList[0] ?? '')
    setCreateTitle('')
    setCreateType('Post')
    const h = now.getHours()
    setCreateTime(`${String(h).padStart(2,'0')}:00`)
    setCreateResponsible('')
    setCreateNotes('')
    setCreateStatus(0)
    setCreateDeliveryDate('')
    setCreateOpen(true)
  }

  function handleDayClick(day: number) {
    const hasItems = (dayMap.get(day)?.count ?? 0) > 0
    if (hasItems) {
      setSelectedDay(day)
    } else if (onAddItem) {
      openCreateForDay(day)
    }
  }

  function submitCreate() {
    if (!onAddItem || !createClient || !createTitle.trim()) return
    const [h, m] = createTime.split(':').map(Number)
    const date = new Date(year, month, createDay, h, m)
    const deliveryTs = createDeliveryDate ? new Date(createDeliveryDate + 'T12:00:00').getTime() : undefined
    onAddItem(createClient, createTitle.trim(), createType, date, createStatus, createResponsible || undefined, createNotes || undefined, undefined, undefined, deliveryTs)
    setCreateOpen(false)
    // Open the day modal to show the newly created item
    setSelectedDay(createDay)
  }

  const teamMembers = Object.entries(NAME_MAP).map(([key, val]) => ({ key, ...val }))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" onClick={() => viewMode === 'month' ? setViewDate(new Date(year, month - 1, 1)) : setWeekOffset(w => w - 1)}>
              <ChevronLeftIcon />
            </IconButton>
            <Box sx={{ textAlign: 'center', minWidth: 120 }}>
              {viewMode === 'month' ? (
                <>
                  <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1, background: 'linear-gradient(90deg,#ff9039,#ff5339)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {MONTHS[month]}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{year}</Typography>
                </>
              ) : (
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.3 }}>
                  {weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  {' – '}
                  {weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </Typography>
              )}
            </Box>
            <IconButton size="small" onClick={() => viewMode === 'month' ? setViewDate(new Date(year, month + 1, 1)) : setWeekOffset(w => w + 1)}>
              <ChevronRightIcon />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
            <Chip label={`${monthTotals.published}/${monthTotals.count}`} size="small" color={monthTotals.pct === 100 ? 'success' : 'default'} variant="outlined" sx={{ fontSize: '0.6rem' }} />
            <Chip label={`${monthTotals.pct}%`} size="small" color={monthTotals.pct === 100 ? 'success' : monthTotals.pct >= 50 ? 'warning' : 'error'} sx={{ fontSize: '0.62rem', fontWeight: 700 }} />

            {/* Botão criar novo */}
            {onAddItem && (
              <Tooltip title="Criar novo conteúdo">
                <Button
                  size="small"
                  startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                  onClick={() => openCreateForDay(isCurrentMonth ? today : 1)}
                  sx={{
                    fontSize: '0.6rem', fontWeight: 800, px: 1.2, py: 0.4,
                    border: '1px solid rgba(255,144,57,0.4)',
                    color: 'primary.main', borderRadius: 2,
                    '&:hover': { bgcolor: 'rgba(255,144,57,0.1)' },
                  }}
                >
                  Criar
                </Button>
              </Tooltip>
            )}

            <Box sx={{ display: 'flex', borderRadius: 1.5, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              {(['month', 'week'] as const).map(mode => (
                <Box key={mode} onClick={() => { setViewMode(mode); if (mode === 'week') setWeekOffset(0) }}
                  sx={{
                    px: 1.2, py: 0.4, fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
                    bgcolor: viewMode === mode ? 'rgba(255,144,57,0.15)' : 'transparent',
                    color: viewMode === mode ? 'primary.main' : 'text.disabled',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: viewMode === mode ? 'rgba(255,144,57,0.2)' : 'rgba(255,255,255,0.04)' },
                  }}>
                  {mode === 'month' ? 'Mês' : 'Semana'}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Filtro por cliente */}
        <Stack direction="row" spacing={0.6} sx={{ overflowX: 'auto', pb: 0.5 }}>
          <Chip label="Todos" size="small" variant={filterClient ? 'outlined' : 'filled'} color="primary"
            onClick={() => setFilterClient(null)} sx={{ flexShrink: 0, fontSize: '0.6rem' }} />
          {clientList.map(c => (
            <Chip key={c} label={shortName(c)} size="small"
              variant={filterClient === c ? 'filled' : 'outlined'}
              onClick={() => setFilterClient(prev => prev === c ? null : c)}
              sx={{
                flexShrink: 0, fontSize: '0.58rem',
                borderColor: filterClient === c ? getClientColor(c, clientList) : undefined,
                bgcolor: filterClient === c ? `${getClientColor(c, clientList)}22` : undefined,
                color: filterClient === c ? getClientColor(c, clientList) : undefined,
              }} />
          ))}
        </Stack>
      </Box>

      {/* ── Banner de sobrecarga ── */}
      {overloadMap.size > 0 && viewMode === 'month' && (
        <Box sx={{ mx: 1, mb: 0.5, px: 1.5, py: 0.7, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(255,154,61,0.07)', border: '1px solid rgba(255,154,61,0.25)' }}>
          <WarningAmberIcon sx={{ fontSize: 14, color: '#FF9A3D', flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.68rem', color: '#FF9A3D', fontWeight: 700, flex: 1 }}>
            {overloadMap.size} dia{overloadMap.size !== 1 ? 's' : ''} com sobrecarga — cliente com 2+ posts no mesmo dia
          </Typography>
          <ShuffleIcon sx={{ fontSize: 12, color: 'rgba(255,154,61,0.5)' }} />
        </Box>
      )}

      {/* Legenda dias da semana */}
      {viewMode === 'month' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', px: 1, mb: 0.3 }}>
          {WEEKDAYS.map((d, i) => (
            <Typography key={d} variant="caption" sx={{ textAlign: 'center', fontWeight: 700, fontSize: '0.55rem', py: 0.3, color: i === 0 || i === 6 ? 'text.disabled' : 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {d}
            </Typography>
          ))}
        </Box>
      )}

      {/* ── Área principal ───────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: 'hidden', px: 1, pb: 1, display: 'flex', flexDirection: 'column' }}>
        {viewMode === 'month' ? (
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
                {cells.map((day, idx) => {
                  if (!day) return <Box key={`e-${idx}`} />

                  const info     = dayMap.get(day)
                  const dayItems = itemsByDay.get(day) ?? []
                  const isToday  = isCurrentMonth && day === today
                  const isPast   = isCurrentMonth ? day < today : year < now.getFullYear() || month < now.getMonth()
                  const allDone  = info ? info.count > 0 && info.published === info.count : false
                  const hasLate  = info ? isPast && info.published < info.count : false
                  const isWeekend = ((firstDay + day - 1) % 7 === 0 || (firstDay + day - 1) % 7 === 6)

                  return (
                    <DroppableDay
                      key={day}
                      day={day}
                      info={info}
                      isToday={isToday}
                      isPast={isPast}
                      allDone={allDone}
                      hasLate={hasLate}
                      isWeekend={isWeekend}
                      clientList={clientList}
                      dayItems={dayItems}
                      isDraggingActive={activeId !== null}
                      onClick={() => handleDayClick(day)}
                      canCreate={!!onAddItem}
                      isOverloaded={overloadMap.has(day)}
                    />
                  )
                })}
              </Box>

              <DragOverlay>
                {activeItem && (
                  <Box sx={{ px: 1, py: 0.6, bgcolor: 'background.paper', border: '1px solid', borderColor: 'primary.main', borderRadius: 1.5, boxShadow: '0 8px 24px rgba(255,144,57,0.3)', cursor: 'grabbing', minWidth: 100 }}>
                    <Typography sx={{ fontSize: '0.58rem', color: 'primary.main', fontWeight: 700 }}>{activeItem.c}</Typography>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600 }} noWrap>{activeItem.n}</Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary' }}>{activeItem.tp} · {activeItem.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</Typography>
                  </Box>
                )}
              </DragOverlay>
            </DndContext>

            {activeId !== null && (
              <Box sx={{ textAlign: 'center', py: 0.5 }}>
                <Typography variant="caption" color="primary.main" sx={{ fontSize: '0.6rem' }}>
                  Solte em outro dia para reagendar
                </Typography>
              </Box>
            )}
          </Box>
        ) : (
          /* ── Semana ─────────────────────────────────────── */
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.8, flex: 1, overflow: 'hidden' }}>
            {weekDays.map(day => {
              const y = day.getFullYear(), m = day.getMonth(), d = day.getDate()
              const dayItemsW  = weekItems.get(day.toISOString().slice(0, 10)) ?? []
              const isToday    = day.toDateString() === now.toDateString()
              const isPastDay  = day < new Date(now.getFullYear(), now.getMonth(), now.getDate())
              const allDoneW   = dayItemsW.length > 0 && dayItemsW.every(it => (states[it.i]?.status ?? it.s) === 7)
              const hasLateW   = isPastDay && dayItemsW.some(it => (states[it.i]?.status ?? it.s) !== 7)
              const dayName    = WEEKDAYS[day.getDay()]

              return (
                <Box key={day.toISOString().slice(0,10)} sx={{
                  display: 'flex', flexDirection: 'column', borderRadius: 2, border: '1px solid',
                  borderColor: isToday ? 'primary.main' : allDoneW ? 'rgba(0,196,122,0.25)' : hasLateW ? 'rgba(255,59,48,0.2)' : 'rgba(255,255,255,0.06)',
                  bgcolor: isToday ? 'rgba(255,144,57,0.04)' : allDoneW ? 'rgba(0,196,122,0.03)' : 'background.paper',
                  overflow: 'hidden',
                }}>
                  {/* Day header */}
                  <Box sx={{ px: 0.8, py: 0.7, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', bgcolor: isToday ? 'rgba(255,144,57,0.1)' : 'transparent', position: 'relative', flexShrink: 0 }}>
                    {isToday && <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#ff9039,#ff5339)' }} />}
                    <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: isToday ? 'primary.main' : 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1 }}>{dayName}</Typography>
                    <Typography sx={{ fontSize: '1.05rem', fontWeight: isToday ? 900 : 600, color: isToday ? 'primary.main' : 'text.primary', lineHeight: 1.15 }}>{d}</Typography>
                    {dayItemsW.length > 0 && (
                      <Typography sx={{ fontSize: '0.42rem', color: allDoneW ? 'success.main' : isToday ? 'primary.main' : 'text.disabled', lineHeight: 1, mt: 0.2 }}>
                        {dayItemsW.length} item{dayItemsW.length !== 1 ? 's' : ''}
                      </Typography>
                    )}
                  </Box>

                  {/* Items */}
                  <Box sx={{ flex: 1, overflowY: 'auto', p: 0.4, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                    {dayItemsW.map(item => {
                      const st  = states[item.i]?.status ?? item.s
                      const cfg = STATUS_CONFIG[st]
                      const color = getClientColor(item.c, clientList)
                      return (
                        <Box key={item.i} onClick={() => { setViewDate(new Date(y, m, 1)); setSelectedDay(d) }}
                          sx={{ px: 0.7, py: 0.5, borderRadius: 1.5, borderLeft: `3px solid ${color}`, bgcolor: `${color}12`, cursor: 'pointer', transition: 'all 0.12s', '&:hover': { bgcolor: `${color}22` } }}>
                          <Typography sx={{ fontSize: '0.5rem', color, fontWeight: 800, lineHeight: 1 }} noWrap>{shortName(item.c)}</Typography>
                          <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)', lineHeight: 1.25, mt: 0.15 }} noWrap>{states[item.i]?.title || item.n}</Typography>
                          <Box sx={{ display: 'flex', gap: 0.3, mt: 0.3, alignItems: 'center' }}>
                            <Box sx={{ px: 0.5, py: 0.1, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.07)' }}>
                              <Typography sx={{ fontSize: '0.4rem', color: 'text.disabled', lineHeight: 1 }}>{item.tp}</Typography>
                            </Box>
                            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: cfg.dot, flexShrink: 0 }} />
                            <Typography sx={{ fontSize: '0.4rem', color: cfg.color, lineHeight: 1, flex: 1 }} noWrap>{cfg.shortLabel}</Typography>
                          </Box>
                        </Box>
                      )
                    })}

                    {/* Add button in week view */}
                    {onAddItem && (
                      <Box onClick={() => openCreateForDay(d)} sx={{
                        py: 0.6, borderRadius: 1.5, border: '1px dashed rgba(255,144,57,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.3,
                        cursor: 'pointer', opacity: dayItemsW.length === 0 ? 0.5 : 0,
                        transition: 'opacity 0.15s, border-color 0.15s',
                        '&:hover': { opacity: 1, borderColor: 'rgba(255,144,57,0.5)', bgcolor: 'rgba(255,144,57,0.04)' },
                      }}>
                        <AddIcon sx={{ fontSize: 10, color: 'rgba(255,144,57,0.6)' }} />
                        <Typography sx={{ fontSize: '0.45rem', color: 'rgba(255,144,57,0.6)', lineHeight: 1 }}>criar</Typography>
                      </Box>
                    )}

                    {dayItemsW.length === 0 && !onAddItem && (
                      <Typography sx={{ fontSize: '0.5rem', color: 'text.disabled', textAlign: 'center', mt: 1.5, opacity: 0.4 }}>—</Typography>
                    )}
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}
      </Box>

      {/* ── Modal do dia (conteúdos existentes) ──────────── */}
      <Dialog
        open={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: 'background.paper', border: '1px solid rgba(255,144,57,0.2)', borderRadius: 3, maxHeight: '90vh' } } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                {selectedDay && new Date(year, month, selectedDay).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedItems.length} conteúdo{selectedItems.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
              {onAddItem && (
                <Tooltip title="Criar novo conteúdo neste dia">
                  <Button
                    size="small"
                    startIcon={<AddIcon sx={{ fontSize: 13 }} />}
                    onClick={() => { setSelectedDay(null); if (selectedDay) openCreateForDay(selectedDay) }}
                    sx={{ fontSize: '0.65rem', fontWeight: 800, px: 1.2, py: 0.4, border: '1px solid rgba(255,144,57,0.4)', color: 'primary.main', borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,144,57,0.1)' } }}
                  >
                    Criar aqui
                  </Button>
                </Tooltip>
              )}
              <IconButton size="small" onClick={() => setSelectedDay(null)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <Divider sx={{ opacity: 0.1 }} />
        <DialogContent sx={{ pt: 1.5 }}>

          {/* Alertas de sobrecarga */}
          {selectedDay && overloadMap.has(selectedDay) && overloadMap.get(selectedDay)!.map(({ client, items: overItems }) => (
            <Box key={client} sx={{ mb: 1.5, px: 1.5, py: 1, borderRadius: 2, bgcolor: 'rgba(255,154,61,0.08)', border: '1px solid rgba(255,154,61,0.3)', display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningAmberIcon sx={{ fontSize: 15, color: '#FF9A3D', flexShrink: 0 }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.7rem', color: '#FF9A3D', fontWeight: 800, lineHeight: 1.2 }}>
                  {client} — {overItems.length} posts no mesmo dia
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', lineHeight: 1.3 }}>
                  Recomendado: 1 post por cliente por dia
                </Typography>
              </Box>
              {onReschedule && (
                <Button size="small" onClick={() => handleRedistribute(selectedDay, client)}
                  startIcon={<ShuffleIcon sx={{ fontSize: 12 }} />}
                  sx={{ fontSize: '0.62rem', fontWeight: 800, px: 1.2, py: 0.4, flexShrink: 0, bgcolor: 'rgba(255,154,61,0.15)', color: '#FF9A3D', border: '1px solid rgba(255,154,61,0.35)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,154,61,0.25)' } }}>
                  Redistribuir
                </Button>
              )}
            </Box>
          ))}

          {selectedItems.map(item => {
            const st = states[item.i]?.status ?? item.s
            const isApproved = st === 2 || st === 3 || st === 5
            return (
              <Box key={item.i} sx={{ position: 'relative' }}>
                {/* Editar metadados do item */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
                  <Tooltip title="Editar título, tipo e data">
                    <Button
                      size="small"
                      startIcon={<EditIcon sx={{ fontSize: 12 }} />}
                      onClick={() => setEditCalItem(item)}
                      sx={{
                        fontSize: '0.58rem', fontWeight: 700, px: 1, py: 0.3,
                        color: 'rgba(255,144,57,0.7)', border: '1px solid rgba(255,144,57,0.2)',
                        borderRadius: 1.5,
                        '&:hover': { bgcolor: 'rgba(255,144,57,0.08)', borderColor: 'rgba(255,144,57,0.4)', color: 'primary.main' },
                      }}
                    >
                      Editar
                    </Button>
                  </Tooltip>
                </Box>
                <ContentCard
                  item={item}
                  state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }}
                  now={now}
                  onStatusChange={onStatusChange ?? (() => {})}
                  onUpdate={onUpdate ?? (() => {})}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onDuplicate={onDuplicate}
                  clientColor={clientColors?.[item.c]}
                  clientHashtags={clientHashtags?.[item.c]}
                  onSaveHashtags={onSaveHashtags ? (tags) => onSaveHashtags(item.c, tags) : undefined}
                  captionTemplates={captionTemplates?.[item.c]}
                  onSaveTemplates={onSaveTemplates}
                  igStatus={(() => {
                    const s = igByItemId.get(item.i)?.status
                    if (!s) return null
                    return s === 'published' ? 'published' : s === 'pending' ? 'pending' : s === 'failed' ? 'failed' : null
                  })()}
                  igScheduledAt={igByItemId.get(item.i)?.scheduled_at ? new Date(igByItemId.get(item.i)!.scheduled_at).getTime() : undefined}
                  onScheduleIG={isApproved ? () => { setIgItem(item); setIgModalOpen(true) } : undefined}
                />
              </Box>
            )
          })}
        </DialogContent>
      </Dialog>

      {/* ── Edit Item Dialog (calendário) ────────────────── */}
      <EditItemDialog
        open={editCalItem !== null}
        item={editCalItem}
        onSave={(id, patch) => { onEdit?.(id, patch); setEditCalItem(null) }}
        onClose={() => setEditCalItem(null)}
      />

      {/* ── Instagram Schedule Modal ──────────────────────── */}
      {igModalOpen && igItem && (
        <InstagramScheduleModal
          open={igModalOpen}
          onClose={() => { setIgModalOpen(false); setIgItem(null) }}
          clientName={igItem.c}
          item={igItem}
          state={states[igItem.i] ?? null}
          allItems={items}
          states={states}
          onPublished={handleIgPublished}
        />
      )}

      {/* ── Criar conteúdo dialog ────────────────────────── */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,14,0.98)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,144,57,0.25)', borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 28, height: 28, borderRadius: 1.5, bgcolor: 'rgba(255,144,57,0.12)', border: '1px solid rgba(255,144,57,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AddIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            </Box>
            <Box>
              <Typography fontWeight={800} sx={{ fontSize: '0.95rem', lineHeight: 1.2 }}>Novo conteúdo</Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1 }}>
                {new Date(year, month, createDay).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }} />
            <IconButton size="small" onClick={() => setCreateOpen(false)}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </DialogTitle>

        <Divider sx={{ opacity: 0.1, mx: 2 }} />

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.8, pt: 2 }}>

          {/* Tipo */}
          <Box>
            <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', mb: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tipo de conteúdo</Typography>
            <ToggleButtonGroup
              value={createType} exclusive
              onChange={(_, v) => v && setCreateType(v)}
              size="small" fullWidth
            >
              {(['Post', 'Reel', 'Story'] as ContentType[]).map(tp => (
                <ToggleButton key={tp} value={tp} sx={{
                  flex: 1, fontSize: '0.7rem', fontWeight: 800, py: 0.8,
                  border: '1px solid rgba(255,255,255,0.1) !important',
                  color: createType === tp ? (tp === 'Post' ? '#3B8EFF' : tp === 'Reel' ? '#ff9039' : '#B47AFF') : 'text.disabled',
                  bgcolor: createType === tp ? (tp === 'Post' ? 'rgba(59,142,255,0.12)' : tp === 'Reel' ? 'rgba(255,144,57,0.12)' : 'rgba(180,122,255,0.12)') : 'transparent',
                  '&.Mui-selected': { color: (tp === 'Post' ? '#3B8EFF' : tp === 'Reel' ? '#ff9039' : '#B47AFF') },
                }}>
                  {tp === 'Post' ? '🖼️' : tp === 'Reel' ? '🎬' : '📱'} {tp}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* Cliente */}
          <TextField
            select label="Cliente" size="small" fullWidth
            value={createClient}
            onChange={e => setCreateClient(e.target.value)}
            sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.03)' } }}
          >
            {clientNameList.map(c => (
              <MenuItem key={c} value={c} sx={{ fontSize: '0.75rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: clientColors?.[c] || getClientColor(c, clientList), flexShrink: 0 }} />
                  {c}
                </Box>
              </MenuItem>
            ))}
          </TextField>

          {/* Título */}
          <TextField
            label="Título / descrição" size="small" fullWidth
            value={createTitle}
            onChange={e => setCreateTitle(e.target.value)}
            placeholder="Ex: Post de lançamento, Reel bastidores..."
            onKeyDown={e => e.key === 'Enter' && submitCreate()}
            autoFocus
            sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.03)' } }}
          />

          {/* Data + Hora */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              label="Dia" size="small" type="number"
              value={createDay}
              onChange={e => setCreateDay(Math.min(daysInMonth, Math.max(1, Number(e.target.value))))}
              slotProps={{ htmlInput: { min: 1, max: daysInMonth } }}
              sx={{ width: 80, '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.03)' } }}
            />
            <TextField
              label="Horário" size="small" type="time"
              value={createTime}
              onChange={e => setCreateTime(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flex: 1, '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.03)' } }}
            />
          </Box>

          {/* Data de entrega (só para Reel) */}
          {createType === 'Reel' && (
            <Box>
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C084FC', mb: 0.5 }}>
                📥 Data de entrega ao social
                <Typography component="span" sx={{ fontSize: '0.5rem', fontWeight: 400, color: 'rgba(255,255,255,0.35)', ml: 0.5, textTransform: 'none', letterSpacing: 0 }}>
                  · prazo para o editor entregar o vídeo
                </Typography>
              </Typography>
              <TextField
                type="date" size="small" fullWidth
                value={createDeliveryDate}
                onChange={e => setCreateDeliveryDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(192,132,252,0.05)', fontSize: '0.78rem', color: '#C084FC' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(192,132,252,0.25)' }, '&:hover fieldset': { borderColor: 'rgba(192,132,252,0.45)' }, '&.Mui-focused fieldset': { borderColor: '#C084FC' } } }}
              />
            </Box>
          )}

          {/* Atribuir a */}
          <TextField
            select label="Atribuir a (responsável)" size="small" fullWidth
            value={createResponsible}
            onChange={e => setCreateResponsible(e.target.value)}
            sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.03)' } }}
          >
            <MenuItem value="" sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>Sem responsável</MenuItem>
            {teamMembers.map(m => (
              <MenuItem key={m.key} value={m.key} sx={{ fontSize: '0.75rem', gap: 1 }}>
                <Typography sx={{ mr: 0.5 }}>{m.emoji}</Typography>
                <Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: m.color }}>{m.key.charAt(0).toUpperCase() + m.key.slice(1)}</Typography>
                  <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>{m.role}</Typography>
                </Box>
              </MenuItem>
            ))}
          </TextField>

          {/* Status inicial */}
          <TextField
            select label="Status inicial" size="small" fullWidth
            value={createStatus}
            onChange={e => setCreateStatus(Number(e.target.value) as Status)}
            sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.03)' } }}
          >
            {([0, 1, 2] as Status[]).map(s => {
              const cfg = STATUS_CONFIG[s]
              return (
                <MenuItem key={s} value={s} sx={{ fontSize: '0.75rem', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cfg.dot, flexShrink: 0 }} />
                  {cfg.label}
                </MenuItem>
              )
            })}
          </TextField>

          {/* Notas */}
          <TextField
            label="Notas (opcional)" size="small" fullWidth multiline rows={2}
            value={createNotes}
            onChange={e => setCreateNotes(e.target.value)}
            placeholder="Referência, briefing rápido, link..."
            sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.03)' } }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 2.5, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ fontSize: '0.75rem' }}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={submitCreate}
            disabled={!createClient || !createTitle.trim()}
            sx={{
              flex: 1, fontWeight: 800, fontSize: '0.8rem',
              background: 'linear-gradient(135deg,#ff9039,#ff5339)',
              color: '#fff', borderRadius: 2,
              boxShadow: '0 0 16px rgba(255,144,57,0.3)',
              '&:hover': { boxShadow: '0 0 24px rgba(255,144,57,0.5)' },
            }}
          >
            Criar e ir para o Kanban →
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
