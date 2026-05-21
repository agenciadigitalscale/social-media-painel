import { useMemo, useState, useCallback, useEffect } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Box, Typography, Paper, Chip, Tooltip, Tabs, Tab, Badge,
  Button, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import FilterListIcon from '@mui/icons-material/FilterList'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import type { Client, ContentItem, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'

// ── Column definitions ────────────────────────────────────

interface ColDef { status: Status; label: string; color: string }

const VIDEO_COLS: ColDef[] = [
  { status: 0, label: 'A fazer',          color: '#71717A' },
  { status: 1, label: 'Em produção',      color: '#FFD700' },
  { status: 2, label: 'Aprov. interna',   color: '#3B8EFF' },
  { status: 6, label: 'Reprovado',        color: '#FF3B30' },
]

const DESIGN_COLS: ColDef[] = [
  { status: 0, label: 'A fazer',          color: '#71717A' },
  { status: 1, label: 'Em produção',      color: '#C084FC' },
  { status: 2, label: 'Aprov. interna',   color: '#3B8EFF' },
  { status: 6, label: 'Reprovado',        color: '#FF3B30' },
  { status: 5, label: 'Produzido',        color: '#00C875' },
]

const SOCIAL_COLS: ColDef[] = [
  { status: 2, label: 'Aprov. interna',   color: '#3B8EFF' },
  { status: 3, label: 'Aprovado',         color: '#2F80ED' },
  { status: 4, label: 'Enviado cliente',  color: '#FF9A3D' },
  { status: 6, label: 'Reprovado',        color: '#FF3B30' },
  { status: 5, label: 'Aprovado cliente', color: '#00C875' },
  { status: 7, label: 'Publicado',        color: '#00C47A' },
]

const ALL_BOARDS = [VIDEO_COLS, DESIGN_COLS, SOCIAL_COLS]

const TYPE_COLOR: Record<string, string> = {
  Post: '#60A5FA', Reel: '#C084FC', Story: '#FB7185', Carrossel: '#34D399',
}

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

function MiniCard({ item, state, isDragging, colColor, isSelected, bulkMode, onSelect }: {
  item: ContentItem
  state: ItemState
  isDragging?: boolean
  colColor: string
  isSelected?: boolean
  bulkMode?: boolean
  onSelect?: () => void
}) {
  const border = urgencyBorder(item.dt, state.status)
  const dLabel = getDateLabel(item.dt)
  const isLate = dLabel.includes('atraso')

  return (
    <Paper
      elevation={0}
      onClick={bulkMode ? onSelect : undefined}
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
        transition: 'all 0.15s',
        '&::before': {
          content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 2.5,
          bgcolor: colColor, borderRadius: '2px 0 0 2px', boxShadow: `0 0 6px ${colColor}`,
        },
        '&:hover': { bgcolor: bulkMode ? `${colColor}16` : 'rgba(255,255,255,0.055)' },
      }}
    >
      {/* Checkbox in bulk mode */}
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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, pl: 0.3, pr: bulkMode ? 2 : 0 }}>
        <Chip label={item.tp} size="small" sx={{
          height: 13, fontSize: '0.44rem', fontWeight: 700,
          bgcolor: `${TYPE_COLOR[item.tp] ?? '#888'}18`,
          color: TYPE_COLOR[item.tp] ?? '#888',
          border: `1px solid ${TYPE_COLOR[item.tp] ?? '#888'}33`,
          flexShrink: 0,
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
      style={{ transform: CSS.Translate.toString(transform), zIndex: isDragging ? 999 : undefined, position: 'relative', opacity: isDragging ? 0.35 : 1 }}>
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
      borderRadius: 1.5, minHeight: 60,
      border: `1px dashed ${isOver ? color + '66' : 'transparent'}`,
      bgcolor: isOver ? `${color}08` : 'transparent',
      transition: 'all 0.15s',
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
  columns: ColDef[]
  filterFn: (item: ContentItem, state: ItemState) => boolean
  filterClient: string
  sortByDate: boolean
  bulkMode: boolean
  bulkSelected: Set<number>
  onBulkToggle: (id: number) => void
  boardKey: string   // unique prefix to avoid droppable ID conflicts across tabs
}

function MiniKanban({
  items, states, onStatusChange, columns, filterFn,
  filterClient, sortByDate, bulkMode, bulkSelected, onBulkToggle, boardKey,
}: MiniKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

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
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                bgcolor: `${col.color}0c`, border: `1px solid ${col.color}22`, flexShrink: 0,
              }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: col.color, boxShadow: `0 0 5px ${col.color}`, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: col.color, flex: 1, lineHeight: 1 }} noWrap>
                  {col.label}
                </Typography>
                <Badge badgeContent={lateCount || undefined} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.45rem', minWidth: 13, height: 13 } }}>
                  <Box sx={{ minWidth: 18, height: 16, px: 0.5, borderRadius: 3, bgcolor: `${col.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ fontSize: '0.56rem', fontWeight: 800, color: col.color, lineHeight: 1 }}>{colItems.length}</Typography>
                  </Box>
                </Badge>
              </Box>

              {/* Cards scroll */}
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
                      />
                    )
                    return bulkMode ? (
                      <Box key={item.i}>{card}</Box>
                    ) : (
                      <DragCard key={item.i} id={String(item.i)}>{card}</DragCard>
                    )
                  })}
                  {colItems.length === 0 && (
                    <Box sx={{ py: 3, textAlign: 'center', opacity: 0.25 }}>
                      <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>Vazio</Typography>
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

// ── Tab label ─────────────────────────────────────────────

function TabLabel({ emoji, label, count, color }: { emoji: string; label: string; count: number; color: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
      <Typography sx={{ fontSize: '0.9rem', lineHeight: 1 }}>{emoji}</Typography>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, lineHeight: 1 }}>{label}</Typography>
      <Box sx={{ minWidth: 18, height: 16, px: 0.6, borderRadius: 2, bgcolor: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: '0.54rem', fontWeight: 900, color, lineHeight: 1 }}>{count}</Typography>
      </Box>
    </Box>
  )
}

// ── Props ─────────────────────────────────────────────────

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, s: Status) => void
  onDelete?: (id: number) => void
  allClients?: Client[]
}

// ── Main ─────────────────────────────────────────────────

export default function ProducaoTab({ items, states, onStatusChange, onDelete, allClients }: Props) {
  const [subTab, setSubTab]         = useState(0)
  const [filterClient, setFilterClient] = useState('all')
  const [sortByDate, setSortByDate] = useState(true)
  const [bulkMode, setBulkMode]     = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<Status>(1)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  // Clear selection when switching sub-tabs
  useEffect(() => {
    setBulkSelected(new Set()); setBulkMode(false)
  }, [subTab])

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

  // Active columns for the current sub-tab
  const activeCols = ALL_BOARDS[subTab]

  // ── Item counts per sub-board (tab badges) ───────────────
  const counts = useMemo(() => {
    const apply = (cols: ColDef[], typeFn: (tp: string) => boolean) => {
      let n = 0
      items.forEach(item => {
        if (!typeFn(item.tp)) return
        const st = states[item.i]?.status ?? item.s
        if (cols.some(c => c.status === st)) n++
      })
      return n
    }
    return [
      apply(VIDEO_COLS, tp => tp === 'Reel'),
      apply(DESIGN_COLS, tp => tp !== 'Reel'),
      apply(SOCIAL_COLS, () => true),
    ]
  }, [items, states])

  // ── Column summary chips for the active board ────────────
  const colSummary = useMemo(() => {
    return activeCols.map(col => {
      const n = items.filter(item => {
        if (filterClient !== 'all' && item.c !== filterClient) return false
        const st = states[item.i]?.status ?? item.s
        return st === col.status
      }).length
      return { ...col, n }
    })
  }, [items, states, activeCols, filterClient])

  // ── Filter functions ──────────────────────────────────────
  const videoFilter   = useCallback((item: ContentItem, s: ItemState) => item.tp === 'Reel' && VIDEO_COLS.some(c => c.status === s.status), [])
  const designFilter  = useCallback((item: ContentItem, s: ItemState) => item.tp !== 'Reel' && DESIGN_COLS.some(c => c.status === s.status), [])
  const socialFilter  = useCallback((_: ContentItem, s: ItemState) => SOCIAL_COLS.some(c => c.status === s.status), [])
  const filterFns     = [videoFilter, designFilter, socialFilter]
  const boardKeys     = ['vid', 'des', 'soc']
  const tabColors     = ['#60A5FA', '#C084FC', '#00C47A']

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Top header: sub-tabs ──────────────────────────── */}
      <Box sx={{
        px: 2, pt: 1.2, pb: 0, borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: 2,
      }}>
        <Typography sx={{ fontWeight: 900, fontSize: '0.82rem', color: 'primary.main', mb: 1.2 }}>
          Produções
        </Typography>
        <Tabs
          value={subTab} onChange={(_, v) => setSubTab(v)}
          sx={{ minHeight: 'unset', '& .MuiTabs-indicator': { bgcolor: tabColors[subTab], height: 2 } }}
        >
          {[
            { emoji: '🎬', label: 'Vídeo',  color: '#60A5FA', count: counts[0] },
            { emoji: '🎨', label: 'Design', color: '#C084FC', count: counts[1] },
            { emoji: '📱', label: 'Social', color: '#00C47A', count: counts[2] },
          ].map((t, i) => (
            <Tab key={t.label} disableRipple
              label={<TabLabel emoji={t.emoji} label={t.label} count={t.count} color={t.color} />}
              sx={{ minHeight: 40, py: 0.8, px: 1.5, textTransform: 'none', opacity: subTab === i ? 1 : 0.45, transition: 'opacity 0.2s' }}
            />
          ))}
        </Tabs>
        <Box sx={{ flex: 1 }} />
      </Box>

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <Box sx={{
        px: 2, py: 0.9, display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
      }}>

        {/* Client filter */}
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

        {/* Sort toggle */}
        <Tooltip title={sortByDate ? 'Automático: atrasados → hoje → futuro. Clique para modo livre.' : 'Modo livre (sem ordenação automática). Clique para voltar ao automático.'}>
          <Button
            size="small" onClick={() => setSortByDate(v => !v)}
            sx={{
              fontSize: '0.62rem', borderRadius: 2, px: 1.2, py: 0.3,
              border: sortByDate ? '1px solid rgba(255,144,57,0.4)' : '1px solid rgba(192,132,252,0.4)',
              color: sortByDate ? 'primary.main' : '#C084FC',
              bgcolor: sortByDate ? 'rgba(255,144,57,0.08)' : 'rgba(192,132,252,0.08)',
              '&:hover': { bgcolor: sortByDate ? 'rgba(255,144,57,0.15)' : 'rgba(192,132,252,0.15)' },
            }}
          >
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

        {/* Bulk select toggle */}
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
          {[VIDEO_COLS, DESIGN_COLS, SOCIAL_COLS].map((cols, i) => (
            subTab === i ? (
              <MiniKanban
                key={boardKeys[i]}
                items={items} states={states} onStatusChange={onStatusChange}
                columns={cols} filterFn={filterFns[i]}
                filterClient={filterClient} sortByDate={sortByDate}
                bulkMode={bulkMode} bulkSelected={bulkSelected} onBulkToggle={toggleBulk}
                boardKey={boardKeys[i]}
              />
            ) : null
          ))}
        </Box>
      </Box>

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
