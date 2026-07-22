// Miniatura de um arquivo do Drive, servida pelo nosso domínio.
//
// `drive.google.com/thumbnail?id=…` só responde para arquivo público — e as
// pastas Publicar são privadas por padrão. Era por isso que a prévia do link no
// WhatsApp chegava sem imagem (link com cara de golpe) e o `poster` do player
// ficava preto até o vídeo carregar.
//
// Aqui a service account resolve a miniatura e nós entregamos os bytes, com
// cache longo: miniatura de arquivo pronto não muda.

import { getAccessToken } from './_lib/google-auth'

interface Env {
  DB: D1Database
  GOOGLE_SA_KEY?: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
}

const CACHE = 'public, max-age=86400, stale-while-revalidate=604800'

async function fromServiceAccount(fileId: string, size: number, env: Env): Promise<Response | null> {
  if (!env.GOOGLE_SA_KEY || !env.DB) return null

  let token: string
  try {
    token = await getAccessToken({ DB: env.DB, GOOGLE_SA_KEY: env.GOOGLE_SA_KEY })
  } catch {
    return null
  }
  const auth = { Authorization: `Bearer ${token}` }

  try {
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink,mimeType&supportsAllDrives=true`,
      { headers: auth },
    )
    if (!metaRes.ok) return null
    const meta = await metaRes.json<{ thumbnailLink?: string; mimeType?: string }>()

    // O Drive gera miniatura de vídeo e de imagem; quando não gerou (arquivo
    // recém-subido), a própria imagem serve de miniatura.
    if (meta.thumbnailLink) {
      // O sufixo do Drive varia (`=s220`, `=w200-h150-p`, às vezes nenhum) e um
      // replace ancorado em `=s\d+` errava calado: vinha o quadro em tamanho
      // cheio — 871 KB medidos para um poster. Troca o sufixo, qualquer que seja.
      const link = `${meta.thumbnailLink.replace(/=[^=/]*$/, '')}=s${size}`
      const img = await fetch(link, { headers: auth })
      if (img.ok && !(img.headers.get('Content-Type') ?? '').includes('text/html')) {
        return new Response(img.body, {
          headers: {
            ...CORS,
            'Content-Type': img.headers.get('Content-Type') ?? 'image/jpeg',
            'Cache-Control': CACHE,
          },
        })
      }
      try { img.body?.cancel() } catch { /* corpo já consumido */ }
    }

    if (meta.mimeType?.startsWith('image/')) {
      const raw = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
        { headers: auth },
      )
      if (raw.ok) {
        return new Response(raw.body, {
          headers: { ...CORS, 'Content-Type': meta.mimeType, 'Cache-Control': CACHE },
        })
      }
      try { raw.body?.cancel() } catch { /* corpo já consumido */ }
    }
  } catch { /* cai no caminho público */ }

  return null
}

async function fromPublicDrive(fileId: string, size: number): Promise<Response | null> {
  try {
    const res = await fetch(`https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`, {
      redirect: 'follow',
    })
    if (!res.ok || (res.headers.get('Content-Type') ?? '').includes('text/html')) {
      try { res.body?.cancel() } catch { /* corpo já consumido */ }
      return null
    }
    return new Response(res.body, {
      headers: {
        ...CORS,
        'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
        'Cache-Control': CACHE,
      },
    })
  } catch {
    return null
  }
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const url    = new URL(request.url)
  const fileId = url.searchParams.get('id')
  const size   = Math.min(Math.max(Number(url.searchParams.get('sz')) || 800, 100), 1600)

  if (!fileId || !/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
    return new Response('Invalid file ID', { status: 400, headers: CORS })
  }

  const served = (await fromServiceAccount(fileId, size, env)) ?? (await fromPublicDrive(fileId, size))
  if (served) return served

  // Sem miniatura: 404 deixa o <img> cair no seu próprio fallback, e o WhatsApp
  // mostra o link sem imagem em vez de um quadrado quebrado.
  return new Response('Sem miniatura', { status: 404, headers: CORS })
}
