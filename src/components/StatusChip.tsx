import { useState } from 'react'
import { Chip, Popover, Box, Typography, type ChipProps } from '@mui/material'
import type { Status } from '../types'

const STATUS_CONFIG: Record<Status, { label: string; color: ChipProps['color']; variant: ChipProps['variant'] }> = {
  0: { label: 'Pendente',   color: 'default',  variant: 'outlined' },
  1: { label: 'Em edição',  color: 'warning',  variant: 'filled'   },
  2: { label: 'Aprovado',   color: 'info',     variant: 'filled'   },
  3: { label: 'Publicado',  color: 'success',  variant: 'filled'   },
  4: { label: 'Reprovado',  color: 'error',    variant: 'filled'   },
}

interface Props {
  status: Status
  onClick?: (s: Status) => void
  size?: ChipProps['size']
}

export default function StatusChip({ status, onClick, size = 'small' }: Props) {
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
        label={cfg.label}
        color={cfg.color}
        variant={cfg.variant}
        size={size}
        onClick={onClick ? handleChipClick : undefined}
        sx={{ cursor: onClick ? 'pointer' : 'default', fontWeight: 600, minWidth: 90 }}
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
              background: 'rgba(20,20,20,0.97)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              display: 'flex', flexDirection: 'column', gap: 0.3, minWidth: 120,
            },
          },
        }}
      >
        {([0, 1, 2, 3, 4] as Status[]).map(s => {
          const c = STATUS_CONFIG[s]
          const isCurrent = s === status
          return (
            <Box
              key={s}
              onClick={() => handleSelect(s)}
              sx={{
                px: 1.5, py: 0.7, borderRadius: 1.5, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 1,
                bgcolor: isCurrent ? 'rgba(255,144,57,0.12)' : 'transparent',
                border: '1px solid',
                borderColor: isCurrent ? 'rgba(255,144,57,0.3)' : 'transparent',
                '&:hover': { bgcolor: isCurrent ? 'rgba(255,144,57,0.16)' : 'rgba(255,255,255,0.06)' },
                transition: 'background 0.15s',
              }}
            >
              <Box sx={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                bgcolor: s === 0 ? 'rgba(255,255,255,0.3)' : s === 1 ? 'warning.main' : s === 2 ? 'info.main' : s === 3 ? 'success.main' : 'error.main',
              }} />
              <Typography sx={{
                fontSize: '0.78rem',
                fontWeight: isCurrent ? 700 : 500,
                color: isCurrent ? 'primary.main' : 'text.primary',
              }}>
                {c.label}
              </Typography>
              {isCurrent && (
                <Typography sx={{ ml: 'auto', fontSize: '0.58rem', color: 'primary.main', fontWeight: 700 }}>✓</Typography>
              )}
            </Box>
          )
        })}
      </Popover>
    </>
  )
}
