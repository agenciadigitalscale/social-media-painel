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
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import {
  Box, Typography, Tooltip, Badge, Menu, Button, TextField, MenuItem, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
} from '@mui/material'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import SortIcon from '@mui/icons-material/Sort'
import type { ContentItem, ItemState, Status } from '../../types'
import { isOpenStatus } from '../../types'
import { haptic } from '../../mobile/system/haptics'
import { forceSync, onSyncStatus } from '../../lib/storage'
import { useViewerEvents } from '../../lib/useViewerEvents'
import { useReadyAutomation } from '../../lib/useReadyAutomation'
import { clearReadyState } from '../../lib/readyAutomation'
import MiniCard from './MiniCard'
import type { ColDef } from './shared'

/**
 * O motor do board: colunas droppáveis, arraste (dnd-kit), ordem persistida
 * por coluna e a barra de ações em lote.
 *
 * Terceira e última fatia tirada do `ProducaoTab.tsx`. Junto vieram as peças
 * que só ele usa — SortableCard, DropCol, isTouchDrag e a persistência de
 * ordem/nomes de coluna no localStorage.
 */

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

/**
 * Háptica só faz sentido no toque. No desktop com mouse, `haptic('success')`
 * chegaria a tocar um tick de áudio — então antes de vibrar/soar conferimos que
 * o gesto que iniciou o arraste veio de um dedo, não do ponteiro.
 */
function isTouchDrag(activatorEvent: Event | null): boolean {
  if (!activatorEvent) return false
  if (typeof TouchEvent !== 'undefined' && activatorEvent instanceof TouchEvent) return true
  const pe = activatorEvent as PointerEvent
  return pe.pointerType === 'touch'
}

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
      flex: 1, display: 'flex', flexDirection: 'column', gap: 1.2, p: 0.5,
      borderRadius: 1.5, minHeight: 120,
      // Drop-zone destacada: quando o card paira sobre a coluna, a área de soltar
      // fica inequívoca — borda sólida na cor da coluna, fundo tingido e halo.
      border: `2px ${isOver ? 'solid' : 'dashed'} ${isOver ? color : 'transparent'}`,
      bgcolor: isOver ? `${color}1c` : 'transparent',
      transition: 'border 0.12s ease, background-color 0.12s ease, box-shadow 0.12s ease',
      boxShadow: isOver ? `inset 0 0 0 1px ${color}55, 0 0 0 3px ${color}22` : 'none',
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
  onView?: (id: number) => void
  columns: ColDef[]
  filterFn: (item: ContentItem, state: ItemState) => boolean
  filterClient: string
  bulkMode: boolean
  bulkSelected: Set<number>
  onBulkToggle: (id: number) => void
  boardKey: string
  onSendToClient?: (id: number, clientName: string) => void
  onSendToReview?: (id: number, clientName: string) => void
  onRemindClient?: (id: number, clientName: string) => void
  /** Card arrastado para a coluna Pronto — dispara a esteira, no gesto do usuário. */
  onReadyDrop?: (id: number) => void
  onRetryReady?: (id: number) => void
  onManualLinkReady?: (id: number) => void
  onSendReadyToReview?: (id: number) => void
  /** Abrir a revisão interna de um card que já está em Revisão, com o arquivo dele. */
  onOpenReview?: (id: number, fileId: string) => void
}

