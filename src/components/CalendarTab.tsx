import { useState, useMemo } from 'react'
import {
  Box, Typography, Paper, IconButton, Chip, Stack,
  Dialog, DialogTitle, DialogContent, Divider,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { STATUS_CONFIG, type ContentItem, type ItemEditPatch, type ItemState, type Status } from '../types'
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
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// Cor por cliente — ciclo de cores distintas
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

// ── Item arrastável — strip de largura total ───────────
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

// ── Célula do dia (droppável) ──────────────────────────
function DroppableDay({
  day, info, isToday, isPast, allDone, hasLate, isWeekend, clientList,
  dayItems, isDraggingActive, onClick,
}: {
  day: number
  info: { count: number; published: number; clients: string[] } | undefined
  isToday: boolean
  isPast: boolean
  allDone: boolean
  hasLate: boolean
  isWeekend: boolean
  clientList: string[]
  dayItems: ContentItem[]
  isDraggingActive: boolean
  onClick: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` })

  return (
    <Paper
      ref={setNodeRef}
      onClick={info && info.count > 0 ? onClick : undefined}
      sx={{
        p: 0.6, minHeight: { xs: 60, sm: 76 },
        display: 'flex', flexDirection: 'column', gap: 0.25,
        borderRadius: 2, border: '1px solid',
        borderColor: isOver ? 'primary.main' : isToday ? 'primary.main' : allDone ? 'rgba(0,196,122,0.3)' : hasLate ? 'rgba(255,69,69,0.25)' : 'rgba(255,255,255,0.05)',
        bgcolor: isOver ? 'rgba(255,144,57,0.12)' : isToday ? 'rgba(255,144,57,0.08)' : allDone ? 'rgba(0,196,122,0.05)' : hasLate ? 'rgba(255,69,69,0.05)' : isWeekend ? 'rgba(255,255,255,0.01)' : 'background.paper',
        cursor: info && info.count > 0 ? 'pointer' : isDraggingActive ? 'copy' : 'default',
        transition: 'all 0.12s',
        boxShadow: isToday ? '0 0 0 1px rgba(255,144,57,0.3)' : isOver ? '0 0 12px rgba(255,144,57,0.2)' : 'none',
        '&:hover': info && info.count > 0 ? { borderColor: 'primary.main', transform: 'scale(1.02)' } : {},
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Barra de hoje */}
      {isToday && (
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#ff9039,#ff5339)' }} />
      )}

      {/* Número do dia */}
      <Typography sx={{ fontSize: { xs: '0.65rem', sm: '0.8rem' }, fontWeight: isToday ? 800 : 600, color: isToday ? 'primary.main' : isWeekend ? 'text.disabled' : 'text.primary', lineHeight: 1 }}>
        {day}
      </Typography>

      {info && info.count > 0 && (
        <>
          {/* Strips arrastáveis — clicar em qualquer lugar arrasta */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2, flex: 1, width: '100%', overflow: 'hidden' }}>
            {dayItems.slice(0, 4).map(item => (
              <DraggableItem
                key={item.i}
                item={item}
                color={getClientColor(item.c, clientList)}
                isDraggingActive={isDraggingActive}
              />
            ))}
            {dayItems.length > 4 && (
              <Typography sx={{ fontSize: '0.38rem', color: 'text.disabled', pl: 0.5, lineHeight: 1 }}>
                +{dayItems.length - 4}
              </Typography>
            )}
          </Box>

          {/* Barra de progresso */}
          <Box sx={{ width: '100%', height: 2, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${(info.published / info.count) * 100}%`, bgcolor: allDone ? 'success.main' : 'primary.main', borderRadius: 1 }} />
          </Box>
        </>
      )}

      {/* Indicador "solte aqui" quando arrastando */}
      {isDraggingActive && (!info || info.count === 0) && (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: '0.45rem', color: 'text.disabled' }}>+</Typography>
        </Box>
      )}
    </Paper>
  )
}

