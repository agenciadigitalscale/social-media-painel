import { useMemo, useState, useCallback } from 'react'
import {
  Box, Typography, Paper, LinearProgress, Chip, Button, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Checkbox, MenuItem,
} from '@mui/material'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import FavoriteIcon from '@mui/icons-material/Favorite'
import HistoryIcon from '@mui/icons-material/History'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import LinkIcon from '@mui/icons-material/Link'
import type { Client } from '../types'
import { NAME_MAP, getDisplayName } from '../lib/users'
import { getUserPerms } from '../lib/roles'
import {
  loadOnboardings, upsertOnboarding, removeOnboarding, createOnboardingForClient,
  ensureSteps, currentDay, remainingDays, deadlineDate, progressPct, stepsDone,
  stepStatus, isLate, toggleCheckItem, setStepWaitingClient, computeOnboardingSummary,
  canManageOnboarding, STEP_STATUS_CONFIG,
} from '../lib/onboarding'
import type { OnboardingWithSteps } from '../lib/onboarding'
import {
  loadHealth, loadHealthHistory, classifyHealth, HEALTH_CLASSES, FIELD_LABELS,
} from '../lib/health'
import HealthUpdateModal from './HealthUpdateModal'
import EmptyState from '../shared/ui/EmptyState'

interface Props {
  allClients: Client[]
  currentUser: string
  now: Date
  syncVersion?: number
  onAddClient?: (client: Client) => void
}

type View = 'onboarding' | 'saude' | 'historico'

// ── Helpers visuais ────────────────────────────────────────
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
function fmtDateTime(ts: number) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' ' + new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function KpiCard({ label, value, sub, color = '#3B82F6', index }: {
  label: string; value: string | number; sub?: string; color?: string; index: number
}) {
  return (
    <Box sx={{
      flex: '1 1 150px', minWidth: { xs: 130, md: 150, xl: 190 },
      background: 'rgba(13,13,13,0.82)',
      backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
      border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px',
      p: { xs: 1.5, md: 2, xl: 2.5 },
      display: 'flex', flexDirection: 'column', gap: 0.4,
      boxShadow: '0 1px 2px rgba(0,0,0,0.4),0 4px 16px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.055)',
      animation: `obIn 0.4s cubic-bezier(0.16,1,0.3,1) ${index * 55}ms both`,
      '@keyframes obIn': {
        from: { opacity: 0, transform: 'scale(0.93) translateY(6px)' },
        to:   { opacity: 1, transform: 'scale(1) translateY(0)' },
      },
    }}>
      <Typography sx={{
        fontSize: { md: '0.58rem', xl: '0.68rem' }, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.35)',
      }}>
        {label}
      </Typography>
      <Typography sx={{
        fontSize: { xs: '1.4rem', md: '1.7rem', xl: '2.1rem' }, fontWeight: 900,
        letterSpacing: '-0.03em', lineHeight: 1.05, color, textShadow: `0 0 24px ${color}44`,
      }}>
        {value}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: { md: '0.58rem', xl: '0.68rem' }, color: 'rgba(255,255,255,0.35)' }}>
          {sub}
        </Typography>
      )}
    </Box>
  )
}

function HealthDot({ score, size = 34 }: { score: number; size?: number }) {
  const cls = HEALTH_CLASSES[classifyHealth(score)]
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <Box sx={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: `conic-gradient(${cls.color} 0deg ${Math.round((score / 100) * 360)}deg, rgba(255,255,255,0.07) ${Math.round((score / 100) * 360)}deg 360deg)`,
      }} />
      <Box sx={{
        position: 'absolute', inset: 3.5, borderRadius: '50%',
        background: 'rgba(10,10,10,0.98)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Typography sx={{ fontSize: size >= 40 ? '0.75rem' : '0.62rem', fontWeight: 900, color: cls.color, letterSpacing: '-0.02em' }}>
          {score}
        </Typography>
      </Box>
    </Box>
  )
}

