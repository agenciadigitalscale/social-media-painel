import { useMemo } from 'react'
import {
  Box,
  Typography,
  LinearProgress,
  Chip,
  Tooltip,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import type { ContentItem, ItemState, Client, FinanceiroMes } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClientRadarProps {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  now: Date
}

interface ScoreComponents {
  delivery: number    // 0–100
  approval: number    // 0–100
  revision: number    // 0–100
  financial: number   // 0–100
}

interface ClientScore {
  client: Client
  total: number
  components: ScoreComponents
  band: ScoreBand
  alerts: AlertItem[]
  trend: 'up' | 'down' | 'flat'
  overdueCount: number
  rejectionCount: number
  hasPendingPayment: boolean
  approvalSlowMs: number | null
}

interface AlertItem {
  label: string
  severity: 'error' | 'warning' | 'info'
}

type ScoreBand = 'excellent' | 'good' | 'attention' | 'risk'

// ── Constants ─────────────────────────────────────────────────────────────────

const BAND_CONFIG: Record<ScoreBand, { label: string; color: string; glow: string; bg: string }> = {
  excellent: { label: '🟢 Excelente', color: '#00C47A', glow: 'rgba(0,196,122,0.25)',  bg: 'rgba(0,196,122,0.08)'  },
  good:      { label: '🟡 Bom',       color: '#FFD700', glow: 'rgba(255,215,0,0.25)',   bg: 'rgba(255,215,0,0.07)'  },
  attention: { label: '🟠 Atenção',   color: '#FF9A3D', glow: 'rgba(255,154,61,0.25)',  bg: 'rgba(255,154,61,0.07)' },
  risk:      { label: '🔴 Risco',     color: '#FF4545', glow: 'rgba(255,69,69,0.3)',    bg: 'rgba(255,69,69,0.08)'  },
}

const WEIGHTS = { delivery: 0.35, approval: 0.25, revision: 0.25, financial: 0.15 } as const

const MS_PER_DAY = 86_400_000

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBand(score: number): ScoreBand {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'attention'
  return 'risk'
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v))
}

function approvalSpeedToScore(avgMs: number | null): number {
  if (avgMs === null) return 70  // no data → neutral
  const avgDays = avgMs / MS_PER_DAY
  if (avgDays <= 1) return 100
  if (avgDays >= 7) return 0
  return clamp(100 - ((avgDays - 1) / 6) * 100)
}

function readFinanceiro(monthKey: string): FinanceiroMes | null {
  try {
    const raw = localStorage.getItem(`sm_financeiro2_${monthKey}`)
    if (!raw) return null
    return JSON.parse(raw) as FinanceiroMes
  } catch {
    return null
  }
}

function getMonthKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

// ── Score computation ──────────────────────────────────────────────────────────

