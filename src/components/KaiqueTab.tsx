import { useMemo } from 'react'
import {
  Box, Typography, Paper, LinearProgress, Chip, Divider, Button, Tooltip,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import MovieIcon from '@mui/icons-material/Movie'
import ImageIcon from '@mui/icons-material/Image'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
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

  // ── Gráfico diário ────────────────────────────────────
  const dailyData = useMemo(() => {
    const year = now.getFullYear(); const month = now.getMonth()
    return Array.from({ length: lastDayOfMonth }, (_, i) => {
      const day  = i + 1
      const d    = new Date(year, month, day)
      const next = new Date(year, month, day + 1)
      const dayItems = items.filter(it => { const dt = new Date(it.dt); return dt >= d && dt < next })
      return { day, total: dayItems.length, published: dayItems.filter(it => (states[it.i]?.status ?? it.s) === 3).length }
    })
  }, [items, states, now, lastDayOfMonth])

  const maxDayVal = useMemo(() => Math.max(...dailyData.map(d => d.total), 1), [dailyData])

  // ── Previsão de conclusão ─────────────────────────────
  const forecast = useMemo(() => {
    const dayOfMonth = now.getDate()
    if (dayOfMonth < 1 || global.total === 0) return null
    const rate      = global.published / Math.max(dayOfMonth, 1)
    const projected = Math.min(global.total, Math.round(global.published + rate * daysLeft))
    const pct       = Math.round((projected / global.total) * 100)
    return { pct, rate: Math.round(rate * 10) / 10, onTrack: pct >= 90 }
  }, [global, daysLeft, now])

  // ── Gargalo ───────────────────────────────────────────
  const bottleneck = useMemo(() => {
    const labels: Record<number, string> = { 0: 'Pendente', 1: 'Em edição', 2: 'Aprovado' }
    const lateByStatus = [0, 1, 2]
      .map(s => ({ s, label: labels[s], count: items.filter(i => (states[i.i]?.status ?? i.s) === s && new Date(i.dt) < today).length }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count)
    return { lateByStatus, main: lateByStatus[0] ?? null }
  }, [items, states, today])

  const handleExportPDF = () => {
    const monthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const rows = clientStats.map(c => `
      <tr>
        <td>${c.name}</td>
        <td style="text-align:center">${c.published}/${c.total}</td>
        <td style="text-align:center;color:${c.pct===100?'#00C47A':c.late>0?'#FF4545':'#ff9039'};font-weight:700">${c.pct}%</td>
        <td style="text-align:center;color:${c.late>0?'#FF4545':'#aaa'}">${c.late > 0 ? `⚠️ ${c.late}` : '—'}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório — ${monthName}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:32px;color:#111;max-width:900px;margin:0 auto}
      h1{color:#ff9039;margin-bottom:4px}h2{color:#555;font-weight:400;margin-top:0;font-size:1.1rem}
      .stats{display:flex;gap:24px;margin:24px 0}
      .stat{background:#f5f5f5;border-radius:12px;padding:16px 24px;text-align:center;flex:1}
      .stat .num{font-size:2.4rem;font-weight:900;color:#ff9039;line-height:1}
      .stat .lbl{font-size:0.75rem;color:#888;text-transform:uppercase;letter-spacing:0.5px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#ff9039;color:#fff;padding:10px 12px;text-align:left;font-size:0.82rem}
      td{padding:8px 12px;border-bottom:1px solid #eee;font-size:0.85rem}
      tr:nth-child(even) td{background:#fafafa}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>Digital Scale — Relatório Mensal</h1>
    <h2>${monthName} · Gerado em ${new Date().toLocaleDateString('pt-BR')}</h2>
    <div class="stats">
      <div class="stat"><div class="num">${global.pct}%</div><div class="lbl">Publicados</div></div>
      <div class="stat"><div class="num">${global.published}/${global.total}</div><div class="lbl">Conteúdos</div></div>
      <div class="stat"><div class="num">${global.late}</div><div class="lbl">Atrasados</div></div>
      <div class="stat"><div class="num">${daysLeft}</div><div class="lbl">Dias restantes</div></div>
    </div>
    <table><thead><tr><th>Cliente</th><th>Publicados</th><th>%</th><th>Atrasados</th></tr></thead>
    <tbody>${rows}</tbody></table>
    </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 400) }
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3 }, display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>

      {/* ── Cabeçalho ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
        <TrendingUpIcon sx={{ color: 'primary.main', fontSize: { xs: 18, md: 22 } }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: { xs: '0.85rem', md: '1rem', xl: '1.1rem' } }}>Visão Geral</Typography>
        <Chip
          label={`${daysLeft} dias restantes`}
          size="small"
          color={daysLeft <= 5 ? 'error' : daysLeft <= 10 ? 'warning' : 'default'}
          variant="outlined"
          sx={{ fontSize: { xs: '0.58rem', md: '0.68rem' }, height: { xs: 18, md: 22 }, ml: 'auto' }}
        />
        <Button
          size="small"
          startIcon={<PictureAsPdfIcon sx={{ fontSize: 14 }} />}
          onClick={handleExportPDF}
          variant="outlined"
          sx={{ fontSize: '0.65rem', borderColor: 'rgba(255,144,57,0.3)', color: 'primary.main', '&:hover': { borderColor: 'primary.main' } }}
        >
          PDF
        </Button>
      </Box>

      {/* ── Layout desktop: 2 colunas ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 1.5, md: 2 } }}>

        {/* Coluna esquerda: stats globais */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>

          {/* Progresso do mês */}
          <Paper sx={{ p: { xs: 1.5, md: 2, xl: 2.5 }, border: '1px solid rgba(255,144,57,0.15)', background: 'linear-gradient(135deg,#1a1a1a,#1c1408)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.62rem', md: '0.72rem' }, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </Typography>
              <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ fontSize: { xs: '0.7rem', md: '0.8rem' } }}>
                Dia {now.getDate()}/{lastDayOfMonth}
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={monthPct} sx={{ height: { xs: 4, md: 6 }, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', mb: 1.5 }} />

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
              <Box sx={{ textAlign: 'center', p: { xs: 1, md: 1.5 }, borderRadius: 2, bgcolor: 'rgba(0,196,122,0.06)', border: '1px solid rgba(0,196,122,0.15)' }}>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: '2rem', md: '2.8rem', xl: '3.2rem' }, color: 'success.main', lineHeight: 1 }}>{global.pct}%</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.58rem', md: '0.68rem' } }}>
                  {global.published}/{global.total} publicados
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                {[
                  { label: 'Hoje', value: `${todayDone}/${todayItems.length}`, color: todayDone === todayItems.length && todayItems.length > 0 ? 'success.main' : 'primary.main' },
                  { label: 'Em edição', value: global.editing, color: 'warning.main' },
                  { label: 'Aprovados',  value: global.approved, color: 'info.main' },
                  { label: 'Atrasados',  value: global.late, color: global.late > 0 ? 'error.main' : 'text.secondary' },
                ].map(row => (
                  <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.6, borderRadius: 1.5, bgcolor: row.label === 'Atrasados' && global.late > 0 ? 'rgba(255,69,69,0.06)' : 'rgba(255,255,255,0.03)' }}>
                    <Typography variant="caption" color={row.label === 'Atrasados' && global.late > 0 ? 'error.main' : 'text.secondary'} sx={{ fontSize: { xs: '0.6rem', md: '0.68rem' } }}>{row.label}</Typography>
                    <Typography variant="caption" fontWeight={700} color={row.color} sx={{ fontSize: { xs: '0.68rem', md: '0.78rem' } }}>{row.value}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>

          {/* Posts vs Reels */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {[
              { icon: <ImageIcon sx={{ fontSize: { xs: 14, md: 16 }, color: 'primary.main' }} />, label: 'Posts', published: global.postsPublished, total: global.posts, color: 'primary' as const },
              { icon: <MovieIcon  sx={{ fontSize: { xs: 14, md: 16 }, color: 'info.main' }} />,    label: 'Reels', published: global.reelsPublished, total: global.reels,  color: 'info' as const },
            ].map(t => (
              <Paper key={t.label} sx={{ p: { xs: 1.2, md: 1.8 }, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4, mb: 0.4 }}>
                  {t.icon}
                  <Typography variant="caption" fontWeight={700} sx={{ fontSize: { xs: '0.62rem', md: '0.72rem' }, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.label}</Typography>
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.1rem', md: '1.6rem', xl: '1.9rem' }, lineHeight: 1 }}>
                  {t.published}<Typography component="span" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.9rem' } }}>/{t.total}</Typography>
                </Typography>
                <LinearProgress variant="determinate" value={t.total > 0 ? Math.round((t.published / t.total) * 100) : 0} color={t.color} sx={{ mt: 0.8, height: { xs: 3, md: 5 }, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)' }} />
              </Paper>
            ))}
          </Box>

          {/* Resumo de clientes */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.8 }}>
            {[
              { icon: <CheckCircleIcon sx={{ fontSize: { xs: 16, md: 20 }, color: 'success.main' }} />, value: complete,   label: '100%',       color: 'success.main' },
              { icon: <WarningAmberIcon sx={{ fontSize: { xs: 16, md: 20 }, color: 'error.main' }} />,  value: withLate,   label: 'c/ atraso',  color: 'error.main' },
              { icon: <Box sx={{ width: { xs: 8, md: 10 }, height: { xs: 8, md: 10 }, borderRadius: '50%', bgcolor: 'text.disabled', mx: 'auto' }} />, value: notStarted, label: 'sem início', color: 'text.secondary' },
            ].map((s, idx) => (
              <Paper key={idx} sx={{ p: { xs: 1, md: 1.5 }, textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.3 }}>{s.icon}</Box>
                <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.1rem', md: '1.5rem', xl: '1.8rem' }, color: s.color, lineHeight: 1 }}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.55rem', md: '0.65rem' }, textTransform: 'uppercase' }}>{s.label}</Typography>
              </Paper>
            ))}
          </Box>

          {/* ── Previsão de conclusão ── */}
          {forecast && (
            <Paper sx={{
              p: { xs: 1.5, md: 2 },
              border: `1px solid ${forecast.onTrack ? 'rgba(0,196,122,0.22)' : 'rgba(255,69,69,0.22)'}`,
              background: forecast.onTrack ? 'rgba(0,196,122,0.03)' : 'rgba(255,69,69,0.03)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
                {forecast.onTrack
                  ? <TrendingUpIcon sx={{ fontSize: 15, color: 'success.main' }} />
                  : <TrendingDownIcon sx={{ fontSize: 15, color: 'error.main' }} />}
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)', flex: 1 }}>
                  Previsão de conclusão
                </Typography>
                <Chip
                  label={forecast.onTrack ? 'No ritmo ✓' : 'Atrasando ⚠'}
                  size="small"
                  color={forecast.onTrack ? 'success' : 'error'}
                  variant="outlined"
                  sx={{ fontSize: '0.55rem', height: 16 }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography sx={{ fontSize: { xs: '2rem', md: '2.5rem' }, fontWeight: 900, color: forecast.onTrack ? 'success.main' : 'error.main', lineHeight: 1 }}>
                  {forecast.pct}%
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>ao fim do mês</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.3)', mt: 0.5 }}>
                Ritmo atual · ~{forecast.rate} publicações/dia
              </Typography>
            </Paper>
          )}
        </Box>

        {/* Coluna direita: ranking de clientes */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="overline" color="primary.main" fontWeight={700} sx={{ letterSpacing: 1, fontSize: { xs: '0.6rem', md: '0.68rem' } }}>
            Ranking de clientes — do mais atrasado
          </Typography>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
            {clientStats.map(c => (
              <Box key={c.name} sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                p: { xs: 1, md: 1.2 }, borderRadius: 1.5,
                border: '1px solid',
                borderColor: c.pct === 100 ? 'rgba(0,196,122,0.15)' : c.late > 0 ? 'rgba(255,69,69,0.15)' : 'rgba(255,255,255,0.05)',
                bgcolor: c.pct === 100 ? 'rgba(0,196,122,0.03)' : 'transparent',
                transition: 'border-color 0.2s',
              }}>
                {c.pct === 100
                  ? <CheckCircleIcon sx={{ fontSize: { xs: 13, md: 15 }, color: 'success.main', flexShrink: 0 }} />
                  : c.late > 0
                    ? <WarningAmberIcon sx={{ fontSize: { xs: 13, md: 15 }, color: 'error.main', flexShrink: 0 }} />
                    : <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                }
                <Typography sx={{ flex: 1, fontSize: { xs: '0.72rem', md: '0.82rem' }, fontWeight: 600 }} noWrap>{c.name}</Typography>
                {c.late > 0 && (
                  <Chip label={`${c.late}↑`} size="small" color="error" variant="outlined" sx={{ fontSize: '0.48rem', height: 14, flexShrink: 0 }} />
                )}
                <Box sx={{ width: { xs: 80, md: 110, xl: 140 }, flexShrink: 0 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: { xs: '0.52rem', md: '0.6rem' } }}>{c.published}/{c.total}</Typography>
                    <Typography variant="caption" fontWeight={700} sx={{ fontSize: { xs: '0.6rem', md: '0.68rem' }, color: c.pct === 100 ? 'success.main' : c.late > 0 ? 'error.main' : 'primary.main' }}>{c.pct}%</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={c.pct}
                    color={c.pct === 100 ? 'success' : c.late > 0 ? 'error' : 'primary'}
                    sx={{ height: { xs: 4, md: 6 }, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)' }}
                  />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── Gráfico de publicações diárias ── */}
      <Paper sx={{ p: { xs: 1.5, md: 2, xl: 2.5 }, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)' }}>
            Publicações · {now.toLocaleDateString('pt-BR', { month: 'long' })}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {[{ color: '#00C47A', label: 'Publicado' }, { color: 'rgba(255,255,255,0.12)', label: 'Agendado' }].map(l => (
              <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: l.color }} />
                <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)' }}>{l.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Bars */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: { xs: 50, md: 68 } }}>
          {dailyData.map(({ day, total, published }) => {
            const isToday = day === now.getDate()
            const barPct  = total > 0 ? (total / maxDayVal) * 100 : 0
            const pubPct  = total > 0 ? (published / total) * 100 : 0
            return (
              <Tooltip key={day} title={`Dia ${day}: ${published} publicado${published !== 1 ? 's' : ''} / ${total} total`} arrow placement="top">
                <Box sx={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative', cursor: 'default' }}>
                  {isToday && (
                    <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: '-1px', right: '-1px', border: '1px solid rgba(255,144,57,0.55)', borderRadius: 0.5, pointerEvents: 'none', zIndex: 2 }} />
                  )}
                  {total > 0 ? (
                    <Box sx={{ width: '100%', height: `${Math.max(barPct, 5)}%`, borderRadius: 0.5, overflow: 'hidden', position: 'relative' }}>
                      <Box sx={{ width: '100%', height: '100%', bgcolor: 'rgba(255,255,255,0.1)' }} />
                      {published > 0 && (
                        <Box sx={{ position: 'absolute', bottom: 0, width: '100%', height: `${pubPct}%`, bgcolor: '#00C47A', opacity: 0.88, minHeight: 2 }} />
                      )}
                    </Box>
                  ) : (
                    <Box sx={{ width: '100%', height: 2, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1 }} />
                  )}
                </Box>
              </Tooltip>
            )
          })}
        </Box>

        {/* Day labels */}
        <Box sx={{ display: 'flex', gap: '2px', mt: 0.5 }}>
          {dailyData.map(({ day }) => (
            <Box key={day} sx={{ flex: 1, textAlign: 'center' }}>
              {(day === 1 || day % 5 === 0 || day === lastDayOfMonth) && (
                <Typography sx={{ fontSize: { xs: '0.42rem', md: '0.5rem' }, color: day === now.getDate() ? 'primary.main' : 'rgba(255,255,255,0.2)', lineHeight: 1, fontWeight: day === now.getDate() ? 700 : 400 }}>
                  {day}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </Paper>

      {/* ── Alerta de gargalo ── */}
      {bottleneck.main && global.late > 0 && (
        <Paper sx={{ p: { xs: 1.5, md: 2 }, border: '1px solid rgba(255,144,57,0.25)', background: 'rgba(255,69,69,0.03)', display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <WarningAmberIcon sx={{ fontSize: 18, color: 'warning.main', mt: 0.2, flexShrink: 0 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>
              🚧 Gargalo detectado
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', mb: 1, lineHeight: 1.6 }}>
              {bottleneck.main.count} conteúdo{bottleneck.main.count > 1 ? 's' : ''} atrasado{bottleneck.main.count > 1 ? 's' : ''} parado{bottleneck.main.count > 1 ? 's' : ''} em <strong style={{ color: '#ff9039' }}>{bottleneck.main.label}</strong> — priorize esse status.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
              {bottleneck.lateByStatus.map(({ label, count }) => (
                <Chip key={label} label={`${count}× ${label}`} size="small" color="warning" variant="outlined"
                  sx={{ fontSize: '0.6rem', height: 18 }} />
              ))}
            </Box>
          </Box>
        </Paper>
      )}
    </Box>
  )
}
