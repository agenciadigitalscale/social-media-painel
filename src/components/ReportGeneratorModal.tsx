import { useState, useMemo } from 'react'
import {
  Box, Typography, Button, Dialog, DialogContent,
  DialogTitle, IconButton, MenuItem, Select, LinearProgress,
  CircularProgress,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import AssessmentIcon from '@mui/icons-material/Assessment'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import type { ContentItem, ItemState } from '../types'
import type { ReportData } from './ReportPage'
import { BRAND, DS } from '../theme'
import { getDisplayName } from '../lib/users'

interface Props {
  open: boolean
  onClose: () => void
  clientName: string
  clientColor?: string
  items: ContentItem[]
  states: Record<number, ItemState>
  currentUser?: string
}

// ── Meses disponíveis ──────────────────────────────────────

function buildMonthOptions(now: Date) {
  const opts: { label: string; monthKey: string }[] = []
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    opts.push({ label: label.charAt(0).toUpperCase() + label.slice(1), monthKey: key })
  }
  return opts
}

function getMonthBounds(monthKey: string) {
  const [y, m] = monthKey.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end   = new Date(y, m, 1)
  return { start, end }
}

function pct(a: number, b: number) {
  return b > 0 ? Math.round((a / b) * 100) : 0
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 24)
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?'
}

// ── Geração dos dados do relatório ────────────────────────

