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

  try {
    const res = await fetch(env.SCAN_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    })
    const body = await res.text()

    if (!res.ok) {
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

export default {
  async scheduled(
    _event: unknown,
    env: Env,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ): Promise<void> {
    ctx.waitUntil(runScan(env))
  },
}
