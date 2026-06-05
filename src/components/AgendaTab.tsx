import { useMemo, useRef, useState } from 'react'
import {
  Box, Typography, Chip, Stack, ToggleButton, ToggleButtonGroup,
  Paper, Divider, Fab, Button, CircularProgress,
} from '@mui/material'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import ChecklistIcon from '@mui/icons-material/Checklist'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import { toPng } from 'html-to-image'
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
  onDuplicate?: (id: number) => void
  clientColors?: Record<string, string>
  clientHashtags?: Record<string, string[]>
  onSaveHashtags?: (clientName: string, tags: string[]) => void
  captionTemplates?: Record<string, string[]>
  onSaveTemplates?: (clientName: string, templates: string[]) => void
  now: Date
}

export default function AgendaTab({ items, states, onStatusChange, onUpdate, onDelete, onEdit, onDuplicate, clientColors, clientHashtags, onSaveHashtags, captionTemplates, onSaveTemplates, now }: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [days, setDays] = useState<7 | 15>(7)

  const handleExport = async () => {
    if (!contentRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(contentRef.current, { backgroundColor: '#0d0d0d', pixelRatio: 2 })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `agenda-${days}dias-${now.toLocaleDateString('pt-BR').replace(/\//g, '-')}.png`
      a.click()
    } catch {}
    finally { setExporting(false) }
  }
  const [filterClient, setFilterClient] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<ContentType | 'all'>('all')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const batchSetStatus = (status: Status) => {
    selectedIds.forEach(id => onStatusChange(id, status))
    setSelectedIds(new Set()); setSelectMode(false)
  }

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
    <Box sx={{ p: { xs: 1.5, xl: 3 }, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* ── Controls ──────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <ToggleButtonGroup size="small" value={days} exclusive onChange={(_, v) => v && setDays(v)} sx={{ height: 28 }}>
          <ToggleButton value={7} sx={{ fontSize: { xs: '0.7rem', xl: '0.9rem' }, px: { xs: 1.5, xl: 2.5 } }}>7 dias</ToggleButton>
          <ToggleButton value={15} sx={{ fontSize: { xs: '0.7rem', xl: '0.9rem' }, px: { xs: 1.5, xl: 2.5 } }}>15 dias</ToggleButton>
        </ToggleButtonGroup>

        <ToggleButtonGroup size="small" value={filterType} exclusive onChange={(_, v) => v && setFilterType(v)} sx={{ height: 28 }}>
          <ToggleButton value="all"   sx={{ fontSize: { xs: '0.7rem', xl: '0.9rem' }, px: { xs: 1.5, xl: 2.5 } }}>Todos</ToggleButton>
          <ToggleButton value="Post"  sx={{ fontSize: { xs: '0.7rem', xl: '0.9rem' }, px: { xs: 1.5, xl: 2.5 } }}>Posts</ToggleButton>
          <ToggleButton value="Reel"  sx={{ fontSize: { xs: '0.7rem', xl: '0.9rem' }, px: { xs: 1.5, xl: 2.5 } }}>Reels</ToggleButton>
          <ToggleButton value="Story" sx={{ fontSize: { xs: '0.7rem', xl: '0.9rem' }, px: { xs: 1.5, xl: 2.5 } }}>Stories</ToggleButton>
        </ToggleButtonGroup>

        <Chip
          label={`${publishedInRange}/${upcoming.length} publicados`}
          size="small"
          color={publishedInRange === upcoming.length && upcoming.length > 0 ? 'success' : 'default'}
          variant="outlined"
          sx={{ fontSize: { xs: '0.6rem', xl: '0.78rem' }, height: { xs: 22, xl: 28 } }}
        />
        <Button size="small" startIcon={<ChecklistIcon />}
          onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()) }}
          sx={{ fontSize: '0.6rem', color: selectMode ? 'primary.main' : 'text.secondary', minWidth: 0, px: 0.8 }}
        >
          {selectMode ? 'Cancelar' : 'Sel.'}
        </Button>
        <Button
          size="small"
          startIcon={exporting ? <CircularProgress size={10} color="inherit" /> : <DownloadIcon sx={{ fontSize: 13 }} />}
          onClick={handleExport}
          disabled={exporting}
          sx={{ fontSize: '0.6rem', color: 'text.secondary', minWidth: 0, px: 0.8 }}
        >
          PNG
        </Button>
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
      <Box ref={contentRef}>
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

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1 }}>
                {dayItems.map((item, idx) => (
                  <ContentCard
                    key={item.i}
                    staggerIndex={idx}
                    item={item}
                    state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }}
                    now={now}
                    onStatusChange={onStatusChange}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onDuplicate={onDuplicate}
                    clientColor={clientColors?.[item.c]}
                    clientHashtags={clientHashtags?.[item.c]}
                    onSaveHashtags={onSaveHashtags ? (tags) => onSaveHashtags(item.c, tags) : undefined}
                    captionTemplates={captionTemplates?.[item.c]}
                    onSaveTemplates={onSaveTemplates}
                    selected={selectMode ? selectedIds.has(item.i) : undefined}
                    onSelect={selectMode ? () => toggleSelect(item.i) : undefined}
                  />
                ))}
              </Box>
            </Box>
          )
        })
      )}
      </Box>
      {/* ── Barra de seleção em massa ── */}
      {selectMode && selectedIds.size > 0 && (
        <Box sx={{
          position: 'fixed', bottom: 72, left: 0, right: 0, zIndex: 1100,
          display: 'flex', gap: 0.8, px: 2, py: 1.2,
          bgcolor: '#1a1208', borderTop: '1px solid rgba(255,144,57,0.3)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.6)', alignItems: 'center',
        }}>
          <Typography sx={{ fontSize: '0.68rem', color: 'primary.main', fontWeight: 700, mr: 0.5 }}>
            {selectedIds.size} sel.
          </Typography>
          {([
            { label: 'Pendente', status: 0, color: 'default' },
            { label: 'Em edição', status: 1, color: 'warning' },
            { label: 'Aprovado', status: 2, color: 'info' },
            { label: 'Publicado', status: 3, color: 'success' },
          ] as { label: string; status: Status; color: 'default' | 'warning' | 'info' | 'success' }[]).map(s => (
            <Chip key={s.label} label={s.label} size="small" color={s.color} variant="outlined"
              onClick={() => batchSetStatus(s.status)}
              sx={{ fontSize: '0.58rem', cursor: 'pointer', height: 22 }}
            />
          ))}
          <Fab size="small" onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}
            sx={{ ml: 'auto', width: 28, height: 28, minHeight: 28, bgcolor: 'rgba(255,255,255,0.08)', boxShadow: 'none' }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </Fab>
        </Box>
      )}
    </Box>
  )
}
