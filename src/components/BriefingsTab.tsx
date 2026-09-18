import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import {
  Box, Typography, TextField, Button, Chip, IconButton, Drawer,
  CircularProgress, Snackbar, Tooltip, InputAdornment,
} from '@mui/material'
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd'
import SearchIcon from '@mui/icons-material/Search'
import RefreshIcon from '@mui/icons-material/Refresh'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HourglassTopIcon from '@mui/icons-material/HourglassTop'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import CloseIcon from '@mui/icons-material/Close'
import LinkIcon from '@mui/icons-material/Link'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import { DS, ctaGradient } from '../theme'
import PageHero from '../shared/ui/PageHero'
import {
  BRIEFING_SECTIONS, briefingCompleteness, briefingObjectives,
  briefingSubmittedAt, briefingStatus, type BriefingData, type BriefingStatus,
} from '../lib/briefing'

interface Props {
  allClients: { name: string }[]
  clientPhones: Record<string, string>
  clientColors: Record<string, string>
}

interface BriefingRow {
  client: string
  token: string | null
  status: BriefingStatus
  data: BriefingData | null
  pct: number
}

type ApiList = { ok: boolean; briefings?: Record<string, { token: string; filled: boolean; data?: BriefingData }> }

const STATUS_META: Record<BriefingStatus, { label: string; color: string; icon: typeof CheckCircleIcon }> = {
  preenchido:   { label: 'Preenchido', color: DS.green, icon: CheckCircleIcon },
  aguardando:   { label: 'Aguardando', color: DS.amber, icon: HourglassTopIcon },
  nao_iniciado: { label: 'Não iniciado', color: DS.t3,  icon: RadioButtonUncheckedIcon },
}

const FILTERS: { key: 'todos' | BriefingStatus; label: string }[] = [
  { key: 'todos',        label: 'Todos' },
  { key: 'preenchido',   label: 'Preenchidos' },
  { key: 'aguardando',   label: 'Aguardando' },
  { key: 'nao_iniciado', label: 'Não iniciados' },
]

function corDoCliente(name: string, clientColors: Record<string, string>): string {
  if (clientColors[name]) return clientColors[name]
  // cor derivada estável do nome — mesma ideia dos avatares do painel
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  const PALETTE = [DS.accent, DS.cyan, DS.purple, DS.green, '#FB7185', '#C084FC', '#60A5FA']
  return PALETTE[h % PALETTE.length]
}

function iniciais(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── Anel de progresso do topo ────────────────────────────────────────────
function ProgressRing({ pct, size = 108 }: { pct: number; size?: number }) {
  const stroke = 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c - (pct / 100) * c
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={DS.border} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#briefRing)"
          strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)' }}
        />
        <defs>
          <linearGradient id="briefRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={DS.accent} />
            <stop offset="100%" stopColor={DS.green} />
          </linearGradient>
        </defs>
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: '1.7rem', fontWeight: 900, color: DS.t1, lineHeight: 1, letterSpacing: '-0.03em' }}>
          {pct}<span style={{ fontSize: '0.9rem', color: DS.t2 }}>%</span>
        </Typography>
        <Typography sx={{ fontSize: '0.56rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: DS.t3, mt: 0.3 }}>
          completos
        </Typography>
      </Box>
    </Box>
  )
}

// ── Barrinha de completude do card ───────────────────────────────────────
function MiniMeter({ pct, color }: { pct: number; color: string }) {
  return (
    <Box sx={{ height: 5, borderRadius: 3, bgcolor: DS.border, overflow: 'hidden' }}>
      <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: color, borderRadius: 3, transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
    </Box>
  )
}

