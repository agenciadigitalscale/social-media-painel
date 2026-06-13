import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import {
  ThemeProvider, CssBaseline, Box, BottomNavigation,
  BottomNavigationAction, Paper, Typography, Chip, Snackbar, Alert, Button,
  InputBase, Collapse, List, ListItem, ListItemText, useMediaQuery, CircularProgress, Tooltip, Skeleton,
} from '@mui/material'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import HomeIcon from '@mui/icons-material/Home'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CelebrationIcon from '@mui/icons-material/Celebration'
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda'
import PeopleIcon from '@mui/icons-material/People'
import ViewKanbanIcon from '@mui/icons-material/ViewKanban'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import BarChartIcon from '@mui/icons-material/BarChart'
import TimelineIcon from '@mui/icons-material/Timeline'
import VideocamIcon from '@mui/icons-material/Videocam'
import MovieFilterIcon from '@mui/icons-material/MovieFilter'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import LogoutIcon from '@mui/icons-material/Logout'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import TuneIcon from '@mui/icons-material/Tune'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import GroupIcon from '@mui/icons-material/Group'
import PsychologyIcon from '@mui/icons-material/Psychology'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import CampaignIcon from '@mui/icons-material/Campaign'
import BrushIcon from '@mui/icons-material/Brush'
import TravelExploreIcon from '@mui/icons-material/TravelExplore'
import PersonIcon from '@mui/icons-material/Person'
import QueryStatsIcon from '@mui/icons-material/QueryStats'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import RadarIcon from '@mui/icons-material/Radar'
import theme, { DS } from './theme'
import type { ContentItem, ContentType, HistoryEntry, ItemEditPatch, ItemState, Notification, Roteiro, Status } from './types'
import { STATUS_CONFIG } from './types'
import { DATA, DATA_JULHO, CLIENTS } from './data'
import {
  serializeItem, deserializeItem,
  loadStates, loadCustomItems, loadDeletedIds, loadEditedItems,
  loadRoteiros, loadClientFolders, loadExtraClients, loadHiddenClients,
  loadClientColors, loadClientHashtags, loadCaptionTemplates,
  syncToCloud, SYNC_KEYS, forceSync, flushQueueBeforeUnload,
} from './lib/storage'
import { getWorkdays, buildDistribution } from './lib/distribution'
import { clientHasIG, scheduleItemIG } from './lib/instagram'
import { generateApprovalUrl, generateApprovalMessage, openWhatsAppApproval, openWhatsAppGroup, isGroupLink, buildWhatsAppUrl } from './lib/whatsapp'
import { logActivity } from './lib/activity'
import { getUserInfo, getDisplayName } from './lib/users'
import { computeAlerts, alertsForUser, loadDismissed, pruneOldDismissals } from './lib/alerts'
import { emitVideoStatusChanged } from './lib/events'
import NotificationCenter from './components/NotificationCenter'
import Logo from './components/Logo'
import ClientFocusModal from './components/ClientFocusModal'
import SyncIndicator from './components/SyncIndicator'
import { getUserPerms } from './lib/roles'
import AIAgent from './components/AIAgent'
import MonthlyReportModal from './components/MonthlyReportModal'
import SplashScreen from './components/SplashScreen'
import PresentationMode from './components/PresentationMode'
import ScaleAI from './components/ScaleAI'
import AccessManager from './components/AccessManager'
import OnboardingWizard from './components/OnboardingWizard'
import HelpOverlay from './components/HelpOverlay'
import Confetti from './components/Confetti'
import EngagementDialog from './components/EngagementDialog'
import ErrorBoundary from './components/ErrorBoundary'
import AssignmentNotification from './components/AssignmentNotification'

const TodayTab         = lazy(() => import('./components/TodayTab'))
const AgendaTab        = lazy(() => import('./components/AgendaTab'))
const CalendarTab      = lazy(() => import('./components/CalendarTab'))
const ClientsTab       = lazy(() => import('./components/ClientsTab'))
const KanbanTab        = lazy(() => import('./components/KanbanTab'))
const KaiqueTab        = lazy(() => import('./components/KaiqueTab'))
const TVMode           = lazy(() => import('./components/TVMode'))
const TimelineTab      = lazy(() => import('./components/TimelineTab'))
const RecordingCenter  = lazy(() => import('./components/RecordingCenter'))
const EditorMode       = lazy(() => import('./components/EditorMode'))
const FinanceiroTab    = lazy(() => import('./components/FinanceiroTab'))
const EquipeTab        = lazy(() => import('./components/EquipeTab'))
const IATab            = lazy(() => import('./components/IATab'))
const RoteirosIdeaTab  = lazy(() => import('./components/RoteirosIdeaTab'))
const TrafegoTab       = lazy(() => import('./components/TrafegoTab'))
const DesignTab        = lazy(() => import('./components/DesignTab'))
const ProspeccaoTab    = lazy(() => import('./components/ProspeccaoTab'))
const ProducaoTab      = lazy(() => import('./components/ProducaoTab'))
const CreativeStudio   = lazy(() => import('./components/CreativeStudio'))
const MeuDiaTab        = lazy(() => import('./components/MeuDiaTab'))
const PerformanceTab   = lazy(() => import('./components/PerformanceTab'))
const DatasTab         = lazy(() => import('./components/DatasTab'))
const ClientRadar         = lazy(() => import('./components/ClientRadar'))
const CommandBar          = lazy(() => import('./components/CommandBar'))
const WhatsAppReportCard  = lazy(() => import('./components/WhatsAppReportCard'))

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia ☀️'
  if (h < 18) return 'Boa tarde 🌤'
  return 'Boa noite 🌙'
}

// ── Frases diárias — vitória, fé, esperança, persistência ─────────────────────
const DAILY_PHRASES: { text: string; ref: string }[] = [
  { text: 'Tudo posso naquele que me fortalece.',                                                    ref: 'Fp 4:13' },
  { text: 'O Senhor é a minha força e o meu escudo.',                                               ref: 'Sl 28:7' },
  { text: 'Seja forte e corajoso. Não se apavore, pois o Senhor está com você.',                     ref: 'Js 1:9' },
  { text: 'Porque Deus não nos deu espírito de covardia, mas de poder, de amor e de moderação.',     ref: '2Tm 1:7' },
  { text: 'Confie no Senhor de todo o coração e não se apoie em seu próprio entendimento.',          ref: 'Pv 3:5' },
  { text: 'Busquem primeiro o Reino de Deus, e todas essas coisas serão acrescentadas a vocês.',     ref: 'Mt 6:33' },
  { text: 'A fé é a certeza daquilo que esperamos e a prova das coisas que não vemos.',              ref: 'Hb 11:1' },
  { text: 'O sucesso é a soma de pequenos esforços repetidos dia após dia.',                         ref: 'R. Collier' },
  { text: 'Não desanimeis de fazer o bem; porque a seu tempo ceifaremos, se não desfalecermos.',     ref: 'Gl 6:9' },
  { text: 'Grandes realizações nascem de pequenos começos persistentes.',                            ref: 'Lao Tsé' },
  { text: 'Porque eu sei os planos que tenho para você — planos de prosperidade e não de calamidade.', ref: 'Jr 29:11' },
  { text: 'A alegria do Senhor é a nossa força.',                                                    ref: 'Ne 8:10' },
  { text: 'Aquele que começou boa obra em você a completará.',                                       ref: 'Fp 1:6' },
  { text: 'Não se turbe o vosso coração; credes em Deus, crede também em mim.',                      ref: 'Jo 14:1' },
  { text: 'O trabalho duro vence o talento quando o talento não trabalha duro.',                     ref: 'Tim Notke' },
  { text: 'Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.',                          ref: 'Sl 37:5' },
  { text: 'Quem semeia em lágrimas, em cânticos ceifará.',                                           ref: 'Sl 126:5' },
  { text: 'A disciplina é a ponte entre objetivos e realizações.',                                   ref: 'Jim Rohn' },
  { text: 'Mais do que ouro e prata desejo hoje ver vitória em tudo que tocar.',                     ref: 'Inspiração' },
  { text: 'Levanta-te, pois esta é a tua missão.',                                                   ref: 'At 26:16' },
  { text: 'O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti.',       ref: 'Nm 6:24' },
  { text: 'Tudo o que fizerem, façam de todo o coração, como para o Senhor.',                        ref: 'Cl 3:23' },
  { text: 'Você não falha quando cai; você falha quando decide não se levantar.',                    ref: 'Provérbio' },
  { text: 'A mente que se abre a uma nova ideia nunca volta ao seu tamanho original.',               ref: 'Einstein' },
  { text: 'O Senhor é meu pastor e nada me faltará.',                                                ref: 'Sl 23:1' },
  { text: 'Sejam fortes e corajosos. Não tenham medo nem se apavorem.',                              ref: 'Dt 31:6' },
  { text: 'Não há nada impossível para Deus.',                                                       ref: 'Lc 1:37' },
  { text: 'Persistência e determinação são onipotentes.',                                            ref: 'Calvin Coolidge' },
  { text: 'Tudo é possível para quem crê.',                                                          ref: 'Mc 9:23' },
  { text: 'O sucesso é ir de fracasso em fracasso sem perder o entusiasmo.',                         ref: 'Churchill' },
  { text: 'Hoje é um novo dia — uma nova chance de ser extraordinário.',                             ref: 'Inspiração' },
  { text: 'Peçam e lhes será dado; busquem e encontrarão; batam e a porta será aberta.',             ref: 'Mt 7:7' },
  { text: 'Só tem êxito quem trabalha, persiste e crê.',                                             ref: 'Provérbio' },
  { text: 'Ser humilde não é se diminuir — é reconhecer que há grandeza ainda por vir.',             ref: 'Inspiração' },
  { text: 'O Senhor é a minha luz e a minha salvação; a quem temerei?',                              ref: 'Sl 27:1' },
  { text: 'Com alegria vocês tirarão água das fontes da salvação.',                                  ref: 'Is 12:3' },
  { text: 'Cada amanhecer traz a chance de reescrever a história.',                                  ref: 'Inspiração' },
  { text: 'Coragem não é a ausência do medo — é decidir que outra coisa é mais importante.',         ref: 'Ambrose Redmoon' },
  { text: 'O Senhor te dará vitória sobre seus inimigos.',                                           ref: 'Dt 28:7' },
  { text: 'Alegrai-vos sempre no Senhor; outra vez digo: alegrai-vos.',                              ref: 'Fp 4:4' },
  { text: 'Faça do seu trabalho uma oração — cada entrega é um ato de excelência.',                 ref: 'Inspiração' },
  { text: 'Aquele que espera no Senhor renovará as suas forças.',                                    ref: 'Is 40:31' },
  { text: 'Pequenas conquistas diárias formam as grandes vitórias.',                                 ref: 'Inspiração' },
  { text: 'Porque sou eu que conheço os planos que tenho para você — planos de bem.',                ref: 'Jr 29:11' },
  { text: 'A cada dia carrega sua própria glória. Viva-o com propósito.',                            ref: 'Inspiração' },
  { text: 'O que você faz hoje pode melhorar todos os seus amanhãs.',                                ref: 'Ralph Marston' },
  { text: 'O Senhor peleará por vós; ficai quietos.',                                                ref: 'Êx 14:14' },
  { text: 'Vitória não é um destino — é um hábito construído dia a dia.',                            ref: 'Inspiração' },
  { text: 'Não se deixe vencer pelo mal, mas vença o mal com o bem.',                                ref: 'Rm 12:21' },
  { text: 'A esperança que não decepciona está derramada em nossos corações.',                        ref: 'Rm 5:5' },
  { text: 'O que parece impossível hoje amanhã será a sua testemunha.',                              ref: 'Inspiração' },
  { text: 'Toda honra ao trabalho bem-feito e ao esforço que ninguém viu.',                          ref: 'Inspiração' },
  { text: 'Deus é nosso refúgio e força, socorro bem-presente nas tribulações.',                     ref: 'Sl 46:1' },
  { text: 'Seja a excelência que você quer ver no mundo.',                                           ref: 'Inspiração' },
  { text: 'Porque nele vivemos, nos movemos e existimos.',                                           ref: 'At 17:28' },
  { text: 'Cada sonho que você realiza começa com a decisão de tentar.',                             ref: 'Inspiração' },
  { text: 'O corajoso não é quem não tem medo — é quem age apesar do medo.',                        ref: 'Inspiração' },
  { text: 'Toda boa dádiva e todo dom perfeito vêm do alto.',                                        ref: 'Tg 1:17' },
  { text: 'O talento é um dom; a dedicação é uma escolha. Escolha todos os dias.',                  ref: 'Inspiração' },
  { text: 'Que a graça e a paz sejam com você em abundância.',                                       ref: '1Pe 1:2' },
  { text: 'Se Deus é por nós, quem será contra nós?',                                               ref: 'Rm 8:31' },
  { text: 'Vença o dia antes que o dia te vença.',                                                   ref: 'Inspiração' },
  { text: 'Riqueza que vale não é só a do bolso — é a de quem ama o que faz.',                      ref: 'Inspiração' },
  { text: 'Hoje plantamos com fé. A colheita virá no tempo certo.',                                  ref: 'Inspiração' },
  { text: 'Renovai-vos no espírito da vossa mente e revesti-vos do novo homem.',                    ref: 'Ef 4:23' },
  { text: 'Não importa quão devagar você vá, desde que não pare.',                                   ref: 'Confúcio' },
  { text: 'O único jeito de fazer um trabalho excelente é amar o que se faz.',                      ref: 'Steve Jobs' },
  { text: 'A vitória já está declarada — só precisamos andar para ela.',                             ref: 'Inspiração' },
]

