/* lib/pesq/mensagens.ts — O que o WhatsApp recebe.
   Monta o texto do primeiro aviso e o dos lembretes seguintes, e faz o envio
   assistido (abre a conversa com a mensagem pronta).
*/

import { buildWhatsAppUrl, isGroupLink, normalizeGroupLink, openWhatsAppGroup } from '../whatsapp'
import {
  lembretesEnviados, quando, type PesqConfig, type PesqLembreteTipo, type PesqPublicacao,
} from './publicacoes'

const FORMATO_EMOJI: Record<string, string> = {
  Reels: '🎬', Carrossel: '🖼️', Foto: '📷', Stories: '⚡',
}

/**
 * A ESTREIA leva capa: logo, título, miniatura e código, porque é a mensagem
 * que precisa parar o dedo de quem está rolando o WhatsApp. Os lembretes
 * seguintes são texto puro — a mesma imagem chegando de dois em dois minutos
 * vira ruído, e o WhatsApp ainda passa a agrupar as mídias, escondendo
 * justamente o aviso mais recente.
 */
export function montarMensagem(
  pub: PesqPublicacao,
  config: PesqConfig,
  tipo: PesqLembreteTipo,
  agora = Date.now(),
): string {
  const emoji  = FORMATO_EMOJI[pub.formato] ?? '📄'
  const edits  = pub.finalizarNoEdits ? '\n✂️ Finalizar no *Instagram Edits* antes de subir' : ''
  const link   = pub.driveLink ? `\n📎 ${pub.driveLink}` : ''
  const alvo   = config.nomeDestino ? `${config.nomeDestino}, ` : ''

  if (tipo === 'capa') {
    return `🎣 *PESQ · Publicação manual pendente*\n\n`
      + `${alvo}este conteúdo está pronto e só falta ir ao ar:\n\n`
      + `*${pub.codigo}* — ${pub.titulo}\n`
      + `${emoji} ${pub.formato} · ${quando(pub.agendadoPara, agora)}${edits}${link}\n\n`
      + `Assim que publicar, confirme na Central de Publicações. 💚`
  }

  const n = lembretesEnviados(pub) + 1
  return `⏰ *Lembrete ${n} · ${pub.codigo}*\n\n`
    + `${pub.titulo}\n`
    + `${emoji} ${pub.formato} · ${quando(pub.agendadoPara, agora)}${edits}${link}\n\n`
    + `Já publicou? Confirme na Central para os lembretes pararem.`
}

/** Uma bolha da conversa simulada. `capa: true` desenha o cartão de estreia. */
export interface PesqBolha {
  id: string
  texto: string
  hora: string
  capa: boolean
  enviada: boolean
}

function hhmm(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * A conversa como ela vai ficar: o que já foi mandado (histórico real) mais a
 * próxima mensagem, ainda por enviar. Ver antes de mandar é o ponto — o custo
 * de um texto errado aqui é um cliente lendo o rascunho da agência.
 */
export function previewConversa(
  pub: PesqPublicacao,
  config: PesqConfig,
  agora = Date.now(),
): { enviadas: PesqBolha[]; proxima: PesqBolha | null; tipoProxima: PesqLembreteTipo } {
  const enviadas: PesqBolha[] = pub.lembretes
    .filter(l => l.ok)
    .map((l, i) => ({
      id: `${pub.id}_${l.ts}_${i}`,
      texto: montarMensagem(
        { ...pub, lembretes: pub.lembretes.slice(0, i) },
        config,
        l.tipo,
        l.ts,
      ),
      hora: hhmm(l.ts),
      capa: l.tipo === 'capa',
      enviada: true,
    }))

  const tipoProxima: PesqLembreteTipo = pub.lembretes.some(l => l.ok) ? 'texto' : 'capa'
  const proxima: PesqBolha | null = {
    id: `${pub.id}_proxima`,
    texto: montarMensagem(pub, config, tipoProxima, agora),
    hora: hhmm(agora),
    capa: tipoProxima === 'capa',
    enviada: false,
  }

  return { enviadas, proxima, tipoProxima }
}

export interface EnvioResultado {
  ok: boolean
  /** Frase pronta para a tela — nunca código de erro cru. */
  erro?: string
  /** Só no grupo: o texto foi para a área de transferência? */
  copiado?: boolean
}

/**
 * Envio assistido: abre a conversa certa com a mensagem pronta.
 *
 * Em grupo o WhatsApp não aceita texto pré-preenchido no link de convite —
 * por isso o texto vai para a área de transferência e a pessoa cola. É o
 * mesmo caminho que o painel já usa na revisão interna; repetir a mecânica
 * evita que a equipe aprenda dois jeitos de fazer a mesma coisa.
 */
export async function enviarPeloWhatsapp(destino: string, mensagem: string): Promise<EnvioResultado> {
  const alvo = destino.trim()
  if (!alvo) return { ok: false, erro: 'Nenhum destino de WhatsApp configurado.' }

  try {
    const grupo = normalizeGroupLink(alvo)
    if (grupo || isGroupLink(alvo)) {
      const copiado = await openWhatsAppGroup(grupo ?? alvo, mensagem)
      return { ok: true, copiado }
    }

    const digitos = alvo.replace(/\D/g, '')
    if (digitos.length < 10) {
      return { ok: false, erro: 'O número configurado está incompleto — confira em Configurar envio.' }
    }

    const janela = window.open(buildWhatsAppUrl(digitos, mensagem), '_blank', 'noopener,noreferrer')
    if (!janela) {
      return { ok: false, erro: 'O navegador bloqueou a janela do WhatsApp. Libere o pop-up e tente de novo.' }
    }
    return { ok: true }
  } catch {
    return { ok: false, erro: 'Não foi possível abrir o WhatsApp neste aparelho.' }
  }
}
