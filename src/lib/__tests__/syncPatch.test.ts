import { describe, it, expect, beforeEach, vi } from 'vitest'

// O envio por diferença é o que impede uma aba com cópia velha de apagar o
// trabalho de outra pessoa. Errar aqui perde dado em silêncio, então a lógica
// pura é testada isolada e o caminho do POST é observado pelo fetch stubado.

function makeStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, String(v)) },
    removeItem: (k: string) => { data.delete(k) },
    clear: () => { data.clear() },
  } as Storage
}

const sent: Array<{ key: string; value?: string; patch?: string }> = []

vi.stubGlobal('localStorage', makeStorage())
vi.stubGlobal('navigator', { onLine: true })
vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
  sent.push(JSON.parse(String(init?.body ?? '{}')))
  return new Response('{"ok":true}', { status: 200 })
}))

const { diffEntries, noteSyncedValue, syncToCloud, forceSync } = await import('../storage')

const CARD_A = { status: 2, title: 'Reel do chuveiro', link: '', caption: '', notes: '' }
const CARD_B = { status: 5, title: 'Post da padaria', link: '', caption: '', notes: '' }

beforeEach(() => {
  localStorage.clear()
  sent.length = 0
})

describe('diffEntries', () => {
  it('devolve só o que mudou', () => {
    const antes  = { 1: CARD_A, 2: CARD_B }
    const depois = { 1: CARD_A, 2: { ...CARD_B, status: 7 } }
    expect(Object.keys(diffEntries(antes, depois))).toEqual(['2'])
  })

  it('inclui entrada nova', () => {
    expect(diffEntries({ 1: CARD_A }, { 1: CARD_A, 9: CARD_B })).toEqual({ 9: CARD_B })
  })

  it('nada mudou → patch vazio', () => {
    expect(diffEntries({ 1: CARD_A }, { 1: CARD_A })).toEqual({})
  })

  it('compara por conteúdo, não por referência', () => {
    expect(diffEntries({ 1: CARD_A }, { 1: { ...CARD_A } })).toEqual({})
  })

  /**
   * O merge do servidor não apaga entrada ausente — e não precisa: excluir
   * conteúdo é registrado em `sm_deleted`, nunca removendo de `sm_states`.
   * Este teste trava esse contrato: se um dia algo remover de verdade, ele cai.
   */
  it('entrada que sumiu não vira remoção (exclusão vive em sm_deleted)', () => {
    expect(diffEntries({ 1: CARD_A, 2: CARD_B }, { 1: CARD_A })).toEqual({})
  })
})

describe('envio ao servidor', () => {
  it('primeira gravação, sem base de comparação, manda o bloco inteiro', async () => {
    syncToCloud('sm_states', { 1: CARD_A })
    await forceSync()
    expect(sent).toHaveLength(1)
    expect(sent[0].value).toBeDefined()
    expect(sent[0].patch).toBeUndefined()
  })

  it('com base conhecida, manda só o card alterado', async () => {
    noteSyncedValue('sm_states', { 1: CARD_A, 2: CARD_B })
    syncToCloud('sm_states', { 1: CARD_A, 2: { ...CARD_B, status: 7 } })
    await forceSync()

    expect(sent[0].value).toBeUndefined()
    expect(JSON.parse(sent[0].patch!)).toEqual({ 2: { ...CARD_B, status: 7 } })
  })

  it('o card intocado NÃO viaja — é isso que preserva o trabalho alheio', async () => {
    noteSyncedValue('sm_states', { 1: CARD_A, 2: CARD_B })
    syncToCloud('sm_states', { 1: CARD_A, 2: { ...CARD_B, status: 7 } })
    await forceSync()
    expect(Object.keys(JSON.parse(sent[0].patch!))).not.toContain('1')
  })

  it('chave que não é mapa continua indo inteira', async () => {
    noteSyncedValue('sm_deleted', [1, 2])
    syncToCloud('sm_deleted', [1, 2, 3])
    await forceSync()
    expect(sent[0].value).toBe('[1,2,3]')
    expect(sent[0].patch).toBeUndefined()
  })
})
