import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { DriveFile } from '../videoMatch'

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

vi.stubGlobal('localStorage', makeStorage())
vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')))
vi.stubGlobal('navigator', { onLine: true })

const {
  runReadyAutomation, getReadyState, clearReadyState, reloadReadyStates, isLocked, isStalePhase,
} = await import('../readyAutomation')

const ITEM = { i: 5821, c: 'Padaria Sol', tp: 'Reel', n: 'Vídeo - Ponto Fixo' }
const FILE: DriveFile = { id: 'FILE_OK', name: 'DSHUB-5821_VIDEO-PONTO-FIXO.mp4', mimeType: 'video/mp4' }

interface Recorded {
  audits: string[]
  linked: string[]
  moved: number
  notified: number
  reviewOpened: number
}

function deps(over: Partial<Parameters<typeof runReadyAutomation>[0]> = {}, rec?: Recorded) {
  const r = rec ?? { audits: [], linked: [], moved: 0, notified: 0, reviewOpened: 0 }
  return {
    base: {
      item: ITEM,
      title: 'Vídeo - Ponto Fixo',
      alreadyCompleted: false,
      whatsappAlreadyOpened: false,
      fetchFiles: async () => ({ ok: true, folderId: 'FOLDER_1', files: [FILE] }),
      validatePreview: async () => ({ ok: true, durationSec: 12 }),
      onLinkFile: ({ file }: { file: DriveFile }) => { r.linked.push(file.id) },
      onMoveToReview: () => { r.moved++ },
      onAudit: (a: string) => { r.audits.push(a) },
      onNotify: () => { r.notified++; return true },
      onOpenReviewModal: () => { r.reviewOpened++ },
      ...over,
    },
    rec: r,
  }
}

beforeEach(() => {
  localStorage.clear()
  reloadReadyStates()
})

describe('runReadyAutomation', () => {
  it('Cenário 2 — encontra pelo ID, valida, vincula e move sem notificar automaticamente', async () => {
    const { base, rec } = deps()
    const result = await runReadyAutomation(base)

    expect(result.phase).toBe('done')
    expect(rec.linked).toEqual(['FILE_OK'])
    expect(rec.moved).toBe(1)
    expect(rec.notified).toBe(0)
    expect(rec.reviewOpened).toBe(0)
    expect(getReadyState(ITEM.i)?.phase).toBe('done')
    expect(rec.audits.join(' | ')).toContain('Prévia detectada e revisão interna liberada')
  })

  it('Cenário 1 — nada na pasta: fica em Pronto, não move nem notifica', async () => {
    const { base, rec } = deps({ fetchFiles: async () => ({ ok: true, folderId: 'F', files: [] }) })
    const result = await runReadyAutomation(base)

    expect(result.phase).toBe('not_found')
    expect(rec.moved).toBe(0)
    expect(rec.notified).toBe(0)
    expect(getReadyState(ITEM.i)?.message).toBe('Arquivo não encontrado na pasta Publicar')
  })

  it('Cenário 3 — ambíguo: guarda os candidatos e não escolhe', async () => {
    const { base, rec } = deps({
      fetchFiles: async () => ({
        ok: true, folderId: 'F',
        files: [
          { id: 'a', name: 'video-ponto-fixo.mp4', mimeType: 'video/mp4' },
          { id: 'b', name: 'VIDEO PONTO FIXO.mov', mimeType: 'video/quicktime' },
        ],
      }),
    })
    const result = await runReadyAutomation(base)

    expect(result.phase).toBe('ambiguous')
    expect(getReadyState(ITEM.i)?.candidates).toHaveLength(2)
    expect(rec.moved).toBe(0)
    expect(rec.notified).toBe(0)
  })

  it('Cenário 6 — vídeo não carrega: não move e mostra erro de reprodução', async () => {
    const { base, rec } = deps({ validatePreview: async () => ({ ok: false, reason: 'duração inválida' }) })
    const result = await runReadyAutomation(base)

    expect(result.phase).toBe('invalid')
    expect(rec.moved).toBe(0)
    expect(rec.notified).toBe(0)
    expect(rec.linked).toEqual([])
    expect(getReadyState(ITEM.i)?.error).toBe('duração inválida')
  })

  it('Cenário 4/5 — arquivo de outro cliente/pasta nunca chega aqui: a listagem é da pasta do cliente', async () => {
    // fetchFiles só sabe listar a pasta registrada para ITEM.c; simulamos a pasta
    // de outro cliente devolvendo um arquivo que casaria pelo nome.
    const { base, rec } = deps({ fetchFiles: async () => ({ ok: true, folderId: 'F', files: [] }) })
    await runReadyAutomation(base)
    expect(rec.linked).toEqual([])
  })

  it('pasta Publicar não configurada: erro claro, sem mover', async () => {
    const { base, rec } = deps({ fetchFiles: async () => ({ ok: true, reason: 'no_folder', folderId: null, files: [] }) })
    const result = await runReadyAutomation(base)
    expect(result.phase).toBe('error')
    expect(getReadyState(ITEM.i)?.message).toContain('Pasta Publicar não configurada')
    expect(rec.moved).toBe(0)
  })

  it('Cenário 7 — já concluída: pode revalidar, mas NUNCA reabre o WhatsApp', async () => {
    // Arrastar de novo é pedido explícito do usuário e revalida o arquivo (é
    // assim que o Cenário 12 é percebido). O que não pode repetir é o efeito
    // irreversível: abrir a conversa outra vez.
    const { base, rec } = deps({ alreadyCompleted: true })
    const result = await runReadyAutomation(base)

    expect(result.phase).toBe('done')
    expect(result.skipped).toBeUndefined()
    expect(rec.notified).toBe(0)
  })

  it('WhatsApp já aberto antes: move mas não abre de novo', async () => {
    const { base, rec } = deps({ whatsappAlreadyOpened: true })
    const result = await runReadyAutomation(base)

    expect(result.phase).toBe('done')
    expect(rec.moved).toBe(1)
    expect(rec.notified).toBe(0)
  })

  it('Cenário 8 — arraste duplo: a segunda chamada cai no lock', async () => {
    const rec: Recorded = { audits: [], linked: [], moved: 0, notified: 0, reviewOpened: 0 }
    const slow = deps({
      fetchFiles: () => new Promise(r => setTimeout(() => r({ ok: true, folderId: 'F', files: [FILE] }), 40)),
    }, rec)

    const first = runReadyAutomation(slow.base)
    const second = await runReadyAutomation(slow.base)
    expect(second.skipped).toBe('locked')

    await first
    expect(rec.moved).toBe(1)
    expect(rec.notified).toBe(0)
    expect(isLocked(ITEM.i)).toBe(false)
  })

  it('revarredura em segundo plano valida e move para revisão interna sem avisar ninguém', async () => {
    // O editor exportou depois de arrastar. A revarredura valida a prévia e
    // libera a revisão interna, mas não abre modal nem WhatsApp automaticamente.
    const { base, rec } = deps({ mode: 'background' })
    const result = await runReadyAutomation(base)

    expect(result.phase).toBe('done')
    expect(rec.linked).toEqual(['FILE_OK'])
    expect(rec.moved).toBe(1)
    expect(rec.notified).toBe(0)
    expect(rec.reviewOpened).toBe(0)
    expect(getReadyState(ITEM.i)?.message).toBe('Enviado para revisão interna')
  })

  it('fase pendurada é reconhecida como interrompida (e volta a ter saída)', async () => {
    const antiga = Date.now() - 5 * 60 * 1000
    expect(isStalePhase({ itemId: 1, phase: 'found', message: '', startedAt: antiga, updatedAt: antiga })).toBe(true)
    expect(isStalePhase({ itemId: 1, phase: 'found', message: '', startedAt: 0, updatedAt: Date.now() })).toBe(false)
    // Fase terminal não é "pendurada" — ela já tem ações próprias.
    expect(isStalePhase({ itemId: 1, phase: 'not_found', message: '', startedAt: antiga, updatedAt: antiga })).toBe(false)
  })

  it('erro de rede não deixa lock preso', async () => {
    const { base } = deps({ fetchFiles: async () => { throw new Error('offline') } })
    const result = await runReadyAutomation(base)
    expect(result.phase).toBe('error')
    expect(isLocked(ITEM.i)).toBe(false)
  })

  it('estado da esteira é persistido e sobrevive ao reload', async () => {
    const { base } = deps({ fetchFiles: async () => ({ ok: true, folderId: 'F', files: [] }) })
    await runReadyAutomation(base)
    reloadReadyStates()
    expect(getReadyState(ITEM.i)?.phase).toBe('not_found')
    clearReadyState(ITEM.i)
    expect(getReadyState(ITEM.i)).toBeUndefined()
  })
})

