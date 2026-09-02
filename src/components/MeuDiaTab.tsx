/* MeuDiaTab.tsx — Dashboard pessoal por usuário
   Cada membro da equipe vê exatamente o que precisa fazer hoje.
*/
import { useState, useMemo, useCallback } from 'react'
import {
  Box, Typography, Paper, Chip, Stack, Button, IconButton,
  LinearProgress, Tooltip, CircularProgress, Divider,
} from '@mui/material'
import AutoAwesomeIcon      from '@mui/icons-material/AutoAwesome'
import FolderOpenIcon       from '@mui/icons-material/FolderOpen'
import CheckCircleIcon      from '@mui/icons-material/CheckCircle'
import WarningAmberIcon     from '@mui/icons-material/WarningAmber'
import TrendingUpIcon       from '@mui/icons-material/TrendingUp'
import AttachMoneyIcon      from '@mui/icons-material/AttachMoney'
import ContentCopyIcon      from '@mui/icons-material/ContentCopy'
import SendIcon             from '@mui/icons-material/Send'
import PlayArrowIcon        from '@mui/icons-material/PlayArrow'
import PauseIcon            from '@mui/icons-material/Pause'
import ErrorOutlineIcon     from '@mui/icons-material/ErrorOutline'
import OpenInNewIcon        from '@mui/icons-material/OpenInNew'
import ArrowForwardIcon     from '@mui/icons-material/ArrowForward'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import InsightsIcon         from '@mui/icons-material/Insights'
import GroupsIcon           from '@mui/icons-material/Groups'
import type { ContentItem, ItemState, Client, Roteiro, Status } from '../types'
import { isOpenStatus } from '../types'
import { countRealLate, isRealLate, isRealWork, realLateItems } from '../lib/todaySignals'
import { NAME_MAP, getDisplayName } from '../lib/users'
import type { AlertType } from '../lib/alerts'
import { computeAlerts, alertsForUser, loadDismissed, dismissAlert, pruneOldDismissals } from '../lib/alerts'
import OnboardingTodaySection from './OnboardingTodaySection'
import AlertBanner from './AlertBanner'
import { carregarAtribuicoes, carregarPaineis, editorDoCard, paineisDaArea } from '../lib/paineis'
import MinhaProducaoPanel from './MinhaProducaoPanel'

/* Quem produz as artes. Uma constante em vez do literal espalhado: no dia em
   que o Design mudar de mão, muda aqui — e o `NAME_MAP` continua sendo a fonte
   do nome e da cor que o painel exibe. */
const DESIGNER = 'jhones'
import PageHero from '../shared/ui/PageHero'
import { DS } from '../theme'

// ── Types ──────────────────────────────────────────────────
interface Props {
  items:        ContentItem[]
  states:       Record<number, ItemState>
  allClients:   Client[]
  currentUser:  string
  now:          Date
  roteiros:     Record<string, Roteiro[]>
  clientFolders: Record<string, string>
  clientHashtags?: Record<string, string[]>
  onStatusChange: (id: number, status: Status) => void
  onUpdate:       (id: number, patch: Partial<ItemState>) => void
  onTabChange?:   (tab: number) => void  // para navegar para outras abas
}

// ── Helpers ────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

type Urgency = 'overdue' | 'today' | 'tomorrow' | 'week' | 'future'
function getUrgency(dt: Date, now: Date): Urgency {
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const d     = new Date(dt);  d.setHours(0, 0, 0, 0)
  const diff  = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (diff < 0)  return 'overdue'
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff <= 7)  return 'week'
  return 'future'
}
const URGENCY_COLOR: Record<Urgency, string> = {
  overdue:  DS.red,
  today:    DS.orangeDim,
  tomorrow: DS.amber,
  week:     DS.orangeDim,
  future:   '#52525B',
}
const URGENCY_LABEL: Record<Urgency, string> = {
  overdue:  'Atrasado',
  today:    'Hoje',
  tomorrow: 'Amanhã',
  week:     'Esta semana',
  future:   'Próximas sem.',
}

// ── Frases do dia ─────────────────────────────────────────
/**
 * Quem só quer ver a própria área — e quais tipos de alerta são dessa área.
 *
 * O Meu Dia do Kaique mostrava os alertas do painel INTEIRO: artes atrasadas
 * do Design, legendas faltando do Copy, mensalidade vencida do Financeiro.
 * Nada disso é trabalho dele, e alerta que não é seu treina a pessoa a ignorar
 * a faixa vermelha — inclusive no dia em que ela for sua.
 *
 * A lista de vídeo está VAZIA de propósito: nenhum dos tipos existentes é de
 * vídeo (são design, legenda, publicação, cliente, financeiro, saúde e
 * onboarding). Quando existir um alerta de vídeo, é aqui que ele entra.
 *
 * Quem não está neste mapa continua vendo tudo, como antes.
 *
 * O que sai daqui NÃO some do painel: continua no Dashboard, e a própria tela
 * diz isso no rodapé.
 */
const ALERTAS_SO_DA_AREA: Record<string, AlertType[]> = {
  kaique: [],
}

const DAILY_QUOTES = [
  'O sucesso é a soma de pequenos esforços repetidos dia após dia.',
  'Cada dia é uma nova oportunidade de fazer melhor.',
  'A disciplina é a ponte entre os objetivos e as realizações.',
  'Grandes resultados nascem de pequenas ações consistentes.',
  'Foco, força e fé — ingredientes de um dia produtivo.',
  '"Tudo o que fizerem, façam de todo o coração." — Cl 3:23',
  'A excelência não é um ato, é um hábito.',
  'Trabalhe em silêncio, deixe o sucesso fazer barulho.',
  'Seu único concorrente é quem você era ontem.',
  '"O Senhor é o meu pastor, nada me faltará." — Sl 23:1',
  'Comece onde você está. Use o que você tem. Faça o que você pode.',
  'A consistência supera o talento não disciplinado.',
  'Cada cliente satisfeito é uma vitória da equipe.',
  'Criatividade com propósito transforma marcas.',
  '"Tudo posso naquele que me fortalece." — Fp 4:13',
  'Um passo de cada vez constrói maratonas.',
  'A melhor hora de começar foi ontem. A segunda melhor é agora.',
  'Detalhes fazem a diferença entre bom e extraordinário.',
  'Inspire, crie, entregue — repita.',
  '"Não se molde ao padrão deste mundo." — Rm 12:2',
  'Sua energia hoje define os resultados de amanhã.',
  'Equipes fortes constroem marcas fortes.',
  'O que você planta hoje, colhe amanhã.',
  'Seja a razão pela qual alguém sorriu hoje.',
  '"Deus é o nosso refúgio e força." — Sl 46:1',
  'Qualidade não é acidente — é sempre resultado de esforço.',
  'Menos desculpas, mais soluções.',
  'A criatividade é a inteligência se divertindo.',
  '"A sabedoria é mais preciosa que joias." — Pv 8:11',
  'Faça com amor o que você faz, e o resultado vai aparecer.',
]

function getDailyQuote() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length]
}

