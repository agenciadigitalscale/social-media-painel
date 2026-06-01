import { useMemo } from 'react'
import {
  Box, Typography, Paper, Chip, Divider, LinearProgress,
} from '@mui/material'
import GroupIcon from '@mui/icons-material/Group'
import { NAME_MAP, getDisplayName } from '../lib/users'
import type { ContentItem, ItemState } from '../types'
import CursorGlow from './CursorGlow'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  currentUser?: string
}

export default function EquipeTab({ items, states, currentUser }: Props) {
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
        transition: 'all 0.28s ease',
        '&::after': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${m.info.color}55 30%, ${m.info.color}88 50%, ${m.info.color}55 70%, transparent)`, pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit' },
        '&:hover': { borderColor: `${m.info.color}40`, transform: 'translateY(-3px)', boxShadow: '0 10px 32px rgba(0,0,0,0.55)' },
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
                { label: 'Feitos',      value: m.done,       color: '#00C47A' },
                { label: 'Andamento',   value: m.inProgress, color: '#FFD700' },
                { label: 'Pendentes',   value: m.pending,    color: '#A1A1AA' },
                { label: 'Atrasados',   value: m.late,       color: m.late > 0 ? '#FF4545' : '#A1A1AA' },
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
                <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 700, color: m.pct === 100 ? '#00C47A' : m.info.color }}>{m.pct}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate" value={m.pct}
                sx={{
                  height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)',
                  '& .MuiLinearProgress-bar': { bgcolor: m.pct === 100 ? '#00C47A' : m.info.color },
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
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}>
      <CursorGlow color="rgba(255,144,57,0.05)" size={420} />

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <GroupIcon sx={{ color: 'primary.main', fontSize: 22 }} />
        <Typography fontWeight={800} sx={{ fontSize: { xs: '1rem', md: '1.1rem' } }}>Equipe</Typography>
        <Chip label={`${members.length} membros`} size="small" variant="outlined" sx={{ fontSize: '0.6rem', ml: 'auto' }} />
      </Box>

      {/* ── Team summary ── */}
      <Paper sx={{ p: { xs: 1.2, md: 1.8 }, border: '1px solid rgba(255,144,57,0.15)', background: 'linear-gradient(135deg,#1a1a1a,#1c1408)', position: 'relative', '&::after': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,144,57,0.55) 30%, rgba(255,144,57,0.88) 50%, rgba(255,144,57,0.55) 70%, transparent)', pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit' } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          {[
            { label: 'Sócios',          value: socios.length,   color: '#FFD700' },
            { label: 'Operação',        value: operacao.length, color: '#ff9039' },
            { label: 'Tráfego',         value: trafego.length,  color: '#00C47A' },
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
      <Paper sx={{ p: 1.5, border: '1px solid rgba(255,144,57,0.1)', bgcolor: 'rgba(255,144,57,0.03)', position: 'relative', '&::after': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,144,57,0.55) 30%, rgba(255,144,57,0.88) 50%, rgba(255,144,57,0.55) 70%, transparent)', pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit' } }}>
        <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
          💡 Para atribuir itens a um membro, use o campo "Responsável" dentro do card de conteúdo. As estatísticas acima refletem itens atribuídos.
        </Typography>
      </Paper>
    </Box>
  )
}
