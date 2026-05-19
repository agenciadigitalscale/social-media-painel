import { useState, useRef, useEffect } from 'react'
import {
  Box, Typography, TextField, IconButton, Paper, Chip,
  SwipeableDrawer, Divider, CircularProgress, Avatar,
  Button, Tooltip,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import CloseIcon from '@mui/icons-material/Close'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import PsychologyIcon from '@mui/icons-material/Psychology'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ArticleIcon from '@mui/icons-material/Article'
import CampaignIcon from '@mui/icons-material/Campaign'
import SummarizeIcon from '@mui/icons-material/Summarize'

interface Message {
  role: 'user' | 'assistant'
  content: string
  ts?: number
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
  open: boolean
  onClose: () => void
  context: AIContext
}

const QUICK_ACTIONS = [
  { label: 'Criar legenda',         icon: '✍️', prompt: 'Crie uma legenda profissional para Instagram para o post de [CLIENTE] sobre [TEMA]. Use emojis, CTA e até 2.200 caracteres.' },
  { label: 'Criar roteiro',         icon: '🎬', prompt: 'Crie um roteiro para Reels de 30-60 segundos para [CLIENTE] sobre [TEMA]. Inclua abertura impactante, desenvolvimento e CTA.' },
  { label: 'Briefing',              icon: '📋', prompt: 'Crie um briefing de conteúdo completo para [CLIENTE] com: objetivo, público-alvo, mensagem principal, formato, tom de voz e referências.' },
  { label: 'CTA criativo',          icon: '🎯', prompt: 'Crie 5 CTAs criativos e diferentes para [CLIENTE]. Misture urgência, benefício e curiosidade.' },
  { label: 'Anúncio Meta',          icon: '📣', prompt: 'Crie um anúncio para Meta Ads para [CLIENTE]. Inclua: headline, texto principal, descrição e CTA. Formato: campanha de [OBJETIVO].' },
  { label: 'Campanha Google',       icon: '🔍', prompt: 'Crie textos para campanha de pesquisa Google Ads para [CLIENTE]. Inclua: 3 títulos (máx 30 chars), 2 descrições (máx 90 chars) e extensões de chamada.' },
  { label: 'Relatório mensal',      icon: '📊', prompt: 'Crie um modelo de relatório mensal de social media para apresentar ao cliente. Inclua: destaques, resultados, próximos passos.' },
  { label: 'Resumir pendências',    icon: '⚡', prompt: `Analise o status atual e me dê um resumo executivo das pendências mais críticas. Contexto: ${'{'}context{'}'}` },
]

const SYSTEM_PROMPT = (ctx: AIContext) =>
  `Você é Scale AI, assistente operacional premium da Digital Scale, agência de marketing digital.

DADOS DO PAINEL (hoje ${new Date().toLocaleDateString('pt-BR')}):
• Clientes ativos: ${ctx.clients.join(', ')}
• Conteúdos do mês: ${ctx.totalItems} total | ${ctx.published} publicados | ${ctx.pending} pendentes | ${ctx.late} atrasados
• Roteiros cadastrados: ${JSON.stringify(ctx.roteiros)}

SUAS CAPACIDADES:
• Criar legendas, roteiros, briefings, CTAs para redes sociais
• Criar textos para Meta Ads e Google Ads
• Analisar o painel e resumir pendências críticas
• Sugerir estratégias de conteúdo por cliente
• Gerar relatórios e resumos operacionais

REGRAS:
• Responda sempre em português, de forma objetiva e profissional
• Seja direta e prática — a equipe está em ritmo operacional
• Para conteúdos, entregue pronto para uso, sem explicações extras
• Quando o prompt tiver [CLIENTE] ou [TEMA], peça para completar`

export default function ScaleAI({ open, onClose, context }: Props) {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: '**Scale AI** pronta para operar. 🚀\n\nUse os atalhos abaixo ou escreva sua solicitação diretamente.',
    ts: Date.now(),
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [geminiKey] = useState(() => localStorage.getItem('sm_gemini_key') ?? '')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text: string) => {
    const userMsg = text.replace('{context}', JSON.stringify(context))
    if (!userMsg.trim()) return
    setMessages(prev => [...prev, { role: 'user', content: userMsg, ts: Date.now() }])
    setInput('')
    setLoading(true)

    try {
      if (!geminiKey) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '⚠️ Chave de API não configurada. Acesse o assistente original (ícone ⚡) para configurar a chave Gemini.',
          ts: Date.now(),
        }])
        return
      }

      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }))

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT(context) }] },
            contents: [...history, { role: 'user', parts: [{ text: userMsg }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
          }),
        }
      )
      const data = await res.json()
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Erro ao processar resposta.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply, ts: Date.now() }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Erro de conexão. Verifique a chave de API nas configurações.',
        ts: Date.now(),
      }])
    } finally {
      setLoading(false)
    }
  }

  const insightCards = [
    context.late > 0 && {
      icon: <WarningAmberIcon sx={{ fontSize: 16 }} />,
      label: `${context.late} atrasado${context.late > 1 ? 's' : ''}`,
      color: '#FF4545', bg: 'rgba(255,69,69,0.1)', border: 'rgba(255,69,69,0.25)',
    },
    context.pending > 0 && {
      icon: <TrendingUpIcon sx={{ fontSize: 16 }} />,
      label: `${context.pending} pendentes`,
      color: '#FFD700', bg: 'rgba(255,215,0,0.08)', border: 'rgba(255,215,0,0.2)',
    },
    {
      icon: <ArticleIcon sx={{ fontSize: 16 }} />,
      label: `${context.published}/${context.totalItems} pub.`,
      color: '#00C47A', bg: 'rgba(0,196,122,0.08)', border: 'rgba(0,196,122,0.2)',
    },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; color: string; bg: string; border: string }[]

  return (
    <SwipeableDrawer
      anchor="right"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: 440 },
          bgcolor: '#080808',
          backgroundImage: 'none',
          borderLeft: '1px solid rgba(255,144,57,0.15)',
        },
      }}
    >
      {/* ── Header ── */}
      <Box sx={{
        px: 2.5, pt: 2.5, pb: 2,
        background: 'linear-gradient(135deg, rgba(255,144,57,0.08) 0%, rgba(180,90,255,0.05) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 38, height: 38, borderRadius: 2.5, flexShrink: 0,
            background: 'linear-gradient(135deg, #ff9039, #b45aff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(255,144,57,0.4)',
          }}>
            <AutoAwesomeIcon sx={{ fontSize: 20, color: '#fff' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 900, fontSize: '1.05rem', lineHeight: 1, letterSpacing: '-0.02em' }}>
              Scale AI
            </Typography>
            <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', mt: 0.1 }}>
              Assistente operacional · Digital Scale
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ color: 'text.disabled' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Insights */}
        <Box sx={{ display: 'flex', gap: 0.8, mt: 1.8, flexWrap: 'wrap' }}>
          {insightCards.map((c, i) => (
            <Box key={i} sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 1, py: 0.4, borderRadius: 1.5,
              bgcolor: c.bg, border: `1px solid ${c.border}`,
              color: c.color,
            }}>
              {c.icon}
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: c.color }}>{c.label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Quick actions ── */}
      <Box sx={{ px: 2, pt: 1.8, pb: 1.2 }}>
        <Typography sx={{ fontSize: '0.56rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 1, mb: 1, fontWeight: 700 }}>
          Atalhos rápidos
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.6 }}>
          {QUICK_ACTIONS.map(({ label, icon, prompt }) => (
            <Tooltip key={label} title={label} placement="top">
              <Box
                onClick={() => send(prompt)}
                sx={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4,
                  py: 1, px: 0.5, borderRadius: 2, cursor: 'pointer',
                  bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  transition: 'all 0.18s',
                  '&:hover': {
                    bgcolor: 'rgba(255,144,57,0.08)', borderColor: 'rgba(255,144,57,0.25)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(255,144,57,0.15)',
                  },
                }}
              >
                <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{icon}</Typography>
                <Typography sx={{ fontSize: '0.46rem', color: 'text.secondary', textAlign: 'center', lineHeight: 1.3, fontWeight: 500 }}>
                  {label}
                </Typography>
              </Box>
            </Tooltip>
          ))}
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', mx: 2 }} />

      {/* ── Chat ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {messages.map((msg, i) => (
          <Box key={i} sx={{
            display: 'flex', gap: 1,
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
          }}>
            {msg.role === 'assistant' && (
              <Avatar sx={{
                width: 26, height: 26, flexShrink: 0,
                background: 'linear-gradient(135deg, #ff9039, #b45aff)',
                fontSize: '0.7rem',
              }}>
                <PsychologyIcon sx={{ fontSize: 14 }} />
              </Avatar>
            )}
            <Box sx={{
              maxWidth: '82%',
              px: 1.5, py: 1,
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              bgcolor: msg.role === 'user'
                ? 'rgba(255,144,57,0.15)'
                : 'rgba(255,255,255,0.04)',
              border: msg.role === 'user'
                ? '1px solid rgba(255,144,57,0.3)'
                : '1px solid rgba(255,255,255,0.06)',
            }}>
              <Typography sx={{
                fontSize: '0.78rem', lineHeight: 1.6, color: 'text.primary',
                whiteSpace: 'pre-wrap',
                '& strong, & b': { fontWeight: 700, color: 'primary.main' },
              }}>
                {msg.content.replace(/\*\*(.*?)\*\*/g, '$1')}
              </Typography>
            </Box>
          </Box>
        ))}

        {loading && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', pl: 1 }}>
            <Avatar sx={{ width: 26, height: 26, background: 'linear-gradient(135deg, #ff9039, #b45aff)' }}>
              <PsychologyIcon sx={{ fontSize: 14 }} />
            </Avatar>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              {[0, 0.15, 0.3].map((delay, i) => (
                <Box key={i} sx={{
                  width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main',
                  '@keyframes typingDot': { '0%,60%,100%': { opacity: 0.3, transform: 'scale(0.8)' }, '30%': { opacity: 1, transform: 'scale(1)' } },
                  animation: `typingDot 1.2s ${delay}s ease-in-out infinite`,
                }} />
              ))}
            </Box>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* ── Input ── */}
      <Box sx={{
        px: 2, pb: 2.5, pt: 1.5,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        bgcolor: 'rgba(0,0,0,0.3)',
      }}>
        {!geminiKey && (
          <Box sx={{ mb: 1, px: 1, py: 0.6, borderRadius: 1.5, bgcolor: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <Typography sx={{ fontSize: '0.6rem', color: 'warning.main' }}>
              ⚠️ Configure a chave Gemini no assistente original (ícone ⚡) para ativar respostas reais.
            </Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            fullWidth multiline maxRows={4}
            size="small"
            placeholder="Peça uma legenda, roteiro, análise..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '0.82rem',
                bgcolor: 'rgba(255,255,255,0.04)',
              },
            }}
          />
          <IconButton
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            sx={{
              bgcolor: input.trim() ? 'primary.main' : 'rgba(255,255,255,0.06)',
              color: input.trim() ? '#000' : 'text.disabled',
              width: 38, height: 38, borderRadius: 2,
              '&:hover': { bgcolor: input.trim() ? '#ff7020' : undefined },
              transition: 'all 0.2s',
            }}
          >
            {loading ? <CircularProgress size={16} color="inherit" /> : <SendIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
          <Button size="small" onClick={() => setMessages([messages[0]])}
            sx={{ fontSize: '0.55rem', color: 'text.disabled', minWidth: 0, px: 0.5 }}>
            Limpar conversa
          </Button>
        </Box>
      </Box>
    </SwipeableDrawer>
  )
}
