import { useState, useEffect, useRef, useCallback } from 'react'
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

  // UI (header + botões) some em 1s; toque no handle de rodapé traz de volta por 3s
  const [uiVisible, setUiVisible] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showUi = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setUiVisible(true)
    hideTimer.current = setTimeout(() => setUiVisible(false), 3000)
  }, [])

  useEffect(() => {
    if (!done && !loading && !error && item) {
      hideTimer.current = setTimeout(() => setUiVisible(false), 1000)
    }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current) }
  }, [done, loading, error, item])

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

          /* ── keyframes ── */
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
          '@keyframes starFade': {
            '0%,100%': { opacity: 0 },
            '50%':     { opacity: 1 },
          },
        }}>

          {/* Grid futurístico animado */}
          <Box sx={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `linear-gradient(${accent}14 1px, transparent 1px), linear-gradient(90deg, ${accent}14 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            animation: 'gridScroll 4s linear infinite',
          }} />

          {/* Glow radial central */}
          <Box sx={{
            position: 'absolute', top: '15%', left: '50%',
            transform: 'translateX(-50%)',
            width: 400, height: 400, borderRadius: '50%',
            background: `radial-gradient(circle, ${accent}28 0%, transparent 70%)`,
            animation: 'glowPulse 2.5s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          {/* Anéis de onda */}
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

          {/* Fumaça */}
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

          {/* ── Conteúdo central ── */}
          {/* Logo — maior que o ícone, flutuando em 3D */}
          <Box sx={{ position: 'relative', zIndex: 2 }}>
            <Box component="img" src="/logotipo.png" sx={{
              height: { xs: 110, sm: 140 },
              objectFit: 'contain',
              animation: 'floatLogo 4s ease-in-out infinite',
              filter: `drop-shadow(0 0 24px ${accent}99) drop-shadow(0 0 60px ${accent}44) drop-shadow(0 24px 48px rgba(0,0,0,0.9))`,
              transformStyle: 'preserve-3d',
            }} />
          </Box>

          {/* Ícone de confirmação */}
          <Box sx={{ position: 'relative', zIndex: 2 }}>
            {doneApproved
              ? <CheckCircleIcon sx={{ fontSize: 80, color: accent, filter: `drop-shadow(0 0 16px ${accent}cc)`, animation: 'checkPop 0.7s cubic-bezier(0.34,1.56,0.64,1) both' }} />
              : <CancelIcon      sx={{ fontSize: 80, color: accent, filter: `drop-shadow(0 0 16px ${accent}cc)`, animation: 'checkPop 0.7s cubic-bezier(0.34,1.56,0.64,1) both' }} />
            }
          </Box>

          {/* Título */}
          <Typography variant="h4" fontWeight={900} sx={{
            color: accent2,
            zIndex: 2,
            letterSpacing: '-0.01em',
            textShadow: `0 0 30px ${accent}99, 0 0 60px ${accent}44`,
            animation: 'textAppear 0.5s ease 0.4s both',
          }}>
            {doneApproved ? 'Conteúdo aprovado!' : 'Alteração solicitada'}
          </Typography>

          {/* Subtexto */}
          <Typography sx={{
            color: 'rgba(255,255,255,0.55)', maxWidth: 340, lineHeight: 1.7, zIndex: 2,
            fontSize: '0.95rem', animation: 'textAppear 0.5s ease 0.65s both',
          }}>
            {doneApproved
              ? 'A Digital Scale foi notificada e publicará o conteúdo conforme o calendário. Obrigado!'
              : 'Sua solicitação foi enviada à equipe. Faremos os ajustes e entraremos em contato em breve.'}
          </Typography>

          {/* Texto da reprovação */}
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

  return (
    <ThemeProvider theme={theme}><CssBaseline />
      <Box sx={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden', bgcolor: '#000' }}>

        {/* ── iframe: ocupa tela até o topo da área dos botões ── */}
        {fileId ? (
          <Box
            component="iframe"
            src={`https://drive.google.com/file/d/${fileId}/preview`}
            allow="autoplay"
            sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '110px', width: '100%', height: 'calc(100% - 110px)', border: 'none', display: 'block' }}
          />
        ) : (
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2, p: 3, textAlign: 'center', bgcolor: '#080808' }}>
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

        {/* ── Header — some em 1s, volta ao tocar no handle ── */}
        <Box sx={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
          px: 2, pt: 'max(env(safe-area-inset-top), 12px)', pb: 1.5,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
          display: 'flex', alignItems: 'center', gap: 1.5,
          transform: uiVisible ? 'translateY(0)' : 'translateY(-110%)',
          transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)',
          pointerEvents: uiVisible ? 'auto' : 'none',
        }}>
          <Box component="img" src="/logotipo.png" sx={{ height: 30, objectFit: 'contain', flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
              {clientName}
            </Typography>
            <Typography fontWeight={800} sx={{ fontSize: '0.8rem', color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.9)' }} noWrap>
              {title}
            </Typography>
          </Box>
          <Chip label={item.tp} size="small" sx={{ height: 18, fontSize: '0.52rem', color: tc, bgcolor: `${tc}33` }} />
        </Box>

        {/* ── Existing feedback banner ── */}
        {existingFeedback && (
          <Box sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
            height: '110px',
            px: 2, py: 1.5,
            background: existingFeedback.approved
              ? 'linear-gradient(0deg, rgba(0,50,28,0.97) 0%, rgba(0,30,15,0.88) 100%)'
              : 'linear-gradient(0deg, rgba(50,0,0,0.97) 0%, rgba(30,0,0,0.88) 100%)',
            backdropFilter: 'blur(16px)',
            display: 'flex', alignItems: 'center', gap: 1,
          }}>
            {existingFeedback.approved
              ? <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20, mt: 0.2, flexShrink: 0 }} />
              : <CancelIcon sx={{ color: 'error.main', fontSize: 20, mt: 0.2, flexShrink: 0 }} />
            }
            <Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#fff' }}>
                {existingFeedback.approved ? 'Você aprovou este conteúdo.' : 'Você solicitou alteração neste conteúdo.'}
              </Typography>
              {existingFeedback.text && (
                <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', mt: 0.2 }}>
                  "{existingFeedback.text}"
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {/* ── Reject text input ── */}
        {rejectMode && !existingFeedback && (
          <Box sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
            px: 2, pt: 1.5, pb: 'max(env(safe-area-inset-bottom), 16px)',
            background: 'rgba(8,0,0,0.98)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,69,69,0.35)',
            minHeight: '110px',
          }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'error.main', mb: 0.4 }}>
              O que deve ser alterado? <span style={{ color: '#FF4545' }}>*</span>
            </Typography>
            <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.28)', mb: 1 }}>
              Obrigatório — sem descrição, o conteúdo será publicado como está.
            </Typography>
            <TextField
              autoFocus fullWidth multiline minRows={2} maxRows={4} size="small"
              placeholder="Ex: Mudar a cor do texto, trocar a foto, ajustar o título..."
              value={rejectText}
              onChange={e => { setRejectText(e.target.value); setRejectError('') }}
              error={!!rejectError} helperText={rejectError}
              sx={{ mb: 1.2 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={() => { setRejectMode(false); setRejectText(''); setRejectError('') }}
                sx={{ color: 'rgba(255,255,255,0.4)' }}>Cancelar</Button>
              <Button size="small" variant="contained" color="error"
                disabled={submitting || !rejectText.trim()}
                onClick={() => submitFeedback(false)}
                sx={{ flex: 1, fontWeight: 700 }}>
                {submitting ? 'Enviando...' : 'Confirmar solicitação'}
              </Button>
            </Box>
          </Box>
        )}

        {/* ── Footer: botões neon — SEMPRE VISÍVEIS durante todo o vídeo ── */}
        {!rejectMode && !existingFeedback && (
          <Box sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
            height: '110px',
            px: 2,
            display: 'flex', alignItems: 'center', gap: 1.5,
            background: 'linear-gradient(0deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.92) 70%, rgba(0,0,0,0.75) 100%)',
            pb: 'max(env(safe-area-inset-bottom), 12px)',

            '@keyframes floatBtn': {
              '0%,100%': { transform: 'translateY(0px) perspective(600px) rotateX(4deg)' },
              '50%':     { transform: 'translateY(-5px) perspective(600px) rotateX(2deg)' },
            },
            '@keyframes floatBtnB': {
              '0%,100%': { transform: 'translateY(-3px) perspective(600px) rotateX(4deg)' },
              '50%':     { transform: 'translateY(2px) perspective(600px) rotateX(6deg)' },
            },
            '@keyframes bouncePress': {
              '0%':   { transform: 'scale(1) translateY(0) perspective(600px) rotateX(4deg)' },
              '25%':  { transform: 'scale(0.91) translateY(4px) perspective(600px) rotateX(8deg)' },
              '60%':  { transform: 'scale(1.06) translateY(-8px) perspective(600px) rotateX(0deg)' },
              '80%':  { transform: 'scale(0.97) translateY(-2px) perspective(600px) rotateX(3deg)' },
              '100%': { transform: 'scale(1) translateY(0) perspective(600px) rotateX(4deg)' },
            },
            '@keyframes neonPulseRed': {
              '0%,100%': { boxShadow: '0 0 8px #FF4545, 0 0 24px #FF454566, 0 6px 0 #8B0000, inset 0 1px 0 rgba(255,180,180,0.3)' },
              '50%':     { boxShadow: '0 0 18px #FF4545, 0 0 50px #FF454599, 0 6px 0 #8B0000, inset 0 1px 0 rgba(255,180,180,0.5)' },
            },
            '@keyframes neonPulseGreen': {
              '0%,100%': { boxShadow: '0 0 8px #00C47A, 0 0 24px #00C47A66, 0 6px 0 #005C38, inset 0 1px 0 rgba(100,255,180,0.3)' },
              '50%':     { boxShadow: '0 0 18px #00C47A, 0 0 50px #00C47A99, 0 6px 0 #005C38, inset 0 1px 0 rgba(100,255,180,0.5)' },
            },
          }}>
            {/* ── Botão SOLICITAR ALTERAÇÃO ── */}
            <Box
              onClick={() => { setBtnPressed('reject'); setTimeout(() => { setBtnPressed(null); setRejectMode(true) }, 320) }}
              sx={{
                flex: 1, borderRadius: 2.5, cursor: 'pointer',
                py: 1.4, px: 1.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
                background: 'linear-gradient(180deg, #FF5555 0%, #CC1111 60%, #990000 100%)',
                border: '1px solid rgba(255,120,120,0.5)',
                animation: btnPressed === 'reject'
                  ? 'bouncePress 0.35s cubic-bezier(0.34,1.56,0.64,1) both'
                  : 'floatBtn 2.8s ease-in-out infinite, neonPulseRed 2s ease-in-out infinite',
                userSelect: 'none',
              }}
            >
              <CancelIcon sx={{ fontSize: 18, color: '#fff', filter: 'drop-shadow(0 0 4px rgba(255,100,100,0.8))' }} />
              <Box>
                <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,200,200,0.7)', lineHeight: 1, letterSpacing: 0.5, fontWeight: 600 }}>
                  SOLICITAR
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 900, color: '#fff', lineHeight: 1.1, textShadow: '0 0 8px rgba(255,100,100,0.7)', letterSpacing: '0.02em' }}>
                  ALTERAÇÃO
                </Typography>
              </Box>
            </Box>

            {/* ── Botão APROVAR ── */}
            <Box
              onClick={() => {
                if (submitting) return
                setBtnPressed('approve')
                setTimeout(() => { setBtnPressed(null); submitFeedback(true) }, 320)
              }}
              sx={{
                flex: 1, borderRadius: 2.5, cursor: submitting ? 'default' : 'pointer',
                py: 1.4, px: 1.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
                background: 'linear-gradient(180deg, #00E080 0%, #00A856 60%, #006633 100%)',
                border: '1px solid rgba(100,255,180,0.5)',
                animation: btnPressed === 'approve'
                  ? 'bouncePress 0.35s cubic-bezier(0.34,1.56,0.64,1) both'
                  : 'floatBtnB 2.8s ease-in-out infinite, neonPulseGreen 2s ease-in-out infinite',
                animationDelay: btnPressed === 'approve' ? '0s' : '0.5s, 0.5s',
                opacity: submitting ? 0.7 : 1,
                userSelect: 'none',
              }}
            >
              {submitting
                ? <CircularProgress size={18} sx={{ color: '#fff' }} />
                : <CheckCircleIcon sx={{ fontSize: 18, color: '#fff', filter: 'drop-shadow(0 0 4px rgba(0,255,140,0.8))' }} />
              }
              <Box>
                <Typography sx={{ fontSize: '0.62rem', color: 'rgba(180,255,220,0.7)', lineHeight: 1, letterSpacing: 0.5, fontWeight: 600 }}>
                  {submitting ? 'ENVIANDO' : 'TOQUE PARA'}
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 900, color: '#fff', lineHeight: 1.1, textShadow: '0 0 8px rgba(0,220,120,0.7)', letterSpacing: '0.02em' }}>
                  {submitting ? '...' : 'APROVAR'}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </ThemeProvider>
  )
}
