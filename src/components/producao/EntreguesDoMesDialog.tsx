/**
 * "Entregues no mês" da Minha esteira (2026-10-22): o que o editor/designer já
 * entregou e saiu do quadro dele (foi para o cliente, programado ou publicado).
 * Só para ver — o card segue o fluxo no quadro do Social. Regra em lib/entreguesDoMes.
 */
import { useMemo, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { ContentItem, ItemState } from '../../types'
import { STATUS_CONFIG } from '../../types'
import { DS } from '../../theme'
import { nomeDoCliente } from '../../lib/clientes'
import { entreguesDoMes } from '../../lib/entreguesDoMes'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const pad = (n: number) => String(n).padStart(2, '0')

export function useEntreguesDoMes(items: ContentItem[], states: Record<number, ItemState>, doQuadro: (it: ContentItem) => boolean, ref: Date) {
  const ano = ref.getFullYear(), mes = ref.getMonth()
  return useMemo(() => entreguesDoMes(items, states, ano, mes, doQuadro), [items, states, ano, mes, doQuadro])
}

export default function EntreguesDoMesDialog({ open, onClose, items, states, doQuadro, rotulo }: {
  open: boolean
  onClose: () => void
  items: ContentItem[]
  states: Record<number, ItemState>
  doQuadro: (it: ContentItem) => boolean
  /** "vídeos" ou "artes". */
  rotulo: string
}) {
  const [ref, setRef] = useState(() => new Date())
  const lista = useEntreguesDoMes(items, states, doQuadro, ref)
  const andar = (d: -1 | 1) => setRef(r => new Date(r.getFullYear(), r.getMonth() + d, 1))
  const porStatus = new Map<number, number>()
  for (const e of lista) porStatus.set(e.status, (porStatus.get(e.status) ?? 0) + 1)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontFamily: DS.fontDisplay, textTransform: 'uppercase', fontSize: { xs: '1.2rem', xl: '1.45rem' }, color: DS.t1 }}>
          Entregues no mês
        </Typography>
        <Typography sx={{ fontSize: '0.76rem', color: DS.t2 }}>
          Os {rotulo} que você entregou e saíram da sua esteira — foram para o cliente, programados ou publicados.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: '10px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.4 }}>
          <IconButton size="small" aria-label="Mês anterior" onClick={() => andar(-1)} sx={{ color: DS.t1 }}><ChevronLeftIcon /></IconButton>
          <Typography sx={{ minWidth: 150, textAlign: 'center', fontWeight: 800, color: DS.t1 }}>{MESES[ref.getMonth()]} de {ref.getFullYear()}</Typography>
          <IconButton size="small" aria-label="Próximo mês" onClick={() => andar(1)} sx={{ color: DS.t1 }}><ChevronRightIcon /></IconButton>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: { xs: '1.4rem', xl: '1.7rem' }, fontWeight: 900, color: DS.t1, lineHeight: 1 }}>{lista.length}</Typography>
          <Typography sx={{ fontSize: '0.74rem', color: DS.t2 }}>{rotulo} entregues</Typography>
        </Box>
        {porStatus.size > 0 && (
          <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', mb: 1.4 }}>
            {[...porStatus].sort((a, b) => b[1] - a[1]).map(([s, n]) => {
              const cfg = STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]
              return (
                <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, px: 1, py: 0.3, borderRadius: '999px', border: `1px solid ${cfg.color}66`, bgcolor: `${cfg.color}14` }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cfg.color }} />
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: cfg.color }}>{cfg.shortLabel} · {n}</Typography>
                </Box>
              )
            })}
          </Box>
        )}
        {lista.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', border: `1px dashed ${DS.border}`, borderRadius: '12px' }}>
            <Typography sx={{ color: DS.t2 }}>Nenhuma entrega neste mês.</Typography>
          </Box>
        ) : (
          <Box sx={{ borderRadius: '12px', border: `1px solid ${DS.border}`, overflow: 'hidden' }}>
            {lista.map(e => {
              const st = states[e.item.i]
              const cfg = STATUS_CONFIG[e.status]
              const link = st?.igPermalink || st?.fbPermalink
              const d = new Date(e.quando)
              return (
                <Box key={e.item.i} sx={{ display: 'flex', alignItems: 'center', gap: 1.4, px: 1.6, py: 1, borderBottom: `1px solid ${DS.border}`, '&:last-of-type': { borderBottom: 'none' } }}>
                  <Typography sx={{ width: 44, flexShrink: 0, fontSize: '0.8rem', fontWeight: 800, color: DS.t1 }}>{pad(d.getDate())}/{pad(d.getMonth() + 1)}</Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: '0.66rem', fontWeight: 700, color: DS.t3 }}>{nomeDoCliente(e.item.c)} · {e.item.tp}</Typography>
                    <Typography noWrap sx={{ fontSize: { xs: '0.8rem', xl: '0.88rem' }, fontWeight: 700, color: DS.t1 }}>{st?.title || e.item.n}</Typography>
                  </Box>
                  {link && (
                    <Box component="a" href={link} target="_blank" rel="noreferrer" sx={{ fontSize: '0.72rem', fontWeight: 700, color: DS.accent, textDecoration: 'none', flexShrink: 0 }}>ver post ↗</Box>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, width: { xs: 'auto', md: 110 }, justifyContent: 'flex-end' }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cfg.color }} />
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: cfg.color }}>{cfg.shortLabel}</Typography>
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" sx={{ color: DS.t1, borderColor: DS.border }}>Fechar</Button>
      </DialogActions>
    </Dialog>
  )
}
