/* lib/health.ts — Saúde do Cliente / Customer Health
   Health Score manual (0–100) + campos qualitativos + histórico de alterações.
   Persistência: sm_customer_health (Record por cliente) e sm_health_history (lista).
   A arquitetura separa avaliação manual (CustomerHealth) dos insumos automáticos
   (futuro Customer Health Index — ver computeAutoIndexInputs).
*/

import { syncToCloud } from './storage'
import type { ContentItem, ItemState } from '../types'
import { isOpenStatus } from '../types'
import { DS } from '../theme'

// ── Tipos ──────────────────────────────────────────────────
export type HealthClassKey = 'excelente' | 'atencao' | 'risco' | 'critico'

export interface CustomerHealth {
  clientName: string
  score: number                    // 0–100
  communication?: string
  responseTime?: string
  engagement?: string
  contentApproval?: string
  relationship?: string
  renewalPotential?: string
  notes?: string
  updatedBy?: string
  updatedAt?: number
  createdAt: number
}

export interface HealthHistoryEntry {
  id: string
  clientName: string
  oldScore: number | null
  newScore: number
  changedFields: string[]
  notes?: string
  updatedBy: string
  ts: number
}

// ── Classificação ──────────────────────────────────────────
export const HEALTH_CLASSES: Record<HealthClassKey, { label: string; color: string; emoji: string; min: number }> = {
  excelente: { label: 'Excelente', color: DS.green, emoji: '🟢', min: 90 },
  atencao:   { label: 'Atenção',   color: DS.amber, emoji: '🟡', min: 70 },
  risco:     { label: 'Risco',     color: DS.orangeDim, emoji: '🟠', min: 50 },
  critico:   { label: 'Crítico',   color: DS.red, emoji: '🔴', min: 0 },
}

export function classifyHealth(score: number): HealthClassKey {
  if (score >= 90) return 'excelente'
  if (score >= 70) return 'atencao'
  if (score >= 50) return 'risco'
  return 'critico'
}

// ── Opções dos campos qualitativos ─────────────────────────
export const HEALTH_FIELDS: Array<{ key: keyof CustomerHealth & string; label: string; options: string[] }> = [
  { key: 'communication',   label: 'Comunicação',                options: ['Excelente', 'Boa', 'Regular', 'Ruim'] },
  { key: 'responseTime',    label: 'Tempo de resposta',          options: ['Muito rápido', 'Normal', 'Demorado', 'Muito demorado'] },
  { key: 'engagement',      label: 'Engajamento',                options: ['Participativo', 'Normal', 'Pouco participativo', 'Sem participação'] },
  { key: 'contentApproval', label: 'Aprovação dos conteúdos',    options: ['Sempre aprova', 'Alguns ajustes', 'Muitos ajustes', 'Sempre reprova'] },
  { key: 'relationship',    label: 'Relacionamento',             options: ['Excelente', 'Bom', 'Regular', 'Ruim'] },
  { key: 'renewalPotential', label: 'Potencial de renovação',    options: ['Muito alto', 'Alto', 'Médio', 'Baixo'] },
]

export const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  HEALTH_FIELDS.map(f => [f.key, f.label]),
)

// ── Persistência ───────────────────────────────────────────
export const HEALTH_KEY = 'sm_customer_health'
export const HEALTH_HISTORY_KEY = 'sm_health_history'

export function loadHealth(): Record<string, CustomerHealth> {
  try {
    const raw = JSON.parse(localStorage.getItem(HEALTH_KEY) ?? '{}') as Record<string, CustomerHealth>
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

export function saveHealth(map: Record<string, CustomerHealth>) {
  localStorage.setItem(HEALTH_KEY, JSON.stringify(map))
  syncToCloud(HEALTH_KEY, map)
}

export function loadHealthHistory(): HealthHistoryEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HEALTH_HISTORY_KEY) ?? '[]') as HealthHistoryEntry[]
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function saveHealthHistory(list: HealthHistoryEntry[]) {
  const capped = list.slice(0, 500)
  localStorage.setItem(HEALTH_HISTORY_KEY, JSON.stringify(capped))
  syncToCloud(HEALTH_HISTORY_KEY, capped)
}

