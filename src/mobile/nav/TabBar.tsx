import { type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { motion } from 'framer-motion'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import { DS } from '../../theme'
import { spring } from '../system/motion'
import { haptic } from '../system/haptics'

export type TabKey = 'hoje' | 'kanban' | 'acoes' | 'clientes' | 'mais'

interface TabDef { key: TabKey; label: string; icon: ReactNode }

const TABS: TabDef[] = [
  { key: 'hoje',     label: 'Hoje',      icon: <HomeRoundedIcon /> },
  { key: 'kanban',   label: 'Produções', icon: <ViewKanbanRoundedIcon /> },
  { key: 'acoes',    label: 'Criar',     icon: <AddRoundedIcon /> },
  { key: 'clientes', label: 'Clientes',  icon: <PeopleRoundedIcon /> },
  { key: 'mais',     label: 'Mais',      icon: <MoreHorizRoundedIcon /> },
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
        const central = t.key === 'acoes'
        return (
          <Box
            key={t.key}
            onClick={() => { haptic('selection'); onSelect(t.key) }}
            role="button"
            aria-label={central ? 'Abrir central de ações' : t.label}
            sx={{
              flex: 1, position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 0.3, py: central ? 0 : 0.6, cursor: 'pointer', userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {selected && !central && (
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
            <Box sx={{ position: 'relative', zIndex: 1, display: 'inline-flex', mt: central ? -2.25 : 0 }}>
              {central ? (
                <motion.div whileTap={{ scale: 0.9 }} transition={spring.snappy} style={{ display: 'inline-flex' }}>
                  <Box sx={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', background: `linear-gradient(145deg, #4F9BFF, ${DS.accentStrong})`, border: `4px solid ${DS.bg}`, boxShadow: '0 10px 28px rgba(37,99,235,0.48), 0 0 0 1px rgba(244,247,255,0.14)', '& .MuiSvgIcon-root': { fontSize: '1.75rem' } }}>{t.icon}</Box>
                </motion.div>
              ) : (
                <motion.div
                  animate={{ scale: selected ? 1.06 : 1, y: selected ? -1 : 0 }}
                  transition={spring.snappy}
                  style={{ display: 'inline-flex', color: selected ? DS.orange : DS.t3 }}
                >
                  <Box sx={{ '& .MuiSvgIcon-root': { fontSize: '1.42rem' } }}>{t.icon}</Box>
                </motion.div>
              )}
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
              color: central ? DS.t2 : selected ? DS.orange : DS.t3,
              transition: 'color 0.2s',
              mt: central ? -0.2 : 0,
            }}>
              {t.label}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
