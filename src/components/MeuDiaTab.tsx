/* MeuDiaTab.tsx — Dashboard pessoal por usuário
   Cada membro da equipe vê exatamente o que precisa fazer hoje.
*/
import { useState, useMemo, useCallback } from 'react'
import {
  Box, Typography, Paper, Chip, Stack, Button, IconButton,
  LinearProgress, Tooltip, CircularProgress, Divider, Avatar,
} from '@mui/material'
import AutoAwesomeIcon      from '@mui/icons-material/AutoAwesome'
import FolderOpenIcon       from '@mui/icons-material/FolderOpen'
import CheckCircleIcon      from '@mui/icons-material/CheckCircle'
import WarningAmberIcon     from '@mui/icons-material/WarningAmber'
import TrendingUpIcon       from '@mui/icons-material/TrendingUp'
import AttachMoneyIcon      from '@mui/icons-material/AttachMoney'
import ContentCopyIcon      from '@mui/icons-material/ContentCopy'
import SendIcon             from '@mui/icons-material/Send'
import PlayArrowIcon        from '@mui/icons-material/PlayArrow'
import PauseIcon            from '@mui/icons-material/Pause'
import ErrorOutlineIcon     from '@mui/icons-material/ErrorOutline'
import OpenInNewIcon        from '@mui/icons-material/OpenInNew'
import type { ContentItem, ItemState, Client, Roteiro, Status } from '../types'
import { NAME_MAP, getDisplayName } from '../lib/users'
import { computeAlerts, alertsForUser, loadDismissed, dismissAlert, pruneOldDismissals } from '../lib/alerts'
import AlertBanner from './AlertBanner'

// ── Types ──────────────────────────────────────────────────
interface Props {
  items:        ContentItem[]
  states:       Record<number, ItemState>
  allClients:   Client[]
  currentUser:  string
  now:          Date
  roteiros:     Record<string, Roteiro[]>
  clientFolders: Record<string, string>
  clientHashtags?: Record<string, string[]>
  onStatusChange: (id: number, status: Status) => void
  onUpdate:       (id: number, patch: Partial<ItemState>) => void
  onTabChange?:   (tab: number) => void  // para navegar para outras abas
}

// ── Helpers ────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

type Urgency = 'overdue' | 'today' | 'tomorrow' | 'week' | 'future'
function getUrgency(dt: Date, now: Date): Urgency {
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const d     = new Date(dt);  d.setHours(0, 0, 0, 0)
  const diff  = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (diff < 0)  return 'overdue'
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff <= 7)  return 'week'
  return 'future'
}
const URGENCY_COLOR: Record<Urgency, string> = {
  overdue:  '#FF4545',
  today:    '#FF9A3D',
  tomorrow: '#FFD700',
  week:     '#60A5FA',
  future:   '#52525B',
}
const URGENCY_LABEL: Record<Urgency, string> = {
  overdue:  'Atrasado',
  today:    'Hoje',
  tomorrow: 'Amanhã',
  week:     'Esta semana',
  future:   'Próximas sem.',
}

// ── Header comum ───────────────────────────────────────────
function RoleHeader({ user, now }: { user: string; now: Date }) {
  const info = NAME_MAP[user]
  if (!info) return null
  const hr = now.getHours()
  const greeting = hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite'
  return (
    <Paper sx={{
      px: { xs: 2, xl: 3 }, py: { xs: 1.5, xl: 2 }, mb: 2, flexShrink: 0,
      background: `linear-gradient(135deg, ${info.color}12 0%, ${info.color}06 100%)`,
      border: `1px solid ${info.color}25`,
      borderRadius: 2,
    }}>
      <Stack direction="row" alignItems="center" gap={1.5}>
        <Avatar sx={{ bgcolor: `${info.color}20`, border: `2px solid ${info.color}40`, width: 42, height: 42, fontSize: '1.4rem' }}>
          {info.emoji}
        </Avatar>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: '1rem', xl: '1.2rem' }, lineHeight: 1.2, color: info.color }}>
            {greeting}, {getDisplayName(user)}!
          </Typography>
          <Typography sx={{ fontSize: { xs: '0.7rem', xl: '0.78rem' }, color: 'text.secondary', fontWeight: 500 }}>
            {info.role} · {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  )
}

