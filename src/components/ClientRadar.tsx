import { useMemo, useState } from 'react'
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
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import type { ContentItem, ItemState, Client, FinanceiroMes } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClientRadarProps {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  now: Date
}

interface ScoreComponents {
  delivery: number
  approval: number
  revision: number
  financial: number
}

interface ClientScore {
  client: Client
  total: number
  prevTotal: number
  components: ScoreComponents
  band: ScoreBand
  alerts: AlertItem[]
  trend: 'up' | 'down' | 'flat'
  overdueCount: number
  rejectionCount: number
  hasPendingPayment: boolean
  approvalSlowMs: number | null
  action: string
  churnRisk: boolean
  prevDelivery: number
}

interface AlertItem {
  label: string
  severity: 'error' | 'warning' | 'info'
}

type ScoreBand = 'excellent' | 'good' | 'attention' | 'risk'
type BandFilter = 'all' | ScoreBand

// ── Constants ─────────────────────────────────────────────────────────────────

const BAND_CONFIG: Record<ScoreBand, { label: string; short: string; color: string; glow: string; bg: string }> = {
  excellent: { label: 'Excelente', short: '🟢 Excelente', color: '#00C47A', glow: 'rgba(0,196,122,0.25)',  bg: 'rgba(0,196,122,0.08)'  },
  good:      { label: 'Bom',       short: '🟡 Bom',       color: '#FFD700', glow: 'rgba(255,215,0,0.25)',   bg: 'rgba(255,215,0,0.07)'  },
  attention: { label: 'Atenção',   short: '🟠 Atenção',   color: '#FF9A3D', glow: 'rgba(255,154,61,0.25)',  bg: 'rgba(255,154,61,0.07)' },
  risk:      { label: 'Risco',     short: '🔴 Risco',     color: '#FF4545', glow: 'rgba(255,69,69,0.3)',    bg: 'rgba(255,69,69,0.08)'  },
}

const BAND_ORDER: ScoreBand[] = ['risk', 'attention', 'good', 'excellent']

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
  if (avgMs === null) return 70
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

function buildAction(
  overdueCount: number,
  delivery: number,
  hasPendingPayment: boolean,
  rejectionCount: number,
  approval: number,
): string {
  if (hasPendingPayment) return '💰 Regularizar pagamento do cliente'
  if (overdueCount > 0) return `📅 Publicar ${overdueCount} conteúdo${overdueCount > 1 ? 's' : ''} em atraso`
  if (rejectionCount > 0) return `🔄 Refazer ${rejectionCount} conteúdo${rejectionCount > 1 ? 's' : ''} reprovado${rejectionCount > 1 ? 's' : ''}`
  if (approval < 50) return '⏳ Agilizar aprovações com o cliente'
  if (delivery < 50) return '🚀 Acelerar ritmo de entrega'
  if (delivery >= 80) return `✅ Manter ritmo — ${Math.round(delivery)}% entregue`
  return `📈 Avançar aprovações — ${Math.round(delivery)}% entregue`
}

// ── Score computation ──────────────────────────────────────────────────────────

