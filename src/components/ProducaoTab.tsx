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
  ToggleButtonGroup, ToggleButton, IconButton, Drawer,
} from '@mui/material'
import ContentCard from './ContentCard'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import FilterListIcon from '@mui/icons-material/FilterList'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
import AddIcon from '@mui/icons-material/Add'
import SendIcon from '@mui/icons-material/Send'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import type { Client, ContentItem, ContentType, ItemEditPatch, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'
import CursorGlow from './CursorGlow'

// ── Column definitions ────────────────────────────────────

interface ColDef { status: Status; label: string; color: string }

const VIDEO_COLS: ColDef[] = [
  { status: 0, label: 'A fazer',        color: '#71717A' },
  { status: 1, label: 'Em produção',    color: '#ff9039' },
  { status: 2, label: 'Aprov. interna', color: '#60A5FA' },
  { status: 6, label: 'Reprovado',      color: '#FF4545' },
]

const DESIGN_COLS: ColDef[] = [
  { status: 0, label: 'A fazer',        color: '#71717A' },
  { status: 1, label: 'Em produção',    color: '#ff9039' },
  { status: 2, label: 'Aprov. interna', color: '#60A5FA' },
  { status: 6, label: 'Reprovado',      color: '#FF4545' },
  { status: 5, label: 'Produzido',      color: '#34D399' },
]

const FEED_COLS: ColDef[] = [
  { status: 0, label: 'A fazer',        color: '#71717A' },
  { status: 1, label: 'Em produção',    color: '#ff9039' },
  { status: 2, label: 'Aprov. interna', color: '#60A5FA' },
  { status: 6, label: 'Reprovado',      color: '#FF4545' },
  { status: 5, label: 'Produzido',      color: '#34D399' },
]

const SOCIAL_COLS: ColDef[] = [
  { status: 2, label: 'Aprov. interna',  color: '#60A5FA' },
  { status: 3, label: 'Aprovado',        color: '#818CF8' },
  { status: 4, label: 'Enviado cliente', color: '#FF9A3D' },
  { status: 6, label: 'Reprovado',       color: '#FF4545' },
  { status: 5, label: 'Aprov. cliente',  color: '#34D399' },
  { status: 7, label: 'Publicado',       color: '#00C47A' },
]

// Reels destacam com DS orange; demais tipos são neutros
const TYPE_COLOR: Record<string, string> = {
  Post: '#888', Reel: '#ff9039', Story: '#888', Carrossel: '#888', Feed: '#888',
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
  if (diff < 0)  return `⚠️ ${Math.abs(diff)}d atraso`
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
  const typeEmoji = TYPE_EMOJI[item.tp] ?? ''

  return (
    <Paper
      elevation={0}
      onClick={bulkMode ? onSelect : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      sx={{
        p: 1.2, borderRadius: 2,
        bgcolor: isDragging ? `${colColor}10` : isSelected ? `${colColor}12` : 'rgba(255,255,255,0.035)',
        border: `1px solid ${isSelected ? colColor + '66' : border}`,
        outline: isSelected ? `2px solid ${colColor}55` : '2px solid transparent',
        opacity: isDragging ? 0.35 : 1,
        cursor: bulkMode ? 'pointer' : 'grab',
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border 0.2s ease, background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
        '&::before': {
          content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          background: `linear-gradient(180deg, ${colColor}, ${colColor}88)`,
          borderRadius: '2px 0 0 2px',
        },
        '&::after': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.20) 50%, rgba(255,255,255,0.12) 70%, transparent)',
          pointerEvents: 'none', zIndex: 1,
        },
        '&:hover': {
          bgcolor: bulkMode ? `${colColor}16` : 'rgba(255,255,255,0.06)',
          transform: isDragging ? undefined : 'translateY(-1px)',
          boxShadow: isDragging ? undefined : `0 4px 12px rgba(0,0,0,0.3), 0 0 0 1px ${colColor}22`,
          border: `1px solid ${isSelected ? colColor + '66' : colColor + '44'}`,
        },
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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.6, pl: 0.3, pr: !bulkMode && onEdit ? 2.5 : 0 }}>
        <Chip label={`${typeEmoji} ${item.tp}`} size="small" sx={{
          height: 14, fontSize: '0.46rem', fontWeight: 700,
          bgcolor: `${tc}1c`, color: tc, border: `1px solid ${tc}3a`, flexShrink: 0,
          letterSpacing: '0.01em',
        }} />
        <Typography sx={{ fontSize: '0.62rem', color: colColor, fontWeight: 900, flex: 1, lineHeight: 1, letterSpacing: '-0.01em' }} noWrap>
          {item.c}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.73rem', fontWeight: 700, color: 'rgba(255,255,255,0.90)', lineHeight: 1.3, pl: 0.3, mb: 0.6 }} noWrap>
        {typeEmoji} {state.title || item.n}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, pl: 0.3 }}>
        <AccessTimeIcon sx={{ fontSize: 8, color: isLate ? '#FF3B30' : 'rgba(255,255,255,0.28)', flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.55rem', color: isLate ? '#FF3B30' : 'rgba(255,255,255,0.35)', fontWeight: isLate ? 800 : 400, lineHeight: 1 }}>
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
  onSendToClient?: (id: number, clientName: string) => void
}

function MiniKanban({
  items, states, onStatusChange, onEdit, columns, filterFn,
  filterClient, sortByDate, bulkMode, bulkSelected, onBulkToggle, boardKey, onSendToClient,
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
    if (newStatus === 4) {
      const it = items.find(i => i.i === itemId)
      if (it) onSendToClient?.(itemId, it.c)
    }
  }, [states, items, onStatusChange, boardKey, onSendToClient])

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

          const doneCount = colItems.filter(i => {
            const s = states[i.i]?.status ?? i.s
            return s === 5 || s === 7
          }).length
          const progressPct = colItems.length > 0 ? Math.round((doneCount / colItems.length) * 100) : 0

          return (
            <Box key={col.status} sx={{ flex: '0 0 210px', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
              {/* Column header */}
              <Box sx={{
                display: 'flex', flexDirection: 'column', gap: 0, mb: 0.8,
                px: 1, pt: 0.8, pb: 0.6, borderRadius: 1.5,
                background: `linear-gradient(180deg, ${col.color}12 0%, ${col.color}06 60%, transparent 100%)`,
                border: `1px solid ${col.color}30`,
                borderTop: `3px solid ${col.color}`,
                flexShrink: 0,
                position: 'relative',
                transition: 'all 0.2s ease',
                '&:hover': { background: `linear-gradient(180deg, ${col.color}1e 0%, ${col.color}0c 60%, transparent 100%)`, transform: 'translateY(-1px)', boxShadow: `0 4px 14px ${col.color}20` },
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: col.color, flexShrink: 0, boxShadow: `0 0 6px ${col.color}88` }} />
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: col.color, flex: 1, lineHeight: 1 }} noWrap>
                    {col.label}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {colItems.length > 0 && (
                      <Typography sx={{ fontSize: '0.5rem', color: `${col.color}99`, fontWeight: 600, lineHeight: 1 }}>
                        {doneCount}/{colItems.length}
                      </Typography>
                    )}
                    <Badge badgeContent={lateCount || undefined} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.45rem', minWidth: 13, height: 13 } }}>
                      <Box sx={{ minWidth: 18, height: 16, px: 0.5, borderRadius: 3, bgcolor: `${col.color}22`, border: `1px solid ${col.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography sx={{ fontSize: '0.56rem', fontWeight: 800, color: col.color, lineHeight: 1 }}>{colItems.length}</Typography>
                      </Box>
                    </Badge>
                  </Box>
                </Box>
                {/* Progress bar */}
                <Box sx={{ mt: 0.7, height: 3, borderRadius: 4, bgcolor: `${col.color}22`, overflow: 'hidden' }}>
                  <Box sx={{
                    height: '100%', borderRadius: 4,
                    width: `${progressPct}%`,
                    background: `linear-gradient(90deg, ${col.color}99, ${col.color})`,
                    transition: 'width 0.4s ease',
                    minWidth: progressPct > 0 ? 6 : 0,
                  }} />
                </Box>
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
                    <Box sx={{ py: 3, textAlign: 'center', opacity: 0.4 }}>
                      <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>✨</Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                        Vazio
                      </Typography>
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
  onAddItem?: (clientName: string, title: string, type: ContentType, date: Date, status: Status) => void
  onDuplicate?: (id: number) => void
  allClients?: Client[]
  onSendToClient?: (itemId: number, clientName: string, isTraffic?: boolean) => void
  clientColors?: Record<string, string>
  clientHashtags?: Record<string, string[]>
  captionTemplates?: Record<string, string[]>
  onSaveHashtags?: (clientName: string, tags: string[]) => void
  onSaveTemplates?: (clientName: string, templates: string[]) => void
  currentUser?: string
}

// ── Main ─────────────────────────────────────────────────

// Tipo padrão sugerido por board ao criar card
const BOARD_DEFAULT_TYPE: ContentType[] = ['Reel', 'Post', 'Feed', 'Post']
// Status padrão sugerido por board
const BOARD_DEFAULT_STATUS: Status[] = [0, 0, 0, 2]

export default function ProducaoTab({ items, states, onStatusChange, onDelete, onEdit, onUpdateState, onAddItem, onDuplicate, allClients, onSendToClient, clientColors, clientHashtags, captionTemplates, onSaveHashtags, onSaveTemplates, currentUser }: Props) {
  const [subTab, setSubTab]         = useState(0)
  const [filterClient, setFilterClient] = useState('all')
  const [sortByDate, setSortByDate] = useState(true)
  const [bulkMode, setBulkMode]     = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<Status>(1)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  // ── Send to client confirm dialog ────────────────────────
  const [sendConfirmItem, setSendConfirmItem] = useState<{ id: number; clientName: string } | null>(null)
  const [sendIsTraffic, setSendIsTraffic]     = useState(false)

  function handleConfirmSendToClient() {
    if (!sendConfirmItem) return
    if (sendIsTraffic) onUpdateState?.(sendConfirmItem.id, { isTraffic: true })
    onSendToClient?.(sendConfirmItem.id, sendConfirmItem.clientName, sendIsTraffic)
    setSendConfirmItem(null); setSendIsTraffic(false)
  }

  // ── Add dialog ────────────────────────────────────────────
  const [addOpen, setAddOpen]     = useState(false)
  const [addClient, setAddClient] = useState('')
  const [addTitle, setAddTitle]   = useState('')
  const [addType, setAddType]     = useState<ContentType>('Post')
  const [addDate, setAddDate]     = useState(() => new Date().toISOString().slice(0, 10))
  const [addStatus, setAddStatus] = useState<Status>(0)

  const handleOpenAdd = () => {
    setAddClient(filterClient !== 'all' ? filterClient : '')
    setAddType(BOARD_DEFAULT_TYPE[subTab])
    setAddStatus(BOARD_DEFAULT_STATUS[subTab])
    setAddDate(new Date().toISOString().slice(0, 10))
    setAddTitle('')
    setAddOpen(true)
  }

  const handleAddSubmit = () => {
    if (!addClient || !addTitle.trim()) return
    onAddItem?.(addClient, addTitle.trim(), addType, new Date(addDate + 'T12:00:00'), addStatus)
    setAddOpen(false)
  }

  // ── Card drawer (painel completo de edição) ──────────────
  const [drawerCardId, setDrawerCardId] = useState<number | null>(null)
  const drawerItem  = drawerCardId !== null ? items.find(i => i.i === drawerCardId) ?? null : null
  const drawerState = drawerCardId !== null
    ? (states[drawerCardId] ?? { status: drawerItem?.s ?? 0, title: '', link: '', caption: '', notes: '' })
    : null

  const handleOpenEdit = useCallback((id: number) => {
    setDrawerCardId(id)
  }, [])

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
                display: 'flex', alignItems: 'center', gap: 0.8,
                px: 1.6, height: 36, cursor: 'pointer',
                borderRadius: '10px 10px 0 0',
                bgcolor: active ? `${board.color}18` : 'transparent',
                borderBottom: active ? `2.5px solid ${board.color}` : '2.5px solid transparent',
                borderTop: active ? `1px solid ${board.color}35` : '1px solid transparent',
                borderLeft: active ? `1px solid ${board.color}22` : '1px solid transparent',
                borderRight: active ? `1px solid ${board.color}22` : '1px solid transparent',
                transition: 'all 0.2s ease',
                boxShadow: active ? `0 0 20px ${board.color}40, 0 -2px 14px ${board.color}18` : 'none',
                position: 'relative',
                '&:hover': {
                  bgcolor: active ? `${board.color}18` : `${board.color}0d`,
                  boxShadow: active ? `0 0 20px ${board.color}40, 0 -2px 14px ${board.color}18` : `0 0 10px ${board.color}18`,
                },
                '&::after': active ? {
                  content: '""', position: 'absolute', top: 0, left: '15%', right: '15%', height: '1px',
                  background: `linear-gradient(90deg, transparent, ${board.color}55 20%, ${board.color}cc 50%, ${board.color}55 80%, transparent)`,
                  pointerEvents: 'none', zIndex: 1,
                } : {},
              }}
            >
              <Typography sx={{
                fontSize: '0.95rem', lineHeight: 1,
                filter: active ? 'none' : 'grayscale(0.6)',
                opacity: active ? 1 : 0.55,
                transition: 'all 0.2s ease',
              }}>
                {board.emoji}
              </Typography>
              <Typography sx={{
                fontSize: '0.72rem', fontWeight: 800, lineHeight: 1,
                color: active ? board.color : 'rgba(255,255,255,0.25)',
                transition: 'color 0.2s ease',
                letterSpacing: '-0.01em',
              }}>
                {board.label}
              </Typography>
              <Box sx={{
                minWidth: 22, height: 18, px: 0.7, borderRadius: '6px',
                bgcolor: active ? `${board.color}22` : 'rgba(255,255,255,0.05)',
                border: active ? `1px solid ${board.color}55` : '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease',
                boxShadow: active ? `0 0 8px ${board.color}30` : 'none',
              }}>
                <Typography sx={{
                  fontSize: '0.56rem', fontWeight: 900, lineHeight: 1,
                  color: active ? board.color : 'rgba(255,255,255,0.22)',
                  transition: 'color 0.2s ease',
                }}>
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
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: sortByDate ? 'rgba(255,144,57,0.16)' : 'rgba(192,132,252,0.16)',
                transform: 'translateY(-1px)',
                boxShadow: sortByDate ? '0 4px 12px rgba(255,144,57,0.18)' : '0 4px 12px rgba(192,132,252,0.18)',
              },
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
              sx={{
                height: 20, fontSize: '0.6rem',
                bgcolor: `${c.color}18`, color: c.color, border: `1px solid ${c.color}33`,
                transition: 'all 0.2s ease',
                '&:hover': { bgcolor: `${c.color}28`, transform: 'translateY(-1px)', boxShadow: `0 3px 8px ${c.color}22` },
              }}
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

        {onAddItem && (
          <Button
            size="small"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            onClick={handleOpenAdd}
            sx={{
              fontSize: '0.65rem', borderRadius: 2, px: 1.4, py: 0.3, fontWeight: 700,
              border: `1px solid ${BOARDS[subTab].color}50`,
              color: BOARDS[subTab].color,
              bgcolor: `${BOARDS[subTab].color}0e`,
              '&:hover': { bgcolor: `${BOARDS[subTab].color}18` },
            }}
          >
            Novo {BOARDS[subTab].label}
          </Button>
        )}
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
      <Box sx={{ flex: 1, overflow: 'hidden', p: 1.5, pt: 1.2, position: 'relative' }}>
        <CursorGlow color="rgba(255,144,57,0.05)" size={380} />
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
                onSendToClient={onSendToClient ? (id, cn) => { setSendIsTraffic(false); setSendConfirmItem({ id, clientName: cn }) } : undefined}
              />
            ) : null
          ))}
        </Box>
      </Box>

      {/* ── Add dialog ──────────────────────────────────────── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: `1px solid ${BOARDS[subTab].color}30`, borderRadius: 3 } } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{BOARDS[subTab].emoji}</Box>
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>
                Novo card — {BOARDS[subTab].label}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                Adicionar à produção de {BOARDS[subTab].label.toLowerCase()}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>

          <TextField
            label="Cliente" size="small" fullWidth select autoFocus
            value={addClient} onChange={e => setAddClient(e.target.value)}
          >
            {clientOptions.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.72rem' }}>{c}</MenuItem>)}
          </TextField>

          <TextField
            label="Título / descrição do conteúdo" size="small" fullWidth
            value={addTitle} onChange={e => setAddTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddSubmit()}
          />

          <TextField
            label="Data de publicação" type="date" size="small" fullWidth
            value={addDate} onChange={e => setAddDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <Box>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 0.7, display: 'block' }}>
              Tipo de conteúdo
            </Typography>
            <ToggleButtonGroup exclusive value={addType} onChange={(_, v) => v && setAddType(v)} size="small" fullWidth>
              {ALL_TYPES.map(t => (
                <ToggleButton key={t} value={t} sx={{
                  fontSize: '0.6rem', fontWeight: 700, py: 0.7, gap: 0.3,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: `${TYPE_COLOR[t]}18`,
                    color: TYPE_COLOR[t],
                    transform: 'translateY(-1px)',
                  },
                  '&.Mui-selected': {
                    color: TYPE_COLOR[t],
                    bgcolor: `${TYPE_COLOR[t]}22`,
                    borderColor: `${TYPE_COLOR[t]}55`,
                    boxShadow: `inset 0 0 0 1px ${TYPE_COLOR[t]}44, 0 0 10px ${TYPE_COLOR[t]}22`,
                  },
                  '&.Mui-selected:hover': {
                    bgcolor: `${TYPE_COLOR[t]}2e`,
                  },
                }}>
                  <Typography sx={{ fontSize: '0.8rem', lineHeight: 1 }}>{TYPE_EMOJI[t]}</Typography>
                  {t}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 0.7, display: 'block' }}>
              Status inicial
            </Typography>
            <TextField
              select size="small" fullWidth value={addStatus}
              onChange={e => setAddStatus(Number(e.target.value) as Status)}
              sx={{ '& .MuiInputBase-root': { fontSize: '0.72rem' } }}
            >
              {BOARDS[subTab].cols.map(col => (
                <MenuItem key={col.status} value={col.status} sx={{ fontSize: '0.72rem', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: col.color, flexShrink: 0 }} />
                    {col.label}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button size="small" onClick={() => setAddOpen(false)}>Cancelar</Button>
          <Button
            size="small" variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            disabled={!addClient || !addTitle.trim()}
            onClick={handleAddSubmit}
            sx={{
              fontWeight: 700, px: 2,
              background: `linear-gradient(135deg, ${BOARDS[subTab].color}, ${BOARDS[subTab].color}cc)`,
              color: '#000', '&:hover': { filter: 'brightness(1.1)' },
            }}
          >
            Criar card
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Drawer: painel completo de edição ───────────────── */}
      <Drawer
        anchor="right"
        open={drawerCardId !== null}
        onClose={() => setDrawerCardId(null)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100vw', sm: 420, md: 460, lg: 500, xl: 560 },
              background: 'rgba(11,11,11,0.98)',
              backdropFilter: 'blur(32px)',
              borderLeft: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', flexDirection: 'column',
            },
          },
        }}
      >
        {/* Header do drawer */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.2,
          px: 2, py: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          {drawerItem && (
            <>
              <Box sx={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                bgcolor: clientColors?.[drawerItem.c] ?? 'primary.main',
              }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                  {drawerItem.c}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }} noWrap>
                  {states[drawerItem.i]?.title || drawerItem.n}
                </Typography>
              </Box>
            </>
          )}
          <IconButton
            size="small"
            onClick={() => setDrawerCardId(null)}
            sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#fff' }, flexShrink: 0 }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        {/* ContentCard completo */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,144,57,0.3)', borderRadius: 2 },
        }}>
          {drawerItem && drawerState && (
            <ContentCard
              item={drawerItem}
              state={drawerState}
              now={new Date()}
              onStatusChange={onStatusChange}
              onUpdate={onUpdateState ?? (() => {})}
              onDelete={id => { onDelete?.(id); setDrawerCardId(null) }}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              clientColor={clientColors?.[drawerItem.c]}
              clientHashtags={clientHashtags?.[drawerItem.c]}
              onSaveHashtags={onSaveHashtags ? tags => onSaveHashtags(drawerItem.c, tags) : undefined}
              captionTemplates={captionTemplates?.[drawerItem.c]}
              onSaveTemplates={onSaveTemplates}
              currentUser={currentUser}
            />
          )}
        </Box>
      </Drawer>

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

      {/* ── Send-to-client confirm ───────────────────────────── */}
      <Dialog open={!!sendConfirmItem} onClose={() => setSendConfirmItem(null)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,154,61,0.25)' } } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SendIcon sx={{ color: '#FF9A3D', fontSize: 18 }} />
            <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>Enviar ao cliente</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {sendConfirmItem && (() => {
            const item  = items.find(i => i.i === sendConfirmItem.id)
            const title = states[sendConfirmItem.id]?.title || item?.n || 'Este conteúdo'
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,154,61,0.06)', border: '1px solid rgba(255,154,61,0.2)' }}>
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', mb: 0.3 }}>Conteúdo</Typography>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>{title}</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#FF9A3D', mt: 0.3 }}>{sendConfirmItem.clientName}</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                  📤 Isso vai gerar o link do portal do cliente e registrar a data de envio.
                </Typography>
                <Box onClick={() => setSendIsTraffic(v => !v)} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
                  p: 1.5, borderRadius: 2,
                  bgcolor: sendIsTraffic ? 'rgba(255,215,0,0.07)' : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${sendIsTraffic ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: 'rgba(255,215,0,0.3)' },
                }}>
                  <Box sx={{ width: 36, height: 20, borderRadius: 10, flexShrink: 0, bgcolor: sendIsTraffic ? '#FFD700' : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'all 0.2s' }}>
                    <Box sx={{ position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%', bgcolor: '#fff', transition: 'left 0.2s', left: sendIsTraffic ? 19 : 3, boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: sendIsTraffic ? '#FFD700' : 'rgba(255,255,255,0.6)' }}>
                      ⚡ Usar em tráfego pago
                    </Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
                      {sendIsTraffic ? 'Cliente será notificado que vai para anúncios' : 'Ativar se o criativo será impulsionado'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button size="small" onClick={() => setSendConfirmItem(null)}>Cancelar</Button>
          <Button size="small" variant="contained" onClick={handleConfirmSendToClient}
            startIcon={<WhatsAppIcon sx={{ fontSize: 14 }} />}
            sx={{ background: 'linear-gradient(135deg, #25D366, #128C7E)', color: '#fff', fontWeight: 800, '&:hover': { filter: 'brightness(1.1)' } }}>
            Enviar pelo WhatsApp
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
