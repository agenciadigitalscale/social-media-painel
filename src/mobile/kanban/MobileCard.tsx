import { Box, Typography } from '@mui/material'
import type { ContentItem, ItemState } from '../../types'
import { STATUS_CONFIG } from '../../types'
import { DS, typeColor } from '../../theme'
import { NAME_MAP } from '../../lib/users'

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
  onClick?: () => void
}

export default function MobileCard({ item, state, now, clientColor, dragging, overlay, compact, onClick }: Props) {
  const status = state.status
  const cfg = STATUS_CONFIG[status]
  const stripe = clientColor || cfg.color
  const dl = deadlineInfo(item.dt, now)
  const title = state.title || item.n
  const prio = state.priority
  const pct = Math.round((status / 7) * 100)
  const respKey = state.responsible || state.assignedEditor
  const resp = respKey ? NAME_MAP[respKey] : null

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        p: compact ? 0.9 : 1.3, pl: compact ? 1.2 : 1.6,
        borderRadius: 3,
        background: overlay ? 'rgba(20,22,30,0.98)' : 'rgba(255,255,255,0.035)',
        border: `1px solid ${dragging ? `${cfg.color}77` : DS.border}`,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'grab',
        opacity: dragging && !overlay ? 0.3 : 1,
        // Sem backdropFilter aqui — regra do projeto: nunca blur em card arrastável (trava GPU)
        boxShadow: overlay ? `0 18px 44px rgba(0,0,0,0.55), 0 0 0 1px ${cfg.color}44` : 'none',
        transition: 'border-color 0.2s ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* faixa lateral do cliente */}
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3.5, background: stripe }} />

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
          {dl.urgent && '⚠ '}{dl.label}
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
