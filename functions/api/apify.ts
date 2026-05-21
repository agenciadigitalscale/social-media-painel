/* functions/api/apify.ts
   Proxy para Apify Google Maps Scraper
   Actor: apify/google-maps-scraper (nwua9Gu5YkAVuf7GQ)

   Chave vem de: env.APIFY_API_TOKEN (Cloudflare Dashboard)
             ou: header X-Apify-Token (usuário cola no painel)

   Ações:
     POST action=run    — inicia extração, retorna runId
     GET  action=status — status do run (running/succeeded/failed)
     GET  action=results— itens do dataset quando succeeded
*/

interface Env {
  APIFY_API_TOKEN?: string
}

interface ApifyRunInput {
  searchStringsArray: string[]
  maxCrawledPlacesPerSearch: number
  language: string
  deeperCityScrape: boolean
  exportPlaceUrls: boolean
}

interface ApifyRunResult {
  data?: {
    id: string
    status: string
    defaultDatasetId: string
  }
}

interface ApifyPlace {
  title?: string
  address?: string
  phone?: string
  website?: string
  rating?: number
  reviewsCount?: number
  categoryName?: string
  placeId?: string
  location?: { lat?: number; lng?: number }
  instagram?: string
  emails?: string[]
  imageUrl?: string
  totalScore?: number
  url?: string
}

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Apify-Token',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' },
    })
  }

  const token = ctx.env.APIFY_API_TOKEN || ctx.request.headers.get('X-Apify-Token') || ''
  if (!token) {
    return json({ ok: false, error: 'Token Apify não configurado. Cole seu token no painel de Prospecção.' }, 400)
  }

  const url = new URL(ctx.request.url)
  const action = url.searchParams.get('action') || ''

  // ── POST /api/apify?action=run ─────────────────────────────
  if (ctx.request.method === 'POST' && action === 'run') {
    let body: { query: string; maxPlaces?: number } = { query: '' }
    try {
      body = await ctx.request.json() as typeof body
    } catch {
      return json({ ok: false, error: 'Body JSON inválido' }, 400)
    }

    if (!body.query?.trim()) {
      return json({ ok: false, error: 'Campo query obrigatório' }, 400)
    }

    const maxPlaces = Math.min(body.maxPlaces ?? 20, 100)

    const input: ApifyRunInput = {
      searchStringsArray: [body.query.trim()],
      maxCrawledPlacesPerSearch: maxPlaces,
      language: 'en',
      deeperCityScrape: false,
      exportPlaceUrls: false,
    }

    // Actor: compass/crawler-google-places (mais popular scraper de Maps no Apify)
    const actorId = 'compass~crawler-google-places'
    const res = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    if (!res.ok) {
      const err = await res.text()
      return json({ ok: false, error: `Apify: ${res.status} — ${err.slice(0, 200)}` }, 502)
    }

    const data = await res.json() as ApifyRunResult
    const runId = data?.data?.id
    if (!runId) return json({ ok: false, error: 'Apify não retornou runId' }, 502)

    return json({ ok: true, runId })
  }

  // ── GET /api/apify?action=status&runId=xxx ─────────────────
  if (ctx.request.method === 'GET' && action === 'status') {
    const runId = url.searchParams.get('runId') || ''
    if (!runId) return json({ ok: false, error: 'Parâmetro runId obrigatório' }, 400)

    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`)
    if (!res.ok) return json({ ok: false, error: `Apify status: ${res.status}` }, 502)

    const data = await res.json() as ApifyRunResult
    const status = data?.data?.status ?? 'UNKNOWN'
    const datasetId = data?.data?.defaultDatasetId ?? ''

    return json({ ok: true, status, datasetId })
  }

  // ── GET /api/apify?action=results&datasetId=xxx ────────────
  if (ctx.request.method === 'GET' && action === 'results') {
    const datasetId = url.searchParams.get('datasetId') || ''
    if (!datasetId) return json({ ok: false, error: 'Parâmetro datasetId obrigatório' }, 400)

    const res = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&format=json`,
    )
    if (!res.ok) return json({ ok: false, error: `Apify results: ${res.status}` }, 502)

    const items = await res.json() as ApifyPlace[]
    return json({ ok: true, items })
  }

  return json({ ok: false, error: `Ação inválida: ${action}` }, 400)
}
