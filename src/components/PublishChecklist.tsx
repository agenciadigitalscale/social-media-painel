import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, FormControlLabel, Checkbox, Typography, Box,
  Divider, Chip,
} from '@mui/material'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import type { ContentItem, ItemState } from '../types'

const CHECKLIST = [
  { id: 'drive',    label: 'Arquivo no Drive pronto',       hint: 'Vídeo ou imagem finalizado e no link correto' },
  { id: 'caption',  label: 'Legenda revisada',              hint: 'Texto, emojis e hashtags conferidos' },
  { id: 'client',   label: 'Aprovação do cliente confirmada', hint: 'Cliente viu e aprovou o conteúdo' },
  { id: 'posted',   label: 'Publicado nas redes sociais',   hint: 'Post ou Reel já está no ar na plataforma' },
]

interface Props {
  open: boolean
  item: ContentItem
  state: ItemState
  onConfirm: () => void
  onCancel: () => void
}

export default function PublishChecklist({ open, item, state, onConfirm, onCancel }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const allChecked = CHECKLIST.every(c => checked[c.id])

  const toggle = (id: string) =>
    setChecked(prev => ({ ...prev, [id]: !prev[id] }))

  const handleConfirm = () => {
    setChecked({})
    onConfirm()
  }

  const handleCancel = () => {
    setChecked({})
    onCancel()
  }

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          border: '1px solid rgba(49,209,124,0.2)',
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RocketLaunchIcon sx={{ color: 'success.main', fontSize: 20 }} />
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2 }}>
              Checklist de publicação
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {item.c} · {item.n} · {item.tp}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <Divider sx={{ opacity: 0.1 }} />

      <DialogContent sx={{ pt: 1.5, pb: 1 }}>
        {/* Link preview */}
        {state.link && (
          <Chip
            label={`🔗 Drive vinculado`}
            size="small"
            color="success"
            variant="outlined"
            sx={{ mb: 1.5, fontSize: '0.65rem' }}
          />
        )}
        {!state.link && (
          <Chip
            label="⚠️ Nenhum link adicionado"
            size="small"
            color="warning"
            variant="outlined"
            sx={{ mb: 1.5, fontSize: '0.65rem' }}
          />
        )}

        {/* Checklist */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {CHECKLIST.map(c => (
            <Box
              key={c.id}
              onClick={() => toggle(c.id)}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                p: 1,
                borderRadius: 2,
                cursor: 'pointer',
                bgcolor: checked[c.id] ? 'rgba(49,209,124,0.08)' : 'rgba(255,255,255,0.02)',
                border: '1px solid',
                borderColor: checked[c.id] ? 'rgba(49,209,124,0.3)' : 'rgba(255,255,255,0.05)',
                transition: 'all 0.15s',
                userSelect: 'none',
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!checked[c.id]}
                    onChange={() => toggle(c.id)}
                    size="small"
                    color="success"
                    sx={{ p: 0.3 }}
                    onClick={e => e.stopPropagation()}
                  />
                }
                label={
                  <Box>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{
                        fontSize: '0.78rem',
                        textDecoration: checked[c.id] ? 'line-through' : 'none',
                        color: checked[c.id] ? 'text.disabled' : 'text.primary',
                      }}
                    >
                      {c.label}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.62rem' }}>
                      {c.hint}
                    </Typography>
                  </Box>
                }
                sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
              />
            </Box>
          ))}
        </Box>

        {allChecked && (
          <Box
            sx={{
              mt: 1.5,
              p: 1,
              borderRadius: 2,
              bgcolor: 'rgba(49,209,124,0.1)',
              border: '1px solid rgba(49,209,124,0.3)',
              textAlign: 'center',
            }}
          >
            <Typography variant="caption" color="success.main" fontWeight={700}>
              ✅ Tudo pronto para marcar como publicado!
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button variant="outlined" color="inherit" onClick={handleCancel} sx={{ flex: 1, color: 'text.secondary', borderColor: 'rgba(255,255,255,0.1)' }}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="success"
          disabled={!allChecked}
          onClick={handleConfirm}
          startIcon={<RocketLaunchIcon />}
          sx={{ flex: 1, fontWeight: 700 }}
        >
          Publicar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
