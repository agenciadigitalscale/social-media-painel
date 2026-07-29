/* lib/onboarding.ts — Módulo de Onboarding de clientes (15 dias)
   Modelo, template de etapas, persistência (sm_onboardings) e cálculos derivados.
   Progresso e status de etapa são SEMPRE derivados do checklist — nunca editados à mão.
*/

import { syncToCloud } from './storage'
import { DS } from '../theme'

// ── Tipos ──────────────────────────────────────────────────
export type OnboardingStepStatus =
  | 'nao_iniciada'
  | 'em_andamento'
  | 'concluida'
  | 'atrasada'
  | 'aguardando_cliente'

export interface OnboardingCheckItem {
  id: string
  title: string
  completed: boolean
  completedAt?: number
  completedBy?: string
}

export interface OnboardingStep {
  id: string
  title: string
  emoji: string
  responsible: string       // rótulo exibido ("Robgol", "Equipe Criativa"…)
  responsibleKey?: string   // key do NAME_MAP — usado no Meu Dia e nos alertas
  startDay: number          // dia do onboarding em que a etapa começa (1-based)
  deadlineDay: number       // dia limite da etapa
  order: number
  waitingClient?: boolean   // override manual: "Aguardando cliente"
  checklist: OnboardingCheckItem[]
}

export interface OnboardingEvent {
  ts: number
  user: string
  stepTitle: string
  action: string
}

export type OnboardingStatus = 'ativo' | 'concluido'

export interface Onboarding {
  id: string
  clientName: string
  segment?: string
  status: OnboardingStatus
  startDate: number
  deadlineDays: number      // 15
  completedDate?: number
  generalResponsible: string // key do NAME_MAP
  notes: string
  files: string[]           // links de arquivos relacionados
  history: OnboardingEvent[]
  createdAt: number
  updatedAt: number
}

// ── Config visual dos status de etapa ──────────────────────
export const STEP_STATUS_CONFIG: Record<OnboardingStepStatus, { label: string; color: string; emoji: string }> = {
  nao_iniciada:       { label: 'Não iniciada',       color: DS.neutral, emoji: '⏳' },
  em_andamento:       { label: 'Em andamento',       color: DS.amber, emoji: '✏️' },
  concluida:          { label: 'Concluída',          color: DS.green, emoji: '✅' },
  atrasada:           { label: 'Atrasada',           color: DS.red, emoji: '🚨' },
  aguardando_cliente: { label: 'Aguardando cliente', color: '#60A5FA', emoji: '💬' },
}

export const ONBOARDING_DEADLINE_DAYS = 15
export const ONBOARDING_KEY = 'sm_onboardings'

const MS_PER_DAY = 86_400_000

// ── Template das 10 etapas ─────────────────────────────────
// responsible: rótulo visual · responsibleKey: só quando existe no NAME_MAP
interface StepTemplate {
  title: string
  emoji: string
  responsible: string
  responsibleKey?: string
  startDay: number
  deadlineDay: number
  checklist: string[]
}

