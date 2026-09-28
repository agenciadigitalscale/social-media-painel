#!/usr/bin/env node
/**
 * Restaura um backup diário do D1 (gerado pelo cron em `cron/backup.ts`).
 *
 * Uso:
 *   node scripts/backup-restaurar.mjs <backup.json.gz>             → só gera o .sql ao lado
 *   node scripts/backup-restaurar.mjs <backup.json.gz> --local     → gera e aplica no D1 LOCAL
 *
 * Baixar um backup da nuvem:
 *   npx wrangler r2 object get ds-hub-backups/d1/AAAA-MM-DD.json.gz --file backup.json.gz
 *
 * Restaurar em PRODUÇÃO é de propósito manual (apaga e recria cada tabela):
 *   npx wrangler d1 execute social-media-db --remote --file <arquivo.sql>
 * Teste antes no local — e confira que o backup é o dia certo.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { backupToSql } from '../cron/backup.ts'

const [arquivo, ...flags] = process.argv.slice(2)
if (!arquivo) {
  console.error('Uso: node scripts/backup-restaurar.mjs <backup.json.gz> [--local]')
  process.exit(1)
}

const bruto = readFileSync(arquivo)
// Gzip começa com 1f 8b; o R2 às vezes entrega já descompactado.
const texto = (bruto[0] === 0x1f && bruto[1] === 0x8b ? gunzipSync(bruto) : bruto).toString('utf8')
const backup = JSON.parse(texto)

const sql = backupToSql(backup)
const saida = arquivo.replace(/\.json(\.gz)?$/, '') + '.sql'
writeFileSync(saida, sql)

console.log(`Backup de ${backup.createdAt}`)
for (const t of backup.tables) console.log(`  ${t.name.padEnd(20)} ${t.rows.length} linha(s)`)
console.log(`SQL gerado: ${saida}`)

if (flags.includes('--local')) {
  console.log('Aplicando no D1 LOCAL...')
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'social-media-db', '--local', '--file', saida], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  console.log('Pronto. Suba o painel local para conferir.')
} else {
  console.log('Para aplicar no banco local: rode de novo com --local')
}
