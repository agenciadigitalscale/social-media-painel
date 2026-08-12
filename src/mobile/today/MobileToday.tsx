import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import TodayRoundedIcon from '@mui/icons-material/TodayRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import CelebrationRoundedIcon from '@mui/icons-material/CelebrationRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRight'
import type { ContentItem, ItemState, Client } from '../../types'
import { DS } from '../../theme'
import { computeTodayBuckets, daysLate } from '../../lib/todaySignals'
import { haptic } from '../system/haptics'
import type { QuickKey } from '../kanban/filters'

/**
 * A tela que abre o app no celular.
 *
 * Até 2026-08-12 este arquivo era um stub que dizia, para o próprio time,
 * "Interface móvel de hoje não está disponível nesta compilação" — e ignorava
 * todas as props que recebia. Era a primeira coisa que qualquer pessoa via ao
 * abrir o painel no telefone.
 *
 * O que ela mostra é decidido em `lib/todaySignals.ts`, e a regra central é a
 * que devolve sentido ao número: **item de mês fechado que ninguém nunca tocou
 * não é atraso, é plano que não aconteceu.** Sem isso a tela abriria anunciando
 * 452 pendências — o calendário semeado inteiro — e ninguém olharia de novo.
 *
 * A ordem das seções é a da bola: quem está esperando por nós primeiro.
 */

interface MobileTodayProps {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  clientColors: Record<string, string>
  now: Date
  currentUser: string
  userInfo?: { name: string; role: string; emoji: string; color: string }
  onOpenProductions: (filter?: QuickKey, client?: string) => void
  onOpenClients: () => void
  onNavigateTab: (tab: number) => void
}

function saudacao(now: Date): string {
  const h = now.getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Linha de card. Alvo de toque grande — o dedo não acerta 24px. */
function Linha({ item, states, color, right }: {
  item: ContentItem
  states: Record<number, ItemState>
  color: string
  right?: string
}) {
  const titulo = states[item.i]?.title || item.n
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.2,
      px: 1.4, py: 1.2, borderRadius: '12px',
      bgcolor: 'rgba(148,163,184,0.05)',
      border: `1px solid ${DS.borderSoft}`,
    }}>
      <Box sx={{ width: 3, alignSelf: 'stretch', borderRadius: 2, bgcolor: color, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: DS.t1, lineHeight: 1.3 }} noWrap>
          {titulo}
        </Typography>
        <Typography sx={{ fontSize: '0.66rem', color: DS.t2, mt: 0.2 }} noWrap>
          {item.c} · {item.tp}
        </Typography>
      </Box>
      {right && (
        <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color, flexShrink: 0 }}>
          {right}
        </Typography>
      )}
    </Box>
  )
}

/** Seção tocável inteira: o cabeçalho leva ao Kanban já filtrado. */
function Secao({ titulo, subtitulo, icone, cor, total, onOpen, children }: {
  titulo: string
  subtitulo: string
  icone: React.ReactNode
  cor: string
  total: number
  onOpen: () => void
  children: React.ReactNode
}) {
  if (total === 0) return null
  return (
    <Box sx={{ mb: 2.4 }}>
      <Box
        role="button"
        tabIndex={0}
        onClick={() => { haptic('selection'); onOpen() }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); haptic('selection'); onOpen() } }}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.1, mb: 1,
          px: 0.4, py: 0.6, borderRadius: '10px', cursor: 'pointer',
          '&:active': { bgcolor: 'rgba(148,163,184,0.08)' },
        }}
      >
        <Box sx={{
          width: 30, height: 30, borderRadius: '9px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: `${cor}1f`, border: `1px solid ${cor}3d`, color: cor,
        }}>
          {icone}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.86rem', fontWeight: 800, color: DS.t1, lineHeight: 1.2 }}>
            {titulo} · {total}
          </Typography>
          <Typography sx={{ fontSize: '0.64rem', color: DS.t2 }} noWrap>{subtitulo}</Typography>
        </Box>
        <ChevronRightRoundedIcon sx={{ fontSize: 18, color: DS.t3, flexShrink: 0 }} />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7 }}>{children}</Box>
    </Box>
  )
}

/** Quantas linhas cabem antes de virar rolagem infinita num celular. */
const MAX_LINHAS = 4

