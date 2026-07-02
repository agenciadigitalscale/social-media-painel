import { useMemo, useState } from 'react'
import {
  Dialog, Box, Typography, IconButton, LinearProgress,
  Chip, Divider, Paper, Button, Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ImageIcon from '@mui/icons-material/Image'
import MovieIcon from '@mui/icons-material/Movie'
import FavoriteIcon from '@mui/icons-material/Favorite'
import type { Client, ContentItem, ItemEditPatch, ItemState, Status } from '../types'
import ContentCard from './ContentCard'
import HealthUpdateModal from './HealthUpdateModal'
import { loadHealth, classifyHealth, HEALTH_CLASSES } from '../lib/health'

interface Props {
  client: Client | null
  items: ContentItem[]
  states: Record<number, ItemState>
  clientFolders: Record<string, string>
  clientColors: Record<string, string>
  onClose: () => void
  onStatusChange: (id: number, s: Status) => void
  onUpdate: (id: number, patch: Partial<ItemState>) => void
  onDelete?: (id: number) => void
  onEdit?: (id: number, patch: ItemEditPatch) => void
  onDuplicate?: (id: number) => void
  now: Date
  currentUser?: string
}

export default function ClientFocusModal({
  client, items, states, clientFolders, clientColors,
  onClose, onStatusChange, onUpdate, onDelete, onEdit, onDuplicate, now, currentUser,
}: Props) {
  const today = useMemo(() => { const d = new Date(now); d.setHours(0,0,0,0); return d }, [now])
  const [healthOpen, setHealthOpen] = useState(false)
  const [healthVersion, setHealthVersion] = useState(0)
  const health = useMemo(
    () => (client ? loadHealth()[client.name] ?? null : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, healthVersion],
  )

  const clientItems = useMemo(() =>
    items.filter(i => i.c === client?.name).sort((a, b) => a.dt.getTime() - b.dt.getTime()),
    [items, client])

  const stats = useMemo(() => {
    const total     = clientItems.length
    const published = clientItems.filter(i => (states[i.i]?.status ?? i.s) === 3).length
    const editing   = clientItems.filter(i => (states[i.i]?.status ?? i.s) === 1).length
    const approved  = clientItems.filter(i => (states[i.i]?.status ?? i.s) === 2).length
    const late      = clientItems.filter(i => (states[i.i]?.status ?? i.s) < 3 && i.dt < today).length
    const posts     = clientItems.filter(i => i.tp === 'Post')
    const reels     = clientItems.filter(i => i.tp === 'Reel')
    const pct       = total > 0 ? Math.round((published / total) * 100) : 0
    return { total, published, editing, approved, late, posts, reels, pct }
  }, [clientItems, states, today])

  if (!client) return null
  const color = clientColors[client.name] ?? '#ff9039'
  const driveUrl = clientFolders[client.name]

  return (
    <Dialog
      open={Boolean(client)}
      onClose={onClose}
      fullScreen
      slotProps={{
        paper: {
          sx: {
            background: '#090909',
            backgroundImage: `radial-gradient(circle at 80% 10%, ${color}12 0%, transparent 50%)`,
          },
        },
      }}
    >
      {/* ── Header ── */}
      <Box sx={{
        px: { xs: 2, md: 4 }, py: 2.5,
        borderBottom: `1px solid ${color}25`,
        background: `linear-gradient(135deg, #141414 0%, ${color}10 100%)`,
        display: 'flex', alignItems: 'center', gap: 2,
      }}>
        {/* Color badge */}
        <Box sx={{
          width: 48, height: 48, borderRadius: 2.5, flexShrink: 0,
          background: `linear-gradient(135deg, ${color} 0%, ${color}88 100%)`,
          boxShadow: `0 4px 20px ${color}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: '#000' }}>
            {client.name.charAt(0).toUpperCase()}
          </Typography>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" fontWeight={900} sx={{ color, lineHeight: 1.1 }} noWrap>
            {client.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {client.postsPerMonth} posts · {client.reelsPerMonth} reels · {stats.total} conteúdos no mês
          </Typography>
        </Box>

        {/* Saúde do cliente */}
        {health && (
          <Tooltip title={`Health Score — ${HEALTH_CLASSES[classifyHealth(health.score)].label}`} placement="bottom">
            <Chip
              label={`${HEALTH_CLASSES[classifyHealth(health.score)].emoji} ${health.score}`}
              size="small"
              sx={{
                fontWeight: 800, fontSize: '0.72rem',
                bgcolor: `${HEALTH_CLASSES[classifyHealth(health.score)].color}14`,
                color: HEALTH_CLASSES[classifyHealth(health.score)].color,
                border: `1px solid ${HEALTH_CLASSES[classifyHealth(health.score)].color}40`,
              }}
            />
          </Tooltip>
        )}
        <Button
          size="small"
          startIcon={<FavoriteIcon sx={{ fontSize: 13 }} />}
          onClick={() => setHealthOpen(true)}
          variant="outlined"
          sx={{
            borderColor: 'rgba(251,113,133,0.35)', color: '#FB7185',
            fontSize: '0.66rem', fontWeight: 700, whiteSpace: 'nowrap',
            '&:hover': { borderColor: '#FB7185', bgcolor: 'rgba(251,113,133,0.08)' },
          }}
        >
          Atualizar Satisfação
        </Button>

        {driveUrl && (
          <Button
            size="small"
            startIcon={<OpenInNewIcon />}
            component="a"
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            sx={{ borderColor: `${color}40`, color, '&:hover': { borderColor: color } }}
          >
            Drive
          </Button>
        )}
        <IconButton onClick={onClose} sx={{ flexShrink: 0 }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* ── Body ── */}
      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 2, md: 4 } }}>

        {/* Stats row */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(4,1fr)' }, gap: 1.5, mb: 3 }}>
          {[
            { label: 'Publicados', value: stats.published, sub: `de ${stats.total}`, color: 'success.main' },
            { label: 'Aprovados',  value: stats.approved,  sub: 'prontos',           color: 'info.main'    },
            { label: 'Em edição',  value: stats.editing,   sub: 'em andamento',      color: 'warning.main' },
            { label: 'Atrasados',  value: stats.late,      sub: 'fora do prazo',     color: stats.late > 0 ? 'error.main' : 'text.secondary' },
          ].map(s => (
            <Paper key={s.label} sx={{
              p: 2, textAlign: 'center',
              border: `1px solid ${s.label === 'Atrasados' && stats.late > 0 ? 'rgba(255,69,69,0.2)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 2.5,
            }}>
              <Typography sx={{ fontWeight: 900, fontSize: '2rem', color: s.color, lineHeight: 1 }}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{s.label}</Typography>
              <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', display: 'block' }}>{s.sub}</Typography>
            </Paper>
          ))}
        </Box>

        {/* Progress bar */}
        <Paper sx={{ p: 2.5, mb: 3, border: `1px solid ${color}20`, borderRadius: 2.5, background: `linear-gradient(135deg, #1a1a1a, ${color}08)` }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography fontWeight={800} sx={{ fontSize: '0.85rem' }}>Progresso do mês</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: '1.6rem', color, lineHeight: 1 }}>{stats.pct}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={stats.pct}
            sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.06)',
              '& .MuiLinearProgress-bar': { background: `linear-gradient(90deg, ${color}, ${color}bb)`, borderRadius: 4 } }}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 2 }}>
            {[
              { icon: <ImageIcon sx={{ fontSize: 14, color }} />, label: 'Posts', items: stats.posts },
              { icon: <MovieIcon sx={{ fontSize: 14, color: 'info.main' }} />, label: 'Reels', items: stats.reels },
            ].map(t => {
              const done = t.items.filter(i => (states[i.i]?.status ?? i.s) === 3).length
              const pct  = t.items.length > 0 ? Math.round((done / t.items.length) * 100) : 0
              return (
                <Box key={t.label} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.8 }}>
                    {t.icon}
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.label}</Typography>
                    <Typography sx={{ ml: 'auto', fontWeight: 800, fontSize: '0.85rem' }}>{done}/{t.items.length}</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={pct}
                    sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)' }} />
                </Box>
              )
            })}
          </Box>
        </Paper>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2.5 }}>
          <Chip label={`${clientItems.length} conteúdos`} size="small" sx={{ fontSize: '0.6rem' }} />
        </Divider>

        {/* Sections: late + upcoming */}
        {stats.late > 0 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <WarningAmberIcon sx={{ fontSize: 16, color: 'error.main' }} />
              <Typography variant="overline" color="error.main" fontWeight={700} sx={{ letterSpacing: 1, fontSize: '0.65rem' }}>
                Atrasados ({stats.late})
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { md: '1fr 1fr', lg: 'repeat(3,1fr)', xl: 'repeat(4,1fr)' }, gap: 1 }}>
              {clientItems.filter(i => (states[i.i]?.status ?? i.s) < 3 && i.dt < today).map(item => (
                <ContentCard key={item.i} item={item}
                  state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }}
                  onStatusChange={onStatusChange} onUpdate={onUpdate}
                  onDelete={onDelete} onEdit={onEdit} onDuplicate={onDuplicate}
                />
              ))}
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <CheckCircleIcon sx={{ fontSize: 16, color }} />
          <Typography variant="overline" fontWeight={700} sx={{ letterSpacing: 1, fontSize: '0.65rem', color }}>
            Todos os conteúdos
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { md: '1fr 1fr', lg: 'repeat(3,1fr)', xl: 'repeat(4,1fr)' }, gap: 1 }}>
          {clientItems.filter(i => !((states[i.i]?.status ?? i.s) < 3 && i.dt < today)).map(item => (
            <ContentCard key={item.i} item={item}
              state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }}
              onStatusChange={onStatusChange} onUpdate={onUpdate}
              onDelete={onDelete} onEdit={onEdit} onDuplicate={onDuplicate}
            />
          ))}
        </Box>
      </Box>

      {/* Modal de satisfação */}
      <HealthUpdateModal
        clientName={healthOpen ? client.name : null}
        currentUser={currentUser ?? ''}
        onClose={() => setHealthOpen(false)}
        onSaved={() => setHealthVersion(v => v + 1)}
      />
    </Dialog>
  )
}
