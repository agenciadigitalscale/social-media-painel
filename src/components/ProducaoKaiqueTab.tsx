/* ProducaoKaiqueTab — a produção de vídeo do Kaique, para a liderança ver em
   tempo real (aba 26).

   O pedido: o Pradox cobrava, toda hora, "quantos vídeos você fez?". Em vez de o
   Kaique montar relatório à mão, esta aba mostra o MESMO painel que ele vê no
   Meu Dia (`MinhaProducaoDesigner` perfil vídeo), só que:
     • mirando o Kaique (`alvo="kaique"`), não quem abriu a aba;
     • em somente leitura (sem Registrar nem apagar) — a gestão OLHA, não edita.

   Por que "tempo real" não é promessa vazia: o painel deriva tudo de `items` +
   `states`, que chegam ao aparelho do Pradox pelo mesmo sync do resto; e o
   registro manual sincroniza por `sm_producao_manual` + evento `ds:producaoManual`.
   Um vídeo entra na conta assim que o card chega em "P/ enviar" (3+), quando é
   vinculado, ou por registro manual do Kaique — exatamente o que ele vê. */
import { Box, Typography } from '@mui/material'
import BoltIcon from '@mui/icons-material/Bolt'
import type { Client, ContentItem, ItemState } from '../types'
import MinhaProducaoDesigner from './MinhaProducaoDesigner'
import { DS } from '../theme'

export default function ProducaoKaiqueTab({ items, states, allClients, now, currentUser }: {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  now: Date
  currentUser: string
}) {
  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 0, md: 1 }, py: { xs: 0.5, md: 1.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1.4 }}>
        <BoltIcon sx={{ fontSize: 16, color: DS.green }} />
        <Typography sx={{ fontSize: { xs: '0.66rem', xl: '0.74rem' }, color: DS.t2, fontWeight: 600 }}>
          Atualiza em tempo real — um vídeo entra na conta assim que o card chega em
          “P/ enviar”, quando é vinculado, ou por registro manual.
        </Typography>
      </Box>
      <MinhaProducaoDesigner
        items={items}
        states={states}
        currentUser={currentUser}
        now={now}
        perfil="video"
        allClients={allClients}
        alvo="kaique"
        somenteLeitura
      />
    </Box>
  )
}