// ── Header comum ───────────────────────────────────────────
function RoleHeader({ user, now }: { user: string; now: Date }) {
  const info = NAME_MAP[user]
  if (!info) return null
  const hr = now.getHours()
  const greeting = hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite'
  const quote = getDailyQuote()
  return (
    <Paper sx={{
      position: 'relative', overflow: 'hidden',
      px: { xs: 2, md: 2.5, xl: 3 }, py: { xs: 1.7, md: 2, xl: 2.3 }, mb: 2.25, flexShrink: 0,
      background: `linear-gradient(115deg, ${info.color}12 0%, ${DS.surface} 46%, ${DS.surfaceAlt} 100%)`,
      border: `1px solid ${info.color}30`, borderRadius: 3,
      boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
      '&::after': { content: '""', position: 'absolute', width: 180, height: 180, borderRadius: '50%', right: -70, top: -115, background: info.color, opacity: 0.08 },
    }}>
      <Box sx={{ position: 'relative', zIndex: 1, mb: quote ? 1.35 : 0 }}>
        <PageHero
          compact
          accent={info.color}
          icon={info.emoji}
          title={`${greeting}, ${getDisplayName(user)}!`}
          subtitle={`${info.role} · ${now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}`}
          actions={(
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.75, color: DS.t2, pr: 0.5 }}>
              <Box sx={{
                width: 6, height: 6, borderRadius: '50%', bgcolor: DS.green,
                boxShadow: `0 0 10px ${DS.green}`, animation: 'glowPulse 3s ease-in-out infinite',
              }} />
              <Typography sx={{ fontSize: '0.64rem', fontWeight: 700 }}>Operação ao vivo</Typography>
            </Box>
          )}
        />
      </Box>
      {quote && (
        <Box sx={{ pt: 1.2, borderTop: `1px solid ${info.color}18`, display: 'flex', alignItems: 'flex-start', gap: 0.8, position: 'relative', zIndex: 1 }}>
          <AutoAwesomeIcon sx={{ fontSize: 14, mt: 0.2, color: info.color, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.72rem', color: `${info.color}cc`, fontStyle: 'italic', lineHeight: 1.5, fontWeight: 500 }}>
            {quote}
          </Typography>
        </Box>
      )}
    </Paper>
  )
}
function StatCard({ label, value, color = DS.accent, icon, onClick }: {
  label: string; value: string | number; color?: string; icon?: React.ReactNode; onClick?: () => void
}) {
  return (
    <Paper onClick={onClick} sx={{
      position: 'relative', overflow: 'hidden',
      p: { xs: 1.4, xl: 1.8 }, flex: 1, minWidth: { xs: 112, sm: 128 }, textAlign: 'left',
      border: `1px solid ${color}24`, bgcolor: `${color}08`, borderRadius: 2.25,
      cursor: onClick ? 'pointer' : 'default', transition: 'all 0.18s',
      '&:hover': onClick ? { bgcolor: `${color}12`, borderColor: `${color}48`, transform: 'translateY(-2px)', boxShadow: `0 10px 26px ${color}0e` } : {},
      '&::before': { content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, bgcolor: color, opacity: 0.8 },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 0.65 }}>
        {icon && <Box sx={{ color, display: 'flex' }}>{icon}</Box>}
        <Typography sx={{ fontSize: { xs: '0.58rem', xl: '0.66rem' }, color: DS.t2, textTransform: 'uppercase', letterSpacing: '0.075em', fontWeight: 800 }}>{label}</Typography>
      </Box>
      <Typography sx={{ fontWeight: 850, fontSize: { xs: '1.25rem', xl: '1.55rem' }, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    </Paper>
  )
}

function SectionHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, mb: 1.25 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.57rem', fontWeight: 800, color: DS.accent, textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.2 }}>{eyebrow}</Typography>
        <Typography sx={{ fontSize: { xs: '0.92rem', xl: '1.05rem' }, fontWeight: 800, color: DS.t1, letterSpacing: '-0.02em' }}>{title}</Typography>
        {detail && <Typography sx={{ fontSize: '0.66rem', color: DS.t3, mt: 0.2 }}>{detail}</Typography>}
      </Box>
      {action && <Box sx={{ ml: 'auto', flexShrink: 0 }}>{action}</Box>}
    </Box>
  )
}
function JhonesView({ items, states, clientFolders, now, onStatusChange }: {
  items: ContentItem[]; states: Record<number, ItemState>;
  clientFolders: Record<string, string>; now: Date;
  onStatusChange: (id: number, s: Status) => void
}) {
  const today = useMemo(() => { const d = new Date(now); d.setHours(0,0,0,0); return d }, [now])

  // Design queue: Posts/Reels/Stories/Carrossels (not Feed) with status 0 or 1
  const queue = useMemo(() => items
    .filter(i => i.tp !== 'Feed' && [0, 1].includes(states[i.i]?.status ?? i.s))
    .map(i => ({ ...i, urgency: getUrgency(i.dt, now), st: states[i.i]?.status ?? i.s }))
    .sort((a, b) => {
      const uo = ['overdue','today','tomorrow','week','future']
      return uo.indexOf(a.urgency) - uo.indexOf(b.urgency) || a.dt.getTime() - b.dt.getTime()
    }), [items, states, now])

  // Monthly stats
  const monthItems = items.filter(i => i.tp !== 'Feed' && i.dt.getMonth() === now.getMonth() && i.dt.getFullYear() === now.getFullYear())
  const entregues  = monthItems.filter(i => (states[i.i]?.status ?? i.s) >= 2).length
  const pct        = monthItems.length > 0 ? Math.round((entregues / monthItems.length) * 100) : 0

  const [copied, setCopied] = useState<number | null>(null)
  const copyTitle = (id: number, title: string) => {
    navigator.clipboard.writeText(title).catch(() => {})
    setCopied(id); setTimeout(() => setCopied(null), 1500)
  }

  return (
    <Box>
      {/* KPIs */}
      <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
        <StatCard label="Na fila" value={queue.length} color={DS.purpleSoft} />
        <StatCard label="Atrasados" value={queue.filter(i => i.urgency === 'overdue' && isRealWork(i, states[i.i])).length} color={DS.red} />
        <StatCard label="Hoje" value={queue.filter(i => i.urgency === 'today').length} color={DS.orangeDim} />
        <StatCard label="Entregues/mês" value={`${entregues}/${monthItems.length}`} color={DS.green} />
      </Stack>

      {/* Progress bar do mês */}
      <Paper sx={{ p: 1.5, mb: 2, border: '1px solid rgba(192,132,252,0.15)', bgcolor: 'rgba(192,132,252,0.04)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.8}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(244,247,255,0.7)' }}>
            Progresso do mês
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: pct === 100 ? DS.green : DS.purpleSoft }}>
            {pct}%
          </Typography>
        </Stack>
        <LinearProgress variant="determinate" value={pct}
          sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(192,132,252,0.12)',
            '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? DS.green : DS.purpleSoft, borderRadius: 3 } }} />
      </Paper>

      {/* Fila de design */}
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
        Fila de design ({queue.length})
      </Typography>
      {queue.length === 0 ? (
        <Paper sx={{ py: 4, textAlign: 'center', border: '1px dashed rgba(192,132,252,0.2)', bgcolor: 'transparent' }}>
          <CheckCircleIcon sx={{ fontSize: 32, color: DS.green, mb: 1, display: 'block', mx: 'auto' }} />
          <Typography variant="body2" color="text.secondary">Nenhuma arte na fila 🎉</Typography>
        </Paper>
      ) : (
        <Stack gap={0.8}>
          {queue.slice(0, 12).map(item => (
            <Paper key={item.i} sx={{
              p: 1.2, display: 'flex', alignItems: 'center', gap: 1.2,
              border: `1px solid ${URGENCY_COLOR[item.urgency]}22`,
              bgcolor: `${URGENCY_COLOR[item.urgency]}06`,
              borderLeft: `3px solid ${URGENCY_COLOR[item.urgency]}`,
              borderRadius: 1.5,
            }}>
              {/* Urgency */}
              <Chip label={URGENCY_LABEL[item.urgency]} size="small"
                sx={{ bgcolor: `${URGENCY_COLOR[item.urgency]}20`, color: URGENCY_COLOR[item.urgency], fontWeight: 700, fontSize: '0.6rem', height: 18, flexShrink: 0 }} />
              {/* Info */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(244,247,255,0.9)' }}>
                  {item.c}
                </Typography>
                <Typography noWrap sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                  {item.tp} · {item.n || `ID ${item.i}`}
                </Typography>
              </Box>
              {/* Type badge */}
              <Chip label={item.tp} size="small" variant="outlined"
                sx={{ fontSize: '0.58rem', height: 16, flexShrink: 0, color: 'text.secondary', borderColor: 'rgba(244,247,255,0.1)' }} />
              {/* Actions */}
              <Stack direction="row" gap={0.5} flexShrink={0}>
                {clientFolders[item.c] && (
                  <Tooltip title="Abrir Drive">
                    <IconButton size="small" onClick={() => window.open(clientFolders[item.c], '_blank')}
                      sx={{ width: 26, height: 26, color: DS.orangeDim, '&:hover': { bgcolor: 'rgba(96,165,250,0.1)' } }}>
                      <FolderOpenIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Copiar nome">
                  <IconButton size="small" onClick={() => copyTitle(item.i, item.n || item.c)}
                    sx={{ width: 26, height: 26, color: copied === item.i ? DS.green : 'rgba(244,247,255,0.3)', '&:hover': { bgcolor: 'rgba(244,247,255,0.06)' } }}>
                    <ContentCopyIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
                {item.st === 0 && (
                  <Tooltip title="Iniciar edição">
                    <IconButton size="small" onClick={() => onStatusChange(item.i, 1)}
                      sx={{ width: 26, height: 26, bgcolor: 'rgba(245,158,11,0.1)', color: DS.amber, '&:hover': { bgcolor: 'rgba(245,158,11,0.2)' } }}>
                      <PlayArrowIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {item.st === 1 && (
                  <Tooltip title="Marcar como aprovação interna">
                    <IconButton size="small" onClick={() => onStatusChange(item.i, 2)}
                      sx={{ width: 26, height: 26, bgcolor: 'rgba(96,165,250,0.1)', color: DS.orangeDim, '&:hover': { bgcolor: 'rgba(96,165,250,0.2)' } }}>
                      <CheckCircleIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Paper>
          ))}
          {queue.length > 12 && (
            <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textAlign: 'center', py: 1 }}>
              + {queue.length - 12} itens na aba Design
            </Typography>
          )}
        </Stack>
      )}
    </Box>
  )
}

// ── Seção KERGES — Copy + IA de Legenda ───────────────────
function KergesView({ items, states, allClients, clientHashtags, now, onUpdate }: {
  items: ContentItem[]; states: Record<number, ItemState>; allClients: Client[];
  clientHashtags?: Record<string, string[]>; now: Date;
  onUpdate: (id: number, patch: Partial<ItemState>) => void
}) {
  const [aiLoading, setAiLoading] = useState<number | null>(null)
  const [aiOptions, setAiOptions] = useState<{ id: number; texts: string[] } | null>(null)

  // Items que precisam de legenda: status ≥ 1 (design iniciado), caption vazio, ainda não publicado
  const needCaption = useMemo(() => items
    .filter(i => {
      const st = states[i.i]?.status ?? i.s
      const caption = states[i.i]?.caption ?? ''
      return st >= 1 && st < 7 && caption.trim() === ''
    })
    .sort((a, b) => a.dt.getTime() - b.dt.getTime())
    .slice(0, 15), [items, states])

  const generateCaption = useCallback(async (item: ContentItem) => {
    setAiLoading(item.i)
    setAiOptions(null)
    const clientData = allClients.find(c => c.name === item.c)
    const hashtags   = clientHashtags?.[item.c] ?? []
    const dateStr    = item.dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    const prompt = `Você é redatora sênior de uma agência de marketing digital.
Crie 3 opções de legenda para o ${item.tp} "${item.n}" do cliente ${item.c}.
Nicho: ${clientData?.scriptUrl ? 'restaurante/gastronomia' : 'negócio local'}.
Data de publicação: ${dateStr}.
Hashtags do cliente: ${hashtags.length ? hashtags.join(' ') : 'nenhuma salva'}.
Cada legenda deve ter 3-5 linhas, CTA claro, ser autêntica e engajar.
Retorne SOMENTE as 3 opções, separadas por uma linha em branco, numeradas (1., 2., 3.).`

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json() as { content?: { text: string }[]; choices?: { message: { content: string } }[]; response?: string }
      const raw  = (data.content?.[0]?.text ?? data.choices?.[0]?.message?.content ?? data.response ?? '').trim()
      const blocks = raw.split(/\n\n+/).filter(s => s.trim().length > 20)
      const cleaned = blocks.map(b => b.replace(/^\d+\.\s*/, '').trim()).filter(Boolean).slice(0, 3)
      setAiOptions({ id: item.i, texts: cleaned.length ? cleaned : [raw] })
    } catch {
      setAiOptions({ id: item.i, texts: ['Erro ao gerar. Tente novamente.'] })
    }
    setAiLoading(null)
  }, [allClients, clientHashtags])

  const saveCaption = (id: number, caption: string) => {
    onUpdate(id, { caption })
    setAiOptions(null)
  }

  return (
    <Box>
      {/* Stats */}
      <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
        <StatCard label="Sem legenda" value={needCaption.length} color={DS.pink} />
        <StatCard label="Urgentes hoje" value={needCaption.filter(i => getUrgency(i.dt, now) === 'today').length} color={DS.red} />
        <StatCard label="Esta semana" value={needCaption.filter(i => ['today','tomorrow','week'].includes(getUrgency(i.dt, now))).length} color={DS.amber} />
      </Stack>

      {/* AI caption panel */}
      {aiOptions && (
        <Paper sx={{ p: 1.5, mb: 2, border: '1px solid rgba(251,113,133,0.25)', bgcolor: 'rgba(251,113,133,0.06)', borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" gap={1} mb={1.2}>
            <AutoAwesomeIcon sx={{ color: DS.pink, fontSize: 16 }} />
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: DS.pink }}>Legendas geradas — escolha uma</Typography>
            <Box flex={1} />
            <IconButton size="small" onClick={() => setAiOptions(null)} sx={{ color: 'text.secondary', p: 0.3 }}>✕</IconButton>
          </Stack>
          <Stack gap={1}>
            {aiOptions.texts.map((text, i) => (
              <Paper key={i} sx={{ p: 1.2, bgcolor: 'rgba(244,247,255,0.04)', border: '1px solid rgba(244,247,255,0.07)', borderRadius: 1.5, cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(251,113,133,0.08)', borderColor: 'rgba(251,113,133,0.2)' }
              }} onClick={() => saveCaption(aiOptions.id, text)}>
                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(244,247,255,0.8)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{text}</Typography>
                <Typography sx={{ fontSize: '0.6rem', color: DS.pink, mt: 0.5, fontWeight: 700 }}>↑ clique para usar</Typography>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Caption queue */}
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
        Itens sem legenda ({needCaption.length})
      </Typography>
      {needCaption.length === 0 ? (
        <Paper sx={{ py: 4, textAlign: 'center', border: '1px dashed rgba(251,113,133,0.2)', bgcolor: 'transparent' }}>
          <CheckCircleIcon sx={{ fontSize: 32, color: DS.green, mb: 1, display: 'block', mx: 'auto' }} />
          <Typography variant="body2" color="text.secondary">Todas as legendas estão em dia! 🎉</Typography>
        </Paper>
      ) : (
        <Stack gap={0.8}>
          {needCaption.map(item => {
            const urgency = getUrgency(item.dt, now)
            const isLoading = aiLoading === item.i
            return (
              <Paper key={item.i} sx={{
                p: 1.2, display: 'flex', alignItems: 'center', gap: 1.2,
                border: `1px solid ${URGENCY_COLOR[urgency]}22`,
                borderLeft: `3px solid ${URGENCY_COLOR[urgency]}`,
                bgcolor: `${URGENCY_COLOR[urgency]}06`, borderRadius: 1.5,
              }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" gap={0.8} mb={0.2}>
                    <Chip label={URGENCY_LABEL[urgency]} size="small"
                      sx={{ bgcolor: `${URGENCY_COLOR[urgency]}20`, color: URGENCY_COLOR[urgency], fontWeight: 700, fontSize: '0.58rem', height: 16, flexShrink: 0 }} />
                    <Typography noWrap sx={{ fontSize: '0.72rem', fontWeight: 700 }}>{item.c}</Typography>
                    <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', flexShrink: 0 }}>
                      {item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </Typography>
                  </Stack>
                  <Typography noWrap sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                    {item.tp} · {item.n || `Item ${item.i}`}
                  </Typography>
                </Box>
                <Tooltip title="Gerar legenda com IA">
                  <Button size="small" onClick={() => generateCaption(item)} disabled={isLoading}
                    startIcon={isLoading ? <CircularProgress size={10} /> : <AutoAwesomeIcon sx={{ fontSize: '0.75rem !important' }} />}
                    sx={{
                      minWidth: 80, height: 28, fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                      background: DS.pink,
                      color: '#fff', borderRadius: 1.5, textTransform: 'none',
                      '&:hover': { filter: 'brightness(1.08)' },
                      '&:disabled': { opacity: 0.5 },
                    }}>
                    {isLoading ? 'Gerando…' : '✨ Gerar IA'}
                  </Button>
                </Tooltip>
              </Paper>
            )
          })}
        </Stack>
      )}
    </Box>
  )
}

// ── Seção SÓCIO — Visão executiva ─────────────────────────
function SocioView({ items, states, allClients, now, onTabChange }: {
  items: ContentItem[]; states: Record<number, ItemState>;
  allClients: Client[]; now: Date; onTabChange?: (t: number) => void
}) {
  const today = useMemo(() => { const d = new Date(now); d.setHours(0,0,0,0); return d }, [now])

  const financeiro = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('sm_financeiro') ?? '{}') as Record<string, { valor: number; status: string }> }
    catch { return {} }
  }, [])
  const mrr      = Object.values(financeiro).reduce((s, e) => s + (e.valor || 0), 0)
  const atrasado = Object.values(financeiro).filter(e => e.status === 'atrasado').length
  const pendente = Object.values(financeiro).filter(e => e.status === 'pendente').length
  const recebido = Object.values(financeiro).filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)

  const leads = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('sm_prospeccao') ?? '[]') as { stage: string; estimatedTicket?: number }[] }
    catch { return [] }
  }, [])
  const leadsAtivos    = leads.filter(l => !['fechado','perdido'].includes(l.stage)).length
  const leadsPropostas = leads.filter(l => l.stage === 'proposta').length
  const mrpPotencial   = leads.filter(l => l.stage !== 'perdido').reduce((s, l) => s + (l.estimatedTicket ?? 0), 0)

  const late       = countRealLate(items, states, today)
  const published  = items.filter(i => (states[i.i]?.status ?? i.s) === 7).length
  const reprovados = items.filter(i => (states[i.i]?.status ?? i.s) === 6).length
  const pct        = items.length > 0 ? Math.round((published / items.length) * 100) : 0
  const atRisk = allClients.filter(c => items.some(i => i.c === c.name && isRealLate(i, states[i.i], today))).length

  return (
    <Box>
      <SectionHeading eyebrow="Visão executiva" title="Pulso da operação" detail="Indicadores essenciais para decidir o próximo movimento." />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.15fr) minmax(300px, 0.85fr)' }, gap: 1.5, mb: 2.5 }}>
        <Paper sx={{ p: { xs: 1.6, md: 2 }, borderRadius: 3, borderColor: `${DS.accent}28`, background: `linear-gradient(145deg, ${DS.surfaceAlt}, ${DS.surface})` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: `${DS.accent}16`, color: DS.accent, mr: 1 }}>
              <InsightsIcon sx={{ fontSize: 19 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '0.86rem' }}>Pipeline de conteúdo</Typography>
              <Typography sx={{ color: DS.t3, fontSize: '0.62rem' }}>{published} de {items.length} conteúdos publicados</Typography>
            </Box>
            <Typography sx={{ ml: 'auto', color: pct >= 80 ? DS.green : DS.accent, fontWeight: 900, fontSize: '1.35rem', letterSpacing: '-0.04em' }}>{pct}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={pct} sx={{ height: 7, mb: 1.5, bgcolor: `${DS.accent}12`, '& .MuiLinearProgress-bar': { bgcolor: pct >= 80 ? DS.green : DS.accent } }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
            <StatCard label="Atrasados" value={late} color={late > 0 ? DS.red : DS.green} />
            <StatCard label="Reprovados" value={reprovados} color={reprovados > 0 ? DS.red : DS.green} />
            <StatCard label="Clientes em risco" value={atRisk} color={atRisk > 0 ? DS.amber : DS.green} icon={<GroupsIcon sx={{ fontSize: 15 }} />} />
          </Box>
        </Paper>

        <Paper sx={{ p: { xs: 1.6, md: 2 }, borderRadius: 3, background: `linear-gradient(145deg, ${DS.surfaceAlt}, ${DS.surface})` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: `${DS.green}14`, color: DS.green, mr: 1 }}>
              <AccountBalanceWalletIcon sx={{ fontSize: 18 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '0.86rem' }}>Receita recorrente</Typography>
              <Typography sx={{ color: DS.t3, fontSize: '0.62rem' }}>Financeiro e novas oportunidades</Typography>
            </Box>
          </Box>
          <Box sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: '0.58rem', textTransform: 'uppercase', color: DS.t3, fontWeight: 800, letterSpacing: '0.09em' }}>MRR atual</Typography>
            <Typography sx={{ fontSize: { xs: '1.8rem', xl: '2.15rem' }, lineHeight: 1.15, fontWeight: 900, color: DS.green, letterSpacing: '-0.045em' }}>{fmt(mrr)}</Typography>
            <Typography sx={{ fontSize: '0.62rem', color: DS.t2, mt: 0.25 }}>{fmt(recebido)} recebido · {pendente} pendente · {atrasado} atrasado</Typography>
          </Box>
          <Divider sx={{ mb: 1.4 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.8 }}>
            {[
              { label: 'Leads', value: leadsAtivos, color: DS.accent },
              { label: 'Propostas', value: leadsPropostas, color: DS.cyan },
              { label: 'Potencial', value: fmt(mrpPotencial), color: DS.purple },
            ].map(metric => (
              <Box key={metric.label} sx={{ p: 1, borderRadius: 1.75, bgcolor: `${metric.color}09`, border: `1px solid ${metric.color}1f`, minWidth: 0 }}>
                <Typography noWrap sx={{ color: metric.color, fontSize: { xs: '0.82rem', sm: '0.95rem' }, fontWeight: 850, fontVariantNumeric: 'tabular-nums' }}>{metric.value}</Typography>
                <Typography sx={{ color: DS.t3, fontSize: '0.52rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em' }}>{metric.label}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>

      <SectionHeading eyebrow="Navegação rápida" title="Ir direto ao trabalho" />
      <Stack direction="row" gap={1} flexWrap="wrap" mb={2.75}>
        {[
          { label: 'Financeiro', tab: 11 },
          { label: 'Prospecção', tab: 17 },
          { label: 'Equipe', tab: 12 },
          { label: 'Dashboard', tab: 7 },
          { label: 'Performance', tab: 19 },
        ].map(({ label, tab }) => (
          <Button key={tab} size="small" variant="outlined" endIcon={<ArrowForwardIcon sx={{ fontSize: '13px !important' }} />} onClick={() => onTabChange?.(tab)}
            sx={{ fontSize: '0.68rem', height: 32, px: 1.25, borderColor: DS.border, color: DS.t2, bgcolor: `${DS.surfaceAlt}80`, '&:hover': { borderColor: DS.borderHov, color: DS.accent, bgcolor: `${DS.accent}08` } }}>
            {label}
          </Button>
        ))}
      </Stack>

      <ClientQualitySection items={items} states={states} allClients={allClients} now={now} onTabChange={onTabChange} />
    </Box>
  )
}
const SATISFACTION_KEY = 'sm_client_satisfaction'

function loadSatisfaction(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SATISFACTION_KEY) ?? '{}') }
  catch { return {} }
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <Box sx={{ display: 'flex', gap: 0.2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Box
          key={s}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={(e) => { e.stopPropagation(); onChange(s) }}
          sx={{
            fontSize: '0.85rem', lineHeight: 1, cursor: 'pointer',
            color: s <= (hover || value) ? DS.amber : 'rgba(244,247,255,0.18)',
            transition: 'color 0.15s',
            userSelect: 'none',
          }}
        >
          ★
        </Box>
      ))}
    </Box>
  )
}

