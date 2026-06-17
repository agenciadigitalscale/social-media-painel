import { useState, useEffect, useRef } from 'react'
import {
  Box, Typography, Button, TextField, CircularProgress,
  Alert, ThemeProvider, CssBaseline, Paper, Chip,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
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

// streamable.com/XXXXX  ou  streamable.com/e/XXXXX
function extractStreamableId(url: string): string | null {
  const m = url.match(/streamable\.com\/(?:e\/)?([a-zA-Z0-9]+)/)
  return m ? m[1] : null
}

type VideoSource =
  | { type: 'drive';      fileId: string;  embedUrl: string; thumbUrl: string }
  | { type: 'streamable'; videoId: string; embedUrl: string; thumbUrl: string }
  | { type: 'none' }

function resolveVideoSource(link: string): VideoSource {
  if (!link) return { type: 'none' }
  const streamableId = extractStreamableId(link)
  if (streamableId) return {
    type: 'streamable',
    videoId: streamableId,
    embedUrl: `https://streamable.com/e/${streamableId}`,
    thumbUrl: `https://cdn-cf-east.streamable.com/image/${streamableId}.jpg`,
  }
  const fileId = extractDriveFileId(link)
  if (fileId) return {
    type: 'drive',
    fileId,
    embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
    thumbUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`,
  }
  return { type: 'none' }
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
  const [videoRevealed, setVideoRevealed] = useState(false)
  const [thumbError, setThumbError]       = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Resolvido cedo para que o timer possa usar videoSource.type
  const videoSource = resolveVideoSource(link)

  // ── Lock progressivo — libera botões após assistir X segundos ──
  const UNLOCK_AFTER = 18
  const [watchSeconds,    setWatchSeconds]    = useState(0)
  const [buttonsUnlocked, setButtonsUnlocked] = useState(false)
  const [justUnlocked,    setJustUnlocked]    = useState(false)
  const watchRef = useRef(0)  // acumulador para vídeo nativo

  // Timer para iframe (Streamable) — Drive usa onTimeUpdate
  useEffect(() => {
    if (!videoRevealed || buttonsUnlocked) return
    const isDrive = videoSource.type === 'drive'
    if (isDrive) return  // Drive usa evento onTimeUpdate do <video>
    const id = setInterval(() => {
      setWatchSeconds(s => {
        const next = s + 1
        if (next >= UNLOCK_AFTER) {
          clearInterval(id)
          setButtonsUnlocked(true)
          setJustUnlocked(true)
          setTimeout(() => setJustUnlocked(false), 1200)
        }
        return Math.min(next, UNLOCK_AFTER)
      })
    }, 1000)
    return () => clearInterval(id)
  }, [videoRevealed, buttonsUnlocked, videoSource.type])

  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (buttonsUnlocked) return
    const current = Math.floor((e.target as HTMLVideoElement).currentTime)
    if (current > watchRef.current) {
      watchRef.current = current
      const next = Math.min(current, UNLOCK_AFTER)
      setWatchSeconds(next)
      if (next >= UNLOCK_AFTER) {
        setButtonsUnlocked(true)
        setJustUnlocked(true)
        setTimeout(() => setJustUnlocked(false), 1200)
      }
    }
  }

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

  const fileId = videoSource.type === 'drive' ? videoSource.fileId : null

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
    '@keyframes unlockFlash': {
      '0%':   { boxShadow: '0 0 0px #00C47A' },
      '40%':  { boxShadow: '0 0 60px 20px #00C47A88' },
      '100%': { boxShadow: '0 0 8px #00C47A, 0 0 22px #00C47A55, 0 4px 0 #005C38' },
    },
    '@keyframes approveGrow': {
      '0%':   { transform: 'scale(0.92)', opacity: 0.4 },
      '60%':  { transform: 'scale(1.04)' },
      '100%': { transform: 'scale(1)',    opacity: 1 },
    },
    '@keyframes progressPulse': {
      '0%,100%': { opacity: 0.8 },
      '50%':     { opacity: 1 },
    },
  }

  return (
    <ThemeProvider theme={theme}><CssBaseline />
      <Box sx={{
        height: '100vh', width: '100vw', overflow: 'hidden', bgcolor: '#000',
        display: 'flex', flexDirection: 'column',
        ...kf,
      }}>

        {/* ── TOPO: info do criativo (sem botões) ── */}
        <Box sx={{
          flexShrink: 0,
          pt: 'max(env(safe-area-inset-top), 8px)',
          px: 1.5, pb: 1,
          bgcolor: '#000',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
        </Box>

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

        {/* ── ÁREA CENTRAL ── */}
        <Box sx={{
          flex: 1, minHeight: 0, position: 'relative', bgcolor: '#000', overflow: 'hidden',
          '@keyframes bgPulse':   { '0%,100%': { opacity: 0.6 }, '50%': { opacity: 1 } },
          '@keyframes logoFloat': { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
          '@keyframes logoPulse': {
            '0%,100%': { filter: 'drop-shadow(0 0 10px rgba(255,144,57,0.55))' },
            '50%':     { filter: 'drop-shadow(0 0 28px rgba(255,144,57,1)) drop-shadow(0 0 55px rgba(255,83,57,0.55))' },
          },
          '@keyframes ringOut': {
            '0%':   { transform: 'translate(-50%,-50%) scale(0.75)', opacity: 0.6 },
            '100%': { transform: 'translate(-50%,-50%) scale(1.6)',  opacity: 0 },
          },
          '@keyframes playBtnGlow': {
            '0%,100%': { boxShadow: '0 0 0 0 rgba(255,144,57,0)', transform: 'scale(1)' },
            '50%':     { boxShadow: '0 0 32px 8px rgba(255,144,57,0.35)', transform: 'scale(1.04)' },
          },
          '@keyframes overlayOut': {
            '0%':   { opacity: 1 },
            '100%': { opacity: 0, pointerEvents: 'none' },
          },
        }}>

          {/* Drive: <video> nativo — player limpo sem controles pesados do Drive */}
          {videoSource.type === 'drive' && (
            <Box
              component="video"
              src={`/api/stream?id=${videoSource.fileId}`}
              controls
              playsInline
              autoPlay={videoRevealed}
              onTimeUpdate={handleVideoTimeUpdate}
              onPlay={() => { if (!videoRevealed) setVideoRevealed(true) }}
              sx={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'contain', bgcolor: '#000',
                opacity: videoRevealed ? 1 : 0,
                transition: 'opacity 0.4s ease',
              }}
            />
          )}

          {/* Streamable: iframe mantido */}
          {videoSource.type === 'streamable' && (
            <Box
              ref={iframeRef}
              component="iframe"
              src={videoSource.embedUrl}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              sx={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                border: 'none', display: 'block',
                opacity: videoRevealed ? 1 : 0,
                transition: 'opacity 0.5s ease',
              }}
            />
          )}

          {/* Overlay branded — some ao clicar em Assistir */}
          {!videoRevealed && (
            <Box sx={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 3, px: 3, textAlign: 'center',
              background: 'radial-gradient(ellipse at 50% 40%, #1a0d00 0%, #0d0800 40%, #000 100%)',
            }}>

              {/* Thumbnail de fundo — blurred + escurecida */}
              {videoSource.type !== 'none' && !thumbError && (
                <>
                  <Box
                    component="img"
                    src={videoSource.thumbUrl}
                    onError={() => setThumbError(true)}
                    sx={{
                      position: 'absolute', inset: 0,
                      width: '100%', height: '100%',
                      objectFit: 'cover',
                      filter: 'blur(18px) brightness(0.28) saturate(0.7)',
                      transform: 'scale(1.08)',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Vinheta nas bordas */}
                  <Box sx={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.85) 100%)',
                  }} />
                </>
              )}

              {/* Glow radial de fundo (quando sem thumb) */}
              {thumbError && (
                <Box sx={{
                  position: 'absolute', inset: 0, pointerEvents: 'none',
                  background: 'radial-gradient(ellipse at 50% 42%, rgba(255,110,20,0.14) 0%, rgba(255,50,10,0.06) 45%, transparent 70%)',
                  animation: 'bgPulse 4s ease-in-out infinite',
                }} />
              )}

              {/* Logo */}
              <Box sx={{ animation: 'logoFloat 3.5s ease-in-out infinite, logoPulse 3.5s ease-in-out infinite', zIndex: 1 }}>
                <Box component="img" src="/logotipo.png" sx={{ height: { xs: 54, sm: 68 }, objectFit: 'contain' }} />
              </Box>

              {/* Título do conteúdo */}
              <Box sx={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{
                  fontSize: { xs: '0.62rem', sm: '0.7rem' },
                  fontWeight: 700, color: 'rgba(255,144,57,0.7)',
                  textTransform: 'uppercase', letterSpacing: 2,
                }}>
                  {item?.tp ?? 'Conteúdo'}
                </Typography>
                <Typography sx={{
                  fontSize: { xs: '1rem', sm: '1.2rem' },
                  fontWeight: 900, color: '#fff',
                  lineHeight: 1.2, maxWidth: 280,
                }}>
                  {title}
                </Typography>
              </Box>

              {/* Botão play */}
              {videoSource.type !== 'none' ? (
                <Box
                  onClick={() => setVideoRevealed(true)}
                  sx={{
                    position: 'relative', zIndex: 1, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5,
                  }}
                >
                  {/* Anéis pulsantes */}
                  {[0, 1].map(i => (
                    <Box key={i} sx={{
                      position: 'absolute', top: '50%', left: '50%',
                      width: 86, height: 86, borderRadius: '50%',
                      border: '1.5px solid rgba(255,144,57,0.35)',
                      animation: 'ringOut 2.8s ease-out infinite',
                      animationDelay: `${i * 1.4}s`,
                      pointerEvents: 'none',
                    }} />
                  ))}

                  {/* Círculo play */}
                  <Box sx={{
                    width: 76, height: 76, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(145deg, rgba(255,144,57,0.22) 0%, rgba(255,60,20,0.1) 100%)',
                    border: '2px solid rgba(255,144,57,0.55)',
                    animation: 'playBtnGlow 2.4s ease-in-out infinite',
                  }}>
                    <Typography sx={{ fontSize: '2.1rem', lineHeight: 1, ml: '6px', color: '#ff9039' }}>▶</Typography>
                  </Box>

                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: '#fff', letterSpacing: '0.04em' }}>
                      Toque para assistir
                    </Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.32)', letterSpacing: '0.14em', textTransform: 'uppercase', mt: 0.3 }}>
                      reproduz aqui mesmo
                    </Typography>
                    {/* Badge da fonte */}
                    <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
                      <Chip
                        label={videoSource.type === 'streamable' ? '⚡ Streamable' : '📁 Google Drive'}
                        size="small"
                        sx={{
                          fontSize: '0.52rem', height: 17,
                          bgcolor: videoSource.type === 'streamable'
                            ? 'rgba(99,102,241,0.18)'
                            : 'rgba(66,133,244,0.15)',
                          color: videoSource.type === 'streamable' ? '#a5b4fc' : '#7fb3f5',
                          border: `1px solid ${videoSource.type === 'streamable' ? 'rgba(99,102,241,0.35)' : 'rgba(66,133,244,0.3)'}`,
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', zIndex: 1, lineHeight: 1.7, maxWidth: 260 }}>
                  O criativo ainda não foi anexado.{'\n'}Entre em contato com a agência.
                </Typography>
              )}

              {/* Dica Wi-Fi */}
              <Box sx={{
                zIndex: 1, display: 'flex', alignItems: 'center', gap: 0.8,
                px: 1.4, py: 0.65, borderRadius: 2,
                bgcolor: 'rgba(255,144,57,0.06)', border: '1px solid rgba(255,144,57,0.15)',
              }}>
                <Typography sx={{ fontSize: '0.85rem', lineHeight: 1 }}>📶</Typography>
                <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,144,57,0.65)', fontWeight: 600, letterSpacing: '0.05em' }}>
                  Prefira usar Wi-Fi para melhor experiência
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* ── RODAPÉ: barra de progresso + botões ── */}
        {!rejectMode && !existingFeedback && (() => {
          const hasVideo    = videoSource.type !== 'none'
          const isLocked    = hasVideo && videoRevealed && !buttonsUnlocked
          const pct         = Math.min((watchSeconds / UNLOCK_AFTER) * 100, 100)
          const remaining   = Math.max(UNLOCK_AFTER - watchSeconds, 0)
          return (
            <Box sx={{
              flexShrink: 0, bgcolor: '#000',
              borderTop: isLocked
                ? '1px solid rgba(255,144,57,0.18)'
                : '1px solid rgba(255,255,255,0.07)',
              transition: 'border-color 0.4s',
            }}>

              {/* ── Barra de progresso (só enquanto assistindo) ── */}
              {isLocked && (
                <Box sx={{ px: 1.5, pt: 1, pb: 0.4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#ff9039', letterSpacing: '0.04em' }}>
                      🎬 Assista o vídeo para liberar sua decisão
                    </Typography>
                    <Box sx={{ ml: 'auto', minWidth: 24, textAlign: 'right' }}>
                      <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: 'rgba(255,144,57,0.7)', fontVariantNumeric: 'tabular-nums' }}>
                        {remaining}s
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ height: 4, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <Box sx={{
                      height: '100%', borderRadius: 4,
                      background: 'linear-gradient(90deg, #ff9039, #ff5339)',
                      width: `${pct}%`,
                      transition: 'width 0.9s linear',
                      animation: 'progressPulse 1.4s ease-in-out infinite',
                      boxShadow: '0 0 8px rgba(255,144,57,0.6)',
                    }} />
                  </Box>
                </Box>
              )}

              {/* ── Instrução (quando desbloqueado ou sem vídeo) ── */}
              {!isLocked && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mx: 1.5, mt: 1, mb: 0.4 }}>
                  <Box sx={{ flex: 1, height: '1px', bgcolor: justUnlocked ? 'rgba(0,196,122,0.3)' : 'rgba(255,255,255,0.06)' }} />
                  <Typography sx={{
                    fontSize: '0.58rem', fontWeight: 700, whiteSpace: 'nowrap',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: justUnlocked ? '#00C47A' : 'rgba(255,255,255,0.3)',
                    transition: 'color 0.5s',
                  }}>
                    {justUnlocked ? '✅ Pronto — o que achou?' : (hasVideo && !videoRevealed ? 'Assista o vídeo acima' : 'O que achou do criativo?')}
                  </Typography>
                  <Box sx={{ flex: 1, height: '1px', bgcolor: justUnlocked ? 'rgba(0,196,122,0.3)' : 'rgba(255,255,255,0.06)' }} />
                </Box>
              )}

              {/* ── Botões ── */}
              <Box sx={{
                display: 'flex', gap: 0.8, px: 1.5,
                pt: isLocked ? 0.6 : 0.2,
                pb: 'max(env(safe-area-inset-bottom), 14px)',
              }}>

                {/* SOLICITAR ALTERAÇÃO — secundário, menor */}
                <Box
                  onClick={() => {
                    if (isLocked) return
                    setBtnPressed('reject')
                    setTimeout(() => { setBtnPressed(null); setRejectMode(true) }, 260)
                  }}
                  sx={{
                    flex: 1, borderRadius: '10px',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    py: 0.9, px: 0.8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
                    background: isLocked
                      ? 'rgba(255,68,68,0.07)'
                      : 'linear-gradient(180deg, #FF4444 0%, #BB0000 100%)',
                    border: `1px solid ${isLocked ? 'rgba(255,68,68,0.15)' : 'rgba(255,100,100,0.4)'}`,
                    opacity: isLocked ? 0.3 : 1,
                    transition: 'all 0.5s ease',
                    userSelect: 'none',
                    animation: isLocked ? 'none'
                      : btnPressed === 'reject'
                        ? 'bouncePress 0.28s cubic-bezier(0.34,1.56,0.64,1) both'
                        : 'neonPulseRed 2.2s ease-in-out infinite',
                  }}
                >
                  <CancelIcon sx={{ fontSize: 12, color: isLocked ? 'rgba(255,80,80,0.4)' : '#fff', flexShrink: 0 }} />
                  <Typography sx={{
                    fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.02em', lineHeight: 1,
                    color: isLocked ? 'rgba(255,80,80,0.4)' : '#fff',
                  }}>
                    SOLICITAR ALTERAÇÃO
                  </Typography>
                </Box>

                {/* APROVAR — primário, maior, mais vibrante */}
                <Box
                  onClick={() => {
                    if (submitting || isLocked) return
                    setBtnPressed('approve')
                    setTimeout(() => { setBtnPressed(null); submitFeedback(true) }, 260)
                  }}
                  sx={{
                    flex: 1.7, borderRadius: '10px',
                    cursor: (submitting || isLocked) ? 'default' : 'pointer',
                    py: 1.1, px: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.7,
                    background: isLocked
                      ? 'rgba(0,196,122,0.08)'
                      : 'linear-gradient(160deg, #00E080 0%, #00A855 50%, #007A40 100%)',
                    border: `1px solid ${isLocked ? 'rgba(0,196,122,0.15)' : 'rgba(0,220,130,0.5)'}`,
                    opacity: isLocked ? 0.3 : submitting ? 0.7 : 1,
                    transition: 'all 0.5s ease',
                    userSelect: 'none',
                    animation: isLocked ? 'none'
                      : justUnlocked ? 'approveGrow 0.6s cubic-bezier(0.34,1.56,0.64,1) both, unlockFlash 0.8s ease both'
                      : btnPressed === 'approve'
                        ? 'bouncePress 0.28s cubic-bezier(0.34,1.56,0.64,1) both'
                        : 'floatBtnB 3s ease-in-out infinite, neonPulseGreen 2.2s ease-in-out infinite',
                    animationDelay: (isLocked || justUnlocked || btnPressed === 'approve') ? '0s' : '0.5s, 0.5s',
                    boxShadow: isLocked ? 'none' : undefined,
                  }}
                >
                  {submitting
                    ? <CircularProgress size={16} sx={{ color: '#fff', flexShrink: 0 }} />
                    : <CheckCircleIcon sx={{
                        fontSize: isLocked ? 14 : 18,
                        color: isLocked ? 'rgba(0,196,122,0.4)' : '#fff',
                        filter: isLocked ? 'none' : 'drop-shadow(0 0 4px rgba(0,255,140,0.8))',
                        flexShrink: 0,
                        transition: 'font-size 0.4s',
                      }} />
                  }
                  <Typography sx={{
                    fontSize: isLocked ? '0.68rem' : '0.85rem',
                    fontWeight: 900,
                    letterSpacing: '0.03em',
                    lineHeight: 1,
                    color: isLocked ? 'rgba(0,196,122,0.4)' : '#fff',
                    textShadow: isLocked ? 'none' : '0 0 8px rgba(0,255,140,0.6)',
                    transition: 'font-size 0.4s, color 0.4s',
                  }}>
                    {submitting ? 'ENVIANDO...' : 'APROVAR ✓'}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )
        })()}

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