// ── Stat card genérico ────────────────────────────────────
function StatCard({ label, value, color = '#ff9039', icon, onClick }: {
  label: string; value: string | number; color?: string; icon?: React.ReactNode; onClick?: () => void
}) {
  return (
    <Paper onClick={onClick} sx={{
      p: { xs: 1.5, xl: 2 }, flex: 1, minWidth: 80, textAlign: 'center',
      border: `1px solid ${color}22`, bgcolor: `${color}08`,
      borderRadius: 2, cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.18s', '&:hover': onClick ? { bgcolor: `${color}14`, transform: 'translateY(-1px)' } : {},
    }}>
      {icon && <Box sx={{ color, mb: 0.4, display: 'flex', justifyContent: 'center' }}>{icon}</Box>}
      <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.3rem', xl: '1.6rem' }, color, lineHeight: 1 }}>{value}</Typography>
      <Typography sx={{ fontSize: { xs: '0.6rem', xl: '0.68rem' }, color: 'text.secondary', mt: 0.4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </Typography>
    </Paper>
  )
}

// ── Seção JHONES — Design ─────────────────────────────────
function JhonesView({ items, states, clientFolders, now, onStatusChange }: {
  items: ContentItem[]; states: Record<number, ItemState>;
  clientFolders: Record<string, string>; now: Date;
  onStatusChange: (id: number, s: Status) => void
}) {
  const today = useMemo(() => { const d = new Date(now); d.setHours(0,0,0,0); return d }, [now])

  // Design queue: Posts/Reels/Stories/Carrossels (not Feed) with status 0 or 1
  const queue = useMemo(() => items
    .filter(i => i.tp !== 'Feed' && [0, 1].includes(states[i.i]?.status ?? i.s))
    .map(i => ({ ...i, urgency: getUrgency(i.dt, now), st: states[i.i]?.status ?? i.s }))
    .sort((a, b) => {
      const uo = ['overdue','today','tomorrow','week','future']
      return uo.indexOf(a.urgency) - uo.indexOf(b.urgency) || a.dt.getTime() - b.dt.getTime()
    }), [items, states, now])

  // Monthly stats
  const monthItems = items.filter(i => i.tp !== 'Feed' && i.dt.getMonth() === now.getMonth() && i.dt.getFullYear() === now.getFullYear())
  const entregues  = monthItems.filter(i => (states[i.i]?.status ?? i.s) >= 2).length
  const pct        = monthItems.length > 0 ? Math.round((entregues / monthItems.length) * 100) : 0

  const [copied, setCopied] = useState<number | null>(null)
  const copyTitle = (id: number, title: string) => {
    navigator.clipboard.writeText(title).catch(() => {})
    setCopied(id); setTimeout(() => setCopied(null), 1500)
  }

  return (
    <Box>
      {/* KPIs */}
      <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
        <StatCard label="Na fila" value={queue.length} color="#C084FC" />
        <StatCard label="Atrasados" value={queue.filter(i => i.urgency === 'overdue').length} color="#FF4545" />
        <StatCard label="Hoje" value={queue.filter(i => i.urgency === 'today').length} color="#FF9A3D" />
        <StatCard label="Entregues/mês" value={`${entregues}/${monthItems.length}`} color="#00C47A" />
      </Stack>

      {/* Progress bar do mês */}
      <Paper sx={{ p: 1.5, mb: 2, border: '1px solid rgba(192,132,252,0.15)', bgcolor: 'rgba(192,132,252,0.04)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.8}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
            Progresso do mês
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: pct === 100 ? '#00C47A' : '#C084FC' }}>
            {pct}%
          </Typography>
        </Stack>
        <LinearProgress variant="determinate" value={pct}
          sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(192,132,252,0.12)',
            '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? '#00C47A' : '#C084FC', borderRadius: 3 } }} />
      </Paper>

      {/* Fila de design */}
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
        Fila de design ({queue.length})
      </Typography>
      {queue.length === 0 ? (
        <Paper sx={{ py: 4, textAlign: 'center', border: '1px dashed rgba(192,132,252,0.2)', bgcolor: 'transparent' }}>
          <CheckCircleIcon sx={{ fontSize: 32, color: '#00C47A', mb: 1, display: 'block', mx: 'auto' }} />
          <Typography variant="body2" color="text.secondary">Nenhuma arte na fila 🎉</Typography>
        </Paper>
      ) : (
        <Stack gap={0.8}>
          {queue.slice(0, 12).map(item => (
            <Paper key={item.i} sx={{
              p: 1.2, display: 'flex', alignItems: 'center', gap: 1.2,
              border: `1px solid ${URGENCY_COLOR[item.urgency]}22`,
              bgcolor: `${URGENCY_COLOR[item.urgency]}06`,
              borderLeft: `3px solid ${URGENCY_COLOR[item.urgency]}`,
              borderRadius: 1.5,
            }}>
              {/* Urgency */}
              <Chip label={URGENCY_LABEL[item.urgency]} size="small"
                sx={{ bgcolor: `${URGENCY_COLOR[item.urgency]}20`, color: URGENCY_COLOR[item.urgency], fontWeight: 700, fontSize: '0.6rem', height: 18, flexShrink: 0 }} />
              {/* Info */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                  {item.c}
                </Typography>
                <Typography noWrap sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                  {item.tp} · {item.n || `ID ${item.i}`}
                </Typography>
              </Box>
              {/* Type badge */}
              <Chip label={item.tp} size="small" variant="outlined"
                sx={{ fontSize: '0.58rem', height: 16, flexShrink: 0, color: 'text.secondary', borderColor: 'rgba(255,255,255,0.1)' }} />
              {/* Actions */}
              <Stack direction="row" gap={0.5} flexShrink={0}>
                {clientFolders[item.c] && (
                  <Tooltip title="Abrir Drive">
                    <IconButton size="small" onClick={() => window.open(clientFolders[item.c], '_blank')}
                      sx={{ width: 26, height: 26, color: '#60A5FA', '&:hover': { bgcolor: 'rgba(96,165,250,0.1)' } }}>
                      <FolderOpenIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Copiar nome">
                  <IconButton size="small" onClick={() => copyTitle(item.i, item.n || item.c)}
                    sx={{ width: 26, height: 26, color: copied === item.i ? '#00C47A' : 'rgba(255,255,255,0.3)', '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}>
                    <ContentCopyIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
                {item.st === 0 && (
                  <Tooltip title="Iniciar edição">
                    <IconButton size="small" onClick={() => onStatusChange(item.i, 1)}
                      sx={{ width: 26, height: 26, bgcolor: 'rgba(255,215,0,0.1)', color: '#FFD700', '&:hover': { bgcolor: 'rgba(255,215,0,0.2)' } }}>
                      <PlayArrowIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {item.st === 1 && (
                  <Tooltip title="Marcar como aprovação interna">
                    <IconButton size="small" onClick={() => onStatusChange(item.i, 2)}
                      sx={{ width: 26, height: 26, bgcolor: 'rgba(96,165,250,0.1)', color: '#60A5FA', '&:hover': { bgcolor: 'rgba(96,165,250,0.2)' } }}>
                      <CheckCircleIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Paper>
          ))}
          {queue.length > 12 && (
            <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textAlign: 'center', py: 1 }}>
              + {queue.length - 12} itens na aba Design
            </Typography>
          )}
        </Stack>
      )}
    </Box>
  )
}

// ── Seção KERGES — Copy + IA de Legenda ───────────────────
function KergesView({ items, states, allClients, clientHashtags, now, onUpdate }: {
  items: ContentItem[]; states: Record<number, ItemState>; allClients: Client[];
  clientHashtags?: Record<string, string[]>; now: Date;
  onUpdate: (id: number, patch: Partial<ItemState>) => void
}) {
  const [aiLoading, setAiLoading] = useState<number | null>(null)
  const [aiOptions, setAiOptions] = useState<{ id: number; texts: string[] } | null>(null)

  // Items que precisam de legenda: status ≥ 1 (design iniciado), caption vazio, ainda não publicado
  const needCaption = useMemo(() => items
    .filter(i => {
      const st = states[i.i]?.status ?? i.s
      const caption = states[i.i]?.caption ?? ''
      return st >= 1 && st < 7 && caption.trim() === ''
    })
    .sort((a, b) => a.dt.getTime() - b.dt.getTime())
    .slice(0, 15), [items, states])

  const generateCaption = useCallback(async (item: ContentItem) => {
    setAiLoading(item.i)
    setAiOptions(null)
    const clientData = allClients.find(c => c.name === item.c)
    const hashtags   = clientHashtags?.[item.c] ?? []
    const dateStr    = item.dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    const prompt = `Você é redatora sênior de uma agência de marketing digital.
Crie 3 opções de legenda para o ${item.tp} "${item.n}" do cliente ${item.c}.
Nicho: ${clientData?.scriptUrl ? 'restaurante/gastronomia' : 'negócio local'}.
Data de publicação: ${dateStr}.
Hashtags do cliente: ${hashtags.length ? hashtags.join(' ') : 'nenhuma salva'}.
Cada legenda deve ter 3-5 linhas, CTA claro, ser autêntica e engajar.
Retorne SOMENTE as 3 opções, separadas por uma linha em branco, numeradas (1., 2., 3.).`

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json() as { content?: { text: string }[]; choices?: { message: { content: string } }[]; response?: string }
      const raw  = (data.content?.[0]?.text ?? data.choices?.[0]?.message?.content ?? data.response ?? '').trim()
      const blocks = raw.split(/\n\n+/).filter(s => s.trim().length > 20)
      const cleaned = blocks.map(b => b.replace(/^\d+\.\s*/, '').trim()).filter(Boolean).slice(0, 3)
      setAiOptions({ id: item.i, texts: cleaned.length ? cleaned : [raw] })
    } catch {
      setAiOptions({ id: item.i, texts: ['Erro ao gerar. Tente novamente.'] })
    }
    setAiLoading(null)
  }, [allClients, clientHashtags])

  const saveCaption = (id: number, caption: string) => {
    onUpdate(id, { caption })
    setAiOptions(null)
  }

  return (
    <Box>
      {/* Stats */}
      <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
        <StatCard label="Sem legenda" value={needCaption.length} color="#FB7185" />
        <StatCard label="Urgentes hoje" value={needCaption.filter(i => getUrgency(i.dt, now) === 'today').length} color="#FF4545" />
        <StatCard label="Esta semana" value={needCaption.filter(i => ['today','tomorrow','week'].includes(getUrgency(i.dt, now))).length} color="#FFD700" />
      </Stack>

      {/* AI caption panel */}
      {aiOptions && (
        <Paper sx={{ p: 1.5, mb: 2, border: '1px solid rgba(251,113,133,0.25)', bgcolor: 'rgba(251,113,133,0.06)', borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" gap={1} mb={1.2}>
            <AutoAwesomeIcon sx={{ color: '#FB7185', fontSize: 16 }} />
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#FB7185' }}>Legendas geradas — escolha uma</Typography>
            <Box flex={1} />
            <IconButton size="small" onClick={() => setAiOptions(null)} sx={{ color: 'text.secondary', p: 0.3 }}>✕</IconButton>
          </Stack>
          <Stack gap={1}>
            {aiOptions.texts.map((text, i) => (
              <Paper key={i} sx={{ p: 1.2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 1.5, cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(251,113,133,0.08)', borderColor: 'rgba(251,113,133,0.2)' }
              }} onClick={() => saveCaption(aiOptions.id, text)}>
                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{text}</Typography>
                <Typography sx={{ fontSize: '0.6rem', color: '#FB7185', mt: 0.5, fontWeight: 700 }}>↑ clique para usar</Typography>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Caption queue */}
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
        Itens sem legenda ({needCaption.length})
      </Typography>
      {needCaption.length === 0 ? (
        <Paper sx={{ py: 4, textAlign: 'center', border: '1px dashed rgba(251,113,133,0.2)', bgcolor: 'transparent' }}>
          <CheckCircleIcon sx={{ fontSize: 32, color: '#00C47A', mb: 1, display: 'block', mx: 'auto' }} />
          <Typography variant="body2" color="text.secondary">Todas as legendas estão em dia! 🎉</Typography>
        </Paper>
      ) : (
        <Stack gap={0.8}>
          {needCaption.map(item => {
            const urgency = getUrgency(item.dt, now)
            const isLoading = aiLoading === item.i
            return (
              <Paper key={item.i} sx={{
                p: 1.2, display: 'flex', alignItems: 'center', gap: 1.2,
                border: `1px solid ${URGENCY_COLOR[urgency]}22`,
                borderLeft: `3px solid ${URGENCY_COLOR[urgency]}`,
                bgcolor: `${URGENCY_COLOR[urgency]}06`, borderRadius: 1.5,
              }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" gap={0.8} mb={0.2}>
                    <Chip label={URGENCY_LABEL[urgency]} size="small"
                      sx={{ bgcolor: `${URGENCY_COLOR[urgency]}20`, color: URGENCY_COLOR[urgency], fontWeight: 700, fontSize: '0.58rem', height: 16, flexShrink: 0 }} />
                    <Typography noWrap sx={{ fontSize: '0.72rem', fontWeight: 700 }}>{item.c}</Typography>
                    <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', flexShrink: 0 }}>
                      {item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </Typography>
                  </Stack>
                  <Typography noWrap sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                    {item.tp} · {item.n || `Item ${item.i}`}
                  </Typography>
                </Box>
                <Tooltip title="Gerar legenda com IA">
                  <Button size="small" onClick={() => generateCaption(item)} disabled={isLoading}
                    startIcon={isLoading ? <CircularProgress size={10} /> : <AutoAwesomeIcon sx={{ fontSize: '0.75rem !important' }} />}
                    sx={{
                      minWidth: 80, height: 28, fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                      background: 'linear-gradient(90deg, #FB7185, #f472b6)',
                      color: '#fff', borderRadius: 1.5, textTransform: 'none',
                      '&:hover': { background: 'linear-gradient(90deg, #e85d77, #db6fa8)' },
                      '&:disabled': { opacity: 0.5 },
                    }}>
                    {isLoading ? 'Gerando…' : '✨ Gerar IA'}
                  </Button>
                </Tooltip>
              </Paper>
            )
          })}
        </Stack>
      )}
    </Box>
  )
}

// ── Seção GEOVANA — Social Media ──────────────────────────
function GeovanaView({ items, states, roteiros, allClients, now, onStatusChange }: {
  items: ContentItem[]; states: Record<number, ItemState>;
  roteiros: Record<string, Roteiro[]>; allClients: Client[];
  now: Date; onStatusChange: (id: number, s: Status) => void
}) {
  const today = useMemo(() => { const d = new Date(now); d.setHours(0,0,0,0); return d }, [now])

  // Prontos para publicar: status 5 (Aprovado pelo cliente) ordenados por data
  const readyToPublish = useMemo(() => items
    .filter(i => (states[i.i]?.status ?? i.s) === 5)
    .sort((a, b) => a.dt.getTime() - b.dt.getTime())
    .slice(0, 10), [items, states])

  // Prontos para enviar ao cliente: status 3 (Aprovado interno)
  const readyToSend = useMemo(() => items
    .filter(i => (states[i.i]?.status ?? i.s) === 3)
    .sort((a, b) => a.dt.getTime() - b.dt.getTime())
    .slice(0, 6), [items, states])

  // Progress mensal
  const monthItems  = items.filter(i => i.dt.getMonth() === now.getMonth() && i.dt.getFullYear() === now.getFullYear())
  const published   = monthItems.filter(i => (states[i.i]?.status ?? i.s) === 7).length
  const pct         = monthItems.length > 0 ? Math.round((published / monthItems.length) * 100) : 0

  // Roteiros sem distribuir
  const undistrClient = allClients.filter(c => {
    const rs = roteiros[c.name] ?? []
    return rs.some(r => !r.distributed)
  })

  return (
    <Box>
      <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
        <StatCard label="Publicar agora" value={readyToPublish.length} color="#00C875" icon={<SendIcon sx={{ fontSize: 16 }} />} />
        <StatCard label="Enviar cliente" value={readyToSend.length} color="#FF9A3D" />
        <StatCard label="Publicados/mês" value={`${published}/${monthItems.length}`} color="#00C47A" />
        <StatCard label="Sem roteiro" value={undistrClient.length} color="#60A5FA" />
      </Stack>

      {/* Progresso mensal */}
      <Paper sx={{ p: 1.5, mb: 2, border: '1px solid rgba(0,196,122,0.15)', bgcolor: 'rgba(0,196,122,0.04)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.8}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Publicações do mês</Typography>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: pct === 100 ? '#00C47A' : '#3B8EFF' }}>{pct}%</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={pct}
          sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(0,196,122,0.1)',
            '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? '#00C47A' : '#3B8EFF', borderRadius: 3 } }} />
      </Paper>

      {/* Prontos para publicar */}
      {readyToPublish.length > 0 && (
        <>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#00C875', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
            🚀 Prontos para publicar ({readyToPublish.length})
          </Typography>
          <Stack gap={0.7} mb={2}>
            {readyToPublish.map(item => (
              <Paper key={item.i} sx={{
                p: 1.2, display: 'flex', alignItems: 'center', gap: 1.2,
                border: '1px solid rgba(0,200,117,0.2)', bgcolor: 'rgba(0,200,117,0.06)',
                borderLeft: '3px solid #00C875', borderRadius: 1.5,
              }}>
                <Box flex={1} minWidth={0}>
                  <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{item.c}</Typography>
                  <Typography noWrap sx={{ fontSize: '0.66rem', color: 'text.secondary' }}>
                    {item.tp} · {item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </Typography>
                </Box>
                {states[item.i]?.link && (
                  <Tooltip title="Ver criativo">
                    <IconButton size="small" onClick={() => window.open(states[item.i].link, '_blank')}
                      sx={{ width: 26, height: 26, color: '#60A5FA' }}>
                      <OpenInNewIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Marcar como Publicado">
                  <IconButton size="small" onClick={() => onStatusChange(item.i, 7)}
                    sx={{ width: 28, height: 28, bgcolor: 'rgba(0,200,117,0.12)', color: '#00C875', '&:hover': { bgcolor: 'rgba(0,200,117,0.22)' } }}>
                    <CheckCircleIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Paper>
            ))}
          </Stack>
        </>
      )}

      {/* Prontos para enviar ao cliente */}
      {readyToSend.length > 0 && (
        <>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#FF9A3D', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
            📤 Prontos para enviar ({readyToSend.length})
          </Typography>
          <Stack gap={0.7}>
            {readyToSend.map(item => (
              <Paper key={item.i} sx={{
                p: 1.2, display: 'flex', alignItems: 'center', gap: 1,
                border: '1px solid rgba(255,154,61,0.15)', bgcolor: 'rgba(255,154,61,0.04)',
                borderLeft: '3px solid #FF9A3D', borderRadius: 1.5,
              }}>
                <Box flex={1} minWidth={0}>
                  <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{item.c}</Typography>
                  <Typography noWrap sx={{ fontSize: '0.66rem', color: 'text.secondary' }}>{item.tp}</Typography>
                </Box>
                <Chip label="Aprovar interno" size="small"
                  sx={{ fontSize: '0.58rem', height: 18, bgcolor: 'rgba(255,154,61,0.12)', color: '#FF9A3D', cursor: 'pointer' }}
                  onClick={() => onStatusChange(item.i, 4)} />
              </Paper>
            ))}
          </Stack>
        </>
      )}
    </Box>
  )
}

// ── Seção SÓCIO — Visão executiva ─────────────────────────
function SocioView({ items, states, allClients, now, onTabChange }: {
  items: ContentItem[]; states: Record<number, ItemState>;
  allClients: Client[]; now: Date; onTabChange?: (t: number) => void
}) {
  const today = useMemo(() => { const d = new Date(now); d.setHours(0,0,0,0); return d }, [now])

  // Financeiro
  const financeiro = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('sm_financeiro') ?? '{}') as Record<string, { valor: number; status: string }> }
    catch { return {} }
  }, [])
  const mrr      = Object.values(financeiro).reduce((s, e) => s + (e.valor || 0), 0)
  const atrasado = Object.values(financeiro).filter(e => e.status === 'atrasado').length
  const pendente = Object.values(financeiro).filter(e => e.status === 'pendente').length
  const recebido = Object.values(financeiro).filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)

  // Prospecção
  const leads = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('sm_prospeccao') ?? '[]') as { stage: string; estimatedTicket?: number }[] }
    catch { return [] }
  }, [])
  const leadsAtivos    = leads.filter(l => !['fechado','perdido'].includes(l.stage)).length
  const leadsPropostas = leads.filter(l => l.stage === 'proposta').length
  const mrpPotencial   = leads.filter(l => l.stage !== 'perdido').reduce((s, l) => s + (l.estimatedTicket ?? 0), 0)

  // Pipeline
  const late      = items.filter(i => (states[i.i]?.status ?? i.s) < 7 && i.dt < today).length
  const published = items.filter(i => (states[i.i]?.status ?? i.s) === 7).length
  const reprovados = items.filter(i => (states[i.i]?.status ?? i.s) === 6).length
  const pct       = items.length > 0 ? Math.round((published / items.length) * 100) : 0

  // Clientes em risco
  const atRisk = allClients.filter(c => {
    const ci = items.filter(i => i.c === c.name)
    return ci.some(i => (states[i.i]?.status ?? i.s) < 7 && i.dt < today)
  }).length

  return (
    <Box>
      {/* Financeiro */}
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
        💰 Financeiro
      </Typography>
      <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
        <StatCard label="MRR" value={fmt(mrr)} color="#00C47A" onClick={() => onTabChange?.(11)} />
        <StatCard label="Recebido" value={fmt(recebido)} color="#00C875" />
        <StatCard label="Pendente" value={pendente} color="#FFD700" icon={<WarningAmberIcon sx={{ fontSize: 16 }} />} onClick={() => onTabChange?.(11)} />
        <StatCard label="Atrasados" value={atrasado} color={atrasado > 0 ? '#FF4545' : '#00C47A'} onClick={() => onTabChange?.(11)} />
      </Stack>

      {/* Pipeline */}
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
        📊 Pipeline de conteúdo
      </Typography>
      <Paper sx={{ p: 1.5, mb: 2, border: '1px solid rgba(255,144,57,0.15)', bgcolor: 'rgba(255,144,57,0.04)' }}>
        <Stack direction="row" gap={1.5} mb={1.5} flexWrap="wrap">
          <StatCard label="Publicados" value={`${pct}%`} color="#00C47A" />
          <StatCard label="Atrasados" value={late} color={late > 0 ? '#FF4545' : '#00C47A'} />
          <StatCard label="Reprovados" value={reprovados} color={reprovados > 0 ? '#FF3B30' : '#00C47A'} />
          <StatCard label="Clientes em risco" value={atRisk} color={atRisk > 0 ? '#FF9A3D' : '#00C47A'} />
        </Stack>
        <LinearProgress variant="determinate" value={pct}
          sx={{ height: 5, borderRadius: 3, bgcolor: 'rgba(255,144,57,0.1)',
            '& .MuiLinearProgress-bar': { bgcolor: pct > 80 ? '#00C47A' : '#ff9039', borderRadius: 3 } }} />
      </Paper>

      {/* Prospecção */}
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
        🎯 Prospecção
      </Typography>
      <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
        <StatCard label="Em aberto" value={leadsAtivos} color="#3B8EFF" onClick={() => onTabChange?.(17)} />
        <StatCard label="Propostas" value={leadsPropostas} color="#FF9A3D" icon={<SendIcon sx={{ fontSize: 14 }} />} />
        <StatCard label="MRR potencial" value={fmt(mrpPotencial)} color="#C084FC" />
      </Stack>

      {/* Quick links */}
      <Stack direction="row" gap={1} flexWrap="wrap" mb={2}>
        {[
          { label: '💰 Financeiro', tab: 11 },
          { label: '🎯 Prospecção', tab: 17 },
          { label: '👥 Equipe', tab: 12 },
          { label: '📊 Dashboard', tab: 7 },
          { label: '📈 Performance', tab: 19 },
        ].map(({ label, tab }) => (
          <Button key={tab} size="small" variant="outlined" onClick={() => onTabChange?.(tab)}
            sx={{ fontSize: '0.68rem', height: 28, borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary',
              '&:hover': { borderColor: 'rgba(255,144,57,0.4)', color: 'primary.main' } }}>
            {label}
          </Button>
        ))}
      </Stack>

      {/* Client quality cards */}
      <ClientQualitySection items={items} states={states} allClients={allClients} now={now} onTabChange={onTabChange} />
    </Box>
  )
}

// ── Controle de Qualidade por Cliente ─────────────────────

const SATISFACTION_KEY = 'sm_client_satisfaction'

function loadSatisfaction(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SATISFACTION_KEY) ?? '{}') }
  catch { return {} }
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <Box sx={{ display: 'flex', gap: 0.2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Box
          key={s}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={(e) => { e.stopPropagation(); onChange(s) }}
          sx={{
            fontSize: '0.85rem', lineHeight: 1, cursor: 'pointer',
            color: s <= (hover || value) ? '#FFD700' : 'rgba(255,255,255,0.18)',
            transition: 'color 0.15s',
            userSelect: 'none',
          }}
        >
          ★
        </Box>
      ))}
    </Box>
  )
}

function ClientQualitySection({ items, states, allClients, now, onTabChange }: {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  now: Date
  onTabChange?: (t: number) => void
}) {
  const [ratings, setRatings] = useState<Record<string, number>>(loadSatisfaction)
  const [expanded, setExpanded] = useState<string | null>(null)

  function setRating(clientName: string, rating: number) {
    const next = { ...ratings, [clientName]: rating }
    setRatings(next)
    localStorage.setItem(SATISFACTION_KEY, JSON.stringify(next))
  }

  const today = useMemo(() => { const d = new Date(now); d.setHours(0,0,0,0); return d }, [now])
  const month = now.getMonth()
  const year  = now.getFullYear()

  const metrics = useMemo(() => allClients.map(client => {
    const all   = items.filter(i => i.c === client.name)
    const month_items = all.filter(i => i.dt.getMonth() === month && i.dt.getFullYear() === year)
    const total     = month_items.length
    const published = month_items.filter(i => (states[i.i]?.status ?? i.s) === 7).length
    const sent      = month_items.filter(i => [4,5,6,7].includes(states[i.i]?.status ?? i.s)).length
    const approved  = month_items.filter(i => [5,7].includes(states[i.i]?.status ?? i.s)).length
    const rejected  = month_items.filter(i => (states[i.i]?.status ?? i.s) === 6).length
    const late      = month_items.filter(i => (states[i.i]?.status ?? i.s) < 7 && i.dt < today).length
    const deliveryPct  = total > 0 ? Math.round((published / total) * 100) : 0
    const approvalPct  = sent > 0 ? Math.round((approved / sent) * 100) : null
    const health: 'green' | 'yellow' | 'red' =
      late > 3 || rejected > 2 ? 'red' :
      late > 0 || rejected > 0 ? 'yellow' : 'green'
    return { client, total, published, sent, approved, rejected, late, deliveryPct, approvalPct, health }
  }), [items, states, allClients, month, year, today])

  const HEALTH_COLOR = { green: '#00C47A', yellow: '#FFD700', red: '#FF4545' }
  const HEALTH_LABEL = { green: 'Em dia', yellow: 'Atenção', red: 'Crítico' }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          👥 Controle de Clientes — {allClients.length} ativos
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Chip label="Ver todos" size="small" onClick={() => onTabChange?.(6)}
          sx={{ fontSize: '0.58rem', height: 18, cursor: 'pointer', bgcolor: 'rgba(255,144,57,0.1)', color: 'primary.main', border: '1px solid rgba(255,144,57,0.25)' }} />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
        {metrics.map(({ client, total, published, deliveryPct, approvalPct, rejected, late, health }) => {
          const rating    = ratings[client.name] ?? 0
          const isOpen    = expanded === client.name
          const hColor    = HEALTH_COLOR[health]

          return (
            <Paper
              key={client.name}
              onClick={() => setExpanded(isOpen ? null : client.name)}
              sx={{
                borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
                border: `1px solid ${isOpen ? hColor + '35' : 'rgba(255,255,255,0.06)'}`,
                bgcolor: isOpen ? `${hColor}06` : 'rgba(13,13,13,0.6)',
                transition: 'all 0.18s',
                '&:hover': { borderColor: 'rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.02)' },
                position: 'relative',
                '&::before': {
                  content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                  bgcolor: hColor, borderRadius: '2px 0 0 2px',
                },
              }}
            >
              {/* ── Row principal ── */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, px: 1.5, py: 1 }}>
                {/* Status dot */}
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: hColor, flexShrink: 0 }} />

                {/* Nome */}
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, flex: 1, lineHeight: 1.2 }} noWrap>
                  {client.name}
                </Typography>

                {/* Entrega */}
                <Tooltip title="Publicados este mês">
                  <Box sx={{ textAlign: 'center', minWidth: 38 }}>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 900, color: deliveryPct >= 80 ? '#00C47A' : deliveryPct >= 50 ? '#FFD700' : '#FF4545', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {deliveryPct}%
                    </Typography>
                    <Typography sx={{ fontSize: '0.5rem', color: 'text.disabled', lineHeight: 1 }}>entrega</Typography>
                  </Box>
                </Tooltip>

                {/* Aprovação */}
                {approvalPct !== null && (
                  <Tooltip title="Aprovado pelo cliente / enviado">
                    <Box sx={{ textAlign: 'center', minWidth: 38 }}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 900, color: approvalPct >= 80 ? '#00C47A' : approvalPct >= 50 ? '#FFD700' : '#FF4545', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                        {approvalPct}%
                      </Typography>
                      <Typography sx={{ fontSize: '0.5rem', color: 'text.disabled', lineHeight: 1 }}>aprovação</Typography>
                    </Box>
                  </Tooltip>
                )}

                {/* Satisfação stars */}
                <Box onClick={e => e.stopPropagation()}>
                  <StarRating value={rating} onChange={v => setRating(client.name, v)} />
                </Box>

                {/* Health label */}
                <Chip
                  label={HEALTH_LABEL[health]}
                  size="small"
                  sx={{ fontSize: '0.55rem', height: 18, fontWeight: 700, bgcolor: `${hColor}15`, color: hColor, border: `1px solid ${hColor}30`, flexShrink: 0 }}
                />
              </Box>

              {/* ── Detalhe expandido ── */}
              {isOpen && (
                <Box sx={{ px: 2, pb: 1.2, pt: 0.2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Total planejado', value: total, color: 'text.secondary' },
                    { label: 'Publicados',       value: published, color: '#00C47A' },
                    { label: 'Atrasados',        value: late,      color: late > 0 ? '#FF4545' : '#00C47A' },
                    { label: 'Reprovados',       value: rejected,  color: rejected > 0 ? '#FF3B30' : '#00C47A' },
                  ].map(kpi => (
                    <Box key={kpi.label} sx={{ textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: kpi.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                        {kpi.value}
                      </Typography>
                      <Typography sx={{ fontSize: '0.55rem', color: 'text.disabled', mt: 0.2 }}>
                        {kpi.label}
                      </Typography>
                    </Box>
                  ))}
                  {/* Barra de entrega */}
                  <Box sx={{ flex: '1 1 100%', mt: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                      <Typography sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>Progresso de entrega</Typography>
                      <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: hColor }}>{deliveryPct}%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={deliveryPct}
                      sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)',
                        '& .MuiLinearProgress-bar': { bgcolor: hColor, borderRadius: 2 } }} />
                  </Box>
                </Box>
              )}
            </Paper>
          )
        })}
      </Box>
    </Box>
  )
}

