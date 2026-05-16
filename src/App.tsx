import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ThemeProvider, CssBaseline, Box, BottomNavigation,
  BottomNavigationAction, Paper, Typography, Chip,
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda'
import PeopleIcon from '@mui/icons-material/People'
import ViewKanbanIcon from '@mui/icons-material/ViewKanban'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import theme from './theme'
import type { ItemState, Status } from './types'
import { DATA } from './data'
import Logo from './components/Logo'
import TodayTab from './components/TodayTab'
import AgendaTab from './components/AgendaTab'
import CalendarTab from './components/CalendarTab'
import ClientsTab from './components/ClientsTab'
import KanbanTab from './components/KanbanTab'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia ☀️'
  if (h < 18) return 'Boa tarde 🌤'
  return 'Boa noite 🌙'
}

function loadStates(): Record<number, ItemState> {
  try {
    const raw = localStorage.getItem('sm_states')
    if (raw) return JSON.parse(raw)
  } catch {}
  const initial: Record<number, ItemState> = {}
  DATA.forEach(item => {
    initial[item.i] = { status: item.s, title: '', link: '', caption: '', notes: '' }
  })
  return initial
}

export default function App() {
  const [tab, setTab] = useState(0)
  const [states, setStates] = useState<Record<number, ItemState>>(loadStates)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const updateItem = useCallback((id: number, patch: Partial<ItemState>) => {
    setStates(prev => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } }
      localStorage.setItem('sm_states', JSON.stringify(next))
      fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...next[id] }),
      }).catch(() => {})
      return next
    })
  }, [])

  const setStatus = useCallback((id: number, status: Status) => {
    updateItem(id, { status })
  }, [updateItem])

  // Header stats
  const headerStats = useMemo(() => {
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today.getTime() + 86_400_000)
    const late = DATA.filter(i => (states[i.i]?.status ?? i.s) < 3 && i.dt < today).length
    const todayTotal = DATA.filter(i => i.dt >= today && i.dt < tomorrow).length
    const todayDone = DATA.filter(i => i.dt >= today && i.dt < tomorrow && (states[i.i]?.status ?? i.s) === 3).length
    return { late, todayTotal, todayDone }
  }, [states, now])

  const tabs = [
    <TodayTab   key="today"    states={states} onStatusChange={setStatus} onUpdate={updateItem} now={now} />,
    <AgendaTab  key="agenda"   states={states} onStatusChange={setStatus} onUpdate={updateItem} now={now} />,
    <KanbanTab  key="kanban"   states={states} onStatusChange={setStatus} />,
    <CalendarTab key="calendar" states={states} now={now} />,
    <ClientsTab key="clients"  states={states} />,
  ]

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', bgcolor: 'background.default' }}>

        {/* ── Header ───────────────────────────────────── */}
        <Paper
          elevation={0}
          square
          sx={{
            px: 2,
            pt: 1.2,
            pb: 1,
            borderBottom: '1px solid rgba(255,144,57,0.12)',
            background: 'linear-gradient(135deg, #161616 0%, #1c1408 60%, #161616 100%)',
          }}
        >
          {/* Row 1: logo + time */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
            <Logo size="sm" />
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', display: 'block' }}>
                {getGreeting()}
              </Typography>
              <Typography sx={{ color: 'primary.main', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Box>
          </Box>

          {/* Row 2: quick stats */}
          <Box sx={{ display: 'flex', gap: 0.8 }}>
            {headerStats.late > 0 && (
              <Chip
                icon={<WarningAmberIcon />}
                label={`${headerStats.late} atrasado${headerStats.late > 1 ? 's' : ''}`}
                size="small"
                color="error"
                variant="outlined"
                sx={{ fontSize: '0.6rem', height: 20, '& .MuiChip-icon': { fontSize: 11 } }}
              />
            )}
            <Chip
              icon={<CheckCircleIcon />}
              label={`Hoje: ${headerStats.todayDone}/${headerStats.todayTotal}`}
              size="small"
              color={headerStats.todayDone === headerStats.todayTotal && headerStats.todayTotal > 0 ? 'success' : 'default'}
              variant="outlined"
              sx={{ fontSize: '0.6rem', height: 20, '& .MuiChip-icon': { fontSize: 11 } }}
            />
            <Chip
              label={now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.6rem', height: 20, ml: 'auto', borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary' }}
            />
          </Box>
        </Paper>

        {/* ── Tab content ──────────────────────────────── */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {tabs[tab]}
        </Box>

        {/* ── Bottom nav ───────────────────────────────── */}
        <Paper elevation={8} square sx={{ borderTop: '1px solid rgba(255,144,57,0.1)' }}>
          <BottomNavigation
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ bgcolor: 'background.paper' }}
          >
            <BottomNavigationAction label="Hoje"      icon={<HomeIcon />} />
            <BottomNavigationAction label="Agenda"    icon={<ViewAgendaIcon />} />
            <BottomNavigationAction label="Kanban"    icon={<ViewKanbanIcon />} />
            <BottomNavigationAction label="Calendário" icon={<CalendarMonthIcon />} />
            <BottomNavigationAction label="Clientes"  icon={<PeopleIcon />} />
          </BottomNavigation>
        </Paper>
      </Box>
    </ThemeProvider>
  )
}
