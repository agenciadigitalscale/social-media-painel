import { Box, Typography, Button } from '@mui/material'
import type { SmartNotification } from './model'

interface MobileNotificationCenterProps {
  notifications: SmartNotification[]
  now: Date
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onOpen: (notification: SmartNotification) => void
}

export default function MobileNotificationCenter({ notifications, onMarkRead, onMarkAllRead, onOpen }: MobileNotificationCenterProps) {
  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Notificações</Typography>
        <Button variant="text" onClick={onMarkAllRead} sx={{ color: '#7f97c0' }}>Marcar tudo</Button>
      </Box>
      {notifications.length === 0 ? (
        <Typography sx={{ color: 'rgba(244,247,255,0.7)' }}>Sem notificações no momento.</Typography>
      ) : notifications.map((notification) => (
        <Box key={notification.id} sx={{ p: 1, mb: 1, borderRadius: 2, background: 'rgba(244,247,255,0.04)', cursor: 'pointer' }} onClick={() => onOpen(notification)}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{notification.title}</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.65)' }}>{notification.body}</Typography>
          <Button size="small" onClick={(event) => { event.stopPropagation(); onMarkRead(notification.id) }} sx={{ mt: 1, color: '#7f97c0' }}>Ler</Button>
        </Box>
      ))}
    </Box>
  )
}
