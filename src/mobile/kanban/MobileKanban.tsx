import { useMemo, useState, useEffect, useRef, type TouchEvent } from 'react'
import { Box, Typography, InputBase } from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, useDroppable,
  pointerWithin, closestCenter, type CollisionDetection,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import type { ContentItem, ItemState, Status, Client } from '../../types'
import { STATUS_CONFIG, isOpenStatus } from '../../types'
import { DS } from '../../theme'
import { syncToCloud } from '../../lib/storage'
import { haptic } from '../system/haptics'
import { spring } from '../system/motion'
import BottomSheet from '../system/BottomSheet'
import KanbanColumn from './KanbanColumn'
import MobileCard from './MobileCard'
import CardDetailSheet from './CardDetailSheet'
import MoreFiltersSheet from './MoreFiltersSheet'
import SendSocialSheet from './SendSocialSheet'
import ReadySheet from './ReadySheet'
import MobileApprovalCenter from '../approvals/MobileApprovalCenter'
import { useReadyEsteira } from '../../lib/useReadyEsteira'
import { useDriveInbox, type DriveVideo } from '../../lib/useDriveInbox'
import { isImageFile, markFileLinked } from '../../lib/driveInbox'
import { getCardPreview, upsertMediaLink } from '../../lib/mediaLinks'
import { useMediaLinks } from '../../lib/useMediaLinks'
import { validateMediaPreview } from '../../lib/readyAutomation'
import {
  EMPTY_FILTERS, PRESET_FILTERS, makePredicate, countActive,
  loadSavedFilters, persistSavedFilters, QUICK_DEFS,
  type KanbanFilters, type SavedFilter,
} from './filters'
import { loadVip, persistVip } from './smartCard'

type ProductionView = 'overview' | 'kanban' | 'inbox' | 'approvals'
type InboxFilter = 'new' | 'processing' | 'linked' | 'all'

interface BoardDef {
  key: string; label: string; emoji: string; color: string
  cols: Status[]; filter: (item: ContentItem) => boolean
}

const FULL_FLOW: Status[] = [0, 1, 8, 2, 6, 3, 4, 5, 7]
const BOARDS: BoardDef[] = [
  { key: 'vid', label: 'Vídeo', emoji: '🎬', color: DS.blueSoft, cols: FULL_FLOW, filter: (i) => i.tp === 'Reel' },
  { key: 'des', label: 'Design', emoji: '🎨', color: DS.violet, cols: FULL_FLOW, filter: (i) => i.tp === 'Post' || i.tp === 'Story' || i.tp === 'Carrossel' },
  { key: 'fed', label: 'Feed', emoji: '📸', color: DS.accent, cols: FULL_FLOW, filter: (i) => i.tp === 'Feed' },
  { key: 'soc', label: 'Social', emoji: '📱', color: DS.green, cols: [2, 6, 3, 4, 5, 7], filter: () => true },
]

const SUBTABS: { key: ProductionView; label: string }[] = [
  { key: 'overview', label: 'Visão geral' },
  { key: 'kanban', label: 'Kanban' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'approvals', label: 'Aprovações' },
]

interface Props {
  items: ContentItem[]; states: Record<number, ItemState>; now: Date; currentUser: string
  clientColors: Record<string, string>; allClients: Client[]
  onStatusChange: (id: number, s: Status) => void
  onUpdate: (id: number, patch: Partial<ItemState>) => void
  onSendToClient: (itemId: number, clientName: string, isTraffic?: boolean) => void | Promise<void>
  onBulkSendToClient?: (clientName: string, itemIds: number[]) => void | Promise<void>
  onRemindClient?: (itemId: number, clientName: string) => void
  onAppendHistory?: (id: number, action: string) => void
  onReviewNotify?: (itemId: number, clientName: string, reservedTab?: Window | null) => Promise<boolean>
}

const statusOf = (item: ContentItem, states: Record<number, ItemState>): Status => states[item.i]?.status ?? item.s
const safeSession = <T,>(key: string, fallback: T): T => {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch { return fallback }
}
const formatBytes = (bytes: number | null) => {
  if (!bytes) return '—'
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

function autoName(filters: KanbanFilters): string {
  if (filters.quick.length === 1) return QUICK_DEFS.find(q => q.key === filters.quick[0])?.label ?? 'Filtro'
  if (filters.client) return filters.client
  if (filters.responsible) return filters.responsible
  if (filters.quick.length > 1) return `${filters.quick.length} filtros`
  return 'Meu filtro'
}

function StageDropTarget({ status, active }: { status: Status; active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `mcol-${status}` })
  const cfg = STATUS_CONFIG[status]
  return (
    <Box ref={setNodeRef} sx={{
      minWidth: 88, height: 50, px: 1, borderRadius: 2.4, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.45,
      background: isOver ? `${cfg.color}22` : active ? `${cfg.color}12` : 'rgba(244,247,255,0.035)',
      border: `1px solid ${isOver ? `${cfg.color}aa` : active ? `${cfg.color}55` : 'rgba(148,163,184,0.14)'}`,
      boxShadow: isOver ? `0 0 18px ${cfg.color}44` : 'none',
      transition: 'all 0.15s ease',
    }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cfg.color }} />
      <Typography sx={{ fontSize: '0.57rem', fontWeight: 820, color: isOver ? cfg.color : DS.t2, whiteSpace: 'nowrap' }}>{cfg.shortLabel}</Typography>
    </Box>
  )
}

