import { useState, useRef, lazy, Suspense, useMemo, useCallback, useEffect } from 'react'
import confetti from 'canvas-confetti'
import {
  Card, CardContent, CardActions, Collapse, Box, Typography,
  IconButton, TextField, Divider, Tooltip, Snackbar, Alert,
  LinearProgress, Button, Drawer, useMediaQuery, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import LinkIcon from '@mui/icons-material/Link'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CloseIcon from '@mui/icons-material/Close'
import FileCopyIcon from '@mui/icons-material/FileCopy'
import TagIcon from '@mui/icons-material/Tag'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import BarChartIcon from '@mui/icons-material/BarChart'
import ShareIcon from '@mui/icons-material/Share'
import CancelIcon from '@mui/icons-material/Cancel'
import VideoFileIcon from '@mui/icons-material/VideoFile'
import DescriptionIcon from '@mui/icons-material/Description'
import ImageIcon from '@mui/icons-material/Image'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import CropPortraitIcon from '@mui/icons-material/CropPortrait'
import VideocamIcon from '@mui/icons-material/Videocam'
import type { Comment, ContentItem, ItemEditPatch, ItemState, Status } from '../types'
import { STATUS_CONFIG } from '../types'
import { NAME_MAP, getDisplayName } from '../lib/users'
import { addAssignment } from '../lib/assignments'

function extractDriveFileId(url: string): string | null {
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (m1) return m1[1]
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (m2) return m2[1]
  return null
}
import StatusChip from './StatusChip'
import PublishChecklist from './PublishChecklist'
import EditItemDialog from './EditItemDialog'
import theme, { DS, typeColor } from '../theme'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import InstagramIcon from '@mui/icons-material/Instagram'
import { ClientContextStore, buildClientPrompt } from '../lib/clientContext'
import { EventBus } from '../lib/events'

const ResolveWithAIModal = lazy(() => import('./ResolveWithAIModal'))

const INSTAGRAM_LIMIT = 2200

function typeConf(tp: string) {
  const color = typeColor(tp)
  const icon = tp === 'Reel'  ? <VideoLibraryIcon sx={{ fontSize: '12px !important' }} />
             : tp === 'Story' ? <CropPortraitIcon sx={{ fontSize: '12px !important' }} />
             : tp === 'Video' ? <VideocamIcon      sx={{ fontSize: '12px !important' }} />
             :                  <ImageIcon         sx={{ fontSize: '12px !important' }} />
  return { bg: `${color}26`, color, icon }
}

// ── Utilitário: contador de dias relativo ──────────────
function daysLabel(dt: Date, now: Date): { text: string; color: string } {
  const d0 = new Date(now); d0.setHours(0,0,0,0)
  const d1 = new Date(dt);  d1.setHours(0,0,0,0)
  const diff = Math.round((d1.getTime() - d0.getTime()) / 86_400_000)
  if (diff < -1) return { text: `${Math.abs(diff)}d atrasado`, color: DS.red }
  if (diff === -1) return { text: 'ontem',    color: DS.red }
  if (diff === 0)  return { text: 'hoje',     color: DS.amber }
  if (diff === 1)  return { text: 'amanhã',   color: DS.amber }
  if (diff <= 3)   return { text: `em ${diff}d`, color: DS.orange }
  return { text: dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), color: DS.t2 }
}

interface Props {
  item: ContentItem
  state: ItemState
  now?: Date
  onStatusChange: (id: number, s: Status) => void
  onUpdate: (id: number, patch: Partial<ItemState>) => void
  onDelete?: (id: number) => void
  onEdit?: (id: number, patch: ItemEditPatch) => void
  onDuplicate?: (id: number) => void
  clientColor?: string
  clientHashtags?: string[]
  onSaveHashtags?: (tags: string[]) => void
  selected?: boolean
  onSelect?: () => void
  captionTemplates?: string[]
  onSaveTemplates?: (clientName: string, templates: string[]) => void
  currentUser?: string
  igStatus?: 'pending' | 'published' | 'failed' | null
  igScheduledAt?: number
  onScheduleIG?: () => void
  staggerIndex?: number
}

