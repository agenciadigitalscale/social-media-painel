// ── Controle de acesso por cargo ─────────────────────────────────────────────
// Define o que cada membro pode ver e fazer no DS HUB.
//
// 2026-09-28: o CARGO de cada pessoa vem de `lib/access.ts` — a mesma regra que
// o servidor aplica no /api/sync. Aqui ela vira abas visíveis e permissões de
// tela. As funções exportadas mantêm os nomes de antes para quem já as usa.
// ─────────────────────────────────────────────────────────────────────────────

import { cargoDe, isSocio, type Cargo } from './access'

/** `head`/`trafego`/`guest` ficam no tipo por compatibilidade; ninguém os tem mais. */
export type Role = Cargo | 'head' | 'trafego' | 'guest'

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

/** Todas as abas do `navItems` do App (0–31). */
// Ao criar aba nova no fim do navItems, aumente este número — senão ela fica
// visível para todo cargo com lista (foi o que aconteceu com a 32).
const TODAS_AS_ABAS = Array.from({ length: 33 }, (_, i) => i)

/**
 * Abas que cada cargo VÊ. O resto fica escondido — e bloqueado: a trava
 * `tabBlocked` do App devolve ao Meu Dia qualquer caminho que tente abrir uma
 * aba fora desta lista (atalho, alerta, busca).
 *
 * Índices: 0 Meu Dia · 1 Hoje · 2 Agenda · 4 Produções · 5 Calendário ·
 * 6 Clientes · 7 Dashboard · 9 Gravações · 10 Editor · 12 Equipe · 16 Design ·
 * 21 Radar · 22 Onboarding · 23 Entregas · 25 Designers · 26 Vídeos Kaique ·
 * 27/28 Artes Jhones/Julio · 29 Fechamento · 30 Briefings · 31 Minha esteira ·
 * 32 Calendário de postagem (só sócio e Social Media — postagem é do Social).
 */
const ABAS_DO_CARGO: Record<Cargo, number[] | 'todas'> = {
  // Sócio: tudo (a "Minha esteira" é de quem produz; o sócio usa Produções).
  socio:  'todas',
  // Social Media: conteúdo e clientes, sem visão de equipe (Radar, Equipe,
  // Fechamento, produção individual) e sem as filas de Editor/Design.
  social: [0, 1, 2, 4, 6, 7, 9, 22, 23, 30, 32],
  // Copy: a esteira dela é a de Roteiros; legendas no Meu Dia.
  copy:   [0, 7, 30, 31],
  // Editor: só os vídeos dele — esteira, editor, gravações, calendário.
  editor: [0, 7, 9, 30, 31],
  // Designer: só as artes dele.
  design: [0, 7, 30, 31],
}

function hiddenTabsDo(cargo: Cargo | null): number[] {
  const abas = cargo ? ABAS_DO_CARGO[cargo] : [0]
  if (abas === 'todas') return [31]
  return TODAS_AS_ABAS.filter(i => !abas.includes(i))
}

function permissoesDo(cargo: Cargo | null): Permissions {
  const socio = cargo === 'socio'
  const social = cargo === 'social'
  return {
    canDelete: socio,
    canBulkDelete: socio,
    canViewFinanceiro: socio,
    canViewEquipe: socio,
    canManageClients: socio,
    canManagePasswords: socio,
    canEditAnyCard: socio || social,
    canSendToClient: socio || social,
    // Criar e distribuir conteúdo é do Social Media (e dos sócios). A Copy cria
    // roteiros pela esteira dela, que usa o próprio caminho de roteiro.
    canAddItems: socio || social,
    hiddenTabs: hiddenTabsDo(cargo),
  }
}

export function getUserRole(username: string): Role {
  return cargoDe(username) ?? 'guest'
}

export function getUserPerms(username: string): Permissions {
  return permissoesDo(cargoDe(username))
}

/** Liderança com visão global = só sócio (o Kaique virou editor isolado). */
export function isAdminRole(username: string): boolean {
  return isSocio(username)
}

/**
 * Área "Designers" (produção dos designers lado a lado, disputa, fechamento):
 * compara profissionais — por isso é só de sócio. Antes incluía o Arthur; a
 * regra de 2026-09-28 tira do Social Media toda comparação entre membros.
 */
export const DESIGNER_MANAGERS: readonly string[] = ['pradox', 'testa']

export function canViewDesignerManagement(username: string): boolean {
  return isSocio(username)
}

/** É um dos designers cuja produção este módulo acompanha? */
export function isDesigner(username: string): boolean {
  return cargoDe(username) === 'design'
}

/** Aba "Vídeos Kaique" — produção individual de outra pessoa: só sócio. */
export function canViewProducaoKaique(username: string): boolean {
  return isSocio(username)
}

/** Abas "Artes Jhones/Julio" e "Fechamento" — só sócio. */
export function canViewProducaoDesigners(username: string): boolean {
  return isSocio(username)
}
