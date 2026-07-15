import { useMemo, useState, useCallback, useEffect, lazy, Suspense } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragEndEvent, type DragStartEvent,
  closestCenter, pointerWithin,
  type CollisionDetection,
} from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Box, Typography, Paper, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, ToggleButtonGroup,
  ToggleButton, Tooltip, Badge, Menu, Switch, Divider, IconButton,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import SendIcon from '@mui/icons-material/Send'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import FilterListIcon from '@mui/icons-material/FilterList'
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt'
import SettingsIcon from '@mui/icons-material/Settings'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import type { Client, ContentItem, ContentType, ItemEditPatch, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'
import { NAME_MAP } from '../lib/users'
import WhatsAppLoteDialog, { buildLoteClients } from './WhatsAppLoteDialog'
const ResolveWithAIModal = lazy(() => import('./ResolveWithAIModal'))

// All 8 status columns
const COLUMNS: { status: Status }[] = [
  { status: 0 }, { status: 1 }, { status: 2 }, { status: 3 },
  { status: 4 }, { status: 5 }, { status: 6 }, { status: 7 },
]

// Separação por área de trabalho
const DESIGN_TYPES: string[] = ['Post', 'Feed', 'Carrossel', 'Story']
const VIDEO_TYPES:  string[] = ['Reel']

// All columns always visible

// ── KanbanCard ────────────────────────────────────────────

function KanbanCard({
  item, state, isDragging, onSendToClient, onDeleteCard, onEditCard, onAssignResponsible, clientColor, onAI,
}: {
  item: ContentItem
  state: ItemState
  isDragging?: boolean
  onSendToClient?: (id: number, clientName: string) => void
  onDeleteCard?: (id: number) => void
  onEditCard?: (id: number) => void
  onAssignResponsible?: (id: number, responsible: string | null) => void
  clientColor?: string
  onAI?: (item: ContentItem) => void
}) {
  const [hover, setHover] = useState(false)
  const [assignAnchor, setAssignAnchor] = useState<HTMLElement | null>(null)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isLate = item.dt < today && state.status !== 7 && state.status !== 5
  const cfg = STATUS_CONFIG[state.status] ?? STATUS_CONFIG[0]
  const daysDiff = Math.round((item.dt.getTime() - today.getTime()) / 86400000)
  const hasComment = (state.comments?.length ?? 0) > 0 || Boolean(state.rejectionText)

  // SLA 48h: sent to client but no response in 48+ hours
  const sentHoursAgo = state.status === 4 && state.sentToClientAt
    ? (Date.now() - state.sentToClientAt) / 3_600_000 : 0
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
        border: `1px solid ${isSlaBreached ? 'rgba(255,59,48,0.55)' : isLate ? '#FF3B3044' : daysDiff === 0 ? 'rgba(59,130,246,0.45)' : cfg.color + '22'}`,
        bgcolor: isDragging ? `${cfg.color}10` : 'rgba(255,255,255,0.025)',
        cursor: 'grab',
        transition: 'border 0.2s, background 0.2s',
        '&:hover': { border: `1px solid ${cfg.color}44`, bgcolor: 'rgba(255,255,255,0.04)' },
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          bgcolor: clientColor || cfg.dot, borderRadius: '2px 0 0 2px',
        },
      }}
    >
      {hover && !isDragging && (onEditCard || onDeleteCard || onAI) && (
        <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.3, zIndex: 10 }}>
          {onAI && (
            <Box
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onAI(item) }}
              sx={{
                width: 20, height: 20, borderRadius: 1, cursor: 'pointer',
                bgcolor: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(59,130,246,0.35)',
                '&:hover': { bgcolor: 'rgba(59,130,246,0.3)' },
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 11, color: '#3B82F6' }} />
            </Box>
          )}
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

      {/* Top row: type emoji + client + traffic dot */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.55, pl: 0.5 }}>
        <Typography sx={{ fontSize: '0.6rem', lineHeight: 1, opacity: 0.45, flexShrink: 0 }}>
          {({ Post: '🖼️', Reel: '🎬', Story: '⭐', Carrossel: '🗂️', Feed: '📸' } as Record<string, string>)[item.tp] ?? ''}
        </Typography>
        <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.46)', fontWeight: 600, flex: 1, lineHeight: 1 }} noWrap>
          {item.c}
        </Typography>
        {state.isTraffic && (
          <Tooltip title="Criativo para tráfego pago">
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#F59E0B', flexShrink: 0, boxShadow: '0 0 4px rgba(245,158,11,0.6)' }} />
          </Tooltip>
        )}
        {state.priority === 'alta' && (
          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#FF3B30', flexShrink: 0 }} />
        )}
      </Box>

      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.88)', lineHeight: 1.35, mb: 0.75, pl: 0.5,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {state.title || item.n}
      </Typography>

      {/* Bottom row: date + delivery + responsible */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 0.5 }}>
        <Box sx={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
          bgcolor: isLate ? '#FF3B30' : daysDiff === 0 ? '#F59E0B' : 'rgba(255,255,255,0.20)',
        }} />
        <Typography sx={{ fontSize: '0.58rem', flex: 1, lineHeight: 1,
          color: isLate ? '#FF3B30' : daysDiff === 0 ? '#F59E0B' : 'rgba(255,255,255,0.35)',
          fontWeight: (isLate || daysDiff === 0) ? 700 : 400,
        }}>
          {dateLabel()}{state.deliveryDate ? ` · 📥 ${new Date(state.deliveryDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : ''}
        </Typography>
        {hasComment && (
          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#3B82F6', flexShrink: 0 }} />
        )}

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

        <Menu
          anchorEl={assignAnchor}
          open={Boolean(assignAnchor)}
          onClose={() => setAssignAnchor(null)}
          slotProps={{ paper: { sx: { background: 'rgba(18,18,18,0.98)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, minWidth: 190 } } }}
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
              {state.responsible === key && <Typography sx={{ fontSize: '0.7rem', color: info.color }}>✓</Typography>}
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

        {state.status === 3 && onSendToClient && (
          <Tooltip title="Enviar ao cliente">
            <Box
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onSendToClient(item.i, item.c) }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.3,
                px: 0.7, py: 0.2, borderRadius: 1,
                bgcolor: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)',
                cursor: 'pointer', flexShrink: 0,
                '&:hover': { bgcolor: 'rgba(96,165,250,0.22)' },
              }}
            >
              <SendIcon sx={{ fontSize: 9, color: '#60A5FA' }} />
              <Typography sx={{ fontSize: '0.52rem', color: '#60A5FA', fontWeight: 700, lineHeight: 1 }}>Enviar</Typography>
            </Box>
          </Tooltip>
        )}

        {state.status === 4 && (
          <WhatsAppIcon sx={{ fontSize: 11, color: '#25D366', flexShrink: 0 }} />
        )}
      </Box>

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

// ── DraggableCard — used in sortByDate mode (cross-column only) ──────
function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  return (
    <Box
      ref={setNodeRef} {...listeners} {...attributes}
      style={{
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 999 : undefined,
        position: 'relative',
        opacity: isDragging ? 0.35 : 1,
        willChange: isDragging ? 'transform' : undefined,
        transition: isDragging ? undefined : 'opacity 0.15s',
      }}
    >
      {children}
    </Box>
  )
}

// ── SortableCard — used in Livre mode (within + cross column) ────────
function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <Box
      ref={setNodeRef} {...listeners} {...attributes}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : (transition ?? undefined),
        position: 'relative',
        opacity: isDragging ? 0.35 : 1,
        willChange: isDragging ? 'transform' : undefined,
      }}
    >
      {children}
    </Box>
  )
}

// ── DroppableZone ─────────────────────────────────────────
function DroppableZone({ status, children }: { status: Status; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` })
  const cfg = STATUS_CONFIG[status]
  return (
    <Box
      ref={setNodeRef}
      sx={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: 1, p: 0.5,
        borderRadius: 2, minHeight: 120,
        border: `1px dashed ${isOver ? cfg.color + '88' : 'transparent'}`,
        bgcolor: isOver ? `${cfg.color}12` : 'transparent',
        transition: 'border 0.12s, background-color 0.12s',
        boxShadow: isOver ? `inset 0 0 0 1px ${cfg.color}44` : 'none',
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
  onStatusChange: (id: number, s: Status) => void
  onDelete?: (id: number) => void
  onEdit?: (id: number, patch: ItemEditPatch) => void
  onUpdateState?: (id: number, patch: Partial<ItemState>) => void
  onAddItem?: (clientName: string, title: string, type: ContentType, date: Date, status: Status, responsible?: string, notes?: string, footageLink?: string, roteiroLink?: string, deliveryDate?: number) => void
  allClients?: Client[]
  onSendToClient?: (itemId: number, clientName: string, isTraffic?: boolean) => void
  onBulkSendToClient?: (clientName: string, itemIds: number[]) => void
  clientColors?: Record<string, string>
  clientPhones?: Record<string, string>
}

// ── Main KanbanTab ────────────────────────────────────────
export default function KanbanTab({ items, states, onStatusChange, onDelete, onEdit, onUpdateState, onAddItem, allClients, onSendToClient, onBulkSendToClient, clientColors, clientPhones = {} }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)

  // ── Add dialog ────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false)
  const [addClient, setAddClient] = useState('')
  const [addTitle, setAddTitle] = useState('')
  const [addType, setAddType] = useState<ContentType>('Post')
  const [addStatus, setAddStatus] = useState<Status>(0)
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [addDeliveryDate, setAddDeliveryDate] = useState('')
  const [addMaterialLink, setAddMaterialLink] = useState('')
  const [addRoteiroLink, setAddRoteiroLink] = useState('')

  // ── Edit dialog ───────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editType, setEditType] = useState<ContentType>('Post')
  const [editDate, setEditDate] = useState('')

  // ── Delete confirm ────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<number | null>(null)

  // ── Client filter ─────────────────────────────────────────
  const [filterClient, setFilterClient] = useState('all')

  // ── Sort mode: true = by date (auto), false = livre (manual) ────────
  const [sortByDate, setSortByDate] = useState(true)

  // ── Manual column order (only used in Livre mode) ─────────
  const [colOrders, setColOrders] = useState<Record<number, number[]>>(() => {
    try { return JSON.parse(localStorage.getItem('sm_kanban_order') ?? '{}') } catch { return {} }
  })

  // Persist manual order to localStorage
  useEffect(() => {
    if (Object.keys(colOrders).length > 0) localStorage.setItem('sm_kanban_order', JSON.stringify(colOrders))
  }, [colOrders])

  // ── Bulk select ───────────────────────────────────────────
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<Status>(1)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  // ── WhatsApp em lote ──────────────────────────────────────
  const [whatsappLoteOpen, setWhatsappLoteOpen] = useState(false)

  // ── AI modal ──────────────────────────────────────────────
  const [aiItem, setAiItem] = useState<ContentItem | null>(null)

  // ── Column settings ───────────────────────────────────────
  const [colSettingsOpen, setColSettingsOpen] = useState(false)
  const [colLabels, setColLabels] = useState<Record<number, string>>(() => {
    try { return JSON.parse(localStorage.getItem('sm_kanban_labels') ?? '{}') } catch { return {} }
  })
  const [colHidden, setColHidden] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('sm_kanban_hidden') ?? '[]') } catch { return [] }
  })
  // Draft state while dialog is open
  const [draftLabels, setDraftLabels] = useState<Record<number, string>>({})
  const [draftHidden, setDraftHidden] = useState<number[]>([])

  const openColSettings = () => {
    setDraftLabels({ ...colLabels })
    setDraftHidden([...colHidden])
    setColSettingsOpen(true)
  }

  const saveColSettings = () => {
    // Clean up empty labels
    const cleanLabels: Record<number, string> = {}
    Object.entries(draftLabels).forEach(([k, v]) => { if (v.trim()) cleanLabels[Number(k)] = v.trim() })
    setColLabels(cleanLabels)
    setColHidden(draftHidden)
    localStorage.setItem('sm_kanban_labels', JSON.stringify(cleanLabels))
    localStorage.setItem('sm_kanban_hidden', JSON.stringify(draftHidden))
    setColSettingsOpen(false)
  }

  const resetColSettings = () => {
    setDraftLabels({})
    setDraftHidden([])
  }

  function toggleBulkSelect(id: number) {
    setBulkSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function applyBulkStatus() {
    bulkSelected.forEach(id => onStatusChange(id, bulkStatus))
    setBulkSelected(new Set()); setBulkMode(false)
  }

  function applyBulkDelete() {
    bulkSelected.forEach(id => onDelete?.(id))
    setBulkSelected(new Set()); setBulkMode(false); setBulkDeleteConfirm(false)
  }

  function exitBulkMode() { setBulkMode(false); setBulkSelected(new Set()) }

  // ── View mode — persiste no localStorage por dispositivo ─────
  const [viewMode, setViewMode] = useState<'all' | 'design' | 'video'>(() => {
    const saved = localStorage.getItem('sm_kanban_viewmode')
    return (saved === 'design' || saved === 'video' || saved === 'all') ? saved : 'all'
  })

  const setViewModePersist = (mode: 'all' | 'design' | 'video') => {
    setViewMode(mode)
    localStorage.setItem('sm_kanban_viewmode', mode)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } }),
  )

  // Prioriza zona de coluna quando o ponteiro está sobre ela (fix drop em colunas vazias)
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const hits = pointerWithin(args)
    const colHits = hits.filter(({ id }) => String(id).startsWith('col-'))
    if (colHits.length > 0) return colHits
    return closestCenter(args)
  }, [])

  const filteredItems = useMemo(() => {
    let result = filterClient === 'all' ? items : items.filter(i => i.c === filterClient)
    if (viewMode === 'design') result = result.filter(i => DESIGN_TYPES.includes(i.tp))
    if (viewMode === 'video')  result = result.filter(i => VIDEO_TYPES.includes(i.tp))
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
      // Fixed sort: atrasados primeiro (mais atrasado no topo), depois hoje, depois futuro
      const todayMs = new Date().setHours(0, 0, 0, 0)
      const sortFn = (a: ContentItem, b: ContentItem) => {
        const aMs = new Date(a.dt).setHours(0, 0, 0, 0)
        const bMs = new Date(b.dt).setHours(0, 0, 0, 0)
        const aOver = aMs < todayMs
        const bOver = bMs < todayMs
        if (aOver && !bOver) return -1  // atrasado vem antes de hoje/futuro
        if (!aOver && bOver) return 1
        return aMs - bMs                // no mesmo grupo: data crescente
      }
      Object.keys(map).forEach(k => {
        const col = Number(k)
        if (col === 7) {
          // Publicado: mais recentemente publicados no topo (publishedAt desc)
          map[col].sort((a, b) => (states[b.i]?.publishedAt ?? 0) - (states[a.i]?.publishedAt ?? 0))
        } else {
          map[col].sort(sortFn)
        }
      })
    } else {
      // Livre: usa a ordem manual guardada em colOrders
      Object.keys(map).forEach(k => {
        const status = Number(k)
        const order = colOrders[status]
        if (!order || order.length === 0) return
        map[status].sort((a, b) => {
          const ai = order.indexOf(a.i)
          const bi = order.indexOf(b.i)
          return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi)
        })
      })
    }

    return map
  }, [filteredItems, states, sortByDate, colOrders])

  // ── Contagens por área (para os badges do seletor) ─────────
  const areaCounts = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const active = items.filter(i => {
      const st = states[i.i]?.status ?? i.s
      return st !== 7 && st !== 5  // não publicado / não aprovado pelo cliente
    })
    const designItems = active.filter(i => DESIGN_TYPES.includes(i.tp))
    const videoItems  = active.filter(i => VIDEO_TYPES.includes(i.tp))
    const lateDesign  = designItems.filter(i => i.dt < today).length
    const lateVideo   = videoItems.filter(i => i.dt < today).length
    return {
      all:    { total: active.length,        late: lateDesign + lateVideo },
      design: { total: designItems.length,   late: lateDesign },
      video:  { total: videoItems.length,    late: lateVideo },
    }
  }, [items, states])

  // Items status=3 (Aprovado interno) prontos para enviar ao cliente, agrupados por cliente
  const readyToSendByClient = useMemo(() => {
    const map: Record<string, { id: number; title: string }[]> = {}
    items.forEach(item => {
      const st = states[item.i]?.status ?? item.s
      if (st !== 3) return
      if (!map[item.c]) map[item.c] = []
      map[item.c].push({ id: item.i, title: states[item.i]?.title || item.n })
    })
    return map
  }, [items, states])

  const readyToSendTotal = useMemo(
    () => Object.values(readyToSendByClient).reduce((acc, arr) => acc + arr.length, 0),
    [readyToSendByClient],
  )

  const loteClients = useMemo(
    () => buildLoteClients(items, states, allClients ?? [], clientPhones),
    [items, states, allClients, clientPhones],
  )

  const activeItem = useMemo(() => activeId ? items.find(i => String(i.i) === activeId) ?? null : null, [activeId, items])

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  // ── Send-to-client modal ──────────────────────────────────
  const [sendConfirmItem, setSendConfirmItem] = useState<{ id: number; clientName: string } | null>(null)
  const [sendConfirming, setSendConfirming]   = useState(false)
  const [sendIsTraffic, setSendIsTraffic]     = useState(false)

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || String(active.id) === String(over.id)) return

    const draggedId   = Number(active.id)
    const overId      = String(over.id)
    const draggedStatus = (states[draggedId]?.status ?? items.find(i => i.i === draggedId)?.s) as Status

    if (overId.startsWith('col-')) {
      // ── Drop on column zone → change status ──────────────
      const newStatus = Number(overId.replace('col-', '')) as Status
      if (newStatus === draggedStatus) return
      onStatusChange(draggedId, newStatus)
      if (newStatus === 7) onUpdateState?.(draggedId, { publishedAt: Date.now() })

      if (!sortByDate) {
        setColOrders(prev => {
          const next = { ...prev }
          next[draggedStatus] = (next[draggedStatus] ?? (itemsByStatus[draggedStatus] ?? []).map(i => i.i)).filter(id => id !== draggedId)
          next[newStatus] = [...(next[newStatus] ?? (itemsByStatus[newStatus] ?? []).map(i => i.i)).filter(id => id !== draggedId), draggedId]
          return next
        })
      }

      if (newStatus === 4) {
        const it = items.find(i => i.i === draggedId)
        if (it) { setSendIsTraffic(false); setSendConfirmItem({ id: draggedId, clientName: it.c }) }
      }

    } else {
      // ── Drop on a card ────────────────────────────────────
      const targetId     = Number(over.id)
      const targetStatus = (states[targetId]?.status ?? items.find(i => i.i === targetId)?.s) as Status

      if (draggedStatus === targetStatus) {
        // ── Within-column reorder (Livre mode only) ──────────
        if (sortByDate) return

        setColOrders(prev => {
          const next = { ...prev }
          const displayed = (itemsByStatus[draggedStatus] ?? []).map(i => i.i)
          const base = prev[draggedStatus] && prev[draggedStatus].length > 0
            ? [...new Set([...prev[draggedStatus], ...displayed])]
            : displayed
          const fi = base.indexOf(draggedId)
          const ti = base.indexOf(targetId)
          if (fi === -1 || ti === -1) return prev
          next[draggedStatus] = arrayMove(base, fi, ti)
          return next
        })

      } else {
        // ── Cross-column via card hover → change status ───────
        onStatusChange(draggedId, targetStatus)
        if (targetStatus === 7) onUpdateState?.(draggedId, { publishedAt: Date.now() })

        if (!sortByDate) {
          setColOrders(prev => {
            const next = { ...prev }
            next[draggedStatus] = (next[draggedStatus] ?? (itemsByStatus[draggedStatus] ?? []).map(i => i.i)).filter(id => id !== draggedId)
            const dst = (next[targetStatus] ?? (itemsByStatus[targetStatus] ?? []).map(i => i.i)).filter(id => id !== draggedId)
            const tIdx = dst.indexOf(targetId)
            dst.splice(tIdx >= 0 ? tIdx : dst.length, 0, draggedId)
            next[targetStatus] = dst
            return next
          })
        }

        if (targetStatus === 4) {
          const it = items.find(i => i.i === draggedId)
          if (it) { setSendIsTraffic(false); setSendConfirmItem({ id: draggedId, clientName: it.c }) }
        }
      }
    }
  }, [states, items, onStatusChange, sortByDate, itemsByStatus])

  async function handleConfirmSendToClient() {
    if (!sendConfirmItem) return
    setSendConfirming(true)
    if (sendIsTraffic) onUpdateState?.(sendConfirmItem.id, { isTraffic: true })
    onSendToClient?.(sendConfirmItem.id, sendConfirmItem.clientName, sendIsTraffic)
    setSendConfirming(false); setSendConfirmItem(null); setSendIsTraffic(false)
  }

  const clientOptions = useMemo(() => (allClients ?? []).map(c => c.name).sort(), [allClients])

  const handleAddSubmit = () => {
    if (!addClient || !addTitle) return
    const pubDate = addDate ? new Date(addDate + 'T12:00:00') : new Date()
    const delivTs = addDeliveryDate ? new Date(addDeliveryDate + 'T12:00:00').getTime() : undefined
    onAddItem?.(addClient, addTitle, addType, pubDate, addStatus, undefined, undefined, addMaterialLink || undefined, addRoteiroLink || undefined, delivTs)
    setAddOpen(false)
    setAddClient(''); setAddTitle(''); setAddType('Post'); setAddStatus(0)
    setAddDate(new Date().toISOString().slice(0, 10))
    setAddDeliveryDate(''); setAddMaterialLink(''); setAddRoteiroLink('')
  }

  const handleOpenEdit = (id: number) => {
    const item = items.find(i => i.i === id); if (!item) return
    const st = states[id]
    setEditId(id); setEditTitle(st?.title || item.n); setEditType(item.tp)
    setEditDate(item.dt.toISOString().slice(0, 10)); setEditOpen(true)
  }

  const handleEditSubmit = () => {
    if (!editId) return
    const item = items.find(i => i.i === editId); if (!item) return
    const newDate = editDate ? new Date(editDate + 'T12:00:00') : item.dt
    const titleChanged = editTitle !== (states[editId]?.title || item.n)
    const typeChanged  = editType !== item.tp
    const dateChanged  = newDate.toDateString() !== item.dt.toDateString()
    if (titleChanged) onUpdateState?.(editId, { title: editTitle })
    if (typeChanged || dateChanged) onEdit?.(editId, { tp: editType, dt: newDate })
    setEditOpen(false); setEditId(null)
  }

  const visibleCols = COLUMNS.filter(col => !colHidden.includes(col.status))

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Seletor de área — proeminente, salvo por dispositivo ── */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 0, flexShrink: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          {([
            { key: 'all',    label: 'Geral',   emoji: '⚡', subtitle: 'Tudo junto',              color: '#3B82F6', count: areaCounts.all },
            { key: 'design', label: 'Design',  emoji: '🎨', subtitle: 'Post · Feed · Carrossel',  color: '#C084FC', count: areaCounts.design },
            { key: 'video',  label: 'Editor',  emoji: '🎬', subtitle: 'Reels',                    color: '#60A5FA', count: areaCounts.video },
          ] as const).map(m => {
            const active = viewMode === m.key
            return (
              <Box
                key={m.key}
                onClick={() => setViewModePersist(m.key)}
                sx={{
                  p: { xs: 1.2, md: 1.5 }, borderRadius: 2.5, cursor: 'pointer', textAlign: 'center',
                  bgcolor: active ? `${m.color}18` : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${active ? m.color + '60' : 'rgba(255,255,255,0.06)'}`,
                  transition: 'all 0.18s',
                  position: 'relative',
                  '&:hover': { bgcolor: `${m.color}10`, borderColor: `${m.color}40` },
                }}
              >
                {/* Badge de atrasados */}
                {m.count.late > 0 && (
                  <Box sx={{
                    position: 'absolute', top: -5, right: -5,
                    minWidth: 18, height: 18, borderRadius: 9, px: 0.4,
                    bgcolor: '#FF4545', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography sx={{ fontSize: '0.5rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                      {m.count.late}
                    </Typography>
                  </Box>
                )}
                <Typography sx={{ fontSize: { xs: '1.4rem', md: '1.6rem' }, lineHeight: 1, mb: 0.4 }}>{m.emoji}</Typography>
                <Typography sx={{ fontSize: { xs: '0.72rem', md: '0.82rem' }, fontWeight: 800, color: active ? m.color : 'rgba(255,255,255,0.7)', lineHeight: 1.1 }}>
                  {m.label}
                </Typography>
                <Typography sx={{ fontSize: '0.55rem', color: active ? `${m.color}aa` : 'rgba(255,255,255,0.3)', lineHeight: 1.2, mt: 0.3 }}>
                  {m.subtitle}
                </Typography>
                <Box sx={{ mt: 0.8, display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                  <Box sx={{ px: 0.8, py: 0.2, borderRadius: 1, bgcolor: active ? `${m.color}22` : 'rgba(255,255,255,0.05)' }}>
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: active ? m.color : 'rgba(255,255,255,0.35)' }}>
                      {m.count.total} ativos
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* ── Header ── */}
      <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: viewMode === 'all' ? 'primary.main' : viewMode === 'design' ? '#C084FC' : '#60A5FA' }}>
          {viewMode === 'all' ? '⚡ Kanban Geral' : viewMode === 'design' ? '🎨 Kanban Design' : '🎬 Kanban Editor'}
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>· {filteredItems.length} cards</Typography>

        {/* Client filter */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <FilterListIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          <TextField
            select size="small" value={filterClient} onChange={e => setFilterClient(e.target.value)}
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
        <Tooltip title={sortByDate ? 'Modo automático: atrasados → hoje → futuro. Clique para ordenação livre.' : 'Modo livre: arraste para reordenar dentro das colunas. Clique para voltar ao automático.'}>
          <Button
            size="small" onClick={() => setSortByDate(v => !v)}
            sx={{
              fontSize: '0.62rem', borderRadius: 2, px: 1.2, py: 0.3,
              border: sortByDate ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(192,132,252,0.4)',
              color: sortByDate ? 'primary.main' : '#C084FC',
              bgcolor: sortByDate ? 'rgba(59,130,246,0.08)' : 'rgba(192,132,252,0.08)',
              '&:hover': { bgcolor: sortByDate ? 'rgba(59,130,246,0.15)' : 'rgba(192,132,252,0.15)' },
            }}
          >
            {sortByDate ? '📅 Por data' : '✋ Livre'}
          </Button>
        </Tooltip>

        {/* Column summary chips */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', overflowX: 'auto' }}>
          {([6, 0, 4] as Status[]).map(s => {
            const count = itemsByStatus[s]?.length ?? 0
            if (!count) return null
            const cfg = STATUS_CONFIG[s]
            return <Chip key={s} label={`${cfg.emoji} ${count}`} size="small" sx={{ fontSize: '0.6rem', height: 20, bgcolor: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }} />
          })}
        </Box>

        {/* WhatsApp em lote */}
        {readyToSendTotal > 0 && onBulkSendToClient && (
          <Tooltip title={`${readyToSendTotal} item${readyToSendTotal !== 1 ? 's' : ''} aprovados internamente — enviar para clientes via WhatsApp`}>
            <Button
              size="small"
              startIcon={<WhatsAppIcon sx={{ fontSize: 13 }} />}
              onClick={() => setWhatsappLoteOpen(true)}
              sx={{
                fontSize: '0.62rem', borderRadius: 2, px: 1.2, py: 0.3,
                border: '1px solid rgba(0,196,122,0.4)',
                color: '#00C47A',
                bgcolor: 'rgba(0,196,122,0.08)',
                '&:hover': { bgcolor: 'rgba(0,196,122,0.15)' },
              }}
            >
              📤 Enviar em lote ({readyToSendTotal})
            </Button>
          </Tooltip>
        )}

        <Button
          size="small"
          onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
          sx={{
            fontSize: '0.62rem', borderRadius: 2, px: 1.2, py: 0.3,
            border: bulkMode ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.12)',
            color: bulkMode ? '#3B82F6' : 'text.secondary',
            bgcolor: bulkMode ? 'rgba(59,130,246,0.08)' : 'transparent',
            '&:hover': { bgcolor: bulkMode ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)' },
          }}
        >
          {bulkMode ? `✓ ${bulkSelected.size} sel.` : 'Selecionar'}
        </Button>

        <Button size="small" startIcon={<AddIcon sx={{ fontSize: 13 }} />} onClick={() => setAddOpen(true)}
          sx={{ fontSize: '0.65rem', border: '1px solid rgba(59,130,246,0.3)', color: 'primary.main', borderRadius: 2, px: 1.2, py: 0.3, '&:hover': { bgcolor: 'rgba(59,130,246,0.08)' } }}>
          Novo
        </Button>

        <Tooltip title="Configurar colunas — renomear e mostrar/ocultar">
          <IconButton size="small" onClick={openColSettings}
            sx={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', borderRadius: 1.5, p: 0.4, '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' } }}>
            <SettingsIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Bulk action bar ── */}
      {bulkMode && bulkSelected.size > 0 && (
        <Box sx={{
          px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
          borderBottom: '1px solid rgba(59,130,246,0.2)', bgcolor: 'rgba(59,130,246,0.06)',
          animation: 'slideDown 0.2s ease both',
          '@keyframes slideDown': { '0%': { opacity: 0, transform: 'translateY(-8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        }}>
          <Typography sx={{ fontSize: '0.7rem', color: '#3B82F6', fontWeight: 700 }}>
            {bulkSelected.size} card{bulkSelected.size !== 1 ? 's' : ''} selecionado{bulkSelected.size !== 1 ? 's' : ''}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>Mover para:</Typography>
          <TextField
            select size="small" value={bulkStatus} onChange={e => setBulkStatus(Number(e.target.value) as Status)}
            sx={{ minWidth: 160, '& .MuiInputBase-root': { fontSize: '0.65rem', height: 26, bgcolor: 'rgba(255,255,255,0.04)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(59,130,246,0.3)' } }}
          >
            {COLUMNS.map(col => (
              <MenuItem key={col.status} value={col.status} sx={{ fontSize: '0.65rem' }}>
                {STATUS_CONFIG[col.status].emoji} {STATUS_CONFIG[col.status].label}
              </MenuItem>
            ))}
          </TextField>
          <Button size="small" variant="contained" onClick={applyBulkStatus}
            sx={{ fontSize: '0.65rem', py: 0.3, background: '#3B82F6', color: '#fff', fontWeight: 700 }}>
            Mover
          </Button>
          {onDelete && (
            <Button size="small" color="error" startIcon={<DeleteOutlineIcon sx={{ fontSize: 13 }} />}
              onClick={() => setBulkDeleteConfirm(true)}
              sx={{ fontSize: '0.65rem', py: 0.3, border: '1px solid rgba(255,59,48,0.4)', '&:hover': { bgcolor: 'rgba(255,59,48,0.1)' } }}>
              Apagar ({bulkSelected.size})
            </Button>
          )}
          <Button size="small" onClick={exitBulkMode} sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>
            Cancelar
          </Button>
        </Box>
      )}

      {/* ── Board ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Box sx={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: 1.5, p: 1.5, alignItems: 'flex-start' }}>

          {visibleCols.map(col => {
            const cfg      = STATUS_CONFIG[col.status]
            const colItems = itemsByStatus[col.status] ?? []
            const colIds   = colItems.map(i => String(i.i))
            const today    = new Date(); today.setHours(0, 0, 0, 0)
            const lateCount = colItems.filter(i => i.dt < today && col.status !== 7 && col.status !== 5).length

            const cardsJsx = colItems.map(item => {
              const itemState = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
              const isSelected = bulkSelected.has(item.i)

              if (bulkMode) {
                return (
                  <Box key={item.i} onClick={() => toggleBulkSelect(item.i)} sx={{
                    position: 'relative', cursor: 'pointer', mb: 0.5,
                    outline: isSelected ? '2px solid #3B82F6' : '2px solid transparent',
                    borderRadius: 2, transition: 'outline 0.15s',
                    '&:hover': { outline: '2px solid rgba(59,130,246,0.5)' },
                  }}>
                    <Box sx={{
                      position: 'absolute', top: 6, right: 6, zIndex: 10,
                      width: 16, height: 16, borderRadius: 1,
                      bgcolor: isSelected ? '#3B82F6' : 'rgba(255,255,255,0.15)',
                      border: `2px solid ${isSelected ? '#3B82F6' : 'rgba(255,255,255,0.3)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSelected && <Typography sx={{ fontSize: '0.5rem', color: '#fff', lineHeight: 1, fontWeight: 900 }}>✓</Typography>}
                    </Box>
                    <KanbanCard item={item} state={itemState} clientColor={clientColors?.[item.c]} />
                  </Box>
                )
              }

              const card = (
                <KanbanCard
                  item={item} state={itemState}
                  isDragging={activeId === String(item.i)}
                  onSendToClient={onSendToClient}
                  onDeleteCard={onDelete ? (id) => setDeleteId(id) : undefined}
                  onEditCard={onEdit || onUpdateState ? handleOpenEdit : undefined}
                  onAssignResponsible={onUpdateState ? (id, resp) => onUpdateState(id, { responsible: resp ?? undefined }) : undefined}
                  clientColor={clientColors?.[item.c]}
                  onAI={setAiItem}
                />
              )

              return sortByDate ? (
                <DraggableCard key={item.i} id={String(item.i)}>{card}</DraggableCard>
              ) : (
                <SortableCard key={item.i} id={String(item.i)}>{card}</SortableCard>
              )
            })

            const EMPTY_MESSAGES: Record<number, { icon: string; text: string }> = {
              0: { icon: '🎉', text: 'Tudo foi iniciado!' },
              1: { icon: '✨', text: 'Nenhum em edição agora' },
              2: { icon: '🔍', text: 'Nada aguardando revisão' },
              3: { icon: '📤', text: 'Tudo já foi enviado!' },
              4: { icon: '⏳', text: 'Aguardando retorno dos clientes' },
              5: { icon: '✅', text: 'Nenhuma aprovação de cliente ainda' },
              6: { icon: '🎯', text: 'Perfeito — nada reprovado!' },
              7: { icon: '📅', text: 'Nenhuma publicação registrada' },
            }
            const emptyMsg = EMPTY_MESSAGES[col.status] ?? { icon: '📭', text: 'Vazio' }

            const pct = filteredItems.length > 0 ? Math.round(colItems.length / filteredItems.length * 100) : 0

            const dropZone = (
              <DroppableZone status={col.status}>
                {cardsJsx}
                {colItems.length === 0 && (
                  <Box sx={{ py: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8 }}>
                    <Typography sx={{ fontSize: '1.4rem', lineHeight: 1, filter: 'grayscale(0.3)', opacity: 0.5 }}>{emptyMsg.icon}</Typography>
                    <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', opacity: 0.55, lineHeight: 1.4, maxWidth: 130 }}>{emptyMsg.text}</Typography>
                    <Typography sx={{ fontSize: '0.5rem', color: cfg.color, opacity: 0.25, mt: 0.5 }}>Arraste aqui</Typography>
                  </Box>
                )}
              </DroppableZone>
            )

            return (
              <Box key={col.status} sx={{ flex: '0 0 240px', maxHeight: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Column header */}
                <Box sx={{
                  borderRadius: 2, bgcolor: `${cfg.color}0c`, border: `1px solid ${cfg.color}20`,
                  flexShrink: 0, mb: 1, overflow: 'hidden',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, px: 1.2, py: 0.8 }}>
                    <Typography sx={{ fontSize: '0.78rem' }}>{cfg.emoji}</Typography>
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: cfg.color, flex: 1, lineHeight: 1 }} noWrap>
                      {colLabels[col.status] || cfg.label}
                    </Typography>
                    <Badge badgeContent={lateCount || undefined} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.5rem', minWidth: 14, height: 14 } }}>
                      <Box sx={{ minWidth: 20, height: 18, borderRadius: 3, bgcolor: `${cfg.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.6 }}>
                        <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: cfg.color }}>{colItems.length}</Typography>
                      </Box>
                    </Badge>
                  </Box>
                  {/* Progress bar */}
                  <Box sx={{ height: 2, bgcolor: 'rgba(255,255,255,0.05)' }}>
                    <Box sx={{
                      height: '100%', width: `${pct}%`,
                      bgcolor: cfg.color, opacity: 0.6,
                      transition: 'width 0.6s ease',
                    }} />
                  </Box>
                </Box>

                {/* Cards scroll */}
                <Box sx={{ overflowY: 'auto', flex: 1 }}>
                  {sortByDate ? dropZone : (
                    <SortableContext items={colIds} strategy={verticalListSortingStrategy}>
                      {dropZone}
                    </SortableContext>
                  )}
                </Box>
              </Box>
            )
          })}

        </Box>

        {/* Drag overlay */}
        <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={{ duration: 160, easing: 'ease-out' }}>
          {activeItem && (
            <Box sx={{ opacity: 0.92, cursor: 'grabbing', pointerEvents: 'none' }}>
              <KanbanCard
                item={activeItem}
                state={states[activeItem.i] ?? { status: activeItem.s, title: '', link: '', caption: '', notes: '' }}
                onSendToClient={onSendToClient}
                clientColor={clientColors?.[activeItem.c]}
              />
            </Box>
          )}
        </DragOverlay>
      </DndContext>

      {/* ── Add dialog ── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 } } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{addType === 'Reel' ? '🎬' : addType === 'Feed' ? '📸' : addType === 'Story' ? '📱' : addType === 'Carrossel' ? '🎠' : '📝'}</Typography>
            <Box>
              <Typography fontWeight={800} sx={{ fontSize: '0.95rem', lineHeight: 1.1 }}>
                Novo card — {addType === 'Reel' ? 'Vídeo' : addType === 'Feed' ? 'Feed' : addType === 'Story' ? 'Story' : addType === 'Carrossel' ? 'Carrossel' : 'Post'}
              </Typography>
              <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', lineHeight: 1 }}>Adicionar à produção de conteúdo</Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '10px !important' }}>
          <TextField label="Cliente" size="small" fullWidth select value={addClient} onChange={e => setAddClient(e.target.value)} autoFocus>
            {clientOptions.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField label="Título / descrição do conteúdo" size="small" fullWidth value={addTitle} onChange={e => setAddTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddSubmit()} />

          {/* Datas: entrega + publicação lado a lado */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'end', gap: 1 }}>
            <Box>
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: '#60A5FA', mb: 0.5 }}>📦 Entrega ao editor</Typography>
              <TextField
                type="date" size="small" fullWidth
                value={addDeliveryDate}
                onChange={e => setAddDeliveryDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, input: { sx: { fontSize: '0.75rem' } } }}
                placeholder="dd/mm/aaaa"
              />
            </Box>
            <Box sx={{ pb: 0.8, color: 'text.disabled', fontSize: '0.9rem', textAlign: 'center' }}>→</Box>
            <Box>
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: '#00C47A', mb: 0.5 }}>🚀 Publicação</Typography>
              <TextField
                type="date" size="small" fullWidth
                value={addDate}
                onChange={e => setAddDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, input: { sx: { fontSize: '0.75rem' } } }}
              />
            </Box>
          </Box>

          <TextField
            label="Link do material bruto (Drive)" size="small" fullWidth
            value={addMaterialLink} onChange={e => setAddMaterialLink(e.target.value)}
            placeholder="https://drive.google.com/..."
          />
          <TextField
            label="Link do roteiro (Docs/Drive)" size="small" fullWidth
            value={addRoteiroLink} onChange={e => setAddRoteiroLink(e.target.value)}
            placeholder="https://docs.google.com/..."
          />

          <Box>
            <Typography variant="caption" sx={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: 0.6, color: 'text.secondary', mb: 0.5, display: 'block' }}>Tipo de conteúdo</Typography>
            <ToggleButtonGroup exclusive value={addType} onChange={(_, v) => v && setAddType(v)} size="small" fullWidth>
              {(['Post', 'Reel', 'Story', 'Carrossel', 'Feed'] as ContentType[]).map(t => (
                <ToggleButton key={t} value={t} sx={{ fontSize: '0.6rem', fontWeight: 700, py: 0.6 }}>{t}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: 0.6, color: 'text.secondary', mb: 0.5, display: 'block' }}>Status inicial</Typography>
            <TextField size="small" fullWidth select value={addStatus} onChange={e => setAddStatus(Number(e.target.value) as Status)}>
              {COLUMNS.map(col => <MenuItem key={col.status} value={col.status}>{STATUS_CONFIG[col.status].emoji} {STATUS_CONFIG[col.status].label}</MenuItem>)}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button size="small" onClick={() => setAddOpen(false)} sx={{ color: 'text.secondary' }}>Cancelar</Button>
          <Button size="small" variant="contained" disabled={!addClient || !addTitle} onClick={handleAddSubmit}
            sx={{ fontWeight: 700, px: 2, background: '#3B82F6', color: '#fff', '&:hover': { filter: 'brightness(1.1)' } }}>
            + Criar card
          </Button>
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
          <TextField label="Título" size="small" fullWidth autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEditSubmit()} />
          <TextField label="Data de publicação" type="date" size="small" fullWidth value={editDate} onChange={e => setEditDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <Box>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 0.5, display: 'block' }}>Tipo</Typography>
            <ToggleButtonGroup exclusive value={editType} onChange={(_, v) => v && setEditType(v)} size="small" fullWidth>
              {(['Post', 'Reel', 'Story', 'Carrossel', 'Feed'] as ContentType[]).map(t => (
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

      {/* ── Delete single card confirm ── */}
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
          <Button size="small" variant="contained" color="error" startIcon={<DeleteOutlineIcon sx={{ fontSize: 14 }} />}
            onClick={() => { if (deleteId !== null) onDelete?.(deleteId); setDeleteId(null) }}
            sx={{ fontWeight: 700 }}>
            Apagar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Bulk delete confirm ── */}
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
            Essa ação é permanente e não pode ser desfeita. Os {bulkSelected.size} cards selecionados serão removidos.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button size="small" onClick={() => setBulkDeleteConfirm(false)}>Cancelar</Button>
          <Button size="small" variant="contained" color="error" startIcon={<DeleteOutlineIcon sx={{ fontSize: 14 }} />}
            onClick={applyBulkDelete} sx={{ fontWeight: 700 }}>
            Apagar tudo
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Send-to-client confirm ── */}
      <Dialog open={!!sendConfirmItem} onClose={() => setSendConfirmItem(null)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(24px)', border: '1px solid rgba(96,165,250,0.25)' } } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SendIcon sx={{ color: '#60A5FA', fontSize: 18 }} />
            <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>Enviar ao cliente</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {sendConfirmItem && (() => {
            const item  = items.find(i => i.i === sendConfirmItem.id)
            const title = states[sendConfirmItem.id]?.title || item?.n || 'Este conteúdo'
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', mb: 0.3 }}>Conteúdo</Typography>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>{title}</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#60A5FA', mt: 0.3 }}>{sendConfirmItem.clientName}</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                  📤 Isso vai gerar o link de portal do cliente e registrar a data de envio.
                </Typography>
                <Box onClick={() => setSendIsTraffic(v => !v)} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
                  p: 1.5, borderRadius: 2,
                  bgcolor: sendIsTraffic ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${sendIsTraffic ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: 'rgba(245,158,11,0.3)' },
                }}>
                  <Box sx={{ width: 36, height: 20, borderRadius: 10, flexShrink: 0, bgcolor: sendIsTraffic ? '#F59E0B' : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'all 0.2s' }}>
                    <Box sx={{ position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%', bgcolor: '#fff', transition: 'left 0.2s', left: sendIsTraffic ? 19 : 3, boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: sendIsTraffic ? '#F59E0B' : 'rgba(255,255,255,0.6)' }}>
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
          <Button size="small" variant="contained" onClick={handleConfirmSendToClient} disabled={sendConfirming}
            startIcon={sendConfirming ? undefined : <SendIcon sx={{ fontSize: 14 }} />}
            sx={{ background: '#3B82F6', color: '#fff', fontWeight: 800, '&:hover': { filter: 'brightness(1.08)' } }}>
            {sendConfirming ? 'Enviando...' : 'Confirmar envio'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Column settings dialog ── */}
      <Dialog open={colSettingsOpen} onClose={() => setColSettingsOpen(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(10,10,12,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 } } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon sx={{ color: 'primary.main', fontSize: 18 }} />
            <Typography fontWeight={800} sx={{ fontSize: '0.95rem', flex: 1 }}>Configurar colunas</Typography>
            <Tooltip title="Restaurar padrões">
              <IconButton size="small" onClick={resetColSettings} sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
                <RestartAltIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 0.3 }}>
            Renomeie colunas e oculte as que não usa — salvo por dispositivo
          </Typography>
        </DialogTitle>
        <Divider sx={{ opacity: 0.08 }} />
        <DialogContent sx={{ py: 1.5, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
          {COLUMNS.map(col => {
            const cfg = STATUS_CONFIG[col.status]
            const isHidden = draftHidden.includes(col.status)
            return (
              <Box key={col.status} sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                p: 1, borderRadius: 2,
                bgcolor: isHidden ? 'rgba(255,255,255,0.02)' : `${cfg.color}08`,
                border: `1px solid ${isHidden ? 'rgba(255,255,255,0.05)' : cfg.color + '20'}`,
                opacity: isHidden ? 0.5 : 1,
                transition: 'all 0.2s',
              }}>
                <Switch
                  size="small"
                  checked={!isHidden}
                  onChange={e => {
                    setDraftHidden(prev =>
                      e.target.checked ? prev.filter(s => s !== col.status) : [...prev, col.status]
                    )
                  }}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: cfg.color },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: cfg.color },
                  }}
                />
                <Typography sx={{ fontSize: '0.82rem', width: 20, textAlign: 'center' }}>{cfg.emoji}</Typography>
                <TextField
                  size="small" variant="outlined"
                  value={draftLabels[col.status] ?? ''}
                  onChange={e => setDraftLabels(prev => ({ ...prev, [col.status]: e.target.value }))}
                  placeholder={cfg.label}
                  disabled={isHidden}
                  sx={{
                    flex: 1,
                    '& .MuiInputBase-root': { fontSize: '0.72rem', height: 28, bgcolor: 'rgba(255,255,255,0.03)' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: `${cfg.color}25` },
                    '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: `${cfg.color}55` },
                  }}
                />
                <Box sx={{ minWidth: 24, textAlign: 'right' }}>
                  <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', fontWeight: 700 }}>
                    {itemsByStatus[col.status]?.length ?? 0}
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </DialogContent>
        <Divider sx={{ opacity: 0.08 }} />
        <DialogActions sx={{ px: 2, pb: 2, pt: 1.5, gap: 1 }}>
          <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', mr: 'auto' }}>
            {draftHidden.length > 0 ? `${draftHidden.length} coluna${draftHidden.length !== 1 ? 's' : ''} oculta${draftHidden.length !== 1 ? 's' : ''}` : 'Todas as colunas visíveis'}
          </Typography>
          <Button size="small" onClick={() => setColSettingsOpen(false)} sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>Cancelar</Button>
          <Button size="small" variant="contained" onClick={saveColSettings}
            sx={{ fontWeight: 700, fontSize: '0.78rem', background: '#3B82F6' }}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Resolver com IA ── */}
      {aiItem && (
        <Suspense fallback={null}>
          <ResolveWithAIModal
            open={Boolean(aiItem)}
            onClose={() => setAiItem(null)}
            item={aiItem}
            state={states[aiItem.i] ?? { status: aiItem.s, title: '', link: '', caption: '', notes: '' }}
            onUpdate={onUpdateState}
            onStatusChange={onStatusChange}
          />
        </Suspense>
      )}

      {/* ── WhatsApp em lote ── */}
      <WhatsAppLoteDialog
        open={whatsappLoteOpen}
        onClose={() => setWhatsappLoteOpen(false)}
        clients={loteClients}
        onSendToClient={(clientName, itemIds) => onBulkSendToClient?.(clientName, itemIds) ?? Promise.resolve()}
      />
    </Box>
  )
}
