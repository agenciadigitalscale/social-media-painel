#!/usr/bin/env node
/**
 * Gera o src/data.ts para o novo mês.
 *
 * Uso:
 *   node scripts/new-month.mjs <ano> <mês(1-12)>
 *
 * Exemplo — gerar junho 2026:
 *   node scripts/new-month.mjs 2026 6
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Parse args ────────────────────────────────────────

const [, , yearArg, monthArg] = process.argv
if (!yearArg || !monthArg) {
  console.error('Uso: node scripts/new-month.mjs <ano> <mês(1-12)>')
  process.exit(1)
}

const year  = parseInt(yearArg, 10)
const month = parseInt(monthArg, 10) - 1  // 0-indexed

if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
  console.error('Ano ou mês inválido.')
  process.exit(1)
}

// ── Ler CLIENTS do data.ts atual ─────────────────────

const dataPath = resolve(ROOT, 'src', 'data.ts')
const src = readFileSync(dataPath, 'utf8')

const clientsBlock = src.match(/export const CLIENTS[\s\S]*?\n\]/)
if (!clientsBlock) {
  console.error('Não foi possível encontrar CLIENTS[] em src/data.ts')
  process.exit(1)
}

const clientLines = clientsBlock[0].matchAll(
  /\{\s*name:\s*['"](.+?)['"]\s*,\s*postsPerMonth:\s*(\d+)\s*,\s*reelsPerMonth:\s*(\d+)/g
)

const clients = []
for (const m of clientLines) {
  clients.push({ name: m[1], posts: parseInt(m[2], 10), reels: parseInt(m[3], 10) })
}

if (!clients.length) {
  console.error('Nenhum cliente encontrado em CLIENTS[].')
  process.exit(1)
}

// ── Dias úteis do mês (seg–sáb) ───────────────────────

function getWorkdays(y, m) {
  const days = []
  const total = new Date(y, m + 1, 0).getDate()
  for (let d = 1; d <= total; d++) {
    const date = new Date(y, m, d)
    if (date.getDay() !== 0) days.push(d)
  }
  return days
}

function pickDays(workdays, count) {
  if (count === 0) return []
  const step = workdays.length / count
  return Array.from({ length: count }, (_, i) =>
    workdays[Math.min(Math.floor(i * step), workdays.length - 1)]
  )
}

// ── Templates de título por tipo ─────────────────────

const POST_TITLES = [
  'Destaque do mês',
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

function getTitle(titles, index, clientName) {
  return titles[index % titles.length]
}

// ── Montar DATA[] ─────────────────────────────────────

const workdays = getWorkdays(year, month)
let id = 1
const lines = []

const monthNames = [
  'janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro'
]
const monthLabel = monthNames[month]

for (const client of clients) {
  const postDays = pickDays(workdays, client.posts)
  const reelDays = pickDays(workdays, client.reels)

  const pad = n => String(n).padStart(3, ' ')
  const sep = `  // ── ${client.name} ── ${client.posts} Posts · ${client.reels} Reels ${'─'.repeat(Math.max(0, 60 - client.name.length))}`

  lines.push(sep)

  postDays.forEach((day, i) => {
    const title = getTitle(POST_TITLES, i, client.name)
    lines.push(`  { i: ${pad(id++)}, c: '${client.name.replace(/'/g, "\\'")}', dt: d(${String(day).padStart(2,' ')}), tp: 'Post', n: '${title}', s: s(${String(day).padStart(2,' ')}) },`)
  })

  reelDays.forEach((day, i) => {
    const title = getTitle(REEL_TITLES, i, client.name)
    lines.push(`  { i: ${pad(id++)}, c: '${client.name.replace(/'/g, "\\'")}', dt: d(${String(day).padStart(2,' ')}), tp: 'Reel', n: '${title}', s: s(${String(day).padStart(2,' ')}) },`)
  })

  lines.push('')
}

// ── Montar arquivo final ──────────────────────────────

const clientsSection = clientsBlock[0]

const newFile = `import type { Client, ContentItem } from './types'

export const CLIENTS: Client[] = [
${clients.map(c =>
  `  { name: '${c.name.replace(/'/g, "\\'")}', postsPerMonth: ${c.posts}, reelsPerMonth: ${c.reels} },`
).join('\n')}
]

// ${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)} ${year} — alterar BASE_DATE e DATA para cada novo mês
export const BASE_DATE = new Date(${year}, ${month}, 1)

const d = (day: number) => new Date(${year}, ${month}, day)

// status automático: passado=publicado, hoje=em edição, futuro=pendente
const s = (day: number): 0 | 1 | 2 | 3 => {
  const today = new Date()
  const date = new Date(${year}, ${month}, day)
  if (date < new Date(today.getFullYear(), today.getMonth(), today.getDate())) return 3
  if (date.toDateString() === today.toDateString()) return 1
  return 0
}

export const DATA: ContentItem[] = [

${lines.join('\n')}]
`

writeFileSync(dataPath, newFile, 'utf8')

const total = id - 1
console.log(`✅ src/data.ts atualizado para ${monthLabel} ${year}`)
console.log(`   ${clients.length} clientes · ${total} conteúdos gerados`)
console.log(`   Revise os títulos dos itens em src/data.ts antes de publicar.`)