const STEP_TEMPLATES: StepTemplate[] = [
  {
    title: 'Boas-vindas', emoji: '👋', responsible: 'Robgol', responsibleKey: 'robson',
    startDay: 1, deadlineDay: 1,
    checklist: ['Criar grupo no WhatsApp', 'Iniciar conversa com cliente'],
  },
  {
    title: 'Briefing e Contrato', emoji: '📋', responsible: 'Testa', responsibleKey: 'testa',
    startDay: 1, deadlineDay: 3,
    checklist: ['Enviar briefing', 'Receber briefing preenchido', 'Gerar contrato', 'Enviar contrato', 'Receber contrato assinado'],
  },
  {
    title: 'Estrutura Digital', emoji: '🏗️', responsible: 'Arthur', responsibleKey: 'arthur',
    startDay: 2, deadlineDay: 5,
    checklist: ['Criar pasta Drive', 'Organizar Instagram', 'Organizar Facebook', 'Configurar Meta Business', 'Organizar acessos'],
  },
  {
    title: 'Tráfego Pago', emoji: '📈', responsible: 'Robgol', responsibleKey: 'robson',
    startDay: 3, deadlineDay: 6,
    checklist: ['Vincular conta de anúncios', 'Conferir permissões', 'Testar acessos'],
  },
  {
    title: 'Estratégia Inicial', emoji: '🧠', responsible: 'Mateus', responsibleKey: 'testa',
    startDay: 5, deadlineDay: 9,
    checklist: ['Analisar briefing', 'Criar estratégia', 'Criar cronograma', 'Produzir primeiros roteiros'],
  },
  {
    title: 'Agendamento', emoji: '📅', responsible: 'Arthur', responsibleKey: 'arthur',
    startDay: 8, deadlineDay: 10,
    checklist: ['Agendar gravação', 'Confirmar data', 'Confirmar horário', 'Confirmar local'],
  },
  {
    title: 'Captação', emoji: '🎥', responsible: 'Equipe de Produção',
    startDay: 10, deadlineDay: 12,
    checklist: ['Realizar gravação', 'Fazer backup'],
  },
  {
    title: 'Organização dos Arquivos', emoji: '🗂️', responsible: 'Arthur', responsibleKey: 'arthur',
    startDay: 12, deadlineDay: 12,
    checklist: ['Subir materiais para o Drive', 'Organizar pastas', 'Vincular materiais ao cliente'],
  },
  {
    title: 'Produção dos Conteúdos', emoji: '🎨', responsible: 'Equipe Criativa',
    startDay: 12, deadlineDay: 14,
    checklist: ['Produzir artes', 'Editar vídeos', 'Revisão interna'],
  },
  {
    title: 'Aprovação e Programação', emoji: '🚀', responsible: 'Arthur', responsibleKey: 'arthur',
    startDay: 13, deadlineDay: 15,
    checklist: ['Enviar para aprovação', 'Realizar ajustes', 'Programar publicações'],
  },
]

// ── Persistência ───────────────────────────────────────────
export function loadOnboardings(): Onboarding[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? '[]') as Onboarding[]
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function saveOnboardings(list: Onboarding[]) {
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(list))
  syncToCloud(ONBOARDING_KEY, list)
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// ── Criação automática ─────────────────────────────────────
export function buildOnboarding(clientName: string, user: string, segment?: string): Onboarding {
  const now = Date.now()
  return {
    id: uid('ob'),
    clientName,
    segment,
    status: 'ativo',
    startDate: now,
    deadlineDays: ONBOARDING_DEADLINE_DAYS,
    generalResponsible: 'robson',
    notes: '',
    files: [],
    history: [{
      ts: now, user, stepTitle: '—',
      action: `Onboarding criado automaticamente — prazo de ${ONBOARDING_DEADLINE_DAYS} dias`,
    }],
    createdAt: now,
    updatedAt: now,
  }
}

/** Cria (se não existir um ativo) o onboarding do cliente e persiste. */
export function createOnboardingForClient(clientName: string, user: string, segment?: string): Onboarding | null {
  const list = loadOnboardings()
  if (list.some(o => o.clientName === clientName && o.status === 'ativo')) return null
  const ob = buildOnboarding(clientName, user, segment)
  saveOnboardings([ob, ...list])
  return ob
}

// ── Steps: gerados pelo template, derivados por onboarding ─
// O checklist marcado fica em ob (via stepState em sm_onboardings). Para manter o
// modelo simples e sincronizável, os steps são armazenados dentro do onboarding.
export function buildSteps(): OnboardingStep[] {
  return STEP_TEMPLATES.map((t, idx) => ({
    id: `step_${idx + 1}`,
    title: t.title,
    emoji: t.emoji,
    responsible: t.responsible,
    responsibleKey: t.responsibleKey,
    startDay: t.startDay,
    deadlineDay: t.deadlineDay,
    order: idx + 1,
    checklist: t.checklist.map((c, ci) => ({
      id: `chk_${idx + 1}_${ci + 1}`,
      title: c,
      completed: false,
    })),
  }))
}

// Steps ficam embutidos no onboarding — retrocompatível caso não existam ainda
export interface OnboardingWithSteps extends Onboarding {
  steps: OnboardingStep[]
}

export function ensureSteps(ob: Onboarding): OnboardingWithSteps {
  const anyOb = ob as OnboardingWithSteps
  if (!Array.isArray(anyOb.steps) || anyOb.steps.length === 0) {
    return { ...ob, steps: buildSteps() }
  }
  return anyOb
}

// ── Cálculos derivados ─────────────────────────────────────
export function currentDay(ob: Onboarding, now: Date): number {
  return Math.max(1, Math.floor((now.getTime() - ob.startDate) / MS_PER_DAY) + 1)
}

