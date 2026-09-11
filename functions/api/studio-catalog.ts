import { CATALOG_KEY, normalizeCatalog } from './_lib/studio-catalog'

interface Env {
  DB: D1Database
}

// Aberto de propósito (🌐): é catálogo de conteúdo de uso livre, só leitura, e
// o consumidor é o app desktop, que não tem sessão. Nada de segredo aqui — os
// pacotes apontam para arquivos livres/CC. Publicar novidade é ESCRITA, e essa
// vai pelo /api/sync (autenticável, com rev); este endpoint só serve.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ packs: [] }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
  let raw: unknown = null
  try {
    const row = await env.DB.prepare('SELECT value FROM app_data WHERE key = ?1')
      .bind(CATALOG_KEY).first<{ value: string }>()
    raw = row?.value ?? null
  } catch {
    // D1 fora do ar não pode virar erro na cara do editor: um catálogo vazio faz
    // o Studio dizer "sem novidades", que é o comportamento correto de degradação.
    raw = null
  }
  const manifest = normalizeCatalog(raw)
  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/json',
      // Borda por 5 min: novidade não é urgente, e o Studio consulta a pedido do
      // usuário — sem cache, cada clique bateria no D1.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      ...CORS,
    },
  })
}
