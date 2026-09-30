import { describe, expect, it } from 'vitest'
import { planejarFacebook, publicarNaPagina } from '../fb-publish'
import { normalizarColaboradores, preparar, ESTADO_VAZIO, type Graph, type IgPlano } from '../ig-publish'

const url = (f: { id: string }) => `https://x/${f.id}`
const img = (n: string, mime = 'image/jpeg') => ({ id: n, name: n, mimeType: mime })
const mp4 = (n: string) => ({ id: n, name: `${n}.mp4`, mimeType: 'video/mp4' })

describe('planejarFacebook', () => {
  it('uma arte vira foto; várias viram um post só; PNG passa (ao contrário do Instagram)', () => {
    const um = planejarFacebook('Post', [img('a', 'image/png')], url)
    expect(um.ok && um.plano.tipo).toBe('FOTO')
    const varias = planejarFacebook('Carrossel', [img('a'), img('b')], url)
    expect(varias.ok && varias.plano.tipo).toBe('FOTOS')
  })

  it('Reel vira vídeo na página; story não sai pela integração', () => {
    const r = planejarFacebook('Reel', [mp4('v')], url)
    expect(r.ok && r.plano.tipo).toBe('VIDEO')
    expect(planejarFacebook('Story', [img('a')], url).ok).toBe(false)
  })

  it('vídeo misturado com foto não publica', () => {
    expect(planejarFacebook('Carrossel', [img('a'), mp4('v')], url).ok).toBe(false)
  })
})

describe('publicarNaPagina', () => {
  it('várias fotos: sobem sem publicar e saem num post só, com a descrição', async () => {
    const chamadas: { path: string; body: string }[] = []
    let n = 0
    const g: Graph = {
      base: 'https://g', token: 't',
      fetchFn: (async (u: RequestInfo | URL, init?: RequestInit) => {
        const path = String(u).replace('https://g', '')
        chamadas.push({ path, body: String(init?.body ?? '') })
        return new Response(JSON.stringify(path.endsWith('/feed') ? { id: 'post1' } : { id: `foto${++n}` }))
      }) as typeof fetch,
    }
    const r = await publicarNaPagina(g, '99', { tipo: 'FOTOS', midias: [{ url: 'a', video: false, nome: 'a' }, { url: 'b', video: false, nome: 'b' }] }, 'Minha legenda')
    expect(r).toEqual({ ok: true, id: 'post1' })
    expect(chamadas.map(c => c.path)).toEqual(['/99/photos', '/99/photos', '/99/feed'])
    expect(chamadas[0].body).toContain('published=false')
    const post = new URLSearchParams(chamadas[2].body)
    expect(post.get('message')).toBe('Minha legenda')
    expect(post.get('attached_media[1]')).toBe('{"media_fbid":"foto2"}')
  })
})

describe('colab no Instagram', () => {
  it('normaliza @, repetidos e maiúsculas; barra usuário inválido e mais de 3', () => {
    expect(normalizarColaboradores(['@Loja.X', 'loja.x', ' outra_conta '])).toEqual({ ok: true, lista: ['loja.x', 'outra_conta'] })
    expect(normalizarColaboradores(['com espaço']).ok).toBe(false)
    expect(normalizarColaboradores(['a', 'b', 'c', 'd']).ok).toBe(false)
    expect(normalizarColaboradores(undefined)).toEqual({ ok: true, lista: [] })
  })

  it('o convite vai no post (não nas peças do carrossel)', async () => {
    const corpos: string[] = []
    let n = 0
    const g: Graph = {
      base: 'https://g', token: 't',
      fetchFn: (async (_u: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') corpos.push(decodeURIComponent(String(init.body)))
        return new Response(JSON.stringify(init?.method === 'POST' ? { id: `c${++n}` } : { status_code: 'FINISHED' }))
      }) as typeof fetch,
    }
    const plano: IgPlano = { tipo: 'CAROUSEL', colaboradores: ['parceiro'], midias: [{ url: 'a', video: false, nome: 'a' }, { url: 'b', video: false, nome: 'b' }] }
    await preparar(g, '1', plano, 'leg', ESTADO_VAZIO)
    expect(corpos.slice(0, 2).every(c => !c.includes('collaborators'))).toBe(true)
    expect(corpos[2]).toContain('collaborators=["parceiro"]')
  })
})
