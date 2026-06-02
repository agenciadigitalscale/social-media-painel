/* InstagramTab.tsx — Instagram Management Hub
   Sections: header stats, client connection grid, scheduled posts, quick schedule, bulk caption generator
*/
import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import {
  Box, Typography, Paper, Chip, Button, CircularProgress,
  Select, MenuItem, FormControl, InputLabel, LinearProgress, Tooltip, IconButton, Avatar,
} from '@mui/material'
import Grid from '@mui/material/Grid2'
import InstagramIcon from '@mui/icons-material/Instagram'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ScheduleIcon from '@mui/icons-material/Schedule'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import RefreshIcon from '@mui/icons-material/Refresh'
import LinkIcon from '@mui/icons-material/Link'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import HistoryIcon from '@mui/icons-material/History'
import PublishIcon from '@mui/icons-material/Publish'
import CancelIcon from '@mui/icons-material/Cancel'
import type { ContentItem, ItemState, Client, Status } from '../types'
import { fetchAllIGSchedules, clientHasIG, cancelScheduleIG, publishScheduleNow, type IGSchedule } from '../lib/instagram'

const InstagramScheduleModal = lazy(() => import('./InstagramScheduleModal'))

const IG_GRADIENT = 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)'

const NICHO: Record<string, string> = {
  'Casa de Ração 2 Irmãos':  'Pet Shop',
  'Chalés Alto da Represa':  'Turismo Rural',
  "Frango d'Água":           'Restaurante',
  'Hidro Elétrica Andrade':  'Elétrica / Solar',
  'Home Elevadores':         'Elevadores',
  'Kátia Bigatello':         'Beleza / Maquiagem',
  'Lareiras Grill':          'Restaurante / Grill',
  'Luthita':                 'Moda Feminina',
  'LuzioPan':                'Fornecedor Panificação',
  'Magia dos Temáticos':     'Festas Temáticas',
  'Padaria R.A':             'Padaria Artesanal',
  'Pousada Dukuka':          'Hospedagem',
  'Quero Bolo':              'Confeitaria',
  'ViniPlas':                'Comunicação Visual',
  'Rosângela Varas':         'Saúde / Medicina',
  'Compostela':              'Gastronomia',
  'Suh Maya':                'Música / Forró',
}

const SCHEDULE_STATUS: Record<IGSchedule['status'], { label: string; color: string }> = {
  pending:   { label: 'Agendado',  color: '#ff9039' },
  published: { label: 'Publicado', color: '#00C47A' },
  failed:    { label: 'Falhou',    color: '#FF4545' },
  cancelled: { label: 'Cancelado', color: '#888'    },
}

interface Props {
  allItems: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  onStatusChange: (id: number, s: Status) => void
  onUpdate: (id: number, patch: Partial<ItemState>) => void
}

// ── Section header helper ────────────────────────────────────────────
function SectionHeader({ label, color = '#E1306C' }: { label: string; color?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
      <Box sx={{ width: 3, height: 20, borderRadius: 2, background: color, flexShrink: 0 }} />
      <Typography sx={{
        fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: 'rgba(255,255,255,0.38)',
      }}>
        {label}
      </Typography>
    </Box>
  )
}

