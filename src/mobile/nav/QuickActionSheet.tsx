import { Box, Typography, Button } from '@mui/material'
import type { Client, ContentType, Status } from '../../types'

interface QuickActionSheetProps {
  open: boolean
  onClose: () => void
  clients: Client[]
  now: Date
  onAddItem?: (clientName: string, title: string, type: ContentType, date: Date, status: Status) => void
  onRecording: () => void
  onApprovals: () => void
  onCalendar: () => void
}

export default function QuickActionSheet({ open, onClose, onRecording, onApprovals, onCalendar }: QuickActionSheetProps) {
  if (!open) return null

  return (
    <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, bgcolor: '#070b16', p: 2, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
      <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', mb: 1 }}>Ações rápidas</Typography>
      <Button fullWidth sx={{ mb: 1 }} variant="contained" onClick={onRecording}>Gravação</Button>
      <Button fullWidth sx={{ mb: 1 }} variant="contained" onClick={onApprovals}>Aprovações</Button>
      <Button fullWidth sx={{ mb: 1 }} variant="contained" onClick={onCalendar}>Calendário</Button>
      <Button fullWidth sx={{ mt: 1 }} variant="text" onClick={onClose}>Fechar</Button>
    </Box>
  )
}
