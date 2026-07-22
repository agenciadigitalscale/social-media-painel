/**
 * Coluna aditiva que o código novo escreve e o banco antigo ainda não tem.
 *
 * O deploy do Pages e a migração do D1 são dois atos separados: entre um e
 * outro, um INSERT com a coluna nova falha inteiro — no caso do `drive_videos`,
 * o scan pararia de registrar arquivo e a Inbox congelaria sem ninguém entender
 * por quê. Em vez de torcer pela ordem, a Function garante a coluna sozinha.
 *
 * `ALTER TABLE ... ADD COLUMN` é aditivo e barato; o `PRAGMA` roda uma vez por
 * isolate, não por requisição. Só serve para coluna opcional — mudança que
 * exige backfill continua sendo migração de verdade, no arquivo `migrations/`.
 */

const ensured = new Set<string>()

export async function ensureColumn(
  db: D1Database,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const memo = `${table}.${column}`
  if (ensured.has(memo)) return

  try {
    const { results } = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()
    if (results.some(c => c.name === column)) {
      ensured.add(memo)
      return
    }
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run()
    ensured.add(memo)
    console.log(`[schema] coluna ${memo} criada`)
  } catch (e) {
    // Corrida entre dois isolates: o segundo vê "duplicate column name" e o
    // estado final é o desejado. Qualquer outra falha aparece no log e a
    // requisição segue — quem escreve a coluna trata o erro dela.
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('duplicate column')) ensured.add(memo)
    else console.error(`[schema] não consegui garantir ${memo}: ${msg}`)
  }
}
