import { useState, useMemo } from 'react'
import {
  Box, Typography, Button, Paper, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Divider, LinearProgress, Tooltip,
  ToggleButtonGroup, ToggleButton, Checkbox, FormControlLabel,
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
import EmptyState from '../shared/ui/EmptyState'

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
  agendado:   'Agendado',
  gravando:   'Gravando',
  gravado:    'Gravado',
  em_edicao:  'Em edição',
  editado:    'Editado',
  publicado:  'Publicado',
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

  const openCreate = () => {
    setForm(EMPTY)
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
  }

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
            onClick={openCreate}
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

      {/* ── Filters ── */}
      <Box sx={{ px: { xs: 2, md: 3 }, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
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
      </Box>

      {/* ── Cards ── */}
      <Box sx={{ flex: 1, p: { xs: 1.5, md: 2 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 1.5, alignContent: 'start' }}>
        {filtered.length === 0 && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <EmptyState
              icon={<VideocamIcon sx={{ fontSize: 30 }} />}
              title={filterStatus !== 'all'
                ? `Nenhuma gravação "${STATUS_LABEL[filterStatus]}"`
                : 'Nenhuma gravação cadastrada'}
              subtitle="Agende diárias de gravação com cliente, local e checklist de equipamentos."
              actionLabel="Nova gravação"
              onAction={openCreate}
            />
          </Box>
        )}

        {filtered.map(r => {
          const color = STATUS_COLOR[r.status]
          const checkedPct = r.equipment.length > 0 ? Math.round((r.equipment.length / EQUIPMENT.length) * 100) : 0
          const nextStatus = STATUS_NEXT[r.status]
          const isLive = r.status === 'gravando'

          return (
            <Paper key={r.id} sx={{
              border: `1px solid ${color}25`,
              bgcolor: `${color}05`,
              borderRadius: 3, overflow: 'hidden',
              position: 'relative',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 32px ${color}20` },
              ...(isLive && {
                '@keyframes liveGlow': { '0%,100%': { boxShadow: `0 0 0 1px ${color}40, 0 0 20px ${color}30` }, '50%': { boxShadow: `0 0 0 2px ${color}60, 0 0 40px ${color}50` } },
                animation: 'liveGlow 1.5s ease-in-out infinite',
              }),
            }}>
              {/* Status bar */}
              <Box sx={{ height: 3, bgcolor: color, boxShadow: `0 0 8px ${color}` }} />

              <Box sx={{ p: 1.8 }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.2 }}>
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

                {/* Infos */}
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
                      <PersonIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                      <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>{r.responsible}</Typography>
                    </Box>
                  )}
                </Box>

                {/* Equipment progress */}
                {r.equipment.length > 0 && (
                  <Box sx={{ mb: 1.2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                      <Typography sx={{ fontSize: '0.67rem', color: 'text.disabled' }}>Equipamentos</Typography>
                      <Typography sx={{ fontSize: '0.67rem', color: 'text.disabled' }}>{r.equipment.length} itens</Typography>
                    </Box>
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

                {/* Status badges */}
                <Box sx={{ display: 'flex', gap: 0.6, mb: 1.5, flexWrap: 'wrap' }}>
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

                {r.notes && (
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontStyle: 'italic', mb: 1.2, borderLeft: '2px solid rgba(255,255,255,0.08)', pl: 1 }} noWrap>
                    {r.notes}
                  </Typography>
                )}

                {/* Actions */}
                <Box sx={{ display: 'flex', gap: 0.6 }}>
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
                      {nextStatus === 'gravando' ? 'Iniciar gravação' : nextStatus === 'gravado' ? 'Marcar gravado' : nextStatus === 'em_edicao' ? 'Enviar para edição' : nextStatus === 'editado' ? 'Edição concluída' : 'Publicado'}
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

      {/* ── Dialog: Criar/Editar ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#0d0d0d', border: '1px solid rgba(59,142,255,0.2)' } }}>
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
            <TextField label="Responsável" size="small" fullWidth value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} />
          </Box>

          <TextField label="Link do Roteiro (Drive)" size="small" fullWidth value={form.roteiroLink} onChange={e => setForm(f => ({ ...f, roteiroLink: e.target.value }))} />

          <Box>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>Equipamentos</Typography>
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

      {/* ── Dialog: Confirmar exclusão ── */}
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
