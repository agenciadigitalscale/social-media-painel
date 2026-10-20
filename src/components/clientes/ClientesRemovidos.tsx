/**
 * Clientes removidos (2026-10-20): quem saiu da carteira pelo "Remover cliente",
 * com a opção de voltar. Remover nunca apagou nada — cards, pastas, portal e
 * histórico ficam —, então voltar é só tirar o mês de saída.
 */
import { useState } from 'react'
import { Box, Button, Collapse, Typography } from '@mui/material'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import { rotuloMes } from '../../lib/planejamentoMes'
import type { ClienteRemovido } from '../../lib/clientes'

export default function ClientesRemovidos({ removidos, onVoltar }: {
  removidos: ClienteRemovido[]
  onVoltar: (id: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  if (removidos.length === 0) return null

  return (
    <Box sx={{ borderRadius: '12px', border: `1px solid ${DS.border}`, bgcolor: DS.surface, px: { xs: 1.4, xl: 2 }, py: 1 }}>
      <Box {...clickable(() => setAberto(v => !v))} aria-expanded={aberto} sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}>
        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: DS.t3, flexShrink: 0 }} />
        <Typography sx={{ flex: 1, fontSize: { xs: '0.76rem', xl: '0.86rem' }, fontWeight: 700, color: DS.t1 }}>
          Clientes removidos · {removidos.length}
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: DS.t3 }}>{aberto ? 'Fechar' : 'Ver'}</Typography>
      </Box>
      <Collapse in={aberto}>
        <Typography sx={{ fontSize: '0.72rem', color: DS.t2, mt: 1, mb: 1 }}>
          Saíram da carteira, mas nada foi apagado. "Voltar" devolve o cliente à carteira a partir de agora, com o histórico de sempre.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(3, 1fr)' }, gap: 0.8, pb: 0.6 }}>
          {removidos.map(r => (
            <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: '9px', bgcolor: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
              <Box sx={{ width: 30, height: 30, borderRadius: '8px', bgcolor: DS.field, border: `1px solid ${DS.border}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Typography sx={{ fontWeight: 900, fontSize: '0.82rem', color: DS.t2 }}>{r.nome.charAt(0).toUpperCase()}</Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: { xs: '0.8rem', xl: '0.9rem' }, fontWeight: 800, color: DS.t1 }}>{r.nome}</Typography>
                <Typography sx={{ fontSize: '0.66rem', color: DS.t3 }}>Fora da carteira desde {rotuloMes(r.saida)}</Typography>
              </Box>
              <Button size="small" variant="outlined" onClick={() => {
                if (window.confirm(`Voltar "${r.nome}" para a carteira? Ele passa a aparecer de novo em Clientes, Calendário e Cronograma.`)) onVoltar(r.id)
              }} sx={{ textTransform: 'none', fontWeight: 800, fontSize: '0.72rem', flexShrink: 0 }}>
                Voltar
              </Button>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}
