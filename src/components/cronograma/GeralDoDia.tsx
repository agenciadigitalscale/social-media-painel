/**
 * Geral do dia (aba Cronograma, 2026-10-14): tudo o que vai ao ar num dia, de
 * todos os clientes, por horário — e se cada post está garantido (publicado,
 * programado), pronto esperando programar, ainda em produção ou, num dia que
 * já passou, se não saiu. Lê os mesmos cards do Calendário (lib/cronograma).
 */
import { useMemo, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import type { ContentItem, ItemState } from '../../types'
import { STATUS_CONFIG } from '../../types'
import { DS } from '../../theme'
import { geralDoDia, type SituacaoDoDia } from '../../lib/cronograma'
import { corDoConteudo } from '../../lib/padraoEditorial'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const SITUACAO: Record<SituacaoDoDia, { rotulo: string; cor: string }> = {
  publicado:  { rotulo: 'Publicado',  cor: DS.green },
  programado: { rotulo: 'Programado', cor: DS.green },
  pronto:     { rotulo: 'Falta programar', cor: DS.amber },
  producao:   { rotulo: 'Em produção', cor: DS.t2 },
  naoSaiu:    { rotulo: 'Não saiu', cor: DS.red },
}

const mesmoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export default function GeralDoDia({ items, states, now }: {
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
}) {
  const [dia, setDia] = useState(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  const { linhas, resumo } = useMemo(() => geralDoDia({ items, states, dia, hoje: now }), [items, states, dia, now])

  const andar = (d: number) => setDia(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + d))
  const ehHoje = mesmoDia(dia, now)
  const rotuloDia = `${DIAS[dia.getDay()]}, ${dia.getDate()} de ${MESES[dia.getMonth()]}`

  const indicadores: { rotulo: string; n: number; cor: string }[] = [
    { rotulo: 'Publicados', n: resumo.publicados, cor: DS.green },
    { rotulo: 'Programados', n: resumo.programados, cor: DS.green },
    { rotulo: 'Falta programar', n: resumo.prontos, cor: DS.amber },
    { rotulo: 'Em produção', n: resumo.emProducao, cor: DS.t2 },
    ...(resumo.naoSairam ? [{ rotulo: 'Não saíram', n: resumo.naoSairam, cor: DS.red }] : []),
  ]

  const navBtn = { minWidth: 40, height: 40, color: DS.t1, border: `1px solid ${DS.border}` }

  return (
    <Box>
      {/* Dia */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap', mb: 2 }}>
        <Button size="small" onClick={() => andar(-1)} aria-label="Dia anterior" sx={navBtn}>←</Button>
        <Typography sx={{ minWidth: { xs: 210, md: 260, xl: 300 }, textAlign: 'center', fontFamily: DS.fontDisplay, textTransform: 'uppercase', color: DS.t1, fontSize: { xs: '1.15rem', md: '1.35rem', xl: '1.6rem' } }}>
          {rotuloDia}
        </Typography>
        <Button size="small" onClick={() => andar(1)} aria-label="Próximo dia" sx={navBtn}>→</Button>
        {!ehHoje && (
          <Button size="small" onClick={() => setDia(new Date(now.getFullYear(), now.getMonth(), now.getDate()))}
            sx={{ height: 40, px: 1.6, fontWeight: 700, color: DS.accent, border: `1px solid ${DS.border}` }}>
            Hoje
          </Button>
        )}
      </Box>

      {/* Resumo */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' }, gap: 1, mb: 2 }}>
        <Box sx={{ p: { xs: 1.4, xl: 2 }, borderRadius: '12px', bgcolor: DS.surface, border: `1px solid ${DS.border}` }}>
          <Typography sx={{ fontSize: { xs: '0.62rem', xl: '0.72rem' }, fontWeight: 700, color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Vão ao ar</Typography>
          <Typography sx={{ fontSize: { xs: '1.7rem', xl: '2.2rem' }, fontWeight: 900, color: DS.t1, lineHeight: 1.1 }}>{resumo.total}</Typography>
          <Typography sx={{ fontSize: { xs: '0.68rem', xl: '0.78rem' }, color: DS.t2 }}>
            {resumo.clientes} cliente{resumo.clientes === 1 ? '' : 's'} · {resumo.reels} Reel · {resumo.design} Design{resumo.feed ? ` · ${resumo.feed} Feed` : ''}{resumo.outros ? ` · ${resumo.outros} outro${resumo.outros === 1 ? '' : 's'}` : ''}
          </Typography>
        </Box>
        {indicadores.map(k => (
          <Box key={k.rotulo} sx={{ p: { xs: 1.4, xl: 2 }, borderRadius: '12px', bgcolor: DS.surface, border: `1px solid ${k.n && k.cor === DS.red ? `${DS.red}66` : DS.border}` }}>
            <Typography sx={{ fontSize: { xs: '0.62rem', xl: '0.72rem' }, fontWeight: 700, color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k.rotulo}</Typography>
            <Typography sx={{ fontSize: { xs: '1.7rem', xl: '2.2rem' }, fontWeight: 900, color: k.n ? k.cor : DS.t4, lineHeight: 1.1 }}>{k.n}</Typography>
          </Box>
        ))}
      </Box>

      {/* Lista do dia */}
      {linhas.length === 0 ? (
        <Box sx={{ py: 8, textAlign: 'center', borderRadius: '14px', border: `1px dashed ${DS.border}` }}>
          <Typography sx={{ color: DS.t2, fontSize: { xs: '0.85rem', xl: '1rem' } }}>Nada programado para este dia.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
          {linhas.map(l => {
            const sit = SITUACAO[l.situacao]
            // Publicado/Programado já dizem tudo; nos outros, a etapa do card ajuda a cobrar.
            const etapa = l.situacao === 'publicado' || l.situacao === 'programado' ? null : STATUS_CONFIG[l.status]?.shortLabel
            return (
              <Box key={l.id} sx={{
                display: 'grid', alignItems: 'center', gap: { xs: 0.6, md: 1.5 },
                gridTemplateColumns: { xs: '56px 1fr', md: '64px minmax(140px, 220px) 86px 1fr auto', xl: '76px minmax(180px, 280px) 100px 1fr auto' },
                px: { xs: 1.2, xl: 1.8 }, py: { xs: 1, xl: 1.3 }, borderRadius: '12px',
                bgcolor: DS.surface, border: `1px solid ${l.situacao === 'naoSaiu' ? `${DS.red}55` : DS.border}`,
              }}>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: '0.95rem', xl: '1.15rem' }, color: l.hora ? DS.t1 : DS.t4, gridRow: { xs: 'span 3', md: 'auto' } }}>
                  {l.hora ?? '—'}
                </Typography>
                <Typography noWrap sx={{ fontWeight: 800, fontSize: { xs: '0.82rem', xl: '0.95rem' }, color: DS.t1 }}>{l.cliente}</Typography>
                <Box sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center', px: 1, py: 0.3, borderRadius: '7px', bgcolor: corDoConteudo(l.tp), color: '#0B0A09', fontSize: { md: '0.7rem', xl: '0.8rem' }, fontWeight: 800 }}>
                  {l.tipo}
                </Box>
                <Typography noWrap sx={{ fontSize: { xs: '0.78rem', xl: '0.92rem' }, color: DS.t2, gridColumn: { xs: '2', md: 'auto' } }}>
                  <Box component="span" sx={{ display: { md: 'none' }, color: corDoConteudo(l.tp), fontWeight: 800, mr: 0.8 }}>{l.tipo}</Box>
                  {l.titulo}
                </Typography>
                <Box sx={{ gridColumn: { xs: '2', md: 'auto' }, display: 'flex', alignItems: 'center', gap: 0.7, justifySelf: { md: 'end' } }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: sit.cor, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: { xs: '0.7rem', xl: '0.8rem' }, fontWeight: 700, color: sit.cor, whiteSpace: 'nowrap' }}>
                    {sit.rotulo}{etapa ? ` · ${etapa}` : ''}
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
      )}
      <Typography sx={{ mt: 1.2, fontSize: '0.72rem', color: DS.t3 }}>
        Mesmas datas do Calendário de postagem: o horário programado manda quando o post está em Programado.
      </Typography>
    </Box>
  )
}
