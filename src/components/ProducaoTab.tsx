import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable,
  type DragEndEvent, type DragStartEvent,
  closestCenter, pointerWithin,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  useSortable, SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Box, Typography, Paper, Chip, Tooltip, Badge, Menu,
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
import MoreVertIcon from '@mui/icons-material/MoreVert'
import SortIcon from '@mui/icons-material/Sort'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import type { Client, ContentItem, ContentType, ItemEditPatch, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'

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
          bgcolor: colColor, borderRadius: '2px 0 0 2px',
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

// ── Persistence helpers (order + col names) ───────────────

function loadColOrder(boardKey: string): Record<number, number[]> {
  try { return JSON.parse(localStorage.getItem(`sm_col_order_${boardKey}`) ?? '{}') } catch { return {} }
}
function saveColOrder(boardKey: string, o: Record<number, number[]>) {
  localStorage.setItem(`sm_col_order_${boardKey}`, JSON.stringify(o))
}
function loadColNames(boardKey: string): Record<number, string> {
  try { return JSON.parse(localStorage.getItem(`sm_col_names_${boardKey}`) ?? '{}') } catch { return {} }
}
function saveColNames(boardKey: string, n: Record<number, string>) {
  localStorage.setItem(`sm_col_names_${boardKey}`, JSON.stringify(n))
}

// ── Sortable card wrapper (drag + drop) ───────────────────

function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <Box ref={setNodeRef} {...listeners} {...attributes}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
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
  bulkMode: boolean
  bulkSelected: Set<number>
  onBulkToggle: (id: number) => void
  boardKey: string
  onSendToClient?: (id: number, clientName: string) => void
}

