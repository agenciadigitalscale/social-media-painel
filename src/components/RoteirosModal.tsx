import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, ToggleButtonGroup, ToggleButton,
  Box, Typography, List, ListItem, ListItemText, IconButton,
  Chip, Divider, Alert, Tooltip, CircularProgress,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import RefreshIcon from '@mui/icons-material/Refresh'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import LinkIcon from '@mui/icons-material/Link'
import FolderIcon from '@mui/icons-material/Folder'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import BoltIcon from '@mui/icons-material/Bolt'
import type { ContentType, Roteiro } from '../types'

function extractFolderId(url: string): string | null {
  const m = url.match(/folders\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : null
}

function guessType(name: string): ContentType {
  const l = name.toLowerCase()
  if (l.includes('reel') || l.includes('vídeo') || l.includes('video') || l.includes('reels')) return 'Reel'
  return 'Post'
}

interface DriveItem { name: string; id: string; isFolder: boolean; type: ContentType; selected: boolean }

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function getMonthOptions() {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    return { year: d.getFullYear(), month: d.getMonth(), label: `${MONTH_NAMES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` }
  })
}

interface Props {
  open: boolean
  clientName: string
  roteiros: Roteiro[]
  distributedCount: number
  driveFolder?: string
  onAdd: (r: Omit<Roteiro, 'id' | 'clientName' | 'distributed'>, year: number, month: number) => void
  onBulkCreate: (posts: number, reels: number, year: number, month: number) => void
  onRemove: (id: string) => void
  onRedistribute: (year: number, month: number) => void
  onClearDistribution: (year: number, month: number) => void
  onSetDriveFolder: (url: string) => void
  onClose: () => void
}

