import { useState } from 'react'
import { Box, Typography, Button, CircularProgress, Tooltip } from '@mui/material'
import BoltIcon from '@mui/icons-material/Bolt'
import RefreshIcon from '@mui/icons-material/Refresh'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { DS } from '../theme'
import PreviewEnginePanel from './PreviewEnginePanel'
import {
  useAutomationHealth, runDriveScanNow, CRON_STALE_MS, ONLINE_MS,
} from '../lib/automationHealth'

function ago(ts?: number): string {
  if (!ts) return 'nunca'
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 45) return 'agora'
  const m = Math.floor(s / 60)
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Box sx={{ minWidth: 76 }}>
      <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: DS.t3 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: tone ?? DS.t1, lineHeight: 1.3, mt: 0.15 }}>
        {value}
      </Typography>
    </Box>
  )
}

/**
 * Painel "Saúde da automação" — mostra se a esteira do Drive está viva, quando
 * rodou por último (cron vs manual), o último erro e quantos arquivos esperam
 * decisão na Inbox. O botão "Executar agora" dispara um scan manual.
 *
 * Diagnóstico do 401: se o scan manual funciona mas o `lastCronAt` está velho, o
 * cron não está chegando ao endpoint — quase sempre `CRON_SECRET` ausente ou
 * diferente entre o worker e o Pages. O painel diz isso em vez de deixar no escuro.
 */
export default function AutomationHealthPanel({ pendingCount, onScanned }: {
  pendingCount: number
  onScanned?: () => void
}) {
  const { health, loading, reload } = useAutomationHealth(true)
  const [running, setRunning] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; tone: string } | null>(null)

  const now = Date.now()
  const online   = !!health?.lastRunAt && now - health.lastRunAt < ONLINE_MS
  const cronStale = !health?.lastCronAt || now - health.lastCronAt > CRON_STALE_MS

  const statusTone  = online ? DS.green : health?.lastRunAt ? DS.amber : DS.t3
  const statusLabel = online ? 'Online' : health?.lastRunAt ? 'Sem sinal recente' : 'Sem dados ainda'

  const flash = (text: string, tone: string) => {
    setFeedback({ text, tone })
    setTimeout(() => setFeedback(null), 6000)
  }

  const run = async () => {
    setRunning(true)
    const r = await runDriveScanNow()
    setRunning(false)
    if (r.kind === 'ok') {
      flash(r.newVideos ? `${r.newVideos} arquivo(s) novo(s) detectado(s).` : 'Pasta varrida — nada novo.', DS.green)
      onScanned?.()
    } else if (r.kind === 'rate_limited') {
      flash(`Aguarde ${r.remaining}s entre execuções manuais.`, DS.amber)
    } else if (r.kind === 'unauthorized') {
      flash('Sem autorização (401). Faça login novamente.', DS.red)
    } else {
      flash(`Não foi possível executar${r.status ? ` (HTTP ${r.status})` : ''}. Tente de novo.`, DS.red)
    }
    await reload()
  }

  return (
    <>
      <PreviewEnginePanel onChanged={onScanned} />
      <Box sx={{
      mb: 1.5, p: { xs: 1.4, md: 1.6 }, borderRadius: '14px',
      bgcolor: DS.surface, border: `1px solid ${DS.border}`,
      display: 'flex', flexDirection: 'column', gap: 1,
    }}>
      {/* Cabeçalho: título + status + executar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
        <Box sx={{
          width: 26, height: 26, borderRadius: '8px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: `${DS.accent}18`, border: `1px solid ${DS.accent}33`,
        }}>
          <BoltIcon sx={{ fontSize: 15, color: DS.accent }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 120 }}>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: DS.t1, lineHeight: 1.2 }}>
            Saúde da automação
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
            <Box sx={{
              width: 7, height: 7, borderRadius: '50%', bgcolor: statusTone,
              boxShadow: online ? `0 0 7px ${statusTone}` : 'none',
              animation: online ? 'glowPulse 3s ease-in-out infinite' : 'none',
            }} />
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: statusTone, letterSpacing: '0.02em' }}>
              {loading ? 'Carregando…' : statusLabel}
            </Typography>
          </Box>
        </Box>
        <Button
          size="small"
          variant="contained"
          onClick={run}
          disabled={running}
          startIcon={running ? <CircularProgress size={13} sx={{ color: '#fff' }} /> : <RefreshIcon sx={{ fontSize: 15 }} />}
          sx={{ fontSize: '0.66rem', fontWeight: 700, px: 1.4, py: 0.6, flexShrink: 0 }}
        >
          {running ? 'Executando…' : 'Executar agora'}
        </Button>
      </Box>

      {/* Estatísticas */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, rowGap: 0.8, pl: 0.2 }}>
        <Stat label="Último scan" value={ago(health?.lastRunAt)} />
        <Stat
          label="Cron"
          value={ago(health?.lastCronAt)}
          tone={cronStale ? DS.alert : DS.green}
        />
        <Stat
          label="Manual"
          value={ago(health?.lastManualAt)}
        />
        <Stat
          label="Pendentes"
          value={String(pendingCount)}
          tone={pendingCount > 0 ? DS.amber : DS.t1}
        />
        <Stat
          label="Último erro"
          value={health?.lastError ? ago(health.lastError.at) : 'nenhum'}
          tone={health?.lastError ? DS.red : DS.green}
        />
      </Box>

      {/* Diagnóstico do cron parado (provável 401 do CRON_SECRET) */}
      {!loading && cronStale && (
        <Box sx={{
          display: 'flex', alignItems: 'flex-start', gap: 0.7, mt: 0.2,
          p: 0.9, borderRadius: '9px',
          bgcolor: `${DS.alert}12`, border: `1px solid ${DS.alert}33`,
        }}>
          <WarningAmberIcon sx={{ fontSize: 14, color: DS.alert, mt: 0.1, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.62rem', color: DS.t2, lineHeight: 1.45 }}>
            O scan automático (cron) não roda {health?.lastCronAt ? ago(health.lastCronAt) : 'nunca rodou'}. Se o
            "Executar agora" funciona mas o cron não, quase sempre é o <strong style={{ color: DS.t1 }}>CRON_SECRET</strong> ausente
            ou diferente entre o worker <code>ds-hub-cron</code> e o Pages. Precisa ser o <strong style={{ color: DS.t1 }}>mesmo
            valor nos dois lados</strong>.
          </Typography>
        </Box>
      )}

      {/* Último erro detalhado */}
      {health?.lastError?.msg && (
        <Typography sx={{ fontSize: '0.58rem', color: DS.t3, lineHeight: 1.4, pl: 0.2 }} noWrap>
          Erro: {health.lastError.msg}
        </Typography>
      )}

      {/* Feedback da execução manual */}
      {feedback && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 0.2 }}>
          {feedback.tone === DS.green
            ? <CheckCircleIcon sx={{ fontSize: 13, color: feedback.tone }} />
            : <WarningAmberIcon sx={{ fontSize: 13, color: feedback.tone }} />}
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: feedback.tone }}>
            {feedback.text}
          </Typography>
        </Box>
      )}
      </Box>
    </>
  )
}
