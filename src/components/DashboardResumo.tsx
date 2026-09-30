/**
 * Dashboard "Resumo" — uma tela, um cartão por aba do painel.
 *
 * Nasceu do pedido do dono (2026-09-28): o Dashboard antigo tinha informação
 * demais e confundia. Aqui cada aba vira UM número grande, UM gráfico simples e
 * um "Abrir →". A visão completa de antes continua a um clique ("Visão
 * detalhada"). Os números saem de `lib/resumo.ts` — a mesma regra de atraso do
 * resto do painel, para nada divergir entre telas.
 */
import { useEffect, useMemo, useState } from 'react'
import { Box, Typography, Button } from '@mui/material'
import type { Client, ContentItem, ItemState } from '../types'
import { DS } from '../theme'
import { donoDoCard } from '../lib/access'
import { carregarAtribuicoes, carregarPaineis } from '../lib/paineis'
import { NAME_MAP, getDisplayName } from '../lib/users'
import { computeOnboardingSummary } from '../lib/onboarding'
import { computeResumo, summarizeBriefings, summarizeEntregas, type AreaStats, type BriefingsRemote, type RecordingLite } from '../lib/resumo'
import { useViewerEvents } from '../lib/viewerEvents'
import { computeClientScore, getBand } from './ClientRadar'
import { clickable } from '../shared/a11y'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  now: Date
  onTabChange: (tab: number) => void
  onDetalhado: () => void
  /**
   * Social Media (2026-09-28): sem Radar e sem o grupo Equipe — carga por pessoa
   * e filas de Editor/Design são visão de equipe, só de sócio. Sem "Visão
   * detalhada" também: ela compara clientes e mostra desempenho da equipe.
   */
  semVisaoEquipe?: boolean
}

// Índices das abas no `navItems` do App (posicionais).
const TAB = { producoes: 4, clientes: 6, gravacoes: 9, equipe: 12, radar: 21, entregas: 23, briefings: 30 }

const NEUTRO = '#C8CED8'

function loadRecordings(): RecordingLite[] {
  try { return JSON.parse(localStorage.getItem('sm_recordings') ?? '[]') } catch { return [] }
}

