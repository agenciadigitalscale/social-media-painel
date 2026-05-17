import { useState, useRef, useEffect } from 'react'
import {
  Box, IconButton, Typography, TextField, Paper, Fab,
  SwipeableDrawer, Divider, CircularProgress, Chip, Alert,
} from '@mui/material'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import SendIcon from '@mui/icons-material/Send'
import CloseIcon from '@mui/icons-material/Close'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import type { Roteiro } from '../types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Action {
  type: 'distribute' | 'clearAndRedistribute' | 'info'
  client?: string
}

interface AIContext {
  clients: string[]
  totalItems: number
  published: number
  pending: number
  late: number
  roteiros: Record<string, number>
}

interface Props {
  context: AIContext
  roteiros: Record<string, Roteiro[]>
  onDistribute: (clientName: string) => void
  onClearDistribution: (clientName: string) => void
}

const SYSTEM_PROMPT = (ctx: AIContext) => `Você é a assistente de produção de conteúdo da Digital Scale, agência de marketing digital.
Você ajuda a funcionária de social media a organizar roteiros e gerir o calendário de conteúdo.

CONTEXTO ATUAL:
- Clientes ativos: ${ctx.clients.join(', ')}
- Total de conteúdos no mês: ${ctx.totalItems}
- Publicados: ${ctx.published} | Pendentes: ${ctx.pending} | Atrasados: ${ctx.late}
- Roteiros por cliente: ${JSON.stringify(ctx.roteiros)}

AÇÕES DISPONÍVEIS (quando solicitado, responda com JSON no formato abaixo):
Para distribuir roteiros de um cliente: AÇÃO:{"type":"distribute","client":"nome exato do cliente"}
Para redistribuir (limpar e recriar): AÇÃO:{"type":"clearAndRedistribute","client":"nome exato do cliente"}

Regras:
- Responda SEMPRE em português
- Seja objetiva e prática
- Se a usuária pedir para distribuir roteiros, identifique o cliente correto e responda com a ação JSON
- Você pode sugerir legendas, hashtags, horários de postagem, estratégias de conteúdo
- Mencione quantos roteiros um cliente tem ao falar sobre ele
- Se não houver roteiros para um cliente, avise que precisa adicionar primeiro na aba Clientes`

