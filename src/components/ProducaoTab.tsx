import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragEndEvent, type DragStartEvent,
  closestCenter, pointerWithin,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  useSortable, SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import {
  Box, Typography, Paper, Chip, Tooltip, Badge, Menu,
  Button, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  ToggleButtonGroup, ToggleButton, IconButton, Drawer,
} from '@mui/material'
import ContentCard from './ContentCard'
import EditItemDialog from './EditItemDialog'
import PlanejamentoDialog from './PlanejamentoDialog'
import FilterListIcon from '@mui/icons-material/FilterList'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
import AddIcon from '@mui/icons-material/Add'
import SendIcon from '@mui/icons-material/Send'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import SortIcon from '@mui/icons-material/Sort'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import SearchIcon from '@mui/icons-material/Search'
import ViewListIcon from '@mui/icons-material/ViewList'
import GridViewIcon from '@mui/icons-material/GridView'
import type { Client, ContentItem, ContentType, ItemEditPatch, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'
import { loadUploadTasks, type UploadTask } from './EditorMode'
import { syncToCloud } from '../lib/storage'
import { NAME_MAP } from '../lib/users'
import DriveVideoInbox from './DriveVideoInbox'

// ── Column definitions ────────────────────────────────────

interface ColDef { status: Status; label: string; color: string }

const VIDEO_COLS: ColDef[] = [
  { status: 0, label: 'A fazer',        color: '#71717A' },
  { status: 1, label: 'Em produção',    color: '#ff9039' },
  { status: 2, label: 'Aprov. interna', color: '#60A5FA' },
  { status: 6, label: 'Reprovado',      color: '#FF4545' },
]

const DESIGN_COLS: ColDef[] = [
  { status: 0, label: 'A fazer',        color: '#71717A' },
  { status: 1, label: 'Em produção',    color: '#ff9039' },
  { status: 2, label: 'Aprov. interna', color: '#60A5FA' },
  { status: 6, label: 'Reprovado',      color: '#FF4545' },
]

const FEED_COLS: ColDef[] = [
  { status: 0, label: 'A fazer',        color: '#71717A' },
  { status: 1, label: 'Em produção',    color: '#ff9039' },
  { status: 2, label: 'Aprov. interna', color: '#60A5FA' },
  { status: 6, label: 'Reprovado',      color: '#FF4545' },
]

const SOCIAL_COLS: ColDef[] = [
  { status: 2, label: 'Aprov. interna',  color: '#60A5FA' },
  { status: 3, label: 'Aprovado',        color: '#818CF8' },
  { status: 4, label: 'Enviado cliente', color: '#FF9A3D' },
  { status: 6, label: 'Reprovado',       color: '#FF4545' },
  { status: 5, label: 'Aprov. cliente',  color: '#34D399' },
  { status: 7, label: 'Publicado',       color: '#00C47A' },
]

// Reels destacam com DS orange; demais tipos são neutros
const TYPE_COLOR: Record<string, string> = {
  Post: '#888', Reel: '#ff9039', Story: '#888', Carrossel: '#888', Feed: '#888',
}

const TYPE_EMOJI: Record<string, string> = {
  Post: '🖼️', Reel: '🎬', Story: '⭐', Carrossel: '🗂️', Feed: '📸',
}

const ALL_TYPES: ContentType[] = ['Post', 'Reel', 'Story', 'Carrossel', 'Feed']

// ── RoteirosBoard ─────────────────────────────────────────

const MONTH_NAMES_ROT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ROT_COLOR = '#FB7185'

// ── Pipeline de status do roteiro (kanban) ──────────────────
type RoteiroStatus_ = import('../types').RoteiroStatus
const ROTEIRO_STATUS_FLOW: RoteiroStatus_[] = ['ideia', 'escrevendo', 'revisao', 'pronto']
const ROTEIRO_STATUS_CFG: Record<RoteiroStatus_, { label: string; color: string; icon: string }> = {
  ideia:      { label: 'Ideia',     color: '#A1A1AA', icon: '💡' },
  escrevendo: { label: 'Escrevendo', color: '#3B8EFF', icon: '✏️' },
  revisao:    { label: 'Revisão',    color: '#FFD700', icon: '👀' },
  pronto:     { label: 'Pronto',     color: '#00C47A', icon: '✅' },
}

type ContentType_ = import('../types').ContentType

function parseDocRoteiros(text: string): Array<{ title: string; type: ContentType_ }> {
  const prefixes: Array<[string, ContentType_]> = [
    ['POST', 'Post'], ['VIDEO', 'Reel'], ['REEL', 'Reel'],
    ['STORY', 'Story'], ['CARROSSEL', 'Carrossel'], ['CARROSEL', 'Carrossel'], ['FEED', 'Feed'],
  ]
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length >= 3 && l.length <= 150 && !/^\d+$/.test(l))
    .map(l => {
      const up = l.toUpperCase()
      for (const [pfx, tp] of prefixes) {
        if (up.startsWith(pfx + ' - ') || up.startsWith(pfx + '- ') || up.startsWith(pfx + ' – ') || up.startsWith(pfx + ': ')) {
          const title = l.replace(new RegExp(`^${pfx}\\s*[-–:]\\s*`, 'i'), '').trim()
          if (title.length >= 2) return { title, type: tp }
        }
      }
      // linha sem prefixo reconhecido — só importa se parece um título curto
      if (l.length <= 80 && !l.includes('.') && l.split(' ').length <= 10) {
        return { title: l, type: 'Reel' as ContentType_ }
      }
      return null
    })
    .filter((x): x is { title: string; type: ContentType_ } => x !== null)
    .slice(0, 40)
}

interface ImportItem { title: string; type: ContentType_; selected: boolean }

interface CardEdit { title: string; type: ContentType_; driveLink: string; docsLink: string; refLink: string; deadline: string }

