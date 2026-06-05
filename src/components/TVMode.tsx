import { useMemo, useState, useEffect, useCallback } from 'react'
import { Box, Typography, LinearProgress, IconButton, Tooltip } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import type { Client, ContentItem, ItemState } from '../types'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  now: Date
  onClose: () => void
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const WEEKDAYS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

function useClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

export default function TVMode({ items, states, allClients, now, onClose }: Props) {
  const clock = useClock()
  const [isFullscreen, setIsFullscreen] = useState(false)

  const today = useMemo(() => { const d = new Date(now); d.setHours(0,0,0,0); return d }, [now])
  const lastDay = useMemo(() => new Date(now.getFullYear(), now.getMonth()+1, 0).getDate(), [now])
  const daysLeft = lastDay - now.getDate()

  // ESC para fechar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // KPIs globais
  const global = useMemo(() => {
    const total     = items.length
    const published = items.filter(i => (states[i.i]?.status ?? i.s) === 7).length
    const late      = items.filter(i => (states[i.i]?.status ?? i.s) !== 7 && new Date(i.dt) < today).length
    const awaiting  = items.filter(i => [2,3,4].includes(states[i.i]?.status ?? i.s)).length
    const pct       = total > 0 ? Math.round((published/total)*100) : 0
    return { total, published, late, awaiting, pct }
  }, [items, states, today])

  // Conteúdos pra publicar hoje (aprovados e com data = hoje)
  const todayPublish = useMemo(() =>
    items.filter(i => {
      const d = new Date(i.dt); d.setHours(0,0,0,0)
      const st = states[i.i]?.status ?? i.s
      return d.getTime() === today.getTime() && st !== 7 && [2,3,4,5].includes(st)
    }).slice(0, 8),
  [items, states, today])

  // Stats por cliente
  const clientStats = useMemo(() =>
    allClients.map(c => {
      const ci        = items.filter(i => i.c === c.name)
      const total     = ci.length
      const published = ci.filter(i => (states[i.i]?.status ?? i.s) === 7).length
      const late      = ci.filter(i => (states[i.i]?.status ?? i.s) !== 7 && new Date(i.dt) < today).length
      const awaiting  = ci.filter(i => [2,4].includes(states[i.i]?.status ?? i.s)).length
      const pct       = total > 0 ? Math.round((published/total)*100) : 0
      return { name: c.name, total, published, late, awaiting, pct }
    }).filter(c => c.total > 0),
  [allClients, items, states, today])

  const pctColor = (pct: number, late: number) =>
    late > 0 ? '#EF4444' : pct === 100 ? '#22C55E' : pct >= 60 ? '#F97316' : pct >= 30 ? '#F59E0B' : '#EF4444'

  const timeStr = clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = `${WEEKDAYS[clock.getDay()]}, ${clock.getDate()} de ${MONTHS[clock.getMonth()]} ${clock.getFullYear()}`

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 9999,
      bgcolor: '#03040a',
      display: 'flex', flexDirection: 'column',
      fontFamily: '"Inter", system-ui, sans-serif',
      // Grid sutil de fundo
      backgroundImage: [
        'linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px)',
        'linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)',
      ].join(','),
      backgroundSize: '60px 60px',
      overflow: 'hidden',
    }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <Box sx={{
        px: 4, py: 1.8, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 3,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(0,0,0,0) 60%)',
      }}>
        {/* Logo + agência */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 38, height: 38, borderRadius: 2,
            background: 'linear-gradient(135deg, #F97316, #ff5339)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(249,115,22,0.4)',
            fontSize: '1.1rem', lineHeight: 1,
          }}>⚡</Box>
          <Box>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.02em' }}>
              Digital Scale
            </Typography>
            <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Agency Dashboard
            </Typography>
          </Box>
        </Box>

        {/* Mês */}
        <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1.5, bgcolor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
          <Typography sx={{ fontSize: '0.72rem', color: '#F97316', fontWeight: 700 }}>
            {MONTHS[now.getMonth()]} {now.getFullYear()} · {daysLeft}d restantes
          </Typography>
        </Box>

        {/* KPIs inline */}
        <Box sx={{ display: 'flex', gap: 3, flex: 1, justifyContent: 'center' }}>
          {[
            { label: 'Publicados', value: `${global.published}/${global.total}`, color: '#22C55E', sub: `${global.pct}%` },
            { label: 'Atrasados',  value: global.late,    color: global.late > 0 ? '#EF4444' : '#22C55E' },
            { label: 'Aprovação',  value: global.awaiting, color: '#60A5FA' },
          ].map(k => (
            <Box key={k.label} sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, color: k.color, lineHeight: 1, letterSpacing: '-0.03em' }}>
                {k.value}
                {k.sub && <Typography component="span" sx={{ fontSize: '0.9rem', fontWeight: 700, ml: 0.5, color: k.color }}>{k.sub}</Typography>}
              </Typography>
              <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                {k.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Relógio */}
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
            {timeStr}
          </Typography>
          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.2 }}>{dateStr}</Typography>
        </Box>

        {/* Controles */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={isFullscreen ? 'Sair do fullscreen' : 'Fullscreen (F11)'}>
            <IconButton onClick={toggleFullscreen} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}>
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Fechar (ESC)">
            <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#EF4444', bgcolor: 'rgba(239,68,68,0.1)' } }}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Corpo ────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>

        {/* ── Coluna esquerda: Hoje ────────────────────────── */}
        <Box sx={{
          width: 300, flexShrink: 0, p: 2.5,
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', gap: 1.5, overflowY: 'auto',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Box sx={{ width: 3, height: 18, borderRadius: 2, bgcolor: '#F97316' }} />
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Publicar hoje
            </Typography>
            {todayPublish.length > 0 && (
              <Box sx={{ ml: 'auto', px: 1, py: 0.2, borderRadius: 1, bgcolor: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)' }}>
                <Typography sx={{ fontSize: '0.6rem', color: '#F97316', fontWeight: 800 }}>{todayPublish.length}</Typography>
              </Box>
            )}
          </Box>

          {todayPublish.length === 0 ? (
            <Box sx={{ px: 1.5, py: 2, borderRadius: 2, bgcolor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.2rem', mb: 0.5 }}>✅</Typography>
              <Typography sx={{ fontSize: '0.68rem', color: '#22C55E', fontWeight: 700 }}>Tudo publicado hoje</Typography>
            </Box>
          ) : (
            todayPublish.map(item => {
              const st = states[item.i]?.status ?? item.s
              const title = states[item.i]?.title || item.n
              return (
                <Box key={item.i} sx={{
                  px: 1.5, py: 1.2, borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderLeft: '3px solid #F97316',
                }}>
                  <Typography sx={{ fontSize: '0.6rem', color: '#F97316', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.3 }}>
                    {item.c}
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: '#fff', fontWeight: 600, lineHeight: 1.3 }} noWrap>
                    {title}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.06)', px: 0.7, py: 0.15, borderRadius: 0.8 }}>
                      {item.tp}
                    </Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: st === 5 ? '#22C55E' : '#60A5FA', fontWeight: 600 }}>
                      {st === 5 ? '✓ Aprovado cliente' : st === 3 ? '✓ Aprovado interno' : 'Aguardando'}
                    </Typography>
                  </Box>
                </Box>
              )
            })
          )}

          {/* Alertas urgentes */}
          {global.late > 0 && (
            <Box sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Box sx={{ width: 3, height: 18, borderRadius: 2, bgcolor: '#EF4444' }} />
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Atrasados
                </Typography>
              </Box>
              {items
                .filter(i => (states[i.i]?.status ?? i.s) !== 7 && new Date(i.dt) < today)
                .slice(0, 5)
                .map(item => (
                  <Box key={item.i} sx={{ px: 1.5, py: 1, borderRadius: 2, mb: 0.8, bgcolor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderLeft: '3px solid #EF4444' }}>
                    <Typography sx={{ fontSize: '0.6rem', color: '#EF4444', fontWeight: 700 }}>{item.c}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.3 }} noWrap>
                      {states[item.i]?.title || item.n}
                    </Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)' }}>
                      {new Date(item.dt).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })}
                    </Typography>
                  </Box>
                ))}
            </Box>
          )}
        </Box>

        {/* ── Grid de clientes ─────────────────────────────── */}
        <Box sx={{ flex: 1, p: 2.5, overflowY: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box sx={{ width: 3, height: 18, borderRadius: 2, bgcolor: '#F97316' }} />
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Clientes — {clientStats.length} ativos
            </Typography>
          </Box>

          <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 1.5,
          }}>
            {clientStats.map(c => {
              const color = pctColor(c.pct, c.late)
              const isOk  = c.pct === 100
              const isLate = c.late > 0
              return (
                <Box key={c.name} sx={{
                  p: 2, borderRadius: 2,
                  bgcolor: isOk ? 'rgba(34,197,94,0.05)' : isLate ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isOk ? 'rgba(34,197,94,0.2)' : isLate ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  borderTop: `3px solid ${color}`,
                  transition: 'all 0.3s',
                }}>
                  {/* Nome */}
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', lineHeight: 1.2, mb: 0.4 }} noWrap>
                    {c.name}
                  </Typography>

                  {/* Barra de progresso */}
                  <LinearProgress
                    variant="determinate" value={c.pct}
                    sx={{
                      height: 5, borderRadius: 3, mb: 1,
                      bgcolor: 'rgba(255,255,255,0.08)',
                      '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                    }}
                  />

                  {/* Stats */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)' }}>
                      {c.published}/{c.total} posts
                    </Typography>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em' }}>
                      {c.pct}%
                    </Typography>
                  </Box>

                  {/* Badges */}
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.8, flexWrap: 'wrap' }}>
                    {isOk && (
                      <Box sx={{ px: 0.8, py: 0.2, borderRadius: 1, bgcolor: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
                        <Typography sx={{ fontSize: '0.55rem', color: '#22C55E', fontWeight: 700 }}>✅ Completo</Typography>
                      </Box>
                    )}
                    {c.late > 0 && (
                      <Box sx={{ px: 0.8, py: 0.2, borderRadius: 1, bgcolor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                        <Typography sx={{ fontSize: '0.55rem', color: '#EF4444', fontWeight: 700 }}>⚠️ {c.late} atrasado{c.late > 1 ? 's' : ''}</Typography>
                      </Box>
                    )}
                    {c.awaiting > 0 && !isLate && (
                      <Box sx={{ px: 0.8, py: 0.2, borderRadius: 1, bgcolor: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
                        <Typography sx={{ fontSize: '0.55rem', color: '#60A5FA', fontWeight: 700 }}>👁 {c.awaiting} aprovação</Typography>
                      </Box>
                    )}
                    {!isOk && c.late === 0 && c.awaiting === 0 && (
                      <Box sx={{ px: 0.8, py: 0.2, borderRadius: 1, bgcolor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
                        <Typography sx={{ fontSize: '0.55rem', color: '#F97316', fontWeight: 700 }}>🔄 Em produção</Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              )
            })}
          </Box>
        </Box>
      </Box>

      {/* ── Rodapé ───────────────────────────────────────────── */}
      <Box sx={{
        px: 4, py: 1, flexShrink: 0,
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.18)', letterSpacing: '0.06em' }}>
          DS HUB · Atualizado automaticamente · ESC para fechar
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#22C55E', boxShadow: '0 0 8px #22C55E', animation: 'glowPulse 2s ease-in-out infinite' }} />
          <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>AO VIVO</Typography>
        </Box>
      </Box>
    </Box>
  )
}
