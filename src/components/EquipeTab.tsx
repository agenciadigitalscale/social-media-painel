import { useMemo, useState } from 'react'
import {
  Box, Typography, Paper, Chip, Divider, LinearProgress, Tooltip,
} from '@mui/material'
import GroupIcon from '@mui/icons-material/Group'
import LeaderboardIcon from '@mui/icons-material/Leaderboard'
import PageHero from '../shared/ui/PageHero'
import { NAME_MAP, getDisplayName } from '../lib/users'
import type { ContentItem, ItemState } from '../types'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  currentUser?: string
}

export default function EquipeTab({ items, states, currentUser }: Props) {
  const [view, setView] = useState<'overview' | 'performance'>('overview')

  const members = useMemo(() => Object.entries(NAME_MAP).map(([key, info]) => {
    // Count items where responsible = this user
    const responsible = items.filter(i => states[i.i]?.responsible?.toLowerCase() === key)
    const done = responsible.filter(i => (states[i.i]?.status ?? i.s) === 7)
    const inProgress = responsible.filter(i => {
      const s = states[i.i]?.status ?? i.s
      return s >= 1 && s < 7
    })
    const pending = responsible.filter(i => (states[i.i]?.status ?? i.s) === 0)
    const late = responsible.filter(i => {
      const s = states[i.i]?.status ?? i.s
      return s < 7 && i.dt < new Date()
    })
    const pct = responsible.length > 0 ? Math.round((done.length / responsible.length) * 100) : 0
    return { key, info, totalItems: responsible.length, done: done.length, inProgress: inProgress.length, pending: pending.length, late: late.length, pct }
  }), [items, states])

  // ── Performance metrics ──────────────────────────────────
  const now = useMemo(() => new Date(), [])
  const performance = useMemo(() => Object.entries(NAME_MAP).map(([key, info]) => {
    const assigned = items.filter(i => states[i.i]?.responsible?.toLowerCase() === key)
    const total = assigned.length
    const published = assigned.filter(i => (states[i.i]?.status ?? i.s) === 7)
    const late = assigned.filter(i => {
      const s = states[i.i]?.status ?? i.s
      return s !== 7 && s !== 5 && new Date(i.dt) < now
    })
    const rejected = assigned.filter(i => (states[i.i]?.status ?? i.s) === 6)
    const onTime = published.filter(i => {
      const pub = states[i.i]?.publishedAt
      return pub ? new Date(pub) <= new Date(i.dt) : false
    })
    // SLA: avg days client kept waiting (sentToClientAt → approvedByClientAt)
    const slaItems = assigned.filter(i => states[i.i]?.sentToClientAt && states[i.i]?.approvedByClientAt)
    const avgSla = slaItems.length > 0
      ? Math.round(slaItems.reduce((sum, i) => {
          const sent = states[i.i]!.sentToClientAt!
          const approved = states[i.i]!.approvedByClientAt!
          return sum + (approved - sent) / 86_400_000
        }, 0) / slaItems.length * 10) / 10
      : null

    // Workload: items currently active (status 1-4)
    const workload = assigned.filter(i => {
      const s = states[i.i]?.status ?? i.s
      return s >= 1 && s <= 4
    }).length

    // Score: base = published %, penalties for late/rejected
    const publishedPct = total > 0 ? (published.length / total) * 100 : 0
    const score = total > 0
      ? Math.max(0, Math.min(100, Math.round(publishedPct - late.length * 8 - rejected.length * 12 + onTime.length * 2)))
      : null

    return {
      key, info, total,
      published: published.length,
      late: late.length,
      rejected: rejected.length,
      onTime: onTime.length,
      workload,
      avgSla,
      score,
      publishedPct: Math.round(publishedPct),
    }
  }).filter(m => m.total > 0).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)), [items, states, now])

  const teamTotals = useMemo(() => ({
    total: performance.reduce((s, m) => s + m.total, 0),
    published: performance.reduce((s, m) => s + m.published, 0),
    late: performance.reduce((s, m) => s + m.late, 0),
    rejected: performance.reduce((s, m) => s + m.rejected, 0),
    onTime: performance.reduce((s, m) => s + m.onTime, 0),
    avgScore: performance.length > 0
      ? Math.round(performance.filter(m => m.score !== null).reduce((s, m) => s + (m.score ?? 0), 0) / Math.max(1, performance.filter(m => m.score !== null).length))
      : 0,
  }), [performance])

  // Group by role type
  const socios     = members.filter(m => m.info.role === 'Sócio')
  const operacao   = members.filter(m => m.info.role !== 'Sócio' && m.info.role !== 'Gestor de tráfego')
  const trafego    = members.filter(m => m.info.role === 'Gestor de tráfego')

  function MemberCard({ m }: { m: typeof members[0] }) {
    const isCurrentUser = m.key === currentUser?.toLowerCase()
    return (
      <Paper sx={{
        p: { xs: 1.5, md: 2 },
        border: '1px solid',
        borderColor: isCurrentUser ? `${m.info.color}50` : 'rgba(255,255,255,0.06)',
        bgcolor: isCurrentUser ? `${m.info.color}08` : 'transparent',
        position: 'relative', overflow: 'hidden',
        transition: 'border-color 0.2s',
        '&:hover': { borderColor: `${m.info.color}40` },
      }}>
        {/* Glow background for current user */}
        {isCurrentUser && (
          <Box sx={{
            position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%',
            bgcolor: m.info.color, filter: 'blur(30px)', opacity: 0.12, pointerEvents: 'none',
          }} />
        )}

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.5 }}>
          {/* Emoji avatar */}
          <Box sx={{
            width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `radial-gradient(circle, ${m.info.color}22, ${m.info.color}08)`,
            border: `1.5px solid ${m.info.color}40`,
            boxShadow: isCurrentUser ? `0 0 12px ${m.info.glow}` : 'none',
            fontSize: '1.3rem',
          }}>
            {m.info.emoji}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff', lineHeight: 1 }}>
                {getDisplayName(m.key)}
              </Typography>
              {isCurrentUser && (
                <Chip label="Você" size="small" sx={{ fontSize: '0.48rem', height: 14, bgcolor: `${m.info.color}25`, color: m.info.color, border: `1px solid ${m.info.color}40` }} />
              )}
            </Box>
            <Typography sx={{ fontSize: '0.68rem', color: m.info.color, fontWeight: 600, mt: 0.2 }}>
              {m.info.role}
            </Typography>
          </Box>

          {/* Total items badge */}
          {m.totalItems > 0 && (
            <Box sx={{
              px: 1, py: 0.3, borderRadius: 1.5,
              bgcolor: `${m.info.color}15`, border: `1px solid ${m.info.color}30`,
              flexShrink: 0,
            }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: m.info.color }}>
                {m.totalItems} itens
              </Typography>
            </Box>
          )}
        </Box>

        {/* Stats row */}
        {m.totalItems > 0 ? (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5, mb: 1 }}>
              {[
                { label: 'Feitos',      value: m.done,       color: '#31D17C' },
                { label: 'Andamento',   value: m.inProgress, color: '#F59E0B' },
                { label: 'Pendentes',   value: m.pending,    color: '#9CA3AF' },
                { label: 'Atrasados',   value: m.late,       color: m.late > 0 ? '#EF4444' : '#9CA3AF' },
              ].map(s => (
                <Box key={s.label} sx={{ textAlign: 'center', p: 0.5, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.03)' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: s.color, lineHeight: 1 }}>{s.value}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.48rem', textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.label}</Typography>
                </Box>
              ))}
            </Box>

            {/* Progress bar */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.58rem' }}>Progresso</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 700, color: m.pct === 100 ? '#31D17C' : m.info.color }}>{m.pct}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate" value={m.pct}
                sx={{
                  height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)',
                  '& .MuiLinearProgress-bar': { bgcolor: m.pct === 100 ? '#31D17C' : m.info.color },
                }}
              />
            </Box>
          </>
        ) : (
          <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
            Nenhum item atribuído
          </Typography>
        )}
      </Paper>
    )
  }

  function Section({ title, list }: { title: string; list: typeof members }) {
    if (list.length === 0) return null
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="overline" color="primary.main" fontWeight={700} sx={{ letterSpacing: 1, fontSize: '0.6rem' }}>
          {title}
        </Typography>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 1 }}>
          {list.map(m => <MemberCard key={m.key} m={m} />)}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Header (PageHero) ── */}
      <PageHero
        title="Equipe"
        subtitle="Capacidade, distribuição e performance por membro do time."
        actions={
          <>
            <Chip label={`${members.length} membros`} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 22 }} />
            {/* View toggle */}
            <Box sx={{ display: 'flex', gap: 0.5, p: 0.4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {([
            { id: 'overview',     icon: <GroupIcon sx={{ fontSize: 13 }} />,       label: 'Equipe'      },
            { id: 'performance',  icon: <LeaderboardIcon sx={{ fontSize: 13 }} />, label: 'Performance' },
          ] as const).map(tab => (
            <Box
              key={tab.id}
              onClick={() => setView(tab.id)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                px: 1.2, py: 0.5, borderRadius: 1.5, cursor: 'pointer',
                bgcolor: view === tab.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: view === tab.id ? 'primary.main' : 'text.secondary',
                border: view === tab.id ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                transition: 'all 0.2s ease',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              {tab.icon}
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700 }}>{tab.label}</Typography>
            </Box>
          ))}
            </Box>
          </>
        }
      />

      {/* ━━━━━━━━━━━━━━━━━━━━━ PERFORMANCE VIEW ━━━━━━━━━━━━━━━━━━━━━ */}
      {view === 'performance' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* KPI Summary row */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3,1fr)', md: 'repeat(6,1fr)' }, gap: 1 }}>
            {[
              { label: 'Total atribuído',   value: teamTotals.total,     color: '#3B82F6' },
              { label: 'Publicados',         value: teamTotals.published, color: '#31D17C' },
              { label: 'Atrasados',          value: teamTotals.late,      color: teamTotals.late > 0 ? '#EF4444' : '#9CA3AF' },
              { label: 'Reprovados',         value: teamTotals.rejected,  color: teamTotals.rejected > 0 ? '#EF4444' : '#9CA3AF' },
              { label: 'No prazo',           value: teamTotals.onTime,    color: '#31D17C' },
              { label: 'Score médio',        value: `${teamTotals.avgScore}`,  color: teamTotals.avgScore >= 70 ? '#31D17C' : teamTotals.avgScore >= 40 ? '#F59E0B' : '#EF4444' },
            ].map(k => (
              <Paper key={k.label} sx={{ p: { xs: 1, md: 1.5 }, textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.4rem', md: '2rem' }, color: k.color, lineHeight: 1 }}>{k.value}</Typography>
                <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mt: 0.3 }}>{k.label}</Typography>
              </Paper>
            ))}
          </Box>

          {/* Ranking table */}
          <Paper sx={{ border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            {/* Table header */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '20px 1fr 50px 40px 40px 40px', md: '24px 1fr 64px 52px 52px 52px 52px 52px' },
              gap: { xs: 0.5, md: 1 },
              px: { xs: 1.2, md: 2 }, py: 1,
              bgcolor: 'rgba(255,255,255,0.03)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              {['#', 'Membro', 'Score', 'Public.', 'Atrasos', 'Reprov.', 'No Prazo', 'Carga'].map((h, i) => (
                <Typography key={h} sx={{
                  fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: 'rgba(255,255,255,0.35)',
                  display: i >= 6 ? { xs: 'none', md: 'block' } : 'block',
                }}>{h}</Typography>
              ))}
            </Box>

            {/* Rows */}
            {performance.map((m, idx) => {
              const scorColor = m.score === null ? '#9CA3AF' : m.score >= 70 ? '#31D17C' : m.score >= 40 ? '#F59E0B' : '#EF4444'
              const isMe = m.key === currentUser?.toLowerCase()
              return (
                <Box key={m.key} sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '20px 1fr 50px 40px 40px 40px', md: '24px 1fr 64px 52px 52px 52px 52px 52px' },
                  gap: { xs: 0.5, md: 1 },
                  px: { xs: 1.2, md: 2 }, py: { xs: 0.9, md: 1.1 },
                  alignItems: 'center',
                  borderBottom: idx < performance.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  bgcolor: isMe ? `${m.info.color}08` : idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                  transition: 'background 0.15s',
                }}>
                  {/* Rank */}
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: idx === 0 ? '#F59E0B' : idx === 1 ? '#A8A8A8' : idx === 2 ? '#CD7F32' : 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                  </Typography>

                  {/* Member */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0 }}>
                    <Box sx={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: `${m.info.color}18`, border: `1.5px solid ${m.info.color}40`,
                      fontSize: '0.8rem',
                    }}>
                      {m.info.emoji}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: isMe ? m.info.color : 'rgba(255,255,255,0.88)' }} noWrap>
                        {getDisplayName(m.key)}
                      </Typography>
                      <Typography sx={{ fontSize: '0.52rem', color: 'text.secondary' }} noWrap>{m.info.role}</Typography>
                    </Box>
                  </Box>

                  {/* Score */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 900, color: scorColor, lineHeight: 1 }}>
                        {m.score ?? '—'}
                      </Typography>
                      {m.score !== null && <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1 }}>/100</Typography>}
                    </Box>
                    {m.score !== null && (
                      <LinearProgress
                        variant="determinate" value={m.score}
                        sx={{ height: 2, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { bgcolor: scorColor } }}
                      />
                    )}
                  </Box>

                  {/* Publicados */}
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#31D17C' }}>{m.published}</Typography>
                    <Typography sx={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.3)' }}>{m.publishedPct}%</Typography>
                  </Box>

                  {/* Atrasos */}
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: m.late > 0 ? '#EF4444' : 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
                    {m.late > 0 ? m.late : '—'}
                  </Typography>

                  {/* Reprovados */}
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: m.rejected > 0 ? '#EF4444' : 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
                    {m.rejected > 0 ? m.rejected : '—'}
                  </Typography>

                  {/* No prazo */}
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: m.onTime > 0 ? '#31D17C' : 'rgba(255,255,255,0.25)', textAlign: 'center', display: { xs: 'none', md: 'block' } }}>
                    {m.onTime > 0 ? m.onTime : '—'}
                  </Typography>

                  {/* Carga atual */}
                  <Tooltip title={`${m.workload} itens em andamento`} placement="top">
                    <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.4 }}>
                      <Box sx={{
                        px: 0.8, py: 0.2, borderRadius: 1,
                        bgcolor: m.workload > 8 ? 'rgba(239,68,68,0.15)' : m.workload > 4 ? 'rgba(245,158,11,0.12)' : 'rgba(49,209,124,0.1)',
                        border: `1px solid ${m.workload > 8 ? 'rgba(239,68,68,0.3)' : m.workload > 4 ? 'rgba(245,158,11,0.25)' : 'rgba(49,209,124,0.2)'}`,
                      }}>
                        <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: m.workload > 8 ? '#EF4444' : m.workload > 4 ? '#F59E0B' : '#31D17C' }}>
                          {m.workload}
                        </Typography>
                      </Box>
                    </Box>
                  </Tooltip>
                </Box>
              )
            })}

            {performance.length === 0 && (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)' }}>
                  Nenhum item atribuído ainda — atribua responsáveis nos cards de conteúdo
                </Typography>
              </Box>
            )}
          </Paper>

          {/* SLA individual cards */}
          {performance.filter(m => m.avgSla !== null).length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="overline" color="primary.main" fontWeight={700} sx={{ fontSize: '0.6rem', letterSpacing: 1 }}>
                SLA Médio de Aprovação pelo Cliente
              </Typography>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(4,1fr)', xl: 'repeat(6,1fr)' }, gap: 1 }}>
                {performance.filter(m => m.avgSla !== null).map(m => (
                  <Paper key={m.key} sx={{ p: { xs: 1, md: 1.5 }, textAlign: 'center', border: `1px solid ${m.info.color}25` }}>
                    <Typography sx={{ fontSize: '1rem' }}>{m.info.emoji}</Typography>
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: m.info.color, mt: 0.3 }}>{getDisplayName(m.key)}</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: '1.4rem', color: m.avgSla! <= 1 ? '#31D17C' : m.avgSla! <= 3 ? '#F59E0B' : '#EF4444', lineHeight: 1, mt: 0.3 }}>
                      {m.avgSla}d
                    </Typography>
                    <Typography sx={{ fontSize: '0.52rem', color: 'text.secondary', textTransform: 'uppercase' }}>SLA médio</Typography>
                  </Paper>
                ))}
              </Box>
            </Box>
          )}

          {/* Legend */}
          <Paper sx={{ p: 1.5, border: '1px solid rgba(59,130,246,0.1)', bgcolor: 'rgba(59,130,246,0.03)' }}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'primary.main', mb: 0.5 }}>Como é calculado o Score?</Typography>
            <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
              Score = % publicados − (atrasos × 8) − (reprovados × 12) + (entregas no prazo × 2) · Máx 100, Mín 0.<br />
              SLA = média de dias entre "enviado ao cliente" e "aprovado pelo cliente".<br />
              Carga = itens com status Em edição, Aprovação interna, Aprovado interno ou Enviado ao cliente.
            </Typography>
          </Paper>
        </Box>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━ OVERVIEW VIEW ━━━━━━━━━━━━━━━━━━━━━━ */}
      {view === 'overview' && <>

      {/* ── Team summary ── */}
      <Paper sx={{ p: { xs: 1.2, md: 1.8 }, border: '1px solid rgba(59,130,246,0.15)', background: 'linear-gradient(135deg,#1a1a1a,#1c1408)' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          {[
            { label: 'Sócios',          value: socios.length,   color: '#F59E0B' },
            { label: 'Operação',        value: operacao.length, color: '#3B82F6' },
            { label: 'Tráfego',         value: trafego.length,  color: '#31D17C' },
          ].map(s => (
            <Box key={s.label} sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 900, fontSize: '1.6rem', color: s.color, lineHeight: 1 }}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.58rem' }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* ── Sections ── */}
      <Section title="Sócios" list={socios} />
      <Section title="Operação" list={operacao} />
      <Section title="Gestores de Tráfego" list={trafego} />

      {/* Tip */}
      <Paper sx={{ p: 1.5, border: '1px solid rgba(59,130,246,0.1)', bgcolor: 'rgba(59,130,246,0.03)' }}>
        <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
          💡 Para atribuir itens a um membro, use o campo "Responsável" dentro do card de conteúdo. As estatísticas acima refletem itens atribuídos.
        </Typography>
      </Paper>
      </>}
    </Box>
  )
}
