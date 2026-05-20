import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Paper,
  Avatar,
  TextField,
  Button,
} from '@mui/material'

const TEAM_MEMBERS = [
  'Dono / Editor',
  'Designer',
  'Gestor de Tráfego',
  'Atendimento',
  'Outro',
]

interface Props {
  open: boolean
  onSelect: (name: string) => void
}

export default function UserPicker({ open, onSelect }: Props) {
  const [customName, setCustomName] = useState('')

  function handleSelect(name: string) {
    onSelect(name)
  }

  function handleConfirmCustom() {
    const trimmed = customName.trim()
    if (trimmed) {
      onSelect(trimmed)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleConfirmCustom()
    }
  }

  return (
    <Dialog
      open={open}
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          background: 'rgba(12,12,12,0.98)',
          backdropFilter: 'blur(24px)',
          border: '1.5px solid #ff9039',
          borderRadius: 3,
          minWidth: { xs: '90vw', sm: 400 },
          boxShadow: '0 8px 48px rgba(255,144,57,0.18)',
        },
      }}
    >
      <DialogContent sx={{ p: { xs: 3, sm: 4 } }}>
        <Typography
          variant="h5"
          fontWeight={700}
          textAlign="center"
          mb={3}
          sx={{ color: '#fff', letterSpacing: '-0.5px' }}
        >
          👋 Quem está usando?
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
          {TEAM_MEMBERS.map((name) => (
            <Paper
              key={name}
              onClick={() => handleSelect(name)}
              elevation={0}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                px: 2,
                py: 1.5,
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,144,57,0.18)',
                borderRadius: 2,
                transition: 'all 0.18s ease',
                '&:hover': {
                  background: 'rgba(255,144,57,0.12)',
                  border: '1px solid rgba(255,144,57,0.55)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 16px rgba(255,144,57,0.14)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
              }}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: '#ff9039',
                  color: '#000',
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                {name[0].toUpperCase()}
              </Avatar>
              <Typography
                variant="body1"
                fontWeight={500}
                sx={{ color: '#fff' }}
              >
                {name}
              </Typography>
            </Paper>
          ))}
        </Box>

        <Box
          sx={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            pt: 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)', mb: 0.5 }}>
            Ou digite seu nome
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Seu nome..."
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 1.5,
                  '& fieldset': {
                    borderColor: 'rgba(255,144,57,0.25)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255,144,57,0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#ff9039',
                  },
                },
                '& input::placeholder': {
                  color: 'rgba(255,255,255,0.3)',
                  opacity: 1,
                },
              }}
            />
            <Button
              variant="contained"
              onClick={handleConfirmCustom}
              disabled={!customName.trim()}
              sx={{
                bgcolor: '#ff9039',
                color: '#000',
                fontWeight: 700,
                borderRadius: 1.5,
                px: 2.5,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                '&:hover': { bgcolor: '#ffaa60' },
                '&.Mui-disabled': {
                  bgcolor: 'rgba(255,144,57,0.2)',
                  color: 'rgba(255,255,255,0.2)',
                },
              }}
            >
              Confirmar
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  )
}