export default function ContentCard({ item, state, now = new Date(), onStatusChange, onUpdate, onDelete, onEdit, onDuplicate, clientColor, clientHashtags, onSaveHashtags, selected, onSelect, captionTemplates = [], onSaveTemplates, currentUser = 'Equipe', igStatus, igScheduledAt, onScheduleIG, staggerIndex = 0 }: Props) {
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [open, setOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [captionCopied, setCaptionCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [hashtagInput, setHashtagInput] = useState('')
  const [hashtagsCopied, setHashtagsCopied] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [shareOpen, setShareOpen]     = useState(false)
  const [shareUrl, setShareUrl]       = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiCaptionLoading, setAiCaptionLoading] = useState(false)
  const [aiCaptionOptions, setAiCaptionOptions] = useState<string[]>([])
  const [aiCaptionPanel, setAiCaptionPanel] = useState(false)
  const [aiRoteiroLoading, setAiRoteiroLoading] = useState(false)
  const [aiRoteiroText, setAiRoteiroText] = useState('')
  const [aiRoteiroPanel, setAiRoteiroPanel] = useState(false)

  // ── Draft notes — isolado do poll D1 para não apagar enquanto digita ──────
  const [draftNotes, setDraftNotes] = useState(state?.notes ?? '')
  const notesFocused = useRef(false)
  // Quando estado externo muda (sync), atualiza draft somente se não estiver em foco
  useEffect(() => {
    if (!notesFocused.current) setDraftNotes(state?.notes ?? '')
  }, [state?.notes])

  // ── @mention autocomplete ─────────────────────────────────
  const commentRef = useRef<HTMLInputElement>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const MEMBERS = Object.keys(NAME_MAP)

  const mentionMatches = mentionQuery !== null
    ? MEMBERS.filter(m => m.startsWith(mentionQuery.toLowerCase()) && m !== currentUser.toLowerCase())
    : []

  function handleCommentChange(val: string) {
    setCommentText(val)
    // Detecta @palavra no final do texto
    const atMatch = val.match(/@(\w*)$/)
    setMentionQuery(atMatch ? atMatch[1].toLowerCase() : null)
  }

  function applyMention(username: string) {
    const displayName = getDisplayName(username)
    const newText = commentText.replace(/@\w*$/, `@${displayName} `)
    setCommentText(newText)
    setMentionQuery(null)
    setTimeout(() => commentRef.current?.focus(), 30)
  }

  function addComment() {
    const text = commentText.trim()
    if (!text) return

    // Extrai menções do texto e cria notificações
    const mentioned = [...text.matchAll(/@(\w+)/g)]
      .map(m => m[1].toLowerCase())
      .filter(m => MEMBERS.includes(m) && m !== currentUser.toLowerCase())

    mentioned.forEach(username => {
      addAssignment({
        id: crypto.randomUUID(),
        for: username,
        from: currentUser.toLowerCase(),
        itemId: item.i,
        itemTitle: state.title || item.n,
        clientName: item.c,
        itemType: item.tp,
        timestamp: Date.now(),
      })
    })

    // Se mencionou alguém, define o responsável como o primeiro mencionado
    if (mentioned.length > 0) {
      onUpdate(item.i, { responsible: mentioned[0] })
    }

    const newComment: Comment = {
      id: crypto.randomUUID(),
      text,
      author: currentUser,
      authorType: 'internal',
      createdAt: Date.now(),
      statusAt: state.status,
    }
    onUpdate(item.i, { comments: [...(state.comments ?? []), newComment] })
    setCommentText('')
    setMentionQuery(null)

    // Dispara evento global para o App.tsx atualizar o trigger de notificação
    window.dispatchEvent(new CustomEvent('ds:assignment'))
  }

  // ── Swipe para mudar status (mobile) ──────────────────
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const [swipeDelta, setSwipeDelta] = useState(0)

  const STATUS_SWIPE_CYCLE = [0, 1, 2, 3] as const
  const STATUS_SWIPE_LABEL = ['Pendente', 'Em edição', 'Aprovado', 'Publicado']
  const STATUS_SWIPE_COLOR = ['#909090', '#FFD700', '#3B8EFF', '#00C47A']
  const curIdx = STATUS_SWIPE_CYCLE.indexOf(state.status as 0 | 1 | 2 | 3)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setSwipeDelta(0)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (dy > Math.abs(dx) * 0.8) { setSwipeDelta(0); return }
    setSwipeDelta(dx)
  }

  const handleTouchEnd = () => {
    const dx = swipeDelta
    setSwipeDelta(0)
    if (Math.abs(dx) < 60) return
    if (dx > 0 && curIdx < STATUS_SWIPE_CYCLE.length - 1) {
      const next = STATUS_SWIPE_CYCLE[curIdx + 1]
      if (next === 3) setChecklistOpen(true)
      else onStatusChange(item.i, next)
    } else if (dx < 0 && curIdx > 0) {
      onStatusChange(item.i, STATUS_SWIPE_CYCLE[curIdx - 1])
    }
  }

  const swipeTarget = swipeDelta > 40 && curIdx < STATUS_SWIPE_CYCLE.length - 1
    ? curIdx + 1
    : swipeDelta < -40 && curIdx > 0
      ? curIdx - 1
      : null

  const days      = daysLabel(item.dt, now)
  const tags      = clientHashtags ?? []
  const fileId    = state.link ? extractDriveFileId(state.link) : null
  const statusCfg = STATUS_CONFIG[state.status] ?? STATUS_CONFIG[0]

  const copyHashtags = () => {
    if (!tags.length) return
    navigator.clipboard.writeText(tags.join(' '))
    setHashtagsCopied(true)
  }

  const addHashtag = () => {
    const raw = hashtagInput.trim()
    if (!raw) return
    const tag = raw.startsWith('#') ? raw : `#${raw}`
    if (!tags.includes(tag)) onSaveHashtags?.([...tags, tag])
    setHashtagInput('')
  }

  const removeHashtag = (tag: string) => onSaveHashtags?.(tags.filter(t => t !== tag))

  const openWhatsApp = () => {
    const STATUS_LABEL = ['Pendente','Em edição','Aprovado','Publicado']
    const text = [
      `*${state.title || item.n}*`,
      `${item.tp} · ${item.c}`,
      `📅 ${item.dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'long' })}`,
      `Status: ${STATUS_LABEL[state.status]}`,
      state.link ? `🔗 ${state.link}` : '',
      state.caption ? `\n_${state.caption.slice(0, 200)}${state.caption.length > 200 ? '...' : ''}_` : '',
    ].filter(Boolean).join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  const handleShare = async () => {
    if (!state.link) {
      setLinkInput(state.link ?? '')
      setLinkDialogOpen(true)
      return
    }
    setShareLoading(true)
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', clientName: item.c }),
      }).then(r => r.json())
      if (res.ok) {
        setShareUrl(`${window.location.origin}/c/${res.token}/${item.i}`)
        setShareOpen(true)
      }
    } finally {
      setShareLoading(false)
    }
  }

  const isLate = state.status < 3 && item.dt < new Date()

  // Urgency badge — 3 levels based on days until posting
  const _d0 = new Date(now); _d0.setHours(0,0,0,0)
  const _d1 = new Date(item.dt); _d1.setHours(0,0,0,0)
  const diffDays = Math.round((_d1.getTime() - _d0.getTime()) / 86_400_000)
  const urgency = state.status < 3 ? (
    diffDays <= 1 ? { label: 'URGENTE', color: '#FF4545', bg: 'rgba(255,69,69,0.16)',  border: 'rgba(255,69,69,0.45)',  pulse: true  } :
    diffDays <= 3 ? { label: 'MÉDIO',   color: '#ff9039', bg: 'rgba(255,144,57,0.14)', border: 'rgba(255,144,57,0.38)', pulse: false } :
    diffDays <= 7 ? { label: 'BAIXO',   color: '#FFD700', bg: 'rgba(255,215,0,0.1)',   border: 'rgba(255,215,0,0.32)',  pulse: false } :
    null
  ) : null
  const charCount = state.caption.length
  const charPct = Math.min((charCount / INSTAGRAM_LIMIT) * 100, 100)
  const charColor = charCount > INSTAGRAM_LIMIT ? 'error' : charCount > 1800 ? 'warning' : 'primary'

  const firePublished = useCallback(() => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff9039', '#ff5339', '#FFD700', '#00C47A', '#ffffff'],
      scalar: 0.9,
      gravity: 1.2,
    })
  }, [])

  const handleStatusClick = (next: Status) => {
    if (next === 3) {
      setChecklistOpen(true)
    } else {
      if (next === 7) firePublished()
      onStatusChange(item.i, next)
    }
  }

  const handlePublishConfirm = () => {
    setChecklistOpen(false)
    onStatusChange(item.i, 3)
  }

  const generateCaptions = async () => {
    setAiCaptionLoading(true)
    setAiCaptionPanel(true)
    setAiCaptionOptions([])
    setOpen(true)
    try {
      const brandKit = ClientContextStore.get(item.c)
      const systemPrompt = buildClientPrompt(brandKit, 'legenda')
      const context = [
        `Tipo de conteúdo: ${item.tp}`,
        `Título/tema: ${state.title || item.n}`,
        `Data de publicação: ${item.dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}`,
        state.notes ? `Observações: ${state.notes}` : '',
        state.caption ? `Legenda atual (para melhorar): ${state.caption}` : '',
        `\nGere exatamente 3 opções de legenda para Instagram, cada uma com estilo diferente:`,
        `Opção 1: Storytelling emocional`,
        `Opção 2: Direto e objetivo com CTA forte`,
        `Opção 3: Informativo com prova social`,
        `Regras: máximo 2200 caracteres, use emojis com moderação, inclua espaços entre parágrafos.`,
        brandKit?.hashtags?.length ? `Inclua as hashtags: ${brandKit.hashtags.slice(0, 15).join(' ')}` : '',
        brandKit?.ctas?.length ? `Use um destes CTAs: ${brandKit.ctas.join(' / ')}` : '',
        `Responda APENAS com as 3 legendas separadas por "---" (três hifens), sem títulos ou explicações.`,
      ].filter(Boolean).join('\n')
      const key = localStorage.getItem('sm_anthropic_key') ?? ''
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (key) headers['X-Anthropic-Key'] = key
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers,
        body: JSON.stringify({ system: systemPrompt, messages: [{ role: 'user', content: context }] }),
      })
      const data = await res.json() as { content?: { text: string }[]; error?: { message: string } }
      if (data.error) throw new Error(data.error.message)
      const text = data.content?.[0]?.text ?? ''
      const parts = text.split(/---+/).map((s: string) => s.trim()).filter(Boolean)
      setAiCaptionOptions(parts.length > 0 ? parts.slice(0, 3) : ['Erro ao gerar legendas. Tente novamente.'])
    } catch (e) {
      setAiCaptionOptions([`Erro: ${e instanceof Error ? e.message : 'Tente novamente.'}`])
    } finally {
      setAiCaptionLoading(false)
    }
  }

  const generateRoteiro = async () => {
    setAiRoteiroLoading(true)
    setAiRoteiroPanel(true)
    setAiRoteiroText('')
    try {
      const brandKit = ClientContextStore.get(item.c)
      const systemPrompt = buildClientPrompt(brandKit, 'roteiro')
      const prompt = [
        `Tema: ${state.title || item.n}`,
        `Data: ${item.dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}`,
        state.notes ? `Obs: ${state.notes}` : '',
        ``,
        `Crie um roteiro prático seguindo EXATAMENTE este formato:`,
        ``,
        `🎬 HOOK (0-3s)`,
        `[frase de abertura que prende atenção imediatamente]`,
        ``,
        `📝 DESENVOLVIMENTO (3-27s)`,
        `• [ponto 1]`,
        `• [ponto 2]`,
        `• [ponto 3]`,
        ``,
        `💡 CTA (últimos 3s)`,
        `[chamada para ação clara]`,
        ``,
        `🎵 Dica de produção: [sugestão rápida sobre trilha/corte/ritmo]`,
        ``,
        `Seja direto e criativo. Máximo 180 palavras.`,
      ].filter(Boolean).join('\n')

      const key = localStorage.getItem('sm_anthropic_key') ?? ''
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (key) headers['X-Anthropic-Key'] = key
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers,
        body: JSON.stringify({ system: systemPrompt, messages: [{ role: 'user', content: prompt }] }),
      })
      const json = await res.json() as { content?: { text: string }[]; error?: { message: string } }
      const text = json.content?.[0]?.text ?? ''
      if (text) setAiRoteiroText(text.trim())
    } catch {
      setAiRoteiroText('Erro ao conectar com a IA. Tente novamente.')
    } finally {
      setAiRoteiroLoading(false)
    }
  }

  const copyCaption = () => {
    if (!state.caption) return
    navigator.clipboard.writeText(state.caption)
    setCaptionCopied(true)
  }

  const copyLink = () => {
    if (!state.link) return
    navigator.clipboard.writeText(state.link)
    setLinkCopied(true)
  }

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete?.(item.i)
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  return (
    <>
      <Card
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        sx={{
          mb: 1.2, position: 'relative', overflow: 'hidden',
          borderLeft: '4px solid',
          borderRadius: '14px',
          borderLeftColor: selected ? 'primary.main' : isLate ? 'error.main' : clientColor ?? (item.custom ? 'rgba(59,142,255,0.5)' : statusCfg.color),
          bgcolor: selected
            ? 'rgba(255,144,57,0.05)'
            : clientColor
              ? `${clientColor}0d`
              : `${statusCfg.color}08`,
          transformStyle: 'preserve-3d',
          transition: swipeDelta === 0 ? 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease, border-color 0.2s ease' : undefined,
          animation: isLate && !selected
            ? 'cardPulse 2.2s ease-in-out infinite'
            : `fadeInUp 0.28s cubic-bezier(0.16,1,0.3,1) ${Math.min(staggerIndex * 35, 420)}ms both`,
          '@keyframes cardPulse': {
            '0%, 100%': { borderLeftColor: 'rgba(255,69,69,0.5)', boxShadow: '0 0 0 0 rgba(255,69,69,0)' },
            '50%': { borderLeftColor: '#FF4545', boxShadow: '0 0 12px rgba(255,69,69,0.12)' },
          },
          // reflexo de luz no topo
          '&::after': {
            content: '""', position: 'absolute', inset: 0,
            background: 'linear-gradient(165deg, rgba(255,255,255,0.045) 0%, transparent 50%)',
            borderRadius: 'inherit', pointerEvents: 'none',
            opacity: 0, transition: 'opacity 0.2s ease',
          },
          outline: selected ? '1px solid rgba(255,144,57,0.3)' : undefined,
          transform: swipeDelta !== 0 ? `translateX(${Math.sign(swipeDelta) * Math.min(Math.abs(swipeDelta) * 0.12, 10)}px)` : undefined,
          '&:hover': swipeDelta === 0 ? {
            transform: 'perspective(900px) translateY(-3px) rotateX(1deg)',
            boxShadow: selected
              ? '0 10px 28px rgba(255,144,57,0.22)'
              : isLate
                ? '0 10px 24px rgba(255,69,69,0.2)'
                : clientColor
                  ? `0 10px 28px ${clientColor}30`
                  : state.status === 3
                    ? '0 10px 24px rgba(0,196,122,0.18)'
                    : '0 10px 24px rgba(0,0,0,0.5)',
            borderLeftColor: clientColor ?? undefined,
            '&::after': { opacity: 1 },
          } : undefined,
        }}
      >
        {/* Overlay de swipe — aparece enquanto desliza */}
        {swipeTarget !== null && (
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none',
            display: 'flex', alignItems: 'center',
            justifyContent: swipeDelta > 0 ? 'flex-start' : 'flex-end',
            px: 2,
            bgcolor: `${STATUS_SWIPE_COLOR[swipeTarget]}18`,
            borderRadius: 'inherit',
          }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.6,
              bgcolor: `${STATUS_SWIPE_COLOR[swipeTarget]}22`,
              border: `1px solid ${STATUS_SWIPE_COLOR[swipeTarget]}55`,
              borderRadius: 2, px: 1.2, py: 0.5,
            }}>
              <Typography sx={{ fontSize: '0.65rem', color: STATUS_SWIPE_COLOR[swipeTarget], fontWeight: 700 }}>
                {swipeDelta > 0 ? '→' : '←'} {STATUS_SWIPE_LABEL[swipeTarget]}
              </Typography>
            </Box>
          </Box>
        )}

        <CardContent sx={{ p: '14px 16px 10px', '&:last-child': { pb: '10px' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            {onSelect && (
              <Box
                onClick={e => { e.stopPropagation(); onSelect() }}
                sx={{
                  width: 20, height: 20, borderRadius: 1, border: '2px solid',
                  borderColor: selected ? 'primary.main' : 'rgba(255,255,255,0.2)',
                  bgcolor: selected ? 'primary.main' : 'transparent',
                  cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >
                {selected && <Box sx={{ width: 9, height: 9, bgcolor: '#000', borderRadius: 0.3 }} />}
              </Box>
            )}
            {/* Thumbnail do criativo */}
            {fileId && (
              <Box
                component="img"
                src={`https://drive.google.com/thumbnail?id=${fileId}&sz=w120`}
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none' }}
                sx={{ width: 52, height: 52, borderRadius: '10px', objectFit: 'cover', flexShrink: 0, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              />
            )}

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.3 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: clientColor || 'primary.main', flexShrink: 0, boxShadow: `0 0 6px ${clientColor || '#ff9039'}99` }} />
                <Typography sx={{ fontSize: { md: '0.74rem', xl: '0.8rem' }, color: clientColor || 'primary.main', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1 }} noWrap>
                  {item.c}
                </Typography>
              </Box>
              <Typography fontWeight={800} sx={{ fontSize: { md: '0.96rem', xl: '1.05rem' }, lineHeight: 1.3,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {state.title || item.n}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap', mt: 0.4 }}>
                <Chip icon={typeConf(item.tp).icon} label={item.tp} size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: typeConf(item.tp).bg, color: typeConf(item.tp).color, borderRadius: '6px', '& .MuiChip-icon': { color: 'inherit', ml: '5px' } }} />
                <Typography variant="caption" sx={{ fontSize: '0.78rem', fontWeight: 700, color: days.color }}>· {days.text}</Typography>
                {urgency && (
                  <Chip
                    label={urgency.label}
                    size="small"
                    sx={{
                      height: 18, fontSize: '0.6rem', fontWeight: 800,
                      bgcolor: urgency.bg, color: urgency.color,
                      border: `1px solid ${urgency.border}`,
                      letterSpacing: '0.06em', borderRadius: '5px',
                      ...(urgency.pulse && {
                        '@keyframes urgentPulse': {
                          '0%,100%': { opacity: 1, boxShadow: `0 0 4px ${urgency.color}66` },
                          '50%': { opacity: 0.65, boxShadow: `0 0 10px ${urgency.color}aa` },
                        },
                        animation: 'urgentPulse 1.3s ease-in-out infinite',
                      }),
                    }}
                  />
                )}
                {item.custom && <Typography component="span" sx={{ color: 'info.main', fontSize: '0.65rem' }}>· roteiro</Typography>}
                {state.link && <Typography component="span" sx={{ color: 'success.main', fontSize: '0.65rem' }}>🔗</Typography>}
                {state.caption && <Typography component="span" sx={{ color: 'info.main', fontSize: '0.65rem' }}>✍️</Typography>}
                {tags.length > 0 && <Typography component="span" sx={{ color: 'rgba(255,144,57,0.6)', fontSize: '0.65rem' }}>#</Typography>}
              </Box>
              {/* Motivo da reprovação — visível diretamente no card */}
              {state.status === 6 && (
                <Box sx={{ mt: 0.6, px: 1, py: 0.5, borderRadius: 1, bgcolor: 'rgba(255,59,48,0.10)', border: '1px solid rgba(255,59,48,0.22)', display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                  <CancelIcon sx={{ fontSize: 11, color: '#FF3B30', mt: '1px', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.62rem', color: '#FF8080', lineHeight: 1.4, fontStyle: state.rejectionText ? 'italic' : 'normal' }}>
                    {state.rejectionText
                      ? `"${state.rejectionText.length > 80 ? state.rejectionText.slice(0, 80) + '…' : state.rejectionText}"`
                      : 'Reprovado pelo cliente — abra o card para ver detalhes.'}
                  </Typography>
                </Box>
              )}
            </Box>
            <Tooltip title={state.link ? 'Trocar link do criativo' : 'Colar link do criativo (aparece no portal)'}>
              <IconButton
                size="small"
                onClick={e => { e.stopPropagation(); setLinkInput(state.link ?? ''); setLinkDialogOpen(true) }}
                sx={{
                  flexShrink: 0, p: 0.4,
                  bgcolor: state.link ? 'rgba(0,196,122,0.12)' : 'rgba(255,255,255,0.04)',
                  '&:hover': { bgcolor: state.link ? 'rgba(0,196,122,0.2)' : 'rgba(255,255,255,0.08)' },
                }}
              >
                <LinkIcon sx={{ fontSize: 14, color: state.link ? 'success.main' : 'text.disabled' }} />
              </IconButton>
            </Tooltip>

            {/* Botão enviar link pro cliente — abre dialog com URL de aprovação */}
            <Tooltip title={state.link ? 'Enviar link de aprovação pro cliente' : 'Adicione o criativo antes de compartilhar'}>
              <span>
                <IconButton
                  size="small"
                  disabled={!state.link || shareLoading}
                  onClick={e => { e.stopPropagation(); handleShare() }}
                  sx={{
                    flexShrink: 0, p: 0.4,
                    bgcolor: state.link ? 'rgba(59,142,255,0.12)' : 'rgba(255,255,255,0.04)',
                    '&:hover': { bgcolor: state.link ? 'rgba(59,142,255,0.22)' : undefined },
                  }}
                >
                  {shareLoading
                    ? <CircularProgress size={12} sx={{ color: 'info.main' }} />
                    : <ShareIcon sx={{ fontSize: 14, color: state.link ? 'info.main' : 'text.disabled' }} />
                  }
                </IconButton>
              </span>
            </Tooltip>

            {state?.link && (
              <Tooltip title="Abrir link">
                <IconButton
                  size="small"
                  onClick={e => { e.stopPropagation(); window.open(state.link, '_blank', 'noopener') }}
                  sx={{ color: 'rgba(255,255,255,0.3)', p: 0.3, flexShrink: 0, '&:hover': { color: '#ff9039' } }}
                >
                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            )}
            {/* ── Gerar legenda com IA ── */}
            <Tooltip title={aiCaptionLoading ? 'Gerando legendas…' : aiCaptionPanel ? 'Ocultar legendas IA' : 'Gerar legenda com IA'}>
              <IconButton
                size="small"
                onClick={e => {
                  e.stopPropagation()
                  if (aiCaptionPanel) { setAiCaptionPanel(false) } else { generateCaptions() }
                }}
                sx={{
                  flexShrink: 0, p: 0.4,
                  bgcolor: aiCaptionPanel
                    ? 'linear-gradient(135deg, rgba(255,144,57,0.25), rgba(180,90,255,0.2))'
                    : aiCaptionLoading
                    ? 'rgba(180,90,255,0.15)'
                    : 'rgba(180,90,255,0.08)',
                  border: `1px solid ${aiCaptionPanel ? 'rgba(255,144,57,0.4)' : 'rgba(180,90,255,0.25)'}`,
                  borderRadius: '8px',
                  '&:hover': { bgcolor: 'rgba(180,90,255,0.18)', borderColor: 'rgba(180,90,255,0.45)' },
                  transition: 'all 0.15s',
                }}
              >
                {aiCaptionLoading
                  ? <CircularProgress size={12} sx={{ color: '#b45aff' }} />
                  : <AutoAwesomeIcon sx={{ fontSize: 13, color: aiCaptionPanel ? '#ff9039' : '#b45aff' }} />
                }
              </IconButton>
            </Tooltip>

            {/* ── Botão Instagram ── */}
            {(onScheduleIG || igStatus) && (state.status === 2 || state.status === 3 || state.status === 5 || !!igStatus) && (() => {
              const igColor = igStatus === 'published' ? '#00C47A' : igStatus === 'pending' ? '#ff9039' : igStatus === 'failed' ? '#FF4545' : '#E1306C'
              const igBg    = igStatus === 'published' ? 'rgba(0,196,122,0.12)' : igStatus === 'pending' ? 'rgba(255,144,57,0.1)' : igStatus === 'failed' ? 'rgba(255,69,69,0.1)' : 'rgba(225,48,108,0.1)'
              const igBorder = igStatus === 'published' ? 'rgba(0,196,122,0.3)' : igStatus === 'pending' ? 'rgba(255,144,57,0.3)' : igStatus === 'failed' ? 'rgba(255,69,69,0.3)' : 'rgba(225,48,108,0.3)'
              const igTitle  = igStatus === 'published' ? 'Publicado no Instagram ✅' : igStatus === 'pending' ? `Agendado no IG ⏳ ${igScheduledAt ? new Date(igScheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}` : igStatus === 'failed' ? 'Falhou no Instagram — clique para rever' : 'Agendar no Instagram'
              return (
                <Tooltip title={igTitle}>
                  <IconButton
                    size="small"
                    onClick={e => { e.stopPropagation(); onScheduleIG?.() }}
                    sx={{
                      flexShrink: 0, p: 0.4, position: 'relative',
                      bgcolor: igBg, border: `1px solid ${igBorder}`, borderRadius: '8px',
                      ...(igStatus === 'pending' ? {
                        '@keyframes igPulse': { '0%,100%': { boxShadow: `0 0 0 0 ${igBg}` }, '50%': { boxShadow: `0 0 0 4px rgba(255,144,57,0.15)` } },
                        animation: 'igPulse 2s ease-in-out infinite',
                      } : {}),
                      '&:hover': { filter: 'brightness(1.25)', transform: 'scale(1.1)' },
                      transition: 'all 0.15s',
                    }}
                  >
                    <InstagramIcon sx={{ fontSize: 14, color: igColor }} />
                    {igStatus === 'pending' && (
                      <Box sx={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, borderRadius: '50%', bgcolor: '#ff9039', border: '1px solid rgba(0,0,0,0.4)' }} />
                    )}
                    {igStatus === 'failed' && (
                      <Box sx={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, borderRadius: '50%', bgcolor: '#FF4545', border: '1px solid rgba(0,0,0,0.4)' }} />
                    )}
                    {igStatus === 'published' && (
                      <Box sx={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, borderRadius: '50%', bgcolor: '#00C47A', border: '1px solid rgba(0,0,0,0.4)' }} />
                    )}
                  </IconButton>
                </Tooltip>
              )
            })()}

            <StatusChip status={state.status} onClick={handleStatusClick} />
            <Tooltip title={isDesktop ? 'Abrir painel de edição' : (open ? 'Fechar' : 'Expandir')}>
              <IconButton size="small" onClick={() => isDesktop ? setDrawerOpen(true) : setOpen(v => !v)} sx={{ flexShrink: 0 }}>
                {isDesktop
                  ? <OpenInNewIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  : <ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s', fontSize: 18 }} />
                }
              </IconButton>
            </Tooltip>
          </Box>
        </CardContent>

        <Collapse in={open}>
          <Divider sx={{ mx: 2, opacity: 0.08 }} />
          <CardActions sx={{ flexDirection: 'column', gap: 1.2, px: 2, py: 1.5, alignItems: 'stretch' }}>

            {/* Banner: reprovado pelo cliente (v2: status 6) */}
            {state.status === 6 && (
              <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)' }}>
                <Typography sx={{ fontSize: '0.58rem', color: '#FF3B30', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, mb: state.rejectionText ? 0.4 : 0 }}>
                  Reprovado pelo cliente
                </Typography>
                {state.rejectionText ? (
                  <Typography sx={{ fontSize: '0.72rem', color: '#FF8080', fontStyle: 'italic', lineHeight: 1.45 }}>
                    "{state.rejectionText}"
                  </Typography>
                ) : (
                  <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)' }}>Sem motivo informado.</Typography>
                )}
              </Box>
            )}

            {/* Título */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.4, display: 'block', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Título do conteúdo
              </Typography>
              <TextField
                size="small" fullWidth
                placeholder={`Ex: Post Dia dos Namorados — ${item.c}`}
                value={state.title}
                onChange={e => onUpdate(item.i, { title: e.target.value })}
              />
            </Box>

            {/* Link Drive */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.4, display: 'block', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Link do criativo <Typography component="span" sx={{ fontSize: '0.52rem', color: 'rgba(59,142,255,0.7)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· aparece no portal do cliente</Typography>
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <TextField
                  size="small" fullWidth
                  placeholder="https://drive.google.com/..."
                  value={state.link}
                  onChange={e => onUpdate(item.i, { link: e.target.value })}
                  slotProps={{ input: { startAdornment: <LinkIcon sx={{ mr: 0.5, fontSize: 15, color: 'text.disabled', flexShrink: 0 }} /> } }}
                />
                {state.link && (
                  <>
                    <Tooltip title="Abrir no Drive">
                      <IconButton size="small" component="a" href={state.link} target="_blank" rel="noopener noreferrer" sx={{ bgcolor: 'rgba(0,196,122,0.1)', flexShrink: 0 }}>
                        <OpenInNewIcon sx={{ fontSize: 14, color: 'success.main' }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Copiar link">
                      <IconButton size="small" onClick={copyLink} sx={{ bgcolor: 'rgba(255,255,255,0.04)', flexShrink: 0 }}>
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>
            </Box>

            {/* Material bruto (footage) */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.4, display: 'block', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Material bruto{' '}
                <Typography component="span" sx={{ fontSize: '0.52rem', color: 'rgba(192,132,252,0.7)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                  · arquivo de vídeo / fotos no Drive
                </Typography>
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <TextField
                  size="small" fullWidth
                  placeholder="https://drive.google.com/..."
                  value={state.footageLink ?? ''}
                  onChange={e => onUpdate(item.i, { footageLink: e.target.value })}
                  slotProps={{ input: { startAdornment: <VideoFileIcon sx={{ mr: 0.5, fontSize: 15, color: '#C084FC', flexShrink: 0, opacity: 0.7 }} /> } }}
                />
                {state.footageLink && (
                  <Tooltip title="Abrir material bruto">
                    <IconButton size="small" component="a" href={state.footageLink} target="_blank" rel="noopener noreferrer"
                      sx={{ bgcolor: 'rgba(192,132,252,0.1)', flexShrink: 0 }}>
                      <OpenInNewIcon sx={{ fontSize: 14, color: '#C084FC' }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>

            {/* Link do roteiro (Docs) */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.4, display: 'block', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Roteiro / Script{' '}
                <Typography component="span" sx={{ fontSize: '0.52rem', color: 'rgba(251,113,133,0.7)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                  · link do Google Docs
                </Typography>
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <TextField
                  size="small" fullWidth
                  placeholder="https://docs.google.com/..."
                  value={state.roteiroLink ?? ''}
                  onChange={e => onUpdate(item.i, { roteiroLink: e.target.value })}
                  slotProps={{ input: { startAdornment: <DescriptionIcon sx={{ mr: 0.5, fontSize: 15, color: '#FB7185', flexShrink: 0, opacity: 0.7 }} /> } }}
                />
                {state.roteiroLink && (
                  <Tooltip title="Abrir roteiro">
                    <IconButton size="small" component="a" href={state.roteiroLink} target="_blank" rel="noopener noreferrer"
                      sx={{ bgcolor: 'rgba(251,113,133,0.1)', flexShrink: 0 }}>
                      <OpenInNewIcon sx={{ fontSize: 14, color: '#FB7185' }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>

            {/* Data de entrega do vídeo */}
            {(item.tp === 'Reel' || state.deliveryDate) && (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.4, display: 'block', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  📥 Entrega ao social{' '}
                  <Typography component="span" sx={{ fontSize: '0.52rem', color: 'rgba(192,132,252,0.7)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                    · prazo para o editor entregar o vídeo editado
                  </Typography>
                </Typography>
                <TextField
                  type="date" size="small" fullWidth
                  value={state.deliveryDate ? new Date(state.deliveryDate).toISOString().slice(0, 10) : ''}
                  onChange={e => {
                    const val = e.target.value
                    onUpdate(item.i, { deliveryDate: val ? new Date(val + 'T12:00:00').getTime() : undefined })
                  }}
                  slotProps={{ inputLabel: { shrink: true }, input: { sx: { fontSize: '0.78rem', color: '#C084FC' } } }}
                  sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(192,132,252,0.25)' }, '&:hover fieldset': { borderColor: 'rgba(192,132,252,0.45)' }, '&.Mui-focused fieldset': { borderColor: '#C084FC' } } }}
                />
              </Box>
            )}

            {/* Legenda */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.4 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Legenda / Copy
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: charCount > INSTAGRAM_LIMIT ? 'error.main' : charCount > 1800 ? 'warning.main' : 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
                    {charCount}/{INSTAGRAM_LIMIT}
                  </Typography>
                  {state.caption && (
                    <Tooltip title="Copiar legenda">
                      <IconButton size="small" onClick={copyCaption} sx={{ bgcolor: 'rgba(59,142,255,0.1)', p: 0.4 }}>
                        <ContentCopyIcon sx={{ fontSize: 13, color: 'info.main' }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
              <TextField
                size="small" fullWidth multiline rows={3}
                placeholder="Digite a legenda do post..."
                value={state.caption}
                onChange={e => onUpdate(item.i, { caption: e.target.value })}
                error={charCount > INSTAGRAM_LIMIT}
              />
              {charCount > 0 && (
                <LinearProgress variant="determinate" value={charPct} color={charColor} sx={{ mt: 0.5, height: 2, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />
              )}
            </Box>

            {/* Observações */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.4, display: 'block', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Observações
              </Typography>
              <TextField
                size="small" fullWidth multiline rows={2}
                placeholder="Notas internas, pedidos do cliente..."
                value={draftNotes}
                onChange={e => setDraftNotes(e.target.value)}
                onFocus={() => { notesFocused.current = true }}
                onBlur={() => { notesFocused.current = false; if (draftNotes !== (state?.notes ?? '')) onUpdate?.(item.i, { notes: draftNotes }) }}
              />
            </Box>

            {/* Resolver com IA */}
            <Button
              size="small" fullWidth
              startIcon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
              onClick={() => setAiOpen(true)}
              sx={{
                fontSize: '0.65rem', fontWeight: 700, py: 0.6,
                border: '1px solid rgba(255,144,57,0.3)',
                color: '#ff9039',
                borderRadius: 2,
                background: 'rgba(249,115,22,0.05)',
                '&:hover': { bgcolor: 'rgba(249,115,22,0.1)', borderColor: 'rgba(249,115,22,0.5)' },
              }}
            >
              Resolver com IA
            </Button>

            {/* Ações: editar / excluir */}
            {(onEdit || onDelete) && (
              <Box sx={{ display: 'flex', gap: 1, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.06)', mt: 0.5 }}>
                {onEdit && (
                  <Button size="small" startIcon={<EditIcon sx={{ fontSize: 13 }} />} onClick={() => setEditOpen(true)} sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                    Editar
                  </Button>
                )}
                {onDelete && (
                  <Button
                    size="small"
                    startIcon={<DeleteIcon sx={{ fontSize: 13 }} />}
                    onClick={handleDelete}
                    color={confirmDelete ? 'error' : 'inherit'}
                    sx={{ fontSize: '0.65rem', ml: 'auto' }}
                  >
                    {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
                  </Button>
                )}
              </Box>
            )}
          </CardActions>
        </Collapse>
      </Card>

      <PublishChecklist open={checklistOpen} item={item} state={state} onConfirm={handlePublishConfirm} onCancel={() => setChecklistOpen(false)} />
      <EditItemDialog open={editOpen} item={item} onSave={(id, patch) => onEdit?.(id, patch)} onClose={() => setEditOpen(false)} />
      {aiOpen && (
        <Suspense fallback={null}>
          <ResolveWithAIModal
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            item={item}
            state={state}
            onUpdate={onUpdate}
            onStatusChange={onStatusChange}
          />
        </Suspense>
      )}

      {/* ── Painel lateral de edição (desktop) ── */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: { md: 500, lg: 580, xl: 660 },
              background: 'rgba(13,13,13,0.97)',
              backdropFilter: 'blur(24px)',
              borderLeft: '1px solid rgba(255,144,57,0.15)',
              display: 'flex', flexDirection: 'column',
            },
          },
        }}
      >
        {/* Drawer header */}
        <Box sx={{
          px: 3, py: 2,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(20,20,20,0.98)',
          display: 'flex', alignItems: 'flex-start', gap: 1.5,
        }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.3, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.65rem', color: 'primary.main', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {item.c}
              </Typography>
              <Chip icon={typeConf(item.tp).icon} label={item.tp} size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: typeConf(item.tp).bg, color: typeConf(item.tp).color, '& .MuiChip-icon': { color: 'inherit', ml: '4px', fontSize: '10px !important' } }} />
              {item.custom && <Chip label="roteiro" size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: 'rgba(59,142,255,0.1)', color: 'info.main' }} />}
              {isLate && <Chip label="atrasado" size="small" color="error" variant="outlined" sx={{ height: 16, fontSize: '0.55rem' }} />}
            </Box>
            <Typography fontWeight={800} sx={{ fontSize: '1.05rem', lineHeight: 1.2 }}>
              {state.title || item.n}
            </Typography>
            {/* Datas: publicação + entrega */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mt: 0.4, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ fontSize: '0.7rem' }}>🚀</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                  {item.dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </Typography>
              </Box>
              {state.deliveryDate && (() => {
                const ddMs = new Date(state.deliveryDate).setHours(0,0,0,0)
                const todayMs = new Date().setHours(0,0,0,0)
                const daysLeft = Math.round((ddMs - todayMs) / 86400000)
                const isLateD = daysLeft < 0
                const ddFmt = new Date(state.deliveryDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
                const ddSuffix = isLateD ? ` · ${Math.abs(daysLeft)}d atraso` : daysLeft === 0 ? ' · hoje' : daysLeft === 1 ? ' · amanhã' : ''
                return (
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    px: 1, py: 0.3, borderRadius: '8px',
                    bgcolor: isLateD ? 'rgba(255,59,48,0.10)' : 'rgba(192,132,252,0.10)',
                    border: `1px solid ${isLateD ? 'rgba(255,59,48,0.3)' : 'rgba(192,132,252,0.3)'}`,
                  }}>
                    <Typography sx={{ fontSize: '0.7rem' }}>📥</Typography>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: isLateD ? '#FF4545' : '#C084FC' }}>
                      Entrega {ddFmt}{ddSuffix}
                    </Typography>
                  </Box>
                )
              })()}
            </Box>
          </Box>
          <StatusChip status={state.status} onClick={handleStatusClick} />
          <IconButton size="small" onClick={() => setDrawerOpen(false)}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {/* Drawer body */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Banner: reprovado pelo cliente (v2: status 6) */}
          {state.status === 6 && (
            <Box sx={{ p: 1.8, borderRadius: 2, bgcolor: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.25)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: state.rejectionText ? 0.8 : 0 }}>
                <CancelIcon sx={{ fontSize: 14, color: '#FF3B30' }} />
                <Typography sx={{ fontSize: '0.62rem', color: '#FF3B30', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Reprovado pelo cliente
                </Typography>
              </Box>
              {state.rejectionText ? (
                <Typography sx={{ fontSize: '0.82rem', color: '#FF8080', fontStyle: 'italic', lineHeight: 1.6, borderLeft: '2px solid rgba(255,59,48,0.4)', pl: 1.2 }}>
                  "{state.rejectionText}"
                </Typography>
              ) : (
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>Sem motivo informado pelo cliente.</Typography>
              )}
            </Box>
          )}
          {/* Título */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.6, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Título do conteúdo
            </Typography>
            <TextField fullWidth
              placeholder={`Ex: Post Dia dos Namorados — ${item.c}`}
              value={state.title}
              onChange={e => onUpdate(item.i, { title: e.target.value })}
              sx={{ '& .MuiInputBase-input': { fontSize: '0.95rem' } }}
            />
          </Box>

          {/* Link do criativo */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.6, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Link do criativo <Typography component="span" sx={{ fontSize: '0.55rem', color: 'rgba(59,142,255,0.7)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· aparece no portal do cliente</Typography>
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.8 }}>
              <TextField fullWidth
                placeholder="https://drive.google.com/..."
                value={state.link}
                onChange={e => onUpdate(item.i, { link: e.target.value })}
                slotProps={{ input: { startAdornment: <LinkIcon sx={{ mr: 0.8, fontSize: 16, color: 'text.disabled', flexShrink: 0 }} /> } }}
              />
              {state.link && (
                <>
                  <Tooltip title="Abrir no Drive">
                    <IconButton component="a" href={state.link} target="_blank" rel="noopener noreferrer" sx={{ bgcolor: 'rgba(0,196,122,0.1)', flexShrink: 0 }}>
                      <OpenInNewIcon sx={{ fontSize: 16, color: 'success.main' }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Copiar link">
                    <IconButton onClick={copyLink} sx={{ bgcolor: 'rgba(255,255,255,0.04)', flexShrink: 0 }}>
                      <ContentCopyIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>
          </Box>

          {/* Material bruto (footage) */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.6, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Material bruto{' '}
              <Typography component="span" sx={{ fontSize: '0.55rem', color: 'rgba(192,132,252,0.7)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                · arquivo de vídeo / fotos no Drive
              </Typography>
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.8 }}>
              <TextField fullWidth
                placeholder="https://drive.google.com/..."
                value={state.footageLink ?? ''}
                onChange={e => onUpdate(item.i, { footageLink: e.target.value })}
                slotProps={{ input: { startAdornment: <VideoFileIcon sx={{ mr: 0.8, fontSize: 16, color: '#C084FC', flexShrink: 0, opacity: 0.7 }} /> } }}
              />
              {state.footageLink && (
                <Tooltip title="Abrir material bruto">
                  <IconButton component="a" href={state.footageLink} target="_blank" rel="noopener noreferrer" sx={{ bgcolor: 'rgba(192,132,252,0.1)', flexShrink: 0 }}>
                    <OpenInNewIcon sx={{ fontSize: 16, color: '#C084FC' }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          {/* Link do roteiro */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.6, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Roteiro / Script{' '}
              <Typography component="span" sx={{ fontSize: '0.55rem', color: 'rgba(251,113,133,0.7)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                · link do Google Docs
              </Typography>
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.8 }}>
              <TextField fullWidth
                placeholder="https://docs.google.com/..."
                value={state.roteiroLink ?? ''}
                onChange={e => onUpdate(item.i, { roteiroLink: e.target.value })}
                slotProps={{ input: { startAdornment: <DescriptionIcon sx={{ mr: 0.8, fontSize: 16, color: '#FB7185', flexShrink: 0, opacity: 0.7 }} /> } }}
              />
              {state.roteiroLink && (
                <Tooltip title="Abrir roteiro">
                  <IconButton component="a" href={state.roteiroLink} target="_blank" rel="noopener noreferrer" sx={{ bgcolor: 'rgba(251,113,133,0.1)', flexShrink: 0 }}>
                    <OpenInNewIcon sx={{ fontSize: 16, color: '#FB7185' }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          {/* Data de entrega (Reel ou se já tem data) */}
          {(item.tp === 'Reel' || state.deliveryDate) && (
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.6, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                📥 Entrega ao social{' '}
                <Typography component="span" sx={{ fontSize: '0.55rem', color: 'rgba(192,132,252,0.7)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                  · prazo para o editor entregar o vídeo
                </Typography>
              </Typography>
              <TextField fullWidth type="date"
                value={state.deliveryDate ? new Date(state.deliveryDate).toISOString().slice(0, 10) : ''}
                onChange={e => {
                  const val = e.target.value
                  onUpdate(item.i, { deliveryDate: val ? new Date(val + 'T12:00:00').getTime() : undefined })
                }}
                slotProps={{ inputLabel: { shrink: true }, input: { sx: { fontSize: '0.95rem', color: '#C084FC' } } }}
                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(192,132,252,0.25)' }, '&:hover fieldset': { borderColor: 'rgba(192,132,252,0.45)' }, '&.Mui-focused fieldset': { borderColor: '#C084FC' } } }}
              />
            </Box>
          )}

          {/* Templates de legenda */}
          {(captionTemplates.length > 0 || state.caption) && onSaveTemplates && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.8, gap: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 }}>
                  Modelos de Legenda
                </Typography>
                {state.caption && (
                  <Button
                    size="small"
                    onClick={() => onSaveTemplates(item.c, [...captionTemplates, state.caption])}
                    sx={{ fontSize: '0.58rem', py: 0.2, px: 0.8, color: 'primary.main', minWidth: 0, lineHeight: 1.4 }}
                  >
                    + Salvar atual
                  </Button>
                )}
              </Box>
              {captionTemplates.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                  {captionTemplates.map((t, i) => (
                    <Box key={i} sx={{
                      display: 'flex', alignItems: 'center', gap: 0.8,
                      p: 1, borderRadius: 1.5,
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}>
                      <Typography sx={{ fontSize: '0.68rem', flex: 1, color: 'text.secondary', lineHeight: 1.4, fontStyle: 'italic' }} noWrap>
                        {t.length > 90 ? t.slice(0, 90) + '…' : t}
                      </Typography>
                      <Button size="small" onClick={() => onUpdate(item.i, { caption: t })}
                        sx={{ fontSize: '0.6rem', py: 0.2, px: 1, flexShrink: 0, color: 'primary.main' }}>
                        Usar
                      </Button>
                      <IconButton size="small" onClick={() => onSaveTemplates(item.c, captionTemplates.filter((_, j) => j !== i))}
                        sx={{ p: 0.3, flexShrink: 0, color: 'text.disabled' }}>
                        <CloseIcon sx={{ fontSize: 11 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
              {captionTemplates.length === 0 && (
                <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', fontStyle: 'italic' }}>
                  Escreva uma legenda e clique em "+ Salvar atual" para criar um modelo reutilizável.
                </Typography>
              )}
            </Box>
          )}

          {/* Legenda */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.6 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Legenda / Copy
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Typography variant="caption" sx={{ fontSize: '0.62rem', color: charCount > INSTAGRAM_LIMIT ? 'error.main' : charCount > 1800 ? 'warning.main' : 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
                  {charCount}/{INSTAGRAM_LIMIT}
                </Typography>
                {/* IA Caption Generator */}
                <Tooltip title="Gerar legenda com IA">
                  <Box
                    onClick={generateCaptions}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      px: 1, py: 0.4, borderRadius: 1.5, cursor: 'pointer',
                      background: aiCaptionPanel ? 'rgba(249,115,22,0.14)' : 'rgba(249,115,22,0.07)',
                      border: '1px solid rgba(249,115,22,0.22)',
                      transition: 'all 0.15s ease',
                      '&:hover': { background: 'rgba(249,115,22,0.12)' },
                    }}
                  >
                    {aiCaptionLoading
                      ? <CircularProgress size={10} sx={{ color: '#ff9039' }} />
                      : <AutoAwesomeIcon sx={{ fontSize: 11, color: '#ff9039' }} />
                    }
                    <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: '#F97316' }}>
                      {aiCaptionLoading ? 'Gerando...' : '✦ Gerar com IA'}
                    </Typography>
                  </Box>
                </Tooltip>
                {state.caption && (
                  <Tooltip title="Copiar legenda">
                    <IconButton size="small" onClick={copyCaption} sx={{ bgcolor: 'rgba(59,142,255,0.1)', p: 0.5 }}>
                      <ContentCopyIcon sx={{ fontSize: 14, color: 'info.main' }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>

            {/* IA Caption Panel */}
            <Collapse in={aiCaptionPanel}>
              <Box sx={{
                mb: 1.5, borderRadius: 2, overflow: 'hidden',
                border: '1px solid rgba(255,144,57,0.2)',
                background: 'rgba(255,144,57,0.04)',
              }}>
                {/* Header */}
                <Box sx={{
                  px: 1.5, py: 0.8,
                  borderBottom: '1px solid rgba(255,144,57,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(249,115,22,0.06)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <AutoAwesomeIcon sx={{ fontSize: 13, color: '#ff9039' }} />
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#F97316' }}>
                      Sugestões de legenda — Scale AI
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setAiCaptionPanel(false)} sx={{ p: 0.2 }}>
                    <CloseIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }} />
                  </IconButton>
                </Box>

                {/* Loading state */}
                {aiCaptionLoading && (
                  <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.2 }}>
                    <Box sx={{ display: 'flex', gap: '6px' }}>
                      {[0,1,2].map(i => (
                        <Box key={i} sx={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: '#F97316',
                          animation: 'dotBounce 1.1s ease-in-out infinite',
                          animationDelay: `${i * 0.18}s`,
                          '@keyframes dotBounce': { '0%,80%,100%': { transform: 'scale(0.6)', opacity: 0.4 }, '40%': { transform: 'scale(1)', opacity: 1 } },
                        }} />
                      ))}
                    </Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                      Analisando contexto do cliente…
                    </Typography>
                  </Box>
                )}

                {/* Options */}
                {!aiCaptionLoading && aiCaptionOptions.map((opt, idx) => (
                  <Box key={idx} sx={{
                    p: 1.5,
                    borderBottom: idx < aiCaptionOptions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                    transition: 'background 0.15s ease',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.6 }}>
                      <Typography sx={{ fontSize: '0.56rem', fontWeight: 700, color: 'rgba(255,144,57,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Opção {idx + 1}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Usar esta legenda">
                          <Box
                            onClick={() => { onUpdate(item.i, { caption: opt }); setAiCaptionPanel(false) }}
                            sx={{
                              px: 0.8, py: 0.3, borderRadius: 1, cursor: 'pointer', fontSize: '0.56rem',
                              fontWeight: 700, background: '#F97316',
                              color: '#000', transition: 'all 0.15s ease',
                              '&:hover': { filter: 'brightness(1.15)', transform: 'translateY(-1px)' },
                            }}
                          >
                            ✓ Usar
                          </Box>
                        </Tooltip>
                        <Tooltip title="Copiar">
                          <Box
                            onClick={() => navigator.clipboard.writeText(opt)}
                            sx={{
                              px: 0.8, py: 0.3, borderRadius: 1, cursor: 'pointer', fontSize: '0.56rem',
                              fontWeight: 700, bgcolor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)',
                              transition: 'all 0.15s ease', '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                            }}
                          >
                            ⎘ Copiar
                          </Box>
                        </Tooltip>
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {opt}
                    </Typography>
                  </Box>
                ))}

                {!aiCaptionLoading && aiCaptionOptions.length > 0 && (
                  <Box sx={{ px: 1.5, py: 0.8, display: 'flex', justifyContent: 'flex-end' }}>
                    <Box
                      onClick={generateCaptions}
                      sx={{ cursor: 'pointer', fontSize: '0.6rem', color: 'rgba(255,144,57,0.7)', fontWeight: 600, '&:hover': { color: '#ff9039' }, transition: 'color 0.15s' }}
                    >
                      🔄 Regenerar
                    </Box>
                  </Box>
                )}
              </Box>
            </Collapse>

            <TextField fullWidth multiline rows={8}
              placeholder="Digite a legenda do post..."
              value={state.caption}
              onChange={e => onUpdate(item.i, { caption: e.target.value })}
              error={charCount > INSTAGRAM_LIMIT}
              sx={{ '& .MuiInputBase-input': { fontSize: '0.9rem', lineHeight: 1.65 } }}
            />
            {charCount > 0 && (
              <LinearProgress variant="determinate" value={charPct} color={charColor} sx={{ mt: 0.6, height: 3, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)' }} />
            )}
          </Box>

          {/* Observações */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.6, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Observações
            </Typography>
            <TextField fullWidth multiline rows={4}
              placeholder="Notas internas, pedidos do cliente..."
              value={draftNotes}
              onChange={e => setDraftNotes(e.target.value)}
              onFocus={() => { notesFocused.current = true }}
              onBlur={() => { notesFocused.current = false; if (draftNotes !== (state?.notes ?? '')) onUpdate?.(item.i, { notes: draftNotes }) }}
              sx={{ '& .MuiInputBase-input': { fontSize: '0.9rem' } }}
            />
          </Box>

          {/* ── IA de Roteiro — apenas para Reels ─── */}
          {item.tp === 'Reel' && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.6 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  🎬 Roteiro do Reel
                </Typography>
                <Box
                  onClick={generateRoteiro}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    px: 1, py: 0.4, borderRadius: 1.5, cursor: 'pointer',
                    background: aiRoteiroPanel
                      ? 'rgba(59,142,255,0.15)'
                      : 'rgba(59,142,255,0.07)',
                    border: '1px solid rgba(59,142,255,0.28)',
                    transition: 'all 0.2s ease',
                    '&:hover': { background: 'rgba(59,142,255,0.14)' },
                  }}
                >
                  {aiRoteiroLoading
                    ? <CircularProgress size={10} sx={{ color: '#3B8EFF' }} />
                    : <AutoAwesomeIcon sx={{ fontSize: 11, color: '#3B8EFF' }} />
                  }
                  <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: '#3B8EFF' }}>
                    {aiRoteiroLoading ? 'Gerando...' : aiRoteiroText ? '🔄 Regenerar' : '✦ Gerar Roteiro'}
                  </Typography>
                </Box>
              </Box>
              <Collapse in={aiRoteiroPanel}>
                {aiRoteiroLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2, justifyContent: 'center' }}>
                    {[0,1,2].map(i => (
                      <Box key={i} sx={{
                        width: 7, height: 7, borderRadius: '50%', bgcolor: '#3B8EFF',
                        '@keyframes rotDot': { '0%,80%,100%': { transform: 'scale(0.6)', opacity: 0.4 }, '40%': { transform: 'scale(1)', opacity: 1 } },
                        animation: 'rotDot 1.1s ease-in-out infinite',
                        animationDelay: `${i * 0.18}s`,
                      }} />
                    ))}
                  </Box>
                ) : aiRoteiroText && (
                  <Box sx={{
                    p: 1.5, borderRadius: 2, mt: 0.5,
                    bgcolor: 'rgba(59,142,255,0.04)', border: '1px solid rgba(59,142,255,0.14)',
                    '@keyframes rotIn': { from: { opacity: 0, transform: 'translateY(-6px)' }, to: { opacity: 1, transform: 'none' } },
                    animation: 'rotIn 0.3s cubic-bezier(0.16,1,0.3,1) both',
                  }}>
                    <Typography sx={{ fontSize: '0.78rem', color: 'text.primary', whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>
                      {aiRoteiroText}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1.2, flexWrap: 'wrap' }}>
                      <Button
                        size="small" variant="outlined"
                        startIcon={<ContentCopyIcon sx={{ fontSize: '12px !important' }} />}
                        onClick={() => navigator.clipboard.writeText(aiRoteiroText)}
                        sx={{ fontSize: '0.62rem', py: 0.3, px: 1, color: '#3B8EFF', borderColor: 'rgba(59,142,255,0.3)', '&:hover': { borderColor: '#3B8EFF', bgcolor: 'rgba(59,142,255,0.08)' } }}
                      >
                        Copiar
                      </Button>
                      <Button
                        size="small" variant="outlined"
                        onClick={() => {
                          const appended = state.notes
                            ? `${state.notes}\n\n--- Roteiro IA ---\n${aiRoteiroText}`
                            : `--- Roteiro IA ---\n${aiRoteiroText}`
                          onUpdate(item.i, { notes: appended })
                        }}
                        sx={{ fontSize: '0.62rem', py: 0.3, px: 1, color: '#00C47A', borderColor: 'rgba(0,196,122,0.3)', '&:hover': { borderColor: '#00C47A', bgcolor: 'rgba(0,196,122,0.08)' } }}
                      >
                        ✓ Salvar nas notas
                      </Button>
                    </Box>
                  </Box>
                )}
              </Collapse>
            </Box>
          )}

          {/* Histórico de ações */}
          {state.history && state.history.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.8, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Histórico
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {[...state.history].reverse().map((entry, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.4, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0, opacity: 0.7 }} />
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.primary', flex: 1 }}>{entry.action}</Typography>
                    <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', whiteSpace: 'nowrap' }}>
                      {new Date(entry.ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      {' '}
                      {new Date(entry.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* ── Timeline de eventos (EventBus) ─── */}
          {(() => {
            const events = EventBus.getItemTimeline(item.i)
            if (events.length === 0) return null
            const SEV_COLOR: Record<string, string> = { info: '#3B8EFF', success: '#00C47A', warning: '#FFD700', error: '#FF4545' }
            return (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.8, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Linha do tempo
                </Typography>
                <Box sx={{ position: 'relative', pl: 2, '&::before': { content: '""', position: 'absolute', left: 5, top: 4, bottom: 4, width: 1, bgcolor: 'rgba(255,255,255,0.08)' } }}>
                  {events.map(ev => (
                    <Box key={ev.id} sx={{ display: 'flex', gap: 1.2, mb: 1.2, alignItems: 'flex-start' }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: SEV_COLOR[ev.severity] ?? '#909090', flexShrink: 0, mt: 0.3, border: `2px solid rgba(0,0,0,0.4)`, boxShadow: `0 0 5px ${SEV_COLOR[ev.severity] ?? '#909090'}66`, ml: -1.8 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', lineHeight: 1.3 }}>{ev.title}</Typography>
                        {ev.description && (
                          <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', fontStyle: 'italic', lineHeight: 1.3 }}>{ev.description}</Typography>
                        )}
                        <Typography sx={{ fontSize: '0.56rem', color: 'text.disabled', mt: 0.2 }}>
                          {new Date(ev.ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às {new Date(ev.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {ev.userId ? ` · ${ev.userId}` : ''}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            )
          })()}

          {/* ── Comentários da equipe ──────────────────── */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.8, display: 'block', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Comentários
            </Typography>

            {/* Reprovação do cliente como comentário destacado */}
            {state.rejectionText && (
              <Box sx={{ mb: 1, p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.22)', display: 'flex', gap: 1 }}>
                <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'rgba(255,59,48,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '0.75rem' }}>👤</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.3 }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#FF3B30' }}>Cliente</Typography>
                    <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>· reprovação</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.78rem', color: '#FF8080', fontStyle: 'italic', lineHeight: 1.5 }}>"{state.rejectionText}"</Typography>
                </Box>
              </Box>
            )}

            {/* Lista de comentários internos */}
            {(state.comments ?? []).length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mb: 1.2 }}>
                {(state.comments ?? []).map(c => (
                  <Box key={c.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'rgba(255,144,57,0.12)', border: '1px solid rgba(255,144,57,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#ff9039' }}>{c.author.charAt(0).toUpperCase()}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, p: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.3 }}>
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>{c.author}</Typography>
                        <Typography sx={{ fontSize: '0.56rem', color: 'text.disabled' }}>
                          {new Date(c.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          {' '}
                          {new Date(c.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.text}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {(state.comments ?? []).length === 0 && !state.rejectionText && (
              <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', fontStyle: 'italic', mb: 1 }}>
                Nenhum comentário ainda.
              </Typography>
            )}

            {/* Input de novo comentário com @mention */}
            <Box sx={{ position: 'relative' }}>
              {/* Dropdown de @mention */}
              {mentionQuery !== null && mentionMatches.length > 0 && (
                <Box sx={{
                  position: 'absolute', bottom: '100%', left: 0, right: 0, mb: 0.5, zIndex: 100,
                  background: 'rgba(14,14,14,0.98)', backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,144,57,0.25)', borderRadius: 2,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                  overflow: 'hidden',
                }}>
                  <Box sx={{ px: 1.5, py: 0.7, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: 'rgba(255,144,57,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Mencionar e atribuir
                    </Typography>
                  </Box>
                  {mentionMatches.map(username => {
                    const info = NAME_MAP[username]
                    return (
                      <Box
                        key={username}
                        onMouseDown={e => { e.preventDefault(); applyMention(username) }}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.2,
                          px: 1.5, py: 0.9, cursor: 'pointer',
                          transition: 'background 0.15s',
                          '&:hover': { bgcolor: `${info.color}12` },
                        }}
                      >
                        <Box sx={{
                          width: 28, height: 28, borderRadius: '8px', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          bgcolor: `${info.color}18`, border: `1px solid ${info.color}35`,
                        }}>
                          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1 }}>{info.emoji}</Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: info.color, lineHeight: 1.2 }}>
                            {getDisplayName(username)}
                          </Typography>
                          <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1 }}>
                            {info.role}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.18)' }}>↵</Typography>
                      </Box>
                    )
                  })}
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                <TextField
                  inputRef={commentRef}
                  fullWidth multiline maxRows={3}
                  placeholder={`Comentar como ${currentUser}... (use @ para mencionar)`}
                  value={commentText}
                  onChange={e => handleCommentChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setMentionQuery(null); return }
                    if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
                      e.preventDefault(); addComment()
                    }
                  }}
                  size="small"
                  sx={{ '& .MuiInputBase-input': { fontSize: '0.85rem' } }}
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={addComment}
                  disabled={!commentText.trim()}
                  sx={{ fontWeight: 700, fontSize: '0.68rem', flexShrink: 0, px: 1.5, py: 0.9, borderRadius: 2 }}
                >
                  Enviar
                </Button>
              </Box>
            </Box>
          </Box>

          {/* Banco de Hashtags */}
          {onSaveHashtags && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.6 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TagIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Hashtags do cliente
                  </Typography>
                </Box>
                {tags.length > 0 && (
                  <Tooltip title="Copiar todas as hashtags">
                    <IconButton size="small" onClick={copyHashtags} sx={{ bgcolor: 'rgba(255,144,57,0.1)', p: 0.5 }}>
                      <ContentCopyIcon sx={{ fontSize: 13, color: 'primary.main' }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              {tags.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                  {tags.map(tag => (
                    <Chip key={tag} label={tag} size="small" onDelete={() => removeHashtag(tag)}
                      sx={{ fontSize: '0.62rem', height: 22, bgcolor: 'rgba(255,144,57,0.1)', color: 'primary.main', '& .MuiChip-deleteIcon': { fontSize: 12 } }}
                    />
                  ))}
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 0.8 }}>
                <TextField size="small" fullWidth
                  placeholder="ex: marketing ou #marketing"
                  value={hashtagInput}
                  onChange={e => setHashtagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addHashtag()}
                  sx={{ '& .MuiInputBase-input': { fontSize: '0.82rem' } }}
                />
                <Button size="small" variant="outlined" onClick={addHashtag} disabled={!hashtagInput.trim()}
                  sx={{ flexShrink: 0, fontSize: '0.65rem', borderColor: 'rgba(255,144,57,0.3)', color: 'primary.main' }}>
                  Add
                </Button>
              </Box>
            </Box>
          )}
          {/* Engajamento pós-publicação */}
          {state.status === 3 && (
            <Box sx={{ p: 1.5, border: '1px solid rgba(0,196,122,0.2)', borderRadius: 2, bgcolor: 'rgba(0,196,122,0.04)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 1 }}>
                <BarChartIcon sx={{ fontSize: 14, color: 'success.main' }} />
                <Typography variant="caption" color="success.main" fontWeight={700} sx={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Engajamento
                </Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                {([
                  { key: 'likes',    label: '❤️ Curtidas'  },
                  { key: 'comments', label: '💬 Comentários' },
                  { key: 'reach',    label: '👁 Alcance'    },
                ] as { key: keyof NonNullable<typeof state.engagement>; label: string }[]).map(({ key, label }) => (
                  <Box key={key}>
                    <Typography sx={{ fontSize: '0.55rem', color: 'text.disabled', mb: 0.3 }}>{label}</Typography>
                    <TextField
                      size="small" type="number" fullWidth
                      value={state.engagement?.[key] ?? ''}
                      onChange={e => {
                        const val = e.target.value === '' ? undefined : Number(e.target.value)
                        onUpdate(item.i, { engagement: { ...state.engagement, [key]: val } })
                      }}
                      sx={{ '& .MuiInputBase-input': { fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' } }}
                    />
                  </Box>
                ))}
              </Box>
              {(state.engagement?.likes || state.engagement?.comments || state.engagement?.reach) && (
                <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', mt: 0.8 }}>
                  Taxa de engajamento:{' '}
                  {state.engagement?.reach && state.engagement?.likes
                    ? `${(((state.engagement.likes + (state.engagement.comments ?? 0)) / state.engagement.reach) * 100).toFixed(1)}%`
                    : 'aguardando alcance'}
                </Typography>
              )}
            </Box>
          )}
        </Box>

        {/* Drawer footer */}
        <Box sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            size="small"
            startIcon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
            onClick={() => setAiOpen(true)}
            sx={{
              fontSize: '0.68rem', fontWeight: 700, px: 1.5, py: 0.5,
              border: '1px solid rgba(255,144,57,0.4)',
              color: '#ff9039',
              borderRadius: 2,
              background: 'rgba(249,115,22,0.06)',
              '&:hover': { bgcolor: 'rgba(255,144,57,0.15)', borderColor: 'rgba(255,144,57,0.6)' },
            }}
          >
            Resolver com IA
          </Button>
          {onEdit && (
            <Button size="small" startIcon={<EditIcon />} onClick={() => setEditOpen(true)} sx={{ color: 'text.secondary' }}>
              Editar
            </Button>
          )}
          {onDuplicate && (
            <Button size="small" startIcon={<FileCopyIcon />} onClick={() => { onDuplicate(item.i); setDrawerOpen(false) }} sx={{ color: 'text.secondary' }}>
              Duplicar
            </Button>
          )}
          <Tooltip title="Compartilhar no WhatsApp">
            <Button size="small" startIcon={<WhatsAppIcon sx={{ fontSize: 15 }} />} onClick={openWhatsApp}
              sx={{ color: '#25D366', '&:hover': { bgcolor: 'rgba(37,211,102,0.08)' } }}>
              WhatsApp
            </Button>
          </Tooltip>
          <Tooltip title={state.link ? 'Gerar link de aprovação do criativo para o cliente' : 'Adicione um link do criativo primeiro'}>
            <span>
              <Button
                size="small"
                startIcon={shareLoading ? <CircularProgress size={12} color="inherit" /> : <ShareIcon sx={{ fontSize: 15 }} />}
                onClick={handleShare}
                disabled={shareLoading}
                sx={{ color: 'info.main', '&:hover': { bgcolor: 'rgba(59,142,255,0.08)' } }}
              >
                {state.link ? 'Compartilhar' : 'Sem criativo'}
              </Button>
            </span>
          </Tooltip>
          {onDelete && (
            <Button size="small" startIcon={<DeleteIcon />} onClick={handleDelete}
              color={confirmDelete ? 'error' : 'inherit'} sx={{ ml: 'auto' }}
            >
              {confirmDelete ? 'Confirmar' : 'Excluir'}
            </Button>
          )}
        </Box>
      </Drawer>

      {/* ── Dialog rápido: link do criativo ──────────── */}
      <Dialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        maxWidth="sm" fullWidth
        onClick={e => e.stopPropagation()}
        PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(0,196,122,0.25)', borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinkIcon sx={{ color: 'success.main', fontSize: 18 }} />
            <Box>
              <Typography fontWeight={700} sx={{ fontSize: '0.9rem' }}>Link do criativo</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                {state.title || item.n} · {item.c}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontSize: '0.68rem', lineHeight: 1.5 }}>
            Cole o link do <strong>Google Drive</strong> (arquivo individual) ou do <strong>Streamable</strong> (<code style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 4px' }}>streamable.com/xxxxx</code>). O portal toca o vídeo direto, sem baixar. ⚡ Streamable recomendado para vídeos grandes.
          </Typography>
          <TextField
            autoFocus fullWidth size="small"
            placeholder="https://drive.google.com/file/d/... ou https://streamable.com/..."
            value={linkInput}
            onChange={e => setLinkInput(e.target.value)}
            onPaste={e => {
              const pasted = e.clipboardData.getData('text')
              if (pasted.includes('drive.google.com') || pasted.startsWith('http')) {
                e.preventDefault()
                setLinkInput(pasted.trim())
              }
            }}
            slotProps={{ input: { startAdornment: <LinkIcon sx={{ mr: 0.8, fontSize: 15, color: 'success.main', flexShrink: 0 }} /> } }}
          />
          {linkInput && (
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Typography sx={{ fontSize: '0.62rem', color: 'success.main' }}>✓ Link detectado</Typography>
              <Button size="small" component="a" href={linkInput} target="_blank" rel="noopener"
                startIcon={<OpenInNewIcon sx={{ fontSize: 11 }} />}
                sx={{ fontSize: '0.58rem', py: 0.2, px: 0.8, minHeight: 0, color: 'success.main', ml: 'auto' }}>
                Testar
              </Button>
            </Box>
          )}
          {state.link && !linkInput && (
            <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', mt: 0.8 }}>
              Link atual: <span style={{ color: '#00C47A' }}>{state.link.slice(0, 60)}...</span>
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          {state.link && (
            <Button size="small" color="error" onClick={() => { onUpdate(item.i, { link: '' }); setLinkDialogOpen(false) }}
              sx={{ fontSize: '0.62rem', mr: 'auto' }}>
              Remover link
            </Button>
          )}
          <Button onClick={() => setLinkDialogOpen(false)} size="small" color="inherit">Cancelar</Button>
          <Button
            onClick={() => { onUpdate(item.i, { link: linkInput.trim() }); setLinkDialogOpen(false) }}
            size="small" variant="contained" color="success"
            disabled={!linkInput.trim()}
            startIcon={<LinkIcon sx={{ fontSize: 14 }} />}
            sx={{ fontWeight: 700, minWidth: 100 }}
          >
            Salvar link
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={captionCopied} autoHideDuration={2000} onClose={() => setCaptionCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" variant="filled" sx={{ fontSize: '0.75rem' }}>Legenda copiada — cole no Instagram</Alert>
      </Snackbar>
      <Snackbar open={linkCopied} autoHideDuration={2000} onClose={() => setLinkCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" sx={{ fontSize: '0.75rem' }}>Link copiado!</Alert>
      </Snackbar>
      <Snackbar open={hashtagsCopied} autoHideDuration={2000} onClose={() => setHashtagsCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" sx={{ fontSize: '0.75rem' }}>Hashtags copiadas!</Alert>
      </Snackbar>
      <Snackbar open={shareCopied} autoHideDuration={2500} onClose={() => setShareCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" variant="filled" sx={{ fontSize: '0.75rem' }}>Link de aprovação copiado! Envie para o cliente.</Alert>
      </Snackbar>

      {/* ── Dialog: compartilhar link de aprovação ── */}
      <Dialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        maxWidth="sm" fullWidth
        onClick={e => e.stopPropagation()}
        PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(59,142,255,0.25)', borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShareIcon sx={{ color: 'info.main', fontSize: 18 }} />
            <Box>
              <Typography fontWeight={700} sx={{ fontSize: '0.9rem' }}>Link de aprovação do criativo</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                {state.title || item.n} · {item.c}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.2, fontSize: '0.68rem', lineHeight: 1.6 }}>
            Envie este link para o cliente. Ele abrirá o criativo em alta resolução com botões para <strong>aprovar</strong> ou <strong>solicitar alteração</strong>. O status do card será atualizado automaticamente.
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
            <TextField
              fullWidth size="small" value={shareUrl}
              slotProps={{ input: { readOnly: true, sx: { fontSize: '0.72rem', fontFamily: 'monospace', color: 'info.main' } } }}
              onClick={e => (e.target as HTMLInputElement).select()}
            />
            <Tooltip title={shareCopied ? 'Copiado!' : 'Copiar link'}>
              <IconButton
                onClick={() => { navigator.clipboard.writeText(shareUrl); setShareCopied(true) }}
                sx={{ bgcolor: 'rgba(59,142,255,0.1)', flexShrink: 0, '&:hover': { bgcolor: 'rgba(59,142,255,0.2)' } }}
              >
                <ContentCopyIcon sx={{ fontSize: 16, color: 'info.main' }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Button
            size="small" component="a" href={shareUrl} target="_blank" rel="noopener"
            startIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
            sx={{ mt: 1, fontSize: '0.6rem', color: 'text.secondary', py: 0.2, px: 0.8, minHeight: 0 }}
          >
            Testar link
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShareOpen(false)} size="small" color="inherit">Fechar</Button>
          <Button
            variant="contained" size="small"
            startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
            onClick={() => { navigator.clipboard.writeText(shareUrl); setShareCopied(true); setShareOpen(false) }}
            sx={{ fontWeight: 700 }}
          >
            Copiar e fechar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