export default function BriefingsTab({ allClients, clientPhones, clientColors }: Props) {
  const [remote, setRemote]   = useState<Record<string, { token: string; filled: boolean; data?: BriefingData }>>({})
  const [loading, setLoading] = useState(true)
  const [erro, setErro]       = useState(false)
  const [busca, setBusca]     = useState('')
  const [filtro, setFiltro]   = useState<'todos' | BriefingStatus>('todos')
  const [snack, setSnack]     = useState('')
  const [gerando, setGerando] = useState<string | null>(null)
  const [aberto, setAberto]   = useState<string | null>(null)
  const [revelar, setRevelar] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErro(false)
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
      }).then(r => r.json()) as ApiList
      if (res.ok && res.briefings) setRemote(res.briefings)
      else setErro(true)
    } catch { setErro(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Monta as linhas: todo cliente do painel + qualquer briefing de nome que não
  // esteja mais na lista de clientes (legado), ordenado A→Z.
  const rows = useMemo<BriefingRow[]>(() => {
    const nomes = new Set(allClients.map(c => c.name))
    const extras = Object.keys(remote).filter(n => !nomes.has(n))
    const todos = [...allClients.map(c => c.name), ...extras]
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true }))
    return todos.map(client => {
      const r = remote[client]
      const data = (r?.filled ? r.data : null) ?? null
      const status = briefingStatus(!!r?.token, !!data)
      const pct = data ? briefingCompleteness(data).pct : 0
      return { client, token: r?.token ?? null, status, data, pct }
    })
  }, [allClients, remote])

  const stats = useMemo(() => {
    const total = rows.length
    const preenchido = rows.filter(r => r.status === 'preenchido').length
    const aguardando = rows.filter(r => r.status === 'aguardando').length
    const naoIniciado = total - preenchido - aguardando
    const pct = total ? Math.round((preenchido / total) * 100) : 0
    return { total, preenchido, aguardando, naoIniciado, pct }
  }, [rows])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return rows.filter(r =>
      (filtro === 'todos' || r.status === filtro) &&
      (!q || r.client.toLowerCase().includes(q)),
    )
  }, [rows, busca, filtro])

  const linkDe = (token: string) => `${window.location.origin}/briefing/${token}`

  const mensagemWpp = (client: string, url: string) =>
    `Olá! 👋 Para começarmos o trabalho da *${client}* com a Digital Scale, precisamos de algumas informações. ` +
    `É rápido, leva uns 5 minutos:\n\n${url}\n\nQualquer dúvida, é só chamar. 🚀`

  const gerarLink = useCallback(async (client: string): Promise<string | null> => {
    // Reaproveita o token se já existe (o backend também reaproveita).
    const existente = remote[client]?.token
    if (existente) return linkDe(existente)
    setGerando(client)
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', clientName: client }),
      }).then(r => r.json()) as { ok: boolean; token?: string }
      if (res.ok && res.token) {
        setRemote(prev => ({ ...prev, [client]: { token: res.token!, filled: prev[client]?.filled ?? false, data: prev[client]?.data } }))
        return linkDe(res.token)
      }
      return null
    } catch { return null }
    finally { setGerando(null) }
  }, [remote])

  const copiarLink = useCallback(async (client: string) => {
    const url = await gerarLink(client)
    if (!url) { setSnack('Não deu para gerar o link. Tente de novo.'); return }
    try { await navigator.clipboard.writeText(url) } catch { /* clipboard bloqueado */ }
    setSnack(`Link do briefing de ${client} copiado ✓`)
  }, [gerarLink])

  const enviarWpp = useCallback(async (client: string) => {
    const url = await gerarLink(client)
    if (!url) { setSnack('Não deu para gerar o link. Tente de novo.'); return }
    const fone = (clientPhones[client] ?? '').replace(/\D/g, '')
    const texto = encodeURIComponent(mensagemWpp(client, url))
    const wa = fone ? `https://wa.me/${fone.length <= 11 ? '55' + fone : fone}?text=${texto}` : `https://wa.me/?text=${texto}`
    window.open(wa, '_blank', 'noopener')
  }, [gerarLink, clientPhones])

  const abertoRow = aberto ? rows.find(r => r.client === aberto) ?? null : null

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.6 }}>
      <PageHero
        icon={<AssignmentIndIcon />}
        title="Central de Briefings"
        subtitle="Envie, acompanhe e leia o briefing de cada cliente num lugar só."
        actions={
          <Tooltip title="Atualizar">
            <span>
              <IconButton onClick={load} disabled={loading} sx={{ color: DS.t2, border: `1px solid ${DS.border}`, borderRadius: 2 }}>
                {loading ? <CircularProgress size={18} sx={{ color: DS.accent }} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        }
      />

      {/* Overview */}
      <Box sx={{
        display: 'grid', gap: 1.4,
        gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' }, alignItems: 'stretch',
      }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: 3,
          bgcolor: DS.surface, border: `1px solid ${DS.border}`,
        }}>
          <ProgressRing pct={stats.pct} />
          <Box>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: DS.t3 }}>
              Cobertura de briefings
            </Typography>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: DS.t1, mt: 0.3, lineHeight: 1.2 }}>
              {stats.preenchido} de {stats.total} clientes
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: DS.t2, mt: 0.3, lineHeight: 1.4 }}>
              já enviaram as informações completas.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr 1fr' }, gap: 1.2 }}>
          {([
            { label: 'Preenchidos', value: stats.preenchido, color: DS.green,  icon: CheckCircleIcon },
            { label: 'Aguardando',  value: stats.aguardando, color: DS.amber,  icon: HourglassTopIcon },
            { label: 'Não iniciados', value: stats.naoIniciado, color: DS.t3, icon: RadioButtonUncheckedIcon },
          ] as const).map(k => {
            const Icon = k.icon
            return (
              <Box key={k.label} sx={{
                p: 1.6, borderRadius: 3, bgcolor: DS.surface, border: `1px solid ${DS.border}`,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 96,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: DS.t3 }}>
                    {k.label}
                  </Typography>
                  <Icon sx={{ fontSize: 16, color: k.color }} />
                </Box>
                <Typography sx={{ fontSize: '2rem', fontWeight: 900, color: k.color, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {k.value}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar cliente…" size="small"
          sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { bgcolor: DS.field, borderRadius: 2 } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: DS.t3 }} /></InputAdornment> }}
        />
        <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const n = f.key === 'todos' ? rows.length : rows.filter(r => r.status === f.key).length
            const ativo = filtro === f.key
            return (
              <Chip
                key={f.key} label={`${f.label} · ${n}`} size="small" onClick={() => setFiltro(f.key)}
                sx={{
                  fontSize: '0.7rem', fontWeight: 700, height: 30, borderRadius: 2, cursor: 'pointer',
                  bgcolor: ativo ? 'rgba(59,130,246,0.16)' : DS.surface,
                  color: ativo ? DS.accent : DS.t2,
                  border: `1px solid ${ativo ? 'rgba(59,130,246,0.45)' : DS.border}`,
                  '&:hover': { bgcolor: 'rgba(59,130,246,0.1)' },
                }}
              />
            )
          })}
        </Box>
      </Box>

      {/* Estado de erro do fetch */}
      {erro && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, p: 1.6, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)' }}>
          <CloudOffIcon sx={{ color: DS.red, fontSize: 20 }} />
          <Typography sx={{ fontSize: '0.8rem', color: DS.t2 }}>Não deu para carregar os briefings agora.</Typography>
          <Button size="small" onClick={load} sx={{ ml: 'auto', color: DS.accent, fontWeight: 700 }}>Tentar de novo</Button>
        </Box>
      )}

      {/* Grid de clientes */}
      {loading && rows.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: DS.accent }} />
        </Box>
      ) : (
        <Box sx={{
          display: 'grid', gap: 1.2,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr', xl: '1fr 1fr 1fr 1fr' },
        }}>
          {filtradas.map(row => {
            const meta = STATUS_META[row.status]
            const cor = corDoCliente(row.client, clientColors)
            const StatusIcon = meta.icon
            const temFone = !!(clientPhones[row.client] ?? '').replace(/\D/g, '')
            const carregando = gerando === row.client
            return (
              <Box key={row.client} sx={{
                position: 'relative', p: 1.6, borderRadius: 3, bgcolor: DS.surface,
                border: `1px solid ${DS.border}`, overflow: 'hidden',
                transition: 'all 0.18s ease',
                '&:hover': { borderColor: 'rgba(59,130,246,0.28)', transform: 'translateY(-1px)' },
              }}>
                {/* barra de acento na cor do cliente */}
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${cor}, transparent)` }} />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.4 }}>
                  <Box sx={{
                    width: 40, height: 40, borderRadius: 2, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: `${cor}1e`, border: `1px solid ${cor}55`, color: cor,
                    fontWeight: 800, fontSize: '0.82rem',
                  }}>
                    {iniciais(row.client)}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: '0.86rem', fontWeight: 700, color: DS.t1, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.client}
                    </Typography>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.4 }}>
                      <StatusIcon sx={{ fontSize: 13, color: meta.color }} />
                      <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: meta.color }}>{meta.label}</Typography>
                    </Box>
                  </Box>
                </Box>

                {/* completude quando preenchido */}
                {row.status === 'preenchido' ? (
                  <Box sx={{ mb: 1.4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ fontSize: '0.62rem', color: DS.t3, fontWeight: 600 }}>Completude</Typography>
                      <Typography sx={{ fontSize: '0.62rem', color: DS.t2, fontWeight: 700 }}>{row.pct}%</Typography>
                    </Box>
                    <MiniMeter pct={row.pct} color={meta.color} />
                    {(() => {
                      const at = briefingSubmittedAt(row.data)
                      return at ? (
                        <Typography sx={{ fontSize: '0.6rem', color: DS.t3, mt: 0.6 }}>
                          Enviado em {new Date(at).toLocaleDateString('pt-BR')}
                        </Typography>
                      ) : null
                    })()}
                  </Box>
                ) : (
                  <Typography sx={{ fontSize: '0.68rem', color: DS.t3, mb: 1.4, lineHeight: 1.4 }}>
                    {row.status === 'aguardando'
                      ? 'Link enviado — o cliente ainda não preencheu.'
                      : 'Nenhum link gerado ainda.'}
                  </Typography>
                )}

                {/* ações */}
                <Box sx={{ display: 'flex', gap: 0.6 }}>
                  {row.status === 'preenchido' && (
                    <Button
                      size="small" onClick={() => { setRevelar(false); setAberto(row.client) }}
                      sx={{ flex: 1, background: ctaGradient(135), color: '#fff', fontWeight: 800, fontSize: '0.7rem', borderRadius: 2, textTransform: 'none' }}
                    >
                      Ver briefing
                    </Button>
                  )}
                  <Tooltip title="Copiar link do briefing">
                    <span style={{ flex: row.status === 'preenchido' ? 'unset' : 1 }}>
                      <Button
                        size="small" onClick={() => copiarLink(row.client)} disabled={carregando}
                        startIcon={carregando ? <CircularProgress size={13} sx={{ color: DS.accent }} /> : <ContentCopyIcon sx={{ fontSize: 15 }} />}
                        sx={{
                          width: row.status === 'preenchido' ? 'auto' : '100%',
                          color: DS.t1, fontWeight: 700, fontSize: '0.7rem', borderRadius: 2, textTransform: 'none',
                          bgcolor: DS.field, border: `1px solid ${DS.border}`, '&:hover': { borderColor: 'rgba(59,130,246,0.35)' },
                        }}
                      >
                        {row.status === 'preenchido' ? 'Link' : 'Copiar link'}
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title={temFone ? 'Enviar no WhatsApp do cliente' : 'Abrir WhatsApp (escolher contato)'}>
                    <IconButton
                      size="small" onClick={() => enviarWpp(row.client)}
                      sx={{ color: '#25D366', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 2, '&:hover': { bgcolor: 'rgba(37,211,102,0.1)' } }}
                    >
                      <WhatsAppIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            )
          })}
          {filtradas.length === 0 && (
            <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 6 }}>
              <Typography sx={{ fontSize: '0.85rem', color: DS.t2, fontWeight: 600 }}>Nenhum cliente neste filtro.</Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Drawer de leitura do briefing */}
      <Drawer
        anchor="right" open={!!aberto} onClose={() => setAberto(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, bgcolor: DS.bg, backgroundImage: 'none' } }}
      >
        {abertoRow && abertoRow.data && (
          <BriefingReader
            row={abertoRow} revelar={revelar} onToggleRevelar={() => setRevelar(v => !v)}
            onClose={() => setAberto(null)}
            onCopiarLink={() => copiarLink(abertoRow.client)}
            onWpp={() => enviarWpp(abertoRow.client)}
            cor={corDoCliente(abertoRow.client, clientColors)}
          />
        )}
      </Drawer>

      <Snackbar
        open={!!snack} autoHideDuration={2600} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}

// ── Leitor do briefing (drawer) ──────────────────────────────────────────
function BriefingReader({
  row, revelar, onToggleRevelar, onClose, onCopiarLink, onWpp, cor,
}: {
  row: BriefingRow
  revelar: boolean
  onToggleRevelar: () => void
  onClose: () => void
  onCopiarLink: () => void
  onWpp: () => void
  cor: string
}) {
  const data = row.data as BriefingData
  const comp = briefingCompleteness(data)
  const objetivos = briefingObjectives(data)
  const at = briefingSubmittedAt(data)
  const temSensivel = BRIEFING_SECTIONS.some(s => s.fields.some(f => f.sensitive && typeof data[f.key] === 'string' && (data[f.key] as string).trim()))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* header */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${DS.border}`, position: 'sticky', top: 0, bgcolor: DS.bg, zIndex: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: `${cor}1e`, border: `1px solid ${cor}55`, color: cor, fontWeight: 800, fontSize: '0.9rem',
          }}>
            {iniciais(row.client)}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: DS.t1, lineHeight: 1.2 }}>{row.client}</Typography>
            <Typography sx={{ fontSize: '0.68rem', color: DS.t2, mt: 0.3 }}>
              {comp.filled}/{comp.total} campos · {comp.pct}% completo
              {at ? ` · ${new Date(at).toLocaleDateString('pt-BR')}` : ''}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: DS.t3 }}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        {comp.missingRequired.length > 0 && (
          <Box sx={{ mt: 1.2, p: 1, borderRadius: 1.5, bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.28)' }}>
            <Typography sx={{ fontSize: '0.64rem', color: DS.amber, fontWeight: 700 }}>
              Faltam obrigatórios: {comp.missingRequired.join(' · ')}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 0.8, mt: 1.4, flexWrap: 'wrap' }}>
          <Button size="small" onClick={onCopiarLink} startIcon={<LinkIcon sx={{ fontSize: 15 }} />}
            sx={{ color: DS.t1, fontWeight: 700, fontSize: '0.7rem', borderRadius: 2, textTransform: 'none', bgcolor: DS.field, border: `1px solid ${DS.border}` }}>
            Copiar link
          </Button>
          <Button size="small" onClick={onWpp} startIcon={<WhatsAppIcon sx={{ fontSize: 15 }} />}
            sx={{ color: '#25D366', fontWeight: 700, fontSize: '0.7rem', borderRadius: 2, textTransform: 'none', bgcolor: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.3)' }}>
            WhatsApp
          </Button>
          {temSensivel && (
            <Button size="small" onClick={onToggleRevelar}
              startIcon={revelar ? <VisibilityOffIcon sx={{ fontSize: 15 }} /> : <VisibilityIcon sx={{ fontSize: 15 }} />}
              sx={{ color: DS.t2, fontWeight: 700, fontSize: '0.7rem', borderRadius: 2, textTransform: 'none', bgcolor: DS.field, border: `1px solid ${DS.border}` }}>
              {revelar ? 'Ocultar senhas' : 'Revelar senhas'}
            </Button>
          )}
        </Box>
      </Box>

      {/* conteúdo */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* objetivos */}
        {objetivos.length > 0 && (
          <Box>
            <SectionLabel>🎯 Objetivos</SectionLabel>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
              {objetivos.map(o => (
                <Chip key={o} label={o} size="small" sx={{ fontSize: '0.66rem', fontWeight: 600, bgcolor: 'rgba(59,130,246,0.14)', color: DS.accent, border: '1px solid rgba(59,130,246,0.32)', height: 26 }} />
              ))}
            </Box>
          </Box>
        )}

        {BRIEFING_SECTIONS.map(section => {
          const preenchidos = section.fields.filter(f => typeof data[f.key] === 'string' && (data[f.key] as string).trim())
          if (preenchidos.length === 0) return null
          return (
            <Box key={section.title}>
              <SectionLabel>{section.title}</SectionLabel>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {preenchidos.map(f => {
                  const val = (data[f.key] as string).trim()
                  const oculto = f.sensitive && !revelar
                  return (
                    <Box key={f.key} sx={{ p: 1.2, borderRadius: 2, bgcolor: DS.surface, border: `1px solid ${DS.border}` }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.4 }}>
                        <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: DS.t3 }}>
                          {f.label}
                        </Typography>
                        {f.sensitive && (
                          <Chip label="sigiloso" size="small" sx={{ height: 15, fontSize: '0.52rem', fontWeight: 700, bgcolor: 'rgba(245,158,11,0.14)', color: DS.amber, '& .MuiChip-label': { px: 0.6 } }} />
                        )}
                      </Box>
                      <Typography sx={{
                        fontSize: '0.82rem', color: DS.t1, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        fontFamily: oculto ? 'monospace' : 'inherit', letterSpacing: oculto ? '0.15em' : 'inherit',
                      }}>
                        {oculto ? '•'.repeat(Math.min(val.length, 12)) : val}
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: DS.t1, mb: 1, letterSpacing: '-0.01em' }}>
      {children}
    </Typography>
  )
}
