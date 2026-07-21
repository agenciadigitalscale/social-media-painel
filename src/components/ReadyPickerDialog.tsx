import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, CircularProgress,
} from '@mui/material'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { DS } from '../theme'
import type { DriveFile } from '../lib/videoMatch'

interface Props {
  open: boolean
  loading?: boolean
  error?: string
  files: DriveFile[]
  cardTitle: string
  clientName: string
  folderUrl?: string
  onPick: (file: DriveFile) => void
  onClose: () => void
}

function formatBytes(b?: number | null): string {
  if (!b) return ''
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/**
 * Seleção manual do arquivo na pasta Publicar — usada quando a correspondência
 * automática achou mais de um candidato ou nenhum. Só lista arquivos da pasta
 * daquele cliente; não existe caminho para escolher arquivo de outro.
 */
export default function ReadyPickerDialog({
  open, loading, error, files, cardTitle, clientName, folderUrl, onPick, onClose,
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: 'rgba(10,17,32,0.99)', backdropFilter: 'blur(40px)', border: '1px solid rgba(148,163,184,0.14)', borderRadius: '18px' } }}>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>🎬 Selecionar o vídeo na pasta Publicar</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem' }}>
          {cardTitle} · {clientName}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress size={24} sx={{ color: DS.accent }} />
          </Box>
        )}

        {!loading && error && (
          <Box sx={{ px: 1.4, py: 1.2, borderRadius: '10px', bgcolor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)' }}>
            <Typography sx={{ fontSize: '0.7rem', color: DS.red, fontWeight: 700 }}>{error}</Typography>
          </Box>
        )}

        {!loading && !error && files.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography sx={{ fontSize: '1.6rem', mb: 1 }}>📂</Typography>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: DS.t2 }}>
              Nenhum vídeo na pasta Publicar de {clientName}
            </Typography>
            <Typography sx={{ fontSize: '0.62rem', color: DS.t3, mt: 0.5 }}>
              Exporte o arquivo com o nome sugerido no card e verifique de novo.
            </Typography>
          </Box>
        )}

        {!loading && files.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: { xs: 300, sm: 360 }, overflowY: 'auto' }}>
            {files.map(file => (
              <Box key={file.id} onClick={() => onPick(file)}
                sx={{
                  px: 1.4, py: 1, borderRadius: '10px', cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.07)', bgcolor: 'rgba(255,255,255,0.03)',
                  display: 'flex', alignItems: 'center', gap: 1, transition: 'all 0.15s',
                  '&:hover': { bgcolor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.4)' },
                }}>
                <VideoLibraryIcon sx={{ fontSize: 15, color: DS.accent, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }} noWrap>
                    {file.name}
                  </Typography>
                  <Typography sx={{ fontSize: '0.56rem', color: DS.t3 }}>
                    {file.mimeType}{file.size ? ` · ${formatBytes(file.size)}` : ''}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 1.5, gap: 0.5 }}>
        {folderUrl && (
          <Button size="small" component="a" href={folderUrl} target="_blank" rel="noopener"
            startIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
            sx={{ fontSize: '0.62rem', color: DS.t2 }}>
            Abrir pasta Publicar
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  )
}
