/* InstagramScheduleModal.tsx
   Modal para configurar token Instagram de um cliente e agendar posts.
   Tabs: Configurar | Agendar | Histórico
*/
import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Tab, Tabs, Chip, CircularProgress, Alert, IconButton, Tooltip,
  Paper, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material'
import InstagramIcon from '@mui/icons-material/Instagram'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SettingsIcon from '@mui/icons-material/Settings'
import ScheduleIcon from '@mui/icons-material/Schedule'
import HistoryIcon from '@mui/icons-material/History'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CloseIcon from '@mui/icons-material/Close'
import type { ContentItem, ItemState } from '../types'

const API = '/api/instagram'

// ── Status chip ────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Agendado',  color: DS.accent },
  published: { label: 'Publicado', color: DS.green },
  failed:    { label: 'Falhou',    color: DS.red },
  cancelled: { label: 'Cancelado', color: '#888' },
}

interface ScheduleRow {
  id: string; client_name: string; item_id: number
  scheduled_at: string; media_type: string
  status: string; error?: string; published_at?: string
}

interface Props {
  open: boolean
  onClose: () => void
  clientName: string             // cliente selecionado
  item?: ContentItem | null      // item pré-selecionado (do calendário)
  state?: ItemState | null       // estado do item
  allItems: ContentItem[]
  states: Record<number, ItemState>
  onPublished?: (itemId: number) => void  // callback quando publicado
}

