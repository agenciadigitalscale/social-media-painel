#!/usr/bin/env node
/**
 * Gera src/data.ts para qualquer mês.
 *
 * Uso:
 *   npm run gen-mes -- --mes=7 --ano=2026
 *   npm run gen-mes -- --mes=julho --ano=2026
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Parse CLI args ──────────────────────────────────────

const MONTH_NAMES_PT = [
  'janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro',
]

const MONTH_NAMES_DISPLAY = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

function parseArgs() {
  const args = process.argv.slice(2)
  const map = {}
  for (const arg of args) {
    const m = arg.match(/^--([^=]+)=(.+)$/)
    if (m) map[m[1].toLowerCase()] = m[2]
  }
  return map
}

const args = parseArgs()

if (!args.mes || !args.ano) {
  console.error('Uso: npm run gen-mes -- --mes=7 --ano=2026')
  console.error('     npm run gen-mes -- --mes=julho --ano=2026')
  process.exit(1)
}

const year = parseInt(args.ano, 10)
if (isNaN(year)) {
  console.error('Ano inválido: ' + args.ano)
  process.exit(1)
}

let monthIndex  // 0-based
const mesArg = args.mes.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const normalizedNames = MONTH_NAMES_PT.map(n => n.normalize('NFD').replace(/[̀-ͯ]/g, ''))
const nameIndex = normalizedNames.indexOf(mesArg)

if (nameIndex !== -1) {
  monthIndex = nameIndex
} else {
  const parsed = parseInt(args.mes, 10)
  if (isNaN(parsed) || parsed < 1 || parsed > 12) {
    console.error('Mês inválido: ' + args.mes + ' (use 1-12 ou nome em português)')
    process.exit(1)
  }
  monthIndex = parsed - 1
}

// Edge case: não gerar antes de janeiro 2026
if (year < 2026 || (year === 2026 && monthIndex < 0)) {
  console.error('Não é possível gerar dados antes de Janeiro 2026.')
  process.exit(1)
}

// ── ID formula ──────────────────────────────────────────
// May 2026 = month 4 (0-based) → baseId = 1
// June 2026 = month 5 → baseId = 1001
// July 2026 = month 6 → baseId = 2001
// General: offset = (year - 2026) * 12 + monthIndex - 4
// baseId = offset * 1000 + 1

const monthOffset = (year - 2026) * 12 + monthIndex - 4
const baseId = monthOffset * 1000 + 1

// ── Read CLIENTS from existing data.ts ─────────────────

const dataPath = resolve(ROOT, 'src', 'data.ts')
let src
try {
  src = readFileSync(dataPath, 'utf8')
} catch (e) {
  console.error('Não foi possível ler src/data.ts: ' + e.message)
  process.exit(1)
}

const clientsBlock = src.match(/export const CLIENTS[\s\S]*?\n\]/)
if (!clientsBlock) {
  console.error('Não foi possível encontrar CLIENTS[] em src/data.ts')
  process.exit(1)
}

const clientLines = [...clientsBlock[0].matchAll(
  /\{\s*name:\s*['"](.+?)['"]\s*,\s*postsPerMonth:\s*(\d+)\s*,\s*reelsPerMonth:\s*(\d+)/g
)]

const clients = clientLines.map(m => ({
  name: m[1],
  posts: parseInt(m[2], 10),
  reels: parseInt(m[3], 10),
}))

if (!clients.length) {
  console.error('Nenhum cliente encontrado em CLIENTS[].')
  process.exit(1)
}

// ── Working days (Mon–Sat) ──────────────────────────────

function getWorkdays(y, m) {
  const days = []
  const total = new Date(y, m + 1, 0).getDate()
  for (let d = 1; d <= total; d++) {
    const dow = new Date(y, m, d).getDay()
    if (dow !== 0) days.push(d)
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

// Days 1–28 (safe for all months)
function pickSafeDays(count) {
  const safe = []
  for (let d = 1; d <= 28; d++) {
    const dow = new Date(year, monthIndex, d).getDay()
    if (dow !== 0) safe.push(d)
  }
  return pickDays(safe, count)
}

// ── Monthly themes ──────────────────────────────────────

const MONTH_THEMES = {
  0:  { label: 'janeiro',   keywords: ['Ano Novo', 'Réveillon', 'verão', 'metas de janeiro', 'calor do verão'] },
  1:  { label: 'fevereiro', keywords: ['Carnaval', 'amor', 'verão', 'férias de verão', 'celebração'] },
  2:  { label: 'março',     keywords: ['outono chegando', 'Dia da Mulher', 'primeiros frios', 'mês das mulheres'] },
  3:  { label: 'abril',     keywords: ['Páscoa', 'outono', 'feriado de Páscoa', 'chocolate de Páscoa'] },
  4:  { label: 'maio',      keywords: ['Dia das Mães', 'outono', 'homenagem às mães', 'presente para mamãe'] },
  5:  { label: 'junho',     keywords: ['Festa Junina', 'Dia dos Namorados', 'inverno', 'arraiá', 'São João'] },
  6:  { label: 'julho',     keywords: ['férias escolares', 'inverno', 'São João', 'viagem nas férias', 'frio'] },
  7:  { label: 'agosto',    keywords: ['Dia dos Pais', 'inverno', 'homenagem ao pai', 'presente para papai'] },
  8:  { label: 'setembro',  keywords: ['Primavera', 'Dia do Cliente', 'flores de primavera', 'nosso cliente'] },
  9:  { label: 'outubro',   keywords: ['Halloween', 'Outubro Rosa', 'prevenção do câncer', 'fantasia'] },
  10: { label: 'novembro',  keywords: ['Black Friday', 'Natal se aproxima', 'promoção imperdível', 'ofertas'] },
  11: { label: 'dezembro',  keywords: ['Natal', 'festas de fim de ano', 'Ano Novo chegando', 'Papai Noel'] },
}

const theme = MONTH_THEMES[monthIndex]

// ── Per-client title generators ─────────────────────────

function makeTitles(clientName, type, count, idx) {
  const kw = theme.keywords
  const monthLabel = MONTH_NAMES_DISPLAY[monthIndex]

  const clientTemplates = {
    'Casa de Ração 2 Irmãos': {
      Post: [
        `Pets no ${kw[0]}: cuidados essenciais`,
        `Ração premium em promoção de ${theme.label}`,
        `${kw[1]} com seu pet`,
        `Novidades na loja — ${kw[2]}`,
        `Alimentação saudável no ${kw[2]}`,
        `Cuide bem do seu pet este mês`,
      ],
      Reel: [
        `Pets mais fofos da semana`,
        `${kw[0]} — pet como companheiro`,
        `Como cuidar do pet em ${theme.label}`,
        `Transformação do pet do mês`,
        `Dica de saúde animal — ${monthLabel}`,
        `Produto destaque: ração especial`,
      ],
    },
    'Chalés Alto da Represa': {
      Post: [
        `${kw[2]} no chalé: temporada aconchegante`,
        `Pacote especial — ${kw[1]}`,
        `${kw[0]} na represa`,
        `Reserve para ${theme.label}!`,
        `Fim de semana perfeito no chalé`,
        `Experiência única na represa`,
      ],
      Reel: [
        `Tour pelos chalés em ${theme.label}`,
        `Surpresa especial na represa`,
        `Atividades especiais — ${monthLabel}`,
        `Natureza e conforto no chalé`,
        `Depoimento de hóspede especial`,
        `Pôr do sol na represa`,
      ],
    },
    "Frango d'Água": {
      Post: [
        `Cardápio especial de ${theme.label}`,
        `Combo para ${kw[1]}`,
        `Promoção almoço executivo`,
        `Jantar especial — ${kw[1]}`,
        `Pratos de ${theme.label} no cardápio`,
        `Prato destaque do mês`,
        `Sabores de ${theme.label}`,
        `Venha nos visitar em ${theme.label}`,
      ],
      Reel: [
        `Preparo do frango especial de ${theme.label}`,
        `Bastidores do jantar especial`,
        `Frango caipira — edição ${theme.label}`,
        `Tour pela nossa cozinha`,
        `Como é feito o nosso prato`,
        `Chef revela segredo da receita`,
      ],
    },
    'Hidro Elétrica Andrade': {
      Post: [
        `${kw[2]} e consumo de energia elétrica`,
        `Energia solar: economize em ${theme.label}`,
        `Projeto residencial concluído`,
        `Orçamento gratuito — ${theme.label}`,
        `Soluções elétricas para sua casa`,
        `Benefícios da energia solar`,
      ],
      Reel: [
        `Nossa equipe em ação`,
        `Antes e depois: instalação solar`,
        `Dicas para reduzir a conta de luz`,
        `Instalação completa em um dia`,
        `Tecnologia elétrica em ${monthLabel}`,
        `Depoimento de cliente satisfeito`,
      ],
    },
    'Home Elevadores': {
      Post: [
        `Elevador residencial: conforto em ${theme.label}`,
        `${kw[1]} — presente especial`,
        `Modelos compactos para sua casa`,
        `Instalação sem quebra-quebra`,
        `Manutenção preventiva — ${theme.label}`,
        `Planeje sua obra nas ${kw[0]}`,
        `Consultoria gratuita em ${theme.label}`,
        `Tecnologia e acessibilidade`,
      ],
      Reel: [
        `Como funciona nosso elevador`,
        `Instalação residencial ao vivo`,
        `Modelos disponíveis ${year}`,
        `Depoimento de cliente satisfeito`,
        `Antes e depois da instalação`,
        `Tour: elevador panorâmico`,
        `Processo de instalação completo`,
        `Benefícios para sua qualidade de vida`,
      ],
    },
    'Kátia Bigatello': {
      Post: [
        `Make especial para ${kw[1]}`,
        `Make de ${kw[2]}: cores da estação`,
        `Tutorial lábios perfeitos`,
        `Look para ${kw[0]}`,
        `Make romântica — ${kw[1]}`,
        `Cuidados com a pele em ${theme.label}`,
        `Make estilo ${kw[0]}`,
        `Tendências de beleza — ${monthLabel}`,
        `Make simples para o dia a dia`,
        `Cores da temporada de ${theme.label}`,
        `Make para eventos especiais`,
        `Fechamento de ${theme.label}: melhores looks`,
      ],
      Reel: [
        `Tutorial: make especial de ${theme.label}`,
        `Transformação para ${kw[1]}`,
        `Preparação da pele em ${theme.label}`,
        `Make para ${kw[0]}`,
        `Produtos que uso todo dia`,
        `Tutorial lábios da estação`,
        `Make estilo ${kw[0]}`,
        `Correção de imperfeições`,
        `5 dicas de make para ${theme.label}`,
        `Blush placement da estação`,
        `Make para ocasião especial`,
        `Rotina de cuidados em ${theme.label}`,
      ],
    },
    'Lareiras Grill': {
      Post: [
        `Destaque do fim de semana`,
        `Especial de ${theme.label}`,
        `Cardápio de ${theme.label} — novidades`,
        `Jantar especial ${kw[1]}`,
        `Prato destaque do mês`,
        `${kw[0]} — pratos típicos`,
        `${kw[0]} — ceia especial`,
        `Encerramento de ${theme.label}`,
      ],
      Reel: [
        `Tour pelo restaurante em ${theme.label}`,
        `Lareiras Grill — ambiente especial`,
        `Meme de ${theme.label}`,
        `À la carte especial de ${theme.label}`,
        `Feedback de clientes`,
        `Especial de ${theme.label}`,
        `Bastidores da cozinha`,
        `Como fazemos nosso prato especial`,
      ],
    },
    'Luthita': {
      Post: [
        `Lookbook de ${theme.label}`,
        `Novidade na coleção de ${kw[2]}`,
        `Look para ${kw[0]}`,
        `Estilo para ${kw[1]}`,
        `Peças de ${kw[2]} em destaque`,
        `Look casual de ${theme.label}`,
        `Estilo especial — looks de ${theme.label}`,
        `Peças da coleção de ${theme.label}`,
      ],
      Reel: [
        `Unboxing coleção de ${theme.label}`,
        `Como usar sobreposições`,
        `Look do dia para ${theme.label}`,
        `Styling tips — ${kw[1]}`,
        `Novidades chegando`,
        `Haul de roupas de ${theme.label}`,
        `5 looks para ${kw[0]}`,
        `Looks para ${theme.label}`,
      ],
    },
    'LuzioPan': {
      Post: [
        `Receita especial de ${theme.label} com Prodipanni`,
        `Pão para ${kw[0]}`,
        `Prodipanni no cardápio de ${theme.label}`,
        `Bolo especial com Prodipanni`,
        `${theme.label} é o mês de vender mais`,
        `DONO DE PADARIA — especial ${theme.label}`,
        `Venda mais com o Prodipanni em ${theme.label}`,
        `Desenforme perfeito para ${kw[0]}`,
      ],
      Reel: [
        `Para quem é o Prodipanni`,
        `Quem é o Luzio — especial ${theme.label}`,
        `Prodipanni receita de ${theme.label}`,
        `Prodipanni bolo especial`,
        `Prodipanni para ${kw[0]}`,
        `Prodipanni receita surpresa`,
        `MEME DE ${theme.label.toUpperCase()}`,
        `Como fazer bolo perfeito`,
      ],
    },
    'Magia dos Temáticos': {
      Post: [
        `Festa temática de ${kw[0]}`,
        `Festa especial ${kw[1]}`,
        `Reserve sua data para ${theme.label}`,
        `Festa ${kw[0]} completa — tudo incluso`,
        `${kw[0]} — decoração temática`,
        `Pacote de festas para ${theme.label}`,
      ],
      Reel: [
        `Conheça a Magia dos Temáticos`,
        `Não é só uma festa, é uma experiência`,
        `Meme: como organizar uma festa em ${theme.label}`,
        `Você nunca viu uma festa assim`,
        `Bastidores da decoração de ${theme.label}`,
        `Festa de aniversário temática`,
      ],
    },
    'Padaria R.A': {
      Post: [
        `Delícias especiais de ${theme.label}`,
        `Bolo especial do mês`,
        `Pão quentinho para ${kw[2]}`,
        `Encomendas abertas — ${theme.label}`,
      ],
      Reel: [
        `Padaria R.A — especial ${theme.label}`,
        `Delícias de ${theme.label}`,
        `O café que você merece`,
        `Vem provar nossa novidade`,
      ],
    },
    'Pousada Dukuka': {
      Post: [
        `Pacote especial de ${theme.label}`,
        `${kw[1]} na pousada`,
        `${kw[0]} na pousada`,
        `Chalé aconchegante em ${theme.label}`,
        `${kw[0]} — fogueira e atividades`,
        `${theme.label} — reserve já!`,
      ],
      Reel: [
        `Tour pela pousada em ${theme.label}`,
        `Kaique influencer — especial ${theme.label}`,
        `Conforto e natureza em ${theme.label}`,
        `Surpresa de ${kw[1]}`,
        `Festa especial na pousada`,
        `Natureza em ${theme.label}`,
        `Depoimentos de hóspedes`,
        `Passeios pela região em ${theme.label}`,
        `Trilhas em ${theme.label}`,
        `Jardim da pousada`,
        `Vista incrível da pousada`,
        `Fim de semana perfeito`,
      ],
    },
    'Quero Bolo': {
      Post: [
        `Bolo especial de ${theme.label}`,
        `Bolo para ${kw[1]}`,
        `Encomendas para ${kw[0]}`,
        `Sabores de ${theme.label} — peça o seu`,
      ],
      Reel: [
        `Como fazemos o bolo de ${theme.label}`,
        `Decoração temática para ${kw[0]}`,
        `Bolo temático de ${theme.label}`,
        `Escolha seu sabor para ${theme.label}`,
      ],
    },
    'ViniPlas': {
      Post: [
        `Adesivos decorativos para ${kw[0]}`,
        `Personalização para ${kw[1]}`,
        `Vinil para fachadas e espaços`,
        `Soluções em plástico para eventos`,
        `Novidades da linha para ${theme.label}`,
        `Qualidade garantida em cada projeto`,
        `Orçamento expresso — sem burocracia`,
        `Projeto especial de ${theme.label}`,
      ],
      Reel: [
        `Aplicação de adesivo decorativo`,
        `Processo de produção ao vivo`,
        `Antes e depois`,
        `Personalização para ${kw[0]}`,
        `Tour pela fábrica`,
        `Produto mais vendido de ${theme.label}`,
        `Impressão digital de alta qualidade`,
        `Resultado final — cliente satisfeito`,
      ],
    },
    'Rosângela Varas': {
      Post: [
        `Alimentação saudável em ${theme.label}`,
        `Saúde hormonal em ${theme.label}`,
        `Exercícios para a estação`,
        `Como manter a saúde em ${theme.label}`,
        `${kw[0]}: guia prático de saúde`,
        `Cuide da sua saúde — ${monthLabel}`,
      ],
      Reel: [
        `Efeitos de ${theme.label} no metabolismo`,
        `Especial de saúde — ${monthLabel}`,
        `Hormônios e estação`,
        `Entrevista — saúde em ${theme.label}`,
        `${kw[0]} e saúde`,
        `Institucional — ${theme.label}`,
      ],
    },
    'Compostela': {
      Post: [
        `Menu de ${theme.label}`,
        `Ambiente especial em ${theme.label}`,
        `Reserve sua mesa — ${kw[1]}`,
        `Jantar especial de ${theme.label}`,
        `Novidade no cardápio de ${theme.label}`,
        `Destaque da semana`,
        `Promoção de fim de mês`,
        `Grupos e eventos para ${theme.label}`,
      ],
      Reel: [
        `Tour pelo espaço em ${theme.label}`,
        `Preparo dos pratos especiais`,
        `Experiência dos clientes`,
        `Cardápio de ${theme.label} em destaque`,
        `Como chegar ao Compostela`,
        `Especial do chef — ${theme.label}`,
        `Noite especial de ${kw[0]}`,
        `Ambiente rústico e aconchegante`,
      ],
    },
    'Suh Maya': {
      Post: [
        `Show especial de ${kw[0]}`,
        `Dica musical para ${theme.label}`,
        `${kw[0]} — ao vivo`,
        `Bastidores do show`,
      ],
      Reel: [
        `De qual cidade você é`,
        `Música especial de ${theme.label}`,
        `Postando composições de ${theme.label}`,
        `TBT show especial`,
        `De qual cidade você é — v2`,
        `Papo que rola no show`,
        `Só quem veio ao show`,
        `Deixa eu cantar — ${theme.label}`,
      ],
    },
  }

  const templates = clientTemplates[clientName]
  if (templates && templates[type]) {
    const list = templates[type]
    return list[idx % list.length]
  }

  // fallback
  const fallbackPost = [
    `Destaque de ${theme.label}`, `Novidade especial`, `Dica da semana`,
    `Promoção imperdível`, `Conheça nossos serviços`, `Por dentro da empresa`,
    `Resultado de cliente`, `O que nos diferencia`, `Você sabia?`,
    `Bastidores`, `Fique por dentro`, `Reserve já`,
  ]
  const fallbackReel = [
    `Tour pelo espaço`, `Antes e depois`, `Como funciona?`,
    `Transformação`, `Depoimento real`, `Um dia de trabalho`,
    `Novidade em vídeo`, `Processo passo a passo`,
  ]
  const list = type === 'Post' ? fallbackPost : fallbackReel
  return list[idx % list.length]
}

// ── Build DATA[] lines ──────────────────────────────────

const workdays = getWorkdays(year, monthIndex)

let id = baseId
const lines = []

for (const client of clients) {
  const postDays = pickSafeDays(client.posts)
  const reelDays = pickDays(workdays, client.reels)

  const sep = `  // ── ${client.name} ── ${client.posts} Posts · ${client.reels} Reels ${'─'.repeat(Math.max(0, 60 - client.name.length))}`
  lines.push(sep)

  postDays.forEach((day, i) => {
    const title = makeTitles(client.name, 'Post', client.posts, i)
    const escaped = client.name.replace(/'/g, "\\'")
    const pad = n => String(n).padStart(4, ' ')
    lines.push(`  { i: ${pad(id++)}, c: '${escaped}', dt: d(${String(day).padStart(2,' ')}), tp: 'Post', n: '${title}', s: s(${String(day).padStart(2,' ')}) },`)
  })

  reelDays.forEach((day, i) => {
    const title = makeTitles(client.name, 'Reel', client.reels, i)
    const escaped = client.name.replace(/'/g, "\\'")
    const pad = n => String(n).padStart(4, ' ')
    lines.push(`  { i: ${pad(id++)}, c: '${escaped}', dt: d(${String(day).padStart(2,' ')}), tp: 'Reel', n: '${title}', s: s(${String(day).padStart(2,' ')}) },`)
  })

  lines.push('')
}

// ── Preserve full CLIENTS block from existing file ──────

// Extract the full CLIENTS block preserving all fields (sheetUrl, scriptUrl, etc.)
const fullClientsMatch = src.match(/export const CLIENTS: Client\[\] = \[[\s\S]*?\n\]/)
const clientsSection = fullClientsMatch ? fullClientsMatch[0] : null

// Build a minimal CLIENTS section if we can't extract the full one
function buildClientsSection() {
  if (clientsSection) return clientsSection
  return `export const CLIENTS: Client[] = [\n${clients.map(c =>
    `  { name: '${c.name.replace(/'/g, "\\'")}', postsPerMonth: ${c.posts}, reelsPerMonth: ${c.reels} },`
  ).join('\n')}\n]`
}

// ── Write output ────────────────────────────────────────

const monthDisplay = MONTH_NAMES_DISPLAY[monthIndex]
const totalItems = id - baseId

const newFile = `import type { Client, ContentItem } from './types'

${buildClientsSection()}

// ${monthDisplay} ${year} — gerado automaticamente por scripts/gen-mes.ts
export const BASE_DATE = new Date(${year}, ${monthIndex}, 1)

const d = (day: number) => new Date(${year}, ${monthIndex}, day)
const s = (_day: number): 0 | 1 | 2 | 3 => 0

export const DATA: ContentItem[] = [

${lines.join('\n')}]
`

writeFileSync(dataPath, newFile, 'utf8')

const lastId = id - 1
console.log(`✅ Gerado src/data.ts — ${monthDisplay} ${year} · ${totalItems} itens · IDs ${baseId}–${lastId}`)
