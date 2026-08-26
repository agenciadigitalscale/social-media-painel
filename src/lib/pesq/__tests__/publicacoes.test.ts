import { describe, expect, it } from 'vitest'
import {
  cancelarPublicacao, codigoDe, confirmarPublicacao, contagem, criarPublicacao, deInputLocal,
  desde, editarPublicacao, filaDeLembretes, lembreteVencido, lembretesEnviados, novoCodigo,
  paraInputLocal, pausarPublicacao, proximoLembreteEm, quando, registrarLembrete, resumo,
  retomarPublicacao, tipoDoProximoLembrete, PESQ_CONFIG_PADRAO,
  type PesqPublicacao,
} from '../publicacoes'

const AGORA = new Date('2026-08-26T12:00:00').getTime()
const MIN = 60_000

function base(patch: Partial<PesqPublicacao> = {}): PesqPublicacao {
  return {
    id: 'p1',
    codigo: 'PESQ-TEST',
    titulo: 'Bastidores da pescaria',
    formato: 'Reels',
    agendadoPara: AGORA - 10 * MIN,
    finalizarNoEdits: true,
    status: 'aguardando',
    responsavel: 'arthur',
    intervaloMin: 2,
    lembretes: [],
    historico: [],
    criadoEm: AGORA - 60 * MIN,
    atualizadoEm: AGORA - 60 * MIN,
    ...patch,
  }
}

describe('quando cai o próximo lembrete', () => {
  it('antes do horário combinado, o primeiro aviso é o próprio horário', () => {
    const pub = base({ agendadoPara: AGORA + 30 * MIN })
    expect(proximoLembreteEm(pub, AGORA)).toBe(AGORA + 30 * MIN)
    expect(lembreteVencido(pub, AGORA)).toBe(false)
  })

  it('passado o horário e sem nenhum aviso, está vencido', () => {
    expect(lembreteVencido(base(), AGORA)).toBe(true)
  })

  it('conta a partir da última tentativa, com o intervalo da publicação', () => {
    const pub = base({ lembretes: [{ ts: AGORA - 1 * MIN, tipo: 'capa', ok: true }] })
    expect(proximoLembreteEm(pub, AGORA)).toBe(AGORA + 1 * MIN)
  })

  it('uma falha NÃO congela o relógio — senão a fila morria quando mais importa', () => {
    const pub = base({
      status: 'falha_whatsapp',
      lembretes: [{ ts: AGORA - 3 * MIN, tipo: 'capa', ok: false, erro: 'pop-up bloqueado' }],
    })
    expect(proximoLembreteEm(pub, AGORA)).toBe(AGORA - 1 * MIN)
    expect(lembreteVencido(pub, AGORA)).toBe(true)
  })

  it('publicado, pausado e cancelado saem da fila', () => {
    for (const status of ['publicado', 'pausado', 'cancelado'] as const) {
      expect(proximoLembreteEm(base({ status }), AGORA)).toBeNull()
    }
  })

  it('a fila ordena por urgência: vencido antes do que ainda vai vencer', () => {
    const atrasado = base({ id: 'a', agendadoPara: AGORA - 20 * MIN })
    const futuro   = base({ id: 'b', agendadoPara: AGORA + 5 * MIN })
    const fora     = base({ id: 'c', status: 'publicado' })
    const fila = filaDeLembretes([futuro, fora, atrasado], AGORA)
    expect(fila.map(p => p.id)).toEqual(['a', 'b'])
  })
})

describe('capa só na estreia', () => {
  it('o primeiro é com capa', () => {
    expect(tipoDoProximoLembrete(base())).toBe('capa')
  })

  it('depois de um aviso que saiu, os seguintes são texto', () => {
    const pub = base({ lembretes: [{ ts: AGORA, tipo: 'capa', ok: true }] })
    expect(tipoDoProximoLembrete(pub)).toBe('texto')
  })

  it('tentativa que FALHOU não gasta a capa — o cliente nunca a viu', () => {
    const pub = base({ lembretes: [{ ts: AGORA, tipo: 'capa', ok: false, erro: 'sem destino' }] })
    expect(tipoDoProximoLembrete(pub)).toBe('capa')
  })
})

describe('registro do lembrete', () => {
  it('sucesso muda o status e conta', () => {
    const pub = registrarLembrete(base(), { ok: true, tipo: 'capa' }, 'arthur', AGORA)
    expect(pub.status).toBe('lembrete_enviado')
    expect(lembretesEnviados(pub)).toBe(1)
    expect(pub.historico[pub.historico.length - 1].acao).toContain('aberto no WhatsApp')
  })

  it('falha marca falha_whatsapp e guarda o motivo, sem contar como enviado', () => {
    const pub = registrarLembrete(
      base(), { ok: false, tipo: 'capa', erro: 'O navegador bloqueou a janela' }, 'arthur', AGORA,
    )
    expect(pub.status).toBe('falha_whatsapp')
    expect(lembretesEnviados(pub)).toBe(0)
    expect(pub.lembretes[pub.lembretes.length - 1].erro).toContain('bloqueou')
  })
})

