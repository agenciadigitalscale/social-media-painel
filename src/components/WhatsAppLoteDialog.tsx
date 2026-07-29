import { useState, useEffect, useMemo } from 'react'
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Paper, Chip, Checkbox, Collapse, Divider, CircularProgress, Tooltip,
} from '@mui/material'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import SendIcon from '@mui/icons-material/Send'
import type { Client, ContentItem, ItemState } from '../types'

// ── Types ────────────────────────────────────────────────────
export interface LoteItem {
  id: number
  title: string
}

export interface LoteClient {
  name: string
  items: LoteItem[]
  phone?: string
}

interface Props {
  open: boolean
  onClose: () => void
  clients: LoteClient[]
  onSendToClient: (clientName: string, itemIds: number[]) => Promise<void>
}

// ── Helpers ──────────────────────────────────────────────────
function buildPreviewMessage(clientName: string, selectedItems: LoteItem[]): string {
  if (selectedItems.length === 0) return ''
  if (selectedItems.length === 1) {
    return (
      `Olá, ${clientName}! 😊\n\n` +
      `*${selectedItems[0].title}* está pronto para aprovação.\n\n` +
      `Visualize e nos dê seu feedback pelo link:\n` +
      `[link do portal do cliente]\n\n` +
      `Aguardamos seu retorno! 🙏`
    )
  }
  const lines = selectedItems.map(it => `• *${it.title}*\n  [link do portal]`).join('\n\n')
  return (
    `Olá, ${clientName}! 😊\n\n` +
    `${selectedItems.length} criativos prontos para aprovação:\n\n` +
    `${lines}\n\n` +
    `Acesse os links acima e nos dê seu feedback. Aguardamos! 🙏`
  )
}

