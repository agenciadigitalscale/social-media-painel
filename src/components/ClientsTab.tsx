import { lazy, Suspense, useMemo, useState } from 'react'
import {
  Box, Typography, Card, CardContent, LinearProgress,
  IconButton, Tooltip, Chip, Paper, Divider, Badge, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress,
  Menu, MenuItem,
} from '@mui/material'
import TableChartIcon from '@mui/icons-material/TableChart'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import MovieIcon from '@mui/icons-material/Movie'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import BoltIcon from '@mui/icons-material/Bolt'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import AssessmentIcon from '@mui/icons-material/Assessment'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import LinkIcon from '@mui/icons-material/Link'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import RefreshIcon from '@mui/icons-material/Refresh'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import GridViewIcon from '@mui/icons-material/GridView'
import type { Client, ContentItem, ItemState, Roteiro, Status } from '../types'
import { STATUS_CONFIG } from '../types'
import HintCard from './HintCard'
import RoteirosModal from './RoteirosModal'
import ClientAvatar from './ClientAvatar'
import MonthlyReportModal from './MonthlyReportModal'
import ReportGeneratorModal from './ReportGeneratorModal'
import { ClientContextStore } from '../lib/clientContext'
import ApprovalGallery from './ApprovalGallery'

const ClientContextModal = lazy(() => import('./ClientContextModal'))

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const PALETTE = ['#ff9039','#3B8EFF','#00C47A','#FFD700','#C084FC','#FF5722','#00BCD4','#34D399']

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  roteiros: Record<string, Roteiro[]>
  clientFolders: Record<string, string>
  clientColors: Record<string, string>
  allClients: Client[]
  onAddRoteiro: (clientName: string, r: Omit<Roteiro, 'id' | 'clientName' | 'distributed'>, year: number, month: number) => void
  onAddManyRoteiros: (clientName: string, list: Omit<Roteiro, 'id' | 'clientName' | 'distributed'>[], year: number, month: number) => void
  onBulkCreate: (clientName: string, posts: number, reels: number, year: number, month: number) => void
  onDistributeAll: (year: number, month: number) => void
  onStartNewMonth: (year: number, month: number) => void
  onAddClient: (client: Client) => void
  onDeleteClient: (clientName: string) => void
  onRemoveRoteiro: (clientName: string, id: string) => void
  onRedistribute: (clientName: string, year: number, month: number) => void
  onClearDistribution: (clientName: string, year: number, month: number) => void
  onSetClientFolder: (clientName: string, url: string) => void
  onSetClientColor: (clientName: string, color: string) => void
  onClientFocus: (clientName: string) => void
  onStatusChange?: (id: number, s: Status) => void
  onBulkSendToClient?: (clientName: string, itemIds: number[]) => void
  clientPhones: Record<string, string>
  onSetClientPhone: (clientName: string, phone: string) => void
}

