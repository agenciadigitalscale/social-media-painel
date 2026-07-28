import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
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
  Box, Typography, Paper, Chip, Tooltip, Badge, Menu,
  Button, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  ToggleButtonGroup, ToggleButton, IconButton, Drawer, Portal, Snackbar, Alert,
} from '@mui/material'
import ContentCard from './ContentCard'
import EditItemDialog from './EditItemDialog'
import { shouldShowDelivery } from '../lib/cardDate'
import PlanejamentoDialog from './PlanejamentoDialog'
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
import SearchIcon from '@mui/icons-material/Search'
import ViewListIcon from '@mui/icons-material/ViewList'
import GridViewIcon from '@mui/icons-material/GridView'
import type { Client, ContentItem, ContentType, ItemEditPatch, ItemState, RoteiroStatus, Status } from '../types'
import { STATUS_CONFIG, isOpenStatus, isPreClientStatus, statusRank, STATUS_ORDER } from '../types'
import { clickable } from '../shared/a11y'
import { DS, typeColor } from '../theme'
import { loadUploadTasks, type UploadTask } from './EditorMode'
import { syncToCloud, forceSync, onSyncStatus } from '../lib/storage'
import { haptic } from '../mobile/system/haptics'
import { NAME_MAP } from '../lib/users'
import DriveVideoInbox from './DriveVideoInbox'
import DriveInboxDrawer from './DriveInboxDrawer'
import AutomationHealthPanel from './AutomationHealthPanel'
import ProblemsPanel from './ProblemsPanel'
import { computeProductionIssues, type ProductionIssue } from '../lib/productionIssues'
import LinkVideoDialog from './LinkVideoDialog'
import InboxIcon from '@mui/icons-material/MoveToInbox'
import { useDriveInbox, type DriveVideo } from '../lib/useDriveInbox'
import { getCardPreview, upsertMediaLink, removeMediaLinkForFile } from '../lib/mediaLinks'
import { useMediaLinks } from '../lib/useMediaLinks'
import { useReadyAutomation } from '../lib/useReadyAutomation'
import { useViewerEvents, shortPlatform, type ViewerSummary } from '../lib/useViewerEvents'
import { justArrived, ARRIVAL_DURATION_MS } from '../lib/cardPulse'
import { useReadyEsteira, mirrorFile } from '../lib/useReadyEsteira'
import {
  runReadyAutomation, getReadyState, patchReadyState, clearReadyState, isLocked,
  validateMediaPreview, isStalePhase, PHASE_MESSAGE,
  type ReadyAutomationState, type DriveFilesResponse,
} from '../lib/readyAutomation'
import { buildExportName, exportCodeFor, driveViewUrlFor, acceptForContentType, isAcceptedFile, type DriveFile } from '../lib/videoMatch'
import ReadyPickerDialog from './ReadyPickerDialog'
import ReviewModal from './ReviewModal'
import CircularProgress from '@mui/material/CircularProgress'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import RadarIcon from '@mui/icons-material/Radar'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import {
  markFileIgnored, markFileLinked, remindFileLater, restoreIgnoredFile, dismissFiles,
} from '../lib/driveInbox'
import RoteirosBoard from './producao/RoteirosBoard'
import {
  ALL_TYPES, MONTH_NAMES_ROT, ROT_COLOR, ROTEIRO_STATUS_CFG, ROTEIRO_STATUS_FLOW,
  col, toLocalDateInput, type ColDef,
} from './producao/shared'

// ── Column definitions ────────────────────────────────────

// Fluxo enxuto da produção (2026-07-27): a coluna "Pronto" (8) saiu. O gatilho
// da esteira deixou de ser "arrastar para Pronto" e passou a ser "card em
// Produção + arquivo detectado na pasta Publicar" → move sozinho para Revisão.
// A jornada completa vive no board: A fazer → Produção → Revisão interna →
// Ajuste → Enviado → Aprovado → Publicado. O status 3 ("Pronto p/ enviar")
// continua vivo no app, só não aparece como coluna aqui.
const VIDEO_COLS: ColDef[]  = ([0, 1, 2, 6, 4, 5, 7] as Status[]).map(col)
const DESIGN_COLS: ColDef[] = ([0, 1, 2, 6, 4, 5, 7] as Status[]).map(col)
const FEED_COLS: ColDef[]   = ([0, 1, 2, 6, 4, 5, 7] as Status[]).map(col)
const SOCIAL_COLS: ColDef[] = ([2, 3, 4, 6, 5, 7] as Status[]).map(col)

// Reels destacam com DS orange; demais tipos são neutros
const TYPE_COLOR: Record<string, string> = {
  Post: '#888', Reel: '#3B82F6', Story: '#888', Carrossel: '#888', Feed: '#888',
}

const TYPE_EMOJI: Record<string, string> = {
  Post: '🖼️', Reel: '🎬', Story: '⭐', Carrossel: '🗂️', Feed: '📸',
}



// ─────────────────────────────────────────────────────────────

const BOARDS = [
  { label: 'Vídeo',    emoji: '🎬', color: '#60A5FA', cols: VIDEO_COLS,  key: 'vid', desc: 'Reels e Stories — produção audiovisual' },
  { label: 'Design',   emoji: '🎨', color: '#C084FC', cols: DESIGN_COLS, key: 'des', desc: 'Posts, Carrosseis e Feed — criação visual' },
  { label: 'Feed',     emoji: '📸', color: '#06B6D4', cols: FEED_COLS,   key: 'fed', desc: 'Fotos e imagens da empresa' },
  { label: 'Social',   emoji: '📱', color: '#31D17C', cols: SOCIAL_COLS, key: 'soc', desc: 'Conteúdos prontos para programar e publicar' },
  { label: 'Roteiros', emoji: '📝', color: '#FB7185', cols: [],          key: 'rot', desc: 'Scripts e links para todos os colaboradores' },
  { label: 'Inbox',    emoji: '📥', color: '#3B82F6', cols: [],          key: 'drv', desc: 'Vídeos exportados → WhatsApp automático' },
]

// Board correspondente à "área" de cada colaborador (badge "Minha área")
const USER_AREA_BOARD: Record<string, string> = {
  kaique: 'vid', jhones: 'des', kerges: 'rot', arthur: 'soc', robson: 'soc',
}

// ── Delay helpers ─────────────────────────────────────────

type DelayLevel = 'ok' | 'today' | 'warning' | 'critical'

function getDelayLevel(dt: Date, status: Status, deliveryDt?: number): DelayLevel {
  if (status === 7 || status === 5) return 'ok'
  const refMs = deliveryDt
    ? new Date(deliveryDt).setHours(0, 0, 0, 0)
    : new Date(dt).setHours(0, 0, 0, 0)
  const todayMs = new Date().setHours(0, 0, 0, 0)
  const diff = Math.round((refMs - todayMs) / 86400000)
  if (diff > 0)   return 'ok'
  if (diff === 0) return 'today'
  if (diff >= -3) return 'warning'
  return 'critical'
}

// Escada de urgência: a temperatura só sobe — neutro → âmbar → laranja → vermelho.
// `warning` usava DS.orange, que o remap repontou para azul: um card atrasado ficava
// com a cor de "tudo normal". DS.alert restaura o degrau.
const DELAY_BORDER: Record<DelayLevel, string> = {
  ok:       'rgba(255,255,255,0.07)',
  today:    `${DS.amber}38`,
  warning:  `${DS.alert}45`,
  critical: `${DS.red}52`,
}

const DELAY_DOT: Record<DelayLevel, string> = {
  ok:       'rgba(255,255,255,0.20)',
  today:    DS.amber,
  warning:  DS.alert,
  critical: DS.red,
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

/**
 * Nome que o editor cola na exportação: `Lorenzeti - Vídeo Chuveiro [05MT]`.
 *
 * Vai **sem extensão**: o campo de nome do CapCut já põe a dele, e colar ".mp4"
 * ali gera "arquivo.mp4.mp4". Quem identifica o card é o selo entre colchetes —
 * o resto do nome existe para o humano reconhecer o arquivo na pasta.
 */
export function exportName(item: ContentItem, state: ItemState): string {
  return buildExportName(item.i, item.c, state.title || item.n)
}

/** Estados da esteira desenhados dentro do card, na coluna Pronto. */
function ReadyStrip({ ready, cardCode, onRetry, onManualLink, onBackToProduction, onGoToReview, onSendToReview }: {
  ready: ReadyAutomationState
  /** Selo esperado no nome do arquivo — quem não achou nada precisa saber qual é. */
  cardCode: string
  onRetry?: () => void
  onManualLink?: () => void
  onBackToProduction?: () => void
  onGoToReview?: () => void
  onSendToReview?: () => void
}) {
  // "Validando prévia…" que não anda: a aba foi recarregada no meio. Some o
  // spinner e aparecem as ações — ninguém deveria ficar olhando para um card
  // que não vai sair dali sozinho.
  const stale = isStalePhase(ready)
  const busy = (ready.phase === 'searching' || ready.phase === 'found') && !stale
  const idle = ready.phase === 'idle'
  const tone = busy ? DS.accent
    : ready.phase === 'done' || ready.phase === 'awaiting_send' ? DS.green
    : idle || stale ? DS.t2
    : ready.phase === 'ambiguous' ? DS.amber
    : DS.alert

  const icon = busy ? <CircularProgress size={9} sx={{ color: tone }} />
    : ready.phase === 'done' || ready.phase === 'awaiting_send' ? <CheckCircleIcon sx={{ fontSize: 11, color: tone }} />
    : idle || stale ? <RadarIcon sx={{ fontSize: 11, color: tone }} />
    : <WarningAmberIcon sx={{ fontSize: 11, color: tone }} />

  const act = (label: string, fn?: () => void) => fn ? (
    <Box
      {...clickable(fn)}
      // O clique é do botão, não do card: para no React (o capture nativo mataria
      // o próprio onClick do clickable) e o pointerdown não vira arraste.
      onPointerDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); fn() }}
      sx={{
        px: 0.7, py: 0.25, borderRadius: '6px', fontSize: '0.52rem', fontWeight: 700,
        color: tone, border: `1px solid ${tone}44`, bgcolor: `${tone}14`,
        cursor: 'pointer', whiteSpace: 'nowrap',
        '&:hover': { bgcolor: `${tone}22` }, transition: 'all 0.15s',
      }}
    >{label}</Box>
  ) : null

  return (
    <Box sx={{
      mt: 0.7, px: 0.8, py: 0.55, borderRadius: '8px',
      bgcolor: `${tone}0f`, border: `1px solid ${tone}2e`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {icon}
        <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: tone, lineHeight: 1.3 }}>
          {stale ? 'A busca ficou pelo caminho — tente de novo' : ready.message}
        </Typography>
      </Box>
      {ready.phase === 'not_found' && !stale && (
        <Typography sx={{ fontSize: '0.5rem', color: DS.t3, mt: 0.3, lineHeight: 1.3 }}>
          Procurei pelo selo <strong>[{cardCode}]</strong> no nome do arquivo.
        </Typography>
      )}
      {ready.filename && (ready.phase === 'found' || ready.phase === 'done' || ready.phase === 'invalid' || ready.phase === 'awaiting_send') && (
        <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.35)', mt: 0.15 }} noWrap>
          {ready.filename}
        </Typography>
      )}
      {ready.phase === 'awaiting_send' && (
        <Box sx={{ display: 'flex', gap: 0.4, mt: 0.5, flexWrap: 'wrap' }}>
          {act('Enviar para revisão', onSendToReview)}
          {act('Trocar arquivo', onManualLink)}
        </Box>
      )}
      {/* Concluída mas o card continua em Pronto: estado inconsistente (voltou
          arrastado, ou a mudança de status não chegou). Oferece a saída em vez
          de deixar a faixa verde num beco sem ação. */}
      {ready.phase === 'done' && onGoToReview && (
        <Box sx={{ display: 'flex', gap: 0.4, mt: 0.5 }}>
          {act('Ir para Revisão', onGoToReview)}
        </Box>
      )}
      {(idle || stale || ready.phase === 'not_found' || ready.phase === 'invalid' || ready.phase === 'error' || ready.phase === 'ambiguous') && (
        <Box sx={{ display: 'flex', gap: 0.4, mt: 0.5, flexWrap: 'wrap' }}>
          {ready.phase === 'ambiguous'
            ? act(`Selecionar arquivo (${ready.candidates?.length ?? 0})`, onManualLink)
            : (
              <>
                {act(idle ? 'Procurar arquivo' : 'Tentar novamente', onRetry)}
                {act(ready.phase === 'invalid' ? 'Vincular outro' : 'Vincular manualmente', onManualLink)}
                {act('Voltar p/ Produção', onBackToProduction)}
              </>
            )}
        </Box>
      )}
    </Box>
  )
}

