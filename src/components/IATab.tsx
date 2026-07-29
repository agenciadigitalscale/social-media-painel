import { useState, useRef, useCallback } from 'react'
import {
  Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, CircularProgress, Chip, IconButton,
  Divider, Collapse, Alert,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import SendIcon from '@mui/icons-material/Send'
import KeyIcon from '@mui/icons-material/Key'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import PageHero from '../shared/ui/PageHero'
import type { Client, ContentItem, ItemState } from '../types'
import { DS } from '../theme'

interface AICard {
  id: string
  icon: string
  title: string
  description: string
  color: string
  fields: Array<{ key: string; label: string; type: 'text' | 'select' | 'textarea'; options?: string[] }>
  buildPrompt: (vals: Record<string, string>, context: string) => string
}

const CARDS: AICard[] = [
  {
    id: 'legenda',
    icon: '📝',
    title: 'Legenda',
    description: 'Gera legendas prontas para posts e reels',
    color: DS.accent,
    fields: [
      { key: 'cliente', label: 'Cliente', type: 'text' },
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['Post', 'Reel', 'Story', 'Carrossel'] },
      { key: 'tema', label: 'Tema / assunto', type: 'textarea' },
      { key: 'tom', label: 'Tom de voz', type: 'select', options: ['Descontraído', 'Profissional', 'Inspiracional', 'Educativo', 'Promocional'] },
    ],
    buildPrompt: (v) =>
      `Você é um especialista em social media para a agência Digital Scale. Crie uma legenda impactante para ${v.tipo || 'post'} do cliente "${v.cliente}".\n\nTema: ${v.tema}\nTom: ${v.tom || 'Profissional'}\n\nFormate com emojis, chamada para ação e até 5 hashtags relevantes. Seja criativo e envolvente.`,
  },
  {
    id: 'roteiro',
    icon: '🎬',
    title: 'Roteiro de Vídeo',
    description: 'Cria roteiros completos para Reels e vídeos',
    color: '#C084FC',
    fields: [
      { key: 'cliente', label: 'Cliente', type: 'text' },
      { key: 'duracao', label: 'Duração', type: 'select', options: ['15 segundos', '30 segundos', '60 segundos', '90 segundos'] },
      { key: 'tema', label: 'Tema / produto / serviço', type: 'textarea' },
      { key: 'gancho', label: 'Gancho inicial (opcional)', type: 'text' },
    ],
    buildPrompt: (v) =>
      `Crie um roteiro completo de vídeo de ${v.duracao || '30 segundos'} para o cliente "${v.cliente}".\n\nTema: ${v.tema}${v.gancho ? `\nGancho: ${v.gancho}` : ''}\n\nEstruture em: GANCHO (0-3s), DESENVOLVIMENTO, CTA FINAL. Inclua indicações de câmera, texto na tela e narração.`,
  },
  {
    id: 'briefing',
    icon: '📋',
    title: 'Briefing de Conteúdo',
    description: 'Monta um briefing estruturado para o cliente',
    color: DS.accent,
    fields: [
      { key: 'cliente', label: 'Cliente', type: 'text' },
      { key: 'segmento', label: 'Segmento / nicho', type: 'text' },
      { key: 'objetivo', label: 'Objetivo do mês', type: 'select', options: ['Branding', 'Vendas', 'Engajamento', 'Lançamento', 'Fidelização'] },
    ],
    buildPrompt: (v) =>
      `Monte um briefing completo de conteúdo para o cliente "${v.cliente}" do segmento "${v.segmento}".\n\nObjetivo: ${v.objetivo}\n\nInclua: público-alvo, proposta de valor, pilares de conteúdo, tom de voz, temas sugeridos para o mês, e KPIs a monitorar.`,
  },
  {
    id: 'cronograma',
    icon: '📅',
    title: 'Cronograma',
    description: 'Sugere um cronograma de conteúdo mensal',
    color: DS.green,
    fields: [
      { key: 'cliente', label: 'Cliente', type: 'text' },
      { key: 'posts', label: 'Posts/mês', type: 'text' },
      { key: 'reels', label: 'Reels/mês', type: 'text' },
      { key: 'foco', label: 'Foco do mês', type: 'textarea' },
    ],
    buildPrompt: (v) =>
      `Crie um cronograma de conteúdo para o cliente "${v.cliente}" com ${v.posts || '8'} posts e ${v.reels || '4'} reels por mês.\n\nFoco: ${v.foco}\n\nDistribua os conteúdos ao longo de 4 semanas com temas variados, tipos de post (educativo, promocional, engajamento, bastidores) e sugestões de dia/horário.`,
  },
  {
    id: 'cliente_parado',
    icon: '🔍',
    title: 'Cliente Parado',
    description: 'Analisa cliente com atraso e sugere ações',
    color: DS.red,
    fields: [
      { key: 'cliente', label: 'Cliente', type: 'text' },
      { key: 'situacao', label: 'Situação atual', type: 'textarea' },
      { key: 'dias_atraso', label: 'Dias de atraso', type: 'text' },
    ],
    buildPrompt: (v) =>
      `O cliente "${v.cliente}" está com ${v.dias_atraso || 'vários'} dias de atraso no conteúdo.\n\nSituação: ${v.situacao}\n\nComo gestor de social media da agência Digital Scale, analise a situação e sugira: 1) Causas prováveis, 2) Plano de recuperação, 3) Como comunicar ao cliente, 4) Prioridades imediatas.`,
  },
  {
    id: 'prioridade',
    icon: '⚡',
    title: 'Sugestão de Prioridade',
    description: 'Define o que a equipe deve focar agora',
    color: DS.amber,
    fields: [
      { key: 'contexto', label: 'Contexto da operação hoje', type: 'textarea' },
      { key: 'equipe', label: 'Equipe disponível', type: 'text' },
    ],
    buildPrompt: (v) =>
      `Você é o Head Operacional da agência Digital Scale. Baseado no contexto abaixo, defina as prioridades de hoje para a equipe.\n\nContexto: ${v.contexto}\nEquipe: ${v.equipe}\n\nResponda com: 1) Top 3 prioridades urgentes, 2) Distribuição de tarefas sugerida, 3) O que pode esperar, 4) Alertas de risco.`,
  },
  {
    id: 'resumo_dia',
    icon: '📰',
    title: 'Resumo do Dia',
    description: 'Gera um resumo executivo das operações',
    color: '#FB7185',
    fields: [
      { key: 'publicados', label: 'Conteúdos publicados hoje', type: 'text' },
      { key: 'atrasados', label: 'Conteúdos atrasados', type: 'text' },
      { key: 'pendencias', label: 'Pendências / observações', type: 'textarea' },
    ],
    buildPrompt: (v) =>
      `Gere um resumo executivo do dia para a agência Digital Scale.\n\nPublicados hoje: ${v.publicados}\nAtrasados: ${v.atrasados}\nPendências: ${v.pendencias}\n\nFormate como um relatório diário profissional com destaques, pontos de atenção e próximos passos.`,
  },
  {
    id: 'relatorio',
    icon: '📊',
    title: 'Relatório com IA',
    description: 'Gera relatório mensal com análise inteligente',
    color: '#26C6DA',
    fields: [
      { key: 'cliente', label: 'Cliente', type: 'text' },
      { key: 'posts_publicados', label: 'Posts publicados', type: 'text' },
      { key: 'reels_publicados', label: 'Reels publicados', type: 'text' },
      { key: 'destaques', label: 'Destaques do mês', type: 'textarea' },
    ],
    buildPrompt: (v) =>
      `Gere um relatório mensal profissional para o cliente "${v.cliente}" da agência Digital Scale.\n\nPublicados: ${v.posts_publicados} posts e ${v.reels_publicados} reels\nDestaques: ${v.destaques}\n\nEscreva um relatório completo com: introdução, análise de desempenho, pontos positivos, oportunidades de melhoria, e recomendações para o próximo mês. Tom profissional e consultivo.`,
  },
]

