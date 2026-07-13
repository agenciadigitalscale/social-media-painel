import { useMemo, useState, useEffect } from 'react'
import { Box, Typography, InputBase } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
  pointerWithin, closestCenter, type CollisionDetection,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import type { ContentItem, ItemState, Status, ContentType, Client } from '../../types'
import { STATUS_CONFIG } from '../../types'
import { DS, typeColor } from '../../theme'
import { syncToCloud } from '../../lib/storage'
import { haptic } from '../system/haptics'
import { spring } from '../system/motion'
import BottomSheet from '../system/BottomSheet'
import KanbanColumn from './KanbanColumn'
import MobileCard from './MobileCard'
import CardDetailSheet from './CardDetailSheet'
import FilterBar from './FilterBar'
import MoreFiltersSheet from './MoreFiltersSheet'
import SendSocialSheet from './SendSocialSheet'
import {
  EMPTY_FILTERS, PRESET_FILTERS, makePredicate, toggleQuick, countActive,
  loadSavedFilters, persistSavedFilters, QUICK_DEFS,
  type KanbanFilters, type QuickKey, type SavedFilter,
} from './filters'
import { loadVip, persistVip } from './smartCard'

interface BoardDef {
  key: string; label: string; emoji: string; color: string
  cols: Status[]; filter: (item: ContentItem) => boolean
}

const BOARDS: BoardDef[] = [
  { key: 'vid', label: 'Vídeo',  emoji: '🎬', color: DS.blueSoft, cols: [0, 1, 2, 6],       filter: (i) => i.tp === 'Reel' },
  { key: 'des', label: 'Design', emoji: '🎨', color: DS.violet,   cols: [0, 1, 2, 6],       filter: (i) => i.tp === 'Post' || i.tp === 'Story' || i.tp === 'Carrossel' },
  { key: 'fed', label: 'Feed',   emoji: '📸', color: DS.orange,   cols: [0, 1, 2, 6],       filter: (i) => i.tp === 'Feed' },
  { key: 'soc', label: 'Social', emoji: '📱', color: DS.green,    cols: [2, 3, 4, 6, 5, 7], filter: () => true },
]

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
  currentUser: string
  clientColors: Record<string, string>
  allClients: Client[]
  onStatusChange: (id: number, s: Status) => void
  onUpdate: (id: number, patch: Partial<ItemState>) => void
  onSendToClient: (itemId: number, clientName: string, isTraffic?: boolean) => void | Promise<void>
  onAddItem?: (clientName: string, title: string, type: ContentType, date: Date, status: Status) => void
}

const statusOf = (item: ContentItem, states: Record<number, ItemState>): Status => states[item.i]?.status ?? item.s

function autoName(f: KanbanFilters): string {
  if (f.quick.length === 1) return QUICK_DEFS.find(q => q.key === f.quick[0])?.label ?? 'Filtro'
  if (f.client) return f.client
  if (f.responsible) return f.responsible
  if (f.quick.length > 1) return `${f.quick.length} filtros`
  return 'Meu filtro'
}

