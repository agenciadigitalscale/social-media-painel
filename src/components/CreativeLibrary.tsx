import { BRAND, DS } from '../theme'
import { useMemo, useState } from 'react'
import { Dialog, Box, Typography, IconButton, TextField, InputAdornment, useMediaQuery, Tooltip, Menu, MenuItem } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import {
  loadCreatives, removeCreative, setCreativeStatus, creativeToText, creativeToWhatsApp, nicheByKey,
  CREATIVE_STATUS, statusMeta,
  type SavedCreative, type CreativeStatus,
} from '../lib/creativeEngine'

interface Props {
  open: boolean
  onClose: () => void
  onAbrir: (s: SavedCreative) => void
}

const ACCENT = DS.accent

// Biblioteca de Criativos: navega tudo que já foi gerado no ⚡, agrupado por cliente.
// Lê o histórico sincronizado (sm_creatives) — visível pra equipe toda.
export default function CreativeLibrary({ open, onClose, onAbrir }: Props) {
  const isMobile = useMediaQuery('(max-width:599.95px)')
  const [list, setList] = useState<SavedCreative[]>(() => loadCreatives())
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<CreativeStatus | 'all'>('all')
  const [menu, setMenu] = useState<{ anchor: HTMLElement; id: string } | null>(null)

  const grupos = useMemo(() => {
    const termo = q.trim().toLowerCase()
    const filtrados = list.filter(s => {
      if (statusFilter !== 'all' && (s.status ?? 'rascunho') !== statusFilter) return false
      if (!termo) return true
      const hay = `${s.titulo} ${s.brief.cliente} ${s.brief.produto} ${s.output.bigIdea} ${s.output.ganchoPrincipal}`.toLowerCase()
      return hay.includes(termo)
    })
    const mapa = new Map<string, SavedCreative[]>()
    filtrados.forEach(s => {
      const k = s.brief.cliente.trim() || nicheByKey(s.brief.nicho).label
      if (!mapa.has(k)) mapa.set(k, [])
      mapa.get(k)!.push(s)
    })
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [list, q, statusFilter])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    list.forEach(s => { const k = s.status ?? 'rascunho'; c[k] = (c[k] ?? 0) + 1 })
    return c
  }, [list])

  function excluir(id: string) { setList(removeCreative(id)) }
  function copy(txt: string) { navigator.clipboard?.writeText(txt).catch(() => {}) }
  function mudarStatus(id: string, status: CreativeStatus) { setList(setCreativeStatus(id, status)); setMenu(null) }

  const total = list.length

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}
      PaperProps={{ sx: { bgcolor: '#0a0b0f', backgroundImage: 'none', height: isMobile ? '100%' : '88vh', display: 'flex', flexDirection: 'column' } }}>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.3, borderBottom: '1px solid rgba(244,247,255,0.07)', flexShrink: 0 }}>
        <Typography sx={{ fontSize: '0.9rem' }}>💡</Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>Biblioteca de Criativos</Typography>
          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.4)' }}>{total} criativo{total === 1 ? '' : 's'} · {grupos.length} cliente{grupos.length === 1 ? '' : 's'}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(244,247,255,0.5)' }}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
        <TextField fullWidth size="small" placeholder="Buscar por cliente, produto, ideia…" value={q} onChange={e => setQ(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 17, color: 'rgba(244,247,255,0.35)' }} /></InputAdornment> }}
          sx={{ mb: 1.5, '& .MuiInputBase-root': { fontSize: '0.82rem', bgcolor: 'rgba(244,247,255,0.04)' } }} />

        {total > 0 && (
          <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', mb: 2 }}>
            <FilterChip label={`Todos ${total}`} color={ACCENT} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} solid />
            {CREATIVE_STATUS.map(m => (
              <FilterChip key={m.key} label={`${m.emoji} ${m.label} ${counts[m.key] ?? 0}`} color={m.color}
                active={statusFilter === m.key} onClick={() => setStatusFilter(m.key)} />
            ))}
          </Box>
        )}

        {total === 0 && (
          <Box sx={{ textAlign: 'center', py: 6, color: 'rgba(244,247,255,0.4)' }}>
            <Typography sx={{ fontSize: '2rem', mb: 1 }}>💡</Typography>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(244,247,255,0.6)' }}>Nenhum criativo salvo ainda</Typography>
            <Typography sx={{ fontSize: '0.72rem' }}>Gere um criativo no ⚡ e ele aparece aqui automaticamente.</Typography>
          </Box>
        )}

        {total > 0 && grupos.length === 0 && (
          <Typography sx={{ fontSize: '0.76rem', color: 'rgba(244,247,255,0.4)', textAlign: 'center', py: 4 }}>
            {q.trim() ? `Nada encontrado pra “${q}”.` : 'Nenhum criativo nesse status.'}
          </Typography>
        )}

        {grupos.map(([cliente, items]) => (
          <Box key={cliente} sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.62rem', letterSpacing: '0.08em', color: ACCENT, fontWeight: 800, mb: 1, textTransform: 'uppercase' }}>
              {nicheByKey(items[0].brief.nicho).emoji} {cliente} · {items.length}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {items.map(s => {
                const sm = statusMeta(s.status)
                return (
                <Box key={s.id} sx={{
                  border: '1px solid rgba(244,247,255,0.08)', borderLeft: `3px solid ${sm.color}`, borderRadius: 2.5,
                  p: 1.4, bgcolor: 'rgba(244,247,255,0.02)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.6 }}>
                    <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', flex: 1 }}>{s.brief.produto || 'Criativo'}</Typography>
                    <Tooltip title="Mudar status">
                      <Box onClick={(e) => setMenu({ anchor: e.currentTarget, id: s.id })} sx={{
                        display: 'flex', alignItems: 'center', gap: 0.3, cursor: 'pointer', whiteSpace: 'nowrap',
                        px: 0.8, py: 0.3, borderRadius: 1.4, fontSize: '0.6rem', fontWeight: 800,
                        color: sm.color, bgcolor: `${sm.color}1f`, border: `1px solid ${sm.color}66`,
                        '&:hover': { filter: 'brightness(1.15)' },
                      }}>{sm.emoji} {sm.label} <Box component="span" sx={{ opacity: 0.6 }}>⌄</Box></Box>
                    </Tooltip>
                  </Box>
                  <Typography sx={{ fontSize: '0.56rem', color: 'rgba(244,247,255,0.3)', mb: 0.5 }}>{s.brief.formato} · {s.brief.duracao} · {fromNow(s.createdAt)}</Typography>
                  <Typography sx={{ fontSize: '0.74rem', color: 'rgba(244,247,255,0.85)', lineHeight: 1.4, mb: 0.4 }}>💡 {s.output.bigIdea}</Typography>
                  <Typography noWrap sx={{ fontSize: '0.68rem', color: 'rgba(244,247,255,0.5)', mb: 1 }}>🎣 {s.output.ganchoPrincipal}</Typography>

                  <Box sx={{ display: 'flex', gap: 0.6 }}>
                    <LibBtn label="▶ Abrir"     color={ACCENT}   onClick={() => onAbrir(s)} />
                    <LibBtn label="💬 WhatsApp"  color={BRAND.whatsapp}  onClick={() => copy(creativeToWhatsApp(s.brief, s.output))} />
                    <LibBtn label="📋 Copiar"    color="rgba(244,247,255,0.55)" onClick={() => copy(creativeToText(s.brief, s.output))} />
                    <Tooltip title="Excluir">
                      <Box onClick={() => excluir(s.id)} sx={{ ml: 'auto', px: 1, py: 0.4, borderRadius: 1.5, cursor: 'pointer', fontSize: '0.72rem', color: 'rgba(255,90,90,0.7)', border: '1px solid rgba(255,90,90,0.25)', '&:hover': { bgcolor: 'rgba(255,90,90,0.12)' } }}>🗑</Box>
                    </Tooltip>
                  </Box>
                </Box>
                )
              })}
            </Box>
          </Box>
        ))}
      </Box>

      <Menu anchorEl={menu?.anchor ?? null} open={!!menu} onClose={() => setMenu(null)}
        PaperProps={{ sx: { bgcolor: '#14151a', border: '1px solid rgba(244,247,255,0.1)' } }}>
        {CREATIVE_STATUS.map(m => (
          <MenuItem key={m.key} onClick={() => menu && mudarStatus(menu.id, m.key)}
            sx={{ fontSize: '0.8rem', color: m.color, gap: 0.8 }}>
            {m.emoji} {m.label}
          </MenuItem>
        ))}
      </Menu>
    </Dialog>
  )
}

function FilterChip({ label, color, active, onClick, solid }: { label: string; color: string; active: boolean; onClick: () => void; solid?: boolean }) {
  return (
    <Box onClick={onClick} sx={{
      px: 1.1, py: 0.45, borderRadius: 1.8, cursor: 'pointer', whiteSpace: 'nowrap',
      fontSize: '0.66rem', fontWeight: 700,
      color: active && solid ? '#0a0b0f' : color,
      bgcolor: active ? (solid ? color : `${color}22`) : 'transparent',
      border: `1px solid ${active ? color : color + '55'}`,
      '&:hover': { bgcolor: active ? undefined : `${color}1a` },
    }}>{label}</Box>
  )
}

function LibBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <Box onClick={onClick} sx={{
      px: 1, py: 0.4, borderRadius: 1.5, cursor: 'pointer', whiteSpace: 'nowrap',
      fontSize: '0.68rem', fontWeight: 700, color, border: `1px solid ${color}55`,
      '&:hover': { bgcolor: `${color}1a` },
    }}>{label}</Box>
  )
}

function fromNow(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ontem'
  if (d < 30) return `há ${d} d`
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