// ── ClientRow ────────────────────────────────────────────────
function ClientRow({
  client,
  sent,
  sending,
  onSend,
}: {
  client: LoteClient
  sent: boolean
  sending: boolean
  onSend: (itemIds: number[]) => void
}) {
  // Per-item selection: starts with all selected
  const [selected, setSelected] = useState<Set<number>>(() => new Set(client.items.map(i => i.id)))
  const [previewOpen, setPreviewOpen] = useState(false)

  // Re-init selection when client.items changes (e.g. dialog re-opened)
  useEffect(() => {
    setSelected(new Set(client.items.map(i => i.id)))
  }, [client.items])

  const toggleItem = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(prev =>
      prev.size === client.items.length
        ? new Set()
        : new Set(client.items.map(i => i.id))
    )
  }

  const selectedItems = client.items.filter(i => selected.has(i.id))
  const hasPhone = Boolean(client.phone)
  const noneSelected = selected.size === 0

  const previewMessage = useMemo(
    () => buildPreviewMessage(client.name, selectedItems),
    [client.name, selectedItems],
  )

  return (
    <Paper
      sx={{
        p: 1.5,
        border: '1px solid',
        borderColor: sent
          ? 'rgba(49,209,124,0.4)'
          : noneSelected
          ? 'rgba(244,247,255,0.05)'
          : 'rgba(244,247,255,0.1)',
        background: sent ? 'rgba(49,209,124,0.06)' : 'rgba(244,247,255,0.02)',
        opacity: sent ? 0.9 : 1,
      }}
    >
      {/* ── Header row ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
        {/* Select all checkbox */}
        <Checkbox
          size="small"
          checked={selected.size === client.items.length && client.items.length > 0}
          indeterminate={selected.size > 0 && selected.size < client.items.length}
          onChange={toggleAll}
          disabled={sent || sending}
          sx={{ p: 0, color: 'rgba(244,247,255,0.3)', '&.Mui-checked': { color: '#25D366' }, '&.MuiCheckbox-indeterminate': { color: '#60A5FA' } }}
        />

        {/* Client name + phone indicator */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Typography fontWeight={700} sx={{ fontSize: '0.82rem', lineHeight: 1.2 }} noWrap>
              {sent ? '✅ ' : ''}{client.name}
            </Typography>
            {hasPhone ? (
              <Chip
                label="WA ✓"
                size="small"
                sx={{ fontSize: '0.55rem', height: 16, bgcolor: 'rgba(37,211,102,0.15)', color: '#25D366', border: '1px solid rgba(37,211,102,0.3)', px: 0.2 }}
              />
            ) : (
              <Tooltip title="WhatsApp não configurado — mensagem será copiada para a área de transferência">
                <Chip
                  icon={<WarningAmberIcon sx={{ fontSize: '0.7rem !important' }} />}
                  label="Sem WA"
                  size="small"
                  sx={{ fontSize: '0.55rem', height: 16, bgcolor: 'rgba(255,170,0,0.12)', color: DS.amber, border: '1px solid rgba(255,170,0,0.3)', px: 0.2 }}
                />
              </Tooltip>
            )}
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
            {selected.size}/{client.items.length} item{client.items.length !== 1 ? 's' : ''} selecionado{selected.size !== 1 ? 's' : ''}
          </Typography>
        </Box>

        {/* Send button */}
        <Button
          size="small"
          variant={sent ? 'outlined' : 'contained'}
          color={sent ? 'success' : 'primary'}
          disabled={sending || noneSelected}
          startIcon={sending ? <CircularProgress size={10} sx={{ color: 'inherit' }} /> : <WhatsAppIcon sx={{ fontSize: 13 }} />}
          onClick={() => onSend(Array.from(selected))}
          sx={{ minWidth: 96, fontSize: '0.68rem', flexShrink: 0, fontWeight: 700 }}
        >
          {sending ? 'Enviando…' : sent ? 'Reenviar' : `Enviar (${selected.size})`}
        </Button>
      </Box>

      {/* ── Per-item checkboxes ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, mb: 0.5 }}>
        {client.items.map(item => (
          <Box
            key={item.id}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.6,
              cursor: sent || sending ? 'default' : 'pointer',
              borderRadius: 1,
              px: 0.5, py: 0.2,
              '&:hover': { bgcolor: sent || sending ? 'transparent' : 'rgba(244,247,255,0.04)' },
            }}
            onClick={() => !sent && !sending && toggleItem(item.id)}
          >
            <Checkbox
              size="small"
              checked={selected.has(item.id)}
              onChange={() => !sent && !sending && toggleItem(item.id)}
              disabled={sent || sending}
              sx={{ p: 0, mr: 0.3, color: 'rgba(244,247,255,0.25)', '&.Mui-checked': { color: '#25D366' } }}
            />
            <Typography
              sx={{
                fontSize: '0.68rem',
                color: selected.has(item.id) ? 'rgba(244,247,255,0.85)' : 'rgba(244,247,255,0.3)',
                textDecoration: selected.has(item.id) ? 'none' : 'line-through',
                flex: 1, minWidth: 0,
              }}
              noWrap
            >
              {item.title || `#${item.id}`}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── Message preview toggle ── */}
      {selected.size > 0 && (
        <>
          <Divider sx={{ my: 0.5, borderColor: 'rgba(244,247,255,0.06)' }} />
          <Button
            size="small"
            endIcon={previewOpen ? <ExpandLessIcon sx={{ fontSize: 13 }} /> : <ExpandMoreIcon sx={{ fontSize: 13 }} />}
            onClick={() => setPreviewOpen(v => !v)}
            sx={{ fontSize: '0.6rem', color: 'text.secondary', p: 0, minWidth: 0, textTransform: 'none' }}
          >
            {previewOpen ? 'Ocultar prévia' : 'Ver prévia da mensagem'}
          </Button>
          <Collapse in={previewOpen}>
            <Box
              sx={{
                mt: 0.8, p: 1.2, borderRadius: 1.5,
                bgcolor: 'rgba(37,211,102,0.04)',
                border: '1px solid rgba(37,211,102,0.12)',
                fontFamily: 'monospace',
                fontSize: '0.63rem',
                color: 'rgba(244,247,255,0.55)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
              }}
            >
              {previewMessage}
            </Box>
          </Collapse>
        </>
      )}
    </Paper>
  )
}

