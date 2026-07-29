/* OnboardingWizard.tsx — Configuração de workspace + pitch de planos SaaS
   Acessível pelo ícone de engrenagem na sidebar (Kaique/Sócios).
*/
import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, Box, Typography, IconButton, Button,
  TextField, Stack, Paper, Chip, Divider, Avatar, Tooltip,
} from '@mui/material'
import CloseIcon              from '@mui/icons-material/Close'
import CheckIcon              from '@mui/icons-material/Check'
import RocketLaunchIcon       from '@mui/icons-material/RocketLaunch'
import GroupsIcon             from '@mui/icons-material/Groups'
import BusinessIcon           from '@mui/icons-material/Business'
import AutoAwesomeIcon        from '@mui/icons-material/AutoAwesome'
import LockIcon               from '@mui/icons-material/Lock'
import NotificationsIcon      from '@mui/icons-material/Notifications'
import NotificationsOffIcon   from '@mui/icons-material/NotificationsOff'
import { NAME_MAP } from '../lib/users'
import { DS } from '../theme'

// ── Workspace storage ─────────────────────────────────────

interface WorkspaceData {
  name: string
  tagline: string
  accentColor: string
}

const WS_KEY = 'sm_workspace'
function loadWs(): WorkspaceData {
  try { return { name: 'Digital Scale', tagline: 'Agência de Marketing Digital', accentColor: DS.accent, ...JSON.parse(localStorage.getItem(WS_KEY) ?? '{}') } }
  catch { return { name: 'Digital Scale', tagline: 'Agência de Marketing Digital', accentColor: DS.accent } }
}
function saveWs(data: WorkspaceData) {
  localStorage.setItem(WS_KEY, JSON.stringify(data))
}

// ── Plan definitions ─────────────────────────────────────

const PLANS = [
  {
    id: 'starter',
    label: 'Starter',
    price: 'R$197/mês',
    emoji: '🌱',
    color: '#6B7280',
    features: [
      '3 clientes ativos',
      '2 membros da equipe',
      'Produções + Kanban',
      'Portal do cliente',
      'Suporte básico',
    ],
    locked: ['IA integrada', 'Tráfego pago', 'Relatórios avançados', 'API + integrações'],
  },
  {
    id: 'pro',
    label: 'Pro',
    price: 'R$397/mês',
    emoji: '⚡',
    color: DS.orangeDim,
    features: [
      '10 clientes ativos',
      '5 membros da equipe',
      'Tudo do Starter',
      'IA de legendas + roteiros',
      'Dashboard financeiro',
      'Central de gravações',
    ],
    locked: ['Tráfego Meta Ads API', 'White-label', 'Multi-workspace'],
  },
  {
    id: 'agency',
    label: 'Agency',
    price: 'R$797/mês',
    emoji: '🏆',
    color: DS.accent,
    current: true,
    features: [
      'Clientes ilimitados',
      'Equipe ilimitada',
      'Tudo do Pro',
      'Tráfego + Meta Ads',
      'White-label completo',
      'API + Webhooks',
      'Suporte prioritário',
      'Onboarding dedicado',
    ],
    locked: [],
  },
]

const ACCENT_COLORS = [DS.accent, DS.accent, DS.purpleSoft, DS.green, DS.pink, DS.amber]

// ── Props ─────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  currentUser?: string
  totalClients: number
}

// ── Step components ───────────────────────────────────────

