import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Box, Typography, Paper, Chip, Button, Tooltip, MenuItem,
  IconButton, Collapse, LinearProgress,
  Dialog, DialogContent, DialogActions, Checkbox, TextField, useMediaQuery,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import CheckIcon from '@mui/icons-material/Check'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import MovieIcon from '@mui/icons-material/Movie'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import MicIcon from '@mui/icons-material/Mic'
import StopIcon from '@mui/icons-material/Stop'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import GridViewIcon from '@mui/icons-material/GridView'
import TuneIcon from '@mui/icons-material/Tune'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import EditIcon from '@mui/icons-material/Edit'
import VideoFileIcon from '@mui/icons-material/VideoFile'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import type { ContentItem, ItemState, Roteiro, Status } from '../types'
import { NAME_MAP, getDisplayName } from '../lib/users'
import { syncToCloud } from '../lib/storage'
import AssetCenter from './AssetCenter'
import { legendaProUrl } from '../lib/assets'
import EditorAI from './EditorAI'
import TranscribeDialog from './TranscribeDialog'
import CreativeEngine from './CreativeEngine'
import CreativeLibrary from './CreativeLibrary'
import EditorEsteira from './EditorEsteira'
import { DS } from '../theme'
import type { SavedCreative } from '../lib/creativeEngine'

// ── Constants ────────────────────────────────────────────

const POMODORO_WORK_MS  = 25 * 60 * 1000
const POMODORO_BREAK_MS =  5 * 60 * 1000

const ESTIMATED_MS: Record<string, number> = {
  Reel: 45 * 60 * 1000,
  Feed: 30 * 60 * 1000,
}

const TYPE_COLOR: Record<string, string> = {
  Reel: '#60A5FA',
  Feed: '#F97316',
}

const TYPE_EMOJI: Record<string, string> = {
  Reel: '🎬',
  Feed: '📸',
}

const TYPE_LABEL: Record<string, string> = {
  Reel: 'Vídeo / Reel',
  Feed: 'Feed de Fotos',
}

const DEFAULT_CHECKLIST = [
  'Legenda revisada',
  'Hashtags adicionadas',
  'CTA no final do vídeo',
  'Qualidade / resolução ok',
  'Trilha sonora está liberada',
]

// ── Types ────────────────────────────────────────────────

interface TimerState {
  startedAt?: number
  accumulated: number
}

interface EditorSession {
  itemId: number
  client: string
  title: string
  duration: number
  date: string
  type: string
  link?: string
}

// ── Recording upload session types ───────────────────────

interface UploadCheckItem {
  id: string
  label: string
  checked: boolean
  link?: string
  hasLink?: boolean
}

interface RecordingClientEntry {
  clientName: string
  checklist: UploadCheckItem[]
}

interface RecordingUploadSession {
  id: string
  date: string
  clients: RecordingClientEntry[]
  createdAt: number
}

export interface UploadNotification {
  id: string
  clientName: string
  driveLink?: string
  sessionDate: string
  notifiedAt: number
  confirmedAt?: number
}

export interface UploadTask {
  id: string
  clientName: string
  driveLink?: string
  sessionDate: string
  createdAt: number
  confirmedAt?: number
  confirmedBy?: string
}

const DEFAULT_UPLOAD_CHECKLIST: Omit<UploadCheckItem, 'id'>[] = [
  { label: 'Material bruto subido no Drive', checked: false, hasLink: true },
  { label: 'Pasta organizada no Drive', checked: false },
]

function makeChecklist(): UploadCheckItem[] {
  return DEFAULT_UPLOAD_CHECKLIST.map((item, i) => ({ ...item, id: String(i) }))
}

// ── Persistence ──────────────────────────────────────────

function loadTimers(): Record<number, TimerState> {
  try { return JSON.parse(localStorage.getItem('sm_editor_timers') ?? '{}') } catch { return {} }
}
function loadSessions(): EditorSession[] {
  try { return JSON.parse(localStorage.getItem('sm_editor_sessions') ?? '[]') } catch { return [] }
}
function loadRecordingSessions(): RecordingUploadSession[] {
  try { return JSON.parse(localStorage.getItem('sm_recording_uploads') ?? '[]') } catch { return [] }
}
export function loadUploadNotifications(): UploadNotification[] {
  try { return JSON.parse(localStorage.getItem('sm_upload_notifications') ?? '[]') } catch { return [] }
}
function saveUploadNotifications(n: UploadNotification[]) {
  localStorage.setItem('sm_upload_notifications', JSON.stringify(n))
  syncToCloud('sm_upload_notifications', n)
}
export function loadUploadTasks(): UploadTask[] {
  try { return JSON.parse(localStorage.getItem('sm_upload_tasks') ?? '[]') } catch { return [] }
}
function saveUploadTasks(t: UploadTask[]) {
  localStorage.setItem('sm_upload_tasks', JSON.stringify(t))
  syncToCloud('sm_upload_tasks', t)
}
function saveTimers(t: Record<number, TimerState>) { localStorage.setItem('sm_editor_timers', JSON.stringify(t)) }
function saveSessions(s: EditorSession[]) { localStorage.setItem('sm_editor_sessions', JSON.stringify(s)) }
function saveRecordingSessions(s: RecordingUploadSession[]) { localStorage.setItem('sm_recording_uploads', JSON.stringify(s)) }
function loadChecklist(): string[] {
  try { return JSON.parse(localStorage.getItem('sm_editor_checklist') ?? JSON.stringify(DEFAULT_CHECKLIST)) } catch { return [...DEFAULT_CHECKLIST] }
}
function saveChecklist(c: string[]) { localStorage.setItem('sm_editor_checklist', JSON.stringify(c)) }

// Checklist do card por vídeo (estado próprio, decoplado do portão de entrega)
function loadCardChecks(): Record<number, Record<string, boolean>> {
  try { return JSON.parse(localStorage.getItem('sm_editor_card_checks') ?? '{}') } catch { return {} }
}
function saveCardChecks(c: Record<number, Record<string, boolean>>) { localStorage.setItem('sm_editor_card_checks', JSON.stringify(c)) }

// ── Helpers ──────────────────────────────────────────────

function formatTimer(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildDeliveryMsg(snap: { tp: string; client: string; title: string; date: string; link: string }): string {
  return [
    `✅ *${snap.tp} entregue para aprovação!*`,
    ``,
    `📌 Cliente: ${snap.client}`,
    `🎬 Conteúdo: ${snap.title}`,
    `🗓 Data: ${snap.date}`,
    snap.link ? `🔗 ${snap.link}` : '',
    ``,
    `✓ Status: *Aprovação interna* — aguardando revisão`,
  ].filter(Boolean).join('\n')
}

// Extrai o ID de um link Streamable em qualquer formato
function extractStreamableId(url: string): string | null {
  const m = url.match(/streamable\.com\/(?:e\/)?([a-zA-Z0-9]+)/)
  return m ? m[1] : null
}

function getWorkdaysLeft(now: Date): number {
  const year = now.getFullYear()
  const month = now.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  let count = 0
  for (let d = now.getDate(); d <= lastDay; d++) {
    const day = new Date(year, month, d).getDay()
    if (day !== 0 && day !== 6) count++
  }
  return Math.max(1, count)
}

// ── Props ────────────────────────────────────────────────

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  onStatusChange: (id: number, status: Status) => void
  onUpdate: (id: number, patch: Partial<ItemState>) => void
  roteiros: Record<string, Roteiro[]>
  clientFolders: Record<string, string>
  now: Date
  currentUser?: string
}

// ── Main ─────────────────────────────────────────────────