function MiniKanban({
  items, states, onStatusChange, onEdit, columns, filterFn,
  filterClient, bulkMode, bulkSelected, onBulkToggle, boardKey, onSendToClient,
}: MiniKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  // ── Ordem manual por coluna (persistida) ──────────────
  const [manualOrder, setManualOrder] = useState<Record<number, number[]>>(() => loadColOrder(boardKey))

  // ── Nomes customizados por coluna ─────────────────────
  const [colNames, setColNames] = useState<Record<number, string>>(() => loadColNames(boardKey))

  // ── Estado do menu da coluna ──────────────────────────
  const colMenuRef = useRef<HTMLElement | null>(null)
  const [colMenuStatus, setColMenuStatus] = useState<number | null>(null)
  const [renamingStatus, setRenamingStatus] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

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

  // byStatus aplica manualOrder: novos itens vão ao final
  const byStatus = useMemo(() => {
    const map: Record<number, ContentItem[]> = {}
    columns.forEach(c => { map[c.status] = [] })
    boardItems.forEach(item => {
      const st = states[item.i]?.status ?? item.s
      if (map[st] !== undefined) map[st].push(item)
    })
    Object.keys(map).forEach(k => {
      const status = Number(k)
      const order = manualOrder[status]
      if (order && order.length > 0) {
        const orderIdx = new Map(order.map((id, i) => [id, i]))
        map[status].sort((a, b) => {
          const ai = orderIdx.has(a.i) ? orderIdx.get(a.i)! : Infinity
          const bi = orderIdx.has(b.i) ? orderIdx.get(b.i)! : Infinity
          return ai - bi
        })
      }
    })
    return map
  }, [boardItems, states, columns, manualOrder])

  const activeItem = useMemo(() => activeId ? items.find(i => String(i.i) === activeId) ?? null : null, [activeId, items])
  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return

    const activeItemId = Number(active.id)
    const overId = String(over.id)
    const activeItemObj = items.find(i => i.i === activeItemId)
    if (!activeItemObj) return
    const activeStatus = states[activeItemId]?.status ?? activeItemObj.s

    let targetStatus: Status = activeStatus
    let overCardId: number | null = null

    if (overId.startsWith(`${boardKey}-col-`)) {
      // Dropped on the column zone (empty space)
      targetStatus = Number(overId.replace(`${boardKey}-col-`, '')) as Status
    } else {
      // Dropped on another card
      const overItemId = Number(overId)
      if (!isNaN(overItemId)) {
        const overItemObj = items.find(i => i.i === overItemId)
        if (overItemObj) {
          targetStatus = states[overItemId]?.status ?? overItemObj.s
          overCardId = overItemId
        }
      }
    }

    if (targetStatus !== activeStatus) {
      // ── Mover para outra coluna ──────────────────────
      onStatusChange(activeItemId, targetStatus)
      if (targetStatus === 4) {
        const it = items.find(i => i.i === activeItemId)
        if (it) onSendToClient?.(activeItemId, it.c)
      }
      setManualOrder(prev => {
        const srcItems = byStatus[activeStatus] ?? []
        const dstItems = byStatus[targetStatus] ?? []
        const srcOrder = (prev[activeStatus] ?? srcItems.map(i => i.i)).filter(id => id !== activeItemId)
        let dstOrder = (prev[targetStatus] ?? dstItems.map(i => i.i)).filter(id => id !== activeItemId)
        if (overCardId !== null) {
          const idx = dstOrder.indexOf(overCardId)
          if (idx !== -1) {
            dstOrder = [...dstOrder.slice(0, idx), activeItemId, ...dstOrder.slice(idx)]
          } else {
            dstOrder = [...dstOrder, activeItemId]
          }
        } else {
          dstOrder = [...dstOrder, activeItemId]
        }
        const next = { ...prev, [activeStatus]: srcOrder, [targetStatus]: dstOrder }
        saveColOrder(boardKey, next)
        return next
      })
    } else if (overCardId !== null && overCardId !== activeItemId) {
      // ── Reordenar dentro da mesma coluna ──────────────
      setManualOrder(prev => {
        const colItems = byStatus[activeStatus] ?? []
        const currentOrder = prev[activeStatus] ?? colItems.map(i => i.i)
        const oldIdx = currentOrder.indexOf(activeItemId)
        const newIdx = currentOrder.indexOf(overCardId!)
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return prev
        const next = { ...prev, [activeStatus]: arrayMove(currentOrder, oldIdx, newIdx) }
        saveColOrder(boardKey, next)
        return next
      })
    }
  }, [states, items, byStatus, onStatusChange, boardKey, onSendToClient])

  // ── Ordenar coluna por data (trigger manual) ──────────
  const sortColByDate = useCallback((status: number, dir: 'asc' | 'desc') => {
    const todayMs = new Date().setHours(0, 0, 0, 0)
    const colItems = [...(byStatus[status] ?? [])]
    colItems.sort((a, b) => {
      const aMs = new Date(a.dt).setHours(0, 0, 0, 0)
      const bMs = new Date(b.dt).setHours(0, 0, 0, 0)
      const aOver = aMs < todayMs; const bOver = bMs < todayMs
      if (dir === 'asc') {
        if (aOver && !bOver) return -1
        if (!aOver && bOver) return 1
        return aMs - bMs
      }
      return bMs - aMs
    })
    const newOrder = colItems.map(i => i.i)
    setManualOrder(prev => {
      const next = { ...prev, [status]: newOrder }
      saveColOrder(boardKey, next)
      return next
    })
    setColMenuStatus(null)
  }, [byStatus, boardKey])

  // ── Renomear coluna ───────────────────────────────────
  const applyRename = useCallback(() => {
    if (renamingStatus === null || !renameValue.trim()) { setRenamingStatus(null); return }
    const next = { ...colNames, [renamingStatus]: renameValue.trim() }
    setColNames(next)
    saveColNames(boardKey, next)
    setRenamingStatus(null)
    setColMenuStatus(null)
  }, [renamingStatus, renameValue, colNames, boardKey])

  const today = new Date(); today.setHours(0, 0, 0, 0)

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Box sx={{ display: 'flex', gap: 1.2, height: '100%' }}>
        {columns.map(col => {
          const colItems = byStatus[col.status] ?? []
          const displayName = colNames[col.status] || col.label
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
                position: 'relative',
                '&:hover .col-menu-btn': { opacity: 1 },
              }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: col.color, flexShrink: 0 }} />

                {/* Nome da coluna (editável inline) */}
                {renamingStatus === col.status ? (
                  <TextField
                    autoFocus size="small" value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={applyRename}
                    onKeyDown={e => { if (e.key === 'Enter') applyRename(); if (e.key === 'Escape') setRenamingStatus(null) }}
                    sx={{
                      flex: 1,
                      '& .MuiInputBase-root': { fontSize: '0.63rem', height: 22, color: col.color, bgcolor: `${col.color}14`, fontWeight: 800 },
                      '& fieldset': { borderColor: `${col.color}60` },
                    }}
                  />
                ) : (
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: col.color, flex: 1, lineHeight: 1 }} noWrap>
                    {displayName}
                  </Typography>
                )}

                <Badge badgeContent={lateCount || undefined} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.45rem', minWidth: 13, height: 13 } }}>
                  <Box sx={{ minWidth: 18, height: 16, px: 0.5, borderRadius: 3, bgcolor: `${col.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ fontSize: '0.56rem', fontWeight: 800, color: col.color, lineHeight: 1 }}>{colItems.length}</Typography>
                  </Box>
                </Badge>

                {/* Menu da coluna */}
                <IconButton
                  className="col-menu-btn"
                  size="small"
                  onClick={e => { colMenuRef.current = e.currentTarget; setColMenuStatus(col.status) }}
                  sx={{
                    p: 0.2, opacity: 0, transition: 'opacity 0.15s',
                    color: `${col.color}99`,
                    '&:hover': { color: col.color, bgcolor: `${col.color}14` },
                  }}
                >
                  <MoreVertIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Box>

              {/* Cards */}
              <Box sx={{ overflowY: 'auto', flex: 1 }}>
                <SortableContext items={colItems.map(i => String(i.i))} strategy={verticalListSortingStrategy}>
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
                        <SortableCard key={item.i} id={String(item.i)}>{card}</SortableCard>
                      )
                    })}
                    {colItems.length === 0 && (
                      <Box sx={{ py: 3, textAlign: 'center', opacity: 0.22 }}>
                        <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>Vazio · arraste aqui</Typography>
                      </Box>
                    )}
                  </DropCol>
                </SortableContext>
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

      {/* ── Menu flutuante da coluna ──────────────────────── */}
      <Menu
        open={colMenuStatus !== null}
        anchorEl={colMenuRef.current}
        onClose={() => setColMenuStatus(null)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'rgba(18,18,18,0.98)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2,
              minWidth: 200,
            }
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {colMenuStatus !== null && (() => {
          const col = columns.find(c => c.status === colMenuStatus)!
          const displayName = colNames[colMenuStatus] || col?.label || ''
          return [
            <Box key="header" sx={{ px: 1.8, py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                Coluna: {displayName}
              </Typography>
            </Box>,
            <MenuItem key="rename" onClick={() => {
              setRenameValue(displayName)
              setRenamingStatus(colMenuStatus)
              setColMenuStatus(null)
            }} sx={{ gap: 1.2, fontSize: '0.72rem', py: 1 }}>
              <DriveFileRenameOutlineIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.45)' }} />
              <Typography sx={{ fontSize: '0.72rem' }}>Renomear coluna</Typography>
            </MenuItem>,
            <MenuItem key="sort-asc" onClick={() => sortColByDate(colMenuStatus, 'asc')} sx={{ gap: 1.2, fontSize: '0.72rem', py: 1 }}>
              <SortIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.45)' }} />
              <Box>
                <Typography sx={{ fontSize: '0.72rem' }}>Ordenar por data ↑</Typography>
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)' }}>Atrasados primeiro → mais futuro</Typography>
              </Box>
            </MenuItem>,
            <MenuItem key="sort-desc" onClick={() => sortColByDate(colMenuStatus, 'desc')} sx={{ gap: 1.2, fontSize: '0.72rem', py: 1 }}>
              <SortIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', transform: 'scaleY(-1)' }} />
              <Box>
                <Typography sx={{ fontSize: '0.72rem' }}>Ordenar por data ↓</Typography>
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)' }}>Mais futuro primeiro</Typography>
              </Box>
            </MenuItem>,
          ]
        })()}
      </Menu>
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
                transition: 'all 0.15s',
              }}>
                {board.label}
              </Typography>
              <Box sx={{
                minWidth: 20, height: 17, px: 0.6, borderRadius: 2,
                bgcolor: active ? `${board.color}28` : 'rgba(255,255,255,0.06)',
                border: active ? `1px solid ${board.color}50` : '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
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
            sx={{ fontSize: '0.65rem', py: 0.3, background: '#3B8EFF', color: '#fff', fontWeight: 700 }}>
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
                  fontSize: '0.6rem', fontWeight: 700, py: 0.6, gap: 0.3,
                  '&.Mui-selected': { color: TYPE_COLOR[t], bgcolor: `${TYPE_COLOR[t]}18`, borderColor: `${TYPE_COLOR[t]}50` },
                }}>
                  <Typography sx={{ fontSize: '0.72rem', lineHeight: 1 }}>{TYPE_EMOJI[t]}</Typography>
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
              background: BOARDS[subTab].color,
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
            sx={{ background: '#25D366', color: '#fff', fontWeight: 800, '&:hover': { filter: 'brightness(1.1)' } }}>
            Enviar pelo WhatsApp
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
