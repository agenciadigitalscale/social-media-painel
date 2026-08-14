import { guardPanelRoute, type PanelGuardEnv } from './_lib/panel-guard'

interface Env extends PanelGuardEnv {
  ANTHROPIC_API_KEY?: string
  GROQ_API_KEY?: string
}

interface RequestBody {
  messages: { role: 'user' | 'assistant'; content: string }[]
  system: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

async function callAnthropic(apiKey: string, system: string, messages: RequestBody['messages']) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system,
      messages,
    }),
  })
  const data = await res.json() as {
    content?: { type: string; text: string }[]
    error?: { message: string }
  }
  if (data.error) throw new Error(data.error.message)
  const text = data.content?.find(b => b.type === 'text')?.text ?? 'Sem resposta'
  return text
}

async function callGroq(apiKey: string, system: string, messages: RequestBody['messages']) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages,
      ],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  })
  const data = await res.json() as {
    choices?: { message: { content: string } }[]
    error?: { message: string }
  }
  if (data.error) throw new Error(data.error.message)
  const text = data.choices?.[0]?.message?.content ?? 'Sem resposta'
  return text
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx

  // Relé aberto para a conta Anthropic da agência enquanto não houver guarda:
  // a chave sai do `env`, o CORS é `*` e ninguém confere quem pediu.
  const blocked = await guardPanelRoute(
    { request, env, waitUntil: ctx.waitUntil.bind(ctx) },
    corsHeaders,
  )
  if (blocked) return blocked

  const anthropicKey = request.headers.get('X-Anthropic-Key') || env.ANTHROPIC_API_KEY
  const groqKey      = request.headers.get('X-Groq-Key')      || env.GROQ_API_KEY

  if (!anthropicKey && !groqKey) {
    return new Response(
      JSON.stringify({ error: { message: 'Nenhuma chave de IA configurada. Adicione sua chave Anthropic nas configurações da Scale AI.' } }),
      { status: 500, headers: corsHeaders }
    )
  }

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return new Response(JSON.stringify({ error: { message: 'JSON inválido' } }), { status: 400, headers: corsHeaders })
  }

  try {
    // Prefere Anthropic; cai no Groq se só tiver chave Groq
    const text = anthropicKey
      ? await callAnthropic(anthropicKey, body.system, body.messages)
      : await callGroq(groqKey!, body.system, body.messages)

    return new Response(
      JSON.stringify({ content: [{ text }] }),
      { headers: corsHeaders }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: { message: String(e) } }),
      { status: 502, headers: corsHeaders }
    )
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Anthropic-Key, X-Groq-Key',
    },
  })
}
