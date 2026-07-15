import { useState } from 'react'
import {
  Box, Typography, Badge, Popover, Divider, Button, Chip,
} from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import InfoIcon from '@mui/icons-material/Info'
import CommentIcon from '@mui/icons-material/Comment'
import ScheduleIcon from '@mui/icons-material/Schedule'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import type { Notification } from '../types'

interface Props {
  notifications: Notification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onNavigateToItem?: (itemId: number) => void
}

const TYPE_ICON: Record<Notification['type'], React.ReactNode> = {
  approval:  <CheckCircleIcon sx={{ fontSize: 14 }} />,
  rejection: <ErrorIcon sx={{ fontSize: 14 }} />,
  comment:   <CommentIcon sx={{ fontSize: 14 }} />,
  delay:     <ScheduleIcon sx={{ fontSize: 14 }} />,
  published: <RocketLaunchIcon sx={{ fontSize: 14 }} />,
  info:      <InfoIcon sx={{ fontSize: 14 }} />,
  internal:  <InfoIcon sx={{ fontSize: 14 }} />,
}

const TYPE_COLOR: Record<Notification['type'], string> = {
  approval:  '#31D17C',
  rejection: '#EF4444',
  comment:   '#3B82F6',
  delay:     '#F59E0B',
  published: '#31D17C',
  info:      '#9CA3AF',
  internal:  '#60A5FA',
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min atrás`
  if (h < 24) return `${h}h atrás`
  return `${d}d atrás`
}

export default function NotificationCenter({ notifications, onMarkRead, onMarkAllRead, onNavigateToItem }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  const unread = notifications.filter(n => !n.read).length
  const sorted = [...notifications].sort((a, b) => b.createdAt - a.createdAt).slice(0, 40)

  return (
    <>
      <Box
        onClick={e => setAnchor(e.currentTarget)}
        sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        title="Notificações"
      >
        <Badge
          badgeContent={unread || undefined}
          max={99}
          sx={{
            '& .MuiBadge-badge': {
              bgcolor: '#EF4444',
              color: '#fff',
              fontSize: '0.52rem',
              fontWeight: 800,
              minWidth: 16,
              height: 16,
              padding: '0 3px',
              boxShadow: '0 0 8px rgba(239,68,68,0.6)',
            },
          }}
        >
          {unread > 0
            ? <NotificationsIcon sx={{ fontSize: 20, color: 'primary.main', '@keyframes bellRing': { '0%,100%': { transform: 'rotate(0)' }, '15%': { transform: 'rotate(12deg)' }, '30%': { transform: 'rotate(-10deg)' }, '45%': { transform: 'rotate(8deg)' }, '60%': { transform: 'rotate(-6deg)' }, '75%': { transform: 'rotate(4deg)' } }, animation: 'bellRing 2.5s ease-in-out infinite' }} />
            : <NotificationsNoneIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          }
        </Badge>
      </Box>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 380, maxHeight: 520,
              background: 'rgba(8,8,8,0.98)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 3,
              boxShadow: '0 20px 60px rgba(0,0,0,0.85)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        {/* Header */}
        <Box sx={{
          px: 2, py: 1.5,
          display: 'flex', alignItems: 'center', gap: 1,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, transparent 100%)',
          flexShrink: 0,
        }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.88rem', flex: 1 }}>Notificações</Typography>
          {unread > 0 && (
            <Chip
              label={`${unread} nova${unread > 1 ? 's' : ''}`}
              size="small"
              sx={{ fontSize: '0.58rem', height: 18, bgcolor: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}
            />
          )}
          {notifications.length > 0 && (
            <Button
              size="small"
              onClick={onMarkAllRead}
              sx={{ fontSize: '0.6rem', color: 'text.disabled', minWidth: 0, '&:hover': { color: 'text.secondary' } }}
            >
              Limpar todas
            </Button>
          )}
        </Box>

        {/* List */}
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {sorted.length === 0 ? (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <NotificationsNoneIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.1)', mb: 1.5, display: 'block', mx: 'auto' }} />
              <Typography sx={{ fontSize: '0.78rem', color: 'text.disabled' }}>Nenhuma notificação</Typography>
            </Box>
          ) : (
            sorted.map((notif, i) => {
              const color = TYPE_COLOR[notif.type] ?? '#9CA3AF'
              const icon = TYPE_ICON[notif.type] ?? <InfoIcon sx={{ fontSize: 14 }} />
              return (
                <Box key={notif.id}>
                  <Box
                    onClick={() => {
                      onMarkRead(notif.id)
                      if (notif.itemId) onNavigateToItem?.(notif.itemId)
                      setAnchor(null)
                    }}
                    sx={{
                      px: 2, py: 1.2, cursor: 'pointer',
                      display: 'flex', gap: 1.2, alignItems: 'flex-start',
                      bgcolor: notif.read ? 'transparent' : `${color}06`,
                      borderLeft: `2px solid ${notif.read ? 'transparent' : color}`,
                      transition: 'all 0.15s',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                    }}
                  >
                    <Box sx={{ color, mt: 0.3, flexShrink: 0 }}>{icon}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{
                        fontSize: '0.76rem',
                        fontWeight: notif.read ? 400 : 700,
                        color: notif.read ? 'rgba(255,255,255,0.55)' : 'text.primary',
                        lineHeight: 1.35,
                        mb: 0.2,
                      }}>
                        {notif.title}
                      </Typography>
                      <Typography sx={{ fontSize: '0.67rem', color: 'text.disabled', lineHeight: 1.3 }} noWrap>
                        {notif.message}
                      </Typography>
                      <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)', mt: 0.4 }}>
                        {timeAgo(notif.createdAt)}
                      </Typography>
                    </Box>
                    {!notif.read && (
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0, mt: 0.6 }} />
                    )}
                  </Box>
                  {i < sorted.length - 1 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)', mx: 2 }} />}
                </Box>
              )
            })
          )}
        </Box>
      </Popover>
    </>
  )
}
