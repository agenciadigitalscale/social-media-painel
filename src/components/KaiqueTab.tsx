import { useMemo, useState, useEffect } from 'react'
import {
  Box, Typography, Paper, LinearProgress, Chip, Divider, Button, Tooltip,
} from '@mui/material'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ActivityLog from './ActivityLog'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import MovieIcon from '@mui/icons-material/Movie'
import ImageIcon from '@mui/icons-material/Image'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import RadarIcon from '@mui/icons-material/Radar'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import FavoriteIcon from '@mui/icons-material/Favorite'
import type { Client, ContentItem, ItemState } from '../types'

const WEEKDAY_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

// Componente de contador animado — anima de 0 até value quando monta
function CountUp({ value, suffix = '', decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (value === 0) return
    let start = 0
    const steps = 48
    const step = value / steps
    const id = setInterval(() => {
      start += step
      if (start >= value) { setDisplay(value); clearInterval(id) }
      else setDisplay(Number(start.toFixed(decimals)))
    }, 12)
    return () => clearInterval(id)
  }, [value, decimals])
  return <>{display.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>
}

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  now: Date
  onTabChange?: (tab: number) => void
}

export default function KaiqueTab({ items, states, allClients, now, onTabChange }: Props) {
  const today = useMemo(() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d }, [now])
  const tomorrow = useMemo(() => new Date(today.getTime() + 86_400_000), [today])

  const lastDayOfMonth = useMemo(() => new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), [now])
  const daysLeft = lastDayOfMonth - now.getDate()
  const monthPct = Math.round((now.getDate() / lastDayOfMonth) * 100)

  const global = useMemo(() => {
    const total            = items.length
    const published        = items.filter(i => (states[i.i]?.status ?? i.s) === 7).length
    const editing          = items.filter(i => (states[i.i]?.status ?? i.s) === 1).length
    const internalApproval = items.filter(i => (states[i.i]?.status ?? i.s) === 2).length
    const sentToClient     = items.filter(i => (states[i.i]?.status ?? i.s) === 4).length
    const rejected         = items.filter(i => (states[i.i]?.status ?? i.s) === 6).length
    const late             = items.filter(i => (states[i.i]?.status ?? i.s) !== 7 && i.dt < today).length
    const posts            = items.filter(i => i.tp === 'Post').length
    const reels            = items.filter(i => i.tp === 'Reel').length
    const postsPublished   = items.filter(i => i.tp === 'Post' && (states[i.i]?.status ?? i.s) === 7).length
    const reelsPublished   = items.filter(i => i.tp === 'Reel' && (states[i.i]?.status ?? i.s) === 7).length
    const clientApproved = items.filter(i => (states[i.i]?.status ?? i.s) === 5).length
    const pct            = total > 0 ? Math.round((published / total) * 100) : 0
    const reviewedTotal  = rejected + clientApproved
    const rejectedPct    = reviewedTotal > 0 ? Math.round((rejected / reviewedTotal) * 100) : 0
    return { total, published, editing, internalApproval, sentToClient, rejected, late, posts, reels, postsPublished, reelsPublished, pct, rejectedPct, clientApproved }
  }, [items, states, today])

  const clientStats = useMemo(() => allClients.map(client => {
    const ci         = items.filter(i => i.c === client.name)
    const total      = ci.length
    const published  = ci.filter(i => (states[i.i]?.status ?? i.s) === 7).length
    const late       = ci.filter(i => (states[i.i]?.status ?? i.s) !== 7 && i.dt < today).length
    const rejected   = ci.filter(i => (states[i.i]?.status ?? i.s) === 6).length
    const awaiting   = ci.filter(i => [2, 4].includes(states[i.i]?.status ?? i.s)).length
    const pct        = total > 0 ? Math.round((published / total) * 100) : 0
    const contracted = (client.postsPerMonth ?? 0) + (client.reelsPerMonth ?? 0)
    const deliveryGap   = contracted > 0 ? Math.max(0, 1 - published / contracted) : 1 - pct / 100
    const lateRate      = total > 0 ? late / total : 0
    const rejectedRate  = total > 0 ? rejected / total : 0
    const churnRisk     = Math.min(100, Math.round((lateRate * 0.4 + rejectedRate * 0.35 + deliveryGap * 0.25) * 100))
    return { name: client.name, total, published, late, rejected, awaiting, pct, contracted, churnRisk }
  }).sort((a, b) => a.pct - b.pct), [allClients, items, states, today])

  const complete   = clientStats.filter(c => c.pct === 100).length
  const withLate   = clientStats.filter(c => c.late > 0).length
  const notStarted = clientStats.filter(c => c.pct === 0).length

  const todayItems = useMemo(() =>
    items.filter(i => i.dt >= today && i.dt < tomorrow),
    [items, today, tomorrow],
  )
  const todayDone    = todayItems.filter(i => (states[i.i]?.status ?? i.s) === 7).length
  const todayPending = todayItems.filter(i => (states[i.i]?.status ?? i.s) !== 7)

  // ── Radar da Agência — alerts per client ──────────────────
  const radarAlerts = useMemo(() => {
    const alerts: Array<{ client: string; type: string; count: number; color: string; emoji: string }> = []
    clientStats.forEach(c => {
      if (c.rejected > 0)  alerts.push({ client: c.name, type: 'Reprovado pelo cliente', count: c.rejected, color: '#FF4545', emoji: '🔄' })
      if (c.late > 0)      alerts.push({ client: c.name, type: 'Conteúdo atrasado',       count: c.late,     color: '#FFD700', emoji: '⚠️' })
      if (c.awaiting > 0)  alerts.push({ client: c.name, type: 'Aguardando aprovação',    count: c.awaiting, color: '#3B8EFF', emoji: '👁️' })
    })
    return alerts.sort((a, b) => {
      const pri: Record<string, number> = { 'Reprovado pelo cliente': 0, 'Conteúdo atrasado': 1, 'Aguardando aprovação': 2 }
      return (pri[a.type] ?? 3) - (pri[b.type] ?? 3)
    })
  }, [clientStats])

  // ── IA Suggestions ────────────────────────────────────────
  const iaSuggestions = useMemo(() => {
    const sugs: Array<{ icon: string; text: string; color: string }> = []
    if (global.late > 5)
      sugs.push({ icon: '🚨', text: `${global.late} conteúdos atrasados — priorize edição hoje`, color: '#FF4545' })
    if (global.rejected > 0)
      sugs.push({ icon: '🔄', text: `${global.rejected} reprovados pelo cliente — aguardam revisão`, color: '#FF7A3D' })
    if (global.sentToClient > 3)
      sugs.push({ icon: '📤', text: `${global.sentToClient} enviados ao cliente aguardando retorno`, color: '#FFD700' })
    if (daysLeft <= 5 && global.pct < 70)
      sugs.push({ icon: '⏱️', text: `Apenas ${daysLeft} dias restantes com ${global.pct}% publicado`, color: '#FF4545' })
    if (global.internalApproval > 0)
      sugs.push({ icon: '👁️', text: `${global.internalApproval} itens aguardam aprovação interna`, color: '#3B8EFF' })
    if (sugs.length === 0)
      sugs.push({ icon: '✅', text: 'Operação em dia! Sem alertas críticos no momento', color: '#00C47A' })
    return sugs.slice(0, 4)
  }, [global, daysLeft])

  // ── Esta Semana — 7-day strip ────────────────────────────
  const weekStrip = useMemo(() => {
    const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1
    const monday = new Date(today.getTime() - dayOfWeek * 86_400_000)
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday.getTime() + i * 86_400_000)
      const dayMs = day.getTime()
      const dayItems2 = items.filter(it => {
        const d = new Date(it.dt); d.setHours(0,0,0,0)
        return d.getTime() === dayMs
      })
      const done    = dayItems2.filter(it => (states[it.i]?.status ?? it.s) === 7).length
      const pending = dayItems2.length - done
      const late    = dayItems2.filter(it => (states[it.i]?.status ?? it.s) !== 7).length > 0 && day < today
      const isToday = dayMs === today.getTime()
      return { day, total: dayItems2.length, done, pending, late, isToday }
    })
  }, [items, states, today])

  // ── Top Engajamento — publicados com dados ────────────────
  const topEngagement = useMemo(() => {
    return items
      .filter(it => {
        const st = states[it.i]?.status ?? it.s
        const eng = states[it.i]?.engagement
        return st === 7 && eng && ((eng.likes ?? 0) + (eng.comments ?? 0) + (eng.reach ?? 0)) > 0
      })
      .map(it => {
        const eng = states[it.i].engagement!
        const score = (eng.likes ?? 0) + (eng.comments ?? 0) * 3 + Math.round((eng.reach ?? 0) / 50)
        return { item: it, likes: eng.likes ?? 0, comments: eng.comments ?? 0, reach: eng.reach ?? 0, score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }, [items, states])

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

  // ── Mês anterior — comparativo ───────────────────────
  const prevMonthItems = useMemo(() => {
    const pm = now.getMonth() === 0 ? 11 : now.getMonth() - 1
    const py = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    return items.filter(i => { const dt = new Date(i.dt); return dt.getMonth() === pm && dt.getFullYear() === py })
  }, [items, now])

  const prevGlobal = useMemo(() => {
    const total          = prevMonthItems.length
    const published      = prevMonthItems.filter(i => (states[i.i]?.status ?? i.s) === 7).length
    const late           = prevMonthItems.filter(i => (states[i.i]?.status ?? i.s) !== 7).length
    const clientApproved = prevMonthItems.filter(i => (states[i.i]?.status ?? i.s) === 5).length
    const sentToClient   = prevMonthItems.filter(i => (states[i.i]?.status ?? i.s) === 4).length
    const internalApproval = prevMonthItems.filter(i => (states[i.i]?.status ?? i.s) === 2).length
    return { total, published, late, clientApproved, sentToClient, internalApproval }
  }, [prevMonthItems, states])

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
        <td style="text-align:center;color:${c.pct === 100 ? '#00C47A' : c.late > 0 ? '#FF4545' : '#ff9039'};font-weight:700">${c.pct}%</td>
        <td style="text-align:center;color:${c.late > 0 ? '#FF4545' : '#aaa'}">${c.late > 0 ? `⚠️ ${c.late}` : '—'}</td>
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

  // ── Hero KPIs — 4 cards estilo Flowspace ─────────────────
  const hasPrev = prevGlobal.total > 0
  const heroKpis = [
    {
      label:       'Clientes ativos',
      value:       allClients.length,
      sub:         `${complete} com 100%`,
      color:       '#F97316',
      icon:        '👥',
      delta:       null as number | null,
      deltaInvert: false,
    },
    {
      label:       'Aprovados cliente',
      value:       global.clientApproved,
      sub:         `${global.sentToClient} enviados`,
      color:       '#22C55E',
      icon:        '🎉',
      delta:       hasPrev ? global.clientApproved - prevGlobal.clientApproved : null,
      deltaInvert: false,
    },
    {
      label:       'Aguardando revisão',
      value:       global.internalApproval + global.sentToClient,
      sub:         `${global.internalApproval} interno · ${global.sentToClient} cliente`,
      color:       '#60A5FA',
      icon:        '👁️',
      delta:       hasPrev ? (global.internalApproval + global.sentToClient) - (prevGlobal.internalApproval + prevGlobal.sentToClient) : null,
      deltaInvert: true,
    },
    {
      label:       'Atrasados',
      value:       global.late,
      sub:         global.late === 0 ? 'tudo em dia' : 'passaram da data',
      color:       global.late > 0 ? '#EF4444' : '#22C55E',
      icon:        global.late > 0 ? '⚠️' : '✓',
      delta:       hasPrev ? global.late - prevGlobal.late : null,
      deltaInvert: true,
    },
  ]

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3.5 }, display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2, xl: 2.5 } }}>

      {/* ── Cabeçalho ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: '1rem', md: '1.15rem', xl: '1.4rem' }, letterSpacing: '-0.02em', lineHeight: 1 }}>
            Painel da agência
          </Typography>
          <Typography sx={{ fontSize: { xs: '0.62rem', md: '0.7rem' }, color: 'text.secondary', mt: 0.3 }}>
            Visão geral · {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Chip
          label={`${daysLeft}d restantes`}
          size="small"
          color={daysLeft <= 5 ? 'error' : daysLeft <= 10 ? 'warning' : 'default'}
          variant="outlined"
          sx={{ fontSize: { xs: '0.6rem', xl: '0.7rem' }, height: 22 }}
        />
        <Button
          size="small"
          startIcon={<PictureAsPdfIcon sx={{ fontSize: 13 }} />}
          onClick={handleExportPDF}
          variant="outlined"
          sx={{ fontSize: '0.65rem', borderColor: 'rgba(255,255,255,0.12)', color: 'text.secondary', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}
        >
          PDF
        </Button>
      </Box>

      {/* ── Hero KPI cards ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(4,1fr)' }, gap: { xs: 1, md: 1.5 } }}>
        {heroKpis.map(kpi => {
          const isGood  = kpi.delta !== null && (kpi.deltaInvert ? kpi.delta < 0 : kpi.delta > 0)
          const isBad   = kpi.delta !== null && (kpi.deltaInvert ? kpi.delta > 0 : kpi.delta < 0)
          const deltaColor = isGood ? '#00C47A' : isBad ? '#FF4545' : 'rgba(255,255,255,0.28)'
          return (
            <Paper key={kpi.label} sx={{
              p: { xs: 1.5, md: 2, xl: 2.5 },
              border: `1px solid rgba(255,255,255,0.07)`,
              display: 'flex', flexDirection: 'column', gap: 0.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {kpi.label}
                </Typography>
                <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>{kpi.icon}</Typography>
              </Box>
              <Typography sx={{ fontSize: { xs: '2rem', md: '2.4rem', xl: '3rem' }, fontWeight: 900, color: kpi.color, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {kpi.value}
              </Typography>
              <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>{kpi.sub}</Typography>
              {kpi.delta !== null && (
                <Typography sx={{ fontSize: '0.55rem', color: deltaColor, fontWeight: 600 }}>
                  {kpi.delta > 0 ? '↑' : kpi.delta < 0 ? '↓' : '→'} {kpi.delta > 0 ? '+' : ''}{kpi.delta} vs mês ant.
                </Typography>
              )}
            </Paper>
          )
        })}
      </Box>

      {/* ── Layout desktop: 2 colunas (3 em xl) ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: '1fr 1fr 1fr' }, gap: { xs: 1.5, md: 2, xl: 2.5 } }}>

        {/* Coluna esquerda */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>

          {/* Progresso do mês */}
          <Paper sx={{ p: { xs: 1.5, md: 2, xl: 3 }, border: '1px solid rgba(249,115,22,0.18)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.62rem', md: '0.72rem', xl: '0.82rem' }, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </Typography>
              <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ fontSize: { xs: '0.7rem', md: '0.8rem', xl: '0.92rem' } }}>
                Dia {now.getDate()}/{lastDayOfMonth}
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={monthPct} sx={{ height: { xs: 4, md: 6, xl: 8 }, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', mb: 1.5 }} />

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
              <Box sx={{ textAlign: 'center', p: { xs: 1, md: 1.5, xl: 2 }, borderRadius: 2, bgcolor: 'rgba(0,196,122,0.06)', border: '1px solid rgba(0,196,122,0.15)' }}>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: '2rem', md: '2.8rem', xl: '4rem' }, color: 'success.main', lineHeight: 1 }}>
                  <CountUp value={global.pct} suffix="%" />
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.58rem', md: '0.68rem', xl: '0.82rem' } }}>
                  <CountUp value={global.published} />/{global.total} publicados
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                {[
                  { label: 'Hoje',            value: `${todayDone}/${todayItems.length}`, color: todayDone === todayItems.length && todayItems.length > 0 ? 'success.main' : 'primary.main', highlight: false },
                  { label: 'Em edição',        value: global.editing,          color: 'warning.main',  highlight: false },
                  { label: 'Aprov. interna',   value: global.internalApproval, color: 'info.main',     highlight: false },
                  { label: 'Atrasados',        value: global.late,             color: global.late > 0 ? 'error.main' : 'text.secondary', highlight: global.late > 0 },
                  { label: 'Reprovados',       value: `${global.rejected} (${global.rejectedPct}%)`, color: global.rejected > 0 ? '#FF4545' : 'text.secondary', highlight: global.rejected > 0 },
                ].map(row => (
                  <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: { xs: 0.5, xl: 0.8 }, borderRadius: 1.5, bgcolor: row.highlight ? 'rgba(255,69,69,0.06)' : 'rgba(255,255,255,0.03)' }}>
                    <Typography variant="caption" color={row.highlight ? 'error.main' : 'text.secondary'} sx={{ fontSize: { xs: '0.58rem', md: '0.66rem', xl: '0.8rem' } }}>{row.label}</Typography>
                    <Typography variant="caption" fontWeight={700} color={row.color} sx={{ fontSize: { xs: '0.65rem', md: '0.75rem', xl: '0.9rem' } }}>{row.value}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>

          {/* Posts vs Reels */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {[
              { icon: <ImageIcon sx={{ fontSize: { xs: 14, md: 16, xl: 20 }, color: 'primary.main' }} />, label: 'Posts', published: global.postsPublished, total: global.posts, color: 'primary' as const },
              { icon: <MovieIcon  sx={{ fontSize: { xs: 14, md: 16, xl: 20 }, color: 'info.main' }} />,    label: 'Reels', published: global.reelsPublished, total: global.reels,  color: 'info' as const },
            ].map(t => (
              <Paper key={t.label} sx={{ p: { xs: 1.2, md: 1.8, xl: 2.5 }, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4, mb: 0.4 }}>
                  {t.icon}
                  <Typography variant="caption" fontWeight={700} sx={{ fontSize: { xs: '0.62rem', md: '0.72rem', xl: '0.85rem' }, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.label}</Typography>
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.1rem', md: '1.6rem', xl: '2.4rem' }, lineHeight: 1 }}>
                  {t.published}<Typography component="span" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.9rem', xl: '1.2rem' } }}>/{t.total}</Typography>
                </Typography>
                <LinearProgress variant="determinate" value={t.total > 0 ? Math.round((t.published / t.total) * 100) : 0} color={t.color} sx={{ mt: 0.8, height: { xs: 3, md: 5, xl: 7 }, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)' }} />
              </Paper>
            ))}
          </Box>

          {/* ── Esta Semana ── */}
          <Paper sx={{ p: { xs: 1.2, md: 1.8 }, border: '1px solid rgba(255,255,255,0.07)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 1 }}>
              <AccessTimeIcon sx={{ color: '#C084FC', fontSize: 15 }} />
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.72rem', color: '#C084FC', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Esta Semana
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
              {weekStrip.map(({ day, total, done, pending, late, isToday }) => (
                <Tooltip
                  key={day.getTime()}
                  title={total === 0 ? 'Sem conteúdo' : `${done} publicados · ${pending} pendentes`}
                >
                  <Box sx={{
                    textAlign: 'center', py: 0.8, borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: isToday ? 'primary.main' : late ? 'rgba(255,69,69,0.3)' : total > 0 && done === total ? 'rgba(0,196,122,0.25)' : 'rgba(255,255,255,0.06)',
                    bgcolor: isToday ? 'rgba(255,144,57,0.08)' : late ? 'rgba(255,69,69,0.05)' : total > 0 && done === total ? 'rgba(0,196,122,0.04)' : 'transparent',
                    cursor: 'default',
                  }}>
                    <Typography sx={{ fontSize: '0.46rem', color: isToday ? 'primary.main' : 'text.disabled', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1 }}>
                      {WEEKDAY_SHORT[day.getDay()]}
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: isToday ? 900 : 600, color: isToday ? 'primary.main' : 'text.primary', lineHeight: 1.3 }}>
                      {day.getDate()}
                    </Typography>
                    {total > 0 ? (
                      <>
                        <Box sx={{ mt: 0.4, height: 3, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${total > 0 ? Math.round((done / total) * 100) : 0}%`, bgcolor: late ? '#FF4545' : done === total ? '#00C47A' : 'primary.main', borderRadius: 1 }} />
                        </Box>
                        <Typography sx={{ fontSize: '0.4rem', color: late ? '#FF4545' : done === total ? '#00C47A' : 'text.disabled', mt: 0.3, lineHeight: 1 }}>
                          {late ? `⚠️ ${pending}` : done === total ? '✓' : `${pending}↑`}
                        </Typography>
                      </>
                    ) : (
                      <Typography sx={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.12)', mt: 0.7 }}>—</Typography>
                    )}
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </Paper>

          {/* Resumo de clientes */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.8 }}>
            {[
              { icon: <CheckCircleIcon sx={{ fontSize: { xs: 16, md: 20, xl: 26 }, color: 'success.main' }} />, value: complete,   label: '100%',       color: 'success.main' },
              { icon: <WarningAmberIcon sx={{ fontSize: { xs: 16, md: 20, xl: 26 }, color: 'error.main' }} />,  value: withLate,   label: 'c/ atraso',  color: 'error.main' },
              { icon: <Box sx={{ width: { xs: 8, md: 10, xl: 14 }, height: { xs: 8, md: 10, xl: 14 }, borderRadius: '50%', bgcolor: 'text.disabled', mx: 'auto' }} />, value: notStarted, label: 'sem início', color: 'text.secondary' },
            ].map((s, idx) => (
              <Paper key={idx} sx={{ p: { xs: 1, md: 1.5, xl: 2 }, textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.3 }}>{s.icon}</Box>
                <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.1rem', md: '1.5rem', xl: '2.2rem' }, color: s.color, lineHeight: 1 }}>
                  <CountUp value={s.value} />
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.55rem', md: '0.65rem', xl: '0.78rem' }, textTransform: 'uppercase' }}>{s.label}</Typography>
              </Paper>
            ))}
          </Box>

          {/* ── Hoje na Operação ── */}
          <Paper sx={{ p: { xs: 1.2, md: 1.8 }, border: '1px solid rgba(59,142,255,0.15)', bgcolor: 'rgba(59,142,255,0.03)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 1 }}>
              <AccessTimeIcon sx={{ color: '#3B8EFF', fontSize: 16 }} />
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.72rem', color: '#3B8EFF', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Hoje na Operação
              </Typography>
              <Chip label={`${todayDone}/${todayItems.length} ok`} size="small"
                sx={{ ml: 'auto', fontSize: '0.55rem', height: 16, bgcolor: todayDone === todayItems.length && todayItems.length > 0 ? 'rgba(0,196,122,0.15)' : 'rgba(59,142,255,0.15)', color: todayDone === todayItems.length && todayItems.length > 0 ? '#00C47A' : '#3B8EFF' }} />
            </Box>
            {todayItems.length === 0 ? (
              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Nenhum conteúdo programado para hoje</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {todayPending.slice(0, 5).map(item => {
                  const st = states[item.i]?.status ?? item.s
                  const stColors: Record<number, string> = { 0: '#A1A1AA', 1: '#FFD700', 2: '#60A5FA', 3: '#818CF8', 4: '#FF9A3D', 5: '#34D399', 6: '#FF4545' }
                  return (
                    <Box key={item.i} sx={{ display: 'flex', alignItems: 'center', gap: 0.7, p: 0.6, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.03)' }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: stColors[st] ?? '#A1A1AA', flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.68rem', flex: 1, color: 'rgba(255,255,255,0.8)' }} noWrap>{item.n}</Typography>
                      <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{item.c}</Typography>
                    </Box>
                  )
                })}
                {todayPending.length > 5 && (
                  <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', mt: 0.3 }}>
                    +{todayPending.length - 5} itens pendentes
                  </Typography>
                )}
              </Box>
            )}
          </Paper>

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
                <Typography sx={{ fontSize: { xs: '2rem', md: '2.5rem', xl: '3.5rem' }, fontWeight: 900, color: forecast.onTrack ? 'success.main' : 'error.main', lineHeight: 1 }}>
                  {forecast.pct}%
                </Typography>
                <Typography sx={{ fontSize: { xs: '0.7rem', xl: '0.85rem' }, color: 'rgba(255,255,255,0.35)' }}>ao fim do mês</Typography>
              </Box>
              <Typography sx={{ fontSize: { xs: '0.63rem', xl: '0.75rem' }, color: 'rgba(255,255,255,0.3)', mt: 0.5 }}>
                Ritmo atual · ~{forecast.rate} publicações/dia
              </Typography>
            </Paper>
          )}
        </Box>

        {/* Coluna direita */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>

          {/* ── Radar da Agência ── */}
          <Paper sx={{ p: { xs: 1.2, md: 1.8, xl: 2.5 }, border: '1px solid rgba(249,115,22,0.18)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 1 }}>
              <RadarIcon sx={{ color: 'primary.main', fontSize: { xs: 16, xl: 20 } }} />
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: { xs: '0.72rem', xl: '0.85rem' }, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Radar da Agência
              </Typography>
              <Chip label={`${radarAlerts.length} alertas`} size="small"
                sx={{ ml: 'auto', fontSize: '0.55rem', height: 16, bgcolor: radarAlerts.length === 0 ? 'rgba(0,196,122,0.15)' : 'rgba(255,69,69,0.15)', color: radarAlerts.length === 0 ? '#00C47A' : '#FF4545' }} />
            </Box>
            {radarAlerts.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                <Typography sx={{ fontSize: '0.72rem', color: 'success.main' }}>Nenhum alerta — operação em dia!</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {radarAlerts.slice(0, 8).map((alert, i) => (
                  <Box key={i} sx={{
                    display: 'flex', alignItems: 'center', gap: 0.7,
                    p: { xs: 0.7, xl: 1 }, borderRadius: 1.5,
                    bgcolor: `${alert.color}08`,
                    border: `1px solid ${alert.color}20`,
                  }}>
                    <Typography sx={{ fontSize: { xs: '0.8rem', xl: '1rem' }, lineHeight: 1, flexShrink: 0 }}>{alert.emoji}</Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: { xs: '0.68rem', xl: '0.82rem' }, fontWeight: 700, color: '#fff', lineHeight: 1 }} noWrap>{alert.client}</Typography>
                      <Typography sx={{ fontSize: { xs: '0.58rem', xl: '0.7rem' }, color: alert.color }}>{alert.type}</Typography>
                    </Box>
                    <Chip label={alert.count} size="small"
                      sx={{ height: { xs: 16, xl: 20 }, fontSize: { xs: '0.5rem', xl: '0.62rem' }, bgcolor: `${alert.color}20`, color: alert.color, border: `1px solid ${alert.color}40`, flexShrink: 0 }} />
                  </Box>
                ))}
              </Box>
            )}
          </Paper>

          {/* ── IA Operacional ── */}
          <Paper sx={{ p: { xs: 1.2, md: 1.8 }, border: '1px solid rgba(192,132,252,0.15)', bgcolor: 'rgba(192,132,252,0.03)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 1 }}>
              <AutoAwesomeIcon sx={{ color: '#C084FC', fontSize: 16 }} />
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.72rem', color: '#C084FC', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                IA Operacional
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
              {iaSuggestions.map((sug, i) => (
                <Box key={i} sx={{
                  display: 'flex', alignItems: 'flex-start', gap: 0.8,
                  p: 0.8, borderRadius: 1.5,
                  bgcolor: `${sug.color}06`,
                  border: `1px solid ${sug.color}20`,
                }}>
                  <Typography sx={{ fontSize: '0.9rem', lineHeight: 1, mt: 0.1, flexShrink: 0 }}>{sug.icon}</Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>{sug.text}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          {/* ── Top Engajamento ── */}
          {topEngagement.length > 0 && (
            <Paper sx={{ p: { xs: 1.2, md: 1.8 }, border: '1px solid rgba(251,113,133,0.18)', bgcolor: 'rgba(251,113,133,0.03)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 1 }}>
                <FavoriteIcon sx={{ color: '#FB7185', fontSize: 15 }} />
                <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.72rem', color: '#FB7185', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Top Engajamento
                </Typography>
                <Chip label={`${topEngagement.length} publicados`} size="small" sx={{ ml: 'auto', fontSize: '0.5rem', height: 16, bgcolor: 'rgba(251,113,133,0.12)', color: '#FB7185' }} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                {topEngagement.map(({ item, likes, comments, reach }, rank) => (
                  <Box key={item.i} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, p: 0.7, borderRadius: 1.5, bgcolor: rank === 0 ? 'rgba(251,113,133,0.07)' : 'rgba(255,255,255,0.02)', border: `1px solid ${rank === 0 ? 'rgba(251,113,133,0.2)' : 'rgba(255,255,255,0.04)'}` }}>
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 900, color: rank === 0 ? '#FB7185' : 'rgba(255,255,255,0.25)', width: 14, flexShrink: 0, textAlign: 'center' }}>
                      {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank + 1}`}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }} noWrap>
                        {states[item.i]?.title || item.n}
                      </Typography>
                      <Typography sx={{ fontSize: '0.55rem', color: '#ff9039' }}>{item.c} · {item.tp}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.8, flexShrink: 0 }}>
                      {likes > 0 && <Typography sx={{ fontSize: '0.55rem', color: '#FB7185' }}>❤️ {likes.toLocaleString('pt-BR')}</Typography>}
                      {comments > 0 && <Typography sx={{ fontSize: '0.55rem', color: '#60A5FA' }}>💬 {comments}</Typography>}
                      {reach > 0 && <Typography sx={{ fontSize: '0.55rem', color: '#00C47A' }}>👁 {reach.toLocaleString('pt-BR')}</Typography>}
                    </Box>
                  </Box>
                ))}
              </Box>
              {items.filter(it => (states[it.i]?.status ?? it.s) === 7 && !states[it.i]?.engagement).length > 0 && (
                <Typography
                  onClick={() => onTabChange?.(19)}
                  sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', mt: 1, fontStyle: 'italic',
                    cursor: onTabChange ? 'pointer' : 'default',
                    '&:hover': { color: 'primary.main', textDecoration: onTabChange ? 'underline' : 'none' } }}>
                  💡 {items.filter(it => (states[it.i]?.status ?? it.s) === 7 && !states[it.i]?.engagement).length} publicados sem métricas — clique para preencher
                </Typography>
              )}
            </Paper>
          )}

          {/* Ranking de clientes */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="overline" color="primary.main" fontWeight={700} sx={{ letterSpacing: 1, fontSize: { xs: '0.6rem', md: '0.68rem', xl: '0.78rem' } }}>
              Ranking de clientes — do mais atrasado
            </Typography>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
              {clientStats.map(c => (
                <Box key={c.name} sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  p: { xs: 1, md: 1.2, xl: 1.5 }, borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: c.pct === 100 ? 'rgba(0,196,122,0.15)' : c.late > 0 ? 'rgba(255,69,69,0.15)' : 'rgba(255,255,255,0.05)',
                  bgcolor: c.pct === 100 ? 'rgba(0,196,122,0.03)' : 'transparent',
                }}>
                  {c.pct === 100
                    ? <CheckCircleIcon sx={{ fontSize: { xs: 13, md: 15, xl: 18 }, color: 'success.main', flexShrink: 0 }} />
                    : c.late > 0
                      ? <WarningAmberIcon sx={{ fontSize: { xs: 13, md: 15, xl: 18 }, color: 'error.main', flexShrink: 0 }} />
                      : <Box sx={{ width: { xs: 8, xl: 10 }, height: { xs: 8, xl: 10 }, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                  }
                  <Typography sx={{ flex: 1, fontSize: { xs: '0.72rem', md: '0.82rem', xl: '0.96rem' }, fontWeight: 600 }} noWrap>{c.name}</Typography>
                  {c.rejected > 0 && (
                    <Chip label={`${c.rejected}✗`} size="small" color="error" variant="outlined" sx={{ fontSize: { xs: '0.48rem', xl: '0.6rem' }, height: { xs: 14, xl: 18 }, flexShrink: 0 }} />
                  )}
                  {c.late > 0 && (
                    <Chip label={`${c.late}↑`} size="small" color="warning" variant="outlined" sx={{ fontSize: { xs: '0.48rem', xl: '0.6rem' }, height: { xs: 14, xl: 18 }, flexShrink: 0 }} />
                  )}
                  <Tooltip title={`Risco de churn: ${c.churnRisk}% · baseado em atrasos, reprovações e gap de entrega`} arrow>
                    <Chip
                      label={`${c.churnRisk}%`}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontSize: { xs: '0.44rem', xl: '0.56rem' }, height: { xs: 14, xl: 18 }, flexShrink: 0, cursor: 'default',
                        borderColor: c.churnRisk >= 61 ? 'rgba(255,69,69,0.5)' : c.churnRisk >= 31 ? 'rgba(255,215,0,0.5)' : 'rgba(0,196,122,0.4)',
                        color: c.churnRisk >= 61 ? '#FF4545' : c.churnRisk >= 31 ? '#FFD700' : '#00C47A',
                      }}
                    />
                  </Tooltip>
                  <Box sx={{ width: { xs: 80, md: 110, xl: 160 }, flexShrink: 0 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: { xs: '0.52rem', md: '0.6rem', xl: '0.72rem' } }}>{c.published}/{c.total}</Typography>
                      <Typography variant="caption" fontWeight={700} sx={{ fontSize: { xs: '0.6rem', md: '0.68rem', xl: '0.82rem' }, color: c.pct === 100 ? 'success.main' : c.late > 0 ? 'error.main' : 'primary.main' }}>{c.pct}%</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate" value={c.pct}
                      color={c.pct === 100 ? 'success' : c.late > 0 ? 'error' : 'primary'}
                      sx={{ height: { xs: 4, md: 6, xl: 8 }, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)' }}
                    />
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── SLA de entrega por cliente ── */}
      <Paper sx={{ p: { xs: 1.5, md: 2, xl: 3 }, border: '1px solid rgba(59,142,255,0.18)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1.5 }}>
          <TrendingUpIcon sx={{ color: '#3B8EFF', fontSize: { xs: 15, xl: 18 } }} />
          <Typography sx={{ fontSize: { xs: '0.65rem', xl: '0.78rem' }, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', flex: 1 }}>
            SLA de entrega — contratado vs entregue
          </Typography>
          <Chip
            label={`${clientStats.filter(c => c.contracted > 0 && c.published >= c.contracted).length}/${clientStats.filter(c => c.contracted > 0).length} no prazo`}
            size="small"
            sx={{ fontSize: '0.55rem', height: 16, bgcolor: 'rgba(59,142,255,0.12)', color: '#3B8EFF', border: '1px solid rgba(59,142,255,0.25)' }}
          />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7 }}>
          {clientStats.filter(c => c.contracted > 0).map(c => {
            const slaRate = Math.min(100, Math.round((c.published / c.contracted) * 100))
            const ok = c.published >= c.contracted
            const slaColor = ok ? '#00C47A' : slaRate >= 70 ? '#FFD700' : '#FF4545'
            return (
              <Box key={c.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: { xs: '0.65rem', xl: '0.78rem' }, color: 'rgba(255,255,255,0.75)', width: { xs: 90, md: 120, xl: 160 }, flexShrink: 0 }} noWrap>{c.name}</Typography>
                <Box sx={{ flex: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={slaRate}
                    sx={{
                      height: { xs: 5, xl: 7 }, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)',
                      '& .MuiLinearProgress-bar': { bgcolor: slaColor },
                    }}
                  />
                </Box>
                <Typography sx={{ fontSize: { xs: '0.6rem', xl: '0.72rem' }, fontWeight: 700, color: slaColor, width: { xs: 60, xl: 80 }, textAlign: 'right', flexShrink: 0 }}>
                  {c.published}/{c.contracted} {ok ? '✓' : `(${slaRate}%)`}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Paper>

      {/* ── Gráfico de publicações diárias ── */}
      <Paper sx={{ p: { xs: 1.5, md: 2, xl: 3 }, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography sx={{ fontSize: { xs: '0.65rem', xl: '0.82rem' }, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)' }}>
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
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: { xs: 50, md: 68, xl: 110 } }}>
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

      {/* ── Relatório WhatsApp ── */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          size="small"
          startIcon={<WhatsAppIcon sx={{ fontSize: 15 }} />}
          onClick={() => {
            const month = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
            const lines = [
              `📊 *Relatório Digital Scale — ${month}*`,
              ``,
              `📌 *Progresso geral: ${global.pct}%*`,
              `✅ Publicados: ${global.published}/${global.total}`,
              `⏳ Em produção: ${global.editing}`,
              `📤 Aguardando cliente: ${global.sentToClient}`,
              global.rejected > 0 ? `🔄 Reprovados: ${global.rejected}` : '',
              global.late > 0 ? `⚠️ Atrasados: ${global.late}` : '',
              ``,
              `*Top clientes com pendência:*`,
              ...clientStats.filter(c => c.pct < 100 && c.total > 0).slice(0, 5)
                .map(c => `• ${c.name}: ${c.pct}% (${c.published}/${c.total})`),
              ``,
              `_Gerado via DS HUB · ${new Date().toLocaleDateString('pt-BR')}_`,
            ].filter(l => l !== undefined).join('\n')
            window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank', 'noopener')
          }}
          sx={{
            fontSize: '0.68rem', fontWeight: 700,
            bgcolor: 'rgba(37,211,102,0.08)', color: '#25D366',
            border: '1px solid rgba(37,211,102,0.25)',
            '&:hover': { bgcolor: 'rgba(37,211,102,0.16)' },
          }}
        >
          Relatório no WhatsApp
        </Button>
      </Box>

      {/* ── Activity Log ── */}
      <Paper sx={{ p: { xs: 1.5, md: 2 }, border: '1px solid rgba(255,255,255,0.07)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', flex: 1 }}>
            📋 Atividade da equipe
          </Typography>
          <Chip label="Ao vivo" size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: 'rgba(0,196,122,0.1)', color: '#22C55E', border: '1px solid rgba(0,196,122,0.2)' }} />
        </Box>
        <ActivityLog maxEntries={30} />
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