function computeClientScore(
  client: Client,
  items: ContentItem[],
  states: Record<number, ItemState>,
  now: Date,
  currentMonthKey: string,
): ClientScore & { prevDelivery: number } {
  const sixtyDaysAgo = new Date(now.getTime() - 60 * MS_PER_DAY)

  // Items for this client in the last 60 days
  const recent = items.filter(
    (it) => it.c === client.name && new Date(it.dt) >= sixtyDaysAgo,
  )

  // Entrega: só conta itens cuja data já venceu — itens futuros não penalizam
  const dueItems = recent.filter((it) => new Date(it.dt) <= now)
  const published = dueItems.filter((it) => (states[it.i]?.status ?? it.s) === 7).length
  // Se não há itens vencidos ainda (início do mês), score neutro (70)
  const deliveryRate = dueItems.length > 0 ? published / dueItems.length : 0.7
  const delivery = clamp(deliveryRate * 100)

  // Approval speed — items that were sent to client AND approved by client
  const approvalTimes: number[] = []
  recent.forEach((it) => {
    const st = states[it.i]
    if (st?.sentToClientAt && st?.approvedByClientAt && st.approvedByClientAt > st.sentToClientAt) {
      approvalTimes.push(st.approvedByClientAt - st.sentToClientAt)
    }
  })
  const avgApprovalMs = approvalTimes.length > 0
    ? approvalTimes.reduce((a, b) => a + b, 0) / approvalTimes.length
    : null
  const approval = approvalSpeedToScore(avgApprovalMs)

  // Revision score — items with status 6 (reprovado)
  const rejected = recent.filter((it) => (states[it.i]?.status ?? it.s) === 6)
  const revision = recent.length > 0 ? clamp((1 - rejected.length / recent.length) * 100) : 100

  // Financial score — read current month data
  const finData = readFinanceiro(currentMonthKey)
  let financialScore = 50  // neutral if no data
  let hasPendingPayment = false
  if (finData?.recorrencia) {
    const entry = finData.recorrencia.find(
      (r) => r.clientName.toLowerCase() === client.name.toLowerCase(),
    )
    if (entry) {
      if (entry.status === 'pago') {
        financialScore = 100
        hasPendingPayment = false
      } else if (entry.status === 'pendente') {
        financialScore = 40
        hasPendingPayment = true
      } else {
        // atrasado
        financialScore = 0
        hasPendingPayment = true
      }
    }
  }
  const financial = clamp(financialScore)

  const finalScore = Math.round(
    delivery  * WEIGHTS.delivery +
    approval  * WEIGHTS.approval +
    revision  * WEIGHTS.revision +
    financial * WEIGHTS.financial,
  )

  // Trend — compare current delivery vs prev month delivery
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevItems = items.filter(
    (it) => it.c === client.name &&
      new Date(it.dt) >= prevMonthStart &&
      new Date(it.dt) < prevMonthEnd,
  )
  const prevPublished = prevItems.filter((it) => (states[it.i]?.status ?? it.s) === 7).length
  const prevDelivery  = prevItems.length > 0 ? (prevPublished / prevItems.length) * 100 : 0

  const diff = delivery - prevDelivery
  const trend: 'up' | 'down' | 'flat' =
    diff > 5 ? 'up' : diff < -5 ? 'down' : 'flat'

  // Overdue items
  const overdue = recent.filter((it) => {
    const itemStatus = states[it.i]?.status ?? it.s
    return new Date(it.dt) < now && itemStatus < 7
  })

  // Alert chips
  const alerts: AlertItem[] = []
  if (overdue.length > 0) {
    alerts.push({ label: `🚨 ${overdue.length} post${overdue.length > 1 ? 's' : ''} atrasado${overdue.length > 1 ? 's' : ''}`, severity: 'error' })
  }
  if (avgApprovalMs !== null && approval < 30) {
    alerts.push({ label: '⏳ Aprovação lenta', severity: 'warning' })
  }
  if (rejected.length > 0) {
    alerts.push({ label: `🔄 ${rejected.length} revisão${rejected.length > 1 ? 'ões' : ''}`, severity: 'warning' })
  }
  if (hasPendingPayment) {
    alerts.push({ label: '💰 Pagamento pendente', severity: 'error' })
  }

  return {
    client,
    total: clamp(finalScore),
    components: { delivery, approval, revision, financial },
    band: getBand(clamp(finalScore)),
    alerts,
    trend,
    overdueCount: overdue.length,
    rejectionCount: rejected.length,
    hasPendingPayment,
    approvalSlowMs: avgApprovalMs,
    prevDelivery,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface GaugeProps {
  score: number
  band: ScoreBand
  size?: number
}

function ScoreGauge({ score, band, size = 88 }: GaugeProps) {
  const cfg = BAND_CONFIG[band]
  const pct = score / 100
  // conic-gradient: fill from top clockwise
  const filled  = `${cfg.color}`
  const empty   = 'rgba(255,255,255,0.06)'
  const deg     = Math.round(pct * 360)
  const gradient = `conic-gradient(${filled} 0deg ${deg}deg, ${empty} ${deg}deg 360deg)`

  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {/* Track ring */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: gradient,
          boxShadow: `0 0 ${Math.round(score / 5)}px ${cfg.glow}`,
          transition: 'background 0.6s ease, box-shadow 0.6s ease',
        }}
      />
      {/* Inner mask */}
      <Box
        sx={{
          position: 'absolute',
          inset: 10,
          borderRadius: '50%',
          background: 'rgba(10,10,10,0.98)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <Typography
          sx={{
            fontSize: { md: '1.4rem', lg: '1.6rem', xl: '1.9rem' },
            fontWeight: 900,
            lineHeight: 1,
            color: cfg.color,
            letterSpacing: '-0.03em',
            textShadow: `0 0 16px ${cfg.glow}`,
          }}
        >
          {score}
        </Typography>
        <Typography
          sx={{
            fontSize: { md: '0.48rem', lg: '0.52rem', xl: '0.58rem' },
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'rgba(255,255,255,0.35)',
            mt: 0.3,
          }}
        >
          score
        </Typography>
      </Box>
    </Box>
  )
}

interface MiniBarProps {
  label: string
  value: number
  color: string
}

function MiniBar({ label, value, color }: MiniBarProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography
          sx={{
            fontSize: { md: '0.57rem', lg: '0.6rem', xl: '0.68rem' },
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'rgba(255,255,255,0.40)',
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: { md: '0.6rem', lg: '0.65rem', xl: '0.72rem' },
            fontWeight: 700,
            color,
            letterSpacing: '-0.01em',
          }}
        >
          {Math.round(value)}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={clamp(value)}
        sx={{
          height: { md: 4, xl: 5 },
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.05)',
          '& .MuiLinearProgress-bar': {
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            borderRadius: 3,
          },
        }}
      />
    </Box>
  )
}

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string
  index: number
}

