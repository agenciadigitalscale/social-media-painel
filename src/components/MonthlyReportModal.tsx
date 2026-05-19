import { useMemo } from 'react'
import {
  Dialog, DialogTitle, DialogContent, Box, Typography,
  LinearProgress, IconButton, Divider,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import type { ContentItem, ItemState } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
}

const STATUS_LABEL = ['Pendente', 'Em edição', 'Aprovado', 'Publicado', 'Reprovado']
const STATUS_COLOR = ['#909090', '#FFD700', '#3B8EFF', '#00C47A', '#FF4545']

export default function MonthlyReportModal({ open, onClose, items, states, now }: Props) {
  const year  = now.getFullYear()
  const month = now.getMonth()

  const monthItems = useMemo(() =>
    items.filter(i => i.dt.getFullYear() === year && i.dt.getMonth() === month),
    [items, year, month])

  const global = useMemo(() => {
    const byStatus = [0, 1, 2, 3, 4].map(s =>
      monthItems.filter(i => (states[i.i]?.status ?? i.s) === s).length
    )
    const total = monthItems.length
    const published = byStatus[3]
    const publishRate = total > 0 ? Math.round((published / total) * 100) : 0
    const posts = monthItems.filter(i => i.tp === 'Post').length
    const reels = monthItems.filter(i => i.tp === 'Reel').length
    const stories = monthItems.filter(i => i.tp === 'Story').length
    return { byStatus, total, published, publishRate, posts, reels, stories }
  }, [monthItems, states])

  const clientStats = useMemo(() => {
    const clients = Array.from(new Set(monthItems.map(i => i.c))).sort()
    return clients.map(client => {
      const clientItems = monthItems.filter(i => i.c === client)
      const byStatus = [0, 1, 2, 3, 4].map(s =>
        clientItems.filter(i => (states[i.i]?.status ?? i.s) === s).length
      )
      const total = clientItems.length
      const published = byStatus[3]
      const publishRate = total > 0 ? Math.round((published / total) * 100) : 0
      return { client, byStatus, total, published, publishRate }
    }).sort((a, b) => b.publishRate - a.publishRate)
  }, [monthItems, states])

  const monthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#111',
          border: '1px solid rgba(255,144,57,0.15)',
          borderRadius: 3,
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', pb: 1.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography fontWeight={900} sx={{ fontSize: '1.1rem', color: 'primary.main' }}>
            Relatório Mensal
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', textTransform: 'capitalize' }}>
            {monthLabel}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.disabled' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.2, mb: 2 }}>
          {[
            { label: 'Total', value: global.total, color: '#ff9039' },
            { label: 'Publicados', value: global.published, color: '#00C47A' },
            { label: 'Tx. publicação', value: `${global.publishRate}%`, color: global.publishRate >= 75 ? '#00C47A' : global.publishRate >= 40 ? '#FFD700' : '#FF4545' },
            { label: 'Posts', value: global.posts, color: '#ff9039' },
            { label: 'Reels', value: global.reels, color: '#3B8EFF' },
            { label: 'Stories', value: global.stories, color: '#b45aff' },
          ].map(({ label, value, color }) => (
            <Box key={label} sx={{
              bgcolor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 2, p: 1.5, textAlign: 'center',
            }}>
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, color, lineHeight: 1 }}>
                {value}
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', mt: 0.4, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>Taxa de publicação global</Typography>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: global.publishRate >= 75 ? '#00C47A' : global.publishRate >= 40 ? '#FFD700' : '#FF4545' }}>
              {global.publishRate}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={global.publishRate}
            sx={{
              height: 6, borderRadius: 3,
              bgcolor: 'rgba(255,255,255,0.08)',
              '& .MuiLinearProgress-bar': {
                bgcolor: global.publishRate >= 75 ? '#00C47A' : global.publishRate >= 40 ? '#FFD700' : '#FF4545',
                borderRadius: 3,
              },
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
          {STATUS_LABEL.map((label, s) => (
            <Box key={s} sx={{
              display: 'flex', alignItems: 'center', gap: 0.6,
              bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 1.5, px: 1.2, py: 0.5,
            }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: STATUS_COLOR[s], flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{label}</Typography>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: STATUS_COLOR[s] }}>
                {global.byStatus[s]}
              </Typography>
            </Box>
          ))}
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Por cliente ({clientStats.length})
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {clientStats.map(({ client, byStatus, total, publishRate }) => (
            <Box key={client} sx={{
              bgcolor: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 2, p: 1.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, flex: 1 }} noWrap>{client}</Typography>
                <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{total} itens</Typography>
                <Typography sx={{
                  fontSize: '0.72rem', fontWeight: 800, minWidth: 38, textAlign: 'right',
                  color: publishRate >= 75 ? '#00C47A' : publishRate >= 40 ? '#FFD700' : '#FF4545',
                }}>
                  {publishRate}%
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.06)', mb: 0.8 }}>
                {[0, 1, 2, 3, 4].map(s => {
                  const pct = total > 0 ? (byStatus[s] / total) * 100 : 0
                  if (pct === 0) return null
                  return (
                    <Box key={s} sx={{ width: `${pct}%`, bgcolor: STATUS_COLOR[s] }} />
                  )
                })}
              </Box>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {[0, 1, 2, 3, 4].map(s => byStatus[s] > 0 ? (
                  <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: STATUS_COLOR[s] }} />
                    <Typography sx={{ fontSize: '0.56rem', color: 'text.disabled' }}>
                      {STATUS_LABEL[s]} {byStatus[s]}
                    </Typography>
                  </Box>
                ) : null)}
              </Box>
            </Box>
          ))}
        </Box>

        {clientStats.length === 0 && (
          <Typography sx={{ color: 'text.disabled', textAlign: 'center', py: 4, fontSize: '0.85rem' }}>
            Nenhum conteúdo neste mês.
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  )
}