describe('transições', () => {
  it('confirmar encerra a fila e carimba a hora', () => {
    const pub = confirmarPublicacao(base(), 'arthur', AGORA)
    expect(pub.status).toBe('publicado')
    expect(pub.publicadoEm).toBe(AGORA)
    expect(proximoLembreteEm(pub, AGORA)).toBeNull()
  })

  it('retomar não dispara enxurrada: o próximo lembrete fica no futuro', () => {
    const pausada = pausarPublicacao(
      base({ lembretes: [{ ts: AGORA - 40 * MIN, tipo: 'capa', ok: true }] }), 'arthur', AGORA - 30 * MIN,
    )
    const viva = retomarPublicacao(pausada, 'arthur', AGORA)
    const proximo = proximoLembreteEm(viva, AGORA)
    expect(proximo).not.toBeNull()
    expect(proximo! > AGORA).toBe(true)
    expect(lembretesEnviados(viva)).toBe(1)  // retomar não inventa aviso
  })

  it('retomar uma publicação que nunca avisou volta para "aguardando"', () => {
    const viva = retomarPublicacao(pausarPublicacao(base(), 'arthur', AGORA), 'arthur', AGORA)
    expect(viva.status).toBe('aguardando')
  })

  it('cancelar preserva o histórico', () => {
    const pub = cancelarPublicacao(base({ historico: [{ ts: 1, autor: 'arthur', acao: 'Publicação criada' }] }), 'kaique', AGORA)
    expect(pub.status).toBe('cancelado')
    expect(pub.historico).toHaveLength(2)
  })

  it('editar troca só o que veio no patch', () => {
    const pub = editarPublicacao(base(), { titulo: 'Novo nome' }, 'kaique', AGORA)
    expect(pub.titulo).toBe('Novo nome')
    expect(pub.formato).toBe('Reels')
    expect(pub.intervaloMin).toBe(2)
  })
})

describe('criação', () => {
  it('Reels já nasce marcado para o Instagram Edits; Foto, não', () => {
    const reels = criarPublicacao(
      { titulo: 'Reels', formato: 'Reels', agendadoPara: AGORA }, PESQ_CONFIG_PADRAO, [], 'arthur', AGORA,
    )
    const foto = criarPublicacao(
      { titulo: 'Foto', formato: 'Foto', agendadoPara: AGORA }, PESQ_CONFIG_PADRAO, [], 'arthur', AGORA,
    )
    expect(reels.finalizarNoEdits).toBe(true)
    expect(foto.finalizarNoEdits).toBe(false)
  })

  it('o código não colide com os que já existem', () => {
    const primeiro = codigoDe(AGORA)
    const livre = novoCodigo([primeiro], AGORA)
    expect(livre).not.toBe(primeiro)
    expect(livre).toMatch(/^PESQ-[0-9A-Z]{4}$/)
  })

  it('o alfabeto do código não tem I, L, O nem U (confusão com 1, 0 e V)', () => {
    const codigos = Array.from({ length: 400 }, (_, i) => codigoDe(AGORA + i * 7919))
    expect(codigos.some(c => /[ILOU]/.test(c.slice(5)))).toBe(false)
  })
})

describe('resumo', () => {
  it('conta fila, publicados de hoje, lembretes e falhas', () => {
    const ontem = new Date(AGORA); ontem.setDate(ontem.getDate() - 1)
    const pubs = [
      base({ id: '1' }),
      base({ id: '2', status: 'publicado', publicadoEm: AGORA - 2 * MIN }),
      base({ id: '3', status: 'publicado', publicadoEm: ontem.getTime() }),
      base({ id: '4', status: 'falha_whatsapp', lembretes: [{ ts: AGORA - MIN, tipo: 'capa', ok: false }] }),
      base({ id: '5', lembretes: [{ ts: AGORA - MIN, tipo: 'capa', ok: true }] }),
    ]
    const r = resumo(pubs, AGORA)
    expect(r.aguardando).toBe(3)          // 1, 4 e 5 ainda pedem ação
    expect(r.publicadosHoje).toBe(1)      // o de ontem não conta
    expect(r.lembretesEnviados).toBe(1)   // a falha não conta
    expect(r.falhas).toBe(1)
    expect(r.proximo?.pub.id).toBe('1')
  })

  it('sem nada na fila, não inventa um "próximo"', () => {
    expect(resumo([base({ status: 'publicado' })], AGORA).proximo).toBeNull()
  })
})

describe('formatação', () => {
  it('contagem regressiva', () => {
    expect(contagem(0)).toBe('agora')
    expect(contagem(-5000)).toBe('agora')
    expect(contagem(42_000)).toBe('0:42')
    expect(contagem(125_000)).toBe('2:05')
    expect(contagem(3 * 3600_000 + 20 * MIN)).toBe('3 h 20')
    expect(contagem(50 * 3600_000)).toBe('2 d 2 h')
  })

  it('tempo decorrido', () => {
    expect(desde(AGORA - 20_000, AGORA)).toBe('agora mesmo')
    expect(desde(AGORA - 3 * MIN, AGORA)).toBe('há 3 min')
    expect(desde(AGORA - 5 * 3600_000, AGORA)).toBe('há 5 h')
  })

  it('data com referência a hoje e amanhã', () => {
    expect(quando(AGORA, AGORA)).toMatch(/^hoje, 12:00$/)
    expect(quando(AGORA + 86_400_000, AGORA)).toMatch(/^amanhã, /)
    expect(quando(AGORA - 86_400_000, AGORA)).toMatch(/^ontem, /)
  })

  it('o campo de data e hora não escorrega de fuso', () => {
    const ida = paraInputLocal(AGORA)
    expect(ida).toBe('2026-08-26T12:00')
    expect(deInputLocal(ida)).toBe(AGORA)
    expect(deInputLocal('não é data')).toBeNull()
  })
})
