import { useMemo } from 'react'
import {
  Box, Typography, LinearProgress, Tooltip, Chip,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import type { Client, ContentItem, ItemState, FinanceiroMes } from '../types'

interface Props {
  allClients: Client[]
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
}

interface ClientMetrics {
  client: Client
  mensalidade: number
  postsPublicados: number
  custoUnitario: number
  rejeicoes: number
  effortScore: number       // 0-100 (higher = more effort required from team)
  rentScore: number         // 0-100 (higher = more profitable)
  payStatus: 'pago' | 'pendente' | 'atrasado' | 'sem_dado'
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function loadFinanceiro(mk: string): FinanceiroMes {
  try {
    const saved = localStorage.getItem(`sm_financeiro2_${mk}`)
    if (saved) return JSON.parse(saved) as FinanceiroMes
    return { recorrencia: [], entradas: [], saidas: [], custosFixos: [] }
  } catch { return { recorrencia: [], entradas: [], saidas: [], custosFixos: [] } }
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })

export default function RentabilidadePanel({ allClients, items, states, now }: Props) {
  const mk = getMonthKey(now)
  const prevMk = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return getMonthKey(d)
  })()

  const metrics: ClientMetrics[] = useMemo(() => {
    const finData = loadFinanceiro(mk)
    const finPrev = loadFinanceiro(prevMk)

    const today = new Date(now); today.setHours(0, 0, 0, 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    return allClients.map(client => {
      const clientItems = items.filter(i => i.c === client.name)

      // Mensalidade — all recorrencia entries are mensalidades
      const recEntry = finData.recorrencia.find(r => r.clientName === client.name)
        ?? finPrev.recorrencia.find(r => r.clientName === client.name)
      const mensalidade = recEntry?.valor ?? 0
      const payStatus = recEntry?.status ?? 'sem_dado'

      // Posts publicados este mês
      const postsPublicados = clientItems.filter(i => {
        const dt = new Date(i.dt)
        const st = states[i.i]?.status ?? i.s
        return st === 7 && dt >= monthStart && dt <= today
      }).length

      // Rejeições (items que já foram status 6 — check history OR currently 6)
      const rejeicoes = clientItems.filter(i => {
        const st = states[i.i]?.status ?? i.s
        if (st === 6) return true
        const hist = states[i.i]?.history ?? []
        return hist.some(h => h.action?.includes('Reprovado'))
      }).length

      // Items atrasados
      const atrasados = clientItems.filter(i => {
        const st = states[i.i]?.status ?? i.s
        return st < 7 && new Date(i.dt) < today
      }).length

      // Effort score: 0=easy, 100=hard
      const totalItems = clientItems.length || 1
      const effortRaw = Math.min(100,
        (rejeicoes / totalItems) * 60 +
        (atrasados / totalItems) * 40
      )
      const effortScore = Math.round(effortRaw)

      // Custo unitário (só calcula se tem mensalidade e posts)
      const custoUnitario = mensalidade > 0 && postsPublicados > 0
        ? mensalidade / postsPublicados
        : 0

      // Rentabilidade score: alto mensalidade + baixo esforço = melhor
      const mensalidadeNorm = Math.min(1, mensalidade / 3000)   // 3000 = referência
      const effortNorm = 1 - (effortScore / 100)
      const rentScore = Math.round((mensalidadeNorm * 60 + effortNorm * 40) * 100)

      return {
        client,
        mensalidade,
        postsPublicados,
        custoUnitario,
        rejeicoes,
        effortScore,
        rentScore,
        payStatus: payStatus as ClientMetrics['payStatus'],
      }
    }).sort((a, b) => b.rentScore - a.rentScore)
  }, [allClients, items, states, now, mk, prevMk])

  const totalMRR = metrics.reduce((acc, m) => acc + m.mensalidade, 0)
  const avgEffort = Math.round(metrics.reduce((acc, m) => acc + m.effortScore, 0) / (metrics.length || 1))
  const bestClient = metrics[0]
  const worstEffort = [...metrics].sort((a, b) => b.effortScore - a.effortScore)[0]

  const PAY_COLOR: Record<string, string> = {
    pago: '#00C47A', pendente: '#FFD700', atrasado: '#FF4545', sem_dado: 'rgba(255,255,255,0.25)',
  }
  const PAY_LABEL: Record<string, string> = {
    pago: '✓ Pago', pendente: '⏳ Pendente', atrasado: '⚠️ Atrasado', sem_dado: '—',
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* KPI strip */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(4,1fr)' }, gap: 1.5 }}>
        {[
          { label: 'MRR Total', value: fmt(totalMRR), color: '#00C47A', icon: '💰' },
          { label: 'Esforço médio', value: `${avgEffort}/100`, color: avgEffort > 50 ? '#FF4545' : '#FFD700', icon: '⚡' },
          { label: '+ Rentável', value: bestClient?.client.name ?? '—', color: '#ff9039', icon: '🏆', small: true },
          { label: '+ Esforço', value: worstEffort?.client.name ?? '—', color: '#FF4545', icon: '🔥', small: true },
        ].map(({ label, value, color, icon, small }) => (
          <Box key={label} sx={{
            p: 1.8, borderRadius: 2,
            background: `linear-gradient(135deg, ${color}10, transparent)`,
            border: `1px solid ${color}22`,
            display: 'flex', flexDirection: 'column', gap: 0.4,
          }}>
            <Typography sx={{ fontSize: '0.56rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {icon} {label}
            </Typography>
            <Typography sx={{ fontSize: small ? '0.88rem' : '1.4rem', fontWeight: 900, color, lineHeight: 1.1, letterSpacing: '-0.02em' }} noWrap>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Header row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 80px 80px 80px 100px', gap: 0, px: 1.5, py: 0.6, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
        {['Cliente', 'Mensalidade', 'Entregues', 'Revisões', 'Esforço', 'R$/post', 'Status'].map(h => (
          <Typography key={h} sx={{ fontSize: '0.56rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {h}
          </Typography>
        ))}
      </Box>

      {/* Client rows */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
        {metrics.map((m, idx) => {
          const effortColor = m.effortScore > 60 ? '#FF4545' : m.effortScore > 35 ? '#FFD700' : '#00C47A'
          const rentColor = m.rentScore > 70 ? '#00C47A' : m.rentScore > 40 ? '#FFD700' : '#FF4545'
          const isTop = idx === 0
          const isBottom = idx === metrics.length - 1 && metrics.length > 1

          return (
            <Box
              key={m.client.name}
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 80px 80px 80px 80px 100px',
                gap: 0, px: 1.5, py: 1.4,
                borderRadius: 2,
                background: isTop
                  ? 'linear-gradient(135deg, rgba(0,196,122,0.06), rgba(255,144,57,0.04))'
                  : isBottom
                    ? 'linear-gradient(135deg, rgba(255,69,69,0.06), transparent)'
                    : 'rgba(255,255,255,0.02)',
                border: '1px solid',
                borderColor: isTop ? 'rgba(0,196,122,0.2)' : isBottom ? 'rgba(255,69,69,0.15)' : 'rgba(255,255,255,0.05)',
                transition: 'all 0.2s ease',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' },
                '@keyframes rowIn': { from: { opacity: 0, transform: 'translateX(-8px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
                animation: 'rowIn 0.3s cubic-bezier(0.16,1,0.3,1) both',
                animationDelay: `${idx * 35}ms`,
                alignItems: 'center',
              }}
            >
              {/* Client name */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, overflow: 'hidden' }}>
                {isTop && <EmojiEventsIcon sx={{ fontSize: 14, color: '#FFD700', flexShrink: 0 }} />}
                <Box>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', lineHeight: 1.2 }} noWrap>
                    {m.client.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                    <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: rentColor }}>
                      Score {m.rentScore}/100
                    </Typography>
                    {m.rentScore > 70
                      ? <TrendingUpIcon sx={{ fontSize: 10, color: rentColor }} />
                      : <TrendingDownIcon sx={{ fontSize: 10, color: rentColor }} />
                    }
                  </Box>
                  {/* Profitability bar */}
                  <LinearProgress
                    variant="determinate"
                    value={m.rentScore}
                    sx={{
                      mt: 0.4, height: 3, borderRadius: 2,
                      bgcolor: 'rgba(255,255,255,0.06)',
                      width: { xs: 80, md: 120 },
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 2,
                        background: `linear-gradient(90deg, ${rentColor}88, ${rentColor})`,
                      },
                    }}
                  />
                </Box>
              </Box>

              {/* Mensalidade */}
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: m.mensalidade > 0 ? '#fff' : 'rgba(255,255,255,0.25)', fontVariantNumeric: 'tabular-nums' }}>
                {m.mensalidade > 0 ? fmt(m.mensalidade) : '—'}
              </Typography>

              {/* Posts entregues */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: m.postsPublicados > 0 ? '#00C47A' : 'rgba(255,255,255,0.25)' }}>
                  {m.postsPublicados}
                </Typography>
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)' }}>/{m.client.postsPerMonth + m.client.reelsPerMonth}</Typography>
              </Box>

              {/* Revisões */}
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: m.rejeicoes > 2 ? '#FF4545' : m.rejeicoes > 0 ? '#FFD700' : '#00C47A' }}>
                {m.rejeicoes}x
              </Typography>

              {/* Esforço */}
              <Tooltip title={`Esforço: ${m.effortScore}/100 — baseado em revisões e atrasos`}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: effortColor }}>
                    {m.effortScore}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={m.effortScore}
                    sx={{
                      height: 3, borderRadius: 2, width: 50,
                      bgcolor: 'rgba(255,255,255,0.06)',
                      '& .MuiLinearProgress-bar': { borderRadius: 2, bgcolor: effortColor },
                    }}
                  />
                </Box>
              </Tooltip>

              {/* R$/post */}
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: m.custoUnitario > 0 ? (m.custoUnitario < 100 ? '#00C47A' : m.custoUnitario < 200 ? '#FFD700' : '#FF4545') : 'rgba(255,255,255,0.2)', fontVariantNumeric: 'tabular-nums' }}>
                {m.custoUnitario > 0 ? fmt(m.custoUnitario) : '—'}
              </Typography>

              {/* Status pagamento */}
              <Chip
                label={PAY_LABEL[m.payStatus]}
                size="small"
                sx={{
                  height: 20, fontSize: '0.56rem', fontWeight: 700,
                  bgcolor: `${PAY_COLOR[m.payStatus]}15`,
                  border: `1px solid ${PAY_COLOR[m.payStatus]}40`,
                  color: PAY_COLOR[m.payStatus],
                }}
              />
            </Box>
          )
        })}
      </Box>

      {/* Footer note */}
      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center', fontStyle: 'italic', mt: 1 }}>
        Score = mensalidade (60%) + ausência de revisões/atrasos (40%) · R$/post = mensalidade ÷ publicados no mês
      </Typography>
    </Box>
  )
}