function Metric({ label, value, color, onClick }: { label: string; value: number; color: string; onClick?: () => void }) {
  return (
    <Box onClick={onClick} sx={{
      p: 1.35, minHeight: 82, borderRadius: 3, cursor: onClick ? 'pointer' : 'default',
      background: 'linear-gradient(145deg, rgba(18,25,39,0.9), rgba(9,14,24,0.9))',
      border: '1px solid rgba(148,163,184,0.13)', boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
      '&:active': onClick ? { transform: 'scale(0.98)' } : undefined,
    }}>
      <Typography sx={{ fontSize: '1.45rem', fontWeight: 880, letterSpacing: '-0.04em', color, lineHeight: 1 }}>{value}</Typography>
      <Typography sx={{ mt: 0.65, fontSize: '0.62rem', fontWeight: 750, color: DS.t2, lineHeight: 1.25 }}>{label}</Typography>
    </Box>
  )
}

export default function MobileKanban({
  items, states, now, currentUser, clientColors, allClients, onStatusChange, onUpdate,
  onSendToClient, onBulkSendToClient, onRemindClient, onAppendHistory, onReviewNotify,
}: Props) {
  const [boardIdx, setBoardIdx] = useState(() => safeSession('dshub-mobile-board', 0))
  const [view, setView] = useState<ProductionView>(() => safeSession('dshub-mobile-production-view', 'kanban'))
  const [stageByBoard, setStageByBoard] = useState<Record<string, number>>(() => safeSession('dshub-mobile-stages', {}))
  const [filters, setFilters] = useState<KanbanFilters>(() => safeSession('dshub-mobile-filters', EMPTY_FILTERS))
  const [search, setSearch] = useState(() => safeSession('dshub-mobile-search', ''))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeWidth, setActiveWidth] = useState<number | undefined>()
  const [overStatus, setOverStatus] = useState<Status | null>(null)
  const [detail, setDetail] = useState<ContentItem | null>(() => {
    const itemId = safeSession<number | null>('dshub-mobile-open-item', null)
    sessionStorage.removeItem('dshub-mobile-open-item')
    return itemId ? items.find(item => item.i === itemId) ?? null : null
  })
  const [approvalFocusId] = useState<number | null>(() => {
    const itemId = safeSession<number | null>('dshub-mobile-approval-item', null)
    sessionStorage.removeItem('dshub-mobile-approval-item')
    return itemId
  })
  const [moveItem, setMoveItem] = useState<ContentItem | null>(null)
  const [sendItem, setSendItem] = useState<ContentItem | null>(null)
  const [readyItem, setReadyItem] = useState<ContentItem | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [saved, setSaved] = useState<SavedFilter[]>(() => [...PRESET_FILTERS, ...loadSavedFilters()])
  const [compact, setCompact] = useState(false)
  const [feedback, setFeedback] = useState<{ msg: string; tone: 'success' | 'warning' | 'error' } | null>(null)
  const [vipClients, setVipClients] = useState<Set<string>>(() => loadVip())
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('new')
  const [linkVideo, setLinkVideo] = useState<DriveVideo | null>(null)
  const [linkSaving, setLinkSaving] = useState(false)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  const board = BOARDS[Math.min(boardIdx, BOARDS.length - 1)]
  const currentStageIndex = Math.min(stageByBoard[board.key] ?? 0, board.cols.length - 1)
  const currentStatus = board.cols[currentStageIndex]
  const clientsByName = useMemo(() => Object.fromEntries(allClients.map(c => [c.name, c])), [allClients])
  const predicate = useMemo(() => makePredicate(filters, now, currentUser, clientsByName), [filters, now, currentUser, clientsByName])
  const activeCount = countActive(filters)
  const { videos, loading: inboxLoading, pendingCount, refresh: refreshInbox } = useDriveInbox({ items })
  const mediaLinks = useMediaLinks()

  const esteira = useReadyEsteira({
    items, states, onStatusChange, onUpdateState: onUpdate, onAppendHistory, onReviewNotify, enableSweep: false,
  })

  useEffect(() => { sessionStorage.setItem('dshub-mobile-board', JSON.stringify(boardIdx)) }, [boardIdx])
  useEffect(() => { sessionStorage.setItem('dshub-mobile-production-view', JSON.stringify(view)) }, [view])
  useEffect(() => { sessionStorage.setItem('dshub-mobile-stages', JSON.stringify(stageByBoard)) }, [stageByBoard])
  useEffect(() => { sessionStorage.setItem('dshub-mobile-filters', JSON.stringify(filters)) }, [filters])
  useEffect(() => { sessionStorage.setItem('dshub-mobile-search', JSON.stringify(search)) }, [search])
  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(null), 3400)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 450, tolerance: 8 } }),
  )
  const collision: CollisionDetection = (args) => {
    const hits = pointerWithin(args)
    const colHits = hits.filter(({ id }) => String(id).startsWith('mcol-'))
    return colHits.length ? colHits : closestCenter(args)
  }

  const searchNorm = search.trim().toLocaleLowerCase('pt-BR')
  const boardItems = useMemo(() => items.filter((item) => {
    const state = states[item.i] ?? { status: item.s } as ItemState
    if (!board.filter(item) || !board.cols.includes(statusOf(item, states)) || !predicate(item, state)) return false
    const preview = getCardPreview(item, mediaLinks, state.status)
    if (filters.creative === 'missing' && preview.kind !== 'none') return false
    if (filters.creative === 'processing' && preview.kind !== 'pending') return false
    if (filters.creative === 'ready' && preview.kind !== 'ready') return false
    if (filters.approval === 'internal' && state.status !== 2) return false
    if (filters.approval === 'client' && state.status !== 4) return false
    if (filters.approval === 'adjustment' && state.status !== 6) return false
    if (filters.approval === 'approved' && state.status !== 5) return false
    if (!searchNorm) return true
    return [state.title || item.n, item.c, state.responsible, state.assignedEditor]
      .filter(Boolean).some(value => String(value).toLocaleLowerCase('pt-BR').includes(searchNorm))
  }), [items, states, board, predicate, searchNorm, mediaLinks, filters.creative, filters.approval])

  const byStatus = useMemo(() => {
    const todayMs = new Date(now).setHours(0, 0, 0, 0)
    const map: Record<number, ContentItem[]> = Object.fromEntries(board.cols.map(status => [status, []]))
    boardItems.forEach(item => { map[statusOf(item, states)]?.push(item) })
    Object.values(map).forEach(list => list.sort((a, b) => {
      const ad = new Date(a.dt).setHours(0, 0, 0, 0)
      const bd = new Date(b.dt).setHours(0, 0, 0, 0)
      const al = ad < todayMs ? 0 : 1
      const bl = bd < todayMs ? 0 : 1
      return al !== bl ? al - bl : ad - bd
    }))
    return map
  }, [boardItems, states, board, now])

  const todayMs = new Date(now).setHours(0, 0, 0, 0)
  const overdueItems = boardItems.filter(item => isOpenStatus(statusOf(item, states)) && new Date(item.dt).setHours(0, 0, 0, 0) < todayMs)
  // Central global: independe do board Vídeo/Design/Feed selecionado.
  const approvalItems = items.filter(item => [2, 3, 4, 5, 6].includes(statusOf(item, states)))
  const priorityItems = [...boardItems]
    .filter(item => isOpenStatus(statusOf(item, states)))
    .sort((a, b) => {
      const sa = states[a.i] ?? { status: a.s } as ItemState
      const sb = states[b.i] ?? { status: b.s } as ItemState
      const pa = sa.priority === 'alta' ? 0 : sa.priority === 'media' ? 1 : 2
      const pb = sb.priority === 'alta' ? 0 : sb.priority === 'media' ? 1 : 2
      return pa - pb || +new Date(a.dt) - +new Date(b.dt)
    }).slice(0, 5)

  const boardCounts = useMemo(() => BOARDS.map(candidate =>
    items.filter(item => candidate.filter(item) && isOpenStatus(statusOf(item, states))).length
  ), [items, states])
  const activeItem = activeId ? items.find(item => String(item.i) === activeId) ?? null : null

  const setStage = (index: number) => {
    const next = Math.max(0, Math.min(index, board.cols.length - 1))
    setStageByBoard(prev => ({ ...prev, [board.key]: next }))
  }
  const goStage = (delta: number) => {
    const next = currentStageIndex + delta
    if (next < 0 || next >= board.cols.length) return
    haptic('selection')
    setStage(next)
  }
  const handleSwipeStart = (event: TouchEvent<HTMLDivElement>) => {
    if (activeId || (event.target as HTMLElement).closest('[data-drag-handle], input, button')) return
    const touch = event.touches[0]
    swipeStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }
  const handleSwipeEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (!swipeStart.current || activeId) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - swipeStart.current.x
    const dy = touch.clientY - swipeStart.current.y
    swipeStart.current = null
    if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.35) goStage(dx < 0 ? 1 : -1)
  }

  const resolveTargetStatus = (overId: string): Status | null => {
    if (overId.startsWith('mcol-')) return Number(overId.replace('mcol-', '')) as Status
    const overItem = items.find(item => String(item.i) === overId)
    return overItem ? statusOf(overItem, states) : null
  }
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
    setActiveWidth(event.active.rect.current.initial?.width)
    haptic('medium')
  }
  const clearDrag = () => { setActiveId(null); setActiveWidth(undefined); setOverStatus(null) }
  const handleDragEnd = (event: DragEndEvent) => {
    const id = Number(event.active.id)
    const target = event.over ? resolveTargetStatus(String(event.over.id)) : null
    clearDrag()
    if (target === null) return
    const item = items.find(candidate => candidate.i === id)
    if (!item || statusOf(item, states) === target || !board.cols.includes(target)) return
    if (target === 4) {
      haptic('warning')
      setFeedback({ msg: 'Envio ao cliente exige confirmação. Use “Mover para…” no card.', tone: 'warning' })
      return
    }
    onStatusChange(id, target)
    setStage(board.cols.indexOf(target))
    haptic('success')
    if (target === 8) setFeedback({ msg: 'Card movido. A prévia só será enviada por uma ação manual.', tone: 'success' })
  }

  const moveTo = (item: ContentItem, target: Status) => {
    setMoveItem(null)
    if (statusOf(item, states) === target) return
    if (target === 4) { setSendItem(item); return }
    onStatusChange(item.i, target)
    setStage(Math.max(0, board.cols.indexOf(target)))
    if (target === 8) setReadyItem(item)
    haptic('success')
    setFeedback({ msg: `Movido para ${STATUS_CONFIG[target].label}.`, tone: 'success' })
  }

  const confirmSend = (item: ContentItem, obs: string) => {
    if (obs.trim()) onUpdate(item.i, { notes: obs })
    void onSendToClient(item.i, item.c)
    setSendItem(null)
    setFeedback({ msg: 'Envio confirmado.', tone: 'success' })
  }

  const toggleVip = (client: string) => {
    setVipClients(prev => {
      const next = new Set(prev)
      if (next.has(client)) next.delete(client); else next.add(client)
      persistVip(next)
      return next
    })
  }
  const saveCurrent = () => {
    const savedFilter: SavedFilter = { id: `u-${Date.now()}`, name: autoName(filters), emoji: '⭐', filters }
    const userSaved = [...loadSavedFilters(), savedFilter]
    persistSavedFilters(userSaved)
    syncToCloud('sm_mobile_saved_filters', userSaved)
    setSaved([...PRESET_FILTERS, ...userSaved])
    setFeedback({ msg: 'Filtro salvo.', tone: 'success' })
  }

  const linkInboxFile = async (video: DriveVideo, item: ContentItem) => {
    setLinkSaving(true)
    try {
      const validation = await validateMediaPreview(video.drive_file_id, video.mime_type ?? undefined)
      if (!validation.ok) throw new Error(validation.reason || 'Prévia ainda não reproduzível')
      const response = await fetch('/api/drive-videos', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drive_file_id: video.drive_file_id, status: 'linked', linked_item_id: item.i }),
      })
      if (!response.ok) throw new Error('Não foi possível salvar o vínculo')
      const url = `https://drive.google.com/file/d/${video.drive_file_id}/view`
      onUpdate(item.i, { footageLink: url, link: url })
      upsertMediaLink({
        itemId: item.i, clientId: item.c, url, fileId: `drive:${video.drive_file_id}`,
        folderStage: 'publicar', source: 'drive', confirmed: true, filename: video.filename,
      })
      markFileLinked(video.drive_file_id)
      if (statusOf(item, states) === 1) onStatusChange(item.i, 2)
      onAppendHistory?.(item.i, 'Criativo validado e vinculado pela Inbox mobile')
      setLinkVideo(null)
      void refreshInbox()
      haptic('success')
      setFeedback({ msg: 'Prévia validada e vinculada. Card enviado à revisão interna.', tone: 'success' })
    } catch (error) {
      haptic('warning')
      setFeedback({ msg: error instanceof Error ? error.message : 'Falha ao vincular o arquivo.', tone: 'error' })
    } finally {
      setLinkSaving(false)
    }
  }

  const openCard = (item: ContentItem) => {
    haptic('light')
    if (statusOf(item, states) === 8) setReadyItem(item)
    else setDetail(item)
  }

  const viewBadge = (key: ProductionView) => {
    if (key === 'overview') return overdueItems.length
    if (key === 'kanban') return boardItems.filter(item => isOpenStatus(statusOf(item, states))).length
    if (key === 'inbox') return pendingCount
    return approvalItems.length
  }

  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ flexShrink: 0, pt: 0.8, background: 'linear-gradient(180deg, rgba(12,18,30,0.98), rgba(5,9,18,0.96))', borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
        <Box sx={{ display: view === 'approvals' ? 'none' : 'flex', gap: 0.65, px: 1.5, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
          {BOARDS.map((candidate, index) => {
            const active = index === boardIdx
            return (
              <Box key={candidate.key} onClick={() => { haptic('selection'); setBoardIdx(index) }} sx={{
                minHeight: 40, px: 1.15, borderRadius: 2.4, flexShrink: 0, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 0.45,
                background: active ? `${candidate.color}16` : 'transparent',
                border: `1px solid ${active ? `${candidate.color}55` : 'transparent'}`,
              }}>
                <span style={{ fontSize: '0.78rem' }}>{candidate.emoji}</span>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 820, color: active ? candidate.color : DS.t2 }}>{candidate.label}</Typography>
                <Box sx={{ minWidth: 18, height: 18, px: 0.45, borderRadius: 9, display: 'grid', placeItems: 'center', bgcolor: active ? `${candidate.color}20` : 'rgba(244,247,255,0.055)' }}>
                  <Typography sx={{ fontSize: '0.5rem', fontWeight: 900, color: active ? candidate.color : DS.t3 }}>{boardCounts[index] > 99 ? '99+' : boardCounts[index]}</Typography>
                </Box>
              </Box>
            )
          })}
        </Box>

        <Box sx={{ display: 'flex', gap: 1.2, px: 1.7, mt: 0.4, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
          {SUBTABS.map(tab => {
            const active = view === tab.key
            const badge = viewBadge(tab.key)
            return (
              <Box key={tab.key} onClick={() => { haptic('selection'); setView(tab.key) }} sx={{
                minHeight: 39, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.45,
                borderBottom: `2px solid ${active ? DS.accent : 'transparent'}`, cursor: 'pointer',
              }}>
                <Typography sx={{ fontSize: '0.67rem', fontWeight: active ? 850 : 680, color: active ? DS.t1 : DS.t3 }}>{tab.label}</Typography>
                {badge > 0 && <Typography sx={{ fontSize: '0.5rem', fontWeight: 900, color: active ? DS.accent : DS.t3 }}>{badge > 99 ? '99+' : badge}</Typography>}
              </Box>
            )
          })}
        </Box>
      </Box>

      {view === 'kanban' && (
        <>
          <Box sx={{ flexShrink: 0, px: 1.5, pt: 0.9, pb: 0.6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
              <Box sx={{ flex: 1, minHeight: 42, px: 1.1, borderRadius: 2.5, display: 'flex', alignItems: 'center', gap: 0.7, bgcolor: 'rgba(244,247,255,0.045)', border: '1px solid rgba(148,163,184,0.14)' }}>
                <SearchRoundedIcon sx={{ fontSize: 19, color: DS.t3 }} />
                <InputBase value={search} onChange={event => setSearch(event.target.value)} placeholder="Título, cliente ou responsável" sx={{ flex: 1, fontSize: '0.76rem', color: DS.t1, '& input::placeholder': { color: DS.t3, opacity: 1 } }} />
                {search && <Typography onClick={() => setSearch('')} sx={{ px: 0.5, fontSize: '0.62rem', color: DS.t3, cursor: 'pointer' }}>Limpar</Typography>}
              </Box>
              <Box onClick={() => { haptic('light'); setFiltersOpen(true) }} role="button" aria-label="Abrir filtros" sx={{
                position: 'relative', width: 44, height: 44, borderRadius: 2.5, display: 'grid', placeItems: 'center', cursor: 'pointer',
                bgcolor: activeCount ? 'rgba(59,130,246,0.14)' : 'rgba(244,247,255,0.045)',
                border: `1px solid ${activeCount ? 'rgba(59,130,246,0.45)' : 'rgba(148,163,184,0.14)'}`,
              }}>
                <TuneRoundedIcon sx={{ fontSize: 20, color: activeCount ? DS.accent : DS.t2 }} />
                {activeCount > 0 && <Box sx={{ position: 'absolute', right: -3, top: -3, minWidth: 17, height: 17, px: 0.35, borderRadius: 9, bgcolor: DS.accent, display: 'grid', placeItems: 'center' }}><Typography sx={{ fontSize: '0.48rem', fontWeight: 900, color: '#fff' }}>{activeCount}</Typography></Box>}
              </Box>
            </Box>
          </Box>

          <DndContext sensors={sensors} collisionDetection={collision} autoScroll onDragStart={handleDragStart} onDragOver={(event: DragOverEvent) => setOverStatus(event.over ? resolveTargetStatus(String(event.over.id)) : null)} onDragEnd={handleDragEnd} onDragCancel={clearDrag}>
            <Box sx={{ flexShrink: 0, px: 1.5, pb: 0.6 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 52 }}>
                <Box onClick={() => goStage(-1)} role="button" aria-label="Etapa anterior" sx={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 2.3, opacity: currentStageIndex === 0 ? 0.3 : 1, cursor: currentStageIndex === 0 ? 'default' : 'pointer' }}><ChevronLeftRoundedIcon sx={{ color: DS.t2 }} /></Box>
                <Box sx={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_CONFIG[currentStatus].color, boxShadow: `0 0 9px ${STATUS_CONFIG[currentStatus].color}` }} />
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 880, color: DS.t1 }} noWrap>{STATUS_CONFIG[currentStatus].label}</Typography>
                    <Box sx={{ px: 0.7, py: 0.08, borderRadius: 8, bgcolor: `${STATUS_CONFIG[currentStatus].color}18` }}><Typography sx={{ fontSize: '0.56rem', fontWeight: 900, color: STATUS_CONFIG[currentStatus].color }}>{byStatus[currentStatus]?.length ?? 0}</Typography></Box>
                  </Box>
                  <Typography sx={{ mt: 0.2, fontSize: '0.53rem', color: DS.t3 }}>Deslize para navegar</Typography>
                </Box>
                <Box onClick={() => goStage(1)} role="button" aria-label="Próxima etapa" sx={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 2.3, opacity: currentStageIndex === board.cols.length - 1 ? 0.3 : 1, cursor: currentStageIndex === board.cols.length - 1 ? 'default' : 'pointer' }}><ChevronRightRoundedIcon sx={{ color: DS.t2 }} /></Box>
              </Box>

              <AnimatePresence>
                {activeId && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 58 }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                    <Box sx={{ display: 'flex', gap: 0.55, overflowX: 'auto', pb: 0.6, '&::-webkit-scrollbar': { display: 'none' } }}>
                      {board.cols.filter(status => status !== currentStatus).map(status => <StageDropTarget key={status} status={status} active={overStatus === status} />)}
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>

            <Box onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd} sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <KanbanColumn
                status={currentStatus}
                label={STATUS_CONFIG[currentStatus].label}
                color={STATUS_CONFIG[currentStatus].color}
                items={byStatus[currentStatus] ?? []}
                states={states}
                now={now}
                clientColors={clientColors}
                isOver={overStatus === currentStatus && !!activeId}
                activeId={activeId}
                compact={compact}
                vipClients={vipClients}
                onCardClick={openCard}
                onMoveClick={setMoveItem}
                scrollKey={`${board.key}:${currentStatus}`}
              />
            </Box>

            <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.16,1,0.3,1)' }}>
              {activeItem && (
                <motion.div initial={{ scale: 1 }} animate={{ scale: 1.025 }} transition={spring.snappy} style={{ width: activeWidth ?? 'calc(100vw - 28px)' }}>
                  <MobileCard item={activeItem} state={states[activeItem.i] ?? { status: activeItem.s } as ItemState} now={now} clientColor={clientColors[activeItem.c]} vip={vipClients.has(activeItem.c)} overlay />
                </motion.div>
              )}
            </DragOverlay>
          </DndContext>
        </>
      )}

      {view === 'overview' && (
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pt: 1.2, pb: 10, overscrollBehavior: 'contain' }}>
          <Typography sx={{ fontSize: '0.58rem', fontWeight: 850, letterSpacing: '0.09em', textTransform: 'uppercase', color: DS.accent }}>Pulso da produção</Typography>
          <Typography sx={{ mt: 0.25, fontSize: '1.05rem', fontWeight: 850, color: DS.t1 }}>O que precisa andar agora</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.8, mt: 1.2 }}>
            <Metric label="Em produção" value={byStatus[1]?.length ?? 0} color={STATUS_CONFIG[1].color} onClick={() => { setStage(board.cols.indexOf(1)); setView('kanban') }} />
            <Metric label="Revisão interna" value={byStatus[2]?.length ?? 0} color={STATUS_CONFIG[2].color} onClick={() => { setStage(board.cols.indexOf(2)); setView('kanban') }} />
            <Metric label="Atrasados" value={overdueItems.length} color={DS.red} onClick={() => { setFilters({ ...EMPTY_FILTERS, quick: ['atrasados'] }); setView('kanban') }} />
            <Metric label="Para publicar" value={byStatus[5]?.length ?? 0} color={DS.green} onClick={() => { setStage(board.cols.indexOf(5)); setView('kanban') }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'end', mt: 2, mb: 0.9 }}>
            <Box>
              <Typography sx={{ fontSize: '0.58rem', fontWeight: 850, letterSpacing: '0.08em', textTransform: 'uppercase', color: DS.t3 }}>Prioridade operacional</Typography>
              <Typography sx={{ fontSize: '0.88rem', fontWeight: 820, color: DS.t1 }}>Até 5 cards de maior impacto</Typography>
            </Box>
            <Box sx={{ flex: 1 }} />
            <Typography onClick={() => setView('kanban')} sx={{ fontSize: '0.62rem', fontWeight: 800, color: DS.accent, cursor: 'pointer' }}>Ver Kanban</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.9 }}>
            {priorityItems.map(item => <MobileCard key={item.i} item={item} state={states[item.i] ?? { status: item.s } as ItemState} now={now} clientColor={clientColors[item.c]} vip={vipClients.has(item.c)} onClick={() => openCard(item)} onMove={() => setMoveItem(item)} />)}
            {!priorityItems.length && <Typography sx={{ py: 4, textAlign: 'center', fontSize: '0.75rem', color: DS.t3 }}>Nenhuma prioridade pendente.</Typography>}
          </Box>
        </Box>
      )}

      {view === 'approvals' && (
        <MobileApprovalCenter
          initialItemId={approvalFocusId}
          items={items}
          states={states}
          now={now}
          clientColors={clientColors}
          onStatusChange={onStatusChange}
          onSendToClient={onSendToClient}
          onBulkSendToClient={onBulkSendToClient}
          onReviewNotify={onReviewNotify}
          onRemindClient={onRemindClient}
          onAppendHistory={onAppendHistory}
          onOpenCard={openCard}
        />
      )}

      {view === 'inbox' && (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 1.5, pt: 1, pb: 0.8, flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: '0.58rem', fontWeight: 850, letterSpacing: '0.09em', textTransform: 'uppercase', color: DS.accent }}>Drive Inbox</Typography>
                <Typography sx={{ fontSize: '0.92rem', fontWeight: 840, color: DS.t1 }}>{pendingCount} arquivos pedem decisão</Typography>
              </Box>
              <Box sx={{ flex: 1 }} />
              <Box onClick={() => void refreshInbox()} role="button" aria-label="Atualizar Inbox" sx={{ width: 44, height: 44, borderRadius: 2.3, display: 'grid', placeItems: 'center', cursor: 'pointer', bgcolor: 'rgba(244,247,255,0.04)', border: '1px solid rgba(148,163,184,0.14)' }}><RefreshRoundedIcon sx={{ fontSize: 19, color: DS.t2 }} /></Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.6, mt: 0.9, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
              {(['new', 'processing', 'linked', 'all'] as InboxFilter[]).map(key => {
                const labels = { new: 'Novos', processing: 'Processando', linked: 'Vinculados', all: 'Todos' }
                return <Box key={key} onClick={() => setInboxFilter(key)} sx={{ minHeight: 36, px: 1.1, borderRadius: 2, display: 'flex', alignItems: 'center', flexShrink: 0, cursor: 'pointer', bgcolor: inboxFilter === key ? 'rgba(59,130,246,0.14)' : 'rgba(244,247,255,0.035)', border: `1px solid ${inboxFilter === key ? 'rgba(59,130,246,0.42)' : 'rgba(148,163,184,0.12)'}` }}><Typography sx={{ fontSize: '0.62rem', fontWeight: 780, color: inboxFilter === key ? DS.accent : DS.t2 }}>{labels[key]}</Typography></Box>
              })}
            </Box>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1.5, pb: 10 }}>
            {inboxLoading && <Typography sx={{ py: 4, textAlign: 'center', fontSize: '0.72rem', color: DS.t3 }}>Atualizando arquivos…</Typography>}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.85 }}>
              {videos.filter(video => {
                if (inboxFilter === 'new') return video.status === 'inbox'
                if (inboxFilter === 'processing') return video.preview_status === 'processing'
                if (inboxFilter === 'linked') return video.status === 'linked'
                return true
              }).map(video => (
                <Box key={video.drive_file_id} sx={{ display: 'flex', gap: 1, p: 1, borderRadius: 3, bgcolor: 'rgba(15,22,35,0.92)', border: '1px solid rgba(148,163,184,0.13)' }}>
                  <Box sx={{ width: 76, minHeight: 76, flexShrink: 0, borderRadius: 2.2, overflow: 'hidden', bgcolor: 'rgba(244,247,255,0.04)', display: 'grid', placeItems: 'center' }}>
                    {video.thumbnail_url ? <Box component="img" src={video.thumbnail_url} alt="" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Typography sx={{ fontSize: '1.25rem' }}>{isImageFile(video) ? '🖼️' : '🎬'}</Typography>}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: DS.t1, lineHeight: 1.25 }} noWrap>{video.filename}</Typography>
                    <Typography sx={{ mt: 0.25, fontSize: '0.6rem', fontWeight: 700, color: DS.blueSoft }} noWrap>{video.client_name || 'Cliente não identificado'}</Typography>
                    <Typography sx={{ mt: 0.2, fontSize: '0.54rem', color: DS.t3 }}>{formatBytes(video.file_size_bytes)} · {new Date(video.detected_at).toLocaleDateString('pt-BR')}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.55, mt: 0.7 }}>
                      <Box component="a" href={`https://drive.google.com/file/d/${video.drive_file_id}/view`} target="_blank" rel="noopener" sx={{ minHeight: 32, px: 0.9, borderRadius: 1.8, display: 'flex', alignItems: 'center', textDecoration: 'none', bgcolor: 'rgba(244,247,255,0.045)', border: '1px solid rgba(148,163,184,0.14)' }}><Typography sx={{ fontSize: '0.56rem', fontWeight: 750, color: DS.t2 }}>Abrir Drive</Typography></Box>
                      {video.status !== 'linked' && <Box onClick={() => setLinkVideo(video)} sx={{ minHeight: 32, px: 0.9, borderRadius: 1.8, display: 'flex', alignItems: 'center', cursor: 'pointer', bgcolor: 'rgba(59,130,246,0.14)', border: '1px solid rgba(59,130,246,0.35)' }}><Typography sx={{ fontSize: '0.56rem', fontWeight: 820, color: DS.accent }}>Vincular</Typography></Box>}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}

      <AnimatePresence>
        {feedback && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} style={{ position: 'absolute', left: 14, right: 14, bottom: 78, zIndex: 30, pointerEvents: 'none' }}>
            <Box sx={{ px: 1.3, py: 1.05, borderRadius: 2.5, bgcolor: 'rgba(12,18,30,0.96)', border: `1px solid ${feedback.tone === 'error' ? 'rgba(239,68,68,0.45)' : feedback.tone === 'warning' ? 'rgba(245,158,11,0.45)' : 'rgba(49,209,124,0.42)'}`, boxShadow: '0 16px 38px rgba(0,0,0,0.4)' }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 760, color: DS.t1 }}>{feedback.msg}</Typography>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

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
        onRequestMove={(selected) => { setDetail(null); setMoveItem(selected) }}
        onRequestSend={(selected) => { setDetail(null); setSendItem(selected) }}
      />

      <ReadySheet
        key={readyItem?.i ?? 'none'}
        item={readyItem}
        title={readyItem ? (states[readyItem.i]?.title || readyItem.n) : undefined}
        ready={readyItem ? esteira.readyStates[readyItem.i] : undefined}
        onClose={() => setReadyItem(null)}
        onSend={() => { if (readyItem) { esteira.handleSendReadyToReview(readyItem.i); setReadyItem(null) } }}
        onRetry={() => { if (readyItem) esteira.handleRetryReady(readyItem.i) }}
        onBackToProduction={() => { if (readyItem) { onStatusChange(readyItem.i, 1); setReadyItem(null) } }}
        listCandidates={() => readyItem ? esteira.listCandidates(readyItem.i) : Promise.resolve({ files: [] })}
        onPick={file => { if (readyItem) { void esteira.linkFileManually(readyItem.i, file); setReadyItem(null) } }}
      />

      <MoreFiltersSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} filters={filters} onChange={setFilters} clients={allClients} onClear={() => setFilters(EMPTY_FILTERS)} />

      <MoveSheet item={moveItem} state={moveItem ? (states[moveItem.i] ?? { status: moveItem.s } as ItemState) : null} statuses={board.cols} onClose={() => setMoveItem(null)} onMove={target => { if (moveItem) moveTo(moveItem, target) }} />

      <SendSocialSheet
        key={sendItem?.i ?? 'none'}
        item={sendItem}
        state={sendItem ? (states[sendItem.i] ?? { status: sendItem.s } as ItemState) : null}
        onCancel={() => setSendItem(null)}
        onConfirm={confirmSend}
      />

      <InboxLinkSheet
        key={linkVideo?.drive_file_id ?? 'none'}
        video={linkVideo}
        items={items}
        states={states}
        saving={linkSaving}
        onClose={() => !linkSaving && setLinkVideo(null)}
        onPick={item => { if (linkVideo) void linkInboxFile(linkVideo, item) }}
      />

      {activeCount > 0 && view === 'kanban' && saved.length >= 0 && (
        <Box onClick={saveCurrent} sx={{ display: 'none' }} />
      )}
    </Box>
  )
}