function MiniCard({ item, state, isDragging, colColor, isSelected, bulkMode, onSelect, onEdit, onView, onRemind, staggerIndex = 0, ready, viewer, saveState, onRetrySave, columns, onMoveColumn, onReview, onSendReview, onRetryReady, onManualLinkReady, onBackToProduction, onGoToReview, onSendReadyToReview }: {
  item: ContentItem
  state: ItemState
  /** O que o cliente conseguiu (ou não) ver deste criativo. */
  viewer?: ViewerSummary
  /** Persistência do último move deste card: 'saving' enquanto sobe, 'error' se falhou. */
  saveState?: 'saving' | 'error'
  onRetrySave?: () => void
  /** Colunas do board, em ordem — a seta move para a vizinha. */
  columns?: ColDef[]
  /** Fallback do arraste: move o card para o status de outra coluna. */
  onMoveColumn?: (targetStatus: Status) => void
  /** Abre a revisão interna (assistir + aprovar) para o arquivo já vinculado. */
  onReview?: (fileId: string) => void
  /** Envio manual ao grupo de revisão no WhatsApp (com confirmação). Só na Revisão. */
  onSendReview?: () => void
  isDragging?: boolean
  colColor: string
  isSelected?: boolean
  bulkMode?: boolean
  onSelect?: () => void
  onEdit?: () => void
  onView?: () => void
  onRemind?: () => void
  staggerIndex?: number
  ready?: ReadyAutomationState
  onRetryReady?: () => void
  onManualLinkReady?: () => void
  onBackToProduction?: () => void
  onGoToReview?: () => void
  onSendReadyToReview?: () => void
}) {
  const [hover, setHover] = useState(false)
  const [nameCopied, setNameCopied] = useState(false)
  // Só na montagem: o realce é do instante da chegada, não some e volta a cada render.
  const [arrived] = useState(() => justArrived(item.i))
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current) }, [])
  const mediaLinks = useMediaLinks()

  const delay = getDelayLevel(item.dt, state.status, state.deliveryDate)

  const pubLabel = getDateLabel(item.dt)
  const deliveryLabel = state.deliveryDate ? getDateLabel(new Date(state.deliveryDate)) : null
  const showDelivery = shouldShowDelivery(state)
  const activeLabel = showDelivery ? `📥 ${deliveryLabel}` : pubLabel

  const resp = state.responsible ? NAME_MAP[state.responsible] : null
  const tc = typeColor(item.tp)
  // Prévia: regra única em lib/mediaLinks. O card não olha mais para state.link.
  const preview = getCardPreview(item, mediaLinks, state.status)
  // Revisão interna com arquivo confirmado: dá para assistir e decidir aqui.
  const canReview = !!onReview && state.status === 2 && preview.kind === 'ready'

  // Fallback do arraste: setas para a coluna vizinha, na ordem do board.
  const colIdx  = columns?.findIndex(c => c.status === state.status) ?? -1
  const prevCol = onMoveColumn && colIdx > 0 ? columns![colIdx - 1] : null
  const nextCol = onMoveColumn && columns && colIdx >= 0 && colIdx < columns.length - 1 ? columns[colIdx + 1] : null

  const moveArrow = (target: ColDef | null, dir: '‹' | '›') => target && (
    <Tooltip title={`Mover para "${target.label}"`} placement="top">
      <Box
        {...clickable(() => onMoveColumn!(target.status))}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onMoveColumn!(target.status) }}
        aria-label={`Mover para ${target.label}`}
        sx={{
          width: 22, height: 22, borderRadius: '6px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
          bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          transition: 'all 0.15s',
          '&:hover': { color: target.color, borderColor: `${target.color}55`, bgcolor: `${target.color}18` },
        }}
      >
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, lineHeight: 1, userSelect: 'none' }}>{dir}</Typography>
      </Box>
    </Tooltip>
  )

  return (
    <Paper
      elevation={0}
      onClick={bulkMode ? onSelect : (onView ? onView : undefined)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      sx={{
        px: 1.6, pt: 1.3, pb: 1.2,
        borderRadius: '12px',
        bgcolor: isDragging ? `${colColor}0c` : isSelected ? `${colColor}10` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isSelected ? colColor + '55' : DELAY_BORDER[delay]}`,
        outline: isSelected ? `2px solid ${colColor}40` : '2px solid transparent',
        opacity: isDragging ? 0.4 : 1,
        cursor: bulkMode ? 'pointer' : (onView ? 'pointer' : 'grab'),
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 72,
        transition: 'border 0.15s, background-color 0.15s, transform 0.18s ease, box-shadow 0.18s ease',
        // Card que acabou de trocar de coluna pisca a borda: sem isso ele some de
        // um lado e aparece do outro sem nenhum sinal de que a esteira agiu.
        animation: isDragging
          ? undefined
          : arrived
            ? `fadeInUp 0.22s cubic-bezier(0.16,1,0.3,1) both, arrivalGlow ${ARRIVAL_DURATION_MS}ms ease-out 0.22s both`
            : `fadeInUp 0.22s cubic-bezier(0.16,1,0.3,1) ${Math.min(staggerIndex * 25, 300)}ms both`,
        // A barra é o elemento mais visível do card, então carrega a informação mais
        // escassa: a urgência. A coluna já é dita pela posição — não precisa repetir.
        // No prazo, cai para a cor da coluna e o board fica silencioso.
        '&::before': {
          content: '""', position: 'absolute', left: 0, top: 0, bottom: 0,
          width: delay === 'ok' ? 3 : 4,
          bgcolor: delay === 'ok' ? colColor : DELAY_DOT[delay],
          boxShadow: delay === 'ok' ? 'none' : `0 0 10px ${DELAY_DOT[delay]}66`,
          borderRadius: '12px 0 0 12px',
        },
        '&:hover': {
          transform: isDragging ? undefined : 'translateY(-2px)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
          bgcolor: bulkMode ? `${colColor}12` : 'rgba(255,255,255,0.05)',
          border: `1px solid ${isSelected ? colColor + '66' : delay !== 'ok' ? DELAY_BORDER[delay] : colColor + '38'}`,
        },
      }}
    >
      {/* Bulk checkbox */}
      {bulkMode && (
        <Box sx={{
          position: 'absolute', top: 7, right: 7, zIndex: 10,
          width: 15, height: 15, borderRadius: '4px',
          bgcolor: isSelected ? colColor : 'rgba(255,255,255,0.09)',
          border: `1.5px solid ${isSelected ? colColor : 'rgba(255,255,255,0.20)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isSelected && <Typography sx={{ fontSize: '0.48rem', color: '#000', lineHeight: 1, fontWeight: 900 }}>✓</Typography>}
        </Box>
      )}

      {/* Persistência do move: salvando… / falhou (com retry). Discreto, canto superior. */}
      {!bulkMode && saveState === 'saving' && (
        <Box sx={{
          position: 'absolute', top: 6, right: 6, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 0.5,
          px: 0.7, py: 0.25, borderRadius: '6px',
          bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
        }}>
          <CircularProgress size={9} thickness={6} sx={{ color: 'rgba(255,255,255,0.55)' }} />
          <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.02em' }}>
            salvando
          </Typography>
        </Box>
      )}
      {!bulkMode && saveState === 'error' && (
        <Tooltip title="Não foi possível salvar. Toque para tentar de novo." placement="top">
          <Box
            {...clickable(() => onRetrySave?.())}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onRetrySave?.() }}
            aria-label="Tentar salvar novamente"
            sx={{
              position: 'absolute', top: 6, right: 6, zIndex: 10,
              display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
              px: 0.7, py: 0.25, borderRadius: '6px',
              bgcolor: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)',
              '&:hover': { bgcolor: 'rgba(239,68,68,0.24)' },
            }}
          >
            <WarningAmberIcon sx={{ fontSize: 10, color: DS.red }} />
            <Typography sx={{ fontSize: '0.52rem', fontWeight: 800, color: DS.red, letterSpacing: '0.02em' }}>
              tentar
            </Typography>
          </Box>
        </Tooltip>
      )}

      {/* Edit button — visible on hover */}
      {!bulkMode && hover && onEdit && (
        <Box
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onEdit() }}
          sx={{
            position: 'absolute', top: 5, right: onRemind && state.status === 4 ? 33 : 5, zIndex: 10,
            width: 24, height: 24, borderRadius: '7px', cursor: 'pointer',
            bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
          }}
        >
          <EditIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.60)' }} />
        </Box>
      )}

      {/* Nome do arquivo — Reel ainda em produção. O editor cola isto na
          exportação e o Drive reconhece o card sozinho, sem adivinhação.
          Mesmo slot do lembrete: status ≤3 e ===4 nunca coexistem. */}
      {/* Vale para todo tipo desde que a esteira busque na pasta Publicar — o
          Design depende deste nome tanto quanto o Vídeo. */}
      {!bulkMode && hover && isPreClientStatus(state.status) && (
        <Tooltip
          title={nameCopied
            ? 'Copiado! Cole no nome da exportação (sem extensão)'
            : `Copiar nome do arquivo: ${exportName(item, state)}`}
          placement="left"
        >
          <Box
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation()
              navigator.clipboard.writeText(exportName(item, state)).then(() => {
                setNameCopied(true)
                if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
                copyTimerRef.current = setTimeout(() => setNameCopied(false), 1600)
              }).catch(() => {})
            }}
            sx={{
              position: 'absolute', top: 5, right: 5, zIndex: 10,
              width: 24, height: 24, borderRadius: '7px', cursor: 'pointer',
              bgcolor: nameCopied ? `${DS.green}28` : 'rgba(6,182,212,0.15)',
              border: `1px solid ${nameCopied ? `${DS.green}55` : 'rgba(6,182,212,0.30)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease',
              '&:hover': { bgcolor: nameCopied ? `${DS.green}38` : 'rgba(6,182,212,0.28)' },
            }}
          >
            <DriveFileRenameOutlineIcon sx={{ fontSize: 12, color: nameCopied ? DS.green : DS.cyan }} />
          </Box>
        </Tooltip>
      )}

      {/* Remind button — visible on hover, only for status 4 */}
      {!bulkMode && hover && onRemind && state.status === 4 && state.approvalToken && (
        <Box
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onRemind() }}
          sx={{
            position: 'absolute', top: 5, right: 5, zIndex: 10,
            width: 24, height: 24, borderRadius: '7px', cursor: 'pointer',
            bgcolor: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: 'rgba(37,211,102,0.28)' },
          }}
        >
          <WhatsAppIcon sx={{ fontSize: 12, color: '#25D366' }} />
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1.1, alignItems: 'stretch' }}>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Top row: type pill + client */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.6, pr: !bulkMode && onEdit && preview.kind === 'none' ? 3.2 : 0 }}>
        <Box sx={{ px: 0.6, py: '2px', borderRadius: '5px', flexShrink: 0, bgcolor: `${tc}1f`, border: `1px solid ${tc}33` }}>
          <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: tc, lineHeight: 1, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            {item.tp}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.50)', fontWeight: 600, flex: 1, lineHeight: 1 }} noWrap>
          {item.c}
        </Typography>
        {state.priority === 'alta' && (
          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: DS.red, flexShrink: 0, opacity: 0.9 }} />
        )}
        {state.priority === 'media' && (
          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: DS.amber, flexShrink: 0, opacity: 0.8 }} />
        )}
      </Box>

      {/* Title */}
      <Typography sx={{
        fontSize: { md: '0.8rem', xl: '0.88rem' },
        fontWeight: 700,
        color: 'rgba(255,255,255,0.90)',
        lineHeight: 1.35,
        mb: 0.85,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {state.title || item.n}
      </Typography>

      {/* Bottom row: delay dot + date + secondary date + responsible */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 'auto' }}>
        <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: DELAY_DOT[delay], flexShrink: 0 }} />
        <Typography sx={{
          fontSize: '0.6rem', lineHeight: 1, flex: 1,
          color: delay === 'ok' ? 'rgba(255,255,255,0.30)' : DELAY_DOT[delay],
          fontWeight: delay === 'ok' ? 400 : 700,
        }}>
          {activeLabel}
        </Typography>
        {/* SLA: days waiting at client */}
        {state.status === 4 && state.sentToClientAt && (() => {
          const days = Math.floor((Date.now() - state.sentToClientAt) / 86400000)
          if (days < 1) return null
          const color = days >= 3 ? '#EF4444' : days >= 2 ? '#F59E0B' : '#60A5FA'
          return (
            <Box sx={{ px: 0.6, py: 0.15, borderRadius: '4px', flexShrink: 0,
              bgcolor: `${color}12`, border: `1px solid ${color}30` }}>
              <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, color, lineHeight: 1 }}>
                {days}d c/ cli
              </Typography>
            </Box>
          )
        })()}
        {/* O que aconteceu na tela do cliente. Falha aqui é urgente: ele está
            com o link na mão e não consegue ver — e antes disso só descobríamos
            se ele reclamasse. "Viu" também importa: separa quem não abriu de
            quem abriu e não respondeu. */}
        {viewer?.failedAt && (
          <Tooltip title={`Falhou em ${shortPlatform(viewer.platform)} · ${new Date(viewer.failedAt).toLocaleString('pt-BR')}${viewer.failDetail ? ` · ${viewer.failDetail}` : ''}`}>
            <Box sx={{ px: 0.6, py: 0.15, borderRadius: '4px', flexShrink: 0,
              bgcolor: `${DS.red}14`, border: `1px solid ${DS.red}40` }}>
              <Typography sx={{ fontSize: '0.52rem', fontWeight: 800, color: DS.red, lineHeight: 1 }}>
                não abriu
              </Typography>
            </Box>
          </Tooltip>
        )}
        {!viewer?.failedAt && viewer?.openedAt && (
          <Tooltip title={`Cliente abriu em ${new Date(viewer.openedAt).toLocaleString('pt-BR')}${viewer.playedAt ? ' · assistiu' : ' · não chegou a assistir'} · ${shortPlatform(viewer.platform)}`}>
            <Box sx={{ px: 0.6, py: 0.15, borderRadius: '4px', flexShrink: 0,
              bgcolor: `${DS.green}12`, border: `1px solid ${DS.green}30` }}>
              <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, color: DS.green, lineHeight: 1 }}>
                {viewer.playedAt ? 'assistiu' : 'abriu'}
              </Typography>
            </Box>
          </Tooltip>
        )}
        {resp && (
          <Tooltip title={`${resp.emoji} ${state.responsible} · ${resp.role}`}>
            <Box sx={{
              flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
              bgcolor: `${resp.color}20`, border: `1.5px solid ${resp.color}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.6rem', lineHeight: 1,
            }}>
              {resp.emoji}
            </Box>
          </Tooltip>
        )}
      </Box>
      </Box>

      {/* Miniatura do criativo — só com arquivo desta card, deste cliente, na pasta Publicar.
          Em Revisão interna ela vira o botão de assistir: a tela de aprovar já
          existia, mas só abria sozinha logo depois da esteira vincular. Quem
          chegasse depois no card não tinha por onde. */}
      {preview.kind === 'ready' && (
        <Tooltip title={canReview ? 'Assistir e aprovar aqui' : ''} placement="left">
          <Box
            {...(canReview ? clickable(() => onReview?.(preview.fileId.replace(/^drive:/, ''))) : {})}
            onClick={canReview ? e => { e.stopPropagation(); onReview?.(preview.fileId.replace(/^drive:/, '')) } : undefined}
            onPointerDown={canReview ? e => e.stopPropagation() : undefined}
            sx={{
              width: 46, flexShrink: 0, alignSelf: 'stretch', minHeight: 46,
              borderRadius: '8px', overflow: 'hidden', position: 'relative',
              border: '1px solid rgba(255,255,255,0.08)',
              bgcolor: 'rgba(255,255,255,0.04)',
              backgroundImage: `url(${preview.thumbUrl})`, backgroundSize: 'cover', backgroundPosition: 'center',
              cursor: canReview ? 'pointer' : undefined,
              transition: 'transform 0.18s ease, border-color 0.18s ease',
              '&:hover': canReview ? { transform: 'scale(1.04)', borderColor: `${DS.cyan}66` } : undefined,
            }}
          >
            {canReview && (
              <Box sx={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: 'rgba(0,0,0,0.35)',
              }}>
                <PlayArrowIcon sx={{ fontSize: 18, color: '#fff', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))' }} />
              </Box>
            )}
          </Box>
        </Tooltip>
      )}
      {preview.kind === 'pending' && (
        <Tooltip title={preview.label}>
          <Box sx={{
            width: 46, flexShrink: 0, alignSelf: 'stretch', minHeight: 46,
            borderRadius: '8px', border: '1px dashed rgba(148,163,184,0.22)',
            bgcolor: 'rgba(148,163,184,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography sx={{ fontSize: '0.72rem', opacity: 0.45 }}>⏳</Typography>
          </Box>
        </Tooltip>
      )}
      </Box>

      {/* Faixa da esteira em Produção: só aparece quando a detecção precisa de um
          humano — vários arquivos compatíveis, arquivo que não abre, ou falha de
          acesso. Enquanto a busca corre em silêncio (ou ainda não há arquivo na
          pasta), o card fica limpo. Achou e validou → o card já subiu sozinho
          para Revisão, então esta faixa nem chega a aparecer. */}
      {state.status === 1 && ready && (ready.phase === 'ambiguous' || ready.phase === 'invalid' || ready.phase === 'error') && (
        <ReadyStrip
          ready={ready}
          cardCode={exportCodeFor(item.i)}
          onRetry={onRetryReady}
          onManualLink={onManualLinkReady}
          onBackToProduction={undefined}
          onGoToReview={undefined}
          onSendToReview={undefined}
        />
      )}

      {/* Revisão interna: envio manual ao grupo de revisão no WhatsApp. É o ÚNICO
          caminho — arrastar para Revisão não dispara mais mensagem nenhuma. Fica
          desabilitado enquanto a prévia do vídeo não está pronta e explica por quê. */}
      {state.status === 2 && onSendReview && (() => {
        const canSend = preview.kind === 'ready'
        // Já foi ao grupo: o card deixa de oferecer o mesmo botão em destaque e
        // passa a mostrar o estágio real, com reenvio discreto. Sem isso não dava
        // para saber se o link já tinha sido mandado — e alguém mandava de novo.
        const jaEnviado = !!state.whatsappOpenedAt
        const label = !canSend ? 'Aguardando prévia' : jaEnviado ? 'Enviado p/ revisão · reenviar' : 'Enviar para revisão'
        const tip = !canSend
          ? 'Aguardando processamento da prévia do vídeo'
          : jaEnviado
            ? `Link já enviado ao grupo em ${new Date(state.whatsappOpenedAt!).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}. Clique para reenviar.`
            : 'Gera o link e abre o grupo de revisão no WhatsApp'

        return (
          <Tooltip title={tip} placement="top">
            <Box>
              <Box
                {...(canSend ? clickable(() => onSendReview()) : {})}
                onPointerDown={e => e.stopPropagation()}
                onClick={canSend ? e => { e.stopPropagation(); onSendReview() } : undefined}
                aria-disabled={!canSend}
                aria-label="Enviar para revisão interna no WhatsApp"
                sx={{
                  mt: 0.8, py: 0.7, borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6,
                  fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.01em',
                  cursor: canSend ? 'pointer' : 'not-allowed',
                  color: !canSend ? 'rgba(255,255,255,0.4)' : jaEnviado ? DS.green : '#fff',
                  background: !canSend
                    ? 'rgba(255,255,255,0.04)'
                    : jaEnviado ? `${DS.green}14` : 'linear-gradient(90deg,#3B82F6,#06B6D4)',
                  border: canSend && !jaEnviado ? 'none' : `1px solid ${jaEnviado && canSend ? `${DS.green}3a` : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: canSend && !jaEnviado ? '0 4px 14px rgba(59,130,246,0.28)' : 'none',
                  '&:hover': canSend ? { filter: 'brightness(1.06)', transform: 'translateY(-1px)' } : undefined,
                  transition: 'all 0.15s',
                }}
              >
                {canSend && jaEnviado
                  ? <CheckCircleIcon sx={{ fontSize: 12 }} />
                  : <WhatsAppIcon sx={{ fontSize: 13 }} />}
                {label}
              </Box>
            </Box>
          </Tooltip>
        )
      })()}

      {/* Setas de coluna — o plano B do arraste. SEMPRE visíveis (discretas), não
          só no hover: no celular e no touch não existe hover, e é exatamente lá
          que o arraste falha e a seta é mais necessária. Sobem de opacidade sob o
          mouse. Focáveis pelo teclado; num toque falho do drag, um clique resolve. */}
      {!bulkMode && (prevCol || nextCol) && (
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 0.5, mt: 0.7, pt: 0.6, borderTop: '1px solid rgba(255,255,255,0.05)',
          opacity: hover ? 1 : 0.5, transition: 'opacity 0.15s',
        }}>
          {moveArrow(prevCol, '‹') || <Box sx={{ width: 22 }} />}
          <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            mover
          </Typography>
          {moveArrow(nextCol, '›') || <Box sx={{ width: 22 }} />}
        </Box>
      )}
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
                        <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.13)', fontWeight: 600, letterSpacing: '0.04em' }}>
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
              setRenameDialogOpen(true)
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
            O material de <strong style={{ color: '#3B82F6' }}>{sendConfirmDrag?.clientName}</strong> foi enviado para aprovação?
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
            sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #3B82F6, #06B6D4)', color: '#fff' }}
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
        PaperProps={{ sx: { bgcolor: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px' } }}
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

// ── Props ─────────────────────────────────────────────────

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, s: Status) => void
  onDelete?: (id: number) => void
  onEdit?: (id: number, patch: ItemEditPatch) => void
  onUpdateState?: (id: number, patch: Partial<ItemState>) => void
  onAddItem?: (clientName: string, title: string, type: ContentType, date: Date, status: Status, responsible?: string, notes?: string, footageLink?: string, roteiroLink?: string, deliveryDate?: number) => void
  onDuplicate?: (id: number) => void
  allClients?: Client[]
  onSendToClient?: (itemId: number, clientName: string, isTraffic?: boolean) => void
  onSendToReview?: (itemId: number, clientName: string) => void
  onAutoDetected?: (info: { itemId: number; clientName: string; itemName: string; videoName: string; driveUrl: string }) => void
  /** Abre a revisão no WhatsApp; recebe a aba reservada no gesto do arraste. */
  onReviewNotify?: (itemId: number, clientName: string, reservedTab?: Window | null) => Promise<boolean>
  /** Append atômico no histórico — a esteira grava vários passos no mesmo tick. */
  onAppendHistory?: (itemId: number, action: string) => void
  /** Board pedido de fora (toast "Abrir Inbox"); o índice é o de BOARDS. */
  boardRequest?: number | null
  onBoardRequestDone?: () => void
  onBulkSendToClient?: (clientName: string, itemIds: number[]) => void
  onRemindClient?: (itemId: number, clientName: string) => void
  clientColors?: Record<string, string>
  clientHashtags?: Record<string, string[]>
  captionTemplates?: Record<string, string[]>
  onSaveHashtags?: (clientName: string, tags: string[]) => void
  onSaveTemplates?: (clientName: string, templates: string[]) => void
  currentUser?: string
  roteiros?: Record<string, import('../types').Roteiro[]>
  clientFolders?: Record<string, string>
  /** Pasta Publicar por cliente (sm_publish_folders) — é ela que a esteira varre. */
  publishFolders?: Record<string, string>
  onUpdateRoteiro?: (clientName: string, roteiroId: string, patch: Partial<Pick<import('../types').Roteiro, 'title' | 'type' | 'driveLink' | 'docsLink' | 'refLink' | 'deadline' | 'status'>>) => void
  onImportRoteiroBatch?: (clientName: string, items: Array<{ title: string; type: ContentType; docsLink: string }>, year: number, month: number) => void
  onDeleteManyRoteiros?: (ids: string[]) => void
  onAddRoteiro?: (clientName: string, r: Omit<import('../types').Roteiro, 'id' | 'clientName' | 'distributed'>, year: number, month: number) => void
  onAddManyRoteiros?: (clientName: string, list: Array<{ title: string; type: import('../types').ContentType; docsLink: string }>, year: number, month: number) => void
}

// ── Main ─────────────────────────────────────────────────

// Tipo padrão sugerido por board ao criar card
const BOARD_DEFAULT_TYPE: ContentType[] = ['Reel', 'Post', 'Feed', 'Post']
// Status padrão sugerido por board
const BOARD_DEFAULT_STATUS: Status[] = [0, 0, 0, 2]
const TABLE_PAGE_SIZE = 25
// Revarredura da pasta para cards esperando em Pronto. Mesmo ritmo do scan do
// Drive: adiantar não ajuda, o arquivo demora a aparecer de qualquer jeito.
const READY_SWEEP_MS = 90_000
const FILES_CACHE_MS = 20_000

// Barra de scroll horizontal customizada — FIXA no rodapé da viewport, alinhada
// à área das colunas. O board pode ter milhares de px de altura (a nativa fica
// lá embaixo, inalcançável); esta flutua sempre visível e é arrastável, com o
// thumb no gradiente do board.
function BoardScrollbar({ targetRef, color }: { targetRef: React.RefObject<HTMLDivElement>; color: string }) {
  const [m, setM] = useState({ ratio: 1, left: 0, scrollable: false, x: 0, w: 0 })
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startScroll: number } | null>(null)

  const recompute = useCallback(() => {
    const el = targetRef.current
    if (!el) return
    const { scrollWidth, clientWidth, scrollLeft } = el
    const scrollable = scrollWidth - clientWidth > 4
    const r = el.getBoundingClientRect()
    setM({
      ratio: scrollable ? clientWidth / scrollWidth : 1,
      left:  scrollable ? scrollLeft / scrollWidth : 0,
      scrollable,
      x: r.left,
      w: r.width,
    })
  }, [targetRef])

  useEffect(() => {
    const el = targetRef.current
    if (!el) return
    recompute()
    el.addEventListener('scroll', recompute, { passive: true })
    const ro = new ResizeObserver(recompute)
    ro.observe(el)
    window.addEventListener('resize', recompute)
    // captura scroll de qualquer ancestral (o board rola vertical) p/ manter alinhado
    window.addEventListener('scroll', recompute, true)
    return () => {
      el.removeEventListener('scroll', recompute)
      ro.disconnect()
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute, true)
    }
  }, [targetRef, recompute])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const st = dragRef.current
      const el = targetRef.current
      const trackW = trackRef.current?.clientWidth
      if (!st || !el || !trackW) return
      el.scrollLeft = st.startScroll + ((e.clientX - st.startX) / trackW) * el.scrollWidth
    }
    const onUp = () => { dragRef.current = null; document.body.style.userSelect = '' }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [targetRef])

  if (!m.scrollable) return null

  return (
    <Portal>
    <Box sx={{
      position: 'fixed', bottom: 14, zIndex: 1200,
      left: `${m.x + 12}px`, width: `${Math.max(m.w - 24, 0)}px`,
      pointerEvents: 'auto',
    }}>
      <Box
        ref={trackRef}
        onPointerDown={(e) => {
          const el = targetRef.current
          const rect = e.currentTarget.getBoundingClientRect()
          if (!el) return
          const r = (e.clientX - rect.left) / rect.width
          el.scrollTo({ left: r * el.scrollWidth - el.clientWidth / 2, behavior: 'smooth' })
        }}
        sx={{
          position: 'relative', height: 10, borderRadius: 6, cursor: 'pointer',
          bgcolor: 'rgba(18,18,20,0.9)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
          '&:hover .bs-thumb': { filter: 'brightness(1.15)' },
        }}
      >
        <Box
          className="bs-thumb"
          onPointerDown={(e) => {
            e.stopPropagation()
            const el = targetRef.current
            if (!el) return
            dragRef.current = { startX: e.clientX, startScroll: el.scrollLeft }
            document.body.style.userSelect = 'none'
          }}
          sx={{
            position: 'absolute', top: -1, bottom: -1,
            left: `${m.left * 100}%`, width: `${m.ratio * 100}%`, minWidth: 48,
            borderRadius: 6, cursor: 'grab',
            background: `linear-gradient(90deg, ${color}, ${color}aa)`,
            boxShadow: `0 0 14px ${color}66, inset 0 1px 0 rgba(255,255,255,0.3)`,
            transition: dragRef.current ? 'none' : 'left 0.08s linear',
            '&:active': { cursor: 'grabbing' },
          }}
        />
      </Box>
    </Box>
    </Portal>
  )
}

export default function ProducaoTab({ items, states, onStatusChange, onDelete, onEdit, onUpdateState, onAddItem, onDuplicate, allClients, onSendToClient, onSendToReview, onAutoDetected, onReviewNotify, onAppendHistory, boardRequest = null, onBoardRequestDone, onBulkSendToClient, onRemindClient, clientColors, clientHashtags, captionTemplates, onSaveHashtags, onSaveTemplates, currentUser, roteiros = {}, clientFolders = {}, publishFolders = {}, onUpdateRoteiro, onImportRoteiroBatch, onDeleteManyRoteiros, onAddRoteiro, onAddManyRoteiros }: Props) {
  const [subTab, setSubTab]         = useState(0)
  const [filterClient, setFilterClient] = useState('all')
  const [filterToday, setFilterToday]   = useState(false)
  const [filterOverdue, setFilterOverdue] = useState(false)
  const [filterPriority, setFilterPriority] = useState<'all' | 'alta' | 'media' | 'baixa'>('all')
  const [filterResponsible, setFilterResponsible] = useState('all')
  const [filterStuck, setFilterStuck] = useState(false)
  /** Busca do board: casa cliente, título do card e nome original do conteúdo. */
  const [boardSearch, setBoardSearch] = useState('')
  /** Estado do criativo: com prévia pronta ou ainda sem arquivo utilizável. */
  const [filterPreview, setFilterPreview] = useState<'all' | 'ready' | 'missing'>('all')
  const [showCapacity, setShowCapacity] = useState(false)
  const [bulkMode, setBulkMode]     = useState(false)
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>(() => loadUploadTasks().filter(t => !t.confirmedAt))
  const [roteiroViewMonth, setRoteiroViewMonth] = useState(new Date().getMonth())
  const [roteiroViewYear, setRoteiroViewYear] = useState(new Date().getFullYear())
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<Status>(1)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  // Item 9: bulk send per client — which client to send for
  const [bulkSendClientMenu, setBulkSendClientMenu] = useState<HTMLElement | null>(null)
  const [planejamentoOpen, setPlanejamentoOpen] = useState(false)

  // ── Table view state ──────────────────────────────────────
  const [layoutView, setLayoutView] = useState<'kanban' | 'table'>('kanban')
  const [tableFilterBoard, setTableFilterBoard]     = useState<'all' | 0 | 1 | 2 | 3>('all')
  const [tableSearch, setTableSearch]               = useState('')
  const [tablePage, setTablePage]                   = useState(0)
  const [tableHidePublished, setTableHidePublished] = useState(true)
  const [tableStatusFilter, setTableStatusFilter]   = useState<number | 'all'>('all')
  const [tableSortDir, setTableSortDir]             = useState<'asc' | 'desc'>('asc')

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
  const [addOpen, setAddOpen]           = useState(false)
  const [addClient, setAddClient]       = useState('')
  const [addTitle, setAddTitle]         = useState('')
  const [addType, setAddType]           = useState<ContentType>('Post')
  const [addDate, setAddDate]           = useState(() => toLocalDateInput())
  const [addDeliveryDate, setAddDeliveryDate] = useState('')
  const [addStatus, setAddStatus]       = useState<Status>(0)
  const [addRotStatus, setAddRotStatus] = useState<RoteiroStatus>('ideia')
  const [addFootageLink, setAddFootageLink] = useState('')
  const [addRoteiroLink, setAddRoteiroLink] = useState('')

  const handleOpenAdd = () => {
    setAddClient(filterClient !== 'all' ? filterClient : '')
    setAddType(subTab === 4 ? 'Reel' : BOARD_DEFAULT_TYPE[subTab])
    setAddStatus(BOARD_DEFAULT_STATUS[subTab])
    setAddRotStatus('ideia')
    setAddDate(toLocalDateInput())
    setAddDeliveryDate('')
    setAddTitle('')
    setAddFootageLink('')
    setAddRoteiroLink('')
    setAddOpen(true)
  }

  const handleAddSubmit = () => {
    if (!addClient || !addTitle.trim()) return
    // Board Roteiros (subTab 4): cria um Roteiro no mês selecionado, não um item de conteúdo
    if (subTab === 4) {
      if (!onAddRoteiro) return
      const deadlineTs = addDate ? new Date(addDate + 'T12:00:00').getTime() : undefined
      onAddRoteiro(addClient, {
        title: addTitle.trim(),
        type: addType,
        docsLink: addRoteiroLink.trim() || undefined,
        status: addRotStatus,
        deadline: deadlineTs,
        year: roteiroViewYear,
        month: roteiroViewMonth,
      }, roteiroViewYear, roteiroViewMonth)
      setAddOpen(false)
      return
    }
    const deliveryTs = addDeliveryDate ? new Date(addDeliveryDate + 'T12:00:00').getTime() : undefined
    onAddItem?.(addClient, addTitle.trim(), addType, new Date(addDate + 'T12:00:00'), addStatus, undefined, undefined, addFootageLink.trim() || undefined, addRoteiroLink.trim() || undefined, deliveryTs)
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

  // ── Quick edit dialog (lápis no mini-card → todas as informações) ──────
  const [quickEditId, setQuickEditId] = useState<number | null>(null)
  const handleOpenQuickEdit = useCallback((id: number) => {
    setQuickEditId(id)
  }, [])

  useEffect(() => { setBulkSelected(new Set()); setBulkMode(false) }, [subTab])

  // Board pedido de fora (o toast global de arquivo novo abre a Inbox aqui).
  useEffect(() => {
    if (boardRequest === null || boardRequest === undefined) return
    if (boardRequest >= 0 && boardRequest < BOARDS.length) setSubTab(boardRequest)
    onBoardRequestDone?.()
  }, [boardRequest, onBoardRequestDone])

  // Busca upload tasks do D1 ao montar (Kaique salva, Arthur recebe)
  useEffect(() => {
    fetch('/api/sync?key=sm_upload_tasks')
      .then(r => r.json())
      .then((data: { value?: string }) => {
        if (!data.value) return
        const remote: UploadTask[] = JSON.parse(data.value)
        localStorage.setItem('sm_upload_tasks', JSON.stringify(remote))
        setUploadTasks(remote.filter(t => !t.confirmedAt))
      })
      .catch(() => {})
  }, [])

  const toggleBulk = (id: number) => {
    setBulkSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function applyBulkStatus() {
    if (bulkStatus === 4) return
    bulkSelected.forEach(id => onStatusChange(id, bulkStatus))
    setBulkSelected(new Set()); setBulkMode(false)
  }

  function applyBulkDelete() {
    bulkSelected.forEach(id => onDelete?.(id))
    setBulkSelected(new Set()); setBulkMode(false); setBulkDeleteConfirm(false)
  }

  const clientOptions = useMemo(() => (allClients ?? []).map(c => c.name).sort(), [allClients])

  const activeCols = BOARDS[subTab].cols

  // ── Inbox do Drive ───────────────────────────────────────
  // Um único ponto busca os vídeos, reconcilia os vínculos e conta os pendentes.
  // O board e o painel lateral leem daqui — nada abre modal sozinho.
  const [inboxToast, setInboxToast] = useState<{ msg: string; severity: 'info' | 'error' } | null>(null)
  const [inboxOpen, setInboxOpen]   = useState(false)
  const [linkVideo, setLinkVideo]   = useState<DriveVideo | null>(null)
  const [linkSaving, setLinkSaving] = useState(false)

  // Quem busca e avisa da chegada é o App (roda com qualquer aba aberta); aqui
  // só lemos o resultado. O toast local ficou para os erros desta tela.
  const {
    videos, loading: inboxLoading, refresh: refreshInbox,
    inboxState, pendingVideos, ignoredVideos, pendingCount,
  } = useDriveInbox({ items })

  const driveInboxCount = pendingCount

  const patchVideo = useCallback(async (
    fileId: string,
    updates: { status?: string; linked_item_id?: number | null },
    // Identificação do arquivo: permite ao servidor criar a linha quando ela
    // ainda não existe (arquivo achado pela esteira, antes de qualquer scan).
    identity?: { client_name: string; filename: string },
  ) => {
    const res = await fetch('/api/drive-videos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drive_file_id: fileId, ...updates, ...identity }),
    })
    if (!res.ok) throw new Error(`drive-videos PATCH ${res.status}`)
  }, [])

  /**
   * Vincula por decisão explícita do usuário. Grava o vínculo no registro central
   * (é ele que autoriza a prévia) e marca o arquivo como resolvido na Inbox.
   */
  const handleLinkVideo = useCallback(async (video: DriveVideo, item: ContentItem, sendToReview: boolean) => {
    setLinkSaving(true)
    try {
      await patchVideo(video.drive_file_id, { status: 'linked', linked_item_id: item.i })
      const driveUrl = `https://drive.google.com/file/d/${video.drive_file_id}/view`
      onUpdateState?.(item.i, { footageLink: driveUrl, link: driveUrl })
      upsertMediaLink({
        itemId: item.i, clientId: item.c, url: driveUrl,
        fileId: `drive:${video.drive_file_id}`,
        folderStage: 'publicar', source: 'drive', confirmed: true,
        filename: video.filename,
      })
      markFileLinked(video.drive_file_id)
      void mirrorFile(video.drive_file_id)
      setLinkVideo(null)
      refreshInbox()
      if (sendToReview) {
        onAutoDetected?.({
          itemId: item.i, clientName: item.c,
          itemName: states[item.i]?.title || item.n,
          videoName: video.filename, driveUrl,
        })
      }
    } catch (e) {
      console.error('[driveInbox] falha ao vincular vídeo', e)
      setInboxToast({ severity: 'error', msg: 'Não foi possível vincular o arquivo. Tente de novo.' })
    } finally {
      setLinkSaving(false)
    }
  }, [patchVideo, onUpdateState, onAutoDetected, states, refreshInbox])

  const handleIgnoreVideo = useCallback(async (video: DriveVideo) => {
    markFileIgnored(video.drive_file_id)
    removeMediaLinkForFile(`drive:${video.drive_file_id}`)
    try {
      await patchVideo(video.drive_file_id, { status: 'ignored' })
    } catch (e) {
      console.error('[driveInbox] falha ao ignorar arquivo', e)
    }
    refreshInbox()
  }, [patchVideo, refreshInbox])

  const handleIgnoreAll = useCallback(async (targets: DriveVideo[]) => {
    await Promise.all(targets.map(v => handleIgnoreVideo(v)))
  }, [handleIgnoreVideo])

  const handleRemindLater = useCallback((video: DriveVideo) => {
    remindFileLater(video.drive_file_id)
  }, [])

  const handleCloseInbox = useCallback(() => {
    setInboxOpen(false)
    dismissFiles(pendingVideos.map(v => v.drive_file_id))
  }, [pendingVideos])

  // ── Esteira da coluna Pronto ─────────────────────────────
  const [readyPicker, setReadyPicker] = useState<{ itemId: number; loading: boolean; files: DriveFile[]; error?: string } | null>(null)
  const [reviewModal, setReviewModal] = useState<{ itemId: number; fileId: string; filename?: string } | null>(null)

  const {
    readyStates, handleReadyDrop, handleRetryReady, handleSendReadyToReview,
    listCandidates, linkFileManually,
  } = useReadyEsteira({
    items, states, onStatusChange, onUpdateState, onAppendHistory, onReviewNotify,
    onOpenReview: setReviewModal,
    // A revarredura é do App — aqui o motor serve só aos gestos desta tela.
    enableSweep: false,
  })

  /** Abre a seleção manual e delega o vínculo ao motor da esteira. */
  const handleManualLinkReady = useCallback(async (itemId: number) => {
    setReadyPicker({ itemId, loading: true, files: [] })
    const { files, error } = await listCandidates(itemId)
    setReadyPicker({ itemId, loading: false, files, error })
  }, [listCandidates])

  const handlePickReadyFile = useCallback(async (itemId: number, file: DriveFile) => {
    setReadyPicker(null)
    await linkFileManually(itemId, file)
  }, [linkFileManually])

  // ── Problemas para resolver ───────────────────────────────
  // Deliberadamente global (não por board): o problema não deixa de existir
  // porque você está olhando outra aba — e é justamente o card esquecido que
  // trava a entrega.
  const boardMediaLinks = useMediaLinks()
  const productionIssues = useMemo(
    () => computeProductionIssues(items, states, boardMediaLinks, readyStates),
    [items, states, boardMediaLinks, readyStates],
  )

  const handleIssueAction = useCallback((issue: ProductionIssue) => {
    if (issue.action === 'retry_detect') handleRetryReady(issue.itemId)
    else void handleManualLinkReady(issue.itemId)
  }, [handleRetryReady, handleManualLinkReady])

  // ── Item counts per board (badge numbers) ────────────────
  const counts = useMemo(() => {
    const videoFn   = (tp: string) => tp === 'Reel'
    const designFn  = (tp: string) => tp === 'Post' || tp === 'Story' || tp === 'Carrossel'
    const feedFn    = (tp: string) => tp === 'Feed'
    const fns = [videoFn, designFn, feedFn, () => true]
    const kanbanCounts = fns.map((fn, bi) => {
      let n = 0
      items.forEach(item => {
        if (!fn(item.tp)) return
        const st = states[item.i]?.status ?? item.s
        if (BOARDS[bi].cols.some(c => c.status === st)) n++
      })
      return n
    })
    // Contagem de roteiros (board index 4)
    const roteiroCount = Object.values(roteiros).reduce((sum, list) => sum + list.length, 0)
    return [...kanbanCounts, roteiroCount, driveInboxCount]
  }, [items, states, roteiros, driveInboxCount])

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

  // ── Combined active filter (base + quick filters) ─────────
  const activeBoardFilter = useMemo(() => {
    const baseFn = filterFns[subTab] ?? (() => true)
    const busca = boardSearch.trim().toLowerCase()
    return (item: ContentItem, st: ItemState) => {
      if (!baseFn(item, st)) return false
      const dtMs = new Date(item.dt).setHours(0, 0, 0, 0)
      const todayMs = new Date().setHours(0, 0, 0, 0)
      if (filterToday) {
        if (dtMs > todayMs || !isOpenStatus(st.status)) return false
      }
      if (filterOverdue) {
        if (dtMs >= todayMs || !isOpenStatus(st.status)) return false
      }
      if (filterStuck) {
        if (!isOpenStatus(st.status)) return false
        const sevenDaysAgo = todayMs - 7 * 86400000
        // status 4: use sentToClientAt; others: use publication date
        const refMs = st.status === 4 && st.sentToClientAt
          ? new Date(st.sentToClientAt).setHours(0, 0, 0, 0)
          : dtMs
        if (refMs > sevenDaysAgo) return false
      }
      if (filterPriority !== 'all' && st.priority !== filterPriority) return false
      if (filterResponsible !== 'all' && st.responsible !== filterResponsible) return false

      if (filterPreview !== 'all') {
        const pronta = getCardPreview(item, boardMediaLinks, st.status).kind === 'ready'
        if (filterPreview === 'ready' && !pronta) return false
        if (filterPreview === 'missing' && pronta) return false
      }

      if (busca) {
        const alvo = `${item.c} ${st.title || ''} ${item.n}`.toLowerCase()
        if (!alvo.includes(busca)) return false
      }
      return true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, filterToday, filterOverdue, filterStuck, filterPriority, filterResponsible, filterPreview, boardMediaLinks, boardSearch])

  // ── KPI metrics for current board ──────────────────────────
  const kpiData = useMemo(() => {
    if (subTab >= 4) return null
    const baseFn = filterFns[subTab] ?? (() => true)
    const todayMs = new Date().setHours(0, 0, 0, 0)
    const weekAgoMs = todayMs - 7 * 86400000
    let overdue = 0, dueToday = 0, pendingApproval = 0, publishedWeek = 0, reprovados = 0, total = 0
    let publishedToday = 0, sentToClient = 0, approvedByClient = 0
    items.forEach(item => {
      const st = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
      if (filterClient !== 'all' && item.c !== filterClient) return
      if (!baseFn(item, st)) return
      total++
      const dtMs = new Date(item.dt).setHours(0, 0, 0, 0)
      if (dtMs < todayMs && isOpenStatus(st.status)) overdue++
      if (dtMs === todayMs && isOpenStatus(st.status)) dueToday++
      if (st.status === 2 || st.status === 3 || st.status === 4) pendingApproval++
      if (st.status === 7 && st.publishedAt && st.publishedAt >= weekAgoMs) publishedWeek++
      if (st.status === 7 && st.publishedAt && st.publishedAt >= todayMs) publishedToday++
      if (st.status === 6) reprovados++
      if (!isPreClientStatus(st.status)) sentToClient++
      if (st.status === 5 || st.status === 7) approvedByClient++
    })
    const approvalRate = sentToClient > 0 ? Math.round((approvedByClient / sentToClient) * 100) : null
    return { total, overdue, dueToday, pendingApproval, publishedWeek, reprovados, publishedToday, approvalRate }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, states, subTab, filterClient])

  // ── Bottleneck indicators ──────────────────────────────────
  const bottlenecks = useMemo(() => {
    if (subTab >= 4) return []
    const baseFn = filterFns[subTab] ?? (() => true)
    const todayMs = new Date().setHours(0, 0, 0, 0)
    type BotEntry = { count: number; maxDays: number }
    const cat: Record<string, BotEntry> = {
      editor: { count: 0, maxDays: 0 },
      social: { count: 0, maxDays: 0 },
      client: { count: 0, maxDays: 0 },
    }
    items.forEach(item => {
      const st = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
      if (filterClient !== 'all' && item.c !== filterClient) return
      if (!baseFn(item, st)) return
      const dtMs = new Date(item.dt).setHours(0, 0, 0, 0)
      if (dtMs >= todayMs || st.status === 7 || st.status === 5) return
      const daysSinceDt = Math.floor((todayMs - dtMs) / 86400000)
      if (st.status === 0 || st.status === 1 || st.status === 6) {
        cat.editor.count++
        cat.editor.maxDays = Math.max(cat.editor.maxDays, daysSinceDt)
      } else if (st.status === 2 || st.status === 3) {
        cat.social.count++
        cat.social.maxDays = Math.max(cat.social.maxDays, daysSinceDt)
      } else if (st.status === 4) {
        cat.client.count++
        const sentAt = st.sentToClientAt ? new Date(st.sentToClientAt).setHours(0, 0, 0, 0) : dtMs
        cat.client.maxDays = Math.max(cat.client.maxDays, Math.floor((todayMs - sentAt) / 86400000))
      }
    })
    const result: Array<{ label: string; count: number; color: string; maxDays: number }> = []
    if (cat.editor.count > 0) result.push({ label: 'editor', count: cat.editor.count, color: '#C084FC', maxDays: cat.editor.maxDays })
    if (cat.social.count > 0) result.push({ label: 'social', count: cat.social.count, color: '#60A5FA', maxDays: cat.social.maxDays })
    if (cat.client.count > 0) result.push({ label: 'cliente', count: cat.client.count, color: '#60A5FA', maxDays: cat.client.maxDays })
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, states, subTab, filterClient])

  // ── Capacity per team member ───────────────────────────────
  const capacityData = useMemo(() => {
    const counts: Record<string, number> = {}
    items.forEach(item => {
      const st = states[item.i]
      if (!st) return
      if (st.status === 7 || st.status === 5) return
      if (st.responsible) counts[st.responsible] = (counts[st.responsible] ?? 0) + 1
    })
    return Object.entries(NAME_MAP).map(([key, info]) => {
      const n = counts[key] ?? 0
      return {
        key, info, count: n,
        level: n === 0 ? 'livre' : n <= 3 ? 'baixa' : n <= 6 ? 'moderada' : n <= 10 ? 'alta' : 'sobrecarga',
        color: n === 0 ? 'rgba(255,255,255,0.18)' : n <= 3 ? '#31D17C' : n <= 6 ? '#F59E0B' : n <= 10 ? '#3B82F6' : '#EF4444',
      }
    })
  }, [items, states])

  // ── Table view computed data ───────────────────────────────
  const tableItems = useMemo(() => {
    const todayMs = new Date().setHours(0, 0, 0, 0)
    return items.filter(item => {
      const st = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
      if (tableFilterBoard === 0 && item.tp !== 'Reel') return false
      if (tableFilterBoard === 1 && item.tp !== 'Post' && item.tp !== 'Story' && item.tp !== 'Carrossel') return false
      if (tableFilterBoard === 2 && item.tp !== 'Feed') return false
      if (filterClient !== 'all' && item.c !== filterClient) return false
      if (filterPriority !== 'all' && st.priority !== filterPriority) return false
      if (filterResponsible !== 'all' && st.responsible !== filterResponsible) return false
      const dtMs = new Date(item.dt).setHours(0, 0, 0, 0)
      if (filterToday && (dtMs > todayMs || st.status === 7 || st.status === 5)) return false
      if (filterOverdue && (dtMs >= todayMs || st.status === 7 || st.status === 5)) return false
      if (tableHidePublished && st.status === 7) return false
      if (tableStatusFilter !== 'all' && st.status !== tableStatusFilter) return false
      if (tableSearch.trim()) {
        const q = tableSearch.trim().toLowerCase()
        const title = (st.title || item.n).toLowerCase()
        if (!title.includes(q) && !item.c.toLowerCase().includes(q)) return false
      }
      return true
    }).sort((a, b) => {
      const diff = new Date(a.dt).getTime() - new Date(b.dt).getTime()
      return tableSortDir === 'asc' ? diff : -diff
    })
  }, [items, states, tableFilterBoard, filterClient, filterPriority, filterResponsible, filterToday, filterOverdue, tableSearch, tableHidePublished, tableStatusFilter, tableSortDir])

  const tableCountByBoard = useMemo(() => {
    const counts: Record<string, number> = { all: 0, '0': 0, '1': 0, '2': 0, '3': 0 }
    items.forEach(item => {
      if (filterClient !== 'all' && item.c !== filterClient) return
      counts.all++
      if (item.tp === 'Reel') counts['0']++
      if (item.tp === 'Post' || item.tp === 'Story' || item.tp === 'Carrossel') counts['1']++
      if (item.tp === 'Feed') counts['2']++
      counts['3']++
    })
    return counts
  }, [items, filterClient])

  const canEdit = !!(onEdit || onUpdateState)

  function confirmUploadTask(taskId: string) {
    const all = loadUploadTasks()
    const updated = all.map(t => t.id === taskId ? { ...t, confirmedAt: Date.now(), confirmedBy: currentUser ?? 'arthur' } : t)
    localStorage.setItem('sm_upload_tasks', JSON.stringify(updated))
    syncToCloud('sm_upload_tasks', updated)
    setUploadTasks(prev => prev.filter(t => t.id !== taskId))
  }

  // Filtra tasks por cliente se filtro ativo
  const visibleUploadTasks = uploadTasks.filter(t =>
    filterClient === 'all' || t.clientName === filterClient
  )

  // Estado do visualizador de Drive embutido
  const [driveViewTask, setDriveViewTask] = useState<UploadTask | null>(null)

  // Edição de link Drive diretamente no card
  const [driveLinkEdits, setDriveLinkEdits] = useState<Record<string, string>>({})

  function saveTaskDriveLink(taskId: string, link: string) {
    const all = loadUploadTasks()
    const updated = all.map(t => t.id === taskId ? { ...t, driveLink: link } : t)
    localStorage.setItem('sm_upload_tasks', JSON.stringify(updated))
    syncToCloud('sm_upload_tasks', updated)
    setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, driveLink: link } : t))
    setDriveLinkEdits(prev => { const n = { ...prev }; delete n[taskId]; return n })
  }

  const boardScrollRef = useRef<HTMLDivElement>(null)

  function getDriveEmbedUrl(link: string): string {
    const folderMatch = link.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    if (folderMatch) return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}`
    const fileMatch = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`
    const idMatch = link.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    if (idMatch) return `https://drive.google.com/embeddedfolderview?id=${idMatch[1]}`
    return link
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Board selector cards ──────────────────────────── */}
      <Box sx={{
        display: 'flex', gap: { md: 1.25, lg: 1.5 }, flexShrink: 0,
        px: { xs: 1.5, md: 2 }, py: { md: 1.5, lg: 1.75 },
        borderBottom: `1px solid ${DS.border}`,
        overflowX: 'auto',
        '&::-webkit-scrollbar': { height: 4 },
        '&::-webkit-scrollbar-thumb': { background: 'rgba(59,130,246,0.3)', borderRadius: 4 },
      }}>
        {BOARDS.map((board, i) => {
          const active = subTab === i
          const isMine = !!currentUser && USER_AREA_BOARD[currentUser.toLowerCase()] === board.key
          return (
            <Box
              key={board.label}
              {...clickable(() => setSubTab(i))}
              aria-label={`Board ${board.label}`}
              sx={{
                display: 'flex', alignItems: 'center', gap: { md: 1.25, lg: 1.5 },
                px: { md: 1.6, lg: 2 }, py: { md: 1.25, lg: 1.5 },
                cursor: 'pointer', flexShrink: 0,
                minWidth: { md: 196, lg: 224, xl: 264 },
                borderRadius: '16px',
                bgcolor: active ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)',
                border: active ? '1.5px solid rgba(59,130,246,0.55)' : `1px solid ${DS.border}`,
                boxShadow: active
                  ? '0 0 0 3px rgba(59,130,246,0.08), 0 10px 28px rgba(0,0,0,0.35)'
                  : 'none',
                transition: 'all 0.2s ease',
                position: 'relative',
                '&:hover': {
                  bgcolor: active ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.045)',
                  borderColor: active ? 'rgba(59,130,246,0.65)' : 'rgba(255,255,255,0.16)',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              {/* Icon box */}
              <Box sx={{
                width: { md: 40, lg: 46, xl: 52 }, height: { md: 40, lg: 46, xl: 52 },
                borderRadius: '12px', flexShrink: 0,
                bgcolor: `${board.color}${active ? '24' : '14'}`,
                border: `1px solid ${board.color}${active ? '55' : '24'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: { md: '1.15rem', lg: '1.3rem', xl: '1.5rem' },
                transition: 'all 0.2s ease',
                filter: active ? 'none' : 'grayscale(0.35)',
              }}>
                {board.emoji}
              </Box>

              {/* Text */}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 0.4 }}>
                  <Typography sx={{
                    fontSize: { md: '0.9rem', lg: '1rem', xl: '1.1rem' },
                    fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.01em',
                    color: active ? '#3B82F6' : 'rgba(255,255,255,0.9)',
                    transition: 'color 0.18s',
                  }} noWrap>
                    {board.label}
                  </Typography>
                  {isMine && (
                    <Box sx={{
                      px: 0.7, py: 0.15, borderRadius: '6px', flexShrink: 0,
                      bgcolor: 'rgba(59,130,246,0.16)', border: '1px solid rgba(59,130,246,0.35)',
                    }}>
                      <Typography sx={{ fontSize: '0.52rem', fontWeight: 800, color: '#60A5FA', lineHeight: 1.5, whiteSpace: 'nowrap' }}>
                        Minha área
                      </Typography>
                    </Box>
                  )}
                  {active && (
                    <Box sx={{ ml: 'auto', width: 7, height: 7, borderRadius: '50%', bgcolor: '#3B82F6', boxShadow: '0 0 8px rgba(59,130,246,0.7)', flexShrink: 0 }} />
                  )}
                </Box>
                <Typography sx={{
                  fontSize: { md: '0.62rem', lg: '0.68rem', xl: '0.74rem' },
                  color: 'rgba(255,255,255,0.42)', lineHeight: 1.32,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {board.desc} · <Box component="span" sx={{ color: active ? '#60A5FA' : 'rgba(255,255,255,0.62)', fontWeight: 700 }}>{counts[i]} {counts[i] === 1 ? 'item' : 'itens'}</Box>
                </Typography>
              </Box>
            </Box>
          )
        })}
      </Box>

      {/* ── Board title bar ─────────────────────────────────── */}
      <Box sx={{
        px: 2, py: { md: 0.8, lg: 1 }, display: 'flex', alignItems: 'center', gap: 1,
        borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
      }}>
        <Typography sx={{ fontSize: { md: '0.82rem', lg: '0.9rem', xl: '1rem' } }}>
          {BOARDS[subTab].emoji}
        </Typography>
        <Typography sx={{
          fontSize: { md: '0.82rem', lg: '0.9rem', xl: '1rem' },
          fontWeight: 800, color: BOARDS[subTab].color,
        }}>
          {BOARDS[subTab].label}
        </Typography>
        <Typography sx={{ fontSize: { md: '0.6rem', lg: '0.65rem' }, color: 'rgba(255,255,255,0.25)' }}>
          · {BOARDS[subTab].desc.toLowerCase()} · arraste entre colunas para mover o status
        </Typography>
      </Box>

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <Box sx={{
        px: 2, py: 1.1, display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
      }}>
        <TextField
          select size="small" value={filterClient} onChange={e => setFilterClient(e.target.value)}
          sx={{
            minWidth: { md: 160, lg: 190, xl: 220 },
            '& .MuiInputBase-root': { fontSize: '0.68rem', height: 30, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.10)', borderRadius: '8px' },
            '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.3)' },
          }}
          InputProps={{ startAdornment: <FilterListIcon sx={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', mr: 0.5 }} /> }}
        >
          <MenuItem value="all" sx={{ fontSize: '0.68rem' }}>Todos os clientes</MenuItem>
          {clientOptions.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.68rem' }}>{c}</MenuItem>)}
        </TextField>

        {/* Busca do board — acha o card sem precisar varrer coluna por coluna */}
        {subTab < 4 && (
          <TextField
            size="small"
            value={boardSearch}
            onChange={e => setBoardSearch(e.target.value)}
            placeholder="Buscar card ou cliente…"
            sx={{
              minWidth: { md: 150, lg: 180, xl: 210 },
              '& .MuiInputBase-root': { fontSize: '0.68rem', height: 30, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.10)', borderRadius: '8px' },
            }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', mr: 0.5 }} />,
              endAdornment: boardSearch ? (
                <Box
                  {...clickable(() => setBoardSearch(''))}
                  aria-label="Limpar busca"
                  sx={{
                    cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1, px: 0.3,
                    color: 'rgba(255,255,255,0.35)', '&:hover': { color: DS.t1 },
                  }}
                >×</Box>
              ) : undefined,
            }}
          />
        )}

        {/* Estado do criativo — separa o que já tem prévia do que ainda não tem */}
        {subTab < 4 && (
          <TextField
            select size="small" value={filterPreview}
            onChange={e => setFilterPreview(e.target.value as 'all' | 'ready' | 'missing')}
            sx={{
              minWidth: { md: 120, lg: 140, xl: 160 },
              '& .MuiInputBase-root': { fontSize: '0.68rem', height: 30, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.10)', borderRadius: '8px' },
              '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.3)' },
            }}
          >
            <MenuItem value="all" sx={{ fontSize: '0.68rem' }}>Prévia: todas</MenuItem>
            <MenuItem value="ready" sx={{ fontSize: '0.68rem' }}>Com prévia pronta</MenuItem>
            <MenuItem value="missing" sx={{ fontSize: '0.68rem' }}>Sem prévia</MenuItem>
          </TextField>
        )}

        {/* Column summary chips */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {colSummary.filter(c => c.n > 0).map(c => (
            <Tooltip key={c.status} title={STATUS_CONFIG[c.status].label}>
              <Chip
                label={c.n}
                size="small"
                icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: c.color, ml: 0.8 }} />}
                sx={{ height: 22, fontSize: '0.64rem', fontWeight: 700, bgcolor: `${c.color}18`, color: c.color, border: `1px solid ${c.color}30`, borderRadius: '6px', '& .MuiChip-icon': { mr: -0.3 } }}
              />
            </Tooltip>
          ))}
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* ── Planejar mês ── */}
        {onAddManyRoteiros && subTab < 4 && (
          <Tooltip title="Criar cards do mês a partir dos roteiros">
            <Button
              size="small"
              onClick={() => setPlanejamentoOpen(true)}
              startIcon={<span style={{ fontSize: '0.8rem', lineHeight: 1 }}>📋</span>}
              sx={{
                fontSize: '0.62rem', fontWeight: 700, borderRadius: '8px', px: 1.2, py: 0.5, height: 30,
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.6)',
                bgcolor: 'rgba(255,255,255,0.04)',
                '&:hover': { bgcolor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.35)', color: '#3B82F6' },
                transition: 'all 0.18s ease',
              }}
            >
              Planejar
            </Button>
          </Tooltip>
        )}

        {/* ── "Meu trabalho" toggle ── */}
        {currentUser && subTab < 4 && (() => {
          const info = NAME_MAP[currentUser]
          const active = filterResponsible === currentUser
          if (!info) return null
          return (
            <Tooltip title={active ? 'Mostrando apenas suas tarefas — clique para ver todos' : 'Ver apenas minhas tarefas'}>
              <Box
                onClick={() => setFilterResponsible(v => v === currentUser ? 'all' : currentUser)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.7,
                  px: 1.2, py: 0.5, borderRadius: '8px', cursor: 'pointer', height: 30,
                  bgcolor: active ? `${info.color}18` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? info.color + '55' : 'rgba(255,255,255,0.10)'}`,
                  color: active ? info.color : 'rgba(255,255,255,0.5)',
                  transition: 'all 0.18s ease',
                  '&:hover': { bgcolor: active ? `${info.color}28` : 'rgba(255,255,255,0.07)' },
                }}
              >
                <Typography sx={{ fontSize: '0.78rem', lineHeight: 1 }}>{info.emoji}</Typography>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: active ? 800 : 600, lineHeight: 1 }}>
                  {active ? 'Meu trabalho' : 'Meu'}
                </Typography>
              </Box>
            </Tooltip>
          )
        })()}

        <Button
          size="small"
          onClick={() => { setBulkMode(v => !v); setBulkSelected(new Set()) }}
          sx={{
            fontSize: '0.65rem', fontWeight: 700, borderRadius: '8px', px: 1.4, py: 0.6, height: 30,
            border: bulkMode ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.12)',
            color: bulkMode ? '#3B82F6' : 'rgba(255,255,255,0.6)',
            bgcolor: bulkMode ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.04)',
            '&:hover': { bgcolor: bulkMode ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.07)' },
          }}
        >
          {bulkMode ? `✓ ${bulkSelected.size} sel.` : 'Selecionar'}
        </Button>

        {/* Kanban / Tabela toggle */}
        {subTab < 4 && (
          <Box sx={{ display: 'flex', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.09)', overflow: 'hidden', flexShrink: 0 }}>
            {([['kanban', 'Kanban'], ['table', 'Tabela']] as const).map(([view, label]) => (
              <Box key={view} onClick={() => setLayoutView(view)}
                sx={{
                  px: 1.2, py: 0.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, height: 30,
                  bgcolor: layoutView === view ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.025)',
                  color: layoutView === view ? '#3B82F6' : 'rgba(255,255,255,0.38)',
                  borderRight: view === 'kanban' ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  transition: 'all 0.15s ease',
                  '&:hover': { bgcolor: layoutView === view ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.06)' },
                }}
              >
                {view === 'kanban'
                  ? <GridViewIcon sx={{ fontSize: 12 }} />
                  : <ViewListIcon sx={{ fontSize: 12 }} />}
                <Typography sx={{ fontSize: '0.6rem', fontWeight: layoutView === view ? 700 : 500, lineHeight: 1 }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        )}

        {onAddItem && (
          <Button
            size="small"
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            onClick={handleOpenAdd}
            sx={{
              fontSize: '0.68rem', fontWeight: 800, borderRadius: '8px', px: 1.6, py: 0.6, height: 30,
              background: `linear-gradient(135deg, ${BOARDS[subTab].color}dd, ${BOARDS[subTab].color}99)`,
              color: '#000',
              boxShadow: `0 4px 14px ${BOARDS[subTab].color}35`,
              '&:hover': { filter: 'brightness(1.1)', transform: 'translateY(-1px)', boxShadow: `0 6px 18px ${BOARDS[subTab].color}45` },
              transition: 'all 0.2s ease',
            }}
          >
            Novo {BOARDS[subTab].label}
          </Button>
        )}
      </Box>

      {/* ── KPI strip ────────────────────────────────────────── */}
      {kpiData && subTab < 4 && (
        <Box sx={{
          px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap',
          borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
        }}>
          {[
            { label: 'atrasados',    value: kpiData.overdue,         color: DS.red,      active: kpiData.overdue > 0 },
            { label: 'vencem hoje',  value: kpiData.dueToday,        color: DS.amber,    active: kpiData.dueToday > 0 },
            { label: 'pub. hoje',    value: kpiData.publishedToday,  color: DS.greenDim, active: kpiData.publishedToday > 0 },
            { label: 'em aprovação', value: kpiData.pendingApproval, color: DS.blueSoft, active: kpiData.pendingApproval > 0 },
            { label: 'reprovados',   value: kpiData.reprovados,      color: DS.red,      active: kpiData.reprovados > 0 },
            { label: 'pub. semana',  value: kpiData.publishedWeek,   color: DS.green,    active: kpiData.publishedWeek > 0 },
            { label: 'total',        value: kpiData.total,           color: 'rgba(255,255,255,0.35)', active: true },
          ].map(k => (
            <Box key={k.label} sx={{
              display: 'flex', alignItems: 'baseline', gap: 0.5,
              px: 1, py: 0.5, borderRadius: '8px',
              bgcolor: k.active && k.value > 0 ? `${k.color}0d` : 'rgba(255,255,255,0.025)',
              border: `1px solid ${k.active && k.value > 0 ? k.color + '22' : 'rgba(255,255,255,0.05)'}`,
              transition: 'all 0.2s ease',
            }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, lineHeight: 1, color: k.active && k.value > 0 ? k.color : 'rgba(255,255,255,0.22)' }}>
                {k.value}
              </Typography>
              <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1, fontWeight: 500 }}>
                {k.label}
              </Typography>
            </Box>
          ))}
          {/* Taxa de aprovação */}
          {kpiData.approvalRate !== null && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, px: 1, py: 0.5, borderRadius: '8px',
              bgcolor: kpiData.approvalRate >= 70 ? 'rgba(49,209,124,0.07)' : 'rgba(255,120,50,0.07)',
              border: `1px solid ${kpiData.approvalRate >= 70 ? 'rgba(49,209,124,0.18)' : 'rgba(255,120,50,0.18)'}` }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, lineHeight: 1, color: kpiData.approvalRate >= 70 ? '#31D17C' : '#3B82F6' }}>
                {kpiData.approvalRate}%
              </Typography>
              <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1, fontWeight: 500 }}>aprovação</Typography>
            </Box>
          )}
          {/* Gargalos com dias */}
          {bottlenecks.length > 0 && (
            <>
              <Box sx={{ width: 1, height: 18, bgcolor: 'rgba(255,255,255,0.06)', mx: 0.3, flexShrink: 0 }} />
              {bottlenecks.map(b => (
                <Tooltip key={b.label} title={`${b.count} item${b.count !== 1 ? 's' : ''} parado${b.count !== 1 ? 's' : ''} c/ ${b.label} — maior atraso: ${b.maxDays} dia${b.maxDays !== 1 ? 's' : ''}`}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: '8px',
                    bgcolor: `${b.color}0a`, border: `1px solid ${b.color}1e`, cursor: 'default' }}>
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: b.color, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.6rem', color: b.color, fontWeight: 700, lineHeight: 1 }}>{b.count}</Typography>
                    <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.32)', lineHeight: 1 }}>c/ {b.label}</Typography>
                    {b.maxDays > 0 && (
                      <Typography sx={{ fontSize: '0.5rem', color: b.maxDays >= 3 ? '#EF4444' : 'rgba(255,255,255,0.22)', fontWeight: 700, lineHeight: 1 }}>
                        {b.maxDays}d
                      </Typography>
                    )}
                  </Box>
                </Tooltip>
              ))}
            </>
          )}
          <Box sx={{ flex: 1 }} />
          {/* Capacidade toggle */}
          <Box onClick={() => setShowCapacity(v => !v)}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.45, borderRadius: '7px', cursor: 'pointer',
              bgcolor: showCapacity ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${showCapacity ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
              color: showCapacity ? '#3B82F6' : 'rgba(255,255,255,0.35)',
              transition: 'all 0.15s ease', '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' } }}>
            <Typography sx={{ fontSize: '0.6rem', lineHeight: 1 }}>👥</Typography>
            <Typography sx={{ fontSize: '0.58rem', fontWeight: showCapacity ? 700 : 500, lineHeight: 1 }}>Equipe</Typography>
            <Typography sx={{ fontSize: '0.5rem', lineHeight: 1, opacity: 0.6 }}>{showCapacity ? '▾' : '▸'}</Typography>
          </Box>
        </Box>
      )}

      {/* ── Capacity panel ───────────────────────────────────── */}
      {showCapacity && subTab < 4 && (
        <Box sx={{ px: 2, py: 1, display: 'flex', gap: 0.8, flexWrap: 'wrap', alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
          bgcolor: 'rgba(59,130,246,0.03)' }}>
          <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.28)', mr: 0.4, flexShrink: 0 }}>Carga:</Typography>
          {capacityData.map(m => (
            <Tooltip key={m.key} title={`${m.info.role} — ${m.count} tarefa${m.count !== 1 ? 's' : ''} ativa${m.count !== 1 ? 's' : ''} · ${m.level}`}>
              <Box onClick={() => setFilterResponsible(v => v === m.key ? 'all' : m.key)}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.4, borderRadius: '8px', cursor: 'pointer',
                  bgcolor: filterResponsible === m.key ? `${m.color}18` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${filterResponsible === m.key ? m.color + '40' : 'rgba(255,255,255,0.07)'}`,
                  transition: 'all 0.15s ease', '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' } }}>
                <Typography sx={{ fontSize: '0.7rem', lineHeight: 1 }}>{m.info.emoji}</Typography>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgba(255,255,255,0.65)', lineHeight: 1 }}>
                  {m.key.charAt(0).toUpperCase() + m.key.slice(1)}
                </Typography>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: m.color, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.count}</Typography>
              </Box>
            </Tooltip>
          ))}
          <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.18)', ml: 0.5 }}>
            🟢 ≤3 · 🟡 4-6 · 🟠 7-10 · 🔴 +10
          </Typography>
        </Box>
      )}

      {/* ── Barra única de filtros ────────────────────────────── */}
      {subTab < 4 && (
        <Box sx={{
          px: 2, py: 0.8, display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap',
          borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
        }}>
          {/* Estado: Hoje / Atrasados / Sem movimento */}
          {[
            { key: 'today',   label: 'Hoje',           active: filterToday,   color: DS.amber,  onClick: () => { setFilterToday(v => !v); setFilterOverdue(false); setFilterStuck(false) } },
            { key: 'overdue', label: 'Atrasados',      active: filterOverdue, color: DS.red,    onClick: () => { setFilterOverdue(v => !v); setFilterToday(false); setFilterStuck(false) } },
            { key: 'stuck',   label: 'Sem movimento',  active: filterStuck,   color: DS.violet, onClick: () => { setFilterStuck(v => !v); setFilterToday(false); setFilterOverdue(false) } },
          ].map(f => (
            <Box key={f.key} onClick={f.onClick} sx={{
              display: 'flex', alignItems: 'center', gap: 0.6,
              px: 1.1, py: 0.5, borderRadius: '8px', cursor: 'pointer',
              bgcolor: f.active ? `${f.color}18` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${f.active ? f.color + '50' : 'rgba(255,255,255,0.08)'}`,
              color: f.active ? f.color : 'rgba(255,255,255,0.45)',
              fontSize: '0.64rem', fontWeight: f.active ? 700 : 500,
              transition: 'all 0.15s ease',
              '&:hover': { bgcolor: f.active ? `${f.color}22` : 'rgba(255,255,255,0.07)' },
            }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: f.active ? f.color : 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
              {f.label}
            </Box>
          ))}
          <Box sx={{ width: 1, height: 16, bgcolor: 'rgba(255,255,255,0.06)' }} />
          {/* Prioridade */}
          {([['alta', DS.red], ['media', DS.amber], ['baixa', DS.blueSoft]] as const).map(([p, color]) => (
            <Box key={p} onClick={() => setFilterPriority(v => v === p ? 'all' : p)} sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 1, py: 0.5, borderRadius: '8px', cursor: 'pointer',
              bgcolor: filterPriority === p ? `${color}18` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${filterPriority === p ? color + '50' : 'rgba(255,255,255,0.08)'}`,
              transition: 'all 0.15s ease',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
            }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.62rem', color: filterPriority === p ? color : 'rgba(255,255,255,0.42)', fontWeight: filterPriority === p ? 700 : 500 }}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Typography>
            </Box>
          ))}
          <Box sx={{ width: 1, height: 16, bgcolor: 'rgba(255,255,255,0.06)' }} />
          {/* Responsáveis */}
          {Object.entries(NAME_MAP).map(([key, info]) => (
            <Tooltip key={key} title={`${info.role}`}>
              <Box onClick={() => setFilterResponsible(v => v === key ? 'all' : key)} sx={{
                width: 24, height: 24, borderRadius: '50%', cursor: 'pointer',
                bgcolor: filterResponsible === key ? `${info.color}30` : 'rgba(255,255,255,0.06)',
                border: `1.5px solid ${filterResponsible === key ? info.color : 'rgba(255,255,255,0.12)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', lineHeight: 1,
                transition: 'all 0.15s ease',
                '&:hover': { border: `1.5px solid ${info.color}` },
              }}>
                {info.emoji}
              </Box>
            </Tooltip>
          ))}
          {(filterToday || filterOverdue || filterStuck || filterPriority !== 'all' || filterResponsible !== 'all') && (
            <Box onClick={() => { setFilterToday(false); setFilterOverdue(false); setFilterStuck(false); setFilterPriority('all'); setFilterResponsible('all') }}
              sx={{ px: 0.9, py: 0.5, borderRadius: '8px', cursor: 'pointer', fontSize: '0.6rem',
                color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.07)',
                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' }, transition: 'all 0.15s ease' }}>
              Limpar
            </Box>
          )}
        </Box>
      )}

      {/* ── Bulk action bar ───────────────────────────────────── */}
      {bulkMode && bulkSelected.size > 0 && (
        <Box sx={{
          px: 2, py: 0.9, display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap',
          borderBottom: '1px solid rgba(59,130,246,0.2)', bgcolor: 'rgba(59,130,246,0.06)',
          animation: 'slideDown 0.18s ease both',
          '@keyframes slideDown': { '0%': { opacity: 0, transform: 'translateY(-6px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
          flexShrink: 0,
        }}>
          <Typography sx={{ fontSize: '0.7rem', color: '#3B82F6', fontWeight: 700 }}>
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
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(59,130,246,0.3)' },
            }}
          >
            {activeCols.map(col => (
              <MenuItem key={col.status} value={col.status} sx={{ fontSize: '0.65rem' }}>
                {STATUS_CONFIG[col.status].emoji} {STATUS_CONFIG[col.status].label}
              </MenuItem>
            ))}
          </TextField>
          <Button size="small" variant="contained" onClick={applyBulkStatus} disabled={bulkStatus === 4}
            sx={{ fontSize: '0.65rem', py: 0.3, background: '#3B82F6', color: '#fff', fontWeight: 700 }}>
            {bulkStatus === 4 ? 'Use Enviar por cliente' : 'Mover'}
          </Button>
          {/* Item 9: Enviar ao cliente — grouped by client */}
          {onBulkSendToClient && subTab === 3 && bulkSelected.size > 0 && (() => {
            const clientGroups: Record<string, number[]> = {}
            bulkSelected.forEach(id => {
              const it = items.find(i => i.i === id)
              if (it) {
                if (!clientGroups[it.c]) clientGroups[it.c] = []
                clientGroups[it.c].push(id)
              }
            })
            const clientNames = Object.keys(clientGroups)
            if (clientNames.length === 0) return null
            if (clientNames.length === 1) {
              return (
                <Button
                  size="small" startIcon={<WhatsAppIcon sx={{ fontSize: 14 }} />}
                  onClick={() => { onBulkSendToClient!(clientNames[0], clientGroups[clientNames[0]]); setBulkMode(false); setBulkSelected(new Set()) }}
                  sx={{ fontSize: '0.65rem', py: 0.3, background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.4)', color: '#25D366', fontWeight: 700 }}
                >
                  Enviar {clientGroups[clientNames[0]].length} para {clientNames[0]}
                </Button>
              )
            }
            return (
              <>
                <Button
                  size="small" startIcon={<WhatsAppIcon sx={{ fontSize: 14 }} />}
                  onClick={e => setBulkSendClientMenu(e.currentTarget)}
                  sx={{ fontSize: '0.65rem', py: 0.3, background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.4)', color: '#25D366', fontWeight: 700 }}
                >
                  Enviar por cliente ▾
                </Button>
                <Menu
                  open={!!bulkSendClientMenu} anchorEl={bulkSendClientMenu}
                  onClose={() => setBulkSendClientMenu(null)}
                  slotProps={{ paper: { sx: { bgcolor: 'rgba(18,18,18,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 } } }}
                >
                  <Box sx={{ px: 1.8, py: 0.8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                      Selecionar cliente
                    </Typography>
                  </Box>
                  {clientNames.map(name => (
                    <MenuItem key={name} onClick={() => {
                      onBulkSendToClient!(name, clientGroups[name])
                      setBulkSendClientMenu(null)
                      setBulkMode(false); setBulkSelected(new Set())
                    }} sx={{ fontSize: '0.72rem', gap: 1.2, py: 0.8 }}>
                      <WhatsAppIcon sx={{ fontSize: 14, color: '#25D366' }} />
                      <Box>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700 }}>{name}</Typography>
                        <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)' }}>{clientGroups[name].length} item{clientGroups[name].length !== 1 ? 's' : ''}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Menu>
              </>
            )
          })()}
          {onDelete && (
            <Button size="small" color="error" startIcon={<DeleteOutlineIcon sx={{ fontSize: 13 }} />}
              onClick={() => setBulkDeleteConfirm(true)}
              sx={{ fontSize: '0.65rem', py: 0.3, border: '1px solid rgba(239,68,68,0.4)', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}>
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
      <Box sx={{ flex: 1, overflow: 'hidden', ...(layoutView === 'table' && subTab < 4 ? {} : { p: 2, pt: 1.5, pb: 1.5 }) }}>
        {(layoutView === 'kanban' || subTab === 4) && (
        <Box sx={{ height: '100%', overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: 2 }}>

          {/* Coluna pinada de material subido — só no board Social */}
          {subTab === 3 && visibleUploadTasks.length > 0 && (
            <Box sx={{
              width: { md: 220, lg: 240, xl: 270 }, flexShrink: 0,
              display: 'flex', flexDirection: 'column', gap: 1,
              height: '100%', overflowY: 'auto',
              pr: 1,
              borderRight: '1px solid rgba(59,130,246,0.15)',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(59,130,246,0.3) transparent',
            }}>
              {/* Header da coluna */}
              <Box sx={{
                px: 1.2, py: 0.8, borderRadius: '10px',
                background: 'rgba(59,130,246,0.06)',
                border: '1px solid rgba(59,130,246,0.18)',
                display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0,
              }}>
                <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>📥</Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#3B82F6', letterSpacing: '0.04em', lineHeight: 1 }}>
                    MATERIAL SUBIDO
                  </Typography>
                  <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.3, mt: 0.3 }}>
                    Crie as tarefas e confirme
                  </Typography>
                </Box>
                <Box sx={{
                  minWidth: 20, height: 20, borderRadius: '50%',
                  bgcolor: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: '#3B82F6', lineHeight: 1 }}>
                    {visibleUploadTasks.length}
                  </Typography>
                </Box>
              </Box>

              {/* Cards de material */}
              {visibleUploadTasks.map(task => {
                const taskId = task.id
                const dateLabel = new Date(task.sessionDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                return (
                  <Box key={task.id} sx={{
                    borderRadius: '12px', p: 1.4,
                    background: 'rgba(59,130,246,0.04)',
                    border: '1px solid rgba(59,130,246,0.14)',
                    display: 'flex', flexDirection: 'column', gap: 1,
                    animation: 'taskIn 0.22s cubic-bezier(0.16,1,0.3,1) both',
                    '@keyframes taskIn': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
                  }}>
                    {/* Cliente + data */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                      <Box sx={{
                        width: 28, height: 28, borderRadius: '8px', flexShrink: 0,
                        background: 'rgba(59,130,246,0.12)',
                        border: '1px solid rgba(59,130,246,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8rem',
                      }}>📦</Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }} noWrap>
                          {task.clientName}
                        </Typography>
                        <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>
                          gravação de {dateLabel}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Área do Drive */}
                    {task.driveLink && !(taskId in driveLinkEdits) ? (
                      <Box sx={{ display: 'flex', gap: 0.6 }}>
                        <Button size="small" onClick={() => setDriveViewTask(task)} sx={{
                          flex: 1, fontSize: '0.62rem', fontWeight: 800, borderRadius: '8px', py: 0.5,
                          background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.25)', color: '#3B82F6',
                          '&:hover': { background: 'rgba(59,130,246,0.18)' }, transition: 'all 0.15s ease',
                        }}>
                          📂 Ver materiais
                        </Button>
                        <Box
                          component="a" href={task.driveLink} target="_blank" rel="noopener noreferrer"
                          sx={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, borderRadius: '8px', flexShrink: 0,
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                            textDecoration: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem',
                            '&:hover': { background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(59,130,246,0.3)' },
                            transition: 'all 0.15s ease',
                          }}
                        >↗</Box>
                        <Box
                          onClick={() => setDriveLinkEdits(prev => ({ ...prev, [taskId]: task.driveLink ?? '' }))}
                          sx={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, borderRadius: '8px', flexShrink: 0, cursor: 'pointer',
                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                            color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem',
                            '&:hover': { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' },
                            transition: 'all 0.15s ease',
                          }}
                        >✎</Box>
                      </Box>
                    ) : (
                      /* Input para colar link — aparece quando sem link ou editando */
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', fontWeight: 600 }}>
                          LINK DA PASTA NO DRIVE
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Box
                            component="input"
                            placeholder="Cole o link do Drive aqui..."
                            value={driveLinkEdits[taskId] ?? ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setDriveLinkEdits(prev => ({ ...prev, [taskId]: e.target.value }))
                            }
                            onKeyDown={(e: React.KeyboardEvent) => {
                              if (e.key === 'Enter') saveTaskDriveLink(taskId, driveLinkEdits[taskId] ?? '')
                              if (e.key === 'Escape') setDriveLinkEdits(prev => { const n = { ...prev }; delete n[taskId]; return n })
                            }}
                            sx={{
                              flex: 1, height: 28, px: 1, borderRadius: '7px', fontSize: '0.6rem',
                              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(59,130,246,0.25)',
                              color: '#fff', outline: 'none',
                              '&:focus': { borderColor: 'rgba(59,130,246,0.5)', background: 'rgba(59,130,246,0.06)' },
                              '&::placeholder': { color: 'rgba(255,255,255,0.2)' },
                              transition: 'all 0.15s ease',
                            }}
                          />
                          <Box
                            onClick={() => saveTaskDriveLink(taskId, driveLinkEdits[taskId] ?? '')}
                            sx={{
                              width: 28, height: 28, borderRadius: '7px', flexShrink: 0, cursor: 'pointer',
                              background: (driveLinkEdits[taskId] ?? '').length > 5 ? 'rgba(49,209,124,0.18)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${(driveLinkEdits[taskId] ?? '').length > 5 ? 'rgba(49,209,124,0.35)' : 'rgba(255,255,255,0.08)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: (driveLinkEdits[taskId] ?? '').length > 5 ? '#31D17C' : 'rgba(255,255,255,0.2)',
                              fontSize: '0.75rem', fontWeight: 800,
                              '&:hover': { background: 'rgba(49,209,124,0.25)' },
                              transition: 'all 0.15s ease',
                            }}
                          >✓</Box>
                        </Box>
                      </Box>
                    )}

                    {/* Botão confirmar — pendente até clicar */}
                    <Button
                      size="small"
                      fullWidth
                      onClick={() => confirmUploadTask(task.id)}
                      sx={{
                        fontSize: '0.65rem', fontWeight: 800, borderRadius: '8px', py: 0.7,
                        background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
                        color: '#fff',
                        boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
                        '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)', boxShadow: '0 6px 18px rgba(59,130,246,0.45)' },
                        transition: 'all 0.18s ease',
                      }}
                    >
                      Já criei as tarefas ✓
                    </Button>
                  </Box>
                )
              })}
            </Box>
          )}

          {/* Kanban principal (boards 0-3) */}
          {subTab < 4 && (
            <Box sx={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <ProblemsPanel
                issues={productionIssues}
                onAction={handleIssueAction}
                onOpenCard={handleOpenEdit}
              />
              <Box
                ref={boardScrollRef}
                sx={{
                  flex: 1, minHeight: 0,
                  overflowX: 'auto', overflowY: 'hidden',
                  // barra nativa escondida — usamos a BoardScrollbar customizada abaixo
                  scrollbarWidth: 'none',
                  '&::-webkit-scrollbar': { display: 'none' },
                }}>
                {BOARDS.slice(0, 4).map((board, i) => (
                  subTab === i ? (
                    <MiniKanban
                      key={board.key}
                      items={items} states={states}
                      onStatusChange={onStatusChange}
                      onEdit={canEdit ? handleOpenQuickEdit : undefined}
                      onView={handleOpenEdit}
                      columns={board.cols}
                      filterFn={activeBoardFilter}
                      filterClient={filterClient}
                      bulkMode={bulkMode}
                      bulkSelected={bulkSelected}
                      onBulkToggle={toggleBulk}
                      boardKey={board.key}
                      onSendToClient={onSendToClient ? (id, cn) => { setSendIsTraffic(false); setSendConfirmItem({ id, clientName: cn }) } : undefined}
                      onSendToReview={onSendToReview}
                      onRemindClient={onRemindClient}
                      onReadyDrop={handleReadyDrop}
                      onRetryReady={handleRetryReady}
                      onManualLinkReady={handleManualLinkReady}
                      onSendReadyToReview={handleSendReadyToReview}
                      onOpenReview={(itemId, fileId) => setReviewModal({ itemId, fileId })}
                    />
                  ) : null
                ))}
              </Box>
              <BoardScrollbar targetRef={boardScrollRef} color={BOARDS[subTab].color} />
            </Box>
          )}

          {/* Board Inbox Drive (board 5) */}
          {subTab === 5 && (
            <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ flexShrink: 0 }}>
                <AutomationHealthPanel pendingCount={driveInboxCount} onScanned={refreshInbox} />
              </Box>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <DriveVideoInbox
                  videos={videos}
                  loading={inboxLoading}
                  inboxState={inboxState}
                  items={items}
                  states={states}
                  onUpdateState={onUpdateState ?? (() => {})}
                  onRefresh={refreshInbox}
                  onRequestLink={setLinkVideo}
                  onIgnore={handleIgnoreVideo}
                  onIgnoreAll={handleIgnoreAll}
                  onRemindLater={handleRemindLater}
                  onSendToClient={onSendToClient}
                />
              </Box>
            </Box>
          )}

          {/* Board Roteiros (board 4) */}
          {subTab === 4 && (
            <RoteirosBoard
              roteiros={roteiros}
              clientFolders={clientFolders}
              filterClient={filterClient}
              viewMonth={roteiroViewMonth}
              viewYear={roteiroViewYear}
              onMonthChange={(m, y) => { setRoteiroViewMonth(m); setRoteiroViewYear(y) }}
              onUpdateRoteiro={onUpdateRoteiro}
              onImportBatch={onImportRoteiroBatch}
              onDeleteMany={onDeleteManyRoteiros}
              onAddRoteiro={onAddRoteiro}
              allClients={allClients}
              currentUser={currentUser}
            />
          )}
        </Box>
        )}

        {/* ── Table view (boards 0-3 only) ──────────────────── */}
        {layoutView === 'table' && subTab < 4 && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Sub-tabs + search bar */}
            <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {([
                  { key: 'all' as const, label: 'Todas', emoji: '' },
                  { key: 0 as const, label: 'Vídeos', emoji: '🎬' },
                  { key: 1 as const, label: 'Design', emoji: '🎨' },
                  { key: 2 as const, label: 'Feed', emoji: '📸' },
                  { key: 3 as const, label: 'Social', emoji: '📱' },
                ]).map(tab => {
                  const active = tableFilterBoard === tab.key
                  const color = tab.key === 'all' ? '#3B82F6' : BOARDS[tab.key as number].color
                  const cnt = tableCountByBoard[String(tab.key)]
                  return (
                    <Box key={String(tab.key)} onClick={() => { setTableFilterBoard(tab.key); setTablePage(0) }}
                      sx={{ px: 1.2, py: 0.4, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.6,
                        bgcolor: active ? `${color}15` : 'transparent',
                        border: `1px solid ${active ? color + '35' : 'rgba(255,255,255,0.06)'}`,
                        color: active ? color : 'rgba(255,255,255,0.4)',
                        transition: 'all 0.15s ease',
                        '&:hover': { bgcolor: active ? `${color}20` : 'rgba(255,255,255,0.04)' } }}>
                      {tab.emoji && <Typography sx={{ fontSize: '0.68rem', lineHeight: 1 }}>{tab.emoji}</Typography>}
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: active ? 700 : 500, lineHeight: 1 }}>{tab.label}</Typography>
                      <Box sx={{ px: 0.6, borderRadius: '5px', bgcolor: active ? `${color}20` : 'rgba(255,255,255,0.07)', fontSize: '0.56rem', fontWeight: 700, color: active ? color : 'rgba(255,255,255,0.28)', lineHeight: 1.7 }}>{cnt}</Box>
                    </Box>
                  )
                })}
              </Box>
              <Box sx={{ flex: 1 }} />
              <TextField size="small" placeholder="Buscar título ou cliente..." value={tableSearch}
                onChange={e => { setTableSearch(e.target.value); setTablePage(0) }}
                sx={{
                  width: { md: 200, lg: 240, xl: 280 },
                  '& .MuiInputBase-root': { fontSize: '0.68rem', height: 30, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.10)', borderRadius: '8px' },
                  '& input::placeholder': { color: 'rgba(255,255,255,0.22)', opacity: 1 },
                }}
                InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.28)', mr: 0.5 }} /> }}
              />
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.28)', flexShrink: 0 }}>
                {tableItems.length} item{tableItems.length !== 1 ? 's' : ''}
              </Typography>
            </Box>

            {/* ── Filter bar: status + hide-published toggle ── */}
            <Box sx={{ px: 2, py: 0.8, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0, flexWrap: 'wrap', bgcolor: 'rgba(255,255,255,0.01)' }}>
              {/* Toggle publicados */}
              <Box onClick={() => { setTableHidePublished(p => !p); setTableStatusFilter('all'); setTablePage(0) }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.6, px: 1, py: 0.38, borderRadius: '7px', cursor: 'pointer',
                  bgcolor: tableHidePublished ? 'rgba(49,209,124,0.1)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${tableHidePublished ? 'rgba(49,209,124,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  transition: 'all 0.15s',
                }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tableHidePublished ? '#31D17C' : 'rgba(255,255,255,0.25)', transition: 'all 0.15s' }} />
                <Typography sx={{ fontSize: '0.59rem', fontWeight: 700, color: tableHidePublished ? '#31D17C' : 'rgba(255,255,255,0.4)', lineHeight: 1 }}>
                  {tableHidePublished ? 'Ocultar publicados' : 'Ver todos'}
                </Typography>
              </Box>

              {/* Filtro por status */}
              <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                <Box onClick={() => { setTableStatusFilter('all'); setTablePage(0) }}
                  sx={{
                    px: 0.9, py: 0.3, borderRadius: '6px', cursor: 'pointer',
                    bgcolor: tableStatusFilter === 'all' ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${tableStatusFilter === 'all' ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.07)'}`,
                    transition: 'all 0.12s',
                  }}>
                  <Typography sx={{ fontSize: '0.57rem', fontWeight: 700, color: tableStatusFilter === 'all' ? '#3B82F6' : 'rgba(255,255,255,0.3)', lineHeight: 1 }}>Todos</Typography>
                </Box>
                {(tableHidePublished ? [0,1,2,3,4,5,6] : [0,1,2,3,4,5,6,7]).map(s => {
                  const cfg = STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]
                  if (!cfg) return null
                  const active = tableStatusFilter === s
                  return (
                    <Box key={s} onClick={() => { setTableStatusFilter(active ? 'all' : s); setTablePage(0) }}
                      sx={{
                        px: 0.9, py: 0.3, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.45,
                        bgcolor: active ? `${cfg.color}12` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${active ? cfg.color + '35' : 'rgba(255,255,255,0.06)'}`,
                        transition: 'all 0.12s',
                        '&:hover': { bgcolor: `${cfg.color}10`, borderColor: cfg.color + '28' },
                      }}>
                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: cfg.color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.57rem', fontWeight: active ? 700 : 500, color: active ? cfg.color : 'rgba(255,255,255,0.35)', lineHeight: 1 }}>{cfg.label}</Typography>
                    </Box>
                  )
                })}
              </Box>
            </Box>

            {/* Table header */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { md: '1fr 140px 72px 130px 108px 140px 78px 72px 34px', xl: '1.2fr 160px 82px 150px 118px 156px 88px 80px 34px' },
              px: 2, py: 0.8, gap: { md: 1, xl: 1.5 },
              borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
            }}>
              {['Título', 'Cliente', 'Tipo', 'Responsável', 'Prazo', 'Status', 'Prioridade', 'Progresso', ''].map(col => (
                <Typography key={col} onClick={col === 'Prazo' ? () => { setTableSortDir(d => d === 'asc' ? 'desc' : 'asc'); setTablePage(0) } : undefined}
                  sx={{
                    fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: col === 'Prazo' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)',
                    cursor: col === 'Prazo' ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', gap: 0.4,
                    '&:hover': col === 'Prazo' ? { color: '#3B82F6' } : {},
                    transition: 'color 0.15s',
                  }}>
                  {col}
                  {col === 'Prazo' && (
                    <Typography component="span" sx={{ fontSize: '0.6rem', color: 'inherit' }}>
                      {tableSortDir === 'asc' ? '↑' : '↓'}
                    </Typography>
                  )}
                </Typography>
              ))}
            </Box>

            {/* Table rows */}
            <Box sx={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(59,130,246,0.3) transparent', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(59,130,246,0.4)', borderRadius: 4 } }}>
              {tableItems.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE).map(item => {
                const st = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
                const statusCfg = STATUS_CONFIG[st.status] ?? STATUS_CONFIG[0]
                const dtMs = new Date(item.dt).setHours(0, 0, 0, 0)
                const todayMs = new Date().setHours(0, 0, 0, 0)
                const diffDays = Math.round((dtMs - todayMs) / 86400000)
                const isLate = diffDays < 0 && isOpenStatus(st.status)
                const typeColor = TYPE_COLOR[item.tp] ?? '#888'
                const resp = st.responsible ? (NAME_MAP[st.responsible as keyof typeof NAME_MAP] ?? null) : null
                const priorityColor = st.priority === 'alta' ? '#EF4444' : st.priority === 'media' ? '#F59E0B' : '#60A5FA'
                const progress = Math.round((statusRank(st.status) / (STATUS_ORDER.length - 1)) * 100)
                return (
                  <Box key={item.i} onClick={() => handleOpenEdit(item.i)} sx={{
                    display: 'grid',
                    gridTemplateColumns: { md: '1fr 140px 72px 130px 108px 140px 78px 72px 34px', xl: '1.2fr 160px 82px 150px 118px 156px 88px 80px 34px' },
                    px: 2, py: 0.85, gap: { md: 1, xl: 1.5 }, alignItems: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.032)',
                    cursor: 'pointer', transition: 'background 0.1s ease',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                  }}>
                    {/* Título */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, minWidth: 0 }}>
                      {bulkMode && (
                        <Box onClick={e => { e.stopPropagation(); toggleBulk(item.i) }}
                          sx={{ width: 14, height: 14, borderRadius: '3px', flexShrink: 0, cursor: 'pointer',
                            border: `1.5px solid ${bulkSelected.has(item.i) ? '#3B82F6' : 'rgba(255,255,255,0.2)'}`,
                            bgcolor: bulkSelected.has(item.i) ? 'rgba(59,130,246,0.18)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {bulkSelected.has(item.i) && <Box sx={{ width: 6, height: 6, bgcolor: '#3B82F6', borderRadius: '1px' }} />}
                        </Box>
                      )}
                      <Typography sx={{ fontSize: '0.78rem', lineHeight: 1, flexShrink: 0 }}>{TYPE_EMOJI[item.tp] ?? '📄'}</Typography>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.88)', lineHeight: 1.25 }} noWrap>
                          {st.title || item.n}
                        </Typography>
                        {isLate && <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: '#EF4444', lineHeight: 1, letterSpacing: '0.04em' }}>ATRASADO</Typography>}
                      </Box>
                    </Box>
                    {/* Cliente */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0 }}>
                      <Box sx={{ width: 20, height: 20, borderRadius: '5px', bgcolor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Typography sx={{ fontSize: '0.48rem', fontWeight: 800, color: '#3B82F6', lineHeight: 1 }}>{item.c.slice(0, 2).toUpperCase()}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.68)', fontWeight: 500 }} noWrap>{item.c}</Typography>
                    </Box>
                    {/* Tipo */}
                    <Box sx={{ px: 0.65, py: 0.22, borderRadius: '6px', bgcolor: typeColor === '#888' ? 'rgba(255,255,255,0.05)' : `${typeColor}14`, border: `1px solid ${typeColor === '#888' ? 'rgba(255,255,255,0.08)' : typeColor + '28'}`, display: 'inline-flex', width: 'fit-content' }}>
                      <Typography sx={{ fontSize: '0.57rem', fontWeight: 700, color: typeColor === '#888' ? 'rgba(255,255,255,0.42)' : typeColor, lineHeight: 1 }}>{item.tp}</Typography>
                    </Box>
                    {/* Responsável */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                      {resp ? (
                        <>
                          <Typography sx={{ fontSize: '0.7rem', lineHeight: 1, flexShrink: 0 }}>{resp.emoji}</Typography>
                          <Typography sx={{ fontSize: '0.62rem', color: resp.color, fontWeight: 600 }} noWrap>
                            {st.responsible!.charAt(0).toUpperCase() + st.responsible!.slice(1)}
                          </Typography>
                        </>
                      ) : (
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.18)' }}>—</Typography>
                      )}
                    </Box>
                    {/* Prazo */}
                    <Box>
                      <Typography sx={{ fontSize: '0.64rem', fontWeight: isLate ? 700 : 400, color: isLate ? '#EF4444' : diffDays === 0 ? '#F59E0B' : 'rgba(255,255,255,0.62)', lineHeight: 1.3 }}>
                        {new Date(item.dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </Typography>
                      <Typography sx={{ fontSize: '0.54rem', color: isLate ? '#EF4444' : diffDays === 0 ? '#F59E0B' : 'rgba(255,255,255,0.28)', fontWeight: (isLate || diffDays === 0) ? 700 : 400, lineHeight: 1 }}>
                        {isLate ? `${-diffDays}d atrasado` : diffDays === 0 ? 'hoje' : `em ${diffDays}d`}
                      </Typography>
                    </Box>
                    {/* Status */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.7, py: 0.28, borderRadius: '7px', bgcolor: `${statusCfg.color}10`, border: `1px solid ${statusCfg.color}24`, width: 'fit-content', maxWidth: '100%' }}>
                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: statusCfg.color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.57rem', fontWeight: 700, color: statusCfg.color, lineHeight: 1 }} noWrap>{statusCfg.label}</Typography>
                    </Box>
                    {/* Prioridade */}
                    {st.priority ? (
                      <Box sx={{ px: 0.65, py: 0.22, borderRadius: '6px', bgcolor: `${priorityColor}12`, border: `1px solid ${priorityColor}24`, display: 'inline-flex', width: 'fit-content' }}>
                        <Typography sx={{ fontSize: '0.57rem', fontWeight: 700, color: priorityColor, lineHeight: 1, textTransform: 'capitalize' }}>{st.priority}</Typography>
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.15)' }}>—</Typography>
                    )}
                    {/* Progresso */}
                    <Box>
                      <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: 'rgba(255,255,255,0.42)', lineHeight: 1, mb: 0.35 }}>{progress}%</Typography>
                      <Box sx={{ height: 3, borderRadius: '2px', bgcolor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                        <Box sx={{ height: '100%', borderRadius: '2px', width: `${progress}%`, bgcolor: statusCfg.color, transition: 'width 0.3s ease' }} />
                      </Box>
                    </Box>
                    {/* Ações */}
                    <IconButton size="small" onClick={e => { e.stopPropagation(); handleOpenEdit(item.i) }}
                      sx={{ width: 24, height: 24, color: 'rgba(255,255,255,0.22)', '&:hover': { color: '#3B82F6', bgcolor: 'rgba(59,130,246,0.1)' } }}>
                      <MoreVertIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Box>
                )
              })}
              {tableItems.length === 0 && (
                <Box sx={{ py: 7, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.18)' }}>Nenhum item encontrado</Typography>
                </Box>
              )}
            </Box>

            {/* Pagination */}
            {tableItems.length > TABLE_PAGE_SIZE && (
              <Box sx={{ px: 2, py: 0.9, display: 'flex', alignItems: 'center', gap: 0.8, borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>
                  {tablePage * TABLE_PAGE_SIZE + 1}–{Math.min((tablePage + 1) * TABLE_PAGE_SIZE, tableItems.length)} de {tableItems.length}
                </Typography>
                <Box sx={{ flex: 1 }} />
                {Array.from({ length: Math.min(Math.ceil(tableItems.length / TABLE_PAGE_SIZE), 10) }, (_, i) => (
                  <Box key={i} onClick={() => setTablePage(i)} sx={{
                    width: 24, height: 24, borderRadius: '6px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: tablePage === i ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${tablePage === i ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: tablePage === i ? '#3B82F6' : 'rgba(255,255,255,0.38)',
                    fontSize: '0.6rem', fontWeight: 700, transition: 'all 0.15s ease',
                  }}>
                    {i + 1}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* ── Visualizador Drive ──────────────────────────────── */}
      <Dialog
        open={Boolean(driveViewTask)}
        onClose={() => setDriveViewTask(null)}
        maxWidth="md" fullWidth
        slotProps={{ paper: { sx: {
          background: 'rgba(10,10,10,0.98)', backdropFilter: 'blur(40px)',
          border: '1px solid rgba(59,130,246,0.18)', borderRadius: '20px',
          overflow: 'hidden',
        }}}}
      >
        <Box sx={{
          px: 2.5, py: 1.8, display: 'flex', alignItems: 'center', gap: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <Box sx={{
            width: 34, height: 34, borderRadius: '10px', flexShrink: 0,
            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
          }}>📂</Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff', lineHeight: 1 }}>
              {driveViewTask?.clientName}
            </Typography>
            <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
              Material subido · gravação de{' '}
              {driveViewTask && new Date(driveViewTask.sessionDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.8 }}>
            {driveViewTask?.driveLink && (
              <Box
                component="a" href={driveViewTask.driveLink} target="_blank" rel="noopener noreferrer"
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5, px: 1.2, py: 0.5, borderRadius: '8px',
                  background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                  textDecoration: 'none', color: '#3B82F6', fontSize: '0.62rem', fontWeight: 700,
                  '&:hover': { background: 'rgba(59,130,246,0.16)' }, transition: 'all 0.15s ease',
                }}
              >
                ↗ Abrir no Drive
              </Box>
            )}
            <IconButton size="small" onClick={() => setDriveViewTask(null)}
              sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' } }}>
              <Box sx={{ fontSize: '1rem', lineHeight: 1, pb: 0.2 }}>✕</Box>
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ position: 'relative', height: { md: '60vh', xl: '65vh' }, bgcolor: '#fff' }}>
          {driveViewTask?.driveLink && (
            <Box
              component="iframe"
              src={getDriveEmbedUrl(driveViewTask.driveLink)}
              sx={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              title="Drive materials"
              allow="autoplay"
            />
          )}
        </Box>
      </Dialog>

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

          {subTab === 0 ? (
            /* Vídeo: data de entrega + data de publicação lado a lado */
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C084FC', mb: 0.5 }}>
                  📥 Entrega ao social
                </Typography>
                <TextField
                  label="Data de entrega" type="date" size="small" fullWidth
                  value={addDeliveryDate} onChange={e => setAddDeliveryDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true }, input: { sx: { fontSize: '0.78rem' } } }}
                  sx={{ '& .MuiOutlinedInput-root': { borderColor: 'rgba(192,132,252,0.3)' } }}
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#31D17C', mb: 0.5 }}>
                  🚀 Publicação
                </Typography>
                <TextField
                  label="Data de publicação" type="date" size="small" fullWidth
                  value={addDate} onChange={e => setAddDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true }, input: { sx: { fontSize: '0.78rem' } } }}
                />
              </Box>
            </Box>
          ) : subTab === 4 ? (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.8, px: 1, py: 0.6, borderRadius: 1.5, bgcolor: `${ROT_COLOR}10`, border: `1px solid ${ROT_COLOR}28` }}>
                <Typography sx={{ fontSize: '0.78rem', lineHeight: 1 }}>📅</Typography>
                <Typography sx={{ fontSize: '0.65rem', color: ROT_COLOR, fontWeight: 700 }}>
                  Será criado em {MONTH_NAMES_ROT[roteiroViewMonth]}/{String(roteiroViewYear).slice(2)} (mês selecionado)
                </Typography>
              </Box>
              <TextField
                label="Prazo de entrega (opcional)" type="date" size="small" fullWidth
                value={addDate} onChange={e => setAddDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
          ) : (
            <TextField
              label="Data de publicação" type="date" size="small" fullWidth
              value={addDate} onChange={e => setAddDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          )}

          {subTab === 4 && (
            <TextField
              label="📄 Link do Docs (roteiro)" size="small" fullWidth
              value={addRoteiroLink} onChange={e => setAddRoteiroLink(e.target.value)}
              placeholder="https://docs.google.com/document/d/..."
              slotProps={{ input: { sx: { fontSize: '0.72rem' } } }}
            />
          )}

          {(subTab === 0 || (subTab === 1 && addType === 'Post')) && (
            <>
              <TextField
                label="Link do material bruto (Drive)" size="small" fullWidth
                value={addFootageLink} onChange={e => setAddFootageLink(e.target.value)}
                placeholder="https://drive.google.com/..."
                slotProps={{ input: { sx: { fontSize: '0.72rem' } } }}
              />
              <TextField
                label="Link do roteiro (Docs/Drive)" size="small" fullWidth
                value={addRoteiroLink} onChange={e => setAddRoteiroLink(e.target.value)}
                placeholder="https://docs.google.com/..."
                slotProps={{ input: { sx: { fontSize: '0.72rem' } } }}
              />
            </>
          )}

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
            {subTab === 4 ? (() => {
              let rotColLabels: Partial<Record<RoteiroStatus, string>> = {}
              try { rotColLabels = JSON.parse(localStorage.getItem('sm_roteiro_col_labels') ?? '{}') } catch { /* noop */ }
              return (
                <TextField
                  select size="small" fullWidth value={addRotStatus}
                  onChange={e => setAddRotStatus(e.target.value as RoteiroStatus)}
                  sx={{ '& .MuiInputBase-root': { fontSize: '0.72rem' } }}
                >
                  {ROTEIRO_STATUS_FLOW.map(st => {
                    const cfg = ROTEIRO_STATUS_CFG[st]
                    return (
                      <MenuItem key={st} value={st} sx={{ fontSize: '0.72rem', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cfg.color, flexShrink: 0 }} />
                          {cfg.icon} {rotColLabels[st]?.trim() || cfg.label}
                        </Box>
                      </MenuItem>
                    )
                  })}
                </TextField>
              )
            })() : (
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
            )}
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
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(59,130,246,0.3)', borderRadius: 2 },
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

      {/* ── Quick edit dialog (lápis no card → todas as infos) ─ */}
      <EditItemDialog
        open={quickEditId !== null}
        item={quickEditId !== null ? (items.find(i => i.i === quickEditId) ?? null) : null}
        state={quickEditId !== null ? (states[quickEditId] ?? null) : null}
        onSave={(id, patch) => { onEdit?.(id, patch) }}
        onSaveState={(id, patch) => { onUpdateState?.(id, patch) }}
        onClose={() => setQuickEditId(null)}
      />

      {/* ── Bulk delete confirm ──────────────────────────────── */}
      <Dialog open={bulkDeleteConfirm} onClose={() => setBulkDeleteConfirm(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(239,68,68,0.25)' } } }}>
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
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(24px)', border: '1px solid rgba(96,165,250,0.25)' } } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SendIcon sx={{ color: '#60A5FA', fontSize: 18 }} />
            <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>Enviar ao cliente</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {sendConfirmItem && (() => {
            const item  = items.find(i => i.i === sendConfirmItem.id)
            const title = states[sendConfirmItem.id]?.title || item?.n || 'Este conteúdo'
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', mb: 0.3 }}>Conteúdo</Typography>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>{title}</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#60A5FA', mt: 0.3 }}>{sendConfirmItem.clientName}</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                  📤 Isso vai gerar o link do portal do cliente e registrar a data de envio.
                </Typography>
                <Box onClick={() => setSendIsTraffic(v => !v)} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
                  p: 1.5, borderRadius: 2,
                  bgcolor: sendIsTraffic ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${sendIsTraffic ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: 'rgba(245,158,11,0.3)' },
                }}>
                  <Box sx={{ width: 36, height: 20, borderRadius: 10, flexShrink: 0, bgcolor: sendIsTraffic ? '#F59E0B' : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'all 0.2s' }}>
                    <Box sx={{ position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%', bgcolor: '#fff', transition: 'left 0.2s', left: sendIsTraffic ? 19 : 3, boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: sendIsTraffic ? '#F59E0B' : 'rgba(255,255,255,0.6)' }}>
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

      {/* ── Planejamento de mês ──────────────────────────────── */}
      {onAddManyRoteiros && (
        <PlanejamentoDialog
          open={planejamentoOpen}
          onClose={() => setPlanejamentoOpen(false)}
          allClients={allClients ?? []}
          defaultMonth={roteiroViewMonth}
          defaultYear={roteiroViewYear}
          onGenerate={(clientName, list, year, month) => {
            onAddManyRoteiros(clientName, list, year, month)
          }}
        />
      )}

      {/* ── Inbox do Drive: botão fixo + painel lateral ──────── */}
      {pendingCount > 0 && !inboxOpen && (
        <Tooltip title={`${pendingCount} arquivo${pendingCount > 1 ? 's' : ''} aguardando vínculo`}>
          <Badge badgeContent={pendingCount} color="primary"
            sx={{
              position: 'fixed', right: { xs: 14, md: 22 }, bottom: { xs: 84, md: 26 }, zIndex: 1200,
              '& .MuiBadge-badge': { fontSize: '0.6rem', fontWeight: 800, minWidth: 18, height: 18 },
            }}>
            <IconButton
              aria-label="Abrir Inbox do Drive"
              onClick={() => setInboxOpen(true)}
              sx={{
                width: 46, height: 46, borderRadius: '14px',
                background: 'linear-gradient(90deg, #3B82F6 0%, #06B6D4 100%)',
                color: '#FFFFFF',
                boxShadow: '0 4px 16px rgba(59,130,246,0.28)',
                '&:hover': { filter: 'brightness(1.06)', transform: 'translateY(-1px)', boxShadow: '0 6px 22px rgba(59,130,246,0.4)' },
                transition: 'all 0.18s ease',
              }}>
              <InboxIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Badge>
        </Tooltip>
      )}

      <DriveInboxDrawer
        open={inboxOpen}
        loading={inboxLoading}
        pending={pendingVideos}
        ignored={ignoredVideos}
        onClose={handleCloseInbox}
        onRefresh={refreshInbox}
        onLink={setLinkVideo}
        onRemindLater={handleRemindLater}
        onIgnore={handleIgnoreVideo}
        onRestore={v => restoreIgnoredFile(v.drive_file_id)}
      />

      <LinkVideoDialog
        video={linkVideo}
        items={items}
        states={states}
        saving={linkSaving}
        onLink={handleLinkVideo}
        onClose={() => setLinkVideo(null)}
        onRemindLater={handleRemindLater}
        onIgnore={handleIgnoreVideo}
      />

      {/* ── Esteira Pronto: seleção manual e revisão ─────────── */}
      {readyPicker && (() => {
        const it = items.find(i => i.i === readyPicker.itemId)
        return (
          <ReadyPickerDialog
            open
            loading={readyPicker.loading}
            error={readyPicker.error}
            files={readyPicker.files}
            cardTitle={it ? (states[it.i]?.title || it.n) : `#${readyPicker.itemId}`}
            clientName={it?.c ?? ''}
            folderUrl={it ? publishFolders[it.c] : undefined}
            onPick={file => { void handlePickReadyFile(readyPicker.itemId, file) }}
            onClose={() => setReadyPicker(null)}
          />
        )
      })()}

      {reviewModal && (() => {
        const it = items.find(i => i.i === reviewModal.itemId)
        if (!it) return null
        const close = () => setReviewModal(null)
        return (
          <ReviewModal
            open
            clientName={it.c}
            title={states[it.i]?.title || it.n}
            fileId={reviewModal.fileId}
            filename={reviewModal.filename}
            onApprove={notes => {
              onStatusChange(it.i, 3)
              onAppendHistory?.(it.i, `Revisão interna: aprovado${notes ? ` — ${notes}` : ''}`)
              close()
            }}
            onRequestFix={notes => {
              onStatusChange(it.i, 1)
              onUpdateState?.(it.i, { rejectionText: notes })
              onAppendHistory?.(it.i, `Revisão interna: ajuste solicitado${notes ? ` — ${notes}` : ''}`)
              close()
            }}
            onOpenWhatsApp={onReviewNotify ? () => {
              void onReviewNotify(it.i, it.c, null).then(opened => {
                // Só marca quando abriu de verdade — popup bloqueado não avisou ninguém.
                if (opened) onUpdateState?.(it.i, { whatsappOpenedAt: Date.now() })
              })
            } : undefined}
            onClose={close}
          />
        )
      })()}

      <Snackbar
        open={!!inboxToast}
        autoHideDuration={4000}
        onClose={() => setInboxToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={inboxToast?.severity ?? 'info'} variant="outlined" onClose={() => setInboxToast(null)}
          action={
            <Button size="small" onClick={() => { setInboxToast(null); setInboxOpen(true) }}
              sx={{ fontSize: '0.62rem', fontWeight: 800 }}>
              Abrir Inbox
            </Button>
          }
          sx={{ bgcolor: 'rgba(10,17,32,0.99)', borderColor: 'rgba(59,130,246,0.35)', fontSize: '0.72rem' }}>
          {inboxToast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
