import { useMemo, useState, useCallback, useEffect } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragEndEvent, type DragStartEvent,
  closestCenter, pointerWithin,
  type CollisionDetection,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Box, Typography, Paper, Chip, Tooltip, Badge,
  Button, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  ToggleButtonGroup, ToggleButton, IconButton,
} from '@mui/material'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import FilterListIcon from '@mui/icons-material/FilterList'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
import type { Client, ContentItem, ContentType, ItemEditPatch, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'

// ── Column definitions ────────────────────────────────────

interface ColDef { status: Status; label: string; color: string }

const VIDEO_COLS: ColDef[] = [
  { status: 0, label: 'A fazer',        color: '#71717A' },
  { status: 1, label: 'Em produção',    color: '#60A5FA' },
  { status: 2, label: 'Aprov. interna', color: '#3B8EFF' },
  { status: 6, label: 'Reprovado',      color: '#FF3B30' },
]

const DESIGN_COLS: ColDef[] = [
  { status: 0, label: 'A fazer',        color: '#71717A' },
  { status: 1, label: 'Em produção',    color: '#C084FC' },
  { status: 2, label: 'Aprov. interna', color: '#3B8EFF' },
  { status: 6, label: 'Reprovado',      color: '#FF3B30' },
  { status: 5, label: 'Produzido',      color: '#00C875' },
]

const FEED_COLS: ColDef[] = [
  { status: 0, label: 'A fazer',        color: '#71717A' },
  { status: 1, label: 'Em produção',    color: '#F97316' },
  { status: 2, label: 'Aprov. interna', color: '#3B8EFF' },
  { status: 6, label: 'Reprovado',      color: '#FF3B30' },
  { status: 5, label: 'Produzido',      color: '#00C875' },
]

const SOCIAL_COLS: ColDef[] = [
  { status: 2, label: 'Aprov. interna',  color: '#3B8EFF' },
  { status: 3, label: 'Aprovado',        color: '#2F80ED' },
  { status: 4, label: 'Enviado cliente', color: '#FF9A3D' },
  { status: 6, label: 'Reprovado',       color: '#FF3B30' },
  { status: 5, label: 'Aprov. cliente',  color: '#00C875' },
  { status: 7, label: 'Publicado',       color: '#00C47A' },
]

const TYPE_COLOR: Record<string, string> = {
  Post: '#60A5FA', Reel: '#C084FC', Story: '#FB7185', Carrossel: '#34D399', Feed: '#F97316',
}

const TYPE_EMOJI: Record<string, string> = {
  Post: '🖼️', Reel: '🎬', Story: '⭐', Carrossel: '🗂️', Feed: '📸',
}

const ALL_TYPES: ContentType[] = ['Post', 'Reel', 'Story', 'Carrossel', 'Feed']

const BOARDS = [
  { label: 'Vídeo',  emoji: '🎬', color: '#60A5FA', cols: VIDEO_COLS,  key: 'vid' },
  { label: 'Design', emoji: '🎨', color: '#C084FC', cols: DESIGN_COLS, key: 'des' },
  { label: 'Feed',   emoji: '📸', color: '#F97316', cols: FEED_COLS,   key: 'fed' },
  { label: 'Social', emoji: '📱', color: '#00C47A', cols: SOCIAL_COLS, key: 'soc' },
]

// ── Urgency helpers ───────────────────────────────────────

function urgencyBorder(dt: Date, status: Status) {
  if (status === 7 || status === 5) return 'rgba(255,255,255,0.07)'
  const todayMs = new Date().setHours(0, 0, 0, 0)
  const diff = Math.round((new Date(dt).setHours(0, 0, 0, 0) - todayMs) / 86400000)
  if (diff < 0)  return 'rgba(255,59,48,0.4)'
  if (diff === 0) return 'rgba(255,144,57,0.4)'
  return 'rgba(255,255,255,0.07)'
}

function getDateLabel(dt: Date) {
  const todayMs = new Date().setHours(0, 0, 0, 0)
  const diff = Math.round((new Date(dt).setHours(0, 0, 0, 0) - todayMs) / 86400000)
  if (diff < 0)  return `${Math.abs(diff)}d atraso`
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  return new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ── Mini card ─────────────────────────────────────────────

function MiniCard({ item, state, isDragging, colColor, isSelected, bulkMode, onSelect, onEdit }: {
  item: ContentItem
  state: ItemState
  isDragging?: boolean
  colColor: string
  isSelected?: boolean
  bulkMode?: boolean
  onSelect?: () => void
  onEdit?: () => void
}) {
  const [hover, setHover] = useState(false)
  const border = urgencyBorder(item.dt, state.status)
  const dLabel = getDateLabel(item.dt)
  const isLate = dLabel.includes('atraso')
  const tc = TYPE_COLOR[item.tp] ?? '#888'

  return (
    <Paper
      elevation={0}
      onClick={bulkMode ? onSelect : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      sx={{
        p: 1.2, borderRadius: 2,
        bgcolor: isDragging ? `${colColor}10` : isSelected ? `${colColor}12` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isSelected ? colColor + '66' : border}`,
        outline: isSelected ? `2px solid ${colColor}55` : '2px solid transparent',
        opacity: isDragging ? 0.35 : 1,
        cursor: bulkMode ? 'pointer' : 'grab',
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border 0.12s, background-color 0.12s',
        '&::before': {
          content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 2.5,
          bgcolor: colColor, borderRadius: '2px 0 0 2px', boxShadow: `0 0 6px ${colColor}`,
        },
        '&:hover': { bgcolor: bulkMode ? `${colColor}16` : 'rgba(255,255,255,0.055)' },
      }}
    >
      {/* Bulk checkbox */}
      {bulkMode && (
        <Box sx={{
          position: 'absolute', top: 5, right: 5, zIndex: 10,
          width: 14, height: 14, borderRadius: 0.8,
          bgcolor: isSelected ? colColor : 'rgba(255,255,255,0.12)',
          border: `1.5px solid ${isSelected ? colColor : 'rgba(255,255,255,0.25)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isSelected && <Typography sx={{ fontSize: '0.45rem', color: '#000', lineHeight: 1, fontWeight: 900 }}>✓</Typography>}
        </Box>
      )}

      {/* Edit button on hover */}
      {!bulkMode && hover && onEdit && (
        <Box
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onEdit() }}
          sx={{
            position: 'absolute', top: 4, right: 4, zIndex: 10,
            width: 20, height: 20, borderRadius: 1, cursor: 'pointer',
            bgcolor: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
          }}
        >
          <EditIcon sx={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }} />
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, pl: 0.3, pr: !bulkMode && onEdit ? 2.5 : 0 }}>
        <Chip label={`${TYPE_EMOJI[item.tp] ?? ''} ${item.tp}`} size="small" sx={{
          height: 13, fontSize: '0.44rem', fontWeight: 700,
          bgcolor: `${tc}18`, color: tc, border: `1px solid ${tc}33`, flexShrink: 0,
        }} />
        <Typography sx={{ fontSize: '0.58rem', color: colColor, fontWeight: 800, flex: 1, lineHeight: 1 }} noWrap>
          {item.c}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.88)', lineHeight: 1.25, pl: 0.3, mb: 0.5 }} noWrap>
        {state.title || item.n}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, pl: 0.3 }}>
        <AccessTimeIcon sx={{ fontSize: 8, color: isLate ? '#FF3B30' : 'text.disabled', flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.54rem', color: isLate ? '#FF3B30' : 'text.disabled', fontWeight: isLate ? 700 : 400, lineHeight: 1 }}>
          {dLabel}
        </Typography>
      </Box>
    </Paper>
  )
}

