import type { HTMLAttributes, MouseEvent } from 'react'
import { Box, Typography } from '@mui/material'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import type { ContentItem, ItemState } from '../../types'
import { STATUS_CONFIG, STATUS_ORDER, statusRank } from '../../types'
import { useReadyAutomation } from '../../lib/useReadyAutomation'
import type { ReadyPhase } from '../../lib/readyAutomation'
import { useMediaLinks } from '../../lib/useMediaLinks'
import { getCardPreview } from '../../lib/mediaLinks'
import { DS, typeColor } from '../../theme'
import { NAME_MAP } from '../../lib/users'
import { shouldShowDelivery } from '../../lib/cardDate'
import { computeGlow } from './smartCard'

const TYPE_EMOJI: Record<string, string> = { Post: '🖼️', Reel: '🎬', Story: '⭐', Carrossel: '🗂️', Feed: '📸' }

export function deadlineInfo(dt: Date, now: Date): { label: string; color: string; urgent: boolean } {
  const d = new Date(dt).setHours(0, 0, 0, 0)
  const t = new Date(now).setHours(0, 0, 0, 0)
  const diff = Math.round((d - t) / 86400000)
  if (diff < 0) return { label: `${Math.abs(diff)}d atrás`, color: DS.red, urgent: true }
  if (diff === 0) return { label: 'Hoje', color: DS.amber, urgent: true }
  if (diff === 1) return { label: 'Amanhã', color: DS.amber, urgent: false }
  if (diff <= 6) return { label: `${diff}d`, color: DS.blueSoft, urgent: false }
  return { label: new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), color: DS.t2, urgent: false }
}

interface Props {
  item: ContentItem; state: ItemState; now: Date; clientColor?: string
  dragging?: boolean; overlay?: boolean; compact?: boolean; vip?: boolean
  onClick?: () => void; onMove?: () => void
  dragHandleProps?: HTMLAttributes<HTMLDivElement>
}

function readyTone(phase: ReadyPhase): string {
  if (phase === 'searching' || phase === 'found') return DS.accent
  if (phase === 'done' || phase === 'awaiting_send') return DS.green
  if (phase === 'idle') return DS.t2
  if (phase === 'ambiguous') return DS.amber
  return DS.alert
}

function creativeState(status: ItemState['status'], previewKind: 'none' | 'pending' | 'ready', phase?: ReadyPhase) {
  if (status === 6) return { label: 'Ajuste solicitado', color: DS.red }
  if (status === 5 || status === 7) return { label: 'Aprovado', color: DS.green }
  if (status === 2 || status === 4) return { label: 'Em revisão', color: DS.amber }
  if (previewKind === 'ready') return { label: 'Prévia pronta', color: DS.green }
  if (phase === 'searching') return { label: 'Detectando', color: DS.blueSoft }
  if (phase === 'found' || previewKind === 'pending') return { label: 'Gerando prévia', color: DS.blueSoft }
  return { label: 'Sem criativo', color: DS.t3 }
}

