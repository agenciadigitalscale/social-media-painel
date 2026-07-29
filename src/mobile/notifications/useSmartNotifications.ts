import { useMemo } from 'react'
import type { ContentItem, ItemState, Notification } from '../../types'
import type { SmartNotification } from './model'

export function useSmartNotifications(_args: {
  items: ContentItem[]
  states: Record<number, ItemState>
  liveNotifications: Notification[]
  now: Date
  currentUser: string
  assignmentTrigger?: number
  onMarkLiveRead?: (id: string) => void
  onMarkAllLiveRead?: () => void
}) {
  const notifications = _args.liveNotifications ?? []
  return useMemo(() => ({
    notifications: notifications.map(n => ({ ...n, body: n.message } as SmartNotification)),
    unread: notifications.filter(n => !n.read).length,
    priorityUnread: notifications.some(n => !n.read),
    markRead: (id: string) => _args.onMarkLiveRead?.(id),
    markAllRead: () => _args.onMarkAllLiveRead?.(),
  }), [notifications, _args.onMarkLiveRead, _args.onMarkAllLiveRead])
}
