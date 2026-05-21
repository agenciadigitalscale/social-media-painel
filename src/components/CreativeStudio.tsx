import { useState, useCallback } from 'react'
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Paper, CircularProgress, Chip,
  IconButton, Tooltip, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions, InputAdornment, Avatar,
  Grid, Stack, Alert, Collapse,
} from '@mui/material'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import DownloadIcon from '@mui/icons-material/Download'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import KeyIcon from '@mui/icons-material/Key'
import PaletteIcon from '@mui/icons-material/Palette'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ImageIcon from '@mui/icons-material/Image'
import SmartphoneIcon from '@mui/icons-material/Smartphone'
import ViewCarouselIcon from '@mui/icons-material/ViewCarousel'
import type { Client, BrandingKit, CreativeFormat, GeneratedCreative } from '../types'

// ── Storage helpers ─────────────────────────────────────────────────────────

function loadBrandKits(): Record<string, BrandingKit> {
  try { return JSON.parse(localStorage.getItem('sm_brand_kits') || '{}') }
  catch { return {} }
}

function saveBrandKits(kits: Record<string, BrandingKit>) {
  localStorage.setItem('sm_brand_kits', JSON.stringify(kits))
}

function loadCreatives(): GeneratedCreative[] {
  try { return JSON.parse(localStorage.getItem('sm_creatives') || '[]') }
  catch { return [] }
}

function saveCreatives(list: GeneratedCreative[]) {
  // keep latest 50
  localStorage.setItem('sm_creatives', JSON.stringify(list.slice(0, 50)))
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface BrandingEditorProps {
  kit: BrandingKit
  onChange: (kit: BrandingKit) => void
}

function BrandingEditor({ kit, onChange }: BrandingEditorProps) {
  const set = (field: keyof BrandingKit) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...kit, [field]: e.target.value })

  const STYLE_OPTIONS = [
    'Minimalista e elegante',
    'Vibrante e moderno',
    'Rústico e artesanal',
    'Sofisticado e premium',
    'Divertido e colorido',
    'Profissional e corporativo',
    'Natural e orgânico',
  ]

  const FONT_OPTIONS = [
    'Moderna sans-serif',
    'Serifada premium',
    'Script/caligráfica',
    'Display bold',
    'Minimalista light',
  ]

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
            Cor primária
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="input"
              type="color"
              value={kit.primaryColor || '#ff9039'}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onChange({ ...kit, primaryColor: e.target.value })
              }
              sx={{
                width: 40, height: 40, border: 'none', borderRadius: 1,
                cursor: 'pointer', background: 'none', p: 0,
              }}
            />
            <TextField
              size="small"
              value={kit.primaryColor || ''}
              onChange={set('primaryColor')}
              placeholder="#ff9039"
              sx={{ flex: 1 }}
            />
          </Box>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
            Cor secundária
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="input"
              type="color"
              value={kit.secondaryColor || '#ff5339'}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onChange({ ...kit, secondaryColor: e.target.value })
              }
              sx={{
                width: 40, height: 40, border: 'none', borderRadius: 1,
                cursor: 'pointer', background: 'none', p: 0,
              }}
            />
            <TextField
              size="small"
              value={kit.secondaryColor || ''}
              onChange={set('secondaryColor')}
              placeholder="#ff5339"
              sx={{ flex: 1 }}
            />
          </Box>
        </Box>
      </Box>

      <FormControl size="small" fullWidth>
        <InputLabel>Estilo visual</InputLabel>
        <Select
          value={kit.style || ''}
          label="Estilo visual"
          onChange={(e) => onChange({ ...kit, style: e.target.value })}
        >
          <MenuItem value=""><em>Nenhum</em></MenuItem>
          {STYLE_OPTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </Select>
      </FormControl>

      <FormControl size="small" fullWidth>
        <InputLabel>Tipografia</InputLabel>
        <Select
          value={kit.font || ''}
          label="Tipografia"
          onChange={(e) => onChange({ ...kit, font: e.target.value })}
        >
          <MenuItem value=""><em>Nenhuma</em></MenuItem>
          {FONT_OPTIONS.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
        </Select>
      </FormControl>

      <TextField
        size="small"
        label="Contexto da marca"
        placeholder="ex: padaria artesanal, público classe A, tom sofisticado e aconchegante"
        value={kit.extraContext || ''}
        onChange={set('extraContext')}
        multiline
        rows={2}
        fullWidth
      />

      <TextField
        size="small"
        label="URL do logo (opcional)"
        placeholder="https://drive.google.com/..."
        value={kit.logoUrl || ''}
        onChange={set('logoUrl')}
        fullWidth
      />
    </Stack>
  )
}

