import { type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { motion } from 'framer-motion'
import LogoutIcon from '@mui/icons-material/Logout'
import BottomSheet from '../system/BottomSheet'
import { DS } from '../../theme'
import { listItem } from '../system/motion'
import { haptic } from '../system/haptics'

export interface NavItemLike {
  label: string
  icon: ReactNode
  hidden?: boolean
  mobileHidden?: boolean
  highlight?: boolean
}

export interface GrupoNav { key: string; label: string; tabs: number[] }

interface Props {
  open: boolean
  /** Os grupos da barra lateral do desktop — a mesma organização nos dois. */
  groups: GrupoNav[]
  /** Abas que já estão na barra de baixo (não repetir aqui). */
  naBarra: number[]
  onClose: () => void
  navItems: NavItemLike[]
  hiddenTabs: number[]
  currentTab: number
  onSelectTab: (tab: number) => void
  userInfo?: { name: string; role: string; emoji: string; color: string }
  onLogout?: () => void
}

export default function MoreSheet({ open, onClose, groups, naBarra, navItems, hiddenTabs, currentTab, onSelectTab, userInfo, onLogout }: Props) {
  // Tudo que o cargo pode ver, inclusive o que antes era "só desktop": esconder
  // aqui deixava Dashboard, Equipe, Entregas do time e outras sem caminho nenhum
  // no celular (2026-11-07).
  const pode = (idx: number) => !!navItems[idx] && !navItems[idx].hidden && !hiddenTabs.includes(idx) && !naBarra.includes(idx)
  const secoes = groups
    .map(g => ({ ...g, tabs: g.tabs.filter(pode) }))
    .filter(g => g.tabs.length > 0)
  let ordem = 0

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        userInfo ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.3 }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem', background: `${userInfo.color}1e`, border: `1.5px solid ${userInfo.color}55`,
            }}>
              {userInfo.emoji}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 800, color: DS.t1, textTransform: 'capitalize' }} noWrap>
                {userInfo.name}
              </Typography>
              <Typography sx={{ fontSize: '0.64rem', color: DS.t2 }} noWrap>{userInfo.role}</Typography>
            </Box>
            {onLogout && (
              <Box
                onClick={() => { haptic('light'); onLogout() }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5, px: 1.2, py: 0.7, borderRadius: 2,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)', color: DS.red,
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <LogoutIcon sx={{ fontSize: 15 }} />
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700 }}>Sair</Typography>
              </Box>
            )}
          </Box>
        ) : (
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: DS.t3 }}>
            Todas as seções
          </Typography>
        )
      }
    >
      <Box sx={{ px: 1.6, pt: 0.5, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.6 }}>
        {secoes.map(g => (
          <Box key={g.key}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.1em', px: 0.4, mb: 0.8 }}>
              {g.label}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
              {g.tabs.map(idx => {
                const item = navItems[idx]
                const active = idx === currentTab
                return (
                  <motion.div key={idx} variants={listItem} initial="initial" animate="animate" custom={ordem++}>
                    <Box
                      role="button"
                      onClick={() => { haptic('selection'); onSelectTab(idx); onClose() }}
                      sx={{
                        height: '100%', minHeight: 84,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 0.7, px: 0.6, py: 1.4, borderRadius: 3, cursor: 'pointer',
                        background: active ? 'rgba(255,122,0,0.12)' : 'rgba(247,247,245,0.03)',
                        border: `1px solid ${active ? 'rgba(255,122,0,0.3)' : DS.border}`,
                        transition: 'transform 0.15s ease, background 0.2s',
                        '&:active': { transform: 'scale(0.95)' },
                      }}
                    >
                      <Box sx={{ color: active ? DS.accent : DS.t2, '& .MuiSvgIcon-root': { fontSize: '1.5rem' } }}>
                        {item.icon}
                      </Box>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textAlign: 'center', lineHeight: 1.15, color: active ? DS.accent : DS.t1 }}>
                        {item.label}
                      </Typography>
                    </Box>
                  </motion.div>
                )
              })}
            </Box>
          </Box>
        ))}
      </Box>
    </BottomSheet>
  )
}
