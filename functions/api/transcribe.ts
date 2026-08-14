// Transcrição de áudio: baixa o vídeo do Drive e manda pra OpenAI (Whisper).
// Chave via header X-OpenAI-Key (do localStorage do painel) ou env OPENAI_API_KEY.
// Limite da OpenAI: 25MB. Arquivos maiores são rejeitados com mensagem clara.

import { guardPanelRoute, type PanelGuardEnv } from './_lib/panel-guard'

interface Env extends PanelGuardEnv { OPENAI_API_KEY?: string }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

function err(message: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), { status, headers: cors })
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx

  const blocked = await guardPanelRoute({ request, env, waitUntil: ctx.waitUntil.bind(ctx) }, cors)
  if (blocked) return blocked

  const key = request.headers.get('X-OpenAI-Key') || env.OPENAI_API_KEY
  if (!key) return err('Sem chave OpenAI. Cole sua chave (sk-...) na transcrição.', 401)

  let body: { fileId?: string }
  try { body = await request.json() } catch { return err('JSON inválido') }
  const fileId = (body.fileId || '').replace(/[^a-zA-Z0-9_-]/g, '')
  if (!fileId) return err('Sem arquivo do Drive pra transcrever.')

  // ── Baixa do Drive ──
  let driveRes: Response
  try {
    driveRes = await fetch(`https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
      redirect: 'follow',
    })
  } catch (e) { return err('Falha ao baixar do Drive: ' + String(e), 502) }

  if (!driveRes.ok) return err(`Drive retornou ${driveRes.status}. O arquivo precisa estar público ("qualquer pessoa com o link").`, 502)

  const ct = driveRes.headers.get('Content-Type') ?? ''
  if (ct.includes('text/html')) return err('O Drive não liberou o arquivo (grande demais ou privado). Deixe público ou use um trecho menor.', 502)

  const cl = Number(driveRes.headers.get('Content-Length') || '0')
  if (cl && cl > 25 * 1024 * 1024) return err(`Arquivo de ${Math.round(cl / 1048576)}MB — o limite da transcrição é 25MB. Use um trecho ou só o áudio.`, 413)

  const buf = await driveRes.arrayBuffer()
  const sizeMb = buf.byteLength / 1048576
  if (sizeMb > 24.8) return err(`Arquivo de ${Math.round(sizeMb)}MB — o limite da transcrição é 25MB. Use um trecho ou só o áudio.`, 413)

  // ── Envia pra OpenAI ──
  const form = new FormData()
  form.append('file', new Blob([buf], { type: ct || 'video/mp4' }), 'video.mp4')
  form.append('model', 'whisper-1')
  form.append('language', 'pt')
  form.append('response_format', 'text')

  let oai: Response
  try {
    oai = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}` },
      body: form,
    })
  } catch (e) { return err('Falha ao falar com a OpenAI: ' + String(e), 502) }

  if (!oai.ok) {
    const t = await oai.text()
    return err(`OpenAI ${oai.status}: ${t.slice(0, 200)}`, 502)
  }

  const text = await oai.text()
  return new Response(JSON.stringify({ ok: true, text }), { headers: cors })
}

export const onRequestOptions: PagesFunction = async () => new Response(null, {
  status: 204,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-OpenAI-Key',
  },
})
