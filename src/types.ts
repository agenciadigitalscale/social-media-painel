export type ContentType = 'Post' | 'Reel' | 'Story'

export type Status = 0 | 1 | 2 | 3 | 4
// 0 = Pendente, 1 = Em edição, 2 = Aprovado, 3 = Publicado, 4 = Reprovado pelo cliente

export interface ContentItem {
  i: number        // ID único
  c: string        // Cliente
  dt: Date         // Data de publicação
  tp: ContentType  // Tipo
  n: string        // Nome/título
  s: Status        // Status inicial
  custom?: boolean // true se criado a partir de roteiros
}

export interface ItemEditPatch {
  dt?: Date
  tp?: ContentType
  n?: string
}

export interface HistoryEntry {
  action: string
  ts: number
}

export interface ItemState {
  status: Status
  title: string
  link: string
  caption: string
  notes: string
  rejectionText?: string  // preenchido pelo portal quando cliente reprova
  history?: HistoryEntry[]
  engagement?: {
    likes?: number
    comments?: number
    reach?: number
  }
}

export interface Client {
  name: string
  postsPerMonth: number
  reelsPerMonth: number
  sheetUrl?: string
  scriptUrl?: string
}

export interface Roteiro {
  id: string
  clientName: string
  title: string
  type: ContentType
  driveLink?: string
  notes?: string
  distributed: boolean
}

export interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}