export default function DashboardResumo({ items, states, allClients, now, onTabChange, onDetalhado, semVisaoEquipe }: Props) {
  const r = useMemo(() => {
    let onboarding = { active: 0, late: 0, completedThisMonth: 0 }
    try { onboarding = computeOnboardingSummary(now) } catch { /* sem onboarding salvo */ }
    const atrib = carregarAtribuicoes()
    const paineis = carregarPaineis()
    return computeResumo({
      items, states, now, onboarding,
      donoDe: (i, st) => donoDoCard(i.i, st, atrib, paineis),
      clientNames: allClients.map(c => c.name),
      recordings: loadRecordings(),
    })
  }, [items, states, allClients, now])

  // Radar: o MESMO cálculo da aba (computeClientScore), sem regra paralela.
  const radar = useMemo(() => {
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const scores = allClients.map(c => computeClientScore(c, items, states, now, monthKey).total)
    const media = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    const out = { media, bom: 0, atencao: 0, risco: 0 }
    for (const sc of scores) {
      const band = getBand(sc)
      if (band === 'risk') out.risco++
      else if (band === 'attention') out.atencao++
      else out.bom++
    }
    return out
  }, [allClients, items, states, now])

  // Entregas: eventos da tela do cliente (mesma fonte da aba Entregas).
  const { events } = useViewerEvents()
  const entregas = useMemo(() => summarizeEntregas(events, now), [events, now])

  // Briefings: a mesma lista que a aba Briefings busca.
  const [briefingsRemote, setBriefingsRemote] = useState<BriefingsRemote | null>(null)
  const [briefingsErro, setBriefingsErro] = useState(false)
  useEffect(() => {
    let vivo = true
    fetch('/api/briefing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list' }) })
      .then(res => res.json() as Promise<{ ok: boolean; briefings?: BriefingsRemote }>)
      .then(d => { if (vivo) { if (d.ok && d.briefings) setBriefingsRemote(d.briefings); else setBriefingsErro(true) } })
      .catch(() => { if (vivo) setBriefingsErro(true) })
    return () => { vivo = false }
  }, [])
  const briefings = briefingsRemote ? summarizeBriefings(allClients.map(c => c.name), briefingsRemote) : null

  const publishedPct = r.monthTotal > 0 ? Math.round((r.kpis.publishedMonth / r.monthTotal) * 100) : 0
  const weekMax = Math.max(1, ...r.week.map(d => d.n))
  const teamMax = Math.max(1, ...r.team.map(t => t.n))
  const teamTotal = r.team.reduce((a, t) => a + t.n, 0)

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Cabeçalho */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.18em', color: DS.t3, mb: 0.6 }}>
            RESUMO DO PAINEL
          </Typography>
          <Typography component="h1" sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.05, color: DS.t1 }}>
            Como está a operação
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: DS.t2, mt: 0.6, textTransform: 'capitalize' }}>
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </Typography>
        </Box>
        {!semVisaoEquipe && (
        <Button onClick={onDetalhado} size="small" sx={{
          fontSize: '0.72rem', fontWeight: 600, textTransform: 'none', borderRadius: '8px', px: 1.6, height: 34,
          border: `1px solid ${DS.border}`, color: DS.t2,
          '&:hover': { borderColor: DS.borderHov, color: DS.accent, bgcolor: `${DS.accent}10` },
        }}>
          Visão detalhada
        </Button>
        )}
      </Box>

      {/* Os quatro números que mandam no dia */}
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, mb: 2.5 }}>
        <Kpi label="Atrasados" value={r.kpis.late} tone={r.kpis.late > 0 ? DS.red : DS.t1} onClick={() => onTabChange(TAB.producoes)} />
        <Kpi label="Vencem hoje" value={r.kpis.dueToday} tone={DS.t1} onClick={() => onTabChange(TAB.producoes)} />
        <Kpi label="Com o cliente" value={r.kpis.withClient} tone={DS.t1} onClick={() => onTabChange(TAB.producoes)} />
        <Kpi label="Publicados no mês" value={r.kpis.publishedMonth} tone={DS.t1} onClick={() => onTabChange(TAB.producoes)} />
      </Box>

      {/* Um cartão por aba ATIVA, nos mesmos grupos da barra lateral. */}
      <Grupo titulo="Operação">
        <Resumo titulo="Produções" onOpen={() => onTabChange(TAB.producoes)}
          numero={r.monthTotal} legenda={`conteúdos no mês · ${publishedPct}% publicados`}>
          <BarraEmpilhada partes={r.pipeline.map(p => ({ cor: p.color, n: p.n }))} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: 2, rowGap: 0.6, mt: 1.6 }}>
            {r.pipeline.filter(p => p.n > 0).map(p => (
              <Legenda key={p.status} cor={p.color} rotulo={p.label} n={p.n} />
            ))}
          </Box>
        </Resumo>

        <Resumo titulo="Semana" onOpen={() => onTabChange(TAB.producoes)}
          numero={r.weekTotal} legenda="conteúdos nesta semana">
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 84 }}>
            {r.week.map(d => (
              <Box key={d.label} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.6, height: '100%', justifyContent: 'flex-end' }}>
                <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: d.isToday ? DS.accent : DS.t3, lineHeight: 1 }}>{d.n || ''}</Typography>
                <Box sx={{
                  width: '100%', maxWidth: 28, borderRadius: '6px 6px 3px 3px',
                  height: `${Math.max(4, (d.n / weekMax) * 56)}px`,
                  bgcolor: d.isToday ? DS.accent : `${NEUTRO}33`,
                }} />
                <Typography sx={{ fontSize: '0.64rem', fontWeight: d.isToday ? 800 : 500, color: d.isToday ? DS.accent : DS.t3, lineHeight: 1 }}>{d.label}</Typography>
              </Box>
            ))}
          </Box>
        </Resumo>

        <Resumo titulo="Gravações" onOpen={() => onTabChange(TAB.gravacoes)}
          numero={r.recordings.upcoming} legenda={`agendadas · ${r.recordings.editing} em edição`}>
          {r.recordings.next.length === 0 ? (
            <Vazio texto="Nenhuma gravação agendada." />
          ) : r.recordings.next.map((g, k) => (
            <Box key={k} sx={{ display: 'flex', alignItems: 'baseline', gap: 1.2, py: 0.7, borderTop: k ? `1px solid ${DS.border}` : 'none' }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: DS.t1, minWidth: 44, fontVariantNumeric: 'tabular-nums' }}>
                {g.date.slice(8, 10)}/{g.date.slice(5, 7)}
              </Typography>
              <Typography noWrap sx={{ fontSize: '0.78rem', color: DS.t1 }}>
                {g.client}{g.title ? <Box component="span" sx={{ color: DS.t3 }}> · {g.title}</Box> : null}
              </Typography>
            </Box>
          ))}
        </Resumo>
      </Grupo>

      <Grupo titulo="Clientes">
        <Resumo titulo="Clientes" onOpen={() => onTabChange(TAB.clientes)}
          numero={r.clients.total} legenda="clientes ativos">
          <BarraEmpilhada partes={[
            { cor: DS.green, n: r.clients.saudavel },
            { cor: DS.amber, n: r.clients.atencao },
            { cor: DS.red, n: r.clients.critico },
          ]} />
          <Box sx={{ display: 'flex', gap: 2.5, mt: 1.6, flexWrap: 'wrap' }}>
            <Legenda cor={DS.green} rotulo="Em dia" n={r.clients.saudavel} />
            <Legenda cor={DS.amber} rotulo="Atenção" n={r.clients.atencao} />
            <Legenda cor={DS.red} rotulo="Críticos" n={r.clients.critico} />
          </Box>
        </Resumo>

        {!semVisaoEquipe && (
        <Resumo titulo="Radar" onOpen={() => onTabChange(TAB.radar)}
          numero={radar.media} legenda="saúde média dos clientes">
          <BarraEmpilhada partes={[
            { cor: DS.green, n: radar.bom },
            { cor: DS.amber, n: radar.atencao },
            { cor: DS.red, n: radar.risco },
          ]} />
          <Box sx={{ display: 'flex', gap: 2.5, mt: 1.6, flexWrap: 'wrap' }}>
            <Legenda cor={DS.green} rotulo="Bom" n={radar.bom} />
            <Legenda cor={DS.amber} rotulo="Atenção" n={radar.atencao} />
            <Legenda cor={DS.red} rotulo="Em risco" n={radar.risco} />
          </Box>
        </Resumo>
        )}

        <Resumo titulo="Briefings" onOpen={() => onTabChange(TAB.briefings)}
          numero={briefings ? briefings.preenchido : 0}
          legenda={briefings ? `de ${briefings.total} preenchidos` : 'carregando…'}>
          {briefings ? (
            <>
              <BarraEmpilhada partes={[
                { cor: DS.green, n: briefings.preenchido },
                { cor: DS.amber, n: briefings.aguardando },
                { cor: `${NEUTRO}55`, n: briefings.naoIniciado },
              ]} />
              <Box sx={{ display: 'flex', gap: 2.5, mt: 1.6, flexWrap: 'wrap' }}>
                <Legenda cor={DS.green} rotulo="Preenchidos" n={briefings.preenchido} />
                <Legenda cor={DS.amber} rotulo="Aguardando" n={briefings.aguardando} />
                <Legenda cor={`${NEUTRO}88`} rotulo="Não iniciados" n={briefings.naoIniciado} />
              </Box>
            </>
          ) : <Vazio texto={briefingsErro ? 'Não foi possível carregar.' : 'Carregando…'} />}
        </Resumo>

        <Resumo titulo="Entregas" onOpen={() => onTabChange(TAB.entregas)}
          numero={entregas.opened} legenda="aberturas pelo cliente · 7 dias">
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            <MiniNumero rotulo="Criativos que rodaram" n={entregas.played} cor={entregas.played > 0 ? DS.green : DS.t1} />
            <MiniNumero rotulo="Com falha" n={entregas.failedItems} cor={entregas.failedItems > 0 ? DS.red : DS.t1} />
          </Box>
        </Resumo>
      </Grupo>

      {!semVisaoEquipe && (
      <Grupo titulo="Equipe">
        <Resumo titulo="Equipe" onOpen={() => onTabChange(TAB.equipe)}
          numero={teamTotal} legenda="tarefas abertas com responsável">
          {r.team.length === 0 ? (
            <Vazio texto="Nenhuma tarefa atribuída." />
          ) : r.team.slice(0, 5).map(t => (
            <Box key={t.user} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, py: 0.45 }}>
              <Typography noWrap sx={{ fontSize: '0.74rem', color: DS.t2, width: 110, flexShrink: 0 }}>
                {NAME_MAP[t.user]?.fullName ?? getDisplayName(t.user)}
              </Typography>
              <Box sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: `${NEUTRO}14`, overflow: 'hidden' }}>
                <Box sx={{ width: `${(t.n / teamMax) * 100}%`, height: '100%', borderRadius: 4, bgcolor: DS.t3 }} />
              </Box>
              <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: DS.t1, minWidth: 22, textAlign: 'right' }}>{t.n}</Typography>
            </Box>
          ))}
        </Resumo>

        <Resumo titulo="Vídeo" onOpen={() => onTabChange(TAB.producoes)}
          numero={r.areas.video.open} legenda="vídeos em aberto">
          <AreaDetalhe a={r.areas.video} />
        </Resumo>

        <Resumo titulo="Design" onOpen={() => onTabChange(TAB.producoes)}
          numero={r.areas.design.open} legenda="artes em aberto">
          <AreaDetalhe a={r.areas.design} />
        </Resumo>
      </Grupo>
      )}
    </Box>
  )
}