// ── Seção KAIQUE — Head operacional ───────────────────────
function KaiqueView({ items, states, allClients, now, onTabChange }: {
  items: ContentItem[]; states: Record<number, ItemState>; allClients: Client[]; now: Date; onTabChange?: (t: number) => void
}) {
  const today    = useMemo(() => { const d = new Date(now); d.setHours(0,0,0,0); return d }, [now])
  const tomorrow = useMemo(() => new Date(today.getTime() + 86_400_000), [today])
  const [urgFilter, setUrgFilter] = useState<'all' | 'critical' | 'today'>('all')

  const editing    = items.filter(i => (states[i.i]?.status ?? i.s) === 1)
  const reviewing  = items.filter(i => (states[i.i]?.status ?? i.s) === 2)
  const late       = items.filter(i => (states[i.i]?.status ?? i.s) < 7 && i.dt < today)
  const reprovados = items.filter(i => (states[i.i]?.status ?? i.s) === 6)
  const todayUrgent = items.filter(i => { const st = states[i.i]?.status ?? i.s; return st < 7 && i.dt >= today && i.dt < tomorrow })
  const published  = items.filter(i => (states[i.i]?.status ?? i.s) === 7).length
  const pct        = items.length > 0 ? Math.round((published / items.length) * 100) : 0

  // Bottleneck analysis by client
  const clientBottlenecks = [...new Set(late.map(i => i.c))]
    .map(c => ({ client: c, count: late.filter(i => i.c === c).length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return (
    <Box>
      {/* ── Filtros de urgência ── */}
      <Stack direction="row" gap={0.8} mb={1.5} flexWrap="wrap" alignItems="center">
        {([
          { key: 'all',      label: '🌐 Todos',         count: items.length,                       color: 'rgba(255,255,255,0.5)' },
          { key: 'critical', label: '🚨 Crítico',        count: late.length + reprovados.length,    color: '#FF4545' },
          { key: 'today',    label: '📅 Publicar hoje',  count: todayUrgent.length,                 color: '#FF9A3D' },
        ] as const).map(f => {
          const isActive = urgFilter === f.key
          return (
            <Chip
              key={f.key}
              label={`${f.label}${f.count > 0 ? ` (${f.count})` : ''}`}
              size="small"
              onClick={() => setUrgFilter(f.key)}
              sx={{
                height: 24, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
                bgcolor: isActive ? `${f.color}18` : 'rgba(255,255,255,0.04)',
                color: isActive ? f.color : 'text.secondary',
                border: isActive ? `1px solid ${f.color}40` : '1px solid rgba(255,255,255,0.07)',
                '&:hover': { bgcolor: `${f.color}12` },
              }}
            />
          )
        })}
        {urgFilter !== 'all' && (
          <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', ml: 0.5 }}>
            {urgFilter === 'critical'
              ? `${late.length} atrasado${late.length !== 1 ? 's' : ''} + ${reprovados.length} reprovado${reprovados.length !== 1 ? 's' : ''}`
              : `${todayUrgent.length} item${todayUrgent.length !== 1 ? 's' : ''} para hoje`}
          </Typography>
        )}
      </Stack>

      <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
        <StatCard label="Em edição" value={editing.length} color="#FFD700" onClick={() => onTabChange?.(10)} />
        <StatCard label="Pra revisar" value={reviewing.length} color="#60A5FA" />
        <StatCard label="Atrasados" value={late.length} color={late.length > 0 ? '#FF4545' : '#00C47A'} />
        <StatCard label="Reprovados" value={reprovados.length} color={reprovados.length > 0 ? '#FF3B30' : '#00C47A'} />
      </Stack>

      {/* Progresso geral */}
      <Paper sx={{ p: 1.5, mb: 2, border: '1px solid rgba(255,144,57,0.15)', bgcolor: 'rgba(255,144,57,0.04)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.8}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Progresso geral do mês</Typography>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 900, color: pct > 80 ? '#00C47A' : '#ff9039' }}>{pct}%</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={pct}
          sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,144,57,0.1)',
            '& .MuiLinearProgress-bar': { bgcolor: pct > 80 ? '#00C47A' : '#ff9039', borderRadius: 3 } }} />
      </Paper>

      {/* Gargalos por cliente */}
      {clientBottlenecks.length > 0 && (
        <>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#FF4545', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
            🔴 Gargalos por cliente
          </Typography>
          <Stack gap={0.7} mb={2}>
            {clientBottlenecks.map(({ client, count }) => (
              <Paper key={client} sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1, border: '1px solid rgba(255,69,69,0.15)', bgcolor: 'rgba(255,69,69,0.04)', borderLeft: '3px solid #FF4545', borderRadius: 1.5 }}>
                <WarningAmberIcon sx={{ fontSize: 14, color: '#FF4545', flexShrink: 0 }} />
                <Typography sx={{ flex: 1, fontSize: '0.78rem', fontWeight: 700 }} noWrap>{client}</Typography>
                <Chip label={`${count} atrasado${count > 1 ? 's' : ''}`} size="small"
                  sx={{ bgcolor: 'rgba(255,69,69,0.12)', color: '#FF4545', fontSize: '0.6rem', height: 18, fontWeight: 700 }} />
              </Paper>
            ))}
          </Stack>
        </>
      )}

      {/* Quick links */}
      <Stack direction="row" gap={1} flexWrap="wrap" mb={2}>
        {[
          { label: '🎬 Editor', tab: 10 }, { label: '📋 Produções', tab: 4 },
          { label: '🎥 Gravações', tab: 9 }, { label: '🎨 Design', tab: 16 },
        ].map(({ label, tab }) => (
          <Button key={tab} size="small" variant="outlined" onClick={() => onTabChange?.(tab)}
            sx={{ fontSize: '0.68rem', height: 28, borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary',
              '&:hover': { borderColor: 'rgba(255,144,57,0.4)', color: 'primary.main' } }}>
            {label}
          </Button>
        ))}
      </Stack>

      {/* Client quality cards */}
      <ClientQualitySection items={items} states={states} allClients={allClients} now={now} onTabChange={onTabChange} />
    </Box>
  )
}

