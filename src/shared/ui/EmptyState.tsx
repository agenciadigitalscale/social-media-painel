import { Box, Typography, Button } from '@mui/material'
import type { ReactNode } from 'react'
import { DS } from '../../theme'

/**
 * EmptyState — estado vazio amigável: ícone grande num
 * círculo, título, subtítulo e CTA opcional. Nunca deixar tela vazia "morta".
 */
interface EmptyStateProps {
  icon: ReactNode
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
  color?: string
}

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction, color = DS.orange }: EmptyStateProps) {
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', gap: 1.5, py: { xs: 5, md: 7 }, px: 3,
    }}>
      <Box sx={{
        width: 64, height: 64, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(circle, ${color}18 0%, ${color}06 70%, transparent 100%)`,
        border: `1px solid ${color}25`, color, fontSize: 30,
      }}>
        {icon}
      </Box>
      <Typography sx={{ fontSize: { xs: '1rem', md: '1.15rem' }, fontWeight: 800, color: DS.t1, letterSpacing: '-0.01em' }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', maxWidth: 420, lineHeight: 1.6 }}>
          {subtitle}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          sx={{
            mt: 0.5, px: 2.4, py: 1, borderRadius: 2.5, fontWeight: 800, fontSize: '0.82rem',
            color: '#fff', background: `linear-gradient(135deg, ${DS.orange}, DS.cyan)`,
            boxShadow: `0 6px 20px ${DS.orange}35`,
            '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  )
}