// ── Drag wrapper ──────────────────────────────────────────

function DragCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  return (
    <Box ref={setNodeRef} {...listeners} {...attributes}
      style={{
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 999 : undefined,
        position: 'relative',
        opacity: isDragging ? 0.35 : 1,
        willChange: isDragging ? 'transform' : undefined,
      }}>
      {children}
    </Box>
  )
}

// ── Droppable column zone ─────────────────────────────────

function DropCol({ colId, color, children }: { colId: string; color: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: colId })
  return (
    <Box ref={setNodeRef} sx={{
      flex: 1, display: 'flex', flexDirection: 'column', gap: 0.8, p: 0.5,
      borderRadius: 1.5, minHeight: 100,
      border: `1px dashed ${isOver ? color + '88' : 'transparent'}`,
      bgcolor: isOver ? `${color}10` : 'transparent',
      transition: 'border 0.1s, background-color 0.1s',
      boxShadow: isOver ? `inset 0 0 0 1px ${color}40` : 'none',
    }}>
      {children}
    </Box>
  )
}

// ── Mini Kanban board ─────────────────────────────────────

interface MiniKanbanProps {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, s: Status) => void
  onEdit?: (id: number) => void
  columns: ColDef[]
  filterFn: (item: ContentItem, state: ItemState) => boolean
  filterClient: string
  sortByDate: boolean
  bulkMode: boolean
  bulkSelected: Set<number>
  onBulkToggle: (id: number) => void
  boardKey: string
}

