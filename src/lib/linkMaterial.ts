import type { ContentItem, ItemState } from '../types'
import { generateApprovalMessage } from './whatsapp'

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

/** A mensagem padrão do cliente, com o link que o editor colou no card. */
export function mensagemDoMaterial(item: ContentItem, state: ItemState, link: string): string {
  return generateApprovalMessage(item.c, state.title || item.n, link, state.isTraffic)
}
