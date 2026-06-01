import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Dialog, Box, Typography, InputBase, Divider, Tooltip,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import HomeIcon from '@mui/icons-material/Home'
import PeopleIcon from '@mui/icons-material/People'
import ViewKanbanIcon from '@mui/icons-material/ViewKanban'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import GroupIcon from '@mui/icons-material/Group'
import PsychologyIcon from '@mui/icons-material/Psychology'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import BrushIcon from '@mui/icons-material/Brush'
import CampaignIcon from '@mui/icons-material/Campaign'
import VideocamIcon from '@mui/icons-material/Videocam'
import MovieFilterIcon from '@mui/icons-material/MovieFilter'
import QueryStatsIcon from '@mui/icons-material/QueryStats'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import AssessmentIcon from '@mui/icons-material/Assessment'
import PersonIcon from '@mui/icons-material/Person'
import TravelExploreIcon from '@mui/icons-material/TravelExplore'
import type { ContentItem, Client, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'
import { NAME_MAP } from '../lib/users'

interface Props {
  open: boolean
  onClose: () => void
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  currentUser?: string
  onTabChange: (tab: number) => void
  onStatusChange: (id: number, status: Status) => void
  onOpenReport?: () => void
  onOpenAI?: () => void
  onOpenReportClient?: (clientName: string) => void
}

interface CommandResult {
  id: string
  category: string
  icon: React.ReactNode
  label: string
  sublabel?: string
  shortcut?: string
  action: () => void
}

const NAV_COMMANDS = [
  { label: 'Meu Dia',     tab: 0,  icon: <PersonIcon sx={{ fontSize: 15 }} />,          shortcut: '1' },
  { label: 'Hoje',        tab: 1,  icon: <HomeIcon sx={{ fontSize: 15 }} />,             shortcut: '2' },
  { label: 'Agenda',      tab: 2,  icon: <CalendarMonthIcon sx={{ fontSize: 15 }} />,    shortcut: '3' },
  { label: 'Produções',   tab: 4,  icon: <AccountTreeIcon sx={{ fontSize: 15 }} />,      shortcut: '5' },
  { label: 'Calendário',  tab: 5,  icon: <CalendarMonthIcon sx={{ fontSize: 15 }} />,    shortcut: '' },
  { label: 'Clientes',    tab: 6,  icon: <PeopleIcon sx={{ fontSize: 15 }} />,           shortcut: '7' },
  { label: 'Dashboard',   tab: 7,  icon: <QueryStatsIcon sx={{ fontSize: 15 }} />,       shortcut: '' },
  { label: 'Kanban',      tab: 3,  icon: <ViewKanbanIcon sx={{ fontSize: 15 }} />,       shortcut: '4' },
  { label: 'Gravações',   tab: 9,  icon: <VideocamIcon sx={{ fontSize: 15 }} />,         shortcut: '' },
  { label: 'Editor',      tab: 10, icon: <MovieFilterIcon sx={{ fontSize: 15 }} />,      shortcut: '' },
  { label: 'Financeiro',  tab: 11, icon: <AttachMoneyIcon sx={{ fontSize: 15 }} />,      shortcut: '' },
  { label: 'Equipe',      tab: 12, icon: <GroupIcon sx={{ fontSize: 15 }} />,            shortcut: '' },
  { label: 'IA',          tab: 13, icon: <PsychologyIcon sx={{ fontSize: 15 }} />,       shortcut: '' },
  { label: 'Roteiros',    tab: 14, icon: <AutoStoriesIcon sx={{ fontSize: 15 }} />,      shortcut: '' },
  { label: 'Tráfego',     tab: 15, icon: <CampaignIcon sx={{ fontSize: 15 }} />,         shortcut: '' },
  { label: 'Design',      tab: 16, icon: <BrushIcon sx={{ fontSize: 15 }} />,            shortcut: '' },
  { label: 'Prospecção',  tab: 17, icon: <TravelExploreIcon sx={{ fontSize: 15 }} />,    shortcut: '' },
  { label: 'Performance', tab: 19, icon: <QueryStatsIcon sx={{ fontSize: 15 }} />,       shortcut: '' },
]

export default function CommandBar({
  open, onClose, items, states, allClients, onTabChange,
  onStatusChange, onOpenReport, onOpenAI, onOpenReportClient,
}: Props) {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const lateItems = items.filter(item => {
    const st = states[item.i]?.status ?? item.s
    const itemDate = new Date(item.dt)
    itemDate.setHours(0, 0, 0, 0)
    return st < 7 && st !== 7 && itemDate < now
  })

  const QUICK_ACTIONS = [
    {
      id: 'action-report',
      label: 'Relatório mensal',
      sublabel: 'Gerar relatório e enviar por WhatsApp',
      icon: <QueryStatsIcon sx={{ fontSize: 15, color: '#00C47A' }} />,
      keywords: ['relatorio', 'relatório', 'mensal', 'whatsapp', 'enviar'],
      action: () => { onOpenReport?.() },
    },
    {
      id: 'action-ai',
      label: 'Scale AI',
      sublabel: 'Abrir assistente de IA',
      icon: <AutoAwesomeIcon sx={{ fontSize: 15, color: '#ff9039' }} />,
      keywords: ['ia', 'ai', 'assistente', 'scale', 'inteligencia'],
      action: () => { onOpenAI?.() },
    },
    {
      id: 'action-today',
      label: 'Ver conteúdos de hoje',
      sublabel: 'Navegar para a aba Hoje',
      icon: <HomeIcon sx={{ fontSize: 15, color: '#3B8EFF' }} />,
      keywords: ['hoje', 'publicar', 'agenda do dia'],
      action: () => onTabChange(1),
    },
  ]

  const getResults = useCallback((): CommandResult[] => {
    const q = query.toLowerCase().trim()
    const results: CommandResult[] = []

    // 1. Ações rápidas
    const matchedActions = QUICK_ACTIONS.filter(a =>
      !q || a.keywords.some(k => k.includes(q)) || a.label.toLowerCase().includes(q)
    )
    matchedActions.forEach(a => {
      results.push({ id: a.id, category: '⚡ Ações rápidas', icon: a.icon, label: a.label, sublabel: a.sublabel, action: a.action })
    })

    // 2. Navegação por abas
    const matchedNav = NAV_COMMANDS.filter(cmd =>
      !q || cmd.label.toLowerCase().includes(q) || 'navegar'.includes(q)
    )
    matchedNav.forEach(cmd => {
      results.push({
        id: `nav-${cmd.tab}`,
        category: '🧭 Navegação',
        icon: cmd.icon,
        label: cmd.label,
        shortcut: cmd.shortcut,
        action: () => onTabChange(cmd.tab),
      })
    })

    // 3. Itens atrasados — sempre visíveis ou quando query bate
    const showLate = !q || q.includes('atras') || q.includes('tarde') || q.includes('overdue')
    if (showLate && lateItems.length > 0) {
      lateItems.slice(0, 5).forEach(item => {
        const itemDate = new Date(item.dt)
        itemDate.setHours(0, 0, 0, 0)
        const daysLate = Math.round((now.getTime() - itemDate.getTime()) / 86_400_000)
        const title = states[item.i]?.title || item.n
        results.push({
          id: `late-${item.i}`,
          category: '⚠️ Itens Atrasados',
          icon: <WarningAmberIcon sx={{ fontSize: 15, color: '#FF4545' }} />,
          label: `${item.c} — ${title}`,
          sublabel: `${daysLate}d atraso · ${item.tp}`,
          action: () => onTabChange(3),
        })
      })
    }

    if (q.length >= 2) {
      // 4. Clientes + relatório por cliente
      const matchedClients = allClients.filter(c => c.name.toLowerCase().includes(q))
      matchedClients.forEach(client => {
        const clientItems = items.filter(it => it.c === client.name)
        const publishedCount = clientItems.filter(it => (states[it.i]?.status ?? it.s) === 7).length
        results.push({
          id: `client-${client.name}`,
          category: '👥 Clientes',
          icon: <PeopleIcon sx={{ fontSize: 15, color: '#ff9039' }} />,
          label: client.name,
          sublabel: `${clientItems.length} conteúdos · ${publishedCount} publicados`,
          action: () => onTabChange(6),
        })
        if (onOpenReportClient) {
          results.push({
            id: `report-${client.name}`,
            category: '📄 Relatórios',
            icon: <AssessmentIcon sx={{ fontSize: 15, color: '#00C47A' }} />,
            label: `Relatório — ${client.name}`,
            sublabel: 'Abrir relatório mensal com export PDF/PNG',
            action: () => { onOpenReportClient(client.name); onClose() },
          })
        }
      })

      // 5. Conteúdo — busca por título ou cliente
      const matchedItems = items.filter(item => {
        const title = (states[item.i]?.title || item.n).toLowerCase()
        return title.includes(q) || item.c.toLowerCase().includes(q)
      }).slice(0, 8)
      matchedItems.forEach(item => {
        const st = states[item.i]?.status ?? item.s
        const stConfig = STATUS_CONFIG[st as Status]
        const title = states[item.i]?.title || item.n
        const truncatedTitle = title.length > 45 ? title.slice(0, 45) + '…' : title
        results.push({
          id: `item-${item.i}`,
          category: '🎬 Conteúdo',
          icon: (
            <Box sx={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              bgcolor: stConfig.color, boxShadow: `0 0 5px ${stConfig.glow}`,
            }} />
          ),
          label: truncatedTitle,
          sublabel: `${item.c} · ${item.tp} · ${stConfig.label} · ${item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`,
          action: () => onTabChange(3),
        })
      })

      // 6. Equipe — busca por nome de membro
      const matchedTeam = Object.entries(NAME_MAP).filter(([name, info]) =>
        name.includes(q) || info.role.toLowerCase().includes(q)
      )
      matchedTeam.forEach(([name, info]) => {
        results.push({
          id: `team-${name}`,
          category: '👤 Equipe',
          icon: (
            <Typography sx={{ fontSize: '0.9rem', lineHeight: 1 }}>{info.emoji}</Typography>
          ),
          label: `${name.charAt(0).toUpperCase()}${name.slice(1)}`,
          sublabel: info.role,
          action: () => onTabChange(12),
        })
      })
    }

    return results
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, items, states, allClients, lateItems, now, onTabChange, onOpenReport, onOpenAI])

  const results = getResults()

  useEffect(() => { setSelectedIdx(0) }, [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(v => Math.min(v + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(v => Math.max(v - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIdx]) {
        results[selectedIdx].action()
        onClose()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-idx="${selectedIdx}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  const grouped: { category: string; items: (CommandResult & { absIdx: number })[] }[] = []
  let absIdx = 0
  results.forEach(r => {
    let group = grouped.find(g => g.category === r.category)
    if (!group) {
      group = { category: r.category, items: [] }
      grouped.push(group)
    }
    group.items.push({ ...r, absIdx: absIdx++ })
  })

  void onStatusChange

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={false}
      PaperProps={{
        sx: {
          width: { xs: '92vw', sm: 620 },
          maxWidth: 620,
          maxHeight: 480,
          overflow: 'hidden',
          borderRadius: '16px',
          background: 'rgba(11,11,11,0.97)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(40px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,144,57,0.08)',
          mt: { xs: 4, md: 8 },
          alignSelf: 'flex-start',
          mx: 'auto',
        },
      }}
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(8px)',
            bgcolor: 'rgba(0,0,0,0.7)',
          },
        },
      }}
    >
      {/* Search input */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2.5, py: 2,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <SearchIcon sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 20, flexShrink: 0 }} />
        <InputBase
          inputRef={inputRef}
          fullWidth
          placeholder="Buscar cliente, conteúdo, aba... (⌘K)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{
            fontSize: '1rem',
            color: '#fff',
            fontWeight: 500,
            '& input': { p: 0 },
            '& input::placeholder': { color: 'rgba(255,255,255,0.22)', opacity: 1 },
          }}
        />
        {query ? (
          <Tooltip title="Limpar">
            <Box
              onClick={() => setQuery('')}
              sx={{
                fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1, px: 0.7, py: 0.25,
                fontFamily: 'monospace', flexShrink: 0,
                '&:hover': { color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.25)' },
                transition: 'all 0.15s ease',
              }}
            >
              Esc
            </Box>
          </Tooltip>
        ) : (
          <Box sx={{
            fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, px: 0.7, py: 0.25,
            fontFamily: 'monospace', flexShrink: 0,
          }}>
            ESC
          </Box>
        )}
      </Box>

      {/* Results list */}
      {results.length > 0 && (
        <Box
          ref={listRef}
          sx={{
            maxHeight: 380, overflowY: 'auto',
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': {
              background: 'linear-gradient(180deg, rgba(255,144,57,0.6), rgba(255,83,57,0.6))',
              borderRadius: 4,
            },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,144,57,0.5) transparent',
          }}
        >
          {grouped.map((group, gi) => (
            <Box key={group.category}>
              {gi > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)', mx: 2 }} />}
              {/* Group label */}
              <Box sx={{ px: 2.5, pt: gi === 0 ? 1.2 : 1, pb: 0.5 }}>
                <Typography sx={{
                  fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)',
                }}>
                  {group.category}
                </Typography>
              </Box>

              {/* Items */}
              {group.items.map(item => {
                const isSelected = item.absIdx === selectedIdx
                return (
                  <Box
                    key={item.id}
                    data-idx={item.absIdx}
                    onClick={() => { item.action(); onClose() }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      px: 2.5, py: 1, cursor: 'pointer',
                      bgcolor: isSelected ? 'rgba(255,144,57,0.08)' : 'transparent',
                      borderLeft: '2px solid',
                      borderLeftColor: isSelected ? '#ff9039' : 'transparent',
                      transition: 'background 0.1s ease',
                      '&:hover': {
                        bgcolor: isSelected ? 'rgba(255,144,57,0.1)' : 'rgba(255,255,255,0.04)',
                      },
                    }}
                  >
                    {/* Icon container */}
                    <Box sx={{
                      width: 28, height: 28, borderRadius: '8px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: isSelected ? 'rgba(255,144,57,0.15)' : 'rgba(255,255,255,0.05)',
                      color: isSelected ? '#ff9039' : 'rgba(255,255,255,0.45)',
                      transition: 'all 0.12s ease',
                    }}>
                      {item.icon}
                    </Box>

                    {/* Text */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{
                        fontSize: '0.88rem', fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? '#fff' : 'rgba(255,255,255,0.75)',
                        lineHeight: 1.3,
                      }} noWrap>
                        {item.label}
                      </Typography>
                      {item.sublabel && (
                        <Typography sx={{
                          fontSize: '0.68rem', color: 'rgba(255,255,255,0.32)',
                          lineHeight: 1.3, mt: 0.1,
                        }} noWrap>
                          {item.sublabel}
                        </Typography>
                      )}
                    </Box>

                    {/* Shortcut badge or enter hint */}
                    {item.shortcut ? (
                      <Box sx={{
                        fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
                        px: 0.7, py: 0.2, fontFamily: 'monospace', flexShrink: 0,
                        ...(isSelected && { color: 'rgba(255,144,57,0.6)', borderColor: 'rgba(255,144,57,0.25)' }),
                      }}>
                        {item.shortcut}
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.15)', flexShrink: 0 }}>
                        ↵
                      </Typography>
                    )}
                  </Box>
                )
              })}
            </Box>
          ))}
        </Box>
      )}

      {/* Empty state */}
      {query.length >= 2 && results.length === 0 && (
        <Box sx={{ px: 3, py: 3.5, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.25)' }}>
            Nenhum resultado para "{query}"
          </Typography>
        </Box>
      )}

      {/* Footer hints */}
      <Box sx={{
        px: 2.5, py: 1.2,
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: 2,
      }}>
        {[
          { key: '↑↓', label: 'navegar' },
          { key: 'Enter', label: 'selecionar' },
          { key: 'Esc', label: 'fechar' },
        ].map(({ key, label }) => (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{
              fontSize: '0.55rem', color: 'rgba(255,255,255,0.28)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px',
              px: 0.7, py: 0.15, fontFamily: 'monospace',
            }}>
              {key}
            </Box>
            <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)' }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Dialog>
  )
}
