/* MonthlyReportModal.tsx — Relatório mensal por cliente com performance
   v2: seletor de cliente, KPIs de engagement, melhor post em destaque,
       export PNG e disparo direto via WhatsApp.
*/
import { useMemo, useRef, useState, useCallback } from 'react'
import {
  Dialog, DialogTitle, DialogContent, Box, Typography, LinearProgress,
  IconButton, Button, CircularProgress, Chip, Stack, Select, MenuItem,
  FormControl, Tooltip, Divider, Paper, DialogActions, Alert,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import GroupIcon from '@mui/icons-material/Group'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { ClientContextStore } from '../lib/clientContext'
import { toPng } from 'html-to-image'
import type { ContentItem, ItemState, Client } from '../types'
import { STATUS_CONFIG } from '../types'

// ── Helpers ────────────────────────────────────────────────
type Eng = { likes?: number; comments?: number; reach?: number; saves?: number }

function calcER(eng: Eng | undefined): number | null {
  if (!eng?.reach) return null
  return ((eng.likes ?? 0) + (eng.comments ?? 0)) / eng.reach * 100
}
function erColor(er: number | null): string {
  if (er === null) return '#52525B'
  if (er >= 5) return '#00C47A'
  if (er >= 2) return '#FFD700'
  return '#FF4545'
}
function fmtBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('pt-BR')
}

const ALL_STATUSES = [0, 1, 2, 3, 4, 5, 6, 7] as const

// ── Props ──────────────────────────────────────────────────
interface Props {
  open:          boolean
  onClose:       () => void
  items:         ContentItem[]
  states:        Record<number, ItemState>
  allClients:    Client[]
  clientPhones?: Record<string, string>
  now:           Date
  initialClient?: string
}

