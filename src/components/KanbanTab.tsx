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
  ToggleButton, Tooltip, Badge, Menu,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import SendIcon from '@mui/icons-material/Send'
import PriorityHighIcon from '@mui/icons-material/PriorityHigh'
import CommentIcon from '@mui/icons-material/Comment'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import FilterListIcon from '@mui/icons-material/FilterList'
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt'
import type { Client, ContentItem, ContentType, ItemEditPatch, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'
import { NAME_MAP } from '../lib/users'

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
  item, state, isDragging, onSendToClient, onDeleteCard, onEditCard, onAssignResponsible,
}: {
  item: ContentItem
  state: ItemState
  isDragging?: boolean
  onSendToClient?: (id: number, clientName: string) => void
  onDeleteCard?: (id: number) => void
  onEditCard?: (id: number) => void
  onAssignResponsible?: (id: number, responsible: string | null) => void
}) {
  const [hover, setHover] = useState(false)
  const [assignAnchor, setAssignAnchor] = useState<HTMLElement | null>(null)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isLate = item.dt < today && state.status !== 7 && state.status !== 5
  const cfg = STATUS_CONFIG[state.status]
  const daysDiff = Math.round((item.dt.getTime() - today.getTime()) / 86400000)
  const hasComment = (state.comments?.length ?? 0) > 0 || Boolean(state.rejectionText)

  // SLA 48h: sent to client but no response in 48+ hours
  const sentHoursAgo = state.status === 4 && state.sentToClientAt
    ? (Date.now() - state.sentToClientAt) / 3_600_000
    : 0
  const isSlaBreached = sentHoursAgo >= 48

  const dateLabel = () => {
    if (isLate) return `${Math.abs(daysDiff)}d atraso`
    if (daysDiff === 0) return 'Hoje'
    if (daysDiff === 1) return 'Amanhã'
    return item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  return (
    <Paper
      elevation={0}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      sx={{
        p: 1.5, borderRadius: 2.5,
        border: `1px solid ${isSlaBreached ? 'rgba(255,59,48,0.55)' : isLate ? '#FF3B3044' : daysDiff === 0 ? 'rgba(255,144,57,0.45)' : cfg.color + '22'}`,
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
      {state.priority === 'alta' && !state.isTraffic && (
        <PriorityHighIcon sx={{ position: 'absolute', top: 6, right: 6, fontSize: 11, color: '#FF3B30' }} />
      )}

      {/* Tráfego pago badge */}
      {state.isTraffic && (
        <Tooltip title="Criativo para tráfego pago">
          <Box sx={{
            position: 'absolute', top: 5, right: 5,
            display: 'flex', alignItems: 'center', gap: 0.3,
            px: 0.5, py: 0.15, borderRadius: 0.8,
            bgcolor: 'rgba(255,215,0,0.14)', border: '1px solid rgba(255,215,0,0.4)',
          }}>
            <Typography sx={{ fontSize: '0.48rem', lineHeight: 1 }}>⚡</Typography>
            <Typography sx={{ fontSize: '0.44rem', color: '#FFD700', fontWeight: 800, letterSpacing: 0.2 }}>TRÁFEGO</Typography>
          </Box>
        </Tooltip>
      )}

      {/* Hover action buttons */}
      {hover && !isDragging && (onEditCard || onDeleteCard) && (
        <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.3, zIndex: 10 }}>
          {onEditCard && (
            <Box
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onEditCard(item.i) }}
              sx={{
                width: 20, height: 20, borderRadius: 1, cursor: 'pointer',
                bgcolor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              }}
            >
              <EditIcon sx={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }} />
            </Box>
          )}
          {onDeleteCard && (
            <Box
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onDeleteCard(item.i) }}
              sx={{
                width: 20, height: 20, borderRadius: 1, cursor: 'pointer',
                bgcolor: 'rgba(255,59,48,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                '&:hover': { bgcolor: 'rgba(255,59,48,0.3)' },
              }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 11, color: '#FF3B30' }} />
            </Box>
          )}
        </Box>
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

        {daysDiff === 0 && (
          <Chip
            label="URGENTE"
            size="small"
            sx={{ height: 14, fontSize: '0.44rem', fontWeight: 800, letterSpacing: 0.4, bgcolor: 'rgba(255,144,57,0.15)', color: '#ff9039', border: '1px solid rgba(255,144,57,0.4)', flexShrink: 0 }}
          />
        )}

        {hasComment && (
          <Tooltip title="Tem comentários">
            <CommentIcon sx={{ fontSize: 10, color: '#3B82F6' }} />
          </Tooltip>
        )}

        {/* Responsible chip */}
        <Box
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            if (!onAssignResponsible) return
            e.stopPropagation()
            setAssignAnchor(e.currentTarget)
          }}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.2, flexShrink: 0,
            cursor: onAssignResponsible ? 'pointer' : 'default',
            px: 0.4, py: 0.1, borderRadius: 0.8,
            '&:hover': onAssignResponsible ? { bgcolor: 'rgba(255,255,255,0.07)' } : {},
          }}
        >
          {state.responsible && NAME_MAP[state.responsible] ? (
            <Tooltip title={`${NAME_MAP[state.responsible].emoji} ${state.responsible} · ${NAME_MAP[state.responsible].role}`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2 }}>
                <Typography sx={{ fontSize: '0.72rem', lineHeight: 1 }}>{NAME_MAP[state.responsible].emoji}</Typography>
                <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: NAME_MAP[state.responsible].color, lineHeight: 1 }}>
                  {state.responsible.slice(0, 6)}
                </Typography>
              </Box>
            </Tooltip>
          ) : onAssignResponsible ? (
            <Tooltip title="Atribuir responsável">
              <PersonAddAltIcon sx={{ fontSize: 9, color: 'rgba(255,255,255,0.14)' }} />
            </Tooltip>
          ) : null}
        </Box>

        {/* Responsible assignment menu */}
        <Menu
          anchorEl={assignAnchor}
          open={Boolean(assignAnchor)}
          onClose={() => setAssignAnchor(null)}
          slotProps={{
            paper: {
              sx: {
                background: 'rgba(18,18,18,0.98)', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, minWidth: 190,
              }
            }
          }}
        >
          <Box sx={{ px: 1.5, py: 0.7, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Atribuir responsável
            </Typography>
          </Box>
          {Object.entries(NAME_MAP).map(([key, info]) => (
            <MenuItem
              key={key}
              selected={state.responsible === key}
              onClick={() => { onAssignResponsible!(item.i, key); setAssignAnchor(null) }}
              sx={{ gap: 1, py: 0.8, '&.Mui-selected': { bgcolor: `${info.color}12` } }}
            >
              <Typography sx={{ fontSize: '1rem', lineHeight: 1, minWidth: 22 }}>{info.emoji}</Typography>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: info.color, lineHeight: 1.2 }}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', lineHeight: 1 }}>{info.role}</Typography>
              </Box>
              {state.responsible === key && (
                <Typography sx={{ fontSize: '0.7rem', color: info.color }}>✓</Typography>
              )}
            </MenuItem>
          ))}
          {state.responsible && (
            <MenuItem
              onClick={() => { onAssignResponsible!(item.i, null); setAssignAnchor(null) }}
              sx={{ fontSize: '0.65rem', color: 'error.main', borderTop: '1px solid rgba(255,255,255,0.05)', mt: 0.5, py: 0.7 }}
            >
              Remover responsável
            </MenuItem>
          )}
        </Menu>

        {/* Send to client button — only when Aprovado interno */}
        {state.status === 3 && onSendToClient && (
          <Tooltip title="Enviar ao cliente">
            <Box
              onPointerDown={e => e.stopPropagation()}
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

      {/* SLA 48h breach warning */}
      {isSlaBreached && (
        <Box sx={{
          mt: 0.8, pl: 0.5, pr: 0.2, py: 0.5, borderRadius: 1.5,
          bgcolor: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.22)',
          display: 'flex', alignItems: 'center', gap: 0.4,
          animation: 'slaPulse 2.5s ease-in-out infinite',
          '@keyframes slaPulse': { '0%,100%': { borderColor: 'rgba(255,59,48,0.22)' }, '50%': { borderColor: 'rgba(255,59,48,0.55)' } },
        }}>
          <Typography sx={{ fontSize: '0.62rem', lineHeight: 1 }}>⏰</Typography>
          <Typography sx={{ fontSize: '0.55rem', color: '#FF3B30', fontWeight: 700, lineHeight: 1 }}>
            SLA: {Math.floor(sentHoursAgo)}h sem resposta
          </Typography>
        </Box>
      )}

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
  onUpdateState?: (id: number, patch: Partial<ItemState>) => void
  onAddItem?: (clientName: string, title: string, type: ContentType, date: Date, status: Status) => void
  allClients?: Client[]
  onSendToClient?: (itemId: number, clientName: string, isTraffic?: boolean) => void
}

