import { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, ToggleButtonGroup, ToggleButton,
  Box, Typography,
} from '@mui/material'
import type { ContentItem, ContentType, ItemEditPatch } from '../types'

interface Props {
  open: boolean
  item: ContentItem | null
  onSave: (id: number, patch: ItemEditPatch) => void
  onClose: () => void
}

export default function EditItemDialog({ open, item, onSave, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ContentType>('Post')
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    if (item) {
      setTitle(item.n)
      setType(item.tp)
      setDateStr(item.dt.toISOString().slice(0, 10))
    }
  }, [item])

  const handleSave = () => {
    if (!item) return
    const patch: ItemEditPatch = {}
    if (title !== item.n) patch.n = title
    if (type !== item.tp) patch.tp = type
    const newDt = new Date(dateStr + 'T12:00:00')
    if (newDt.toISOString().slice(0, 10) !== item.dt.toISOString().slice(0, 10)) patch.dt = newDt
    onSave(item.i, patch)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(255,144,57,0.2)', borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="subtitle1" fontWeight={700}>Editar conteúdo</Typography>
        <Typography variant="caption" color="text.secondary">{item?.c}</Typography>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <TextField
          label="Título"
          size="small"
          fullWidth
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Tipo
          </Typography>
          <ToggleButtonGroup size="small" value={type} exclusive onChange={(_, v) => v && setType(v)} fullWidth>
            <ToggleButton value="Post" sx={{ fontSize: '0.75rem' }}>Post</ToggleButton>
            <ToggleButton value="Reel" sx={{ fontSize: '0.75rem' }}>Reel</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <TextField
          label="Data"
          type="date"
          size="small"
          fullWidth
          value={dateStr}
          onChange={e => setDateStr(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} size="small" color="inherit">Cancelar</Button>
        <Button onClick={handleSave} size="small" variant="contained" color="primary">Salvar</Button>
      </DialogActions>
    </Dialog>
  )
}
