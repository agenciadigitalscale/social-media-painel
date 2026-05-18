import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ThemeProvider, CssBaseline, Box, BottomNavigation,
  BottomNavigationAction, Paper, Typography, Chip,
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda'
import PeopleIcon from '@mui/icons-material/People'
import ViewKanbanIcon from '@mui/icons-material/ViewKanban'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import theme from './theme'
import type { ContentItem, ContentType, ItemEditPatch, ItemState, Roteiro, Status } from './types'
import { DATA, CLIENTS } from './data'
import Logo from './components/Logo'
import TodayTab from './components/TodayTab'
import AgendaTab from './components/AgendaTab'
import CalendarTab from './components/CalendarTab'
import ClientsTab from './components/ClientsTab'
import KanbanTab from './components/KanbanTab'
import AIAgent from './components/AIAgent'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia ☀️'
  if (h < 18) return 'Boa tarde 🌤'
  return 'Boa noite 🌙'
}

// ── Serialização ───────────────────────────────────────

function serializeItem(item: ContentItem) {
  return { ...item, dt: item.dt.toISOString() }
}

function deserializeItem(raw: Record<string, unknown>): ContentItem {
  return { ...raw, dt: new Date(raw.dt as string) } as ContentItem
}

// ── Carregamento do localStorage ───────────────────────

function loadStates(): Record<number, ItemState> {
  try {
    const raw = localStorage.getItem('sm_states')
    if (raw) return JSON.parse(raw)
  } catch {}
  const initial: Record<number, ItemState> = {}
  DATA.forEach(item => {
    initial[item.i] = { status: item.s, title: '', link: '', caption: '', notes: '' }
  })
  return initial
}

function loadCustomItems(): ContentItem[] {
  try {
    const raw = localStorage.getItem('sm_custom')
    if (!raw) return []
    return JSON.parse(raw).map(deserializeItem)
  } catch { return [] }
}