export default function MobileCard({ item, state, now, clientColor, dragging, overlay, compact, vip, onClick, onMove, dragHandleProps }: Props) {
  const ready = useReadyAutomation()[item.i]
  const preview = getCardPreview(item, useMediaLinks(), state.status)
  const cfg = STATUS_CONFIG[state.status]
  const stripe = clientColor || cfg.color
  const showDel = shouldShowDelivery(state)
  const dl = deadlineInfo(showDel ? new Date(state.deliveryDate!) : item.dt, now)
  const title = state.title || item.n
  const pct = Math.round((statusRank(state.status) / (STATUS_ORDER.length - 1)) * 100)
  const respKey = state.responsible || state.assignedEditor
  const resp = respKey ? NAME_MAP[respKey] : null
  const glow = computeGlow(item, state, now, !!vip)
  const glowing = !overlay && glow.kind !== null
  const creative = creativeState(state.status, preview.kind, ready?.phase)
  const openCard = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-card-action]')) return
    onClick?.()
  }

  return (
    <Box
      onClick={openCard}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `${item.tp}: ${title}, ${item.c}` : undefined}
      sx={{
        position: 'relative', minHeight: compact ? 96 : 116,
        p: compact ? 1 : 1.25, pl: preview.kind === 'ready' && preview.thumbUrl ? 10.5 : 1.6, pr: 6.4,
        borderRadius: 3, overflow: 'hidden',
        background: overlay ? 'rgba(18,24,36,0.99)' : 'linear-gradient(155deg, rgba(18,25,39,0.98), rgba(11,16,27,0.98))',
        border: `1px solid ${glowing ? `${glow.color}66` : dragging ? `${cfg.color}88` : 'rgba(148,163,184,0.13)'}`,
        cursor: onClick ? 'pointer' : 'default', opacity: dragging && !overlay ? 0.28 : 1,
        boxShadow: overlay ? `0 22px 52px rgba(0,0,0,0.62), 0 0 0 1px ${cfg.color}44` : glowing ? `0 0 18px -5px ${glow.color}70` : '0 10px 24px rgba(0,0,0,0.2)',
        transition: 'border-color 0.18s ease, box-shadow 0.18s ease, transform 0.12s ease',
        WebkitTapHighlightColor: 'transparent', contentVisibility: overlay ? 'visible' : 'auto',
        containIntrinsicSize: compact ? '96px' : '116px',
        '&:active': onClick && !dragging ? { transform: 'scale(0.992)' } : undefined,
      }}
    >
      <Box sx={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: '0 4px 4px 0', background: glowing ? glow.color : stripe }} />
      {preview.kind === 'ready' && preview.thumbUrl && (
        <Box component="img" src={preview.thumbUrl} alt="" loading="lazy" sx={{
          position: 'absolute', left: 12, top: 12, bottom: 12, width: compact ? 66 : 72,
          height: 'calc(100% - 24px)', objectFit: 'cover', borderRadius: 2.2,
          background: 'rgba(244,247,255,0.04)', border: '1px solid rgba(244,247,255,0.08)',
        }} />
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55, mb: 0.55, minWidth: 0 }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.35, px: 0.65, py: 0.18, borderRadius: 1.4, background: `${typeColor(item.tp)}16`, border: `1px solid ${typeColor(item.tp)}35` }}>
          <span style={{ fontSize: '0.66rem' }}>{TYPE_EMOJI[item.tp] ?? '•'}</span>
          <Typography sx={{ fontSize: '0.54rem', fontWeight: 850, color: typeColor(item.tp) }}>{item.tp}</Typography>
        </Box>
        {state.priority === 'alta' && <Typography sx={{ fontSize: '0.52rem', fontWeight: 900, color: DS.red }}>URGENTE</Typography>}
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: '0.57rem', fontWeight: 850, color: dl.color, whiteSpace: 'nowrap' }}>{dl.urgent && '▲ '}{dl.label}</Typography>
      </Box>

      <Typography sx={{ fontSize: compact ? '0.76rem' : '0.84rem', fontWeight: 780, color: DS.t1, lineHeight: 1.24, display: '-webkit-box', WebkitLineClamp: compact ? 1 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {title}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.65, mt: 0.45, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.61rem', fontWeight: 700, color: stripe, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.c}</Typography>
        <Box sx={{ flex: 1 }} />
        {resp && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, minWidth: 0 }}>
            <Box sx={{ width: 17, height: 17, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', background: `${resp.color}22`, border: `1px solid ${resp.color}55` }}>{resp.emoji}</Box>
            {!compact && <Typography sx={{ fontSize: '0.54rem', color: DS.t3 }} noWrap>{respKey}</Typography>}
          </Box>
        )}
      </Box>

      {!compact && (
        <Box sx={{ mt: 0.7, display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: creative.color, boxShadow: creative.color === DS.t3 ? 'none' : `0 0 7px ${creative.color}66` }} />
          <Typography sx={{ fontSize: '0.55rem', fontWeight: 750, color: creative.color }}>{creative.label}</Typography>
        </Box>
      )}

      {state.status === 8 && ready && !compact && (
        <Typography sx={{ mt: 0.65, fontSize: '0.53rem', fontWeight: 700, color: readyTone(ready.phase), lineHeight: 1.3 }} noWrap>{ready.message}</Typography>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mt: compact ? 0.55 : 0.72 }}>
        <Box sx={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(244,247,255,0.07)', overflow: 'hidden' }}>
          <Box sx={{ width: `${pct}%`, height: '100%', background: cfg.color, borderRadius: 2, transition: 'width 0.3s ease' }} />
        </Box>
        <Typography sx={{ fontSize: '0.5rem', fontWeight: 850, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.035em' }}>{cfg.shortLabel}</Typography>
      </Box>

      {dragHandleProps && (
        <Box
          data-card-action data-drag-handle {...dragHandleProps} aria-label="Segure para arrastar"
          sx={{ position: 'absolute', right: 2, top: 4, width: 44, height: 44, borderRadius: 2.2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.t2, cursor: 'grab', touchAction: 'none', userSelect: 'none', '&:active': { cursor: 'grabbing', color: DS.accent, background: 'rgba(59,130,246,0.1)' } }}
          onClick={(event) => event.stopPropagation()}
        >
          <DragIndicatorRoundedIcon sx={{ fontSize: 22 }} />
        </Box>
      )}

      {onMove && (
        <Box data-card-action role="button" aria-label="Mover para outra etapa" onClick={(event) => { event.stopPropagation(); onMove() }}
          sx={{ position: 'absolute', right: 2, bottom: 4, width: 44, height: 44, borderRadius: 2.2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.t3, cursor: 'pointer', touchAction: 'manipulation', '&:active': { color: DS.accent, background: 'rgba(59,130,246,0.1)', transform: 'scale(0.94)' } }}>
          <MoreHorizRoundedIcon sx={{ fontSize: 22 }} />
        </Box>
      )}
    </Box>
  )
}
