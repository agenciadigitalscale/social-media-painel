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
  const [btnPressed, setBtnPressed]   = useState<'approve' | 'reject' | null>(null)

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
        const resolvedLink = itemState?.link ?? ''
        setLink(resolvedLink)
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

  if (done) {
    const accent  = doneApproved ? '#00C47A' : '#FF4545'
    const accent2 = doneApproved ? '#00ff99' : '#ff8080'
    const bgGrad  = doneApproved
      ? 'radial-gradient(ellipse at 50% 30%, #021a0e 0%, #030f08 35%, #020810 55%, #05030d 80%, #010203 100%)'
      : 'radial-gradient(ellipse at 50% 30%, #1a0202 0%, #0f0303 35%, #100208 55%, #0d0305 80%, #020101 100%)'

    const smokeItems = [
      { left: '18%', size: 52, delay: 0,    dur: 3.2 },
      { left: '32%', size: 36, delay: 0.6,  dur: 2.8 },
      { left: '48%', size: 60, delay: 1.1,  dur: 3.6 },
      { left: '62%', size: 40, delay: 0.3,  dur: 3.0 },
      { left: '76%', size: 48, delay: 0.9,  dur: 2.6 },
      { left: '25%', size: 28, delay: 1.5,  dur: 4.0 },
      { left: '70%', size: 32, delay: 1.8,  dur: 3.4 },
    ]

    return (
      <ThemeProvider theme={theme}><CssBaseline />
        <Box sx={{
          position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', flexDirection: 'column', gap: 2.5, textAlign: 'center',
          px: 3,
          background: bgGrad,

          '@keyframes floatLogo': {
            '0%,100%': { transform: 'translateY(0px) rotateY(0deg) rotateX(0deg)' },
            '25%':     { transform: 'translateY(-14px) rotateY(6deg) rotateX(3deg)' },
            '75%':     { transform: 'translateY(-8px) rotateY(-6deg) rotateX(-3deg)' },
          },
          '@keyframes smokeUp': {
            '0%':   { transform: 'translateY(0) scale(0.6)', opacity: 0.55 },
            '100%': { transform: 'translateY(-280px) scale(2.5)', opacity: 0 },
          },
          '@keyframes glowPulse': {
            '0%,100%': { opacity: 0.5 },
            '50%':     { opacity: 1 },
          },
          '@keyframes checkPop': {
            '0%':   { transform: 'scale(0) rotate(-20deg)', opacity: 0 },
            '65%':  { transform: 'scale(1.25) rotate(5deg)' },
            '82%':  { transform: 'scale(0.92) rotate(-2deg)' },
            '100%': { transform: 'scale(1) rotate(0deg)', opacity: 1 },
          },
          '@keyframes textAppear': {
            '0%':   { opacity: 0, transform: 'translateY(20px)' },
            '100%': { opacity: 1, transform: 'translateY(0)' },
          },
          '@keyframes ringPulse': {
            '0%':   { transform: 'scale(0.85)', opacity: 0.7 },
            '50%':  { transform: 'scale(1.15)', opacity: 0.25 },
            '100%': { transform: 'scale(0.85)', opacity: 0.7 },
          },
          '@keyframes gridScroll': {
            '0%':   { backgroundPosition: '0 0' },
            '100%': { backgroundPosition: '0 60px' },
          },
        }}>

          <Box sx={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `linear-gradient(${accent}14 1px, transparent 1px), linear-gradient(90deg, ${accent}14 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            animation: 'gridScroll 4s linear infinite',
          }} />

          <Box sx={{
            position: 'absolute', top: '15%', left: '50%',
            transform: 'translateX(-50%)',
            width: 400, height: 400, borderRadius: '50%',
            background: `radial-gradient(circle, ${accent}28 0%, transparent 70%)`,
            animation: 'glowPulse 2.5s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          {[1, 2, 3].map(i => (
            <Box key={i} sx={{
              position: 'absolute', top: '30%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 120 + i * 80, height: 120 + i * 80, borderRadius: '50%',
              border: `1px solid ${accent}`,
              animation: `ringPulse ${1.8 + i * 0.5}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s`,
              pointerEvents: 'none',
            }} />
          ))}

          {smokeItems.map((s, i) => (
            <Box key={i} sx={{
              position: 'absolute', bottom: '30%', left: s.left,
              width: s.size, height: s.size, borderRadius: '50%',
              background: `radial-gradient(circle, ${accent}50 0%, transparent 70%)`,
              filter: 'blur(10px)',
              animation: `smokeUp ${s.dur}s ease-out infinite`,
              animationDelay: `${s.delay}s`,
              pointerEvents: 'none',
            }} />
          ))}

          <Box sx={{ position: 'relative', zIndex: 2 }}>
            <Box component="img" src="/logotipo.png" sx={{
              height: { xs: 110, sm: 140 },
              objectFit: 'contain',
              animation: 'floatLogo 4s ease-in-out infinite',
              filter: `drop-shadow(0 0 24px ${accent}99) drop-shadow(0 0 60px ${accent}44) drop-shadow(0 24px 48px rgba(0,0,0,0.9))`,
              transformStyle: 'preserve-3d',
            }} />
          </Box>

          <Box sx={{ position: 'relative', zIndex: 2 }}>
            {doneApproved
              ? <CheckCircleIcon sx={{ fontSize: 80, color: accent, filter: `drop-shadow(0 0 16px ${accent}cc)`, animation: 'checkPop 0.7s cubic-bezier(0.34,1.56,0.64,1) both' }} />
              : <CancelIcon      sx={{ fontSize: 80, color: accent, filter: `drop-shadow(0 0 16px ${accent}cc)`, animation: 'checkPop 0.7s cubic-bezier(0.34,1.56,0.64,1) both' }} />
            }
          </Box>

          <Typography variant="h4" fontWeight={900} sx={{
            color: accent2, zIndex: 2, letterSpacing: '-0.01em',
            textShadow: `0 0 30px ${accent}99, 0 0 60px ${accent}44`,
            animation: 'textAppear 0.5s ease 0.4s both',
          }}>
            {doneApproved ? 'Conteúdo aprovado!' : 'Alteração solicitada'}
          </Typography>

          <Typography sx={{
            color: 'rgba(255,255,255,0.55)', maxWidth: 340, lineHeight: 1.7, zIndex: 2,
            fontSize: '0.95rem', animation: 'textAppear 0.5s ease 0.65s both',
          }}>
            {doneApproved
              ? 'A Digital Scale foi notificada e publicará o conteúdo conforme o calendário. Obrigado!'
              : 'Sua solicitação foi enviada à equipe. Faremos os ajustes e entraremos em contato em breve.'}
          </Typography>

          {!doneApproved && rejectText && (
            <Paper sx={{
              p: 2, borderRadius: 2, maxWidth: 420, width: '100%', textAlign: 'left', zIndex: 2,
              bgcolor: 'rgba(255,69,69,0.07)', border: `1px solid ${accent}44`,
              animation: 'textAppear 0.5s ease 0.8s both',
            }}>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                Sua solicitação:
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: '#FF8080', fontStyle: 'italic', lineHeight: 1.5 }}>
                "{rejectText}"
              </Typography>
            </Paper>
          )}
        </Box>
      </ThemeProvider>
    )
  }

  const tc = typeColor(item.tp)

  const kf = {
    '@keyframes floatBtn': {
      '0%,100%': { transform: 'translateY(0px) perspective(500px) rotateX(-2deg)' },
      '50%':     { transform: 'translateY(5px) perspective(500px) rotateX(1deg)' },
    },
    '@keyframes floatBtnB': {
      '0%,100%': { transform: 'translateY(4px) perspective(500px) rotateX(-2deg)' },
      '50%':     { transform: 'translateY(-1px) perspective(500px) rotateX(1deg)' },
    },
    '@keyframes bouncePress': {
      '0%':   { transform: 'scale(1) translateY(0)' },
      '25%':  { transform: 'scale(0.89) translateY(3px)' },
      '60%':  { transform: 'scale(1.07) translateY(-5px)' },
      '80%':  { transform: 'scale(0.97) translateY(-1px)' },
      '100%': { transform: 'scale(1) translateY(0)' },
    },
    '@keyframes neonPulseRed': {
      '0%,100%': { boxShadow: '0 0 8px #FF4545, 0 0 22px #FF454555, 0 4px 0 #8B0000, inset 0 1px 0 rgba(255,180,180,0.25)' },
      '50%':     { boxShadow: '0 0 18px #FF4545, 0 0 48px #FF454588, 0 4px 0 #8B0000, inset 0 1px 0 rgba(255,180,180,0.45)' },
    },
    '@keyframes neonPulseGreen': {
      '0%,100%': { boxShadow: '0 0 8px #00C47A, 0 0 22px #00C47A55, 0 4px 0 #005C38, inset 0 1px 0 rgba(100,255,180,0.25)' },
      '50%':     { boxShadow: '0 0 18px #00C47A, 0 0 48px #00C47A88, 0 4px 0 #005C38, inset 0 1px 0 rgba(100,255,180,0.45)' },
    },
  }

  return (
    <ThemeProvider theme={theme}><CssBaseline />
      <Box sx={{
        height: '100vh', width: '100vw', overflow: 'hidden', bgcolor: '#000',
        display: 'flex', flexDirection: 'column',
        ...kf,
      }}>

        {/* ── TOPO: logo + info + botões neon compactos ── */}
        {!rejectMode && !existingFeedback && (
          <Box sx={{
            flexShrink: 0,
            pt: 'max(env(safe-area-inset-top), 8px)',
            px: 1.5, pb: 1,
            bgcolor: '#000',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            {/* Linha 1: logo + nome + título + chip */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
              <Box component="img" src="/logotipo.png" sx={{ height: 20, objectFit: 'contain', flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.44rem', color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: 1.2, lineHeight: 1 }}>
                  {clientName}
                </Typography>
                <Typography fontWeight={800} sx={{ fontSize: '0.68rem', color: '#fff', lineHeight: 1.2 }} noWrap>
                  {title}
                </Typography>
              </Box>
              <Chip label={item.tp} size="small" sx={{ height: 15, fontSize: '0.43rem', color: tc, bgcolor: `${tc}20`, border: `1px solid ${tc}44`, flexShrink: 0 }} />
            </Box>

            {/* Linha 2: botões neon */}
            <Box sx={{ display: 'flex', gap: 0.8 }}>
              <Box
                onClick={() => { setBtnPressed('reject'); setTimeout(() => { setBtnPressed(null); setRejectMode(true) }, 260) }}
                sx={{
                  flex: 1, borderRadius: 2, cursor: 'pointer',
                  py: 0.7, px: 0.8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6,
                  background: 'linear-gradient(180deg, #FF4444 0%, #BB0000 100%)',
                  border: '1px solid rgba(255,100,100,0.4)',
                  animation: btnPressed === 'reject'
                    ? 'bouncePress 0.28s cubic-bezier(0.34,1.56,0.64,1) both'
                    : 'floatBtn 3s ease-in-out infinite, neonPulseRed 2.2s ease-in-out infinite',
                  userSelect: 'none',
                }}
              >
                <CancelIcon sx={{ fontSize: 12, color: '#fff', filter: 'drop-shadow(0 0 3px rgba(255,60,60,0.9))', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: '#fff', letterSpacing: '0.02em', textShadow: '0 0 6px rgba(255,60,60,0.8)', lineHeight: 1 }}>
                  SOLICITAR ALTERAÇÃO
                </Typography>
              </Box>

              <Box
                onClick={() => {
                  if (submitting) return
                  setBtnPressed('approve')
                  setTimeout(() => { setBtnPressed(null); submitFeedback(true) }, 260)
                }}
                sx={{
                  flex: 1, borderRadius: 2, cursor: submitting ? 'default' : 'pointer',
                  py: 0.7, px: 0.8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6,
                  background: 'linear-gradient(180deg, #00D070 0%, #007A40 100%)',
                  border: '1px solid rgba(0,200,120,0.4)',
                  animation: btnPressed === 'approve'
                    ? 'bouncePress 0.28s cubic-bezier(0.34,1.56,0.64,1) both'
                    : 'floatBtnB 3s ease-in-out infinite, neonPulseGreen 2.2s ease-in-out infinite',
                  animationDelay: btnPressed === 'approve' ? '0s' : '0.5s, 0.5s',
                  opacity: submitting ? 0.7 : 1,
                  userSelect: 'none',
                }}
              >
                {submitting
                  ? <CircularProgress size={12} sx={{ color: '#fff', flexShrink: 0 }} />
                  : <CheckCircleIcon sx={{ fontSize: 12, color: '#fff', filter: 'drop-shadow(0 0 3px rgba(0,220,120,0.9))', flexShrink: 0 }} />
                }
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: '#fff', letterSpacing: '0.02em', textShadow: '0 0 6px rgba(0,200,100,0.8)', lineHeight: 1 }}>
                  {submitting ? 'ENVIANDO...' : 'APROVAR'}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* Banner feedback já enviado */}
        {existingFeedback && (
          <Box sx={{
            flexShrink: 0,
            pt: 'max(env(safe-area-inset-top), 8px)',
            px: 2, pb: 1,
            display: 'flex', alignItems: 'center', gap: 1,
            bgcolor: existingFeedback.approved ? 'rgba(0,25,14,0.99)' : 'rgba(25,0,0,0.99)',
            borderBottom: `1px solid ${existingFeedback.approved ? 'rgba(0,196,122,0.25)' : 'rgba(255,69,69,0.25)'}`,
          }}>
            {existingFeedback.approved
              ? <CheckCircleIcon sx={{ color: 'success.main', fontSize: 18, flexShrink: 0 }} />
              : <CancelIcon sx={{ color: 'error.main', fontSize: 18, flexShrink: 0 }} />
            }
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                {existingFeedback.approved ? 'Você aprovou este conteúdo.' : 'Você solicitou alteração.'}
              </Typography>
              {existingFeedback.text && (
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }} noWrap>
                  "{existingFeedback.text}"
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {/* ── VÍDEO — iframe Google Drive (sem controles nativos iOS) ── */}
        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0, bgcolor: '#000' }}>
          {fileId ? (
            <Box
              component="iframe"
              src={`https://drive.google.com/file/d/${fileId}/preview`}
              allow="autoplay"
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          ) : (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2, p: 3, textAlign: 'center', bgcolor: '#080808' }}>
              <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                O criativo ainda não foi anexado a este conteúdo.
              </Typography>
              {link && (
                <Button component="a" href={link} target="_blank" rel="noopener"
                  startIcon={<OpenInNewIcon />} variant="outlined"
                  sx={{ color: 'primary.main', borderColor: 'primary.main' }}>
                  Abrir link do criativo
                </Button>
              )}
            </Box>
          )}
        </Box>

        {/* Input de motivo de reprovação */}
        {rejectMode && !existingFeedback && (
          <Box sx={{
            flexShrink: 0,
            borderTop: '1px solid rgba(255,69,69,0.35)',
            px: 2, pt: 1.2, pb: 'max(env(safe-area-inset-bottom), 14px)',
            bgcolor: 'rgba(6,0,0,0.99)',
          }}>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'error.main', mb: 0.3 }}>
              O que deve ser alterado? <span style={{ color: '#FF4545' }}>*</span>
            </Typography>
            <Typography sx={{ fontSize: '0.54rem', color: 'rgba(255,255,255,0.22)', mb: 0.8 }}>
              Obrigatório — sem descrição, o conteúdo será publicado como está.
            </Typography>
            <TextField
              autoFocus fullWidth multiline minRows={2} maxRows={4} size="small"
              placeholder="Ex: Mudar a cor do texto, trocar a foto, ajustar o título..."
              value={rejectText}
              onChange={e => { setRejectText(e.target.value); setRejectError('') }}
              error={!!rejectError} helperText={rejectError}
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={() => { setRejectMode(false); setRejectText(''); setRejectError('') }}
                sx={{ color: 'rgba(255,255,255,0.35)' }}>Cancelar</Button>
              <Button size="small" variant="contained" color="error"
                disabled={submitting || !rejectText.trim()}
                onClick={() => submitFeedback(false)}
                sx={{ flex: 1, fontWeight: 700 }}>
                {submitting ? 'Enviando...' : 'Confirmar solicitação'}
              </Button>
            </Box>
          </Box>
        )}

      </Box>
    </ThemeProvider>
  )
}
