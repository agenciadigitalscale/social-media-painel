import { useState } from 'react'
import { Chip, Popover, Box, Typography, type ChipProps } from '@mui/material'
import type { Status } from '../types'
import { STATUS_CONFIG } from '../types'

interface Props {
  status: Status
  onClick?: (s: Status) => void
  size?: ChipProps['size']
  compact?: boolean
}

export default function StatusChip({ status, onClick, size = 'small', compact = false }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const cfg = STATUS_CONFIG[status]

  const handleChipClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!onClick) return
    e.stopPropagation()
    setAnchor(e.currentTarget)
  }

  const handleSelect = (s: Status) => {
    setAnchor(null)
    onClick?.(s)
  }

  const chipLabel = compact
    ? `${cfg.emoji} ${cfg.shortLabel}`
    : `${cfg.emoji} ${cfg.label}`

  return (
    <>
      <Chip
        label={chipLabel}
        size={size}
        onClick={onClick ? handleChipClick : undefined}
        sx={{
          cursor: onClick ? 'pointer' : 'default',
          fontWeight: 700,
          fontSize: size === 'small' ? '0.6rem' : '0.7rem',
          bgcolor: anchor ? `${cfg.color}28` : `${cfg.color}18`,
          color: cfg.color,
          border: `1px solid ${anchor ? cfg.color + '55' : cfg.color + '35'}`,
          height: size === 'small' ? 22 : 28,
          letterSpacing: '-0.01em',
          boxShadow: anchor ? `0 0 12px ${cfg.glow}, inset 0 0 8px ${cfg.color}10` : 'none',
          transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
          position: 'relative',
          // Published status gets a subtle pulse
          ...(status === 7 && {
            animation: 'statusPulse 3s ease-in-out infinite',
            '@keyframes statusPulse': {
              '0%,100%': { boxShadow: `0 0 6px ${cfg.glow}` },
              '50%': { boxShadow: `0 0 16px ${cfg.glow}` },
            },
          }),
          '&:hover': onClick ? {
            bgcolor: `${cfg.color}28`,
            boxShadow: `0 0 14px ${cfg.glow}`,
            borderColor: `${cfg.color}66`,
            transform: 'scale(1.04)',
          } : {},
          '& .MuiChip-label': {
            px: size === 'small' ? 1 : 1.5,
            lineHeight: 1,
          },
        }}
      />

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        onClick={e => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.8, p: 0,
              background: 'rgba(10,10,10,0.98)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 3,
              boxShadow: '0 16px 48px rgba(0,0,0,0.85), 0 4px 12px rgba(0,0,0,0.6)',
              display: 'flex', flexDirection: 'column', minWidth: 230,
              overflow: 'hidden',
              '&::before': {
                content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(255,144,57,0.4) 50%, transparent)',
              },
            },
          },
        }}
      >
        {/* Header */}
        <Box sx={{ px: 1.8, pt: 1.4, pb: 0.8 }}>
          <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
            Alterar status
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
            <Box sx={{ fontSize: '0.75rem' }}>{cfg.emoji}</Box>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: cfg.color }}>
              {cfg.label}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mx: 1.2, mb: 0.8, borderTop: '1px solid rgba(255,255,255,0.05)' }} />

        {/* Fluxo interno */}
        <Box sx={{ px: 0.8, pb: 0.5 }}>
          <Typography sx={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.12em', px: 0.8, pb: 0.5, fontWeight: 700 }}>
            Interno
          </Typography>
          {([0, 1, 2, 3] as Status[]).map(s => <StatusOption key={s} s={s} current={status} onSelect={handleSelect} />)}
        </Box>

        <Box sx={{ mx: 1.2, my: 0.3, borderTop: '1px solid rgba(255,255,255,0.05)' }} />

        <Box sx={{ px: 0.8, pb: 0.5 }}>
          <Typography sx={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.12em', px: 0.8, pb: 0.5, fontWeight: 700 }}>
            Cliente
          </Typography>
          {([4, 5, 6] as Status[]).map(s => <StatusOption key={s} s={s} current={status} onSelect={handleSelect} />)}
        </Box>

        <Box sx={{ mx: 1.2, my: 0.3, borderTop: '1px solid rgba(255,255,255,0.05)' }} />

        <Box sx={{ px: 0.8, pb: 0.8 }}>
          <StatusOption s={7} current={status} onSelect={handleSelect} />
        </Box>
      </Popover>
    </>
  )
}

function StatusOption({ s, current, onSelect }: { s: Status; current: Status; onSelect: (s: Status) => void }) {
  const c = STATUS_CONFIG[s]
  const isCurrent = s === current
  return (
    <Box
      onClick={() => onSelect(s)}
      sx={{
        px: 1.2, py: 0.7, borderRadius: 2, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 1,
        bgcolor: isCurrent ? `${c.color}18` : 'transparent',
        border: '1px solid', borderColor: isCurrent ? `${c.color}40` : 'transparent',
        '&:hover': {
          bgcolor: isCurrent ? `${c.color}25` : 'rgba(255,255,255,0.04)',
          borderColor: isCurrent ? `${c.color}55` : 'rgba(255,255,255,0.06)',
          transform: 'translateX(2px)',
        },
        transition: 'all 0.14s cubic-bezier(0.16,1,0.3,1)',
        position: 'relative',
      }}
    >
      <Typography sx={{ fontSize: '0.8rem', lineHeight: 1, width: 18, textAlign: 'center', flexShrink: 0 }}>
        {c.emoji}
      </Typography>
      <Box sx={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        bgcolor: c.dot,
        boxShadow: isCurrent ? `0 0 8px ${c.dot}` : 'none',
        transition: 'box-shadow 0.2s',
      }} />
      <Typography sx={{
        fontSize: '0.74rem',
        fontWeight: isCurrent ? 800 : 400,
        color: isCurrent ? c.color : 'rgba(255,255,255,0.65)',
        flex: 1, lineHeight: 1,
        letterSpacing: '-0.01em',
      }}>
        {c.label}
      </Typography>
      {isCurrent && (
        <Box sx={{
          width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: `${c.color}22`, border: `1px solid ${c.color}55`, flexShrink: 0,
        }}>
          <Typography sx={{ fontSize: '0.55rem', color: c.color, fontWeight: 900, lineHeight: 1 }}>✓</Typography>
        </Box>
      )}
    </Box>
  )
}
