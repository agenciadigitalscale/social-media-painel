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
  type: 'distribute' | 'clearAndRedistribute' | 'createAndDistribute' | 'info'
  client?: string
  posts?: number
  reels?: number
}

interface AIContext {
  clients: string[]
  totalItems: number
  published: number
  pending: number
  late: number
  roteiros: Record<string, number>
  clientFolders: Record<string, string>
}

interface Props {
  context: AIContext
  roteiros: Record<string, Roteiro[]>
  onDistribute: (clientName: string) => void
  onClearDistribution: (clientName: string) => void
  onCreateAndDistribute: (clientName: string, posts: number, reels: number) => void
}

const SYSTEM_PROMPT = (ctx: AIContext) => `Você é a assistente de produção de conteúdo da Digital Scale, agência de marketing digital.
Você ajuda a funcionária de social media a organizar roteiros e gerir o calendário.

CONTEXTO ATUAL (${new Date().toLocaleDateString('pt-BR')}):
- Clientes: ${ctx.clients.join(', ')}
- Total de conteúdos no mês: ${ctx.totalItems} | Publicados: ${ctx.published} | Pendentes: ${ctx.pending} | Atrasados: ${ctx.late}
- Roteiros cadastrados: ${JSON.stringify(ctx.roteiros)}
- Pastas Drive configuradas: ${Object.keys(ctx.clientFolders).join(', ') || 'nenhuma'}

AÇÕES DISPONÍVEIS (quando executar, inclua a tag AÇÃO no final da resposta):
• Redistribuir roteiros existentes de um cliente:
  AÇÃO:{"type":"distribute","client":"nome exato"}

• Criar roteiros genéricos e distribuir (quando não há roteiros cadastrados):
  AÇÃO:{"type":"createAndDistribute","client":"nome exato","posts":8,"reels":4}

• Limpar e redistribuir do zero:
  AÇÃO:{"type":"clearAndRedistribute","client":"nome exato"}

REGRAS:
- Responda SEMPRE em português, de forma objetiva e prática
- Se pedirem para distribuir e não há roteiros, use createAndDistribute
- Para identificar o cliente, aceite nomes parciais (ex: "frango" → "Frango d'Água")
- Pode sugerir legendas, hashtags, horários ideais, estratégias de conteúdo
- Informe quantos roteiros o cliente tem antes de agir`

