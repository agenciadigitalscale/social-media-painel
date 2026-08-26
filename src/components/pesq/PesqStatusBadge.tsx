import { Box } from '@mui/material'
import { PESQ } from '../../lib/pesq/brand'
import { PESQ_STATUS, type PesqStatus } from '../../lib/pesq/publicacoes'

/**
 * O estado da publicação, legível de três formas ao mesmo tempo: cor, ícone e
 * palavra. Quem não distingue as matizes (ou está no sol, ou imprimiu a tela)
 * continua sabendo o que está acontecendo — cor nunca é o único canal.
 *
 * "Aguardando publicação" pulsa de leve, e só ele: é o único estado que pede
 * ação de alguém agora. Se tudo pulsasse, nada chamaria atenção.
 */
export default function PesqStatusBadge({ status, tamanho = 'md' }: {
  status: PesqStatus
  tamanho?: 'sm' | 'md'
}) {
  const cfg = PESQ_STATUS[status]
  const sm  = tamanho === 'sm'

  return (
    <Box
      role="status"
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: sm ? 0.5 : 0.7,
        px: sm ? 0.9 : 1.1, py: sm ? 0.34 : 0.46,
        borderRadius: `${PESQ.r.pill}px`,
        background: `${cfg.cor}16`,
        border: `1px solid ${cfg.cor}3d`,
        color: cfg.cor,
        fontSize: sm ? '0.62rem' : '0.68rem',
        fontWeight: 700, lineHeight: 1.4, whiteSpace: 'nowrap',
        transition: `all ${PESQ.slow} ${PESQ.ease}`,
        ...(status === 'publicado' && { boxShadow: `0 0 0 1px ${PESQ.greenLum}22, 0 6px 18px ${PESQ.greenMid}2e` }),
      }}
    >
      <Box aria-hidden sx={{
        width: sm ? 6 : 7, height: sm ? 6 : 7, borderRadius: '50%', flexShrink: 0,
        bgcolor: cfg.cor, boxShadow: `0 0 7px ${cfg.cor}`,
        ...(status === 'aguardando' && { animation: 'pesqPulse 2.2s ease-in-out infinite' }),
      }} />
      <Box component="span" aria-hidden sx={{ fontSize: sm ? '0.66rem' : '0.72rem', lineHeight: 1 }}>
        {cfg.icone}
      </Box>
      {sm ? cfg.curto : cfg.label}
    </Box>
  )
}
