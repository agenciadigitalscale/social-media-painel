import { useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import {
  Box, Typography, Paper, Chip, Stack, Card, CardContent,
} from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import type { ContentItem, ItemEditPatch, ItemState, Status } from '../types'
import HintCard from './HintCard'
import ClientAvatar from './ClientAvatar'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, s: Status) => void
  onDelete?: (id: number) => void
  onEdit?: (id: number, patch: ItemEditPatch) => void
}

const COLUMNS: { status: Status; label: string; color: string; bg: string; border: string }[] = [
  { status: 0, label: 'Pendente',  color: '#aaa',     bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)' },
  { status: 1, label: 'Em edição', color: '#FFD700',  bg: 'rgba(255,215,0,0.05)',   border: 'rgba(255,215,0,0.2)' },
  { status: 2, label: 'Aprovado',  color: '#3B8EFF',  bg: 'rgba(59,142,255,0.05)',  border: 'rgba(59,142,255,0.2)' },
  { status: 3, label: 'Publicado', color: '#00C47A',  bg: 'rgba(0,196,122,0.05)',   border: 'rgba(0,196,122,0.2)' },
]

// ── Mini card draggável com swipe ─────────────────────
function KanbanCard({
  item, state, isDragging, onStatusChange,
}: {
  item: ContentItem
  state: ItemState
  isDragging?: boolean
  onStatusChange: (id: number, s: Status) => void
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: item.i })
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null)
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() }
    setSwipeDir(null)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.touches[0].clientX - touchStart.current.x
    const dy = e.touches[0].clientY - touchStart.current.y
    if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      setSwipeDir(dx > 0 ? 'right' : 'left')
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - touchStart.current.x
    const dy = touch.clientY - touchStart.current.y
    const dt = Date.now() - touchStart.current.t
    touchStart.current = null
    setSwipeDir(null)

    if (Math.abs(dx) < 45 || Math.abs(dy) > Math.abs(dx) || dt > 450) return

    const cur = (state?.status ?? item.s) as Status
    if (dx > 0 && cur < 3) { e.stopPropagation(); onStatusChange(item.i, (cur + 1) as Status) }
    if (dx < 0 && cur > 0) { e.stopPropagation(); onStatusChange(item.i, (cur - 1) as Status) }
  }

  const swipeGlow = swipeDir === 'right'
    ? '0 0 14px rgba(0,196,122,0.5)'
    : swipeDir === 'left'
    ? '0 0 14px rgba(255,69,69,0.4)'
    : undefined

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      sx={{
        mb: 0.8,
        cursor: 'grab',
        opacity: isDragging ? 0 : 1,
        transform: transform
          ? `translate(${transform.x}px,${transform.y}px)`
          : swipeDir === 'right' ? 'translateX(6px)' : swipeDir === 'left' ? 'translateX(-6px)' : undefined,
        transition: isDragging ? undefined : 'transform 0.1s, box-shadow 0.1s',
        boxShadow: swipeGlow,
        '&:active': { cursor: 'grabbing' },
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <CardContent sx={{ p: '10px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
          <ClientAvatar name={item.c} size={28} tooltip />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: { xs: '0.6rem', md: '0.68rem' }, color: 'primary.main', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1 }} noWrap>
              {item.c}
            </Typography>
            <Typography variant="caption" fontWeight={600} sx={{ display: 'block', lineHeight: 1.35, fontSize: { xs: '0.72rem', md: '0.8rem' }, mt: 0.2 }} noWrap>
              {state?.title || item.n}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.4, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                label={item.tp}
                size="small"
                sx={{ height: 15, fontSize: '0.52rem', bgcolor: item.tp === 'Reel' ? 'rgba(59,142,255,0.15)' : 'rgba(255,144,57,0.15)', color: item.tp === 'Reel' ? 'info.main' : 'primary.main' }}
              />
              <Typography sx={{ fontSize: { xs: '0.55rem', md: '0.6rem' }, color: 'text.disabled' }}>
                {item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </Typography>
              {state?.link && <Typography sx={{ fontSize: '0.6rem', color: 'success.main' }}>🔗</Typography>}
              {state?.caption && <Typography sx={{ fontSize: '0.6rem', color: 'info.main' }}>✍️</Typography>}
            </Box>
          </Box>
          <DragIndicatorIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.15)', flexShrink: 0, mt: 0.2 }} />
        </Box>
      </CardContent>
    </Card>
  )
}

