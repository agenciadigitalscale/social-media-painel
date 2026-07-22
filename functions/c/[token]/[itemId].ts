interface Env {
  DB: D1Database
  ASSETS: Fetcher
}

async function getKey(db: D1Database, key: string): Promise<unknown> {
  const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(key).first<{ value: string }>()
  return row ? JSON.parse(row.value) : null
}

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

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { params, env, request } = ctx
  const token  = params.token  as string
  const itemId = params.itemId as string

  // Busca o HTML base do SPA
  const origin  = new URL(request.url).origin
  const htmlRes = await env.ASSETS.fetch(new Request(`${origin}/index.html`))
  let html      = await htmlRes.text()

  let ogTitle       = 'Digital Scale — Aprovação de criativo'
  let ogDescription = 'Toque para visualizar e aprovar o seu criativo.'
  let ogImage       = `${origin}/logotipo.png`

  try {
    // Valida token → clientName
    const tokens     = (await getKey(env.DB, 'sm_portal_tokens') ?? {}) as Record<string, string>
    const clientName = Object.entries(tokens).find(([, t]) => t === token)?.[0]

    if (clientName) {
      const states = (await getKey(env.DB, 'sm_states') ?? {}) as Record<string, { title?: string; link?: string }>
      const state  = states[itemId]

      if (state?.title) ogTitle = `${state.title} · ${clientName}`
      ogDescription = `${clientName} — toque para visualizar e aprovar o criativo.`

      if (state?.link) {
        const fileId = extractDriveFileId(state.link)
        if (fileId) {
          // Miniatura pelo NOSSO domínio: `drive.google.com/thumbnail` só responde
          // para arquivo público, e pasta Publicar é privada — o link chegava no
          // WhatsApp sem imagem, com cara de golpe.
          ogImage = `${origin}/api/thumb?id=${fileId}&sz=800`
        }
      }
    }
  } catch {
    // Sem DB no preview local — usa defaults
  }

  // Injeta OG tags dinâmicas substituindo os defaults do index.html
  const safeTitle = escapeAttr(ogTitle)
  const safeDesc  = escapeAttr(ogDescription)
  const safeImage = escapeAttr(ogImage)

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

  html = html.replace(
    /<meta property="og:site_name"[\s\S]*?<meta property="og:type" content="website" \/>/,
    ogBlock.trim()
  )

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'no-store',
    },
  })
}
