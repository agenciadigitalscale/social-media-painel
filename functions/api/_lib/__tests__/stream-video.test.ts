import { describe, expect, it } from 'vitest'
import {
  interpretarResposta, lerResposta, streamDisponivel, urlDaMiniatura, urlDeOrigem, urlDoPlayer,
  valeTranscodificar,
} from '../stream-video'

describe('disponibilidade', () => {
  it('sem token, nada acontece', () => {
    expect(streamDisponivel({})).toBe(false)
    expect(streamDisponivel({ STREAM_API_TOKEN: '' })).toBe(false)
    expect(streamDisponivel({ STREAM_API_TOKEN: 'x' })).toBe(true)
  })
})

describe('url de onde o Stream busca', () => {
  it('aponta para o nosso /api/stream, com o kind que o Safari exige', () => {
    expect(urlDeOrigem('https://painel.pages.dev', 'abc123'))
      .toBe('https://painel.pages.dev/api/stream?id=abc123&kind=video')
  })

  it('não duplica a barra quando a origem termina com uma', () => {
    expect(urlDeOrigem('https://painel.pages.dev/', 'abc'))
      .toBe('https://painel.pages.dev/api/stream?id=abc&kind=video')
  })

  it('escapa o id — ele vem de nome de arquivo do Drive', () => {
    expect(urlDeOrigem('https://x.dev', 'a b&c')).toContain('id=a%20b%26c')
  })
})

describe('leitura da resposta da API', () => {
  it('pronto para tocar', () => {
    expect(interpretarResposta({ success: true, result: { uid: 'u1', status: { state: 'ready' } } }))
      .toEqual({ ok: true, uid: 'u1', estado: 'ready', erro: undefined })
  })

  it('ainda transcodificando', () => {
    const r = interpretarResposta({ success: true, result: { uid: 'u1', status: { state: 'inprogress' } } })
    expect(r.ok).toBe(true)
    expect(r.estado).toBe('inprogress')
  })

  it('estado desconhecido conta como em andamento, não como pronto', () => {
    // Falhar para o lado seguro: dizer "pronto" cedo demais entregaria ao
    // cliente um player que ainda não toca.
    const r = interpretarResposta({ success: true, result: { uid: 'u1', status: { state: 'downloading' } } })
    expect(r.estado).toBe('inprogress')
  })

  it('sem status nenhum também não vira pronto', () => {
    expect(interpretarResposta({ success: true, result: { uid: 'u1' } }).estado).toBe('inprogress')
  })

  it('erro de transcodificação traz o motivo', () => {
    const r = interpretarResposta({
      success: true,
      result: { uid: 'u1', status: { state: 'error', errorReasonText: 'codec não suportado' } },
    })
    expect(r.estado).toBe('error')
    expect(r.erro).toBe('codec não suportado')
  })

  it('erro sem motivo ainda diz alguma coisa', () => {
    const r = interpretarResposta({ success: true, result: { uid: 'u1', status: { state: 'error' } } })
    expect(r.erro).toBe('falhou ao transcodificar')
  })

  it('a API recusou — junta as mensagens', () => {
    const r = interpretarResposta({
      success: false,
      errors: [{ message: 'token inválido' }, { message: 'conta sem Stream' }],
    })
    expect(r.ok).toBe(false)
    expect(r.erro).toBe('token inválido; conta sem Stream')
  })

  it('recusa sem mensagem não devolve string vazia', () => {
    expect(interpretarResposta({ success: false, errors: [] }).erro).toBe('a API do Stream recusou')
  })

  it('resposta sem uid não é sucesso', () => {
    expect(interpretarResposta({ success: true, result: {} }))
      .toEqual({ ok: false, erro: 'resposta sem uid' })
  })

  it('lixo não estoura', () => {
    expect(interpretarResposta(null).ok).toBe(false)
    expect(interpretarResposta('texto').ok).toBe(false)
    expect(interpretarResposta(undefined).ok).toBe(false)
  })
})

describe('urls de entrega', () => {
  it('player e miniatura', () => {
    expect(urlDoPlayer('u1')).toBe('https://iframe.cloudflarestream.com/u1')
    expect(urlDaMiniatura('u1')).toBe('https://videodelivery.net/u1/thumbnails/thumbnail.jpg')
  })
})

describe('o que vale transcodificar', () => {
  const MB = 1024 * 1024

  it('vídeo grande, sim', () => {
    expect(valeTranscodificar('video/mp4', 'reel.mp4', 90 * MB)).toBe(true)
    expect(valeTranscodificar('video/quicktime', 'reel.mov', 80 * MB)).toBe(true)
  })

  it('imagem, nunca — o Stream é de vídeo e a mediana delas é 1,2 MB', () => {
    expect(valeTranscodificar('image/png', 'arte.png', 90 * MB)).toBe(false)
    expect(valeTranscodificar('image/jpeg', 'foto.jpg', 2 * MB)).toBe(false)
  })

  it('vídeo pequeno não vale o minuto de armazenamento', () => {
    expect(valeTranscodificar('video/mp4', 'curto.mp4', 3 * MB)).toBe(false)
  })

  it('sem mime, decide pela extensão — 218 registros do banco não têm mime', () => {
    expect(valeTranscodificar(null, 'reel.mov', 90 * MB)).toBe(true)
    expect(valeTranscodificar(undefined, 'reel.MP4', 90 * MB)).toBe(true)
    expect(valeTranscodificar(null, 'arte.png', 90 * MB)).toBe(false)
  })

  it('sem mime e sem extensão conhecida, não manda', () => {
    expect(valeTranscodificar(null, 'arquivo-sem-extensao', 90 * MB)).toBe(false)
  })
})

describe('leitura da resposta HTTP — o status precisa sobreviver', () => {
  const resp = (body: string, status = 200) =>
    new Response(body, { status }) as unknown as Response

  it('corpo vazio diz o status, e não "Unexpected end of JSON input"', async () => {
    const r = await lerResposta(resp('', 401))
    expect(r.ok).toBe(false)
    expect(r.erro).toBe('HTTP 401 com corpo vazio')
  })

  it('HTML de erro aparece no diagnóstico', async () => {
    const r = await lerResposta(resp('<html>403 Forbidden</html>', 403))
    expect(r.erro).toContain('HTTP 403')
    expect(r.erro).toContain('Forbidden')
  })

  it('corpo enorme é cortado — o erro vai para uma coluna do banco', async () => {
    const r = await lerResposta(resp('x'.repeat(5000), 500))
    expect((r.erro ?? '').length).toBeLessThan(200)
  })

  it('JSON de recusa ganha o código HTTP junto', async () => {
    const r = await lerResposta(resp(JSON.stringify({
      success: false, errors: [{ message: 'conta sem Stream' }],
    }), 404))
    expect(r.erro).toBe('HTTP 404: conta sem Stream')
  })

  it('sucesso passa limpo, sem prefixo de status', async () => {
    const r = await lerResposta(resp(JSON.stringify({
      success: true, result: { uid: 'u9', status: { state: 'inprogress' } },
    })))
    expect(r).toEqual({ ok: true, uid: 'u9', estado: 'inprogress', erro: undefined })
  })
})