export default function RoteirosModal({
  open, clientName, roteiros, distributedCount, driveFolder,
  onAdd, onBulkCreate, onRemove, onRedistribute, onClearDistribution, onSetDriveFolder, onClose,
}: Props) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ContentType>('Post')
  const [itemLink, setItemLink] = useState('')
  const [folderInput, setFolderInput] = useState(driveFolder ?? '')
  const monthOptions = getMonthOptions()
  const [targetIdx, setTargetIdx] = useState(0)
  const target = monthOptions[targetIdx]
  const [bulkPosts, setBulkPosts] = useState(8)
  const [bulkReels, setBulkReels] = useState(4)
  const [driveItems, setDriveItems] = useState<DriveItem[]>([])
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)

  const importFromDrive = async () => {
    const folderId = extractFolderId(folderInput || driveFolder || '')
    if (!folderId) { setDriveError('URL inválida — use o link da pasta do Drive'); return }
    setDriveLoading(true)
    setDriveError(null)
    setDriveItems([])
    try {
      const res = await fetch(`/api/drive?folderId=${folderId}`)
      const data = await res.json() as { files?: { name: string; id: string; isFolder: boolean }[]; error?: string }
      if (data.error) { setDriveError(data.error); return }
      const items = (data.files ?? []).map(f => ({
        name: f.name, id: f.id, isFolder: f.isFolder,
        type: guessType(f.name) as ContentType,
        selected: true,
      }))
      if (items.length === 0) { setDriveError('Nenhuma pasta/arquivo encontrado. Verifique se a pasta é pública.'); return }
      setDriveItems(items)
    } catch {
      setDriveError('Erro ao conectar com o servidor')
    } finally {
      setDriveLoading(false)
    }
  }

  const createFromDrive = () => {
    const selected = driveItems.filter(i => i.selected)
    selected.forEach(item => {
      onAdd({ title: item.name, type: item.type, driveLink: folderInput || driveFolder || undefined }, target.year, target.month)
    })
    setDriveItems([])
  }

  const handleAdd = () => {
    if (!title.trim()) return
    const link = itemLink.trim() || driveFolder || ''
    onAdd({ title: title.trim(), type, driveLink: link || undefined }, target.year, target.month)
    setTitle('')
    setItemLink('')
  }

  const handleSaveFolder = () => {
    onSetDriveFolder(folderInput.trim())
  }

  const allDistributed = roteiros.length > 0 && roteiros.every(r => r.distributed)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(255,144,57,0.2)', borderRadius: 3, maxHeight: '92vh' } }}
    >
      <DialogTitle sx={{ pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Roteiros</Typography>
            <Typography variant="caption" color="primary.main" fontWeight={600}>{clientName}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
            {allDistributed && (
              <Chip icon={<CheckCircleIcon sx={{ fontSize: '11px !important' }} />} label="Distribuído" size="small" color="success" variant="outlined" sx={{ fontSize: '0.58rem', height: 20 }} />
            )}
            <Chip label={`${roteiros.length} roteiro${roteiros.length !== 1 ? 's' : ''}`} size="small" color={roteiros.length > 0 ? 'primary' : 'default'} variant="outlined" sx={{ fontSize: '0.62rem' }} />
          </Box>
        </Box>
      </DialogTitle>

      <Divider sx={{ opacity: 0.1 }} />

      <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

        {/* ── Pasta Drive do cliente ── */}
        <Box sx={{ p: 1.2, border: '1px solid rgba(0,196,122,0.2)', borderRadius: 2, bgcolor: 'rgba(0,196,122,0.04)' }}>
          <Typography variant="caption" color="success.main" fontWeight={700} sx={{ display: 'block', mb: 0.8, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <FolderIcon sx={{ fontSize: 11, mr: 0.4, verticalAlign: 'middle' }} />
            Pasta Drive do cliente (pré-preenche todos os roteiros)
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="https://drive.google.com/drive/folders/..."
              value={folderInput}
              onChange={e => setFolderInput(e.target.value)}
              onBlur={handleSaveFolder}
              slotProps={{ input: { startAdornment: <LinkIcon sx={{ mr: 0.5, fontSize: 14, color: 'success.main', flexShrink: 0 }} /> } }}
            />
            {folderInput && (
              <Tooltip title="Abrir pasta no Drive">
                <IconButton size="small" component="a" href={folderInput} target="_blank" rel="noopener" sx={{ bgcolor: 'rgba(0,196,122,0.1)', flexShrink: 0 }}>
                  <OpenInNewIcon sx={{ fontSize: 13, color: 'success.main' }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          {driveFolder && <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.58rem', display: 'block', mt: 0.4 }}>✓ Salvo — usado como link padrão dos roteiros</Typography>}

          {/* Botão importar */}
          {(folderInput || driveFolder) && (
            <Button
              fullWidth size="small" variant="outlined" color="success"
              startIcon={driveLoading ? <CircularProgress size={12} color="inherit" /> : <CloudDownloadIcon />}
              onClick={importFromDrive}
              disabled={driveLoading}
              sx={{ mt: 1, fontSize: '0.65rem', fontWeight: 700, borderColor: 'rgba(0,196,122,0.4)' }}
            >
              {driveLoading ? 'Lendo pastas do Drive...' : 'Importar nomes das pastas do Drive'}
            </Button>
          )}

          {/* Erro */}
          {driveError && <Alert severity="error" sx={{ mt: 0.5, fontSize: '0.65rem', py: 0.4 }} onClose={() => setDriveError(null)}>{driveError}</Alert>}

          {/* Lista de itens do Drive */}
          {driveItems.length > 0 && (
            <Box sx={{ mt: 1, border: '1px solid rgba(0,196,122,0.2)', borderRadius: 1.5, overflow: 'hidden' }}>
              <Box sx={{ px: 1.2, py: 0.6, bgcolor: 'rgba(0,196,122,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '0.58rem', color: 'success.main', fontWeight: 700 }}>
                  {driveItems.filter(i => i.selected).length} de {driveItems.length} selecionados
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {monthOptions.map((opt, idx) => (
                    <Chip key={opt.label} label={opt.label} size="small"
                      variant={targetIdx === idx ? 'filled' : 'outlined'}
                      color={targetIdx === idx ? 'primary' : 'default'}
                      onClick={() => setTargetIdx(idx)}
                      sx={{ fontSize: '0.45rem', height: 14, cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              </Box>
              <List disablePadding dense sx={{ maxHeight: 180, overflowY: 'auto' }}>
                {driveItems.map((item, idx) => (
                  <ListItem key={item.id} disablePadding sx={{ px: 1, py: 0.3, borderBottom: '1px solid rgba(255,255,255,0.04)', bgcolor: item.selected ? 'rgba(0,196,122,0.03)' : 'transparent' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, width: '100%' }}>
                      <Box
                        onClick={() => setDriveItems(prev => prev.map((d, i) => i === idx ? { ...d, selected: !d.selected } : d))}
                        sx={{ width: 14, height: 14, borderRadius: 0.5, border: '1.5px solid', borderColor: item.selected ? 'success.main' : 'rgba(255,255,255,0.2)', bgcolor: item.selected ? 'success.main' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {item.selected && <Box sx={{ width: 6, height: 6, bgcolor: '#000', borderRadius: 0.3 }} />}
                      </Box>
                      <FolderIcon sx={{ fontSize: 12, color: 'success.main', flexShrink: 0 }} />
                      <Typography sx={{ flex: 1, fontSize: '0.68rem', fontWeight: 600 }} noWrap>{item.name}</Typography>
                      <ToggleButtonGroup size="small" value={item.type} exclusive
                        onChange={(_, v) => v && setDriveItems(prev => prev.map((d, i) => i === idx ? { ...d, type: v } : d))}
                      >
                        <ToggleButton value="Post" sx={{ fontSize: '0.45rem', px: 0.6, py: 0, minHeight: 18, lineHeight: 1 }}>Post</ToggleButton>
                        <ToggleButton value="Reel" sx={{ fontSize: '0.45rem', px: 0.6, py: 0, minHeight: 18, lineHeight: 1 }}>Reel</ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                  </ListItem>
                ))}
              </List>
              <Box sx={{ p: 1 }}>
                <Button
                  fullWidth size="small" variant="contained" color="success"
                  startIcon={<BoltIcon />}
                  disabled={driveItems.filter(i => i.selected).length === 0}
                  onClick={createFromDrive}
                  sx={{ fontWeight: 800, fontSize: '0.68rem' }}
                >
                  Criar {driveItems.filter(i => i.selected).length} roteiros e distribuir em {target.label}
                </Button>
              </Box>
            </Box>
          )}
        </Box>

        {/* ── Criar em massa ── */}
        <Box sx={{ p: 1.2, border: '1px solid rgba(255,144,57,0.25)', borderRadius: 2, bgcolor: 'rgba(255,144,57,0.04)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              <BoltIcon sx={{ fontSize: 11, mr: 0.4, verticalAlign: 'middle' }} />
              Criar em massa e distribuir todo o mês
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.4, overflowX: 'auto', maxWidth: 180, pb: 0.2, '&::-webkit-scrollbar': { height: 2 } }}>
              {monthOptions.map((opt, idx) => (
                <Chip key={opt.label} label={opt.label} size="small"
                  variant={targetIdx === idx ? 'filled' : 'outlined'}
                  color={targetIdx === idx ? 'primary' : 'default'}
                  onClick={() => setTargetIdx(idx)}
                  sx={{ fontSize: '0.5rem', height: 16, cursor: 'pointer', flexShrink: 0 }}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, mb: 1, alignItems: 'center' }}>
            {/* Posts counter */}
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.55rem', color: 'primary.main', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>Posts</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                <IconButton size="small" onClick={() => setBulkPosts(p => Math.max(0, p - 1))} sx={{ width: 24, height: 24, border: '1px solid rgba(255,144,57,0.3)' }}>
                  <RemoveIcon sx={{ fontSize: 12 }} />
                </IconButton>
                <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: 'primary.main', minWidth: 28, textAlign: 'center' }}>{bulkPosts}</Typography>
                <IconButton size="small" onClick={() => setBulkPosts(p => Math.min(30, p + 1))} sx={{ width: 24, height: 24, border: '1px solid rgba(255,144,57,0.3)' }}>
                  <AddIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Box>
            </Box>

            <Typography sx={{ color: 'text.disabled', fontWeight: 700 }}>+</Typography>

            {/* Reels counter */}
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.55rem', color: 'info.main', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>Reels</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                <IconButton size="small" onClick={() => setBulkReels(r => Math.max(0, r - 1))} sx={{ width: 24, height: 24, border: '1px solid rgba(59,142,255,0.3)' }}>
                  <RemoveIcon sx={{ fontSize: 12, color: 'info.main' }} />
                </IconButton>
                <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: 'info.main', minWidth: 28, textAlign: 'center' }}>{bulkReels}</Typography>
                <IconButton size="small" onClick={() => setBulkReels(r => Math.min(30, r + 1))} sx={{ width: 24, height: 24, border: '1px solid rgba(59,142,255,0.3)' }}>
                  <AddIcon sx={{ fontSize: 12, color: 'info.main' }} />
                </IconButton>
              </Box>
            </Box>

            <Typography sx={{ color: 'text.disabled', fontWeight: 700 }}>=</Typography>

            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>Total</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: bulkPosts + bulkReels > 0 ? 'success.main' : 'text.disabled' }}>
                {bulkPosts + bulkReels}
              </Typography>
            </Box>
          </Box>

          <Button
            fullWidth size="small" variant="contained" color="primary"
            startIcon={<BoltIcon />}
            disabled={bulkPosts + bulkReels === 0}
            onClick={() => {
              onBulkCreate(bulkPosts, bulkReels, target.year, target.month)
              onClose()
            }}
            sx={{ fontWeight: 800, background: 'linear-gradient(135deg,#ff9039,#ff5339)', fontSize: '0.7rem' }}
          >
            Criar {bulkPosts + bulkReels} itens e distribuir em {target.label}
          </Button>
        </Box>

        {/* ── Adicionar roteiro ── */}
        <Box sx={{ p: 1.2, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              <AutoFixHighIcon sx={{ fontSize: 11, mr: 0.4, verticalAlign: 'middle' }} />
              Adicionar roteiro → distribui automaticamente
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.4 }}>
              {monthOptions.map((opt, idx) => (
                <Chip
                  key={opt.label}
                  label={opt.label}
                  size="small"
                  variant={targetIdx === idx ? 'filled' : 'outlined'}
                  color={targetIdx === idx ? 'primary' : 'default'}
                  onClick={() => setTargetIdx(idx)}
                  sx={{ fontSize: '0.55rem', height: 18, cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mb: 0.8 }}>
            <TextField
              size="small"
              placeholder="Título / tema do conteúdo"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              sx={{ flex: 1 }}
              autoFocus
            />
            <ToggleButtonGroup size="small" value={type} exclusive onChange={(_, v) => v && setType(v)}>
              <ToggleButton value="Post" sx={{ fontSize: '0.65rem', px: 1.2 }}>Post</ToggleButton>
              <ToggleButton value="Reel" sx={{ fontSize: '0.65rem', px: 1.2 }}>Reel</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {!driveFolder && (
            <TextField
              size="small"
              fullWidth
              placeholder="Link Drive específico (opcional — usa pasta do cliente se vazia)"
              value={itemLink}
              onChange={e => setItemLink(e.target.value)}
              sx={{ mb: 0.8 }}
              slotProps={{ input: { startAdornment: <LinkIcon sx={{ mr: 0.5, fontSize: 14, color: 'text.disabled' }} /> } }}
            />
          )}

          <Button
            fullWidth
            size="small"
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAdd}
            disabled={!title.trim()}
            sx={{ fontWeight: 700 }}
          >
            Adicionar e distribuir no calendário
          </Button>
        </Box>

        {/* ── Lista de roteiros ── */}
        {roteiros.length === 0 ? (
          <Box sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
              Nenhum roteiro ainda
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Adicione acima — cada roteiro vai direto para o calendário
            </Typography>
          </Box>
        ) : (
          <>
            {distributedCount > 0 && (
              <Alert severity="success" sx={{ fontSize: '0.7rem', py: 0.4 }}>
                {distributedCount} conteúdo{distributedCount > 1 ? 's' : ''} no calendário deste mês
              </Alert>
            )}
            <List disablePadding dense>
              {roteiros.map((r, idx) => (
                <ListItem
                  key={r.id}
                  disablePadding
                  sx={{
                    mb: 0.4, px: 1, py: 0.6,
                    border: '1px solid',
                    borderColor: r.distributed ? 'rgba(0,196,122,0.2)' : 'rgba(255,255,255,0.06)',
                    borderRadius: 1.5,
                    bgcolor: r.distributed ? 'rgba(0,196,122,0.04)' : 'transparent',
                  }}
                  secondaryAction={
                    <IconButton size="small" onClick={() => onRemove(r.id)} sx={{ color: 'error.main', opacity: 0.5, '&:hover': { opacity: 1 } }}>
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                        <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', minWidth: 14 }}>{idx + 1}.</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem' }} noWrap>{r.title}</Typography>
                        <Chip label={r.type} size="small" sx={{ height: 14, fontSize: '0.5rem', flexShrink: 0, bgcolor: r.type === 'Reel' ? 'rgba(59,142,255,0.15)' : 'rgba(255,144,57,0.15)', color: r.type === 'Reel' ? 'info.main' : 'primary.main' }} />
                        {r.distributed && <CheckCircleIcon sx={{ fontSize: 11, color: 'success.main', flexShrink: 0 }} />}
                      </Box>
                    }
                    secondary={r.driveLink && (
                      <Box component="a" href={r.driveLink} target="_blank" rel="noopener" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3, color: 'success.main', textDecoration: 'none', fontSize: '0.58rem', mt: 0.2 }}>
                        <LinkIcon sx={{ fontSize: 9 }} /> Drive
                      </Box>
                    )}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>

      <Divider sx={{ opacity: 0.1 }} />

      <DialogActions sx={{ px: 2, py: 1, gap: 0.8, flexWrap: 'wrap' }}>
        {distributedCount > 0 && (
          <Tooltip title={`Remove itens de ${target.label} do calendário`}>
            <Button size="small" color="error" startIcon={<ClearAllIcon />} onClick={() => onClearDistribution(target.year, target.month)} sx={{ fontSize: '0.62rem' }}>
              Limpar {target.label}
            </Button>
          </Tooltip>
        )}
        {roteiros.length > 0 && (
          <Tooltip title={`Redistribui roteiros em ${target.label}`}>
            <Button size="small" color="warning" startIcon={<RefreshIcon />} onClick={() => onRedistribute(target.year, target.month)} sx={{ fontSize: '0.62rem' }}>
              Redistribuir {target.label}
            </Button>
          </Tooltip>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} size="small" variant="outlined">Fechar</Button>
      </DialogActions>
    </Dialog>
  )
}
