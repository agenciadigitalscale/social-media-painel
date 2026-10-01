/**
 * "Distribuir conteúdos": escolhe os tipos (Reel · Feed · Post), informa os
 * conteúdos — um nome por linha — e o painel acha os dias pelas preferências do
 * mês. Sem nomes, cria o que falta para a meta com "pauta a definir".
 *
 * A prévia mostra cada dia antes de criar: distribuir é criar card, e card
 * criado errado vira trabalho para apagar.
 */
import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import type { ContentItem } from '../../types'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import { diasPreferidosNoMes, planejarDistribuicao, tipoDoPadrao, tituloPlanejado, type PadraoCliente, type TipoPadrao } from '../../lib/padraoEditorial'

/** Na tela os botões são Reel | Feed | Post (Post = Design). */
const BOTOES: { t: TipoPadrao; rotulo: string }[] = [
  { t: 'Reel', rotulo: 'Reel' }, { t: 'Feed', rotulo: 'Feed' }, { t: 'Post', rotulo: 'Post (Design)' },
]
const DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export interface Distribuicao { tipo: TipoPadrao; data: Date; titulo: string }

export default function DistribuirDialog({ open, cliente, nomeMes, ano, mes, padrao, meta, existentes, hoje, onClose, onConfirmar }: {
  open: boolean
  cliente: string
  nomeMes: string
  ano: number
  mes: number
  padrao: PadraoCliente
  meta: Record<TipoPadrao, number>
  existentes: ContentItem[]
  hoje: Date
  onClose: () => void
  onConfirmar: (lista: Distribuicao[]) => void
}) {
  const [tipos, setTipos] = useState<TipoPadrao[]>(['Reel', 'Post'])
  const [nomes, setNomes] = useState<Record<TipoPadrao, string>>({ Reel: '', Post: '', Feed: '' })
  useEffect(() => { if (open) { setTipos(['Reel', 'Post']); setNomes({ Reel: '', Post: '', Feed: '' }) } }, [open])

  const linhas = (t: TipoPadrao) => nomes[t].split('\n').map(s => s.trim()).filter(Boolean)
  const ja = (t: TipoPadrao) => existentes.filter(i => tipoDoPadrao(i.tp) === t).length
  const faltaMeta = (t: TipoPadrao) => Math.max(0, meta[t] - ja(t))

  const previa = useMemo<Distribuicao[]>(() => {
    if (!open || tipos.length === 0) return []
    const quantidade = Object.fromEntries(tipos.map(t => [t, linhas(t).length || faltaMeta(t)])) as Partial<Record<TipoPadrao, number>>
    const plano = planejarDistribuicao({ ano, mes, padrao, meta, existentes, hoje, tipos, quantidade })
    const usados: Record<TipoPadrao, number> = { Reel: 0, Post: 0, Feed: 0 }
    return plano.map(p => {
      const lista = linhas(p.tipo)
      const titulo = lista[usados[p.tipo]] ?? tituloPlanejado(p.tipo)
      usados[p.tipo]++
      return { tipo: p.tipo, data: p.data, titulo }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tipos, nomes, ano, mes, padrao, meta, existentes, hoje])

  const semDias = (t: TipoPadrao) => !padrao.dias[t]?.length
  const diasDoTipo = (t: TipoPadrao) => diasPreferidosNoMes(padrao, t, ano, mes).length
  // Quantos dias da prévia recebem mais de um conteúdo do mesmo tipo.
  const repetidos = (t: TipoPadrao) => {
    const cont = new Map<string, number>()
    for (const p of previa) if (p.tipo === t) { const k = p.data.toDateString(); cont.set(k, (cont.get(k) ?? 0) + 1) }
    return [...cont.values()].filter(n => n > 1).length
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 800 }}>Distribuir conteúdos — {cliente}</Typography>
        <Typography sx={{ fontSize: '0.72rem', color: DS.t2, mt: 0.3 }}>
          {nomeMes[0].toUpperCase() + nomeMes.slice(1)}. Os dias saem das preferências do mês; a entrega fica 12 dias antes de cada postagem.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, gap: 2.5, pt: '12px !important' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.6 }}>
          <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
            {BOTOES.map(b => {
              const on = tipos.includes(b.t)
              return (
                <Box key={b.t} {...clickable(() => setTipos(prev => on ? prev.filter(x => x !== b.t) : [...prev, b.t]))} aria-pressed={on} sx={{
                  px: 1.6, height: 34, display: 'flex', alignItems: 'center', borderRadius: '9px', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 800, transition: 'all 0.15s ease',
                  bgcolor: on ? DS.accent : 'transparent', color: on ? DS.onAccent : DS.t2,
                  border: `1px solid ${on ? DS.accent : DS.border}`, '&:hover': { borderColor: DS.accent },
                }}>{b.rotulo}</Box>
              )
            })}
          </Box>
          {tipos.length === 0 && <Typography sx={{ fontSize: '0.76rem', color: DS.t3 }}>Marque pelo menos um tipo.</Typography>}
          {BOTOES.filter(b => tipos.includes(b.t)).map(b => (
            <Box key={b.t}>
              <TextField
                multiline minRows={3} maxRows={8} fullWidth size="small"
                label={`${b.rotulo} — um conteúdo por linha (opcional)`}
                placeholder={`Vazio = cria ${faltaMeta(b.t)} com "pauta a definir" (falta para a meta de ${meta[b.t]})`}
                value={nomes[b.t]} onChange={e => setNomes(n => ({ ...n, [b.t]: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem', bgcolor: DS.field } }}
              />
              <Typography sx={{ fontSize: '0.66rem', color: semDias(b.t) ? DS.amber : DS.t3, mt: 0.4 }}>
                {semDias(b.t)
                  ? 'Sem dias definidos para este tipo no mês — usa de segunda a sexta.'
                  : `${ja(b.t)} já no mês · ${linhas(b.t).length ? `${linhas(b.t).length} informado${linhas(b.t).length !== 1 ? 's' : ''}` : `${faltaMeta(b.t)} para completar a meta`}`}
              </Typography>
              {!semDias(b.t) && repetidos(b.t) > 0 && (
                <Typography sx={{ fontSize: '0.66rem', color: DS.amber, mt: 0.2 }}>
                  O mês tem {diasDoTipo(b.t)} dia{diasDoTipo(b.t) !== 1 ? 's' : ''} de {b.rotulo} nas preferências — {repetidos(b.t)} dia{repetidos(b.t) !== 1 ? 's' : ''} vai receber mais de um.
                  Para espalhar, marque mais dias em "Preferências do mês".
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
            {previa.length === 0 && <Typography sx={{ fontSize: '0.76rem', color: DS.t3 }}>Nada a criar — a meta destes tipos já está completa.</Typography>}
            {previa.map((p, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.7, borderRadius: '8px', bgcolor: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
                <Typography sx={{ width: 64, flexShrink: 0, fontSize: '0.72rem', fontWeight: 800, color: DS.t1 }}>
                  {DIA_CURTO[p.data.getDay()]} {String(p.data.getDate()).padStart(2, '0')}
                </Typography>
                <Typography sx={{ width: 44, flexShrink: 0, fontSize: '0.6rem', fontWeight: 800, color: DS.t3, textTransform: 'uppercase' }}>{p.tipo}</Typography>
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
