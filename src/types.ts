export type ContentType = 'Post' | 'Reel'

export type Status = 0 | 1 | 2 | 3
// 0 = Pendente, 1 = Em edição, 2 = Aprovado, 3 = Publicado

export interface ContentItem {
  i: number        // ID único
  c: string        // Cliente
  dt: Date         // Data de publicação
  tp: ContentType  // Tipo
  n: string        // Nome/título
  s: Status        // Status inicial
}

export interface ItemState {
  status: Status
  link: string
  caption: string
  notes: string
}

export interface Client {
  name: string
  postsPerMonth: number
  reelsPerMonth: number
  sheetUrl?: string
  scriptUrl?: string
}

export interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}
