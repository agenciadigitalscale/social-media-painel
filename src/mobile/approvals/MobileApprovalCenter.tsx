import { Box, Typography } from '@mui/material'
import type { ContentItem, ItemState } from '../../types'

import type { Status } from '../../types'

interface MobileApprovalCenterProps {
  initialItemId?: number | null
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
  clientColors: Record<string, string>
  onStatusChange: (id: number, status: Status) => void
  onSendToClient: (itemId: number, clientName: string) => void | Promise<void>
  onBulkSendToClient?: (clientName: string, itemIds: number[]) => void | Promise<void>
  onReviewNotify?: (itemId: number, clientName: string, reservedTab?: Window | null) => Promise<boolean>
  onRemindClient?: (itemId: number, clientName: string) => void
  onAppendHistory?: (id: number, action: string) => void
  onOpenCard?: (item: ContentItem) => void
}

export default function MobileApprovalCenter(props: MobileApprovalCenterProps) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>Centro de aprovação móvel</Typography>
      <Typography sx={{ fontSize: '0.75rem', color: 'rgba(244,247,255,0.68)', mt: 1 }}>
        Este é um stub de UI temporário para aprovação de cards em mobile.
      </Typography>
    </Box>
  )
}
