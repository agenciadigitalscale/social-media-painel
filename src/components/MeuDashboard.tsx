/**
 * Dashboard INDIVIDUAL e privado (2026-09-28) — Editor, Designer e Copy.
 *
 * Só métricas da própria pessoa; nunca comparação com colegas (regra do dono).
 * Números em `lib/meuDashboard.ts`, com testes.
 */
import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import type { ContentItem, ItemState, Roteiro } from '../types'
import { DS } from '../theme'
import { NAME_MAP } from '../lib/users'
import { cargoDe } from '../lib/access'
import { carregarAtribuicoes, carregarPaineis } from '../lib/paineis'
import { computeCopyDashboard, computeMeuDashboard } from '../lib/meuDashboard'

interface Props {
  user: string
  items: ContentItem[]
  states: Record<number, ItemState>
  roteiros: Record<string, Roteiro[]>
  now: Date
  onAbrirEsteira: () => void
}

export default function MeuDashboard({ user, items, states, roteiros, now, onAbrirEsteira }: Props) {
  const nome = NAME_MAP[user]?.fullName.split(' ')[0] ?? user
  const copy = cargoDe(user) === 'copy'

  const prod = useMemo(() => copy ? null : computeMeuDashboard({
    user, items, states, now, atrib: carregarAtribuicoes(), paineis: carregarPaineis(),
  }), [copy, user, items, states, now])
  const cp = useMemo(() => copy ? computeCopyDashboard({ roteiros, items, states, now }) : null, [copy, roteiros, items, states, now])

  const mes = now.toLocaleDateString('pt-BR', { month: 'long' })

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.18em', color: DS.accent, mb: 0.6 }}>MEU DASHBOARD</Typography>
          <Typography component="h1" sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.05, color: DS.t1 }}>
            {prod
              ? `${nome}, você concluiu ${prod.concluidosMes} ${prod.concluidosMes === 1 ? 'conteúdo' : 'conteúdos'} em ${mes}.`
              : `${nome}, ${cp!.roteirosMesTotal} ${cp!.roteirosMesTotal === 1 ? 'roteiro' : 'roteiros'} em ${mes}.`}
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: DS.t2, mt: 0.6 }}>Só os seus números — ninguém mais vê este painel.</Typography>
        </Box>
        <Box
          role="button" tabIndex={0}
          onClick={onAbrirEsteira}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrirEsteira() } }}
          sx={{ px: 1.8, py: 0.9, borderRadius: '8px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700, color: DS.onAccent, background: DS.accent, '&:hover': { filter: 'brightness(1.06)' } }}
        >
          Abrir minha esteira →
        </Box>
      </Box>

      {prod && (
        <>
          <Grade>
            <Kpi rotulo="Recebidos" valor={prod.recebidos} nota={`${prod.recebidosMes} com data em ${mes}`} />
            <Kpi rotulo="Concluídos" valor={prod.concluidos} nota={`${prod.concluidosMes} em ${mes}`} cor={prod.concluidosMes > 0 ? DS.green : undefined} />
            <Kpi rotulo="Em andamento" valor={prod.emAndamento} />
            <Kpi rotulo="Em ajuste" valor={prod.emAjuste} cor={prod.emAjuste > 0 ? DS.amber : undefined} />
            <Kpi rotulo="Atrasados" valor={prod.atrasados} cor={prod.atrasados > 0 ? DS.red : undefined} />
            <Kpi rotulo="Entregues no prazo" valor={prod.noPrazoPct === null ? '—' : `${prod.noPrazoPct}%`} nota={`entregas de ${mes}`} />
            <Kpi rotulo="Tempo médio de produção" valor={prod.tempoMedioDias === null ? '—' : `${prod.tempoMedioDias} d`} nota="do início à entrega" />
          </Grade>

          <Cartao titulo="Sua evolução" nota="entregas por mês">
            {(() => {
              const max = Math.max(1, ...prod.evolucao.map(m => m.n))
              return (
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 120 }}>
                  {prod.evolucao.map((m, k) => {
                    const atual = k === prod.evolucao.length - 1
                    return (
                      <Box key={m.rotulo + k} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.6, height: '100%', justifyContent: 'flex-end' }}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: atual ? DS.accent : DS.t2, lineHeight: 1 }}>{m.n}</Typography>
                        <Box sx={{ width: '100%', maxWidth: 40, borderRadius: '6px 6px 3px 3px', height: `${Math.max(4, (m.n / max) * 84)}px`, bgcolor: atual ? DS.accent : 'rgba(200,206,216,0.2)' }} />
                        <Typography sx={{ fontSize: '0.68rem', color: atual ? DS.accent : DS.t3, fontWeight: atual ? 800 : 500, lineHeight: 1 }}>{m.rotulo}</Typography>
                      </Box>
                    )
                  })}
                </Box>
              )
            })()}
          </Cartao>
        </>
      )}

      {cp && (
        <>
          <Grade>
            <Kpi rotulo="Roteiros no mês" valor={cp.roteirosMesTotal} />
            <Kpi rotulo="Prontos" valor={cp.roteirosMes.pronto} cor={cp.roteirosMes.pronto > 0 ? DS.green : undefined} />
            <Kpi rotulo="Escrevendo" valor={cp.roteirosMes.escrevendo} />
            <Kpi rotulo="Em revisão" valor={cp.roteirosMes.revisao} />
            <Kpi rotulo="Ideias" valor={cp.roteirosMes.ideia} />
            <Kpi rotulo="Legendas feitas" valor={cp.legendasFeitasMes} nota={`conteúdos de ${mes}`} cor={cp.legendasFeitasMes > 0 ? DS.green : undefined} />
            <Kpi rotulo="Legendas pendentes" valor={cp.legendasPendentesMes} cor={cp.legendasPendentesMes > 0 ? DS.amber : undefined} />
          </Grade>
        </>
      )}
    </Box>
  )
}

const CARD_SX = { bgcolor: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '16px' } as const

function Grade({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, mb: 2.5 }}>{children}</Box>
}

function Kpi({ rotulo, valor, nota, cor }: { rotulo: string; valor: number | string; nota?: string; cor?: string }) {
  return (
    <Box sx={{ ...CARD_SX, p: { xs: 1.8, md: 2.2 } }}>
      <Typography sx={{ fontSize: '0.74rem', color: DS.t2, mb: 1 }}>{rotulo}</Typography>
      <Typography sx={{ fontSize: { xs: '1.6rem', md: '1.9rem' }, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: cor ?? DS.t1, fontVariantNumeric: 'tabular-nums' }}>{valor}</Typography>
      {nota && <Typography sx={{ fontSize: '0.68rem', color: DS.t3, mt: 0.8 }}>{nota}</Typography>}
    </Box>
  )
}

function Cartao({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ ...CARD_SX, p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2 }}>
        <Typography sx={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: DS.t2 }}>{titulo}</Typography>
        {nota && <Typography sx={{ fontSize: '0.7rem', color: DS.t3 }}>{nota}</Typography>}
      </Box>
      {children}
    </Box>
  )
}
