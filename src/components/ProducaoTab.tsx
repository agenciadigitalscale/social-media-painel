import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable,
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
import AccessTimeIcon from '@mui/icons-material/AccessTime'
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
import type { Client, ContentItem, ContentType, ItemEditPatch, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'
import { loadUploadTasks, type UploadTask } from './EditorMode'
import { syncToCloud } from '../lib/storage'

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
  { status: 5, label: 'Produzido',      color: '#34D399' },
]

const FEED_COLS: ColDef[] = [
  { status: 0, label: 'A fazer',        color: '#71717A' },
  { status: 1, label: 'Em produção',    color: '#ff9039' },
  { status: 2, label: 'Aprov. interna', color: '#60A5FA' },
  { status: 6, label: 'Reprovado',      color: '#FF4545' },
  { status: 5, label: 'Produzido',      color: '#34D399' },
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

interface CardEdit { title: string; type: ContentType_; driveLink: string; docsLink: string }

function RoteirosBoard({ roteiros, clientFolders, filterClient, viewMonth, viewYear, onMonthChange, onUpdateRoteiro, onImportBatch, onDeleteMany }: {
  roteiros: Record<string, import('../types').Roteiro[]>
  clientFolders: Record<string, string>
  filterClient: string
  viewMonth: number
  viewYear: number
  onMonthChange: (m: number, y: number) => void
  onUpdateRoteiro?: (clientName: string, roteiroId: string, patch: Partial<CardEdit>) => void
  onImportBatch?: (clientName: string, items: Array<{ title: string; type: ContentType_; docsLink: string }>, year: number, month: number) => void
  onDeleteMany?: (ids: string[]) => void
}) {
  const [expandedEdit, setExpandedEdit] = useState<Record<string, CardEdit>>({})
  const [importInput, setImportInput] = useState<Record<string, string>>({})
  const [importLoading, setImportLoading] = useState<string | null>(null)
  const [importModal, setImportModal] = useState<{ open: boolean; clientName: string; items: ImportItem[]; docsLink: string } | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const ALL_TYPES: ContentType_[] = ['Post', 'Reel', 'Story', 'Carrossel', 'Feed']

  function openEdit(r: import('../types').Roteiro) {
    setExpandedEdit(p => ({ ...p, [r.id]: { title: r.title, type: r.type, driveLink: r.driveLink ?? '', docsLink: r.docsLink ?? '' } }))
  }
  function closeEdit(id: string) {
    setExpandedEdit(p => { const n = { ...p }; delete n[id]; return n })
  }
  function saveEdit(clientName: string, id: string) {
    const e = expandedEdit[id]
    if (e && onUpdateRoteiro) onUpdateRoteiro(clientName, id, { title: e.title.trim() || undefined, type: e.type, driveLink: e.driveLink.trim() || undefined, docsLink: e.docsLink.trim() || undefined })
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

  const clients = Object.keys(roteiros)
    .filter(c => filterClient === 'all' || c === filterClient)
    .filter(c => (roteiros[c] ?? []).some(r => !r.year || (r.year === viewYear && r.month === viewMonth)))
    .sort()

  const allForMonth = (clientName: string) =>
    (roteiros[clientName] ?? []).filter(r => !r.year || (r.year === viewYear && r.month === viewMonth))

  const totalCount = clients.reduce((s, c) => s + allForMonth(c).length, 0)

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }}>
      {/* Seletor de mês */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: ROT_COLOR, textTransform: 'uppercase', letterSpacing: '0.08em', mr: 0.5 }}>
          Mês:
        </Typography>
        {monthOptions.map(opt => {
          const active = opt.month === viewMonth && opt.year === viewYear
          return (
            <Box
              key={opt.label}
              onClick={() => onMonthChange(opt.month, opt.year)}
              sx={{
                px: 1, py: 0.3, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
                bgcolor: active ? `${ROT_COLOR}20` : 'transparent',
                color: active ? ROT_COLOR : 'rgba(255,255,255,0.3)',
                border: `1px solid ${active ? ROT_COLOR + '40' : 'transparent'}`,
                '&:hover': { bgcolor: `${ROT_COLOR}12`, color: ROT_COLOR },
                transition: 'all 0.15s ease',
              }}
            >{opt.label}</Box>
          )
        })}
        <Box sx={{ flex: 1 }} />
        {onDeleteMany && selectMode && (
          <Box onClick={() => {
            const allIds = clients.flatMap(c => allForMonth(c).map(r => r.id))
            setSelected(new Set(allIds))
          }}
            sx={{ px: 1, py: 0.3, borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
              color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)',
              '&:hover': { color: '#fff', borderColor: 'rgba(255,255,255,0.25)' }, transition: 'all 0.15s ease' }}>
            Todos do mês
          </Box>
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
        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>
          {totalCount} roteiro{totalCount !== 1 ? 's' : ''} · {clients.length} cliente{clients.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* Grid de clientes */}
      <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5, scrollbarWidth: 'thin', scrollbarColor: `${ROT_COLOR}55 transparent` }}>
        {clients.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 1 }}>
            <Typography sx={{ fontSize: '1.5rem' }}>📝</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>Nenhum roteiro para {MONTH_NAMES_ROT[viewMonth]}/{String(viewYear).slice(2)}</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1.5 }}>
            {clients.map(clientName => {
              const list = allForMonth(clientName)
              const driveFolder = clientFolders[clientName]
              return (
                <Box key={clientName} sx={{
                  borderRadius: '14px', p: 1.5,
                  background: 'rgba(251,113,133,0.04)',
                  border: '1px solid rgba(251,113,133,0.12)',
                }}>
                  {/* Header do cliente */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {selectMode ? (
                      <Box onClick={() => toggleAll(list.map(r => r.id))}
                        sx={{ width: 20, height: 20, borderRadius: '5px', flexShrink: 0, cursor: 'pointer',
                          border: `1.5px solid ${list.every(r => selected.has(r.id)) ? ROT_COLOR : 'rgba(255,255,255,0.25)'}`,
                          background: list.every(r => selected.has(r.id)) ? `${ROT_COLOR}30` : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: ROT_COLOR, fontWeight: 900,
                          transition: 'all 0.15s ease' }}>
                        {list.every(r => selected.has(r.id)) && '✓'}
                      </Box>
                    ) : (
                      <Box sx={{
                        width: 28, height: 28, borderRadius: '8px', flexShrink: 0,
                        background: `${ROT_COLOR}18`, border: `1px solid ${ROT_COLOR}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem',
                      }}>📝</Box>
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#fff', lineHeight: 1 }} noWrap>
                        {clientName}
                      </Typography>
                      <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)' }}>
                        {list.length} roteiro{list.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                    {driveFolder && (
                      <Box component="a" href={driveFolder} target="_blank" rel="noopener noreferrer"
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.4, px: 0.8, py: 0.3, borderRadius: '6px', textDecoration: 'none',
                          background: 'rgba(59,142,255,0.10)', border: '1px solid rgba(59,142,255,0.2)', color: '#3B8EFF', fontSize: '0.58rem', fontWeight: 700,
                          '&:hover': { background: 'rgba(59,142,255,0.18)' }, transition: 'all 0.15s ease' }}>
                        ☁️ Drive
                      </Box>
                    )}
                    {onImportBatch && (
                      importInput[clientName] !== undefined ? null : (
                        <Box onClick={() => setImportInput(p => ({ ...p, [clientName]: '' }))}
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.3, px: 0.8, py: 0.3, borderRadius: '6px', cursor: 'pointer',
                            background: `${ROT_COLOR}12`, border: `1px solid ${ROT_COLOR}28`, color: ROT_COLOR, fontSize: '0.58rem', fontWeight: 700,
                            '&:hover': { background: `${ROT_COLOR}22` }, transition: 'all 0.15s ease' }}>
                          📄 Importar
                        </Box>
                      )
                    )}
                  </Box>
                  {/* Input de URL para importar do Google Docs */}
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

                  {/* Lista de roteiros */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                    {list.map(r => {
                      const isSelected = selected.has(r.id)
                      const ed = expandedEdit[r.id]
                      const isExpanded = ed !== undefined
                      const hasLinks = !!(r.docsLink || r.driveLink)
                      return (
                        <Box key={r.id}
                          onClick={selectMode ? () => toggleSelect(r.id) : undefined}
                          sx={{
                            px: 1.2, py: 0.8, borderRadius: '9px',
                            background: isSelected ? `${ROT_COLOR}10` : isExpanded ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isSelected ? ROT_COLOR + '35' : isExpanded ? ROT_COLOR + '30' : hasLinks ? 'rgba(251,113,133,0.2)' : 'rgba(255,255,255,0.05)'}`,
                            display: 'flex', flexDirection: 'column', gap: 0.5,
                            cursor: selectMode ? 'pointer' : 'default',
                            transition: 'all 0.15s ease',
                          }}>

                          {/* Linha principal: checkbox / título / tipo / links / editar */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            {selectMode && (
                              <Box sx={{ width: 16, height: 16, borderRadius: '4px', flexShrink: 0,
                                border: `1.5px solid ${isSelected ? ROT_COLOR : 'rgba(255,255,255,0.25)'}`,
                                background: isSelected ? `${ROT_COLOR}35` : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.5rem', color: ROT_COLOR, fontWeight: 900, transition: 'all 0.15s ease' }}>
                                {isSelected && '✓'}
                              </Box>
                            )}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#fff', lineHeight: 1.2 }} noWrap>
                                {r.title || '(sem título)'}
                              </Typography>
                              <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1, mt: 0.1 }}>
                                {r.type}
                              </Typography>
                            </Box>
                            {/* Botões de link */}
                            {!selectMode && !isExpanded && (
                              <Box sx={{ display: 'flex', gap: 0.4, alignItems: 'center', flexShrink: 0 }}>
                                {r.driveLink && (
                                  <Box component="a" href={r.driveLink} target="_blank" rel="noopener noreferrer"
                                    sx={{ display: 'flex', alignItems: 'center', gap: 0.3, px: 0.7, py: 0.25, borderRadius: '6px', textDecoration: 'none',
                                      background: 'rgba(59,142,255,0.12)', border: '1px solid rgba(59,142,255,0.28)', color: '#3B8EFF', fontSize: '0.58rem', fontWeight: 700,
                                      '&:hover': { background: 'rgba(59,142,255,0.22)' }, transition: 'all 0.15s ease' }}>
                                    ☁️ Drive
                                  </Box>
                                )}
                                {r.docsLink && (
                                  <Box component="a" href={r.docsLink} target="_blank" rel="noopener noreferrer"
                                    sx={{ display: 'flex', alignItems: 'center', gap: 0.3, px: 0.7, py: 0.25, borderRadius: '6px', textDecoration: 'none',
                                      background: `${ROT_COLOR}14`, border: `1px solid ${ROT_COLOR}30`, color: ROT_COLOR, fontSize: '0.58rem', fontWeight: 700,
                                      '&:hover': { background: `${ROT_COLOR}25` }, transition: 'all 0.15s ease' }}>
                                    📄 Docs
                                  </Box>
                                )}
                                {onUpdateRoteiro && (
                                  <Box onClick={() => openEdit(r)}
                                    sx={{ px: 0.6, py: 0.25, borderRadius: '5px', cursor: 'pointer', fontSize: '0.55rem',
                                      color: 'rgba(255,255,255,0.22)', border: '1px solid transparent',
                                      '&:hover': { color: ROT_COLOR, borderColor: `${ROT_COLOR}30`, bgcolor: `${ROT_COLOR}08` }, transition: 'all 0.15s ease' }}>
                                    ✏️
                                  </Box>
                                )}
                              </Box>
                            )}
                          </Box>

                          {/* Painel de edição expandido */}
                          {isExpanded && (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mt: 0.3, pt: 0.8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              {/* Título */}
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>Título</Typography>
                                <Box component="input" autoFocus
                                  value={ed.title}
                                  onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], title: e.target.value } }))}
                                  onKeyDown={(e: { key: string }) => { if (e.key === 'Escape') closeEdit(r.id) }}
                                  sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid rgba(255,255,255,0.12)`, borderRadius: '6px',
                                    px: 1, py: 0.5, color: '#fff', fontSize: '0.65rem', fontWeight: 700, outline: 'none',
                                    '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s' }} />
                              </Box>
                              {/* Tipo */}
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
                              {/* Drive link */}
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>☁️ Link Drive</Typography>
                                <Box component="input"
                                  value={ed.driveLink}
                                  onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], driveLink: e.target.value } }))}
                                  placeholder="https://drive.google.com/..."
                                  sx={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(59,142,255,0.2)', borderRadius: '6px',
                                    px: 1, py: 0.5, color: '#fff', fontSize: '0.6rem', outline: 'none',
                                    '&:focus': { borderColor: '#3B8EFF' }, transition: 'border-color 0.15s' }} />
                              </Box>
                              {/* Docs link */}
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>📄 Link Docs</Typography>
                                <Box component="input"
                                  value={ed.docsLink}
                                  onChange={(e: { target: { value: string } }) => setExpandedEdit(p => ({ ...p, [r.id]: { ...p[r.id], docsLink: e.target.value } }))}
                                  placeholder="https://docs.google.com/document/d/..."
                                  sx={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${ROT_COLOR}25`, borderRadius: '6px',
                                    px: 1, py: 0.5, color: '#fff', fontSize: '0.6rem', outline: 'none',
                                    '&:focus': { borderColor: ROT_COLOR }, transition: 'border-color 0.15s' }} />
                              </Box>
                              {/* Ações */}
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
                </Box>
              )
            })}
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
]