// ── WhatsAppLoteDialog ────────────────────────────────────────
export default function WhatsAppLoteDialog({ open, onClose, clients, onSendToClient }: Props) {
  const [sending, setSending] = useState<string | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())

  // Reset state when dialog opens
  useEffect(() => {
    if (open) { setSent(new Set()); setSending(null) }
  }, [open])

  const totalItems = clients.reduce((s, c) => s + c.items.length, 0)
  const pendingClients = clients.filter(c => !sent.has(c.name))

  const handleSend = async (clientName: string, itemIds: number[]) => {
    if (!itemIds.length) return
    setSending(clientName)
    await onSendToClient(clientName, itemIds)
    setSent(prev => new Set([...prev, clientName]))
    setSending(null)
  }

  const handleSendAll = async () => {
    for (const client of pendingClients) {
      if (sending) break
      setSending(client.name)
      await onSendToClient(client.name, client.items.map(i => i.id))
      setSent(prev => new Set([...prev, client.name]))
      await new Promise(r => setTimeout(r, 800))
    }
    setSending(null)
  }

  if (!open) return null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            background: 'rgba(10,10,10,0.98)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(37,211,102,0.2)',
          },
        },
      }}
    >
      {/* ── Title ── */}
      <DialogTitle sx={{ pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 34, height: 34, borderRadius: 2,
              background: 'linear-gradient(135deg,#25D366,#128C7E)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 14px rgba(37,211,102,0.35)',
              flexShrink: 0,
            }}
          >
            <WhatsAppIcon sx={{ color: '#fff', fontSize: 18 }} />
          </Box>
          <Box>
            <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>
              Envio em lote via WhatsApp
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.67rem' }}>
              {totalItems} item{totalItems !== 1 ? 's' : ''} em {clients.length} cliente{clients.length !== 1 ? 's' : ''} · selecione o que enviar por cliente
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          {/* Progress badge */}
          <Box
            sx={{
              px: 1.2, py: 0.4, borderRadius: 2,
              bgcolor: sent.size === clients.length && clients.length > 0
                ? 'rgba(49,209,124,0.12)'
                : 'rgba(244,247,255,0.06)',
              border: '1px solid',
              borderColor: sent.size === clients.length && clients.length > 0
                ? 'rgba(49,209,124,0.3)'
                : 'rgba(244,247,255,0.1)',
            }}
          >
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: sent.size === clients.length && clients.length > 0 ? DS.green : 'text.secondary' }}>
              {sent.size}/{clients.length}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      {/* ── Body ── */}
      <DialogContent sx={{ pt: 1, pb: 0 }}>
        {clients.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
              Nenhum conteúdo aprovado internamente para enviar.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, mt: 0.5, pb: 0.5 }}>
            {clients.map(client => (
              <ClientRow
                key={client.name}
                client={client}
                sent={sent.has(client.name)}
                sending={sending === client.name}
                onSend={itemIds => handleSend(client.name, itemIds)}
              />
            ))}
          </Box>
        )}
      </DialogContent>

      {/* ── Actions ── */}
      <DialogActions sx={{ px: 2, pb: 2, pt: 1, gap: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1, fontSize: '0.65rem' }}>
          {sent.size > 0
            ? `✅ ${sent.size} de ${clients.length} cliente${clients.length !== 1 ? 's' : ''} enviado${sent.size !== 1 ? 's' : ''}`
            : 'Clique em Enviar em cada cliente, ou use Enviar todos'}
        </Typography>
        <Button size="small" onClick={onClose} sx={{ fontSize: '0.68rem' }}>
          Fechar
        </Button>
        {pendingClients.length > 1 && (
          <Button
            size="small"
            variant="contained"
            startIcon={sending ? <CircularProgress size={11} sx={{ color: '#fff' }} /> : <SendIcon sx={{ fontSize: 13 }} />}
            disabled={sending !== null}
            onClick={handleSendAll}
            sx={{
              background: 'linear-gradient(135deg,#25D366,#128C7E)',
              color: '#fff', fontWeight: 800, fontSize: '0.72rem',
              '&:hover': { filter: 'brightness(1.1)' },
            }}
          >
            {sending ? 'Enviando…' : `Enviar todos (${pendingClients.length})`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

// ── Helper: build LoteClient[] from items + states ────────────
export function buildLoteClients(
  items: ContentItem[],
  states: Record<number, ItemState>,
  allClients: Client[],
  clientPhones: Record<string, string>,
  statusFilter: number[] = [3],
): LoteClient[] {
  const map: Record<string, LoteItem[]> = {}
  items.forEach(item => {
    const st = states[item.i]?.status ?? item.s
    if (!statusFilter.includes(st)) return
    if (!map[item.c]) map[item.c] = []
    map[item.c].push({ id: item.i, title: states[item.i]?.title || item.n })
  })
  return Object.entries(map).map(([name, its]) => ({
    name,
    items: its,
    phone: clientPhones[name] || allClients.find(c => c.name === name)?.whatsapp,
  }))
}