export default function MobileToday({
  items, states, now, userInfo, onOpenProductions, onOpenClients,
}: MobileTodayProps) {
  const b = useMemo(() => computeTodayBuckets(items, states, now), [items, states, now])

  const nada = b.needsFix.length === 0 && b.late.length === 0
    && b.today.length === 0 && b.inReview.length === 0

  const restante = (n: number) => n > MAX_LINHAS
    ? <Typography sx={{ fontSize: '0.66rem', color: DS.t3, pl: 1.4, pt: 0.2 }}>
        e mais {n - MAX_LINHAS}…
      </Typography>
    : null

  return (
    <Box sx={{ p: 2, pb: 4 }}>
      <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: DS.t1, lineHeight: 1.2 }}>
        {saudacao(now)}{userInfo ? `, ${userInfo.name}` : ''} {userInfo?.emoji}
      </Typography>
      <Typography sx={{ fontSize: '0.7rem', color: DS.t2, mb: 2.4, textTransform: 'capitalize' }}>
        {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
      </Typography>

      {nada ? (
        <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
          <CelebrationRoundedIcon sx={{ fontSize: 44, color: DS.green, mb: 1.2 }} />
          <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: DS.t1 }}>
            Nada travado
          </Typography>
          <Typography sx={{ fontSize: '0.76rem', color: DS.t2, mt: 0.8, lineHeight: 1.6 }}>
            {b.withClient.length > 0
              ? `${b.withClient.length} ${b.withClient.length === 1 ? 'criativo está' : 'criativos estão'} com o cliente, esperando resposta.`
              : 'Nenhum conteúdo esperando por você agora.'}
          </Typography>
        </Box>
      ) : (
        <>
          <Secao
            titulo="Cliente pediu ajuste" subtitulo="a bola voltou para a gente"
            icone={<ReplayRoundedIcon sx={{ fontSize: 17 }} />} cor={DS.red}
            total={b.needsFix.length} onOpen={() => onOpenProductions('aprovacao')}
          >
            {b.needsFix.slice(0, MAX_LINHAS).map(i => (
              <Linha key={i.i} item={i} states={states} color={DS.red} right={`${daysLate(i, now)}d`} />
            ))}
            {restante(b.needsFix.length)}
          </Secao>

          <Secao
            titulo="Parados" subtitulo="começaram e passaram da data"
            icone={<ScheduleRoundedIcon sx={{ fontSize: 17 }} />} cor={DS.alert}
            total={b.late.length} onOpen={() => onOpenProductions('atrasados')}
          >
            {b.late.slice(0, MAX_LINHAS).map(i => (
              <Linha key={i.i} item={i} states={states} color={DS.alert} right={`${daysLate(i, now)}d`} />
            ))}
            {restante(b.late.length)}
          </Secao>

          <Secao
            titulo="Vence hoje" subtitulo="publicar ou avançar até o fim do dia"
            icone={<TodayRoundedIcon sx={{ fontSize: 17 }} />} cor={DS.amber}
            total={b.today.length} onOpen={() => onOpenProductions('hoje')}
          >
            {b.today.slice(0, MAX_LINHAS).map(i => (
              <Linha key={i.i} item={i} states={states} color={DS.amber} />
            ))}
            {restante(b.today.length)}
          </Secao>

          <Secao
            titulo="Em revisão interna" subtitulo="espera a equipe aprovar"
            icone={<VisibilityRoundedIcon sx={{ fontSize: 17 }} />} cor={DS.cyan}
            total={b.inReview.length} onOpen={() => onOpenProductions('aprovacao')}
          >
            {b.inReview.slice(0, MAX_LINHAS).map(i => (
              <Linha key={i.i} item={i} states={states} color={DS.cyan} />
            ))}
            {restante(b.inReview.length)}
          </Secao>
        </>
      )}

      <Secao
        titulo="Com o cliente" subtitulo="enviado, aguardando resposta dele"
        icone={<SendRoundedIcon sx={{ fontSize: 17 }} />} cor={DS.accent}
        total={b.withClient.length} onOpen={() => onOpenProductions('aprovacao')}
      >
        {b.withClient.slice(0, MAX_LINHAS).map(i => (
          <Linha key={i.i} item={i} states={states} color={DS.accent} />
        ))}
        {restante(b.withClient.length)}
      </Secao>

      <Box
        role="button"
        tabIndex={0}
        onClick={() => { haptic('selection'); onOpenClients() }}
        onKeyDown={e => { if (e.key === 'Enter') onOpenClients() }}
        sx={{
          mt: 1, px: 1.6, py: 1.4, borderRadius: '12px', cursor: 'pointer',
          border: `1px solid ${DS.borderSoft}`, bgcolor: 'rgba(148,163,184,0.04)',
          display: 'flex', alignItems: 'center', gap: 1,
        }}
      >
        <Typography sx={{ flex: 1, fontSize: '0.78rem', fontWeight: 700, color: DS.t2 }}>
          Ver por cliente
        </Typography>
        <ChevronRightRoundedIcon sx={{ fontSize: 18, color: DS.t3 }} />
      </Box>

      {b.neverStarted > 0 && (
        <Typography sx={{ fontSize: '0.62rem', color: DS.t3, mt: 2.4, lineHeight: 1.6, textAlign: 'center' }}>
          {b.neverStarted} itens do calendário de meses fechados nunca foram iniciados.
          Não entram na conta acima — plano que não aconteceu não é trabalho parado.
        </Typography>
      )}
    </Box>
  )
}
