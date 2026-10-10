#!/usr/bin/env node
/**
 * Compara duas cópias do banco (geradas pelo cron em `cron/backup.ts`) e lista
 * os cards que SUMIRAM de uma para a outra — e os que foram arquivados.
 *
 * Uso (cada lado é um arquivo local OU uma chave do balde ds-hub-backups):
 *   node scripts/cards-sumidos.mjs d1/hora/2026-10-08T12.json.gz d1/hora/2026-10-08T18.json.gz
 *   node scripts/cards-sumidos.mjs antes.json.gz depois.json.gz
 *
 * Listar as cópias disponíveis:
 *   npx wrangler r2 object get ds-hub-backups/status.json --pipe     (a última)
 *   (painel da Cloudflare → R2 → ds-hub-backups → d1/hora/)
 *
 * As horas das chaves são UTC (Brasília = UTC−3: 15h aqui é T18).
 *
 * Gera `cards-sumidos.json` com o card e o estado de cada um, tirados da cópia
 * ANTIGA — é o material para restaurar. O script não grava nada no banco.
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [ladoA, ladoB] = process.argv.slice(2)
if (!ladoA || !ladoB) {
  console.error('Uso: node scripts/cards-sumidos.mjs <antes> <depois>   (arquivo local ou chave d1/...)')
  process.exit(1)
}

let pasta
function abrir(lado) {
  let arquivo = lado
  if (lado.startsWith('d1/')) {
    pasta ??= mkdtempSync(join(tmpdir(), 'dshub-backup-'))
    arquivo = join(pasta, lado.replace(/\//g, '_'))
    execFileSync('npx', ['wrangler', 'r2', 'object', 'get', `ds-hub-backups/${lado}`, '--file', arquivo], {
      stdio: ['ignore', 'ignore', 'inherit'],
      shell: process.platform === 'win32',
      // O wrangler do projeto: fora dele o npx baixa outra versão, com outras flags.
      cwd: fileURLToPath(new URL('..', import.meta.url)),
    })
  }
  const bruto = readFileSync(arquivo)
  // Gzip começa com 1f 8b; o R2 às vezes entrega já descompactado.
  const backup = JSON.parse((bruto[0] === 0x1f && bruto[1] === 0x8b ? gunzipSync(bruto) : bruto).toString('utf8'))
  const linhas = backup.tables.find(t => t.name === 'app_data')?.rows ?? []
  const ler = (chave, vazio) => {
    const linha = linhas.find(r => r.key === chave)
    try { return linha ? JSON.parse(String(linha.value)) : vazio } catch { return vazio }
  }
  return {
    createdAt: backup.createdAt,
    custom: ler('sm_custom', []),
    states: ler('sm_states', {}),
    deleted: new Set(ler('sm_deleted', []).map(Number)),
  }
}

const antes = abrir(ladoA)
const depois = abrir(ladoB)
const idsDepois = new Set(depois.custom.map(c => Number(c.i)))

const sumiram = antes.custom.filter(c => !idsDepois.has(Number(c.i)))
const arquivados = antes.custom.filter(c => idsDepois.has(Number(c.i)) && !antes.deleted.has(Number(c.i)) && depois.deleted.has(Number(c.i)))
const estadosPerdidos = Object.keys(antes.states).filter(id => !(id in depois.states))

const linha = c => {
  const st = antes.states[String(c.i)] ?? {}
  return `  #${c.i}  ${String(c.c ?? '').padEnd(24)} ${String(c.tp ?? '').padEnd(9)} ${String(c.dt ?? '').slice(0, 10)}  ${st.title || c.n || ''}`
}

console.log(`Antes:  ${antes.createdAt}  — ${antes.custom.length} cards, ${Object.keys(antes.states).length} estados, ${antes.deleted.size} arquivados`)
console.log(`Depois: ${depois.createdAt}  — ${depois.custom.length} cards, ${Object.keys(depois.states).length} estados, ${depois.deleted.size} arquivados`)
console.log('')
console.log(`SUMIRAM (estavam no sm_custom e não estão mais): ${sumiram.length}`)
for (const c of sumiram) console.log(linha(c))
console.log('')
console.log(`Arquivados no intervalo (foram para sm_deleted): ${arquivados.length}`)
for (const c of arquivados) console.log(linha(c))
console.log('')
console.log(`Estados de card que sumiram do sm_states: ${estadosPerdidos.length}`)

const saida = 'cards-sumidos.json'
writeFileSync(saida, JSON.stringify({
  antes: antes.createdAt,
  depois: depois.createdAt,
  sumiram: sumiram.map(c => ({ card: c, state: antes.states[String(c.i)] ?? null })),
  arquivados: arquivados.map(c => ({ card: c, state: antes.states[String(c.i)] ?? null })),
  estadosPerdidos: Object.fromEntries(estadosPerdidos.map(id => [id, antes.states[id]])),
}, null, 2))
console.log(`\nDetalhes para restaurar: ${saida}`)