function getRoteiroDeadlineLevel(ts: number): 'overdue' | 'today' | 'soon' | 'ok' {
  const diff = Math.round((new Date(ts).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 3) return 'soon'
  return 'ok'
}

const ROT_DEADLINE_COLOR: Record<'overdue' | 'today' | 'soon' | 'ok', string> = {
  overdue: '#FF3B30', today: '#FFD700', soon: '#FF7832', ok: '#00C47A',
}

function getDeadlineLabel(ts: number) {
  const diff = Math.round((new Date(ts).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
  if (diff < 0) return `${Math.abs(diff)}d atraso`
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

interface NewFormState { title: string; type: ContentType_; docsLink: string; deadline: string; open: boolean }

// ── Kanban: cartão de roteiro arrastável ───────────────────
function RoteiroKanbanCard({ roteiro, onOpen }: {
  roteiro: import('../types').Roteiro
  onOpen: (r: import('../types').Roteiro) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: roteiro.id })
  const st = roteiro.status ?? 'ideia'
  const cfg = ROTEIRO_STATUS_CFG[st]
  const typeEmoji: Record<string, string> = { Reel: '🎬', Story: '⭐', Post: '🖼️', Carrossel: '🗂️', Feed: '📸' }
  const dlevel = roteiro.deadline ? getRoteiroDeadlineLevel(roteiro.deadline) : null
  const dcolor = dlevel ? ROT_DEADLINE_COLOR[dlevel] : null
  return (
    <Box
      ref={setNodeRef} {...listeners} {...attributes}
      onClick={() => onOpen(roteiro)}
      style={{
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 999 : undefined,
        opacity: isDragging ? 0.4 : 1,
        willChange: isDragging ? 'transform' : undefined,
      }}
      sx={{
        position: 'relative', p: 1, pl: 1.2, borderRadius: '10px',
        cursor: 'grab', userSelect: 'none', overflow: 'hidden',
        border: `1px solid ${cfg.color}26`,
        bgcolor: 'rgba(255,255,255,0.03)',
        transition: 'border 0.15s ease, background 0.15s ease',
        '&:hover': { border: `1px solid ${cfg.color}55`, bgcolor: 'rgba(255,255,255,0.055)' },
        '&::before': {
          content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          bgcolor: cfg.color, borderRadius: '2px 0 0 2px',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.4 }}>
        <Typography sx={{ fontSize: '0.62rem', lineHeight: 1, flexShrink: 0 }}>{typeEmoji[roteiro.type] ?? '📄'}</Typography>
        <Typography noWrap sx={{ fontSize: '0.56rem', fontWeight: 600, color: 'rgba(255,255,255,0.42)', flex: 1, lineHeight: 1 }}>
          {roteiro.clientName}
        </Typography>
      </Box>
      <Typography sx={{
        fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', lineHeight: 1.25, mb: 0.4,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {roteiro.title || '(sem título)'}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, flexWrap: 'wrap' }}>
        {roteiro.docsLink && (
          <Box component="a" href={roteiro.docsLink} target="_blank" rel="noopener noreferrer"
            onPointerDown={(e: React.PointerEvent) => e.stopPropagation()} onClick={(e: React.MouseEvent) => e.stopPropagation()}
            sx={{ px: 0.5, py: 0.1, borderRadius: '4px', fontSize: '0.5rem', textDecoration: 'none', cursor: 'pointer', bgcolor: `${ROT_COLOR}14`, color: ROT_COLOR, border: `1px solid ${ROT_COLOR}28`, '&:hover': { bgcolor: `${ROT_COLOR}28` } }}>📄 Doc</Box>
        )}
        {roteiro.refLink && (
          <Box component="a" href={roteiro.refLink} target="_blank" rel="noopener noreferrer"
            onPointerDown={(e: React.PointerEvent) => e.stopPropagation()} onClick={(e: React.MouseEvent) => e.stopPropagation()}
            sx={{ px: 0.5, py: 0.1, borderRadius: '4px', fontSize: '0.5rem', textDecoration: 'none', cursor: 'pointer', bgcolor: 'rgba(59,142,255,0.14)', color: '#3B8EFF', border: '1px solid rgba(59,142,255,0.28)', '&:hover': { bgcolor: 'rgba(59,142,255,0.28)' } }}>🔗 Ref</Box>
        )}
        {roteiro.driveLink && (
          <Box component="a" href={roteiro.driveLink} target="_blank" rel="noopener noreferrer"
            onPointerDown={(e: React.PointerEvent) => e.stopPropagation()} onClick={(e: React.MouseEvent) => e.stopPropagation()}
            sx={{ px: 0.5, py: 0.1, borderRadius: '4px', fontSize: '0.5rem', textDecoration: 'none', cursor: 'pointer', bgcolor: 'rgba(0,196,122,0.14)', color: '#00C47A', border: '1px solid rgba(0,196,122,0.28)', '&:hover': { bgcolor: 'rgba(0,196,122,0.28)' } }}>☁️ Drive</Box>
        )}
        {dcolor && roteiro.deadline && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, px: 0.5, py: 0.1, borderRadius: '4px', bgcolor: `${dcolor}12`, border: `1px solid ${dcolor}28` }}>
            <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: dcolor }} />
            <Typography sx={{ fontSize: '0.5rem', color: dcolor, fontWeight: 700, lineHeight: 1 }}>{getDeadlineLabel(roteiro.deadline)}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ── Kanban: coluna droppable de status ─────────────────────
function RoteiroStatusColumn({ colId, color, children }: { colId: string; color: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: colId })
  return (
    <Box ref={setNodeRef} sx={{
      display: 'flex', flexDirection: 'column', gap: 0.7, p: 0.7, minHeight: 100,
      borderRadius: '10px',
      border: `1px dashed ${isOver ? color + '88' : 'transparent'}`,
      bgcolor: isOver ? `${color}10` : 'transparent',
      transition: 'border 0.12s ease, background 0.12s ease',
    }}>
      {children}
    </Box>
  )
}

function RoteirosBoard({ roteiros, clientFolders, filterClient, viewMonth, viewYear, onMonthChange, onUpdateRoteiro, onImportBatch, onDeleteMany, onAddRoteiro, allClients, currentUser }: {
  roteiros: Record<string, import('../types').Roteiro[]>
  clientFolders: Record<string, string>
  filterClient: string
  viewMonth: number
  viewYear: number
  onMonthChange: (m: number, y: number) => void
  onUpdateRoteiro?: (clientName: string, roteiroId: string, patch: Partial<Pick<import('../types').Roteiro, 'title' | 'type' | 'driveLink' | 'docsLink' | 'refLink' | 'deadline' | 'status'>>) => void
  onImportBatch?: (clientName: string, items: Array<{ title: string; type: ContentType_; docsLink: string }>, year: number, month: number) => void
  onDeleteMany?: (ids: string[]) => void
  onAddRoteiro?: (clientName: string, r: Omit<import('../types').Roteiro, 'id' | 'clientName' | 'distributed'>, year: number, month: number) => void
  allClients?: import('../types').Client[]
  currentUser?: string
}) {
  const [expandedEdit, setExpandedEdit] = useState<Record<string, CardEdit>>({})
  const [importInput, setImportInput] = useState<Record<string, string>>({})
  const [importLoading, setImportLoading] = useState<string | null>(null)
  const [importModal, setImportModal] = useState<{ open: boolean; clientName: string; items: ImportItem[]; docsLink: string } | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [viewMode] = useState<'list' | 'grid' | 'timeline' | 'kanban'>('kanban')
  const [kanbanEditId, setKanbanEditId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [clearConfirm, setClearConfirm] = useState<'month' | 'all' | null>(null)
  // Nomes customizados das colunas do kanban (renomeáveis), persistidos
  const [colLabels, setColLabels] = useState<Partial<Record<RoteiroStatus_, string>>>(() => {
    try { return JSON.parse(localStorage.getItem('sm_roteiro_col_labels') ?? '{}') } catch { return {} }
  })
  const [editingCol, setEditingCol] = useState<RoteiroStatus_ | null>(null)
  const colLabel = (st: RoteiroStatus_) => colLabels[st]?.trim() || ROTEIRO_STATUS_CFG[st].label
  const saveColLabel = (st: RoteiroStatus_, val: string) => {
    setColLabels(prev => {
      const next = { ...prev }
      const t = val.trim()
      if (!t || t === ROTEIRO_STATUS_CFG[st].label) delete next[st]
      else next[st] = t
      localStorage.setItem('sm_roteiro_col_labels', JSON.stringify(next))
      syncToCloud('sm_roteiro_col_labels', next)
      return next
    })
    setEditingCol(null)
  }
  const [newForms, setNewForms] = useState<Record<string, NewFormState>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<'alpha-asc' | 'alpha-desc' | 'most' | 'overdue'>('alpha-asc')
  const [quickFilter, setQuickFilter] = useState<'all' | 'with' | 'without' | 'overdue' | 'mine'>('all')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())

  const ALL_TYPES: ContentType_[] = ['Post', 'Reel', 'Story', 'Carrossel', 'Feed']

  function openEdit(r: import('../types').Roteiro) {
    const dl = r.deadline ? new Date(r.deadline).toISOString().slice(0, 10) : ''
    setExpandedEdit(p => ({ ...p, [r.id]: { title: r.title, type: r.type, driveLink: r.driveLink ?? '', docsLink: r.docsLink ?? '', refLink: r.refLink ?? '', deadline: dl } }))
  }
  function closeEdit(id: string) {
    setExpandedEdit(p => { const n = { ...p }; delete n[id]; return n })
  }
  function saveEdit(clientName: string, id: string) {
    const e = expandedEdit[id]
    if (e && onUpdateRoteiro) {
      const deadlineTs = e.deadline ? new Date(e.deadline + 'T12:00:00').getTime() : undefined
      onUpdateRoteiro(clientName, id, {
        title: e.title.trim() || undefined,
        type: e.type,
        driveLink: e.driveLink.trim() || undefined,
        docsLink: e.docsLink.trim() || undefined,
        refLink: e.refLink.trim() || undefined,
        deadline: deadlineTs,
      })
    }
    closeEdit(id)
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll(ids: string[]) {
    setSelected(prev => {
      const allSelected = ids.every(id => prev.has(id))
      const n = new Set(prev)
      ids.forEach(id => allSelected ? n.delete(id) : n.add(id))
      return n
    })
  }
  function exitSelectMode() { setSelectMode(false); setSelected(new Set()) }

  function openNewForm(clientName: string) {
    setNewForms(p => ({ ...p, [clientName]: { open: true, title: '', type: 'Reel', docsLink: '', deadline: '' } }))
  }
  function closeNewForm(clientName: string) {
    setNewForms(p => { const n = { ...p }; delete n[clientName]; return n })
  }
  function submitNewForm(clientName: string) {
    const form = newForms[clientName]
    if (!form || !form.title.trim()) return
    const deadlineTs = form.deadline ? new Date(form.deadline + 'T12:00:00').getTime() : undefined
    onAddRoteiro?.(clientName, {
      title: form.title.trim(),
      type: form.type,
      docsLink: form.docsLink.trim() || undefined,
      deadline: deadlineTs,
      year: viewYear,
      month: viewMonth,
    }, viewYear, viewMonth)
    closeNewForm(clientName)
  }

  async function handleImportFetch(clientName: string) {
    const url = importInput[clientName]?.trim()
    if (!url) return
    setImportLoading(clientName)
    try {
      const res = await fetch(`/api/fetch-doc?url=${encodeURIComponent(url)}`)
      const data = await res.json() as { ok: boolean; text?: string; error?: string }
      if (!data.ok || !data.text) {
        alert(data.error ?? 'Não foi possível ler o documento. Verifique se está público.')
        return
      }
      const parsed = parseDocRoteiros(data.text)
      if (parsed.length === 0) {
        alert('Nenhum roteiro encontrado no documento. Verifique o formato (ex: "VIDEO - Título", "POST - Título").')
        return
      }
      setImportInput(p => { const n = { ...p }; delete n[clientName]; return n })
      setImportModal({ open: true, clientName, items: parsed.map(i => ({ ...i, selected: true })), docsLink: url })
    } catch {
      alert('Erro de rede. Tente novamente.')
    } finally {
      setImportLoading(null)
    }
  }
  const monthOptions = (() => {
    const opts: { year: number; month: number; label: string }[] = []
    let y = 2026, m = 4
    const now = new Date()
    const limY = now.getFullYear(), limM = now.getMonth() + 12
    while (y < limY || (y === limY && m <= limM) || opts.length < 1) {
      opts.push({ year: y, month: m, label: `${MONTH_NAMES_ROT[m]}/${String(y).slice(2)}` })
      m++; if (m > 11) { m = 0; y++ }
      if (opts.length > 30) break
    }
    return opts
  })()

  const allClientNames = useMemo(() => {
    const base = allClients && allClients.length > 0 ? allClients.map(c => c.name) : Object.keys(roteiros)
    return [...base].sort()
  }, [allClients, roteiros])

  const clientResponsibleMap = useMemo(() => {
    if (!allClients) return {} as Record<string, string>
    const m: Record<string, string> = {}
    allClients.forEach(c => { if (c.responsible) m[c.name] = c.responsible })
    return m
  }, [allClients])

  const clientsToShow = useMemo(() =>
    allClientNames.filter(c => filterClient === 'all' || c === filterClient),
    [allClientNames, filterClient]
  )

  const allForMonth = (clientName: string) =>
    (roteiros[clientName] ?? []).filter(r => !r.year || (r.year === viewYear && r.month === viewMonth))

  const totalCount = useMemo(() =>
    clientsToShow.reduce((s, c) => s + allForMonth(c).length, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientsToShow, roteiros, viewMonth, viewYear]
  )

  const stats = useMemo(() => {
    const todayMs = new Date().setHours(0, 0, 0, 0)
    let total = 0, withDocs = 0, withDeadline = 0, overdue = 0
    clientsToShow.forEach(c => {
      allForMonth(c).forEach(r => {
        total++
        if (r.docsLink) withDocs++
        if (r.deadline) {
          withDeadline++
          if (new Date(r.deadline).setHours(0, 0, 0, 0) < todayMs) overdue++
        }
      })
    })
    return { total, withDocs, withDeadline, overdue }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientsToShow, roteiros, viewMonth, viewYear])

  const timelineItems = useMemo(() => {
    const items: Array<{ roteiro: import('../types').Roteiro; clientName: string }> = []
    clientsToShow.forEach(c => {
      allForMonth(c).forEach(r => items.push({ roteiro: r, clientName: c }))
    })
    const withDeadline = items.filter(i => i.roteiro.deadline).sort((a, b) => a.roteiro.deadline! - b.roteiro.deadline!)
    const withoutDeadline = items.filter(i => !i.roteiro.deadline).sort((a, b) => a.clientName.localeCompare(b.clientName))
    return { withDeadline, withoutDeadline }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientsToShow, roteiros, viewMonth, viewYear])

  const clientStats = useMemo(() => {
    const todayMs = new Date().setHours(0, 0, 0, 0)
    const map: Record<string, { total: number; withDocs: number; overdue: number; nextDeadline?: number }> = {}
    clientsToShow.forEach(c => {
      const list = allForMonth(c)
      let withDocs = 0, overdue = 0, nextDeadline: number | undefined
      list.forEach(r => {
        if (r.docsLink) withDocs++
        if (r.deadline) {
          if (new Date(r.deadline).setHours(0, 0, 0, 0) < todayMs) overdue++
          else if (!nextDeadline || r.deadline < nextDeadline) nextDeadline = r.deadline
        }
      })
      map[c] = { total: list.length, withDocs, overdue, nextDeadline }
    })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientsToShow, roteiros, viewMonth, viewYear])

  function getClientStatus(c: string) {
    const s = clientStats[c]
    if (!s || s.total === 0) return { color: 'rgba(255,255,255,0.15)', level: 'empty' as const }
    if (s.overdue > 0) return { color: '#FF3B30', level: 'overdue' as const }
    if (s.nextDeadline) {
      const diff = Math.round((new Date(s.nextDeadline).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
      if (diff <= 1) return { color: '#FFD700', level: 'soon' as const }
    }
    return { color: '#00C47A', level: 'ok' as const }
  }

  const filteredSorted = useMemo(() => {
    let list = clientsToShow
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(c => c.toLowerCase().includes(q))
    }
    if (quickFilter === 'with') list = list.filter(c => (clientStats[c]?.total ?? 0) > 0)
    else if (quickFilter === 'without') list = list.filter(c => (clientStats[c]?.total ?? 0) === 0)
    else if (quickFilter === 'overdue') list = list.filter(c => (clientStats[c]?.overdue ?? 0) > 0)
    else if (quickFilter === 'mine' && currentUser) list = list.filter(c => clientResponsibleMap[c] === currentUser)
    const sorted = [...list]
    if (sortMode === 'alpha-asc') sorted.sort((a, b) => a.localeCompare(b, 'pt-BR'))
    else if (sortMode === 'alpha-desc') sorted.sort((a, b) => b.localeCompare(a, 'pt-BR'))
    else if (sortMode === 'most') sorted.sort((a, b) => (clientStats[b]?.total ?? 0) - (clientStats[a]?.total ?? 0))
    else if (sortMode === 'overdue') sorted.sort((a, b) => (clientStats[b]?.overdue ?? 0) - (clientStats[a]?.overdue ?? 0))
    return sorted
  }, [clientsToShow, searchQuery, quickFilter, sortMode, clientStats, currentUser, clientResponsibleMap])

  const clientGroups = useMemo(() => {
    const overdue = filteredSorted.filter(c => (clientStats[c]?.overdue ?? 0) > 0)
    const active = filteredSorted.filter(c => (clientStats[c]?.overdue ?? 0) === 0 && (clientStats[c]?.total ?? 0) > 0)
    const empty = filteredSorted.filter(c => (clientStats[c]?.total ?? 0) === 0)
    const result: Array<{ key: string; label: string; clients: string[] }> = []
    if (overdue.length > 0) result.push({ key: 'overdue', label: 'Atrasados', clients: overdue })
    if (active.length > 0) result.push({ key: 'active', label: 'Com roteiros', clients: active })
    if (empty.length > 0) result.push({ key: 'empty', label: 'Sem roteiros', clients: empty })
    return result
  }, [filteredSorted, clientStats])

  // ── Kanban: roteiros do mês agrupados por status ──
  const kanbanData = useMemo(() => {
    const map: Record<RoteiroStatus_, Array<import('../types').Roteiro>> = { ideia: [], escrevendo: [], revisao: [], pronto: [] }
    const q = searchQuery.trim().toLowerCase()
    filteredSorted.forEach(c => {
      allForMonth(c).forEach(r => {
        if (q && !r.title.toLowerCase().includes(q) && !c.toLowerCase().includes(q)) return
        map[r.status ?? 'ideia'].push(r)
      })
    })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSorted, roteiros, viewMonth, viewYear, searchQuery])

  const kanbanSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 10 } }),
  )
  const kanbanCollision: CollisionDetection = useCallback((args) => {
    const hits = pointerWithin(args)
    const colHits = hits.filter(({ id }) => String(id).startsWith('rotcol-'))
    if (colHits.length > 0) return colHits
    return closestCenter(args)
  }, [])

  const findRoteiro = useCallback((id: string): { clientName: string; r: import('../types').Roteiro } | null => {
    for (const c of Object.keys(roteiros)) {
      const r = roteiros[c]?.find(x => x.id === id)
      if (r) return { clientName: c, r }
    }
    return null
  }, [roteiros])

  const handleKanbanDragEnd = useCallback((e: DragEndEvent) => {
    setDragId(null)
    const { active, over } = e
    if (!over) return
    const overId = String(over.id)
    if (!overId.startsWith('rotcol-')) return
    // id = rotcol-<grupo>-<status>
    const newStatus = overId.split('-').pop() as RoteiroStatus_
    const found = findRoteiro(String(active.id))
    if (!found || (found.r.status ?? 'ideia') === newStatus) return
    onUpdateRoteiro?.(found.clientName, found.r.id, { status: newStatus })
  }, [findRoteiro, onUpdateRoteiro])

  const kanbanDragRoteiro = dragId ? findRoteiro(dragId)?.r ?? null : null
  const kanbanEditTarget = kanbanEditId ? findRoteiro(kanbanEditId) : null

  // ── Limpar roteiros (mês atual / tudo) ──
  const monthRoteiroIds = useMemo(() => {
    const ids: string[] = []
    Object.keys(roteiros).forEach(c => {
      (roteiros[c] ?? []).forEach(r => {
        if (!r.year || (r.year === viewYear && r.month === viewMonth)) ids.push(r.id)
      })
    })
    return ids
  }, [roteiros, viewMonth, viewYear])
  const allRoteiroIds = useMemo(
    () => Object.keys(roteiros).flatMap(c => (roteiros[c] ?? []).map(r => r.id)),
    [roteiros],
  )
  const confirmClear = () => {
    if (!onDeleteMany || !clearConfirm) return
    onDeleteMany(clearConfirm === 'month' ? monthRoteiroIds : allRoteiroIds)
    setClearConfirm(null)
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }}>

      {/* Row 1: Month selector + view toggle + select mode */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: ROT_COLOR, textTransform: 'uppercase', letterSpacing: '0.08em', mr: 0.5 }}>Mês:</Typography>
        {monthOptions.map(opt => {
          const active = opt.month === viewMonth && opt.year === viewYear
          return (
            <Box key={opt.label} onClick={() => onMonthChange(opt.month, opt.year)}
              sx={{ px: 1, py: 0.3, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
                bgcolor: active ? `${ROT_COLOR}20` : 'transparent',
                color: active ? ROT_COLOR : 'rgba(255,255,255,0.3)',
                border: `1px solid ${active ? ROT_COLOR + '40' : 'transparent'}`,
                '&:hover': { bgcolor: `${ROT_COLOR}12`, color: ROT_COLOR }, transition: 'all 0.15s ease' }}>
              {opt.label}
            </Box>
          )
        })}
        <Box sx={{ flex: 1 }} />
        {onDeleteMany && selectMode && (
          <Box onClick={() => { const allIds = clientsToShow.flatMap(c => allForMonth(c).map(r => r.id)); setSelected(new Set(allIds)) }}
            sx={{ px: 1, py: 0.3, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
              color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)',
              '&:hover': { color: '#fff', borderColor: 'rgba(255,255,255,0.25)' }, transition: 'all 0.15s ease' }}>Todos</Box>
        )}
        {onDeleteMany && (
          <Box onClick={() => { setSelectMode(p => !p); setSelected(new Set()) }}
            sx={{ px: 1, py: 0.3, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
              bgcolor: selectMode ? `${ROT_COLOR}20` : 'transparent',
              color: selectMode ? ROT_COLOR : 'rgba(255,255,255,0.35)',
              border: `1px solid ${selectMode ? ROT_COLOR + '40' : 'transparent'}`,
              '&:hover': { color: ROT_COLOR }, transition: 'all 0.15s ease' }}>
            {selectMode ? '✕ Cancelar' : '☑ Selecionar'}
          </Box>
        )}
        {onDeleteMany && !selectMode && (
          <>
            <Box onClick={() => monthRoteiroIds.length > 0 && setClearConfirm('month')}
              sx={{ px: 1, py: 0.3, borderRadius: '6px', cursor: monthRoteiroIds.length > 0 ? 'pointer' : 'default', fontSize: '0.6rem', fontWeight: 700,
                color: monthRoteiroIds.length > 0 ? '#FF8A45' : 'rgba(255,255,255,0.18)',
                border: `1px solid ${monthRoteiroIds.length > 0 ? 'rgba(255,138,69,0.28)' : 'transparent'}`,
                '&:hover': monthRoteiroIds.length > 0 ? { bgcolor: 'rgba(255,138,69,0.1)' } : {}, transition: 'all 0.15s ease' }}>
              🧹 Limpar mês
            </Box>
            <Box onClick={() => allRoteiroIds.length > 0 && setClearConfirm('all')}
              sx={{ px: 1, py: 0.3, borderRadius: '6px', cursor: allRoteiroIds.length > 0 ? 'pointer' : 'default', fontSize: '0.6rem', fontWeight: 700,
                color: allRoteiroIds.length > 0 ? '#FF4545' : 'rgba(255,255,255,0.18)',
                border: `1px solid ${allRoteiroIds.length > 0 ? 'rgba(255,69,69,0.3)' : 'transparent'}`,
                '&:hover': allRoteiroIds.length > 0 ? { bgcolor: 'rgba(255,69,69,0.12)' } : {}, transition: 'all 0.15s ease' }}>
              🗑 Limpar tudo
            </Box>
          </>
        )}
      </Box>

      {/* Row 2: Search + Sort (list and grid modes only) */}
      {viewMode !== 'timeline' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.8 }}>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.8, px: 1.2, py: 0.6,
            borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            '&:focus-within': { borderColor: `${ROT_COLOR}40` }, transition: 'border-color 0.2s' }}>
            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', lineHeight: 1, flexShrink: 0 }}>🔍</Typography>
            <Box component="input"
              value={searchQuery}
              onChange={(e: { target: { value: string } }) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente…"
              sx={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '0.72rem', fontFamily: 'inherit',
                '&::placeholder': { color: 'rgba(255,255,255,0.22)' } }} />
            {searchQuery && (
              <Box onClick={() => setSearchQuery('')}
                sx={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.62rem', cursor: 'pointer', flexShrink: 0, lineHeight: 1,
                  '&:hover': { color: 'rgba(255,255,255,0.7)' }, transition: 'color 0.15s' }}>✕</Box>
            )}
          </Box>
          <Box onClick={() => setSortMode(v => {
            const opts = ['alpha-asc', 'alpha-desc', 'most', 'overdue'] as const
            return opts[(opts.indexOf(v) + 1) % opts.length]
          })}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.55, borderRadius: '8px', cursor: 'pointer',
              bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap',
              color: 'rgba(255,255,255,0.45)', '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)' }, transition: 'all 0.15s' }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, lineHeight: 1 }}>
              {{ 'alpha-asc': 'A→Z', 'alpha-desc': 'Z→A', 'most': '# Qtd', 'overdue': '🔴 Atrasos' }[sortMode]}
            </Typography>
            <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1 }}>⇅</Typography>
          </Box>
        </Box>
      )}

      {/* Row 3: Quick filters + count */}
      {viewMode !== 'timeline' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
          {([['all', 'Todos'], ['with', 'Com roteiros'], ['without', 'Sem roteiros'], ['overdue', 'Atrasados']] as const).map(([k, lbl]) => {
            const active = quickFilter === k
            const c = k === 'overdue' ? '#FF3B30' : k === 'with' ? ROT_COLOR : 'rgba(255,255,255,0.55)'
            return (
              <Box key={k} onClick={() => setQuickFilter(k)}
                sx={{ px: 0.9, py: 0.3, borderRadius: '7px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: active ? 700 : 500,
                  bgcolor: active ? `${c}14` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? c + '35' : 'rgba(255,255,255,0.07)'}`,
                  color: active ? c : 'rgba(255,255,255,0.38)',
                  transition: 'all 0.15s ease' }}>{lbl}</Box>
            )
          })}
          {currentUser && (() => {
            const resp = NAME_MAP[currentUser]
            const active = quickFilter === 'mine'
            const c = resp?.color ?? ROT_COLOR
            return (
              <Box onClick={() => setQuickFilter(active ? 'all' : 'mine')}
                sx={{ px: 0.9, py: 0.3, borderRadius: '7px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: active ? 700 : 500,
                  bgcolor: active ? `${c}14` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? c + '35' : 'rgba(255,255,255,0.07)'}`,
                  color: active ? c : 'rgba(255,255,255,0.38)',
                  display: 'flex', alignItems: 'center', gap: 0.4,
                  transition: 'all 0.15s ease' }}>
                {resp?.emoji} Meus clientes
              </Box>
            )
          })()}
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.22)' }}>
            {filteredSorted.length} cliente{filteredSorted.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      )}

      {/* KPI strip */}
      {stats.total > 0 && (
        <Box sx={{ display: 'flex', gap: 0.8, mb: 1.2, flexWrap: 'wrap' }}>
          {[
            { label: 'roteiros', value: stats.total, color: ROT_COLOR },
            { label: 'com docs', value: stats.withDocs, color: '#3B8EFF' },
            { label: 'com prazo', value: stats.withDeadline, color: '#C084FC' },
            ...(stats.overdue > 0 ? [{ label: 'atrasados', value: stats.overdue, color: '#FF3B30' }] : []),
          ].map(s => (
            <Box key={s.label} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.4, px: 1, py: 0.4, borderRadius: '7px',
              bgcolor: `${s.color}0a`, border: `1px solid ${s.color}1e` }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, lineHeight: 1, color: s.color }}>{s.value}</Typography>
              <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1, fontWeight: 500 }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5, scrollbarWidth: 'thin', scrollbarColor: `${ROT_COLOR}55 transparent` }}>

        {/* ── KANBAN VIEW ── */}
        {viewMode === 'kanban' && (
          <DndContext
            sensors={kanbanSensors}
            collisionDetection={kanbanCollision}
            onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))}
            onDragEnd={handleKanbanDragEnd}
            onDragCancel={() => setDragId(null)}
          >
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 1, alignItems: 'flex-start', pb: 2,
            }}>
              {ROTEIRO_STATUS_FLOW.map(st => {
                const cfg = ROTEIRO_STATUS_CFG[st]
                const colItems = kanbanData[st]
                const isEditingCol = editingCol === st
                return (
                  <Box key={st} sx={{
                    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)',
                    bgcolor: 'rgba(255,255,255,0.018)', overflow: 'hidden',
                  }}>
                    <Box sx={{
                      px: 1.2, py: 0.8, display: 'flex', alignItems: 'center', gap: 0.7,
                      borderBottom: `1px solid ${cfg.color}22`, bgcolor: `${cfg.color}0c`,
                    }}>
                      <Typography sx={{ fontSize: '0.82rem', lineHeight: 1 }}>{cfg.icon}</Typography>
                      {isEditingCol ? (
                        <Box component="input" autoFocus
                          defaultValue={colLabel(st)}
                          onBlur={(e: { target: { value: string } }) => saveColLabel(st, e.target.value)}
                          onKeyDown={(e: { key: string; currentTarget: { value: string; blur: () => void } }) => {
                            if (e.key === 'Enter') saveColLabel(st, e.currentTarget.value)
                            else if (e.key === 'Escape') setEditingCol(null)
                          }}
                          sx={{ flex: 1, minWidth: 0, background: 'rgba(0,0,0,0.4)', border: `1px solid ${cfg.color}`, borderRadius: '5px',
                            px: 0.6, py: 0.25, color: '#fff', fontSize: '0.62rem', fontWeight: 800, outline: 'none', textTransform: 'uppercase' }} />
                      ) : (
                        <Typography
                          onClick={() => setEditingCol(st)}
                          title="Clique para renomear a coluna"
                          sx={{ fontSize: '0.62rem', fontWeight: 800, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1, cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 } }}>
                          {colLabel(st)}
                        </Typography>
                      )}
                      {!isEditingCol && (
                        <Box onClick={() => setEditingCol(st)} title="Renomear coluna"
                          sx={{ fontSize: '0.6rem', cursor: 'pointer', color: `${cfg.color}99`, lineHeight: 1, px: 0.2,
                            '&:hover': { color: cfg.color } }}>
                          ✎
                        </Box>
                      )}
                      <Box sx={{ px: 0.7, py: 0.1, borderRadius: '6px', bgcolor: `${cfg.color}1c` }}>
                        <Typography sx={{ fontSize: '0.58rem', fontWeight: 800, color: cfg.color }}>{colItems.length}</Typography>
                      </Box>
                    </Box>
                    <RoteiroStatusColumn colId={`rotcol-${st}`} color={cfg.color}>
                      {colItems.length === 0 ? (
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center', py: 2 }}>
                          Arraste cartões aqui
                        </Typography>
                      ) : (
                        colItems.map(r => <RoteiroKanbanCard key={r.id} roteiro={r} onOpen={() => { openEdit(r); setKanbanEditId(r.id) }} />)
                      )}
                    </RoteiroStatusColumn>
                  </Box>
                )
              })}
            </Box>

            <DragOverlay dropAnimation={null}>
              {kanbanDragRoteiro ? (
                <Box sx={{
                  p: 1, pl: 1.2, borderRadius: '10px', transform: 'rotate(2deg)', maxWidth: 220,
                  border: `1px solid ${ROTEIRO_STATUS_CFG[kanbanDragRoteiro.status ?? 'ideia'].color}66`,
                  bgcolor: 'rgba(20,20,20,0.97)', boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                }}>
                  <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.42)' }}>{kanbanDragRoteiro.clientName}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', lineHeight: 1.25 }}>
                    {kanbanDragRoteiro.title || '(sem título)'}
                  </Typography>
                </Box>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* ── LIST VIEW ── */}
        {viewMode === 'list' && (
          filteredSorted.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 1 }}>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)' }}>
                {searchQuery ? `Nenhum resultado para "${searchQuery}"` : 'Nenhum cliente encontrado'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {clientGroups.map((group, gi) => {
                const isCollapsed = collapsedGroups.has(group.key)
                return (
                  <Box key={group.key}>
                    <Box onClick={() => setCollapsedGroups(prev => { const n = new Set(prev); n.has(group.key) ? n.delete(group.key) : n.add(group.key); return n })}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.8, py: 0.6, px: 0.6, mb: 0.3, cursor: 'pointer',
                        borderRadius: '8px', userSelect: 'none', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' }, transition: 'background 0.15s' }}>
                      <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                        color: group.key === 'overdue' ? '#FF3B30' : group.key === 'active' ? ROT_COLOR : 'rgba(255,255,255,0.3)' }}>
                        {group.key === 'overdue' ? '🔴 ' : ''}{group.label}
                      </Typography>
                      <Box sx={{ px: 0.6, py: 0.1, borderRadius: '4px',
                        bgcolor: group.key === 'overdue' ? 'rgba(255,59,48,0.12)' : group.key === 'active' ? `${ROT_COLOR}14` : 'rgba(255,255,255,0.06)' }}>
                        <Typography sx={{ fontSize: '0.55rem', fontWeight: 700,
                          color: group.key === 'overdue' ? '#FF3B30' : group.key === 'active' ? ROT_COLOR : 'rgba(255,255,255,0.32)' }}>{group.clients.length}</Typography>
                      </Box>
                      <Box sx={{ flex: 1 }} />
                      <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', lineHeight: 1 }}>
                        {isCollapsed ? '▶' : '▾'}
                      </Typography>
                    </Box>

                    {!isCollapsed && (
                      <Box sx={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        {group.clients.map((clientName, ci) => {
                          const cs = clientStats[clientName]
                          const status = getClientStatus(clientName)
                          const driveFolder = clientFolders[clientName]
                          const isExpanded = expandedClients.has(clientName)
                          const list = allForMonth(clientName)
                          const newForm = newForms[clientName]
                          const isLast = ci === group.clients.length - 1
                          return (
                            <Box key={clientName}>
                              {/* Client row */}
                              <Box
                                onClick={() => setExpandedClients(prev => { const n = new Set(prev); n.has(clientName) ? n.delete(clientName) : n.add(clientName); return n })}
                                sx={{ display: 'flex', alignItems: 'center', gap: 1.2, px: 1.5, py: 0.9, cursor: 'pointer',
                                  bgcolor: isExpanded ? 'rgba(251,113,133,0.03)' : 'transparent',
                                  borderBottom: (!isLast || isExpanded) ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                  '&:hover': { bgcolor: 'rgba(255,255,255,0.025)' }, transition: 'background 0.15s' }}>
                                {selectMode && (
                                  <Box onClick={e => { e.stopPropagation(); toggleAll(list.map(r => r.id)) }}
                                    sx={{ width: 15, height: 15, borderRadius: '4px', flexShrink: 0,
                                      border: `1.5px solid ${list.length > 0 && list.every(r => selected.has(r.id)) ? ROT_COLOR : 'rgba(255,255,255,0.22)'}`,
                                      bgcolor: list.length > 0 && list.every(r => selected.has(r.id)) ? `${ROT_COLOR}30` : 'transparent',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: '0.45rem', color: ROT_COLOR, fontWeight: 900, transition: 'all 0.15s ease' }}>
                                    {list.length > 0 && list.every(r => selected.has(r.id)) && '✓'}
                                  </Box>
                                )}
                                <Box sx={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, bgcolor: status.color,
                                  ...(status.level === 'overdue' && { boxShadow: `0 0 6px ${status.color}66` }) }} />
                                <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.88)', flex: 1, lineHeight: 1 }} noWrap>
                                  {clientName}
                                </Typography>
                                {clientResponsibleMap[clientName] && (() => {
                                  const resp = NAME_MAP[clientResponsibleMap[clientName]]
                                  if (!resp) return null
                                  return (
                                    <Tooltip title={`${resp.emoji} ${clientResponsibleMap[clientName]} · ${resp.role}`}>
                                      <Box sx={{
                                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                        bgcolor: `${resp.color}1a`, border: `1.5px solid ${resp.color}45`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.65rem', lineHeight: 1,
                                      }}>
                                        {resp.emoji}
                                      </Box>
                                    </Tooltip>
                                  )
                                })()}
                                {cs && cs.total > 0 && (
                                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mr: 0.5 }}>
                                    <Box sx={{ px: 0.7, py: 0.15, borderRadius: '5px', bgcolor: 'rgba(255,255,255,0.05)' }}>
                                      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.40)', fontWeight: 600, lineHeight: 1 }}>{cs.total}</Typography>
                                    </Box>
                                    {cs.withDocs > 0 && (
                                      <Box sx={{ px: 0.6, py: 0.15, borderRadius: '5px', bgcolor: 'rgba(59,142,255,0.09)', border: '1px solid rgba(59,142,255,0.18)' }}>
                                        <Typography sx={{ fontSize: '0.58rem', color: '#3B8EFF', fontWeight: 600, lineHeight: 1 }}>📄 {cs.withDocs}</Typography>
                                      </Box>
                                    )}
                                    {cs.overdue > 0 && (
                                      <Box sx={{ px: 0.6, py: 0.15, borderRadius: '5px', bgcolor: 'rgba(255,59,48,0.09)', border: '1px solid rgba(255,59,48,0.18)' }}>
                                        <Typography sx={{ fontSize: '0.58rem', color: '#FF3B30', fontWeight: 700, lineHeight: 1 }}>{cs.overdue} atraso</Typography>
                                      </Box>
                                    )}
                                    {cs.nextDeadline && cs.overdue === 0 && (
                                      <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.25)', lineHeight: 1, flexShrink: 0 }}>
                                        {getDeadlineLabel(cs.nextDeadline)}
                                      </Typography>
                                    )}
                                  </Box>
                                )}
                                <Box sx={{ display: 'flex', gap: 0.3, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                  {driveFolder && (
                                    <Box component="a" href={driveFolder} target="_blank" rel="noopener noreferrer"
                                      sx={{ width: 22, height: 22, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        bgcolor: 'rgba(59,142,255,0.08)', border: '1px solid rgba(59,142,255,0.18)', color: '#3B8EFF', fontSize: '0.62rem',
                                        textDecoration: 'none', '&:hover': { bgcolor: 'rgba(59,142,255,0.18)' }, transition: 'all 0.15s' }}>☁️</Box>
                                  )}
                                  {onImportBatch && !importInput[clientName] && !selectMode && (
                                    <Box onClick={() => { setImportInput(p => ({ ...p, [clientName]: '' })); setExpandedClients(prev => { const n = new Set(prev); n.add(clientName); return n }) }}
                                      sx={{ width: 22, height: 22, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        bgcolor: `${ROT_COLOR}08`, border: `1px solid ${ROT_COLOR}20`, color: ROT_COLOR, fontSize: '0.62rem',
                                        cursor: 'pointer', '&:hover': { bgcolor: `${ROT_COLOR}18` }, transition: 'all 0.15s' }}>📄</Box>
                                  )}
                                  {onAddRoteiro && !newForm?.open && !selectMode && (
                                    <Box onClick={() => { openNewForm(clientName); setExpandedClients(prev => { const n = new Set(prev); n.add(clientName); return n }) }}
                                      sx={{ width: 22, height: 22, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        bgcolor: `${ROT_COLOR}12`, border: `1px solid ${ROT_COLOR}28`, color: ROT_COLOR, fontSize: '0.82rem', fontWeight: 900,
                                        cursor: 'pointer', '&:hover': { bgcolor: `${ROT_COLOR}22` }, transition: 'all 0.15s' }}>+</Box>
                                  )}
                                </Box>
                                <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.18)', flexShrink: 0, ml: 0.3, lineHeight: 1 }}>
                                  {isExpanded ? '▾' : '▸'}
                                </Typography>
                              </Box>

                              {isExpanded && (
                                <Box sx={{ bgcolor: 'rgba(0,0,0,0.1)', borderBottom: !isLast ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                  {importInput[clientName] !== undefined && (
                                    <Box sx={{ display: 'flex', gap: 0.5, px: 2.5, py: 0.8 }}>
                                      <Box component="input" autoFocus value={importInput[clientName]}
                                        onChange={(e: { target: { value: string } }) => setImportInput(p => ({ ...p, [clientName]: e.target.value }))}
                                        onKeyDown={(e: { key: string }) => { if (e.key === 'Enter') handleImportFetch(clientName); if (e.key === 'Escape') setImportInput(p => { const n = { ...p }; delete n[clientName]; return n }) }}
                                        placeholder="Cole o link do Google Docs do mês…"
                                        sx={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: `1px solid ${ROT_COLOR}40`, borderRadius: '6px',
                                          px: 1, py: 0.5, color: '#fff', fontSize: '0.6rem', outline: 'none', fontFamily: 'inherit',
                                          '&:focus': { borderColor: ROT_COLOR } }} />
                                      <Box onClick={() => handleImportFetch(clientName)}
                                        sx={{ px: 0.9, py: 0.4, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
                                          background: `${ROT_COLOR}20`, border: `1px solid ${ROT_COLOR}40`, color: ROT_COLOR, display: 'flex', alignItems: 'center',
                                          '&:hover': { background: `${ROT_COLOR}35` }, transition: 'all 0.15s ease' }}>
                                        {importLoading === clientName ? '…' : '↵'}
                                      </Box>
                                      <Box onClick={() => setImportInput(p => { const n = { ...p }; delete n[clientName]; return n })}
                                        sx={{ px: 0.7, py: 0.4, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem',
                                          color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                                          '&:hover': { color: 'rgba(255,255,255,0.6)' }, transition: 'all 0.15s ease' }}>✕</Box>
                                    </Box>
                                  )}
                                  {newForm?.open && (
                                    <Box sx={{ mx: 2.5, my: 0.8, p: 1.2, borderRadius: '10px',
                                      background: `${ROT_COLOR}07`, border: `1px solid ${ROT_COLOR}22`,
                                      display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                                      <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: ROT_COLOR }}>+ Novo roteiro</Typography>
                                      <Box component="input" autoFocus value={newForm.title}
                                        onChange={(e: { target: { value: string } }) => setNewForms(p => ({ ...p, [clientName]: { ...p[clientName], title: e.target.value } }))}
                                        onKeyDown={(e: { key: string }) => { if (e.key === 'Escape') closeNewForm(clientName) }}
                                        placeholder="Título do roteiro…"
                                        sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid rgba(255,255,255,0.10)`, borderRadius: '6px',
                                          px: 1, py: 0.5, color: '#fff', fontSize: '0.65rem', fontWeight: 600, outline: 'none', width: '100%', boxSizing: 'border-box',
                                          '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s', fontFamily: 'inherit' }} />
                                      <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                                        {ALL_TYPES.map(tp => (
                                          <Box key={tp} onClick={() => setNewForms(p => ({ ...p, [clientName]: { ...p[clientName], type: tp } }))}
                                            sx={{ px: 0.8, py: 0.25, borderRadius: '5px', cursor: 'pointer', fontSize: '0.56rem', fontWeight: 700,
                                              background: newForm.type === tp ? `${ROT_COLOR}25` : 'rgba(255,255,255,0.04)',
                                              border: `1px solid ${newForm.type === tp ? ROT_COLOR + '50' : 'rgba(255,255,255,0.07)'}`,
                                              color: newForm.type === tp ? ROT_COLOR : 'rgba(255,255,255,0.35)', transition: 'all 0.15s ease' }}>{tp}</Box>
                                        ))}
                                      </Box>
                                      <Box component="input" value={newForm.docsLink}
                                        onChange={(e: { target: { value: string } }) => setNewForms(p => ({ ...p, [clientName]: { ...p[clientName], docsLink: e.target.value } }))}
                                        placeholder="📄 Link do Docs — distribui automaticamente ao calendário"
                                        sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${ROT_COLOR}22`, borderRadius: '6px',
                                          px: 1, py: 0.5, color: '#fff', fontSize: '0.6rem', outline: 'none', width: '100%', boxSizing: 'border-box',
                                          '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s', fontFamily: 'inherit' }} />
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                        <Typography sx={{ fontSize: '0.52rem', color: '#C084FC', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Prazo:</Typography>
                                        <Box component="input" type="date" value={newForm.deadline}
                                          onChange={(e: { target: { value: string } }) => setNewForms(p => ({ ...p, [clientName]: { ...p[clientName], deadline: e.target.value } }))}
                                          sx={{ flex: 1, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(192,132,252,0.22)', borderRadius: '6px',
                                            px: 0.8, py: 0.4, color: newForm.deadline ? '#fff' : 'rgba(255,255,255,0.28)', fontSize: '0.6rem', outline: 'none',
                                            '&:focus': { borderColor: '#C084FC' }, transition: 'border-color 0.15s', colorScheme: 'dark', fontFamily: 'inherit' }} />
                                      </Box>
                                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                                        <Box onClick={() => closeNewForm(clientName)}
                                          sx={{ px: 1, py: 0.4, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 600,
                                            color: 'rgba(255,255,255,0.32)', border: '1px solid rgba(255,255,255,0.08)',
                                            '&:hover': { color: '#fff' }, transition: 'all 0.15s ease' }}>Cancelar</Box>
                                        <Box onClick={() => submitNewForm(clientName)}
                                          sx={{ px: 1.2, py: 0.4, borderRadius: '6px', cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700,
                                            background: newForm.title.trim() ? `linear-gradient(135deg, ${ROT_COLOR}, #f43f5e)` : 'rgba(255,255,255,0.06)',
                                            color: newForm.title.trim() ? '#fff' : 'rgba(255,255,255,0.25)',
                                            boxShadow: newForm.title.trim() ? `0 3px 10px ${ROT_COLOR}30` : 'none',
                                            transition: 'all 0.15s ease' }}>Adicionar</Box>
                                      </Box>
                                    </Box>
                                  )}
                                  {list.length > 0 && (
                                    <Box sx={{ px: 2.5, py: 0.5 }}>
                                      {list.map(r => {
                                        const isSelected = selected.has(r.id)
                                        const ed = expandedEdit[r.id]
                                        const isEditing = ed !== undefined
                                        const dlevel = r.deadline ? getRoteiroDeadlineLevel(r.deadline) : null
                                        const dcolor = dlevel ? ROT_DEADLINE_COLOR[dlevel] : null
                                        return (
                                          <Box key={r.id}>
                                            <Box onClick={selectMode ? () => toggleSelect(r.id) : undefined}
                                              sx={{ display: 'flex', alignItems: 'center', gap: 0.8, py: 0.6, px: 0.8, borderRadius: '7px',
                                                bgcolor: isSelected ? `${ROT_COLOR}08` : 'transparent',
                                                cursor: selectMode ? 'pointer' : 'default',
                                                '&:hover': { bgcolor: selectMode ? `${ROT_COLOR}10` : 'rgba(255,255,255,0.02)' },
                                                transition: 'background 0.15s' }}>
                                              {selectMode && (
                                                <Box sx={{ width: 13, height: 13, borderRadius: '3px', flexShrink: 0,
                                                  border: `1.5px solid ${isSelected ? ROT_COLOR : 'rgba(255,255,255,0.22)'}`,
                                                  bgcolor: isSelected ? `${ROT_COLOR}35` : 'transparent',
                                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                  fontSize: '0.45rem', color: ROT_COLOR, fontWeight: 900 }}>
                                                  {isSelected && '✓'}
                                                </Box>
                                              )}
                                              <Box sx={{ width: 4, height: 4, borderRadius: '50%', flexShrink: 0, bgcolor: dcolor ?? 'rgba(255,255,255,0.22)' }} />
                                              <Typography sx={{ flex: 1, fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.78)', lineHeight: 1 }} noWrap>
                                                {r.title || '(sem título)'}
                                              </Typography>
                                              <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.28)', flexShrink: 0 }}>{r.type}</Typography>
                                              {r.deadline && dcolor && (
                                                <Typography sx={{ fontSize: '0.55rem', color: dcolor, fontWeight: 700, flexShrink: 0 }}>
                                                  {getDeadlineLabel(r.deadline)}
                                                </Typography>
                                              )}
                                              {!selectMode && (
                                                <Box sx={{ display: 'flex', gap: 0.3, flexShrink: 0 }}>
                                                  {r.docsLink && (
                                                    <Box component="a" href={r.docsLink} target="_blank" rel="noopener noreferrer"
                                                      onClick={e => e.stopPropagation()}
                                                      sx={{ px: 0.5, py: 0.1, borderRadius: '4px', textDecoration: 'none',
                                                        bgcolor: `${ROT_COLOR}10`, border: `1px solid ${ROT_COLOR}20`, color: ROT_COLOR, fontSize: '0.56rem',
                                                        '&:hover': { bgcolor: `${ROT_COLOR}22` }, transition: 'all 0.15s' }}>📄</Box>
                                                  )}
                                                  {r.driveLink && (
                                                    <Box component="a" href={r.driveLink} target="_blank" rel="noopener noreferrer"
                                                      onClick={e => e.stopPropagation()}
                                                      sx={{ px: 0.5, py: 0.1, borderRadius: '4px', textDecoration: 'none',
                                                        bgcolor: 'rgba(59,142,255,0.10)', border: '1px solid rgba(59,142,255,0.20)', color: '#3B8EFF', fontSize: '0.56rem',
                                                        '&:hover': { bgcolor: 'rgba(59,142,255,0.20)' }, transition: 'all 0.15s' }}>☁️</Box>
                                                  )}
                                                  {onUpdateRoteiro && (
                                                    <Box onClick={e => { e.stopPropagation(); openEdit(r) }}
                                                      sx={{ px: 0.4, py: 0.1, borderRadius: '4px', cursor: 'pointer', fontSize: '0.54rem',
                                                        color: 'rgba(255,255,255,0.18)', '&:hover': { color: ROT_COLOR }, transition: 'color 0.15s' }}>✏️</Box>
                                                  )}
                                                </Box>
                                              )}
                                            </Box>
                                            {isEditing && (
                                              <Box sx={{ ml: 3.5, mb: 0.5, p: 1, borderRadius: '8px',
                                                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                                                display: 'flex', flexDirection: 'column', gap: 0.7 }}>
                                                <Box component="input" autoFocus value={ed.title}
                                                  onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], title: e.target.value } }))}
                                                  onKeyDown={(e: { key: string }) => { if (e.key === 'Escape') closeEdit(r.id) }}
                                                  sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid rgba(255,255,255,0.12)`, borderRadius: '6px',
                                                    px: 1, py: 0.5, color: '#fff', fontSize: '0.65rem', fontWeight: 700, outline: 'none', width: '100%', boxSizing: 'border-box',
                                                    '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s', fontFamily: 'inherit' }} />
                                                <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                                                  {ALL_TYPES.map(tp => (
                                                    <Box key={tp} onClick={() => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], type: tp } }))}
                                                      sx={{ px: 0.7, py: 0.25, borderRadius: '5px', cursor: 'pointer', fontSize: '0.56rem', fontWeight: 700,
                                                        background: ed.type === tp ? `${ROT_COLOR}25` : 'rgba(255,255,255,0.04)',
                                                        border: `1px solid ${ed.type === tp ? ROT_COLOR + '50' : 'rgba(255,255,255,0.08)'}`,
                                                        color: ed.type === tp ? ROT_COLOR : 'rgba(255,255,255,0.4)', transition: 'all 0.15s ease' }}>{tp}</Box>
                                                  ))}
                                                </Box>
                                                <Box component="input" value={ed.docsLink}
                                                  onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], docsLink: e.target.value } }))}
                                                  placeholder="📄 Link Docs"
                                                  sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${ROT_COLOR}25`, borderRadius: '6px',
                                                    px: 1, py: 0.45, color: '#fff', fontSize: '0.6rem', outline: 'none', width: '100%', boxSizing: 'border-box',
                                                    '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s', fontFamily: 'inherit' }} />
                                                <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'center' }}>
                                                  <Typography sx={{ fontSize: '0.52rem', color: '#C084FC', fontWeight: 700, flexShrink: 0 }}>Prazo:</Typography>
                                                  <Box component="input" type="date" value={ed.deadline}
                                                    onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], deadline: e.target.value } }))}
                                                    sx={{ flex: 1, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(192,132,252,0.22)', borderRadius: '6px',
                                                      px: 0.8, py: 0.4, color: ed.deadline ? '#fff' : 'rgba(255,255,255,0.28)', fontSize: '0.6rem', outline: 'none',
                                                      '&:focus': { borderColor: '#C084FC' }, transition: 'border-color 0.15s', colorScheme: 'dark', fontFamily: 'inherit' }} />
                                                </Box>
                                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                                                  <Box onClick={() => closeEdit(r.id)}
                                                    sx={{ px: 1, py: 0.4, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 600,
                                                      color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)',
                                                      '&:hover': { color: '#fff' }, transition: 'all 0.15s' }}>Cancelar</Box>
                                                  <Box onClick={() => saveEdit(clientName, r.id)}
                                                    sx={{ px: 1.2, py: 0.4, borderRadius: '6px', cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700,
                                                      background: `linear-gradient(135deg, ${ROT_COLOR}, #f43f5e)`, color: '#fff',
                                                      boxShadow: `0 3px 10px ${ROT_COLOR}30`, '&:hover': { filter: 'brightness(1.08)' }, transition: 'all 0.15s' }}>Salvar</Box>
                                                </Box>
                                              </Box>
                                            )}
                                          </Box>
                                        )
                                      })}
                                    </Box>
                                  )}
                                  {list.length === 0 && !newForm?.open && !importInput[clientName] && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, px: 3.5, py: 0.8 }}>
                                      <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.20)' }}>sem roteiros este mês</Typography>
                                      {onAddRoteiro && (
                                        <Box onClick={() => openNewForm(clientName)}
                                          sx={{ px: 0.8, py: 0.25, borderRadius: '5px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
                                            background: `${ROT_COLOR}10`, border: `1px solid ${ROT_COLOR}22`, color: ROT_COLOR,
                                            '&:hover': { background: `${ROT_COLOR}20` }, transition: 'all 0.15s' }}>+ Adicionar</Box>
                                      )}
                                    </Box>
                                  )}
                                </Box>
                              )}
                            </Box>
                          )
                        })}
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Box>
          )
        )}

        {/* ── GRID VIEW ── */}
        {viewMode === 'grid' && (
          filteredSorted.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 1 }}>
              <Typography sx={{ fontSize: '1.5rem' }}>📝</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>Nenhum cliente encontrado</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1.5 }}>
              {filteredSorted.map(clientName => {
                const list = allForMonth(clientName)
                const driveFolder = clientFolders[clientName]
                const newForm = newForms[clientName]
                return (
                  <Box key={clientName} sx={{
                    borderRadius: '14px', p: 1.5,
                    background: 'rgba(251,113,133,0.04)',
                    border: '1px solid rgba(251,113,133,0.10)',
                  }}>
                    {/* Client header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
                      {selectMode ? (
                        <Box onClick={() => toggleAll(list.map(r => r.id))}
                          sx={{ width: 20, height: 20, borderRadius: '5px', flexShrink: 0, cursor: 'pointer',
                            border: `1.5px solid ${list.length > 0 && list.every(r => selected.has(r.id)) ? ROT_COLOR : 'rgba(255,255,255,0.25)'}`,
                            background: list.length > 0 && list.every(r => selected.has(r.id)) ? `${ROT_COLOR}30` : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: ROT_COLOR, fontWeight: 900,
                            transition: 'all 0.15s ease' }}>
                          {list.length > 0 && list.every(r => selected.has(r.id)) && '✓'}
                        </Box>
                      ) : (
                        <Box sx={{
                          width: 26, height: 26, borderRadius: '7px', flexShrink: 0,
                          background: `${ROT_COLOR}16`, border: `1px solid ${ROT_COLOR}28`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem',
                        }}>📝</Box>
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: '#fff', lineHeight: 1 }} noWrap>
                          {clientName}
                        </Typography>
                        <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.32)' }}>
                          {list.length > 0 ? `${list.length} roteiro${list.length !== 1 ? 's' : ''}` : 'nenhum este mês'}
                        </Typography>
                      </Box>
                      {driveFolder && (
                        <Box component="a" href={driveFolder} target="_blank" rel="noopener noreferrer"
                          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '6px', textDecoration: 'none',
                            background: 'rgba(59,142,255,0.10)', border: '1px solid rgba(59,142,255,0.2)', color: '#3B8EFF', fontSize: '0.7rem',
                            '&:hover': { background: 'rgba(59,142,255,0.18)' }, transition: 'all 0.15s ease' }}>
                          ☁️
                        </Box>
                      )}
                      {onImportBatch && !importInput[clientName] && !selectMode && (
                        <Box onClick={() => setImportInput(p => ({ ...p, [clientName]: '' }))}
                          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '6px', cursor: 'pointer',
                            background: `${ROT_COLOR}0a`, border: `1px solid ${ROT_COLOR}22`, color: ROT_COLOR, fontSize: '0.65rem',
                            '&:hover': { background: `${ROT_COLOR}18` }, transition: 'all 0.15s ease' }}>
                          📄
                        </Box>
                      )}
                      {onAddRoteiro && !newForm?.open && !selectMode && (
                        <Box onClick={() => openNewForm(clientName)}
                          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '6px', cursor: 'pointer',
                            background: `${ROT_COLOR}14`, border: `1px solid ${ROT_COLOR}32`, color: ROT_COLOR, fontSize: '0.85rem', fontWeight: 900,
                            '&:hover': { background: `${ROT_COLOR}26` }, transition: 'all 0.15s ease' }}>
                          +
                        </Box>
                      )}
                    </Box>

                    {/* Import URL input */}
                    {importInput[clientName] !== undefined && (
                      <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                        <Box
                          component="input"
                          autoFocus
                          value={importInput[clientName]}
                          onChange={(e: { target: { value: string } }) => setImportInput(p => ({ ...p, [clientName]: e.target.value }))}
                          onKeyDown={(e: { key: string }) => {
                            if (e.key === 'Enter') handleImportFetch(clientName)
                            if (e.key === 'Escape') setImportInput(p => { const n = { ...p }; delete n[clientName]; return n })
                          }}
                          placeholder="Cole o link do Google Docs do mês…"
                          sx={{
                            flex: 1, background: 'rgba(0,0,0,0.4)', border: `1px solid ${ROT_COLOR}40`,
                            borderRadius: '6px', px: 1, py: 0.5, color: '#fff', fontSize: '0.6rem',
                            outline: 'none', '&:focus': { borderColor: ROT_COLOR },
                          }}
                        />
                        <Box onClick={() => handleImportFetch(clientName)}
                          sx={{ px: 0.9, py: 0.4, borderRadius: '6px', cursor: importLoading === clientName ? 'default' : 'pointer', fontSize: '0.6rem', fontWeight: 700,
                            background: importLoading === clientName ? 'rgba(255,255,255,0.05)' : `${ROT_COLOR}20`,
                            border: `1px solid ${ROT_COLOR}40`, color: ROT_COLOR, display: 'flex', alignItems: 'center',
                            '&:hover': { background: `${ROT_COLOR}35` }, transition: 'all 0.15s ease' }}>
                          {importLoading === clientName ? '…' : '↵'}
                        </Box>
                        <Box onClick={() => setImportInput(p => { const n = { ...p }; delete n[clientName]; return n })}
                          sx={{ px: 0.7, py: 0.4, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem',
                            color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                            '&:hover': { color: 'rgba(255,255,255,0.6)' }, transition: 'all 0.15s ease' }}>
                          ✕
                        </Box>
                      </Box>
                    )}

                    {/* Inline add form */}
                    {newForm?.open && (
                      <Box sx={{ mb: 1.2, p: 1.2, borderRadius: '10px', background: `${ROT_COLOR}07`, border: `1px solid ${ROT_COLOR}22`, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                        <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: ROT_COLOR }}>
                          + Novo roteiro
                        </Typography>
                        <Box component="input" autoFocus
                          value={newForm.title}
                          onChange={(e: { target: { value: string } }) => setNewForms(p => ({ ...p, [clientName]: { ...p[clientName], title: e.target.value } }))}
                          onKeyDown={(e: { key: string }) => { if (e.key === 'Escape') closeNewForm(clientName) }}
                          placeholder="Título do roteiro…"
                          sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid rgba(255,255,255,0.10)`, borderRadius: '6px',
                            px: 1, py: 0.5, color: '#fff', fontSize: '0.65rem', fontWeight: 600, outline: 'none', width: '100%', boxSizing: 'border-box',
                            '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s' }} />
                        <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                          {ALL_TYPES.map(tp => (
                            <Box key={tp} onClick={() => setNewForms(p => ({ ...p, [clientName]: { ...p[clientName], type: tp } }))}
                              sx={{ px: 0.8, py: 0.25, borderRadius: '5px', cursor: 'pointer', fontSize: '0.56rem', fontWeight: 700,
                                background: newForm.type === tp ? `${ROT_COLOR}25` : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${newForm.type === tp ? ROT_COLOR + '50' : 'rgba(255,255,255,0.07)'}`,
                                color: newForm.type === tp ? ROT_COLOR : 'rgba(255,255,255,0.35)',
                                transition: 'all 0.15s ease' }}>
                              {tp}
                            </Box>
                          ))}
                        </Box>
                        <Box component="input"
                          value={newForm.docsLink}
                          onChange={(e: { target: { value: string } }) => setNewForms(p => ({ ...p, [clientName]: { ...p[clientName], docsLink: e.target.value } }))}
                          placeholder="📄 Link do Docs — distribui automaticamente ao calendário"
                          sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${ROT_COLOR}22`, borderRadius: '6px',
                            px: 1, py: 0.5, color: '#fff', fontSize: '0.6rem', outline: 'none', width: '100%', boxSizing: 'border-box',
                            '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s' }} />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <Typography sx={{ fontSize: '0.52rem', color: '#C084FC', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                            Prazo:
                          </Typography>
                          <Box component="input" type="date"
                            value={newForm.deadline}
                            onChange={(e: { target: { value: string } }) => setNewForms(p => ({ ...p, [clientName]: { ...p[clientName], deadline: e.target.value } }))}
                            sx={{ flex: 1, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(192,132,252,0.22)', borderRadius: '6px',
                              px: 0.8, py: 0.4, color: newForm.deadline ? '#fff' : 'rgba(255,255,255,0.28)', fontSize: '0.6rem', outline: 'none',
                              '&:focus': { borderColor: '#C084FC' }, transition: 'border-color 0.15s', colorScheme: 'dark' }} />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          <Box onClick={() => closeNewForm(clientName)}
                            sx={{ px: 1, py: 0.4, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 600,
                              color: 'rgba(255,255,255,0.32)', border: '1px solid rgba(255,255,255,0.08)',
                              '&:hover': { color: '#fff' }, transition: 'all 0.15s ease' }}>
                            Cancelar
                          </Box>
                          <Box onClick={() => submitNewForm(clientName)}
                            sx={{ px: 1.2, py: 0.4, borderRadius: '6px', cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700,
                              background: newForm.title.trim() ? `linear-gradient(135deg, ${ROT_COLOR}, #f43f5e)` : 'rgba(255,255,255,0.06)',
                              color: newForm.title.trim() ? '#fff' : 'rgba(255,255,255,0.25)',
                              boxShadow: newForm.title.trim() ? `0 3px 10px ${ROT_COLOR}30` : 'none',
                              transition: 'all 0.15s ease' }}>
                            Adicionar
                          </Box>
                        </Box>
                      </Box>
                    )}

                    {/* Roteiro list */}
                    {list.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                        {list.map(r => {
                          const isSelected = selected.has(r.id)
                          const ed = expandedEdit[r.id]
                          const isExpanded = ed !== undefined
                          const hasLinks = !!(r.docsLink || r.driveLink)
                          const dlevel = r.deadline ? getRoteiroDeadlineLevel(r.deadline) : null
                          const dcolor = dlevel ? ROT_DEADLINE_COLOR[dlevel] : null
                          return (
                            <Box key={r.id}
                              onClick={selectMode ? () => toggleSelect(r.id) : undefined}
                              sx={{
                                px: 1.2, py: 0.8, borderRadius: '9px',
                                background: isSelected ? `${ROT_COLOR}10` : isExpanded ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.025)',
                                border: `1px solid ${isSelected ? ROT_COLOR + '35' : isExpanded ? ROT_COLOR + '28' : hasLinks ? 'rgba(251,113,133,0.16)' : 'rgba(255,255,255,0.05)'}`,
                                display: 'flex', flexDirection: 'column', gap: 0.5,
                                cursor: selectMode ? 'pointer' : 'default',
                                transition: 'all 0.15s ease',
                              }}>

                              {/* Main row */}
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                                {selectMode && (
                                  <Box sx={{ width: 15, height: 15, borderRadius: '4px', flexShrink: 0, mt: 0.1,
                                    border: `1.5px solid ${isSelected ? ROT_COLOR : 'rgba(255,255,255,0.22)'}`,
                                    background: isSelected ? `${ROT_COLOR}35` : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.48rem', color: ROT_COLOR, fontWeight: 900, transition: 'all 0.15s ease' }}>
                                    {isSelected && '✓'}
                                  </Box>
                                )}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#fff', lineHeight: 1.2 }} noWrap>
                                    {r.title || '(sem título)'}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1, mt: 0.1 }}>
                                    {r.type}
                                  </Typography>
                                </Box>
                                {!selectMode && !isExpanded && (
                                  <Box sx={{ display: 'flex', gap: 0.3, alignItems: 'center', flexShrink: 0 }}>
                                    {r.driveLink && (
                                      <Box component="a" href={r.driveLink} target="_blank" rel="noopener noreferrer"
                                        sx={{ px: 0.55, py: 0.2, borderRadius: '5px', textDecoration: 'none',
                                          background: 'rgba(59,142,255,0.10)', border: '1px solid rgba(59,142,255,0.22)', color: '#3B8EFF', fontSize: '0.6rem',
                                          '&:hover': { background: 'rgba(59,142,255,0.20)' }, transition: 'all 0.15s ease' }}>
                                        ☁️
                                      </Box>
                                    )}
                                    {r.docsLink && (
                                      <Box component="a" href={r.docsLink} target="_blank" rel="noopener noreferrer"
                                        sx={{ px: 0.55, py: 0.2, borderRadius: '5px', textDecoration: 'none',
                                          background: `${ROT_COLOR}12`, border: `1px solid ${ROT_COLOR}26`, color: ROT_COLOR, fontSize: '0.6rem',
                                          '&:hover': { background: `${ROT_COLOR}22` }, transition: 'all 0.15s ease' }}>
                                        📄
                                      </Box>
                                    )}
                                    {onUpdateRoteiro && (
                                      <Box onClick={() => openEdit(r)}
                                        sx={{ px: 0.5, py: 0.2, borderRadius: '5px', cursor: 'pointer', fontSize: '0.55rem',
                                          color: 'rgba(255,255,255,0.18)', border: '1px solid transparent',
                                          '&:hover': { color: ROT_COLOR, borderColor: `${ROT_COLOR}28`, bgcolor: `${ROT_COLOR}06` }, transition: 'all 0.15s ease' }}>
                                        ✏️
                                      </Box>
                                    )}
                                  </Box>
                                )}
                              </Box>

                              {/* Deadline badge */}
                              {dcolor && r.deadline && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, px: 0.6, py: 0.25, borderRadius: '5px',
                                  background: `${dcolor}10`, border: `1px solid ${dcolor}25`, width: 'fit-content' }}>
                                  <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: dcolor, flexShrink: 0 }} />
                                  <Typography sx={{ fontSize: '0.52rem', color: dcolor, fontWeight: 700, lineHeight: 1 }}>
                                    prazo: {getDeadlineLabel(r.deadline)}
                                  </Typography>
                                </Box>
                              )}

                              {/* Expanded edit panel */}
                              {isExpanded && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mt: 0.3, pt: 0.8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                    <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>Título</Typography>
                                    <Box component="input" autoFocus
                                      value={ed.title}
                                      onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], title: e.target.value } }))}
                                      onKeyDown={(e: { key: string }) => { if (e.key === 'Escape') closeEdit(r.id) }}
                                      sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid rgba(255,255,255,0.12)`, borderRadius: '6px',
                                        px: 1, py: 0.5, color: '#fff', fontSize: '0.65rem', fontWeight: 700, outline: 'none', width: '100%', boxSizing: 'border-box',
                                        '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s' }} />
                                  </Box>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                    <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>Tipo</Typography>
                                    <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                                      {ALL_TYPES.map(tp => (
                                        <Box key={tp} onClick={() => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], type: tp } }))}
                                          sx={{ px: 0.8, py: 0.3, borderRadius: '6px', cursor: 'pointer', fontSize: '0.58rem', fontWeight: 700,
                                            background: ed.type === tp ? `${ROT_COLOR}25` : 'rgba(255,255,255,0.04)',
                                            border: `1px solid ${ed.type === tp ? ROT_COLOR + '50' : 'rgba(255,255,255,0.08)'}`,
                                            color: ed.type === tp ? ROT_COLOR : 'rgba(255,255,255,0.4)',
                                            transition: 'all 0.15s ease' }}>
                                          {tp}
                                        </Box>
                                      ))}
                                    </Box>
                                  </Box>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                    <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>☁️ Drive</Typography>
                                    <Box component="input"
                                      value={ed.driveLink}
                                      onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], driveLink: e.target.value } }))}
                                      placeholder="https://drive.google.com/..."
                                      sx={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(59,142,255,0.2)', borderRadius: '6px',
                                        px: 1, py: 0.5, color: '#fff', fontSize: '0.6rem', outline: 'none', width: '100%', boxSizing: 'border-box',
                                        '&:focus': { borderColor: '#3B8EFF' }, transition: 'border-color 0.15s' }} />
                                  </Box>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                    <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>📄 Docs</Typography>
                                    <Box component="input"
                                      value={ed.docsLink}
                                      onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], docsLink: e.target.value } }))}
                                      placeholder="https://docs.google.com/document/d/..."
                                      sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${ROT_COLOR}25`, borderRadius: '6px',
                                        px: 1, py: 0.5, color: '#fff', fontSize: '0.6rem', outline: 'none', width: '100%', boxSizing: 'border-box',
                                        '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s' }} />
                                  </Box>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                    <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>🔗 Referências</Typography>
                                    <Box component="input"
                                      value={ed.refLink}
                                      onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], refLink: e.target.value } }))}
                                      placeholder="Link de referências usadas no roteiro..."
                                      sx={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(59,142,255,0.22)', borderRadius: '6px',
                                        px: 1, py: 0.5, color: '#fff', fontSize: '0.6rem', outline: 'none', width: '100%', boxSizing: 'border-box',
                                        '&:focus': { borderColor: '#3B8EFF' }, transition: 'border-color 0.15s' }} />
                                  </Box>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                    <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>🗓 Prazo</Typography>
                                    <Box component="input" type="date"
                                      value={ed.deadline}
                                      onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], deadline: e.target.value } }))}
                                      sx={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(192,132,252,0.25)', borderRadius: '6px',
                                        px: 1, py: 0.5, color: ed.deadline ? '#fff' : 'rgba(255,255,255,0.28)', fontSize: '0.6rem', outline: 'none', width: '100%', boxSizing: 'border-box',
                                        '&:focus': { borderColor: '#C084FC' }, transition: 'border-color 0.15s', colorScheme: 'dark' }} />
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 0.6, justifyContent: 'flex-end' }}>
                                    <Box onClick={() => closeEdit(r.id)}
                                      sx={{ px: 1.2, py: 0.5, borderRadius: '7px', cursor: 'pointer', fontSize: '0.62rem', fontWeight: 600,
                                        color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                                        '&:hover': { color: '#fff' }, transition: 'all 0.15s ease' }}>
                                      Cancelar
                                    </Box>
                                    <Box onClick={() => saveEdit(clientName, r.id)}
                                      sx={{ px: 1.2, py: 0.5, borderRadius: '7px', cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700,
                                        background: `linear-gradient(135deg, ${ROT_COLOR}, #f43f5e)`, color: '#fff',
                                        boxShadow: `0 3px 10px ${ROT_COLOR}35`, '&:hover': { filter: 'brightness(1.08)' }, transition: 'all 0.15s ease' }}>
                                      Salvar
                                    </Box>
                                  </Box>
                                </Box>
                              )}
                            </Box>
                          )
                        })}
                      </Box>
                    ) : (
                      !newForm?.open && (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 1.5, gap: 0.8 }}>
                          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)' }}>sem roteiros este mês</Typography>
                          {onAddRoteiro && (
                            <Box onClick={() => openNewForm(clientName)}
                              sx={{ px: 0.8, py: 0.3, borderRadius: '5px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
                                background: `${ROT_COLOR}10`, border: `1px solid ${ROT_COLOR}25`, color: ROT_COLOR,
                                '&:hover': { background: `${ROT_COLOR}20` }, transition: 'all 0.15s ease' }}>
                              + Adicionar
                            </Box>
                          )}
                        </Box>
                      )
                    )}
                  </Box>
                )
              })}
            </Box>
          )
        )}

        {/* ── TIMELINE VIEW ── */}
        {viewMode === 'timeline' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
            {timelineItems.withDeadline.length === 0 && timelineItems.withoutDeadline.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, gap: 1 }}>
                <Typography sx={{ fontSize: '1.5rem' }}>📅</Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.28)' }}>Nenhum roteiro em {MONTH_NAMES_ROT[viewMonth]}/{String(viewYear).slice(2)}</Typography>
              </Box>
            ) : (
              <>
                {timelineItems.withDeadline.map(({ roteiro: r, clientName }) => {
                  const level = getRoteiroDeadlineLevel(r.deadline!)
                  const color = ROT_DEADLINE_COLOR[level]
                  return (
                    <Box key={r.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2, px: 1.4, py: 1.1, borderRadius: '11px',
                      background: 'rgba(255,255,255,0.025)', border: `1px solid ${color}18`,
                      borderLeft: `3px solid ${color}`,
                      '&:hover': { background: 'rgba(255,255,255,0.04)' }, transition: 'background 0.15s' }}>
                      <Box sx={{ flexShrink: 0, textAlign: 'center', minWidth: 46, pt: 0.2 }}>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color, lineHeight: 1.1 }}>
                          {getDeadlineLabel(r.deadline!)}
                        </Typography>
                        <Typography sx={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1.4, mt: 0.1 }}>prazo</Typography>
                      </Box>
                      <Box sx={{ width: 1, alignSelf: 'stretch', bgcolor: `${color}20`, mx: 0.2, flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 0.25 }}>
                          <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255,255,255,0.90)', lineHeight: 1 }} noWrap>
                            {r.title || '(sem título)'}
                          </Typography>
                          <Box sx={{ px: 0.5, py: 0.12, borderRadius: '4px', bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                            <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.32)', fontWeight: 700, lineHeight: 1 }}>{r.type}</Typography>
                          </Box>
                        </Box>
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.38)', fontWeight: 600 }}>{clientName}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.3, flexShrink: 0 }}>
                        {r.docsLink && (
                          <Box component="a" href={r.docsLink} target="_blank" rel="noopener noreferrer"
                            sx={{ px: 0.6, py: 0.25, borderRadius: '5px', textDecoration: 'none',
                              background: `${ROT_COLOR}12`, border: `1px solid ${ROT_COLOR}28`, color: ROT_COLOR, fontSize: '0.6rem',
                              '&:hover': { background: `${ROT_COLOR}22` }, transition: 'all 0.15s ease' }}>
                            📄
                          </Box>
                        )}
                      </Box>
                    </Box>
                  )
                })}
                {timelineItems.withoutDeadline.length > 0 && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                      <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />
                      <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.22)', fontWeight: 600, px: 1 }}>sem prazo</Typography>
                      <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />
                    </Box>
                    {timelineItems.withoutDeadline.map(({ roteiro: r, clientName }) => (
                      <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, px: 1.4, py: 0.9, borderRadius: '9px',
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.22)', flexShrink: 0 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.65)' }} noWrap>{r.title}</Typography>
                          <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.32)' }}>{clientName} · {r.type}</Typography>
                        </Box>
                        {r.docsLink && (
                          <Box component="a" href={r.docsLink} target="_blank" rel="noopener noreferrer"
                            sx={{ px: 0.6, py: 0.2, borderRadius: '5px', textDecoration: 'none',
                              background: `${ROT_COLOR}10`, border: `1px solid ${ROT_COLOR}1e`, color: ROT_COLOR, fontSize: '0.56rem',
                              '&:hover': { background: `${ROT_COLOR}20` }, transition: 'all 0.15s ease' }}>
                            📄
                          </Box>
                        )}
                      </Box>
                    ))}
                  </>
                )}
              </>
            )}
          </Box>
        )}
      </Box>

      {/* Barra flutuante de exclusão em massa */}
      {selectMode && selected.size > 0 && (
        <Box sx={{
          position: 'sticky', bottom: 12, mx: 'auto', width: 'fit-content',
          display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1,
          background: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          zIndex: 10,
        }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>
            {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
          </Typography>
          <Box onClick={() => { onDeleteMany?.(Array.from(selected)); exitSelectMode() }}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.6, px: 1.2, py: 0.6, borderRadius: '8px', cursor: 'pointer',
              background: 'rgba(255,69,69,0.15)', border: '1px solid rgba(255,69,69,0.35)', color: '#FF4545',
              fontSize: '0.65rem', fontWeight: 700, '&:hover': { background: 'rgba(255,69,69,0.25)' }, transition: 'all 0.15s ease' }}>
            🗑 Excluir {selected.size}
          </Box>
          <Box onClick={exitSelectMode}
            sx={{ px: 1, py: 0.6, borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600,
              color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)',
              '&:hover': { color: '#fff' }, transition: 'all 0.15s ease' }}>
            Cancelar
          </Box>
        </Box>
      )}

      {/* Modal de confirmação de importação */}
      {importModal && (
        <Dialog open={importModal.open} onClose={() => setImportModal(null)}
          PaperProps={{ sx: { background: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', minWidth: 360, maxWidth: 500 } }}>
          <DialogTitle sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff', pb: 0.5 }}>
            📄 Importar roteiros do Google Docs
          </DialogTitle>
          <DialogContent sx={{ pb: 0 }}>
            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', mb: 1.5 }}>
              {importModal.clientName} · {MONTH_NAMES_ROT[viewMonth]}/{String(viewYear).slice(2)} · {importModal.items.filter(i => i.selected).length} de {importModal.items.length} selecionados
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 340, overflowY: 'auto', pr: 0.5 }}>
              {importModal.items.map((item, idx) => (
                <Box key={idx} onClick={() => setImportModal(prev => prev ? { ...prev, items: prev.items.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it) } : null)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.7, borderRadius: '8px', cursor: 'pointer',
                    background: item.selected ? `${ROT_COLOR}08` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${item.selected ? ROT_COLOR + '25' : 'rgba(255,255,255,0.05)'}`,
                    transition: 'all 0.15s ease' }}>
                  <Box sx={{ width: 14, height: 14, borderRadius: '4px', flexShrink: 0, border: `1.5px solid ${item.selected ? ROT_COLOR : 'rgba(255,255,255,0.2)'}`,
                    background: item.selected ? `${ROT_COLOR}30` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.5rem', color: ROT_COLOR, fontWeight: 900 }}>
                    {item.selected && '✓'}
                  </Box>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: item.selected ? '#fff' : 'rgba(255,255,255,0.45)', flex: 1 }} noWrap>
                    {item.title}
                  </Typography>
                  <Box sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', px: 0.6, py: 0.2, borderRadius: '4px', bgcolor: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
                    {item.type}
                  </Box>
                </Box>
              ))}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1.5, gap: 1 }}>
            <Box onClick={() => setImportModal(null)}
              sx={{ px: 1.5, py: 0.8, borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600,
                color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' }, transition: 'all 0.15s ease' }}>
              Cancelar
            </Box>
            <Box onClick={() => {
              const selected = importModal.items.filter(i => i.selected)
              if (selected.length && onImportBatch) {
                onImportBatch(importModal.clientName, selected.map(i => ({ title: i.title, type: i.type, docsLink: importModal.docsLink })), viewYear, viewMonth)
              }
              setImportModal(null)
            }}
              sx={{ px: 1.5, py: 0.8, borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700,
                background: `linear-gradient(135deg, ${ROT_COLOR}, #f43f5e)`, color: '#fff',
                boxShadow: `0 4px 14px ${ROT_COLOR}40`, '&:hover': { filter: 'brightness(1.08)' }, transition: 'all 0.2s ease' }}>
              Importar {importModal.items.filter(i => i.selected).length} roteiro{importModal.items.filter(i => i.selected).length !== 1 ? 's' : ''}
            </Box>
          </DialogActions>
        </Dialog>
      )}

      {/* Modal de edição completa do roteiro (Kanban) */}
      {kanbanEditTarget && expandedEdit[kanbanEditTarget.r.id] && (() => {
        const { clientName, r } = kanbanEditTarget
        const ed = expandedEdit[r.id]
        const st = r.status ?? 'ideia'
        const closeModal = () => { closeEdit(r.id); setKanbanEditId(null) }
        return (
          <Dialog open onClose={closeModal} maxWidth="sm" fullWidth
            PaperProps={{ sx: { background: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', backgroundImage: 'none' } }}>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }} noWrap>{clientName}</Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)' }}>
                    {MONTH_NAMES_ROT[viewMonth]}/{String(viewYear).slice(2)} · {ROTEIRO_STATUS_CFG[st].icon} {colLabel(st)}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={closeModal} sx={{ color: 'rgba(255,255,255,0.4)' }}>
                  <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>✕</Typography>
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 1.4 }}>
              {/* Status */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>Status</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {ROTEIRO_STATUS_FLOW.map(s => {
                    const cfg = ROTEIRO_STATUS_CFG[s]
                    const active = st === s
                    return (
                      <Box key={s} onClick={() => onUpdateRoteiro?.(clientName, r.id, { status: s })}
                        sx={{ px: 1, py: 0.4, borderRadius: '7px', cursor: 'pointer', fontSize: '0.62rem', fontWeight: active ? 800 : 600,
                          bgcolor: active ? `${cfg.color}25` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${active ? cfg.color : 'rgba(255,255,255,0.1)'}`,
                          color: active ? cfg.color : 'rgba(255,255,255,0.45)', transition: 'all 0.15s ease' }}>
                        {cfg.icon} {colLabel(s)}
                      </Box>
                    )
                  })}
                </Box>
              </Box>
              {/* Título */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>Título</Typography>
                <Box component="input" autoFocus value={ed.title}
                  onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], title: e.target.value } }))}
                  sx={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '7px', px: 1, py: 0.6, color: '#fff', fontSize: '0.72rem', fontWeight: 700, outline: 'none', width: '100%', boxSizing: 'border-box', '&:focus': { borderColor: ROT_COLOR } }} />
              </Box>
              {/* Tipo */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>Tipo</Typography>
                <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                  {ALL_TYPES.map(tp => (
                    <Box key={tp} onClick={() => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], type: tp } }))}
                      sx={{ px: 0.9, py: 0.35, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
                        background: ed.type === tp ? `${ROT_COLOR}25` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${ed.type === tp ? ROT_COLOR + '50' : 'rgba(255,255,255,0.08)'}`,
                        color: ed.type === tp ? ROT_COLOR : 'rgba(255,255,255,0.4)', transition: 'all 0.15s ease' }}>
                      {tp}
                    </Box>
                  ))}
                </Box>
              </Box>
              {/* Docs */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', flex: 1 }}>📄 Roteiro (Google Docs)</Typography>
                  {ed.docsLink.trim() && <Box component="a" href={ed.docsLink} target="_blank" rel="noopener noreferrer" sx={{ fontSize: '0.55rem', color: ROT_COLOR, textDecoration: 'none', fontWeight: 700 }}>abrir ↗</Box>}
                </Box>
                <Box component="input" value={ed.docsLink}
                  onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], docsLink: e.target.value } }))}
                  placeholder="https://docs.google.com/document/d/..."
                  sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${ROT_COLOR}25`, borderRadius: '7px', px: 1, py: 0.6, color: '#fff', fontSize: '0.62rem', outline: 'none', width: '100%', boxSizing: 'border-box', '&:focus': { borderColor: ROT_COLOR } }} />
              </Box>
              {/* Referências */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', flex: 1 }}>🔗 Referências usadas</Typography>
                  {ed.refLink.trim() && <Box component="a" href={ed.refLink} target="_blank" rel="noopener noreferrer" sx={{ fontSize: '0.55rem', color: '#3B8EFF', textDecoration: 'none', fontWeight: 700 }}>abrir ↗</Box>}
                </Box>
                <Box component="input" value={ed.refLink}
                  onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], refLink: e.target.value } }))}
                  placeholder="Link de referências / inspirações..."
                  sx={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(59,142,255,0.22)', borderRadius: '7px', px: 1, py: 0.6, color: '#fff', fontSize: '0.62rem', outline: 'none', width: '100%', boxSizing: 'border-box', '&:focus': { borderColor: '#3B8EFF' } }} />
              </Box>
              {/* Drive */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', flex: 1 }}>☁️ Drive (material)</Typography>
                  {ed.driveLink.trim() && <Box component="a" href={ed.driveLink} target="_blank" rel="noopener noreferrer" sx={{ fontSize: '0.55rem', color: '#00C47A', textDecoration: 'none', fontWeight: 700 }}>abrir ↗</Box>}
                </Box>
                <Box component="input" value={ed.driveLink}
                  onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], driveLink: e.target.value } }))}
                  placeholder="https://drive.google.com/..."
                  sx={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(0,196,122,0.22)', borderRadius: '7px', px: 1, py: 0.6, color: '#fff', fontSize: '0.62rem', outline: 'none', width: '100%', boxSizing: 'border-box', '&:focus': { borderColor: '#00C47A' } }} />
              </Box>
              {/* Prazo */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>🗓 Prazo de entrega</Typography>
                <Box component="input" type="date" value={ed.deadline}
                  onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], deadline: e.target.value } }))}
                  sx={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(192,132,252,0.25)', borderRadius: '7px', px: 1, py: 0.6, color: ed.deadline ? '#fff' : 'rgba(255,255,255,0.28)', fontSize: '0.62rem', outline: 'none', width: '100%', boxSizing: 'border-box', '&:focus': { borderColor: '#C084FC' }, colorScheme: 'dark' }} />
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 2, py: 1.4, gap: 1 }}>
              {onDeleteMany && (
                <Box onClick={() => { onDeleteMany([r.id]); closeModal() }}
                  sx={{ px: 1.2, py: 0.6, borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700,
                    background: 'rgba(255,69,69,0.12)', border: '1px solid rgba(255,69,69,0.3)', color: '#FF4545',
                    '&:hover': { background: 'rgba(255,69,69,0.22)' }, transition: 'all 0.15s ease' }}>
                  🗑 Excluir
                </Box>
              )}
              <Box sx={{ flex: 1 }} />
              <Box onClick={closeModal}
                sx={{ px: 1.4, py: 0.6, borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600,
                  color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', '&:hover': { color: '#fff' }, transition: 'all 0.15s ease' }}>
                Cancelar
              </Box>
              <Box onClick={() => { saveEdit(clientName, r.id); setKanbanEditId(null) }}
                sx={{ px: 1.6, py: 0.6, borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 800,
                  background: 'linear-gradient(135deg, #ff9039, #ff5339)', color: '#000',
                  boxShadow: '0 4px 14px rgba(255,144,57,0.3)', '&:hover': { filter: 'brightness(1.08)' }, transition: 'all 0.15s ease' }}>
                Salvar
              </Box>
            </DialogActions>
          </Dialog>
        )
      })()}

      {/* Confirmação de limpeza de roteiros */}
      {clearConfirm && (
        <Dialog open onClose={() => setClearConfirm(null)}
          PaperProps={{ sx: { background: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,69,69,0.2)', borderRadius: '20px', minWidth: 340, maxWidth: 440 } }}>
          <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', pb: 0.5 }}>
            {clearConfirm === 'month' ? '🧹 Limpar roteiros do mês' : '🗑 Apagar TODOS os roteiros'}
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
              {clearConfirm === 'month' ? (
                <>Isso vai apagar os <b style={{ color: '#FF8A45' }}>{monthRoteiroIds.length} roteiros de {MONTH_NAMES_ROT[viewMonth]}/{String(viewYear).slice(2)}</b> (todos os clientes). Os outros meses não são afetados.</>
              ) : (
                <>Isso vai apagar <b style={{ color: '#FF4545' }}>TODOS os {allRoteiroIds.length} roteiros</b> de todos os meses e clientes. Use para recomeçar do zero, organizado.</>
              )}
            </Typography>
            <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.32)', mt: 1 }}>
              Esta ação não pode ser desfeita.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1, gap: 1 }}>
            <Box onClick={() => setClearConfirm(null)}
              sx={{ px: 1.5, py: 0.8, borderRadius: '8px', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600,
                color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)', '&:hover': { color: '#fff' }, transition: 'all 0.15s ease' }}>
              Cancelar
            </Box>
            <Box onClick={confirmClear}
              sx={{ px: 1.6, py: 0.8, borderRadius: '8px', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 800,
                background: clearConfirm === 'month' ? 'linear-gradient(135deg, #FF8A45, #f4663f)' : 'linear-gradient(135deg, #FF4545, #d92020)',
                color: '#fff', boxShadow: '0 4px 14px rgba(255,69,69,0.35)', '&:hover': { filter: 'brightness(1.08)' }, transition: 'all 0.15s ease' }}>
              {clearConfirm === 'month' ? `Apagar ${monthRoteiroIds.length} do mês` : `Apagar tudo (${allRoteiroIds.length})`}
            </Box>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  )
}

// ─────────────────────────────────────────────────────────────

const BOARDS = [
  { label: 'Vídeo',    emoji: '🎬', color: '#60A5FA', cols: VIDEO_COLS,  key: 'vid', desc: 'Reels e Stories — produção audiovisual' },
  { label: 'Design',   emoji: '🎨', color: '#C084FC', cols: DESIGN_COLS, key: 'des', desc: 'Posts, Carrosseis e Feed — criação visual' },
  { label: 'Feed',     emoji: '📸', color: '#F97316', cols: FEED_COLS,   key: 'fed', desc: 'Fotos e imagens da empresa' },
  { label: 'Social',   emoji: '📱', color: '#00C47A', cols: SOCIAL_COLS, key: 'soc', desc: 'Conteúdos prontos para publicar' },
  { label: 'Roteiros', emoji: '📝', color: '#FB7185', cols: [],          key: 'rot', desc: 'Scripts e links para todos os colaboradores' },
  { label: 'Inbox',    emoji: '📥', color: '#ff9039', cols: [],          key: 'drv', desc: 'Vídeos recebidos via Google Drive' },
]

// ── Delay helpers ─────────────────────────────────────────

type DelayLevel = 'ok' | 'today' | 'warning' | 'critical'

function getDelayLevel(dt: Date, status: Status, deliveryDt?: number): DelayLevel {
  if (status === 7 || status === 5) return 'ok'
  const withEditor = status === 0 || status === 1 || status === 6
  const refMs = (withEditor && deliveryDt)
    ? new Date(deliveryDt).setHours(0, 0, 0, 0)
    : new Date(dt).setHours(0, 0, 0, 0)
  const todayMs = new Date().setHours(0, 0, 0, 0)
  const diff = Math.round((refMs - todayMs) / 86400000)
  if (diff > 0)   return 'ok'
  if (diff === 0) return 'today'
  if (diff >= -3) return 'warning'
  return 'critical'
}

const DELAY_BORDER: Record<DelayLevel, string> = {
  ok:       'rgba(255,255,255,0.07)',
  today:    'rgba(255,215,0,0.22)',
  warning:  'rgba(255,120,50,0.28)',
  critical: 'rgba(255,59,48,0.32)',
}

const DELAY_DOT: Record<DelayLevel, string> = {
  ok:       'rgba(255,255,255,0.20)',
  today:    '#FFD700',
  warning:  '#FF7832',
  critical: '#FF3B30',
}

function getDateLabel(dt: Date) {
  const todayMs = new Date().setHours(0, 0, 0, 0)
  const diff = Math.round((new Date(dt).setHours(0, 0, 0, 0) - todayMs) / 86400000)
  if (diff < 0)  return `${Math.abs(diff)}d atraso`
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  return new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ── Mini card ─────────────────────────────────────────────

function MiniCard({ item, state, isDragging, colColor, isSelected, bulkMode, onSelect, onEdit, onView, onRemind, staggerIndex = 0 }: {
  item: ContentItem
  state: ItemState
  isDragging?: boolean
  colColor: string
  isSelected?: boolean
  bulkMode?: boolean
  onSelect?: () => void
  onEdit?: () => void
  onView?: () => void
  onRemind?: () => void
  staggerIndex?: number
}) {
  const [hover, setHover] = useState(false)

  const withEditor = state.status === 0 || state.status === 1 || state.status === 6
  const delay = getDelayLevel(item.dt, state.status, state.deliveryDate)

  const pubLabel = getDateLabel(item.dt)
  const deliveryLabel = state.deliveryDate ? getDateLabel(new Date(state.deliveryDate)) : null
  const showDelivery = withEditor && !!state.deliveryDate
  const activeLabel = showDelivery ? `📥 ${deliveryLabel}` : pubLabel

  const resp = state.responsible ? NAME_MAP[state.responsible] : null

  return (
    <Paper
      elevation={0}
      onClick={bulkMode ? onSelect : (onView ? onView : undefined)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      sx={{
        px: 1.6, pt: 1.3, pb: 1.2,
        borderRadius: '12px',
        bgcolor: isDragging ? `${colColor}0c` : isSelected ? `${colColor}10` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isSelected ? colColor + '55' : DELAY_BORDER[delay]}`,
        outline: isSelected ? `2px solid ${colColor}40` : '2px solid transparent',
        opacity: isDragging ? 0.4 : 1,
        cursor: bulkMode ? 'pointer' : (onView ? 'pointer' : 'grab'),
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 72,
        transition: 'border 0.15s, background-color 0.15s, transform 0.18s ease, box-shadow 0.18s ease',
        animation: isDragging ? undefined : `fadeInUp 0.22s cubic-bezier(0.16,1,0.3,1) ${Math.min(staggerIndex * 25, 300)}ms both`,
        '&::before': {
          content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          bgcolor: colColor, borderRadius: '12px 0 0 12px',
        },
        '&:hover': {
          transform: isDragging ? undefined : 'translateY(-2px)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
          bgcolor: bulkMode ? `${colColor}12` : 'rgba(255,255,255,0.05)',
          border: `1px solid ${isSelected ? colColor + '66' : delay !== 'ok' ? DELAY_BORDER[delay] : colColor + '38'}`,
        },
      }}
    >
      {/* Bulk checkbox */}
      {bulkMode && (
        <Box sx={{
          position: 'absolute', top: 7, right: 7, zIndex: 10,
          width: 15, height: 15, borderRadius: '4px',
          bgcolor: isSelected ? colColor : 'rgba(255,255,255,0.09)',
          border: `1.5px solid ${isSelected ? colColor : 'rgba(255,255,255,0.20)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isSelected && <Typography sx={{ fontSize: '0.48rem', color: '#000', lineHeight: 1, fontWeight: 900 }}>✓</Typography>}
        </Box>
      )}

      {/* Edit button — visible on hover */}
      {!bulkMode && hover && onEdit && (
        <Box
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onEdit() }}
          sx={{
            position: 'absolute', top: 5, right: onRemind && state.status === 4 ? 33 : 5, zIndex: 10,
            width: 24, height: 24, borderRadius: '7px', cursor: 'pointer',
            bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
          }}
        >
          <EditIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.60)' }} />
        </Box>
      )}

      {/* Remind button — visible on hover, only for status 4 */}
      {!bulkMode && hover && onRemind && state.status === 4 && state.approvalToken && (
        <Box
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onRemind() }}
          sx={{
            position: 'absolute', top: 5, right: 5, zIndex: 10,
            width: 24, height: 24, borderRadius: '7px', cursor: 'pointer',
            bgcolor: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: 'rgba(37,211,102,0.28)' },
          }}
        >
          <WhatsAppIcon sx={{ fontSize: 12, color: '#25D366' }} />
        </Box>
      )}

      {/* Top row: type emoji + client */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, pr: !bulkMode && onEdit ? 3.2 : 0 }}>
        <Typography sx={{ fontSize: '0.62rem', lineHeight: 1, opacity: 0.5, flexShrink: 0 }}>
          {TYPE_EMOJI[item.tp] ?? ''}
        </Typography>
        <Typography sx={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.48)', fontWeight: 600, flex: 1, lineHeight: 1 }} noWrap>
          {item.c}
        </Typography>
        {state.priority === 'alta' && (
          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#FF3B30', flexShrink: 0, opacity: 0.9 }} />
        )}
        {state.priority === 'media' && (
          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#FFD700', flexShrink: 0, opacity: 0.8 }} />
        )}
      </Box>

      {/* Title */}
      <Typography sx={{
        fontSize: { md: '0.8rem', xl: '0.88rem' },
        fontWeight: 700,
        color: 'rgba(255,255,255,0.90)',
        lineHeight: 1.35,
        mb: 0.85,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {state.title || item.n}
      </Typography>

      {/* Bottom row: delay dot + date + secondary date + responsible */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 'auto' }}>
        <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: DELAY_DOT[delay], flexShrink: 0 }} />
        <Typography sx={{
          fontSize: '0.6rem', lineHeight: 1, flex: 1,
          color: delay === 'ok' ? 'rgba(255,255,255,0.30)' : DELAY_DOT[delay],
          fontWeight: delay === 'ok' ? 400 : 700,
        }}>
          {activeLabel}
        </Typography>
        {showDelivery && (
          <Typography sx={{ fontSize: '0.54rem', color: 'rgba(255,255,255,0.20)', lineHeight: 1, mr: 0.2 }}>
            🚀 {pubLabel}
          </Typography>
        )}
        {/* SLA: days waiting at client */}
        {state.status === 4 && state.sentToClientAt && (() => {
          const days = Math.floor((Date.now() - state.sentToClientAt) / 86400000)
          if (days < 1) return null
          const color = days >= 3 ? '#FF3B30' : days >= 2 ? '#FFD700' : '#FF9A3D'
          return (
            <Box sx={{ px: 0.6, py: 0.15, borderRadius: '4px', flexShrink: 0,
              bgcolor: `${color}12`, border: `1px solid ${color}30` }}>
              <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, color, lineHeight: 1 }}>
                {days}d c/ cli
              </Typography>
            </Box>
          )
        })()}
        {resp && (
          <Tooltip title={`${resp.emoji} ${state.responsible} · ${resp.role}`}>
            <Box sx={{
              flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
              bgcolor: `${resp.color}20`, border: `1.5px solid ${resp.color}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.6rem', lineHeight: 1,
            }}>
              {resp.emoji}
            </Box>
          </Tooltip>
        )}
      </Box>
    </Paper>
  )
}

