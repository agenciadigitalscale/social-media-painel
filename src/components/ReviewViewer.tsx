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
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoCurrent,  setVideoCurrent]  = useState(0)
  const [rejectMode, setRejectMode] = useState(false)
  // Comentários ancorados no segundo do vídeo (estilo Frame.io). O ponto do
  // próximo comentário é sempre o playhead atual (videoCurrent).
  const [notes, setNotes] = useState<{ t: number; text: string }[]>([])
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

  const hasNativeVideo = () => {
    const v = videoRef.current
    return !!(v && !videoNativeError && Number.isFinite(v.currentTime))
  }
  // Ponto onde o próximo comentário vai cair = playhead atual.
  const pointNow = () => (hasNativeVideo() ? (videoRef.current?.currentTime ?? 0) : 0)

  // Pedir ajuste: pausa o vídeo (o ponto fica fixo enquanto escreve).
  const enterRejectMode = () => {
    if (hasNativeVideo()) videoRef.current?.pause()
    setRejectMode(true)
  }

  // Pula o vídeo para um ponto já comentado.
  const seekTo = (t: number) => {
    const v = videoRef.current
    if (hasNativeVideo() && v) { v.currentTime = t; setVideoCurrent(t); v.pause() }
  }

  // Fixa o comentário atual no playhead e limpa o campo pra comentar em outro ponto.
  const addNote = () => {
    const text = rejectText.trim()
    if (!text) return
    setNotes(prev => [...prev, { t: pointNow(), text }].sort((a, b) => a.t - b.t))
    setRejectText('')
  }

  const submit = async (approved: boolean) => {
    if (submitting) return
    // Junta os comentários já fixados + o rascunho ainda no campo.
    const all = [...notes]
    const draft = rejectText.trim()
    if (draft) all.push({ t: pointNow(), text: draft })
    all.sort((a, b) => a.t - b.t)
    const anchored = all
      .map(n => n.t > 0 ? `⏱️ ${fmtTime(n.t)} · ${n.text}` : n.text)
      .join('\n')
    setSubmitting(true)
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
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: { md: 'center' },
        px: 2, py: 2.5,
      }}>
        {/* Mobile: uma coluna. Desktop: vídeo+contexto à esquerda, ação à direita. */}
        <Box sx={{
          width: '100%', maxWidth: { xs: 460, md: 980 },
          display: 'flex', flexDirection: { xs: 'column', md: 'row' },
          alignItems: { md: 'flex-start' }, gap: { xs: 1.6, md: 3 },
        }}>
          {/* ── COLUNA ESQUERDA — criativo + contexto ── */}
          <Box sx={{ width: { xs: '100%', md: 400 }, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1.6 }}>

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
            position: 'relative', width: '100%', aspectRatio: '9 / 16',
            maxHeight: { xs: '52dvh', md: '82dvh' },
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
                onLoadedMetadata={e => setVideoDuration((e.currentTarget as HTMLVideoElement).duration || 0)}
                onTimeUpdate={e => setVideoCurrent((e.currentTarget as HTMLVideoElement).currentTime)}
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

          {/* Trilha de marcadores — os pontos comentados sobre a duração do vídeo.
              Toque num marcador pula o vídeo pra aquele segundo. */}
          {driveId && !videoNativeError && videoDuration > 0 && (notes.length > 0 || rejectMode) && (
            <Box sx={{ px: 0.5 }}>
              <Box sx={{ position: 'relative', height: 16, display: 'flex', alignItems: 'center' }}>
                <Box sx={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 3, bgcolor: 'rgba(148,163,184,0.18)' }} />
                <Box sx={{ position: 'absolute', left: 0, height: 4, borderRadius: 3, width: `${Math.min(videoCurrent / videoDuration * 100, 100)}%`, bgcolor: 'rgba(59,130,246,0.5)' }} />
                {/* cabeça (posição atual) */}
                <Box sx={{ position: 'absolute', left: `${Math.min(videoCurrent / videoDuration * 100, 100)}%`, transform: 'translateX(-50%)', width: 9, height: 9, borderRadius: '50%', bgcolor: '#fff', boxShadow: '0 0 4px rgba(0,0,0,0.6)' }} />
                {/* marcadores dos comentários */}
                {notes.map((n, i) => (
                  <Box key={i} onClick={() => seekTo(n.t)} title={`${fmtTime(n.t)} · ${n.text}`} sx={{
                    position: 'absolute', left: `${Math.min(n.t / videoDuration * 100, 100)}%`,
                    transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: '50%',
                    bgcolor: '#F59E0B', border: '2px solid #050912', cursor: 'pointer',
                    transition: 'transform 0.15s', '&:hover': { transform: 'translateX(-50%) scale(1.25)' },
                  }} />
                ))}
              </Box>
            </Box>
          )}

          {link && (
            <Button href={link} target="_blank" rel="noopener" size="small" sx={{
              alignSelf: 'flex-start', fontSize: '0.6rem', fontWeight: 700,
              color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#3B82F6' },
            }}>
              Abrir arquivo original ↗
            </Button>
          )}
          </Box>{/* fim COLUNA ESQUERDA */}

          {/* ── COLUNA DIREITA — quem revisa + decisão ── */}
          <Box sx={{
            width: '100%', flex: { md: 1 }, minWidth: 0,
            display: 'flex', flexDirection: 'column', gap: 1.6,
            position: { md: 'sticky' }, top: { md: 8 },
          }}>

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
              {/* Comentários já fixados */}
              {notes.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.2 }}>
                  {notes.map((n, i) => (
                    <Box key={i} sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 0.7,
                      px: 0.9, py: 0.6, borderRadius: '9px',
                      bgcolor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)',
                    }}>
                      <Box onClick={() => seekTo(n.t)} sx={{
                        flexShrink: 0, mt: 0.1, px: 0.7, py: 0.15, borderRadius: '6px', cursor: 'pointer',
                        bgcolor: 'rgba(245,158,11,0.16)', border: '1px solid rgba(245,158,11,0.4)',
                      }}>
                        <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: '#F59E0B', fontVariantNumeric: 'tabular-nums' }}>
                          ⏱️ {fmtTime(n.t)}
                        </Typography>
                      </Box>
                      <Typography sx={{ flex: 1, fontSize: '0.68rem', color: '#F4F7FF', lineHeight: 1.4 }}>{n.text}</Typography>
                      <Typography onClick={() => setNotes(prev => prev.filter((_, j) => j !== i))} sx={{
                        flexShrink: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
                        px: 0.4, '&:hover': { color: '#EF4444' },
                      }}>✕</Typography>
                    </Box>
                  ))}
                </Box>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.6, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#EF4444' }}>
                  {notes.length > 0 ? 'Outro ajuste?' : 'O que precisa ser ajustado?'}
                </Typography>
                {hasNativeVideo() && (
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.4,
                    px: 0.8, py: 0.2, borderRadius: '6px',
                    bgcolor: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.35)',
                  }}>
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: '#F59E0B', fontVariantNumeric: 'tabular-nums' }}>
                      ⏱️ {fmtTime(videoCurrent)}
                    </Typography>
                  </Box>
                )}
              </Box>
              {hasNativeVideo() && (
                <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.4)', mb: 0.8, lineHeight: 1.5 }}>
                  Cai neste ponto do vídeo. Avance o vídeo e adicione outro ponto se precisar.
                </Typography>
              )}
              <TextField
                autoFocus fullWidth multiline minRows={2} maxRows={4} size="small"
                placeholder="Ex: cortar os 2s do começo, trocar a trilha, legenda com erro..."
                value={rejectText}
                onChange={e => setRejectText(e.target.value)}
                sx={{ mb: 1 }}
              />
              {/* Adicionar este ponto e continuar */}
              {hasNativeVideo() && rejectText.trim() && (
                <Box onClick={addNote} sx={{
                  mb: 1, py: 0.7, borderRadius: '9px', textAlign: 'center', cursor: 'pointer',
                  bgcolor: 'rgba(245,158,11,0.1)', border: '1px dashed rgba(245,158,11,0.4)',
                  color: '#F59E0B', fontSize: '0.65rem', fontWeight: 800,
                  '&:hover': { bgcolor: 'rgba(245,158,11,0.16)' },
                }}>
                  + Fixar em ⏱️ {fmtTime(videoCurrent)} e comentar outro ponto
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" onClick={() => { setRejectMode(false); setRejectText(''); setNotes([]) }}
                  sx={{ color: 'rgba(255,255,255,0.35)' }}>Cancelar</Button>
                <Button size="small" variant="contained" color="error"
                  disabled={submitting || (notes.length === 0 && !rejectText.trim())}
                  onClick={() => submit(false)}
                  sx={{ flex: 1, fontWeight: 700 }}>
                  {submitting ? 'Enviando...'
                    : `Enviar ${notes.length + (rejectText.trim() ? 1 : 0)} ajuste${notes.length + (rejectText.trim() ? 1 : 0) > 1 ? 's' : ''}`}
                </Button>
              </Box>
            </Box>
          )}

          {!canDecide && (
            <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
              Selecione seu nome acima para liberar a decisão
            </Typography>
          )}
          </Box>{/* fim COLUNA DIREITA */}
        </Box>
      </Box>
    </ThemeProvider>
  )
}
