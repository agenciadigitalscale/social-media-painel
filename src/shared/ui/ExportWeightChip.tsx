import { Box, Tooltip, Typography } from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { DS } from '../../theme'
import { weighExport } from '../../lib/exportWeight'

/**
 * O peso do export, no lugar onde o arquivo aparece.
 *
 * Substitui o tamanho solto ("118 MB") que já estava na Inbox e não dizia nada
 * a ninguém. Agora o número tem veredito: acima de 70 MB o cliente sente no
 * 4G, acima de 600 MB o arquivo nem entra no espelho — e o tooltip diz o preset
 * que resolve.
 *
 * Discreto no caso normal de propósito: aviso que dispara em tudo vira aviso
 * que ninguém lê.
 */

interface Props {
  bytes: number | null | undefined
  mimeType?: string | null
  /** `0.58rem` na Inbox; a gaveta usa um pouco menor. */
  fontSize?: string
}

export default function ExportWeightChip({ bytes, mimeType, fontSize = '0.58rem' }: Props) {
  const verdict = weighExport(bytes, mimeType)
  if (!verdict) return null

  if (verdict.level === 'ok') {
    return (
      <Tooltip title={verdict.hint}>
        <Typography sx={{ fontSize, color: DS.t3 }}>{verdict.label}</Typography>
      </Tooltip>
    )
  }

  const tone = verdict.level === 'huge' ? DS.red : DS.alert

  return (
    <Tooltip title={verdict.hint}>
      <Box sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.4,
        px: 0.7, py: 0.15, borderRadius: '6px',
        bgcolor: `${tone}1f`, border: `1px solid ${tone}4d`,
      }}>
        <WarningAmberIcon sx={{ fontSize: 11, color: tone }} />
        <Typography sx={{ fontSize, fontWeight: 700, color: tone, whiteSpace: 'nowrap' }}>
          {verdict.label}
        </Typography>
      </Box>
    </Tooltip>
  )
}
