import { useState, useMemo, useCallback, useRef } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import {
  Box, Typography, TextField, Button, Chip, Paper, IconButton,
  Tooltip, CircularProgress, Avatar, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, Divider, LinearProgress, Menu, Alert, Snackbar,
  Checkbox, ToggleButtonGroup, ToggleButton,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import PhoneIcon from '@mui/icons-material/Phone'
import LanguageIcon from '@mui/icons-material/Language'
import AddIcon from '@mui/icons-material/Add'
import StarIcon from '@mui/icons-material/Star'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import KeyIcon from '@mui/icons-material/Key'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import EditIcon from '@mui/icons-material/Edit'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import EventIcon from '@mui/icons-material/Event'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import SelectAllIcon from '@mui/icons-material/SelectAll'
import SortIcon from '@mui/icons-material/Sort'
import type { Lead, LeadStage } from '../types'

// ── Config ────────────────────────────────────────────────

const PIPELINE_STAGES: { key: LeadStage; label: string; color: string; emoji: string; hint: string }[] = [
  { key: 'contato',  label: 'Contato',  color: '#60A5FA', emoji: '📞', hint: 'Primeiro contato feito' },
  { key: 'reuniao',  label: 'Reunião',  color: '#F59E0B', emoji: '🤝', hint: 'Reunião agendada/realizada' },
  { key: 'proposta', label: 'Proposta', color: '#60A5FA', emoji: '📋', hint: 'Proposta enviada' },
  { key: 'fechado',  label: 'Fechado',  color: '#00C47A', emoji: '✅', hint: 'Cliente fechado!' },
  { key: 'perdido',  label: 'Perdido',  color: '#FF3B30', emoji: '❌', hint: 'Oportunidade perdida' },
]

const SEARCH_TEMPLATES = [
  // ── Gastronômico ─────────────────────────────────────────
  { label: '🍖 Churrascaria SP', q: 'churrascaria em São Paulo SP', group: 'gastro' },
  { label: '🍕 Restaurante SP',  q: 'restaurante em São Paulo SP', group: 'gastro' },
  { label: '🍔 Hamburgueria',    q: 'hamburgueria artesanal em São Paulo SP', group: 'gastro' },
  { label: '🍞 Padaria SP',      q: 'padaria artesanal em São Paulo SP', group: 'gastro' },
  { label: '🎂 Confeitaria SP',  q: 'confeitaria em São Paulo SP', group: 'gastro' },
  { label: '🍣 Sushi bar',       q: 'restaurante japonês sushi em São Paulo SP', group: 'gastro' },
  { label: '🍕 Pizzaria SP',     q: 'pizzaria em São Paulo SP', group: 'gastro' },
  { label: '☕ Cafeteria Sorocaba', q: 'cafeteria em Sorocaba SP', group: 'gastro' },
  { label: '🥩 Churrascaria ABC', q: 'churrascaria em Santo André SP', group: 'gastro' },
  { label: '🍞 Padaria Campinas', q: 'padaria em Campinas SP', group: 'gastro' },
  { label: '🍔 Hamburgueria Guarulhos', q: 'hamburgueria em Guarulhos SP', group: 'gastro' },
  { label: '🥘 Restaurante Jundiaí', q: 'restaurante em Jundiaí SP', group: 'gastro' },
  { label: '🧆 Bar e Petisco SP', q: 'bar petiscaria em São Paulo SP', group: 'gastro' },
  { label: '🍦 Doceria SP',      q: 'doceria confeitaria em São Paulo SP', group: 'gastro' },
  // ── Outros segmentos ──────────────────────────────────────
  { label: '💇 Salão beleza',   q: 'salão de beleza em São Paulo SP', group: 'outros' },
  { label: '🏋️ Academia',       q: 'academia fitness em São Paulo SP', group: 'outros' },
  { label: '🐾 Pet shop',       q: 'pet shop em São Paulo SP', group: 'outros' },
  { label: '🧴 Clínica estética', q: 'clínica estética em São Paulo SP', group: 'outros' },
  { label: '🏠 Imobiliária SP', q: 'imobiliária em São Paulo SP', group: 'outros' },
  { label: '🦷 Odontologia',    q: 'clínica odontológica em São Paulo SP', group: 'outros' },
]

const GASTRO_CATEGORIES = ['restaurante', 'churrascaria', 'hamburgueria', 'padaria', 'confeitaria', 'pizzaria', 'cafeteria', 'café', 'lanchonete', 'bar', 'petiscaria', 'doceria', 'sushi', 'japonês', 'cantina', 'food truck', 'gastronomia', 'sorveteria']

function isGastronomico(lead: { category?: string; name?: string }): boolean {
  const text = `${lead.category ?? ''} ${lead.name ?? ''}`.toLowerCase()
  return GASTRO_CATEGORIES.some(k => text.includes(k))
}

// ── Persistence ───────────────────────────────────────────

function loadLeads(): Lead[] {
  try { return JSON.parse(localStorage.getItem('sm_leads') ?? '[]') } catch { return [] }
}
function saveLeads(leads: Lead[]) { localStorage.setItem('sm_leads', JSON.stringify(leads)) }

// ── Apify result type ──────────────────────────────────────

interface ApifyPlace {
  title?: string
  address?: string
  phone?: string
  website?: string
  rating?: number
  reviewsCount?: number
  categoryName?: string
  category?: string
  placeId?: string
  instagram?: string
  emails?: string[]
  imageUrl?: string
  totalScore?: number
  description?: string
}

// ── Lead score (0-100) ────────────────────────────────────

function calcScore(lead: Lead): number {
  let s = 0
  if (lead.phone) s += 25
  if (lead.instagram) s += 20
  if ((lead.rating ?? 0) >= 4) s += 20
  else if ((lead.rating ?? 0) >= 3) s += 10
  if (lead.estimatedTicket && lead.estimatedTicket >= 1500) s += 20
  else if (lead.estimatedTicket && lead.estimatedTicket >= 800) s += 10
  if (lead.website) s += 10
  if (lead.notes) s += 5
  return Math.min(s, 100)
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#00C47A' : score >= 40 ? '#F59E0B' : '#60A5FA'
  return (
    <Box sx={{
      px: 0.6, py: 0.1, borderRadius: 1, border: `1px solid ${color}40`,
      bgcolor: `${color}12`, display: 'flex', alignItems: 'center', gap: 0.3, flexShrink: 0,
    }}>
      <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: color }} />
      <Typography sx={{ fontSize: '0.48rem', fontWeight: 900, color, lineHeight: 1 }}>{score}</Typography>
    </Box>
  )
}

// ── LeadAge ───────────────────────────────────────────────

function leadAge(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `${days}d`
  if (days < 30) return `${Math.floor(days / 7)}sem`
  return `${Math.floor(days / 30)}m`
}

// ── LeadCard ──────────────────────────────────────────────

