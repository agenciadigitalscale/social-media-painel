import { useState, useMemo } from 'react'
import {
  Box, Typography, Paper, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Divider,
  IconButton, Tooltip, LinearProgress, Stack, Grid, Avatar,
  ToggleButtonGroup, ToggleButton,
} from '@mui/material'
import AdsClickIcon from '@mui/icons-material/AdsClick'
import EditIcon from '@mui/icons-material/Edit'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import FilterListIcon from '@mui/icons-material/FilterList'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import PauseCircleIcon from '@mui/icons-material/PauseCircle'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import StopCircleIcon from '@mui/icons-material/StopCircle'
import type { Client } from '../types'
import { NAME_MAP, getDisplayName } from '../lib/users'

// ── Tipos ─────────────────────────────────────────────────────────────────
type Plataforma = 'meta' | 'google' | 'tiktok' | 'outro'
type CampanhaStatus = 'ativa' | 'pausada' | 'revisao' | 'encerrada'

interface CampanhaEntry {
  plataforma: Plataforma
  budget: number        // orçamento mensal (R$)
  investido: number     // gasto até agora (R$)
  status: CampanhaStatus
  alcance: number
  cliques: number
  cpl: number           // custo por lead
  roas: number
  managerUrl: string
  responsavel: string   // 'arthur' | 'robson' | ''
  obs: string
}

// ── Storage ───────────────────────────────────────────────────────────────
const STORAGE_KEY = 'sm_trafego'

