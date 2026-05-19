import { useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import {
  Box, Typography, Paper, Chip, Stack, Card, CardContent,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, TextField, MenuItem, ToggleButtonGroup,
  ToggleButton, Fab,
} from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import ChecklistIcon from '@mui/icons-material/Checklist'
import CloseIcon from '@mui/icons-material/Close'
import ImageIcon from '@mui/icons-material/Image'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import CropPortraitIcon from '@mui/icons-material/CropPortrait'
import VideocamIcon from '@mui/icons-material/Videocam'
import PendingActionsIcon from '@mui/icons-material/PendingActions'
import EditNoteIcon from '@mui/icons-material/EditNote'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import PublicIcon from '@mui/icons-material/Public'
import CancelIcon from '@mui/icons-material/Cancel'
import type { Client, ContentItem, ContentType, ItemEditPatch, ItemState, Status } from '../types'
import HintCard from './HintCard'
import ClientAvatar from './ClientAvatar'

// ── Type visual config ─────────────────────────────────
const TYPE_CONF: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  Post:  { color: '#ff9039', bg: 'rgba(255,144,57,0.14)', icon: <ImageIcon sx={{ fontSize: 15 }} /> },
  Reel:  { color: '#3B8EFF', bg: 'rgba(59,142,255,0.14)', icon: <VideoLibraryIcon sx={{ fontSize: 15 }} /> },
  Story: { color: '#b45aff', bg: 'rgba(180,90,255,0.14)', icon: <CropPortraitIcon sx={{ fontSize: 15 }} /> },
  Video: { color: '#00C47A', bg: 'rgba(0,196,122,0.14)',  icon: <VideocamIcon sx={{ fontSize: 15 }} /> },
}

// ── Status bar color ───────────────────────────────────
const STATUS_COLOR: Record<number, string> = {
  0: 'rgba(160,160,160,0.7)',
  1: '#FFD700',
  2: '#3B8EFF',
  3: '#00C47A',
  4: '#FF4545',
}

// ── Column icon per status ─────────────────────────────
const COL_ICON: Record<number, React.ReactNode> = {
  0: <PendingActionsIcon sx={{ fontSize: 28, opacity: 0.4 }} />,
  1: <EditNoteIcon sx={{ fontSize: 28, opacity: 0.4 }} />,
  2: <TaskAltIcon sx={{ fontSize: 28, opacity: 0.4 }} />,
  3: <PublicIcon sx={{ fontSize: 28, opacity: 0.4 }} />,
  4: <CancelIcon sx={{ fontSize: 28, opacity: 0.4 }} />,
}

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, s: Status) => void
  onDelete?: (id: number) => void
  onEdit?: (id: number, patch: ItemEditPatch) => void
  onAddItem?: (clientName: string, title: string, type: ContentType, date: Date, status: Status) => void
  allClients?: Client[]
}

const COLUMNS: { status: Status; label: string; color: string; bg: string; border: string; noAdd?: boolean }[] = [
  { status: 0, label: 'Pendente',               color: '#a0a0a0', bg: 'rgba(160,160,160,0.05)', border: 'rgba(160,160,160,0.15)' },
  { status: 1, label: 'Em edição',              color: '#FFD700',  bg: 'rgba(255,215,0,0.05)',   border: 'rgba(255,215,0,0.18)'   },
  { status: 2, label: 'Aprovado',               color: '#3B8EFF',  bg: 'rgba(59,142,255,0.05)', border: 'rgba(59,142,255,0.18)'  },
  { status: 3, label: 'Publicado',              color: '#00C47A',  bg: 'rgba(0,196,122,0.05)',  border: 'rgba(0,196,122,0.18)'   },
  { status: 4, label: 'Reprovado pelo cliente', color: '#FF4545',  bg: 'rgba(255,69,69,0.05)',  border: 'rgba(255,69,69,0.18)', noAdd: true },
]

