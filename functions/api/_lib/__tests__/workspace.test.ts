import { describe, it, expect } from 'vitest'
import {
  DEFAULT_WORKSPACE, normalizeWorkspaceId, resolveWorkspace, scopedKey,
} from '../workspace'

/**
 * A fundação do multi-tenant (Onda 1a). Estes testes travam a regra que torna a
 * mudança SEGURA: enquanto ninguém emite workspace, tudo cai em 'digital-scale' e
 * as chaves dele ficam sem prefixo — então o painel atual não muda em nada.
 */

const req = (headers: Record<string, string> = {}) =>
  new Request('https://x/api/sync', { headers })

describe('normalizeWorkspaceId', () => {
  it('vazio/nulo cai no default', () => {
    expect(normalizeWorkspaceId(undefined)).toBe(DEFAULT_WORKSPACE)
    expect(normalizeWorkspaceId(null)).toBe(DEFAULT_WORKSPACE)
    expect(normalizeWorkspaceId('')).toBe(DEFAULT_WORKSPACE)
    expect(normalizeWorkspaceId('   ')).toBe(DEFAULT_WORKSPACE)
  })

  it('vira slug seguro: minúsculas e só a-z0-9-', () => {
    expect(normalizeWorkspaceId('Minha Agência!!')).toBe('minhaagncia')
    expect(normalizeWorkspaceId('Studio-X_2')).toBe('studio-x2')
    expect(normalizeWorkspaceId('DIGITAL-SCALE')).toBe('digital-scale')
  })

  it('entrada que vira vazia após limpeza cai no default (nunca prefixa com vazio)', () => {
    expect(normalizeWorkspaceId('!!!')).toBe(DEFAULT_WORKSPACE)
    expect(normalizeWorkspaceId('日本語')).toBe(DEFAULT_WORKSPACE)
  })
})

describe('resolveWorkspace', () => {
  it('sem cabeçalho nem cookie → default (o painel atual)', () => {
    expect(resolveWorkspace(req())).toBe(DEFAULT_WORKSPACE)
  })

  it('lê o cabeçalho X-DS-Workspace', () => {
    expect(resolveWorkspace(req({ 'X-DS-Workspace': 'studio-x' }))).toBe('studio-x')
  })

  it('cabeçalho vence o cookie', () => {
    const r = req({ 'X-DS-Workspace': 'studio-x', 'Cookie': 'ds_ws=outro' })
    expect(resolveWorkspace(r)).toBe('studio-x')
  })

  it('sem cabeçalho, lê o cookie ds_ws', () => {
    expect(resolveWorkspace(req({ 'Cookie': 'ds_ws=agencia-b; outra=1' }))).toBe('agencia-b')
  })

  it('normaliza o que vier do cabeçalho', () => {
    expect(resolveWorkspace(req({ 'X-DS-Workspace': 'Agência B' }))).toBe('agnciab')
  })
})

describe('scopedKey', () => {
  it('o tenant nº 1 (digital-scale) fica SEM prefixo — dados atuais seguem válidos', () => {
    expect(scopedKey(DEFAULT_WORKSPACE, 'sm_states')).toBe('sm_states')
    expect(scopedKey(DEFAULT_WORKSPACE, 'sm_custom')).toBe('sm_custom')
  })

  it('tenant novo ganha ws:<id>: na frente', () => {
    expect(scopedKey('studio-x', 'sm_states')).toBe('ws:studio-x:sm_states')
  })

  it('tenants diferentes nunca colidem na mesma chave', () => {
    expect(scopedKey('a', 'sm_states')).not.toBe(scopedKey('b', 'sm_states'))
  })
})
