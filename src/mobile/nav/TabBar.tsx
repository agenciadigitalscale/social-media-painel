import { type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { motion } from 'framer-motion'
import TodayIcon from '@mui/icons-material/Today'
import ViewKanbanIcon from '@mui/icons-material/ViewKanban'
import VideocamIcon from '@mui/icons-material/Videocam'
import PeopleIcon from '@mui/icons-material/People'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { DS } from '../../theme'
import { spring } from '../system/motion'
import { haptic } from '../system/haptics'

export type TabKey = 'hoje' | 'kanban' | 'gravacoes' | 'clientes' | 'mais'

interface TabDef { key: TabKey; label: string; icon: ReactNode }

const TABS: TabDef[] = [
  { key: 'hoje',      label: 'Hoje',      icon: <TodayIcon /> },
  { key: 'kanban',    label: 'Kanban',    icon: <ViewKanbanIcon /> },
  { key: 'gravacoes', label: 'Gravar',    icon: <VideocamIcon /> },
  { key: 'clientes',  label: 'Clientes',  icon: <PeopleIcon /> },
  { key: 'mais',      label: 'Mais',      icon: <MoreHorizIcon /> },
]

interface Props {
  active: TabKey
  onSelect: (key: TabKey) => void
  badges?: Partial<Record<TabKey, number>>
}

export default function TabBar({ active, onSelect, badges }: Props) {
  return (
    <Box
      sx={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'stretch',
        px: 1,
        pt: 0.6,
        pb: 'max(env(safe-area-inset-bottom), 8px)',
        background: 'rgba(9,10,15,0.86)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: `1px solid ${DS.border}`,
      }}
    >
      {TABS.map((t) => {
        const selected = active === t.key
        const badge = badges?.[t.key] ?? 0
        return (
          <Box
            key={t.key}
            onClick={() => { haptic('selection'); onSelect(t.key) }}
            sx={{
              flex: 1, position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 0.3, py: 0.6, cursor: 'pointer', userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {selected && (
              <motion.div
                layoutId="tabPill"
                transition={spring.snappy}
                style={{
                  position: 'absolute', top: 2, bottom: 2, left: 8, right: 8,
                  borderRadius: 14, background: 'rgba(59,130,246,0.12)',
                  border: '1px solid rgba(59,130,246,0.22)',
                }}
              />
            )}
            <Box sx={{ position: 'relative', zIndex: 1, display: 'inline-flex' }}>
              <motion.div
                animate={{ scale: selected ? 1.06 : 1, y: selected ? -1 : 0 }}
                transition={spring.snappy}
                style={{ display: 'inline-flex', color: selected ? DS.orange : DS.t3 }}
              >
                <Box sx={{ '& .MuiSvgIcon-root': { fontSize: '1.42rem' } }}>{t.icon}</Box>
              </motion.div>
              {badge > 0 && (
                <Box sx={{
                  position: 'absolute', top: -3, right: -6,
                  minWidth: 15, height: 15, px: 0.35, borderRadius: 8,
                  bgcolor: DS.orange, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 0 2px rgba(9,10,15,0.9)',
                }}>
                  <Typography sx={{ fontSize: '0.5rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                    {badge > 9 ? '9+' : badge}
                  </Typography>
                </Box>
              )}
            </Box>
            <Typography sx={{
              position: 'relative', zIndex: 1,
              fontSize: '0.56rem', fontWeight: 800, letterSpacing: '0.04em',
              color: selected ? DS.orange : DS.t3,
              transition: 'color 0.2s',
            }}>
              {t.label}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
