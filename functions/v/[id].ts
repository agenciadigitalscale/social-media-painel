/// <reference types="@cloudflare/workers-types" />
// ── /v/:id — Página de visualização com OG tags para WhatsApp ─────────────────
// Gera preview rico (thumbnail + título + player) quando compartilhado no WhatsApp.
// Uso: https://seusite.pages.dev/v/{streamable-id}?t=Titulo&c=NomeCliente
// ─────────────────────────────────────────────────────────────────────────────

interface Env { ASSETS: Fetcher }

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { params, request } = ctx
  const id     = (params.id as string).replace(/[^a-zA-Z0-9_-]/g, '')
  const url    = new URL(request.url)
  const title  = url.searchParams.get('t')  || 'Vídeo'
  const client = url.searchParams.get('c')  || 'Digital Scale'
  const origin = url.origin

  const thumb = `https://cdn-cf-east.streamable.com/image/${id}.jpg`
  const embed = `https://streamable.com/e/${id}`
  const share = `https://streamable.com/${id}`
  const self  = url.href

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — ${esc(client)}</title>

  <!-- Open Graph — lido pelo WhatsApp antes de executar JS -->
  <meta property="og:site_name"         content="Digital Scale" />
  <meta property="og:type"              content="video.other" />
  <meta property="og:title"             content="${esc(title)}" />
  <meta property="og:description"       content="${esc(client)} · Toque para assistir o vídeo" />
  <meta property="og:image"             content="${esc(thumb)}" />
  <meta property="og:image:width"       content="1280" />
  <meta property="og:image:height"      content="720" />
  <meta property="og:video"             content="${esc(embed)}" />
  <meta property="og:video:secure_url"  content="${esc(embed)}" />
  <meta property="og:video:type"        content="text/html" />
  <meta property="og:video:width"       content="1280" />
  <meta property="og:video:height"      content="720" />
  <meta property="og:url"               content="${esc(self)}" />

  <!-- Twitter Player Card -->
  <meta name="twitter:card"             content="player" />
  <meta name="twitter:title"            content="${esc(title)}" />
  <meta name="twitter:description"      content="${esc(client)} · Assistir agora" />
  <meta name="twitter:image"            content="${esc(thumb)}" />
  <meta name="twitter:player"           content="${esc(embed)}" />
  <meta name="twitter:player:width"     content="1280" />
  <meta name="twitter:player:height"    content="720" />

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #070707;
      color: #fff;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .wrapper {
      width: 100%;
      max-width: 860px;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(0,0,0,0.8);
      margin: 20px 16px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      background: rgba(255,144,57,0.05);
      border-bottom: 1px solid rgba(255,144,57,0.12);
    }
    .logo {
      width: 32px; height: 32px;
      border-radius: 9px;
      background: linear-gradient(135deg, #ff9039, #ff5339);
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 15px; color: #000;
      flex-shrink: 0;
      box-shadow: 0 0 16px rgba(255,144,57,0.35);
    }
    .meta { flex: 1; min-width: 0; }
    .client-label {
      font-size: 9.5px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.09em;
      color: rgba(255,144,57,0.65); margin-bottom: 2px;
    }
    .video-title {
      font-size: 14px; font-weight: 800; color: #fff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      letter-spacing: -0.01em;
    }
    .player-wrap {
      position: relative; width: 100%; padding-top: 56.25%;
      background: #000;
    }
    .player-wrap iframe {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%; border: none;
    }
    .footer {
      padding: 10px 18px;
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      background: rgba(255,255,255,0.018);
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 100px;
      background: rgba(255,144,57,0.1);
      border: 1px solid rgba(255,144,57,0.22);
      font-size: 10px; font-weight: 700; color: #ff9039;
    }
    .ext-link {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 100px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      font-size: 10px; color: rgba(255,255,255,0.4);
      text-decoration: none;
      transition: all 0.15s;
    }
    .ext-link:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); }
    .agency { margin-left: auto; font-size: 10px; color: rgba(255,255,255,0.18); font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">DS</div>
      <div class="meta">
        <div class="client-label">${esc(client)}</div>
        <div class="video-title">${esc(title)}</div>
      </div>
    </div>

    <div class="player-wrap">
      <iframe
        src="${esc(embed)}"
        allow="fullscreen; autoplay"
        allowfullscreen
        loading="lazy"
      ></iframe>
    </div>

    <div class="footer">
      <span class="badge">🎬 ${esc(title)}</span>
      <a class="ext-link" href="${esc(share)}" target="_blank" rel="noopener">↗ Abrir no Streamable</a>
      <span class="agency">Digital Scale Agency</span>
    </div>
  </div>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
