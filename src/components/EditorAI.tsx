import { useState } from 'react'
import { Dialog, DialogContent, Box, Typography, IconButton, Button, CircularProgress } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

interface Props {
  open: boolean
  onClose: () => void
  titulo: string
  cliente: string
  tipo: string
  roteiro: string
  docLink?: string
}

const SYSTEM = `Você é um editor de Reels sênior e copywriter viral brasileiro. A partir do contexto de um vídeo, devolva sugestões PRÁTICAS, diretas e econômicas, em português, NESTE formato exato (mantenha os títulos com emoji):

🎣 GANCHOS — 3 opções de primeira frase, curtas e fortes
✂️ CORTES — onde cortar/acelerar pra prender (bullets curtos)
🔊 EFEITOS SONOROS — em que momentos entra whoosh/ding/boom etc.
📝 LEGENDA — texto pronto pra legenda dinâmica, em frases curtas
🏷️ TÍTULO + HASHTAGS — 1 título forte + 5 a 8 hashtags

Sem enrolação, sem introdução. Vá direto ao formato.`

export default function EditorAI({ open, onClose, titulo, cliente, tipo, roteiro, docLink }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState('')
  const [error, setError]     = useState('')

  async function generate() {
    setLoading(true); setError(''); setResult('')
    try {
      // Puxa o roteiro completo do Google Docs, se houver link (sugestões bem melhores)
      let script = roteiro
      if (docLink) {
        try {
          const doc = await fetch(`/api/fetch-doc?url=${encodeURIComponent(docLink)}`).then(x => x.json()) as { ok?: boolean; text?: string }
          if (doc.ok && doc.text && doc.text.trim()) script = doc.text.trim().slice(0, 6000)
        } catch {}
      }
      const key = localStorage.getItem('sm_anthropic_key') ?? ''
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (key) headers['X-Anthropic-Key'] = key
      const content = `Cliente: ${cliente}\nTipo: ${tipo}\nTítulo: ${titulo}\n\nRoteiro / contexto:\n${script?.trim() || '(sem roteiro — gere a partir do título e do nicho do cliente)'}`
      const res = await fetch('/api/ai', {
        method: 'POST', headers,
        body: JSON.stringify({ system: SYSTEM, messages: [{ role: 'user', content }] }),
      })
      const data = await res.json() as { content?: { text: string }[]; error?: { message: string } }
      if (data.error) { setError(data.error.message); return }
      setResult(data.content?.[0]?.text ?? 'Sem resposta.')
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
          <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, flex: 1 }}>🤖 IA do Editor</Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(244,247,255,0.5)' }}><CloseIcon fontSize="small" /></IconButton>
        </Box>
        <Typography sx={{ fontSize: '0.7rem', color: 'rgba(244,247,255,0.45)', mb: 1.6 }} noWrap>
          {titulo} · {cliente}
        </Typography>

        {!result && !loading && (
          <Button fullWidth onClick={generate} startIcon={<AutoAwesomeIcon />}
            sx={{ py: 1.3, borderRadius: 2.5, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, DS.accent, DS.cyan)', '&:hover': { filter: 'brightness(1.06)' } }}>
            Gerar gancho, cortes, SFX, legenda e hashtags
          </Button>
        )}

        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 4 }}>
            <CircularProgress size={28} sx={{ color: DS.accent }} />
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(244,247,255,0.5)' }}>A IA está pensando no seu vídeo…</Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', mb: 1.5 }}>
            <Typography sx={{ fontSize: '0.74rem', color: '#FF8080' }}>{error}</Typography>
            {(error.toLowerCase().includes('chave') || error.toLowerCase().includes('key')) && (
              <Typography sx={{ fontSize: '0.66rem', color: 'rgba(244,247,255,0.45)', mt: 0.5 }}>
                Configure sua chave Anthropic na aba IA do painel (uma vez só).
              </Typography>
            )}
            <Button size="small" onClick={generate} sx={{ mt: 0.5, color: DS.accent, fontWeight: 700 }}>Tentar de novo</Button>
          </Box>
        )}

        {result && (
          <>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(244,247,255,0.03)', border: '1px solid rgba(244,247,255,0.08)', maxHeight: '55vh', overflow: 'auto' }}>
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(244,247,255,0.9)', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{result}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.2 }}>
              <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 15 }} />} onClick={() => navigator.clipboard?.writeText(result).catch(() => {})}
                sx={{ color: 'rgba(244,247,255,0.6)' }}>Copiar</Button>
              <Button size="small" onClick={generate} sx={{ ml: 'auto', color: DS.accent, fontWeight: 700 }}>Gerar de novo</Button>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
