import { useState, useEffect } from 'react'
import {
  Box, Typography, Button, TextField, CircularProgress,
  Alert, ThemeProvider, CssBaseline, Paper, Chip,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import theme from '../theme'
import { DATA } from '../data'
import type { ContentItem, ItemState, ContentType } from '../types'

function extractDriveFileId(url: string): string | null {
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (m1) return m1[1]
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (m2) return m2[1]
  return null
}

function deserializeItem(raw: Record<string, unknown>): ContentItem {
  return { ...raw, dt: new Date(raw.dt as string) } as ContentItem
}

function typeColor(tp: string) {
  if (tp === 'Reel') return '#3B8EFF'
  if (tp === 'Story') return '#b45aff'
  return '#ff9039'
}

interface Props {
  token: string
  itemId: number
}

export default function CreativeViewer({ token, itemId }: Props) {
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [clientName, setClientName] = useState('')
  const [item, setItem]         = useState<ContentItem | null>(null)
  const [link, setLink]         = useState('')
  const [title, setTitle]       = useState('')
  const [existingFeedback, setExistingFeedback] = useState<{ approved: boolean; text: string } | null>(null)

  const [rejectMode, setRejectMode]   = useState(false)
  const [rejectText, setRejectText]   = useState('')
  const [rejectError, setRejectError] = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [done, setDone]               = useState(false)
  const [doneApproved, setDoneApproved] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [portalRes, syncRes] = await Promise.all([
          fetch(`/api/portal?token=${token}`).then(r => r.json()),
          fetch('/api/sync').then(r => r.json()),
        ])

        if (!portalRes.ok) {
          setError(portalRes.error === 'Invalid token'
            ? 'Link inválido ou expirado. Solicite um novo link à agência.'
            : 'Erro ao carregar.')
          setLoading(false)
          return
        }

        const syncMap: Record<string, unknown> = {}
        if (syncRes.ok && Array.isArray(syncRes.data)) {
          syncRes.data.forEach(({ key, value }: { key: string; value: string }) => {
            try { syncMap[key] = JSON.parse(value) } catch {}
          })
        }

        setClientName(portalRes.clientName as string)

        const states = (syncMap['sm_states'] ?? {}) as Record<string, ItemState>
        const itemState = states[String(itemId)]
        setLink(itemState?.link ?? '')
        setTitle(itemState?.title || '')

        const feedback = (portalRes.feedback ?? {}) as Record<string, { approved: boolean; text: string }>
        if (feedback[String(itemId)]) {
          setExistingFeedback(feedback[String(itemId)])
        }

        const customItems = ((syncMap['sm_custom'] ?? []) as Record<string, unknown>[]).map(deserializeItem)
        const deletedIds  = new Set((syncMap['sm_deleted'] ?? []) as number[])
        const allItems    = [...DATA, ...customItems].filter(i => !deletedIds.has(i.i))
        const foundItem   = allItems.find(i => i.i === itemId)

        if (!foundItem) {
          setError('Conteúdo não encontrado.')
          setLoading(false)
          return
        }

        const edits  = (syncMap['sm_edits'] ?? {}) as Record<string, { dt?: string; tp?: string; n?: string }>
        const edit   = edits[String(itemId)]
        const finalItem: ContentItem = edit ? {
          ...foundItem,
          ...(edit.tp ? { tp: edit.tp as ContentType } : {}),
          ...(edit.n  ? { n: edit.n }  : {}),
          dt: edit.dt ? new Date(edit.dt) : foundItem.dt,
        } : foundItem

        setItem(finalItem)
        if (!itemState?.title) setTitle(finalItem.n)

      } catch {
        setError('Erro de conexão. Verifique sua internet.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, itemId])

  const submitFeedback = async (approved: boolean) => {
    if (!approved && !rejectText.trim()) {
      setRejectError('Descreva o que deve ser alterado para enviar a solicitação.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'feedback', token, itemId, approved, text: rejectText }),
      }).then(r => r.json())
      if (res.ok) {
        setDone(true)
        setDoneApproved(approved)
      } else {
        setRejectError('Erro ao enviar. Tente novamente.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const fileId = link ? extractDriveFileId(link) : null

  if (loading) return (
    <ThemeProvider theme={theme}><CssBaseline />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: 'background.default', flexDirection: 'column', gap: 2 }}>
        <CircularProgress color="primary" size={36} />
        <Typography color="text.secondary" sx={{ fontSize: '0.8rem' }}>Carregando criativo...</Typography>
      </Box>
    </ThemeProvider>
  )

  if (error || !item) return (
    <ThemeProvider theme={theme}><CssBaseline />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: 'background.default', p: 3, flexDirection: 'column', gap: 3 }}>
        <Box component="img" src="/logotipo.png" sx={{ height: 40, opacity: 0.8 }} />
        <Alert severity="error" sx={{ maxWidth: 420, width: '100%' }}>{error || 'Conteúdo não encontrado.'}</Alert>
      </Box>
    </ThemeProvider>
  )

  if (done) return (
    <ThemeProvider theme={theme}><CssBaseline />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: 'background.default', p: 3, flexDirection: 'column', gap: 3, textAlign: 'center' }}>
        <Box component="img" src="/logotipo.png" sx={{ height: 64, objectFit: 'contain' }} />
        {doneApproved ? (
          <>
            <CheckCircleIcon sx={{ fontSize: 72, color: 'success.main' }} />
            <Typography variant="h5" fontWeight={800} color="success.main">Conteúdo aprovado!</Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 340, lineHeight: 1.6 }}>
              A Digital Scale foi notificada e publicará o conteúdo conforme o calendário. Obrigado!
            </Typography>
          </>
        ) : (
          <>
            <CancelIcon sx={{ fontSize: 72, color: 'error.main' }} />
            <Typography variant="h5" fontWeight={800} color="error.main">Alteração solicitada</Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 340, lineHeight: 1.6 }}>
              Sua solicitação foi enviada para a equipe. Faremos as alterações e entraremos em contato em breve.
            </Typography>
            {rejectText && (
              <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(255,69,69,0.06)', border: '1px solid rgba(255,69,69,0.2)', maxWidth: 420, width: '100%', textAlign: 'left' }}>
                <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                  Sua solicitação:
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', color: '#FF8080', fontStyle: 'italic', lineHeight: 1.5 }}>
                  "{rejectText}"
                </Typography>
              </Paper>
            )}
          </>
        )}
      </Box>
    </ThemeProvider>
  )

  const tc = typeColor(item.tp)

  return (
    <ThemeProvider theme={theme}><CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflow: 'hidden' }}>

        {/* Header */}
        <Box sx={{
          px: 2, py: 1.5,
          background: 'linear-gradient(135deg, #161616 0%, #1e1408 60%, #161616 100%)',
          borderBottom: '1px solid rgba(255,144,57,0.18)',
          display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0,
        }}>
          <Box component="img" src="/logotipo.png" sx={{ height: 38, objectFit: 'contain', flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.5rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1.5 }}>
              {clientName}
            </Typography>
            <Typography fontWeight={800} sx={{ fontSize: '0.85rem', lineHeight: 1.2 }} noWrap>
              {title}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
            <Chip label={item.tp} size="small" sx={{ height: 18, fontSize: '0.52rem', color: tc, bgcolor: `${tc}22` }} />
            <Chip
              label={item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              size="small"
              sx={{ height: 18, fontSize: '0.52rem', bgcolor: 'rgba(255,255,255,0.06)', color: 'text.secondary' }}
            />
          </Box>
        </Box>

        {/* Creative — Drive iframe or placeholder */}
        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', bgcolor: '#080808', minHeight: 0 }}>
          {fileId ? (
            <Box
              component="iframe"
              src={`https://drive.google.com/file/d/${fileId}/preview`}
              allow="autoplay"
              sx={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 2, p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                O criativo ainda não foi anexado a este conteúdo.
              </Typography>
              {link && (
                <Button
                  component="a" href={link} target="_blank" rel="noopener"
                  startIcon={<OpenInNewIcon />}
                  variant="outlined"
                  sx={{ color: 'primary.main', borderColor: 'primary.main' }}
                >
                  Abrir link do criativo
                </Button>
              )}
            </Box>
          )}
        </Box>

        {/* Existing feedback banner */}
        {existingFeedback && (
          <Box sx={{
            px: 2, py: 1.2, flexShrink: 0,
            bgcolor: existingFeedback.approved ? 'rgba(0,196,122,0.08)' : 'rgba(255,69,69,0.08)',
            borderTop: '1px solid',
            borderColor: existingFeedback.approved ? 'rgba(0,196,122,0.3)' : 'rgba(255,69,69,0.3)',
            display: 'flex', alignItems: 'flex-start', gap: 1,
          }}>
            {existingFeedback.approved
              ? <CheckCircleIcon sx={{ color: 'success.main', fontSize: 18, mt: 0.2, flexShrink: 0 }} />
              : <CancelIcon sx={{ color: 'error.main', fontSize: 18, mt: 0.2, flexShrink: 0 }} />
            }
            <Box>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: existingFeedback.approved ? 'success.main' : 'error.main' }}>
                {existingFeedback.approved
                  ? 'Você já aprovou este conteúdo. Aguardando publicação.'
                  : 'Você já solicitou alteração neste conteúdo.'}
              </Typography>
              {existingFeedback.text && (
                <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontStyle: 'italic', mt: 0.3 }}>
                  "{existingFeedback.text}"
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {/* Reject text input */}
        {rejectMode && !existingFeedback && (
          <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid rgba(255,69,69,0.2)', bgcolor: 'rgba(255,69,69,0.04)', flexShrink: 0 }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'error.main', mb: 0.8 }}>
              O que deve ser alterado? <span style={{ color: '#FF4545' }}>*</span>
            </Typography>
            <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', mb: 1, lineHeight: 1.5 }}>
              Obrigatório — sem descrição da alteração, o conteúdo será publicado como está.
            </Typography>
            <TextField
              autoFocus fullWidth multiline minRows={2} maxRows={5} size="small"
              placeholder="Ex: Mudar a cor do texto para azul, trocar a foto do produto, ajustar o título..."
              value={rejectText}
              onChange={e => { setRejectText(e.target.value); setRejectError('') }}
              error={!!rejectError}
              helperText={rejectError}
              sx={{ mb: 1.2 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={() => { setRejectMode(false); setRejectText(''); setRejectError('') }}
                sx={{ color: 'text.secondary' }}>
                Cancelar
              </Button>
              <Button
                size="small" variant="contained" color="error"
                disabled={submitting || !rejectText.trim()}
                onClick={() => submitFeedback(false)}
                sx={{ flex: 1, fontWeight: 700 }}
              >
                {submitting ? 'Enviando...' : 'Confirmar solicitação'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Footer action buttons */}
        {!rejectMode && !existingFeedback && (
          <Box sx={{
            px: 2, py: 1.5, flexShrink: 0,
            borderTop: '1px solid rgba(255,255,255,0.07)',
            bgcolor: 'rgba(13,13,13,0.97)',
            display: 'flex', gap: 1.5,
          }}>
            <Button
              fullWidth variant="outlined" color="error"
              startIcon={<CancelIcon />}
              onClick={() => setRejectMode(true)}
              sx={{ fontWeight: 700, py: 1.2, fontSize: '0.85rem' }}
            >
              Solicitar alteração
            </Button>
            <Button
              fullWidth variant="contained" color="success"
              startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
              disabled={submitting}
              onClick={() => submitFeedback(true)}
              sx={{ fontWeight: 700, py: 1.2, fontSize: '0.85rem' }}
            >
              Aprovar
            </Button>
          </Box>
        )}
      </Box>
    </ThemeProvider>
  )
}
