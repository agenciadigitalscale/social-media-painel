import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, Divider, LinearProgress, Chip,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ShareIcon from '@mui/icons-material/Share'
import AssessmentIcon from '@mui/icons-material/Assessment'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import type { Client, ContentItem, ItemState } from '../types'

interface ClientReport {
  name: string
  posts: number
  reels: number
  postsPublished: number
  reelsPublished: number
  total: number
  done: number
  late: number
  pct: number
}

interface Props {
  open: boolean
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  now: Date
  onClose: () => void
}

export default function MonthlyReportModal({ open, items, states, allClients, now, onClose }: Props) {
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const monthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const reports: ClientReport[] = allClients.map(client => {
    const ci = items.filter(i => i.c === client.name)
    const posts = ci.filter(i => i.tp === 'Post')
    const reels = ci.filter(i => i.tp === 'Reel')
    const postsPublished = posts.filter(i => (states[i.i]?.status ?? i.s) === 3).length
    const reelsPublished = reels.filter(i => (states[i.i]?.status ?? i.s) === 3).length
    const late = ci.filter(i => (states[i.i]?.status ?? i.s) < 3 && i.dt < today).length
    const total = posts.length + reels.length
    const done = postsPublished + reelsPublished
    return {
      name: client.name,
      posts: posts.length, reels: reels.length,
      postsPublished, reelsPublished,
      total, done, late,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
    }
  }).sort((a, b) => a.pct - b.pct)

  const totalItems     = reports.reduce((s, r) => s + r.total, 0)
  const totalDone      = reports.reduce((s, r) => s + r.done, 0)
  const totalLate      = reports.reduce((s, r) => s + r.late, 0)
  const globalPct      = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0
  const complete       = reports.filter(r => r.pct === 100).length

  const buildText = () => {
    const lines = [
      `📊 *Relatório — ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}*`,
      `Digital Scale — Social Media`,
      '',
      `✅ Publicados: ${totalDone}/${totalItems} (${globalPct}%)`,
      totalLate ? `⚠️ Atrasados: ${totalLate}` : `🏆 Sem atrasos!`,
      `🏁 Clientes 100%: ${complete}/${reports.length}`,
      '',
      '─────────────────',
    ]
    reports.forEach(r => {
      const bar = r.pct === 100 ? '✅' : r.pct >= 50 ? '🟡' : r.late > 0 ? '🔴' : '⚪'
      lines.push(`${bar} *${r.name}*`)
      lines.push(`   Posts: ${r.postsPublished}/${r.posts} · Reels: ${r.reelsPublished}/${r.reels} · ${r.pct}%`)
      if (r.late > 0) lines.push(`   ⚠️ ${r.late} atrasado${r.late > 1 ? 's' : ''}`)
    })
    return lines.join('\n')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(buildText())
  }

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildText())}`, '_blank')
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(255,144,57,0.2)', borderRadius: 3, maxHeight: '90vh' } }}
    >
      <DialogTitle sx={{ pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssessmentIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Relatório Mensal</Typography>
            <Typography variant="caption" color="primary.main" fontWeight={600}>
              {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <Divider sx={{ opacity: 0.1 }} />

      <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

        {/* ── Resumo global ── */}
        <Box sx={{ p: 1.5, borderRadius: 2, background: 'linear-gradient(135deg,#1a1a1a,#1c1408)', border: '1px solid rgba(255,144,57,0.15)' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 1.2 }}>
            {[
              { label: 'Publicados', value: `${totalDone}/${totalItems}`, color: 'success.main' },
              { label: 'Progresso',  value: `${globalPct}%`,             color: globalPct === 100 ? 'success.main' : 'primary.main' },
              { label: 'Atrasados',  value: totalLate,                    color: totalLate > 0 ? 'error.main' : 'success.main' },
            ].map(s => (
              <Box key={s.label} sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: s.color, lineHeight: 1 }}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem', textTransform: 'uppercase' }}>{s.label}</Typography>
              </Box>
            ))}
          </Box>
          <LinearProgress variant="determinate" value={globalPct} color={globalPct === 100 ? 'success' : 'primary'} sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)' }} />
        </Box>

        {/* ── Por cliente ── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
          {reports.map(r => (
            <Box key={r.name} sx={{
              p: 1.2, borderRadius: 2,
              border: '1px solid',
              borderColor: r.pct === 100 ? 'rgba(0,196,122,0.2)' : r.late > 0 ? 'rgba(255,69,69,0.2)' : 'rgba(255,255,255,0.06)',
              bgcolor: r.pct === 100 ? 'rgba(0,196,122,0.03)' : r.late > 0 ? 'rgba(255,69,69,0.03)' : 'transparent',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.6 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  {r.pct === 100
                    ? <CheckCircleIcon sx={{ fontSize: 13, color: 'success.main' }} />
                    : r.late > 0
                      ? <WarningAmberIcon sx={{ fontSize: 13, color: 'error.main' }} />
                      : <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)' }} />
                  }
                  <Typography sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{r.name}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {r.late > 0 && <Chip label={`${r.late} atras.`} size="small" color="error" variant="outlined" sx={{ fontSize: '0.5rem', height: 14 }} />}
                  <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', color: r.pct === 100 ? 'success.main' : 'primary.main', minWidth: 32, textAlign: 'right' }}>{r.pct}%</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                  Posts: <strong style={{ color: '#ff9039' }}>{r.postsPublished}/{r.posts}</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                  Reels: <strong style={{ color: '#3B8EFF' }}>{r.reelsPublished}/{r.reels}</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                  Total: <strong>{r.done}/{r.total}</strong>
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={r.pct}
                color={r.pct === 100 ? 'success' : r.late > 0 ? 'error' : 'primary'}
                sx={{ height: 3, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)' }}
              />
            </Box>
          ))}
        </Box>
      </DialogContent>

      <Divider sx={{ opacity: 0.1 }} />

      <DialogActions sx={{ px: 2, py: 1, gap: 0.8 }}>
        <Button size="small" startIcon={<ContentCopyIcon />} onClick={handleCopy} sx={{ fontSize: '0.65rem' }}>
          Copiar
        </Button>
        <Button size="small" startIcon={<ShareIcon />} onClick={handleWhatsApp} sx={{ fontSize: '0.65rem', color: '#25D366' }}>
          WhatsApp
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  )
}