// ── Urgency helpers ───────────────────────────────────────

function urgencyBorder(dt: Date, status: Status) {
  if (status === 7 || status === 5) return 'rgba(255,255,255,0.07)'
  const todayMs = new Date().setHours(0, 0, 0, 0)
  const diff = Math.round((new Date(dt).setHours(0, 0, 0, 0) - todayMs) / 86400000)
  if (diff < 0)  return 'rgba(255,59,48,0.4)'
  if (diff === 0) return 'rgba(255,144,57,0.4)'
  return 'rgba(255,255,255,0.07)'
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

function MiniCard({ item, state, isDragging, colColor, isSelected, bulkMode, onSelect, onEdit, staggerIndex = 0 }: {
  item: ContentItem
  state: ItemState
  isDragging?: boolean
  colColor: string
  isSelected?: boolean
  bulkMode?: boolean
  onSelect?: () => void
  onEdit?: () => void
  staggerIndex?: number
}) {
  const [hover, setHover] = useState(false)
  const border = urgencyBorder(item.dt, state.status)
  const dLabel = getDateLabel(item.dt)
  const isLate = dLabel.includes('atraso')
  const tc = TYPE_COLOR[item.tp] ?? '#888'

  return (
    <Paper
      elevation={0}
      onClick={bulkMode ? onSelect : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      sx={{
        px: 1.8, pt: 1.5, pb: 1.4,
        borderRadius: '14px',
        bgcolor: isDragging ? `${colColor}10` : isSelected ? `${colColor}12` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isSelected ? colColor + '66' : border}`,
        outline: isSelected ? `2px solid ${colColor}55` : '2px solid transparent',
        opacity: isDragging ? 0.35 : 1,
        cursor: bulkMode ? 'pointer' : 'grab',
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 76,
        transformStyle: 'preserve-3d',
        transition: 'border 0.15s, background-color 0.15s, transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease',
        animation: isDragging ? undefined : `fadeInUp 0.24s cubic-bezier(0.16,1,0.3,1) ${Math.min(staggerIndex * 30, 360)}ms both`,
        ...(isLate && !isDragging && {
          '@keyframes latePulse': {
            '0%,100%': { borderColor: 'rgba(255,59,48,0.38)', boxShadow: '0 0 0 0 rgba(255,59,48,0)' },
            '50%':     { borderColor: 'rgba(255,59,48,0.75)', boxShadow: '0 0 10px rgba(255,59,48,0.15)' },
          },
          animation: `fadeInUp 0.24s cubic-bezier(0.16,1,0.3,1) ${Math.min(staggerIndex * 30, 360)}ms both, latePulse 2.4s ease-in-out ${Math.min(staggerIndex * 30, 360)}ms infinite`,
        }),
        '&::before': {
          content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          bgcolor: colColor, borderRadius: '14px 0 0 14px',
          boxShadow: `2px 0 8px ${colColor}50`,
        },
        '&::after': {
          content: '""', position: 'absolute', inset: 0,
          background: 'linear-gradient(160deg, rgba(255,255,255,0.05) 0%, transparent 55%)',
          borderRadius: 'inherit', pointerEvents: 'none',
          opacity: 0, transition: 'opacity 0.2s ease',
        },
        '&:hover': {
          transform: isDragging ? undefined : 'perspective(700px) translateY(-3px) rotateX(1.5deg)',
          boxShadow: `0 10px 28px ${colColor}30, 0 3px 8px rgba(0,0,0,0.5)`,
          bgcolor: bulkMode ? `${colColor}16` : 'rgba(255,255,255,0.07)',
          border: `1px solid ${isSelected ? colColor + '88' : colColor + '55'}`,
          '&::after': { opacity: 1 },
        },
      }}
    >
      {/* Bulk checkbox */}
      {bulkMode && (
        <Box sx={{
          position: 'absolute', top: 8, right: 8, zIndex: 10,
          width: 16, height: 16, borderRadius: 1,
          bgcolor: isSelected ? colColor : 'rgba(255,255,255,0.12)',
          border: `1.5px solid ${isSelected ? colColor : 'rgba(255,255,255,0.25)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isSelected && <Typography sx={{ fontSize: '0.5rem', color: '#000', lineHeight: 1, fontWeight: 900 }}>✓</Typography>}
        </Box>
      )}

      {/* Edit button — visible on hover */}
      {!bulkMode && hover && onEdit && (
        <Box
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onEdit() }}
          sx={{
            position: 'absolute', top: 6, right: 6, zIndex: 10,
            width: 26, height: 26, borderRadius: '8px', cursor: 'pointer',
            bgcolor: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.20)', borderColor: 'rgba(255,255,255,0.25)' },
          }}
        >
          <EditIcon sx={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }} />
        </Box>
      )}

      {/* Linha superior: tipo + cliente */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.7, pr: !bulkMode && onEdit ? 3.5 : 0 }}>
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.4,
          px: 0.7, py: 0.15,
          borderRadius: '6px',
          bgcolor: `${tc}18`, border: `1px solid ${tc}30`,
          flexShrink: 0,
        }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: tc, lineHeight: 1, letterSpacing: '0.02em' }}>
            {TYPE_EMOJI[item.tp] ?? ''} {item.tp}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.78rem', color: colColor, fontWeight: 800, flex: 1, lineHeight: 1.1, letterSpacing: '-0.01em' }} noWrap>
          {item.c}
        </Typography>
      </Box>

      {/* Título — até 2 linhas */}
      <Typography sx={{
        fontSize: { md: '0.82rem', xl: '0.9rem' },
        fontWeight: 700,
        color: 'rgba(255,255,255,0.92)',
        lineHeight: 1.3,
        mb: 0.8,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {state.title || item.n}
      </Typography>

      {/* Data */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <AccessTimeIcon sx={{ fontSize: 11, color: isLate ? '#FF3B30' : 'rgba(255,255,255,0.28)', flexShrink: 0 }} />
        <Typography sx={{
          fontSize: '0.66rem',
          color: isLate ? '#FF3B30' : 'rgba(255,255,255,0.38)',
          fontWeight: isLate ? 800 : 500,
          lineHeight: 1,
          letterSpacing: isLate ? '0.02em' : 0,
        }}>
          {dLabel}
        </Typography>
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
  columns: ColDef[]
  filterFn: (item: ContentItem, state: ItemState) => boolean
  filterClient: string
  bulkMode: boolean
  bulkSelected: Set<number>
  onBulkToggle: (id: number) => void
  boardKey: string
  onSendToClient?: (id: number, clientName: string) => void
}

function MiniKanban({
  items, states, onStatusChange, onEdit, columns, filterFn,
  filterClient, bulkMode, bulkSelected, onBulkToggle, boardKey, onSendToClient,
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } }),
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
      onStatusChange(activeItemId, targetStatus)
      if (targetStatus === 4) {
        const it = items.find(i => i.i === activeItemId)
        if (it) onSendToClient?.(activeItemId, it.c)
      }
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

  // ── Renomear coluna ───────────────────────────────────
  const applyRename = useCallback(() => {
    if (renamingStatus === null || !renameValue.trim()) { setRenamingStatus(null); return }
    const next = { ...colNames, [renamingStatus]: renameValue.trim() }
    setColNames(next)
    saveColNames(boardKey, next)
    setRenamingStatus(null)
    setColMenuStatus(null)
  }, [renamingStatus, renameValue, colNames, boardKey])

  const today = new Date(); today.setHours(0, 0, 0, 0)

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>
        {columns.map(col => {
          const colItems = byStatus[col.status] ?? []
          const displayName = colNames[col.status] || col.label
          const lateCount = colItems.filter(i => {
            const dt = new Date(i.dt); dt.setHours(0, 0, 0, 0)
            return dt < today && col.status !== 5 && col.status !== 7
          }).length

          return (
            <Box key={col.status} sx={{ flex: '0 0 290px', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
              {/* Column header */}
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1, mb: 1.5,
                px: 1.5, py: 1.1, borderRadius: '12px',
                bgcolor: `${col.color}0d`, border: `1px solid ${col.color}30`,
                borderTop: `3px solid ${col.color}`,
                flexShrink: 0,
                position: 'relative',
                '&:hover .col-menu-btn': { opacity: 1 },
              }}>
                <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: col.color, flexShrink: 0, boxShadow: `0 0 7px ${col.color}` }} />

                {/* Nome da coluna (editável inline) */}
                {renamingStatus === col.status ? (
                  <TextField
                    autoFocus size="small" value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={applyRename}
                    onKeyDown={e => { if (e.key === 'Enter') applyRename(); if (e.key === 'Escape') setRenamingStatus(null) }}
                    sx={{
                      flex: 1,
                      '& .MuiInputBase-root': { fontSize: '0.75rem', height: 24, color: col.color, bgcolor: `${col.color}14`, fontWeight: 800 },
                      '& fieldset': { borderColor: `${col.color}60` },
                    }}
                  />
                ) : (
                  <Typography sx={{ fontSize: { md: '0.78rem', xl: '0.85rem' }, fontWeight: 800, color: col.color, flex: 1, lineHeight: 1, letterSpacing: '-0.01em' }} noWrap>
                    {displayName}
                  </Typography>
                )}

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
                <SortableContext items={colItems.map(i => String(i.i))} strategy={verticalListSortingStrategy}>
                  <DropCol colId={`${boardKey}-col-${col.status}`} color={col.color}>
                    {colItems.map((item, idx) => {
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
  onAddItem?: (clientName: string, title: string, type: ContentType, date: Date, status: Status, responsible?: string, notes?: string, footageLink?: string, roteiroLink?: string) => void
  onDuplicate?: (id: number) => void
  allClients?: Client[]
  onSendToClient?: (itemId: number, clientName: string, isTraffic?: boolean) => void
  clientColors?: Record<string, string>
  clientHashtags?: Record<string, string[]>
  captionTemplates?: Record<string, string[]>
  onSaveHashtags?: (clientName: string, tags: string[]) => void
  onSaveTemplates?: (clientName: string, templates: string[]) => void
  currentUser?: string
  roteiros?: Record<string, import('../types').Roteiro[]>
  clientFolders?: Record<string, string>
  onUpdateRoteiro?: (clientName: string, roteiroId: string, patch: Partial<{ title: string; type: ContentType; driveLink: string; docsLink: string }>) => void
  onImportRoteiroBatch?: (clientName: string, items: Array<{ title: string; type: ContentType; docsLink: string }>, year: number, month: number) => void
  onDeleteManyRoteiros?: (ids: string[]) => void
}

// ── Main ─────────────────────────────────────────────────

// Tipo padrão sugerido por board ao criar card
const BOARD_DEFAULT_TYPE: ContentType[] = ['Reel', 'Post', 'Feed', 'Post']
// Status padrão sugerido por board
const BOARD_DEFAULT_STATUS: Status[] = [0, 0, 0, 2]

export default function ProducaoTab({ items, states, onStatusChange, onDelete, onEdit, onUpdateState, onAddItem, onDuplicate, allClients, onSendToClient, clientColors, clientHashtags, captionTemplates, onSaveHashtags, onSaveTemplates, currentUser, roteiros = {}, clientFolders = {}, onUpdateRoteiro, onImportRoteiroBatch, onDeleteManyRoteiros }: Props) {
  const [subTab, setSubTab]         = useState(0)
  const [filterClient, setFilterClient] = useState('all')
  const [bulkMode, setBulkMode]     = useState(false)
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>(() => loadUploadTasks().filter(t => !t.confirmedAt))
  const [roteiroViewMonth, setRoteiroViewMonth] = useState(new Date().getMonth())
  const [roteiroViewYear, setRoteiroViewYear] = useState(new Date().getFullYear())
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<Status>(1)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

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
  const [addStatus, setAddStatus]       = useState<Status>(0)
  const [addFootageLink, setAddFootageLink] = useState('')
  const [addRoteiroLink, setAddRoteiroLink] = useState('')

  const handleOpenAdd = () => {
    setAddClient(filterClient !== 'all' ? filterClient : '')
    setAddType(BOARD_DEFAULT_TYPE[subTab])
    setAddStatus(BOARD_DEFAULT_STATUS[subTab])
    setAddDate(new Date().toISOString().slice(0, 10))
    setAddTitle('')
    setAddFootageLink('')
    setAddRoteiroLink('')
    setAddOpen(true)
  }

  const handleAddSubmit = () => {
    if (!addClient || !addTitle.trim()) return
    onAddItem?.(addClient, addTitle.trim(), addType, new Date(addDate + 'T12:00:00'), addStatus, undefined, undefined, addFootageLink.trim() || undefined, addRoteiroLink.trim() || undefined)
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

  useEffect(() => { setBulkSelected(new Set()); setBulkMode(false) }, [subTab])

  // Busca upload tasks do D1 ao montar (Kaique salva, Geovana recebe)
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
    return [...kanbanCounts, roteiroCount]
  }, [items, states, roteiros])

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
      <Box sx={{ flex: 1, overflow: 'hidden', p: 2, pt: 1.5, pb: 1.5 }}>
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
            <Box sx={{ flex: 1, height: '100%' }}>
              {BOARDS.slice(0, 4).map((board, i) => (
                subTab === i ? (
                  <MiniKanban
                    key={board.key}
                    items={items} states={states}
                    onStatusChange={onStatusChange}
                    onEdit={canEdit ? handleOpenEdit : undefined}
                    columns={board.cols}
                    filterFn={filterFns[i]}
                    filterClient={filterClient}
                    bulkMode={bulkMode}
                    bulkSelected={bulkSelected}
                    onBulkToggle={toggleBulk}
                    boardKey={board.key}
                    onSendToClient={onSendToClient ? (id, cn) => { setSendIsTraffic(false); setSendConfirmItem({ id, clientName: cn }) } : undefined}
                  />
                ) : null
              ))}
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
            />
          )}
        </Box>
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

          <TextField
            label="Data de publicação" type="date" size="small" fullWidth
            value={addDate} onChange={e => setAddDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />

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
    </Box>
  )
}