export function remainingDays(ob: Onboarding, now: Date): number {
  return ob.deadlineDays - currentDay(ob, now)
}

export function deadlineDate(ob: Onboarding): Date {
  return new Date(ob.startDate + (ob.deadlineDays - 1) * MS_PER_DAY)
}

export function progressPct(ob: OnboardingWithSteps): number {
  const all = ob.steps.flatMap(s => s.checklist)
  if (all.length === 0) return 0
  return Math.round((all.filter(c => c.completed).length / all.length) * 100)
}

export function stepsDone(ob: OnboardingWithSteps): number {
  return ob.steps.filter(s => s.checklist.every(c => c.completed)).length
}

export function stepStatus(step: OnboardingStep, ob: Onboarding, now: Date): OnboardingStepStatus {
  const allDone = step.checklist.length > 0 && step.checklist.every(c => c.completed)
  if (allDone) return 'concluida'
  if (step.waitingClient) return 'aguardando_cliente'
  const day = currentDay(ob, now)
  if (ob.status === 'ativo' && day > step.deadlineDay) return 'atrasada'
  if (step.checklist.some(c => c.completed) || day >= step.startDay) return 'em_andamento'
  return 'nao_iniciada'
}

export function isLate(ob: OnboardingWithSteps, now: Date): boolean {
  if (ob.status !== 'ativo') return false
  if (currentDay(ob, now) > ob.deadlineDays) return true
  return ob.steps.some(s => stepStatus(s, ob, now) === 'atrasada')
}

export function lastActivityTs(ob: Onboarding): number {
  return ob.history.length > 0 ? Math.max(...ob.history.map(h => h.ts)) : ob.createdAt
}

// ── Mutações (sempre registram histórico) ──────────────────
export function toggleCheckItem(
  ob: OnboardingWithSteps,
  stepId: string,
  itemId: string,
  user: string,
): OnboardingWithSteps {
  const now = Date.now()
  let stepTitle = ''
  let itemTitle = ''
  let nowCompleted = false

  const steps = ob.steps.map(s => {
    if (s.id !== stepId) return s
    stepTitle = s.title
    return {
      ...s,
      checklist: s.checklist.map(c => {
        if (c.id !== itemId) return c
        itemTitle = c.title
        nowCompleted = !c.completed
        return nowCompleted
          ? { ...c, completed: true, completedAt: now, completedBy: user }
          : { ...c, completed: false, completedAt: undefined, completedBy: undefined }
      }),
    }
  })

  let next: OnboardingWithSteps = {
    ...ob,
    steps,
    updatedAt: now,
    history: [
      { ts: now, user, stepTitle, action: `${nowCompleted ? '✅ Concluiu' : '↩️ Desmarcou'}: ${itemTitle}` },
      ...ob.history,
    ].slice(0, 300),
  }

  // Finalização automática: todas as etapas concluídas → Onboarding Concluído
  const allDone = next.steps.every(s => s.checklist.every(c => c.completed))
  if (allDone && next.status === 'ativo') {
    const totalDays = Math.max(1, Math.ceil((now - next.startDate) / MS_PER_DAY))
    next = {
      ...next,
      status: 'concluido',
      completedDate: now,
      history: [
        { ts: now, user, stepTitle: '—', action: `🎉 Onboarding concluído em ${totalDays} dia${totalDays > 1 ? 's' : ''} — cliente movido para Operação Ativa` },
        ...next.history,
      ].slice(0, 300),
    }
  } else if (!allDone && next.status === 'concluido') {
    // Reabriu um item — volta a ativo
    next = { ...next, status: 'ativo', completedDate: undefined }
  }

  return next
}

export function setStepWaitingClient(
  ob: OnboardingWithSteps,
  stepId: string,
  waiting: boolean,
  user: string,
): OnboardingWithSteps {
  const now = Date.now()
  const step = ob.steps.find(s => s.id === stepId)
  return {
    ...ob,
    steps: ob.steps.map(s => (s.id === stepId ? { ...s, waitingClient: waiting } : s)),
    updatedAt: now,
    history: [
      { ts: now, user, stepTitle: step?.title ?? '', action: waiting ? '💬 Marcada como "Aguardando cliente"' : '▶️ Retomada pela equipe' },
      ...ob.history,
    ].slice(0, 300),
  }
}