// ── Coluna droppável ───────────────────────────────────
function KanbanColumn({
  col, items, states, activeItem, onStatusChange,
}: {
  col: typeof COLUMNS[number]
  items: ContentItem[]
  states: Record<number, ItemState>
  activeItem: ContentItem | null
  onStatusChange: (id: number, s: Status) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.status })

  return (
    <Box
      sx={{
        minWidth: { xs: 200, md: 280, lg: 320, xl: 380 },
        width: { xs: 200, md: 280, lg: 320, xl: 380 },
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Column header */}
      <Paper
        sx={{
          px: 1.2, py: 0.8, mb: 1,
          border: `1px solid ${col.border}`,
          bgcolor: col.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: col.color }} />
          <Typography variant="caption" fontWeight={700} sx={{ color: col.color, fontSize: '0.7rem' }}>
            {col.label}
          </Typography>
        </Box>
        <Chip
          label={items.length}
          size="small"
          sx={{ height: 18, fontSize: '0.6rem', bgcolor: col.bg, color: col.color, border: `1px solid ${col.border}` }}
        />
      </Paper>

      {/* Drop zone */}
      <Box
        ref={setNodeRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          borderRadius: 2,
          border: '1px dashed',
          borderColor: isOver ? col.color : 'transparent',
          bgcolor: isOver ? `${col.bg}` : 'transparent',
          transition: 'all 0.15s',
          p: 0.5,
          minHeight: 80,
        }}
      >
        {items.length === 0 && !isOver && (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 2, fontSize: '0.6rem' }}>
            Arraste aqui
          </Typography>
        )}
        {items.map(item => (
          <KanbanCard
            key={item.i}
            item={item}
            state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }}
            isDragging={activeItem?.i === item.i}
            onStatusChange={onStatusChange}
          />
        ))}
      </Box>
    </Box>
  )
}

// ── KanbanTab principal ────────────────────────────────
export default function KanbanTab({ items, states, onStatusChange }: Props) {
  const [activeId, setActiveId] = useState<number | null>(null)
  const [filterClient, setFilterClient] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 1 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
  )

  const clients = useMemo(() => Array.from(new Set(items.map(i => i.c))).sort(), [items])

  const filtered = useMemo(() =>
    filterClient ? items.filter(i => i.c === filterClient) : items,
    [items, filterClient])

  const columns = useMemo(() =>
    COLUMNS.map(col => ({
      ...col,
      items: filtered.filter(item => (states[item.i]?.status ?? item.s) === col.status),
    })),
    [filtered, states])

  const activeItem = useMemo(() =>
    activeId != null ? items.find(i => i.i === activeId) ?? null : null,
    [activeId, items])

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as number)
  }

  function handleDragEnd(e: DragEndEvent) {
    const { over } = e
    setActiveId(null)
    if (!over || activeId == null) return
    const newStatus = over.id as Status
    const current = states[activeId]?.status ?? items.find(i => i.i === activeId)?.s ?? 0
    if (newStatus !== current) onStatusChange(activeId, newStatus)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Filter */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
        <Stack direction="row" spacing={0.8} sx={{ overflowX: 'auto', pb: 0.5 }}>
          <Chip label="Todos" size="small" variant={filterClient ? 'outlined' : 'filled'} color="primary" onClick={() => setFilterClient(null)} sx={{ flexShrink: 0 }} />
          {clients.map(c => (
            <Chip key={c} label={c} size="small" variant={filterClient === c ? 'filled' : 'outlined'} onClick={() => setFilterClient(c)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }} />
          ))}
        </Stack>

        <HintCard
          text="Arraste os cards entre colunas para mudar o status. No celular, segure 0,1s e arraste."
          sx={{ mt: 1 }}
        />
      </Box>

      {/* Board */}
      <Box sx={{ flex: 1, overflow: 'hidden', px: 1.5, pb: 1.5 }}>
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              height: '100%',
              overflowX: 'auto',
              overflowY: 'hidden',
              pb: 1,
              scrollSnapType: 'x mandatory',
              '& > *': { scrollSnapAlign: 'start' },
            }}
          >
            {columns.map(col => (
              <KanbanColumn
                key={col.status}
                col={col}
                items={col.items}
                states={states}
                activeItem={activeItem}
                onStatusChange={onStatusChange}
              />
            ))}
          </Box>

          {/* Drag overlay */}
          <DragOverlay>
            {activeItem && (
              <Card sx={{ width: 200, border: '1px solid', borderColor: 'primary.main', boxShadow: '0 8px 32px rgba(255,144,57,0.3)', cursor: 'grabbing' }}>
                <CardContent sx={{ p: '8px !important' }}>
                  <Typography sx={{ fontSize: '0.6rem', color: 'primary.main', fontWeight: 700 }}>{activeItem.c}</Typography>
                  <Typography variant="caption" fontWeight={600}>{activeItem.n}</Typography>
                  <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary', display: 'block' }}>{activeItem.tp}</Typography>
                </CardContent>
              </Card>
            )}
          </DragOverlay>
        </DndContext>
      </Box>
    </Box>
  )
}
