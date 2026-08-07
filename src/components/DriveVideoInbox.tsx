import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Box, Typography, CircularProgress, Chip, IconButton, Tooltip, Button, TextField,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import LinkIcon from '@mui/icons-material/Link'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import ScheduleIcon from '@mui/icons-material/Schedule'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import RadarIcon from '@mui/icons-material/Radar'
import type { ContentItem, ItemState } from '../types'
import ExportWeightChip from '../shared/ui/ExportWeightChip'
import type { DriveVideo } from '../lib/useDriveInbox'
import { isImageFile, type InboxStateMap } from '../lib/driveInbox'
import Skeleton from '../shared/ui/Skeleton'
import { DS } from '../theme'

export { parseLeadingItemId } from '../lib/mediaLinks'

interface Props {
  videos: DriveVideo[]
  loading: boolean
  inboxState: InboxStateMap
  items: ContentItem[]
  states: Record<number, ItemState>
  onUpdateState: (id: number, updates: Partial<ItemState>) => void
  onRefresh: () => void
  onRequestLink: (video: DriveVideo) => void
  onIgnore: (video: DriveVideo) => void
  onIgnoreAll: (videos: DriveVideo[]) => void
  onRemindLater: (video: DriveVideo) => void
  onSendToClient?: (itemId: number, clientName: string) => void
}

