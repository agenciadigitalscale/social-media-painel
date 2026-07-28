import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Saúde da automação do Drive.
 *
 * O registro vem do `functions/api/drive-scan.ts`, gravado em `app_data` sob a
 * chave `_drive_scan_health` a cada scan (cron ou manual). O painel lê por
 * `GET /api/sync?key=_drive_scan_health`. É só leitura de diagnóstico — não
 * dispara nada por conta própria.
 */
export interface ScanHealth {
  lastRunAt?: number
  source?: 'cron' | 'manual'
  ok?: boolean
  scanned?: number
  newVideos?: number
  lastCronAt?: number
  lastManualAt?: number
  lastError?: { at: number; msg: string } | null
}

export type ScanRunResult =
  | { kind: 'ok'; newVideos: number }
  | { kind: 'rate_limited'; remaining: number }
  | { kind: 'unauthorized' }
  | { kind: 'error'; status: number; msg?: string }

/** O cron roda a cada 5 min; sem sinal há mais que isto, algo o está barrando. */
export const CRON_STALE_MS = 15 * 60 * 1000
/** Considera a automação "online" se qualquer scan (cron ou manual) rodou há pouco. */
export const ONLINE_MS = 15 * 60 * 1000

/**
 * Dispara um scan manual. Devolve o resultado JÁ classificado para o painel dar
 * uma mensagem honesta: 401 (sem sessão/segredo), 429 (respeitando o cooldown
 * de 90s) ou erro de rede não são "deu certo".
 */
export async function runDriveScanNow(): Promise<ScanRunResult> {
  try {
    const res = await fetch('/api/drive-scan', { method: 'POST', headers: { 'X-App-Manual': '1' } })
    if (res.status === 429) {
      const d = await res.json().catch(() => ({})) as { remaining?: number }
      return { kind: 'rate_limited', remaining: d.remaining ?? 90 }
    }
    if (res.status === 401) return { kind: 'unauthorized' }
    if (!res.ok) return { kind: 'error', status: res.status }
    const d = await res.json().catch(() => ({})) as { new_videos?: number }
    return { kind: 'ok', newVideos: d.new_videos ?? 0 }
  } catch (e) {
    return { kind: 'error', status: 0, msg: e instanceof Error ? e.message : String(e) }
  }
}

export async function fetchScanHealth(): Promise<ScanHealth | null> {
  try {
    const res = await fetch('/api/sync?key=_drive_scan_health')
    if (!res.ok) return null
    const d = await res.json() as { value?: string | null }
    if (!d.value) return null
    return JSON.parse(d.value) as ScanHealth
  } catch {
    return null
  }
}

const HEALTH_POLL_MS = 30_000

/** Lê o registro de saúde periodicamente e expõe um `reload` para depois do "Executar agora". */
export function useAutomationHealth(enabled = true): {
  health: ScanHealth | null
  loading: boolean
  reload: () => Promise<void>
} {
  const [health, setHealth] = useState<ScanHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  const reload = useCallback(async () => {
    const h = await fetchScanHealth()
    if (mounted.current) { setHealth(h); setLoading(false) }
  }, [])

  useEffect(() => {
    mounted.current = true
    if (!enabled) { setLoading(false); return }
    void reload()
    const timer = setInterval(() => { void reload() }, HEALTH_POLL_MS)
    return () => { mounted.current = false; clearInterval(timer) }
  }, [enabled, reload])

  return { health, loading, reload }
}
