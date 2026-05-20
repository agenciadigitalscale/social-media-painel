import { useMemo, useState, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Box, Typography, Paper, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, ToggleButtonGroup,
  ToggleButton, Tooltip, Badge,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import SendIcon from '@mui/icons-material/Send'
import PriorityHighIcon from '@mui/icons-material/PriorityHigh'
import CommentIcon from '@mui/icons-material/Comment'
import type { Client, ContentItem, ContentType, ItemEditPatch, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'

const COLUMNS: { status: Status }[] = [
  { status: 0 },
  { status: 1 },
  { status: 2 },
  { status: 3 },
  { status: 4 },
  { status: 5 },
  { status: 6 },
  { status: 7 },
]

// ── KanbanCard ────────────────────────────────────────────

function KanbanCard({
  item, state, isDragging, onSendToClient,
}: {
  item: ContentItem
  state: ItemState
  isDragging?: boolean
  onSendToClient?: (id: number, clientName: string) => void
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isLate = item.dt < today && state.status !== 7 && state.status !== 5
  const cfg = STATUS_CONFIG[state.status]
  const daysDiff = Math.round((item.dt.getTime() - today.getTime()) / 86400000)
  const hasComment = (state.comments?.length ?? 0) > 0 || Boolean(state.rejectionText)

  const dateLabel = () => {
    if (isLate) return `${Math.abs(daysDiff)}d atraso`
    if (daysDiff === 0) return 'Hoje'
    if (daysDiff === 1) return 'Amanhã'
    return item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5, borderRadius: 2.5,
        border: `1px solid ${isLate ? '#FF3B3044' : cfg.color + '22'}`,
        bgcolor: isDragging ? `${cfg.color}10` : 'rgba(255,255,255,0.025)',
        backdropFilter: 'blur(8px)',
        cursor: 'grab',
        transition: 'border 0.2s, background 0.2s',
        opacity: isDragging ? 0.4 : 1,
        '&:hover': { border: `1px solid ${cfg.color}44`, bgcolor: 'rgba(255,255,255,0.04)' },
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          bgcolor: cfg.dot, borderRadius: '2px 0 0 2px',
          boxShadow: `0 0 8px ${cfg.dot}`,
        },
      }}
    >
      {/* Priority indicator */}
      {state.priority === 'alta' && (
        <PriorityHighIcon sx={{ position: 'absolute', top: 6, right: 6, fontSize: 11, color: '#FF3B30' }} />
      )}

      {/* Client + type */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.7, pl: 0.5 }}>
        <Typography sx={{ fontSize: '0.6rem', color: cfg.color, fontWeight: 800, flex: 1, lineHeight: 1 }} noWrap>
          {item.c}
        </Typography>
        <Chip
          label={item.tp}
          size="small"
          sx={{ height: 14, fontSize: '0.48rem', bgcolor: 'rgba(255,255,255,0.06)', color: 'text.disabled', border: 'none', flexShrink: 0 }}
        />
      </Box>

      {/* Title */}
      <Typography sx={{ fontSize: '0.76rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3, mb: 0.8, pl: 0.5 }} noWrap>
        {state.title || item.n}
      </Typography>

      {/* Footer */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 0.5 }}>
        <AccessTimeIcon sx={{ fontSize: 9, color: isLate ? '#FF3B30' : 'text.disabled', flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.58rem', color: isLate ? '#FF3B30' : 'text.disabled', fontWeight: isLate ? 700 : 400, flex: 1 }}>
          {dateLabel()}
        </Typography>

        {hasComment && (
          <Tooltip title="Tem comentários">
            <CommentIcon sx={{ fontSize: 10, color: '#3B82F6' }} />
          </Tooltip>
        )}

        {/* Send to client button — only when Aprovado interno */}
        {state.status === 3 && onSendToClient && (
          <Tooltip title="Enviar ao cliente">
            <Box
              onClick={e => { e.stopPropagation(); onSendToClient(item.i, item.c) }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.3,
                px: 0.7, py: 0.2, borderRadius: 1,
                bgcolor: 'rgba(255,154,61,0.12)', border: '1px solid rgba(255,154,61,0.3)',
                cursor: 'pointer', flexShrink: 0,
                '&:hover': { bgcolor: 'rgba(255,154,61,0.22)' },
              }}
            >
              <SendIcon sx={{ fontSize: 9, color: '#FF9A3D' }} />
              <Typography sx={{ fontSize: '0.52rem', color: '#FF9A3D', fontWeight: 700, lineHeight: 1 }}>Enviar</Typography>
            </Box>
          </Tooltip>
        )}

        {/* WhatsApp sent indicator */}
        {state.status === 4 && (
          <WhatsAppIcon sx={{ fontSize: 11, color: '#25D366', flexShrink: 0 }} />
        )}
      </Box>

      {/* Rejection comment highlight */}
      {state.status === 6 && (state.rejectionText || (state.comments ?? []).filter(c => c.authorType === 'client').length > 0) && (
        <Box sx={{ mt: 0.8, pl: 0.5, pr: 0.2, py: 0.6, borderRadius: 1.5, bgcolor: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.18)' }}>
          <Typography sx={{ fontSize: '0.58rem', color: '#FF3B30', lineHeight: 1.4 }} noWrap>
            💬 {state.rejectionText || state.comments?.find(c => c.authorType === 'client')?.text}
          </Typography>
        </Box>
      )}
    </Paper>
  )
}

// ── Draggable wrapper ─────────────────────────────────────

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  return (
    <Box
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform), zIndex: isDragging ? 999 : undefined, position: 'relative' }}
    >
      {children}
    </Box>
  )
}

