import { DS, ctaGradient } from '../../theme'
import { useMemo, useState, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragEndEvent, type DragStartEvent,
  closestCenter, pointerWithin,
  type CollisionDetection,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Box, Typography, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import type { ContentType, RoteiroStatus } from '../../types'
import { clickable, clickableStop } from '../../shared/a11y'
import { syncToCloud } from '../../lib/storage'
import { NAME_MAP } from '../../lib/users'
import {
  ALL_TYPES, MONTH_NAMES_ROT, ROT_COLOR,
  ROTEIRO_STATUS_CFG, ROTEIRO_STATUS_FLOW, toLocalDateInput,
} from './shared'

/**
 * Central de Roteiros — o board 4 de Produções.
 *
 * Morava dentro do `ProducaoTab.tsx`, que tinha 5.563 linhas: 1.735 delas eram
 * isto aqui, sem relação nenhuma com o kanban de conteúdo. Estavam no mesmo
 * arquivo por acidente histórico, e cada mexida no board de produção obrigava a
 * navegar por elas.
 *
 * Nota: esta é a Central de Roteiros que a equipe usa de verdade — o
 * `RoteirosIdeaTab` (aba 14) está `hidden`.
 */

type RoteiroStatus_ = RoteiroStatus
type ContentType_ = ContentType

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
  overdue: DS.red, today: DS.amber, soon: DS.accent, ok: DS.green,
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
  roteiro: import('../../types').Roteiro
  onOpen: (r: import('../../types').Roteiro) => void
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
      // O dnd-kit já deixa o card focável e com role=button, mas o board não tem
      // KeyboardSensor: sem isto, Enter/Espaço não fazem nada e quem navega por
      // teclado tabula por dezenas de "botões" inertes sem abrir roteiro nenhum.
      // O arraste é só ponteiro/toque, então o teclado está livre para abrir.
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(roteiro)
        }
      }}
      aria-label={`Roteiro: ${roteiro.title}`}
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
        bgcolor: 'rgba(244,247,255,0.03)',
        transition: 'border 0.15s ease, background 0.15s ease',
        '&:hover': { border: `1px solid ${cfg.color}55`, bgcolor: 'rgba(244,247,255,0.055)' },
        '&::before': {
          content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          bgcolor: cfg.color, borderRadius: '2px 0 0 2px',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.4 }}>
        <Typography sx={{ fontSize: '0.62rem', lineHeight: 1, flexShrink: 0 }}>{typeEmoji[roteiro.type] ?? '📄'}</Typography>
        <Typography noWrap sx={{ fontSize: '0.56rem', fontWeight: 600, color: 'rgba(244,247,255,0.42)', flex: 1, lineHeight: 1 }}>
          {roteiro.clientName}
        </Typography>
      </Box>
      <Typography sx={{
        fontSize: '0.72rem', fontWeight: 700, color: 'rgba(244,247,255,0.9)', lineHeight: 1.25, mb: 0.4,
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
            sx={{ px: 0.5, py: 0.1, borderRadius: '4px', fontSize: '0.5rem', textDecoration: 'none', cursor: 'pointer', bgcolor: 'rgba(59,130,246,0.14)', color: DS.accent, border: '1px solid rgba(59,130,246,0.28)', '&:hover': { bgcolor: 'rgba(59,130,246,0.28)' } }}>🔗 Ref</Box>
        )}
        {roteiro.driveLink && (
          <Box component="a" href={roteiro.driveLink} target="_blank" rel="noopener noreferrer"
            onPointerDown={(e: React.PointerEvent) => e.stopPropagation()} onClick={(e: React.MouseEvent) => e.stopPropagation()}
            sx={{ px: 0.5, py: 0.1, borderRadius: '4px', fontSize: '0.5rem', textDecoration: 'none', cursor: 'pointer', bgcolor: 'rgba(49,209,124,0.14)', color: DS.green, border: '1px solid rgba(49,209,124,0.28)', '&:hover': { bgcolor: 'rgba(49,209,124,0.28)' } }}>☁️ Drive</Box>
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
  roteiros: Record<string, import('../../types').Roteiro[]>
  clientFolders: Record<string, string>
  filterClient: string
  viewMonth: number
  viewYear: number
  onMonthChange: (m: number, y: number) => void
  onUpdateRoteiro?: (clientName: string, roteiroId: string, patch: Partial<Pick<import('../../types').Roteiro, 'title' | 'type' | 'driveLink' | 'docsLink' | 'refLink' | 'deadline' | 'status'>>) => void
  onImportBatch?: (clientName: string, items: Array<{ title: string; type: ContentType_; docsLink: string }>, year: number, month: number) => void
  onDeleteMany?: (ids: string[]) => void
  onAddRoteiro?: (clientName: string, r: Omit<import('../../types').Roteiro, 'id' | 'clientName' | 'distributed'>, year: number, month: number) => void
  allClients?: import('../../types').Client[]
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

  function openEdit(r: import('../../types').Roteiro) {
    const dl = r.deadline ? toLocalDateInput(new Date(r.deadline)) : ''
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
    const items: Array<{ roteiro: import('../../types').Roteiro; clientName: string }> = []
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
    if (!s || s.total === 0) return { color: 'rgba(244,247,255,0.15)', level: 'empty' as const }
    if (s.overdue > 0) return { color: DS.red, level: 'overdue' as const }
    if (s.nextDeadline) {
      const diff = Math.round((new Date(s.nextDeadline).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
      if (diff <= 1) return { color: DS.amber, level: 'soon' as const }
    }
    return { color: DS.green, level: 'ok' as const }
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
    const map: Record<RoteiroStatus_, Array<import('../../types').Roteiro>> = { ideia: [], escrevendo: [], revisao: [], pronto: [] }
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

  const findRoteiro = useCallback((id: string): { clientName: string; r: import('../../types').Roteiro } | null => {
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
            <Box key={opt.label} {...clickable(() => onMonthChange(opt.month, opt.year))}
              aria-pressed={active}
              sx={{ px: 1, py: 0.3, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
                bgcolor: active ? `${ROT_COLOR}20` : 'transparent',
                color: active ? ROT_COLOR : 'rgba(244,247,255,0.3)',
                border: `1px solid ${active ? ROT_COLOR + '40' : 'transparent'}`,
                '&:hover': { bgcolor: `${ROT_COLOR}12`, color: ROT_COLOR }, transition: 'all 0.15s ease' }}>
              {opt.label}
            </Box>
          )
        })}
        <Box sx={{ flex: 1 }} />
        {onDeleteMany && selectMode && (
          <Box {...clickable(() => { const allIds = clientsToShow.flatMap(c => allForMonth(c).map(r => r.id)); setSelected(new Set(allIds)) })}
            sx={{ px: 1, py: 0.3, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
              color: 'rgba(244,247,255,0.5)', border: '1px solid rgba(244,247,255,0.12)',
              '&:hover': { color: '#fff', borderColor: 'rgba(244,247,255,0.25)' }, transition: 'all 0.15s ease' }}>Todos</Box>
        )}
        {onDeleteMany && (
          <Box {...clickable(() => { setSelectMode(p => !p); setSelected(new Set()) })}
            aria-pressed={selectMode}
            sx={{ px: 1, py: 0.3, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
              bgcolor: selectMode ? `${ROT_COLOR}20` : 'transparent',
              color: selectMode ? ROT_COLOR : 'rgba(244,247,255,0.35)',
              border: `1px solid ${selectMode ? ROT_COLOR + '40' : 'transparent'}`,
              '&:hover': { color: ROT_COLOR }, transition: 'all 0.15s ease' }}>
            {selectMode ? '✕ Cancelar' : '☑ Selecionar'}
          </Box>
        )}
        {onDeleteMany && !selectMode && (
          <>
            <Box {...clickable(() => { if (monthRoteiroIds.length > 0) setClearConfirm('month') })}
              aria-disabled={monthRoteiroIds.length === 0}
              sx={{ px: 1, py: 0.3, borderRadius: '6px', cursor: monthRoteiroIds.length > 0 ? 'pointer' : 'default', fontSize: '0.6rem', fontWeight: 700,
                color: monthRoteiroIds.length > 0 ? DS.accent : 'rgba(244,247,255,0.18)',
                border: `1px solid ${monthRoteiroIds.length > 0 ? 'rgba(255,138,69,0.28)' : 'transparent'}`,
                '&:hover': monthRoteiroIds.length > 0 ? { bgcolor: 'rgba(255,138,69,0.1)' } : {}, transition: 'all 0.15s ease' }}>
              🧹 Limpar mês
            </Box>
            <Box {...clickable(() => { if (allRoteiroIds.length > 0) setClearConfirm('all') })}
              aria-disabled={allRoteiroIds.length === 0}
              sx={{ px: 1, py: 0.3, borderRadius: '6px', cursor: allRoteiroIds.length > 0 ? 'pointer' : 'default', fontSize: '0.6rem', fontWeight: 700,
                color: allRoteiroIds.length > 0 ? DS.red : 'rgba(244,247,255,0.18)',
                border: `1px solid ${allRoteiroIds.length > 0 ? 'rgba(239,68,68,0.3)' : 'transparent'}`,
                '&:hover': allRoteiroIds.length > 0 ? { bgcolor: 'rgba(239,68,68,0.12)' } : {}, transition: 'all 0.15s ease' }}>
              🗑 Limpar tudo
            </Box>
          </>
        )}
      </Box>

      {/* Row 2: Search + Sort (list and grid modes only) */}
      {viewMode !== 'timeline' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.8 }}>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.8, px: 1.2, py: 0.6,
            borderRadius: '10px', bgcolor: 'rgba(244,247,255,0.04)', border: '1px solid rgba(244,247,255,0.08)',
            '&:focus-within': { borderColor: `${ROT_COLOR}40` }, transition: 'border-color 0.2s' }}>
            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(244,247,255,0.25)', lineHeight: 1, flexShrink: 0 }}>🔍</Typography>
            <Box component="input"
              value={searchQuery}
              onChange={(e: { target: { value: string } }) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente…"
              sx={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '0.72rem', fontFamily: 'inherit',
                '&::placeholder': { color: 'rgba(244,247,255,0.22)' } }} />
            {searchQuery && (
              <Box onClick={() => setSearchQuery('')}
                sx={{ color: 'rgba(244,247,255,0.28)', fontSize: '0.62rem', cursor: 'pointer', flexShrink: 0, lineHeight: 1,
                  '&:hover': { color: 'rgba(244,247,255,0.7)' }, transition: 'color 0.15s' }}>✕</Box>
            )}
          </Box>
          <Box onClick={() => setSortMode(v => {
            const opts = ['alpha-asc', 'alpha-desc', 'most', 'overdue'] as const
            return opts[(opts.indexOf(v) + 1) % opts.length]
          })}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.55, borderRadius: '8px', cursor: 'pointer',
              bgcolor: 'rgba(244,247,255,0.04)', border: '1px solid rgba(244,247,255,0.08)', whiteSpace: 'nowrap',
              color: 'rgba(244,247,255,0.45)', '&:hover': { bgcolor: 'rgba(244,247,255,0.07)', color: 'rgba(244,247,255,0.75)' }, transition: 'all 0.15s' }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, lineHeight: 1 }}>
              {{ 'alpha-asc': 'A→Z', 'alpha-desc': 'Z→A', 'most': '# Qtd', 'overdue': '🔴 Atrasos' }[sortMode]}
            </Typography>
            <Typography sx={{ fontSize: '0.5rem', color: 'rgba(244,247,255,0.28)', lineHeight: 1 }}>⇅</Typography>
          </Box>
        </Box>
      )}

      {/* Row 3: Quick filters + count */}
      {viewMode !== 'timeline' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
          {([['all', 'Todos'], ['with', 'Com roteiros'], ['without', 'Sem roteiros'], ['overdue', 'Atrasados']] as const).map(([k, lbl]) => {
            const active = quickFilter === k
            const c = k === 'overdue' ? DS.red : k === 'with' ? ROT_COLOR : 'rgba(244,247,255,0.55)'
            return (
              <Box key={k} onClick={() => setQuickFilter(k)}
                sx={{ px: 0.9, py: 0.3, borderRadius: '7px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: active ? 700 : 500,
                  bgcolor: active ? `${c}14` : 'rgba(244,247,255,0.03)',
                  border: `1px solid ${active ? c + '35' : 'rgba(244,247,255,0.07)'}`,
                  color: active ? c : 'rgba(244,247,255,0.38)',
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
                  bgcolor: active ? `${c}14` : 'rgba(244,247,255,0.03)',
                  border: `1px solid ${active ? c + '35' : 'rgba(244,247,255,0.07)'}`,
                  color: active ? c : 'rgba(244,247,255,0.38)',
                  display: 'flex', alignItems: 'center', gap: 0.4,
                  transition: 'all 0.15s ease' }}>
                {resp?.emoji} Meus clientes
              </Box>
            )
          })()}
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: '0.58rem', color: 'rgba(244,247,255,0.22)' }}>
            {filteredSorted.length} cliente{filteredSorted.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      )}

      {/* KPI strip */}
      {stats.total > 0 && (
        <Box sx={{ display: 'flex', gap: 0.8, mb: 1.2, flexWrap: 'wrap' }}>
          {[
            { label: 'roteiros', value: stats.total, color: ROT_COLOR },
            { label: 'com docs', value: stats.withDocs, color: DS.accent },
            { label: 'com prazo', value: stats.withDeadline, color: DS.purpleSoft },
            ...(stats.overdue > 0 ? [{ label: 'atrasados', value: stats.overdue, color: DS.red }] : []),
          ].map(s => (
            <Box key={s.label} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.4, px: 1, py: 0.4, borderRadius: '7px',
              bgcolor: `${s.color}0a`, border: `1px solid ${s.color}1e` }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, lineHeight: 1, color: s.color }}>{s.value}</Typography>
              <Typography sx={{ fontSize: '0.52rem', color: 'rgba(244,247,255,0.28)', lineHeight: 1, fontWeight: 500 }}>{s.label}</Typography>
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
                    borderRadius: '12px', border: '1px solid rgba(244,247,255,0.06)',
                    bgcolor: 'rgba(244,247,255,0.018)', overflow: 'hidden',
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
                        <Box {...clickableStop(() => setEditingCol(st))}
                          title="Renomear coluna" aria-label={`Renomear coluna ${colLabel(st)}`}
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
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.2)', textAlign: 'center', py: 2 }}>
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
                  <Typography sx={{ fontSize: '0.55rem', color: 'rgba(244,247,255,0.42)' }}>{kanbanDragRoteiro.clientName}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(244,247,255,0.9)', lineHeight: 1.25 }}>
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
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.25)' }}>
                {searchQuery ? `Nenhum resultado para "${searchQuery}"` : 'Nenhum cliente encontrado'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {clientGroups.map((group, gi) => {
                const isCollapsed = collapsedGroups.has(group.key)
                return (
                  <Box key={group.key}>
                    <Box {...clickable(() => setCollapsedGroups(prev => { const n = new Set(prev); n.has(group.key) ? n.delete(group.key) : n.add(group.key); return n }))}
                      aria-expanded={!collapsedGroups.has(group.key)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.8, py: 0.6, px: 0.6, mb: 0.3, cursor: 'pointer',
                        borderRadius: '8px', userSelect: 'none', '&:hover': { bgcolor: 'rgba(244,247,255,0.03)' }, transition: 'background 0.15s' }}>
                      <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                        color: group.key === 'overdue' ? DS.red : group.key === 'active' ? ROT_COLOR : 'rgba(244,247,255,0.3)' }}>
                        {group.key === 'overdue' ? '🔴 ' : ''}{group.label}
                      </Typography>
                      <Box sx={{ px: 0.6, py: 0.1, borderRadius: '4px',
                        bgcolor: group.key === 'overdue' ? 'rgba(239,68,68,0.12)' : group.key === 'active' ? `${ROT_COLOR}14` : 'rgba(244,247,255,0.06)' }}>
                        <Typography sx={{ fontSize: '0.55rem', fontWeight: 700,
                          color: group.key === 'overdue' ? DS.red : group.key === 'active' ? ROT_COLOR : 'rgba(244,247,255,0.32)' }}>{group.clients.length}</Typography>
                      </Box>
                      <Box sx={{ flex: 1 }} />
                      <Typography sx={{ fontSize: '0.55rem', color: 'rgba(244,247,255,0.2)', lineHeight: 1 }}>
                        {isCollapsed ? '▶' : '▾'}
                      </Typography>
                    </Box>

                    {!isCollapsed && (
                      <Box sx={{ borderRadius: '12px', border: '1px solid rgba(244,247,255,0.06)', overflow: 'hidden' }}>
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
                                  borderBottom: (!isLast || isExpanded) ? '1px solid rgba(244,247,255,0.04)' : 'none',
                                  '&:hover': { bgcolor: 'rgba(244,247,255,0.025)' }, transition: 'background 0.15s' }}>
                                {selectMode && (
                                  <Box {...clickableStop(() => toggleAll(list.map(r => r.id)))}
                                    sx={{ width: 15, height: 15, borderRadius: '4px', flexShrink: 0,
                                      border: `1.5px solid ${list.length > 0 && list.every(r => selected.has(r.id)) ? ROT_COLOR : 'rgba(244,247,255,0.22)'}`,
                                      bgcolor: list.length > 0 && list.every(r => selected.has(r.id)) ? `${ROT_COLOR}30` : 'transparent',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: '0.45rem', color: ROT_COLOR, fontWeight: 900, transition: 'all 0.15s ease' }}>
                                    {list.length > 0 && list.every(r => selected.has(r.id)) && '✓'}
                                  </Box>
                                )}
                                <Box sx={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, bgcolor: status.color,
                                  ...(status.level === 'overdue' && { boxShadow: `0 0 6px ${status.color}66` }) }} />
                                <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgba(244,247,255,0.88)', flex: 1, lineHeight: 1 }} noWrap>
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
                                    <Box sx={{ px: 0.7, py: 0.15, borderRadius: '5px', bgcolor: 'rgba(244,247,255,0.05)' }}>
                                      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.40)', fontWeight: 600, lineHeight: 1 }}>{cs.total}</Typography>
                                    </Box>
                                    {cs.withDocs > 0 && (
                                      <Box sx={{ px: 0.6, py: 0.15, borderRadius: '5px', bgcolor: 'rgba(59,130,246,0.09)', border: '1px solid rgba(59,130,246,0.18)' }}>
                                        <Typography sx={{ fontSize: '0.58rem', color: DS.accent, fontWeight: 600, lineHeight: 1 }}>📄 {cs.withDocs}</Typography>
                                      </Box>
                                    )}
                                    {cs.overdue > 0 && (
                                      <Box sx={{ px: 0.6, py: 0.15, borderRadius: '5px', bgcolor: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.18)' }}>
                                        <Typography sx={{ fontSize: '0.58rem', color: DS.red, fontWeight: 700, lineHeight: 1 }}>{cs.overdue} atraso</Typography>
                                      </Box>
                                    )}
                                    {cs.nextDeadline && cs.overdue === 0 && (
                                      <Typography sx={{ fontSize: '0.58rem', color: 'rgba(244,247,255,0.25)', lineHeight: 1, flexShrink: 0 }}>
                                        {getDeadlineLabel(cs.nextDeadline)}
                                      </Typography>
                                    )}
                                  </Box>
                                )}
                                <Box sx={{ display: 'flex', gap: 0.3, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                  {driveFolder && (
                                    <Box component="a" href={driveFolder} target="_blank" rel="noopener noreferrer"
                                      sx={{ width: 22, height: 22, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        bgcolor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', color: DS.accent, fontSize: '0.62rem',
                                        textDecoration: 'none', '&:hover': { bgcolor: 'rgba(59,130,246,0.18)' }, transition: 'all 0.15s' }}>☁️</Box>
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
                                <Typography sx={{ fontSize: '0.55rem', color: 'rgba(244,247,255,0.18)', flexShrink: 0, ml: 0.3, lineHeight: 1 }}>
                                  {isExpanded ? '▾' : '▸'}
                                </Typography>
                              </Box>

                              {isExpanded && (
                                <Box sx={{ bgcolor: 'rgba(0,0,0,0.1)', borderBottom: !isLast ? '1px solid rgba(244,247,255,0.04)' : 'none' }}>
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
                                          color: 'rgba(244,247,255,0.3)', border: '1px solid rgba(244,247,255,0.08)',
                                          '&:hover': { color: 'rgba(244,247,255,0.6)' }, transition: 'all 0.15s ease' }}>✕</Box>
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
                                        sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid rgba(244,247,255,0.10)`, borderRadius: '6px',
                                          px: 1, py: 0.5, color: '#fff', fontSize: '0.65rem', fontWeight: 600, outline: 'none', width: '100%', boxSizing: 'border-box',
                                          '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s', fontFamily: 'inherit' }} />
                                      <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                                        {ALL_TYPES.map(tp => (
                                          <Box key={tp} onClick={() => setNewForms(p => ({ ...p, [clientName]: { ...p[clientName], type: tp } }))}
                                            sx={{ px: 0.8, py: 0.25, borderRadius: '5px', cursor: 'pointer', fontSize: '0.56rem', fontWeight: 700,
                                              background: newForm.type === tp ? `${ROT_COLOR}25` : 'rgba(244,247,255,0.04)',
                                              border: `1px solid ${newForm.type === tp ? ROT_COLOR + '50' : 'rgba(244,247,255,0.07)'}`,
                                              color: newForm.type === tp ? ROT_COLOR : 'rgba(244,247,255,0.35)', transition: 'all 0.15s ease' }}>{tp}</Box>
                                        ))}
                                      </Box>
                                      <Box component="input" value={newForm.docsLink}
                                        onChange={(e: { target: { value: string } }) => setNewForms(p => ({ ...p, [clientName]: { ...p[clientName], docsLink: e.target.value } }))}
                                        placeholder="📄 Link do Docs — distribui automaticamente ao calendário"
                                        sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${ROT_COLOR}22`, borderRadius: '6px',
                                          px: 1, py: 0.5, color: '#fff', fontSize: '0.6rem', outline: 'none', width: '100%', boxSizing: 'border-box',
                                          '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s', fontFamily: 'inherit' }} />
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                        <Typography sx={{ fontSize: '0.52rem', color: DS.purpleSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Prazo:</Typography>
                                        <Box component="input" type="date" value={newForm.deadline}
                                          onChange={(e: { target: { value: string } }) => setNewForms(p => ({ ...p, [clientName]: { ...p[clientName], deadline: e.target.value } }))}
                                          sx={{ flex: 1, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(192,132,252,0.22)', borderRadius: '6px',
                                            px: 0.8, py: 0.4, color: newForm.deadline ? '#fff' : 'rgba(244,247,255,0.28)', fontSize: '0.6rem', outline: 'none',
                                            '&:focus': { borderColor: DS.purpleSoft }, transition: 'border-color 0.15s', colorScheme: 'dark', fontFamily: 'inherit' }} />
                                      </Box>
                                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                                        <Box onClick={() => closeNewForm(clientName)}
                                          sx={{ px: 1, py: 0.4, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 600,
                                            color: 'rgba(244,247,255,0.32)', border: '1px solid rgba(244,247,255,0.08)',
                                            '&:hover': { color: '#fff' }, transition: 'all 0.15s ease' }}>Cancelar</Box>
                                        <Box onClick={() => submitNewForm(clientName)}
                                          sx={{ px: 1.2, py: 0.4, borderRadius: '6px', cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700,
                                            background: newForm.title.trim() ? `linear-gradient(135deg, ${ROT_COLOR}, #f43f5e)` : 'rgba(244,247,255,0.06)',
                                            color: newForm.title.trim() ? '#fff' : 'rgba(244,247,255,0.25)',
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
                                            <Box {...(selectMode ? clickable(() => toggleSelect(r.id)) : {})}
                                              aria-pressed={selectMode ? isSelected : undefined}
                                              sx={{ display: 'flex', alignItems: 'center', gap: 0.8, py: 0.6, px: 0.8, borderRadius: '7px',
                                                bgcolor: isSelected ? `${ROT_COLOR}08` : 'transparent',
                                                cursor: selectMode ? 'pointer' : 'default',
                                                '&:hover': { bgcolor: selectMode ? `${ROT_COLOR}10` : 'rgba(244,247,255,0.02)' },
                                                transition: 'background 0.15s' }}>
                                              {selectMode && (
                                                <Box sx={{ width: 13, height: 13, borderRadius: '3px', flexShrink: 0,
                                                  border: `1.5px solid ${isSelected ? ROT_COLOR : 'rgba(244,247,255,0.22)'}`,
                                                  bgcolor: isSelected ? `${ROT_COLOR}35` : 'transparent',
                                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                  fontSize: '0.45rem', color: ROT_COLOR, fontWeight: 900 }}>
                                                  {isSelected && '✓'}
                                                </Box>
                                              )}
                                              <Box sx={{ width: 4, height: 4, borderRadius: '50%', flexShrink: 0, bgcolor: dcolor ?? 'rgba(244,247,255,0.22)' }} />
                                              <Typography sx={{ flex: 1, fontSize: '0.72rem', fontWeight: 600, color: 'rgba(244,247,255,0.78)', lineHeight: 1 }} noWrap>
                                                {r.title || '(sem título)'}
                                              </Typography>
                                              <Typography sx={{ fontSize: '0.55rem', color: 'rgba(244,247,255,0.28)', flexShrink: 0 }}>{r.type}</Typography>
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
                                                        bgcolor: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)', color: DS.accent, fontSize: '0.56rem',
                                                        '&:hover': { bgcolor: 'rgba(59,130,246,0.20)' }, transition: 'all 0.15s' }}>☁️</Box>
                                                  )}
                                                  {onUpdateRoteiro && (
                                                    <Box {...clickableStop(() => openEdit(r))}
                                                      sx={{ px: 0.4, py: 0.1, borderRadius: '4px', cursor: 'pointer', fontSize: '0.54rem',
                                                        color: 'rgba(244,247,255,0.18)', '&:hover': { color: ROT_COLOR }, transition: 'color 0.15s' }}>✏️</Box>
                                                  )}
                                                </Box>
                                              )}
                                            </Box>
                                            {isEditing && (
                                              <Box sx={{ ml: 3.5, mb: 0.5, p: 1, borderRadius: '8px',
                                                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(244,247,255,0.08)',
                                                display: 'flex', flexDirection: 'column', gap: 0.7 }}>
                                                <Box component="input" autoFocus value={ed.title}
                                                  onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], title: e.target.value } }))}
                                                  onKeyDown={(e: { key: string }) => { if (e.key === 'Escape') closeEdit(r.id) }}
                                                  sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid rgba(244,247,255,0.12)`, borderRadius: '6px',
                                                    px: 1, py: 0.5, color: '#fff', fontSize: '0.65rem', fontWeight: 700, outline: 'none', width: '100%', boxSizing: 'border-box',
                                                    '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s', fontFamily: 'inherit' }} />
                                                <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                                                  {ALL_TYPES.map(tp => (
                                                    <Box key={tp} onClick={() => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], type: tp } }))}
                                                      sx={{ px: 0.7, py: 0.25, borderRadius: '5px', cursor: 'pointer', fontSize: '0.56rem', fontWeight: 700,
                                                        background: ed.type === tp ? `${ROT_COLOR}25` : 'rgba(244,247,255,0.04)',
                                                        border: `1px solid ${ed.type === tp ? ROT_COLOR + '50' : 'rgba(244,247,255,0.08)'}`,
                                                        color: ed.type === tp ? ROT_COLOR : 'rgba(244,247,255,0.4)', transition: 'all 0.15s ease' }}>{tp}</Box>
                                                  ))}
                                                </Box>
                                                <Box component="input" value={ed.docsLink}
                                                  onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], docsLink: e.target.value } }))}
                                                  placeholder="📄 Link Docs"
                                                  sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${ROT_COLOR}25`, borderRadius: '6px',
                                                    px: 1, py: 0.45, color: '#fff', fontSize: '0.6rem', outline: 'none', width: '100%', boxSizing: 'border-box',
                                                    '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s', fontFamily: 'inherit' }} />
                                                <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'center' }}>
                                                  <Typography sx={{ fontSize: '0.52rem', color: DS.purpleSoft, fontWeight: 700, flexShrink: 0 }}>Prazo:</Typography>
                                                  <Box component="input" type="date" value={ed.deadline}
                                                    onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], deadline: e.target.value } }))}
                                                    sx={{ flex: 1, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(192,132,252,0.22)', borderRadius: '6px',
                                                      px: 0.8, py: 0.4, color: ed.deadline ? '#fff' : 'rgba(244,247,255,0.28)', fontSize: '0.6rem', outline: 'none',
                                                      '&:focus': { borderColor: DS.purpleSoft }, transition: 'border-color 0.15s', colorScheme: 'dark', fontFamily: 'inherit' }} />
                                                </Box>
                                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                                                  <Box onClick={() => closeEdit(r.id)}
                                                    sx={{ px: 1, py: 0.4, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 600,
                                                      color: 'rgba(244,247,255,0.35)', border: '1px solid rgba(244,247,255,0.08)',
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
                                      <Typography sx={{ fontSize: '0.62rem', color: 'rgba(244,247,255,0.20)' }}>sem roteiros este mês</Typography>
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
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.3)' }}>Nenhum cliente encontrado</Typography>
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
                            border: `1.5px solid ${list.length > 0 && list.every(r => selected.has(r.id)) ? ROT_COLOR : 'rgba(244,247,255,0.25)'}`,
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
                        <Typography sx={{ fontSize: '0.56rem', color: 'rgba(244,247,255,0.32)' }}>
                          {list.length > 0 ? `${list.length} roteiro${list.length !== 1 ? 's' : ''}` : 'nenhum este mês'}
                        </Typography>
                      </Box>
                      {driveFolder && (
                        <Box component="a" href={driveFolder} target="_blank" rel="noopener noreferrer"
                          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '6px', textDecoration: 'none',
                            background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.2)', color: DS.accent, fontSize: '0.7rem',
                            '&:hover': { background: 'rgba(59,130,246,0.18)' }, transition: 'all 0.15s ease' }}>
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
                            background: importLoading === clientName ? 'rgba(244,247,255,0.05)' : `${ROT_COLOR}20`,
                            border: `1px solid ${ROT_COLOR}40`, color: ROT_COLOR, display: 'flex', alignItems: 'center',
                            '&:hover': { background: `${ROT_COLOR}35` }, transition: 'all 0.15s ease' }}>
                          {importLoading === clientName ? '…' : '↵'}
                        </Box>
                        <Box onClick={() => setImportInput(p => { const n = { ...p }; delete n[clientName]; return n })}
                          sx={{ px: 0.7, py: 0.4, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem',
                            color: 'rgba(244,247,255,0.3)', border: '1px solid rgba(244,247,255,0.08)',
                            '&:hover': { color: 'rgba(244,247,255,0.6)' }, transition: 'all 0.15s ease' }}>
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
                          sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid rgba(244,247,255,0.10)`, borderRadius: '6px',
                            px: 1, py: 0.5, color: '#fff', fontSize: '0.65rem', fontWeight: 600, outline: 'none', width: '100%', boxSizing: 'border-box',
                            '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s' }} />
                        <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                          {ALL_TYPES.map(tp => (
                            <Box key={tp} onClick={() => setNewForms(p => ({ ...p, [clientName]: { ...p[clientName], type: tp } }))}
                              sx={{ px: 0.8, py: 0.25, borderRadius: '5px', cursor: 'pointer', fontSize: '0.56rem', fontWeight: 700,
                                background: newForm.type === tp ? `${ROT_COLOR}25` : 'rgba(244,247,255,0.04)',
                                border: `1px solid ${newForm.type === tp ? ROT_COLOR + '50' : 'rgba(244,247,255,0.07)'}`,
                                color: newForm.type === tp ? ROT_COLOR : 'rgba(244,247,255,0.35)',
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
                          <Typography sx={{ fontSize: '0.52rem', color: DS.purpleSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                            Prazo:
                          </Typography>
                          <Box component="input" type="date"
                            value={newForm.deadline}
                            onChange={(e: { target: { value: string } }) => setNewForms(p => ({ ...p, [clientName]: { ...p[clientName], deadline: e.target.value } }))}
                            sx={{ flex: 1, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(192,132,252,0.22)', borderRadius: '6px',
                              px: 0.8, py: 0.4, color: newForm.deadline ? '#fff' : 'rgba(244,247,255,0.28)', fontSize: '0.6rem', outline: 'none',
                              '&:focus': { borderColor: DS.purpleSoft }, transition: 'border-color 0.15s', colorScheme: 'dark' }} />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          <Box onClick={() => closeNewForm(clientName)}
                            sx={{ px: 1, py: 0.4, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 600,
                              color: 'rgba(244,247,255,0.32)', border: '1px solid rgba(244,247,255,0.08)',
                              '&:hover': { color: '#fff' }, transition: 'all 0.15s ease' }}>
                            Cancelar
                          </Box>
                          <Box onClick={() => submitNewForm(clientName)}
                            sx={{ px: 1.2, py: 0.4, borderRadius: '6px', cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700,
                              background: newForm.title.trim() ? `linear-gradient(135deg, ${ROT_COLOR}, #f43f5e)` : 'rgba(244,247,255,0.06)',
                              color: newForm.title.trim() ? '#fff' : 'rgba(244,247,255,0.25)',
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
                              {...(selectMode ? clickable(() => toggleSelect(r.id)) : {})}
                              sx={{
                                px: 1.2, py: 0.8, borderRadius: '9px',
                                background: isSelected ? `${ROT_COLOR}10` : isExpanded ? 'rgba(244,247,255,0.05)' : 'rgba(244,247,255,0.025)',
                                border: `1px solid ${isSelected ? ROT_COLOR + '35' : isExpanded ? ROT_COLOR + '28' : hasLinks ? 'rgba(251,113,133,0.16)' : 'rgba(244,247,255,0.05)'}`,
                                display: 'flex', flexDirection: 'column', gap: 0.5,
                                cursor: selectMode ? 'pointer' : 'default',
                                transition: 'all 0.15s ease',
                              }}>

                              {/* Main row */}
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                                {selectMode && (
                                  <Box sx={{ width: 15, height: 15, borderRadius: '4px', flexShrink: 0, mt: 0.1,
                                    border: `1.5px solid ${isSelected ? ROT_COLOR : 'rgba(244,247,255,0.22)'}`,
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
                                  <Typography sx={{ fontSize: '0.55rem', color: 'rgba(244,247,255,0.28)', lineHeight: 1, mt: 0.1 }}>
                                    {r.type}
                                  </Typography>
                                </Box>
                                {!selectMode && !isExpanded && (
                                  <Box sx={{ display: 'flex', gap: 0.3, alignItems: 'center', flexShrink: 0 }}>
                                    {r.driveLink && (
                                      <Box component="a" href={r.driveLink} target="_blank" rel="noopener noreferrer"
                                        sx={{ px: 0.55, py: 0.2, borderRadius: '5px', textDecoration: 'none',
                                          background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.22)', color: DS.accent, fontSize: '0.6rem',
                                          '&:hover': { background: 'rgba(59,130,246,0.20)' }, transition: 'all 0.15s ease' }}>
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
                                          color: 'rgba(244,247,255,0.18)', border: '1px solid transparent',
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
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mt: 0.3, pt: 0.8, borderTop: '1px solid rgba(244,247,255,0.06)' }}>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                    <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(244,247,255,0.3)' }}>Título</Typography>
                                    <Box component="input" autoFocus
                                      value={ed.title}
                                      onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], title: e.target.value } }))}
                                      onKeyDown={(e: { key: string }) => { if (e.key === 'Escape') closeEdit(r.id) }}
                                      sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid rgba(244,247,255,0.12)`, borderRadius: '6px',
                                        px: 1, py: 0.5, color: '#fff', fontSize: '0.65rem', fontWeight: 700, outline: 'none', width: '100%', boxSizing: 'border-box',
                                        '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s' }} />
                                  </Box>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                    <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(244,247,255,0.3)' }}>Tipo</Typography>
                                    <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                                      {ALL_TYPES.map(tp => (
                                        <Box key={tp} onClick={() => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], type: tp } }))}
                                          sx={{ px: 0.8, py: 0.3, borderRadius: '6px', cursor: 'pointer', fontSize: '0.58rem', fontWeight: 700,
                                            background: ed.type === tp ? `${ROT_COLOR}25` : 'rgba(244,247,255,0.04)',
                                            border: `1px solid ${ed.type === tp ? ROT_COLOR + '50' : 'rgba(244,247,255,0.08)'}`,
                                            color: ed.type === tp ? ROT_COLOR : 'rgba(244,247,255,0.4)',
                                            transition: 'all 0.15s ease' }}>
                                          {tp}
                                        </Box>
                                      ))}
                                    </Box>
                                  </Box>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                    <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(244,247,255,0.3)' }}>☁️ Drive</Typography>
                                    <Box component="input"
                                      value={ed.driveLink}
                                      onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], driveLink: e.target.value } }))}
                                      placeholder="https://drive.google.com/..."
                                      sx={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '6px',
                                        px: 1, py: 0.5, color: '#fff', fontSize: '0.6rem', outline: 'none', width: '100%', boxSizing: 'border-box',
                                        '&:focus': { borderColor: DS.accent }, transition: 'border-color 0.15s' }} />
                                  </Box>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                    <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(244,247,255,0.3)' }}>📄 Docs</Typography>
                                    <Box component="input"
                                      value={ed.docsLink}
                                      onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], docsLink: e.target.value } }))}
                                      placeholder="https://docs.google.com/document/d/..."
                                      sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${ROT_COLOR}25`, borderRadius: '6px',
                                        px: 1, py: 0.5, color: '#fff', fontSize: '0.6rem', outline: 'none', width: '100%', boxSizing: 'border-box',
                                        '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s' }} />
                                  </Box>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                    <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(244,247,255,0.3)' }}>🔗 Referências</Typography>
                                    <Box component="input"
                                      value={ed.refLink}
                                      onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], refLink: e.target.value } }))}
                                      placeholder="Link de referências usadas no roteiro..."
                                      sx={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(59,130,246,0.22)', borderRadius: '6px',
                                        px: 1, py: 0.5, color: '#fff', fontSize: '0.6rem', outline: 'none', width: '100%', boxSizing: 'border-box',
                                        '&:focus': { borderColor: DS.accent }, transition: 'border-color 0.15s' }} />
                                  </Box>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                    <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(244,247,255,0.3)' }}>🗓 Prazo</Typography>
                                    <Box component="input" type="date"
                                      value={ed.deadline}
                                      onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], deadline: e.target.value } }))}
                                      sx={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(192,132,252,0.25)', borderRadius: '6px',
                                        px: 1, py: 0.5, color: ed.deadline ? '#fff' : 'rgba(244,247,255,0.28)', fontSize: '0.6rem', outline: 'none', width: '100%', boxSizing: 'border-box',
                                        '&:focus': { borderColor: DS.purpleSoft }, transition: 'border-color 0.15s', colorScheme: 'dark' }} />
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 0.6, justifyContent: 'flex-end' }}>
                                    <Box onClick={() => closeEdit(r.id)}
                                      sx={{ px: 1.2, py: 0.5, borderRadius: '7px', cursor: 'pointer', fontSize: '0.62rem', fontWeight: 600,
                                        color: 'rgba(244,247,255,0.4)', border: '1px solid rgba(244,247,255,0.1)',
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
                          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.2)' }}>sem roteiros este mês</Typography>
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
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.28)' }}>Nenhum roteiro em {MONTH_NAMES_ROT[viewMonth]}/{String(viewYear).slice(2)}</Typography>
              </Box>
            ) : (
              <>
                {timelineItems.withDeadline.map(({ roteiro: r, clientName }) => {
                  const level = getRoteiroDeadlineLevel(r.deadline!)
                  const color = ROT_DEADLINE_COLOR[level]
                  return (
                    <Box key={r.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2, px: 1.4, py: 1.1, borderRadius: '11px',
                      background: 'rgba(244,247,255,0.025)', border: `1px solid ${color}18`,
                      borderLeft: `3px solid ${color}`,
                      '&:hover': { background: 'rgba(244,247,255,0.04)' }, transition: 'background 0.15s' }}>
                      <Box sx={{ flexShrink: 0, textAlign: 'center', minWidth: 46, pt: 0.2 }}>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color, lineHeight: 1.1 }}>
                          {getDeadlineLabel(r.deadline!)}
                        </Typography>
                        <Typography sx={{ fontSize: '0.48rem', color: 'rgba(244,247,255,0.28)', lineHeight: 1.4, mt: 0.1 }}>prazo</Typography>
                      </Box>
                      <Box sx={{ width: 1, alignSelf: 'stretch', bgcolor: `${color}20`, mx: 0.2, flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 0.25 }}>
                          <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(244,247,255,0.90)', lineHeight: 1 }} noWrap>
                            {r.title || '(sem título)'}
                          </Typography>
                          <Box sx={{ px: 0.5, py: 0.12, borderRadius: '4px', bgcolor: 'rgba(244,247,255,0.05)', border: '1px solid rgba(244,247,255,0.07)', flexShrink: 0 }}>
                            <Typography sx={{ fontSize: '0.5rem', color: 'rgba(244,247,255,0.32)', fontWeight: 700, lineHeight: 1 }}>{r.type}</Typography>
                          </Box>
                        </Box>
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.38)', fontWeight: 600 }}>{clientName}</Typography>
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
                      <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(244,247,255,0.06)' }} />
                      <Typography sx={{ fontSize: '0.56rem', color: 'rgba(244,247,255,0.22)', fontWeight: 600, px: 1 }}>sem prazo</Typography>
                      <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(244,247,255,0.06)' }} />
                    </Box>
                    {timelineItems.withoutDeadline.map(({ roteiro: r, clientName }) => (
                      <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, px: 1.4, py: 0.9, borderRadius: '9px',
                        background: 'rgba(244,247,255,0.02)', border: '1px solid rgba(244,247,255,0.05)' }}>
                        <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'rgba(244,247,255,0.22)', flexShrink: 0 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(244,247,255,0.65)' }} noWrap>{r.title}</Typography>
                          <Typography sx={{ fontSize: '0.55rem', color: 'rgba(244,247,255,0.32)' }}>{clientName} · {r.type}</Typography>
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
          border: '1px solid rgba(244,247,255,0.1)', borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          zIndex: 10,
        }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>
            {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
          </Typography>
          <Box onClick={() => { onDeleteMany?.(Array.from(selected)); exitSelectMode() }}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.6, px: 1.2, py: 0.6, borderRadius: '8px', cursor: 'pointer',
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: DS.red,
              fontSize: '0.65rem', fontWeight: 700, '&:hover': { background: 'rgba(239,68,68,0.25)' }, transition: 'all 0.15s ease' }}>
            🗑 Excluir {selected.size}
          </Box>
          <Box onClick={exitSelectMode}
            sx={{ px: 1, py: 0.6, borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600,
              color: 'rgba(244,247,255,0.4)', border: '1px solid rgba(244,247,255,0.1)',
              '&:hover': { color: '#fff' }, transition: 'all 0.15s ease' }}>
            Cancelar
          </Box>
        </Box>
      )}

      {/* Modal de confirmação de importação */}
      {importModal && (
        <Dialog open={importModal.open} onClose={() => setImportModal(null)}
          PaperProps={{ sx: { background: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(244,247,255,0.07)', borderRadius: '20px', minWidth: 360, maxWidth: 500 } }}>
          <DialogTitle sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff', pb: 0.5 }}>
            📄 Importar roteiros do Google Docs
          </DialogTitle>
          <DialogContent sx={{ pb: 0 }}>
            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(244,247,255,0.4)', mb: 1.5 }}>
              {importModal.clientName} · {MONTH_NAMES_ROT[viewMonth]}/{String(viewYear).slice(2)} · {importModal.items.filter(i => i.selected).length} de {importModal.items.length} selecionados
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 340, overflowY: 'auto', pr: 0.5 }}>
              {importModal.items.map((item, idx) => (
                <Box key={idx} onClick={() => setImportModal(prev => prev ? { ...prev, items: prev.items.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it) } : null)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.7, borderRadius: '8px', cursor: 'pointer',
                    background: item.selected ? `${ROT_COLOR}08` : 'rgba(244,247,255,0.02)',
                    border: `1px solid ${item.selected ? ROT_COLOR + '25' : 'rgba(244,247,255,0.05)'}`,
                    transition: 'all 0.15s ease' }}>
                  <Box sx={{ width: 14, height: 14, borderRadius: '4px', flexShrink: 0, border: `1.5px solid ${item.selected ? ROT_COLOR : 'rgba(244,247,255,0.2)'}`,
                    background: item.selected ? `${ROT_COLOR}30` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.5rem', color: ROT_COLOR, fontWeight: 900 }}>
                    {item.selected && '✓'}
                  </Box>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: item.selected ? '#fff' : 'rgba(244,247,255,0.45)', flex: 1 }} noWrap>
                    {item.title}
                  </Typography>
                  <Box sx={{ fontSize: '0.55rem', color: 'rgba(244,247,255,0.3)', px: 0.6, py: 0.2, borderRadius: '4px', bgcolor: 'rgba(244,247,255,0.05)', flexShrink: 0 }}>
                    {item.type}
                  </Box>
                </Box>
              ))}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1.5, gap: 1 }}>
            <Box onClick={() => setImportModal(null)}
              sx={{ px: 1.5, py: 0.8, borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600,
                color: 'rgba(244,247,255,0.4)', border: '1px solid rgba(244,247,255,0.1)', '&:hover': { bgcolor: 'rgba(244,247,255,0.04)' }, transition: 'all 0.15s ease' }}>
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
            PaperProps={{ sx: { background: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(244,247,255,0.07)', borderRadius: '20px', backgroundImage: 'none' } }}>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }} noWrap>{clientName}</Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.4)' }}>
                    {MONTH_NAMES_ROT[viewMonth]}/{String(viewYear).slice(2)} · {ROTEIRO_STATUS_CFG[st].icon} {colLabel(st)}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={closeModal} sx={{ color: 'rgba(244,247,255,0.4)' }}>
                  <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>✕</Typography>
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent dividers sx={{ borderColor: 'rgba(244,247,255,0.06)', display: 'flex', flexDirection: 'column', gap: 1.4 }}>
              {/* Status */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(244,247,255,0.3)' }}>Status</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {ROTEIRO_STATUS_FLOW.map(s => {
                    const cfg = ROTEIRO_STATUS_CFG[s]
                    const active = st === s
                    return (
                      <Box key={s} onClick={() => onUpdateRoteiro?.(clientName, r.id, { status: s })}
                        sx={{ px: 1, py: 0.4, borderRadius: '7px', cursor: 'pointer', fontSize: '0.62rem', fontWeight: active ? 800 : 600,
                          bgcolor: active ? `${cfg.color}25` : 'rgba(244,247,255,0.04)',
                          border: `1px solid ${active ? cfg.color : 'rgba(244,247,255,0.1)'}`,
                          color: active ? cfg.color : 'rgba(244,247,255,0.45)', transition: 'all 0.15s ease' }}>
                        {cfg.icon} {colLabel(s)}
                      </Box>
                    )
                  })}
                </Box>
              </Box>
              {/* Título */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(244,247,255,0.3)' }}>Título</Typography>
                <Box component="input" autoFocus value={ed.title}
                  onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], title: e.target.value } }))}
                  sx={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(244,247,255,0.12)', borderRadius: '7px', px: 1, py: 0.6, color: '#fff', fontSize: '0.72rem', fontWeight: 700, outline: 'none', width: '100%', boxSizing: 'border-box', '&:focus': { borderColor: ROT_COLOR } }} />
              </Box>
              {/* Tipo */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(244,247,255,0.3)' }}>Tipo</Typography>
                <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                  {ALL_TYPES.map(tp => (
                    <Box key={tp} onClick={() => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], type: tp } }))}
                      sx={{ px: 0.9, py: 0.35, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
                        background: ed.type === tp ? `${ROT_COLOR}25` : 'rgba(244,247,255,0.04)',
                        border: `1px solid ${ed.type === tp ? ROT_COLOR + '50' : 'rgba(244,247,255,0.08)'}`,
                        color: ed.type === tp ? ROT_COLOR : 'rgba(244,247,255,0.4)', transition: 'all 0.15s ease' }}>
                      {tp}
                    </Box>
                  ))}
                </Box>
              </Box>
              {/* Docs */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(244,247,255,0.3)', flex: 1 }}>📄 Roteiro (Google Docs)</Typography>
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
                  <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(244,247,255,0.3)', flex: 1 }}>🔗 Referências usadas</Typography>
                  {ed.refLink.trim() && <Box component="a" href={ed.refLink} target="_blank" rel="noopener noreferrer" sx={{ fontSize: '0.55rem', color: DS.accent, textDecoration: 'none', fontWeight: 700 }}>abrir ↗</Box>}
                </Box>
                <Box component="input" value={ed.refLink}
                  onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], refLink: e.target.value } }))}
                  placeholder="Link de referências / inspirações..."
                  sx={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(59,130,246,0.22)', borderRadius: '7px', px: 1, py: 0.6, color: '#fff', fontSize: '0.62rem', outline: 'none', width: '100%', boxSizing: 'border-box', '&:focus': { borderColor: DS.accent } }} />
              </Box>
              {/* Drive */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(244,247,255,0.3)', flex: 1 }}>☁️ Drive (material)</Typography>
                  {ed.driveLink.trim() && <Box component="a" href={ed.driveLink} target="_blank" rel="noopener noreferrer" sx={{ fontSize: '0.55rem', color: DS.green, textDecoration: 'none', fontWeight: 700 }}>abrir ↗</Box>}
                </Box>
                <Box component="input" value={ed.driveLink}
                  onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], driveLink: e.target.value } }))}
                  placeholder="https://drive.google.com/..."
                  sx={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(49,209,124,0.22)', borderRadius: '7px', px: 1, py: 0.6, color: '#fff', fontSize: '0.62rem', outline: 'none', width: '100%', boxSizing: 'border-box', '&:focus': { borderColor: DS.green } }} />
              </Box>
              {/* Prazo */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(244,247,255,0.3)' }}>🗓 Prazo de entrega</Typography>
                <Box component="input" type="date" value={ed.deadline}
                  onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], deadline: e.target.value } }))}
                  sx={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(192,132,252,0.25)', borderRadius: '7px', px: 1, py: 0.6, color: ed.deadline ? '#fff' : 'rgba(244,247,255,0.28)', fontSize: '0.62rem', outline: 'none', width: '100%', boxSizing: 'border-box', '&:focus': { borderColor: DS.purpleSoft }, colorScheme: 'dark' }} />
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 2, py: 1.4, gap: 1 }}>
              {onDeleteMany && (
                <Box onClick={() => { onDeleteMany([r.id]); closeModal() }}
                  sx={{ px: 1.2, py: 0.6, borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700,
                    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: DS.red,
                    '&:hover': { background: 'rgba(239,68,68,0.22)' }, transition: 'all 0.15s ease' }}>
                  🗑 Excluir
                </Box>
              )}
              <Box sx={{ flex: 1 }} />
              <Box onClick={closeModal}
                sx={{ px: 1.4, py: 0.6, borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600,
                  color: 'rgba(244,247,255,0.4)', border: '1px solid rgba(244,247,255,0.1)', '&:hover': { color: '#fff' }, transition: 'all 0.15s ease' }}>
                Cancelar
              </Box>
              <Box onClick={() => { saveEdit(clientName, r.id); setKanbanEditId(null) }}
                sx={{ px: 1.6, py: 0.6, borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 800,
                  background: ctaGradient(135), color: '#fff',
                  boxShadow: '0 4px 14px rgba(59,130,246,0.3)', '&:hover': { filter: 'brightness(1.08)' }, transition: 'all 0.15s ease' }}>
                Salvar
              </Box>
            </DialogActions>
          </Dialog>
        )
      })()}

      {/* Confirmação de limpeza de roteiros */}
      {clearConfirm && (
        <Dialog open onClose={() => setClearConfirm(null)}
          PaperProps={{ sx: { background: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '20px', minWidth: 340, maxWidth: 440 } }}>
          <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', pb: 0.5 }}>
            {clearConfirm === 'month' ? '🧹 Limpar roteiros do mês' : '🗑 Apagar TODOS os roteiros'}
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.6)', lineHeight: 1.6 }}>
              {clearConfirm === 'month' ? (
                <>Isso vai apagar os <b style={{ color: DS.accent }}>{monthRoteiroIds.length} roteiros de {MONTH_NAMES_ROT[viewMonth]}/{String(viewYear).slice(2)}</b> (todos os clientes). Os outros meses não são afetados.</>
              ) : (
                <>Isso vai apagar <b style={{ color: DS.red }}>TODOS os {allRoteiroIds.length} roteiros</b> de todos os meses e clientes. Use para recomeçar do zero, organizado.</>
              )}
            </Typography>
            <Typography sx={{ fontSize: '0.62rem', color: 'rgba(244,247,255,0.32)', mt: 1 }}>
              Esta ação não pode ser desfeita.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1, gap: 1 }}>
            <Box onClick={() => setClearConfirm(null)}
              sx={{ px: 1.5, py: 0.8, borderRadius: '8px', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600,
                color: 'rgba(244,247,255,0.5)', border: '1px solid rgba(244,247,255,0.12)', '&:hover': { color: '#fff' }, transition: 'all 0.15s ease' }}>
              Cancelar
            </Box>
            <Box onClick={confirmClear}
              sx={{ px: 1.6, py: 0.8, borderRadius: '8px', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 800,
                background: clearConfirm === 'month' ? `linear-gradient(135deg, ${DS.accent}, #f4663f)` : `linear-gradient(135deg, ${DS.red}, #d92020)`,
                color: '#fff', boxShadow: '0 4px 14px rgba(239,68,68,0.35)', '&:hover': { filter: 'brightness(1.08)' }, transition: 'all 0.15s ease' }}>
              {clearConfirm === 'month' ? `Apagar ${monthRoteiroIds.length} do mês` : `Apagar tudo (${allRoteiroIds.length})`}
            </Box>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  )
}

export default RoteirosBoard
