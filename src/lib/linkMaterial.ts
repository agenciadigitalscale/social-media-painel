import type { ItemState } from '../types'

/** Link colado à mão: aceita sem protocolo ("drive.google.com/…") e recusa texto solto. */
export function normalizarLinkMaterial(texto: string): string | null {
  const t = texto.trim()
  if (!t || /\s/.test(t)) return null
  const comProtocolo = /^https?:\/\//i.test(t) ? t : `https://${t}`
  try {
    const u = new URL(comProtocolo)
    return u.hostname.includes('.') ? u.toString() : null
  } catch {
    return null
  }
}

/**
 * Copia texto; quando o navegador recusa a API moderna (aba sem foco, WebView,
 * http), cai no `execCommand` — senão o botão diria "copiado" sem ter copiado.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = texto
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

/**
 * O link do material — a FONTE ÚNICA (2026-10-02). Card externo ("Colar link do
 * material"), "Link do criativo" (card aberto e edição) e a mensagem do cliente
 * leem daqui; toda escrita vai para `linkMaterial`.
 *
 * - `linkMaterial` definido (mesmo vazio) MANDA: vazio = alguém removeu o link.
 * - Card antigo sem `linkMaterial` cai no `link` (o campo que o "Link do
 *   criativo" gravava antes) — o link que já existia não some.
 * - Só vale se for link de verdade: nome de arquivo colado no campo
 *   ("Cliente - título [K5SY].mp4") nunca vira o link da mensagem.
 */
export function linkDoMaterial(state: Pick<ItemState, 'linkMaterial' | 'link'> | null | undefined): string {
  if (!state) return ''
  const bruto = state.linkMaterial !== undefined ? state.linkMaterial : state.link
  return normalizarLinkMaterial(bruto ?? '') ?? ''
}
