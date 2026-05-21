import { useMemo, useState, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Box, Typography, Paper, Chip, Tooltip, Tabs, Tab, Badge,
} from '@mui/material'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import type { ContentItem, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'

// ── Column definitions per sub-board ─────────────────────

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

const TYPE_COLOR: Record<string, string> = {
  Post: '#60A5FA', Reel: '#C084FC', Story: '#FB7185', Carrossel: '#34D399',
}

// ── Urgency helpers ───────────────────────────────────────

function urgencyBorder(dt: Date, status: Status, today: Date) {
  if (status === 7 || status === 5) return 'rgba(255,255,255,0.07)'
  const diff = Math.round((new Date(dt).setHours(0,0,0,0) - today.setHours(0,0,0,0)) / 86400000)
  if (diff < 0)  return 'rgba(255,59,48,0.4)'
  if (diff === 0) return 'rgba(255,144,57,0.4)'
  return 'rgba(255,255,255,0.07)'
}

function dateLabel(dt: Date, today: Date) {
  const diff = Math.round((new Date(dt).setHours(0,0,0,0) - today.setHours(0,0,0,0)) / 86400000)
  if (diff < 0)  return `${Math.abs(diff)}d atraso`
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  return new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ── Mini card ─────────────────────────────────────────────

function MiniCard({ item, state, isDragging, colColor }: {
  item: ContentItem
  state: ItemState
  isDragging?: boolean
  colColor: string
}) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  const border = urgencyBorder(item.dt, state.status, today)
  const dLabel = dateLabel(item.dt, today)
  const isLate = dLabel.includes('atraso')

  return (
    <Paper elevation={0} sx={{
      p: 1.2, borderRadius: 2,
      bgcolor: isDragging ? `${colColor}10` : 'rgba(255,255,255,0.03)',
      border: `1px solid ${border}`,
      opacity: isDragging ? 0.35 : 1,
      cursor: 'grab',
      userSelect: 'none',
      position: 'relative',
      overflow: 'hidden',
      '&::before': {
        content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 2.5,
        bgcolor: colColor, borderRadius: '2px 0 0 2px', boxShadow: `0 0 6px ${colColor}`,
      },
      '&:hover': { bgcolor: 'rgba(255,255,255,0.055)', border: `1px solid ${colColor}44` },
      transition: 'all 0.15s',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, pl: 0.3 }}>
        <Chip label={item.tp} size="small" sx={{
          height: 13, fontSize: '0.44rem', fontWeight: 700,
          bgcolor: `${TYPE_COLOR[item.tp] ?? '#888'}18`,
          color: TYPE_COLOR[item.tp] ?? '#888',
          border: `1px solid ${TYPE_COLOR[item.tp] ?? '#888'}33`,
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

// ── Draggable wrapper ─────────────────────────────────────

function DragCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  return (
    <Box ref={setNodeRef} {...listeners} {...attributes}
      style={{ transform: CSS.Translate.toString(transform), zIndex: isDragging ? 999 : undefined, position: 'relative', opacity: isDragging ? 0.35 : 1 }}>
      {children}
    </Box>
  )
}

// ── Droppable column ──────────────────────────────────────

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

function MiniKanban({
  items, states, onStatusChange, columns, filter,
}: {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, s: Status) => void
  columns: ColDef[]
  filter: (item: ContentItem, state: ItemState) => boolean
}) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  const boardItems = useMemo(() => {
    return items.filter(item => filter(item, states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }))
  }, [items, states, filter])

  const byStatus = useMemo(() => {
    const map: Record<number, ContentItem[]> = {}
    columns.forEach(c => { map[c.status] = [] })
    const todayMs = new Date().setHours(0, 0, 0, 0)
    boardItems.forEach(item => {
      const st = states[item.i]?.status ?? item.s
      if (map[st] !== undefined) map[st].push(item)
    })
    // Sort: atrasados primeiro, depois por data crescente
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
    return map
  }, [boardItems, states, columns])

  const activeItem = useMemo(() => activeId ? items.find(i => String(i.i) === activeId) ?? null : null, [activeId, items])

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const colId = String(over.id)
    if (!colId.startsWith('mini-col-')) return
    const newStatus = Number(colId.replace('mini-col-', '')) as Status
    const itemId = Number(active.id)
    const currentStatus = states[itemId]?.status ?? 0
    if (newStatus === currentStatus) return
    onStatusChange(itemId, newStatus)
  }, [states, onStatusChange])

  const total = boardItems.length

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Box sx={{ display: 'flex', gap: 1.2, height: '100%', overflow: 'hidden' }}>
        {columns.map(col => {
          const colItems = byStatus[col.status] ?? []
          const today = new Date(); today.setHours(0, 0, 0, 0)
          const lateCount = colItems.filter(i => {
            const dt = new Date(i.dt); dt.setHours(0, 0, 0, 0)
            return dt < today && col.status !== 5 && col.status !== 7
          }).length

          return (
            <Box key={col.status} sx={{
              flex: '0 0 210px', display: 'flex', flexDirection: 'column', maxHeight: '100%',
            }}>
              {/* Column header */}
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.8,
                px: 1, py: 0.7, borderRadius: 1.5,
                bgcolor: `${col.color}0c`, border: `1px solid ${col.color}22`,
                flexShrink: 0,
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

              {/* Cards */}
              <Box sx={{ overflowY: 'auto', flex: 1 }}>
                <DropCol colId={`mini-col-${col.status}`} color={col.color}>
                  {colItems.map(item => {
                    const st = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
                    return (
                      <DragCard key={item.i} id={String(item.i)}>
                        <MiniCard item={item} state={st} isDragging={activeId === String(item.i)} colColor={col.color} />
                      </DragCard>
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

      {/* KPI strip */}
      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, px: 1.5, py: 0.5, display: 'flex', gap: 2, alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.22)' }}>
          {total} itens · {columns.map(c => `${STATUS_CONFIG[c.status].emoji} ${byStatus[c.status]?.length ?? 0}`).join('  ')}
        </Typography>
      </Box>

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
    </DndContext>
  )
}

// ── Tab label helper ──────────────────────────────────────

function TabLabel({ emoji, label, count, color }: { emoji: string; label: string; count: number; color: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
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
}

// ── Main component ────────────────────────────────────────

export default function ProducaoTab({ items, states, onStatusChange }: Props) {
  const [subTab, setSubTab] = useState(0)

  // Pre-compute counts for tab badges
  const videoCounts = useMemo(() => {
    let n = 0
    items.forEach(item => {
      if (item.tp !== 'Reel') return
      const st = states[item.i]?.status ?? item.s
      if (VIDEO_COLS.some(c => c.status === st)) n++
    })
    return n
  }, [items, states])

  const designCounts = useMemo(() => {
    let n = 0
    items.forEach(item => {
      if (item.tp === 'Reel') return
      const st = states[item.i]?.status ?? item.s
      if (DESIGN_COLS.some(c => c.status === st)) n++
    })
    return n
  }, [items, states])

  const socialCounts = useMemo(() => {
    let n = 0
    items.forEach(item => {
      const st = states[item.i]?.status ?? item.s
      if (SOCIAL_COLS.some(c => c.status === st)) n++
    })
    return n
  }, [items, states])

  const videoFilter = useCallback((item: ContentItem, state: ItemState) => {
    if (item.tp !== 'Reel') return false
    return VIDEO_COLS.some(c => c.status === (state.status ?? item.s))
  }, [])

  const designFilter = useCallback((item: ContentItem, state: ItemState) => {
    if (item.tp === 'Reel') return false
    return DESIGN_COLS.some(c => c.status === (state.status ?? item.s))
  }, [])

  const socialFilter = useCallback((_: ContentItem, state: ItemState) => {
    return SOCIAL_COLS.some(c => c.status === state.status)
  }, [])

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Sub-tab header ── */}
      <Box sx={{
        px: 2, pt: 1.2, pb: 0, borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0,
        display: 'flex', alignItems: 'flex-end', gap: 2,
      }}>
        <Typography sx={{ fontWeight: 900, fontSize: '0.82rem', color: 'primary.main', mb: 1.2 }}>
          Produções
        </Typography>
        <Tabs
          value={subTab}
          onChange={(_, v) => setSubTab(v)}
          sx={{
            minHeight: 'unset',
            '& .MuiTabs-indicator': { bgcolor: subTab === 0 ? '#60A5FA' : subTab === 1 ? '#C084FC' : '#00C47A', height: 2 },
          }}
        >
          <Tab disableRipple label={<TabLabel emoji="🎬" label="Vídeo" count={videoCounts} color="#60A5FA" />}
            sx={{ minHeight: 40, py: 0.8, px: 1.5, textTransform: 'none', opacity: subTab === 0 ? 1 : 0.45, transition: 'opacity 0.2s' }} />
          <Tab disableRipple label={<TabLabel emoji="🎨" label="Design" count={designCounts} color="#C084FC" />}
            sx={{ minHeight: 40, py: 0.8, px: 1.5, textTransform: 'none', opacity: subTab === 1 ? 1 : 0.45, transition: 'opacity 0.2s' }} />
          <Tab disableRipple label={<TabLabel emoji="📱" label="Social" count={socialCounts} color="#00C47A" />}
            sx={{ minHeight: 40, py: 0.8, px: 1.5, textTransform: 'none', opacity: subTab === 2 ? 1 : 0.45, transition: 'opacity 0.2s' }} />
        </Tabs>

        <Box sx={{ flex: 1 }} />

        {/* Legend */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 1.2, alignItems: 'center' }}>
          {subTab === 0 && (
            <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.22)', lineHeight: 1.5 }}>
              Mova para "Aprov. interna" → aparece no Kanban geral
            </Typography>
          )}
          {subTab === 1 && (
            <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.22)', lineHeight: 1.5 }}>
              Aprovado interna → Kanban geral · Reprovado pelo cliente → coluna Reprovado · Aprovado pelo cliente → Produzido
            </Typography>
          )}
          {subTab === 2 && (
            <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.22)', lineHeight: 1.5 }}>
              Visão do fluxo Social: aprovação interna → cliente → publicação
            </Typography>
          )}
        </Box>
      </Box>

      {/* ── Board area ── */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden', p: 1.5, pb: 3 }}>
        <Box sx={{ height: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
          {subTab === 0 && (
            <MiniKanban
              items={items} states={states} onStatusChange={onStatusChange}
              columns={VIDEO_COLS} filter={videoFilter}
            />
          )}
          {subTab === 1 && (
            <MiniKanban
              items={items} states={states} onStatusChange={onStatusChange}
              columns={DESIGN_COLS} filter={designFilter}
            />
          )}
          {subTab === 2 && (
            <MiniKanban
              items={items} states={states} onStatusChange={onStatusChange}
              columns={SOCIAL_COLS} filter={socialFilter}
            />
          )}
        </Box>
      </Box>
    </Box>
  )
}