// ── Peças ────────────────────────────────────────────────────────────────────

const CARD_SX = {
  bgcolor: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '16px',
  transition: 'border-color 0.18s ease',
  '&:hover': { borderColor: DS.borderHov },
} as const

function Kpi({ label, value, tone, onClick }: { label: string; value: number; tone: string; onClick: () => void }) {
  return (
    <Box {...clickable(onClick)} sx={{ ...CARD_SX, p: { xs: 1.8, md: 2.2 }, cursor: 'pointer', position: 'relative', overflow: 'hidden',
      '&::after': { content: '""', position: 'absolute', left: 18, bottom: 0, width: 32, height: 2, background: DS.border, opacity: 1 } }}>
      <Typography sx={{ fontSize: '0.74rem', color: DS.t2, mb: 1 }}>{label}</Typography>
      <Typography sx={{ fontSize: { xs: '1.7rem', md: '2rem' }, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: tone, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  )
}

function Resumo({ titulo, numero, legenda, onOpen, children }: {
  titulo: string; numero: number; legenda: string; onOpen: () => void; children: React.ReactNode
}) {
  return (
    <Box {...clickable(onOpen)} aria-label={`Abrir ${titulo}`} sx={{ ...CARD_SX, p: { xs: 2, md: 2.5 }, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.4 }}>
        <Typography sx={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: DS.t2 }}>{titulo}</Typography>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: DS.t2 }}>Abrir →</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2 }}>
        <Typography sx={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1, color: DS.t1, fontVariantNumeric: 'tabular-nums' }}>{numero}</Typography>
        <Typography sx={{ fontSize: '0.78rem', color: DS.t3 }}>{legenda}</Typography>
      </Box>
      <Box sx={{ mt: 'auto' }}>{children}</Box>
    </Box>
  )
}