function loadDeletedIds(): number[] {
  try {
    const raw = localStorage.getItem('sm_deleted')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function loadEditedItems(): Record<number, { dt?: string; tp?: ContentType; n?: string }> {
  try {
    const raw = localStorage.getItem('sm_edits')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function loadRoteiros(): Record<string, Roteiro[]> {
  try {
    const raw = localStorage.getItem('sm_roteiros')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function loadClientFolders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sm_client_folders')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function loadExtraClients(): import('./types').Client[] {
  try {
    const raw = localStorage.getItem('sm_extra_clients')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function loadHiddenClients(): string[] {
  try {
    const raw = localStorage.getItem('sm_hidden_clients')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

// ── Utilitário: dias úteis do mês (seg–sáb) ──────────

export function getWorkdays(year: number, month: number): Date[] {
  const days: Date[] = []
  const count = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= count; d++) {
    const date = new Date(year, month, d)
    if (date.getDay() !== 0) days.push(date)
  }
  return days
}

// ── Distribuição pura (sem acesso a state) ────────────

function buildDistribution(
  clientName: string,
  roteiroList: Roteiro[],
  existingCustomItems: ContentItem[],
  year: number,
  month: number,
): { newItems: ContentItem[]; newStates: Record<number, ItemState> } {
  if (!roteiroList.length) return { newItems: [], newStates: {} }

  const workdays = getWorkdays(year, month)
  const step = workdays.length / roteiroList.length
  const base = Date.now()

  const newItems: ContentItem[] = roteiroList.map((r, idx) => ({
    i: base + idx * 10_000,
    c: clientName,
    dt: new Date(workdays[Math.min(Math.floor(idx * step), workdays.length - 1)]),
    tp: r.type,
    n: r.title,
    s: 0,
    custom: true,
  }))

  const newStates: Record<number, ItemState> = {}
  newItems.forEach((item, idx) => {
    newStates[item.i] = {
      status: 0,
      title: item.n,
      link: roteiroList[idx].driveLink ?? '',
      caption: '',
      notes: roteiroList[idx].notes ?? '',
    }
  })

  return { newItems, newStates }
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
  const [now, setNow] = useState(new Date())

  const allClients = useMemo(() => [...CLIENTS, ...extraClients].filter(c => !hiddenClients.includes(c.name)), [extraClients, hiddenClients])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
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

  // ── Mutações de estado de item ────────────────────────

  const updateItem = useCallback((id: number, patch: Partial<ItemState>) => {
    setStates(prev => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } }
      localStorage.setItem('sm_states', JSON.stringify(next))
      fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...next[id] }),
      }).catch(() => {})
      return next
    })
  }, [])

  const setStatus = useCallback((id: number, status: Status) => {
    updateItem(id, { status })
  }, [updateItem])

  const deleteItem = useCallback((id: number) => {
    setDeletedIds(prev => {
      const next = [...prev, id]
      localStorage.setItem('sm_deleted', JSON.stringify(next))
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
        localStorage.setItem('sm_custom', JSON.stringify(next.map(serializeItem)))
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
        return next
      })
    }
  }, [customItems])

  // ── Pasta Drive do cliente ────────────────────────────

  const setClientFolder = useCallback((clientName: string, url: string) => {
    setClientFolders(prev => {
      const next = { ...prev, [clientName]: url }
      localStorage.setItem('sm_client_folders', JSON.stringify(next))
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
      localStorage.setItem('sm_custom', JSON.stringify(next.map(serializeItem)))
      return next
    })

    setStates(prev => {
      const next = { ...prev, ...newStates }
      localStorage.setItem('sm_states', JSON.stringify(next))
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
    const newRoteiro: Roteiro = { ...r, id: crypto.randomUUID(), clientName, distributed: true }
    const fullList = [...(roteiros[clientName] ?? []), newRoteiro]

    setRoteiros(prev => {
      const next = { ...prev, [clientName]: [...(prev[clientName] ?? []), newRoteiro] }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
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
      ...r, id: crypto.randomUUID(), clientName, distributed: true,
    }))
    const fullList = [...(roteiros[clientName] ?? []), ...newRoteiros]

    setRoteiros(prev => {
      const next = { ...prev, [clientName]: [...(prev[clientName] ?? []), ...newRoteiros] }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      return next
    })

    applyDistribution(clientName, fullList, year, month)
  }, [roteiros, applyDistribution])

  // Remover roteiro → redistribuir
  const removeRoteiroAndRedistribute = useCallback((clientName: string, roteiroId: string) => {
    const year = now.getFullYear()
    const month = now.getMonth()

    setRoteiros(prev => {
      const newList = (prev[clientName] ?? []).filter(r => r.id !== roteiroId)
      const next = { ...prev, [clientName]: newList }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))

      // Redistribui com a lista nova
      const { newItems, newStates } = buildDistribution(clientName, newList, customItems, year, month)

      setCustomItems(c => {
        const filtered = c.filter(
          i => !(i.c === clientName && i.custom && i.dt.getFullYear() === year && i.dt.getMonth() === month)
        )
        const updated = [...filtered, ...newItems]
        localStorage.setItem('sm_custom', JSON.stringify(updated.map(serializeItem)))
        return updated
      })

      setStates(s => {
        const updated = { ...s, ...newStates }
        localStorage.setItem('sm_states', JSON.stringify(updated))
        return updated
      })

      return next
    })
  }, [roteiros, customItems, now])

  // Redistribuir manualmente (reagendar tudo)
  const redistributeClient = useCallback((clientName: string, year: number, month: number) => {
    const list = roteiros[clientName] ?? []
    applyDistribution(clientName, list, year, month)
    setRoteiros(prev => {
      const next = { ...prev, [clientName]: (prev[clientName] ?? []).map(r => ({ ...r, distributed: true })) }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      return next
    })
  }, [roteiros, applyDistribution])

  const clearDistribution = useCallback((clientName: string, year: number, month: number) => {
    setCustomItems(prev => {
      const next = prev.filter(
        i => !(i.c === clientName && i.custom && i.dt.getFullYear() === year && i.dt.getMonth() === month)
      )
      localStorage.setItem('sm_custom', JSON.stringify(next.map(serializeItem)))
      return next
    })
    setRoteiros(prev => {
      const next = { ...prev, [clientName]: (prev[clientName] ?? []).map(r => ({ ...r, distributed: false })) }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      return next
    })
  }, [])

  // IA: criar roteiros genéricos e distribuir em massa
  const createAndDistributeMany = useCallback((clientName: string, posts: number, reels: number, year?: number, month?: number) => {
    const y = year ?? now.getFullYear()
    const m = month ?? now.getMonth()
    const folderLink = clientFolders[clientName]

    const newRoteiros: Roteiro[] = [
      ...Array.from({ length: posts }, (_, i) => ({
        id: crypto.randomUUID(), clientName,
        title: `Post ${i + 1}`, type: 'Post' as ContentType,
        driveLink: folderLink, distributed: true,
      })),
      ...Array.from({ length: reels }, (_, i) => ({
        id: crypto.randomUUID(), clientName,
        title: `Reel ${i + 1}`, type: 'Reel' as ContentType,
        driveLink: folderLink, distributed: true,
      })),
    ]

    setRoteiros(prev => {
      const next = { ...prev, [clientName]: newRoteiros }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      return next
    })

    applyDistribution(clientName, newRoteiros, y, m)
  }, [now, clientFolders, applyDistribution])

  // ── Adicionar novo cliente ────────────────────────────

  const addClient = useCallback((client: import('./types').Client) => {
    setExtraClients(prev => {
      const next = [...prev, client]
      localStorage.setItem('sm_extra_clients', JSON.stringify(next))
      return next
    })
  }, [])

  // ── Excluir cliente ───────────────────────────────────

  const deleteClient = useCallback((name: string) => {
    setExtraClients(prev => {
      const next = prev.filter(c => c.name !== name)
      localStorage.setItem('sm_extra_clients', JSON.stringify(next))
      return next
    })
    setHiddenClients(prev => {
      const next = [...prev, name]
      localStorage.setItem('sm_hidden_clients', JSON.stringify(next))
      return next
    })
  }, [])

  // ── Distribuir todos os clientes de uma vez ───────────

  const distributeAll = useCallback((year: number, month: number) => {
    allClients.forEach(client => {
      createAndDistributeMany(client.name, client.postsPerMonth, client.reelsPerMonth, year, month)
    })
  }, [allClients, createAndDistributeMany])

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

  const sharedProps = {
    items: allItems, states,
    onStatusChange: setStatus,
    onUpdate: updateItem,
    onDelete: deleteItem,
    onEdit: editItem,
  }

  const tabs = [
    <TodayTab    key="today"    {...sharedProps} now={now} />,
    <AgendaTab   key="agenda"   {...sharedProps} now={now} />,
    <KanbanTab   key="kanban"   items={allItems} states={states} onStatusChange={setStatus} onDelete={deleteItem} onEdit={editItem} />,
    <CalendarTab key="calendar" items={allItems} states={states} now={now} onStatusChange={setStatus} onUpdate={updateItem} onDelete={deleteItem} onEdit={editItem} onReschedule={rescheduleItem} />,
    <ClientsTab  key="clients"  items={allItems} states={states} roteiros={roteiros} clientFolders={clientFolders} allClients={allClients} onAddRoteiro={addRoteiroAndDistribute} onAddManyRoteiros={addManyRoteirosAndDistribute} onBulkCreate={createAndDistributeMany} onDistributeAll={distributeAll} onAddClient={addClient} onDeleteClient={deleteClient} onRemoveRoteiro={removeRoteiroAndRedistribute} onRedistribute={redistributeClient} onClearDistribution={clearDistribution} onSetClientFolder={setClientFolder} />,
  ]

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', bgcolor: 'background.default', position: 'relative', overflow: 'hidden' }}>

        {/* ── Blobs de fundo (glassmorphism base) ──────── */}
        <Box sx={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <Box sx={{
            position: 'absolute', width: 400, height: 400, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,144,57,0.08) 0%, transparent 70%)',
            top: -120, right: -80,
            '@keyframes blobFloat': {
              '0%,100%': { transform: 'translate(0,0) scale(1)' },
              '50%': { transform: 'translate(-20px,30px) scale(1.08)' },
            },
            animation: 'blobFloat 12s ease-in-out infinite',
          }} />
          <Box sx={{
            position: 'absolute', width: 300, height: 300, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,83,57,0.05) 0%, transparent 70%)',
            bottom: 80, left: -60,
            animation: 'blobFloat 16s ease-in-out infinite reverse',
          }} />
          <Box sx={{
            position: 'absolute', width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,142,255,0.04) 0%, transparent 70%)',
            bottom: '40%', right: '20%',
            animation: 'blobFloat 20s ease-in-out infinite 4s',
          }} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', zIndex: 1 }}>

        {/* ── Header ───────────────────────────────────── */}
        <Paper elevation={0} square sx={{ px: 2, pt: 1.2, pb: 1, borderBottom: '1px solid rgba(255,144,57,0.12)', background: 'linear-gradient(135deg, #161616 0%, #1c1408 60%, #161616 100%)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
            <Logo size="sm" />
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', display: 'block' }}>{getGreeting()}</Typography>
              <Typography sx={{ color: 'primary.main', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.8 }}>
            {headerStats.late > 0 && (
              <Chip icon={<WarningAmberIcon />} label={`${headerStats.late} atrasado${headerStats.late > 1 ? 's' : ''}`} size="small" color="error" variant="outlined" sx={{ fontSize: '0.6rem', height: 20, '& .MuiChip-icon': { fontSize: 11 } }} />
            )}
            <Chip icon={<CheckCircleIcon />} label={`Hoje: ${headerStats.todayDone}/${headerStats.todayTotal}`} size="small" color={headerStats.todayDone === headerStats.todayTotal && headerStats.todayTotal > 0 ? 'success' : 'default'} variant="outlined" sx={{ fontSize: '0.6rem', height: 20, '& .MuiChip-icon': { fontSize: 11 } }} />
            <Chip label={now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 20, ml: 'auto', borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary' }} />
          </Box>
        </Paper>

        {/* ── Conteúdo da aba ──────────────────────────── */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {tabs[tab]}
        </Box>

        {/* ── Navegação inferior ───────────────────────── */}
        <Paper elevation={8} square sx={{
          borderTop: '1px solid rgba(255,144,57,0.15)',
          background: 'linear-gradient(180deg, #111 0%, #0d0d0d 100%)',
        }}>
          <BottomNavigation
            showLabels
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              bgcolor: 'transparent',
              height: 62,
              '@keyframes neonSmoke': {
                '0%':   { filter: 'drop-shadow(0 0 2px #ff903988) drop-shadow(0 0 6px #ff903955)' },
                '40%':  { filter: 'drop-shadow(0 0 10px #ff9039cc) drop-shadow(0 0 22px #ff5339aa) drop-shadow(0 0 40px #ff903966)' },
                '100%': { filter: 'drop-shadow(0 0 4px #ff903966) drop-shadow(0 0 10px #ff903933)' },
              },
            }}
          >
            {[
              { label: 'Hoje',       icon: <HomeIcon /> },
              { label: 'Agenda',     icon: <ViewAgendaIcon /> },
              { label: 'Kanban',     icon: <ViewKanbanIcon /> },
              { label: 'Calendário', icon: <CalendarMonthIcon /> },
              { label: 'Clientes',   icon: <PeopleIcon /> },
            ].map(({ label, icon }, idx) => {
              const selected = tab === idx
              return (
                <BottomNavigationAction
                  key={label}
                  label={label}
                  icon={icon}
                  sx={{
                    minWidth: 0,
                    px: 0.5,
                    color: selected ? 'primary.main' : 'rgba(255,255,255,0.35)',
                    transition: 'color 0.2s',
                    '& .MuiBottomNavigationAction-label': {
                      fontSize: '0.58rem',
                      fontWeight: selected ? 800 : 500,
                      letterSpacing: selected ? '0.06em' : '0.02em',
                      textTransform: 'uppercase',
                      opacity: '1 !important',
                      mt: 0.3,
                      ...(selected && {
                        textShadow: '0 0 8px rgba(255,144,57,0.9), 0 0 16px rgba(255,83,57,0.5)',
                        color: '#ff9039',
                      }),
                    },
                    '& .MuiSvgIcon-root': {
                      fontSize: selected ? '1.4rem' : '1.25rem',
                      transition: 'all 0.2s',
                      ...(selected && {
                        animation: 'neonSmoke 0.6s ease-out forwards',
                        color: '#ff9039',
                      }),
                    },
                    '&.Mui-selected': { color: 'primary.main' },
                  }}
                />
              )
            })}
          </BottomNavigation>
        </Paper>

        {/* ── Agente IA ────────────────────────────────── */}
        <AIAgent
          context={aiContext}
          roteiros={roteiros}
          onDistribute={clientName => redistributeClient(clientName, now.getFullYear(), now.getMonth())}
          onClearDistribution={clientName => clearDistribution(clientName, now.getFullYear(), now.getMonth())}
          onCreateAndDistribute={createAndDistributeMany}
        />
        </Box>
      </Box>
    </ThemeProvider>
  )
}
