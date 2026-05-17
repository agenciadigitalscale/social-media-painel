import { useMemo, useState } from 'react'
import {
  Box, Typography, Chip, Stack, ToggleButton, ToggleButtonGroup,
  Paper, Divider,
} from '@mui/material'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import type { ContentItem, ContentType, ItemEditPatch, ItemState, Status } from '../types'
import ContentCard from './ContentCard'
import HintCard from './HintCard'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, s: Status) => void
  onUpdate: (id: number, patch: Partial<ItemState>) => void
  onDelete?: (id: number) => void
  onEdit?: (id: number, patch: ItemEditPatch) => void
  now: Date
}

export default function AgendaTab({ items, states, onStatusChange, onUpdate, onDelete, onEdit, now }: Props) {
  const [days, setDays] = useState<7 | 15>(7)
  const [filterClient, setFilterClient] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<ContentType | 'all'>('all')

  const today = useMemo(() => {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d
  }, [now])

  const limit = useMemo(() => new Date(today.getTime() + days * 86_400_000), [today, days])

  const upcoming = useMemo(() =>
    items
      .filter(item => item.dt >= today && item.dt < limit)
      .filter(item => !filterClient || item.c === filterClient)
      .filter(item => filterType === 'all' || item.tp === filterType)
      .sort((a, b) => a.dt.getTime() - b.dt.getTime()),
    [items, today, limit, filterClient, filterType])

  const clients = useMemo(() => Array.from(new Set(items.map(i => i.c))).sort(), [items])

  const grouped = useMemo(() => {
    const map = new Map<string, ContentItem[]>()
    upcoming.forEach(item => {
      const key = item.dt.toISOString().slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    })
    return map
  }, [upcoming])

  const publishedInRange = useMemo(() =>
    upcoming.filter(i => (states[i.i]?.status ?? i.s) === 3).length,
    [upcoming, states])

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* ── Controls ──────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <ToggleButtonGroup size="small" value={days} exclusive onChange={(_, v) => v && setDays(v)} sx={{ height: 28 }}>
          <ToggleButton value={7} sx={{ fontSize: '0.7rem', px: 1.5 }}>7 dias</ToggleButton>
          <ToggleButton value={15} sx={{ fontSize: '0.7rem', px: 1.5 }}>15 dias</ToggleButton>
        </ToggleButtonGroup>

        <ToggleButtonGroup size="small" value={filterType} exclusive onChange={(_, v) => v && setFilterType(v)} sx={{ height: 28 }}>
          <ToggleButton value="all"  sx={{ fontSize: '0.7rem', px: 1.5 }}>Todos</ToggleButton>
          <ToggleButton value="Post" sx={{ fontSize: '0.7rem', px: 1.5 }}>Posts</ToggleButton>
          <ToggleButton value="Reel" sx={{ fontSize: '0.7rem', px: 1.5 }}>Reels</ToggleButton>
        </ToggleButtonGroup>

        <Chip
          label={`${publishedInRange}/${upcoming.length} publicados`}
          size="small"
          color={publishedInRange === upcoming.length && upcoming.length > 0 ? 'success' : 'default'}
          variant="outlined"
          sx={{ fontSize: '0.6rem', height: 22, ml: 'auto' }}
        />
      </Box>

      {/* ── Client filter ─────────────────────────────── */}
      <Stack direction="row" spacing={0.8} sx={{ overflowX: 'auto', pb: 0.5 }}>
        <Chip label="Todos" size="small" variant={filterClient ? 'outlined' : 'filled'} color="primary" onClick={() => setFilterClient(null)} sx={{ flexShrink: 0 }} />
        {clients.map(c => (
          <Chip key={c} label={c} size="small" variant={filterClient === c ? 'filled' : 'outlined'} onClick={() => setFilterClient(c)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }} />
        ))}
      </Stack>

      <HintCard text="Filtre por cliente e tipo de conteúdo. Expanda cada card para adicionar o link do Drive antes de publicar." />
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

      {/* ── Groups ────────────────────────────────────── */}
      {grouped.size === 0 ? (
        <Paper sx={{ py: 6, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.08)', bgcolor: 'transparent' }}>
          <CalendarTodayIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1, display: 'block', mx: 'auto' }} />
          <Typography variant="body2" color="text.secondary">
            Nenhum conteúdo nos próximos {days} dias
          </Typography>
        </Paper>
      ) : (
        Array.from(grouped.entries()).map(([dateKey, dayItems]) => {
          const date = new Date(dateKey + 'T12:00:00')
          const doneCount = dayItems.filter(i => (states[i.i]?.status ?? i.s) === 3).length
          const isToday = dateKey === today.toISOString().slice(0, 10)

          return (
            <Box key={dateKey}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8, px: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: isToday ? 'primary.main' : 'text.disabled' }} />
                  <Typography variant="overline" fontWeight={700} sx={{ letterSpacing: 0.8, color: isToday ? 'primary.main' : 'text.secondary', fontSize: '0.65rem', textTransform: 'capitalize' }}>
                    {isToday ? 'Hoje · ' : ''}{date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })}
                  </Typography>
                </Box>
                <Chip label={`${doneCount}/${dayItems.length}`} size="small" color={doneCount === dayItems.length ? 'success' : 'default'} variant="outlined" sx={{ fontSize: '0.58rem', height: 18 }} />
              </Box>

              {dayItems.map(item => (
                <ContentCard
                  key={item.i}
                  item={item}
                  state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }}
                  onStatusChange={onStatusChange}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onEdit={onEdit}
                />
              ))}
            </Box>
          )
        })
      )}
    </Box>
  )
}
