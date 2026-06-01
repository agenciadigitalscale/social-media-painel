import { useState, useCallback, useMemo } from 'react'
import {
  Box, Typography, Grid, Card, Chip, Button, IconButton,
  Collapse, TextField, Tooltip, LinearProgress, Avatar, Badge,
  Stack, Paper, Tab, Tabs, Select, MenuItem,
  FormControl, InputLabel, Snackbar, Alert,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import EditNoteIcon from '@mui/icons-material/EditNote'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import LinkIcon from '@mui/icons-material/Link'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import DeleteIcon from '@mui/icons-material/Delete'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import SendIcon from '@mui/icons-material/Send'
import ArticleIcon from '@mui/icons-material/Article'
import type { Client } from '../types'
import { NAME_MAP, getDisplayName } from '../lib/users'
import { syncToCloud } from '../lib/storage'
import CursorGlow from './CursorGlow'

// ── Nicho de cada cliente ────────────────────────────────────────────────────
const NICHO: Record<string, string> = {
  'Casa de Ração 2 Irmãos': 'Pet Shop', 'Chalés Alto da Represa': 'Turismo Rural',
  "Frango d'Água": 'Restaurante', 'Hidro Elétrica Andrade': 'Elétrica / Solar',
  'Home Elevadores': 'Elevadores', 'Kátia Bigatello': 'Beleza / Maquiagem',
  'Lareiras Grill': 'Restaurante / Grill', 'Luthita': 'Moda Feminina',
  'LuzioPan': 'Fornecedor Panificação', 'Magia dos Temáticos': 'Festas Temáticas',
  'Padaria R.A': 'Padaria Artesanal', 'Pousada Dukuka': 'Hospedagem',
  'Quero Bolo': 'Confeitaria', 'ViniPlas': 'Comunicação Visual',
  'Rosângela Varas': 'Saúde / Medicina', 'Compostela': 'Gastronomia',
  'Suh Maya': 'Música / Forró',
}
const NICHO_COLOR: Record<string, string> = {
  'Pet Shop': '#00C47A', 'Turismo Rural': '#3B8EFF', 'Restaurante': '#ff9039',
  'Elétrica / Solar': '#FFD700', 'Elevadores': '#C084FC', 'Beleza / Maquiagem': '#FB7185',
  'Restaurante / Grill': '#ff5339', 'Moda Feminina': '#E879F9', 'Fornecedor Panificação': '#FBBF24',
  'Festas Temáticas': '#34D399', 'Padaria Artesanal': '#F97316', 'Hospedagem': '#60A5FA',
  'Confeitaria': '#F472B6', 'Comunicação Visual': '#A78BFA', 'Saúde / Medicina': '#10B981',
  'Gastronomia': '#EF4444', 'Música / Forró': '#FBBF24',
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

type ScriptStatus = 'ideia' | 'roteiro' | 'aprovado' | 'filmado'
type MainTab = 'roteiros' | 'docs'

interface Script {
  id: string
  clientName: string
  month: number
  year: number
  type: 'Post' | 'Reel' | 'Story'
  title: string
  hook: string        // Gancho — abertura/primeiros 3s
  body: string        // Desenvolvimento — corpo do roteiro
  cta: string         // Call to action
  notes: string       // Obs visuais, referências
  docLink: string     // Google Docs
  status: ScriptStatus
  aiGenerated: boolean
  createdAt: number
}

const SCRIPT_KEY = 'sm_scripts_v2'
const DOCS_KEY   = 'sm_roteiro_docs'

function loadScripts(): Script[] {
  try { const r = localStorage.getItem(SCRIPT_KEY); if (r) return JSON.parse(r) as Script[] } catch {}
  // migrate old ideas
  try {
    const old = localStorage.getItem('sm_roteiro_ideias_junho_2026')
    if (old) {
      const ideas = JSON.parse(old) as { id: string; clientName: string; type: string; title: string; description: string; status: string; aiGenerated: boolean }[]
      return ideas.map(i => ({
        id: i.id, clientName: i.clientName, month: 5, year: 2026,
        type: i.type as 'Post' | 'Reel', title: i.title,
        hook: '', body: i.description, cta: '', notes: '', docLink: '',
        status: i.status === 'filmado' ? 'filmado' : i.status === 'producao' ? 'roteiro' : 'ideia',
        aiGenerated: i.aiGenerated, createdAt: Date.now(),
      }))
    }
  } catch {}
  return []
}
function saveScripts(s: Script[]) {
  localStorage.setItem(SCRIPT_KEY, JSON.stringify(s))
  syncToCloud(SCRIPT_KEY, s)
}

function loadDocs(): Record<string, string> {
  try { const r = localStorage.getItem(DOCS_KEY); if (r) return JSON.parse(r) as Record<string, string> } catch {}
  return {}
}
function saveDocs(d: Record<string, string>) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(d))
  syncToCloud(DOCS_KEY, d)
}