function MiniKanban({
  items, states, onStatusChange, onEdit, onView, columns, filterFn,
  filterClient, bulkMode, bulkSelected, onBulkToggle, boardKey, onSendToClient, onSendToReview, onRemindClient,
  onReadyDrop, onRetryReady, onManualLinkReady, onSendReadyToReview, onOpenReview,
}: MiniKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const readyStates = useReadyAutomation()
  // Poller único no módulo: montar em vários boards não multiplica requisição.
  const viewerEvents = useViewerEvents()

  // ── Feedback de persistência do move ──────────────────
  // A gravação em si é robusta (fila + rev + reconcile em storage.ts). O que
  // faltava era o SINAL: o card mostra "salvando…" enquanto a mudança não chegou
  // ao D1 e "erro — tentar de novo" se a conexão cair, com botão de retry.
  const [saveState, setSaveState] = useState<Map<number, 'saving' | 'error'>>(new Map())
  const [moveErrorOpen, setMoveErrorOpen] = useState(false)

  const markSaving = useCallback((id: number) => {
    setSaveState(prev => {
      const next = new Map(prev)
      next.set(id, 'saving')
      return next
    })
  }, [])

  const retrySave = useCallback((id: number) => {
    markSaving(id)
    setMoveErrorOpen(false)
    forceSync()
  }, [markSaving])

  // A fila é global: quando ela drena ('synced'), toda mudança pendente chegou —
  // inclusive a deste card. Erro/offline com card salvando vira estado de erro.
  useEffect(() => onSyncStatus(status => {
    setSaveState(prev => {
      if (prev.size === 0) return prev
      if (status === 'synced' || status === 'idle') return new Map()
      if (status === 'error' || status === 'offline') {
        let hadSaving = false
        const next = new Map(prev)
        for (const [id, v] of next) if (v === 'saving') { next.set(id, 'error'); hadSaving = true }
        if (hadSaving) setMoveErrorOpen(true)
        return next
      }
      return prev
    })
  }), [])

  // ── Ordem manual por coluna (persistida) ──────────────
  const [manualOrder, setManualOrder] = useState<Record<number, number[]>>(() => loadColOrder(boardKey))

  // ── Nomes customizados por coluna ─────────────────────
  const [colNames, setColNames] = useState<Record<number, string>>(() => loadColNames(boardKey))

  // ── Estado do menu da coluna ──────────────────────────
  const colMenuRef = useRef<HTMLElement | null>(null)
  const [colMenuStatus, setColMenuStatus] = useState<number | null>(null)
  const [renamingStatus, setRenamingStatus] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)

  // ── Item 4: Confirm send to client ────────────────────
  const [sendConfirmDrag, setSendConfirmDrag] = useState<{
    activeItemId: number; activeStatus: Status; overCardId: number | null; clientName: string
  } | null>(null)

  // ── Item 5: Published column limit ────────────────────
  const [showAllPublished, setShowAllPublished] = useState(false)
  const PUBLISHED_LIMIT = 50

  const sensors = useSensors(
    // 2px era sensível demais: o card é clicável (abre o painel) E arrastável, e
    // qualquer tremor de 2px no clique virava arraste — o clique não acontecia, e
    // parecia que "o card resiste". 6px dá folga para o clique sem atrapalhar quem
    // quer mesmo arrastar.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Mobile: long-press (segurar ~200ms) levanta o card pra arrastar; toque/deslize rápido = rolagem.
    // delay curto demais (era 100ms) cancelava o arraste e virava rolagem no celular.
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

  // byStatus: atrasados sempre antes de futuros; dentro de cada grupo, respeita manualOrder ou data asc
  const byStatus = useMemo(() => {
    const todayMs = new Date().setHours(0, 0, 0, 0)
    const map: Record<number, ContentItem[]> = {}
    columns.forEach(c => { map[c.status] = [] })
    boardItems.forEach(item => {
      const st = states[item.i]?.status ?? item.s
      if (map[st] !== undefined) map[st].push(item)
    })
    Object.keys(map).forEach(k => {
      const status = Number(k)
      const order = manualOrder[status]
      const orderIdx = order && order.length > 0 ? new Map(order.map((id, i) => [id, i])) : null
      map[status].sort((a, b) => {
        const aMs = new Date(a.dt).setHours(0, 0, 0, 0)
        const bMs = new Date(b.dt).setHours(0, 0, 0, 0)
        const aLate = aMs < todayMs
        const bLate = bMs < todayMs
        // Atrasado sempre antes de futuro — ignora ordem manual para esta separação
        if (aLate && !bLate) return -1
        if (!aLate && bLate) return 1
        // Dentro do mesmo grupo: manual order se existir
        if (orderIdx) {
          const ai = orderIdx.has(a.i) ? orderIdx.get(a.i)! : Infinity
          const bi = orderIdx.has(b.i) ? orderIdx.get(b.i)! : Infinity
          if (ai !== bi) return ai - bi
        }
        // Sem manual ou empatado: data crescente
        return aMs - bMs
      })
    })
    return map
  }, [boardItems, states, columns, manualOrder])

  const activeItem = useMemo(() => activeId ? items.find(i => String(i.i) === activeId) ?? null : null, [activeId, items])
  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
    if (isTouchDrag(e.activatorEvent)) haptic('selection')
  }

  /**
   * Move um card de coluna. Ponto único usado pelo arraste E pela seta do card —
   * assim a seta dispara as mesmas ações que o arraste (confirmar envio ao
   * cliente, ligar a esteira em Pronto, mandar à revisão no board de vídeo).
   */
  const moveToColumn = useCallback((
    activeItemId: number, activeStatus: Status, targetStatus: Status, overCardId: number | null,
  ) => {
    const activeItemObj = items.find(i => i.i === activeItemId)
    if (!activeItemObj) return

    // Status 4 = enviar ao cliente: confirma antes (o mesmo diálogo do arraste).
    if (targetStatus === 4 && onSendToClient) {
      setSendConfirmDrag({ activeItemId, activeStatus, overCardId, clientName: activeItemObj.c })
      return
    }

    onStatusChange(activeItemId, targetStatus)
    markSaving(activeItemId)

    // WhatsApp da revisão NUNCA sai do arraste (ponto 5 do fluxo novo): mover para
    // Revisão interna, seja por drag ou pela seta, só troca o status. Quem avisa o
    // grupo é o botão manual "Enviar para revisão" no card, com confirmação.
    // (A coluna Pronto e seu gatilho `onReadyDrop` saíram na Onda 2.)

    setManualOrder(prev => {
      const srcItems = byStatus[activeStatus] ?? []
      const dstItems = byStatus[targetStatus] ?? []
      const srcOrder = (prev[activeStatus] ?? srcItems.map(i => i.i)).filter(id => id !== activeItemId)
      let dstOrder = (prev[targetStatus] ?? dstItems.map(i => i.i)).filter(id => id !== activeItemId)
      if (overCardId !== null) {
        const idx = dstOrder.indexOf(overCardId)
        dstOrder = idx !== -1
          ? [...dstOrder.slice(0, idx), activeItemId, ...dstOrder.slice(idx)]
          : [...dstOrder, activeItemId]
      } else {
        dstOrder = [...dstOrder, activeItemId]
      }
      const next = { ...prev, [activeStatus]: srcOrder, [targetStatus]: dstOrder }
      saveColOrder(boardKey, next)
      return next
    })
  }, [items, byStatus, onStatusChange, boardKey, onSendToClient, onSendToReview, onReadyDrop, markSaving])

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
      if (isTouchDrag(e.activatorEvent)) haptic('success')
      moveToColumn(activeItemId, activeStatus, targetStatus, overCardId)
    } else if (overCardId !== null && overCardId !== activeItemId) {
      // ── Reordenar dentro da mesma coluna ──────────────
      setManualOrder(prev => {
        // Parte SEMPRE da ordem que está na tela (byStatus), não da salva:
        // a salva pode estar velha (cards que saíram, ordem de outra sessão), e
        // aí o card ia parar num lugar diferente de onde foi solto. Isso também
        // limpa os IDs fantasma que se acumulavam no localStorage.
        const currentOrder = (byStatus[activeStatus] ?? []).map(i => i.i)
        const oldIdx = currentOrder.indexOf(activeItemId)
        const newIdx = currentOrder.indexOf(overCardId!)
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return prev
        const next = { ...prev, [activeStatus]: arrayMove(currentOrder, oldIdx, newIdx) }
        saveColOrder(boardKey, next)
        return next
      })
    }
  }, [states, items, byStatus, boardKey, moveToColumn])

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

  // ── Item 4: Confirm send handler ─────────────────────
  const handleConfirmDragSend = useCallback((confirmed: boolean) => {
    if (!sendConfirmDrag) return
    const { activeItemId, activeStatus, overCardId, clientName } = sendConfirmDrag
    const targetStatus = 4 as Status
    if (confirmed) {
      onStatusChange(activeItemId, targetStatus)
      markSaving(activeItemId)
      onSendToClient?.(activeItemId, clientName)
      setManualOrder(prev => {
        const srcItems = byStatus[activeStatus] ?? []
        const dstItems = byStatus[targetStatus] ?? []
        const srcOrder = (prev[activeStatus] ?? srcItems.map(i => i.i)).filter(id => id !== activeItemId)
        let dstOrder = (prev[targetStatus] ?? dstItems.map(i => i.i)).filter(id => id !== activeItemId)
        if (overCardId !== null) {
          const idx = dstOrder.indexOf(overCardId)
          dstOrder = idx !== -1
            ? [...dstOrder.slice(0, idx), activeItemId, ...dstOrder.slice(idx)]
            : [...dstOrder, activeItemId]
        } else {
          dstOrder = [...dstOrder, activeItemId]
        }
        const next = { ...prev, [activeStatus]: srcOrder, [targetStatus]: dstOrder }
        saveColOrder(boardKey, next)
        return next
      })
    }
    setSendConfirmDrag(null)
  }, [sendConfirmDrag, onStatusChange, onSendToClient, byStatus, boardKey, markSaving])

  // ── Renomear coluna ───────────────────────────────────
  const applyRename = useCallback(() => {
    if (renamingStatus === null || !renameValue.trim()) { setRenamingStatus(null); return }
    const next = { ...colNames, [renamingStatus]: renameValue.trim() }
    setColNames(next)
    saveColNames(boardKey, next)
    setRenamingStatus(null)
  }, [renamingStatus, renameValue, colNames, boardKey])

  const today = new Date(); today.setHours(0, 0, 0, 0)

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Box sx={{ display: 'flex', gap: 2, height: '100%', minWidth: 'max-content' }}>
        {columns.map(col => {
          const colItems = byStatus[col.status] ?? []
          const displayName = colNames[col.status] || col.label
          const lateCount = colItems.filter(i => {
            const dt = new Date(i.dt); dt.setHours(0, 0, 0, 0)
            return dt < today && isOpenStatus(col.status)
          }).length
          // Item 5: Publicado — limit 50
          const isPublishedCol = col.status === 7
          const displayItems = isPublishedCol && !showAllPublished && colItems.length > PUBLISHED_LIMIT
            ? colItems.slice(colItems.length - PUBLISHED_LIMIT)
            : colItems

          return (
            <Box key={col.status} sx={{ flex: '0 0 290px', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
              {/* Column header */}
              <Box className="col-header" sx={{
                display: 'flex', alignItems: 'center', gap: 1, mb: 1.5,
                px: 1.5, py: 1.1, borderRadius: '12px',
                bgcolor: `${col.color}0d`, border: `1px solid ${col.color}30`,
                borderTop: `3px solid ${col.color}`,
                flexShrink: 0,
                position: 'relative',
                '&:hover .col-menu-btn': { opacity: 1 },
                '&:hover .col-sort-btn': { opacity: 0.7 },
              }}>
                <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: col.color, flexShrink: 0, boxShadow: `0 0 7px ${col.color}` }} />

                {/* Nome da coluna */}
                <Typography sx={{ fontSize: { md: '0.78rem', xl: '0.85rem' }, fontWeight: 800, color: col.color, flex: 1, lineHeight: 1, letterSpacing: '-0.01em' }} noWrap>
                  {displayName}
                </Typography>

                <Badge badgeContent={lateCount || undefined} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.5rem', minWidth: 14, height: 14, top: -2, right: -2 } }}>
                  <Box sx={{ minWidth: 24, height: 20, px: 0.8, borderRadius: 3, bgcolor: `${col.color}25`, border: `1px solid ${col.color}45`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography key={colItems.length} sx={{
                      fontSize: '0.68rem', fontWeight: 900, color: col.color, lineHeight: 1,
                      '@keyframes counterPop': {
                        '0%':   { transform: 'scale(0.5)', opacity: 0.4 },
                        '70%':  { transform: 'scale(1.25)' },
                        '100%': { transform: 'scale(1)',   opacity: 1 },
                      },
                      animation: 'counterPop 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                    }}>{colItems.length}</Typography>
                  </Box>
                </Badge>

                {/* Item 10: Quick sort icon */}
                <Tooltip title="Ordenar por data" placement="top">
                  <IconButton
                    size="small"
                    onClick={() => sortColByDate(col.status, 'asc')}
                    sx={{
                      p: 0.3, opacity: 0, transition: 'opacity 0.15s',
                      color: `${col.color}70`,
                      '&:hover': { color: col.color, bgcolor: `${col.color}14` },
                      '.col-header:hover &': { opacity: 0.6 },
                    }}
                    className="col-sort-btn"
                  >
                    <SortIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                </Tooltip>

                {/* Menu da coluna */}
                <IconButton
                  className="col-menu-btn"
                  size="small"
                  onClick={e => { colMenuRef.current = e.currentTarget; setColMenuStatus(col.status) }}
                  sx={{
                    p: 0.3, opacity: 0, transition: 'opacity 0.15s',
                    color: `${col.color}99`,
                    '&:hover': { color: col.color, bgcolor: `${col.color}14` },
                  }}
                >
                  <MoreVertIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>

              {/* Cards com scroll fade */}
              <Box sx={{ overflowY: 'auto', flex: 1, position: 'relative',
                '&::-webkit-scrollbar': { width: 3 },
                '&::-webkit-scrollbar-thumb': { bgcolor: `${col.color}40`, borderRadius: 2 },
              }}>
                <SortableContext items={displayItems.map(i => String(i.i))} strategy={verticalListSortingStrategy}>
                  <DropCol colId={`${boardKey}-col-${col.status}`} color={col.color}>
                    {displayItems.map((item, idx) => {
                      const st = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
                      const isSelected = bulkSelected.has(item.i)
                      const card = (
                        <MiniCard
                          item={item} state={st}
                          isDragging={activeId === String(item.i)}
                          colColor={col.color}
                          isSelected={isSelected}
                          staggerIndex={idx}
                          bulkMode={bulkMode}
                          onSelect={() => onBulkToggle(item.i)}
                          onEdit={onEdit ? () => onEdit(item.i) : undefined}
                          onView={onView ? () => onView(item.i) : undefined}
                          onRemind={onRemindClient ? () => onRemindClient(item.i, item.c) : undefined}
                          ready={readyStates[item.i]}
                          viewer={viewerEvents.get(item.i)}
                          saveState={saveState.get(item.i)}
                          onRetrySave={() => retrySave(item.i)}
                          columns={columns}
                          onMoveColumn={target => moveToColumn(item.i, col.status, target, null)}
                          onReview={onOpenReview ? fileId => onOpenReview(item.i, fileId) : undefined}
                          onSendReview={onSendToReview ? () => onSendToReview(item.i, item.c) : undefined}
                          onRetryReady={onRetryReady ? () => onRetryReady(item.i) : undefined}
                          onManualLinkReady={onManualLinkReady ? () => onManualLinkReady(item.i) : undefined}
                          onBackToProduction={() => { clearReadyState(item.i); onStatusChange(item.i, 1) }}
                          onGoToReview={() => onStatusChange(item.i, 2)}
                          onSendReadyToReview={onSendReadyToReview ? () => onSendReadyToReview(item.i) : undefined}
                        />
                      )
                      return bulkMode ? (
                        <Box key={item.i}>{card}</Box>
                      ) : (
                        <SortableCard key={item.i} id={String(item.i)}>{card}</SortableCard>
                      )
                    })}
                    {colItems.length === 0 && (
                      <Box sx={{
                        py: 4, textAlign: 'center', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 0.8,
                      }}>
                        <Box sx={{
                          width: 32, height: 32, borderRadius: '10px',
                          border: `1.5px dashed ${col.color}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: `${col.color}40`,
                          fontSize: '0.8rem',
                        }}>✦</Box>
                        <Typography sx={{ fontSize: '0.62rem', color: 'rgba(244,247,255,0.13)', fontWeight: 600, letterSpacing: '0.04em' }}>
                          Vazio
                        </Typography>
                      </Box>
                    )}
                    {/* Item 5: Ver todos button for Publicado */}
                    {isPublishedCol && colItems.length > PUBLISHED_LIMIT && (
                      <Box
                        onClick={() => setShowAllPublished(v => !v)}
                        sx={{
                          mt: 0.5, py: 1, textAlign: 'center', cursor: 'pointer', borderRadius: '10px',
                          border: `1px dashed ${col.color}30`,
                          bgcolor: showAllPublished ? `${col.color}08` : 'transparent',
                          transition: 'all 0.15s ease',
                          '&:hover': { bgcolor: `${col.color}12`, borderColor: `${col.color}50` },
                        }}
                      >
                        <Typography sx={{ fontSize: '0.62rem', color: `${col.color}99`, fontWeight: 700, letterSpacing: '0.04em' }}>
                          {showAllPublished
                            ? `↑ Ver menos (${PUBLISHED_LIMIT} recentes)`
                            : `↓ Ver todos — +${colItems.length - PUBLISHED_LIMIT} ocultos`}
                        </Typography>
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
        <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={{ duration: 140, easing: 'ease-out' }}>
          {activeItem && (() => {
            const st = states[activeItem.i] ?? { status: activeItem.s, title: '', link: '', caption: '', notes: '' }
            const col = columns.find(c => c.status === (st.status ?? activeItem.s)) ?? columns[0]
            return (
              <Box sx={{ opacity: 0.92, cursor: 'grabbing', pointerEvents: 'none' }}>
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
              border: '1px solid rgba(244,247,255,0.1)', borderRadius: 2,
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
            <Box key="header" sx={{ px: 1.8, py: 1, borderBottom: '1px solid rgba(244,247,255,0.06)' }}>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                Coluna: {displayName}
              </Typography>
            </Box>,
            <MenuItem key="rename" onClick={() => {
              setRenameValue(displayName)
              setRenamingStatus(colMenuStatus)
              setColMenuStatus(null)
              setRenameDialogOpen(true)
            }} sx={{ gap: 1.2, fontSize: '0.72rem', py: 1 }}>
              <DriveFileRenameOutlineIcon sx={{ fontSize: 15, color: 'rgba(244,247,255,0.45)' }} />
              <Typography sx={{ fontSize: '0.72rem' }}>Renomear coluna</Typography>
            </MenuItem>,
            <MenuItem key="sort-asc" onClick={() => sortColByDate(colMenuStatus, 'asc')} sx={{ gap: 1.2, fontSize: '0.72rem', py: 1 }}>
              <SortIcon sx={{ fontSize: 15, color: 'rgba(244,247,255,0.45)' }} />
              <Box>
                <Typography sx={{ fontSize: '0.72rem' }}>Ordenar por data ↑</Typography>
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(244,247,255,0.3)' }}>Atrasados primeiro → mais futuro</Typography>
              </Box>
            </MenuItem>,
            <MenuItem key="sort-desc" onClick={() => sortColByDate(colMenuStatus, 'desc')} sx={{ gap: 1.2, fontSize: '0.72rem', py: 1 }}>
              <SortIcon sx={{ fontSize: 15, color: 'rgba(244,247,255,0.45)', transform: 'scaleY(-1)' }} />
              <Box>
                <Typography sx={{ fontSize: '0.72rem' }}>Ordenar por data ↓</Typography>
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(244,247,255,0.3)' }}>Mais futuro primeiro</Typography>
              </Box>
            </MenuItem>,
          ]
        })()}
      </Menu>

      {/* ── Item 4: Confirm send to client dialog ────────── */}
      <Dialog
        open={!!sendConfirmDrag}
        onClose={() => setSendConfirmDrag(null)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '20px' } }}
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography variant="subtitle1" fontWeight={700}>Confirmar envio ao cliente</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            O material de <strong style={{ color: DS.accent }}>{sendConfirmDrag?.clientName}</strong> foi enviado para aprovação?
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.8, display: 'block', fontSize: '0.62rem' }}>
            Se sim, o card vai para "Enviado ao cliente" e o WhatsApp é aberto. Se não, o card permanece na coluna atual.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => handleConfirmDragSend(false)} sx={{ color: 'text.secondary' }}>
            Não — manter
          </Button>
          <Button
            size="small" variant="contained" onClick={() => handleConfirmDragSend(true)}
            sx={{ fontWeight: 700, background: 'linear-gradient(135deg, DS.accent, DS.cyan)', color: '#fff' }}
          >
            Sim — enviar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Item 6: Rename column dialog ─────────────────── */}
      <Dialog
        open={renameDialogOpen}
        onClose={() => setRenameDialogOpen(false)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(244,247,255,0.07)', borderRadius: '20px' } }}
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography variant="subtitle1" fontWeight={700}>Renomear coluna</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            autoFocus fullWidth size="small"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { applyRename(); setRenameDialogOpen(false) } if (e.key === 'Escape') setRenameDialogOpen(false) }}
            sx={{ '& .MuiInputBase-root': { fontSize: '0.85rem', fontWeight: 700 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setRenameDialogOpen(false)} sx={{ color: 'text.secondary' }}>Cancelar</Button>
          <Button
            size="small" variant="contained"
            onClick={() => { applyRename(); setRenameDialogOpen(false) }}
            sx={{ fontWeight: 700 }}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Erro ao mover: toast com retry ───────────────── */}
      <Snackbar
        open={moveErrorOpen}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={() => setMoveErrorOpen(false)}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setMoveErrorOpen(false)}
          action={
            <Button
              size="small"
              onClick={() => { setMoveErrorOpen(false); forceSync() }}
              sx={{ color: '#fff', fontWeight: 700 }}
            >
              Tentar novamente
            </Button>
          }
          sx={{ borderRadius: '12px', alignItems: 'center' }}
        >
          Não foi possível salvar o movimento.
        </Alert>
      </Snackbar>
    </DndContext>
  )
}


export default MiniKanban