export default function MobileKanban({ items, states, now, currentUser, clientColors, allClients, onStatusChange, onUpdate, onSendToClient, onAddItem }: Props) {
  const [boardIdx, setBoardIdx] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeWidth, setActiveWidth] = useState<number | undefined>(undefined)
  const [overStatus, setOverStatus] = useState<Status | null>(null)
  const [detail, setDetail] = useState<ContentItem | null>(null)
  const [sendItem, setSendItem] = useState<ContentItem | null>(null)

  const [filters, setFilters] = useState<KanbanFilters>(EMPTY_FILTERS)
  const [moreOpen, setMoreOpen] = useState(false)
  const [saved, setSaved] = useState<SavedFilter[]>([])
  const [compact, setCompact] = useState(false)
  const [focus, setFocus] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [vipClients, setVipClients] = useState<Set<string>>(() => loadVip())

  useEffect(() => { setSaved([...PRESET_FILTERS, ...loadSavedFilters()]) }, [])

  const toggleVip = (client: string) => {
    setVipClients((prev) => {
      const next = new Set(prev)
      if (next.has(client)) next.delete(client); else next.add(client)
      persistVip(next)
      return next
    })
  }

  const board = BOARDS[boardIdx]
  const clientsByName = useMemo(() => Object.fromEntries(allClients.map(c => [c.name, c])), [allClients])
  const predicate = useMemo(() => makePredicate(filters, now, currentUser, clientsByName), [filters, now, currentUser, clientsByName])
  const activeCount = countActive(filters)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  const collision: CollisionDetection = (args) => {
    const hits = pointerWithin(args)
    const colHits = hits.filter(({ id }) => String(id).startsWith('mcol-'))
    if (colHits.length > 0) return colHits
    return closestCenter(args)
  }

  const boardItems = useMemo(
    () => items.filter((i) => {
      const s = states[i.i] ?? { status: i.s } as ItemState
      return board.filter(i) && board.cols.includes(statusOf(i, states)) && predicate(i, s)
    }),
    [items, states, board, predicate],
  )

  const byStatus = useMemo(() => {
    const todayMs = new Date(now).setHours(0, 0, 0, 0)
    const map: Record<number, ContentItem[]> = {}
    board.cols.forEach((s) => { map[s] = [] })
    boardItems.forEach((i) => { map[statusOf(i, states)]?.push(i) })
    Object.keys(map).forEach((k) => {
      map[Number(k)].sort((a, b) => {
        const am = new Date(a.dt).setHours(0, 0, 0, 0)
        const bm = new Date(b.dt).setHours(0, 0, 0, 0)
        const al = am < todayMs ? 0 : 1
        const bl = bm < todayMs ? 0 : 1
        return al !== bl ? al - bl : am - bm
      })
    })
    return map
  }, [boardItems, states, board, now])

  const activeItem = activeId ? items.find((i) => String(i.i) === activeId) ?? null : null

  const resolveTargetStatus = (overId: string): Status | null => {
    if (overId.startsWith('mcol-')) return Number(overId.replace('mcol-', '')) as Status
    const overItem = items.find((i) => String(i.i) === overId)
    return overItem ? statusOf(overItem, states) : null
  }

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
    setActiveWidth(e.active.rect.current.initial?.width)
    haptic('medium')
  }
  const handleDragOver = (e: DragOverEvent) => { setOverStatus(e.over ? resolveTargetStatus(String(e.over.id)) : null) }
  const handleDragEnd = (e: DragEndEvent) => {
    const id = Number(e.active.id)
    const over = e.over ? resolveTargetStatus(String(e.over.id)) : null
    setActiveId(null); setActiveWidth(undefined); setOverStatus(null)
    if (over === null) return
    const item = items.find((i) => i.i === id)
    if (!item) return
    if (statusOf(item, states) === over) return
    if (!board.cols.includes(over)) return
    if (over === 4) { haptic('medium'); setSendItem(item); return }
    haptic('success')
    onStatusChange(id, over)
  }

  const applySaved = (sf: SavedFilter) => setFilters(sf.filters)
  const saveCurrent = () => {
    const sf: SavedFilter = { id: `u-${Date.now()}`, name: autoName(filters), emoji: '⭐', filters }
    const userSaved = [...loadSavedFilters(), sf]
    persistSavedFilters(userSaved)
    syncToCloud('sm_mobile_saved_filters', userSaved)
    setSaved([...PRESET_FILTERS, ...userSaved])
  }

  const confirmSend = (item: ContentItem, obs: string) => {
    if (obs.trim()) onUpdate(item.i, { notes: obs })
    void onSendToClient(item.i, item.c)
    setSendItem(null)
  }

  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* seletor de board — oculto no modo foco */}
      {!focus && (
        <Box sx={{ display: 'flex', gap: 0.8, px: 1.6, pt: 1, pb: 0.4, overflowX: 'auto', flexShrink: 0, '&::-webkit-scrollbar': { display: 'none' } }}>
          {BOARDS.map((b, i) => {
            const active = i === boardIdx
            return (
              <Box key={b.key} onClick={() => { haptic('selection'); setBoardIdx(i) }}
                sx={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5, px: 1.4, py: 0.7, borderRadius: 2.5, cursor: 'pointer',
                  background: active ? `${b.color}1e` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? `${b.color}66` : DS.border}`,
                  boxShadow: active ? `0 0 14px ${b.color}33` : 'none',
                  transition: 'transform 0.12s', '&:active': { transform: 'scale(0.95)' },
                }}>
                <span style={{ fontSize: '0.86rem' }}>{b.emoji}</span>
                <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: active ? b.color : DS.t2 }}>{b.label}</Typography>
              </Box>
            )
          })}
        </Box>
      )}

      <FilterBar
        filters={filters}
        onToggleQuick={(k: QuickKey) => setFilters((f) => toggleQuick(f, k))}
        onOpenMore={() => setMoreOpen(true)}
        saved={saved}
        onApplySaved={applySaved}
        onSaveCurrent={saveCurrent}
        activeCount={activeCount}
        compact={compact}
        onToggleCompact={() => setCompact((c) => !c)}
        focus={focus}
        onToggleFocus={() => setFocus((f) => !f)}
      />

      {/* blur do fundo durante o drag (nunca no card) */}
      <AnimatePresence>
        {activeId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', background: 'rgba(8,9,14,0.28)' }}
          />
        )}
      </AnimatePresence>

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => { setActiveId(null); setActiveWidth(undefined); setOverStatus(null) }}
      >
        <Box sx={{
          flex: 1, minHeight: 0, position: 'relative', zIndex: 2, display: 'flex', gap: 1.4, px: 1.6, pt: 1, pb: 1.6,
          overflowX: 'auto', scrollSnapType: activeId ? 'none' : 'x proximity', WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
          '&::-webkit-scrollbar': { display: 'none' },
        }}>
          {board.cols.map((s) => (
            <KanbanColumn
              key={s}
              status={s}
              label={STATUS_CONFIG[s].shortLabel}
              color={STATUS_CONFIG[s].color}
              items={byStatus[s] ?? []}
              states={states}
              now={now}
              clientColors={clientColors}
              isOver={overStatus === s && !!activeId}
              activeId={activeId}
              compact={compact}
              vipClients={vipClients}
              onCardClick={(item) => { haptic('light'); setDetail(item) }}
            />
          ))}
        </Box>

        <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.16,1,0.3,1)' }}>
          {activeItem && (
            <motion.div initial={{ scale: 1 }} animate={{ scale: 1.04, rotate: 2 }} transition={spring.snappy} style={{ width: activeWidth ?? '84vw' }}>
              <MobileCard item={activeItem} state={states[activeItem.i] ?? { status: activeItem.s } as ItemState} now={now} clientColor={clientColors[activeItem.c]} vip={vipClients.has(activeItem.c)} overlay />
            </motion.div>
          )}
        </DragOverlay>
      </DndContext>

      {/* FAB novo vídeo */}
      {onAddItem && (
        <Box
          onClick={() => { haptic('light'); setAddOpen(true) }}
          sx={{
            position: 'absolute', right: 16, bottom: 16, zIndex: 5,
            width: 52, height: 52, borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${DS.orange}, #ff5339)`,
            boxShadow: '0 8px 24px rgba(249,115,22,0.4)',
            '&:active': { transform: 'scale(0.9)' }, transition: 'transform 0.15s',
          }}
        >
          <AddIcon sx={{ fontSize: 26, color: '#000' }} />
        </Box>
      )}

      <CardDetailSheet
        item={detail}
        state={detail ? (states[detail.i] ?? { status: detail.s } as ItemState) : null}
        now={now}
        currentUser={currentUser}
        clientColor={detail ? clientColors[detail.c] : undefined}
        vip={detail ? vipClients.has(detail.c) : false}
        onToggleVip={() => { if (detail) toggleVip(detail.c) }}
        onClose={() => setDetail(null)}
        onStatusChange={onStatusChange}
        onUpdate={onUpdate}
      />

      <MoreFiltersSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        filters={filters}
        onChange={setFilters}
        clients={allClients}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />

      <SendSocialSheet
        item={sendItem}
        state={sendItem ? (states[sendItem.i] ?? { status: sendItem.s } as ItemState) : null}
        onCancel={() => setSendItem(null)}
        onConfirm={confirmSend}
      />

      <QuickAddSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        clients={allClients}
        defaultType={board.key === 'vid' ? 'Reel' : board.key === 'fed' ? 'Feed' : 'Post'}
        now={now}
        onAdd={(client, title, type) => { onAddItem?.(client, title, type, new Date(now), 0); setAddOpen(false); haptic('success') }}
      />
    </Box>
  )
}

