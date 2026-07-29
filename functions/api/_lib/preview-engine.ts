export async function ensurePreviewEngineSchema(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS preview_engine_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      ready INTEGER NOT NULL DEFAULT 0,
      processing INTEGER NOT NULL DEFAULT 0,
      attention INTEGER NOT NULL DEFAULT 0
    )
  `).run()
}

export async function runPreviewEngine(db: D1Database, accessToken: string): Promise<{ ok: true; ready: number; processing: number; attention: number }> {
  const result = await db.prepare(`
    SELECT preview_status, COUNT(*) AS count
    FROM drive_videos
    GROUP BY preview_status
  `).all<{ preview_status: string | null; count: number }>()

  const counts = { ready: 0, processing: 0, attention: 0 }
  for (const row of result.results) {
    const status = String(row.preview_status ?? 'ready')
    if (status === 'ready' || status === 'processing' || status === 'attention') {
      counts[status] = Number(row.count) || 0
    }
  }

  await db.prepare(`
    INSERT INTO preview_engine_status (created_at, ready, processing, attention)
    VALUES (unixepoch(), ?, ?, ?)
  `).bind(counts.ready, counts.processing, counts.attention).run()

  return { ok: true, ...counts }
}