function KpiCard({ label, value, sub, color = '#ff9039', index }: KpiCardProps) {
  return (
    <Box
      sx={{
        flex: '1 1 180px',
        minWidth: { xs: 140, md: 160, xl: 200 },
        background: 'rgba(13,13,13,0.82)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px',
        p: { md: 2, lg: 2.5, xl: 3 },
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        boxShadow: [
          '0 1px 2px rgba(0,0,0,0.4)',
          '0 4px 16px rgba(0,0,0,0.5)',
          'inset 0 1px 0 rgba(255,255,255,0.055)',
        ].join(','),
        animation: `scoreIn 0.4s cubic-bezier(0.16,1,0.3,1) ${index * 60}ms both`,
        '@keyframes scoreIn': {
          from: { opacity: 0, transform: 'scale(0.92) translateY(6px)' },
          to:   { opacity: 1, transform: 'scale(1) translateY(0)' },
        },
      }}
    >
      <Typography
        sx={{
          fontSize: { md: '0.58rem', lg: '0.62rem', xl: '0.7rem' },
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
          color: 'rgba(255,255,255,0.35)',
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: { md: '1.6rem', lg: '2rem', xl: '2.4rem' },
          fontWeight: 900,
          letterSpacing: '-0.03em',
          lineHeight: 1.05,
          color,
          textShadow: `0 0 24px ${color}44`,
          animation: `countUp 0.5s cubic-bezier(0.16,1,0.3,1) ${index * 60 + 100}ms both`,
          '@keyframes countUp': {
            from: { opacity: 0, transform: 'translateY(8px)' },
            to:   { opacity: 1, transform: 'translateY(0)' },
          },
        }}
      >
        {value}
      </Typography>
      {sub && (
        <Typography
          sx={{
            fontSize: { md: '0.6rem', lg: '0.65rem', xl: '0.72rem' },
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: '-0.005em',
          }}
        >
          {sub}
        </Typography>
      )}
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ClientRadar({ items, states, allClients, now }: ClientRadarProps) {
  const currentMonthKey = getMonthKey(now)

  const scores = useMemo<ClientScore[]>(() => {
    return allClients
      .map((client) => computeClientScore(client, items, states, now, currentMonthKey))
      .sort((a, b) => b.total - a.total)  // best first
  }, [items, states, allClients, now, currentMonthKey])

  // Aggregate KPIs
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((s, c) => s + c.total, 0) / scores.length)
    : 0
  const riskCount = scores.filter((c) => c.band === 'risk').length
  const avgDelivery = scores.length > 0
    ? Math.round(scores.reduce((s, c) => s + c.components.delivery, 0) / scores.length)
    : 0

  // MRR from financeiro
  const finData = readFinanceiro(currentMonthKey)
  const mrr = useMemo(() => {
    if (!finData?.recorrencia) return 0
    return finData.recorrencia
      .filter((r) => r.status === 'pago' || r.status === 'pendente')
      .reduce((sum, r) => sum + r.valor, 0)
  }, [finData])

  const mrrFormatted = mrr > 0
    ? `R$ ${mrr.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : '—'

  const avgBand = getBand(avgScore)
  const avgCfg  = BAND_CONFIG[avgBand]

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3, lg: 3.5, xl: 4 },
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 2.5, md: 3, xl: 4 },
        minHeight: '100%',
      }}
    >
      {/* ── Header ──────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography
            sx={{
              fontSize: { md: '0.6rem', lg: '0.65rem', xl: '0.72rem' },
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#ff9039',
              mb: 0.5,
            }}
          >
            Client Radar
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: 'rgba(255,255,255,0.92)',
              fontSize: { md: '1.1rem', lg: '1.3rem', xl: '1.55rem' },
            }}
          >
            Health Score dos Clientes
          </Typography>
          <Typography
            sx={{
              fontSize: { md: '0.68rem', lg: '0.72rem', xl: '0.8rem' },
              color: 'rgba(255,255,255,0.38)',
              mt: 0.4,
              letterSpacing: '-0.005em',
            }}
          >
            Índice composto: entrega · aprovação · revisões · financeiro
          </Typography>
        </Box>

        {/* Legend pills */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {(Object.entries(BAND_CONFIG) as [ScoreBand, typeof BAND_CONFIG[ScoreBand]][]).map(([, cfg]) => (
            <Box
              key={cfg.label}
              sx={{
                px: 1.2,
                py: 0.5,
                borderRadius: '6px',
                background: cfg.bg,
                border: `1px solid ${cfg.color}30`,
                fontSize: { md: '0.58rem', xl: '0.65rem' },
                fontWeight: 600,
                color: cfg.color,
                letterSpacing: '0.02em',
              }}
            >
              {cfg.label}
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── KPI Row ─────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: { xs: 1.5, md: 2, xl: 2.5 }, flexWrap: 'wrap' }}>
        <KpiCard
          index={0}
          label="Média de saúde"
          value={avgScore}
          sub={avgCfg.label}
          color={avgCfg.color}
        />
        <KpiCard
          index={1}
          label="Clientes em risco"
          value={riskCount}
          sub={riskCount === 0 ? 'Nenhum crítico 🎉' : `de ${scores.length} ativos`}
          color={riskCount > 0 ? '#FF4545' : '#00C47A'}
        />
        <KpiCard
          index={2}
          label="Taxa de entrega"
          value={`${avgDelivery}%`}
          sub="média últimos 60 dias"
          color="#3B8EFF"
        />
        <KpiCard
          index={3}
          label="MRR previsto"
          value={mrrFormatted}
          sub={`pagos + pendentes · ${currentMonthKey}`}
          color="#00C47A"
        />
      </Box>

      {/* ── Divider ──────────────────────────────────────── */}
      <Box
        sx={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(255,144,57,0.25) 30%, rgba(255,144,57,0.12) 70%, transparent)',
        }}
      />

      {/* ── Client grid ─────────────────────────────────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            xl: 'repeat(4, 1fr)',
          },
          gap: { xs: 1.5, md: 2, xl: 2.5 },
        }}
      >
        {scores.map((sc, idx) => (
          <ClientCard key={sc.client.name} score={sc} index={idx} />
        ))}
      </Box>
    </Box>
  )
}

// ── Client card ───────────────────────────────────────────────────────────────

interface ClientCardProps {
  score: ClientScore
  index: number
}

function ClientCard({ score, index }: ClientCardProps) {
  const cfg = BAND_CONFIG[score.band]

  const TrendIcon =
    score.trend === 'up'   ? TrendingUpIcon   :
    score.trend === 'down' ? TrendingDownIcon :
    TrendingFlatIcon

  const trendColor =
    score.trend === 'up'   ? '#00C47A' :
    score.trend === 'down' ? '#FF4545' :
    'rgba(255,255,255,0.35)'

  const trendLabel =
    score.trend === 'up'   ? 'em alta vs. mês ant.' :
    score.trend === 'down' ? 'queda vs. mês ant.' :
    'estável vs. mês ant.'

  // Delay stagger: 8 cards per row on xl → stagger within rows
  const staggerMs = (index % 4) * 55 + Math.floor(index / 4) * 40

  return (
    <Box
      sx={{
        background: 'rgba(13,13,13,0.82)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: `1px solid ${score.alerts.length > 0 ? `${cfg.color}22` : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '16px',
        p: { md: 2, lg: 2.5, xl: 3 },
        display: 'flex',
        flexDirection: 'column',
        gap: { md: 1.5, xl: 2 },
        boxShadow: [
          '0 1px 2px rgba(0,0,0,0.4)',
          '0 4px 16px rgba(0,0,0,0.5)',
          '0 16px 48px rgba(0,0,0,0.4)',
          `0 0 32px ${score.band === 'risk' ? 'rgba(255,69,69,0.06)' : 'transparent'}`,
          'inset 0 1px 0 rgba(255,255,255,0.055)',
        ].join(','),
        transition: 'all 0.2s ease',
        animation: `scoreIn 0.45s cubic-bezier(0.16,1,0.3,1) ${staggerMs}ms both`,
        '@keyframes scoreIn': {
          from: { opacity: 0, transform: 'scale(0.9) translateY(8px)' },
          to:   { opacity: 1, transform: 'scale(1) translateY(0)' },
        },
        '&:hover': {
          borderColor: `${cfg.color}44`,
          transform: 'translateY(-2px)',
          boxShadow: [
            '0 2px 4px rgba(0,0,0,0.4)',
            '0 12px 40px rgba(0,0,0,0.6)',
            `0 0 48px ${cfg.glow}`,
            'inset 0 1px 0 rgba(255,255,255,0.1)',
          ].join(','),
        },
      }}
    >
      {/* ── Card header: name + gauge ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <ScoreGauge score={score.total} band={score.band} size={80} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Band pill */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: 0.9,
              py: 0.3,
              borderRadius: '5px',
              background: cfg.bg,
              border: `1px solid ${cfg.color}30`,
              mb: 0.6,
            }}
          >
            <Typography
              sx={{
                fontSize: { md: '0.5rem', lg: '0.54rem', xl: '0.6rem' },
                fontWeight: 700,
                color: cfg.color,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}
            >
              {cfg.label}
            </Typography>
          </Box>

          {/* Client name */}
          <Typography
            sx={{
              fontSize: { md: '0.75rem', lg: '0.82rem', xl: '0.92rem' },
              fontWeight: 700,
              letterSpacing: '-0.015em',
              color: 'rgba(255,255,255,0.92)',
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {score.client.name}
          </Typography>

          {/* Subnicho */}
          {score.client.subnicho && (
            <Typography
              sx={{
                fontSize: { md: '0.55rem', lg: '0.58rem', xl: '0.64rem' },
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.25)',
                lineHeight: 1,
                mt: 0.2,
              }}
            >
              {score.client.subnicho}
            </Typography>
          )}

          {/* Trend */}
          <Tooltip title={trendLabel} placement="top">
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.4,
                mt: 0.4,
                cursor: 'default',
              }}
            >
              <TrendIcon sx={{ fontSize: { md: 12, xl: 14 }, color: trendColor }} />
              <Typography
                sx={{
                  fontSize: { md: '0.55rem', lg: '0.58rem', xl: '0.65rem' },
                  fontWeight: 600,
                  color: trendColor,
                  letterSpacing: '-0.005em',
                }}
              >
                {trendLabel}
              </Typography>
            </Box>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Mini bars ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.9 }}>
        <MiniBar label="Entrega"   value={score.components.delivery}  color={BAND_CONFIG[getBand(score.components.delivery)].color}  />
        <MiniBar label="Aprovação" value={score.components.approval}  color={BAND_CONFIG[getBand(score.components.approval)].color}  />
        <MiniBar label="Revisões"  value={score.components.revision}  color={BAND_CONFIG[getBand(score.components.revision)].color}  />
        <MiniBar label="Financeiro" value={score.components.financial} color={BAND_CONFIG[getBand(score.components.financial)].color} />
      </Box>

      {/* ── Alert chips ── */}
      {score.alerts.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {score.alerts.map((alert) => {
            const alertColor =
              alert.severity === 'error'   ? '#FF4545' :
              alert.severity === 'warning' ? '#FF9A3D' :
              '#3B8EFF'
            return (
              <Chip
                key={alert.label}
                label={alert.label}
                size="small"
                variant="outlined"
                sx={{
                  fontSize: { md: '0.56rem', lg: '0.6rem', xl: '0.66rem' },
                  fontWeight: 700,
                  height: { md: 20, xl: 24 },
                  borderColor: `${alertColor}40`,
                  color: alertColor,
                  bgcolor: `${alertColor}0a`,
                  letterSpacing: '0.01em',
                  borderRadius: '6px',
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            )
          })}
        </Box>
      )}
    </Box>
  )
}
