import { useState, useEffect, useMemo } from 'react'
import {
  Box, Typography, Button, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, CircularProgress, Alert, Chip, LinearProgress,
  ThemeProvider, CssBaseline, Snackbar, Checkbox, Slide,
} from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ImageIcon from '@mui/icons-material/Image'
import MovieIcon from '@mui/icons-material/Movie'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SelectAllIcon from '@mui/icons-material/SelectAll'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import ThumbDownIcon from '@mui/icons-material/ThumbDown'
import theme from '../theme'
import { DATA } from '../data'
import type { ContentItem, ItemState, ContentType } from '../types'

interface FeedbackEntry { approved: boolean; text: string; date: string }

interface PortalData {
  clientName: string
  feedback: Record<string, FeedbackEntry>
  states: Record<number, ItemState>
  customItems: ContentItem[]
  deletedIds: number[]
  editedItems: Record<number, { dt?: string; tp?: ContentType; n?: string }>
}

function deserializeItem(raw: Record<string, unknown>): ContentItem {
  return { ...raw, dt: new Date(raw.dt as string) } as ContentItem
}

function typeStyle(tp: string) {
  if (tp === 'Reel') return { bg: 'rgba(59,142,255,0.15)', color: '#3B8EFF', border: 'rgba(59,142,255,0.3)' }
  if (tp === 'Story') return { bg: 'rgba(180,90,255,0.15)', color: '#b45aff', border: 'rgba(180,90,255,0.3)' }
  return { bg: 'rgba(255,144,57,0.15)', color: '#ff9039', border: 'rgba(255,144,57,0.3)' }
}

