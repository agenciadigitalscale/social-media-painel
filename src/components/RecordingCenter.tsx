import { useState, useMemo, useCallback } from 'react'
import {
  Box, Typography, Button, Paper, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Tooltip, Select, FormControl, InputLabel,
  Autocomplete, Snackbar, Alert, Drawer,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import VideocamIcon from '@mui/icons-material/Videocam'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked'
import MovieIcon from '@mui/icons-material/Movie'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ViewListIcon from '@mui/icons-material/ViewList'
import CalendarViewWeekIcon from '@mui/icons-material/CalendarViewWeek'
import SaveIcon from '@mui/icons-material/Save'
import LinkIcon from '@mui/icons-material/Link'
import { NAME_MAP, getDisplayName } from '../lib/users'
import type { ContentItem, ItemState } from '../types'

// ── Constants ─────────────────────────────────────────────

const EQUIPMENT = [
  'Câmera principal', 'Câmera secundária', 'Drone', 'Tripé', 'Gimbal',
  'Microfone lapela', 'Microfone boom', 'Iluminação LED', 'Iluminação softbox',
  'Cartão de memória', 'Bateria extra', 'HD externo',
]

const STATUS_STEPS = ['agendado', 'gravando', 'gravado', 'em_edicao', 'editado', 'publicado'] as const

// ── Types ──────────────────────────────────────────────────

export type RecordingStatus = typeof STATUS_STEPS[number]

export interface Recording {
  id: string
  client: string
  title: string
  date: string
  time: string
  location: string
  responsible: string
  equipment: string[]
  roteiroLink: string
  driveStatus: 'pendente' | 'enviado' | 'aprovado'
  editStatus: 'pendente' | 'em_edicao' | 'concluida'
  status: RecordingStatus
  notes: string
  linkedItemId?: number
  createdAt: number
}

interface RecordingPreset {
  name: string
  items: string[]
}

// ── Status metadata ────────────────────────────────────────

const STATUS_LABEL: Record<RecordingStatus, string> = {
  agendado:  'Agendado',
  gravando:  'Gravando',
  gravado:   'Gravado',
  em_edicao: 'Em edição',
  editado:   'Editado',
  publicado: 'Publicado',
}

const STATUS_COLOR: Record<RecordingStatus, string> = {
  agendado:  '#909090',
  gravando:  '#FF4545',
  gravado:   '#FFD700',
  em_edicao: '#3B8EFF',
  editado:   '#ff9039',
  publicado: '#00C47A',
}

const STATUS_NEXT: Partial<Record<RecordingStatus, RecordingStatus>> = {
  agendado:  'gravando',
  gravando:  'gravado',
  gravado:   'em_edicao',
  em_edicao: 'editado',
  editado:   'publicado',
}

const STATUS_ADVANCE_LABEL: Partial<Record<RecordingStatus, string>> = {
  agendado:  'Iniciar gravação',
  gravando:  'Marcar gravado',
  gravado:   'Enviar para edição',
  em_edicao: 'Edição concluída',
  editado:   'Publicado',
}

// ── Persistence ────────────────────────────────────────────

function loadRecordings(): Recording[] {
  try { return JSON.parse(localStorage.getItem('sm_recordings') ?? '[]') } catch { return [] }
}
function saveRecordings(recs: Recording[]) {
  localStorage.setItem('sm_recordings', JSON.stringify(recs))
}
function loadPresets(): RecordingPreset[] {
  try { return JSON.parse(localStorage.getItem('sm_recording_presets') ?? '[]') } catch { return [] }
}
function savePresets(presets: RecordingPreset[]) {
  localStorage.setItem('sm_recording_presets', JSON.stringify(presets))
}

// ── Week helpers ───────────────────────────────────────────

function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// ── Empty form ─────────────────────────────────────────────

const EMPTY: Omit<Recording, 'id' | 'createdAt'> = {
  client: '', title: '', date: '', time: '', location: '', responsible: '',
  equipment: [], roteiroLink: '', driveStatus: 'pendente', editStatus: 'pendente',
  status: 'agendado', notes: '', linkedItemId: undefined,
}

// ── Sub-component: Status Stepper ──────────────────────────

function StatusStepper({ status }: { status: RecordingStatus }) {
  const currentIdx = STATUS_STEPS.indexOf(status)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, mb: 2 }}>
      {STATUS_STEPS.map((step, idx) => {
        const done = idx < currentIdx
        const active = idx === currentIdx
        const color = done ? '#00C47A' : active ? '#ff9039' : 'rgba(255,255,255,0.18)'
        return (
          <Box key={step} sx={{ display: 'flex', alignItems: 'center', flex: idx < STATUS_STEPS.length - 1 ? 1 : 'none' }}>
            <Tooltip title={STATUS_LABEL[step]} placement="top">
              <Box sx={{
                width: 10, height: 10, borderRadius: '50%',
                bgcolor: color,
                boxShadow: active ? `0 0 8px ${color}` : done ? `0 0 6px ${color}60` : 'none',
                flexShrink: 0,
                transition: 'all 0.2s ease',
              }} />
            </Tooltip>
            {idx < STATUS_STEPS.length - 1 && (
              <Box sx={{
                flex: 1,
                height: 2,
                bgcolor: done ? 'rgba(0,196,122,0.4)' : 'rgba(255,255,255,0.08)',
                mx: 0.3,
                transition: 'all 0.2s ease',
              }} />
            )}
          </Box>
        )
      })}
    </Box>
  )
}