function LeadCard({
  lead, onStageChange, onDelete, onEdit, onGeneratePitch, compact,
}: {
  lead: Lead
  onStageChange: (id: string, stage: LeadStage) => void
  onDelete: (id: string) => void
  onEdit: (lead: Lead) => void
  onGeneratePitch: (lead: Lead) => void
  compact?: boolean
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const stage = PIPELINE_STAGES.find(s => s.key === lead.stage)!
  const score = calcScore(lead)
  const age   = leadAge(lead.addedAt)

  const due    = lead.followUpAt ? new Date(lead.followUpAt) : null
  const isOverdue = due ? due < new Date() : false

  return (
    <Paper elevation={0} sx={{
      p: compact ? 1.2 : 1.5, mb: 0.8, borderRadius: 2,
      border: `1px solid ${isOverdue ? 'rgba(255,69,69,0.35)' : `${stage.color}22`}`,
      borderLeft: `3px solid ${isOverdue ? '#FF4545' : stage.color}`,
      bgcolor: 'rgba(255,255,255,0.025)',
      '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: `${stage.color}40` },
      transition: 'all 0.15s',
    }}>
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8, mb: 0.6 }}>
        <Avatar sx={{ width: 28, height: 28, fontSize: '0.6rem', bgcolor: `${stage.color}22`, color: stage.color, flexShrink: 0, fontWeight: 800 }}>
          {lead.name.slice(0, 2).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.76rem', lineHeight: 1.2 }} noWrap>{lead.name}</Typography>
          {lead.category && (
            <Typography sx={{ fontSize: '0.52rem', color: 'text.secondary', lineHeight: 1 }}>{lead.category}</Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, flexShrink: 0 }}>
          <ScoreBadge score={score} />
          <Typography sx={{ fontSize: '0.45rem', color: 'text.disabled', lineHeight: 1 }}>{age}</Typography>
          <IconButton size="small" onClick={() => onEdit(lead)} sx={{ p: 0.25 }}>
            <EditIcon sx={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }} />
          </IconButton>
          <IconButton size="small" onClick={() => onDelete(lead.id)} sx={{ p: 0.25 }}>
            <DeleteOutlineIcon sx={{ fontSize: 11, color: 'rgba(255,59,48,0.4)' }} />
          </IconButton>
        </Box>
      </Box>

      {/* Info rows */}
      {!compact && lead.address && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.4, mb: 0.3 }}>
          <LocationOnIcon sx={{ fontSize: 9, color: 'text.disabled', mt: 0.15, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary', lineHeight: 1.4 }} noWrap>{lead.address}</Typography>
        </Box>
      )}

      {lead.rating && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mb: 0.4 }}>
          <StarIcon sx={{ fontSize: 9, color: '#F59E0B' }} />
          <Typography sx={{ fontSize: '0.58rem', color: '#F59E0B', fontWeight: 700 }}>{lead.rating.toFixed(1)}</Typography>
          {lead.ratingsTotal && <Typography sx={{ fontSize: '0.52rem', color: 'text.disabled' }}>({lead.ratingsTotal})</Typography>}
        </Box>
      )}

      {lead.estimatedTicket && (
        <Chip
          icon={<AttachMoneyIcon sx={{ fontSize: '10px !important' }} />}
          label={`R$ ${lead.estimatedTicket.toLocaleString('pt-BR')}/mês`}
          size="small"
          sx={{ height: 16, fontSize: '0.52rem', mb: 0.5, bgcolor: 'rgba(0,196,122,0.1)', color: '#00C47A', border: '1px solid rgba(0,196,122,0.2)' }}
        />
      )}

      {lead.notes && !compact && (
        <Typography sx={{ fontSize: '0.57rem', color: 'text.secondary', fontStyle: 'italic', mb: 0.5, lineHeight: 1.4 }} noWrap>
          "{lead.notes}"
        </Typography>
      )}

      {lead.followUpAt && (
        <Chip
          icon={isOverdue ? <NotificationsActiveIcon sx={{ fontSize: '10px !important' }} /> : <EventIcon sx={{ fontSize: '10px !important' }} />}
          label={isOverdue ? `⚠️ Retorno: ${new Date(lead.followUpAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : `Retorno: ${new Date(lead.followUpAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
          size="small"
          sx={{ height: 16, fontSize: '0.5rem', mb: 0.5,
            bgcolor: isOverdue ? 'rgba(255,69,69,0.15)' : 'rgba(59,130,246,0.1)',
            color: isOverdue ? '#FF4545' : '#3B82F6',
            border: `1px solid ${isOverdue ? 'rgba(255,69,69,0.3)' : 'rgba(59,130,246,0.2)'}`,
          }}
        />
      )}

      {/* Actions row */}
      <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', alignItems: 'center', mt: 0.4 }}>
        {lead.phone && (
          <Tooltip title={`WhatsApp: ${lead.phone}`}>
            <IconButton size="small" component="a"
              href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
              sx={{ p: 0.35, bgcolor: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 1 }}>
              <WhatsAppIcon sx={{ fontSize: 11, color: '#25D366' }} />
            </IconButton>
          </Tooltip>
        )}
        {lead.phone && (
          <Tooltip title={`Ligar: ${lead.phone}`}>
            <IconButton size="small" component="a" href={`tel:${lead.phone}`}
              sx={{ p: 0.35, bgcolor: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.15)', borderRadius: 1 }}>
              <PhoneIcon sx={{ fontSize: 11, color: '#25D366' }} />
            </IconButton>
          </Tooltip>
        )}
        {lead.website && (
          <Tooltip title="Site">
            <IconButton size="small" component="a" href={lead.website} target="_blank" rel="noopener"
              sx={{ p: 0.35, bgcolor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 1 }}>
              <LanguageIcon sx={{ fontSize: 11, color: '#3B82F6' }} />
            </IconButton>
          </Tooltip>
        )}
        {lead.name && (
          <Tooltip title="Instagram">
            <IconButton size="small" component="a"
              href={lead.instagram ? `https://www.instagram.com/${lead.instagram.replace('@', '')}` : `https://www.google.com/search?q=${encodeURIComponent(lead.name + ' instagram')}`}
              target="_blank" rel="noopener"
              sx={{ p: 0.35, bgcolor: 'rgba(225,48,108,0.1)', border: '1px solid rgba(225,48,108,0.2)', borderRadius: 1 }}>
              <Typography sx={{ fontSize: '0.56rem', lineHeight: 1 }}>📸</Typography>
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Gerar pitch com IA">
          <IconButton size="small" onClick={() => onGeneratePitch(lead)}
            sx={{ p: 0.35, bgcolor: 'rgba(180,90,255,0.1)', border: '1px solid rgba(180,90,255,0.2)', borderRadius: 1 }}>
            <AutoAwesomeIcon sx={{ fontSize: 11, color: '#b45aff' }} />
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        {/* Stage chip */}
        <Chip
          label={`${stage.emoji} ${stage.label}`}
          size="small"
          onClick={e => setAnchor(e.currentTarget)}
          sx={{ height: 16, fontSize: '0.5rem', fontWeight: 800, cursor: 'pointer', bgcolor: `${stage.color}18`, color: stage.color, border: `1px solid ${stage.color}30` }}
        />
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
          slotProps={{ paper: { sx: { background: 'rgba(18,18,18,0.98)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 } } }}>
          {PIPELINE_STAGES.map(s => (
            <MenuItem key={s.key} selected={lead.stage === s.key} onClick={() => { onStageChange(lead.id, s.key); setAnchor(null) }}
              sx={{ fontSize: '0.72rem', gap: 1, '&.Mui-selected': { bgcolor: `${s.color}12` } }}>
              <Typography sx={{ fontSize: '0.85rem' }}>{s.emoji}</Typography>
              <Box>
                <Typography sx={{ color: s.color, fontWeight: 700, fontSize: '0.72rem' }}>{s.label}</Typography>
                <Typography sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>{s.hint}</Typography>
              </Box>
            </MenuItem>
          ))}
        </Menu>
      </Box>
    </Paper>
  )
}

// ── ApifyResultCard ───────────────────────────────────────

function ApifyResultCard({
  place, selected, onToggle, alreadyInPipeline, onPitch,
}: {
  place: ApifyPlace
  selected: boolean
  onToggle: (p: ApifyPlace) => void
  alreadyInPipeline: boolean
  onPitch?: (p: ApifyPlace) => void
}) {
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(place.rating ?? 0))
  return (
    <Paper elevation={0} sx={{
      p: 1.5, borderRadius: 2.5,
      border: `1px solid ${selected ? 'rgba(0,196,122,0.4)' : alreadyInPipeline ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)'}`,
      bgcolor: selected ? 'rgba(0,196,122,0.06)' : alreadyInPipeline ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.025)',
      opacity: alreadyInPipeline ? 0.5 : 1,
      display: 'flex', flexDirection: 'column', gap: 0.8,
      transition: 'all 0.15s',
      cursor: alreadyInPipeline ? 'not-allowed' : 'pointer',
      '&:hover': alreadyInPipeline ? {} : { border: `1px solid ${selected ? 'rgba(0,196,122,0.6)' : 'rgba(59,130,246,0.25)'}` },
    }} onClick={() => !alreadyInPipeline && onToggle(place)}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: 1, flexShrink: 0, overflow: 'hidden',
          bgcolor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {place.imageUrl
            ? <Box component="img" src={place.imageUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Typography sx={{ fontSize: '1.2rem' }}>🏪</Typography>
          }
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.76rem', lineHeight: 1.2 }} noWrap>{place.title}</Typography>
            {alreadyInPipeline && (
              <Chip label="No pipeline" size="small"
                sx={{ height: 14, fontSize: '0.45rem', bgcolor: 'rgba(255,255,255,0.07)', color: 'text.disabled' }} />
            )}
          </Box>
          {place.categoryName && (
            <Typography sx={{ fontSize: '0.54rem', color: 'text.secondary' }}>{place.categoryName}</Typography>
          )}
        </Box>
        <Box onClick={e => e.stopPropagation()}>
          <Checkbox
            checked={selected} disabled={alreadyInPipeline}
            onChange={() => !alreadyInPipeline && onToggle(place)}
            size="small" sx={{ p: 0.2, color: 'rgba(255,255,255,0.2)', '&.Mui-checked': { color: '#00C47A' } }}
          />
        </Box>
      </Box>

      {(place.rating ?? 0) > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          {stars.map((filled, i) => (
            <StarIcon key={i} sx={{ fontSize: 9, color: filled ? '#F59E0B' : 'rgba(255,255,255,0.12)' }} />
          ))}
          <Typography sx={{ fontSize: '0.55rem', color: '#F59E0B', fontWeight: 700, ml: 0.2 }}>
            {(place.rating ?? 0).toFixed(1)} ({place.reviewsCount ?? 0})
          </Typography>
        </Box>
      )}

      {place.address && (
        <Box sx={{ display: 'flex', gap: 0.4, alignItems: 'flex-start' }}>
          <LocationOnIcon sx={{ fontSize: 10, color: 'text.disabled', mt: 0.2, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.56rem', color: 'text.secondary', lineHeight: 1.4 }}>{place.address}</Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
        {place.phone && (
          <Chip icon={<PhoneIcon sx={{ fontSize: '10px !important' }} />} label={place.phone} size="small"
            sx={{ height: 16, fontSize: '0.52rem', bgcolor: 'rgba(37,211,102,0.08)', color: '#25D366', border: '1px solid rgba(37,211,102,0.2)' }} />
        )}
        {place.instagram && (
          <Tooltip title="Buscar no Google para encontrar o perfil real">
            <Chip
              label={`🔍 ${place.instagram.startsWith('@') ? place.instagram : `@${place.instagram}`}`}
              size="small"
              onClick={e => {
                e.stopPropagation()
                const q = encodeURIComponent(`${place.title} ${place.address?.split(',').pop()?.trim() ?? ''} instagram`)
                window.open(`https://www.google.com/search?q=${q}`, '_blank', 'noopener')
              }}
              sx={{ height: 16, fontSize: '0.52rem', bgcolor: 'rgba(225,48,108,0.08)', color: '#E1306C', border: '1px solid rgba(225,48,108,0.2)', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(225,48,108,0.18)' } }} />
          </Tooltip>
        )}
        {place.emails?.[0] && (
          <Chip label={place.emails[0]} size="small"
            sx={{ height: 16, fontSize: '0.52rem', bgcolor: 'rgba(59,130,246,0.08)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)', maxWidth: 160, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
        )}
        {place.website && (
          <Chip icon={<LanguageIcon sx={{ fontSize: '10px !important' }} />}
            label={(() => { try { return new URL(place.website).hostname } catch { return place.website } })()}
            size="small"
            sx={{ height: 16, fontSize: '0.52rem', bgcolor: 'rgba(255,255,255,0.05)', color: 'text.secondary', border: '1px solid rgba(255,255,255,0.1)' }} />
        )}
      </Box>

      {onPitch && !alreadyInPipeline && (
        <Box onClick={e => { e.stopPropagation(); onPitch(place) }} sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
          py: 0.6, borderRadius: 1.5, cursor: 'pointer', mt: 0.3,
          bgcolor: 'rgba(180,90,255,0.08)', border: '1px solid rgba(180,90,255,0.2)',
          transition: 'all 0.15s',
          '&:hover': { bgcolor: 'rgba(180,90,255,0.16)', borderColor: 'rgba(180,90,255,0.4)' },
        }}>
          <AutoAwesomeIcon sx={{ fontSize: 11, color: '#b45aff' }} />
          <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: '#b45aff' }}>
            Gerar pitch de venda
          </Typography>
        </Box>
      )}
    </Paper>
  )
}

// ── DnD helpers ───────────────────────────────────────────

function DraggableLeadCard({ lead, children }: { lead: Lead; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })
  return (
    <Box
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      sx={{
        opacity: isDragging ? 0.3 : 1,
        transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
        touchAction: 'none',
        cursor: 'grab',
        '&:active': { cursor: 'grabbing' },
        transition: isDragging ? 'none' : 'opacity 0.15s',
      }}
    >
      {children}
    </Box>
  )
}

function DroppableStageColumn({ stageKey, isOver, children }: { stageKey: string; isOver: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: stageKey })
  return (
    <Box ref={setNodeRef} sx={{
      flex: 1, minHeight: 80,
      borderRadius: 1.5,
      outline: isOver ? '2px dashed rgba(255,255,255,0.25)' : '2px dashed transparent',
      bgcolor: isOver ? 'rgba(255,255,255,0.025)' : 'transparent',
      transition: 'all 0.15s',
    }}>
      {children}
    </Box>
  )
}

// ── Main ProspeccaoTab ────────────────────────────────────

type SortKey = 'date' | 'score' | 'ticket' | 'rating'

export default function ProspeccaoTab() {
  const [leads, setLeads] = useState<Lead[]>(loadLeads)
  const [view, setView] = useState<'search' | 'pipeline'>('search')

  // ── DnD ────────────────────────────────────────────────
  const [activeLead, setActiveLead]   = useState<Lead | null>(null)
  const [overStage,  setOverStage]    = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 180, tolerance: 8 } }),
  )
  const handlePipelineDragStart = (e: DragStartEvent) => {
    const lead = leads.find(l => l.id === String(e.active.id))
    if (lead) setActiveLead(lead)
  }
  const handlePipelineDragOver = (e: { over: { id: string | number } | null }) => {
    setOverStage(e.over ? String(e.over.id) : null)
  }
  const handlePipelineDragEnd = (e: DragEndEvent) => {
    setActiveLead(null); setOverStage(null)
    const { active, over } = e
    if (!over) return
    const newStage = String(over.id) as LeadStage
    if (!PIPELINE_STAGES.find(s => s.key === newStage)) return
    handleStageChange(String(active.id), newStage)
  }

  // Search mode: 'ai' = sugestões Claude, 'real' = Apify Google Maps
  const [searchMode, setSearchMode]       = useState<'ai' | 'real'>('ai')
  const [apifyKey, setApifyKey]           = useState(() => localStorage.getItem('sm_apify_key') ?? '')
  const [apifyKeyInput, setApifyKeyInput] = useState('')
  const [apifyKeyOpen, setApifyKeyOpen]   = useState(false)

  // Search state (shared between modes)
  const [apifyQuery, setApifyQuery]       = useState('')
  const [apifyMax, setApifyMax]           = useState('20')
  const [apifyRunning, setApifyRunning]   = useState(false)
  const [apifyProgress, setApifyProgress] = useState(0)
  const [apifyResults, setApifyResults]   = useState<ApifyPlace[]>([])
  const [apifySelected, setApifySelected] = useState<Set<string>>(new Set())
  const [apifyError, setApifyError]       = useState('')
  const [apifyImported, setApifyImported] = useState('')
  const apifyPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Edit lead dialog
  const [editLead, setEditLead]         = useState<Lead | null>(null)
  const [editStage, setEditStage]       = useState<LeadStage>('contato')
  const [editNotes, setEditNotes]       = useState('')
  const [editTicket, setEditTicket]     = useState('')
  const [editInstagram, setEditInstagram] = useState('')
  const [editPhone, setEditPhone]       = useState('')
  const [editFollowUp, setEditFollowUp] = useState('')
  const [editName, setEditName]         = useState('')

  // Pitch generator
  const [pitchLead, setPitchLead]       = useState<Lead | null>(null)
  const [pitchText, setPitchText]       = useState('')
  const [pitchLoading, setPitchLoading] = useState(false)
  const [pitchCopied, setPitchCopied]   = useState(false)

  // WhatsApp da agência
  const [agencyWA, setAgencyWA] = useState(() => localStorage.getItem('sm_agency_wa') ?? '')
  const [waInput, setWaInput]   = useState(false)

  // Batch pitch
  const [batchOpen, setBatchOpen]           = useState(false)
  const [batchPitches, setBatchPitches]     = useState<{ place: ApifyPlace; text: string; copied: boolean }[]>([])
  const [batchLoading, setBatchLoading]     = useState(false)
  const [batchProgress, setBatchProgress]  = useState(0)

  // Pipeline controls
  const [sortKey, setSortKey]           = useState<SortKey>('score')

  const saveApifyKey = () => {
    localStorage.setItem('sm_apify_key', apifyKeyInput)
    setApifyKey(apifyKeyInput)
    setApifyKeyOpen(false)
  }

  // ── Real data search (Apify Google Maps) ─────────────────

  const startRealSearch = useCallback(async () => {
    if (!apifyQuery.trim()) return
    if (apifyPollRef.current) clearInterval(apifyPollRef.current)
    setApifyRunning(true)
    setApifyError('')
    setApifyResults([])
    setApifySelected(new Set())
    setApifyProgress(5)

    try {
      const res = await fetch('/api/apify?action=run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(apifyKey ? { 'X-Apify-Token': apifyKey } : {}) },
        body: JSON.stringify({ query: apifyQuery.trim(), maxPlaces: Number(apifyMax) || 20 }),
      })
      const data = await res.json() as { ok: boolean; runId?: string; error?: string }
      if (!data.ok || !data.runId) { setApifyError(data.error ?? 'Falha ao iniciar extração'); setApifyRunning(false); return }

      const runId = data.runId
      let fakeProgress = 10
      let datasetId = ''

      apifyPollRef.current = setInterval(async () => {
        fakeProgress = Math.min(fakeProgress + 5, 90)
        setApifyProgress(fakeProgress)
        try {
          const sRes = await fetch(`/api/apify?action=status&runId=${runId}`, { headers: apifyKey ? { 'X-Apify-Token': apifyKey } : {} })
          const sData = await sRes.json() as { ok: boolean; status?: string; datasetId?: string }
          if (!sData.ok) return
          if (sData.datasetId) datasetId = sData.datasetId
          const st = sData.status ?? ''
          if (st === 'SUCCEEDED') {
            clearInterval(apifyPollRef.current!)
            setApifyProgress(95)
            const rRes = await fetch(`/api/apify?action=results&datasetId=${datasetId}`, { headers: apifyKey ? { 'X-Apify-Token': apifyKey } : {} })
            const rData = await rRes.json() as { ok: boolean; items?: ApifyPlace[]; error?: string }
            if (rData.ok && rData.items) {
              const items = rData.items.filter(p => p.title)
              setApifyResults(items)
              const existing = new Set(leads.map(l => l.placeId).filter(Boolean) as string[])
              setApifySelected(new Set(items.filter(p => p.placeId && !existing.has(p.placeId)).map(p => p.placeId!)))
            } else { setApifyError(rData.error ?? 'Erro ao buscar resultados') }
            setApifyProgress(100); setApifyRunning(false)
          } else if (['FAILED','TIMED-OUT','ABORTED'].includes(st)) {
            clearInterval(apifyPollRef.current!)
            setApifyError(`Extração ${st.toLowerCase()}. Tente novamente.`)
            setApifyRunning(false)
          }
        } catch { /* keep polling */ }
      }, 4000)
    } catch (e) { setApifyError('Erro de conexão: ' + String(e)); setApifyRunning(false) }
  }, [apifyQuery, apifyMax, apifyKey, leads])

  // ── AI Lead Search ────────────────────────────────────────

  const startApifyRun = useCallback(async () => {
    if (!apifyQuery.trim()) return
    const anthropicKey = localStorage.getItem('sm_anthropic_key') ?? ''
    if (!anthropicKey) {
      setApifyError('Configure sua chave Anthropic na aba IA Operacional.')
      return
    }
    setApifyRunning(true)
    setApifyError('')
    setApifyResults([])
    setApifySelected(new Set())
    setApifyProgress(20)

    const query = apifyQuery.trim()
    const prompt = `Gere exatamente ${Number(apifyMax) || 20} negócios fictícios mas realistas do tipo: "${query}".

REGRA CRÍTICA: todos os ${Number(apifyMax) || 20} negócios devem ser EXATAMENTE do segmento e cidade descritos em "${query}". Não misture outros segmentos.

Use nomes típicos brasileiros. Para o instagram, gere um @ baseado no nome + cidade, sem acentos, letras minúsculas.

Responda APENAS com o array JSON puro, sem markdown, sem texto antes ou depois:
[{"title":"Nome","address":"Bairro, Cidade/SP","category":"${query.split(' ')[0]}","phone":"","website":"","instagram":"@handle","rating":4.3,"reviewsCount":95,"totalScore":75,"description":"Por que precisam de marketing digital"}]`

    try {
      setApifyProgress(50)
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Anthropic-Key': anthropicKey },
        body: JSON.stringify({ system: '', messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json() as { content?: { text: string }[]; error?: { message: string } }
      if (data.error) throw new Error(data.error.message)
      let text = data.content?.[0]?.text ?? ''
      // Strip markdown code fences
      text = text.replace(/```(?:json)?/gi, '').trim()
      // Extract from first [ to last ] (greedy — gets the full array)
      const start = text.indexOf('[')
      const end   = text.lastIndexOf(']')
      if (start === -1 || end === -1 || end <= start) {
        throw new Error('IA não retornou JSON. Tente com menos leads ou tente novamente.')
      }
      const items: ApifyPlace[] = JSON.parse(text.slice(start, end + 1))
      setApifyResults(items.filter(p => p.title))
      setApifySelected(new Set(items.filter(p => p.title).map(p => p.title!)))
      setApifyProgress(100)
    } catch (e) {
      setApifyError(String(e))
    } finally {
      setApifyRunning(false)
    }
  }, [apifyQuery, apifyMax])

  const toggleApifySelect = useCallback((p: ApifyPlace) => {
    const key = p.placeId || p.title || ''
    setApifySelected(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next })
  }, [])

  const importApifySelected = useCallback(() => {
    const existing = new Set(leads.map(l => l.placeId).filter(Boolean) as string[])
    const toImport = apifyResults.filter(p => {
      const key = p.placeId || p.title || ''
      return apifySelected.has(key) && !existing.has(p.placeId ?? '')
    })
    const newLeads: Lead[] = toImport.map(p => ({
      id: crypto.randomUUID(), name: p.title ?? 'Sem nome', address: p.address ?? '',
      phone: p.phone, website: p.website, instagram: p.instagram, rating: p.rating,
      ratingsTotal: p.reviewsCount, placeId: p.placeId, stage: 'contato' as LeadStage,
      notes: p.emails?.[0] ? `Email: ${p.emails[0]}` : undefined,
      addedAt: Date.now(), updatedAt: Date.now(), source: 'maps' as const, category: p.categoryName,
    }))
    const next = [...leads, ...newLeads]
    setLeads(next); saveLeads(next)
    setApifyImported(`${newLeads.length} lead${newLeads.length !== 1 ? 's' : ''} importado${newLeads.length !== 1 ? 's' : ''}!`)
    setApifySelected(new Set()); setView('pipeline')
  }, [apifyResults, apifySelected, leads])

  // ── Lead actions ──────────────────────────────────────────

  const handleStageChange = (id: string, stage: LeadStage) => {
    const next = leads.map(l => l.id === id ? { ...l, stage, updatedAt: Date.now() } : l)
    setLeads(next); saveLeads(next)
  }

  const handleDelete = (id: string) => {
    const next = leads.filter(l => l.id !== id)
    setLeads(next); saveLeads(next)
  }

  const openEdit = (lead: Lead) => {
    setEditLead(lead); setEditStage(lead.stage); setEditNotes(lead.notes ?? '')
    setEditTicket(lead.estimatedTicket ? String(lead.estimatedTicket) : '')
    setEditInstagram(lead.instagram ?? ''); setEditPhone(lead.phone ?? '')
    setEditFollowUp(lead.followUpAt ? new Date(lead.followUpAt).toISOString().slice(0, 10) : '')
    setEditName(lead.name)
  }

  const confirmEdit = () => {
    if (!editLead) return
    const next = leads.map(l => l.id === editLead.id ? {
      ...l, name: editName || l.name, stage: editStage, notes: editNotes || undefined,
      estimatedTicket: editTicket ? Number(editTicket) : undefined,
      instagram: editInstagram || undefined, phone: editPhone || l.phone,
      followUpAt: editFollowUp ? new Date(editFollowUp).getTime() : undefined,
      updatedAt: Date.now(),
    } : l)
    setLeads(next); saveLeads(next); setEditLead(null)
  }

  const addManualLead = () => {
    const newLead: Lead = {
      id: crypto.randomUUID(), name: 'Novo lead', address: '',
      stage: 'contato', addedAt: Date.now(), updatedAt: Date.now(), source: 'manual',
    }
    const next = [...leads, newLead]; setLeads(next); saveLeads(next); openEdit(newLead)
  }

  // ── AI Pitch ──────────────────────────────────────────────

  const handleGeneratePitch = useCallback(async (lead: Lead) => {
    setPitchLead(lead); setPitchText(''); setPitchLoading(true); setPitchCopied(false)
    try {
      const gastro = isGastronomico(lead)
      const gastroContext = gastro ? `
Contexto específico do setor gastronômico:
- Restaurantes e bares dependem MUITO de fotos e vídeos apetitosos para atrair clientes
- Reels de bastidores de cozinha e preparo de pratos geram enorme engajamento
- Cardápios digitais e promoções de almoço/happy hour têm alto retorno nas redes
- Stories de reservas abertas e lotação são prova social poderosa
- Clientes decidem onde comer pelo que veem no Instagram — a presença digital é o cardápio digital deles
- Mencione especificamente o potencial de mostrar o ambiente, pratos e bastidores
` : ''
      const prompt = `Você é um vendedor B2B da Digital Scale, agência de marketing digital. Gere uma mensagem de abordagem via WhatsApp/Instagram DM para o seguinte prospect:

Negócio: ${lead.name}
Endereço: ${lead.address || 'não informado'}
Categoria: ${lead.category || 'não informado'}
${lead.rating ? `Avaliação Google: ${lead.rating.toFixed(1)} estrelas (${lead.ratingsTotal ?? 0} avaliações)` : ''}
${lead.notes ? `Observações: ${lead.notes}` : ''}
${gastroContext}
SOBRE A DIGITAL SCALE:
- Serviço principal: gestão de redes sociais (captação de conteúdo + edição de vídeo) — planos de R$800 a R$3.000/mês
- Diferencial: equipe que vai ao local fazer as fotos e vídeos, o cliente não precisa fazer nada
- Upgrade opcional: gestão de tráfego pago (Meta Ads + Google Ads) para quem quer crescer mais rápido
- Foco em negócios locais que querem mais clientes pelas redes

Requisitos da mensagem:
- Curta (máx 5 linhas), pessoal e direta
- Mencione algo específico do negócio (avaliação, categoria, localização)
- Mostre que entende o desafio: falta de tempo ou habilidade para produzir conteúdo${gastro ? ' — foque em como um restaurante precisa de fotos e vídeos apetitosos para atrair clientes' : ''}
- Ofereça uma conversa rápida/reunião sem pressão
- Tom descontraído, sem formalismo, sem emojis excessivos (máx 2)
- Em português brasileiro
- Assine como "Digital Scale"
${agencyWA ? `- Termine com: "Responda aqui ou chame no WhatsApp: wa.me/55${agencyWA.replace(/\D/g, '')}"` : ''}

Retorne APENAS o texto da mensagem, sem explicações.`

      const anthropicKey = localStorage.getItem('sm_anthropic_key') ?? ''
      const aiHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (anthropicKey) aiHeaders['X-Anthropic-Key'] = anthropicKey
      const res = await fetch('/api/ai', {
        method: 'POST', headers: aiHeaders,
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json() as { content?: { text: string }[]; choices?: { message: { content: string } }[] }
      const reply = data.content?.[0]?.text ?? data.choices?.[0]?.message?.content ?? ''
      setPitchText(reply.trim() || 'Erro ao gerar pitch.')
    } catch { setPitchText('Erro de conexão. Tente novamente.') }
    finally { setPitchLoading(false) }
  }, [])

  const handlePitchForPlace = useCallback((place: ApifyPlace) => {
    handleGeneratePitch({
      id: place.placeId ?? place.title ?? crypto.randomUUID(),
      name: place.title ?? 'Lead',
      address: place.address ?? '',
      category: place.category ?? place.categoryName,
      rating: place.rating,
      ratingsTotal: place.reviewsCount,
      phone: place.phone,
      notes: place.description,
      stage: 'contato',
      addedAt: Date.now(),
      updatedAt: Date.now(),
      source: 'manual',
    })
  }, [handleGeneratePitch])

  // ── Batch pitch ───────────────────────────────────────────

  const handleBatchPitch = useCallback(async () => {
    const selected = apifyResults.filter(p => {
      const key = p.placeId || p.title || ''
      return apifySelected.has(key)
    })
    if (selected.length === 0) return

    setBatchOpen(true)
    setBatchLoading(true)
    setBatchProgress(0)
    setBatchPitches(selected.map(p => ({ place: p, text: '', copied: false })))

    const anthropicKey = localStorage.getItem('sm_anthropic_key') ?? ''

    for (let i = 0; i < selected.length; i++) {
      const place = selected[i]
      setBatchProgress(i + 1)

      try {
        const lead: Lead = {
          id: place.title ?? '', name: place.title ?? 'Lead',
          address: place.address ?? '', category: place.category ?? place.categoryName,
          rating: place.rating, ratingsTotal: place.reviewsCount,
          phone: place.phone, notes: place.description,
          stage: 'contato', addedAt: Date.now(), updatedAt: Date.now(), source: 'manual',
        }
        const gastro = isGastronomico(lead)
        const gastroContext = gastro ? `\nContexto: restaurantes precisam de fotos e vídeos apetitosos para atrair clientes.` : ''
        const prompt = `Você é vendedor B2B da Digital Scale, agência de marketing digital.

Negócio: ${lead.name}
Endereço: ${lead.address || 'não informado'}
Categoria: ${lead.category || 'não informado'}
${lead.rating ? `Avaliação: ${lead.rating.toFixed(1)} estrelas` : ''}
${gastroContext}
SOBRE A DIGITAL SCALE:
- Gestão de redes sociais (captação + edição de vídeo) — R$800 a R$3.000/mês
- Equipe vai ao local fazer as fotos/vídeos, o cliente não faz nada
- Upgrade opcional: tráfego pago (Meta Ads)

Requisitos:
- Mensagem curta (máx 5 linhas), pessoal e direta
- Mencione algo específico do negócio
- Tom descontraído, sem formalismo, máx 2 emojis
- Em português brasileiro
- Assine como "Digital Scale"
${agencyWA ? `- Termine com: "Chame no WhatsApp: wa.me/55${agencyWA.replace(/\D/g, '')}"` : ''}

Retorne APENAS o texto da mensagem, sem explicações.`

        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (anthropicKey) headers['X-Anthropic-Key'] = anthropicKey
        const res = await fetch('/api/ai', {
          method: 'POST', headers,
          body: JSON.stringify({ system: '', messages: [{ role: 'user', content: prompt }] }),
        })
        const data = await res.json() as { content?: { text: string }[] }
        const text = data.content?.[0]?.text?.trim() ?? 'Erro ao gerar pitch.'
        setBatchPitches(prev => prev.map((p, idx) => idx === i ? { ...p, text } : p))
      } catch {
        setBatchPitches(prev => prev.map((p, idx) => idx === i ? { ...p, text: 'Erro ao gerar. Tente novamente.' } : p))
      }
    }
    setBatchLoading(false)
  }, [apifyResults, apifySelected, agencyWA])

  // ── Stats ─────────────────────────────────────────────────

  const pipelineStats = useMemo((): Partial<Record<LeadStage, number>> & { totalTicket: number; potentialTicket: number; conversions: { label: string; rate: number; color: string }[] } => {
    const counts: Partial<Record<LeadStage, number>> = {}
    PIPELINE_STAGES.forEach(s => { counts[s.key] = leads.filter(l => l.stage === s.key).length })
    const totalTicket = leads.filter(l => l.stage === 'fechado').reduce((acc, l) => acc + (l.estimatedTicket ?? 0), 0)
    const potentialTicket = leads.filter(l => l.stage !== 'perdido').reduce((acc, l) => acc + (l.estimatedTicket ?? 0), 0)
    const contato  = counts['contato']  ?? 0
    const reuniao  = counts['reuniao']  ?? 0
    const proposta = counts['proposta'] ?? 0
    const fechado  = counts['fechado']  ?? 0
    const activeTotal = leads.filter(l => l.stage !== 'perdido').length
    const conversions = [
      { label: 'Contato→Reunião', rate: contato > 0 ? Math.round((reuniao / (contato + reuniao + proposta + fechado)) * 100) : 0, color: '#60A5FA' },
      { label: 'Reunião→Proposta', rate: reuniao > 0 ? Math.round((proposta / Math.max(reuniao + proposta + fechado, 1)) * 100) : 0, color: '#F59E0B' },
      { label: 'Proposta→Fechado', rate: proposta > 0 ? Math.round((fechado / Math.max(proposta + fechado, 1)) * 100) : 0, color: '#00C47A' },
      { label: 'Taxa geral', rate: activeTotal > 0 ? Math.round((fechado / activeTotal) * 100) : 0, color: '#3B82F6' },
    ]
    return { ...counts, totalTicket, potentialTicket, conversions }
  }, [leads])

  const sortedLeadsByStage = useMemo(() => {
    const sorter = (a: Lead, b: Lead): number => {
      if (sortKey === 'score') return calcScore(b) - calcScore(a)
      if (sortKey === 'ticket') return (b.estimatedTicket ?? 0) - (a.estimatedTicket ?? 0)
      if (sortKey === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      return b.addedAt - a.addedAt
    }
    const byStage: Partial<Record<LeadStage, Lead[]>> = {}
    PIPELINE_STAGES.forEach(s => {
      byStage[s.key] = leads.filter(l => l.stage === s.key).sort(sorter)
    })
    return byStage
  }, [leads, sortKey])

  const overdueCount = useMemo(() =>
    leads.filter(l => l.followUpAt && new Date(l.followUpAt) < new Date()).length, [leads])

  // ── Render ────────────────────────────────────────────────

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <Box sx={{ px: 2, py: 1.2, borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: 'primary.main' }}>🔍 Prospecção</Typography>

        {/* KPI mini */}
        {leads.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {PIPELINE_STAGES.slice(0, 4).map(s => (
              <Box key={s.key} sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{pipelineStats[s.key] ?? 0}</Typography>
                <Typography sx={{ fontSize: '0.42rem', color: 'text.disabled', textTransform: 'uppercase' }}>{s.label}</Typography>
              </Box>
            ))}
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(255,255,255,0.08)' }} />
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#00C47A', lineHeight: 1 }}>
                R$ {(pipelineStats.potentialTicket || 0).toLocaleString('pt-BR')}
              </Typography>
              <Typography sx={{ fontSize: '0.42rem', color: 'text.disabled', textTransform: 'uppercase' }}>Potencial/mês</Typography>
            </Box>
            {overdueCount > 0 && (
              <Chip label={`⚠️ ${overdueCount} retorno${overdueCount > 1 ? 's' : ''} atrasado${overdueCount > 1 ? 's' : ''}`}
                size="small" sx={{ height: 18, fontSize: '0.52rem', bgcolor: 'rgba(255,69,69,0.15)', color: '#FF4545', border: '1px solid rgba(255,69,69,0.3)' }} />
            )}
          </Box>
        )}

        <Box sx={{ flex: 1 }} />

        {/* View toggle */}
        <Box sx={{ display: 'flex', borderRadius: 1.5, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          {(['search', 'pipeline'] as const).map(v => (
            <Box key={v} onClick={() => setView(v)} sx={{
              px: 1.4, py: 0.5, cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
              bgcolor: view === v ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: view === v ? 'primary.main' : 'rgba(255,255,255,0.28)',
              borderRight: v === 'search' ? '1px solid rgba(255,255,255,0.08)' : 'none',
              transition: 'all 0.15s',
            }}>
              {v === 'search' ? '🔍 Buscar' : `📋 Pipeline (${leads.length})`}
            </Box>
          ))}
        </Box>

        {/* WhatsApp da agência */}
        {waInput ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TextField size="small" placeholder="11999998888" value={agencyWA}
              onChange={e => setAgencyWA(e.target.value)}
              onBlur={() => { localStorage.setItem('sm_agency_wa', agencyWA); setWaInput(false) }}
              onKeyDown={e => { if (e.key === 'Enter') { localStorage.setItem('sm_agency_wa', agencyWA); setWaInput(false) } }}
              autoFocus
              sx={{ width: 130, '& .MuiInputBase-root': { fontSize: '0.65rem', height: 26 } }} />
          </Box>
        ) : (
          <Tooltip title={agencyWA ? 'WhatsApp da agência configurado' : 'Configurar WhatsApp da agência (aparece no pitch)'}>
            <Box onClick={() => setWaInput(true)} sx={{
              display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, borderRadius: 1.5, cursor: 'pointer',
              border: `1px solid ${agencyWA ? 'rgba(37,211,102,0.4)' : 'rgba(96,165,250,0.5)'}`,
              bgcolor: agencyWA ? 'rgba(37,211,102,0.08)' : 'rgba(96,165,250,0.08)',
              '&:hover': { opacity: 0.8 },
            }}>
              <WhatsAppIcon sx={{ fontSize: 10, color: agencyWA ? '#25D366' : '#60A5FA' }} />
              <Typography sx={{ fontSize: '0.52rem', color: agencyWA ? '#25D366' : '#60A5FA', fontWeight: 800 }}>
                {agencyWA ? `WA ✓` : 'Seu WA'}
              </Typography>
            </Box>
          </Tooltip>
        )}

        {/* Claude status */}
        {(() => {
          const hasKey = !!localStorage.getItem('sm_anthropic_key')
          return (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, borderRadius: 1.5,
              border: `1px solid ${hasKey ? 'rgba(0,196,122,0.4)' : 'rgba(96,165,250,0.5)'}`,
              bgcolor: hasKey ? 'rgba(0,196,122,0.08)' : 'rgba(96,165,250,0.08)',
            }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: hasKey ? '#00C47A' : '#60A5FA' }} />
              <Typography sx={{ fontSize: '0.52rem', color: hasKey ? '#00C47A' : '#60A5FA', fontWeight: 800 }}>
                {hasKey ? 'Claude ✓' : 'Sem chave IA'}
              </Typography>
            </Box>
          )
        })()}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ═══ SEARCH VIEW ═══ */}
        {view === 'search' && (
          <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

            {!localStorage.getItem('sm_anthropic_key') && (
              <Alert severity="warning" sx={{ fontSize: '0.72rem' }}>
                Configure sua chave Anthropic na aba <strong>IA Operacional</strong> para usar a busca de leads.
              </Alert>
            )}

            {/* Quick templates */}
            <Box>
              <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', mb: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                🍖 Gastronômico
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap', mb: 1.2 }}>
                {SEARCH_TEMPLATES.filter(t => t.group === 'gastro').map(t => (
                  <Chip key={t.q} label={t.label} size="small" onClick={() => setApifyQuery(t.q)}
                    sx={{
                      height: 22, fontSize: '0.6rem', cursor: 'pointer',
                      bgcolor: apifyQuery === t.q ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.06)',
                      color: apifyQuery === t.q ? '#3B82F6' : 'rgba(59,130,246,0.6)',
                      border: `1px solid ${apifyQuery === t.q ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.15)'}`,
                      '&:hover': { bgcolor: 'rgba(59,130,246,0.12)', color: '#3B82F6' },
                    }} />
                ))}
              </Box>
              <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', mb: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Outros segmentos
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap' }}>
                {SEARCH_TEMPLATES.filter(t => t.group === 'outros').map(t => (
                  <Chip key={t.q} label={t.label} size="small" onClick={() => setApifyQuery(t.q)}
                    sx={{
                      height: 22, fontSize: '0.6rem', cursor: 'pointer',
                      bgcolor: apifyQuery === t.q ? 'rgba(0,196,122,0.15)' : 'rgba(255,255,255,0.04)',
                      color: apifyQuery === t.q ? '#00C47A' : 'text.secondary',
                      border: `1px solid ${apifyQuery === t.q ? 'rgba(0,196,122,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      '&:hover': { bgcolor: 'rgba(0,196,122,0.08)', color: '#00C47A' },
                    }} />
                ))}
              </Box>
            </Box>

            {/* Search form */}
            <Paper sx={{ p: 2, border: '1px solid rgba(0,196,122,0.12)', bgcolor: 'rgba(0,196,122,0.03)', borderRadius: 2.5 }}>
              {/* Toggle de modo */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Box sx={{ display: 'flex', borderRadius: 1.5, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {(['ai', 'real'] as const).map(mode => (
                    <Box key={mode} onClick={() => { setSearchMode(mode); setApifyResults([]); setApifyError('') }}
                      sx={{
                        px: 1.5, py: 0.5, cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700, transition: 'all 0.15s',
                        bgcolor: searchMode === mode ? 'rgba(0,196,122,0.15)' : 'transparent',
                        color: searchMode === mode ? '#00C47A' : 'rgba(255,255,255,0.3)',
                        '&:hover': { bgcolor: 'rgba(0,196,122,0.08)' },
                      }}>
                      {mode === 'ai' ? '✨ Sugestões IA' : '🗺️ Google Maps Real'}
                    </Box>
                  ))}
                </Box>
                {searchMode === 'real' && (
                  <Tooltip title={apifyKey ? 'Token Apify configurado ✓' : 'Configurar token Apify (console.apify.com)'}>
                    <Box onClick={() => { setApifyKeyInput(apifyKey); setApifyKeyOpen(true) }} sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, borderRadius: 1.5, cursor: 'pointer',
                      border: `1px solid ${apifyKey ? 'rgba(0,196,122,0.4)' : 'rgba(96,165,250,0.5)'}`,
                      bgcolor: apifyKey ? 'rgba(0,196,122,0.08)' : 'rgba(96,165,250,0.08)',
                      '&:hover': { opacity: 0.8 },
                    }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: apifyKey ? '#00C47A' : '#60A5FA' }} />
                      <Typography sx={{ fontSize: '0.52rem', color: apifyKey ? '#00C47A' : '#60A5FA', fontWeight: 800 }}>
                        {apifyKey ? 'Apify ✓' : 'Apify'}
                      </Typography>
                    </Box>
                  </Tooltip>
                )}
                {searchMode === 'ai' && (
                  <Chip label="Sugestões instantâneas · sem API externa" size="small"
                    sx={{ height: 16, fontSize: '0.5rem', bgcolor: 'rgba(0,196,122,0.12)', color: '#00C47A', border: '1px solid rgba(0,196,122,0.2)' }} />
                )}
                {searchMode === 'real' && (
                  <Chip label="Telefone + email + Instagram reais" size="small"
                    sx={{ height: 16, fontSize: '0.5rem', bgcolor: 'rgba(0,196,122,0.12)', color: '#00C47A', border: '1px solid rgba(0,196,122,0.2)' }} />
                )}
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
                <TextField
                  placeholder="Ex: restaurante em Sorocaba SP, padaria em Atibaia..."
                  size="small" value={apifyQuery} onChange={e => setApifyQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !apifyRunning && startApifyRun()}
                  sx={{
                    flex: 1, minWidth: 240,
                    '& .MuiInputBase-root': { fontSize: '0.75rem', bgcolor: 'rgba(255,255,255,0.04)' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
                  }}
                  slotProps={{ input: { startAdornment: <SearchIcon sx={{ fontSize: 16, color: '#00C47A', mr: 0.5 }} /> } }}
                />
                <TextField
                  label="Máx" size="small" type="number" value={apifyMax}
                  onChange={e => setApifyMax(e.target.value)}
                  sx={{ width: 80, '& .MuiInputBase-root': { fontSize: '0.75rem' } }}
                  slotProps={{ htmlInput: { min: 5, max: 100, step: 5 } }}
                />
                <Button
                  variant="contained"
                  onClick={searchMode === 'ai' ? startApifyRun : startRealSearch}
                  disabled={apifyRunning || !apifyQuery.trim() || (searchMode === 'real' && !apifyKey)}
                  startIcon={apifyRunning ? <CircularProgress size={13} color="inherit" /> : searchMode === 'ai' ? <AutoAwesomeIcon sx={{ fontSize: 16 }} /> : <CloudDownloadIcon sx={{ fontSize: 16 }} />}
                  sx={{ fontWeight: 800, background: 'linear-gradient(135deg, #00C47A, #00a06a)', color: '#000', px: 2, whiteSpace: 'nowrap' }}
                >
                  {apifyRunning ? (searchMode === 'real' ? 'Extraindo…' : 'Gerando…') : (searchMode === 'ai' ? 'Gerar leads' : 'Extrair')}
                </Button>
              </Box>

              <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', lineHeight: 1.6 }}>
                💡 Claude gera sugestões de leads em segundos. Use como ponto de partida para pesquisar e abordar.
              </Typography>
            </Paper>

            {/* Progress */}
            {apifyRunning && (
              <Paper sx={{ p: 2, border: '1px solid rgba(0,196,122,0.15)', bgcolor: 'rgba(0,196,122,0.04)', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CircularProgress size={14} sx={{ color: '#00C47A' }} />
                  <Typography sx={{ fontSize: '0.72rem', color: '#00C47A', fontWeight: 700 }}>
                    {searchMode === 'real' ? 'Extraindo dados do Google Maps…' : 'Gerando leads com Claude…'}
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={apifyProgress}
                  sx={{ height: 5, borderRadius: 3, bgcolor: 'rgba(0,196,122,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#00C47A' } }} />
                <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', mt: 0.5 }}>
                  {searchMode === 'real' ? 'Aguardando Apify processar… pode levar 1-3 minutos.' : 'Claude está gerando sugestões de leads…'}
                </Typography>
              </Paper>
            )}

            {apifyError && <Alert severity="error" sx={{ fontSize: '0.72rem' }}>{apifyError}</Alert>}

            {/* Results */}
            {apifyResults.length > 0 && !apifyRunning && (
              <>
                <Paper sx={{ p: 1.5, border: '1px solid rgba(255,255,255,0.07)', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>
                    ✨ {apifyResults.length} lead{apifyResults.length !== 1 ? 's' : ''} gerado{apifyResults.length !== 1 ? 's' : ''} por IA
                  </Typography>
                  <Chip label={`${apifySelected.size} selecionado${apifySelected.size !== 1 ? 's' : ''}`} size="small"
                    sx={{ height: 18, fontSize: '0.55rem', bgcolor: 'rgba(0,196,122,0.12)', color: '#00C47A', border: '1px solid rgba(0,196,122,0.25)' }} />
                  <Box sx={{ flex: 1 }} />
                  <Button size="small" startIcon={<SelectAllIcon sx={{ fontSize: 13 }} />}
                    onClick={() => {
                      const existing = new Set(leads.map(l => l.placeId).filter(Boolean) as string[])
                      setApifySelected(new Set(apifyResults.filter(p => !existing.has(p.placeId ?? '')).map(p => p.placeId || p.title || '')))
                    }}
                    sx={{ fontSize: '0.6rem', color: 'text.secondary', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1.5, px: 1, py: 0.3 }}>
                    Todos
                  </Button>
                  <Button size="small" onClick={() => setApifySelected(new Set())}
                    sx={{ fontSize: '0.6rem', color: 'text.secondary', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1.5, px: 1, py: 0.3 }}>
                    Nenhum
                  </Button>
                  <Button variant="contained" size="small"
                    startIcon={<PersonAddIcon sx={{ fontSize: 13 }} />}
                    disabled={apifySelected.size === 0}
                    onClick={importApifySelected}
                    sx={{ fontWeight: 800, fontSize: '0.65rem', background: 'linear-gradient(135deg,#00C47A,#00a06a)', color: '#000', px: 1.5 }}>
                    Importar {apifySelected.size > 0 ? `(${apifySelected.size})` : ''}
                  </Button>

                  <Button variant="contained" size="small"
                    startIcon={<AutoAwesomeIcon sx={{ fontSize: 13 }} />}
                    disabled={apifySelected.size === 0 || batchLoading}
                    onClick={handleBatchPitch}
                    sx={{ fontWeight: 800, fontSize: '0.65rem', background: 'linear-gradient(135deg,#b45aff,#7c3aed)', color: '#fff', px: 1.5 }}>
                    Gerar pitches {apifySelected.size > 0 ? `(${apifySelected.size})` : ''}
                  </Button>
                </Paper>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 1.2 }}>
                  {apifyResults.map((place, i) => {
                    const key = place.placeId || place.title || String(i)
                    return (
                      <ApifyResultCard
                        key={key} place={place}
                        selected={apifySelected.has(key)}
                        onToggle={toggleApifySelect}
                        alreadyInPipeline={leads.some(l => l.placeId && l.placeId === place.placeId)}
                        onPitch={handlePitchForPlace}
                      />
                    )
                  })}
                </Box>
              </>
            )}
          </Box>
        )}

        {/* ═══ PIPELINE KANBAN VIEW ═══ */}
        {view === 'pipeline' && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Pipeline sub-header */}
            <Box sx={{ px: 2, py: 1, borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>

              {/* Funnel bar */}
              {leads.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, flex: 1, minWidth: 200 }}>
                  {PIPELINE_STAGES.filter(s => s.key !== 'perdido').map((s, i, arr) => {
                    const cnt = pipelineStats[s.key] ?? 0
                    const pct = leads.length > 0 ? (cnt / leads.length) * 100 : 0
                    return (
                      <Tooltip key={s.key} title={`${s.label}: ${cnt} lead${cnt !== 1 ? 's' : ''}`}>
                        <Box sx={{
                          flex: Math.max(pct, 3), height: 6, bgcolor: s.color,
                          borderRadius: i === 0 ? '3px 0 0 3px' : i === arr.length - 1 ? '0 3px 3px 0' : 0,
                          opacity: 0.7 + (i * 0.06), transition: 'flex 0.6s ease',
                          cursor: 'default',
                        }} />
                      </Tooltip>
                    )
                  })}
                </Box>
              )}

              {/* Conversion rates */}
              {leads.length > 2 && (
                <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {pipelineStats.conversions.map(c => (
                    <Tooltip key={c.label} title={c.label}>
                      <Box sx={{ textAlign: 'center', px: 0.8, py: 0.3, borderRadius: 1, bgcolor: `${c.color}10`, border: `1px solid ${c.color}25` }}>
                        <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color: c.color, lineHeight: 1 }}>{c.rate}%</Typography>
                        <Typography sx={{ fontSize: '0.42rem', color: 'text.disabled', lineHeight: 1.2 }}>{c.label.split('→')[1] ?? 'Geral'}</Typography>
                      </Box>
                    </Tooltip>
                  ))}
                </Box>
              )}

              {/* Sort control */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <SortIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                <ToggleButtonGroup value={sortKey} exclusive onChange={(_, v) => v && setSortKey(v)} size="small">
                  {([
                    { key: 'score', label: 'Score' },
                    { key: 'ticket', label: 'Ticket' },
                    { key: 'rating', label: 'Rating' },
                    { key: 'date', label: 'Data' },
                  ] as { key: SortKey; label: string }[]).map(o => (
                    <ToggleButton key={o.key} value={o.key} sx={{
                      px: 1, py: 0.2, fontSize: '0.55rem', fontWeight: 700,
                      color: sortKey === o.key ? 'primary.main' : 'text.disabled',
                      borderColor: 'rgba(255,255,255,0.1)',
                      '&.Mui-selected': { bgcolor: 'rgba(59,130,246,0.12)', color: 'primary.main' },
                    }}>
                      {o.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>

              <Button size="small" startIcon={<AddIcon sx={{ fontSize: 13 }} />} onClick={addManualLead}
                sx={{ fontSize: '0.6rem', border: '1px solid rgba(59,130,246,0.3)', color: 'primary.main', borderRadius: 2, px: 1.2, py: 0.3, '&:hover': { bgcolor: 'rgba(59,130,246,0.08)' } }}>
                Adicionar
              </Button>
            </Box>

            {/* Horizontal Kanban — DnD */}
            <DndContext
              sensors={sensors}
              onDragStart={handlePipelineDragStart}
              onDragOver={handlePipelineDragOver}
              onDragEnd={handlePipelineDragEnd}
            >
            <Box sx={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: 1.5, p: 1.5, alignItems: 'flex-start' }}>
              {PIPELINE_STAGES.map(s => {
                const stageLeads = sortedLeadsByStage[s.key] ?? []
                const stageTicket = stageLeads.reduce((sum, l) => sum + (l.estimatedTicket ?? 0), 0)
                const stageOverdue = stageLeads.filter(l => l.followUpAt && new Date(l.followUpAt) < new Date()).length

                return (
                  <Box key={s.key} sx={{ flex: '0 0 250px', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
                    {/* Column header */}
                    <Box sx={{
                      borderRadius: 2,
                      bgcolor: overStage === s.key ? `${s.color}18` : `${s.color}0c`,
                      border: `1px solid ${overStage === s.key ? `${s.color}55` : `${s.color}25`}`,
                      flexShrink: 0, mb: 1, overflow: 'hidden',
                      transition: 'all 0.15s',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, px: 1.2, py: 0.8 }}>
                        <Typography sx={{ fontSize: '0.82rem' }}>{s.emoji}</Typography>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: s.color, lineHeight: 1 }} noWrap>{s.label}</Typography>
                          {stageTicket > 0 && (
                            <Typography sx={{ fontSize: '0.5rem', color: '#00C47A', lineHeight: 1.2 }}>R$ {stageTicket.toLocaleString('pt-BR')}/mês</Typography>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                          {stageOverdue > 0 && (
                            <Box sx={{ width: 14, height: 14, borderRadius: 7, bgcolor: 'rgba(255,69,69,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Typography sx={{ fontSize: '0.45rem', color: '#FF4545', fontWeight: 900 }}>{stageOverdue}</Typography>
                            </Box>
                          )}
                          <Box sx={{ minWidth: 18, height: 18, borderRadius: 3, bgcolor: `${s.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5 }}>
                            <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: s.color }}>{stageLeads.length}</Typography>
                          </Box>
                        </Box>
                      </Box>
                      {/* Progress bar (% of total leads) */}
                      <Box sx={{ height: 2, bgcolor: 'rgba(255,255,255,0.05)' }}>
                        <Box sx={{
                          height: '100%', bgcolor: s.color, opacity: 0.7,
                          width: leads.length > 0 ? `${(stageLeads.length / leads.length) * 100}%` : '0%',
                          transition: 'width 0.6s ease',
                        }} />
                      </Box>
                    </Box>

                    {/* Cards */}
                    <DroppableStageColumn stageKey={s.key} isOver={overStage === s.key}>
                      <Box sx={{ overflowY: 'auto', flex: 1 }}>
                        {stageLeads.length === 0 ? (
                          <Box sx={{ py: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8 }}>
                            <Typography sx={{ fontSize: '1.4rem', opacity: 0.3 }}>{s.emoji}</Typography>
                            <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', opacity: 0.4 }}>{s.hint}</Typography>
                          </Box>
                        ) : (
                          stageLeads.map(lead => (
                            <DraggableLeadCard key={lead.id} lead={lead}>
                              <LeadCard lead={lead} compact
                                onStageChange={handleStageChange} onDelete={handleDelete}
                                onEdit={openEdit} onGeneratePitch={handleGeneratePitch} />
                            </DraggableLeadCard>
                          ))
                        )}
                      </Box>
                    </DroppableStageColumn>
                  </Box>
                )
              })}
            </Box>

            {/* Drag overlay */}
            <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
              {activeLead ? (
                <Box sx={{ opacity: 0.92, pointerEvents: 'none', width: 250 }}>
                  <LeadCard lead={activeLead} compact
                    onStageChange={() => {}} onDelete={() => {}}
                    onEdit={() => {}} onGeneratePitch={() => {}} />
                </Box>
              ) : null}
            </DragOverlay>
            </DndContext>
          </Box>
        )}
      </Box>

      {/* ── Apify Key dialog ── */}
      <Dialog open={apifyKeyOpen} onClose={() => setApifyKeyOpen(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,196,122,0.2)' } } }}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <KeyIcon sx={{ color: '#00C47A', fontSize: 20 }} />
            <Typography fontWeight={800}>Token Apify — Google Maps Real</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="info" sx={{ fontSize: '0.7rem' }}>
            Acesse <strong>console.apify.com</strong> → Settings → Integrations → copie o <strong>Default API token</strong>.
            Plano gratuito: ~200 extrações/mês. Sem cartão de crédito.
          </Alert>
          <TextField fullWidth size="small" label="Apify API Token"
            value={apifyKeyInput} onChange={e => setApifyKeyInput(e.target.value)}
            placeholder="apify_api_..." type="password" autoFocus />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setApifyKeyOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveApifyKey} disabled={!apifyKeyInput.trim()}
            sx={{ fontWeight: 700, background: 'linear-gradient(135deg,#00C47A,#00a06a)', color: '#000' }}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Batch pitch dialog ── */}
      <Dialog open={batchOpen} onClose={() => !batchLoading && setBatchOpen(false)} maxWidth="md" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(10,10,10,0.99)', backdropFilter: 'blur(24px)', border: '1px solid rgba(180,90,255,0.25)', borderRadius: 3, maxHeight: '90vh' } } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AutoAwesomeIcon sx={{ color: '#b45aff', fontSize: 20 }} />
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>Pitches em lote</Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                {batchLoading
                  ? `Gerando ${batchProgress}/${batchPitches.length}…`
                  : `${batchPitches.filter(p => p.text && !p.text.startsWith('Erro')).length} de ${batchPitches.length} gerados`}
              </Typography>
            </Box>
            {!batchLoading && (
              <Button size="small" onClick={() => setBatchOpen(false)}
                sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>Fechar</Button>
            )}
          </Box>
          {batchLoading && (
            <LinearProgress variant="determinate" value={(batchProgress / batchPitches.length) * 100}
              sx={{ mt: 1, height: 3, borderRadius: 2, bgcolor: 'rgba(180,90,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#b45aff' } }} />
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {batchPitches.map((bp, i) => (
            <Box key={i} sx={{ p: 1.8, borderRadius: 2, bgcolor: 'rgba(180,90,255,0.05)', border: '1px solid rgba(180,90,255,0.15)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', flex: 1 }}>
                  {bp.place.title}
                </Typography>
                {bp.place.category && (
                  <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', bgcolor: 'rgba(255,255,255,0.06)', px: 0.8, py: 0.2, borderRadius: 1 }}>
                    {bp.place.category}
                  </Typography>
                )}
              </Box>

              {!bp.text ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                  <CircularProgress size={14} sx={{ color: '#b45aff' }} />
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>Gerando…</Typography>
                </Box>
              ) : (
                <>
                  <Typography sx={{ fontSize: '0.78rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap', mb: 1.2 }}>
                    {bp.text}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.8 }}>
                    <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 12 }} />}
                      onClick={() => {
                        navigator.clipboard.writeText(bp.text)
                        setBatchPitches(prev => prev.map((p, idx) => idx === i ? { ...p, copied: true } : p))
                        setTimeout(() => setBatchPitches(prev => prev.map((p, idx) => idx === i ? { ...p, copied: false } : p)), 2000)
                      }}
                      sx={{ fontSize: '0.6rem', color: bp.copied ? '#00C47A' : '#b45aff', border: `1px solid ${bp.copied ? 'rgba(0,196,122,0.3)' : 'rgba(180,90,255,0.3)'}`, borderRadius: 1.5, px: 1 }}>
                      {bp.copied ? 'Copiado!' : 'Copiar'}
                    </Button>
                    {bp.place.instagram && (
                      <Button size="small"
                        onClick={() => {
                          const q = encodeURIComponent(`${bp.place.title} ${bp.place.address?.split(',').pop()?.trim() ?? ''} instagram`)
                          window.open(`https://www.google.com/search?q=${q}`, '_blank', 'noopener')
                        }}
                        startIcon={<Box component="span" sx={{ fontSize: '0.75rem', lineHeight: 1 }}>🔍</Box>}
                        sx={{ fontSize: '0.6rem', color: '#E1306C', border: '1px solid rgba(225,48,108,0.3)', borderRadius: 1.5, px: 1 }}>
                        Buscar Instagram
                      </Button>
                    )}
                    {bp.place.phone && (
                      <Button size="small" component="a"
                        href={`https://wa.me/55${bp.place.phone.replace(/\D/g,'')}?text=${encodeURIComponent(bp.text)}`}
                        target="_blank" rel="noopener"
                        startIcon={<WhatsAppIcon sx={{ fontSize: 12 }} />}
                        sx={{ fontSize: '0.6rem', color: '#25D366', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 1.5, px: 1 }}>
                        Enviar no WA
                      </Button>
                    )}
                  </Box>
                </>
              )}
            </Box>
          ))}
        </DialogContent>
        {!batchLoading && batchPitches.some(p => p.text) && (
          <DialogActions sx={{ px: 2, pb: 2 }}>
            <Button size="small" onClick={() => {
              const all = batchPitches.filter(p => p.text).map(p => `${p.place.title}\n${p.text}`).join('\n\n---\n\n')
              navigator.clipboard.writeText(all)
            }} sx={{ fontSize: '0.65rem', color: '#b45aff', border: '1px solid rgba(180,90,255,0.3)', borderRadius: 1.5 }}>
              Copiar todos
            </Button>
          </DialogActions>
        )}
      </Dialog>

      {/* ── Edit lead dialog ── */}
      <Dialog open={!!editLead} onClose={() => setEditLead(null)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' } } }}>
        <DialogTitle>
          <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>✏️ Editar lead</Typography>
          {editLead && <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{editLead.name}</Typography>}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          <TextField label="Nome do negócio" size="small" fullWidth value={editName} onChange={e => setEditName(e.target.value)} />
          <TextField select label="Estágio" size="small" fullWidth value={editStage} onChange={e => setEditStage(e.target.value as LeadStage)}>
            {PIPELINE_STAGES.map(s => <MenuItem key={s.key} value={s.key}>{s.emoji} {s.label}</MenuItem>)}
          </TextField>
          <TextField label="Telefone / WhatsApp" size="small" fullWidth value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="11999999999" />
          <TextField label="Instagram" size="small" fullWidth value={editInstagram} onChange={e => setEditInstagram(e.target.value)} placeholder="@nome_do_negocio" />
          <TextField label="Ticket estimado R$/mês" size="small" fullWidth type="number" value={editTicket} onChange={e => setEditTicket(e.target.value)} />
          <TextField label="Observações" size="small" fullWidth multiline rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)} />
          <TextField label="📅 Data de retorno" size="small" fullWidth type="date"
            value={editFollowUp} onChange={e => setEditFollowUp(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }} />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setEditLead(null)}>Cancelar</Button>
          <Button variant="contained" onClick={confirmEdit} sx={{ fontWeight: 700 }}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* ── Pitch dialog ── */}
      <Dialog open={!!pitchLead} onClose={() => { setPitchLead(null); setPitchText('') }} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(180,90,255,0.25)' } } }}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon sx={{ color: '#b45aff', fontSize: 20 }} />
            <Box>
              <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>Pitch gerado pela IA</Typography>
              {pitchLead && <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{pitchLead.name}</Typography>}
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {pitchLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 1.5 }}>
              <CircularProgress size={28} sx={{ color: '#b45aff' }} />
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Gerando mensagem personalizada…</Typography>
            </Box>
          ) : (
            <Box sx={{ bgcolor: 'rgba(180,90,255,0.06)', border: '1px solid rgba(180,90,255,0.18)', borderRadius: 2, p: 2, mt: 1 }}>
              <Typography sx={{ fontSize: '0.82rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'rgba(255,255,255,0.88)' }}>
                {pitchText}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button onClick={() => { setPitchLead(null); setPitchText('') }}>Fechar</Button>
          {pitchText && pitchLead?.phone && (
            <Button variant="outlined"
              startIcon={<WhatsAppIcon sx={{ fontSize: 14 }} />}
              component="a"
              href={`https://wa.me/55${pitchLead.phone.replace(/\D/g, '')}?text=${encodeURIComponent(pitchText)}`}
              target="_blank" rel="noopener"
              sx={{ borderColor: '#25D366', color: '#25D366', fontWeight: 700, fontSize: '0.75rem' }}>
              Enviar no WA
            </Button>
          )}
          {pitchText && (
            <Button variant="outlined"
              startIcon={pitchCopied ? undefined : <ContentCopyIcon sx={{ fontSize: 14 }} />}
              onClick={() => { navigator.clipboard.writeText(pitchText).catch(() => null); setPitchCopied(true); setTimeout(() => setPitchCopied(false), 2000) }}
              sx={{ borderColor: pitchCopied ? '#00C47A' : '#b45aff', color: pitchCopied ? '#00C47A' : '#b45aff', fontWeight: 700, fontSize: '0.75rem' }}>
              {pitchCopied ? '✓ Copiado!' : 'Copiar'}
            </Button>
          )}
          {pitchLead && !pitchLoading && (
            <Button variant="contained" onClick={() => handleGeneratePitch(pitchLead)}
              sx={{ background: 'linear-gradient(135deg,rgba(180,90,255,0.8),rgba(6,182,212,0.6))', color: '#fff', fontWeight: 700, fontSize: '0.75rem' }}>
              Gerar novamente
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Import snackbar ── */}
      <Snackbar
        open={!!apifyImported} autoHideDuration={4000} onClose={() => setApifyImported('')}
        message={`✅ ${apifyImported}`}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ content: { sx: { bgcolor: '#00C47A', color: '#000', fontWeight: 700, fontSize: '0.8rem' } } }}
      />
    </Box>
  )
}
