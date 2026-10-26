import { describe, it, expect, vi } from 'vitest'

/**
 * Sem espaço, a LEITURA seguinte tem de ver o valor novo — não a cópia velha do
 * disco. Era a cópia velha que fazia o painel recriar os roteiros sem link e
 * gravar por cima (2026-10-26).
 */
const LIMITE = 200
class StorageFalso {
  dados = new Map<string, string>()
  get length() { return this.dados.size }
  key(i: number) { return Array.from(this.dados.keys())[i] ?? null }
  getItem(k: string) { return this.dados.get(k) ?? null }
  setItem(k: string, v: string) {
    const usado = [...this.dados].filter(([c]) => c !== k).reduce((s, [c, x]) => s + c.length + x.length, 0)
    if (usado + k.length + v.length > LIMITE) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e }
    this.dados.set(k, v)
  }
  removeItem(k: string) { this.dados.delete(k) }
  clear() { this.dados.clear() }
}
vi.stubGlobal('Storage', StorageFalso)
const ls = new StorageFalso()
vi.stubGlobal('localStorage', ls)
vi.stubGlobal('window', { addEventListener: vi.fn(), dispatchEvent: vi.fn() })
vi.stubGlobal('navigator', { onLine: false })
vi.stubGlobal('console', { ...console, warn: vi.fn() })
await import('../storage')

describe('navegador sem espaço', () => {
  it('lê o valor novo, nunca a cópia velha', () => {
    ls.setItem('ocupa', 'x'.repeat(120))
    ls.setItem('sm_esteira_roteiros', '{"velho":1}')
    const novo = JSON.stringify({ novo: 'y'.repeat(100) })
    expect(() => ls.setItem('sm_esteira_roteiros', novo)).not.toThrow()
    expect(ls.getItem('sm_esteira_roteiros')).toBe(novo)
  })
  it('apagar a chave apaga também da memória', () => {
    ls.removeItem('sm_esteira_roteiros')
    expect(ls.getItem('sm_esteira_roteiros')).toBeNull()
  })
})
