import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Box, Typography, Paper, TextField, IconButton, Chip,
  CircularProgress, Tooltip, Button, Avatar, Dialog,
  DialogContent, DialogTitle,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import CloseIcon from '@mui/icons-material/Close'
import type { Client, ContentItem, ItemState } from '../types'
import { AGENTS, callAgentAI, type DSAgent, type AgentMessage, type AgentContext } from '../lib/agents'
import CursorGlow from './CursorGlow'
import AgenciaOrchestrator from './AgenciaOrchestrator'

interface Props {
  allClients: Client[]
  items: ContentItem[]
  states: Record<number, ItemState>
  currentUser?: string
}

// ── Markdown renderer ──────────────────────────────────────────────────────────

function inlineMd(text: string, key?: number): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('`') && p.endsWith('`')) return (
      <Box key={i} component="code" sx={{ bgcolor: 'rgba(255,255,255,0.08)', px: 0.5, borderRadius: 0.5, fontSize: '0.8em', fontFamily: 'monospace' }}>{p.slice(1, -1)}</Box>
    )
    return p
  })
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const rows = lines.filter(l => l.trim().startsWith('|'))
  if (rows.length < 2) return null
  const header = rows[0].split('|').filter(Boolean).map(c => c.trim())
  const body = rows.slice(2).map(r => r.split('|').filter(Boolean).map(c => c.trim()))
  return (
    <Box sx={{ overflowX: 'auto', mb: 1, mt: 0.5 }}>
      <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.72rem' }}>
        <Box component="thead">
          <Box component="tr">
            {header.map((h, i) => (
              <Box key={i} component="th" sx={{ px: 1, py: 0.5, textAlign: 'left', fontWeight: 700, color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.12)', whiteSpace: 'nowrap' }}>
                {inlineMd(h)}
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {body.map((row, ri) => (
            <Box component="tr" key={ri} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
              {row.map((cell, ci) => (
                <Box key={ci} component="td" sx={{ px: 1, py: 0.5, color: 'rgba(255,255,255,0.78)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {inlineMd(cell)}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

function renderMd(text: string): React.ReactNode {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const raw = lines[i]
    const t = raw.trim()

    if (!t) { nodes.push(<Box key={i} sx={{ height: 5 }} />); i++; continue }

    // Code block
    if (t.startsWith('```')) {
      const lang = t.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) { codeLines.push(lines[i]); i++ }
      i++
      nodes.push(
        <Box key={`code-${i}`} sx={{ borderRadius: 1.5, overflow: 'hidden', mb: 1, mt: 0.5 }}>
          {lang && <Box sx={{ px: 1.2, py: 0.3, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: '6px 6px 0 0' }}><Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lang}</Typography></Box>}
          <Box component="pre" sx={{ m: 0, px: 1.5, py: 1.2, bgcolor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: lang ? '0 0 6px 6px' : 1.5, overflowX: 'auto', scrollbarWidth: 'thin' }}>
            <Box component="code" sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.82)', fontFamily: '"JetBrains Mono", "Fira Code", monospace', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {codeLines.join('\n')}
            </Box>
          </Box>
        </Box>
      )
      continue
    }

    // Table block
    if (t.includes('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().includes('|')) { tableLines.push(lines[i]); i++ }
      nodes.push(<MarkdownTable key={`table-${i}`} lines={tableLines} />)
      continue
    }

    // H2
    if (t.startsWith('## ')) {
      nodes.push(<Typography key={i} sx={{ fontWeight: 900, fontSize: '0.9rem', color: '#fff', mt: 1.5, mb: 0.5, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{inlineMd(t.slice(3))}</Typography>)
      i++; continue
    }
    // H3
    if (t.startsWith('### ')) {
      nodes.push(<Typography key={i} sx={{ fontWeight: 800, fontSize: '0.78rem', color: 'rgba(255,255,255,0.9)', mt: 1, mb: 0.3, letterSpacing: '-0.01em' }}>{inlineMd(t.slice(4))}</Typography>)
      i++; continue
    }
    // H1
    if (t.startsWith('# ')) {
      nodes.push(<Typography key={i} sx={{ fontWeight: 900, fontSize: '1rem', color: '#fff', mt: 1, mb: 0.5, letterSpacing: '-0.03em' }}>{inlineMd(t.slice(2))}</Typography>)
      i++; continue
    }
    // HR
    if (/^[-*]{3,}$/.test(t)) {
      nodes.push(<Box key={i} sx={{ height: '1px', bgcolor: 'rgba(255,255,255,0.08)', my: 1 }} />)
      i++; continue
    }
    // Checkbox
    if (t.startsWith('- [ ] ') || t.startsWith('- [x] ')) {
      const checked = t.startsWith('- [x] ')
      nodes.push(
        <Box key={i} sx={{ display: 'flex', gap: 0.8, mb: 0.3, alignItems: 'flex-start' }}>
          <Box sx={{ width: 12, height: 12, mt: 0.35, borderRadius: 0.5, border: '1.5px solid rgba(255,255,255,0.3)', bgcolor: checked ? 'rgba(0,196,122,0.3)' : 'transparent', flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.8rem', color: checked ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.82)', lineHeight: 1.55, textDecoration: checked ? 'line-through' : 'none' }}>{inlineMd(t.slice(6))}</Typography>
        </Box>
      )
      i++; continue
    }
    // Bullet
    if (t.startsWith('• ') || t.startsWith('- ') || t.startsWith('* ')) {
      const content = t.startsWith('• ') ? t.slice(2) : t.slice(2)
      nodes.push(
        <Box key={i} sx={{ display: 'flex', gap: 0.8, mb: 0.3, alignItems: 'flex-start' }}>
          <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.4)', mt: 0.65, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.55 }}>{inlineMd(content)}</Typography>
        </Box>
      )
      i++; continue
    }
    // Numbered list
    if (/^\d+\.\s/.test(t)) {
      const num = t.match(/^(\d+)\.\s/)![1]
      const content = t.replace(/^\d+\.\s/, '')
      nodes.push(
        <Box key={i} sx={{ display: 'flex', gap: 0.8, mb: 0.3, alignItems: 'flex-start' }}>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: 'rgba(255,255,255,0.45)', mt: 0.2, minWidth: 14, textAlign: 'right', flexShrink: 0 }}>{num}.</Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.55 }}>{inlineMd(content)}</Typography>
        </Box>
      )
      i++; continue
    }

    // Regular
    nodes.push(
      <Typography key={i} sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.65, mb: 0.1 }}>
        {inlineMd(t)}
      </Typography>
    )
    i++
  }

  return <>{nodes}</>
}

// ── Skill Dialog ───────────────────────────────────────────────────────────────

function SkillDialog({ agent, open, onClose, onSend, ctx }: {
  agent: DSAgent
  open: boolean
  onClose: () => void
  onSend: (prompt: string) => void
  ctx: AgentContext
}) {
  const [values, setValues] = useState<Record<string, string>>({})

  const handleClose = () => {
    onClose()
    setTimeout(() => setValues({}), 300)
  }

  const handleSend = () => {
    const prompt = agent.skill.buildPrompt(values, ctx)
    onSend(prompt)
    handleClose()
  }

  const filled = agent.skill.fields
    .filter(f => !f.placeholder.startsWith('Ex'))
    .every(f => values[f.key]?.trim())
  const mainFilled = values[agent.skill.fields[0]?.key ?? '']?.trim()

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'rgba(11,11,11,0.98)', backdropFilter: 'blur(40px)',
          border: `1px solid ${agent.color}25`, borderRadius: 3,
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{
          px: 2.5, py: 1.8, borderBottom: `1px solid ${agent.color}18`,
          display: 'flex', alignItems: 'flex-start', gap: 1.2,
          background: `linear-gradient(180deg, ${agent.color}08 0%, transparent 100%)`,
          position: 'relative',
          '&::after': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${agent.color}66 50%, transparent)`, pointerEvents: 'none' },
        }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: `${agent.color}18`, border: `1.5px solid ${agent.color}44`,
            boxShadow: `0 0 16px ${agent.glow}`, fontSize: '1.2rem', lineHeight: 1, flexShrink: 0,
          }}>
            {agent.skill.icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontWeight: 900, fontSize: '0.92rem', color: agent.color, lineHeight: 1 }}>
                {agent.skill.name}
              </Typography>
              <Chip label={agent.skill.badge} size="small" sx={{ height: 16, fontSize: '0.48rem', fontWeight: 700, bgcolor: `${agent.color}22`, color: agent.color, border: `1px solid ${agent.color}40` }} />
            </Box>
            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', mt: 0.5, lineHeight: 1.5 }}>
              {agent.skill.description}
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleClose} sx={{ color: 'rgba(255,255,255,0.35)', p: 0.4, mt: -0.3, ml: 0.5 }}>
            <CloseIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, py: 2 }}>
        <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: `${agent.color}0a`, border: `1px solid ${agent.color}20`, mb: 2 }}>
          <Typography sx={{ fontSize: '0.65rem', color: agent.color + 'cc', lineHeight: 1.5 }}>
            💡 {agent.skill.tip}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {agent.skill.fields.map(field => (
            <TextField
              key={field.key}
              label={field.label}
              value={values[field.key] ?? ''}
              onChange={e => setValues(p => ({ ...p, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              multiline={field.multiline}
              rows={field.rows}
              size="small"
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '0.8rem', borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.04)',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: `${agent.color}44` },
                  '&.Mui-focused fieldset': { borderColor: `${agent.color}88`, borderWidth: 1.5 },
                },
                '& .MuiInputLabel-root': { fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' },
                '& .MuiInputLabel-root.Mui-focused': { color: agent.color },
              }}
            />
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2.5 }}>
          <Button onClick={handleClose} size="small" sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={!mainFilled}
            startIcon={<ElectricBoltIcon sx={{ fontSize: 13 }} />}
            size="small"
            sx={{
              fontSize: '0.7rem', fontWeight: 800, borderRadius: 2, px: 2,
              background: `linear-gradient(135deg, ${agent.color}, ${agent.color}bb)`,
              color: '#000',
              boxShadow: `0 4px 14px ${agent.glow}`,
              '&:hover': { filter: 'brightness(1.1)', transform: 'translateY(-1px)' },
              '&.Mui-disabled': { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' },
            }}
          >
            Ativar Skill
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  )
}

// ── Agent selector card ────────────────────────────────────────────────────────

function AgentCard({ agent, active, msgCount, onClick }: {
  agent: DSAgent
  active: boolean
  msgCount: number
  onClick: () => void
}) {
  return (
    <Paper
      onClick={onClick}
      elevation={0}
      sx={{
        p: { xs: 1.4, md: 1.8 }, borderRadius: 2.5, cursor: 'pointer',
        border: `1.5px solid ${active ? agent.color + '55' : 'rgba(255,255,255,0.06)'}`,
        bgcolor: active ? `${agent.color}0d` : 'rgba(255,255,255,0.025)',
        boxShadow: active ? `0 0 24px ${agent.glow}, inset 0 1px 0 ${agent.color}22` : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'all 0.22s ease',
        position: 'relative', overflow: 'hidden',
        '&:hover': { borderColor: `${agent.color}44`, bgcolor: `${agent.color}0a`, transform: active ? 'none' : 'translateY(-2px)' },
        '&::after': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: active
            ? `linear-gradient(90deg, transparent, ${agent.color}88 30%, ${agent.color}cc 50%, ${agent.color}88 70%, transparent)`
            : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 50%, transparent)',
          pointerEvents: 'none', zIndex: 1,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2 }}>
        <Box sx={{
          width: { xs: 36, md: 44 }, height: { xs: 36, md: 44 }, borderRadius: 2, flexShrink: 0,
          bgcolor: `${agent.color}18`, border: `1.5px solid ${agent.color}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: active ? `0 0 16px ${agent.glow}` : 'none',
          transition: 'box-shadow 0.22s ease',
          fontSize: { xs: '1.3rem', md: '1.5rem' }, lineHeight: 1,
        }}>
          {agent.emoji}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.2 }}>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: '0.78rem', md: '0.88rem' }, color: active ? agent.color : 'rgba(255,255,255,0.88)', lineHeight: 1 }}>
              {agent.name}
            </Typography>
            {msgCount > 0 && (
              <Box sx={{ px: 0.6, py: 0.1, borderRadius: 1, bgcolor: `${agent.color}22`, border: `1px solid ${agent.color}44` }}>
                <Typography sx={{ fontSize: '0.48rem', fontWeight: 800, color: agent.color, lineHeight: 1 }}>{msgCount}</Typography>
              </Box>
            )}
          </Box>
          <Typography sx={{ fontSize: { xs: '0.58rem', md: '0.62rem' }, color: active ? `${agent.color}bb` : 'rgba(255,255,255,0.38)', fontWeight: 600, lineHeight: 1, mb: 0.6 }}>
            {agent.role}
          </Typography>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ fontSize: '0.7rem', lineHeight: 1 }}>{agent.skill.icon}</Box>
            <Typography sx={{ fontSize: '0.6rem', color: `${agent.color}88`, fontWeight: 600 }}>
              {agent.skill.name}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  )
}

