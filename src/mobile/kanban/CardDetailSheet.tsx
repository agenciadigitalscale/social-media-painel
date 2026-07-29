import { useState, useEffect, useRef } from 'react'
import { Box, Typography, TextField, InputBase } from '@mui/material'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded'
import BoltRoundedIcon from '@mui/icons-material/BoltRounded'
import MicRoundedIcon from '@mui/icons-material/MicRounded'
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import type { ContentItem, ItemState, Status, Comment } from '../../types'
import { STATUS_CONFIG, STATUS_ORDER, statusRank } from '../../types'
import { DS, typeColor } from '../../theme'
import { shouldShowDelivery } from '../../lib/cardDate'
import { useMediaLinks } from '../../lib/useMediaLinks'
import { getCardPreview } from '../../lib/mediaLinks'
import { NAME_MAP, getDisplayName } from '../../lib/users'
import BottomSheet from '../system/BottomSheet'
import { haptic } from '../system/haptics'
import { deadlineInfo } from './MobileCard'
import { getCardExpressAction } from './cardExpress'

type TabKey = 'resumo' | 'criativo' | 'revisao' | 'historico'
type ConfirmAction = 'review' | 'approve' | 'adjust'

type UndoState = { from: Status; to: Status; label: string }
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function speechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const browserWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition || null
}
const TABS: { key: TabKey; label: string }[] = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'criativo', label: 'Criativo' },
  { key: 'revisao', label: 'Revisão' },
  { key: 'historico', label: 'Histórico' },
]

interface Props {
  item: ContentItem | null; state: ItemState | null; now: Date; currentUser: string
  clientColor?: string; vip?: boolean; onToggleVip?: () => void; onClose: () => void
  onStatusChange: (id: number, status: Status) => void
  onUpdate: (id: number, patch: Partial<ItemState>) => void
  onRequestMove?: (item: ContentItem) => void
  onRequestSend?: (item: ContentItem) => void
}

const fieldSx = {
  '& .MuiInputBase-root': {
    fontSize: '0.8rem', color: DS.t1, borderRadius: 2.4,
    background: 'rgba(244,247,255,0.04)', border: '1px solid rgba(148,163,184,0.14)',
  },
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
} as const

const sectionLabel = (sx: object = {}) => ({
  fontSize: '0.57rem', fontWeight: 850, textTransform: 'uppercase',
  letterSpacing: '0.08em', color: DS.t3, mb: 0.65, ...sx,
} as const)

const toLocalDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function ActionButton({ label, tone, disabled, onClick }: { label: string; tone: string; disabled?: boolean; onClick: () => void }) {
  return (
    <Box onClick={() => !disabled && onClick()} sx={{
      minHeight: 46, px: 1.2, borderRadius: 2.4, display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.42 : 1,
      background: disabled ? 'rgba(244,247,255,0.04)' : `${tone}16`,
      border: `1px solid ${disabled ? 'rgba(148,163,184,0.12)' : `${tone}50`}`,
      '&:active': disabled ? undefined : { transform: 'scale(0.975)' },
    }}>
      <Typography sx={{ fontSize: '0.64rem', fontWeight: 820, color: disabled ? DS.t3 : tone, textAlign: 'center', lineHeight: 1.2 }}>{label}</Typography>
    </Box>
  )
}

export default function CardDetailSheet(props: Props) {
  return <CardDetailSheetContent key={props.item?.i ?? 'empty'} {...props} />
}

