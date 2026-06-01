import { useMemo } from 'react'
import {
  Box, Typography, Paper, Tooltip, Chip, LinearProgress,
} from '@mui/material'
import TrendingUpIcon    from '@mui/icons-material/TrendingUp'
import TrendingDownIcon  from '@mui/icons-material/TrendingDown'
import type { FinanceiroMes } from '../types'

const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MONTH_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const fmt = (v: number, compact = false) => compact
  ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 })
  : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })

function getMonthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function loadMonth(year: number, month: number): FinanceiroMes {
  try {
    const raw = localStorage.getItem(`sm_financeiro2_${getMonthKey(year, month)}`)
    return raw ? JSON.parse(raw) : { recorrencia: [], entradas: [], saidas: [], custosFixos: [] }
  } catch { return { recorrencia: [], entradas: [], saidas: [], custosFixos: [] } }
}

interface MonthStats {
  month: number
  year: number
  label: string
  mrr: number
  recebido: number
  despesas: number
  fixos: number
  saldo: number
  hasDados: boolean
  isFuture: boolean
}

interface Props { now: Date }

export default function ProjecaoPanel({ now }: Props) {
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth()

  const months: MonthStats[] = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = loadMonth(currentYear, i)
      const mrr       = d.recorrencia.reduce((s, e) => s + e.valor, 0)
      const recebido  = d.recorrencia.filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)
                      + d.entradas.filter(e => e.status === 'recebido').reduce((s, e) => s + e.valor, 0)
      const despesas  = d.saidas.filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)
      const fixos     = d.custosFixos.filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)
      const saldo     = recebido - despesas - fixos
      const hasDados  = mrr > 0 || d.entradas.length > 0
      return {
        month: i, year: currentYear,
        label: MONTH_SHORT[i],
        mrr, recebido, despesas, fixos, saldo,
        hasDados,
        isFuture: i > currentMonth,
      }
    })
  }, [currentYear, currentMonth, now])

  const ytd = useMemo(() => {
    const pastMonths = months.filter(m => !m.isFuture)
    return {
      receita:  pastMonths.reduce((s, m) => s + m.recebido, 0),
      despesas: pastMonths.reduce((s, m) => s + m.despesas + m.fixos, 0),
      saldo:    pastMonths.reduce((s, m) => s + m.saldo, 0),
      meses:    pastMonths.length,
    }
  }, [months])

  // Projection: use last 3 months average MRR for future months
  const avgMrr = useMemo(() => {
    const recent = months.filter(m => !m.isFuture && m.mrr > 0)
    if (recent.length === 0) return 0
    const last3 = recent.slice(-3)
    return last3.reduce((s, m) => s + m.mrr, 0) / last3.length
  }, [months])

  const avgCosts = useMemo(() => {
    const recent = months.filter(m => !m.isFuture && (m.despesas + m.fixos) > 0)
    if (recent.length === 0) return 0
    const last3 = recent.slice(-3)
    return last3.reduce((s, m) => s + m.despesas + m.fixos, 0) / last3.length
  }, [months])

  const projecaoAnual = useMemo(() => {
    const futureMonths = months.filter(m => m.isFuture)
    const projReceita  = futureMonths.length * avgMrr
    const projDespesas = futureMonths.length * avgCosts
    return {
      receita:  ytd.receita  + projReceita,
      despesas: ytd.despesas + projDespesas,
      saldo:    (ytd.receita + projReceita) - (ytd.despesas + projDespesas),
    }
  }, [ytd, avgMrr, avgCosts, months])

  // Break-even: how many clients at avg ticket to cover fixed costs
  const avgTicket = useMemo(() => {
    const clientsWithRevenue = months
      .filter(m => m.month === currentMonth)[0]?.mrr ?? avgMrr
    const currentData = loadMonth(currentYear, currentMonth)
    const numClients = currentData.recorrencia.filter(r => r.valor > 0).length || 1
    return clientsWithRevenue / numClients
  }, [currentYear, currentMonth, avgMrr, months])

  const breakEvenClients = avgCosts > 0 && avgTicket > 0
    ? Math.ceil(avgCosts / avgTicket)
    : 0

  const currentData = loadMonth(currentYear, currentMonth)
  const activeClients = currentData.recorrencia.filter(r => r.valor > 0).length

  const maxBar = Math.max(...months.map(m => Math.max(m.mrr, m.recebido)), 1)
  const marginColor = projecaoAnual.saldo > 0 ? '#00C47A' : '#FF4545'
  const ytdMargin = ytd.receita > 0 ? Math.round((ytd.saldo / ytd.receita) * 100) : 0
  const ytdMarginColor = ytdMargin >= 30 ? '#00C47A' : ytdMargin >= 10 ? '#FFD700' : '#FF4545'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* ── KPIs YTD ─────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(4,1fr)' }, gap: 1.5 }}>
        {[
          { label: `Receita YTD (${ytd.meses}m)`, value: fmt(ytd.receita), color: '#00C47A', icon: '💰' },
          { label: 'Custos YTD',         value: fmt(ytd.despesas),              color: '#FF4545', icon: '🔴' },
          { label: 'Resultado YTD',      value: fmt(ytd.saldo),                 color: ytd.saldo >= 0 ? '#00C47A' : '#FF4545', icon: ytd.saldo >= 0 ? '📈' : '📉' },
          { label: 'Margem YTD',         value: `${ytdMargin}%`,                color: ytdMarginColor, icon: '📊' },
        ].map(({ label, value, color, icon }) => (
          <Paper key={label} sx={{
            p: 1.8, borderRadius: 2, position: 'relative', overflow: 'hidden',
            background: `linear-gradient(135deg, ${color}10, transparent)`,
            border: `1px solid ${color}22`,
            '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 2, bgcolor: color },
          }}>
            <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.4 }}>
              {icon} {label}
            </Typography>
            <Typography sx={{ fontSize: { xs: '1rem', md: '1.3rem' }, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {value}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* ── Gráfico de barras — 12 meses ─────────────────────────────────── */}
      <Paper sx={{ p: { xs: 1.5, md: 2 }, bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TrendingUpIcon sx={{ fontSize: 16, color: 'primary.main' }} />
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary' }}>
            MRR / Recebido — {currentYear}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {[
              { color: 'rgba(255,144,57,0.4)', label: 'MRR contratado' },
              { color: '#00C47A',               label: 'Recebido' },
              { color: 'rgba(255,255,255,0.12)', label: 'Projeção' },
            ].map(l => (
              <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: 1, bgcolor: l.color }} />
                <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary' }}>{l.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 0.4, md: 0.8 }, height: 100 }}>
          {months.map(m => {
            const mrrH    = maxBar > 0 ? (m.mrr / maxBar) * 85 : 2
            const recH    = maxBar > 0 ? (m.recebido / maxBar) * 85 : 0
            const projMrr = m.isFuture ? (avgMrr / maxBar) * 85 : 0
            const isNow   = m.month === currentMonth

            return (
              <Tooltip
                key={m.month}
                title={
                  m.isFuture
                    ? `${MONTH_FULL[m.month]}: Projeção ${fmt(avgMrr)} receita / ${fmt(avgCosts)} custos`
                    : `${MONTH_FULL[m.month]}: MRR ${fmt(m.mrr)} | Recebido ${fmt(m.recebido)} | Custos ${fmt(m.despesas + m.fixos)} | Saldo ${fmt(m.saldo)}`
                }
                arrow
              >
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default', gap: 0.3 }}>
                  <Box sx={{ width: '100%', position: 'relative', height: 85 }}>
                    {/* MRR or projection bar (background) */}
                    <Box sx={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: `${Math.max(m.isFuture ? projMrr : mrrH, 3)}px`,
                      bgcolor: m.isFuture
                        ? 'rgba(255,255,255,0.07)'
                        : isNow ? 'rgba(255,144,57,0.3)' : 'rgba(255,144,57,0.15)',
                      borderRadius: '3px 3px 0 0',
                      border: isNow ? '1px solid rgba(255,144,57,0.4)' : 'none',
                    }} />
                    {/* Recebido bar (foreground) */}
                    {!m.isFuture && recH > 0 && (
                      <Box sx={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        height: `${recH}px`,
                        bgcolor: '#00C47A',
                        borderRadius: '3px 3px 0 0',
                        opacity: 0.85,
                      }} />
                    )}
                    {/* Saldo indicator dot */}
                    {!m.isFuture && m.hasDados && (
                      <Box sx={{
                        position: 'absolute', bottom: `${Math.max(mrrH, 3) + 3}px`, left: '50%',
                        transform: 'translateX(-50%)',
                        width: 4, height: 4, borderRadius: '50%',
                        bgcolor: m.saldo >= 0 ? '#00C47A' : '#FF4545',
                      }} />
                    )}
                  </Box>
                  <Typography sx={{
                    fontSize: { xs: '0.42rem', md: '0.52rem' },
                    color: isNow ? 'primary.main' : m.isFuture ? 'rgba(255,255,255,0.2)' : 'text.secondary',
                    fontWeight: isNow ? 800 : 400,
                    fontStyle: m.isFuture ? 'italic' : 'normal',
                  }}>
                    {m.label}
                  </Typography>
                </Box>
              </Tooltip>
            )
          })}
        </Box>
      </Paper>

      {/* ── Projeção anual ────────────────────────────────────────────────── */}
      <Paper sx={{ p: { xs: 1.5, md: 2 }, bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2 }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', mb: 1.5 }}>
          Projeção anual {currentYear} — baseado nos últimos 3 meses
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, mb: 2 }}>
          {[
            { label: 'Receita projetada', value: fmt(projecaoAnual.receita, true), color: '#00C47A' },
            { label: 'Custos projetados',  value: fmt(projecaoAnual.despesas, true), color: '#FF4545' },
            { label: 'Resultado projetado',value: fmt(projecaoAnual.saldo, true),   color: marginColor },
          ].map(({ label, value, color }) => (
            <Box key={label} sx={{ textAlign: 'center', p: 1.2, borderRadius: 1.5, bgcolor: `${color}08`, border: `1px solid ${color}20` }}>
              <Typography sx={{ fontSize: { xs: '0.9rem', md: '1.1rem' }, fontWeight: 900, color, lineHeight: 1 }}>{value}</Typography>
              <Typography sx={{ fontSize: '0.52rem', color: 'text.secondary', mt: 0.3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Progress bar — year completion */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
            <Typography sx={{ fontSize: '0.58rem', color: 'text.secondary' }}>Ano concluído</Typography>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'primary.main' }}>
              {Math.round(((currentMonth + 1) / 12) * 100)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.round(((currentMonth + 1) / 12) * 100)}
            sx={{
              height: 5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)',
              '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #ff9039, #00C47A)', borderRadius: 2 },
            }}
          />
        </Box>
      </Paper>

      {/* ── Break-even ───────────────────────────────────────────────────── */}
      {breakEvenClients > 0 && (
        <Paper sx={{ p: { xs: 1.5, md: 2 }, bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2 }}>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', mb: 1.5 }}>
            Break-even &amp; capacidade
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(4,1fr)' }, gap: 1 }}>
            {[
              { label: 'Ticket médio', value: fmt(avgTicket), color: '#ff9039', icon: '🎫' },
              { label: 'Custo/mês médio', value: fmt(avgCosts), color: '#FF4545', icon: '💸' },
              { label: 'Break-even', value: `${breakEvenClients} clientes`, color: '#FFD700', icon: '⚖️' },
              { label: 'Clientes ativos', value: `${activeClients}`, color: activeClients >= breakEvenClients ? '#00C47A' : '#FF4545', icon: '👥' },
            ].map(({ label, value, color, icon }) => (
              <Box key={label} sx={{ p: 1.2, borderRadius: 1.5, bgcolor: `${color}08`, border: `1px solid ${color}20`, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.9rem', mb: 0.3 }}>{icon}</Typography>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 900, color, lineHeight: 1 }}>{value}</Typography>
                <Typography sx={{ fontSize: '0.52rem', color: 'text.secondary', mt: 0.2, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Typography>
              </Box>
            ))}
          </Box>

          {/* Break-even bar */}
          <Box sx={{ mt: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
              <Typography sx={{ fontSize: '0.58rem', color: 'text.secondary' }}>
                {activeClients >= breakEvenClients
                  ? `✅ ${activeClients - breakEvenClients} clientes acima do break-even`
                  : `⚠️ Faltam ${breakEvenClients - activeClients} clientes para break-even`}
              </Typography>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: activeClients >= breakEvenClients ? '#00C47A' : '#FFD700' }}>
                {activeClients}/{breakEvenClients}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, Math.round((activeClients / Math.max(breakEvenClients, 1)) * 100))}
              sx={{
                height: 5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: activeClients >= breakEvenClients ? '#00C47A' : '#FFD700',
                  borderRadius: 2,
                },
              }}
            />
          </Box>
        </Paper>
      )}

      {/* ── Insights ─────────────────────────────────────────────────────── */}
      {(() => {
        const insights: { icon: string; text: string; color: string }[] = []

        const bestMonth = [...months].filter(m => !m.isFuture && m.saldo > 0).sort((a, b) => b.saldo - a.saldo)[0]
        if (bestMonth) insights.push({ icon: '🏆', color: '#00C47A', text: `Melhor mês YTD: ${MONTH_FULL[bestMonth.month]} com ${fmt(bestMonth.saldo)} de resultado` })

        if (ytdMargin >= 30) insights.push({ icon: '💪', color: '#00C47A', text: `Margem ${ytdMargin}% — acima da meta de 30%. Agência saudável!` })
        else if (ytdMargin > 0) insights.push({ icon: '⚠️', color: '#FFD700', text: `Margem ${ytdMargin}% abaixo de 30%. Revisar custos ou ampliar base de clientes.` })
        else if (ytd.receita === 0) insights.push({ icon: '📝', color: 'rgba(255,255,255,0.4)', text: 'Registre as mensalidades recebidas na aba Recorrência para ver os insights de projeção.' })

        if (projecaoAnual.saldo > 0 && months.some(m => m.isFuture))
          insights.push({ icon: '📈', color: '#3B8EFF', text: `Projeção de ${fmt(projecaoAnual.saldo, true)} de lucro até Dezembro/${currentYear}` })

        if (insights.length === 0) return null
        return (
          <Paper sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', mb: 1 }}>
              💡 Insights
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              {insights.map((ins, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.2, flexShrink: 0 }}>{ins.icon}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: ins.color, lineHeight: 1.5 }}>{ins.text}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        )
      })()}

      <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.18)', textAlign: 'center', mt: 0.5 }}>
        Projeção calculada com base na média dos últimos 3 meses registrados · YTD = Janeiro até {MONTH_FULL[currentMonth]}
      </Typography>
    </Box>
  )
}
