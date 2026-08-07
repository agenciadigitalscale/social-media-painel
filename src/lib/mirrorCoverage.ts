/**
 * Quantos criativos que estão com o cliente agora saem do NOSSO espelho.
 *
 * O espelho no R2 existe para duas coisas: tirar o Google do caminho de cada
 * exibição e — a que mais dói quando falha — fazer o link do cliente parar de
 * depender de o arquivo continuar na pasta Publicar. Enquanto um criativo não
 * está espelhado, mover ou apagar o vídeo no Drive mata o link sem aviso.
 *
 * Havia duas formas de espelhar (preguiçosa no `/api/stream`, e no envio pelo
 * `warmMirror`) e **nenhuma prova de que funcionam**. As três falhas possíveis
 * são todas silenciosas: arquivo acima do teto, quota do R2 estourada, ou o
 * `POST` do envio que não pegou. Este módulo é a prova.
 */

export interface CoverageFile {
  fileId: string
  itemId: number
  client: string
  filename: string
  bytes: number | null
  mirrored: boolean
  /** Acima do teto de 600 MB: nunca vai ser espelhado; insistir só gasta banda. */
  tooBig: boolean
}

export interface Coverage {
  ok: boolean
  /** `false` quando o balde nem está ligado no projeto. */
  configured: boolean
  total: number
  mirrored: number
  files: CoverageFile[]
  error?: string
}

export const EMPTY_COVERAGE: Coverage = {
  ok: false, configured: true, total: 0, mirrored: 0, files: [],
}

export function fmtBytes(n: number | null): string {
  if (!n) return '—'
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  const mb = n / (1024 * 1024)
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`
}

/**
 * O que ainda dá para consertar com um clique.
 *
 * Arquivo grande demais fica de fora de propósito: ele nunca vai passar, e
 * botá-lo na fila só faria o botão falhar toda vez e treinar a equipe a
 * ignorar o aviso.
 */
export function pendingFiles(cov: Coverage): CoverageFile[] {
  return cov.files.filter(f => !f.mirrored && !f.tooBig)
}

/** Os que não têm conserto por aqui — merecem ser ditos, não escondidos. */
export function hopelessFiles(cov: Coverage): CoverageFile[] {
  return cov.files.filter(f => !f.mirrored && f.tooBig)
}

export type CoverageTone = 'empty' | 'off' | 'full' | 'partial' | 'none'

/**
 * O tom da faixa. `empty` e `off` existem para não pintar de verde uma situação
 * que só não tem dado: "0 de 0 espelhados" não é sucesso, é silêncio.
 */
export function coverageTone(cov: Coverage): CoverageTone {
  if (!cov.configured) return 'off'
  if (cov.total === 0) return 'empty'
  if (cov.mirrored === cov.total) return 'full'
  if (cov.mirrored === 0) return 'none'
  return 'partial'
}

export async function fetchCoverage(): Promise<Coverage> {
  try {
    const res = await fetch('/api/mirror')
    if (!res.ok) throw new Error(`mirror ${res.status}`)
    const data = await res.json() as Partial<Coverage>
    return {
      ok: data.ok !== false,
      configured: data.configured !== false,
      total: data.total ?? 0,
      mirrored: data.mirrored ?? 0,
      files: Array.isArray(data.files) ? data.files : [],
      error: data.error,
    }
  } catch (e) {
    // Não conseguir PERGUNTAR não é o mesmo que "não está espelhado".
    return { ...EMPTY_COVERAGE, error: e instanceof Error ? e.message : 'falha ao consultar' }
  }
}

export interface MirrorRunResult {
  done: number
  failed: number
}

/**
 * Espelha os que faltam, um de cada vez.
 *
 * Em série de propósito: cada cópia arrasta ~91 MB do Drive para o R2 (mediana
 * medida em produção), e disparar quinze em paralelo estoura o subrequest do
 * Worker e a cota do Drive ao mesmo tempo — o resultado seria falhar todas em
 * vez de completar algumas.
 */
export async function mirrorPending(
  files: CoverageFile[],
  onProgress?: (done: number, total: number) => void,
): Promise<MirrorRunResult> {
  let done = 0
  let failed = 0

  for (const f of files) {
    try {
      const res = await fetch('/api/mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: f.fileId }),
      })
      const data = await res.json() as { ok?: boolean }
      if (res.ok && data.ok) done += 1
      else failed += 1
    } catch {
      failed += 1
    }
    onProgress?.(done + failed, files.length)
  }

  return { done, failed }
}