export default function ClientsTab({
  items, states, roteiros, clientFolders, clientColors, allClients,
  onAddRoteiro, onAddManyRoteiros, onBulkCreate, onDistributeAll, onStartNewMonth, onAddClient, onDeleteClient,
  onRemoveRoteiro, onRedistribute, onClearDistribution, onSetClientFolder, onSetClientColor, onClientFocus,
  onStatusChange, onBulkSendToClient,
  clientPhones, onSetClientPhone,
}: Props) {
  const [roteiroClient, setRoteiroClient] = useState<string | null>(null)
  const [showDistributeAll, setShowDistributeAll] = useState(false)
  const [showNewMonth, setShowNewMonth] = useState(false)
  const [newMonthIdx, setNewMonthIdx] = useState(1)
  const [showReport, setShowReport] = useState(false)
  const [distributeAllMonth, setDistributeAllMonth] = useState(new Date().getMonth())
  const [distributeAllYear, setDistributeAllYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [showAddClient, setShowAddClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientPosts, setNewClientPosts] = useState(8)
  const [newClientReels, setNewClientReels] = useState(4)
  const [deleteConfirmClient, setDeleteConfirmClient] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [clientTypeFilter, setClientTypeFilter] = useState<'all' | 'mensal' | 'freelancer'>('all')

  // Per-month hidden clients — não afeta outros meses
  const [monthHidden, setMonthHidden] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem('sm_hidden_clients_monthly') ?? '{}') } catch { return {} }
  })
  const monthKey = `${viewYear}-${viewMonth}`

  function hideForMonth(name: string) {
    setMonthHidden(prev => {
      const next = { ...prev, [monthKey]: [...(prev[monthKey] ?? []), name] }
      localStorage.setItem('sm_hidden_clients_monthly', JSON.stringify(next))
      return next
    })
  }
  function restoreForMonth(name: string) {
    setMonthHidden(prev => {
      const next = { ...prev, [monthKey]: (prev[monthKey] ?? []).filter(c => c !== name) }
      localStorage.setItem('sm_hidden_clients_monthly', JSON.stringify(next))
      return next
    })
  }

  // ── Item 1: Client types (mensal / freelancer) ────────────
  const [clientTypes, setClientTypes] = useState<Record<string, 'mensal' | 'freelancer'>>(() => {
    try { return JSON.parse(localStorage.getItem('sm_client_types') ?? '{}') } catch { return {} }
  })
  const [freelancerMonths, setFreelancerMonths] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem('sm_freelancer_months') ?? '{}') } catch { return {} }
  })

  function toggleClientType(name: string) {
    const next = { ...clientTypes, [name]: (clientTypes[name] ?? 'mensal') === 'mensal' ? 'freelancer' as const : 'mensal' as const }
    setClientTypes(next)
    localStorage.setItem('sm_client_types', JSON.stringify(next))
  }
  function toggleFreelancerMonth(name: string, key: string) {
    const months = freelancerMonths[name] ?? []
    const next = months.includes(key) ? months.filter(m => m !== key) : [...months, key]
    const nextAll = { ...freelancerMonths, [name]: next }
    setFreelancerMonths(nextAll)
    localStorage.setItem('sm_freelancer_months', JSON.stringify(nextAll))
  }

  // ── Item 2: Client display name rename ────────────────────
  const [clientDisplayNames, setClientDisplayNames] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('sm_client_display_names') ?? '{}') } catch { return {} }
  })
  const [renamingClient, setRenamingClient] = useState<string | null>(null)
  const [renameClientInput, setRenameClientInput] = useState('')

  function applyRenameClient() {
    if (!renamingClient) return
    const trimmed = renameClientInput.trim()
    const next = trimmed ? { ...clientDisplayNames, [renamingClient]: trimmed } : (() => {
      const n = { ...clientDisplayNames }; delete n[renamingClient]; return n
    })()
    setClientDisplayNames(next)
    localStorage.setItem('sm_client_display_names', JSON.stringify(next))
    setRenamingClient(null)
  }

  // ── Item 3: Delete from month onwards ────────────────────
  const [clientDeletedFrom, setClientDeletedFrom] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('sm_client_deleted_from') ?? '{}') } catch { return {} }
  })
  const [deleteFromConfirm, setDeleteFromConfirm] = useState<string | null>(null)
  const [clientOptionsAnchor, setClientOptionsAnchor] = useState<HTMLElement | null>(null)
  const [clientOptionsName, setClientOptionsName] = useState<string | null>(null)

  function deleteClientFromMonth(name: string) {
    const next = { ...clientDeletedFrom, [name]: monthKey }
    setClientDeletedFrom(next)
    localStorage.setItem('sm_client_deleted_from', JSON.stringify(next))
    setDeleteFromConfirm(null)
  }

  const [reportClient, setReportClient] = useState<string | null>(null)
  const [portalClient, setPortalClient]   = useState<string | null>(null)
  const [portalLink, setPortalLink]       = useState('')
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalCopied, setPortalCopied]   = useState(false)
  const [phoneEditClient, setPhoneEditClient] = useState<string | null>(null)
  const [phoneInput, setPhoneInput] = useState('')
  const [nichoFilter, setNichoFilter] = useState<'all' | 'gastronomico' | 'variados'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [aiContextClient, setAiContextClient] = useState<string | null>(null)
  const [galleryClient, setGalleryClient] = useState<string | null>(null)

  const hiddenThisMonth = monthHidden[monthKey] ?? []
  const hiddenClientList = allClients.filter(c => hiddenThisMonth.includes(c.name))

  const visibleClients = useMemo(() => {
    return allClients.filter(c => {
      if (!showHidden && hiddenThisMonth.includes(c.name)) return false
      const deletedFrom = clientDeletedFrom[c.name]
      if (deletedFrom) {
        const [dy, dm] = deletedFrom.split('-').map(Number)
        if (viewYear > dy || (viewYear === dy && viewMonth >= dm)) return false
      }
      const type = clientTypes[c.name] ?? 'mensal'
      if (type === 'freelancer') {
        if (!(freelancerMonths[c.name] ?? []).includes(monthKey)) return false
      }
      return true
    })
  }, [allClients, showHidden, hiddenThisMonth, clientDeletedFrom, clientTypes, freelancerMonths, monthKey, viewYear, viewMonth])

  const clientStats = useMemo(() => {
    return visibleClients.map(client => {
      const clientItems    = items.filter(i =>
        i.c === client.name &&
        i.dt.getFullYear() === viewYear &&
        i.dt.getMonth() === viewMonth,
      )
      const posts          = clientItems.filter(i => i.tp === 'Post')
      const reels          = clientItems.filter(i => i.tp === 'Reel')
      const postsPublished = posts.filter(i => (states[i.i]?.status ?? i.s) === 7).length
      const reelsPublished = reels.filter(i => (states[i.i]?.status ?? i.s) === 7).length
      const total          = posts.length + reels.length
      const totalDone      = postsPublished + reelsPublished
      const pct            = total > 0 ? Math.round((totalDone / total) * 100) : 0
      const monthRoteiros  = (roteiros[client.name] ?? []).filter(r =>
        !r.year || (r.year === viewYear && r.month === viewMonth),
      )
      const roteiroCount   = monthRoteiros.length
      const distributed    = monthRoteiros.some(r => r.distributed)
      const customCount    = items.filter(i =>
        i.c === client.name && i.custom &&
        i.dt.getFullYear() === viewYear && i.dt.getMonth() === viewMonth,
      ).length

      const today = new Date(); today.setHours(0, 0, 0, 0)
      const lateCount     = clientItems.filter(i => (states[i.i]?.status ?? i.s) !== 7 && i.dt < today).length
      const rejectedCount = clientItems.filter(i => (states[i.i]?.status ?? i.s) === 6).length
      const awaitingCount = clientItems.filter(i => [2, 4].includes(states[i.i]?.status ?? i.s)).length
      const hasFolder     = !!clientFolders[client.name]
      const statusCounts = [0, 1, 2, 3, 4, 5, 6, 7].map(s =>
        clientItems.filter(i => (states[i.i]?.status ?? i.s) === s).length
      ) as [number, number, number, number, number, number, number, number]

      // Health score 0-100
      const healthBase     = pct * 0.5                             // 50pts: published progress
      const healthOntime   = Math.max(0, 30 - lateCount * 6)      // 30pts: on-time delivery
      const healthApproval = Math.max(0, 15 - rejectedCount * 8)  // 15pts: no rejections
      const healthDrive    = hasFolder ? 5 : 0                    //  5pts: drive configured
      const healthScore    = Math.min(100, Math.round(healthBase + healthOntime + healthApproval + healthDrive))

      return {
        ...client,
        postsTotal: posts.length || client.postsPerMonth,
        reelsTotal: reels.length || client.reelsPerMonth,
        postsPublished, reelsPublished, totalDone, total, pct,
        roteiroCount, distributed, customCount,
        lateCount, rejectedCount, awaitingCount, hasFolder, healthScore, statusCounts,
      }
    }).sort((a, b) => a.pct - b.pct)
  }, [visibleClients, items, states, roteiros, clientFolders, viewYear, viewMonth])

  const globalStats = useMemo(() => {
    const total = clientStats.reduce((s: number, c) => s + c.total, 0)
    const done  = clientStats.reduce((s: number, c) => s + c.totalDone, 0)
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
  }, [clientStats])

  const done100    = clientStats.filter(c => c.pct === 100).length
  const inProgress = clientStats.filter(c => c.pct > 0 && c.pct < 100).length
  const notStarted = clientStats.filter(c => c.pct === 0).length

  const monthOptions = useMemo(() => {
    const opts: { year: number; month: number; label: string }[] = []
    // Começa em Maio/2026 (primeiro mês com dados) e vai até 12 meses à frente do atual
    let y = 2026, m = 4  // maio = índice 4
    const now = new Date()
    const limitYear = now.getFullYear()
    const limitMonth = now.getMonth() + 12
    while (y < limitYear || (y === limitYear && m <= limitMonth) || opts.length < 1) {
      opts.push({ year: y, month: m, label: `${MONTH_NAMES[m]}/${String(y).slice(2)}` })
      m++
      if (m > 11) { m = 0; y++ }
      if (opts.length > 30) break
    }
    return opts
  }, [])

  const selectedRoteiros      = roteiroClient ? (roteiros[roteiroClient] ?? []) : []
  const selectedDistribCount  = roteiroClient ? items.filter(i => i.c === roteiroClient && i.custom).length : 0
  const selectedFolder        = roteiroClient ? (clientFolders[roteiroClient] ?? '') : ''

  // ── Briefing ──────────────────────────────────────────────
  const [briefingClient, setBriefingClient]   = useState<string | null>(null)
  const [briefingLink, setBriefingLink]       = useState('')
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingCopied, setBriefingCopied]   = useState(false)
  const [briefingData, setBriefingData]       = useState<Record<string, unknown> | null>(null)
  const [briefingFilled, setBriefingFilled]   = useState<Record<string, boolean>>({})
  const [viewBriefing, setViewBriefing]       = useState(false)

  const openBriefing = async (clientName: string) => {
    setBriefingClient(clientName)
    setBriefingLink('')
    setBriefingData(null)
    setBriefingCopied(false)
    setViewBriefing(false)
    setBriefingLoading(true)
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', clientName }),
      }).then(r => r.json()) as { ok: boolean; token?: string }
      if (res.ok && res.token) {
        const url = `${window.location.origin}/briefing/${res.token}`
        setBriefingLink(url)
        // Check if already filled
        const check = await fetch(`/api/briefing?token=${res.token}`).then(r => r.json()) as { ok: boolean; data?: Record<string, unknown> }
        if (check.ok && check.data) {
          setBriefingData(check.data)
          setBriefingFilled(prev => ({ ...prev, [clientName]: true }))
        }
      }
    } finally {
      setBriefingLoading(false)
    }
  }

  const openPortal = async (clientName: string, revoke = false) => {
    setPortalClient(clientName)
    setPortalLink('')
    setPortalLoading(true)
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: revoke ? 'revoke' : 'generate', clientName }),
      }).then(r => r.json())
      if (res.ok) {
        const url = `${window.location.origin}/c/${res.token}`
        setPortalLink(url)
      }
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* ── Resumo geral ─────────────────────────────── */}
      <Paper sx={{ p: 2, border: '1px solid rgba(255,144,57,0.15)', background: 'rgba(20,20,20,0.98)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <TrendingUpIcon sx={{ color: 'primary.main', fontSize: 18 }} />
          <Typography variant="subtitle2" fontWeight={700}>Progresso Geral</Typography>
          <Button size="small" startIcon={<AssessmentIcon sx={{ fontSize: 13 }} />} onClick={() => setShowReport(true)}
            sx={{ ml: 'auto', fontSize: '0.6rem', color: 'primary.main' }}>
            Relatório
          </Button>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 1.5 }}>
          {[
            { label: 'Concluídos',    value: done100,    color: 'success.main' },
            { label: 'Em andamento',  value: inProgress, color: 'warning.main' },
            { label: 'Não iniciados', value: notStarted, color: 'error.main' },
          ].map(s => (
            <Box key={s.label} sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: s.color, lineHeight: 1 }}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.58rem' }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Total do mês</Typography>
          <Typography variant="caption" fontWeight={700} color={globalStats.pct === 100 ? 'success.main' : 'primary.main'}>
            {globalStats.done}/{globalStats.total} · {globalStats.pct}%
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={globalStats.pct} color={globalStats.pct === 100 ? 'success' : 'primary'} sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.06)' }} />
      </Paper>

      <HintCard text="Toque em 'Roteiros' para adicionar scripts — eles vão direto para o calendário. Cole a pasta do Drive e todos os roteiros herdam o link." />
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

      {/* ── Ações globais ─────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          fullWidth variant="contained" size="small"
          startIcon={<CalendarMonthIcon />}
          onClick={() => setShowNewMonth(true)}
          sx={{ fontWeight: 700, background: '#F97316', fontSize: '0.65rem' }}
        >
          Iniciar Novo Mês
        </Button>
        <Button
          size="small" variant="outlined" color="primary"
          startIcon={<PersonAddIcon />}
          onClick={() => setShowAddClient(true)}
          sx={{ fontWeight: 700, fontSize: '0.65rem', whiteSpace: 'nowrap' }}
        >
          Novo cliente
        </Button>
      </Box>

      {/* ── Seletor de mês ──────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="overline" color="primary.main" fontWeight={700} sx={{ letterSpacing: 1, flexShrink: 0 }}>
          {visibleClients.length} Clientes Ativos
        </Typography>
        {hiddenClientList.length > 0 && (
          <Box
            onClick={() => setShowHidden(v => !v)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
              px: 1, py: 0.3, borderRadius: '6px',
              bgcolor: showHidden ? 'rgba(255,144,57,0.12)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${showHidden ? 'rgba(255,144,57,0.3)' : 'rgba(255,255,255,0.08)'}`,
              '&:hover': { bgcolor: 'rgba(255,144,57,0.1)' },
              transition: 'all 0.15s ease',
            }}
          >
            <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: showHidden ? '#ff9039' : 'rgba(255,255,255,0.4)' }}>
              {showHidden ? '🙈 Ocultar' : `👁 +${hiddenClientList.length} oculto${hiddenClientList.length > 1 ? 's' : ''} neste mês`}
            </Typography>
          </Box>
        )}
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {monthOptions.map(opt => {
            const active = opt.month === viewMonth && opt.year === viewYear
            return (
              <Chip
                key={opt.label} label={opt.label} size="small"
                variant={active ? 'filled' : 'outlined'}
                color={active ? 'primary' : 'default'}
                onClick={() => { setViewMonth(opt.month); setViewYear(opt.year) }}
                sx={{ fontSize: '0.58rem', height: 20, cursor: 'pointer' }}
              />
            )
          })}
        </Box>
      </Box>

      {/* ── Tipo de cliente: Mensal / Freelancer ──────── */}
      {(() => {
        const mensalCount     = visibleClients.filter(c => (clientTypes[c.name] ?? 'mensal') === 'mensal').length
        const freelancerCount = visibleClients.filter(c => clientTypes[c.name] === 'freelancer').length
        const tabs = [
          { key: 'all',        label: 'Todos',      count: visibleClients.length, color: '#ff9039',  icon: '👥' },
          { key: 'mensal',     label: 'Mensais',    count: mensalCount,           color: '#3B8EFF',  icon: '📅' },
          { key: 'freelancer', label: 'Freelancer', count: freelancerCount,       color: '#C084FC',  icon: '⚡' },
        ] as const
        return (
          <Box sx={{ display: 'flex', gap: 1, p: 0.5, borderRadius: '14px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {tabs.map(tab => {
              const active = clientTypeFilter === tab.key
              return (
                <Box
                  key={tab.key}
                  onClick={() => setClientTypeFilter(tab.key)}
                  sx={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8,
                    px: 2, py: 0.9, borderRadius: '10px', cursor: 'pointer',
                    bgcolor: active ? `${tab.color}18` : 'transparent',
                    border: `1px solid ${active ? `${tab.color}35` : 'transparent'}`,
                    boxShadow: active ? `0 0 12px ${tab.color}22` : 'none',
                    transition: 'all 0.18s ease',
                    '&:hover': { bgcolor: `${tab.color}12`, border: `1px solid ${tab.color}25` },
                  }}
                >
                  <Typography sx={{ fontSize: '0.75rem' }}>{tab.icon}</Typography>
                  <Typography sx={{
                    fontSize: { md: '0.72rem', xl: '0.8rem' }, fontWeight: 700,
                    color: active ? tab.color : 'rgba(255,255,255,0.45)',
                    letterSpacing: '-0.01em',
                    transition: 'color 0.18s ease',
                  }}>
                    {tab.label}
                  </Typography>
                  <Box sx={{
                    minWidth: 22, height: 18, px: 0.6, borderRadius: '6px',
                    bgcolor: active ? `${tab.color}28` : 'rgba(255,255,255,0.07)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.18s ease',
                  }}>
                    <Typography sx={{ fontSize: '0.58rem', fontWeight: 800, color: active ? tab.color : 'rgba(255,255,255,0.35)' }}>
                      {tab.count}
                    </Typography>
                  </Box>
                </Box>
              )
            })}
          </Box>
        )
      })()}

      {/* ── Nicho filter tabs ────────────────────────── */}
      <Box sx={{ display: 'flex', borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, alignSelf: 'flex-start' }}>
        {([
          { key: 'all',         label: '🌐 Todos',          color: '#ff9039' },
          { key: 'gastronomico',label: '🍽️ Gastronômico',   color: '#FF6B6B' },
          { key: 'variados',    label: '🎯 Variados',        color: '#60A5FA' },
        ] as const).map((tab, idx, arr) => {
          const count = tab.key === 'all'
            ? allClients.length
            : allClients.filter(c => c.nicho === tab.key).length
          return (
            <Box key={tab.key} onClick={() => setNichoFilter(tab.key)} sx={{
              px: 1.5, py: 0.6, cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 0.5,
              bgcolor: nichoFilter === tab.key ? `${tab.color}18` : 'transparent',
              color: nichoFilter === tab.key ? tab.color : 'rgba(255,255,255,0.35)',
              borderRight: idx < arr.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              transition: 'all 0.15s',
              '&:hover': { bgcolor: `${tab.color}10`, color: tab.color },
            }}>
              {tab.label}
              <Box sx={{
                minWidth: 18, height: 16, borderRadius: 8, px: 0.5,
                bgcolor: nichoFilter === tab.key ? `${tab.color}22` : 'rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography sx={{ fontSize: '0.5rem', fontWeight: 800, color: nichoFilter === tab.key ? tab.color : 'rgba(255,255,255,0.4)' }}>
                  {count}
                </Typography>
              </Box>
            </Box>
          )
        })}
      </Box>

      {/* ── Busca de cliente ────────────────────────── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 1.2, py: 0.7, borderRadius: 2,
        bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <ZoomInIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
        <TextField
          variant="standard" size="small" placeholder="Buscar cliente..." fullWidth
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          InputProps={{ disableUnderline: true }}
          inputProps={{ style: { fontSize: '0.78rem', padding: 0 } }}
        />
        {searchQuery && (
          <Box onClick={() => setSearchQuery('')} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.5, '&:hover': { opacity: 1 } }}>
            <DeleteOutlineIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          </Box>
        )}
      </Box>

      {/* ── Grid de clientes ─────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { md: '1fr', lg: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: { md: 1.5, lg: 2, xl: 2 } }}>
        {clientStats.filter(client =>
          (clientTypeFilter === 'all' || (clientTypes[client.name] ?? 'mensal') === clientTypeFilter) &&
          (nichoFilter === 'all' || client.nicho === nichoFilter) &&
          (!searchQuery || client.name.toLowerCase().includes(searchQuery.toLowerCase()))
        ).map(client => {
          const postPct   = client.postsTotal > 0 ? Math.round((client.postsPublished / client.postsTotal) * 100) : 0
          const reelPct   = client.reelsTotal > 0 ? Math.round((client.reelsPublished / client.reelsTotal) * 100) : 0
          const hasFolder = client.hasFolder
          const accentColor = clientColors[client.name] ?? '#ff9039'
          const healthColor = client.healthScore >= 80 ? '#00C47A' : client.healthScore >= 50 ? '#FFD700' : '#FF4545'
          const isHiddenThisMonth = hiddenThisMonth.includes(client.name)

          return (
            <Card
              key={client.name}
              sx={{
                position: 'relative', overflow: 'visible',
                border: `1px solid ${client.pct === 100 ? 'rgba(0,196,122,0.22)' : `${accentColor}22`}`,
                borderLeft: `4px solid ${isHiddenThisMonth ? 'rgba(255,255,255,0.12)' : accentColor}`,
                opacity: isHiddenThisMonth ? 0.45 : 1,
                filter: isHiddenThisMonth ? 'grayscale(0.5)' : 'none',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: isHiddenThisMonth ? 'none' : 'translateY(-2px)',
                  boxShadow: `0 8px 32px ${accentColor}18, 0 2px 8px rgba(0,0,0,0.5)`,
                  borderColor: `${accentColor}44`,
                },
              }}
            >
              {/* Faixa "oculto neste mês" + botão restaurar */}
              {isHiddenThisMonth && (
                <Box sx={{
                  position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  px: 2, py: 0.7, borderRadius: '16px 16px 0 0',
                  bgcolor: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.06em' }}>
                    OCULTO NESTE MÊS
                  </Typography>
                  <Box onClick={() => restoreForMonth(client.name)} sx={{
                    cursor: 'pointer', px: 1, py: 0.3, borderRadius: '6px',
                    bgcolor: 'rgba(255,144,57,0.12)', border: '1px solid rgba(255,144,57,0.25)',
                    color: '#ff9039', fontSize: '0.62rem', fontWeight: 700,
                    '&:hover': { bgcolor: 'rgba(255,144,57,0.2)' },
                  }}>↩ Restaurar</Box>
                </Box>
              )}

              <CardContent sx={{ p: { md: 1.8, xl: 2.2 }, '&:last-child': { pb: { md: 1.8, xl: 2.2 } } }}>

                {/* ── Header: avatar + nome + score + ações ──── */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.8 }}>
                  <ClientAvatar name={client.name} size={44} />

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.3 }}>
                      <Typography fontWeight={800} sx={{ fontSize: { md: '0.9rem', xl: '1rem' }, lineHeight: 1.15, color: 'rgba(255,255,255,0.95)' }} noWrap>
                        {clientDisplayNames[client.name] ?? client.name}
                      </Typography>
                      {(clientTypes[client.name] ?? 'mensal') === 'freelancer' && (
                        <Box sx={{ px: 0.7, py: 0.2, borderRadius: '5px', fontSize: '0.5rem', fontWeight: 800, bgcolor: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.3)', color: '#C084FC', lineHeight: 1, letterSpacing: '0.05em', flexShrink: 0 }}>
                          FREELANCER
                        </Box>
                      )}
                    </Box>
                    {client.subnicho && (
                      <Typography sx={{ fontSize: { md: '0.62rem', xl: '0.68rem' }, color: client.nicho === 'gastronomico' ? '#FF6B6B' : '#60A5FA', fontWeight: 600, lineHeight: 1 }}>
                        {client.nicho === 'gastronomico' ? '🍽️' : '🎯'} {client.subnicho}
                      </Typography>
                    )}

                    {/* Paleta de cores */}
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.8, flexWrap: 'wrap', opacity: 0.65, '&:hover': { opacity: 1 }, transition: 'opacity 0.2s' }}>
                      {PALETTE.map(c => (
                        <Box key={c} onClick={() => onSetClientColor(client.name, c)} sx={{
                          width: 12, height: 12, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                          border: clientColors[client.name] === c ? '2px solid #fff' : '2px solid transparent',
                          transition: 'transform 0.15s', '&:hover': { transform: 'scale(1.3)' },
                        }} />
                      ))}
                    </Box>
                  </Box>

                  {/* KPIs right: % + health */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
                    <Box sx={{
                      px: 1.2, py: 0.4, borderRadius: '8px',
                      bgcolor: client.pct === 100 ? 'rgba(0,196,122,0.12)' : client.pct >= 50 ? 'rgba(255,215,0,0.1)' : 'rgba(255,69,69,0.1)',
                      border: `1.5px solid ${client.pct === 100 ? 'rgba(0,196,122,0.35)' : client.pct >= 50 ? 'rgba(255,215,0,0.3)' : 'rgba(255,69,69,0.3)'}`,
                    }}>
                      <Typography sx={{ fontSize: { md: '1rem', xl: '1.1rem' }, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em', color: client.pct === 100 ? '#00C47A' : client.pct >= 50 ? '#FFD700' : '#FF4545' }}>
                        {client.pct}%
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: healthColor, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: { md: '0.62rem', xl: '0.68rem' }, fontWeight: 700, color: healthColor }}>
                        {client.healthScore}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* ── Barras de progresso ──────────────────────── */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2, mb: 1.5 }}>
                  {[
                    { label: 'Posts 🖼️', done: client.postsPublished, total: client.postsTotal, pct: postPct },
                    { label: 'Reels 🎬', done: client.reelsPublished, total: client.reelsTotal, pct: reelPct },
                  ].map(({ label, done, total, pct }) => (
                    <Box key={label}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.6 }}>
                        <Typography sx={{ fontSize: { md: '0.65rem', xl: '0.72rem' }, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {label}
                        </Typography>
                        <Typography sx={{ fontSize: { md: '0.72rem', xl: '0.78rem' }, color: pct === 100 ? '#00C47A' : 'rgba(255,255,255,0.7)', fontWeight: 800 }}>
                          {done}/{total}
                        </Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={pct} sx={{
                        height: 6, borderRadius: 3,
                        bgcolor: 'rgba(255,255,255,0.07)',
                        '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? '#00C47A' : accentColor, borderRadius: 3 },
                      }} />
                    </Box>
                  ))}
                </Box>

                {/* ── Funil de status ───────────────────────────── */}
                {client.total > 0 && (
                  <Box sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
                      <Typography sx={{ fontSize: { md: '0.62rem', xl: '0.68rem' }, color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Funil de produção
                      </Typography>
                      <Typography sx={{ fontSize: { md: '0.65rem', xl: '0.7rem' }, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                        {client.total} conteúdos
                      </Typography>
                    </Box>
                    <Tooltip title={
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                        {([0,1,2,3,4,5,6,7] as Status[]).map(s => client.statusCounts[s] > 0 && (
                          <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: STATUS_CONFIG[s].color, flexShrink: 0 }} />
                            <Typography sx={{ fontSize: '0.7rem', color: '#fff' }}>{STATUS_CONFIG[s].label}: <strong>{client.statusCounts[s]}</strong></Typography>
                          </Box>
                        ))}
                      </Box>
                    }>
                      <Box sx={{ display: 'flex', height: 10, borderRadius: '5px', overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.05)', gap: '1px' }}>
                        {([0,1,2,3,4,5,6,7] as Status[]).map(s => {
                          const cnt = client.statusCounts[s]; if (cnt === 0) return null
                          return <Box key={s} sx={{ width: `${(cnt/client.total)*100}%`, bgcolor: STATUS_CONFIG[s].color, opacity: 0.85, minWidth: 3 }} />
                        })}
                      </Box>
                    </Tooltip>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.7 }}>
                      {(() => {
                        const prod = client.statusCounts[0]+client.statusCounts[1]+client.statusCounts[2]+client.statusCounts[3]
                        const cli  = client.statusCounts[4]+client.statusCounts[5]+client.statusCounts[6]
                        const pub  = client.statusCounts[7]
                        return (<>
                          {prod > 0 && <Typography sx={{ fontSize: { md: '0.62rem', xl: '0.68rem' }, color: '#A1A1AA', fontWeight: 700 }}>⚙️ {prod} prod.</Typography>}
                          {cli  > 0 && <Typography sx={{ fontSize: { md: '0.62rem', xl: '0.68rem' }, color: '#FF9A3D', fontWeight: 700 }}>👤 {cli} cliente</Typography>}
                          {pub  > 0 && <Typography sx={{ fontSize: { md: '0.62rem', xl: '0.68rem' }, color: '#00C47A', fontWeight: 700 }}>✓ {pub} pub.</Typography>}
                        </>)
                      })()}
                    </Box>
                  </Box>
                )}

                {/* ── Alertas ─────────────────────────────────── */}
                {(client.rejectedCount > 0 || client.lateCount > 0 || client.awaitingCount > 0 || !hasFolder) && (
                  <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', mb: 1.5 }}>
                    {client.rejectedCount > 0 && (
                      <Chip label={`🔄 ${client.rejectedCount} reprovado${client.rejectedCount > 1 ? 's' : ''}`} size="small"
                        sx={{ fontSize: { md: '0.62rem', xl: '0.68rem' }, height: 22, bgcolor: 'rgba(255,69,69,0.12)', color: '#FF4545', border: '1px solid rgba(255,69,69,0.3)', fontWeight: 700 }} />
                    )}
                    {client.lateCount > 0 && (
                      <Chip label={`⚠️ ${client.lateCount} atrasado${client.lateCount > 1 ? 's' : ''}`} size="small"
                        sx={{ fontSize: { md: '0.62rem', xl: '0.68rem' }, height: 22, bgcolor: 'rgba(255,215,0,0.1)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.3)', fontWeight: 700 }} />
                    )}
                    {client.awaitingCount > 0 && (
                      <Chip label={`👁️ ${client.awaitingCount} aguardando`} size="small"
                        sx={{ fontSize: { md: '0.62rem', xl: '0.68rem' }, height: 22, bgcolor: 'rgba(59,142,255,0.1)', color: '#3B8EFF', border: '1px solid rgba(59,142,255,0.3)', fontWeight: 700 }} />
                    )}
                    {!hasFolder && (
                      <Chip label="📁 sem Drive" size="small"
                        sx={{ fontSize: { md: '0.62rem', xl: '0.68rem' }, height: 22, bgcolor: 'rgba(161,161,170,0.08)', color: '#A1A1AA', border: '1px solid rgba(161,161,170,0.2)' }} />
                    )}
                  </Box>
                )}

                {/* ── Ações rápidas (ícones compactos) ─────────── */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5, pb: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {hasFolder && <Tooltip title="Drive configurado"><CheckCircleIcon sx={{ fontSize: 15, color: 'success.main' }} /></Tooltip>}
                  {client.sheetUrl && (
                    <Tooltip title="Planilha">
                      <IconButton size="small" component="a" href={client.sheetUrl} target="_blank" rel="noopener" sx={{ p: 0.5 }}>
                        <TableChartIcon sx={{ fontSize: 15, color: 'primary.main' }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title={clientPhones[client.name] ? `WhatsApp: ${clientPhones[client.name]}` : 'Adicionar WhatsApp'}>
                    <IconButton size="small" onClick={() => { setPhoneEditClient(client.name); setPhoneInput(clientPhones[client.name] ?? '') }} sx={{ p: 0.5 }}>
                      <WhatsAppIcon sx={{ fontSize: 15, color: clientPhones[client.name] ? '#25D366' : 'rgba(255,255,255,0.25)' }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Brand Kit">
                    <IconButton size="small" onClick={() => setAiContextClient(client.name)} sx={{ p: 0.5 }}>
                      <AutoAwesomeIcon sx={{ fontSize: 15, color: ClientContextStore.get(client.name) ? '#ff9039' : 'rgba(255,255,255,0.25)' }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Galeria">
                    <IconButton size="small" onClick={() => setGalleryClient(client.name)} sx={{ p: 0.5 }}>
                      <GridViewIcon sx={{ fontSize: 15, color: '#C084FC' }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Ver todos os conteúdos">
                    <IconButton size="small" onClick={() => onClientFocus(client.name)} sx={{ p: 0.5 }}>
                      <ZoomInIcon sx={{ fontSize: 15, color: 'info.main' }} />
                    </IconButton>
                  </Tooltip>
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Opções">
                    <IconButton size="small" onClick={e => { setClientOptionsAnchor(e.currentTarget); setClientOptionsName(client.name) }} sx={{ p: 0.5 }}>
                      <MoreVertIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.35)', '&:hover': { color: '#ff9039' } }} />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* ── Botões de ação ───────────────────────────── */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.8 }}>
                  <Button fullWidth size="small" variant="outlined"
                    startIcon={<LinkIcon sx={{ fontSize: 13 }} />}
                    onClick={() => openPortal(client.name)}
                    sx={{ fontSize: { md: '0.65rem', xl: '0.7rem' }, py: 0.7, fontWeight: 700, borderRadius: '10px', borderColor: 'rgba(59,142,255,0.35)', color: '#3B8EFF', '&:hover': { bgcolor: 'rgba(59,142,255,0.08)', borderColor: '#3B8EFF' } }}
                  >
                    Portal
                  </Button>

                  <Button fullWidth size="small" variant="outlined"
                    startIcon={<Box sx={{ fontSize: '0.8rem', lineHeight: 1 }}>{briefingFilled[client.name] ? '✅' : '📋'}</Box>}
                    onClick={() => openBriefing(client.name)}
                    sx={{ fontSize: { md: '0.65rem', xl: '0.7rem' }, py: 0.7, fontWeight: 700, borderRadius: '10px', borderColor: briefingFilled[client.name] ? 'rgba(0,196,122,0.4)' : 'rgba(180,90,255,0.3)', color: briefingFilled[client.name] ? '#00C47A' : '#b45aff', '&:hover': { bgcolor: briefingFilled[client.name] ? 'rgba(0,196,122,0.08)' : 'rgba(180,90,255,0.08)' } }}
                  >
                    Briefing
                  </Button>

                  <Button fullWidth size="small" variant="outlined"
                    startIcon={<AssessmentIcon sx={{ fontSize: 13 }} />}
                    onClick={() => setReportClient(client.name)}
                    sx={{ fontSize: { md: '0.65rem', xl: '0.7rem' }, py: 0.7, fontWeight: 700, borderRadius: '10px', gridColumn: 'span 2', borderColor: 'rgba(249,115,22,0.3)', color: '#F97316', '&:hover': { bgcolor: 'rgba(249,115,22,0.08)', borderColor: '#F97316' } }}
                  >
                    Gerar relatório
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )
        })}
      </Box>

      <HintCard text="Dica da IA: diga 'Distribua 8 posts e 4 reels para o [Cliente]' — a IA cria e agenda tudo automaticamente." />

      {/* ── Menu de opções do cliente ─────────────────── */}
      <Menu
        open={!!clientOptionsAnchor}
        anchorEl={clientOptionsAnchor}
        onClose={() => { setClientOptionsAnchor(null); setClientOptionsName(null) }}
        slotProps={{ paper: { sx: { bgcolor: 'rgba(18,18,18,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, minWidth: 210 } } }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {clientOptionsName && [
          <Box key="header" sx={{ px: 1.8, py: 0.8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
              {clientDisplayNames[clientOptionsName] ?? clientOptionsName}
            </Typography>
          </Box>,
          <MenuItem key="rename" onClick={() => {
            setRenamingClient(clientOptionsName)
            setRenameClientInput(clientDisplayNames[clientOptionsName] ?? clientOptionsName)
            setClientOptionsAnchor(null); setClientOptionsName(null)
          }} sx={{ gap: 1.2, fontSize: '0.72rem', py: 0.9 }}>
            <DriveFileRenameOutlineIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.45)' }} />
            <Typography sx={{ fontSize: '0.72rem' }}>Renomear exibição</Typography>
          </MenuItem>,
          <MenuItem key="toggle-type" onClick={() => {
            toggleClientType(clientOptionsName)
            setClientOptionsAnchor(null); setClientOptionsName(null)
          }} sx={{ gap: 1.2, fontSize: '0.72rem', py: 0.9 }}>
            <Box sx={{ width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Typography sx={{ fontSize: '0.75rem' }}>{(clientTypes[clientOptionsName] ?? 'mensal') === 'mensal' ? '🔄' : '📅'}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.72rem' }}>
                Tipo: <strong>{(clientTypes[clientOptionsName] ?? 'mensal') === 'mensal' ? 'Mensal' : 'Freelancer'}</strong>
              </Typography>
              <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)' }}>
                {(clientTypes[clientOptionsName] ?? 'mensal') === 'mensal' ? 'Mudar para Freelancer' : 'Mudar para Mensal'}
              </Typography>
            </Box>
          </MenuItem>,
          (clientTypes[clientOptionsName] ?? 'mensal') === 'freelancer' && (
            <MenuItem key="toggle-month" onClick={() => {
              toggleFreelancerMonth(clientOptionsName, monthKey)
              setClientOptionsAnchor(null); setClientOptionsName(null)
            }} sx={{ gap: 1.2, fontSize: '0.72rem', py: 0.9 }}>
              <Box sx={{ width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Typography sx={{ fontSize: '0.75rem' }}>
                  {(freelancerMonths[clientOptionsName] ?? []).includes(monthKey) ? '✅' : '⬜'}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.72rem' }}>Ativo em {MONTH_NAMES[viewMonth]}/{String(viewYear).slice(2)}</Typography>
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)' }}>Clique para alternar</Typography>
              </Box>
            </MenuItem>
          ),
          <MenuItem key="hide" onClick={() => {
            hideForMonth(clientOptionsName)
            setClientOptionsAnchor(null); setClientOptionsName(null)
          }} sx={{ gap: 1.2, fontSize: '0.72rem', py: 0.9 }}>
            <DeleteOutlineIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.35)' }} />
            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)' }}>Ocultar neste mês</Typography>
          </MenuItem>,
          <MenuItem key="delete-from" onClick={() => {
            setDeleteFromConfirm(clientOptionsName)
            setClientOptionsAnchor(null); setClientOptionsName(null)
          }} sx={{ gap: 1.2, fontSize: '0.72rem', py: 0.9 }}>
            <DeleteOutlineIcon sx={{ fontSize: 15, color: '#FF4545' }} />
            <Box>
              <Typography sx={{ fontSize: '0.72rem', color: '#FF4545' }}>Remover a partir deste mês</Typography>
              <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,69,69,0.5)' }}>Permanece visível em meses anteriores</Typography>
            </Box>
          </MenuItem>,
        ]}
      </Menu>

      {/* ── Dialog: Renomear cliente ──────────────────── */}
      <Dialog open={!!renamingClient} onClose={() => setRenamingClient(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px' } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography variant="subtitle1" fontWeight={700}>Renomear cliente</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem' }}>
            Apenas o nome exibido no painel — não afeta o conteúdo
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            autoFocus fullWidth size="small" placeholder={renamingClient ?? ''}
            value={renameClientInput}
            onChange={e => setRenameClientInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applyRenameClient(); if (e.key === 'Escape') setRenamingClient(null) }}
            sx={{ '& .MuiInputBase-root': { fontSize: '0.85rem', fontWeight: 700 } }}
          />
          {clientDisplayNames[renamingClient ?? ''] && (
            <Typography
              variant="caption" color="primary.main"
              sx={{ mt: 0.8, display: 'block', cursor: 'pointer', fontSize: '0.62rem' }}
              onClick={() => setRenameClientInput('')}
            >
              ↩ Limpar e usar nome original: {renamingClient}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setRenamingClient(null)}>Cancelar</Button>
          <Button size="small" variant="contained" onClick={applyRenameClient} sx={{ fontWeight: 700 }}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Confirmar remover a partir deste mês ─ */}
      <Dialog open={!!deleteFromConfirm} onClose={() => setDeleteFromConfirm(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,69,69,0.15)', borderRadius: '20px' } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography variant="subtitle1" fontWeight={700} color="error.main">Remover a partir de {MONTH_NAMES[viewMonth]}/{String(viewYear).slice(2)}</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            <strong style={{ color: '#fff' }}>{deleteFromConfirm}</strong> não aparecerá mais em{' '}
            <strong style={{ color: '#ff9039' }}>{MONTH_NAMES[viewMonth]}/{String(viewYear).slice(2)}</strong> e meses futuros.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.8, display: 'block', fontSize: '0.62rem' }}>
            Meses anteriores não são afetados. Para restaurar, edite o tipo do cliente.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setDeleteFromConfirm(null)}>Cancelar</Button>
          <Button
            size="small" variant="contained" color="error"
            onClick={() => deleteFromConfirm && deleteClientFromMonth(deleteFromConfirm)}
            sx={{ fontWeight: 700 }}
          >
            Remover
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Confirmar exclusão de cliente ──────── */}
      <Dialog open={!!deleteConfirmClient} onClose={() => setDeleteConfirmClient(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography variant="subtitle1" fontWeight={700} color="error.main">Excluir cliente</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Tem certeza que deseja remover <strong style={{ color: '#fff' }}>{deleteConfirmClient}</strong> da lista de clientes ativos?
          </Typography>
          <Typography variant="caption" color="error.main" sx={{ mt: 1, display: 'block' }}>
            O histórico de conteúdos não será apagado.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setDeleteConfirmClient(null)}>Cancelar</Button>
          <Button
            size="small" variant="contained" color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => {
              if (deleteConfirmClient) onDeleteClient(deleteConfirmClient)
              setDeleteConfirmClient(null)
            }}
            sx={{ fontWeight: 700 }}
          >
            Excluir
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Modal de roteiros ─────────────────────────── */}
      {roteiroClient && (
        <RoteirosModal
          open
          clientName={roteiroClient}
          roteiros={selectedRoteiros}
          distributedCount={selectedDistribCount}
          driveFolder={selectedFolder || undefined}
          onAdd={(r, year, month) => onAddRoteiro(roteiroClient, r, year, month)}
          onAddMany={(list, year, month) => onAddManyRoteiros(roteiroClient, list, year, month)}
          onBulkCreate={(posts, reels, year, month) => onBulkCreate(roteiroClient, posts, reels, year, month)}
          onRemove={id => onRemoveRoteiro(roteiroClient, id)}
          onRedistribute={(year, month) => onRedistribute(roteiroClient, year, month)}
          onClearDistribution={(year, month) => onClearDistribution(roteiroClient, year, month)}
          onSetDriveFolder={url => onSetClientFolder(roteiroClient, url)}
          onClose={() => setRoteiroClient(null)}
        />
      )}

      {/* ── Dialog: Distribuir todos os clientes ─────── */}
      <Dialog open={showDistributeAll} onClose={() => setShowDistributeAll(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography variant="subtitle1" fontWeight={700}>Distribuir todos os clientes</Typography>
          <Typography variant="caption" color="text.secondary">Cria posts e reels para cada cliente no mês selecionado</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.6rem' }}>
            Mês de distribuição
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {monthOptions.map(opt => (
              <Chip
                key={opt.label} label={opt.label} size="small"
                variant={distributeAllMonth === opt.month && distributeAllYear === opt.year ? 'filled' : 'outlined'}
                color={distributeAllMonth === opt.month && distributeAllYear === opt.year ? 'primary' : 'default'}
                onClick={() => { setDistributeAllMonth(opt.month); setDistributeAllYear(opt.year) }}
                sx={{ fontSize: '0.6rem', cursor: 'pointer' }}
              />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            Serão criados <strong>{allClients.reduce((s, c) => s + c.postsPerMonth + c.reelsPerMonth, 0)}</strong> itens no total ({allClients.length} clientes com suas quantidades padrão)
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setShowDistributeAll(false)}>Cancelar</Button>
          <Button
            size="small" variant="contained"
            startIcon={<BoltIcon />}
            onClick={() => { onDistributeAll(distributeAllYear, distributeAllMonth); setShowDistributeAll(false) }}
            sx={{ fontWeight: 700, background: '#F97316' }}
          >
            Distribuir todos em {MONTH_NAMES[distributeAllMonth]}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Portal do Cliente ────────────────── */}
      <Dialog open={!!portalClient} onClose={() => { setPortalClient(null); setPortalLink(''); setPortalCopied(false) }} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(59,142,255,0.25)', borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinkIcon sx={{ color: '#3B8EFF', fontSize: 18 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>Portal do Cliente</Typography>
              <Typography variant="caption" color="text.secondary">{portalClient}</Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {portalLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <Typography color="text.secondary" sx={{ fontSize: '0.8rem' }}>Gerando link...</Typography>
            </Box>
          ) : portalLink ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(59,142,255,0.06)', border: '1px solid rgba(59,142,255,0.2)', wordBreak: 'break-all' }}>
                <Typography sx={{ fontSize: '0.72rem', color: '#3B8EFF', fontFamily: 'monospace' }}>{portalLink}</Typography>
              </Box>

              {/* QR Code */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 1 }}>
                <Box
                  component="img"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(portalLink)}&color=ff9039&bgcolor=0e0e0e&margin=8`}
                  alt="QR Code do portal"
                  sx={{ width: 180, height: 180, borderRadius: 2, border: '1px solid rgba(255,144,57,0.2)' }}
                />
                <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', textAlign: 'center' }}>
                  Mostre este QR code ao cliente em reunião
                </Typography>
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                Compartilhe o link ou o QR code. O cliente aprova ou reprova sem precisar fazer login.
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" color="inherit" onClick={() => { setPortalClient(null); setPortalLink(''); setPortalCopied(false) }}>Fechar</Button>
          {portalLink && (
            <>
              <Button
                size="small" variant="outlined" color="error"
                startIcon={<RefreshIcon sx={{ fontSize: 13 }} />}
                onClick={() => portalClient && openPortal(portalClient, true)}
                sx={{ fontSize: '0.62rem', fontWeight: 700 }}
              >
                Revogar e gerar novo
              </Button>
              <Button
                size="small" variant="contained"
                startIcon={portalCopied ? <CheckCircleIcon sx={{ fontSize: 13 }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
                onClick={() => { navigator.clipboard.writeText(portalLink); setPortalCopied(true); setTimeout(() => setPortalCopied(false), 2500) }}
                sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: '#3B8EFF', '&:hover': { bgcolor: '#2a7aee' } }}
              >
                {portalCopied ? 'Copiado!' : 'Copiar link'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Briefing ─────────────────────────── */}
      <Dialog open={!!briefingClient} onClose={() => { setBriefingClient(null); setBriefingLink(''); setBriefingData(null); setViewBriefing(false) }} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(180,90,255,0.25)', borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>📋</Typography>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>Briefing Estratégico</Typography>
              <Typography variant="caption" color="text.secondary">{briefingClient}</Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {briefingLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} sx={{ color: '#b45aff' }} />
            </Box>
          ) : briefingData && viewBriefing ? (
            // ── Respostas completas organizadas por seção ──
            <Box sx={{ maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <Box sx={{ px: 1.5, py: 1, mb: 1.5, borderRadius: 2, bgcolor: 'rgba(0,196,122,0.08)', border: '1px solid rgba(0,196,122,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '0.7rem', color: '#00C47A', fontWeight: 700 }}>✅ Preenchido pelo cliente</Typography>
                <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
                  {briefingData._submittedAt ? new Date(briefingData._submittedAt as string).toLocaleDateString('pt-BR') : ''}
                </Typography>
              </Box>
              {([
                { title: '🏗️ Sobre a Empresa', keys: ['repName','razaoSocial','cpf','cnpj','endereco','telefone','email','nomeEmpresa','servPrincipal','outrosServ','tempoMercado','diferencial'] },
                { title: '🎯 Objetivos', keys: ['_objectives','expectativas','referencias'] },
                { title: '🎥 Redes Sociais', keys: ['_hasMedia','igLogin','igSenha','fbLogin','fbSenha','gmEmail','gmSenha'] },
                { title: '📍 Público-Alvo', keys: ['publicoAlvo','regioes','naoClientes'] },
                { title: '📝 Considerações Finais', keys: ['particularidades','infoAdicionais'] },
              ] as { title: string; keys: string[] }[]).map(section => (
                <Box key={section.title} sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: '#b45aff', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
                    {section.title}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {section.keys.map(key => {
                      const val = (briefingData as Record<string, unknown>)[key]
                      const LABELS: Record<string, string> = {
                        repName:'Representante Legal', razaoSocial:'Razão Social', cpf:'CPF', cnpj:'CNPJ',
                        endereco:'Endereço', telefone:'Telefone', email:'E-mail', nomeEmpresa:'Nome da Empresa',
                        servPrincipal:'Serviço Principal', outrosServ:'Outros Serviços', tempoMercado:'Tempo no Mercado',
                        diferencial:'Diferencial', _objectives:'Objetivos', expectativas:'Expectativas', referencias:'Referências',
                        _hasMedia:'Banco de mídia profissional', igLogin:'Instagram (login)', igSenha:'Instagram (senha)',
                        fbLogin:'Facebook (login)', fbSenha:'Facebook (senha)', gmEmail:'Google Meu Negócio (e-mail)', gmSenha:'Google Meu Negócio (senha)',
                        publicoAlvo:'Público-Alvo', regioes:'Regiões Atendidas', naoClientes:'Clientes Indesejados',
                        particularidades:'Particularidades', infoAdicionais:'Informações Adicionais',
                      }
                      const display = Array.isArray(val) ? (val as string[]).join(', ') :
                        val === true ? 'Sim' : val === false ? 'Não' :
                        val ? String(val) : null
                      return (
                        <Box key={key} sx={{ display: 'flex', gap: 1.5, py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.38)', minWidth: 130, flexShrink: 0, lineHeight: 1.5 }}>
                            {LABELS[key] ?? key}
                          </Typography>
                          <Typography sx={{ fontSize: '0.72rem', color: display ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.2)', lineHeight: 1.5, fontStyle: display ? 'normal' : 'italic' }}>
                            {display ?? 'Não informado'}
                          </Typography>
                        </Box>
                      )
                    })}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : briefingLink ? (
            // ── Link + QR code ──
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {briefingData && (
                <Box sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: 'rgba(0,196,122,0.08)', border: '1px solid rgba(0,196,122,0.25)', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(0,196,122,0.14)' } }}
                  onClick={() => setViewBriefing(true)}>
                  <Typography sx={{ fontSize: '0.72rem', color: '#00C47A', fontWeight: 700 }}>✅ Briefing preenchido — clique para ver respostas →</Typography>
                </Box>
              )}
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(180,90,255,0.06)', border: '1px solid rgba(180,90,255,0.2)', wordBreak: 'break-all' }}>
                <Typography sx={{ fontSize: '0.68rem', color: '#b45aff', fontFamily: 'monospace' }}>{briefingLink}</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 1 }}>
                <Box component="img"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(briefingLink)}&color=b45aff&bgcolor=0e0e0e&margin=8`}
                  alt="QR Code do briefing"
                  sx={{ width: 150, height: 150, borderRadius: 2, border: '1px solid rgba(180,90,255,0.2)' }}
                />
                <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', textAlign: 'center' }}>
                  Envie o link ou mostre o QR code ao cliente
                </Typography>
              </Box>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" color="inherit" onClick={() => { setBriefingClient(null); setBriefingLink(''); setBriefingData(null); setViewBriefing(false) }}>Fechar</Button>
          {viewBriefing && (
            <Button size="small" onClick={() => setViewBriefing(false)}
              sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
              ← Voltar
            </Button>
          )}
          {briefingData && (
            <Button size="small" variant="outlined"
              onClick={async () => {
                if (!briefingLink) return
                const token = briefingLink.split('/briefing/')[1]
                await fetch('/api/briefing', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'submit', token, data: {} }),
                })
                setBriefingData(null)
                setBriefingFilled(prev => { const n = { ...prev }; delete n[briefingClient!]; return n })
                setViewBriefing(false)
              }}
              sx={{ fontSize: '0.62rem', fontWeight: 700, borderColor: 'rgba(255,69,69,0.3)', color: '#FF4545', '&:hover': { bgcolor: 'rgba(255,69,69,0.08)' } }}>
              Limpar respostas
            </Button>
          )}
          {briefingLink && !viewBriefing && (
            <Button size="small" variant="contained"
              startIcon={briefingCopied ? <CheckCircleIcon sx={{ fontSize: 13 }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
              onClick={() => { navigator.clipboard.writeText(briefingLink); setBriefingCopied(true); setTimeout(() => setBriefingCopied(false), 2500) }}
              sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: '#b45aff', '&:hover': { bgcolor: '#9b3fff' } }}>
              {briefingCopied ? 'Copiado!' : 'Copiar link'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Dialog: WhatsApp do cliente ──────────────── */}
      <Dialog open={!!phoneEditClient} onClose={() => setPhoneEditClient(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WhatsAppIcon sx={{ color: '#25D366', fontSize: 20 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>WhatsApp do cliente</Typography>
              <Typography variant="caption" color="text.secondary">{phoneEditClient}</Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            fullWidth size="small"
            label={phoneInput.startsWith('https://chat.whatsapp.com/') ? 'Link do grupo detectado ✓' : 'Número com DDD ou link do grupo'}
            placeholder="11999998888 ou https://chat.whatsapp.com/..."
            value={phoneInput}
            onChange={e => setPhoneInput(e.target.value)}
            autoFocus
            sx={{ '& .MuiFormHelperText-root': { fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' } }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
              📱 <strong>Número:</strong> só os dígitos com DDD (ex: 11999998888)
            </Typography>
            <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
              💬 <strong>Grupo:</strong> cole o link de convite (chat.whatsapp.com/...) — a mensagem é copiada automaticamente ao enviar
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5, gap: 1 }}>
          <Button size="small" onClick={() => setPhoneEditClient(null)}>Cancelar</Button>
          {phoneEditClient && clientPhones[phoneEditClient] && (
            <Button size="small" color="error" onClick={() => {
              if (phoneEditClient) onSetClientPhone(phoneEditClient, '')
              setPhoneEditClient(null)
            }}>
              Remover
            </Button>
          )}
          <Button
            size="small" variant="contained"
            startIcon={<WhatsAppIcon sx={{ fontSize: 14 }} />}
            disabled={!phoneInput.trim()}
            onClick={() => {
              if (phoneEditClient) onSetClientPhone(phoneEditClient, phoneInput.trim())
              setPhoneEditClient(null)
            }}
            sx={{ fontWeight: 700, bgcolor: '#25D366', '&:hover': { bgcolor: '#1EB857' }, '&.Mui-disabled': { bgcolor: 'rgba(37,211,102,0.2)', color: 'rgba(255,255,255,0.3)' } }}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Relatório mensal ─────────────────────────── */}
      <MonthlyReportModal
        open={showReport}
        items={items}
        states={states}
        allClients={allClients}
        now={new Date()}
        onClose={() => setShowReport(false)}
      />

      {reportClient && (
        <ReportGeneratorModal
          open={!!reportClient}
          onClose={() => setReportClient(null)}
          clientName={reportClient}
          clientColor={clientColors[reportClient]}
          items={items}
          states={states}
        />
      )}

      {/* ── Dialog: Iniciar novo mês ─────────────────── */}
      <Dialog open={showNewMonth} onClose={() => setShowNewMonth(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarMonthIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>Iniciar Novo Mês</Typography>
              <Typography variant="caption" color="text.secondary">Distribui todos os clientes no mês escolhido</Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {monthOptions.map((opt, idx) => (
              <Chip
                key={opt.label} label={opt.label} size="small"
                variant={newMonthIdx === idx ? 'filled' : 'outlined'}
                color={newMonthIdx === idx ? 'primary' : 'default'}
                onClick={() => setNewMonthIdx(idx)}
                sx={{ fontSize: '0.6rem', cursor: 'pointer' }}
              />
            ))}
          </Box>
          <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(255,144,57,0.06)', border: '1px solid rgba(255,144,57,0.15)' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block' }}>
              ✅ Clientes <strong>com roteiros</strong> — usa os roteiros cadastrados
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', mt: 0.3 }}>
              📅 Clientes <strong>sem roteiros</strong> — cria posts/reels genéricos pelas quantidades padrão
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem' }}>
            {allClients.length} clientes · {allClients.reduce((s, c) => s + c.postsPerMonth + c.reelsPerMonth, 0)} itens no total
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setShowNewMonth(false)}>Cancelar</Button>
          <Button
            size="small" variant="contained"
            startIcon={<BoltIcon />}
            onClick={() => {
              const opt = monthOptions[newMonthIdx]
              onStartNewMonth(opt.year, opt.month)
              setShowNewMonth(false)
            }}
            sx={{ fontWeight: 700, background: '#F97316' }}
          >
            Iniciar {monthOptions[newMonthIdx]?.label}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Novo cliente ──────────────────────── */}
      <Dialog open={showAddClient} onClose={() => setShowAddClient(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography variant="subtitle1" fontWeight={700}>Novo cliente</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="Nome do cliente" size="small" fullWidth autoFocus
            value={newClientName}
            onChange={e => setNewClientName(e.target.value)}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Posts/mês" type="number" size="small" fullWidth
              value={newClientPosts}
              onChange={e => setNewClientPosts(Math.max(0, Number(e.target.value)))}
              slotProps={{ htmlInput: { min: 0, max: 30 } }}
            />
            <TextField
              label="Reels/mês" type="number" size="small" fullWidth
              value={newClientReels}
              onChange={e => setNewClientReels(Math.max(0, Number(e.target.value)))}
              slotProps={{ htmlInput: { min: 0, max: 30 } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setShowAddClient(false)}>Cancelar</Button>
          <Button
            size="small" variant="contained"
            disabled={!newClientName.trim()}
            onClick={() => {
              onAddClient({ name: newClientName.trim(), postsPerMonth: newClientPosts, reelsPerMonth: newClientReels })
              setNewClientName('')
              setNewClientPosts(8)
              setNewClientReels(4)
              setShowAddClient(false)
            }}
            sx={{ fontWeight: 700 }}
          >
            Adicionar cliente
          </Button>
        </DialogActions>
      </Dialog>
      {aiContextClient && (
        <Suspense fallback={null}>
          <ClientContextModal
            open={Boolean(aiContextClient)}
            onClose={() => setAiContextClient(null)}
            clientName={aiContextClient}
          />
        </Suspense>
      )}
      {galleryClient && onStatusChange && (
        <ApprovalGallery
          open={Boolean(galleryClient)}
          onClose={() => setGalleryClient(null)}
          clientName={galleryClient}
          items={items}
          states={states}
          onStatusChange={onStatusChange}
          onSendToClient={onBulkSendToClient}
        />
      )}
    </Box>
  )
}
