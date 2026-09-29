/**
 * Números do Dashboard "Resumo" — um cartão por aba do painel.
 *
 * Tudo aqui é cálculo puro (sem React, sem localStorage) para poder ser testado
 * e para o Dashboard não inventar regra própria: "atrasado" é o mesmo
 * `isRealLate` do Meu Dia e da lista de clientes, e o funil segue o
 * `STATUS_ORDER` oficial.
 */
import type { ContentItem, ItemState, Status } from '../types'
import { STATUS_CONFIG, STATUS_ORDER, isOpenStatus } from '../types'
import { isRealLate } from './todaySignals'

const DAY = 86_400_000
const startOfDay = (d: Date | number) => new Date(d).setHours(0, 0, 0, 0)

export type ClientRisk = 'critico' | 'atencao' | 'saudavel'

/** O mínimo de uma gravação que o resumo lê (o tipo completo vive na RecordingCenter). */
export interface RecordingLite {
  client: string
  title: string
  date: string          // AAAA-MM-DD
  time: string
  status: 'agendado' | 'gravando' | 'gravado' | 'em_edicao' | 'editado' | 'publicado'
}

export interface OnboardingLite {
  active: number
  late: number
  completedThisMonth: number
}

export interface ResumoInput {
  items: ContentItem[]
  states: Record<number, ItemState>
  clientNames: string[]
  recordings: RecordingLite[]
  onboarding: OnboardingLite
  now: Date
}

export interface Resumo {
  kpis: { late: number; dueToday: number; withClient: number; publishedMonth: number }
  pipeline: { status: Status; label: string; color: string; n: number }[]
  monthTotal: number
  week: { label: string; n: number; isToday: boolean }[]
  weekTotal: number
  clients: { total: number; saudavel: number; atencao: number; critico: number }
  recordings: { upcoming: number; editing: number; next: RecordingLite[] }
  onboarding: OnboardingLite
  team: { user: string; n: number }[]
}

/** Mesmos limites do `clientRisk` do App — só a contagem de atraso muda. */
export function clientRiskOf(late: number, reprovados: number): ClientRisk {
  if (late >= 3 || reprovados >= 2) return 'critico'
  if (late >= 1 || reprovados >= 1) return 'atencao'
  return 'saudavel'
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function computeResumo({ items, states, clientNames, recordings, onboarding, now }: ResumoInput): Resumo {
  const today = startOfDay(now)
  const statusOf = (i: ContentItem) => states[i.i]?.status ?? i.s
  const inMonth = (i: ContentItem) => {
    const d = new Date(i.dt)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }

  // ── KPIs do topo ─────────────────────────────────────────────
  let late = 0, dueToday = 0, withClient = 0, publishedMonth = 0
  for (const i of items) {
    const st = statusOf(i)
    if (isRealLate(i, states[i.i], now)) late++
    if (isOpenStatus(st) && startOfDay(i.dt) === today) dueToday++
    if (st === 4) withClient++
    if (st === 7 && inMonth(i)) publishedMonth++
  }

  // ── Funil do mês ─────────────────────────────────────────────
  const monthItems = items.filter(inMonth)
  const byStatus = new Map<Status, number>()
  for (const i of monthItems) byStatus.set(statusOf(i), (byStatus.get(statusOf(i)) ?? 0) + 1)
  const pipeline = STATUS_ORDER.map(status => ({
    status,
    label: STATUS_CONFIG[status].shortLabel,
    color: STATUS_CONFIG[status].color,
    n: byStatus.get(status) ?? 0,
  }))

  // ── Semana (segunda a domingo) ───────────────────────────────
  const dow = (new Date(today).getDay() + 6) % 7 // 0 = segunda
  const monday = today - dow * DAY
  const week = WEEKDAYS.map((label, k) => {
    const dayMs = monday + k * DAY
    const n = items.filter(i => startOfDay(i.dt) === dayMs).length
    return { label, n, isToday: dayMs === today }
  })

  // ── Clientes ─────────────────────────────────────────────────
  // Risco com a regra de atraso DE VERDADE. O `clientRisk` do App conta card
  // semeado que ninguém tocou — no banco local dava os 17 clientes "críticos".
  const lateBy = new Map<string, number>(), fixBy = new Map<string, number>()
  for (const i of items) {
    if (isRealLate(i, states[i.i], now)) lateBy.set(i.c, (lateBy.get(i.c) ?? 0) + 1)
    if (statusOf(i) === 6) fixBy.set(i.c, (fixBy.get(i.c) ?? 0) + 1)
  }
  const clients = { total: clientNames.length, saudavel: 0, atencao: 0, critico: 0 }
  for (const c of clientNames) clients[clientRiskOf(lateBy.get(c) ?? 0, fixBy.get(c) ?? 0)]++

  // ── Gravações ────────────────────────────────────────────────
  const todayIso = new Date(today).toISOString().slice(0, 10)
  const upcomingList = recordings
    .filter(r => r.status === 'agendado' && r.date >= todayIso)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const editing = recordings.filter(r => r.status === 'gravado' || r.status === 'em_edicao').length

  // ── Equipe: carga aberta por responsável ─────────────────────
  const load = new Map<string, number>()
  for (const i of items) {
    const st = states[i.i]
    const who = st?.responsible
    if (!who || !isOpenStatus(statusOf(i))) continue
    load.set(who, (load.get(who) ?? 0) + 1)
  }
  const team = [...load.entries()].map(([user, n]) => ({ user, n })).sort((a, b) => b.n - a.n)

  return {
    kpis: { late, dueToday, withClient, publishedMonth },
    pipeline,
    monthTotal: monthItems.length,
    week,
    weekTotal: week.reduce((a, d) => a + d.n, 0),
    clients,
    recordings: { upcoming: upcomingList.length, editing, next: upcomingList.slice(0, 3) },
    onboarding,
    team,
  }
}