function StepWorkspace({ data, onChange }: {
  data: WorkspaceData
  onChange: (d: Partial<WorkspaceData>) => void
}) {
  const notifPerm = 'Notification' in window ? Notification.permission : 'denied'
  const [testSent, setTestSent] = useState(false)

  function handleRequestNotif() {
    Notification.requestPermission().then(p => {
      if (p === 'granted') {
        setTimeout(() => new Notification('🔔 DS HUB — notificações ativas!', {
          body: 'Você receberá um resumo personalizado todo dia às 7h.',
          icon: '/logo.png',
        }), 500)
      }
    })
  }

  function handleTestNotif() {
    if (notifPerm !== 'granted') return
    setTestSent(true)
    navigator.serviceWorker?.ready.then(reg => {
      reg.active?.postMessage({ type: 'TEST_NOTIFY' })
    }).catch(() => {
      new Notification('🔔 DS HUB — teste', { body: 'Notificações funcionando!', icon: '/logo.png' })
    })
    setTimeout(() => setTestSent(false), 3000)
  }

  return (
    <Box>
      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 2.5, lineHeight: 1.6 }}>
        Configure a identidade do seu workspace — aparece no painel e nos portais dos clientes.
      </Typography>
      <Stack gap={2}>
        <TextField
          label="Nome da agência"
          value={data.name}
          onChange={e => onChange({ name: e.target.value })}
          fullWidth size="small"
          inputProps={{ maxLength: 40 }}
        />
        <TextField
          label="Tagline (opcional)"
          value={data.tagline}
          onChange={e => onChange({ tagline: e.target.value })}
          fullWidth size="small"
          inputProps={{ maxLength: 60 }}
          helperText="Ex: 'Agência de Marketing Digital' ou 'Criatividade com resultado'"
        />
        <Box>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 1 }}>Cor de destaque</Typography>
          <Stack direction="row" gap={1} flexWrap="wrap">
            {ACCENT_COLORS.map(c => (
              <Box
                key={c}
                onClick={() => onChange({ accentColor: c })}
                sx={{
                  width: 32, height: 32, borderRadius: 2, bgcolor: c, cursor: 'pointer',
                  border: data.accentColor === c ? `3px solid #fff` : `3px solid transparent`,
                  boxShadow: data.accentColor === c ? `0 0 0 2px ${c}` : 'none',
                  transition: 'all 0.15s ease',
                  '&:hover': { transform: 'scale(1.12)' },
                }}
              />
            ))}
          </Stack>
        </Box>

        {/* Preview card */}
        <Paper sx={{
          p: 2, border: `1px solid ${data.accentColor}30`,
          background: `linear-gradient(135deg, ${data.accentColor}10 0%, transparent 60%)`,
          borderRadius: 2,
        }}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2, bgcolor: data.accentColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem',
            }}>
              🚀
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: data.accentColor, lineHeight: 1.2 }}>
                {data.name || 'Sua Agência'}
              </Typography>
              <Typography sx={{ fontSize: '0.64rem', color: 'text.secondary' }}>
                {data.tagline || 'Sua tagline aqui'}
              </Typography>
            </Box>
            <Box sx={{ ml: 'auto' }}>
              <Chip label="Agency" size="small" sx={{ bgcolor: `${data.accentColor}20`, color: data.accentColor, fontWeight: 700, fontSize: '0.6rem' }} />
            </Box>
          </Stack>
        </Paper>

        {/* Notification status */}
        <Paper sx={{
          p: 1.5, border: `1px solid ${notifPerm === 'granted' ? 'rgba(52,211,153,0.25)' : 'rgba(244,247,255,0.08)'}`,
          bgcolor: notifPerm === 'granted' ? 'rgba(52,211,153,0.06)' : 'rgba(244,247,255,0.02)',
          borderRadius: 2,
        }}>
          <Stack direction="row" alignItems="center" gap={1.2}>
            {notifPerm === 'granted'
              ? <NotificationsIcon sx={{ fontSize: 18, color: DS.green }} />
              : <NotificationsOffIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            }
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: notifPerm === 'granted' ? DS.green : 'text.secondary' }}>
                {notifPerm === 'granted' ? 'Notificações ativas' : notifPerm === 'denied' ? 'Notificações bloqueadas' : 'Notificações desativadas'}
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>
                {notifPerm === 'granted' ? 'Resumo diário às 7h personalizado por cargo' : 'Ative para receber resumo às 7h e alertas urgentes'}
              </Typography>
            </Box>
            {notifPerm === 'granted' ? (
              <Button size="small" variant="outlined" onClick={handleTestNotif}
                sx={{ fontSize: '0.62rem', height: 26, px: 1.2, borderColor: 'rgba(52,211,153,0.3)', color: DS.green,
                  '&:hover': { bgcolor: 'rgba(52,211,153,0.1)' } }}>
                {testSent ? '✓ Enviado' : 'Testar'}
              </Button>
            ) : notifPerm !== 'denied' ? (
              <Button size="small" variant="contained" onClick={handleRequestNotif}
                sx={{ fontSize: '0.62rem', height: 26, px: 1.2, bgcolor: data.accentColor, color: '#000', fontWeight: 700 }}>
                Ativar
              </Button>
            ) : (
              <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>Ative no browser</Typography>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  )
}

