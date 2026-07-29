import { useState, useCallback } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Chip, CircularProgress,
  IconButton, Paper, Divider, Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import EditNoteIcon from '@mui/icons-material/EditNote'
import MovieCreationIcon from '@mui/icons-material/MovieCreation'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import TagIcon from '@mui/icons-material/Tag'
import AssignmentIcon from '@mui/icons-material/Assignment'
import type { ContentItem, ItemState, Status } from '../types'
import { ClientContextStore, buildClientPrompt } from '../lib/clientContext'

// ── Types ────────────────────────────────────────────────────

type AITask = 'ideia' | 'legenda' | 'roteiro' | 'hashtags' | 'cta'

interface AIAction {
  id: AITask
  label: string
  description: string
  icon: React.ReactNode
  color: string
}

const ACTIONS: AIAction[] = [
  { id: 'ideia',    label: 'Ideias de conteúdo',  description: '3 ideias criativas para este cliente', icon: <LightbulbOutlinedIcon sx={{ fontSize: 18 }} />, color: DS.amber  },
  { id: 'legenda',  label: 'Gerar legenda',        description: 'Legenda completa com CTA e hashtags',  icon: <EditNoteIcon        sx={{ fontSize: 18 }} />, color: DS.accent  },
  { id: 'roteiro',  label: 'Criar roteiro',        description: 'Roteiro completo para Reel 15-60s',    icon: <MovieCreationIcon   sx={{ fontSize: 18 }} />, color: '#C084FC'  },
  { id: 'hashtags', label: 'Hashtags estratégicas',description: '25 hashtags segmentadas e otimizadas', icon: <TagIcon             sx={{ fontSize: 18 }} />, color: DS.green  },
  { id: 'cta',      label: 'Criar CTAs',           description: '5 CTAs diferentes para este negócio', icon: <AssignmentIcon      sx={{ fontSize: 18 }} />, color: '#60A5FA'  },
]

// ── Props ────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  item: ContentItem
  state?: ItemState
  onUpdate?: (id: number, patch: Partial<ItemState>) => void
  onStatusChange?: (id: number, status: Status) => void
}

// ── AI call ──────────────────────────────────────────────────

async function callAI(prompt: string, userMessage: string): Promise<string> {
  const res = await fetch('/api/ai', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      messages: [
        { role: 'user', content: `${prompt}\n\n${userMessage}` },
      ],
    }),
  })
  if (!res.ok) throw new Error('API error')
  const data = await res.json() as { content?: Array<{ text?: string }>; choices?: Array<{ message?: { content?: string } }>; response?: string }
  return (
    data.content?.[0]?.text ??
    data.choices?.[0]?.message?.content ??
    data.response ??
    'Sem resposta'
  )
}

// ── Component ────────────────────────────────────────────────

