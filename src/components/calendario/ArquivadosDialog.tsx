/**
 * Arquivados (Lixeira): o conteúdo arquivado continua salvo, com histórico e
 * dados, mas sai das telas de trabalho. Daqui ele volta (Restaurar) ou sai de
 * vez (Excluir definitivamente — só sócio, sempre com confirmação).
 */
import { useMemo, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material'
import type { ContentItem, ItemState } from '../../types'
import { STATUS_CONFIG } from '../../types'
import { DS } from '../../theme'
import { corDoConteudo, rotuloDoTipo } from '../../lib/padraoEditorial'

export default function ArquivadosDialog({ open, itens, states, onClose, onRestaurar, onExcluirDefinitivo }: {
  open: boolean
  itens: ContentItem[]
  states: Record<number, ItemState>
  onClose: () => void
  onRestaurar: (id: number) => void
  /** Ausente = quem vê não pode excluir de vez. */
  onExcluirDefinitivo?: (id: number) => void
}) {
  const [busca, setBusca] = useState('')
  const [cliente, setCliente] = useState('todos')
  const clientes = useMemo(() => [...new Set(itens.map(i => i.c))].sort((a, b) => a.localeCompare(b)), [itens])
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return itens
      .filter(i => (cliente === 'todos' || i.c === cliente) && (!q || `${i.c} ${states[i.i]?.title || ''} ${i.n}`.toLowerCase().includes(q)))
      .sort((a, b) => b.dt.getTime() - a.dt.getTime())
  }, [itens, states, busca, cliente])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 800 }}>Arquivados</Typography>
        <Typography sx={{ fontSize: '0.72rem', color: DS.t2, mt: 0.3 }}>
          Fora do Calendário e da Produção, mas salvos. Restaurar devolve o conteúdo como estava.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, pt: '12px !important' }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField select size="small" label="Cliente" value={cliente} onChange={e => setCliente(e.target.value)} sx={{ minWidth: 200 }} slotProps={{ inputLabel: { shrink: true } }}>
            <MenuItem value="todos" sx={{ fontSize: '0.8rem' }}>Todos</MenuItem>
            {clientes.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{c}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Buscar" value={busca} onChange={e => setBusca(e.target.value)} sx={{ flex: 1, minWidth: 180 }} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>
        <Typography sx={{ fontSize: '0.7rem', color: DS.t3 }}>{lista.length} conteúdo{lista.length !== 1 ? 's' : ''}</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7, maxHeight: '55vh', overflowY: 'auto' }}>
          {lista.length === 0 && <Typography sx={{ fontSize: '0.8rem', color: DS.t3, py: 3, textAlign: 'center' }}>Nada arquivado.</Typography>}
          {lista.map(it => {
            const st = states[it.i]
            const s = st?.status ?? it.s
            const cor = corDoConteudo(it.tp)
            return (
              <Box key={it.i} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, px: 1.2, py: 0.9, borderRadius: '10px', bgcolor: DS.surfaceAlt, border: `1px solid ${DS.border}`, borderLeft: `3px solid ${cor}` }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 700, color: DS.t1 }}>{st?.title || it.n}</Typography>
                  <Typography noWrap sx={{ fontSize: '0.68rem', color: DS.t3 }}>
                    {it.c} · {rotuloDoTipo(it.tp)} · {it.dt.toLocaleDateString('pt-BR')} · {STATUS_CONFIG[s]?.shortLabel ?? s}
                  </Typography>
                </Box>
                <Button size="small" onClick={() => onRestaurar(it.i)} sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'none', color: DS.accent }}>Restaurar</Button>
                {onExcluirDefinitivo && (
                  <Button size="small" onClick={() => {
                    if (window.confirm(`Excluir DEFINITIVAMENTE "${st?.title || it.n}" (${it.c})? Não dá para desfazer.`)) onExcluirDefinitivo(it.i)
                  }} sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'none', color: DS.red }}>Excluir de vez</Button>
                )}
              </Box>
            )
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained">Fechar</Button>
      </DialogActions>
    </Dialog>
  )
}
