import { DS } from '../theme'
import { useState } from 'react'
import {
  Dialog, DialogContent, Box, Typography, Paper, Avatar, TextField, Button,
} from '@mui/material'

const TEAM_MEMBERS = [
  { label: 'Sócio',               emoji: '👑' },
  { label: 'Head/editor de vídeo', emoji: '🎬' },
  { label: 'Gestor de tráfego',   emoji: '📈' },
  { label: 'Social media',        emoji: '📱' },
  { label: 'Design',              emoji: '🎨' },
  { label: 'Atendimento',         emoji: '💬' },
  { label: 'Outro',               emoji: '👤' },
]

interface Props {
  open: boolean
  onSelect: (name: string) => void
}

export default function UserPicker({ open, onSelect }: Props) {
  const [customName, setCustomName] = useState('')

  function handleConfirmCustom() {
    const trimmed = customName.trim()
    if (trimmed) onSelect(trimmed)
  }

  return (
    <Dialog
      open={open}
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          background: 'rgba(10,10,10,0.98)',
          backdropFilter: 'blur(24px)',
          border: `1.5px solid ${DS.accent}`,
          borderRadius: 3,
          minWidth: { xs: '90vw', sm: 420 },
          boxShadow: '0 8px 48px rgba(59,130,246,0.22)',
        },
      }}
    >
      <DialogContent sx={{ p: { xs: 3, sm: 4 } }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography sx={{ fontSize: '2rem', lineHeight: 1, mb: 1 }}>👋</Typography>
          <Typography variant="h5" fontWeight={800} sx={{ color: '#fff', letterSpacing: '-0.5px' }}>
            Quem está usando?
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(244,247,255,0.35)' }}>
            Selecione seu perfil para personalizar a experiência
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {TEAM_MEMBERS.map(({ label, emoji }) => (
            <Paper
              key={label}
              onClick={() => onSelect(label)}
              elevation={0}
              sx={{
                display: 'flex', alignItems: 'center', gap: 2,
                px: 2, py: 1.3, cursor: 'pointer',
                background: 'rgba(244,247,255,0.03)',
                border: '1px solid rgba(59,130,246,0.14)',
                borderRadius: 2,
                transition: 'all 0.15s ease',
                '&:hover': {
                  background: 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(59,130,246,0.5)',
                  transform: 'translateX(4px)',
                  boxShadow: '0 4px 20px rgba(59,130,246,0.12)',
                },
                '&:active': { transform: 'translateX(2px)' },
              }}
            >
              <Avatar sx={{ width: 38, height: 38, bgcolor: 'rgba(59,130,246,0.15)', fontSize: '1.1rem', border: '1px solid rgba(59,130,246,0.25)' }}>
                {emoji}
              </Avatar>
              <Typography variant="body1" fontWeight={600} sx={{ color: '#fff', flex: 1 }}>
                {label}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(244,247,255,0.2)' }}>→</Typography>
            </Paper>
          ))}
        </Box>

        <Box sx={{ borderTop: '1px solid rgba(244,247,255,0.07)', pt: 2.5, mt: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="body2" sx={{ color: 'rgba(244,247,255,0.4)' }}>
            Ou digite seu nome
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth size="small"
              placeholder="Seu nome..."
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirmCustom() }}
              autoComplete="off"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff', background: 'rgba(244,247,255,0.04)', borderRadius: 1.5,
                  '& fieldset': { borderColor: 'rgba(59,130,246,0.2)' },
                  '&:hover fieldset': { borderColor: 'rgba(59,130,246,0.45)' },
                  '&.Mui-focused fieldset': { borderColor: DS.accent },
                },
                '& input::placeholder': { color: 'rgba(244,247,255,0.25)', opacity: 1 },
              }}
            />
            <Button
              variant="contained"
              onClick={handleConfirmCustom}
              disabled={!customName.trim()}
              sx={{
                bgcolor: DS.accent, color: '#fff', fontWeight: 700, borderRadius: 1.5,
                px: 2.5, whiteSpace: 'nowrap', flexShrink: 0,
                '&:hover': { bgcolor: '#ffaa60' },
                '&.Mui-disabled': { bgcolor: 'rgba(59,130,246,0.2)', color: 'rgba(244,247,255,0.2)' },
              }}
            >
              Entrar
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  )
}
