import { useMemo, useState } from 'react'
import {
  Box, Dialog, IconButton, Typography, Chip, ToggleButtonGroup, ToggleButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import type { ContentItem, ItemState } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  items: ContentItem[]
  states: Record<number, ItemState>
  clientColors?: Record<string, string>
}

const STATUS_LABEL = ['Pendente', 'Em edição', 'Aprovado', 'Publicado', 'Reprovado']
const STATUS_COLOR = ['#909090', '#FFD700', '#3B8EFF', '#00C47A', '#FF4545']
const TYPE_COLOR: Record<string, string> = { Post: '#ff9039', Reel: '#3B8EFF', Story: '#b45aff' }

function extractDriveFileId(url: string): string | null {
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (m1) return m1[1]
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (m2) return m2[1]
  return null
}

export default function PresentationMode({ open, onClose, items, states, clientColors }: Props) {
  const clients = useMemo(() => Array.from(new Set(items.map(i => i.c))).sort(), [items])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'published'>('all')

  const client = selectedClient || clients[0] || ''

  const filtered = useMemo(() => {
    return items
      .filter(i => i.c === client)
      .filter(i => {
        const st = states[i.i]?.status ?? i.s
        if (filterStatus === 'approved')  return st === 2 || st === 3
        if (filterStatus === 'published') return st === 3
        return true
      })
      .sort((a, b) => a.dt.getTime() - b.dt.getTime())
  }, [items, states, client, filterStatus])

  const clientColor = clientColors?.[client] ?? '#ff9039'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{ sx: { bgcolor: '#080808', backgroundImage: 'none' } }}
    >
      {/* ── Header ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2,
        px: 4, py: 2.5,
        borderBottom: `1px solid ${clientColor}30`,
        background: `linear-gradient(135deg, #0f0f0f 0%, ${clientColor}08 100%)`,
        flexWrap: 'wrap',
      }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 1, mb: 0.2 }}>
            Modo Apresentação
          </Typography>
          <Typography sx={{ fontWeight: 900, fontSize: '1.4rem', color: clientColor, lineHeight: 1.1 }} noWrap>
            {client}
          </Typography>
        </Box>

        {/* Client selector */}
        <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', maxWidth: { xs: '100%', md: '55%' } }}>
          {clients.map(c => (
            <Chip
              key={c}
              label={c}
              size="small"
              onClick={() => setSelectedClient(c)}
              variant={c === client ? 'filled' : 'outlined'}
              sx={{
                fontSize: '0.6rem', height: 22, cursor: 'pointer',
                bgcolor: c === client ? `${clientColors?.[c] ?? '#ff9039'}22` : 'transparent',
                borderColor: c === client ? (clientColors?.[c] ?? '#ff9039') : 'rgba(255,255,255,0.15)',
                color: c === client ? (clientColors?.[c] ?? '#ff9039') : 'text.secondary',
                fontWeight: c === client ? 700 : 400,
              }}
            />
          ))}
        </Box>

        {/* Status filter */}
        <ToggleButtonGroup size="small" value={filterStatus} exclusive onChange={(_, v) => v && setFilterStatus(v)}>
          <ToggleButton value="all"       sx={{ fontSize: '0.62rem', px: 1.5, py: 0.4 }}>Todos</ToggleButton>
          <ToggleButton value="approved"  sx={{ fontSize: '0.62rem', px: 1.5, py: 0.4 }}>Aprovados+</ToggleButton>
          <ToggleButton value="published" sx={{ fontSize: '0.62rem', px: 1.5, py: 0.4 }}>Publicados</ToggleButton>
        </ToggleButtonGroup>

        <IconButton onClick={onClose} sx={{ color: 'text.disabled' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* ── Stats bar ── */}
      <Box sx={{ display: 'flex', gap: 3, px: 4, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {[
          { label: 'Total', value: filtered.length, color: clientColor },
          { label: 'Publicados', value: filtered.filter(i => (states[i.i]?.status ?? i.s) === 3).length, color: '#00C47A' },
          { label: 'Aprovados', value: filtered.filter(i => (states[i.i]?.status ?? i.s) === 2).length, color: '#3B8EFF' },
          { label: 'Posts', value: filtered.filter(i => i.tp === 'Post').length, color: '#ff9039' },
          { label: 'Reels', value: filtered.filter(i => i.tp === 'Reel').length, color: '#3B8EFF' },
          { label: 'Stories', value: filtered.filter(i => i.tp === 'Story').length, color: '#b45aff' },
        ].map(({ label, value, color }) => (
          <Box key={label} sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color, lineHeight: 1 }}>{value}</Typography>
            <Typography sx={{ fontSize: '0.52rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</Typography>
          </Box>
        ))}
      </Box>

      {/* ── Grid ── */}
      <Box sx={{
        flex: 1, overflowY: 'auto', p: 3,
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(5, 1fr)', xl: 'repeat(6, 1fr)' },
        gap: 1.5,
        alignContent: 'start',
      }}>
        {filtered.map(item => {
          const st = states[item.i]?.status ?? item.s
          const fileId = states[item.i]?.link ? extractDriveFileId(states[item.i].link) : null
          const title = states[item.i]?.title || item.n

          return (
            <Box key={item.i} sx={{
              borderRadius: 2.5,
              border: `1px solid ${STATUS_COLOR[st]}25`,
              bgcolor: `${STATUS_COLOR[st]}06`,
              overflow: 'hidden',
              transition: 'transform 0.18s, box-shadow 0.18s',
              '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 8px 24px ${STATUS_COLOR[st]}20` },
            }}>
              {/* Thumbnail */}
              <Box sx={{
                width: '100%', aspectRatio: item.tp === 'Story' ? '9/16' : '1/1',
                bgcolor: 'rgba(255,255,255,0.03)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', position: 'relative',
              }}>
                {fileId ? (
                  <Box
                    component="img"
                    src={`https://drive.google.com/thumbnail?id=${fileId}&sz=w300`}
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none' }}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Typography sx={{ fontSize: '1.8rem', opacity: 0.15 }}>
                    {item.tp === 'Reel' ? '🎬' : item.tp === 'Story' ? '📱' : '🖼️'}
                  </Typography>
                )}
                {/* Status badge top-right */}
                <Box sx={{
                  position: 'absolute', top: 6, right: 6,
                  width: 8, height: 8, borderRadius: '50%',
                  bgcolor: STATUS_COLOR[st],
                  boxShadow: `0 0 6px ${STATUS_COLOR[st]}`,
                }} />
                {/* Type badge bottom-left */}
                <Box sx={{
                  position: 'absolute', bottom: 6, left: 6,
                  px: 0.8, py: 0.2, borderRadius: 1,
                  bgcolor: `${TYPE_COLOR[item.tp]}22`,
                  border: `1px solid ${TYPE_COLOR[item.tp]}44`,
                }}>
                  <Typography sx={{ fontSize: '0.48rem', color: TYPE_COLOR[item.tp], fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {item.tp}
                  </Typography>
                </Box>
              </Box>

              {/* Info */}
              <Box sx={{ p: 1 }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.3, mb: 0.4 }} noWrap>
                  {title}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>
                    {item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </Typography>
                  <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: STATUS_COLOR[st] }}>
                    {STATUS_LABEL[st]}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )
        })}

        {filtered.length === 0 && (
          <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 8 }}>
            <Typography sx={{ color: 'text.disabled', fontSize: '0.9rem' }}>Nenhum conteúdo para exibir</Typography>
          </Box>
        )}
      </Box>
    </Dialog>
  )
}