export default function EditorMode({ items, states, onStatusChange, onUpdate, roteiros, clientFolders, now, currentUser }: Props) {

  // ── Core state ───────────────────────────────────────
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [timers, setTimers] = useState<Record<number, TimerState>>(loadTimers)
  const [sessions, setSessions] = useState<EditorSession[]>(loadSessions)
  const [tick, setTick] = useState(0)

  // ── View toggle: fila | material a subir ─────────────
  const [editorView, setEditorView] = useState<'queue' | 'upload' | 'esteira'>('queue')

  // ── Recording upload sessions ─────────────────────────
  const [recordingSessions, setRecordingSessions] = useState<RecordingUploadSession[]>(loadRecordingSessions)
  const [newSessionOpen, setNewSessionOpen] = useState(false)
  const [newSessionDate, setNewSessionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [newSessionClients, setNewSessionClients] = useState<Set<string>>(new Set())
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  // ── Upload notifications ──────────────────────────────
  const [uploadNotifications, setUploadNotifications] = useState<UploadNotification[]>(loadUploadNotifications)
  const [arthurPhone, setArthurPhone] = useState(() => localStorage.getItem('sm_arthur_phone') ?? localStorage.getItem('sm_geovana_phone') ?? '')
  const [phoneEditOpen, setPhoneEditOpen] = useState(false)
  const [phoneEditVal, setPhoneEditVal] = useState('')
  const [celebrateId, setCelebrateId] = useState<number | null>(null)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const celebrateRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Pomodoro ─────────────────────────────────────────
  const [pomodoroEnabled, setPomodoroEnabled] = useState(() => localStorage.getItem('sm_pomodoro') === 'true')
  const [pomodoroPhase, setPomodoroPhase] = useState<'work' | 'break'>('work')
  const [pomodoroElapsed, setPomodoroElapsed] = useState(0)
  const pomodoroStartRef = useRef<number | null>(null)

  // ── Checklist ─────────────────────────────────────────
  const [checklistItems, setChecklistItems] = useState<string[]>(loadChecklist)
  const [checklistChecked, setChecklistChecked] = useState<boolean[]>([])
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [checklistEditMode, setChecklistEditMode] = useState(false)
  const [checklistNewItem, setChecklistNewItem] = useState('')
  const [cardChecks, setCardChecks] = useState<Record<number, Record<string, boolean>>>(loadCardChecks)

  const [specsOpen, setSpecsOpen] = useState(false)
  const [specsCopied, setSpecsCopied] = useState(false)

  // ── Voice notes ───────────────────────────────────────
  const audioNotesRef = useRef<Record<number, string>>({})
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioPlayRef = useRef<HTMLAudioElement | null>(null)
  const [recording, setRecording] = useState(false)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [hasAudio, setHasAudio] = useState<Record<number, boolean>>({})

  // ── Feature: WhatsApp message after deliver ───────────
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [deliveredSnapshot, setDeliveredSnapshot] = useState<{
    client: string; title: string; tp: string; link: string; date: string
  } | null>(null)

  // ── Feature: Footage link inline edit ─────────────────
  const [editingFootage, setEditingFootage] = useState(false)
  const [footageLinkValue, setFootageLinkValue] = useState('')

  // ── Feature: Editor assignment / queue filter ──────────
  const [queueFilter, setQueueFilter] = useState<'all' | 'mine'>('all')
  // ── Feature: Type filter (Reel | Feed | all) ──────────
  const [typeFilter, setTypeFilter] = useState<'all' | 'Reel' | 'Feed'>('all')
  // ── Feature: Foco do dia (só hoje/atrasados/refazer) ──
  const [focoHoje, setFocoHoje] = useState(false)

  // ── Load persisted voice notes ───────────────────────
  useEffect(() => {
    try {
      const stored: Record<string, string> = JSON.parse(localStorage.getItem('sm_voice_notes') ?? '{}')
      const newHasAudio: Record<number, boolean> = {}
      Object.entries(stored).forEach(([key, dataUrl]) => {
        const id = parseInt(key)
        audioNotesRef.current[id] = dataUrl
        newHasAudio[id] = true
      })
      if (Object.keys(newHasAudio).length > 0) setHasAudio(newHasAudio)
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Tick (1 s) ───────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Pomodoro: start clock when enabled ───────────────
  useEffect(() => {
    if (pomodoroEnabled && pomodoroStartRef.current === null) {
      pomodoroStartRef.current = Date.now()
    }
  }, [pomodoroEnabled])

  // ── Pomodoro: tick ───────────────────────────────────
  useEffect(() => {
    if (!pomodoroEnabled || pomodoroStartRef.current === null) return
    const elapsed = Date.now() - pomodoroStartRef.current
    const limit = pomodoroPhase === 'work' ? POMODORO_WORK_MS : POMODORO_BREAK_MS
    setPomodoroElapsed(elapsed)
    if (elapsed >= limit) {
      const nextPhase = pomodoroPhase === 'work' ? 'break' : 'work'
      setPomodoroPhase(nextPhase)
      pomodoroStartRef.current = Date.now()
      setPomodoroElapsed(0)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(
          nextPhase === 'break'
            ? '🍅 Pomodoro concluído! Pausa de 5 min ☕'
            : '⏱ Pausa acabou! Bora editar 🎬',
          { icon: '/logo192.png' }
        )
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, pomodoroEnabled, pomodoroPhase])

  const togglePomodoro = useCallback(() => {
    setPomodoroEnabled(prev => {
      const next = !prev
      localStorage.setItem('sm_pomodoro', String(next))
      if (!next) {
        pomodoroStartRef.current = null
        setPomodoroElapsed(0)
        setPomodoroPhase('work')
      }
      return next
    })
  }, [])

  const suggestFilename = useCallback((item: ContentItem): string => {
    const slug = item.c.replace(/\s+/g, '').replace(/[^\wÀ-ú]/g, '').slice(0, 20)
    const dt   = new Date(item.dt)
    const date = `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}`
    return `${slug}_${item.tp}_${date}`
  }, [])

  // ── Specs CapCut ──────────────────────────────────────
  const CAPCUT_SPECS = {
    Reel: { res: '1080×1920px', ratio: '9:16', dur: 'até 90s',   fps: '30fps' },
    Feed: { res: '1080×1350px', ratio: '4:5',  dur: 'foto / 60s', fps: '30fps' },
  } as const

  // ── Queue — somente Reel e Feed (vídeo+foto) ──────────
  const videoQueue = useMemo(() => {
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    return items
      .filter(i => i.tp === 'Reel')
      .filter(i => {
        // Apenas tipos de vídeo/foto — Post/Story/Carrossel ficam no Design
        if (i.tp !== 'Reel' && i.tp !== 'Feed') return false
        const st = states[i.i]?.status ?? i.s
        if (!(st < 4 || st === 6)) return false
        if (typeFilter !== 'all' && i.tp !== typeFilter) return false
        if (queueFilter === 'mine' && currentUser) {
          const assigned = states[i.i]?.assignedEditor
          if (assigned && assigned !== currentUser) return false
        }
        // Foco do dia: só refazer (6) + vencendo hoje ou atrasados
        if (focoHoje && st !== 6) {
          const dd = new Date(i.dt); dd.setHours(0, 0, 0, 0)
          if (dd.getTime() > today.getTime()) return false
        }
        return true
      })
      .sort((a, b) => {
        const sa = states[a.i]?.status ?? a.s
        const sb = states[b.i]?.status ?? b.s
        if (sa === 6 && sb !== 6) return -1
        if (sb === 6 && sa !== 6) return 1
        if (sa === 1 && sb !== 1) return -1
        if (sb === 1 && sa !== 1) return 1
        const todayMs = today.getTime()
        const aMs = new Date(a.dt).setHours(0, 0, 0, 0)
        const bMs = new Date(b.dt).setHours(0, 0, 0, 0)
        // Today (URGENT) always first, then ascending by date
        if (aMs === todayMs && bMs !== todayMs) return -1
        if (bMs === todayMs && aMs !== todayMs) return 1
        return a.dt.getTime() - b.dt.getTime()
      })
  }, [items, states, now, queueFilter, typeFilter, currentUser, focoHoje])

  // Group queue by delivery date for the sidebar
  const queueByDate = useMemo(() => {
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    const groups: Array<{ label: string; isToday: boolean; isRejected: boolean; items: ContentItem[] }> = []
    const seen = new Map<string, number>()
    videoQueue.forEach(item => {
      const st = states[item.i]?.status ?? item.s
      const isRejected = st === 6
      const itemDay = new Date(item.dt); itemDay.setHours(0, 0, 0, 0)
      const isToday = !isRejected && itemDay.getTime() === today.getTime()
      const label = isRejected
        ? '🔴 Reprovados'
        : isToday
        ? 'Hoje'
        : item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
      if (!seen.has(label)) {
        seen.set(label, groups.length)
        groups.push({ label, isToday, isRejected, items: [] })
      }
      groups[seen.get(label)!].items.push(item)
    })
    return groups
  }, [videoQueue, now, states])

  const currentItem = useMemo(() => {
    if (selectedId) {
      const found = videoQueue.find(i => i.i === selectedId)
      if (found) return found
    }
    return videoQueue[0] ?? null
  }, [selectedId, videoQueue])

  const currentState = currentItem
    ? (states[currentItem.i] ?? { status: 0, title: '', link: '', caption: '', notes: '' } as ItemState)
    : null

  // ── Timer ─────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getElapsed = useCallback((itemId: number): number => {
    const t = timers[itemId]
    if (!t) return 0
    const live = t.startedAt ? (Date.now() - t.startedAt) : 0
    return t.accumulated + live
  }, [timers, tick])

  const isRunning = currentItem ? Boolean(timers[currentItem.i]?.startedAt) : false

  const startTimer = useCallback((itemId: number) => {
    setTimers(prev => {
      const next = { ...prev, [itemId]: { accumulated: prev[itemId]?.accumulated ?? 0, startedAt: Date.now() } }
      saveTimers(next)
      return next
    })
  }, [])

  const pauseTimer = useCallback((itemId: number) => {
    setTimers(prev => {
      const t = prev[itemId]
      if (!t?.startedAt) return prev
      const next = { ...prev, [itemId]: { accumulated: t.accumulated + (Date.now() - t.startedAt), startedAt: undefined } }
      saveTimers(next)
      return next
    })
  }, [])

  // ── Actions ───────────────────────────────────────────
  const handleStart = useCallback(() => {
    if (!currentItem) return
    const st = states[currentItem.i]?.status ?? currentItem.s
    if (st === 0 || st === 6) onStatusChange(currentItem.i, 1)
    startTimer(currentItem.i)
  }, [currentItem, states, onStatusChange, startTimer])

  const handlePause = useCallback(() => {
    if (!currentItem) return
    pauseTimer(currentItem.i)
  }, [currentItem, pauseTimer])

  const handleDeliverClick = useCallback(() => {
    if (!currentItem) return
    setChecklistChecked(new Array(checklistItems.length).fill(false))
    setChecklistEditMode(false)
    setChecklistOpen(true)
  }, [currentItem, checklistItems.length])

  const handleDeliver = useCallback(() => {
    if (!currentItem) return
    const elapsed = getElapsed(currentItem.i)
    const title = states[currentItem.i]?.title || currentItem.n
    const link  = states[currentItem.i]?.link || clientFolders[currentItem.c] || ''
    const session: EditorSession = {
      itemId: currentItem.i,
      client: currentItem.c,
      title,
      duration: elapsed,
      date: todayStr(),
      type: currentItem.tp,
      link: driveLink || '',
    }
    setSessions(prev => { const next = [...prev, session]; saveSessions(next); return next })
    setTimers(prev => { const next = { ...prev }; delete next[currentItem.i]; saveTimers(next); return next })
    onStatusChange(currentItem.i, 2)
    // Build snapshot + open WhatsApp automatically
    const snap = {
      client: currentItem.c,
      title,
      tp: currentItem.tp,
      link,
      date: new Date().toLocaleDateString('pt-BR'),
    }
    setDeliveredSnapshot(snap)
    // Abre WhatsApp direto — sem clique extra
    const msg = buildDeliveryMsg(snap)
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
    setWhatsappOpen(true)
    setCelebrateId(currentItem.i)
    setChecklistOpen(false)
    if (celebrateRef.current) clearTimeout(celebrateRef.current)
    celebrateRef.current = setTimeout(() => setCelebrateId(null), 3000)
    const nextIdx = videoQueue.findIndex(i => i.i === currentItem.i) + 1
    setSelectedId(videoQueue[nextIdx]?.i ?? null)
    setBriefingOpen(false)
    setEditingFootage(false)
  }, [currentItem, states, getElapsed, onStatusChange, videoQueue, clientFolders])

  // ── Voice notes ───────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!currentItem) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = () => {
          const dataUrl = reader.result as string
          try {
            const stored: Record<string, string> = JSON.parse(localStorage.getItem('sm_voice_notes') ?? '{}')
            stored[String(currentItem.i)] = dataUrl
            localStorage.setItem('sm_voice_notes', JSON.stringify(stored))
          } catch {}
          if (audioNotesRef.current[currentItem.i]) {
            const prev = audioNotesRef.current[currentItem.i]
            if (prev.startsWith('blob:')) URL.revokeObjectURL(prev)
          }
          audioNotesRef.current[currentItem.i] = dataUrl
          setHasAudio(prev => ({ ...prev, [currentItem.i]: true }))
        }
        reader.readAsDataURL(blob)
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch {}
  }, [currentItem])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setRecording(false)
  }, [])

  const playAudioNote = useCallback((itemId: number) => {
    const url = audioNotesRef.current[itemId]
    if (!url) return
    if (audioPlayRef.current) { audioPlayRef.current.pause(); audioPlayRef.current = null }
    if (playingId === itemId) { setPlayingId(null); return }
    const audio = new Audio(url)
    audioPlayRef.current = audio
    audio.onended = () => setPlayingId(null)
    audio.play()
    setPlayingId(itemId)
  }, [playingId])

  // ── Keyboard shortcuts ────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (checklistOpen) return
      if (e.code === 'Space') { e.preventDefault(); isRunning ? handlePause() : handleStart() }
      if (e.code === 'Enter') { e.preventDefault(); handleDeliverClick() }
      if (e.code === 'ArrowDown' || e.code === 'ArrowRight') {
        e.preventDefault()
        if (!currentItem) return
        const idx = videoQueue.findIndex(i => i.i === currentItem.i)
        if (idx < videoQueue.length - 1) setSelectedId(videoQueue[idx + 1].i)
      }
      if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') {
        e.preventDefault()
        if (!currentItem) return
        const idx = videoQueue.findIndex(i => i.i === currentItem.i)
        if (idx > 0) setSelectedId(videoQueue[idx - 1].i)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isRunning, handleStart, handlePause, handleDeliverClick, currentItem, videoQueue, checklistOpen])

  // ── Auto-open briefing for rejected/roteiro items ────
  useEffect(() => {
    if (!currentItem) return
    const st = states[currentItem.i]?.status ?? currentItem.s
    const hasRoteiros = (roteiros[currentItem.c] ?? []).filter(r => r.type === currentItem.tp).length > 0
    if (st === 6 || hasRoteiros) {
      setBriefingOpen(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem?.i])

  // ── Stats ─────────────────────────────────────────────
  const today = todayStr()
  const todaySessions = sessions.filter(s => s.date === today)
  const todayCount = todaySessions.length
  const todayTime = todaySessions.reduce((a, s) => a + s.duration, 0)
  const monthSessions = sessions.filter(s => s.date.startsWith(today.slice(0, 7)))
  const monthCount = monthSessions.length
  const monthTime = monthSessions.reduce((a, s) => a + s.duration, 0)
  const avgTime = monthCount > 0 ? Math.round(monthTime / monthCount) : 0

  const streak = useMemo(() => {
    const dates = [...new Set(sessions.map(s => s.date))].sort().reverse()
    let count = 0
    const base = new Date()
    for (const d of dates) {
      const expected = new Date(base.getTime() - count * 86400000).toISOString().slice(0, 10)
      if (d === expected) count++
      else break
    }
    return count
  }, [sessions])


  const todayD = new Date(now); todayD.setHours(0, 0, 0, 0)

  // Lista única de clientes para seleção na sessão de gravação
  const allClientNames = useMemo(() => {
    const names = new Set<string>()
    items.forEach(i => names.add(i.c))
    return Array.from(names).sort()
  }, [items])

  // Pendências de material a subir
  const pendingUploadCount = useMemo(() => {
    return recordingSessions.reduce((acc, session) => {
      const hasOpen = session.clients.some(c => c.checklist.some(i => !i.checked))
      return acc + (hasOpen ? 1 : 0)
    }, 0)
  }, [recordingSessions])

  // Vídeos reprovados pelo cliente (status 6) — atenção na esteira
  const reprovadosCount = useMemo(() => items.filter(i =>
    (i.tp === 'Reel' || i.tp === 'Feed') && (states[i.i]?.status ?? i.s) === 6
  ).length, [items, states])

  // ── Recording session handlers ────────────────────────
  function handleCreateSession() {
    if (newSessionClients.size === 0) return
    const session: RecordingUploadSession = {
      id: String(Date.now()),
      date: newSessionDate,
      createdAt: Date.now(),
      clients: Array.from(newSessionClients).map(name => ({
        clientName: name,
        checklist: makeChecklist(),
      })),
    }
    setRecordingSessions(prev => {
      const next = [session, ...prev]
      saveRecordingSessions(next)
      return next
    })
    setExpandedSession(session.id)
    setNewSessionOpen(false)
    setNewSessionClients(new Set())
    setEditorView('upload')
  }

  function toggleUploadCheck(sessionId: string, clientName: string, itemId: string) {
    setRecordingSessions(prev => {
      const next = prev.map(s => {
        if (s.id !== sessionId) return s
        return {
          ...s,
          clients: s.clients.map(c => {
            if (c.clientName !== clientName) return c
            return {
              ...c,
              checklist: c.checklist.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i),
            }
          }),
        }
      })
      saveRecordingSessions(next)

      // Quando todos os itens do cliente estão checked → cria task automaticamente
      const session = next.find(s => s.id === sessionId)
      const client = session?.clients.find(c => c.clientName === clientName)
      if (client && client.checklist.every(i => i.checked)) {
        const driveLink = client.checklist.find(i => i.hasLink)?.link ?? ''
        const taskId = `${sessionId}_${clientName}`
        const task: UploadTask = {
          id: taskId, clientName,
          driveLink: driveLink || undefined,
          sessionDate: session!.date,
          createdAt: Date.now(),
        }
        const prevTasks = loadUploadTasks()
        const nextTasks = [task, ...prevTasks.filter(t => t.id !== taskId)]
        saveUploadTasks(nextTasks)
      }

      return next
    })
  }

  function updateUploadLink(sessionId: string, clientName: string, itemId: string, link: string) {
    setRecordingSessions(prev => {
      const next = prev.map(s => {
        if (s.id !== sessionId) return s
        return {
          ...s,
          clients: s.clients.map(c => {
            if (c.clientName !== clientName) return c
            return {
              ...c,
              checklist: c.checklist.map(i => i.id === itemId ? { ...i, link } : i),
            }
          }),
        }
      })
      saveRecordingSessions(next)
      return next
    })
  }

  function deleteRecordingSession(sessionId: string) {
    setRecordingSessions(prev => {
      const next = prev.filter(s => s.id !== sessionId)
      saveRecordingSessions(next)
      return next
    })
  }

  function notifyArthur(sessionId: string, clientName: string, driveLink: string, sessionDate: string) {
    const taskId = `${sessionId}_${clientName}`
    const task: UploadTask = { id: taskId, clientName, driveLink: driveLink || undefined, sessionDate, createdAt: Date.now() }
    const prevTasks = loadUploadTasks()
    const nextTasks = [task, ...prevTasks.filter(t => t.id !== taskId)]
    saveUploadTasks(nextTasks)

    const notif: UploadNotification = {
      id: taskId,
      clientName, driveLink, sessionDate,
      notifiedAt: Date.now(),
    }
    setUploadNotifications(prev => {
      const filtered = prev.filter(n => n.id !== notif.id)
      const next = [notif, ...filtered]
      saveUploadNotifications(next)
      return next
    })
  }

  function isClientNotified(sessionId: string, clientName: string) {
    return uploadNotifications.some(n => n.id === `${sessionId}_${clientName}` && !n.confirmedAt)
  }

  // Contagens brutas (sem typeFilter) para KPIs de split
  const allVideoItems = useMemo(() => items.filter(i => (i.tp === 'Reel' || i.tp === 'Feed') && ((states[i.i]?.status ?? i.s) < 4 || (states[i.i]?.status ?? i.s) === 6)), [items, states])
  const reelCount  = allVideoItems.filter(i => i.tp === 'Reel').length
  const feedCount  = allVideoItems.filter(i => i.tp === 'Feed').length

  const pendingCount = videoQueue.filter(i => (states[i.i]?.status ?? i.s) < 2).length
  const inProgressCount = videoQueue.filter(i => (states[i.i]?.status ?? i.s) === 1).length
  const lateCount = videoQueue.filter(i => i.dt < todayD).length
  const estimatedFinish = avgTime > 0 && pendingCount > 0
    ? new Date(Date.now() + avgTime * pendingCount)
    : null

  const driveLink = currentItem ? (states[currentItem.i]?.link || clientFolders[currentItem.c] || '') : ''
  const clientRoteiros = currentItem ? (roteiros[currentItem.c] ?? []).filter(r => r.type === currentItem.tp) : []

  // ── Smart pace ────────────────────────────────────────
  const workdaysLeft = getWorkdaysLeft(now)
  const requiredPerDay = Math.max(1, Math.ceil(pendingCount / workdaysLeft))
  const paceStatus: 'ahead' | 'on' | 'behind' =
    todayCount >= requiredPerDay ? 'ahead'
    : todayCount >= requiredPerDay - 1 ? 'on'
    : 'behind'
  const paceColor = paceStatus === 'ahead' ? '#00C47A' : paceStatus === 'on' ? '#FFD700' : '#FF3B30'
  const paceLabel =
    pendingCount === 0 ? '🎯 Fila zerada!'
    : paceStatus === 'ahead' ? `🎯 No ritmo! ${todayCount}/${requiredPerDay} hoje`
    : paceStatus === 'on' ? `⚡ Quase! ${todayCount}/${requiredPerDay} hoje`
    : `⚠️ Meta: ${requiredPerDay} vídeos hoje`
  const goalProgress = pendingCount === 0 ? 100 : Math.min((todayCount / requiredPerDay) * 100, 100)

  // ── Pomodoro display ──────────────────────────────────
  const pomodoroLimit = pomodoroPhase === 'work' ? POMODORO_WORK_MS : POMODORO_BREAK_MS
  const pomodoroRemaining = Math.max(0, pomodoroLimit - pomodoroElapsed)
  const pomodoroProgress = Math.min((pomodoroElapsed / pomodoroLimit) * 100, 100)

  // ── Checklist helpers ─────────────────────────────────
  const allChecked = checklistChecked.length > 0 && checklistChecked.every(Boolean)
  const checkedCount = checklistChecked.filter(Boolean).length

  // ─────────────────────────────────────────────────────

  // ── Extra: today's videos urgency ────────────────────
  const todayVideos = videoQueue.filter(i => {
    const d = new Date(i.dt); d.setHours(0,0,0,0)
    return d.getTime() === todayD.getTime() && (states[i.i]?.status ?? i.s) !== 7
  })
  const rejectedVideos = videoQueue.filter(i => (states[i.i]?.status ?? i.s) === 6)

  const [assetsOpen, setAssetsOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [transcribeOpen, setTranscribeOpen] = useState(false)
  const [creativeOpen, setCreativeOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [creativeInicial, setCreativeInicial] = useState<SavedCreative | null>(null)
  const isMobile = useMediaQuery('(max-width:599.95px)')

  return (
    <Box sx={{ minHeight: '100%', bgcolor: '#050505', display: 'flex', flexDirection: 'column' }}>

      <AssetCenter
        open={assetsOpen}
        onClose={() => setAssetsOpen(false)}
        clients={[...new Set(items.map(i => i.c))].sort()}
        currentUser={currentUser}
        legendaContext={currentItem ? { cliente: currentItem.c, roteiro: states[currentItem.i]?.caption || currentItem.n } : undefined}
      />

      {currentItem && (
        <EditorAI
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          titulo={states[currentItem.i]?.title || currentItem.n}
          cliente={currentItem.c}
          tipo={currentItem.tp}
          roteiro={states[currentItem.i]?.caption || clientRoteiros.map(r => r.title + (r.notes ? ': ' + r.notes : '')).join('\n')}
          docLink={states[currentItem.i]?.roteiroLink || clientRoteiros[0]?.docsLink}
        />
      )}

      {currentItem && (
        <TranscribeDialog
          open={transcribeOpen}
          onClose={() => setTranscribeOpen(false)}
          footageLink={states[currentItem.i]?.footageLink}
          onUseAsCaption={(text) => onUpdate(currentItem.i, { caption: text })}
        />
      )}

      {creativeOpen && (
        <CreativeEngine
          key={creativeInicial?.id ?? currentItem?.i ?? 'global'}
          open={creativeOpen}
          onClose={() => setCreativeOpen(false)}
          currentUser={currentUser}
          inicial={creativeInicial ?? undefined}
          contexto={!creativeInicial && currentItem ? { cliente: currentItem.c, produto: states[currentItem.i]?.title || currentItem.n } : undefined}
          marcaContexto={!creativeInicial && currentItem ? (states[currentItem.i]?.caption || clientRoteiros.map(r => r.title + (r.notes ? ': ' + r.notes : '')).join('\n')) : undefined}
          onUsarRoteiro={currentItem ? (text) => onUpdate(currentItem.i, { creative: text }) : undefined}
        />
      )}

      <CreativeLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onAbrir={(s) => { setCreativeInicial(s); setLibraryOpen(false); setCreativeOpen(true) }}
      />

      {/* ══ COMMAND CENTER HERO ════════════════════════════ */}
      <Box sx={{
        px: { xs: 2, md: 3 }, pt: 2, pb: 1.5, flexShrink: 0,
        background: 'linear-gradient(180deg, #0C0A08 0%, #08090E 100%)',
        borderBottom: `1px solid ${DS.border}`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient glow — sutil */}
        <Box sx={{ position: 'absolute', top: -70, left: '32%', width: 260, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Title row */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', rowGap: 1, alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36 }}>
              {/* Circular progress ring */}
              <svg width="36" height="36" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(249,115,22,0.14)" strokeWidth="2.5" />
                <circle cx="18" cy="18" r="15" fill="none" stroke={DS.orange} strokeWidth="2.5"
                  strokeDasharray={`${2 * Math.PI * 15}`}
                  strokeDashoffset={`${2 * Math.PI * 15 * (1 - goalProgress / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <MovieIcon sx={{ fontSize: 16, color: DS.orange, position: 'relative', zIndex: 1 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: '1rem', md: '1.1rem' }, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                {currentUser ? `Estúdio do ${getDisplayName(currentUser)}` : 'Painel do Editor'}
              </Typography>
              <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.25)', lineHeight: 1, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }} />

          {/* Biblioteca de Criativos */}
          <Tooltip title="Biblioteca de Criativos — tudo que já foi gerado no ⚡, por cliente">
            <Box onClick={() => setLibraryOpen(true)} sx={{
              display: 'flex', alignItems: 'center', gap: 0.6, cursor: 'pointer',
              px: 1.4, py: 0.6, borderRadius: 2, mr: 1,
              bgcolor: 'rgba(255,144,57,0.1)', border: '1px solid rgba(255,144,57,0.35)',
              transition: 'all 0.2s', '&:hover': { filter: 'brightness(1.15)' },
            }}>
              <Typography sx={{ fontSize: '0.8rem', lineHeight: 1 }}>💡</Typography>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#ff9039' }}>Criativos</Typography>
            </Box>
          </Tooltip>

          {/* Central de Assets */}
          <Tooltip title="Central de Assets — LUTs, músicas, efeitos e legendas">
            <Box onClick={() => setAssetsOpen(true)} sx={{
              display: 'flex', alignItems: 'center', gap: 0.6, cursor: 'pointer',
              px: 1.4, py: 0.6, borderRadius: 2, mr: 1,
              bgcolor: 'rgba(255,144,57,0.1)', border: '1px solid rgba(255,144,57,0.35)',
              transition: 'all 0.2s', '&:hover': { filter: 'brightness(1.15)' },
            }}>
              <Typography sx={{ fontSize: '0.8rem', lineHeight: 1 }}>🎒</Typography>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#ff9039' }}>Assets</Typography>
            </Box>
          </Tooltip>

          {/* Pomodoro toggle */}
        <Tooltip title={pomodoroEnabled ? 'Clique para desativar o Pomodoro' : 'Ativar modo Pomodoro (25 min foco + 5 min pausa)'}>
          <Box
            onClick={togglePomodoro}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.7, cursor: 'pointer',
              px: 1.4, py: 0.6, borderRadius: 2,
              bgcolor: pomodoroEnabled
                ? pomodoroPhase === 'work' ? 'rgba(255,83,57,0.1)' : 'rgba(0,196,122,0.1)'
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${pomodoroEnabled
                ? pomodoroPhase === 'work' ? 'rgba(255,83,57,0.35)' : 'rgba(0,196,122,0.35)'
                : 'rgba(255,255,255,0.07)'}`,
              transition: 'all 0.25s',
              '&:hover': { filter: 'brightness(1.2)' },
            }}
          >
            <Typography sx={{ fontSize: '0.8rem', lineHeight: 1 }}>
              {pomodoroEnabled ? (pomodoroPhase === 'work' ? '🍅' : '☕') : '🍅'}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: pomodoroEnabled ? (pomodoroPhase === 'work' ? '#ff5339' : '#00C47A') : 'rgba(255,255,255,0.3)' }}>
              {pomodoroEnabled ? formatCountdown(pomodoroRemaining) : 'Pomodoro'}
            </Typography>
          </Box>
        </Tooltip>

        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
        {streak > 0 && (
          <StatPill>
            <LocalFireDepartmentIcon sx={{ fontSize: 14, color: '#FF6B2B' }} />
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#FF6B2B' }}>{streak}d 🔥</Typography>
          </StatPill>
        )}
        {estimatedFinish && (
          <Tooltip title={`Baseado na média de ${formatDuration(avgTime)} por vídeo · ${pendingCount} restantes`}>
            <StatPill glow="#C084FC">
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#C084FC', cursor: 'help' }}>
                🕐 ~{estimatedFinish.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </StatPill>
          </Tooltip>
        )}
        </Box>
        </Box>{/* end title row */}

        {/* ── KPI command strip ─────────────────────── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 1 }}>
          {[
            { label: 'Entregues hoje', value: todayCount, sub: formatDuration(todayTime), color: DS.green },
            { label: 'Reels na fila', value: reelCount, sub: 'vídeos', color: DS.blueSoft, clickType: 'Reel' as const },
            { label: 'Feed na fila', value: feedCount, sub: 'fotos', color: DS.orange, clickType: 'Feed' as const },
            { label: 'Atrasados', value: lateCount, sub: lateCount > 0 ? 'atenção' : 'tudo ok', color: lateCount > 0 ? DS.red : DS.green },
            { label: 'Reprovados', value: rejectedVideos.length, sub: rejectedVideos.length > 0 ? 'refazer' : 'zerado', color: rejectedVideos.length > 0 ? DS.red : DS.green },
            { label: 'Ritmo', value: `${todayCount}/${requiredPerDay}`, sub: paceStatus === 'ahead' ? 'no ritmo' : paceStatus === 'on' ? 'quase' : 'abaixo', color: paceColor },
          ].filter((_, i) => !isMobile || [0, 1, 3, 5].includes(i)).map(kpi => (
            <Box key={kpi.label} onClick={() => 'clickType' in kpi && kpi.clickType ? setTypeFilter(prev => prev === kpi.clickType ? 'all' : kpi.clickType!) : undefined}
              sx={{
                p: 1, borderRadius: 1.5,
                bgcolor: 'clickType' in kpi && kpi.clickType && typeFilter === kpi.clickType ? `${kpi.color}18` : `${kpi.color}0b`,
                border: `1px solid ${'clickType' in kpi && kpi.clickType && typeFilter === kpi.clickType ? `${kpi.color}45` : `${kpi.color}1a`}`,
                cursor: 'clickType' in kpi && kpi.clickType ? 'pointer' : 'default',
                transition: 'all 0.18s',
                '&:hover': 'clickType' in kpi && kpi.clickType ? { filter: 'brightness(1.12)', transform: 'translateY(-1px)' } : {},
              }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: kpi.color, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.4, lineHeight: 1 }}>{kpi.label}</Typography>
              </Box>
              <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: kpi.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{kpi.value}</Typography>
              <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1.2, mt: 0.2 }}>{kpi.sub}</Typography>
            </Box>
          ))}
        </Box>

        {/* ── Active type filter indicator ───────────── */}
        {typeFilter !== 'all' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.7,
              px: 1.4, py: 0.5, borderRadius: 2,
              bgcolor: `${TYPE_COLOR[typeFilter]}14`,
              border: `1px solid ${TYPE_COLOR[typeFilter]}35`,
            }}>
              <Typography sx={{ fontSize: '0.75rem', lineHeight: 1 }}>{TYPE_EMOJI[typeFilter]}</Typography>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: TYPE_COLOR[typeFilter] }}>
                Filtro: {TYPE_LABEL[typeFilter]}
              </Typography>
              <Box onClick={() => setTypeFilter('all')} sx={{ cursor: 'pointer', ml: 0.5, color: `${TYPE_COLOR[typeFilter]}80`, '&:hover': { color: TYPE_COLOR[typeFilter] }, fontSize: '0.8rem', lineHeight: 1, fontWeight: 700 }}>×</Box>
            </Box>
          </Box>
        )}
      </Box>{/* end command center hero */}

      {/* Urgency sprint banner — today's videos */}
      {todayVideos.length > 0 && (
        <Box sx={{
          mx: { xs: 2, md: 3 }, mt: 1.5, px: 1.5, py: 0.8, borderRadius: 2, flexShrink: 0,
          bgcolor: `${DS.orange}0d`,
          border: `1px solid ${DS.orange}38`,
          display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
          animation: 'urgentGlow 2.4s ease-in-out infinite',
          '@keyframes urgentGlow': {
            '0%,100%': { borderColor: `${DS.orange}30` },
            '50%': { borderColor: `${DS.orange}66` },
          },
        }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: DS.orange, flexShrink: 0, boxShadow: `0 0 8px ${DS.orange}` }} />
          <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', color: DS.orange }}>
            {todayVideos.length} vídeo{todayVideos.length > 1 ? 's' : ''} para publicar hoje
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.6, flex: 1, flexWrap: 'wrap' }}>
            {todayVideos.slice(0, 4).map(i => (
              <Chip
                key={i.i}
                label={states[i.i]?.title || i.n}
                size="small"
                onClick={() => setSelectedId(i.i)}
                sx={{ height: 20, fontSize: '0.55rem', fontWeight: 700, bgcolor: `${DS.orange}1f`, color: DS.orange, border: `1px solid ${DS.orange}30`, cursor: 'pointer', maxWidth: 160 }}
              />
            ))}
            {todayVideos.length > 4 && (
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', alignSelf: 'center' }}>+{todayVideos.length - 4} mais</Typography>
            )}
          </Box>
        </Box>
      )}

      {/* Rejected videos alert */}
      {rejectedVideos.length > 0 && (
        <Box sx={{
          mx: { xs: 2, md: 3 }, mt: 1, px: 1.5, py: 0.8, borderRadius: 2, flexShrink: 0,
          bgcolor: `${DS.red}0f`, border: `1px solid ${DS.red}38`,
          display: 'flex', alignItems: 'center', gap: 1,
        }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: DS.red, flexShrink: 0 }} />
          <Typography sx={{ fontWeight: 800, fontSize: '0.75rem', color: DS.red }}>
            {rejectedVideos.length} reprovado{rejectedVideos.length > 1 ? 's' : ''} pelo cliente — refazer
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flex: 1, flexWrap: 'wrap' }}>
            {rejectedVideos.slice(0, 3).map(i => (
              <Chip key={i.i} label={states[i.i]?.title || i.n} size="small" onClick={() => setSelectedId(i.i)}
                sx={{ height: 18, fontSize: '0.5rem', bgcolor: `${DS.red}1f`, color: DS.red, cursor: 'pointer' }} />
            ))}
          </Box>
        </Box>
      )}

      {/* ── View tab bar ────────────────────────────────── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0, px: { xs: 2, md: 3 }, pt: 0.5,
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        {([
          { key: 'queue',  label: 'Fila de Edição' },
          { key: 'upload', label: 'Material a Subir', badge: pendingUploadCount },
          { key: 'esteira', label: 'Esteira', badge: reprovadosCount },
        ] as const).map(tab => {
          const active = editorView === tab.key
          return (
            <Box
              key={tab.key}
              onClick={() => setEditorView(tab.key)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.7,
                px: 1.8, py: 1, cursor: 'pointer',
                borderBottom: active ? `2px solid ${DS.orange}` : '2px solid transparent',
                color: active ? DS.orange : 'rgba(255,255,255,0.40)',
                transition: 'all 0.15s',
                '&:hover': { color: active ? DS.orange : 'rgba(255,255,255,0.70)' },
              }}
            >
              <Typography sx={{ fontSize: '0.76rem', fontWeight: active ? 700 : 500, lineHeight: 1, letterSpacing: '-0.01em' }}>
                {tab.label}
              </Typography>
              {'badge' in tab && tab.badge > 0 && (
                <Box sx={{
                  minWidth: 17, height: 17, px: 0.5, borderRadius: '9px',
                  bgcolor: active ? `${DS.orange}26` : `${DS.red}22`,
                  border: `1px solid ${active ? `${DS.orange}55` : `${DS.red}45`}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Typography sx={{ fontSize: '0.52rem', fontWeight: 800, color: active ? DS.orange : DS.red, lineHeight: 1 }}>
                    {tab.badge}
                  </Typography>
                </Box>
              )}
            </Box>
          )
        })}
        <Box sx={{ flex: 1 }} />
        {editorView === 'upload' && (
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            onClick={() => { setNewSessionDate(new Date().toISOString().slice(0, 10)); setNewSessionClients(new Set()); setNewSessionOpen(true) }}
            sx={{ mb: 0.8 }}
          >
            Nova sessão de gravação
          </Button>
        )}
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, p: { xs: 2, md: 3 }, overflow: 'auto' }}>

      {/* ── Pomodoro progress bar ────────────────────────── */}
      {pomodoroEnabled && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, whiteSpace: 'nowrap', minWidth: 80, color: pomodoroPhase === 'work' ? '#ff5339' : '#00C47A' }}>
            {pomodoroPhase === 'work' ? '🍅 Foco' : '☕ Pausa'} {formatCountdown(pomodoroRemaining)}
          </Typography>
          <LinearProgress
            variant="determinate" value={pomodoroProgress}
            sx={{
              flex: 1, height: 3, borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.05)',
              '& .MuiLinearProgress-bar': {
                background: pomodoroPhase === 'work'
                  ? 'linear-gradient(90deg, #ff5339, #ff9039)'
                  : 'linear-gradient(90deg, #00A060, #00E090)',
                borderRadius: 2,
              },
            }}
          />
        </Box>
      )}

      {/* ── Smart pace bar ──────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap', color: paceColor }}>
          {paceLabel}
        </Typography>
        <LinearProgress
          variant="determinate" value={goalProgress}
          sx={{
            flex: 1, height: 4, borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.06)',
            '& .MuiLinearProgress-bar': {
              background: `linear-gradient(90deg, ${paceColor}99, ${paceColor})`,
              borderRadius: 2,
            },
          }}
        />
        {pendingCount > 0 && (
          <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.22)', whiteSpace: 'nowrap' }}>
            {pendingCount} rest. · {workdaysLeft}d úteis
          </Typography>
        )}
      </Box>

      {/* ── Upload view ─────────────────────────────────── */}
      {editorView === 'upload' && (
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>

          {recordingSessions.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 260, gap: 2 }}>
              <Typography sx={{ fontSize: '2.5rem', lineHeight: 1 }}>📥</Typography>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
                Nenhuma sessão de gravação ainda
              </Typography>
              <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', textAlign: 'center', maxWidth: 280 }}>
                Ao voltar de uma gravação, clique em "Nova sessão de gravação" e selecione os clientes gravados.
              </Typography>
              <Button
                startIcon={<AddIcon sx={{ fontSize: 15 }} />}
                onClick={() => { setNewSessionDate(new Date().toISOString().slice(0, 10)); setNewSessionClients(new Set()); setNewSessionOpen(true) }}
                sx={{
                  fontSize: '0.72rem', fontWeight: 800, borderRadius: 2, px: 2.5, py: 1,
                  background: 'linear-gradient(135deg, #ff9039, #ff5339)',
                  color: '#000', boxShadow: '0 4px 16px rgba(255,144,57,0.35)',
                  '&:hover': { filter: 'brightness(1.1)', transform: 'translateY(-1px)' },
                  transition: 'all 0.2s ease',
                }}
              >
                Nova sessão de gravação
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recordingSessions.map(session => {
                const totalItems = session.clients.reduce((acc, c) => acc + c.checklist.length, 0)
                const doneItems  = session.clients.reduce((acc, c) => acc + c.checklist.filter(i => i.checked).length, 0)
                const progress   = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0
                const allDone    = doneItems === totalItems
                const isExpanded = expandedSession === session.id
                const dateLabel  = new Date(session.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

                return (
                  <Paper key={session.id} elevation={0} sx={{
                    borderRadius: 2.5,
                    bgcolor: allDone ? 'rgba(0,196,122,0.05)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${allDone ? 'rgba(0,196,122,0.25)' : 'rgba(255,255,255,0.07)'}`,
                    overflow: 'hidden',
                    transition: 'border-color 0.3s',
                  }}>
                    {/* Session header */}
                    <Box
                      onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        px: 2, py: 1.5, cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                      }}
                    >
                      <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }}>{allDone ? '✅' : '📦'}</Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                          <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: allDone ? '#00C47A' : '#fff' }}>
                            Gravação · {dateLabel}
                          </Typography>
                          <Chip
                            label={allDone ? 'Concluída' : `${doneItems}/${totalItems}`}
                            size="small"
                            sx={{
                              height: 18, fontSize: '0.58rem', fontWeight: 700,
                              bgcolor: allDone ? 'rgba(0,196,122,0.15)' : 'rgba(255,144,57,0.12)',
                              color: allDone ? '#00C47A' : '#ff9039',
                              border: `1px solid ${allDone ? 'rgba(0,196,122,0.35)' : 'rgba(255,144,57,0.3)'}`,
                            }}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate" value={progress}
                            sx={{
                              flex: 1, height: 3, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)',
                              '& .MuiLinearProgress-bar': {
                                background: allDone
                                  ? 'linear-gradient(90deg, #00A060, #00C47A)'
                                  : 'linear-gradient(90deg, #ff5339, #ff9039)',
                                borderRadius: 2,
                              },
                            }}
                          />
                          <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                            {session.clients.length} cliente{session.clients.length !== 1 ? 's' : ''}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={e => { e.stopPropagation(); deleteRecordingSession(session.id) }}
                          sx={{ p: 0.4, color: 'rgba(255,255,255,0.15)', '&:hover': { color: '#FF4545', bgcolor: 'rgba(255,69,69,0.08)' } }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                        <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
                          {isExpanded ? '▲' : '▼'}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Session clients + checklists */}
                    <Collapse in={isExpanded}>
                      <Box sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        {session.clients.map(client => {
                          const clientDone  = client.checklist.filter(i => i.checked).length
                          const clientTotal = client.checklist.length
                          const clientAllDone = clientDone === clientTotal

                          return (
                            <Box key={client.clientName} sx={{
                              mt: 1.5, p: 1.5, borderRadius: 2,
                              bgcolor: clientAllDone ? 'rgba(0,196,122,0.06)' : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${clientAllDone ? 'rgba(0,196,122,0.2)' : 'rgba(255,255,255,0.06)'}`,
                            }}>
                              {/* Client header */}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}>
                                <Box sx={{
                                  width: 7, height: 7, borderRadius: '50%',
                                  bgcolor: clientAllDone ? '#00C47A' : '#ff9039',
                                  boxShadow: clientAllDone ? '0 0 6px #00C47A' : '0 0 6px #ff903999',
                                  flexShrink: 0,
                                }} />
                                <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, flex: 1 }}>
                                  {client.clientName}
                                </Typography>
                                <Typography sx={{ fontSize: '0.62rem', color: clientAllDone ? '#00C47A' : 'rgba(255,255,255,0.35)', fontWeight: 700 }}>
                                  {clientDone}/{clientTotal}
                                </Typography>
                              </Box>

                              {/* Checklist items */}
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                {client.checklist.map(checkItem => (
                                  <Box key={checkItem.id}>
                                    <Box
                                      onClick={() => toggleUploadCheck(session.id, client.clientName, checkItem.id)}
                                      sx={{
                                        display: 'flex', alignItems: 'center', gap: 1,
                                        px: 1, py: 0.6, borderRadius: 1.5, cursor: 'pointer',
                                        bgcolor: checkItem.checked ? 'rgba(0,196,122,0.06)' : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${checkItem.checked ? 'rgba(0,196,122,0.18)' : 'rgba(255,255,255,0.05)'}`,
                                        transition: 'all 0.15s',
                                        '&:hover': { bgcolor: checkItem.checked ? 'rgba(0,196,122,0.1)' : 'rgba(255,255,255,0.04)' },
                                      }}
                                    >
                                      <Box sx={{
                                        width: 16, height: 16, borderRadius: 0.8, flexShrink: 0,
                                        bgcolor: checkItem.checked ? '#00C47A' : 'transparent',
                                        border: `1.5px solid ${checkItem.checked ? '#00C47A' : 'rgba(255,255,255,0.2)'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all 0.15s',
                                      }}>
                                        {checkItem.checked && (
                                          <Typography sx={{ fontSize: '0.5rem', color: '#000', fontWeight: 900, lineHeight: 1 }}>✓</Typography>
                                        )}
                                      </Box>
                                      <Typography sx={{
                                        fontSize: '0.7rem', flex: 1,
                                        color: checkItem.checked ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.82)',
                                        textDecoration: checkItem.checked ? 'line-through' : 'none',
                                        transition: 'all 0.15s',
                                      }}>
                                        {checkItem.label}
                                      </Typography>
                                    </Box>
                                    {/* Drive link field */}
                                    {checkItem.hasLink && (
                                      <Box sx={{ mt: 0.4, ml: 3.5 }}>
                                        <TextField
                                          size="small" placeholder="Cole o link do Drive aqui..."
                                          value={checkItem.link ?? ''}
                                          onChange={e => updateUploadLink(session.id, client.clientName, checkItem.id, e.target.value)}
                                          onClick={e => e.stopPropagation()}
                                          fullWidth
                                          InputProps={{
                                            endAdornment: checkItem.link ? (
                                              <Tooltip title="Abrir link">
                                                <IconButton size="small" onClick={e => { e.stopPropagation(); window.open(checkItem.link, '_blank', 'noopener') }}
                                                  sx={{ p: 0.3, color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#3B8EFF' } }}>
                                                  <OpenInNewIcon sx={{ fontSize: 13 }} />
                                                </IconButton>
                                              </Tooltip>
                                            ) : null,
                                          }}
                                          sx={{
                                            '& .MuiInputBase-root': { fontSize: '0.62rem', height: 26, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '6px' },
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' },
                                            '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.18)' },
                                          }}
                                        />
                                      </Box>
                                    )}
                                  </Box>
                                ))}
                              </Box>

                              {/* Notify button — shown when all done */}
                              {clientAllDone && (() => {
                                const driveItem = client.checklist.find(i => i.hasLink)
                                const driveLink = driveItem?.link ?? ''
                                const alreadyNotified = isClientNotified(session.id, client.clientName)
                                return (
                                  <Box sx={{ mt: 1.2, pt: 1, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Button
                                      size="small"
                                      onClick={() => notifyArthur(session.id, client.clientName, driveLink, session.date)}
                                      sx={{
                                        fontSize: '0.65rem', fontWeight: 800, borderRadius: 2, px: 1.4, py: 0.5,
                                        bgcolor: alreadyNotified ? 'rgba(0,196,122,0.08)' : 'rgba(59,142,255,0.12)',
                                        border: `1px solid ${alreadyNotified ? 'rgba(0,196,122,0.3)' : 'rgba(59,142,255,0.4)'}`,
                                        color: alreadyNotified ? '#00C47A' : '#3B8EFF',
                                        '&:hover': { bgcolor: alreadyNotified ? 'rgba(0,196,122,0.14)' : 'rgba(59,142,255,0.2)' },
                                      }}
                                    >
                                      {alreadyNotified ? '✓ Notificação enviada' : '🔔 Notificar Arthur no painel'}
                                    </Button>
                                    {alreadyNotified && (
                                      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)' }}>
                                        aguardando ele criar as tarefas
                                      </Typography>
                                    )}
                                  </Box>
                                )
                              })()}
                            </Box>
                          )
                        })}
                      </Box>
                    </Collapse>
                  </Paper>
                )
              })}
            </Box>
          )}
        </Box>
      )}

      {/* ── Esteira (acompanhamento pós-edição) ─────────── */}
      {editorView === 'esteira' && <EditorEsteira items={items} states={states} now={now} editorNome={currentUser ? getDisplayName(currentUser) : undefined} />}

      {/* ── Main layout ─────────────────────────────────── */}
      {editorView === 'queue' && <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>

        {/* ── Current item ────────────────────────────── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>

          {currentItem && currentState ? (
            <>
              {/* ── Main card ─────────────────────────── */}
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2.5, md: 3.5 }, borderRadius: 3,
                  bgcolor: celebrateId === currentItem.i
                    ? 'rgba(0,196,122,0.06)'
                    : currentState.status === 6
                    ? 'rgba(255,59,48,0.04)'
                    : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${
                    celebrateId === currentItem.i ? '#00C47A40'
                    : currentState.status === 6 ? 'rgba(255,59,48,0.5)'
                    : isRunning ? 'rgba(255,144,57,0.35)'
                    : 'rgba(255,255,255,0.07)'}`,
                  animation: currentState.status === 6 ? 'rejectedCardPulse 2s ease-in-out infinite' : 'none',
                  '@keyframes rejectedCardPulse': {
                    '0%,100%': { boxShadow: '0 0 0 0 rgba(255,59,48,0)' },
                    '50%': { boxShadow: '0 0 0 6px rgba(255,59,48,0.12)' },
                  },
                  transition: 'all 0.4s', position: 'relative', overflow: 'hidden',
                  '&::before': isRunning && currentState.status !== 6 ? {
                    content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: 'linear-gradient(90deg, transparent 0%, #ff9039 50%, transparent 100%)',
                    animation: 'scanline 2.5s linear infinite',
                  } : {},
                  '@keyframes scanline': {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' },
                  },
                }}
              >
                {/* Tags */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                  <Chip label={currentItem.c} size="small" sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: 'rgba(255,144,57,0.12)', color: '#ff9039', border: '1px solid rgba(255,144,57,0.25)', height: 22 }} />
                  <Chip
                    icon={<Typography sx={{ fontSize: '0.75rem !important', lineHeight: 1, pl: '4px' }}>{TYPE_EMOJI[currentItem.tp] ?? '🎬'}</Typography>}
                    label={TYPE_LABEL[currentItem.tp] ?? currentItem.tp}
                    size="small"
                    sx={{
                      fontWeight: 700, fontSize: '0.68rem', height: 22,
                      bgcolor: `${TYPE_COLOR[currentItem.tp] ?? '#60A5FA'}14`,
                      color: TYPE_COLOR[currentItem.tp] ?? '#60A5FA',
                      border: `1px solid ${TYPE_COLOR[currentItem.tp] ?? '#60A5FA'}30`,
                    }}
                  />
                  {/* Specs CapCut */}
                  <Tooltip title="Ver specs para CapCut" arrow>
                    <Box
                      onClick={() => setSpecsOpen(v => !v)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.4, px: 1, py: 0.3, borderRadius: 1.5, cursor: 'pointer', bgcolor: specsOpen ? 'rgba(255,144,57,0.12)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', '&:hover': { bgcolor: 'rgba(255,144,57,0.1)', borderColor: 'rgba(255,144,57,0.3)' }, transition: 'all 0.15s' }}
                    >
                      <InfoOutlinedIcon sx={{ fontSize: 11, color: specsOpen ? '#ff9039' : 'rgba(255,255,255,0.3)' }} />
                      <Typography sx={{ fontSize: '0.6rem', color: specsOpen ? '#ff9039' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>Specs</Typography>
                    </Box>
                  </Tooltip>
                  <DeadlineChip dt={currentItem.dt} now={now} />
                  {currentState.status === 1 && (
                    <Chip label="Em edição" size="small" sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: 'rgba(255,215,0,0.1)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.2)', height: 22 }} />
                  )}
                  {currentState.status >= 2 && currentState.status !== 6 && (
                    <Chip label="✅ Entregue" size="small" sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: 'rgba(0,196,122,0.1)', color: '#00C47A', border: '1px solid rgba(0,196,122,0.2)', height: 22 }} />
                  )}
                  {currentState.status === 6 && (
                    <Chip
                      label="🔄 Reprovado" size="small"
                      sx={{
                        fontWeight: 800, fontSize: '0.65rem', height: 22,
                        bgcolor: 'rgba(255,59,48,0.12)', color: '#FF3B30',
                        border: '1px solid rgba(255,59,48,0.3)',
                        animation: 'chipReprovadoPulse 1.6s ease-in-out infinite',
                        '@keyframes chipReprovadoPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.55 } },
                      }}
                    />
                  )}
                </Box>

                {/* Specs CapCut panel */}
                {specsOpen && (
                  <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,144,57,0.05)', border: '1px solid rgba(255,144,57,0.18)', display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {(() => {
                      const s = CAPCUT_SPECS[currentItem.tp as keyof typeof CAPCUT_SPECS] ?? CAPCUT_SPECS.Reel
                      return [
                        { label: 'Resolução', value: s.res },
                        { label: 'Proporção', value: s.ratio },
                        { label: 'Duração',   value: s.dur },
                        { label: 'Frame rate', value: s.fps },
                        { label: 'Formato',   value: 'MP4 H.264' },
                        { label: 'Áudio',     value: 'AAC · 44kHz' },
                      ].map(({ label, value }) => (
                        <Box key={label}>
                          <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.2 }}>{label}</Typography>
                          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#ff9039' }}>{value}</Typography>
                        </Box>
                      ))
                    })()}
                    {(() => {
                      const s = CAPCUT_SPECS[currentItem.tp as keyof typeof CAPCUT_SPECS] ?? CAPCUT_SPECS.Reel
                      const txt = `Specs CapCut (${currentItem.tp}): ${s.res} · ${s.ratio} · ${s.fps} · MP4 H.264 · AAC 44kHz`
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
                          <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(txt).catch(() => {}); setSpecsCopied(true); setTimeout(() => setSpecsCopied(false), 1400) }}
                            sx={{ fontSize: '0.6rem', py: 0.3, px: 1, minWidth: 0, color: specsCopied ? '#00C47A' : '#ff9039', border: '1px solid rgba(255,144,57,0.3)', '&:hover': { bgcolor: 'rgba(255,144,57,0.08)' } }}>
                            {specsCopied ? 'Copiado!' : 'Copiar'}
                          </Button>
                        </Box>
                      )
                    })()}
                  </Box>
                )}

                {/* Title */}
                <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.4rem', md: '1.9rem', lg: '2.2rem' }, color: '#fff', lineHeight: 1.15, mb: 0.3, letterSpacing: '-0.02em' }}>
                  {currentState.title || currentItem.n}
                </Typography>

                {/* Rejection reason banner */}
                {currentState.status === 6 && (() => {
                  const reason = currentState.rejectionText
                    || currentState.comments?.find(c => c.authorType === 'client')?.text
                    || ''
                  return (
                    <Box sx={{
                      mt: 1, mb: 0.5, p: 1.5, borderRadius: 2,
                      bgcolor: 'rgba(255,59,48,0.07)',
                      border: '1px solid rgba(255,59,48,0.35)',
                      animation: 'rejectedBanner 2s ease-in-out infinite',
                      '@keyframes rejectedBanner': {
                        '0%,100%': { borderColor: 'rgba(255,59,48,0.35)' },
                        '50%': { borderColor: 'rgba(255,59,48,0.7)' },
                      },
                    }}>
                      <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: '#FF3B30', mb: reason ? 0.8 : 0 }}>
                        🔄 Reprovado pelo cliente — precisa refazer
                      </Typography>
                      {reason && (
                        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)' }}>
                          <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,200,200,0.9)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                            💬 {reason}
                          </Typography>
                        </Box>
                      )}
                      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,59,48,0.6)', mt: 0.8 }}>
                        Clique em REFAZER para voltar ao Kanban como "Em edição"
                      </Typography>
                      {/* Quick revision notes */}
                      <Box sx={{ mt: 1.5 }}>
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,200,200,0.5)', textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.5, fontWeight: 700 }}>
                          ✏️ Notas da revisão (editor)
                        </Typography>
                        <TextField
                          multiline rows={2} fullWidth
                          key={`rev-notes-${currentItem.i}`}
                          placeholder="O que você vai mudar nessa revisão?"
                          defaultValue={currentState.notes ?? ''}
                          onBlur={e => {
                            if (e.target.value !== (currentState.notes ?? '')) {
                              onUpdate(currentItem.i, { notes: e.target.value })
                            }
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)',
                              bgcolor: 'rgba(255,59,48,0.04)',
                              '& fieldset': { borderColor: 'rgba(255,59,48,0.2)' },
                              '&:hover fieldset': { borderColor: 'rgba(255,59,48,0.4)' },
                              '&.Mui-focused fieldset': { borderColor: 'rgba(255,59,48,0.55)' },
                            },
                          }}
                        />
                      </Box>
                    </Box>
                  )
                })()}

                {/* Suggested filename */}
                <Tooltip title="Nome sugerido para o arquivo — clique para copiar" arrow placement="bottom-start">
                  <Box
                    onClick={() => navigator.clipboard.writeText(suggestFilename(currentItem))}
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 1.5, px: 1, py: 0.3, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,144,57,0.08)', borderColor: 'rgba(255,144,57,0.25)' }, transition: 'all 0.15s' }}
                  >
                    <ContentCopyIcon sx={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }} />
                    <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.28)', fontFamily: 'monospace' }}>
                      {suggestFilename(currentItem)}.mp4
                    </Typography>
                  </Box>
                </Tooltip>

                {/* Timer */}
                {(() => {
                  const elapsed = getElapsed(currentItem.i)
                  const estMs = ESTIMATED_MS[currentItem.tp] ?? ESTIMATED_MS.Reel
                  const pct = Math.min((elapsed / estMs) * 100, 100)
                  const overTime = elapsed > estMs
                  const timerBarColor = overTime ? '#FF3B30' : pct > 80 ? '#FFD700' : '#00C47A'
                  return (
                    <Box sx={{ my: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography sx={{
                          fontWeight: 900, fontSize: { xs: '3rem', md: '5rem' },
                          fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                          color: isRunning ? (overTime ? '#FF3B30' : '#ff9039') : 'rgba(255,255,255,0.15)',
                          transition: 'all 0.5s', letterSpacing: '-0.02em',
                        }}>
                          {formatTimer(elapsed)}
                        </Typography>
                        {isRunning && (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6, pb: 0.5 }}>
                            {[0, 1, 2].map(i => (
                              <Box key={i} sx={{
                                width: 5, height: 5, borderRadius: '50%', bgcolor: overTime ? '#FF3B30' : '#ff9039',
                                animation: 'dotPulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s`,
                                '@keyframes dotPulse': { '0%,80%,100%': { opacity: 0.2 }, '40%': { opacity: 1 } },
                              }} />
                            ))}
                          </Box>
                        )}
                        <Box sx={{ ml: 'auto', textAlign: 'right' }}>
                          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                            Estimado
                          </Typography>
                          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: overTime ? '#FF3B30' : 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>
                            {formatTimer(estMs)}
                          </Typography>
                          {overTime && (
                            <Typography sx={{ fontSize: '0.58rem', color: '#FF3B30', fontWeight: 700 }}>
                              +{formatDuration(elapsed - estMs)} extra
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      {/* Time progress bar */}
                      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate" value={pct}
                          sx={{
                            flex: 1, height: 3, borderRadius: 2,
                            bgcolor: 'rgba(255,255,255,0.05)',
                            '& .MuiLinearProgress-bar': {
                              background: `linear-gradient(90deg, ${timerBarColor}88, ${timerBarColor})`,
                              borderRadius: 2,
                              transition: 'none',
                            },
                          }}
                        />
                        <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.22)', whiteSpace: 'nowrap' }}>
                          {Math.round(pct)}%
                        </Typography>
                      </Box>
                    </Box>
                  )
                })()}

                {/* Buttons */}
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {!isRunning ? (
                    <Button
                      variant="contained"
                      color={currentState.status === 6 ? 'error' : 'primary'}
                      size="large"
                      startIcon={currentState.status === 6 ? undefined : <PlayArrowIcon />}
                      onClick={handleStart} disabled={currentState.status >= 2 && currentState.status !== 6}
                      sx={{
                        px: { xs: 2.5, md: 4 }, fontSize: { xs: '0.9rem', md: '1rem' },
                        ...(currentState.status === 6 && {
                          animation: 'refazerPulse 1.8s ease-in-out infinite',
                          '@keyframes refazerPulse': {
                            '0%,100%': { boxShadow: '0 4px 20px rgba(239,68,68,0.35)' },
                            '50%':     { boxShadow: '0 4px 28px rgba(239,68,68,0.65)' },
                          },
                        }),
                      }}
                    >
                      {currentState.status === 6 ? 'Refazer' : currentState.status === 0 ? 'Começar' : 'Retomar'}
                    </Button>
                  ) : (
                    <Button
                      variant="outlined" size="large" startIcon={<PauseIcon />}
                      onClick={handlePause}
                      sx={{ px: { xs: 2.5, md: 4 }, fontSize: { xs: '0.9rem', md: '1rem' } }}
                    >
                      Pausar
                    </Button>
                  )}

                  <Button
                    variant="contained" color="success" size="large" startIcon={<CheckIcon />}
                    onClick={handleDeliverClick} disabled={currentState.status >= 2 || currentState.status === 6}
                    sx={{ px: { xs: 2.5, md: 4 }, fontSize: { xs: '0.9rem', md: '1rem' } }}
                  >
                    Entregar
                  </Button>

                  {driveLink && (
                    <Tooltip title="Abrir Drive">
                      <IconButton onClick={() => window.open(driveLink, '_blank', 'noopener')}
                        sx={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#fff', borderColor: 'rgba(255,255,255,0.35)', bgcolor: 'rgba(255,255,255,0.06)' } }}>
                        <OpenInNewIcon />
                      </IconButton>
                    </Tooltip>
                  )}

                  {/* Voice note button */}
                  <Tooltip title={recording ? 'Parar gravação' : hasAudio[currentItem.i] ? (playingId === currentItem.i ? 'Pausar nota de voz' : '🎙 Ouvir nota de voz') : 'Gravar nota de voz rápida'}>
                    <IconButton
                      onClick={recording ? stopRecording : hasAudio[currentItem.i] ? () => playAudioNote(currentItem.i) : startRecording}
                      sx={{
                        border: `1px solid ${recording ? 'rgba(255,83,57,0.6)' : hasAudio[currentItem.i] ? 'rgba(59,142,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                        color: recording ? '#ff5339' : hasAudio[currentItem.i] ? '#3B8EFF' : 'rgba(255,255,255,0.35)',
                        animation: recording ? 'micPulse 1.5s ease-in-out infinite' : 'none',
                        '@keyframes micPulse': { '0%,100%': { boxShadow: '0 0 0 0 rgba(255,83,57,0.3)' }, '50%': { boxShadow: '0 0 0 8px rgba(255,83,57,0)' } },
                        '&:hover': { color: '#fff', borderColor: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.06)' },
                      }}
                    >
                      {recording ? <StopIcon /> : hasAudio[currentItem.i] ? (playingId === currentItem.i ? <StopIcon /> : <PlayCircleOutlineIcon />) : <MicIcon />}
                    </IconButton>
                  </Tooltip>

                  {/* Gerar legendas no LegendaPro — já na marca do cliente */}
                  <Tooltip title="Gerar legendas dinâmicas no LegendaPro (já na marca do cliente)">
                    <IconButton
                      onClick={() => window.open(legendaProUrl({ cliente: currentItem.c, roteiro: currentState.caption || clientRoteiros[0]?.title || currentItem.n }), '_blank', 'noopener')}
                      sx={{ border: '1px solid rgba(255,144,57,0.4)', '&:hover': { borderColor: '#ff9039', bgcolor: 'rgba(255,144,57,0.12)' } }}
                    >
                      <Typography sx={{ fontSize: '1.05rem', lineHeight: 1 }}>✨</Typography>
                    </IconButton>
                  </Tooltip>

                  {/* IA do Editor — sugestões do vídeo */}
                  <Tooltip title="IA: gancho, cortes, SFX, legenda e hashtags">
                    <IconButton onClick={() => setAiOpen(true)}
                      sx={{ border: '1px solid rgba(192,132,252,0.4)', '&:hover': { borderColor: '#C084FC', bgcolor: 'rgba(192,132,252,0.12)' } }}>
                      <Typography sx={{ fontSize: '1.05rem', lineHeight: 1 }}>🤖</Typography>
                    </IconButton>
                  </Tooltip>

                  {/* Creative Engine DS — briefing → roteiro completo */}
                  <Tooltip title="Creative Engine: big idea, ganchos, roteiro, edição, CTA e checklist">
                    <IconButton onClick={() => { setCreativeInicial(null); setCreativeOpen(true) }}
                      sx={{ border: '1px solid rgba(255,144,57,0.45)', '&:hover': { borderColor: '#ff9039', bgcolor: 'rgba(255,144,57,0.14)' } }}>
                      <Typography sx={{ fontSize: '1.05rem', lineHeight: 1 }}>⚡</Typography>
                    </IconButton>
                  </Tooltip>

                  {/* Transcrever fala → legenda */}
                  {currentState.footageLink && (
                    <Tooltip title="Transcrever a fala do vídeo em legenda (OpenAI)">
                      <IconButton onClick={() => setTranscribeOpen(true)}
                        sx={{ border: '1px solid rgba(59,142,255,0.4)', '&:hover': { borderColor: '#3B8EFF', bgcolor: 'rgba(59,142,255,0.12)' } }}>
                        <Typography sx={{ fontSize: '1.05rem', lineHeight: 1 }}>📝</Typography>
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>

                {/* Celebration */}
                {celebrateId === currentItem.i && (
                  <Box sx={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'celebrateFade 3s ease-out forwards',
                    '@keyframes celebrateFade': { '0%': { opacity: 1 }, '60%': { opacity: 1 }, '100%': { opacity: 0 } },
                  }}>
                    <Typography sx={{ fontSize: { xs: '3rem', md: '5rem' }, userSelect: 'none' }}>🎬✅</Typography>
                  </Box>
                )}

                {/* ── 4. Footage link ──── */}
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {editingFootage ? (
                    <TextField
                      size="small" autoFocus
                      placeholder="Cole o link do arquivo bruto (Drive)..."
                      value={footageLinkValue}
                      onChange={e => setFootageLinkValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { onUpdate(currentItem.i, { footageLink: footageLinkValue }); setEditingFootage(false) }
                        if (e.key === 'Escape') setEditingFootage(false)
                      }}
                      onBlur={() => { if (footageLinkValue) onUpdate(currentItem.i, { footageLink: footageLinkValue }); setEditingFootage(false) }}
                      sx={{ flex: 1, minWidth: 200, '& .MuiInputBase-root': { fontSize: '0.75rem', color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' }, '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } }}
                    />
                  ) : currentState.footageLink ? (
                    <Box sx={{ display: 'flex', gap: 0.8 }}>
                      <Button size="small" startIcon={<VideoFileIcon sx={{ fontSize: 14 }} />}
                        onClick={() => window.open(currentState.footageLink, '_blank', 'noopener')}
                        sx={{ fontSize: '0.68rem', border: '1px solid rgba(192,132,252,0.35)', color: '#C084FC', '&:hover': { bgcolor: 'rgba(192,132,252,0.08)' } }}>
                        Arquivo bruto
                      </Button>
                      <Tooltip title="Alterar link do arquivo">
                        <IconButton size="small" onClick={() => { setFootageLinkValue(currentState.footageLink ?? ''); setEditingFootage(true) }}
                          sx={{ color: 'rgba(255,255,255,0.2)', width: 26, height: 26, '&:hover': { color: '#C084FC' } }}>
                          <TuneIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ) : (
                    <Button size="small" startIcon={<VideoFileIcon sx={{ fontSize: 13 }} />}
                      onClick={() => { setFootageLinkValue(''); setEditingFootage(true) }}
                      sx={{ fontSize: '0.65rem', border: '1px dashed rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.3)', '&:hover': { border: '1px dashed rgba(192,132,252,0.4)', color: '#C084FC' } }}>
                      + Link do arquivo bruto
                    </Button>
                  )}

                  {/* ── 5. Editor assignment ──── */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, ml: 'auto' }}>
                    <PersonAddIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.2)' }} />
                    <TextField
                      select size="small"
                      value={currentState.assignedEditor ?? ''}
                      onChange={e => onUpdate(currentItem.i, { assignedEditor: e.target.value || undefined })}
                      sx={{
                        minWidth: 130,
                        '& .MuiInputBase-root': { fontSize: '0.65rem', height: 26, bgcolor: 'rgba(255,255,255,0.04)' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
                      }}
                    >
                      <MenuItem value="" sx={{ fontSize: '0.68rem' }}>Não atribuído</MenuItem>
                      {Object.entries(NAME_MAP).map(([key, info]) => (
                        <MenuItem key={key} value={key} sx={{ fontSize: '0.68rem' }}>
                          {info.emoji} {getDisplayName(key)}
                        </MenuItem>
                      ))}
                    </TextField>
                    {currentUser && currentState.assignedEditor !== currentUser && (
                      <Tooltip title="Assumir este item">
                        <Button size="small" onClick={() => onUpdate(currentItem.i, { assignedEditor: currentUser })}
                          sx={{ fontSize: '0.6rem', py: 0.3, px: 1, border: '1px solid rgba(255,144,57,0.3)', color: 'primary.main', minWidth: 0, '&:hover': { bgcolor: 'rgba(255,144,57,0.08)' } }}>
                          Assumir
                        </Button>
                      </Tooltip>
                    )}
                  </Box>
                </Box>

                {/* ── Checklist do vídeo (por vídeo, persiste) ── */}
                {checklistItems.length > 0 && (() => {
                  const myChecks = cardChecks[currentItem.i] ?? {}
                  const done = checklistItems.filter(it => myChecks[it]).length
                  const pct = checklistItems.length ? Math.round((done / checklistItems.length) * 100) : 0
                  const allDone = done === checklistItems.length
                  return (
                    <Box sx={{ mt: 2, p: 1.4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)', border: `1px solid ${allDone ? 'rgba(0,196,122,0.25)' : 'rgba(255,255,255,0.06)'}` }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.9 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '0.75rem', color: allDone ? '#00C47A' : 'rgba(255,255,255,0.7)' }}>✓ Checklist</Typography>
                        <Box sx={{ flex: 1, height: 5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                          <Box sx={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #00A060, #00E090)', transition: 'width 0.3s ease' }} />
                        </Box>
                        <Typography sx={{ fontSize: '0.64rem', fontWeight: 800, color: allDone ? '#00C47A' : 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>{done}/{checklistItems.length}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                        {checklistItems.map((item) => {
                          const checked = !!myChecks[item]
                          return (
                            <Box key={item} onClick={() => setCardChecks(prev => {
                              const next = { ...prev }
                              const m = { ...(next[currentItem.i] ?? {}) }
                              m[item] = !m[item]
                              next[currentItem.i] = m
                              saveCardChecks(next)
                              return next
                            })}
                              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', py: 0.35, px: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                              <Box sx={{ width: 16, height: 16, borderRadius: 0.7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                bgcolor: checked ? '#00C47A' : 'transparent', border: `1.5px solid ${checked ? '#00C47A' : 'rgba(255,255,255,0.25)'}`, transition: 'all 0.15s' }}>
                                {checked && <Typography sx={{ fontSize: '0.6rem', color: '#000', fontWeight: 900, lineHeight: 1 }}>✓</Typography>}
                              </Box>
                              <Typography sx={{ fontSize: '0.72rem', color: checked ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)', textDecoration: checked ? 'line-through' : 'none' }}>{item}</Typography>
                            </Box>
                          )
                        })}
                      </Box>
                    </Box>
                  )
                })()}

                {/* Keyboard hints */}
                <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <KbdHint keys={['Space']} label={isRunning ? 'pausar' : currentState.status === 0 ? 'começar' : 'retomar'} />
                  <KbdHint keys={['Enter']} label="entregar" />
                  <KbdHint keys={['↑', '↓']} label="navegar fila" />
                </Box>
              </Paper>

              {/* ── Roteiros sempre visíveis ─────────────── */}
              {clientRoteiros.length > 0 && (
                <Paper sx={{ borderRadius: 2.5, bgcolor: 'rgba(255,144,57,0.025)', border: '1px solid rgba(255,144,57,0.14)', overflow: 'hidden' }}>
                  <Box sx={{ px: 2, py: 1.2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255,144,57,0.1)' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.75rem', color: '#ff9039' }}>📜 Roteiro{clientRoteiros.length > 1 ? 's' : ''}</Typography>
                    <Chip label={clientRoteiros.length} size="small" sx={{ height: 16, fontSize: '0.58rem', bgcolor: 'rgba(255,144,57,0.15)', color: '#ff9039', fontWeight: 700 }} />
                  </Box>
                  <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                    {clientRoteiros.map((r, idx) => (
                      <Box key={r.id} sx={{ p: 1.2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1.5, border: '1px solid rgba(255,144,57,0.1)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,144,57,0.5)', fontWeight: 700, mt: 0.15, flexShrink: 0 }}>#{idx + 1}</Typography>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.88)', lineHeight: 1.3 }}>{r.title}</Typography>
                            {r.notes && (
                              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.42)', mt: 0.4, lineHeight: 1.5 }}>{r.notes}</Typography>
                            )}
                          </Box>
                          {r.driveLink && (
                            <Tooltip title="Abrir roteiro no Drive">
                              <IconButton size="small" onClick={() => window.open(r.driveLink, '_blank', 'noopener')}
                                sx={{ color: 'rgba(255,144,57,0.45)', '&:hover': { color: '#ff9039', bgcolor: 'rgba(255,144,57,0.08)' }, flexShrink: 0 }}>
                                <OpenInNewIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              )}

              {/* ── Briefing (caption + notas) ───────────── */}
              {(currentState.notes || currentState.caption) && (
                <Paper sx={{ borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <Box onClick={() => setBriefingOpen(v => !v)} sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', flex: 1 }}>📋 Briefing</Typography>
                    {briefingOpen ? <ExpandLessIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.25)' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.25)' }} />}
                  </Box>
                  <Collapse in={briefingOpen}>
                    <Box sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {currentState.caption && (
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, flex: 1 }}>Legenda</Typography>
                            <Tooltip title="Copiar legenda">
                              <IconButton size="small"
                                onClick={() => navigator.clipboard.writeText(currentState.caption)}
                                sx={{ p: 0.3, color: 'rgba(255,255,255,0.2)', '&:hover': { color: '#ff9039' } }}>
                                <ContentCopyIcon sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{currentState.caption}</Typography>
                        </Box>
                      )}
                      {currentState.notes && currentState.status !== 6 && (
                        <Box>
                          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, mb: 0.5, fontWeight: 700 }}>Notas internas</Typography>
                          <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-wrap' }}>{currentState.notes}</Typography>
                        </Box>
                      )}
                    </Box>
                  </Collapse>
                </Paper>
              )}
            </>
          ) : (
            <EmptyQueue />
          )}

          {/* ── Vitrine do mês ────────────────────────── */}
          {monthSessions.length > 0 && (
            <Paper sx={{ borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <Box onClick={() => setGalleryOpen(v => !v)} sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                <GridViewIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.3)', mr: 1 }} />
                <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', flex: 1 }}>
                  Vitrine do mês · {monthSessions.length} vídeos
                </Typography>
                <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.22)', mr: 1 }}>
                  {formatDuration(monthTime)} total · avg {formatDuration(avgTime)}
                </Typography>
                {galleryOpen ? <ExpandLessIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.25)' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.25)' }} />}
              </Box>
              <Collapse in={galleryOpen}>
                <Box sx={{ p: 1.5, display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(4,1fr)', lg: 'repeat(5,1fr)' }, gap: 1 }}>
                  {[...monthSessions].reverse().map((session, idx) => (
                    <GalleryCard key={idx} session={session} states={states} />
                  ))}
                </Box>
              </Collapse>
            </Paper>
          )}
        </Box>

        {/* ── Queue sidebar ────────────────────────────── */}
        <Box sx={{ width: 280, flexShrink: 0, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Fila · {videoQueue.length} item{videoQueue.length !== 1 ? 's' : ''}
            </Typography>
            <Box sx={{ flex: 1 }} />
            {inProgressCount > 0 && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#FFD700', opacity: 0.85 }} />}
          </Box>

          {/* ── Tipo de conteúdo (Reel | Feed | Todos) ── */}
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
            {([
              { key: 'all',  label: 'Todos',  emoji: '🌐', color: 'rgba(255,255,255,0.5)' },
              { key: 'Reel', label: 'Reels',  emoji: '🎬', color: TYPE_COLOR.Reel },
              { key: 'Feed', label: 'Feed',   emoji: '📸', color: TYPE_COLOR.Feed },
            ] as const).map(t => {
              const isActive = typeFilter === t.key
              return (
                <Box key={t.key} onClick={() => setTypeFilter(t.key)} sx={{
                  flex: 1, py: 0.55, borderRadius: 1.5, cursor: 'pointer',
                  textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4,
                  bgcolor: isActive ? `${t.color}18` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isActive ? `${t.color}40` : 'rgba(255,255,255,0.06)'}`,
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: `${t.color}10`, borderColor: `${t.color}28` },
                }}>
                  <Typography sx={{ fontSize: '0.65rem', lineHeight: 1 }}>{t.emoji}</Typography>
                  <Typography sx={{ fontSize: '0.56rem', fontWeight: 700, color: isActive ? t.color : 'rgba(255,255,255,0.3)', lineHeight: 1 }}>{t.label}</Typography>
                  {t.key === 'Reel' && reelCount > 0 && <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: isActive ? TYPE_COLOR.Reel : 'rgba(96,165,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Typography sx={{ fontSize: '0.45rem', fontWeight: 900, color: '#fff' }}>{reelCount}</Typography></Box>}
                  {t.key === 'Feed' && feedCount > 0 && <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: isActive ? TYPE_COLOR.Feed : 'rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Typography sx={{ fontSize: '0.45rem', fontWeight: 900, color: '#fff' }}>{feedCount}</Typography></Box>}
                </Box>
              )
            })}
          </Box>

          {/* ── 5. Queue filter (minha fila | todos) ── */}
          <Box sx={{ display: 'flex', borderRadius: 1.5, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            {(['all', 'mine'] as const).map(f => (
              <Box key={f} onClick={() => setQueueFilter(f)} sx={{
                flex: 1, py: 0.5, textAlign: 'center', cursor: 'pointer', fontSize: '0.52rem', fontWeight: 700,
                bgcolor: queueFilter === f ? 'rgba(255,144,57,0.15)' : 'transparent',
                color: queueFilter === f ? 'primary.main' : 'rgba(255,255,255,0.25)',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: queueFilter === f ? 'rgba(255,144,57,0.2)' : 'rgba(255,255,255,0.04)' },
              }}>
                {f === 'all' ? '🌐 Todos' : `👤 ${currentUser ? getDisplayName(currentUser) : 'Minha fila'}`}
              </Box>
            ))}
          </Box>

          {/* ── Foco do dia ── */}
          <Box onClick={() => setFocoHoje(v => !v)} sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, py: 0.55, borderRadius: 1.5, cursor: 'pointer', flexShrink: 0,
            bgcolor: focoHoje ? 'rgba(255,144,57,0.18)' : 'transparent',
            border: `1px solid ${focoHoje ? 'rgba(255,144,57,0.5)' : 'rgba(255,255,255,0.07)'}`,
            color: focoHoje ? '#ff9039' : 'rgba(255,255,255,0.3)',
            transition: 'all 0.15s', '&:hover': { color: '#ff9039', borderColor: 'rgba(255,144,57,0.4)' },
          }}>
            <Typography sx={{ fontSize: '0.6rem', lineHeight: 1 }}>🎯</Typography>
            <Typography sx={{ fontSize: '0.55rem', fontWeight: 800, lineHeight: 1 }}>
              {focoHoje ? `FOCO DO DIA · ${videoQueue.length}` : 'Foco do dia'}
            </Typography>
          </Box>

          <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.3, '&::-webkit-scrollbar': { width: 3 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2 } }}>
            {videoQueue.length === 0 && (
              <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.18)', textAlign: 'center', mt: 6 }}>
                Fila vazia 🎉
              </Typography>
            )}
            {queueByDate.map(group => (
              <Box key={group.label}>
                {/* Date group header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, px: 0.3, py: 0.6, mt: 0.4 }}>
                  {group.isRejected ? (
                    <>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#FF3B30', flexShrink: 0, animation: 'reprovPulse 1.4s ease-in-out infinite', '@keyframes reprovPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } } }} />
                      <Typography sx={{ fontSize: '0.56rem', fontWeight: 900, color: '#FF3B30', textTransform: 'uppercase', letterSpacing: 1 }}>
                        REPROVADOS — REFAZER · {group.items.length}
                      </Typography>
                    </>
                  ) : group.isToday ? (
                    <>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#ff9039', flexShrink: 0, animation: 'urgentPulse 1.4s ease-in-out infinite', '@keyframes urgentPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                      <Typography sx={{ fontSize: '0.56rem', fontWeight: 900, color: '#ff9039', textTransform: 'uppercase', letterSpacing: 1 }}>
                        HOJE — URGENTE · {group.items.length}
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.54rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        {group.label} · {group.items.length}
                      </Typography>
                    </>
                  )}
                </Box>
                {/* Items in group */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pl: group.isToday ? 0 : 0 }}>
                  {group.items.map((item) => (
                    <QueueCard
                      key={item.i} item={item} state={states[item.i]}
                      isActive={item.i === (currentItem?.i ?? -1)}
                      isRunning={Boolean(timers[item.i]?.startedAt)}
                      elapsed={getElapsed(item.i)} position={videoQueue.indexOf(item) + 1} now={now}
                      hasAudio={Boolean(hasAudio[item.i])}
                      isUrgent={group.isToday}
                      isRejected={group.isRejected}
                      onClick={() => setSelectedId(item.i)}
                      onLegendas={() => window.open(legendaProUrl({ cliente: item.c, roteiro: states[item.i]?.caption || item.n }), '_blank', 'noopener')}
                    />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>

          {monthCount > 0 && (
            <Paper sx={{ p: 2, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, mb: 1 }}>
                Produção · {new Date().toLocaleDateString('pt-BR', { month: 'long' })}
              </Typography>
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, color: '#ff9039', lineHeight: 1, mb: 0.3 }}>
                {monthCount} <Typography component="span" sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>vídeos</Typography>
              </Typography>
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.38)' }}>
                  ⏱ Média: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{formatDuration(avgTime)}</strong>
                </Typography>
                <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.38)' }}>
                  ⏳ Total: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{formatDuration(monthTime)}</strong>
                </Typography>
                {pendingCount > 0 && (
                  <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.38)', mt: 0.3 }}>
                    📋 Faltam: <strong style={{ color: '#FFD700' }}>{pendingCount}</strong>
                  </Typography>
                )}
              </Box>
            </Paper>
          )}
        </Box>
      </Box>}

      {/* ── New recording session dialog ─────────────────── */}
      <Dialog open={newSessionOpen} onClose={() => setNewSessionOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(32px)', border: '1px solid rgba(255,144,57,0.15)', borderRadius: 3 } }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 0 }}>
          <Typography fontWeight={900} sx={{ fontSize: '1rem', mb: 0.3 }}>🎬 Nova sessão de gravação</Typography>
          <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mb: 2 }}>
            Selecione os clientes que foram gravados hoje para acompanhar o upload do material.
          </Typography>
          <TextField
            label="Data da gravação" type="date" size="small" fullWidth
            value={newSessionDate} onChange={e => setNewSessionDate(e.target.value)}
            sx={{ mb: 2 }}
            InputLabelProps={{ shrink: true }}
          />
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', mb: 1 }}>
            Clientes gravados ({newSessionClients.size} selecionados)
          </Typography>
          <Box sx={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 0.8,
            maxHeight: 280, overflowY: 'auto', pb: 0.5,
            '&::-webkit-scrollbar': { width: 3 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,144,57,0.3)', borderRadius: 2 },
          }}>
            {allClientNames.map(name => {
              const selected = newSessionClients.has(name)
              return (
                <Box
                  key={name}
                  onClick={() => setNewSessionClients(prev => {
                    const next = new Set(prev)
                    selected ? next.delete(name) : next.add(name)
                    return next
                  })}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    px: 1.2, py: 0.9, borderRadius: 1.5, cursor: 'pointer',
                    bgcolor: selected ? 'rgba(255,144,57,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selected ? 'rgba(255,144,57,0.4)' : 'rgba(255,255,255,0.07)'}`,
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: selected ? 'rgba(255,144,57,0.15)' : 'rgba(255,255,255,0.06)' },
                  }}
                >
                  <Box sx={{
                    width: 14, height: 14, borderRadius: 0.6, flexShrink: 0,
                    bgcolor: selected ? '#ff9039' : 'rgba(255,255,255,0.1)',
                    border: `1.5px solid ${selected ? '#ff9039' : 'rgba(255,255,255,0.2)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {selected && <Typography sx={{ fontSize: '0.45rem', color: '#000', fontWeight: 900, lineHeight: 1 }}>✓</Typography>}
                  </Box>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: selected ? 700 : 400, color: selected ? '#ff9039' : 'rgba(255,255,255,0.7)' }} noWrap>
                    {name}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        </Box>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button size="small" onClick={() => setNewSessionOpen(false)} sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>
            Cancelar
          </Button>
          <Button
            size="small"
            disabled={newSessionClients.size === 0}
            onClick={handleCreateSession}
            sx={{
              fontSize: '0.72rem', fontWeight: 800, px: 2, borderRadius: 2,
              background: newSessionClients.size > 0 ? 'linear-gradient(135deg, #ff9039, #ff5339)' : undefined,
              color: newSessionClients.size > 0 ? '#000' : undefined,
              '&:hover': { filter: 'brightness(1.08)' },
            }}
          >
            Criar sessão com {newSessionClients.size} cliente{newSessionClients.size !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── 2. WhatsApp delivery message dialog ─────────── */}
      <Dialog
        open={whatsappOpen} onClose={() => setWhatsappOpen(false)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#0d0d0d', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 3 } }}
      >
        <Box sx={{ px: 2.5, pt: 2.5, pb: 0, display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <WhatsAppIcon sx={{ color: '#25D366', fontSize: 22 }} />
          <Box>
            <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>Mensagem de entrega</Typography>
            <Typography variant="caption" color="text.secondary">Copie e envie para o gestor ou equipe</Typography>
          </Box>
        </Box>
        <DialogContent sx={{ pt: 1.5 }}>
          {deliveredSnapshot && (() => {
            // Detecta link Streamable e substitui por URL com prévia OG
            const rawLink = deliveredSnapshot.link
            const streamableId = rawLink ? extractStreamableId(rawLink) : null
            const shareLink = streamableId
              ? `${window.location.origin}/v/${streamableId}?t=${encodeURIComponent(deliveredSnapshot.title)}&c=${encodeURIComponent(deliveredSnapshot.client)}`
              : rawLink

            const msg = buildDeliveryMsg({ ...deliveredSnapshot, link: shareLink ?? '' })

            return (
              <>
                {/* Badge de prévia Streamable */}
                {streamableId && (
                  <Box sx={{
                    mb: 1.5, px: 1.4, py: 0.9, borderRadius: 2,
                    bgcolor: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.2)',
                    display: 'flex', alignItems: 'center', gap: 1,
                  }}>
                    <Typography sx={{ fontSize: '0.9rem', lineHeight: 1 }}>🖼️</Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#25D366' }}>
                        Prévia automática ativada
                      </Typography>
                      <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.38)' }} noWrap>
                        /v/{streamableId} — thumbnail + player
                      </Typography>
                    </Box>
                  </Box>
                )}
                <Box sx={{
                  p: 1.8, borderRadius: 2, bgcolor: 'rgba(37,211,102,0.05)',
                  border: '1px solid rgba(37,211,102,0.15)',
                  fontFamily: 'monospace', fontSize: '0.78rem', color: 'rgba(255,255,255,0.82)',
                  lineHeight: 1.9, whiteSpace: 'pre-wrap', mb: 1.5,
                }}>
                  {msg}
                </Box>

                {/* Botão de copiar só o link com prévia, separado */}
                {streamableId && shareLink && (
                  <Box sx={{
                    mb: 0.8, px: 1.2, py: 0.8, borderRadius: 1.5,
                    bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    display: 'flex', alignItems: 'center', gap: 1,
                  }}>
                    <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', flex: 1, fontFamily: 'monospace' }} noWrap>
                      {shareLink}
                    </Typography>
                    <Tooltip title="Copiar link com prévia">
                      <IconButton size="small" onClick={() => navigator.clipboard.writeText(shareLink)}
                        sx={{ p: 0.4, color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#25D366' } }}>
                        <ContentCopyIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                  <Button
                    fullWidth variant="outlined" size="small"
                    onClick={() => { navigator.clipboard.writeText(msg) }}
                    sx={{ fontSize: '0.72rem', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                  >
                    📋 Copiar mensagem
                  </Button>
                  <Button
                    fullWidth variant="outlined" size="small" startIcon={<WhatsAppIcon sx={{ fontSize: 16 }} />}
                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')}
                    sx={{ fontSize: '0.72rem', fontWeight: 700, borderColor: '#25D366', color: '#25D366', '&:hover': { bgcolor: 'rgba(37,211,102,0.08)' } }}
                  >
                    🔁 Reenviar no WhatsApp
                  </Button>
                </Box>
              </>
            )
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button size="small" onClick={() => setWhatsappOpen(false)} sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Checklist Dialog ────────────────────────────── */}
      <Dialog
        open={checklistOpen} onClose={() => setChecklistOpen(false)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#0d0d0d', border: '1px solid rgba(0,196,122,0.22)', borderRadius: 3 } }}
      >
        <Box sx={{ p: 2.5, pb: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={800}>✅ Checklist de entrega</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
              {currentItem ? `${currentItem.c} — ${currentState?.title || currentItem.n}` : ''}
            </Typography>
          </Box>
          <Tooltip title={checklistEditMode ? 'Fechar edição' : 'Editar checklist'}>
            <IconButton size="small" onClick={() => setChecklistEditMode(v => !v)}
              sx={{ color: checklistEditMode ? '#ff9039' : 'rgba(255,255,255,0.25)', mt: 0.3 }}>
              <TuneIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
        <DialogContent sx={{ pt: 1.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
            {checklistItems.map((item, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox
                  checked={checklistChecked[idx] ?? false}
                  onChange={e => {
                    const next = [...checklistChecked]
                    next[idx] = e.target.checked
                    setChecklistChecked(next)
                  }}
                  size="small"
                  sx={{ color: 'rgba(255,255,255,0.25)', '&.Mui-checked': { color: '#00C47A' }, p: 0.5 }}
                />
                <Typography sx={{
                  flex: 1, fontSize: '0.88rem',
                  color: checklistChecked[idx] ? 'rgba(255,255,255,0.35)' : '#fff',
                  textDecoration: checklistChecked[idx] ? 'line-through' : 'none',
                  transition: 'all 0.15s',
                }}>
                  {item}
                </Typography>
                {checklistEditMode && (
                  <IconButton size="small" onClick={() => {
                    const next = checklistItems.filter((_, i) => i !== idx)
                    setChecklistItems(next); saveChecklist(next)
                    setChecklistChecked(prev => prev.filter((_, i) => i !== idx))
                  }} sx={{ color: 'rgba(255,83,57,0.45)', '&:hover': { color: '#ff5339' }, p: 0.3 }}>
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
              </Box>
            ))}
          </Box>

          {checklistEditMode && (
            <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
              <TextField
                size="small" fullWidth placeholder="Novo item do checklist..."
                value={checklistNewItem}
                onChange={e => setChecklistNewItem(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && checklistNewItem.trim()) {
                    const next = [...checklistItems, checklistNewItem.trim()]
                    setChecklistItems(next); saveChecklist(next)
                    setChecklistChecked(prev => [...prev, false])
                    setChecklistNewItem('')
                  }
                }}
                sx={{ '& .MuiOutlinedInput-root': { color: '#fff', fontSize: '0.85rem', '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '&.Mui-focused fieldset': { borderColor: '#ff9039' } } }}
              />
              <IconButton size="small"
                onClick={() => {
                  if (!checklistNewItem.trim()) return
                  const next = [...checklistItems, checklistNewItem.trim()]
                  setChecklistItems(next); saveChecklist(next)
                  setChecklistChecked(prev => [...prev, false])
                  setChecklistNewItem('')
                }}
                sx={{ border: '1px solid rgba(255,255,255,0.12)', color: '#ff9039', '&:hover': { bgcolor: 'rgba(255,144,57,0.08)' } }}>
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          )}

          <Box sx={{ mt: 1.5, p: 1.2, borderRadius: 1.5, bgcolor: `rgba(${allChecked ? '0,196,122' : '255,144,57'},0.06)`, border: `1px solid rgba(${allChecked ? '0,196,122' : '255,144,57'},0.2)`, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: allChecked ? '#00C47A' : '#ff9039' }}>
              {checkedCount}/{checklistItems.length} {allChecked ? '— tudo certo! 🚀' : '— itens verificados'}
            </Typography>
          </Box>
          <Box sx={{ mt: 1, px: 0.5, py: 0.8, borderRadius: 1.5, bgcolor: 'rgba(59,142,255,0.06)', border: '1px solid rgba(59,142,255,0.18)', textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.68rem', color: 'rgba(59,142,255,0.8)' }}>
              📋 Vai para <strong>Aprovação interna</strong> no Kanban automaticamente
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          <Button size="small" onClick={() => setChecklistOpen(false)} sx={{ color: 'rgba(255,255,255,0.35)' }}>Cancelar</Button>
          <Button
            size="small" variant="contained" startIcon={<CheckIcon sx={{ fontSize: 16 }} />}
            onClick={handleDeliver}
            sx={{
              fontWeight: 700,
              background: allChecked
                ? 'linear-gradient(135deg, #00C47A, #00A060)'
                : 'linear-gradient(135deg, #ff9039, #ff5339)',
              boxShadow: `0 4px 20px rgba(${allChecked ? '0,196,122' : '255,144,57'},0.3)`,
            }}
          >
            {allChecked ? '✅ Entregar → Aprovação interna' : 'Entregar assim mesmo'}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>{/* end scrollable content */}
    </Box>
  )
}

// ── Sub-components ────────────────────────────────────────

function StatPill({ children, glow }: { children: React.ReactNode; glow?: string }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.6,
      px: 1.3, py: 0.55, borderRadius: 2,
      bgcolor: glow ? `${glow}10` : 'rgba(255,255,255,0.04)',
      border: `1px solid ${glow ? `${glow}22` : 'rgba(255,255,255,0.07)'}`,
    }}>
      {children}
    </Box>
  )
}

function DeadlineChip({ dt, now }: { dt: Date; now: Date }) {
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const days = Math.round((dt.getTime() - today.getTime()) / 86400000)
  const isLate = days < 0
  const label = isLate ? `${Math.abs(days)}d atraso` : days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const color = isLate ? '#FF3B30' : days === 0 ? '#FFD700' : '#A1A1AA'
  return (
    <Chip
      icon={<AccessTimeIcon sx={{ fontSize: '11px !important', color: `${color} !important` }} />}
      label={label} size="small"
      sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: `${color}12`, color, border: `1px solid ${color}25`, height: 22 }}
    />
  )
}

function KbdHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
      {keys.map(k => (
        <Box key={k} sx={{ px: 0.8, py: 0.25, borderRadius: 0.8, bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'monospace', fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
          {k}
        </Box>
      ))}
      <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)', ml: 0.3 }}>{label}</Typography>
    </Box>
  )
}

function QueueCard({ item, state, isActive, isRunning, elapsed, position, now, hasAudio, isUrgent, isRejected, onClick, onLegendas }: {
  item: ContentItem; state?: ItemState; isActive: boolean; isRunning: boolean
  elapsed: number; position: number; now: Date; hasAudio: boolean; isUrgent?: boolean; isRejected?: boolean; onClick: () => void; onLegendas?: () => void
}) {
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const isLate = item.dt < today

  const hasRecording = useMemo(() => {
    try {
      const recs = JSON.parse(localStorage.getItem('sm_recordings') ?? '[]') as Array<{client?: string; clientName?: string; itemId?: number}>
      return recs.some(r => r.itemId === item.i || r.client === item.c || r.clientName === item.c)
    } catch { return false }
  }, [item.i, item.c])
  const st = state?.status ?? item.s
  const dotColor = st === 6 ? '#FF3B30' : st === 1 ? '#FFD700' : st === 0 ? '#71717A' : '#60A5FA'
  const estMs = ESTIMATED_MS[item.tp] ?? ESTIMATED_MS.Reel
  const typeColor = TYPE_COLOR[item.tp] ?? '#60A5FA'

  return (
    <Paper onClick={onClick} elevation={0} sx={{
      p: 1.3, borderRadius: 2, cursor: 'pointer',
      bgcolor: isActive && isRejected ? 'rgba(255,59,48,0.1)' : isActive ? 'rgba(255,144,57,0.07)' : isRejected ? 'rgba(255,59,48,0.04)' : isUrgent ? 'rgba(255,144,57,0.03)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${isActive && isRejected ? 'rgba(255,59,48,0.5)' : isActive ? 'rgba(255,144,57,0.28)' : isRejected ? 'rgba(255,59,48,0.28)' : isUrgent ? 'rgba(255,144,57,0.2)' : 'rgba(255,255,255,0.05)'}`,
      animation: isRejected ? 'queueRejPulse 2s ease-in-out infinite' : 'none',
      '@keyframes queueRejPulse': { '0%,100%': { borderColor: 'rgba(255,59,48,0.28)' }, '50%': { borderColor: 'rgba(255,59,48,0.55)' } },
      transition: 'all 0.15s',
      '&:hover': { bgcolor: isRejected ? 'rgba(255,59,48,0.08)' : isActive ? 'rgba(255,144,57,0.1)' : 'rgba(255,255,255,0.04)', borderColor: isRejected ? 'rgba(255,59,48,0.55)' : isActive ? 'rgba(255,144,57,0.4)' : 'rgba(255,255,255,0.1)' },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.18)', fontWeight: 700, width: 14, textAlign: 'center', flexShrink: 0 }}>
          {position}
        </Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.15 }}>
            <Typography sx={{ fontSize: '0.56rem', color: typeColor, fontWeight: 700, flexShrink: 0 }}>{item.tp}</Typography>
            {hasRecording && <Typography sx={{ fontSize: '0.6rem', lineHeight: 1 }}>🎥</Typography>}
            <Typography sx={{ fontSize: '0.64rem', color: '#ff9039', fontWeight: 700, flex: 1 }} noWrap>{item.c}</Typography>
            {hasAudio && <Typography sx={{ fontSize: '0.6rem', lineHeight: 1 }}>🎙</Typography>}
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0, boxShadow: isRunning ? `0 0 8px ${dotColor}` : 'none' }} />
          </Box>
          <Typography sx={{ fontSize: '0.75rem', color: isActive ? '#fff' : 'rgba(255,255,255,0.55)', fontWeight: isActive ? 600 : 400 }} noWrap>
            {state?.title || item.n}
          </Typography>
          {elapsed > 0 ? (
            <Typography sx={{ fontSize: '0.58rem', color: isRunning ? '#ff9039' : 'rgba(255,255,255,0.22)', mt: 0.2, fontVariantNumeric: 'tabular-nums' }}>
              ⏱ {formatDuration(elapsed)} / {formatDuration(estMs)}
            </Typography>
          ) : (
            <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.18)', mt: 0.2 }}>
              est. {formatDuration(estMs)}
            </Typography>
          )}
        </Box>
        {isLate && <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#FF3B30', flexShrink: 0 }} />}
        {onLegendas && (
          <Box onClick={(e) => { e.stopPropagation(); onLegendas(); }} title="Gerar legendas dinâmicas no LegendaPro (já na marca do cliente)"
            sx={{ flexShrink: 0, width: 27, height: 27, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: 'rgba(255,144,57,0.12)', border: '1px solid rgba(255,144,57,0.32)', cursor: 'pointer', transition: 'all 0.15s',
              '&:hover': { bgcolor: 'rgba(255,144,57,0.22)' } }}>
            <Typography sx={{ fontSize: '0.85rem', lineHeight: 1 }}>✨</Typography>
          </Box>
        )}
      </Box>
      {/* Urgency badge */}
      {(() => {
        const daysLeft = Math.ceil((item.dt.getTime() - Date.now()) / 86400000)
        if (daysLeft > 3) return null
        const color = daysLeft <= 0 ? '#FF4545' : daysLeft <= 1 ? '#FF9039' : '#FFD700'
        const label = daysLeft <= 0 ? `${Math.abs(daysLeft)}d atrasado` : daysLeft === 1 ? 'amanhã' : `${daysLeft}d`
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mt: 0.3 }}>
            <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: color, animation: daysLeft <= 0 ? 'pulse 1.5s infinite' : 'none',
              '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
            <Typography sx={{ fontSize: '0.5rem', color, fontWeight: 800 }}>{label}</Typography>
          </Box>
        )
      })()}
    </Paper>
  )
}

