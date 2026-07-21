import { useMemo, useState } from 'react'
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, FormControlLabel, Checkbox, CircularProgress,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import type { ContentItem, ItemState } from '../types'
import { STATUS_CONFIG, isPreClientStatus } from '../types'
import { DS } from '../theme'
import { parseLeadingItemId } from '../lib/mediaLinks'
import type { DriveVideo } from '../lib/useDriveInbox'

interface Props {
  video: DriveVideo | null
  items: ContentItem[]
  states: Record<number, ItemState>
  saving?: boolean
  onLink: (video: DriveVideo, item: ContentItem, sendToReview: boolean) => void
  onClose: () => void
  onRemindLater?: (video: DriveVideo) => void
  onIgnore?: (video: DriveVideo) => void
}

// Pontuação de similaridade entre nome de arquivo e título do item (0–1).
// Serve só para ORDENAR a lista — quem vincula é o clique do usuário.
function similarity(filename: string, title: string): number {
  const clean = (s: string) =>
    s.toLowerCase()
      .normalize('NFD').replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/).filter(w => w.length > 2)
  const fnWords = new Set(clean(filename))
  const ttWords = clean(title)
  if (!ttWords.length || !fnWords.size) return 0
  return ttWords.filter(w => fnWords.has(w)).length / ttWords.length
}

/**
 * Seleção de conteúdo para um arquivo da Inbox. Só abre por ação do usuário —
 * nunca em fetch, polling ou foco da janela.
 */
export default function LinkVideoDialog({
  video, items, states, saving, onLink, onClose, onRemindLater, onIgnore,
}: Props) {
  const [search, setSearch] = useState('')
  const [sendToReview, setSendToReview] = useState(true)

  const candidates = useMemo(() => {
    if (!video) return []
    const term = search.trim().toLowerCase()
    return items
      .filter(i => {
        if (i.c !== video.client_name) return false
        const st = states[i.i]?.status ?? i.s
        if (!isPreClientStatus(st)) return false
        if (!term) return true
        const title = (states[i.i]?.title || i.n).toLowerCase()
        return title.includes(term) || i.tp.toLowerCase().includes(term)
      })
      .map(i => ({ item: i, score: similarity(video.filename, states[i.i]?.title || i.n) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
  }, [video, items, states, search])

  // O ID no começo do nome é uma afirmação do editor, não um palpite: ele manda.
  const namedId = video ? parseLeadingItemId(video.filename) : null
  const namedMatch = namedId !== null && candidates.some(c => c.item.i === namedId) ? namedId : null
  const topScore = candidates[0]?.score ?? 0

  const handleClose = () => { setSearch(''); onClose() }

  return (
    <Dialog open={!!video} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: 'rgba(10,17,32,0.99)', backdropFilter: 'blur(40px)', border: '1px solid rgba(148,163,184,0.14)', borderRadius: '18px' } }}>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>🔗 Vincular vídeo a um item</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem' }}>
          {video?.filename} · {video?.client_name}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <TextField autoFocus fullWidth size="small" placeholder="Buscar por título ou tipo..."
          value={search} onChange={e => setSearch(e.target.value)} sx={{ mb: 1 }} />

        <Box sx={{ mb: 1.5, px: 1.2, py: 0.8, borderRadius: '10px', bgcolor: sendToReview ? 'rgba(6,182,212,0.07)' : 'rgba(255,255,255,0.03)', border: `1px solid ${sendToReview ? 'rgba(6,182,212,0.25)' : 'rgba(255,255,255,0.07)'}`, transition: 'all 0.18s' }}>
          <FormControlLabel
            control={<Checkbox checked={sendToReview} onChange={e => setSendToReview(e.target.checked)} size="small"
              sx={{ p: 0.4, color: 'rgba(255,255,255,0.3)', '&.Mui-checked': { color: DS.cyan } }} />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <VisibilityIcon sx={{ fontSize: 14, color: sendToReview ? DS.cyan : 'rgba(255,255,255,0.3)' }} />
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: sendToReview ? DS.cyan : 'rgba(255,255,255,0.4)' }}>
                  Mandar direto para a revisão interna
                </Typography>
              </Box>
            }
            sx={{ m: 0 }} />
          <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', mt: 0.4, ml: 3.5 }}>
            {sendToReview
              ? 'Move para Revisão e abre o grupo da equipe'
              : 'Só vincula o vídeo — o card fica em produção'}
          </Typography>
        </Box>

        {(namedMatch !== null || topScore >= 0.4) && !search && (
          <Box sx={{ mb: 1, px: 1.2, py: 0.6, borderRadius: '8px', bgcolor: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Typography sx={{ fontSize: '0.85rem' }}>✨</Typography>
            <Typography sx={{ fontSize: '0.62rem', color: 'rgba(59,130,246,0.9)', fontWeight: 600 }}>
              {namedMatch !== null
                ? `O nome do arquivo aponta para o item #${namedMatch} — destacado abaixo`
                : 'Item sugerido pelo nome do arquivo destacado abaixo'}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: { xs: 260, sm: 320 }, overflowY: 'auto' }}>
          {candidates.length === 0 ? (
            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', py: 3 }}>
              Nenhum item em produção para {video?.client_name}
            </Typography>
          ) : candidates.map(({ item, score }, idx) => {
            const st = states[item.i]?.status ?? item.s
            const cfg = STATUS_CONFIG[st] ?? STATUS_CONFIG[0]
            const title = states[item.i]?.title || item.n
            const isBest = namedMatch !== null
              ? item.i === namedMatch
              : idx === 0 && score >= 0.4 && !search
            return (
              <Box key={item.i} onClick={() => { if (!saving && video) onLink(video, item, sendToReview) }}
                sx={{
                  px: 1.4, py: 1, borderRadius: '10px', cursor: 'pointer',
                  border: isBest ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.07)',
                  bgcolor: isBest ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)',
                  display: 'flex', alignItems: 'center', gap: 1,
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.4)' },
                }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: isBest ? '#3B82F6' : cfg.color, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: isBest ? '#fff' : 'rgba(255,255,255,0.9)' }} noWrap>{title}</Typography>
                    {isBest && (
                      <Box sx={{ px: 0.6, py: 0.1, borderRadius: '4px', bgcolor: 'rgba(59,130,246,0.2)', flexShrink: 0 }}>
                        <Typography sx={{ fontSize: '0.5rem', fontWeight: 800, color: '#3B82F6', letterSpacing: '0.06em' }}>SUGERIDO</Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.8, mt: 0.2 }}>
                    <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)' }}>{item.tp}</Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)' }}>·</Typography>
                    <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)' }}>
                      {new Date(item.dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </Typography>
                  </Box>
                </Box>
                <Typography sx={{ fontSize: '0.58rem', color: isBest ? '#3B82F6' : cfg.color, fontWeight: 600 }}>{cfg.label}</Typography>
              </Box>
            )
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5, gap: 0.5, flexWrap: 'wrap' }}>
        {onIgnore && video && (
          <Button size="small" onClick={() => { onIgnore(video); handleClose() }} disabled={saving}
            sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)' }}>
            Ignorar arquivo
          </Button>
        )}
        {onRemindLater && video && (
          <Button size="small" onClick={() => { onRemindLater(video); handleClose() }} disabled={saving}
            sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)' }}>
            Lembrar depois
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {saving && <CircularProgress size={16} sx={{ color: '#3B82F6' }} />}
        <Button size="small" onClick={handleClose} disabled={saving}>Fechar</Button>
      </DialogActions>
    </Dialog>
  )
}