// ── Sub-component: Responsible Display ────────────────────

function ResponsibleBadge({ responsibleKey }: { responsibleKey: string }) {
  const info = NAME_MAP[responsibleKey]
  if (!info) return (
    <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>{responsibleKey}</Typography>
  )
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
      <Box sx={{
        width: 18, height: 18, borderRadius: '50%',
        bgcolor: `${info.color}22`, border: `1.5px solid ${info.color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.65rem', flexShrink: 0,
      }}>
        {info.emoji}
      </Box>
      <Typography sx={{ fontSize: '0.76rem', color: info.color, fontWeight: 600 }}>
        {getDisplayName(responsibleKey)}
      </Typography>
    </Box>
  )
}

// ── Props ──────────────────────────────────────────────────

interface Props {
  allClients: string[]
  items: ContentItem[]
  states: Record<number, ItemState>
}

// ── Main Component ─────────────────────────────────────────

export default function RecordingCenter({ allClients, items, states }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>(loadRecordings)
  const [filterStatus, setFilterStatus] = useState<RecordingStatus | 'all'>('all')
  const [viewMode, setViewMode] = useState<'list' | 'week'>('list')
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Recording | null>(null)
  const [form, setForm] = useState<Omit<Recording, 'id' | 'createdAt'>>(EMPTY)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [detailRec, setDetailRec] = useState<Recording | null>(null)
  const [presets, setPresets] = useState<RecordingPreset[]>(loadPresets)
  const [presetName, setPresetName] = useState('')
  const [presetDialogOpen, setPresetDialogOpen] = useState(false)
  const [snackMsg, setSnackMsg] = useState<string | null>(null)

  const save = useCallback((recs: Recording[]) => {
    setRecordings(recs)
    saveRecordings(recs)
  }, [])

  // Linkable items: Reel or Feed not already linked
  const linkedIds = useMemo(() => new Set(recordings.map(r => r.linkedItemId).filter((id): id is number => id !== undefined)), [recordings])

  const linkableItems = useMemo(() =>
    items.filter(it => (it.tp === 'Reel' || it.tp === 'Feed') && !linkedIds.has(it.i)),
    [items, linkedIds])

  const openCreate = (prefillDate?: string) => {
    setForm(prefillDate ? { ...EMPTY, date: prefillDate } : EMPTY)
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (r: Recording) => {
    setForm({ ...r })
    setEditing(r)
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!form.client || !form.title) return
    if (editing) {
      save(recordings.map(r => r.id === editing.id ? { ...r, ...form } : r))
    } else {
      const newRec: Recording = { ...form, id: crypto.randomUUID(), createdAt: Date.now() }
      save([newRec, ...recordings])
    }
    setDialogOpen(false)
  }

  const advanceStatus = (id: string) => {
    save(recordings.map(r => {
      if (r.id !== id) return r
      const next = STATUS_NEXT[r.status]
      return next ? { ...r, status: next } : r
    }))
  }

  const deleteRec = (id: string) => {
    save(recordings.filter(r => r.id !== id))
    setDeleteId(null)
    if (detailRec?.id === id) setDetailRec(null)
  }

  const toggleEquip = (equip: string) => {
    setForm(f => ({
      ...f,
      equipment: f.equipment.includes(equip)
        ? f.equipment.filter(e => e !== equip)
        : [...f.equipment, equip],
    }))
  }

  const applyPreset = (preset: RecordingPreset) => {
    setForm(f => ({ ...f, equipment: preset.items }))
  }

  const savePreset = () => {
    if (!presetName.trim()) return
    const newPreset: RecordingPreset = { name: presetName.trim(), items: form.equipment }
    const updated = [...presets, newPreset]
    setPresets(updated)
    savePresets(updated)
    setPresetDialogOpen(false)
    setPresetName('')
    setSnackMsg('Preset salvo!')
  }

  // ── Derived data ─────────────────────────────────────────

  const filtered = useMemo(() =>
    recordings.filter(r => filterStatus === 'all' || r.status === filterStatus)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.time.localeCompare(b.time)
      }),
    [recordings, filterStatus])

  const stats = useMemo(() => ({
    total:     recordings.length,
    agendado:  recordings.filter(r => r.status === 'agendado').length,
    gravado:   recordings.filter(r => r.status === 'gravado').length,
    em_edicao: recordings.filter(r => r.status === 'em_edicao').length,
    publicado: recordings.filter(r => r.status === 'publicado').length,
  }), [recordings])

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart])

  const todayISO = toISO(new Date())

  // ── Card renderer ─────────────────────────────────────────

  const renderCard = (r: Recording) => {
    const color = STATUS_COLOR[r.status]
    const nextStatus = STATUS_NEXT[r.status]
    const isLive = r.status === 'gravando'
    const linkedItem = r.linkedItemId !== undefined ? items.find(it => it.i === r.linkedItemId) : undefined

    return (
      <Paper key={r.id} sx={{
        border: `1px solid ${color}25`,
        bgcolor: `${color}05`,
        borderRadius: 3, overflow: 'hidden',
        position: 'relative',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 32px ${color}20` },
        ...(isLive && {
          '@keyframes liveGlow': {
            '0%,100%': { boxShadow: `0 0 0 1px ${color}40, 0 0 20px ${color}30` },
            '50%': { boxShadow: `0 0 0 2px ${color}60, 0 0 40px ${color}50` },
          },
          animation: 'liveGlow 1.5s ease-in-out infinite',
        }),
      }} onClick={() => setDetailRec(r)}>
        <Box sx={{ height: 3, bgcolor: color, boxShadow: `0 0 8px ${color}` }} />

        <Box sx={{ p: 1.8 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.1 }}>
                {r.client}
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '0.92rem', lineHeight: 1.2 }} noWrap>
                {r.title}
              </Typography>
            </Box>
            <Chip
              label={isLive ? '● ' + STATUS_LABEL[r.status] : STATUS_LABEL[r.status]}
              size="small"
              sx={{
                fontSize: '0.65rem', height: 22, fontWeight: 700,
                bgcolor: `${color}18`, color, border: `1px solid ${color}40`, flexShrink: 0,
              }}
            />
          </Box>

          {/* Stepper */}
          <StatusStepper status={r.status} />

          {/* Meta */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.2 }}>
            {r.date && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                <Box component="span" sx={{ fontSize: '0.65rem' }}>📅</Box>
                <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
                  {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                  {r.time && ` às ${r.time}`}
                </Typography>
              </Box>
            )}
            {r.location && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                <LocationOnIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }} noWrap>{r.location}</Typography>
              </Box>
            )}
            {r.responsible && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                <ResponsibleBadge responsibleKey={r.responsible} />
              </Box>
            )}
          </Box>

          {/* Equipment */}
          {r.equipment.length > 0 && (
            <Box sx={{ mb: 1.2 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
                {r.equipment.slice(0, 4).map(e => (
                  <Chip key={e} label={e} size="small" sx={{ fontSize: '0.6rem', height: 20 }} />
                ))}
                {r.equipment.length > 4 && (
                  <Chip label={`+${r.equipment.length - 4}`} size="small" sx={{ fontSize: '0.6rem', height: 20 }} />
                )}
              </Box>
            </Box>
          )}

          {/* Drive/Edit badges */}
          <Box sx={{ display: 'flex', gap: 0.6, mb: 1, flexWrap: 'wrap' }}>
            <Chip
              icon={<CloudUploadIcon sx={{ fontSize: '10px !important' }} />}
              label={`Drive: ${r.driveStatus === 'pendente' ? 'Pendente' : r.driveStatus === 'enviado' ? 'Enviado' : 'Aprovado'}`}
              size="small"
              sx={{
                fontSize: '0.63rem', height: 22,
                color: r.driveStatus === 'aprovado' ? '#00C47A' : r.driveStatus === 'enviado' ? '#3B8EFF' : 'text.disabled',
              }}
            />
            <Chip
              icon={<MovieIcon sx={{ fontSize: '10px !important' }} />}
              label={`Edição: ${r.editStatus === 'pendente' ? 'Pendente' : r.editStatus === 'em_edicao' ? 'Em edição' : 'Concluída'}`}
              size="small"
              sx={{
                fontSize: '0.63rem', height: 22,
                color: r.editStatus === 'concluida' ? '#00C47A' : r.editStatus === 'em_edicao' ? '#ff9039' : 'text.disabled',
              }}
            />
          </Box>

          {/* Linked item chip */}
          {linkedItem && (
            <Box sx={{ mb: 1 }}>
              <Chip
                icon={<LinkIcon sx={{ fontSize: '11px !important' }} />}
                label={`🔗 ${(states[linkedItem.i]?.title || linkedItem.n).slice(0, 30)}`}
                size="small"
                sx={{
                  fontSize: '0.63rem', height: 22, maxWidth: '100%',
                  bgcolor: 'rgba(59,142,255,0.1)', borderColor: 'rgba(59,142,255,0.3)',
                  color: '#3B8EFF', border: '1px solid rgba(59,142,255,0.3)',
                }}
              />
            </Box>
          )}

          {r.notes && (
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontStyle: 'italic', mb: 1.2, borderLeft: '2px solid rgba(255,255,255,0.08)', pl: 1 }} noWrap>
              {r.notes}
            </Typography>
          )}

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 0.6 }} onClick={e => e.stopPropagation()}>
            {nextStatus && (
              <Button
                size="small" variant="contained"
                onClick={() => advanceStatus(r.id)}
                startIcon={nextStatus === 'gravando' ? <RadioButtonCheckedIcon sx={{ fontSize: 12 }} /> : <CheckCircleIcon sx={{ fontSize: 12 }} />}
                sx={{
                  flex: 1, fontSize: '0.7rem', fontWeight: 700, borderRadius: 1.5,
                  bgcolor: STATUS_COLOR[nextStatus], color: '#000',
                  '&:hover': { bgcolor: STATUS_COLOR[nextStatus], filter: 'brightness(1.1)' },
                  boxShadow: `0 0 12px ${STATUS_COLOR[nextStatus]}50`,
                }}
              >
                {STATUS_ADVANCE_LABEL[r.status]}
              </Button>
            )}
            <Tooltip title="Editar">
              <IconButton size="small" onClick={() => openEdit(r)} sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
                <EditIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Excluir">
              <IconButton size="small" onClick={() => setDeleteId(r.id)} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                <DeleteIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>
    )
  }

  // ── Weekly calendar mini-card ─────────────────────────────

  const renderCalendarCard = (r: Recording) => {
    const color = STATUS_COLOR[r.status]
    const respInfo = r.responsible ? NAME_MAP[r.responsible] : null
    return (
      <Box
        key={r.id}
        onClick={() => setDetailRec(r)}
        sx={{
          mb: 0.5, p: 0.8, borderRadius: 1.5,
          border: `1px solid ${color}30`,
          bgcolor: `${color}08`,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': { bgcolor: `${color}14`, transform: 'translateY(-1px)' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.2 }}>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5 }} noWrap>
            {r.client}
          </Typography>
          {respInfo && (
            <Box sx={{
              width: 16, height: 16, borderRadius: '50%',
              bgcolor: `${respInfo.color}22`, border: `1.5px solid ${respInfo.color}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.55rem', flexShrink: 0,
            }}>
              {respInfo.emoji}
            </Box>
          )}
        </Box>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.2, color: 'text.primary' }} noWrap>
          {r.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
          {r.time && <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>{r.time}</Typography>}
        </Box>
      </Box>
    )
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* ── Hero ── */}
      <Box sx={{
        background: 'linear-gradient(180deg, rgba(59,142,255,0.07) 0%, transparent 100%)',
        borderBottom: '1px solid rgba(59,142,255,0.12)',
        px: { xs: 2, md: 3 }, pt: 2.5, pb: 2,
        position: 'relative', overflow: 'hidden',
      }}>
        <Box sx={{
          position: 'absolute', top: -40, right: -40, width: 200, height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,142,255,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2.5, flexShrink: 0,
            background: 'linear-gradient(135deg, #3B8EFF, #b45aff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(59,142,255,0.4)',
          }}>
            <VideocamIcon sx={{ fontSize: 22, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: '1.15rem', letterSpacing: '-0.02em', lineHeight: 1 }}>
              Central de Gravações
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.2 }}>
              DS HUB · Produção audiovisual
            </Typography>
          </Box>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            size="small"
            onClick={() => openCreate()}
            sx={{ ml: 'auto', fontWeight: 700, borderRadius: 2, background: 'linear-gradient(135deg, #3B8EFF, #b45aff)', boxShadow: '0 0 16px rgba(59,142,255,0.35)' }}
          >
            Nova gravação
          </Button>
        </Box>

        {/* Stats */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1 }}>
          {[
            { label: 'Total',     value: stats.total,     color: '#3B8EFF', bg: 'rgba(59,142,255,0.08)',   border: 'rgba(59,142,255,0.18)' },
            { label: 'Agendados', value: stats.agendado,  color: '#909090', bg: 'rgba(144,144,144,0.06)', border: 'rgba(144,144,144,0.15)' },
            { label: 'Gravados',  value: stats.gravado,   color: '#FFD700', bg: 'rgba(255,215,0,0.07)',   border: 'rgba(255,215,0,0.18)' },
            { label: 'Em edição', value: stats.em_edicao, color: '#ff9039', bg: 'rgba(255,144,57,0.08)',  border: 'rgba(255,144,57,0.18)' },
            { label: 'Publicados',value: stats.publicado, color: '#00C47A', bg: 'rgba(0,196,122,0.08)',   border: 'rgba(0,196,122,0.18)' },
          ].map(s => (
            <Box key={s.label} sx={{
              textAlign: 'center', py: 0.8, borderRadius: 2,
              bgcolor: s.bg, border: `1px solid ${s.border}`,
            }}>
              <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: s.color, lineHeight: 1 }}>{s.value}</Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.6 }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Toolbar: filters + view toggle ── */}
      <Box sx={{
        px: { xs: 2, md: 3 }, py: 1.5,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', mr: 0.5 }}>Filtrar:</Typography>
        {(['all', 'agendado', 'gravando', 'gravado', 'em_edicao', 'editado', 'publicado'] as const).map(s => (
          <Chip
            key={s}
            label={s === 'all' ? 'Todos' : STATUS_LABEL[s]}
            size="small"
            onClick={() => setFilterStatus(s)}
            variant={filterStatus === s ? 'filled' : 'outlined'}
            sx={{
              fontSize: '0.68rem', height: 26, cursor: 'pointer',
              ...(s !== 'all' && filterStatus === s && { bgcolor: `${STATUS_COLOR[s]}22`, borderColor: STATUS_COLOR[s], color: STATUS_COLOR[s] }),
            }}
          />
        ))}

        {/* View toggle */}
        <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
          <Tooltip title="Visualização em lista">
            <IconButton
              size="small"
              onClick={() => setViewMode('list')}
              sx={{
                borderRadius: 1.5,
                color: viewMode === 'list' ? '#ff9039' : 'text.disabled',
                bgcolor: viewMode === 'list' ? 'rgba(255,144,57,0.1)' : 'transparent',
                border: viewMode === 'list' ? '1px solid rgba(255,144,57,0.3)' : '1px solid rgba(255,255,255,0.06)',
                transition: 'all 0.2s ease',
              }}
            >
              <ViewListIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Semana">
            <IconButton
              size="small"
              onClick={() => setViewMode('week')}
              sx={{
                borderRadius: 1.5,
                color: viewMode === 'week' ? '#ff9039' : 'text.disabled',
                bgcolor: viewMode === 'week' ? 'rgba(255,144,57,0.1)' : 'transparent',
                border: viewMode === 'week' ? '1px solid rgba(255,144,57,0.3)' : '1px solid rgba(255,255,255,0.06)',
                transition: 'all 0.2s ease',
              }}
            >
              <CalendarViewWeekIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── List View ── */}
      {viewMode === 'list' && (
        <Box sx={{ flex: 1, p: { xs: 1.5, md: 2 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 1.5, alignContent: 'start' }}>
          {filtered.length === 0 && (
            <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 8 }}>
              <VideocamIcon sx={{ fontSize: 48, color: 'text.disabled', display: 'block', mx: 'auto', mb: 1.5 }} />
              <Typography color="text.secondary" sx={{ fontSize: '0.9rem', fontWeight: 600, mb: 0.5 }}>
                Nenhuma gravação {filterStatus !== 'all' ? `com status "${STATUS_LABEL[filterStatus]}"` : 'cadastrada'}
              </Typography>
              <Typography color="text.disabled" sx={{ fontSize: '0.75rem', mb: 2 }}>
                Clique em "Nova gravação" para agendar sua primeira produção.
              </Typography>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => openCreate()} size="small">
                Criar agora
              </Button>
            </Box>
          )}
          {filtered.map(r => renderCard(r))}
        </Box>
      )}

      {/* ── Weekly Calendar View ── */}
      {viewMode === 'week' && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: { xs: 1, md: 2 } }}>
          {/* Week nav */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <IconButton size="small" onClick={() => setWeekStart(d => addDays(d, -7))} sx={{ color: 'text.secondary' }}>
              <ChevronLeftIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'text.primary', minWidth: 180, textAlign: 'center' }}>
              {weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – {weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Typography>
            <IconButton size="small" onClick={() => setWeekStart(d => addDays(d, 7))} sx={{ color: 'text.secondary' }}>
              <ChevronRightIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <Button
              size="small"
              onClick={() => setWeekStart(getMondayOf(new Date()))}
              sx={{ fontSize: '0.68rem', color: 'text.disabled', ml: 0.5, borderRadius: 1.5 }}
            >
              Hoje
            </Button>
          </Box>

          {/* 7-column grid */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 1,
            flex: 1,
            alignItems: 'start',
          }}>
            {weekDays.map((day, i) => {
              const iso = toISO(day)
              const isToday = iso === todayISO
              const dayRecs = recordings.filter(r => r.date === iso && (filterStatus === 'all' || r.status === filterStatus))

              return (
                <Box key={iso} sx={{
                  borderRadius: 2,
                  border: isToday ? '1px solid rgba(255,144,57,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  bgcolor: isToday ? 'rgba(255,144,57,0.04)' : 'rgba(255,255,255,0.01)',
                  borderLeft: isToday ? '3px solid #ff9039' : undefined,
                  minHeight: 120,
                  overflow: 'hidden',
                }}>
                  {/* Day header */}
                  <Box sx={{
                    px: 1, py: 0.7,
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                  }}>
                    <Typography sx={{
                      fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: isToday ? '#ff9039' : 'text.disabled',
                    }}>
                      {DAY_LABELS[i]}
                    </Typography>
                    <Typography sx={{
                      fontSize: '0.88rem', fontWeight: isToday ? 900 : 600,
                      color: isToday ? '#ff9039' : 'text.primary',
                      lineHeight: 1.1,
                    }}>
                      {day.getDate()}
                    </Typography>
                  </Box>

                  {/* Recordings */}
                  <Box sx={{ p: 0.6 }}>
                    {dayRecs.map(r => renderCalendarCard(r))}

                    {/* Empty add button */}
                    {dayRecs.length === 0 && (
                      <Box
                        onClick={() => openCreate(iso)}
                        sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 32, borderRadius: 1.5, cursor: 'pointer',
                          border: '1px dashed rgba(255,255,255,0.08)',
                          color: 'text.disabled',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            border: '1px dashed rgba(255,144,57,0.3)',
                            color: '#ff9039',
                            bgcolor: 'rgba(255,144,57,0.04)',
                          },
                        }}
                      >
                        <AddIcon sx={{ fontSize: 14 }} />
                      </Box>
                    )}
                  </Box>
                </Box>
              )
            })}
          </Box>
        </Box>
      )}

      {/* ── Detail Drawer ── */}
      <Drawer
        anchor="right"
        open={!!detailRec}
        onClose={() => setDetailRec(null)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 400 },
            bgcolor: 'rgba(11,11,11,0.97)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '20px 0 0 20px',
            p: 3,
          },
        }}
      >
        {detailRec && (() => {
          const r = detailRec
          const color = STATUS_COLOR[r.status]
          const linkedItem = r.linkedItemId !== undefined ? items.find(it => it.i === r.linkedItemId) : undefined
          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {r.client}
                  </Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: '1rem', lineHeight: 1.2, mt: 0.2 }}>
                    {r.title}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => setDetailRec(null)} sx={{ color: 'text.disabled' }}>
                  <ChevronRightIcon />
                </IconButton>
              </Box>

              <Box sx={{
                p: 1.5, borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', mb: 1, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                  Progresso
                </Typography>
                <StatusStepper status={r.status} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  {STATUS_STEPS.map(s => (
                    <Typography key={s} sx={{ fontSize: '0.52rem', color: r.status === s ? STATUS_COLOR[s] : 'text.disabled', textAlign: 'center', width: '14%', lineHeight: 1.2 }}>
                      {STATUS_LABEL[s]}
                    </Typography>
                  ))}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {r.date && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>Data</Typography>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600 }}>
                      {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                      {r.time && ` às ${r.time}`}
                    </Typography>
                  </Box>
                )}
                {r.location && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>Local</Typography>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600 }}>{r.location}</Typography>
                  </Box>
                )}
                {r.responsible && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>Responsável</Typography>
                    <ResponsibleBadge responsibleKey={r.responsible} />
                  </Box>
                )}
              </Box>

              {r.equipment.length > 0 && (
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', mb: 0.8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                    Equipamentos ({r.equipment.length})
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {r.equipment.map(e => (
                      <Chip key={e} label={e} size="small" sx={{ fontSize: '0.65rem', height: 22 }} />
                    ))}
                  </Box>
                </Box>
              )}

              {linkedItem && (
                <Box sx={{
                  p: 1.2, borderRadius: 1.5,
                  bgcolor: 'rgba(59,142,255,0.08)', border: '1px solid rgba(59,142,255,0.2)',
                }}>
                  <Typography sx={{ fontSize: '0.62rem', color: '#3B8EFF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.4 }}>
                    Vinculado ao item
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    {states[linkedItem.i]?.title || linkedItem.n}
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', mt: 0.2 }}>
                    {linkedItem.c} · {linkedItem.tp}
                  </Typography>
                </Box>
              )}

              {r.notes && (
                <Box sx={{
                  p: 1.2, borderRadius: 1.5,
                  bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', mb: 0.4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                    Observações
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', fontStyle: 'italic' }}>
                    {r.notes}
                  </Typography>
                </Box>
              )}

              <Box sx={{ mt: 'auto', display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" fullWidth onClick={() => { openEdit(r); setDetailRec(null) }} startIcon={<EditIcon />}>
                  Editar
                </Button>
                <Button
                  size="small" variant="contained" color="error"
                  onClick={() => setDeleteId(r.id)}
                  sx={{ bgcolor: 'rgba(255,69,69,0.12)', border: '1px solid rgba(255,69,69,0.3)', color: '#FF4545', '&:hover': { bgcolor: 'rgba(255,69,69,0.22)' } }}
                >
                  <DeleteIcon sx={{ fontSize: 14 }} />
                </Button>
              </Box>
            </Box>
          )
        })()}
      </Drawer>

      {/* ── Dialog: Criar/Editar ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(59,142,255,0.2)', borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VideocamIcon sx={{ color: '#3B8EFF', fontSize: 20 }} />
            <Typography fontWeight={800}>{editing ? 'Editar gravação' : 'Nova gravação'}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField select label="Cliente" size="small" fullWidth value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))}>
              {allClients.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField label="Título / Tema" size="small" fullWidth value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <TextField label="Data" type="date" size="small" fullWidth value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Horário" type="time" size="small" fullWidth value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Local" size="small" fullWidth value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />

            {/* Responsible: NAME_MAP Select */}
            <FormControl size="small" fullWidth>
              <InputLabel>Responsável</InputLabel>
              <Select
                label="Responsável"
                value={form.responsible}
                onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))}
              >
                <MenuItem value=""><em>Nenhum</em></MenuItem>
                {(Object.entries(NAME_MAP) as [string, { color: string; emoji: string; role: string; glow: string }][]).map(([key, info]) => (
                  <MenuItem key={key} value={key}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        width: 20, height: 20, borderRadius: '50%',
                        bgcolor: `${info.color}22`, border: `1.5px solid ${info.color}55`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.72rem', flexShrink: 0,
                      }}>
                        {info.emoji}
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: info.color, lineHeight: 1 }}>
                          {getDisplayName(key)}
                        </Typography>
                        <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', lineHeight: 1 }}>
                          {info.role}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <TextField label="Link do Roteiro (Drive)" size="small" fullWidth value={form.roteiroLink} onChange={e => setForm(f => ({ ...f, roteiroLink: e.target.value }))} />

          {/* Link to ContentItem */}
          <Autocomplete
            size="small"
            options={linkableItems}
            getOptionLabel={(it) => `${it.c} — ${states[it.i]?.title || it.n} (${it.tp})`}
            value={form.linkedItemId !== undefined ? (items.find(it => it.i === form.linkedItemId) ?? null) : null}
            onChange={(_, val) => setForm(f => ({ ...f, linkedItemId: val?.i }))}
            renderInput={(params) => (
              <TextField {...params} label="Vincular a conteúdo (Reel/Feed)" size="small" />
            )}
            renderOption={(props, it) => (
              <Box component="li" {...props}>
                <Typography sx={{ fontSize: '0.78rem' }}>
                  <Box component="span" sx={{ fontWeight: 700, color: '#ff9039' }}>{it.c}</Box>
                  {' — '}
                  {states[it.i]?.title || it.n}
                  {' '}
                  <Box component="span" sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>({it.tp})</Box>
                </Typography>
              </Box>
            )}
            noOptionsText="Nenhum Reel/Feed disponível"
          />

          {/* Equipment checklist */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Equipamentos
              </Typography>
              {presets.length > 0 && (
                <TextField
                  select
                  size="small"
                  label="Carregar preset"
                  value=""
                  onChange={e => {
                    const preset = presets.find(p => p.name === e.target.value)
                    if (preset) applyPreset(preset)
                  }}
                  sx={{ ml: 'auto', minWidth: 160, fontSize: '0.72rem', '& .MuiInputBase-root': { fontSize: '0.72rem' } }}
                >
                  {presets.map(p => (
                    <MenuItem key={p.name} value={p.name}>
                      {p.name} ({p.items.length} itens)
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {EQUIPMENT.map(e => (
                <Chip
                  key={e} label={e} size="small" clickable
                  onClick={() => toggleEquip(e)}
                  variant={form.equipment.includes(e) ? 'filled' : 'outlined'}
                  color={form.equipment.includes(e) ? 'info' : 'default'}
                  sx={{ fontSize: '0.68rem', height: 24 }}
                />
              ))}
            </Box>
            {form.equipment.length >= 3 && (
              <Button
                size="small"
                startIcon={<SaveIcon sx={{ fontSize: 12 }} />}
                onClick={() => setPresetDialogOpen(true)}
                sx={{
                  mt: 0.8, fontSize: '0.68rem', color: '#ff9039',
                  border: '1px solid rgba(255,144,57,0.3)',
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: 'rgba(255,144,57,0.08)' },
                }}
              >
                Salvar como preset ({form.equipment.length} itens)
              </Button>
            )}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField select label="Status Drive" size="small" fullWidth value={form.driveStatus} onChange={e => setForm(f => ({ ...f, driveStatus: e.target.value as Recording['driveStatus'] }))}>
              {[['pendente','Pendente'],['enviado','Enviado'],['aprovado','Aprovado']].map(([v,l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
            </TextField>
            <TextField select label="Status Edição" size="small" fullWidth value={form.editStatus} onChange={e => setForm(f => ({ ...f, editStatus: e.target.value as Recording['editStatus'] }))}>
              {[['pendente','Pendente'],['em_edicao','Em edição'],['concluida','Concluída']].map(([v,l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
            </TextField>
          </Box>

          <TextField label="Observações" size="small" fullWidth multiline rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button size="small" onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            size="small" variant="contained" disabled={!form.client || !form.title}
            onClick={handleSubmit}
            sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #3B8EFF, #b45aff)' }}
          >
            {editing ? 'Salvar alterações' : 'Criar gravação'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Salvar preset ── */}
      <Dialog open={presetDialogOpen} onClose={() => setPresetDialogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3 } }}>
        <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: 800 }}>Salvar preset de equipamentos</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            autoFocus
            label="Nome do preset"
            size="small"
            fullWidth
            value={presetName}
            onChange={e => setPresetName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && savePreset()}
            placeholder="Ex: Kit Externo Completo"
          />
          <Typography sx={{ mt: 1, fontSize: '0.7rem', color: 'text.disabled' }}>
            {form.equipment.length} itens serão salvos neste preset.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button size="small" onClick={() => setPresetDialogOpen(false)}>Cancelar</Button>
          <Button
            size="small" variant="contained" disabled={!presetName.trim()}
            onClick={savePreset}
            sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #ff9039, #ff5339)' }}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Confirmar exclusão ── */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,69,69,0.2)', borderRadius: 3 } }}>
        <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: 800 }}>Excluir gravação?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>Esta ação não pode ser desfeita.</Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button size="small" color="error" variant="contained" onClick={() => deleteId && deleteRec(deleteId)}>
            Excluir
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar
        open={!!snackMsg}
        autoHideDuration={2500}
        onClose={() => setSnackMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackMsg(null)} severity="success" variant="filled" sx={{ fontSize: '0.8rem' }}>
          {snackMsg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
