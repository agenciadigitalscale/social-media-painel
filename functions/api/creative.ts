/* functions/api/creative.ts
   Proxy para OpenAI Images API (DALL-E 3)
   Gera criativos de social media com base no branding kit do cliente.

   Chave via: header X-OpenAI-Key (usuário cola no Studio)
           ou: env.OPENAI_API_KEY (Cloudflare Dashboard)
*/

interface Env {
  OPENAI_API_KEY?: string
}

interface BrandingKit {
  primaryColor?: string
  secondaryColor?: string
  style?: string
  font?: string
  logoUrl?: string
  extraContext?: string
}

interface RequestBody {
  command: string
  format: 'story' | 'post' | 'carrossel'
  clientName: string
  branding: BrandingKit
}

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-OpenAI-Key',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

function buildPrompt(body: RequestBody): string {
  const { command, format, clientName, branding } = body

  const formatDesc =
    format === 'story'
      ? 'formato vertical 9:16 para Instagram Story'
      : format === 'carrossel'
        ? 'formato quadrado 1:1 para slide de carrossel Instagram'
        : 'formato quadrado 1:1 para post feed Instagram'

  const colors = [branding.primaryColor, branding.secondaryColor]
    .filter(Boolean)
    .join(' e ')

  const lines = [
    `Crie um criativo profissional de social media em ${formatDesc}.`,
    `Marca/cliente: ${clientName}.`,
    `Tema ou chamada: ${command}.`,
    branding.style ? `Estilo visual: ${branding.style}.` : '',
    colors ? `Paleta de cores predominante: ${colors}.` : '',
    branding.font ? `Tipografia: ${branding.font}.` : '',
    branding.extraContext ? `Contexto da marca: ${branding.extraContext}.` : '',
    'Características: design limpo, alta qualidade, adequado para marketing digital profissional.',
    'Inclua espaço para texto/título. Fundo bem definido. Sem marcas d\'água ou logos genéricos.',
  ]

  return lines.filter(Boolean).join(' ')
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
    })
  }

  if (ctx.request.method !== 'POST') {
    return json({ ok: false, error: 'Método não suportado' }, 405)
  }

  const token =
    ctx.request.headers.get('X-OpenAI-Key') || ctx.env.OPENAI_API_KEY || ''

  if (!token) {
    return json(
      {
        ok: false,
        error:
          'Chave OpenAI não configurada. Cole sua chave em platform.openai.com no painel Studio.',
      },
      400,
    )
  }

  let body: RequestBody
  try {
    body = (await ctx.request.json()) as RequestBody
  } catch {
    return json({ ok: false, error: 'Body JSON inválido' }, 400)
  }

  if (!body.command?.trim()) {
    return json({ ok: false, error: 'Campo command obrigatório' }, 400)
  }

  const prompt = buildPrompt(body)
  const size = body.format === 'story' ? '1024x1792' : '1024x1024'

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality: 'standard',
      response_format: 'url',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return json(
      { ok: false, error: `OpenAI ${res.status}: ${err.slice(0, 300)}` },
      502,
    )
  }

  const data = (await res.json()) as {
    data?: { url: string; revised_prompt?: string }[]
    error?: { message: string }
  }

  if (data.error) {
    return json({ ok: false, error: data.error.message }, 500)
  }

  const imageUrl = data.data?.[0]?.url ?? ''
  const revisedPrompt = data.data?.[0]?.revised_prompt

  return json({ ok: true, imageUrl, revisedPrompt })
}
