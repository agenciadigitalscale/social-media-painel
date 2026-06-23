import { useState, useMemo } from 'react'
import {
  Dialog, DialogContent, Box, Typography, IconButton, Button, TextField, MenuItem,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SubtitlesIcon from '@mui/icons-material/Subtitles'
import {
  ASSET_KINDS, kindMeta, loadAssets, addAsset, removeAsset, legendaProUrl,
  type AssetKind, type EditorAsset,
} from '../lib/assets'

const ORANGE = '#ff9039'

interface Props {
  open: boolean
  onClose: () => void
  clients: string[]
  currentUser?: string
  legendaContext?: { roteiro?: string; cliente?: string }
}

function FilterPill({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color: string }) {
  return (
    <Box onClick={onClick} sx={{
      px: 1, py: 0.4, borderRadius: 5, cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap',
      bgcolor: active ? `${color}22` : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? color + '66' : 'rgba(255,255,255,0.08)'}`,
      color: active ? color : 'rgba(255,255,255,0.55)',
      transition: 'all 0.15s',
      '&:hover': { borderColor: `${color}55` },
    }}>{label}</Box>
  )
}

export default function AssetCenter({ open, onClose, clients, currentUser, legendaContext }: Props) {
  const [assets, setAssets]             = useState<EditorAsset[]>(() => loadAssets())
  const [filterKind, setFilterKind]     = useState<AssetKind | 'all'>('all')
  const [filterClient, setFilterClient] = useState<string>('__all__')
  const [adding, setAdding]             = useState(false)
  const [copiedId, setCopiedId]         = useState<string | null>(null)
  const [name, setName]                 = useState('')
  const [kind, setKind]                 = useState<AssetKind>('lut')
  const [url, setUrl]                   = useState('')
  const [client, setClient]             = useState('')

  const filtered = useMemo(() => assets.filter(a =>
    (filterKind === 'all' || a.kind === filterKind) &&
    (filterClient === '__all__' || (a.clientName ?? '') === filterClient)
  ), [assets, filterKind, filterClient])

  function handleAdd() {
    if (!name.trim() || !url.trim()) return
    setAssets(addAsset({ name: name.trim(), kind, url: url.trim(), clientName: client || undefined, addedBy: currentUser }))
    setName(''); setUrl(''); setClient(''); setKind('lut'); setAdding(false)
  }

  function copy(a: EditorAsset) {
    navigator.clipboard?.writeText(a.url).catch(() => {})
    setCopiedId(a.id)
    setTimeout(() => setCopiedId(c => (c === a.id ? null : c)), 1400)
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogContent sx={{ p: 2 }}>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, flex: 1 }}>🎒 Central de Assets</Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Button
          fullWidth startIcon={<SubtitlesIcon />}
          onClick={() => window.open(legendaProUrl(legendaContext ?? {}), '_blank', 'noopener')}
          sx={{
            mb: 0.6, py: 1.2, borderRadius: 2.5, fontWeight: 800, color: '#2a1500',
            background: `linear-gradient(135deg, ${ORANGE}, #ff5339)`,
            '&:hover': { filter: 'brightness(1.06)' },
          }}
        >
          Gerar legendas no LegendaPro
        </Button>
        <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', mb: 2 }}>
          Abre o seu gerador de legendas dinâmicas{legendaContext?.cliente ? ` · cliente: ${legendaContext.cliente}` : ''}.
        </Typography>

        <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', mb: 1.2 }}>
          <FilterPill active={filterKind === 'all'} onClick={() => setFilterKind('all')} label={`Todos (${assets.length})`} color={ORANGE} />
          {ASSET_KINDS.map(k => {
            const n = assets.filter(a => a.kind === k.key).length
            return <FilterPill key={k.key} active={filterKind === k.key} onClick={() => setFilterKind(k.key)} label={`${k.emoji} ${k.label}${n ? ` (${n})` : ''}`} color={k.color} />
          })}
        </Box>

        {clients.length > 0 && (
          <TextField select size="small" fullWidth value={filterClient} onChange={e => setFilterClient(e.target.value)} sx={{ mb: 1.4 }}>
            <MenuItem value="__all__">Todos os clientes</MenuItem>
            {clients.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
        )}

        {!adding ? (
          <Button fullWidth startIcon={<AddIcon />} onClick={() => setAdding(true)}
            sx={{ mb: 1.6, py: 1, borderRadius: 2, border: '1px dashed rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.7)' }}>
            Adicionar asset
          </Button>
        ) : (
          <Box sx={{ mb: 1.6, p: 1.4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <TextField size="small" fullWidth label="Nome" value={name} onChange={e => setName(e.target.value)} sx={{ mb: 1 }} />
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField select size="small" label="Tipo" value={kind} onChange={e => setKind(e.target.value as AssetKind)} sx={{ flex: 1 }}>
                {ASSET_KINDS.map(k => <MenuItem key={k.key} value={k.key}>{k.emoji} {k.label}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Cliente" value={client} onChange={e => setClient(e.target.value)} sx={{ flex: 1 }}>
                <MenuItem value="">Geral</MenuItem>
                {clients.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Box>
            <TextField size="small" fullWidth label="Link (Drive / URL)" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://drive.google.com/..." sx={{ mb: 1.2 }} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={() => setAdding(false)} sx={{ color: 'rgba(255,255,255,0.4)' }}>Cancelar</Button>
              <Button size="small" variant="contained" onClick={handleAdd} disabled={!name.trim() || !url.trim()}
                sx={{ flex: 1, fontWeight: 700, bgcolor: ORANGE, color: '#2a1500', '&:hover': { bgcolor: ORANGE, filter: 'brightness(1.06)' } }}>
                Salvar
              </Button>
            </Box>
          </Box>
        )}

        {filtered.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '2rem', mb: 1 }}>🎒</Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', maxWidth: 270, mx: 'auto', lineHeight: 1.6 }}>
              {assets.length === 0
                ? 'Nenhum asset ainda. Adicione as LUTs, músicas e efeitos que você mais usa — ficam a um toque pro CapCut.'
                : 'Nenhum asset nesse filtro.'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
            {filtered.map(a => {
              const m = kindMeta(a.kind)
              return (
                <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <Box sx={{ width: 30, height: 30, borderRadius: 1.5, flexShrink: 0, bgcolor: `${m.color}1c`, border: `1px solid ${m.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>{m.emoji}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.58rem', color: m.color, fontWeight: 700 }}>{m.label}</Typography>
                      {a.clientName && <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)' }}>· {a.clientName}</Typography>}
                    </Box>
                  </Box>
                  <IconButton size="small" onClick={() => copy(a)} sx={{ color: copiedId === a.id ? '#00C47A' : 'rgba(255,255,255,0.45)' }}>
                    <ContentCopyIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                  <IconButton size="small" onClick={() => window.open(a.url, '_blank', 'noopener')} sx={{ color: 'rgba(255,255,255,0.55)' }}>
                    <OpenInNewIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton size="small" onClick={() => setAssets(removeAsset(a.id))} sx={{ color: 'rgba(255,69,69,0.55)' }}>
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              )
            })}
          </Box>
        )}

      </DialogContent>
    </Dialog>
  )
}
