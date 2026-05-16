import { useState, useMemo } from 'react'
import {
  Box, Typography, Paper, IconButton,
  LinearProgress, Tooltip, Chip, Stack,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import type { ItemState } from '../types'
import { DATA } from '../data'
import Logo from './Logo'

interface Props {
  states: Record<number, ItemState>
  now: Date
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

export default function CalendarTab({ states, now }: Props) {
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const today        = now.getDate()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month

  // Stats per day
  const dayMap = useMemo(() => {
    const map = new Map<number, { count: number; published: number; late: boolean }>()
    DATA
      .filter(i => i.dt.getFullYear() === year && i.dt.getMonth() === month)
      .forEach(item => {
        const d   = item.dt.getDate()
        const cur = map.get(d) ?? { count: 0, published: 0, late: false }
        const s   = states[item.i]?.status ?? item.s
        const dayPassed = isCurrentMonth ? d < today : year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth())
        map.set(d, {
          count:     cur.count + 1,
          published: cur.published + (s === 3 ? 1 : 0),
          late:      cur.late || (dayPassed && s < 3),
        })
      })
    return map
  }, [states, year, month, today, isCurrentMonth, now])

  // Monthly totals
  const monthTotals = useMemo(() => {
    let count = 0, published = 0
    dayMap.forEach(v => { count += v.count; published += v.published })
    return { count, published, pct: count ? Math.round((published / count) * 100) : 0 }
  }, [dayMap])

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function getCellColor(day: number) {
    const info = dayMap.get(day)
    if (!info || info.count === 0) return null
    const dayPassed = isCurrentMonth ? day < today : true
    if (!dayPassed) return 'future'
    if (info.published === info.count) return 'done'
    if (info.late) return 'late'
    return 'partial'
  }

  const colorMap = {
    done:    { bg: 'rgba(0,196,122,0.12)',  border: '#00C47A', text: '#00C47A' },
    late:    { bg: 'rgba(255,69,69,0.12)',  border: '#FF4545', text: '#FF4545' },
    partial: { bg: 'rgba(255,144,57,0.10)', border: '#ff9039', text: '#ff9039' },
    future:  { bg: 'rgba(59,142,255,0.07)', border: '#3B8EFF', text: '#3B8EFF' },
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Hero header ──────────────────────────────── */}
      <Box
        sx={{
          background: 'linear-gradient(160deg, #1a1a1a 0%, #0d0d0d 100%)',
          borderBottom: '1px solid rgba(255,144,57,0.15)',
          px: 2.5,
          pt: 2,
          pb: 2.5,
        }}
      >
        <Logo size="sm" />

        {/* Month navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
          <IconButton onClick={prevMonth} size="small" sx={{ color: 'text.secondary' }}>
            <ChevronLeftIcon />
          </IconButton>

          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="h5"
              fontWeight={800}
              sx={{
                background: 'linear-gradient(90deg, #ff9039, #ff5339)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textTransform: 'capitalize',
                letterSpacing: -0.5,
              }}
            >
              {MONTH_NAMES[month]}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {year}
            </Typography>
          </Box>

          <IconButton onClick={nextMonth} size="small" sx={{ color: 'text.secondary' }}>
            <ChevronRightIcon />
          </IconButton>
        </Box>

        {/* Monthly progress */}
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Progresso do mês
            </Typography>
            <Typography variant="caption" fontWeight={700} color={monthTotals.pct === 100 ? 'success.main' : 'primary.main'}>
              {monthTotals.published}/{monthTotals.count} publicados · {monthTotals.pct}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={monthTotals.pct}
            color={monthTotals.pct === 100 ? 'success' : 'primary'}
            sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.06)' }}
          />
        </Box>

        {/* Legend */}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
          {[
            { label: 'Publicado', color: '#00C47A', icon: <CheckCircleIcon sx={{ fontSize: 10 }} /> },
            { label: 'Atrasado',  color: '#FF4545', icon: <RadioButtonUncheckedIcon sx={{ fontSize: 10 }} /> },
            { label: 'Pendente',  color: '#ff9039', icon: <RadioButtonUncheckedIcon sx={{ fontSize: 10 }} /> },
            { label: 'Futuro',    color: '#3B8EFF', icon: <RadioButtonUncheckedIcon sx={{ fontSize: 10 }} /> },
          ].map(l => (
            <Chip
              key={l.label}
              icon={l.icon}
              label={l.label}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.6rem',
                color: l.color,
                borderColor: l.color,
                bgcolor: 'transparent',
                '& .MuiChip-icon': { color: l.color },
              }}
              variant="outlined"
            />
          ))}
        </Stack>
      </Box>

      {/* ── Calendar grid ────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, pt: 1.5, pb: 2 }}>
        {/* Weekday header */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
          {WEEKDAYS.map(d => (
            <Typography
              key={d}
              variant="caption"
              sx={{
                textAlign: 'center',
                fontWeight: 700,
                color: d === 'Dom' || d === 'Sáb' ? 'text.disabled' : 'text.secondary',
                fontSize: '0.65rem',
                py: 0.5,
              }}
            >
              {d}
            </Typography>
          ))}
        </Box>

        {/* Day cells */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
          {cells.map((day, idx) => {
            if (!day) return <Box key={`e-${idx}`} />

            const info   = dayMap.get(day)
            const status = getCellColor(day)
            const colors = status ? colorMap[status] : null
            const isToday = isCurrentMonth && day === today
            const pct    = info && info.count > 0 ? (info.published / info.count) * 100 : 0
            const isWeekend = ((firstDay + day - 1) % 7 === 0 || (firstDay + day - 1) % 7 === 6)

            return (
              <Tooltip
                key={day}
                title={info ? `${info.published}/${info.count} publicados` : ''}
                placement="top"
                arrow
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 0.6,
                    minHeight: 60,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: isToday
                      ? 'primary.main'
                      : colors
                        ? `${colors.border}44`
                        : 'rgba(255,255,255,0.04)',
                    bgcolor: isToday
                      ? 'rgba(255,144,57,0.12)'
                      : colors
                        ? colors.bg
                        : isWeekend
                          ? 'rgba(255,255,255,0.02)'
                          : 'background.paper',
                    boxShadow: isToday ? '0 0 12px rgba(255,144,57,0.2)' : 'none',
                    transition: 'all 0.15s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Today glow line */}
                  {isToday && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0,
                        height: 2,
                        background: 'linear-gradient(90deg, #ff9039, #ff5339)',
                      }}
                    />
                  )}

                  {/* Day number */}
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: isToday ? 800 : 500,
                      fontSize: '0.7rem',
                      color: isToday
                        ? 'primary.main'
                        : colors
                          ? colors.text
                          : isWeekend
                            ? 'text.disabled'
                            : 'text.primary',
                      lineHeight: 1,
                    }}
                  >
                    {day}
                  </Typography>

                  {/* Count */}
                  {info && info.count > 0 && (
                    <>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.58rem',
                          fontWeight: 700,
                          color: colors?.text ?? 'text.secondary',
                          lineHeight: 1,
                        }}
                      >
                        {info.published}/{info.count}
                      </Typography>

                      {/* Progress bar */}
                      <Box
                        sx={{
                          width: '80%',
                          height: 3,
                          bgcolor: 'rgba(255,255,255,0.08)',
                          borderRadius: 2,
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            height: '100%',
                            width: `${pct}%`,
                            background: status === 'done'
                              ? '#00C47A'
                              : status === 'late'
                                ? '#FF4545'
                                : 'linear-gradient(90deg, #ff9039, #ff5339)',
                            borderRadius: 2,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </Box>
                    </>
                  )}
                </Paper>
              </Tooltip>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
