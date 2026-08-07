import { useEffect, useState } from 'react'
import { Box, Typography, Button, Tooltip, CircularProgress } from '@mui/material'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import RefreshIcon from '@mui/icons-material/Refresh'
import { DS } from '../theme'
import { auditVerdict, fetchAudit, since, type AuditPayload, type AuditStatus } from '../lib/authAudit'

/**
 * O sinal que decide se dá para fechar o `/api/sync`, dentro do painel.
 *
 * Antes disto, a única forma de ler era `GET /api/sync?key=sm_auth_audit` — e
 * essa leitura **contava como acesso anônimo**, empurrando para frente o mesmo
 * carimbo que se esperava ver parado. Quem media estragava a medição.
 *
 * Fica no AccessManager porque é a tela de acesso, e ela já é restrita a
 * Sócio/Head.
 */

const TONE: Record<AuditStatus, string> = {
  ready:        DS.green,
  enforcing:    DS.green,
  blocked:      DS.amber,
  no_signal:    DS.t2,
  unconfigured: DS.alert,
  error:        DS.red,
}

export default function SyncAuditPanel() {
  const [payload, setPayload] = useState<AuditPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadAt, setReloadAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    void (async () => {
      const next = await fetchAudit()
      if (!alive) return
      setPayload(next)
      setNow(Date.now())
      setLoading(false)
    })()
    return () => { alive = false }
  }, [reloadAt])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={18} sx={{ color: DS.accent }} />
      </Box>
    )
  }
  if (!payload) return null

  const v = auditVerdict(payload, now)
  const tone = TONE[v.status]
  const icon = v.status === 'enforcing' || v.status === 'ready'
    ? <LockIcon sx={{ fontSize: 16, color: tone }} />
    : v.status === 'blocked' || v.status === 'unconfigured'
      ? <LockOpenIcon sx={{ fontSize: 16, color: tone }} />
      : <HelpOutlineIcon sx={{ fontSize: 16, color: tone }} />

  return (
    <Box sx={{
      mt: 1, p: 1.6, borderRadius: 2,
      bgcolor: `${tone}0d`, border: `1px solid ${tone}33`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9, mb: 0.5 }}>
        {icon}
        <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: DS.t1, flex: 1 }}>
          {v.title}
        </Typography>
        <Tooltip title="Reconsultar">
          <Button
            size="small" onClick={() => setReloadAt(n => n + 1)}
            sx={{ minWidth: 0, px: 0.8, py: 0.2, color: DS.t2 }}
          >
            <RefreshIcon sx={{ fontSize: 14 }} />
          </Button>
        </Tooltip>
      </Box>

      <Typography sx={{ fontSize: '0.65rem', color: DS.t2, lineHeight: 1.65 }}>
        {v.detail}
      </Typography>

      {v.blocking.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
          {v.blocking.map(r => (
            <Box key={r.route} sx={{
              display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap',
              px: 1, py: 0.6, borderRadius: '8px',
              bgcolor: 'rgba(148,163,184,0.05)', border: `1px solid ${DS.borderSoft}`,
            }}>
              <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: DS.t1, fontFamily: 'monospace' }}>
                {r.route}
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: DS.amber, fontWeight: 700 }}>
                sem sessão {since(r.lastAt, now)}
              </Typography>
              {r.sample && (
                <Tooltip title={r.sample}>
                  <Typography sx={{ fontSize: '0.58rem', color: DS.t3, maxWidth: 180 }} noWrap>
                    {r.sample}
                  </Typography>
                </Tooltip>
              )}
            </Box>
          ))}
        </Box>
      )}

      {payload.routes.length > 0 && (
        <Typography sx={{ fontSize: '0.58rem', color: DS.t3, mt: 1, lineHeight: 1.6 }}>
          {/* O total nunca zera e inclui a era anterior ao SESSION_SECRET —
              quem lê o acumulado conclui que a porta nunca fecha. */}
          Totais acumulados (não zeram, incluem o período antes do SESSION_SECRET):{' '}
          {payload.routes.map(r => `${r.route} — ${r.count} sem sessão / ${r.auth} com`).join(' · ')}
        </Typography>
      )}
    </Box>
  )
}
