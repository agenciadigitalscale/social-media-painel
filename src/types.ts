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
  0: { label: 'A fazer',            shortLabel: 'A fazer',   color: '#9CA3AF', dot: '#9CA3AF', glow: 'rgba(156,163,175,0.30)', emoji: '⏳', group: 'internal' },
  1: { label: 'Em produção',        shortLabel: 'Produção',  color: '#3B82F6', dot: '#3B82F6', glow: 'rgba(59,130,246,0.35)',  emoji: '✏️', group: 'internal' },
  2: { label: 'Revisão interna',    shortLabel: 'Revisão',   color: '#06B6D4', dot: '#06B6D4', glow: 'rgba(6,182,212,0.35)',   emoji: '👁️', group: 'internal' },
  3: { label: 'Pronto p/ enviar',   shortLabel: 'Pronto',    color: '#7C5CFC', dot: '#7C5CFC', glow: 'rgba(124,92,252,0.35)',  emoji: '✅', group: 'internal' },
  4: { label: 'Enviado ao cliente', shortLabel: 'Enviado',   color: '#F59E0B', dot: '#F59E0B', glow: 'rgba(245,158,11,0.40)',  emoji: '📤', group: 'client'   },
  5: { label: 'Aprovado cliente',   shortLabel: 'Aprovado',  color: '#31D17C', dot: '#31D17C', glow: 'rgba(49,209,124,0.40)',  emoji: '🎉', group: 'client'   },
  6: { label: 'Ajuste solicitado',  shortLabel: 'Ajuste',    color: '#EF4444', dot: '#EF4444', glow: 'rgba(239,68,68,0.40)',   emoji: '🔄', group: 'client'   },
  7: { label: 'Publicado',          shortLabel: 'Publicado', color: '#31D17C', dot: '#31D17C', glow: 'rgba(49,209,124,0.35)',  emoji: '🚀', group: 'done'     },
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
  lastReminderAt?: number
  approvalToken?: string
  footageLink?: string       // link para o arquivo bruto de gravação (Drive)
  roteiroLink?: string       // link para o roteiro no Google Docs
  deliveryDate?: number      // prazo de entrega do vídeo editado (timestamp)
  assignedEditor?: string    // editor responsável pela edição (key do NAME_MAP)
  isTraffic?: boolean        // criativo será usado em tráfego pago
  tags?: string[]            // etiquetas personalizadas
  creative?: string          // direção criativa gerada no Creative Engine (não é a legenda)
}

export type Nicho = 'gastronomico' | 'variados'

export interface HandoffNotif {
  id: string
  to: string        // NAME_MAP key do destinatário
  by: string        // NAME_MAP key de quem fez a mudança
  itemId: number
  itemTitle: string
  clientName: string
  newStatus: Status
  ts: number
  readBy: string[]  // NAME_MAP keys de quem já dispensou
}

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

// Estágios do pipeline de produção de um roteiro (kanban da Central de Roteiros)
export type RoteiroStatus = 'ideia' | 'escrevendo' | 'revisao' | 'pronto'

export interface Roteiro {
  id: string
  clientName: string
  title: string
  type: ContentType
  driveLink?: string
  docsLink?: string
  refLink?: string    // referências usadas no roteiro (inspirações, links externos)
  notes?: string
  distributed: boolean
  status?: RoteiroStatus  // undefined = 'ideia' (retrocompatível)
  year?: number
  month?: number
  deadline?: number   // prazo de entrega (timestamp) — meta interna definida pelo Sócio
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

export type CaixaEmpresaTipo = 'entrada' | 'saida'

export type CaixaEmpresaCategoria =
  | 'lucro_mes'
  | 'aporte'
  | 'investimento'
  | 'rendimento'
  | 'retirada'
  | 'equipamento'
  | 'infra'
  | 'taxa'
  | 'imposto'
  | 'outros'

export interface CaixaEmpresaEntry {
  id: string
  tipo: CaixaEmpresaTipo
  valor: number
  data: string          // YYYY-MM-DD
  descricao: string
  categoria: CaixaEmpresaCategoria
  observacao?: string
}
