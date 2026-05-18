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
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, TextField, MenuItem, ToggleButtonGroup,
  ToggleButton,
} from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import DeleteIcon from '@mui/icons-material/Delete'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import AddIcon from '@mui/icons-material/Add'
import type { Client, ContentItem, ContentType, ItemEditPatch, ItemState, Status } from '../types'
import HintCard from './HintCard'
import ClientAvatar from './ClientAvatar'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, s: Status) => void
  onDelete?: (id: number) => void
  onEdit?: (id: number, patch: ItemEditPatch) => void
  onAddItem?: (clientName: string, title: string, type: ContentType, date: Date, status: Status) => void
  allClients?: Client[]
}

const COLUMNS: { status: Status; label: string; color: string; bg: string; border: string }[] = [
  { status: 0, label: 'Pendente',  color: '#aaa',    bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)' },
  { status: 1, label: 'Em edição', color: '#FFD700', bg: 'rgba(255,215,0,0.05)',   border: 'rgba(255,215,0,0.2)'   },
  { status: 2, label: 'Aprovado',  color: '#3B8EFF', bg: 'rgba(59,142,255,0.05)', border: 'rgba(59,142,255,0.2)'  },
  { status: 3, label: 'Publicado', color: '#00C47A', bg: 'rgba(0,196,122,0.05)',  border: 'rgba(0,196,122,0.2)'   },
]

