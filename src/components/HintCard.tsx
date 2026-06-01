import { Box, Typography, type SxProps } from '@mui/material'
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates'

interface Props {
  text: string
  sx?: SxProps
  variant?: 'default' | 'info' | 'success' | 'warning'
}

const VARIANT_CONFIG = {
  default: { color: '#ff9039', bg: 'rgba(255,144,57,0.06)', border: 'rgba(255,144,57,0.18)', glow: 'rgba(255,144,57,0.12)' },
  info:    { color: '#3B8EFF', bg: 'rgba(59,142,255,0.06)',  border: 'rgba(59,142,255,0.18)',  glow: 'rgba(59,142,255,0.12)'  },
  success: { color: '#00C47A', bg: 'rgba(0,196,122,0.06)',   border: 'rgba(0,196,122,0.18)',   glow: 'rgba(0,196,122,0.12)'   },
  warning: { color: '#FFD700', bg: 'rgba(255,215,0,0.06)',   border: 'rgba(255,215,0,0.18)',   glow: 'rgba(255,215,0,0.12)'   },
}

export default function HintCard({ text, sx, variant = 'default' }: Props) {
  const cfg = VARIANT_CONFIG[variant]
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.2,
        px: 1.5,
        py: 1,
        borderRadius: 2,
        bgcolor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0,
          width: 3, height: '100%',
          bgcolor: cfg.color,
          opacity: 0.6,
          borderRadius: '2px 0 0 2px',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '1px',
          background: `linear-gradient(90deg, transparent, ${cfg.color}55 40%, ${cfg.color}88 60%, transparent)`,
          pointerEvents: 'none',
        },
        '&:hover': {
          bgcolor: cfg.bg.replace('0.06', '0.09'),
          borderColor: cfg.border.replace('0.18', '0.28'),
          boxShadow: `0 2px 12px ${cfg.glow}`,
        },
        ...sx,
      }}
    >
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: 1.5, flexShrink: 0, mt: 0.05,
        bgcolor: `${cfg.color}14`, border: `1px solid ${cfg.color}30`,
      }}>
        <TipsAndUpdatesIcon sx={{ fontSize: 13, color: cfg.color }} />
      </Box>
      <Typography
        variant="caption"
        sx={{
          lineHeight: 1.6,
          color: 'rgba(255,255,255,0.6)',
          fontSize: { xs: '0.68rem', xl: '0.75rem' },
          flex: 1,
        }}
      >
        {text}
      </Typography>
    </Box>
  )
}