// ── Mutações ───────────────────────────────────────────────
/** Cliente novo entra no onboarding com Health Score 100. */
export function initHealthForClient(clientName: string, user: string): CustomerHealth {
  const map = loadHealth()
  if (map[clientName]) return map[clientName]
  const now = Date.now()
  const rec: CustomerHealth = { clientName, score: 100, createdAt: now, updatedAt: now, updatedBy: user }
  saveHealth({ ...map, [clientName]: rec })
  const hist = loadHealthHistory()
  saveHealthHistory([{
    id: `hh_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    clientName, oldScore: null, newScore: 100,
    changedFields: ['score'], notes: 'Cliente novo — score inicial do onboarding',
    updatedBy: user, ts: now,
  }, ...hist])
  return rec
}

export interface HealthPatch {
  score: number
  communication?: string
  responseTime?: string
  engagement?: string
  contentApproval?: string
  relationship?: string
  renewalPotential?: string
  notes?: string
}

/** Atualiza a saúde do cliente e registra a mudança no histórico. */
export function updateHealth(clientName: string, patch: HealthPatch, user: string): CustomerHealth {
  const map = loadHealth()
  const prev = map[clientName]
  const now = Date.now()

  const changedFields: string[] = []
  if (!prev || prev.score !== patch.score) changedFields.push('score')
  for (const f of HEALTH_FIELDS) {
    const key = f.key as keyof HealthPatch
    if ((prev?.[f.key as keyof CustomerHealth] ?? undefined) !== (patch[key] ?? undefined)) changedFields.push(f.key)
  }
  if ((prev?.notes ?? '') !== (patch.notes ?? '')) changedFields.push('notes')

  const rec: CustomerHealth = {
    clientName,
    score: Math.max(0, Math.min(100, Math.round(patch.score))),
    communication: patch.communication,
    responseTime: patch.responseTime,
    engagement: patch.engagement,
    contentApproval: patch.contentApproval,
    relationship: patch.relationship,
    renewalPotential: patch.renewalPotential,
    notes: patch.notes,
    updatedBy: user,
    updatedAt: now,
    createdAt: prev?.createdAt ?? now,
  }
  saveHealth({ ...map, [clientName]: rec })

  saveHealthHistory([{
    id: `hh_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    clientName,
    oldScore: prev?.score ?? null,
    newScore: rec.score,
    changedFields,
    notes: patch.notes,
    updatedBy: user,
    ts: now,
  }, ...loadHealthHistory()])

  return rec
}

// ── Resumo p/ Dashboard ────────────────────────────────────
export interface HealthSummary {
  avg: number | null
  counts: Record<HealthClassKey, number>
  total: number
  stale30d: number     // sem atualização há 30+ dias
}

export function computeHealthSummary(now: Date): HealthSummary {
  const records = Object.values(loadHealth())
  const counts: Record<HealthClassKey, number> = { excelente: 0, atencao: 0, risco: 0, critico: 0 }
  let sum = 0
  let stale30d = 0
  for (const r of records) {
    counts[classifyHealth(r.score)]++
    sum += r.score
    if (now.getTime() - (r.updatedAt ?? r.createdAt) > 30 * 86_400_000) stale30d++
  }
  return {
    avg: records.length > 0 ? Math.round(sum / records.length) : null,
    counts,
    total: records.length,
    stale30d,
  }
}

// ── Estrutura preparada p/ Customer Health Index automático ─
// Insumos calculados a partir da operação; hoje são apenas expostos (não alteram
// o score manual). No futuro, um peso combinará estes valores + avaliação manual.
export interface AutoIndexInputs {
  avgApprovalDays: number | null   // tempo médio de aprovação
  rejectedCount: number            // conteúdos reprovados (60d)
  daysSinceClientContact: number | null
  agencyLateCount: number          // atrasos de entrega da agência
  interactionCount: number         // interações registradas (comentários do cliente)
}

export function computeAutoIndexInputs(
  clientName: string,
  items: ContentItem[],
  states: Record<number, ItemState>,
  now: Date,
): AutoIndexInputs {
  const sixtyDaysAgo = now.getTime() - 60 * 86_400_000
  const recent = items.filter(i => i.c === clientName && new Date(i.dt).getTime() >= sixtyDaysAgo)

  const approvalTimes: number[] = []
  let lastContact = 0
  let interactionCount = 0
  let rejectedCount = 0
  let agencyLateCount = 0

  for (const it of recent) {
    const st = states[it.i]
    const status = st?.status ?? it.s
    if (status === 6) rejectedCount++
    if (isOpenStatus(status) && new Date(it.dt) < now) agencyLateCount++
    if (st?.sentToClientAt && st?.approvedByClientAt && st.approvedByClientAt > st.sentToClientAt) {
      approvalTimes.push(st.approvedByClientAt - st.sentToClientAt)
    }
    if (st?.approvedByClientAt) lastContact = Math.max(lastContact, st.approvedByClientAt)
    for (const c of st?.comments ?? []) {
      if (c.authorType === 'client') {
        interactionCount++
        lastContact = Math.max(lastContact, c.createdAt)
      }
    }
  }

  return {
    avgApprovalDays: approvalTimes.length > 0
      ? Math.round((approvalTimes.reduce((a, b) => a + b, 0) / approvalTimes.length / 86_400_000) * 10) / 10
      : null,
    rejectedCount,
    daysSinceClientContact: lastContact > 0
      ? Math.floor((now.getTime() - lastContact) / 86_400_000)
      : null,
    agencyLateCount,
    interactionCount,
  }
}