function computeClientScore(
  client: Client,
  items: ContentItem[],
  states: Record<number, ItemState>,
  now: Date,
  currentMonthKey: string,
): ClientScore {
  const sixtyDaysAgo = new Date(now.getTime() - 60 * MS_PER_DAY)

  const recent = items.filter(
    (it) => it.c === client.name && new Date(it.dt) >= sixtyDaysAgo,
  )

  // Entrega: só itens com data vencida
  const dueItems = recent.filter((it) => new Date(it.dt) <= now)
  const published = dueItems.filter((it) => (states[it.i]?.status ?? it.s) === 7).length
  const deliveryRate = dueItems.length > 0 ? published / dueItems.length : 0.7
  const delivery = clamp(deliveryRate * 100)

  // Approval speed
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

  // Revision score
  const rejected = recent.filter((it) => (states[it.i]?.status ?? it.s) === 6)
  const revision = recent.length > 0 ? clamp((1 - rejected.length / recent.length) * 100) : 100

  // Financial score
  const finData = readFinanceiro(currentMonthKey)
  let financialScore = 50
  let hasPendingPayment = false
  if (finData?.recorrencia) {
    const entry = finData.recorrencia.find(
      (r) => r.clientName.toLowerCase() === client.name.toLowerCase(),
    )
    if (entry) {
      if (entry.status === 'pago') { financialScore = 100; hasPendingPayment = false }
      else if (entry.status === 'pendente') { financialScore = 40; hasPendingPayment = true }
      else { financialScore = 0; hasPendingPayment = true }
    }
  }
  const financial = clamp(financialScore)

  const finalScore = Math.round(
    delivery  * WEIGHTS.delivery +
    approval  * WEIGHTS.approval +
    revision  * WEIGHTS.revision +
    financial * WEIGHTS.financial,
  )

  // Trend — prev month delivery
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
  const trend: 'up' | 'down' | 'flat' = diff > 5 ? 'up' : diff < -5 ? 'down' : 'flat'

  // Estimate prev score (simplified — uses prev delivery, keeps other components)
  const prevTotalEst = Math.round(
    (prevDelivery > 0 ? prevDelivery : 70) * WEIGHTS.delivery +
    approval * WEIGHTS.approval +
    revision * WEIGHTS.revision +
    financial * WEIGHTS.financial,
  )

  // Overdue
  const overdue = recent.filter((it) => {
    const itemStatus = states[it.i]?.status ?? it.s
    return new Date(it.dt) < now && itemStatus < 7
  })

  // Churn risk: score baixo por 2 meses consecutivos E tem histórico de itens
  const churnRisk = recent.length > 2 && prevDelivery < 40 && delivery < 50

  // Alerts
  const alerts: AlertItem[] = []
  if (overdue.length > 0)
    alerts.push({ label: `🚨 ${overdue.length} atrasado${overdue.length > 1 ? 's' : ''}`, severity: 'error' })
  if (avgApprovalMs !== null && approval < 30)
    alerts.push({ label: '⏳ Aprovação lenta', severity: 'warning' })
  if (rejected.length > 0)
    alerts.push({ label: `🔄 ${rejected.length} revisão${rejected.length > 1 ? 'ões' : ''}`, severity: 'warning' })
  if (hasPendingPayment)
    alerts.push({ label: '💰 Pagamento pendente', severity: 'error' })

  return {
    client,
    total: clamp(finalScore),
    prevTotal: clamp(prevTotalEst),
    components: { delivery, approval, revision, financial },
    band: getBand(clamp(finalScore)),
    alerts,
    trend,
    overdueCount: overdue.length,
    rejectionCount: rejected.length,
    hasPendingPayment,
    approvalSlowMs: avgApprovalMs,
    action: buildAction(overdue.length, delivery, hasPendingPayment, rejected.length, approval),
    churnRisk,
    prevDelivery,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreGauge({ score, band, size = 88 }: { score: number; band: ScoreBand; size?: number }) {
  const cfg = BAND_CONFIG[band]
  const deg = Math.round((score / 100) * 360)
  const gradient = `conic-gradient(${cfg.color} 0deg ${deg}deg, rgba(255,255,255,0.06) ${deg}deg 360deg)`

  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <Box sx={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: gradient,
        boxShadow: `0 0 ${Math.round(score / 5)}px ${cfg.glow}`,
        transition: 'background 0.6s ease',
      }} />
      <Box sx={{
        position: 'absolute', inset: 10, borderRadius: '50%',
        background: 'rgba(10,10,10,0.98)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
      }}>
        <Typography sx={{
          fontSize: { md: '1.4rem', lg: '1.6rem', xl: '1.9rem' },
          fontWeight: 900, lineHeight: 1, color: cfg.color,
          letterSpacing: '-0.03em', textShadow: `0 0 16px ${cfg.glow}`,
        }}>
          {score}
        </Typography>
        <Typography sx={{
          fontSize: { md: '0.48rem', lg: '0.52rem', xl: '0.58rem' },
          fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          color: 'rgba(255,255,255,0.35)', mt: 0.3,
        }}>
          score
        </Typography>
      </Box>
    </Box>
  )
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{
          fontSize: { md: '0.57rem', lg: '0.6rem', xl: '0.68rem' },
          fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
          color: 'rgba(255,255,255,0.40)',
        }}>
          {label}
        </Typography>
        <Typography sx={{
          fontSize: { md: '0.6rem', lg: '0.65rem', xl: '0.72rem' },
          fontWeight: 700, color, letterSpacing: '-0.01em',
        }}>
          {Math.round(value)}%
        </Typography>
      </Box>
      <LinearProgress variant="determinate" value={clamp(value)} sx={{
        height: { md: 4, xl: 5 }, borderRadius: 3,
        bgcolor: 'rgba(255,255,255,0.05)',
        '& .MuiLinearProgress-bar': {
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 3,
        },
      }} />
    </Box>
  )
}