function MoveSheet({ item, state, statuses, onClose, onMove }: { item: ContentItem | null; state: ItemState | null; statuses: Status[]; onClose: () => void; onMove: (status: Status) => void }) {
  return (
    <BottomSheet open={!!item && !!state} onClose={onClose} title={<Typography sx={{ fontSize: '0.96rem', fontWeight: 850, color: DS.t1 }}>Mover para…</Typography>}>
      <Box sx={{ px: 2, pb: 2, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.75 }}>
        {statuses.map(status => {
          const cfg = STATUS_CONFIG[status]
          const active = state?.status === status
          return <Box key={status} onClick={() => !active && onMove(status)} sx={{ minHeight: 52, px: 1, borderRadius: 2.4, display: 'flex', alignItems: 'center', gap: 0.7, cursor: active ? 'default' : 'pointer', opacity: active ? 0.55 : 1, bgcolor: active ? `${cfg.color}16` : 'rgba(244,247,255,0.035)', border: `1px solid ${active ? `${cfg.color}55` : 'rgba(148,163,184,0.14)'}`, '&:active': active ? undefined : { transform: 'scale(0.97)' } }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cfg.color }} />
            <Typography sx={{ fontSize: '0.64rem', fontWeight: 780, color: active ? cfg.color : DS.t1, lineHeight: 1.2 }}>{cfg.label}</Typography>
          </Box>
        })}
      </Box>
    </BottomSheet>
  )
}

