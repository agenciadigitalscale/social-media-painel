import { useState, useMemo, useCallback, useRef } from 'react'
import {
  Box, Typography, TextField, Button, Chip, Paper, IconButton,
  Tooltip, CircularProgress, Avatar, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, Divider, LinearProgress, Menu, Alert, Snackbar,
  Checkbox,
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
import type { Lead, LeadStage } from '../types'

// ── Config ────────────────────────────────────────────────

const BUSINESS_TYPES = [
  { key: 'restaurante',   label: '🍽️ Restaurante',   query: 'restaurante',           nicho: 'gastro' },
  { key: 'padaria',       label: '🥖 Padaria',        query: 'padaria',               nicho: 'gastro' },
  { key: 'confeitaria',   label: '🍰 Confeitaria',    query: 'confeitaria',           nicho: 'gastro' },
  { key: 'pizzaria',      label: '🍕 Pizzaria',       query: 'pizzaria',              nicho: 'gastro' },
  { key: 'hamburgueria',  label: '🍔 Hamburgueria',   query: 'hamburgueria',          nicho: 'gastro' },
  { key: 'churrascaria',  label: '🥩 Churrascaria',   query: 'churrascaria',          nicho: 'gastro' },
  { key: 'cafeteria',     label: '☕ Cafeteria',      query: 'cafeteria café',        nicho: 'gastro' },
  { key: 'sushi',         label: '🍱 Sushi/Japonês',  query: 'restaurante japonês',   nicho: 'gastro' },
  { key: 'sorveteria',    label: '🍦 Sorveteria',     query: 'sorveteria',            nicho: 'gastro' },
  { key: 'lanchonete',    label: '🥪 Lanchonete',     query: 'lanchonete',            nicho: 'gastro' },
  { key: 'estetica',      label: '💆 Estética',       query: 'clínica estética',      nicho: 'variados' },
  { key: 'academia',      label: '💪 Academia',       query: 'academia fitness',      nicho: 'variados' },
  { key: 'salon',         label: '💅 Salão',          query: 'salão de beleza',       nicho: 'variados' },
  { key: 'petshop',       label: '🐾 Pet Shop',       query: 'pet shop',              nicho: 'variados' },
  { key: 'imobiliaria',   label: '🏠 Imobiliária',    query: 'imobiliária',           nicho: 'variados' },
  { key: 'pousada',       label: '🏡 Pousada',        query: 'pousada hotel',         nicho: 'variados' },
]

const PIPELINE_STAGES: { key: LeadStage; label: string; color: string; emoji: string }[] = [
  { key: 'contato',  label: 'Contato',  color: '#60A5FA', emoji: '📞' },
  { key: 'reuniao',  label: 'Reunião',  color: '#FFD700', emoji: '🤝' },
  { key: 'proposta', label: 'Proposta', color: '#FF9A3D', emoji: '📋' },
  { key: 'fechado',  label: 'Fechado',  color: '#00C47A', emoji: '✅' },
  { key: 'perdido',  label: 'Perdido',  color: '#FF3B30', emoji: '❌' },
]

// ── Persistence ───────────────────────────────────────────

function loadLeads(): Lead[] {
  try { return JSON.parse(localStorage.getItem('sm_leads') ?? '[]') } catch { return [] }
}
function saveLeads(leads: Lead[]) { localStorage.setItem('sm_leads', JSON.stringify(leads)) }

// ── Place API types ────────────────────────────────────────

interface PlaceRaw {
  place_id: string
  name: string
  formatted_address: string
  rating?: number
  user_ratings_total?: number
  types?: string[]
  photos?: { photo_reference: string }[]
  formatted_phone_number?: string
  website?: string
}

// ── Apify result type ──────────────────────────────────────

interface ApifyPlace {
  title?: string
  address?: string
  phone?: string
  website?: string
  rating?: number
  reviewsCount?: number
  categoryName?: string
  placeId?: string
  instagram?: string
  emails?: string[]
  imageUrl?: string
  totalScore?: number
}

// ── LeadCard ──────────────────────────────────────────────

function LeadCard({
  lead, onStageChange, onDelete, onEdit, onGeneratePitch,
}: {
  lead: Lead
  onStageChange: (id: string, stage: LeadStage) => void
  onDelete: (id: string) => void
  onEdit: (lead: Lead) => void
  onGeneratePitch: (lead: Lead) => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const stage = PIPELINE_STAGES.find(s => s.key === lead.stage)!

  return (
    <Paper elevation={0} sx={{
      p: 1.5, mb: 1, borderRadius: 2,
      border: `1px solid ${stage.color}22`,
      borderLeft: `3px solid ${stage.color}`,
      bgcolor: 'rgba(255,255,255,0.025)',
      '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
      transition: 'all 0.15s',
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.8 }}>
        <Avatar sx={{ width: 32, height: 32, fontSize: '0.7rem', bgcolor: `${stage.color}22`, color: stage.color, flexShrink: 0 }}>
          {lead.name.slice(0, 2).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.78rem', lineHeight: 1.2 }} noWrap>{lead.name}</Typography>
          {lead.category && (
            <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary', lineHeight: 1 }}>{lead.category}</Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.3, flexShrink: 0 }}>
          <IconButton size="small" onClick={() => onEdit(lead)} sx={{ p: 0.3 }}>
            <EditIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }} />
          </IconButton>
          <IconButton size="small" onClick={() => onDelete(lead.id)} sx={{ p: 0.3 }}>
            <DeleteOutlineIcon sx={{ fontSize: 12, color: 'rgba(255,59,48,0.5)' }} />
          </IconButton>
        </Box>
      </Box>

      {/* Info */}
      {lead.address && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.4, mb: 0.4 }}>
          <LocationOnIcon sx={{ fontSize: 10, color: 'text.disabled', mt: 0.2, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.58rem', color: 'text.secondary', lineHeight: 1.4 }}>{lead.address}</Typography>
        </Box>
      )}

      {lead.rating && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mb: 0.6 }}>
          <StarIcon sx={{ fontSize: 10, color: '#FFD700' }} />
          <Typography sx={{ fontSize: '0.6rem', color: '#FFD700', fontWeight: 700 }}>{lead.rating.toFixed(1)}</Typography>
          {lead.ratingsTotal && <Typography sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>({lead.ratingsTotal})</Typography>}
        </Box>
      )}

      {lead.estimatedTicket && (
        <Chip
          icon={<AttachMoneyIcon sx={{ fontSize: '12px !important' }} />}
          label={`R$ ${lead.estimatedTicket.toLocaleString('pt-BR')}/mês`}
          size="small"
          sx={{ height: 18, fontSize: '0.55rem', mb: 0.6, bgcolor: 'rgba(0,196,122,0.12)', color: '#00C47A', border: '1px solid rgba(0,196,122,0.25)' }}
        />
      )}

      {lead.notes && (
        <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', fontStyle: 'italic', mb: 0.6, lineHeight: 1.4 }}>
          "{lead.notes}"
        </Typography>
      )}

      {/* Follow-up badge */}
      {lead.followUpAt && (() => {
        const due = new Date(lead.followUpAt)
        const isOverdue = due < new Date()
        const label = due.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
        return (
          <Chip
            icon={isOverdue ? <NotificationsActiveIcon sx={{ fontSize: '11px !important' }} /> : <EventIcon sx={{ fontSize: '11px !important' }} />}
            label={`Retorno: ${label}`}
            size="small"
            sx={{ height: 18, fontSize: '0.55rem', mb: 0.6,
              bgcolor: isOverdue ? 'rgba(255,69,69,0.15)' : 'rgba(59,142,255,0.12)',
              color: isOverdue ? '#FF4545' : '#3B8EFF',
              border: `1px solid ${isOverdue ? 'rgba(255,69,69,0.3)' : 'rgba(59,142,255,0.25)'}`,
            }}
          />
        )
      })()}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {lead.phone && (
          <Tooltip title={`Ligar: ${lead.phone}`}>
            <IconButton
              size="small"
              component="a" href={`tel:${lead.phone}`}
              sx={{ p: 0.4, bgcolor: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 1 }}
            >
              <PhoneIcon sx={{ fontSize: 12, color: '#25D366' }} />
            </IconButton>
          </Tooltip>
        )}
        {lead.phone && (
          <Tooltip title="WhatsApp">
            <IconButton
              size="small"
              component="a" href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
              sx={{ p: 0.4, bgcolor: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 1 }}
            >
              <WhatsAppIcon sx={{ fontSize: 12, color: '#25D366' }} />
            </IconButton>
          </Tooltip>
        )}
        {lead.website && (
          <Tooltip title="Site">
            <IconButton
              size="small"
              component="a" href={lead.website} target="_blank" rel="noopener"
              sx={{ p: 0.4, bgcolor: 'rgba(59,142,255,0.1)', border: '1px solid rgba(59,142,255,0.2)', borderRadius: 1 }}
            >
              <LanguageIcon sx={{ fontSize: 12, color: '#3B8EFF' }} />
            </IconButton>
          </Tooltip>
        )}
        {lead.name && (
          <Tooltip title="Buscar Instagram">
            <IconButton
              size="small"
              component="a"
              href={`https://www.instagram.com/${lead.instagram || ''}`}
              onClick={e => { if (!lead.instagram) { e.preventDefault(); window.open(`https://www.google.com/search?q=${encodeURIComponent(lead.name + ' instagram')}`, '_blank') } }}
              target="_blank" rel="noopener"
              sx={{ p: 0.4, bgcolor: 'rgba(225,48,108,0.1)', border: '1px solid rgba(225,48,108,0.2)', borderRadius: 1 }}
            >
              <Typography sx={{ fontSize: '0.6rem', lineHeight: 1 }}>📸</Typography>
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="Gerar pitch com IA">
          <IconButton size="small" onClick={() => onGeneratePitch(lead)}
            sx={{ p: 0.4, bgcolor: 'rgba(180,90,255,0.1)', border: '1px solid rgba(180,90,255,0.2)', borderRadius: 1 }}>
            <AutoAwesomeIcon sx={{ fontSize: 12, color: '#b45aff' }} />
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        {/* Stage chip */}
        <Chip
          label={`${stage.emoji} ${stage.label}`}
          size="small"
          onClick={e => setAnchor(e.currentTarget)}
          sx={{ height: 18, fontSize: '0.52rem', fontWeight: 800, cursor: 'pointer', bgcolor: `${stage.color}18`, color: stage.color, border: `1px solid ${stage.color}30` }}
        />
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
          slotProps={{ paper: { sx: { background: 'rgba(18,18,18,0.98)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 } } }}>
          {PIPELINE_STAGES.map(s => (
            <MenuItem key={s.key} selected={lead.stage === s.key} onClick={() => { onStageChange(lead.id, s.key); setAnchor(null) }}
              sx={{ fontSize: '0.72rem', gap: 1, '&.Mui-selected': { bgcolor: `${s.color}12` } }}>
              <Typography sx={{ fontSize: '0.85rem' }}>{s.emoji}</Typography>
              <Typography sx={{ color: s.color, fontWeight: 700 }}>{s.label}</Typography>
            </MenuItem>
          ))}
        </Menu>
      </Box>
    </Paper>
  )
}

// ── SearchResultCard ───────────────────────────────────────

function SearchResultCard({
  place, onAdd,
}: {
  place: PlaceRaw
  onAdd: (place: PlaceRaw) => void
}) {
  const photoUrl = place.photos?.[0]?.photo_reference
    ? `/api/places?action=photo&ref=${encodeURIComponent(place.photos[0].photo_reference)}`
    : null

  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(place.rating ?? 0))

  return (
    <Paper elevation={0} sx={{
      p: 1.5, borderRadius: 2.5,
      border: '1px solid rgba(255,255,255,0.07)',
      bgcolor: 'rgba(255,255,255,0.025)',
      display: 'flex', flexDirection: 'column', gap: 0.8,
      transition: 'all 0.15s',
      '&:hover': { border: '1px solid rgba(255,144,57,0.25)', bgcolor: 'rgba(255,255,255,0.04)' },
    }}>
      {/* Photo + Name */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <Box sx={{
          width: 48, height: 48, borderRadius: 1.5, flexShrink: 0, overflow: 'hidden',
          bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {photoUrl ? (
            <Box component="img" src={photoUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Typography sx={{ fontSize: '1.4rem' }}>🏪</Typography>
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.78rem', lineHeight: 1.2, color: 'rgba(255,255,255,0.9)' }} noWrap>
            {place.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mt: 0.2 }}>
            {stars.map((filled, i) => (
              <StarIcon key={i} sx={{ fontSize: 9, color: filled ? '#FFD700' : 'rgba(255,255,255,0.15)' }} />
            ))}
            {place.rating && (
              <Typography sx={{ fontSize: '0.55rem', color: '#FFD700', fontWeight: 700, ml: 0.2 }}>
                {place.rating.toFixed(1)} ({place.user_ratings_total ?? 0})
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {/* Address */}
      <Box sx={{ display: 'flex', gap: 0.4, alignItems: 'flex-start' }}>
        <LocationOnIcon sx={{ fontSize: 10, color: 'text.disabled', mt: 0.2, flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.58rem', color: 'text.secondary', lineHeight: 1.4 }}>
          {place.formatted_address}
        </Typography>
      </Box>

      {/* Contact info */}
      {place.formatted_phone_number && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <PhoneIcon sx={{ fontSize: 10, color: '#25D366' }} />
          <Typography sx={{ fontSize: '0.62rem', color: '#25D366', fontWeight: 600 }}>
            {place.formatted_phone_number}
          </Typography>
        </Box>
      )}
      {place.website && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <LanguageIcon sx={{ fontSize: 10, color: '#3B8EFF' }} />
          <Typography sx={{ fontSize: '0.58rem', color: '#3B8EFF' }} noWrap>
            {new URL(place.website).hostname}
          </Typography>
        </Box>
      )}

      {/* Add button */}
      <Button
        size="small" startIcon={<PersonAddIcon sx={{ fontSize: 13 }} />}
        onClick={() => onAdd(place)}
        sx={{
          mt: 0.5, fontSize: '0.6rem', fontWeight: 700, py: 0.5,
          background: 'linear-gradient(135deg, rgba(255,144,57,0.15), rgba(255,83,57,0.1))',
          border: '1px solid rgba(255,144,57,0.3)', color: '#ff9039', borderRadius: 1.5,
          '&:hover': { background: 'linear-gradient(135deg, rgba(255,144,57,0.25), rgba(255,83,57,0.2))' },
        }}
      >
        Adicionar ao pipeline
      </Button>
    </Paper>
  )
}

// ── ApifyResultCard ───────────────────────────────────────

function ApifyResultCard({
  place, selected, onToggle, alreadyInPipeline,
}: {
  place: ApifyPlace
  selected: boolean
  onToggle: (p: ApifyPlace) => void
  alreadyInPipeline: boolean
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
      '&:hover': alreadyInPipeline ? {} : { border: `1px solid ${selected ? 'rgba(0,196,122,0.6)' : 'rgba(255,144,57,0.25)'}` },
    }} onClick={() => !alreadyInPipeline && onToggle(place)}>
      {/* Header */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: 1, flexShrink: 0, overflow: 'hidden',
          bgcolor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {place.imageUrl ? (
            <Box component="img" src={place.imageUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Typography sx={{ fontSize: '1.2rem' }}>🏪</Typography>
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.76rem', lineHeight: 1.2 }} noWrap>
              {place.title}
            </Typography>
            {alreadyInPipeline && (
              <Chip label="No pipeline" size="small" sx={{ height: 14, fontSize: '0.45rem', bgcolor: 'rgba(255,255,255,0.07)', color: 'text.disabled' }} />
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

      {/* Rating */}
      {(place.rating ?? 0) > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          {stars.map((filled, i) => (
            <StarIcon key={i} sx={{ fontSize: 9, color: filled ? '#FFD700' : 'rgba(255,255,255,0.12)' }} />
          ))}
          <Typography sx={{ fontSize: '0.55rem', color: '#FFD700', fontWeight: 700, ml: 0.2 }}>
            {(place.rating ?? 0).toFixed(1)} ({place.reviewsCount ?? 0})
          </Typography>
        </Box>
      )}

      {/* Address */}
      {place.address && (
        <Box sx={{ display: 'flex', gap: 0.4, alignItems: 'flex-start' }}>
          <LocationOnIcon sx={{ fontSize: 10, color: 'text.disabled', mt: 0.2, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.56rem', color: 'text.secondary', lineHeight: 1.4 }}>{place.address}</Typography>
        </Box>
      )}

      {/* Contact chips */}
      <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
        {place.phone && (
          <Chip icon={<PhoneIcon sx={{ fontSize: '10px !important' }} />} label={place.phone} size="small"
            sx={{ height: 16, fontSize: '0.52rem', bgcolor: 'rgba(37,211,102,0.08)', color: '#25D366', border: '1px solid rgba(37,211,102,0.2)' }} />
        )}
        {place.instagram && (
          <Chip label={`@${place.instagram}`} size="small"
            sx={{ height: 16, fontSize: '0.52rem', bgcolor: 'rgba(225,48,108,0.08)', color: '#E1306C', border: '1px solid rgba(225,48,108,0.2)' }} />
        )}
        {place.emails?.[0] && (
          <Chip label={place.emails[0]} size="small"
            sx={{ height: 16, fontSize: '0.52rem', bgcolor: 'rgba(59,142,255,0.08)', color: '#3B8EFF', border: '1px solid rgba(59,142,255,0.2)', maxWidth: 160, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
        )}
        {place.website && (
          <Chip icon={<LanguageIcon sx={{ fontSize: '10px !important' }} />}
            label={(() => { try { return new URL(place.website).hostname } catch { return place.website } })()}
            size="small"
            sx={{ height: 16, fontSize: '0.52rem', bgcolor: 'rgba(255,255,255,0.05)', color: 'text.secondary', border: '1px solid rgba(255,255,255,0.1)' }} />
        )}
      </Box>
    </Paper>
  )
}

// ── Main ProspeccaoTab ────────────────────────────────────

export default function ProspeccaoTab() {
  const [leads, setLeads] = useState<Lead[]>(loadLeads)
  const [view, setView] = useState<'search' | 'pipeline'>('search')

  // Search state
  const [region, setRegion] = useState('')
  const [selectedType, setSelectedType] = useState(BUSINESS_TYPES[0])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<PlaceRaw[]>([])
  const [searchError, setSearchError] = useState('')
  const [nextPageToken, setNextPageToken] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  // API key
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('sm_places_key') ?? '')
  const [keyOpen, setKeyOpen] = useState(false)
  const [keyInput, setKeyInput] = useState('')

  // Add lead dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addPlace, setAddPlace] = useState<PlaceRaw | null>(null)
  const [addStage, setAddStage] = useState<LeadStage>('contato')
  const [addNotes, setAddNotes] = useState('')
  const [addTicket, setAddTicket] = useState('')
  const [addInstagram, setAddInstagram] = useState('')

  // Edit lead dialog
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [editStage, setEditStage] = useState<LeadStage>('contato')
  const [editNotes, setEditNotes] = useState('')
  const [editTicket, setEditTicket] = useState('')
  const [editInstagram, setEditInstagram] = useState('')
  const [editPhone, setEditPhone] = useState('')

  // Details auto-fetch
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [dupeWarn, setDupeWarn] = useState('')

  // Pitch generator
  const [pitchLead, setPitchLead]     = useState<Lead | null>(null)
  const [pitchText, setPitchText]     = useState('')
  const [pitchLoading, setPitchLoading] = useState(false)
  const [pitchCopied, setPitchCopied] = useState(false)

  // Follow-up date fields
  const [addFollowUp,  setAddFollowUp]  = useState('')
  const [editFollowUp, setEditFollowUp] = useState('')

  // Pipeline filter
  const [pipelineStage, setPipelineStage] = useState<LeadStage | 'all'>('all')

  // Search mode: google | apify
  const [searchMode, setSearchMode] = useState<'google' | 'apify'>('google')

  // Apify state
  const [apifyKey, setApifyKey] = useState(() => localStorage.getItem('sm_apify_key') ?? '')
  const [apifyKeyOpen, setApifyKeyOpen] = useState(false)
  const [apifyKeyInput, setApifyKeyInput] = useState('')
  const [apifyQuery, setApifyQuery] = useState('')
  const [apifyMax, setApifyMax] = useState('20')
  const [apifyRunning, setApifyRunning] = useState(false)
  const [apifyStatus, setApifyStatus] = useState('')        // 'RUNNING' | 'SUCCEEDED' | 'FAILED' | ''
  const [apifyProgress, setApifyProgress] = useState(0)    // 0-100 fake progress
  const [apifyResults, setApifyResults] = useState<ApifyPlace[]>([])
  const [apifySelected, setApifySelected] = useState<Set<string>>(new Set())
  const [apifyError, setApifyError] = useState('')
  const [apifyImported, setApifyImported] = useState('')
  const apifyPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const saveApiKey = () => {
    localStorage.setItem('sm_places_key', keyInput)
    setApiKey(keyInput)
    setKeyOpen(false)
  }

  const saveApifyKey = () => {
    localStorage.setItem('sm_apify_key', apifyKeyInput)
    setApifyKey(apifyKeyInput)
    setApifyKeyOpen(false)
  }

  const startApifyRun = useCallback(async () => {
    if (!apifyQuery.trim()) return
    if (apifyPollRef.current) clearInterval(apifyPollRef.current)
    setApifyRunning(true)
    setApifyStatus('RUNNING')
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
      if (!data.ok || !data.runId) {
        setApifyError(data.error ?? 'Falha ao iniciar extração')
        setApifyRunning(false)
        setApifyStatus('')
        return
      }

      const runId = data.runId
      let fakeProgress = 10
      let datasetId = ''

      apifyPollRef.current = setInterval(async () => {
        fakeProgress = Math.min(fakeProgress + 5, 90)
        setApifyProgress(fakeProgress)

        try {
          const sRes = await fetch(`/api/apify?action=status&runId=${runId}`,
            { headers: apifyKey ? { 'X-Apify-Token': apifyKey } : {} })
          const sData = await sRes.json() as { ok: boolean; status?: string; datasetId?: string; error?: string }
          if (!sData.ok) return

          const st = sData.status ?? ''
          setApifyStatus(st)
          if (sData.datasetId) datasetId = sData.datasetId

          if (st === 'SUCCEEDED') {
            clearInterval(apifyPollRef.current!)
            setApifyProgress(95)
            // Fetch results
            const rRes = await fetch(`/api/apify?action=results&datasetId=${datasetId}`,
              { headers: apifyKey ? { 'X-Apify-Token': apifyKey } : {} })
            const rData = await rRes.json() as { ok: boolean; items?: ApifyPlace[]; error?: string }
            if (rData.ok && rData.items) {
              setApifyResults(rData.items.filter(p => p.title))
              // Pre-select all that aren't already in pipeline
              const existing = new Set(leads.map(l => l.placeId).filter(Boolean) as string[])
              const newSel = new Set(rData.items.filter(p => p.placeId && !existing.has(p.placeId)).map(p => p.placeId!))
              setApifySelected(newSel)
            } else {
              setApifyError(rData.error ?? 'Erro ao buscar resultados')
            }
            setApifyProgress(100)
            setApifyRunning(false)

          } else if (st === 'FAILED' || st === 'TIMED-OUT' || st === 'ABORTED') {
            clearInterval(apifyPollRef.current!)
            setApifyError(`Extração ${st.toLowerCase()}. Tente novamente.`)
            setApifyRunning(false)
            setApifyStatus('')
          }
        } catch { /* network hiccup — keep polling */ }
      }, 4000)

    } catch (e) {
      setApifyError('Erro de conexão: ' + String(e))
      setApifyRunning(false)
      setApifyStatus('')
    }
  }, [apifyQuery, apifyMax, apifyKey, leads])

  const toggleApifySelect = useCallback((p: ApifyPlace) => {
    const key = p.placeId || p.title || ''
    setApifySelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const importApifySelected = useCallback(() => {
    const existing = new Set(leads.map(l => l.placeId).filter(Boolean) as string[])
    const toImport = apifyResults.filter(p => {
      const key = p.placeId || p.title || ''
      return apifySelected.has(key) && !existing.has(p.placeId ?? '')
    })

    const newLeads: Lead[] = toImport.map(p => ({
      id: crypto.randomUUID(),
      name: p.title ?? 'Sem nome',
      address: p.address ?? '',
      phone: p.phone,
      website: p.website,
      instagram: p.instagram,
      rating: p.rating,
      ratingsTotal: p.reviewsCount,
      placeId: p.placeId,
      stage: 'contato' as LeadStage,
      notes: p.emails?.[0] ? `Email: ${p.emails[0]}` : undefined,
      addedAt: Date.now(),
      updatedAt: Date.now(),
      source: 'maps' as const,
      category: p.categoryName,
    }))

    const next = [...leads, ...newLeads]
    setLeads(next)
    saveLeads(next)
    setApifyImported(`${newLeads.length} lead${newLeads.length !== 1 ? 's' : ''} importado${newLeads.length !== 1 ? 's' : ''}!`)
    setApifySelected(new Set())
    setView('pipeline')
  }, [apifyResults, apifySelected, leads])

  const doSearch = useCallback(async (pageToken?: string) => {
    if (!region.trim() && !pageToken) return
    setLoading(true)
    setSearchError('')
    if (!pageToken) setResults([])
    setHasSearched(true)

    try {
      const q = pageToken ? '' : `${selectedType.query} em ${region}`
      const params = new URLSearchParams({ action: 'search' })
      if (pageToken) params.set('pageToken', pageToken)
      else params.set('q', q)

      const res = await fetch(`/api/places?${params}`, {
        headers: apiKey ? { 'X-Places-Key': apiKey } : {},
      })
      const data = await res.json() as { ok: boolean; results?: PlaceRaw[]; nextPageToken?: string; error?: string }

      if (!data.ok) {
        setSearchError(data.error || 'Erro ao buscar')
        return
      }

      setResults(prev => pageToken ? [...prev, ...(data.results ?? [])] : (data.results ?? []))
      setNextPageToken(data.nextPageToken ?? '')
    } catch {
      setSearchError('Erro de conexão. Verifique sua internet.')
    } finally {
      setLoading(false)
    }
  }, [region, selectedType, apiKey])

  const handleAddLead = async (place: PlaceRaw) => {
    // Duplicate check
    if (leads.some(l => l.placeId && l.placeId === place.place_id)) {
      setDupeWarn(`"${place.name}" já está no pipeline.`)
      return
    }

    setAddPlace(place)
    setAddStage('contato')
    setAddNotes('')
    setAddTicket('')
    setAddInstagram('')
    setAddFollowUp('')

    // Auto-fetch full details to get phone + website
    if (place.place_id && !place.formatted_phone_number) {
      setDetailsLoading(true)
      try {
        const res = await fetch(`/api/places?action=details&id=${encodeURIComponent(place.place_id)}`,
          { headers: apiKey ? { 'X-Places-Key': apiKey } : {} })
        const data = await res.json() as { ok: boolean; result?: PlaceRaw }
        if (data.ok && data.result) {
          setAddPlace(prev => prev ? { ...prev, ...data.result } : data.result ?? prev)
        }
      } catch { /* network error — proceed without details */ }
      finally { setDetailsLoading(false) }
    }

    setAddOpen(true)
  }

  const confirmAddLead = () => {
    if (!addPlace) return
    const newLead: Lead = {
      id: crypto.randomUUID(),
      name: addPlace.name,
      address: addPlace.formatted_address,
      phone: addPlace.formatted_phone_number,
      website: addPlace.website,
      instagram: addInstagram || undefined,
      rating: addPlace.rating,
      ratingsTotal: addPlace.user_ratings_total ?? undefined,
      placeId: addPlace.place_id,
      stage: addStage,
      notes: addNotes || undefined,
      estimatedTicket: addTicket ? Number(addTicket) : undefined,
      followUpAt: addFollowUp ? new Date(addFollowUp).getTime() : undefined,
      addedAt: Date.now(),
      updatedAt: Date.now(),
      source: 'maps',
      category: selectedType.label,
    }
    const next = [...leads, newLead]
    setLeads(next)
    saveLeads(next)
    setAddOpen(false)
    setView('pipeline')
  }

  const handleStageChange = (id: string, stage: LeadStage) => {
    const next = leads.map(l => l.id === id ? { ...l, stage, updatedAt: Date.now() } : l)
    setLeads(next)
    saveLeads(next)
  }

  const handleDelete = (id: string) => {
    const next = leads.filter(l => l.id !== id)
    setLeads(next)
    saveLeads(next)
  }

  const openEdit = (lead: Lead) => {
    setEditLead(lead)
    setEditStage(lead.stage)
    setEditNotes(lead.notes ?? '')
    setEditTicket(lead.estimatedTicket ? String(lead.estimatedTicket) : '')
    setEditInstagram(lead.instagram ?? '')
    setEditPhone(lead.phone ?? '')
    setEditFollowUp(lead.followUpAt ? new Date(lead.followUpAt).toISOString().slice(0, 10) : '')
  }

  const confirmEdit = () => {
    if (!editLead) return
    const next = leads.map(l => l.id === editLead.id ? {
      ...l, stage: editStage, notes: editNotes || undefined,
      estimatedTicket: editTicket ? Number(editTicket) : undefined,
      instagram: editInstagram || undefined,
      phone: editPhone || l.phone,
      followUpAt: editFollowUp ? new Date(editFollowUp).getTime() : undefined,
      updatedAt: Date.now(),
    } : l)
    setLeads(next)
    saveLeads(next)
    setEditLead(null)
  }

  // ── AI Pitch Generator ────────────────────────────────────
  const handleGeneratePitch = useCallback(async (lead: Lead) => {
    setPitchLead(lead)
    setPitchText('')
    setPitchLoading(true)
    setPitchCopied(false)
    try {
      const prompt = `Você é um vendedor B2B especialista em vender serviços de social media para pequenos negócios brasileiros. Gere uma mensagem de abordagem via WhatsApp/Instagram DM para o seguinte prospect:

Negócio: ${lead.name}
Endereço: ${lead.address || 'não informado'}
Categoria: ${lead.category || 'não informado'}
${lead.rating ? `Avaliação Google: ${lead.rating.toFixed(1)} estrelas (${lead.ratingsTotal ?? 0} avaliações)` : ''}
${lead.notes ? `Observações: ${lead.notes}` : ''}

Requisitos:
- Mensagem curta (máx 5 linhas), pessoal e direta
- Mencione algo específico do negócio (avaliação, categoria, localização)
- Mostre que entende o desafio deles nas redes sociais
- Ofereça uma call/reunião sem ser invasivo
- Tom profissional mas descontraído, sem formalismo excessivo
- Em português brasileiro, sem emojis excessivos
- Assine como "Digital Scale"

Retorne APENAS o texto da mensagem, sem explicações.`

      const groqKey = localStorage.getItem('sm_groq_key') ?? ''
      const aiHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (groqKey) aiHeaders['X-Groq-Key'] = groqKey

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json() as { content?: { text: string }[]; choices?: { message: { content: string } }[]; response?: string }
      const reply = data.content?.[0]?.text ?? data.choices?.[0]?.message?.content ?? data.response ?? ''
      setPitchText(reply.trim() || 'Erro ao gerar pitch.')
    } catch {
      setPitchText('Erro de conexão. Tente novamente.')
    } finally {
      setPitchLoading(false)
    }
  }, [])

  const addManualLead = () => {
    const newLead: Lead = {
      id: crypto.randomUUID(),
      name: 'Novo lead',
      address: '',
      stage: 'contato',
      addedAt: Date.now(),
      updatedAt: Date.now(),
      source: 'manual',
    }
    const next = [...leads, newLead]
    setLeads(next)
    saveLeads(next)
    openEdit(newLead)
  }

  // Pipeline stats
  const pipelineStats = useMemo((): Partial<Record<LeadStage, number>> & { totalTicket: number; potentialTicket: number } => {
    const counts: Partial<Record<LeadStage, number>> = {}
    PIPELINE_STAGES.forEach(s => { counts[s.key] = leads.filter(l => l.stage === s.key).length })
    const totalTicket = leads.filter(l => l.stage === 'fechado').reduce((acc, l) => acc + (l.estimatedTicket ?? 0), 0)
    const potentialTicket = leads.filter(l => l.stage !== 'perdido').reduce((acc, l) => acc + (l.estimatedTicket ?? 0), 0)
    return { ...counts, totalTicket, potentialTicket }
  }, [leads])

  const filteredLeads = useMemo(() =>
    pipelineStage === 'all' ? leads : leads.filter(l => l.stage === pipelineStage),
  [leads, pipelineStage])

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <Box sx={{ px: 2, py: 1.2, borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: 'primary.main' }}>🔍 Prospecção</Typography>
        <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>· nicho gastronômico & variados</Typography>

        <Box sx={{ flex: 1 }} />

        {/* KPI mini */}
        {leads.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {PIPELINE_STAGES.slice(0, 4).map(s => (
              <Box key={s.key} sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>
                  {pipelineStats[s.key] ?? 0}
                </Typography>
                <Typography sx={{ fontSize: '0.44rem', color: 'text.disabled', textTransform: 'uppercase' }}>{s.label}</Typography>
              </Box>
            ))}
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(255,255,255,0.08)' }} />
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#00C47A', lineHeight: 1 }}>
                R$ {(pipelineStats.potentialTicket || 0).toLocaleString('pt-BR')}
              </Typography>
              <Typography sx={{ fontSize: '0.44rem', color: 'text.disabled', textTransform: 'uppercase' }}>Potencial/mês</Typography>
            </Box>
          </Box>
        )}

        {/* View toggle */}
        <Box sx={{ display: 'flex', borderRadius: 1.5, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          {(['search', 'pipeline'] as const).map(v => (
            <Box key={v} onClick={() => setView(v)} sx={{
              px: 1.4, py: 0.5, cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
              bgcolor: view === v ? 'rgba(255,144,57,0.15)' : 'transparent',
              color: view === v ? 'primary.main' : 'rgba(255,255,255,0.28)',
              borderRight: v === 'search' ? '1px solid rgba(255,255,255,0.08)' : 'none',
              transition: 'all 0.15s',
            }}>
              {v === 'search' ? '🔍 Buscar' : `📋 Pipeline (${leads.length})`}
            </Box>
          ))}
        </Box>

        {/* Google API Key button */}
        <Tooltip title={apiKey ? 'Chave Google Places configurada ✓' : 'Configurar chave da API Google'}>
          <Box
            onClick={() => { setKeyInput(apiKey); setKeyOpen(true) }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.4, px: 0.8, py: 0.4, borderRadius: 1.5, cursor: 'pointer',
              border: `1px solid ${apiKey ? 'rgba(0,196,122,0.4)' : 'rgba(255,69,69,0.4)'}`,
              bgcolor: apiKey ? 'rgba(0,196,122,0.08)' : 'rgba(255,69,69,0.08)',
              '&:hover': { opacity: 0.8 },
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: apiKey ? '#00C47A' : '#FF4545' }} />
            <KeyIcon sx={{ fontSize: 11, color: apiKey ? '#00C47A' : '#FF4545' }} />
            <Typography sx={{ fontSize: '0.5rem', color: apiKey ? '#00C47A' : '#FF4545', fontWeight: 700 }}>G</Typography>
          </Box>
        </Tooltip>

        {/* Apify API Key button */}
        <Tooltip title={apifyKey ? 'Token Apify configurado ✓' : 'Configurar token Apify (extração em volume)'}>
          <Box
            onClick={() => { setApifyKeyInput(apifyKey); setApifyKeyOpen(true) }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.4, px: 0.8, py: 0.4, borderRadius: 1.5, cursor: 'pointer',
              border: `1px solid ${apifyKey ? 'rgba(0,196,122,0.4)' : 'rgba(255,154,61,0.4)'}`,
              bgcolor: apifyKey ? 'rgba(0,196,122,0.08)' : 'rgba(255,154,61,0.06)',
              '&:hover': { opacity: 0.8 },
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: apifyKey ? '#00C47A' : '#FF9A3D' }} />
            <KeyIcon sx={{ fontSize: 11, color: apifyKey ? '#00C47A' : '#FF9A3D' }} />
            <Typography sx={{ fontSize: '0.5rem', color: apifyKey ? '#00C47A' : '#FF9A3D', fontWeight: 700 }}>A</Typography>
          </Box>
        </Tooltip>
      </Box>

      {/* ── Content ────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>

        {/* ═══ SEARCH VIEW ═══ */}
        {view === 'search' && (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Mode toggle */}
            <Box sx={{ display: 'flex', borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', alignSelf: 'flex-start' }}>
              {(['google', 'apify'] as const).map(m => (
                <Box key={m} onClick={() => setSearchMode(m)} sx={{
                  px: 1.8, py: 0.8, cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700,
                  bgcolor: searchMode === m ? (m === 'google' ? 'rgba(255,144,57,0.18)' : 'rgba(0,196,122,0.15)') : 'transparent',
                  color: searchMode === m ? (m === 'google' ? '#ff9039' : '#00C47A') : 'rgba(255,255,255,0.3)',
                  borderRight: m === 'google' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 0.6,
                }}>
                  {m === 'google' ? '🗺️ Google Places' : '⚡ Apify (em volume)'}
                </Box>
              ))}
            </Box>

            {/* ── GOOGLE PLACES MODE ── */}
            {searchMode === 'google' && (
              <>
                {!apiKey && (
                  <Alert severity="warning" sx={{ fontSize: '0.72rem' }}>
                    Configure sua chave da Google Places API para buscar prospects. Clique no ícone <strong>🔑G</strong> no canto superior.
                  </Alert>
                )}

                <Paper sx={{ p: 2, border: '1px solid rgba(255,255,255,0.07)', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2.5 }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'primary.main', mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    🎯 Buscar clientes com potencial
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
                    <TextField
                      placeholder="Cidade ou região (ex: Sorocaba SP, Zona Sul SP)"
                      size="small" value={region} onChange={e => setRegion(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && doSearch()}
                      sx={{
                        flex: 1, minWidth: 200,
                        '& .MuiInputBase-root': { fontSize: '0.75rem', bgcolor: 'rgba(255,255,255,0.04)' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
                      }}
                      slotProps={{ input: { startAdornment: <LocationOnIcon sx={{ fontSize: 16, color: 'primary.main', mr: 0.5 }} /> } }}
                    />
                    <Button
                      variant="contained" onClick={() => doSearch()} disabled={loading || !region.trim()}
                      startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <SearchIcon sx={{ fontSize: 16 }} />}
                      sx={{ fontWeight: 800, background: 'linear-gradient(135deg, #ff9039, #ff5339)', color: '#000', px: 2 }}
                    >
                      {loading ? 'Buscando...' : 'Buscar'}
                    </Button>
                  </Box>

                  <Typography sx={{ fontSize: '0.58rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.8 }}>
                    Tipo de negócio
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
                    {BUSINESS_TYPES.map(bt => (
                      <Chip
                        key={bt.key} label={bt.label} size="small"
                        variant={selectedType.key === bt.key ? 'filled' : 'outlined'}
                        onClick={() => setSelectedType(bt)}
                        sx={{
                          height: 24, fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
                          bgcolor: selectedType.key === bt.key ? 'rgba(255,144,57,0.2)' : 'transparent',
                          borderColor: selectedType.key === bt.key ? 'primary.main' : 'rgba(255,255,255,0.15)',
                          color: selectedType.key === bt.key ? 'primary.main' : 'text.secondary',
                          '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'rgba(255,144,57,0.08)' },
                        }}
                      />
                    ))}
                  </Box>
                </Paper>

                {searchError && <Alert severity="error" sx={{ fontSize: '0.72rem' }}>{searchError}</Alert>}

                {hasSearched && !loading && results.length === 0 && !searchError && (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Typography sx={{ fontSize: '1.5rem', mb: 1 }}>🔍</Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                      Nenhum resultado para "{selectedType.label}" em "{region}"
                    </Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', mt: 0.5 }}>
                      Tente outra região ou tipo de negócio
                    </Typography>
                  </Box>
                )}

                {results.length > 0 && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                        {results.length} resultado{results.length !== 1 ? 's' : ''} — {selectedType.label} em {region}
                      </Typography>
                      <Box sx={{ flex: 1 }} />
                      {nextPageToken && (
                        <Button size="small" onClick={() => doSearch(nextPageToken)} disabled={loading}
                          sx={{ fontSize: '0.6rem', color: 'primary.main' }}>
                          Carregar mais
                        </Button>
                      )}
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1.5 }}>
                      {results.map(place => (
                        <SearchResultCard key={place.place_id} place={place} onAdd={handleAddLead} />
                      ))}
                    </Box>
                  </>
                )}
              </>
            )}

            {/* ── APIFY MODE ── */}
            {searchMode === 'apify' && (
              <>
                {!apifyKey && (
                  <Alert severity="info" sx={{ fontSize: '0.72rem' }}>
                    Configure seu token Apify clicando no ícone <strong>🔑A</strong> no canto superior.
                    O token fica salvo só no seu navegador — nunca no código.
                  </Alert>
                )}

                <Paper sx={{ p: 2, border: '1px solid rgba(0,196,122,0.12)', bgcolor: 'rgba(0,196,122,0.03)', borderRadius: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#00C47A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      ⚡ Extração em volume via Apify
                    </Typography>
                    <Chip label="email + Instagram + mais dados" size="small"
                      sx={{ height: 16, fontSize: '0.5rem', bgcolor: 'rgba(0,196,122,0.12)', color: '#00C47A', border: '1px solid rgba(0,196,122,0.2)' }} />
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
                    <TextField
                      placeholder="Ex: restaurante em Sorocaba SP"
                      size="small" value={apifyQuery} onChange={e => setApifyQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !apifyRunning && startApifyRun()}
                      sx={{
                        flex: 1, minWidth: 220,
                        '& .MuiInputBase-root': { fontSize: '0.75rem', bgcolor: 'rgba(255,255,255,0.04)' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
                      }}
                      slotProps={{ input: { startAdornment: <SearchIcon sx={{ fontSize: 16, color: '#00C47A', mr: 0.5 }} /> } }}
                    />
                    <TextField
                      label="Máx" size="small" type="number" value={apifyMax} onChange={e => setApifyMax(e.target.value)}
                      sx={{ width: 80, '& .MuiInputBase-root': { fontSize: '0.75rem' } }}
                      slotProps={{ htmlInput: { min: 5, max: 100, step: 5 } }}
                    />
                    <Button
                      variant="contained" onClick={startApifyRun}
                      disabled={apifyRunning || !apifyQuery.trim() || !apifyKey}
                      startIcon={apifyRunning ? <CircularProgress size={13} color="inherit" /> : <CloudDownloadIcon sx={{ fontSize: 16 }} />}
                      sx={{ fontWeight: 800, background: 'linear-gradient(135deg, #00C47A, #00a06a)', color: '#000', px: 2, whiteSpace: 'nowrap' }}
                    >
                      {apifyRunning ? 'Extraindo…' : 'Extrair'}
                    </Button>
                  </Box>

                  <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', lineHeight: 1.6 }}>
                    💡 Extrai até 100 lugares com telefone, email, Instagram e avaliações. Demora ~1-3 min.
                    Custo: ~$0.004/lugar no plano gratuito (200 extrações/mês grátis).
                  </Typography>
                </Paper>

                {/* Progress */}
                {apifyRunning && (
                  <Paper sx={{ p: 2, border: '1px solid rgba(0,196,122,0.15)', bgcolor: 'rgba(0,196,122,0.04)', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CircularProgress size={14} sx={{ color: '#00C47A' }} />
                      <Typography sx={{ fontSize: '0.72rem', color: '#00C47A', fontWeight: 700 }}>
                        {apifyStatus === 'RUNNING' ? 'Extraindo dados do Google Maps…' : apifyStatus}
                      </Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={apifyProgress}
                      sx={{ height: 5, borderRadius: 3, bgcolor: 'rgba(0,196,122,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#00C47A' } }} />
                    <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', mt: 0.5 }}>
                      Aguardando Apify processar… pode levar 1-3 minutos.
                    </Typography>
                  </Paper>
                )}

                {apifyError && <Alert severity="error" sx={{ fontSize: '0.72rem' }}>{apifyError}</Alert>}

                {/* Results */}
                {apifyResults.length > 0 && !apifyRunning && (
                  <>
                    {/* Selection toolbar */}
                    <Paper sx={{ p: 1.5, border: '1px solid rgba(255,255,255,0.07)', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>
                        {apifyResults.length} lugar{apifyResults.length !== 1 ? 'es' : ''} extraído{apifyResults.length !== 1 ? 's' : ''}
                      </Typography>
                      <Chip label={`${apifySelected.size} selecionado${apifySelected.size !== 1 ? 's' : ''}`} size="small"
                        sx={{ height: 18, fontSize: '0.55rem', bgcolor: 'rgba(0,196,122,0.12)', color: '#00C47A', border: '1px solid rgba(0,196,122,0.25)' }} />
                      <Box sx={{ flex: 1 }} />
                      <Button size="small" startIcon={<SelectAllIcon sx={{ fontSize: 13 }} />}
                        onClick={() => {
                          const existing = new Set(leads.map(l => l.placeId).filter(Boolean) as string[])
                          const all = new Set(apifyResults.filter(p => !existing.has(p.placeId ?? '')).map(p => p.placeId || p.title || ''))
                          setApifySelected(all)
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
                    </Paper>

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 1.2 }}>
                      {apifyResults.map((place, i) => {
                        const key = place.placeId || place.title || String(i)
                        const alreadyIn = leads.some(l => l.placeId && l.placeId === place.placeId)
                        return (
                          <ApifyResultCard
                            key={key}
                            place={place}
                            selected={apifySelected.has(key)}
                            onToggle={toggleApifySelect}
                            alreadyInPipeline={alreadyIn}
                          />
                        )
                      })}
                    </Box>
                  </>
                )}
              </>
            )}
          </Box>
        )}

        {/* ═══ PIPELINE VIEW ═══ */}
        {view === 'pipeline' && (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Revenue KPI banner */}
            <Box sx={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1.5,
            }}>
              {PIPELINE_STAGES.map(s => {
                const stageLeads = leads.filter(l => l.stage === s.key)
                const stageTicket = stageLeads.reduce((sum, l) => sum + (l.estimatedTicket ?? 0), 0)
                return (
                  <Paper key={s.key} elevation={0} sx={{
                    p: 1.5, borderRadius: 2, border: `1px solid ${s.color}22`,
                    bgcolor: pipelineStage === s.key ? `${s.color}10` : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer', transition: 'all 0.15s',
                    '&:hover': { bgcolor: `${s.color}08`, border: `1px solid ${s.color}40` },
                  }} onClick={() => setPipelineStage(prev => prev === s.key ? 'all' : s.key)}>
                    <Typography sx={{ fontSize: '0.85rem', mb: 0.3 }}>{s.emoji}</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: s.color, lineHeight: 1 }}>{stageLeads.length}</Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</Typography>
                    {stageTicket > 0 && (
                      <Typography sx={{ fontSize: '0.6rem', color: '#00C47A', fontWeight: 700, mt: 0.3 }}>
                        R$ {stageTicket.toLocaleString('pt-BR')}/mês
                      </Typography>
                    )}
                  </Paper>
                )
              })}
            </Box>

            {/* Funnel progress */}
            {leads.length > 0 && (
              <Paper sx={{ p: 1.5, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>Taxa de conversão</Typography>
                  <Typography sx={{ fontSize: '0.62rem', color: '#00C47A', fontWeight: 700 }}>
                    {leads.length ? Math.round(((pipelineStats['fechado'] ?? 0) / leads.length) * 100) : 0}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={leads.length ? ((pipelineStats['fechado'] ?? 0) / leads.length) * 100 : 0}
                  sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { bgcolor: '#00C47A', borderRadius: 3 } }}
                />
              </Paper>
            )}

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {pipelineStage !== 'all' && (
                <Chip
                  label={`Filtrando: ${PIPELINE_STAGES.find(s => s.key === pipelineStage)?.label}`}
                  size="small" onDelete={() => setPipelineStage('all')}
                  sx={{ fontSize: '0.62rem', bgcolor: 'rgba(255,255,255,0.05)' }}
                />
              )}
              <Box sx={{ flex: 1 }} />
              <Button size="small" startIcon={<AddIcon sx={{ fontSize: 13 }} />} onClick={addManualLead}
                sx={{ fontSize: '0.62rem', border: '1px solid rgba(255,144,57,0.3)', color: 'primary.main', borderRadius: 2, px: 1.2, py: 0.4, '&:hover': { bgcolor: 'rgba(255,144,57,0.08)' } }}>
                Adicionar manual
              </Button>
            </Box>

            {/* Leads list */}
            {filteredLeads.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography sx={{ fontSize: '2rem', mb: 1 }}>📋</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                  Nenhum lead no pipeline ainda.
                </Typography>
                <Button size="small" onClick={() => setView('search')} sx={{ mt: 1.5, color: 'primary.main', fontSize: '0.7rem' }}>
                  Buscar prospects →
                </Button>
              </Box>
            ) : (
              <Box sx={{ columns: { xs: 1, sm: 2, md: 3, lg: 4 }, gap: 1.5 }}>
                {filteredLeads.map(lead => (
                  <Box key={lead.id} sx={{ breakInside: 'avoid', mb: 1.5 }}>
                    <LeadCard lead={lead} onStageChange={handleStageChange} onDelete={handleDelete} onEdit={openEdit} onGeneratePitch={handleGeneratePitch} />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* ── API Key dialog ── */}
      <Dialog open={keyOpen} onClose={() => setKeyOpen(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' } } }}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <KeyIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography fontWeight={800}>Chave Google Places API</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="info" sx={{ fontSize: '0.7rem' }}>
            Acesse <strong>console.cloud.google.com</strong> → APIs & Services → Credentials → Create API Key. Habilite: <strong>Places API</strong>.
            A chave fica salva localmente no seu navegador.
          </Alert>
          <TextField
            fullWidth size="small" label="Google Places API Key"
            value={keyInput} onChange={e => setKeyInput(e.target.value)}
            placeholder="AIza..."
            type="password"
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setKeyOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveApiKey} disabled={!keyInput.trim()} sx={{ fontWeight: 700 }}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* ── Dupe warning ── */}
      <Dialog open={!!dupeWarn} onClose={() => setDupeWarn('')} maxWidth="xs"
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', border: '1px solid rgba(255,255,255,0.08)' } } }}>
        <DialogTitle>⚠️ Lead duplicado</DialogTitle>
        <DialogContent><Typography sx={{ fontSize: '0.82rem' }}>{dupeWarn}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDupeWarn('')} variant="contained" sx={{ fontWeight: 700 }}>Ok</Button>
        </DialogActions>
      </Dialog>

      {/* ── Add lead dialog ── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' } } }}>
        <DialogTitle>
          <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>
            📋 Adicionar ao pipeline
          </Typography>
          {addPlace && <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{addPlace.name}</Typography>}
          {detailsLoading && <LinearProgress sx={{ mt: 0.5, borderRadius: 1 }} />}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {addPlace?.formatted_phone_number && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, p: 0.8, bgcolor: 'rgba(37,211,102,0.08)', borderRadius: 1, border: '1px solid rgba(37,211,102,0.2)' }}>
              <PhoneIcon sx={{ fontSize: 13, color: '#25D366' }} />
              <Typography sx={{ fontSize: '0.75rem', color: '#25D366', fontWeight: 700 }}>{addPlace.formatted_phone_number}</Typography>
            </Box>
          )}
          <TextField select label="Estágio" size="small" fullWidth value={addStage} onChange={e => setAddStage(e.target.value as LeadStage)}>
            {PIPELINE_STAGES.map(s => <MenuItem key={s.key} value={s.key}>{s.emoji} {s.label}</MenuItem>)}
          </TextField>
          <TextField
            label="Instagram (opcional)" size="small" fullWidth
            value={addInstagram} onChange={e => setAddInstagram(e.target.value)}
            placeholder="@nome_do_negocio"
          />
          <TextField
            label="Ticket estimado R$/mês" size="small" fullWidth type="number"
            value={addTicket} onChange={e => setAddTicket(e.target.value)}
            placeholder="2000"
            slotProps={{ input: { startAdornment: <Typography sx={{ fontSize: '0.75rem', mr: 0.5, color: 'text.secondary' }}>R$</Typography> } }}
          />
          <TextField
            label="📅 Data de retorno" size="small" fullWidth type="date"
            value={addFollowUp} onChange={e => setAddFollowUp(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Observações" size="small" fullWidth multiline rows={2}
            value={addNotes} onChange={e => setAddNotes(e.target.value)}
            placeholder="Tem Instagram ativo, dono se chama João..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setAddOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={confirmAddLead} sx={{ fontWeight: 800, background: 'linear-gradient(135deg,#ff9039,#ff5339)', color: '#000' }}>
            Adicionar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit lead dialog ── */}
      <Dialog open={!!editLead} onClose={() => setEditLead(null)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' } } }}>
        <DialogTitle>
          <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>✏️ Editar lead</Typography>
          {editLead && <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{editLead.name}</Typography>}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField select label="Estágio" size="small" fullWidth value={editStage} onChange={e => setEditStage(e.target.value as LeadStage)}>
            {PIPELINE_STAGES.map(s => <MenuItem key={s.key} value={s.key}>{s.emoji} {s.label}</MenuItem>)}
          </TextField>
          <TextField
            label="Telefone" size="small" fullWidth
            value={editPhone} onChange={e => setEditPhone(e.target.value)}
          />
          <TextField
            label="Instagram" size="small" fullWidth
            value={editInstagram} onChange={e => setEditInstagram(e.target.value)}
            placeholder="@nome_do_negocio"
          />
          <TextField
            label="Ticket estimado R$/mês" size="small" fullWidth type="number"
            value={editTicket} onChange={e => setEditTicket(e.target.value)}
          />
          <TextField
            label="Observações" size="small" fullWidth multiline rows={2}
            value={editNotes} onChange={e => setEditNotes(e.target.value)}
          />
          <TextField
            label="📅 Data de retorno" size="small" fullWidth type="date"
            value={editFollowUp} onChange={e => setEditFollowUp(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
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
          {pitchText && (
            <Button
              variant="outlined"
              startIcon={pitchCopied ? undefined : <ContentCopyIcon sx={{ fontSize: 14 }} />}
              onClick={() => { navigator.clipboard.writeText(pitchText).catch(() => null); setPitchCopied(true); setTimeout(() => setPitchCopied(false), 2000) }}
              sx={{ borderColor: pitchCopied ? '#00C47A' : '#b45aff', color: pitchCopied ? '#00C47A' : '#b45aff', fontWeight: 700, fontSize: '0.75rem' }}
            >
              {pitchCopied ? '✓ Copiado!' : 'Copiar mensagem'}
            </Button>
          )}
          {pitchLead && !pitchLoading && (
            <Button variant="contained" onClick={() => handleGeneratePitch(pitchLead)}
              sx={{ background: 'linear-gradient(135deg,rgba(180,90,255,0.8),rgba(255,83,57,0.6))', color: '#fff', fontWeight: 700, fontSize: '0.75rem' }}>
              Gerar novamente
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Apify Key dialog ── */}
      <Dialog open={apifyKeyOpen} onClose={() => setApifyKeyOpen(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,196,122,0.15)' } } }}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <KeyIcon sx={{ color: '#00C47A', fontSize: 20 }} />
            <Typography fontWeight={800}>Token Apify</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="info" sx={{ fontSize: '0.7rem' }}>
            Acesse <strong>console.apify.com</strong> → Settings → Integrations → API tokens → Default personal API token.
            O token fica salvo apenas no seu navegador — nunca no código.
          </Alert>
          <Alert severity="success" sx={{ fontSize: '0.7rem' }}>
            Plano gratuito: <strong>200 extrações/mês</strong> (~$0.004/lugar). Ideal para prospecção semanal.
          </Alert>
          <TextField
            fullWidth size="small" label="Apify API Token"
            value={apifyKeyInput} onChange={e => setApifyKeyInput(e.target.value)}
            placeholder="apify_api_..."
            type="password"
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setApifyKeyOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveApifyKey} disabled={!apifyKeyInput.trim()}
            sx={{ fontWeight: 700, background: 'linear-gradient(135deg,#00C47A,#00a06a)', color: '#000' }}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Import success snackbar ── */}
      <Snackbar
        open={!!apifyImported}
        autoHideDuration={4000}
        onClose={() => setApifyImported('')}
        message={`✅ ${apifyImported}`}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ content: { sx: { bgcolor: '#00C47A', color: '#000', fontWeight: 700, fontSize: '0.8rem' } } }}
      />
    </Box>
  )
}