// ── Chat bubble ────────────────────────────────────────────────────────────────

function Bubble({ msg, agent }: { msg: AgentMessage; agent: DSAgent }) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
      {!isUser && (
        <Avatar sx={{ width: 28, height: 28, bgcolor: `${agent.color}22`, border: `1.5px solid ${agent.color}44`, fontSize: '0.9rem', flexShrink: 0, mt: 0.2 }}>
          {agent.emoji}
        </Avatar>
      )}
      <Box sx={{ maxWidth: '82%', position: 'relative' }}>
        <Paper elevation={0} sx={{
          px: 1.5, py: 1.2, borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          bgcolor: isUser ? `${agent.color}18` : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isUser ? agent.color + '35' : 'rgba(255,255,255,0.07)'}`,
          position: 'relative', overflow: 'hidden',
          '&::after': {
            content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
            background: isUser
              ? `linear-gradient(90deg, transparent, ${agent.color}44 50%, transparent)`
              : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 50%, transparent)',
            pointerEvents: 'none',
          },
        }}>
          {isUser
            ? <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.88)', lineHeight: 1.6 }}>{msg.content}</Typography>
            : renderMd(msg.content)
          }
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.6 }}>
            <Typography sx={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.2)' }}>
              {new Date(msg.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
            {!isUser && (
              <Tooltip title={copied ? 'Copiado!' : 'Copiar tudo'}>
                <IconButton size="small" onClick={copy} sx={{ p: 0.2, color: 'rgba(255,255,255,0.2)', '&:hover': { color: agent.color } }}>
                  <ContentCopyIcon sx={{ fontSize: 10 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Paper>
      </Box>
    </Box>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function AgenciaTab({ allClients, items, states, currentUser }: Props) {
  const [activeId, setActiveId] = useState<DSAgent['id']>('copy')
  const [conversations, setConversations] = useState<Record<string, AgentMessage[]>>(() => {
    const loaded: Record<string, AgentMessage[]> = {}
    AGENTS.forEach(a => {
      try { loaded[a.id] = JSON.parse(localStorage.getItem(a.storageKey) ?? '[]') }
      catch { loaded[a.id] = [] }
    })
    return loaded
  })
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [skillOpen, setSkillOpen]   = useState(false)
  const [orchOpen, setOrchOpen]     = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)

  const agent = AGENTS.find(a => a.id === activeId)!
  const msgs  = conversations[activeId] ?? []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  const buildContext = useCallback((): AgentContext => {
    const published = Object.values(states).filter(s => s.status === 7).length
    const late = items.filter(i => {
      const d = new Date(i.dt); d.setHours(0,0,0,0)
      const now = new Date(); now.setHours(0,0,0,0)
      return d < now && (states[i.i]?.status ?? i.s) !== 7
    }).length
    return {
      clients: allClients.map(c => c.name),
      totalItems: items.length,
      published,
      pending: items.length - published - late,
      late,
      today: new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
      currentUser: currentUser ?? '',
    }
  }, [allClients, items, states, currentUser])

  const saveConversation = useCallback((agentId: string, newMsgs: AgentMessage[]) => {
    const trimmed = newMsgs.slice(-40)
    localStorage.setItem(AGENTS.find(a => a.id === agentId)!.storageKey, JSON.stringify(trimmed))
    setConversations(prev => ({ ...prev, [agentId]: trimmed }))
  }, [])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: AgentMessage = { role: 'user', content: text.trim(), ts: Date.now() }
    const next = [...msgs, userMsg]
    saveConversation(activeId, next)
    setInput('')
    setLoading(true)

    try {
      const ctx = buildContext()
      const system = agent.buildSystemPrompt(ctx)
      const groqKey = localStorage.getItem('sm_groq_key') ?? undefined

      // Build messages for API — last 20 turns, Groq format
      const apiMessages = next.slice(-20).map(m => ({ role: m.role, content: m.content }))

      const reply = await callAgentAI(system, apiMessages, groqKey)
      saveConversation(activeId, [...next, { role: 'assistant', content: reply, ts: Date.now() }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro de conexão com a IA.'
      saveConversation(activeId, [...next, { role: 'assistant', content: `Erro: ${msg}\n\nVerifique se a chave Groq está configurada em Configurações.`, ts: Date.now() }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [loading, msgs, activeId, agent, buildContext, saveConversation])

  const clearMemory = () => saveConversation(activeId, [])

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <CursorGlow color="rgba(255,144,57,0.04)" size={500} />

      {/* Header */}
      <Box sx={{
        px: { xs: 1.5, md: 2.5 }, pt: 1.5, pb: 1,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0, background: 'linear-gradient(180deg, rgba(255,144,57,0.05) 0%, transparent 100%)',
        position: 'relative',
        '&::after': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,144,57,0.4) 30%, rgba(255,144,57,0.65) 50%, rgba(255,144,57,0.4) 70%, transparent)', pointerEvents: 'none' },
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 16 }} />
          <Typography sx={{ fontWeight: 900, fontSize: { xs: '0.88rem', md: '1rem' }, color: 'primary.main', letterSpacing: '-0.01em' }}>
            Agência DS
          </Typography>
          <Chip label="4 agentes" size="small" sx={{ height: 16, fontSize: '0.5rem', fontWeight: 700, bgcolor: 'rgba(255,144,57,0.12)', color: 'primary.main', border: '1px solid rgba(255,144,57,0.25)' }} />
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            startIcon={<RocketLaunchIcon sx={{ fontSize: 12 }} />}
            onClick={() => setOrchOpen(true)}
            sx={{
              fontSize: '0.62rem', fontWeight: 800, borderRadius: 2, px: 1.2, height: 26,
              background: 'linear-gradient(135deg, rgba(255,144,57,0.2), rgba(255,83,57,0.15))',
              color: 'primary.main', border: '1px solid rgba(255,144,57,0.3)',
              '&:hover': { background: 'linear-gradient(135deg, rgba(255,144,57,0.3), rgba(255,83,57,0.25))', transform: 'translateY(-1px)' },
              display: { xs: 'none', sm: 'flex' },
            }}
          >
            Fluxo Completo
          </Button>
        </Box>
        <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', mt: 0.3 }}>
          Equipe de agentes com contexto total do DS HUB · {allClients.length} clientes · memória persistente
        </Typography>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 0 }}>

        {/* Agent selector */}
        <Box sx={{
          width: { xs: '100%', md: 260, lg: 290, xl: 340 }, flexShrink: 0,
          borderRight: { md: '1px solid rgba(255,255,255,0.06)' },
          borderBottom: { xs: '1px solid rgba(255,255,255,0.06)', md: 'none' },
          overflowY: 'auto', p: 1.5,
          display: 'flex', flexDirection: { xs: 'row', md: 'column' },
          gap: 1, overflowX: { xs: 'auto', md: 'hidden' },
        }}>
          {AGENTS.map(a => (
            <Box key={a.id} sx={{ flexShrink: { xs: 0, md: 1 }, width: { xs: 200, md: '100%' } }}>
              <AgentCard
                agent={a}
                active={activeId === a.id}
                msgCount={conversations[a.id]?.length ?? 0}
                onClick={() => { setActiveId(a.id); setInput('') }}
              />
            </Box>
          ))}

          <Box sx={{ display: { xs: 'none', md: 'block' }, mt: 'auto', pt: 1 }}>
            <Button
              fullWidth
              size="small"
              startIcon={<RocketLaunchIcon sx={{ fontSize: 12 }} />}
              onClick={() => setOrchOpen(true)}
              sx={{
                fontSize: '0.6rem', fontWeight: 800, borderRadius: 2,
                background: 'linear-gradient(135deg, rgba(255,144,57,0.15), rgba(255,83,57,0.1))',
                color: 'primary.main', border: '1px solid rgba(255,144,57,0.25)',
                mb: 1,
                '&:hover': { background: 'linear-gradient(135deg, rgba(255,144,57,0.25), rgba(255,83,57,0.2))' },
              }}
            >
              🎯 Fluxo Completo (4 agentes)
            </Button>
            <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.18)', lineHeight: 1.5, textAlign: 'center', px: 0.5 }}>
              Cada agente tem memória própria. Os últimos 40 turnos são lembrados entre sessões.
            </Typography>
          </Box>
        </Box>

        {/* Chat panel */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* Agent info bar */}
          <Box sx={{
            px: 2, py: 0.8, borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0,
            bgcolor: `${agent.color}06`,
          }}>
            <Box sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{agent.emoji}</Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.78rem', color: agent.color, lineHeight: 1 }}>{agent.name}</Typography>
              <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1 }}>{agent.role}</Typography>
            </Box>
            <Box sx={{ gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 240, display: { xs: 'none', lg: 'flex' } }}>
              {agent.capabilities.map(c => (
                <Chip key={c} label={c} size="small" sx={{ height: 16, fontSize: '0.46rem', bgcolor: `${agent.color}14`, color: agent.color, border: `1px solid ${agent.color}30` }} />
              ))}
            </Box>
            <Tooltip title={`⚡ ${agent.skill.name} — ${agent.skill.badge}`}>
              <Button
                size="small"
                startIcon={<ElectricBoltIcon sx={{ fontSize: 11 }} />}
                onClick={() => setSkillOpen(true)}
                sx={{
                  fontSize: '0.6rem', fontWeight: 800, borderRadius: 1.5, px: 1, height: 24, flexShrink: 0,
                  bgcolor: `${agent.color}18`, color: agent.color,
                  border: `1px solid ${agent.color}35`,
                  '&:hover': { bgcolor: `${agent.color}28`, boxShadow: `0 0 12px ${agent.glow}` },
                }}
              >
                Skill
              </Button>
            </Tooltip>
            <Tooltip title="Limpar memória deste agente">
              <IconButton size="small" onClick={clearMemory} sx={{ color: 'rgba(255,255,255,0.25)', '&:hover': { color: '#FF4545' }, p: 0.5 }}>
                <DeleteOutlineIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Messages */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 1.2, md: 2 }, py: 1.5 }}>
            {msgs.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '55%', gap: 1.5, opacity: 0.75 }}>
                <Box sx={{ fontSize: '3rem', filter: `drop-shadow(0 0 20px ${agent.glow})` }}>{agent.emoji}</Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: agent.color }}>{agent.name} pronto</Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center', maxWidth: 320 }}>
                  {agent.description}
                </Typography>
                <Button
                  size="small"
                  startIcon={<ElectricBoltIcon sx={{ fontSize: 12 }} />}
                  onClick={() => setSkillOpen(true)}
                  sx={{
                    fontSize: '0.65rem', fontWeight: 800, borderRadius: 2, px: 1.5,
                    bgcolor: `${agent.color}18`, color: agent.color,
                    border: `1px solid ${agent.color}35`,
                    '&:hover': { bgcolor: `${agent.color}28` },
                    mt: 0.5,
                  }}
                >
                  ⚡ Ativar {agent.skill.name}
                </Button>
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.22)', textAlign: 'center' }}>
                  Use os atalhos abaixo ou escreva sua solicitação
                </Typography>
              </Box>
            ) : (
              msgs.map((m, i) => <Bubble key={i} msg={m} agent={agent} />)
            )}
            {loading && (
              <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center' }}>
                <Avatar sx={{ width: 28, height: 28, bgcolor: `${agent.color}22`, border: `1.5px solid ${agent.color}44`, fontSize: '0.9rem' }}>
                  {agent.emoji}
                </Avatar>
                <Paper elevation={0} sx={{ px: 1.4, py: 1, borderRadius: '14px 14px 14px 4px', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    {[0, 1, 2].map(j => (
                      <Box key={j} sx={{
                        width: 5, height: 5, borderRadius: '50%', bgcolor: agent.color,
                        animation: 'dotBounce 1.1s ease-in-out infinite',
                        animationDelay: `${j * 0.18}s`,
                        '@keyframes dotBounce': { '0%,80%,100%': { transform: 'scale(0.7)', opacity: 0.4 }, '40%': { transform: 'scale(1)', opacity: 1 } },
                      }} />
                    ))}
                  </Box>
                </Paper>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Quick actions */}
          <Box sx={{ px: { xs: 1.2, md: 2 }, py: 0.8, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 0.6, overflowX: 'auto', flexShrink: 0, '&::-webkit-scrollbar': { height: 2 } }}>
            {agent.quickActions.map(qa => (
              <Chip
                key={qa.label}
                label={`${qa.icon} ${qa.label}`}
                size="small"
                onClick={() => { setInput(qa.prompt); inputRef.current?.focus() }}
                sx={{
                  height: 22, fontSize: '0.6rem', fontWeight: 600, flexShrink: 0, cursor: 'pointer',
                  bgcolor: `${agent.color}10`, color: agent.color, border: `1px solid ${agent.color}30`,
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: `${agent.color}22`, borderColor: `${agent.color}55`, transform: 'translateY(-1px)' },
                }}
              />
            ))}
          </Box>

          {/* Input */}
          <Box sx={{ px: { xs: 1.2, md: 2 }, pb: { xs: 1.2, md: 1.5 }, pt: 0.8, borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <TextField
                inputRef={inputRef}
                fullWidth multiline maxRows={5}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                placeholder={`Fale com ${agent.name}... (Enter para enviar)`}
                disabled={loading}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '0.82rem', borderRadius: 2.5,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    '& fieldset': { borderColor: `${agent.color}30` },
                    '&:hover fieldset': { borderColor: `${agent.color}55` },
                    '&.Mui-focused fieldset': { borderColor: `${agent.color}88`, borderWidth: 1.5 },
                  },
                }}
              />
              <IconButton
                onClick={() => send(input)}
                disabled={!input.trim() || loading}
                sx={{
                  width: 38, height: 38, borderRadius: 2, flexShrink: 0,
                  background: input.trim() && !loading ? `linear-gradient(135deg, ${agent.color}, ${agent.color}bb)` : 'rgba(255,255,255,0.06)',
                  color: input.trim() && !loading ? '#000' : 'rgba(255,255,255,0.25)',
                  transition: 'all 0.2s ease',
                  '&:hover': { filter: 'brightness(1.1)', transform: 'translateY(-1px)' },
                  '&.Mui-disabled': { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.15)' },
                }}
              >
                {loading ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <SendIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Box>
            <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.18)', mt: 0.5, textAlign: 'right' }}>
              Enter envia · Shift+Enter quebra linha · {allClients.length} clientes · {items.length} conteúdos no contexto
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Skill Dialog */}
      <SkillDialog
        agent={agent}
        open={skillOpen}
        onClose={() => setSkillOpen(false)}
        onSend={send}
        ctx={buildContext()}
      />

      {/* Orchestrator */}
      <AgenciaOrchestrator
        open={orchOpen}
        onClose={() => setOrchOpen(false)}
        allClients={allClients}
        items={items}
        states={states}
        currentUser={currentUser}
      />
    </Box>
  )
}