function CardDetailSheetContent({
  item, state, now, currentUser, clientColor, vip, onToggleVip, onClose,
  onStatusChange, onUpdate, onRequestMove, onRequestSend,
}: Props) {
  const [tab, setTab] = useState<TabKey>('resumo')
  const [title, setTitle] = useState(() => state?.title || item?.n || '')
  const [notes, setNotes] = useState(() => state?.notes || '')
  const [link, setLink] = useState(() => state?.link || '')
  const [footage, setFootage] = useState(() => state?.footageLink || '')
  const [roteiro, setRoteiro] = useState(() => state?.roteiroLink || '')
  const [delivery, setDelivery] = useState(() => state?.deliveryDate ? toLocalDateInput(new Date(state.deliveryDate)) : '')
  const [newComment, setNewComment] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [undo, setUndo] = useState<UndoState | null>(null)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const mediaLinks = useMediaLinks()

  useEffect(() => {
    if (!undo) return
    const timer = window.setTimeout(() => setUndo(null), 5200)
    return () => window.clearTimeout(timer)
  }, [undo])

  useEffect(() => () => recognitionRef.current?.abort(), [])

  if (!item || !state) return <BottomSheet open={false} onClose={onClose}>{null}</BottomSheet>

  const cfg = STATUS_CONFIG[state.status]
  const stripe = clientColor || cfg.color
  const preview = getCardPreview(item, mediaLinks, state.status)
  const previewReady = preview.kind === 'ready'
  const expressAction = getCardExpressAction(state.status, previewReady)
  const expressTone = { blue: DS.accent, cyan: DS.cyan, green: DS.green, amber: DS.amber, red: DS.red, neutral: DS.t3 }[expressAction.tone]
  const speechSupported = !!speechRecognitionConstructor()
  const driveId = previewReady && preview.fileId.startsWith('drive:') ? preview.fileId.slice(6) : null
  const commit = (patch: Partial<ItemState>) => onUpdate(item.i, patch)
  const openLink = (url: string) => { if (url) window.open(url.startsWith('http') ? url : `https://${url}`, '_blank', 'noopener') }

  const changeWithUndo = (target: Status, label: string) => {
    if (target === state.status) return
    const from = state.status
    onStatusChange(item.i, target)
    setUndo({ from, to: target, label })
    haptic('success')
  }

  const runExpress = () => {
    if (expressAction.kind === 'preview') { setTab('criativo'); haptic('selection'); return }
    if (expressAction.kind === 'send') { onRequestSend?.(item); haptic('selection'); return }
    if (expressAction.kind === 'done') { setTab('historico'); haptic('selection'); return }
    if (expressAction.targetStatus !== undefined) changeWithUndo(expressAction.targetStatus, expressAction.label)
  }

  const undoExpress = () => {
    if (!undo) return
    onStatusChange(item.i, undo.from)
    setUndo(null)
    haptic('warning')
  }

  const toggleDictation = () => {
    if (listening) { recognitionRef.current?.stop(); return }
    const Recognition = speechRecognitionConstructor()
    if (!Recognition) return
    const recognition = new Recognition()
    recognition.lang = 'pt-BR'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = event => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() || ''
      if (!transcript) return
      const nextNotes = [notes.trim(), transcript].filter(Boolean).join(' ')
      setNotes(nextNotes)
      commit({ notes: nextNotes })
      haptic('success')
    }
    recognition.onend = () => { setListening(false); recognitionRef.current = null }
    recognition.onerror = () => { setListening(false); recognitionRef.current = null }
    recognitionRef.current = recognition
    setListening(true)
    haptic('light')
    recognition.start()
  }

  const addComment = () => {
    const text = newComment.trim()
    if (!text) return
    const comment: Comment = { id: String(Date.now()), text, author: currentUser || 'equipe', authorType: 'internal', createdAt: Date.now(), statusAt: state.status }
    commit({ comments: [...(state.comments ?? []), comment] })
    setNewComment('')
    haptic('light')
  }

  const confirm = () => {
    if (!confirmAction) return
    const target: Status = confirmAction === 'review' ? 2 : confirmAction === 'approve' ? 5 : 6
    onStatusChange(item.i, target)
    setConfirmAction(null)
    haptic('success')
  }

  const confirmationCopy = confirmAction === 'review'
    ? 'Enviar este criativo para revisão interna?'
    : confirmAction === 'approve'
      ? 'Marcar como aprovado pelo cliente?'
      : 'Registrar que foi solicitado um ajuste?'

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.55 }}>
            <Box sx={{ px: 0.7, py: 0.18, borderRadius: 1.4, bgcolor: `${typeColor(item.tp)}16`, border: `1px solid ${typeColor(item.tp)}35` }}>
              <Typography sx={{ fontSize: '0.55rem', fontWeight: 850, color: typeColor(item.tp) }}>{item.tp}</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.64rem', fontWeight: 800, color: stripe }} noWrap>{item.c}</Typography>
            {onToggleVip && (
              <Box data-card-action onClick={() => { haptic(vip ? 'light' : 'success'); onToggleVip() }} sx={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', cursor: 'pointer', bgcolor: vip ? 'rgba(245,158,11,0.14)' : 'rgba(244,247,255,0.04)', border: `1px solid ${vip ? 'rgba(245,158,11,0.42)' : 'rgba(148,163,184,0.13)'}` }}>
                <span style={{ fontSize: '0.72rem', filter: vip ? 'none' : 'grayscale(1) opacity(.45)' }}>★</span>
              </Box>
            )}
            <Box sx={{ flex: 1 }} />
            {(() => {
              const showDelivery = shouldShowDelivery(state)
              const dl = deadlineInfo(showDelivery ? new Date(state.deliveryDate!) : item.dt, now)
              return <Typography sx={{ fontSize: '0.57rem', fontWeight: 820, color: dl.color }}>{showDelivery && 'Entrega · '}{dl.label}</Typography>
            })()}
          </Box>
          <Typography sx={{ fontSize: '0.98rem', fontWeight: 850, color: DS.t1, lineHeight: 1.22 }} noWrap>{state.title || item.n}</Typography>
        </Box>
      }
    >
      <Box sx={{ px: 2, pb: 1.1, display: 'flex', alignItems: 'center', gap: 0.7 }}>
        <Box sx={{ minHeight: 36, px: 1, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 0.55, bgcolor: `${cfg.color}14`, border: `1px solid ${cfg.color}42` }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: cfg.color }} />
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 820, color: cfg.color }}>{cfg.label}</Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        {onRequestMove && <Box onClick={() => onRequestMove(item)} sx={{ minHeight: 36, px: 1.1, borderRadius: 2, display: 'flex', alignItems: 'center', cursor: 'pointer', bgcolor: 'rgba(244,247,255,0.04)', border: '1px solid rgba(148,163,184,0.14)' }}><Typography sx={{ fontSize: '0.6rem', fontWeight: 780, color: DS.t2 }}>Mover para…</Typography></Box>}
      </Box>

      <Box sx={{ px: 2, pb: 1.25 }}>
        <Box sx={{ position: 'relative', overflow: 'hidden', p: 1.25, borderRadius: 3.1, background: 'linear-gradient(125deg, rgba(13,28,49,.98), rgba(7,13,24,.98))', border: `1px solid ${expressTone}42`, boxShadow: '0 18px 36px rgba(0,0,0,.24)' }}>
          <Box sx={{ position: 'absolute', top: 0, left: 22, right: 22, height: 1, background: `linear-gradient(90deg, transparent, ${expressTone}, transparent)` }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: .65 }}>
            <BoltRoundedIcon sx={{ fontSize: 16, color: expressTone }} />
            <Typography sx={{ fontSize: '.52rem', fontWeight: 900, letterSpacing: '.105em', textTransform: 'uppercase', color: expressTone }}>Card Express · Próxima ação</Typography>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: '.46rem', fontWeight: 780, color: DS.t4 }}>1 toque</Typography>
          </Box>
          <Typography sx={{ mt: .85, fontSize: '.92rem', fontWeight: 860, letterSpacing: '-.026em', color: DS.t1 }}>{expressAction.label}</Typography>
          <Typography sx={{ mt: .28, fontSize: '.57rem', lineHeight: 1.42, color: DS.t3 }}>{expressAction.helper}</Typography>
          <Box component="button" type="button" onClick={runExpress} aria-label={expressAction.label} sx={{ appearance: 'none', width: '100%', minHeight: 48, mt: 1.05, px: 1.15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: .55, borderRadius: 2.45, color: expressAction.kind === 'done' ? DS.t2 : expressTone, background: expressAction.kind === 'done' ? 'rgba(244,247,255,.045)' : `${expressTone}16`, border: `1px solid ${expressTone}66`, boxShadow: 'none', cursor: 'pointer', '&:active': { transform: 'scale(.985)' } }}>
            <BoltRoundedIcon sx={{ fontSize: 18 }} />
            <Typography component="span" sx={{ fontSize: '.66rem', fontWeight: 870, color: 'inherit' }}>{expressAction.label}</Typography>
          </Box>

          <Box sx={{ mt: 1.05, pt: 1, borderTop: '1px solid rgba(148,163,184,.1)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: .65, mb: .65 }}>
              <Typography sx={{ width: 68, flexShrink: 0, fontSize: '.49rem', fontWeight: 820, color: DS.t4, textTransform: 'uppercase', letterSpacing: '.07em' }}>Prioridade</Typography>
              {(['alta', 'media', 'baixa'] as const).map(priority => {
                const active = state.priority === priority
                const color = priority === 'alta' ? DS.red : priority === 'media' ? DS.amber : DS.t2
                return <Box key={priority} component="button" type="button" onClick={() => { commit({ priority }); haptic('selection') }} aria-label={`Prioridade ${priority}`} sx={{ appearance: 'none', minHeight: 30, px: .8, borderRadius: 1.8, color: active ? color : DS.t3, background: active ? `${color}15` : 'rgba(244,247,255,.025)', border: `1px solid ${active ? `${color}50` : DS.borderSoft}`, fontSize: '.52rem', fontWeight: 800, textTransform: 'capitalize', cursor: 'pointer' }}>{priority}</Box>
              })}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: .55 }}>
              <Typography sx={{ width: 68, flexShrink: 0, fontSize: '.49rem', fontWeight: 820, color: DS.t4, textTransform: 'uppercase', letterSpacing: '.07em' }}>Responsável</Typography>
              <Box sx={{ display: 'flex', gap: .45, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
                {Object.entries(NAME_MAP).map(([key, person]) => {
                  const active = (state.responsible || state.assignedEditor) === key
                  return <Box key={key} component="button" type="button" onClick={() => { commit({ responsible: key }); haptic('selection') }} aria-label={`Responsável ${getDisplayName(key)}`} title={getDisplayName(key)} sx={{ appearance: 'none', width: 30, height: 30, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '.78rem', background: active ? `${person.color}20` : 'rgba(244,247,255,.025)', border: `1px solid ${active ? `${person.color}65` : DS.borderSoft}`, boxShadow: active ? `0 0 12px ${person.glow}` : 'none', cursor: 'pointer' }}>{person.emoji}</Box>
                })}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.2, px: 2, overflowX: 'auto', borderBottom: '1px solid rgba(148,163,184,0.12)', '&::-webkit-scrollbar': { display: 'none' } }}>
        {TABS.map(entry => {
          const active = entry.key === tab
          return <Box key={entry.key} onClick={() => { haptic('selection'); setTab(entry.key) }} sx={{ minHeight: 40, display: 'flex', alignItems: 'center', flexShrink: 0, cursor: 'pointer', borderBottom: `2px solid ${active ? DS.accent : 'transparent'}` }}><Typography sx={{ fontSize: '0.66rem', fontWeight: active ? 840 : 680, color: active ? DS.t1 : DS.t3 }}>{entry.label}</Typography></Box>
        })}
      </Box>

      <Box sx={{ px: 2, pt: 1.5, pb: 3 }}>
        {tab === 'resumo' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.55 }}>
            <Box><Typography sx={sectionLabel()}>Título</Typography><TextField fullWidth size="small" value={title} onChange={event => setTitle(event.target.value)} onBlur={() => commit({ title })} sx={fieldSx} /></Box>
            <Box>
              <Typography sx={sectionLabel()}>Prazo interno</Typography>
              <TextField fullWidth size="small" type="date" value={delivery} onChange={event => {
                const value = event.target.value
                setDelivery(value)
                commit({ deliveryDate: value ? new Date(`${value}T12:00:00`).getTime() : undefined })
              }} sx={{ ...fieldSx, '& input': { colorScheme: 'dark' } }} />
            </Box>
            <Box>
              <Typography sx={sectionLabel()}>Prioridade</Typography>
              <Box sx={{ display: 'flex', gap: 0.65 }}>
                {(['alta', 'media', 'baixa'] as const).map(priority => {
                  const active = state.priority === priority
                  const color = priority === 'alta' ? DS.red : priority === 'media' ? DS.amber : DS.t2
                  return <Box key={priority} onClick={() => commit({ priority })} sx={{ minHeight: 38, px: 1.1, borderRadius: 2, display: 'flex', alignItems: 'center', cursor: 'pointer', bgcolor: active ? `${color}16` : 'rgba(244,247,255,0.035)', border: `1px solid ${active ? `${color}55` : 'rgba(148,163,184,0.12)'}` }}><Typography sx={{ fontSize: '0.64rem', fontWeight: 750, color: active ? color : DS.t2, textTransform: 'capitalize' }}>{priority}</Typography></Box>
                })}
              </Box>
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: .7, mb: .65 }}>
                <Typography sx={sectionLabel({ mb: 0 })}>Briefing e observações</Typography>
                <Box sx={{ flex: 1 }} />
                {speechSupported && (
                  <Box component="button" type="button" onClick={toggleDictation} aria-label={listening ? 'Parar ditado' : 'Ditar observação'} sx={{ appearance: 'none', minHeight: 32, px: .8, borderRadius: 1.8, display: 'flex', alignItems: 'center', gap: .4, color: listening ? DS.red : DS.cyan, background: listening ? 'rgba(239,68,68,.1)' : 'rgba(6,182,212,.08)', border: `1px solid ${listening ? 'rgba(239,68,68,.35)' : 'rgba(6,182,212,.28)'}`, cursor: 'pointer' }}>
                    {listening ? <StopCircleRoundedIcon sx={{ fontSize: 15 }} /> : <MicRoundedIcon sx={{ fontSize: 15 }} />}
                    <Typography component="span" sx={{ fontSize: '.52rem', fontWeight: 820, color: 'inherit' }}>{listening ? 'Ouvindo…' : 'Ditar'}</Typography>
                  </Box>
                )}
              </Box>
              <TextField fullWidth multiline minRows={4} size="small" value={notes} onChange={event => setNotes(event.target.value)} onBlur={() => commit({ notes })} placeholder="Briefing, referências e contexto…" sx={fieldSx} />
            </Box>
            <Box>
              <Typography sx={sectionLabel()}>Progresso</Typography>
              <Box sx={{ height: 5, borderRadius: 4, overflow: 'hidden', bgcolor: 'rgba(244,247,255,0.07)' }}><Box sx={{ width: `${Math.round((statusRank(state.status) / (STATUS_ORDER.length - 1)) * 100)}%`, height: '100%', bgcolor: cfg.color, transition: 'width .25s ease' }} /></Box>
              <Typography sx={{ mt: 0.55, fontSize: '0.56rem', color: DS.t3 }}>{STATUS_CONFIG[state.status].label} · responsável: {state.responsible || state.assignedEditor || 'não definido'}</Typography>
            </Box>
          </Box>
        )}

        {tab === 'criativo' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.45 }}>
            <Box sx={{ aspectRatio: '16 / 9', borderRadius: 3, overflow: 'hidden', display: 'grid', placeItems: 'center', bgcolor: 'rgba(0,0,0,0.28)', border: '1px solid rgba(148,163,184,0.14)' }}>
              {driveId ? (
                <Box component="iframe" src={`https://drive.google.com/file/d/${driveId}/preview`} title="Prévia do criativo" allow="autoplay; fullscreen" sx={{ width: '100%', height: '100%', border: 0 }} />
              ) : previewReady && preview.thumbUrl ? (
                <Box component="img" src={preview.thumbUrl} alt="Prévia do criativo" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <Box sx={{ textAlign: 'center', px: 3 }}>
                  <PlayCircleOutlineRoundedIcon sx={{ fontSize: 42, color: preview.kind === 'pending' ? DS.blueSoft : DS.t3 }} />
                  <Typography sx={{ mt: 0.6, fontSize: '0.74rem', fontWeight: 780, color: DS.t2 }}>{preview.kind === 'pending' ? preview.label : 'Sem prévia reproduzível'}</Typography>
                  <Typography sx={{ mt: 0.3, fontSize: '0.58rem', color: DS.t3 }}>Vincule um arquivo manualmente ou resolva pela Inbox.</Typography>
                </Box>
              )}
            </Box>

            {previewReady && (
              <Box sx={{ minHeight: 42, px: 1.1, borderRadius: 2.3, display: 'flex', alignItems: 'center', gap: 0.7, bgcolor: 'rgba(49,209,124,0.08)', border: '1px solid rgba(49,209,124,0.25)' }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: DS.green, boxShadow: '0 0 8px rgba(49,209,124,.55)' }} />
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 780, color: DS.green }}>Prévia pronta e reproduzível</Typography>
                <Box sx={{ flex: 1 }} />
                {link && <Box onClick={() => openLink(link)} sx={{ width: 36, height: 36, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><OpenInNewRoundedIcon sx={{ fontSize: 17, color: DS.green }} /></Box>}
              </Box>
            )}

            {([
              ['Vincular criativo manualmente', link, setLink, 'link'],
              ['Material bruto', footage, setFootage, 'footageLink'],
              ['Roteiro', roteiro, setRoteiro, 'roteiroLink'],
            ] as const).map(([label, value, setter, key]) => (
              <Box key={key}>
                <Typography sx={sectionLabel()}>{label}</Typography>
                <Box sx={{ display: 'flex', gap: 0.6 }}>
                  <TextField fullWidth size="small" value={value} onChange={event => setter(event.target.value)} onBlur={() => commit({ [key]: value } as Partial<ItemState>)} placeholder="Cole o link do Drive…" sx={fieldSx} />
                  {value && <Box onClick={() => openLink(value)} sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: 2.2, display: 'grid', placeItems: 'center', cursor: 'pointer', bgcolor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)' }}><OpenInNewRoundedIcon sx={{ fontSize: 18, color: DS.accent }} /></Box>}
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {tab === 'revisao' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.15 }}>
            {!previewReady && <Box sx={{ p: 1.1, borderRadius: 2.3, bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.26)' }}><Typography sx={{ fontSize: '0.64rem', color: DS.amber, lineHeight: 1.4 }}>Ações de envio ficam bloqueadas até a prévia estar reproduzível.</Typography></Box>}

            {confirmAction && (
              <Box sx={{ p: 1.15, borderRadius: 2.5, bgcolor: 'rgba(59,130,246,0.09)', border: '1px solid rgba(59,130,246,0.3)' }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 780, color: DS.t1 }}>{confirmationCopy}</Typography>
                <Box sx={{ display: 'flex', gap: 0.65, mt: 1 }}>
                  <Box onClick={() => setConfirmAction(null)} sx={{ minHeight: 38, px: 1.2, borderRadius: 2, display: 'flex', alignItems: 'center', cursor: 'pointer', bgcolor: 'rgba(244,247,255,0.04)' }}><Typography sx={{ fontSize: '0.62rem', fontWeight: 760, color: DS.t2 }}>Cancelar</Typography></Box>
                  <Box onClick={confirm} sx={{ minHeight: 38, px: 1.2, borderRadius: 2, display: 'flex', alignItems: 'center', cursor: 'pointer', bgcolor: DS.accent }}><Typography sx={{ fontSize: '0.62rem', fontWeight: 820, color: '#fff' }}>Confirmar</Typography></Box>
                </Box>
              </Box>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.7 }}>
              <ActionButton label="Enviar à revisão interna" tone={DS.blueSoft} disabled={!previewReady} onClick={() => setConfirmAction('review')} />
              <ActionButton label="Enviar ao cliente" tone={DS.accent} disabled={!previewReady || !onRequestSend} onClick={() => onRequestSend?.(item)} />
              <ActionButton label="Aprovar" tone={DS.green} onClick={() => setConfirmAction('approve')} />
              <ActionButton label="Pedir ajuste" tone={DS.red} onClick={() => setConfirmAction('adjust')} />
            </Box>

            <Typography sx={sectionLabel({ mt: 0.5 })}>Comentários de revisão</Typography>
            {(state.comments ?? []).map(comment => (
              <Box key={comment.id} sx={{ p: 1.05, borderRadius: 2.3, bgcolor: comment.authorType === 'client' ? 'rgba(59,130,246,0.08)' : 'rgba(244,247,255,0.035)', border: `1px solid ${comment.authorType === 'client' ? 'rgba(59,130,246,0.24)' : 'rgba(148,163,184,0.12)'}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Typography sx={{ fontSize: '0.58rem', fontWeight: 820, color: comment.authorType === 'client' ? DS.accent : DS.blueSoft }}>{comment.authorType === 'client' ? 'Cliente' : comment.author}</Typography><Box sx={{ flex: 1 }} /><Typography sx={{ fontSize: '0.52rem', color: DS.t3 }}>{new Date(comment.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Typography></Box>
                <Typography sx={{ mt: 0.35, fontSize: '0.72rem', color: DS.t1, lineHeight: 1.42 }}>{comment.text}</Typography>
              </Box>
            ))}
            {!(state.comments ?? []).length && <Typography sx={{ py: 1, textAlign: 'center', fontSize: '0.68rem', color: DS.t3 }}>Nenhum comentário ainda.</Typography>}
            <Box sx={{ display: 'flex', gap: 0.65, alignItems: 'center' }}>
              <InputBase value={newComment} onChange={event => setNewComment(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addComment() }} placeholder="Ex.: 00:12 — ajustar a legenda…" sx={{ flex: 1, minHeight: 44, px: 1.1, borderRadius: 2.3, fontSize: '0.74rem', color: DS.t1, bgcolor: 'rgba(244,247,255,0.04)', border: '1px solid rgba(148,163,184,0.14)' }} />
              <Box onClick={addComment} sx={{ minHeight: 44, px: 1.15, borderRadius: 2.3, display: 'flex', alignItems: 'center', cursor: 'pointer', bgcolor: DS.accent }}><Typography sx={{ fontSize: '0.62rem', fontWeight: 820, color: '#fff' }}>Enviar</Typography></Box>
            </Box>
          </Box>
        )}

        {tab === 'historico' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {([
              ['Enviado ao cliente', state.sentToClientAt, DS.accent],
              ['Aprovado pelo cliente', state.approvedByClientAt, DS.green],
              ['Publicado', state.publishedAt, DS.greenDim],
            ] as const).filter(([, timestamp]) => !!timestamp).map(([label, timestamp, color]) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, p: 0.9, borderRadius: 2.2, bgcolor: 'rgba(244,247,255,0.025)' }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                <Typography sx={{ flex: 1, fontSize: '0.7rem', fontWeight: 730, color: DS.t1 }}>{label}</Typography>
                <Typography sx={{ fontSize: '0.55rem', color: DS.t3 }}>{new Date(timestamp as number).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Typography>
              </Box>
            ))}
            {[...(state.history ?? [])].reverse().map((entry, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, px: 0.9, py: 0.65 }}>
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: DS.t3 }} />
                <Typography sx={{ flex: 1, fontSize: '0.68rem', color: DS.t1 }}>{entry.action}{entry.user ? ` · ${entry.user}` : ''}</Typography>
                <Typography sx={{ fontSize: '0.54rem', color: DS.t3 }}>{new Date(entry.ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</Typography>
              </Box>
            ))}
            {!state.sentToClientAt && !state.approvedByClientAt && !state.publishedAt && !(state.history ?? []).length && <Typography sx={{ py: 4, textAlign: 'center', fontSize: '0.7rem', color: DS.t3 }}>Ainda não há movimentações registradas.</Typography>}
          </Box>
        )}
      </Box>
      {undo && (
        <Box role="status" sx={{ position: 'fixed', zIndex: 1600, left: 14, right: 14, bottom: 'max(env(safe-area-inset-bottom), 18px)', minHeight: 54, px: 1.15, display: 'flex', alignItems: 'center', gap: .8, borderRadius: 2.8, background: 'rgba(8,15,27,.97)', border: '1px solid rgba(6,182,212,.32)', boxShadow: '0 18px 42px rgba(0,0,0,.5)', backdropFilter: 'blur(18px)' }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: DS.cyan, boxShadow: '0 0 12px rgba(6,182,212,.65)' }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: '.61rem', fontWeight: 820, color: DS.t1 }}>“{undo.label}” aplicado</Typography>
            <Typography sx={{ mt: .15, fontSize: '.49rem', color: DS.t3 }}>{STATUS_CONFIG[undo.from].shortLabel} → {STATUS_CONFIG[undo.to].shortLabel}</Typography>
          </Box>
          <Box component="button" type="button" onClick={undoExpress} aria-label="Desfazer alteração" sx={{ appearance: 'none', minHeight: 36, px: .85, display: 'flex', alignItems: 'center', gap: .35, borderRadius: 2, color: DS.cyan, background: 'rgba(6,182,212,.08)', border: '1px solid rgba(6,182,212,.24)', cursor: 'pointer' }}>
            <UndoRoundedIcon sx={{ fontSize: 15 }} />
            <Typography component="span" sx={{ fontSize: '.55rem', fontWeight: 850, color: 'inherit' }}>Desfazer</Typography>
          </Box>
        </Box>
      )}
    </BottomSheet>
  )
}
