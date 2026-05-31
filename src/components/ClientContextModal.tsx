import { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography, Chip, IconButton,
  Divider, Tooltip, Stack,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SaveIcon from '@mui/icons-material/Save'
import { ClientContextStore, defaultContext, type ClientContext } from '../lib/clientContext'

interface Props {
  open: boolean
  onClose: () => void
  clientName: string
}

const TOM_VOZ_OPTIONS = [
  'profissional e acessível',
  'descontraído e divertido',
  'inspirador e motivacional',
  'técnico e educativo',
  'sofisticado e premium',
  'caloroso e próximo',
]

const ESTILO_OPTIONS = [
  'clean e minimalista',
  'vibrante e colorido',
  'premium e elegante',
  'rústico e artesanal',
  'moderno e tecnológico',
  'natural e orgânico',
]

export default function ClientContextModal({ open, onClose, clientName }: Props) {
  const [ctx, setCtx] = useState<ClientContext>(defaultContext(clientName))
  const [newCta, setNewCta] = useState('')
  const [newTag, setNewTag] = useState('')
  const [newRestricao, setNewRestricao] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      const stored = ClientContextStore.get(clientName)
      setCtx(stored ?? defaultContext(clientName))
      setSaved(false)
    }
  }, [open, clientName])

  const field = <K extends keyof ClientContext>(key: K) => ({
    value: String(ctx[key] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setCtx(prev => ({ ...prev, [key]: e.target.value })),
  })

  const handleSave = () => {
    ClientContextStore.save(ctx)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addCta = () => {
    if (!newCta.trim()) return
    setCtx(p => ({ ...p, ctas: [...p.ctas, newCta.trim()] }))
    setNewCta('')
  }
  const removeCta = (i: number) => setCtx(p => ({ ...p, ctas: p.ctas.filter((_, idx) => idx !== i) }))

  const addTag = () => {
    const tag = newTag.trim().replace(/^#/, '')
    if (!tag) return
    setCtx(p => ({ ...p, hashtags: [...p.hashtags, `#${tag}`] }))
    setNewTag('')
  }
  const removeTag = (i: number) => setCtx(p => ({ ...p, hashtags: p.hashtags.filter((_, idx) => idx !== i) }))

  const addRestricao = () => {
    if (!newRestricao.trim()) return
    setCtx(p => ({ ...p, restricoes: [...p.restricoes, newRestricao.trim()] }))
    setNewRestricao('')
  }
  const removeRestricao = (i: number) => setCtx(p => ({ ...p, restricoes: p.restricoes.filter((_, idx) => idx !== i) }))

  return (
    <Dialog
      open={open} onClose={onClose}
      maxWidth="md" fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0a0a0b', border: '1px solid rgba(255,144,57,0.25)',
          borderRadius: 3, maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 34, height: 34, borderRadius: 2,
            bgcolor: 'rgba(255,144,57,0.12)', border: '1px solid rgba(255,144,57,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AutoAwesomeIcon sx={{ fontSize: 18, color: '#ff9039' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography fontWeight={800} sx={{ fontSize: '1rem', lineHeight: 1.2 }}>
              Contexto de IA — {clientName}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1 }}>
              Perfil estratégico para geração de conteúdo personalizado
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <Divider sx={{ opacity: 0.1 }} />

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2.5, pb: 2 }}>

        {/* ── Identidade da marca ─────────────────────────── */}
        <Section label="🎯 Identidade da marca">
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField label="Segmento" size="small" {...field('segmento')} placeholder="gastronomia, saúde, moda…" />
            <TextField label="Sub-nicho" size="small" {...field('subnicho')} placeholder="pizzaria artesanal classe A…" />
          </Box>
          <TextField
            label="Público-alvo" size="small" multiline rows={2} fullWidth
            {...field('publico')} placeholder="Quem é o cliente ideal? Idade, renda, dores, desejos…"
          />

          <Box>
            <Label>Tom de voz</Label>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" sx={{ gap: 0.8 }}>
              {TOM_VOZ_OPTIONS.map(opt => (
                <Chip
                  key={opt} label={opt} size="small"
                  onClick={() => setCtx(p => ({ ...p, tomVoz: opt }))}
                  sx={{
                    cursor: 'pointer', fontSize: '0.68rem',
                    bgcolor: ctx.tomVoz === opt ? 'rgba(255,144,57,0.18)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${ctx.tomVoz === opt ? 'rgba(255,144,57,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    color: ctx.tomVoz === opt ? '#ff9039' : 'rgba(255,255,255,0.6)',
                    '&:hover': { bgcolor: 'rgba(255,144,57,0.1)' },
                  }}
                />
              ))}
            </Stack>
            <TextField size="small" sx={{ mt: 0.8 }} value={ctx.tomVoz}
              onChange={e => setCtx(p => ({ ...p, tomVoz: e.target.value }))}
              placeholder="Ou descreva o tom de voz…" fullWidth />
          </Box>

          <Box>
            <Label>Estilo visual</Label>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" sx={{ gap: 0.8 }}>
              {ESTILO_OPTIONS.map(opt => (
                <Chip
                  key={opt} label={opt} size="small"
                  onClick={() => setCtx(p => ({ ...p, estiloVisual: opt }))}
                  sx={{
                    cursor: 'pointer', fontSize: '0.68rem',
                    bgcolor: ctx.estiloVisual === opt ? 'rgba(192,132,252,0.18)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${ctx.estiloVisual === opt ? 'rgba(192,132,252,0.45)' : 'rgba(255,255,255,0.08)'}`,
                    color: ctx.estiloVisual === opt ? '#C084FC' : 'rgba(255,255,255,0.6)',
                    '&:hover': { bgcolor: 'rgba(192,132,252,0.08)' },
                  }}
                />
              ))}
            </Stack>
          </Box>
        </Section>

        {/* ── Estratégia de conteúdo ──────────────────────── */}
        <Section label="📋 Estratégia de conteúdo">
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField label="Posts por semana" size="small" type="number"
              value={ctx.frequenciaPost}
              onChange={e => setCtx(p => ({ ...p, frequenciaPost: Number(e.target.value) }))}
            />
            <TextField label="Melhores horários" size="small" {...field('melhoresHorarios')}
              placeholder="Seg–Sex 12h e 18h" />
          </Box>
          <TextField label="Objetivo do mês" size="small" fullWidth {...field('objetivoMes')}
            placeholder="Aumentar seguidores 10%, gerar leads, lançar produto…" />

          {/* CTAs */}
          <Box>
            <Label>CTAs frequentes</Label>
            <Stack direction="row" spacing={0.6} flexWrap="wrap" sx={{ gap: 0.6, mb: 0.8 }}>
              {ctx.ctas.map((cta, i) => (
                <Chip
                  key={i} label={cta} size="small"
                  onDelete={() => removeCta(i)}
                  deleteIcon={<DeleteOutlineIcon sx={{ fontSize: 13 }} />}
                  sx={{ fontSize: '0.68rem', bgcolor: 'rgba(0,196,122,0.1)', color: '#00C47A', border: '1px solid rgba(0,196,122,0.25)' }}
                />
              ))}
            </Stack>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField size="small" value={newCta} onChange={e => setNewCta(e.target.value)}
                placeholder="Reserve já, Ligue agora, Saiba mais…"
                onKeyDown={e => e.key === 'Enter' && addCta()}
                sx={{ flex: 1 }} />
              <IconButton size="small" onClick={addCta}
                sx={{ border: '1px solid rgba(255,255,255,0.12)', color: '#ff9039', '&:hover': { bgcolor: 'rgba(255,144,57,0.08)' } }}>
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>

          {/* Hashtags */}
          <Box>
            <Label>Hashtags estratégicas ({ctx.hashtags.length})</Label>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5, mb: 0.8 }}>
              {ctx.hashtags.map((tag, i) => (
                <Chip
                  key={i} label={tag} size="small"
                  onDelete={() => removeTag(i)}
                  deleteIcon={<DeleteOutlineIcon sx={{ fontSize: 13 }} />}
                  sx={{ fontSize: '0.63rem', bgcolor: 'rgba(59,142,255,0.1)', color: '#3B8EFF', border: '1px solid rgba(59,142,255,0.2)' }}
                />
              ))}
            </Stack>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField size="small" value={newTag} onChange={e => setNewTag(e.target.value)}
                placeholder="#pizzaria #gastronomia…"
                onKeyDown={e => e.key === 'Enter' && addTag()}
                sx={{ flex: 1 }} />
              <IconButton size="small" onClick={addTag}
                sx={{ border: '1px solid rgba(255,255,255,0.12)', color: '#3B8EFF', '&:hover': { bgcolor: 'rgba(59,142,255,0.08)' } }}>
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>
        </Section>

        {/* ── Restrições + Observações ────────────────────── */}
        <Section label="⚠️ Restrições &amp; Observações">
          <Box>
            <Label>O que NÃO fazer</Label>
            <Stack direction="row" spacing={0.6} flexWrap="wrap" sx={{ gap: 0.6, mb: 0.8 }}>
              {ctx.restricoes.map((r, i) => (
                <Chip
                  key={i} label={r} size="small"
                  onDelete={() => removeRestricao(i)}
                  deleteIcon={<DeleteOutlineIcon sx={{ fontSize: 13 }} />}
                  sx={{ fontSize: '0.68rem', bgcolor: 'rgba(255,69,69,0.1)', color: '#FF4545', border: '1px solid rgba(255,69,69,0.2)' }}
                />
              ))}
            </Stack>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField size="small" value={newRestricao} onChange={e => setNewRestricao(e.target.value)}
                placeholder="Sem menção à concorrência, sem preços, sem…"
                onKeyDown={e => e.key === 'Enter' && addRestricao()}
                sx={{ flex: 1 }} />
              <IconButton size="small" onClick={addRestricao}
                sx={{ border: '1px solid rgba(255,255,255,0.12)', color: '#FF4545', '&:hover': { bgcolor: 'rgba(255,69,69,0.08)' } }}>
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>

          <TextField
            label="Observações estratégicas" size="small" multiline rows={3} fullWidth
            {...field('observacoes')}
            placeholder="Informações importantes que a IA deve saber: eventos, campanhas, sazonalidade, parceiros…"
          />
        </Section>

      </DialogContent>

      <Divider sx={{ opacity: 0.1 }} />

      <DialogActions sx={{ px: 2.5, py: 1.8, gap: 1 }}>
        {saved && (
          <Typography sx={{ fontSize: '0.72rem', color: '#00C47A', mr: 'auto', fontWeight: 700 }}>
            ✓ Contexto salvo!
          </Typography>
        )}
        {ctx.updatedAt > 0 && !saved && (
          <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', mr: 'auto' }}>
            Atualizado {new Date(ctx.updatedAt).toLocaleDateString('pt-BR')}
          </Typography>
        )}
        <Button onClick={onClose} sx={{ color: 'text.disabled', fontSize: '0.75rem' }}>Fechar</Button>
        <Button
          variant="contained" startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
          onClick={handleSave}
          sx={{
            fontWeight: 700, fontSize: '0.8rem',
            background: '#F97316',
            '&:hover': { filter: 'brightness(1.08)' },
          }}
        >
          Salvar contexto
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.35)', mb: 1.2 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
        {children}
      </Box>
    </Box>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', mb: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
    </Typography>
  )
}