function ClientQualitySection({ items, states, allClients, now, onTabChange }: {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  now: Date
  onTabChange?: (t: number) => void
}) {
  const [ratings, setRatings] = useState<Record<string, number>>(loadSatisfaction)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  function setRating(clientName: string, rating: number) {
    const next = { ...ratings, [clientName]: rating }
    setRatings(next)
    localStorage.setItem(SATISFACTION_KEY, JSON.stringify(next))
  }

  const today = useMemo(() => { const d = new Date(now); d.setHours(0,0,0,0); return d }, [now])
  const month = now.getMonth()
  const year  = now.getFullYear()

  const metrics = useMemo(() => allClients.map(client => {
    const all         = items.filter(i => i.c === client.name)
    const monthItems  = all.filter(i => i.dt.getMonth() === month && i.dt.getFullYear() === year)
    const total       = monthItems.length
    const published   = monthItems.filter(i => (states[i.i]?.status ?? i.s) === 7).length
    const sent        = monthItems.filter(i => [4,5,6,7].includes(states[i.i]?.status ?? i.s)).length
    const approved    = monthItems.filter(i => [5,7].includes(states[i.i]?.status ?? i.s)).length
    const rejected    = monthItems.filter(i => (states[i.i]?.status ?? i.s) === 6).length
    const late        = monthItems.filter(i => (states[i.i]?.status ?? i.s) < 7 && i.dt < today).length
    const deliveryPct = total > 0 ? Math.round((published / total) * 100) : 0
    const approvalPct = sent > 0 ? Math.round((approved / sent) * 100) : null
    const health: 'green' | 'yellow' | 'red' = late > 3 || rejected > 2 ? 'red' : late > 0 || rejected > 0 ? 'yellow' : 'green'
    return { client, total, published, rejected, late, deliveryPct, approvalPct, health }
  }), [items, states, allClients, month, year, today])

  const HEALTH_COLOR = { green: DS.green, yellow: DS.amber, red: DS.red }
  const HEALTH_LABEL = { green: 'Em dia', yellow: 'Atenção', red: 'Crítico' }
  const priorityMetrics = useMemo(() => [...metrics].sort((a, b) => {
    const rank = { red: 2, yellow: 1, green: 0 }
    return rank[b.health] - rank[a.health] || b.late - a.late || a.client.name.localeCompare(b.client.name)
  }), [metrics])
  const visibleMetrics = showAll ? priorityMetrics : priorityMetrics.slice(0, 6)

  return (
    <Box>
      <SectionHeading
        eyebrow="Carteira de clientes"
        title="Prioridades de atenção"
        detail={`${allClients.length} clientes ativos · ordenados por risco e atraso`}
        action={<Button size="small" onClick={() => onTabChange?.(6)} endIcon={<ArrowForwardIcon sx={{ fontSize: '13px !important' }} />}>Ver clientes</Button>}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
        {visibleMetrics.map(({ client, total, published, deliveryPct, approvalPct, rejected, late, health }) => {
          const rating = ratings[client.name] ?? 0
          const isOpen = expanded === client.name
          const hColor = HEALTH_COLOR[health]

          return (
            <Paper key={client.name} onClick={() => setExpanded(isOpen ? null : client.name)} sx={{
              borderRadius: 2.25, overflow: 'hidden', cursor: 'pointer', position: 'relative',
              border: `1px solid ${isOpen ? hColor + '45' : DS.border}`,
              bgcolor: isOpen ? `${hColor}07` : DS.surface,
              transition: 'all 0.18s',
              '&:hover': { borderColor: `${hColor}38`, bgcolor: DS.surfaceAlt, transform: 'translateY(-1px)' },
              '&::before': { content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, bgcolor: hColor },
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, px: 1.5, py: 1.2, flexWrap: 'wrap' }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: hColor, flexShrink: 0, boxShadow: `0 0 8px ${hColor}70` }} />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 750, flex: 1, lineHeight: 1.2, minWidth: 120 }} noWrap>{client.name}</Typography>
                <Tooltip title="Publicados este mês">
                  <Box sx={{ textAlign: 'center', minWidth: 38 }}>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 900, color: deliveryPct >= 80 ? DS.green : deliveryPct >= 50 ? DS.amber : DS.red, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{deliveryPct}%</Typography>
                    <Typography sx={{ fontSize: '0.5rem', color: DS.t3, lineHeight: 1 }}>entrega</Typography>
                  </Box>
                </Tooltip>
                {approvalPct !== null && (
                  <Tooltip title="Aprovado pelo cliente / enviado">
                    <Box sx={{ textAlign: 'center', minWidth: 38 }}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 900, color: approvalPct >= 80 ? DS.green : approvalPct >= 50 ? DS.amber : DS.red, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{approvalPct}%</Typography>
                      <Typography sx={{ fontSize: '0.5rem', color: DS.t3, lineHeight: 1 }}>aprovação</Typography>
                    </Box>
                  </Tooltip>
                )}
                <Chip label={HEALTH_LABEL[health]} size="small" sx={{ fontSize: '0.55rem', height: 19, fontWeight: 700, bgcolor: `${hColor}15`, color: hColor, border: `1px solid ${hColor}30`, flexShrink: 0 }} />
                <Box onClick={e => e.stopPropagation()} sx={{ order: { xs: 5, sm: 'initial' }, flexBasis: { xs: '100%', sm: 'auto' } }}>
                  <StarRating value={rating} onChange={v => setRating(client.name, v)} />
                </Box>
              </Box>

              {isOpen && (
                <Box sx={{ px: 2, pb: 1.3, pt: 0.3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Total planejado', value: total, color: DS.t2 },
                    { label: 'Publicados', value: published, color: DS.green },
                    { label: 'Atrasados', value: late, color: late > 0 ? DS.red : DS.green },
                    { label: 'Reprovados', value: rejected, color: rejected > 0 ? DS.red : DS.green },
                  ].map(kpi => (
                    <Box key={kpi.label} sx={{ textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: kpi.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{kpi.value}</Typography>
                      <Typography sx={{ fontSize: '0.55rem', color: DS.t3, mt: 0.2 }}>{kpi.label}</Typography>
                    </Box>
                  ))}
                  <Box sx={{ flex: '1 1 100%', mt: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                      <Typography sx={{ fontSize: '0.55rem', color: DS.t3 }}>Progresso de entrega</Typography>
                      <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: hColor }}>{deliveryPct}%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={deliveryPct} sx={{ height: 4, bgcolor: `${DS.neutral}12`, '& .MuiLinearProgress-bar': { bgcolor: hColor } }} />
                  </Box>
                </Box>
              )}
            </Paper>
          )
        })}
      </Box>

      {priorityMetrics.length > 6 && (
        <Button size="small" variant="text" onClick={() => setShowAll(v => !v)} sx={{ mt: 1.1, color: DS.t2 }}>
          {showAll ? 'Mostrar apenas prioridades' : `Mostrar todos os ${priorityMetrics.length} clientes`}
        </Button>
      )}
    </Box>
  )
}
/**
 * A visão do Kaique — SÓ vídeo.
 *
 * Antes ela contava o painel inteiro: "902 itens", "91% de progresso", "30
 * críticos". Nada disso era trabalho dele — entravam artes do Design, legendas
 * do Copy e publicações do Social. Um número que mistura o trabalho de cinco
 * pessoas não diz nada para nenhuma delas.
 *
 * Agora tudo aqui é `tp === 'Reel'`, que é o que o board de Vídeo mostra. Os
 * alertas do painel inteiro saíram: nenhum dos tipos existentes (design,
 * legenda, financeiro, saúde, onboarding) é de vídeo, então filtrar deixaria a
 * lista vazia de qualquer jeito. Eles continuam no Dashboard.
 */
