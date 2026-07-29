import { useEffect, useRef, useState } from 'react'
import {
  Box, Typography, Dialog, DialogContent, DialogActions, Button, TextField, Chip, IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ReplayIcon from '@mui/icons-material/Replay'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { BRAND, DS } from '../theme'
import { streamUrlFor } from '../lib/videoMatch'

interface Props {
  open: boolean
  clientName: string
  title: string
  fileId: string
  filename?: string
  onApprove: (notes: string) => void
  onRequestFix: (notes: string) => void
  onOpenWhatsApp?: () => void
  onClose: () => void
}

/**
 * Revisão interna dentro do próprio DS HUB — abre logo depois da esteira mover o
 * card. O WhatsApp continua existindo para quem revisa pelo celular, mas quem já
 * está no painel não precisa sair dele para aprovar.
 *
 * O player usa a URL de streaming do projeto (`/api/stream`, que responde a
 * Range) — nada de caminho local nem object URL, então não há o que revogar; o
 * `<video>` é descarregado ao fechar.
 */
export default function ReviewModal({
  open, clientName, title, fileId, filename, onApprove, onRequestFix, onOpenWhatsApp, onClose,
}: Props) {
  const [notes, setNotes] = useState('')
  const [fixMode, setFixMode] = useState(false)
  const [playError, setPlayError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (open) { setNotes(''); setFixMode(false); setPlayError(false) }
  }, [open, fileId])

  // Descarrega o vídeo ao sair: sem isso o buffer continua baixando em segundo
  // plano. Fica no desmonte porque o modal é renderizado condicionalmente — o
  // efeito com `open === false` nunca chegaria a rodar.
  useEffect(() => () => {
    const v = videoRef.current
    if (!v) return
    try { v.pause(); v.removeAttribute('src'); v.load() } catch { /* já descartado */ }
  }, [])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: 'rgba(10,17,32,0.99)', backdropFilter: 'blur(40px)', border: '1px solid rgba(148,163,184,0.14)', borderRadius: '18px' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, px: 2.2, pt: 1.8, pb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.56rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: DS.cyan }}>
            Revisão interna
          </Typography>
          <Typography sx={{ fontSize: '0.92rem', fontWeight: 800, color: DS.t1, lineHeight: 1.25 }} noWrap>
            {title}
          </Typography>
          <Typography sx={{ fontSize: '0.62rem', color: DS.t2 }} noWrap>{clientName}</Typography>
        </Box>
        {filename && <Chip label={filename} size="small" sx={{ maxWidth: 220, height: 20, fontSize: '0.55rem', bgcolor: 'rgba(59,130,246,0.12)', color: DS.accent, border: '1px solid rgba(59,130,246,0.3)' }} />}
        <IconButton size="small" onClick={onClose}><CloseIcon sx={{ fontSize: 17, color: DS.t2 }} /></IconButton>
      </Box>

      <DialogContent sx={{ pt: 0.5 }}>
        <Box sx={{
          position: 'relative', width: '100%',
          aspectRatio: '16 / 9', maxHeight: { xs: '46dvh', md: '58dvh' },
          borderRadius: '14px', overflow: 'hidden', bgcolor: '#000',
          border: `1px solid ${DS.border}`,
        }}>
          {!playError ? (
            <Box
              component="video"
              ref={videoRef}
              src={streamUrlFor(fileId)}
              poster={`https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`}
              controls
              playsInline
              preload="metadata"
              onError={() => setPlayError(true)}
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', bgcolor: '#000', border: 0 }}
            />
          ) : (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, px: 3, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.75rem', color: DS.t2 }}>
                Não foi possível reproduzir aqui.
              </Typography>
              <Button size="small" component="a" href={`https://drive.google.com/file/d/${fileId}/view`} target="_blank" rel="noopener"
                sx={{ fontSize: '0.65rem', color: DS.accent }}>
                Abrir no Drive
              </Button>
            </Box>
          )}
        </Box>

        <TextField
          fullWidth size="small" multiline minRows={2}
          placeholder={fixMode ? 'O que precisa ser ajustado?' : 'Observações (opcional)'}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          sx={{ mt: 1.6 }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 2.2, pb: 2, gap: 0.8, flexWrap: 'wrap' }}>
        {onOpenWhatsApp && (
          <Button size="small" startIcon={<WhatsAppIcon sx={{ fontSize: 14 }} />} onClick={onOpenWhatsApp}
            sx={{ fontSize: '0.65rem', fontWeight: 700, color: BRAND.whatsapp }}>
            Abrir WhatsApp
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={<ReplayIcon sx={{ fontSize: 14 }} />}
          onClick={() => { if (!fixMode) { setFixMode(true); return } onRequestFix(notes.trim()) }}
          sx={{
            fontSize: '0.66rem', fontWeight: 800, color: DS.red,
            bgcolor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '9px',
            '&:hover': { bgcolor: 'rgba(239,68,68,0.22)' },
          }}>
          {fixMode ? 'Confirmar ajuste' : 'Solicitar ajuste'}
        </Button>
        <Button size="small" variant="contained" color="primary" startIcon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
          onClick={() => onApprove(notes.trim())}
          sx={{ fontSize: '0.66rem', fontWeight: 800 }}>
          Aprovar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
