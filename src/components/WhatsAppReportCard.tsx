/*
 * WhatsAppReportCard.tsx
 * Card visual premium por cliente — exporta PNG e abre WhatsApp.
 * Poster 420×750, pixelRatio 2.5 → 1050×1875px perfeito para mobile.
 */
import { useMemo, useRef, useState } from 'react'
import {
  Dialog, Box, Typography, IconButton, Button,
  Select, MenuItem, FormControl, Tooltip, CircularProgress,
  Chip, LinearProgress,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import DownloadIcon from '@mui/icons-material/Download'
import ShareIcon from '@mui/icons-material/Share'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import { toPng } from 'html-to-image'
import type { ContentItem, ItemState, Client } from '../types'

// ── Helpers ──────────────────────────────────────────────────────────

function fmtBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('pt-BR')
}

function calcER(eng: { likes?: number; comments?: number; reach?: number } | undefined): number | null {
  if (!eng?.reach) return null
  return ((eng.likes ?? 0) + (eng.comments ?? 0)) / eng.reach * 100
}

const MONTH_NAMES_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

function perfColor(pct: number) {
  if (pct >= 85) return '#31D17C'
  if (pct >= 60) return '#F59E0B'
  return '#EF4444'
}

// ── Props ─────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  clientPhones?: Record<string, string>
  now: Date
  initialClient?: string
}

// ── Main component ────────────────────────────────────────────────────