function KaiqueView({ items, states, now, onTabChange }: {
  items: ContentItem[]; states: Record<number, ItemState>; now: Date; onTabChange?: (t: number) => void
}) {
  const today = useMemo(() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d }, [now])

  /*
     Só vídeo, e só o que é TRABALHO DE ALGUÉM.

     `Reel` é o que o board de Vídeo filtra (Story vai para Design, apesar de o
     texto do board dizer "Reels e Stories" — o código é a verdade).

     O `isRealWork` não é detalhe: junho e julho foram semeados no banco e
     ninguém trabalha neles. Sem esse filtro a tela abria com "232 reels" e
     "232 sem editor definido" — os mesmos 232 cards que nunca foram tocados.
     É a armadilha dos "452 atrasados" que o painel já tinha corrigido em todo
     lugar, e que voltou aqui até a conferência na tela pegá-la.
  */
  const reels = useMemo(
    () => items.filter(i => i.tp === 'Reel' && isRealWork(i, states[i.i])),
    [items, states],
  )

  const emEdicao  = reels.filter(i => (states[i.i]?.status ?? i.s) === 1)
  const emRevisao = reels.filter(i => (states[i.i]?.status ?? i.s) === 2)
  const ajuste    = reels.filter(i => (states[i.i]?.status ?? i.s) === 6)
  const atrasados = realLateItems(reels, states, today)

  // Progresso do MÊS em vídeo — antes era o do painel inteiro, que incluía
  // arte e legenda e por isso vivia em 90% enquanto a fila de reels crescia.
  const doMes = useMemo(() => reels.filter(i =>
    i.dt.getFullYear() === now.getFullYear() && i.dt.getMonth() === now.getMonth()), [reels, now])
  const publicadosMes = doMes.filter(i => (states[i.i]?.status ?? i.s) === 7).length
  const pct = doMes.length > 0 ? Math.round((publicadosMes / doMes.length) * 100) : 0

  // Quem edita cada card, pela mesma regra do selo no board.
  const { paineisVid, atribuicoes } = useMemo(() => ({
    paineisVid: paineisDaArea(carregarPaineis(), 'vid'),
    atribuicoes: carregarAtribuicoes(),
  }), [])

  const meus = useMemo(() => {
    const abertos = reels.filter(i => isOpenStatus(states[i.i]?.status ?? i.s))
    return abertos
      .filter(i => editorDoCard(i.i, states[i.i], atribuicoes, paineisVid)?.membro === 'kaique')
      .map(i => ({ ...i, urgency: getUrgency(i.dt, now) }))
      .sort((a, b) => {
        const ordem = ['overdue', 'today', 'tomorrow', 'week', 'future']
        return ordem.indexOf(a.urgency) - ordem.indexOf(b.urgency) || a.dt.getTime() - b.dt.getTime()
      })
  }, [reels, states, atribuicoes, paineisVid, now])

  // Reels que ninguém pegou. É a fila da ÁREA, não a dele — mas é ele quem a
  // vê primeiro, e é a pergunta "o que está parado esperando dono".
  const semDono = useMemo(() => reels.filter(i =>
    isOpenStatus(states[i.i]?.status ?? i.s)
    && !editorDoCard(i.i, states[i.i], atribuicoes, paineisVid)),
  [reels, states, atribuicoes, paineisVid])

  return (
    <Box>
      {/* ── Os números, só de vídeo ── */}
      <SectionHeading
        eyebrow="Sua área"
        title="Vídeo"
        detail={`${reels.length} reels no total · ${doMes.length} deste mês`}
      />
      <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
        <StatCard label="Em edição"   value={emEdicao.length}  color={DS.amber}     onClick={() => onTabChange?.(10)} />
        <StatCard label="Em revisão"  value={emRevisao.length} color={DS.cyan} />
        <StatCard label="Ajuste pedido" value={ajuste.length} color={ajuste.length > 0 ? DS.red : DS.green} />
        <StatCard label="Atrasados"   value={atrasados.length} color={atrasados.length > 0 ? DS.red : DS.green} />
      </Stack>

      <Paper sx={{ p: 1.5, mb: 2, border: `1px solid ${DS.border}`, bgcolor: 'rgba(59,130,246,0.04)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.8}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: DS.t1 }}>
            Vídeo publicado em {now.toLocaleDateString('pt-BR', { month: 'long' })}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 900, color: pct > 80 ? DS.green : DS.accent }}>
            {publicadosMes}/{doMes.length}
          </Typography>
        </Stack>
        <LinearProgress variant="determinate" value={pct}
          sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(59,130,246,0.1)',
            '& .MuiLinearProgress-bar': { bgcolor: pct > 80 ? DS.green : DS.accent, borderRadius: 3 } }} />
      </Paper>

      {/* ── A fila dele, com o que falta para cada um ── */}
      <SectionHeading
        eyebrow="Para editar"
        title={meus.length > 0 ? `${meus.length} ${meus.length === 1 ? 'vídeo seu' : 'vídeos seus'}` : 'Sua fila'}
        detail="O que falta em cada um antes de abrir o editor"
        action={
          <Button size="small" variant="outlined" onClick={() => onTabChange?.(10)}
            sx={{ fontSize: '0.62rem', height: 22, px: 1, color: DS.accent, borderColor: 'rgba(59,130,246,0.3)', minWidth: 0 }}>
            Ver Editor →
          </Button>
        }
      />
      {meus.length === 0 ? (
        <Paper sx={{ py: 2.2, textAlign: 'center', border: `1px dashed ${DS.border}`, bgcolor: 'transparent', borderRadius: 1.5, mb: 2 }}>
          <CheckCircleIcon sx={{ fontSize: 22, color: DS.green, mb: 0.6, display: 'block', mx: 'auto' }} />
          <Typography sx={{ fontSize: '0.72rem', color: DS.t2 }}>Nenhum vídeo na sua fila 🎉</Typography>
          <Typography sx={{ fontSize: '0.6rem', color: DS.t3, mt: 0.4 }}>
            Cards aparecem aqui quando a gaveta "Kaique" do board Vídeo é escolhida.
          </Typography>
        </Paper>
      ) : (
        <Stack gap={0.7} mb={2}>
          {meus.slice(0, 6).map(item => {
            const st = states[item.i]
            // O que impede de começar. Vem de campo real do card — não é dica
            // genérica: sem material bruto não há o que editar, e sem roteiro
            // se edita no escuro.
            const semMaterial = !st?.footageLink
            const semRoteiro  = !st?.roteiroLink
            const pronto = !semMaterial && !semRoteiro
            return (
              <Paper key={item.i} sx={{
                p: 1.1, borderRadius: 1.5,
                border: `1px solid ${URGENCY_COLOR[item.urgency]}22`,
                bgcolor: `${URGENCY_COLOR[item.urgency]}06`,
                borderLeft: `3px solid ${URGENCY_COLOR[item.urgency]}`,
              }}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Chip label={URGENCY_LABEL[item.urgency]} size="small"
                    sx={{ bgcolor: `${URGENCY_COLOR[item.urgency]}20`, color: URGENCY_COLOR[item.urgency], fontWeight: 700, fontSize: '0.58rem', height: 16, flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: '0.75rem', fontWeight: 700, color: DS.t1 }}>{item.c}</Typography>
                    <Typography noWrap sx={{ fontSize: '0.62rem', color: DS.t2 }}>
                      {st?.title || item.n} · {item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" gap={0.6} mt={0.8} flexWrap="wrap">
                  {pronto ? (
                    <Selo cor={DS.green} texto="✓ material e roteiro no card" />
                  ) : (
                    <>
                      {semMaterial && <Selo cor={DS.alert} texto="sem material bruto" />}
                      {semRoteiro  && <Selo cor={DS.amber} texto="sem roteiro" />}
                    </>
                  )}
                </Stack>
              </Paper>
            )
          })}
          {meus.length > 6 && (
            <Typography sx={{ fontSize: '0.6rem', color: DS.t3, textAlign: 'center', mt: 0.3 }}>
              + {meus.length - 6} na fila — ver Editor completo
            </Typography>
          )}
        </Stack>
      )}

      {/* ── Reels sem dono ── */}
      {semDono.length > 0 && (
        <>
          <SectionHeading
            eyebrow="Área de vídeo"
            title={`${semDono.length} sem editor definido`}
            detail="Ninguém pegou esses ainda"
            action={
              <Button size="small" variant="outlined" onClick={() => onTabChange?.(4)}
                sx={{ fontSize: '0.62rem', height: 22, px: 1, color: DS.accent, borderColor: 'rgba(59,130,246,0.3)', minWidth: 0 }}>
                Abrir board →
              </Button>
            }
          />
          <Stack gap={0.5} mb={2}>
            {semDono.slice(0, 4).map(item => (
              <Paper key={item.i} sx={{ p: 0.9, borderRadius: 1.5, border: `1px solid ${DS.border}`, bgcolor: DS.field }}>
                <Typography noWrap sx={{ fontSize: '0.72rem', fontWeight: 700, color: DS.t1 }}>{item.c}</Typography>
                <Typography noWrap sx={{ fontSize: '0.6rem', color: DS.t2 }}>
                  {states[item.i]?.title || item.n} · {item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </Typography>
              </Paper>
            ))}
            {semDono.length > 4 && (
              <Typography sx={{ fontSize: '0.6rem', color: DS.t3, textAlign: 'center' }}>
                + {semDono.length - 4} no board
              </Typography>
            )}
          </Stack>
        </>
      )}

      {/* Nada é escondido em silêncio: dizer onde o resto ficou. */}
      <Typography sx={{ fontSize: '0.6rem', color: DS.t4, textAlign: 'center', mt: 1 }}>
        Esta tela mostra só vídeo. Alertas e números do painel inteiro ficam no Dashboard.
      </Typography>
    </Box>
  )
}