function StepEquipe({ accentColor }: { accentColor: string }) {
  const members = Object.entries(NAME_MAP)
  return (
    <Box>
      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 2, lineHeight: 1.6 }}>
        Sua equipe atual com acesso ao DS HUB. Cada membro tem uma senha individual e um painel personalizado.
      </Typography>
      <Stack gap={0.8}>
        {members.map(([key, info]) => (
          <Paper key={key} sx={{
            p: 1.2, display: 'flex', alignItems: 'center', gap: 1.5,
            border: `1px solid ${info.color}20`,
            bgcolor: `${info.color}06`,
            borderRadius: 1.5,
          }}>
            <Avatar sx={{ bgcolor: `${info.color}20`, border: `1.5px solid ${info.color}40`, width: 34, height: 34, fontSize: '1.1rem' }}>
              {info.emoji}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: info.color, lineHeight: 1.2 }}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>{info.role}</Typography>
            </Box>
            <CheckIcon sx={{ fontSize: 14, color: DS.green }} />
          </Paper>
        ))}
      </Stack>
      <Paper sx={{ mt: 2, p: 1.5, border: `1px dashed ${accentColor}25`, bgcolor: 'transparent', borderRadius: 1.5 }}>
        <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', textAlign: 'center' }}>
          ➕ Adicionar membros — disponível no plano Pro e Agency
        </Typography>
      </Paper>
    </Box>
  )
}

