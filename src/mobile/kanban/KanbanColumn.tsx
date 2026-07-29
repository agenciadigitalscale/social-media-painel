import { useEffect, useRef, type HTMLAttributes, type TouchEvent } from 'react'
import { Box, Typography } from '@mui/material'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import type { ContentItem, ItemState, Status } from '../../types'
import { DS } from '../../theme'
import { listItem } from '../system/motion'
import MobileCard from './MobileCard'

interface DraggableCardProps {
  item: ContentItem; state: ItemState; now: Date; clientColor?: string
  activeId: string | null; compact?: boolean; vip?: boolean
  onClick: () => void; onMove: () => void; index: number
}

function DraggableCard({ item, state, now, clientColor, activeId, compact, vip, onClick, onMove, index }: DraggableCardProps) {
  const id = String(item.i)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const moved = useRef(false)

  const rememberTouch = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null
    moved.current = false
  }
  const trackTouch = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    if (!touch || !touchStart.current) return
    if (Math.hypot(touch.clientX - touchStart.current.x, touch.clientY - touchStart.current.y) > 8) moved.current = true
  }
  const safeOpen = () => {
    if (moved.current || isDragging || activeId) return
    onClick()
  }

  return (
    <motion.div
      ref={setNodeRef}
      variants={listItem}
      initial="initial"
      animate="animate"
      custom={Math.min(index, 8)}
      onTouchStart={rememberTouch}
      onTouchMove={trackTouch}
      style={{ touchAction: 'pan-y', willChange: isDragging ? 'transform' : undefined }}
    >
      <MobileCard
        item={item}
        state={state}
        now={now}
        clientColor={clientColor}
        compact={compact}
        vip={vip}
        dragging={isDragging || activeId === id}
        onClick={safeOpen}
        onMove={onMove}
        dragHandleProps={{ ...attributes, ...listeners } as HTMLAttributes<HTMLDivElement>}
      />
    </motion.div>
  )
}

interface Props {
  status: Status; label: string; color: string
  items: ContentItem[]; states: Record<number, ItemState>; now: Date
  clientColors: Record<string, string>; isOver: boolean; activeId: string | null
  compact?: boolean; vipClients: Set<string>
  onCardClick: (item: ContentItem) => void
  onMoveClick: (item: ContentItem) => void
  scrollKey: string
}

export default function KanbanColumn({
  status, label, color, items, states, now, clientColors, isOver, activeId,
  compact, vipClients, onCardClick, onMoveClick, scrollKey,
}: Props) {
  const { setNodeRef } = useDroppable({ id: `mcol-${status}` })
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const bindList = (node: HTMLDivElement | null) => {
    scrollRef.current = node
    setNodeRef(node)
  }

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const saved = Number(sessionStorage.getItem(`dshub-mobile-scroll:${scrollKey}`) || 0)
    const frame = requestAnimationFrame(() => { node.scrollTop = saved })
    return () => cancelAnimationFrame(frame)
  }, [scrollKey])

  return (
    <motion.div
      animate={{ scale: isOver ? 0.992 : 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <Box
        ref={bindList}
        aria-label={`Etapa ${label}, ${items.length} cards`}
        onScroll={(event) => sessionStorage.setItem(`dshub-mobile-scroll:${scrollKey}`, String(event.currentTarget.scrollTop))}
        sx={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1,
          px: 1.5, pt: 1, pb: 10, overflowY: 'auto', overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch', touchAction: activeId ? 'none' : 'pan-y',
          background: isOver ? `linear-gradient(180deg, ${color}0d, transparent 45%)` : 'transparent',
          transition: 'background 0.18s ease',
          '&::-webkit-scrollbar': { width: 3 },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(59,130,246,0.38)', borderRadius: 3 },
        }}
      >
        {items.length === 0 ? (
          <Box sx={{ flex: 1, minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 4, textAlign: 'center' }}>
            <Box sx={{ width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', mb: 1.2, background: `${color}10`, border: `1px solid ${color}2b` }}>
              <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 12px ${color}` }} />
            </Box>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 750, color: DS.t2 }}>{isOver ? 'Solte para mover' : 'Nenhum card nesta etapa'}</Typography>
            {!isOver && <Typography sx={{ mt: 0.4, fontSize: '0.66rem', color: DS.t3 }}>Deslize para mudar de etapa ou ajuste os filtros.</Typography>}
          </Box>
        ) : (
          items.map((item, index) => (
            <DraggableCard
              key={item.i}
              item={item}
              state={states[item.i] ?? { status: item.s } as ItemState}
              now={now}
              clientColor={clientColors[item.c]}
              activeId={activeId}
              compact={compact}
              vip={vipClients.has(item.c)}
              index={index}
              onClick={() => onCardClick(item)}
              onMove={() => onMoveClick(item)}
            />
          ))
        )}
      </Box>
    </motion.div>
  )
}
