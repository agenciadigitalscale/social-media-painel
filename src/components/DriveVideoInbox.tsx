import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box, Typography, CircularProgress, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  FormControlLabel, Checkbox,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import LinkIcon from '@mui/icons-material/Link'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import RadarIcon from '@mui/icons-material/Radar'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import type { ContentItem, ItemState } from '../types'
import { STATUS_CONFIG } from '../types'

interface AutoLinkPending {
  video: DriveVideo
  item: ContentItem
  countdown: number
}

interface DriveVideo {
  drive_file_id: string
  client_name: string
  filename: string
  file_size_bytes: number | null
  thumbnail_url: string | null
  detected_at: number
  linked_item_id: number | null
  status: 'inbox' | 'linked' | 'ignored'
}

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  onUpdateState: (id: number, updates: Partial<ItemState>) => void
  onRefreshCount?: () => void
  onSendToClient?: (itemId: number, clientName: string) => void
}

function formatBytes(b: number | null): string {
  if (!b) return ''
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function timeAgo(unix: number): string {
  const diff = Math.floor(Date.now() / 1000) - unix
  if (diff < 60)    return 'agora'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

// Pontuação de similaridade entre nome de arquivo e título do item (0–1)
function similarity(filename: string, title: string): number {
  const clean = (s: string) =>
    s.toLowerCase()
      .normalize('NFD').replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/).filter(w => w.length > 2)
  const fnWords = new Set(clean(filename))
  const ttWords = clean(title)
  if (!ttWords.length || !fnWords.size) return 0
  return ttWords.filter(w => fnWords.has(w)).length / ttWords.length
}

const STATUS_FILTER_LABELS = [
  { value: 'inbox',  label: '📥 Inbox',    color: '#ff9039' },
  { value: 'linked', label: '🔗 Vinculado', color: '#00C47A' },
  { value: 'all',    label: 'Todos',        color: '#A1A1AA' },
]

function isToday(unix: number): boolean {
  const d = new Date(unix * 1000), now = new Date()
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

function isThisWeek(unix: number): boolean {
  return Date.now() / 1000 - unix < 7 * 24 * 60 * 60
}

export default function DriveVideoInbox({ items, states, onUpdateState, onRefreshCount, onSendToClient }: Props) {
  const [videos, setVideos]             = useState<DriveVideo[]>([])
  const [loading, setLoading]           = useState(true)
  const [scanning, setScanning]         = useState(false)
  const [scanMsg, setScanMsg]           = useState<string | null>(null)
  const [scanCooldown, setScanCooldown] = useState(0)   // segundos restantes
  const [statusFilter, setStatusFilter] = useState<'inbox' | 'linked' | 'all'>('inbox')
  const [clientFilter, setClientFilter] = useState('all')
  const [dateFilter, setDateFilter]     = useState<'today' | 'week' | 'all'>('today')

  const [linkVideo,  setLinkVideo]  = useState<DriveVideo | null>(null)
  const [linkSearch, setLinkSearch] = useState('')
  const [linkSaving, setLinkSaving] = useState(false)
  const [autoSend,   setAutoSend]   = useState(true)

  const [autoLinkPending, setAutoLinkPending] = useState<AutoLinkPending | null>(null)
  const autoLinkRunning = useRef(false)

  const patchVideo = useCallback(async (fileId: string, updates: { status?: string; linked_item_id?: number | null }) => {
    await fetch('/api/drive-videos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drive_file_id: fileId, ...updates }),
    })
  }, [])

  const checkAutoLink = useCallback(async (freshVideos: DriveVideo[]) => {
    if (autoLinkRunning.current) return
    const inbox = freshVideos.filter(v => v.status === 'inbox')
    for (const video of inbox) {
      const candidates = items
        .filter(i => {
          if (i.c !== video.client_name) return false
          const st = states[i.i]?.status ?? i.s
          return st <= 3
        })
        .map(i => ({ item: i, score: similarity(video.filename, states[i.i]?.title || i.n) }))
        .filter(x => x.score >= 0.85)

      if (candidates.length === 1) {
        autoLinkRunning.current = true
        const { item } = candidates[0]
        await patchVideo(video.drive_file_id, { status: 'linked', linked_item_id: item.i })
        const driveUrl = `https://drive.google.com/file/d/${video.drive_file_id}/view`
        onUpdateState(item.i, { footageLink: driveUrl, link: driveUrl })
        setVideos(prev => prev.map(x =>
          x.drive_file_id === video.drive_file_id ? { ...x, status: 'linked', linked_item_id: item.i } : x
        ))
        onRefreshCount?.()
        setAutoLinkPending({ video, item, countdown: 8 })
        break
      }
    }
  }, [items, states, patchVideo, onUpdateState, onRefreshCount])

  // Countdown do auto-link — dispara WhatsApp ao zerar
  useEffect(() => {
    if (!autoLinkPending) return
    if (autoLinkPending.countdown <= 0) {
      if (onSendToClient) onSendToClient(autoLinkPending.item.i, autoLinkPending.item.c)
      setAutoLinkPending(null)
      autoLinkRunning.current = false
      return
    }
    const id = setTimeout(() =>
      setAutoLinkPending(prev => prev ? { ...prev, countdown: prev.countdown - 1 } : null)
    , 1000)
    return () => clearTimeout(id)
  }, [autoLinkPending, onSendToClient])

  const handleCancelAutoLink = useCallback(async () => {
    if (!autoLinkPending) return
    await patchVideo(autoLinkPending.video.drive_file_id, { status: 'inbox', linked_item_id: null })
    onUpdateState(autoLinkPending.item.i, { footageLink: '', link: '' })
    setVideos(prev => prev.map(x =>
      x.drive_file_id === autoLinkPending.video.drive_file_id
        ? { ...x, status: 'inbox', linked_item_id: null }
        : x
    ))
    setAutoLinkPending(null)
    autoLinkRunning.current = false
  }, [autoLinkPending, patchVideo, onUpdateState])

  const fetchVideos = useCallback(async (skipAutoLink = false) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/drive-videos?status=${statusFilter}`)
      const data = await res.json() as { ok: boolean; videos: DriveVideo[] }
      const fresh = data.videos ?? []
      setVideos(fresh)
      if (!skipAutoLink && !autoLinkRunning.current) checkAutoLink(fresh)
    } catch {
      setVideos([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, checkAutoLink])

  useEffect(() => { fetchVideos() }, [fetchVideos])

  useEffect(() => {
    const id = setInterval(fetchVideos, 120_000)
    return () => clearInterval(id)
  }, [fetchVideos])

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
        setScanMsg(data.new_videos! > 0 ? `${data.new_videos} vídeo${data.new_videos! > 1 ? 's' : ''} novo${data.new_videos! > 1 ? 's' : ''}!` : 'Nenhum vídeo novo')
        setScanCooldown(90)
        if (data.new_videos! > 0) fetchVideos()
      }
    } catch {
      setScanMsg('Erro ao verificar')
    } finally {
      setScanning(false)
    }
  }, [scanning, scanCooldown, fetchVideos])

  const handleIgnore = useCallback(async (v: DriveVideo) => {
    await patchVideo(v.drive_file_id, { status: 'ignored' })
    setVideos(prev => prev.filter(x => x.drive_file_id !== v.drive_file_id))
    onRefreshCount?.()
  }, [patchVideo, onRefreshCount])

  const handleLink = useCallback(async (video: DriveVideo, item: ContentItem) => {
    setLinkSaving(true)
    try {
      await patchVideo(video.drive_file_id, { status: 'linked', linked_item_id: item.i })
      const driveUrl = `https://drive.google.com/file/d/${video.drive_file_id}/view`
      onUpdateState(item.i, { footageLink: driveUrl, link: driveUrl })
      setVideos(prev => prev.map(x =>
        x.drive_file_id === video.drive_file_id ? { ...x, status: 'linked', linked_item_id: item.i } : x
      ))
      onRefreshCount?.()
      setLinkVideo(null)
      if (autoSend && onSendToClient) onSendToClient(item.i, item.c)
    } finally {
      setLinkSaving(false)
    }
  }, [patchVideo, onUpdateState, onRefreshCount, autoSend, onSendToClient])

  const handleIgnoreAll = useCallback(async () => {
    const targets = videos.filter(v => v.status === 'inbox')
    await Promise.all(targets.map(v => patchVideo(v.drive_file_id, { status: 'ignored' })))
    setVideos(prev => prev.filter(v => v.status !== 'inbox'))
    onRefreshCount?.()
  }, [videos, patchVideo, onRefreshCount])

  const clientNames = [...new Set(videos.map(v => v.client_name))].sort()

  const filtered = videos.filter(v => {
    if (clientFilter !== 'all' && v.client_name !== clientFilter) return false
    if (dateFilter === 'today' && !isToday(v.detected_at)) return false
    if (dateFilter === 'week'  && !isThisWeek(v.detected_at)) return false
    return true
  })

  // Itens reprovados pelo cliente que ainda precisam de novo vídeo
  const rejectedNeedingVideo = items.filter(i => {
    if ((states[i.i]?.status ?? i.s) !== 6) return false
    const fl = states[i.i]?.footageLink ?? ''
    return fl.includes('drive.google.com')
  })

  // Candidatos do dialog com score de similaridade
  const linkCandidatesRaw = linkVideo
    ? items.filter(i => {
        if (i.c !== linkVideo.client_name) return false
        const st = states[i.i]?.status ?? i.s
        if (st > 3) return false
        const title = (states[i.i]?.title || i.n).toLowerCase()
        return !linkSearch || title.includes(linkSearch.toLowerCase()) || i.tp.toLowerCase().includes(linkSearch.toLowerCase())
      })
    : []

  const linkCandidates = linkCandidatesRaw
    .map(i => ({ item: i, score: linkVideo ? similarity(linkVideo.filename, states[i.i]?.title || i.n) : 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)

  const topScore = linkCandidates[0]?.score ?? 0

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <Box sx={{ px: 2, py: 1.2, display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {([['today','Hoje'],['week','7 dias'],['all','Todos']] as const).map(([v,l]) => (
            <Box key={v} onClick={() => setDateFilter(v)} sx={{
              px: 1.2, py: 0.5, borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700,
              bgcolor: dateFilter === v ? 'rgba(255,144,57,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${dateFilter === v ? 'rgba(255,144,57,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: dateFilter === v ? '#ff9039' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.15s',
            }}>{l}</Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {STATUS_FILTER_LABELS.map(f => (
            <Box key={f.value} onClick={() => setStatusFilter(f.value as typeof statusFilter)} sx={{
              px: 1.2, py: 0.5, borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700,
              bgcolor: statusFilter === f.value ? `${f.color}18` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${statusFilter === f.value ? f.color + '40' : 'rgba(255,255,255,0.08)'}`,
              color: statusFilter === f.value ? f.color : 'rgba(255,255,255,0.4)',
              transition: 'all 0.15s',
            }}>{f.label}</Box>
          ))}
        </Box>

        {clientNames.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {['all', ...clientNames].map(c => (
              <Chip key={c} label={c === 'all' ? 'Todos' : c} size="small" onClick={() => setClientFilter(c)}
                sx={{
                  height: 22, fontSize: '0.6rem', cursor: 'pointer',
                  bgcolor: clientFilter === c ? 'rgba(255,144,57,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${clientFilter === c ? 'rgba(255,144,57,0.4)' : 'rgba(255,255,255,0.09)'}`,
                  color: clientFilter === c ? '#ff9039' : 'rgba(255,255,255,0.5)',
                }} />
            ))}
          </Box>
        )}

        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>
            {filtered.length} vídeo{filtered.length !== 1 ? 's' : ''}
          </Typography>
          {statusFilter === 'inbox' && videos.some(v => v.status === 'inbox') && (
            <Tooltip title="Ignorar todos do inbox">
              <Box onClick={handleIgnoreAll} sx={{
                px: 1, py: 0.4, borderRadius: '7px', cursor: 'pointer', fontSize: '0.58rem', fontWeight: 700,
                bgcolor: 'rgba(255,69,69,0.08)', border: '1px solid rgba(255,69,69,0.2)', color: '#FF4545',
                '&:hover': { bgcolor: 'rgba(255,69,69,0.15)' }, transition: 'all 0.15s',
              }}>Limpar todos</Box>
            </Tooltip>
          )}

          {/* ── Botão Verificar agora ── */}
          <Tooltip title={scanCooldown > 0 ? `Próximo scan em ${scanCooldown}s` : 'Verificar Drive agora'}>
            <Box onClick={handleScanNow} sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 1.2, py: 0.5, borderRadius: '8px', cursor: scanning || scanCooldown > 0 ? 'default' : 'pointer',
              fontSize: '0.62rem', fontWeight: 700,
              bgcolor: scanMsg && scanMsg.includes('novo') ? 'rgba(0,196,122,0.12)' : 'rgba(255,144,57,0.1)',
              border: `1px solid ${scanMsg && scanMsg.includes('novo') ? 'rgba(0,196,122,0.35)' : 'rgba(255,144,57,0.3)'}`,
              color: scanMsg && scanMsg.includes('novo') ? '#00C47A' : '#ff9039',
              opacity: scanCooldown > 0 && !scanning ? 0.5 : 1,
              transition: 'all 0.2s',
              '&:hover': { opacity: scanning || scanCooldown > 0 ? undefined : 0.85 },
            }}>
              {scanning
                ? <CircularProgress size={10} sx={{ color: '#ff9039' }} />
                : <RadarIcon sx={{ fontSize: 12 }} />
              }
              {scanCooldown > 0 && !scanning
                ? `${scanCooldown}s`
                : scanMsg ?? 'Verificar agora'
              }
            </Box>
          </Tooltip>

          <Tooltip title="Atualizar lista">
            <IconButton size="small" onClick={() => fetchVideos()} disabled={loading} sx={{ p: 0.5 }}>
              <RefreshIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.4)' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Content ─────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>

        {/* ── Banner: auto-link em andamento ── */}
        {autoLinkPending && (
          <Box sx={{
            mb: 2, px: 1.4, py: 1.2, borderRadius: '12px',
            bgcolor: 'rgba(0,196,122,0.07)', border: '1px solid rgba(0,196,122,0.25)',
            display: 'flex', alignItems: 'center', gap: 1.5,
          }}>
            <AutoFixHighIcon sx={{ fontSize: 16, color: '#00C47A', flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#00C47A' }}>
                🔗 Auto-vinculado — enviando ao cliente em {autoLinkPending.countdown}s
              </Typography>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', mt: 0.2 }} noWrap>
                {autoLinkPending.video.filename} → {states[autoLinkPending.item.i]?.title || autoLinkPending.item.n}
              </Typography>
              {/* barra de progresso */}
              <Box sx={{ mt: 0.6, height: 3, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <Box sx={{
                  height: '100%', borderRadius: 2, bgcolor: '#00C47A',
                  width: `${(autoLinkPending.countdown / 8) * 100}%`,
                  transition: 'width 1s linear',
                }} />
              </Box>
            </Box>
            <Button size="small" onClick={handleCancelAutoLink} sx={{
              fontSize: '0.6rem', fontWeight: 800, color: '#FF4545', flexShrink: 0,
              bgcolor: 'rgba(255,69,69,0.08)', border: '1px solid rgba(255,69,69,0.25)',
              borderRadius: '8px', px: 1.2, py: 0.5, minWidth: 0,
              '&:hover': { bgcolor: 'rgba(255,69,69,0.18)' },
            }}>Cancelar</Button>
          </Box>
        )}

        {/* ── Banner: vídeos reprovados aguardando reenvio ── */}
        {rejectedNeedingVideo.length > 0 && (
          <Box sx={{
            mb: 2, px: 1.4, py: 1.2, borderRadius: '12px',
            bgcolor: 'rgba(255,69,69,0.07)', border: '1px solid rgba(255,69,69,0.2)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.8 }}>
              <WarningAmberIcon sx={{ fontSize: 14, color: '#FF4545' }} />
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#FF4545' }}>
                {rejectedNeedingVideo.length} vídeo{rejectedNeedingVideo.length > 1 ? 's' : ''} reprovado{rejectedNeedingVideo.length > 1 ? 's' : ''} — reenvie na pasta Publicar
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {rejectedNeedingVideo.slice(0, 4).map(i => (
                <Box key={i.i} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, px: 1, py: 0.6, borderRadius: '8px', bgcolor: 'rgba(255,69,69,0.06)' }}>
                  <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#FF4545', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', flex: 1 }} noWrap>
                    {states[i.i]?.title || i.n}
                  </Typography>
                  <Typography sx={{ fontSize: '0.58rem', color: '#ff9039', fontWeight: 600 }}>{i.c}</Typography>
                  {states[i.i]?.rejectionText && (
                    <Tooltip title={states[i.i]?.rejectionText}>
                      <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', cursor: 'help' }}>ver motivo</Typography>
                    </Tooltip>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <CircularProgress size={28} sx={{ color: '#ff9039' }} />
          </Box>
        )}

        {!loading && filtered.length === 0 && (
          <Box sx={{ textAlign: 'center', pt: 8 }}>
            <Typography sx={{ fontSize: '2rem', mb: 1.5 }}>📥</Typography>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
              {statusFilter === 'inbox' ? 'Nenhum vídeo novo' : 'Nenhum vídeo encontrado'}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>
              {statusFilter === 'inbox'
                ? 'Use "Verificar agora" ou aguarde o scan automático'
                : 'Tente mudar o filtro de status'}
            </Typography>
          </Box>
        )}

        {!loading && filtered.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(2,1fr)', lg: 'repeat(3,1fr)', xl: 'repeat(4,1fr)' }, gap: 1.5 }}>
            {filtered.map(v => (
              <Box key={v.drive_file_id} sx={{
                borderRadius: '12px', overflow: 'hidden',
                bgcolor: 'rgba(255,255,255,0.03)',
                border: v.status === 'linked' ? '1px solid rgba(0,196,122,0.25)' : '1px solid rgba(255,255,255,0.07)',
                transition: 'all 0.18s',
                '&:hover': { borderColor: 'rgba(255,144,57,0.25)', bgcolor: 'rgba(255,255,255,0.05)' },
              }}>
                <Box sx={{ position: 'relative', aspectRatio: '16/9', bgcolor: 'rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url} alt={v.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography sx={{ fontSize: '2rem', opacity: 0.3 }}>🎬</Typography>
                    </Box>
                  )}
                  {v.status === 'linked' && (
                    <Box sx={{ position: 'absolute', top: 6, right: 6, px: 0.8, py: 0.3, borderRadius: '6px', bgcolor: 'rgba(0,196,122,0.9)' }}>
                      <Typography sx={{ fontSize: '0.55rem', fontWeight: 800, color: '#000' }}>VINCULADO</Typography>
                    </Box>
                  )}
                </Box>

                <Box sx={{ p: 1.2 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)', mb: 0.4 }} noWrap title={v.filename}>
                    {v.filename}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
                    <Typography sx={{ fontSize: '0.58rem', color: '#ff9039', fontWeight: 600 }}>{v.client_name}</Typography>
                    {v.file_size_bytes && (
                      <>
                        <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)' }}>·</Typography>
                        <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)' }}>{formatBytes(v.file_size_bytes)}</Typography>
                      </>
                    )}
                    <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)', ml: 'auto' }}>·</Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)' }}>{timeAgo(v.detected_at)}</Typography>
                  </Box>

                  {v.status === 'linked' && v.linked_item_id ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                      <CheckCircleIcon sx={{ fontSize: 13, color: '#00C47A' }} />
                      <Typography sx={{ fontSize: '0.6rem', color: '#00C47A', fontWeight: 600 }}>
                        {(() => {
                          const item = items.find(i => i.i === v.linked_item_id)
                          const title = item ? (states[item.i]?.title || item.n) : `#${v.linked_item_id}`
                          return title.length > 30 ? title.slice(0, 30) + '…' : title
                        })()}
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Button size="small" startIcon={<LinkIcon sx={{ fontSize: 11 }} />}
                        onClick={() => { setLinkVideo(v); setLinkSearch('') }}
                        sx={{
                          flex: 1, height: 26, fontSize: '0.6rem', fontWeight: 700,
                          background: 'linear-gradient(135deg, #ff9039, #ff5339)', color: '#000',
                          borderRadius: '7px', minWidth: 0,
                        }}>
                        Vincular
                      </Button>
                      <Tooltip title="Abrir no Drive">
                        <IconButton size="small" component="a" href={`https://drive.google.com/file/d/${v.drive_file_id}/view`} target="_blank" rel="noopener"
                          sx={{ width: 26, height: 26, borderRadius: '7px', bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <OpenInNewIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Ignorar">
                        <IconButton size="small" onClick={() => handleIgnore(v)}
                          sx={{ width: 26, height: 26, borderRadius: '7px', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <VisibilityOffIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* ── Link Dialog ─────────────────────────────────────── */}
      <Dialog open={!!linkVideo} onClose={() => setLinkVideo(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px' } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography variant="subtitle1" fontWeight={700}>🔗 Vincular vídeo a um item</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem' }}>
            {linkVideo?.filename} · {linkVideo?.client_name}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField autoFocus fullWidth size="small" placeholder="Buscar por título ou tipo..."
            value={linkSearch} onChange={e => setLinkSearch(e.target.value)} sx={{ mb: 1 }} />

          {onSendToClient && (
            <Box sx={{ mb: 1.5, px: 1.2, py: 0.8, borderRadius: '10px', bgcolor: autoSend ? 'rgba(0,196,122,0.07)' : 'rgba(255,255,255,0.03)', border: `1px solid ${autoSend ? 'rgba(0,196,122,0.25)' : 'rgba(255,255,255,0.07)'}`, transition: 'all 0.18s' }}>
              <FormControlLabel
                control={<Checkbox checked={autoSend} onChange={e => setAutoSend(e.target.checked)} size="small"
                  sx={{ p: 0.4, color: 'rgba(255,255,255,0.3)', '&.Mui-checked': { color: '#00C47A' } }} />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <WhatsAppIcon sx={{ fontSize: 14, color: autoSend ? '#00C47A' : 'rgba(255,255,255,0.3)' }} />
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: autoSend ? '#00C47A' : 'rgba(255,255,255,0.4)' }}>
                      Enviar direto para aprovação do cliente
                    </Typography>
                  </Box>
                }
                sx={{ m: 0 }} />
              {autoSend && (
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', mt: 0.4, ml: 3.5 }}>
                  Pula revisão interna — abre WhatsApp direto
                </Typography>
              )}
            </Box>
          )}

          {/* Hint de matching automático */}
          {topScore >= 0.4 && !linkSearch && (
            <Box sx={{ mb: 1, px: 1.2, py: 0.6, borderRadius: '8px', bgcolor: 'rgba(255,144,57,0.07)', border: '1px solid rgba(255,144,57,0.2)', display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Typography sx={{ fontSize: '0.85rem' }}>✨</Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,144,57,0.9)', fontWeight: 600 }}>
                Item sugerido pelo nome do arquivo destacado abaixo
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 320, overflowY: 'auto' }}>
            {linkCandidates.length === 0 ? (
              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', py: 3 }}>
                Nenhum item em produção para {linkVideo?.client_name}
              </Typography>
            ) : linkCandidates.map(({ item, score }, idx) => {
              const st  = states[item.i]?.status ?? item.s
              const cfg = STATUS_CONFIG[st] ?? STATUS_CONFIG[0]
              const title     = states[item.i]?.title || item.n
              const isBest    = idx === 0 && score >= 0.4 && !linkSearch
              return (
                <Box key={item.i} onClick={() => !linkSaving && handleLink(linkVideo!, item)}
                  sx={{
                    px: 1.4, py: 1, borderRadius: '10px', cursor: 'pointer',
                    border: isBest ? '1px solid rgba(255,144,57,0.4)' : '1px solid rgba(255,255,255,0.07)',
                    bgcolor: isBest ? 'rgba(255,144,57,0.08)' : 'rgba(255,255,255,0.03)',
                    display: 'flex', alignItems: 'center', gap: 1,
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: 'rgba(255,144,57,0.12)', borderColor: 'rgba(255,144,57,0.4)' },
                  }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: isBest ? '#ff9039' : cfg.color, flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: isBest ? '#fff' : 'rgba(255,255,255,0.9)' }} noWrap>{title}</Typography>
                      {isBest && (
                        <Box sx={{ px: 0.6, py: 0.1, borderRadius: '4px', bgcolor: 'rgba(255,144,57,0.2)', flexShrink: 0 }}>
                          <Typography sx={{ fontSize: '0.5rem', fontWeight: 800, color: '#ff9039', letterSpacing: '0.06em' }}>SUGERIDO</Typography>
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.8, mt: 0.2 }}>
                      <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)' }}>{item.tp}</Typography>
                      <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)' }}>·</Typography>
                      <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)' }}>
                        {new Date(item.dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: '0.58rem', color: isBest ? '#ff9039' : cfg.color, fontWeight: 600 }}>{cfg.label}</Typography>
                </Box>
              )
            })}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setLinkVideo(null)} disabled={linkSaving}>Cancelar</Button>
          {linkSaving && <CircularProgress size={16} sx={{ color: '#ff9039' }} />}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