function KpiCard({
  label, value, sub, color = '#ff9039', index, delta,
}: {
  label: string; value: string | number; sub?: string
  color?: string; index: number; delta?: number
}) {
  const deltaColor = delta === undefined ? undefined : delta > 0 ? '#00C47A' : delta < 0 ? '#FF4545' : 'rgba(255,255,255,0.3)'
  const deltaSign  = delta !== undefined && delta > 0 ? '+' : ''

  return (
    <Box sx={{
      flex: '1 1 180px', minWidth: { xs: 140, md: 160, xl: 200 },
      background: 'rgba(13,13,13,0.82)',
      backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
      border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px',
      p: { md: 2, lg: 2.5, xl: 3 },
      display: 'flex', flexDirection: 'column', gap: 0.5,
      boxShadow: '0 1px 2px rgba(0,0,0,0.4),0 4px 16px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.055)',
      animation: `scoreIn 0.4s cubic-bezier(0.16,1,0.3,1) ${index * 60}ms both`,
      '@keyframes scoreIn': {
        from: { opacity: 0, transform: 'scale(0.92) translateY(6px)' },
        to:   { opacity: 1, transform: 'scale(1) translateY(0)' },
      },
    }}>
      <Typography sx={{
        fontSize: { md: '0.58rem', lg: '0.62rem', xl: '0.7rem' },
        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em',
        color: 'rgba(255,255,255,0.35)',
      }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography sx={{
          fontSize: { md: '1.6rem', lg: '2rem', xl: '2.4rem' },
          fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05,
          color, textShadow: `0 0 24px ${color}44`,
        }}>
          {value}
        </Typography>
        {delta !== undefined && delta !== 0 && (
          <Typography sx={{
            fontSize: { md: '0.62rem', xl: '0.7rem' },
            fontWeight: 700, color: deltaColor, lineHeight: 1,
          }}>
            {deltaSign}{delta} vs ant.
          </Typography>
        )}
      </Box>
      {sub && (
        <Typography sx={{
          fontSize: { md: '0.6rem', lg: '0.65rem', xl: '0.72rem' },
          color: 'rgba(255,255,255,0.35)', letterSpacing: '-0.005em',
        }}>
          {sub}
        </Typography>
      )}
    </Box>
  )
}

function ClientCard({ score, index }: { score: ClientScore; index: number }) {
  const cfg = BAND_CONFIG[score.band]
  const TrendIcon  = score.trend === 'up' ? TrendingUpIcon : score.trend === 'down' ? TrendingDownIcon : TrendingFlatIcon
  const trendColor = score.trend === 'up' ? '#00C47A' : score.trend === 'down' ? '#FF4545' : 'rgba(255,255,255,0.35)'
  const trendLabel = score.trend === 'up' ? 'em alta vs. mês ant.' : score.trend === 'down' ? 'queda vs. mês ant.' : 'estável vs. mês ant.'
  const staggerMs  = (index % 4) * 55 + Math.floor(index / 4) * 40
  const scoreDelta = score.total - score.prevTotal
  const deltaColor = scoreDelta > 0 ? '#00C47A' : scoreDelta < 0 ? '#FF4545' : 'rgba(255,255,255,0.3)'

  return (
    <Box sx={{
      background: 'rgba(13,13,13,0.82)',
      backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
      border: `1px solid ${score.band === 'risk' ? 'rgba(255,69,69,0.2)' : score.alerts.length > 0 ? `${cfg.color}20` : 'rgba(255,255,255,0.06)'}`,
      borderRadius: '16px',
      p: { md: 2, lg: 2.5, xl: 3 },
      display: 'flex', flexDirection: 'column', gap: { md: 1.5, xl: 2 },
      boxShadow: [
        '0 1px 2px rgba(0,0,0,0.4)', '0 4px 16px rgba(0,0,0,0.5)',
        `0 0 32px ${score.band === 'risk' ? 'rgba(255,69,69,0.07)' : 'transparent'}`,
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
        boxShadow: `0 12px 40px rgba(0,0,0,0.6),0 0 48px ${cfg.glow},inset 0 1px 0 rgba(255,255,255,0.1)`,
      },
    }}>
      {/* ── Header: gauge + nome ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <ScoreGauge score={score.total} band={score.band} size={80} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Badges: band + churn risk */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.6, flexWrap: 'wrap' }}>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center',
              px: 0.9, py: 0.3, borderRadius: '5px',
              background: cfg.bg, border: `1px solid ${cfg.color}30`,
            }}>
              <Typography sx={{
                fontSize: { md: '0.5rem', lg: '0.54rem', xl: '0.6rem' },
                fontWeight: 700, color: cfg.color,
                textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>
                {cfg.short}
              </Typography>
            </Box>
            {score.churnRisk && (
              <Tooltip title="Score baixo por 2 meses seguidos — risco de perda" placement="top">
                <Box sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.3,
                  px: 0.7, py: 0.3, borderRadius: '5px',
                  bgcolor: 'rgba(255,69,69,0.1)', border: '1px solid rgba(255,69,69,0.3)',
                  cursor: 'default',
                }}>
                  <WarningAmberIcon sx={{ fontSize: 9, color: '#FF4545' }} />
                  <Typography sx={{
                    fontSize: { md: '0.48rem', xl: '0.56rem' },
                    fontWeight: 700, color: '#FF4545', letterSpacing: '0.05em',
                  }}>
                    CHURN RISK
                  </Typography>
                </Box>
              </Tooltip>
            )}
          </Box>

          {/* Nome */}
          <Typography sx={{
            fontSize: { md: '0.75rem', lg: '0.82rem', xl: '0.92rem' },
            fontWeight: 700, letterSpacing: '-0.015em',
            color: 'rgba(255,255,255,0.92)', lineHeight: 1.25,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {score.client.name}
          </Typography>

          {score.client.subnicho && (
            <Typography sx={{
              fontSize: { md: '0.55rem', xl: '0.62rem' },
              fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.25)', lineHeight: 1, mt: 0.2,
            }}>
              {score.client.subnicho}
            </Typography>
          )}

          {/* Trend + delta */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Tooltip title={trendLabel} placement="top">
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, cursor: 'default' }}>
                <TrendIcon sx={{ fontSize: { md: 11, xl: 13 }, color: trendColor }} />
                <Typography sx={{ fontSize: { md: '0.52rem', xl: '0.6rem' }, fontWeight: 600, color: trendColor }}>
                  {trendLabel}
                </Typography>
              </Box>
            </Tooltip>
            {scoreDelta !== 0 && (
              <Typography sx={{ fontSize: { md: '0.5rem', xl: '0.58rem' }, fontWeight: 700, color: deltaColor }}>
                {scoreDelta > 0 ? '+' : ''}{scoreDelta}pts
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {/* ── Mini bars ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.9 }}>
        <MiniBar label="Entrega"    value={score.components.delivery}  color={BAND_CONFIG[getBand(score.components.delivery)].color}  />
        <MiniBar label="Aprovação"  value={score.components.approval}  color={BAND_CONFIG[getBand(score.components.approval)].color}  />
        <MiniBar label="Revisões"   value={score.components.revision}  color={BAND_CONFIG[getBand(score.components.revision)].color}  />
        <MiniBar label="Financeiro" value={score.components.financial} color={BAND_CONFIG[getBand(score.components.financial)].color} />
      </Box>

      {/* ── Ação recomendada ── */}
      <Box sx={{
        display: 'flex', alignItems: 'flex-start', gap: 0.8,
        pt: 0.75, borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <LightbulbOutlinedIcon sx={{ fontSize: 12, color: cfg.color, mt: 0.15, flexShrink: 0 }} />
        <Typography sx={{
          fontSize: { md: '0.6rem', lg: '0.62rem', xl: '0.68rem' },
          color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, fontStyle: 'italic',
        }}>
          {score.action}
        </Typography>
      </Box>

      {/* ── Alert chips ── */}
      {score.alerts.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
          {score.alerts.map((alert) => {
            const alertColor = alert.severity === 'error' ? '#FF4545' : alert.severity === 'warning' ? '#FF9A3D' : '#3B8EFF'
            return (
              <Chip key={alert.label} label={alert.label} size="small" variant="outlined"
                sx={{
                  fontSize: { md: '0.56rem', xl: '0.64rem' }, fontWeight: 700,
                  height: { md: 20, xl: 24 },
                  borderColor: `${alertColor}40`, color: alertColor, bgcolor: `${alertColor}0a`,
                  letterSpacing: '0.01em', borderRadius: '6px',
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

// ── Main component ────────────────────────────────────────────────────────────

export default function ClientRadar({ items, states, allClients, now }: ClientRadarProps) {
  const currentMonthKey = getMonthKey(now)
  const [bandFilter, setBandFilter] = useState<BandFilter>('all')

  const scores = useMemo<ClientScore[]>(() => {
    return allClients
      .map((client) => computeClientScore(client, items, states, now, currentMonthKey))
      .sort((a, b) => {
        // Risk first within each band group, then by score desc within band
        const bandPriority: Record<ScoreBand, number> = { risk: 0, attention: 1, good: 2, excellent: 3 }
        if (bandPriority[a.band] !== bandPriority[b.band]) return bandPriority[a.band] - bandPriority[b.band]
        return b.total - a.total
      })
  }, [items, states, allClients, now, currentMonthKey])

  const avgScore    = scores.length > 0 ? Math.round(scores.reduce((s, c) => s + c.total, 0) / scores.length) : 0
  const prevAvgScore = scores.length > 0 ? Math.round(scores.reduce((s, c) => s + c.prevTotal, 0) / scores.length) : 0
  const riskCount   = scores.filter((c) => c.band === 'risk').length
  const prevRisk    = scores.filter((c) => c.prevTotal < 50).length
  const avgDelivery = scores.length > 0 ? Math.round(scores.reduce((s, c) => s + c.components.delivery, 0) / scores.length) : 0
  const prevAvgDel  = scores.length > 0 ? Math.round(scores.reduce((s, c) => s + c.prevDelivery, 0) / scores.length) : 0
  const churnCount  = scores.filter((c) => c.churnRisk).length

  const finData = readFinanceiro(currentMonthKey)
  const mrr = useMemo(() => {
    if (!finData?.recorrencia) return 0
    return finData.recorrencia
      .filter((r) => r.status === 'pago' || r.status === 'pendente')
      .reduce((sum, r) => sum + r.valor, 0)
  }, [finData])
  const mrrFormatted = mrr > 0
    ? `R$ ${mrr.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
    : '—'

  const avgBand = getBand(avgScore)
  const avgCfg  = BAND_CONFIG[avgBand]

  // Filtered + grouped
  const filtered = bandFilter === 'all' ? scores : scores.filter((s) => s.band === bandFilter)

  const grouped = BAND_ORDER.reduce<Record<ScoreBand, ClientScore[]>>((acc, b) => {
    acc[b] = filtered.filter((s) => s.band === b)
    return acc
  }, { risk: [], attention: [], good: [], excellent: [] })

  const bandCounts = BAND_ORDER.reduce<Record<BandFilter, number>>((acc, b) => {
    acc[b] = scores.filter((s) => s.band === b).length
    return acc
  }, { all: scores.length, risk: 0, attention: 0, good: 0, excellent: 0 })

  return (
    <Box sx={{
      p: { xs: 2, md: 3, lg: 3.5, xl: 4 },
      display: 'flex', flexDirection: 'column',
      gap: { xs: 2.5, md: 3, xl: 4 }, minHeight: '100%',
    }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{
            fontSize: { md: '0.6rem', xl: '0.72rem' }, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ff9039', mb: 0.5,
          }}>
            Client Radar
          </Typography>
          <Typography variant="h5" sx={{
            fontWeight: 800, letterSpacing: '-0.025em',
            color: 'rgba(255,255,255,0.92)',
            fontSize: { md: '1.1rem', lg: '1.3rem', xl: '1.55rem' },
          }}>
            Health Score dos Clientes
          </Typography>
          <Typography sx={{
            fontSize: { md: '0.68rem', xl: '0.8rem' },
            color: 'rgba(255,255,255,0.38)', mt: 0.4,
          }}>
            Índice composto: entrega · aprovação · revisões · financeiro
          </Typography>
        </Box>
        {churnCount > 0 && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 2, py: 1, borderRadius: 2,
            bgcolor: 'rgba(255,69,69,0.08)', border: '1px solid rgba(255,69,69,0.25)',
          }}>
            <WarningAmberIcon sx={{ fontSize: 16, color: '#FF4545' }} />
            <Box>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#FF4545', lineHeight: 1 }}>
                {churnCount} cliente{churnCount > 1 ? 's' : ''} em risco de perda
              </Typography>
              <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)' }}>
                Score baixo por 2 meses consecutivos
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* ── KPI Row ── */}
      <Box sx={{ display: 'flex', gap: { xs: 1.5, md: 2, xl: 2.5 }, flexWrap: 'wrap' }}>
        <KpiCard index={0} label="Média de saúde"    value={avgScore}      sub={avgCfg.short}                      color={avgCfg.color}                       delta={avgScore - prevAvgScore} />
        <KpiCard index={1} label="Clientes em risco" value={riskCount}     sub={riskCount === 0 ? 'Nenhum crítico 🎉' : `de ${scores.length} ativos`} color={riskCount > 0 ? '#FF4545' : '#00C47A'} delta={riskCount - prevRisk} />
        <KpiCard index={2} label="Taxa de entrega"   value={`${avgDelivery}%`} sub="média dos itens vencidos"     color="#3B8EFF"                            delta={avgDelivery - prevAvgDel} />
        <KpiCard index={3} label="MRR previsto"      value={mrrFormatted}  sub={`pagos + pendentes · ${currentMonthKey}`} color="#00C47A" />
      </Box>

      {/* ── Filtro por banda ── */}
      <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mr: 0.5 }}>
          Filtrar:
        </Typography>
        {(['all', ...BAND_ORDER] as BandFilter[]).map((f) => {
          const count = bandCounts[f]
          const active = bandFilter === f
          const color  = f === 'all' ? '#ff9039' : BAND_CONFIG[f as ScoreBand].color
          const label  = f === 'all' ? 'Todos' : BAND_CONFIG[f as ScoreBand].label
          return (
            <Box
              key={f}
              onClick={() => setBandFilter(f)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.6,
                px: 1.4, py: 0.55, borderRadius: 99, cursor: 'pointer',
                bgcolor: active ? `${color}18` : 'rgba(255,255,255,0.04)',
                border: active ? `1px solid ${color}50` : '1px solid rgba(255,255,255,0.07)',
                transition: 'all 0.15s ease',
                '&:hover': { bgcolor: `${color}10`, borderColor: `${color}30` },
              }}
            >
              <Typography sx={{ fontSize: '0.68rem', fontWeight: active ? 700 : 500, color: active ? color : 'rgba(255,255,255,0.5)' }}>
                {label}
              </Typography>
              <Box sx={{
                minWidth: 18, height: 16, borderRadius: '5px', px: 0.5,
                bgcolor: active ? `${color}25` : 'rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: active ? color : 'rgba(255,255,255,0.3)' }}>
                  {count}
                </Typography>
              </Box>
            </Box>
          )
        })}
      </Box>

      {/* ── Divider ── */}
      <Box sx={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,144,57,0.2) 30%, rgba(255,144,57,0.1) 70%, transparent)' }} />

      {/* ── Grupos por banda ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { md: 3, xl: 4 } }}>
        {BAND_ORDER.map((band) => {
          const group = grouped[band]
          if (group.length === 0) return null
          const bcfg = BAND_CONFIG[band]
          return (
            <Box key={band}>
              {/* Section header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{
                  px: 1.5, py: 0.5, borderRadius: 99,
                  bgcolor: bcfg.bg, border: `1px solid ${bcfg.color}35`,
                  display: 'flex', alignItems: 'center', gap: 0.8,
                }}>
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: bcfg.color, letterSpacing: '0.04em' }}>
                    {bcfg.short}
                  </Typography>
                  <Box sx={{
                    width: 18, height: 16, borderRadius: '4px',
                    bgcolor: `${bcfg.color}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: bcfg.color }}>{group.length}</Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: 1, height: '1px', bgcolor: `${bcfg.color}15` }} />
              </Box>

              {/* Cards grid */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' },
                gap: { xs: 1.5, md: 2, xl: 2.5 },
              }}>
                {group.map((sc, idx) => (
                  <ClientCard key={sc.client.name} score={sc} index={idx} />
                ))}
              </Box>
            </Box>
          )
        })}

        {filtered.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8, color: 'rgba(255,255,255,0.25)' }}>
            <Typography sx={{ fontSize: '2rem', mb: 1 }}>🎯</Typography>
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 600 }}>Nenhum cliente nesta categoria</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
