import { useState, useMemo } from 'react'
import {
  Box, Typography, Button, Snackbar, Alert,
  Chip, Stack, Paper, Divider, Fab,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ScheduleIcon from '@mui/icons-material/Schedule'
import ShareIcon from '@mui/icons-material/Share'
import ChecklistIcon from '@mui/icons-material/Checklist'
import CloseIcon from '@mui/icons-material/Close'
import type { ContentItem, ItemEditPatch, ItemState, Status } from '../types'
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

export default function TodayTab({ items, states, onStatusChange, onUpdate, onDelete, onEdit, now }: Props) {
  const [copied, setCopied] = useState(false)
  const [filterClient, setFilterClient] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const today = useMemo(() => {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d
  }, [now])
  const tomorrow = useMemo(() => new Date(today.getTime() + 86_400_000), [today])

  const late      = useMemo(() => items.filter(i => (states[i.i]?.status ?? i.s) < 3 && i.dt < today).sort((a, b) => a.dt.getTime() - b.dt.getTime()), [items, states, today])
  const todayItems = useMemo(() => items.filter(i => i.dt >= today && i.dt < tomorrow), [items, today, tomorrow])

  const todayDone    = todayItems.filter(i => (states[i.i]?.status ?? i.s) === 3).length
  const todayEditing = todayItems.filter(i => (states[i.i]?.status ?? i.s) === 1).length
  const todayApproved = todayItems.filter(i => (states[i.i]?.status ?? i.s) === 2).length

  const clients = useMemo(() => {
    const set = new Set([...late, ...todayItems].map(i => i.c))
    return Array.from(set).sort()
  }, [late, todayItems])

  const filter = (arr: ContentItem[]) =>
    filterClient ? arr.filter(i => i.c === filterClient) : arr

  const buildReportLines = () => {
    const lines = [
      `*Resumo — ${today.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}*`,
      '',
    ]
    if (late.length) {
      lines.push(`*⚠️ Atrasados (${late.length}):*`)
      late.forEach(i => lines.push(`• ${i.c} — ${i.n} (${i.tp})`))
      lines.push('')
    }
    if (todayItems.length) {
      lines.push(`*📅 Hoje (${todayItems.length}):*`)
      todayItems.forEach(i => {
        const s = states[i.i]?.status ?? i.s
        const label = ['Pendente', 'Em edição', 'Aprovado', 'Publicado'][s]
        lines.push(`• ${i.c} — ${i.n} (${i.tp}) → ${label}`)
      })
    }
    return lines.join('\n')
  }

  const handleCopyReport = () => {
    navigator.clipboard.writeText(buildReportLines())
    setCopied(true)
  }

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildReportLines())}`, '_blank')
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const batchSetStatus = (status: Status) => {
    selectedIds.forEach(id => onStatusChange(id, status))
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* ── Stats row ─────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
        {[
          { icon: <WarningAmberIcon sx={{ fontSize: 18, color: 'error.main' }} />, value: late.length,        label: 'Atrasados',  color: late.length > 0 ? 'error.main' : 'text.secondary' },
          { icon: <ScheduleIcon     sx={{ fontSize: 18, color: 'warning.main' }} />, value: todayEditing,      label: 'Em edição',  color: 'warning.main' },
          { icon: <CheckCircleIcon  sx={{ fontSize: 18, color: 'info.main' }} />,    value: todayApproved,     label: 'Aprovados',  color: 'info.main' },
          { icon: <CheckCircleIcon  sx={{ fontSize: 18, color: 'success.main' }} />, value: todayDone,         label: 'Publicados', color: 'success.main' },
        ].map(s => (
          <Paper
            key={s.label}
            sx={{
              p: 1,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.3,
            }}
          >
            {s.icon}
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: s.color, lineHeight: 1 }}>
              {s.value}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {s.label}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* ── Hint ──────────────────────────────────────── */}
      <HintCard text="Toque no chip de status para avançar a etapa. Expanda o card com ▾ para adicionar link, legenda e observações." />

      {/* ── Client filter ─────────────────────────────── */}
      {clients.length > 1 && (
        <Stack direction="row" spacing={0.8} sx={{ overflowX: 'auto', pb: 0.5 }}>
          <Chip label="Todos" size="small" variant={filterClient ? 'outlined' : 'filled'} color="primary" onClick={() => setFilterClient(null)} sx={{ flexShrink: 0 }} />
          {clients.map(c => (
            <Chip key={c} label={c} size="small" variant={filterClient === c ? 'filled' : 'outlined'} onClick={() => setFilterClient(c)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }} />
          ))}
        </Stack>
      )}

      {/* ── Atrasados ─────────────────────────────────── */}
      {filter(late).length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
            <WarningAmberIcon sx={{ fontSize: 14, color: 'error.main' }} />
            <Typography variant="overline" color="error.main" fontWeight={700} sx={{ letterSpacing: 1, lineHeight: 1 }}>
              Atrasados ({filter(late).length})
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1 }}>
            {filter(late).map(item => (
              <ContentCard key={item.i} item={item} state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }} onStatusChange={onStatusChange} onUpdate={onUpdate} onDelete={onDelete} onEdit={onEdit}
                selected={selectMode ? selectedIds.has(item.i) : undefined}
                onSelect={selectMode ? () => toggleSelect(item.i) : undefined}
              />
            ))}
          </Box>
        </Box>
      )}

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

      {/* ── Publicar hoje ─────────────────────────────── */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScheduleIcon sx={{ fontSize: 14, color: 'primary.main' }} />
            <Typography variant="overline" color="primary.main" fontWeight={700} sx={{ letterSpacing: 1, lineHeight: 1 }}>
              Publicar hoje ({filter(todayItems).length})
            </Typography>
          </Box>
          {(late.length > 0 || todayItems.length > 0) && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Button size="small" startIcon={<ContentCopyIcon />} onClick={handleCopyReport} sx={{ fontSize: '0.65rem' }}>
                Copiar
              </Button>
              <Button size="small" startIcon={<ShareIcon />} onClick={handleWhatsApp} sx={{ fontSize: '0.65rem', color: '#25D366' }}>
                WhatsApp
              </Button>
              <Button
                size="small"
                startIcon={<ChecklistIcon />}
                onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()) }}
                sx={{ fontSize: '0.65rem', color: selectMode ? 'primary.main' : 'text.secondary' }}
              >
                {selectMode ? 'Cancelar' : 'Selecionar'}
              </Button>
            </Box>
          )}
        </Box>

        {filter(todayItems).length === 0 ? (
          <Paper sx={{ py: 4, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.08)', bgcolor: 'transparent' }}>
            <CheckCircleIcon sx={{ fontSize: 32, color: 'success.main', mb: 1, display: 'block', mx: 'auto' }} />
            <Typography variant="body2" color="text.secondary">
              Nenhum conteúdo para publicar hoje
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1 }}>
            {filter(todayItems).map(item => (
              <ContentCard key={item.i} item={item} state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }} onStatusChange={onStatusChange} onUpdate={onUpdate} onDelete={onDelete} onEdit={onEdit}
                selected={selectMode ? selectedIds.has(item.i) : undefined}
                onSelect={selectMode ? () => toggleSelect(item.i) : undefined}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* ── Bottom hint ───────────────────────────────── */}
      <HintCard text="O resumo copiado vai para a área de transferência formatado para WhatsApp. Cole direto no grupo da equipe." />

      {/* ── Barra de seleção em massa ─────────────────── */}
      {selectMode && selectedIds.size > 0 && (
        <Box sx={{
          position: 'fixed', bottom: 72, left: 0, right: 0, zIndex: 1100,
          display: 'flex', gap: 0.8, px: 2, py: 1.2,
          bgcolor: '#1a1208', borderTop: '1px solid rgba(255,144,57,0.3)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.6)',
          alignItems: 'center',
        }}>
          <Typography sx={{ fontSize: '0.68rem', color: 'primary.main', fontWeight: 700, mr: 0.5 }}>
            {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
          </Typography>
          {[
            { label: 'Pendente',   status: 0 as Status, color: 'default'  as const },
            { label: 'Em edição',  status: 1 as Status, color: 'warning'  as const },
            { label: 'Aprovado',   status: 2 as Status, color: 'info'     as const },
            { label: 'Publicado',  status: 3 as Status, color: 'success'  as const },
          ].map(s => (
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

      <Snackbar open={copied} autoHideDuration={2500} onClose={() => setCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled">Resumo copiado — pronto para colar no WhatsApp</Alert>
      </Snackbar>
    </Box>
  )
}