function timeAgo(unix: number): string {
  const diff = Math.floor(Date.now() / 1000) - unix
  if (diff < 60)    return 'agora'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

const STATUS_FILTER_LABELS = [
  { value: 'inbox',  label: '📥 Inbox',    color: DS.accent },
  { value: 'linked', label: '🔗 Vinculado', color: DS.green },
  { value: 'all',    label: 'Todos',        color: DS.neutral },
]

function isToday(unix: number): boolean {
  const d = new Date(unix * 1000), now = new Date()
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

function isThisWeek(unix: number): boolean {
  return Date.now() / 1000 - unix < 7 * 24 * 60 * 60
}

/**
 * Board Inbox. Só mostra o que chegou — a vinculação sempre parte de um clique
 * do usuário em "Vincular" (ver `onRequestLink`). O auto-link por palpite ("é o
 * único Reel pendente do cliente") saiu daqui: era ele que carimbava vídeo de um
 * conteúdo em card de outro, inclusive em "A fazer".
 */
export default function DriveVideoInbox({
  videos, loading, inboxState, items, states, onUpdateState, onRefresh,
  onRequestLink, onIgnore, onIgnoreAll, onRemindLater, onSendToClient,
}: Props) {
  const [scanning, setScanning]         = useState(false)
  const [scanMsg, setScanMsg]           = useState<string | null>(null)
  const [scanCooldown, setScanCooldown] = useState(0)   // segundos restantes
  const [statusFilter, setStatusFilter] = useState<'inbox' | 'linked' | 'all'>('inbox')
  const [clientFilter, setClientFilter] = useState('all')
  const [dateFilter, setDateFilter]     = useState<'today' | 'week' | 'all'>('today')

  const [thumbErrors, setThumbErrors]   = useState<Record<string, boolean>>({})
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)
  const [editLinkId, setEditLinkId]     = useState<string | null>(null)
  const [editLinkVal, setEditLinkVal]   = useState('')

  // Cooldown counter
  useEffect(() => {
    if (scanCooldown <= 0) return
    const id = setInterval(() => setScanCooldown(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [scanCooldown])

  const handleScanNow = useCallback(async () => {
    if (scanning || scanCooldown > 0) return
    setScanning(true)
    setScanMsg(null)
    try {
      const res  = await fetch('/api/drive-scan', { method: 'POST', headers: { 'X-App-Manual': '1' } })
      const data = await res.json() as { ok?: boolean; new_videos?: number; error?: string; remaining?: number }
      if (res.status === 429) {
        setScanCooldown(data.remaining ?? 90)
        setScanMsg('Aguarde o cooldown')
      } else if (data.ok) {
        const n = data.new_videos ?? 0
        setScanMsg(n > 0 ? `${n} arquivo${n > 1 ? 's' : ''} novo${n > 1 ? 's' : ''}!` : 'Nenhum arquivo novo')
        setScanCooldown(90)
        if (n > 0) onRefresh()
      }
    } catch (e) {
      console.error('[driveInbox] scan manual falhou', e)
      setScanMsg('Erro ao verificar')
    } finally {
      setScanning(false)
    }
  }, [scanning, scanCooldown, onRefresh])

  const clientNames = useMemo(() => [...new Set(videos.map(v => v.client_name))].sort(), [videos])

  const filtered = useMemo(() => videos.filter(v => {
    if (statusFilter !== 'all' && v.status !== statusFilter) return false
    if (clientFilter !== 'all' && v.client_name !== clientFilter) return false
    if (dateFilter === 'today' && !isToday(v.detected_at)) return false
    if (dateFilter === 'week'  && !isThisWeek(v.detected_at)) return false
    return true
  }), [videos, statusFilter, clientFilter, dateFilter])

  // Itens reprovados pelo cliente que ainda precisam de novo vídeo
  const rejectedNeedingVideo = useMemo(() => items.filter(i => {
    if ((states[i.i]?.status ?? i.s) !== 6) return false
    const fl = states[i.i]?.footageLink ?? ''
    return fl.includes('drive.google.com')
  }), [items, states])

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <Box sx={{ px: 2, pt: 1.2, pb: clientNames.length > 0 ? 0.8 : 1.2, flexShrink: 0, borderBottom: '1px solid rgba(244,247,255,0.05)' }}>

        {/* Linha 1: filtros de tempo | status + ações */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>

          {/* Grupo: Período */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {([['today','Hoje'],['week','7 dias'],['all','Todos']] as const).map(([val, lbl]) => (
              <Box key={val} onClick={() => setDateFilter(val)} sx={{
                px: 1.2, py: 0.5, borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700,
                bgcolor: dateFilter === val ? 'rgba(59,130,246,0.15)' : 'rgba(244,247,255,0.04)',
                border: `1px solid ${dateFilter === val ? 'rgba(59,130,246,0.4)' : 'rgba(244,247,255,0.08)'}`,
                color: dateFilter === val ? DS.accent : 'rgba(244,247,255,0.4)',
                transition: 'all 0.15s',
              }}>{lbl}</Box>
            ))}
          </Box>

          {/* Separador visual entre grupos */}
          <Box sx={{ width: '1px', height: 16, bgcolor: 'rgba(244,247,255,0.12)', flexShrink: 0 }} />

          {/* Grupo: Status do vídeo */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {STATUS_FILTER_LABELS.map(f => (
              <Box key={f.value} onClick={() => setStatusFilter(f.value as typeof statusFilter)} sx={{
                px: 1.2, py: 0.5, borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700,
                bgcolor: statusFilter === f.value ? `${f.color}18` : 'rgba(244,247,255,0.04)',
                border: `1px solid ${statusFilter === f.value ? f.color + '40' : 'rgba(244,247,255,0.08)'}`,
                color: statusFilter === f.value ? f.color : 'rgba(244,247,255,0.4)',
                transition: 'all 0.15s',
              }}>{f.label}</Box>
            ))}
          </Box>

          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.3)' }}>
              {filtered.length} arquivo{filtered.length !== 1 ? 's' : ''}
            </Typography>
            {statusFilter === 'inbox' && videos.some(v => v.status === 'inbox') && (
              <Tooltip title="Ignorar todos do inbox">
                <Box onClick={() => onIgnoreAll(videos.filter(v => v.status === 'inbox'))} sx={{
                  px: 1, py: 0.4, borderRadius: '7px', cursor: 'pointer', fontSize: '0.58rem', fontWeight: 700,
                  bgcolor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: DS.red,
                  '&:hover': { bgcolor: 'rgba(239,68,68,0.15)' }, transition: 'all 0.15s',
                }}>Limpar todos</Box>
              </Tooltip>
            )}
            <Tooltip title={scanCooldown > 0 ? `Próximo scan em ${scanCooldown}s` : 'Verificar Drive agora'}>
              <Box onClick={handleScanNow} sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                px: 1.2, py: 0.5, borderRadius: '8px', cursor: scanning || scanCooldown > 0 ? 'default' : 'pointer',
                fontSize: '0.62rem', fontWeight: 700,
                bgcolor: scanMsg && scanMsg.includes('novo') ? 'rgba(49,209,124,0.12)' : 'rgba(59,130,246,0.1)',
                border: `1px solid ${scanMsg && scanMsg.includes('novo') ? 'rgba(49,209,124,0.35)' : 'rgba(59,130,246,0.3)'}`,
                color: scanMsg && scanMsg.includes('novo') ? DS.green : DS.accent,
                opacity: scanCooldown > 0 && !scanning ? 0.5 : 1,
                transition: 'all 0.2s',
                '&:hover': { opacity: scanning || scanCooldown > 0 ? undefined : 0.85 },
              }}>
                {scanning
                  ? <CircularProgress size={10} sx={{ color: DS.accent }} />
                  : <RadarIcon sx={{ fontSize: 12 }} />
                }
                {scanCooldown > 0 && !scanning ? `${scanCooldown}s` : scanMsg ?? 'Verificar agora'}
              </Box>
            </Tooltip>
            <Tooltip title="Atualizar lista">
              <span>
                <IconButton size="small" onClick={onRefresh} disabled={loading} sx={{ p: 0.5 }}>
                  <RefreshIcon sx={{ fontSize: 15, color: 'rgba(244,247,255,0.4)' }} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {/* Linha 2: chips de cliente (linha separada, só aparece se houver clientes) */}
        {clientNames.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.8 }}>
            {['all', ...clientNames].map(c => (
              <Chip key={c} label={c === 'all' ? 'Todos os clientes' : c} size="small" onClick={() => setClientFilter(c)}
                sx={{
                  height: 22, fontSize: '0.6rem', cursor: 'pointer',
                  bgcolor: clientFilter === c ? 'rgba(59,130,246,0.15)' : 'rgba(244,247,255,0.05)',
                  border: `1px solid ${clientFilter === c ? 'rgba(59,130,246,0.4)' : 'rgba(244,247,255,0.09)'}`,
                  color: clientFilter === c ? DS.accent : 'rgba(244,247,255,0.5)',
                }} />
            ))}
          </Box>
        )}
      </Box>

      {/* ── Content ─────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>

        {/* ── Banner: vídeos reprovados aguardando reenvio ── */}
        {rejectedNeedingVideo.length > 0 && (
          <Box sx={{
            mb: 2, px: 1.4, py: 1.2, borderRadius: '12px',
            bgcolor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.8 }}>
              <WarningAmberIcon sx={{ fontSize: 14, color: DS.red }} />
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: DS.red }}>
                {rejectedNeedingVideo.length} vídeo{rejectedNeedingVideo.length > 1 ? 's' : ''} reprovado{rejectedNeedingVideo.length > 1 ? 's' : ''} — reenvie na pasta Publicar
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {rejectedNeedingVideo.slice(0, 4).map(i => (
                <Box key={i.i} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, px: 1, py: 0.6, borderRadius: '8px', bgcolor: 'rgba(239,68,68,0.06)' }}>
                  <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: DS.red, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(244,247,255,0.8)', flex: 1 }} noWrap>
                    {states[i.i]?.title || i.n}
                  </Typography>
                  <Typography sx={{ fontSize: '0.58rem', color: DS.accent, fontWeight: 600 }}>{i.c}</Typography>
                  {states[i.i]?.rejectionText && (
                    <Tooltip title={states[i.i]?.rejectionText}>
                      <Typography sx={{ fontSize: '0.55rem', color: 'rgba(244,247,255,0.3)', cursor: 'help' }}>ver motivo</Typography>
                    </Tooltip>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {loading && filtered.length === 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', lg: 'repeat(3,1fr)', xl: 'repeat(4,1fr)' }, gap: 1.5 }}>
            {[0, 1, 2, 3].map(i => <Skeleton key={i} height={186} radius="12px" delayMs={i * 90} />)}
          </Box>
        )}

        {!loading && filtered.length === 0 && (
          <Box sx={{ textAlign: 'center', pt: 8 }}>
            <Typography sx={{ fontSize: '2rem', mb: 1.5 }}>📥</Typography>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(244,247,255,0.5)', mb: 0.5 }}>
              {statusFilter === 'inbox' ? 'Nenhum arquivo novo' : 'Nenhum arquivo encontrado'}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(244,247,255,0.25)' }}>
              {statusFilter === 'inbox'
                ? 'Use "Verificar agora" ou aguarde o scan automático'
                : 'Tente mudar o filtro de status'}
            </Typography>
          </Box>
        )}

        {filtered.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(2,1fr)', lg: 'repeat(3,1fr)', xl: 'repeat(4,1fr)' }, gap: 1.5 }}>
            {filtered.map(v => {
              const fileState = inboxState[v.drive_file_id]
              return (
              <Box key={v.drive_file_id} sx={{
                borderRadius: '12px', overflow: 'hidden',
                bgcolor: 'rgba(244,247,255,0.03)',
                border: v.status === 'linked' ? '1px solid rgba(49,209,124,0.25)' : '1px solid rgba(244,247,255,0.07)',
                opacity: fileState?.ignoredAt ? 0.55 : 1,
                transition: 'all 0.18s',
                '&:hover': { borderColor: 'rgba(59,130,246,0.25)', bgcolor: 'rgba(244,247,255,0.05)' },
              }}>
                <Box
                  sx={{ position: 'relative', aspectRatio: '16/9', bgcolor: 'rgba(0,0,0,0.55)', overflow: 'hidden', cursor: 'pointer' }}
                  onClick={() => setPlayingVideo(p => p === v.drive_file_id ? null : v.drive_file_id)}
                >
                  {playingVideo === v.drive_file_id ? (
                    <iframe
                      src={`https://drive.google.com/file/d/${v.drive_file_id}/preview`}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      allow="autoplay"
                    />
                  ) : (
                    <>
                      {/* Tenta thumb do DB → thumbnail do Drive → fallback emoji.
                          Aqui a miniatura É do arquivo em si — não é prévia de card. */}
                      {(v.thumbnail_url && !thumbErrors[v.drive_file_id]) ? (
                        <img src={v.thumbnail_url} alt={v.filename}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={() => setThumbErrors(p => ({ ...p, [v.drive_file_id]: true }))} />
                      ) : !thumbErrors[v.drive_file_id + '_d'] ? (
                        <img
                          src={`https://drive.google.com/thumbnail?id=${v.drive_file_id}&sz=w480`}
                          alt={v.filename}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={() => setThumbErrors(p => ({ ...p, [v.drive_file_id + '_d']: true }))} />
                      ) : (
                        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography sx={{ fontSize: '2.2rem', opacity: 0.2 }}>{isImageFile(v) ? '🖼️' : '🎬'}</Typography>
                        </Box>
                      )}
                      {/* Overlay no hover — play só faz sentido em vídeo. */}
                      <Box sx={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: 'rgba(0,0,0,0.25)', opacity: 0, transition: 'opacity 0.18s',
                        '&:hover': { opacity: 1 },
                      }}>
                        <Box sx={{
                          width: 38, height: 38, borderRadius: '50%',
                          bgcolor: 'rgba(244,247,255,0.15)', backdropFilter: 'blur(6px)',
                          border: '1.5px solid rgba(244,247,255,0.45)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Typography sx={{ fontSize: isImageFile(v) ? '0.9rem' : '1rem', ml: isImageFile(v) ? 0 : '3px', lineHeight: 1, userSelect: 'none' }}>
                            {isImageFile(v) ? '🔍' : '▶'}
                          </Typography>
                        </Box>
                      </Box>
                    </>
                  )}
                  {v.status === 'linked' && playingVideo !== v.drive_file_id && (
                    <Box sx={{ position: 'absolute', top: 6, right: 6, px: 0.8, py: 0.3, borderRadius: '6px', bgcolor: 'rgba(49,209,124,0.9)', zIndex: 1 }}>
                      <Typography sx={{ fontSize: '0.55rem', fontWeight: 800, color: '#04140C' }}>VINCULADO</Typography>
                    </Box>
                  )}
                </Box>

                <Box sx={{ p: 1.2 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(244,247,255,0.85)', mb: 0.4 }} noWrap title={v.filename}>
                    {v.filename}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
                    <Typography sx={{ fontSize: '0.58rem', color: DS.accent, fontWeight: 600 }}>{v.client_name}</Typography>
                    {v.file_size_bytes && (
                      <>
                        <Typography sx={{ fontSize: '0.5rem', color: 'rgba(244,247,255,0.2)' }}>·</Typography>
                        {/* O tamanho sozinho não dizia nada. Acima de 70 MB o
                            cliente sente no 4G para aprovar; acima de 600 MB o
                            arquivo nem entra no espelho. */}
                        <ExportWeightChip bytes={v.file_size_bytes} mimeType={v.mime_type} />
                      </>
                    )}
                    <Typography sx={{ fontSize: '0.5rem', color: 'rgba(244,247,255,0.2)', ml: 'auto' }}>·</Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: 'rgba(244,247,255,0.3)' }}>{timeAgo(v.detected_at)}</Typography>
                  </Box>

                  {v.status === 'linked' && v.linked_item_id ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                        <CheckCircleIcon sx={{ fontSize: 13, color: DS.green }} />
                        <Typography sx={{ fontSize: '0.6rem', color: DS.green, fontWeight: 600 }}>
                          {(() => {
                            const item = items.find(i => i.i === v.linked_item_id)
                            const title = item ? (states[item.i]?.title || item.n) : `#${v.linked_item_id}`
                            return title.length > 30 ? title.slice(0, 30) + '…' : title
                          })()}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        startIcon={<WhatsAppIcon sx={{ fontSize: 11 }} />}
                        onClick={() => onSendToClient?.(v.linked_item_id!, v.client_name)}
                        sx={{
                          height: 24, fontSize: '0.58rem', fontWeight: 700,
                          background: 'rgba(49,209,124,0.12)',
                          border: '1px solid rgba(49,209,124,0.3)',
                          color: DS.green, borderRadius: '6px',
                          '&:hover': { background: 'rgba(49,209,124,0.22)' },
                        }}
                      >
                        Enviar ao cliente
                      </Button>
                      {editLinkId === v.drive_file_id ? (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <TextField
                            size="small" autoFocus
                            value={editLinkVal}
                            onChange={e => setEditLinkVal(e.target.value)}
                            placeholder="Cole o link do Drive..."
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                onUpdateState(v.linked_item_id!, { footageLink: editLinkVal, link: editLinkVal })
                                setEditLinkId(null)
                              }
                              if (e.key === 'Escape') setEditLinkId(null)
                            }}
                            sx={{
                              flex: 1,
                              '& .MuiInputBase-input': { fontSize: '0.58rem', py: '4px', px: 1 },
                              '& .MuiOutlinedInput-root': { borderRadius: '6px', bgcolor: 'rgba(244,247,255,0.04)' },
                            }}
                          />
                          <Button size="small"
                            onClick={() => {
                              onUpdateState(v.linked_item_id!, { footageLink: editLinkVal, link: editLinkVal })
                              setEditLinkId(null)
                            }}
                            sx={{ height: 28, minWidth: 0, px: 1, fontSize: '0.6rem', fontWeight: 800, background: `linear-gradient(135deg,${DS.accent},${DS.cyan})`, color: '#fff', borderRadius: '6px' }}
                          >
                            OK
                          </Button>
                        </Box>
                      ) : (
                        <Button size="small"
                          onClick={() => {
                            setEditLinkVal(states[v.linked_item_id!]?.link ?? '')
                            setEditLinkId(v.drive_file_id)
                          }}
                          sx={{ height: 18, fontSize: '0.52rem', color: 'rgba(244,247,255,0.25)', justifyContent: 'flex-start', p: 0, minWidth: 0, '&:hover': { color: DS.accent, bgcolor: 'transparent' } }}
                        >
                          🔗 editar link do criativo
                        </Button>
                      )}
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Button size="small" startIcon={<LinkIcon sx={{ fontSize: 11 }} />}
                        onClick={() => onRequestLink(v)}
                        sx={{
                          flex: 1, height: 26, fontSize: '0.6rem', fontWeight: 800,
                          background: `linear-gradient(90deg, ${DS.accent} 0%, ${DS.cyan} 100%)`,
                          color: '#FFFFFF', borderRadius: '7px', minWidth: 0,
                          '&:hover': { filter: 'brightness(1.06)' },
                        }}>
                        Vincular
                      </Button>
                      <Tooltip title="Lembrar depois">
                        <IconButton size="small" onClick={() => onRemindLater(v)}
                          sx={{ width: 26, height: 26, borderRadius: '7px', bgcolor: 'rgba(244,247,255,0.05)', border: '1px solid rgba(244,247,255,0.09)' }}>
                          <ScheduleIcon sx={{ fontSize: 12, color: 'rgba(244,247,255,0.45)' }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Abrir no Drive">
                        <IconButton size="small" component="a" href={`https://drive.google.com/file/d/${v.drive_file_id}/view`} target="_blank" rel="noopener"
                          sx={{ width: 26, height: 26, borderRadius: '7px', bgcolor: 'rgba(244,247,255,0.06)', border: '1px solid rgba(244,247,255,0.1)' }}>
                          <OpenInNewIcon sx={{ fontSize: 12, color: 'rgba(244,247,255,0.5)' }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Ignorar">
                        <IconButton size="small" onClick={() => onIgnore(v)}
                          sx={{ width: 26, height: 26, borderRadius: '7px', bgcolor: 'rgba(244,247,255,0.04)', border: '1px solid rgba(244,247,255,0.08)' }}>
                          <VisibilityOffIcon sx={{ fontSize: 12, color: 'rgba(244,247,255,0.3)' }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              </Box>
              )
            })}
          </Box>
        )}
      </Box>
    </Box>
  )
}
