import { useMemo } from 'react'
import {
  Box, Typography, Paper, LinearProgress, Chip, Divider,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import MovieIcon from '@mui/icons-material/Movie'
import ImageIcon from '@mui/icons-material/Image'
import type { Client, ContentItem, ItemState } from '../types'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  now: Date
}

export default function KaiqueTab({ items, states, allClients, now }: Props) {
  const today = useMemo(() => { const d = new Date(now); d.setHours(0,0,0,0); return d }, [now])

  const lastDayOfMonth = useMemo(() => new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), [now])
  const daysLeft = lastDayOfMonth - now.getDate()
  const monthPct = Math.round((now.getDate() / lastDayOfMonth) * 100)

  const global = useMemo(() => {
    const total     = items.length
    const published = items.filter(i => (states[i.i]?.status ?? i.s) === 3).length
    const editing   = items.filter(i => (states[i.i]?.status ?? i.s) === 1).length
    const approved  = items.filter(i => (states[i.i]?.status ?? i.s) === 2).length
    const late      = items.filter(i => (states[i.i]?.status ?? i.s) < 3 && i.dt < today).length
    const posts     = items.filter(i => i.tp === 'Post').length
    const reels     = items.filter(i => i.tp === 'Reel').length
    const postsPublished = items.filter(i => i.tp === 'Post' && (states[i.i]?.status ?? i.s) === 3).length
    const reelsPublished = items.filter(i => i.tp === 'Reel' && (states[i.i]?.status ?? i.s) === 3).length
    const pct = total > 0 ? Math.round((published / total) * 100) : 0
    return { total, published, editing, approved, late, posts, reels, postsPublished, reelsPublished, pct }
  }, [items, states, today])

  const clientStats = useMemo(() => allClients.map(client => {
    const ci        = items.filter(i => i.c === client.name)
    const total     = ci.length
    const published = ci.filter(i => (states[i.i]?.status ?? i.s) === 3).length
    const late      = ci.filter(i => (states[i.i]?.status ?? i.s) < 3 && i.dt < today).length
    const pct       = total > 0 ? Math.round((published / total) * 100) : 0
    return { name: client.name, total, published, late, pct }
  }).sort((a, b) => a.pct - b.pct), [allClients, items, states, today])

  const complete    = clientStats.filter(c => c.pct === 100).length
  const withLate    = clientStats.filter(c => c.late > 0).length
  const notStarted  = clientStats.filter(c => c.pct === 0).length

  const todayItems  = useMemo(() => {
    const tomorrow = new Date(today.getTime() + 86_400_000)
    return items.filter(i => i.dt >= today && i.dt < tomorrow)
  }, [items, today])
  const todayDone = todayItems.filter(i => (states[i.i]?.status ?? i.s) === 3).length

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* ── Cabeçalho ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
        <TrendingUpIcon sx={{ color: 'primary.main', fontSize: 18 }} />
        <Typography variant="subtitle2" fontWeight={700}>Visão Geral</Typography>
        <Chip
          label={`${daysLeft} dias restantes`}
          size="small"
          color={daysLeft <= 5 ? 'error' : daysLeft <= 10 ? 'warning' : 'default'}
          variant="outlined"
          sx={{ fontSize: '0.58rem', height: 18, ml: 'auto' }}
        />
      </Box>

      {/* ── Progresso do mês ── */}
      <Paper sx={{ p: 1.5, border: '1px solid rgba(255,144,57,0.15)', background: 'linear-gradient(135deg,#1a1a1a,#1c1408)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </Typography>
          <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ fontSize: '0.7rem' }}>
            Dia {now.getDate()}/{lastDayOfMonth}
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={monthPct} sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', mb: 1 }} />

        {/* Big numbers */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
          <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'rgba(0,196,122,0.06)', border: '1px solid rgba(0,196,122,0.15)' }}>
            <Typography sx={{ fontWeight: 900, fontSize: '2rem', color: 'success.main', lineHeight: 1 }}>{global.pct}%</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.58rem' }}>
              {global.published}/{global.total} publicados
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.6, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>Hoje</Typography>
              <Typography variant="caption" fontWeight={700} color={todayDone === todayItems.length && todayItems.length > 0 ? 'success.main' : 'primary.main'} sx={{ fontSize: '0.68rem' }}>
                {todayDone}/{todayItems.length}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.6, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>Em edição</Typography>
              <Typography variant="caption" fontWeight={700} color="warning.main" sx={{ fontSize: '0.68rem' }}>{global.editing}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.6, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>Aprovados</Typography>
              <Typography variant="caption" fontWeight={700} color="info.main" sx={{ fontSize: '0.68rem' }}>{global.approved}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.6, borderRadius: 1.5, bgcolor: global.late > 0 ? 'rgba(255,69,69,0.06)' : 'rgba(255,255,255,0.03)' }}>
              <Typography variant="caption" color={global.late > 0 ? 'error.main' : 'text.secondary'} sx={{ fontSize: '0.6rem' }}>Atrasados</Typography>
              <Typography variant="caption" fontWeight={700} color={global.late > 0 ? 'error.main' : 'text.secondary'} sx={{ fontSize: '0.68rem' }}>{global.late}</Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* ── Posts vs Reels ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {[
          { icon: <ImageIcon sx={{ fontSize: 14, color: 'primary.main' }} />, label: 'Posts', published: global.postsPublished, total: global.posts, color: 'primary' as const },
          { icon: <MovieIcon sx={{ fontSize: 14, color: 'info.main' }} />,    label: 'Reels', published: global.reelsPublished, total: global.reels,  color: 'info' as const },
        ].map(t => (
          <Paper key={t.label} sx={{ p: 1.2, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4, mb: 0.4 }}>
              {t.icon}
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.label}</Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', lineHeight: 1 }}>
              {t.published}<Typography component="span" color="text.secondary" sx={{ fontSize: '0.7rem' }}>/{t.total}</Typography>
            </Typography>
            <LinearProgress variant="determinate" value={t.total > 0 ? Math.round((t.published / t.total) * 100) : 0} color={t.color} sx={{ mt: 0.6, height: 3, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)' }} />
          </Paper>
        ))}
      </Box>

      {/* ── Resumo de clientes ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.8 }}>
        {[
          { icon: <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />, value: complete,   label: '100%',        color: 'success.main' },
          { icon: <WarningAmberIcon sx={{ fontSize: 16, color: 'error.main' }} />,  value: withLate,   label: 'c/ atraso',   color: 'error.main' },
          { icon: <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'text.disabled', mx: 'auto' }} />, value: notStarted, label: 'sem início', color: 'text.secondary' },
        ].map((s, idx) => (
          <Paper key={idx} sx={{ p: 1, textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.3 }}>{s.icon}</Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: s.color, lineHeight: 1 }}>{s.value}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem', textTransform: 'uppercase' }}>{s.label}</Typography>
          </Paper>
        ))}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

      {/* ── Ranking por cliente ── */}
      <Typography variant="overline" color="primary.main" fontWeight={700} sx={{ letterSpacing: 1, fontSize: '0.6rem' }}>
        Ranking de clientes — do mais atrasado
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
        {clientStats.map(c => (
          <Box key={c.name} sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            p: 1, borderRadius: 1.5,
            border: '1px solid',
            borderColor: c.pct === 100 ? 'rgba(0,196,122,0.15)' : c.late > 0 ? 'rgba(255,69,69,0.15)' : 'rgba(255,255,255,0.05)',
            bgcolor: c.pct === 100 ? 'rgba(0,196,122,0.03)' : 'transparent',
          }}>
            {c.pct === 100
              ? <CheckCircleIcon sx={{ fontSize: 13, color: 'success.main', flexShrink: 0 }} />
              : c.late > 0
                ? <WarningAmberIcon sx={{ fontSize: 13, color: 'error.main', flexShrink: 0 }} />
                : <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
            }
            <Typography sx={{ flex: 1, fontSize: '0.72rem', fontWeight: 600 }} noWrap>{c.name}</Typography>
            {c.late > 0 && (
              <Chip label={`${c.late}↑`} size="small" color="error" variant="outlined" sx={{ fontSize: '0.48rem', height: 14, flexShrink: 0 }} />
            )}
            <Box sx={{ width: 80, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.52rem' }}>{c.published}/{c.total}</Typography>
                <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.6rem', color: c.pct === 100 ? 'success.main' : c.late > 0 ? 'error.main' : 'primary.main' }}>{c.pct}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={c.pct}
                color={c.pct === 100 ? 'success' : c.late > 0 ? 'error' : 'primary'}
                sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)' }}
              />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
