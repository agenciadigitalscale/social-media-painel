import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import {
  ThemeProvider, CssBaseline, Box, BottomNavigation,
  BottomNavigationAction, Paper, Typography, Chip, Snackbar, Alert, Button,
  InputBase, Collapse, List, ListItem, ListItemText, useMediaQuery, CircularProgress,
} from '@mui/material'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import HomeIcon from '@mui/icons-material/Home'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda'
import PeopleIcon from '@mui/icons-material/People'
import ViewKanbanIcon from '@mui/icons-material/ViewKanban'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import BarChartIcon from '@mui/icons-material/BarChart'
import TimelineIcon from '@mui/icons-material/Timeline'
import VideocamIcon from '@mui/icons-material/Videocam'
import MovieFilterIcon from '@mui/icons-material/MovieFilter'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import LogoutIcon from '@mui/icons-material/Logout'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import GroupIcon from '@mui/icons-material/Group'
import PsychologyIcon from '@mui/icons-material/Psychology'
import theme from './theme'
import type { ContentItem, ContentType, HistoryEntry, ItemEditPatch, ItemState, Notification, Roteiro, Status } from './types'
import { STATUS_CONFIG } from './types'
import { DATA, CLIENTS } from './data'
import {
  serializeItem, deserializeItem,
  loadStates, loadCustomItems, loadDeletedIds, loadEditedItems,
  loadRoteiros, loadClientFolders, loadExtraClients, loadHiddenClients,
  loadClientColors, loadClientHashtags, loadCaptionTemplates,
  syncToCloud, SYNC_KEYS,
} from './lib/storage'
import { getWorkdays, buildDistribution } from './lib/distribution'
import { generateApprovalUrl, generateApprovalMessage, openWhatsAppApproval, openWhatsAppGroup, isGroupLink } from './lib/whatsapp'
import { getUserInfo, getDisplayName } from './lib/users'
import NotificationCenter from './components/NotificationCenter'
import UserPicker from './components/UserPicker'
import Logo from './components/Logo'
import ClientFocusModal from './components/ClientFocusModal'
import AIAgent from './components/AIAgent'
import MonthlyReportModal from './components/MonthlyReportModal'
import SplashScreen from './components/SplashScreen'
import PresentationMode from './components/PresentationMode'
import ScaleAI from './components/ScaleAI'
import AccessManager from './components/AccessManager'
import HelpOverlay from './components/HelpOverlay'
import Confetti from './components/Confetti'
import EngagementDialog from './components/EngagementDialog'

const TodayTab         = lazy(() => import('./components/TodayTab'))
const AgendaTab        = lazy(() => import('./components/AgendaTab'))
const CalendarTab      = lazy(() => import('./components/CalendarTab'))
const ClientsTab       = lazy(() => import('./components/ClientsTab'))
const KanbanTab        = lazy(() => import('./components/KanbanTab'))
const KaiqueTab        = lazy(() => import('./components/KaiqueTab'))
const TimelineTab      = lazy(() => import('./components/TimelineTab'))
const RecordingCenter  = lazy(() => import('./components/RecordingCenter'))
const EditorMode       = lazy(() => import('./components/EditorMode'))
const FinanceiroTab    = lazy(() => import('./components/FinanceiroTab'))
const EquipeTab        = lazy(() => import('./components/EquipeTab'))
const IATab            = lazy(() => import('./components/IATab'))

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia ☀️'
  if (h < 18) return 'Boa tarde 🌤'
  return 'Boa noite 🌙'
}

