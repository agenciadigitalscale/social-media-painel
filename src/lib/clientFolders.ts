import { normalizeClientName } from './videoMatch'

/**
 * O painel tem DUAS listas de cliente, e elas discordam.
 *
 * Uma manda no calendário, no financeiro e nos relatórios (`CLIENTS` +
 * `sm_extra_clients`). A outra manda na Inbox e na esteira (`drive_folders`,
 * as pastas registradas no Drive). Medido em 2026-08-08: **24 pastas contra 17
 * clientes**, e 28 dos 98 arquivos parados na Inbox pertencem a nome de pasta
 * que não existe como cliente.
 *
 * Enquanto ninguém compara as duas, o arquivo desses clientes é indistinguível
 * de um arquivo normal — e o diálogo de vincular respondia "Nenhum item em
 * produção para MARINA FENIX", frase que sugere "espere aparecer um card".
 * Nunca vai aparecer: MARINA FENIX não é cliente deste painel.
 */

export type ClientStatus =
  /** Cadastrado e com card disponível para vincular. */
  | 'ok'
  /** Cadastrado, mas nenhum card em produção agora — criar um resolve. */
  | 'no_cards'
  /** A pasta existe no Drive e o cliente não existe no painel. */
  | 'unregistered'

export interface ClientVerdict {
  status: ClientStatus
  /**
   * Cliente cadastrado cujo nome é pedaço (ou contém) o nome da pasta.
   * "Alto da Represa" → "Chalés Alto da Represa"; "Fazendinha Frango D'agua" →
   * "Frango d'Água". O `normalizeClientName` tira acento e pontuação, mas não
   * resolve um nome que é SUBSTRING do outro — e eram 11 arquivos parados por
   * isso.
   */
  similarTo?: string
  message: string
  hint: string
}

/**
 * Acha um cliente cadastrado que provavelmente é o mesmo da pasta.
 *
 * Só sugere; nunca decide. Casar automaticamente aqui significaria vincular
 * criativo de um cliente a card de outro — exatamente o erro que o projeto já
 * pagou uma vez e virou regra ("nada de vínculo por palpite").
 */
export function findSimilarClient(folderName: string, registered: string[]): string | undefined {
  const alvo = normalizeClientName(folderName)
  if (alvo.length < 4) return undefined

  return registered.find(c => {
    const n = normalizeClientName(c)
    if (n === alvo) return undefined
    // Curto demais casa com tudo: "ra" acharia "Padaria R.A" e "Casa de Ração".
    return n.length >= 4 && (n.includes(alvo) || alvo.includes(n))
  })
}

/**
 * O que dizer sobre a pasta deste arquivo.
 *
 * `registered` são os clientes do painel; `clientsWithCards` os que têm ao
 * menos um card disponível para vincular. Separar os dois é o ponto: "não tem
 * card agora" e "não é cliente daqui" pedem ações opostas.
 */
export function clientVerdict(
  folderName: string,
  registered: string[],
  clientsWithCards: Set<string>,
): ClientVerdict {
  const conhecido = registered.some(c => normalizeClientName(c) === normalizeClientName(folderName))

  if (!conhecido) {
    const similarTo = findSimilarClient(folderName, registered)
    return {
      status: 'unregistered',
      similarTo,
      message: similarTo
        ? `A pasta é "${folderName}", mas o cliente cadastrado é "${similarTo}"`
        : `"${folderName}" não é um cliente cadastrado neste painel`,
      hint: similarTo
        ? 'Se for o mesmo cliente, renomeie a pasta ou registre-a no cliente certo em Clientes → 📂. '
          + 'Enquanto os nomes diferirem, nenhum card deste cliente aparece aqui.'
        : 'Cadastre o cliente em Clientes para ele ter calendário, financeiro e relatório — '
          + 'ou o arquivo está numa pasta monitorada por engano.',
    }
  }

  if (!clientsWithCards.has(folderName)) {
    return {
      status: 'no_cards',
      message: `${folderName} não tem card disponível para vincular`,
      hint: 'O cliente está cadastrado, mas nenhum conteúdo dele está em produção. '
        + 'Crie o card do mês para poder vincular este arquivo.',
    }
  }

  return { status: 'ok', message: '', hint: '' }
}
