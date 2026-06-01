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
  return `Olá, ${clientName}! Tudo bem? 😊\n\nFinalizamos o conteúdo: *${contentTitle}*\n${trafficLine}\nVocê pode visualizar, aprovar ou solicitar alterações pelo link abaixo:\n\n${approvalUrl}\n\nFico no aguardo da sua aprovação! 🙏`
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

// ── Z-API (backend send) ──────────────────────────────────────────────────────

/** Envia mensagem de texto via Z-API (backend Cloudflare Worker).
 *  Retorna true se enviado com sucesso. */
export async function sendViaZApi(phone: string, message: string): Promise<boolean> {
  try {
    const res = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send-text', phone: formatPhoneForWhatsApp(phone), message }),
    })
    const data = await res.json() as { ok: boolean }
    return data.ok === true
  } catch {
    return false
  }
}

/** Envia alerta automático para o telefone/grupo da equipe configurado no backend
 *  via variável de ambiente ZAPI_TEAM_PHONE. */
export async function sendTeamAlert(message: string): Promise<boolean> {
  try {
    const res = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send-team-alert', message }),
    })
    const data = await res.json() as { ok: boolean }
    return data.ok === true
  } catch {
    return false
  }
}

/** Envia múltiplos alertas em lote (relatório mensal).
 *  Retorna { sent, failed } contagens. */
export async function sendBulkViaZApi(
  items: { phone: string; message: string }[]
): Promise<{ sent: number; failed: number }> {
  const normalized = items.map(({ phone, message }) => ({
    phone: formatPhoneForWhatsApp(phone),
    message,
  }))
  try {
    const res = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send-bulk', items: normalized }),
    })
    const data = await res.json() as { ok: boolean; sent?: number; failed?: number }
    return { sent: data.sent ?? 0, failed: data.failed ?? items.length }
  } catch {
    return { sent: 0, failed: items.length }
  }
}

/** Verifica se o backend Z-API está configurado (tem credenciais). */
export async function isZApiConfigured(): Promise<boolean> {
  try {
    const res = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check' }),
    })
    const data = await res.json() as { ok: boolean; configured?: boolean }
    return data.ok === true && data.configured === true
  } catch {
    return false
  }
}