export default function InstagramTab({ allItems, states, allClients, onStatusChange, onUpdate }: Props) {
  // ── Client connection status ─────────────────────────────────────
  const [igStatus, setIgStatus] = useState<Record<string, boolean>>({})
  const [loadingIG, setLoadingIG] = useState(true)

  // ── Schedules ────────────────────────────────────────────────────
  const [schedules, setSchedules] = useState<IGSchedule[]>([])
  const [loadingSchedules, setLoadingSchedules] = useState(true)

  // ── Modal ────────────────────────────────────────────────────────
  const [modalClient, setModalClient] = useState<string | null>(null)
  const [modalItem, setModalItem] = useState<ContentItem | null>(null)
  const [modalTab, setModalTab] = useState(0)

  // ── Bulk caption generator ───────────────────────────────────────
  const [bulkClient, setBulkClient] = useState('')
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; lastTitle: string } | null>(null)
  const [bulkMsg, setBulkMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // ── Load IG connection status for all clients ─────────────────────
  const loadIGStatus = useCallback(async () => {
    setLoadingIG(true)
    const results = await Promise.all(
      allClients.map(async c => ({ name: c.name, ok: await clientHasIG(c.name) }))
    )
    const map: Record<string, boolean> = {}
    results.forEach(r => { map[r.name] = r.ok })
    setIgStatus(map)
    setLoadingIG(false)
  }, [allClients])

  // ── Load all schedules ────────────────────────────────────────────
  const loadSchedules = useCallback(async () => {
    setLoadingSchedules(true)
    const data = await fetchAllIGSchedules()
    setSchedules(data)
    setLoadingSchedules(false)
  }, [])

  useEffect(() => {
    loadIGStatus()
    loadSchedules()
  }, [loadIGStatus, loadSchedules])

  // Auto-refresh schedules every 30s
  useEffect(() => {
    const id = setInterval(loadSchedules, 30_000)
    return () => clearInterval(id)
  }, [loadSchedules])

  // ── Derived stats ─────────────────────────────────────────────────
  const totalClients    = allClients.length
  const connectedCount  = Object.values(igStatus).filter(Boolean).length
  const now             = new Date()
  const thisMonthStart  = new Date(now.getFullYear(), now.getMonth(), 1)
  const publishedCount  = schedules.filter(s => s.status === 'published' && new Date(s.published_at ?? 0) >= thisMonthStart).length
  const pendingCount    = schedules.filter(s => s.status === 'pending').length

  // ── Quick schedule: status=5 with link but not yet in schedules ───
  const scheduledItemIds = new Set(schedules.map(s => s.item_id))
  const quickItems = allItems
    .filter(item => {
      const st = states[item.i]
      return (st?.status ?? item.s) === 5 && st?.link?.trim() && !scheduledItemIds.has(item.i)
    })
    .slice(0, 5)

  // ── Publish now ───────────────────────────────────────────────────
  const handlePublishNow = useCallback(async (scheduleId: string, itemId: number) => {
    const r = await publishScheduleNow(scheduleId)
    if (r.ok) {
      onStatusChange(itemId, 7)
      await loadSchedules()
    }
  }, [onStatusChange, loadSchedules])

  // ── Cancel schedule ───────────────────────────────────────────────
  const handleCancel = useCallback(async (scheduleId: string) => {
    await cancelScheduleIG(scheduleId)
    await loadSchedules()
  }, [loadSchedules])

  // ── Open modal helpers ────────────────────────────────────────────
  const openConnect = (clientName: string) => {
    setModalClient(clientName)
    setModalItem(null)
    setModalTab(0)
  }

  const openSchedule = (clientName: string, item?: ContentItem) => {
    setModalClient(clientName)
    setModalItem(item ?? null)
    setModalTab(1)
  }

  const openHistory = (clientName: string) => {
    setModalClient(clientName)
    setModalItem(null)
    setModalTab(2)
  }

  // ── Bulk caption generator ────────────────────────────────────────
  const handleBulkCaptions = useCallback(async () => {
    if (!bulkClient) return
    const groqKey = localStorage.getItem('sm_groq_key')

    const targets = allItems.filter(item => {
      if (item.c !== bulkClient) return false
      const st = states[item.i]
      const status = st?.status ?? item.s
      if (status > 3) return false   // só até aprovado interno
      if (st?.caption?.trim()) return false  // já tem legenda
      return true
    })

    if (targets.length === 0) {
      setBulkMsg({ text: 'Nenhum item sem legenda encontrado para este cliente.', ok: false })
      return
    }

    setBulkRunning(true)
    setBulkMsg(null)
    setBulkProgress({ current: 0, total: targets.length, lastTitle: '' })

    const nicho = NICHO[bulkClient] ?? 'Marketing Digital'
    let successCount = 0

    for (let i = 0; i < targets.length; i++) {
      const item = targets[i]
      setBulkProgress({ current: i + 1, total: targets.length, lastTitle: item.n })

      const userMessage = `Crie uma legenda para ${item.tp} do cliente ${bulkClient} do nicho ${nicho}. Título: ${item.n}. Data: ${new Date(item.dt).toLocaleDateString('pt-BR')}. Tom: envolvente, autêntico, com CTA. Inclua hashtags.`

      try {
        const body: Record<string, unknown> = {
          system: 'Você é Kerges, o melhor copywriter de social media do Brasil. Crie uma legenda viral para Instagram. Seja criativo, use emojis, máximo 2200 caracteres.',
          messages: [{ role: 'user', content: userMessage }],
        }
        if (groqKey) body.groqKey = groqKey

        const r = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const d = await r.json() as { content?: { text: string }[]; error?: string }
        const text = d.content?.[0]?.text?.trim()
        if (text) {
          onUpdate(item.i, { caption: text })
          successCount++
        }
      } catch {
        // individual error: skip and continue
      }

      // Avoid hammering the API
      if (i < targets.length - 1) await new Promise(res => setTimeout(res, 600))
    }

    setBulkRunning(false)
    setBulkProgress(null)
    setBulkMsg({
      text: `✅ ${successCount} legenda${successCount !== 1 ? 's' : ''} gerada${successCount !== 1 ? 's' : ''} com sucesso!`,
      ok: true,
    })
  }, [bulkClient, allItems, states, onUpdate])

  return (
    <Box sx={{
      height: '100%', overflowY: 'auto', p: { xs: 2, md: 3, xl: 4 },
      '&::-webkit-scrollbar': { width: 4 },
      '&::-webkit-scrollbar-thumb': {
        background: 'linear-gradient(180deg, rgba(224,48,108,0.5), rgba(240,148,51,0.5))',
        borderRadius: 4,
      },
    }}>

      {/* ══ SECTION 1 — Header ══ */}
      <Box sx={{ mb: 4 }}>
        {/* Title row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box sx={{
            width: { xs: 44, xl: 56 }, height: { xs: 44, xl: 56 }, borderRadius: '14px',
            background: IG_GRADIENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 24px rgba(224,48,108,0.35)',
            flexShrink: 0,
          }}>
            <InstagramIcon sx={{ fontSize: { xs: 24, xl: 30 }, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{
              fontSize: { xs: '1.3rem', md: '1.6rem', xl: '2rem' },
              fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1,
              background: IG_GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Instagram Hub
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.68rem', xl: '0.8rem' }, color: 'rgba(255,255,255,0.38)', mt: 0.3 }}>
              Gestão de contas, agendamentos e geração de legendas
            </Typography>
          </Box>
          <Box sx={{ ml: 'auto' }}>
            <Tooltip title="Atualizar">
              <IconButton
                onClick={() => { loadIGStatus(); loadSchedules() }}
                size="small"
                sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#E1306C', bgcolor: 'rgba(225,48,108,0.1)' } }}
              >
                <RefreshIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Stats pills */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {[
            { label: 'Clientes', value: loadingIG ? '…' : totalClients,    color: 'rgba(255,255,255,0.5)' },
            { label: 'Conectados', value: loadingIG ? '…' : connectedCount, color: '#00C47A' },
            { label: 'Agendados', value: loadingSchedules ? '…' : pendingCount, color: '#ff9039' },
            { label: 'Publicados este mês', value: loadingSchedules ? '…' : publishedCount, color: '#E1306C' },
          ].map(({ label, value, color }) => (
            <Box key={label} sx={{
              px: 2, py: 1, borderRadius: 2,
              bgcolor: 'rgba(13,13,13,0.82)',
              border: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
              display: 'flex', alignItems: 'center', gap: 1.2,
            }}>
              <Typography sx={{ fontSize: { xs: '1.1rem', xl: '1.4rem' }, fontWeight: 900, color, lineHeight: 1 }}>
                {value}
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em' }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ══ SECTION 2 — Client Connection Grid ══ */}
      <Box sx={{ mb: 4 }}>
        <SectionHeader label="Clientes · Status de Conexão" color="#E1306C" />
        <Grid container spacing={1.5}>
          {allClients.map(client => {
            const connected = igStatus[client.name] ?? false
            const loading   = loadingIG
            return (
              <Grid key={client.name} size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
                <Paper sx={{
                  p: 1.5, borderRadius: 2,
                  bgcolor: 'rgba(13,13,13,0.82)',
                  border: `1px solid ${connected ? 'rgba(0,196,122,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  backdropFilter: 'blur(20px)',
                  transition: 'all 0.2s ease',
                  '&:hover': { borderColor: connected ? 'rgba(0,196,122,0.35)' : 'rgba(225,48,108,0.25)', transform: 'translateY(-1px)' },
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.2 }}>
                    {/* Connection dot */}
                    <Box sx={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      bgcolor: loading ? 'rgba(255,255,255,0.2)' : connected ? '#00C47A' : 'rgba(255,255,255,0.2)',
                      boxShadow: !loading && connected ? '0 0 8px #00C47A' : 'none',
                    }} />
                    <Typography sx={{
                      fontSize: { xs: '0.78rem', xl: '0.88rem' }, fontWeight: 700, flex: 1,
                      color: 'rgba(255,255,255,0.88)',
                    }} noWrap>
                      {client.name}
                    </Typography>
                    {!loading && connected && (
                      <Chip
                        label="Configurado" size="small"
                        icon={<CheckCircleIcon sx={{ fontSize: '10px !important' }} />}
                        sx={{ height: 18, fontSize: '0.5rem', fontWeight: 700, bgcolor: 'rgba(0,196,122,0.1)', color: '#00C47A', border: '1px solid rgba(0,196,122,0.25)' }}
                      />
                    )}
                  </Box>

                  {/* Action buttons */}
                  <Box sx={{ display: 'flex', gap: 0.8 }}>
                    {!loading && !connected ? (
                      <Button
                        size="small" variant="contained" fullWidth
                        startIcon={<InstagramIcon sx={{ fontSize: 12 }} />}
                        onClick={() => openConnect(client.name)}
                        sx={{
                          fontSize: '0.62rem', fontWeight: 700, py: 0.5,
                          background: IG_GRADIENT, color: '#fff',
                          '&:hover': { filter: 'brightness(1.1)', transform: 'translateY(-1px)' },
                        }}
                      >
                        Conectar
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="small" variant="outlined" sx={{ flex: 1, fontSize: '0.58rem', fontWeight: 700, py: 0.4, borderColor: 'rgba(225,48,108,0.3)', color: '#E1306C', '&:hover': { borderColor: '#E1306C', bgcolor: 'rgba(225,48,108,0.08)' } }}
                          startIcon={<ScheduleIcon sx={{ fontSize: 11 }} />}
                          onClick={() => openSchedule(client.name)}
                          disabled={loading}
                        >
                          Agendar
                        </Button>
                        <Button
                          size="small" variant="outlined" sx={{ flex: 1, fontSize: '0.58rem', fontWeight: 700, py: 0.4, borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', '&:hover': { borderColor: 'rgba(255,255,255,0.25)', bgcolor: 'rgba(255,255,255,0.04)' } }}
                          startIcon={<HistoryIcon sx={{ fontSize: 11 }} />}
                          onClick={() => openHistory(client.name)}
                          disabled={loading}
                        >
                          Histórico
                        </Button>
                      </>
                    )}
                    {loading && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5 }}>
                        <CircularProgress size={12} sx={{ color: 'rgba(255,255,255,0.2)' }} />
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>Verificando…</Typography>
                      </Box>
                    )}
                  </Box>
                </Paper>
              </Grid>
            )
          })}
        </Grid>
      </Box>

      {/* ══ SECTION 3 — Scheduled Posts ══ */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 3, height: 20, borderRadius: 2, background: '#ff9039', flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.38)' }}>
              Agendamentos · Atualiza a cada 30s
            </Typography>
          </Box>
          <IconButton size="small" onClick={loadSchedules} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#ff9039' } }}>
            <RefreshIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Box>

        {loadingSchedules ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} sx={{ color: '#E1306C' }} />
          </Box>
        ) : schedules.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'rgba(13,13,13,0.82)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
            <ScheduleIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.08)', mb: 1 }} />
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Nenhum agendamento encontrado</Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {schedules.map(sch => {
              const cfg  = SCHEDULE_STATUS[sch.status]
              const item = allItems.find(i => i.i === sch.item_id)
              return (
                <Paper key={sch.id} sx={{
                  p: 1.5, borderRadius: 2,
                  bgcolor: 'rgba(13,13,13,0.82)',
                  border: `1px solid ${cfg.color}22`,
                  backdropFilter: 'blur(16px)',
                  transition: 'all 0.2s ease',
                  '&:hover': { borderColor: `${cfg.color}44` },
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {/* IG avatar */}
                    <Avatar sx={{ width: 32, height: 32, background: IG_GRADIENT, flexShrink: 0 }}>
                      <InstagramIcon sx={{ fontSize: 16, color: '#fff' }} />
                    </Avatar>

                    {/* Info */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700 }} noWrap>
                          {item?.n ?? `Item #${sch.item_id}`}
                        </Typography>
                        <Chip
                          label={cfg.label} size="small"
                          sx={{ height: 16, fontSize: '0.48rem', fontWeight: 700, bgcolor: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' }}>
                          {sch.client_name}
                        </Typography>
                        <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)' }} />
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 0.4 }}>
                          <CalendarTodayIcon sx={{ fontSize: 10 }} />
                          {new Date(sch.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                        <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.25)' }}>
                          {sch.media_type}
                        </Typography>
                      </Box>
                      {sch.error && (
                        <Typography sx={{ fontSize: '0.58rem', color: '#FF4545', mt: 0.3 }}>
                          Erro: {sch.error}
                        </Typography>
                      )}
                    </Box>

                    {/* Actions */}
                    {sch.status === 'pending' && (
                      <Box sx={{ display: 'flex', gap: 0.8, flexShrink: 0 }}>
                        <Tooltip title="Publicar agora">
                          <Button
                            size="small" variant="outlined"
                            startIcon={<PublishIcon sx={{ fontSize: 11 }} />}
                            onClick={() => handlePublishNow(sch.id, sch.item_id)}
                            sx={{ fontSize: '0.58rem', py: 0.4, px: 1, borderColor: '#00C47A', color: '#00C47A', '&:hover': { bgcolor: 'rgba(0,196,122,0.08)' } }}
                          >
                            Publicar
                          </Button>
                        </Tooltip>
                        <Tooltip title="Cancelar agendamento">
                          <IconButton size="small" onClick={() => handleCancel(sch.id)} sx={{ p: 0.5, color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#FF4545', bgcolor: 'rgba(255,69,69,0.08)' } }}>
                            <CancelIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                    {sch.status === 'failed' && (
                      <Button
                        size="small" variant="outlined"
                        onClick={() => handlePublishNow(sch.id, sch.item_id)}
                        sx={{ fontSize: '0.58rem', py: 0.4, px: 1, borderColor: '#FF4545', color: '#FF4545', flexShrink: 0, '&:hover': { bgcolor: 'rgba(255,69,69,0.08)' } }}
                      >
                        Tentar novamente
                      </Button>
                    )}
                  </Box>
                </Paper>
              )
            })}
          </Box>
        )}
      </Box>

      {/* ══ SECTION 4 — Quick Schedule ══ */}
      {quickItems.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <SectionHeader label="Prontos para Agendar · Aprovados pelo cliente com link" color="#34D399" />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {quickItems.map(item => {
              const st = states[item.i]
              return (
                <Paper key={item.i} sx={{
                  p: 1.4, borderRadius: 2,
                  bgcolor: 'rgba(13,13,13,0.82)',
                  border: '1px solid rgba(52,211,153,0.15)',
                  backdropFilter: 'blur(16px)',
                  transition: 'all 0.2s ease',
                  '&:hover': { borderColor: 'rgba(52,211,153,0.3)', transform: 'translateY(-1px)' },
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                        <Chip
                          label={item.tp} size="small"
                          sx={{ height: 16, fontSize: '0.48rem', fontWeight: 700, bgcolor: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.25)' }}
                        />
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }} noWrap>
                          {st?.title || item.n}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)' }}>
                          {item.c}
                        </Typography>
                        <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)' }} />
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)' }}>
                          {new Date(item.dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </Typography>
                        {st?.link && (
                          <>
                            <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)' }} />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                              <LinkIcon sx={{ fontSize: 10, color: 'rgba(52,211,153,0.6)' }} />
                              <Typography sx={{ fontSize: '0.58rem', color: 'rgba(52,211,153,0.7)' }}>Link disponível</Typography>
                            </Box>
                          </>
                        )}
                      </Box>
                    </Box>
                    <Button
                      size="small" variant="contained"
                      startIcon={<ScheduleIcon sx={{ fontSize: 11 }} />}
                      onClick={() => openSchedule(item.c, item)}
                      sx={{
                        fontSize: '0.6rem', fontWeight: 700, py: 0.5, px: 1.5, flexShrink: 0,
                        background: IG_GRADIENT, color: '#fff',
                        '&:hover': { filter: 'brightness(1.1)', transform: 'translateY(-1px)' },
                      }}
                    >
                      Agendar
                    </Button>
                  </Box>
                </Paper>
              )
            })}
          </Box>
        </Box>
      )}

      {/* ══ SECTION 5 — Bulk Caption Generator ══ */}
      <Box sx={{ mb: 4 }}>
        <SectionHeader label="Gerador de Legendas em Lote · IA" color="#C084FC" />
        <Paper sx={{
          p: { xs: 2, md: 2.5 },
          bgcolor: 'rgba(13,13,13,0.82)',
          border: '1px solid rgba(192,132,252,0.15)',
          borderRadius: 3,
          backdropFilter: 'blur(28px)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(192,132,252,0.25), rgba(255,144,57,0.15))',
              border: '1px solid rgba(192,132,252,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AutoAwesomeIcon sx={{ fontSize: 18, color: '#C084FC' }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: { xs: '0.85rem', xl: '0.95rem' }, fontWeight: 800 }}>
                Gerar Legendas em Lote
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', mt: 0.2 }}>
                Para todos os itens sem legenda (status 0–3) de um cliente
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel sx={{ fontSize: '0.8rem' }}>Cliente</InputLabel>
              <Select
                value={bulkClient}
                onChange={e => { setBulkClient(e.target.value); setBulkMsg(null) }}
                label="Cliente"
                sx={{ fontSize: '0.8rem' }}
                disabled={bulkRunning}
              >
                {allClients.map(c => (
                  <MenuItem key={c.name} value={c.name} sx={{ fontSize: '0.78rem' }}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              onClick={handleBulkCaptions}
              disabled={!bulkClient || bulkRunning}
              startIcon={bulkRunning
                ? <CircularProgress size={14} sx={{ color: '#fff' }} />
                : <AutoAwesomeIcon sx={{ fontSize: 15 }} />
              }
              sx={{
                background: 'linear-gradient(135deg, #C084FC, #ff9039)',
                color: '#000', fontWeight: 800, borderRadius: 2.5,
                boxShadow: '0 6px 20px rgba(192,132,252,0.25)',
                '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
                '&.Mui-disabled': { opacity: 0.5 },
                fontSize: '0.75rem',
              }}
            >
              {bulkRunning ? 'Gerando...' : '✨ Gerar legendas em lote (IA)'}
            </Button>
          </Box>

          {/* Progress */}
          {bulkRunning && bulkProgress && (
            <Box sx={{ mt: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
                <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)' }}>
                  Gerando: <span style={{ color: 'rgba(192,132,252,0.9)', fontWeight: 700 }}>{bulkProgress.lastTitle}</span>
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: '#C084FC', fontWeight: 700 }}>
                  {bulkProgress.current}/{bulkProgress.total}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(bulkProgress.current / bulkProgress.total) * 100}
                sx={{
                  height: 6, borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.06)',
                  '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #C084FC, #ff9039)', borderRadius: 3 },
                }}
              />
            </Box>
          )}

          {/* Result message */}
          {bulkMsg && !bulkRunning && (
            <Box sx={{
              mt: 2, p: 1.4, borderRadius: 2,
              bgcolor: bulkMsg.ok ? 'rgba(0,196,122,0.06)' : 'rgba(255,69,69,0.06)',
              border: `1px solid ${bulkMsg.ok ? 'rgba(0,196,122,0.2)' : 'rgba(255,69,69,0.2)'}`,
            }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: bulkMsg.ok ? '#00C47A' : '#FF4545' }}>
                {bulkMsg.text}
              </Typography>
            </Box>
          )}

          {/* Info note */}
          <Box sx={{ mt: 2.5, p: 1.2, borderRadius: 2, bgcolor: 'rgba(192,132,252,0.04)', border: '1px solid rgba(192,132,252,0.1)' }}>
            <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.7 }}>
              💡 As legendas são geradas com o contexto do cliente e do nicho. Itens com status 4–7 (já enviados/aprovados/publicados) não são alterados.
              Para usar Groq em vez da API padrão, salve sua chave em <code style={{ color: 'rgba(192,132,252,0.7)' }}>localStorage.sm_groq_key</code>.
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* ══ Modal ══ */}
      {modalClient && (
        <Suspense fallback={null}>
          <InstagramScheduleModal
            open={!!modalClient}
            onClose={() => { setModalClient(null); setModalItem(null); loadSchedules() }}
            clientName={modalClient}
            item={modalItem}
            state={modalItem ? (states[modalItem.i] ?? null) : null}
            allItems={allItems}
            states={states}
            onPublished={itemId => onStatusChange(itemId, 7)}
          />
        </Suspense>
      )}
    </Box>
  )
}
