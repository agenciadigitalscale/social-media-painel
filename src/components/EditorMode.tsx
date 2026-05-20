import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Box, Typography, Paper, Chip, Button, Tooltip,
  IconButton, Collapse, LinearProgress,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import CheckIcon from '@mui/icons-material/Check'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import MovieIcon from '@mui/icons-material/Movie'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import type { ContentItem, ItemState, Roteiro, Status } from '../types'

// ── Types ────────────────────────────────────────────────

interface TimerState {
  startedAt?: number
  accumulated: number
}

interface EditorSession {
  itemId: number
  client: string
  title: string
  duration: number
  date: string
  type: string
}

// ── Persistence ──────────────────────────────────────────

function loadTimers(): Record<number, TimerState> {
  try { return JSON.parse(localStorage.getItem('sm_editor_timers') ?? '{}') } catch { return {} }
}
function loadSessions(): EditorSession[] {
  try { return JSON.parse(localStorage.getItem('sm_editor_sessions') ?? '[]') } catch { return [] }
}
function saveTimers(t: Record<number, TimerState>) { localStorage.setItem('sm_editor_timers', JSON.stringify(t)) }
function saveSessions(s: EditorSession[]) { localStorage.setItem('sm_editor_sessions', JSON.stringify(s)) }

// ── Formatters ───────────────────────────────────────────

function formatTimer(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Props ────────────────────────────────────────────────

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, status: Status) => void
  onUpdate: (id: number, patch: Partial<ItemState>) => void
  roteiros: Record<string, Roteiro[]>
  clientFolders: Record<string, string>
  now: Date
}

// ── Main ─────────────────────────────────────────────────

