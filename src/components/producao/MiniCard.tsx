import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Paper, Tooltip, CircularProgress } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import EditIcon from '@mui/icons-material/Edit'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import RadarIcon from '@mui/icons-material/Radar'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import type { ContentItem, ItemState, Status } from '../../types'
import { isPreClientStatus } from '../../types'
import { clickable, clickableStop } from '../../shared/a11y'
import { BRAND, DS, typeColor, ctaGradient } from '../../theme'
import { NAME_MAP } from '../../lib/users'
import { shouldShowDelivery } from '../../lib/cardDate'
import { getCardPreview } from '../../lib/mediaLinks'
import { useMediaLinks } from '../../lib/useMediaLinks'
import { justArrived, ARRIVAL_DURATION_MS } from '../../lib/cardPulse'
import { buildExportName, exportCodeFor } from '../../lib/videoMatch'
import { EXPORT_PRESET } from '../../lib/exportWeight'
import { isStalePhase, type ReadyAutomationState } from '../../lib/readyAutomation'
import { shortPlatform, type ViewerSummary } from '../../lib/useViewerEvents'
import type { ColDef } from './shared'

/**
 * O card do kanban de Produções e a faixa de estado da esteira.
 *
 * Saiu do `ProducaoTab.tsx` junto com os helpers de atraso — a escada de
 * urgência (`DELAY_BORDER`/`DELAY_DOT`) só é usada aqui, e ficava a 1.700
 * linhas de distância de quem a lê.
 */

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
  ok:       'rgba(244,247,255,0.07)',
  today:    `${DS.amber}38`,
  warning:  `${DS.alert}45`,
  critical: `${DS.red}52`,
}

