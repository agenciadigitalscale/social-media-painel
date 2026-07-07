import { type ReactNode, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { motion } from 'framer-motion'
import type { ContentItem, ItemState, ItemEditPatch, Status } from '../types'
import { DS } from '../theme'
import { screenSwap } from './system/motion'
import { haptic } from './system/haptics'
import TabBar, { type TabKey } from './nav/TabBar'
import MoreSheet, { type NavItemLike } from './nav/MoreSheet'
import PullToRefresh from './system/PullToRefresh'
import MobileKanban from './kanban/MobileKanban'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
  currentUser: string
  clientColors: Record<string, string>
  hiddenTabs: number[]
  onStatusChange: (id: number, s: Status) => void
  onUpdate: (id: number, patch: Partial<ItemState>) => void
  onSendToClient: (itemId: number, clientName: string, isTraffic?: boolean) => void | Promise<void>
  onEdit?: (id: number, patch: ItemEditPatch) => void
  renderTab: (tab: number) => ReactNode
  tab: number
  setTab: (t: number) => void
  navItems: NavItemLike[]
  onRefresh?: () => Promise<void> | void
  onLogout?: () => void
  userInfo?: { name: string; role: string; emoji: string; color: string }
  badges?: Partial<Record<TabKey, number>>
}

const PRIMARY_TO_TAB: Record<Exclude<TabKey, 'mais'>, number> = {
  hoje: 1, kanban: 4, gravacoes: 9, clientes: 6,
}
const TITLES: Record<Exclude<TabKey, 'mais'>, string> = {
  hoje: 'Hoje', kanban: 'Kanban', gravacoes: 'Gravações', clientes: 'Clientes',
}

export default function MobileShell(props: Props) {
  const { items, states, now, currentUser, clientColors, hiddenTabs, onStatusChange, onUpdate, onSendToClient,
    renderTab, tab, setTab, navItems, onRefresh, onLogout, userInfo, badges } = props

  const [primary, setPrimary] = useState<Exclude<TabKey, 'mais'>>('hoje')
  const [fallback, setFallback] = useState<number | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)

  const activeKey: TabKey = fallback !== null ? 'mais' : primary
  const title = fallback !== null ? (navItems[fallback]?.label ?? '') : TITLES[primary]
  const viewId = fallback !== null ? `fb-${fallback}` : primary

  const selectPrimary = (key: TabKey) => {
    if (key === 'mais') { setMoreOpen(true); return }
    setFallback(null)
    setPrimary(key)
    setTab(PRIMARY_TO_TAB[key])
  }

  const selectFallback = (idx: number) => {
    setFallback(idx)
    setTab(idx)
  }

  const refresh = async () => { if (onRefresh) await onRefresh() }

  const scrollBox = (node: ReactNode) => (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
      '&::-webkit-scrollbar': { width: 3 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(249,115,22,0.4)', borderRadius: 3 } }}>
      {node}
    </Box>
  )

  const renderView = (): ReactNode => {
    if (fallback !== null) return scrollBox(renderTab(fallback))
    if (primary === 'kanban') {
      return (
        <MobileKanban
          items={items}
          states={states}
          now={now}
          currentUser={currentUser}
          clientColors={clientColors}
          onStatusChange={onStatusChange}
          onUpdate={onUpdate}
          onSendToClient={onSendToClient}
        />
      )
    }
    if (primary === 'gravacoes') return scrollBox(renderTab(9))
    // hoje / clientes → pull-to-refresh + componente existente
    return <PullToRefresh onRefresh={refresh}>{renderTab(primary === 'hoje' ? 1 : 6)}</PullToRefresh>
  }

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: DS.bg, overflow: 'hidden' }}>
      {/* header slim */}
      <Box sx={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.2,
        px: 2, pt: 'max(env(safe-area-inset-top), 10px)', pb: 1.2,
        borderBottom: `1px solid ${DS.border}`,
        background: 'rgba(9,10,15,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: '0.56rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: DS.t3 }}>
            DS HUB
          </Typography>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: DS.t1, lineHeight: 1.1 }} noWrap>
            {title}
          </Typography>
        </Box>
        {userInfo && (
          <Box
            onClick={() => { haptic('selection'); setMoreOpen(true) }}
            sx={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem',
              background: `${userInfo.color}1e`, border: `1.5px solid ${userInfo.color}55`,
              '&:active': { transform: 'scale(0.92)' }, transition: 'transform 0.12s',
            }}
          >
            {userInfo.emoji}
          </Box>
        )}
      </Box>

      {/* conteúdo — transição de entrada por tela (sem exit, para não prender views pesadas) */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <motion.div
          key={viewId}
          variants={screenSwap}
          initial="initial"
          animate="animate"
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          {renderView()}
        </motion.div>
      </Box>

      <TabBar active={activeKey} onSelect={selectPrimary} badges={badges} />

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        navItems={navItems}
        hiddenTabs={hiddenTabs}
        currentTab={fallback ?? tab}
        onSelectTab={selectFallback}
        userInfo={userInfo}
        onLogout={onLogout}
      />
    </Box>
  )
}
