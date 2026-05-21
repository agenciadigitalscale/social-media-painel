export type ContentType = 'Post' | 'Reel' | 'Story' | 'Carrossel'

// ── Status system v2 ─────────────────────────────────────
// 0 = Pendente
// 1 = Em edição
// 2 = Aprovação interna
// 3 = Aprovado interno
// 4 = Enviado ao cliente
// 5 = Aprovado pelo cliente
// 6 = Reprovado pelo cliente
// 7 = Publicado
export type Status = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

export const STATUS_CONFIG: Record<Status, {
  label: string
  shortLabel: string
  color: string
  dot: string
  glow: string
  emoji: string
  group: 'internal' | 'client' | 'done'
}> = {
  0: { label: 'Pendente',               shortLabel: 'Pendente',    color: '#A1A1AA', dot: '#71717A', glow: 'rgba(161,161,170,0.3)', emoji: '⏳', group: 'internal' },
  1: { label: 'Em edição',              shortLabel: 'Em edição',   color: '#FFD700', dot: '#FFD700', glow: 'rgba(255,215,0,0.35)',   emoji: '✏️', group: 'internal' },
  2: { label: 'Aprovação interna',      shortLabel: 'Aprov. int.', color: '#60A5FA', dot: '#3B82F6', glow: 'rgba(59,130,246,0.35)',  emoji: '👁️', group: 'internal' },
  3: { label: 'Aprovado interno',       shortLabel: 'Aprovado',    color: '#2F80ED', dot: '#2F80ED', glow: 'rgba(47,128,237,0.4)',   emoji: '✅', group: 'internal' },
  4: { label: 'Enviado ao cliente',     shortLabel: 'Enviado',     color: '#FF9A3D', dot: '#FF9A3D', glow: 'rgba(255,154,61,0.4)',   emoji: '📤', group: 'client'   },
  5: { label: 'Aprovado pelo cliente',  shortLabel: 'Aprovado',    color: '#00C875', dot: '#00C875', glow: 'rgba(0,200,117,0.4)',    emoji: '🎉', group: 'client'   },
  6: { label: 'Reprovado pelo cliente', shortLabel: 'Reprovado',   color: '#FF3B30', dot: '#FF3B30', glow: 'rgba(255,59,48,0.4)',    emoji: '🔄', group: 'client'   },
  7: { label: 'Publicado',              shortLabel: 'Publicado',   color: '#00C47A', dot: '#00C47A', glow: 'rgba(0,196,122,0.4)',    emoji: '🚀', group: 'done'     },
}

// Migration: convert v1 status (0-4) to v2 (0-7)
export function migrateStatus(status: number): Status {
  if (status === 2) return 3  // Aprovado → Aprovado interno
  if (status === 3) return 7  // Publicado → Publicado
  if (status === 4) return 6  // Reprovado → Reprovado pelo cliente
  return status as Status     // 0, 1 unchanged
}

// ── Core entities ────────────────────────────────────────

export interface ContentItem {
  i: number
  c: string
  dt: Date
  tp: ContentType
  n: string
  s: Status
  custom?: boolean
}

export interface ItemEditPatch {
  dt?: Date
  tp?: ContentType
  n?: string
}

export interface HistoryEntry {
  action: string
  ts: number
  user?: string
}

export interface Comment {
  id: string
  text: string
  author: string
  authorType: 'internal' | 'client'
  createdAt: number
  statusAt?: Status
}

export interface ItemState {
  status: Status
  title: string
  link: string
  caption: string
  notes: string
  rejectionText?: string
  history?: HistoryEntry[]
  comments?: Comment[]
  engagement?: {
    likes?: number
    comments?: number
    reach?: number
  }
  responsible?: string
  priority?: 'alta' | 'media' | 'baixa'
  sentToClientAt?: number
  approvedByClientAt?: number
  publishedAt?: number
  approvalToken?: string
  footageLink?: string       // link para o arquivo bruto de gravação (Drive)
  assignedEditor?: string    // editor responsável pela edição (key do NAME_MAP)
  isTraffic?: boolean        // criativo será usado em tráfego pago
  tags?: string[]            // etiquetas personalizadas
}

export type Nicho = 'gastronomico' | 'variados'

export interface Client {
  name: string
  postsPerMonth: number
  reelsPerMonth: number
  sheetUrl?: string
  scriptUrl?: string
  whatsapp?: string
  instagram?: string
  logo?: string
  responsible?: string
  nicho?: Nicho
  subnicho?: string
}

export interface Roteiro {
  id: string
  clientName: string
  title: string
  type: ContentType
  driveLink?: string
  notes?: string
  distributed: boolean
  year?: number
  month?: number
}

// ── Prospecting / CRM ────────────────────────────────────

export type LeadStage = 'contato' | 'reuniao' | 'proposta' | 'fechado' | 'perdido'

export interface Lead {
  id: string
  name: string
  address: string
  phone?: string
  website?: string
  instagram?: string
  rating?: number
  ratingsTotal?: number
  placeId?: string
  photoUrl?: string
  stage: LeadStage
  notes?: string
  estimatedTicket?: number
  addedAt: number
  updatedAt: number
  source?: 'maps' | 'manual'
  category?: string
  city?: string
}

// ── Notification system ──────────────────────────────────

export interface Notification {
  id: string
  title: string
  message: string
  type: 'approval' | 'rejection' | 'comment' | 'delay' | 'published' | 'info' | 'internal'
  itemId?: number
  clientName?: string
  read: boolean
  createdAt: number
}

// ── SaaS foundation (future) ─────────────────────────────

export interface Workspace {
  id: string
  name: string
  logo?: string
  plan: 'starter' | 'pro' | 'agency'
  ownerId: string
}

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  workspaceId: string
}

export interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}
