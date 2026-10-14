/**
 * Conferência de clientes (2026-10-14): o que pode fazer um cliente "sumir" de
 * uma tela e aparecer em outra — card de cliente fora do cadastro, conteúdo em
 * mês em que o cliente está fora da carteira, e cadastros parecidos demais.
 * Só APONTA: juntar ou reativar é decisão de quem cuida da carteira (o caso
 * Compostela × Compostela Grill era o mesmo cliente; outro par pode não ser).
 */
import { useState } from 'react'
import { Box, Collapse, Typography } from '@mui/material'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import { rotuloMes } from '../../lib/planejamentoMes'
import type { ConferenciaClientes as Conferencia } from '../../lib/clientes'

export default function ConferenciaClientes({ conferencia, nomeDe }: {
  conferencia: Conferencia
  nomeDe: (id: string) => string
}) {
  const [aberto, setAberto] = useState(false)
  const { orfaos, foraDaCarteira, duplicados } = conferencia
  const total = orfaos.length + foraDaCarteira.length + duplicados.length
  if (total === 0) return null

  const titulo = { fontSize: { xs: '0.62rem', xl: '0.7rem' }, fontWeight: 700, color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.08em', mt: 1.2, mb: 0.4 } as const
  const linha = { fontSize: { xs: '0.72rem', xl: '0.82rem' }, color: DS.t2, lineHeight: 1.5 } as const

  return (
    <Box sx={{ borderRadius: '12px', border: `1px solid ${DS.amber}55`, bgcolor: DS.surface, px: { xs: 1.4, xl: 2 }, py: 1 }}>
      <Box {...clickable(() => setAberto(v => !v))} aria-expanded={aberto} sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}>
        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: DS.amber, flexShrink: 0 }} />
        <Typography sx={{ flex: 1, fontSize: { xs: '0.76rem', xl: '0.86rem' }, fontWeight: 700, color: DS.t1 }}>
          Conferência de clientes · {total} ponto{total === 1 ? '' : 's'} para olhar
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: DS.t3 }}>{aberto ? 'Fechar' : 'Ver'}</Typography>
      </Box>
      <Collapse in={aberto}>
        {duplicados.length > 0 && (
          <>
            <Typography sx={titulo}>Possíveis duplicados</Typography>
            {duplicados.map(d => (
              <Typography key={d.a + d.b} sx={linha}>
                <b style={{ color: DS.t1 }}>{nomeDe(d.a)}</b> e <b style={{ color: DS.t1 }}>{nomeDe(d.b)}</b> — {d.motivo}. Se forem o mesmo cliente, fale com quem administra para juntar (nenhum card se perde).
              </Typography>
            ))}
          </>
        )}
        {foraDaCarteira.length > 0 && (
          <>
            <Typography sx={titulo}>Conteúdo em mês fora da carteira</Typography>
            {foraDaCarteira.map(f => (
              <Typography key={f.id} sx={linha}>
                <b style={{ color: DS.t1 }}>{f.nome}</b> — {f.cards} card{f.cards === 1 ? '' : 's'} em {f.meses.map(rotuloMes).join(', ')}. Aparece com o selo "fora da carteira"; se ele segue cliente, ajuste a entrada/saída em Editar.
              </Typography>
            ))}
          </>
        )}
        {orfaos.length > 0 && (
          <>
            <Typography sx={titulo}>Cards de cliente fora do cadastro</Typography>
            {orfaos.map(o => (
              <Typography key={o.nome} sx={linha}>
                <b style={{ color: DS.t1 }}>{o.nome}</b> — {o.cards} card{o.cards === 1 ? '' : 's'}{o.sugestao ? ` · parecido com ${nomeDe(o.sugestao)}` : ''}.
              </Typography>
            ))}
          </>
        )}
      </Collapse>
    </Box>
  )
}
