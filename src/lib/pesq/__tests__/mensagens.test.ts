import { describe, expect, it } from 'vitest'
import { enviarPeloWhatsapp, montarMensagem, previewConversa } from '../mensagens'
import { PESQ_CONFIG_PADRAO, type PesqConfig, type PesqPublicacao } from '../publicacoes'

const AGORA = new Date('2026-08-26T12:00:00').getTime()

const config: PesqConfig = { ...PESQ_CONFIG_PADRAO, destino: '11912345678', nomeDestino: 'Arthur' }

function base(patch: Partial<PesqPublicacao> = {}): PesqPublicacao {
  return {
    id: 'p1',
    codigo: 'PESQ-9K2M',
    titulo: 'Bastidores da pescaria',
    formato: 'Reels',
    agendadoPara: AGORA,
    driveLink: 'https://drive.google.com/file/d/abc123/view',
    finalizarNoEdits: true,
    status: 'aguardando',
    responsavel: 'arthur',
    intervaloMin: 2,
    lembretes: [],
    historico: [],
    criadoEm: AGORA,
    atualizadoEm: AGORA,
    ...patch,
  }
}

describe('mensagem de estreia', () => {
  const msg = montarMensagem(base(), config, 'capa', AGORA)

  it('traz código, título, horário e link', () => {
    expect(msg).toContain('PESQ-9K2M')
    expect(msg).toContain('Bastidores da pescaria')
    expect(msg).toContain('hoje, 12:00')
    expect(msg).toContain('https://drive.google.com/file/d/abc123/view')
  })

  it('avisa do Instagram Edits — é o passo que faz alguém subir a versão crua', () => {
    expect(msg).toContain('Instagram Edits')
    expect(montarMensagem(base({ finalizarNoEdits: false }), config, 'capa', AGORA))
      .not.toContain('Instagram Edits')
  })

  it('chama o destino pelo nome', () => {
    expect(msg).toContain('Arthur')
  })
})

describe('lembretes seguintes', () => {
  it('numeram a partir do que já saiu', () => {
    const pub = base({ lembretes: [
      { ts: AGORA - 4 * 60_000, tipo: 'capa', ok: true },
      { ts: AGORA - 2 * 60_000, tipo: 'texto', ok: true },
    ] })
    expect(montarMensagem(pub, config, 'texto', AGORA)).toContain('Lembrete 3')
  })

  it('pedem a confirmação no painel — é o que faz os lembretes pararem', () => {
    expect(montarMensagem(base(), config, 'texto', AGORA)).toContain('Confirme na Central')
  })
})

describe('prévia da conversa', () => {
  it('mostra o que já foi e o que está por enviar', () => {
    const pub = base({ lembretes: [
      { ts: AGORA - 2 * 60_000, tipo: 'capa', ok: true },
      { ts: AGORA - 1 * 60_000, tipo: 'texto', ok: false, erro: 'pop-up bloqueado' },
    ] })
    const { enviadas, proxima, tipoProxima } = previewConversa(pub, config, AGORA)
    expect(enviadas).toHaveLength(1)      // a falha não virou bolha: ninguém a recebeu
    expect(enviadas[0].capa).toBe(true)
    expect(tipoProxima).toBe('texto')
    expect(proxima?.enviada).toBe(false)
  })

  it('sem histórico, a próxima é a capa', () => {
    const { enviadas, tipoProxima } = previewConversa(base(), config, AGORA)
    expect(enviadas).toHaveLength(0)
    expect(tipoProxima).toBe('capa')
  })
})

describe('envio assistido', () => {
  it('sem destino, recusa com frase legível — não abre nada', async () => {
    const r = await enviarPeloWhatsapp('   ', 'oi')
    expect(r.ok).toBe(false)
    expect(r.erro).toMatch(/destino/i)
  })

  it('número incompleto é recusado antes de abrir o WhatsApp', async () => {
    const r = await enviarPeloWhatsapp('9123', 'oi')
    expect(r.ok).toBe(false)
    expect(r.erro).toMatch(/incompleto/i)
  })
})