export default function EditorMode({ items, states, onStatusChange, roteiros, clientFolders, now }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [timers, setTimers] = useState<Record<number, TimerState>>(loadTimers)
  const [sessions, setSessions] = useState<EditorSession[]>(loadSessions)
  const [tick, setTick] = useState(0)
  const [celebrateId, setCelebrateId] = useState<number | null>(null)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const celebrateRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Queue ─────────────────────────────────────────────

  const videoQueue = useMemo(() => {
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    return items
      .filter(i => {
        const st = states[i.i]?.status ?? i.s
        return (i.tp === 'Reel' || i.tp === 'Story') && st < 4
      })
      .sort((a, b) => {
        const sa = states[a.i]?.status ?? a.s
        const sb = states[b.i]?.status ?? b.s
        if (sa === 1 && sb !== 1) return -1
        if (sb === 1 && sa !== 1) return 1
        const aLate = a.dt < today ? 1 : 0
        const bLate = b.dt < today ? 1 : 0
        if (aLate !== bLate) return bLate - aLate
        return a.dt.getTime() - b.dt.getTime()
      })
  }, [items, states, now])

  const currentItem = useMemo(() => {
    if (selectedId) {
      const found = videoQueue.find(i => i.i === selectedId)
      if (found) return found
    }
    return videoQueue[0] ?? null
  }, [selectedId, videoQueue])

  const currentState = currentItem
    ? (states[currentItem.i] ?? { status: 0, title: '', link: '', caption: '', notes: '' } as ItemState)
    : null

  // ── Timer ─────────────────────────────────────────────

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getElapsed = useCallback((itemId: number): number => {
    const t = timers[itemId]
    if (!t) return 0
    const live = t.startedAt ? (Date.now() - t.startedAt) : 0
    return t.accumulated + live
  }, [timers, tick])

  const isRunning = currentItem ? Boolean(timers[currentItem.i]?.startedAt) : false

  const startTimer = useCallback((itemId: number) => {
    setTimers(prev => {
      const next = { ...prev, [itemId]: { accumulated: prev[itemId]?.accumulated ?? 0, startedAt: Date.now() } }
      saveTimers(next)
      return next
    })
  }, [])

  const pauseTimer = useCallback((itemId: number) => {
    setTimers(prev => {
      const t = prev[itemId]
      if (!t?.startedAt) return prev
      const next = { ...prev, [itemId]: { accumulated: t.accumulated + (Date.now() - t.startedAt), startedAt: undefined } }
      saveTimers(next)
      return next
    })
  }, [])

  // ── Actions ───────────────────────────────────────────

  const handleStart = useCallback(() => {
    if (!currentItem) return
    const st = states[currentItem.i]?.status ?? currentItem.s
    if (st === 0) onStatusChange(currentItem.i, 1)
    startTimer(currentItem.i)
  }, [currentItem, states, onStatusChange, startTimer])

  const handlePause = useCallback(() => {
    if (!currentItem) return
    pauseTimer(currentItem.i)
  }, [currentItem, pauseTimer])

  const handleDeliver = useCallback(() => {
    if (!currentItem) return
    const elapsed = getElapsed(currentItem.i)
    const session: EditorSession = {
      itemId: currentItem.i,
      client: currentItem.c,
      title: states[currentItem.i]?.title || currentItem.n,
      duration: elapsed,
      date: todayStr(),
      type: currentItem.tp,
    }
    setSessions(prev => { const next = [...prev, session]; saveSessions(next); return next })
    setTimers(prev => { const next = { ...prev }; delete next[currentItem.i]; saveTimers(next); return next })
    onStatusChange(currentItem.i, 2)
    setCelebrateId(currentItem.i)
    if (celebrateRef.current) clearTimeout(celebrateRef.current)
    celebrateRef.current = setTimeout(() => setCelebrateId(null), 3000)
    const nextIdx = videoQueue.findIndex(i => i.i === currentItem.i) + 1
    setSelectedId(videoQueue[nextIdx]?.i ?? null)
    setBriefingOpen(false)
  }, [currentItem, states, getElapsed, onStatusChange, videoQueue])

  // ── Keyboard shortcuts ────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') { e.preventDefault(); isRunning ? handlePause() : handleStart() }
      if (e.code === 'Enter') { e.preventDefault(); handleDeliver() }
      if (e.code === 'ArrowDown' || e.code === 'ArrowRight') {
        e.preventDefault()
        if (!currentItem) return
        const idx = videoQueue.findIndex(i => i.i === currentItem.i)
        if (idx < videoQueue.length - 1) setSelectedId(videoQueue[idx + 1].i)
      }
      if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') {
        e.preventDefault()
        if (!currentItem) return
        const idx = videoQueue.findIndex(i => i.i === currentItem.i)
        if (idx > 0) setSelectedId(videoQueue[idx - 1].i)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isRunning, handleStart, handlePause, handleDeliver, currentItem, videoQueue])

  // ── Stats ─────────────────────────────────────────────

  const today = todayStr()
  const todaySessions = sessions.filter(s => s.date === today)
  const todayCount = todaySessions.length
  const todayTime = todaySessions.reduce((a, s) => a + s.duration, 0)
  const monthSessions = sessions.filter(s => s.date.startsWith(today.slice(0, 7)))
  const monthCount = monthSessions.length
  const monthTime = monthSessions.reduce((a, s) => a + s.duration, 0)
  const avgTime = monthCount > 0 ? Math.round(monthTime / monthCount) : 0

  const streak = useMemo(() => {
    const dates = [...new Set(sessions.map(s => s.date))].sort().reverse()
    let count = 0
    const base = new Date()
    for (const d of dates) {
      const expected = new Date(base.getTime() - count * 86400000).toISOString().slice(0, 10)
      if (d === expected) count++
      else break
    }
    return count
  }, [sessions])

  const todayD = new Date(now); todayD.setHours(0, 0, 0, 0)
  const pendingCount = videoQueue.filter(i => (states[i.i]?.status ?? i.s) === 0).length
  const inProgressCount = videoQueue.filter(i => (states[i.i]?.status ?? i.s) === 1).length
  const lateCount = videoQueue.filter(i => i.dt < todayD).length

  const driveLink = currentItem
    ? (states[currentItem.i]?.link || clientFolders[currentItem.c] || '')
    : ''

  const clientRoteiros = currentItem ? (roteiros[currentItem.c] ?? []).filter(r => r.type === currentItem.tp) : []

  // ── Goal: 3 videos/day ────────────────────────────────
  const dailyGoal = 3
  const goalProgress = Math.min((todayCount / dailyGoal) * 100, 100)
  const goalDone = todayCount >= dailyGoal

  // ─────────────────────────────────────────────────────

  return (
    <Box sx={{ minHeight: '100%', bgcolor: '#050505', p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Header ──────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MovieIcon sx={{ color: '#ff9039', fontSize: 24 }} />
          <Typography sx={{ fontWeight: 900, fontSize: '1.15rem', color: '#fff', letterSpacing: '-0.01em' }}>
            Modo Editor
          </Typography>
          <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', ml: 0.5 }}>
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        {streak > 0 && (
          <StatPill>
            <LocalFireDepartmentIcon sx={{ fontSize: 14, color: '#FF6B2B' }} />
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#FF6B2B' }}>{streak} dias</Typography>
          </StatPill>
        )}
        <StatPill glow="#00C47A">
          <Typography sx={{ fontSize: '0.72rem', lineHeight: 1 }}>✅</Typography>
          <Tooltip title={`Tempo hoje: ${formatDuration(todayTime)}`}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#00C47A', cursor: 'help' }}>
              {todayCount} hoje
            </Typography>
          </Tooltip>
        </StatPill>
        <StatPill glow="#3B8EFF">
          <Typography sx={{ fontSize: '0.72rem', lineHeight: 1 }}>📹</Typography>
          <Tooltip title={`Tempo médio: ${formatDuration(avgTime)} · Total: ${formatDuration(monthTime)}`}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#3B8EFF', cursor: 'help' }}>
              {monthCount} no mês
            </Typography>
          </Tooltip>
        </StatPill>
        {lateCount > 0 && (
          <StatPill glow="#FF3B30">
            <Typography sx={{ fontSize: '0.72rem', lineHeight: 1 }}>⚠️</Typography>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#FF3B30' }}>
              {lateCount} atrasado{lateCount > 1 ? 's' : ''}
            </Typography>
          </StatPill>
        )}
      </Box>

      {/* ── Meta diária ─────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography sx={{ fontSize: '0.62rem', color: goalDone ? '#00C47A' : 'rgba(255,255,255,0.3)', fontWeight: 700, whiteSpace: 'nowrap' }}>
          {goalDone ? '🎯 Meta batida!' : `Meta: ${todayCount}/${dailyGoal} vídeos`}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={goalProgress}
          sx={{
            flex: 1, height: 4, borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.06)',
            '& .MuiLinearProgress-bar': {
              background: goalDone
                ? 'linear-gradient(90deg, #00C47A, #00E090)'
                : 'linear-gradient(90deg, #ff9039, #ff5339)',
              borderRadius: 2,
            },
          }}
        />
      </Box>

      {/* ── Main layout ─────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>

        {/* ── Current item ────────────────────────────── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          {currentItem && currentState ? (
            <>
              {/* ── Main card ───────────────────────────── */}
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2.5, md: 3.5 },
                  borderRadius: 3,
                  bgcolor: celebrateId === currentItem.i
                    ? 'rgba(0,196,122,0.06)'
                    : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${
                    celebrateId === currentItem.i ? '#00C47A40'
                    : isRunning ? 'rgba(255,144,57,0.35)'
                    : 'rgba(255,255,255,0.07)'
                  }`,
                  transition: 'all 0.4s',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': isRunning ? {
                    content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: 'linear-gradient(90deg, transparent 0%, #ff9039 50%, transparent 100%)',
                    animation: 'scanline 2.5s linear infinite',
                  } : {},
                  '@keyframes scanline': {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' },
                  },
                }}
              >
                {/* Tags row */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                  <Chip
                    label={currentItem.c}
                    size="small"
                    sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: 'rgba(255,144,57,0.12)', color: '#ff9039', border: '1px solid rgba(255,144,57,0.25)', height: 22 }}
                  />
                  <Chip
                    label={currentItem.tp}
                    size="small"
                    sx={{ fontWeight: 700, fontSize: '0.68rem', bgcolor: 'rgba(59,130,246,0.1)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.2)', height: 22 }}
                  />
                  <DeadlineChip dt={currentItem.dt} now={now} />
                  {currentState.status === 1 && (
                    <Chip label="Em edição" size="small" sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: 'rgba(255,215,0,0.1)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.2)', height: 22 }} />
                  )}
                  {currentState.status === 2 && (
                    <Chip label="✅ Entregue" size="small" sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: 'rgba(0,196,122,0.1)', color: '#00C47A', border: '1px solid rgba(0,196,122,0.2)', height: 22 }} />
                  )}
                </Box>

                {/* Title */}
                <Typography sx={{
                  fontWeight: 900,
                  fontSize: { xs: '1.4rem', md: '1.9rem', lg: '2.2rem' },
                  color: '#fff', lineHeight: 1.15, mb: 0.5,
                  letterSpacing: '-0.02em',
                }}>
                  {currentState.title || currentItem.n}
                </Typography>

                {/* Timer display */}
                <Box sx={{ my: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography sx={{
                    fontWeight: 900,
                    fontSize: { xs: '3rem', md: '5rem' },
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                    color: isRunning ? '#ff9039' : 'rgba(255,255,255,0.15)',
                    textShadow: isRunning ? '0 0 40px rgba(255,144,57,0.5), 0 0 80px rgba(255,83,57,0.2)' : 'none',
                    transition: 'all 0.5s',
                    letterSpacing: '-0.02em',
                  }}>
                    {formatTimer(getElapsed(currentItem.i))}
                  </Typography>
                  {isRunning && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6, pb: 0.5 }}>
                      {[0, 1, 2].map(i => (
                        <Box key={i} sx={{
                          width: 5, height: 5, borderRadius: '50%', bgcolor: '#ff9039',
                          animation: 'dotPulse 1.2s ease-in-out infinite',
                          animationDelay: `${i * 0.2}s`,
                          '@keyframes dotPulse': { '0%,80%,100%': { opacity: 0.2 }, '40%': { opacity: 1 } },
                        }} />
                      ))}
                    </Box>
                  )}
                </Box>

                {/* Action buttons */}
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {!isRunning ? (
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<PlayArrowIcon />}
                      onClick={handleStart}
                      disabled={currentState.status >= 2}
                      sx={{
                        fontWeight: 900, fontSize: { xs: '0.9rem', md: '1.05rem' },
                        px: { xs: 3, md: 5 }, py: 1.6, borderRadius: 2.5,
                        background: 'linear-gradient(135deg, #ff9039 0%, #ff5339 100%)',
                        boxShadow: '0 4px 24px rgba(255,144,57,0.35)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #ffaa55 0%, #ff6644 100%)',
                          boxShadow: '0 6px 32px rgba(255,144,57,0.55)',
                          transform: 'translateY(-1px)',
                        },
                        '&:disabled': { opacity: 0.25 },
                        transition: 'all 0.2s',
                      }}
                    >
                      {currentState.status === 0 ? 'COMEÇAR' : 'RETOMAR'}
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      size="large"
                      startIcon={<PauseIcon />}
                      onClick={handlePause}
                      sx={{
                        fontWeight: 900, fontSize: { xs: '0.9rem', md: '1.05rem' },
                        px: { xs: 3, md: 4 }, py: 1.6, borderRadius: 2.5,
                        borderColor: 'rgba(255,144,57,0.5)', color: '#ff9039',
                        '&:hover': { borderColor: '#ff9039', bgcolor: 'rgba(255,144,57,0.08)', transform: 'translateY(-1px)' },
                        transition: 'all 0.2s',
                      }}
                    >
                      PAUSAR
                    </Button>
                  )}

                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<CheckIcon />}
                    onClick={handleDeliver}
                    disabled={currentState.status >= 2}
                    sx={{
                      fontWeight: 900, fontSize: { xs: '0.9rem', md: '1.05rem' },
                      px: { xs: 3, md: 5 }, py: 1.6, borderRadius: 2.5,
                      background: 'linear-gradient(135deg, #00C47A 0%, #00A060 100%)',
                      boxShadow: '0 4px 24px rgba(0,196,122,0.25)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #00E090 0%, #00C47A 100%)',
                        boxShadow: '0 6px 32px rgba(0,196,122,0.45)',
                        transform: 'translateY(-1px)',
                      },
                      '&:disabled': { opacity: 0.25 },
                      transition: 'all 0.2s',
                    }}
                  >
                    ENTREGAR
                  </Button>

                  {driveLink && (
                    <Tooltip title="Abrir Drive">
                      <IconButton
                        onClick={() => window.open(driveLink, '_blank', 'noopener')}
                        sx={{
                          border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)',
                          '&:hover': { color: '#fff', borderColor: 'rgba(255,255,255,0.35)', bgcolor: 'rgba(255,255,255,0.06)' },
                        }}
                      >
                        <OpenInNewIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>

                {/* Celebration overlay */}
                {celebrateId === currentItem.i && (
                  <Box sx={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'celebrateFade 3s ease-out forwards',
                    '@keyframes celebrateFade': { '0%': { opacity: 1 }, '60%': { opacity: 1 }, '100%': { opacity: 0 } },
                  }}>
                    <Typography sx={{ fontSize: { xs: '3rem', md: '5rem' }, userSelect: 'none' }}>🎬✅</Typography>
                  </Box>
                )}

                {/* Keyboard hints */}
                <Box sx={{ mt: 2.5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <KbdHint keys={['Space']} label={isRunning ? 'pausar' : currentState.status === 0 ? 'começar' : 'retomar'} />
                  <KbdHint keys={['Enter']} label="entregar" />
                  <KbdHint keys={['↑', '↓']} label="navegar fila" />
                </Box>
              </Paper>

              {/* ── Briefing ──────────────────────────────── */}
              {(currentState.notes || currentState.caption || clientRoteiros.length > 0) && (
                <Paper sx={{
                  borderRadius: 2.5,
                  bgcolor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                }}>
                  <Box
                    onClick={() => setBriefingOpen(v => !v)}
                    sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}
                  >
                    <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', flex: 1 }}>
                      📋 Briefing & Roteiro
                    </Typography>
                    {briefingOpen
                      ? <ExpandLessIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.25)' }} />
                      : <ExpandMoreIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.25)' }} />
                    }
                  </Box>
                  <Collapse in={briefingOpen}>
                    <Box sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {currentState.caption && (
                        <Box>
                          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, mb: 0.5, fontWeight: 700 }}>Legenda</Typography>
                          <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-wrap' }}>{currentState.caption}</Typography>
                        </Box>
                      )}
                      {currentState.notes && (
                        <Box>
                          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, mb: 0.5, fontWeight: 700 }}>Notas internas</Typography>
                          <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-wrap' }}>{currentState.notes}</Typography>
                        </Box>
                      )}
                      {clientRoteiros.length > 0 && (
                        <Box>
                          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, mb: 0.8, fontWeight: 700 }}>Roteiros</Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                            {clientRoteiros.map(r => (
                              <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.05)' }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }} noWrap>{r.title}</Typography>
                                  {r.notes && <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.38)', mt: 0.2 }}>{r.notes}</Typography>}
                                </Box>
                                {r.driveLink && (
                                  <IconButton size="small" onClick={() => window.open(r.driveLink, '_blank', 'noopener')} sx={{ color: 'rgba(255,255,255,0.35)', '&:hover': { color: '#ff9039' } }}>
                                    <OpenInNewIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                )}
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Collapse>
                </Paper>
              )}
            </>
          ) : (
            <EmptyQueue />
          )}
        </Box>

        {/* ── Queue sidebar ────────────────────────────── */}
        <Box sx={{ width: 280, flexShrink: 0, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 1.5 }}>

          {/* Queue header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Fila · {videoQueue.length}
            </Typography>
            <Box sx={{ flex: 1 }} />
            {inProgressCount > 0 && (
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#FFD700', boxShadow: '0 0 6px #FFD700' }} />
            )}
          </Box>

          {/* Queue list */}
          <Box sx={{
            flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.7,
            '&::-webkit-scrollbar': { width: 3 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2 },
          }}>
            {videoQueue.length === 0 && (
              <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.18)', textAlign: 'center', mt: 6 }}>
                Fila vazia 🎉
              </Typography>
            )}
            {videoQueue.map((item, idx) => (
              <QueueCard
                key={item.i}
                item={item}
                state={states[item.i]}
                isActive={item.i === (currentItem?.i ?? -1)}
                isRunning={Boolean(timers[item.i]?.startedAt)}
                elapsed={getElapsed(item.i)}
                position={idx + 1}
                now={now}
                onClick={() => setSelectedId(item.i)}
              />
            ))}
          </Box>

          {/* Monthly stats box */}
          {monthCount > 0 && (
            <Paper sx={{ p: 2, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, mb: 1 }}>
                Produção · {new Date().toLocaleDateString('pt-BR', { month: 'long' })}
              </Typography>
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, color: '#ff9039', lineHeight: 1, mb: 0.3 }}>
                {monthCount} <Typography component="span" sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>vídeos</Typography>
              </Typography>
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.38)' }}>
                  ⏱ Tempo médio: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{formatDuration(avgTime)}</strong>
                </Typography>
                <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.38)' }}>
                  ⏳ Total editado: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{formatDuration(monthTime)}</strong>
                </Typography>
                {pendingCount > 0 && (
                  <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.38)', mt: 0.3 }}>
                    📋 Faltam: <strong style={{ color: '#FFD700' }}>{pendingCount}</strong>
                  </Typography>
                )}
              </Box>
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  )
}

// ── Sub-components ────────────────────────────────────────

function StatPill({ children, glow }: { children: React.ReactNode; glow?: string }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.6,
      px: 1.3, py: 0.55, borderRadius: 2,
      bgcolor: glow ? `${glow}10` : 'rgba(255,255,255,0.04)',
      border: `1px solid ${glow ? `${glow}22` : 'rgba(255,255,255,0.07)'}`,
    }}>
      {children}
    </Box>
  )
}

function DeadlineChip({ dt, now }: { dt: Date; now: Date }) {
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const days = Math.round((dt.getTime() - today.getTime()) / 86400000)
  const isLate = days < 0
  const label = isLate
    ? `${Math.abs(days)}d atraso`
    : days === 0 ? 'Hoje'
    : days === 1 ? 'Amanhã'
    : dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const color = isLate ? '#FF3B30' : days === 0 ? '#FFD700' : '#A1A1AA'
  return (
    <Chip
      icon={<AccessTimeIcon sx={{ fontSize: '11px !important', color: `${color} !important` }} />}
      label={label}
      size="small"
      sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: `${color}12`, color, border: `1px solid ${color}25`, height: 22 }}
    />
  )
}

function KbdHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
      {keys.map(k => (
        <Box key={k} sx={{ px: 0.8, py: 0.25, borderRadius: 0.8, bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'monospace', fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
          {k}
        </Box>
      ))}
      <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)', ml: 0.3 }}>{label}</Typography>
    </Box>
  )
}

function QueueCard({ item, state, isActive, isRunning, elapsed, position, now, onClick }: {
  item: ContentItem; state?: ItemState; isActive: boolean; isRunning: boolean
  elapsed: number; position: number; now: Date; onClick: () => void
}) {
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const isLate = item.dt < today
  const st = state?.status ?? item.s
  const dotColor = st === 1 ? '#FFD700' : st === 0 ? '#71717A' : '#60A5FA'

  return (
    <Paper
      onClick={onClick}
      elevation={0}
      sx={{
        p: 1.3, borderRadius: 2, cursor: 'pointer',
        bgcolor: isActive ? 'rgba(255,144,57,0.07)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isActive ? 'rgba(255,144,57,0.28)' : 'rgba(255,255,255,0.05)'}`,
        transition: 'all 0.15s',
        '&:hover': {
          bgcolor: isActive ? 'rgba(255,144,57,0.1)' : 'rgba(255,255,255,0.04)',
          borderColor: isActive ? 'rgba(255,144,57,0.4)' : 'rgba(255,255,255,0.1)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.18)', fontWeight: 700, width: 14, textAlign: 'center', flexShrink: 0 }}>
          {position}
        </Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.15 }}>
            <Typography sx={{ fontSize: '0.64rem', color: '#ff9039', fontWeight: 700, flex: 1 }} noWrap>{item.c}</Typography>
            <Box sx={{
              width: 6, height: 6, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0,
              boxShadow: isRunning ? `0 0 8px ${dotColor}` : 'none',
            }} />
          </Box>
          <Typography sx={{ fontSize: '0.75rem', color: isActive ? '#fff' : 'rgba(255,255,255,0.55)', fontWeight: isActive ? 600 : 400 }} noWrap>
            {state?.title || item.n}
          </Typography>
          {elapsed > 0 && (
            <Typography sx={{ fontSize: '0.58rem', color: isRunning ? '#ff9039' : 'rgba(255,255,255,0.22)', mt: 0.2, fontVariantNumeric: 'tabular-nums' }}>
              ⏱ {formatDuration(elapsed)}
            </Typography>
          )}
        </Box>
        {isLate && <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#FF3B30', flexShrink: 0 }} />}
      </Box>
    </Paper>
  )
}

function EmptyQueue() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '55vh', gap: 2 }}>
      <Typography sx={{ fontSize: '5rem', lineHeight: 1, filter: 'drop-shadow(0 0 20px rgba(0,196,122,0.4))' }}>🎬</Typography>
      <Typography sx={{ fontWeight: 900, fontSize: '1.4rem', color: 'rgba(255,255,255,0.55)' }}>Fila zerada!</Typography>
      <Typography sx={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.28)', textAlign: 'center', maxWidth: 280 }}>
        Todos os Reels foram entregues para aprovação. Missão cumprida 🚀
      </Typography>
    </Box>
  )
}
