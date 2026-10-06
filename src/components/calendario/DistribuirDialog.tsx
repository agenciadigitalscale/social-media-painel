/**
 * "Distribuir conteúdos": marca os tipos (Reel · Design · Feed), informa os
 * conteúdos — um nome por linha, sem prefixo ("VIDEO -", "POST -"): o campo já
 * diz o tipo — e cada um vai para a próxima VAGA livre do mesmo tipo, em ordem
 * de data (lib/padraoEditorial, distribuirNasVagas). Sem nomes, cria o que falta
 * para a meta com "pauta a definir".
 *
 * A prévia mostra cada dia antes de criar: distribuir é criar card, e card
 * criado errado vira trabalho para apagar.
 */
import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import type { ContentItem } from '../../types'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import { COR_TIPO, ROTULO_TIPO, distribuirNasVagas, semPrefixo, tipoDoPadrao, tituloPlanejado, type TipoPadrao, type Vaga } from '../../lib/padraoEditorial'

const ORDEM: TipoPadrao[] = ['Reel', 'Post', 'Feed']
const DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export interface Distribuicao { tipo: TipoPadrao; data: Date; titulo: string }

export default function DistribuirDialog({ open, cliente, nomeMes, ano, mes, livres, meta, existentes, hoje, onClose, onConfirmar }: {
  open: boolean
  cliente: string
  nomeMes: string
  ano: number
  mes: number
  /** Vagas (preferências por data) do mês que ainda não têm conteúdo. */
  livres: Vaga[]
  meta: Record<TipoPadrao, number>
  existentes: ContentItem[]
  hoje: Date
  onClose: () => void
  onConfirmar: (lista: Distribuicao[]) => void
}) {
  const [tipos, setTipos] = useState<TipoPadrao[]>(['Reel', 'Post'])
  const [nomes, setNomes] = useState<Record<TipoPadrao, string>>({ Reel: '', Post: '', Feed: '' })
  useEffect(() => { if (open) { setTipos(['Reel', 'Post']); setNomes({ Reel: '', Post: '', Feed: '' }) } }, [open])

  const linhas = (t: TipoPadrao) => nomes[t].split('\n').map(semPrefixo).filter(Boolean)
  const ja = (t: TipoPadrao) => existentes.filter(i => tipoDoPadrao(i.tp) === t).length
  const faltaMeta = (t: TipoPadrao) => Math.max(0, meta[t] - ja(t))
  const vagasDo = (t: TipoPadrao) => livres.filter(v => v.tipo === t).length

  const { previa, sobra } = useMemo(() => {
    if (!open || tipos.length === 0) return { previa: [] as Distribuicao[], sobra: {} as Partial<Record<TipoPadrao, number>> }
    const pedidos = Object.fromEntries(tipos.map(t => [t, linhas(t).length || faltaMeta(t)])) as Partial<Record<TipoPadrao, number>>
    const r = distribuirNasVagas({ ano, mes, livres, pedidos, hoje })
    const usados: Record<TipoPadrao, number> = { Reel: 0, Post: 0, Feed: 0 }
    const previa = r.plano.map(p => {
      const titulo = linhas(p.tipo)[usados[p.tipo]] ?? tituloPlanejado(p.tipo)
      usados[p.tipo]++
      return { tipo: p.tipo, data: p.data, titulo }
    })
    return { previa, sobra: r.sobra }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tipos, nomes, ano, mes, livres, meta, existentes, hoje])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 800 }}>Distribuir conteúdos — {cliente}</Typography>
        <Typography sx={{ fontSize: '0.72rem', color: DS.t2, mt: 0.3 }}>
          {nomeMes[0].toUpperCase() + nomeMes.slice(1)}. Cada conteúdo vai para a próxima preferência livre do mesmo tipo, em ordem de data. A entrega entra na fila pela publicação.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, gap: 2.5, pt: '12px !important' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.6 }}>
          <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
            {ORDEM.map(t => {
              const on = tipos.includes(t)
              const cor = COR_TIPO[t]
              return (
                <Box key={t} {...clickable(() => setTipos(prev => on ? prev.filter(x => x !== t) : [...prev, t]))} aria-pressed={on} sx={{
                  px: 1.6, height: 34, display: 'flex', alignItems: 'center', gap: 0.8, borderRadius: '9px', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 800, transition: 'all 0.15s ease',
                  bgcolor: on ? `${cor}1f` : 'transparent', color: on ? DS.t1 : DS.t2,
                  border: `1px solid ${on ? cor : DS.border}`, '&:hover': { borderColor: cor },
                }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cor }} />
                  {ROTULO_TIPO[t]}
                </Box>
              )
            })}
          </Box>
          {tipos.length === 0 && <Typography sx={{ fontSize: '0.76rem', color: DS.t3 }}>Marque pelo menos um tipo.</Typography>}
          {ORDEM.filter(t => tipos.includes(t)).map(t => (
            <Box key={t}>
              <TextField
                multiline minRows={3} maxRows={8} fullWidth size="small"
                label={`Conteúdos ${ROTULO_TIPO[t]} — um por linha`}
                placeholder="Ex.: Bastidores da cozinha"
                value={nomes[t]} onChange={e => setNomes(n => ({ ...n, [t]: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem', bgcolor: DS.field }, '& fieldset': { borderColor: `${COR_TIPO[t]}55` } }}
              />
              <Typography sx={{ fontSize: '0.66rem', color: DS.t3, mt: 0.4 }}>
                {ja(t)} já no mês · {vagasDo(t)} preferência{vagasDo(t) !== 1 ? 's' : ''} livre{vagasDo(t) !== 1 ? 's' : ''} · {linhas(t).length ? `${linhas(t).length} informado${linhas(t).length !== 1 ? 's' : ''}` : `${faltaMeta(t)} para completar a meta`}
              </Typography>
              {(sobra[t] ?? 0) > 0 && (
                <Typography sx={{ fontSize: '0.66rem', color: DS.amber, mt: 0.2 }}>
                  {sobra[t]} não cabe{sobra[t] !== 1 ? 'm' : ''} — faltam preferências de {ROTULO_TIPO[t]} livres daqui em diante. Adicione vagas clicando nos dias do calendário.
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', color: DS.t3, mb: 0.8 }}>
            PRÉVIA · {previa.length} conteúdo{previa.length !== 1 ? 's' : ''}
          </Typography>
          <Box sx={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {previa.length === 0 && <Typography sx={{ fontSize: '0.76rem', color: DS.t3 }}>Nada a criar — a meta destes tipos já está completa ou não há preferência livre.</Typography>}
            {previa.map((p, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.7, borderRadius: '8px', bgcolor: DS.surfaceAlt, border: `1px solid ${DS.border}`, borderLeft: `3px solid ${COR_TIPO[p.tipo]}` }}>
                <Typography sx={{ width: 64, flexShrink: 0, fontSize: '0.72rem', fontWeight: 800, color: DS.t1 }}>
                  {DIA_CURTO[p.data.getDay()]} {String(p.data.getDate()).padStart(2, '0')}
                </Typography>
                <Typography sx={{ width: 52, flexShrink: 0, fontSize: '0.6rem', fontWeight: 800, color: COR_TIPO[p.tipo], textTransform: 'uppercase' }}>{ROTULO_TIPO[p.tipo]}</Typography>
                <Typography noWrap sx={{ fontSize: '0.74rem', color: DS.t2, minWidth: 0 }}>{p.titulo}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: DS.t2 }}>Cancelar</Button>
        <Button variant="contained" disabled={previa.length === 0} onClick={() => onConfirmar(previa)}>
          Distribuir {previa.length || ''}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
