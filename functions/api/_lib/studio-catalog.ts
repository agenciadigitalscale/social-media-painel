// Catálogo do Kaique Studio — o "outro lado" do canal de atualização.
//
// O Studio (app desktop Python) chama GET /api/studio-catalog e recebe um
// manifesto { packs: [...] } com os efeitos/presets/ícones novos. A equipe
// publica novidade gravando a chave `sm_studio_catalog` no app_data (pelo
// /api/sync, que preserva o `rev`) — sem redeploy do painel nem reinstalar o
// Studio. É isso que faz o editor ser "app sempre atualizado".
//
// Este módulo é a validação PURA (sem D1, sem Request) para poder ser testada
// sozinha. A regra espelha a `updates.parse_manifest` do Studio de propósito:
// o servidor nunca deve servir um pacote que o cliente vai recusar. A diferença
// é a postura — aqui um pacote torto é DESCARTADO, não faz o catálogo inteiro
// falhar: uma linha mal publicada não pode derrubar a atualização de todo mundo.

export const CATALOG_KEY = 'sm_studio_catalog'

const AUDIO = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac'])
const IMG = new Set(['.png', '.jpg', '.jpeg', '.webp'])
// Espelha library.EXTENSIONS do Studio. 'Presets' é à parte (não tem arquivo).
const EXTENSIONS: Record<string, Set<string>> = {
  'Memes': AUDIO, 'Efeitos sonoros': AUDIO, 'Músicas': AUDIO,
  'Ícones': IMG, 'Imagens': IMG, 'LUTs': new Set(['.cube']),
}

export interface Pack {
  id: string
  kind: string
  title: string
  category?: string
  ext?: string
  url?: string
  preset?: { name: string; style: Record<string, unknown> }
}

function validPreset(p: unknown): p is { name: string; style: Record<string, unknown> } {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  return typeof o.name === 'string' && o.name.trim().length > 0
    && !!o.style && typeof o.style === 'object' && Object.keys(o.style as object).length > 0
}

function okPack(raw: unknown): raw is Pack {
  if (!raw || typeof raw !== 'object') return false
  const p = raw as Record<string, unknown>
  if (typeof p.id !== 'string' || !p.id) return false
  if (typeof p.kind !== 'string' || !p.kind) return false
  if (typeof p.title !== 'string' || !p.title) return false
  if (p.kind === 'Presets') return validPreset(p.preset)
  const exts = EXTENSIONS[p.kind]
  if (!exts) return false
  if (typeof p.ext !== 'string' || !exts.has(p.ext.toLowerCase())) return false
  // Só http(s): um manifesto não pode mandar o app abrir file:// nem outro esquema.
  if (typeof p.url !== 'string' || !/^https?:\/\//i.test(p.url)) return false
  return true
}

/**
 * Devolve um manifesto sempre seguro: { packs: [...] }. Aceita a linha crua do
 * app_data (string JSON ou objeto já parseado); qualquer coisa fora do formato
 * vira `{ packs: [] }`, e pacotes inválidos individuais são descartados,
 * deduplicando por id (o primeiro vence).
 */
export function normalizeCatalog(raw: unknown): { packs: Pack[] } {
  let data = raw
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { return { packs: [] } }
  }
  if (!data || typeof data !== 'object' || !Array.isArray((data as { packs?: unknown }).packs)) {
    return { packs: [] }
  }
  const seen = new Set<string>()
  const packs: Pack[] = []
  for (const item of (data as { packs: unknown[] }).packs) {
    if (!okPack(item) || seen.has(item.id)) continue
    seen.add(item.id)
    packs.push(item)
  }
  return { packs }
}
