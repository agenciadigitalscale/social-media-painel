import { Box, Typography } from '@mui/material'
import type { ContentItem, ItemState } from '../../types'
import { STATUS_CONFIG, STATUS_ORDER, statusRank } from '../../types'
import { useReadyAutomation } from '../../lib/useReadyAutomation'
import type { ReadyPhase } from '../../lib/readyAutomation'
import { DS, typeColor } from '../../theme'
import { NAME_MAP } from '../../lib/users'
import { shouldShowDelivery } from '../../lib/cardDate'
import { computeGlow } from './smartCard'

const TYPE_EMOJI: Record<string, string> = {
  Post: '🖼️', Reel: '🎬', Story: '⭐', Carrossel: '🗂️', Feed: '📸',
}

export function deadlineInfo(dt: Date, now: Date): { label: string; color: string; urgent: boolean } {
  const d = new Date(dt).setHours(0, 0, 0, 0)
  const t = new Date(now).setHours(0, 0, 0, 0)
  const diff = Math.round((d - t) / 86400000)
  if (diff < 0) return { label: `${Math.abs(diff)}d atrás`, color: DS.red, urgent: true }
  if (diff === 0) return { label: 'Hoje', color: DS.amber, urgent: true }
  if (diff === 1) return { label: 'Amanhã', color: DS.amber, urgent: false }
  if (diff <= 6) return { label: `${diff}d`, color: DS.blueSoft, urgent: false }
  const dd = new Date(dt)
  return { label: dd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), color: DS.t2, urgent: false }
}

interface Props {
  item: ContentItem
  state: ItemState
  now: Date
  clientColor?: string
  dragging?: boolean
  overlay?: boolean
  compact?: boolean
  vip?: boolean
  onClick?: () => void
}

function readyTone(phase: ReadyPhase): string {
  if (phase === 'searching' || phase === 'found') return DS.accent
  if (phase === 'done' || phase === 'awaiting_send') return DS.green
  if (phase === 'idle') return DS.t2
  if (phase === 'ambiguous') return DS.amber
  return DS.alert
}

