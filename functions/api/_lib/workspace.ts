// Qual AGÊNCIA (tenant) é dona desta requisição.
//
// O DS HUB nasceu single-tenant: todo dado da Digital Scale vive numa base D1 só,
// nas chaves `sm_*` do `app_data`, sem marca de dono. Para o painel virar produto
// vendável (uma instância, N agências isoladas), cada requisição precisa saber a
// QUAL workspace ela pertence — e é isso que este módulo resolve.
//
// ⚠️ Onda 1a (fundação INERTE): por enquanto NINGUÉM chama `resolveWorkspace`, e
// tudo defaulta para `digital-scale`. Nenhum comportamento muda para a equipe
// hoje. O passo seguinte (Onda 1b) é o `/api/sync` passar a prefixar as chaves
// por este id — mas só depois deste alicerce estar provado e verde.

import { getCookie } from './session'

/**
 * O workspace da Digital Scale — o tenant nº 1. É o default de TODO caminho que
 * ainda não carrega workspace, então o painel atual continua funcionando igual
 * enquanto o resto do multi-tenant não existe.
 */
export const DEFAULT_WORKSPACE = 'digital-scale'

/**
 * Normaliza um id de workspace para um slug seguro de URL/chave: minúsculas,
 * só `a-z 0-9 -`. Entrada vazia ou que vira vazia após a limpeza cai no default
 * — nunca devolve string vazia, porque um id vazio prefixaria chaves como `:sm_x`
 * e misturaria tenants sem dono.
 */
export function normalizeWorkspaceId(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_WORKSPACE
  const slug = raw.toLowerCase().trim().replace(/[^a-z0-9-]/g, '')
  return slug || DEFAULT_WORKSPACE
}

/**
 * O workspace desta requisição. Ordem: cabeçalho `X-DS-Workspace` (chamadas de
 * API que já sabem o tenant) → cookie `ds_ws` (a sessão do navegador) → default.
 *
 * Hoje nada emite esse cabeçalho nem esse cookie, então sempre devolve
 * `digital-scale` — de propósito. Quando a Onda 2 (contas) emitir a sessão com o
 * workspace da pessoa, este mesmo resolvedor passa a distinguir os tenants sem
 * mudar de assinatura.
 */
export function resolveWorkspace(request: Request): string {
  const header = request.headers.get('x-ds-workspace')
  if (header) return normalizeWorkspaceId(header)
  return normalizeWorkspaceId(getCookie(request.headers.get('Cookie'), 'ds_ws'))
}

/**
 * Prefixo de chave por tenant, para o `app_data`. O workspace nº 1 (Digital
 * Scale) fica **sem prefixo** de propósito: assim os ~858 KB de dados já gravados
 * continuam válidos, sem migração de linha nenhuma — só os tenants novos ganham
 * `ws:<id>:` na frente. `sm_states` da Digital Scale segue sendo `sm_states`.
 */
export function workspaceKeyPrefix(workspace: string): string {
  return workspace === DEFAULT_WORKSPACE ? '' : `ws:${workspace}:`
}

/** Chave física no `app_data`, já com o prefixo do tenant (vazio para o nº 1). */
export function scopedKey(workspace: string, key: string): string {
  return workspaceKeyPrefix(workspace) + key
}

/**
 * O inverso: da chave física de volta para a lógica que o cliente conhece
 * (`ws:studio-x:sm_states` → `sm_states`). Usado no bulk GET, para o navegador
 * receber os próprios nomes `sm_*`, não os prefixados.
 */
export function unscopeKey(workspace: string, dbKey: string): string {
  const prefix = workspaceKeyPrefix(workspace)
  return prefix && dbKey.startsWith(prefix) ? dbKey.slice(prefix.length) : dbKey
}