// ── Mini card draggável ────────────────────────────────
function KanbanCard({
  item, state, isDragging, onStatusChange, onDelete,
  selectMode, selected, onSelect,
}: {
  item: ContentItem
  state: ItemState
  isDragging?: boolean
  onStatusChange: (id: number, s: Status) => void
  onDelete?: (id: number) => void
  selectMode?: boolean
  selected?: boolean
  onSelect?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: item.i })
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null)
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() }
    setSwipeDir(null)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.touches[0].clientX - touchStart.current.x
    const dy = e.touches[0].clientY - touchStart.current.y
    if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      setSwipeDir(dx > 0 ? 'right' : 'left')
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - touchStart.current.x
    const dy = touch.clientY - touchStart.current.y
    const dt = Date.now() - touchStart.current.t
    touchStart.current = null
    setSwipeDir(null)
    if (Math.abs(dx) < 45 || Math.abs(dy) > Math.abs(dx) || dt > 450) return
    const cur = (state?.status ?? item.s) as Status
    if (dx > 0 && cur < 3) { e.stopPropagation(); onStatusChange(item.i, (cur + 1) as Status) }
    if (dx < 0 && cur > 0) { e.stopPropagation(); onStatusChange(item.i, (cur - 1) as Status) }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirmDelete) { onDelete?.(item.i) }
    else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 2500) }
  }

  const swipeGlow = swipeDir === 'right'
    ? '0 0 14px rgba(0,196,122,0.5)'
    : swipeDir === 'left'
    ? '0 0 14px rgba(255,69,69,0.4)'
    : undefined

  const status = state?.status ?? item.s
  const barColor = STATUS_COLOR[status] ?? 'rgba(160,160,160,0.5)'
  const typeConf = TYPE_CONF[item.tp] ?? TYPE_CONF.Post

  // Urgency
  const _d0 = new Date(); _d0.setHours(0,0,0,0)
  const _d1 = new Date(item.dt); _d1.setHours(0,0,0,0)
  const diffDays = Math.round((_d1.getTime() - _d0.getTime()) / 86_400_000)
  const urgency = status < 3 ? (
    diffDays <= 1 ? { label: 'URGENTE', color: '#FF4545', bg: 'rgba(255,69,69,0.16)',  border: 'rgba(255,69,69,0.4)',   pulse: true  } :
    diffDays <= 3 ? { label: 'MÉDIO',   color: '#ff9039', bg: 'rgba(255,144,57,0.14)', border: 'rgba(255,144,57,0.35)', pulse: false } :
    diffDays <= 7 ? { label: 'BAIXO',   color: '#FFD700', bg: 'rgba(255,215,0,0.1)',   border: 'rgba(255,215,0,0.3)',   pulse: false } :
    null
  ) : null

  const dateStr = diffDays === 0 ? 'hoje' : diffDays === 1 ? 'amanhã' : diffDays === -1 ? 'ontem' : diffDays < -1 ? `${Math.abs(diffDays)}d atrás` : item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const dateColor = diffDays < 0 && status < 3 ? '#FF4545' : diffDays === 0 && status < 3 ? '#FFD700' : 'rgba(255,255,255,0.35)'

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...(selectMode ? {} : listeners)}
      onTouchStart={selectMode ? undefined : handleTouchStart}
      onTouchMove={selectMode ? undefined : handleTouchMove}
      onTouchEnd={selectMode ? undefined : handleTouchEnd}
      onClick={selectMode ? onSelect : undefined}
      sx={{
        mb: 0.8,
        cursor: selectMode ? 'pointer' : 'grab',
        opacity: isDragging ? 0 : 1,
        outline: selected ? '2px solid rgba(255,144,57,0.6)' : undefined,
        bgcolor: selected ? 'rgba(255,144,57,0.05)' : 'rgba(13,13,13,0.92)',
        transform: transform
          ? `translate(${transform.x}px,${transform.y}px)`
          : swipeDir === 'right' ? 'translateX(5px)' : swipeDir === 'left' ? 'translateX(-5px)' : undefined,
        transition: isDragging ? undefined : 'transform 0.12s, box-shadow 0.2s, border-color 0.2s',
        boxShadow: swipeGlow ?? '0 1px 4px rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
        '&:hover': {
          borderColor: 'rgba(255,144,57,0.22)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,144,57,0.1)',
          transform: isDragging ? undefined : 'translateY(-1px)',
          '& .kanban-actions': { opacity: 1 },
        },
        '&:active': { cursor: selectMode ? 'pointer' : 'grabbing' },
        userSelect: 'none',
        touchAction: selectMode ? 'auto' : 'none',
        '& .kanban-actions': { opacity: 0, transition: 'opacity 0.15s' },
        '@keyframes kUrgentPulse': {
          '0%,100%': { opacity: 1, boxShadow: `0 0 3px ${urgency?.color ?? '#FF4545'}55` },
          '50%': { opacity: 0.6, boxShadow: `0 0 8px ${urgency?.color ?? '#FF4545'}99` },
        },
      }}
    >
      {/* Top status color bar */}
      <Box sx={{ height: '2.5px', bgcolor: barColor, boxShadow: `0 0 6px ${barColor}` }} />

      <CardContent sx={{ p: '10px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>

          {/* Select checkbox */}
          {selectMode && (
            <Box
              onPointerDown={e => e.stopPropagation()}
              sx={{
                width: 16, height: 16, mt: 0.3, borderRadius: 0.6, border: '2px solid',
                borderColor: selected ? 'primary.main' : 'rgba(255,255,255,0.25)',
                bgcolor: selected ? 'primary.main' : 'transparent',
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              {selected && <Box sx={{ width: 7, height: 7, bgcolor: '#000', borderRadius: 0.3 }} />}
            </Box>
          )}

          {/* Type icon squircle */}
          <Box sx={{
            width: 30, height: 30, borderRadius: '9px', flexShrink: 0, mt: 0.1,
            bgcolor: typeConf.bg,
            border: `1px solid ${typeConf.color}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: typeConf.color,
          }}>
            {typeConf.icon}
          </Box>

          {/* Main text content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.6rem', color: 'primary.main', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1 }} noWrap>
              {item.c}
            </Typography>
            <Typography fontWeight={700} sx={{ display: 'block', lineHeight: 1.3, fontSize: '0.82rem', mt: 0.15 }} noWrap>
              {state?.title || item.n}
            </Typography>

            {/* Date + urgency row */}
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.4, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.6rem', color: dateColor, fontWeight: 600 }}>
                {dateStr}
              </Typography>
              {urgency && (
                <Chip
                  label={urgency.label}
                  size="small"
                  sx={{
                    height: 15, fontSize: '0.52rem', fontWeight: 800,
                    bgcolor: urgency.bg, color: urgency.color,
                    border: `1px solid ${urgency.border}`,
                    letterSpacing: '0.05em', borderRadius: '4px',
                    ...(urgency.pulse && { animation: 'kUrgentPulse 1.3s ease-in-out infinite' }),
                  }}
                />
              )}
            </Box>

            {/* Link / caption indicators */}
            {(state?.link || state?.caption) && (
              <Box sx={{ display: 'flex', gap: 0.4, mt: 0.5 }}>
                {state?.link && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, px: 0.5, py: 0.15, borderRadius: 0.7, bgcolor: 'rgba(0,196,122,0.1)', border: '1px solid rgba(0,196,122,0.25)' }}>
                    <Typography sx={{ fontSize: '0.5rem', color: '#00C47A', fontWeight: 700 }}>🔗 criativo</Typography>
                  </Box>
                )}
                {state?.caption && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, px: 0.5, py: 0.15, borderRadius: 0.7, bgcolor: 'rgba(59,142,255,0.1)', border: '1px solid rgba(59,142,255,0.25)' }}>
                    <Typography sx={{ fontSize: '0.5rem', color: '#3B8EFF', fontWeight: 700 }}>✍️ legenda</Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>

          {/* Hover actions (drag handle + delete) */}
          <Box
            className="kanban-actions"
            onPointerDown={e => e.stopPropagation()}
            sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, alignItems: 'center', mt: 0.2 }}
          >
            <DragIndicatorIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.2)' }} />
            {onDelete && (
              <Tooltip title={confirmDelete ? 'Clique para confirmar' : 'Excluir'}>
                <IconButton
                  size="small"
                  onClick={handleDeleteClick}
                  sx={{
                    width: 18, height: 18, p: 0,
                    color: confirmDelete ? 'error.main' : 'rgba(255,255,255,0.2)',
                    bgcolor: confirmDelete ? 'rgba(255,69,69,0.12)' : 'transparent',
                    borderRadius: 0.8,
                    '&:hover': { color: 'error.main', bgcolor: 'rgba(255,69,69,0.1)' },
                    transition: 'all 0.15s',
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 11 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

// ── Coluna droppável ───────────────────────────────────
function KanbanColumn({
  col, items, states, activeItem, onStatusChange, onDelete, onAdd,
  selectMode, selectedIds, onSelect,
}: {
  col: typeof COLUMNS[number]
  items: ContentItem[]
  states: Record<number, ItemState>
  activeItem: ContentItem | null
  onStatusChange: (id: number, s: Status) => void
  onDelete?: (id: number) => void
  onAdd?: () => void
  selectMode?: boolean
  selectedIds?: Set<number>
  onSelect?: (id: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.status })

  return (
    <Box
      sx={{
        minWidth: { xs: 210, md: 288, lg: 326, xl: 384 },
        width:    { xs: 210, md: 288, lg: 326, xl: 384 },
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* ── Premium column header ── */}
      <Box sx={{
        px: 1.5, py: 1.1, mb: 1.2,
        borderRadius: 2.5,
        background: `linear-gradient(135deg, ${col.bg} 0%, rgba(0,0,0,0) 80%)`,
        border: `1px solid ${col.border}`,
        backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 1,
        boxShadow: `0 2px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          {/* Glowing status dot */}
          <Box sx={{
            width: 9, height: 9, borderRadius: '50%',
            bgcolor: col.color,
            boxShadow: `0 0 8px ${col.color}, 0 0 16px ${col.color}55`,
            flexShrink: 0,
          }} />
          <Typography fontWeight={800} sx={{
            color: col.color, fontSize: '0.78rem',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            textShadow: `0 0 12px ${col.color}66`,
          }}>
            {col.label}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{
            minWidth: 26, height: 22, px: 0.8,
            borderRadius: 1.5,
            bgcolor: `${col.color}18`,
            border: `1px solid ${col.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: col.color, fontVariantNumeric: 'tabular-nums' }}>
              {items.length}
            </Typography>
          </Box>
          {onAdd && (
            <Tooltip title={`Adicionar em ${col.label}`}>
              <IconButton
                size="small"
                onClick={onAdd}
                sx={{
                  width: 24, height: 24, p: 0,
                  color: col.color,
                  border: `1px solid ${col.border}`,
                  bgcolor: `${col.color}10`,
                  borderRadius: 1.2,
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: `${col.color}22`,
                    transform: 'scale(1.1)',
                    boxShadow: `0 0 8px ${col.color}55`,
                  },
                }}
              >
                <AddIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* ── Drop zone ── */}
      <Box
        ref={setNodeRef}
        sx={{
          flex: 1, overflowY: 'auto', p: 0.5,
          borderRadius: 2.5,
          border: '1px dashed',
          borderColor: isOver ? col.color : 'transparent',
          bgcolor: isOver ? `${col.color}06` : 'transparent',
          boxShadow: isOver ? `inset 0 0 24px ${col.color}12` : 'none',
          transition: 'all 0.2s ease',
          minHeight: 100,
          '&::-webkit-scrollbar': { width: 3 },
          '&::-webkit-scrollbar-thumb': { bgcolor: `${col.color}30`, borderRadius: 2 },
        }}
      >
        {/* Beautiful empty state */}
        {items.length === 0 && !isOver && (
          <Box sx={{ textAlign: 'center', py: 5, opacity: 0.5 }}>
            <Box sx={{ color: col.color, mb: 0.8 }}>
              {COL_ICON[col.status]}
            </Box>
            <Typography sx={{ fontSize: '0.65rem', color: col.color, fontWeight: 600 }}>
              Nenhum item
            </Typography>
            <Typography sx={{ fontSize: '0.56rem', color: 'text.disabled', mt: 0.3 }}>
              Arraste um card aqui
            </Typography>
          </Box>
        )}
        {items.map(item => (
          <KanbanCard
            key={item.i}
            item={item}
            state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }}
            isDragging={activeItem?.i === item.i}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
            selectMode={selectMode}
            selected={selectedIds?.has(item.i)}
            onSelect={() => onSelect?.(item.i)}
          />
        ))}

        {/* Footer add button */}
        {onAdd && items.length > 0 && (
          <Box
            onClick={onAdd}
            sx={{
              mt: 0.5, py: 0.7, borderRadius: 1.5,
              border: `1px dashed ${col.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
              cursor: 'pointer', opacity: 0.45,
              transition: 'all 0.2s',
              '&:hover': { opacity: 1, bgcolor: col.bg, transform: 'scale(1.01)' },
            }}
          >
            <AddIcon sx={{ fontSize: 13, color: col.color }} />
            <Typography sx={{ fontSize: '0.6rem', color: col.color, fontWeight: 600 }}>Adicionar</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ── Coluna Lixeira ────────────────────────────────────
function TrashColumn({ isOver, isDragging }: { isOver: boolean; isDragging: boolean }) {
  const { setNodeRef } = useDroppable({ id: 'trash' })

  return (
    <Box
      ref={setNodeRef}
      sx={{
        minWidth: { xs: 140, md: 170, lg: 190 },
        width:    { xs: 140, md: 170, lg: 190 },
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        '@keyframes trashPulse': {
          '0%,100%': { boxShadow: '0 0 18px rgba(255,80,30,0.45), inset 0 0 30px rgba(255,80,30,0.08)' },
          '50%':     { boxShadow: '0 0 40px rgba(255,80,30,0.85), inset 0 0 60px rgba(255,80,30,0.18)' },
        },
        '@keyframes lidOpen': {
          '0%,100%': { transform: 'perspective(200px) rotateX(0deg)' },
          '50%':     { transform: 'perspective(200px) rotateX(-35deg)' },
        },
        '@keyframes shake': {
          '0%,100%': { transform: 'translateX(0)' },
          '20%':     { transform: 'translateX(-4px)' },
          '40%':     { transform: 'translateX(4px)' },
          '60%':     { transform: 'translateX(-3px)' },
          '80%':     { transform: 'translateX(3px)' },
        },
      }}
    >
      <Box
        sx={{
          flex: 1,
          borderRadius: 3,
          border: isOver
            ? '2px solid rgba(255,60,10,0.9)'
            : isDragging
            ? '2px dashed rgba(255,100,30,0.5)'
            : '2px dashed rgba(255,100,30,0.18)',
          background: isOver
            ? 'linear-gradient(180deg, rgba(255,60,10,0.22) 0%, rgba(10,4,0,0.95) 60%)'
            : 'linear-gradient(180deg, rgba(255,100,30,0.10) 0%, rgba(8,4,0,0.92) 55%, #000 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          transition: 'all 0.25s',
          animation: isOver ? 'trashPulse 0.8s ease-in-out infinite' : undefined,
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: '35%',
            background: 'linear-gradient(to top, rgba(255,80,10,0.06), transparent)',
            pointerEvents: 'none',
          },
        }}
      >
        <Box sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
          animation: isOver ? 'shake 0.5s ease-in-out infinite' : undefined,
        }}>
          <Box sx={{
            width: 52, height: 8,
            background: 'linear-gradient(180deg, #ff8c30 0%, #c94000 100%)',
            borderRadius: '4px 4px 0 0',
            boxShadow: '0 -2px 8px rgba(255,80,10,0.6), inset 0 2px 4px rgba(255,255,255,0.15)',
            transformOrigin: 'center bottom',
            animation: isOver ? 'lidOpen 0.6s ease-in-out infinite' : undefined,
            transition: 'all 0.3s',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: -5, left: '50%',
              transform: 'translateX(-50%)',
              width: 14, height: 6,
              background: 'linear-gradient(180deg, #ff9040 0%, #c94000 100%)',
              borderRadius: '3px 3px 0 0',
              boxShadow: '0 -1px 4px rgba(255,80,10,0.5)',
            },
          }} />
          <Box sx={{
            width: 48, height: 58,
            background: 'linear-gradient(135deg, #ff7020 0%, #c94000 40%, #6b1a00 100%)',
            borderRadius: '0 0 8px 8px',
            boxShadow: '4px 4px 12px rgba(0,0,0,0.8), -2px 0 8px rgba(255,80,10,0.3), inset 2px 2px 6px rgba(255,255,255,0.12), inset -2px -2px 8px rgba(0,0,0,0.5)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute', inset: 0,
              background: 'repeating-linear-gradient(90deg, transparent 0, transparent 12px, rgba(0,0,0,0.2) 12px, rgba(0,0,0,0.2) 14px)',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 4, left: 4, bottom: 4, width: 6,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 100%)',
              borderRadius: 3,
            },
          }}>
            <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)', borderRadius: '0 0 8px 8px' }} />
          </Box>
          <Box sx={{
            width: 44, height: 6, mt: 0.5,
            background: 'radial-gradient(ellipse, rgba(255,80,10,0.35) 0%, transparent 75%)',
            borderRadius: '50%', filter: 'blur(3px)',
          }} />
        </Box>
        <Typography sx={{
          fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.22em',
          textTransform: 'uppercase', color: '#ffffff',
          textShadow: isOver
            ? '0 0 6px #fff, 0 0 14px #fff, 0 0 30px rgba(255,80,10,0.9)'
            : '0 0 5px #fff, 0 0 12px rgba(255,255,255,0.6)',
          transition: 'text-shadow 0.3s', userSelect: 'none',
        }}>
          Lixeira
        </Typography>
        <Typography sx={{
          fontSize: '0.55rem',
          color: isOver ? 'rgba(255,120,50,0.95)' : 'rgba(255,255,255,0.3)',
          textAlign: 'center', px: 1.5, lineHeight: 1.4, transition: 'color 0.2s', userSelect: 'none',
        }}>
          {isOver ? '🔥 solte para excluir' : 'arraste aqui para excluir'}
        </Typography>
      </Box>
    </Box>
  )
}

