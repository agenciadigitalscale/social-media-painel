import { useState, useMemo, useEffect } from 'react'
import {
  Box, Typography, Paper, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Divider,
  IconButton, Tooltip, LinearProgress, Stack, Grid, Avatar,
  ToggleButtonGroup, ToggleButton, Alert, CircularProgress,
} from '@mui/material'
import AdsClickIcon from '@mui/icons-material/AdsClick'
import EditIcon from '@mui/icons-material/Edit'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import FilterListIcon from '@mui/icons-material/FilterList'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import PauseCircleIcon from '@mui/icons-material/PauseCircle'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import StopCircleIcon from '@mui/icons-material/StopCircle'
import SyncIcon from '@mui/icons-material/Sync'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import type { Client } from '../types'
import { NAME_MAP, getDisplayName } from '../lib/users'
import { syncToCloud } from '../lib/storage'
import CursorGlow from './CursorGlow'

// ── Tipos ─────────────────────────────────────────────────────────────────
type Plataforma = 'meta' | 'google' | 'tiktok' | 'outro'
type CampanhaStatus = 'ativa' | 'pausada' | 'revisao' | 'encerrada'

interface CampanhaEntry {
  plataforma: Plataforma
  budget: number
  investido: number
  status: CampanhaStatus
  alcance: number
  cliques: number
  cpl: number
  roas: number
  managerUrl: string
  responsavel: string
  obs: string
}

// ── Storage ───────────────────────────────────────────────────────────────
const STORAGE_KEY = 'sm_trafego'

function load(): Record<string, CampanhaEntry> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}
function save(data: Record<string, CampanhaEntry>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    syncToCloud(STORAGE_KEY, data)
  } catch { /* ignore */ }
}

function empty(): CampanhaEntry {
  return {
    plataforma: 'meta', budget: 0, investido: 0,
    status: 'ativa', alcance: 0, cliques: 0, cpl: 0,
    roas: 0, managerUrl: '', responsavel: '', obs: '',
  }
}

// ── Configurações visuais ─────────────────────────────────────────────────
const PLAT_CFG: Record<Plataforma, { label: string; color: string; emoji: string; bg: string }> = {
  meta:   { label: 'Meta Ads',   color: '#1877F2', emoji: '📘', bg: 'rgba(24,119,242,0.12)'  },
  google: { label: 'Google Ads', color: '#EA4335', emoji: '🔴', bg: 'rgba(234,67,53,0.12)'   },
  tiktok: { label: 'TikTok Ads', color: '#00F2EA', emoji: '🎵', bg: 'rgba(0,242,234,0.12)'   },
  outro:  { label: 'Outro',      color: '#888',    emoji: '📊', bg: 'rgba(136,136,136,0.10)' },
}

const STATUS_CFG: Record<CampanhaStatus, { label: string; color: string; icon: React.ReactNode }> = {
  ativa:     { label: 'Ativa',      color: '#00C47A', icon: <PlayCircleIcon    sx={{ fontSize: 13 }} /> },
  pausada:   { label: 'Pausada',    color: '#FFD700', icon: <PauseCircleIcon   sx={{ fontSize: 13 }} /> },
  revisao:   { label: 'Em revisão', color: '#3B8EFF', icon: <HourglassEmptyIcon sx={{ fontSize: 13 }} /> },
  encerrada: { label: 'Encerrada',  color: '#FF4545', icon: <StopCircleIcon    sx={{ fontSize: 13 }} /> },
}

const GESTORES = ['arthur', 'robson'] as const

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtK(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000)    return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ── Componente principal ──────────────────────────────────────────────────
interface Props { allClients: Client[] }