function BarraEmpilhada({ partes }: { partes: { cor: string; n: number }[] }) {
  const total = partes.reduce((a, p) => a + p.n, 0)
  return (
    <Box sx={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', bgcolor: `${NEUTRO}14`, gap: '2px' }}>
      {total > 0 && partes.filter(p => p.n > 0).map((p, k) => (
        <Box key={k} sx={{ width: `${(p.n / total) * 100}%`, bgcolor: p.cor }} />
      ))}
    </Box>
  )
}

function Legenda({ cor, rotulo, n }: { cor: string; rotulo: string; n: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0 }}>
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: cor, flexShrink: 0 }} />
      <Typography noWrap sx={{ fontSize: '0.72rem', color: DS.t2, flex: 1 }}>{rotulo}</Typography>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: DS.t1 }}>{n}</Typography>
    </Box>
  )
}

function MiniNumero({ rotulo, n, cor }: { rotulo: string; n: number; cor: string }) {
  return (
    <Box sx={{ p: 1.4, borderRadius: '10px', bgcolor: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
      <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1, color: cor }}>{n}</Typography>
      <Typography sx={{ fontSize: '0.66rem', color: DS.t3, mt: 0.6 }}>{rotulo}</Typography>
    </Box>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: DS.t3, mb: 1.2 }}>
        {titulo}
      </Typography>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' } }}>
        {children}
      </Box>
    </Box>
  )
}

function AreaDetalhe({ a }: { a: AreaStats }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
      <MiniNumero rotulo="Atrasados" n={a.late} cor={a.late > 0 ? DS.red : DS.t1} />
      <MiniNumero rotulo="Em revisão" n={a.review} cor={DS.t1} />
      <MiniNumero rotulo="Prontos" n={a.ready} cor={a.ready > 0 ? DS.green : DS.t1} />
    </Box>
  )
}

function Vazio({ texto }: { texto: string }) {
  return <Typography sx={{ fontSize: '0.76rem', color: DS.t3 }}>{texto}</Typography>
}
