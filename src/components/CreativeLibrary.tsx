import { useMemo, useState } from 'react'
import { Dialog, Box, Typography, IconButton, TextField, InputAdornment, useMediaQuery, Tooltip } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import {
  loadCreatives, removeCreative, creativeToText, creativeToWhatsApp, nicheByKey,
  type SavedCreative,
} from '../lib/creativeEngine'

interface Props {
  open: boolean
  onClose: () => void
  onAbrir: (s: SavedCreative) => void
}

const ORANGE = '#ff9039'

// Biblioteca de Criativos: navega tudo que já foi gerado no ⚡, agrupado por cliente.
// Lê o histórico sincronizado (sm_creatives) — visível pra equipe toda.
export default function CreativeLibrary({ open, onClose, onAbrir }: Props) {
  const isMobile = useMediaQuery('(max-width:599.95px)')
  const [list, setList] = useState<SavedCreative[]>(() => loadCreatives())
  const [q, setQ] = useState('')

  const grupos = useMemo(() => {
    const termo = q.trim().toLowerCase()
    const filtrados = !termo ? list : list.filter(s => {
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
  }, [list, q])

  function excluir(id: string) { setList(removeCreative(id)) }
  function copy(txt: string) { navigator.clipboard?.writeText(txt).catch(() => {}) }

  const total = list.length

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}
      PaperProps={{ sx: { bgcolor: '#0a0b0f', backgroundImage: 'none', height: isMobile ? '100%' : '88vh', display: 'flex', flexDirection: 'column' } }}>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.3, borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <Typography sx={{ fontSize: '0.9rem' }}>💡</Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>Biblioteca de Criativos</Typography>
          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)' }}>{total} criativo{total === 1 ? '' : 's'} · {grupos.length} cliente{grupos.length === 1 ? '' : 's'}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
        <TextField fullWidth size="small" placeholder="Buscar por cliente, produto, ideia…" value={q} onChange={e => setQ(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 17, color: 'rgba(255,255,255,0.35)' }} /></InputAdornment> }}
          sx={{ mb: 2, '& .MuiInputBase-root': { fontSize: '0.82rem', bgcolor: 'rgba(255,255,255,0.04)' } }} />

        {total === 0 && (
          <Box sx={{ textAlign: 'center', py: 6, color: 'rgba(255,255,255,0.4)' }}>
            <Typography sx={{ fontSize: '2rem', mb: 1 }}>💡</Typography>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Nenhum criativo salvo ainda</Typography>
            <Typography sx={{ fontSize: '0.72rem' }}>Gere um criativo no ⚡ e ele aparece aqui automaticamente.</Typography>
          </Box>
        )}

        {total > 0 && grupos.length === 0 && (
          <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', py: 4 }}>Nada encontrado pra “{q}”.</Typography>
        )}

        {grupos.map(([cliente, items]) => (
          <Box key={cliente} sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.62rem', letterSpacing: '0.08em', color: ORANGE, fontWeight: 800, mb: 1, textTransform: 'uppercase' }}>
              {nicheByKey(items[0].brief.nicho).emoji} {cliente} · {items.length}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {items.map(s => (
                <Box key={s.id} sx={{
                  border: '1px solid rgba(255,255,255,0.08)', borderLeft: `3px solid ${ORANGE}`, borderRadius: 2.5,
                  p: 1.4, bgcolor: 'rgba(255,255,255,0.02)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.6 }}>
                    <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', flex: 1 }}>{s.brief.produto || 'Criativo'}</Typography>
                    <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>{s.brief.formato} · {s.brief.duracao} · {fromNow(s.createdAt)}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, mb: 0.4 }}>💡 {s.output.bigIdea}</Typography>
                  <Typography noWrap sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', mb: 1 }}>🎣 {s.output.ganchoPrincipal}</Typography>

                  <Box sx={{ display: 'flex', gap: 0.6 }}>
                    <LibBtn label="▶ Abrir"     color={ORANGE}   onClick={() => onAbrir(s)} />
                    <LibBtn label="💬 WhatsApp"  color="#25D366"  onClick={() => copy(creativeToWhatsApp(s.brief, s.output))} />
                    <LibBtn label="📋 Copiar"    color="rgba(255,255,255,0.55)" onClick={() => copy(creativeToText(s.brief, s.output))} />
                    <Tooltip title="Excluir">
                      <Box onClick={() => excluir(s.id)} sx={{ ml: 'auto', px: 1, py: 0.4, borderRadius: 1.5, cursor: 'pointer', fontSize: '0.72rem', color: 'rgba(255,90,90,0.7)', border: '1px solid rgba(255,90,90,0.25)', '&:hover': { bgcolor: 'rgba(255,90,90,0.12)' } }}>🗑</Box>
                    </Tooltip>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Dialog>
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
