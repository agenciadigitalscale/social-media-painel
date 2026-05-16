import { useMemo } from 'react'
import {
  Box, Typography, Card, CardContent, LinearProgress,
  IconButton, Tooltip, Chip, Paper, Divider,
} from '@mui/material'
import TableChartIcon from '@mui/icons-material/TableChart'
import DescriptionIcon from '@mui/icons-material/Description'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import type { ItemState } from '../types'
import { CLIENTS, DATA } from '../data'
import HintCard from './HintCard'

interface Props {
  states: Record<number, ItemState>
}

export default function ClientsTab({ states }: Props) {
  const clientStats = useMemo(() => {
    return CLIENTS.map(client => {
      const items  = DATA.filter(i => i.c === client.name)
      const posts  = items.filter(i => i.tp === 'Post')
      const reels  = items.filter(i => i.tp === 'Reel')
      const postsPublished = posts.filter(i => (states[i.i]?.status ?? i.s) === 3).length
      const reelsPublished = reels.filter(i => (states[i.i]?.status ?? i.s) === 3).length
      const total    = posts.length + reels.length
      const totalDone = postsPublished + reelsPublished
      const pct = total > 0 ? Math.round((totalDone / total) * 100) : 0
      return {
        ...client,
        postsTotal: posts.length || client.postsPerMonth,
        reelsTotal: reels.length || client.reelsPerMonth,
        postsPublished,
        reelsPublished,
        totalDone,
        total,
        pct,
      }
    }).sort((a, b) => a.pct - b.pct)
  }, [states])

  const globalStats = useMemo(() => {
    const total = clientStats.reduce((s, c) => s + c.total, 0)
    const done  = clientStats.reduce((s, c) => s + c.totalDone, 0)
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
  }, [clientStats])

  const done100  = clientStats.filter(c => c.pct === 100).length
  const inProgress = clientStats.filter(c => c.pct > 0 && c.pct < 100).length
  const notStarted = clientStats.filter(c => c.pct === 0).length

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* ── Global summary ────────────────────────────── */}
      <Paper sx={{ p: 2, border: '1px solid rgba(255,144,57,0.15)', background: 'linear-gradient(135deg, #1a1a1a, #1c1408)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <TrendingUpIcon sx={{ color: 'primary.main', fontSize: 18 }} />
          <Typography variant="subtitle2" fontWeight={700}>Progresso Geral — Maio 2026</Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 1.5 }}>
          {[
            { label: 'Concluídos', value: done100,    color: 'success.main' },
            { label: 'Em andamento', value: inProgress, color: 'warning.main' },
            { label: 'Não iniciados', value: notStarted, color: 'error.main' },
          ].map(s => (
            <Box key={s.label} sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: s.color, lineHeight: 1 }}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.58rem' }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Total do mês</Typography>
          <Typography variant="caption" fontWeight={700} color={globalStats.pct === 100 ? 'success.main' : 'primary.main'}>
            {globalStats.done}/{globalStats.total} · {globalStats.pct}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={globalStats.pct}
          color={globalStats.pct === 100 ? 'success' : 'primary'}
          sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.06)' }}
        />
      </Paper>

      <HintCard text="Clientes ordenados do menos concluído para o mais concluído. Toque nos ícones para abrir planilha ou roteiro no Drive." />

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

      <Typography variant="overline" color="primary.main" fontWeight={700} sx={{ letterSpacing: 1 }}>
        {CLIENTS.length} Clientes Ativos
      </Typography>

      {/* ── Client grid ───────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
        {clientStats.map(client => {
          const postPct = client.postsTotal > 0 ? Math.round((client.postsPublished / client.postsTotal) * 100) : 0
          const reelPct = client.reelsTotal > 0 ? Math.round((client.reelsPublished / client.reelsTotal) * 100) : 0
          const statusColor = client.pct === 100 ? 'success' : client.pct >= 50 ? 'warning' : 'error'

          return (
            <Card
              key={client.name}
              sx={{
                border: '1px solid',
                borderColor: client.pct === 100 ? 'rgba(0,196,122,0.25)' : 'rgba(255,255,255,0.05)',
                position: 'relative',
                overflow: 'visible',
              }}
            >
              {/* % badge */}
              <Chip
                label={`${client.pct}%`}
                size="small"
                color={statusColor}
                sx={{
                  position: 'absolute',
                  top: -8,
                  right: 8,
                  height: 18,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                }}
              />

              <CardContent sx={{ p: 1.2, '&:last-child': { pb: 1.2 } }}>
                {/* Name + links */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.8 }}>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    sx={{ flex: 1, mr: 0.5, fontSize: '0.65rem', lineHeight: 1.3 }}
                  >
                    {client.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.2 }}>
                    {client.sheetUrl && (
                      <Tooltip title="Planilha Drive">
                        <IconButton size="small" component="a" href={client.sheetUrl} target="_blank" rel="noopener" sx={{ p: 0.3 }}>
                          <TableChartIcon sx={{ fontSize: 13, color: 'primary.main' }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {client.scriptUrl && (
                      <Tooltip title="Roteiro Drive">
                        <IconButton size="small" component="a" href={client.scriptUrl} target="_blank" rel="noopener" sx={{ p: 0.3 }}>
                          <DescriptionIcon sx={{ fontSize: 13, color: 'info.main' }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>

                {/* Posts bar */}
                <Box sx={{ mb: 0.6 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                    <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Posts</Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: postPct === 100 ? 'success.main' : 'text.secondary', fontWeight: 700 }}>
                      {client.postsPublished}/{client.postsTotal}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={postPct}
                    color={postPct === 100 ? 'success' : 'primary'}
                    sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)' }}
                  />
                </Box>

                {/* Reels bar */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                    <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Reels</Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: reelPct === 100 ? 'success.main' : 'text.secondary', fontWeight: 700 }}>
                      {client.reelsPublished}/{client.reelsTotal}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={reelPct}
                    color={reelPct === 100 ? 'success' : 'secondary'}
                    sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)' }}
                  />
                </Box>
              </CardContent>
            </Card>
          )
        })}
      </Box>

      <HintCard text="As barras de progresso atualizam em tempo real conforme você marca conteúdos como Publicado na aba Hoje ou Agenda." />
    </Box>
  )
}
