import { type ReactNode, useMemo, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { motion } from 'framer-motion'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import type { ContentItem, ItemState, ItemEditPatch, Status, ContentType, Client, Notification as HubNotification } from '../types'
import { dismissAssignment } from '../lib/assignments'
import { DS } from '../theme'
import { screenSwap } from './system/motion'
import { haptic } from './system/haptics'
import TabBar, { type TabKey } from './nav/TabBar'
import MoreSheet, { type NavItemLike } from './nav/MoreSheet'
import PullToRefresh from './system/PullToRefresh'
import MobileKanban from './kanban/MobileKanban'
import type { QuickKey } from './kanban/filters'
import MobileToday from './today/MobileToday'
import MobileClients from './clients/MobileClients'
import QuickActionSheet from './nav/QuickActionSheet'
import PwaStatusBar from './system/PwaStatusBar'
import MobileNotificationCenter from './notifications/MobileNotificationCenter'
import { useSmartNotifications } from './notifications/useSmartNotifications'
import type { SmartNotification } from './notifications/model'
import MobileGlobalSearch from './search/MobileGlobalSearch'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
  currentUser: string
  clientColors: Record<string, string>
  allClients: Client[]
  hiddenTabs: number[]
  onStatusChange: (id: number, s: Status) => void
  onUpdate: (id: number, patch: Partial<ItemState>) => void
  onSendToClient: (itemId: number, clientName: string, isTraffic?: boolean) => void | Promise<void>
  onBulkSendToClient?: (clientName: string, itemIds: number[]) => void | Promise<void>
  onRemindClient?: (itemId: number, clientName: string) => void
  onAddItem?: (clientName: string, title: string, type: ContentType, date: Date, status: Status) => void
  onAppendHistory?: (id: number, action: string) => void
  onReviewNotify?: (itemId: number, clientName: string, reservedTab?: Window | null) => Promise<boolean>
  onEdit?: (id: number, patch: ItemEditPatch) => void
  renderTab: (tab: number) => ReactNode
  tab: number
  setTab: (t: number) => void
  navItems: NavItemLike[]
  onRefresh?: () => Promise<void> | void
  onLogout?: () => void
  userInfo?: { name: string; role: string; emoji: string; color: string }
  badges?: Partial<Record<TabKey, number>>
  notifications: HubNotification[]
  assignmentTrigger?: number
  onMarkNotificationRead?: (id: string) => void
  onMarkAllNotificationsRead?: () => void
}

type PrimaryKey = Exclude<TabKey, 'mais' | 'acoes'>

const PRIMARY_TO_TAB: Record<PrimaryKey, number> = {
  hoje: 1, kanban: 4, clientes: 6,
}
const TITLES: Record<PrimaryKey, string> = {
  hoje: 'Hoje', kanban: 'Produções', clientes: 'Clientes',
}

