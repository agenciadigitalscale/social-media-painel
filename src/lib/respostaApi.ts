/**
 * Lê a resposta de uma rota /api/* sem engolir o motivo da falha.
 *
 * Quando o Worker cai, a Cloudflare devolve uma PÁGINA HTML ("Error 1101 —
 * Worker threw exception") e não JSON. Antes o painel mostrava só "Erro 500";
 * agora mostra o título da página, que diz qual foi o problema.
 */
export async function lerResposta<T>(r: Response): Promise<T & { ok: boolean; error?: string }> {
  const texto = await r.text().catch(() => '')
  try {
    return JSON.parse(texto) as T & { ok: boolean; error?: string }
  } catch {
    const titulo = texto.match(/<title>([^<]{1,120})<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim()
    const detalhe = titulo ? ` · ${titulo}` : texto.trim() ? ` · ${texto.trim().slice(0, 120)}` : ''
    return { ok: false, error: `Erro ${r.status}${detalhe}` } as T & { ok: boolean; error?: string }
  }
}
