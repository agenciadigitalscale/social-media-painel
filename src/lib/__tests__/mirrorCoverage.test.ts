import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  coverageTone, fetchCoverage, fmtBytes, hopelessFiles, mirrorPending, pendingFiles,
  type Coverage, type CoverageFile,
} from '../mirrorCoverage'

const file = (p: Partial<CoverageFile>): CoverageFile => ({
  fileId: 'abc1234567', itemId: 1005, client: 'Lareiras Grill',
  filename: 'video.mp4', bytes: 91 * 1024 * 1024, mirrored: false, tooBig: false, ...p,
})

const cov = (p: Partial<Coverage>): Coverage => ({
  ok: true, configured: true, total: 0, mirrored: 0, files: [], ...p,
})

afterEach(() => { vi.unstubAllGlobals() })

describe('fmtBytes', () => {
  it('usa a unidade que a pessoa lê', () => {
    expect(fmtBytes(400 * 1024)).toBe('400 KB')
    expect(fmtBytes(91 * 1024 * 1024)).toBe('91 MB')
    expect(fmtBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
  })

  it('tamanho desconhecido não vira "0"', () => {
    expect(fmtBytes(null)).toBe('—')
    expect(fmtBytes(0)).toBe('—')
  })
})

describe('pendingFiles / hopelessFiles', () => {
  it('só entra na fila o que tem conserto', () => {
    const c = cov({
      total: 3, mirrored: 1,
      files: [
        file({ fileId: 'ja', mirrored: true }),
        file({ fileId: 'falta' }),
        file({ fileId: 'gigante', tooBig: true, bytes: 1_600_000_000 }),
      ],
    })
    expect(pendingFiles(c).map(f => f.fileId)).toEqual(['falta'])
  })

  it('o grande demais é SEPARADO, não escondido', () => {
    // Botá-lo na fila faria o botão falhar toda vez e treinaria a equipe a
    // ignorar o aviso; sumir com ele esconderia um link que pode morrer.
    const c = cov({ files: [file({ fileId: 'gigante', tooBig: true })] })
    expect(pendingFiles(c)).toHaveLength(0)
    expect(hopelessFiles(c).map(f => f.fileId)).toEqual(['gigante'])
  })
})

describe('coverageTone', () => {
  it('"0 de 0" não é sucesso, é silêncio', () => {
    // Pintar de verde uma tela sem dado faria a equipe confiar em nada.
    expect(coverageTone(cov({ total: 0, mirrored: 0 }))).toBe('empty')
  })

  it('espelho desligado tem tom próprio', () => {
    expect(coverageTone(cov({ configured: false, total: 0 }))).toBe('off')
  })

  it('distingue tudo, parte e nada', () => {
    expect(coverageTone(cov({ total: 3, mirrored: 3 }))).toBe('full')
    expect(coverageTone(cov({ total: 3, mirrored: 1 }))).toBe('partial')
    expect(coverageTone(cov({ total: 3, mirrored: 0 }))).toBe('none')
  })
})

describe('fetchCoverage', () => {
  it('lê a resposta do endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: true, configured: true, total: 2, mirrored: 1, files: [file({})] }),
      { headers: { 'Content-Type': 'application/json' } },
    )))
    const c = await fetchCoverage()
    expect(c).toMatchObject({ ok: true, total: 2, mirrored: 1 })
    expect(c.files).toHaveLength(1)
  })

  it('rede fora vira erro explícito, não "nada espelhado"', async () => {
    // Não conseguir PERGUNTAR não é o mesmo que "não está espelhado" — a faixa
    // precisa dizer qual dos dois é.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const c = await fetchCoverage()
    expect(c.error).toBe('offline')
    expect(c.ok).toBe(false)
  })

  it('HTTP ruim também vira erro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })))
    expect((await fetchCoverage()).error).toContain('500')
  })

  it('espelho desligado chega como configured=false, não como falha', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: false, configured: false, error: 'Sem espelho configurado' }),
      { headers: { 'Content-Type': 'application/json' } },
    )))
    const c = await fetchCoverage()
    expect(c.configured).toBe(false)
    expect(coverageTone(c)).toBe('off')
  })
})

describe('mirrorPending', () => {
  it('espelha um de cada vez — em paralelo estouraria subrequest e cota', async () => {
    let ativos = 0
    let pico = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      ativos += 1; pico = Math.max(pico, ativos)
      await new Promise(r => setTimeout(r, 1))
      ativos -= 1
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
    }))

    const r = await mirrorPending([file({ fileId: 'a' }), file({ fileId: 'b' }), file({ fileId: 'c' })])
    expect(pico).toBe(1)
    expect(r).toEqual({ done: 3, failed: 0 })
  })

  it('uma falha não derruba as outras', async () => {
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      n += 1
      if (n === 2) return new Response(JSON.stringify({ ok: false }), { status: 502 })
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
    }))

    const r = await mirrorPending([file({ fileId: 'a' }), file({ fileId: 'b' }), file({ fileId: 'c' })])
    expect(r).toEqual({ done: 2, failed: 1 })
  })

  it('200 com ok:false conta como falha — o endpoint recusa assim', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: false, error: 'Arquivo desconhecido' }),
      { headers: { 'Content-Type': 'application/json' } },
    )))
    expect(await mirrorPending([file({})])).toEqual({ done: 0, failed: 1 })
  })

  it('reporta progresso a cada arquivo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } },
    )))
    const passos: number[] = []
    await mirrorPending([file({ fileId: 'a' }), file({ fileId: 'b' })], d => passos.push(d))
    expect(passos).toEqual([1, 2])
  })

  it('lista vazia não chama a rede', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    expect(await mirrorPending([])).toEqual({ done: 0, failed: 0 })
    expect(f).not.toHaveBeenCalled()
  })
})
