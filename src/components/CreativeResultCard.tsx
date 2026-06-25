import type { ReactNode } from 'react'
import { useState } from 'react'
import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'

interface Props {
  emoji: string
  title: string
  color: string
  copyText?: string
  full?: boolean        // ocupa a linha inteira no grid
  children: ReactNode
}

// Card de uma seção do resultado (Big Idea, Ganchos, Roteiro, Edição, CTA, Checklist).
// Padrão visual DS HUB: card escuro, borda na cor do bloco, botão copiar embutido.
export default function CreativeResultCard({ emoji, title, color, copyText, full, children }: Props) {
  const [copied, setCopied] = useState(false)

  function copy() {
    if (!copyText) return
    navigator.clipboard?.writeText(copyText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    }).catch(() => {})
  }

  return (
    <Box sx={{
      gridColumn: full ? '1 / -1' : 'auto',
      bgcolor: 'rgba(255,255,255,0.025)',
      border: `1px solid ${color}33`,
      borderRadius: 2.5,
      p: 1.6,
      display: 'flex', flexDirection: 'column',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
        <Typography sx={{ fontSize: '0.85rem', lineHeight: 1 }}>{emoji}</Typography>
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em', color, textTransform: 'uppercase', flex: 1 }}>
          {title}
        </Typography>
        {copyText && (
          <Tooltip title={copied ? 'Copiado!' : 'Copiar'}>
            <IconButton size="small" onClick={copy} sx={{ p: 0.4, color: copied ? '#00C47A' : 'rgba(255,255,255,0.4)', '&:hover': { color } }}>
              {copied ? <CheckIcon sx={{ fontSize: 15 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {children}
    </Box>
  )
}
