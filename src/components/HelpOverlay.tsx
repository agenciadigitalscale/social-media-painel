import { useEffect } from 'react'
import {
  Box, Typography, Dialog, DialogContent, IconButton, Chip, Divider,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import { DS } from '../theme'

interface Props {
  open: boolean
  onClose: () => void
}

const SHORTCUTS = [
  {
    group: 'Navegação',
    items: [
      { keys: ['1', '2', '3', '4', '5'], desc: 'Ir para aba Hoje / Agenda / Kanban / Calendário / Clientes' },
      { keys: ['6', '7', '8', '9'], desc: 'Ir para Dashboard / Timeline / Gravações / Editor' },
    ],
  },
  {
    group: 'Busca',
    items: [
      { keys: ['S'], desc: 'Abrir / fechar busca global' },
      { keys: ['Ctrl', 'K'], desc: 'Abrir busca global' },
      { keys: ['Esc'], desc: 'Fechar busca ou este overlay' },
    ],
  },
  {
    group: 'Modais',
    items: [
      { keys: ['P'], desc: 'Modo apresentação (fullscreen)' },
      { keys: ['R'], desc: 'Relatório mensal' },
      { keys: ['A'], desc: 'Scale AI — chat de inteligência artificial' },
      { keys: ['?'], desc: 'Este overlay de atalhos' },
    ],
  },
  {
    group: 'Dicas',
    items: [
      { keys: ['Click'], desc: 'Expandir card para ver link, legenda e notas' },
      { keys: ['Drag'], desc: 'Arrastar card no Kanban ou Calendário para mover' },
      { keys: ['Long press'], desc: 'Arrastar no mobile (Kanban/Calendário)' },
    ],
  },
]

function KeyBadge({ label }: { label: string }) {
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: label.length > 3 ? 'auto' : 28, height: 22,
      px: label.length > 3 ? 1 : 0,
      borderRadius: 1,
      border: '1px solid rgba(244,247,255,0.18)',
      bgcolor: 'rgba(244,247,255,0.08)',
      boxShadow: '0 2px 0 rgba(0,0,0,0.4)',
      fontFamily: 'monospace',
      fontSize: '0.65rem',
      fontWeight: 700,
      color: 'rgba(244,247,255,0.8)',
      letterSpacing: 0,
      flexShrink: 0,
    }}>
      {label}
    </Box>
  )
}

export default function HelpOverlay({ open, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <Dialog
      open={open} onClose={onClose}
      maxWidth="sm" fullWidth
      slotProps={{ paper: { sx: { bgcolor: DS.surface, border: '1px solid rgba(244,247,255,0.08)', borderRadius: 3 } } }}
    >
      <DialogContent sx={{ p: { xs: 2, md: 3 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 2,
            bgcolor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <KeyboardIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          </Box>
          <Box>
            <Typography fontWeight={800} fontSize="1rem">Atalhos de teclado</Typography>
            <Typography fontSize="0.68rem" color="text.secondary">ScaleOS · Digital Scale</Typography>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ ml: 'auto', p: 0.5 }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SHORTCUTS.map((section, si) => (
            <Box key={si}>
              <Typography variant="overline" color="primary.main" fontWeight={700}
                sx={{ fontSize: '0.58rem', letterSpacing: 1 }}>
                {section.group}
              </Typography>
              <Divider sx={{ borderColor: 'rgba(244,247,255,0.04)', mb: 1 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7 }}>
                {section.items.map((item, ii) => (
                  <Box key={ii} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* Keys */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, minWidth: 90, flexShrink: 0 }}>
                      {item.keys.map((k, ki) => (
                        <Box key={ki} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                          {ki > 0 && <Typography sx={{ fontSize: '0.55rem', color: 'rgba(244,247,255,0.3)' }}>+</Typography>}
                          <KeyBadge label={k} />
                        </Box>
                      ))}
                    </Box>
                    {/* Desc */}
                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.6)', lineHeight: 1.4 }}>
                      {item.desc}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        {/* Footer tip */}
        <Box sx={{ mt: 2.5, p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label="?" size="small" sx={{ fontFamily: 'monospace', fontSize: '0.65rem', bgcolor: 'rgba(59,130,246,0.15)', color: 'primary.main', border: '1px solid rgba(59,130,246,0.3)', height: 20 }} />
          <Typography sx={{ fontSize: '0.68rem', color: 'rgba(244,247,255,0.45)' }}>
            Pressione <strong style={{ color: 'rgba(59,130,246,0.9)' }}>?</strong> em qualquer lugar para abrir este overlay
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  )
}
