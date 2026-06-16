/* lib/alerts.ts — Motor de alertas internos proativos
   Pura lógica: recebe estado do app, retorna alertas acionáveis por usuário.
   Sem efeitos colaterais fora de leitura de localStorage (financeiro).
*/

import type { ContentItem, ItemState, Client } from '../types'

// ── Tipos ──────────────────────────────────────────────────
export type AlertSeverity = 'critical' | 'warning' | 'info'

export type AlertType =
  | 'design_overdue'
  | 'design_due_soon'
  | 'caption_missing_urgent'
  | 'caption_missing_week'
  | 'ready_to_publish'
  | 'client_approval_24h'
  | 'client_approval_stuck'
  | 'pipeline_overdue'
  | 'financial_overdue'
  | 'client_at_risk'
  | 'weekly_report_pending'

export interface InternalAlert {
  id: string              // key determinístico — inclui a data, expira no dia seguinte
  type: AlertType
  severity: AlertSeverity
  emoji: string
  title: string
  body: string
  ctaLabel?: string
  ctaTab?: number         // índice da aba para navegar ao clicar no CTA
  forUsers?: string[]     // vazio = todos; lista = somente esses usuários
  count: number           // quantos itens disparam esse alerta
}

// ── Helpers internos ───────────────────────────────────────
function todayKey(now: Date) {
  return now.toISOString().slice(0, 10)           // "2026-05-22"
}

