import type { ContentItem, ItemState } from '../../types'
import { DS } from '../../theme'
import { syncToCloud } from '../../lib/storage'

// ── Smart glow: o card se comunica só pela cor ────────────
// Prioridade (do mais urgente ao contextual) — cada card mostra UM glow dominante.
export type GlowKind = 'atrasado' | 'publica-hoje' | 'respondeu' | 'vip' | 'sem-roteiro' | 'sem-editor' | null

export interface SmartGlow {
  kind: GlowKind
  color: string
  label: string
  pulse: boolean
}

const dayMs = 86_400_000

export function computeGlow(item: ContentItem, s: ItemState, now: Date, vip: boolean): SmartGlow {
  const todayMs = new Date(now).setHours(0, 0, 0, 0)
  const dtMs = new Date(item.dt).setHours(0, 0, 0, 0)
  const status = s.status

  if (status < 7 && dtMs < todayMs)
    return { kind: 'atrasado', color: DS.red, label: 'Atrasado', pulse: true }
  if (status < 7 && dtMs >= todayMs && dtMs < todayMs + dayMs)
    return { kind: 'publica-hoje', color: DS.orange, label: 'Publica hoje', pulse: true }
  if (status === 6)
    return { kind: 'respondeu', color: DS.blue, label: 'Cliente respondeu', pulse: false }
  if (status === 5)
    return { kind: 'respondeu', color: DS.blue, label: 'Aprovado', pulse: false }
  if (vip)
    return { kind: 'vip', color: '#F59E0B', label: 'VIP', pulse: false }
  if (!s.roteiroLink && status < 2)
    return { kind: 'sem-roteiro', color: DS.violet, label: 'Sem roteiro', pulse: false }
  if (!s.assignedEditor && status < 3 && (item.tp === 'Reel'))
    return { kind: 'sem-editor', color: DS.neutral, label: 'Sem editor', pulse: false }
  return { kind: null, color: '', label: '', pulse: false }
}

// ── Clientes VIP (mobile-only, persistido + sync) ─────────
const VIP_KEY = 'sm_client_vip'

export function loadVip(): Set<string> {
  try {
    const raw = localStorage.getItem(VIP_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch { return new Set() }
}

export function persistVip(set: Set<string>): void {
  const arr = [...set]
  localStorage.setItem(VIP_KEY, JSON.stringify(arr))
  syncToCloud(VIP_KEY, arr)
}