// ── KanbanTab principal ────────────────────────────────
export default function KanbanTab({ items, states, onStatusChange, onDelete, onAddItem, allClients }: Props) {
  const [activeId, setActiveId] = useState<number | null>(null)
  const [filterClient, setFilterClient] = useState<string | null>(null)
  const [trashOver, setTrashOver]   = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const batchSetStatus = (status: Status) => {
    selectedIds.forEach(id => onStatusChange(id, status))
    setSelectedIds(new Set()); setSelectMode(false)
  }

  const batchDelete = () => {
    selectedIds.forEach(id => onDelete?.(id))
    setSelectedIds(new Set()); setSelectMode(false)
  }

  const [addOpen, setAddOpen]     = useState(false)
  const [addStatus, setAddStatus] = useState<Status>(0)
  const [addClient, setAddClient] = useState('')
  const [addTitle, setAddTitle]   = useState('')
  const [addType, setAddType]     = useState<ContentType>('Post')
  const [addDate, setAddDate]     = useState(() => new Date().toISOString().split('T')[0])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 1 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 50, tolerance: 8 } }),
  )

  const clients = useMemo(() => {
    const fromItems = Array.from(new Set(items.map(i => i.c))).sort()
    const fromClients = (allClients ?? []).map(c => c.name)
    return Array.from(new Set([...fromClients, ...fromItems])).sort()
  }, [items, allClients])

  const filtered = useMemo(() =>
    filterClient ? items.filter(i => i.c === filterClient) : items,
    [items, filterClient])

  const columns = useMemo(() =>
    COLUMNS.map(col => ({
      ...col,
      items: filtered.filter(item => (states[item.i]?.status ?? item.s) === col.status),
    })),
    [filtered, states])

  const activeItem = useMemo(() =>
    activeId != null ? items.find(i => i.i === activeId) ?? null : null,
    [activeId, items])

  function handleDragStart(e: DragStartEvent) { setActiveId(e.active.id as number) }

  function handleDragOver(e: { over: { id: string | number } | null }) {
    setTrashOver(e.over?.id === 'trash')
  }

  function handleDragEnd(e: DragEndEvent) {
    const { over } = e
    setActiveId(null)
    setTrashOver(false)
    if (!over || activeId == null) return
    if (over.id === 'trash') { onDelete?.(activeId); return }
    const newStatus = over.id as Status
    const current = states[activeId]?.status ?? items.find(i => i.i === activeId)?.s ?? 0
    if (newStatus !== current) onStatusChange(activeId, newStatus)
  }

  function openAdd(status: Status) {
    setAddStatus(status)
    setAddClient(''); setAddTitle(''); setAddType('Post')
    setAddDate(new Date().toISOString().split('T')[0])
    setAddOpen(true)
  }

  function handleAddSubmit() {
    if (!addClient || !addTitle) return
    onAddItem?.(addClient, addTitle, addType, new Date(addDate + 'T12:00:00'), addStatus)
    setAddOpen(false)
  }

  const addCol = COLUMNS.find(c => c.status === addStatus)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Filter strip ── */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.6 }}>
          <Stack direction="row" spacing={0.8} sx={{ overflowX: 'auto', flex: 1 }}>
            <Chip label="Todos" size="small" variant={filterClient ? 'outlined' : 'filled'} color="primary" onClick={() => setFilterClient(null)} sx={{ flexShrink: 0 }} />
            {clients.map(c => (
              <Chip key={c} label={c} size="small" variant={filterClient === c ? 'filled' : 'outlined'} onClick={() => setFilterClient(c)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }} />
            ))}
          </Stack>
          <Button
            size="small"
            startIcon={<ChecklistIcon sx={{ fontSize: 14 }} />}
            onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()) }}
            sx={{ fontSize: '0.62rem', flexShrink: 0, color: selectMode ? 'primary.main' : 'text.secondary', minWidth: 0, px: 1 }}
          >
            {selectMode ? 'Cancelar' : 'Sel.'}
          </Button>
        </Box>
        <HintCard text="Arraste entre colunas para mudar status. Use Sel. para selecionar vários. Clique + para adicionar." sx={{ mt: 0.5 }} />
      </Box>

      {/* ── Board ── */}
      <Box sx={{ flex: 1, overflow: 'hidden', px: 1.5, pb: 1.5 }}>
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <Box
            sx={{
              display: 'flex', gap: 1.5,
              height: '100%',
              overflowX: 'auto', overflowY: 'hidden',
              pb: 1,
              scrollSnapType: 'x mandatory',
              '& > *': { scrollSnapAlign: 'start' },
            }}
          >
            {columns.map(col => (
              <KanbanColumn
                key={col.status}
                col={col}
                items={col.items}
                states={states}
                activeItem={activeItem}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
                onAdd={onAddItem && !col.noAdd ? () => openAdd(col.status) : undefined}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onSelect={toggleSelect}
              />
            ))}
            <TrashColumn isOver={trashOver} isDragging={activeId != null} />
          </Box>

          {/* ── Drag overlay — floating preview ── */}
          <DragOverlay dropAnimation={null}>
            {activeItem && (() => {
              const tc = TYPE_CONF[activeItem.tp] ?? TYPE_CONF.Post
              const st = states[activeItem.i]
              return (
                <Card sx={{
                  width: 240,
                  border: '1px solid rgba(255,144,57,0.5)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,144,57,0.2), 0 0 32px rgba(255,144,57,0.15)',
                  cursor: 'grabbing',
                  transform: 'rotate(-1.5deg) scale(1.04)',
                  bgcolor: 'rgba(20,14,4,0.97)',
                  overflow: 'hidden',
                }}>
                  <Box sx={{ height: '2.5px', background: 'linear-gradient(90deg, #ff9039, #ff5339)' }} />
                  <CardContent sx={{ p: '12px !important' }}>
                    <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'flex-start' }}>
                      <Box sx={{ width: 30, height: 30, borderRadius: '9px', bgcolor: tc.bg, border: `1px solid ${tc.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tc.color, flexShrink: 0 }}>
                        {tc.icon}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.58rem', color: 'primary.main', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }} noWrap>
                          {activeItem.c}
                        </Typography>
                        <Typography fontWeight={700} sx={{ fontSize: '0.82rem', lineHeight: 1.3, mt: 0.1 }} noWrap>
                          {st?.title || activeItem.n}
                        </Typography>
                        <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', mt: 0.2 }}>
                          {activeItem.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              )
            })()}
          </DragOverlay>
        </DndContext>
      </Box>

      {/* ── Batch selection bar ── */}
      {selectMode && selectedIds.size > 0 && (
        <Box sx={{
          position: 'fixed', bottom: 72, left: 0, right: 0, zIndex: 1200,
          display: 'flex', gap: 0.8, px: 2, py: 1.2,
          bgcolor: '#1a1208', borderTop: '1px solid rgba(255,144,57,0.3)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.7)',
          alignItems: 'center', flexWrap: 'wrap',
        }}>
          <Typography sx={{ fontSize: '0.68rem', color: 'primary.main', fontWeight: 700, mr: 0.5 }}>
            {selectedIds.size} sel.
          </Typography>
          {COLUMNS.map(col => (
            <Chip
              key={col.status}
              label={col.label}
              size="small"
              onClick={() => batchSetStatus(col.status)}
              sx={{
                fontSize: '0.58rem', cursor: 'pointer', height: 22,
                borderColor: col.border, color: col.color,
                border: `1px solid ${col.border}`,
              }}
            />
          ))}
          <Chip
            label="Excluir selecionados"
            size="small"
            onClick={batchDelete}
            sx={{ fontSize: '0.58rem', cursor: 'pointer', height: 22, color: 'error.main', border: '1px solid rgba(255,69,69,0.4)' }}
          />
          <Fab size="small" onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}
            sx={{ ml: 'auto', width: 28, height: 28, minHeight: 28, bgcolor: 'rgba(255,255,255,0.08)', boxShadow: 'none' }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </Fab>
        </Box>
      )}

      {/* ── Dialog: adicionar card ── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: addCol?.color, flexShrink: 0 }} />
            <Typography fontWeight={700} sx={{ fontSize: '0.95rem' }}>
              Adicionar em <span style={{ color: addCol?.color }}>{addCol?.label}</span>
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="Cliente" size="small" fullWidth select autoFocus
            value={addClient} onChange={e => setAddClient(e.target.value)}
          >
            {clients.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>

          <TextField
            label="Título do conteúdo" size="small" fullWidth
            value={addTitle} onChange={e => setAddTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddSubmit()}
          />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tipo</Typography>
            <ToggleButtonGroup exclusive value={addType} onChange={(_, v) => v && setAddType(v)} size="small" fullWidth>
              <ToggleButton value="Post"  sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Post</ToggleButton>
              <ToggleButton value="Reel"  sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Reel</ToggleButton>
              <ToggleButton value="Story" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Story</ToggleButton>
              <ToggleButton value="Video" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Vídeo</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <TextField
            label="Data" size="small" fullWidth type="date"
            value={addDate} onChange={e => setAddDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Coluna de destino</Typography>
            <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
              {COLUMNS.map(col => (
                <Chip
                  key={col.status}
                  label={col.label}
                  size="small"
                  onClick={() => setAddStatus(col.status)}
                  variant={addStatus === col.status ? 'filled' : 'outlined'}
                  sx={{
                    cursor: 'pointer', fontSize: '0.62rem',
                    borderColor: col.border,
                    color: addStatus === col.status ? '#000' : col.color,
                    bgcolor: addStatus === col.status ? col.color : 'transparent',
                  }}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setAddOpen(false)}>Cancelar</Button>
          <Button
            size="small" variant="contained"
            disabled={!addClient || !addTitle}
            startIcon={<AddIcon />}
            onClick={handleAddSubmit}
            sx={{ fontWeight: 700 }}
          >
            Adicionar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
