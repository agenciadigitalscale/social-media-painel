import { useMemo } from 'react'
import {
  Box, Typography, Paper, Chip, Divider, LinearProgress,
} from '@mui/material'
import GroupIcon from '@mui/icons-material/Group'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
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

  const socios   = members.filter(m => m.info.role === 'Sócio')
  const operacao = members.filter(m => m.info.role !== 'Sócio' && m.info.role !== 'Gestor de tráfego')
  const trafego  = members.filter(m => m.info.role === 'Gestor de tráfego')

  function MemberCard({ m }: { m: typeof members[0] }) {
    const isCurrentUser = m.key === currentUser?.toLowerCase()
    const color = m.info.color
    const glow  = m.info.glow

    return (
      <Paper sx={{
        p: { xs: 1.5, md: 2, xl: 2.5 },
        border: '1px solid',
        borderColor: isCurrentUser ? `${color}50` : `${color}18`,
        bgcolor: isCurrentUser ? `${color}08` : `${color}04`,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.28s ease',
        boxShadow: isCurrentUser ? `0 0 24px ${color}25` : 'none',
        '&::after': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: `linear-gradient(90deg, transparent, ${color}55 30%, ${color}88 50%, ${color}55 70%, transparent)`,
          pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit',
        },
        '&:hover': {
          borderColor: `${color}45`,
          transform: 'translateY(-3px)',
          boxShadow: `0 10px 32px rgba(0,0,0,0.55), 0 0 28px ${color}18`,
        },
      }}>
        {/* Glow orb for current user */}
        {isCurrentUser && (
          <Box sx={{
            position: 'absolute', top: -30, right: -30, width: 100, height: 100,
            borderRadius: '50%', bgcolor: color,
            filter: 'blur(40px)', opacity: 0.1, pointerEvents: 'none',
          }} />
        )}

        {/* Online indicator */}
        <Box sx={{
          position: 'absolute', top: 12, right: 12,
          width: 7, height: 7, borderRadius: '50%',
          bgcolor: color, boxShadow: `0 0 6px ${glow}`,
          '@keyframes memberPulse': {
            '0%,100%': { opacity: 1, transform: 'scale(1)' },
            '50%': { opacity: 0.5, transform: 'scale(1.35)' },
          },
          animation: 'memberPulse 3s ease-in-out infinite',
        }} />

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.8 }}>
          {/* Large avatar */}
          <Box sx={{
            width: { xs: 52, xl: 64 }, height: { xs: 52, xl: 64 },
            borderRadius: 2.5, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: `${color}14`,
            border: `2px solid ${color}35`,
            boxShadow: `0 0 24px ${color}25`,
            fontSize: { xs: '1.6rem', xl: '2rem' },
            position: 'relative',
          }}>
            {m.info.emoji}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5 }}>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: '0.95rem', xl: '1.08rem' }, color: '#fff', lineHeight: 1 }}>
                {getDisplayName(m.key)}
              </Typography>
              {isCurrentUser && (
                <Chip
                  label="Você"
                  size="small"
                  sx={{
                    fontSize: '0.5rem', height: 15, fontWeight: 700,
                    bgcolor: `${color}25`, color, border: `1px solid ${color}40`,
                  }}
                />
              )}
            </Box>

            {/* Role badge */}
            <Chip
              label={m.info.role}
              size="small"
              sx={{
                fontSize: { xs: '0.6rem', xl: '0.68rem' }, height: 20, fontWeight: 700,
                bgcolor: `${color}18`, color, border: `1px solid ${color}35`,
                letterSpacing: '0.02em',
              }}
            />
          </Box>

          {m.totalItems > 0 && (
            <Box sx={{
              px: 1.2, py: 0.4, borderRadius: 2,
              bgcolor: `${color}15`, border: `1px solid ${color}30`, flexShrink: 0,
            }}>
              <Typography sx={{ fontSize: { xs: '0.68rem', xl: '0.75rem' }, fontWeight: 700, color }}>
                {m.totalItems}
              </Typography>
              <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>
                itens
              </Typography>
            </Box>
          )}
        </Box>

        {/* Stats grid */}
        {m.totalItems > 0 ? (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.6, mb: 1.2 }}>
              {[
                { label: 'Feitos',    value: m.done,       color: '#00C47A', Icon: CheckCircleIcon },
                { label: 'Andamento', value: m.inProgress, color: '#FFD700', Icon: HourglassEmptyIcon },
                { label: 'Pendentes', value: m.pending,    color: '#A1A1AA', Icon: RadioButtonUncheckedIcon },
                { label: 'Atrasados', value: m.late,       color: m.late > 0 ? '#FF4545' : '#A1A1AA', Icon: WarningAmberIcon },
              ].map(s => (
                <Box key={s.label} sx={{
                  textAlign: 'center', p: 0.7, borderRadius: 1.5,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <s.Icon sx={{ fontSize: 11, color: s.color, display: 'block', mx: 'auto', mb: 0.2 }} />
                  <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.05rem', xl: '1.2rem' }, color: s.color, lineHeight: 1 }}>
                    {s.value}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.47rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.3)' }}>
                    {s.label}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Performance bar */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Progresso
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 800, color: m.pct === 100 ? '#00C47A' : color }}>
                  {m.pct}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={m.pct}
                sx={{
                  height: 5, borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.06)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    bgcolor: m.pct === 100 ? '#00C47A' : color,
                    boxShadow: `0 0 8px ${m.pct === 100 ? '#00C47A' : color}80`,
                  },
                }}
              />
            </Box>
          </>
        ) : (
          <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.22)', fontStyle: 'italic' }}>
            Nenhum item atribuído
          </Typography>
        )}
      </Paper>
    )
  }

  function Section({ title, list, color }: { title: string; list: typeof members; color?: string }) {
    if (list.length === 0) return null
    const accentColor = color ?? '#ff9039'
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
        {/* Section header with vertical accent bar + count badge */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box sx={{
            width: 3, height: 20, borderRadius: 2,
            bgcolor: accentColor,
            boxShadow: `0 0 8px ${accentColor}80`,
            flexShrink: 0,
          }} />
          <Typography sx={{
            fontSize: '0.6rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.5)',
          }}>
            {title}
          </Typography>
          <Chip
            label={list.length}
            size="small"
            sx={{
              fontSize: '0.55rem', height: 17, fontWeight: 700,
              bgcolor: `${accentColor}15`, color: accentColor,
              border: `1px solid ${accentColor}30`,
            }}
          />
        </Box>
        <Divider sx={{ borderColor: `${accentColor}12` }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 1.2 }}>
          {list.map(m => <MemberCard key={m.key} m={m} />)}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3 }, display: 'flex', flexDirection: 'column', gap: 2.5, position: 'relative' }}>
      <CursorGlow color="rgba(255,144,57,0.05)" size={420} />

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <GroupIcon sx={{ color: 'primary.main', fontSize: { xs: 20, xl: 26 } }} />
        <Typography fontWeight={800} sx={{ fontSize: { xs: '1rem', md: '1.1rem', xl: '1.3rem' } }}>
          Equipe
        </Typography>
        <Chip
          label={`${members.length} membros`}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.6rem', ml: 'auto', borderColor: 'rgba(255,144,57,0.3)', color: 'rgba(255,144,57,0.8)' }}
        />
      </Box>

      {/* Team summary KPI panel */}
      <Paper sx={{
        p: { xs: 1.5, md: 2, xl: 2.5 },
        border: '1px solid rgba(255,144,57,0.15)',
        background: 'linear-gradient(135deg, rgba(26,20,8,0.9), rgba(18,14,6,0.9))',
        position: 'relative',
        overflow: 'hidden',
        '&::after': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(255,144,57,0.55) 30%, rgba(255,144,57,0.88) 50%, rgba(255,144,57,0.55) 70%, transparent)',
          pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit',
        },
      }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: { xs: 1, xl: 2 } }}>
          {[
            { label: 'Sócios',   value: socios.length,   color: '#FFD700', icon: '👑' },
            { label: 'Operação', value: operacao.length,  color: '#ff9039', icon: '⚡' },
            { label: 'Tráfego',  value: trafego.length,   color: '#00C47A', icon: '📈' },
          ].map(s => (
            <Box key={s.label} sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6, mb: 0.3 }}>
                <Typography sx={{ fontSize: { xs: '1rem', xl: '1.2rem' }, lineHeight: 1 }}>{s.icon}</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.8rem', xl: '2.4rem' }, color: s.color, lineHeight: 1, letterSpacing: '-0.03em' }}>
                  {s.value}
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ fontSize: { xs: '0.6rem', xl: '0.7rem' }, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {s.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Sections */}
      <Section title="Sócios"              list={socios}   color="#FFD700" />
      <Section title="Operação"            list={operacao}  color="#ff9039" />
      <Section title="Gestores de Tráfego" list={trafego}   color="#00C47A" />

      {/* Tip */}
      <Paper sx={{
        p: 1.5,
        border: '1px solid rgba(255,144,57,0.1)',
        bgcolor: 'rgba(255,144,57,0.03)',
        position: 'relative',
        '&::after': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(255,144,57,0.4) 30%, rgba(255,144,57,0.65) 50%, rgba(255,144,57,0.4) 70%, transparent)',
          pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit',
        },
      }}>
        <Typography sx={{ fontSize: { xs: '0.68rem', xl: '0.75rem' }, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
          💡 Para atribuir itens a um membro, use o campo "Responsável" dentro do card de conteúdo. As estatísticas acima refletem itens atribuídos.
        </Typography>
      </Paper>
    </Box>
  )
}
