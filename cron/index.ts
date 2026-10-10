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

import { runBackup, type BackupEnv } from './backup'

interface Env extends BackupEnv {
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

async function runBackupNow(env: Env): Promise<void> {
  if (!env.DB || !env.BACKUPS) {
    console.error('[cron] backup: bindings DB/BACKUPS ausentes — confira o cron/wrangler.toml.')
    return
  }
  const status = await runBackup(env)
  if (!status) return
  if (status.ok) console.log(`[cron] backup ${status.keys?.join(' + ')}: ${status.bytes} bytes, ${status.cards?.custom} cards, ${status.deleted?.length ?? 0} antigo(s) apagado(s)`)
  else console.error(`[cron] backup FALHOU: ${status.error}`)
}

/**
 * Publicação no Instagram: o painel guarda os posts programados e publica os
 * que venceram quando este cron chama. A API do Instagram não agenda sozinha —
 * sem esta chamada, nada sai.
 */
async function runInstagram(env: Env): Promise<void> {
  if (!env.CRON_SECRET || !env.SCAN_URL) return
  try {
    const res = await fetch(env.SCAN_URL.replace('/drive-scan', '/instagram'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CRON_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'run' }),
    })
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; processados?: { itemId: number; resultado: string }[] }
    if (!res.ok || !data.ok) { console.error(`[cron] instagram falhou (${res.status}): ${data.error ?? ''}`); return }
    for (const p of data.processados ?? []) console.log(`[cron] instagram #${p.itemId}: ${p.resultado}`)
  } catch (e) {
    console.error('[cron] erro ao chamar a publicação do Instagram', e)
  }
}

export default {
  async scheduled(
    event: { scheduledTime?: number },
    env: Env,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ): Promise<void> {
    const hour = new Date(event.scheduledTime ?? Date.now()).getUTCHours()
    const minute = new Date(event.scheduledTime ?? Date.now()).getUTCMinutes()

    // O cron dispara a CADA MINUTO por causa do Instagram — o post tem de sair
    // no minuto marcado. O scan do Drive segue de 5 em 5, como sempre foi.
    ctx.waitUntil(runInstagram(env))
    if (minute % 5 === 0) ctx.waitUntil(runScan(env))

    // A faxina só interessa uma vez por dia.
    if (hour === 6 && minute === 0) ctx.waitUntil(runSweep(env))

    // Backup do D1 → R2: uma cópia por hora + a diária das 06h UTC. Roda de 5
    // em 5 min, mas só age se a cópia da hora/do dia ainda não existir —
    // falhou, tenta de novo no disparo seguinte.
    if (minute % 5 === 0) ctx.waitUntil(runBackupNow(env))
  },
}