// ── Quick add (novo vídeo) ─────────────────────────────────
function QuickAddSheet({ open, onClose, clients, defaultType, onAdd }: {
  open: boolean; onClose: () => void; clients: Client[]; defaultType: ContentType; now: Date
  onAdd: (client: string, title: string, type: ContentType) => void
}) {
  const [client, setClient] = useState('')
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ContentType>(defaultType)
  useEffect(() => { if (open) { setClient(''); setTitle(''); setType(defaultType) } }, [open, defaultType])
  const valid = client && title.trim()
  const TYPES: ContentType[] = ['Reel', 'Post', 'Story', 'Carrossel', 'Feed']

  return (
    <BottomSheet open={open} onClose={onClose} title={<Typography sx={{ fontSize: '0.98rem', fontWeight: 800, color: DS.t1 }}>Novo conteúdo</Typography>}>
      <Box sx={{ px: 2.2, pb: 2 }}>
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: DS.t3, mb: 0.8 }}>Cliente</Typography>
        <Box sx={{ display: 'flex', gap: 0.7, overflowX: 'auto', pb: 1.5, '&::-webkit-scrollbar': { display: 'none' } }}>
          {clients.map((c) => (
            <Box key={c.name} onClick={() => { haptic('selection'); setClient(c.name) }}
              sx={{ flexShrink: 0, px: 1.2, py: 0.6, borderRadius: 2, cursor: 'pointer', background: client === c.name ? `${DS.orange}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${client === c.name ? `${DS.orange}77` : DS.border}` }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: client === c.name ? DS.orange : DS.t2, whiteSpace: 'nowrap' }}>{c.name}</Typography>
            </Box>
          ))}
        </Box>

        <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: DS.t3, mb: 0.8 }}>Tipo</Typography>
        <Box sx={{ display: 'flex', gap: 0.7, pb: 1.5, flexWrap: 'wrap' }}>
          {TYPES.map((t) => (
            <Box key={t} onClick={() => { haptic('selection'); setType(t) }}
              sx={{ px: 1.2, py: 0.6, borderRadius: 2, cursor: 'pointer', background: type === t ? `${typeColor(t)}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${type === t ? `${typeColor(t)}77` : DS.border}` }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: type === t ? typeColor(t) : DS.t2 }}>{t}</Typography>
            </Box>
          ))}
        </Box>

        <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: DS.t3, mb: 0.8 }}>Título</Typography>
        <InputBase value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do conteúdo…"
          sx={{ width: '100%', fontSize: '0.85rem', color: DS.t1, px: 1.4, py: 1, borderRadius: 2.5, background: 'rgba(255,255,255,0.04)', border: `1px solid ${DS.border}`, mb: 2 }} />

        <Box onClick={() => { if (valid) onAdd(client, title.trim(), type) }}
          sx={{ textAlign: 'center', py: 1.4, borderRadius: 2.5, cursor: valid ? 'pointer' : 'default', background: valid ? `linear-gradient(135deg, ${DS.orange}, #ff5339)` : 'rgba(255,255,255,0.06)', opacity: valid ? 1 : 0.5, boxShadow: valid ? '0 6px 20px rgba(249,115,22,0.32)' : 'none' }}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: valid ? '#000' : DS.t3 }}>Adicionar</Typography>
        </Box>
      </Box>
    </BottomSheet>
  )
}