const MONTH_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAYS_PT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export default function ClientPortal({ token }: { token: string }) {
  const now = new Date()
  const [year, setYear]         = useState(now.getFullYear())
  const [month, setMonth]       = useState(now.getMonth())
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [data, setData]         = useState<PortalData | null>(null)
  const [rejectOpen, setRejectOpen]   = useState(false)
  const [rejectItemId, setRejectItemId] = useState(0)
  const [rejectText, setRejectText]   = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [snack, setSnack]       = useState('')
  const [approveOpen, setApproveOpen]       = useState(false)
  const [approveItemId, setApproveItemId]   = useState(0)
  const [approveText, setApproveText]       = useState('')
  const [approveAllOpen, setApproveAllOpen] = useState(false)
  const [approveAllComment, setApproveAllComment] = useState('')
  const [approveAllProgress, setApproveAllProgress] = useState(0)
  const [selectMode, setSelectMode]       = useState(false)
  const [selectedIds, setSelectedIds]     = useState<Set<number>>(new Set())
  const [batchRejectOpen, setBatchRejectOpen] = useState(false)
  const [batchRejectText, setBatchRejectText] = useState('')

  // Load portal data on mount
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
            : 'Erro ao carregar. Tente novamente.')
          return
        }

        const syncMap: Record<string, unknown> = {}
        if (syncRes.ok && Array.isArray(syncRes.data)) {
          syncRes.data.forEach(({ key, value }: { key: string; value: string }) => {
            try { syncMap[key] = JSON.parse(value) } catch {}
          })
        }

        setData({
          clientName: portalRes.clientName,
          feedback: portalRes.feedback ?? {},
          states: (syncMap['sm_states'] ?? {}) as Record<number, ItemState>,
          customItems: ((syncMap['sm_custom'] ?? []) as Record<string, unknown>[]).map(deserializeItem),
          deletedIds: (syncMap['sm_deleted'] ?? []) as number[],
          editedItems: (syncMap['sm_edits'] ?? {}) as Record<number, { dt?: string; tp?: ContentType; n?: string }>,
        })
      } catch {
        setError('Erro de conexão. Verifique sua internet e tente novamente.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  // Filter items for this client and month
  const monthItems = useMemo(() => {
    if (!data) return []
    const deleted = new Set(data.deletedIds)
    return [...DATA, ...data.customItems]
      .filter(i => !deleted.has(i.i) && i.c === data.clientName)
      .map(i => {
        const edit = data.editedItems[i.i]
        if (!edit) return i
        return {
          ...i,
          ...(edit.tp ? { tp: edit.tp } : {}),
          ...(edit.n  ? { n: edit.n }  : {}),
          dt: edit.dt ? new Date(edit.dt) : i.dt,
        }
      })
      .filter(i => i.dt.getFullYear() === year && i.dt.getMonth() === month)
      .sort((a, b) => a.dt.getTime() - b.dt.getTime())
  }, [data, year, month])

  const stats = useMemo(() => {
    if (!data) return { approved: 0, rejected: 0, pending: 0, published: 0, total: 0 }
    let approved = 0, rejected = 0, pending = 0, published = 0
    monthItems.forEach(item => {
      const st = data.states[item.i]?.status ?? item.s
      const fb = data.feedback[String(item.i)]
      if (st === 3) { published++ }
      else if (fb?.approved === true) { approved++ }
      else if (fb?.approved === false) { rejected++ }
      else { pending++ }
    })
    return { approved, rejected, pending, published, total: monthItems.length }
  }, [monthItems, data])

  const submitFeedback = async (itemId: number, approved: boolean, text = '') => {
    if (!data) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'feedback', token, itemId, approved, text }),
      }).then(r => r.json())

      if (res.ok) {
        setData(prev => prev ? {
          ...prev,
          feedback: { ...prev.feedback, [String(itemId)]: { approved, text, date: new Date().toISOString() } },
        } : prev)
        setSnack(approved ? 'Conteúdo aprovado!' : 'Feedback enviado!')
      }
    } finally {
      setSubmitting(false)
      setRejectOpen(false)
      setRejectText('')
    }
  }

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const pendingItems = useMemo(() =>
    monthItems.filter(item => {
      const st = data?.states[item.i]?.status ?? item.s
      const fb = data?.feedback[String(item.i)]
      return st !== 7 && st !== 3 && !fb
    }),
    [monthItems, data],
  )

  const submitApproveAll = async () => {
    if (!data || pendingItems.length === 0) return
    setApproveAllProgress(0)
    setSubmitting(true)
    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i]
      try {
        const res = await fetch('/api/portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'feedback', token, itemId: item.i, approved: true, text: approveAllComment }),
        }).then(r => r.json())
        if (res.ok) {
          setData(prev => prev ? {
            ...prev,
            feedback: { ...prev.feedback, [String(item.i)]: { approved: true, text: approveAllComment, date: new Date().toISOString() } },
          } : prev)
        }
      } catch {}
      setApproveAllProgress(i + 1)
    }
    setSubmitting(false)
    setApproveAllOpen(false)
    setApproveAllComment('')
    setApproveAllProgress(0)
    setSnack(`✅ ${pendingItems.length} conteúdo${pendingItems.length !== 1 ? 's' : ''} aprovado${pendingItems.length !== 1 ? 's' : ''}!`)
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const submitBatch = async (approved: boolean, text = '') => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setSubmitting(true)
    for (const id of ids) {
      try {
        const res = await fetch('/api/portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'feedback', token, itemId: id, approved, text }),
        }).then(r => r.json())
        if (res.ok) {
          setData(prev => prev ? {
            ...prev,
            feedback: { ...prev.feedback, [String(id)]: { approved, text, date: new Date().toISOString() } },
          } : prev)
        }
      } catch {}
    }
    setSubmitting(false)
    setSelectedIds(new Set())
    setSelectMode(false)
    setBatchRejectOpen(false)
    setBatchRejectText('')
    setSnack(approved
      ? `✅ ${ids.length} conteúdo${ids.length !== 1 ? 's' : ''} aprovado${ids.length !== 1 ? 's' : ''}!`
      : `🔄 ${ids.length} conteúdo${ids.length !== 1 ? 's' : ''} reprovado${ids.length !== 1 ? 's' : ''}.`)
  }

  // ── Loading ────────────────────────────────────────────
  if (loading) return (
    <ThemeProvider theme={theme}><CssBaseline />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: 'background.default', flexDirection: 'column', gap: 2 }}>
        <CircularProgress color="primary" size={36} />
        <Typography color="text.secondary" sx={{ fontSize: '0.8rem' }}>Carregando calendário...</Typography>
      </Box>
    </ThemeProvider>
  )

  // ── Erro ───────────────────────────────────────────────
  if (error || !data) return (
    <ThemeProvider theme={theme}><CssBaseline />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: 'background.default', p: 3, flexDirection: 'column', gap: 3 }}>
        <Box component="img" src="/logotipo.png" sx={{ height: 40, opacity: 0.8 }} />
        <Alert severity="error" sx={{ maxWidth: 420, width: '100%' }}>{error || 'Erro desconhecido.'}</Alert>
      </Box>
    </ThemeProvider>
  )

  // Group items by date string
  const grouped = monthItems.reduce<Record<string, ContentItem[]>>((acc, item) => {
    const key = item.dt.toISOString().slice(0, 10)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  const pct = stats.total > 0 ? Math.round(((stats.approved + stats.published) / stats.total) * 100) : 0

  return (
    <ThemeProvider theme={theme}><CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', maxWidth: 600, mx: 'auto' }}>

        {/* ── Header ──────────────────────────────────── */}
        <Box sx={{
          px: { xs: 2, sm: 3 }, py: 2,
          background: 'linear-gradient(135deg, #161616 0%, #1e1408 60%, #161616 100%)',
          borderBottom: '1px solid rgba(255,144,57,0.18)',
          display: 'flex', alignItems: 'center', gap: 2, position: 'sticky', top: 0, zIndex: 10,
        }}>
          <Box component="img" src="/logotipo.png" sx={{ height: 34, objectFit: 'contain', flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.5rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1.5 }}>
              Calendário Editorial
            </Typography>
            <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: 'primary.main', lineHeight: 1.1 }} noWrap>
              {data.clientName}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography sx={{ fontSize: '0.5rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>aprovação</Typography>
            <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: pct === 100 ? 'success.main' : 'primary.main', lineHeight: 1 }}>
              {pct}%
            </Typography>
          </Box>
        </Box>

        {/* ── Navegação de mês ────────────────────────── */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1.2, borderBottom: '1px solid rgba(255,255,255,0.06)',
          bgcolor: 'rgba(255,255,255,0.015)',
        }}>
          <Button onClick={prevMonth} size="small" sx={{ minWidth: 36, p: 0.5, color: 'primary.main' }}>
            <ChevronLeftIcon />
          </Button>
          <Typography fontWeight={800} sx={{ fontSize: '0.92rem', color: 'text.primary', letterSpacing: '0.02em' }}>
            {MONTH_PT[month]} {year}
          </Typography>
          <Button onClick={nextMonth} size="small" sx={{ minWidth: 36, p: 0.5, color: 'primary.main' }}>
            <ChevronRightIcon />
          </Button>
        </Box>

        {/* ── Barra de progresso e stats ───────────────── */}
        <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <LinearProgress
            variant="determinate" value={pct}
            sx={{
              height: 6, borderRadius: 3, mb: 1.2, bgcolor: 'rgba(255,255,255,0.06)',
              '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #ff9039, #00C47A)', borderRadius: 3 },
            }}
          />
          <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { n: stats.published, label: 'publicados', color: '#00C47A', bg: 'rgba(0,196,122,0.1)' },
              { n: stats.approved,  label: 'aprovados',  color: '#3B8EFF', bg: 'rgba(59,142,255,0.1)' },
              { n: stats.rejected,  label: 'reprovados', color: '#FF4545', bg: 'rgba(255,69,69,0.1)'  },
              { n: stats.pending,   label: 'aguardando', color: '#FFD700', bg: 'rgba(255,215,0,0.1)'  },
            ].map(s => (
              <Chip key={s.label}
                label={`${s.n} ${s.label}`}
                size="small"
                sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700, color: s.color, bgcolor: s.bg, border: 'none' }}
              />
            ))}

            {pendingItems.length > 1 && (
              <Button
                size="small"
                variant="contained"
                color="success"
                startIcon={<CheckCircleOutlineIcon sx={{ fontSize: '13px !important' }} />}
                onClick={() => setApproveAllOpen(true)}
                sx={{ fontSize: '0.62rem', py: 0.3, px: 1.2, minHeight: 0, fontWeight: 800 }}
              >
                Aprovar tudo ({pendingItems.length})
              </Button>
            )}
            <Button
              size="small"
              variant={selectMode ? 'contained' : 'outlined'}
              color="primary"
              startIcon={<SelectAllIcon sx={{ fontSize: '13px !important' }} />}
              onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()) }}
              sx={{ fontSize: '0.62rem', py: 0.3, px: 1.2, minHeight: 0, fontWeight: 800, ml: pendingItems.length > 1 ? 0 : 'auto' }}
            >
              {selectMode ? 'Cancelar' : 'Selecionar'}
            </Button>
          </Box>
        </Box>

        {/* ── Lista de conteúdos ───────────────────────── */}
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {Object.keys(grouped).length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                Nenhum conteúdo programado para {MONTH_PT[month].toLowerCase()}.
              </Typography>
            </Box>
          ) : (
            Object.entries(grouped).map(([dateStr, dayItems]) => {
              const date = new Date(dateStr + 'T12:00:00')
              return (
                <Box key={dateStr}>
                  {/* Date header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Box sx={{
                      minWidth: 44, height: 44, borderRadius: 2, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      bgcolor: 'rgba(255,144,57,0.08)', border: '1px solid rgba(255,144,57,0.2)',
                    }}>
                      <Typography sx={{ fontSize: '0.42rem', color: 'primary.main', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                        {DAYS_PT[date.getDay()]}
                      </Typography>
                      <Typography sx={{ fontSize: '1.15rem', fontWeight: 900, color: 'primary.main', lineHeight: 1 }}>
                        {date.getDate()}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.07)' }} />
                  </Box>

                  {/* Cards do dia */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {dayItems.map(item => {
                      const st    = data.states[item.i]?.status ?? item.s
                      const link  = data.states[item.i]?.link ?? ''
                      const fb    = data.feedback[String(item.i)]
                      const tc    = typeStyle(item.tp)
                      const isPublished = st === 3
                      const isReady     = !isPublished
                      const canAct      = isReady && !fb
                      const title       = data.states[item.i]?.title || item.n

                      let leftBorderColor = tc.color
                      if (isPublished) leftBorderColor = '#00C47A'
                      else if (fb?.approved === true)  leftBorderColor = '#3B8EFF'
                      else if (fb?.approved === false) leftBorderColor = '#FF4545'

                      return (
                        <Paper key={item.i} elevation={0} sx={{
                          p: 1.5,
                          border: '1px solid',
                          borderColor: isPublished
                            ? 'rgba(0,196,122,0.2)'
                            : fb?.approved === true  ? 'rgba(59,142,255,0.2)'
                            : fb?.approved === false ? 'rgba(255,69,69,0.2)'
                            : 'rgba(255,255,255,0.06)',
                          borderLeft: `3px solid ${leftBorderColor}`,
                          borderRadius: 2,
                          bgcolor: isPublished
                            ? 'rgba(0,196,122,0.03)'
                            : fb?.approved === true  ? 'rgba(59,142,255,0.03)'
                            : fb?.approved === false ? 'rgba(255,69,69,0.03)'
                            : 'background.paper',
                        }}>
                          <Box sx={{ display: 'flex', gap: 1.2 }}>
                            {/* Checkbox de seleção */}
                            {selectMode && canAct && (
                              <Checkbox
                                checked={selectedIds.has(item.i)}
                                onChange={() => toggleSelect(item.i)}
                                size="small"
                                sx={{ p: 0, alignSelf: 'flex-start', mt: 0.3, color: 'primary.main' }}
                              />
                            )}
                            {/* Ícone do tipo */}
                            <Box sx={{
                              width: 38, height: 38, borderRadius: 1.5, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              bgcolor: tc.bg, border: `1px solid ${tc.border}`,
                            }}>
                              {item.tp === 'Reel'  ? <MovieIcon sx={{ fontSize: 18, color: tc.color }} /> :
                               item.tp === 'Story' ? <AutoAwesomeIcon sx={{ fontSize: 18, color: tc.color }} /> :
                                                     <ImageIcon sx={{ fontSize: 18, color: tc.color }} />}
                            </Box>

                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              {/* Chips de tipo + status */}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
                                <Chip label={item.tp} size="small"
                                  sx={{ height: 16, fontSize: '0.52rem', fontWeight: 700, bgcolor: tc.bg, color: tc.color }} />

                                {isPublished && (
                                  <Chip label="Publicado" size="small" icon={<CheckCircleIcon sx={{ fontSize: '10px !important' }} />}
                                    sx={{ height: 16, fontSize: '0.52rem', bgcolor: 'rgba(0,196,122,0.15)', color: '#00C47A' }} />
                                )}
                                {!isPublished && st === 0 && (
                                  <Chip label="Em preparação" size="small"
                                    sx={{ height: 16, fontSize: '0.52rem', bgcolor: 'rgba(255,255,255,0.06)', color: 'text.secondary' }} />
                                )}
                                {fb?.approved === true && !isPublished && (
                                  <Chip label="Você aprovou ✓" size="small"
                                    sx={{ height: 16, fontSize: '0.52rem', bgcolor: 'rgba(59,142,255,0.15)', color: '#3B8EFF', fontWeight: 700 }} />
                                )}
                                {fb?.approved === false && (
                                  <Chip label="Você reprovou" size="small"
                                    sx={{ height: 16, fontSize: '0.52rem', bgcolor: 'rgba(255,69,69,0.15)', color: '#FF4545', fontWeight: 700 }} />
                                )}
                              </Box>

                              {/* Tráfego pago banner */}
                              {data.states[item.i]?.isTraffic && (
                                <Box sx={{
                                  display: 'flex', alignItems: 'center', gap: 0.6,
                                  px: 1, py: 0.5, borderRadius: 1.5, mb: 0.5,
                                  bgcolor: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.35)',
                                }}>
                                  <Typography sx={{ fontSize: '0.85rem', lineHeight: 1 }}>⚡</Typography>
                                  <Typography sx={{ fontSize: '0.65rem', color: '#FFD700', fontWeight: 800, lineHeight: 1.3 }}>
                                    Este criativo será utilizado em tráfego pago (anúncios)
                                  </Typography>
                                </Box>
                              )}

                              {/* Título */}
                              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.3, color: 'text.primary', mb: 0.3 }}>
                                {title}
                              </Typography>

                              {/* Feedback de reprovação */}
                              {fb?.approved === false && fb.text && (
                                <Box sx={{
                                  mt: 0.6, p: 0.8, borderRadius: 1,
                                  bgcolor: 'rgba(255,69,69,0.06)', border: '1px solid rgba(255,69,69,0.15)',
                                }}>
                                  <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, mb: 0.2 }}>
                                    Sua solicitação:
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.72rem', color: '#FF8080', fontStyle: 'italic', lineHeight: 1.4 }}>
                                    "{fb.text}"
                                  </Typography>
                                </Box>
                              )}

                              {/* Aprovado — mensagem + comentário opcional */}
                              {fb?.approved === true && !isPublished && (
                                <Box sx={{ mt: 0.5 }}>
                                  {fb.text ? (
                                    <Box sx={{
                                      p: 0.8, borderRadius: 1,
                                      bgcolor: 'rgba(59,142,255,0.06)', border: '1px solid rgba(59,142,255,0.15)',
                                    }}>
                                      <Typography sx={{ fontSize: '0.58rem', color: 'rgba(59,142,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, mb: 0.2 }}>
                                        Seu comentário:
                                      </Typography>
                                      <Typography sx={{ fontSize: '0.72rem', color: '#7FB3FF', fontStyle: 'italic', lineHeight: 1.4 }}>
                                        "{fb.text}"
                                      </Typography>
                                    </Box>
                                  ) : (
                                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(59,142,255,0.6)', fontStyle: 'italic' }}>
                                      Aguardando publicação pela agência.
                                    </Typography>
                                  )}
                                </Box>
                              )}

                              {/* Botões de ação */}
                              <Box sx={{ display: 'flex', gap: 0.8, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                                {!!link && (
                                  <Button size="small" variant="outlined"
                                    startIcon={<OpenInNewIcon sx={{ fontSize: '11px !important' }} />}
                                    component="a" href={`/c/${token}/${item.i}`} target="_blank" rel="noopener noreferrer"
                                    sx={{
                                      fontSize: '0.62rem', py: 0.4, px: 1.2, minHeight: 0, fontWeight: 700,
                                      borderColor: tc.color, color: tc.color,
                                      '&:hover': { bgcolor: tc.bg, borderColor: tc.color },
                                    }}
                                  >
                                    ▶ Assistir criativo
                                  </Button>
                                )}

                                {canAct && (
                                  <>
                                    <Button size="small" variant="contained" color="success"
                                      startIcon={<CheckCircleOutlineIcon sx={{ fontSize: '13px !important' }} />}
                                      onClick={() => { setApproveItemId(item.i); setApproveOpen(true); setApproveText('') }}
                                      disabled={submitting}
                                      sx={{ fontSize: '0.65rem', py: 0.4, px: 1.2, minHeight: 0, fontWeight: 800 }}
                                    >
                                      Aprovar
                                    </Button>
                                    <Button size="small" variant="outlined" color="error"
                                      startIcon={<CancelOutlinedIcon sx={{ fontSize: '13px !important' }} />}
                                      onClick={() => { setRejectItemId(item.i); setRejectOpen(true); setRejectText('') }}
                                      sx={{ fontSize: '0.65rem', py: 0.4, px: 1.2, minHeight: 0, fontWeight: 800 }}
                                    >
                                      Solicitar alteração
                                    </Button>
                                  </>
                                )}

                                {/* Mudar resposta */}
                                {fb && !isPublished && (
                                  <Button size="small" variant="text"
                                    onClick={() => {
                                      setData(prev => {
                                        if (!prev) return prev
                                        const newFb = { ...prev.feedback }
                                        delete newFb[String(item.i)]
                                        return { ...prev, feedback: newFb }
                                      })
                                    }}
                                    sx={{ fontSize: '0.56rem', py: 0.2, px: 0.8, minHeight: 0, color: 'text.secondary', opacity: 0.7 }}
                                  >
                                    Mudar resposta
                                  </Button>
                                )}
                              </Box>
                            </Box>
                          </Box>
                        </Paper>
                      )
                    })}
                  </Box>
                </Box>
              )
            })
          )}
        </Box>

        {/* ── Footer ──────────────────────────────────── */}
        <Box sx={{ textAlign: 'center', py: 3, mt: 1, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <Box component="img" src="/logotipo.png" sx={{ height: 20, opacity: 0.25, mb: 0.5 }} />
          <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.15)' }}>
            Digital Scale · Gestão de Social Media
          </Typography>
        </Box>

        {/* ── Dialog: Aprovar com comentário ───────────── */}
        <Dialog
          open={approveOpen}
          onClose={() => setApproveOpen(false)}
          maxWidth="xs" fullWidth
          PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(0,196,122,0.3)', borderRadius: 3 } }}
        >
          <DialogTitle sx={{ pb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: 20 }} />
              <Box>
                <Typography fontWeight={700} sx={{ fontSize: '0.95rem' }}>Aprovar conteúdo</Typography>
                <Typography variant="caption" color="text.secondary">
                  Deixe um comentário ou aprove direto.
                </Typography>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus multiline minRows={2} maxRows={5} fullWidth size="small"
              placeholder="Comentário opcional (ex: Adorei! Pode publicar.)"
              value={approveText}
              onChange={e => setApproveText(e.target.value)}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={() => setApproveOpen(false)} size="small" color="inherit">Cancelar</Button>
            <Button
              onClick={() => { submitFeedback(approveItemId, true, approveText); setApproveOpen(false) }}
              size="small" variant="contained" color="success"
              disabled={submitting}
              startIcon={<CheckCircleOutlineIcon sx={{ fontSize: '13px !important' }} />}
              sx={{ fontWeight: 700, minWidth: 100 }}
            >
              {submitting ? 'Aprovando…' : 'Aprovar'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Dialog: Solicitar alteração ──────────────── */}
        <Dialog
          open={rejectOpen}
          onClose={() => setRejectOpen(false)}
          maxWidth="xs" fullWidth
          PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(255,69,69,0.3)', borderRadius: 3 } }}
        >
          <DialogTitle sx={{ pb: 0.5 }}>
            <Typography fontWeight={700} sx={{ fontSize: '0.95rem' }}>Solicitar alteração</Typography>
            <Typography variant="caption" color="text.secondary">
              Descreva o que você gostaria de mudar neste conteúdo.
            </Typography>
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus multiline minRows={3} maxRows={6} fullWidth size="small"
              placeholder="Ex: Mudar a cor do texto para azul, trocar a foto do produto, ajustar o título..."
              value={rejectText}
              onChange={e => setRejectText(e.target.value)}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={() => setRejectOpen(false)} size="small" color="inherit">Cancelar</Button>
            <Button
              onClick={() => submitFeedback(rejectItemId, false, rejectText)}
              size="small" variant="contained" color="error"
              disabled={submitting || !rejectText.trim()}
              sx={{ fontWeight: 700, minWidth: 100 }}
            >
              {submitting ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Dialog: Aprovar tudo ─────────────────────── */}
        <Dialog
          open={approveAllOpen}
          onClose={() => !submitting && setApproveAllOpen(false)}
          maxWidth="xs" fullWidth
          PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(0,196,122,0.3)', borderRadius: 3 } }}
        >
          <DialogTitle sx={{ pb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: 20 }} />
              <Box>
                <Typography fontWeight={700} sx={{ fontSize: '0.95rem' }}>Aprovar tudo</Typography>
                <Typography variant="caption" color="text.secondary">
                  {pendingItems.length} conteúdo{pendingItems.length !== 1 ? 's' : ''} aguardando aprovação
                </Typography>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 1.5, lineHeight: 1.5 }}>
              Você está aprovando todos os conteúdos do mês de uma vez. Deseja adicionar um comentário geral?
            </Typography>
            <TextField
              multiline minRows={2} maxRows={4} fullWidth size="small"
              placeholder="Comentário opcional (ex: Aprovado! Ficou ótimo!)"
              value={approveAllComment}
              onChange={e => setApproveAllComment(e.target.value)}
              disabled={submitting}
            />
            {submitting && (
              <Box sx={{ mt: 1.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={pendingItems.length > 0 ? (approveAllProgress / pendingItems.length) * 100 : 0}
                  color="success"
                  sx={{ borderRadius: 2 }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block', textAlign: 'center' }}>
                  Aprovando {approveAllProgress}/{pendingItems.length}…
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={() => setApproveAllOpen(false)} size="small" color="inherit" disabled={submitting}>
              Cancelar
            </Button>
            <Button
              onClick={submitApproveAll}
              size="small" variant="contained" color="success"
              disabled={submitting}
              startIcon={<CheckCircleOutlineIcon sx={{ fontSize: '13px !important' }} />}
              sx={{ fontWeight: 700, minWidth: 120 }}
            >
              {submitting ? 'Aprovando…' : `Aprovar tudo (${pendingItems.length})`}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Snackbar de confirmação ──────────────────── */}
        <Snackbar
          open={!!snack} autoHideDuration={3000}
          onClose={() => setSnack('')}
          message={snack}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />

        {/* ── Barra de ação flutuante — seleção em batch ── */}
        <Slide direction="up" in={selectMode && selectedIds.size > 0} mountOnEnter unmountOnExit>
          <Box sx={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1300,
            p: 1.5, pb: 'calc(1.5rem + env(safe-area-inset-bottom))',
            background: 'linear-gradient(135deg, rgba(11,11,11,0.98), rgba(18,14,10,0.98))',
            backdropFilter: 'blur(24px)',
            borderTop: '1px solid rgba(255,144,57,0.2)',
            display: 'flex', alignItems: 'center', gap: 1.2,
            boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
          }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'primary.main', flex: 1 }}>
              {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
            </Typography>
            <Button
              variant="outlined" size="small"
              startIcon={<ThumbDownIcon sx={{ fontSize: '14px !important' }} />}
              onClick={() => setBatchRejectOpen(true)}
              disabled={submitting}
              sx={{ fontSize: '0.68rem', py: 0.5, px: 1.5, color: '#FF4545', borderColor: 'rgba(255,69,69,0.4)', fontWeight: 700,
                '&:hover': { borderColor: '#FF4545', bgcolor: 'rgba(255,69,69,0.1)' } }}
            >
              Reprovar
            </Button>
            <Button
              variant="contained" size="small" color="success"
              startIcon={submitting ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : <ThumbUpIcon sx={{ fontSize: '14px !important' }} />}
              onClick={() => submitBatch(true)}
              disabled={submitting}
              sx={{ fontSize: '0.68rem', py: 0.5, px: 1.5, fontWeight: 700 }}
            >
              Aprovar {selectedIds.size}
            </Button>
          </Box>
        </Slide>

        {/* ── Batch reprovar: dialog com comentário ──────── */}
        <Dialog open={batchRejectOpen} onClose={() => setBatchRejectOpen(false)} maxWidth="xs" fullWidth
          PaperProps={{ sx: { borderRadius: 3, border: '1px solid rgba(255,69,69,0.2)' } }}>
          <DialogTitle sx={{ fontSize: '0.9rem', fontWeight: 800 }}>
            Reprovar {selectedIds.size} conteúdo{selectedIds.size !== 1 ? 's' : ''}
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus multiline rows={3} fullWidth
              label="Comentário (opcional)"
              value={batchRejectText}
              onChange={e => setBatchRejectText(e.target.value)}
              placeholder="Descreva o que precisa ser alterado..."
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2 }}>
            <Button onClick={() => setBatchRejectOpen(false)} sx={{ color: 'text.secondary' }}>Cancelar</Button>
            <Button
              variant="contained" color="error"
              onClick={() => submitBatch(false, batchRejectText)}
              disabled={submitting}
            >
              {submitting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : `Reprovar ${selectedIds.size}`}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  )
}
