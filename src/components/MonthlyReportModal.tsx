/* MonthlyReportModal.tsx — Relatório mensal por cliente com performance
   v2: seletor de cliente, KPIs de engagement, melhor post em destaque,
       export PNG e disparo direto via WhatsApp.
*/
import { useMemo, useRef, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, Box, Typography, LinearProgress,
  IconButton, Button, CircularProgress, Chip, Stack, Select, MenuItem,
  FormControl, Tooltip, Divider, Paper,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import { toPng } from 'html-to-image'
import type { ContentItem, ItemState, Client } from '../types'
import { STATUS_CONFIG } from '../types'

// ── Helpers ────────────────────────────────────────────────
type Eng = { likes?: number; comments?: number; reach?: number; saves?: number }

function calcER(eng: Eng | undefined): number | null {
  if (!eng?.reach) return null
  return ((eng.likes ?? 0) + (eng.comments ?? 0)) / eng.reach * 100
}
function erColor(er: number | null): string {
  if (er === null) return '#52525B'
  if (er >= 5) return '#00C47A'
  if (er >= 2) return '#FFD700'
  return '#FF4545'
}
function fmtBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('pt-BR')
}

const ALL_STATUSES = [0, 1, 2, 3, 4, 5, 6, 7] as const

// ── Props ──────────────────────────────────────────────────
interface Props {
  open:          boolean
  onClose:       () => void
  items:         ContentItem[]
  states:        Record<number, ItemState>
  allClients:    Client[]
  clientPhones?: Record<string, string>
  now:           Date
  initialClient?: string
}

