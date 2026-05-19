import { useState, useMemo } from 'react'
import {
  Box, Typography, Button, Snackbar, Alert,
  Chip, Stack, Paper, Divider, Fab,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, ToggleButton, ToggleButtonGroup,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ScheduleIcon from '@mui/icons-material/Schedule'
import ChecklistIcon from '@mui/icons-material/Checklist'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff'
import CalendarViewWeekIcon from '@mui/icons-material/CalendarViewWeek'
import type { Client, ContentItem, ContentType, ItemEditPatch, ItemState, Status } from '../types'
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
  onAddItem?: (clientName: string, title: string, type: ContentType, date: Date, status: Status) => void
  clientColors?: Record<string, string>
  clientHashtags?: Record<string, string[]>
  onSaveHashtags?: (clientName: string, tags: string[]) => void
  captionTemplates?: Record<string, string[]>
  onSaveTemplates?: (clientName: string, templates: string[]) => void
  allClients?: Client[]
  now: Date
}

export default function TodayTab({ items, states, onStatusChange, onUpdate, onDelete, onEdit, onDuplicate, onAddItem, clientColors, clientHashtags, onSaveHashtags, captionTemplates, onSaveTemplates, allClients, now }: Props) {
  const [copied, setCopied] = useState(false)
  const [weeklyCopied, setWeeklyCopied] = useState(false)
  const [filterClient, setFilterClient] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [addClient, setAddClient] = useState('')
  const [addTitle, setAddTitle] = useState('')
  const [addType, setAddType] = useState<ContentType>('Post')
  const [addDate, setAddDate] = useState(() => new Date().toISOString().split('T')[0])
  const [addStatus, setAddStatus] = useState<Status>(0)
  const [weeklyOpen, setWeeklyOpen] = useState(false)

  const clientOptions = useMemo(() => {
    const fromItems = Array.from(new Set(items.map(i => i.c))).sort()
    const fromClients = (allClients ?? []).map(c => c.name)
    return Array.from(new Set([...fromClients, ...fromItems])).sort()
  }, [items, allClients])

  const handleAddSubmit = () => {
    if (!addClient || !addTitle) return
    onAddItem?.(addClient, addTitle, addType, new Date(addDate + 'T12:00:00'), addStatus)
    setAddOpen(false)
    setAddClient('')
    setAddTitle('')
    setAddType('Post')
    setAddDate(new Date().toISOString().split('T')[0])
    setAddStatus(0)
  }

  const today = useMemo(() => {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d
  }, [now])
  const tomorrow = useMemo(() => new Date(today.getTime() + 86_400_000), [today])

  const late      = useMemo(() => items.filter(i => (states[i.i]?.status ?? i.s) < 3 && i.dt < today).sort((a, b) => a.dt.getTime() - b.dt.getTime()), [items, states, today])
  const todayItems = useMemo(() => items.filter(i => i.dt >= today && i.dt < tomorrow), [items, today, tomorrow])
  const dayAfterTomorrow = useMemo(() => new Date(tomorrow.getTime() + 86_400_000), [tomorrow])
  const riskItems = useMemo(() => items.filter(i => {
    const st = states[i.i]?.status ?? i.s
    return i.dt > today && i.dt < dayAfterTomorrow && st < 2
  }), [items, states, today, dayAfterTomorrow])

  const todayDone    = todayItems.filter(i => (states[i.i]?.status ?? i.s) === 3).length
  const todayEditing = todayItems.filter(i => (states[i.i]?.status ?? i.s) === 1).length
  const todayApproved = todayItems.filter(i => (states[i.i]?.status ?? i.s) === 2).length

  // Clientes silenciosos: têm conteúdo nos últimos 3 dias mas nenhum publicado
  const silentClients = useMemo(() => {
    const threeDaysAgo = new Date(today.getTime() - 3 * 86_400_000)
    const byClient = new Map<string, { total: number; published: number }>()
    items.forEach(i => {
      if (i.dt < threeDaysAgo || i.dt >= tomorrow) return
      const cur = byClient.get(i.c) ?? { total: 0, published: 0 }
      cur.total++
      if ((states[i.i]?.status ?? i.s) === 3) cur.published++
      byClient.set(i.c, cur)
    })
    return Array.from(byClient.entries())
      .filter(([, v]) => v.total > 0 && v.published === 0)
      .map(([name, v]) => ({ name, total: v.total }))
  }, [items, states, today, tomorrow])

  // Estatísticas semanais (últimos 7 dias)
  const weeklyStats = useMemo(() => {
    const weekStart = new Date(today.getTime() - 6 * 86_400_000)
    const byClient = new Map<string, { planned: number; published: number }>()
    items.forEach(i => {
      if (i.dt < weekStart || i.dt >= tomorrow) return
      const cur = byClient.get(i.c) ?? { planned: 0, published: 0 }
      cur.planned++
      if ((states[i.i]?.status ?? i.s) === 3) cur.published++
      byClient.set(i.c, cur)
    })
    return Array.from(byClient.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, v]) => ({ name, ...v }))
  }, [items, states, today, tomorrow])

  const buildWeeklyReport = () => {
    const weekStart = new Date(today.getTime() - 6 * 86_400_000)
    const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    const total = weeklyStats.reduce((s, c) => s + c.published, 0)
    const planned = weeklyStats.reduce((s, c) => s + c.planned, 0)
    const lines = [
      `*Resumo semanal — ${fmt(weekStart)} a ${fmt(today)}*`,
      `✅ ${total}/${planned} publicados na semana`,
      '',
      ...weeklyStats.map(c => `• ${c.name}: ${c.published}/${c.planned}`),
    ]
    return lines.join('\n')
  }

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

      {/* ── Banner de risco ───────────────────────────── */}
      {riskItems.length > 0 && (
        <Paper sx={{
          px: 1.8, py: 1.2,
          border: '1px solid rgba(255,165,0,0.3)',
          background: 'linear-gradient(135deg, rgba(255,144,57,0.08), rgba(255,83,57,0.05))',
          borderRadius: 2.5,
          display: 'flex', alignItems: 'center', gap: 1.2,
        }}>
          <ErrorOutlineIcon sx={{ color: 'warning.main', fontSize: 20, flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: 'warning.main', lineHeight: 1.2 }}>
              {riskItems.length} conteúdo{riskItems.length > 1 ? 's' : ''} publicando amanhã sem aprovação
            </Typography>
            <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', mt: 0.3 }} noWrap>
              {riskItems.map(i => i.c).filter((c, i, a) => a.indexOf(c) === i).join(', ')}
            </Typography>
          </Box>
          <Button size="small" onClick={() => {
            const id = riskItems[0]?.i
            if (id) onStatusChange(id, 2)
          }} sx={{ fontSize: '0.6rem', color: 'warning.main', borderColor: 'rgba(255,165,0,0.3)', border: '1px solid', flexShrink: 0, py: 0.3, px: 1 }}>
            Ver
          </Button>
        </Paper>
      )}

      {/* ── Clientes silenciosos ──────────────────────── */}
      {silentClients.length > 0 && (
        <Paper sx={{
          px: 1.8, py: 1.2,
          border: '1px solid rgba(59,142,255,0.25)',
          background: 'rgba(59,142,255,0.05)',
          borderRadius: 2.5,
          display: 'flex', alignItems: 'flex-start', gap: 1.2,
        }}>
          <NotificationsOffIcon sx={{ color: 'info.main', fontSize: 18, flexShrink: 0, mt: 0.1 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: 'info.main', lineHeight: 1.2 }}>
              {silentClients.length} cliente{silentClients.length > 1 ? 's' : ''} sem publicação nos últimos 3 dias
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {silentClients.map(({ name, total }) => (
                <Chip key={name} label={`${name} (${total})`} size="small" variant="outlined"
                  sx={{ fontSize: '0.58rem', height: 18, borderColor: 'rgba(59,142,255,0.3)', color: 'info.main' }} />
              ))}
            </Box>
          </Box>
        </Paper>
      )}

      {/* ── Resumo semanal ────────────────────────────── */}
      {weeklyOpen && (
        <Paper sx={{
          px: 1.8, py: 1.5,
          border: '1px solid rgba(255,144,57,0.2)',
          borderRadius: 2.5,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <CalendarViewWeekIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: 'primary.main' }}>
                Últimos 7 dias
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>
                · {weeklyStats.reduce((s, c) => s + c.published, 0)}/{weeklyStats.reduce((s, c) => s + c.planned, 0)} publicados
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 12 }} />}
                onClick={() => { navigator.clipboard.writeText(buildWeeklyReport()); setWeeklyCopied(true) }}
                sx={{ fontSize: '0.6rem', minWidth: 0, px: 0.8 }}>
                Copiar
              </Button>
              <Button size="small" startIcon={<WhatsAppIcon sx={{ fontSize: 12 }} />}
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(buildWeeklyReport())}`, '_blank')}
                sx={{ fontSize: '0.6rem', color: '#25D366', minWidth: 0, px: 0.8 }}>
                WA
              </Button>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
            {weeklyStats.map(({ name, planned, published }) => {
              const pct = planned > 0 ? (published / planned) * 100 : 0
              return (
                <Box key={name}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 600 }} noWrap>{name}</Typography>
                    <Typography sx={{ fontSize: '0.62rem', color: published === planned && planned > 0 ? 'success.main' : 'text.secondary', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {published}/{planned}
                    </Typography>
                  </Box>
                  <Box sx={{ height: 4, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: pct === 100 ? 'success.main' : 'primary.main', borderRadius: 2, transition: 'width 0.4s' }} />
                  </Box>
                </Box>
              )
            })}
          </Box>
        </Paper>
      )}

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
      {(filter(late).length > 0 || onAddItem) && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
            <WarningAmberIcon sx={{ fontSize: 14, color: 'error.main' }} />
            <Typography variant="overline" color="error.main" fontWeight={700} sx={{ letterSpacing: 1, lineHeight: 1 }}>
              Atrasados ({filter(late).length})
            </Typography>
            {onAddItem && (
              <Button
                size="small"
                startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                onClick={() => setAddOpen(true)}
                sx={{ ml: 'auto', fontSize: '0.62rem', color: 'error.main', borderColor: 'rgba(255,69,69,0.35)', border: '1px solid', borderRadius: 2, px: 1, py: 0.3, minHeight: 0, '&:hover': { bgcolor: 'rgba(255,69,69,0.08)' } }}
              >
                Adicionar
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1 }}>
            {filter(late).map(item => (
              <ContentCard key={item.i} item={item} state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }} now={now} onStatusChange={onStatusChange} onUpdate={onUpdate} onDelete={onDelete} onEdit={onEdit} onDuplicate={onDuplicate} clientColor={clientColors?.[item.c]} clientHashtags={clientHashtags?.[item.c]} onSaveHashtags={onSaveHashtags ? (tags) => onSaveHashtags(item.c, tags) : undefined} captionTemplates={captionTemplates?.[item.c]} onSaveTemplates={onSaveTemplates}
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
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {(late.length > 0 || todayItems.length > 0) && (
              <>
                <Button size="small" startIcon={<ContentCopyIcon />} onClick={handleCopyReport} sx={{ fontSize: '0.65rem' }}>
                  Copiar
                </Button>
                <Button size="small" startIcon={<WhatsAppIcon />} onClick={handleWhatsApp} sx={{ fontSize: '0.65rem', color: '#25D366' }}>
                  WhatsApp
                </Button>
              </>
            )}
            <Button size="small" startIcon={<CalendarViewWeekIcon />} onClick={() => setWeeklyOpen(v => !v)} sx={{ fontSize: '0.65rem', color: weeklyOpen ? 'primary.main' : 'text.secondary' }}>
              Semana
            </Button>
            {(late.length > 0 || todayItems.length > 0) && (
              <Button
                size="small"
                startIcon={<ChecklistIcon />}
                onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()) }}
                sx={{ fontSize: '0.65rem', color: selectMode ? 'primary.main' : 'text.secondary' }}
              >
                {selectMode ? 'Cancelar' : 'Selecionar'}
              </Button>
            )}
          </Box>
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
              <ContentCard key={item.i} item={item} state={states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }} now={now} onStatusChange={onStatusChange} onUpdate={onUpdate} onDelete={onDelete} onEdit={onEdit} onDuplicate={onDuplicate} clientColor={clientColors?.[item.c]} clientHashtags={clientHashtags?.[item.c]} onSaveHashtags={onSaveHashtags ? (tags) => onSaveHashtags(item.c, tags) : undefined} captionTemplates={captionTemplates?.[item.c]} onSaveTemplates={onSaveTemplates}
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
      <Snackbar open={weeklyCopied} autoHideDuration={2500} onClose={() => setWeeklyCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled">Resumo semanal copiado!</Alert>
      </Snackbar>

      {/* ── Dialog: Adicionar conteúdo atrasado ────────── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AddIcon sx={{ color: 'error.main', fontSize: 18 }} />
            <Typography fontWeight={700} sx={{ fontSize: '0.95rem' }}>Adicionar conteúdo</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

          {/* Cliente */}
          <TextField
            label="Cliente" size="small" fullWidth select autoFocus
            value={addClient}
            onChange={e => setAddClient(e.target.value)}
          >
            {clientOptions.map(c => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>

          {/* Título */}
          <TextField
            label="Título do conteúdo" size="small" fullWidth
            value={addTitle}
            onChange={e => setAddTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddSubmit()}
          />

          {/* Tipo */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tipo</Typography>
            <ToggleButtonGroup exclusive value={addType} onChange={(_, v) => v && setAddType(v)} size="small" fullWidth>
              <ToggleButton value="Post"  sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Post</ToggleButton>
              <ToggleButton value="Reel"  sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Reel</ToggleButton>
              <ToggleButton value="Story" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Story</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Data */}
          <TextField
            label="Data" size="small" fullWidth type="date"
            value={addDate}
            onChange={e => setAddDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          {/* Status inicial */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status inicial</Typography>
            <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
              {(['Pendente', 'Em edição', 'Aprovado', 'Publicado'] as const).map((label, idx) => (
                <Chip
                  key={label} label={label} size="small"
                  onClick={() => setAddStatus(idx as Status)}
                  variant={addStatus === idx ? 'filled' : 'outlined'}
                  color={(['default', 'warning', 'info', 'success'] as const)[idx]}
                  sx={{ cursor: 'pointer', fontSize: '0.62rem' }}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setAddOpen(false)}>Cancelar</Button>
          <Button
            size="small" variant="contained" color="error"
            disabled={!addClient || !addTitle}
            startIcon={<AddIcon />}
            onClick={handleAddSubmit}
            sx={{ fontWeight: 700 }}
          >
            Adicionar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
