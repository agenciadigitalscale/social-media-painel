import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Box, Typography, Paper, TextField, IconButton, Chip,
  CircularProgress, Tooltip, Button, Avatar,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import type { Client, ContentItem, ItemState } from '../types'
import { AGENTS, type DSAgent, type AgentMessage, type AgentContext } from '../lib/agents'
import CursorGlow from './CursorGlow'

interface Props {
  allClients: Client[]
  items: ContentItem[]
  states: Record<number, ItemState>
  currentUser?: string
}

// ── Markdown renderer (mínimo viável) ────────────────────────────────────────

function renderMd(text: string): React.ReactNode {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) return <Box key={i} sx={{ height: 6 }} />

    // Bold: **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={j}>{p.slice(2, -2)}</strong>
        : p
    )

    if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
      return (
        <Box key={i} sx={{ display: 'flex', gap: 0.8, mb: 0.3 }}>
          <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.4)', mt: 0.7, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.88)', lineHeight: 1.6 }}>{parts}</Typography>
        </Box>
      )
    }
    if (trimmed.startsWith('# ')) {
      return <Typography key={i} sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff', mb: 0.5, mt: 0.5 }}>{parts}</Typography>
    }
    return (
      <Typography key={i} sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.88)', lineHeight: 1.65, mb: 0.1 }}>
        {parts}
      </Typography>
    )
  })
}

// ── Agent selector card ───────────────────────────────────────────────────────

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
          <Typography sx={{ fontSize: { xs: '0.6rem', md: '0.65rem' }, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, display: { xs: 'none', md: 'block' } }}>
            {agent.description}
          </Typography>
        </Box>
      </Box>
    </Paper>
  )
}

// ── Chat bubble ───────────────────────────────────────────────────────────────

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
      <Box sx={{ maxWidth: '82%', position: 'relative', group: 1 }}>
        <Paper elevation={0} sx={{
          px: 1.4, py: 1, borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
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
          {renderMd(msg.content)}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
            <Typography sx={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.2)' }}>
              {new Date(msg.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
            {!isUser && (
              <Tooltip title={copied ? 'Copiado!' : 'Copiar'}>
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

// ── Main ──────────────────────────────────────────────────────────────────────

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
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
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
    const trimmed = newMsgs.slice(-40) // keep last 40 messages
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
      const systemPrompt = agent.buildSystemPrompt(ctx)
      const history = next.slice(-20).map(m => ({ role: m.role, parts: [{ text: m.content }] }))

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, history }),
      })
      const data = await res.json() as { text?: string; error?: string }
      const reply: AgentMessage = {
        role: 'assistant',
        content: data.text ?? data.error ?? 'Erro ao processar resposta.',
        ts: Date.now(),
      }
      saveConversation(activeId, [...next, reply])
    } catch {
      saveConversation(activeId, [...next, { role: 'assistant', content: 'Erro de conexão com a IA. Tente novamente.', ts: Date.now() }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [loading, msgs, activeId, agent, buildContext, saveConversation])

  const clearMemory = () => {
    saveConversation(activeId, [])
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <CursorGlow color="rgba(255,144,57,0.04)" size={500} />

      {/* ── Header ────────────────────────────────────────────── */}
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
          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>
            {allClients.length} clientes · memória persistente
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', mt: 0.3 }}>
          Equipe de agentes especializados operando com contexto total do DS HUB
        </Typography>
      </Box>

      {/* ── Body: agent selector + chat ───────────────────────── */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 0 }}>

        {/* ── Agent selector (left panel) ─── */}
        <Box sx={{
          width: { xs: '100%', md: 260, lg: 290, xl: 340 }, flexShrink: 0,
          borderRight: { md: '1px solid rgba(255,255,255,0.06)' },
          borderBottom: { xs: '1px solid rgba(255,255,255,0.06)', md: 'none' },
          overflowY: 'auto', p: 1.5,
          display: 'flex', flexDirection: { xs: 'row', md: 'column' },
          gap: 1, flexWrap: { xs: 'nowrap', md: 'nowrap' },
          overflowX: { xs: 'auto', md: 'hidden' },
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

          {/* Dica */}
          <Box sx={{ display: { xs: 'none', md: 'block' }, mt: 'auto', pt: 1 }}>
            <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)', lineHeight: 1.5, textAlign: 'center', px: 0.5 }}>
              Cada agente tem memória própria. Os últimos 40 turnos são lembrados entre sessões.
            </Typography>
          </Box>
        </Box>

        {/* ── Chat panel (right) ─── */}
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
            <Box sx={{ gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 280, display: { xs: 'none', lg: 'flex' } }}>
              {agent.capabilities.map(c => (
                <Chip key={c} label={c} size="small" sx={{ height: 16, fontSize: '0.48rem', bgcolor: `${agent.color}14`, color: agent.color, border: `1px solid ${agent.color}30` }} />
              ))}
            </Box>
            <Tooltip title="Limpar memória deste agente">
              <IconButton size="small" onClick={clearMemory} sx={{ color: 'rgba(255,255,255,0.25)', '&:hover': { color: '#FF4545' }, p: 0.5 }}>
                <DeleteOutlineIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Messages area */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 1.2, md: 2 }, py: 1.5 }}>
            {msgs.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 1.5, opacity: 0.7 }}>
                <Box sx={{ fontSize: '3rem', filter: `drop-shadow(0 0 20px ${agent.glow})` }}>{agent.emoji}</Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: agent.color }}>{agent.name} pronto</Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center', maxWidth: 320 }}>
                  {agent.description}
                </Typography>
                <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.22)', textAlign: 'center' }}>
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
                    {[0, 1, 2].map(i => (
                      <Box key={i} sx={{
                        width: 5, height: 5, borderRadius: '50%', bgcolor: agent.color,
                        animation: 'dotBounce 1.1s ease-in-out infinite',
                        animationDelay: `${i * 0.18}s`,
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
              Enter envia · Shift+Enter quebra linha · contexto: {allClients.length} clientes · {items.length} conteúdos
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