const DELAY_DOT: Record<DelayLevel, string> = {
  ok:       'rgba(244,247,255,0.20)',
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
        <Typography sx={{ fontSize: '0.5rem', color: 'rgba(244,247,255,0.35)', mt: 0.15 }} noWrap>
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

function MiniCard({ item, state, editor, onTrocarEditor, isDragging, colColor, isSelected, bulkMode, onSelect, onEdit, onView, onRemind, staggerIndex = 0, ready, viewer, saveState, onRetrySave, columns, onMoveColumn, onReview, onSendReview, onRetryReady, onManualLinkReady, onBackToProduction, onGoToReview, onSendReadyToReview }: {
  item: ContentItem
  state: ItemState
  /** Quem está editando — gaveta do painel, ou o membro marcado no card. */
  editor?: { nome: string; cor: string; membro?: string } | null
  /* Trocar quem edita, clicando no nome. Vem como callback com o elemento
     âncora porque o dono das gavetas é o ProducaoTab: mandar a lista de
     painéis até aqui arrastaria estado por três níveis, que é a mesma razão
     de `editor` já chegar resolvido em vez de cru. */
  onTrocarEditor?: (itemId: number, anchor: HTMLElement) => void
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
  // Âncora do menu de troca de editor. Um card tem uma pílula só, então um ref
  // no topo basta — e hook não pode ser criado dentro do IIFE que a desenha.
  const pilulaRef = useRef<HTMLDivElement>(null)
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

  const tc = typeColor(item.tp)
  // Prévia: regra única em lib/mediaLinks. O card não olha mais para state.link.
  const preview = getCardPreview(item, mediaLinks, state.status)
  // Revisão interna com arquivo confirmado: dá para assistir e decidir aqui.
  const canReview = !!onReview && state.status === 2 && preview.kind === 'ready'

  // O selo de exportação é o começo do fluxo: sem ele o editor nomeia o arquivo
  // na mão e a esteira cai em "ambíguo". Fica sempre visível — some só enquanto
  // o badge de "salvando" ocupa o mesmo canto.
  const showExportName = !bulkMode && isPreClientStatus(state.status) && !saveState
  const showRemind = !bulkMode && hover && !!onRemind && state.status === 4 && !!state.approvalToken
  const rightSlotTaken = showExportName || showRemind

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
          cursor: 'pointer', color: 'rgba(244,247,255,0.5)',
          bgcolor: 'rgba(244,247,255,0.04)', border: '1px solid rgba(244,247,255,0.08)',
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
        bgcolor: isDragging ? `${colColor}0c` : isSelected ? `${colColor}10` : 'rgba(244,247,255,0.03)',
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
          bgcolor: bulkMode ? `${colColor}12` : 'rgba(244,247,255,0.05)',
          border: `1px solid ${isSelected ? colColor + '66' : delay !== 'ok' ? DELAY_BORDER[delay] : colColor + '38'}`,
        },
      }}
    >
      {/* Bulk checkbox */}
      {bulkMode && (
        <Box sx={{
          position: 'absolute', top: 7, right: 7, zIndex: 10,
          width: 15, height: 15, borderRadius: '4px',
          bgcolor: isSelected ? colColor : 'rgba(244,247,255,0.09)',
          border: `1.5px solid ${isSelected ? colColor : 'rgba(244,247,255,0.20)'}`,
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
          bgcolor: 'rgba(244,247,255,0.06)', border: '1px solid rgba(244,247,255,0.10)',
        }}>
          <CircularProgress size={9} thickness={6} sx={{ color: 'rgba(244,247,255,0.55)' }} />
          <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, color: 'rgba(244,247,255,0.5)', letterSpacing: '0.02em' }}>
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
            // O slot da direita já é de outro botão (copiar nome, ou lembrete):
            // os dois desenhavam no MESMO ponto, e como este vem antes no JSX o
            // Edit ficava por baixo — inclicável em todo card de 0 a 3.
            position: 'absolute', top: 5, right: rightSlotTaken ? 33 : 5, zIndex: 10,
            width: 24, height: 24, borderRadius: '7px', cursor: 'pointer',
            bgcolor: 'rgba(244,247,255,0.08)', border: '1px solid rgba(244,247,255,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: 'rgba(244,247,255,0.15)' },
          }}
        >
          <EditIcon sx={{ fontSize: 12, color: 'rgba(244,247,255,0.60)' }} />
        </Box>
      )}

      {/* Nome do arquivo — Reel ainda em produção. O editor cola isto na
          exportação e o Drive reconhece o card sozinho, sem adivinhação.
          Mesmo slot do lembrete: status ≤3 e ===4 nunca coexistem. */}
      {/* Vale para todo tipo desde que a esteira busque na pasta Publicar — o
          Design depende deste nome tanto quanto o Vídeo. */}
      {/* O preset vive no tooltip porque este é o único instante em que o
          editor olha para o painel ANTES de exportar. O aviso da Inbox chega
          tarde: o arquivo já foi feito. Medido: mediana de 91 MB, e um cliente
          desistiu de assistir 83,6 MB em 46 s. */}
      {showExportName && (
        <Tooltip
          title={nameCopied
            ? `Copiado! Cole no nome da exportação (sem extensão) · Exporte em ${EXPORT_PRESET}`
            : `Copiar nome do arquivo: ${exportName(item, state)}\n\nExporte em ${EXPORT_PRESET} — o Instagram recomprime tudo, então arquivo maior não melhora o post, só trava no celular do cliente.`}
          placement="left"
        >
          <Box
            {...clickable(() => {
              navigator.clipboard.writeText(exportName(item, state)).then(() => {
                setNameCopied(true)
                if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
                copyTimerRef.current = setTimeout(() => setNameCopied(false), 1600)
              }).catch(() => {})
            })}
            aria-label={`Copiar nome de exportação: ${exportName(item, state)}`}
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
              // Mesma razão das setas de mover: no celular não existe hover, e é
              // exatamente lá que o editor precisa do selo antes de exportar.
              opacity: hover || nameCopied ? 1 : 0.55,
              transition: 'all 0.15s ease',
              '&:hover': { bgcolor: nameCopied ? `${DS.green}38` : 'rgba(6,182,212,0.28)' },
            }}
          >
            <DriveFileRenameOutlineIcon sx={{ fontSize: 12, color: nameCopied ? DS.green : DS.cyan }} />
          </Box>
        </Tooltip>
      )}

      {/* Remind button — visible on hover, only for status 4 */}
      {showRemind && (
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
          <WhatsAppIcon sx={{ fontSize: 12, color: BRAND.whatsapp }} />
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1.1, alignItems: 'stretch' }}>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Top row: type pill + client */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.6, pr: showExportName || (!bulkMode && onEdit && preview.kind === 'none') ? 3.2 : 0 }}>
        <Box sx={{ px: 0.6, py: '2px', borderRadius: '5px', flexShrink: 0, bgcolor: `${tc}1f`, border: `1px solid ${tc}33` }}>
          <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: tc, lineHeight: 1, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            {item.tp}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.63rem', color: 'rgba(244,247,255,0.50)', fontWeight: 600, flex: 1, lineHeight: 1 }} noWrap>
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
        color: 'rgba(244,247,255,0.90)',
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
          color: delay === 'ok' ? 'rgba(244,247,255,0.30)' : DELAY_DOT[delay],
          fontWeight: delay === 'ok' ? 400 : 700,
        }}>
          {activeLabel}
        </Typography>
        {/* SLA: days waiting at client */}
        {state.status === 4 && state.sentToClientAt && (() => {
          const days = Math.floor((Date.now() - state.sentToClientAt) / 86400000)
          if (days < 1) return null
          const color = days >= 3 ? DS.red : days >= 2 ? DS.amber : DS.orangeDim
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
        {editor && (() => {
          const membroInfo = editor.membro ? NAME_MAP[editor.membro] : null
          /* Só é clicável onde existe para onde trocar. Nos boards sem gavetas
             (Feed, Social) o nome vem do membro marcado no card e o menu
             abriria vazio — pior que não abrir. */
          const trocavel = !!onTrocarEditor
          return (
            <Tooltip title={
              trocavel
                ? `Editando: ${editor.nome}${membroInfo ? ` · ${membroInfo.role}` : ''} — clique para trocar`
                : `Editando: ${editor.nome}${membroInfo ? ` · ${membroInfo.role}` : ''}`
            }>
              <Box
                ref={pilulaRef}
                {...(trocavel
                  // `clickableStop` é o helper para controle DENTRO de outro
                  // clicável em contexto de arraste: sem ele o mesmo toque
                  // abriria a edição do card, e o dnd-kit trataria o clique
                  // como início de drag.
                  ? clickableStop(() => { if (pilulaRef.current) onTrocarEditor!(item.i, pilulaRef.current) })
                  : {})}
                aria-label={trocavel ? `Trocar quem edita — hoje ${editor.nome}` : undefined}
                sx={{
                flexShrink: 0, maxWidth: 96, display: 'flex', alignItems: 'center', gap: 0.4,
                px: 0.6, py: 0.25, borderRadius: '7px',
                bgcolor: `${editor.cor}1c`, border: `1px solid ${editor.cor}55`,
                ...(trocavel && {
                  cursor: 'pointer', transition: 'all 0.18s ease',
                  '&:hover': { bgcolor: `${editor.cor}30`, borderColor: editor.cor },
                }),
              }}>
                {membroInfo
                  ? <Box sx={{ fontSize: '0.62rem', lineHeight: 1, flexShrink: 0 }}>{membroInfo.emoji}</Box>
                  : <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: editor.cor, flexShrink: 0 }} />}
                <Typography sx={{
                  fontSize: { md: '0.56rem', xl: '0.63rem' }, fontWeight: 700,
                  color: editor.cor, lineHeight: 1.3,
                }} noWrap>
                  {editor.nome}
                </Typography>
              </Box>
            </Tooltip>
          )
        })()}
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
              border: '1px solid rgba(244,247,255,0.08)',
              bgcolor: 'rgba(244,247,255,0.04)',
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
                  color: !canSend ? 'rgba(244,247,255,0.4)' : jaEnviado ? DS.green : '#fff',
                  background: !canSend
                    ? 'rgba(244,247,255,0.04)'
                    : jaEnviado ? `${DS.green}14` : ctaGradient(90),
                  border: canSend && !jaEnviado ? 'none' : `1px solid ${jaEnviado && canSend ? `${DS.green}3a` : 'rgba(244,247,255,0.08)'}`,
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
          gap: 0.5, mt: 0.7, pt: 0.6, borderTop: '1px solid rgba(244,247,255,0.05)',
          opacity: hover ? 1 : 0.5, transition: 'opacity 0.15s',
        }}>
          {moveArrow(prevCol, '‹') || <Box sx={{ width: 22 }} />}
          <Typography sx={{ fontSize: '0.5rem', color: 'rgba(244,247,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            mover
          </Typography>
          {moveArrow(nextCol, '›') || <Box sx={{ width: 22 }} />}
        </Box>
      )}
    </Paper>
  )
}


export default MiniCard
