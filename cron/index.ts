/**
 * Cron do DS HUB — a esteira andando sem ninguém olhando.
 *
 * O poller do painel só existe enquanto alguém está com o app aberto. Fora do
 * expediente, o vídeo exportado ficava parado na pasta Publicar até o primeiro
 * login do dia seguinte. Este worker chama o mesmo `/api/drive-scan` de tempos
 * em tempos; quem avisa a equipe é o próprio endpoint (Web Push + fila do D1).
 *
 * Ele mora fora do projeto do painel porque **Pages Functions não aceitam cron
 * trigger** — só um Worker aceita. É o único motivo da separação.
 */

interface Env {
  /** URL completa do endpoint de scan no painel. */
  SCAN_URL: string
  /** Mesmo segredo configurado no Pages (`wrangler pages secret put CRON_SECRET`). */
  CRON_SECRET: string
}

interface ScanResponse {
  ok?: boolean
  scanned?: number
  new_videos?: number
  summary?: Record<string, { new_videos: number; error?: string }>
}

async function runScan(env: Env): Promise<void> {
  if (!env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET ausente — o scan responderia 401. Rode `wrangler secret put CRON_SECRET`.')
    return
  }
  if (!env.SCAN_URL) {
    console.error('[cron] SCAN_URL ausente — configure SCAN_URL no cron/wrangler.toml para o endpoint /api/drive-scan do Pages.')
    return
  }

  try {
    const res = await fetch(env.SCAN_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    })
    const body = await res.text()

    if (!res.ok) {
      if (res.status === 401) {
        console.error('[cron] scan falhou com 401. Verifique se CRON_SECRET está correto e se o Pages está usando o mesmo valor.')
      }
      console.error(`[cron] scan falhou (${res.status}): ${body.slice(0, 300)}`)
      return
    }

    const data = JSON.parse(body) as ScanResponse
    // Só loga novidade: assim `wrangler tail` continua legível durante o dia.
    if (data.new_videos) {
      console.log(`[cron] ${data.new_videos} arquivo(s) novo(s) em ${data.scanned} pasta(s)`)
    }
    // Pasta com erro precisa aparecer mesmo sem arquivo novo — costuma ser
    // permissão revogada no Drive, que só se descobre olhando.
    for (const [client, info] of Object.entries(data.summary ?? {})) {
      if (info.error) console.error(`[cron] ${client}: ${info.error}`)
    }
  } catch (e) {
    console.error('[cron] erro ao chamar o scan', e)
  }
}

/**
 * Faxina do espelho no R2 — uma vez por dia basta, e o relógio aqui é o único
 * que roda sem ninguém logado. Janela de madrugada (UTC 06h ≈ 03h de Brasília)
 * para não competir com o expediente.
 */
async function runSweep(env: Env): Promise<void> {
  if (!env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET ausente — a faxina não será executada. Rode `wrangler secret put CRON_SECRET`.')
    return
  }
  if (!env.SCAN_URL) {
    console.error('[cron] SCAN_URL ausente — configure SCAN_URL no cron/wrangler.toml para o endpoint /api/drive-scan do Pages.')
    return
  }

  try {
    const res = await fetch(env.SCAN_URL.replace('/drive-scan', '/mirror'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CRON_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sweep' }),
    })
    const data = await res.json() as { ok?: boolean; swept?: number; error?: string }
    if (!res.ok || !data.ok) { console.error(`[cron] faxina falhou: ${data.error ?? res.status}`); return }
    if (data.swept) console.log(`[cron] espelho: ${data.swept} criativo(s) publicado(s) removido(s)`)
  } catch (e) {
    console.error('[cron] erro na faxina do espelho', e)
  }
}

export default {
  async scheduled(
    event: { scheduledTime?: number },
    env: Env,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ): Promise<void> {
    ctx.waitUntil(runScan(env))

    // O cron dispara a cada 5 min; a faxina só interessa uma vez por dia.
    const hour = new Date(event.scheduledTime ?? Date.now()).getUTCHours()
    const minute = new Date(event.scheduledTime ?? Date.now()).getUTCMinutes()
    if (hour === 6 && minute < 5) ctx.waitUntil(runSweep(env))
  },
}
