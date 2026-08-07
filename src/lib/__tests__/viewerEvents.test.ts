import { describe, expect, it } from 'vitest'
import {
  describeDetail, describePlatform, reachState, summarize,
  type ItemViewerSummary, type ViewerEvent,
} from '../viewerEvents'

const ev = (p: Partial<ViewerEvent>): ViewerEvent => ({
  ts: 1_000, client: 'Lareiras Grill', itemId: 1005, event: 'opened', ...p,
})

describe('describePlatform', () => {
  it('separa o que muda o que a equipe faz — iPhone ou Android', () => {
    expect(describePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)')).toBe('iPhone/iPad')
    expect(describePlatform('Mozilla/5.0 (Linux; Android 13; SM-A536B)')).toBe('Android')
  })

  it('iPad conta como iPhone/iPad, não como Mac', () => {
    // O UA do iPad traz "Mac OS X" — testar na ordem errada classificaria
    // errado justamente o aparelho de cliente.
    expect(describePlatform('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)')).toBe('iPhone/iPad')
  })

  it('sem user agent não inventa aparelho', () => {
    expect(describePlatform(undefined)).toBe('Desconhecido')
  })
})

describe('describeDetail', () => {
  it('traduz cada código do MediaError — "code=4" não diz nada a ninguém', () => {
    expect(describeDetail('video code=2')).toBe('A conexão caiu no meio do vídeo')
    expect(describeDetail('video code=4')).toBe('O aparelho recusou o arquivo sem tentar (mime/formato)')
  })

  it('falha de imagem tem texto próprio', () => {
    expect(describeDetail('imagem: todas as fontes falharam')).toBe('Nenhuma fonte da imagem carregou')
  })

  it('motivo desconhecido passa cru em vez de sumir', () => {
    expect(describeDetail('coisa nova que ainda não mapeamos')).toBe('coisa nova que ainda não mapeamos')
    expect(describeDetail(undefined)).toBe('Motivo não registrado')
  })
})

describe('summarize', () => {
  it('conta aberturas e guarda a mais recente', () => {
    const s = summarize([
      ev({ ts: 100, event: 'opened' }),
      ev({ ts: 300, event: 'opened' }),
      ev({ ts: 200, event: 'opened' }),
    ]).get(1005)!
    expect(s.opens).toBe(3)
    expect(s.lastOpenedAt).toBe(300)
  })

  it('marca que o vídeo chegou a rodar', () => {
    const s = summarize([ev({ event: 'opened' }), ev({ ts: 200, event: 'playing' })]).get(1005)!
    expect(s.played).toBe(true)
  })

  it('abriu mas não rodou é diferente de rodou — são cobranças diferentes', () => {
    const s = summarize([ev({ event: 'opened' })]).get(1005)!
    expect(s.opens).toBe(1)
    expect(s.played).toBe(false)
  })

  it('guarda a última falha com aparelho e motivo', () => {
    const s = summarize([
      ev({ ts: 100, event: 'error', detail: 'video code=2', platform: 'Android' }),
      ev({ ts: 500, event: 'error', detail: 'video code=4', platform: 'iPhone' }),
    ]).get(1005)!
    expect(s.lastFailureAt).toBe(500)
    expect(s.lastFailureDetail).toBe('video code=4')
    expect(s.lastFailurePlatform).toBe('iPhone')
  })

  it('`fallback` conta como falha — o cliente também não viu', () => {
    const s = summarize([ev({ ts: 100, event: 'fallback', detail: 'x' })]).get(1005)!
    expect(s.lastFailureAt).toBe(100)
  })

  it('não mistura os criativos', () => {
    const m = summarize([
      ev({ itemId: 1005, event: 'opened' }),
      ev({ itemId: 2007, event: 'error', detail: 'video code=4' }),
    ])
    expect(m.get(1005)!.opens).toBe(1)
    expect(m.get(1005)!.lastFailureAt).toBeUndefined()
    expect(m.get(2007)!.opens).toBe(0)
    expect(m.get(2007)!.lastFailureAt).toBe(1_000)
  })

  it('card sem registro fica FORA do mapa — ausência de dado não é "não abriu"', () => {
    // A faixa do card se cala nesse caso de propósito: o registro guarda 300
    // eventos por 30 dias, e criativo antigo simplesmente sai da janela.
    expect(summarize([ev({ itemId: 1005 })]).get(9999)).toBeUndefined()
  })
})

describe('reachState — o que a faixa do card afirma', () => {
  const S = (p: Partial<ItemViewerSummary>): ItemViewerSummary => ({ opens: 0, played: false, ...p })
  const SENT = 1_000

  it('sem envio não afirma nada — não há o que comparar', () => {
    expect(reachState(S({ opens: 3, lastOpenedAt: 9_000 }), undefined).kind).toBe('unknown')
  })

  it('sem registro nenhum a faixa se cala', () => {
    // Ausência de dado não é "não abriu": o registro guarda 300 eventos por 30
    // dias, e criativo antigo simplesmente sai da janela. Afirmar "não abriu"
    // aqui mandaria alguém cobrar um cliente que já tinha aprovado.
    expect(reachState(undefined, SENT).kind).toBe('unknown')
  })

  it('há registro do card mas nenhuma abertura → afirma "não abriu"', () => {
    const r = reachState(S({ lastFailureAt: undefined }), SENT)
    expect(r.kind).toBe('not_opened')
    expect(r.at).toBe(SENT)
  })

  it('abriu → conta as vezes e diz se o vídeo rodou', () => {
    const r = reachState(S({ opens: 3, lastOpenedAt: 9_000, played: true }), SENT)
    expect(r).toMatchObject({ kind: 'opened', at: 9_000, opens: 3, played: true })
  })

  it('falha vence abertura da MESMA sessão', () => {
    // O `opened` e o `error` chegam quase juntos e o erro vem depois. Dizer
    // "cliente abriu" seria tecnicamente verdade e praticamente uma mentira.
    const r = reachState(S({ opens: 1, lastOpenedAt: 10_000, lastFailureAt: 10_500, lastFailureDetail: 'video code=4', lastFailurePlatform: 'Android' }), SENT)
    expect(r.kind).toBe('failed')
    expect(r.detail).toBe('video code=4')
    expect(r.platform).toBe('Android')
  })

  it('voltou DEPOIS e conseguiu ver → não fica preso no vermelho', () => {
    // Sem esta regra a falha ganharia para sempre, e um card resolvido
    // continuaria pedindo socorro no painel.
    const r = reachState(S({ opens: 2, lastOpenedAt: 500_000, lastFailureAt: 10_000, played: true }), SENT)
    expect(r.kind).toBe('opened')
    expect(r.at).toBe(500_000)
  })

  it('falhou e nunca mais voltou → segue vermelho', () => {
    const r = reachState(S({ opens: 0, lastFailureAt: 10_000 }), SENT)
    expect(r.kind).toBe('failed')
  })
})
