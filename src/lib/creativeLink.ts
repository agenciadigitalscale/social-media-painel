/* lib/creativeLink.ts — o que é o link que está no card.

   Existia uma cópia de `extractDriveFileId` no `CreativeViewer`, outra no
   `ReviewViewer` e uma terceira no `whatsapp.ts`, e as três só sabiam
   reconhecer link de ARQUIVO. Medido em produção (2026-08-31): **344 cards
   têm link de PASTA** do Drive — 61 já enviados ao cliente — porque carrossel
   é exatamente isso: uma pasta com várias imagens. Nenhum deles abria. Eram
   40 das 47 falhas registradas na semana, e a saída do cliente era pedir "manda
   de outro jeito" no WhatsApp.

   Aqui a classificação é uma só, e serve ao viewer do cliente, à revisão
   interna e à conferência de envio.
*/

import { checkFormat } from './exportWeight'

export type CreativeLinkKind =
  | 'file'        // arquivo único no Drive
  | 'folder'      // pasta do Drive — carrossel, ou o arquivo dentro dela
  | 'streamable'  // vídeo hospedado no Streamable
  | 'external'    // outro http(s) qualquer
  | 'none'        // vazio, ou texto que não é link

export interface CreativeLink {
  kind: CreativeLinkKind
  /** ID do Drive (arquivo ou pasta) ou do Streamable. */
  id?: string
  url: string
}

const RE_FILE      = /\/file\/d\/([a-zA-Z0-9_-]{10,})/
const RE_ID_PARAM  = /[?&]id=([a-zA-Z0-9_-]{10,})/
const RE_FOLDER    = /\/(?:drive\/)?(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]{10,})/
const RE_STREAMBLE = /streamable\.com\/(?:e\/)?([a-zA-Z0-9]+)/

export function classifyCreativeLink(link?: string | null): CreativeLink {
  const url = (link ?? '').trim()
  if (!url) return { kind: 'none', url: '' }

  // Pasta antes de arquivo: `/drive/folders/ID` não casa com as regras de
  // arquivo, mas a ordem deixa a intenção explícita para quem mexer depois.
  const folder = url.match(RE_FOLDER)
  if (folder) return { kind: 'folder', id: folder[1], url }

  const streamable = url.match(RE_STREAMBLE)
  if (streamable) return { kind: 'streamable', id: streamable[1], url }

  const file = url.match(RE_FILE) ?? url.match(RE_ID_PARAM)
  if (file) return { kind: 'file', id: file[1], url }

  if (/^https?:\/\//i.test(url)) return { kind: 'external', url }
  return { kind: 'none', url }
}

/** Compatibilidade com quem só precisa do arquivo (mantém o comportamento antigo). */
export function driveFileId(link?: string | null): string | null {
  const c = classifyCreativeLink(link)
  return c.kind === 'file' ? c.id ?? null : null
}

export function driveFolderId(link?: string | null): string | null {
  const c = classifyCreativeLink(link)
  return c.kind === 'folder' ? c.id ?? null : null
}

// ── Ordem dos arquivos do carrossel ───────────────────────────────────
/**
 * Ordem natural: `_2` antes de `_10`.
 *
 * A ordem importa de verdade aqui — carrossel tem primeira, segunda e terceira
 * lâmina, e o cliente aprova a sequência. Comparação alfabética simples põe
 * `Carrosel_10.jpg` antes de `Carrosel_2.jpg` e a leitura sai trocada.
 */
export function naturalCompare(a: string, b: string): number {
  const pa = a.toLowerCase().match(/(\d+|\D+)/g) ?? []
  const pb = b.toLowerCase().match(/(\d+|\D+)/g) ?? []
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i], y = pb[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y)
    if (nx && ny) {
      const d = Number(x) - Number(y)
      if (d !== 0) return d
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return 0
}

export interface CreativeFile {
  id: string
  name: string
  mimeType: string
}

/**
 * "Não abre em navegador" tem uma definição só no projeto, e é a do
 * `checkFormat`: `.psd`, `.ai`, `.tiff`, `.prproj` e afins. Duplicar a lista
 * aqui faria a tela do cliente e o aviso de envio discordarem sobre o mesmo
 * arquivo — e o Drive reporta Photoshop como `image/vnd.adobe.photoshop`, que
 * passaria por qualquer teste ingênuo de `image/`.
 */
function abreNoNavegador(f: { mimeType?: string; name?: string }): boolean {
  return checkFormat(f.mimeType, f.name)?.level !== 'unplayable'
}

export function isImageFile(f: { mimeType?: string; name?: string }): boolean {
  if (!abreNoNavegador(f)) return false
  if (f.mimeType?.startsWith('image/')) return true
  return !f.mimeType && /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(f.name ?? '')
}

export function isVideoFile(f: { mimeType?: string; name?: string }): boolean {
  if (!abreNoNavegador(f)) return false
  if (f.mimeType?.startsWith('video/')) return true
  return !f.mimeType && /\.(mp4|mov|m4v|webm|avi)$/i.test(f.name ?? '')
}

/**
 * O que a pasta entrega para a tela: mídia visível, em ordem de leitura.
 *
 * Some com o que não é criativo (a pasta costuma ter `.psd`, legenda em `.txt`,
 * subpasta de "postados") — mostrar isso para o cliente seria expor o
 * bastidor da agência, e um `.psd` não abre em navegador nenhum.
 */
export function creativeFilesOf(files: CreativeFile[], limite = 30): CreativeFile[] {
  return files
    .filter(f => isImageFile(f) || isVideoFile(f))
    .sort((a, b) => naturalCompare(a.name, b.name))
    .slice(0, limite)
}