// ── App ────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState(0)
  const [states, setStates] = useState<Record<number, ItemState>>(loadStates)
  const [customItems, setCustomItems] = useState<ContentItem[]>(loadCustomItems)
  const [deletedIds, setDeletedIds] = useState<number[]>(loadDeletedIds)
  const [editedItems, setEditedItems] = useState<Record<number, { dt?: string; tp?: ContentType; n?: string }>>(loadEditedItems)
  const [roteiros, setRoteiros] = useState<Record<string, Roteiro[]>>(loadRoteiros)
  const [clientFolders, setClientFolders] = useState<Record<string, string>>(loadClientFolders)
  const [extraClients, setExtraClients] = useState(loadExtraClients)
  const [hiddenClients, setHiddenClients] = useState<string[]>(loadHiddenClients)
  const [clientColors, setClientColorsState] = useState<Record<string, string>>(loadClientColors)
  const [clientHashtags, setClientHashtagsState] = useState<Record<string, string[]>>(loadClientHashtags)
  const [captionTemplates, setCaptionTemplatesState] = useState<Record<string, string[]>>(loadCaptionTemplates)
  const [statusFilter, setStatusFilter] = useState<number | null>(null)
  const [focusClient, setFocusClient] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() =>
    'Notification' in window ? Notification.permission : 'denied'
  )
  const [showNotifPrompt, setShowNotifPrompt] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [presentationOpen, setPresentationOpen] = useState(false)
  const [scaleAIOpen, setScaleAIOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [confettiActive, setConfettiActive] = useState(false)
  const [engagementItemId, setEngagementItemId] = useState<number | null>(null)
  const prev100Clients = useRef<Set<string>>(new Set())
  const [showSplash, setShowSplash] = useState(true)
  const [clientNotifs, setClientNotifs] = useState<{ id: number; title: string }[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  // Sessão só dura na aba atual (sessionStorage) — ao reabrir o browser, pede quem está usando
  const [currentUser, setCurrentUser] = useState<string>(() =>
    sessionStorage.getItem('sm_tab_user') ?? ''
  )
  const [showUserPicker, setShowUserPicker] = useState(false)
  const [accessManagerOpen, setAccessManagerOpen] = useState(false)
  const [clientPhones, setClientPhones] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('sm_client_phones') ?? '{}') } catch { return {} }
  })
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'info' | 'warning' | 'error' } | null>(null)

  // Refs para detectar mudanças de status vindas do cliente (polling)
  const statesRef      = useRef<Record<number, ItemState>>(loadStates())
  const initialSyncRef = useRef(false)

  const allClients = useMemo(() => [...CLIENTS, ...extraClients].filter(c => !hiddenClients.includes(c.name)), [extraClients, hiddenClients])

  // ── Aplicar dados remotos do D1 ───────────────────────
  const applyRemoteSync = useCallback((data: { key: string; value: string }[]) => {
    data.forEach(({ key, value }) => {
      try {
        const parsed = JSON.parse(value)
        switch (key) {
          case 'sm_states':
            setStates(() => { localStorage.setItem('sm_states', value); return parsed as Record<number, ItemState> })
            break
          case 'sm_custom':
            setCustomItems(() => { localStorage.setItem('sm_custom', value); return (parsed as Record<string, unknown>[]).map(deserializeItem) })
            break
          case 'sm_deleted':
            setDeletedIds(() => { localStorage.setItem('sm_deleted', value); return parsed as number[] })
            break
          case 'sm_edits':
            setEditedItems(() => { localStorage.setItem('sm_edits', value); return parsed })
            break
          case 'sm_roteiros':
            setRoteiros(() => { localStorage.setItem('sm_roteiros', value); return parsed })
            break
          case 'sm_client_folders':
            setClientFolders(() => { localStorage.setItem('sm_client_folders', value); return parsed })
            break
          case 'sm_extra_clients':
            setExtraClients(() => { localStorage.setItem('sm_extra_clients', value); return parsed })
            break
          case 'sm_hidden_clients':
            setHiddenClients(() => { localStorage.setItem('sm_hidden_clients', value); return parsed as string[] })
            break
          case 'sm_client_colors':
            setClientColorsState(() => { localStorage.setItem('sm_client_colors', value); return parsed })
            break
          case 'sm_client_hashtags':
            setClientHashtagsState(() => { localStorage.setItem('sm_client_hashtags', value); return parsed })
            break
          case 'sm_caption_templates':
            setCaptionTemplatesState(() => { localStorage.setItem('sm_caption_templates', value); return parsed })
            break
        }
      } catch {}
    })
  }, [])

  // ── Sync de refs ──────────────────────────────────────
  useEffect(() => { statesRef.current = states }, [states])

  // ── Relógio ───────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // ── Atalhos de teclado ────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(v => !v)
        setSearchQuery('')
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Sync D1 no mount ──────────────────────────────────
  useEffect(() => {
    fetch('/api/sync')
      .then(r => r.json())
      .then((res: { ok: boolean; data: { key: string; value: string }[] }) => {
        if (!res.ok) return
        if (res.data?.length) {
          applyRemoteSync(res.data)
        } else {
          SYNC_KEYS.forEach(k => {
            const v = localStorage.getItem(k)
            if (v) syncToCloud(k, JSON.parse(v))
          })
        }
      })
      .catch(() => {})
      .finally(() => { initialSyncRef.current = true })
  }, [applyRemoteSync])

  // ── Poll D1 a cada 8s — detecta reprovações do cliente em tempo real ──
  useEffect(() => {
    const poll = () => {
      fetch('/api/sync')
        .then(r => r.json())
        .then((res: { ok: boolean; data: { key: string; value: string }[] }) => {
          if (!res.ok || !res.data?.length) return

          // Detecta aprovações/reprovações do cliente após sync inicial
          if (initialSyncRef.current) {
            const syncMap: Record<string, unknown> = {}
            res.data.forEach(({ key, value }) => {
              try { syncMap[key] = JSON.parse(value) } catch {}
            })
            const newStates = (syncMap['sm_states'] ?? {}) as Record<string, ItemState>
            const rejected: { id: number; title: string }[] = []
            const newNotifs: Notification[] = []

            Object.entries(newStates).forEach(([idStr, s]) => {
              const prev = statesRef.current[Number(idStr)]
              if (!prev || prev.status === s.status) return
              // Reprovado pelo cliente (status 6)
              if (s.status === 6 && prev.status !== 6) {
                rejected.push({ id: Number(idStr), title: s.title || `Item ${idStr}` })
                newNotifs.push({
                  id: `rejection-${idStr}-${Date.now()}`,
                  title: 'Conteúdo reprovado',
                  message: `${s.title || `Item ${idStr}`} — ${s.rejectionText || 'sem comentário'}`,
                  type: 'rejection', itemId: Number(idStr), read: false, createdAt: Date.now(),
                })
              }
              // Aprovado pelo cliente (status 5)
              if (s.status === 5 && prev.status !== 5) {
                newNotifs.push({
                  id: `approval-${idStr}-${Date.now()}`,
                  title: '✅ Conteúdo aprovado pelo cliente',
                  message: s.title || `Item ${idStr}`,
                  type: 'approval', itemId: Number(idStr), read: false, createdAt: Date.now(),
                })
              }
            })

            if (rejected.length) {
              setClientNotifs(prev => [...prev, ...rejected.filter(n => !prev.some(p => p.id === n.id))])
            }
            if (newNotifs.length) {
              setNotifications(prev => [...newNotifs, ...prev].slice(0, 100))
            }
          }

          applyRemoteSync(res.data)
        })
        .catch(() => {})
    }
    const id = setInterval(poll, 8_000)
    return () => clearInterval(id)
  }, [applyRemoteSync])

  // ── Pedir permissão de notificação (mostra prompt discreto) ──
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      const timer = setTimeout(() => setShowNotifPrompt(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  // ── Computed ─────────────────────────────────────────

  const deletedSet = useMemo(() => new Set(deletedIds), [deletedIds])

  const allItems = useMemo((): ContentItem[] => {
    return [...DATA, ...customItems]
      .filter(i => !deletedSet.has(i.i))
      .map(i => {
        const edit = editedItems[i.i]
        if (!edit) return i
        return {
          ...i,
          ...(edit.tp ? { tp: edit.tp } : {}),
          ...(edit.n ? { n: edit.n } : {}),
          dt: edit.dt ? new Date(edit.dt) : i.dt,
        }
      })
  }, [customItems, deletedSet, editedItems])

  // ── Notificação às 7h ─────────────────────────────────
  useEffect(() => {
    if (notifPermission !== 'granted') return
    const h = now.getHours()
    const m = now.getMinutes()
    if (h !== 7 || m > 4) return
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    const lastKey = 'sm_notif_last'
    if (localStorage.getItem(lastKey) === today.toDateString()) return
    localStorage.setItem(lastKey, today.toDateString())
    const todayEnd = new Date(today.getTime() + 86_400_000)
    const todayCount = allItems.filter(i => i.dt >= today && i.dt < todayEnd).length
    const lateCount  = allItems.filter(i => (states[i.i]?.status ?? i.s) < 3 && i.dt < today).length
    const body = [
      todayCount ? `${todayCount} conteúdo${todayCount !== 1 ? 's' : ''} para publicar hoje` : '',
      lateCount  ? `⚠️ ${lateCount} atrasado${lateCount !== 1 ? 's' : ''}` : '',
    ].filter(Boolean).join(' · ') || 'Bom dia!'
    new Notification('Digital Scale ☀️', { body, icon: '/logo.png' })
  }, [now, notifPermission, allItems, states])

  // ── Atalhos de teclado globais ────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key >= '1' && e.key <= '9') { setTab(parseInt(e.key) - 1); return }
      if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) {
        setSearchOpen(v => !v)
        return
      }
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); return }
      if (e.key === 'p' || e.key === 'P') { setPresentationOpen(v => !v); return }
      if (e.key === 'r' || e.key === 'R') { setReportOpen(v => !v); return }
      if (e.key === 'a' || e.key === 'A') { setScaleAIOpen(v => !v); return }
      if (e.key === '?') { setHelpOpen(v => !v); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Confetti: detecta quando cliente novo atinge 100% ──
  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const current100 = new Set<string>()
    allClients.forEach(client => {
      const ci = allItems.filter(i => i.c === client.name)
      if (ci.length === 0) return
      const published = ci.filter(i => (states[i.i]?.status ?? i.s) === 7).length
      if (published === ci.length) current100.add(client.name)
    })
    // Fire confetti if a new client just hit 100% (wasn't there before)
    for (const name of current100) {
      if (!prev100Clients.current.has(name) && prev100Clients.current.size > 0) {
        setConfettiActive(true)
        break
      }
    }
    prev100Clients.current = current100
  }, [states, allItems, allClients]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutações de estado de item ────────────────────────

  const STATUS_HISTORY_LABEL = (Object.values(STATUS_CONFIG) as typeof STATUS_CONFIG[0][]).map(c => c.label)

  const updateItem = useCallback((id: number, patch: Partial<ItemState>) => {
    setStates(prev => {
      const existing = prev[id] ?? { status: 0, title: '', link: '', caption: '', notes: '' }
      let finalPatch = patch

      // Auto-registra mudança de status no histórico
      if (patch.status !== undefined && patch.status !== existing.status) {
        const entry: HistoryEntry = { action: `→ ${STATUS_HISTORY_LABEL[patch.status]}`, ts: Date.now() }
        finalPatch = { ...patch, history: [...(existing.history ?? []), entry] }
      }
      // Auto-registra quando criativo é vinculado pela primeira vez
      else if (patch.link !== undefined && patch.link && !existing.link) {
        const entry: HistoryEntry = { action: 'Criativo vinculado', ts: Date.now() }
        finalPatch = { ...patch, history: [...(existing.history ?? []), entry] }
      }

      const next = { ...prev, [id]: { ...existing, ...finalPatch } }
      localStorage.setItem('sm_states', JSON.stringify(next))
      fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...next[id] }),
      }).catch(() => {})
      syncToCloud('sm_states', next)
      return next
    })
  }, [])

  const setStatus = useCallback((id: number, status: Status) => {
    updateItem(id, { status })
    // Open engagement tracking dialog when content is published
    if (status === 7) setEngagementItemId(id)
  }, [updateItem])

  const handleSendToClient = useCallback(async (itemId: number, clientName: string) => {
    let token: string | undefined
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', clientName }),
      })
      const data = await res.json() as { ok: boolean; token?: string }
      if (data.ok && data.token) token = data.token
    } catch {}

    const itemState = states[itemId]
    const contentTitle = itemState?.title || `Item ${itemId}`
    const contact = clientPhones[clientName] || allClients.find(c => c.name === clientName)?.whatsapp

    updateItem(itemId, { status: 4, sentToClientAt: Date.now(), approvalToken: token })

    if (token) {
      const approvalUrl = generateApprovalUrl(token, itemId)
      const message = generateApprovalMessage(clientName, contentTitle, approvalUrl)

      if (contact && isGroupLink(contact)) {
        // Grupo WhatsApp: copia mensagem e abre o grupo
        const copied = await openWhatsAppGroup(contact, message)
        setSnack({
          msg: copied
            ? '✅ Mensagem copiada! Cole no grupo do WhatsApp e envie.'
            : '📤 Grupo aberto! Cole a mensagem manualmente.',
          severity: 'success',
        })
      } else if (contact) {
        // Número individual: abre wa.me com mensagem pré-preenchida
        openWhatsAppApproval(contact, clientName, contentTitle, approvalUrl)
        setSnack({ msg: `📤 WhatsApp aberto para ${clientName}!`, severity: 'success' })
      } else {
        // Sem contato configurado: copia o link e avisa
        try { await navigator.clipboard.writeText(approvalUrl) } catch {}
        setSnack({ msg: '⚠️ Configure o WhatsApp do cliente na aba Clientes. Link copiado!', severity: 'warning' })
      }
    }
  }, [states, clientPhones, allClients, updateItem])

  const deleteItem = useCallback((id: number) => {
    setDeletedIds(prev => {
      const next = [...prev, id]
      localStorage.setItem('sm_deleted', JSON.stringify(next))
      syncToCloud('sm_deleted', next)
      return next
    })
  }, [])

  const editItem = useCallback((id: number, patch: ItemEditPatch) => {
    const isCustom = customItems.some(i => i.i === id)
    if (isCustom) {
      setCustomItems(prev => {
        const idx = prev.findIndex(i => i.i === id)
        if (idx < 0) return prev
        const next = [...prev]
        next[idx] = {
          ...next[idx],
          ...(patch.tp ? { tp: patch.tp } : {}),
          ...(patch.n !== undefined ? { n: patch.n } : {}),
          dt: patch.dt ?? next[idx].dt,
        }
        const serialized = next.map(serializeItem)
        localStorage.setItem('sm_custom', JSON.stringify(serialized))
        syncToCloud('sm_custom', serialized)
        return next
      })
    } else {
      setEditedItems(prev => {
        const cur = prev[id] ?? {}
        const next = {
          ...prev,
          [id]: {
            ...cur,
            ...(patch.tp ? { tp: patch.tp } : {}),
            ...(patch.n !== undefined ? { n: patch.n } : {}),
            ...(patch.dt ? { dt: patch.dt.toISOString() } : {}),
          },
        }
        localStorage.setItem('sm_edits', JSON.stringify(next))
        syncToCloud('sm_edits', next)
        return next
      })
    }
  }, [customItems])

  // ── Adicionar item avulso ─────────────────────────────

  const addItem = useCallback((clientName: string, title: string, type: import('./types').ContentType, date: Date, status: Status) => {
    const newId = Date.now()
    const newItem: ContentItem = { i: newId, c: clientName, dt: date, tp: type, n: title, s: status, custom: true }
    setCustomItems(prev => {
      const next = [...prev, newItem]
      const serialized = next.map(serializeItem)
      localStorage.setItem('sm_custom', JSON.stringify(serialized))
      syncToCloud('sm_custom', serialized)
      return next
    })
    setStates(prev => {
      const next = { ...prev, [newId]: { status, title, link: '', caption: '', notes: '' } }
      localStorage.setItem('sm_states', JSON.stringify(next))
      syncToCloud('sm_states', next)
      return next
    })
  }, [])

  // ── Hashtags por cliente ──────────────────────────────

  const setClientHashtags = useCallback((clientName: string, tags: string[]) => {
    setClientHashtagsState(prev => {
      const next = { ...prev, [clientName]: tags }
      localStorage.setItem('sm_client_hashtags', JSON.stringify(next))
      syncToCloud('sm_client_hashtags', next)
      return next
    })
  }, [])

  const setCaptionTemplates = useCallback((clientName: string, templates: string[]) => {
    setCaptionTemplatesState(prev => {
      const next = { ...prev, [clientName]: templates }
      localStorage.setItem('sm_caption_templates', JSON.stringify(next))
      syncToCloud('sm_caption_templates', next)
      return next
    })
  }, [])

  // ── Cor do cliente ────────────────────────────────────

  const setClientColor = useCallback((clientName: string, color: string) => {
    setClientColorsState(prev => {
      const next = { ...prev, [clientName]: color }
      localStorage.setItem('sm_client_colors', JSON.stringify(next))
      syncToCloud('sm_client_colors', next)
      return next
    })
  }, [])

  // ── Telefone WhatsApp do cliente ──────────────────────

  const setClientPhone = useCallback((clientName: string, phone: string) => {
    setClientPhones(prev => {
      const next = { ...prev, [clientName]: phone }
      localStorage.setItem('sm_client_phones', JSON.stringify(next))
      return next
    })
  }, [])

  // ── Duplicar item ─────────────────────────────────────

  const duplicateItem = useCallback((id: number) => {
    const original = allItems.find(i => i.i === id)
    if (!original) return
    const newId = Date.now()
    const newItem: ContentItem = {
      ...original,
      i: newId,
      n: `${original.n} (cópia)`,
      custom: true,
    }
    const origState = states[id]
    setCustomItems(prev => {
      const next = [...prev, newItem]
      const serialized = next.map(serializeItem)
      localStorage.setItem('sm_custom', JSON.stringify(serialized))
      syncToCloud('sm_custom', serialized)
      return next
    })
    setStates(prev => {
      const next = { ...prev, [newId]: { ...origState, title: origState?.title ? `${origState.title} (cópia)` : '' } }
      localStorage.setItem('sm_states', JSON.stringify(next))
      syncToCloud('sm_states', next)
      return next
    })
  }, [allItems, states])

  // ── Pasta Drive do cliente ────────────────────────────

  const setClientFolder = useCallback((clientName: string, url: string) => {
    setClientFolders(prev => {
      const next = { ...prev, [clientName]: url }
      localStorage.setItem('sm_client_folders', JSON.stringify(next))
      syncToCloud('sm_client_folders', next)
      return next
    })
  }, [])

  // ── Roteiros — adicionar e distribuir automaticamente ──

  const applyDistribution = useCallback((
    clientName: string,
    roteiroList: Roteiro[],
    year: number,
    month: number,
  ) => {
    const { newItems, newStates } = buildDistribution(clientName, roteiroList, customItems, year, month)

    setCustomItems(prev => {
      const filtered = prev.filter(
        i => !(i.c === clientName && i.custom && i.dt.getFullYear() === year && i.dt.getMonth() === month)
      )
      const next = [...filtered, ...newItems]
      const serialized = next.map(serializeItem)
      localStorage.setItem('sm_custom', JSON.stringify(serialized))
      syncToCloud('sm_custom', serialized)
      return next
    })

    setStates(prev => {
      const next = { ...prev, ...newStates }
      localStorage.setItem('sm_states', JSON.stringify(next))
      syncToCloud('sm_states', next)
      return next
    })
  }, [customItems])

  // Adicionar roteiro → redistribuir automaticamente
  const addRoteiroAndDistribute = useCallback((
    clientName: string,
    r: Omit<Roteiro, 'id' | 'clientName' | 'distributed'>,
    year: number,
    month: number,
  ) => {
    const newRoteiro: Roteiro = { ...r, id: crypto.randomUUID(), clientName, distributed: true, year, month }
    const existingForMonth = (roteiros[clientName] ?? []).filter(rot => rot.year === year && rot.month === month)
    const fullList = [...existingForMonth, newRoteiro]

    setRoteiros(prev => {
      const next = { ...prev, [clientName]: [...(prev[clientName] ?? []), newRoteiro] }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      syncToCloud('sm_roteiros', next)
      return next
    })

    applyDistribution(clientName, fullList, year, month)
  }, [roteiros, applyDistribution])

  // Adicionar múltiplos roteiros de uma vez → redistribuir (evita stale state em chamadas sequenciais)
  const addManyRoteirosAndDistribute = useCallback((
    clientName: string,
    list: Omit<Roteiro, 'id' | 'clientName' | 'distributed'>[],
    year: number,
    month: number,
  ) => {
    const newRoteiros: Roteiro[] = list.map(r => ({
      ...r, id: crypto.randomUUID(), clientName, distributed: true, year, month,
    }))
    // Usa apenas os roteiros do mesmo mês (não acumula meses anteriores)
    const existingForMonth = (roteiros[clientName] ?? []).filter(rot => rot.year === year && rot.month === month)
    const fullList = [...existingForMonth, ...newRoteiros]

    setRoteiros(prev => {
      const next = { ...prev, [clientName]: [...(prev[clientName] ?? []), ...newRoteiros] }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      syncToCloud('sm_roteiros', next)
      return next
    })

    applyDistribution(clientName, fullList, year, month)
  }, [roteiros, applyDistribution])

  // Remover roteiro → redistribuir apenas o mês afetado
  const removeRoteiroAndRedistribute = useCallback((clientName: string, roteiroId: string) => {
    setRoteiros(prev => {
      const allForClient = prev[clientName] ?? []
      const target = allForClient.find(r => r.id === roteiroId)
      const year  = target?.year  ?? now.getFullYear()
      const month = target?.month ?? now.getMonth()

      const newList = allForClient.filter(r => r.id !== roteiroId)
      const listForMonth = newList.filter(r => r.year === year && r.month === month)
      const next = { ...prev, [clientName]: newList }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      syncToCloud('sm_roteiros', next)

      const { newItems, newStates } = buildDistribution(clientName, listForMonth, customItems, year, month)

      setCustomItems(c => {
        const filtered = c.filter(
          i => !(i.c === clientName && i.custom && i.dt.getFullYear() === year && i.dt.getMonth() === month)
        )
        const updated = [...filtered, ...newItems]
        const serialized = updated.map(serializeItem)
        localStorage.setItem('sm_custom', JSON.stringify(serialized))
        syncToCloud('sm_custom', serialized)
        return updated
      })

      setStates(s => {
        const updated = { ...s, ...newStates }
        localStorage.setItem('sm_states', JSON.stringify(updated))
        syncToCloud('sm_states', updated)
        return updated
      })

      return next
    })
  }, [roteiros, customItems, now])

  // Redistribuir manualmente (só o mês selecionado)
  const redistributeClient = useCallback((clientName: string, year: number, month: number) => {
    const listForMonth = (roteiros[clientName] ?? []).filter(r => r.year === year && r.month === month)
    applyDistribution(clientName, listForMonth, year, month)
    setRoteiros(prev => {
      const next = {
        ...prev,
        [clientName]: (prev[clientName] ?? []).map(r =>
          (r.year === year && r.month === month) ? { ...r, distributed: true } : r,
        ),
      }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      syncToCloud('sm_roteiros', next)
      return next
    })
  }, [roteiros, applyDistribution])

  const clearDistribution = useCallback((clientName: string, year: number, month: number) => {
    setCustomItems(prev => {
      const next = prev.filter(
        i => !(i.c === clientName && i.custom && i.dt.getFullYear() === year && i.dt.getMonth() === month)
      )
      const serialized = next.map(serializeItem)
      localStorage.setItem('sm_custom', JSON.stringify(serialized))
      syncToCloud('sm_custom', serialized)
      return next
    })
    setRoteiros(prev => {
      const next = {
        ...prev,
        [clientName]: (prev[clientName] ?? []).map(r =>
          (r.year === year && r.month === month) ? { ...r, distributed: false } : r,
        ),
      }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      syncToCloud('sm_roteiros', next)
      return next
    })
  }, [])

  // IA: criar roteiros genéricos e distribuir em massa (substitui apenas o mês alvo)
  const createAndDistributeMany = useCallback((clientName: string, posts: number, reels: number, year?: number, month?: number) => {
    const y = year ?? now.getFullYear()
    const m = month ?? now.getMonth()
    const folderLink = clientFolders[clientName]

    const newRoteiros: Roteiro[] = [
      ...Array.from({ length: posts }, (_, i) => ({
        id: crypto.randomUUID(), clientName,
        title: `Post ${i + 1}`, type: 'Post' as ContentType,
        driveLink: folderLink, distributed: true, year: y, month: m,
      })),
      ...Array.from({ length: reels }, (_, i) => ({
        id: crypto.randomUUID(), clientName,
        title: `Reel ${i + 1}`, type: 'Reel' as ContentType,
        driveLink: folderLink, distributed: true, year: y, month: m,
      })),
    ]

    setRoteiros(prev => {
      // Mantém roteiros de outros meses, substitui apenas o mês alvo
      const othersForClient = (prev[clientName] ?? []).filter(r => !(r.year === y && r.month === m))
      const next = { ...prev, [clientName]: [...othersForClient, ...newRoteiros] }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      syncToCloud('sm_roteiros', next)
      return next
    })

    applyDistribution(clientName, newRoteiros, y, m)
  }, [now, clientFolders, applyDistribution])

  // ── Adicionar novo cliente ────────────────────────────

  const addClient = useCallback((client: import('./types').Client) => {
    setExtraClients(prev => {
      const next = [...prev, client]
      localStorage.setItem('sm_extra_clients', JSON.stringify(next))
      syncToCloud('sm_extra_clients', next)
      return next
    })
  }, [])

  // ── Excluir cliente ───────────────────────────────────

  const deleteClient = useCallback((name: string) => {
    setExtraClients(prev => {
      const next = prev.filter(c => c.name !== name)
      localStorage.setItem('sm_extra_clients', JSON.stringify(next))
      syncToCloud('sm_extra_clients', next)
      return next
    })
    setHiddenClients(prev => {
      const next = [...prev, name]
      localStorage.setItem('sm_hidden_clients', JSON.stringify(next))
      syncToCloud('sm_hidden_clients', next)
      return next
    })
  }, [])

  // ── Distribuir todos os clientes de uma vez ───────────

  const distributeAll = useCallback((year: number, month: number) => {
    allClients.forEach(client => {
      createAndDistributeMany(client.name, client.postsPerMonth, client.reelsPerMonth, year, month)
    })
  }, [allClients, createAndDistributeMany])

  // ── Iniciar novo mês: usa roteiros se existirem, senão cria genéricos ──

  const startNewMonth = useCallback((year: number, month: number) => {
    allClients.forEach(client => {
      const roteiroList = roteiros[client.name] ?? []
      if (roteiroList.length > 0) {
        applyDistribution(client.name, roteiroList, year, month)
      } else {
        createAndDistributeMany(client.name, client.postsPerMonth, client.reelsPerMonth, year, month)
      }
    })
  }, [allClients, roteiros, applyDistribution, createAndDistributeMany])

  // ── Reagen dar item (drag no calendário) ─────────────

  const rescheduleItem = useCallback((id: number, newDate: Date) => {
    editItem(id, { dt: newDate })
  }, [editItem])

  // ── Estatísticas do header ────────────────────────────

  const headerStats = useMemo(() => {
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today.getTime() + 86_400_000)
    const late = allItems.filter(i => (states[i.i]?.status ?? i.s) < 3 && i.dt < today).length
    const todayTotal = allItems.filter(i => i.dt >= today && i.dt < tomorrow).length
    const todayDone  = allItems.filter(i => i.dt >= today && i.dt < tomorrow && (states[i.i]?.status ?? i.s) === 3).length
    return { late, todayTotal, todayDone }
  }, [allItems, states, now])

  // ── Contexto para IA ──────────────────────────────────

  const aiContext = useMemo(() => {
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    return {
      clients: [...new Set(allItems.map(i => i.c))].sort(),
      totalItems: allItems.length,
      published: allItems.filter(i => (states[i.i]?.status ?? i.s) === 3).length,
      pending: allItems.filter(i => (states[i.i]?.status ?? i.s) === 0).length,
      late: allItems.filter(i => (states[i.i]?.status ?? i.s) < 3 && i.dt < today).length,
      roteiros: Object.fromEntries(Object.entries(roteiros).map(([c, rs]) => [c, rs.length])),
      clientFolders,
    }
  }, [allItems, states, roteiros, clientFolders, now])

  // ── Props compartilhadas ──────────────────────────────

  const filteredItems = statusFilter !== null
    ? allItems.filter(i => (states[i.i]?.status ?? i.s) === statusFilter)
    : allItems

  const handleSelectUser = (name: string) => {
    sessionStorage.setItem('sm_tab_user', name)
    setCurrentUser(name)
    setShowUserPicker(false)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('sm_tab_user')
    setCurrentUser('')
    setShowSplash(true)
  }

  const sharedProps = {
    items: filteredItems, states,
    onStatusChange: setStatus,
    onUpdate: updateItem,
    onDelete: deleteItem,
    onEdit: editItem,
    onDuplicate: duplicateItem,
    onAddItem: addItem,
    clientColors,
    clientHashtags,
    onSaveHashtags: setClientHashtags,
    captionTemplates,
    onSaveTemplates: setCaptionTemplates,
    allClients,
    now,
    currentUser,
  }

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return allItems.filter(i =>
      i.c.toLowerCase().includes(q) ||
      i.n.toLowerCase().includes(q) ||
      (states[i.i]?.title ?? '').toLowerCase().includes(q)
    ).slice(0, 30)
  }, [searchQuery, allItems, states])

  const isDesktop = useMediaQuery(theme.breakpoints.up('sm'))

  // Informações do usuário logado (cargo, emoji, cor) — derivadas do nome
  const userInfo    = getUserInfo(currentUser)
  const displayName = getDisplayName(currentUser)

  // ── Badge counts per tab ─────────────────────────────
  const navBadges = useMemo(() => {
    const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)
    const todayEnd  = new Date(todayDate.getTime() + 86_400_000)
    const late       = allItems.filter(i => (states[i.i]?.status ?? i.s) < 7 && i.dt < todayDate).length
    const todayPend  = allItems.filter(i => i.dt >= todayDate && i.dt < todayEnd && (states[i.i]?.status ?? i.s) !== 7).length
    const rejected   = allItems.filter(i => (states[i.i]?.status ?? i.s) === 6).length
    const awaitingInt= allItems.filter(i => (states[i.i]?.status ?? i.s) === 2).length
    const clientsAlert = allClients.filter(c => {
      const ci = allItems.filter(i => i.c === c.name)
      return ci.some(i => (states[i.i]?.status ?? i.s) === 6) ||
             ci.some(i => (states[i.i]?.status ?? i.s) < 7 && i.dt < todayDate)
    }).length
    return [
      late + todayPend,   // 0 Hoje
      0,                  // 1 Agenda
      rejected,           // 2 Kanban
      0,                  // 3 Calendário
      clientsAlert,       // 4 Clientes
      0,                  // 5 Dashboard
      0,                  // 6 Timeline
      0,                  // 7 Gravações
      0,                  // 8 Editor
      0,                  // 9 Financeiro
      0,                  // 10 Equipe
      awaitingInt,        // 11 IA
    ]
  }, [allItems, states, allClients])

  const navItems = [
    { label: 'Hoje',       icon: <HomeIcon />,           mobileOnly: false },
    { label: 'Agenda',     icon: <ViewAgendaIcon />,     mobileOnly: false },
    { label: 'Kanban',     icon: <ViewKanbanIcon />,     mobileOnly: false },
    { label: 'Calendário', icon: <CalendarMonthIcon />,  mobileOnly: false },
    { label: 'Clientes',   icon: <PeopleIcon />,         mobileOnly: false },
    { label: 'Dashboard',  icon: <BarChartIcon />,       mobileOnly: false },
    { label: 'Timeline',   icon: <TimelineIcon />,       mobileOnly: true  },
    { label: 'Gravações',  icon: <VideocamIcon />,       mobileOnly: false },
    { label: 'Editor',     icon: <MovieFilterIcon />,    mobileOnly: false },
    { label: 'Financeiro', icon: <AttachMoneyIcon />,    mobileOnly: false },
    { label: 'Equipe',     icon: <GroupIcon />,          mobileOnly: false },
    { label: 'IA',         icon: <PsychologyIcon />,     mobileOnly: false },
  ]

  const renderTab = () => {
    switch (tab) {
      case 0: return <TodayTab    {...sharedProps} now={now} />
      case 1: return <AgendaTab   {...sharedProps} now={now} />
      case 2: return <KanbanTab   items={allItems} states={states} onStatusChange={setStatus} onDelete={deleteItem} onEdit={editItem} onUpdateState={updateItem} onAddItem={addItem} allClients={allClients} onSendToClient={handleSendToClient} />
      case 3: return <CalendarTab items={filteredItems} states={states} now={now} onStatusChange={setStatus} onUpdate={updateItem} onDelete={deleteItem} onEdit={editItem} onDuplicate={duplicateItem} clientColors={clientColors} clientHashtags={clientHashtags} onSaveHashtags={setClientHashtags} onReschedule={rescheduleItem} />
      case 4: return <ClientsTab  items={allItems} states={states} roteiros={roteiros} clientFolders={clientFolders} clientColors={clientColors} allClients={allClients} onAddRoteiro={addRoteiroAndDistribute} onAddManyRoteiros={addManyRoteirosAndDistribute} onBulkCreate={createAndDistributeMany} onDistributeAll={distributeAll} onStartNewMonth={startNewMonth} onAddClient={addClient} onDeleteClient={deleteClient} onRemoveRoteiro={removeRoteiroAndRedistribute} onRedistribute={redistributeClient} onClearDistribution={clearDistribution} onSetClientFolder={setClientFolder} onSetClientColor={setClientColor} onClientFocus={setFocusClient} clientPhones={clientPhones} onSetClientPhone={setClientPhone} />
      case 5: return <KaiqueTab      items={allItems} states={states} allClients={allClients} now={now} />
      case 6: return <TimelineTab    items={allItems} states={states} now={now} />
      case 7: return <RecordingCenter allClients={allClients.map(c => c.name)} />
      case 8: return <EditorMode items={allItems} states={states} onStatusChange={setStatus} onUpdate={updateItem} roteiros={roteiros} clientFolders={clientFolders} now={now} currentUser={currentUser} />
      case 9: return <FinanceiroTab allClients={allClients} />
      case 10: return <EquipeTab items={allItems} states={states} currentUser={currentUser} />
      case 11: return <IATab allClients={allClients} items={allItems} states={states} />
      default: return null
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <UserPicker open={showUserPicker} onSelect={handleSelectUser} />
      <AccessManager open={accessManagerOpen} onClose={() => setAccessManagerOpen(false)} />
      {showSplash && (
        <SplashScreen
          showLogin={!currentUser}
          onLogin={handleSelectUser}
          onFinish={() => setShowSplash(false)}
        />
      )}
      <PresentationMode
        open={presentationOpen}
        onClose={() => setPresentationOpen(false)}
        items={allItems}
        states={states}
        clientColors={clientColors}
      />
      <ScaleAI
        open={scaleAIOpen}
        onClose={() => setScaleAIOpen(false)}
        context={aiContext}
      />
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
      <Confetti active={confettiActive} onDone={() => setConfettiActive(false)} />
      <EngagementDialog
        open={engagementItemId !== null}
        itemId={engagementItemId}
        items={allItems}
        states={states}
        onSave={(id, eng) => updateItem(id, { engagement: { ...(states[id]?.engagement ?? {}), ...eng } })}
        onClose={() => setEngagementItemId(null)}
      />
      <Box sx={{ display: 'flex', height: '100dvh', bgcolor: 'background.default', position: 'relative', overflow: 'hidden' }}>

        {/* ── Blobs de fundo ────────────────────────────── */}
        <Box sx={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <Box sx={{
            position: 'absolute', width: { xs: 400, xl: 800 }, height: { xs: 400, xl: 800 }, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,144,57,0.08) 0%, transparent 70%)',
            top: -120, right: -80,
            '@keyframes blobFloat': {
              '0%,100%': { transform: 'translate(0,0) scale(1)' },
              '50%': { transform: 'translate(-20px,30px) scale(1.08)' },
            },
            animation: 'blobFloat 12s ease-in-out infinite',
          }} />
          <Box sx={{
            position: 'absolute', width: { xs: 300, xl: 600 }, height: { xs: 300, xl: 600 }, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,83,57,0.05) 0%, transparent 70%)',
            bottom: 80, left: -60,
            animation: 'blobFloat 16s ease-in-out infinite reverse',
          }} />
          <Box sx={{
            position: 'absolute', width: { xs: 200, xl: 400 }, height: { xs: 200, xl: 400 }, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,142,255,0.04) 0%, transparent 70%)',
            bottom: '40%', right: '20%',
            animation: 'blobFloat 20s ease-in-out infinite 4s',
          }} />
        </Box>

        {/* ── Sidebar desktop ───────────────────────────── */}
        {isDesktop && (
          <Box sx={{
            position: 'relative', zIndex: 2,
            width: { md: 236, lg: 272, xl: 312 },
            flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            borderRight: '1px solid rgba(255,144,57,0.1)',
            background: 'linear-gradient(180deg, #0c0804 0%, #090909 40%, #080808 100%)',
            backdropFilter: 'blur(24px)',
            overflow: 'hidden',
          }}>

            {/* ── Grid / tech pattern overlay ── */}
            <Box sx={{
              position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
              backgroundImage: [
                'linear-gradient(rgba(255,144,57,0.025) 1px, transparent 1px)',
                'linear-gradient(90deg, rgba(255,144,57,0.025) 1px, transparent 1px)',
              ].join(','),
              backgroundSize: '32px 32px',
              opacity: 0.8,
            }} />

            {/* ── Vignette edges ── */}
            <Box sx={{
              position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
              background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.5) 100%)',
            }} />

            {/* ── Top orange ambient light ── */}
            <Box sx={{
              position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
              width: 260, height: 260, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,144,57,0.1) 0%, transparent 70%)',
              pointerEvents: 'none', zIndex: 0,
              '@keyframes ambientBreath': {
                '0%,100%': { opacity: 0.6, transform: 'translateX(-50%) scale(1)' },
                '50%':     { opacity: 1,   transform: 'translateX(-50%) scale(1.15)' },
              },
              animation: 'ambientBreath 5s ease-in-out infinite',
            }} />

            {/* ── Logo hero ── */}
            <Box sx={{
              borderBottom: '1px solid rgba(255,144,57,0.08)',
              position: 'relative', zIndex: 1,
            }}>
              <Logo size="sidebar" />
            </Box>

            {/* ── Date + clock (tech style) ── */}
            <Box sx={{
              px: 2.5, pt: 1.8, pb: 1.6, position: 'relative', zIndex: 1,
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <Typography sx={{ fontSize: { md: '0.68rem', xl: '0.76rem' }, color: 'rgba(255,144,57,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, display: 'block', mb: 0.3 }}>
                {getGreeting()}
              </Typography>
              <Typography sx={{
                color: 'primary.main', fontWeight: 900,
                fontSize: { md: '1.65rem', xl: '2rem' },
                lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
                textShadow: '0 0 20px rgba(255,144,57,0.5)',
              }}>
                {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Typography>
              <Typography sx={{ fontSize: { md: '0.68rem', xl: '0.76rem' }, color: 'rgba(255,255,255,0.38)', textTransform: 'capitalize', mt: 0.4, letterSpacing: '0.04em' }}>
                {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </Typography>
            </Box>

            {/* ── Stats chips ── */}
            <Box sx={{ px: 2, py: 1.2, display: 'flex', flexDirection: 'column', gap: 0.5, position: 'relative', zIndex: 1 }}>
              {headerStats.late > 0 && (
                <Chip icon={<WarningAmberIcon />} label={`${headerStats.late} atrasado${headerStats.late > 1 ? 's' : ''}`} size="small" color="error" variant="outlined" sx={{ fontSize: { md: '0.68rem', xl: '0.76rem' }, height: 26, justifyContent: 'flex-start', '& .MuiChip-icon': { fontSize: 13 } }} />
              )}
              <Chip icon={<CheckCircleIcon />} label={`Hoje: ${headerStats.todayDone}/${headerStats.todayTotal}`} size="small" color={headerStats.todayDone === headerStats.todayTotal && headerStats.todayTotal > 0 ? 'success' : 'default'} variant="outlined" sx={{ fontSize: { md: '0.68rem', xl: '0.76rem' }, height: 26, justifyContent: 'flex-start', '& .MuiChip-icon': { fontSize: 13 } }} />
            </Box>

            {/* ── Nav items ── */}
            <Box sx={{
              flex: 1, px: 1.2, pt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.25,
              position: 'relative', zIndex: 1,
              overflowY: 'auto',
              '&::-webkit-scrollbar': { width: 3 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,144,57,0.2)', borderRadius: 2 },
              '@keyframes neonSmoke': {
                '0%':   { filter: 'drop-shadow(0 0 2px #ff903988) drop-shadow(0 0 6px #ff903955)' },
                '40%':  { filter: 'drop-shadow(0 0 10px #ff9039cc) drop-shadow(0 0 22px #ff5339aa)' },
                '100%': { filter: 'drop-shadow(0 0 4px #ff903966) drop-shadow(0 0 10px #ff903933)' },
              },
            }}>
              {navItems.map(({ label, icon }, idx) => {
                const selected = tab === idx
                return (
                  <Box
                    key={label}
                    onClick={() => setTab(idx)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.4,
                      px: 1.6, py: 1.0, borderRadius: 2.5, cursor: 'pointer',
                      transition: 'all 0.22s ease',
                      position: 'relative',
                      bgcolor: selected ? 'rgba(255,144,57,0.09)' : 'transparent',
                      border: '1px solid',
                      borderColor: selected ? 'rgba(255,144,57,0.22)' : 'transparent',
                      boxShadow: selected ? '0 0 20px rgba(255,144,57,0.06) inset' : 'none',
                      '&:hover': {
                        bgcolor: selected ? 'rgba(255,144,57,0.12)' : 'rgba(255,255,255,0.035)',
                        borderColor: selected ? 'rgba(255,144,57,0.3)' : 'rgba(255,255,255,0.06)',
                        transform: 'translateX(2px)',
                      },
                    }}
                  >
                    {/* Selected glow bar */}
                    {selected && (
                      <Box sx={{
                        position: 'absolute', left: 0, top: '20%', bottom: '20%',
                        width: 2.5, borderRadius: '0 2px 2px 0',
                        bgcolor: 'primary.main',
                        boxShadow: '0 0 10px rgba(255,144,57,0.9), 0 0 20px rgba(255,144,57,0.4)',
                      }} />
                    )}
                    <Box sx={{
                      color: selected ? 'primary.main' : 'rgba(255,255,255,0.35)',
                      fontSize: { md: '1.2rem', xl: '1.35rem' },
                      display: 'flex', alignItems: 'center',
                      transition: 'all 0.2s',
                      ...(selected && { animation: 'neonSmoke 0.6s ease-out forwards' }),
                    }}>
                      {icon}
                    </Box>
                    <Typography sx={{
                      fontSize: { md: '0.86rem', xl: '0.96rem' },
                      fontWeight: selected ? 800 : 500,
                      color: selected ? 'primary.main' : 'rgba(255,255,255,0.52)',
                      letterSpacing: selected ? '0.04em' : '0.01em',
                      flex: 1,
                      transition: 'all 0.2s',
                      ...(selected && { textShadow: '0 0 10px rgba(255,144,57,0.65)' }),
                    }}>
                      {label}
                    </Typography>
                    {/* Badge — alert count */}
                    {navBadges[idx] > 0 && !selected && (
                      <Box sx={{
                        minWidth: 18, height: 18, borderRadius: 9, px: 0.5,
                        bgcolor: idx === 2 ? '#FF4545' : 'primary.main',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Typography sx={{ fontSize: '0.5rem', fontWeight: 900, color: '#000', lineHeight: 1 }}>
                          {navBadges[idx] > 99 ? '99+' : navBadges[idx]}
                        </Typography>
                      </Box>
                    )}
                    {selected && (
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', boxShadow: '0 0 6px rgba(255,144,57,0.9)', flexShrink: 0 }} />
                    )}
                  </Box>
                )
              })}
            </Box>

            {/* ── Status filter ── */}
            <Box sx={{ px: 1.5, pb: 1.4, borderTop: '1px solid rgba(255,255,255,0.04)', pt: 1.2, position: 'relative', zIndex: 1 }}>
              <Typography sx={{ fontSize: { md: '0.6rem', xl: '0.66rem' }, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8, fontWeight: 700 }}>
                Filtrar por status
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                {/* "Todos" */}
                {(() => {
                  const active = statusFilter === null
                  return (
                    <Box key="todos" onClick={() => setStatusFilter(null)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.2, py: 0.6, borderRadius: 2, cursor: 'pointer', bgcolor: active ? 'rgba(255,255,255,0.07)' : 'transparent', transition: 'background 0.15s', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: active ? 700 : 400, color: active ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)', flex: 1 }}>Todos</Typography>
                    </Box>
                  )
                })()}
                {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG[0]][]).map(([sVal, cfg]) => {
                  const s = Number(sVal)
                  const active = statusFilter === s
                  const count = allItems.filter(i => (states[i.i]?.status ?? i.s) === s).length
                  return (
                    <Box key={sVal} onClick={() => setStatusFilter(s)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.2, py: 0.5, borderRadius: 2, cursor: 'pointer', bgcolor: active ? `${cfg.color}14` : 'transparent', transition: 'background 0.15s', '&:hover': { bgcolor: active ? `${cfg.color}20` : 'rgba(255,255,255,0.04)' } }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: cfg.dot, flexShrink: 0, boxShadow: active ? `0 0 5px ${cfg.dot}` : 'none' }} />
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: active ? 700 : 400, color: active ? cfg.color : 'rgba(255,255,255,0.38)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cfg.shortLabel}
                      </Typography>
                      <Typography sx={{ fontSize: '0.58rem', color: active ? cfg.color : 'rgba(255,255,255,0.22)', fontWeight: active ? 700 : 400 }}>
                        {count}
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
            </Box>

            {/* ── Footer: saudação + cargo + ações ── */}
            <Box sx={{ px: 2, pt: 1.4, pb: 1.6, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 1.2, position: 'relative', zIndex: 1 }}>

              {/* Cartão de usuário — somente leitura, sem troca de função */}
              {currentUser && userInfo ? (
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  p: 1, borderRadius: 2,
                  bgcolor: `${userInfo.color}08`,
                  border: `1px solid ${userInfo.color}20`,
                }}>
                  {/* Emoji avatar */}
                  <Box sx={{
                    width: 34, height: 34, borderRadius: '10px', flexShrink: 0,
                    bgcolor: `${userInfo.color}14`,
                    border: `1.5px solid ${userInfo.color}35`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{userInfo.emoji}</Typography>
                  </Box>
                  {/* Nome + cargo */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: { md: '0.82rem', xl: '0.92rem' }, fontWeight: 800, color: '#fff', lineHeight: 1.25 }} noWrap>
                      {displayName}
                    </Typography>
                    <Typography sx={{ fontSize: { md: '0.68rem', xl: '0.75rem' }, color: userInfo.color, fontWeight: 700, lineHeight: 1.3, opacity: 0.9 }} noWrap>
                      {userInfo.role}
                    </Typography>
                  </Box>
                  {/* Gerenciar Acesso (somente Sócio) */}
                  {userInfo.role === 'Sócio' && (
                    <Box
                      onClick={() => setAccessManagerOpen(true)}
                      title="Gerenciar Acesso"
                      sx={{ p: 0.5, borderRadius: 1, cursor: 'pointer', color: 'rgba(255,215,0,0.5)', '&:hover': { color: '#FFD700', bgcolor: 'rgba(255,215,0,0.08)' }, display: 'flex', flexShrink: 0 }}
                    >
                      <AdminPanelSettingsIcon sx={{ fontSize: 15 }} />
                    </Box>
                  )}
                  {/* Logout */}
                  <Box
                    onClick={handleLogout}
                    title="Sair"
                    sx={{ p: 0.5, borderRadius: 1, cursor: 'pointer', color: 'rgba(255,255,255,0.2)', '&:hover': { color: '#FF4545', bgcolor: 'rgba(255,69,69,0.08)' }, display: 'flex', flexShrink: 0 }}
                  >
                    <LogoutIcon sx={{ fontSize: 14 }} />
                  </Box>
                </Box>
              ) : !currentUser ? (
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)' }}>DS HUB</Typography>
              ) : null}

              {/* Botões de ação */}
              <Box sx={{ display: 'flex', gap: 0.8 }}>
                <Box
                  onClick={() => setScaleAIOpen(true)}
                  sx={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4,
                    py: 0.8, borderRadius: 2, cursor: 'pointer',
                    background: 'linear-gradient(135deg, rgba(255,144,57,0.12), rgba(180,90,255,0.1))',
                    border: '1px solid rgba(255,144,57,0.25)',
                    transition: 'all 0.2s',
                    '&:hover': { background: 'linear-gradient(135deg, rgba(255,144,57,0.2), rgba(180,90,255,0.18))', transform: 'translateY(-1px)', boxShadow: '0 4px 14px rgba(255,144,57,0.2)' },
                  }}
                >
                  <AutoAwesomeIcon sx={{ fontSize: 14, color: '#ff9039' }} />
                  <Typography sx={{ fontSize: { md: '0.6rem', xl: '0.66rem' }, fontWeight: 700, lineHeight: 1, background: 'linear-gradient(90deg, #ff9039, #b45aff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Scale AI
                  </Typography>
                </Box>
                <Box
                  onClick={() => setPresentationOpen(true)}
                  sx={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4,
                    py: 0.8, borderRadius: 2, cursor: 'pointer',
                    bgcolor: 'rgba(59,142,255,0.07)', border: '1px solid rgba(59,142,255,0.18)',
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: 'rgba(59,142,255,0.14)', transform: 'translateY(-1px)', boxShadow: '0 4px 14px rgba(59,142,255,0.15)' },
                  }}
                >
                  <Box component="span" sx={{ fontSize: 13, lineHeight: 1 }}>🎯</Box>
                  <Typography sx={{ fontSize: { md: '0.6rem', xl: '0.66rem' }, color: '#3B8EFF', fontWeight: 700, lineHeight: 1 }}>
                    Apresentar
                  </Typography>
                </Box>
                <Box
                  onClick={() => setReportOpen(true)}
                  sx={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4,
                    py: 0.8, borderRadius: 2, cursor: 'pointer',
                    bgcolor: 'rgba(255,144,57,0.07)', border: '1px solid rgba(255,144,57,0.18)',
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: 'rgba(255,144,57,0.13)', transform: 'translateY(-1px)', boxShadow: '0 4px 14px rgba(255,144,57,0.15)' },
                  }}
                >
                  <BarChartIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                  <Typography sx={{ fontSize: { md: '0.6rem', xl: '0.66rem' }, color: 'primary.main', fontWeight: 700, lineHeight: 1 }}>
                    Relatório
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* ── Main area ─────────────────────────────────── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

          {/* ── Header ──────────────────────────────────── */}
          <Paper elevation={0} square sx={{
            px: { xs: 2, md: 3 }, pt: { xs: 1.2, md: 1.5 }, pb: { xs: 1, md: 1.2 },
            borderBottom: '1px solid rgba(255,144,57,0.12)',
            background: 'linear-gradient(135deg, #161616 0%, #1c1408 60%, #161616 100%)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 0.8, md: 0 } }}>
              {/* Mobile: avatar + DIGITAL SCALE em gradiente; Desktop: nome da aba */}
              {!isDesktop ? (
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1.2,
                  '@keyframes dsHeaderGlow': {
                    '0%,100%': { filter: 'drop-shadow(0 0 4px rgba(255,144,57,0.5))' },
                    '50%':     { filter: 'drop-shadow(0 0 10px rgba(255,144,57,0.9)) drop-shadow(0 0 20px rgba(255,83,57,0.5))' },
                  },
                }}>
                  {/* Circular avatar — stays visible at any zoom */}
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '12px', flexShrink: 0,
                    background: 'linear-gradient(135deg, #ff9039 0%, #ff5339 60%, #cc2a00 100%)',
                    p: '2px',
                    animation: 'dsHeaderGlow 3s ease-in-out infinite',
                  }}>
                    <Box sx={{
                      width: '100%', height: '100%', borderRadius: '10px',
                      bgcolor: '#0d0d0d',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      <img src="/logotipo.png" alt="DS" style={{ width: '84%', height: '84%', objectFit: 'contain' }} />
                    </Box>
                  </Box>
                  <Box sx={{ animation: 'dsHeaderGlow 3s ease-in-out infinite' }}>
                    <Typography sx={{
                      fontWeight: 900, fontSize: '1.3rem', lineHeight: 1, letterSpacing: '-0.01em',
                      background: 'linear-gradient(90deg, #ffffff 0%, #ffd080 30%, #ff9039 60%, #ff5339 100%)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text', userSelect: 'none',
                    }}>
                      DIGITAL SCALE
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Typography sx={{
                  fontWeight: 800, fontSize: { md: '1.15rem', lg: '1.35rem', xl: '1.5rem' },
                  color: 'primary.main', letterSpacing: '-0.01em',
                }}>
                  {navItems[tab]?.label}
                </Typography>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {/* Desktop stats inline */}
                {isDesktop && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                    {headerStats.late > 0 && (
                      <Chip icon={<WarningAmberIcon />} label={`${headerStats.late} atrasado${headerStats.late > 1 ? 's' : ''}`} size="small" color="error" variant="outlined" sx={{ fontSize: '0.68rem', height: 24, '& .MuiChip-icon': { fontSize: 12 } }} />
                    )}
                    {/* Progresso circular do dia */}
                    <Box sx={{ position: 'relative', width: 40, height: 40, cursor: 'default' }} title={`${headerStats.todayDone} de ${headerStats.todayTotal} publicados hoje`}>
                      <CircularProgress
                        variant="determinate"
                        value={100}
                        size={40} thickness={3.5}
                        sx={{ color: 'rgba(255,255,255,0.07)', position: 'absolute', top: 0, left: 0 }}
                      />
                      <CircularProgress
                        variant="determinate"
                        value={headerStats.todayTotal > 0 ? (headerStats.todayDone / headerStats.todayTotal) * 100 : 0}
                        size={40} thickness={3.5}
                        sx={{ color: headerStats.todayDone === headerStats.todayTotal && headerStats.todayTotal > 0 ? 'success.main' : 'primary.main', position: 'absolute', top: 0, left: 0 }}
                      />
                      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography sx={{ fontSize: '0.55rem', fontWeight: 900, lineHeight: 1, color: headerStats.todayDone === headerStats.todayTotal && headerStats.todayTotal > 0 ? 'success.main' : 'primary.main' }}>
                          {headerStats.todayDone}/{headerStats.todayTotal}
                        </Typography>
                        <Typography sx={{ fontSize: '0.42rem', color: 'text.disabled', lineHeight: 1, textTransform: 'uppercase', letterSpacing: 0.3 }}>hoje</Typography>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* Notification center */}
                <NotificationCenter
                  notifications={notifications}
                  onMarkRead={id => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
                  onMarkAllRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                  onNavigateToItem={_itemId => { setTab(2); setSearchQuery('') }}
                />

                {/* Search toggle */}
                <Box
                  onClick={() => { setSearchOpen(v => !v); if (searchOpen) setSearchQuery('') }}
                  sx={{ cursor: 'pointer', color: searchOpen ? 'primary.main' : 'text.secondary', display: 'flex', alignItems: 'center' }}
                >
                  {searchOpen ? <CloseIcon sx={{ fontSize: { xs: 18, md: 20 } }} /> : <SearchIcon sx={{ fontSize: { xs: 18, md: 20 } }} />}
                </Box>

                {/* Mobile clock */}
                {!isDesktop && (
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', display: 'block' }}>{getGreeting()}</Typography>
                    <Typography sx={{ color: 'primary.main', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* ── Campo de busca ── */}
            <Collapse in={searchOpen}>
              <Box sx={{ mt: { xs: 0, md: 1 }, mb: 0.8 }}>
                <InputBase
                  autoFocus
                  fullWidth
                  placeholder="Buscar cliente ou conteúdo..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  sx={{
                    fontSize: { xs: '0.85rem', md: '0.95rem' },
                    px: 1.5, py: 0.6, borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,144,57,0.2)',
                    color: 'text.primary',
                  }}
                />
                {searchResults.length > 0 && (
                  <Paper sx={{ mt: 0.5, maxHeight: 280, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
                    <List dense disablePadding>
                      {searchResults.map(item => {
                        const st = states[item.i]?.status ?? item.s
                        const scfg = STATUS_CONFIG[st as Status] ?? STATUS_CONFIG[0]
                        return (
                          <ListItem key={item.i} divider sx={{ py: 0.5, px: 1.5 }}>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                                  <Typography sx={{ fontSize: '0.65rem', color: 'primary.main', fontWeight: 700 }} noWrap>{item.c}</Typography>
                                  <Chip label={item.tp} size="small" sx={{ height: 14, fontSize: '0.52rem' }} />
                                  <Typography sx={{ fontSize: '0.65rem', color: scfg.color, ml: 'auto' }}>
                                    {scfg.shortLabel}
                                  </Typography>
                                </Box>
                              }
                              secondary={
                                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.primary' }} noWrap>
                                  {states[item.i]?.title || item.n}
                                </Typography>
                              }
                            />
                          </ListItem>
                        )
                      })}
                    </List>
                  </Paper>
                )}
                {searchQuery && searchResults.length === 0 && (
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.5, px: 0.5 }}>Nenhum resultado para "{searchQuery}"</Typography>
                )}
              </Box>
            </Collapse>

            {/* Mobile chips row */}
            {!isDesktop && (
              <Box sx={{ display: 'flex', gap: 0.8 }}>
                {headerStats.late > 0 && (
                  <Chip icon={<WarningAmberIcon />} label={`${headerStats.late} atrasado${headerStats.late > 1 ? 's' : ''}`} size="small" color="error" variant="outlined" sx={{ fontSize: '0.6rem', height: 20, '& .MuiChip-icon': { fontSize: 11 } }} />
                )}
                <Chip icon={<CheckCircleIcon />} label={`Hoje: ${headerStats.todayDone}/${headerStats.todayTotal}`} size="small" color={headerStats.todayDone === headerStats.todayTotal && headerStats.todayTotal > 0 ? 'success' : 'default'} variant="outlined" sx={{ fontSize: '0.6rem', height: 20, '& .MuiChip-icon': { fontSize: 11 } }} />
                <Chip label={now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 20, ml: 'auto', borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary' }} />
              </Box>
            )}
          </Paper>

          {/* ── Conteúdo da aba ────────────────────────── */}
          <Box
            key={tab}
            sx={{
              flex: 1, overflow: 'auto',
              '@keyframes tabEnter': {
                from: { opacity: 0, transform: 'translateY(8px)' },
                to:   { opacity: 1, transform: 'translateY(0)' },
              },
              animation: 'tabEnter 0.22s ease',
            }}
          >
            <Suspense fallback={
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: '50%', border: '2.5px solid rgba(255,144,57,0.2)', borderTopColor: '#ff9039', animation: 'spin 0.7s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } }} />
                <Box sx={{ display: 'flex', gap: '5px' }}>
                  {[0,1,2].map(i => <Box key={i} sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'rgba(255,144,57,0.5)', animation: 'dotPulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s`, '@keyframes dotPulse': { '0%,80%,100%': { opacity: 0.2 }, '40%': { opacity: 1 } } }} />)}
                </Box>
              </Box>
            }>
              {renderTab()}
            </Suspense>
          </Box>

          {/* ── Navegação inferior (mobile only — primeiros 6) ─── */}
          {!isDesktop && (
            <Paper elevation={8} square sx={{
              borderTop: '1px solid rgba(255,144,57,0.15)',
              background: 'linear-gradient(180deg, #111 0%, #0d0d0d 100%)',
            }}>
              <BottomNavigation
                showLabels
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{
                  bgcolor: 'transparent', height: 62,
                  '@keyframes neonSmoke': {
                    '0%':   { filter: 'drop-shadow(0 0 2px #ff903988) drop-shadow(0 0 6px #ff903955)' },
                    '40%':  { filter: 'drop-shadow(0 0 10px #ff9039cc) drop-shadow(0 0 22px #ff5339aa) drop-shadow(0 0 40px #ff903966)' },
                    '100%': { filter: 'drop-shadow(0 0 4px #ff903966) drop-shadow(0 0 10px #ff903933)' },
                  },
                }}
              >
                {navItems.filter(n => !n.mobileOnly).map(({ label, icon }, idx) => {
                  const selected = tab === idx
                  const badgeCount = navBadges[idx] ?? 0
                  return (
                    <BottomNavigationAction
                      key={label}
                      label={label}
                      icon={
                        badgeCount > 0 && !selected ? (
                          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                            {icon}
                            <Box sx={{
                              position: 'absolute', top: -4, right: -6,
                              minWidth: 14, height: 14, borderRadius: 7, px: 0.3,
                              bgcolor: idx === 2 ? '#FF4545' : 'primary.main',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Typography sx={{ fontSize: '0.42rem', fontWeight: 900, color: '#000', lineHeight: 1 }}>
                                {badgeCount > 9 ? '9+' : badgeCount}
                              </Typography>
                            </Box>
                          </Box>
                        ) : icon
                      }
                      sx={{
                        minWidth: 0, px: 0.5,
                        color: selected ? 'primary.main' : 'rgba(255,255,255,0.35)',
                        transition: 'color 0.2s',
                        '& .MuiBottomNavigationAction-label': {
                          fontSize: '0.58rem',
                          fontWeight: selected ? 800 : 500,
                          letterSpacing: selected ? '0.06em' : '0.02em',
                          textTransform: 'uppercase',
                          opacity: '1 !important',
                          mt: 0.3,
                          ...(selected && { textShadow: '0 0 8px rgba(255,144,57,0.9), 0 0 16px rgba(255,83,57,0.5)', color: '#ff9039' }),
                        },
                        '& .MuiSvgIcon-root': {
                          fontSize: selected ? '1.4rem' : '1.25rem',
                          transition: 'all 0.2s',
                          ...(selected && { animation: 'neonSmoke 0.6s ease-out forwards', color: '#ff9039' }),
                        },
                        '&.Mui-selected': { color: 'primary.main' },
                      }}
                    />
                  )
                })}
              </BottomNavigation>
            </Paper>
          )}
        </Box>

        {/* ── Relatório Mensal ─────────────────────────── */}
        <MonthlyReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          items={allItems}
          states={states}
          now={now}
        />

        {/* ── ClientFocusModal ─────────────────────────── */}
        <ClientFocusModal
          client={focusClient ? (allClients.find(c => c.name === focusClient) ?? null) : null}
          items={allItems}
          states={states}
          clientFolders={clientFolders}
          clientColors={clientColors}
          onClose={() => setFocusClient(null)}
          onStatusChange={setStatus}
          onUpdate={updateItem}
          onDelete={deleteItem}
          onEdit={editItem}
          onDuplicate={duplicateItem}
          now={now}
        />

        {/* ── Agente IA ─────────────────────────────────── */}
        <AIAgent
          context={aiContext}
          roteiros={roteiros}
          onDistribute={clientName => redistributeClient(clientName, now.getFullYear(), now.getMonth())}
          onClearDistribution={clientName => clearDistribution(clientName, now.getFullYear(), now.getMonth())}
          onCreateAndDistribute={createAndDistributeMany}
        />

        {/* ── Alerta: cliente reprovou criativo ────────────── */}
        {clientNotifs.map((n, i) => (
          <Snackbar
            key={n.id}
            open
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            sx={{ top: `${72 + i * 64}px !important` }}
            onClose={() => setClientNotifs(prev => prev.filter(p => p.id !== n.id))}
            autoHideDuration={12000}
          >
            <Alert
              severity="error"
              variant="filled"
              onClose={() => setClientNotifs(prev => prev.filter(p => p.id !== n.id))}
              action={
                <Button size="small" color="inherit" sx={{ fontWeight: 700, fontSize: '0.68rem' }}
                  onClick={() => { setTab(2); setClientNotifs(prev => prev.filter(p => p.id !== n.id)) }}>
                  Ver Kanban
                </Button>
              }
              sx={{ fontSize: '0.75rem', alignItems: 'center' }}
            >
              ⚠️ Cliente reprovou: <strong>{n.title}</strong>
            </Alert>
          </Snackbar>
        ))}

        {/* ── Prompt de notificação ─────────────────────── */}
        <Snackbar
          open={showNotifPrompt}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{ top: '72px !important' }}
        >
          <Alert
            severity="info"
            icon={<NotificationsActiveIcon fontSize="small" />}
            action={
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button size="small" color="inherit" onClick={() => setShowNotifPrompt(false)}>Agora não</Button>
                <Button
                  size="small" variant="contained" color="primary"
                  onClick={() => {
                    Notification.requestPermission().then(p => {
                      setNotifPermission(p)
                      setShowNotifPrompt(false)
                    })
                  }}
                  sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                >
                  Ativar
                </Button>
              </Box>
            }
            sx={{ fontSize: '0.72rem', alignItems: 'center' }}
          >
            Ativar notificação às 7h com o resumo do dia?
          </Alert>
        </Snackbar>

        {/* ── Toast WhatsApp ────────────────────────────── */}
        <Snackbar
          open={!!snack}
          autoHideDuration={4500}
          onClose={() => setSnack(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snack?.severity ?? 'info'} onClose={() => setSnack(null)} sx={{ fontSize: '0.78rem', fontWeight: 600 }}>
            {snack?.msg}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  )
}
