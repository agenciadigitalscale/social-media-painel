import { useMemo, useState } from 'react'
import {
  Box, Typography, Tooltip, Chip, Paper, Stack,
} from '@mui/material'
import type { ContentItem, ItemState } from '../types'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
}

const STATUS_COLOR = ['rgba(255,255,255,0.25)', '#FFD700', '#3B8EFF', '#00C47A']
const STATUS_LABEL = ['Pendente', 'Em edição', 'Aprovado', 'Publicado']
const DAY_W = 38

export default function TimelineTab({ items, states, now }: Props) {
  const [filterClient, setFilterClient] = useState<string | null>(null)

  const year  = now.getFullYear()
  const month = now.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const today = now.getDate()

  const monthItems = useMemo(() =>
    items.filter(i => i.dt.getFullYear() === year && i.dt.getMonth() === month),
    [items, year, month])

  const clients = useMemo(() =>
    Array.from(new Set(monthItems.map(i => i.c))).sort(),
    [monthItems])

  const filtered = filterClient ? clients.filter(c => c === filterClient) : clients

  const getCell = (client: string, day: number) =>
    monthItems.filter(i => i.c === client && i.dt.getDate() === day)

  const totalByDay = useMemo(() =>
    days.map(d => monthItems.filter(i => i.dt.getDate() === d).length),
    [days, monthItems])

  const maxDay = Math.max(...totalByDay, 1)

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: { md: '0.95rem', xl: '1.05rem' } }}>
          Timeline — {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.6, ml: 'auto', flexWrap: 'wrap' }}>
          {STATUS_COLOR.map((c, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} />
              <Typography sx={{ fontSize: '0.58rem', color: 'text.secondary' }}>{STATUS_LABEL[i]}</Typography>
            </Box>
          ))}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: 1, bgcolor: 'primary.main' }} />
            <Typography sx={{ fontSize: '0.58rem', color: 'text.secondary' }}>Post</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'info.main' }} />
            <Typography sx={{ fontSize: '0.58rem', color: 'text.secondary' }}>Reel</Typography>
          </Box>
        </Box>
      </Box>

      {/* Client filter */}
      <Stack direction="row" spacing={0.8} sx={{ overflowX: 'auto', pb: 0.5, flexShrink: 0 }}>
        <Chip label="Todos" size="small" variant={filterClient ? 'outlined' : 'filled'} color="primary" onClick={() => setFilterClient(null)} sx={{ flexShrink: 0 }} />
        {clients.map(c => (
          <Chip key={c} label={c} size="small" variant={filterClient === c ? 'filled' : 'outlined'} onClick={() => setFilterClient(c)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }} />
        ))}
      </Stack>

      {/* Grid */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Box sx={{ minWidth: 180 + daysInMonth * DAY_W, pb: 1 }}>

          {/* Day header */}
          <Box sx={{ display: 'flex', pl: '180px', mb: 0.5 }}>
            {days.map(d => {
              const date = new Date(year, month, d)
              const isSun = date.getDay() === 0
              const isTod = d === today
              const load = totalByDay[d - 1]
              return (
                <Box
                  key={d}
                  sx={{
                    width: DAY_W, flexShrink: 0, textAlign: 'center',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.2,
                  }}
                >
                  <Typography sx={{
                    fontSize: '0.55rem', fontWeight: isTod ? 800 : 500,
                    color: isTod ? 'primary.main' : isSun ? 'error.light' : 'text.disabled',
                    textTransform: 'uppercase',
                  }}>
                    {date.toLocaleDateString('pt-BR', { weekday: 'narrow' })}
                  </Typography>
                  <Box sx={{
                    width: 22, height: 22, borderRadius: '50%',
                    bgcolor: isTod ? 'primary.main' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography sx={{
                      fontSize: '0.6rem', fontWeight: isTod ? 800 : 400,
                      color: isTod ? '#000' : isSun ? 'error.light' : 'text.secondary',
                    }}>
                      {d}
                    </Typography>
                  </Box>
                  {/* Load bar */}
                  <Box sx={{
                    width: 4, height: Math.round((load / maxDay) * 16),
                    borderRadius: 1, bgcolor: load > 0 ? 'rgba(255,144,57,0.4)' : 'transparent',
                    minHeight: 2,
                  }} />
                </Box>
              )
            })}
          </Box>

          {/* Client rows */}
          {filtered.map((client, ri) => (
            <Paper
              key={client}
              sx={{
                display: 'flex', alignItems: 'stretch', mb: 0.5,
                border: '1px solid rgba(255,255,255,0.05)',
                bgcolor: ri % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                borderRadius: 1.5, overflow: 'hidden',
                minHeight: 38,
              }}
            >
              {/* Client name */}
              <Box sx={{
                width: 180, flexShrink: 0, px: 1.5, display: 'flex', alignItems: 'center',
                borderRight: '1px solid rgba(255,255,255,0.05)',
                position: 'sticky', left: 0,
                bgcolor: ri % 2 === 0 ? 'rgba(14,14,14,0.98)' : 'rgba(10,10,10,0.98)',
                zIndex: 1,
              }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.primary' }} noWrap>{client}</Typography>
              </Box>

              {/* Day cells */}
              {days.map(d => {
                const cellItems = getCell(client, d)
                const isTod = d === today
                return (
                  <Box
                    key={d}
                    sx={{
                      width: DAY_W, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexWrap: 'wrap', gap: 0.3, py: 0.5,
                      bgcolor: isTod ? 'rgba(255,144,57,0.04)' : 'transparent',
                      borderRight: d === daysInMonth ? 'none' : '1px solid rgba(255,255,255,0.03)',
                    }}
                  >
                    {cellItems.map(ci => {
                      const st = states[ci.i]?.status ?? ci.s
                      const isReel = ci.tp === 'Reel'
                      return (
                        <Tooltip
                          key={ci.i}
                          title={
                            <Box>
                              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700 }}>{states[ci.i]?.title || ci.n}</Typography>
                              <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>{ci.tp} · {STATUS_LABEL[st]}</Typography>
                            </Box>
                          }
                          arrow
                        >
                          <Box sx={{
                            width: 10, height: 10,
                            borderRadius: isReel ? '50%' : 1.5,
                            bgcolor: STATUS_COLOR[st],
                            cursor: 'default',
                            flexShrink: 0,
                            border: '1px solid rgba(0,0,0,0.3)',
                            boxShadow: st === 3 ? '0 0 4px rgba(0,196,122,0.5)' : undefined,
                          }} />
                        </Tooltip>
                      )
                    })}
                  </Box>
                )
              })}
            </Paper>
          ))}

          {filtered.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography color="text.disabled">Nenhum conteúdo neste mês</Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