interface Props {
  allClients: Client[]
  items: ContentItem[]
  states: Record<number, ItemState>
}

interface Message { role: 'user' | 'assistant'; content: string }

export default function IATab({ allClients }: Props) {
  const [openCard, setOpenCard] = useState<AICard | null>(null)
  const [fieldVals, setFieldVals] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [anthropicKey, setAnthropicKey] = useState(() => localStorage.getItem('sm_anthropic_key') ?? '')
  const [keyInput, setKeyInput] = useState('')
  const [apiError, setApiError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const clientNames = allClients.map(c => c.name)

  function saveKey() {
    const k = keyInput.trim()
    if (!k) return
    localStorage.setItem('sm_anthropic_key', k)
    setAnthropicKey(k)
    setKeyInput('')
    setKeyOpen(false)
  }

  function openDialog(card: AICard) {
    setOpenCard(card)
    setMessages([])
    const defaults: Record<string, string> = {}
    card.fields.forEach(f => { defaults[f.key] = '' })
    setFieldVals(defaults)
  }

  function closeDialog() {
    setOpenCard(null)
    setMessages([])
    setFieldVals({})
  }

  const handleSend = useCallback(async () => {
    if (!openCard || loading) return
    setApiError('')
    const prompt = openCard.buildPrompt(fieldVals, '')
    const userMsg: Message = { role: 'user', content: prompt }
    const next = [...messages, userMsg]
    setMessages(next)
    setLoading(true)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (anthropicKey) headers['X-Anthropic-Key'] = anthropicKey
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: next,
          system: 'Você é um especialista em marketing digital e social media. Responda sempre em português brasileiro de forma objetiva, criativa e profissional.',
        }),
      })
      const data = await res.json() as {
        content?: Array<{ text: string }>
        choices?: Array<{ message: { content: string } }>
        response?: string
        error?: { message: string }
      }
      if (data.error) {
        const errMsg = data.error.message ?? 'Erro da IA'
        setApiError(errMsg)
        setMessages(next)
        return
      }
      // API returns { content: [{ text: "..." }] } (Anthropic-style wrapper)
      const reply =
        data.content?.[0]?.text ??
        data.choices?.[0]?.message?.content ??
        data.response ??
        'Sem resposta.'
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch {
      setApiError('Erro ao conectar com a IA. Verifique sua conexão.')
      setMessages(next)
    } finally {
      setLoading(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [openCard, fieldVals, messages, loading, anthropicKey])

  function copyLast() {
    const asst = messages.filter(m => m.role === 'assistant')
    const last = asst[asst.length - 1]
    if (!last) return
    navigator.clipboard.writeText(last.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const assistantMsgs = messages.filter(m => m.role === 'assistant')
  const hasResponse = assistantMsgs.length > 0

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Header (PageHero) ── */}
      <PageHero
        icon={<AutoAwesomeIcon sx={{ fontSize: 26 }} />}
        title="IA Operacional"
        subtitle="Ações em massa, roteiros e insights com Claude — direto na operação."
        badge={
          <Chip label="Claude Haiku" size="small" variant="outlined"
            sx={{ fontSize: '0.55rem', height: 20, borderColor: 'rgba(59,130,246,0.3)', color: 'primary.main' }} />
        }
        actions={
          <>
            <Chip
              icon={<KeyIcon sx={{ fontSize: '14px !important' }} />}
              label={anthropicKey ? '🟢 Chave Anthropic salva' : '🔴 Configurar chave Anthropic'}
              size="small" onClick={() => { setKeyInput(anthropicKey); setKeyOpen(v => !v) }}
              sx={{
                fontSize: '0.62rem', cursor: 'pointer',
                bgcolor: anthropicKey ? 'rgba(49,209,124,0.08)' : 'rgba(239,68,68,0.08)',
                borderColor: anthropicKey ? 'rgba(49,209,124,0.3)' : 'rgba(239,68,68,0.3)',
                color: anthropicKey ? DS.green : DS.red,
                border: '1px solid',
                '&:hover': { filter: 'brightness(1.2)' },
              }}
            />
            <ExpandMoreIcon sx={{ fontSize: 16, color: 'rgba(244,247,255,0.25)', transform: keyOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', cursor: 'pointer' }} onClick={() => setKeyOpen(v => !v)} />
          </>
        }
      />

      {/* ── Anthropic key config ── */}
      <Collapse in={keyOpen}>
        <Paper sx={{ p: 2, border: '1px solid rgba(59,130,246,0.15)', bgcolor: 'rgba(59,130,246,0.04)', borderRadius: 2 }}>
          <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.55)', mb: 1.2 }}>
            🔑 Chave da API Anthropic — obtenha em{' '}
            <Box component="span" onClick={() => window.open('https://console.anthropic.com/settings/keys', '_blank', 'noopener')}
              sx={{ color: DS.accent, cursor: 'pointer', textDecoration: 'underline' }}>
              console.anthropic.com/settings/keys
            </Box>
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small" fullWidth type="password"
              placeholder="sk-ant-api03-..."
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveKey()}
              sx={{
                '& .MuiOutlinedInput-root': { color: '#fff', fontSize: '0.78rem', '& fieldset': { borderColor: 'rgba(244,247,255,0.12)' }, '&.Mui-focused fieldset': { borderColor: DS.accent } },
                '& input::placeholder': { color: 'rgba(244,247,255,0.25)', opacity: 1 },
              }}
            />
            <Button size="small" variant="contained" onClick={saveKey} disabled={!keyInput.trim()}
              sx={{ flexShrink: 0, fontWeight: 700, fontSize: '0.72rem', bgcolor: DS.accent, color: '#fff', '&:hover': { bgcolor: '#2563EB' } }}>
              Salvar
            </Button>
            {anthropicKey && (
              <Button size="small" onClick={() => { localStorage.removeItem('sm_anthropic_key'); setAnthropicKey(''); setKeyOpen(false) }}
                sx={{ flexShrink: 0, fontSize: '0.65rem', color: 'rgba(239,68,68,0.7)', '&:hover': { color: DS.red } }}>
                Remover
              </Button>
            )}
          </Box>
          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.25)', mt: 1 }}>
            A chave fica salva localmente no seu navegador. Compartilhada com Scale AI e Prospecção.
          </Typography>
        </Paper>
      </Collapse>

      <Typography sx={{ fontSize: '0.75rem', color: 'rgba(244,247,255,0.45)', lineHeight: 1.5 }}>
        Ferramentas de IA para acelerar a operação. Clique em um card para usar.
      </Typography>

      {/* ── Cards grid ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1.2 }}>
        {CARDS.map(card => (
          <Paper
            key={card.id}
            onClick={() => openDialog(card)}
            sx={{
              p: { xs: 1.5, md: 2 },
              border: `1px solid ${card.color}25`,
              cursor: 'pointer',
              position: 'relative', overflow: 'hidden',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: `${card.color}60`,
                transform: 'translateY(-2px)',
                boxShadow: `0 8px 24px ${card.color}20`,
              },
            }}
          >
            {/* Background glow */}
            <Box sx={{
              position: 'absolute', top: -10, right: -10,
              width: 60, height: 60, borderRadius: '50%',
              bgcolor: card.color, filter: 'blur(24px)', opacity: 0.1, pointerEvents: 'none',
            }} />

            <Typography sx={{ fontSize: '1.5rem', lineHeight: 1, mb: 0.8 }}>{card.icon}</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#fff', mb: 0.4, lineHeight: 1.2 }}>
              {card.title}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(244,247,255,0.45)', lineHeight: 1.4 }}>
              {card.description}
            </Typography>

            {/* Color bar */}
            <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, bgcolor: card.color, opacity: 0.4 }} />
          </Paper>
        ))}
      </Box>

      {/* ── Dialog ── */}
      <Dialog
        open={!!openCard} onClose={closeDialog}
        maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { bgcolor: DS.surface, border: `1px solid ${openCard?.color ?? DS.accent}30`, maxHeight: '90vh' } } }}
      >
        {openCard && (
          <>
            <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ fontSize: '1.3rem' }}>{openCard.icon}</Typography>
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={800} fontSize="0.95rem">{openCard.title}</Typography>
                <Typography sx={{ fontSize: '0.65rem', color: 'rgba(244,247,255,0.45)' }}>{openCard.description}</Typography>
              </Box>
              <IconButton size="small" onClick={closeDialog} sx={{ p: 0.4 }}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 1.2, overflowY: 'auto' }}>
              {/* API error */}
              {apiError && (
                <Alert
                  severity="error" onClose={() => setApiError('')}
                  sx={{ fontSize: '0.72rem', py: 0.5,
                    '& .MuiAlert-message': { lineHeight: 1.5 },
                  }}
                >
                  {apiError.includes('não configurada') || apiError.includes('Chave')
                    ? <>Chave Anthropic não configurada. <Box component="span" onClick={() => { setKeyOpen(true); closeDialog() }} sx={{ cursor: 'pointer', textDecoration: 'underline', fontWeight: 700 }}>Clique aqui para configurar</Box>.</>
                    : apiError
                  }
                </Alert>
              )}
              {/* Fields */}
              {openCard.fields.map(field => {
                if (field.type === 'select') {
                  const opts = field.key === 'cliente' ? clientNames : (field.options ?? [])
                  return (
                    <TextField
                      key={field.key} select size="small" label={field.label} fullWidth
                      value={fieldVals[field.key] ?? ''}
                      onChange={e => setFieldVals(prev => ({ ...prev, [field.key]: e.target.value }))}
                    >
                      {opts.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                  )
                }
                return (
                  <TextField
                    key={field.key} size="small" label={field.label} fullWidth
                    value={fieldVals[field.key] ?? ''}
                    onChange={e => setFieldVals(prev => ({ ...prev, [field.key]: e.target.value }))}
                    multiline={field.type === 'textarea'} rows={field.type === 'textarea' ? 2 : 1}
                  />
                )
              })}

              {/* Response area */}
              {messages.length > 0 && (
                <>
                  <Divider sx={{ borderColor: 'rgba(244,247,255,0.06)', my: 0.5 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {messages.filter(m => m.role === 'assistant').map((msg, i) => (
                      <Paper key={i} sx={{
                        p: 1.5, bgcolor: 'rgba(59,130,246,0.06)',
                        border: `1px solid ${openCard.color}25`,
                        borderRadius: 2,
                      }}>
                        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(244,247,255,0.85)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                          {msg.content}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                </>
              )}

              {loading && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                  <CircularProgress size={16} sx={{ color: openCard.color }} />
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.4)' }}>Gerando...</Typography>
                </Box>
              )}

              <div ref={bottomRef} />
            </DialogContent>

            <DialogActions sx={{ px: 2, pb: 1.5, gap: 1 }}>
              {hasResponse && (
                <Button
                  size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 13 }} />}
                  onClick={copyLast} variant="outlined"
                  sx={{ fontSize: '0.65rem', borderColor: 'rgba(244,247,255,0.15)', color: copied ? DS.green : 'text.secondary' }}
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </Button>
              )}
              <Box sx={{ flex: 1 }} />
              <Button size="small" onClick={closeDialog} sx={{ fontSize: '0.65rem' }}>Fechar</Button>
              <Button
                size="small" variant="contained"
                onClick={handleSend}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={12} /> : <SendIcon sx={{ fontSize: 13 }} />}
                sx={{
                  background: `linear-gradient(135deg, ${openCard.color}, ${openCard.color}cc)`,
                  color: '#000', fontWeight: 800, fontSize: '0.75rem',
                  '&:hover': { filter: 'brightness(1.1)' },
                  '&.Mui-disabled': { opacity: 0.5 },
                }}
              >
                {hasResponse ? 'Refazer' : 'Gerar'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}
