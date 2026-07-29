import { Box, Typography, TextField, List, ListItemButton, ListItemText } from '@mui/material'
import type { ContentItem, ItemState, Client } from '../../types'

interface MobileGlobalSearchProps {
  items: ContentItem[]
  states: Record<number, ItemState>
  clients: Client[]
  now: Date
  onOpenContent: (itemId: number, clientName: string) => void
  onOpenClient: (clientName: string) => void
  onOpenPerson: (personKey: string) => void
}

export default function MobileGlobalSearch({ items, onOpenContent }: MobileGlobalSearchProps) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Buscar</Typography>
      <TextField fullWidth placeholder="Buscar conteúdo, cliente ou pessoa" sx={{ mt: 1, input: { color: '#fff' } }} />
      <Typography sx={{ mt: 2, color: 'rgba(244,247,255,0.7)' }}>Resultados de busca não estão disponíveis nesta compilação.</Typography>
      <List>
        <ListItemButton onClick={() => onOpenContent(items[0]?.i ?? 0, items[0]?.c ?? '')}>
          <ListItemText primary="Navegar para o primeiro item" secondary="Exemplo de ação" />
        </ListItemButton>
      </List>
    </Box>
  )
}