// ── Seção TRÁFEGO — Arthur / Robson ───────────────────────
function TrafegoView({ currentUser, now, items, states, allClients, onTabChange }: {
  currentUser: string; now: Date
  items: ContentItem[]; states: Record<number, ItemState>
  allClients: Client[]; onTabChange?: (t: number) => void
}) {
  const trafego = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('sm_trafego') ?? '{}') as Record<string, { plataforma: string; budget: number; investido: number; roas: number; status: string; responsavel: string; clientName?: string }> }
    catch { return {} }
  }, [])

  const entries = Object.entries(trafego)
    .map(([id, e]) => ({ id, ...e }))
    .filter(e => e.responsavel === currentUser || !e.responsavel)

  const ativas    = entries.filter(e => e.status === 'ativa')
  const alertas   = entries.filter(e => {
    const pct = e.budget > 0 ? (e.investido / e.budget) * 100 : 0
    return e.status === 'ativa' && (pct > 80 || e.roas < 1.5)
  })
  const totalBudget   = ativas.reduce((s, e) => s + (e.budget || 0), 0)
  const totalInvestido = ativas.reduce((s, e) => s + (e.investido || 0), 0)
  const budgetPct     = totalBudget > 0 ? Math.round((totalInvestido / totalBudget) * 100) : 0

  return (
    <Box>
      <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
        <StatCard label="Campanhas ativas" value={ativas.length} color="#00C47A" />
        <StatCard label="Alertas" value={alertas.length} color={alertas.length > 0 ? '#FF4545' : '#00C47A'} icon={alertas.length > 0 ? <ErrorOutlineIcon sx={{ fontSize: 16 }} /> : undefined} />
        <StatCard label="Budget gasto" value={`${budgetPct}%`} color={budgetPct > 80 ? '#FF4545' : budgetPct > 60 ? '#FFD700' : '#00C47A'} />
        <StatCard label="Total investido" value={fmt(totalInvestido)} color="#00C47A" />
      </Stack>

      {/* Budget bar */}
      <Paper sx={{ p: 1.5, mb: 2, border: '1px solid rgba(0,196,122,0.15)', bgcolor: 'rgba(0,196,122,0.04)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.8}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
            Budget geral {fmt(totalInvestido)} / {fmt(totalBudget)}
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: budgetPct > 80 ? '#FF4545' : '#00C47A' }}>{budgetPct}%</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={Math.min(budgetPct, 100)}
          sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(0,196,122,0.1)',
            '& .MuiLinearProgress-bar': { bgcolor: budgetPct > 80 ? '#FF4545' : budgetPct > 60 ? '#FFD700' : '#00C47A', borderRadius: 3 } }} />
      </Paper>

      {/* Alertas */}
      {alertas.length > 0 && (
        <>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#FF4545', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
            🔴 Alertas de campanha
          </Typography>
          <Stack gap={0.7} mb={2}>
            {alertas.map(e => {
              const pct = e.budget > 0 ? Math.round((e.investido / e.budget) * 100) : 0
              const roasAlert = e.roas < 1.5
              const budgetAlert = pct > 80
              return (
                <Paper key={e.id} sx={{
                  p: 1.2, border: '1px solid rgba(255,69,69,0.2)', bgcolor: 'rgba(255,69,69,0.05)',
                  borderLeft: '3px solid #FF4545', borderRadius: 1.5,
                }}>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <ErrorOutlineIcon sx={{ fontSize: 14, color: '#FF4545', flexShrink: 0 }} />
                    <Typography sx={{ flex: 1, fontSize: '0.78rem', fontWeight: 700 }} noWrap>
                      {(e as { clientName?: string }).clientName ?? e.id}
                    </Typography>
                    {budgetAlert && <Chip label={`Budget ${pct}%`} size="small" sx={{ bgcolor: 'rgba(255,69,69,0.15)', color: '#FF4545', fontSize: '0.58rem', height: 16, fontWeight: 700 }} />}
                    {roasAlert && <Chip label={`ROAS ${e.roas.toFixed(1)}x`} size="small" sx={{ bgcolor: 'rgba(255,215,0,0.1)', color: '#FFD700', fontSize: '0.58rem', height: 16, fontWeight: 700 }} />}
                  </Stack>
                </Paper>
              )
            })}
          </Stack>
        </>
      )}

      {entries.length === 0 && (
        <Paper sx={{ py: 4, textAlign: 'center', border: '1px dashed rgba(0,196,122,0.2)', bgcolor: 'transparent' }}>
          <TrendingUpIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1, display: 'block', mx: 'auto' }} />
          <Typography variant="body2" color="text.secondary">Nenhuma campanha cadastrada ainda</Typography>
          <Typography variant="caption" color="text.secondary">Acesse a aba Tráfego para adicionar</Typography>
        </Paper>
      )}

      {/* Controle de qualidade e entrega por cliente */}
      <Box sx={{ mt: 2 }}>
        <ClientQualitySection items={items} states={states} allClients={allClients} now={now} onTabChange={onTabChange} />
      </Box>
    </Box>
  )
}

