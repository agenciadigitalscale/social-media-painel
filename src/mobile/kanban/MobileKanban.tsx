import { useMemo, useState } from 'react'
import { Box, Typography } from '@mui/material'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
  pointerWithin, closestCenter, type CollisionDetection,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import type { ContentItem, ItemState, Status } from '../../types'
import { STATUS_CONFIG } from '../../types'
import { DS } from '../../theme'
import { haptic } from '../system/haptics'
import { spring } from '../system/motion'
import BottomSheet from '../system/BottomSheet'
import KanbanColumn from './KanbanColumn'
import MobileCard from './MobileCard'
import CardDetailSheet from './CardDetailSheet'

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
  onStatusChange: (id: number, s: Status) => void
  onUpdate: (id: number, patch: Partial<ItemState>) => void
  onSendToClient: (itemId: number, clientName: string, isTraffic?: boolean) => void | Promise<void>
}

const statusOf = (item: ContentItem, states: Record<number, ItemState>): Status => states[item.i]?.status ?? item.s

export default function MobileKanban({ items, states, now, currentUser, clientColors, onStatusChange, onUpdate, onSendToClient }: Props) {
  const [boardIdx, setBoardIdx] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overStatus, setOverStatus] = useState<Status | null>(null)
  const [detail, setDetail] = useState<ContentItem | null>(null)
  const [sendConfirm, setSendConfirm] = useState<{ item: ContentItem } | null>(null)

  const board = BOARDS[boardIdx]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const collision: CollisionDetection = (args) => {
    const hits = pointerWithin(args)
    const colHits = hits.filter(({ id }) => String(id).startsWith('mcol-'))
    if (colHits.length > 0) return colHits
    return closestCenter(args)
  }

  const boardItems = useMemo(
    () => items.filter((i) => board.filter(i) && board.cols.includes(statusOf(i, states))),
    [items, states, board],
  )

  const byStatus = useMemo(() => {
    const todayMs = new Date(now).setHours(0, 0, 0, 0)
    const map: Record<number, ContentItem[]> = {}
    board.cols.forEach((s) => { map[s] = [] })
    boardItems.forEach((i) => { map[statusOf(i, states)]?.push(i) })
    // atrasados antes; depois por data asc
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
    haptic('medium')
  }
  const handleDragOver = (e: DragOverEvent) => {
    if (!e.over) { setOverStatus(null); return }
    const s = resolveTargetStatus(String(e.over.id))
    setOverStatus(s)
  }
  const handleDragEnd = (e: DragEndEvent) => {
    const id = Number(e.active.id)
    const over = e.over ? resolveTargetStatus(String(e.over.id)) : null
    setActiveId(null)
    setOverStatus(null)
    if (over === null) return
    const item = items.find((i) => i.i === id)
    if (!item) return
    if (statusOf(item, states) === over) return
    if (!board.cols.includes(over)) return
    if (over === 4) {
      haptic('medium')
      setSendConfirm({ item })
      return
    }
    haptic('success')
    onStatusChange(id, over)
  }

  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* seletor de board */}
      <Box sx={{ display: 'flex', gap: 0.8, px: 1.6, py: 1.2, overflowX: 'auto', flexShrink: 0, '&::-webkit-scrollbar': { display: 'none' } }}>
        {BOARDS.map((b, i) => {
          const active = i === boardIdx
          return (
            <Box
              key={b.key}
              onClick={() => { haptic('selection'); setBoardIdx(i) }}
              sx={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5,
                px: 1.4, py: 0.8, borderRadius: 2.5, cursor: 'pointer',
                background: active ? `${b.color}1e` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? `${b.color}66` : DS.border}`,
                boxShadow: active ? `0 0 14px ${b.color}33` : 'none',
                transition: 'transform 0.12s', '&:active': { transform: 'scale(0.95)' },
              }}
            >
              <span style={{ fontSize: '0.86rem' }}>{b.emoji}</span>
              <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: active ? b.color : DS.t2 }}>{b.label}</Typography>
            </Box>
          )
        })}
      </Box>

      {/* blur do fundo durante o drag (nunca no card) */}
      <AnimatePresence>
        {activeId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
              backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
              background: 'rgba(8,9,14,0.28)',
            }}
          />
        )}
      </AnimatePresence>

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => { setActiveId(null); setOverStatus(null) }}
      >
        <Box sx={{
          flex: 1, minHeight: 0, position: 'relative', zIndex: 2,
          display: 'flex', gap: 1.4, px: 1.6, pb: 1.6,
          overflowX: 'auto', scrollSnapType: activeId ? 'none' : 'x mandatory',
          WebkitOverflowScrolling: 'touch',
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
              onCardClick={(item) => { haptic('light'); setDetail(item) }}
            />
          ))}
        </Box>

        <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.16,1,0.3,1)' }}>
          {activeItem && (
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: 1.04, rotate: 2 }}
              transition={spring.snappy}
              style={{ width: '78vw', maxWidth: 340 }}
            >
              <MobileCard
                item={activeItem}
                state={states[activeItem.i] ?? { status: activeItem.s } as ItemState}
                now={now}
                clientColor={clientColors[activeItem.c]}
                overlay
              />
            </motion.div>
          )}
        </DragOverlay>
      </DndContext>

      <CardDetailSheet
        item={detail}
        state={detail ? (states[detail.i] ?? { status: detail.s } as ItemState) : null}
        now={now}
        currentUser={currentUser}
        clientColor={detail ? clientColors[detail.c] : undefined}
        onClose={() => setDetail(null)}
        onStatusChange={onStatusChange}
        onUpdate={onUpdate}
      />

      {/* confirmação de envio ao cliente (status 4) */}
      <BottomSheet
        open={!!sendConfirm}
        onClose={() => setSendConfirm(null)}
        title={<Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: DS.t1 }}>Enviar ao cliente</Typography>}
      >
        {sendConfirm && (
          <Box sx={{ px: 2.2, pb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography sx={{ fontSize: '0.82rem', color: DS.t2, lineHeight: 1.5 }}>
              Marcar <b style={{ color: DS.t1 }}>{sendConfirm.item.n}</b> de <b style={{ color: DS.orange }}>{sendConfirm.item.c}</b> como enviado e gerar o link de aprovação?
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box
                onClick={() => { haptic('light'); setSendConfirm(null) }}
                sx={{ flex: 1, textAlign: 'center', py: 1.3, borderRadius: 2.5, background: 'rgba(255,255,255,0.05)', border: `1px solid ${DS.border}`, cursor: 'pointer' }}
              >
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: DS.t2 }}>Cancelar</Typography>
              </Box>
              <Box
                onClick={() => {
                  haptic('success')
                  void onSendToClient(sendConfirm.item.i, sendConfirm.item.c)
                  setSendConfirm(null)
                }}
                sx={{ flex: 1.4, textAlign: 'center', py: 1.3, borderRadius: 2.5, background: `linear-gradient(135deg, ${DS.orange}, #ff5339)`, cursor: 'pointer', boxShadow: '0 6px 20px rgba(249,115,22,0.32)' }}
              >
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: '#000' }}>Enviar 📤</Typography>
              </Box>
            </Box>
          </Box>
        )}
      </BottomSheet>
    </Box>
  )
}
