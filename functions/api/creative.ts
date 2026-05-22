/* functions/api/creative.ts
   Proxy de geração de imagem com suporte a múltiplos providers:
   - OpenAI      (gpt-image-1)        → X-OpenAI-Key
   - Together.ai (FLUX.1-schnell/dev) → X-Together-Key
   - HuggingFace (FLUX.1-schnell)     → X-HF-Key       (GRÁTIS)
*/

interface Env {
  OPENAI_API_KEY?: string
  TOGETHER_API_KEY?: string
  HF_API_KEY?: string
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
  provider?: 'openai' | 'together' | 'hf'
  quality?: 'fast' | 'high'
}

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-OpenAI-Key, X-Together-Key, X-HF-Key',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

function buildPrompt(body: RequestBody): string {
  const { command, format, clientName, branding } = body
  const formatDesc =
    format === 'story'     ? 'vertical 9:16 Instagram Story'
    : format === 'carrossel' ? 'square 1:1 Instagram carousel slide'
                             : 'square 1:1 Instagram feed post'

  const colors = [branding.primaryColor, branding.secondaryColor].filter(Boolean).join(' and ')

  const lines = [
    `Professional social media creative in ${formatDesc} format.`,
    `Brand/client: ${clientName}.`,
    `Theme: ${command}.`,
    branding.style       ? `Visual style: ${branding.style}.`         : '',
    colors               ? `Color palette: ${colors}.`                : '',
    branding.font        ? `Typography: ${branding.font}.`            : '',
    branding.extraContext ? `Brand context: ${branding.extraContext}.` : '',
    'Clean design, high quality, professional digital marketing.',
    'Leave space for text/title overlay. No watermarks or generic logos.',
  ]
  return lines.filter(Boolean).join(' ')
}

// ── OpenAI gpt-image-1 ────────────────────────────────
async function generateOpenAI(prompt: string, format: string, token: string) {
  const size = format === 'story' ? '1024x1536' : '1024x1024'
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size, quality: 'medium' }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 300)}`)
  }
  const data = await res.json() as { data?: { url?: string; b64_json?: string }[]; error?: { message: string } }
  if (data.error) throw new Error(data.error.message)
  const item = data.data?.[0]
  return item?.url ?? (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : '')
}

// ── Together.ai FLUX ──────────────────────────────────
async function generateTogether(prompt: string, format: string, token: string, quality: string) {
  const model = quality === 'high'
    ? 'black-forest-labs/FLUX.1-dev'
    : 'black-forest-labs/FLUX.1-schnell'
  const isStory = format === 'story'
  const width  = isStory ? 576  : 1024
  const height = isStory ? 1024 : 1024
  const steps  = quality === 'high' ? 28 : 4

  const res = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ model, prompt, width, height, n: 1, steps }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Together ${res.status}: ${err.slice(0, 300)}`)
  }
  const data = await res.json() as { data?: { url?: string; b64_json?: string }[]; error?: { message: string } }
  if (data.error) throw new Error(data.error.message)
  const item = data.data?.[0]
  return item?.url ?? (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : '')
}

// ── HuggingFace Inference API — FLUX.1-schnell (GRÁTIS) ──
// Retorna imagem binária → converte para base64
async function generateHuggingFace(prompt: string, token: string) {
  const res = await fetch(
    'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ inputs: prompt, parameters: { num_inference_steps: 4 } }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HuggingFace ${res.status}: ${err.slice(0, 300)}`)
  }
  const mime = res.headers.get('Content-Type') || 'image/jpeg'
  const arrayBuffer = await res.arrayBuffer()
  const uint8 = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i])
  }
  return `data:${mime};base64,${btoa(binary)}`
}

// ── Handler ───────────────────────────────────────────
export const onRequest = async (ctx: { request: Request; env: Env }) => {
  if (ctx.request.method === 'OPTIONS') {
    return new Response(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } })
  }
  if (ctx.request.method !== 'POST') return json({ ok: false, error: 'Método não suportado' }, 405)

  let body: RequestBody
  try { body = (await ctx.request.json()) as RequestBody }
  catch { return json({ ok: false, error: 'Body JSON inválido' }, 400) }

  if (!body.command?.trim()) return json({ ok: false, error: 'Campo command obrigatório' }, 400)

  const provider = body.provider ?? 'openai'
  const quality  = body.quality  ?? 'fast'
  const prompt   = buildPrompt(body)

  try {
    let imageUrl = ''

    if (provider === 'together') {
      const token = ctx.request.headers.get('X-Together-Key') || ctx.env.TOGETHER_API_KEY || ''
      if (!token) return json({ ok: false, error: 'Chave Together.ai não configurada.' }, 400)
      imageUrl = await generateTogether(prompt, body.format, token, quality)

    } else if (provider === 'hf') {
      const token = ctx.request.headers.get('X-HF-Key') || ctx.env.HF_API_KEY || ''
      if (!token) return json({ ok: false, error: 'Token HuggingFace não configurado. Obtenha em huggingface.co/settings/tokens' }, 400)
      imageUrl = await generateHuggingFace(prompt, token)

    } else {
      const token = ctx.request.headers.get('X-OpenAI-Key') || ctx.env.OPENAI_API_KEY || ''
      if (!token) return json({ ok: false, error: 'Chave OpenAI não configurada. Configure em platform.openai.com' }, 400)
      imageUrl = await generateOpenAI(prompt, body.format, token)
    }

    if (!imageUrl) return json({ ok: false, error: 'Imagem não retornada pelo provider.' }, 500)
    return json({ ok: true, imageUrl })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ ok: false, error: msg }, 502)
  }
}