export default function InstagramScheduleModal({
  open, onClose, clientName, item, state, allItems, states, onPublished,
}: Props) {
  const [tab, setTab] = useState(0)

  // ── Tab 0 – Configuração do token ─────────────────────────────
  const [igUserId, setIgUserId]       = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [tokenStatus, setTokenStatus] = useState<'idle'|'saving'|'ok'|'error'>('idle')
  const [tokenMsg, setTokenMsg]       = useState('')
  const [configured, setConfigured]   = useState(false)
  const [igName, setIgName]           = useState('')

  // ── Tab 1 – Agendar ──────────────────────────────────────────
  const [selItemId, setSelItemId]     = useState<number | ''>('')
  const [schedDate, setSchedDate]     = useState('')  // date part: YYYY-MM-DD
  const [schedTime, setSchedTime]     = useState('09:00')
  const [caption, setCaption]         = useState('')
  const [mediaUrl, setMediaUrl]       = useState('')
  const [mediaType, setMediaType]     = useState<'IMAGE'|'REELS'>('IMAGE')
  const [scheduling, setScheduling]   = useState(false)
  const [schedMsg, setSchedMsg]       = useState('')

  // ── Tab 2 – Histórico ─────────────────────────────────────────
  const [rows, setRows]     = useState<ScheduleRow[]>([])
  const [loadingRows, setLoadingRows] = useState(false)

  // ── Carregar config salva ─────────────────────────────────────
  const loadConfig = useCallback(async () => {
    if (!clientName) return
    try {
      const r = await fetch(`${API}?action=tokens&clientName=${encodeURIComponent(clientName)}`)
      const d = await r.json() as { ok: boolean; configured: boolean; igUserId?: string; displayName?: string }
      if (d.configured) {
        setConfigured(true)
        setIgUserId(d.igUserId ?? '')
        setIgName(d.displayName ?? clientName)
      } else {
        setConfigured(false)
        setIgName('')
      }
    } catch { /* offline */ }
  }, [clientName])

  // ── Carregar histórico ────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoadingRows(true)
    try {
      const r = await fetch(`${API}?action=list&clientName=${encodeURIComponent(clientName)}`)
      const d = await r.json() as { ok: boolean; schedules: ScheduleRow[] }
      if (d.ok) setRows(d.schedules)
    } catch { /* offline */ }
    finally { setLoadingRows(false) }
  }, [clientName])

  useEffect(() => {
    if (!open || !clientName) return
    loadConfig()
    if (tab === 2) loadHistory()
  }, [open, clientName, tab, loadConfig, loadHistory])

  // Pré-preencher quando item é passado
  useEffect(() => {
    if (!item) return
    setSelItemId(item.i)
    const st = states[item.i]
    setCaption(st?.caption || '')
    setMediaUrl(st?.link || '')
    setMediaType(item.tp === 'Reel' ? 'REELS' : 'IMAGE')
    const d = new Date(item.dt)
    setSchedDate(d.toISOString().split('T')[0])
  }, [item, states])

  // ── Salvar token ──────────────────────────────────────────────
  async function handleSaveToken() {
    if (!igUserId.trim() || !accessToken.trim()) return
    setTokenStatus('saving')
    setTokenMsg('')
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup', clientName, igUserId: igUserId.trim(), accessToken: accessToken.trim() }),
      })
      const d = await r.json() as { ok: boolean; message?: string; error?: string }
      if (d.ok) {
        setTokenStatus('ok')
        setTokenMsg(d.message ?? 'Token salvo!')
        setConfigured(true)
        setAccessToken('')  // limpa por segurança
        await loadConfig()
      } else {
        setTokenStatus('error')
        setTokenMsg(d.error ?? 'Erro ao salvar token')
      }
    } catch {
      setTokenStatus('error')
      setTokenMsg('Erro de conexão')
    }
  }

  // ── Agendar post ─────────────────────────────────────────────
  async function handleSchedule() {
    if (!selItemId || !schedDate || !schedTime || !mediaUrl.trim()) return
    setScheduling(true)
    setSchedMsg('')
    try {
      const scheduledAt = new Date(`${schedDate}T${schedTime}:00`).toISOString()
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'schedule', clientName,
          itemId: selItemId, scheduledAt,
          imageUrl: mediaUrl.trim(), caption, mediaType,
        }),
      })
      const d = await r.json() as { ok: boolean; message?: string; error?: string }
      if (d.ok) {
        setSchedMsg(`✅ ${d.message}`)
        await loadHistory()
        setTab(2)
      } else {
        setSchedMsg(`❌ ${d.error}`)
      }
    } catch {
      setSchedMsg('❌ Erro de conexão')
    }
    setScheduling(false)
  }

  // ── Cancelar um agendamento ───────────────────────────────────
  async function handleCancel(scheduleId: string) {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', scheduleId }),
    })
    await loadHistory()
  }

  // ── Publicar agora manualmente ────────────────────────────────
  async function handlePublishNow(scheduleId: string, itemId: number) {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish', scheduleId }),
    })
    const d = await r.json() as { ok: boolean; error?: string }
    if (d.ok) {
      onPublished?.(itemId)
      await loadHistory()
    } else {
      alert(`Erro ao publicar: ${d.error}`)
    }
  }

  // ── Items disponíveis para este cliente ───────────────────────
  const clientItems = allItems.filter(i => i.c === clientName)

  const dialogPaper = {
    sx: {
      background: 'rgba(10,10,10,0.97)', backdropFilter: 'blur(24px)',
      border: '1px solid rgba(244,247,255,0.07)', borderRadius: 3,
      minHeight: 500,
    },
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: dialogPaper }}>
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 34, height: 34, borderRadius: '10px', flexShrink: 0,
            background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <InstagramIcon sx={{ fontSize: 18, color: '#fff' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>Instagram — {clientName}</Typography>
            {configured && (
              <Typography sx={{ fontSize: '0.62rem', color: DS.green, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircleIcon sx={{ fontSize: 11 }} /> Configurado · @{igName}
              </Typography>
            )}
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          sx={{
            mt: 1.5, borderBottom: '1px solid rgba(244,247,255,0.06)',
            '& .MuiTab-root': { fontSize: '0.72rem', fontWeight: 700, minHeight: 40, py: 0, textTransform: 'none' },
            '& .MuiTabs-indicator': { bgcolor: '#E1306C' },
          }}
        >
          <Tab icon={<SettingsIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="Configurar" />
          <Tab icon={<ScheduleIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="Agendar" disabled={!configured} />
          <Tab icon={<HistoryIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="Histórico" disabled={!configured} />
        </Tabs>
      </DialogTitle>

      <DialogContent sx={{ pt: '16px !important' }}>

        {/* ══ TAB 0 — Configuração ══ */}
        {tab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info" sx={{ fontSize: '0.68rem', borderRadius: 2 }}>
              Você precisa de um <strong>Instagram Business Account</strong> e um <strong>Page Access Token</strong> do Meta.
              O token deve ter as permissões: <code>instagram_content_publish, instagram_basic, pages_manage_posts</code>
            </Alert>

            {/* Como obter */}
            <Paper sx={{ p: 1.5, bgcolor: 'rgba(244,247,255,0.03)', border: '1px solid rgba(244,247,255,0.06)', borderRadius: 2 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'primary.main', mb: 0.8 }}>
                Como configurar:
              </Typography>
              {[
                'Acesse: developers.facebook.com → Meu App → Graph API Explorer',
                'Selecione seu App e gere um User Token com as permissões acima',
                'Use o endpoint: GET /me/accounts para pegar o Page Access Token',
                'Use: GET /{page-id}?fields=instagram_business_account para pegar o IG User ID',
                'Cole abaixo o IG User ID e o Page Access Token',
              ].map((step, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                  <Typography sx={{ fontSize: '0.6rem', color: 'primary.main', fontWeight: 800, flexShrink: 0, mt: 0.1 }}>
                    {i + 1}.
                  </Typography>
                  <Typography sx={{ fontSize: '0.62rem', color: 'rgba(244,247,255,0.5)', lineHeight: 1.6 }}>
                    {step}
                  </Typography>
                </Box>
              ))}
              <Button
                size="small" variant="outlined"
                startIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
                component="a" href="https://developers.facebook.com/tools/explorer/" target="_blank"
                sx={{ mt: 1, fontSize: '0.62rem', borderColor: 'rgba(244,247,255,0.15)', color: 'text.secondary' }}
              >
                Abrir Graph API Explorer
              </Button>
            </Paper>

            <TextField
              label="Instagram User ID"
              placeholder="Ex: 17841400008460056"
              value={igUserId} onChange={e => setIgUserId(e.target.value)}
              size="small" fullWidth
              helperText="Número do Business Account ID do Instagram"
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.85rem' } }}
            />
            <TextField
              label="Page Access Token"
              placeholder="EAA..."
              value={accessToken} onChange={e => setAccessToken(e.target.value)}
              type="password"
              size="small" fullWidth
              helperText="Token de acesso da Página do Facebook (nunca salvo no código)"
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.85rem' } }}
            />

            {tokenMsg && (
              <Alert severity={tokenStatus === 'ok' ? 'success' : 'error'} sx={{ fontSize: '0.68rem', borderRadius: 2 }}>
                {tokenMsg}
              </Alert>
            )}

            <Button
              variant="contained"
              onClick={handleSaveToken}
              disabled={!igUserId.trim() || !accessToken.trim() || tokenStatus === 'saving'}
              startIcon={tokenStatus === 'saving' ? <CircularProgress size={14} /> : <CheckCircleIcon />}
              sx={{
                background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366)',
                color: '#fff', fontWeight: 800, borderRadius: 2,
                '&:hover': { filter: 'brightness(1.1)' },
                '&.Mui-disabled': { opacity: 0.5 },
              }}
            >
              {tokenStatus === 'saving' ? 'Verificando...' : 'Salvar e Verificar Token'}
            </Button>

            {configured && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(49,209,124,0.06)', border: '1px solid rgba(49,209,124,0.2)' }}>
                <Typography sx={{ fontSize: '0.7rem', color: DS.green, fontWeight: 700 }}>
                  ✅ Instagram conectado — @{igName}
                </Typography>
                <Typography sx={{ fontSize: '0.62rem', color: 'rgba(244,247,255,0.4)', mt: 0.3 }}>
                  Acesse a aba "Agendar" para programar posts deste cliente.
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* ══ TAB 1 — Agendar ══ */}
        {tab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Seletor de item */}
            <FormControl size="small" fullWidth>
              <InputLabel sx={{ fontSize: '0.8rem' }}>Conteúdo</InputLabel>
              <Select
                value={selItemId}
                onChange={e => {
                  const id = e.target.value as number
                  setSelItemId(id)
                  const it = allItems.find(x => x.i === id)
                  const st = states[id]
                  if (it) {
                    setCaption(st?.caption || '')
                    setMediaUrl(st?.link || '')
                    setMediaType(it.tp === 'Reel' ? 'REELS' : 'IMAGE')
                    const d = new Date(it.dt)
                    setSchedDate(d.toISOString().split('T')[0])
                  }
                }}
                label="Conteúdo"
                sx={{ fontSize: '0.8rem' }}
              >
                {clientItems.map(it => (
                  <MenuItem key={it.i} value={it.i} sx={{ fontSize: '0.78rem' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={it.tp}
                        size="small"
                        sx={{ height: 16, fontSize: '0.48rem', fontWeight: 700,
                          bgcolor: it.tp === 'Reel' ? 'rgba(192,132,252,0.15)' : 'rgba(96,165,250,0.15)',
                          color: it.tp === 'Reel' ? '#C084FC' : '#60A5FA' }}
                      />
                      <Typography sx={{ fontSize: '0.78rem' }} noWrap>{it.n}</Typography>
                      <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', ml: 'auto', flexShrink: 0 }}>
                        {new Date(it.dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Data e hora */}
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField
                label="Data" type="date" size="small"
                value={schedDate} onChange={e => setSchedDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ flex: 2, '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
              />
              <TextField
                label="Hora" type="time" size="small"
                value={schedTime} onChange={e => setSchedTime(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
              />
            </Box>

            {/* Tipo de mídia */}
            <FormControl size="small" fullWidth>
              <InputLabel sx={{ fontSize: '0.8rem' }}>Tipo de mídia</InputLabel>
              <Select
                value={mediaType} onChange={e => setMediaType(e.target.value as 'IMAGE' | 'REELS')}
                label="Tipo de mídia" sx={{ fontSize: '0.8rem' }}
              >
                <MenuItem value="IMAGE" sx={{ fontSize: '0.78rem' }}>📷 Feed (Imagem / Carrossel)</MenuItem>
                <MenuItem value="REELS" sx={{ fontSize: '0.78rem' }}>🎬 Reel (Vídeo)</MenuItem>
              </Select>
            </FormControl>

            {/* URL da mídia */}
            <Box>
              <TextField
                label={mediaType === 'REELS' ? 'URL do Vídeo (pública)' : 'URL da Imagem (pública)'}
                placeholder="https://drive.google.com/file/d/... ou URL direta"
                value={mediaUrl} onChange={e => setMediaUrl(e.target.value)}
                size="small" fullWidth multiline rows={2}
                sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.78rem' } }}
              />
              <Typography sx={{ fontSize: '0.58rem', color: 'rgba(244,247,255,0.35)', mt: 0.5 }}>
                💡 Para Google Drive: o arquivo precisa estar compartilhado como "Qualquer pessoa com o link pode ver"
              </Typography>
            </Box>

            {/* Legenda */}
            <TextField
              label="Legenda / Caption"
              placeholder="Texto que aparecerá na publicação..."
              value={caption} onChange={e => setCaption(e.target.value)}
              size="small" fullWidth multiline rows={3}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8rem' } }}
            />

            {schedMsg && (
              <Alert
                severity={schedMsg.startsWith('✅') ? 'success' : 'error'}
                sx={{ fontSize: '0.68rem', borderRadius: 2 }}
              >
                {schedMsg}
              </Alert>
            )}

            <Button
              variant="contained"
              onClick={handleSchedule}
              disabled={!selItemId || !schedDate || !schedTime || !mediaUrl.trim() || scheduling}
              startIcon={scheduling ? <CircularProgress size={14} /> : <ScheduleIcon />}
              sx={{
                background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743)',
                color: '#fff', fontWeight: 800, borderRadius: 2, py: 1.2,
                '&:hover': { filter: 'brightness(1.1)' },
                '&.Mui-disabled': { opacity: 0.5 },
              }}
            >
              {scheduling ? 'Agendando...' : `Agendar para ${schedDate && schedTime ? `${schedDate} às ${schedTime}` : '...'}`}
            </Button>

            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <Typography sx={{ fontSize: '0.62rem', color: 'rgba(244,247,255,0.45)', lineHeight: 1.7 }}>
                ⚡ O DS HUB verifica automaticamente a cada <strong style={{ color: DS.accent }}>60 segundos</strong> se há posts para publicar.
                Mantenha o painel aberto no horário do agendamento para publicação automática.
              </Typography>
            </Box>
          </Box>
        )}

        {/* ══ TAB 2 — Histórico ══ */}
        {tab === 2 && (
          <Box>
            {loadingRows ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} sx={{ color: '#E1306C' }} />
              </Box>
            ) : rows.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <InstagramIcon sx={{ fontSize: 40, color: 'rgba(244,247,255,0.1)', mb: 1 }} />
                <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>Nenhum agendamento ainda</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {rows.map(row => {
                  const cfg = STATUS_CFG[row.status] ?? STATUS_CFG.pending
                  const it  = allItems.find(x => x.i === row.item_id)
                  return (
                    <Paper key={row.id} sx={{
                      p: 1.4, bgcolor: 'rgba(244,247,255,0.03)',
                      border: `1px solid ${cfg.color}22`, borderRadius: 2,
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.4 }}>
                            <Chip
                              label={cfg.label} size="small"
                              sx={{ height: 16, fontSize: '0.48rem', fontWeight: 700,
                                bgcolor: `${cfg.color}18`, color: cfg.color }}
                            />
                            <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
                              {new Date(row.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }} noWrap>
                            {it?.n ?? `Item #${row.item_id}`}
                          </Typography>
                          {row.error && (
                            <Typography sx={{ fontSize: '0.6rem', color: DS.red, mt: 0.3 }}>
                              Erro: {row.error}
                            </Typography>
                          )}
                        </Box>

                        {/* Ações */}
                        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                          {row.status === 'pending' && (
                            <>
                              <Tooltip title="Publicar agora">
                                <Button
                                  size="small" variant="outlined"
                                  onClick={() => handlePublishNow(row.id, row.item_id)}
                                  sx={{ fontSize: '0.58rem', py: 0.3, px: 0.8, minWidth: 0,
                                    borderColor: DS.green, color: DS.green }}
                                >
                                  Publicar
                                </Button>
                              </Tooltip>
                              <Tooltip title="Cancelar agendamento">
                                <IconButton size="small" onClick={() => handleCancel(row.id)}
                                  sx={{ p: 0.4, color: 'rgba(244,247,255,0.3)' }}>
                                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          {row.status === 'failed' && (
                            <Button size="small" variant="outlined"
                              onClick={() => handlePublishNow(row.id, row.item_id)}
                              sx={{ fontSize: '0.58rem', py: 0.3, px: 0.8, minWidth: 0,
                                borderColor: DS.red, color: DS.red }}>
                              Tentar novamente
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </Paper>
                  )
                })}
              </Box>
            )}

            <Button
              size="small" onClick={loadHistory}
              sx={{ mt: 1.5, fontSize: '0.65rem', color: 'text.secondary' }}
            >
              ↻ Atualizar lista
            </Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2.5 }}>
        <Button size="small" onClick={onClose} sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Hook para polling automático de posts agendados ───────────────
export function useInstagramScheduler(
  onPublishSuccess: (itemId: number) => void
) {
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${API}?action=pending`)
        const d = await r.json() as {
          ok: boolean
          pending: { id: string; item_id: number; client_name: string }[]
        }
        if (!d.ok || !d.pending?.length) return

        for (const post of d.pending) {
          const r2 = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'publish', scheduleId: post.id }),
          })
          const d2 = await r2.json() as { ok: boolean; itemId?: number }
          if (d2.ok && d2.itemId) onPublishSuccess(d2.itemId)
        }
      } catch { /* offline */ }
    }

    check() // roda imediatamente
    const id = setInterval(check, 60_000) // a cada 60s
    return () => clearInterval(id)
  }, [onPublishSuccess])
}
