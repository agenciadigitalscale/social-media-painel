// ── Controle de acesso por cargo ─────────────────────────────────────────────
// Define o que cada membro pode ver e fazer no DS HUB.
// ─────────────────────────────────────────────────────────────────────────────

export type Role = 'socio' | 'head' | 'social' | 'design' | 'copy' | 'trafego' | 'guest'

const USER_ROLES: Record<string, Role> = {
  pradox:  'socio',
  testa:   'socio',
  kaique:  'head',
  jhones:  'design',
  julio:   'design',
  kerges:  'copy',
  arthur:  'social',
  robson:  'trafego',
}

export interface Permissions {
  // Ações destrutivas
  canDelete:          boolean
  canBulkDelete:      boolean
  // Dados sensíveis
  canViewFinanceiro:  boolean
  canViewEquipe:      boolean
  canManageClients:   boolean
  canManagePasswords: boolean
  // Conteúdo
  canEditAnyCard:     boolean  // vs só os próprios
  canSendToClient:    boolean
  canAddItems:        boolean
  // Abas (índice)
  hiddenTabs:         number[] // índices das abas escondidas para este cargo
}

const ROLE_PERMISSIONS: Record<Role, Permissions> = {
  socio: {
    canDelete: true, canBulkDelete: true,
    canViewFinanceiro: true, canViewEquipe: true,
    canManageClients: true, canManagePasswords: true,
    canEditAnyCard: true, canSendToClient: true, canAddItems: true,
    hiddenTabs: [],
  },
  head: {
    canDelete: true, canBulkDelete: true,
    canViewFinanceiro: true, canViewEquipe: true,
    canManageClients: true, canManagePasswords: true,
    canEditAnyCard: true, canSendToClient: true, canAddItems: true,
    hiddenTabs: [],
  },
  social: {
    canDelete: false, canBulkDelete: false,
    canViewFinanceiro: false, canViewEquipe: true,
    canManageClients: false, canManagePasswords: false,
    canEditAnyCard: true, canSendToClient: true, canAddItems: true,
    hiddenTabs: [11], // Financeiro
  },
  design: {
    canDelete: false, canBulkDelete: false,
    canViewFinanceiro: false, canViewEquipe: false,
    canManageClients: false, canManagePasswords: false,
    canEditAnyCard: false, canSendToClient: false, canAddItems: false,
    hiddenTabs: [11, 15, 17], // Financeiro, Tráfego, Prospecção
  },
  copy: {
    canDelete: false, canBulkDelete: false,
    canViewFinanceiro: false, canViewEquipe: false,
    canManageClients: false, canManagePasswords: false,
    canEditAnyCard: false, canSendToClient: false, canAddItems: true,
    hiddenTabs: [11, 15, 17],
  },
  trafego: {
    canDelete: false, canBulkDelete: false,
    canViewFinanceiro: false, canViewEquipe: false,
    canManageClients: false, canManagePasswords: false,
    canEditAnyCard: false, canSendToClient: false, canAddItems: false,
    hiddenTabs: [11, 14, 16], // Financeiro, Roteiros, Design
  },
  guest: {
    canDelete: false, canBulkDelete: false,
    canViewFinanceiro: false, canViewEquipe: false,
    canManageClients: false, canManagePasswords: false,
    canEditAnyCard: false, canSendToClient: false, canAddItems: false,
    hiddenTabs: [11, 12, 14, 15, 16, 17],
  },
}

export function getUserRole(username: string): Role {
  return USER_ROLES[username?.toLowerCase()?.trim()] ?? 'guest'
}

export function getUserPerms(username: string): Permissions {
  return ROLE_PERMISSIONS[getUserRole(username)]
}

export function isAdminRole(username: string): boolean {
  const role = getUserRole(username)
  return role === 'socio' || role === 'head'
}

/**
 * Quem pode abrir a área administrativa "Designers" (produção de Julio/Jhones,
 * comparação, histórico, fechamento).
 *
 * É uma allowlist por USERNAME de propósito, não por cargo: os dois autorizados
 * — Mateus Testa (sócio) e Arthur (social) — não compartilham um cargo, e usar
 * o cargo `socio` inteiro daria acesso ao pradox também, que não gerencia
 * designers. O username é o ID real do sistema (a mesma chave do `USER_ROLES` e
 * do `ADMIN_USERS` do backend), não o nome exibido — então isto NÃO é a
 * "checagem frágil por nome" que o pedido proíbe.
 *
 * ⚠️ Como todo o painel é offline-first (o `/api/sync` entrega a base inteira a
 * cada dispositivo logado), este gate tem a MESMA força das abas Financeiro/
 * Equipe: ele esconde a área e barra a navegação, mas não é isolamento de dados
 * no servidor. Um designer não vê a produção do outro pela interface; blindar
 * isso no servidor exigiria um endpoint dedicado e parar de sincronizar os
 * states brutos — uma rearquitetura à parte, fora desta onda.
 */
export const DESIGNER_MANAGERS: readonly string[] = ['testa', 'arthur']

export function canViewDesignerManagement(username: string): boolean {
  return DESIGNER_MANAGERS.includes(username?.toLowerCase()?.trim())
}

/** É um dos designers cuja produção este módulo acompanha? */
export function isDesigner(username: string): boolean {
  return getUserRole(username) === 'design'
}

/**
 * Quem vê a aba "Produção Kaique" — os números de vídeo do Kaique em tempo real,
 * a mesma conta que ele vê no Meu Dia, em modo só-leitura.
 *
 * É a LIDERANÇA (sócios + head): o pedido nasceu do Pradox cobrando o relatório
 * de quantos vídeos foram feitos — a aba tira essa cobrança do caminho, deixando
 * o número sempre à mão de quem pergunta. Inclui o próprio Kaique (head), que
 * assim vê exatamente o que o Pradox vê. Mesma ressalva de offline-first do
 * [[DESIGNER_MANAGERS]]: esconde a aba, não isola o dado no servidor.
 */
export function canViewProducaoKaique(username: string): boolean {
  return isAdminRole(username)
}

/**
 * Quem vê as abas de produção por designer (Artes Jhones, Artes Julio): os
 * SÓCIOS — Pradox e Testa. Mesmo formato e mesma conta em tempo real da
 * [[canViewProducaoKaique]], só que para os designers. O dono pediu explicitamente
 * "o testa e o pradox"; o Arthur segue com a área completa `Designers`
 * ([[canViewDesignerManagement]]), que é outra tela (disputa, calendário, auditoria).
 */
export function canViewProducaoDesigners(username: string): boolean {
  return getUserRole(username) === 'socio'
}