// ── Componente ─────────────────────────────────────────────
export default function MonthlyReportModal({
  open, onClose, items, states, allClients, clientPhones, now, initialClient,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  const year  = now.getFullYear()
  const month = now.getMonth()

  const monthItems = useMemo(() =>
    items.filter(i => i.dt.getFullYear() === year && i.dt.getMonth() === month),
  [items, year, month])

  // Seletor de cliente — inicializa com `initialClient` se fornecido
  const clientNames = useMemo(() =>
    [...new Set(monthItems.map(i => i.c))].sort()
  , [monthItems])

  const [selClient, setSelClient] = useState<string>(
    initialClient && clientNames.includes(initialClient) ? initialClient : '__all__'
  )

  // Items filtrados pelo cliente selecionado
  const filtered = useMemo(() =>
    selClient === '__all__' ? monthItems : monthItems.filter(i => i.c === selClient)
  , [monthItems, selClient])

  const published = useMemo(() =>
    filtered.filter(i => (states[i.i]?.status ?? i.s) === 7)
  , [filtered, states])

  // Estatísticas gerais
  const stats = useMemo(() => {
    const byStatus = ALL_STATUSES.map(s =>
      filtered.filter(i => (states[i.i]?.status ?? i.s) === s).length
    )
    const total     = filtered.length
    const pub       = byStatus[7]
    const approved  = byStatus[5]
    const rejected  = byStatus[6]
    const pubRate   = total > 0 ? Math.round(((pub + approved) / total) * 100) : 0
    const posts     = filtered.filter(i => i.tp === 'Post').length
    const reels     = filtered.filter(i => i.tp === 'Reel').length
    const stories   = filtered.filter(i => i.tp === 'Story').length
    const carrossels = filtered.filter(i => i.tp === 'Carrossel').length
    return { byStatus, total, pub, approved, rejected, pubRate, posts, reels, stories, carrossels }
  }, [filtered, states])

  // KPIs de engagement (só publicados)
  const engagement = useMemo(() => {
    const withData = published.filter(i => states[i.i]?.engagement?.reach)
    const reach    = withData.reduce((s, i) => s + (states[i.i].engagement?.reach    ?? 0), 0)
    const likes    = withData.reduce((s, i) => s + (states[i.i].engagement?.likes    ?? 0), 0)
    const comments = withData.reduce((s, i) => s + (states[i.i].engagement?.comments ?? 0), 0)
    const saves    = withData.reduce((s, i) => s + ((states[i.i].engagement as Eng & { saves?: number })?.saves ?? 0), 0)
    const erList   = withData.map(i => calcER(states[i.i].engagement)).filter((e): e is number => e !== null)
    const avgER    = erList.length > 0 ? erList.reduce((a, b) => a + b, 0) / erList.length : null
    const bestItem = withData.reduce<ContentItem | null>((best, i) => {
      const e = calcER(states[i.i].engagement) ?? -1
      return !best || e > (calcER(states[best.i].engagement) ?? -1) ? i : best
    }, null)
    const fillPct  = published.length > 0 ? Math.round((withData.length / published.length) * 100) : 0
    return { withData: withData.length, reach, likes, comments, saves, avgER, bestItem, fillPct }
  }, [published, states])

  // Por cliente (para visão geral)
  const clientStats = useMemo(() => {
    if (selClient !== '__all__') return []
    return clientNames.map(name => {
      const ci       = monthItems.filter(i => i.c === name)
      const byStatus = ALL_STATUSES.map(s => ci.filter(i => (states[i.i]?.status ?? i.s) === s).length)
      const total    = ci.length
      const pub      = byStatus[7]
      const approved = byStatus[5]
      const pubRate  = total > 0 ? Math.round(((pub + approved) / total) * 100) : 0
      const withEng  = ci.filter(i => (states[i.i]?.status ?? i.s) === 7 && states[i.i]?.engagement?.reach)
      const reach    = withEng.reduce((s, i) => s + (states[i.i].engagement?.reach ?? 0), 0)
      const erList   = withEng.map(i => calcER(states[i.i].engagement)).filter((e): e is number => e !== null)
      const avgER    = erList.length > 0 ? erList.reduce((a, b) => a + b, 0) / erList.length : null
      return { name, total, pub, approved, pubRate, reach, avgER, byStatus }
    }).sort((a, b) => b.pubRate - a.pubRate)
  }, [selClient, clientNames, monthItems, states])

  // Export PNG
  const handleExport = async () => {
    if (!contentRef.current) return
    setExporting(true)
    try {
      const clientSuffix = selClient !== '__all__' ? `-${selClient.replace(/\s+/g, '_')}` : ''
      const dataUrl = await toPng(contentRef.current, {
        backgroundColor: '#0e0e0e',
        pixelRatio: 2,
        style: { borderRadius: '0' },
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `relatorio-${now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', '-')}${clientSuffix}.png`
      a.click()
    } catch {}
    finally { setExporting(false) }
  }

  // WhatsApp share
  const handleWhatsApp = () => {
    const phone   = selClient !== '__all__' ? (clientPhones?.[selClient] ?? '') : ''
    const mLabel  = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const client  = selClient !== '__all__' ? selClient : 'todos os clientes'

    let msg = `Olá! 👋 Segue o resumo de *${mLabel}* para *${client}*:\n\n`
    msg += `📊 *Performance do mês:*\n`
    msg += `✅ ${stats.pub} publicações realizadas\n`
    if (engagement.reach > 0) {
      msg += `👁 ${fmtBig(engagement.reach)} pessoas alcançadas\n`
      msg += `❤️ ${fmtBig(engagement.likes)} curtidas + comentários\n`
      if (engagement.avgER !== null) msg += `📈 ${engagement.avgER.toFixed(1)}% de engajamento médio\n`
    }
    if (engagement.bestItem) {
      const best   = engagement.bestItem
      const bestER = calcER(states[best.i]?.engagement)
      msg += `\n🏆 *Destaque do mês:*\n`
      msg += `"${best.n || best.tp}" (${best.tp})\n`
      if (states[best.i]?.engagement?.reach) msg += `→ ${fmtBig(states[best.i].engagement!.reach!)} alcance`
      if (bestER !== null) msg += ` | ${bestER.toFixed(1)}% ER`
      msg += '\n'
    }
    msg += `\n*Digital Scale — Agência de Marketing Digital* 🚀`

    const url = phone
      ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const monthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: '#0e0e0e', border: '1px solid rgba(255,144,57,0.15)', borderRadius: 3, backgroundImage: 'none' } }}>

      {/* ── Header ──────────────────────────────────────── */}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Box flex={1}>
          <Typography fontWeight={900} sx={{ fontSize: '1.05rem', color: 'primary.main' }}>
            📄 Relatório Mensal
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'capitalize' }}>
            {monthLabel}
          </Typography>
        </Box>

        {/* Seletor de cliente */}
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <Select value={selClient} onChange={e => setSelClient(e.target.value)}
            sx={{ fontSize: '0.78rem', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' } }}>
            <MenuItem value="__all__" sx={{ fontSize: '0.8rem' }}>📊 Visão geral</MenuItem>
            {clientNames.map(c => (
              <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{c}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Actions */}
        <Tooltip title="Enviar resumo via WhatsApp">
          <IconButton size="small" onClick={handleWhatsApp}
            sx={{ color: '#25D366', '&:hover': { bgcolor: 'rgba(37,211,102,0.1)' } }}>
            <WhatsAppIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
        <Button size="small" onClick={handleExport} disabled={exporting}
          startIcon={exporting ? <CircularProgress size={11} color="inherit" /> : <DownloadIcon sx={{ fontSize: 14 }} />}
          sx={{ fontSize: '0.67rem', fontWeight: 600, color: 'primary.main', border: '1px solid rgba(255,144,57,0.3)', '&:hover': { bgcolor: 'rgba(255,144,57,0.07)' } }}>
          {exporting ? 'Exportando…' : 'PNG'}
        </Button>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.disabled' }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      {/* ── Conteúdo exportável ───────────────────────────── */}
      <DialogContent ref={contentRef} sx={{ pt: 2 }}>

        {/* Título do relatório (fica no PNG) */}
        {selClient !== '__all__' && (
          <Box sx={{ mb: 2.5, textAlign: 'center', pb: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Digital Scale · Agência de Marketing Digital
            </Typography>
            <Typography sx={{ fontSize: '1.4rem', fontWeight: 900, color: 'rgba(255,255,255,0.92)', mb: 0.3 }}>
              {selClient}
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: 'primary.main', textTransform: 'capitalize', fontWeight: 600 }}>
              Relatório de Performance — {monthLabel}
            </Typography>
          </Box>
        )}

        {/* ── KPIs de publicação ─────────────────────────── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.2, mb: 2 }}>
          {[
            { label: 'Total planejado', value: stats.total,   color: '#ff9039' },
            { label: 'Publicados',      value: stats.pub,     color: '#00C47A' },
            { label: 'Taxa de entrega', value: `${stats.pubRate}%`, color: stats.pubRate >= 80 ? '#00C47A' : stats.pubRate >= 50 ? '#FFD700' : '#FF4545' },
            { label: 'Reprovados',      value: stats.rejected, color: stats.rejected > 0 ? '#FF4545' : '#52525B' },
          ].map(({ label, value, color }) => (
            <Paper key={label} sx={{ p: 1.5, textAlign: 'center', border: `1px solid ${color}20`, bgcolor: `${color}07`, borderRadius: 2 }}>
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, color, lineHeight: 1 }}>{value}</Typography>
              <Typography sx={{ fontSize: '0.58rem', color: 'text.secondary', mt: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</Typography>
            </Paper>
          ))}
        </Box>

        {/* Barra de progresso */}
        <Box mb={2}>
          <Stack direction="row" justifyContent="space-between" mb={0.6}>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Taxa de entrega</Typography>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: stats.pubRate >= 80 ? '#00C47A' : '#FFD700' }}>{stats.pubRate}%</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={stats.pubRate}
            sx={{ height: 5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)',
              '& .MuiLinearProgress-bar': { background: stats.pubRate >= 80 ? 'linear-gradient(90deg,#00C47A,#3B8EFF)' : '#FFD700', borderRadius: 3 } }} />
        </Box>

        {/* Tipos de conteúdo */}
        <Stack direction="row" gap={1} mb={2.5} flexWrap="wrap">
          {[
            { label: 'Posts', count: stats.posts, color: '#ff9039' },
            { label: 'Reels', count: stats.reels, color: '#3B8EFF' },
            { label: 'Stories', count: stats.stories, color: '#C084FC' },
            { label: 'Carrossels', count: stats.carrossels, color: '#FB7185' },
          ].filter(t => t.count > 0).map(t => (
            <Chip key={t.label}
              label={`${t.label}: ${t.count}`} size="small"
              sx={{ fontSize: '0.65rem', height: 22, bgcolor: `${t.color}12`, color: t.color, border: `1px solid ${t.color}25` }} />
          ))}
          {ALL_STATUSES.filter(s => stats.byStatus[s] > 0 && s < 7).map(s => {
            const cfg = STATUS_CONFIG[s]
            return (
              <Chip key={s} label={`${cfg.shortLabel}: ${stats.byStatus[s]}`} size="small"
                sx={{ fontSize: '0.6rem', height: 22, bgcolor: `${cfg.color}10`, color: cfg.color, border: `1px solid ${cfg.color}20` }} />
            )
          })}
        </Stack>

        {/* ── Engagement (se há dados) ───────────────────── */}
        {engagement.withData > 0 && (
          <>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              📊 Performance ({engagement.fillPct}% dos publicados com dados)
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.2, mb: 2 }}>
              {[
                { label: '👁 Alcance', value: fmtBig(engagement.reach), color: '#3B8EFF' },
                { label: '❤️ Curtidas', value: fmtBig(engagement.likes), color: '#FF4545' },
                { label: '💬 Comentários', value: fmtBig(engagement.comments), color: '#60A5FA' },
                { label: '📊 ER médio', value: engagement.avgER !== null ? `${engagement.avgER.toFixed(1)}%` : '—', color: engagement.avgER !== null ? erColor(engagement.avgER) : '#52525B' },
              ].map(({ label, value, color }) => (
                <Paper key={label} sx={{ p: 1.5, textAlign: 'center', border: `1px solid ${color}18`, bgcolor: `${color}07`, borderRadius: 2 }}>
                  <Typography sx={{ fontSize: '1.4rem', fontWeight: 900, color, lineHeight: 1 }}>{value}</Typography>
                  <Typography sx={{ fontSize: '0.58rem', color: 'text.secondary', mt: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Typography>
                </Paper>
              ))}
            </Box>

            {/* Melhor post */}
            {engagement.bestItem && (() => {
              const best  = engagement.bestItem!
              const bEng  = states[best.i]?.engagement
              const bER   = calcER(bEng)
              return (
                <Paper sx={{
                  p: 2, mb: 2,
                  border: '1px solid rgba(255,215,0,0.2)',
                  bgcolor: 'rgba(255,215,0,0.05)',
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, rgba(255,215,0,0.06) 0%, rgba(255,215,0,0.02) 100%)',
                }}>
                  <Stack direction="row" alignItems="center" gap={1} mb={1}>
                    <EmojiEventsIcon sx={{ color: '#FFD700', fontSize: 20 }} />
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#FFD700' }}>
                      🏆 Destaque do mês
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, mb: 0.5 }} noWrap>
                    {best.n || best.tp} — {best.c}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 1.5 }}>
                    {best.tp} · {best.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                  </Typography>
                  <Stack direction="row" gap={2}>
                    {bEng?.reach    && <Box sx={{ textAlign: 'center' }}><Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: '#3B8EFF' }}>{fmtBig(bEng.reach)}</Typography><Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>alcance</Typography></Box>}
                    {bEng?.likes    && <Box sx={{ textAlign: 'center' }}><Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: '#FF4545' }}>{fmtBig(bEng.likes)}</Typography><Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>curtidas</Typography></Box>}
                    {bEng?.comments && <Box sx={{ textAlign: 'center' }}><Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: '#60A5FA' }}>{fmtBig(bEng.comments)}</Typography><Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>comentários</Typography></Box>}
                    {bER !== null   && <Box sx={{ textAlign: 'center' }}><Typography sx={{ fontSize: '1.4rem', fontWeight: 900, color: '#FFD700', textShadow: '0 0 16px rgba(255,215,0,0.5)' }}>{bER.toFixed(1)}%</Typography><Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>engajamento</Typography></Box>}
                  </Stack>
                </Paper>
              )
            })()}
          </>
        )}

        {/* ── Visão geral: por cliente ───────────────────── */}
        {selClient === '__all__' && clientStats.length > 0 && (
          <>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Por cliente ({clientStats.length})
            </Typography>
            <Stack gap={0.9}>
              {clientStats.map(({ name, byStatus, total, pub, approved, pubRate, reach, avgER }) => (
                <Box key={name} sx={{ bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2, p: 1.5 }}>
                  <Stack direction="row" alignItems="center" gap={1} mb={0.8}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, flex: 1 }} noWrap>{name}</Typography>
                    {reach > 0 && <Typography sx={{ fontSize: '0.65rem', color: '#3B8EFF' }}>👁 {fmtBig(reach)}</Typography>}
                    {avgER !== null && <Chip label={`${avgER.toFixed(1)}% ER`} size="small"
                      sx={{ fontSize: '0.58rem', height: 18, bgcolor: `${erColor(avgER)}15`, color: erColor(avgER), border: `1px solid ${erColor(avgER)}25` }} />}
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{total} itens</Typography>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, minWidth: 38, textAlign: 'right',
                      color: pubRate >= 80 ? '#00C47A' : pubRate >= 50 ? '#FFD700' : '#FF4545' }}>
                      {pubRate}%
                    </Typography>
                  </Stack>
                  <Box sx={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.06)' }}>
                    {ALL_STATUSES.map(s => {
                      const pct = total > 0 ? (byStatus[s] / total) * 100 : 0
                      if (pct === 0) return null
                      return <Tooltip key={s} title={`${STATUS_CONFIG[s].label}: ${byStatus[s]}`}>
                        <Box sx={{ width: `${pct}%`, bgcolor: STATUS_CONFIG[s].color, transition: 'width 0.4s' }} />
                      </Tooltip>
                    })}
                  </Box>
                </Box>
              ))}
            </Stack>
          </>
        )}

        {filtered.length === 0 && (
          <Typography sx={{ color: 'text.disabled', textAlign: 'center', py: 4, fontSize: '0.85rem' }}>
            Nenhum conteúdo neste mês.
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  )
}
