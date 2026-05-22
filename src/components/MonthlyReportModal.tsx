import { useMemo, useRef, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, Box, Typography,
  LinearProgress, IconButton, Divider, Button, CircularProgress, Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import { toPng } from 'html-to-image'
import type { ContentItem, ItemState } from '../types'
import { STATUS_CONFIG } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
}

// Status 0–7 do sistema v2
const ALL_STATUSES = [0, 1, 2, 3, 4, 5, 6, 7] as const

export default function MonthlyReportModal({ open, onClose, items, states, now }: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!contentRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(contentRef.current, {
        backgroundColor: '#111',
        pixelRatio: 2,
        style: { borderRadius: '0' },
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `relatorio-${now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', '-')}.png`
      a.click()
    } catch {}
    finally { setExporting(false) }
  }

  const year  = now.getFullYear()
  const month = now.getMonth()

  const monthItems = useMemo(() =>
    items.filter(i => i.dt.getFullYear() === year && i.dt.getMonth() === month),
    [items, year, month])

  const global = useMemo(() => {
    const byStatus = ALL_STATUSES.map(s =>
      monthItems.filter(i => (states[i.i]?.status ?? i.s) === s).length
    )
    const total = monthItems.length
    // Status 7 = Publicado, status 5 = Aprovado pelo cliente
    const published    = byStatus[7]
    const approvedByClient = byStatus[5]
    const rejected     = byStatus[6]
    const publishRate  = total > 0 ? Math.round(((published + approvedByClient) / total) * 100) : 0
    const posts   = monthItems.filter(i => i.tp === 'Post').length
    const reels   = monthItems.filter(i => i.tp === 'Reel').length
    const stories = monthItems.filter(i => i.tp === 'Story').length
    return { byStatus, total, published, approvedByClient, rejected, publishRate, posts, reels, stories }
  }, [monthItems, states])

  const clientStats = useMemo(() => {
    const clients = Array.from(new Set(monthItems.map(i => i.c))).sort()
    return clients.map(client => {
      const clientItems = monthItems.filter(i => i.c === client)
      const byStatus = ALL_STATUSES.map(s =>
        clientItems.filter(i => (states[i.i]?.status ?? i.s) === s).length
      )
      const total = clientItems.length
      const published = byStatus[7]
      const approvedByClient = byStatus[5]
      const publishRate = total > 0 ? Math.round(((published + approvedByClient) / total) * 100) : 0
      return { client, byStatus, total, published, approvedByClient, publishRate }
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
        <Button
          size="small"
          startIcon={exporting ? <CircularProgress size={12} color="inherit" /> : <DownloadIcon sx={{ fontSize: 14 }} />}
          onClick={handleExport}
          disabled={exporting}
          sx={{ mr: 0.5, fontSize: '0.68rem', fontWeight: 600, color: 'primary.main', borderColor: 'rgba(255,144,57,0.35)', border: '1px solid' }}
        >
          {exporting ? 'Exportando…' : 'Baixar PNG'}
        </Button>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.disabled' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent ref={contentRef} sx={{ pt: 0 }}>

        {/* ── KPIs globais ── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.2, mb: 2 }}>
          {[
            { label: 'Total',          value: global.total,            color: '#ff9039' },
            { label: 'Publicados',     value: global.published,        color: '#00C47A' },
            { label: 'Aprovados cliente', value: global.approvedByClient, color: '#3B8EFF' },
            { label: 'Posts',          value: global.posts,            color: '#ff9039' },
            { label: 'Reels',          value: global.reels,            color: '#3B8EFF' },
            { label: 'Reprovados',     value: global.rejected,         color: global.rejected > 0 ? '#FF4545' : '#909090' },
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

        {/* ── Barra de progresso ── */}
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
              Taxa de conclusão (publicados + aprovados pelo cliente)
            </Typography>
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
                background: global.publishRate >= 75
                  ? 'linear-gradient(90deg,#00C47A,#3B8EFF)'
                  : global.publishRate >= 40 ? '#FFD700' : '#FF4545',
                borderRadius: 3,
              },
            }}
          />
        </Box>

        {/* ── Chips de status (todos os 8) ── */}
        <Box sx={{ display: 'flex', gap: 0.8, mb: 2.5, flexWrap: 'wrap' }}>
          {ALL_STATUSES.filter(s => global.byStatus[s] > 0).map(s => {
            const cfg = STATUS_CONFIG[s]
            return (
              <Tooltip key={s} title={cfg.label}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  bgcolor: `${cfg.color}10`, border: `1px solid ${cfg.color}28`,
                  borderRadius: 1.5, px: 1, py: 0.4,
                }}>
                  <Typography sx={{ fontSize: '0.72rem', lineHeight: 1 }}>{cfg.emoji}</Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: cfg.color, fontWeight: 700 }}>
                    {global.byStatus[s]}
                  </Typography>
                  <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>{cfg.label}</Typography>
                </Box>
              </Tooltip>
            )
          })}
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

              {/* Barra de status stacked */}
              <Box sx={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.06)', mb: 0.8 }}>
                {ALL_STATUSES.map(s => {
                  const pct = total > 0 ? (byStatus[s] / total) * 100 : 0
                  if (pct === 0) return null
                  return (
                    <Tooltip key={s} title={`${STATUS_CONFIG[s].label}: ${byStatus[s]}`}>
                      <Box sx={{ width: `${pct}%`, bgcolor: STATUS_CONFIG[s].color, transition: 'width 0.4s' }} />
                    </Tooltip>
                  )
                })}
              </Box>

              {/* Legenda inline */}
              <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                {ALL_STATUSES.filter(s => byStatus[s] > 0).map(s => (
                  <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: STATUS_CONFIG[s].color }} />
                    <Typography sx={{ fontSize: '0.56rem', color: 'text.disabled' }}>
                      {STATUS_CONFIG[s].label} {byStatus[s]}
                    </Typography>
                  </Box>
                ))}
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
