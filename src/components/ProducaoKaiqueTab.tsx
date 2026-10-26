/* ProducaoKaiqueTab — a produção de vídeo do Kaique, para a liderança ver em
   tempo real (aba 26).

   O pedido: o Pradox cobrava, toda hora, "quantos vídeos você fez?". Em vez de o
   Kaique montar relatório à mão, esta aba mostra o MESMO painel que ele vê no
   Meu Dia (`MinhaProducaoDesigner` perfil vídeo), só que:
     • mirando o editor escolhido no seletor (Kaique, Emanuelly… — todo editor
       do cargo, 2026-10-26), não quem abriu a aba;
     • em somente leitura (sem Registrar nem apagar) — a gestão OLHA, não edita.

   Por que "tempo real" não é promessa vazia: o painel deriva tudo de `items` +
   `states`, que chegam ao aparelho do Pradox pelo mesmo sync do resto; e o
   registro manual sincroniza por `sm_producao_manual` + evento `ds:producaoManual`.
   Um vídeo entra na conta assim que o card chega em "P/ enviar" (3+), quando é
   vinculado, ou por registro manual do Kaique — exatamente o que ele vê. */
import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import BoltIcon from '@mui/icons-material/Bolt'
import type { Client, ContentItem, ItemState } from '../types'
import MinhaProducaoDesigner from './MinhaProducaoDesigner'
import CoberturaProducao from './CoberturaProducao'
import { TIPOS_VIDEO, isFinalizado } from '../lib/designerProducao'
import { DS } from '../theme'
import { clickable } from '../shared/a11y'
import { membrosDoCargo } from '../lib/access'
import { getDisplayName } from '../lib/users'

export default function ProducaoKaiqueTab({ items, states, allClients, now, currentUser, onReatribuir }: {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  now: Date
  currentUser: string
  onReatribuir?: (itemId: number, membro: string) => void
}) {
  const editores = membrosDoCargo('editor')
  const [editor, setEditor] = useState(editores[0] ?? 'kaique')
  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 0, md: 1 }, py: { xs: 0.5, md: 1.5 } }}>
      {editores.length > 1 && (
        <Box sx={{ display: 'flex', gap: 0.6, mb: 1.4, flexWrap: 'wrap' }}>
          {editores.map(u => (
            <Box key={u} {...clickable(() => setEditor(u))} aria-pressed={editor === u} sx={{
              px: 1.6, height: 34, display: 'flex', alignItems: 'center', borderRadius: '9px', cursor: 'pointer',
              fontSize: { xs: '0.78rem', xl: '0.86rem' }, fontWeight: 800, transition: 'all 0.18s ease',
              border: `1px solid ${editor === u ? DS.accent : DS.border}`,
              ...(editor === u ? { bgcolor: `${DS.accent}1f`, color: DS.accent } : { color: DS.t2 }),
            }}>
              {getDisplayName(u)}
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1.4 }}>
        <BoltIcon sx={{ fontSize: 16, color: DS.green }} />
        <Typography sx={{ fontSize: { xs: '0.66rem', xl: '0.74rem' }, color: DS.t2, fontWeight: 600 }}>
          Atualiza em tempo real — um vídeo entra na conta assim que o card é entregue
          para a Revisão, quando é vinculado, ou por registro manual.
        </Typography>
      </Box>
      <CoberturaProducao
        items={items}
        states={states}
        tipos={TIPOS_VIDEO}
        opts={{ conta: isFinalizado }}
        substSingular="vídeo"
        area="video"
        onReatribuir={onReatribuir}
        substPlural="vídeos"
      />
      <MinhaProducaoDesigner
        items={items}
        states={states}
        currentUser={currentUser}
        now={now}
        perfil="video"
        allClients={allClients}
        alvo={editor}
        somenteLeitura
        onReatribuir={onReatribuir}
      />
    </Box>
  )
}