// ── Persistence helpers (order + col names) ───────────────

function loadColOrder(boardKey: string): Record<number, number[]> {
  try { return JSON.parse(localStorage.getItem(`sm_col_order_${boardKey}`) ?? '{}') } catch { return {} }
}
function saveColOrder(boardKey: string, o: Record<number, number[]>) {
  localStorage.setItem(`sm_col_order_${boardKey}`, JSON.stringify(o))
}
function loadColNames(boardKey: string): Record<number, string> {
  try { return JSON.parse(localStorage.getItem(`sm_col_names_${boardKey}`) ?? '{}') } catch { return {} }
}
function saveColNames(boardKey: string, n: Record<number, string>) {
  localStorage.setItem(`sm_col_names_${boardKey}`, JSON.stringify(n))
}

// ── Sortable card wrapper (drag + drop) ───────────────────

function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <Box ref={setNodeRef} {...listeners} {...attributes}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 999 : undefined,
        position: 'relative',
        opacity: isDragging ? 0.35 : 1,
        willChange: isDragging ? 'transform' : undefined,
      }}>
      {children}
    </Box>
  )
}

// ── Droppable column zone ─────────────────────────────────

function DropCol({ colId, color, children }: { colId: string; color: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: colId })
  return (
    <Box ref={setNodeRef} sx={{
      flex: 1, display: 'flex', flexDirection: 'column', gap: 1.2, p: 0.5,
      borderRadius: 1.5, minHeight: 120,
      border: `1px dashed ${isOver ? color + '88' : 'transparent'}`,
      bgcolor: isOver ? `${color}10` : 'transparent',
      transition: 'border 0.1s, background-color 0.1s',
      boxShadow: isOver ? `inset 0 0 0 1px ${color}40` : 'none',
    }}>
      {children}
    </Box>
  )
}

