import { useState } from 'react'
import { Dialog, DialogContent, Box, Typography, IconButton, Button, TextField, CircularProgress } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import MicIcon from '@mui/icons-material/Mic'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { extractDriveFileId } from '../lib/whatsapp'

interface Props {
  open: boolean
  onClose: () => void
  footageLink?: string
  onUseAsCaption?: (text: string) => void
}

const BLUE = '#3B82F6'

export default function TranscribeDialog({ open, onClose, footageLink, onUseAsCaption }: Props) {
  const [apiKey, setApiKey]   = useState(() => localStorage.getItem('sm_openai_key') ?? '')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState('')
  const [error, setError]     = useState('')

  const fileId = footageLink ? extractDriveFileId(footageLink) : null

  function saveKey(k: string) { setApiKey(k); localStorage.setItem('sm_openai_key', k.trim()) }

  async function transcribe() {
    if (!fileId)        { setError('O arquivo bruto precisa ser um link do Google Drive.'); return }
    if (!apiKey.trim()) { setError('Cole sua chave OpenAI (sk-...) primeiro.'); return }
    setLoading(true); setError(''); setResult('')
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-OpenAI-Key': apiKey.trim() },
        body: JSON.stringify({ fileId }),
      })
      const data = await res.json() as { ok?: boolean; text?: string; error?: string }
      if (!data.ok) { setError(data.error || 'Falha na transcrição.'); return }
      setResult((data.text || '').trim() || 'Nenhuma fala detectada no áudio.')
    } catch {
      setError('Erro de conexão. Tente de novo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, flex: 1 }}>🎙 Transcrever fala → legenda</Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><CloseIcon fontSize="small" /></IconButton>
        </Box>
        <Typography sx={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.4)', mb: 1.5 }}>
          Transcreve o áudio do arquivo bruto (Drive público) com a OpenAI. Funciona com arquivos até ~25MB.
        </Typography>

        {!apiKey.trim() && (
          <TextField type="password" size="small" fullWidth label="Chave OpenAI (sk-...)" placeholder="sk-..."
            value={apiKey} onChange={e => saveKey(e.target.value)} sx={{ mb: 1.5 }} />
        )}

        {!result && !loading && (
          <Button fullWidth startIcon={<MicIcon />} onClick={transcribe} disabled={!fileId}
            sx={{
              py: 1.2, borderRadius: 2.5, fontWeight: 800, color: '#fff',
              background: `linear-gradient(135deg, ${BLUE}, #6C5CE7)`,
              '&:hover': { filter: 'brightness(1.08)' },
              '&.Mui-disabled': { opacity: 0.4, color: 'rgba(255,255,255,0.4)' },
            }}>
            {fileId ? 'Transcrever áudio do vídeo' : 'Sem arquivo bruto do Drive no card'}
          </Button>
        )}

        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 4 }}>
            <CircularProgress size={28} sx={{ color: BLUE }} />
            <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)' }}>Baixando e transcrevendo… (pode levar até ~1 min)</Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,69,69,0.08)', border: '1px solid rgba(255,69,69,0.25)', my: 1.5 }}>
            <Typography sx={{ fontSize: '0.74rem', color: '#FF8080', lineHeight: 1.5 }}>{error}</Typography>
            <Button size="small" onClick={transcribe} sx={{ mt: 0.5, color: BLUE, fontWeight: 700 }}>Tentar de novo</Button>
          </Box>
        )}

        {result && (
          <>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '50vh', overflow: 'auto' }}>
              <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{result}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.2 }}>
              <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 15 }} />} onClick={() => navigator.clipboard?.writeText(result).catch(() => {})}
                sx={{ color: 'rgba(255,255,255,0.6)' }}>Copiar</Button>
              <Button size="small" onClick={transcribe} sx={{ color: 'rgba(255,255,255,0.4)' }}>Refazer</Button>
              {onUseAsCaption && (
                <Button size="small" variant="contained" onClick={() => { onUseAsCaption(result); onClose() }}
                  sx={{ ml: 'auto', fontWeight: 700, bgcolor: BLUE, '&:hover': { bgcolor: BLUE, filter: 'brightness(1.08)' } }}>
                  Usar como legenda
                </Button>
              )}
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
