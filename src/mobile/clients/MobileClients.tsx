import { Box, Typography, Button } from '@mui/material'
import type { ContentItem, ItemState, Client } from '../../types'

interface MobileClientsProps {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  clientColors: Record<string, string>
  now: Date
  onOpenProductions: (clientName: string) => void
}

export default function MobileClients({ allClients, onOpenProductions }: MobileClientsProps) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>Clientes</Typography>
      <Typography sx={{ mt: 1, color: 'rgba(244,247,255,0.72)' }}>Lista de clientes não disponível nesta compilação.</Typography>
      {allClients.slice(0, 3).map(client => (
        <Button key={client.name} fullWidth sx={{ mt: 1, justifyContent: 'flex-start' }} onClick={() => onOpenProductions(client.name)}>
          {client.name}
        </Button>
      ))}
    </Box>
  )
}
