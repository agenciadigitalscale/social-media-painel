import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import {
  Box, Dialog, IconButton, Typography, Chip, ToggleButtonGroup, ToggleButton, Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import GridViewIcon from '@mui/icons-material/GridView'
import SlideshowIcon from '@mui/icons-material/Slideshow'
import SpeedIcon from '@mui/icons-material/Speed'
import type { ContentItem, ItemState } from '../types'
import { STATUS_CONFIG } from '../types'
import { getCardPreview } from '../lib/mediaLinks'
import { useMediaLinks } from '../lib/useMediaLinks'

interface Props {
  open: boolean
  onClose: () => void
  items: ContentItem[]
  states: Record<number, ItemState>
  clientColors?: Record<string, string>
}

const TYPE_COLOR: Record<string, string> = { Post: '#3B82F6', Reel: '#3B82F6', Story: '#7C5CFC', Carrossel: '#31D17C', Feed: '#FB7185' }
const TYPE_EMOJI: Record<string, string> = { Post: '🖼️', Reel: '🎬', Story: '📱', Carrossel: '📑', Feed: '📷' }
const SPEEDS = [3000, 5000, 8000, 12000]
const SPEED_LABELS = ['3s', '5s', '8s', '12s']


export default function PresentationMode({ open, onClose, items, states, clientColors }: Props) {
  const mediaLinks = useMediaLinks()
  const clients = useMemo(() => Array.from(new Set(items.map(i => i.c))).sort(), [items])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'published'>('approved')
  const [mode, setMode] = useState<'grid' | 'slideshow'>('grid')
  const [slideIdx, setSlideIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speedIdx, setSpeedIdx] = useState(1)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const client = selectedClient || clients[0] || ''
  const clientColor = clientColors?.[client] ?? '#3B82F6'

  const filtered = useMemo(() => {
    return items
      .filter(i => i.c === client)
      .filter(i => {
        const st = states[i.i]?.status ?? i.s
        if (filterStatus === 'approved')  return st === 5 || st === 7
        if (filterStatus === 'published') return st === 7
        return true
      })
      .sort((a, b) => a.dt.getTime() - b.dt.getTime())
  }, [items, states, client, filterStatus])

  const slide = filtered[slideIdx] ?? null
  const slideSt  = slide ? (states[slide.i]?.status ?? slide.s) : 0
  // Mesma regra dos cards: prévia só com vínculo explícito na pasta Publicar
  const slidePreview = slide ? getCardPreview(slide, mediaLinks, slideSt) : { kind: 'none' as const }
  const slideTitle = slide ? (states[slide.i]?.title || slide.n) : ''

  const stopTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null }
  }, [])

  const startTimers = useCallback(() => {
    stopTimers()
    setProgress(0)
    const speed = SPEEDS[speedIdx]
    const tick = 50
    let elapsed = 0
    progressRef.current = setInterval(() => {
      elapsed += tick
      setProgress(Math.min((elapsed / speed) * 100, 100))
    }, tick)
    timerRef.current = setInterval(() => {
      setSlideIdx(i => {
        const next = i + 1
        return next >= filtered.length ? 0 : next
      })
      elapsed = 0
      setProgress(0)
    }, speed)
  }, [speedIdx, filtered.length, stopTimers])

  useEffect(() => {
    if (playing && mode === 'slideshow' && filtered.length > 0) {
      startTimers()
    } else {
      stopTimers()
      setProgress(0)
    }
    return stopTimers
  }, [playing, mode, filtered.length, speedIdx, startTimers, stopTimers])

  // Reset slide index when client/filter changes
  useEffect(() => { setSlideIdx(0); setProgress(0) }, [client, filterStatus])

  // Keyboard navigation
  useEffect(() => {
    if (!open || mode !== 'slideshow') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        setSlideIdx(i => (i + 1) % Math.max(filtered.length, 1))
        setProgress(0)
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setSlideIdx(i => (i - 1 + filtered.length) % Math.max(filtered.length, 1))
        setProgress(0)
      }
      if (e.key === 'p' || e.key === 'P') setPlaying(p => !p)
      if (e.key === 'Escape') { setPlaying(false); setMode('grid') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, mode, filtered.length])

  // Reset when dialog closes
  useEffect(() => {
    if (!open) { setPlaying(false); setMode('grid'); setSlideIdx(0); setProgress(0) }
  }, [open])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{ sx: { bgcolor: '#050912', backgroundImage: 'none' } }}
    >
      {/* ── Header ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2,
        px: { xs: 2, md: 4 }, py: 2,
        borderBottom: `1px solid ${clientColor}30`,
        background: `linear-gradient(135deg, #0f0f0f 0%, ${clientColor}08 100%)`,
        flexWrap: 'wrap', flexShrink: 0,
      }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.52rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 1, mb: 0.2 }}>
            Modo Apresentação
          </Typography>
          <Typography sx={{ fontWeight: 900, fontSize: { xs: '1rem', md: '1.4rem' }, color: clientColor, lineHeight: 1.1 }} noWrap>
            {client}
          </Typography>
        </Box>

        {/* Client selector */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', flex: 1, maxWidth: { xs: '100%', md: '45%' } }}>
          {clients.map(c => (
            <Chip key={c} label={c} size="small"
              onClick={() => { setSelectedClient(c); setPlaying(false) }}
              variant={c === client ? 'filled' : 'outlined'}
              sx={{
                fontSize: '0.58rem', height: 20, cursor: 'pointer',
                bgcolor: c === client ? `${clientColors?.[c] ?? '#3B82F6'}22` : 'transparent',
                borderColor: c === client ? (clientColors?.[c] ?? '#3B82F6') : 'rgba(255,255,255,0.12)',
                color: c === client ? (clientColors?.[c] ?? '#3B82F6') : 'text.secondary',
                fontWeight: c === client ? 700 : 400,
              }}
            />
          ))}
        </Box>

        {/* Filter */}
        <ToggleButtonGroup size="small" value={filterStatus} exclusive onChange={(_, v) => v && setFilterStatus(v)}>
          <ToggleButton value="all"       sx={{ fontSize: '0.58rem', px: 1.2, py: 0.3 }}>Todos</ToggleButton>
          <ToggleButton value="approved"  sx={{ fontSize: '0.58rem', px: 1.2, py: 0.3, color: '#31D17C' }}>✅ Aprovados</ToggleButton>
          <ToggleButton value="published" sx={{ fontSize: '0.58rem', px: 1.2, py: 0.3, color: '#31D17C' }}>🚀 Publicados</ToggleButton>
        </ToggleButtonGroup>

        {/* View mode */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Grid">
            <IconButton size="small" onClick={() => { setMode('grid'); setPlaying(false) }}
              sx={{ color: mode === 'grid' ? clientColor : 'text.disabled', bgcolor: mode === 'grid' ? `${clientColor}15` : 'transparent', borderRadius: 1.5 }}>
              <GridViewIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Slideshow (← → Space P)">
            <IconButton size="small" onClick={() => setMode('slideshow')}
              sx={{ color: mode === 'slideshow' ? clientColor : 'text.disabled', bgcolor: mode === 'slideshow' ? `${clientColor}15` : 'transparent', borderRadius: 1.5 }}>
              <SlideshowIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <IconButton onClick={onClose} sx={{ color: 'text.disabled' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* ── Stats bar ── */}
      <Box sx={{ display: 'flex', gap: { xs: 2, md: 3 }, px: { xs: 2, md: 4 }, py: 1.2, borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0, flexWrap: 'wrap' }}>
        {[
          { label: 'Exibindo', value: filtered.length, color: clientColor },
          { label: 'Publicados', value: filtered.filter(i => (states[i.i]?.status ?? i.s) === 7).length, color: '#31D17C' },
          { label: 'Aprovados', value: filtered.filter(i => (states[i.i]?.status ?? i.s) === 5).length, color: '#60A5FA' },
          { label: 'Posts', value: filtered.filter(i => i.tp === 'Post').length, color: '#3B82F6' },
          { label: 'Reels', value: filtered.filter(i => i.tp === 'Reel').length, color: '#3B82F6' },
        ].map(({ label, value, color }) => (
          <Box key={label} sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 900, color, lineHeight: 1 }}>{value}</Typography>
            <Typography sx={{ fontSize: '0.5rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</Typography>
          </Box>
        ))}
        {mode === 'slideshow' && filtered.length > 0 && (
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
              {slideIdx + 1} / {filtered.length}
            </Typography>
          </Box>
        )}
      </Box>

      {/* ── GRID mode ── */}
      {mode === 'grid' && (
        <Box sx={{
          flex: 1, overflowY: 'auto', p: { xs: 2, md: 3 },
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(4,1fr)', lg: 'repeat(5,1fr)', xl: 'repeat(7,1fr)' },
          gap: 1.5, alignContent: 'start',
        }}>
          {filtered.map((item, idx) => {
            const st      = states[item.i]?.status ?? item.s
            const preview = getCardPreview(item, mediaLinks, st)
            const title   = states[item.i]?.title || item.n
            const cfg     = STATUS_CONFIG[st as keyof typeof STATUS_CONFIG]
            return (
              <Box key={item.i}
                onClick={() => { setSlideIdx(idx); setMode('slideshow') }}
                sx={{
                  borderRadius: 2.5, border: `1px solid ${cfg.color}25`,
                  bgcolor: `${cfg.color}06`, overflow: 'hidden', cursor: 'pointer',
                  transition: 'transform 0.18s, box-shadow 0.18s',
                  '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 8px 24px ${cfg.color}20`, border: `1px solid ${cfg.color}50` },
                }}>
                <Box sx={{
                  width: '100%', aspectRatio: item.tp === 'Story' ? '9/16' : '1/1',
                  bgcolor: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', overflow: 'hidden', position: 'relative',
                }}>
                  {preview.kind === 'ready' ? (
                    <Box component="img"
                      src={preview.thumbUrl}
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none' }}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Typography sx={{ fontSize: '1.8rem', opacity: 0.15 }}>{TYPE_EMOJI[item.tp] ?? '🖼️'}</Typography>
                  )}
                  <Box sx={{ position: 'absolute', top: 5, right: 5, width: 7, height: 7, borderRadius: '50%', bgcolor: cfg.color, boxShadow: `0 0 5px ${cfg.color}` }} />
                  <Box sx={{ position: 'absolute', bottom: 5, left: 5, px: 0.6, py: 0.15, borderRadius: 0.8, bgcolor: `${TYPE_COLOR[item.tp] ?? '#3B82F6'}22`, border: `1px solid ${TYPE_COLOR[item.tp] ?? '#3B82F6'}44` }}>
                    <Typography sx={{ fontSize: '0.44rem', color: TYPE_COLOR[item.tp] ?? '#3B82F6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.tp}</Typography>
                  </Box>
                </Box>
                <Box sx={{ p: 0.9 }}>
                  <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, lineHeight: 1.3, mb: 0.3 }} noWrap>{title}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>
                      {item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </Typography>
                    <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, color: cfg.color }}>{cfg.emoji}</Typography>
                  </Box>
                </Box>
              </Box>
            )
          })}
          {filtered.length === 0 && (
            <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 10 }}>
              <Typography sx={{ color: 'text.disabled', fontSize: '0.9rem' }}>Nenhum conteúdo para exibir.</Typography>
              <Typography sx={{ color: 'text.disabled', fontSize: '0.72rem', mt: 0.5 }}>Mude o filtro de status ou selecione outro cliente.</Typography>
            </Box>
          )}
        </Box>
      )}

      {/* ── SLIDESHOW mode ── */}
      {mode === 'slideshow' && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {filtered.length === 0 ? (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ color: 'text.disabled', fontSize: '0.9rem' }}>Nenhum conteúdo para exibir.</Typography>
            </Box>
          ) : (
            <>
              {/* Main slide */}
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>

                {/* Background glow */}
                <Box sx={{
                  position: 'absolute', inset: 0, pointerEvents: 'none',
                  background: `radial-gradient(ellipse at 50% 40%, ${clientColor}12 0%, transparent 65%)`,
                }} />

                {/* Slide card */}
                <Box sx={{
                  display: 'flex', flexDirection: { xs: 'column', md: 'row' },
                  alignItems: 'center', gap: { xs: 3, md: 5 },
                  px: { xs: 3, md: 8, lg: 12 }, py: { xs: 4, md: 0 },
                  maxWidth: 1200, width: '100%', mx: 'auto', zIndex: 1,
                }}>
                  {/* Image / placeholder */}
                  <Box sx={{
                    flexShrink: 0,
                    width: { xs: '100%', md: slide?.tp === 'Story' ? 280 : 380 },
                    maxWidth: { xs: 340, md: 'none' },
                    aspectRatio: slide?.tp === 'Story' ? '9/16' : '4/5',
                    borderRadius: 3, overflow: 'hidden',
                    border: `2px solid ${clientColor}30`,
                    boxShadow: `0 0 60px ${clientColor}18, 0 20px 60px rgba(0,0,0,0.6)`,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                  }}>
                    {slidePreview.kind === 'ready' ? (
                      <Box component="img"
                        src={slidePreview.thumbUrl}
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none' }}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <Typography sx={{ fontSize: '4rem', opacity: 0.12 }}>{slide ? TYPE_EMOJI[slide.tp] ?? '🖼️' : '🖼️'}</Typography>
                    )}
                  </Box>

                  {/* Info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Chip
                      label={slide ? `${TYPE_EMOJI[slide.tp]} ${slide.tp}` : ''}
                      size="small"
                      sx={{ mb: 2, fontSize: '0.65rem', fontWeight: 700, bgcolor: `${TYPE_COLOR[slide?.tp ?? 'Post']}18`, color: TYPE_COLOR[slide?.tp ?? 'Post'], border: `1px solid ${TYPE_COLOR[slide?.tp ?? 'Post']}35` }}
                    />
                    <Typography sx={{
                      fontSize: { xs: '1.4rem', md: '1.8rem', lg: '2.2rem' },
                      fontWeight: 900, lineHeight: 1.2, letterSpacing: '-0.02em', mb: 1.5,
                      color: 'rgba(255,255,255,0.92)',
                    }}>
                      {slideTitle}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
                      {slide && (
                        <Chip
                          label={`${STATUS_CONFIG[slideSt as keyof typeof STATUS_CONFIG]?.emoji} ${STATUS_CONFIG[slideSt as keyof typeof STATUS_CONFIG]?.label}`}
                          size="small"
                          sx={{ fontSize: '0.62rem', fontWeight: 700,
                            bgcolor: `${STATUS_CONFIG[slideSt as keyof typeof STATUS_CONFIG]?.color}18`,
                            color: STATUS_CONFIG[slideSt as keyof typeof STATUS_CONFIG]?.color,
                            border: `1px solid ${STATUS_CONFIG[slideSt as keyof typeof STATUS_CONFIG]?.color}35` }}
                        />
                      )}
                      {slide && (
                        <Chip
                          label={slide.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                          size="small"
                          sx={{ fontSize: '0.62rem', color: 'text.secondary', bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                      )}
                    </Box>

                    {states[slide?.i ?? -1]?.caption && (
                      <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6,
                        fontStyle: 'italic', maxWidth: 480,
                        display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        "{states[slide!.i].caption}"
                      </Typography>
                    )}

                    <Box sx={{ display: 'flex', gap: 1, mt: 3, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontSize: '0.85rem', color: clientColor, fontWeight: 900 }}>{client}</Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Prev/Next arrows */}
                <IconButton
                  onClick={() => { setSlideIdx(i => (i - 1 + filtered.length) % filtered.length); setProgress(0) }}
                  sx={{
                    position: 'absolute', left: { xs: 8, md: 24 }, top: '50%', transform: 'translateY(-50%)',
                    bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    '&:hover': { bgcolor: `${clientColor}18` },
                  }}>
                  <ArrowBackIosNewIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.6)' }} />
                </IconButton>
                <IconButton
                  onClick={() => { setSlideIdx(i => (i + 1) % filtered.length); setProgress(0) }}
                  sx={{
                    position: 'absolute', right: { xs: 8, md: 24 }, top: '50%', transform: 'translateY(-50%)',
                    bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    '&:hover': { bgcolor: `${clientColor}18` },
                  }}>
                  <ArrowForwardIosIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.6)' }} />
                </IconButton>
              </Box>

              {/* Controls bar */}
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 3, py: 1.5, borderTop: '1px solid rgba(255,255,255,0.05)',
                flexShrink: 0, flexWrap: 'wrap',
              }}>
                {/* Play/Pause */}
                <Tooltip title={playing ? 'Pausar (P)' : 'Auto-play (P)'}>
                  <IconButton onClick={() => setPlaying(p => !p)}
                    sx={{ bgcolor: playing ? `${clientColor}18` : 'rgba(255,255,255,0.06)', border: `1px solid ${playing ? clientColor : 'rgba(255,255,255,0.1)'}30`, color: playing ? clientColor : 'text.secondary', borderRadius: 2 }}>
                    {playing ? <PauseIcon sx={{ fontSize: 20 }} /> : <PlayArrowIcon sx={{ fontSize: 20 }} />}
                  </IconButton>
                </Tooltip>

                {/* Speed selector */}
                <Tooltip title="Velocidade do slideshow">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}
                    onClick={() => setSpeedIdx(i => (i + 1) % SPEEDS.length)}>
                    <SpeedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', fontWeight: 700 }}>{SPEED_LABELS[speedIdx]}</Typography>
                  </Box>
                </Tooltip>

                {/* Progress bar */}
                <Box sx={{ flex: 1, height: 3, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{
                    height: '100%', bgcolor: clientColor, borderRadius: 2,
                    width: `${playing ? progress : (((slideIdx + 1) / filtered.length) * 100)}%`,
                    transition: playing ? 'none' : 'width 0.3s ease',
                  }} />
                </Box>

                {/* Slide counter + dots */}
                <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', fontWeight: 700, flexShrink: 0 }}>
                  {slideIdx + 1} / {filtered.length}
                </Typography>

                {/* Dot indicators (max 20) */}
                {filtered.length <= 20 && (
                  <Box sx={{ display: 'flex', gap: 0.3, flexShrink: 0 }}>
                    {filtered.map((_, i) => (
                      <Box key={i} onClick={() => { setSlideIdx(i); setProgress(0) }} sx={{
                        width: i === slideIdx ? 16 : 6, height: 6, borderRadius: 3,
                        bgcolor: i === slideIdx ? clientColor : 'rgba(255,255,255,0.15)',
                        cursor: 'pointer', transition: 'all 0.2s ease',
                        '&:hover': { bgcolor: i === slideIdx ? clientColor : 'rgba(255,255,255,0.35)' },
                      }} />
                    ))}
                  </Box>
                )}

                {/* Keyboard hint */}
                <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.18)', flexShrink: 0, display: { xs: 'none', md: 'block' } }}>
                  ← → Navegar · Space Avançar · P Play/Pause · Esc Voltar ao grid
                </Typography>

                {/* Back to grid */}
                <Tooltip title="Voltar ao grid">
                  <IconButton size="small" onClick={() => { setMode('grid'); setPlaying(false) }}
                    sx={{ color: 'text.disabled', '&:hover': { color: clientColor } }}>
                    <GridViewIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </>
          )}
        </Box>
      )}
    </Dialog>
  )
}
