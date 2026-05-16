import { useState } from 'react'
import {
  Card, CardContent, CardActions, Collapse, Box, Typography,
  IconButton, TextField, Divider, Tooltip, Snackbar, Alert,
  LinearProgress,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LinkIcon from '@mui/icons-material/Link'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import type { ContentItem, ItemState, Status } from '../types'
import StatusChip from './StatusChip'
import PublishChecklist from './PublishChecklist'

const INSTAGRAM_LIMIT = 2200

interface Props {
  item: ContentItem
  state: ItemState
  onStatusChange: (id: number, s: Status) => void
  onUpdate: (id: number, patch: Partial<ItemState>) => void
}

export default function ContentCard({ item, state, onStatusChange, onUpdate }: Props) {
  const [open, setOpen] = useState(false)
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [captionCopied, setCaptionCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const isLate = state.status < 3 && item.dt < new Date()
  const charCount = state.caption.length
  const charPct = Math.min((charCount / INSTAGRAM_LIMIT) * 100, 100)
  const charColor = charCount > INSTAGRAM_LIMIT ? 'error' : charCount > 1800 ? 'warning' : 'primary'

  // Intercept advance to "Publicado" (3)
  const handleStatusClick = (next: Status) => {
    if (next === 3) {
      setChecklistOpen(true)
    } else {
      onStatusChange(item.i, next)
    }
  }

  const handlePublishConfirm = () => {
    setChecklistOpen(false)
    onStatusChange(item.i, 3)
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

  return (
    <>
      <Card
        sx={{
          mb: 1,
          borderLeft: '3px solid',
          borderLeftColor: isLate ? 'error.main' : state.status === 3 ? 'success.main' : 'transparent',
          animation: isLate ? 'pulse 2s ease-in-out infinite' : undefined,
          '@keyframes pulse': {
            '0%, 100%': { borderLeftColor: 'error.main' },
            '50%': { borderLeftColor: 'transparent' },
          },
        }}
      >
        <CardContent sx={{ pb: 0.5, '&:last-child': { pb: 0.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.6rem', color: 'primary.main', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1 }} noWrap>
                {item.c}
              </Typography>
              <Typography variant="body2" fontWeight={600} noWrap>
                {state.title || item.n}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.tp} · {item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                {state.link && <Typography component="span" sx={{ color: 'success.main', ml: 0.5, fontSize: '0.65rem' }}>· 🔗</Typography>}
                {state.caption && <Typography component="span" sx={{ color: 'info.main', ml: 0.5, fontSize: '0.65rem' }}>· ✍️</Typography>}
              </Typography>
            </Box>
            <StatusChip status={state.status} onClick={handleStatusClick} />
            <IconButton size="small" onClick={() => setOpen(v => !v)} sx={{ flexShrink: 0 }}>
              <ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s', fontSize: 18 }} />
            </IconButton>
          </Box>
        </CardContent>

        <Collapse in={open}>
          <Divider sx={{ mx: 2, opacity: 0.08 }} />
          <CardActions sx={{ flexDirection: 'column', gap: 1.2, px: 2, py: 1.5, alignItems: 'stretch' }}>

            {/* Título do conteúdo */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.4, display: 'block', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Título do conteúdo
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder={`Ex: Post Dia dos Namorados — ${item.c}`}
                value={state.title}
                onChange={e => onUpdate(item.i, { title: e.target.value })}
              />
            </Box>

            {/* Link Drive */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.4, display: 'block', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Link Drive
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="https://drive.google.com/..."
                  value={state.link}
                  onChange={e => onUpdate(item.i, { link: e.target.value })}
                  slotProps={{
                    input: { startAdornment: <LinkIcon sx={{ mr: 0.5, fontSize: 15, color: 'text.disabled', flexShrink: 0 }} /> },
                  }}
                />
                {state.link && (
                  <Tooltip title="Copiar link">
                    <IconButton size="small" onClick={copyLink} sx={{ bgcolor: 'rgba(255,255,255,0.04)', flexShrink: 0 }}>
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>

            {/* Legenda / Copy */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.4 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Legenda / Copy
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontSize: '0.6rem', color: charCount > INSTAGRAM_LIMIT ? 'error.main' : charCount > 1800 ? 'warning.main' : 'text.disabled', fontVariantNumeric: 'tabular-nums' }}
                  >
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
                size="small"
                fullWidth
                multiline
                rows={3}
                placeholder="Digite a legenda do post..."
                value={state.caption}
                onChange={e => onUpdate(item.i, { caption: e.target.value })}
                error={charCount > INSTAGRAM_LIMIT}
              />

              {/* Character bar */}
              {charCount > 0 && (
                <LinearProgress
                  variant="determinate"
                  value={charPct}
                  color={charColor}
                  sx={{ mt: 0.5, height: 2, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)' }}
                />
              )}
            </Box>

            {/* Observações */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.4, display: 'block', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Observações
              </Typography>
              <TextField
                size="small"
                fullWidth
                multiline
                rows={2}
                placeholder="Notas internas, pedidos do cliente..."
                value={state.notes}
                onChange={e => onUpdate(item.i, { notes: e.target.value })}
              />
            </Box>
          </CardActions>
        </Collapse>
      </Card>

      {/* Publish checklist dialog */}
      <PublishChecklist
        open={checklistOpen}
        item={item}
        state={state}
        onConfirm={handlePublishConfirm}
        onCancel={() => setChecklistOpen(false)}
      />

      {/* Copy snackbars */}
      <Snackbar open={captionCopied} autoHideDuration={2000} onClose={() => setCaptionCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" variant="filled" sx={{ fontSize: '0.75rem' }}>Legenda copiada — cole no Instagram</Alert>
      </Snackbar>
      <Snackbar open={linkCopied} autoHideDuration={2000} onClose={() => setLinkCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" sx={{ fontSize: '0.75rem' }}>Link copiado!</Alert>
      </Snackbar>
    </>
  )
}