// ── Mini Kanban board ─────────────────────────────────────

interface MiniKanbanProps {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, s: Status) => void
  onEdit?: (id: number) => void
  onView?: (id: number) => void
  columns: ColDef[]
  filterFn: (item: ContentItem, state: ItemState) => boolean
  filterClient: string
  bulkMode: boolean
  bulkSelected: Set<number>
  onBulkToggle: (id: number) => void
  boardKey: string
  onSendToClient?: (id: number, clientName: string) => void
  onRemindClient?: (id: number, clientName: string) => void
}

function MiniKanban({
  items, states, onStatusChange, onEdit, onView, columns, filterFn,
  filterClient, bulkMode, bulkSelected, onBulkToggle, boardKey, onSendToClient, onRemindClient,
}: MiniKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  // ── Ordem manual por coluna (persistida) ──────────────
  const [manualOrder, setManualOrder] = useState<Record<number, number[]>>(() => loadColOrder(boardKey))

  // ── Nomes customizados por coluna ─────────────────────
  const [colNames, setColNames] = useState<Record<number, string>>(() => loadColNames(boardKey))

  // ── Estado do menu da coluna ──────────────────────────
  const colMenuRef = useRef<HTMLElement | null>(null)
  const [colMenuStatus, setColMenuStatus] = useState<number | null>(null)
  const [renamingStatus, setRenamingStatus] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)

  // ── Item 4: Confirm send to client ────────────────────
  const [sendConfirmDrag, setSendConfirmDrag] = useState<{
    activeItemId: number; activeStatus: Status; overCardId: number | null; clientName: string
  } | null>(null)

  // ── Item 5: Published column limit ────────────────────
  const [showAllPublished, setShowAllPublished] = useState(false)
  const PUBLISHED_LIMIT = 50

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } }),
    // Mobile: long-press (segurar ~200ms) levanta o card pra arrastar; toque/deslize rápido = rolagem.
    // delay curto demais (era 100ms) cancelava o arraste e virava rolagem no celular.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const hits = pointerWithin(args)
    const colHits = hits.filter(({ id }) => String(id).startsWith(`${boardKey}-col-`))
    if (colHits.length > 0) return colHits
    return closestCenter(args)
  }, [boardKey])

  const boardItems = useMemo(() => {
    return items.filter(item => {
      if (filterClient !== 'all' && item.c !== filterClient) return false
      const st = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
      return filterFn(item, st)
    })
  }, [items, states, filterFn, filterClient])

  // byStatus: atrasados sempre antes de futuros; dentro de cada grupo, respeita manualOrder ou data asc
  const byStatus = useMemo(() => {
    const todayMs = new Date().setHours(0, 0, 0, 0)
    const map: Record<number, ContentItem[]> = {}
    columns.forEach(c => { map[c.status] = [] })
    boardItems.forEach(item => {
      const st = states[item.i]?.status ?? item.s
      if (map[st] !== undefined) map[st].push(item)
    })
    Object.keys(map).forEach(k => {
      const status = Number(k)
      const order = manualOrder[status]
      const orderIdx = order && order.length > 0 ? new Map(order.map((id, i) => [id, i])) : null
      map[status].sort((a, b) => {
        const aMs = new Date(a.dt).setHours(0, 0, 0, 0)
        const bMs = new Date(b.dt).setHours(0, 0, 0, 0)
        const aLate = aMs < todayMs
        const bLate = bMs < todayMs
        // Atrasado sempre antes de futuro — ignora ordem manual para esta separação
        if (aLate && !bLate) return -1
        if (!aLate && bLate) return 1
        // Dentro do mesmo grupo: manual order se existir
        if (orderIdx) {
          const ai = orderIdx.has(a.i) ? orderIdx.get(a.i)! : Infinity
          const bi = orderIdx.has(b.i) ? orderIdx.get(b.i)! : Infinity
          if (ai !== bi) return ai - bi
        }
        // Sem manual ou empatado: data crescente
        return aMs - bMs
      })
    })
    return map
  }, [boardItems, states, columns, manualOrder])

  const activeItem = useMemo(() => activeId ? items.find(i => String(i.i) === activeId) ?? null : null, [activeId, items])
  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return

    const activeItemId = Number(active.id)
    const overId = String(over.id)
    const activeItemObj = items.find(i => i.i === activeItemId)
    if (!activeItemObj) return
    const activeStatus = states[activeItemId]?.status ?? activeItemObj.s

    let targetStatus: Status = activeStatus
    let overCardId: number | null = null

    if (overId.startsWith(`${boardKey}-col-`)) {
      // Dropped on the column zone (empty space)
      targetStatus = Number(overId.replace(`${boardKey}-col-`, '')) as Status
    } else {
      // Dropped on another card
      const overItemId = Number(overId)
      if (!isNaN(overItemId)) {
        const overItemObj = items.find(i => i.i === overItemId)
        if (overItemObj) {
          targetStatus = states[overItemId]?.status ?? overItemObj.s
          overCardId = overItemId
        }
      }
    }

    if (targetStatus !== activeStatus) {
      // ── Mover para outra coluna ──────────────────────

      // Item 4: Confirm before sending to client
      if (targetStatus === 4 && onSendToClient) {
        const it = items.find(i => i.i === activeItemId)
        if (it) {
          setSendConfirmDrag({ activeItemId, activeStatus, overCardId, clientName: it.c })
          return
        }
      }

      onStatusChange(activeItemId, targetStatus)
      setManualOrder(prev => {
        const srcItems = byStatus[activeStatus] ?? []
        const dstItems = byStatus[targetStatus] ?? []
        const srcOrder = (prev[activeStatus] ?? srcItems.map(i => i.i)).filter(id => id !== activeItemId)
        let dstOrder = (prev[targetStatus] ?? dstItems.map(i => i.i)).filter(id => id !== activeItemId)
        if (overCardId !== null) {
          const idx = dstOrder.indexOf(overCardId)
          if (idx !== -1) {
            dstOrder = [...dstOrder.slice(0, idx), activeItemId, ...dstOrder.slice(idx)]
          } else {
            dstOrder = [...dstOrder, activeItemId]
          }
        } else {
          dstOrder = [...dstOrder, activeItemId]
        }
        const next = { ...prev, [activeStatus]: srcOrder, [targetStatus]: dstOrder }
        saveColOrder(boardKey, next)
        return next
      })
    } else if (overCardId !== null && overCardId !== activeItemId) {
      // ── Reordenar dentro da mesma coluna ──────────────
      setManualOrder(prev => {
        const colItems = byStatus[activeStatus] ?? []
        const currentOrder = prev[activeStatus] ?? colItems.map(i => i.i)
        const oldIdx = currentOrder.indexOf(activeItemId)
        const newIdx = currentOrder.indexOf(overCardId!)
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return prev
        const next = { ...prev, [activeStatus]: arrayMove(currentOrder, oldIdx, newIdx) }
        saveColOrder(boardKey, next)
        return next
      })
    }
  }, [states, items, byStatus, onStatusChange, boardKey, onSendToClient])

  // ── Ordenar coluna por data (trigger manual) ──────────
  const sortColByDate = useCallback((status: number, dir: 'asc' | 'desc') => {
    const todayMs = new Date().setHours(0, 0, 0, 0)
    const colItems = [...(byStatus[status] ?? [])]
    colItems.sort((a, b) => {
      const aMs = new Date(a.dt).setHours(0, 0, 0, 0)
      const bMs = new Date(b.dt).setHours(0, 0, 0, 0)
      const aOver = aMs < todayMs; const bOver = bMs < todayMs
      if (dir === 'asc') {
        if (aOver && !bOver) return -1
        if (!aOver && bOver) return 1
        return aMs - bMs
      }
      return bMs - aMs
    })
    const newOrder = colItems.map(i => i.i)
    setManualOrder(prev => {
      const next = { ...prev, [status]: newOrder }
      saveColOrder(boardKey, next)
      return next
    })
    setColMenuStatus(null)
  }, [byStatus, boardKey])

  // ── Item 4: Confirm send handler ─────────────────────
  const handleConfirmDragSend = useCallback((confirmed: boolean) => {
    if (!sendConfirmDrag) return
    const { activeItemId, activeStatus, overCardId, clientName } = sendConfirmDrag
    const targetStatus = 4 as Status
    if (confirmed) {
      onStatusChange(activeItemId, targetStatus)
      onSendToClient?.(activeItemId, clientName)
      setManualOrder(prev => {
        const srcItems = byStatus[activeStatus] ?? []
        const dstItems = byStatus[targetStatus] ?? []
        const srcOrder = (prev[activeStatus] ?? srcItems.map(i => i.i)).filter(id => id !== activeItemId)
        let dstOrder = (prev[targetStatus] ?? dstItems.map(i => i.i)).filter(id => id !== activeItemId)
        if (overCardId !== null) {
          const idx = dstOrder.indexOf(overCardId)
          dstOrder = idx !== -1
            ? [...dstOrder.slice(0, idx), activeItemId, ...dstOrder.slice(idx)]
            : [...dstOrder, activeItemId]
        } else {
          dstOrder = [...dstOrder, activeItemId]
        }
        const next = { ...prev, [activeStatus]: srcOrder, [targetStatus]: dstOrder }
        saveColOrder(boardKey, next)
        return next
      })
    }
    setSendConfirmDrag(null)
  }, [sendConfirmDrag, onStatusChange, onSendToClient, byStatus, boardKey])

  // ── Renomear coluna ───────────────────────────────────
  const applyRename = useCallback(() => {
    if (renamingStatus === null || !renameValue.trim()) { setRenamingStatus(null); return }
    const next = { ...colNames, [renamingStatus]: renameValue.trim() }
    setColNames(next)
    saveColNames(boardKey, next)
    setRenamingStatus(null)
  }, [renamingStatus, renameValue, colNames, boardKey])

  const today = new Date(); today.setHours(0, 0, 0, 0)

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Box sx={{ display: 'flex', gap: 2, height: '100%', minWidth: 'max-content' }}>
        {columns.map(col => {
          const colItems = byStatus[col.status] ?? []
          const displayName = colNames[col.status] || col.label
          const lateCount = colItems.filter(i => {
            const dt = new Date(i.dt); dt.setHours(0, 0, 0, 0)
            return dt < today && col.status !== 5 && col.status !== 7
          }).length
          // Item 5: Publicado — limit 50
          const isPublishedCol = col.status === 7
          const displayItems = isPublishedCol && !showAllPublished && colItems.length > PUBLISHED_LIMIT
            ? colItems.slice(colItems.length - PUBLISHED_LIMIT)
            : colItems

          return (
            <Box key={col.status} sx={{ flex: '0 0 290px', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
              {/* Column header */}
              <Box className="col-header" sx={{
                display: 'flex', alignItems: 'center', gap: 1, mb: 1.5,
                px: 1.5, py: 1.1, borderRadius: '12px',
                bgcolor: `${col.color}0d`, border: `1px solid ${col.color}30`,
                borderTop: `3px solid ${col.color}`,
                flexShrink: 0,
                position: 'relative',
                '&:hover .col-menu-btn': { opacity: 1 },
                '&:hover .col-sort-btn': { opacity: 0.7 },
              }}>
                <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: col.color, flexShrink: 0, boxShadow: `0 0 7px ${col.color}` }} />

                {/* Nome da coluna */}
                <Typography sx={{ fontSize: { md: '0.78rem', xl: '0.85rem' }, fontWeight: 800, color: col.color, flex: 1, lineHeight: 1, letterSpacing: '-0.01em' }} noWrap>
                  {displayName}
                </Typography>

                <Badge badgeContent={lateCount || undefined} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.5rem', minWidth: 14, height: 14, top: -2, right: -2 } }}>
                  <Box sx={{ minWidth: 24, height: 20, px: 0.8, borderRadius: 3, bgcolor: `${col.color}25`, border: `1px solid ${col.color}45`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography key={colItems.length} sx={{
                      fontSize: '0.68rem', fontWeight: 900, color: col.color, lineHeight: 1,
                      '@keyframes counterPop': {
                        '0%':   { transform: 'scale(0.5)', opacity: 0.4 },
                        '70%':  { transform: 'scale(1.25)' },
                        '100%': { transform: 'scale(1)',   opacity: 1 },
                      },
                      animation: 'counterPop 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                    }}>{colItems.length}</Typography>
                  </Box>
                </Badge>

                {/* Item 10: Quick sort icon */}
                <Tooltip title="Ordenar por data" placement="top">
                  <IconButton
                    size="small"
                    onClick={() => sortColByDate(col.status, 'asc')}
                    sx={{
                      p: 0.3, opacity: 0, transition: 'opacity 0.15s',
                      color: `${col.color}70`,
                      '&:hover': { color: col.color, bgcolor: `${col.color}14` },
                      '.col-header:hover &': { opacity: 0.6 },
                    }}
                    className="col-sort-btn"
                  >
                    <SortIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                </Tooltip>

                {/* Menu da coluna */}
                <IconButton
                  className="col-menu-btn"
                  size="small"
                  onClick={e => { colMenuRef.current = e.currentTarget; setColMenuStatus(col.status) }}
                  sx={{
                    p: 0.3, opacity: 0, transition: 'opacity 0.15s',
                    color: `${col.color}99`,
                    '&:hover': { color: col.color, bgcolor: `${col.color}14` },
                  }}
                >
                  <MoreVertIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>

              {/* Cards com scroll fade */}
              <Box sx={{ overflowY: 'auto', flex: 1, position: 'relative',
                '&::-webkit-scrollbar': { width: 3 },
                '&::-webkit-scrollbar-thumb': { bgcolor: `${col.color}40`, borderRadius: 2 },
              }}>
                <SortableContext items={displayItems.map(i => String(i.i))} strategy={verticalListSortingStrategy}>
                  <DropCol colId={`${boardKey}-col-${col.status}`} color={col.color}>
                    {displayItems.map((item, idx) => {
                      const st = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
                      const isSelected = bulkSelected.has(item.i)
                      const card = (
                        <MiniCard
                          item={item} state={st}
                          isDragging={activeId === String(item.i)}
                          colColor={col.color}
                          isSelected={isSelected}
                          staggerIndex={idx}
                          bulkMode={bulkMode}
                          onSelect={() => onBulkToggle(item.i)}
                          onEdit={onEdit ? () => onEdit(item.i) : undefined}
                          onView={onView ? () => onView(item.i) : undefined}
                          onRemind={onRemindClient ? () => onRemindClient(item.i, item.c) : undefined}
                        />
                      )
                      return bulkMode ? (
                        <Box key={item.i}>{card}</Box>
                      ) : (
                        <SortableCard key={item.i} id={String(item.i)}>{card}</SortableCard>
                      )
                    })}
                    {colItems.length === 0 && (
                      <Box sx={{
                        py: 4, textAlign: 'center', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 0.8,
                      }}>
                        <Box sx={{
                          width: 32, height: 32, borderRadius: '10px',
                          border: `1.5px dashed ${col.color}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: `${col.color}40`,
                          fontSize: '0.8rem',
                        }}>✦</Box>
                        <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.13)', fontWeight: 600, letterSpacing: '0.04em' }}>
                          Vazio
                        </Typography>
                      </Box>
                    )}
                    {/* Item 5: Ver todos button for Publicado */}
                    {isPublishedCol && colItems.length > PUBLISHED_LIMIT && (
                      <Box
                        onClick={() => setShowAllPublished(v => !v)}
                        sx={{
                          mt: 0.5, py: 1, textAlign: 'center', cursor: 'pointer', borderRadius: '10px',
                          border: `1px dashed ${col.color}30`,
                          bgcolor: showAllPublished ? `${col.color}08` : 'transparent',
                          transition: 'all 0.15s ease',
                          '&:hover': { bgcolor: `${col.color}12`, borderColor: `${col.color}50` },
                        }}
                      >
                        <Typography sx={{ fontSize: '0.62rem', color: `${col.color}99`, fontWeight: 700, letterSpacing: '0.04em' }}>
                          {showAllPublished
                            ? `↑ Ver menos (${PUBLISHED_LIMIT} recentes)`
                            : `↓ Ver todos — +${colItems.length - PUBLISHED_LIMIT} ocultos`}
                        </Typography>
                      </Box>
                    )}
                  </DropCol>
                </SortableContext>
              </Box>
            </Box>
          )
        })}
      </Box>

      {!bulkMode && (
        <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={{ duration: 140, easing: 'ease-out' }}>
          {activeItem && (() => {
            const st = states[activeItem.i] ?? { status: activeItem.s, title: '', link: '', caption: '', notes: '' }
            const col = columns.find(c => c.status === (st.status ?? activeItem.s)) ?? columns[0]
            return (
              <Box sx={{ opacity: 0.92, cursor: 'grabbing', pointerEvents: 'none' }}>
                <MiniCard item={activeItem} state={st} colColor={col.color} />
              </Box>
            )
          })()}
        </DragOverlay>
      )}

      {/* ── Menu flutuante da coluna ──────────────────────── */}
      <Menu
        open={colMenuStatus !== null}
        anchorEl={colMenuRef.current}
        onClose={() => setColMenuStatus(null)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'rgba(18,18,18,0.98)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2,
              minWidth: 200,
            }
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {colMenuStatus !== null && (() => {
          const col = columns.find(c => c.status === colMenuStatus)!
          const displayName = colNames[colMenuStatus] || col?.label || ''
          return [
            <Box key="header" sx={{ px: 1.8, py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                Coluna: {displayName}
              </Typography>
            </Box>,
            <MenuItem key="rename" onClick={() => {
              setRenameValue(displayName)
              setRenamingStatus(colMenuStatus)
              setColMenuStatus(null)
              setRenameDialogOpen(true)
            }} sx={{ gap: 1.2, fontSize: '0.72rem', py: 1 }}>
              <DriveFileRenameOutlineIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.45)' }} />
              <Typography sx={{ fontSize: '0.72rem' }}>Renomear coluna</Typography>
            </MenuItem>,
            <MenuItem key="sort-asc" onClick={() => sortColByDate(colMenuStatus, 'asc')} sx={{ gap: 1.2, fontSize: '0.72rem', py: 1 }}>
              <SortIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.45)' }} />
              <Box>
                <Typography sx={{ fontSize: '0.72rem' }}>Ordenar por data ↑</Typography>
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)' }}>Atrasados primeiro → mais futuro</Typography>
              </Box>
            </MenuItem>,
            <MenuItem key="sort-desc" onClick={() => sortColByDate(colMenuStatus, 'desc')} sx={{ gap: 1.2, fontSize: '0.72rem', py: 1 }}>
              <SortIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', transform: 'scaleY(-1)' }} />
              <Box>
                <Typography sx={{ fontSize: '0.72rem' }}>Ordenar por data ↓</Typography>
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)' }}>Mais futuro primeiro</Typography>
              </Box>
            </MenuItem>,
          ]
        })()}
      </Menu>

      {/* ── Item 4: Confirm send to client dialog ────────── */}
      <Dialog
        open={!!sendConfirmDrag}
        onClose={() => setSendConfirmDrag(null)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,154,61,0.2)', borderRadius: '20px' } }}
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography variant="subtitle1" fontWeight={700}>Confirmar envio ao cliente</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            O material de <strong style={{ color: '#ff9039' }}>{sendConfirmDrag?.clientName}</strong> foi enviado para aprovação?
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.8, display: 'block', fontSize: '0.62rem' }}>
            Se sim, o card vai para "Enviado ao cliente" e o WhatsApp é aberto. Se não, o card permanece na coluna atual.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => handleConfirmDragSend(false)} sx={{ color: 'text.secondary' }}>
            Não — manter
          </Button>
          <Button
            size="small" variant="contained" onClick={() => handleConfirmDragSend(true)}
            sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #ff9039, #ff5339)', color: '#000' }}
          >
            Sim — enviar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Item 6: Rename column dialog ─────────────────── */}
      <Dialog
        open={renameDialogOpen}
        onClose={() => setRenameDialogOpen(false)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px' } }}
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography variant="subtitle1" fontWeight={700}>Renomear coluna</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            autoFocus fullWidth size="small"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { applyRename(); setRenameDialogOpen(false) } if (e.key === 'Escape') setRenameDialogOpen(false) }}
            sx={{ '& .MuiInputBase-root': { fontSize: '0.85rem', fontWeight: 700 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => setRenameDialogOpen(false)} sx={{ color: 'text.secondary' }}>Cancelar</Button>
          <Button
            size="small" variant="contained"
            onClick={() => { applyRename(); setRenameDialogOpen(false) }}
            sx={{ fontWeight: 700 }}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </DndContext>
  )
}

// ── Props ─────────────────────────────────────────────────

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, s: Status) => void
  onDelete?: (id: number) => void
  onEdit?: (id: number, patch: ItemEditPatch) => void
  onUpdateState?: (id: number, patch: Partial<ItemState>) => void
  onAddItem?: (clientName: string, title: string, type: ContentType, date: Date, status: Status, responsible?: string, notes?: string, footageLink?: string, roteiroLink?: string, deliveryDate?: number) => void
  onDuplicate?: (id: number) => void
  allClients?: Client[]
  onSendToClient?: (itemId: number, clientName: string, isTraffic?: boolean) => void
  onAutoSendToClient?: (itemId: number, clientName: string) => void
  onAutoDetected?: (info: { itemId: number; clientName: string; itemName: string; videoName: string }) => void
  onBulkSendToClient?: (clientName: string, itemIds: number[]) => void
  onRemindClient?: (itemId: number, clientName: string) => void
  clientColors?: Record<string, string>
  clientHashtags?: Record<string, string[]>
  captionTemplates?: Record<string, string[]>
  onSaveHashtags?: (clientName: string, tags: string[]) => void
  onSaveTemplates?: (clientName: string, templates: string[]) => void
  currentUser?: string
  roteiros?: Record<string, import('../types').Roteiro[]>
  clientFolders?: Record<string, string>
  onUpdateRoteiro?: (clientName: string, roteiroId: string, patch: Partial<Pick<import('../types').Roteiro, 'title' | 'type' | 'driveLink' | 'docsLink' | 'refLink' | 'deadline' | 'status'>>) => void
  onImportRoteiroBatch?: (clientName: string, items: Array<{ title: string; type: ContentType; docsLink: string }>, year: number, month: number) => void
  onDeleteManyRoteiros?: (ids: string[]) => void
  onAddRoteiro?: (clientName: string, r: Omit<import('../types').Roteiro, 'id' | 'clientName' | 'distributed'>, year: number, month: number) => void
  onAddManyRoteiros?: (clientName: string, list: Array<{ title: string; type: import('../types').ContentType; docsLink: string }>, year: number, month: number) => void
}

// ── Main ─────────────────────────────────────────────────

// Tipo padrão sugerido por board ao criar card
const BOARD_DEFAULT_TYPE: ContentType[] = ['Reel', 'Post', 'Feed', 'Post']
// Status padrão sugerido por board
const BOARD_DEFAULT_STATUS: Status[] = [0, 0, 0, 2]
const TABLE_PAGE_SIZE = 25

export default function ProducaoTab({ items, states, onStatusChange, onDelete, onEdit, onUpdateState, onAddItem, onDuplicate, allClients, onSendToClient, onAutoSendToClient, onAutoDetected, onBulkSendToClient, onRemindClient, clientColors, clientHashtags, captionTemplates, onSaveHashtags, onSaveTemplates, currentUser, roteiros = {}, clientFolders = {}, onUpdateRoteiro, onImportRoteiroBatch, onDeleteManyRoteiros, onAddRoteiro, onAddManyRoteiros }: Props) {
  const [subTab, setSubTab]         = useState(0)
  const [filterClient, setFilterClient] = useState('all')
  const [filterToday, setFilterToday]   = useState(false)
  const [filterOverdue, setFilterOverdue] = useState(false)
  const [filterPriority, setFilterPriority] = useState<'all' | 'alta' | 'media' | 'baixa'>('all')
  const [filterResponsible, setFilterResponsible] = useState('all')
  const [filterStuck, setFilterStuck] = useState(false)
  const [showCapacity, setShowCapacity] = useState(false)
  const [bulkMode, setBulkMode]     = useState(false)
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>(() => loadUploadTasks().filter(t => !t.confirmedAt))
  const [roteiroViewMonth, setRoteiroViewMonth] = useState(new Date().getMonth())
  const [roteiroViewYear, setRoteiroViewYear] = useState(new Date().getFullYear())
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<Status>(1)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  // Item 9: bulk send per client — which client to send for
  const [bulkSendClientMenu, setBulkSendClientMenu] = useState<HTMLElement | null>(null)
  const [planejamentoOpen, setPlanejamentoOpen] = useState(false)

  // ── Table view state ──────────────────────────────────────
  const [layoutView, setLayoutView] = useState<'kanban' | 'table'>('kanban')
  const [tableFilterBoard, setTableFilterBoard]     = useState<'all' | 0 | 1 | 2 | 3>('all')
  const [tableSearch, setTableSearch]               = useState('')
  const [tablePage, setTablePage]                   = useState(0)
  const [tableHidePublished, setTableHidePublished] = useState(true)
  const [tableStatusFilter, setTableStatusFilter]   = useState<number | 'all'>('all')
  const [tableSortDir, setTableSortDir]             = useState<'asc' | 'desc'>('asc')

  // ── Send to client confirm dialog ────────────────────────
  const [sendConfirmItem, setSendConfirmItem] = useState<{ id: number; clientName: string } | null>(null)
  const [sendIsTraffic, setSendIsTraffic]     = useState(false)

  function handleConfirmSendToClient() {
    if (!sendConfirmItem) return
    if (sendIsTraffic) onUpdateState?.(sendConfirmItem.id, { isTraffic: true })
    onSendToClient?.(sendConfirmItem.id, sendConfirmItem.clientName, sendIsTraffic)
    setSendConfirmItem(null); setSendIsTraffic(false)
  }

  // ── Add dialog ────────────────────────────────────────────
  const [addOpen, setAddOpen]           = useState(false)
  const [addClient, setAddClient]       = useState('')
  const [addTitle, setAddTitle]         = useState('')
  const [addType, setAddType]           = useState<ContentType>('Post')
  const [addDate, setAddDate]           = useState(() => new Date().toISOString().slice(0, 10))
  const [addDeliveryDate, setAddDeliveryDate] = useState('')
  const [addStatus, setAddStatus]       = useState<Status>(0)
  const [addRotStatus, setAddRotStatus] = useState<RoteiroStatus_>('ideia')
  const [addFootageLink, setAddFootageLink] = useState('')
  const [addRoteiroLink, setAddRoteiroLink] = useState('')

  const handleOpenAdd = () => {
    setAddClient(filterClient !== 'all' ? filterClient : '')
    setAddType(subTab === 4 ? 'Reel' : BOARD_DEFAULT_TYPE[subTab])
    setAddStatus(BOARD_DEFAULT_STATUS[subTab])
    setAddRotStatus('ideia')
    setAddDate(new Date().toISOString().slice(0, 10))
    setAddDeliveryDate('')
    setAddTitle('')
    setAddFootageLink('')
    setAddRoteiroLink('')
    setAddOpen(true)
  }

  const handleAddSubmit = () => {
    if (!addClient || !addTitle.trim()) return
    // Board Roteiros (subTab 4): cria um Roteiro no mês selecionado, não um item de conteúdo
    if (subTab === 4) {
      if (!onAddRoteiro) return
      const deadlineTs = addDate ? new Date(addDate + 'T12:00:00').getTime() : undefined
      onAddRoteiro(addClient, {
        title: addTitle.trim(),
        type: addType,
        docsLink: addRoteiroLink.trim() || undefined,
        status: addRotStatus,
        deadline: deadlineTs,
        year: roteiroViewYear,
        month: roteiroViewMonth,
      }, roteiroViewYear, roteiroViewMonth)
      setAddOpen(false)
      return
    }
    const deliveryTs = addDeliveryDate ? new Date(addDeliveryDate + 'T12:00:00').getTime() : undefined
    onAddItem?.(addClient, addTitle.trim(), addType, new Date(addDate + 'T12:00:00'), addStatus, undefined, undefined, addFootageLink.trim() || undefined, addRoteiroLink.trim() || undefined, deliveryTs)
    setAddOpen(false)
  }

  // ── Card drawer (painel completo de edição) ──────────────
  const [drawerCardId, setDrawerCardId] = useState<number | null>(null)
  const drawerItem  = drawerCardId !== null ? items.find(i => i.i === drawerCardId) ?? null : null
  const drawerState = drawerCardId !== null
    ? (states[drawerCardId] ?? { status: drawerItem?.s ?? 0, title: '', link: '', caption: '', notes: '' })
    : null

  const handleOpenEdit = useCallback((id: number) => {
    setDrawerCardId(id)
  }, [])

  // ── Quick edit dialog (lápis no mini-card → todas as informações) ──────
  const [quickEditId, setQuickEditId] = useState<number | null>(null)
  const handleOpenQuickEdit = useCallback((id: number) => {
    setQuickEditId(id)
  }, [])

  useEffect(() => { setBulkSelected(new Set()); setBulkMode(false) }, [subTab])

  // Busca upload tasks do D1 ao montar (Kaique salva, Arthur recebe)
  useEffect(() => {
    fetch('/api/sync?key=sm_upload_tasks')
      .then(r => r.json())
      .then((data: { value?: string }) => {
        if (!data.value) return
        const remote: UploadTask[] = JSON.parse(data.value)
        localStorage.setItem('sm_upload_tasks', JSON.stringify(remote))
        setUploadTasks(remote.filter(t => !t.confirmedAt))
      })
      .catch(() => {})
  }, [])

  const toggleBulk = (id: number) => {
    setBulkSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function applyBulkStatus() {
    bulkSelected.forEach(id => onStatusChange(id, bulkStatus))
    setBulkSelected(new Set()); setBulkMode(false)
  }

  function applyBulkDelete() {
    bulkSelected.forEach(id => onDelete?.(id))
    setBulkSelected(new Set()); setBulkMode(false); setBulkDeleteConfirm(false)
  }

  const clientOptions = useMemo(() => (allClients ?? []).map(c => c.name).sort(), [allClients])

  const activeCols = BOARDS[subTab].cols

  // ── Drive inbox count (badge no pill Inbox) ──────────────
  const [driveInboxCount, setDriveInboxCount] = useState(0)
  const refreshDriveCount = useCallback(() => {
    fetch('/api/drive-videos?status=inbox')
      .then(r => r.json() as Promise<{ videos?: unknown[] }>)
      .then(d => setDriveInboxCount(d.videos?.length ?? 0))
      .catch(() => {})
  }, [])
  useEffect(() => { refreshDriveCount() }, [refreshDriveCount])

  // ── Item counts per board (badge numbers) ────────────────
  const counts = useMemo(() => {
    const videoFn   = (tp: string) => tp === 'Reel'
    const designFn  = (tp: string) => tp === 'Post' || tp === 'Story' || tp === 'Carrossel'
    const feedFn    = (tp: string) => tp === 'Feed'
    const fns = [videoFn, designFn, feedFn, () => true]
    const kanbanCounts = fns.map((fn, bi) => {
      let n = 0
      items.forEach(item => {
        if (!fn(item.tp)) return
        const st = states[item.i]?.status ?? item.s
        if (BOARDS[bi].cols.some(c => c.status === st)) n++
      })
      return n
    })
    // Contagem de roteiros (board index 4)
    const roteiroCount = Object.values(roteiros).reduce((sum, list) => sum + list.length, 0)
    return [...kanbanCounts, roteiroCount, driveInboxCount]
  }, [items, states, roteiros, driveInboxCount])

  // ── Column summary chips ──────────────────────────────────
  const colSummary = useMemo(() => {
    return activeCols.map(col => {
      const n = items.filter(item => {
        if (filterClient !== 'all' && item.c !== filterClient) return false
        return (states[item.i]?.status ?? item.s) === col.status
      }).length
      return { ...col, n }
    })
  }, [items, states, activeCols, filterClient])

  // ── Filter functions ──────────────────────────────────────
  const videoFilter  = useCallback((item: ContentItem, s: ItemState) => item.tp === 'Reel'      && VIDEO_COLS.some(c => c.status === s.status), [])
  const designFilter = useCallback((item: ContentItem, s: ItemState) => (item.tp === 'Post' || item.tp === 'Story' || item.tp === 'Carrossel') && DESIGN_COLS.some(c => c.status === s.status), [])
  const feedFilter   = useCallback((item: ContentItem, s: ItemState) => item.tp === 'Feed'       && FEED_COLS.some(c => c.status === s.status), [])
  const socialFilter = useCallback((_: ContentItem,    s: ItemState) => SOCIAL_COLS.some(c => c.status === s.status), [])
  const filterFns = [videoFilter, designFilter, feedFilter, socialFilter]

  // ── Combined active filter (base + quick filters) ─────────
  const activeBoardFilter = useMemo(() => {
    const baseFn = filterFns[subTab] ?? (() => true)
    return (item: ContentItem, st: ItemState) => {
      if (!baseFn(item, st)) return false
      const dtMs = new Date(item.dt).setHours(0, 0, 0, 0)
      const todayMs = new Date().setHours(0, 0, 0, 0)
      if (filterToday) {
        if (dtMs > todayMs || st.status === 7 || st.status === 5) return false
      }
      if (filterOverdue) {
        if (dtMs >= todayMs || st.status === 7 || st.status === 5) return false
      }
      if (filterStuck) {
        if (st.status === 7 || st.status === 5) return false
        const sevenDaysAgo = todayMs - 7 * 86400000
        // status 4: use sentToClientAt; others: use publication date
        const refMs = st.status === 4 && st.sentToClientAt
          ? new Date(st.sentToClientAt).setHours(0, 0, 0, 0)
          : dtMs
        if (refMs > sevenDaysAgo) return false
      }
      if (filterPriority !== 'all' && st.priority !== filterPriority) return false
      if (filterResponsible !== 'all' && st.responsible !== filterResponsible) return false
      return true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, filterToday, filterOverdue, filterStuck, filterPriority, filterResponsible])

  // ── KPI metrics for current board ──────────────────────────
  const kpiData = useMemo(() => {
    if (subTab >= 4) return null
    const baseFn = filterFns[subTab] ?? (() => true)
    const todayMs = new Date().setHours(0, 0, 0, 0)
    const weekAgoMs = todayMs - 7 * 86400000
    let overdue = 0, dueToday = 0, pendingApproval = 0, publishedWeek = 0, reprovados = 0, total = 0
    let publishedToday = 0, sentToClient = 0, approvedByClient = 0
    items.forEach(item => {
      const st = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
      if (filterClient !== 'all' && item.c !== filterClient) return
      if (!baseFn(item, st)) return
      total++
      const dtMs = new Date(item.dt).setHours(0, 0, 0, 0)
      if (dtMs < todayMs && st.status !== 7 && st.status !== 5) overdue++
      if (dtMs === todayMs && st.status !== 7 && st.status !== 5) dueToday++
      if (st.status === 2 || st.status === 3 || st.status === 4) pendingApproval++
      if (st.status === 7 && st.publishedAt && st.publishedAt >= weekAgoMs) publishedWeek++
      if (st.status === 7 && st.publishedAt && st.publishedAt >= todayMs) publishedToday++
      if (st.status === 6) reprovados++
      if (st.status >= 4) sentToClient++
      if (st.status === 5 || st.status === 7) approvedByClient++
    })
    const approvalRate = sentToClient > 0 ? Math.round((approvedByClient / sentToClient) * 100) : null
    return { total, overdue, dueToday, pendingApproval, publishedWeek, reprovados, publishedToday, approvalRate }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, states, subTab, filterClient])

  // ── Bottleneck indicators ──────────────────────────────────
  const bottlenecks = useMemo(() => {
    if (subTab >= 4) return []
    const baseFn = filterFns[subTab] ?? (() => true)
    const todayMs = new Date().setHours(0, 0, 0, 0)
    type BotEntry = { count: number; maxDays: number }
    const cat: Record<string, BotEntry> = {
      editor: { count: 0, maxDays: 0 },
      social: { count: 0, maxDays: 0 },
      client: { count: 0, maxDays: 0 },
    }
    items.forEach(item => {
      const st = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
      if (filterClient !== 'all' && item.c !== filterClient) return
      if (!baseFn(item, st)) return
      const dtMs = new Date(item.dt).setHours(0, 0, 0, 0)
      if (dtMs >= todayMs || st.status === 7 || st.status === 5) return
      const daysSinceDt = Math.floor((todayMs - dtMs) / 86400000)
      if (st.status === 0 || st.status === 1 || st.status === 6) {
        cat.editor.count++
        cat.editor.maxDays = Math.max(cat.editor.maxDays, daysSinceDt)
      } else if (st.status === 2 || st.status === 3) {
        cat.social.count++
        cat.social.maxDays = Math.max(cat.social.maxDays, daysSinceDt)
      } else if (st.status === 4) {
        cat.client.count++
        const sentAt = st.sentToClientAt ? new Date(st.sentToClientAt).setHours(0, 0, 0, 0) : dtMs
        cat.client.maxDays = Math.max(cat.client.maxDays, Math.floor((todayMs - sentAt) / 86400000))
      }
    })
    const result: Array<{ label: string; count: number; color: string; maxDays: number }> = []
    if (cat.editor.count > 0) result.push({ label: 'editor', count: cat.editor.count, color: '#C084FC', maxDays: cat.editor.maxDays })
    if (cat.social.count > 0) result.push({ label: 'social', count: cat.social.count, color: '#60A5FA', maxDays: cat.social.maxDays })
    if (cat.client.count > 0) result.push({ label: 'cliente', count: cat.client.count, color: '#FF9A3D', maxDays: cat.client.maxDays })
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, states, subTab, filterClient])

  // ── Capacity per team member ───────────────────────────────
  const capacityData = useMemo(() => {
    const counts: Record<string, number> = {}
    items.forEach(item => {
      const st = states[item.i]
      if (!st) return
      if (st.status === 7 || st.status === 5) return
      if (st.responsible) counts[st.responsible] = (counts[st.responsible] ?? 0) + 1
    })
    return Object.entries(NAME_MAP).map(([key, info]) => {
      const n = counts[key] ?? 0
      return {
        key, info, count: n,
        level: n === 0 ? 'livre' : n <= 3 ? 'baixa' : n <= 6 ? 'moderada' : n <= 10 ? 'alta' : 'sobrecarga',
        color: n === 0 ? 'rgba(255,255,255,0.18)' : n <= 3 ? '#00C47A' : n <= 6 ? '#FFD700' : n <= 10 ? '#FF7832' : '#FF3B30',
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, states])

  // ── Table view computed data ───────────────────────────────
  const tableItems = useMemo(() => {
    const todayMs = new Date().setHours(0, 0, 0, 0)
    return items.filter(item => {
      const st = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
      if (tableFilterBoard === 0 && item.tp !== 'Reel') return false
      if (tableFilterBoard === 1 && item.tp !== 'Post' && item.tp !== 'Story' && item.tp !== 'Carrossel') return false
      if (tableFilterBoard === 2 && item.tp !== 'Feed') return false
      if (filterClient !== 'all' && item.c !== filterClient) return false
      if (filterPriority !== 'all' && st.priority !== filterPriority) return false
      if (filterResponsible !== 'all' && st.responsible !== filterResponsible) return false
      const dtMs = new Date(item.dt).setHours(0, 0, 0, 0)
      if (filterToday && (dtMs > todayMs || st.status === 7 || st.status === 5)) return false
      if (filterOverdue && (dtMs >= todayMs || st.status === 7 || st.status === 5)) return false
      if (tableHidePublished && st.status === 7) return false
      if (tableStatusFilter !== 'all' && st.status !== tableStatusFilter) return false
      if (tableSearch.trim()) {
        const q = tableSearch.trim().toLowerCase()
        const title = (st.title || item.n).toLowerCase()
        if (!title.includes(q) && !item.c.toLowerCase().includes(q)) return false
      }
      return true
    }).sort((a, b) => {
      const diff = new Date(a.dt).getTime() - new Date(b.dt).getTime()
      return tableSortDir === 'asc' ? diff : -diff
    })
  }, [items, states, tableFilterBoard, filterClient, filterPriority, filterResponsible, filterToday, filterOverdue, tableSearch, tableHidePublished, tableStatusFilter, tableSortDir])

  const tableCountByBoard = useMemo(() => {
    const counts: Record<string, number> = { all: 0, '0': 0, '1': 0, '2': 0, '3': 0 }
    items.forEach(item => {
      if (filterClient !== 'all' && item.c !== filterClient) return
      counts.all++
      if (item.tp === 'Reel') counts['0']++
      if (item.tp === 'Post' || item.tp === 'Story' || item.tp === 'Carrossel') counts['1']++
      if (item.tp === 'Feed') counts['2']++
      counts['3']++
    })
    return counts
  }, [items, filterClient])

  const canEdit = !!(onEdit || onUpdateState)

  function confirmUploadTask(taskId: string) {
    const all = loadUploadTasks()
    const updated = all.map(t => t.id === taskId ? { ...t, confirmedAt: Date.now(), confirmedBy: currentUser ?? 'arthur' } : t)
    localStorage.setItem('sm_upload_tasks', JSON.stringify(updated))
    syncToCloud('sm_upload_tasks', updated)
    setUploadTasks(prev => prev.filter(t => t.id !== taskId))
  }

  // Filtra tasks por cliente se filtro ativo
  const visibleUploadTasks = uploadTasks.filter(t =>
    filterClient === 'all' || t.clientName === filterClient
  )

  // Estado do visualizador de Drive embutido
  const [driveViewTask, setDriveViewTask] = useState<UploadTask | null>(null)

  // Edição de link Drive diretamente no card
  const [driveLinkEdits, setDriveLinkEdits] = useState<Record<string, string>>({})

  function saveTaskDriveLink(taskId: string, link: string) {
    const all = loadUploadTasks()
    const updated = all.map(t => t.id === taskId ? { ...t, driveLink: link } : t)
    localStorage.setItem('sm_upload_tasks', JSON.stringify(updated))
    syncToCloud('sm_upload_tasks', updated)
    setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, driveLink: link } : t))
    setDriveLinkEdits(prev => { const n = { ...prev }; delete n[taskId]; return n })
  }

  function getDriveEmbedUrl(link: string): string {
    const folderMatch = link.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    if (folderMatch) return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}`
    const fileMatch = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`
    const idMatch = link.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    if (idMatch) return `https://drive.google.com/embeddedfolderview?id=${idMatch[1]}`
    return link
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Board selector cards ──────────────────────────── */}
      <Box sx={{
        display: 'flex', gap: 0, flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        overflowX: 'auto',
        '&::-webkit-scrollbar': { height: 0 },
      }}>
        {BOARDS.map((board, i) => {
          const active = subTab === i
          return (
            <Box
              key={board.label}
              onClick={() => setSubTab(i)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: { md: 2, lg: 2.5, xl: 3 }, py: { md: 1.2, lg: 1.4 },
                cursor: 'pointer', flexShrink: 0,
                minWidth: { md: 170, lg: 200, xl: 240 },
                borderBottom: active ? `2px solid ${board.color}` : '2px solid transparent',
                bgcolor: active ? `${board.color}0c` : 'transparent',
                borderRight: '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.18s ease',
                position: 'relative',
                '&:hover': { bgcolor: active ? `${board.color}10` : 'rgba(255,255,255,0.03)' },
              }}
            >
              {/* Icon box */}
              <Box sx={{
                width: { md: 34, lg: 38, xl: 44 }, height: { md: 34, lg: 38, xl: 44 },
                borderRadius: 1.5, flexShrink: 0,
                bgcolor: active ? `${board.color}18` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${active ? board.color + '30' : 'rgba(255,255,255,0.08)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: { md: '1rem', lg: '1.1rem', xl: '1.25rem' },
                transition: 'all 0.18s ease',
                filter: active ? 'none' : 'grayscale(0.6)',
                opacity: active ? 1 : 0.7,
              }}>
                {board.emoji}
              </Box>

              {/* Text */}
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 0.15 }}>
                  <Typography sx={{
                    fontSize: { md: '0.75rem', lg: '0.82rem', xl: '0.92rem' },
                    fontWeight: active ? 800 : 600, lineHeight: 1,
                    color: active ? board.color : 'rgba(255,255,255,0.45)',
                    transition: 'color 0.18s',
                  }}>
                    {board.label}
                  </Typography>
                  {active && (
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: board.color, boxShadow: `0 0 6px ${board.color}`, flexShrink: 0 }} />
                  )}
                </Box>
                <Typography sx={{
                  fontSize: { md: '0.57rem', lg: '0.62rem', xl: '0.7rem' },
                  color: 'rgba(255,255,255,0.28)', lineHeight: 1.3,
                  display: { md: 'none', lg: 'block' },
                }} noWrap>
                  {board.desc}
                </Typography>
                <Typography sx={{
                  fontSize: { md: '0.57rem', lg: '0.6rem', xl: '0.65rem' },
                  color: active ? `${board.color}aa` : 'rgba(255,255,255,0.22)',
                  fontWeight: 600, mt: { md: 0.2, lg: 0.3 }, lineHeight: 1,
                }}>
                  {counts[i]} {counts[i] === 1 ? 'item' : 'itens'}
                </Typography>
              </Box>
            </Box>
          )
        })}
        <Box sx={{ flex: 1, borderBottom: '2px solid transparent' }} />
      </Box>

      {/* ── Board title bar ─────────────────────────────────── */}
      <Box sx={{
        px: 2, py: { md: 0.8, lg: 1 }, display: 'flex', alignItems: 'center', gap: 1,
        borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
      }}>
        <Typography sx={{ fontSize: { md: '0.82rem', lg: '0.9rem', xl: '1rem' } }}>
          {BOARDS[subTab].emoji}
        </Typography>
        <Typography sx={{
          fontSize: { md: '0.82rem', lg: '0.9rem', xl: '1rem' },
          fontWeight: 800, color: BOARDS[subTab].color,
        }}>
          {BOARDS[subTab].label}
        </Typography>
        <Typography sx={{ fontSize: { md: '0.6rem', lg: '0.65rem' }, color: 'rgba(255,255,255,0.25)' }}>
          · {BOARDS[subTab].desc.toLowerCase()} · arraste entre colunas para mover o status
        </Typography>
      </Box>

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <Box sx={{
        px: 2, py: 1.1, display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
      }}>
        <TextField
          select size="small" value={filterClient} onChange={e => setFilterClient(e.target.value)}
          sx={{
            minWidth: { md: 160, lg: 190, xl: 220 },
            '& .MuiInputBase-root': { fontSize: '0.68rem', height: 30, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.10)', borderRadius: '8px' },
            '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.3)' },
          }}
          InputProps={{ startAdornment: <FilterListIcon sx={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', mr: 0.5 }} /> }}
        >
          <MenuItem value="all" sx={{ fontSize: '0.68rem' }}>Todos os clientes</MenuItem>
          {clientOptions.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.68rem' }}>{c}</MenuItem>)}
        </TextField>

        {/* Column summary chips */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {colSummary.filter(c => c.n > 0).map(c => (
            <Chip key={c.status}
              label={`${STATUS_CONFIG[c.status].emoji} ${c.n}`}
              size="small"
              sx={{ height: 22, fontSize: '0.62rem', bgcolor: `${c.color}18`, color: c.color, border: `1px solid ${c.color}30`, borderRadius: '6px' }}
            />
          ))}
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* ── Planejar mês ── */}
        {onAddManyRoteiros && subTab < 4 && (
          <Tooltip title="Criar cards do mês a partir dos roteiros">
            <Button
              size="small"
              onClick={() => setPlanejamentoOpen(true)}
              startIcon={<span style={{ fontSize: '0.8rem', lineHeight: 1 }}>📋</span>}
              sx={{
                fontSize: '0.62rem', fontWeight: 700, borderRadius: '8px', px: 1.2, py: 0.5, height: 30,
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.6)',
                bgcolor: 'rgba(255,255,255,0.04)',
                '&:hover': { bgcolor: 'rgba(255,144,57,0.1)', borderColor: 'rgba(255,144,57,0.35)', color: '#ff9039' },
                transition: 'all 0.18s ease',
              }}
            >
              Planejar
            </Button>
          </Tooltip>
        )}

        {/* ── "Meu trabalho" toggle ── */}
        {currentUser && subTab < 4 && (() => {
          const info = NAME_MAP[currentUser]
          const active = filterResponsible === currentUser
          if (!info) return null
          return (
            <Tooltip title={active ? 'Mostrando apenas suas tarefas — clique para ver todos' : 'Ver apenas minhas tarefas'}>
              <Box
                onClick={() => setFilterResponsible(v => v === currentUser ? 'all' : currentUser)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.7,
                  px: 1.2, py: 0.5, borderRadius: '8px', cursor: 'pointer', height: 30,
                  bgcolor: active ? `${info.color}18` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? info.color + '55' : 'rgba(255,255,255,0.10)'}`,
                  color: active ? info.color : 'rgba(255,255,255,0.5)',
                  transition: 'all 0.18s ease',
                  '&:hover': { bgcolor: active ? `${info.color}28` : 'rgba(255,255,255,0.07)' },
                }}
              >
                <Typography sx={{ fontSize: '0.78rem', lineHeight: 1 }}>{info.emoji}</Typography>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: active ? 800 : 600, lineHeight: 1 }}>
                  {active ? 'Meu trabalho' : 'Meu'}
                </Typography>
              </Box>
            </Tooltip>
          )
        })()}

        <Button
          size="small"
          onClick={() => { setBulkMode(v => !v); setBulkSelected(new Set()) }}
          sx={{
            fontSize: '0.65rem', fontWeight: 700, borderRadius: '8px', px: 1.4, py: 0.6, height: 30,
            border: bulkMode ? '1px solid rgba(59,142,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
            color: bulkMode ? '#3B8EFF' : 'rgba(255,255,255,0.6)',
            bgcolor: bulkMode ? 'rgba(59,142,255,0.08)' : 'rgba(255,255,255,0.04)',
            '&:hover': { bgcolor: bulkMode ? 'rgba(59,142,255,0.15)' : 'rgba(255,255,255,0.07)' },
          }}
        >
          {bulkMode ? `✓ ${bulkSelected.size} sel.` : 'Selecionar'}
        </Button>

        {/* Kanban / Tabela toggle */}
        {subTab < 4 && (
          <Box sx={{ display: 'flex', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.09)', overflow: 'hidden', flexShrink: 0 }}>
            {([['kanban', 'Kanban'], ['table', 'Tabela']] as const).map(([view, label]) => (
              <Box key={view} onClick={() => setLayoutView(view)}
                sx={{
                  px: 1.2, py: 0.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, height: 30,
                  bgcolor: layoutView === view ? 'rgba(255,144,57,0.12)' : 'rgba(255,255,255,0.025)',
                  color: layoutView === view ? '#ff9039' : 'rgba(255,255,255,0.38)',
                  borderRight: view === 'kanban' ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  transition: 'all 0.15s ease',
                  '&:hover': { bgcolor: layoutView === view ? 'rgba(255,144,57,0.18)' : 'rgba(255,255,255,0.06)' },
                }}
              >
                {view === 'kanban'
                  ? <GridViewIcon sx={{ fontSize: 12 }} />
                  : <ViewListIcon sx={{ fontSize: 12 }} />}
                <Typography sx={{ fontSize: '0.6rem', fontWeight: layoutView === view ? 700 : 500, lineHeight: 1 }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        )}

        {onAddItem && (
          <Button
            size="small"
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            onClick={handleOpenAdd}
            sx={{
              fontSize: '0.68rem', fontWeight: 800, borderRadius: '8px', px: 1.6, py: 0.6, height: 30,
              background: `linear-gradient(135deg, ${BOARDS[subTab].color}dd, ${BOARDS[subTab].color}99)`,
              color: '#000',
              boxShadow: `0 4px 14px ${BOARDS[subTab].color}35`,
              '&:hover': { filter: 'brightness(1.1)', transform: 'translateY(-1px)', boxShadow: `0 6px 18px ${BOARDS[subTab].color}45` },
              transition: 'all 0.2s ease',
            }}
          >
            Novo {BOARDS[subTab].label}
          </Button>
        )}
      </Box>

      {/* ── Quick filter pills ────────────────────────────────── */}
      {subTab < 4 && (
        <Box sx={{ px: 2, py: 0.7, display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap',
          borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
          {([
            { key: 'today', label: '📅 Hoje', active: filterToday, color: '#FFD700', toggle: () => { setFilterToday(v => !v); setFilterOverdue(false); setFilterStuck(false) } },
            { key: 'overdue', label: '🔴 Atrasados', active: filterOverdue, color: '#FF3B30', toggle: () => { setFilterOverdue(v => !v); setFilterToday(false); setFilterStuck(false) } },
            { key: 'stuck', label: '⏸ Sem mvto +7d', active: filterStuck, color: '#C084FC', toggle: () => { setFilterStuck(v => !v); setFilterToday(false); setFilterOverdue(false) } },
          ] as const).map(f => (
            <Box key={f.key} onClick={f.toggle}
              sx={{ px: 1, py: 0.35, borderRadius: '7px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: f.active ? 700 : 500,
                bgcolor: f.active ? `${f.color}14` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${f.active ? f.color + '40' : 'rgba(255,255,255,0.07)'}`,
                color: f.active ? f.color : 'rgba(255,255,255,0.40)',
                transition: 'all 0.15s ease', userSelect: 'none' }}>
              {f.label}
            </Box>
          ))}
          {(filterToday || filterOverdue || filterStuck) && (
            <Box onClick={() => { setFilterToday(false); setFilterOverdue(false); setFilterStuck(false) }}
              sx={{ px: 0.8, py: 0.35, borderRadius: '7px', cursor: 'pointer', fontSize: '0.58rem', fontWeight: 600,
                color: 'rgba(255,255,255,0.28)', border: '1px solid rgba(255,255,255,0.07)',
                '&:hover': { color: 'rgba(255,255,255,0.6)' }, transition: 'all 0.15s ease' }}>
              ✕ limpar
            </Box>
          )}
        </Box>
      )}

      {/* ── KPI strip ────────────────────────────────────────── */}
      {kpiData && subTab < 4 && (
        <Box sx={{
          px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap',
          borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
        }}>
          {[
            { label: 'atrasados',    value: kpiData.overdue,         color: '#FF3B30', active: kpiData.overdue > 0 },
            { label: 'vencem hoje',  value: kpiData.dueToday,        color: '#FFD700', active: kpiData.dueToday > 0 },
            { label: 'pub. hoje',    value: kpiData.publishedToday,  color: '#00C47A', active: kpiData.publishedToday > 0 },
            { label: 'em aprovação', value: kpiData.pendingApproval, color: '#60A5FA', active: kpiData.pendingApproval > 0 },
            { label: 'reprovados',   value: kpiData.reprovados,      color: '#FF4545', active: kpiData.reprovados > 0 },
            { label: 'pub. semana',  value: kpiData.publishedWeek,   color: '#34D399', active: kpiData.publishedWeek > 0 },
            { label: 'total',        value: kpiData.total,           color: 'rgba(255,255,255,0.35)', active: true },
          ].map(k => (
            <Box key={k.label} sx={{
              display: 'flex', alignItems: 'baseline', gap: 0.5,
              px: 1, py: 0.5, borderRadius: '8px',
              bgcolor: k.active && k.value > 0 ? `${k.color}0d` : 'rgba(255,255,255,0.025)',
              border: `1px solid ${k.active && k.value > 0 ? k.color + '22' : 'rgba(255,255,255,0.05)'}`,
              transition: 'all 0.2s ease',
            }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, lineHeight: 1, color: k.active && k.value > 0 ? k.color : 'rgba(255,255,255,0.22)' }}>
                {k.value}
              </Typography>
              <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1, fontWeight: 500 }}>
                {k.label}
              </Typography>
            </Box>
          ))}
          {/* Taxa de aprovação */}
          {kpiData.approvalRate !== null && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, px: 1, py: 0.5, borderRadius: '8px',
              bgcolor: kpiData.approvalRate >= 70 ? 'rgba(0,196,122,0.07)' : 'rgba(255,120,50,0.07)',
              border: `1px solid ${kpiData.approvalRate >= 70 ? 'rgba(0,196,122,0.18)' : 'rgba(255,120,50,0.18)'}` }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, lineHeight: 1, color: kpiData.approvalRate >= 70 ? '#00C47A' : '#FF7832' }}>
                {kpiData.approvalRate}%
              </Typography>
              <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1, fontWeight: 500 }}>aprovação</Typography>
            </Box>
          )}
          {/* Gargalos com dias */}
          {bottlenecks.length > 0 && (
            <>
              <Box sx={{ width: 1, height: 18, bgcolor: 'rgba(255,255,255,0.06)', mx: 0.3, flexShrink: 0 }} />
              {bottlenecks.map(b => (
                <Tooltip key={b.label} title={`${b.count} item${b.count !== 1 ? 's' : ''} parado${b.count !== 1 ? 's' : ''} c/ ${b.label} — maior atraso: ${b.maxDays} dia${b.maxDays !== 1 ? 's' : ''}`}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: '8px',
                    bgcolor: `${b.color}0a`, border: `1px solid ${b.color}1e`, cursor: 'default' }}>
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: b.color, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.6rem', color: b.color, fontWeight: 700, lineHeight: 1 }}>{b.count}</Typography>
                    <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.32)', lineHeight: 1 }}>c/ {b.label}</Typography>
                    {b.maxDays > 0 && (
                      <Typography sx={{ fontSize: '0.5rem', color: b.maxDays >= 3 ? '#FF3B30' : 'rgba(255,255,255,0.22)', fontWeight: 700, lineHeight: 1 }}>
                        {b.maxDays}d
                      </Typography>
                    )}
                  </Box>
                </Tooltip>
              ))}
            </>
          )}
          <Box sx={{ flex: 1 }} />
          {/* Capacidade toggle */}
          <Box onClick={() => setShowCapacity(v => !v)}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.45, borderRadius: '7px', cursor: 'pointer',
              bgcolor: showCapacity ? 'rgba(255,144,57,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${showCapacity ? 'rgba(255,144,57,0.35)' : 'rgba(255,255,255,0.08)'}`,
              color: showCapacity ? '#ff9039' : 'rgba(255,255,255,0.35)',
              transition: 'all 0.15s ease', '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' } }}>
            <Typography sx={{ fontSize: '0.6rem', lineHeight: 1 }}>👥</Typography>
            <Typography sx={{ fontSize: '0.58rem', fontWeight: showCapacity ? 700 : 500, lineHeight: 1 }}>Equipe</Typography>
            <Typography sx={{ fontSize: '0.5rem', lineHeight: 1, opacity: 0.6 }}>{showCapacity ? '▾' : '▸'}</Typography>
          </Box>
        </Box>
      )}

      {/* ── Capacity panel ───────────────────────────────────── */}
      {showCapacity && subTab < 4 && (
        <Box sx={{ px: 2, py: 1, display: 'flex', gap: 0.8, flexWrap: 'wrap', alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
          bgcolor: 'rgba(255,144,57,0.03)' }}>
          <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.28)', mr: 0.4, flexShrink: 0 }}>Carga:</Typography>
          {capacityData.map(m => (
            <Tooltip key={m.key} title={`${m.info.role} — ${m.count} tarefa${m.count !== 1 ? 's' : ''} ativa${m.count !== 1 ? 's' : ''} · ${m.level}`}>
              <Box onClick={() => setFilterResponsible(v => v === m.key ? 'all' : m.key)}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.4, borderRadius: '8px', cursor: 'pointer',
                  bgcolor: filterResponsible === m.key ? `${m.color}18` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${filterResponsible === m.key ? m.color + '40' : 'rgba(255,255,255,0.07)'}`,
                  transition: 'all 0.15s ease', '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' } }}>
                <Typography sx={{ fontSize: '0.7rem', lineHeight: 1 }}>{m.info.emoji}</Typography>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgba(255,255,255,0.65)', lineHeight: 1 }}>
                  {m.key.charAt(0).toUpperCase() + m.key.slice(1)}
                </Typography>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: m.color, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.count}</Typography>
              </Box>
            </Tooltip>
          ))}
          <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.18)', ml: 0.5 }}>
            🟢 ≤3 · 🟡 4-6 · 🟠 7-10 · 🔴 +10
          </Typography>
        </Box>
      )}

      {/* ── Quick filters ─────────────────────────────────────── */}
      {subTab < 4 && (
        <Box sx={{
          px: 2, py: 0.8, display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap',
          borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
        }}>
          {/* Hoje / Atrasados */}
          {[
            { key: 'today',   label: 'Hoje',      active: filterToday,   color: '#FFD700',  onClick: () => { setFilterToday(v => !v); setFilterOverdue(false) } },
            { key: 'overdue', label: 'Atrasados',  active: filterOverdue, color: '#FF3B30',  onClick: () => { setFilterOverdue(v => !v); setFilterToday(false) } },
          ].map(f => (
            <Box key={f.key} onClick={f.onClick} sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 1, py: 0.45, borderRadius: '7px', cursor: 'pointer',
              bgcolor: f.active ? `${f.color}18` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${f.active ? f.color + '50' : 'rgba(255,255,255,0.08)'}`,
              color: f.active ? f.color : 'rgba(255,255,255,0.40)',
              fontSize: '0.62rem', fontWeight: f.active ? 700 : 500,
              transition: 'all 0.15s ease',
              '&:hover': { bgcolor: f.active ? `${f.color}22` : 'rgba(255,255,255,0.07)' },
            }}>
              {f.label}
            </Box>
          ))}
          <Box sx={{ width: 1, height: 16, bgcolor: 'rgba(255,255,255,0.06)' }} />
          {/* Prioridade */}
          {([['alta', '🔴', '#FF3B30'], ['media', '🟡', '#FFD700'], ['baixa', '📌', '#60A5FA']] as const).map(([p, emoji, color]) => (
            <Box key={p} onClick={() => setFilterPriority(v => v === p ? 'all' : p)} sx={{
              display: 'flex', alignItems: 'center', gap: 0.4,
              px: 0.9, py: 0.45, borderRadius: '7px', cursor: 'pointer',
              bgcolor: filterPriority === p ? `${color}18` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${filterPriority === p ? color + '50' : 'rgba(255,255,255,0.08)'}`,
              transition: 'all 0.15s ease',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
            }}>
              <Typography sx={{ fontSize: '0.58rem', lineHeight: 1 }}>{emoji}</Typography>
              <Typography sx={{ fontSize: '0.6rem', color: filterPriority === p ? color : 'rgba(255,255,255,0.38)', fontWeight: filterPriority === p ? 700 : 500 }}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Typography>
            </Box>
          ))}
          <Box sx={{ width: 1, height: 16, bgcolor: 'rgba(255,255,255,0.06)' }} />
          {/* Responsáveis */}
          {Object.entries(NAME_MAP).map(([key, info]) => (
            <Tooltip key={key} title={`${info.role}`}>
              <Box onClick={() => setFilterResponsible(v => v === key ? 'all' : key)} sx={{
                width: 24, height: 24, borderRadius: '50%', cursor: 'pointer',
                bgcolor: filterResponsible === key ? `${info.color}30` : 'rgba(255,255,255,0.06)',
                border: `1.5px solid ${filterResponsible === key ? info.color : 'rgba(255,255,255,0.12)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', lineHeight: 1,
                transition: 'all 0.15s ease',
                '&:hover': { border: `1.5px solid ${info.color}` },
              }}>
                {info.emoji}
              </Box>
            </Tooltip>
          ))}
          {(filterToday || filterOverdue || filterPriority !== 'all' || filterResponsible !== 'all') && (
            <Box onClick={() => { setFilterToday(false); setFilterOverdue(false); setFilterPriority('all'); setFilterResponsible('all') }}
              sx={{ px: 0.8, py: 0.45, borderRadius: '6px', cursor: 'pointer', fontSize: '0.58rem',
                color: 'rgba(255,255,255,0.30)', border: '1px solid rgba(255,255,255,0.07)',
                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' }, transition: 'all 0.15s ease' }}>
              × limpar
            </Box>
          )}
        </Box>
      )}

      {/* ── Bulk action bar ───────────────────────────────────── */}
      {bulkMode && bulkSelected.size > 0 && (
        <Box sx={{
          px: 2, py: 0.9, display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap',
          borderBottom: '1px solid rgba(59,142,255,0.2)', bgcolor: 'rgba(59,142,255,0.06)',
          animation: 'slideDown 0.18s ease both',
          '@keyframes slideDown': { '0%': { opacity: 0, transform: 'translateY(-6px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
          flexShrink: 0,
        }}>
          <Typography sx={{ fontSize: '0.7rem', color: '#3B8EFF', fontWeight: 700 }}>
            {bulkSelected.size} card{bulkSelected.size !== 1 ? 's' : ''} selecionado{bulkSelected.size !== 1 ? 's' : ''}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>Mover para:</Typography>
          <TextField
            select size="small" value={bulkStatus}
            onChange={e => setBulkStatus(Number(e.target.value) as Status)}
            sx={{
              minWidth: 170,
              '& .MuiInputBase-root': { fontSize: '0.65rem', height: 26, bgcolor: 'rgba(255,255,255,0.04)' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(59,142,255,0.3)' },
            }}
          >
            {activeCols.map(col => (
              <MenuItem key={col.status} value={col.status} sx={{ fontSize: '0.65rem' }}>
                {STATUS_CONFIG[col.status].emoji} {STATUS_CONFIG[col.status].label}
              </MenuItem>
            ))}
          </TextField>
          <Button size="small" variant="contained" onClick={applyBulkStatus}
            sx={{ fontSize: '0.65rem', py: 0.3, background: '#3B8EFF', color: '#fff', fontWeight: 700 }}>
            Mover
          </Button>
          {/* Item 9: Enviar ao cliente — grouped by client */}
          {onBulkSendToClient && subTab === 3 && bulkSelected.size > 0 && (() => {
            const clientGroups: Record<string, number[]> = {}
            bulkSelected.forEach(id => {
              const it = items.find(i => i.i === id)
              if (it) {
                if (!clientGroups[it.c]) clientGroups[it.c] = []
                clientGroups[it.c].push(id)
              }
            })
            const clientNames = Object.keys(clientGroups)
            if (clientNames.length === 0) return null
            if (clientNames.length === 1) {
              return (
                <Button
                  size="small" startIcon={<WhatsAppIcon sx={{ fontSize: 14 }} />}
                  onClick={() => { onBulkSendToClient!(clientNames[0], clientGroups[clientNames[0]]); setBulkMode(false); setBulkSelected(new Set()) }}
                  sx={{ fontSize: '0.65rem', py: 0.3, background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.4)', color: '#25D366', fontWeight: 700 }}
                >
                  Enviar {clientGroups[clientNames[0]].length} para {clientNames[0]}
                </Button>
              )
            }
            return (
              <>
                <Button
                  size="small" startIcon={<WhatsAppIcon sx={{ fontSize: 14 }} />}
                  onClick={e => setBulkSendClientMenu(e.currentTarget)}
                  sx={{ fontSize: '0.65rem', py: 0.3, background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.4)', color: '#25D366', fontWeight: 700 }}
                >
                  Enviar por cliente ▾
                </Button>
                <Menu
                  open={!!bulkSendClientMenu} anchorEl={bulkSendClientMenu}
                  onClose={() => setBulkSendClientMenu(null)}
                  slotProps={{ paper: { sx: { bgcolor: 'rgba(18,18,18,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 } } }}
                >
                  <Box sx={{ px: 1.8, py: 0.8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                      Selecionar cliente
                    </Typography>
                  </Box>
                  {clientNames.map(name => (
                    <MenuItem key={name} onClick={() => {
                      onBulkSendToClient!(name, clientGroups[name])
                      setBulkSendClientMenu(null)
                      setBulkMode(false); setBulkSelected(new Set())
                    }} sx={{ fontSize: '0.72rem', gap: 1.2, py: 0.8 }}>
                      <WhatsAppIcon sx={{ fontSize: 14, color: '#25D366' }} />
                      <Box>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700 }}>{name}</Typography>
                        <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)' }}>{clientGroups[name].length} item{clientGroups[name].length !== 1 ? 's' : ''}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Menu>
              </>
            )
          })()}
          {onDelete && (
            <Button size="small" color="error" startIcon={<DeleteOutlineIcon sx={{ fontSize: 13 }} />}
              onClick={() => setBulkDeleteConfirm(true)}
              sx={{ fontSize: '0.65rem', py: 0.3, border: '1px solid rgba(255,59,48,0.4)', '&:hover': { bgcolor: 'rgba(255,59,48,0.1)' } }}>
              Apagar ({bulkSelected.size})
            </Button>
          )}
          <Button size="small" onClick={() => { setBulkMode(false); setBulkSelected(new Set()) }}
            sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>
            Cancelar
          </Button>
        </Box>
      )}

      {/* ── Board ─────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: 'hidden', ...(layoutView === 'table' && subTab < 4 ? {} : { p: 2, pt: 1.5, pb: 1.5 }) }}>
        {(layoutView === 'kanban' || subTab === 4) && (
        <Box sx={{ height: '100%', overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: 2 }}>

          {/* Coluna pinada de material subido — só no board Social */}
          {subTab === 3 && visibleUploadTasks.length > 0 && (
            <Box sx={{
              width: { md: 220, lg: 240, xl: 270 }, flexShrink: 0,
              display: 'flex', flexDirection: 'column', gap: 1,
              height: '100%', overflowY: 'auto',
              pr: 1,
              borderRight: '1px solid rgba(59,142,255,0.15)',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(59,142,255,0.3) transparent',
            }}>
              {/* Header da coluna */}
              <Box sx={{
                px: 1.2, py: 0.8, borderRadius: '10px',
                background: 'rgba(59,142,255,0.06)',
                border: '1px solid rgba(59,142,255,0.18)',
                display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0,
              }}>
                <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>📥</Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#3B8EFF', letterSpacing: '0.04em', lineHeight: 1 }}>
                    MATERIAL SUBIDO
                  </Typography>
                  <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.3, mt: 0.3 }}>
                    Crie as tarefas e confirme
                  </Typography>
                </Box>
                <Box sx={{
                  minWidth: 20, height: 20, borderRadius: '50%',
                  bgcolor: 'rgba(59,142,255,0.18)', border: '1px solid rgba(59,142,255,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: '#3B8EFF', lineHeight: 1 }}>
                    {visibleUploadTasks.length}
                  </Typography>
                </Box>
              </Box>

              {/* Cards de material */}
              {visibleUploadTasks.map(task => {
                const taskId = task.id
                const dateLabel = new Date(task.sessionDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                return (
                  <Box key={task.id} sx={{
                    borderRadius: '12px', p: 1.4,
                    background: 'rgba(59,142,255,0.04)',
                    border: '1px solid rgba(59,142,255,0.14)',
                    display: 'flex', flexDirection: 'column', gap: 1,
                    animation: 'taskIn 0.22s cubic-bezier(0.16,1,0.3,1) both',
                    '@keyframes taskIn': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
                  }}>
                    {/* Cliente + data */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                      <Box sx={{
                        width: 28, height: 28, borderRadius: '8px', flexShrink: 0,
                        background: 'rgba(59,142,255,0.12)',
                        border: '1px solid rgba(59,142,255,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8rem',
                      }}>📦</Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }} noWrap>
                          {task.clientName}
                        </Typography>
                        <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>
                          gravação de {dateLabel}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Área do Drive */}
                    {task.driveLink && !(taskId in driveLinkEdits) ? (
                      <Box sx={{ display: 'flex', gap: 0.6 }}>
                        <Button size="small" onClick={() => setDriveViewTask(task)} sx={{
                          flex: 1, fontSize: '0.62rem', fontWeight: 800, borderRadius: '8px', py: 0.5,
                          background: 'rgba(59,142,255,0.10)', border: '1px solid rgba(59,142,255,0.25)', color: '#3B8EFF',
                          '&:hover': { background: 'rgba(59,142,255,0.18)' }, transition: 'all 0.15s ease',
                        }}>
                          📂 Ver materiais
                        </Button>
                        <Box
                          component="a" href={task.driveLink} target="_blank" rel="noopener noreferrer"
                          sx={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, borderRadius: '8px', flexShrink: 0,
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                            textDecoration: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem',
                            '&:hover': { background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(59,142,255,0.3)' },
                            transition: 'all 0.15s ease',
                          }}
                        >↗</Box>
                        <Box
                          onClick={() => setDriveLinkEdits(prev => ({ ...prev, [taskId]: task.driveLink ?? '' }))}
                          sx={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, borderRadius: '8px', flexShrink: 0, cursor: 'pointer',
                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                            color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem',
                            '&:hover': { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' },
                            transition: 'all 0.15s ease',
                          }}
                        >✎</Box>
                      </Box>
                    ) : (
                      /* Input para colar link — aparece quando sem link ou editando */
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', fontWeight: 600 }}>
                          LINK DA PASTA NO DRIVE
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Box
                            component="input"
                            placeholder="Cole o link do Drive aqui..."
                            value={driveLinkEdits[taskId] ?? ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setDriveLinkEdits(prev => ({ ...prev, [taskId]: e.target.value }))
                            }
                            onKeyDown={(e: React.KeyboardEvent) => {
                              if (e.key === 'Enter') saveTaskDriveLink(taskId, driveLinkEdits[taskId] ?? '')
                              if (e.key === 'Escape') setDriveLinkEdits(prev => { const n = { ...prev }; delete n[taskId]; return n })
                            }}
                            sx={{
                              flex: 1, height: 28, px: 1, borderRadius: '7px', fontSize: '0.6rem',
                              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(59,142,255,0.25)',
                              color: '#fff', outline: 'none',
                              '&:focus': { borderColor: 'rgba(59,142,255,0.5)', background: 'rgba(59,142,255,0.06)' },
                              '&::placeholder': { color: 'rgba(255,255,255,0.2)' },
                              transition: 'all 0.15s ease',
                            }}
                          />
                          <Box
                            onClick={() => saveTaskDriveLink(taskId, driveLinkEdits[taskId] ?? '')}
                            sx={{
                              width: 28, height: 28, borderRadius: '7px', flexShrink: 0, cursor: 'pointer',
                              background: (driveLinkEdits[taskId] ?? '').length > 5 ? 'rgba(0,196,122,0.18)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${(driveLinkEdits[taskId] ?? '').length > 5 ? 'rgba(0,196,122,0.35)' : 'rgba(255,255,255,0.08)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: (driveLinkEdits[taskId] ?? '').length > 5 ? '#00C47A' : 'rgba(255,255,255,0.2)',
                              fontSize: '0.75rem', fontWeight: 800,
                              '&:hover': { background: 'rgba(0,196,122,0.25)' },
                              transition: 'all 0.15s ease',
                            }}
                          >✓</Box>
                        </Box>
                      </Box>
                    )}

                    {/* Botão confirmar — pendente até clicar */}
                    <Button
                      size="small"
                      fullWidth
                      onClick={() => confirmUploadTask(task.id)}
                      sx={{
                        fontSize: '0.65rem', fontWeight: 800, borderRadius: '8px', py: 0.7,
                        background: 'linear-gradient(135deg, #ff9039, #ff5339)',
                        color: '#000',
                        boxShadow: '0 4px 14px rgba(255,144,57,0.3)',
                        '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)', boxShadow: '0 6px 18px rgba(255,144,57,0.45)' },
                        transition: 'all 0.18s ease',
                      }}
                    >
                      Já criei as tarefas ✓
                    </Button>
                  </Box>
                )
              })}
            </Box>
          )}

          {/* Kanban principal (boards 0-3) */}
          {subTab < 4 && (
            <Box sx={{
              flex: 1, height: '100%', minWidth: 0,
              overflowX: 'auto', overflowY: 'hidden',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,144,57,0.5) transparent',
              '&::-webkit-scrollbar': { height: 6 },
              '&::-webkit-scrollbar-thumb': {
                background: 'linear-gradient(90deg, rgba(255,144,57,0.6), rgba(255,83,57,0.6))',
                borderRadius: 3,
              },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
            }}>
              {BOARDS.slice(0, 4).map((board, i) => (
                subTab === i ? (
                  <MiniKanban
                    key={board.key}
                    items={items} states={states}
                    onStatusChange={onStatusChange}
                    onEdit={canEdit ? handleOpenQuickEdit : undefined}
                    onView={handleOpenEdit}
                    columns={board.cols}
                    filterFn={activeBoardFilter}
                    filterClient={filterClient}
                    bulkMode={bulkMode}
                    bulkSelected={bulkSelected}
                    onBulkToggle={toggleBulk}
                    boardKey={board.key}
                    onSendToClient={onSendToClient ? (id, cn) => { setSendIsTraffic(false); setSendConfirmItem({ id, clientName: cn }) } : undefined}
                    onRemindClient={onRemindClient}
                  />
                ) : null
              ))}
            </Box>
          )}

          {/* Board Inbox Drive (board 5) */}
          {subTab === 5 && (
            <Box sx={{ flex: 1, height: '100%', overflow: 'hidden' }}>
              <DriveVideoInbox
                items={items}
                states={states}
                onUpdateState={onUpdateState ?? (() => {})}
                onRefreshCount={refreshDriveCount}
                onSendToClient={onSendToClient}
                onAutoSendToClient={onAutoSendToClient}
                onAutoDetected={onAutoDetected}
              />
            </Box>
          )}

          {/* Board Roteiros (board 4) */}
          {subTab === 4 && (
            <RoteirosBoard
              roteiros={roteiros}
              clientFolders={clientFolders}
              filterClient={filterClient}
              viewMonth={roteiroViewMonth}
              viewYear={roteiroViewYear}
              onMonthChange={(m, y) => { setRoteiroViewMonth(m); setRoteiroViewYear(y) }}
              onUpdateRoteiro={onUpdateRoteiro}
              onImportBatch={onImportRoteiroBatch}
              onDeleteMany={onDeleteManyRoteiros}
              onAddRoteiro={onAddRoteiro}
              allClients={allClients}
              currentUser={currentUser}
            />
          )}
        </Box>
        )}

        {/* ── Table view (boards 0-3 only) ──────────────────── */}
        {layoutView === 'table' && subTab < 4 && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Sub-tabs + search bar */}
            <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {([
                  { key: 'all' as const, label: 'Todas', emoji: '' },
                  { key: 0 as const, label: 'Vídeos', emoji: '🎬' },
                  { key: 1 as const, label: 'Design', emoji: '🎨' },
                  { key: 2 as const, label: 'Feed', emoji: '📸' },
                  { key: 3 as const, label: 'Social', emoji: '📱' },
                ]).map(tab => {
                  const active = tableFilterBoard === tab.key
                  const color = tab.key === 'all' ? '#ff9039' : BOARDS[tab.key as number].color
                  const cnt = tableCountByBoard[String(tab.key)]
                  return (
                    <Box key={String(tab.key)} onClick={() => { setTableFilterBoard(tab.key); setTablePage(0) }}
                      sx={{ px: 1.2, py: 0.4, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.6,
                        bgcolor: active ? `${color}15` : 'transparent',
                        border: `1px solid ${active ? color + '35' : 'rgba(255,255,255,0.06)'}`,
                        color: active ? color : 'rgba(255,255,255,0.4)',
                        transition: 'all 0.15s ease',
                        '&:hover': { bgcolor: active ? `${color}20` : 'rgba(255,255,255,0.04)' } }}>
                      {tab.emoji && <Typography sx={{ fontSize: '0.68rem', lineHeight: 1 }}>{tab.emoji}</Typography>}
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: active ? 700 : 500, lineHeight: 1 }}>{tab.label}</Typography>
                      <Box sx={{ px: 0.6, borderRadius: '5px', bgcolor: active ? `${color}20` : 'rgba(255,255,255,0.07)', fontSize: '0.56rem', fontWeight: 700, color: active ? color : 'rgba(255,255,255,0.28)', lineHeight: 1.7 }}>{cnt}</Box>
                    </Box>
                  )
                })}
              </Box>
              <Box sx={{ flex: 1 }} />
              <TextField size="small" placeholder="Buscar título ou cliente..." value={tableSearch}
                onChange={e => { setTableSearch(e.target.value); setTablePage(0) }}
                sx={{
                  width: { md: 200, lg: 240, xl: 280 },
                  '& .MuiInputBase-root': { fontSize: '0.68rem', height: 30, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.10)', borderRadius: '8px' },
                  '& input::placeholder': { color: 'rgba(255,255,255,0.22)', opacity: 1 },
                }}
                InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.28)', mr: 0.5 }} /> }}
              />
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.28)', flexShrink: 0 }}>
                {tableItems.length} item{tableItems.length !== 1 ? 's' : ''}
              </Typography>
            </Box>

            {/* ── Filter bar: status + hide-published toggle ── */}
            <Box sx={{ px: 2, py: 0.8, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0, flexWrap: 'wrap', bgcolor: 'rgba(255,255,255,0.01)' }}>
              {/* Toggle publicados */}
              <Box onClick={() => { setTableHidePublished(p => !p); setTableStatusFilter('all'); setTablePage(0) }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.6, px: 1, py: 0.38, borderRadius: '7px', cursor: 'pointer',
                  bgcolor: tableHidePublished ? 'rgba(0,196,122,0.1)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${tableHidePublished ? 'rgba(0,196,122,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  transition: 'all 0.15s',
                }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tableHidePublished ? '#00C47A' : 'rgba(255,255,255,0.25)', transition: 'all 0.15s' }} />
                <Typography sx={{ fontSize: '0.59rem', fontWeight: 700, color: tableHidePublished ? '#00C47A' : 'rgba(255,255,255,0.4)', lineHeight: 1 }}>
                  {tableHidePublished ? 'Ocultar publicados' : 'Ver todos'}
                </Typography>
              </Box>

              {/* Filtro por status */}
              <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                <Box onClick={() => { setTableStatusFilter('all'); setTablePage(0) }}
                  sx={{
                    px: 0.9, py: 0.3, borderRadius: '6px', cursor: 'pointer',
                    bgcolor: tableStatusFilter === 'all' ? 'rgba(255,144,57,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${tableStatusFilter === 'all' ? 'rgba(255,144,57,0.35)' : 'rgba(255,255,255,0.07)'}`,
                    transition: 'all 0.12s',
                  }}>
                  <Typography sx={{ fontSize: '0.57rem', fontWeight: 700, color: tableStatusFilter === 'all' ? '#ff9039' : 'rgba(255,255,255,0.3)', lineHeight: 1 }}>Todos</Typography>
                </Box>
                {(tableHidePublished ? [0,1,2,3,4,5,6] : [0,1,2,3,4,5,6,7]).map(s => {
                  const cfg = STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]
                  if (!cfg) return null
                  const active = tableStatusFilter === s
                  return (
                    <Box key={s} onClick={() => { setTableStatusFilter(active ? 'all' : s); setTablePage(0) }}
                      sx={{
                        px: 0.9, py: 0.3, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.45,
                        bgcolor: active ? `${cfg.color}12` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${active ? cfg.color + '35' : 'rgba(255,255,255,0.06)'}`,
                        transition: 'all 0.12s',
                        '&:hover': { bgcolor: `${cfg.color}10`, borderColor: cfg.color + '28' },
                      }}>
                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: cfg.color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.57rem', fontWeight: active ? 700 : 500, color: active ? cfg.color : 'rgba(255,255,255,0.35)', lineHeight: 1 }}>{cfg.label}</Typography>
                    </Box>
                  )
                })}
              </Box>
            </Box>

            {/* Table header */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { md: '1fr 140px 72px 130px 108px 140px 78px 72px 34px', xl: '1.2fr 160px 82px 150px 118px 156px 88px 80px 34px' },
              px: 2, py: 0.8, gap: { md: 1, xl: 1.5 },
              borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
            }}>
              {['Título', 'Cliente', 'Tipo', 'Responsável', 'Prazo', 'Status', 'Prioridade', 'Progresso', ''].map(col => (
                <Typography key={col} onClick={col === 'Prazo' ? () => { setTableSortDir(d => d === 'asc' ? 'desc' : 'asc'); setTablePage(0) } : undefined}
                  sx={{
                    fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: col === 'Prazo' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)',
                    cursor: col === 'Prazo' ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', gap: 0.4,
                    '&:hover': col === 'Prazo' ? { color: '#ff9039' } : {},
                    transition: 'color 0.15s',
                  }}>
                  {col}
                  {col === 'Prazo' && (
                    <Typography component="span" sx={{ fontSize: '0.6rem', color: 'inherit' }}>
                      {tableSortDir === 'asc' ? '↑' : '↓'}
                    </Typography>
                  )}
                </Typography>
              ))}
            </Box>

            {/* Table rows */}
            <Box sx={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,144,57,0.3) transparent', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(255,144,57,0.4)', borderRadius: 4 } }}>
              {tableItems.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE).map(item => {
                const st = states[item.i] ?? { status: item.s, title: '', link: '', caption: '', notes: '' }
                const statusCfg = STATUS_CONFIG[st.status] ?? STATUS_CONFIG[0]
                const dtMs = new Date(item.dt).setHours(0, 0, 0, 0)
                const todayMs = new Date().setHours(0, 0, 0, 0)
                const diffDays = Math.round((dtMs - todayMs) / 86400000)
                const isLate = diffDays < 0 && st.status !== 7 && st.status !== 5
                const typeColor = TYPE_COLOR[item.tp] ?? '#888'
                const resp = st.responsible ? (NAME_MAP[st.responsible as keyof typeof NAME_MAP] ?? null) : null
                const priorityColor = st.priority === 'alta' ? '#FF3B30' : st.priority === 'media' ? '#FFD700' : '#60A5FA'
                const progress = st.status === 7 ? 100 : st.status >= 4 ? 75 : st.status >= 2 ? 50 : st.status === 1 ? 25 : 0
                return (
                  <Box key={item.i} onClick={() => handleOpenEdit(item.i)} sx={{
                    display: 'grid',
                    gridTemplateColumns: { md: '1fr 140px 72px 130px 108px 140px 78px 72px 34px', xl: '1.2fr 160px 82px 150px 118px 156px 88px 80px 34px' },
                    px: 2, py: 0.85, gap: { md: 1, xl: 1.5 }, alignItems: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.032)',
                    cursor: 'pointer', transition: 'background 0.1s ease',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                  }}>
                    {/* Título */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, minWidth: 0 }}>
                      {bulkMode && (
                        <Box onClick={e => { e.stopPropagation(); toggleBulk(item.i) }}
                          sx={{ width: 14, height: 14, borderRadius: '3px', flexShrink: 0, cursor: 'pointer',
                            border: `1.5px solid ${bulkSelected.has(item.i) ? '#ff9039' : 'rgba(255,255,255,0.2)'}`,
                            bgcolor: bulkSelected.has(item.i) ? 'rgba(255,144,57,0.18)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {bulkSelected.has(item.i) && <Box sx={{ width: 6, height: 6, bgcolor: '#ff9039', borderRadius: '1px' }} />}
                        </Box>
                      )}
                      <Typography sx={{ fontSize: '0.78rem', lineHeight: 1, flexShrink: 0 }}>{TYPE_EMOJI[item.tp] ?? '📄'}</Typography>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.88)', lineHeight: 1.25 }} noWrap>
                          {st.title || item.n}
                        </Typography>
                        {isLate && <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: '#FF3B30', lineHeight: 1, letterSpacing: '0.04em' }}>ATRASADO</Typography>}
                      </Box>
                    </Box>
                    {/* Cliente */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0 }}>
                      <Box sx={{ width: 20, height: 20, borderRadius: '5px', bgcolor: 'rgba(255,144,57,0.12)', border: '1px solid rgba(255,144,57,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Typography sx={{ fontSize: '0.48rem', fontWeight: 800, color: '#ff9039', lineHeight: 1 }}>{item.c.slice(0, 2).toUpperCase()}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.68)', fontWeight: 500 }} noWrap>{item.c}</Typography>
                    </Box>
                    {/* Tipo */}
                    <Box sx={{ px: 0.65, py: 0.22, borderRadius: '6px', bgcolor: typeColor === '#888' ? 'rgba(255,255,255,0.05)' : `${typeColor}14`, border: `1px solid ${typeColor === '#888' ? 'rgba(255,255,255,0.08)' : typeColor + '28'}`, display: 'inline-flex', width: 'fit-content' }}>
                      <Typography sx={{ fontSize: '0.57rem', fontWeight: 700, color: typeColor === '#888' ? 'rgba(255,255,255,0.42)' : typeColor, lineHeight: 1 }}>{item.tp}</Typography>
                    </Box>
                    {/* Responsável */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                      {resp ? (
                        <>
                          <Typography sx={{ fontSize: '0.7rem', lineHeight: 1, flexShrink: 0 }}>{resp.emoji}</Typography>
                          <Typography sx={{ fontSize: '0.62rem', color: resp.color, fontWeight: 600 }} noWrap>
                            {st.responsible!.charAt(0).toUpperCase() + st.responsible!.slice(1)}
                          </Typography>
                        </>
                      ) : (
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.18)' }}>—</Typography>
                      )}
                    </Box>
                    {/* Prazo */}
                    <Box>
                      <Typography sx={{ fontSize: '0.64rem', fontWeight: isLate ? 700 : 400, color: isLate ? '#FF3B30' : diffDays === 0 ? '#FFD700' : 'rgba(255,255,255,0.62)', lineHeight: 1.3 }}>
                        {new Date(item.dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </Typography>
                      <Typography sx={{ fontSize: '0.54rem', color: isLate ? '#FF3B30' : diffDays === 0 ? '#FFD700' : 'rgba(255,255,255,0.28)', fontWeight: (isLate || diffDays === 0) ? 700 : 400, lineHeight: 1 }}>
                        {isLate ? `${-diffDays}d atrasado` : diffDays === 0 ? 'hoje' : `em ${diffDays}d`}
                      </Typography>
                    </Box>
                    {/* Status */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.7, py: 0.28, borderRadius: '7px', bgcolor: `${statusCfg.color}10`, border: `1px solid ${statusCfg.color}24`, width: 'fit-content', maxWidth: '100%' }}>
                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: statusCfg.color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.57rem', fontWeight: 700, color: statusCfg.color, lineHeight: 1 }} noWrap>{statusCfg.label}</Typography>
                    </Box>
                    {/* Prioridade */}
                    {st.priority ? (
                      <Box sx={{ px: 0.65, py: 0.22, borderRadius: '6px', bgcolor: `${priorityColor}12`, border: `1px solid ${priorityColor}24`, display: 'inline-flex', width: 'fit-content' }}>
                        <Typography sx={{ fontSize: '0.57rem', fontWeight: 700, color: priorityColor, lineHeight: 1, textTransform: 'capitalize' }}>{st.priority}</Typography>
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.15)' }}>—</Typography>
                    )}
                    {/* Progresso */}
                    <Box>
                      <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: 'rgba(255,255,255,0.42)', lineHeight: 1, mb: 0.35 }}>{progress}%</Typography>
                      <Box sx={{ height: 3, borderRadius: '2px', bgcolor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                        <Box sx={{ height: '100%', borderRadius: '2px', width: `${progress}%`, bgcolor: statusCfg.color, transition: 'width 0.3s ease' }} />
                      </Box>
                    </Box>
                    {/* Ações */}
                    <IconButton size="small" onClick={e => { e.stopPropagation(); handleOpenEdit(item.i) }}
                      sx={{ width: 24, height: 24, color: 'rgba(255,255,255,0.22)', '&:hover': { color: '#ff9039', bgcolor: 'rgba(255,144,57,0.1)' } }}>
                      <MoreVertIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Box>
                )
              })}
              {tableItems.length === 0 && (
                <Box sx={{ py: 7, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.18)' }}>Nenhum item encontrado</Typography>
                </Box>
              )}
            </Box>

            {/* Pagination */}
            {tableItems.length > TABLE_PAGE_SIZE && (
              <Box sx={{ px: 2, py: 0.9, display: 'flex', alignItems: 'center', gap: 0.8, borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>
                  {tablePage * TABLE_PAGE_SIZE + 1}–{Math.min((tablePage + 1) * TABLE_PAGE_SIZE, tableItems.length)} de {tableItems.length}
                </Typography>
                <Box sx={{ flex: 1 }} />
                {Array.from({ length: Math.min(Math.ceil(tableItems.length / TABLE_PAGE_SIZE), 10) }, (_, i) => (
                  <Box key={i} onClick={() => setTablePage(i)} sx={{
                    width: 24, height: 24, borderRadius: '6px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: tablePage === i ? 'rgba(255,144,57,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${tablePage === i ? 'rgba(255,144,57,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: tablePage === i ? '#ff9039' : 'rgba(255,255,255,0.38)',
                    fontSize: '0.6rem', fontWeight: 700, transition: 'all 0.15s ease',
                  }}>
                    {i + 1}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* ── Visualizador Drive ──────────────────────────────── */}
      <Dialog
        open={Boolean(driveViewTask)}
        onClose={() => setDriveViewTask(null)}
        maxWidth="md" fullWidth
        slotProps={{ paper: { sx: {
          background: 'rgba(10,10,10,0.98)', backdropFilter: 'blur(40px)',
          border: '1px solid rgba(59,142,255,0.18)', borderRadius: '20px',
          overflow: 'hidden',
        }}}}
      >
        <Box sx={{
          px: 2.5, py: 1.8, display: 'flex', alignItems: 'center', gap: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <Box sx={{
            width: 34, height: 34, borderRadius: '10px', flexShrink: 0,
            background: 'rgba(59,142,255,0.12)', border: '1px solid rgba(59,142,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
          }}>📂</Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff', lineHeight: 1 }}>
              {driveViewTask?.clientName}
            </Typography>
            <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
              Material subido · gravação de{' '}
              {driveViewTask && new Date(driveViewTask.sessionDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.8 }}>
            {driveViewTask?.driveLink && (
              <Box
                component="a" href={driveViewTask.driveLink} target="_blank" rel="noopener noreferrer"
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5, px: 1.2, py: 0.5, borderRadius: '8px',
                  background: 'rgba(59,142,255,0.08)', border: '1px solid rgba(59,142,255,0.2)',
                  textDecoration: 'none', color: '#3B8EFF', fontSize: '0.62rem', fontWeight: 700,
                  '&:hover': { background: 'rgba(59,142,255,0.16)' }, transition: 'all 0.15s ease',
                }}
              >
                ↗ Abrir no Drive
              </Box>
            )}
            <IconButton size="small" onClick={() => setDriveViewTask(null)}
              sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' } }}>
              <Box sx={{ fontSize: '1rem', lineHeight: 1, pb: 0.2 }}>✕</Box>
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ position: 'relative', height: { md: '60vh', xl: '65vh' }, bgcolor: '#fff' }}>
          {driveViewTask?.driveLink && (
            <Box
              component="iframe"
              src={getDriveEmbedUrl(driveViewTask.driveLink)}
              sx={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              title="Drive materials"
              allow="autoplay"
            />
          )}
        </Box>
      </Dialog>

      {/* ── Add dialog ──────────────────────────────────────── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: `1px solid ${BOARDS[subTab].color}30`, borderRadius: 3 } } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{BOARDS[subTab].emoji}</Box>
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>
                Novo card — {BOARDS[subTab].label}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                Adicionar à produção de {BOARDS[subTab].label.toLowerCase()}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>

          <TextField
            label="Cliente" size="small" fullWidth select autoFocus
            value={addClient} onChange={e => setAddClient(e.target.value)}
          >
            {clientOptions.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.72rem' }}>{c}</MenuItem>)}
          </TextField>

          <TextField
            label="Título / descrição do conteúdo" size="small" fullWidth
            value={addTitle} onChange={e => setAddTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddSubmit()}
          />

          {subTab === 0 ? (
            /* Vídeo: data de entrega + data de publicação lado a lado */
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C084FC', mb: 0.5 }}>
                  📥 Entrega ao social
                </Typography>
                <TextField
                  label="Data de entrega" type="date" size="small" fullWidth
                  value={addDeliveryDate} onChange={e => setAddDeliveryDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true }, input: { sx: { fontSize: '0.78rem' } } }}
                  sx={{ '& .MuiOutlinedInput-root': { borderColor: 'rgba(192,132,252,0.3)' } }}
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#00C47A', mb: 0.5 }}>
                  🚀 Publicação
                </Typography>
                <TextField
                  label="Data de publicação" type="date" size="small" fullWidth
                  value={addDate} onChange={e => setAddDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true }, input: { sx: { fontSize: '0.78rem' } } }}
                />
              </Box>
            </Box>
          ) : subTab === 4 ? (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.8, px: 1, py: 0.6, borderRadius: 1.5, bgcolor: `${ROT_COLOR}10`, border: `1px solid ${ROT_COLOR}28` }}>
                <Typography sx={{ fontSize: '0.78rem', lineHeight: 1 }}>📅</Typography>
                <Typography sx={{ fontSize: '0.65rem', color: ROT_COLOR, fontWeight: 700 }}>
                  Será criado em {MONTH_NAMES_ROT[roteiroViewMonth]}/{String(roteiroViewYear).slice(2)} (mês selecionado)
                </Typography>
              </Box>
              <TextField
                label="Prazo de entrega (opcional)" type="date" size="small" fullWidth
                value={addDate} onChange={e => setAddDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
          ) : (
            <TextField
              label="Data de publicação" type="date" size="small" fullWidth
              value={addDate} onChange={e => setAddDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          )}

          {subTab === 4 && (
            <TextField
              label="📄 Link do Docs (roteiro)" size="small" fullWidth
              value={addRoteiroLink} onChange={e => setAddRoteiroLink(e.target.value)}
              placeholder="https://docs.google.com/document/d/..."
              slotProps={{ input: { sx: { fontSize: '0.72rem' } } }}
            />
          )}

          {(subTab === 0 || (subTab === 1 && addType === 'Post')) && (
            <>
              <TextField
                label="Link do material bruto (Drive)" size="small" fullWidth
                value={addFootageLink} onChange={e => setAddFootageLink(e.target.value)}
                placeholder="https://drive.google.com/..."
                slotProps={{ input: { sx: { fontSize: '0.72rem' } } }}
              />
              <TextField
                label="Link do roteiro (Docs/Drive)" size="small" fullWidth
                value={addRoteiroLink} onChange={e => setAddRoteiroLink(e.target.value)}
                placeholder="https://docs.google.com/..."
                slotProps={{ input: { sx: { fontSize: '0.72rem' } } }}
              />
            </>
          )}

          <Box>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 0.7, display: 'block' }}>
              Tipo de conteúdo
            </Typography>
            <ToggleButtonGroup exclusive value={addType} onChange={(_, v) => v && setAddType(v)} size="small" fullWidth>
              {ALL_TYPES.map(t => (
                <ToggleButton key={t} value={t} sx={{
                  fontSize: '0.6rem', fontWeight: 700, py: 0.6, gap: 0.3,
                  '&.Mui-selected': { color: TYPE_COLOR[t], bgcolor: `${TYPE_COLOR[t]}18`, borderColor: `${TYPE_COLOR[t]}50` },
                }}>
                  <Typography sx={{ fontSize: '0.72rem', lineHeight: 1 }}>{TYPE_EMOJI[t]}</Typography>
                  {t}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 0.7, display: 'block' }}>
              Status inicial
            </Typography>
            {subTab === 4 ? (() => {
              let rotColLabels: Partial<Record<RoteiroStatus_, string>> = {}
              try { rotColLabels = JSON.parse(localStorage.getItem('sm_roteiro_col_labels') ?? '{}') } catch { /* noop */ }
              return (
                <TextField
                  select size="small" fullWidth value={addRotStatus}
                  onChange={e => setAddRotStatus(e.target.value as RoteiroStatus_)}
                  sx={{ '& .MuiInputBase-root': { fontSize: '0.72rem' } }}
                >
                  {ROTEIRO_STATUS_FLOW.map(st => {
                    const cfg = ROTEIRO_STATUS_CFG[st]
                    return (
                      <MenuItem key={st} value={st} sx={{ fontSize: '0.72rem', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cfg.color, flexShrink: 0 }} />
                          {cfg.icon} {rotColLabels[st]?.trim() || cfg.label}
                        </Box>
                      </MenuItem>
                    )
                  })}
                </TextField>
              )
            })() : (
              <TextField
                select size="small" fullWidth value={addStatus}
                onChange={e => setAddStatus(Number(e.target.value) as Status)}
                sx={{ '& .MuiInputBase-root': { fontSize: '0.72rem' } }}
              >
                {BOARDS[subTab].cols.map(col => (
                  <MenuItem key={col.status} value={col.status} sx={{ fontSize: '0.72rem', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: col.color, flexShrink: 0 }} />
                      {col.label}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button size="small" onClick={() => setAddOpen(false)}>Cancelar</Button>
          <Button
            size="small" variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            disabled={!addClient || !addTitle.trim()}
            onClick={handleAddSubmit}
            sx={{
              fontWeight: 700, px: 2,
              background: BOARDS[subTab].color,
              color: '#000', '&:hover': { filter: 'brightness(1.1)' },
            }}
          >
            Criar card
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Drawer: painel completo de edição ───────────────── */}
      <Drawer
        anchor="right"
        open={drawerCardId !== null}
        onClose={() => setDrawerCardId(null)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100vw', sm: 420, md: 460, lg: 500, xl: 560 },
              background: 'rgba(11,11,11,0.98)',
              backdropFilter: 'blur(32px)',
              borderLeft: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', flexDirection: 'column',
            },
          },
        }}
      >
        {/* Header do drawer */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.2,
          px: 2, py: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          {drawerItem && (
            <>
              <Box sx={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                bgcolor: clientColors?.[drawerItem.c] ?? 'primary.main',
              }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                  {drawerItem.c}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }} noWrap>
                  {states[drawerItem.i]?.title || drawerItem.n}
                </Typography>
              </Box>
            </>
          )}
          <IconButton
            size="small"
            onClick={() => setDrawerCardId(null)}
            sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#fff' }, flexShrink: 0 }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        {/* ContentCard completo */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,144,57,0.3)', borderRadius: 2 },
        }}>
          {drawerItem && drawerState && (
            <ContentCard
              item={drawerItem}
              state={drawerState}
              now={new Date()}
              onStatusChange={onStatusChange}
              onUpdate={onUpdateState ?? (() => {})}
              onDelete={id => { onDelete?.(id); setDrawerCardId(null) }}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              clientColor={clientColors?.[drawerItem.c]}
              clientHashtags={clientHashtags?.[drawerItem.c]}
              onSaveHashtags={onSaveHashtags ? tags => onSaveHashtags(drawerItem.c, tags) : undefined}
              captionTemplates={captionTemplates?.[drawerItem.c]}
              onSaveTemplates={onSaveTemplates}
              currentUser={currentUser}
            />
          )}
        </Box>
      </Drawer>

      {/* ── Quick edit dialog (lápis no card → todas as infos) ─ */}
      <EditItemDialog
        open={quickEditId !== null}
        item={quickEditId !== null ? (items.find(i => i.i === quickEditId) ?? null) : null}
        state={quickEditId !== null ? (states[quickEditId] ?? null) : null}
        onSave={(id, patch) => { onEdit?.(id, patch) }}
        onSaveState={(id, patch) => { onUpdateState?.(id, patch) }}
        onClose={() => setQuickEditId(null)}
      />

      {/* ── Bulk delete confirm ──────────────────────────────── */}
      <Dialog open={bulkDeleteConfirm} onClose={() => setBulkDeleteConfirm(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,59,48,0.25)' } } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteOutlineIcon sx={{ color: 'error.main', fontSize: 18 }} />
            <Typography fontWeight={800} color="error.main" sx={{ fontSize: '0.95rem' }}>
              Apagar {bulkSelected.size} card{bulkSelected.size !== 1 ? 's' : ''}?
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', lineHeight: 1.6 }}>
            Ação permanente. Os {bulkSelected.size} cards selecionados serão removidos.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button size="small" onClick={() => setBulkDeleteConfirm(false)}>Cancelar</Button>
          <Button size="small" variant="contained" color="error"
            startIcon={<DeleteOutlineIcon sx={{ fontSize: 14 }} />}
            onClick={applyBulkDelete} sx={{ fontWeight: 700 }}>
            Apagar tudo
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Send-to-client confirm ───────────────────────────── */}
      <Dialog open={!!sendConfirmItem} onClose={() => setSendConfirmItem(null)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,154,61,0.25)' } } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SendIcon sx={{ color: '#FF9A3D', fontSize: 18 }} />
            <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>Enviar ao cliente</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {sendConfirmItem && (() => {
            const item  = items.find(i => i.i === sendConfirmItem.id)
            const title = states[sendConfirmItem.id]?.title || item?.n || 'Este conteúdo'
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,154,61,0.06)', border: '1px solid rgba(255,154,61,0.2)' }}>
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', mb: 0.3 }}>Conteúdo</Typography>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>{title}</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#FF9A3D', mt: 0.3 }}>{sendConfirmItem.clientName}</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                  📤 Isso vai gerar o link do portal do cliente e registrar a data de envio.
                </Typography>
                <Box onClick={() => setSendIsTraffic(v => !v)} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
                  p: 1.5, borderRadius: 2,
                  bgcolor: sendIsTraffic ? 'rgba(255,215,0,0.07)' : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${sendIsTraffic ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: 'rgba(255,215,0,0.3)' },
                }}>
                  <Box sx={{ width: 36, height: 20, borderRadius: 10, flexShrink: 0, bgcolor: sendIsTraffic ? '#FFD700' : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'all 0.2s' }}>
                    <Box sx={{ position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%', bgcolor: '#fff', transition: 'left 0.2s', left: sendIsTraffic ? 19 : 3, boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: sendIsTraffic ? '#FFD700' : 'rgba(255,255,255,0.6)' }}>
                      ⚡ Usar em tráfego pago
                    </Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
                      {sendIsTraffic ? 'Cliente será notificado que vai para anúncios' : 'Ativar se o criativo será impulsionado'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button size="small" onClick={() => setSendConfirmItem(null)}>Cancelar</Button>
          <Button size="small" variant="contained" onClick={handleConfirmSendToClient}
            startIcon={<WhatsAppIcon sx={{ fontSize: 14 }} />}
            sx={{ background: '#25D366', color: '#fff', fontWeight: 800, '&:hover': { filter: 'brightness(1.1)' } }}>
            Enviar pelo WhatsApp
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Planejamento de mês ──────────────────────────────── */}
      {onAddManyRoteiros && (
        <PlanejamentoDialog
          open={planejamentoOpen}
          onClose={() => setPlanejamentoOpen(false)}
          allClients={allClients ?? []}
          defaultMonth={roteiroViewMonth}
          defaultYear={roteiroViewYear}
          onGenerate={(clientName, list, year, month) => {
            onAddManyRoteiros(clientName, list, year, month)
          }}
        />
      )}
    </Box>
  )
}
