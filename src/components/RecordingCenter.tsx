import { useState, useMemo } from 'react'
import {
  Box, Typography, Button, Paper, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Divider, Tooltip,
  FormControlLabel, Checkbox,
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
import PersonIcon from '@mui/icons-material/Person'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import CursorGlow from './CursorGlow'

const EQUIPMENT = ['Câmera principal', 'Câmera secundária', 'Drone', 'Tripé', 'Gimbal', 'Microfone lapela', 'Microfone boom', 'Iluminação LED', 'Iluminação softbox', 'Cartão de memória', 'Bateria extra', 'HD externo']

export type RecordingStatus = 'agendado' | 'gravando' | 'gravado' | 'em_edicao' | 'editado' | 'publicado'

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
  createdAt: number
}

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
const STATUS_EMOJI: Record<RecordingStatus, string> = {
  agendado:  '📅',
  gravando:  '🔴',
  gravado:   '📹',
  em_edicao: '✂️',
  editado:   '✅',
  publicado: '📁',
}
const STATUS_NEXT: Partial<Record<RecordingStatus, RecordingStatus>> = {
  agendado:  'gravando',
  gravando:  'gravado',
  gravado:   'em_edicao',
  em_edicao: 'editado',
  editado:   'publicado',
}

function loadRecordings(): Recording[] {
  try { return JSON.parse(localStorage.getItem('sm_recordings') ?? '[]') } catch { return [] }
}
function saveRecordings(recs: Recording[]) {
  localStorage.setItem('sm_recordings', JSON.stringify(recs))
}

const EMPTY: Omit<Recording, 'id' | 'createdAt'> = {
  client: '', title: '', date: '', time: '', location: '', responsible: '',
  equipment: [], roteiroLink: '', driveStatus: 'pendente', editStatus: 'pendente',
  status: 'agendado', notes: '',
}