// ── Droppable column body ─────────────────────────────────

function DroppableZone({ status, children }: { status: Status; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` })
  const cfg = STATUS_CONFIG[status]
  return (
    <Box
      ref={setNodeRef}
      sx={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: 1, p: 0.5,
        borderRadius: 2, minHeight: 80,
        border: `1px dashed ${isOver ? cfg.color + '66' : 'transparent'}`,
        bgcolor: isOver ? `${cfg.color}08` : 'transparent',
        transition: 'all 0.18s',
      }}
    >
      {children}
    </Box>
  )
}

// ── Main KanbanTab ────────────────────────────────────────

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, s: Status) => void
  onDelete?: (id: number) => void
  onEdit?: (id: number, patch: ItemEditPatch) => void
  onAddItem?: (clientName: string, title: string, type: ContentType, date: Date, status: Status) => void
  allClients?: Client[]
  onSendToClient?: (itemId: number, clientName: string) => void
}

export default function KanbanTab({ items, states, onStatusChange, onDelete, onEdit, onAddItem, allClients, onSendToClient }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addClient, setAddClient] = useState('')
  const [addTitle, setAddTitle] = useState('')
  const [addType, setAddType] = useState<ContentType>('Post')
  const [addStatus, setAddStatus] = useState<Status>(0)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  const itemsByStatus = useMemo(() => {
    const map: Record<number, ContentItem[]> = {}
    COLUMNS.forEach(col => { map[col.status] = [] })
    items.forEach(item => {
      const st = states[item.i]?.status ?? item.s
      if (map[st] !== undefined) map[st].push(item)
    })
    return map
  }, [items, states])

  const activeItem = useMemo(() => activeId ? items.find(i => String(i.i) === activeId) ?? null : null, [activeId, items])

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const colId = String(over.id)
    if (!colId.startsWith('col-')) return
    const newStatus = Number(colId.replace('col-', '')) as Status
    const itemId = Number(active.id)
    const currentStatus = states[itemId]?.status ?? 0
    if (newStatus === currentStatus) return

    onStatusChange(itemId, newStatus)

    // Automation: ao aprovar internamente, envia automaticamente para o cliente via WhatsApp
    if (newStatus === 3) {
      const it = items.find(i => i.i === itemId)
      if (it) onSendToClient?.(itemId, it.c)
    }
  }, [states, items, onStatusChange, onSendToClient])

  const clientOptions = useMemo(() => (allClients ?? []).map(c => c.name).sort(), [allClients])

  const handleAddSubmit = () => {
    if (!addClient || !addTitle) return
    onAddItem?.(addClient, addTitle, addType, new Date(), addStatus)
    setAddOpen(false); setAddClient(''); setAddTitle(''); setAddType('Post'); setAddStatus(0)
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.2, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: 'primary.main' }}>Kanban</Typography>
        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>· {items.length} cards</Typography>
        <Box sx={{ flex: 1 }} />
        {/* Column summary chips */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', overflowX: 'auto' }}>
          {([6, 0, 4] as Status[]).map(s => {
            const count = itemsByStatus[s]?.length ?? 0
            if (!count) return null
            const cfg = STATUS_CONFIG[s]
            return (
              <Chip key={s} label={`${cfg.emoji} ${count}`} size="small"
                sx={{ fontSize: '0.6rem', height: 20, bgcolor: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }} />
            )
          })}
        </Box>
        <Button size="small" startIcon={<AddIcon sx={{ fontSize: 13 }} />} onClick={() => setAddOpen(true)}
          sx={{ fontSize: '0.65rem', border: '1px solid rgba(255,144,57,0.3)', color: 'primary.main', borderRadius: 2, px: 1.2, py: 0.3, '&:hover': { bgcolor: 'rgba(255,144,57,0.08)' } }}>
          Novo
        </Button>
      </Box>

      {/* Board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Box sx={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: 1.5, p: 1.5, alignItems: 'flex-start' }}>
          {COLUMNS.map(col => {
            const cfg = STATUS_CONFIG[col.status]
            const colItems = itemsByStatus[col.status] ?? []
            const today = new Date(); today.setHours(0,0,0,0)
            const lateCount = colItems.filter(i => i.dt < today && col.status !== 7 && col.status !== 5).length
            return (
              <Box key={col.status} sx={{ flex: '0 0 240px', maxHeight: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Column header */}
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 0.7, mb: 1, px: 1.2, py: 0.8,
                  borderRadius: 2, bgcolor: `${cfg.color}0c`, border: `1px solid ${cfg.color}20`,
                  flexShrink: 0,
                }}>
                  <Typography sx={{ fontSize: '0.78rem' }}>{cfg.emoji}</Typography>
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: cfg.color, flex: 1, lineHeight: 1 }} noWrap>
                    {cfg.label}
                  </Typography>
                  <Badge badgeContent={lateCount || undefined} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.5rem', minWidth: 14, height: 14 } }}>
                    <Box sx={{ minWidth: 20, height: 18, borderRadius: 3, bgcolor: `${cfg.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.6 }}>
                      <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: cfg.color }}>{colItems.length}</Typography>
                    </Box>
                  </Badge>
                </Box>

                {/* Cards scroll */}
                <Box sx={{ overflowY: 'auto', flex: 1 }}>
                  <DroppableZone status={col.status}>
                    {colItems.map(item => (
                      <DraggableCard key={item.i} id={String(item.i)}>
                        <KanbanCard
                          item={item}
                          state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }}
                          isDragging={activeId === String(item.i)}
                          onSendToClient={onSendToClient}
                        />
                      </DraggableCard>
                    ))}
                    {colItems.length === 0 && (
                      <Box sx={{ py: 3, textAlign: 'center', opacity: 0.3 }}>
                        <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>Arraste aqui</Typography>
                      </Box>
                    )}
                  </DroppableZone>
                </Box>
              </Box>
            )
          })}
        </Box>

        <DragOverlay dropAnimation={{ duration: 160, easing: 'ease-out' }}>
          {activeItem && (
            <Box sx={{ transform: 'rotate(2deg)', opacity: 0.9 }}>
              <KanbanCard
                item={activeItem}
                state={states[activeItem.i] ?? { status: activeItem.s, title: '', link: '', caption: '', notes: '' }}
                onSendToClient={onSendToClient}
              />
            </Box>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' } } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AddIcon sx={{ color: 'primary.main', fontSize: 18 }} />
            <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>Novo conteúdo</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>
          <TextField label="Cliente" size="small" fullWidth select value={addClient} onChange={e => setAddClient(e.target.value)} autoFocus>
            {clientOptions.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField label="Título" size="small" fullWidth value={addTitle} onChange={e => setAddTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddSubmit()} />
          <Box>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 0.5, display: 'block' }}>Tipo</Typography>
            <ToggleButtonGroup exclusive value={addType} onChange={(_, v) => v && setAddType(v)} size="small" fullWidth>
              {(['Post', 'Reel', 'Story', 'Carrossel'] as ContentType[]).map(t => (
                <ToggleButton key={t} value={t} sx={{ fontSize: '0.65rem', fontWeight: 700 }}>{t}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <TextField label="Status inicial" size="small" fullWidth select value={addStatus} onChange={e => setAddStatus(Number(e.target.value) as Status)}>
            {COLUMNS.map(col => <MenuItem key={col.status} value={col.status}>{STATUS_CONFIG[col.status].emoji} {STATUS_CONFIG[col.status].label}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button size="small" onClick={() => setAddOpen(false)}>Cancelar</Button>
          <Button size="small" variant="contained" disabled={!addClient || !addTitle} onClick={handleAddSubmit} sx={{ fontWeight: 700 }}>Criar card</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
