export function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function isGroupLink(value: string): boolean {
  return value.startsWith('https://chat.whatsapp.com/') || value.startsWith('http://chat.whatsapp.com/')
}

export function formatPhoneForWhatsApp(phone: string): string {
  const cleaned = cleanPhone(phone)
  return cleaned.startsWith('55') ? cleaned : `55${cleaned}`
}

export function generateApprovalUrl(token: string, itemId: number): string {
  return `${window.location.origin}/c/${token}/${itemId}`
}

export function generateApprovalMessage(clientName: string, contentTitle: string, approvalUrl: string, isTraffic?: boolean): string {
  const trafficLine = isTraffic
    ? '\n⚡ *Este criativo será utilizado em tráfego pago (anúncios).*\n'
    : ''
  return `Olá, ${clientName}! 😊\n\n*${contentTitle}* está pronto para aprovação.${trafficLine}\n\nVisualize e nos dê seu feedback pelo link:\n${approvalUrl}\n\nAguardamos seu retorno! 🙏`
}

/** Nome do cliente que guarda o link do grupo de revisão interna da agência */
export const REVIEW_CLIENT = 'Digital Scale'

export function generateReviewUrl(token: string, itemId: number): string {
  return `${window.location.origin}/r/${token}/${itemId}`
}

export function generateReviewMessage(clientName: string, contentTitle: string, reviewUrl: string, author?: string): string {
  const by = author ? ` (${author})` : ''
  return `👁️ *REVISÃO INTERNA*${by}\n\n*${clientName}* — ${contentTitle}\n\nAssista e decida no link:\n${reviewUrl}\n\n✅ Aprovar → vai pra "Pronto p/ enviar"\n🔄 Pedir ajuste → volta pra produção`
}

export function extractDriveFileId(url: string): string | null {
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  return m ? m[1] : null
}

export function checkDriveFilePublic(fileId: string): Promise<boolean> {
  return new Promise(resolve => {
    const img = new Image()
    const t = setTimeout(() => resolve(true), 5000) // timeout assume público para não bloquear o fluxo
    img.onload = () => { clearTimeout(t); resolve(true) }
    img.onerror = () => { clearTimeout(t); resolve(false) }
    img.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w100&t=${Date.now()}`
  })
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const formatted = formatPhoneForWhatsApp(phone)
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`
}

/** Abre WhatsApp individual com mensagem pré-preenchida */
export function openWhatsAppApproval(phone: string, clientName: string, contentTitle: string, approvalUrl: string, isTraffic?: boolean): void {
  const message = generateApprovalMessage(clientName, contentTitle, approvalUrl, isTraffic)
  const url = buildWhatsAppUrl(phone, message)
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** Copia mensagem para clipboard e abre o grupo — retorna true se copiou */
export async function openWhatsAppGroup(groupLink: string, message: string): Promise<boolean> {
  let copied = false
  try {
    await navigator.clipboard.writeText(message)
    copied = true
  } catch {}
  window.open(groupLink, '_blank', 'noopener,noreferrer')
  return copied
}
