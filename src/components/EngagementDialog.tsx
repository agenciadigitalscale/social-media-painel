import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Button, IconButton, Chip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import FavoriteIcon from '@mui/icons-material/Favorite'
import CommentIcon from '@mui/icons-material/Comment'
import VisibilityIcon from '@mui/icons-material/Visibility'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import type { ContentItem, ItemState } from '../types'

interface Props {
  open: boolean
  itemId: number | null
  items: ContentItem[]
  states: Record<number, ItemState>
  onSave: (id: number, engagement: { likes?: number; comments?: number; reach?: number; saves?: number }) => void
  onClose: () => void
}

export default function EngagementDialog({ open, itemId, items, states, onSave, onClose }: Props) {
  const [likes,    setLikes]    = useState('')
  const [comments, setComments] = useState('')
  const [reach,    setReach]    = useState('')
  const [saves,    setSaves]    = useState('')

  const item  = itemId != null ? items.find(i => i.i === itemId) : null
  const state = itemId != null ? states[itemId] : null

  function handleOpen() {
    const eng = state?.engagement
    setLikes(   eng?.likes    != null ? String(eng.likes)    : '')
    setComments(eng?.comments != null ? String(eng.comments) : '')
    setReach(   eng?.reach    != null ? String(eng.reach)    : '')
    setSaves(   (eng as { saves?: number } | undefined)?.saves != null ? String((eng as { saves?: number }).saves) : '')
  }

  function handleSave() {
    if (!itemId) return
    onSave(itemId, {
      likes:    likes    !== '' ? Number(likes)    : undefined,
      comments: comments !== '' ? Number(comments) : undefined,
      reach:    reach    !== '' ? Number(reach)    : undefined,
      saves:    saves    !== '' ? Number(saves)    : undefined,
    })
    onClose()
  }

  const hasAny = likes !== '' || comments !== '' || reach !== '' || saves !== ''

  return (
    <Dialog
      open={open} onClose={onClose}
      maxWidth="xs" fullWidth
      TransitionProps={{ onEnter: handleOpen }}
      slotProps={{ paper: { sx: { bgcolor: '#0A1120', border: '1px solid rgba(49,209,124,0.25)' } } }}
    >
      <DialogTitle sx={{ pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          {/* Celebration icon */}
          <Box sx={{
            width: 36, height: 36, borderRadius: 2,
            bgcolor: 'rgba(49,209,124,0.12)', border: '1px solid rgba(49,209,124,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'celebPop 0.5s cubic-bezier(0.16,1,0.3,1) both',
            '@keyframes celebPop': { '0%': { transform: 'scale(0.5)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
          }}>
            <EmojiEventsIcon sx={{ fontSize: 18, color: '#31D17C' }} />
          </Box>

          <Box sx={{ flex: 1 }}>
            <Typography fontWeight={800} fontSize="0.9rem" color="#31D17C">
              Publicado! 🎉
            </Typography>
            <Typography fontSize="0.65rem" color="text.secondary" noWrap>
              {item?.n ?? 'Conteúdo'} · {item?.c}
            </Typography>
          </Box>

          <IconButton size="small" onClick={onClose} sx={{ p: 0.4 }}>
            <CloseIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
          Registre os resultados para acompanhar a performance. Campos opcionais — preencha o que tiver.
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2 }}>
          {[
            { label: 'Curtidas', value: likes,    set: setLikes,    icon: <FavoriteIcon sx={{ fontSize: 13, color: '#EF4444' }} />,  placeholder: '0' },
            { label: 'Comentários', value: comments, set: setComments, icon: <CommentIcon  sx={{ fontSize: 13, color: '#3B82F6' }} />, placeholder: '0' },
            { label: 'Alcance', value: reach,    set: setReach,    icon: <VisibilityIcon sx={{ fontSize: 13, color: '#31D17C' }} />, placeholder: '0' },
            { label: 'Salvamentos', value: saves,    set: setSaves,    icon: <BookmarkIcon  sx={{ fontSize: 13, color: '#F59E0B' }} />, placeholder: '0' },
          ].map(f => (
            <Box key={f.label}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.4 }}>
                {f.icon}
                <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {f.label}
                </Typography>
              </Box>
              <TextField
                size="small" type="number" fullWidth
                placeholder={f.placeholder}
                value={f.value}
                onChange={e => f.set(e.target.value)}
                inputProps={{ min: 0, style: { textAlign: 'center', fontWeight: 700 } }}
              />
            </Box>
          ))}
        </Box>

        {hasAny && (
          <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(49,209,124,0.06)', border: '1px solid rgba(49,209,124,0.15)', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {likes    !== '' && <Chip label={`❤️ ${Number(likes).toLocaleString()}`}    size="small" sx={{ fontSize: '0.6rem', height: 18, bgcolor: 'rgba(239,68,68,0.12)', color: '#EF4444' }} />}
            {comments !== '' && <Chip label={`💬 ${Number(comments).toLocaleString()}`} size="small" sx={{ fontSize: '0.6rem', height: 18, bgcolor: 'rgba(59,130,246,0.12)', color: '#3B82F6' }} />}
            {reach    !== '' && <Chip label={`👁️ ${Number(reach).toLocaleString()}`}    size="small" sx={{ fontSize: '0.6rem', height: 18, bgcolor: 'rgba(49,209,124,0.12)', color: '#31D17C' }} />}
            {saves    !== '' && <Chip label={`🔖 ${Number(saves).toLocaleString()}`}    size="small" sx={{ fontSize: '0.6rem', height: 18, bgcolor: 'rgba(245,158,11,0.12)', color: '#F59E0B' }} />}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 1.5, gap: 1 }}>
        <Button size="small" onClick={onClose} sx={{ fontSize: '0.65rem' }}>Pular</Button>
        <Button
          size="small" variant="contained"
          onClick={handleSave}
          disabled={!hasAny}
          sx={{
            background: hasAny ? 'linear-gradient(135deg, #31D17C, #00a065)' : undefined,
            color: hasAny ? '#000' : undefined,
            fontWeight: 800, fontSize: '0.75rem',
            '&.Mui-disabled': { opacity: 0.4 },
          }}
        >
          Salvar métricas
        </Button>
      </DialogActions>
    </Dialog>
  )
}
