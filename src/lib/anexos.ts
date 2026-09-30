// ── Anexar arquivo direto no painel ("Criar publicação") ─────────────────
// O arquivo sobe em partes para o R2 (/api/midia): o Worker aceita no máximo
// ~100 MB por requisição, e um Reel passa disso fácil.

export interface Anexo {
  /** Chave no R2 (`anexos/<uuid>/<nome>`). */
  key: string
  /** Endereço público — é daqui que o Instagram e o Facebook buscam a mídia. */
  url: string
  nome: string
  tipo: string
}

/** Tipos que a Meta aceita publicar. */
export const TIPOS_ANEXO = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime']
const PARTE = 20 * 1024 * 1024

/** O navegador às vezes não informa o tipo de .mov — o nome decide. */
export function tipoDoArquivo(f: File): string {
  if (f.type) return f.type
  if (/\.mov$/i.test(f.name)) return 'video/quicktime'
  if (/\.mp4$/i.test(f.name)) return 'video/mp4'
  if (/\.jpe?g$/i.test(f.name)) return 'image/jpeg'
  if (/\.png$/i.test(f.name)) return 'image/png'
  return ''
}

async function ler<T>(r: Response): Promise<T & { ok: boolean; error?: string }> {
  return await r.json().catch(() => ({ ok: false, error: `Erro ${r.status}` })) as T & { ok: boolean; error?: string }
}

export async function enviarArquivo(arquivo: File, progresso: (fracao: number) => void): Promise<Anexo> {
  const tipo = tipoDoArquivo(arquivo)
  const ini = await ler<{ key: string; uploadId: string }>(await fetch('/api/midia', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'iniciar', nome: arquivo.name, tipo, tamanho: arquivo.size }),
  }))
  if (!ini.ok) throw new Error(ini.error ?? 'Não deu para começar o envio.')

  const partes: { n: number; etag: string }[] = []
  const total = Math.max(1, Math.ceil(arquivo.size / PARTE))
  for (let i = 0; i < total; i++) {
    const pedaco = arquivo.slice(i * PARTE, Math.min(arquivo.size, (i + 1) * PARTE))
    const q = new URLSearchParams({ action: 'parte', key: ini.key, uploadId: ini.uploadId, n: String(i + 1) })
    const r = await ler<{ n: number; etag: string }>(await fetch(`/api/midia?${q}`, { method: 'PUT', body: pedaco }))
    if (!r.ok) throw new Error(r.error ?? `Falhou a parte ${i + 1} de ${total}.`)
    partes.push({ n: r.n, etag: r.etag })
    progresso((i + 1) / total)
  }

  const fim = await ler<Anexo>(await fetch('/api/midia', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'concluir', key: ini.key, uploadId: ini.uploadId, partes }),
  }))
  if (!fim.ok) throw new Error(fim.error ?? 'Não deu para concluir o envio.')
  return { key: fim.key, url: fim.url, nome: fim.nome, tipo: fim.tipo }
}