export default function MobileShell(props: Props) {
  const { items, states, now, currentUser, clientColors, allClients, hiddenTabs, onStatusChange, onUpdate, onSendToClient, onBulkSendToClient, onRemindClient, onAddItem, onAppendHistory, onReviewNotify,
    renderTab, tab, setTab, navItems, onRefresh, onLogout, userInfo, badges, notifications, assignmentTrigger, onMarkNotificationRead, onMarkAllNotificationsRead } = props

  const [primary, setPrimary] = useState<PrimaryKey>('hoje')
  const [fallback, setFallback] = useState<number | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [productionEpoch, setProductionEpoch] = useState(0)

  const smart = useSmartNotifications({
    items, states, liveNotifications: notifications, now, currentUser, assignmentTrigger,
    onMarkLiveRead: onMarkNotificationRead, onMarkAllLiveRead: onMarkAllNotificationsRead,
  })

  const activeKey: TabKey = fallback !== null ? 'mais' : primary
  const title = searchOpen ? 'Buscar no DSHub' : notificationsOpen ? 'Notificações' : fallback !== null ? (navItems[fallback]?.label ?? '') : TITLES[primary]
  const viewId = searchOpen ? 'search' : notificationsOpen ? 'notifications' : fallback !== null ? `fb-${fallback}` : primary

  const selectPrimary = (key: TabKey) => {
    setNotificationsOpen(false)
    setSearchOpen(false)
    if (key === 'mais') { setMoreOpen(true); return }
    if (key === 'acoes') { setQuickOpen(true); return }
    setFallback(null)
    setPrimary(key)
    setTab(PRIMARY_TO_TAB[key])
  }

  const selectFallback = (idx: number) => {
    setNotificationsOpen(false)
    setSearchOpen(false)
    setFallback(idx)
    setTab(idx)
  }

  const openProductions = (filter?: QuickKey, client?: string, focus?: { itemId: number; destination: 'approval' | 'card' }, responsible?: string) => {
    const approvals = filter === 'aprovacao' || focus?.destination === 'approval'
    sessionStorage.setItem('dshub-mobile-production-view', JSON.stringify(approvals ? 'approvals' : 'kanban'))
    sessionStorage.setItem('dshub-mobile-filters', JSON.stringify({ quick: filter ? [filter] : [], ...(client ? { client } : {}), ...(responsible ? { responsible } : {}) }))
    sessionStorage.removeItem('dshub-mobile-approval-item')
    sessionStorage.removeItem('dshub-mobile-open-item')
    if (focus?.destination === 'approval') sessionStorage.setItem('dshub-mobile-approval-item', JSON.stringify(focus.itemId))
    if (focus?.destination === 'card') sessionStorage.setItem('dshub-mobile-open-item', JSON.stringify(focus.itemId))
    setNotificationsOpen(false)
    setSearchOpen(false)
    setFallback(null)
    setPrimary('kanban')
    setTab(4)
    setProductionEpoch(value => value + 1)
  }

  const openClients = () => {
    setNotificationsOpen(false)
    setSearchOpen(false)
    setFallback(null)
    setPrimary('clientes')
    setTab(6)
  }

  const computedBadges = useMemo(() => {
    const today = new Date(now).setHours(0, 0, 0, 0)
    const overdue = items.filter(item => {
      const status = states[item.i]?.status ?? item.s
      const assigned = states[item.i]?.responsible === currentUser || states[item.i]?.assignedEditor === currentUser
      const leadership = currentUser === 'kaique' || currentUser === 'pradox' || currentUser === 'testa'
      return status !== 7 && new Date(item.dt).setHours(0, 0, 0, 0) < today && (leadership || assigned)
    }).length
    const decisions = items.filter(item => {
      const status = states[item.i]?.status ?? item.s
      return status === 2 || status === 4 || status === 6
    }).length
    return { hoje: overdue, kanban: decisions, ...badges }
  }, [items, states, now, currentUser, badges])

  const refresh = async () => { if (onRefresh) await onRefresh() }

  const openNotification = (notification: SmartNotification) => {
    if (notification.source === 'assignment' && notification.sourceId) dismissAssignment(notification.sourceId)
    if (notification.destination === 'overdue') { openProductions('atrasados'); return }
    if (notification.itemId && (notification.destination === 'approval' || notification.destination === 'card')) {
      openProductions(notification.destination === 'approval' ? 'aprovacao' : undefined, notification.clientName, {
        itemId: notification.itemId, destination: notification.destination,
      })
    }
  }

  const scrollBox = (node: ReactNode) => (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
      '&::-webkit-scrollbar': { width: 3 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(59,130,246,0.4)', borderRadius: 3 } }}>
      {node}
    </Box>
  )

  const renderView = (): ReactNode => {
    if (searchOpen) return (
      <MobileGlobalSearch
        items={items}
        states={states}
        clients={allClients}
        now={now}
        onOpenContent={(itemId, clientName) => openProductions(undefined, clientName, { itemId, destination: 'card' })}
        onOpenClient={clientName => openProductions(undefined, clientName)}
        onOpenPerson={personKey => openProductions(undefined, undefined, undefined, personKey)}
      />
    )
    if (notificationsOpen) return (
      <MobileNotificationCenter
        notifications={smart.notifications}
        now={now}
        onMarkRead={smart.markRead}
        onMarkAllRead={smart.markAllRead}
        onOpen={openNotification}
      />
    )
    if (fallback !== null) return scrollBox(renderTab(fallback))
    if (primary === 'kanban') {
      return (
        <MobileKanban
          key={productionEpoch}
          items={items}
          states={states}
          now={now}
          currentUser={currentUser}
          clientColors={clientColors}
          allClients={allClients}
          onStatusChange={onStatusChange}
          onUpdate={onUpdate}
          onSendToClient={onSendToClient}
          onBulkSendToClient={onBulkSendToClient}
          onRemindClient={onRemindClient}
          onAppendHistory={onAppendHistory}
          onReviewNotify={onReviewNotify}
        />
      )
    }
    if (primary === 'clientes') {
      return (
        <PullToRefresh onRefresh={refresh}>
          <MobileClients items={items} states={states} allClients={allClients} clientColors={clientColors} now={now} onOpenProductions={client => openProductions(undefined, client)} />
        </PullToRefresh>
      )
    }
    return (
      <PullToRefresh onRefresh={refresh}>
        <MobileToday
          items={items}
          states={states}
          allClients={allClients}
          clientColors={clientColors}
          now={now}
          currentUser={currentUser}
          userInfo={userInfo}
          onOpenProductions={openProductions}
          onOpenClients={openClients}
          onNavigateTab={selectFallback}
        />
      </PullToRefresh>
    )
  }

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: `radial-gradient(circle at 72% -12%, rgba(59,130,246,0.1), transparent 34%), ${DS.bg}`, overflow: 'hidden' }}>
      {/* header slim */}
      <Box sx={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.2,
        px: 2, pt: 'max(env(safe-area-inset-top), 10px)', pb: 1.2,
        borderBottom: `1px solid ${DS.border}`,
        background: 'rgba(9,10,15,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        {(notificationsOpen || searchOpen) && (
          <Box onClick={() => { haptic('selection'); setNotificationsOpen(false); setSearchOpen(false) }} role="button" aria-label="Voltar" sx={{ width: 36, height: 36, borderRadius: 2.4, display: 'grid', placeItems: 'center', color: DS.t2, background: 'rgba(244,247,255,.035)', border: `1px solid ${DS.border}`, cursor: 'pointer', flexShrink: 0 }}>
            <ArrowBackRoundedIcon sx={{ fontSize: 20 }} />
          </Box>
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: '0.56rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: DS.t3 }}>
            DS HUB
          </Typography>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: DS.t1, lineHeight: 1.1 }} noWrap>
            {title}
          </Typography>
        </Box>
        {!notificationsOpen && !searchOpen && (
          <Box onClick={() => { haptic('selection'); setSearchOpen(true) }} role="button" aria-label="Buscar no DSHub" sx={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', color: DS.t2, background: 'rgba(244,247,255,.03)', border: `1px solid ${DS.border}`, cursor: 'pointer', flexShrink: 0, '&:active': { color: DS.cyan, borderColor: 'rgba(6,182,212,.35)' } }}>
            <SearchRoundedIcon sx={{ fontSize: 20 }} />
          </Box>
        )}
        {!notificationsOpen && !searchOpen && (
          <Box onClick={() => { haptic('selection'); setNotificationsOpen(true); setSearchOpen(false) }} role="button" aria-label={`Notificações${smart.unread ? `, ${smart.unread} não lidas` : ''}`} sx={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', color: smart.priorityUnread ? DS.cyan : DS.t2, background: smart.unread ? 'rgba(14,165,233,.11)' : 'rgba(244,247,255,.03)', border: `1px solid ${smart.unread ? 'rgba(14,165,233,.3)' : DS.border}`, cursor: 'pointer', flexShrink: 0 }}>
            <NotificationsRoundedIcon sx={{ fontSize: 20 }} />
            {smart.unread > 0 && (
              <Box sx={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, px: .3, borderRadius: 8, display: 'grid', placeItems: 'center', background: smart.priorityUnread ? DS.red : DS.orange, boxShadow: '0 0 0 2px #080c14' }}>
                <Typography sx={{ fontSize: '.48rem', lineHeight: 1, fontWeight: 900, color: '#fff' }}>{smart.unread > 9 ? '9+' : smart.unread}</Typography>
              </Box>
            )}
          </Box>
        )}
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

      <PwaStatusBar />

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

      <TabBar active={activeKey} onSelect={selectPrimary} badges={computedBadges} />

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

      <QuickActionSheet
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        clients={allClients}
        now={now}
        onAddItem={onAddItem}
        onRecording={() => selectFallback(9)}
        onApprovals={() => openProductions('aprovacao')}
        onCalendar={() => selectFallback(5)}
      />
    </Box>
  )
}