export default function AIAgent({ context, roteiros, onDistribute, onClearDistribution, onCreateAndDistribute }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: 'Olá! Sou sua assistente de conteúdo 🤖\n\nPosso:\n• Distribuir roteiros no calendário\n• Criar e agendar conteúdos em massa\n• Sugerir legendas e hashtags\n• Responder sobre o andamento do mês\n\nExemplo: *"Distribua 8 posts e 4 reels para o Frango d\'Água"*',
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; severity: 'success' | 'info' | 'error' } | null>(null)
  const [anthropicKey, setAnthropicKey] = useState(() => localStorage.getItem('sm_anthropic_key') ?? '')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Sincroniza se a chave for configurada na ScaleAI enquanto o drawer está aberto
  useEffect(() => {
    const sync = () => setAnthropicKey(localStorage.getItem('sm_anthropic_key') ?? '')
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Encontra cliente por nome parcial
  const findClient = (partial: string): string | null => {
    if (!partial) return null
    const lower = partial.toLowerCase()
    return context.clients.find(c =>
      c.toLowerCase().includes(lower) ||
      lower.includes(c.toLowerCase().split(' ')[0].toLowerCase())
    ) ?? null
  }

  const executeAction = (action: Action): { text: string; severity: 'success' | 'info' | 'error' } => {
    if (!action.client) return { text: 'Cliente não especificado na ação.', severity: 'error' }

    const clientName = findClient(action.client)
    if (!clientName) return { text: `Cliente "${action.client}" não encontrado.`, severity: 'error' }

    if (action.type === 'distribute') {
      const count = (roteiros[clientName] ?? []).length
      if (count === 0) return { text: `${clientName} não tem roteiros. Use "criar e distribuir" ou adicione na aba Clientes.`, severity: 'error' }
      onDistribute(clientName)
      return { text: `✅ ${count} roteiro${count > 1 ? 's' : ''} do ${clientName} reagendados no calendário!`, severity: 'success' }
    }

    if (action.type === 'createAndDistribute') {
      const posts = Math.max(0, Math.min(action.posts ?? 0, 30))
      const reels = Math.max(0, Math.min(action.reels ?? 0, 30))
      if (posts + reels === 0) return { text: 'Informe quantos posts e reels criar.', severity: 'error' }
      onCreateAndDistribute(clientName, posts, reels)
      return { text: `✅ ${posts} posts + ${reels} reels do ${clientName} criados e distribuídos no calendário!`, severity: 'success' }
    }

    if (action.type === 'clearAndRedistribute') {
      const count = (roteiros[clientName] ?? []).length
      if (count === 0) return { text: `${clientName} não tem roteiros cadastrados.`, severity: 'error' }
      onClearDistribution(clientName)
      setTimeout(() => onDistribute(clientName), 100)
      return { text: `🔄 Calendário do ${clientName} limpo e redistribuído com ${count} roteiro${count > 1 ? 's' : ''}.`, severity: 'info' }
    }

    return { text: 'Ação desconhecida.', severity: 'error' }
  }

  const parseAction = (text: string): Action | null => {
    const match = text.match(/AÇÃO:\s*(\{[\s\S]*?\})/m)
    if (!match) return null
    try { return JSON.parse(match[1]) } catch { return null }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading || !anthropicKey) return
    setInput('')
    setFeedback(null)

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Anthropic-Key': anthropicKey,
        },
        body: JSON.stringify({
          system: SYSTEM_PROMPT(context),
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await res.json() as {
        content?: { text: string }[]
        error?: { message: string }
      }
      if (data.error) throw new Error(data.error.message)

      const reply = data.content?.[0]?.text ?? 'Sem resposta.'
      const action = parseAction(reply)
      const cleanReply = reply.replace(/AÇÃO:\s*\{[\s\S]*?\}/m, '').trim()

      setMessages(prev => [...prev, { role: 'assistant', content: cleanReply }])
      if (action) setFeedback(executeAction(action))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Erro: ${msg}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  const quickActions = [
    'Distribua todos os clientes',
    'Quais posts estão atrasados?',
    'Crie 8 posts e 4 reels para o Frango d\'Água',
    'Sugira hashtags para restaurante',
  ]

  return (
    <>
      {/* ── Botão flutuante ─────────────────────────── */}
      <Fab
        color="primary"
        size="medium"
        onClick={() => setOpen(true)}
        sx={{
          position: 'fixed', bottom: 72, right: 16, zIndex: 1200,
          background: 'linear-gradient(135deg,#ff9039,#ff5339)',
          boxShadow: '0 4px 20px rgba(255,144,57,0.4)',
          '&:hover': { background: 'linear-gradient(135deg,#ff7020,#ff3320)' },
        }}
      >
        <SmartToyIcon />
        {context.late > 0 && (
          <Box sx={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, bgcolor: 'error.main', borderRadius: '50%', fontSize: '0.55rem', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            {context.late}
          </Box>
        )}
      </Fab>

      {/* ── Drawer ──────────────────────────────────── */}
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        disableSwipeToOpen
        PaperProps={{ sx: { height: '78vh', borderRadius: '20px 20px 0 0', bgcolor: 'background.paper', border: '1px solid rgba(255,144,57,0.2)', borderBottom: 'none' } }}
      >
        {/* Cabeçalho */}
        <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoFixHighIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>Assistente IA — Digital Scale</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                {context.totalItems} itens · {context.published} publicados · {context.late} atrasados
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {/* Atalhos rápidos */}
        <Box sx={{ px: 2, pb: 1, display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
          {quickActions.map(q => (
            <Chip
              key={q}
              label={q}
              size="small"
              variant="outlined"
              onClick={() => setInput(q)}
              sx={{ fontSize: '0.58rem', cursor: 'pointer', borderColor: 'rgba(255,144,57,0.3)', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,144,57,0.08)' } }}
            />
          ))}
        </Box>

        <Divider sx={{ opacity: 0.1 }} />

        {/* Status da chave Anthropic */}
        {!anthropicKey ? (
          <Box sx={{ px: 2, py: 1.2, bgcolor: 'rgba(255,144,57,0.06)', borderBottom: '1px solid rgba(255,144,57,0.1)' }}>
            <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ display: 'block', fontSize: '0.65rem' }}>
              Configure sua chave Anthropic na Scale AI ✨ (canto superior direito)
            </Typography>
          </Box>
        ) : (
          <Box sx={{ px: 2, py: 0.5, display: 'flex', alignItems: 'center', bgcolor: 'rgba(0,196,122,0.05)', borderBottom: '1px solid rgba(0,196,122,0.1)' }}>
            <Typography variant="caption" color="success.main" sx={{ fontSize: '0.6rem' }}>✓ Claude Haiku ativo</Typography>
          </Box>
        )}

        {/* Mensagens */}
        <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {messages.map((msg, idx) => (
            <Box key={idx} sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <Paper sx={{
                px: 1.5, py: 1, maxWidth: '88%',
                bgcolor: msg.role === 'user' ? 'rgba(255,144,57,0.12)' : 'rgba(255,255,255,0.04)',
                border: '1px solid',
                borderColor: msg.role === 'user' ? 'rgba(255,144,57,0.3)' : 'rgba(255,255,255,0.07)',
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              }}>
                <Typography variant="body2" sx={{ fontSize: '0.78rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {msg.content}
                </Typography>
              </Paper>
            </Box>
          ))}

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Paper sx={{ px: 1.5, py: 1, border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px 12px 12px 2px', display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={12} color="primary" />
                <Typography variant="caption" color="text.secondary">Pensando...</Typography>
              </Paper>
            </Box>
          )}

          {feedback && (
            <Alert severity={feedback.severity} sx={{ fontSize: '0.72rem', py: 0.5, borderRadius: 2 }} onClose={() => setFeedback(null)}>
              {feedback.text}
            </Alert>
          )}

          <div ref={messagesEndRef} />
        </Box>

        <Divider sx={{ opacity: 0.08 }} />

        {/* Input */}
        <Box sx={{ px: 2, py: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            fullWidth size="small" multiline maxRows={3}
            placeholder={"Ex: \"Crie 8 posts e 4 reels para o Frango d'Água\""}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />
          <IconButton
            onClick={send}
            disabled={!input.trim() || loading || !anthropicKey}
            sx={{
              bgcolor: 'primary.main', color: '#000', borderRadius: 2,
              width: 40, height: 40, flexShrink: 0,
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