// ── Componente ─────────────────────────────────────────────
export default function MonthlyReportModal({
  open, onClose, items, states, allClients, clientPhones, now, initialClient,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchIdx, setBatchIdx]   = useState(0)
  const [aiSummary, setAiSummary]       = useState('')
  const [aiLoading, setAiLoading]       = useState(false)
  const [aiCopied, setAiCopied]         = useState(false)
  const [aiPanelOpen, setAiPanelOpen]   = useState(false)

  const generateAiSummary = async () => {
    setAiLoading(true)
    setAiPanelOpen(true)
    setAiSummary('')
    try {
      const brandKit = selClient !== '__all__' ? ClientContextStore.get(selClient) : null
      const clientLabel = selClient === '__all__' ? 'todos os clientes' : selClient
      const monthName = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

      const prompt = `Você é um account manager da Digital Scale, agência de marketing digital.
Escreva um resumo executivo do mês de ${monthName} para ${clientLabel}.

DADOS DO MÊS:
- Total de conteúdos: ${stats.total}
- Publicados: ${stats.pub} (${stats.pubRate}%)
- Aprovados pelo cliente: ${stats.approved}
- Reprovados: ${stats.rejected}
- Posts: ${stats.posts} | Reels: ${stats.reels} | Stories: ${stats.stories} | Carrosséis: ${stats.carrossels}
${brandKit ? `\nBRAND KIT DO CLIENTE:
- Segmento: ${brandKit.segmento}
- Objetivo do mês: ${brandKit.objetivoMes || 'não definido'}
- Tom de voz: ${brandKit.tomVoz}` : ''}

FORMATO DO RESUMO:
1. Saudação personalizada e contexto do mês (1 parágrafo)
2. Destaques — o que foi bem (bullet points)
3. Análise — o que pode melhorar
4. Próximos passos — 2-3 ações concretas para o próximo mês
5. Fechamento profissional assinado "Digital Scale"

Tom: profissional mas próximo, em português brasileiro. Pronto para copiar e enviar ao cliente.`

      const key = localStorage.getItem('sm_anthropic_key') ?? ''
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (key) headers['X-Anthropic-Key'] = key
      const res = await fetch('/api/ai', {
        method: 'POST', headers,
        body: JSON.stringify({ system: '', messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json() as { content?: { text: string }[]; error?: { message: string } }
      if (data.error) throw new Error(data.error.message)
      setAiSummary(data.content?.[0]?.text?.trim() ?? 'Erro ao gerar resumo.')
    } catch (e) {
      setAiSummary(`Erro: ${e instanceof Error ? e.message : 'Tente novamente.'}`)
    } finally {
      setAiLoading(false)
    }
  }

  const year  = now.getFullYear()
  const month = now.getMonth()

  const monthItems = useMemo(() =>
    items.filter(i => i.dt.getFullYear() === year && i.dt.getMonth() === month),
  [items, year, month])

  // Seletor de cliente — inicializa com `initialClient` se fornecido
  const clientNames = useMemo(() =>
    [...new Set(monthItems.map(i => i.c))].sort()
  , [monthItems])

  const [selClient, setSelClient] = useState<string>(
    initialClient && clientNames.includes(initialClient) ? initialClient : '__all__'
  )

  // Items filtrados pelo cliente selecionado
  const filtered = useMemo(() =>
    selClient === '__all__' ? monthItems : monthItems.filter(i => i.c === selClient)
  , [monthItems, selClient])

  const published = useMemo(() =>
    filtered.filter(i => (states[i.i]?.status ?? i.s) === 7)
  , [filtered, states])

  // Estatísticas gerais
  const stats = useMemo(() => {
    const byStatus = ALL_STATUSES.map(s =>
      filtered.filter(i => (states[i.i]?.status ?? i.s) === s).length
    )
    const total     = filtered.length
    const pub       = byStatus[7]
    const approved  = byStatus[5]
    const rejected  = byStatus[6]
    const pubRate   = total > 0 ? Math.round(((pub + approved) / total) * 100) : 0
    const posts     = filtered.filter(i => i.tp === 'Post').length
    const reels     = filtered.filter(i => i.tp === 'Reel').length
    const stories   = filtered.filter(i => i.tp === 'Story').length
    const carrossels = filtered.filter(i => i.tp === 'Carrossel').length
    return { byStatus, total, pub, approved, rejected, pubRate, posts, reels, stories, carrossels }
  }, [filtered, states])

  // KPIs de engagement (só publicados)
  const engagement = useMemo(() => {
    const withData = published.filter(i => states[i.i]?.engagement?.reach)
    const reach    = withData.reduce((s, i) => s + (states[i.i].engagement?.reach    ?? 0), 0)
    const likes    = withData.reduce((s, i) => s + (states[i.i].engagement?.likes    ?? 0), 0)
    const comments = withData.reduce((s, i) => s + (states[i.i].engagement?.comments ?? 0), 0)
    const saves    = withData.reduce((s, i) => s + ((states[i.i].engagement as Eng & { saves?: number })?.saves ?? 0), 0)
    const erList   = withData.map(i => calcER(states[i.i].engagement)).filter((e): e is number => e !== null)
    const avgER    = erList.length > 0 ? erList.reduce((a, b) => a + b, 0) / erList.length : null
    const bestItem = withData.reduce<ContentItem | null>((best, i) => {
      const e = calcER(states[i.i].engagement) ?? -1
      return !best || e > (calcER(states[best.i].engagement) ?? -1) ? i : best
    }, null)
    const fillPct  = published.length > 0 ? Math.round((withData.length / published.length) * 100) : 0
    return { withData: withData.length, reach, likes, comments, saves, avgER, bestItem, fillPct }
  }, [published, states])

  // Por cliente (para visão geral)
  const clientStats = useMemo(() => {
    if (selClient !== '__all__') return []
    return clientNames.map(name => {
      const ci       = monthItems.filter(i => i.c === name)
      const byStatus = ALL_STATUSES.map(s => ci.filter(i => (states[i.i]?.status ?? i.s) === s).length)
      const total    = ci.length
      const pub      = byStatus[7]
      const approved = byStatus[5]
      const pubRate  = total > 0 ? Math.round(((pub + approved) / total) * 100) : 0
      const withEng  = ci.filter(i => (states[i.i]?.status ?? i.s) === 7 && states[i.i]?.engagement?.reach)
      const reach    = withEng.reduce((s, i) => s + (states[i.i].engagement?.reach ?? 0), 0)
      const erList   = withEng.map(i => calcER(states[i.i].engagement)).filter((e): e is number => e !== null)
      const avgER    = erList.length > 0 ? erList.reduce((a, b) => a + b, 0) / erList.length : null
      return { name, total, pub, approved, pubRate, reach, avgER, byStatus }
    }).sort((a, b) => b.pubRate - a.pubRate)
  }, [selClient, clientNames, monthItems, states])

  // Export PDF — abre nova aba com imagem em alta res + print automático
  const handlePDF = async () => {
    if (!contentRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(contentRef.current, { backgroundColor: '#0e0e0e', pixelRatio: 2.5 })
      const mLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      const clientLabel = selClient !== '__all__' ? selClient : 'Todos os Clientes'
      const win = window.open('', '_blank')
      if (!win) return
      win.document.write(`<!DOCTYPE html><html><head>
        <meta charset="utf-8">
        <title>Relatório ${mLabel} — ${clientLabel} · Digital Scale</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #0e0e0e; display: flex; align-items: flex-start; justify-content: center; min-height: 100vh; padding: 20px; }
          img { max-width: 900px; width: 100%; height: auto; border-radius: 12px; }
          @media print { @page { size: A4; margin: 8mm; } body { background: white; padding: 0; } img { max-width: 100%; border-radius: 0; } }
        </style>
      </head><body>
        <img src="${dataUrl}" />
        <script>setTimeout(function(){ window.print() }, 400)<\/script>
      </body></html>`)
      win.document.close()
    } catch {}
    finally { setExporting(false) }
  }

  // Export PNG
  const handleExport = async () => {
    if (!contentRef.current) return
    setExporting(true)
    try {
      const clientSuffix = selClient !== '__all__' ? `-${selClient.replace(/\s+/g, '_')}` : ''
      const dataUrl = await toPng(contentRef.current, {
        backgroundColor: '#0e0e0e',
        pixelRatio: 2,
        style: { borderRadius: '0' },
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `relatorio-${now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', '-')}${clientSuffix}.png`
      a.click()
    } catch {}
    finally { setExporting(false) }
  }

  // WhatsApp share
  const handleWhatsApp = () => {
    const phone   = selClient !== '__all__' ? (clientPhones?.[selClient] ?? '') : ''
    const mLabel  = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const client  = selClient !== '__all__' ? selClient : 'todos os clientes'

    let msg = `Olá! 👋 Segue o resumo de *${mLabel}* para *${client}*:\n\n`
    msg += `📊 *Performance do mês:*\n`
    msg += `✅ ${stats.pub} publicações realizadas\n`
    if (engagement.reach > 0) {
      msg += `👁 ${fmtBig(engagement.reach)} pessoas alcançadas\n`
      msg += `❤️ ${fmtBig(engagement.likes)} curtidas + comentários\n`
      if (engagement.avgER !== null) msg += `📈 ${engagement.avgER.toFixed(1)}% de engajamento médio\n`
    }
    if (engagement.bestItem) {
      const best   = engagement.bestItem
      const bestER = calcER(states[best.i]?.engagement)
      msg += `\n🏆 *Destaque do mês:*\n`
      msg += `"${best.n || best.tp}" (${best.tp})\n`
      if (states[best.i]?.engagement?.reach) msg += `→ ${fmtBig(states[best.i].engagement!.reach!)} alcance`
      if (bestER !== null) msg += ` | ${bestER.toFixed(1)}% ER`
      msg += '\n'
    }
    msg += `\n*Digital Scale — Agência de Marketing Digital* 🚀`

    const url = phone
      ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const buildClientMsg = useCallback((clientName: string): string => {
    const mLabel   = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const ci       = monthItems.filter(i => i.c === clientName)
    const pub      = ci.filter(i => (states[i.i]?.status ?? i.s) === 7).length
    const approved = ci.filter(i => (states[i.i]?.status ?? i.s) === 5).length
    const total    = ci.length
    const pubRate  = total > 0 ? Math.round(((pub + approved) / total) * 100) : 0
    const withEng  = ci.filter(i => (states[i.i]?.status ?? i.s) === 7 && states[i.i]?.engagement?.reach)
    const reach    = withEng.reduce((s, i) => s + (states[i.i].engagement?.reach ?? 0), 0)
    const likes    = withEng.reduce((s, i) => s + (states[i.i].engagement?.likes ?? 0), 0)
    const comments = withEng.reduce((s, i) => s + (states[i.i].engagement?.comments ?? 0), 0)
    const erList   = withEng.map(i => calcER(states[i.i].engagement)).filter((e): e is number => e !== null)
    const avgER    = erList.length > 0 ? erList.reduce((a, b) => a + b, 0) / erList.length : null
    const bestItem = withEng.reduce<ContentItem | null>((best, i) => {
      const e = calcER(states[i.i].engagement) ?? -1
      return !best || e > (calcER(states[best.i].engagement) ?? -1) ? i : best
    }, null)

    let msg = `Olá! 👋 Segue o resumo de *${mLabel}* para *${clientName}*:\n\n`
    msg += `📊 *Performance do mês:*\n`
    msg += `✅ ${pub} publicações realizadas de ${total} planejadas\n`
    msg += `📦 Taxa de entrega: ${pubRate}%\n`
    if (reach > 0) {
      msg += `👁 ${fmtBig(reach)} pessoas alcançadas\n`
      msg += `❤️ ${fmtBig(likes + comments)} interações\n`
      if (avgER !== null) msg += `📈 ${avgER.toFixed(1)}% de engajamento médio\n`
    }
    if (bestItem) {
      const bestER = calcER(states[bestItem.i]?.engagement)
      msg += `\n🏆 *Destaque do mês:*\n`
      msg += `"${bestItem.n || bestItem.tp}" (${bestItem.tp})\n`
      if (states[bestItem.i]?.engagement?.reach) msg += `→ ${fmtBig(states[bestItem.i].engagement!.reach!)} alcance`
      if (bestER !== null) msg += ` | ${bestER.toFixed(1)}% ER`
      msg += '\n'
    }
    msg += `\n*Digital Scale — Agência de Marketing Digital* 🚀`
    return msg
  }, [monthItems, states, now])

  const batchClient  = clientNames[batchIdx] ?? ''
  const batchPhone   = clientPhones?.[batchClient] ?? ''
  const batchMsg     = batchClient ? buildClientMsg(batchClient) : ''

  const openBatchWhatsApp = () => {
    const url = batchPhone
      ? `https://wa.me/${batchPhone.replace(/\D/g, '')}?text=${encodeURIComponent(batchMsg)}`
      : `https://wa.me/?text=${encodeURIComponent(batchMsg)}`
    window.open(url, '_blank')
  }

  const monthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: '#0e0e0e', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 3, backgroundImage: 'none' } }}>

      {/* ── Header ──────────────────────────────────────── */}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Box flex={1}>
          <Typography fontWeight={900} sx={{ fontSize: '1.05rem', color: 'primary.main' }}>
            📄 Relatório Mensal
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'capitalize' }}>
            {monthLabel}
          </Typography>
        </Box>

        {/* Seletor de cliente */}
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <Select value={selClient} onChange={e => setSelClient(e.target.value)}
            sx={{ fontSize: '0.78rem', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' } }}>
            <MenuItem value="__all__" sx={{ fontSize: '0.8rem' }}>📊 Visão geral</MenuItem>
            {clientNames.map(c => (
              <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{c}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Resumo IA */}
        <Tooltip title="Gerar resumo executivo do mês com IA">
          <Button size="small"
            startIcon={aiLoading ? <CircularProgress size={11} sx={{ color: '#b45aff' }} /> : <AutoAwesomeIcon sx={{ fontSize: 14 }} />}
            onClick={() => aiPanelOpen ? setAiPanelOpen(false) : generateAiSummary()}
            sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#b45aff', border: `1px solid ${aiPanelOpen ? 'rgba(180,90,255,0.5)' : 'rgba(180,90,255,0.3)'}`, borderRadius: 2, px: 1.2, bgcolor: aiPanelOpen ? 'rgba(180,90,255,0.1)' : 'transparent', '&:hover': { bgcolor: 'rgba(180,90,255,0.1)' } }}>
            {aiLoading ? 'Gerando…' : aiPanelOpen ? 'Ocultar' : 'Resumo IA'}
          </Button>
        </Tooltip>

        {/* Actions */}
        {selClient === '__all__' && clientNames.length > 0 && (
          <Tooltip title="Enviar relatório para todos os clientes via WhatsApp">
            <Button size="small" startIcon={<GroupIcon sx={{ fontSize: 14 }} />}
              onClick={() => { setBatchIdx(0); setBatchOpen(true) }}
              sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#25D366', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 2, px: 1.2, '&:hover': { bgcolor: 'rgba(37,211,102,0.08)' } }}>
              Todos
            </Button>
          </Tooltip>
        )}
        <Tooltip title="Enviar resumo via WhatsApp">
          <IconButton size="small" onClick={handleWhatsApp}
            sx={{ color: '#25D366', '&:hover': { bgcolor: 'rgba(37,211,102,0.1)' } }}>
            <WhatsAppIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
        <Button size="small" onClick={handlePDF} disabled={exporting}
          startIcon={exporting ? <CircularProgress size={11} color="inherit" /> : <PictureAsPdfIcon sx={{ fontSize: 14 }} />}
          sx={{ fontSize: '0.67rem', fontWeight: 600, color: '#FF4545', border: '1px solid rgba(255,69,69,0.3)', '&:hover': { bgcolor: 'rgba(255,69,69,0.07)' } }}>
          PDF
        </Button>
        <Button size="small" onClick={handleExport} disabled={exporting}
          startIcon={exporting ? <CircularProgress size={11} color="inherit" /> : <DownloadIcon sx={{ fontSize: 14 }} />}
          sx={{ fontSize: '0.67rem', fontWeight: 600, color: 'primary.main', border: '1px solid rgba(59,130,246,0.3)', '&:hover': { bgcolor: 'rgba(59,130,246,0.07)' } }}>
          PNG
        </Button>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.disabled' }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      {/* ── Painel de resumo IA ──────────────────────────── */}
      {aiPanelOpen && (
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid rgba(180,90,255,0.15)', bgcolor: 'rgba(180,90,255,0.04)' }}>
          {aiLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
              <CircularProgress size={16} sx={{ color: '#b45aff' }} />
              <Typography sx={{ fontSize: '0.75rem', color: '#b45aff' }}>Claude está escrevendo o resumo…</Typography>
            </Box>
          ) : aiSummary ? (
            <>
              <Typography sx={{ fontSize: '0.82rem', lineHeight: 1.8, color: 'rgba(255,255,255,0.88)', whiteSpace: 'pre-wrap', mb: 1.5 }}>
                {aiSummary}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small"
                  startIcon={aiCopied ? undefined : <ContentCopyIcon sx={{ fontSize: 13 }} />}
                  onClick={() => { navigator.clipboard.writeText(aiSummary); setAiCopied(true); setTimeout(() => setAiCopied(false), 2500) }}
                  sx={{ fontSize: '0.65rem', fontWeight: 700, color: aiCopied ? '#00C47A' : '#b45aff', border: `1px solid ${aiCopied ? 'rgba(0,196,122,0.3)' : 'rgba(180,90,255,0.3)'}`, borderRadius: 1.5, px: 1.5 }}>
                  {aiCopied ? '✓ Copiado!' : 'Copiar resumo'}
                </Button>
                <Button size="small"
                  startIcon={<WhatsAppIcon sx={{ fontSize: 13 }} />}
                  component="a"
                  href={`https://wa.me/?text=${encodeURIComponent(aiSummary)}`}
                  target="_blank" rel="noopener"
                  sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#25D366', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 1.5, px: 1.5 }}>
                  Enviar no WA
                </Button>
                <Button size="small" onClick={generateAiSummary}
                  sx={{ fontSize: '0.62rem', color: 'text.disabled', borderRadius: 1.5 }}>
                  Gerar novamente
                </Button>
              </Box>
            </>
          ) : null}
        </Box>
      )}

      {/* ── Conteúdo exportável ───────────────────────────── */}
      <DialogContent ref={contentRef} sx={{ pt: 2 }}>

        {/* Título do relatório (fica no PNG) */}
        {selClient !== '__all__' && (
          <Box sx={{ mb: 2.5, textAlign: 'center', pb: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Digital Scale · Agência de Marketing Digital
            </Typography>
            <Typography sx={{ fontSize: '1.4rem', fontWeight: 900, color: 'rgba(255,255,255,0.92)', mb: 0.3 }}>
              {selClient}
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: 'primary.main', textTransform: 'capitalize', fontWeight: 600 }}>
              Relatório de Performance — {monthLabel}
            </Typography>
          </Box>
        )}

        {/* ── KPIs de publicação ─────────────────────────── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.2, mb: 2 }}>
          {[
            { label: 'Total planejado', value: stats.total,   color: '#3B82F6' },
            { label: 'Publicados',      value: stats.pub,     color: '#00C47A' },
            { label: 'Taxa de entrega', value: `${stats.pubRate}%`, color: stats.pubRate >= 80 ? '#00C47A' : stats.pubRate >= 50 ? '#FFD700' : '#FF4545' },
            { label: 'Reprovados',      value: stats.rejected, color: stats.rejected > 0 ? '#FF4545' : '#52525B' },
          ].map(({ label, value, color }) => (
            <Paper key={label} sx={{ p: 1.5, textAlign: 'center', border: `1px solid ${color}20`, bgcolor: `${color}07`, borderRadius: 2 }}>
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, color, lineHeight: 1 }}>{value}</Typography>
              <Typography sx={{ fontSize: '0.58rem', color: 'text.secondary', mt: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</Typography>
            </Paper>
          ))}
        </Box>

        {/* Barra de progresso */}
        <Box mb={2}>
          <Stack direction="row" justifyContent="space-between" mb={0.6}>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Taxa de entrega</Typography>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: stats.pubRate >= 80 ? '#00C47A' : '#FFD700' }}>{stats.pubRate}%</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={stats.pubRate}
            sx={{ height: 5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)',
              '& .MuiLinearProgress-bar': { background: stats.pubRate >= 80 ? '#00C47A' : '#FFD700', borderRadius: 3 } }} />
        </Box>

        {/* Tipos de conteúdo */}
        <Stack direction="row" gap={1} mb={2.5} flexWrap="wrap">
          {[
            { label: 'Posts', count: stats.posts, color: '#3B82F6' },
            { label: 'Reels', count: stats.reels, color: '#3B8EFF' },
            { label: 'Stories', count: stats.stories, color: '#C084FC' },
            { label: 'Carrossels', count: stats.carrossels, color: '#FB7185' },
          ].filter(t => t.count > 0).map(t => (
            <Chip key={t.label}
              label={`${t.label}: ${t.count}`} size="small"
              sx={{ fontSize: '0.65rem', height: 22, bgcolor: `${t.color}12`, color: t.color, border: `1px solid ${t.color}25` }} />
          ))}
          {ALL_STATUSES.filter(s => stats.byStatus[s] > 0 && s < 7).map(s => {
            const cfg = STATUS_CONFIG[s]
            return (
              <Chip key={s} label={`${cfg.shortLabel}: ${stats.byStatus[s]}`} size="small"
                sx={{ fontSize: '0.6rem', height: 22, bgcolor: `${cfg.color}10`, color: cfg.color, border: `1px solid ${cfg.color}20` }} />
            )
          })}
        </Stack>

        {/* ── Engagement (se há dados) ───────────────────── */}
        {engagement.withData > 0 && (
          <>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              📊 Performance ({engagement.fillPct}% dos publicados com dados)
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.2, mb: 2 }}>
              {[
                { label: '👁 Alcance', value: fmtBig(engagement.reach), color: '#3B8EFF' },
                { label: '❤️ Curtidas', value: fmtBig(engagement.likes), color: '#FF4545' },
                { label: '💬 Comentários', value: fmtBig(engagement.comments), color: '#60A5FA' },
                { label: '📊 ER médio', value: engagement.avgER !== null ? `${engagement.avgER.toFixed(1)}%` : '—', color: engagement.avgER !== null ? erColor(engagement.avgER) : '#52525B' },
              ].map(({ label, value, color }) => (
                <Paper key={label} sx={{ p: 1.5, textAlign: 'center', border: `1px solid ${color}18`, bgcolor: `${color}07`, borderRadius: 2 }}>
                  <Typography sx={{ fontSize: '1.4rem', fontWeight: 900, color, lineHeight: 1 }}>{value}</Typography>
                  <Typography sx={{ fontSize: '0.58rem', color: 'text.secondary', mt: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Typography>
                </Paper>
              ))}
            </Box>

            {/* Melhor post */}
            {engagement.bestItem && (() => {
              const best  = engagement.bestItem!
              const bEng  = states[best.i]?.engagement
              const bER   = calcER(bEng)
              return (
                <Paper sx={{
                  p: 2, mb: 2,
                  border: '1px solid rgba(255,215,0,0.2)',
                  bgcolor: 'rgba(255,215,0,0.05)',
                  borderRadius: 2,
                  background: 'rgba(255,215,0,0.04)',
                }}>
                  <Stack direction="row" alignItems="center" gap={1} mb={1}>
                    <EmojiEventsIcon sx={{ color: '#FFD700', fontSize: 20 }} />
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#FFD700' }}>
                      🏆 Destaque do mês
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, mb: 0.5 }} noWrap>
                    {best.n || best.tp} — {best.c}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 1.5 }}>
                    {best.tp} · {best.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                  </Typography>
                  <Stack direction="row" gap={2}>
                    {bEng?.reach    && <Box sx={{ textAlign: 'center' }}><Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: '#3B8EFF' }}>{fmtBig(bEng.reach)}</Typography><Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>alcance</Typography></Box>}
                    {bEng?.likes    && <Box sx={{ textAlign: 'center' }}><Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: '#FF4545' }}>{fmtBig(bEng.likes)}</Typography><Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>curtidas</Typography></Box>}
                    {bEng?.comments && <Box sx={{ textAlign: 'center' }}><Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: '#60A5FA' }}>{fmtBig(bEng.comments)}</Typography><Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>comentários</Typography></Box>}
                    {bER !== null   && <Box sx={{ textAlign: 'center' }}><Typography sx={{ fontSize: '1.4rem', fontWeight: 900, color: '#FFD700', textShadow: '0 0 16px rgba(255,215,0,0.5)' }}>{bER.toFixed(1)}%</Typography><Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>engajamento</Typography></Box>}
                  </Stack>
                </Paper>
              )
            })()}
          </>
        )}

        {/* ── Visão geral: por cliente ───────────────────── */}
        {selClient === '__all__' && clientStats.length > 0 && (
          <>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Por cliente ({clientStats.length})
            </Typography>
            <Stack gap={0.9}>
              {clientStats.map(({ name, byStatus, total, pub, approved, pubRate, reach, avgER }) => (
                <Box key={name} sx={{ bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2, p: 1.5 }}>
                  <Stack direction="row" alignItems="center" gap={1} mb={0.8}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, flex: 1 }} noWrap>{name}</Typography>
                    {reach > 0 && <Typography sx={{ fontSize: '0.65rem', color: '#3B8EFF' }}>👁 {fmtBig(reach)}</Typography>}
                    {avgER !== null && <Chip label={`${avgER.toFixed(1)}% ER`} size="small"
                      sx={{ fontSize: '0.58rem', height: 18, bgcolor: `${erColor(avgER)}15`, color: erColor(avgER), border: `1px solid ${erColor(avgER)}25` }} />}
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{total} itens</Typography>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, minWidth: 38, textAlign: 'right',
                      color: pubRate >= 80 ? '#00C47A' : pubRate >= 50 ? '#FFD700' : '#FF4545' }}>
                      {pubRate}%
                    </Typography>
                  </Stack>
                  <Box sx={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.06)' }}>
                    {ALL_STATUSES.map(s => {
                      const pct = total > 0 ? (byStatus[s] / total) * 100 : 0
                      if (pct === 0) return null
                      return <Tooltip key={s} title={`${STATUS_CONFIG[s].label}: ${byStatus[s]}`}>
                        <Box sx={{ width: `${pct}%`, bgcolor: STATUS_CONFIG[s].color, transition: 'width 0.4s' }} />
                      </Tooltip>
                    })}
                  </Box>
                </Box>
              ))}
            </Stack>
          </>
        )}

        {filtered.length === 0 && (
          <Typography sx={{ color: 'text.disabled', textAlign: 'center', py: 4, fontSize: '0.85rem' }}>
            Nenhum conteúdo neste mês.
          </Typography>
        )}
      </DialogContent>
    </Dialog>

    {/* ── Batch WhatsApp Dialog ─────────────────────────── */}
    <Dialog open={batchOpen} onClose={() => setBatchOpen(false)} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: 'rgba(11,11,11,0.97)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 3, backgroundImage: 'none' } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WhatsAppIcon sx={{ color: '#25D366', fontSize: 20 }} />
          <Box flex={1}>
            <Typography fontWeight={900} sx={{ fontSize: '0.9rem', color: '#25D366' }}>
              Envio em lote — WhatsApp
            </Typography>
            <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>
              {batchIdx + 1} de {clientNames.length} clientes
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setBatchOpen(false)} sx={{ color: 'text.disabled' }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
        <LinearProgress variant="determinate" value={clientNames.length > 0 ? ((batchIdx) / clientNames.length) * 100 : 0}
          sx={{ mt: 1.5, height: 4, borderRadius: 2, bgcolor: 'rgba(37,211,102,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#25D366' } }} />
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5 }}>
        {batchIdx >= clientNames.length ? (
          <Alert severity="success" sx={{ fontSize: '0.78rem', bgcolor: 'rgba(0,196,122,0.08)', color: '#00C47A' }}>
            ✅ Todos os {clientNames.length} clientes foram enviados!
          </Alert>
        ) : (
          <>
            <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'rgba(255,255,255,0.92)' }}>
                {batchClient}
              </Typography>
              {batchPhone ? (
                <Chip label={batchPhone} size="small"
                  sx={{ height: 18, fontSize: '0.55rem', bgcolor: 'rgba(37,211,102,0.1)', color: '#25D366', border: '1px solid rgba(37,211,102,0.2)' }} />
              ) : (
                <Chip label="Sem telefone" size="small"
                  sx={{ height: 18, fontSize: '0.55rem', bgcolor: 'rgba(255,69,69,0.1)', color: '#FF4545', border: '1px solid rgba(255,69,69,0.2)' }} />
              )}
            </Box>
            <Paper sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2, mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, whiteSpace: 'pre-line', fontFamily: 'monospace' }}>
                {batchMsg}
              </Typography>
            </Paper>
            <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
              Clique em "Enviar e avançar" para abrir o WhatsApp e ir para o próximo cliente.
            </Typography>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        {batchIdx < clientNames.length && batchIdx > 0 && (
          <Button size="small" onClick={() => setBatchIdx(i => i - 1)}
            sx={{ fontSize: '0.65rem', color: 'text.secondary', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}>
            ← Anterior
          </Button>
        )}
        <Box flex={1} />
        {batchIdx < clientNames.length ? (
          <>
            <Button size="small" onClick={() => setBatchIdx(i => i + 1)}
              sx={{ fontSize: '0.65rem', color: 'text.secondary', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}>
              Pular
            </Button>
            <Button variant="contained" size="small"
              startIcon={<WhatsAppIcon sx={{ fontSize: 14 }} />}
              endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
              onClick={() => { openBatchWhatsApp(); setBatchIdx(i => i + 1) }}
              sx={{ fontWeight: 800, fontSize: '0.72rem', background: '#25D366', color: '#fff', px: 2, borderRadius: 2 }}>
              Enviar e avançar
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={() => setBatchOpen(false)}
            sx={{ fontWeight: 800, fontSize: '0.72rem', background: '#00C47A', color: '#000', px: 2, borderRadius: 2 }}>
            Concluído ✓
          </Button>
        )}
      </DialogActions>
    </Dialog>
    </>
  )
}
