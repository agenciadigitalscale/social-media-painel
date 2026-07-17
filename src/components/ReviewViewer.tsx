import { useState, useEffect, useRef } from 'react'
import {
  Box, Typography, Button, TextField, CircularProgress,
  ThemeProvider, CssBaseline, Chip,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import theme from '../theme'
import { DATA, DATA_JULHO } from '../data'
import { NAME_MAP, getDisplayName } from '../lib/users'
import type { ContentItem, ItemState, ContentType } from '../types'

function extractDriveFileId(url: string): string | null {
  return (url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ?? url.match(/[?&]id=([a-zA-Z0-9_-]+)/))?.[1] ?? null
}

function extractStreamableId(url: string): string | null {
  return url.match(/streamable\.com\/(?:e\/)?([a-zA-Z0-9]+)/)?.[1] ?? null
}

function deserializeItem(raw: Record<string, unknown>): ContentItem {
  return { ...raw, dt: new Date(raw.dt as string) } as ContentItem
}

// Segundos → "M:SS" para ancorar o ajuste no ponto do vídeo.
function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

interface Props {
  token: string
  itemId: number
}

interface ReviewEntry { approved: boolean; text: string; reviewer: string; date: string }

const REVIEWER_KEY = 'sm_review_reviewer'

export default function ReviewViewer({ token, itemId }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [item, setItem]       = useState<ContentItem | null>(null)
  const [link, setLink]       = useState('')
  const [title, setTitle]     = useState('')
  const [existing, setExisting] = useState<ReviewEntry | null>(null)

  const [reviewer, setReviewer]   = useState(() => localStorage.getItem(REVIEWER_KEY) ?? '')
  const [videoNativeError, setVideoNativeError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  // Segundo do vídeo capturado ao pedir ajuste — ancora o comentário no ponto.
  const [adjustTime, setAdjustTime] = useState<number | null>(null)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectText, setRejectText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]             = useState<'ok' | 'fix' | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [reviewRes, syncRes] = await Promise.all([
          fetch(`/api/review?token=${token}&itemId=${itemId}`).then(r => r.json()),
          fetch('/api/sync').then(r => r.json()),
        ])

        if (!reviewRes.ok) {
          setError(reviewRes.error === 'Invalid token'
            ? 'Link de revisão inválido ou substituído. Peça um novo no board.'
            : 'Erro ao carregar a revisão.')
          setLoading(false)
          return
        }
        if (reviewRes.review) setExisting(reviewRes.review as ReviewEntry)

        const syncMap: Record<string, unknown> = {}
        if (syncRes.ok && Array.isArray(syncRes.data)) {
          syncRes.data.forEach(({ key, value }: { key: string; value: string }) => {
            try { syncMap[key] = JSON.parse(value) } catch { /* chave corrompida — ignora */ }
          })
        }

        const states    = (syncMap['sm_states'] ?? {}) as Record<string, ItemState>
        const itemState = states[String(itemId)]
        setLink(itemState?.link || itemState?.footageLink || '')
        setTitle(itemState?.title || '')

        const customItems = ((syncMap['sm_custom'] ?? []) as Record<string, unknown>[]).map(deserializeItem)
        const deletedIds  = new Set((syncMap['sm_deleted'] ?? []) as number[])
        const found       = [...DATA, ...DATA_JULHO, ...customItems].filter(i => !deletedIds.has(i.i)).find(i => i.i === itemId)
        if (!found) {
          setError('Conteúdo não encontrado.')
          setLoading(false)
          return
        }

        const edits = (syncMap['sm_edits'] ?? {}) as Record<string, { dt?: string; tp?: string; n?: string }>
        const edit  = edits[String(itemId)]
        setItem(edit ? {
          ...found,
          ...(edit.tp ? { tp: edit.tp as ContentType } : {}),
          ...(edit.n  ? { n: edit.n } : {}),
          dt: edit.dt ? new Date(edit.dt) : found.dt,
        } : found)
        setLoading(false)
      } catch {
        setError('Falha de conexão. Tente novamente.')
        setLoading(false)
      }
    }
    load()
  }, [token, itemId])

  // Pedir ajuste: pausa o vídeo e fixa o segundo atual, pra ancorar o comentário.
  const enterRejectMode = () => {
    const v = videoRef.current
    if (v && !videoNativeError && Number.isFinite(v.currentTime) && v.currentTime > 0) {
      v.pause()
      setAdjustTime(v.currentTime)
    } else {
      setAdjustTime(null)
    }
    setRejectMode(true)
  }

  const submit = async (approved: boolean) => {
    if (submitting) return
    setSubmitting(true)
    // Ancora o ajuste no ponto do vídeo: "⏱️ 0:12 · <texto>".
    const anchored = adjustTime != null
      ? `⏱️ ${fmtTime(adjustTime)} · ${rejectText.trim()}`
      : rejectText.trim()
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'decide',
          token, itemId, approved,
          text: approved ? '' : anchored,
          reviewer: getDisplayName(reviewer),
        }),
      })
      const data = await res.json() as { ok: boolean }
      if (!data.ok) { setError('Não foi possível registrar a decisão.'); setSubmitting(false); return }
      localStorage.setItem(REVIEWER_KEY, reviewer)
      setDone(approved ? 'ok' : 'fix')
    } catch {
      setError('Falha de conexão ao enviar a decisão.')
    }
    setSubmitting(false)
  }

  const shell = (children: React.ReactNode) => (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{
        minHeight: '100dvh', bgcolor: '#050912',
        display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2,
      }}>
        {children}
      </Box>
    </ThemeProvider>
  )

  if (loading) return shell(<CircularProgress sx={{ color: '#3B82F6' }} />)

  if (error) return shell(
    <Box sx={{ textAlign: 'center', maxWidth: 320 }}>
      <Box component="img" src="/logotipo.png" sx={{ height: 30, opacity: 0.6, mb: 2 }} />
      <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>{error}</Typography>
    </Box>
  )

  const decided = done ?? (existing ? (existing.approved ? 'ok' : 'fix') : null)
  if (decided) return shell(
    <Box sx={{
      textAlign: 'center', maxWidth: 360, width: '100%',
      p: 3.5, borderRadius: '20px',
      bgcolor: '#0A1120', border: `1px solid ${decided === 'ok' ? 'rgba(49,209,124,0.28)' : 'rgba(245,158,11,0.28)'}`,
      boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
    }}>
      <Typography sx={{ fontSize: '2.6rem', lineHeight: 1, mb: 1 }}>{decided === 'ok' ? '🎉' : '🔄'}</Typography>
      <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#fff', mb: 0.6 }}>
        {decided === 'ok' ? 'Aprovado na revisão interna' : 'Ajuste solicitado'}
      </Typography>
      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
        {decided === 'ok'
          ? 'O card foi para “Pronto p/ enviar” — agora é só mandar pro cliente.'
          : 'O card voltou para “Em produção” com o motivo registrado.'}
      </Typography>
      {existing && (
        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', mt: 1.6 }}>
          por {existing.reviewer} · {new Date(existing.date).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {existing.text ? ` · “${existing.text}”` : ''}
        </Typography>
      )}
    </Box>
  )

  const streamableId = extractStreamableId(link)
  const driveId      = extractDriveFileId(link)
  const embedUrl     = streamableId ? `https://streamable.com/e/${streamableId}`
                     : driveId      ? `https://drive.google.com/file/d/${driveId}/preview`
                     : ''
  const imageUrl     = !embedUrl && driveId ? `https://lh3.googleusercontent.com/d/${driveId}=w1600` : ''
  const canDecide    = !!reviewer

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{
        minHeight: '100dvh', bgcolor: '#050912',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        px: 2, py: 2.5,
      }}>
        <Box sx={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 1.6 }}>

          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box component="img" src="/logotipo.png" sx={{ height: 22, opacity: 0.9 }} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{
                fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: '#06B6D4',
              }}>
                Revisão interna
              </Typography>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)' }}>{item?.c}</Typography>
            </Box>
            <Chip label={item?.tp ?? ''} size="small" sx={{
              height: 20, fontSize: '0.55rem', fontWeight: 700,
              bgcolor: 'rgba(59,130,246,0.12)', color: '#3B82F6',
              border: '1px solid rgba(59,130,246,0.3)',
            }} />
          </Box>

          <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>
            {title || item?.n}
          </Typography>

          {/* Player / criativo */}
          <Box sx={{
            position: 'relative', width: '100%', aspectRatio: '9 / 16', maxHeight: '52dvh',
            borderRadius: '16px', overflow: 'hidden', bgcolor: '#000',
            border: '1px solid #1A2940',
          }}>
            {driveId && !videoNativeError ? (
              // Player nativo via proxy — no celular o iframe do Drive joga os
              // controles gigantes por cima do vídeo (quase impossível assistir).
              // O <video> nativo preenche certo e usa os controles do iOS/Android.
              // Se o proxy falhar, cai no iframe do Drive (comportamento antigo).
              <Box
                component="video"
                ref={videoRef}
                src={`/api/stream?id=${driveId}`}
                poster={`https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`}
                controls
                playsInline
                preload="auto"
                onError={() => setVideoNativeError(true)}
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', bgcolor: '#000', border: 0 }}
              />
            ) : embedUrl ? (
              <Box component="iframe" src={embedUrl} allow="autoplay; fullscreen" allowFullScreen
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
            ) : imageUrl ? (
              <Box component="img" src={imageUrl} alt={title}
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Box sx={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 1, px: 3, textAlign: 'center',
              }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
                  Nenhum arquivo anexado ao card ainda.
                </Typography>
              </Box>
            )}
          </Box>

          {link && (
            <Button href={link} target="_blank" rel="noopener" size="small" sx={{
              alignSelf: 'flex-start', fontSize: '0.6rem', fontWeight: 700,
              color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#3B82F6' },
            }}>
              Abrir arquivo original ↗
            </Button>
          )}

          {/* Quem está revisando */}
          <Box>
            <Typography sx={{
              fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', mb: 0.8,
            }}>
              Quem está revisando
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7 }}>
              {Object.entries(NAME_MAP).map(([key, u]) => {
                const active = reviewer === key
                return (
                  <Box key={key} onClick={() => setReviewer(key)} sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    px: 1.1, py: 0.55, borderRadius: '8px', cursor: 'pointer',
                    bgcolor: active ? `${u.color}1c` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? `${u.color}55` : 'rgba(148,163,184,0.12)'}`,
                    boxShadow: active ? `0 4px 16px ${u.glow}` : 'none',
                    transition: 'all 0.18s ease',
                    '&:hover': { bgcolor: active ? `${u.color}24` : 'rgba(255,255,255,0.06)' },
                  }}>
                    <Typography sx={{ fontSize: '0.7rem', lineHeight: 1 }}>{u.emoji}</Typography>
                    <Typography sx={{
                      fontSize: '0.62rem', fontWeight: 700, lineHeight: 1,
                      color: active ? u.color : 'rgba(255,255,255,0.5)',
                    }}>
                      {getDisplayName(key)}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
          </Box>

          {/* Decisão */}
          {!rejectMode ? (
            <Box sx={{ display: 'flex', gap: 0.8, mt: 0.4 }}>
              <Box onClick={() => canDecide && enterRejectMode()} sx={{
                flex: 1, borderRadius: '12px', py: 1.2,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6,
                cursor: canDecide ? 'pointer' : 'not-allowed',
                opacity: canDecide ? 1 : 0.35,
                background: 'linear-gradient(180deg, #FF4444 0%, #BB0000 100%)',
                border: '1px solid rgba(255,100,100,0.4)',
                boxShadow: canDecide ? '0 6px 20px rgba(239,68,68,0.28)' : 'none',
                transition: 'all 0.18s ease',
                '&:hover': canDecide ? { filter: 'brightness(1.08)', transform: 'translateY(-1px)' } : {},
              }}>
                <CancelIcon sx={{ fontSize: 14, color: '#fff' }} />
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>
                  PEDIR AJUSTE
                </Typography>
              </Box>

              <Box onClick={() => canDecide && submit(true)} sx={{
                flex: 1.7, borderRadius: '12px', py: 1.2,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.7,
                cursor: canDecide && !submitting ? 'pointer' : 'not-allowed',
                opacity: canDecide ? (submitting ? 0.7 : 1) : 0.35,
                background: 'linear-gradient(160deg, #00E080 0%, #00A855 50%, #007A40 100%)',
                border: '1px solid rgba(0,220,130,0.5)',
                boxShadow: canDecide ? '0 6px 22px rgba(49,209,124,0.32)' : 'none',
                transition: 'all 0.18s ease',
                '&:hover': canDecide && !submitting ? { filter: 'brightness(1.08)', transform: 'translateY(-1px)' } : {},
              }}>
                {submitting
                  ? <CircularProgress size={16} sx={{ color: '#fff' }} />
                  : <CheckCircleIcon sx={{ fontSize: 18, color: '#fff', filter: 'drop-shadow(0 0 4px rgba(0,255,140,0.8))' }} />}
                <Typography sx={{
                  fontSize: '0.85rem', fontWeight: 900, color: '#fff',
                  textShadow: '0 0 8px rgba(0,255,140,0.6)', letterSpacing: '0.03em',
                }}>
                  {submitting ? 'ENVIANDO...' : 'APROVAR ✓'}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{
              p: 1.6, borderRadius: '14px',
              bgcolor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.28)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.8, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#EF4444' }}>
                  O que precisa ser ajustado?
                </Typography>
                {adjustTime != null && (
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.4,
                    px: 0.8, py: 0.2, borderRadius: '6px',
                    bgcolor: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.35)',
                  }}>
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: '#F59E0B', fontVariantNumeric: 'tabular-nums' }}>
                      ⏱️ {fmtTime(adjustTime)}
                    </Typography>
                  </Box>
                )}
              </Box>
              {adjustTime != null && (
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)', mb: 0.8, lineHeight: 1.5 }}>
                  Ajuste ancorado nesse ponto do vídeo — a equipe vê onde é.
                </Typography>
              )}
              <TextField
                autoFocus fullWidth multiline minRows={2} maxRows={5} size="small"
                placeholder="Ex: cortar os 2s do começo, trocar a trilha, legenda com erro..."
                value={rejectText}
                onChange={e => setRejectText(e.target.value)}
                sx={{ mb: 1 }}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" onClick={() => { setRejectMode(false); setRejectText(''); setAdjustTime(null) }}
                  sx={{ color: 'rgba(255,255,255,0.35)' }}>Cancelar</Button>
                <Button size="small" variant="contained" color="error"
                  disabled={submitting || !rejectText.trim()}
                  onClick={() => submit(false)}
                  sx={{ flex: 1, fontWeight: 700 }}>
                  {submitting ? 'Enviando...' : 'Confirmar ajuste'}
                </Button>
              </Box>
            </Box>
          )}

          {!canDecide && (
            <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
              Selecione seu nome acima para liberar a decisão
            </Typography>
          )}
        </Box>
      </Box>
    </ThemeProvider>
  )
}
