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

  return (
    <>
      <Chip
        label={compact ? cfg.shortLabel : cfg.label}
        size={size}
        onClick={onClick ? handleChipClick : undefined}
        sx={{
          cursor: onClick ? 'pointer' : 'default',
          fontWeight: 700,
          fontSize: size === 'small' ? '0.62rem' : '0.72rem',
          bgcolor: `${cfg.color}18`,
          color: cfg.color,
          border: `1px solid ${cfg.color}35`,
          height: size === 'small' ? 22 : 28,
          boxShadow: anchor ? `0 0 10px ${cfg.glow}` : 'none',
          transition: 'all 0.2s',
          '&:hover': onClick ? {
            bgcolor: `${cfg.color}25`,
            boxShadow: `0 0 10px ${cfg.glow}`,
            borderColor: `${cfg.color}55`,
          } : {},
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
              mt: 0.5, p: 0.5,
              background: 'rgba(10,10,10,0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2.5,
              boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
              display: 'flex', flexDirection: 'column', gap: 0.2, minWidth: 220,
            },
          },
        }}
      >
        <Typography sx={{ fontSize: '0.56rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 1.2, px: 1.5, pt: 1, pb: 0.5, fontWeight: 700 }}>
          Fluxo interno
        </Typography>
        {([0, 1, 2, 3] as Status[]).map(s => <StatusOption key={s} s={s} current={status} onSelect={handleSelect} />)}

        <Box sx={{ mx: 1, my: 0.4, borderTop: '1px solid rgba(255,255,255,0.06)' }} />
        <Typography sx={{ fontSize: '0.52rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 1, px: 1.5, pb: 0.3, fontWeight: 700 }}>
          Cliente
        </Typography>
        {([4, 5, 6] as Status[]).map(s => <StatusOption key={s} s={s} current={status} onSelect={handleSelect} />)}

        <Box sx={{ mx: 1, my: 0.4, borderTop: '1px solid rgba(255,255,255,0.06)' }} />
        <StatusOption s={7} current={status} onSelect={handleSelect} />
        <Box sx={{ pb: 0.5 }} />
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
        px: 1.5, py: 0.75, borderRadius: 1.5, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 1,
        bgcolor: isCurrent ? `${c.color}15` : 'transparent',
        border: '1px solid', borderColor: isCurrent ? `${c.color}35` : 'transparent',
        '&:hover': { bgcolor: isCurrent ? `${c.color}22` : 'rgba(255,255,255,0.04)' },
        transition: 'all 0.12s',
      }}
    >
      <Typography sx={{ fontSize: '0.75rem', lineHeight: 1, width: 16, textAlign: 'center' }}>{c.emoji}</Typography>
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, bgcolor: c.dot, boxShadow: isCurrent ? `0 0 6px ${c.dot}` : 'none' }} />
      <Typography sx={{ fontSize: '0.76rem', fontWeight: isCurrent ? 700 : 400, color: isCurrent ? c.color : 'rgba(255,255,255,0.72)', flex: 1 }}>
        {c.label}
      </Typography>
      {isCurrent && <Typography sx={{ fontSize: '0.6rem', color: c.color, fontWeight: 800 }}>✓</Typography>}
    </Box>
  )
}
