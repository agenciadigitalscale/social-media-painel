import { Box, Typography, Button } from '@mui/material'
import type { ContentItem, ItemState, Client } from '../../types'
import type { QuickKey } from '../kanban/filters'

interface MobileTodayProps {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  clientColors: Record<string, string>
  now: Date
  currentUser: string
  userInfo?: { name: string; role: string; emoji: string; color: string }
  onOpenProductions: (filter?: QuickKey, client?: string) => void
  onOpenClients: () => void
  onNavigateTab: (tab: number) => void
}

export default function MobileToday({ onOpenClients, onNavigateTab }: MobileTodayProps) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>Hoje</Typography>
      <Typography sx={{ mt: 1, color: 'rgba(244,247,255,0.7)' }}>
        Interface móvel de hoje não está disponível nesta compilação.
      </Typography>
      <Button sx={{ mt: 2 }} variant="contained" onClick={() => onOpenClients()}>Clientes</Button>
      <Button sx={{ mt: 1 }} variant="outlined" onClick={() => onNavigateTab(1)}>Abrir aba</Button>
    </Box>
  )
}