export default function ResolveWithAIModal({
  open, onClose, item, state, onUpdate, onStatusChange,
}: Props) {
  const [selectedAction, setSelectedAction] = useState<AITask | null>(null)
  const [result, setResult]                 = useState('')
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState('')
  const [copied, setCopied]                 = useState(false)

  const ctx = ClientContextStore.get(item.c)
  const hasContext = ctx !== null

  const handleAction = useCallback(async (action: AITask) => {
    setSelectedAction(action)
    setResult('')
    setError('')
    setLoading(true)

    try {
      const systemPrompt = buildClientPrompt(ctx, action)
      const taskTitle = state?.title || item.n
      const userMsg = `Cliente: ${item.c}\nConteúdo: "${taskTitle}"\nTipo: ${item.tp}\nData: ${item.dt.toLocaleDateString('pt-BR')}`

      const res = await callAI(systemPrompt, userMsg)
      setResult(res)
    } catch {
      setError('Erro ao conectar com a IA. Verifique a conexão e tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [ctx, item, state])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [result])

  const handleSaveAsCaption = useCallback(() => {
    if (!onUpdate || !result) return
    onUpdate(item.i, { caption: result })
    onClose()
  }, [onUpdate, item.i, result, onClose])

  const handleSaveAsNotes = useCallback(() => {
    if (!onUpdate || !result) return
    onUpdate(item.i, { notes: result })
    onClose()
  }, [onUpdate, item.i, result, onClose])

  return (
    <Dialog
      open={open} onClose={onClose}
      maxWidth="sm" fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#090909',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 3,
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* Glow icon */}
          <Box sx={{
            width: 36, height: 36, borderRadius: 2.5, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(6,182,212,0.1))',
            border: '1px solid rgba(59,130,246,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(59,130,246,0.15)',
          }}>
            <AutoAwesomeIcon sx={{ fontSize: 20, color: DS.accent }} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={900} sx={{ fontSize: '0.95rem', lineHeight: 1.2 }}>
              Resolver com IA
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1 }} noWrap>
              {item.c} · {item.tp} · {item.dt.toLocaleDateString('pt-BR')}
            </Typography>
          </Box>

          {/* Context indicator */}
          {hasContext ? (
            <Tooltip title={`Contexto de ${item.c} carregado — IA personalizada`}>
              <Chip
                label="Contexto ✓" size="small"
                sx={{ fontSize: '0.6rem', bgcolor: 'rgba(49,209,124,0.12)', color: DS.green, border: '1px solid rgba(49,209,124,0.3)', cursor: 'help' }}
              />
            </Tooltip>
          ) : (
            <Tooltip title="Configure o contexto deste cliente na aba Clientes para resultados melhores">
              <Chip
                label="Sem contexto" size="small"
                sx={{ fontSize: '0.6rem', bgcolor: 'rgba(245,158,11,0.08)', color: DS.amber, border: '1px solid rgba(245,158,11,0.2)', cursor: 'help' }}
              />
            </Tooltip>
          )}

          <IconButton size="small" onClick={onClose} sx={{ ml: 0.5 }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <Divider sx={{ opacity: 0.08 }} />

      <DialogContent sx={{ pt: 2, pb: 1 }}>

        {/* Content item info */}
        <Paper sx={{ p: 1.5, mb: 2, bgcolor: 'rgba(244,247,255,0.025)', border: '1px solid rgba(244,247,255,0.06)', borderRadius: 2 }}>
          <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.3 }}>
            Conteúdo
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff' }}>
            {state?.title || item.n}
          </Typography>
          {state?.notes && (
            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.45)', mt: 0.4 }}>
              📝 {state.notes}
            </Typography>
          )}
        </Paper>

        {/* Action buttons */}
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(244,247,255,0.3)', mb: 1 }}>
          O que você quer gerar?
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.8, mb: 2 }}>
          {ACTIONS.map(action => (
            <Paper
              key={action.id}
              onClick={() => !loading && handleAction(action.id)}
              sx={{
                p: 1.2, borderRadius: 2, cursor: loading ? 'not-allowed' : 'pointer',
                bgcolor: selectedAction === action.id ? `${action.color}12` : 'rgba(244,247,255,0.025)',
                border: `1px solid ${selectedAction === action.id ? `${action.color}40` : 'rgba(244,247,255,0.06)'}`,
                transition: 'all 0.15s',
                '&:hover': loading ? {} : {
                  bgcolor: `${action.color}0e`,
                  borderColor: `${action.color}35`,
                  transform: 'translateY(-1px)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.4 }}>
                <Box sx={{ color: action.color }}>{action.icon}</Box>
                {selectedAction === action.id && loading && (
                  <CircularProgress size={12} sx={{ color: action.color, ml: 'auto' }} />
                )}
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: selectedAction === action.id ? action.color : 'rgba(244,247,255,0.8)', lineHeight: 1.2 }}>
                {action.label}
              </Typography>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.3)', mt: 0.2, lineHeight: 1.3 }}>
                {action.description}
              </Typography>
            </Paper>
          ))}
        </Box>

        {/* Loading */}
        {loading && !result && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CircularProgress size={28} sx={{ color: DS.accent, mb: 1.5 }} />
            <Typography sx={{ fontSize: '0.78rem', color: 'rgba(244,247,255,0.45)' }}>
              Gerando com IA…
            </Typography>
          </Box>
        )}

        {/* Error */}
        {error && (
          <Paper sx={{ p: 1.5, bgcolor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 2 }}>
            <Typography sx={{ fontSize: '0.78rem', color: DS.red }}>{error}</Typography>
          </Paper>
        )}

        {/* Result */}
        {result && !loading && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(244,247,255,0.3)', flex: 1 }}>
                Resultado
              </Typography>
              <Button
                size="small"
                startIcon={copied ? <CheckIcon sx={{ fontSize: 13 }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
                onClick={handleCopy}
                sx={{
                  fontSize: '0.62rem', fontWeight: 700, px: 1.2, py: 0.3,
                  color: copied ? DS.green : 'rgba(244,247,255,0.5)',
                  border: `1px solid ${copied ? 'rgba(49,209,124,0.4)' : 'rgba(244,247,255,0.12)'}`,
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: 'rgba(244,247,255,0.05)' },
                }}
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </Button>
            </Box>

            <Paper sx={{
              p: 1.8, borderRadius: 2, maxHeight: 280, overflowY: 'auto',
              bgcolor: 'rgba(244,247,255,0.03)', border: '1px solid rgba(244,247,255,0.07)',
              '&::-webkit-scrollbar': { width: 3 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(244,247,255,0.1)', borderRadius: 2 },
            }}>
              <Typography sx={{ fontSize: '0.82rem', color: 'rgba(244,247,255,0.82)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {result}
              </Typography>
            </Paper>

            {/* Save options */}
            <Box sx={{ display: 'flex', gap: 0.8, mt: 1.2, flexWrap: 'wrap' }}>
              {(selectedAction === 'legenda') && onUpdate && (
                <Button size="small" onClick={handleSaveAsCaption}
                  sx={{ fontSize: '0.62rem', fontWeight: 700, px: 1.2, py: 0.4, border: '1px solid rgba(59,130,246,0.4)', color: DS.accent, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(59,130,246,0.08)' } }}>
                  💾 Salvar como legenda do card
                </Button>
              )}
              {(selectedAction === 'roteiro' || selectedAction === 'ideia') && onUpdate && (
                <Button size="small" onClick={handleSaveAsNotes}
                  sx={{ fontSize: '0.62rem', fontWeight: 700, px: 1.2, py: 0.4, border: '1px solid rgba(192,132,252,0.4)', color: '#C084FC', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(192,132,252,0.08)' } }}>
                  📋 Salvar nas notas do card
                </Button>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.disabled', fontSize: '0.75rem' }}>Fechar</Button>
      </DialogActions>
    </Dialog>
  )
}
