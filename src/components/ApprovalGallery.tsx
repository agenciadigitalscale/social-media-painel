import { useState, useMemo } from 'react'
import {
  Dialog, DialogContent, Box, Typography, IconButton,
  Tooltip, Chip, LinearProgress, Button, Select, MenuItem,
  FormControl, InputLabel,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import SendIcon from '@mui/icons-material/Send'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import type { ContentItem, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  clientName: string
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, s: Status) => void
  onSendToClient?: (clientName: string, itemIds: number[]) => void
}

const TYPE_ICON: Record<string, string> = {
  Post: '🖼️', Reel: '🎬', Story: '📱', Carrossel: '🎠', Feed: '📸',
}

function extractThumb(url: string): string | null {
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  const id = m1?.[1] ?? m2?.[1]
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w220` : null
}

export default function ApprovalGallery({ open, onClose, clientName, items, states, onStatusChange, onSendToClient }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [filterStatus, setFilterStatus] = useState<number | 'all'>('all')

  const clientItems = useMemo(() =>
    items
      .filter(i => i.c === clientName)
      .sort((a, b) => a.dt.getTime() - b.dt.getTime()),
    [items, clientName]
  )

  const filtered = useMemo(() =>
    filterStatus === 'all'
      ? clientItems
      : clientItems.filter(i => (states[i.i]?.status ?? i.s) === filterStatus),
    [clientItems, states, filterStatus]
  )

  const stats = useMemo(() => {
    const total = clientItems.length
    const published = clientItems.filter(i => (states[i.i]?.status ?? i.s) === 7).length
    const approved = clientItems.filter(i => (states[i.i]?.status ?? i.s) === 5).length
    const pending = clientItems.filter(i => (states[i.i]?.status ?? i.s) <= 3).length
    return { total, published, approved, pending, pct: total ? Math.round((published / total) * 100) : 0 }
  }, [clientItems, states])

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    const ids = filtered.map(i => i.i)
    setSelectedIds(prev => {
      const allSelected = ids.every(id => prev.has(id))
      if (allSelected) {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      }
      return new Set([...prev, ...ids])
    })
  }

  const bulkApprove = () => {
    selectedIds.forEach(id => onStatusChange(id, 3))
    setSelectedIds(new Set())
  }

  const bulkSend = () => {
    if (onSendToClient) onSendToClient(clientName, [...selectedIds])
    setSelectedIds(new Set())
  }

  const STATUS_FILTER_OPTIONS = [
    { value: 'all', label: 'Todos' },
    { value: 0, label: 'Pendente' },
    { value: 1, label: 'Em edição' },
    { value: 2, label: 'Aprov. interna' },
    { value: 3, label: 'Aprovado' },
    { value: 4, label: 'Enviado' },
    { value: 5, label: 'Aprov. cliente' },
    { value: 6, label: 'Reprovado' },
    { value: 7, label: 'Publicado' },
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', md: '92vw', xl: '88vw' },
            maxWidth: 1600,
            maxHeight: '94vh',
            background: 'rgba(10,10,10,0.98)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 3,
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          },
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 3, py: 2,
        borderBottom: '1px solid rgba(255,144,57,0.12)',
        background: 'rgba(20,20,20,0.98)',
        display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,144,57,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Galeria de Aprovação
          </Typography>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            {clientName}
          </Typography>
        </Box>

        {/* Stats strip */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: 'Total', value: stats.total, color: 'rgba(255,255,255,0.5)' },
            { label: 'Publicados', value: stats.published, color: '#00C47A' },
            { label: 'Ap. cliente', value: stats.approved, color: '#34D399' },
            { label: 'Pendentes', value: stats.pending, color: '#FFD700' },
          ].map(({ label, value, color }) => (
            <Box key={label} sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>
                {value}
              </Typography>
              <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                {label}
              </Typography>
            </Box>
          ))}
          {/* Progress ring */}
          <Box sx={{ position: 'relative', width: 48, height: 48 }}>
            <Box sx={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: `conic-gradient(#00C47A ${stats.pct * 3.6}deg, rgba(255,255,255,0.07) 0deg)`,
            }} />
            <Box sx={{
              position: 'absolute', inset: 6, borderRadius: '50%',
              bgcolor: 'rgba(10,10,10,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 900, color: '#00C47A', lineHeight: 1 }}>
                {stats.pct}%
              </Typography>
            </Box>
          </Box>
        </Box>

        <IconButton size="small" onClick={onClose} sx={{ ml: 'auto', flexShrink: 0 }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Toolbar */}
      <Box sx={{
        px: 3, py: 1.2,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
        bgcolor: 'rgba(255,255,255,0.02)',
        flexShrink: 0,
      }}>
        {/* Filter */}
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel sx={{ fontSize: '0.72rem' }}>Status</InputLabel>
          <Select
            value={filterStatus}
            label="Status"
            onChange={e => setFilterStatus(e.target.value as number | 'all')}
            sx={{ fontSize: '0.72rem', height: 32 }}
          >
            {STATUS_FILTER_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.72rem' }}>
                {o.value !== 'all' && (
                  <Box component="span" sx={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', bgcolor: STATUS_CONFIG[o.value as Status].color, mr: 1 }} />
                )}
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Select all */}
        <Button
          size="small"
          variant="outlined"
          onClick={selectAll}
          sx={{ height: 30, fontSize: '0.68rem', borderColor: 'rgba(255,255,255,0.12)', color: 'text.secondary' }}
        >
          {filtered.every(i => selectedIds.has(i.i)) && filtered.length > 0 ? 'Desmarcar todos' : 'Selecionar todos'}
        </Button>

        {/* Bulk actions — only when something is selected */}
        {selectedIds.size > 0 && (
          <>
            <Chip
              label={`${selectedIds.size} selecionado${selectedIds.size !== 1 ? 's' : ''}`}
              size="small"
              sx={{ bgcolor: 'rgba(255,144,57,0.1)', borderColor: 'rgba(255,144,57,0.3)', color: '#ff9039', height: 28, fontSize: '0.68rem' }}
              variant="outlined"
            />
            <Tooltip title="Aprovar internamente todos os selecionados">
              <Button
                size="small"
                onClick={bulkApprove}
                startIcon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                sx={{
                  height: 30, fontSize: '0.68rem',
                  background: 'rgba(0,196,122,0.1)',
                  border: '1px solid rgba(0,196,122,0.3)', color: '#00C47A',
                  '&:hover': { background: 'rgba(0,196,122,0.3)' },
                }}
              >
                ✓ Aprovar
              </Button>
            </Tooltip>
            <Tooltip title="Enviar todos ao cliente via portal">
              <Button
                size="small"
                onClick={bulkSend}
                startIcon={<SendIcon sx={{ fontSize: 14 }} />}
                sx={{
                  height: 30, fontSize: '0.68rem',
                  background: 'rgba(249,115,22,0.1)',
                  border: '1px solid rgba(255,144,57,0.3)', color: '#ff9039',
                  '&:hover': { background: 'rgba(255,144,57,0.3)' },
                }}
              >
                📤 Enviar ao cliente
              </Button>
            </Tooltip>
            <Tooltip title="Reprovar selecionados">
              <Button
                size="small"
                onClick={() => { selectedIds.forEach(id => onStatusChange(id, 6)); setSelectedIds(new Set()) }}
                startIcon={<CancelIcon sx={{ fontSize: 14 }} />}
                sx={{
                  height: 30, fontSize: '0.68rem',
                  bgcolor: 'rgba(255,69,69,0.1)', border: '1px solid rgba(255,69,69,0.25)', color: '#FF4545',
                  '&:hover': { bgcolor: 'rgba(255,69,69,0.2)' },
                }}
              >
                ✗ Reprovar
              </Button>
            </Tooltip>
          </>
        )}

        <Typography sx={{ ml: 'auto', fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)' }}>
          {filtered.length} itens
        </Typography>
      </Box>

      {/* Grid */}
      <DialogContent sx={{ p: 2, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <Typography sx={{ color: 'text.disabled', fontSize: '0.85rem' }}>Nenhum item neste filtro</Typography>
          </Box>
        ) : (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(5, 1fr)', xl: 'repeat(6, 1fr)' },
            gap: 1.5,
          }}>
            {filtered.map((item, idx) => {
              const st = states[item.i]
              const status = (st?.status ?? item.s) as Status
              const cfg = STATUS_CONFIG[status]
              const title = st?.title || item.n
              const isSelected = selectedIds.has(item.i)
              const thumb = st?.link ? extractThumb(st.link) : null
              const daysDiff = Math.round((item.dt.getTime() - Date.now()) / 86400000)
              const dateColor = daysDiff < 0 ? '#FF4545' : daysDiff === 0 ? '#FFD700' : 'rgba(255,255,255,0.35)'

              return (
                <Box
                  key={item.i}
                  onClick={() => toggleSelect(item.i)}
                  sx={{
                    position: 'relative', borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
                    border: '2px solid',
                    borderColor: isSelected ? 'primary.main' : 'rgba(255,255,255,0.06)',
                    background: isSelected ? 'rgba(255,144,57,0.06)' : 'rgba(13,13,13,0.8)',
                    transition: 'all 0.22s cubic-bezier(0.16,1,0.3,1)',
                    '@keyframes galleryCardIn': {
                      from: { opacity: 0, transform: 'scale(0.92) translateY(8px)' },
                      to: { opacity: 1, transform: 'scale(1) translateY(0)' },
                    },
                    animation: 'galleryCardIn 0.32s cubic-bezier(0.16,1,0.3,1) both',
                    animationDelay: `${Math.min(idx * 20, 400)}ms`,
                    boxShadow: isSelected ? '0 0 0 1px rgba(255,144,57,0.4), 0 4px 16px rgba(255,144,57,0.15)' : 'none',
                    '&:hover': {
                      borderColor: isSelected ? 'primary.main' : 'rgba(255,255,255,0.15)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    },
                  }}
                >
                  {/* Thumbnail area (square) */}
                  <Box sx={{ position: 'relative', paddingTop: '100%', bgcolor: 'rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                    {thumb ? (
                      <Box
                        component="img"
                        src={thumb}
                        alt={title}
                        sx={{
                          position: 'absolute', inset: 0, width: '100%', height: '100%',
                          objectFit: 'cover',
                          filter: status === 6 ? 'grayscale(80%) brightness(0.6)' : status === 7 ? 'none' : 'none',
                        }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <Box sx={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `radial-gradient(circle, ${cfg.color}15 0%, transparent 70%)`,
                      }}>
                        <Typography sx={{ fontSize: '2.2rem', opacity: 0.6 }}>
                          {TYPE_ICON[item.tp] ?? '🖼️'}
                        </Typography>
                      </Box>
                    )}

                    {/* Status badge (top-right) */}
                    <Box sx={{
                      position: 'absolute', top: 6, right: 6,
                      px: 0.8, py: 0.3, borderRadius: 1,
                      bgcolor: `${cfg.color}22`, backdropFilter: 'blur(8px)',
                      border: `1px solid ${cfg.color}40`,
                      display: 'flex', alignItems: 'center', gap: 0.4,
                    }}>
                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: cfg.color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.48rem', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                        {cfg.shortLabel}
                      </Typography>
                    </Box>

                    {/* Selection overlay */}
                    {isSelected && (
                      <Box sx={{
                        position: 'absolute', inset: 0,
                        bgcolor: 'rgba(255,144,57,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Box sx={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: '#F97316',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 0 12px rgba(255,144,57,0.5)',
                        }}>
                          <Typography sx={{ fontSize: '0.8rem', color: '#000', fontWeight: 900 }}>✓</Typography>
                        </Box>
                      </Box>
                    )}

                    {/* Type pill (bottom-left) */}
                    <Box sx={{
                      position: 'absolute', bottom: 5, left: 5,
                      px: 0.7, py: 0.2, borderRadius: 0.8,
                      bgcolor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                    }}>
                      <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {TYPE_ICON[item.tp]} {item.tp}
                      </Typography>
                    </Box>

                    {/* Drive link shortcut */}
                    {st?.link && (
                      <Box
                        component="a"
                        href={st.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        sx={{
                          position: 'absolute', bottom: 5, right: 5,
                          p: 0.4, borderRadius: 0.8,
                          bgcolor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                          display: 'flex', alignItems: 'center',
                          color: 'rgba(255,255,255,0.5)',
                          '&:hover': { color: '#fff' },
                          transition: 'color 0.15s',
                        }}
                      >
                        <OpenInNewIcon sx={{ fontSize: 11 }} />
                      </Box>
                    )}
                  </Box>

                  {/* Content info */}
                  <Box sx={{ p: 1 }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3, mb: 0.3 }} noWrap>
                      {title}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontSize: '0.58rem', color: dateColor, fontWeight: 600 }}>
                        {item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        {daysDiff < 0 && ` (${Math.abs(daysDiff)}d atrás)`}
                        {daysDiff === 0 && ' (hoje)'}
                      </Typography>
                      {status === 7 && (
                        <Typography sx={{ fontSize: '0.55rem' }}>🚀</Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}
      </DialogContent>

      {/* Month progress footer */}
      <Box sx={{
        px: 3, py: 1.5,
        borderTop: '1px solid rgba(255,255,255,0.05)',
        bgcolor: 'rgba(255,255,255,0.01)',
        display: 'flex', alignItems: 'center', gap: 2,
        flexShrink: 0,
      }}>
        <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
          Progresso do mês
        </Typography>
        <LinearProgress
          variant="determinate"
          value={stats.pct}
          sx={{
            flex: 1, height: 6, borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.06)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
              background: stats.pct >= 80
                ? '#00C47A'
                : stats.pct >= 50
                  ? '#F97316'
                  : '#FF4545',
            },
          }}
        />
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: stats.pct >= 80 ? '#00C47A' : stats.pct >= 50 ? '#ff9039' : '#FF4545', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {stats.pct}%
        </Typography>
      </Box>
    </Dialog>
  )
}
