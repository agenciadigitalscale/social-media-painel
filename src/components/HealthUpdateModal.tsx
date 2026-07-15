import { useEffect, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, TextField, Slider, IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import FavoriteIcon from '@mui/icons-material/Favorite'
import {
  HEALTH_FIELDS, classifyHealth, HEALTH_CLASSES, loadHealth, updateHealth,
} from '../lib/health'
import type { CustomerHealth } from '../lib/health'

interface Props {
  clientName: string | null
  currentUser: string
  onClose: () => void
  onSaved?: (rec: CustomerHealth) => void
}

export default function HealthUpdateModal({ clientName, currentUser, onClose, onSaved }: Props) {
  const [score, setScore] = useState(100)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!clientName) return
    const rec = loadHealth()[clientName]
    setScore(rec?.score ?? 100)
    setNotes(rec?.notes ?? '')
    const f: Record<string, string> = {}
    for (const hf of HEALTH_FIELDS) {
      const v = rec?.[hf.key as keyof CustomerHealth]
      if (typeof v === 'string') f[hf.key] = v
    }
    setFields(f)
  }, [clientName])

  if (!clientName) return null

  const cls = HEALTH_CLASSES[classifyHealth(score)]

  const handleSave = () => {
    const rec = updateHealth(clientName, {
      score,
      communication: fields.communication,
      responseTime: fields.responseTime,
      engagement: fields.engagement,
      contentApproval: fields.contentApproval,
      relationship: fields.relationship,
      renewalPotential: fields.renewalPotential,
      notes: notes.trim() || undefined,
    }, currentUser)
    onSaved?.(rec)
    onClose()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 0.5 }}>
        <FavoriteIcon sx={{ fontSize: 18, color: cls.color }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1.2 }}>
            Atualizar Satisfação
          </Typography>
          <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>
            {clientName}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.4)' }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1.5 }}>
        {/* ── Health Score ── */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 2.5,
          p: 2, borderRadius: 2.5,
          background: `${cls.color}0a`, border: `1px solid ${cls.color}30`,
        }}>
          {/* Gauge circular */}
          <Box sx={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
            <Box sx={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: `conic-gradient(${cls.color} 0deg ${Math.round((score / 100) * 360)}deg, rgba(255,255,255,0.06) ${Math.round((score / 100) * 360)}deg 360deg)`,
              boxShadow: `0 0 ${Math.round(score / 5)}px ${cls.color}50`,
              transition: 'background 0.3s ease',
            }} />
            <Box sx={{
              position: 'absolute', inset: 9, borderRadius: '50%',
              background: 'rgba(10,10,10,0.98)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
            }}>
              <Typography sx={{ fontSize: '1.55rem', fontWeight: 900, lineHeight: 1, color: cls.color, letterSpacing: '-0.03em' }}>
                {score}
              </Typography>
              <Typography sx={{ fontSize: '0.48rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.35)', mt: 0.3 }}>
                score
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', mb: 0.4 }}>
              Health Score — {cls.emoji} {cls.label}
            </Typography>
            <Slider
              value={score}
              onChange={(_, v) => setScore(v as number)}
              min={0} max={100}
              sx={{
                color: cls.color,
                '& .MuiSlider-thumb': { boxShadow: `0 0 10px ${cls.color}80` },
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)' }}>0 · Crítico</Typography>
              <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)' }}>100 · Excelente</Typography>
            </Box>
          </Box>
        </Box>

        {/* ── Campos qualitativos ── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          {HEALTH_FIELDS.map(hf => (
            <Box key={hf.key}>
              <Typography sx={{
                fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', mb: 0.6,
              }}>
                {hf.label}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {hf.options.map((opt, oi) => {
                  const active = fields[hf.key] === opt
                  // gradiente semântico: primeira opção = melhor, última = pior
                  const optColor = ['#31D17C', '#F59E0B', '#60A5FA', '#EF4444'][oi] ?? '#9CA3AF'
                  return (
                    <Box
                      key={opt}
                      onClick={() => setFields(prev => ({ ...prev, [hf.key]: active ? '' : opt }))}
                      sx={{
                        px: 1, py: 0.4, borderRadius: '7px', cursor: 'pointer',
                        fontSize: '0.62rem', fontWeight: active ? 700 : 500,
                        color: active ? optColor : 'rgba(255,255,255,0.45)',
                        bgcolor: active ? `${optColor}16` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${active ? `${optColor}50` : 'rgba(255,255,255,0.08)'}`,
                        transition: 'all 0.15s ease',
                        '&:hover': { borderColor: `${optColor}40`, color: optColor },
                      }}
                    >
                      {opt}
                    </Box>
                  )
                })}
              </Box>
            </Box>
          ))}
        </Box>

        {/* ── Observações ── */}
        <TextField
          label="Observações"
          multiline minRows={2} fullWidth size="small"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Anotações livres sobre o cliente…"
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          sx={{
            background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
            color: '#000', fontWeight: 800, borderRadius: 2.5,
            boxShadow: '0 6px 20px rgba(59,130,246,0.32)',
            '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
          }}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
