import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, ToggleButtonGroup, ToggleButton,
  Box, Typography, List, ListItem, ListItemText, IconButton,
  Chip, Divider, Alert, Tooltip,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import LinkIcon from '@mui/icons-material/Link'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import type { ContentType, Roteiro } from '../types'

interface Props {
  open: boolean
  clientName: string
  roteiros: Roteiro[]
  distributedCount: number  // custom items already distributed this month
  onAdd: (r: Omit<Roteiro, 'id' | 'clientName' | 'distributed'>) => void
  onRemove: (id: string) => void
  onDistribute: () => void
  onClearDistribution: () => void
  onClose: () => void
}

export default function RoteirosModal({
  open, clientName, roteiros, distributedCount,
  onAdd, onRemove, onDistribute, onClearDistribution, onClose,
}: Props) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ContentType>('Post')
  const [driveLink, setDriveLink] = useState('')
  const [notes, setNotes] = useState('')

  const hasDistributed = roteiros.some(r => r.distributed)

  const handleAdd = () => {
    if (!title.trim()) return
    onAdd({ title: title.trim(), type, driveLink: driveLink.trim() || undefined, notes: notes.trim() || undefined })
    setTitle('')
    setDriveLink('')
    setNotes('')
  }

  const handleDistribute = () => {
    if (hasDistributed) {
      onClearDistribution()
      setTimeout(onDistribute, 50)
    } else {
      onDistribute()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(255,144,57,0.2)', borderRadius: 3, maxHeight: '90vh' } }}
    >
      <DialogTitle sx={{ pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Roteiros</Typography>
            <Typography variant="caption" color="primary.main" fontWeight={600}>{clientName}</Typography>
          </Box>
          <Chip
            label={`${roteiros.length} roteiro${roteiros.length !== 1 ? 's' : ''}`}
            size="small"
            color={roteiros.length > 0 ? 'primary' : 'default'}
            variant="outlined"
            sx={{ fontSize: '0.62rem' }}
          />
        </Box>
      </DialogTitle>

      <Divider sx={{ opacity: 0.1 }} />

      <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

        {/* ── Adicionar roteiro ── */}
        <Box sx={{ p: 1.5, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)' }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Adicionar roteiro
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField
              size="small"
              placeholder="Título do roteiro / vídeo"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              sx={{ flex: 1 }}
            />
            <ToggleButtonGroup size="small" value={type} exclusive onChange={(_, v) => v && setType(v)}>
              <ToggleButton value="Post" sx={{ fontSize: '0.65rem', px: 1.2 }}>Post</ToggleButton>
              <ToggleButton value="Reel" sx={{ fontSize: '0.65rem', px: 1.2 }}>Reel</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Link do Drive (pasta com material)"
              value={driveLink}
              onChange={e => setDriveLink(e.target.value)}
              slotProps={{ input: { startAdornment: <LinkIcon sx={{ mr: 0.5, fontSize: 14, color: 'text.disabled' }} /> } }}
            />
            {driveLink && (
              <Tooltip title="Abrir no Drive">
                <IconButton size="small" component="a" href={driveLink} target="_blank" rel="noopener" sx={{ bgcolor: 'rgba(0,196,122,0.1)', flexShrink: 0 }}>
                  <OpenInNewIcon sx={{ fontSize: 13, color: 'success.main' }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          <TextField
            size="small"
            fullWidth
            placeholder="Observações (opcional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            sx={{ mb: 1 }}
          />

          <Button
            fullWidth
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAdd}
            disabled={!title.trim()}
          >
            Adicionar roteiro
          </Button>
        </Box>

        {/* ── Lista de roteiros ── */}
        {roteiros.length === 0 ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
              Nenhum roteiro adicionado ainda
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Adicione os roteiros acima e depois distribua no calendário
            </Typography>
          </Box>
        ) : (
          <List disablePadding dense>
            {roteiros.map((r, idx) => (
              <ListItem
                key={r.id}
                disablePadding
                sx={{
                  mb: 0.5,
                  px: 1.2, py: 0.8,
                  border: '1px solid',
                  borderColor: r.distributed ? 'rgba(0,196,122,0.2)' : 'rgba(255,255,255,0.06)',
                  borderRadius: 2,
                  bgcolor: r.distributed ? 'rgba(0,196,122,0.04)' : 'transparent',
                }}
                secondaryAction={
                  <IconButton size="small" edge="end" onClick={() => onRemove(r.id)} sx={{ color: 'error.main', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                    <DeleteIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', minWidth: 16 }}>{idx + 1}.</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.78rem' }} noWrap>{r.title}</Typography>
                      <Chip
                        label={r.type}
                        size="small"
                        sx={{ height: 14, fontSize: '0.5rem', flexShrink: 0, bgcolor: r.type === 'Reel' ? 'rgba(59,142,255,0.15)' : 'rgba(255,144,57,0.15)', color: r.type === 'Reel' ? 'info.main' : 'primary.main' }}
                      />
                      {r.distributed && <CheckCircleIcon sx={{ fontSize: 12, color: 'success.main', flexShrink: 0 }} />}
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                      {r.driveLink && (
                        <Box component="a" href={r.driveLink} target="_blank" rel="noopener" sx={{ display: 'flex', alignItems: 'center', gap: 0.3, color: 'success.main', textDecoration: 'none', fontSize: '0.6rem' }}>
                          <LinkIcon sx={{ fontSize: 10 }} /> Drive
                        </Box>
                      )}
                      {r.notes && <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>· {r.notes}</Typography>}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}

        {/* ── Aviso distribuição ── */}
        {roteiros.length > 0 && distributedCount > 0 && (
          <Alert severity="info" sx={{ fontSize: '0.7rem', py: 0.5 }}>
            {distributedCount} conteúdo{distributedCount > 1 ? 's' : ''} já distribuído{distributedCount > 1 ? 's' : ''} este mês. Redistribuir vai limpar e recriar.
          </Alert>
        )}
      </DialogContent>

      <Divider sx={{ opacity: 0.1 }} />

      <DialogActions sx={{ px: 2, py: 1.5, gap: 1, flexWrap: 'wrap' }}>
        {distributedCount > 0 && (
          <Button
            size="small"
            color="error"
            startIcon={<ClearAllIcon />}
            onClick={onClearDistribution}
            sx={{ fontSize: '0.65rem' }}
          >
            Limpar distribuição
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} size="small" color="inherit">Fechar</Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<AutoFixHighIcon />}
          onClick={handleDistribute}
          disabled={roteiros.length === 0}
          sx={{ fontSize: '0.75rem' }}
        >
          {hasDistributed ? 'Redistribuir no calendário' : 'Distribuir no calendário'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