// ── Mini card draggável ────────────────────────────────
function KanbanCard({
  item, state, isDragging, onStatusChange, onDelete,
}: {
  item: ContentItem
  state: ItemState
  isDragging?: boolean
  onStatusChange: (id: number, s: Status) => void
  onDelete?: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: item.i })
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null)
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirmDelete) {
      onDelete?.(item.i)
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 2500)
    }
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
        '& .kanban-delete': { opacity: 0, transition: 'opacity 0.15s' },
        '&:hover .kanban-delete': { opacity: 1 },
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
                sx={{
                  height: 15, fontSize: '0.52rem',
                  bgcolor: item.tp === 'Reel' ? 'rgba(59,142,255,0.15)' : item.tp === 'Story' ? 'rgba(180,90,255,0.15)' : 'rgba(255,144,57,0.15)',
                  color:   item.tp === 'Reel' ? '#3B8EFF'               : item.tp === 'Story' ? '#b45aff'              : '#ff9039',
                }}
              />
              <Typography sx={{ fontSize: { xs: '0.55rem', md: '0.6rem' }, color: 'text.disabled' }}>
                {item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </Typography>
              {state?.link    && <Typography sx={{ fontSize: '0.6rem', color: 'success.main' }}>🔗</Typography>}
              {state?.caption && <Typography sx={{ fontSize: '0.6rem', color: 'info.main'    }}>✍️</Typography>}
            </Box>
          </Box>

          {/* Ações — não ativam drag */}
          <Box
            className="kanban-delete"
            onPointerDown={e => e.stopPropagation()}
            sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, alignItems: 'center' }}
          >
            {onDelete && (
              <Tooltip title={confirmDelete ? 'Clique para confirmar' : 'Excluir'}>
                <IconButton
                  size="small"
                  onClick={handleDeleteClick}
                  sx={{
                    width: 20, height: 20, p: 0,
                    color: confirmDelete ? 'error.main' : 'rgba(255,255,255,0.3)',
                    bgcolor: confirmDelete ? 'rgba(255,69,69,0.12)' : 'transparent',
                    borderRadius: 1,
                    '&:hover': { color: 'error.main', bgcolor: 'rgba(255,69,69,0.1)' },
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
            )}
            <DragIndicatorIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.15)', mt: 0.2 }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

// ── Coluna droppável ───────────────────────────────────
function KanbanColumn({
  col, items, states, activeItem, onStatusChange, onDelete, onAdd,
}: {
  col: typeof COLUMNS[number]
  items: ContentItem[]
  states: Record<number, ItemState>
  activeItem: ContentItem | null
  onStatusChange: (id: number, s: Status) => void
  onDelete?: (id: number) => void
  onAdd?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.status })

  return (
    <Box
      sx={{
        minWidth: { xs: 200, md: 280, lg: 320, xl: 380 },
        width:    { xs: 200, md: 280, lg: 320, xl: 380 },
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Chip
            label={items.length}
            size="small"
            sx={{ height: 18, fontSize: '0.6rem', bgcolor: col.bg, color: col.color, border: `1px solid ${col.border}` }}
          />
          {onAdd && (
            <Tooltip title={`Adicionar em ${col.label}`}>
              <IconButton
                size="small"
                onClick={onAdd}
                sx={{
                  width: 22, height: 22, p: 0,
                  color: col.color,
                  border: `1px solid ${col.border}`,
                  bgcolor: col.bg,
                  borderRadius: 1,
                  '&:hover': { bgcolor: `${col.bg}`, opacity: 0.8 },
                }}
              >
                <AddIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
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
          bgcolor: isOver ? col.bg : 'transparent',
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
            onDelete={onDelete}
          />
        ))}

        {/* Botão add no rodapé da coluna */}
        {onAdd && (
          <Box
            onClick={onAdd}
            sx={{
              mt: 0.5, py: 0.8, borderRadius: 1.5,
              border: `1px dashed ${col.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
              cursor: 'pointer', opacity: 0.5,
              transition: 'opacity 0.15s',
              '&:hover': { opacity: 1, bgcolor: col.bg },
            }}
          >
            <AddIcon sx={{ fontSize: 14, color: col.color }} />
            <Typography sx={{ fontSize: '0.6rem', color: col.color, fontWeight: 600 }}>Adicionar</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ── Coluna Lixeira ────────────────────────────────────
function TrashColumn({ isOver, isDragging }: { isOver: boolean; isDragging: boolean }) {
  const { setNodeRef } = useDroppable({ id: 'trash' })

  return (
    <Box
      ref={setNodeRef}
      sx={{
        minWidth: { xs: 140, md: 170, lg: 190 },
        width:    { xs: 140, md: 170, lg: 190 },
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',

        // animação de pulsação quando hovering
        '@keyframes trashPulse': {
          '0%,100%': { boxShadow: '0 0 18px rgba(255,80,30,0.45), inset 0 0 30px rgba(255,80,30,0.08)' },
          '50%':     { boxShadow: '0 0 40px rgba(255,80,30,0.85), inset 0 0 60px rgba(255,80,30,0.18)' },
        },
        '@keyframes lidOpen': {
          '0%,100%': { transform: 'perspective(200px) rotateX(0deg)' },
          '50%':     { transform: 'perspective(200px) rotateX(-35deg)' },
        },
        '@keyframes shake': {
          '0%,100%': { transform: 'translateX(0)' },
          '20%':     { transform: 'translateX(-4px)' },
          '40%':     { transform: 'translateX(4px)' },
          '60%':     { transform: 'translateX(-3px)' },
          '80%':     { transform: 'translateX(3px)' },
        },
        '@keyframes glowPulse': {
          '0%,100%': { filter: 'drop-shadow(0 0 8px rgba(255,100,30,0.7)) drop-shadow(0 4px 8px rgba(0,0,0,0.9))' },
          '50%':     { filter: 'drop-shadow(0 0 24px rgba(255,60,10,1))   drop-shadow(0 4px 8px rgba(0,0,0,0.9))' },
        },
      }}
    >
      <Box
        sx={{
          flex: 1,
          borderRadius: 3,
          border: isOver
            ? '2px solid rgba(255,60,10,0.9)'
            : isDragging
            ? '2px dashed rgba(255,100,30,0.5)'
            : '2px dashed rgba(255,100,30,0.18)',
          background: isOver
            ? 'linear-gradient(180deg, rgba(255,60,10,0.22) 0%, rgba(10,4,0,0.95) 60%)'
            : 'linear-gradient(180deg, rgba(255,100,30,0.10) 0%, rgba(8,4,0,0.92) 55%, #000 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          transition: 'all 0.25s',
          animation: isOver ? 'trashPulse 0.8s ease-in-out infinite' : undefined,
          position: 'relative',
          overflow: 'hidden',

          // reflexo de chão
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: '35%',
            background: 'linear-gradient(to top, rgba(255,80,10,0.06), transparent)',
            pointerEvents: 'none',
          },
        }}
      >
        {/* Ícone 3D lixeira */}
        <Box sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
          animation: isOver ? 'shake 0.5s ease-in-out infinite' : undefined,
        }}>
          {/* Tampa da lixeira */}
          <Box sx={{
            width: 52, height: 8,
            background: 'linear-gradient(180deg, #ff8c30 0%, #c94000 100%)',
            borderRadius: '4px 4px 0 0',
            boxShadow: '0 -2px 8px rgba(255,80,10,0.6), inset 0 2px 4px rgba(255,255,255,0.15)',
            transformOrigin: 'center bottom',
            animation: isOver ? 'lidOpen 0.6s ease-in-out infinite' : undefined,
            transition: 'all 0.3s',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: -5, left: '50%',
              transform: 'translateX(-50%)',
              width: 14, height: 6,
              background: 'linear-gradient(180deg, #ff9040 0%, #c94000 100%)',
              borderRadius: '3px 3px 0 0',
              boxShadow: '0 -1px 4px rgba(255,80,10,0.5)',
            },
          }} />

          {/* Corpo da lixeira */}
          <Box sx={{
            width: 48, height: 58,
            background: 'linear-gradient(135deg, #ff7020 0%, #c94000 40%, #6b1a00 100%)',
            borderRadius: '0 0 8px 8px',
            boxShadow: '4px 4px 12px rgba(0,0,0,0.8), -2px 0 8px rgba(255,80,10,0.3), inset 2px 2px 6px rgba(255,255,255,0.12), inset -2px -2px 8px rgba(0,0,0,0.5)',
            position: 'relative',
            overflow: 'hidden',

            // linhas verticais decorativas
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              background: 'repeating-linear-gradient(90deg, transparent 0, transparent 12px, rgba(0,0,0,0.2) 12px, rgba(0,0,0,0.2) 14px)',
            },
            // brilho lateral
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 4, left: 4, bottom: 4,
              width: 6,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 100%)',
              borderRadius: 3,
            },
          }}>
            {/* Sombra interna bottom */}
            <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)', borderRadius: '0 0 8px 8px' }} />
          </Box>

          {/* Sombra no chão */}
          <Box sx={{
            width: 44, height: 6, mt: 0.5,
            background: 'radial-gradient(ellipse, rgba(255,80,10,0.35) 0%, transparent 75%)',
            borderRadius: '50%',
            filter: 'blur(3px)',
          }} />
        </Box>

        {/* Texto LIXEIRA neon */}
        <Typography sx={{
          fontSize: '0.75rem',
          fontWeight: 900,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: '#ffffff',
          textShadow: isOver
            ? '0 0 6px #fff, 0 0 14px #fff, 0 0 30px rgba(255,80,10,0.9), 0 0 60px rgba(255,80,10,0.6)'
            : '0 0 5px #fff, 0 0 12px rgba(255,255,255,0.6)',
          transition: 'text-shadow 0.3s',
          userSelect: 'none',
        }}>
          Lixeira
        </Typography>

        {/* Sub-texto de instrução */}
        <Typography sx={{
          fontSize: '0.55rem',
          color: isOver ? 'rgba(255,120,50,0.95)' : 'rgba(255,255,255,0.3)',
          textAlign: 'center',
          px: 1.5,
          lineHeight: 1.4,
          transition: 'color 0.2s',
          userSelect: 'none',
        }}>
          {isOver ? '🔥 solte para excluir' : 'arraste aqui para excluir'}
        </Typography>
      </Box>
    </Box>
  )
}

// ── KanbanTab principal ────────────────────────────────
export default function KanbanTab({ items, states, onStatusChange, onDelete, onAddItem, allClients }: Props) {
  const [activeId, setActiveId] = useState<number | null>(null)
  const [filterClient, setFilterClient] = useState<string | null>(null)

  const [trashOver, setTrashOver]   = useState(false)

  // Dialog de adicionar
  const [addOpen, setAddOpen]       = useState(false)
  const [addStatus, setAddStatus]   = useState<Status>(0)
  const [addClient, setAddClient]   = useState('')
  const [addTitle, setAddTitle]     = useState('')
  const [addType, setAddType]       = useState<ContentType>('Post')
  const [addDate, setAddDate]       = useState(() => new Date().toISOString().split('T')[0])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 1 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 100, tolerance: 5 } }),
  )

  const clients = useMemo(() => {
    const fromItems = Array.from(new Set(items.map(i => i.c))).sort()
    const fromClients = (allClients ?? []).map(c => c.name)
    return Array.from(new Set([...fromClients, ...fromItems])).sort()
  }, [items, allClients])

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

  function handleDragStart(e: DragStartEvent) { setActiveId(e.active.id as number) }

  function handleDragOver(e: { over: { id: string | number } | null }) {
    setTrashOver(e.over?.id === 'trash')
  }

  function handleDragEnd(e: DragEndEvent) {
    const { over } = e
    setActiveId(null)
    setTrashOver(false)
    if (!over || activeId == null) return

    if (over.id === 'trash') {
      onDelete?.(activeId)
      return
    }

    const newStatus = over.id as Status
    const current = states[activeId]?.status ?? items.find(i => i.i === activeId)?.s ?? 0
    if (newStatus !== current) onStatusChange(activeId, newStatus)
  }

  function openAdd(status: Status) {
    setAddStatus(status)
    setAddClient('')
    setAddTitle('')
    setAddType('Post')
    setAddDate(new Date().toISOString().split('T')[0])
    setAddOpen(true)
  }

  function handleAddSubmit() {
    if (!addClient || !addTitle) return
    onAddItem?.(addClient, addTitle, addType, new Date(addDate + 'T12:00:00'), addStatus)
    setAddOpen(false)
  }

  const addCol = COLUMNS.find(c => c.status === addStatus)

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
        <HintCard text="Arraste entre colunas para mudar status. Passe o mouse no card para ver o botão excluir. Clique + para adicionar." sx={{ mt: 1 }} />
      </Box>

      {/* Board */}
      <Box sx={{ flex: 1, overflow: 'hidden', px: 1.5, pb: 1.5 }}>
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <Box
            sx={{
              display: 'flex', gap: 1.5,
              height: '100%',
              overflowX: 'auto', overflowY: 'hidden',
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
                onDelete={onDelete}
                onAdd={onAddItem ? () => openAdd(col.status) : undefined}
              />
            ))}

            {/* Lixeira — ao final do board, dentro do flex */}
            <TrashColumn isOver={trashOver} isDragging={activeId != null} />
          </Box>

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

      {/* Dialog: adicionar card */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: addCol?.color, flexShrink: 0 }} />
            <Typography fontWeight={700} sx={{ fontSize: '0.95rem' }}>
              Adicionar em <span style={{ color: addCol?.color }}>{addCol?.label}</span>
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="Cliente" size="small" fullWidth select autoFocus
            value={addClient}
            onChange={e => setAddClient(e.target.value)}
          >
            {clients.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>

          <TextField
            label="Título do conteúdo" size="small" fullWidth
            value={addTitle}
            onChange={e => setAddTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddSubmit()}
          />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tipo</Typography>
            <ToggleButtonGroup exclusive value={addType} onChange={(_, v) => v && setAddType(v)} size="small" fullWidth>
              <ToggleButton value="Post"  sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Post</ToggleButton>
              <ToggleButton value="Reel"  sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Reel</ToggleButton>
              <ToggleButton value="Story" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Story</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <TextField
            label="Data" size="small" fullWidth type="date"
            value={addDate}
            onChange={e => setAddDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          {/* Status — permite trocar a coluna de destino no dialog */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Coluna de destino</Typography>
            <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
              {COLUMNS.map(col => (
                <Chip
                  key={col.status}
                  label={col.label}
                  size="small"
                  onClick={() => setAddStatus(col.status)}
                  variant={addStatus === col.status ? 'filled' : 'outlined'}
                  sx={{
                    cursor: 'pointer', fontSize: '0.62rem',
                    borderColor: col.border,
                    color: addStatus === col.status ? '#000' : col.color,
                    bgcolor: addStatus === col.status ? col.color : 'transparent',
                  }}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setAddOpen(false)}>Cancelar</Button>
          <Button
            size="small" variant="contained"
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
  )
}
