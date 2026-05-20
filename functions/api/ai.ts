interface Env {
  GROQ_API_KEY: string
}

interface RequestBody {
  messages: { role: 'user' | 'assistant'; content: string }[]
  system: string
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  }

  // Chave pode vir do header (enviada pelo frontend) ou da env var do Cloudflare
  const apiKey = request.headers.get('X-Groq-Key') || env.GROQ_API_KEY

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: 'Chave Groq não configurada. Cole sua chave gratuita em console.groq.com nas configurações da Scale AI.' } }),
      { status: 500, headers: corsHeaders }
    )
  }

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return new Response(JSON.stringify({ error: { message: 'JSON inválido' } }), { status: 400, headers: corsHeaders })
  }

  const messages = [
    { role: 'system', content: body.system },
    ...body.messages.map(m => ({ role: m.role, content: m.content })),
  ]

  let response: Response
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 2048,
        temperature: 0.7,
      }),
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: 'Erro ao conectar com Groq: ' + String(e) } }), { status: 502, headers: corsHeaders })
  }

  const data = await response.json() as {
    choices?: { message: { content: string } }[]
    error?: { message: string }
  }

  if (data.error) {
    return new Response(JSON.stringify({ error: data.error }), { status: 500, headers: corsHeaders })
  }

  const text = data.choices?.[0]?.message?.content ?? 'Sem resposta'
  return new Response(
    JSON.stringify({ content: [{ text }] }),
    { headers: corsHeaders }
  )
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