// ── View genérica (usuário não reconhecido) ───────────────
function GenericView({ items, states, now }: { items: ContentItem[]; states: Record<number, ItemState>; now: Date }) {
  const today     = useMemo(() => { const d = new Date(now); d.setHours(0,0,0,0); return d }, [now])
  const todayEnd  = new Date(today.getTime() + 86_400_000)
  const todayItems = items.filter(i => i.dt >= today && i.dt < todayEnd)
  const late       = items.filter(i => (states[i.i]?.status ?? i.s) < 7 && i.dt < today)
  const published  = items.filter(i => (states[i.i]?.status ?? i.s) === 7).length
  const pct        = items.length > 0 ? Math.round((published / items.length) * 100) : 0

  return (
    <Box>
      <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
        <StatCard label="Hoje" value={todayItems.length} color="#ff9039" />
        <StatCard label="Atrasados" value={late.length} color={late.length > 0 ? '#FF4545' : '#00C47A'} />
        <StatCard label="Publicados" value={`${pct}%`} color="#00C47A" />
        <StatCard label="Total" value={items.length} color="#60A5FA" />
      </Stack>
    </Box>
  )
}

// ── Export principal ───────────────────────────────────────
export default function MeuDiaTab({
  items, states, allClients, currentUser, now, roteiros,
  clientFolders, clientHashtags, onStatusChange, onUpdate, onTabChange,
}: Props) {
  const userInfo = currentUser ? NAME_MAP[currentUser] : null

  // ── Alertas ──────────────────────────────────────────────
  // Calcula todos os alertas uma vez e filtra pelo usuário atual
  const allAlerts = useMemo(
    () => computeAlerts(items, states, allClients, now),
    // Recalcula quando itens, estados ou data mudam (now muda a cada minuto no App)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, states, now]
  )
  const userAlerts = useMemo(
    () => alertsForUser(allAlerts, currentUser),
    [allAlerts, currentUser]
  )

  // Dismissal persistido em localStorage
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    const raw = loadDismissed()
    return pruneOldDismissals(raw, allAlerts.map(a => a.id))
  })
  const handleDismiss = useCallback((id: string) => {
    setDismissed(prev => dismissAlert(id, prev))
  }, [])

  const visibleAlerts = useMemo(
    () => userAlerts.filter(a => !dismissed.has(a.id)),
    [userAlerts, dismissed]
  )

  const renderView = () => {
    switch (currentUser) {
      case 'jhones':
        return <JhonesView items={items} states={states} clientFolders={clientFolders} now={now} onStatusChange={onStatusChange} />
      case 'kerges':
        return <KergesView items={items} states={states} allClients={allClients} clientHashtags={clientHashtags} now={now} onUpdate={onUpdate} />
      case 'geovana':
        return <GeovanaView items={items} states={states} roteiros={roteiros} allClients={allClients} now={now} onStatusChange={onStatusChange} />
      case 'pradox':
      case 'testa':
        return <SocioView items={items} states={states} allClients={allClients} now={now} onTabChange={onTabChange} />
      case 'kaique':
        return <KaiqueView items={items} states={states} allClients={allClients} now={now} onTabChange={onTabChange} />
      case 'arthur':
      case 'robson':
        return <TrafegoView currentUser={currentUser} now={now} items={items} states={states} allClients={allClients} onTabChange={onTabChange} />
      default:
        return <GenericView items={items} states={states} now={now} />
    }
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 2, xl: 3 }, maxWidth: { xl: 900 }, mx: 'auto', height: '100%', overflow: 'auto',
      '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,144,57,0.2)', borderRadius: 2 } }}>

      {/* ── Alertas proativos — sempre no topo ── */}
      <AlertBanner
        alerts={visibleAlerts}
        onDismiss={handleDismiss}
        onTabChange={onTabChange}
      />

      {/* Header com identidade do usuário */}
      {userInfo ? (
        <RoleHeader user={currentUser} now={now} />
      ) : (
        <Paper sx={{ px: 2, py: 2, mb: 2, border: '1px solid rgba(255,144,57,0.15)', bgcolor: 'rgba(255,144,57,0.06)', borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 700, color: 'primary.main', mb: 0.5 }}>Meu Dia</Typography>
          <Typography variant="caption" color="text.secondary">
            Faça login para ver seu painel personalizado.
          </Typography>
        </Paper>
      )}

      {/* View específica por role */}
      {renderView()}

      <Box sx={{ height: 32 }} />
    </Box>
  )
}
