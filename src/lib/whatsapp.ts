export function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function formatPhoneForWhatsApp(phone: string): string {
  const cleaned = cleanPhone(phone)
  return cleaned.startsWith('55') ? cleaned : `55${cleaned}`
}

export function generateApprovalUrl(token: string, itemId: number): string {
  return `${window.location.origin}/c/${token}/${itemId}`
}

export function generateApprovalMessage(clientName: string, contentTitle: string, approvalUrl: string): string {
  return `Olá, ${clientName}! Tudo bem? 😊\n\nFinalizamos o conteúdo: *${contentTitle}*\n\nVocê pode visualizar, aprovar ou solicitar alterações pelo link abaixo:\n\n${approvalUrl}\n\nFico no aguardo da sua aprovação! 🙏`
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const formatted = formatPhoneForWhatsApp(phone)
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`
}

export function openWhatsAppApproval(phone: string, clientName: string, contentTitle: string, approvalUrl: string): void {
  const message = generateApprovalMessage(clientName, contentTitle, approvalUrl)
  const url = buildWhatsAppUrl(phone, message)
  window.open(url, '_blank', 'noopener,noreferrer')
}
