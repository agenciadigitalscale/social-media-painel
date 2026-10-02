import { useState } from 'react'
import { Box, Tooltip, Typography } from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import type { ItemState } from '../../types'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import { copiarTexto, linkDoMaterial } from '../../lib/linkMaterial'

/**
 * O link do material final do card (fonte única: lib/linkMaterial) — é daqui
 * que o Social baixa o vídeo/arte para anexar na programação.
 */
export default function LinkDoMaterial({ st }: { st?: ItemState | null }) {
  const [copiado, setCopiado] = useState(false)
  const url = linkDoMaterial(st)
  if (!url) {
    return <Typography sx={{ fontSize: '0.66rem', color: DS.t4, mt: 0.2 }}>sem link do material</Typography>
  }
  const copiar = () => {
    copiarTexto(url).then(ok => {
      if (!ok) return
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    })
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.3, minWidth: 0 }}>
      <LinkIcon sx={{ fontSize: 13, color: DS.accent, flexShrink: 0 }} />
      <Typography component="a" href={url} target="_blank" rel="noopener noreferrer" noWrap
        sx={{ fontSize: { xs: '0.68rem', xl: '0.76rem' }, fontWeight: 700, color: DS.accent, textDecoration: 'none', minWidth: 0, '&:hover': { textDecoration: 'underline' } }}>
        Material · {url.replace(/^https?:\/\//, '').slice(0, 48)}
      </Typography>
      <Tooltip title={copiado ? 'Copiado' : 'Copiar link'}>
        <Box {...clickable(copiar)} aria-label="Copiar link do material" sx={{ display: 'flex', cursor: 'pointer', color: copiado ? DS.green : DS.t3, '&:hover': { color: DS.t1 } }}>
          {copiado ? <CheckIcon sx={{ fontSize: 13 }} /> : <ContentCopyIcon sx={{ fontSize: 12 }} />}
        </Box>
      </Tooltip>
    </Box>
  )
}
