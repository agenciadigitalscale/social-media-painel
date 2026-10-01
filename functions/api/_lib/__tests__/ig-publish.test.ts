import { describe, expect, it } from 'vitest'
import { ESTADO_VAZIO, planejar, preparar, publicar, traduzErro, type Graph, type IgPlano } from '../ig-publish'

const url = (f: { id: string }, video: boolean) => `https://x/api/stream?id=${f.id}&kind=${video ? 'video' : 'image'}`
const jpg = (n: string) => ({ id: n, name: `${n}.jpg`, mimeType: 'image/jpeg' })
const png = (n: string) => ({ id: n, name: `${n}.png`, mimeType: 'image/png' })
const mp4 = (n: string) => ({ id: n, name: `${n}.mp4`, mimeType: 'video/mp4' })

describe('planejar', () => {
  it('Reel vira REELS com o vídeo', () => {
    const r = planejar('Reel', [mp4('v')], url)
    expect(r.ok && r.plano.tipo).toBe('REELS')
  })

  it('Reel em que o Social anexou arte sai como post — o anexo manda, não o tipo do card', () => {
    const r = planejar('Reel', [jpg('a')], url)
    expect(r.ok && r.plano.tipo).toBe('IMAGE')
    const varias = planejar('Reel', [jpg('a'), jpg('b')], url)
    expect(varias.ok && varias.plano.tipo).toBe('CAROUSEL')
  })

  it('post com uma arte vira IMAGE; com várias, carrossel na ordem', () => {
    const um = planejar('Post', [jpg('a')], url)
    expect(um.ok && um.plano.tipo).toBe('IMAGE')
    const varios = planejar('Carrossel', [jpg('a'), jpg('b'), mp4('c')], url)
    expect(varios.ok && varios.plano.tipo).toBe('CAROUSEL')
    expect(varios.ok && varios.plano.midias.map(m => m.video)).toEqual([false, false, true])
  })

  it('PNG é barrado com o nome do arquivo — a Meta só aceita JPG', () => {
    const r = planejar('Post', [jpg('a'), png('capa')], url)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.motivo).toContain('capa.png')
  })

  it('mais de 10 peças não cabe num carrossel', () => {
    const r = planejar('Carrossel', Array.from({ length: 11 }, (_, i) => jpg(`p${i}`)), url)
    expect(r.ok).toBe(false)
  })

  it('story aceita imagem ou vídeo; card sem criativo não publica', () => {
    const s = planejar('Story', [mp4('v')], url)
    expect(s.ok && s.plano.tipo).toBe('STORIES')
    expect(planejar('Post', [], url).ok).toBe(false)
  })
})

/** Meta falsa: registra as chamadas e responde conforme um roteiro. */
function metaFalsa(roteiro: { status?: Record<string, string>; falharCriacao?: boolean } = {}) {
  const chamadas: string[] = []
  let n = 0
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input)
    const path = u.replace('https://g', '').split('?')[0]
    chamadas.push(`${init?.method ?? 'GET'} ${path}`)
    const ok = (d: unknown) => new Response(JSON.stringify(d))
    if (path.endsWith('/media') && init?.method === 'POST') {
      if (roteiro.falharCriacao) return ok({ error: { message: 'Invalid parameter', code: 100 } })
      return ok({ id: `c${++n}` })
    }
    if (path.endsWith('/media_publish')) return ok({ id: 'post1' })
    const id = path.slice(1)
    return ok({ status_code: roteiro.status?.[id] ?? 'FINISHED', permalink: 'https://instagram.com/p/x' })
  }) as typeof fetch
  const g: Graph = { base: 'https://g', token: 't', fetchFn }
  return { g, chamadas }
}

describe('preparar', () => {
  const imagem: IgPlano = { tipo: 'IMAGE', midias: [{ url: 'u', video: false, nome: 'a.jpg' }] }

  it('imagem: cria o container e fica pronta', async () => {
    const { g, chamadas } = metaFalsa()
    const p = await preparar(g, '123', imagem, 'legenda', ESTADO_VAZIO)
    expect(p.tipo).toBe('pronto')
    expect(p.estado.criacao).toBe('c1')
    expect(chamadas).toEqual(['POST /123/media', 'GET /c1'])
  })

  it('não recria o que já existe quando o tick anterior já criou', async () => {
    const { g, chamadas } = metaFalsa()
    await preparar(g, '123', imagem, '', { filhos: [], criacao: 'c9' })
    expect(chamadas).toEqual(['GET /c9'])
  })

  it('Reel ainda processando: espera, sem publicar', async () => {
    const { g } = metaFalsa({ status: { c1: 'IN_PROGRESS' } })
    const plano: IgPlano = { tipo: 'REELS', midias: [{ url: 'u', video: true, nome: 'v.mp4' }] }
    const p = await preparar(g, '123', plano, '', ESTADO_VAZIO)
    expect(p.tipo).toBe('esperar')
    expect(p.estado.criacao).toBe('c1')
  })

  it('carrossel: cria as peças, depois o pai com os filhos na ordem', async () => {
    const { g, chamadas } = metaFalsa()
    const plano: IgPlano = { tipo: 'CAROUSEL', midias: ['a', 'b', 'c'].map(x => ({ url: x, video: false, nome: `${x}.jpg` })) }
    const p = await preparar(g, '123', plano, 'leg', ESTADO_VAZIO)
    expect(p.tipo).toBe('pronto')
    expect(p.estado.filhos).toEqual(['c1', 'c2', 'c3'])
    expect(p.estado.criacao).toBe('c4')
    expect(chamadas.filter(c => c === 'POST /123/media')).toHaveLength(4)
  })

  it('carrossel com vídeo processando não cria o pai ainda', async () => {
    const { g } = metaFalsa({ status: { c2: 'IN_PROGRESS' } })
    const plano: IgPlano = { tipo: 'CAROUSEL', midias: [{ url: 'a', video: false, nome: 'a.jpg' }, { url: 'b', video: true, nome: 'b.mp4' }] }
    const p = await preparar(g, '123', plano, '', ESTADO_VAZIO)
    expect(p.tipo).toBe('esperar')
    expect(p.estado).toEqual({ filhos: ['c1', 'c2'], criacao: null })
  })

  it('erro da Meta vira falha com a mensagem', async () => {
    const { g } = metaFalsa({ falharCriacao: true })
    const p = await preparar(g, '123', imagem, '', ESTADO_VAZIO)
    expect(p.tipo).toBe('falhou')
  })

  it('o token vai no cabeçalho, nunca na URL', async () => {
    let urlVista = '', auth = ''
    const g: Graph = {
      base: 'https://g', token: 'SEGREDO',
      fetchFn: (async (u: RequestInfo | URL, init?: RequestInit) => {
        urlVista = String(u); auth = (init?.headers as Record<string, string>).Authorization
        return new Response(JSON.stringify({ id: 'p' }))
      }) as typeof fetch,
    }
    await publicar(g, '123', 'c1')
    expect(urlVista).not.toContain('SEGREDO')
    expect(auth).toBe('Bearer SEGREDO')
  })
})

describe('traduzErro', () => {
  it('token vencido pede reconexão', () => {
    expect(traduzErro({ code: 190, message: 'x' })).toMatch(/reconectar/)
  })
})