function buildReportData(
  clientName: string,
  clientColor: string,
  monthKey: string,
  items: ContentItem[],
  states: Record<number, ItemState>,
  generatedBy: string,
): ReportData {
  const { start, end } = getMonthBounds(monthKey)
  const label = start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const monthLabel = label.charAt(0).toUpperCase() + label.slice(1)

  const clientItems = items.filter(it =>
    it.c === clientName &&
    new Date(it.dt) >= start &&
    new Date(it.dt) < end
  )

  const getStatus = (it: ContentItem) => states[it.i]?.status ?? it.s

  const posts   = clientItems.filter(it => it.tp === 'Post' || it.tp === 'Feed' || it.tp === 'Carrossel')
  const reels   = clientItems.filter(it => it.tp === 'Reel')
  const stories = clientItems.filter(it => it.tp === 'Story')

  const published = clientItems.filter(it => getStatus(it) === 7)
  const sentToClient = clientItems.filter(it => getStatus(it) >= 4).length
  const approved = clientItems.filter(it => getStatus(it) === 5 || getStatus(it) === 7).length

  const token = `${slugify(clientName)}-${monthKey}-${Math.random().toString(36).slice(2, 8)}`

  const highlights: string[] = []
  const total = clientItems.length
  const del = published.length
  const delPct = pct(del, total)

  if (delPct === 100) highlights.push(`Mês 100% concluído — todos os ${total} conteúdos foram publicados!`)
  else if (delPct >= 80) highlights.push(`${delPct}% de taxa de entrega — excelente desempenho no mês.`)

  if (reels.filter(it => getStatus(it) === 7).length > 0)
    highlights.push(`${reels.filter(it => getStatus(it) === 7).length} Reel${reels.filter(it => getStatus(it) === 7).length > 1 ? 's' : ''} publicado${reels.filter(it => getStatus(it) === 7).length > 1 ? 's' : ''} gerando alcance orgânico.`)

  if (approved > 0 && sentToClient > 0)
    highlights.push(`${pct(approved, sentToClient)}% de aprovação pelo cliente — colaboração alinhada.`)

  return {
    token,
    clientName,
    clientInitials: initials(clientName),
    clientColor,
    month: monthLabel,
    monthKey,
    generatedAt: Date.now(),
    generatedBy,
    agency: {
      name: 'Digital Scale',
      tagline: 'Agência de Marketing Digital',
      whatsapp: '5511997295407',
      instagram: 'https://instagram.com/agenciadigitalscale',
    },
    stats: {
      postsTotal:        posts.length,
      postsPublished:    posts.filter(it => getStatus(it) === 7).length,
      reelsTotal:        reels.length,
      reelsPublished:    reels.filter(it => getStatus(it) === 7).length,
      storiesTotal:      stories.length,
      storiesPublished:  stories.filter(it => getStatus(it) === 7).length,
      approvedByClient:  approved,
      sentToClient,
      onTimeCount:       published.length,
      totalPlanned:      total,
      totalDelivered:    del,
    },
    publishedItems: published.map(it => ({
      title: states[it.i]?.title || it.n,
      type:  it.tp,
      date:  new Date(it.dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      link:  states[it.i]?.link || undefined,
    })).sort((a, b) => a.date.localeCompare(b.date)),
    highlights,
  }
}

// ── Mini preview stat ─────────────────────────────────────

function PreviewStat({ emoji, label, value, total }: { emoji: string; label: string; value: number; total: number }) {
  const p = pct(value, total)
  return (
    <Box sx={{
      flex: '1 1 120px', p: 1.5, borderRadius: 2,
      bgcolor: 'rgba(244,247,255,0.04)', border: '1px solid rgba(244,247,255,0.07)',
    }}>
      <Typography sx={{ fontSize: '1.1rem', mb: 0.5 }}>{emoji}</Typography>
      <Typography sx={{
        fontSize: '1.3rem', fontWeight: 900, lineHeight: 1,
        color: p === 100 ? DS.green : DS.orange, letterSpacing: '-0.03em',
      }}>
        {value}<Box component="span" sx={{ fontSize: '0.8rem', color: 'rgba(244,247,255,0.35)', fontWeight: 600 }}>/{total}</Box>
      </Typography>
      <Typography sx={{ fontSize: '0.62rem', color: 'rgba(244,247,255,0.4)', mt: 0.4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </Typography>
      {total > 0 && (
        <LinearProgress variant="determinate" value={p} sx={{
          mt: 0.8, height: 3, borderRadius: 2,
          bgcolor: 'rgba(244,247,255,0.07)',
          '& .MuiLinearProgress-bar': { bgcolor: p === 100 ? DS.green : DS.orange, borderRadius: 2 },
        }} />
      )}
    </Box>
  )
}

// ── Modal principal ───────────────────────────────────────

export default function ReportGeneratorModal({
  open, onClose, clientName, clientColor = DS.accent,
  items, states, currentUser = '',
}: Props) {
  const now = new Date()
  const monthOptions = buildMonthOptions(now)
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].monthKey)
  const [stage, setStage] = useState<'preview' | 'generating' | 'done'>('preview')
  const [reportUrl, setReportUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const displayName = getDisplayName(currentUser) || currentUser

  const preview = useMemo(() => {
    const { start, end } = getMonthBounds(selectedMonth)
    const clientItems = items.filter(it =>
      it.c === clientName &&
      new Date(it.dt) >= start &&
      new Date(it.dt) < end
    )
    const getStatus = (it: ContentItem) => states[it.i]?.status ?? it.s
    const posts    = clientItems.filter(it => it.tp === 'Post' || it.tp === 'Feed' || it.tp === 'Carrossel')
    const reels    = clientItems.filter(it => it.tp === 'Reel')
    const published = clientItems.filter(it => getStatus(it) === 7)
    return { total: clientItems.length, published: published.length, posts, reels, clientItems }
  }, [clientName, items, states, selectedMonth])

  const handleGenerate = async () => {
    setStage('generating')
    try {
      const data = buildReportData(clientName, clientColor, selectedMonth, items, states, displayName)
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.token, data }),
      })
      const json = await res.json() as { ok: boolean }
      if (!json.ok) throw new Error('Falha ao salvar')
      setReportUrl(`${window.location.origin}/relatorio/${data.token}`)
      setStage('done')
    } catch {
      setStage('preview')
      alert('Erro ao gerar relatório. Verifique a conexão.')
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(reportUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(`Olá! Aqui está o relatório de ${monthOptions.find(m => m.monthKey === selectedMonth)?.label ?? selectedMonth} da *${clientName}*:\n\n${reportUrl}\n\nQualquer dúvida, estou à disposição! 😊`)
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  const handleClose = () => {
    setStage('preview')
    setReportUrl('')
    setCopied(false)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{
      sx: {
        bgcolor: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)',
        border: '1px solid rgba(244,247,255,0.08)', borderRadius: '20px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      },
    }}>
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: '10px',
              background: `linear-gradient(135deg, ${DS.orange}, ${DS.cyan})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 16px ${DS.orange}40`,
            }}>
              <AssessmentIcon sx={{ fontSize: 18, color: '#fff' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: DS.t1, lineHeight: 1 }}>
                Gerar Relatório
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: DS.t3, lineHeight: 1.4 }}>
                {clientName}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose} size="small" sx={{ color: DS.t3 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pb: 3 }}>
        {stage === 'done' ? (
          /* ── Sucesso ── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Box sx={{
                width: 56, height: 56, borderRadius: '50%',
                bgcolor: 'rgba(49,209,124,0.12)', border: '1px solid rgba(49,209,124,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2,
              }}>
                <CheckCircleIcon sx={{ fontSize: 28, color: DS.green }} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: DS.t1, mb: 0.5 }}>
                Relatório gerado!
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: DS.t2 }}>
                Compartilhe o link com o cliente
              </Typography>
            </Box>

            {/* Link */}
            <Box sx={{
              px: 2, py: 1.5, borderRadius: 2,
              bgcolor: 'rgba(244,247,255,0.04)', border: '1px solid rgba(244,247,255,0.09)',
              display: 'flex', alignItems: 'center', gap: 1,
            }}>
              <Typography sx={{ flex: 1, fontSize: '0.75rem', color: DS.t2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {reportUrl}
              </Typography>
              <IconButton size="small" onClick={handleCopy} sx={{ color: copied ? DS.green : DS.t2, flexShrink: 0 }}>
                {copied ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Box>

            {/* Ações */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Button
                fullWidth
                startIcon={<WhatsAppIcon />}
                onClick={handleWhatsApp}
                sx={{
                  background: `linear-gradient(135deg, ${BRAND.whatsapp}, ${BRAND.whatsappDark})`,
                  color: '#fff', fontWeight: 800, borderRadius: 2.5, py: 1.4,
                  '&:hover': { filter: 'brightness(1.08)' },
                }}
              >
                Enviar pelo WhatsApp
              </Button>
              <Button
                fullWidth variant="outlined"
                startIcon={<OpenInNewIcon />}
                onClick={() => window.open(reportUrl, '_blank')}
                sx={{
                  borderColor: 'rgba(244,247,255,0.12)', color: DS.t2,
                  borderRadius: 2.5, py: 1.2, fontWeight: 600,
                  '&:hover': { borderColor: DS.orange, color: DS.orange },
                }}
              >
                Abrir relatório
              </Button>
              <Button
                fullWidth variant="text"
                onClick={handleCopy}
                sx={{ color: DS.t3, fontWeight: 600, borderRadius: 2.5, py: 1 }}
              >
                {copied ? '✅ Link copiado!' : 'Copiar link'}
              </Button>
            </Box>
          </Box>
        ) : (
          /* ── Preview + seleção ── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Seleção de mês */}
            <Box>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
                Mês do relatório
              </Typography>
              <Select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                size="small" fullWidth
                sx={{
                  bgcolor: 'rgba(244,247,255,0.05)', borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(244,247,255,0.1)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: DS.orange },
                  color: DS.t1, fontSize: '0.88rem',
                }}
              >
                {monthOptions.map(m => (
                  <MenuItem key={m.monthKey} value={m.monthKey}>{m.label}</MenuItem>
                ))}
              </Select>
            </Box>

            {/* Preview de stats */}
            {preview.total > 0 ? (
              <>
                <Box>
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
                    Prévia do relatório
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    <PreviewStat emoji="📦" label="Total"    value={preview.published} total={preview.total} />
                    <PreviewStat emoji="📸" label="Posts"    value={preview.posts.filter(it => (states[it.i]?.status ?? it.s) === 7).length} total={preview.posts.length} />
                    <PreviewStat emoji="🎬" label="Reels"    value={preview.reels.filter(it => (states[it.i]?.status ?? it.s) === 7).length} total={preview.reels.length} />
                  </Box>
                </Box>

                {/* Aviso se nenhum publicado */}
                {preview.published === 0 && (
                  <Box sx={{
                    p: 2, borderRadius: 2,
                    bgcolor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
                  }}>
                    <Typography sx={{ fontSize: '0.8rem', color: DS.amber }}>
                      ⚠️ Nenhum conteúdo publicado neste mês ainda. O relatório será gerado com 0 entregas.
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              <Box sx={{
                p: 3, borderRadius: 2, textAlign: 'center',
                bgcolor: 'rgba(244,247,255,0.03)', border: '1px solid rgba(244,247,255,0.07)',
              }}>
                <Typography sx={{ fontSize: '1.5rem', mb: 1 }}>📭</Typography>
                <Typography sx={{ fontSize: '0.82rem', color: DS.t2 }}>
                  Sem conteúdo programado para este mês neste cliente.
                </Typography>
              </Box>
            )}

            {/* Botão gerar */}
            <Button
              fullWidth variant="contained"
              onClick={handleGenerate}
              disabled={stage === 'generating'}
              startIcon={stage === 'generating' ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <AssessmentIcon />}
              sx={{
                background: stage === 'generating'
                  ? 'rgba(244,247,255,0.1)'
                  : `linear-gradient(135deg, ${DS.orange}, ${DS.cyan})`,
                color: '#fff', fontWeight: 800, borderRadius: 2.5, py: 1.6,
                fontSize: '0.92rem',
                boxShadow: stage === 'generating' ? 'none' : `0 6px 20px ${DS.orange}35`,
                '&:hover': { filter: 'brightness(1.08)' },
              }}
            >
              {stage === 'generating' ? 'Gerando relatório...' : 'Gerar link do relatório'}
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
