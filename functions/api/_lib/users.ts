// Quem existe, do ponto de vista do SERVIDOR.
//
// O `src/lib/users.ts` (NAME_MAP) é visual: emoji, cor, cargo. Esta lista é
// outra coisa — é a fronteira de quem pode receber uma credencial. Vive em
// `functions/` de propósito: o servidor não pode depender de o navegador ter
// mandado um nome plausível.
//
// Nasceu porque o `/api/role-auth` não conferia o `role` contra lista nenhuma:
// um cargo inventado não achava linha em `role_passwords`, caía no ramo "cargo
// sem senha entra direto" e SAÍA COM SESSÃO ASSINADA. Qualquer pessoa emitia
// credencial válida de 8h numa requisição, sem senha — o que tornaria o
// `SYNC_REQUIRE_AUTH` decorativo no dia em que fosse ligado.

/** Os 7 membros da equipe. Espelha o NAME_MAP de `src/lib/users.ts`. */
export const VALID_USERS = [
  'pradox', 'testa', 'kaique', 'jhones', 'kerges', 'arthur', 'robson',
] as const

/**
 * Quem pode mexer em senha dos outros — a mesma regra que o AccessManager já
 * aplica na tela (`adminUsers`). Aqui ela passa a valer no servidor também.
 */
export const ADMIN_USERS = ['kaique', 'pradox', 'testa'] as const

export function isValidUser(role: string | undefined | null): boolean {
  if (!role) return false
  return (VALID_USERS as readonly string[]).includes(role.toLowerCase())
}

export function isAdminUser(role: string | undefined | null): boolean {
  if (!role) return false
  return (ADMIN_USERS as readonly string[]).includes(role.toLowerCase())
}
