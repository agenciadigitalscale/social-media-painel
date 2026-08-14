/* functions/api/places.ts
   Proxy para Google Places API — evita expor a chave no client.
   Chave vem de: env.GOOGLE_PLACES_API_KEY (Cloudflare Dashboard)
             ou: header X-Places-Key (usuário cola no painel)
*/

import { guardPanelRoute, type PanelGuardEnv } from './_lib/panel-guard'

interface Env extends PanelGuardEnv { GOOGLE_PLACES_API_KEY?: string }

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === 'OPTIONS') {
    return new Response(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'X-Places-Key' } })
  }

  const blocked = await guardPanelRoute(
    { request: ctx.request, env: ctx.env, waitUntil: ctx.waitUntil.bind(ctx) },
    CORS,
  )
  if (blocked) return blocked

  const apiKey = ctx.env.GOOGLE_PLACES_API_KEY || ctx.request.headers.get('X-Places-Key') || ''
  if (!apiKey) return json({ ok: false, error: 'Chave da API do Google não configurada. Cole sua chave no painel de Prospecção.' }, 400)

  const url = new URL(ctx.request.url)
  const action = url.searchParams.get('action') || 'search'

  // ── Text Search ────────────────────────────────────────
  if (action === 'search') {
    const q = url.searchParams.get('q') || ''
    if (!q) return json({ ok: false, error: 'Parâmetro q obrigatório' }, 400)

    const pageToken = url.searchParams.get('pageToken') || ''
    let apiUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?language=pt-BR&key=${apiKey}`
    if (pageToken) {
      apiUrl += `&pagetoken=${pageToken}`
    } else {
      apiUrl += `&query=${encodeURIComponent(q)}`
    }

    const res = await fetch(apiUrl)
    const data = await res.json() as { status: string; results: unknown[]; next_page_token?: string }

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return json({ ok: false, error: `Google Places: ${data.status}` }, 500)
    }

    return json({ ok: true, results: data.results ?? [], nextPageToken: data.next_page_token ?? null })
  }

  // ── Place Details ──────────────────────────────────────
  if (action === 'details') {
    const placeId = url.searchParams.get('id') || ''
    if (!placeId) return json({ ok: false, error: 'Parâmetro id obrigatório' }, 400)

    const fields = 'name,formatted_phone_number,website,rating,user_ratings_total,formatted_address,photos,types,opening_hours'
    const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=pt-BR&key=${apiKey}`

    const res = await fetch(apiUrl)
    const data = await res.json() as { status: string; result: unknown }

    if (data.status !== 'OK') return json({ ok: false, error: `Google Places Details: ${data.status}` }, 500)
    return json({ ok: true, result: data.result })
  }

  // ── Photo proxy ───────────────────────────────────────
  if (action === 'photo') {
    const ref = url.searchParams.get('ref') || ''
    if (!ref) return json({ ok: false, error: 'Parâmetro ref obrigatório' }, 400)

    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${ref}&key=${apiKey}`
    const res = await fetch(photoUrl)
    const blob = await res.blob()
    return new Response(blob, { headers: { 'Content-Type': res.headers.get('Content-Type') || 'image/jpeg', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400' } })
  }

  return json({ ok: false, error: 'Ação desconhecida' }, 400)
}