// ── Componente principal ───────────────────────────────────
export default function OnboardingTab({ allClients, currentUser, now, syncVersion = 0, onAddClient }: Props) {
  const [view, setView] = useState<View>('onboarding')
  const [version, setVersion] = useState(0)      // força re-leitura após mutações
  const [detailId, setDetailId] = useState<string | null>(null)
  const [healthClient, setHealthClient] = useState<string | null>(null)
  const [startOpen, setStartOpen] = useState(false)
  const [startClient, setStartClient] = useState('')
  const [startMode, setStartMode] = useState<'novo' | 'existente'>('novo')
  const [newName, setNewName] = useState('')
  const [newSegment, setNewSegment] = useState('')
  const [newPosts, setNewPosts] = useState(8)
  const [newReels, setNewReels] = useState(4)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const perms = getUserPerms(currentUser)
  // Robson comanda o onboarding: acesso total (excluir/alterar) mesmo sem canDelete do cargo.
  const canManage = perms.canDelete || canManageOnboarding(currentUser)
  const bump = useCallback(() => setVersion(v => v + 1), [])

  const onboardings = useMemo(
    () => loadOnboardings().map(ensureSteps),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, syncVersion, now],
  )

  const summary = useMemo(
    () => computeOnboardingSummary(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, syncVersion, now],
  )

  const healthMap = useMemo(
    () => loadHealth(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, syncVersion],
  )

  // Ordenação: atrasados → próximos do vencimento → mais recentes
  const active = useMemo(() => {
    return onboardings
      .filter(o => o.status === 'ativo')
      .sort((a, b) => {
        const aLate = isLate(a, now) ? 0 : 1
        const bLate = isLate(b, now) ? 0 : 1
        if (aLate !== bLate) return aLate - bLate
        const aRem = remainingDays(a, now)
        const bRem = remainingDays(b, now)
        if (aRem !== bRem) return aRem - bRem
        return b.startDate - a.startDate
      })
  }, [onboardings, now])

  const completed = useMemo(
    () => onboardings.filter(o => o.status === 'concluido').sort((a, b) => (b.completedDate ?? 0) - (a.completedDate ?? 0)),
    [onboardings],
  )

  const detail = detailId ? onboardings.find(o => o.id === detailId) ?? null : null

  const clientsWithoutOnboarding = useMemo(
    () => allClients.filter(c => !onboardings.some(o => o.clientName === c.name && o.status === 'ativo')),
    [allClients, onboardings],
  )

  // ── Saúde: linhas ordenadas por criticidade ──
  const healthRows = useMemo(() => {
    return allClients
      .map(c => ({ client: c, rec: healthMap[c.name] ?? null }))
      .sort((a, b) => (a.rec?.score ?? 101) - (b.rec?.score ?? 101))
  }, [allClients, healthMap])

  const healthHistory = useMemo(
    () => loadHealthHistory(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, syncVersion],
  )

  // ── Handlers ──
  const handleToggle = (ob: OnboardingWithSteps, stepId: string, itemId: string) => {
    upsertOnboarding(toggleCheckItem(ob, stepId, itemId, currentUser))
    bump()
  }

  const handleWaiting = (ob: OnboardingWithSteps, stepId: string, waiting: boolean) => {
    upsertOnboarding(setStepWaitingClient(ob, stepId, waiting, currentUser))
    bump()
  }

  const newNameTrimmed = newName.trim()
  const newNameTaken = !!newNameTrimmed && allClients.some(c => c.name.toLowerCase() === newNameTrimmed.toLowerCase())

  const handleStart = () => {
    if (startMode === 'novo') {
      if (!newNameTrimmed || newNameTaken || !onAddClient) return
      // O App cria o onboarding + Health Score 100 automaticamente no addClient
      onAddClient({
        name: newNameTrimmed,
        postsPerMonth: newPosts,
        reelsPerMonth: newReels,
        subnicho: newSegment.trim() || undefined,
      })
      setNewName(''); setNewSegment(''); setNewPosts(8); setNewReels(4)
    } else {
      if (!startClient) return
      createOnboardingForClient(startClient, currentUser)
      setStartClient('')
    }
    setStartOpen(false)
    bump()
  }

  const viewPills: Array<{ key: View; label: string; icon: JSX.Element; color: string }> = [
    { key: 'onboarding', label: 'Onboarding',       icon: <RocketLaunchIcon sx={{ fontSize: 14 }} />, color: '#3B82F6' },
    { key: 'saude',      label: 'Saúde do Cliente', icon: <FavoriteIcon sx={{ fontSize: 14 }} />,     color: '#FB7185' },
    { key: 'historico',  label: 'Histórico',        icon: <HistoryIcon sx={{ fontSize: 14 }} />,      color: '#60A5FA' },
  ]

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3.5 }, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 2.5, xl: 3 } }}>
      {/* ── Header + pills ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontSize: { md: '0.6rem', xl: '0.72rem' }, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3B82F6', mb: 0.4 }}>
            Onboarding · Saúde do Cliente
          </Typography>
          <Typography sx={{ fontWeight: 800, letterSpacing: '-0.025em', fontSize: { xs: '1.05rem', md: '1.25rem', xl: '1.5rem' }, color: 'rgba(255,255,255,0.92)' }}>
            {view === 'onboarding' ? 'Clientes em implantação — 15 dias' : view === 'saude' ? 'Satisfação e retenção da base' : 'Histórico de onboarding e saúde'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
          {viewPills.map(p => {
            const activePill = view === p.key
            return (
              <Box key={p.key} onClick={() => setView(p.key)} sx={{
                display: 'flex', alignItems: 'center', gap: 0.7,
                px: { xs: 1.2, md: 1.6 }, py: 0.7, borderRadius: 99, cursor: 'pointer',
                bgcolor: activePill ? `${p.color}16` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${activePill ? `${p.color}50` : 'rgba(255,255,255,0.07)'}`,
                color: activePill ? p.color : 'rgba(255,255,255,0.45)',
                boxShadow: activePill ? `0 0 12px ${p.color}25` : 'none',
                transition: 'all 0.2s ease',
                '&:hover': { borderColor: `${p.color}40`, color: p.color },
              }}>
                {p.icon}
                <Typography sx={{ fontSize: { xs: '0.68rem', xl: '0.78rem' }, fontWeight: activePill ? 700 : 500 }}>
                  {p.label}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* ════════ VIEW: ONBOARDING ════════ */}
      {view === 'onboarding' && (
        <>
          {/* KPI cards */}
          <Box sx={{ display: 'flex', gap: { xs: 1.2, md: 1.8, xl: 2.2 }, flexWrap: 'wrap' }}>
            <KpiCard index={0} label="Em onboarding"       value={summary.active}   color="#3B82F6" />
            <KpiCard index={1} label="Dentro do prazo"     value={summary.onTime}   color="#00C47A" />
            <KpiCard index={2} label="Atrasados"           value={summary.late}     color={summary.late > 0 ? '#FF4545' : '#00C47A'} />
            <KpiCard index={3} label="Concluídos no mês"   value={summary.completedThisMonth} color="#60A5FA" />
            <KpiCard index={4} label="Tempo médio"         value={summary.avgDays != null ? `${summary.avgDays}d` : '—'} sub="dos concluídos" color="#C084FC" />
            <KpiCard index={5} label="Taxa de conclusão"   value={summary.completionRate > 0 || completed.length > 0 ? `${summary.completionRate}%` : '—'} sub="dentro do prazo" color="#F59E0B" />
          </Box>

          {/* Ações */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />}
              onClick={() => setStartOpen(true)}
              sx={{
                background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
                color: '#000', fontWeight: 800, borderRadius: 2.5, px: 2,
                boxShadow: '0 6px 20px rgba(59,130,246,0.32)',
                '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
                '&.Mui-disabled': { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' },
              }}
            >
              Iniciar onboarding
            </Button>
          </Box>

          {/* Lista de onboardings ativos */}
          {active.length === 0 ? (
            <Paper sx={{ border: '1px dashed rgba(59,130,246,0.2)', bgcolor: 'transparent' }}>
              <EmptyState
                icon={<span>🚀</span>}
                title="Nenhum cliente em onboarding"
                subtitle="Novos clientes cadastrados entram aqui automaticamente com o checklist de 15 dias."
              />
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {active.map((ob, idx) => {
                const late = isLate(ob, now)
                const day = currentDay(ob, now)
                const rem = remainingDays(ob, now)
                const pct = progressPct(ob)
                const done = stepsDone(ob)
                const respInfo = NAME_MAP[ob.generalResponsible]
                const health = healthMap[ob.clientName]
                return (
                  <Paper
                    key={ob.id}
                    onClick={() => setDetailId(ob.id)}
                    sx={{
                      p: { xs: 1.4, md: 1.8, xl: 2.2 }, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: { xs: 1.2, md: 2 }, flexWrap: 'wrap',
                      border: `1px solid ${late ? 'rgba(255,69,69,0.25)' : 'rgba(255,255,255,0.06)'}`,
                      bgcolor: late ? 'rgba(255,69,69,0.03)' : undefined,
                      transition: 'all 0.2s ease',
                      animation: `obIn 0.35s cubic-bezier(0.16,1,0.3,1) ${idx * 45}ms both`,
                      '@keyframes obIn': {
                        from: { opacity: 0, transform: 'translateY(6px)' },
                        to:   { opacity: 1, transform: 'translateY(0)' },
                      },
                      '&:hover': { transform: 'translateY(-1px)', borderColor: 'rgba(59,130,246,0.35)' },
                    }}
                  >
                    {/* Cliente */}
                    <Box sx={{ flex: '1 1 180px', minWidth: 150 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <Typography sx={{ fontSize: { xs: '0.8rem', xl: '0.92rem' }, fontWeight: 700, color: 'rgba(255,255,255,0.92)' }} noWrap>
                          {ob.clientName}
                        </Typography>
                        {late && (
                          <Chip label="ATRASADO" size="small" sx={{
                            height: 16, fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.06em',
                            bgcolor: 'rgba(255,69,69,0.15)', color: '#FF4545', border: '1px solid rgba(255,69,69,0.35)',
                          }} />
                        )}
                      </Box>
                      <Typography sx={{ fontSize: { xs: '0.58rem', xl: '0.66rem' }, color: 'rgba(255,255,255,0.4)', mt: 0.2 }}>
                        {respInfo ? `${respInfo.emoji} ${getDisplayName(ob.generalResponsible)}` : ob.generalResponsible}
                        {' · início '}{fmtDate(ob.startDate)}
                      </Typography>
                    </Box>

                    {/* Dia atual / prazo */}
                    <Box sx={{ textAlign: 'center', minWidth: 64 }}>
                      <Typography sx={{ fontSize: { xs: '0.85rem', xl: '1rem' }, fontWeight: 800, color: late ? '#FF4545' : '#3B82F6', lineHeight: 1 }}>
                        Dia {Math.min(day, 99)}
                      </Typography>
                      <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)' }}>
                        {rem >= 0 ? `${rem}d restantes` : `${-rem}d além do prazo`}
                      </Typography>
                    </Box>

                    {/* Progresso */}
                    <Box sx={{ flex: '1 1 160px', minWidth: 140 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                        <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)' }}>
                          {done} de {ob.steps.length} etapas
                        </Typography>
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: pct === 100 ? '#00C47A' : late ? '#FF4545' : '#3B82F6' }}>
                          {pct}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate" value={pct}
                        sx={{
                          height: { xs: 5, xl: 7 }, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                            background: pct === 100
                              ? '#00C47A'
                              : late ? 'linear-gradient(90deg,#FF4545,#60A5FA)' : 'linear-gradient(90deg,#3B82F6,#06B6D4)',
                          },
                        }}
                      />
                    </Box>

                    {/* Health score */}
                    {health && (
                      <Tooltip title={`Health Score — ${HEALTH_CLASSES[classifyHealth(health.score)].label}`} placement="top">
                        <Box><HealthDot score={health.score} /></Box>
                      </Tooltip>
                    )}
                  </Paper>
                )
              })}
            </Box>
          )}
        </>
      )}

      {/* ════════ VIEW: SAÚDE DO CLIENTE ════════ */}
      {view === 'saude' && (
        <>
          {/* KPIs de satisfação */}
          {(() => {
            const records = Object.values(healthMap)
            const avg = records.length > 0 ? Math.round(records.reduce((s, r) => s + r.score, 0) / records.length) : null
            const count = (k: ReturnType<typeof classifyHealth>) => records.filter(r => classifyHealth(r.score) === k).length
            return (
              <Box sx={{ display: 'flex', gap: { xs: 1.2, md: 1.8, xl: 2.2 }, flexWrap: 'wrap' }}>
                <KpiCard index={0} label="Média geral"  value={avg != null ? `${avg}` : '—'} sub={avg != null ? HEALTH_CLASSES[classifyHealth(avg)].label : 'sem avaliações'} color={avg != null ? HEALTH_CLASSES[classifyHealth(avg)].color : '#A1A1AA'} />
                <KpiCard index={1} label="Excelentes"   value={count('excelente')} color="#00C47A" />
                <KpiCard index={2} label="Atenção"      value={count('atencao')}   color="#F59E0B" />
                <KpiCard index={3} label="Risco"        value={count('risco')}     color="#60A5FA" />
                <KpiCard index={4} label="Críticos"     value={count('critico')}   color="#FF4545" />
              </Box>
            )
          })()}

          {/* Relatório de satisfação — mais críticos primeiro */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
            {healthRows.map(({ client, rec }, idx) => {
              const cls = rec ? HEALTH_CLASSES[classifyHealth(rec.score)] : null
              const staleDays = rec?.updatedAt ? Math.floor((now.getTime() - rec.updatedAt) / 86_400_000) : null
              return (
                <Paper key={client.name} sx={{
                  p: { xs: 1.3, md: 1.6, xl: 2 },
                  display: 'flex', alignItems: 'center', gap: { xs: 1.2, md: 1.8 }, flexWrap: 'wrap',
                  border: `1px solid ${cls && (classifyHealth(rec!.score) === 'critico' || classifyHealth(rec!.score) === 'risco') ? `${cls.color}30` : 'rgba(255,255,255,0.06)'}`,
                  animation: `obIn 0.3s ease ${idx * 30}ms both`,
                  '@keyframes obIn': {
                    from: { opacity: 0, transform: 'translateY(5px)' },
                    to:   { opacity: 1, transform: 'translateY(0)' },
                  },
                }}>
                  {rec ? <HealthDot score={rec.score} size={40} /> : (
                    <Box sx={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      border: '1px dashed rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)' }}>—</Typography>
                    </Box>
                  )}

                  <Box sx={{ flex: '1 1 160px', minWidth: 130 }}>
                    <Typography sx={{ fontSize: { xs: '0.78rem', xl: '0.9rem' }, fontWeight: 700 }} noWrap>{client.name}</Typography>
                    <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)' }}>
                      {cls ? `${cls.emoji} ${cls.label}` : 'Sem avaliação'}
                      {rec?.renewalPotential ? ` · Renovação: ${rec.renewalPotential}` : ''}
                    </Typography>
                  </Box>

                  <Box sx={{ minWidth: 110, display: { xs: 'none', md: 'block' } }}>
                    <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                      Última atualização
                    </Typography>
                    <Typography sx={{ fontSize: '0.66rem', color: staleDays != null && staleDays > 30 ? '#60A5FA' : 'rgba(255,255,255,0.55)' }}>
                      {rec?.updatedAt ? `${fmtDate(rec.updatedAt)}${staleDays != null && staleDays > 0 ? ` · há ${staleDays}d` : ''}` : '—'}
                      {rec?.updatedBy ? ` · ${getDisplayName(rec.updatedBy)}` : ''}
                    </Typography>
                  </Box>

                  {rec?.notes && (
                    <Tooltip title={rec.notes} placement="top">
                      <Typography sx={{
                        flex: '1 1 140px', minWidth: 100, fontSize: '0.62rem', fontStyle: 'italic',
                        color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        display: { xs: 'none', lg: 'block' },
                      }}>
                        “{rec.notes}”
                      </Typography>
                    </Tooltip>
                  )}

                  <Button
                    size="small"
                    onClick={() => setHealthClient(client.name)}
                    sx={{
                      fontSize: '0.62rem', fontWeight: 700, borderRadius: 2, px: 1.4, flexShrink: 0,
                      color: '#FB7185', bgcolor: 'rgba(251,113,133,0.08)',
                      border: '1px solid rgba(251,113,133,0.25)',
                      '&:hover': { bgcolor: 'rgba(251,113,133,0.16)' },
                    }}
                  >
                    Atualizar Satisfação
                  </Button>
                </Paper>
              )
            })}
          </Box>
        </>
      )}

      {/* ════════ VIEW: HISTÓRICO ════════ */}
      {view === 'historico' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
          {/* Onboardings concluídos */}
          <Paper sx={{ p: { xs: 1.5, md: 2 } }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#3B82F6', mb: 1.2 }}>
              🚀 Onboardings concluídos
            </Typography>
            {completed.length === 0 ? (
              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', py: 2, textAlign: 'center' }}>
                Nenhum onboarding concluído ainda
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7 }}>
                {completed.map(ob => {
                  const days = ob.completedDate ? Math.max(1, Math.ceil((ob.completedDate - ob.startDate) / 86_400_000)) : null
                  const onDeadline = days != null && days <= ob.deadlineDays
                  return (
                    <Box key={ob.id} onClick={() => setDetailId(ob.id)} sx={{
                      p: 1.2, borderRadius: 2, cursor: 'pointer',
                      bgcolor: 'rgba(0,196,122,0.04)', border: '1px solid rgba(0,196,122,0.15)',
                      display: 'flex', alignItems: 'center', gap: 1,
                      transition: 'all 0.2s ease',
                      '&:hover': { borderColor: 'rgba(0,196,122,0.35)', transform: 'translateY(-1px)' },
                    }}>
                      <CheckCircleIcon sx={{ fontSize: 16, color: '#00C47A', flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.74rem', fontWeight: 700 }} noWrap>{ob.clientName}</Typography>
                        <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.4)' }}>
                          {fmtDate(ob.startDate)} → {ob.completedDate ? fmtDate(ob.completedDate) : '—'}
                          {days != null ? ` · ${days} dia${days > 1 ? 's' : ''}` : ''}
                        </Typography>
                      </Box>
                      <Chip
                        label={onDeadline ? 'No prazo' : 'Fora do prazo'}
                        size="small"
                        sx={{
                          height: 18, fontSize: '0.54rem', fontWeight: 700,
                          bgcolor: onDeadline ? 'rgba(0,196,122,0.12)' : 'rgba(96,165,250,0.12)',
                          color: onDeadline ? '#00C47A' : '#60A5FA',
                          border: `1px solid ${onDeadline ? 'rgba(0,196,122,0.3)' : 'rgba(96,165,250,0.3)'}`,
                        }}
                      />
                    </Box>
                  )
                })}
              </Box>
            )}
          </Paper>

          {/* Histórico de saúde */}
          <Paper sx={{ p: { xs: 1.5, md: 2 } }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#FB7185', mb: 1.2 }}>
              ❤️ Histórico de saúde do cliente
            </Typography>
            {healthHistory.length === 0 ? (
              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', py: 2, textAlign: 'center' }}>
                Nenhuma atualização registrada
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7, maxHeight: 520, overflow: 'auto', pr: 0.5 }}>
                {healthHistory.slice(0, 60).map(h => {
                  const cls = HEALTH_CLASSES[classifyHealth(h.newScore)]
                  const delta = h.oldScore != null ? h.newScore - h.oldScore : null
                  return (
                    <Box key={h.id} sx={{
                      p: 1.2, borderRadius: 2,
                      bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, flex: 1 }} noWrap>{h.clientName}</Typography>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: cls.color }}>
                          {h.oldScore != null ? `${h.oldScore} → ` : ''}{h.newScore}
                        </Typography>
                        {delta != null && delta !== 0 && (
                          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: delta > 0 ? '#00C47A' : '#FF4545' }}>
                            {delta > 0 ? '+' : ''}{delta}
                          </Typography>
                        )}
                      </Box>
                      <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.4)', mt: 0.3 }}>
                        {fmtDateTime(h.ts)} · {getDisplayName(h.updatedBy)}
                        {h.changedFields.length > 0 ? ` · ${h.changedFields.map(f => FIELD_LABELS[f] ?? f).join(', ')}` : ''}
                      </Typography>
                      {h.notes && (
                        <Typography sx={{ fontSize: '0.6rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', mt: 0.3 }}>
                          “{h.notes}”
                        </Typography>
                      )}
                    </Box>
                  )
                })}
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* ════════ DIALOG: DETALHE DO ONBOARDING ════════ */}
      {detail && (
        <Dialog open onClose={() => setDetailId(null)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, pb: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>{detail.clientName}</Typography>
                {detail.status === 'concluido' ? (
                  <Chip label="✅ Onboarding Concluído — Operação Ativa" size="small" sx={{
                    height: 20, fontSize: '0.58rem', fontWeight: 700,
                    bgcolor: 'rgba(0,196,122,0.12)', color: '#00C47A', border: '1px solid rgba(0,196,122,0.3)',
                  }} />
                ) : isLate(detail, now) ? (
                  <Chip label="🚨 Atrasado" size="small" sx={{
                    height: 20, fontSize: '0.58rem', fontWeight: 700,
                    bgcolor: 'rgba(255,69,69,0.12)', color: '#FF4545', border: '1px solid rgba(255,69,69,0.3)',
                  }} />
                ) : (
                  <Chip label="🚀 Em Onboarding" size="small" sx={{
                    height: 20, fontSize: '0.58rem', fontWeight: 700,
                    bgcolor: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)',
                  }} />
                )}
              </Box>
              <Typography sx={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.4)', mt: 0.4 }}>
                {detail.segment ? `${detail.segment} · ` : ''}
                Início {fmtDate(detail.startDate)} · prazo máx. {fmtDate(deadlineDate(detail).getTime())} ({detail.deadlineDays} dias)
                {detail.status === 'ativo' && ` · Dia ${currentDay(detail, now)} · ${remainingDays(detail, now) >= 0 ? `${remainingDays(detail, now)}d restantes` : `${-remainingDays(detail, now)}d além do prazo`}`}
                {' · Responsável geral: '}
                {NAME_MAP[detail.generalResponsible] ? `${NAME_MAP[detail.generalResponsible].emoji} ${getDisplayName(detail.generalResponsible)}` : detail.generalResponsible}
              </Typography>
            </Box>
            {canManage && (
              <Tooltip title="Excluir onboarding" placement="top">
                <IconButton size="small" onClick={() => setDeleteConfirm(detail.id)} sx={{ color: 'rgba(255,69,69,0.6)' }}>
                  <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
            )}
            <IconButton size="small" onClick={() => setDetailId(null)} sx={{ color: 'rgba(255,255,255,0.4)' }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Barra de progresso automática */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)' }}>
                  Progresso automático
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: progressPct(detail) === 100 ? '#00C47A' : '#3B82F6' }}>
                  {progressPct(detail)}% · {stepsDone(detail)} de {detail.steps.length} etapas concluídas
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate" value={progressPct(detail)}
                sx={{
                  height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.06)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    background: progressPct(detail) === 100 ? '#00C47A' : 'linear-gradient(90deg,#3B82F6,#06B6D4)',
                  },
                }}
              />
            </Box>

            {/* Etapas */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {detail.steps.map(step => {
                const st = stepStatus(step, detail, now)
                const cfg = STEP_STATUS_CONFIG[st]
                const doneCount = step.checklist.filter(c => c.completed).length
                const respInfo = step.responsibleKey ? NAME_MAP[step.responsibleKey] : null
                return (
                  <Box key={step.id} sx={{
                    borderRadius: 2.5, overflow: 'hidden',
                    border: `1px solid ${cfg.color}25`,
                    bgcolor: `${cfg.color}05`,
                  }}>
                    {/* Header da etapa */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1 }}>
                      <Typography sx={{ fontSize: '0.95rem', lineHeight: 1 }}>{step.emoji}</Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.76rem', fontWeight: 700 }} noWrap>
                          {step.order}. {step.title}
                        </Typography>
                        <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.4)' }}>
                          {respInfo ? `${respInfo.emoji} ` : ''}{step.responsible}
                          {' · Dia '}{step.startDay}{step.deadlineDay !== step.startDay ? `–${step.deadlineDay}` : ''}
                          {' · '}{doneCount}/{step.checklist.length}
                        </Typography>
                      </Box>
                      {st !== 'concluida' && detail.status === 'ativo' && (
                        <Tooltip title={step.waitingClient ? 'Retomar pela equipe' : 'Marcar como aguardando cliente'} placement="top">
                          <Box
                            onClick={() => handleWaiting(detail, step.id, !step.waitingClient)}
                            sx={{
                              px: 0.9, py: 0.3, borderRadius: '6px', cursor: 'pointer',
                              fontSize: '0.54rem', fontWeight: 700,
                              color: step.waitingClient ? '#60A5FA' : 'rgba(255,255,255,0.3)',
                              bgcolor: step.waitingClient ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${step.waitingClient ? 'rgba(96,165,250,0.35)' : 'rgba(255,255,255,0.08)'}`,
                              transition: 'all 0.15s ease',
                              '&:hover': { color: '#60A5FA', borderColor: 'rgba(96,165,250,0.35)' },
                            }}
                          >
                            💬 Cliente
                          </Box>
                        </Tooltip>
                      )}
                      <Chip label={`${cfg.emoji} ${cfg.label}`} size="small" sx={{
                        height: 20, fontSize: '0.56rem', fontWeight: 700,
                        bgcolor: `${cfg.color}14`, color: cfg.color, border: `1px solid ${cfg.color}35`,
                        flexShrink: 0,
                      }} />
                    </Box>

                    {/* Checklist */}
                    <Box sx={{ px: 1, pb: 0.8, display: 'flex', flexDirection: 'column' }}>
                      {step.checklist.map(item => (
                        <Box
                          key={item.id}
                          onClick={() => handleToggle(detail, step.id, item.id)}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 0.4,
                            borderRadius: 1.5, cursor: 'pointer', pr: 1,
                            transition: 'background 0.15s ease',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                          }}
                        >
                          <Checkbox
                            size="small" checked={item.completed}
                            sx={{
                              py: 0.4, pointerEvents: 'none',
                              color: 'rgba(255,255,255,0.2)',
                              '&.Mui-checked': { color: '#00C47A' },
                            }}
                          />
                          <Typography sx={{
                            flex: 1, fontSize: '0.7rem',
                            color: item.completed ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.75)',
                            textDecoration: item.completed ? 'line-through' : 'none',
                          }}>
                            {item.title}
                          </Typography>
                          {item.completed && item.completedAt && (
                            <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.28)', flexShrink: 0 }}>
                              {fmtDateTime(item.completedAt)}{item.completedBy ? ` · ${getDisplayName(item.completedBy)}` : ''}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )
              })}
            </Box>

            {/* Observações */}
            <TextField
              label="Observações"
              multiline minRows={2} fullWidth size="small"
              defaultValue={detail.notes}
              onBlur={e => {
                if (e.target.value !== detail.notes) {
                  upsertOnboarding({ ...detail, notes: e.target.value, updatedAt: Date.now() })
                  bump()
                }
              }}
              placeholder="Anotações gerais do onboarding…"
            />

            {/* Arquivos relacionados */}
            <Box>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', mb: 0.6 }}>
                Arquivos relacionados
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {detail.files.map((f, fi) => (
                  <Box key={fi} sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <LinkIcon sx={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }} />
                    <Typography
                      component="a" href={f} target="_blank" rel="noopener noreferrer"
                      sx={{ flex: 1, fontSize: '0.66rem', color: '#60A5FA', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}
                    >
                      {f}
                    </Typography>
                    <IconButton size="small" onClick={() => {
                      upsertOnboarding({ ...detail, files: detail.files.filter((_, i) => i !== fi), updatedAt: Date.now() })
                      bump()
                    }} sx={{ color: 'rgba(255,69,69,0.5)', p: 0.3 }}>
                      <CloseIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Box>
                ))}
                <TextField
                  size="small" fullWidth placeholder="Colar link e pressionar Enter (Drive, contrato, briefing…)"
                  onKeyDown={e => {
                    const input = e.target as HTMLInputElement
                    if (e.key === 'Enter' && input.value.trim()) {
                      upsertOnboarding({ ...detail, files: [...detail.files, input.value.trim()], updatedAt: Date.now() })
                      input.value = ''
                      bump()
                    }
                  }}
                  sx={{ '& input': { fontSize: '0.68rem' } }}
                />
              </Box>
            </Box>

            {/* Timeline / histórico */}
            <Box>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', mb: 0.6 }}>
                Histórico
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, maxHeight: 200, overflow: 'auto', pr: 0.5 }}>
                {detail.history.slice(0, 40).map((h, hi) => (
                  <Box key={hi} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.8, py: 0.2 }}>
                    <Typography sx={{ fontSize: '0.54rem', color: 'rgba(255,255,255,0.3)', flexShrink: 0, minWidth: 76 }}>
                      {fmtDateTime(h.ts)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.65)' }}>
                      <b>{getDisplayName(h.user)}</b>
                      {h.stepTitle !== '—' ? ` · ${h.stepTitle}` : ''} — {h.action}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              size="small"
              startIcon={<FavoriteIcon sx={{ fontSize: 13 }} />}
              onClick={() => setHealthClient(detail.clientName)}
              sx={{ color: '#FB7185', fontWeight: 700, fontSize: '0.66rem' }}
            >
              Atualizar Satisfação
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button onClick={() => setDetailId(null)} sx={{ color: 'rgba(255,255,255,0.5)' }}>Fechar</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* ════════ DIALOG: INICIAR ONBOARDING ════════ */}
      <Dialog open={startOpen} onClose={() => setStartOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.95rem' }}>🚀 Iniciar onboarding</Typography>
          <Typography sx={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.4)' }}>
            Cria o checklist completo de 15 dias com etapas e responsáveis automáticos
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Modo: cliente novo (padrão) ou já existente */}
          <Box sx={{ display: 'flex', gap: 0.7 }}>
            {([['novo', '✨ Cliente novo'], ['existente', 'Cliente existente']] as const).map(([mode, label]) => {
              const activeMode = startMode === mode
              return (
                <Box key={mode} onClick={() => setStartMode(mode)} sx={{
                  flex: 1, textAlign: 'center', px: 1, py: 0.7, borderRadius: 2, cursor: 'pointer',
                  fontSize: '0.68rem', fontWeight: activeMode ? 700 : 500,
                  color: activeMode ? '#3B82F6' : 'rgba(255,255,255,0.45)',
                  bgcolor: activeMode ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${activeMode ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  transition: 'all 0.15s ease',
                  '&:hover': { borderColor: 'rgba(59,130,246,0.3)' },
                }}>
                  {label}
                </Box>
              )
            })}
          </Box>

          {startMode === 'novo' ? (
            <>
              <TextField
                fullWidth size="small" label="Nome do cliente" autoFocus
                value={newName} onChange={e => setNewName(e.target.value)}
                error={newNameTaken}
                helperText={newNameTaken ? 'Já existe um cliente com esse nome' : undefined}
              />
              <TextField
                fullWidth size="small" label="Segmento (opcional)"
                value={newSegment} onChange={e => setNewSegment(e.target.value)}
                placeholder="Ex.: Restaurante, Elevadores, Clínica…"
              />
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  fullWidth size="small" label="Posts/mês" type="number"
                  value={newPosts} onChange={e => setNewPosts(Math.max(0, Number(e.target.value)))}
                  inputProps={{ min: 0 }}
                />
                <TextField
                  fullWidth size="small" label="Reels/mês" type="number"
                  value={newReels} onChange={e => setNewReels(Math.max(0, Number(e.target.value)))}
                  inputProps={{ min: 0 }}
                />
              </Box>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)' }}>
                O cliente é cadastrado na agência e entra direto no onboarding com Health Score 100
              </Typography>
            </>
          ) : (
            <TextField
              select fullWidth size="small" label="Cliente"
              value={startClient} onChange={e => setStartClient(e.target.value)}
            >
              {clientsWithoutOnboarding.map(c => (
                <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
              ))}
            </TextField>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setStartOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={startMode === 'novo' ? (!newNameTrimmed || newNameTaken || !onAddClient) : !startClient}
            onClick={handleStart}
            sx={{
              background: 'linear-gradient(135deg, #3B82F6, #06B6D4)', color: '#fff', fontWeight: 800,
              '&.Mui-disabled': { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' },
            }}
          >
            {startMode === 'novo' ? 'Cadastrar e iniciar' : 'Iniciar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════════ DIALOG: CONFIRMAR EXCLUSÃO ════════ */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningAmberIcon sx={{ fontSize: 18, color: '#FF4545' }} />
            <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>Excluir onboarding?</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>
            O checklist e o histórico deste onboarding serão removidos. Essa ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setDeleteConfirm(null)} sx={{ color: 'rgba(255,255,255,0.5)' }}>Cancelar</Button>
          <Button
            onClick={() => {
              if (deleteConfirm) removeOnboarding(deleteConfirm)
              setDeleteConfirm(null)
              setDetailId(null)
              bump()
            }}
            sx={{
              background: 'rgba(255,69,69,0.12)', border: '1px solid rgba(255,69,69,0.3)', color: '#FF4545',
              '&:hover': { background: 'rgba(255,69,69,0.22)' },
            }}
          >
            Excluir
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════════ MODAL: ATUALIZAR SATISFAÇÃO ════════ */}
      <HealthUpdateModal
        clientName={healthClient}
        currentUser={currentUser}
        onClose={() => setHealthClient(null)}
        onSaved={bump}
      />
    </Box>
  )
}
