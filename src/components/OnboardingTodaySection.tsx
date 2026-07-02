import { useMemo, useState, useCallback } from 'react'
import { Box, Typography, Paper, Checkbox, Chip } from '@mui/material'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import {
  onboardingTasksForUser, loadOnboardings, ensureSteps, toggleCheckItem, upsertOnboarding,
} from '../lib/onboarding'

interface Props {
  currentUser: string
  now: Date
  onTabChange?: (tab: number) => void
}

/** Tarefas de onboarding do dia (integração Meu Dia) — só renderiza se houver pendências. */
export default function OnboardingTodaySection({ currentUser, now, onTabChange }: Props) {
  const [version, setVersion] = useState(0)

  const tasks = useMemo(
    () => onboardingTasksForUser(currentUser, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, now, version],
  )

  const handleToggle = useCallback((onboardingId: string, stepId: string, itemId: string) => {
    const raw = loadOnboardings().find(o => o.id === onboardingId)
    if (!raw) return
    upsertOnboarding(toggleCheckItem(ensureSteps(raw), stepId, itemId, currentUser))
    setVersion(v => v + 1)
  }, [currentUser])

  if (tasks.length === 0) return null

  return (
    <Paper sx={{ p: { xs: 1.4, md: 1.8 }, mb: 2, border: '1px solid rgba(255,144,57,0.2)', bgcolor: 'rgba(255,144,57,0.03)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
        <RocketLaunchIcon sx={{ fontSize: 15, color: '#ff9039' }} />
        <Typography
          onClick={() => onTabChange?.(22)}
          sx={{
            fontSize: '0.72rem', fontWeight: 700, color: '#ff9039',
            textTransform: 'uppercase', letterSpacing: 0.5, flex: 1,
            cursor: onTabChange ? 'pointer' : 'default',
            '&:hover': { textDecoration: onTabChange ? 'underline' : 'none' },
          }}
        >
          Onboarding — tarefas de hoje
        </Typography>
        <Chip label={tasks.length} size="small" sx={{
          height: 16, fontSize: '0.55rem', fontWeight: 700,
          bgcolor: 'rgba(255,144,57,0.14)', color: '#ff9039',
        }} />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
        {tasks.slice(0, 8).map(t => (
          <Box
            key={`${t.onboardingId}_${t.itemId}`}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.4,
              borderRadius: 1.5, pr: 1,
              bgcolor: t.dueLabel === 'Atrasado' ? 'rgba(255,69,69,0.04)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${t.dueLabel === 'Atrasado' ? 'rgba(255,69,69,0.15)' : 'rgba(255,255,255,0.04)'}`,
              transition: 'all 0.15s ease',
              '&:hover': { borderColor: 'rgba(255,144,57,0.3)' },
            }}
          >
            <Checkbox
              size="small" checked={false}
              onChange={() => handleToggle(t.onboardingId, t.stepId, t.itemId)}
              sx={{ py: 0.4, color: 'rgba(255,255,255,0.25)', '&.Mui-checked': { color: '#00C47A' } }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }} noWrap>
                {t.itemTitle}
              </Typography>
              <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)' }} noWrap>
                {t.clientName} · {t.stepEmoji} {t.stepTitle}
              </Typography>
            </Box>
            <Chip
              label={t.dueLabel}
              size="small"
              sx={{
                height: 16, fontSize: '0.52rem', fontWeight: 700, flexShrink: 0,
                bgcolor: t.dueLabel === 'Atrasado' ? 'rgba(255,69,69,0.14)' : 'rgba(255,144,57,0.12)',
                color: t.dueLabel === 'Atrasado' ? '#FF4545' : '#ff9039',
                border: `1px solid ${t.dueLabel === 'Atrasado' ? 'rgba(255,69,69,0.3)' : 'rgba(255,144,57,0.28)'}`,
              }}
            />
          </Box>
        ))}
        {tasks.length > 8 && (
          <Typography
            onClick={() => onTabChange?.(22)}
            sx={{
              fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', mt: 0.4, fontStyle: 'italic',
              cursor: onTabChange ? 'pointer' : 'default',
              '&:hover': { color: '#ff9039' },
            }}
          >
            +{tasks.length - 8} tarefas — ver aba Onboarding
          </Typography>
        )}
      </Box>
    </Paper>
  )
}
