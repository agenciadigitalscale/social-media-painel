import { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, ToggleButtonGroup, ToggleButton,
  Box, Typography, Select, MenuItem, FormControl, InputLabel,
  Chip, Divider, Switch, FormControlLabel, IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import type { ContentItem, ContentType, ItemEditPatch, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'
import { NAME_MAP, getDisplayName } from '../lib/users'
import { DS } from '../theme'

const fieldSx = {
  '& .MuiInputBase-input': { fontSize: '0.8rem' },
  '& .MuiInputLabel-root': { fontSize: '0.75rem' },
  '& .MuiOutlinedInput-root': {
    backdropFilter: 'blur(8px)',
    '& fieldset': { borderColor: 'rgba(244,247,255,0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(244,247,255,0.2)' },
    '&.Mui-focused fieldset': { borderColor: 'rgba(59,130,246,0.6)' },
  },
}

function Label({ children }: { children: string }) {
  return (
    <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(244,247,255,0.28)', mb: 0.8 }}>
      {children}
    </Typography>
  )
}

interface Props {
  open: boolean
  item: ContentItem | null
  state?: ItemState | null
  onSave: (id: number, patch: ItemEditPatch) => void
  onSaveState?: (id: number, patch: Partial<ItemState>) => void
  onClose: () => void
}

export default function EditItemDialog({ open, item, state, onSave, onSaveState, onClose }: Props) {
  const [title, setTitle]           = useState('')
  const [type, setType]             = useState<ContentType>('Post')
  const [dateStr, setDateStr]       = useState('')
  const [deliveryStr, setDeliveryStr] = useState('')
  const [status, setStatus]         = useState<Status>(0)
  const [link, setLink]             = useState('')
  const [footageLink, setFootageLink] = useState('')
  const [caption, setCaption]       = useState('')
  const [notes, setNotes]           = useState('')
  const [responsible, setResponsible] = useState('')
  const [priority, setPriority]     = useState<'' | 'baixa' | 'media' | 'alta'>('')
  const [tags, setTags]             = useState('')
  const [isTraffic, setIsTraffic]   = useState(false)

  useEffect(() => {
    if (!open) return
    if (item) {
      setTitle(item.n)
      setType(item.tp)
      setDateStr(item.dt.toISOString().slice(0, 10))
    }
    if (state) {
      setDeliveryStr(state.deliveryDate ? new Date(state.deliveryDate).toISOString().slice(0, 10) : '')
      setStatus(state.status)
      setLink(state.link || '')
      setFootageLink(state.footageLink || '')
      setCaption(state.caption || '')
      setNotes(state.notes || '')
      setResponsible(state.responsible || '')
      setPriority(state.priority || '')
      setTags((state.tags || []).join(', '))
      setIsTraffic(state.isTraffic || false)
    } else if (item) {
      setDeliveryStr('')
      setStatus(item.s)
      setLink('')
      setFootageLink('')
      setCaption('')
      setNotes('')
      setResponsible('')
      setPriority('')
      setTags('')
      setIsTraffic(false)
    }
  }, [item, state, open])

  const handleSave = () => {
    if (!item) return

    const itemPatch: ItemEditPatch = {}
    if (title !== item.n) itemPatch.n = title
    if (type !== item.tp) itemPatch.tp = type
    const newDt = new Date(dateStr + 'T12:00:00')
    if (newDt.toISOString().slice(0, 10) !== item.dt.toISOString().slice(0, 10)) itemPatch.dt = newDt
    if (Object.keys(itemPatch).length > 0) onSave(item.i, itemPatch)

    if (onSaveState) {
      const statePatch: Partial<ItemState> = { status, link, caption, notes, isTraffic }
      statePatch.deliveryDate = deliveryStr ? new Date(deliveryStr + 'T12:00:00').getTime() : undefined
      if (footageLink) statePatch.footageLink = footageLink
      if (responsible) statePatch.responsible = responsible
      if (priority) statePatch.priority = priority
      const parsedTags = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []
      if (parsedTags.length > 0) statePatch.tags = parsedTags
      onSaveState(item.i, statePatch)
    }
    onClose()
  }

  const statusEntries = Object.entries(STATUS_CONFIG) as [string, (typeof STATUS_CONFIG)[Status]][]
  const full = !!onSaveState

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            background: 'rgba(11,11,11,0.97)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(244,247,255,0.07)',
            borderRadius: '20px',
            maxHeight: '90vh',
          },
        },
      }}
    >
      {/* ── Cabeçalho ── */}
      <DialogTitle sx={{ pb: 0, pr: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography fontWeight={800} sx={{ fontSize: '0.95rem', lineHeight: 1.2 }}>
              Editar conteúdo
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: 'primary.main', fontWeight: 700, mt: 0.3 }}>
              {item?.c}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(244,247,255,0.3)', '&:hover': { color: '#fff' }, mt: -0.5 }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{
        pt: 2, pb: 0,
        display: 'flex', flexDirection: 'column', gap: 2.5,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(59,130,246,0.3)', borderRadius: 2 },
      }}>

        {/* ── Seção: Conteúdo ── */}
        <Box>
          <Label>Conteúdo</Label>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              label="Título"
              size="small"
              fullWidth
              value={title}
              onChange={e => setTitle(e.target.value)}
              sx={fieldSx}
            />
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.28)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', mb: 0.6 }}>Tipo</Typography>
                <ToggleButtonGroup size="small" value={type} exclusive onChange={(_, v) => v && setType(v)} fullWidth>
                  {(['Post', 'Reel', 'Story', 'Carrossel', 'Feed'] as ContentType[]).map(t => (
                    <ToggleButton key={t} value={t} sx={{ fontSize: '0.62rem', py: 0.6, '&.Mui-selected': { bgcolor: 'rgba(59,130,246,0.18)', color: 'primary.main', borderColor: 'rgba(59,130,246,0.4)' } }}>
                      {t}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
              <TextField
                label="Data de postagem"
                type="date"
                size="small"
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ ...fieldSx, width: 150 }}
              />
            </Box>
            {full && (
              <TextField
                label="📥 Data de entrega (prazo interno)"
                type="date"
                size="small"
                fullWidth
                value={deliveryStr}
                onChange={e => setDeliveryStr(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, input: { sx: { color: DS.purpleSoft } } }}
                sx={{
                  ...fieldSx,
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(192,132,252,0.25)' },
                    '&:hover fieldset': { borderColor: 'rgba(192,132,252,0.45)' },
                    '&.Mui-focused fieldset': { borderColor: DS.purpleSoft },
                  },
                }}
              />
            )}
          </Box>
        </Box>

        {/* ── Seção: Status ── */}
        {full && (
          <>
            <Divider sx={{ borderColor: 'rgba(244,247,255,0.06)' }} />
            <Box>
              <Label>Status</Label>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7 }}>
                {statusEntries.map(([k, cfg]) => {
                  const s = Number(k) as Status
                  const active = status === s
                  return (
                    <Chip
                      key={k}
                      label={`${cfg.emoji} ${cfg.label}`}
                      size="small"
                      onClick={() => setStatus(s)}
                      sx={{
                        fontSize: '0.63rem', fontWeight: active ? 700 : 400, cursor: 'pointer',
                        bgcolor: active ? `${cfg.color}1e` : 'rgba(244,247,255,0.04)',
                        border: `1px solid ${active ? cfg.color + '80' : 'rgba(244,247,255,0.08)'}`,
                        color: active ? cfg.color : 'rgba(244,247,255,0.45)',
                        transition: 'all 0.15s',
                        '&:hover': { bgcolor: `${cfg.color}18`, borderColor: `${cfg.color}55` },
                      }}
                    />
                  )
                })}
              </Box>
            </Box>
          </>
        )}

        {/* ── Seção: Links ── */}
        {full && (
          <>
            <Divider sx={{ borderColor: 'rgba(244,247,255,0.06)' }} />
            <Box>
              <Label>Links</Label>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                <TextField
                  label="Link do criativo"
                  placeholder="https://drive.google.com/..."
                  size="small"
                  fullWidth
                  value={link}
                  onChange={e => setLink(e.target.value)}
                  sx={fieldSx}
                />
                <TextField
                  label="Link de footage (gravação bruta)"
                  placeholder="https://drive.google.com/..."
                  size="small"
                  fullWidth
                  value={footageLink}
                  onChange={e => setFootageLink(e.target.value)}
                  sx={fieldSx}
                />
              </Box>
            </Box>
          </>
        )}

        {/* ── Seção: Texto ── */}
        {full && (
          <>
            <Divider sx={{ borderColor: 'rgba(244,247,255,0.06)' }} />
            <Box>
              <Label>Texto</Label>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                <TextField
                  label="Legenda"
                  multiline
                  minRows={2}
                  maxRows={5}
                  size="small"
                  fullWidth
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  sx={fieldSx}
                />
                <TextField
                  label="Notas internas"
                  multiline
                  minRows={1}
                  maxRows={3}
                  size="small"
                  fullWidth
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  sx={fieldSx}
                />
              </Box>
            </Box>
          </>
        )}

        {/* ── Seção: Configurações ── */}
        {full && (
          <>
            <Divider sx={{ borderColor: 'rgba(244,247,255,0.06)' }} />
            <Box>
              <Label>Configurações</Label>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ fontSize: '0.75rem' }}>Responsável</InputLabel>
                  <Select
                    value={responsible}
                    label="Responsável"
                    onChange={e => setResponsible(e.target.value)}
                    sx={{ ...fieldSx, '& .MuiSelect-select': { fontSize: '0.8rem' } }}
                  >
                    <MenuItem value=""><em style={{ fontSize: '0.78rem' }}>Nenhum</em></MenuItem>
                    {Object.entries(NAME_MAP).map(([key, info]) => (
                      <MenuItem key={key} value={key} sx={{ fontSize: '0.8rem' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: info.color, flexShrink: 0 }} />
                          {info.emoji} {getDisplayName(key)}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box>
                  <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.28)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', mb: 0.7 }}>Prioridade</Typography>
                  <Box sx={{ display: 'flex', gap: 0.8 }}>
                    {([
                      ['', 'Normal', 'rgba(244,247,255,0.25)'],
                      ['baixa', 'Baixa', DS.green],
                      ['media', 'Média', DS.amber],
                      ['alta', 'Alta', DS.red],
                    ] as [string, string, string][]).map(([val, label, color]) => (
                      <Chip
                        key={val}
                        label={label}
                        size="small"
                        onClick={() => setPriority(val as '' | 'baixa' | 'media' | 'alta')}
                        sx={{
                          fontSize: '0.63rem', cursor: 'pointer',
                          fontWeight: priority === val ? 700 : 400,
                          bgcolor: priority === val ? `${color}20` : 'rgba(244,247,255,0.04)',
                          border: `1px solid ${priority === val ? `${color}70` : 'rgba(244,247,255,0.08)'}`,
                          color: priority === val ? color : 'rgba(244,247,255,0.4)',
                          transition: 'all 0.15s',
                        }}
                      />
                    ))}
                  </Box>
                </Box>

                <TextField
                  label="Tags (separadas por vírgula)"
                  size="small"
                  fullWidth
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="urgente, campanha..."
                  sx={fieldSx}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={isTraffic}
                      onChange={e => setIsTraffic(e.target.checked)}
                      size="small"
                      color="warning"
                    />
                  }
                  label={<Typography sx={{ fontSize: '0.78rem', color: isTraffic ? DS.amber : 'rgba(244,247,255,0.5)' }}>⚡ Tráfego pago (anúncios)</Typography>}
                />
              </Box>
            </Box>
          </>
        )}

        <Box sx={{ height: 6 }} />
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1.5, gap: 1, borderTop: '1px solid rgba(244,247,255,0.06)' }}>
        <Button
          onClick={onClose}
          size="small"
          sx={{ color: 'rgba(244,247,255,0.4)', fontSize: '0.72rem', borderRadius: '10px' }}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          size="small"
          variant="contained"
          sx={{
            background: `linear-gradient(135deg, ${DS.accent}, ${DS.cyan})`,
            color: '#fff', fontWeight: 800, fontSize: '0.75rem',
            px: 2.5, borderRadius: '10px',
            boxShadow: '0 4px 16px rgba(59,130,246,0.28)',
            '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
          }}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
