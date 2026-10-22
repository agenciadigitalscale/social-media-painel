/**
 * "Total esperado no mês" (aba Entregas do time, 2026-10-22): quanto o time
 * precisa entregar no mês somando a meta de todos os clientes, quanto já
 * entregou, quanto falta e o ritmo por dia útil para fechar. Regra em lib/metaDoTime.
 */
import { useMemo, useState } from 'react'
import { Box, Collapse, Paper, Typography } from '@mui/material'
import type { Client } from '../../types'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import { nomeDoCliente } from '../../lib/clientes'
import { carregarPadroes } from '../../lib/padraoEditorial'
import { carregarCarteira, carregarPrefMes } from '../../lib/planejamentoMes'
import { andamento, esperadoNoMes, type Andamento } from '../../lib/metaDoTime'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export interface FeitoNoMes { cliente: string; tipo: 'video' | 'arte' }

export default function MetaDoMesTime({ clientes, feitos, now }: {
  clientes: Client[]
  /** Entregas do time no mês corrente (a mesma conta da aba). */
  feitos: FeitoNoMes[]
  now: Date
}) {
  const [aberto, setAberto] = useState(false)
  const meta = useMemo(
    () => esperadoNoMes(clientes, carregarCarteira(), carregarPadroes(), carregarPrefMes(), now.getFullYear(), now.getMonth()),
    [clientes, now],
  )
  const feitoPor = useMemo(() => {
    const m = new Map<string, { videos: number; artes: number }>()
    for (const f of feitos) {
      const x = m.get(f.cliente) ?? { videos: 0, artes: 0 }
      if (f.tipo === 'video') x.videos++; else x.artes++
      m.set(f.cliente, x)
    }
    return m
  }, [feitos])
  const totalVideos = feitos.filter(f => f.tipo === 'video').length
  const totalArtes = feitos.length - totalVideos
  const v = andamento(meta.videos, totalVideos, now)
  const a = andamento(meta.artes, totalArtes, now)
  const mes = MESES[now.getMonth()]
  const fimDoMes = `${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}/${String(now.getMonth() + 1).padStart(2, '0')}`

  return (
    <Paper sx={{ p: { xs: 1.4, xl: 2 }, mb: 2, border: `1px solid ${DS.border}`, borderRadius: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.2, flexWrap: 'wrap' }}>
        <Typography sx={{ fontFamily: DS.fontDisplay, textTransform: 'uppercase', fontSize: { xs: '1.05rem', xl: '1.3rem' }, color: DS.t1 }}>
          Total esperado · {mes}
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: DS.t3 }}>
          soma da meta de {meta.porCliente.length} clientes mensais ativos · conta a entrega para a Revisão
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.2 }}>
        <Bloco rotulo="Vídeos" a={v} fimDoMes={fimDoMes} />
        <Bloco rotulo="Artes (Design)" a={a} fimDoMes={fimDoMes} />
      </Box>

      <Box {...clickable(() => setAberto(x => !x))} aria-expanded={aberto} sx={{ mt: 1.2, cursor: 'pointer', display: 'inline-flex' }}>
        <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: DS.accent }}>{aberto ? 'Fechar' : 'Ver por cliente'}</Typography>
      </Box>
      <Collapse in={aberto}>
        <Box sx={{ mt: 1, borderRadius: '10px', border: `1px solid ${DS.border}`, overflow: 'hidden' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', px: 1.4, py: 0.8, bgcolor: DS.surfaceAlt }}>
            {['Cliente', 'Vídeos', 'Artes'].map(h => <Typography key={h} sx={{ fontSize: '0.62rem', fontWeight: 800, color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: h === 'Cliente' ? 'left' : 'right' }}>{h}</Typography>)}
          </Box>
          {meta.porCliente.map(c => {
            const f = feitoPor.get(c.cliente) ?? { videos: 0, artes: 0 }
            const cel = (feito: number, esp: number) => (
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, textAlign: 'right', color: esp === 0 ? DS.t4 : feito >= esp ? DS.green : DS.t1 }}>
                {feito}<Box component="span" sx={{ color: DS.t3, fontWeight: 600 }}> / {esp}</Box>
              </Typography>
            )
            return (
              <Box key={c.cliente} sx={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', px: 1.4, py: 0.7, borderTop: `1px solid ${DS.border}` }}>
                <Typography noWrap sx={{ fontSize: '0.8rem', color: DS.t1 }}>{nomeDoCliente(c.cliente)}</Typography>
                {cel(f.videos, c.videos)}
                {cel(f.artes, c.artes)}
              </Box>
            )
          })}
        </Box>
      </Collapse>
    </Paper>
  )
}

function Bloco({ rotulo, a, fimDoMes }: { rotulo: string; a: Andamento; fimDoMes: string }) {
  const cor = a.faltam === 0 ? DS.green : DS.accent
  return (
    <Box sx={{ p: { xs: 1.2, xl: 1.6 }, borderRadius: '12px', bgcolor: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
      <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{rotulo}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.8, mt: 0.3 }}>
        <Typography sx={{ fontSize: { xs: '1.9rem', xl: '2.3rem' }, fontWeight: 900, color: DS.t1, lineHeight: 1 }}>{a.feito}</Typography>
        <Typography sx={{ fontSize: { xs: '1rem', xl: '1.15rem' }, fontWeight: 800, color: DS.t3 }}>/ {a.esperado} esperados</Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 900, color: cor }}>{a.pct}%</Typography>
      </Box>
      <Box sx={{ mt: 1, height: 8, borderRadius: 4, bgcolor: DS.field, overflow: 'hidden' }}>
        <Box sx={{ width: `${a.pct}%`, height: '100%', bgcolor: cor, transition: 'width 0.4s ease' }} />
      </Box>
      <Typography sx={{ fontSize: '0.74rem', color: DS.t2, mt: 0.8 }}>
        {a.esperado === 0 ? 'Sem meta definida para os clientes.'
          : a.faltam === 0 ? 'Meta do mês batida.'
          : <>Faltam <b style={{ color: DS.t1 }}>{a.faltam}</b>{a.porDia !== null ? <> · ≈ <b style={{ color: DS.t1 }}>{String(a.porDia).replace('.', ',')}</b> por dia útil até {fimDoMes}</> : ' · último dia do mês'}</>}
      </Typography>
    </Box>
  )
}