function load(): Record<string, CampanhaEntry> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}
function save(data: Record<string, CampanhaEntry>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

function empty(): CampanhaEntry {
  return {
    plataforma: 'meta', budget: 0, investido: 0,
    status: 'ativa', alcance: 0, cliques: 0, cpl: 0,
    roas: 0, managerUrl: '', responsavel: '', obs: '',
  }
}

// ── Configurações visuais ─────────────────────────────────────────────────
const PLAT_CFG: Record<Plataforma, { label: string; color: string; emoji: string }> = {
  meta:    { label: 'Meta Ads',   color: '#1877F2', emoji: '📘' },
  google:  { label: 'Google Ads', color: '#EA4335', emoji: '🔴' },
  tiktok:  { label: 'TikTok Ads', color: '#00F2EA', emoji: '🎵' },
  outro:   { label: 'Outro',      color: '#888',    emoji: '📊' },
}

const STATUS_CFG: Record<CampanhaStatus, { label: string; color: string; icon: React.ReactNode }> = {
  ativa:     { label: 'Ativa',      color: '#00C47A', icon: <PlayCircleIcon   sx={{ fontSize: 13 }} /> },
  pausada:   { label: 'Pausada',    color: '#FFD700', icon: <PauseCircleIcon  sx={{ fontSize: 13 }} /> },
  revisao:   { label: 'Em revisão', color: '#3B8EFF', icon: <HourglassEmptyIcon sx={{ fontSize: 13 }} /> },
  encerrada: { label: 'Encerrada',  color: '#FF4545', icon: <StopCircleIcon   sx={{ fontSize: 13 }} /> },
}

const GESTORES = ['arthur', 'robson'] as const

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtK(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000)    return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ── Componente principal ──────────────────────────────────────────────────
interface Props { allClients: Client[] }

export default function TrafegoTab({ allClients }: Props) {
  const [data, setData]               = useState<Record<string, CampanhaEntry>>(load)
  const [editClient, setEditClient]   = useState<string | null>(null)
  const [draft, setDraft]             = useState<CampanhaEntry>(empty)
  const [filterStatus, setFilterStatus] = useState<'all' | CampanhaStatus>('all')
  const [filterGestor, setFilterGestor] = useState<'all' | string>('all')

  const clientNames = allClients.map(c => c.name)

  // ── KPIs globais ─────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const entries = Object.values(data)
    return {
      budget:    entries.reduce((s, e) => s + (e.budget    || 0), 0),
      investido: entries.reduce((s, e) => s + (e.investido || 0), 0),
      ativas:    entries.filter(e => e.status === 'ativa').length,
      pausadas:  entries.filter(e => e.status === 'pausada').length,
      revisao:   entries.filter(e => e.status === 'revisao').length,
      alcance:   entries.reduce((s, e) => s + (e.alcance || 0), 0),
      cliques:   entries.reduce((s, e) => s + (e.cliques || 0), 0),
    }
  }, [data])

  const budgetPct = totals.budget > 0 ? Math.min((totals.investido / totals.budget) * 100, 100) : 0

  // ── Editar ────────────────────────────────────────────────────────────
  const openEdit = (name: string) => {
    setDraft({ ...empty(), ...(data[name] ?? {}) })
    setEditClient(name)
  }
  const saveEdit = () => {
    if (!editClient) return
    const updated = { ...data, [editClient]: { ...draft } }
    setData(updated)
    save(updated)
    setEditClient(null)
  }
  const setD = <K extends keyof CampanhaEntry>(k: K, v: CampanhaEntry[K]) =>
    setDraft(prev => ({ ...prev, [k]: v }))

  // ── Filtro ────────────────────────────────────────────────────────────
  const visible = clientNames.filter(name => {
    const e = data[name]
    if (!e) return filterStatus === 'all' && filterGestor === 'all'
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    if (filterGestor !== 'all' && e.responsavel !== filterGestor) return false
    return true
  })

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3.5 }, maxWidth: 1800, mx: 'auto' }}>

      {/* ── Header KPIs ──────────────────────────────────────────────── */}
      <Paper sx={{
        p: { xs: 2, md: 2.5, xl: 3 }, mb: 3,
        background: 'linear-gradient(135deg, rgba(24,119,242,0.12) 0%, rgba(0,196,122,0.10) 100%)',
        border: '1px solid rgba(24,119,242,0.2)', borderRadius: 3,
      }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between" gap={2} mb={2}>
          <Box>
            <Stack direction="row" alignItems="center" gap={1.5} mb={0.5}>
              <AdsClickIcon sx={{ color: '#1877F2', fontSize: { xs: '1.4rem', xl: '1.8rem' } }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: '1.1rem', xl: '1.5rem' } }}>
                Gestão de Tráfego — Junho 2026
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.78rem', xl: '0.9rem' } }}>
              Campanhas pagas · Budget · KPIs por cliente
            </Typography>
          </Box>

          {/* Gestores */}
          <Stack direction="row" gap={1.5}>
            {GESTORES.map(key => {
              const u = NAME_MAP[key]
              return (
                <Chip
                  key={key}
                  avatar={<Avatar sx={{ bgcolor: u.color, fontSize: '0.75rem' }}>{u.emoji}</Avatar>}
                  label={`${getDisplayName(key)} · ${u.role}`}
                  size="small"
                  sx={{
                    bgcolor: `${u.color}18`, border: `1px solid ${u.color}40`,
                    color: u.color, fontWeight: 600,
                    fontSize: { xs: '0.72rem', xl: '0.85rem' },
                  }}
                />
              )
            })}
          </Stack>
        </Stack>

        {/* KPI chips */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)', xl: 'repeat(7, 1fr)' },
          gap: { xs: 1, xl: 1.5 },
          mb: 2,
        }}>
          {[
            { label: 'Budget total',   value: `R$ ${fmt(totals.budget)}`,    color: '#888'     },
            { label: 'Investido',      value: `R$ ${fmt(totals.investido)}`,  color: '#ff9039'  },
            { label: 'Restante',       value: `R$ ${fmt(Math.max(totals.budget - totals.investido, 0))}`, color: '#00C47A' },
            { label: 'Campanhas ativas', value: String(totals.ativas),        color: '#00C47A'  },
            { label: 'Em revisão',     value: String(totals.revisao),          color: '#3B8EFF'  },
            { label: 'Alcance total',  value: fmtK(totals.alcance),            color: '#C084FC'  },
            { label: 'Cliques',        value: fmtK(totals.cliques),            color: '#FB7185'  },
          ].map(({ label, value, color }) => (
            <Paper key={label} sx={{ p: { xs: 1, xl: 1.5 }, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2, textAlign: 'center' }}>
              <Typography sx={{ fontSize: { xs: '1.1rem', xl: '1.5rem' }, fontWeight: 800, color, lineHeight: 1 }}>
                {value}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.62rem', xl: '0.72rem' } }}>
                {label}
              </Typography>
            </Paper>
          ))}
        </Box>

        {/* Barra de budget global */}
        <Box>
          <Stack direction="row" justifyContent="space-between" mb={0.5}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              Budget total do mês
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: budgetPct > 90 ? '#FF4545' : '#00C47A' }}>
              {budgetPct.toFixed(1)}% investido
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={budgetPct}
            sx={{
              height: 8, borderRadius: 4,
              bgcolor: 'rgba(255,255,255,0.08)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                bgcolor: budgetPct > 90 ? '#FF4545' : budgetPct > 70 ? '#FFD700' : '#00C47A',
              },
            }}
          />
        </Box>
      </Paper>

      {/* ── Filtros ───────────────────────────────────────────────────── */}
      <Stack direction="row" gap={1.5} mb={3} flexWrap="wrap" alignItems="center">
        <FilterListIcon sx={{ color: 'text.secondary', fontSize: '1.1rem' }} />
        <ToggleButtonGroup
          value={filterStatus} exclusive size="small"
          onChange={(_, v) => { if (v) setFilterStatus(v) }}
          sx={{ '& .MuiToggleButton-root': { fontSize: { xs: '0.7rem', xl: '0.82rem' }, py: 0.4, px: 1.2 } }}
        >
          <ToggleButton value="all">Todas</ToggleButton>
          {(Object.entries(STATUS_CFG) as [CampanhaStatus, typeof STATUS_CFG[CampanhaStatus]][]).map(([k, cfg]) => (
            <ToggleButton key={k} value={k} sx={{ gap: 0.4 }}>
              {cfg.icon} {cfg.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <ToggleButtonGroup
          value={filterGestor} exclusive size="small"
          onChange={(_, v) => { if (v) setFilterGestor(v) }}
          sx={{ '& .MuiToggleButton-root': { fontSize: { xs: '0.7rem', xl: '0.82rem' }, py: 0.4, px: 1.2 } }}
        >
          <ToggleButton value="all">Todos</ToggleButton>
          {GESTORES.map(g => (
            <ToggleButton key={g} value={g}>
              {NAME_MAP[g].emoji} {getDisplayName(g)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {/* ── Grade de clientes ─────────────────────────────────────────── */}
      <Grid container spacing={{ xs: 1.5, md: 2, xl: 2.5 }}>
        {visible.map(clientName => {
          const e      = data[clientName] ?? empty()
          const hasData = !!data[clientName]
          const platCfg = PLAT_CFG[e.plataforma]
          const stCfg   = STATUS_CFG[e.status]
          const pct     = e.budget > 0 ? Math.min((e.investido / e.budget) * 100, 100) : 0
          const restante = Math.max(e.budget - e.investido, 0)
          const gestor  = e.responsavel && NAME_MAP[e.responsavel]
          const ctr     = e.cliques > 0 && e.alcance > 0
            ? ((e.cliques / e.alcance) * 100).toFixed(2)
            : '—'

          return (
            <Grid item xs={12} md={6} xl={4} key={clientName}>
              <Paper sx={{
                p: { xs: 1.5, xl: 2.5 },
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: hasData
                  ? `${platCfg.color}30`
                  : 'rgba(255,255,255,0.06)',
                bgcolor: 'background.paper',
                position: 'relative',
                transition: 'border-color 0.2s',
                '&:hover': { borderColor: `${platCfg.color}50` },
              }}>

                {/* Cabeçalho do card */}
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1.2}>
                  <Box sx={{ flex: 1, mr: 1 }}>
                    <Typography fontWeight={700} sx={{ fontSize: { xs: '0.85rem', xl: '1rem' }, lineHeight: 1.3 }}>
                      {clientName}
                    </Typography>
                    <Stack direction="row" gap={0.6} mt={0.5} flexWrap="wrap" alignItems="center">
                      <Chip
                        label={`${platCfg.emoji} ${platCfg.label}`}
                        size="small"
                        sx={{
                          height: 18, fontSize: '0.62rem',
                          bgcolor: `${platCfg.color}18`,
                          color: platCfg.color,
                          border: `1px solid ${platCfg.color}30`,
                        }}
                      />
                      <Chip
                        icon={stCfg.icon as React.ReactElement}
                        label={stCfg.label}
                        size="small"
                        sx={{
                          height: 18, fontSize: '0.62rem',
                          bgcolor: `${stCfg.color}18`,
                          color: stCfg.color,
                          border: `1px solid ${stCfg.color}30`,
                          '& .MuiChip-icon': { color: stCfg.color, ml: 0.3 },
                        }}
                      />
                      {gestor && (
                        <Chip
                          label={`${gestor.emoji} ${getDisplayName(e.responsavel)}`}
                          size="small"
                          sx={{
                            height: 18, fontSize: '0.62rem',
                            bgcolor: `${gestor.color}18`,
                            color: gestor.color,
                            border: `1px solid ${gestor.color}30`,
                          }}
                        />
                      )}
                    </Stack>
                  </Box>
                  <Stack direction="row" gap={0.4}>
                    {e.managerUrl && (
                      <Tooltip title="Abrir gerenciador">
                        <IconButton size="small" href={e.managerUrl} target="_blank" sx={{ p: 0.4 }}>
                          <OpenInNewIcon sx={{ fontSize: '0.95rem' }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Editar campanha">
                      <IconButton size="small" onClick={() => openEdit(clientName)} sx={{ p: 0.4 }}>
                        <EditIcon sx={{ fontSize: '0.95rem' }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>

                {!hasData ? (
                  <Box
                    onClick={() => openEdit(clientName)}
                    sx={{
                      textAlign: 'center', py: 2, cursor: 'pointer', opacity: 0.4,
                      border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 1.5,
                      '&:hover': { opacity: 0.7 },
                    }}
                  >
                    <TrendingUpIcon sx={{ fontSize: '1.5rem', mb: 0.5, display: 'block', mx: 'auto' }} />
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                      Clique para registrar campanha
                    </Typography>
                  </Box>
                ) : (
                  <>
                    {/* Budget */}
                    <Stack direction="row" justifyContent="space-between" mb={0.4}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        Investido
                      </Typography>
                      <Typography variant="caption" sx={{
                        fontSize: '0.7rem', fontWeight: 700,
                        color: pct > 90 ? '#FF4545' : pct > 70 ? '#FFD700' : '#00C47A',
                      }}>
                        R$ {fmt(e.investido)} / R$ {fmt(e.budget)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        mb: 1, height: 6, borderRadius: 3,
                        bgcolor: 'rgba(255,255,255,0.08)',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          bgcolor: pct > 90 ? '#FF4545' : pct > 70 ? '#FFD700' : '#00C47A',
                        },
                      }}
                    />

                    {/* KPIs grid */}
                    <Box sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 0.8, mb: 1,
                    }}>
                      {[
                        { label: 'Restante',  value: `R$${fmt(restante)}`,         color: '#888'    },
                        { label: 'Alcance',   value: fmtK(e.alcance),              color: '#C084FC' },
                        { label: 'CTR',       value: `${ctr}%`,                    color: '#3B8EFF' },
                        { label: 'CPL',       value: e.cpl > 0 ? `R$${fmt(e.cpl)}` : '—', color: '#FB7185' },
                        { label: 'Cliques',   value: fmtK(e.cliques),              color: '#60A5FA' },
                        { label: 'ROAS',      value: e.roas > 0 ? `${e.roas.toFixed(1)}x` : '—', color: '#00C47A' },
                        { label: 'Pct',       value: `${pct.toFixed(0)}%`,         color: '#FFD700' },
                        { label: 'CPM',       value: e.alcance > 0 ? `R$${fmt((e.investido / e.alcance) * 1000)}` : '—', color: '#F97316' },
                      ].map(({ label, value, color }) => (
                        <Box key={label} sx={{
                          bgcolor: 'rgba(255,255,255,0.04)',
                          borderRadius: 1, p: 0.6, textAlign: 'center',
                        }}>
                          <Typography sx={{ fontSize: { xs: '0.72rem', xl: '0.85rem' }, fontWeight: 700, color, lineHeight: 1.1 }}>
                            {value}
                          </Typography>
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.58rem' }}>
                            {label}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {/* Observações */}
                    {e.obs && (
                      <Typography variant="caption" sx={{
                        fontSize: '0.7rem', color: 'text.secondary',
                        display: 'block', fontStyle: 'italic',
                        bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1, px: 1, py: 0.5,
                      }}>
                        📝 {e.obs}
                      </Typography>
                    )}
                  </>
                )}
              </Paper>
            </Grid>
          )
        })}
      </Grid>

      <Box sx={{ height: 80 }} />

      {/* ── Dialog de edição ─────────────────────────────────────────── */}
      <Dialog
        open={!!editClient}
        onClose={() => setEditClient(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 0 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <AdsClickIcon sx={{ color: '#1877F2', fontSize: '1.1rem' }} />
            {editClient}
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack gap={2}>

            {/* Linha 1: Plataforma + Status */}
            <Stack direction="row" gap={1.5}>
              <TextField
                select fullWidth size="small" label="Plataforma"
                value={draft.plataforma}
                onChange={e => setD('plataforma', e.target.value as Plataforma)}
              >
                {(Object.entries(PLAT_CFG) as [Plataforma, typeof PLAT_CFG[Plataforma]][]).map(([k, cfg]) => (
                  <MenuItem key={k} value={k}>{cfg.emoji} {cfg.label}</MenuItem>
                ))}
              </TextField>
              <TextField
                select fullWidth size="small" label="Status"
                value={draft.status}
                onChange={e => setD('status', e.target.value as CampanhaStatus)}
              >
                {(Object.entries(STATUS_CFG) as [CampanhaStatus, typeof STATUS_CFG[CampanhaStatus]][]).map(([k, cfg]) => (
                  <MenuItem key={k} value={k}>{cfg.label}</MenuItem>
                ))}
              </TextField>
            </Stack>

            {/* Linha 2: Budget + Investido */}
            <Stack direction="row" gap={1.5}>
              <TextField
                fullWidth size="small" label="Budget mensal (R$)" type="number"
                value={draft.budget || ''}
                onChange={e => setD('budget', parseFloat(e.target.value) || 0)}
                InputProps={{ inputProps: { min: 0, step: 50 } }}
              />
              <TextField
                fullWidth size="small" label="Investido até hoje (R$)" type="number"
                value={draft.investido || ''}
                onChange={e => setD('investido', parseFloat(e.target.value) || 0)}
                InputProps={{ inputProps: { min: 0, step: 10 } }}
              />
            </Stack>

            <Divider sx={{ opacity: 0.3 }}>
              <Typography variant="caption" color="text.secondary">KPIs</Typography>
            </Divider>

            {/* Linha 3: Alcance + Cliques */}
            <Stack direction="row" gap={1.5}>
              <TextField
                fullWidth size="small" label="Alcance" type="number"
                value={draft.alcance || ''}
                onChange={e => setD('alcance', parseInt(e.target.value) || 0)}
              />
              <TextField
                fullWidth size="small" label="Cliques" type="number"
                value={draft.cliques || ''}
                onChange={e => setD('cliques', parseInt(e.target.value) || 0)}
              />
            </Stack>

            {/* Linha 4: CPL + ROAS */}
            <Stack direction="row" gap={1.5}>
              <TextField
                fullWidth size="small" label="CPL — Custo por Lead (R$)" type="number"
                value={draft.cpl || ''}
                onChange={e => setD('cpl', parseFloat(e.target.value) || 0)}
                InputProps={{ inputProps: { min: 0, step: 0.01 } }}
              />
              <TextField
                fullWidth size="small" label="ROAS (ex: 3.5)" type="number"
                value={draft.roas || ''}
                onChange={e => setD('roas', parseFloat(e.target.value) || 0)}
                InputProps={{ inputProps: { min: 0, step: 0.1 } }}
              />
            </Stack>

            <Divider sx={{ opacity: 0.3 }}>
              <Typography variant="caption" color="text.secondary">Responsável & Links</Typography>
            </Divider>

            {/* Linha 5: Responsável */}
            <TextField
              select fullWidth size="small" label="Gestor responsável"
              value={draft.responsavel}
              onChange={e => setD('responsavel', e.target.value)}
            >
              <MenuItem value="">— Nenhum —</MenuItem>
              {GESTORES.map(g => (
                <MenuItem key={g} value={g}>
                  {NAME_MAP[g].emoji} {getDisplayName(g)}
                </MenuItem>
              ))}
            </TextField>

            {/* Linha 6: Link gerenciador */}
            <TextField
              fullWidth size="small" label="Link do gerenciador de anúncios"
              placeholder="https://business.facebook.com/adsmanager/..."
              value={draft.managerUrl}
              onChange={e => setD('managerUrl', e.target.value)}
            />

            {/* Linha 7: Observações */}
            <TextField
              fullWidth size="small" label="Observações / Status da campanha"
              multiline minRows={2} maxRows={4}
              placeholder="Ex: Criativos em aprovação, aguardando liberação do cliente..."
              value={draft.obs}
              onChange={e => setD('obs', e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditClient(null)} color="inherit" size="small">Cancelar</Button>
          <Button onClick={saveEdit} variant="contained" size="small" sx={{ fontWeight: 700 }}>
            Salvar campanha
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