function getDailyPhrase(): { text: string; ref: string } {
  const dayIndex = Math.floor(Date.now() / 86_400_000)
  return DAILY_PHRASES[dayIndex % DAILY_PHRASES.length]
}

// ── App ────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState(0)
  const [tvMode, setTvMode] = useState(false)
  const [states, setStates] = useState<Record<number, ItemState>>(loadStates)
  const [customItems, setCustomItems] = useState<ContentItem[]>(loadCustomItems)
  const [deletedIds, setDeletedIds] = useState<number[]>(loadDeletedIds)
  const [editedItems, setEditedItems] = useState<Record<number, { dt?: string; tp?: ContentType; n?: string }>>(loadEditedItems)
  const [roteiros, setRoteiros] = useState<Record<string, Roteiro[]>>(loadRoteiros)
  const [clientFolders, setClientFolders] = useState<Record<string, string>>(loadClientFolders)
  const [extraClients, setExtraClients] = useState(loadExtraClients)
  const [hiddenClients, setHiddenClients] = useState<string[]>(loadHiddenClients)
  const [clientColors, setClientColorsState] = useState<Record<string, string>>(loadClientColors)
  const [clientHashtags, setClientHashtagsState] = useState<Record<string, string[]>>(loadClientHashtags)
  const [captionTemplates, setCaptionTemplatesState] = useState<Record<string, string[]>>(loadCaptionTemplates)
  const [focusClient, setFocusClient] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() =>
    'Notification' in window ? Notification.permission : 'denied'
  )
  const [showNotifPrompt, setShowNotifPrompt] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportInitialClient, setReportInitialClient] = useState<string | undefined>(undefined)
  const [waReportOpen, setWaReportOpen] = useState(false)
  const [presentationOpen, setPresentationOpen] = useState(false)
  const [scaleAIOpen, setScaleAIOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [confettiActive, setConfettiActive] = useState(false)
  const [engagementItemId, setEngagementItemId] = useState<number | null>(null)
  const prev100Clients = useRef<Set<string>>(new Set())
  const [showSplash, setShowSplash] = useState(true)
  const [clientNotifs, setClientNotifs] = useState<{ id: number; title: string }[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  // Sessão só dura na aba atual (sessionStorage) — ao reabrir o browser, pede quem está usando
  const [currentUser, setCurrentUser] = useState<string>(() =>
    sessionStorage.getItem('sm_tab_user') ?? ''
  )
  const [accessManagerOpen, setAccessManagerOpen] = useState(false)
  const [onboardingOpen,    setOnboardingOpen]    = useState(false)
  const [assignmentTrigger, setAssignmentTrigger] = useState(0)
  const [clientPhones, setClientPhones] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('sm_client_phones') ?? '{}') } catch { return {} }
  })
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'info' | 'warning' | 'error' } | null>(null)
  const [waAlert, setWaAlert] = useState<{ msg: string; waUrl: string; label: string; color: string } | null>(null)
  // Incrementa quando D1 restaura dados do financeiro — força FinanceiroTab a re-ler
  const [financeiroSyncVersion, setFinanceiroSyncVersion] = useState(0)

  // true enquanto restaura dados do D1 (cache vazio detectado)
  const [restoringData, setRestoringData] = useState(() =>
    !localStorage.getItem('sm_states') && !localStorage.getItem('sm_custom')
  )

  // Permissões calculadas uma vez por sessão
  const perms = getUserPerms(currentUser)

  // Refs para detectar mudanças de status vindas do cliente (polling)
  const statesRef      = useRef<Record<number, ItemState>>(loadStates())
  const prevStatesRef  = useRef<Record<number, ItemState>>({})
  const initialSyncRef = useRef(false)

  const allClients = useMemo(() => [...CLIENTS, ...extraClients].filter(c => !hiddenClients.includes(c.name)), [extraClients, hiddenClients])

  // ── Aplicar dados remotos do D1 ───────────────────────
  const applyRemoteSync = useCallback((data: { key: string; value: string }[]) => {
    data.forEach(({ key, value }) => {
      try {
        const parsed = JSON.parse(value)
        switch (key) {
          case 'sm_states':
            setStates(() => { localStorage.setItem('sm_states', value); return parsed as Record<number, ItemState> })
            break
          case 'sm_custom':
            setCustomItems(() => { localStorage.setItem('sm_custom', value); return (parsed as Record<string, unknown>[]).map(deserializeItem) })
            break
          case 'sm_deleted':
            setDeletedIds(() => { localStorage.setItem('sm_deleted', value); return parsed as number[] })
            break
          case 'sm_edits':
            setEditedItems(() => { localStorage.setItem('sm_edits', value); return parsed })
            break
          case 'sm_roteiros': {
            // Merge: preserva links e notas locais que o D1 pode não ter ainda
            const remote = parsed as Record<string, import('./types').Roteiro[]>
            setRoteiros(local => {
              const merged: Record<string, import('./types').Roteiro[]> = { ...remote }
              Object.keys(local).forEach(client => {
                if (!merged[client]) { merged[client] = local[client]; return }
                // Para cada roteiro local, preserva driveLink/notes se o remoto não tiver
                merged[client] = merged[client].map(r => {
                  const localR = local[client]?.find(lr => lr.id === r.id)
                  if (!localR) return r
                  return {
                    ...r,
                    driveLink: r.driveLink || localR.driveLink,
                    docsLink: r.docsLink || localR.docsLink,
                    notes: r.notes || localR.notes,
                  }
                })
                // Adiciona roteiros que existem local mas não no remoto (ainda não sincronizados)
                local[client].forEach(lr => {
                  if (!merged[client].find(r => r.id === lr.id)) merged[client].push(lr)
                })
              })
              localStorage.setItem('sm_roteiros', JSON.stringify(merged))
              return merged
            })
            break
          }
          case 'sm_client_folders':
            setClientFolders(() => { localStorage.setItem('sm_client_folders', value); return parsed })
            break
          case 'sm_extra_clients':
            setExtraClients(() => { localStorage.setItem('sm_extra_clients', value); return parsed })
            break
          case 'sm_hidden_clients':
            setHiddenClients(() => { localStorage.setItem('sm_hidden_clients', value); return parsed as string[] })
            break
          case 'sm_client_colors':
            setClientColorsState(() => { localStorage.setItem('sm_client_colors', value); return parsed })
            break
          case 'sm_client_hashtags':
            setClientHashtagsState(() => { localStorage.setItem('sm_client_hashtags', value); return parsed })
            break
          case 'sm_caption_templates':
            setCaptionTemplatesState(() => { localStorage.setItem('sm_caption_templates', value); return parsed })
            break
          case 'sm_upload_notifications':
            localStorage.setItem('sm_upload_notifications', value)
            break
          case 'sm_upload_tasks':
            localStorage.setItem('sm_upload_tasks', value)
            break
          default:
            // Financeiro por mês, leads, tráfego, prospecting, workspace — keys dinâmicas
            // Nunca sobrescreve se o dado local for mais recente (comparando tamanho como proxy)
            if (
              key.startsWith('sm_financeiro2_') ||
              key.startsWith('sm_trafego_') ||
              key.startsWith('sm_leads') ||
              key.startsWith('sm_prospect') ||
              key === 'sm_workspace' ||
              key === 'sm_client_phones'
            ) {
              const existing = localStorage.getItem(key)
              // Só restaura se local não tiver dado (ou D1 tiver mais registros)
              if (!existing || JSON.stringify(parsed).length > existing.length) {
                localStorage.setItem(key, value)
                // Sinaliza ao FinanceiroTab para re-ler dados
                if (key.startsWith('sm_financeiro2_')) {
                  setFinanceiroSyncVersion(v => v + 1)
                }
              }
            }
            break
        }
      } catch {}
    })
  }, [])

  // ── Sync de refs ──────────────────────────────────────
  useEffect(() => { statesRef.current = states }, [states])

  // ── Relógio ───────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // ── Atalhos de teclado ────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(v => !v)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setSearchQuery('')
        setCmdOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── beforeunload — garante que dados chegam ao D1 antes do F5/Ctrl+Shift+R ──
  useEffect(() => {
    window.addEventListener('beforeunload', flushQueueBeforeUnload)
    return () => window.removeEventListener('beforeunload', flushQueueBeforeUnload)
  }, [])

  // ── Sync D1 no mount — restaura dados se cache estiver vazio ──────────────
  useEffect(() => {
    // Flush qualquer fila pendente do reload anterior (F5 no meio de um sync)
    forceSync().catch(() => {})
    fetch('/api/sync')
      .then(r => r.json())
      .then((res: { ok: boolean; data: { key: string; value: string }[] }) => {
        if (!res.ok) return
        if (res.data?.length) {
          // D1 tem dados — restaura tudo (importante quando cache foi limpo)
          applyRemoteSync(res.data)
          if (restoringData) {
            setSnack({ msg: '✅ Dados restaurados do servidor com sucesso!', severity: 'success' })
          }
        } else {
          // D1 vazio — sobe localStorage para o servidor (primeiro uso ou D1 reset)
          SYNC_KEYS.forEach(k => {
            const v = localStorage.getItem(k)
            if (v) syncToCloud(k, JSON.parse(v))
          })
          // Sobe chaves dinâmicas (financeiro por mês, leads, etc.)
          const DYNAMIC_PREFIXES = ['sm_financeiro2_', 'sm_trafego_', 'sm_leads', 'sm_prospect', 'sm_workspace', 'sm_client_phones']
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (k && DYNAMIC_PREFIXES.some(p => k.startsWith(p))) {
              const v = localStorage.getItem(k)
              if (v) syncToCloud(k, JSON.parse(v))
            }
          }
        }
      })
      .catch(() => {
        if (restoringData) {
          setSnack({ msg: '⚠️ Sem conexão — trabalhando offline', severity: 'warning' })
        }
      })
      .finally(() => {
        initialSyncRef.current = true
        setRestoringData(false)
      })
  }, [applyRemoteSync])

  // ── Poll D1 a cada 8s — detecta reprovações do cliente em tempo real ──
  useEffect(() => {
    const poll = () => {
      fetch('/api/sync')
        .then(r => r.json())
        .then((res: { ok: boolean; data: { key: string; value: string }[] }) => {
          if (!res.ok || !res.data?.length) return

          // Detecta aprovações/reprovações do cliente após sync inicial
          if (initialSyncRef.current) {
            const syncMap: Record<string, unknown> = {}
            res.data.forEach(({ key, value }) => {
              try { syncMap[key] = JSON.parse(value) } catch {}
            })
            const newStates = (syncMap['sm_states'] ?? {}) as Record<string, ItemState>
            const rejected: { id: number; title: string }[] = []
            const newNotifs: Notification[] = []

            Object.entries(newStates).forEach(([idStr, s]) => {
              const prev = statesRef.current[Number(idStr)]
              if (!prev || prev.status === s.status) return
              // Reprovado pelo cliente (status 6)
              if (s.status === 6 && prev.status !== 6) {
                rejected.push({ id: Number(idStr), title: s.title || `Item ${idStr}` })
                newNotifs.push({
                  id: `rejection-${idStr}-${Date.now()}`,
                  title: 'Conteúdo reprovado',
                  message: `${s.title || `Item ${idStr}`} — ${s.rejectionText || 'sem comentário'}`,
                  type: 'rejection', itemId: Number(idStr), read: false, createdAt: Date.now(),
                })
                // Auto WhatsApp alert
                const rejTitle = s.title || `Item ${idStr}`
                const rejText = s.rejectionText ? ` — "${s.rejectionText}"` : ''
                const rejMsg = `🔄 *Cliente reprovou um conteúdo*\n\n"${rejTitle}"${rejText}\n\n👉 Revise e reenvie para aprovação.`
                setWaAlert({ msg: rejMsg, waUrl: `https://wa.me/?text=${encodeURIComponent(rejMsg)}`, label: '📱 Notificar equipe via WhatsApp', color: '#FF4545' })
              }
              // Aprovado pelo cliente (status 5)
              if (s.status === 5 && prev.status !== 5) {
                newNotifs.push({
                  id: `approval-${idStr}-${Date.now()}`,
                  title: '✅ Conteúdo aprovado pelo cliente',
                  message: s.title || `Item ${idStr}`,
                  type: 'approval', itemId: Number(idStr), read: false, createdAt: Date.now(),
                })
                // Auto WhatsApp alert
                const appTitle = s.title || `Item ${idStr}`
                const appMsg = `✅ *Cliente aprovou!*\n\n"${appTitle}"\n\n🚀 Pode avançar para publicação!`
                setWaAlert({ msg: appMsg, waUrl: `https://wa.me/?text=${encodeURIComponent(appMsg)}`, label: '📱 Compartilhar aprovação', color: '#00C47A' })
              }
            })

            if (rejected.length) {
              setClientNotifs(prev => [...prev, ...rejected.filter(n => !prev.some(p => p.id === n.id))])
            }
            if (newNotifs.length) {
              setNotifications(prev => [...newNotifs, ...prev].slice(0, 100))
            }
          }

          applyRemoteSync(res.data)
        })
        .catch(() => {})
    }
    const id = setInterval(poll, 8_000)
    return () => clearInterval(id)
  }, [applyRemoteSync])

  // ── Pedir permissão de notificação (mostra prompt discreto) ──
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      const timer = setTimeout(() => setShowNotifPrompt(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  // ── Computed ─────────────────────────────────────────

  const deletedSet = useMemo(() => new Set(deletedIds), [deletedIds])

  const allItems = useMemo((): ContentItem[] => {
    return [...DATA, ...DATA_JULHO, ...customItems]
      .filter(i => !deletedSet.has(i.i))
      .map(i => {
        const edit = editedItems[i.i]
        if (!edit) return i
        return {
          ...i,
          ...(edit.tp ? { tp: edit.tp } : {}),
          ...(edit.n ? { n: edit.n } : {}),
          dt: edit.dt ? new Date(edit.dt) : i.dt,
        }
      })
  }, [customItems, deletedSet, editedItems])

  // ── Notificação diária personalizada (dispara às 7h ou ao abrir o app após 7h) ──
  useEffect(() => {
    if (notifPermission !== 'granted') return
    const h = now.getHours()
    if (h < 7) return
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    const lastKey = `sm_notif_last_${currentUser || 'all'}`
    if (localStorage.getItem(lastKey) === today.toDateString()) return
    localStorage.setItem(lastKey, today.toDateString())
    const todayEnd = new Date(today.getTime() + 86_400_000)
    const lateItems = allItems.filter(i => (states[i.i]?.status ?? i.s) < 7 && i.dt < today)
    const todayPend = allItems.filter(i => i.dt >= today && i.dt < todayEnd && (states[i.i]?.status ?? i.s) < 7)
    const hrGt = h < 12 ? 'Bom dia' : 'Boa tarde'
    let title = 'DS HUB ☀️'
    let body  = ''
    const late = lateItems.length
    if (currentUser === 'kaique') {
      const reels = allItems.filter(i => i.tp === 'Reel' && [0,1].includes(states[i.i]?.status ?? i.s)).length
      title = `${hrGt}, Kaique! 🎬`
      body = [reels > 0 ? `${reels} reel${reels !== 1 ? 's' : ''} na fila` : '', late > 0 ? `⚠️ ${late} atrasado${late !== 1 ? 's' : ''}` : '', todayPend.length > 0 ? `${todayPend.length} publicação${todayPend.length !== 1 ? 'ões' : ''} hoje` : ''].filter(Boolean).join(' · ') || 'Tudo em dia! ✅'
    } else if (currentUser === 'jhones') {
      const queue = allItems.filter(i => i.tp !== 'Feed' && [0,1].includes(states[i.i]?.status ?? i.s)).length
      title = `${hrGt}, Jhones! 🎨`
      body = [queue > 0 ? `${queue} arte${queue !== 1 ? 's' : ''} na fila` : '', late > 0 ? `⚠️ ${late} atrasada${late !== 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') || 'Fila vazia! ✅'
    } else if (currentUser === 'arthur') {
      const ready = allItems.filter(i => (states[i.i]?.status ?? i.s) === 5).length
      title = `${hrGt}, Arthur! 📱`
      body = [ready > 0 ? `${ready} pronta${ready !== 1 ? 's' : ''} pra publicar` : '', late > 0 ? `⚠️ ${late} atrasada${late !== 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') || 'Tudo em dia! ✅'
    } else if (currentUser === 'kerges') {
      const noCaption = allItems.filter(i => [0,1].includes(states[i.i]?.status ?? i.s) && !states[i.i]?.caption).length
      title = `${hrGt}, Kerges! ✍️`
      body = noCaption > 0 ? `${noCaption} conteúdo${noCaption !== 1 ? 's' : ''} sem legenda` : 'Legendas em dia! ✅'
    } else if (currentUser === 'arthur' || currentUser === 'robson') {
      const nome = currentUser === 'arthur' ? 'Arthur' : 'Robson'
      title = `${hrGt}, ${nome}! 📈`
      body = todayPend.length > 0 ? `${todayPend.length} conteúdo${todayPend.length !== 1 ? 's' : ''} para hoje` : 'Nada pendente hoje ✅'
    } else if (currentUser === 'pradox' || currentUser === 'testa') {
      const nome = currentUser === 'pradox' ? 'Pradox' : 'Testa'
      const pubPct = allItems.length > 0 ? Math.round(allItems.filter(i => (states[i.i]?.status ?? i.s) === 7).length / allItems.length * 100) : 0
      title = `${hrGt}, ${nome}! 👑`
      body = [`${pubPct}% do mês publicado`, late > 0 ? `⚠️ ${late} atrasado${late !== 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')
    } else {
      title = `DS HUB ☀️ — ${today.toLocaleDateString('pt-BR', { weekday: 'long' })}`
      body = [todayPend.length > 0 ? `${todayPend.length} item${todayPend.length !== 1 ? 's' : ''} hoje` : '', late > 0 ? `⚠️ ${late} atrasado${late !== 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') || 'Bom dia!'
    }
    const notif = new Notification(title, { body, icon: '/logo.png', tag: 'ds-hub-daily', data: { tab: 0 } })
    notif.onclick = () => { window.focus() }
    navigator.serviceWorker?.ready.then(reg =>
      reg.active?.postMessage({ type: 'DAILY_SUMMARY', total: todayPend.length, overdue: late, hoje: todayPend.length, user: currentUser })
    )
  }, [now, notifPermission, allItems, states, currentUser])

  // ── Lembrete de relatório mensal (último dia do mês, 9h) ──
  useEffect(() => {
    const h = now.getHours()
    const m = now.getMinutes()
    if (h !== 9 || m > 4) return
    const today = new Date(now)
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    if (today.getDate() !== lastDayOfMonth) return
    const reportKey = `sm_report_notif_${today.getFullYear()}_${today.getMonth()}`
    if (localStorage.getItem(reportKey)) return
    localStorage.setItem(reportKey, '1')
    if (notifPermission === 'granted') {
      new Notification('📊 Relatório Mensal', {
        body: 'Hoje é o último dia do mês! Hora de gerar e enviar o relatório para os clientes.',
        icon: '/logo.png',
      })
    }
    setReportOpen(true)
  }, [now, notifPermission])

  // ── Deep-link: SW envia NAVIGATE_TAB ao clicar em notificação ──
  useEffect(() => {
    if (!navigator.serviceWorker) return
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'NAVIGATE_TAB' && typeof e.data.tab === 'number') setTab(e.data.tab)
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [])

  // ── Deep-link via URL param (?tab=N) ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (tabParam !== null) {
      const n = parseInt(tabParam, 10)
      if (!isNaN(n)) setTab(n)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // ── Ouve evento de atribuição para disparar notificação ──
  useEffect(() => {
    const handler = () => setAssignmentTrigger(v => v + 1)
    window.addEventListener('ds:assignment', handler)
    return () => window.removeEventListener('ds:assignment', handler)
  }, [])

  // ── Atalhos de teclado globais ────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key >= '1' && e.key <= '9') { setTab(parseInt(e.key) - 1); return }
      if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) {
        setSearchOpen(v => !v)
        return
      }
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); return }
      if (e.key === 'p' || e.key === 'P') { setPresentationOpen(v => !v); return }
      if (e.key === 'r' || e.key === 'R') { setReportOpen(v => !v); return }
      if (e.key === 'a' || e.key === 'A') { setScaleAIOpen(v => !v); return }
      if (e.key === '?') { setHelpOpen(v => !v); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Confetti: detecta quando cliente novo atinge 100% ──
  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const current100 = new Set<string>()
    allClients.forEach(client => {
      const ci = allItems.filter(i => i.c === client.name)
      if (ci.length === 0) return
      const published = ci.filter(i => (states[i.i]?.status ?? i.s) === 7).length
      if (published === ci.length) current100.add(client.name)
    })
    // Fire confetti if a new client just hit 100% (wasn't there before)
    for (const name of current100) {
      if (!prev100Clients.current.has(name) && prev100Clients.current.size > 0) {
        setConfettiActive(true)
        break
      }
    }
    prev100Clients.current = current100
  }, [states, allItems, allClients]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Push notifications: pede permissão + responde ao SW ───────────────
  useEffect(() => {
    if (!('Notification' in window) || !navigator.serviceWorker) return
    // Pede permissão após 3s (não bloquear o carregamento)
    const t = setTimeout(() => {
      if (Notification.permission === 'default') Notification.requestPermission()
    }, 3000)
    // Responde ao SW quando ele pede o resumo do dia ou follow-ups de leads
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'REQUEST_DAILY_SUMMARY') {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const todayItems = allItems.filter(item => {
          const d = new Date(item.dt); d.setHours(0, 0, 0, 0)
          return d.getTime() === today.getTime()
        })
        const overdueItems = allItems.filter(item => {
          const d = new Date(item.dt); d.setHours(0, 0, 0, 0)
          const st = states[item.i]?.status ?? item.s
          return d < today && st !== 3 && st !== 7
        })
        navigator.serviceWorker.controller?.postMessage({
          type: 'DAILY_SUMMARY',
          hoje: todayItems.length,
          overdue: overdueItems.length,
          total: todayItems.length + overdueItems.length,
        })
        return
      }
      if (e.data?.type === 'REQUEST_LEAD_SUMMARY') {
        try {
          const leads: { name: string; followUpAt?: number; stage?: string }[] =
            JSON.parse(localStorage.getItem('sm_leads') || '[]')
          const now = Date.now()
          const overdueLeads = leads
            .filter(l => l.followUpAt && l.followUpAt < now && l.stage !== 'fechado' && l.stage !== 'perdido')
            .map(l => ({ name: l.name, followUpAt: l.followUpAt }))
          navigator.serviceWorker.controller?.postMessage({ type: 'LEAD_SUMMARY', overdueLeads })
        } catch {}
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMsg)
    return () => {
      clearTimeout(t)
      navigator.serviceWorker.removeEventListener('message', handleMsg)
    }
  }, [allItems, states]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutações de estado de item ────────────────────────

  const STATUS_HISTORY_LABEL = (Object.values(STATUS_CONFIG) as typeof STATUS_CONFIG[0][]).map(c => c.label)

  const updateItem = useCallback((id: number, patch: Partial<ItemState>) => {
    setStates(prev => {
      const existing = prev[id] ?? { status: 0, title: '', link: '', caption: '', notes: '' }
      let finalPatch = patch

      // Auto-registra mudança de status no histórico
      if (patch.status !== undefined && patch.status !== existing.status) {
        const entry: HistoryEntry = { action: `→ ${STATUS_HISTORY_LABEL[patch.status]}`, ts: Date.now() }
        finalPatch = { ...patch, history: [...(existing.history ?? []), entry] }
      }
      // Link de publicação adicionado
      else if (patch.link !== undefined && patch.link && !existing.link) {
        const histEntries: HistoryEntry[] = [{ action: 'Criativo vinculado', ts: Date.now() }]
        let autoPatch: Partial<ItemState> = {}
        // Auto-avança: aprovado pelo cliente + link colado → Publicado
        if (existing.status === 5) {
          histEntries.push({ action: '→ Publicado (auto)', ts: Date.now() })
          autoPatch = { status: 7, publishedAt: Date.now() }
        }
        finalPatch = { ...patch, ...autoPatch, history: [...(existing.history ?? []), ...histEntries] }
        const itForLog = allItems.find(i => i.i === id)
        if (itForLog && currentUser) {
          logActivity({
            user: currentUser, action: 'vinculou_criativo',
            itemId: id, itemTitle: existing.title || itForLog.n, clientName: itForLog.c,
            ts: Date.now(),
          })
        }
      }
      // Material bruto adicionado → Pendente vira Em edição automaticamente
      else if (patch.footageLink !== undefined && patch.footageLink.length > 10 && !existing.footageLink && existing.status === 0) {
        const entry: HistoryEntry = { action: '→ Em edição (material adicionado)', ts: Date.now() }
        finalPatch = { ...patch, status: 1, history: [...(existing.history ?? []), entry] }
      }

      const next = { ...prev, [id]: { ...existing, ...finalPatch } }
      localStorage.setItem('sm_states', JSON.stringify(next))
      fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...next[id] }),
      }).catch(() => {})
      syncToCloud('sm_states', next)
      return next
    })
  }, [])

  const setStatus = useCallback((id: number, status: Status) => {
    const prevStatus = states[id]?.status ?? 0
    updateItem(id, { status })
    const item = allItems.find(i => i.i === id)
    if (item) {
      emitVideoStatusChanged({
        itemId:     id,
        clientName: item.c,
        fromStatus: prevStatus,
        toStatus:   status,
        userId:     currentUser || undefined,
        title:      states[id]?.title || item.n,
      })
      if (currentUser) {
        logActivity({
          user: currentUser,
          action: status === 4 ? 'enviou_cliente' : status === 2 || status === 3 ? 'aprovou_interno' : 'moveu_status',
          itemId: id,
          itemTitle: states[id]?.title || item.n,
          clientName: item.c,
          detail: `${STATUS_CONFIG[prevStatus as Status]?.label ?? prevStatus} → ${STATUS_CONFIG[status]?.label ?? status}`,
          ts: Date.now(),
        })
      }
    }
    if (status === 7) setEngagementItemId(id)
  }, [updateItem, states, allItems, currentUser])

  // ── Instagram: auto-agenda quando cliente aprova (status 5) ────────────
  useEffect(() => {
    const cur = states
    const prev = prevStatesRef.current

    Object.entries(cur).forEach(([idStr, s]) => {
      const id = Number(idStr)
      const p = prev[id]
      if (!p || p.status === s.status) return

      // ── Push notification quando cliente aprova ou reprova ─────────────
      const item = allItems.find(i => i.i === id)
      if (item && 'Notification' in window && Notification.permission === 'granted') {
        if (s.status === 5) {
          new Notification(`✅ Cliente aprovou — ${item.c}`, {
            body: s.title || item.n,
            icon: '/logotipo.png',
            tag: `approved-${id}`,
          })
        } else if (s.status === 6) {
          new Notification(`🔄 Cliente reprovou — ${item.c}`, {
            body: `${s.title || item.n}${s.rejectionText ? `\n"${s.rejectionText}"` : ''}`,
            icon: '/logotipo.png',
            tag: `rejected-${id}`,
          })
        }
      }

      if (s.status === 5 && s.link?.trim()) {
        const item = allItems.find(i => i.i === id)
        if (!item) return
        clientHasIG(item.c).then(hasIG => {
          if (!hasIG) return
          scheduleItemIG(
            item.c, id, item.dt,
            s.link,
            s.caption || '',
            item.tp === 'Reel' ? 'REELS' : 'IMAGE'
          ).then(r => {
            if (r.ok) {
              setSnack({
                msg: `📅 Instagram agendado: "${item.n}" para ${item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`,
                severity: 'success',
              })
            }
          })
        })
      }
    })

    prevStatesRef.current = cur
  }, [states, allItems]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Instagram: polling a cada 60s — publica posts cujo horário chegou ──
  useEffect(() => {
    const checkAndPublish = async () => {
      try {
        const r = await fetch('/api/instagram?action=pending')
        const d = await r.json() as { ok: boolean; pending?: { id: string; item_id: number }[] }
        if (!d.ok || !d.pending?.length) return

        for (const post of d.pending) {
          const r2 = await fetch('/api/instagram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'publish', scheduleId: post.id }),
          })
          const d2 = await r2.json() as { ok: boolean; itemId?: number; error?: string }
          if (d2.ok && d2.itemId) {
            updateItem(d2.itemId, { status: 7 })
            setSnack({ msg: `✅ Publicado no Instagram! Item #${d2.itemId}`, severity: 'success' })
          } else if (!d2.ok && d2.error) {
            setSnack({ msg: `⚠️ Erro IG: ${d2.error}`, severity: 'error' })
          }
        }
      } catch {}
    }

    checkAndPublish()
    const id = setInterval(checkAndPublish, 60_000)
    return () => clearInterval(id)
  }, [updateItem])

  const handleSendToClient = useCallback(async (itemId: number, clientName: string, isTraffic?: boolean) => {
    let token: string | undefined
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', clientName }),
      })
      const data = await res.json() as { ok: boolean; token?: string }
      if (data.ok && data.token) token = data.token
    } catch {}

    const itemState = states[itemId]
    const contentTitle = itemState?.title || `Item ${itemId}`
    const contact = clientPhones[clientName] || allClients.find(c => c.name === clientName)?.whatsapp

    updateItem(itemId, { status: 4, sentToClientAt: Date.now(), approvalToken: token })

    if (token) {
      const approvalUrl = generateApprovalUrl(token, itemId)
      const message = generateApprovalMessage(clientName, contentTitle, approvalUrl, isTraffic)

      if (contact && isGroupLink(contact)) {
        // Grupo WhatsApp: copia mensagem e abre o grupo
        const copied = await openWhatsAppGroup(contact, message)
        setSnack({
          msg: copied
            ? '✅ Mensagem copiada! Cole no grupo do WhatsApp e envie.'
            : '📤 Grupo aberto! Cole a mensagem manualmente.',
          severity: 'success',
        })
      } else if (contact) {
        // Número individual: abre wa.me com mensagem pré-preenchida
        openWhatsAppApproval(contact, clientName, contentTitle, approvalUrl, isTraffic)
        setSnack({ msg: `📤 WhatsApp aberto para ${clientName}!`, severity: 'success' })
      } else {
        // Sem contato configurado: copia o link e avisa
        try { await navigator.clipboard.writeText(approvalUrl) } catch {}
        setSnack({ msg: '⚠️ Configure o WhatsApp do cliente na aba Clientes. Link copiado!', severity: 'warning' })
      }
    }
  }, [states, clientPhones, allClients, updateItem])

  // ── Bulk send to client (WhatsApp em lote por cliente) ───
  const handleBulkSendToClient = useCallback(async (clientName: string, itemIds: number[]) => {
    if (!itemIds.length) return
    let token: string | undefined
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', clientName }),
      })
      const data = await res.json() as { ok: boolean; token?: string }
      if (data.ok && data.token) token = data.token
    } catch {}

    const now = Date.now()
    itemIds.forEach(id => updateItem(id, { status: 4, sentToClientAt: now, approvalToken: token }))

    const contact = clientPhones[clientName] || allClients.find(c => c.name === clientName)?.whatsapp

    if (token) {
      const links = itemIds.map(id => {
        const title = states[id]?.title || `Item ${id}`
        const url = generateApprovalUrl(token!, id)
        return `• *${title}*\n  ${url}`
      }).join('\n\n')
      const message = itemIds.length === 1
        ? generateApprovalMessage(clientName, states[itemIds[0]]?.title || `Item ${itemIds[0]}`, generateApprovalUrl(token, itemIds[0]))
        : `Olá, ${clientName}! Tudo bem? 😊\n\nFinalizamos ${itemIds.length} conteúdos para sua aprovação:\n\n${links}\n\nAcesse os links acima para aprovar ou solicitar alterações. Fico no aguardo! 🙏`

      if (contact && isGroupLink(contact)) {
        const copied = await openWhatsAppGroup(contact, message)
        setSnack({ msg: copied ? '✅ Mensagem copiada! Cole no grupo.' : '📤 Grupo aberto!', severity: 'success' })
      } else if (contact) {
        window.open(buildWhatsAppUrl(contact, message), '_blank', 'noopener,noreferrer')
        setSnack({ msg: `📤 WhatsApp aberto para ${clientName} (${itemIds.length} item${itemIds.length !== 1 ? 's' : ''})!`, severity: 'success' })
      } else {
        try { await navigator.clipboard.writeText(message) } catch {}
        setSnack({ msg: '⚠️ Configure o WhatsApp do cliente na aba Clientes. Mensagem copiada!', severity: 'warning' })
      }
    } else {
      setSnack({ msg: `⚠️ Sem servidor — ${itemIds.length} item${itemIds.length !== 1 ? 's' : ''} marcado${itemIds.length !== 1 ? 's' : ''} como Enviado.`, severity: 'warning' })
    }
  }, [states, clientPhones, allClients, updateItem])

  const deleteItem = useCallback((id: number) => {
    const item = allItems.find(i => i.i === id)
    if (item && currentUser) {
      logActivity({
        user: currentUser,
        action: 'excluiu',
        itemId: id,
        itemTitle: states[id]?.title || item.n,
        clientName: item.c,
        ts: Date.now(),
      })
    }
    setDeletedIds(prev => {
      const next = [...prev, id]
      localStorage.setItem('sm_deleted', JSON.stringify(next))
      syncToCloud('sm_deleted', next)
      return next
    })
  }, [allItems, states, currentUser])

  const editItem = useCallback((id: number, patch: ItemEditPatch) => {
    const isCustom = customItems.some(i => i.i === id)
    if (isCustom) {
      setCustomItems(prev => {
        const idx = prev.findIndex(i => i.i === id)
        if (idx < 0) return prev
        const next = [...prev]
        next[idx] = {
          ...next[idx],
          ...(patch.tp ? { tp: patch.tp } : {}),
          ...(patch.n !== undefined ? { n: patch.n } : {}),
          dt: patch.dt ?? next[idx].dt,
        }
        const serialized = next.map(serializeItem)
        localStorage.setItem('sm_custom', JSON.stringify(serialized))
        syncToCloud('sm_custom', serialized)
        return next
      })
    } else {
      setEditedItems(prev => {
        const cur = prev[id] ?? {}
        const next = {
          ...prev,
          [id]: {
            ...cur,
            ...(patch.tp ? { tp: patch.tp } : {}),
            ...(patch.n !== undefined ? { n: patch.n } : {}),
            ...(patch.dt ? { dt: patch.dt.toISOString() } : {}),
          },
        }
        localStorage.setItem('sm_edits', JSON.stringify(next))
        syncToCloud('sm_edits', next)
        return next
      })
    }
  }, [customItems])

  // ── Adicionar item avulso ─────────────────────────────

  const addItem = useCallback((clientName: string, title: string, type: import('./types').ContentType, date: Date, status: Status, responsible?: string, notes?: string, footageLink?: string, roteiroLink?: string) => {
    const newId = Date.now()
    const newItem: ContentItem = { i: newId, c: clientName, dt: date, tp: type, n: title, s: status, custom: true }
    if (currentUser) {
      logActivity({
        user: currentUser, action: 'criou',
        itemId: newId, itemTitle: title, clientName,
        detail: `${type} · ${date.toLocaleDateString('pt-BR')}`,
        ts: Date.now(),
      })
    }
    setCustomItems(prev => {
      const next = [...prev, newItem]
      const serialized = next.map(serializeItem)
      localStorage.setItem('sm_custom', JSON.stringify(serialized))
      syncToCloud('sm_custom', serialized)
      return next
    })
    setStates(prev => {
      const next = { ...prev, [newId]: { status, title, link: '', caption: '', notes: notes ?? '', ...(responsible ? { responsible } : {}), ...(footageLink ? { footageLink } : {}), ...(roteiroLink ? { roteiroLink } : {}) } }
      localStorage.setItem('sm_states', JSON.stringify(next))
      syncToCloud('sm_states', next)
      return next
    })
  }, [])

  // ── Hashtags por cliente ──────────────────────────────

  const setClientHashtags = useCallback((clientName: string, tags: string[]) => {
    setClientHashtagsState(prev => {
      const next = { ...prev, [clientName]: tags }
      localStorage.setItem('sm_client_hashtags', JSON.stringify(next))
      syncToCloud('sm_client_hashtags', next)
      return next
    })
  }, [])

  const setCaptionTemplates = useCallback((clientName: string, templates: string[]) => {
    setCaptionTemplatesState(prev => {
      const next = { ...prev, [clientName]: templates }
      localStorage.setItem('sm_caption_templates', JSON.stringify(next))
      syncToCloud('sm_caption_templates', next)
      return next
    })
  }, [])

  // ── Cor do cliente ────────────────────────────────────

  const setClientColor = useCallback((clientName: string, color: string) => {
    setClientColorsState(prev => {
      const next = { ...prev, [clientName]: color }
      localStorage.setItem('sm_client_colors', JSON.stringify(next))
      syncToCloud('sm_client_colors', next)
      return next
    })
  }, [])

  // ── Telefone WhatsApp do cliente ──────────────────────

  const setClientPhone = useCallback((clientName: string, phone: string) => {
    setClientPhones(prev => {
      const next = { ...prev, [clientName]: phone }
      localStorage.setItem('sm_client_phones', JSON.stringify(next))
      return next
    })
  }, [])

  // ── Duplicar item ─────────────────────────────────────

  const duplicateItem = useCallback((id: number) => {
    const original = allItems.find(i => i.i === id)
    if (!original) return
    const newId = Date.now()
    const newItem: ContentItem = {
      ...original,
      i: newId,
      n: `${original.n} (cópia)`,
      custom: true,
    }
    const origState = states[id]
    setCustomItems(prev => {
      const next = [...prev, newItem]
      const serialized = next.map(serializeItem)
      localStorage.setItem('sm_custom', JSON.stringify(serialized))
      syncToCloud('sm_custom', serialized)
      return next
    })
    setStates(prev => {
      const next = { ...prev, [newId]: { ...origState, title: origState?.title ? `${origState.title} (cópia)` : '' } }
      localStorage.setItem('sm_states', JSON.stringify(next))
      syncToCloud('sm_states', next)
      return next
    })
  }, [allItems, states])

  // ── Pasta Drive do cliente ────────────────────────────

  const setClientFolder = useCallback((clientName: string, url: string) => {
    setClientFolders(prev => {
      const next = { ...prev, [clientName]: url }
      localStorage.setItem('sm_client_folders', JSON.stringify(next))
      syncToCloud('sm_client_folders', next)
      return next
    })
  }, [])

  // ── Roteiros — adicionar e distribuir automaticamente ──

  const applyDistribution = useCallback((
    clientName: string,
    roteiroList: Roteiro[],
    year: number,
    month: number,
  ) => {
    const { newItems, newStates } = buildDistribution(clientName, roteiroList, customItems, year, month)

    setCustomItems(prev => {
      const filtered = prev.filter(
        i => !(i.c === clientName && i.custom && i.dt.getFullYear() === year && i.dt.getMonth() === month)
      )
      const next = [...filtered, ...newItems]
      const serialized = next.map(serializeItem)
      localStorage.setItem('sm_custom', JSON.stringify(serialized))
      syncToCloud('sm_custom', serialized)
      return next
    })

    setStates(prev => {
      const next = { ...prev, ...newStates }
      localStorage.setItem('sm_states', JSON.stringify(next))
      syncToCloud('sm_states', next)
      return next
    })
  }, [customItems])

  // Adicionar roteiro → redistribuir automaticamente
  const addRoteiroAndDistribute = useCallback((
    clientName: string,
    r: Omit<Roteiro, 'id' | 'clientName' | 'distributed'>,
    year: number,
    month: number,
  ) => {
    const newRoteiro: Roteiro = { ...r, id: crypto.randomUUID(), clientName, distributed: true, year, month }
    const existingForMonth = (roteiros[clientName] ?? []).filter(rot => rot.year === year && rot.month === month)
    const fullList = [...existingForMonth, newRoteiro]

    setRoteiros(prev => {
      const next = { ...prev, [clientName]: [...(prev[clientName] ?? []), newRoteiro] }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      syncToCloud('sm_roteiros', next)
      return next
    })

    applyDistribution(clientName, fullList, year, month)
  }, [roteiros, applyDistribution])

  // Adicionar múltiplos roteiros de uma vez → redistribuir (evita stale state em chamadas sequenciais)
  const addManyRoteirosAndDistribute = useCallback((
    clientName: string,
    list: Omit<Roteiro, 'id' | 'clientName' | 'distributed'>[],
    year: number,
    month: number,
  ) => {
    const newRoteiros: Roteiro[] = list.map(r => ({
      ...r, id: crypto.randomUUID(), clientName, distributed: true, year, month,
    }))
    // Usa apenas os roteiros do mesmo mês (não acumula meses anteriores)
    const existingForMonth = (roteiros[clientName] ?? []).filter(rot => rot.year === year && rot.month === month)
    const fullList = [...existingForMonth, ...newRoteiros]

    setRoteiros(prev => {
      const next = { ...prev, [clientName]: [...(prev[clientName] ?? []), ...newRoteiros] }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      syncToCloud('sm_roteiros', next)
      return next
    })

    applyDistribution(clientName, fullList, year, month)
  }, [roteiros, applyDistribution])

  // Remover roteiro → redistribuir apenas o mês afetado
  const removeRoteiroAndRedistribute = useCallback((clientName: string, roteiroId: string) => {
    setRoteiros(prev => {
      const allForClient = prev[clientName] ?? []
      const target = allForClient.find(r => r.id === roteiroId)
      const year  = target?.year  ?? now.getFullYear()
      const month = target?.month ?? now.getMonth()

      const newList = allForClient.filter(r => r.id !== roteiroId)
      const listForMonth = newList.filter(r => r.year === year && r.month === month)
      const next = { ...prev, [clientName]: newList }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      syncToCloud('sm_roteiros', next)

      const { newItems, newStates } = buildDistribution(clientName, listForMonth, customItems, year, month)

      setCustomItems(c => {
        const filtered = c.filter(
          i => !(i.c === clientName && i.custom && i.dt.getFullYear() === year && i.dt.getMonth() === month)
        )
        const updated = [...filtered, ...newItems]
        const serialized = updated.map(serializeItem)
        localStorage.setItem('sm_custom', JSON.stringify(serialized))
        syncToCloud('sm_custom', serialized)
        return updated
      })

      setStates(s => {
        const updated = { ...s, ...newStates }
        localStorage.setItem('sm_states', JSON.stringify(updated))
        syncToCloud('sm_states', updated)
        return updated
      })

      return next
    })
  }, [roteiros, customItems, now])

  // Remover vários roteiros de uma vez (sem redistribuir — exclusão em massa)
  const deleteManyRoteiros = useCallback((ids: string[]) => {
    const idSet = new Set(ids)
    setRoteiros(prev => {
      const next: Record<string, Roteiro[]> = {}
      Object.keys(prev).forEach(client => {
        next[client] = (prev[client] ?? []).filter(r => !idSet.has(r.id))
      })
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      syncToCloud('sm_roteiros', next)
      return next
    })
  }, [])

  // Redistribuir manualmente (só o mês selecionado)
  const redistributeClient = useCallback((clientName: string, year: number, month: number) => {
    const listForMonth = (roteiros[clientName] ?? []).filter(r => r.year === year && r.month === month)
    applyDistribution(clientName, listForMonth, year, month)
    setRoteiros(prev => {
      const next = {
        ...prev,
        [clientName]: (prev[clientName] ?? []).map(r =>
          (r.year === year && r.month === month) ? { ...r, distributed: true } : r,
        ),
      }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      syncToCloud('sm_roteiros', next)
      return next
    })
  }, [roteiros, applyDistribution])

  const updateRoteiro = useCallback((clientName: string, roteiroId: string, patch: Partial<Pick<Roteiro, 'title' | 'type' | 'driveLink' | 'docsLink'>>) => {
    setRoteiros(prev => {
      const next = {
        ...prev,
        [clientName]: (prev[clientName] ?? []).map(r =>
          r.id === roteiroId ? { ...r, ...patch } : r,
        ),
      }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      syncToCloud('sm_roteiros', next)
      return next
    })
  }, [])

  const importRoteiroBatch = useCallback((
    clientName: string,
    items: Array<{ title: string; type: import('./types').ContentType; docsLink: string }>,
    year: number,
    month: number,
  ) => {
    setRoteiros(prev => {
      const existing = prev[clientName] ?? []
      const existingTitles = new Set(
        existing
          .filter(r => r.year === year && r.month === month)
          .map(r => r.title.toLowerCase().trim()),
      )
      const newOnes: Roteiro[] = items
        .filter(item => !existingTitles.has(item.title.toLowerCase().trim()))
        .map(item => ({
          id: crypto.randomUUID(),
          clientName,
          title: item.title,
          type: item.type,
          docsLink: item.docsLink,
          distributed: false,
          year,
          month,
        }))
      if (!newOnes.length) return prev
      const next = { ...prev, [clientName]: [...existing, ...newOnes] }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      syncToCloud('sm_roteiros', next)
      return next
    })
  }, [])

  const clearDistribution = useCallback((clientName: string, year: number, month: number) => {
    setCustomItems(prev => {
      const next = prev.filter(
        i => !(i.c === clientName && i.custom && i.dt.getFullYear() === year && i.dt.getMonth() === month)
      )
      const serialized = next.map(serializeItem)
      localStorage.setItem('sm_custom', JSON.stringify(serialized))
      syncToCloud('sm_custom', serialized)
      return next
    })
    setRoteiros(prev => {
      const next = {
        ...prev,
        [clientName]: (prev[clientName] ?? []).map(r =>
          (r.year === year && r.month === month) ? { ...r, distributed: false } : r,
        ),
      }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      syncToCloud('sm_roteiros', next)
      return next
    })
  }, [])

  // IA: criar roteiros genéricos e distribuir em massa (substitui apenas o mês alvo)
  const createAndDistributeMany = useCallback((clientName: string, posts: number, reels: number, year?: number, month?: number) => {
    const y = year ?? now.getFullYear()
    const m = month ?? now.getMonth()
    const folderLink = clientFolders[clientName]

    const newRoteiros: Roteiro[] = [
      ...Array.from({ length: posts }, (_, i) => ({
        id: crypto.randomUUID(), clientName,
        title: `Post ${i + 1}`, type: 'Post' as ContentType,
        driveLink: folderLink, distributed: true, year: y, month: m,
      })),
      ...Array.from({ length: reels }, (_, i) => ({
        id: crypto.randomUUID(), clientName,
        title: `Reel ${i + 1}`, type: 'Reel' as ContentType,
        driveLink: folderLink, distributed: true, year: y, month: m,
      })),
    ]

    setRoteiros(prev => {
      // Mantém roteiros de outros meses, substitui apenas o mês alvo
      const othersForClient = (prev[clientName] ?? []).filter(r => !(r.year === y && r.month === m))
      const next = { ...prev, [clientName]: [...othersForClient, ...newRoteiros] }
      localStorage.setItem('sm_roteiros', JSON.stringify(next))
      syncToCloud('sm_roteiros', next)
      return next
    })

    applyDistribution(clientName, newRoteiros, y, m)
  }, [now, clientFolders, applyDistribution])

  // ── Adicionar novo cliente ────────────────────────────

  const addClient = useCallback((client: import('./types').Client) => {
    setExtraClients(prev => {
      const next = [...prev, client]
      localStorage.setItem('sm_extra_clients', JSON.stringify(next))
      syncToCloud('sm_extra_clients', next)
      return next
    })
  }, [])

  // ── Excluir cliente ───────────────────────────────────

  const deleteClient = useCallback((name: string) => {
    setExtraClients(prev => {
      const next = prev.filter(c => c.name !== name)
      localStorage.setItem('sm_extra_clients', JSON.stringify(next))
      syncToCloud('sm_extra_clients', next)
      return next
    })
    setHiddenClients(prev => {
      const next = [...prev, name]
      localStorage.setItem('sm_hidden_clients', JSON.stringify(next))
      syncToCloud('sm_hidden_clients', next)
      return next
    })
  }, [])

  // ── Distribuir todos os clientes de uma vez ───────────

  const distributeAll = useCallback((year: number, month: number) => {
    allClients.forEach(client => {
      createAndDistributeMany(client.name, client.postsPerMonth, client.reelsPerMonth, year, month)
    })
  }, [allClients, createAndDistributeMany])

  // ── Iniciar novo mês: usa roteiros se existirem, senão cria genéricos ──

  const startNewMonth = useCallback((year: number, month: number) => {
    allClients.forEach(client => {
      const roteiroList = roteiros[client.name] ?? []
      if (roteiroList.length > 0) {
        applyDistribution(client.name, roteiroList, year, month)
      } else {
        createAndDistributeMany(client.name, client.postsPerMonth, client.reelsPerMonth, year, month)
      }
    })
  }, [allClients, roteiros, applyDistribution, createAndDistributeMany])

  // ── Reagen dar item (drag no calendário) ─────────────

  const rescheduleItem = useCallback((id: number, newDate: Date) => {
    editItem(id, { dt: newDate })
  }, [editItem])

  // ── Estatísticas do header ────────────────────────────

  const headerStats = useMemo(() => {
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today.getTime() + 86_400_000)
    const late = allItems.filter(i => (states[i.i]?.status ?? i.s) < 3 && i.dt < today).length
    const todayTotal = allItems.filter(i => i.dt >= today && i.dt < tomorrow).length
    const todayDone  = allItems.filter(i => i.dt >= today && i.dt < tomorrow && (states[i.i]?.status ?? i.s) === 3).length
    return { late, todayTotal, todayDone }
  }, [allItems, states, now])

  // ── Contexto para IA ──────────────────────────────────

  const aiContext = useMemo(() => {
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    return {
      clients: [...new Set(allItems.map(i => i.c))].sort(),
      totalItems: allItems.length,
      published: allItems.filter(i => (states[i.i]?.status ?? i.s) === 3).length,
      pending: allItems.filter(i => (states[i.i]?.status ?? i.s) === 0).length,
      late: allItems.filter(i => (states[i.i]?.status ?? i.s) < 3 && i.dt < today).length,
      roteiros: Object.fromEntries(Object.entries(roteiros).map(([c, rs]) => [c, rs.length])),
      clientFolders,
    }
  }, [allItems, states, roteiros, clientFolders, now])

  // ── Props compartilhadas ──────────────────────────────

  const filteredItems = allItems

  const handleSelectUser = (name: string) => {
    sessionStorage.setItem('sm_tab_user', name)
    setCurrentUser(name)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('sm_tab_user')
    setCurrentUser('')
    setShowSplash(true)
  }

  const sharedProps = {
    items: filteredItems, states,
    onStatusChange: setStatus,
    onUpdate: updateItem,
    onDelete: perms.canDelete ? deleteItem : undefined,
    onEdit: editItem,
    onDuplicate: duplicateItem,
    onAddItem: perms.canAddItems ? addItem : undefined,
    clientColors,
    clientHashtags,
    onSaveHashtags: setClientHashtags,
    captionTemplates,
    onSaveTemplates: setCaptionTemplates,
    allClients,
    now,
    currentUser,
  }

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return allItems.filter(i =>
      i.c.toLowerCase().includes(q) ||
      i.n.toLowerCase().includes(q) ||
      (states[i.i]?.title ?? '').toLowerCase().includes(q)
    ).slice(0, 30)
  }, [searchQuery, allItems, states])

  const isDesktop = useMediaQuery(theme.breakpoints.up('sm'))

  // Informações do usuário logado (cargo, emoji, cor) — derivadas do nome
  const userInfo    = getUserInfo(currentUser)
  const displayName = getDisplayName(currentUser)

  // ── Badge counts per tab ─────────────────────────────
  const navBadges = useMemo(() => {
    const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)
    const todayEnd  = new Date(todayDate.getTime() + 86_400_000)
    const late       = allItems.filter(i => (states[i.i]?.status ?? i.s) < 7 && i.dt < todayDate).length
    const todayPend  = allItems.filter(i => i.dt >= todayDate && i.dt < todayEnd && (states[i.i]?.status ?? i.s) !== 7).length
    const rejected   = allItems.filter(i => (states[i.i]?.status ?? i.s) === 6).length
    const awaitingInt= allItems.filter(i => (states[i.i]?.status ?? i.s) === 2).length
    const clientsAlert = allClients.filter(c => {
      const ci = allItems.filter(i => i.c === c.name)
      return ci.some(i => (states[i.i]?.status ?? i.s) === 6) ||
             ci.some(i => (states[i.i]?.status ?? i.s) < 7 && i.dt < todayDate)
    }).length
    // Alertas internos visíveis para o usuário atual (não dispensados hoje)
    const allAlerts  = computeAlerts(allItems, states, allClients, now)
    const userAlerts = alertsForUser(allAlerts, currentUser)
    const dismissed  = pruneOldDismissals(loadDismissed(), allAlerts.map(a => a.id))
    const alertCount = userAlerts.filter(a => !dismissed.has(a.id)).length
    return [
      alertCount,         // 0 Meu Dia — badge = alertas ativos do usuário
      late + todayPend,   // 1 Hoje
      0,                  // 2 Agenda
      rejected,           // 3 Kanban
      0,                  // 4 Produções
      0,                  // 5 Calendário
      clientsAlert,       // 6 Clientes
      0,                  // 7 Dashboard
      0,                  // 8 Timeline
      0,                  // 9 Gravações
      0,                  // 10 Editor
      0,                  // 11 Financeiro
      0,                  // 12 Equipe
      awaitingInt,        // 13 IA
    ]
  }, [allItems, states, allClients])

  // mobileHidden: true = só aparece no desktop (sidebar); nunca no bottom nav mobile
  const navItems = [
    { label: 'Meu Dia',    icon: <PersonIcon />,         mobileOnly: false, hidden: false, mobileHidden: false }, // 0
    { label: 'Hoje',       icon: <HomeIcon />,           mobileOnly: false, hidden: false, mobileHidden: false }, // 1
    { label: 'Agenda',     icon: <ViewAgendaIcon />,     mobileOnly: false, hidden: false, mobileHidden: true  }, // 2 — desktop only (Meu Dia cobre no mobile)
    { label: 'Kanban',     icon: <ViewKanbanIcon />,     mobileOnly: false, hidden: true,  mobileHidden: true  }, // 3
    { label: 'Produções',  icon: <AccountTreeIcon />,    mobileOnly: false, hidden: false, mobileHidden: false, highlight: true }, // 4
    { label: 'Calendário', icon: <CalendarMonthIcon />,  mobileOnly: false, hidden: false, mobileHidden: false }, // 5
    { label: 'Clientes',   icon: <PeopleIcon />,         mobileOnly: false, hidden: false, mobileHidden: false }, // 6
    { label: 'Dashboard',  icon: <BarChartIcon />,       mobileOnly: false, hidden: false, mobileHidden: true  }, // 7 — desktop only no mobile
    { label: 'Timeline',   icon: <TimelineIcon />,       mobileOnly: true,  hidden: true,  mobileHidden: true  }, // 8
    { label: 'Gravações',  icon: <VideocamIcon />,       mobileOnly: false, hidden: false, mobileHidden: false }, // 9
    { label: 'Editor',     icon: <MovieFilterIcon />,    mobileOnly: false, hidden: false, mobileHidden: true  }, // 10
    { label: 'Financeiro', icon: <AttachMoneyIcon />,    mobileOnly: false, hidden: false, mobileHidden: true  }, // 11
    { label: 'Equipe',     icon: <GroupIcon />,          mobileOnly: false, hidden: false, mobileHidden: true  }, // 12
    { label: 'IA',         icon: <PsychologyIcon />,     mobileOnly: false, hidden: false, mobileHidden: true  }, // 13
    { label: 'Roteiros',   icon: <AutoStoriesIcon />,    mobileOnly: false, hidden: true,  mobileHidden: true  }, // 14
    { label: 'Tráfego',    icon: <CampaignIcon />,       mobileOnly: false, hidden: false, mobileHidden: true  }, // 15
    { label: 'Design',     icon: <BrushIcon />,          mobileOnly: false, hidden: false, mobileHidden: true  }, // 16
    { label: 'Prospecção', icon: <TravelExploreIcon />,  mobileOnly: false, hidden: false, mobileHidden: false }, // 17
    { label: 'Studio',      icon: <AutoFixHighIcon />,   mobileOnly: false, hidden: false, mobileHidden: true  }, // 18
    { label: 'Performance', icon: <QueryStatsIcon />,    mobileOnly: false, hidden: false, mobileHidden: true  }, // 19
    { label: 'Datas',       icon: <CelebrationIcon />,  mobileOnly: false, hidden: false, mobileHidden: true  }, // 20
    { label: 'Radar',       icon: <RadarIcon />,        mobileOnly: false, hidden: false, mobileHidden: true, highlight: false  }, // 21
  ]

  const renderTab = () => {
    switch (tab) {
      case 0:  return <MeuDiaTab items={allItems} states={states} allClients={allClients} currentUser={currentUser} now={now} roteiros={roteiros} clientFolders={clientFolders} clientHashtags={clientHashtags} onStatusChange={setStatus} onUpdate={updateItem} onTabChange={setTab} />
      case 1:  return <TodayTab    {...sharedProps} now={now} onBulkSendToClient={handleBulkSendToClient} clientPhones={clientPhones} />
      case 2:  return <AgendaTab   {...sharedProps} now={now} />
      case 3:  return <KanbanTab   items={allItems} states={states} onStatusChange={setStatus} onDelete={deleteItem} onEdit={editItem} onUpdateState={updateItem} onAddItem={addItem} allClients={allClients} onSendToClient={handleSendToClient} onBulkSendToClient={handleBulkSendToClient} clientColors={clientColors} clientPhones={clientPhones} />
      case 4:  return <ProducaoTab items={allItems} states={states} onStatusChange={setStatus} onDelete={deleteItem} onEdit={editItem} onUpdateState={updateItem} onAddItem={addItem} onDuplicate={duplicateItem} allClients={allClients} onSendToClient={handleSendToClient} clientColors={clientColors} clientHashtags={clientHashtags} captionTemplates={captionTemplates} onSaveHashtags={setClientHashtags} onSaveTemplates={setCaptionTemplates} currentUser={currentUser} roteiros={roteiros} clientFolders={clientFolders} onUpdateRoteiro={updateRoteiro} onImportRoteiroBatch={importRoteiroBatch} onDeleteManyRoteiros={deleteManyRoteiros} />
      case 5:  return <CalendarTab items={filteredItems} states={states} now={now} onStatusChange={setStatus} onUpdate={updateItem} onDelete={deleteItem} onEdit={editItem} onDuplicate={duplicateItem} clientColors={clientColors} clientHashtags={clientHashtags} onSaveHashtags={setClientHashtags} onReschedule={rescheduleItem} onAddItem={addItem} allClients={allClients} />
      case 6:  return <ClientsTab  items={allItems} states={states} roteiros={roteiros} clientFolders={clientFolders} clientColors={clientColors} allClients={allClients} onAddRoteiro={addRoteiroAndDistribute} onAddManyRoteiros={addManyRoteirosAndDistribute} onBulkCreate={createAndDistributeMany} onDistributeAll={distributeAll} onStartNewMonth={startNewMonth} onAddClient={addClient} onDeleteClient={deleteClient} onRemoveRoteiro={removeRoteiroAndRedistribute} onRedistribute={redistributeClient} onClearDistribution={clearDistribution} onSetClientFolder={setClientFolder} onSetClientColor={setClientColor} onClientFocus={setFocusClient} onStatusChange={setStatus} onBulkSendToClient={handleBulkSendToClient} clientPhones={clientPhones} onSetClientPhone={setClientPhone} />
      case 7:  return <KaiqueTab      items={allItems} states={states} allClients={allClients} now={now} onTabChange={setTab} onTVMode={() => setTvMode(true)} />
      case 8:  return <TimelineTab    items={allItems} states={states} now={now} />
      case 9:  return <RecordingCenter allClients={allClients.map(c => c.name)} />
      case 10: return <EditorMode items={allItems} states={states} onStatusChange={setStatus} onUpdate={updateItem} roteiros={roteiros} clientFolders={clientFolders} now={now} currentUser={currentUser} />
      case 11: return perms.canViewFinanceiro
        ? <FinanceiroTab allClients={allClients} now={now} items={allItems} states={states} syncVersion={financeiroSyncVersion} />
        : <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:'50vh', flexDirection:'column', gap:2 }}>
            <Typography sx={{ fontSize:'2rem' }}>🔒</Typography>
            <Typography sx={{ fontWeight:700, color:'text.secondary' }}>Acesso restrito</Typography>
            <Typography sx={{ fontSize:'0.78rem', color:'text.disabled' }}>Somente Sócios e Head têm acesso ao Financeiro.</Typography>
          </Box>
      case 12: return <EquipeTab items={allItems} states={states} currentUser={currentUser} />
      case 13: return <IATab allClients={allClients} items={allItems} states={states} />
      case 14: return <RoteirosIdeaTab allClients={allClients} onAddManyRoteiros={addManyRoteirosAndDistribute} />
      case 15: return <TrafegoTab allClients={allClients} />
      case 16: return <DesignTab items={allItems} states={states} onStatusChange={setStatus} clientFolders={clientFolders} now={now} />
      case 17: return <ProspeccaoTab />
      case 18: return <CreativeStudio allClients={allClients} />
      case 19: return <PerformanceTab items={allItems} states={states} allClients={allClients} clientPhones={clientPhones} now={now} onUpdate={updateItem} />
      case 20: return <DatasTab />
      case 21: return <ClientRadar items={allItems} states={states} allClients={allClients} now={now} />
      default: return null
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AccessManager open={accessManagerOpen} onClose={() => setAccessManagerOpen(false)} currentUser={currentUser || undefined} />
      <OnboardingWizard open={onboardingOpen} onClose={() => setOnboardingOpen(false)} currentUser={currentUser || undefined} totalClients={allClients.length} />
      {currentUser && (
        <AssignmentNotification
          currentUser={currentUser}
          checkTrigger={assignmentTrigger}
          onViewItem={(itemId) => {
            setTab(4) // Vai para Produções
            // Pequeno delay para o tab renderizar antes de abrir o drawer
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('ds:openCard', { detail: { itemId } }))
            }, 300)
          }}
        />
      )}
      {showSplash && (
        <SplashScreen
          showLogin={!currentUser}
          onLogin={handleSelectUser}
          onFinish={() => setShowSplash(false)}
          currentUser={currentUser ?? undefined}
          onManagePasswords={() => setAccessManagerOpen(true)}
        />
      )}
      <PresentationMode
        open={presentationOpen}
        onClose={() => setPresentationOpen(false)}
        items={allItems}
        states={states}
        clientColors={clientColors}
      />
      <ScaleAI
        open={scaleAIOpen}
        onClose={() => setScaleAIOpen(false)}
        context={aiContext}
      />
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
      <Confetti active={confettiActive} onDone={() => setConfettiActive(false)} />
      <EngagementDialog
        open={engagementItemId !== null}
        itemId={engagementItemId}
        items={allItems}
        states={states}
        onSave={(id, eng) => updateItem(id, { engagement: { ...(states[id]?.engagement ?? {}), ...eng } })}
        onClose={() => setEngagementItemId(null)}
      />
      {/* ── Overlay de restauração de dados ──────────────── */}
      {restoringData && (
        <Box sx={{
          position: 'fixed', inset: 0, zIndex: 99999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          bgcolor: '#08090E', gap: 2,
        }}>
          <Box component="img" src="/logotipo.png" sx={{ height: 52, opacity: 0.7 }} />
          <CircularProgress size={28} sx={{ color: 'primary.main' }} />
          <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', letterSpacing: '0.04em' }}>
            Restaurando dados do servidor…
          </Typography>
          <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
            Cache limpo detectado — recuperando do backup D1
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', height: '100dvh', bgcolor: 'background.default', position: 'relative', overflow: 'hidden' }}>

        {/* ── Sidebar desktop ───────────────────────────── */}
        {isDesktop && (
          <Box sx={{
            position: 'relative', zIndex: 2,
            width: { md: 236, lg: 260, xl: 300 },
            flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            borderRight: `1px solid ${DS.border}`,
            background: 'rgba(9,10,15,0.99)',
            overflowX: 'hidden',
            overflowY: 'hidden',
          }}>

            {/* ── Logo hero ── */}
            <Box sx={{ borderBottom: `1px solid ${DS.border}`, flexShrink: 0 }}>
              <Logo size="sidebar" />
            </Box>

            {/* ── Date + clock ── */}
            <Box sx={{
              px: 2.2, pt: 1.6, pb: 1.4, flexShrink: 0,
              borderBottom: `1px solid ${DS.border}`,
            }}>
              <Typography sx={{ fontSize: { md: '0.62rem', xl: '0.7rem' }, color: DS.t3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, display: 'block', mb: 0.2 }}>
                {getGreeting()}
              </Typography>
              <Typography sx={{
                color: DS.t1, fontWeight: 700,
                fontSize: { md: '1.4rem', xl: '1.65rem' },
                lineHeight: 1.05, fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.03em',
              }}>
                {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Typography>
              <Typography sx={{ fontSize: { md: '0.64rem', xl: '0.72rem' }, color: DS.t3, textTransform: 'capitalize', mt: 0.3, letterSpacing: '0.02em' }}>
                {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </Typography>
            </Box>

            {/* ── Stats inline ── */}
            <Box sx={{ px: 2.2, py: 1, display: 'flex', gap: 2, flexShrink: 0, borderBottom: `1px solid ${DS.border}` }}>
              <Box>
                <Typography sx={{ fontSize: '0.6rem', color: DS.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hoje</Typography>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: headerStats.todayDone === headerStats.todayTotal && headerStats.todayTotal > 0 ? '#22C55E' : DS.t1 }}>
                  {headerStats.todayDone}/{headerStats.todayTotal}
                </Typography>
              </Box>
              {headerStats.late > 0 && (
                <Box>
                  <Typography sx={{ fontSize: '0.6rem', color: DS.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Atrasados</Typography>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#EF4444' }}>{headerStats.late}</Typography>
                </Box>
              )}
            </Box>

            {/* ── Nav items ── */}
            <Box sx={{
              flex: 1, px: 1, pt: 0.5, pb: 0.5,
              display: 'flex', flexDirection: 'column', gap: 0.2,
              overflowY: 'auto',
              '&::-webkit-scrollbar': { width: 3 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2 },
            }}>
              {navItems.map(({ label, icon, hidden: navHidden, highlight }, idx) => {
                // Esconde tabs restritas para o cargo atual
                if (perms.hiddenTabs.includes(idx)) return null
                if (navHidden) return null
                const selected = tab === idx
                const isHighlight = !!(highlight as boolean | undefined)
                const categoryLabel =
                  idx === 0  ? 'Publicações'
                  : idx === 5  ? 'Operações'
                  : idx === 12 ? 'Ferramentas'
                  : idx === 21 ? 'Inteligência'
                  : null
                return (
                  <Box key={label}>
                    {categoryLabel && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.4, pt: idx === 0 ? 0.4 : 1.6, pb: 0.5 }}>
                        <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.12em', flexShrink: 0 }}>
                          {categoryLabel}
                        </Typography>
                        <Box sx={{ flex: 1, height: '0.5px', bgcolor: DS.border }} />
                      </Box>
                    )}
                  <Box
                    onClick={() => setTab(idx)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.2,
                      px: 1.4, py: 0.85, borderRadius: 2, cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                      bgcolor: selected ? `rgba(249,115,22,0.1)` : 'transparent',
                      borderLeft: selected ? `2.5px solid ${DS.orange}` : '2.5px solid transparent',
                      '&:hover': {
                        bgcolor: selected ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
                      },
                    }}
                  >
                    <Box sx={{
                      color: selected ? 'primary.main' : 'rgba(255,255,255,0.32)',
                      fontSize: { md: '1.05rem', xl: '1.2rem' },
                      display: 'flex', alignItems: 'center',
                      transition: 'color 0.15s',
                    }}>
                      {icon}
                    </Box>
                    <Typography sx={{
                      fontSize: { md: '0.82rem', xl: '0.9rem' },
                      fontWeight: selected ? 600 : 400,
                      color: selected ? 'primary.main' : DS.t2,
                      flex: 1,
                      transition: 'color 0.15s',
                    }}>
                      {label}
                    </Typography>
                    {navBadges[idx] > 0 && !selected && (
                      <Box sx={{
                        minWidth: 17, height: 17, borderRadius: '50%', px: 0.4,
                        bgcolor: 'primary.main',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Typography sx={{ fontSize: '0.48rem', fontWeight: 900, color: '#000', lineHeight: 1 }}>
                          {navBadges[idx] > 99 ? '99+' : navBadges[idx]}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  </Box>
                )
              })}
            </Box>

            {/* ── Footer: saudação + cargo + ações ── */}
            <Box sx={{ px: 1.8, pt: 1.2, pb: 1.4, borderTop: `1px solid ${DS.border}`, display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>

              {/* Cartão de usuário — somente leitura, sem troca de função */}
              {currentUser && userInfo ? (
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  p: 1, borderRadius: 2,
                  bgcolor: `${userInfo.color}08`,
                  border: `1px solid ${userInfo.color}20`,
                }}>
                  {/* Emoji avatar */}
                  <Box sx={{
                    width: 34, height: 34, borderRadius: '10px', flexShrink: 0,
                    bgcolor: `${userInfo.color}14`,
                    border: `1.5px solid ${userInfo.color}35`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{userInfo.emoji}</Typography>
                  </Box>
                  {/* Nome + cargo */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: { md: '0.82rem', xl: '0.92rem' }, fontWeight: 800, color: '#fff', lineHeight: 1.25 }} noWrap>
                      {displayName}
                    </Typography>
                    <Typography sx={{ fontSize: { md: '0.68rem', xl: '0.75rem' }, color: userInfo.color, fontWeight: 700, lineHeight: 1.3, opacity: 0.9 }} noWrap>
                      {userInfo.role}
                    </Typography>
                  </Box>
                  {/* Workspace settings (todos os usuários) */}
                  <Tooltip title="Configurações do Workspace" placement="right">
                    <Box
                      onClick={() => setOnboardingOpen(true)}
                      sx={{
                        p: 0.5, borderRadius: 1, cursor: 'pointer', display: 'flex', flexShrink: 0,
                        color: 'rgba(255,255,255,0.25)',
                        '&:hover': { color: '#ff9039', bgcolor: 'rgba(255,144,57,0.1)' },
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <TuneIcon sx={{ fontSize: 15 }} />
                    </Box>
                  </Tooltip>
                  {/* Gerenciar Senhas (Kaique + Sócios) */}
                  {['kaique', 'pradox', 'testa'].includes(currentUser?.toLowerCase() ?? '') && (
                    <Tooltip title="Gerenciar Senhas da Equipe" placement="right">
                      <Box
                        onClick={() => setAccessManagerOpen(true)}
                        sx={{
                          p: 0.5, borderRadius: 1, cursor: 'pointer', display: 'flex', flexShrink: 0,
                          color: 'rgba(255,215,0,0.55)',
                          '&:hover': { color: '#FFD700', bgcolor: 'rgba(255,215,0,0.1)' },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <AdminPanelSettingsIcon sx={{ fontSize: 15 }} />
                      </Box>
                    </Tooltip>
                  )}
                  {/* Logout */}
                  <Box
                    onClick={handleLogout}
                    title="Sair"
                    sx={{ p: 0.5, borderRadius: 1, cursor: 'pointer', color: 'rgba(255,255,255,0.2)', '&:hover': { color: '#FF4545', bgcolor: 'rgba(255,69,69,0.08)' }, display: 'flex', flexShrink: 0 }}
                  >
                    <LogoutIcon sx={{ fontSize: 14 }} />
                  </Box>
                </Box>
              ) : !currentUser ? (
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)' }}>DS HUB</Typography>
              ) : null}

              {/* Sync status + forçar sync */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, px: 0.5 }}>
                <SyncIndicator />
                <Box
                  onClick={() => forceSync().then(() => setSnack({ msg: '✅ Dados sincronizados com o servidor', severity: 'success' }))}
                  sx={{ ml: 'auto', fontSize: '0.52rem', color: DS.t3, cursor: 'pointer', letterSpacing: '0.04em',
                    '&:hover': { color: 'primary.main' }, transition: 'color 0.15s' }}
                >
                  Forçar sync
                </Box>
              </Box>

              {/* Botões de ação */}
              <Box sx={{ display: 'flex', gap: 0.6 }}>
                {[
                  { label: 'Scale AI',    icon: <AutoAwesomeIcon sx={{ fontSize: 13 }} />, color: '#ff9039', onClick: () => setScaleAIOpen(true) },
                  { label: 'Apresentar', icon: <Box component="span" sx={{ fontSize: 12, lineHeight: 1 }}>🎯</Box>, color: 'rgba(255,255,255,0.5)', onClick: () => setPresentationOpen(true) },
                  { label: 'Relatório',  icon: <BarChartIcon sx={{ fontSize: 13 }} />,      color: 'rgba(255,255,255,0.5)', onClick: () => setReportOpen(true) },
                  { label: 'WhatsApp',   icon: <Box component="span" sx={{ fontSize: 12, lineHeight: 1 }}>📱</Box>, color: 'rgba(255,255,255,0.5)', onClick: () => setWaReportOpen(true) },
                ].map(btn => (
                  <Box
                    key={btn.label}
                    onClick={btn.onClick}
                    sx={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.35,
                      py: 0.75, borderRadius: 2, cursor: 'pointer',
                      bgcolor: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: btn.color,
                      transition: 'all 0.18s ease',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.13)', transform: 'translateY(-1px)' },
                    }}
                  >
                    {btn.icon}
                    <Typography sx={{ fontSize: { md: '0.58rem', xl: '0.64rem' }, fontWeight: 600, lineHeight: 1, color: 'inherit' }}>
                      {btn.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}

        {/* ── Main area ─────────────────────────────────── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

          {/* ── Header ──────────────────────────────────── */}
          <Paper elevation={0} square sx={{
            px: { xs: 2, md: 3 }, pt: { xs: 1.2, md: 1.5 }, pb: { xs: 1, md: 1.2 },
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(9,10,15,0.99)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 0.8, md: 0 } }}>
              {/* Mobile: avatar + DIGITAL SCALE em gradiente; Desktop: nome da aba */}
              {!isDesktop ? (
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1.2,
                }}>
                  {/* Circular avatar — stays visible at any zoom */}
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '12px', flexShrink: 0,
                    background: '#F97316',
                    p: '2px',
                  }}>
                    <Box sx={{
                      width: '100%', height: '100%', borderRadius: '10px',
                      bgcolor: '#0d0d0d',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      <img src="/logotipo.png" alt="DS" style={{ width: '84%', height: '84%', objectFit: 'contain' }} />
                    </Box>
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', lineHeight: 1, letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.9)' }}>
                      DS HUB
                    </Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary', letterSpacing: '0.06em', textTransform: 'uppercase', mt: 0.15 }}>
                      Digital Scale
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Typography sx={{
                  fontWeight: 800, fontSize: { md: '1.15rem', lg: '1.35rem', xl: '1.5rem' },
                  color: 'primary.main', letterSpacing: '-0.01em',
                }}>
                  {navItems[tab]?.label}
                </Typography>
              )}

              {/* ── Frase do dia — só desktop ── */}
              {isDesktop && (() => {
                const phrase = getDailyPhrase()
                return (
                  <Box sx={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    mx: 2, minWidth: 0, overflow: 'hidden',
                  }}>
                    <Typography sx={{
                      fontSize: { md: '0.7rem', lg: '0.75rem', xl: '0.82rem' },
                      color: 'rgba(255,255,255,0.45)',
                      fontStyle: 'italic',
                      letterSpacing: '0.01em',
                      lineHeight: 1.3,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}>
                      "{phrase.text}"
                    </Typography>
                    <Typography sx={{
                      fontSize: { md: '0.54rem', lg: '0.58rem' },
                      color: 'rgba(249,115,22,0.5)',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      mt: 0.2,
                      textTransform: 'uppercase',
                    }}>
                      — {phrase.ref}
                    </Typography>
                  </Box>
                )
              })()}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {/* Desktop stats inline */}
                {isDesktop && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                    {headerStats.late > 0 && (
                      <Chip icon={<WarningAmberIcon />} label={`${headerStats.late} atrasado${headerStats.late > 1 ? 's' : ''}`} size="small" color="error" variant="outlined" sx={{ fontSize: '0.68rem', height: 24, '& .MuiChip-icon': { fontSize: 12 } }} />
                    )}
                    {/* Progresso circular do dia */}
                    <Box sx={{ position: 'relative', width: 40, height: 40, cursor: 'default' }} title={`${headerStats.todayDone} de ${headerStats.todayTotal} publicados hoje`}>
                      <CircularProgress
                        variant="determinate"
                        value={100}
                        size={40} thickness={3.5}
                        sx={{ color: 'rgba(255,255,255,0.07)', position: 'absolute', top: 0, left: 0 }}
                      />
                      <CircularProgress
                        variant="determinate"
                        value={headerStats.todayTotal > 0 ? (headerStats.todayDone / headerStats.todayTotal) * 100 : 0}
                        size={40} thickness={3.5}
                        sx={{ color: headerStats.todayDone === headerStats.todayTotal && headerStats.todayTotal > 0 ? 'success.main' : 'primary.main', position: 'absolute', top: 0, left: 0 }}
                      />
                      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography sx={{ fontSize: '0.55rem', fontWeight: 900, lineHeight: 1, color: headerStats.todayDone === headerStats.todayTotal && headerStats.todayTotal > 0 ? 'success.main' : 'primary.main' }}>
                          {headerStats.todayDone}/{headerStats.todayTotal}
                        </Typography>
                        <Typography sx={{ fontSize: '0.42rem', color: 'text.disabled', lineHeight: 1, textTransform: 'uppercase', letterSpacing: 0.3 }}>hoje</Typography>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* Sync status */}
                <SyncIndicator />

                {/* Notification center */}
                <NotificationCenter
                  notifications={notifications}
                  onMarkRead={id => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
                  onMarkAllRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                  onNavigateToItem={_itemId => { setTab(2); setSearchQuery('') }}
                />

                {/* Cmd+K hint chip — desktop only */}
                {isDesktop && (
                  <Tooltip title="Busca rápida (⌘K)">
                    <Chip
                      icon={<SearchIcon sx={{ fontSize: 14 }} />}
                      label="⌘K"
                      size="small"
                      onClick={() => setCmdOpen(true)}
                      sx={{
                        fontSize: '0.6rem', fontFamily: 'monospace', cursor: 'pointer',
                        bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.35)',
                        '&:hover': { bgcolor: DS.border, borderColor: DS.borderHov, color: '#ff9039' },
                      }}
                    />
                  </Tooltip>
                )}

                {/* Search toggle */}
                <Box
                  onClick={() => { setSearchOpen(v => !v); if (searchOpen) setSearchQuery('') }}
                  sx={{ cursor: 'pointer', color: searchOpen ? 'primary.main' : 'text.secondary', display: 'flex', alignItems: 'center' }}
                >
                  {searchOpen ? <CloseIcon sx={{ fontSize: { xs: 18, md: 20 } }} /> : <SearchIcon sx={{ fontSize: { xs: 18, md: 20 } }} />}
                </Box>

                {/* Mobile clock */}
                {!isDesktop && (
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', display: 'block' }}>{getGreeting()}</Typography>
                    <Typography sx={{ color: 'primary.main', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* ── Campo de busca ── */}
            <Collapse in={searchOpen}>
              <Box sx={{ mt: { xs: 0, md: 1 }, mb: 0.8 }}>
                <InputBase
                  autoFocus
                  fullWidth
                  placeholder="Buscar cliente ou conteúdo..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  sx={{
                    fontSize: { xs: '0.85rem', md: '0.95rem' },
                    px: 1.5, py: 0.6, borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'text.primary',
                  }}
                />
                {searchResults.length > 0 && (
                  <Paper sx={{ mt: 0.5, maxHeight: 280, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
                    <List dense disablePadding>
                      {searchResults.map(item => {
                        const st = states[item.i]?.status ?? item.s
                        const scfg = STATUS_CONFIG[st as Status] ?? STATUS_CONFIG[0]
                        return (
                          <ListItem key={item.i} divider sx={{ py: 0.5, px: 1.5 }}>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                                  <Typography sx={{ fontSize: '0.65rem', color: 'primary.main', fontWeight: 700 }} noWrap>{item.c}</Typography>
                                  <Chip label={item.tp} size="small" sx={{ height: 14, fontSize: '0.52rem' }} />
                                  <Typography sx={{ fontSize: '0.65rem', color: scfg.color, ml: 'auto' }}>
                                    {scfg.shortLabel}
                                  </Typography>
                                </Box>
                              }
                              secondary={
                                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.primary' }} noWrap>
                                  {states[item.i]?.title || item.n}
                                </Typography>
                              }
                            />
                          </ListItem>
                        )
                      })}
                    </List>
                  </Paper>
                )}
                {searchQuery && searchResults.length === 0 && (
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.5, px: 0.5 }}>Nenhum resultado para "{searchQuery}"</Typography>
                )}
              </Box>
            </Collapse>

            {/* Mobile chips row */}
            {!isDesktop && (
              <Box sx={{ display: 'flex', gap: 0.8 }}>
                {headerStats.late > 0 && (
                  <Chip icon={<WarningAmberIcon />} label={`${headerStats.late} atrasado${headerStats.late > 1 ? 's' : ''}`} size="small" color="error" variant="outlined" sx={{ fontSize: '0.6rem', height: 20, '& .MuiChip-icon': { fontSize: 11 } }} />
                )}
                <Chip icon={<CheckCircleIcon />} label={`Hoje: ${headerStats.todayDone}/${headerStats.todayTotal}`} size="small" color={headerStats.todayDone === headerStats.todayTotal && headerStats.todayTotal > 0 ? 'success' : 'default'} variant="outlined" sx={{ fontSize: '0.6rem', height: 20, '& .MuiChip-icon': { fontSize: 11 } }} />
                <Chip label={now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 20, ml: 'auto', borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary' }} />
              </Box>
            )}
          </Paper>

          {/* ── Conteúdo da aba ────────────────────────── */}
          <Box
            key={tab}
            sx={{
              flex: 1, overflow: 'auto',
              '@keyframes tabEnter': {
                from: { opacity: 0, transform: 'translateY(14px) scale(0.988)' },
                to:   { opacity: 1, transform: 'translateY(0) scale(1)' },
              },
              animation: 'tabEnter 0.4s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            <ErrorBoundary tabName={navItems[tab]?.label}>
              <Suspense fallback={
                <Box sx={{ p: { xs: 1.5, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {/* Header skeleton */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    {[140, 90, 110].map((w, i) => (
                      <Skeleton key={i} variant="rounded" width={w} height={30}
                        sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, animationDelay: `${i * 80}ms` }} />
                    ))}
                  </Box>
                  {/* Card skeletons com bordas coloridas simulando clientes */}
                  {(['rgba(255,144,57,0.5)','rgba(59,142,255,0.5)','rgba(0,196,122,0.5)','rgba(192,132,252,0.5)','rgba(251,113,133,0.5)','rgba(255,215,0,0.5)'].map((color, i) => (
                    <Box key={i} sx={{
                      p: 1.5, borderRadius: 2, borderLeft: `4px solid ${color}`,
                      bgcolor: `${color.slice(0,-4)}0d)`.replace('rgba(','rgba(').replace(',0.5,','0d,'),
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      animation: `fadeInUp 0.25s ease ${i * 45}ms both`,
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
                        <Skeleton variant="rounded" width={90} height={12} sx={{ bgcolor: `${color}`, opacity: 0.3, borderRadius: 1 }} />
                        <Box sx={{ flex: 1 }} />
                        <Skeleton variant="rounded" width={60} height={20} sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 4 }} />
                      </Box>
                      <Skeleton variant="text" width={`${55 + i * 7}%`} height={16} sx={{ bgcolor: 'rgba(255,255,255,0.07)' }} />
                      <Skeleton variant="text" width={`${30 + i * 5}%`} height={13} sx={{ bgcolor: 'rgba(255,255,255,0.04)', mt: 0.3 }} />
                    </Box>
                  )))}
                </Box>
              }>
                <Box key={tab} sx={{
                  flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
                  animation: 'fadeInScale 0.18s cubic-bezier(0.16,1,0.3,1) both',
                }}>
                  {renderTab()}
                </Box>
                {tvMode && (
                  <Suspense fallback={null}>
                    <TVMode
                      items={allItems}
                      states={states}
                      allClients={allClients}
                      now={now}
                      onClose={() => setTvMode(false)}
                    />
                  </Suspense>
                )}
              </Suspense>
            </ErrorBoundary>
          </Box>

          {/* ── Navegação inferior (mobile only — primeiros 6) ─── */}
          {!isDesktop && (
            <Paper elevation={8} square sx={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(9,10,15,0.99)',
            }}>
              <BottomNavigation
                showLabels
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{
                  bgcolor: 'transparent', height: 68,
                }}
              >
                {navItems.map((navItem, idx) => {
                  if (navItem.mobileOnly || navItem.hidden || navItem.mobileHidden) return null
                  const selected = tab === idx
                  const badgeCount = navBadges[idx] ?? 0
                  return (
                    <BottomNavigationAction
                      key={navItem.label}
                      label={navItem.label}
                      value={idx}
                      icon={
                        badgeCount > 0 && !selected ? (
                          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                            {navItem.icon}
                            <Box sx={{
                              position: 'absolute', top: -4, right: -6,
                              minWidth: 14, height: 14, borderRadius: 7, px: 0.3,
                              bgcolor: idx === 2 ? '#FF4545' : 'primary.main',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Typography sx={{ fontSize: '0.42rem', fontWeight: 900, color: '#000', lineHeight: 1 }}>
                                {badgeCount > 9 ? '9+' : badgeCount}
                              </Typography>
                            </Box>
                          </Box>
                        ) : navItem.icon
                      }
                      sx={{
                        minWidth: 0, px: 0.5,
                        color: selected ? 'primary.main' : 'rgba(255,255,255,0.35)',
                        transition: 'color 0.2s',
                        '& .MuiBottomNavigationAction-label': {
                          fontSize: '0.55rem',
                          fontWeight: 800,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          mt: 0.4,
                          opacity: selected ? '1 !important' : '0 !important',
                          maxHeight: selected ? 16 : 0,
                          overflow: 'hidden',
                          transition: 'opacity 0.2s, max-height 0.2s',
                          ...(selected && { color: '#ff9039' }),
                        },
                        '& .MuiSvgIcon-root': {
                          fontSize: selected ? '1.5rem' : '1.4rem',
                          transition: 'all 0.2s',
                          ...(selected && { color: '#ff9039' }),
                        },
                        '&.Mui-selected': { color: 'primary.main' },
                      }}
                    />
                  )
                })}
              </BottomNavigation>
            </Paper>
          )}
        </Box>

        {/* ── Command Bar (⌘K) ──────────────────────────── */}
        <Suspense fallback={null}>
          <CommandBar
            open={cmdOpen}
            onClose={() => setCmdOpen(false)}
            items={allItems}
            states={states}
            allClients={allClients}
            currentUser={currentUser}
            onTabChange={(t) => { setTab(t); setCmdOpen(false) }}
            onStatusChange={setStatus}
            onOpenReport={() => { setReportInitialClient(undefined); setReportOpen(true); setCmdOpen(false) }}
            onOpenReportClient={(name) => { setReportInitialClient(name); setReportOpen(true); setCmdOpen(false) }}
            onOpenAI={() => { setScaleAIOpen(true); setCmdOpen(false) }}
          />
        </Suspense>

        {/* ── Relatório Mensal ─────────────────────────── */}
        <MonthlyReportModal
          open={reportOpen}
          onClose={() => { setReportOpen(false); setReportInitialClient(undefined) }}
          items={allItems}
          states={states}
          allClients={allClients}
          clientPhones={clientPhones}
          now={now}
          initialClient={reportInitialClient}
        />

        {/* ── Relatório Visual WhatsApp ─────────────────── */}
        <Suspense fallback={null}>
          <WhatsAppReportCard
            open={waReportOpen}
            onClose={() => setWaReportOpen(false)}
            items={allItems}
            states={states}
            allClients={allClients}
            clientPhones={clientPhones}
            now={now}
          />
        </Suspense>

        {/* ── ClientFocusModal ─────────────────────────── */}
        <ClientFocusModal
          client={focusClient ? (allClients.find(c => c.name === focusClient) ?? null) : null}
          items={allItems}
          states={states}
          clientFolders={clientFolders}
          clientColors={clientColors}
          onClose={() => setFocusClient(null)}
          onStatusChange={setStatus}
          onUpdate={updateItem}
          onDelete={deleteItem}
          onEdit={editItem}
          onDuplicate={duplicateItem}
          now={now}
        />

        {/* ── Agente IA ─────────────────────────────────── */}
        <AIAgent
          context={aiContext}
          roteiros={roteiros}
          onDistribute={clientName => redistributeClient(clientName, now.getFullYear(), now.getMonth())}
          onClearDistribution={clientName => clearDistribution(clientName, now.getFullYear(), now.getMonth())}
          onCreateAndDistribute={createAndDistributeMany}
        />

        {/* ── Alerta: cliente reprovou criativo ────────────── */}
        {clientNotifs.map((n, i) => (
          <Snackbar
            key={n.id}
            open
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            sx={{ top: `${72 + i * 64}px !important` }}
            onClose={() => setClientNotifs(prev => prev.filter(p => p.id !== n.id))}
            autoHideDuration={12000}
          >
            <Alert
              severity="error"
              variant="filled"
              onClose={() => setClientNotifs(prev => prev.filter(p => p.id !== n.id))}
              action={
                <Button size="small" color="inherit" sx={{ fontWeight: 700, fontSize: '0.68rem' }}
                  onClick={() => { setTab(3); setClientNotifs(prev => prev.filter(p => p.id !== n.id)) }}>
                  Ver Kanban
                </Button>
              }
              sx={{ fontSize: '0.75rem', alignItems: 'center' }}
            >
              ⚠️ Cliente reprovou: <strong>{n.title}</strong>
            </Alert>
          </Snackbar>
        ))}

        {/* ── Prompt de notificação ─────────────────────── */}
        <Snackbar
          open={showNotifPrompt}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{ top: '72px !important' }}
        >
          <Alert
            severity="info"
            icon={<NotificationsActiveIcon fontSize="small" />}
            action={
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button size="small" color="inherit" onClick={() => setShowNotifPrompt(false)}>Agora não</Button>
                <Button
                  size="small" variant="contained" color="primary"
                  onClick={() => {
                    Notification.requestPermission().then(p => {
                      setNotifPermission(p)
                      setShowNotifPrompt(false)
                      if (p === 'granted') {
                        // Dispara uma notificação de boas-vindas imediatamente
                        setTimeout(() => {
                          new Notification('🔔 DS HUB — notificações ativas!', {
                            body: 'Você receberá um resumo personalizado todo dia às 7h.',
                            icon: '/logo.png',
                            tag: 'ds-hub-welcome',
                          })
                        }, 1000)
                      }
                    })
                  }}
                  sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                >
                  Ativar
                </Button>
              </Box>
            }
            sx={{ fontSize: '0.72rem', alignItems: 'center' }}
          >
            {currentUser
              ? `Ativar resumo diário às 7h, ${currentUser.charAt(0).toUpperCase() + currentUser.slice(1)}?`
              : 'Ativar notificações diárias às 7h?'
            }
          </Alert>
        </Snackbar>

        {/* ── Toast WhatsApp ────────────────────────────── */}
        <Snackbar
          open={!!snack}
          autoHideDuration={4500}
          onClose={() => setSnack(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snack?.severity ?? 'info'} onClose={() => setSnack(null)} sx={{ fontSize: '0.78rem', fontWeight: 600 }}>
            {snack?.msg}
          </Alert>
        </Snackbar>

        {/* ── WhatsApp alert: aprovação/reprovação do cliente ── */}
        <Snackbar
          open={!!waAlert}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          onClose={() => setWaAlert(null)}
          autoHideDuration={18000}
          sx={{ bottom: { xs: 80, md: 24 } }}
        >
          <Alert
            onClose={() => setWaAlert(null)}
            severity="info"
            icon={false}
            sx={{
              bgcolor: `${waAlert?.color ?? '#00C47A'}14`,
              border: `1.5px solid ${waAlert?.color ?? '#00C47A'}40`,
              color: waAlert?.color,
              fontWeight: 700,
              fontSize: '0.78rem',
              alignItems: 'center',
              '.MuiAlert-message': { display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' },
            }}
            action={
              <Button
                size="small"
                onClick={() => { window.open(waAlert?.waUrl, '_blank', 'noopener,noreferrer'); setWaAlert(null) }}
                sx={{
                  fontWeight: 800, fontSize: '0.68rem', py: 0.4, px: 1.2,
                  bgcolor: `${waAlert?.color ?? '#00C47A'}20`,
                  color: waAlert?.color,
                  border: `1px solid ${waAlert?.color ?? '#00C47A'}40`,
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: `${waAlert?.color ?? '#00C47A'}32` },
                }}
              >
                {waAlert?.label}
              </Button>
            }
          >
            {waAlert?.color === '#FF4545' ? '⚠️ Cliente reprovou um conteúdo' : '✅ Cliente aprovou um conteúdo!'}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  )
}
