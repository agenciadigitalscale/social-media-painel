// ── Instagram automation — agendamento e publicação automática ─────────────
// API base: /api/instagram (functions/api/instagram.ts → Cloudflare D1)

const API = '/api/instagram'

export interface IGSchedule {
  id: string
  client_name: string
  item_id: number
  scheduled_at: string
  media_type: string
  status: 'pending' | 'published' | 'failed' | 'cancelled'
  error?: string
  published_at?: string
}

// ── Verifica se cliente tem token IG configurado ─────────────────────────
export async function clientHasIG(clientName: string): Promise<boolean> {
  try {
    const r = await fetch(`${API}?action=tokens&clientName=${encodeURIComponent(clientName)}`)
    const d = await r.json() as { ok: boolean; configured?: boolean }
    return d.ok && !!d.configured
  } catch { return false }
}

// ── Busca todos os agendamentos ──────────────────────────────────────────
export async function fetchAllIGSchedules(): Promise<IGSchedule[]> {
  try {
    const r = await fetch(`${API}?action=list`)
    const d = await r.json() as { ok: boolean; schedules?: IGSchedule[] }
    return d.ok ? (d.schedules ?? []) : []
  } catch { return [] }
}

// ── Busca agendamentos de um cliente específico ──────────────────────────
export async function fetchClientIGSchedules(clientName: string): Promise<IGSchedule[]> {
  try {
    const r = await fetch(`${API}?action=list&clientName=${encodeURIComponent(clientName)}`)
    const d = await r.json() as { ok: boolean; schedules?: IGSchedule[] }
    return d.ok ? (d.schedules ?? []) : []
  } catch { return [] }
}

// ── Agenda um item para publicação automática ────────────────────────────
// Posta na data do conteúdo às `hour` horas (padrão 9h)
// Se a data já passou, agenda para 10 minutos a partir de agora
export async function scheduleItemIG(
  clientName: string,
  itemId: number,
  postDate: Date,
  imageUrl: string,
  caption: string,
  mediaType: 'IMAGE' | 'REELS',
  hour = 9
): Promise<{ ok: boolean; scheduleId?: string; error?: string }> {
  const at = new Date(postDate)
  at.setHours(hour, 0, 0, 0)
  if (at < new Date()) at.setTime(Date.now() + 10 * 60 * 1000)

  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'schedule',
        clientName,
        itemId,
        scheduledAt: at.toISOString(),
        imageUrl,
        caption,
        mediaType,
      }),
    })
    return await r.json() as { ok: boolean; scheduleId?: string; error?: string }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ── Publica um agendamento imediatamente ─────────────────────────────────
export async function publishScheduleNow(
  scheduleId: string
): Promise<{ ok: boolean; postId?: string; itemId?: number; error?: string }> {
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish', scheduleId }),
    })
    return await r.json() as { ok: boolean; postId?: string; itemId?: number; error?: string }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ── Cancela um agendamento ───────────────────────────────────────────────
export async function cancelScheduleIG(scheduleId: string): Promise<void> {
  await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel', scheduleId }),
  }).catch(() => {})
}

// ── Busca posts pendentes prontos para publicar (scheduled_at <= agora) ──
export async function fetchPendingIG(): Promise<{
  id: string; item_id: number; client_name: string;
  image_url: string; caption: string; media_type: string
}[]> {
  try {
    const r = await fetch(`${API}?action=pending`)
    const d = await r.json() as { ok: boolean; pending?: unknown[] }
    return d.ok ? (d.pending as typeof fetchPendingIG extends () => Promise<infer T> ? T : never) ?? [] : []
  } catch { return [] }
}