function StepPlanos({ totalClients }: { totalClients: number }) {
  return (
    <Box>
      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 2, lineHeight: 1.6 }}>
        Você está no plano <strong style={{ color: DS.accent }}>Agency</strong> — acesso completo a todos os recursos. Veja o que cada plano oferece.
      </Typography>
      <Stack gap={1.5}>
        {PLANS.map(plan => (
          <Paper key={plan.id} sx={{
            p: 2,
            border: plan.current ? `1.5px solid ${plan.color}55` : '1px solid rgba(244,247,255,0.07)',
            bgcolor: plan.current ? `${plan.color}08` : 'rgba(244,247,255,0.02)',
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {plan.current && (
              <Chip label="✓ Plano Atual" size="small" sx={{
                position: 'absolute', top: 10, right: 10,
                bgcolor: `${plan.color}25`, color: plan.color, fontWeight: 700, fontSize: '0.58rem', height: 20,
              }} />
            )}
            <Stack direction="row" alignItems="center" gap={1.2} mb={1.2}>
              <Typography sx={{ fontSize: '1.4rem', lineHeight: 1 }}>{plan.emoji}</Typography>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: plan.color, lineHeight: 1.1 }}>{plan.label}</Typography>
                <Typography sx={{ fontSize: '0.7rem', color: plan.current ? plan.color : 'text.secondary', fontWeight: plan.current ? 700 : 400 }}>{plan.price}</Typography>
              </Box>
            </Stack>
            <Divider sx={{ mb: 1, borderColor: `${plan.color}15` }} />
            <Stack gap={0.4}>
              {plan.features.map(f => (
                <Stack key={f} direction="row" alignItems="center" gap={0.8}>
                  <CheckIcon sx={{ fontSize: 11, color: plan.color, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.65rem', color: 'rgba(244,247,255,0.8)' }}>{f}</Typography>
                </Stack>
              ))}
              {plan.locked.map(f => (
                <Stack key={f} direction="row" alignItems="center" gap={0.8}>
                  <LockIcon sx={{ fontSize: 11, color: 'text.disabled', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>{f}</Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        ))}
      </Stack>
      <Paper sx={{ mt: 1.5, p: 1.5, border: '1px solid rgba(59,130,246,0.15)', bgcolor: 'rgba(59,130,246,0.04)', borderRadius: 1.5 }}>
        <Typography sx={{ fontSize: '0.68rem', color: 'rgba(244,247,255,0.6)', textAlign: 'center' }}>
          💼 Você gerencia <strong style={{ color: DS.accent }}>{totalClients} clientes</strong> ativos neste workspace
        </Typography>
      </Paper>
    </Box>
  )
}

function StepRecursos({ accentColor }: { accentColor: string }) {
  const features = [
    { icon: '📋', label: 'Produções', desc: '4 boards (Vídeo, Design, Feed, Social) com Kanban e drag-and-drop' },
    { icon: '🎬', label: 'Editor de Vídeo', desc: 'Fila de reels, entrega automática por WhatsApp, gravações' },
    { icon: '📱', label: 'Portal do Cliente', desc: 'Link exclusivo por cliente para aprovar criativos online' },
    { icon: '🤖', label: 'IA Integrada', desc: 'Gemini 2.0 Flash — legendas, roteiros, análise e sugestões' },
    { icon: '💰', label: 'Financeiro', desc: 'Mensalidades, caixa, custos fixos e DRE completo' },
    { icon: '📈', label: 'Tráfego Pago', desc: 'Campanhas por plataforma com ROI e metas mensais' },
    { icon: '🏆', label: 'Dashboard Executivo', desc: 'KPIs em tempo real, radar de alertas, top clientes' },
    { icon: '🌐', label: 'Prospecção / CRM', desc: 'Pipeline de leads com drag-and-drop por estágio' },
  ]

  return (
    <Box>
      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 2, lineHeight: 1.6 }}>
        Todos os recursos disponíveis no DS HUB — seu painel operacional completo de agência.
      </Typography>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 1,
      }}>
        {features.map(f => (
          <Paper key={f.label} sx={{
            p: 1.5, display: 'flex', gap: 1.2, alignItems: 'flex-start',
            border: `1px solid ${accentColor}15`,
            bgcolor: `${accentColor}05`,
            borderRadius: 1.5,
          }}>
            <Typography sx={{ fontSize: '1.2rem', lineHeight: 1.2, flexShrink: 0 }}>{f.icon}</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: accentColor, lineHeight: 1.2 }}>{f.label}</Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', lineHeight: 1.5, mt: 0.3 }}>{f.desc}</Typography>
            </Box>
          </Paper>
        ))}
      </Box>
      <Paper sx={{ mt: 2, p: 1.5, border: `1px solid ${accentColor}25`, bgcolor: `${accentColor}08`, borderRadius: 1.5 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <RocketLaunchIcon sx={{ color: accentColor, fontSize: 18 }} />
          <Typography sx={{ fontSize: '0.72rem', color: accentColor, fontWeight: 600 }}>
            DS HUB — Operação completa de agência em um único lugar.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────

const STEPS = [
  { label: 'Workspace', icon: <BusinessIcon sx={{ fontSize: 16 }} /> },
  { label: 'Equipe',    icon: <GroupsIcon sx={{ fontSize: 16 }} /> },
  { label: 'Planos',    icon: <RocketLaunchIcon sx={{ fontSize: 16 }} /> },
  { label: 'Recursos',  icon: <AutoAwesomeIcon sx={{ fontSize: 16 }} /> },
]

export default function OnboardingWizard({ open, onClose, currentUser, totalClients }: Props) {
  const [step, setStep] = useState(0)
  const [wsData, setWsData] = useState<WorkspaceData>(loadWs)

  useEffect(() => {
    if (open) { setStep(0); setWsData(loadWs()) }
  }, [open])

  function handleChange(patch: Partial<WorkspaceData>) {
    setWsData(prev => ({ ...prev, ...patch }))
  }

  function handleSave() {
    saveWs(wsData)
    onClose()
  }

  const accent = wsData.accentColor

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(11,11,11,0.98)',
          backdropFilter: 'blur(40px)',
          border: `1.5px solid ${accent}22`,
          borderRadius: 3,
          boxShadow: `0 8px 48px rgba(0,0,0,0.7), 0 0 48px ${accent}0a`,
          maxHeight: '90vh',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: '1px solid rgba(244,247,255,0.07)' }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 2,
            background: `linear-gradient(135deg, ${accent}, ${accent}80)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>🚀</Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
              DS HUB — Workspace
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
              Configurações & Plano
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'text.disabled', '&:hover': { color: '#fff' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {/* Step tabs */}
      <Box sx={{ px: 3, pt: 2, pb: 0 }}>
        <Stack direction="row" gap={0.6}>
          {STEPS.map((s, i) => (
            <Box
              key={s.label}
              onClick={() => setStep(i)}
              sx={{
                flex: 1, py: 0.8, px: 0.5, borderRadius: 1.5, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4,
                bgcolor: step === i ? `${accent}18` : 'transparent',
                border: `1px solid ${step === i ? `${accent}40` : 'rgba(244,247,255,0.06)'}`,
                transition: 'all 0.2s ease',
                '&:hover': { bgcolor: step === i ? `${accent}18` : 'rgba(244,247,255,0.04)' },
              }}
            >
              <Box sx={{ color: step === i ? accent : 'text.disabled', transition: 'color 0.2s' }}>
                {s.icon}
              </Box>
              <Typography sx={{
                fontSize: '0.58rem', fontWeight: step === i ? 700 : 500,
                color: step === i ? accent : 'text.disabled',
                letterSpacing: '0.02em',
                transition: 'color 0.2s',
              }}>
                {s.label}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Content */}
      <DialogContent sx={{ px: 3, py: 2.5, overflowY: 'auto',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: `${accent}40`, borderRadius: 2 },
      }}>
        {step === 0 && <StepWorkspace data={wsData} onChange={handleChange} />}
        {step === 1 && <StepEquipe accentColor={accent} />}
        {step === 2 && <StepPlanos totalClients={totalClients} />}
        {step === 3 && <StepRecursos accentColor={accent} />}
      </DialogContent>

      {/* Footer */}
      <Box sx={{ px: 3, pb: 2.5, pt: 1.5, borderTop: '1px solid rgba(244,247,255,0.07)' }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', flex: 1 }}>
            {step + 1} / {STEPS.length} — {currentUser ? `Editado por ${currentUser.charAt(0).toUpperCase() + currentUser.slice(1)}` : 'DS HUB'}
          </Typography>
          {step > 0 && (
            <Button size="small" variant="outlined" onClick={() => setStep(s => s - 1)}
              sx={{ fontSize: '0.72rem', height: 30, borderColor: 'rgba(244,247,255,0.12)', color: 'text.secondary',
                '&:hover': { borderColor: 'rgba(244,247,255,0.25)', color: '#fff' } }}>
              ← Voltar
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button size="small" variant="contained" onClick={() => setStep(s => s + 1)}
              sx={{ fontSize: '0.72rem', height: 30, bgcolor: accent, color: '#000', fontWeight: 700,
                '&:hover': { filter: 'brightness(1.1)', bgcolor: accent } }}>
              Próximo →
            </Button>
          ) : (
            <Button size="small" variant="contained" onClick={handleSave}
              sx={{ fontSize: '0.72rem', height: 30, bgcolor: accent, color: '#000', fontWeight: 700,
                '&:hover': { filter: 'brightness(1.1)', bgcolor: accent } }}>
              ✓ Salvar
            </Button>
          )}
        </Stack>
      </Box>
    </Dialog>
  )
}
