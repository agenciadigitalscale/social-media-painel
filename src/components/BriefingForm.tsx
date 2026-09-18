import { useState, useEffect } from 'react'
import {
  Box, Typography, TextField, Button, Chip, CircularProgress,
  LinearProgress, Divider, FormControlLabel, Checkbox,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { DS, ctaGradient } from '../theme'
import { BRIEFING_OBJECTIVES as OBJECTIVES, BRIEFING_SECTIONS as SECTIONS } from '../lib/briefing'

interface Props { token: string }

export default function BriefingForm({ token }: Props) {
  const [clientName, setClientName] = useState('')
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [submitted, setSubmitted]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [step, setStep]             = useState(0)

  const [objectives, setObjectives] = useState<string[]>([])
  const [vals, setVals]             = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`/api/briefing?token=${token}`)
      .then(r => r.json())
      .then((d: { ok: boolean; clientName?: string; data?: Record<string, unknown>; error?: string }) => {
        if (!d.ok) { setError(d.error ?? 'Link inválido'); return }
        setClientName(d.clientName ?? '')
        if (d.data) {
          const { _objectives, ...rest } = d.data as Record<string, unknown>
          setObjectives((_objectives as string[]) ?? [])
          const strVals: Record<string, string> = {}
          Object.entries(rest).forEach(([k, v]) => { if (typeof v === 'string') strVals[k] = v })
          setVals(strVals)
          setSubmitted(true)
        }
      })
      .catch(() => setError('Erro ao carregar formulário.'))
      .finally(() => setLoading(false))
  }, [token])

  const set = (key: string, val: string) => setVals(prev => ({ ...prev, [key]: val }))

  const toggleObj = (obj: string) =>
    setObjectives(prev => prev.includes(obj) ? prev.filter(o => o !== obj) : [...prev, obj])

  const totalSteps = SECTIONS.length
  const progress   = ((step) / totalSteps) * 100

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit', token,
          data: { ...vals, _objectives: objectives },
        }),
      })
      const d = await res.json() as { ok: boolean }
      if (d.ok) setSubmitted(true)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  if (loading) return (
    <Box sx={{ minHeight: '100vh', bgcolor: DS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress sx={{ color: DS.accent }} />
    </Box>
  )

  if (error) return (
    <Box sx={{ minHeight: '100vh', bgcolor: DS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ color: DS.red, fontSize: '1.1rem', fontWeight: 700 }}>Link inválido</Typography>
        <Typography sx={{ color: 'rgba(244,247,255,0.4)', mt: 1, fontSize: '0.85rem' }}>{error}</Typography>
      </Box>
    </Box>
  )

  if (submitted) return (
    <Box sx={{ minHeight: '100vh', bgcolor: DS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Box sx={{ textAlign: 'center', maxWidth: 440 }}>
        <CheckCircleIcon sx={{ fontSize: 56, color: DS.green, mb: 2 }} />
        <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800, mb: 1 }}>
          Briefing enviado!
        </Typography>
        <Typography sx={{ color: 'rgba(244,247,255,0.5)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Obrigado, <strong style={{ color: DS.accent }}>{clientName}</strong>! Recebemos suas informações e nossa equipe já pode iniciar o planejamento.
        </Typography>
        <Typography sx={{ color: 'rgba(244,247,255,0.3)', fontSize: '0.75rem', mt: 3 }}>
          Digital Scale · Agência de Marketing Digital
        </Typography>
      </Box>
    </Box>
  )

  const currentSection = SECTIONS[step]

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: DS.bg,
      fontFamily: '"Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      {/* Header */}
      <Box sx={{
        width: '100%', px: 3, py: 2,
        background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(6,182,212,0.08))',
        borderBottom: '1px solid rgba(59,130,246,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(20px)',
      }}>
        <Box>
          <Typography sx={{ fontSize: '0.58rem', color: DS.accent, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Digital Scale
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
            Briefing · <span style={{ color: DS.accent }}>{clientName}</span>
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.68rem', color: 'rgba(244,247,255,0.4)' }}>
          {step + 1} / {totalSteps}
        </Typography>
      </Box>

      {/* Progress */}
      <LinearProgress
        variant="determinate" value={progress}
        sx={{ width: '100%', height: 3, bgcolor: 'rgba(244,247,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: DS.accent } }}
      />

      {/* Content */}
      <Box sx={{ width: '100%', maxWidth: 560, px: 3, py: 4, flex: 1 }}>

        {/* Welcome on first step */}
        {step === 0 && (
          <Box sx={{ mb: 3, p: 2.5, borderRadius: 2.5, bgcolor: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <Typography sx={{ color: DS.accent, fontWeight: 800, fontSize: '0.95rem', mb: 0.5 }}>
              Olá, {clientName}! 👋
            </Typography>
            <Typography sx={{ color: 'rgba(244,247,255,0.55)', fontSize: '0.76rem', lineHeight: 1.6 }}>
              Que bom ter você com a <strong style={{ color: '#fff' }}>Digital Scale</strong>! Este briefing nos ajuda a entender melhor o seu negócio para criarmos a estratégia de conteúdo ideal. Leva cerca de 5 minutos.
            </Typography>
          </Box>
        )}

        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#fff', mb: 2.5 }}>
          {currentSection.title}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* Bloco de objetivos (multi-seleção) — na seção marcada com hasObjectives */}
          {currentSection.hasObjectives && (
            <Box>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.5)', mb: 1.2, fontWeight: 600 }}>
                Principais objetivos * <span style={{ opacity: 0.6, fontWeight: 400 }}>(marque quantos quiser)</span>
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                {OBJECTIVES.map(obj => (
                  <Chip
                    key={obj} label={obj} size="small"
                    onClick={() => toggleObj(obj)}
                    sx={{
                      fontSize: '0.68rem', cursor: 'pointer', height: 28,
                      bgcolor: objectives.includes(obj) ? 'rgba(59,130,246,0.2)' : 'rgba(244,247,255,0.05)',
                      color: objectives.includes(obj) ? DS.accent : 'rgba(244,247,255,0.5)',
                      border: `1px solid ${objectives.includes(obj) ? 'rgba(59,130,246,0.5)' : 'rgba(244,247,255,0.1)'}`,
                      '&:hover': { bgcolor: 'rgba(59,130,246,0.12)' },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Campos da seção */}
          {currentSection.fields.map(f => f.type === 'choice' ? (
            <Box key={f.key}>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.5)', mb: 0.9, fontWeight: 600 }}>
                {f.label}{f.required ? ' *' : ''}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {(f.options ?? []).map(opt => {
                  const sel = vals[f.key] === opt
                  return (
                    <Box key={opt} onClick={() => set(f.key, sel ? '' : opt)} sx={{
                      px: 2, py: 1, borderRadius: 2, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
                      bgcolor: sel ? 'rgba(59,130,246,0.18)' : 'rgba(244,247,255,0.05)',
                      color: sel ? DS.accent : 'rgba(244,247,255,0.5)',
                      border: `1px solid ${sel ? 'rgba(59,130,246,0.45)' : 'rgba(244,247,255,0.1)'}`,
                      transition: 'all 0.15s',
                    }}>
                      {opt}
                    </Box>
                  )
                })}
              </Box>
            </Box>
          ) : (
            <TextField
              key={f.key}
              label={f.label + (f.required ? ' *' : '')}
              placeholder={f.hint}
              helperText={f.hint}
              size="small" fullWidth
              value={vals[f.key] ?? ''}
              onChange={e => set(f.key, e.target.value)}
              multiline={f.multiline}
              rows={f.multiline ? 3 : undefined}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(244,247,255,0.04)',
                  color: '#fff', fontSize: '0.82rem',
                  '& fieldset': { borderColor: 'rgba(244,247,255,0.1)' },
                  '&:hover fieldset': { borderColor: 'rgba(59,130,246,0.3)' },
                  '&.Mui-focused fieldset': { borderColor: DS.accent },
                },
                '& .MuiInputLabel-root': { color: 'rgba(244,247,255,0.4)', fontSize: '0.78rem' },
                '& .MuiInputLabel-root.Mui-focused': { color: DS.accent },
                '& .MuiFormHelperText-root': { color: 'rgba(244,247,255,0.3)', fontSize: '0.66rem', mx: 0.2 },
              }}
            />
          ))}
        </Box>

        {/* Navigation */}
        <Box sx={{ display: 'flex', gap: 1.5, mt: 4, justifyContent: 'space-between' }}>
          {step > 0 ? (
            <Button onClick={() => setStep(s => s - 1)}
              sx={{ color: 'rgba(244,247,255,0.4)', fontWeight: 600, fontSize: '0.78rem' }}>
              ← Voltar
            </Button>
          ) : <Box />}

          {step < totalSteps - 1 ? (
            <Button variant="contained" onClick={() => setStep(s => s + 1)}
              sx={{ background: ctaGradient(135), color: '#fff', fontWeight: 800, px: 3, borderRadius: 2 }}>
              Continuar →
            </Button>
          ) : (
            <Button variant="contained" onClick={handleSubmit} disabled={saving}
              sx={{ background: `linear-gradient(135deg, ${DS.green}, ${DS.greenDim})`, color: '#000', fontWeight: 800, px: 3, borderRadius: 2 }}>
              {saving ? <CircularProgress size={16} sx={{ color: '#000' }} /> : 'Enviar Briefing ✓'}
            </Button>
          )}
        </Box>

      </Box>

      {/* Footer */}
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.2)' }}>
          Digital Scale · Seus dados são tratados com total sigilo
        </Typography>
      </Box>
    </Box>
  )
}