// ── CalendarTab ────────────────────────────────────────
export default function CalendarTab({ items, states, now, onStatusChange, onUpdate, onDelete, onEdit, onDuplicate, clientColors, clientHashtags, onSaveHashtags, captionTemplates, onSaveTemplates, onReschedule }: Props) {
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [filterClient, setFilterClient] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [weekOffset, setWeekOffset] = useState(0)

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

  // Clientes únicos para filtro
  const clientList = useMemo(() => Array.from(new Set(items.map(i => i.c))).sort(), [items])

  // Itens filtrados por cliente
  const filteredItems = useMemo(() =>
    filterClient ? items.filter(i => i.c === filterClient) : items,
    [items, filterClient])

  // Mapa dia → estatísticas
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
          published: cur.published + (s === 3 ? 1 : 0),
          clients:   cur.clients.includes(sc) ? cur.clients : [...cur.clients, sc],
        })
      })
    return map
  }, [filteredItems, states, year, month])

  // Itens por dia (para dots arrastáveis)
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

  // Totais do mês
  const monthTotals = useMemo(() => {
    let count = 0, published = 0
    dayMap.forEach(v => { count += v.count; published += v.published })
    return { count, published, pct: count ? Math.round((published / count) * 100) : 0 }
  }, [dayMap])

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  // Itens do dia selecionado (modal)
  const selectedItems = useMemo(() => {
    if (!selectedDay) return []
    return filteredItems.filter(i => i.dt.getFullYear() === year && i.dt.getMonth() === month && i.dt.getDate() === selectedDay)
  }, [selectedDay, year, month, filteredItems])

  const activeItem = useMemo(() =>
    activeId != null ? items.find(i => i.i === activeId) ?? null : null,
    [activeId, items])

  // ── Week view logic ───────────────────────────────────
  const weekDays = useMemo(() => {
    const todayDate = new Date(now); todayDate.setHours(0, 0, 0, 0)
    // Start from current week's Monday
    const dayOfWeek = todayDate.getDay() === 0 ? 6 : todayDate.getDay() - 1
    const monday = new Date(todayDate.getTime() - dayOfWeek * 86_400_000 + weekOffset * 7 * 86_400_000)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday.getTime() + i * 86_400_000)
      return d
    })
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

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as number)
  }

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ───────────────────────────────────── */}
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
            {/* View toggle */}
            <Box sx={{ display: 'flex', borderRadius: 1.5, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              {(['month', 'week'] as const).map(mode => (
                <Box
                  key={mode}
                  onClick={() => { setViewMode(mode); if (mode === 'week') setWeekOffset(0) }}
                  sx={{
                    px: 1.2, py: 0.4, fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
                    bgcolor: viewMode === mode ? 'rgba(255,144,57,0.15)' : 'transparent',
                    color: viewMode === mode ? 'primary.main' : 'text.disabled',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: viewMode === mode ? 'rgba(255,144,57,0.2)' : 'rgba(255,255,255,0.04)' },
                  }}
                >
                  {mode === 'month' ? 'Mês' : 'Semana'}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* ── Filtro por cliente ── */}
        <Stack direction="row" spacing={0.6} sx={{ overflowX: 'auto', pb: 0.5 }}>
          <Chip
            label="Todos"
            size="small"
            variant={filterClient ? 'outlined' : 'filled'}
            color="primary"
            onClick={() => setFilterClient(null)}
            sx={{ flexShrink: 0, fontSize: '0.6rem' }}
          />
          {clientList.map(c => (
            <Chip
              key={c}
              label={shortName(c)}
              size="small"
              variant={filterClient === c ? 'filled' : 'outlined'}
              onClick={() => setFilterClient(prev => prev === c ? null : c)}
              sx={{
                flexShrink: 0, fontSize: '0.58rem',
                borderColor: filterClient === c ? getClientColor(c, clientList) : undefined,
                bgcolor: filterClient === c ? `${getClientColor(c, clientList)}22` : undefined,
                color: filterClient === c ? getClientColor(c, clientList) : undefined,
              }}
            />
          ))}
        </Stack>
      </Box>

      {/* ── Legenda dos dias da semana — só no modo mês ─── */}
      {viewMode === 'month' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', px: 1, mb: 0.3 }}>
          {WEEKDAYS.map((d, i) => (
            <Typography key={d} variant="caption" sx={{ textAlign: 'center', fontWeight: 700, fontSize: '0.55rem', py: 0.3, color: i === 0 || i === 6 ? 'text.disabled' : 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {d}
            </Typography>
          ))}
        </Box>
      )}

      {/* ── Área de conteúdo — modo mês ou semana ─────────── */}
      <Box sx={{ flex: 1, overflow: 'hidden', px: 1, pb: 1, display: 'flex', flexDirection: 'column' }}>
        {viewMode === 'month' ? (
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
                {cells.map((day, idx) => {
                  if (!day) return <Box key={`e-${idx}`} />

                  const info    = dayMap.get(day)
                  const dayItems = itemsByDay.get(day) ?? []
                  const isToday = isCurrentMonth && day === today
                  const isPast  = isCurrentMonth ? day < today : year < now.getFullYear() || month < now.getMonth()
                  const allDone = info ? info.count > 0 && info.published === info.count : false
                  const hasLate = info ? isPast && info.published < info.count : false
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
                      onClick={() => setSelectedDay(day)}
                    />
                  )
                })}
              </Box>

              {/* Overlay do item sendo arrastado */}
              <DragOverlay>
                {activeItem && (
                  <Box sx={{
                    px: 1, py: 0.6,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'primary.main',
                    borderRadius: 1.5,
                    boxShadow: '0 8px 24px rgba(255,144,57,0.3)',
                    cursor: 'grabbing',
                    minWidth: 100,
                  }}>
                    <Typography sx={{ fontSize: '0.58rem', color: 'primary.main', fontWeight: 700 }}>{activeItem.c}</Typography>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600 }} noWrap>{activeItem.n}</Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary' }}>{activeItem.tp} · {activeItem.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</Typography>
                  </Box>
                )}
              </DragOverlay>
            </DndContext>

            {/* Legenda de drag */}
            {activeId !== null && (
              <Box sx={{ textAlign: 'center', py: 0.5 }}>
                <Typography variant="caption" color="primary.main" sx={{ fontSize: '0.6rem' }}>
                  Solte em outro dia para reagendar
                </Typography>
              </Box>
            )}
          </Box>
        ) : (
          /* ── Visão Semanal ─────────────────────────────── */
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.8, flex: 1, overflow: 'hidden' }}>
            {weekDays.map(day => {
              const y = day.getFullYear(), m = day.getMonth(), d = day.getDate()
              const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
              const dayItemsW = weekItems.get(day.toISOString().slice(0, 10)) ?? []
              const isToday = day.toDateString() === now.toDateString()
              const isPastDay = day < new Date(now.getFullYear(), now.getMonth(), now.getDate())
              const allDoneW = dayItemsW.length > 0 && dayItemsW.every(it => (states[it.i]?.status ?? it.s) === 7)
              const hasLateW = isPastDay && dayItemsW.some(it => (states[it.i]?.status ?? it.s) !== 7)
              const dayName = WEEKDAYS[day.getDay()]

              return (
                <Box
                  key={key}
                  sx={{
                    display: 'flex', flexDirection: 'column',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: isToday ? 'primary.main' : allDoneW ? 'rgba(0,196,122,0.25)' : hasLateW ? 'rgba(255,59,48,0.2)' : 'rgba(255,255,255,0.06)',
                    bgcolor: isToday ? 'rgba(255,144,57,0.04)' : allDoneW ? 'rgba(0,196,122,0.03)' : 'background.paper',
                    overflow: 'hidden',
                  }}
                >
                  {/* Day header */}
                  <Box sx={{
                    px: 0.8, py: 0.7, textAlign: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    bgcolor: isToday ? 'rgba(255,144,57,0.1)' : 'transparent',
                    position: 'relative', flexShrink: 0,
                  }}>
                    {isToday && (
                      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#ff9039,#ff5339)' }} />
                    )}
                    <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: isToday ? 'primary.main' : 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1 }}>
                      {dayName}
                    </Typography>
                    <Typography sx={{ fontSize: '1.05rem', fontWeight: isToday ? 900 : 600, color: isToday ? 'primary.main' : 'text.primary', lineHeight: 1.15 }}>
                      {d}
                    </Typography>
                    {dayItemsW.length > 0 && (
                      <Typography sx={{ fontSize: '0.42rem', color: allDoneW ? 'success.main' : isToday ? 'primary.main' : 'text.disabled', lineHeight: 1, mt: 0.2 }}>
                        {dayItemsW.length} item{dayItemsW.length !== 1 ? 's' : ''}
                      </Typography>
                    )}
                  </Box>

                  {/* Items list */}
                  <Box sx={{ flex: 1, overflowY: 'auto', p: 0.4, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                    {dayItemsW.map(item => {
                      const st = states[item.i]?.status ?? item.s
                      const cfg = STATUS_CONFIG[st]
                      const color = getClientColor(item.c, clientList)
                      return (
                        <Box
                          key={item.i}
                          onClick={() => {
                            setViewDate(new Date(y, m, 1))
                            setSelectedDay(d)
                          }}
                          sx={{
                            px: 0.7, py: 0.5, borderRadius: 1.5,
                            borderLeft: `3px solid ${color}`,
                            bgcolor: `${color}12`,
                            cursor: 'pointer',
                            transition: 'all 0.12s',
                            '&:hover': { bgcolor: `${color}22` },
                          }}
                        >
                          <Typography sx={{ fontSize: '0.5rem', color, fontWeight: 800, lineHeight: 1 }} noWrap>
                            {shortName(item.c)}
                          </Typography>
                          <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)', lineHeight: 1.25, mt: 0.15 }} noWrap>
                            {states[item.i]?.title || item.n}
                          </Typography>
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
                    {dayItemsW.length === 0 && (
                      <Typography sx={{ fontSize: '0.5rem', color: 'text.disabled', textAlign: 'center', mt: 1.5, opacity: 0.4 }}>—</Typography>
                    )}
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}
      </Box>

      {/* ── Modal do dia ─────────────────────────────── */}
      <Dialog
        open={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(255,144,57,0.2)', borderRadius: 3, maxHeight: '85vh' } }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {selectedDay && new Date(year, month, selectedDay).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedItems.length} conteúdo{selectedItems.length !== 1 ? 's' : ''} para publicar
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setSelectedDay(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Divider sx={{ opacity: 0.1 }} />
        <DialogContent sx={{ pt: 1.5 }}>
          {selectedItems.map(item => (
            <ContentCard
              key={item.i}
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
            />
          ))}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