function clientList(items: ContentItem[], max = 3): string {
  const names = [...new Set(items.map(i => i.c))]
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max).join(', ')} +${names.length - max}`
}

function hoursAgo(ms: number, now: Date) {
  return Math.round((now.getTime() - ms) / 3_600_000)
}

// ── Computar todos os alertas ──────────────────────────────
export function computeAlerts(
  items:      ContentItem[],
  states:     Record<number, ItemState>,
  allClients: Client[],
  now:        Date,
): InternalAlert[] {
  const alerts: InternalAlert[] = []
  const key    = todayKey(now)
  const nowMs  = now.getTime()

  // Limiares de data
  const today    = new Date(now); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 86_400_000)
  const in2days  = new Date(today.getTime() + 2 * 86_400_000)
  const in7days  = new Date(today.getTime() + 7 * 86_400_000)

  const st = (i: ContentItem): number => states[i.i]?.status ?? i.s

  // Helper: normaliza a data do item para meia-noite local
  const itemDate = (i: ContentItem) => {
    const d = new Date(i.dt); d.setHours(0, 0, 0, 0); return d
  }

  // ── 1. Design atrasado ────────────────────────────────────
  // Status 0 ou 1 (Pendente / Em edição) com data de publicação no passado
  const designOverdue = items.filter(i => st(i) <= 1 && itemDate(i) < today)
  if (designOverdue.length > 0) {
    alerts.push({
      id: `design_overdue_${key}`,
      type: 'design_overdue',
      severity: 'critical',
      emoji: '🔴',
      title: `${designOverdue.length} arte${designOverdue.length > 1 ? 's' : ''} atrasada${designOverdue.length > 1 ? 's' : ''} sem design`,
      body: clientList(designOverdue),
      ctaLabel: 'Ver Design',
      ctaTab: 16,
      forUsers: ['jhones', 'kaique', 'pradox', 'testa'],
      count: designOverdue.length,
    })
  }

  // ── 2. Design sem iniciar — publica amanhã ────────────────
  // Status 0 (Pendente, ninguém tocou) com publicação amanhã
  const designTomorrow = items.filter(i =>
    st(i) === 0 && itemDate(i).getTime() === tomorrow.getTime()
  )
  if (designTomorrow.length > 0) {
    alerts.push({
      id: `design_due_tomorrow_${key}`,
      type: 'design_due_soon',
      severity: 'warning',
      emoji: '🟡',
      title: `${designTomorrow.length} arte${designTomorrow.length > 1 ? 's' : ''} para amanhã sem design iniciado`,
      body: clientList(designTomorrow),
      ctaLabel: 'Ver Design',
      ctaTab: 16,
      forUsers: ['jhones', 'kaique'],
      count: designTomorrow.length,
    })
  }

  // ── 3. Legenda urgente — publica hoje ou amanhã, sem texto ─
  // Status ≥ 1 (design iniciado), caption vazio, publicação em ≤ 2 dias
  const captionUrgent = items.filter(i => {
    const s = st(i)
    const caption = (states[i.i]?.caption ?? '').trim()
    const d = itemDate(i)
    return s >= 1 && s < 7 && caption === '' && d < in2days && d >= today
  })
  if (captionUrgent.length > 0) {
    const today_ct = captionUrgent.filter(i => itemDate(i).getTime() === today.getTime())
    const isCritical = today_ct.length > 0
    alerts.push({
      id: `caption_urgent_${key}`,
      type: 'caption_missing_urgent',
      severity: isCritical ? 'critical' : 'warning',
      emoji: isCritical ? '🔴' : '🟠',
      title: `${captionUrgent.length} legenda${captionUrgent.length > 1 ? 's' : ''} urgente${captionUrgent.length > 1 ? 's' : ''} sem texto`,
      body: isCritical
        ? `${today_ct.length} publicam HOJE — ${clientList(today_ct, 2)}`
        : `Publicam amanhã sem legenda — ${clientList(captionUrgent, 3)}`,
      ctaLabel: 'Escrever',
      ctaTab: 0,  // Meu Dia (Kerges vê a lista com geração IA)
      forUsers: ['kerges', 'arthur', 'kaique'],
      count: captionUrgent.length,
    })
  }

  // ── 4. Legenda em falta — publica nesta semana ────────────
  // Status ≥ 1, caption vazio, publicação em 3-7 dias (não urgente acima)
  const captionWeek = items.filter(i => {
    const s = st(i)
    const caption = (states[i.i]?.caption ?? '').trim()
    const d = itemDate(i)
    return s >= 1 && s < 7 && caption === '' && d >= in2days && d < in7days
  })
  if (captionWeek.length >= 3) {      // só alerta se for volume relevante
    alerts.push({
      id: `caption_week_${key}`,
      type: 'caption_missing_week',
      severity: 'info',
      emoji: '✍️',
      title: `${captionWeek.length} legendas faltando para esta semana`,
      body: clientList(captionWeek),
      ctaLabel: 'Ver lista',
      ctaTab: 0,
      forUsers: ['kerges'],
      count: captionWeek.length,
    })
  }

  // ── 5. Pronto para publicar — cliente aprovado há +24h ────
  // Status 5 (Aprovado pelo cliente), ainda não publicado
  const readyOld = items.filter(i => {
    if (st(i) !== 5) return false
    const approvedAt = states[i.i]?.approvedByClientAt
    if (!approvedAt) return true    // sem timestamp → alerta por precaução
    return (nowMs - approvedAt) > 24 * 3_600_000
  })
  if (readyOld.length > 0) {
    // Encontra o mais antigo para dar contexto
    const oldest = readyOld.reduce((a, b) => {
      const aAt = states[a.i]?.approvedByClientAt ?? 0
      const bAt = states[b.i]?.approvedByClientAt ?? 0
      return aAt < bAt ? a : b
    })
    const oldestAt = states[oldest.i]?.approvedByClientAt
    const hAgo = oldestAt ? hoursAgo(oldestAt, now) : null
    alerts.push({
      id: `ready_to_publish_${key}`,
      type: 'ready_to_publish',
      severity: readyOld.length >= 4 ? 'critical' : 'warning',
      emoji: '🚀',
      title: `${readyOld.length} conteúdo${readyOld.length > 1 ? 's' : ''} aprovado${readyOld.length > 1 ? 's' : ''} pelo cliente aguardando publicação`,
      body: hAgo != null
        ? `Mais antigo: ${oldest.c} (há ${hAgo}h)`
        : clientList(readyOld),
      ctaLabel: 'Publicar',
      ctaTab: 0,
      forUsers: ['arthur', 'kaique', 'pradox', 'testa'],
      count: readyOld.length,
    })
  }

  // ── 6. Aprovação parada — enviado ao cliente há +72h ──────
  // Status 4 (Enviado ao cliente) sem resposta
  const approvalStuck = items.filter(i => {
    if (st(i) !== 4) return false
    const sentAt = states[i.i]?.sentToClientAt
    if (!sentAt) return false
    return (nowMs - sentAt) > 72 * 3_600_000
  })
  if (approvalStuck.length > 0) {
    const longest = approvalStuck.reduce((a, b) => {
      const aAt = states[a.i]?.sentToClientAt ?? nowMs
      const bAt = states[b.i]?.sentToClientAt ?? nowMs
      return aAt < bAt ? a : b
    })
    const longestAt = states[longest.i]?.sentToClientAt
    const hAgo = longestAt ? hoursAgo(longestAt, now) : null
    alerts.push({
      id: `approval_stuck_${key}`,
      type: 'client_approval_stuck',
      severity: 'warning',
      emoji: '⏳',
      title: `${approvalStuck.length} conteúdo${approvalStuck.length > 1 ? 's' : ''} aguardando cliente há +72h`,
      body: hAgo != null
        ? `Mais antigo: ${longest.c} (há ${hAgo}h) — reenviar?`
        : `${clientList(approvalStuck)} — reenviar aprovação?`,
      ctaLabel: 'Ver clientes',
      ctaTab: 6,
      forUsers: ['arthur', 'kaique', 'pradox', 'testa'],
      count: approvalStuck.length,
    })
  }

  // ── 6b. Aprovação parada — enviado ao cliente há 24–71h ───
  // Aviso antecipado para reenviar antes de virar crítico
  const approval24h = items.filter(i => {
    if (st(i) !== 4) return false
    const sentAt = states[i.i]?.sentToClientAt
    if (!sentAt) return false
    const h = (nowMs - sentAt) / 3_600_000
    return h >= 24 && h < 72
  })
  if (approval24h.length > 0) {
    alerts.push({
      id: `approval_24h_${key}`,
      type: 'client_approval_24h',
      severity: 'info',
      emoji: '💬',
      title: `${approval24h.length} cliente${approval24h.length > 1 ? 's' : ''} sem resposta há +24h`,
      body: `${clientList(approval24h)} — considere reenviar o lembrete`,
      ctaLabel: 'Ver clientes',
      ctaTab: 6,
      forUsers: ['kaique', 'pradox', 'testa'],
      count: approval24h.length,
    })
  }

  // ── 6c. Relatório semanal — toda sexta-feira ───────────────
  if (now.getDay() === 5) {   // 5 = sexta-feira
    alerts.push({
      id: `weekly_report_${key}`,
      type: 'weekly_report_pending',
      severity: 'info',
      emoji: '📊',
      title: 'Sexta-feira — hora de enviar o relatório semanal',
      body: 'Acesse cada cliente e envie o resumo da semana',
      ctaLabel: 'Ver clientes',
      ctaTab: 6,
      forUsers: ['kaique', 'pradox', 'testa'],
      count: 1,
    })
  }

  // ── 7. Pipeline geral atrasado ────────────────────────────
  // Muitos conteúdos passaram da data sem publicar
  const pipelineOverdue = items.filter(i => st(i) < 7 && itemDate(i) < today)
  if (pipelineOverdue.length >= 5) {
    const clientCount = new Set(pipelineOverdue.map(i => i.c)).size
    alerts.push({
      id: `pipeline_overdue_${key}`,
      type: 'pipeline_overdue',
      severity: pipelineOverdue.length >= 12 ? 'critical' : 'warning',
      emoji: pipelineOverdue.length >= 12 ? '🔴' : '🟡',
      title: `${pipelineOverdue.length} conteúdos atrasados em ${clientCount} cliente${clientCount > 1 ? 's' : ''}`,
      body: clientList(pipelineOverdue, 4),
      ctaLabel: 'Ver Hoje',
      ctaTab: 1,
      forUsers: ['kaique', 'pradox', 'testa'],
      count: pipelineOverdue.length,
    })
  }

  // ── 8. Financeiro — clientes inadimplentes ────────────────
  // Lê sm_financeiro do localStorage (mesmo padrão de FinanceiroTab)
  try {
    const fin = JSON.parse(
      localStorage.getItem('sm_financeiro') ?? '{}'
    ) as Record<string, { status: string; valor: number }>

    const overdueEntries = Object.entries(fin).filter(([, v]) => v.status === 'atrasado')
    if (overdueEntries.length > 0) {
      const totalDebt = overdueEntries.reduce((s, [, v]) => s + (v.valor || 0), 0)
      const names = overdueEntries.map(([k]) => k)
      alerts.push({
        id: `financial_overdue_${key}`,
        type: 'financial_overdue',
        severity: 'critical',
        emoji: '💸',
        title: `${overdueEntries.length} cliente${overdueEntries.length > 1 ? 's' : ''} com mensalidade atrasada`,
        body: `R$ ${totalDebt.toLocaleString('pt-BR')} em aberto — ${names.slice(0, 3).join(', ')}`,
        ctaLabel: 'Ver Financeiro',
        ctaTab: 11,
        forUsers: ['pradox', 'testa', 'kaique'],
        count: overdueEntries.length,
      })
    }
  } catch { /* localStorage indisponível */ }

  // ── Ordena: critical primeiro, depois warning, depois info ─
  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity])
}

// ── Filtro por usuário ─────────────────────────────────────
export function alertsForUser(alerts: InternalAlert[], user: string): InternalAlert[] {
  return alerts.filter(a => !a.forUsers || a.forUsers.length === 0 || a.forUsers.includes(user))
}

// ── Persistência de dismissal ─────────────────────────────
const DISMISSED_KEY = 'sm_dismissed_alerts'

export function loadDismissed(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as string[]
    return new Set(raw)
  } catch {
    return new Set()
  }
}

export function saveDissmissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]))
}

export function dismissAlert(id: string, current: Set<string>): Set<string> {
  const next = new Set(current)
  next.add(id)
  saveDissmissed(next)
  return next
}

// Remove IDs de alertas de dias anteriores (limpeza automática)
export function pruneOldDismissals(dismissed: Set<string>, activeIds: string[]): Set<string> {
  const today = new Date().toISOString().slice(0, 10)
  const next = new Set<string>()
  for (const id of dismissed) {
    // Mantém somente IDs de hoje (expiram sozinhos amanhã)
    if (id.includes(today) || activeIds.includes(id)) next.add(id)
  }
  return next
}
