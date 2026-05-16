import { useState, useMemo } from 'react'
import {
  Box, Typography, Paper, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, Divider,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import type { ItemState, Status } from '../types'
import { DATA } from '../data'
import ContentCard from './ContentCard'

interface Props {
  states: Record<number, ItemState>
  now: Date
  onStatusChange?: (id: number, s: Status) => void
  onUpdate?: (id: number, patch: Partial<ItemState>) => void
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function shortName(name: string): string {
  const words = name.split(' ')
  if (words.length === 1) return name.slice(0, 8)
  // Use first meaningful word (skip articles)
  const skip = ['de', 'da', 'do', 'e', 'a', 'o', 'd\'']
  const first = words.find(w => !skip.includes(w.toLowerCase())) ?? words[0]
  return first.length > 10 ? first.slice(0, 10) : first
}

export default function CalendarTab({ states, now, onStatusChange, onUpdate }: Props) {
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today        = now.getDate()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month

  // Build day map with counts + clients
  const dayMap = useMemo(() => {
    const map = new Map<number, { count: number; published: number; clients: string[] }>()
    DATA
      .filter(i => i.dt.getFullYear() === year && i.dt.getMonth() === month)
      .forEach(item => {
        const d   = item.dt.getDate()
        const cur = map.get(d) ?? { count: 0, published: 0, clients: [] }
        const s   = states[item.i]?.status ?? item.s
        const shortClient = shortName(item.c)
        map.set(d, {
          count:     cur.count + 1,
          published: cur.published + (s === 3 ? 1 : 0),
          clients:   cur.clients.includes(shortClient) ? cur.clients : [...cur.clients, shortClient],
        })
      })
    return map
  }, [states, year, month])

  // Monthly totals
  const monthTotals = useMemo(() => {
    let count = 0, published = 0
    dayMap.forEach(v => { count += v.count; published += v.published })
    return { count, published, pct: count ? Math.round((published / count) * 100) : 0 }
  }, [dayMap])

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  // Items for selected day
  const selectedItems = useMemo(() => {
    if (!selectedDay) return []
    return DATA.filter(i => i.dt.getFullYear() === year && i.dt.getMonth() === month && i.dt.getDate() === selectedDay)
  }, [selectedDay, year, month])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ───────────────────────────────────── */}
      <Box sx={{ px: 2, pt: 1.5, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => setViewDate(new Date(year, month - 1, 1))}>
            <ChevronLeftIcon />
          </IconButton>
          <Box sx={{ textAlign: 'center', minWidth: 140 }}>
            <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1, background: 'linear-gradient(90deg,#ff9039,#ff5339)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {MONTHS[month]}
            </Typography>
            <Typography variant="caption" color="text.secondary">{year}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setViewDate(new Date(year, month + 1, 1))}>
            <ChevronRightIcon />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            label={`${monthTotals.published}/${monthTotals.count} publicados`}
            size="small"
            color={monthTotals.pct === 100 ? 'success' : 'default'}
            variant="outlined"
            sx={{ fontSize: '0.62rem' }}
          />
          <Chip
            label={`${monthTotals.pct}%`}
            size="small"
            color={monthTotals.pct === 100 ? 'success' : monthTotals.pct >= 50 ? 'warning' : 'error'}
            sx={{ fontSize: '0.62rem', fontWeight: 700 }}
          />
        </Box>
      </Box>

      {/* ── Weekday headers ──────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', px: 1, mb: 0.5 }}>
        {WEEKDAYS.map((d, i) => (
          <Typography key={d} variant="caption" sx={{
            textAlign: 'center', fontWeight: 700, fontSize: '0.6rem', py: 0.5,
            color: i === 0 || i === 6 ? 'text.disabled' : 'text.secondary',
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            {d}
          </Typography>
        ))}
      </Box>

      {/* ── Calendar grid ────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 1, pb: 1.5 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.6, height: '100%' }}>
          {cells.map((day, idx) => {
            if (!day) return <Box key={`e-${idx}`} />

            const info    = dayMap.get(day)
            const isToday = isCurrentMonth && day === today
            const isPast  = isCurrentMonth ? day < today : year < now.getFullYear() || month < now.getMonth()
            const allDone = info && info.count > 0 && info.published === info.count
            const hasLate = info && isPast && info.published < info.count
            const isWeekend = ((firstDay + day - 1) % 7 === 0 || (firstDay + day - 1) % 7 === 6)

            return (
              <Paper
                key={day}
                onClick={() => info && info.count > 0 ? setSelectedDay(day) : null}
                sx={{
                  p: 0.8,
                  minHeight: { xs: 64, sm: 80 },
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.3,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: isToday ? 'primary.main' : allDone ? 'rgba(0,196,122,0.3)' : hasLate ? 'rgba(255,69,69,0.25)' : 'rgba(255,255,255,0.05)',
                  bgcolor: isToday ? 'rgba(255,144,57,0.08)' : allDone ? 'rgba(0,196,122,0.05)' : hasLate ? 'rgba(255,69,69,0.05)' : isWeekend ? 'rgba(255,255,255,0.01)' : 'background.paper',
                  cursor: info && info.count > 0 ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                  boxShadow: isToday ? '0 0 0 1px rgba(255,144,57,0.3)' : 'none',
                  '&:hover': info && info.count > 0 ? {
                    borderColor: 'primary.main',
                    bgcolor: 'rgba(255,144,57,0.06)',
                    transform: 'scale(1.02)',
                  } : {},
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Today top bar */}
                {isToday && (
                  <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#ff9039,#ff5339)' }} />
                )}

                {/* Day number */}
                <Typography sx={{
                  fontSize: { xs: '0.7rem', sm: '0.85rem' },
                  fontWeight: isToday ? 800 : 600,
                  color: isToday ? 'primary.main' : isWeekend ? 'text.disabled' : 'text.primary',
                  lineHeight: 1,
                }}>
                  {day}
                </Typography>

                {/* Post count */}
                {info && info.count > 0 && (
                  <>
                    <Typography sx={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      color: allDone ? 'success.main' : hasLate ? 'error.main' : 'primary.main',
                      lineHeight: 1,
                    }}>
                      {info.count} post{info.count > 1 ? 's' : ''}
                    </Typography>

                    {/* Client names */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.1, flex: 1 }}>
                      {info.clients.slice(0, 3).map(c => (
                        <Typography key={c} sx={{
                          fontSize: '0.55rem',
                          color: 'text.secondary',
                          lineHeight: 1.2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {c}
                        </Typography>
                      ))}
                      {info.clients.length > 3 && (
                        <Typography sx={{ fontSize: '0.5rem', color: 'text.disabled', lineHeight: 1 }}>
                          +{info.clients.length - 3}
                        </Typography>
                      )}
                    </Box>

                    {/* Progress bar */}
                    <Box sx={{ width: '100%', height: 2, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden', mt: 'auto' }}>
                      <Box sx={{
                        height: '100%',
                        width: `${(info.published / info.count) * 100}%`,
                        bgcolor: allDone ? 'success.main' : 'primary.main',
                        borderRadius: 1,
                      }} />
                    </Box>
                  </>
                )}
              </Paper>
            )
          })}
        </Box>
      </Box>

      {/* ── Day detail modal ─────────────────────────── */}
      <Dialog
        open={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(255,144,57,0.2)', borderRadius: 3, maxHeight: '85vh' } }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {selectedDay && new Date(year, month, selectedDay).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedItems.length} conteúdo{selectedItems.length > 1 ? 's' : ''} para publicar
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setSelectedDay(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Divider sx={{ opacity: 0.1 }} />
        <DialogContent sx={{ pt: 1.5 }}>
          {selectedItems.map(item => (
            <ContentCard
              key={item.i}
              item={item}
              state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }}
              onStatusChange={onStatusChange ?? (() => {})}
              onUpdate={onUpdate ?? (() => {})}
            />
          ))}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