export default function KanbanTab({ items, states, onStatusChange, onDelete, onEdit, onUpdateState, onAddItem, allClients, onSendToClient }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)

  // ── Add dialog ───────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false)
  const [addClient, setAddClient] = useState('')
  const [addTitle, setAddTitle] = useState('')
  const [addType, setAddType] = useState<ContentType>('Post')
  const [addStatus, setAddStatus] = useState<Status>(0)
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10))

  // ── Edit dialog ──────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editType, setEditType] = useState<ContentType>('Post')
  const [editDate, setEditDate] = useState('')

  // ── Delete confirm ───────────────────────────────────────
  const [deleteId, setDeleteId] = useState<number | null>(null)

  // ── Client filter ────────────────────────────────────────
  const [filterClient, setFilterClient] = useState('all')

  // ── Sort by date ─────────────────────────────────────────
  const [sortByDate, setSortByDate] = useState(true)

  // ── Bulk select ──────────────────────────────────────────
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<Status>(1)

  function toggleBulkSelect(id: number) {
    setBulkSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function applyBulkStatus() {
    bulkSelected.forEach(id => onStatusChange(id, bulkStatus))
    setBulkSelected(new Set())
    setBulkMode(false)
  }

  function exitBulkMode() {
    setBulkMode(false)
    setBulkSelected(new Set())
  }

  // ── View mode: all / design (posts only) / video (reels only) ──
  const [viewMode, setViewMode] = useState<'all' | 'design' | 'video'>('all')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  const filteredItems = useMemo(() => {
    let result = filterClient === 'all' ? items : items.filter(i => i.c === filterClient)
    if (viewMode === 'design') result = result.filter(i => i.tp !== 'Reel')
    if (viewMode === 'video')  result = result.filter(i => i.tp === 'Reel')
    return result
  }, [items, filterClient, viewMode])

  const itemsByStatus = useMemo(() => {
    const map: Record<number, ContentItem[]> = {}
    COLUMNS.forEach(col => { map[col.status] = [] })
    filteredItems.forEach(item => {
      const st = states[item.i]?.status ?? item.s
      if (map[st] !== undefined) map[st].push(item)
    })
    if (sortByDate) {
      const todayMs = new Date().setHours(0, 0, 0, 0)
      const sortFn = (a: ContentItem, b: ContentItem) => {
        const aMs = new Date(a.dt).setHours(0, 0, 0, 0)
        const bMs = new Date(b.dt).setHours(0, 0, 0, 0)
        // Today first, then ascending by date
        if (aMs === todayMs && bMs !== todayMs) return -1
        if (bMs === todayMs && aMs !== todayMs) return 1
        return aMs - bMs
      }
      Object.keys(map).forEach(k => map[Number(k)].sort(sortFn))
    }
    return map
  }, [filteredItems, states, sortByDate])

  const activeItem = useMemo(() => activeId ? items.find(i => String(i.i) === activeId) ?? null : null, [activeId, items])

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  // ── Send-to-client confirm modal ────────────────────────
  const [sendConfirmItem, setSendConfirmItem] = useState<{ id: number; clientName: string } | null>(null)
  const [sendConfirming, setSendConfirming]   = useState(false)
  const [sendIsTraffic, setSendIsTraffic]     = useState(false)

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

    // Show confirmation modal when moving to "Enviado ao cliente" (status 4)
    if (newStatus === 4) {
      const it = items.find(i => i.i === itemId)
      if (it) { setSendIsTraffic(false); setSendConfirmItem({ id: itemId, clientName: it.c }) }
    }
  }, [states, items, onStatusChange])

  async function handleConfirmSendToClient() {
    if (!sendConfirmItem) return
    setSendConfirming(true)
    if (sendIsTraffic) onUpdateState?.(sendConfirmItem.id, { isTraffic: true })
    await onSendToClient?.(sendConfirmItem.id, sendConfirmItem.clientName, sendIsTraffic)
    setSendConfirming(false)
    setSendConfirmItem(null)
    setSendIsTraffic(false)
  }

  const clientOptions = useMemo(() => (allClients ?? []).map(c => c.name).sort(), [allClients])

  const handleAddSubmit = () => {
    if (!addClient || !addTitle) return
    const date = addDate ? new Date(addDate + 'T12:00:00') : new Date()
    onAddItem?.(addClient, addTitle, addType, date, addStatus)
    setAddOpen(false)
    setAddClient(''); setAddTitle(''); setAddType('Post'); setAddStatus(0)
    setAddDate(new Date().toISOString().slice(0, 10))
  }

  const handleOpenEdit = (id: number) => {
    const item = items.find(i => i.i === id)
    if (!item) return
    const st = states[id]
    setEditId(id)
    setEditTitle(st?.title || item.n)
    setEditType(item.tp)
    setEditDate(item.dt.toISOString().slice(0, 10))
    setEditOpen(true)
  }

  const handleEditSubmit = () => {
    if (!editId) return
    const item = items.find(i => i.i === editId)
    if (!item) return

    const newDate = editDate ? new Date(editDate + 'T12:00:00') : item.dt
    const titleChanged = editTitle !== (states[editId]?.title || item.n)
    const typeChanged = editType !== item.tp
    const dateChanged = newDate.toDateString() !== item.dt.toDateString()

    if (titleChanged) onUpdateState?.(editId, { title: editTitle })
    if (typeChanged || dateChanged) onEdit?.(editId, { tp: editType, dt: newDate })

    setEditOpen(false)
    setEditId(null)
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.2, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: 'primary.main' }}>Kanban</Typography>
        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>· {filteredItems.length} cards</Typography>

        {/* View mode: Geral / Design / Editor */}
        <Box sx={{ display: 'flex', borderRadius: 1.5, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          {([
            { key: 'all',    label: '⚡ Geral',   color: '#ff9039' },
            { key: 'design', label: '🎨 Design',  color: '#C084FC' },
            { key: 'video',  label: '🎬 Editor',  color: '#60A5FA' },
          ] as const).map(m => (
            <Box key={m.key} onClick={() => setViewMode(m.key)} sx={{
              px: 1.2, py: 0.4, cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
              bgcolor: viewMode === m.key ? `${m.color}18` : 'transparent',
              color: viewMode === m.key ? m.color : 'rgba(255,255,255,0.28)',
              borderRight: m.key !== 'video' ? '1px solid rgba(255,255,255,0.08)' : 'none',
              transition: 'all 0.15s',
              '&:hover': { bgcolor: `${m.color}10`, color: m.color },
            }}>
              {m.label}
            </Box>
          ))}
        </Box>

        {/* Client filter */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <FilterListIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          <TextField
            select size="small" value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
            sx={{
              minWidth: 140,
              '& .MuiInputBase-root': { fontSize: '0.65rem', height: 26, bgcolor: 'rgba(255,255,255,0.04)' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <MenuItem value="all" sx={{ fontSize: '0.65rem' }}>Todos os clientes</MenuItem>
            {clientOptions.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.65rem' }}>{c}</MenuItem>)}
          </TextField>
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Sort toggle */}
        <Button
          size="small"
          onClick={() => setSortByDate(v => !v)}
          sx={{
            fontSize: '0.62rem', borderRadius: 2, px: 1.2, py: 0.3,
            border: sortByDate ? '1px solid rgba(255,144,57,0.4)' : '1px solid rgba(255,255,255,0.12)',
            color: sortByDate ? 'primary.main' : 'text.secondary',
            bgcolor: sortByDate ? 'rgba(255,144,57,0.08)' : 'transparent',
            '&:hover': { bgcolor: sortByDate ? 'rgba(255,144,57,0.15)' : 'rgba(255,255,255,0.04)' },
          }}
        >
          📅 {sortByDate ? 'Por data' : 'Livre'}
        </Button>

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

        <Button
          size="small"
          onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
          sx={{
            fontSize: '0.62rem', borderRadius: 2, px: 1.2, py: 0.3,
            border: bulkMode ? '1px solid rgba(59,142,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
            color: bulkMode ? '#3B8EFF' : 'text.secondary',
            bgcolor: bulkMode ? 'rgba(59,142,255,0.08)' : 'transparent',
            '&:hover': { bgcolor: bulkMode ? 'rgba(59,142,255,0.15)' : 'rgba(255,255,255,0.04)' },
          }}
        >
          {bulkMode ? `✓ ${bulkSelected.size} sel.` : 'Selecionar'}
        </Button>

        <Button size="small" startIcon={<AddIcon sx={{ fontSize: 13 }} />} onClick={() => setAddOpen(true)}
          sx={{ fontSize: '0.65rem', border: '1px solid rgba(255,144,57,0.3)', color: 'primary.main', borderRadius: 2, px: 1.2, py: 0.3, '&:hover': { bgcolor: 'rgba(255,144,57,0.08)' } }}>
          Novo
        </Button>
      </Box>

      {/* ── Bulk action bar ── */}
      {bulkMode && bulkSelected.size > 0 && (
        <Box sx={{
          px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
          borderBottom: '1px solid rgba(59,142,255,0.2)',
          bgcolor: 'rgba(59,142,255,0.06)',
          animation: 'slideDown 0.2s ease both',
          '@keyframes slideDown': { '0%': { opacity: 0, transform: 'translateY(-8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        }}>
          <Typography sx={{ fontSize: '0.7rem', color: '#3B8EFF', fontWeight: 700 }}>
            {bulkSelected.size} card{bulkSelected.size !== 1 ? 's' : ''} selecionado{bulkSelected.size !== 1 ? 's' : ''}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>Mover para:</Typography>
          <TextField
            select size="small" value={bulkStatus}
            onChange={e => setBulkStatus(Number(e.target.value) as Status)}
            sx={{
              minWidth: 160,
              '& .MuiInputBase-root': { fontSize: '0.65rem', height: 26, bgcolor: 'rgba(255,255,255,0.04)' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(59,142,255,0.3)' },
            }}
          >
            {COLUMNS.map(col => (
              <MenuItem key={col.status} value={col.status} sx={{ fontSize: '0.65rem' }}>
                {STATUS_CONFIG[col.status].emoji} {STATUS_CONFIG[col.status].label}
              </MenuItem>
            ))}
          </TextField>
          <Button size="small" variant="contained" onClick={applyBulkStatus}
            sx={{ fontSize: '0.65rem', py: 0.3, background: 'linear-gradient(135deg,#3B8EFF,#2563EB)', color: '#fff', fontWeight: 700 }}>
            Aplicar
          </Button>
          <Button size="small" onClick={exitBulkMode}
            sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>
            Cancelar
          </Button>
        </Box>
      )}

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
                    {colItems.map(item => {
                      const isSelected = bulkSelected.has(item.i)
                      return bulkMode ? (
                        <Box
                          key={item.i}
                          onClick={() => toggleBulkSelect(item.i)}
                          sx={{
                            position: 'relative', cursor: 'pointer', mb: 0.5,
                            outline: isSelected ? '2px solid #3B8EFF' : '2px solid transparent',
                            borderRadius: 2, transition: 'outline 0.15s',
                            '&:hover': { outline: '2px solid rgba(59,142,255,0.5)' },
                          }}
                        >
                          {/* Checkbox indicator */}
                          <Box sx={{
                            position: 'absolute', top: 6, right: 6, zIndex: 10,
                            width: 16, height: 16, borderRadius: 1,
                            bgcolor: isSelected ? '#3B8EFF' : 'rgba(255,255,255,0.15)',
                            border: `2px solid ${isSelected ? '#3B8EFF' : 'rgba(255,255,255,0.3)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {isSelected && <Typography sx={{ fontSize: '0.5rem', color: '#fff', lineHeight: 1, fontWeight: 900 }}>✓</Typography>}
                          </Box>
                          <KanbanCard
                            item={item}
                            state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }}
                          />
                        </Box>
                      ) : (
                        <DraggableCard key={item.i} id={String(item.i)}>
                          <KanbanCard
                            item={item}
                            state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }}
                            isDragging={activeId === String(item.i)}
                            onSendToClient={onSendToClient}
                            onDeleteCard={onDelete ? (id) => setDeleteId(id) : undefined}
                            onEditCard={onEdit || onUpdateState ? handleOpenEdit : undefined}
                            onAssignResponsible={onUpdateState ? (id, resp) => onUpdateState(id, { responsible: resp ?? undefined }) : undefined}
                          />
                        </DraggableCard>
                      )
                    })}
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

      {/* ── Add dialog ── */}
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
          <TextField
            label="Data de publicação" type="date" size="small" fullWidth
            value={addDate}
            onChange={e => setAddDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
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

      {/* ── Edit dialog ── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' } } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditIcon sx={{ color: 'primary.main', fontSize: 18 }} />
            <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>Editar card</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>
          <TextField
            label="Título" size="small" fullWidth autoFocus
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEditSubmit()}
          />
          <TextField
            label="Data de publicação" type="date" size="small" fullWidth
            value={editDate}
            onChange={e => setEditDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Box>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 0.5, display: 'block' }}>Tipo</Typography>
            <ToggleButtonGroup exclusive value={editType} onChange={(_, v) => v && setEditType(v)} size="small" fullWidth>
              {(['Post', 'Reel', 'Story', 'Carrossel'] as ContentType[]).map(t => (
                <ToggleButton key={t} value={t} sx={{ fontSize: '0.65rem', fontWeight: 700 }}>{t}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button size="small" onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button size="small" variant="contained" disabled={!editTitle.trim()} onClick={handleEditSubmit} sx={{ fontWeight: 700 }}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirm dialog ── */}
      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,59,48,0.2)' } } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography fontWeight={800} color="error.main" sx={{ fontSize: '0.95rem' }}>Apagar card?</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            {deleteId && (states[deleteId]?.title || items.find(i => i.i === deleteId)?.n || 'Este card')} será removido permanentemente.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button size="small" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button
            size="small" variant="contained" color="error"
            startIcon={<DeleteOutlineIcon sx={{ fontSize: 14 }} />}
            onClick={() => {
              if (deleteId !== null) onDelete?.(deleteId)
              setDeleteId(null)
            }}
            sx={{ fontWeight: 700 }}
          >
            Apagar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Send-to-client confirm modal ── */}
      <Dialog
        open={!!sendConfirmItem}
        onClose={() => setSendConfirmItem(null)}
        maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,154,61,0.25)' } } }}
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SendIcon sx={{ color: '#FF9A3D', fontSize: 18 }} />
            <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>Enviar ao cliente</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {sendConfirmItem && (() => {
            const item   = items.find(i => i.i === sendConfirmItem.id)
            const title  = states[sendConfirmItem.id]?.title || item?.n || 'Este conteúdo'
            const client = sendConfirmItem.clientName
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,154,61,0.06)', border: '1px solid rgba(255,154,61,0.2)' }}>
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', mb: 0.3 }}>Conteúdo</Typography>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>{title}</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#FF9A3D', mt: 0.3 }}>{client}</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                  📤 Isso vai gerar o link de portal do cliente e registrar a data de envio. O cliente poderá aprovar ou reprovar este conteúdo.
                </Typography>

                {/* ── Tráfego pago toggle ── */}
                <Box
                  onClick={() => setSendIsTraffic(v => !v)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
                    p: 1.5, borderRadius: 2,
                    bgcolor: sendIsTraffic ? 'rgba(255,215,0,0.07)' : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${sendIsTraffic ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: 'rgba(255,215,0,0.3)', bgcolor: 'rgba(255,215,0,0.05)' },
                  }}
                >
                  {/* Toggle visual */}
                  <Box sx={{
                    width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                    bgcolor: sendIsTraffic ? '#FFD700' : 'rgba(255,255,255,0.15)',
                    position: 'relative', transition: 'all 0.2s',
                    boxShadow: sendIsTraffic ? '0 0 10px rgba(255,215,0,0.5)' : 'none',
                  }}>
                    <Box sx={{
                      position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%',
                      bgcolor: '#fff', transition: 'left 0.2s',
                      left: sendIsTraffic ? 19 : 3,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: sendIsTraffic ? '#FFD700' : 'rgba(255,255,255,0.6)' }}>
                      ⚡ Usar em tráfego pago
                    </Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
                      {sendIsTraffic
                        ? 'O cliente será notificado que este criativo vai para anúncios'
                        : 'Ativar se este criativo será impulsionado como anúncio'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button size="small" onClick={() => setSendConfirmItem(null)}>Cancelar</Button>
          <Button
            size="small" variant="contained"
            onClick={handleConfirmSendToClient}
            disabled={sendConfirming}
            startIcon={sendConfirming ? undefined : <SendIcon sx={{ fontSize: 14 }} />}
            sx={{
              background: 'linear-gradient(135deg, #FF9A3D, #ff5339)',
              color: '#000', fontWeight: 800,
              '&:hover': { filter: 'brightness(1.1)' },
            }}
          >
            {sendConfirming ? 'Enviando...' : 'Confirmar envio'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
