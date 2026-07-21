import { useState } from 'react'
import { Box, Drawer, Typography, IconButton, Button, Tooltip, CircularProgress } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import LinkIcon from '@mui/icons-material/Link'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import ScheduleIcon from '@mui/icons-material/Schedule'
import UndoIcon from '@mui/icons-material/Undo'
import { DS } from '../theme'
import type { DriveVideo } from '../lib/useDriveInbox'

interface Props {
  open: boolean
  loading?: boolean
  pending: DriveVideo[]
  ignored: DriveVideo[]
  onClose: () => void
  onRefresh: () => void
  onLink: (video: DriveVideo) => void
  onRemindLater: (video: DriveVideo) => void
  onIgnore: (video: DriveVideo) => void
  onRestore: (video: DriveVideo) => void
}

function timeAgo(unix: number): string {
  const diff = Math.floor(Date.now() / 1000) - unix
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

function formatBytes(b: number | null): string {
  if (!b) return ''
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function FileRow({ video, children }: { video: DriveVideo; children: React.ReactNode }) {
  return (
    <Box sx={{
      px: 1.2, py: 1, borderRadius: '12px',
      bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      transition: 'all 0.18s',
      '&:hover': { borderColor: 'rgba(59,130,246,0.25)', bgcolor: 'rgba(255,255,255,0.05)' },
    }}>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }} noWrap title={video.filename}>
        {video.filename}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.2, mb: 0.9 }}>
        <Typography sx={{ fontSize: '0.58rem', color: DS.accent, fontWeight: 600 }}>{video.client_name}</Typography>
        {video.file_size_bytes ? (
          <>
            <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)' }}>·</Typography>
            <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)' }}>{formatBytes(video.file_size_bytes)}</Typography>
          </>
        ) : null}
        <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', ml: 'auto' }}>{timeAgo(video.detected_at)}</Typography>
      </Box>
      {children}
    </Box>
  )
}

/**
 * Inbox como painel lateral. Substitui o dialog que abria sozinho: aqui a lista
 * fica parada esperando o usuário, e cada arquivo só vira seleção de conteúdo
 * quando ele clica em "Vincular".
 */
export default function DriveInboxDrawer({
  open, loading, pending, ignored, onClose, onRefresh, onLink, onRemindLater, onIgnore, onRestore,
}: Props) {
  const [showIgnored, setShowIgnored] = useState(false)

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 380, xl: 440 }, bgcolor: 'rgba(6,10,19,0.99)', borderLeft: `1px solid ${DS.border}`, backgroundImage: 'none' } }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        <Box sx={{ px: 2, py: 1.4, borderBottom: `1px solid ${DS.border}`, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '0.9rem' }}>📥</Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: DS.t1 }}>Inbox do Drive</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: DS.t2 }}>
              {pending.length === 0 ? 'Nenhum arquivo pendente' : `${pending.length} arquivo${pending.length > 1 ? 's' : ''} aguardando vínculo`}
            </Typography>
          </Box>
          <Tooltip title="Atualizar">
            <span>
              <IconButton size="small" onClick={onRefresh} disabled={loading}>
                <RefreshIcon sx={{ fontSize: 16, color: DS.t2 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Fechar">
            <IconButton size="small" onClick={onClose}>
              <CloseIcon sx={{ fontSize: 16, color: DS.t2 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {loading && pending.length === 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 5 }}>
              <CircularProgress size={22} sx={{ color: DS.accent }} />
            </Box>
          )}

          {!loading && pending.length === 0 && (
            <Box sx={{ textAlign: 'center', pt: 6 }}>
              <Typography sx={{ fontSize: '1.8rem', mb: 1 }}>📥</Typography>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: DS.t2 }}>Inbox em dia</Typography>
              <Typography sx={{ fontSize: '0.62rem', color: DS.t3, mt: 0.4 }}>
                Arquivos novos aparecem aqui quando chegarem na pasta Publicar
              </Typography>
            </Box>
          )}

          {pending.map(v => (
            <FileRow key={v.drive_file_id} video={v}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Button size="small" startIcon={<LinkIcon sx={{ fontSize: 12 }} />} onClick={() => onLink(v)}
                  sx={{
                    flex: 1, height: 26, fontSize: '0.6rem', fontWeight: 800, minWidth: 0,
                    background: 'linear-gradient(90deg, #3B82F6 0%, #06B6D4 100%)', color: '#FFFFFF',
                    borderRadius: '7px',
                    '&:hover': { filter: 'brightness(1.06)' },
                  }}>
                  Vincular
                </Button>
                <Tooltip title="Lembrar depois">
                  <IconButton size="small" onClick={() => onRemindLater(v)}
                    sx={{ width: 26, height: 26, borderRadius: '7px', bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
                    <ScheduleIcon sx={{ fontSize: 12, color: DS.t2 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Ignorar arquivo">
                  <IconButton size="small" onClick={() => onIgnore(v)}
                    sx={{ width: 26, height: 26, borderRadius: '7px', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <VisibilityOffIcon sx={{ fontSize: 12, color: DS.t3 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Abrir no Drive">
                  <IconButton size="small" component="a" href={`https://drive.google.com/file/d/${v.drive_file_id}/view`} target="_blank" rel="noopener"
                    sx={{ width: 26, height: 26, borderRadius: '7px', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <OpenInNewIcon sx={{ fontSize: 12, color: DS.t3 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </FileRow>
          ))}

          {ignored.length > 0 && (
            <>
              <Button size="small" onClick={() => setShowIgnored(s => !s)}
                sx={{ mt: 1, alignSelf: 'flex-start', fontSize: '0.6rem', fontWeight: 700, color: DS.t3, textTransform: 'none' }}>
                {showIgnored ? '▾' : '▸'} Ignorados ({ignored.length})
              </Button>
              {showIgnored && ignored.map(v => (
                <FileRow key={v.drive_file_id} video={v}>
                  <Button size="small" startIcon={<UndoIcon sx={{ fontSize: 12 }} />} onClick={() => onRestore(v)}
                    sx={{
                      height: 24, fontSize: '0.58rem', fontWeight: 700,
                      bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                      color: DS.t2, borderRadius: '7px',
                    }}>
                    Voltar para pendentes
                  </Button>
                </FileRow>
              ))}
            </>
          )}
        </Box>

        <Box sx={{ px: 2, py: 1.2, borderTop: `1px solid ${DS.border}` }}>
          <Button fullWidth size="small" onClick={onClose}
            sx={{ fontSize: '0.66rem', fontWeight: 700, color: DS.t2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px' }}>
            Fechar
          </Button>
        </Box>
      </Box>
    </Drawer>
  )
}
