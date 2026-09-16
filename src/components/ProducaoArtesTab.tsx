/* ProducaoArtesTab — a produção de artes de UM designer (Jhones ou Julio), para
   os sócios acompanharem em tempo real (abas 27 e 28).

   Mesmo desenho da [[ProducaoKaiqueTab]], só que perfil "design": conta ARTES
   APROVADAS pelo cliente (status 5/7), não vídeos finalizados. Reusa o painel do
   Meu Dia (`MinhaProducaoDesigner`) mirando o designer (`alvo`) em somente
   leitura — a gestão OLHA, não edita, e o número é o mesmo da lib, sem divergir.

   "Tempo real": deriva de `items` + `states`, que chegam ao aparelho do sócio
   pelo mesmo sync do resto. Uma arte entra na conta assim que o cliente aprova. */
import { Box, Typography } from '@mui/material'
import BoltIcon from '@mui/icons-material/Bolt'
import type { Client, ContentItem, ItemState } from '../types'
import MinhaProducaoDesigner from './MinhaProducaoDesigner'
import { getDisplayName } from '../lib/users'
import { DS } from '../theme'

export default function ProducaoArtesTab({ items, states, allClients, now, currentUser, designer }: {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  now: Date
  currentUser: string
  /** username do designer cuja produção esta aba mostra (ex.: 'jhones', 'julio'). */
  designer: string
}) {
  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 0, md: 1 }, py: { xs: 0.5, md: 1.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1.4 }}>
        <BoltIcon sx={{ fontSize: 16, color: DS.green }} />
        <Typography sx={{ fontSize: { xs: '0.66rem', xl: '0.74rem' }, color: DS.t2, fontWeight: 600 }}>
          Produção de {getDisplayName(designer)} em tempo real — uma arte entra na conta
          assim que o cliente aprova.
        </Typography>
      </Box>
      <MinhaProducaoDesigner
        items={items}
        states={states}
        currentUser={currentUser}
        now={now}
        perfil="design"
        allClients={allClients}
        alvo={designer}
        somenteLeitura
      />
    </Box>
  )
}