function InboxLinkSheet({ video, items, states, saving, onClose, onPick }: { video: DriveVideo | null; items: ContentItem[]; states: Record<number, ItemState>; saving: boolean; onClose: () => void; onPick: (item: ContentItem) => void }) {
  const [query, setQuery] = useState('')
  const candidates = useMemo(() => {
    if (!video) return []
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    return items.filter(item => item.c === video.client_name).filter(item => {
      if (!normalized) return true
      return (states[item.i]?.title || item.n).toLocaleLowerCase('pt-BR').includes(normalized)
    }).sort((a, b) => Number(statusOf(a, states) !== 1) - Number(statusOf(b, states) !== 1)).slice(0, 30)
  }, [video, items, states, query])

  return (
    <BottomSheet open={!!video} onClose={onClose} title={<Box><Typography sx={{ fontSize: '0.94rem', fontWeight: 850, color: DS.t1 }}>Vincular criativo</Typography><Typography sx={{ mt: 0.2, fontSize: '0.6rem', color: DS.t3 }} noWrap>{video?.filename}</Typography></Box>}>
      <Box sx={{ px: 2, pb: 2 }}>
        <Box sx={{ minHeight: 42, px: 1.1, mb: 1, borderRadius: 2.3, display: 'flex', alignItems: 'center', gap: 0.6, bgcolor: 'rgba(244,247,255,0.04)', border: '1px solid rgba(148,163,184,0.14)' }}>
          <SearchRoundedIcon sx={{ fontSize: 18, color: DS.t3 }} />
          <InputBase value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar card do cliente" disabled={saving} sx={{ flex: 1, fontSize: '0.76rem', color: DS.t1 }} />
        </Box>
        <Typography sx={{ mb: 0.8, fontSize: '0.6rem', color: DS.t3 }}>A prévia será validada antes do vínculo. Nenhum WhatsApp será aberto.</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.65, maxHeight: '48dvh', overflowY: 'auto' }}>
          {candidates.map(item => {
            const cfg = STATUS_CONFIG[statusOf(item, states)]
            return <Box key={item.i} onClick={() => !saving && onPick(item)} sx={{ minHeight: 54, px: 1.1, py: 0.7, borderRadius: 2.3, display: 'flex', alignItems: 'center', gap: 0.8, cursor: saving ? 'wait' : 'pointer', bgcolor: 'rgba(244,247,255,0.035)', border: '1px solid rgba(148,163,184,0.12)' }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: cfg.color }} />
              <Box sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ fontSize: '0.7rem', fontWeight: 780, color: DS.t1 }} noWrap>{states[item.i]?.title || item.n}</Typography><Typography sx={{ fontSize: '0.55rem', color: DS.t3 }}>{cfg.label}</Typography></Box>
              <Typography sx={{ fontSize: '0.56rem', fontWeight: 800, color: DS.accent }}>{saving ? 'Validando…' : 'Vincular'}</Typography>
            </Box>
          })}
        </Box>
      </Box>
    </BottomSheet>
  )
}