/** Selo do que falta num card da fila. */
function Selo({ cor, texto }: { cor: string; texto: string }) {
  return (
    <Box sx={{
      px: 0.75, py: 0.3, borderRadius: '6px',
      bgcolor: `${cor}18`, border: `1px solid ${cor}45`,
    }}>
      <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: cor, lineHeight: 1.3 }}>
        {texto}
      </Typography>
    </Box>
  )
}

// ── Seção ARTHUR — Social Media + Tráfego ────────────────
function ArthurView({ now, items, states, allClients, roteiros, onStatusChange, onTabChange }: {
  now: Date
  items: ContentItem[]; states: Record<number, ItemState>
  allClients: Client[]; roteiros: Record<string, Roteiro[]>
  onStatusChange: (id: number, s: Status) => void
  onTabChange?: (t: number) => void
}) {
  const AR = DS.green
  const today = useMemo(() => { const d = new Date(now); d.setHours(0,0,0,0); return d }, [now])

  // ── Social media ─────────────────────────────────────────
  const readyToPublish = useMemo(() =>
    items.filter(i => (states[i.i]?.status ?? i.s) === 5).sort((a, b) => a.dt.getTime() - b.dt.getTime()).slice(0, 8),
    [items, states])

  const readyToSend = useMemo(() =>
    items.filter(i => (states[i.i]?.status ?? i.s) === 3).sort((a, b) => a.dt.getTime() - b.dt.getTime()).slice(0, 6),
    [items, states])

  const lateItems = useMemo(() => countRealLate(items, states, today), [items, states, today])

  const monthItems  = items.filter(i => i.dt.getMonth() === now.getMonth() && i.dt.getFullYear() === now.getFullYear())
  const published   = monthItems.filter(i => (states[i.i]?.status ?? i.s) === 7).length
  const pct         = monthItems.length > 0 ? Math.round((published / monthItems.length) * 100) : 0

  const undistrCount = allClients.filter(c => (roteiros[c.name] ?? []).some(r => !r.distributed)).length

  // ── Tráfego ───────────────────────────────────────────────
  const trafego = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('sm_trafego') ?? '{}') as Record<string, { plataforma: string; budget: number; investido: number; roas: number; status: string; responsavel: string; clientName?: string }> }
    catch { return {} }
  }, [])

  const trafegoEntries = Object.entries(trafego).map(([id, e]) => ({ id, ...e }))
  const ativas = trafegoEntries.filter(e => e.status === 'ativa')
  const alertas = ativas.filter(e => {
    const pct_ = e.budget > 0 ? (e.investido / e.budget) * 100 : 0
    return pct_ > 80 || e.roas < 1.5
  })
  const totalBudget    = ativas.reduce((s, e) => s + (e.budget || 0), 0)
  const totalInvestido = ativas.reduce((s, e) => s + (e.investido || 0), 0)
  const budgetPct      = totalBudget > 0 ? Math.round((totalInvestido / totalBudget) * 100) : 0

  // KPIs principais — prioridade visual
  const criticalItems = [
    readyToPublish.length > 0 && { label: `${readyToPublish.length} pra publicar`, color: AR, urgent: false },
    lateItems > 0             && { label: `${lateItems} atrasado${lateItems > 1 ? 's' : ''}`, color: DS.red, urgent: true },
    alertas.length > 0        && { label: `${alertas.length} alerta${alertas.length > 1 ? 's' : ''} de campanha`, color: DS.amber, urgent: true },
  ].filter(Boolean) as Array<{ label: string; color: string; urgent: boolean }>

  return (
    <Box>
      {/* KPI strip */}
      <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
        <StatCard label="Publicar agora" value={readyToPublish.length} color={AR} icon={<SendIcon sx={{ fontSize: 16 }} />} />
        <StatCard label="Enviar cliente" value={readyToSend.length} color={DS.orangeDim} />
        <StatCard label="Atrasados" value={lateItems} color={lateItems > 0 ? DS.red : AR} />
        <StatCard label="Campanhas" value={ativas.length} color={AR} />
        {alertas.length > 0 && <StatCard label="Alertas tráf." value={alertas.length} color={DS.amber} icon={<ErrorOutlineIcon sx={{ fontSize: 16 }} />} />}
      </Stack>

      {/* Mapa do dia — itens críticos */}
      {criticalItems.length > 0 && (
        <Paper sx={{ p: 1.5, mb: 2, border: `1px solid ${AR}18`, bgcolor: `${AR}04` }}>
          <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: AR, mb: 1 }}>
            Foco de hoje
          </Typography>
          <Stack gap={0.6}>
            {criticalItems.map((item, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: item.color, flexShrink: 0, boxShadow: `0 0 6px ${item.color}` }} />
                <Typography sx={{ fontSize: '0.72rem', fontWeight: item.urgent ? 700 : 600, color: item.urgent ? item.color : 'rgba(244,247,255,0.8)' }}>
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Progresso mensal */}
      <Paper sx={{ p: 1.5, mb: 2, border: `1px solid ${AR}18`, bgcolor: `${AR}04` }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.8}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(244,247,255,0.65)' }}>
            Publicações — {now.toLocaleDateString('pt-BR', { month: 'long' })}
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: pct === 100 ? AR : DS.orangeDim }}>{pct}% · {published}/{monthItems.length}</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={pct}
          sx={{ height: 5, borderRadius: 3, bgcolor: `${AR}14`,
            '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? AR : DS.orangeDim, borderRadius: 3 } }} />
        {undistrCount > 0 && (
          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.3)', mt: 0.6 }}>
            {undistrCount} cliente{undistrCount > 1 ? 's' : ''} sem roteiro distribuído
          </Typography>
        )}
      </Paper>

      {/* ── SOCIAL MEDIA ──────────────────────────────────────── */}
      <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: AR, mb: 1 }}>
        📱 Social media
      </Typography>

      {readyToPublish.length > 0 ? (
        <Stack gap={0.6} mb={1.5}>
          {readyToPublish.map(item => (
            <Paper key={item.i} sx={{
              px: 1.4, py: 1, display: 'flex', alignItems: 'center', gap: 1.2,
              border: `1px solid ${AR}22`, bgcolor: `${AR}05`, borderLeft: `3px solid ${AR}`, borderRadius: 1.5,
            }}>
              <Box flex={1} minWidth={0}>
                <Typography noWrap sx={{ fontSize: '0.76rem', fontWeight: 700 }}>{item.c}</Typography>
                <Typography noWrap sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>
                  {item.tp} · {item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </Typography>
              </Box>
              {states[item.i]?.link && (
                <Tooltip title="Abrir criativo">
                  <IconButton size="small" onClick={() => window.open(states[item.i].link, '_blank')}
                    sx={{ width: 26, height: 26, color: DS.orangeDim }}>
                    <OpenInNewIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Marcar como publicado">
                <IconButton size="small" onClick={() => onStatusChange(item.i, 7)}
                  sx={{ width: 28, height: 28, bgcolor: `${AR}14`, color: AR, '&:hover': { bgcolor: `${AR}28` } }}>
                  <CheckCircleIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Paper sx={{ py: 1.5, px: 2, mb: 1.5, border: `1px solid ${AR}12`, bgcolor: 'transparent', display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon sx={{ fontSize: 14, color: AR }} />
          <Typography sx={{ fontSize: '0.68rem', color: AR, fontWeight: 600 }}>Nada pra publicar agora</Typography>
        </Paper>
      )}

      {readyToSend.length > 0 && (
        <Stack gap={0.6} mb={2}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: DS.orangeDim, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
            Aguardando envio ao cliente ({readyToSend.length})
          </Typography>
          {readyToSend.map(item => (
            <Paper key={item.i} sx={{
              px: 1.4, py: 0.9, display: 'flex', alignItems: 'center', gap: 1,
              border: '1px solid rgba(96,165,250,0.15)', bgcolor: 'rgba(96,165,250,0.04)',
              borderLeft: `3px solid ${DS.orangeDim}`, borderRadius: 1.5,
            }}>
              <Box flex={1} minWidth={0}>
                <Typography noWrap sx={{ fontSize: '0.76rem', fontWeight: 700 }}>{item.c}</Typography>
                <Typography noWrap sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>{item.tp}</Typography>
              </Box>
              <Chip label="Enviar" size="small"
                sx={{ fontSize: '0.58rem', height: 18, bgcolor: 'rgba(96,165,250,0.12)', color: DS.orangeDim, cursor: 'pointer', fontWeight: 700 }}
                onClick={() => onStatusChange(item.i, 4)} />
            </Paper>
          ))}
        </Stack>
      )}

      {/* ── TRÁFEGO ──────────────────────────────────────────── */}
      {(ativas.length > 0 || alertas.length > 0) && (
        <>
          <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: AR, mb: 1, mt: 1 }}>
            📈 Tráfego pago
          </Typography>

          {totalBudget > 0 && (
            <Paper sx={{ p: 1.4, mb: 1.5, border: `1px solid ${AR}18`, bgcolor: `${AR}04` }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.6}>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(244,247,255,0.6)' }}>
                  Budget geral · {fmt(totalInvestido)} / {fmt(totalBudget)}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: budgetPct > 80 ? DS.red : AR }}>{budgetPct}%</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={Math.min(budgetPct, 100)}
                sx={{ height: 5, borderRadius: 3, bgcolor: `${AR}14`,
                  '& .MuiLinearProgress-bar': { bgcolor: budgetPct > 80 ? DS.red : budgetPct > 60 ? DS.amber : AR, borderRadius: 3 } }} />
            </Paper>
          )}

          {alertas.length > 0 && (
            <Stack gap={0.6} mb={2}>
              {alertas.map(e => {
                const pct_ = e.budget > 0 ? Math.round((e.investido / e.budget) * 100) : 0
                return (
                  <Paper key={e.id} sx={{
                    px: 1.4, py: 0.9, border: '1px solid rgba(239,68,68,0.2)', bgcolor: 'rgba(239,68,68,0.04)',
                    borderLeft: `3px solid ${DS.red}`, borderRadius: 1.5,
                    display: 'flex', alignItems: 'center', gap: 1,
                  }}>
                    <ErrorOutlineIcon sx={{ fontSize: 13, color: DS.red, flexShrink: 0 }} />
                    <Typography sx={{ flex: 1, fontSize: '0.74rem', fontWeight: 700 }} noWrap>
                      {(e as { clientName?: string }).clientName ?? e.id}
                    </Typography>
                    {e.budget > 0 && pct_ > 80 && <Chip label={`Budget ${pct_}%`} size="small" sx={{ bgcolor: 'rgba(239,68,68,0.12)', color: DS.red, fontSize: '0.56rem', height: 16, fontWeight: 700 }} />}
                    {e.roas < 1.5 && <Chip label={`ROAS ${e.roas.toFixed(1)}x`} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.08)', color: DS.amber, fontSize: '0.56rem', height: 16, fontWeight: 700 }} />}
                  </Paper>
                )
              })}
            </Stack>
          )}
        </>
      )}
    </Box>
  )
}

// ── Seção TRÁFEGO — Robson ────────────────────────────────
function TrafegoView({ currentUser, now, items, states, allClients, onTabChange }: {
  currentUser: string; now: Date
  items: ContentItem[]; states: Record<number, ItemState>
  allClients: Client[]; onTabChange?: (t: number) => void
}) {
  const trafego = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('sm_trafego') ?? '{}') as Record<string, { plataforma: string; budget: number; investido: number; roas: number; status: string; responsavel: string; clientName?: string }> }
    catch { return {} }
  }, [])

  const entries = Object.entries(trafego)
    .map(([id, e]) => ({ id, ...e }))
    .filter(e => e.responsavel === currentUser || !e.responsavel)

  const ativas    = entries.filter(e => e.status === 'ativa')
  const alertas   = entries.filter(e => {
    const pct = e.budget > 0 ? (e.investido / e.budget) * 100 : 0
    return e.status === 'ativa' && (pct > 80 || e.roas < 1.5)
  })
  const totalBudget   = ativas.reduce((s, e) => s + (e.budget || 0), 0)
  const totalInvestido = ativas.reduce((s, e) => s + (e.investido || 0), 0)
  const budgetPct     = totalBudget > 0 ? Math.round((totalInvestido / totalBudget) * 100) : 0

  return (
    <Box>
      <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
        <StatCard label="Campanhas ativas" value={ativas.length} color={DS.green} />
        <StatCard label="Alertas" value={alertas.length} color={alertas.length > 0 ? DS.red : DS.green} icon={alertas.length > 0 ? <ErrorOutlineIcon sx={{ fontSize: 16 }} /> : undefined} />
        <StatCard label="Budget gasto" value={`${budgetPct}%`} color={budgetPct > 80 ? DS.red : budgetPct > 60 ? DS.amber : DS.green} />
        <StatCard label="Total investido" value={fmt(totalInvestido)} color={DS.green} />
      </Stack>

      {/* Budget bar */}
      <Paper sx={{ p: 1.5, mb: 2, border: '1px solid rgba(49,209,124,0.15)', bgcolor: 'rgba(49,209,124,0.04)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.8}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(244,247,255,0.7)' }}>
            Budget geral {fmt(totalInvestido)} / {fmt(totalBudget)}
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: budgetPct > 80 ? DS.red : DS.green }}>{budgetPct}%</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={Math.min(budgetPct, 100)}
          sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(49,209,124,0.1)',
            '& .MuiLinearProgress-bar': { bgcolor: budgetPct > 80 ? DS.red : budgetPct > 60 ? DS.amber : DS.green, borderRadius: 3 } }} />
      </Paper>

      {/* Alertas */}
      {alertas.length > 0 && (
        <>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: DS.red, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
            🔴 Alertas de campanha
          </Typography>
          <Stack gap={0.7} mb={2}>
            {alertas.map(e => {
              const pct = e.budget > 0 ? Math.round((e.investido / e.budget) * 100) : 0
              const roasAlert = e.roas < 1.5
              const budgetAlert = pct > 80
              return (
                <Paper key={e.id} sx={{
                  p: 1.2, border: '1px solid rgba(239,68,68,0.2)', bgcolor: 'rgba(239,68,68,0.05)',
                  borderLeft: `3px solid ${DS.red}`, borderRadius: 1.5,
                }}>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <ErrorOutlineIcon sx={{ fontSize: 14, color: DS.red, flexShrink: 0 }} />
                    <Typography sx={{ flex: 1, fontSize: '0.78rem', fontWeight: 700 }} noWrap>
                      {(e as { clientName?: string }).clientName ?? e.id}
                    </Typography>
                    {budgetAlert && <Chip label={`Budget ${pct}%`} size="small" sx={{ bgcolor: 'rgba(239,68,68,0.15)', color: DS.red, fontSize: '0.58rem', height: 16, fontWeight: 700 }} />}
                    {roasAlert && <Chip label={`ROAS ${e.roas.toFixed(1)}x`} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: DS.amber, fontSize: '0.58rem', height: 16, fontWeight: 700 }} />}
                  </Stack>
                </Paper>
              )
            })}
          </Stack>
        </>
      )}

      {entries.length === 0 && (
        <Paper sx={{ py: 4, textAlign: 'center', border: '1px dashed rgba(49,209,124,0.2)', bgcolor: 'transparent' }}>
          <TrendingUpIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1, display: 'block', mx: 'auto' }} />
          <Typography variant="body2" color="text.secondary">Nenhuma campanha cadastrada ainda</Typography>
          <Typography variant="caption" color="text.secondary">Acesse a aba Tráfego para adicionar</Typography>
        </Paper>
      )}

      {/* Controle de qualidade e entrega por cliente */}
      <Box sx={{ mt: 2 }}>
        <ClientQualitySection items={items} states={states} allClients={allClients} now={now} onTabChange={onTabChange} />
      </Box>
    </Box>
  )
}

