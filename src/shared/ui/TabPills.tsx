import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { DS } from '../../theme'

/**
 * TabPills — abas em pills: pill ativa com fundo tintado, borda e glow sutil
 * na cor; inativas dimmed. Substitui MUI Tabs nas telas de página (não em
 * boards, que têm seus pills próprios por coluna/board).
 */
export interface PillTab {
  label: string
  icon?: ReactNode
  color?: string
}

interface TabPillsProps {
  tabs: PillTab[]
  value: number
  onChange: (index: number) => void
}

export default function TabPills({ tabs, value, onChange }: TabPillsProps) {
  return (
    <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
      {tabs.map((t, i) => {
        const active = i === value
        const color = t.color ?? DS.orange
        return (
          <Box
            key={t.label}
            onClick={() => onChange(i)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.6,
              px: { xs: 1.3, md: 1.6 }, py: 0.7, borderRadius: 2.5, cursor: 'pointer',
              bgcolor: active ? `${color}16` : 'rgba(244,247,255,0.03)',
              border: `1px solid ${active ? `${color}55` : DS.border}`,
              boxShadow: active ? `0 0 14px ${color}22` : 'none',
              transition: 'all 0.18s ease',
              '&:hover': { bgcolor: active ? `${color}1c` : 'rgba(244,247,255,0.05)' },
            }}
          >
            {t.icon && <Box sx={{ display: 'flex', color: active ? color : DS.t2, fontSize: '0.9rem', lineHeight: 1 }}>{t.icon}</Box>}
            <Typography sx={{
              fontSize: { xs: '0.7rem', md: '0.74rem', xl: '0.82rem' }, fontWeight: 800,
              color: active ? color : DS.t2, whiteSpace: 'nowrap',
            }}>
              {t.label}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