const STATUS_CFG: Record<ScriptStatus, { label: string; color: string; icon: string }> = {
  ideia:    { label: 'Ideia',     color: '#888',    icon: '💡' },
  roteiro:  { label: 'Roteiro',   color: '#3B8EFF', icon: '✏️' },
  aprovado: { label: 'Aprovado',  color: '#FFD700', icon: '✅' },
  filmado:  { label: 'Filmado',   color: '#00C47A', icon: '🎬' },
}

const FLOW: ScriptStatus[] = ['ideia', 'roteiro', 'aprovado', 'filmado']

interface Props {
  allClients: Client[]
  onAddManyRoteiros?: (clientName: string, list: { title: string; type: 'Post' | 'Reel'; notes?: string }[], year: number, month: number) => void
}

export default function RoteirosIdeaTab({ allClients, onAddManyRoteiros }: Props) {
  const now = new Date()
  const [scripts, setScripts] = useState<Script[]>(loadScripts)
  const [docs, setDocs]       = useState<Record<string, string>>(loadDocs)
  const [mainTab, setMainTab] = useState<MainTab>('roteiros')
  const [year, setYear]       = useState(now.getFullYear())
  const [month, setMonth]     = useState(now.getMonth())
  const [filterClient, setFilterClient] = useState<string>('all')
  const [expanded, setExpanded]         = useState<Record<string, boolean>>({})
  const [aiLoading, setAiLoading]       = useState<Record<string, boolean>>({})
  const [copied, setCopied]             = useState<string | null>(null)
  const [distributing, setDistributing] = useState<Record<string, boolean>>({})
  const [snack, setSnack]               = useState<{ msg: string; ok: boolean } | null>(null)

  const clientNames = useMemo(() => allClients.map(c => c.name), [allClients])

  // ── Month nav ──────────────────────────────────────────────────────────────
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  // ── Scripts for current view ───────────────────────────────────────────────
  const monthScripts = useMemo(() =>
    scripts.filter(s => s.month === month && s.year === year),
    [scripts, month, year]
  )
  const filteredScripts = useMemo(() =>
    filterClient === 'all' ? monthScripts : monthScripts.filter(s => s.clientName === filterClient),
    [monthScripts, filterClient]
  )
  const scriptsByClient = useMemo(() =>
    clientNames.reduce<Record<string, Script[]>>((acc, n) => {
      acc[n] = monthScripts.filter(s => s.clientName === n)
      return acc
    }, {}), [monthScripts, clientNames]
  )

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => ({
    ideia:    monthScripts.filter(s => s.status === 'ideia').length,
    roteiro:  monthScripts.filter(s => s.status === 'roteiro').length,
    aprovado: monthScripts.filter(s => s.status === 'aprovado').length,
    filmado:  monthScripts.filter(s => s.status === 'filmado').length,
    total:    monthScripts.length,
  }), [monthScripts])

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateScript = (id: string, patch: Partial<Script>) => {
    const next = scripts.map(s => s.id === id ? { ...s, ...patch } : s)
    setScripts(next); saveScripts(next)
  }
  const deleteScript = (id: string) => {
    const next = scripts.filter(s => s.id !== id)
    setScripts(next); saveScripts(next)
  }
  const addScript = (clientName: string) => {
    const newScript: Script = {
      id: `s-${Date.now()}`, clientName, month, year,
      type: 'Reel', title: 'Novo roteiro', hook: '', body: '', cta: '',
      notes: '', docLink: '', status: 'ideia', aiGenerated: false, createdAt: Date.now(),
    }
    const next = [...scripts, newScript]
    setScripts(next); saveScripts(next)
    setExpanded(prev => ({ ...prev, [newScript.id]: true }))
  }

  // ── Docs ───────────────────────────────────────────────────────────────────
  const docKey = (client: string, suffix = '') => `${client}-${year}-${month}${suffix}`
  const setDoc = (client: string, url: string, suffix = '') => {
    const next = { ...docs, [docKey(client, suffix)]: url }
    setDocs(next); saveDocs(next)
  }

  // ── AI Generate ───────────────────────────────────────────────────────────
  const generateAI = useCallback(async (clientName: string) => {
    const nicho = NICHO[clientName] ?? clientName
    setAiLoading(prev => ({ ...prev, [clientName]: true }))
    try {
      const existing = monthScripts.filter(s => s.clientName === clientName).map(s => s.title).join(', ')
      const monthName = MONTHS[month]
      const contextHint = month === 4 ? 'Dia das Mães, inverno chegando'
        : month === 5 ? 'Dia dos Namorados 12/6, Festa Junina 24/6, inverno'
        : month === 6 ? 'Inverno, férias escolares'
        : `${monthName} ${year}`

      const prompt = `Você é especialista em roteiros para redes sociais. Gere exatamente 3 roteiros para "${clientName}" (nicho: ${nicho}) para ${monthName} ${year}. Contexto: ${contextHint}. ${existing ? `Não repita: ${existing}.` : ''}

RETORNE SOMENTE o JSON abaixo, sem texto extra, sem markdown, sem \`\`\`:
[{"type":"Reel","title":"titulo aqui","hook":"gancho aqui","body":"desenvolvimento aqui","cta":"cta aqui","notes":"obs visuais aqui"},{"type":"Post","title":"titulo aqui","hook":"gancho aqui","body":"desenvolvimento aqui","cta":"cta aqui","notes":"obs visuais aqui"},{"type":"Reel","title":"titulo aqui","hook":"gancho aqui","body":"desenvolvimento aqui","cta":"cta aqui","notes":"obs visuais aqui"}]`

      const groqKey = localStorage.getItem('sm_groq_key') ?? ''
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (groqKey) headers['X-Groq-Key'] = groqKey

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { content?: { text: string }[]; choices?: { message: { content: string } }[]; response?: string; error?: unknown }
      if (data.error) throw new Error(String(data.error))

      const raw = (data.content?.[0]?.text ?? data.choices?.[0]?.message?.content ?? data.response ?? '').trim()
      // strip markdown code fences if present
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      // extract first JSON array
      const startIdx = cleaned.indexOf('[')
      const endIdx   = cleaned.lastIndexOf(']')
      if (startIdx === -1 || endIdx === -1) throw new Error('Resposta sem JSON válido')
      const parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1)) as { type: string; title: string; hook: string; body: string; cta: string; notes: string }[]
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Array vazio')

      const newOnes: Script[] = parsed.map((p, i) => ({
        id: `ai-${clientName}-${Date.now()}-${i}`, clientName, month, year,
        type: (p.type === 'Post' || p.type === 'Reel') ? p.type : 'Reel',
        title: p.title ?? 'Sem título', hook: p.hook ?? '', body: p.body ?? '',
        cta: p.cta ?? '', notes: p.notes ?? '',
        docLink: '', status: 'ideia', aiGenerated: true, createdAt: Date.now(),
      }))
      const next = [...scripts, ...newOnes]
      setScripts(next); saveScripts(next)
      setSnack({ msg: `✨ ${newOnes.length} roteiros gerados para ${clientName}!`, ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setSnack({ msg: `Erro ao gerar: ${msg}`, ok: false })
    } finally {
      setAiLoading(prev => ({ ...prev, [clientName]: false }))
    }
  }, [scripts, monthScripts, month, year])

  // ── Copy script ────────────────────────────────────────────────────────────
  const copyScript = (s: Script) => {
    const text = `📋 ROTEIRO — ${s.clientName} | ${MONTHS[s.month]} ${s.year}\n🎬 ${s.type}: ${s.title}\n\n🎣 GANCHO:\n${s.hook}\n\n📝 DESENVOLVIMENTO:\n${s.body}\n\n📢 CTA:\n${s.cta}${s.notes ? `\n\n🎥 OBSERVAÇÕES VISUAIS:\n${s.notes}` : ''}`
    navigator.clipboard.writeText(text).catch(() => null)
    setCopied(s.id); setTimeout(() => setCopied(null), 2000)
  }

  // ── Distribute to Kanban ───────────────────────────────────────────────────
  const distributeClient = async (clientName: string) => {
    if (!onAddManyRoteiros) return
    const toDistribute = scriptsByClient[clientName] ?? []
    if (!toDistribute.length) return
    setDistributing(prev => ({ ...prev, [clientName]: true }))
    onAddManyRoteiros(clientName, toDistribute.map(s => ({ title: s.title, type: s.type === 'Story' ? 'Post' : s.type, notes: s.notes })), year, month)
    await new Promise(r => setTimeout(r, 800))
    setDistributing(prev => ({ ...prev, [clientName]: false }))
  }

  // ── Render script editor ───────────────────────────────────────────────────
  const renderScriptEditor = (s: Script) => (
    <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel sx={{ fontSize: '0.75rem' }}>Tipo</InputLabel>
          <Select value={s.type} label="Tipo" onChange={e => updateScript(s.id, { type: e.target.value as 'Post' | 'Reel' })} sx={{ fontSize: '0.8rem' }}>
            <MenuItem value="Post">📷 Post</MenuItem>
            <MenuItem value="Reel">🎬 Reel</MenuItem>
            <MenuItem value="Story">📲 Story</MenuItem>
          </Select>
        </FormControl>
        <TextField size="small" fullWidth label="Título do conteúdo" value={s.title}
          onChange={e => updateScript(s.id, { title: e.target.value })}
          sx={{ '& .MuiInputBase-input': { fontSize: '0.82rem' } }} />
      </Stack>

      {/* Script sections */}
      <Box sx={{ bgcolor: 'rgba(59,142,255,0.05)', border: '1px solid rgba(59,142,255,0.15)', borderRadius: 1.5, p: 1.5 }}>
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#3B8EFF', mb: 0.8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          🎣 Gancho — primeiros 3 segundos
        </Typography>
        <TextField size="small" fullWidth multiline minRows={1} maxRows={3}
          placeholder="Frase de abertura que prende imediatamente..."
          value={s.hook} onChange={e => updateScript(s.id, { hook: e.target.value })}
          sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem' } }} />
      </Box>

      <Box sx={{ bgcolor: 'rgba(255,144,57,0.05)', border: '1px solid rgba(255,144,57,0.15)', borderRadius: 1.5, p: 1.5 }}>
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#ff9039', mb: 0.8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          📝 Desenvolvimento — corpo do roteiro
        </Typography>
        <TextField size="small" fullWidth multiline minRows={3} maxRows={10}
          placeholder="Estruture o conteúdo: parte 1, parte 2, parte 3..."
          value={s.body} onChange={e => updateScript(s.id, { body: e.target.value })}
          sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem' } }} />
      </Box>

      <Box sx={{ bgcolor: 'rgba(0,196,122,0.05)', border: '1px solid rgba(0,196,122,0.15)', borderRadius: 1.5, p: 1.5 }}>
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#00C47A', mb: 0.8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          📢 CTA — Call to action
        </Typography>
        <TextField size="small" fullWidth multiline minRows={1} maxRows={3}
          placeholder="O que o seguidor deve fazer: salvar, comentar, clicar no link..."
          value={s.cta} onChange={e => updateScript(s.id, { cta: e.target.value })}
          sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem' } }} />
      </Box>

      <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 1.5, p: 1.5 }}>
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#C084FC', mb: 0.8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          🎥 Observações visuais
        </Typography>
        <TextField size="small" fullWidth multiline minRows={1} maxRows={4}
          placeholder="Direções de câmera, locação, referências visuais, trilha sugerida..."
          value={s.notes} onChange={e => updateScript(s.id, { notes: e.target.value })}
          sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem' } }} />
      </Box>

      {/* Doc link + actions */}
      <Stack direction="row" gap={1} alignItems="center">
        <LinkIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '1rem', flexShrink: 0 }} />
        <TextField size="small" fullWidth
          placeholder="Link do Google Docs..."
          value={s.docLink} onChange={e => updateScript(s.id, { docLink: e.target.value })}
          sx={{ '& .MuiInputBase-input': { fontSize: '0.78rem' } }} />
        {s.docLink && (
          <Tooltip title="Abrir Doc"><IconButton size="small" onClick={() => window.open(s.docLink, '_blank')}>
            <OpenInNewIcon sx={{ fontSize: '0.9rem' }} />
          </IconButton></Tooltip>
        )}
      </Stack>

      {/* Status flow */}
      <Stack direction="row" gap={0.6} alignItems="center" flexWrap="wrap">
        <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mr: 0.5 }}>Status:</Typography>
        {FLOW.map(st => {
          const cfg = STATUS_CFG[st]
          const active = s.status === st
          return (
            <Chip key={st} label={`${cfg.icon} ${cfg.label}`} size="small" clickable
              onClick={() => updateScript(s.id, { status: st })}
              sx={{
                height: 22, fontSize: '0.65rem', fontWeight: active ? 800 : 500,
                bgcolor: active ? `${cfg.color}25` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${active ? cfg.color : 'rgba(255,255,255,0.12)'}`,
                color: active ? cfg.color : 'text.secondary',
                transition: 'all 0.15s',
              }} />
          )
        })}
        <Box sx={{ flex: 1 }} />
        <Tooltip title={copied === s.id ? 'Copiado!' : 'Copiar roteiro'}>
          <IconButton size="small" onClick={() => copyScript(s)} sx={{ p: 0.4 }}>
            {copied === s.id ? <CheckCircleIcon sx={{ fontSize: '1rem', color: '#00C47A' }} /> : <ContentCopyIcon sx={{ fontSize: '1rem' }} />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Excluir roteiro">
          <IconButton size="small" onClick={() => deleteScript(s.id)} sx={{ p: 0.4, color: 'rgba(255,255,255,0.25)', '&:hover': { color: '#FF4545' } }}>
            <DeleteIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  )

  // ── Render per-client section in Roteiros tab ──────────────────────────────
  const renderClientSection = (clientName: string) => {
    const clientScripts = filterClient === 'all'
      ? monthScripts.filter(s => s.clientName === clientName)
      : filteredScripts.filter(s => s.clientName === clientName)
    const nicho     = NICHO[clientName] ?? '–'
    const nichoColor = NICHO_COLOR[nicho] ?? '#888'
    const isLoading  = aiLoading[clientName] ?? false
    const isDistrib  = distributing[clientName] ?? false
    const filmed     = clientScripts.filter(s => s.status === 'filmado').length
    const approved   = clientScripts.filter(s => s.status === 'aprovado').length
    if (filterClient !== 'all' && filterClient !== clientName) return null

    return (
      <Card key={clientName} sx={{
        mb: 2,
        bgcolor: `${nichoColor}06`,
        border: `1px solid ${nichoColor}18`,
        borderRadius: 2.5,
        overflow: 'visible',
        boxShadow: `0 2px 16px ${nichoColor}08`,
        transition: 'box-shadow 0.2s ease',
        '&:hover': { boxShadow: `0 4px 24px ${nichoColor}14` },
      }}>
        {/* Client header */}
        <Box sx={{
          px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
          borderBottom: `1px solid ${nichoColor}14`,
          bgcolor: `${nichoColor}06`,
          position: 'relative', overflow: 'hidden',
          '&::before': {
            content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
            bgcolor: nichoColor, opacity: 0.7,
            borderRadius: '2px 0 0 2px',
          },
          '&::after': {
            content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
            background: `linear-gradient(90deg, transparent, ${nichoColor}55 50%, transparent)`,
            pointerEvents: 'none',
          },
        }}>
          <Box sx={{
            width: 12, height: 12, borderRadius: '50%', flexShrink: 0, ml: 0.5,
            bgcolor: nichoColor, boxShadow: `0 0 10px ${nichoColor}80`,
          }} />
          <Typography fontWeight={800} sx={{ fontSize: { xs: '0.9rem', xl: '1rem' }, flex: 1, letterSpacing: '-0.01em' }}>
            {clientName}
          </Typography>
          <Chip label={nicho} size="small" sx={{ height: 20, fontSize: '0.62rem', fontWeight: 700, bgcolor: `${nichoColor}18`, color: nichoColor, border: `1px solid ${nichoColor}35` }} />

          {/* Progress mini pills */}
          {clientScripts.length > 0 && (
            <Stack direction="row" gap={0.5}>
              {filmed > 0 && <Chip label={`🎬 ${filmed}`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(0,196,122,0.15)', color: '#00C47A' }} />}
              {approved > 0 && <Chip label={`✅ ${approved}`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(255,215,0,0.15)', color: '#FFD700' }} />}
              <Chip label={`${clientScripts.length} roteiros`} size="small" sx={{ height: 18, fontSize: '0.6rem' }} />
            </Stack>
          )}

          {/* Actions */}
          <Button size="small" startIcon={<AddIcon />} onClick={() => addScript(clientName)}
            sx={{ fontSize: '0.7rem', py: 0.3, px: 1, minWidth: 'auto', bgcolor: 'rgba(255,144,57,0.1)', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,144,57,0.2)' } }}>
            Novo
          </Button>
          <Button size="small" startIcon={isLoading ? undefined : <AutoAwesomeIcon />} onClick={() => generateAI(clientName)} disabled={isLoading}
            sx={{ fontSize: '0.7rem', py: 0.3, px: 1, minWidth: 'auto', bgcolor: 'rgba(59,142,255,0.1)', color: '#3B8EFF', '&:hover': { bgcolor: 'rgba(59,142,255,0.2)' } }}>
            {isLoading ? 'Gerando…' : 'Gerar IA'}
          </Button>
          {onAddManyRoteiros && clientScripts.length > 0 && (
            <Tooltip title="Distribuir roteiros no Kanban">
              <Button size="small" startIcon={<SendIcon />} onClick={() => distributeClient(clientName)} disabled={isDistrib}
                sx={{ fontSize: '0.7rem', py: 0.3, px: 1, minWidth: 'auto', bgcolor: 'rgba(0,196,122,0.1)', color: '#00C47A', '&:hover': { bgcolor: 'rgba(0,196,122,0.2)' } }}>
                {isDistrib ? 'Distribuindo…' : 'Distribuir'}
              </Button>
            </Tooltip>
          )}
        </Box>

        {/* Scripts list */}
        <Box sx={{ px: 2, py: clientScripts.length > 0 ? 1.5 : 1 }}>
          {clientScripts.length === 0 ? (
            <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', textAlign: 'center', py: 1.5 }}>
              Nenhum roteiro para {MONTHS[month]}. Clique em "Novo" ou "Gerar IA".
            </Typography>
          ) : (
            <Stack gap={1}>
              {clientScripts.map(s => {
                const cfg   = STATUS_CFG[s.status]
                const isExp = expanded[s.id] ?? false
                return (
                  <Paper key={s.id} sx={{
                    p: 1.2, borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: s.status === 'filmado' ? 'rgba(0,196,122,0.2)'
                      : s.status === 'aprovado' ? 'rgba(255,215,0,0.2)'
                      : s.status === 'roteiro'  ? 'rgba(59,142,255,0.2)'
                      : 'rgba(255,255,255,0.07)',
                    bgcolor: s.aiGenerated ? 'rgba(59,142,255,0.04)' : 'rgba(255,255,255,0.03)',
                    transition: 'all 0.28s ease',
                    position: 'relative',
                    '&::after': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: s.status === 'filmado' ? 'linear-gradient(90deg, transparent, rgba(0,196,122,0.55) 30%, rgba(0,196,122,0.88) 50%, rgba(0,196,122,0.55) 70%, transparent)' : s.status === 'aprovado' ? 'linear-gradient(90deg, transparent, rgba(255,215,0,0.55) 30%, rgba(255,215,0,0.88) 50%, rgba(255,215,0,0.55) 70%, transparent)' : s.status === 'roteiro' ? 'linear-gradient(90deg, transparent, rgba(59,142,255,0.55) 30%, rgba(59,142,255,0.88) 50%, rgba(59,142,255,0.55) 70%, transparent)' : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10) 30%, rgba(255,255,255,0.16) 50%, rgba(255,255,255,0.10) 70%, transparent)', pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit' },
                    '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 32px rgba(0,0,0,0.55)' },
                  }}>
                    {/* Row header */}
                    <Stack direction="row" alignItems="center" gap={0.8}>
                      <Typography sx={{ fontSize: '0.85rem' }}>
                        {s.type === 'Reel' ? '🎬' : s.type === 'Story' ? '📲' : '📷'}
                      </Typography>
                      <Typography fontWeight={600} sx={{ fontSize: '0.82rem', flex: 1 }} noWrap={!isExp}>
                        {s.title}
                        {s.aiGenerated && <Chip label="IA" size="small" sx={{ ml: 0.5, height: 14, fontSize: '0.52rem', bgcolor: 'rgba(59,142,255,0.2)', color: '#3B8EFF', px: 0 }} />}
                      </Typography>
                      <Chip label={`${cfg.icon} ${cfg.label}`} size="small"
                        sx={{ height: 20, fontSize: '0.62rem', bgcolor: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }} />
                      <IconButton size="small" onClick={() => setExpanded(prev => ({ ...prev, [s.id]: !prev[s.id] }))} sx={{ p: 0.3 }}>
                        {isExp ? <ExpandLessIcon sx={{ fontSize: '1rem' }} /> : <ExpandMoreIcon sx={{ fontSize: '1rem' }} />}
                      </IconButton>
                    </Stack>

                    {/* Collapsed preview */}
                    {!isExp && s.hook && (
                      <Typography variant="caption" color="text.disabled" sx={{ pl: 2.8, fontSize: '0.68rem', display: 'block', mt: 0.3 }} noWrap>
                        🎣 {s.hook}
                      </Typography>
                    )}

                    {/* Full editor */}
                    <Collapse in={isExp}>
                      {renderScriptEditor(s)}
                    </Collapse>
                  </Paper>
                )
              })}
            </Stack>
          )}
        </Box>
      </Card>
    )
  }

  // ── Docs tab ───────────────────────────────────────────────────────────────
  const renderDocsTab = () => (
    <Grid container spacing={2}>
      {clientNames.map(clientName => {
        const nicho      = NICHO[clientName] ?? '–'
        const nichoColor = NICHO_COLOR[nicho] ?? '#888'
        const scriptDoc  = docs[docKey(clientName)] ?? ''
        const refDoc     = docs[docKey(clientName, '-ref')] ?? ''
        const count      = scriptsByClient[clientName]?.length ?? 0
        const filmed     = scriptsByClient[clientName]?.filter(s => s.status === 'filmado').length ?? 0

        return (
          <Grid item xs={12} md={6} xl={4} key={clientName}>
            <Card sx={{
              bgcolor: 'rgba(255,255,255,0.025)',
              border: `1px solid rgba(255,255,255,0.07)`,
              borderRadius: 2.5,
              transition: 'all 0.28s ease',
              position: 'relative',
              '&::after': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10) 30%, rgba(255,255,255,0.16) 50%, rgba(255,255,255,0.10) 70%, transparent)', pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit' },
              '&:hover': { borderColor: `${nichoColor}30`, transform: 'translateY(-3px)', boxShadow: '0 10px 32px rgba(0,0,0,0.55)' },
            }}>
              <Box sx={{ p: 1.8 }}>
                <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: nichoColor, flexShrink: 0 }} />
                  <Typography fontWeight={700} sx={{ fontSize: '0.88rem', flex: 1 }}>{clientName}</Typography>
                  <Chip label={nicho} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: `${nichoColor}15`, color: nichoColor }} />
                  {count > 0 && (
                    <Badge badgeContent={filmed} color="success" max={99}>
                      <Chip label={`${count} roteiros`} size="small" sx={{ height: 18, fontSize: '0.6rem' }} />
                    </Badge>
                  )}
                </Stack>

                {/* Script doc */}
                <Box sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#FB7185', mb: 0.6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    ✏️ Roteiros — Google Docs
                  </Typography>
                  <Stack direction="row" gap={0.8} alignItems="center">
                    <ArticleIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '1rem', flexShrink: 0 }} />
                    <TextField size="small" fullWidth
                      placeholder="Cole o link do Google Docs..."
                      value={scriptDoc}
                      onChange={e => setDoc(clientName, e.target.value)}
                      sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.6 } }} />
                    {scriptDoc && (
                      <Tooltip title="Abrir">
                        <IconButton size="small" onClick={() => window.open(scriptDoc, '_blank')}>
                          <OpenInNewIcon sx={{ fontSize: '1rem', color: '#FB7185' }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Box>

                {/* Reference doc */}
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#3B8EFF', mb: 0.6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    📌 Referência / Briefing
                  </Typography>
                  <Stack direction="row" gap={0.8} alignItems="center">
                    <LinkIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '1rem', flexShrink: 0 }} />
                    <TextField size="small" fullWidth
                      placeholder="Cole o link de referência..."
                      value={refDoc}
                      onChange={e => setDoc(clientName, e.target.value, '-ref')}
                      sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.6 } }} />
                    {refDoc && (
                      <Tooltip title="Abrir">
                        <IconButton size="small" onClick={() => window.open(refDoc, '_blank')}>
                          <OpenInNewIcon sx={{ fontSize: '1rem', color: '#3B8EFF' }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Box>
              </Box>
            </Card>
          </Grid>
        )
      })}
    </Grid>
  )

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3.5 }, maxWidth: 1800, mx: 'auto', position: 'relative' }}>
      <CursorGlow color="rgba(255,144,57,0.05)" size={420} />

      {/* ── Header ── */}
      <Paper sx={{
        p: { xs: 1.5, md: 2, xl: 2.5 }, mb: 2.5,
        background: 'linear-gradient(135deg, rgba(251,113,133,0.1) 0%, rgba(59,142,255,0.1) 100%)',
        border: '1px solid rgba(251,113,133,0.18)',
        borderRadius: 3,
        position: 'relative',
        '&::after': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(251,113,133,0.55) 30%, rgba(251,113,133,0.88) 50%, rgba(251,113,133,0.55) 70%, transparent)', pointerEvents: 'none', zIndex: 1, borderRadius: 'inherit' },
      }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} gap={2}>
          {/* Title + team */}
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" alignItems="center" gap={1.5} mb={0.5}>
              <EditNoteIcon sx={{ color: '#FB7185', fontSize: { xs: '1.3rem', xl: '1.6rem' } }} />
              <Typography fontWeight={800} sx={{ fontSize: { xs: '1rem', xl: '1.3rem' } }}>
                Central de Roteiros
              </Typography>
            </Stack>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {(['kerges', 'geovana'] as const).map(key => {
                const u = NAME_MAP[key]
                return (
                  <Chip key={key}
                    avatar={<Avatar sx={{ bgcolor: u.color, fontSize: '0.7rem', width: 20, height: 20 }}>{u.emoji}</Avatar>}
                    label={getDisplayName(key)}
                    size="small"
                    sx={{ bgcolor: `${u.color}18`, border: `1px solid ${u.color}35`, color: u.color, fontWeight: 600, fontSize: '0.72rem', height: 22 }}
                  />
                )
              })}
            </Stack>
          </Box>

          {/* Month navigation */}
          <Stack direction="row" alignItems="center" gap={0.5}>
            <IconButton size="small" onClick={prevMonth} sx={{ bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
              <NavigateBeforeIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
            <Box sx={{
              px: 2, py: 0.6, borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(251,113,133,0.2), rgba(59,142,255,0.2))',
              border: '1px solid rgba(251,113,133,0.3)',
              minWidth: 130, textAlign: 'center',
            }}>
              <Typography fontWeight={800} sx={{ fontSize: '0.88rem', letterSpacing: '0.02em' }}>
                {MONTHS[month]} {year}
              </Typography>
            </Box>
            <IconButton size="small" onClick={nextMonth} sx={{ bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
              <NavigateNextIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          </Stack>

          {/* KPIs */}
          <Stack direction="row" gap={1.5} flexWrap="wrap">
            {FLOW.map(st => {
              const cfg = STATUS_CFG[st]
              const count = kpis[st]
              return (
                <Box key={st} sx={{ textAlign: 'center', minWidth: 48 }}>
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: cfg.color, lineHeight: 1 }}>
                    {count}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>{cfg.icon} {cfg.label}</Typography>
                </Box>
              )
            })}
            <Box sx={{ textAlign: 'center', minWidth: 48 }}>
              <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: '#FB7185', lineHeight: 1 }}>
                {kpis.total}
              </Typography>
              <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>Total</Typography>
            </Box>
          </Stack>
        </Stack>

        {/* Progress bar */}
        {kpis.total > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <LinearProgress variant="determinate" value={(kpis.filmado / kpis.total) * 100}
              sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.08)',
                '& .MuiLinearProgress-bar': { bgcolor: '#00C47A', borderRadius: 2 } }} />
            <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', mt: 0.4 }}>
              {Math.round((kpis.filmado / kpis.total) * 100)}% filmados · {kpis.roteiro + kpis.aprovado} prontos para gravar
            </Typography>
          </Box>
        )}
      </Paper>

      {/* ── Main tabs ── */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <Tabs value={mainTab} onChange={(_, v) => setMainTab(v as MainTab)}
          sx={{ '& .MuiTab-root': { fontSize: '0.8rem', minWidth: 110, py: 0.8 }, minHeight: 38 }}>
          <Tab value="roteiros" label="✏️ Roteiros" />
          <Tab value="docs" label="📄 Docs" />
        </Tabs>

        {/* Client filter (only in roteiros tab) */}
        {mainTab === 'roteiros' && (
          <Stack direction="row" gap={0.6} flexWrap="wrap" alignItems="center">
            <Chip label="Todos" size="small" clickable
              onClick={() => setFilterClient('all')}
              sx={{ height: 24, fontSize: '0.7rem', bgcolor: filterClient === 'all' ? 'rgba(255,144,57,0.2)' : 'rgba(255,255,255,0.05)', border: filterClient === 'all' ? '1px solid rgba(255,144,57,0.5)' : '1px solid rgba(255,255,255,0.1)', color: filterClient === 'all' ? 'primary.main' : 'text.secondary', fontWeight: filterClient === 'all' ? 700 : 400 }} />
            {clientNames.map(n => {
              const count = scriptsByClient[n]?.length ?? 0
              const active = filterClient === n
              return (
                <Chip key={n} label={count > 0 ? `${n.split(' ')[0]} (${count})` : n.split(' ')[0]} size="small" clickable
                  onClick={() => setFilterClient(n)}
                  sx={{ height: 24, fontSize: '0.68rem',
                    bgcolor: active ? 'rgba(255,144,57,0.15)' : 'rgba(255,255,255,0.04)',
                    border: active ? '1px solid rgba(255,144,57,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    color: active ? 'primary.main' : 'text.secondary',
                    fontWeight: active ? 700 : 400,
                  }} />
              )
            })}
          </Stack>
        )}
      </Stack>

      {/* ── Content ── */}
      {mainTab === 'roteiros' ? (
        <Box>
          {clientNames.map(cn => renderClientSection(cn))}
        </Box>
      ) : (
        renderDocsTab()
      )}

      <Box sx={{ height: 80 }} />

      <Snackbar
        open={snack !== null}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack?.ok ? 'success' : 'error'} onClose={() => setSnack(null)} sx={{ fontSize: '0.82rem' }}>
          {snack?.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