/** Atualiza um onboarding dentro da lista persistida. */
export function upsertOnboarding(updated: Onboarding) {
  const list = loadOnboardings()
  const idx = list.findIndex(o => o.id === updated.id)
  const next = idx >= 0 ? list.map(o => (o.id === updated.id ? updated : o)) : [updated, ...list]
  saveOnboardings(next)
}

export function removeOnboarding(id: string) {
  saveOnboardings(loadOnboardings().filter(o => o.id !== id))
}

// ── Time e comando do onboarding ───────────────────────────
// robson comanda o onboarding: acesso total (excluir/alterar/editar).
export const ONBOARDING_LEAD = 'robson'

// Estes usuários acompanham TODO o onboarding: cada atualização aparece no
// Meu Dia dos três, não só nas etapas atribuídas à sua própria chave.
// (Mateus = testa — mesma pessoa; a etapa "Estratégia Inicial" cai no painel dele.)
export const ONBOARDING_TEAM = ['robson', 'arthur', 'testa']

/** robson (líder) manda em tudo no onboarding, além dos admins (socio/head). */
export function canManageOnboarding(user: string): boolean {
  return user === ONBOARDING_LEAD
}

// ── Tarefas do dia (integração Meu Dia) ────────────────────
export interface OnboardingTask {
  onboardingId: string
  clientName: string
  stepId: string
  stepTitle: string
  stepEmoji: string
  itemId: string
  itemTitle: string
  responsible: string
  responsibleKey?: string
  dueLabel: 'Hoje' | 'Atrasado'
}

/** Itens de checklist pendentes cuja etapa vence hoje ou já venceu, para o usuário. */
export function onboardingTasksForUser(user: string, now: Date): OnboardingTask[] {
  const tasks: OnboardingTask[] = []
  const isTeam = ONBOARDING_TEAM.includes(user)
  for (const raw of loadOnboardings()) {
    if (raw.status !== 'ativo') continue
    const ob = ensureSteps(raw)
    const day = currentDay(ob, now)
    for (const step of ob.steps) {
      // O time do onboarding (robson/arthur/mateus) vê todas as etapas;
      // os demais só as etapas atribuídas à própria chave.
      if (!isTeam && step.responsibleKey !== user) continue
      if (step.waitingClient) continue
      if (day < step.startDay) continue
      const overdue = day > step.deadlineDay
      for (const item of step.checklist) {
        if (item.completed) continue
        tasks.push({
          onboardingId: ob.id,
          clientName: ob.clientName,
          stepId: step.id,
          stepTitle: step.title,
          stepEmoji: step.emoji,
          itemId: item.id,
          itemTitle: item.title,
          responsible: step.responsible,
          responsibleKey: step.responsibleKey,
          dueLabel: overdue ? 'Atrasado' : 'Hoje',
        })
      }
    }
  }
  // Atrasados primeiro
  return tasks.sort((a, b) => (a.dueLabel === b.dueLabel ? 0 : a.dueLabel === 'Atrasado' ? -1 : 1))
}

// ── Resumo p/ Dashboard ────────────────────────────────────
export interface OnboardingSummary {
  active: number
  late: number
  onTime: number
  completedThisMonth: number
  avgDays: number | null      // tempo médio dos concluídos
  completionRate: number      // % concluídos dentro do prazo (entre concluídos)
}

export function computeOnboardingSummary(now: Date): OnboardingSummary {
  const list = loadOnboardings().map(ensureSteps)
  const active = list.filter(o => o.status === 'ativo')
  const late = active.filter(o => isLate(o, now))
  const completed = list.filter(o => o.status === 'concluido' && o.completedDate)
  const completedThisMonth = completed.filter(o => {
    const d = new Date(o.completedDate!)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const durations = completed.map(o => Math.max(1, Math.ceil((o.completedDate! - o.startDate) / MS_PER_DAY)))
  const avgDays = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null
  const onDeadline = completed.filter(o => (o.completedDate! - o.startDate) / MS_PER_DAY <= o.deadlineDays).length
  return {
    active: active.length,
    late: late.length,
    onTime: active.length - late.length,
    completedThisMonth: completedThisMonth.length,
    avgDays,
    completionRate: completed.length > 0 ? Math.round((onDeadline / completed.length) * 100) : 0,
  }
}
