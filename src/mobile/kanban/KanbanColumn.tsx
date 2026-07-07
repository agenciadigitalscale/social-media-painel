import { Box, Typography } from '@mui/material'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import type { ContentItem, ItemState, Status } from '../../types'
import { DS } from '../../theme'
import { listItem } from '../system/motion'
import MobileCard from './MobileCard'

interface DraggableCardProps {
  item: ContentItem
  state: ItemState
  now: Date
  clientColor?: string
  activeId: string | null
  onClick: () => void
  index: number
}

function DraggableCard({ item, state, now, clientColor, activeId, onClick, index }: DraggableCardProps) {
  const id = String(item.i)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <motion.div
      ref={setNodeRef}
      variants={listItem}
      initial="initial"
      animate="animate"
      custom={index}
      {...attributes}
      {...listeners}
      style={{ touchAction: 'manipulation', willChange: isDragging ? 'transform' : undefined }}
    >
      <MobileCard
        item={item}
        state={state}
        now={now}
        clientColor={clientColor}
        dragging={isDragging || activeId === id}
        onClick={onClick}
      />
    </motion.div>
  )
}

interface Props {
  status: Status
  label: string
  color: string
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
  clientColors: Record<string, string>
  isOver: boolean
  activeId: string | null
  onCardClick: (item: ContentItem) => void
}

export default function KanbanColumn({ status, label, color, items, states, now, clientColors, isOver, activeId, onCardClick }: Props) {
  const { setNodeRef } = useDroppable({ id: `mcol-${status}` })

  return (
    <motion.div
      animate={{ scale: isOver ? 1.015 : 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{
        flexShrink: 0,
        width: '84vw',
        maxWidth: 360,
        scrollSnapAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {/* cabeçalho da coluna */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, px: 0.5, mb: 1, flexShrink: 0 }}>
        <Box sx={{ width: 9, height: 9, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
        <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: DS.t1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </Typography>
        <Box sx={{ px: 0.9, py: 0.1, borderRadius: 1.5, background: `${color}1e`, border: `1px solid ${color}44` }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color }}>{items.length}</Typography>
        </Box>
      </Box>

      {/* área droppable */}
      <Box
        ref={setNodeRef}
        sx={{
          flex: 1, minHeight: 140,
          display: 'flex', flexDirection: 'column', gap: 1,
          p: 1, borderRadius: 4,
          overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
          background: isOver ? `${color}12` : 'rgba(255,255,255,0.015)',
          border: `1.5px solid ${isOver ? `${color}66` : DS.border}`,
          transition: 'background 0.2s ease, border-color 0.2s ease',
          '&::-webkit-scrollbar': { width: 3 },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(249,115,22,0.4)', borderRadius: 3 },
        }}
      >
        {items.length === 0 ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
            <Typography sx={{ fontSize: '0.7rem', color: DS.t3 }}>
              {isOver ? 'Soltar aqui' : 'Vazio'}
            </Typography>
          </Box>
        ) : (
          items.map((item, i) => (
            <DraggableCard
              key={item.i}
              item={item}
              state={states[item.i] ?? { status: item.s } as ItemState}
              now={now}
              clientColor={clientColors[item.c]}
              activeId={activeId}
              index={i}
              onClick={() => onCardClick(item)}
            />
          ))
        )}
      </Box>
    </motion.div>
  )
}
