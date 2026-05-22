#!/usr/bin/env node
/**
 * Gera o bloco DATA_<MÊS> para um novo mês e o adiciona em src/data.ts.
 *
 * Uso:
 *   npm run gen-mes -- agosto 2026
 *   npm run gen-mes -- setembro 2026
 *
 * O script:
 *  1. Lê CLIENTS[] de src/data.ts
 *  2. Gera uma const `DATA_AGOSTO` com IDs corretos (offset por mês)
 *  3. Append em src/data.ts se o export ainda não existir
 *  4. Imprime o trecho a copiar em App.tsx para importar e mesclar
 *
 * Regra de IDs: base = ((ano - 2026) * 12 + mesJS - 4) * 1000
 *   junho 2026 (mesJS=5) → base 1000 → IDs 1001..
 *   julho 2026 (mesJS=6) → base 2000 → IDs 2001..
 *   agosto 2026 (mesJS=7) → base 3000 → IDs 3001..
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Parse args ────────────────────────────────────────

const MONTH_NAMES_PT = [
  'janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro',
]

const args = process.argv.slice(2)
if (args.length < 2) {
  console.error('Uso: npm run gen-mes -- <mês-em-português> <ano>')
  console.error('Exemplo: npm run gen-mes -- agosto 2026')
  process.exit(1)
}

const monthNameInput = args[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const monthNameNorm  = MONTH_NAMES_PT.map(m => m.normalize('NFD').replace(/[̀-ͯ]/g, ''))
const monthJS        = monthNameNorm.indexOf(monthNameInput) // 0-indexed
if (monthJS === -1) {
  console.error(`Mês inválido: "${args[0]}". Use o nome em português (ex: agosto).`)
  process.exit(1)
}

const year = parseInt(args[1], 10)
if (isNaN(year) || year < 2026) {
  console.error('Ano inválido. Use 2026 ou posterior.')
  process.exit(1)
}

const monthNameDisplay = MONTH_NAMES_PT[monthJS]
const monthNameCap     = monthNameDisplay.charAt(0).toUpperCase() + monthNameDisplay.slice(1)

// ── Ler CLIENTS de src/data.ts ────────────────────────

const dataPath = resolve(ROOT, 'src', 'data.ts')
let src
try { src = readFileSync(dataPath, 'utf8') }
catch { console.error('Arquivo src/data.ts não encontrado.'); process.exit(1) }

// Extrai nome, posts, reels de cada linha do CLIENTS[]
const clientMatches = [...src.matchAll(
  /\{\s*name:\s*['"](.+?)['"]\s*,\s*postsPerMonth:\s*(\d+)\s*,\s*reelsPerMonth:\s*(\d+)/g
)]
if (!clientMatches.length) {
  console.error('Nenhum cliente encontrado em CLIENTS[].')
  process.exit(1)
}
const clients = clientMatches.map(m => ({
  name:  m[1],
  posts: parseInt(m[2], 10),
  reels: parseInt(m[3], 10),
}))

console.log(`\nClientes lidos: ${clients.length}`)

// ── Verificar se export já existe ────────────────────

const exportName = `DATA_${monthNameCap.toUpperCase()}`
if (src.includes(`export const ${exportName}`)) {
  console.error(`\n⚠️  export const ${exportName} já existe em src/data.ts.`)
  console.error('   Remova o bloco existente antes de re-gerar, ou edite manualmente.')
  process.exit(1)
}

// ── Dias úteis do mês (seg–sáb) ───────────────────────

function getWorkdays(y, m) {
  const days = []
  const total = new Date(y, m + 1, 0).getDate()
  for (let d = 1; d <= total; d++) {
    const date = new Date(y, m, d)
    if (date.getDay() !== 0) days.push(d) // exclui domingo
  }
  return days
}

function pickDays(workdays, count) {
  if (count === 0 || workdays.length === 0) return []
  const step = workdays.length / count
  return Array.from({ length: count }, (_, i) =>
    workdays[Math.min(Math.floor(i * step), workdays.length - 1)]
  )
}

// ── Templates de título ────────────────────────────────

const POST_TITLES = [
  `Destaques de ${monthNameDisplay}`,
  'Novidade especial',
  'Dica da semana',
  'Promoção imperdível',
  'Conheça nossos serviços',
  'Por dentro da empresa',
  'Resultado de cliente',
  'O que nos diferencia',
  'Você sabia?',
  'Bastidores',
  'Fique por dentro',
  'Reserve já',
]

const REEL_TITLES = [
  'Tour pelo espaço',
  'Antes e depois',
  'Como funciona?',
  'Transformação',
  'Depoimento real',
  'Um dia de trabalho',
  'Novidade em vídeo',
  'Processo passo a passo',
]

// ── Calcular base de IDs ──────────────────────────────

// base = ((ano - 2026) * 12 + mesJS - 4) * 1000
// junho 2026 (mesJS=5) → (0*12 + 5-4)*1000 = 1000
// julho 2026 (mesJS=6) → (0*12 + 6-4)*1000 = 2000
const base = ((year - 2026) * 12 + monthJS - 4) * 1000
console.log(`Base de IDs: ${base} (IDs ${base + 1}..${base + 9999})`)

// ── Montar DATA[] ─────────────────────────────────────

const workdays = getWorkdays(year, monthJS)
const total    = clients.reduce((acc, c) => acc + c.posts + c.reels, 0)
let   idCursor = base
const lines    = []

for (const client of clients) {
  const postDays = pickDays(workdays, client.posts)
  const reelDays = pickDays(workdays, client.reels)
  const dash     = '─'.repeat(Math.max(0, 58 - client.name.length))
  lines.push(`  // ── ${client.name} ── ${client.posts} Posts · ${client.reels} Reels ${dash}`)
  postDays.forEach((day, i) => {
    const title = POST_TITLES[i % POST_TITLES.length]
    lines.push(`  { i: ${String(++idCursor).padStart(4,' ')}, c: '${client.name.replace(/'/g, "\\'")}', dt: d7(${String(day).padStart(2,' ')}), tp: 'Post',  n: '${title}', s: 0 },`)
  })
  reelDays.forEach((day, i) => {
    const title = REEL_TITLES[i % REEL_TITLES.length]
    lines.push(`  { i: ${String(++idCursor).padStart(4,' ')}, c: '${client.name.replace(/'/g, "\\'")}', dt: d7(${String(day).padStart(2,' ')}), tp: 'Reel',  n: '${title}', s: 0 },`)
  })
  lines.push('')
}

// ── Gerar bloco a ser adicionado em data.ts ───────────

const block = `
// ── ${monthNameCap} ${year} ─────────────────────────────────────────────
// IDs ${base + 1}–${idCursor} · ${clients.length} clientes · ${idCursor - base} conteúdos
const d7 = (day: number) => new Date(${year}, ${monthJS}, day)
export const ${exportName}: ContentItem[] = [
${lines.join('\n')}]
`

// ── Append em data.ts ─────────────────────────────────

writeFileSync(dataPath, src + block, 'utf8')

console.log(`\n✅ src/data.ts atualizado — ${monthNameCap} ${year}`)
console.log(`   ${clients.length} clientes · ${idCursor - base} conteúdos gerados (IDs ${base + 1}–${idCursor})`)

// ── Auto-atualizar src/App.tsx ────────────────────────

const appPath = resolve(ROOT, 'src', 'App.tsx')
let appSrc
try { appSrc = readFileSync(appPath, 'utf8') }
catch { console.warn('\n⚠️  src/App.tsx não encontrado — atualize manualmente.'); process.exit(0) }

let appUpdated = appSrc
let appChanged = false

// 1. Atualiza import: adiciona exportName antes de CLIENTS
if (!appUpdated.includes(exportName)) {
  // Encontra a linha: import { DATA, DATA_XXXX, ..., CLIENTS } from './data'
  const importFixed = appUpdated.replace(
    /(import\s*\{[^}]*?)(\bCLIENTS\b)([^}]*\}\s*from\s*['"]\.\/data['"])/,
    (_, pre, clients, post) => `${pre}${exportName}, ${clients}${post}`,
  )
  if (importFixed !== appUpdated) {
    appUpdated = importFixed
    appChanged = true
    console.log(`   ✓ Import adicionado em App.tsx`)
  } else {
    console.warn(`   ⚠️  Não encontrou o padrão de import em App.tsx — adicione manualmente: ${exportName}`)
  }
}

// 2. Atualiza allItems useMemo: adiciona ...exportName antes de ...customItems
if (!appUpdated.includes(`...${exportName}`)) {
  const allItemsFixed = appUpdated.replace(
    /(return\s*\[)((?:\.\.\.DATA\w*\s*,\s*)+)(\.\.\.customItems)/,
    (_, ret, spreads, custom) => `${ret}${spreads}...${exportName}, ${custom}`,
  )
  if (allItemsFixed !== appUpdated) {
    appUpdated = allItemsFixed
    appChanged = true
    console.log(`   ✓ allItems atualizado em App.tsx`)
  } else {
    console.warn(`   ⚠️  Não encontrou o padrão allItems em App.tsx — adicione manualmente: ...${exportName}`)
  }
}

if (appChanged) {
  writeFileSync(appPath, appUpdated, 'utf8')
  console.log(`\n✅ src/App.tsx atualizado automaticamente!`)
} else if (appSrc.includes(exportName)) {
  console.log(`\nℹ️  src/App.tsx já contém ${exportName} — nenhuma alteração necessária.`)
}

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  Revise os títulos dos conteúdos em src/data.ts antes de publicar.
   Os títulos foram gerados com templates genéricos.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