export default function RecordingCenter({ allClients }: { allClients: string[] }) {
  const [recordings, setRecordings] = useState<Recording[]>(loadRecordings)
  const [filterStatus, setFilterStatus] = useState<RecordingStatus | 'all'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Recording | null>(null)
  const [form, setForm] = useState<Omit<Recording, 'id' | 'createdAt'>>(EMPTY)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const save = (recs: Recording[]) => { setRecordings(recs); saveRecordings(recs) }

  const openCreate = () => { setForm(EMPTY); setEditing(null); setDialogOpen(true) }
  const openEdit   = (r: Recording) => { setForm({ ...r }); setEditing(r); setDialogOpen(true) }

  const handleSubmit = () => {
    if (!form.client || !form.title) return
    if (editing) {
      save(recordings.map(r => r.id === editing.id ? { ...r, ...form } : r))
    } else {
      save([{ ...form, id: crypto.randomUUID(), createdAt: Date.now() }, ...recordings])
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

  const deleteRec = (id: string) => { save(recordings.filter(r => r.id !== id)); setDeleteId(null) }

  const toggleEquip = (equip: string) => {
    setForm(f => ({
      ...f,
      equipment: f.equipment.includes(equip)
        ? f.equipment.filter(e => e !== equip)
        : [...f.equipment, equip],
    }))
  }

  const filtered = useMemo(() =>
    recordings.filter(r => filterStatus === 'all' || r.status === filterStatus)
      .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.time.localeCompare(b.time)),
    [recordings, filterStatus])

  const stats = useMemo(() => ({
    total:     recordings.length,
    agendado:  recordings.filter(r => r.status === 'agendado').length,
    gravando:  recordings.filter(r => r.status === 'gravando').length,
    gravado:   recordings.filter(r => r.status === 'gravado').length,
    em_edicao: recordings.filter(r => r.status === 'em_edicao').length,
    editado:   recordings.filter(r => r.status === 'editado').length,
    publicado: recordings.filter(r => r.status === 'publicado').length,
  }), [recordings])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%', position: 'relative' }}>
      <CursorGlow color="rgba(255,144,57,0.05)" size={420} />

      {/* Hero header */}
      <Box sx={{
        background: 'linear-gradient(180deg, rgba(255,144,57,0.07) 0%, transparent 100%)',
        borderBottom: '1px solid rgba(255,144,57,0.12)',
        px: { xs: 2, md: 3 }, pt: 2.5, pb: 2,
        position: 'relative', overflow: 'hidden',
      }}>
        <Box sx={{
          position: 'absolute', top: -40, right: -40, width: 200, height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,144,57,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
          {/* Header icon with DS orange glow */}
          <Box sx={{
            width: { xs: 44, xl: 54 }, height: { xs: 44, xl: 54 },
            borderRadius: 2.5, flexShrink: 0,
            background: 'linear-gradient(135deg, #ff9039, #ff5339)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(255,144,57,0.45)',
            fontSize: { xs: '1.3rem', xl: '1.6rem' },
          }}>
            🎬
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.1rem', xl: '1.35rem' }, letterSpacing: '-0.02em', lineHeight: 1 }}>
              Central de Gravações
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.72rem', xl: '0.82rem' }, color: 'text.disabled', mt: 0.3 }}>
              DS HUB · Produção audiovisual
            </Typography>
          </Box>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            size="small"
            onClick={openCreate}
            sx={{
              ml: 'auto', fontWeight: 700, borderRadius: 2,
              background: 'linear-gradient(135deg, #ff9039, #ff5339)',
              boxShadow: '0 0 16px rgba(255,144,57,0.35)',
              color: '#000',
              '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
            }}
          >
            Nova gravação
          </Button>
        </Box>

        {/* Stats KPI chips */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' }, gap: { xs: 0.8, md: 1 } }}>
          {([
            { label: 'Total',     value: stats.total,     s: null         as RecordingStatus | null },
            { label: 'Agendados', value: stats.agendado,  s: 'agendado'   as RecordingStatus },
            { label: 'Gravados',  value: stats.gravado,   s: 'gravado'    as RecordingStatus },
            { label: 'Em edição', value: stats.em_edicao, s: 'em_edicao'  as RecordingStatus },
            { label: 'Editados',  value: stats.editado,   s: 'editado'    as RecordingStatus },
            { label: 'Publicados',value: stats.publicado, s: 'publicado'  as RecordingStatus },
          ] as const).map(st => {
            const color = st.s ? STATUS_COLOR[st.s] : '#3B8EFF'
            const emoji = st.s ? STATUS_EMOJI[st.s] : '📊'
            return (
              <Box key={st.label} sx={{
                textAlign: 'center', py: { xs: 0.8, xl: 1.2 }, px: 0.5, borderRadius: 2,
                bgcolor: `${color}0d`, border: `1px solid ${color}22`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': { bgcolor: `${color}1a`, transform: 'translateY(-1px)' },
                position: 'relative',
                '&::after': {
                  content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                  background: `linear-gradient(90deg, transparent, ${color}55 30%, ${color}88 50%, ${color}55 70%, transparent)`,
                  pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit',
                },
              }}
              onClick={() => setFilterStatus(st.s ?? 'all')}
              >
                <Typography sx={{ fontSize: '0.9rem', lineHeight: 1, mb: 0.2 }}>{emoji}</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.2rem', xl: '1.5rem' }, color, lineHeight: 1 }}>
                  {st.value}
                </Typography>
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {st.label}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* Filter pills */}
      <Box sx={{ px: { xs: 2, md: 3 }, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 0.8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', mr: 0.5 }}>Filtrar:</Typography>
        {(['all', 'agendado', 'gravando', 'gravado', 'em_edicao', 'editado', 'publicado'] as const).map(s => {
          const color = s !== 'all' ? STATUS_COLOR[s] : '#ff9039'
          const label = s === 'all' ? 'Todos' : STATUS_LABEL[s]
          const isActive = filterStatus === s
          return (
            <Chip
              key={s}
              label={s !== 'all' ? `${STATUS_EMOJI[s]} ${label}` : label}
              size="small"
              onClick={() => setFilterStatus(s)}
              sx={{
                fontSize: '0.68rem', height: 26, cursor: 'pointer',
                fontWeight: isActive ? 700 : 400,
                bgcolor: isActive ? `${color}22` : 'transparent',
                borderColor: isActive ? color : 'rgba(255,255,255,0.12)',
                color: isActive ? color : 'rgba(255,255,255,0.45)',
                border: '1px solid',
                transition: 'all 0.2s ease',
                '&:hover': { bgcolor: `${color}14`, borderColor: color, color },
              }}
            />
          )
        })}
      </Box>

      {/* Cards grid */}
      <Box sx={{ flex: 1, p: { xs: 1.5, md: 2 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 1.5, alignContent: 'start' }}>
        {filtered.length === 0 && (
          <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 8 }}>
            <Typography sx={{ fontSize: '3rem', mb: 1.5, display: 'block' }}>🎬</Typography>
            <Typography color="text.secondary" sx={{ fontSize: '0.9rem', fontWeight: 600, mb: 0.5 }}>
              Nenhuma gravação {filterStatus !== 'all' ? `com status "${STATUS_LABEL[filterStatus]}"` : 'cadastrada'}
            </Typography>
            <Typography color="text.disabled" sx={{ fontSize: '0.75rem', mb: 2 }}>
              Clique em "Nova gravação" para agendar sua primeira produção.
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreate} size="small"
              sx={{ borderColor: 'rgba(255,144,57,0.3)', color: '#ff9039', '&:hover': { borderColor: '#ff9039', bgcolor: 'rgba(255,144,57,0.06)' } }}>
              Criar agora
            </Button>
          </Box>
        )}

        {filtered.map(r => {
          const color      = STATUS_COLOR[r.status]
          const nextStatus = STATUS_NEXT[r.status]
          const isLive     = r.status === 'gravando'

          return (
            <Paper key={r.id} sx={{
              border: `1px solid ${color}25`,
              bgcolor: `${color}04`,
              borderRadius: 3, overflow: 'hidden',
              position: 'relative',
              transition: 'all 0.28s ease',
              '&::after': {
                content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                background: `linear-gradient(90deg, transparent, ${color}55 30%, ${color}88 50%, ${color}55 70%, transparent)`,
                pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit',
              },
              '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 10px 32px rgba(0,0,0,0.55), 0 0 20px ${color}15` },
              ...(isLive && {
                '@keyframes liveGlow': {
                  '0%,100%': { boxShadow: `0 0 0 1px ${color}40, 0 0 20px ${color}30` },
                  '50%':     { boxShadow: `0 0 0 2px ${color}60, 0 0 40px ${color}50` },
                },
                animation: 'liveGlow 1.5s ease-in-out infinite',
              }),
            }}>
              {/* Status bar top */}
              <Box sx={{ height: 3, bgcolor: color, boxShadow: `0 0 8px ${color}` }} />

              <Box sx={{ p: { xs: 1.5, xl: 2 } }}>
                {/* Header: client + status pill */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.2 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {/* Client name with colored accent */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.4 }}>
                      <Box sx={{ width: 3, height: 14, borderRadius: 2, bgcolor: color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: { xs: '0.72rem', xl: '0.8rem' }, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        {r.client}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 800, fontSize: { xs: '0.9rem', xl: '1rem' }, lineHeight: 1.25 }} noWrap>
                      {r.title}
                    </Typography>
                  </Box>

                  {/* Status pill */}
                  <Chip
                    label={`${STATUS_EMOJI[r.status]} ${STATUS_LABEL[r.status]}`}
                    size="small"
                    sx={{
                      fontSize: '0.65rem', height: 24, fontWeight: 700,
                      bgcolor: `${color}18`, color, border: `1px solid ${color}40`,
                      flexShrink: 0,
                    }}
                  />
                </Box>

                {/* Info rows */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.2 }}>
                  {r.date && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      {/* Date pill */}
                      <Box sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 0.5,
                        px: 1, py: 0.25, borderRadius: 1.5,
                        bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                      }}>
                        <Typography sx={{ fontSize: '0.7rem' }}>📅</Typography>
                        <Typography sx={{ fontSize: { xs: '0.72rem', xl: '0.78rem' }, color: 'text.secondary', fontWeight: 500 }}>
                          {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                          {r.time && ` às ${r.time}`}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  {r.location && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                      <LocationOnIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                      <Typography sx={{ fontSize: { xs: '0.68rem', xl: '0.74rem' }, color: 'text.secondary' }} noWrap>{r.location}</Typography>
                    </Box>
                  )}
                  {r.responsible && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                      <PersonIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                      <Typography sx={{ fontSize: { xs: '0.72rem', xl: '0.78rem' }, color: 'text.secondary' }}>{r.responsible}</Typography>
                    </Box>
                  )}
                </Box>

                {/* Equipment chips */}
                {r.equipment.length > 0 && (
                  <Box sx={{ mb: 1.2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                      <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Equipamentos</Typography>
                      <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' }}>{r.equipment.length} itens</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
                      {r.equipment.slice(0, 4).map(e => (
                        <Chip key={e} label={e} size="small" sx={{ fontSize: '0.6rem', height: 20, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
                      ))}
                      {r.equipment.length > 4 && (
                        <Chip label={`+${r.equipment.length - 4}`} size="small" sx={{ fontSize: '0.6rem', height: 20, bgcolor: `${color}14`, color, border: `1px solid ${color}30` }} />
                      )}
                    </Box>
                  </Box>
                )}

                {/* Drive + Edição status badges */}
                <Box sx={{ display: 'flex', gap: 0.6, mb: 1.5, flexWrap: 'wrap' }}>
                  <Chip
                    icon={<CloudUploadIcon sx={{ fontSize: '10px !important' }} />}
                    label={`Drive: ${r.driveStatus === 'pendente' ? 'Pendente' : r.driveStatus === 'enviado' ? 'Enviado' : 'Aprovado'}`}
                    size="small"
                    sx={{
                      fontSize: '0.63rem', height: 22,
                      color: r.driveStatus === 'aprovado' ? '#00C47A' : r.driveStatus === 'enviado' ? '#3B8EFF' : 'rgba(255,255,255,0.3)',
                      bgcolor: r.driveStatus === 'aprovado' ? 'rgba(0,196,122,0.1)' : r.driveStatus === 'enviado' ? 'rgba(59,142,255,0.1)' : 'rgba(255,255,255,0.04)',
                      border: '1px solid',
                      borderColor: r.driveStatus === 'aprovado' ? 'rgba(0,196,122,0.25)' : r.driveStatus === 'enviado' ? 'rgba(59,142,255,0.25)' : 'rgba(255,255,255,0.08)',
                    }}
                  />
                  <Chip
                    icon={<MovieIcon sx={{ fontSize: '10px !important' }} />}
                    label={`Edição: ${r.editStatus === 'pendente' ? 'Pendente' : r.editStatus === 'em_edicao' ? 'Em edição' : 'Concluída'}`}
                    size="small"
                    sx={{
                      fontSize: '0.63rem', height: 22,
                      color: r.editStatus === 'concluida' ? '#00C47A' : r.editStatus === 'em_edicao' ? '#ff9039' : 'rgba(255,255,255,0.3)',
                      bgcolor: r.editStatus === 'concluida' ? 'rgba(0,196,122,0.1)' : r.editStatus === 'em_edicao' ? 'rgba(255,144,57,0.1)' : 'rgba(255,255,255,0.04)',
                      border: '1px solid',
                      borderColor: r.editStatus === 'concluida' ? 'rgba(0,196,122,0.25)' : r.editStatus === 'em_edicao' ? 'rgba(255,144,57,0.25)' : 'rgba(255,255,255,0.08)',
                    }}
                  />
                </Box>

                {r.notes && (
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontStyle: 'italic', mb: 1.2, borderLeft: `2px solid ${color}40`, pl: 1 }} noWrap>
                    {r.notes}
                  </Typography>
                )}

                {/* Actions */}
                <Box sx={{ display: 'flex', gap: 0.6 }}>
                  {nextStatus && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => advanceStatus(r.id)}
                      startIcon={nextStatus === 'gravando' ? <RadioButtonCheckedIcon sx={{ fontSize: 12 }} /> : <CheckCircleIcon sx={{ fontSize: 12 }} />}
                      sx={{
                        flex: 1, fontSize: '0.7rem', fontWeight: 700, borderRadius: 1.5,
                        bgcolor: STATUS_COLOR[nextStatus], color: '#000',
                        '&:hover': { bgcolor: STATUS_COLOR[nextStatus], filter: 'brightness(1.1)' },
                        boxShadow: `0 0 12px ${STATUS_COLOR[nextStatus]}50`,
                      }}
                    >
                      {nextStatus === 'gravando'  ? 'Iniciar gravação'   :
                       nextStatus === 'gravado'   ? 'Marcar gravado'     :
                       nextStatus === 'em_edicao' ? 'Enviar para edição' :
                       nextStatus === 'editado'   ? 'Edição concluída'   : 'Publicado'}
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
        })}
      </Box>

      {/* Dialog: Criar/Editar */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#0d0d0d', border: '1px solid rgba(255,144,57,0.2)', borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <CameraAltIcon sx={{ color: '#ff9039', fontSize: 20 }} />
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
            <TextField label="Responsável" size="small" fullWidth value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} />
          </Box>

          <TextField label="Link do Roteiro (Drive)" size="small" fullWidth value={form.roteiroLink} onChange={e => setForm(f => ({ ...f, roteiroLink: e.target.value }))} />

          <Box>
            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', mb: 1, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              Equipamentos
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {EQUIPMENT.map(e => (
                <Chip
                  key={e} label={e} size="small" clickable
                  onClick={() => toggleEquip(e)}
                  variant={form.equipment.includes(e) ? 'filled' : 'outlined'}
                  sx={{
                    fontSize: '0.68rem', height: 24,
                    ...(form.equipment.includes(e) && { bgcolor: 'rgba(255,144,57,0.2)', color: '#ff9039', borderColor: 'rgba(255,144,57,0.4)' }),
                  }}
                />
              ))}
            </Box>
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
            sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #ff9039, #ff5339)', color: '#000' }}
          >
            {editing ? 'Salvar alterações' : 'Criar gravação'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Confirmar exclusão */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Excluir gravação?</DialogTitle>
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
    </Box>
  )
}
