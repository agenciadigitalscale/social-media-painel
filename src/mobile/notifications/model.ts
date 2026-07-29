export interface SmartNotification {
  id: string
  title: string
  body: string
  read?: boolean
  source?: string
  sourceId?: string
  itemId?: number
  clientName?: string
  destination?: 'approval' | 'card' | 'overdue'
}