export default function MobileCard({ item, state, now, clientColor, dragging, overlay, compact, vip, onClick }: Props) {
  const ready = useReadyAutomation()[item.i]
  const status = state.status
  const cfg = STATUS_CONFIG[status]
  const stripe = clientColor || cfg.color
  const showDel = shouldShowDelivery(state)
  const dl = deadlineInfo(showDel ? new Date(state.deliveryDate!) : item.dt, now)
  const title = state.title || item.n
  const prio = state.priority
  // Por rank, não pelo número: o status 8 (Pronto) fica ENTRE o 1 e o 2 no fluxo.
  const pct = Math.round((statusRank(status) / (STATUS_ORDER.length - 1)) * 100)
  const respKey = state.responsible || state.assignedEditor
  const resp = respKey ? NAME_MAP[respKey] : null
  const glow = computeGlow(item, state, now, !!vip)
  const glowing = !overlay && glow.kind !== null

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        p: compact ? 0.9 : 1.3, pl: compact ? 1.2 : 1.6,
        borderRadius: 3,
        background: overlay ? 'rgba(20,22,30,0.98)' : 'rgba(255,255,255,0.035)',
        border: `1px solid ${glowing ? `${glow.color}66` : dragging ? `${cfg.color}77` : DS.border}`,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'grab',
        opacity: dragging && !overlay ? 0.3 : 1,
        // Sem backdropFilter aqui — regra do projeto: nunca blur em card arrastável (trava GPU)
        boxShadow: overlay
          ? `0 18px 44px rgba(0,0,0,0.55), 0 0 0 1px ${cfg.color}44`
          : glowing ? `0 0 18px -3px ${glow.color}77, inset 0 0 0 1px ${glow.color}22` : 'none',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        WebkitTapHighlightColor: 'transparent',
        ...(glowing && glow.pulse && {
          '@keyframes smartPulse': {
            '0%,100%': { boxShadow: `0 0 14px -4px ${glow.color}66, inset 0 0 0 1px ${glow.color}22` },
            '50%':     { boxShadow: `0 0 22px -2px ${glow.color}aa, inset 0 0 0 1px ${glow.color}44` },
          },
          animation: 'smartPulse 2.4s ease-in-out infinite',
        }),
      }}
    >
      {/* faixa lateral: glow dominante ou cor do cliente */}
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: glowing ? 4 : 3.5, background: glowing ? glow.color : stripe }} />

      {/* topo: tipo + prioridade + responsável + prazo */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: compact ? 0.4 : 0.6 }}>
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.35,
          px: 0.7, py: 0.2, borderRadius: 1.5,
          background: `${typeColor(item.tp)}1e`, border: `1px solid ${typeColor(item.tp)}44`,
        }}>
          <span style={{ fontSize: '0.7rem' }}>{TYPE_EMOJI[item.tp] ?? '•'}</span>
          <Typography sx={{ fontSize: '0.56rem', fontWeight: 800, color: typeColor(item.tp), letterSpacing: '0.02em' }}>
            {item.tp}
          </Typography>
        </Box>
        {glowing && (glow.kind === 'respondeu' || glow.kind === 'vip' || glow.kind === 'sem-roteiro' || glow.kind === 'sem-editor') && (
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.3, px: 0.6, py: 0.15, borderRadius: 1.2,
            background: `${glow.color}1e`, border: `1px solid ${glow.color}44`,
          }}>
            {glow.kind === 'vip' && <span style={{ fontSize: '0.62rem' }}>⭐</span>}
            <Typography sx={{ fontSize: '0.5rem', fontWeight: 800, color: glow.color, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
              {glow.label}
            </Typography>
          </Box>
        )}
        {prio && prio !== 'baixa' && (
          <Box sx={{
            width: 7, height: 7, borderRadius: '50%',
            bgcolor: prio === 'alta' ? DS.red : DS.amber,
            boxShadow: `0 0 6px ${prio === 'alta' ? DS.red : DS.amber}`,
          }} />
        )}
        <Box sx={{ flex: 1 }} />
        {resp && (
          <Box sx={{
            width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem',
            background: `${resp.color}22`, border: `1px solid ${resp.color}55`,
          }} title={respKey}>
            {resp.emoji}
          </Box>
        )}
        <Typography sx={{ fontSize: '0.58rem', fontWeight: 800, color: dl.color }}>
          {dl.urgent && '⚠ '}{showDel && '📥 '}{dl.label}
        </Typography>
      </Box>

      {/* título */}
      <Typography sx={{
        fontSize: compact ? '0.76rem' : '0.82rem', fontWeight: 700, color: DS.t1, lineHeight: 1.25,
        display: '-webkit-box', WebkitLineClamp: compact ? 1 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {title}
      </Typography>

      {/* cliente — oculto no modo compacto */}
      {!compact && (
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: stripe, mt: 0.3 }} noWrap>
          {item.c}
        </Typography>
      )}

      {/* Esteira da coluna Pronto: a linha de status no card, as ações no
          toque (ReadySheet) — a tela é estreita demais para os botões aqui. */}
      {status === 8 && ready && (
        <Box sx={{
          mt: 0.8, px: 0.8, py: 0.5, borderRadius: '8px',
          background: `${readyTone(ready.phase)}12`,
          border: `1px solid ${readyTone(ready.phase)}30`,
        }}>
          <Typography sx={{ fontSize: '0.56rem', fontWeight: 700, color: readyTone(ready.phase), lineHeight: 1.35 }}>
            {ready.message}
          </Typography>
          {ready.phase === 'awaiting_send' && (
            <Typography sx={{ fontSize: '0.52rem', color: DS.t3, mt: 0.2 }}>
              Toque para enviar
            </Typography>
          )}
        </Box>
      )}

      {/* progresso por status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: compact ? 0.5 : 0.8 }}>
        <Box sx={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <Box sx={{ width: `${pct}%`, height: '100%', background: cfg.color, borderRadius: 2, transition: 'width 0.3s ease' }} />
        </Box>
        <Typography sx={{ fontSize: '0.53rem', fontWeight: 800, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {cfg.shortLabel}
        </Typography>
      </Box>
    </Box>
  )
}
