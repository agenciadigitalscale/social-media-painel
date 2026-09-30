/* CoberturaProducao — o alerta que impede a contagem de mentir por omissão.

   A produção de cada pessoa só conta o que está ATRIBUÍDO a ela (gaveta com
   membro, assignedEditor ou responsible). Trabalho aprovado sem nenhuma dessas
   marcas não entra em contagem nenhuma — e o número de alguém fica baixo sem
   ninguém perceber. Esta faixa mostra exatamente esse vazamento, em tempo real.

   Só aparece quando há o que mostrar: cobertura cheia = silêncio, senão a faixa
   viraria ruído fixo que todo mundo aprende a ignorar. */
import { useEffect, useMemo, useState } from 'react'
import { Box, Typography, Collapse } from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { ContentItem, ContentType, ItemState } from '../types'
import { pecasSemAutor, type ContagemOpts } from '../lib/designerProducao'
import { carregarPaineis, carregarAtribuicoes, EVENTO_ATRIBUICOES } from '../lib/paineis'
import TrocarProfissional from './TrocarProfissional'
import { DS } from '../theme'
import { clickable } from '../shared/a11y'

export default function CoberturaProducao({ items, states, tipos, opts, substSingular, substPlural, area, onReatribuir }: {
  items: ContentItem[]
  states: Record<number, ItemState>
  tipos: ReadonlySet<ContentType>
  /** Mesma regra de contagem da aba (aprovado por padrão; finalizado no vídeo). */
  opts?: ContagemOpts
  /** "arte" / "vídeo" para o texto. */
  substSingular: string
  substPlural: string
  /** Área da lista — decide quem aparece no "Atribuir a". */
  area?: 'video' | 'design'
  /** Atribuir direto daqui (só sócio). */
  onReatribuir?: (itemId: number, membro: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [versaoAtrib, setVersaoAtrib] = useState(0)
  useEffect(() => {
    const reler = () => setVersaoAtrib(v => v + 1)
    window.addEventListener(EVENTO_ATRIBUICOES, reler)
    return () => window.removeEventListener(EVENTO_ATRIBUICOES, reler)
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const paineis = useMemo(() => carregarPaineis(), [versaoAtrib])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const atrib = useMemo(() => carregarAtribuicoes(), [versaoAtrib])

  const semAutor = useMemo(
    () => pecasSemAutor(items, states, atrib, paineis, tipos, new Set(), opts ?? {}),
    [items, states, atrib, paineis, tipos, opts],
  )

  if (semAutor.length === 0) return null

  const n = semAutor.length
  const label = n === 1 ? substSingular : substPlural

  return (
    <Box sx={{
      mb: 1.6, borderRadius: '12px', overflow: 'hidden',
      border: `1px solid ${DS.amber}44`, bgcolor: `${DS.amber}0f`,
      animation: 'fadeInUp 0.3s cubic-bezier(0.16,1,0.3,1) both',
    }}>
      <Box {...clickable(() => setAberto(v => !v))} sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 1.4, py: 1, cursor: 'pointer',
      }}>
        <WarningAmberIcon sx={{ fontSize: 17, color: DS.amber, flexShrink: 0 }} />
        <Typography sx={{ fontSize: { xs: '0.68rem', xl: '0.76rem' }, color: DS.t1, fontWeight: 700, minWidth: 0 }}>
          {n} {label} entregue{n === 1 ? '' : 's'} sem responsável — não {n === 1 ? 'entra' : 'entram'} em nenhuma contagem
        </Typography>
        <ExpandMoreIcon sx={{
          fontSize: 18, color: DS.t3, ml: 'auto', flexShrink: 0,
          transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease',
        }} />
      </Box>
      <Collapse in={aberto}>
        <Box sx={{ px: 1.4, pb: 1.2 }}>
          <Typography sx={{ fontSize: '0.63rem', color: DS.t2, mb: 0.9 }}>
            Essas peças já foram entregues mas não estão marcadas com um responsável (gaveta, editor ou dono).
            Atribua cada uma a quem a fez — aqui mesmo, pelo botão ao lado, ou no board de Produções.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, maxHeight: 200, overflow: 'auto' }}>
            {semAutor.slice(0, 40).map(p => (
              <Box key={p.itemId} sx={{
                display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5,
                borderRadius: '7px', bgcolor: DS.field, border: `1px solid ${DS.border}`,
              }}>
                <Typography sx={{ fontSize: { xs: '0.64rem', xl: '0.72rem' }, color: DS.t1, fontWeight: 600, minWidth: 0 }} noWrap>
                  {p.titulo}
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', color: DS.t3, ml: 'auto', flexShrink: 0 }} noWrap>{p.cliente}</Typography>
                {onReatribuir && area && (
                  <TrocarProfissional area={area} titulo={p.titulo} onEscolher={m => onReatribuir(p.itemId, m)} />
                )}
              </Box>
            ))}
            {semAutor.length > 40 && (
              <Typography sx={{ fontSize: '0.6rem', color: DS.t3, mt: 0.3 }}>
                …e mais {semAutor.length - 40}.
              </Typography>
            )}
          </Box>
        </Box>
      </Collapse>
    </Box>
  )
}