export default function WhatsAppReportCard({
  open, onClose, items, states, allClients, clientPhones, now, initialClient,
}: Props) {
  const cardRef  = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied]       = useState(false)

  const year  = now.getFullYear()
  const month = now.getMonth()
  const monthLabel = MONTH_NAMES_PT[month]

  // ── Client selector ──────────────────────────────────────────────
  const clientNames = useMemo(() =>
    [...new Set(items.filter(i =>
      i.dt.getFullYear() === year && i.dt.getMonth() === month
    ).map(i => i.c))].sort(),
  [items, year, month])

  const firstClient = initialClient && clientNames.includes(initialClient)
    ? initialClient
    : clientNames[0] ?? ''

  const [selClient, setSelClient] = useState(firstClient)

  // ── Metrics for selected client ──────────────────────────────────
  const metrics = useMemo(() => {
    const ci = items.filter(i =>
      i.c === selClient &&
      i.dt.getFullYear() === year &&
      i.dt.getMonth() === month
    )
    const total     = ci.length
    const published = ci.filter(i => (states[i.i]?.status ?? i.s) === 7).length
    const approved  = ci.filter(i => (states[i.i]?.status ?? i.s) === 5).length
    const rejected  = ci.filter(i => (states[i.i]?.status ?? i.s) === 6).length
    const pending   = ci.filter(i => (states[i.i]?.status ?? i.s) <= 1).length
    const pubRate   = total > 0 ? Math.round(((published + approved) / total) * 100) : 0
    const posts     = ci.filter(i => i.tp === 'Post').length
    const reels     = ci.filter(i => i.tp === 'Reel').length
    const stories   = ci.filter(i => i.tp === 'Story').length
    const carrossels = ci.filter(i => i.tp === 'Carrossel').length

    // Engagement
    const withEng = ci.filter(i => (states[i.i]?.status ?? i.s) === 7 && states[i.i]?.engagement?.reach)
    const totalReach    = withEng.reduce((s, i) => s + (states[i.i].engagement?.reach    ?? 0), 0)
    const totalLikes    = withEng.reduce((s, i) => s + (states[i.i].engagement?.likes    ?? 0), 0)
    const totalComments = withEng.reduce((s, i) => s + (states[i.i].engagement?.comments ?? 0), 0)
    const erList = withEng.map(i => calcER(states[i.i].engagement)).filter((e): e is number => e !== null)
    const avgER  = erList.length > 0 ? erList.reduce((a, b) => a + b, 0) / erList.length : null

    // Best post
    const bestPost = withEng.reduce<ContentItem | null>((best, i) => {
      const e = calcER(states[i.i].engagement) ?? -1
      return !best || e > (calcER(states[best.i].engagement) ?? -1) ? i : best
    }, null)

    return {
      ci, total, published, approved, rejected, pending, pubRate,
      posts, reels, stories, carrossels,
      totalReach, totalLikes, totalComments, avgER, bestPost,
      hasEngagement: withEng.length > 0,
    }
  }, [selClient, items, states, year, month])

  // ── Export PNG ───────────────────────────────────────────────────
  const exportPng = async (download = true): Promise<string | null> => {
    if (!cardRef.current) return null
    setExporting(true)
    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: '#0c0804',
        pixelRatio: 2.5,
        style: { borderRadius: '0', fontFamily: '"Inter", system-ui, sans-serif' },
      })
      if (download) {
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = `relatorio-${selClient.replace(/\s+/g, '_')}-${monthLabel}-${year}.png`
        a.click()
      }
      return dataUrl
    } catch { return null }
    finally { setExporting(false) }
  }

  // ── Share via native API (mobile) ────────────────────────────────
  const handleShare = async () => {
    const dataUrl = await exportPng(false)
    if (!dataUrl) return
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'relatorio.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Relatório ${selClient} — ${monthLabel} ${year}` })
        return
      }
    } catch {}
    // Fallback: copy to clipboard
    try {
      const blob = await (await fetch(dataUrl)).blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      exportPng(true)
    }
  }

  // ── WhatsApp: export + open chat ─────────────────────────────────
  const handleWhatsApp = async () => {
    await exportPng(true)
    const phone = clientPhones?.[selClient] ?? ''
    const msg = [
      `Olá! 👋 Segue o relatório de *${monthLabel} ${year}* para *${selClient}*`,
      ``,
      `✅ *${metrics.published} publicações* realizadas de ${metrics.total} planejadas (${metrics.pubRate}%)`,
      metrics.totalReach > 0 ? `👁 *${fmtBig(metrics.totalReach)}* pessoas alcançadas` : '',
      metrics.avgER !== null ? `📈 *${metrics.avgER.toFixed(1)}% de engajamento médio*` : '',
      metrics.bestPost ? `🏆 Destaque: *${states[metrics.bestPost.i]?.title || metrics.bestPost.n}*` : '',
      ``,
      `A imagem com o resumo visual foi salva — é só encaminhar! 🚀`,
      ``,
      `_Digital Scale — Agência de Marketing Digital_`,
    ].filter(l => l !== undefined && (l !== '' || true)).join('\n').replace(/\n{3,}/g, '\n\n')

    const url = phone
      ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank', 'noopener')
  }

  const pColor = perfColor(metrics.pubRate)

  // ── Render ────────────────────────────────────────────────────────
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      slotProps={{
        paper: {
          sx: {
            background: 'rgba(10,10,10,0.98)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 3,
            overflow: 'hidden',
          },
        },
      }}
    >
      {/* ── Dialog toolbar ─────────────────────────────────────────── */}
      <Box sx={{
        px: 2.5, py: 1.8,
        borderBottom: '1px solid rgba(59,130,246,0.12)',
        background: 'linear-gradient(135deg, #0D1728 0%, #1c1408 60%, #0D1728 100%)',
        display: 'flex', alignItems: 'center', gap: 1.5,
      }}>
        {/* Title */}
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(59,130,246,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Relatório Visual
          </Typography>
          <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            Card para WhatsApp
          </Typography>
        </Box>

        {/* Client picker */}
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <Select
            value={selClient}
            onChange={e => setSelClient(e.target.value)}
            sx={{ fontSize: '0.78rem', height: 34, borderColor: 'rgba(255,255,255,0.12)' }}
          >
            {clientNames.map(c => (
              <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{c}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Actions */}
        <Tooltip title="Baixar PNG">
          <Button
            size="small"
            onClick={() => exportPng(true)}
            disabled={exporting}
            startIcon={exporting ? <CircularProgress size={11} color="inherit" /> : <DownloadIcon sx={{ fontSize: 14 }} />}
            sx={{ fontSize: '0.68rem', fontWeight: 700, height: 32, border: '1px solid rgba(59,130,246,0.3)', color: '#3B82F6', '&:hover': { bgcolor: 'rgba(59,130,246,0.08)' } }}
          >
            {exporting ? 'Gerando…' : 'PNG'}
          </Button>
        </Tooltip>

        <Tooltip title={copied ? 'Copiado!' : 'Compartilhar imagem'}>
          <IconButton size="small" onClick={handleShare} sx={{ color: copied ? '#31D17C' : 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>
            {copied ? <ContentCopyIcon sx={{ fontSize: 18 }} /> : <ShareIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Baixar PNG e abrir WhatsApp">
          <IconButton size="small" onClick={handleWhatsApp} sx={{ color: '#25D366', '&:hover': { bgcolor: 'rgba(37,211,102,0.1)' } }}>
            <WhatsAppIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.4)' }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* ── Card preview area ───────────────────────────────────────── */}
      <Box sx={{
        p: 3, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        overflowY: 'auto', maxHeight: 'calc(100vh - 120px)',
        background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 10px)',
      }}>

        {/* ════════════════════════════════════════════════
            THE CARD — this is what gets exported as PNG
            Width: 420px fixed, height auto
            ════════════════════════════════════════════════ */}
        <Box
          ref={cardRef}
          sx={{
            width: 420,
            background: 'linear-gradient(160deg, #0c0804 0%, #111111 45%, #0e0c0a 100%)',
            borderRadius: 3,
            overflow: 'hidden',
            position: 'relative',
            fontFamily: '"Inter", system-ui, sans-serif',
            boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(59,130,246,0.12)',
          }}
        >
          {/* ── Ambient orange glow top-right ── */}
          <Box sx={{
            position: 'absolute', top: -60, right: -60,
            width: 240, height: 240, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* ── Subtle noise overlay ── */}
          <Box sx={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat', backgroundSize: '128px 128px',
            opacity: 0.035, mixBlendMode: 'overlay',
          }} />

          {/* ── Top accent stripe ── */}
          <Box sx={{
            height: 4,
            background: 'linear-gradient(90deg, #3B82F6 0%, #06B6D4 50%, #3B82F6 100%)',
            backgroundSize: '200% 100%',
          }} />

          {/* ════════ HEADER — Agency + Month ════════ */}
          <Box sx={{ px: 3.5, pt: 2.8, pb: 1.5, position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.4 }}>
              {/* DS wordmark */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '8px',
                  background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>DS</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.85)', lineHeight: 1, letterSpacing: '-0.01em' }}>
                    Digital Scale
                  </Typography>
                  <Typography sx={{ fontSize: '0.46rem', color: 'rgba(59,130,246,0.7)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
                    Agência de Marketing
                  </Typography>
                </Box>
              </Box>
              {/* Month badge */}
              <Box sx={{
                px: 1.2, py: 0.5, borderRadius: 1.5,
                bgcolor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
              }}>
                <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: '#3B82F6', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {monthLabel} {year}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* ════════ CLIENT NAME ════════ */}
          <Box sx={{ px: 3.5, pb: 2.5, pt: 0, position: 'relative', zIndex: 1 }}>
            <Box sx={{ width: 36, height: 2, background: 'linear-gradient(90deg,#3B82F6,#06B6D4)', borderRadius: 1, mb: 1.5 }} />
            <Typography sx={{
              fontSize: '1.85rem', fontWeight: 900, color: '#fff', lineHeight: 1.05,
              letterSpacing: '-0.03em',
              textShadow: '0 0 40px rgba(59,130,246,0.15)',
            }}>
              {selClient}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', mt: 0.4, letterSpacing: '0.01em' }}>
              Relatório de performance mensal
            </Typography>
          </Box>

          {/* ════════ MAIN HERO — Delivery ring + rate ════════ */}
          <Box sx={{
            mx: 3.5, mb: 2.5, p: 2.5, borderRadius: 2.5,
            background: `linear-gradient(135deg, ${pColor}10, ${pColor}05)`,
            border: `1px solid ${pColor}28`,
            display: 'flex', alignItems: 'center', gap: 2.5,
            position: 'relative', zIndex: 1,
          }}>
            {/* Conic ring */}
            <Box sx={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
              <Box sx={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: `conic-gradient(${pColor} ${metrics.pubRate * 3.6}deg, rgba(255,255,255,0.07) 0deg)`,
              }} />
              <Box sx={{
                position: 'absolute', inset: 8, borderRadius: '50%',
                bgcolor: '#0A1120',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: pColor, lineHeight: 1, letterSpacing: '-0.03em' }}>
                  {metrics.pubRate}%
                </Typography>
                <Typography sx={{ fontSize: '0.38rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  entregue
                </Typography>
              </Box>
            </Box>
            {/* Stats alongside ring */}
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', gap: 0.6, mb: 1 }}>
                {[
                  { v: metrics.published, label: 'publicados', c: '#31D17C' },
                  { v: metrics.total, label: 'planejados', c: 'rgba(255,255,255,0.5)' },
                  ...(metrics.rejected > 0 ? [{ v: metrics.rejected, label: 'rejeições', c: '#EF4444' }] : []),
                ].map(({ v, label, c }) => (
                  <Box key={label} sx={{ flex: 1, textAlign: 'center', p: 0.8, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)' }}>
                    <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: c, lineHeight: 1, letterSpacing: '-0.02em' }}>{v}</Typography>
                    <Typography sx={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.04em', mt: 0.2 }}>{label}</Typography>
                  </Box>
                ))}
              </Box>
              <LinearProgress
                variant="determinate"
                value={metrics.pubRate}
                sx={{
                  height: 4, borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.07)',
                  '& .MuiLinearProgress-bar': { borderRadius: 2, background: `linear-gradient(90deg, ${pColor}88, ${pColor})` },
                }}
              />
            </Box>
          </Box>

          {/* ════════ CONTENT TYPES ════════ */}
          <Box sx={{ px: 3.5, mb: 2.5, position: 'relative', zIndex: 1 }}>
            <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>
              Tipos de conteúdo
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
              {[
                { label: 'Posts',     count: metrics.posts,      icon: '🖼️', color: '#3B82F6' },
                { label: 'Reels',     count: metrics.reels,      icon: '🎬', color: '#3B82F6' },
                { label: 'Stories',   count: metrics.stories,    icon: '📱', color: '#C084FC' },
                { label: 'Carrossels',count: metrics.carrossels, icon: '🎠', color: '#FB7185' },
              ].filter(t => t.count > 0).map(t => (
                <Box key={t.label} sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  px: 1.2, py: 0.6, borderRadius: 1.5,
                  bgcolor: `${t.color}12`, border: `1px solid ${t.color}28`,
                }}>
                  <Typography sx={{ fontSize: '0.65rem' }}>{t.icon}</Typography>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: t.color }}>
                    {t.count}
                  </Typography>
                  <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                    {t.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* ════════ ENGAGEMENT (if data exists) ════════ */}
          {metrics.hasEngagement && (
            <Box sx={{ px: 3.5, mb: 2.5, position: 'relative', zIndex: 1 }}>
              <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>
                Engajamento
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                {[
                  { icon: '👁', label: 'Alcance',     value: fmtBig(metrics.totalReach),    color: '#3B82F6' },
                  { icon: '❤️', label: 'Curtidas',    value: fmtBig(metrics.totalLikes),    color: '#FF6B8A' },
                  { icon: '📊', label: 'ER médio',    value: metrics.avgER != null ? `${metrics.avgER.toFixed(1)}%` : '—', color: '#31D17C' },
                ].map(({ icon, label, value, color }) => (
                  <Box key={label} sx={{
                    p: 1.2, borderRadius: 2, textAlign: 'center',
                    bgcolor: `${color}0c`, border: `1px solid ${color}20`,
                  }}>
                    <Typography sx={{ fontSize: '0.8rem', mb: 0.2 }}>{icon}</Typography>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</Typography>
                    <Typography sx={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.35)', mt: 0.3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* ════════ BEST POST (if data exists) ════════ */}
          {metrics.bestPost && (() => {
            const bp    = metrics.bestPost!
            const bEng  = states[bp.i]?.engagement
            const bER   = calcER(bEng)
            const bTitle = states[bp.i]?.title || bp.n
            return (
              <Box sx={{ px: 3.5, mb: 2.5, position: 'relative', zIndex: 1 }}>
                <Box sx={{
                  p: 2, borderRadius: 2,
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.07), rgba(59,130,246,0.04))',
                  border: '1px solid rgba(245,158,11,0.2)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1.2 }}>
                    <EmojiEventsIcon sx={{ fontSize: 16, color: '#F59E0B' }} />
                    <Typography sx={{ fontSize: '0.58rem', fontWeight: 800, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Destaque do mês
                    </Typography>
                    <Chip label={bp.tp} size="small" sx={{ height: 16, fontSize: '0.48rem', bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)', ml: 'auto' }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff', lineHeight: 1.2, mb: 0.5 }} noWrap>
                    {bTitle}
                  </Typography>
                  <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.38)', mb: 1.2 }}>
                    {bp.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    {bEng?.reach && (
                      <Box>
                        <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: '#3B82F6', lineHeight: 1, letterSpacing: '-0.02em' }}>{fmtBig(bEng.reach)}</Typography>
                        <Typography sx={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>alcance</Typography>
                      </Box>
                    )}
                    {bEng?.likes && (
                      <Box>
                        <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: '#FF6B8A', lineHeight: 1, letterSpacing: '-0.02em' }}>{fmtBig(bEng.likes)}</Typography>
                        <Typography sx={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>curtidas</Typography>
                      </Box>
                    )}
                    {bER !== null && (
                      <Box>
                        <Typography sx={{ fontSize: '1.3rem', fontWeight: 900, color: '#F59E0B', lineHeight: 1, letterSpacing: '-0.03em', textShadow: '0 0 20px rgba(245,158,11,0.4)' }}>
                          {bER.toFixed(1)}%
                        </Typography>
                        <Typography sx={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>engajamento</Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            )
          })()}

          {/* ════════ FOOTER ════════ */}
          <Box sx={{
            px: 3.5, py: 2, mt: 'auto',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            position: 'relative', zIndex: 1,
          }}>
            <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.02em' }}>
              Feito com ❤️ pela Digital Scale
            </Typography>
            <Typography sx={{
              fontSize: '0.52rem', fontWeight: 700,
              background: 'linear-gradient(90deg, #3B82F6, #06B6D4)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              letterSpacing: '0.02em',
            }}>
              digitalscale.com.br
            </Typography>
          </Box>
        </Box>
        {/* ════════ END CARD ════════ */}

      </Box>

      {/* ── Helper text ──────────────────────────────────────────────── */}
      <Box sx={{ px: 3, py: 1.5, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
          📱 <strong style={{ color: 'rgba(255,255,255,0.5)' }}>WhatsApp</strong> — baixa o PNG e abre o chat com a mensagem pronta
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
          📤 <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Compartilhar</strong> — usa a API nativa do celular (funciona no mobile)
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
          ⬇️ <strong style={{ color: 'rgba(255,255,255,0.5)' }}>PNG</strong> — salva 1050×{metrics.hasEngagement ? '1875' : '1400'}px pronto para stories/feed
        </Typography>
      </Box>
    </Dialog>
  )
}
