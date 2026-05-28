// ── Controle de acesso por cargo ─────────────────────────────────────────────
// Define o que cada membro pode ver e fazer no DS HUB.
// ─────────────────────────────────────────────────────────────────────────────

export type Role = 'socio' | 'head' | 'social' | 'design' | 'copy' | 'trafego' | 'guest'

const USER_ROLES: Record<string, Role> = {
  pradox:  'socio',
  testa:   'socio',
  kaique:  'head',
  geovana: 'social',
  jhones:  'design',
  kerges:  'copy',
  arthur:  'trafego',
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
