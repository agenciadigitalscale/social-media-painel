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
  // A linha do download não é enfeite: o pedido "manda o vídeo aberto" chegava
  // DEPOIS de o cliente já ter aberto o link, e alguém da equipe ia buscar o
  // arquivo no Drive à mão. Dizer de antemão que dá para baixar ali mesmo
  // encerra a ida e volta antes de ela começar.
  return `Olá, ${clientName}! 😊\n\n*${contentTitle}* está pronto para aprovação.${trafficLine}\n\nVisualize e nos dê seu feedback pelo link:\n${approvalUrl}\n\n_No link você também pode baixar o arquivo em alta qualidade._\n\nAguardamos seu retorno! 🙏`
}

/** Nome do cliente que guarda o link do grupo de revisão interna da agência */
export const REVIEW_CLIENT = 'Digital Scale'

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Aceita "Digital Scale", "DIGITAL SCALE", "Digital Scale Revisão"… — o cadastro é feito à mão */
export function isReviewClientName(name: string): boolean {
  return normalizeName(name).includes(normalizeName(REVIEW_CLIENT))
}

/** Extrai o convite de grupo mesmo colado sem protocolo, com /invite/ ou com querystring */
export function normalizeGroupLink(value?: string): string | undefined {
  if (!value) return undefined
  const m = value.trim().match(/(?:https?:\/\/)?chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{6,})/i)
  return m ? `https://chat.whatsapp.com/${m[1]}` : undefined
}

/** Primeiro link de grupo válido entre os cadastros do cliente de revisão */
export function findReviewGroupLink(sources: Array<string | undefined>): string | undefined {
  for (const s of sources) {
    const link = normalizeGroupLink(s)
    if (link) return link
  }
  return undefined
}

export function generateReviewUrl(token: string, itemId: number): string {
  // A versão evita que o WhatsApp reutilize uma miniatura antiga quando o criativo foi reexportado.
  return `${window.location.origin}/r/${token}/${itemId}?v=${Date.now().toString(36)}`
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
