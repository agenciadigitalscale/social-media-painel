// A página que o cliente abre pelo WhatsApp.
//
// Serve o shell do SPA com as meta tags Open Graph preenchidas (título do
// criativo + miniatura pelo nosso domínio), para o link chegar com cara de
// coisa da agência e não de golpe.
//
// ⚠️ **Esta rota é o caminho crítico do cliente.** Se ela falhar, ele não vê
// "erro ao carregar o criativo" — vê a página de erro da Cloudflare, com Ray ID
// e tudo, e liga reclamando. Duas regras nasceram disso:
//
//  1. **Nada de `JSON.parse` em linha grande.** Até 2026-08-06 esta função lia o
//     `sm_states` INTEIRO do D1 (o estado de todos os itens de todos os
//     clientes) e parseava tudo para pegar um título e um link. Resultado
//     medido no celular do cliente: `Error 1102 — Worker exceeded resource
//     limits`. O orçamento de CPU acabava antes de a página existir. Hoje quem
//     lê o campo é o SQLite, via `json_extract` (`_lib/appdata.ts`).
//  2. **Enfeite nunca derruba a página.** O SPA sabe se virar sozinho: ele
//     busca os próprios dados em `/api/portal`. As meta tags são para o
//     preview do WhatsApp. Qualquer falha aqui serve o HTML puro — o cliente vê
//     o criativo, o link é que fica sem miniatura.

import { clientForToken, itemFields } from '../../api/_lib/appdata'

interface Env {
  DB: D1Database
  ASSETS: Fetcher
}

/** Vale por 2 min na borda: o robô do WhatsApp e o toque do cliente são duas
 *  visitas à mesma URL, e um link repassado num grupo vira uma dezena. O
 *  navegador não guarda (`max-age=0`) porque a decisão do cliente muda a tela. */
const CACHE_CONTROL = 'public, max-age=0, s-maxage=120'

function extractDriveFileId(url: string): string | null {
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (m1) return m1[1]
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (m2) return m2[1]
  return null
}

/** Título de cliente com aspas quebrava a meta tag e sumia com a prévia. */
function escapeAttr(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Cache da borda, quando existe. Fora do Workers (`vitest`, `wrangler` sem
 * cache) o global `caches` simplesmente não está lá — e ler pelo `globalThis`
 * devolve `undefined` em vez de estourar `ReferenceError`, que derrubaria a
 * página justamente pelo enfeite que ela deveria poder dispensar.
 */
function edgeCache(): Cache | null {
  const g = globalThis as { caches?: { default?: Cache } }
  return g.caches?.default ?? null
}

interface Og { title: string; description: string; image: string }

/** O que sai quando não deu para enriquecer — e é uma página perfeitamente boa. */
function defaultOg(origin: string): Og {
  return {
    title: 'Digital Scale — Aprovação de criativo',
    description: 'Toque para visualizar e aprovar o seu criativo.',
    image: `${origin}/logotipo.png`,
  }
}

async function resolveOg(env: Env, origin: string, token: string, itemId: string): Promise<Og> {
  const og = defaultOg(origin)
  if (!/^\d+$/.test(itemId)) return og

  const clientName = await clientForToken(env.DB, token)
  if (!clientName) return og

  og.description = `${clientName} — toque para visualizar e aprovar o criativo.`

  const { fields } = await itemFields(env.DB, 'sm_states', itemId, ['title', 'link'])

  const title = typeof fields.title === 'string' ? fields.title : ''
  if (title) og.title = `${title} · ${clientName}`

  const link = typeof fields.link === 'string' ? fields.link : ''
  if (link) {
    const fileId = extractDriveFileId(link)
    // Miniatura pelo NOSSO domínio: `drive.google.com/thumbnail` só responde
    // para arquivo público, e pasta Publicar é privada — o link chegava no
    // WhatsApp sem imagem, com cara de golpe.
    if (fileId) og.image = `${origin}/api/thumb?id=${fileId}&sz=400`
  }

  return og
}

function injectOg(html: string, og: Og): string {
  const safeTitle = escapeAttr(og.title)
  const safeDesc  = escapeAttr(og.description)
  const safeImage = escapeAttr(og.image)

  const ogBlock = `
    <meta property="og:site_name" content="Digital Scale" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${safeImage}" />`

  return html.replace(
    /<meta property="og:site_name"[\s\S]*?<meta property="og:type" content="website" \/>/,
    ogBlock.trim(),
  )
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  // `waitUntil` fica no `ctx`: desestruturar perde o `this` e estoura em
  // runtime — o `sync.ts` já resolvia isso com `.bind(ctx)`.
  const { params, env, request } = ctx

  const origin = new URL(request.url).origin
  const shell  = new Request(`${origin}/index.html`)

  // Já renderizada há pouco? Sai sem tocar no banco.
  const cache = edgeCache()
  const key   = new Request(request.url, { method: 'GET' })
  if (cache) {
    try {
      const hit = await cache.match(key)
      if (hit) return hit
    } catch { /* cache indisponível — segue o baile */ }
  }

  let html: string
  try {
    html = await (await env.ASSETS.fetch(shell)).text()
  } catch {
    // Sem o shell não há o que enfeitar; devolver o asset cru é melhor que 500.
    return env.ASSETS.fetch(shell)
  }

  let og = defaultOg(origin)
  try {
    og = await resolveOg(env, origin, String(params.token), String(params.itemId))
  } catch { /* sem DB (preview local) ou consulta ruim — vai o padrão */ }

  const response = new Response(injectOg(html, og), {
    headers: {
      'Content-Type':  'text/html;charset=UTF-8',
      'Cache-Control': CACHE_CONTROL,
    },
  })

  if (cache) {
    try {
      ctx.waitUntil(cache.put(key, response.clone()))
    } catch { /* idem */ }
  }

  return response
}
