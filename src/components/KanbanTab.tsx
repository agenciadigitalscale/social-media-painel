import { useMemo, useState } from 'react'
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
import { CSS } from '@dnd-kit/utilities'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import {
  Box, Typography, Paper, Chip, Stack, Card, CardContent,
} from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import type { ContentItem, ItemState, Status } from '../types'
import { DATA } from '../data'
import HintCard from './HintCard'

interface Props {
  states: Record<number, ItemState>
  onStatusChange: (id: number, s: Status) => void
}

const COLUMNS: { status: Status; label: string; color: string; bg: string; border: string }[] = [
  { status: 0, label: 'Pendente',  color: '#aaa',     bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)' },
  { status: 1, label: 'Em edição', color: '#FFD700',  bg: 'rgba(255,215,0,0.05)',   border: 'rgba(255,215,0,0.2)' },
  { status: 2, label: 'Aprovado',  color: '#3B8EFF',  bg: 'rgba(59,142,255,0.05)',  border: 'rgba(59,142,255,0.2)' },
  { status: 3, label: 'Publicado', color: '#00C47A',  bg: 'rgba(0,196,122,0.05)',   border: 'rgba(0,196,122,0.2)' },
]

// ── Mini card draggável ────────────────────────────────
function KanbanCard({ item, state, isDragging }: { item: ContentItem; state: ItemState; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: item.i })

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      sx={{
        mb: 0.8,
        cursor: 'grab',
        opacity: isDragging ? 0 : 1,
        transform: transform ? `translate(${transform.x}px,${transform.y}px)` : undefined,
        transition: isDragging ? undefined : 'box-shadow 0.15s',
        border: '1px solid rgba(255,255,255,0.06)',
        '&:active': { cursor: 'grabbing' },
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <CardContent sx={{ p: '8px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
          <DragIndicatorIcon sx={{ fontSize: 14, color: 'text.disabled', mt: 0.2, flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.6rem', color: 'primary.main', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1 }} noWrap>
              {item.c}
            </Typography>
            <Typography variant="caption" fontWeight={600} sx={{ display: 'block', lineHeight: 1.3 }} noWrap>
              {item.n}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.4, alignItems: 'center' }}>
              <Chip
                label={item.tp}
                size="small"
                sx={{ height: 14, fontSize: '0.5rem', bgcolor: item.tp === 'Reel' ? 'rgba(59,142,255,0.15)' : 'rgba(255,144,57,0.15)', color: item.tp === 'Reel' ? 'info.main' : 'primary.main' }}
              />
              <Typography sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>
                {item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </Typography>
              {state.link && (
                <Typography sx={{ fontSize: '0.55rem', color: 'success.main' }}>· 🔗</Typography>
              )}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

// ── Coluna droppável ───────────────────────────────────
function KanbanColumn({
  col, items, states, activeItem,
}: {
  col: typeof COLUMNS[number]
  items: ContentItem[]
  states: Record<number, ItemState>
  activeItem: ContentItem | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.status })

  return (
    <Box
      sx={{
        minWidth: 200,
        width: 200,
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
            state={states[item.i] ?? { status: item.s, link: '', caption: '', notes: '' }}
            isDragging={activeItem?.i === item.i}
          />
        ))}
      </Box>
    </Box>
  )
}

// ── KanbanTab principal ────────────────────────────────
export default function KanbanTab({ states, onStatusChange }: Props) {
  const [activeId, setActiveId] = useState<number | null>(null)
  const [filterClient, setFilterClient] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const clients = useMemo(() => Array.from(new Set(DATA.map(i => i.c))).sort(), [])

  const filtered = useMemo(() =>
    filterClient ? DATA.filter(i => i.c === filterClient) : DATA,
    [filterClient])

  const columns = useMemo(() =>
    COLUMNS.map(col => ({
      ...col,
      items: filtered.filter(item => (states[item.i]?.status ?? item.s) === col.status),
    })),
    [filtered, states])

  const activeItem = useMemo(() =>
    activeId != null ? DATA.find(i => i.i === activeId) ?? null : null,
    [activeId])

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as number)
  }

  function handleDragEnd(e: DragEndEvent) {
    const { over } = e
    setActiveId(null)
    if (!over || activeId == null) return
    const newStatus = over.id as Status
    const current = states[activeId]?.status ?? DATA.find(i => i.i === activeId)?.s ?? 0
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
          text="Arraste os cards entre colunas para mudar o status. No celular, segure 0,2s antes de arrastar."
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
