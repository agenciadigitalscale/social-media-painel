import { Box, Tooltip, Typography } from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import BlockIcon from '@mui/icons-material/Block'
import { DS } from '../../theme'
import { checkFormat, weighExport, type FormatVerdict } from '../../lib/exportWeight'

/**
 * "Este arquivo está pronto para ir ao cliente?" — no lugar onde ele aparece.
 *
 * Substitui o tamanho solto ("118 MB") que estava na Inbox e não dizia nada.
 * Dois riscos convivem aqui, e são independentes:
 *
 *  - **Peso.** Acima de 70 MB o cliente sente no 4G; acima de 600 MB o arquivo
 *    nem entra no espelho. Medido: a Kátia recebeu 83,6 MB para 46 s (~15 Mbps)
 *    e o vídeo travou até ela desistir — sem gerar erro nenhum no registro.
 *  - **Formato.** `.mov` toca no Safari e o Android costuma recusar. Isso ficou
 *    invisível enquanto os clientes que abriam vídeo eram de iPhone.
 *
 * Discreto no caso normal de propósito: aviso que dispara em tudo vira aviso
 * que ninguém lê.
 */

interface Props {
  bytes: number | null | undefined
  mimeType?: string | null
  filename?: string | null
  /** `0.58rem` na Inbox; a gaveta usa um pouco menor. */
  fontSize?: string
}

function Alerta({ tone, icon, label, hint, fontSize }: {
  tone: string; icon: React.ReactNode; label: string; hint: string; fontSize: string
}) {
  return (
    <Tooltip title={hint}>
      <Box sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.4,
        px: 0.7, py: 0.15, borderRadius: '6px',
        bgcolor: `${tone}1f`, border: `1px solid ${tone}4d`,
      }}>
        {icon}
        <Typography sx={{ fontSize, fontWeight: 700, color: tone, whiteSpace: 'nowrap' }}>
          {label}
        </Typography>
      </Box>
    </Tooltip>
  )
}

function formatTone(v: FormatVerdict): string {
  return v.level === 'unplayable' ? DS.red : DS.alert
}

export default function DeliveryChips({ bytes, mimeType, filename, fontSize = '0.58rem' }: Props) {
  const weight = weighExport(bytes, mimeType)
  const format = checkFormat(mimeType, filename)

  if (!weight && !format) return null

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      {format && (
        <Alerta
          tone={formatTone(format)}
          icon={format.level === 'unplayable'
            ? <BlockIcon sx={{ fontSize: 11, color: DS.red }} />
            : <WarningAmberIcon sx={{ fontSize: 11, color: DS.alert }} />}
          label={format.label}
          hint={format.hint}
          fontSize={fontSize}
        />
      )}

      {weight && (weight.level === 'ok' ? (
        <Tooltip title={weight.hint}>
          <Typography sx={{ fontSize, color: DS.t3 }}>{weight.label}</Typography>
        </Tooltip>
      ) : (
        <Alerta
          tone={weight.level === 'huge' ? DS.red : DS.alert}
          icon={<WarningAmberIcon sx={{ fontSize: 11, color: weight.level === 'huge' ? DS.red : DS.alert }} />}
          label={weight.label}
          hint={weight.hint}
          fontSize={fontSize}
        />
      ))}
    </Box>
  )
}