function MiniKanban({
  items, states, onStatusChange, onEdit, columns, filterFn,
  filterClient, sortByDate, bulkMode, bulkSelected, onBulkToggle, boardKey,
}: MiniKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 10 } }),
  )

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const hits = pointerWithin(args)
    const colHits = hits.filter(({ id }) => String(id).startsWith(`${boardKey}-col-`))
    if (colHits.length > 0) return colHits
    return closestCenter(args)
  }, [boardKey])

  const boardItems = useMemo(() => {
    return items.filter(item => {
      if (filterClient !== 'all' && item.c !== filterClient) return false
      const st = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
      return filterFn(item, st)
    })
  }, [items, states, filterFn, filterClient])

  const byStatus = useMemo(() => {
    const map: Record<number, ContentItem[]> = {}
    columns.forEach(c => { map[c.status] = [] })
    const todayMs = new Date().setHours(0, 0, 0, 0)
    boardItems.forEach(item => {
      const st = states[item.i]?.status ?? item.s
      if (map[st] !== undefined) map[st].push(item)
    })
    if (sortByDate) {
      Object.keys(map).forEach(k => {
        map[Number(k)].sort((a, b) => {
          const aMs = new Date(a.dt).setHours(0, 0, 0, 0)
          const bMs = new Date(b.dt).setHours(0, 0, 0, 0)
          const aOver = aMs < todayMs
          const bOver = bMs < todayMs
          if (aOver && !bOver) return -1
          if (!aOver && bOver) return 1
          return aMs - bMs
        })
      })
    }
    return map
  }, [boardItems, states, columns, sortByDate])

  const activeItem = useMemo(() => activeId ? items.find(i => String(i.i) === activeId) ?? null : null, [activeId, items])
  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const colId = String(over.id)
    if (!colId.startsWith(`${boardKey}-col-`)) return
    const newStatus = Number(colId.replace(`${boardKey}-col-`, '')) as Status
    const itemId = Number(active.id)
    const currentStatus = states[itemId]?.status ?? 0
    if (newStatus === currentStatus) return
    onStatusChange(itemId, newStatus)
  }, [states, onStatusChange, boardKey])

  const today = new Date(); today.setHours(0, 0, 0, 0)

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Box sx={{ display: 'flex', gap: 1.2, height: '100%' }}>
        {columns.map(col => {
          const colItems = byStatus[col.status] ?? []
          const lateCount = colItems.filter(i => {
            const dt = new Date(i.dt); dt.setHours(0, 0, 0, 0)
            return dt < today && col.status !== 5 && col.status !== 7
          }).length

          return (
            <Box key={col.status} sx={{ flex: '0 0 210px', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
              {/* Column header */}
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.8,
                px: 1, py: 0.7, borderRadius: 1.5,
                bgcolor: `${col.color}0e`, border: `1px solid ${col.color}28`, flexShrink: 0,
              }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: col.color, boxShadow: `0 0 6px ${col.color}`, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: col.color, flex: 1, lineHeight: 1 }} noWrap>
                  {col.label}
                </Typography>
                <Badge badgeContent={lateCount || undefined} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.45rem', minWidth: 13, height: 13 } }}>
                  <Box sx={{ minWidth: 18, height: 16, px: 0.5, borderRadius: 3, bgcolor: `${col.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ fontSize: '0.56rem', fontWeight: 800, color: col.color, lineHeight: 1 }}>{colItems.length}</Typography>
                  </Box>
                </Badge>
              </Box>

              {/* Cards */}
              <Box sx={{ overflowY: 'auto', flex: 1 }}>
                <DropCol colId={`${boardKey}-col-${col.status}`} color={col.color}>
                  {colItems.map(item => {
                    const st = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
                    const isSelected = bulkSelected.has(item.i)
                    const card = (
                      <MiniCard
                        item={item} state={st}
                        isDragging={activeId === String(item.i)}
                        colColor={col.color}
                        isSelected={isSelected}
                        bulkMode={bulkMode}
                        onSelect={() => onBulkToggle(item.i)}
                        onEdit={onEdit ? () => onEdit(item.i) : undefined}
                      />
                    )
                    return bulkMode ? (
                      <Box key={item.i}>{card}</Box>
                    ) : (
                      <DragCard key={item.i} id={String(item.i)}>{card}</DragCard>
                    )
                  })}
                  {colItems.length === 0 && (
                    <Box sx={{ py: 3, textAlign: 'center', opacity: 0.22 }}>
                      <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>Vazio · arraste aqui</Typography>
                    </Box>
                  )}
                </DropCol>
              </Box>
            </Box>
          )
        })}
      </Box>

      {!bulkMode && (
        <DragOverlay dropAnimation={{ duration: 140, easing: 'ease-out' }}>
          {activeItem && (() => {
            const st = states[activeItem.i] ?? { status: activeItem.s, title: '', link: '', caption: '', notes: '' }
            const col = columns.find(c => c.status === (st.status ?? activeItem.s)) ?? columns[0]
            return (
              <Box sx={{ transform: 'rotate(2deg)', opacity: 0.9 }}>
                <MiniCard item={activeItem} state={st} colColor={col.color} />
              </Box>
            )
          })()}
        </DragOverlay>
      )}
    </DndContext>
  )
}

// ── Props ─────────────────────────────────────────────────

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, s: Status) => void
  onDelete?: (id: number) => void
  onEdit?: (id: number, patch: ItemEditPatch) => void
  onUpdateState?: (id: number, patch: Partial<ItemState>) => void
  allClients?: Client[]
}

// ── Main ─────────────────────────────────────────────────

export default function ProducaoTab({ items, states, onStatusChange, onDelete, onEdit, onUpdateState, allClients }: Props) {
  const [subTab, setSubTab]         = useState(0)
  const [filterClient, setFilterClient] = useState('all')
  const [sortByDate, setSortByDate] = useState(true)
  const [bulkMode, setBulkMode]     = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<Status>(1)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  // ── Edit dialog ───────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId]     = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate]   = useState('')
  const [editType, setEditType]   = useState<ContentType>('Post')

  const handleOpenEdit = useCallback((id: number) => {
    const item = items.find(i => i.i === id); if (!item) return
    const st = states[id]
    setEditId(id)
    setEditTitle(st?.title || item.n)
    setEditDate(item.dt instanceof Date ? item.dt.toISOString().slice(0, 10) : String(item.dt).slice(0, 10))
    setEditType(item.tp)
    setEditOpen(true)
  }, [items, states])

  const handleSaveEdit = () => {
    if (!editId) return
    const item = items.find(i => i.i === editId); if (!item) return
    const newDate = editDate ? new Date(editDate + 'T12:00:00') : item.dt
    const titleChanged = editTitle.trim() !== (states[editId]?.title || item.n)
    const typeChanged  = editType !== item.tp
    const dateChanged  = newDate.toDateString() !== new Date(item.dt).toDateString()
    if (titleChanged) onUpdateState?.(editId, { title: editTitle.trim() })
    if (typeChanged || dateChanged) onEdit?.(editId, { tp: editType, dt: newDate })
    setEditOpen(false); setEditId(null)
  }

  useEffect(() => { setBulkSelected(new Set()); setBulkMode(false) }, [subTab])

  const toggleBulk = (id: number) => {
    setBulkSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function applyBulkStatus() {
    bulkSelected.forEach(id => onStatusChange(id, bulkStatus))
    setBulkSelected(new Set()); setBulkMode(false)
  }

  function applyBulkDelete() {
    bulkSelected.forEach(id => onDelete?.(id))
    setBulkSelected(new Set()); setBulkMode(false); setBulkDeleteConfirm(false)
  }

  const clientOptions = useMemo(() => (allClients ?? []).map(c => c.name).sort(), [allClients])

  const activeCols = BOARDS[subTab].cols

  // ── Item counts per board (badge numbers) ────────────────
  const counts = useMemo(() => {
    const videoFn   = (tp: string) => tp === 'Reel'
    const designFn  = (tp: string) => tp === 'Post' || tp === 'Story' || tp === 'Carrossel'
    const feedFn    = (tp: string) => tp === 'Feed'
    const fns = [videoFn, designFn, feedFn, () => true]
    return fns.map((fn, bi) => {
      let n = 0
      items.forEach(item => {
        if (!fn(item.tp)) return
        const st = states[item.i]?.status ?? item.s
        if (BOARDS[bi].cols.some(c => c.status === st)) n++
      })
      return n
    })
  }, [items, states])

  // ── Column summary chips ──────────────────────────────────
  const colSummary = useMemo(() => {
    return activeCols.map(col => {
      const n = items.filter(item => {
        if (filterClient !== 'all' && item.c !== filterClient) return false
        return (states[item.i]?.status ?? item.s) === col.status
      }).length
      return { ...col, n }
    })
  }, [items, states, activeCols, filterClient])

  // ── Filter functions ──────────────────────────────────────
  const videoFilter  = useCallback((item: ContentItem, s: ItemState) => item.tp === 'Reel'      && VIDEO_COLS.some(c => c.status === s.status), [])
  const designFilter = useCallback((item: ContentItem, s: ItemState) => (item.tp === 'Post' || item.tp === 'Story' || item.tp === 'Carrossel') && DESIGN_COLS.some(c => c.status === s.status), [])
  const feedFilter   = useCallback((item: ContentItem, s: ItemState) => item.tp === 'Feed'       && FEED_COLS.some(c => c.status === s.status), [])
  const socialFilter = useCallback((_: ContentItem,    s: ItemState) => SOCIAL_COLS.some(c => c.status === s.status), [])
  const filterFns = [videoFilter, designFilter, feedFilter, socialFilter]

  const canEdit = !!(onEdit || onUpdateState)

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Sub-tabs (pills destacadas) ──────────────────── */}
      <Box sx={{
        px: 2, pt: 1.2, pb: 0, borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: 0.5,
      }}>
        <Typography sx={{ fontWeight: 900, fontSize: '0.82rem', color: 'primary.main', mb: 1.2, mr: 1.5 }}>
          Produções
        </Typography>

        {BOARDS.map((board, i) => {
          const active = subTab === i
          return (
            <Box
              key={board.label}
              onClick={() => setSubTab(i)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.7,
                px: 1.5, py: 0.9, cursor: 'pointer',
                borderRadius: '8px 8px 0 0',
                bgcolor: active ? `${board.color}14` : 'transparent',
                borderBottom: active ? `2.5px solid ${board.color}` : '2.5px solid transparent',
                borderTop: active ? `1px solid ${board.color}30` : '1px solid transparent',
                borderLeft: active ? `1px solid ${board.color}20` : '1px solid transparent',
                borderRight: active ? `1px solid ${board.color}20` : '1px solid transparent',
                transition: 'all 0.15s',
                boxShadow: active ? `0 -2px 12px ${board.color}18` : 'none',
                '&:hover': { bgcolor: `${board.color}0e` },
              }}
            >
              <Typography sx={{ fontSize: '0.9rem', lineHeight: 1, filter: active ? 'none' : 'grayscale(0.5)', opacity: active ? 1 : 0.6 }}>
                {board.emoji}
              </Typography>
              <Typography sx={{
                fontSize: '0.72rem', fontWeight: active ? 800 : 600, lineHeight: 1,
                color: active ? board.color : 'rgba(255,255,255,0.38)',
                textShadow: active ? `0 0 14px ${board.color}80` : 'none',
                transition: 'all 0.15s',
              }}>
                {board.label}
              </Typography>
              <Box sx={{
                minWidth: 20, height: 17, px: 0.6, borderRadius: 2,
                bgcolor: active ? `${board.color}28` : 'rgba(255,255,255,0.06)',
                border: active ? `1px solid ${board.color}50` : '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: active ? `0 0 8px ${board.color}50` : 'none',
                transition: 'all 0.15s',
              }}>
                <Typography sx={{ fontSize: '0.56rem', fontWeight: 900, color: active ? board.color : 'rgba(255,255,255,0.28)', lineHeight: 1 }}>
                  {counts[i]}
                </Typography>
              </Box>
            </Box>
          )
        })}

        <Box sx={{ flex: 1 }} />
      </Box>

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <Box sx={{
        px: 2, py: 0.9, display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <FilterListIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          <TextField
            select size="small" value={filterClient} onChange={e => setFilterClient(e.target.value)}
            sx={{
              minWidth: 150,
              '& .MuiInputBase-root': { fontSize: '0.65rem', height: 26, bgcolor: 'rgba(255,255,255,0.04)' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <MenuItem value="all" sx={{ fontSize: '0.65rem' }}>Todos os clientes</MenuItem>
            {clientOptions.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.65rem' }}>{c}</MenuItem>)}
          </TextField>
        </Box>

        <Tooltip title={sortByDate ? 'Automático: atrasados → hoje → futuro.' : 'Modo livre — sem ordenação automática.'}>
          <Button size="small" onClick={() => setSortByDate(v => !v)}
            sx={{
              fontSize: '0.62rem', borderRadius: 2, px: 1.2, py: 0.3,
              border: sortByDate ? '1px solid rgba(255,144,57,0.4)' : '1px solid rgba(192,132,252,0.4)',
              color: sortByDate ? 'primary.main' : '#C084FC',
              bgcolor: sortByDate ? 'rgba(255,144,57,0.08)' : 'rgba(192,132,252,0.08)',
              '&:hover': { bgcolor: sortByDate ? 'rgba(255,144,57,0.15)' : 'rgba(192,132,252,0.15)' },
            }}>
            {sortByDate ? '📅 Por data' : '✋ Livre'}
          </Button>
        </Tooltip>

        {/* Column summary chips */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {colSummary.filter(c => c.n > 0).map(c => (
            <Chip key={c.status}
              label={`${STATUS_CONFIG[c.status].emoji} ${c.n}`}
              size="small"
              sx={{ height: 20, fontSize: '0.6rem', bgcolor: `${c.color}18`, color: c.color, border: `1px solid ${c.color}30` }}
            />
          ))}
        </Box>

        <Box sx={{ flex: 1 }} />

        <Button
          size="small"
          onClick={() => { setBulkMode(v => !v); setBulkSelected(new Set()) }}
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
      </Box>

      {/* ── Bulk action bar ───────────────────────────────────── */}
      {bulkMode && bulkSelected.size > 0 && (
        <Box sx={{
          px: 2, py: 0.9, display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap',
          borderBottom: '1px solid rgba(59,142,255,0.2)', bgcolor: 'rgba(59,142,255,0.06)',
          animation: 'slideDown 0.18s ease both',
          '@keyframes slideDown': { '0%': { opacity: 0, transform: 'translateY(-6px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
          flexShrink: 0,
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
              minWidth: 170,
              '& .MuiInputBase-root': { fontSize: '0.65rem', height: 26, bgcolor: 'rgba(255,255,255,0.04)' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(59,142,255,0.3)' },
            }}
          >
            {activeCols.map(col => (
              <MenuItem key={col.status} value={col.status} sx={{ fontSize: '0.65rem' }}>
                {STATUS_CONFIG[col.status].emoji} {STATUS_CONFIG[col.status].label}
              </MenuItem>
            ))}
          </TextField>
          <Button size="small" variant="contained" onClick={applyBulkStatus}
            sx={{ fontSize: '0.65rem', py: 0.3, background: 'linear-gradient(135deg,#3B8EFF,#2563EB)', color: '#fff', fontWeight: 700 }}>
            Mover
          </Button>
          {onDelete && (
            <Button size="small" color="error" startIcon={<DeleteOutlineIcon sx={{ fontSize: 13 }} />}
              onClick={() => setBulkDeleteConfirm(true)}
              sx={{ fontSize: '0.65rem', py: 0.3, border: '1px solid rgba(255,59,48,0.4)', '&:hover': { bgcolor: 'rgba(255,59,48,0.1)' } }}>
              Apagar ({bulkSelected.size})
            </Button>
          )}
          <Button size="small" onClick={() => { setBulkMode(false); setBulkSelected(new Set()) }}
            sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>
            Cancelar
          </Button>
        </Box>
      )}

      {/* ── Board ─────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: 'hidden', p: 1.5, pt: 1.2 }}>
        <Box sx={{ height: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
          {BOARDS.map((board, i) => (
            subTab === i ? (
              <MiniKanban
                key={board.key}
                items={items} states={states}
                onStatusChange={onStatusChange}
                onEdit={canEdit ? handleOpenEdit : undefined}
                columns={board.cols}
                filterFn={filterFns[i]}
                filterClient={filterClient}
                sortByDate={sortByDate}
                bulkMode={bulkMode}
                bulkSelected={bulkSelected}
                onBulkToggle={toggleBulk}
                boardKey={board.key}
              />
            ) : null
          ))}
        </Box>
      </Box>

      {/* ── Edit dialog ──────────────────────────────────────── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 } } }}>
        <DialogTitle sx={{ pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon sx={{ color: 'primary.main', fontSize: 18 }} />
          <Box sx={{ flex: 1 }}>
            <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>Editar card</Typography>
            {editId && (() => {
              const item = items.find(i => i.i === editId)
              return item ? (
                <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{item.c}</Typography>
              ) : null
            })()}
          </Box>
          <IconButton size="small" onClick={() => setEditOpen(false)} sx={{ color: 'text.disabled' }}>
            <DeleteOutlineIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>
          <TextField
            label="Título / nome do conteúdo" size="small" fullWidth autoFocus
            value={editTitle} onChange={e => setEditTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
          />
          <TextField
            label="Data de publicação" type="date" size="small" fullWidth
            value={editDate} onChange={e => setEditDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Box>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 0.7, display: 'block' }}>
              Tipo de conteúdo
            </Typography>
            <ToggleButtonGroup exclusive value={editType} onChange={(_, v) => v && setEditType(v)} size="small" fullWidth>
              {ALL_TYPES.map(t => (
                <ToggleButton key={t} value={t} sx={{ fontSize: '0.6rem', fontWeight: 700, py: 0.6, gap: 0.4 }}>
                  <Typography sx={{ fontSize: '0.75rem', lineHeight: 1 }}>{TYPE_EMOJI[t]}</Typography>
                  {t}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button size="small" onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button
            size="small" variant="contained" startIcon={<SaveIcon sx={{ fontSize: 14 }} />}
            disabled={!editTitle.trim()} onClick={handleSaveEdit}
            sx={{ fontWeight: 700 }}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Bulk delete confirm ──────────────────────────────── */}
      <Dialog open={bulkDeleteConfirm} onClose={() => setBulkDeleteConfirm(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,59,48,0.25)' } } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteOutlineIcon sx={{ color: 'error.main', fontSize: 18 }} />
            <Typography fontWeight={800} color="error.main" sx={{ fontSize: '0.95rem' }}>
              Apagar {bulkSelected.size} card{bulkSelected.size !== 1 ? 's' : ''}?
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', lineHeight: 1.6 }}>
            Ação permanente. Os {bulkSelected.size} cards selecionados serão removidos.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button size="small" onClick={() => setBulkDeleteConfirm(false)}>Cancelar</Button>
          <Button size="small" variant="contained" color="error"
            startIcon={<DeleteOutlineIcon sx={{ fontSize: 14 }} />}
            onClick={applyBulkDelete} sx={{ fontWeight: 700 }}>
            Apagar tudo
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
