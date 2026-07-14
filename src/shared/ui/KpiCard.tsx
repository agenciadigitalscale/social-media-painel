import { Box, Typography, Paper } from '@mui/material'
import type { ReactNode } from 'react'
import { DS } from '../../theme'

/**
 * KpiCard — card de métrica dark premium: número grande, label em
 * uppercase, ícone no canto e uma faixa-topo colorida sutil por semântica.
 * `color` default = laranja DS (mantém a identidade).
 */
interface KpiCardProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  color?: string
  icon?: ReactNode
}

export default function KpiCard({ label, value, sub, color = DS.orange, icon }: KpiCardProps) {
  return (
    <Paper sx={{
      position: 'relative', overflow: 'hidden',
      p: { xs: 1.6, md: 2.1, xl: 2.6 },
      border: `1px solid ${DS.border}`,
      display: 'flex', flexDirection: 'column', gap: 0.55,
      transition: 'border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
      '&:hover': {
        borderColor: `${color}40`,
        transform: 'translateY(-1px)',
        boxShadow: `0 8px 24px rgba(0,0,0,0.4)`,
      },
      '&::before': {
        content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2.5px',
        background: `linear-gradient(90deg, ${color}, ${color}00 82%)`,
      },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
        <Typography sx={{
          fontSize: { xs: '0.6rem', xl: '0.68rem' }, color: 'text.secondary',
          fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', flex: 1,
        }}>
          {label}
        </Typography>
        {icon && <Box sx={{ color, opacity: 0.9, display: 'flex', flexShrink: 0 }}>{icon}</Box>}
      </Box>
      <Typography sx={{
        fontSize: { xs: '1.9rem', md: '2.3rem', xl: '2.9rem' },
        fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.02em',
      }}>
        {value}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: { xs: '0.58rem', xl: '0.66rem' }, color: 'text.secondary' }}>
          {sub}
        </Typography>
      )}
    </Paper>
  )
}