export default function TrafegoTab({ allClients }: Props) {
  const [data, setData]                 = useState<Record<string, CampanhaEntry>>(load)
  const [editClient, setEditClient]     = useState<string | null>(null)
  const [draft, setDraft]               = useState<CampanhaEntry>(empty)
  const [filterStatus, setFilterStatus] = useState<'all' | CampanhaStatus>('all')
  const [filterGestor, setFilterGestor] = useState<'all' | string>('all')

  // Meta Ads Sync
  const [metaOpen, setMetaOpen]           = useState(false)
  const [metaToken, setMetaToken]         = useState('')
  const [metaAccount, setMetaAccount]     = useState('')
  const [metaConnected, setMetaConnected] = useState(false)
  const [metaSyncing, setMetaSyncing]     = useState(false)
  const [metaError, setMetaError]         = useState('')
  const [metaSaved, setMetaSaved]         = useState(false)

  useEffect(() => {
    fetch('/api/meta-ads').then(r => r.json()).then((r: { ok: boolean }) => {
      if (r.ok) setMetaConnected(true)
    }).catch(() => {})
  }, [])

  const handleMetaSave = async () => {
    if (!metaToken.trim() || !metaAccount.trim()) return
    setMetaSyncing(true)
    setMetaError('')
    try {
      const res = await fetch('/api/meta-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_credentials', token: metaToken, adAccount: metaAccount }),
      }).then(r => r.json()) as { ok: boolean; error?: string }
      if (res.ok) { setMetaConnected(true); setMetaSaved(true); setMetaOpen(false) }
      else setMetaError(res.error ?? 'Erro ao salvar')
    } catch { setMetaError('Erro de conexão') }
    finally { setMetaSyncing(false) }
  }

  const handleMetaSync = async () => {
    setMetaSyncing(true)
    setMetaError('')
    try {
      const res = await fetch('/api/meta-ads').then(r => r.json()) as { ok: boolean; campaigns?: unknown[]; error?: string }
      if (!res.ok) { setMetaError(res.error ?? 'Erro'); return }
      const updated = { ...data }
      ;(res.campaigns as Record<string, unknown>[]).forEach((camp) => {
        const name = allClients.find(cl => {
          const cName = (cl.name ?? '').toLowerCase()
          const cMeta = ((camp.name as string) ?? '').toLowerCase()
          return cName.split(' ').some(w => w.length > 3 && cMeta.includes(w))
        })?.name
        if (!name) return
        const ins = (camp.insights as { data?: Record<string, unknown>[] } | undefined)?.data?.[0]
        updated[name] = {
          ...(updated[name] ?? empty()),
          plataforma: 'meta',
          investido: parseFloat((ins?.spend as string) ?? '0') || 0,
          alcance:   parseInt((ins?.reach  as string) ?? '0') || 0,
          cliques:   parseInt((ins?.clicks as string) ?? '0') || 0,
          status: camp.status === 'ACTIVE' ? 'ativa' : camp.status === 'PAUSED' ? 'pausada' : 'encerrada',
        }
      })
      setData(updated)
      save(updated)
    } catch { setMetaError('Erro ao sincronizar') }
    finally { setMetaSyncing(false) }
  }

  const handleMetaDisconnect = async () => {
    await fetch('/api/meta-ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear_credentials' }),
    })
    setMetaConnected(false)
    setMetaToken('')
    setMetaAccount('')
  }

  const now = new Date()
  const monthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const clientNames = allClients.map(c => c.name)

  // KPIs globais
  const totals = useMemo(() => {
    const entries = Object.values(data)
    return {
      budget:    entries.reduce((s, e) => s + (e.budget    || 0), 0),
      investido: entries.reduce((s, e) => s + (e.investido || 0), 0),
      ativas:    entries.filter(e => e.status === 'ativa').length,
      pausadas:  entries.filter(e => e.status === 'pausada').length,
      revisao:   entries.filter(e => e.status === 'revisao').length,
      alcance:   entries.reduce((s, e) => s + (e.alcance || 0), 0),
      cliques:   entries.reduce((s, e) => s + (e.cliques || 0), 0),
    }
  }, [data])

  const budgetPct  = totals.budget > 0 ? Math.min((totals.investido / totals.budget) * 100, 100) : 0
  const restante   = Math.max(totals.budget - totals.investido, 0)
  const overBudget = totals.investido > totals.budget && totals.budget > 0

  const openEdit = (name: string) => { setDraft({ ...empty(), ...(data[name] ?? {}) }); setEditClient(name) }
  const saveEdit = () => {
    if (!editClient) return
    const updated = { ...data, [editClient]: { ...draft } }
    setData(updated)
    save(updated)
    setEditClient(null)
  }
  const setD = <K extends keyof CampanhaEntry>(k: K, v: CampanhaEntry[K]) =>
    setDraft(prev => ({ ...prev, [k]: v }))

  const visible = clientNames.filter(name => {
    const e = data[name]
    if (!e) return filterStatus === 'all' && filterGestor === 'all'
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    if (filterGestor !== 'all' && e.responsavel !== filterGestor) return false
    return true
  })

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3.5 }, maxWidth: 1800, mx: 'auto', position: 'relative' }}>
      <CursorGlow color="rgba(255,144,57,0.05)" size={420} />

      {/* Header KPI Panel */}
      <Paper sx={{
        p: { xs: 2, md: 2.5, xl: 3 }, mb: 3,
        background: 'linear-gradient(135deg, rgba(24,119,242,0.10) 0%, rgba(0,196,122,0.08) 100%)',
        border: '1px solid rgba(24,119,242,0.2)', borderRadius: 3,
        position: 'relative', overflow: 'hidden',
        '&::after': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(24,119,242,0.55) 30%, rgba(24,119,242,0.88) 50%, rgba(24,119,242,0.55) 70%, transparent)',
          pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit',
        },
      }}>
        {/* Background glow orbs */}
        <Box sx={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(24,119,242,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: -40, left: -40, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,196,122,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between" gap={2} mb={2.5}>
          <Box>
            <Stack direction="row" alignItems="center" gap={1.5} mb={0.5}>
              <Box sx={{
                width: { xs: 38, xl: 46 }, height: { xs: 38, xl: 46 }, borderRadius: 2,
                background: 'linear-gradient(135deg, #1877F2, #0d5ecc)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 20px rgba(24,119,242,0.4)', flexShrink: 0,
              }}>
                <AdsClickIcon sx={{ color: '#fff', fontSize: { xs: '1.15rem', xl: '1.4rem' } }} />
              </Box>
              <Box>
                <Typography fontWeight={800} sx={{ fontSize: { xs: '1.1rem', xl: '1.4rem' }, textTransform: 'capitalize', lineHeight: 1.1 }}>
                  Gestão de Tráfego
                </Typography>
                <Typography sx={{ fontSize: { xs: '0.72rem', xl: '0.82rem' }, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>
                  {monthLabel} · Campanhas pagas · KPIs por cliente
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Gestores + Meta Ads buttons */}
          <Stack direction="row" gap={1.2} alignItems="center" flexWrap="wrap">
            {GESTORES.map(key => {
              const u = NAME_MAP[key]
              return (
                <Chip
                  key={key}
                  avatar={<Avatar sx={{ bgcolor: u.color, fontSize: '0.75rem', width: 22, height: 22 }}>{u.emoji}</Avatar>}
                  label={`${getDisplayName(key)} · ${u.role}`}
                  size="small"
                  sx={{
                    bgcolor: `${u.color}18`, border: `1px solid ${u.color}40`,
                    color: u.color, fontWeight: 700,
                    fontSize: { xs: '0.7rem', xl: '0.8rem' },
                    boxShadow: `0 0 10px ${u.color}20`,
                  }}
                />
              )
            })}

            {metaConnected ? (
              <Stack direction="row" gap={0.8}>
                <Tooltip title="Sincronizar dados reais do Meta Ads">
                  <Button
                    size="small" variant="outlined"
                    startIcon={metaSyncing ? <CircularProgress size={11} color="inherit" /> : <SyncIcon sx={{ fontSize: 14 }} />}
                    onClick={handleMetaSync}
                    disabled={metaSyncing}
                    sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#1877F2', borderColor: 'rgba(24,119,242,0.4)', py: 0.4, px: 1.2,
                      '&:hover': { bgcolor: 'rgba(24,119,242,0.08)', borderColor: '#1877F2' } }}
                  >
                    {metaSyncing ? 'Sincronizando…' : 'Sync Meta'}
                  </Button>
                </Tooltip>
                <Tooltip title="Desconectar Meta Ads">
                  <IconButton size="small" onClick={handleMetaDisconnect} sx={{ p: 0.5, color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#FF4545' } }}>
                    <LinkOffIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            ) : (
              <Tooltip title="Conectar Meta Ads para importar campanhas automaticamente">
                <Button
                  size="small" variant="outlined"
                  startIcon={<LinkIcon sx={{ fontSize: 14 }} />}
                  onClick={() => { setMetaSaved(false); setMetaError(''); setMetaOpen(true) }}
                  sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#1877F2', borderColor: 'rgba(24,119,242,0.35)',
                    borderStyle: 'dashed', py: 0.4, px: 1.2,
                    '&:hover': { bgcolor: 'rgba(24,119,242,0.08)', borderStyle: 'solid' } }}
                >
                  Conectar Meta
                </Button>
              </Tooltip>
            )}
          </Stack>
        </Stack>

        {/* KPI premium cards */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)', xl: 'repeat(7, 1fr)' },
          gap: { xs: 1, xl: 1.5 },
          mb: 2.5,
        }}>
          {[
            { label: 'Budget total',     value: `R$ ${fmt(totals.budget)}`,                                 color: '#888',    bg: 'rgba(136,136,136,0.06)',   border: 'rgba(136,136,136,0.15)' },
            { label: 'Investido',        value: `R$ ${fmt(totals.investido)}`,                              color: '#ff9039', bg: 'rgba(255,144,57,0.08)',    border: 'rgba(255,144,57,0.18)'  },
            { label: 'Restante',         value: `R$ ${fmt(restante)}`,                                      color: overBudget ? '#FF4545' : '#00C47A', bg: overBudget ? 'rgba(255,69,69,0.08)' : 'rgba(0,196,122,0.08)', border: overBudget ? 'rgba(255,69,69,0.2)' : 'rgba(0,196,122,0.18)' },
            { label: 'Campanhas ativas', value: String(totals.ativas),                                      color: '#00C47A', bg: 'rgba(0,196,122,0.08)',    border: 'rgba(0,196,122,0.18)'   },
            { label: 'Em revisão',       value: String(totals.revisao),                                     color: '#3B8EFF', bg: 'rgba(59,142,255,0.08)',    border: 'rgba(59,142,255,0.18)'  },
            { label: 'Alcance total',    value: fmtK(totals.alcance),                                       color: '#C084FC', bg: 'rgba(192,132,252,0.08)',   border: 'rgba(192,132,252,0.18)' },
            { label: 'Cliques',          value: fmtK(totals.cliques),                                       color: '#FB7185', bg: 'rgba(251,113,133,0.08)',   border: 'rgba(251,113,133,0.18)' },
          ].map(({ label, value, color, bg, border }) => (
            <Paper key={label} sx={{
              p: { xs: 1, xl: 1.5 }, bgcolor: bg,
              border: `1px solid ${border}`,
              borderRadius: 2, textAlign: 'center',
              position: 'relative',
              '&::after': {
                content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                background: `linear-gradient(90deg, transparent, ${color}55 30%, ${color}88 50%, ${color}55 70%, transparent)`,
                pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit',
              },
            }}>
              <Typography sx={{ fontSize: { xs: '1.1rem', xl: '1.45rem' }, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.025em' }}>
                {value}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: { xs: '0.58rem', xl: '0.68rem' }, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {label}
              </Typography>
            </Paper>
          ))}
        </Box>

        {/* Budget global bar */}
        <Box>
          <Stack direction="row" justifyContent="space-between" mb={0.6}>
            <Typography sx={{ fontSize: { xs: '0.68rem', xl: '0.75rem' }, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Budget total do mês
            </Typography>
            <Stack direction="row" alignItems="center" gap={0.5}>
              {overBudget
                ? <TrendingDownIcon sx={{ fontSize: 13, color: '#FF4545' }} />
                : <TrendingUpIcon   sx={{ fontSize: 13, color: '#00C47A' }} />
              }
              <Typography sx={{ fontSize: { xs: '0.72rem', xl: '0.8rem' }, fontWeight: 800, color: budgetPct > 90 ? '#FF4545' : '#00C47A' }}>
                {budgetPct.toFixed(1)}% investido
              </Typography>
            </Stack>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={budgetPct}
            sx={{
              height: 8, borderRadius: 4,
              bgcolor: 'rgba(255,255,255,0.08)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                bgcolor: budgetPct > 90 ? '#FF4545' : budgetPct > 70 ? '#FFD700' : '#00C47A',
                boxShadow: `0 0 10px ${budgetPct > 90 ? '#FF454560' : budgetPct > 70 ? '#FFD70060' : '#00C47A60'}`,
              },
            }}
          />
        </Box>
      </Paper>

      {/* Filtros */}
      <Stack direction="row" gap={1.5} mb={3} flexWrap="wrap" alignItems="center">
        <FilterListIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '1.1rem' }} />
        <ToggleButtonGroup
          value={filterStatus} exclusive size="small"
          onChange={(_, v) => { if (v) setFilterStatus(v) }}
          sx={{
            '& .MuiToggleButton-root': {
              fontSize: { xs: '0.68rem', xl: '0.8rem' }, py: 0.4, px: 1.2,
              borderColor: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.45)',
              '&.Mui-selected': { fontWeight: 700 },
            },
          }}
        >
          <ToggleButton value="all">Todas</ToggleButton>
          {(Object.entries(STATUS_CFG) as [CampanhaStatus, typeof STATUS_CFG[CampanhaStatus]][]).map(([k, cfg]) => (
            <ToggleButton key={k} value={k} sx={{ gap: 0.4, '&.Mui-selected': { color: `${cfg.color} !important`, bgcolor: `${cfg.color}18 !important`, borderColor: `${cfg.color}40 !important` } }}>
              {cfg.icon} {cfg.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <ToggleButtonGroup
          value={filterGestor} exclusive size="small"
          onChange={(_, v) => { if (v) setFilterGestor(v) }}
          sx={{
            '& .MuiToggleButton-root': {
              fontSize: { xs: '0.68rem', xl: '0.8rem' }, py: 0.4, px: 1.2,
              borderColor: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.45)',
            },
          }}
        >
          <ToggleButton value="all">Todos</ToggleButton>
          {GESTORES.map(g => {
            const u = NAME_MAP[g]
            return (
              <ToggleButton key={g} value={g} sx={{ '&.Mui-selected': { color: `${u.color} !important`, bgcolor: `${u.color}18 !important` } }}>
                {u.emoji} {getDisplayName(g)}
              </ToggleButton>
            )
          })}
        </ToggleButtonGroup>
      </Stack>

      {/* Campaign cards grid */}
      <Grid container spacing={{ xs: 1.5, md: 2, xl: 2.5 }}>
        {visible.map(clientName => {
          const e        = data[clientName] ?? empty()
          const hasData  = !!data[clientName]
          const platCfg  = PLAT_CFG[e.plataforma]
          const stCfg    = STATUS_CFG[e.status]
          const pct      = e.budget > 0 ? Math.min((e.investido / e.budget) * 100, 100) : 0
          const restante = Math.max(e.budget - e.investido, 0)
          const gestor   = e.responsavel && NAME_MAP[e.responsavel]
          const ctr      = e.cliques > 0 && e.alcance > 0
            ? ((e.cliques / e.alcance) * 100).toFixed(2) : '—'

          return (
            <Grid item xs={12} md={6} xl={4} key={clientName}>
              <Paper sx={{
                p: { xs: 1.5, xl: 2.5 },
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: hasData ? `${platCfg.color}30` : 'rgba(255,255,255,0.06)',
                bgcolor: hasData ? `${platCfg.color}04` : 'background.paper',
                position: 'relative', overflow: 'hidden',
                transition: 'all 0.28s ease',
                '&:hover': {
                  borderColor: hasData ? `${platCfg.color}55` : 'rgba(255,255,255,0.12)',
                  transform: 'translateY(-3px)',
                  boxShadow: hasData ? `0 10px 32px rgba(0,0,0,0.55), 0 0 20px ${platCfg.color}12` : '0 10px 32px rgba(0,0,0,0.55)',
                },
                '&::after': {
                  content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                  background: hasData
                    ? `linear-gradient(90deg, transparent, ${platCfg.color}55 30%, ${platCfg.color}88 50%, ${platCfg.color}55 70%, transparent)`
                    : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10) 30%, rgba(255,255,255,0.16) 50%, rgba(255,255,255,0.10) 70%, transparent)',
                  pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit',
                },
              }}>
                {/* Campaign status color bar on left */}
                {hasData && (
                  <Box sx={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                    bgcolor: stCfg.color,
                    boxShadow: `0 0 8px ${stCfg.color}80`,
                  }} />
                )}

                {/* Card header */}
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1.2}
                  sx={{ pl: hasData ? 1 : 0 }}>
                  <Box sx={{ flex: 1, mr: 1 }}>
                    <Typography fontWeight={800} sx={{ fontSize: { xs: '0.88rem', xl: '1rem' }, lineHeight: 1.3, mb: 0.6 }}>
                      {clientName}
                    </Typography>
                    <Stack direction="row" gap={0.6} flexWrap="wrap" alignItems="center">
                      {/* Platform badge */}
                      <Chip
                        label={`${platCfg.emoji} ${platCfg.label}`}
                        size="small"
                        sx={{
                          height: 20, fontSize: { xs: '0.62rem', xl: '0.7rem' }, fontWeight: 700,
                          bgcolor: `${platCfg.color}18`,
                          color: platCfg.color,
                          border: `1px solid ${platCfg.color}35`,
                          borderRadius: 2,
                        }}
                      />
                      {/* Status badge */}
                      <Chip
                        icon={stCfg.icon as React.ReactElement}
                        label={stCfg.label}
                        size="small"
                        sx={{
                          height: 20, fontSize: { xs: '0.62rem', xl: '0.7rem' }, fontWeight: 700,
                          bgcolor: `${stCfg.color}18`,
                          color: stCfg.color,
                          border: `1px solid ${stCfg.color}35`,
                          borderRadius: 2,
                          '& .MuiChip-icon': { color: stCfg.color, ml: 0.3 },
                        }}
                      />
                      {/* Gestor badge */}
                      {gestor && (
                        <Chip
                          label={`${gestor.emoji} ${getDisplayName(e.responsavel)}`}
                          size="small"
                          sx={{
                            height: 20, fontSize: { xs: '0.62rem', xl: '0.7rem' }, fontWeight: 600,
                            bgcolor: `${gestor.color}18`,
                            color: gestor.color,
                            border: `1px solid ${gestor.color}30`,
                            borderRadius: 2,
                          }}
                        />
                      )}
                    </Stack>
                  </Box>
                  <Stack direction="row" gap={0.4}>
                    {e.managerUrl && (
                      <Tooltip title="Abrir gerenciador">
                        <IconButton size="small" href={e.managerUrl} target="_blank" sx={{ p: 0.4, color: 'rgba(255,255,255,0.25)', '&:hover': { color: platCfg.color } }}>
                          <OpenInNewIcon sx={{ fontSize: '0.95rem' }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Editar campanha">
                      <IconButton size="small" onClick={() => openEdit(clientName)} sx={{ p: 0.4, color: 'rgba(255,255,255,0.25)', '&:hover': { color: 'primary.main' } }}>
                        <EditIcon sx={{ fontSize: '0.95rem' }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>

                {!hasData ? (
                  <Box
                    onClick={() => openEdit(clientName)}
                    sx={{
                      textAlign: 'center', py: 2.5, cursor: 'pointer', opacity: 0.4,
                      border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 1.5,
                      transition: 'all 0.2s ease',
                      '&:hover': { opacity: 0.75, borderColor: 'rgba(255,144,57,0.3)' },
                    }}
                  >
                    <TrendingUpIcon sx={{ fontSize: '1.8rem', mb: 0.5, display: 'block', mx: 'auto', color: 'rgba(255,144,57,0.6)' }} />
                    <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                      Clique para registrar campanha
                    </Typography>
                  </Box>
                ) : (
                  <>
                    {/* Budget section */}
                    <Box sx={{ mb: 1.2, pl: 1 }}>
                      <Stack direction="row" justifyContent="space-between" mb={0.4}>
                        <Typography sx={{ fontSize: { xs: '0.65rem', xl: '0.72rem' }, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                          Investido
                        </Typography>
                        <Stack direction="row" alignItems="center" gap={0.4}>
                          {pct > 90
                            ? <TrendingDownIcon sx={{ fontSize: 11, color: '#FF4545' }} />
                            : <TrendingUpIcon   sx={{ fontSize: 11, color: '#00C47A' }} />
                          }
                          <Typography sx={{
                            fontSize: { xs: '0.7rem', xl: '0.78rem' }, fontWeight: 800,
                            color: pct > 90 ? '#FF4545' : pct > 70 ? '#FFD700' : '#00C47A',
                          }}>
                            R$ {fmt(e.investido)} / R$ {fmt(e.budget)}
                          </Typography>
                        </Stack>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                          mb: 0.5, height: 6, borderRadius: 3,
                          bgcolor: 'rgba(255,255,255,0.08)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                            bgcolor: pct > 90 ? '#FF4545' : pct > 70 ? '#FFD700' : '#00C47A',
                            boxShadow: `0 0 8px ${pct > 90 ? '#FF454540' : '#00C47A40'}`,
                          },
                        }}
                      />
                    </Box>

                    {/* KPIs grid with colored pills */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.7, mb: 1, pl: 1 }}>
                      {[
                        { label: 'Restante', value: `R$${fmt(restante)}`,                              color: '#888'    },
                        { label: 'Alcance',  value: fmtK(e.alcance),                                   color: '#C084FC' },
                        { label: 'CTR',      value: `${ctr}%`,                                          color: '#3B8EFF' },
                        { label: 'CPL',      value: e.cpl > 0 ? `R$${fmt(e.cpl)}` : '—',              color: '#FB7185' },
                        { label: 'Cliques',  value: fmtK(e.cliques),                                   color: '#60A5FA' },
                        { label: 'ROAS',     value: e.roas > 0 ? `${e.roas.toFixed(1)}x` : '—',       color: '#00C47A' },
                        { label: 'Uso %',    value: `${pct.toFixed(0)}%`,                              color: '#FFD700' },
                        { label: 'CPM',      value: e.alcance > 0 ? `R$${fmt((e.investido / e.alcance) * 1000)}` : '—', color: '#F97316' },
                      ].map(({ label, value, color }) => (
                        <Box key={label} sx={{
                          bgcolor: `${color}0c`,
                          border: `1px solid ${color}20`,
                          borderRadius: 1.5, p: { xs: 0.6, xl: 0.8 }, textAlign: 'center',
                          transition: 'all 0.2s ease',
                          '&:hover': { bgcolor: `${color}18`, transform: 'translateY(-1px)' },
                        }}>
                          <Typography sx={{ fontSize: { xs: '0.72rem', xl: '0.85rem' }, fontWeight: 800, color, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
                            {value}
                          </Typography>
                          <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {label}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {e.obs && (
                      <Typography sx={{
                        fontSize: { xs: '0.7rem', xl: '0.75rem' }, color: 'text.secondary',
                        fontStyle: 'italic', display: 'block',
                        bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1, px: 1, py: 0.5,
                        borderLeft: '2px solid rgba(255,255,255,0.08)', ml: 1,
                      }}>
                        📝 {e.obs}
                      </Typography>
                    )}
                  </>
                )}
              </Paper>
            </Grid>
          )
        })}
      </Grid>

      <Box sx={{ height: 80 }} />

      {/* Dialog: edição de campanha */}
      <Dialog
        open={!!editClient}
        onClose={() => setEditClient(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 0 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <AdsClickIcon sx={{ color: '#1877F2', fontSize: '1.1rem' }} />
            {editClient}
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack gap={2}>
            <Stack direction="row" gap={1.5}>
              <TextField select fullWidth size="small" label="Plataforma" value={draft.plataforma} onChange={e => setD('plataforma', e.target.value as Plataforma)}>
                {(Object.entries(PLAT_CFG) as [Plataforma, typeof PLAT_CFG[Plataforma]][]).map(([k, cfg]) => (
                  <MenuItem key={k} value={k}>{cfg.emoji} {cfg.label}</MenuItem>
                ))}
              </TextField>
              <TextField select fullWidth size="small" label="Status" value={draft.status} onChange={e => setD('status', e.target.value as CampanhaStatus)}>
                {(Object.entries(STATUS_CFG) as [CampanhaStatus, typeof STATUS_CFG[CampanhaStatus]][]).map(([k, cfg]) => (
                  <MenuItem key={k} value={k}>{cfg.label}</MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction="row" gap={1.5}>
              <TextField fullWidth size="small" label="Budget mensal (R$)" type="number" value={draft.budget || ''} onChange={e => setD('budget', parseFloat(e.target.value) || 0)} InputProps={{ inputProps: { min: 0, step: 50 } }} />
              <TextField fullWidth size="small" label="Investido até hoje (R$)" type="number" value={draft.investido || ''} onChange={e => setD('investido', parseFloat(e.target.value) || 0)} InputProps={{ inputProps: { min: 0, step: 10 } }} />
            </Stack>

            <Divider sx={{ opacity: 0.3 }}>
              <Typography variant="caption" color="text.secondary">KPIs</Typography>
            </Divider>

            <Stack direction="row" gap={1.5}>
              <TextField fullWidth size="small" label="Alcance" type="number" value={draft.alcance || ''} onChange={e => setD('alcance', parseInt(e.target.value) || 0)} />
              <TextField fullWidth size="small" label="Cliques" type="number" value={draft.cliques || ''} onChange={e => setD('cliques', parseInt(e.target.value) || 0)} />
            </Stack>

            <Stack direction="row" gap={1.5}>
              <TextField fullWidth size="small" label="CPL — Custo por Lead (R$)" type="number" value={draft.cpl || ''} onChange={e => setD('cpl', parseFloat(e.target.value) || 0)} InputProps={{ inputProps: { min: 0, step: 0.01 } }} />
              <TextField fullWidth size="small" label="ROAS (ex: 3.5)" type="number" value={draft.roas || ''} onChange={e => setD('roas', parseFloat(e.target.value) || 0)} InputProps={{ inputProps: { min: 0, step: 0.1 } }} />
            </Stack>

            <Divider sx={{ opacity: 0.3 }}>
              <Typography variant="caption" color="text.secondary">Responsável & Links</Typography>
            </Divider>

            <TextField select fullWidth size="small" label="Gestor responsável" value={draft.responsavel} onChange={e => setD('responsavel', e.target.value)}>
              <MenuItem value="">— Nenhum —</MenuItem>
              {GESTORES.map(g => (
                <MenuItem key={g} value={g}>{NAME_MAP[g].emoji} {getDisplayName(g)}</MenuItem>
              ))}
            </TextField>

            <TextField fullWidth size="small" label="Link do gerenciador de anúncios" placeholder="https://business.facebook.com/adsmanager/..." value={draft.managerUrl} onChange={e => setD('managerUrl', e.target.value)} />

            <TextField fullWidth size="small" label="Observações / Status da campanha" multiline minRows={2} maxRows={4} placeholder="Ex: Criativos em aprovação, aguardando liberação do cliente..." value={draft.obs} onChange={e => setD('obs', e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditClient(null)} color="inherit" size="small">Cancelar</Button>
          <Button onClick={saveEdit} variant="contained" size="small" sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #1877F2, #0d5ecc)' }}>
            Salvar campanha
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Configurar Meta Ads */}
      <Dialog open={metaOpen} onClose={() => !metaSyncing && setMetaOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3, border: '1px solid rgba(24,119,242,0.25)', bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>📘</Typography>
            </Box>
            <Box>
              <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>Conectar Meta Ads</Typography>
              <Typography variant="caption" color="text.secondary">
                Importe campanhas automaticamente do Meta Business Manager
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
              Acesse <strong>Meta Business Suite → Configurações → Tokens de acesso</strong> para gerar um token com permissão <code>ads_read</code>.
            </Alert>
            <TextField fullWidth size="small" label="Access Token" placeholder="EAAxxxxx..." value={metaToken} onChange={e => setMetaToken(e.target.value)} disabled={metaSyncing} type="password" helperText="Token de acesso do sistema com permissão ads_read" />
            <TextField fullWidth size="small" label="Ad Account ID" placeholder="123456789" value={metaAccount} onChange={e => setMetaAccount(e.target.value)} disabled={metaSyncing} helperText="ID da conta de anúncios (sem o prefixo 'act_')" />
            {metaError && <Alert severity="error" sx={{ fontSize: '0.75rem' }}>{metaError}</Alert>}
            {metaSaved && <Alert severity="success" sx={{ fontSize: '0.75rem' }}>Credenciais salvas e validadas!</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setMetaOpen(false)} size="small" color="inherit" disabled={metaSyncing}>Cancelar</Button>
          <Button
            onClick={handleMetaSave}
            size="small" variant="contained"
            disabled={metaSyncing || !metaToken.trim() || !metaAccount.trim()}
            startIcon={metaSyncing ? <CircularProgress size={11} color="inherit" /> : <LinkIcon sx={{ fontSize: 14 }} />}
            sx={{ fontWeight: 700, bgcolor: '#1877F2', '&:hover': { bgcolor: '#1565d8' } }}
          >
            {metaSyncing ? 'Validando…' : 'Conectar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
