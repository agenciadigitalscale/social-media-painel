export type ContentType = 'Post' | 'Reel' | 'Story' | 'Carrossel' | 'Feed'

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
  followUpAt?: number
  pitch?: string
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

// ── Creative Studio ──────────────────────────────────────

export interface BrandingKit {
  primaryColor?: string      // hex, ex: "#ff9039"
  secondaryColor?: string    // hex, ex: "#ff5339"
  style?: string             // "minimalista e elegante" | "vibrante e moderno" | ...
  font?: string              // "serifada premium" | "moderna sans-serif" | ...
  logoUrl?: string           // URL pública do logo (Drive)
  extraContext?: string      // "padaria artesanal, público classe A/B, tom sofisticado"
}

export type CreativeFormat = 'story' | 'post' | 'carrossel'

export interface GeneratedCreative {
  id: string
  clientName: string
  command: string
  format: CreativeFormat
  imageUrl: string           // URL temporária da OpenAI (expira em ~1h)
  revisedPrompt?: string
  createdAt: number
}

// ── Financial Module ─────────────────────────────────────

export type PayStatus = 'pago' | 'pendente' | 'atrasado'
export type MeioPagamento = 'pix' | 'dinheiro' | 'cartao' | 'transferencia' | 'boleto'
export type CategoriaEntrada = 'mensalidade' | 'projeto' | 'consultoria' | 'trafego' | 'design' | 'outros'
export type CategoriaSaida = 'salario' | 'software' | 'imposto' | 'marketing' | 'equipamento' | 'servico' | 'outros'
export type CategoriaFixo = 'salario' | 'software' | 'imposto' | 'cartao' | 'ferramenta' | 'assinatura' | 'internet' | 'aluguel' | 'outros'

export interface RecorrenciaEntry {
  id: string
  clientName: string
  valor: number
  diaCobranca: number          // dia do mês (1-31)
  status: PayStatus
  meioPagamento: MeioPagamento
  dataRealPagamento?: string   // YYYY-MM-DD
  observacoes?: string
  phone?: string
  isTemplate?: boolean         // se true, replica todo mês automaticamente
}

export interface CaixaEntrada {
  id: string
  data: string                 // YYYY-MM-DD
  descricao: string
  clienteOuOrigem: string
  valor: number
  meioPagamento: MeioPagamento
  categoria: CategoriaEntrada
  status: 'recebido' | 'pendente'
  observacoes?: string
}

export interface CaixaSaida {
  id: string
  data: string                 // YYYY-MM-DD
  descricao: string
  categoria: CategoriaSaida
  valor: number
  meioPagamento: MeioPagamento
  status: 'pago' | 'pendente'
  observacoes?: string
}

export interface CustoFixo {
  id: string
  nome: string
  categoria: CategoriaFixo
  valor: number
  vencimento: number           // dia do mês
  status: PayStatus
  observacoes?: string
  isTemplate?: boolean         // replica todo mês
}

export interface FinanceiroMes {
  recorrencia: RecorrenciaEntry[]
  entradas: CaixaEntrada[]
  saidas: CaixaSaida[]
  custosFixos: CustoFixo[]
}