// ── View genérica (usuário não reconhecido) ───────────────
function GenericView({ items, states, now }: { items: ContentItem[]; states: Record<number, ItemState>; now: Date }) {
  const today     = useMemo(() => { const d = new Date(now); d.setHours(0,0,0,0); return d }, [now])
  const todayEnd  = new Date(today.getTime() + 86_400_000)
  const todayItems = items.filter(i => i.dt >= today && i.dt < todayEnd)
  const late       = realLateItems(items, states, today)
  const published  = items.filter(i => (states[i.i]?.status ?? i.s) === 7).length
  const pct        = items.length > 0 ? Math.round((published / items.length) * 100) : 0

  return (
    <Box>
      <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
        <StatCard label="Hoje" value={todayItems.length} color={DS.accent} />
        <StatCard label="Atrasados" value={late.length} color={late.length > 0 ? DS.red : DS.green} />
        <StatCard label="Publicados" value={`${pct}%`} color={DS.green} />
        <StatCard label="Total" value={items.length} color={DS.orangeDim} />
      </Stack>
    </Box>
  )
}

// ── Export principal ───────────────────────────────────────
export default function MeuDiaTab({
  items, states, allClients, currentUser, now, roteiros,
  clientFolders, clientHashtags, onStatusChange, onUpdate, onTabChange,
}: Props) {
  const userInfo = currentUser ? NAME_MAP[currentUser] : null

  // ── Alertas ──────────────────────────────────────────────
  // Calcula todos os alertas uma vez e filtra pelo usuário atual
  const allAlerts = useMemo(
    () => computeAlerts(items, states, allClients, now),
    // Recalcula quando itens, estados ou data mudam (now muda a cada minuto no App)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, states, now]
  )
  const userAlerts = useMemo(
    () => alertsForUser(allAlerts, currentUser),
    [allAlerts, currentUser]
  )

  // Dismissal persistido em localStorage
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    const raw = loadDismissed()
    return pruneOldDismissals(raw, allAlerts.map(a => a.id))
  })
  const handleDismiss = useCallback((id: string) => {
    setDismissed(prev => dismissAlert(id, prev))
  }, [])

  const visibleAlerts = useMemo(
    () => userAlerts
      .filter(a => !dismissed.has(a.id))
      .filter(a => !ALERTAS_SO_DA_AREA[currentUser] || ALERTAS_SO_DA_AREA[currentUser].includes(a.type)),
    [userAlerts, dismissed, currentUser]
  )

  const renderView = () => {
    switch (currentUser) {
      case 'jhones':
        return <JhonesView items={items} states={states} clientFolders={clientFolders} now={now} onStatusChange={onStatusChange} />
      case 'kerges':
        return <KergesView items={items} states={states} allClients={allClients} clientHashtags={clientHashtags} now={now} onUpdate={onUpdate} />
      case 'pradox':
      case 'testa':
        return <SocioView items={items} states={states} allClients={allClients} now={now} onTabChange={onTabChange} />
      case 'kaique':
        return <KaiqueView items={items} states={states} now={now} onTabChange={onTabChange} />
      case 'arthur':
        return <ArthurView now={now} items={items} states={states} allClients={allClients} roteiros={roteiros} onStatusChange={onStatusChange} onTabChange={onTabChange} />
      case 'robson':
        return <TrafegoView currentUser={currentUser} now={now} items={items} states={states} allClients={allClients} onTabChange={onTabChange} />
      default:
        return <GenericView items={items} states={states} now={now} />
    }
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 2, xl: 3 }, maxWidth: { lg: 1080, xl: 1240 }, mx: 'auto', height: '100%', overflow: 'auto',
      '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(59,130,246,0.2)', borderRadius: 2 } }}>

      {/* ── Alertas proativos — sempre no topo ── */}
      <AlertBanner
        alerts={visibleAlerts}
        onDismiss={handleDismiss}
        onTabChange={onTabChange}
      />

      {/* Header com identidade do usuário */}
      {userInfo ? (
        <RoleHeader user={currentUser} now={now} />
      ) : (
        <Paper sx={{ px: 2, py: 2, mb: 2, border: '1px solid rgba(59,130,246,0.15)', bgcolor: 'rgba(59,130,246,0.06)', borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 700, color: 'primary.main', mb: 0.5 }}>Meu Dia</Typography>
          <Typography variant="caption" color="text.secondary">
            Faça login para ver seu painel personalizado.
          </Typography>
        </Paper>
      )}

      {/* O que já saiu — contrapeso ao resto da tela, que só mede o que está parado */}
      {currentUser && (
        <MinhaProducaoPanel items={items} states={states} currentUser={currentUser} now={now} allClients={allClients} />
      )}

      {/* A produção do Design na tela de quem a acompanha.
          O Arthur controla a área, e até aqui só conseguia ver o que está
          PARADO nela — fila, atrasado, workload. O que foi entregue só existia
          na tela do próprio designer, ou seja, para acompanhar ele teria que
          perguntar. Mesmo painel, mesma conta, outro dono. */}
      {currentUser === 'arthur' && (
        <MinhaProducaoPanel
          items={items} states={states} currentUser={currentUser} now={now}
          allClients={allClients} autor={DESIGNER}
        />
      )}

      {/* Tarefas de onboarding do dia — só aparece quando há pendências do usuário */}
      {currentUser && (
        <OnboardingTodaySection currentUser={currentUser} now={now} onTabChange={onTabChange} />
      )}

      {/* View específica por role */}
      {renderView()}

      <Box sx={{ height: 32 }} />
    </Box>
  )
}
