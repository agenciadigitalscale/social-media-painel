interface Env {
  GEMINI_API_KEY: string
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

  if (!env.GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: { message: 'GEMINI_API_KEY não configurada no Cloudflare' } }),
      { status: 500, headers: corsHeaders }
    )
  }

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return new Response(JSON.stringify({ error: { message: 'JSON inválido' } }), { status: 400, headers: corsHeaders })
  }

  // Converte histórico para formato Gemini
  const contents = body.messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: body.system }] },
        contents,
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      }),
    }
  )

  const data = await response.json() as {
    candidates?: { content: { parts: { text: string }[] } }[]
    error?: { message: string }
  }

  if (data.error) {
    return new Response(JSON.stringify({ error: data.error }), { status: 500, headers: corsHeaders })
  }

  // Retorna no mesmo formato que o frontend espera
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sem resposta'
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
