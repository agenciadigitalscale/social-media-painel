import { useState, useCallback } from 'react'
import {
  Dialog, DialogContent, Box, Typography, TextField, Button,
  CircularProgress, Chip, IconButton, Paper, Divider,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import type { Client, ContentItem, ItemState } from '../types'
import { AGENTS, callAgentAI, type AgentContext } from '../lib/agents'

interface Props {
  open: boolean
  onClose: () => void
  allClients: Client[]
  items: ContentItem[]
  states: Record<number, ItemState>
  currentUser?: string
}

interface Brief {
  cliente: string
  tema: string
  objetivo: string
  formato: string
  tom: string
}

interface Step {
  agentId: 'strategy' | 'copy' | 'design' | 'editor'
  label: string
  outputTitle: string
  status: 'idle' | 'running' | 'done' | 'error'
  output: string
}

const STEPS: Step[] = [
  { agentId: 'strategy', label: 'Estratégia', outputTitle: '📊 Plano Estratégico', status: 'idle', output: '' },
  { agentId: 'copy',     label: 'Copy',       outputTitle: '✍️ Pacote de Copy',    status: 'idle', output: '' },
  { agentId: 'design',   label: 'Design',     outputTitle: '🎨 Briefing Visual',   status: 'idle', output: '' },
  { agentId: 'editor',   label: 'Vídeo',      outputTitle: '🎬 Plano de Produção', status: 'idle', output: '' },
]

function buildOrchestratorPrompt(
  step: Step,
  brief: Brief,
  previousOutputs: Record<string, string>,
): string {
  const briefBlock = `BRIEF DA CAMPANHA:
• Cliente: ${brief.cliente}
• Tema: ${brief.tema}
• Objetivo: ${brief.objetivo}
• Formato: ${brief.formato}
• Tom: ${brief.tom}`

  if (step.agentId === 'strategy') {
    return `${briefBlock}

Você está orquestrando uma campanha completa para toda a equipe da DS. Sua missão agora é entregar a ESTRATÉGIA BASE que vai guiar Copywriter, Designer e Editor de Vídeo.

ENTREGUE:
## 🎯 Estratégia da Campanha — ${brief.cliente}

### 📌 Posicionamento Central
[1-2 frases que definem a campanha inteira]

### 🎯 Objetivo e KPI
[objetivo claro + métrica de sucesso]

### 👥 Público e Mensagem
[quem é + o que precisa ouvir + por quê age]

### 💡 Pilares de Conteúdo (3)
**Pilar 1:** [tema + por quê ressoa]
**Pilar 2:** [tema + por quê ressoa]
**Pilar 3:** [tema + por quê ressoa]

### 📅 Ritmo de Publicação
[frequência + melhores horários + mix de formatos]

### ⚡ Conceito Criativo Central
[ideia-mãe que conecta copy, design e vídeo em um conceito unificado]`
  }

  if (step.agentId === 'copy') {
    return `${briefBlock}

ESTRATÉGIA DEFINIDA PELO ESTRATEGISTA:
---
${previousOutputs.strategy ?? '(não disponível)'}
---

Com base nessa estratégia, crie o PACOTE DE COPY COMPLETO para a campanha.

ENTREGUE:
## ✍️ Pacote de Copy — ${brief.cliente}

### 🎣 Ganchos de Abertura (3 opções)
1. [gancho para Reel/vídeo — máx 8 palavras — deve parar o scroll]
2. [gancho alternativo]
3. [gancho alternativo]

### 📝 Legenda Principal (${brief.formato})
[legenda completa, pronta para publicar: emoção + desenvolvimento + CTA + hashtags]

### 📣 Headlines para Anúncio
**Primária:** [headline principal]
**Alternativa 1:** [headline B]
**Alternativa 2:** [headline C]

### 💬 Texto do Anúncio
[corpo do anúncio Meta Ads: dor → solução → prova → CTA]

### 📱 Story (3 frames)
**Frame 1:** [texto + emoji]
**Frame 2:** [texto + emoji]
**Frame 3:** [CTA + link]

### 🎬 Roteiro Falado (30s)
[fala completa para o Reel, palavra por palavra]`
  }

  if (step.agentId === 'design') {
    return `${briefBlock}

ESTRATÉGIA:
---
${previousOutputs.strategy ?? '(não disponível)'}
---

COPY CRIADO:
---
${previousOutputs.copy ?? '(não disponível)'}
---

Com base no brief, estratégia e copy, crie o BRIEFING VISUAL COMPLETO para o designer executar.

ENTREGUE:
## 🎨 Briefing Visual — ${brief.cliente}

### 🖌️ Paleta da Campanha (4 cores)
| Cor | HEX | Uso na Campanha |
|---|---|---|
[4 linhas com cor principal, acento, neutro claro, neutro escuro]

### 📐 Layout e Composição
**Post (1:1):** [descrição do layout: elementos, posição, tipografia]
**Story (9:16):** [descrição do layout]
**Thumbnail Reel:** [elemento principal + texto sobreposto]

### 🖼️ Prompt Midjourney
\`\`\`
[prompt completo em inglês para gerar imagens base da campanha]
\`\`\`

### ✍️ Tipografia
**Headline:** [fonte + peso + tamanho]
**Body:** [fonte + peso + tamanho]
**CTA:** [fonte + estilo]

### 📋 Checklist do Designer
- [ ] [item de ação específico]
- [ ] [item de ação específico]
- [ ] [item de ação específico]
- [ ] [item de ação específico]`
  }

  // editor
  return `${briefBlock}

ESTRATÉGIA:
---
${previousOutputs.strategy ?? '(não disponível)'}
---

COPY (roteiro falado):
---
${previousOutputs.copy ?? '(não disponível)'}
---

DIREÇÃO VISUAL:
---
${previousOutputs.design ?? '(não disponível)'}
---

Com base em tudo, crie o PLANO DE PRODUÇÃO DE VÍDEO completo para o editor executar.

ENTREGUE:
## 🎬 Plano de Produção — ${brief.cliente}

### ⏱️ Estrutura do Vídeo
| Tempo | Cena | Ação | Texto na Tela |
|---|---|---|---|
[take a take, 00:00–00:05 / 00:05–00:12 / etc]

### 🎥 Specs de Produção
**Formato:** ${brief.formato} · 1080×1920 (9:16) · 30fps
**Duração total:** [X segundos]
**Resolução mínima de câmera:** [sugestão]

### 🎞️ B-Roll Necessário
[lista de cenas de apoio necessárias]

### 📱 Textos na Tela (Motion)
[lista de textos com timing: 00:00 → "texto" → estilo sugerido]

### 🎵 Trilha Sonora
**Gênero:** [gênero + mood]
**Sugestões:** [3 opções de busca no Instagram/TikTok]
**Volume:** [instrução de mixing]

### ✂️ Checklist de Edição
- [ ] Cortar take ruim: [critério]
- [ ] Texto na tela: [instrução]
- [ ] Color grade: [ajuste específico]
- [ ] Exportar: 1080×1920 · 30fps · H.264 · sem barras`
}

function StepIndicator({ step, index, active }: { step: Step; index: number; active: boolean }) {
  const agent = AGENTS.find(a => a.id === step.agentId)!
  const isDone = step.status === 'done'
  const isRunning = step.status === 'running'
  const isError = step.status === 'error'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{
        width: 36, height: 36, borderRadius: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: isDone ? `${agent.color}22` : isRunning ? `${agent.color}15` : 'rgba(255,255,255,0.05)',
        border: `1.5px solid ${isDone || isRunning ? agent.color + '55' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isRunning ? `0 0 16px ${agent.glow}` : 'none',
        transition: 'all 0.3s ease',
        position: 'relative',
      }}>
        {isRunning ? (
          <CircularProgress size={16} sx={{ color: agent.color }} />
        ) : isDone ? (
          <CheckCircleOutlineIcon sx={{ fontSize: 18, color: agent.color }} />
        ) : isError ? (
          <ErrorOutlineIcon sx={{ fontSize: 18, color: '#FF4545' }} />
        ) : (
          <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>{agent.emoji}</Typography>
        )}
      </Box>
      <Typography sx={{
        fontSize: '0.55rem', fontWeight: 700,
        color: isDone ? agent.color : isRunning ? agent.color : 'rgba(255,255,255,0.35)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {step.label}
      </Typography>
    </Box>
  )
}

function CopyableOutput({ title, content, color }: { title: string; content: string; color: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Paper elevation={0} sx={{
      p: 1.5, borderRadius: 2, mb: 1.5,
      bgcolor: 'rgba(255,255,255,0.03)',
      border: `1px solid ${color}22`,
      position: 'relative', overflow: 'hidden',
      '&::after': {
        content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: `linear-gradient(90deg, transparent, ${color}55 50%, transparent)`,
        pointerEvents: 'none',
      },
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color, letterSpacing: '-0.01em' }}>
          {title}
        </Typography>
        <IconButton size="small" onClick={copy} sx={{ p: 0.3, color: copied ? color : 'rgba(255,255,255,0.3)', '&:hover': { color } }}>
          <ContentCopyIcon sx={{ fontSize: 12 }} />
        </IconButton>
      </Box>
      <Box sx={{
        maxHeight: 200, overflowY: 'auto', pr: 0.5,
        scrollbarWidth: 'thin', scrollbarColor: `${color}44 transparent`,
        '&::-webkit-scrollbar': { width: 3 },
        '&::-webkit-scrollbar-thumb': { background: `${color}44`, borderRadius: 2 },
      }}>
        <Typography component="pre" sx={{
          fontSize: '0.68rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.7,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', m: 0,
        }}>
          {content}
        </Typography>
      </Box>
    </Paper>
  )
}

export default function AgenciaOrchestrator({ open, onClose, allClients, items, states, currentUser }: Props) {
  const [brief, setBrief] = useState<Brief>({ cliente: '', tema: '', objetivo: '', formato: 'Reel', tom: 'Descontraído e direto' })
  const [steps, setSteps] = useState<Step[]>(STEPS.map(s => ({ ...s })))
  const [phase, setPhase] = useState<'form' | 'running' | 'done'>('form')

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

  const run = useCallback(async () => {
    if (!brief.cliente.trim() || !brief.tema.trim()) return
    setPhase('running')
    const groqKey = localStorage.getItem('sm_groq_key') ?? undefined
    const ctx = buildContext()
    const previousOutputs: Record<string, string> = {}

    const freshSteps = STEPS.map(s => ({ ...s, status: 'idle' as const, output: '' }))
    setSteps(freshSteps)

    for (let idx = 0; idx < freshSteps.length; idx++) {
      const step = freshSteps[idx]
      const agent = AGENTS.find(a => a.id === step.agentId)!

      setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status: 'running' } : s))

      try {
        const prompt = buildOrchestratorPrompt(step, brief, previousOutputs)
        const system = agent.buildSystemPrompt(ctx)
        const output = await callAgentAI(system, [{ role: 'user', content: prompt }], groqKey)
        previousOutputs[step.agentId] = output
        setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status: 'done', output } : s))
      } catch {
        setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status: 'error', output: 'Erro ao processar este passo. Tente novamente.' } : s))
        break
      }
    }

    setPhase('done')
  }, [brief, buildContext])

  const reset = () => {
    setPhase('form')
    setSteps(STEPS.map(s => ({ ...s, status: 'idle', output: '' })))
  }

  const handleClose = () => {
    if (phase === 'running') return
    onClose()
    setTimeout(reset, 300)
  }

  const briefValid = brief.cliente.trim() && brief.tema.trim() && brief.objetivo.trim()

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'rgba(11,11,11,0.97)', backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,144,57,0.15)', borderRadius: 3,
          backgroundImage: 'none',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <Box sx={{
          px: 2.5, py: 1.8, borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 1.2, flexShrink: 0,
          background: 'linear-gradient(180deg, rgba(255,144,57,0.07) 0%, transparent 100%)',
          position: 'relative',
          '&::after': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,144,57,0.5) 30%, rgba(255,144,57,0.8) 50%, rgba(255,144,57,0.5) 70%, transparent)', pointerEvents: 'none' },
        }}>
          <RocketLaunchIcon sx={{ color: 'primary.main', fontSize: 18 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 900, fontSize: '0.95rem', color: 'primary.main', lineHeight: 1, letterSpacing: '-0.02em' }}>
              Fluxo Completo de Campanha
            </Typography>
            <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.38)', mt: 0.2 }}>
              Estrategista → Copywriter → Designer → Editor · 4 agentes em sequência
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleClose} disabled={phase === 'running'} sx={{ color: 'rgba(255,255,255,0.35)', '&:hover': { color: '#fff' }, p: 0.5 }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        {/* Pipeline tracker */}
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
            {steps.map((step, idx) => {
              const agent = AGENTS.find(a => a.id === step.agentId)!
              return (
                <Box key={step.agentId} sx={{ display: 'flex', alignItems: 'center' }}>
                  <StepIndicator step={step} index={idx} active={step.status === 'running'} />
                  {idx < steps.length - 1 && (
                    <Box sx={{
                      width: { xs: 24, md: 48 }, height: 1.5, mx: 0.5,
                      bgcolor: step.status === 'done' ? agent.color + '66' : 'rgba(255,255,255,0.08)',
                      transition: 'all 0.4s ease',
                    }} />
                  )}
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>

          {/* Form phase */}
          {phase === 'form' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
                Preencha o brief e os 4 agentes trabalharão em sequência — cada um passando o resultado para o próximo.
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <TextField
                  label="Cliente *"
                  value={brief.cliente}
                  onChange={e => setBrief(p => ({ ...p, cliente: e.target.value }))}
                  placeholder="Ex: Burger Prime"
                  size="small"
                  sx={inputSx}
                />
                <TextField
                  label="Formato *"
                  value={brief.formato}
                  onChange={e => setBrief(p => ({ ...p, formato: e.target.value }))}
                  placeholder="Ex: Reel 30s, Post Feed"
                  size="small"
                  sx={inputSx}
                />
              </Box>

              <TextField
                label="Tema da campanha *"
                value={brief.tema}
                onChange={e => setBrief(p => ({ ...p, tema: e.target.value }))}
                placeholder="Ex: lançamento do novo hambúrguer artesanal de verão"
                size="small"
                sx={inputSx}
              />

              <TextField
                label="Objetivo *"
                value={brief.objetivo}
                onChange={e => setBrief(p => ({ ...p, objetivo: e.target.value }))}
                placeholder="Ex: gerar reservas no restaurante, aumentar seguidores, vender produto"
                size="small"
                sx={inputSx}
              />

              <TextField
                label="Tom de comunicação"
                value={brief.tom}
                onChange={e => setBrief(p => ({ ...p, tom: e.target.value }))}
                placeholder="Ex: descontraído e direto, premium e sofisticado, urgente e empolgante"
                size="small"
                sx={inputSx}
              />
            </Box>
          )}

          {/* Running / done phase */}
          {(phase === 'running' || phase === 'done') && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {phase === 'running' && (
                <Box sx={{ mb: 2, p: 1.2, borderRadius: 2, bgcolor: 'rgba(255,144,57,0.06)', border: '1px solid rgba(255,144,57,0.15)' }}>
                  <Typography sx={{ fontSize: '0.68rem', color: 'primary.main', fontWeight: 700, textAlign: 'center' }}>
                    ⚡ Campanha em execução — não feche esta janela
                  </Typography>
                </Box>
              )}

              {steps.map(step => {
                const agent = AGENTS.find(a => a.id === step.agentId)!
                if (step.status === 'idle') return null
                return (
                  <Box key={step.agentId}>
                    {step.status === 'running' && (
                      <Box sx={{ py: 2, textAlign: 'center' }}>
                        <Box sx={{ fontSize: '2rem', mb: 0.5, filter: `drop-shadow(0 0 12px ${agent.glow})`, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } } }}>
                          {agent.emoji}
                        </Box>
                        <Typography sx={{ fontSize: '0.72rem', color: agent.color, fontWeight: 700 }}>
                          {agent.name} trabalhando...
                        </Typography>
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', mt: 0.3 }}>
                          {agent.role}
                        </Typography>
                      </Box>
                    )}

                    {(step.status === 'done' || step.status === 'error') && (
                      <CopyableOutput
                        title={`${STEPS.find(s => s.agentId === step.agentId)!.outputTitle} — ${agent.name}`}
                        content={step.output}
                        color={agent.color}
                      />
                    )}
                  </Box>
                )
              })}

              {phase === 'done' && (
                <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: 'rgba(0,196,122,0.06)', border: '1px solid rgba(0,196,122,0.2)', textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#00C47A', fontWeight: 800 }}>
                    ✅ Campanha completa — 4 agentes executados
                  </Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', mt: 0.3 }}>
                    Copie os outputs acima para cada membro da equipe
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          {phase === 'done' && (
            <Button
              startIcon={<RestartAltIcon sx={{ fontSize: 14 }} />}
              onClick={reset}
              size="small"
              sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}
            >
              Nova campanha
            </Button>
          )}
          {phase !== 'running' && (
            <Button onClick={handleClose} size="small" sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
              Fechar
            </Button>
          )}
          {phase === 'form' && (
            <Button
              variant="contained"
              startIcon={<RocketLaunchIcon sx={{ fontSize: 14 }} />}
              onClick={run}
              disabled={!briefValid}
              size="small"
              sx={{
                fontSize: '0.7rem', fontWeight: 800, borderRadius: 2,
                background: 'linear-gradient(135deg, #ff9039, #ff5339)',
                color: '#000', px: 2,
                boxShadow: '0 4px 16px rgba(255,144,57,0.3)',
                '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
                '&.Mui-disabled': { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' },
              }}
            >
              Lançar campanha
            </Button>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  )
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    fontSize: '0.8rem', borderRadius: 2,
    bgcolor: 'rgba(255,255,255,0.04)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(255,144,57,0.4)' },
    '&.Mui-focused fieldset': { borderColor: 'rgba(255,144,57,0.7)', borderWidth: 1.5 },
  },
  '& .MuiInputLabel-root': { fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#ff9039' },
}