/**
 * A revarredura passa por dezenas de cards a cada 90s. Quando ela auditava cada
 * passagem, o histórico ganhou 412 entradas em uma hora — todas dizendo a mesma
 * coisa ("busca iniciada", "não encontrado") — engordando o `sm_states` e
 * disparando POST atrás de POST. Com sete pessoas reconciliando em cima, cards
 * chegaram a parecer que voltavam sozinhos.
 */
describe('histórico não vira log de varredura', () => {
  const vazio = { fetchFiles: async () => ({ ok: true, folderId: 'F', files: [] }) }

  it('varredura em segundo plano registra o "não encontrado" UMA vez, não a cada passagem', async () => {
    const { base, rec } = deps({ ...vazio, mode: 'background' as const })

    await runReadyAutomation(base)
    const depoisDaPrimeira = rec.audits.length

    // Mais três passagens sobre o mesmo card, sem nada mudar na pasta.
    await runReadyAutomation(base)
    await runReadyAutomation(base)
    await runReadyAutomation(base)

    expect(rec.audits.filter(a => /não encontrado/i.test(a))).toHaveLength(1)
    expect(rec.audits).toHaveLength(depoisDaPrimeira)
  })

  it('varredura em segundo plano nunca registra "busca iniciada"', async () => {
    const { base, rec } = deps({ ...vazio, mode: 'background' as const })
    await runReadyAutomation(base)
    expect(rec.audits.some(a => /busca iniciada/i.test(a))).toBe(false)
  })

  it('quem clicou continua vendo tudo — inclusive a repetição', async () => {
    const { base, rec } = deps({ ...vazio, mode: 'interactive' as const })
    await runReadyAutomation(base)
    await runReadyAutomation(base)
    expect(rec.audits.filter(a => /busca iniciada/i.test(a))).toHaveLength(2)
    expect(rec.audits.filter(a => /não encontrado/i.test(a))).toHaveLength(2)
  })
})