// ── Format selector ─────────────────────────────────────────────────────────

interface FormatButtonProps {
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  desc: string
}

function FormatButton({ selected, onClick, icon, label, desc }: FormatButtonProps) {
  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 1.5, cursor: 'pointer', flex: 1, textAlign: 'center',
        border: '1.5px solid',
        borderColor: selected ? 'primary.main' : 'rgba(255,255,255,0.08)',
        background: selected ? 'rgba(255,144,57,0.1)' : 'rgba(255,255,255,0.03)',
        transition: 'all 0.15s',
        '&:hover': { borderColor: 'primary.light', background: 'rgba(255,144,57,0.07)' },
      }}
    >
      <Box sx={{ color: selected ? 'primary.main' : 'text.secondary', mb: 0.5 }}>{icon}</Box>
      <Typography variant="caption" fontWeight={600} display="block">{label}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>{desc}</Typography>
    </Paper>
  )
}

// ── Creative card (gallery) ─────────────────────────────────────────────────

interface CreativeCardProps {
  creative: GeneratedCreative
  onDelete: () => void
}

function CreativeCard({ creative, onDelete }: CreativeCardProps) {
  const isStory = creative.format === 'story'

  const download = () => {
    const a = document.createElement('a')
    a.href = creative.imageUrl
    a.download = `criativo-${creative.clientName.toLowerCase().replace(/\s+/g, '-')}-${creative.id}.png`
    a.target = '_blank'
    a.click()
  }

  return (
    <Paper
      sx={{
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          paddingTop: isStory ? '177.78%' : '100%',
          background: '#111',
          overflow: 'hidden',
        }}
      >
        <Box
          component="img"
          src={creative.imageUrl}
          alt={creative.command}
          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
            e.currentTarget.style.display = 'none'
          }}
          sx={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover',
          }}
        />
        <Box
          sx={{
            position: 'absolute', top: 6, right: 6,
            display: 'flex', gap: 0.5,
          }}
        >
          <Tooltip title="Baixar">
            <IconButton
              size="small"
              onClick={download}
              sx={{ background: 'rgba(0,0,0,0.7)', '&:hover': { background: 'rgba(0,0,0,0.9)' } }}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Abrir em nova aba">
            <IconButton
              size="small"
              onClick={() => window.open(creative.imageUrl, '_blank')}
              sx={{ background: 'rgba(0,0,0,0.7)', '&:hover': { background: 'rgba(0,0,0,0.9)' } }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Box
          sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
            p: 1,
          }}
        >
          <Typography variant="caption" fontWeight={600} display="block" noWrap>
            {creative.clientName}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }} noWrap>
            {creative.command}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ p: 0.75, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Chip
          label={creative.format}
          size="small"
          sx={{ fontSize: '0.6rem', height: 18 }}
        />
        <Tooltip title="Remover da galeria">
          <IconButton size="small" onClick={onDelete}>
            <DeleteOutlineIcon fontSize="small" sx={{ fontSize: '0.9rem' }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

interface CreativeStudioProps {
  allClients: Client[]
}

export default function CreativeStudio({ allClients }: CreativeStudioProps) {
  const [selectedClient, setSelectedClient] = useState(allClients[0]?.name || '')
  const [command, setCommand] = useState('')
  const [format, setFormat] = useState<CreativeFormat>('post')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [revisedPrompt, setRevisedPrompt] = useState('')

  const [brandKits, setBrandKitsState] = useState<Record<string, BrandingKit>>(loadBrandKits)
  const [creatives, setCreatives] = useState<GeneratedCreative[]>(loadCreatives)

  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('sm_openai_key') || '')
  const [keyOpen, setKeyOpen] = useState(false)
  const [keyInput, setKeyInput] = useState('')

  const [brandingOpen, setBrandingOpen] = useState(false)
  const [editingKit, setEditingKit] = useState<BrandingKit>({})

  const clientKit = brandKits[selectedClient] || {}

  const updateBrandKit = useCallback((kit: BrandingKit) => {
    const next = { ...brandKits, [selectedClient]: kit }
    setBrandKitsState(next)
    saveBrandKits(next)
  }, [brandKits, selectedClient])

  const openBranding = () => {
    setEditingKit({ ...clientKit })
    setBrandingOpen(true)
  }

  const saveBranding = () => {
    updateBrandKit(editingKit)
    setBrandingOpen(false)
  }

  const saveKey = () => {
    localStorage.setItem('sm_openai_key', keyInput.trim())
    setOpenaiKey(keyInput.trim())
    setKeyOpen(false)
  }

  const generate = async () => {
    if (!command.trim()) { setError('Digite um comando para o criativo.'); return }
    if (!openaiKey) { setError('Configure sua chave OpenAI primeiro.'); setKeyOpen(true); return }

    setError('')
    setGenerating(true)
    setPreviewUrl('')
    setRevisedPrompt('')

    try {
      const res = await fetch('/api/creative', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenAI-Key': openaiKey,
        },
        body: JSON.stringify({
          command: command.trim(),
          format,
          clientName: selectedClient,
          branding: clientKit,
        }),
      })

      const data = await res.json() as { ok: boolean; imageUrl?: string; revisedPrompt?: string; error?: string }

      if (!data.ok || !data.imageUrl) {
        setError(data.error || 'Erro ao gerar criativo.')
        return
      }

      setPreviewUrl(data.imageUrl)
      if (data.revisedPrompt) setRevisedPrompt(data.revisedPrompt)

      const newCreative: GeneratedCreative = {
        id: Date.now().toString(36),
        clientName: selectedClient,
        command: command.trim(),
        format,
        imageUrl: data.imageUrl,
        revisedPrompt: data.revisedPrompt,
        createdAt: Date.now(),
      }

      const next = [newCreative, ...creatives]
      setCreatives(next)
      saveCreatives(next)
    } catch (e) {
      setError('Erro de rede: ' + String(e))
    } finally {
      setGenerating(false)
    }
  }

  const deleteCreative = (id: string) => {
    const next = creatives.filter(c => c.id !== id)
    setCreatives(next)
    saveCreatives(next)
  }

  const hasBranding = !!(clientKit.primaryColor || clientKit.style || clientKit.extraContext)

  const COMMAND_EXAMPLES = [
    'Story para promoção do dia das mães',
    'Post de novo produto chegando',
    'Carrossel com dicas da categoria',
    'Story de depoimento de cliente',
    'Post comemorativo com desconto 20%',
  ]

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AutoFixHighIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          <Box>
            <Typography variant="h6" fontWeight={700}>Creative Studio</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Geração de criativos com IA · DALL-E 3
            </Typography>
          </Box>
        </Box>

        <Button
          size="small"
          variant={openaiKey ? 'outlined' : 'contained'}
          startIcon={<KeyIcon />}
          onClick={() => { setKeyInput(openaiKey); setKeyOpen(true) }}
          color={openaiKey ? 'success' : 'primary'}
          sx={{ fontSize: '0.75rem' }}
        >
          {openaiKey ? 'Chave OpenAI ✓' : 'Configurar chave OpenAI'}
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* ── Left panel: controls ─────────────────────────────── */}
        <Grid item xs={12} md={5} xl={4}>
          <Stack spacing={2}>
            {/* Client selector */}
            <FormControl fullWidth size="small">
              <InputLabel>Cliente</InputLabel>
              <Select
                value={selectedClient}
                label="Cliente"
                onChange={(e) => setSelectedClient(e.target.value)}
              >
                {allClients.map(c => (
                  <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Branding kit summary */}
            <Paper
              sx={{
                p: 1.5,
                border: '1px solid',
                borderColor: hasBranding ? 'rgba(255,144,57,0.3)' : 'rgba(255,255,255,0.08)',
                background: hasBranding ? 'rgba(255,144,57,0.06)' : 'rgba(255,255,255,0.02)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PaletteIcon sx={{ fontSize: 16, color: hasBranding ? 'primary.main' : 'text.secondary' }} />
                  <Typography variant="caption" fontWeight={600}>
                    Branding Kit — {selectedClient}
                  </Typography>
                  {hasBranding && <Chip label="Configurado" size="small" color="warning" sx={{ height: 16, fontSize: '0.6rem' }} />}
                </Box>
                <Button size="small" onClick={openBranding} sx={{ fontSize: '0.7rem', minWidth: 0 }}>
                  {hasBranding ? 'Editar' : 'Configurar'}
                </Button>
              </Box>

              {hasBranding && (
                <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  {clientKit.primaryColor && (
                    <Box sx={{ width: 20, height: 20, borderRadius: '50%', background: clientKit.primaryColor, border: '2px solid rgba(255,255,255,0.2)' }} />
                  )}
                  {clientKit.secondaryColor && (
                    <Box sx={{ width: 20, height: 20, borderRadius: '50%', background: clientKit.secondaryColor, border: '2px solid rgba(255,255,255,0.2)' }} />
                  )}
                  {clientKit.style && <Chip label={clientKit.style} size="small" sx={{ height: 18, fontSize: '0.62rem' }} />}
                  {clientKit.font && <Chip label={clientKit.font} size="small" sx={{ height: 18, fontSize: '0.62rem' }} />}
                </Box>
              )}

              {!hasBranding && (
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                  Configure as cores e estilo para criativos mais precisos.
                </Typography>
              )}
            </Paper>

            {/* Format */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block', fontWeight: 600 }}>
                Formato
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <FormatButton
                  selected={format === 'post'}
                  onClick={() => setFormat('post')}
                  icon={<ImageIcon fontSize="small" />}
                  label="Post"
                  desc="1:1 Feed"
                />
                <FormatButton
                  selected={format === 'story'}
                  onClick={() => setFormat('story')}
                  icon={<SmartphoneIcon fontSize="small" />}
                  label="Story"
                  desc="9:16"
                />
                <FormatButton
                  selected={format === 'carrossel'}
                  onClick={() => setFormat('carrossel')}
                  icon={<ViewCarouselIcon fontSize="small" />}
                  label="Carrossel"
                  desc="1:1 Slide"
                />
              </Box>
            </Box>

            {/* Command */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block', fontWeight: 600 }}>
                Comando
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Descreva o criativo que deseja gerar…"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate()
                }}
                sx={{ mb: 1 }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Exemplos:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {COMMAND_EXAMPLES.map(ex => (
                  <Chip
                    key={ex}
                    label={ex}
                    size="small"
                    onClick={() => setCommand(ex)}
                    sx={{
                      fontSize: '0.62rem', height: 20, cursor: 'pointer',
                      '&:hover': { background: 'rgba(255,144,57,0.15)' },
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Generate button */}
            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <AutoFixHighIcon />}
              onClick={generate}
              disabled={generating || !command.trim()}
              sx={{ py: 1.5, fontSize: '1rem', fontWeight: 700 }}
            >
              {generating ? 'Gerando…' : 'Gerar Criativo'}
            </Button>

            <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center', display: 'block' }}>
              Cada geração usa 1 crédito da sua conta OpenAI (~$0,04)
            </Typography>

            <Collapse in={!!error}>
              <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
            </Collapse>
          </Stack>
        </Grid>

        {/* ── Right panel: preview + gallery ───────────────────── */}
        <Grid item xs={12} md={7} xl={8}>
          <Stack spacing={3}>
            {/* Preview */}
            {previewUrl ? (
              <Paper sx={{ p: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    ✨ Criativo gerado
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      startIcon={<DownloadIcon />}
                      variant="outlined"
                      href={previewUrl}
                      target="_blank"
                      download
                    >
                      Baixar
                    </Button>
                    <Button
                      size="small"
                      startIcon={<ContentCopyIcon />}
                      onClick={() => window.open(previewUrl, '_blank')}
                    >
                      Abrir
                    </Button>
                  </Box>
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 1,
                    p: 1,
                  }}
                >
                  <Box
                    component="img"
                    src={previewUrl}
                    alt="criativo gerado"
                    sx={{
                      maxWidth: '100%',
                      maxHeight: format === 'story' ? 500 : 400,
                      borderRadius: 1,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}
                  />
                </Box>

                {revisedPrompt && (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      <strong>Prompt final usado:</strong> {revisedPrompt}
                    </Typography>
                  </Box>
                )}
              </Paper>
            ) : (
              <Paper
                sx={{
                  p: 4, textAlign: 'center',
                  border: '1px dashed rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                {generating ? (
                  <Box>
                    <CircularProgress size={48} sx={{ color: 'primary.main', mb: 2 }} />
                    <Typography color="text.secondary">
                      Gerando criativo com DALL-E 3…
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Isso pode levar até 30 segundos
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    <AutoFixHighIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.12)', mb: 1 }} />
                    <Typography color="text.secondary">
                      Configure o cliente, branding e comando, depois clique em <strong>Gerar Criativo</strong>
                    </Typography>
                  </Box>
                )}
              </Paper>
            )}

            {/* Gallery */}
            {creatives.length > 0 && (
              <Box>
                <Divider sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Gerados recentemente
                  </Typography>
                </Divider>
                <Grid container spacing={1.5}>
                  {creatives.map(c => (
                    <Grid item xs={6} sm={4} md={3} key={c.id}>
                      <CreativeCard
                        creative={c}
                        onDelete={() => deleteCreative(c.id)}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Stack>
        </Grid>
      </Grid>

      {/* ── Branding Kit Dialog ─────────────────────────────────── */}
      <Dialog open={brandingOpen} onClose={() => setBrandingOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PaletteIcon sx={{ color: 'primary.main' }} />
            Branding Kit — {selectedClient}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Essas informações são usadas para gerar criativos mais alinhados com a identidade visual do cliente.
            </Alert>
            <BrandingEditor kit={editingKit} onChange={setEditingKit} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBrandingOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveBranding}>Salvar branding</Button>
        </DialogActions>
      </Dialog>

      {/* ── OpenAI Key Dialog ─────────────────────────────────────── */}
      <Dialog open={keyOpen} onClose={() => setKeyOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Chave OpenAI</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Sua chave nunca é enviada ao GitHub. Fica salva apenas neste navegador.
          </Alert>
          <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary' }}>
            Obtenha em <strong>platform.openai.com/api-keys</strong>. O uso do DALL-E 3 é pago (~$0,04/imagem).
          </Typography>
          <TextField
            fullWidth
            label="sk-..."
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveKey()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <KeyIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          {openaiKey && (
            <Button
              color="error"
              onClick={() => {
                localStorage.removeItem('sm_openai_key')
                setOpenaiKey('')
                setKeyInput('')
                setKeyOpen(false)
              }}
            >
              Remover chave
            </Button>
          )}
          <Button onClick={() => setKeyOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveKey} disabled={!keyInput.trim()}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