function GalleryCard({ session, states }: { session: EditorSession; states: Record<number, ItemState> }) {
  const typeColor = TYPE_COLOR[session.type] ?? '#60A5FA'
  const itemState = states[session.itemId]
  const link = session.link || itemState?.link || ''
  const isPublished = (itemState?.status ?? 0) === 7
  return (
    <Box sx={{
      p: 1.2, borderRadius: 2,
      bgcolor: 'rgba(255,255,255,0.025)',
      border: `1px solid ${isPublished ? 'rgba(0,196,122,0.18)' : 'rgba(255,255,255,0.06)'}`,
      display: 'flex', flexDirection: 'column', gap: 0.4,
      transition: 'all 0.15s',
      '&:hover': { bgcolor: 'rgba(255,255,255,0.045)', borderColor: isPublished ? 'rgba(0,196,122,0.32)' : 'rgba(255,255,255,0.12)' },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: typeColor, flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.58rem', color: typeColor, fontWeight: 700 }}>{session.type}</Typography>
        {isPublished && <Typography sx={{ fontSize: '0.5rem', color: '#00C47A', fontWeight: 700 }}>✓</Typography>}
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.22)' }}>
          {new Date(session.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.63rem', color: '#ff9039', fontWeight: 700 }} noWrap>{session.client}</Typography>
      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }} noWrap>
        {session.title || '(sem título)'}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.1 }}>
        {session.duration > 0 && (
          <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.25)', flex: 1 }}>
            ⏱ {formatDuration(session.duration)}
          </Typography>
        )}
        {link && (
          <Tooltip title="Abrir entrega no Drive">
            <IconButton size="small" onClick={() => window.open(link, '_blank', 'noopener')}
              sx={{ p: 0.2, color: 'rgba(255,255,255,0.22)', '&:hover': { color: '#ff9039' } }}>
              <OpenInNewIcon sx={{ fontSize: 11 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}

function EmptyQueue() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '55vh', gap: 2 }}>
      <Typography sx={{ fontSize: '5rem', lineHeight: 1, filter: 'drop-shadow(0 0 20px rgba(0,196,122,0.4))' }}>🎬</Typography>
      <Typography sx={{ fontWeight: 900, fontSize: '1.4rem', color: 'rgba(255,255,255,0.55)' }}>Fila zerada!</Typography>
      <Typography sx={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.28)', textAlign: 'center', maxWidth: 280 }}>
        Todos os conteúdos foram entregues para aprovação. Missão cumprida 🚀
      </Typography>
    </Box>
  )
}