export default function AIAgent({ context, roteiros, onDistribute, onClearDistribution }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Olá! Sou sua assistente de conteúdo. Posso ajudar a distribuir roteiros no calendário, sugerir legendas, hashtags e estratégias. Como posso ajudar?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const executeAction = (action: Action) => {
    if (!action.client) return null
    const clientName = context.clients.find(c =>
      c.toLowerCase().includes(action.client!.toLowerCase()) ||
      action.client!.toLowerCase().includes(c.toLowerCase().split(' ')[0])
    )
    if (!clientName) return `Cliente "${action.client}" não encontrado.`

    if (action.type === 'distribute') {
      const count = (roteiros[clientName] ?? []).length
      if (count === 0) return `${clientName} não tem roteiros adicionados. Vá em Clientes → Roteiros para adicionar.`
      onDistribute(clientName)
      return `✅ ${count} roteiro${count > 1 ? 's' : ''} do ${clientName} distribuído${count > 1 ? 's' : ''} no calendário!`
    }

    if (action.type === 'clearAndRedistribute') {
      const count = (roteiros[clientName] ?? []).length
      if (count === 0) return `${clientName} não tem roteiros adicionados.`
      onClearDistribution(clientName)
      setTimeout(() => onDistribute(clientName), 100)
      return `🔄 Distribuição do ${clientName} reiniciada com ${count} roteiro${count > 1 ? 's' : ''}!`
    }

    return null
  }

  const parseAction = (text: string): Action | null => {
    const match = text.match(/AÇÃO:\s*(\{.*?\})/s)
    if (!match) return null
    try { return JSON.parse(match[1]) } catch { return null }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)
    setActionFeedback(null)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          system: SYSTEM_PROMPT(context),
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { content?: { text: string }[]; error?: { message: string } }

      if (data.error) throw new Error(data.error.message)

      const reply = data.content?.[0]?.text ?? 'Não consegui processar sua solicitação.'
      const action = parseAction(reply)
      const cleanReply = reply.replace(/AÇÃO:\s*\{.*?\}/s, '').trim()

      setMessages(prev => [...prev, { role: 'assistant', content: cleanReply }])

      if (action) {
        const feedback = executeAction(action)
        if (feedback) setActionFeedback(feedback)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: msg.includes('404') || msg.includes('500')
          ? 'A IA ainda não está configurada. Verifique se o ANTHROPIC_API_KEY está no Cloudflare e faça o deploy.'
          : `Erro ao conectar com a IA: ${msg}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  const lateCount = context.late
  const roteiroTotal = Object.values(context.roteiros).reduce((a, b) => a + b, 0)

  return (
    <>
      {/* ── FAB flutuante ── */}
      <Fab
        color="primary"
        size="medium"
        onClick={() => setOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 72,
          right: 16,
          zIndex: 1200,
          background: 'linear-gradient(135deg,#ff9039,#ff5339)',
          boxShadow: '0 4px 20px rgba(255,144,57,0.4)',
          '&:hover': { background: 'linear-gradient(135deg,#ff7020,#ff3320)' },
        }}
      >
        <SmartToyIcon />
        {lateCount > 0 && (
          <Box sx={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, bgcolor: 'error.main', borderRadius: '50%', fontSize: '0.55rem', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            {lateCount}
          </Box>
        )}
      </Fab>

      {/* ── Drawer ── */}
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        disableSwipeToOpen
        PaperProps={{ sx: { height: '75vh', borderRadius: '20px 20px 0 0', bgcolor: 'background.paper', border: '1px solid rgba(255,144,57,0.2)', borderBottom: 'none' } }}
      >
        {/* Header */}
        <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoFixHighIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>Assistente IA</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                {context.totalItems} conteúdos · {context.published} publicados · {roteiroTotal} roteiros
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {/* Quick chips */}
        <Box sx={{ px: 2, pb: 1, display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
          {['Distribuir roteiros', 'Posts atrasados', 'Sugira hashtags', 'Próximos conteúdos'].map(q => (
            <Chip
              key={q}
              label={q}
              size="small"
              variant="outlined"
              onClick={() => setInput(q)}
              sx={{ fontSize: '0.6rem', cursor: 'pointer', borderColor: 'rgba(255,144,57,0.3)', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,144,57,0.08)' } }}
            />
          ))}
        </Box>

        <Divider sx={{ opacity: 0.1 }} />

        {/* Messages */}
        <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {messages.map((msg, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <Paper
                sx={{
                  px: 1.5, py: 1,
                  maxWidth: '85%',
                  bgcolor: msg.role === 'user'
                    ? 'rgba(255,144,57,0.15)'
                    : 'rgba(255,255,255,0.04)',
                  border: '1px solid',
                  borderColor: msg.role === 'user'
                    ? 'rgba(255,144,57,0.3)'
                    : 'rgba(255,255,255,0.06)',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                }}
              >
                <Typography variant="body2" sx={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {msg.content}
                </Typography>
              </Paper>
            </Box>
          ))}

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Paper sx={{ px: 1.5, py: 1, border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px 12px 12px 2px', display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={12} color="primary" />
                <Typography variant="caption" color="text.secondary">Pensando...</Typography>
              </Paper>
            </Box>
          )}

          {actionFeedback && (
            <Alert severity="success" sx={{ fontSize: '0.75rem', py: 0.5 }} onClose={() => setActionFeedback(null)}>
              {actionFeedback}
            </Alert>
          )}

          <div ref={messagesEndRef} />
        </Box>

        <Divider sx={{ opacity: 0.08 }} />

        {/* Input */}
        <Box sx={{ px: 2, py: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            size="small"
            multiline
            maxRows={3}
            placeholder="Digite um comando ou pergunta..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />
          <IconButton
            onClick={send}
            disabled={!input.trim() || loading}
            sx={{
              bgcolor: 'primary.main',
              color: '#000',
              borderRadius: 2,
              width: 40, height: 40,
              flexShrink: 0,
              '&:hover': { bgcolor: 'primary.dark' },
              '&:disabled': { bgcolor: 'rgba(255,255,255,0.06)', color: 'text.disabled' },
            }}
          >
            <SendIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Box>
      </SwipeableDrawer>
    </>
  )
}
