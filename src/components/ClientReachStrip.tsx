import { Box, Typography, Tooltip } from '@mui/material'
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ScheduleIcon from '@mui/icons-material/Schedule'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { DS } from '../theme'
import { describeDetail, describePlatform, reachState, useItemViewerSummary } from '../lib/viewerEvents'

/**
 * "O cliente chegou a ver isso?" — respondido no card.
 *
 * Enviar o criativo e não saber se o cliente abriu transformava toda cobrança
 * num chute. "Enviado há 2 dias e nunca aberto" e "abriu três vezes e não
 * respondeu" são situações diferentes e pedem mensagens diferentes: a primeira
 * é lembrete, a segunda é ligação.
 *
 * A faixa é deliberadamente **muda quando não sabe**. O registro guarda 300
 * eventos por 30 dias — criativo antigo sai da janela, e afirmar "não abriu"
 * sobre ausência de dado seria pior que não dizer nada.
 */

interface Props {
  itemId: number
  /** Quando o criativo foi para o cliente. Sem isso não há o que comparar. */
  sentAt?: number
  now: Date
}

function ago(from: number, now: Date): string {
  const mins = Math.round((now.getTime() - from) / 60000)
  if (mins < 60) return `há ${Math.max(mins, 1)} min`
  if (mins < 60 * 24) return `há ${Math.round(mins / 60)} h`
  return `há ${Math.round(mins / 1440)} d`
}

export default function ClientReachStrip({ itemId, sentAt, now }: Props) {
  const summary = useItemViewerSummary(itemId)
  const reach = reachState(summary, sentAt)

  if (reach.kind === 'unknown') return null

  let tone   = DS.t2
  let bg     = 'rgba(148,163,184,0.05)'
  let border = DS.borderSoft
  let icon   = <ScheduleIcon sx={{ fontSize: 14 }} />
  let text   = ''
  let hint   = ''

  if (reach.kind === 'failed') {
    tone   = DS.redSoft
    bg     = 'rgba(239,68,68,0.08)'
    border = 'rgba(239,68,68,0.28)'
    icon   = <ErrorOutlineIcon sx={{ fontSize: 14 }} />
    text   = `O cliente tentou ver e não conseguiu · ${describePlatform(reach.platform)}`
    hint   = `${describeDetail(reach.detail)} — ${ago(reach.at!, now)}`
  } else if (reach.kind === 'opened') {
    tone   = DS.green
    bg     = 'rgba(49,209,124,0.07)'
    border = 'rgba(49,209,124,0.24)'
    icon   = <VisibilityIcon sx={{ fontSize: 14 }} />
    text   = (reach.opens ?? 0) > 1
      ? `Cliente abriu ${reach.opens}× · última ${ago(reach.at!, now)}`
      : `Cliente abriu ${ago(reach.at!, now)}`
    hint   = reach.played
      ? 'O vídeo chegou a rodar no aparelho dele.'
      : 'Abriu a página; não há registro de o vídeo ter rodado.'
  } else {
    tone   = DS.amber
    bg     = 'rgba(245,158,11,0.07)'
    border = 'rgba(245,158,11,0.26)'
    icon   = <MarkEmailReadIcon sx={{ fontSize: 14 }} />
    text   = `Enviado ${ago(reach.at!, now)} · cliente ainda não abriu`
    hint   = 'O link foi entregue, mas ninguém tocou nele ainda.'
  }

  return (
    <Tooltip title={hint} placement="top">
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.8,
        px: 1.2, py: 0.7, borderRadius: '10px',
        bgcolor: bg, border: `1px solid ${border}`, color: tone,
      }}>
        {icon}
        <Typography sx={{ fontSize: { xs: '0.64rem', xl: '0.72rem' }, fontWeight: 700, color: tone }}>
          {text}
        </Typography>
      </Box>
    </Tooltip>
  )
}
