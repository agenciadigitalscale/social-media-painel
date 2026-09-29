/* AlertBanner.tsx — Exibe alertas internos proativos na top do Meu Dia
   Cada alerta é descartável, acionável, e expira automaticamente no dia seguinte.
*/
import { useState } from 'react'
import {
  Box, Typography, Paper, Stack, Button, IconButton, Collapse,
  Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import type { InternalAlert, AlertSeverity } from '../lib/alerts'
import { DS } from '../theme'

// ── Cores por severidade ───────────────────────────────────
const SEV_COLOR: Record<AlertSeverity, string> = {
  critical: DS.red,
  warning:  DS.amber,
  info:     DS.accent,
}

// ── Componente de um único alerta ─────────────────────────
function AlertCard({ alert, onDismiss, onCta }: {
  alert:     InternalAlert
  onDismiss: () => void
  onCta:     () => void
}) {
  const color  = SEV_COLOR[alert.severity]

  return (
    <Paper sx={{
      px: { xs: 1.4, xl: 2 }, py: 1,
      // Painel sóbrio: cartão neutro; a gravidade fica só no filete à esquerda.
      background: DS.surface,
      border: `1px solid ${DS.border}`,
      borderLeft: `2px solid ${color}`,
      borderRadius: 1.5,
      display: 'flex',
      alignItems: 'center',
      gap: 1.2,
      transition: 'border-color 0.2s',
      '&:hover': { borderColor: DS.borderHov },
    }}>

      {/* Emoji de severidade */}
      <Typography sx={{ fontSize: { xs: '1rem', xl: '1.1rem' }, flexShrink: 0, lineHeight: 1 }}>
        {alert.emoji}
      </Typography>

      {/* Texto */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{
          fontSize: { xs: '0.76rem', xl: '0.82rem' },
          fontWeight: 700,
          color: 'rgba(247,247,245,0.93)',
          lineHeight: 1.25,
        }}>
          {alert.title}
        </Typography>
        <Typography noWrap sx={{
          fontSize: { xs: '0.64rem', xl: '0.68rem' },
          color: 'rgba(247,247,245,0.45)',
          mt: 0.25,
          lineHeight: 1.2,
        }}>
          {alert.body}
        </Typography>
      </Box>

      {/* CTA */}
      {alert.ctaLabel && (
        <Tooltip title={alert.ctaLabel}>
          <Button
            size="small"
            onClick={onCta}
            sx={{
              minWidth: 'auto',
              px: { xs: 1, xl: 1.4 },
              height: 26,
              fontSize: '0.62rem',
              fontWeight: 800,
              flexShrink: 0,
              textTransform: 'none',
              bgcolor: 'transparent',
              color: DS.t1,
              border: `1px solid ${DS.border}`,
              borderRadius: 1,
              letterSpacing: '0.02em',
              '&:hover': { bgcolor: DS.surfaceAlt, borderColor: DS.borderHov },
            }}
          >
            {alert.ctaLabel} →
          </Button>
        </Tooltip>
      )}

      {/* Dismiss */}
      <Tooltip title="Dispensar (volta amanhã se persistir)">
        <IconButton
          size="small"
          onClick={onDismiss}
          sx={{
            width: 22, height: 22, flexShrink: 0,
            color: 'rgba(247,247,245,0.2)',
            '&:hover': { color: 'rgba(247,247,245,0.5)', bgcolor: 'rgba(247,247,245,0.05)' },
          }}
        >
          <CloseIcon sx={{ fontSize: 11 }} />
        </IconButton>
      </Tooltip>
    </Paper>
  )
}

// ── Export principal ───────────────────────────────────────
interface Props {
  alerts:     InternalAlert[]   // já filtrados por usuário e dismissed
  onDismiss:  (id: string) => void
  onTabChange?: (tab: number) => void
  initialMax?: number           // quantos mostrar antes do "ver mais"
}

export default function AlertBanner({ alerts, onDismiss, onTabChange, initialMax = 3 }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (alerts.length === 0) {
    return (
      <Paper sx={{
        px: 2, py: 1.2, mb: 2,
        display: 'flex', alignItems: 'center', gap: 1.2,
        border: '1px solid rgba(32,216,120,0.15)',
        bgcolor: 'rgba(32,216,120,0.05)',
        borderRadius: 1.5,
      }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 16, color: DS.green, flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.74rem', color: 'rgba(247,247,245,0.55)', fontWeight: 500 }}>
          Tudo em ordem — nenhum alerta no momento ✨
        </Typography>
      </Paper>
    )
  }

  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const shown = expanded ? alerts : alerts.slice(0, initialMax)
  const hiddenCount = alerts.length - initialMax

  return (
    <Box mb={2}>
      {/* Cabeçalho de resumo */}
      <Stack direction="row" alignItems="center" gap={1} mb={1}>
        <Typography sx={{
          fontSize: '0.65rem', fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '0.09em',
          color: DS.t3,
        }}>
          {criticalCount > 0
            ? `⚡ ${criticalCount} alerta${criticalCount > 1 ? 's' : ''} crítico${criticalCount > 1 ? 's' : ''}`
            : `⚠ ${alerts.length} alerta${alerts.length > 1 ? 's' : ''}`
          }
        </Typography>
        <Box sx={{ flex: 1, height: 1, bgcolor: DS.border }} />
        {alerts.length > 1 && (
          <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
            {alerts.length} total
          </Typography>
        )}
      </Stack>

      {/* Lista de alertas */}
      <Stack gap={0.7}>
        {shown.map(alert => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onDismiss={() => onDismiss(alert.id)}
            onCta={() => alert.ctaTab !== undefined && onTabChange?.(alert.ctaTab)}
          />
        ))}
      </Stack>

      {/* Expandir/colapsar */}
      {hiddenCount > 0 && (
        <Collapse in={true}>
          <Button
            size="small"
            onClick={() => setExpanded(e => !e)}
            endIcon={
              <ExpandMoreIcon sx={{
                fontSize: '14px !important',
                transform: expanded ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }} />
            }
            sx={{
              mt: 0.8, pl: 0.5, fontSize: '0.63rem',
              color: 'text.disabled', textTransform: 'none', fontWeight: 600,
              '&:hover': { color: 'text.secondary' },
            }}
          >
            {expanded ? 'Mostrar menos' : `Ver mais ${hiddenCount} alerta${hiddenCount > 1 ? 's' : ''}`}
          </Button>
        </Collapse>
      )}
    </Box>
  )
}
