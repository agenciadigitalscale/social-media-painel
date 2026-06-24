// ── Central de Assets do Editor ──────────────────────────────────────────────
// Biblioteca de LUTs, músicas, efeitos e transições que o editor joga no CapCut.
// Guarda só o metadado + link (o arquivo vive no Drive); persiste em localStorage
// e sincroniza via sm_assets. Reutilizável por cliente.
// ─────────────────────────────────────────────────────────────────────────────

import { syncToCloud } from './storage'

export type AssetKind = 'lut' | 'musica' | 'efeito' | 'sfx' | 'transicao' | 'outro'

export interface EditorAsset {
  id: string
  name: string
  kind: AssetKind
  url: string            // link do Drive ou externo
  clientName?: string    // opcional: asset específico de um cliente
  addedAt: number
  addedBy?: string       // key do NAME_MAP
}

export interface AssetKindMeta { key: AssetKind; label: string; emoji: string; color: string }

export const ASSET_KINDS: AssetKindMeta[] = [
  { key: 'lut',       label: 'LUTs',            emoji: '🎨', color: '#C084FC' },
  { key: 'musica',    label: 'Músicas',         emoji: '🎵', color: '#3B8EFF' },
  { key: 'efeito',    label: 'Efeitos',         emoji: '✨', color: '#FFD700' },
  { key: 'transicao', label: 'Transições',      emoji: '🎞️', color: '#00C47A' },
  { key: 'sfx',       label: 'Efeitos sonoros', emoji: '🔊', color: '#FF9A3D' },
  { key: 'outro',     label: 'Outros',          emoji: '📦', color: '#A1A1AA' },
]

export function kindMeta(kind: AssetKind): AssetKindMeta {
  return ASSET_KINDS.find(k => k.key === kind) ?? ASSET_KINDS[ASSET_KINDS.length - 1]
}

const KEY = 'sm_assets'

export function loadAssets(): EditorAsset[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function save(list: EditorAsset[]): void {
  localStorage.setItem(KEY, JSON.stringify(list))
  syncToCloud(KEY, list)
}

export function addAsset(a: Omit<EditorAsset, 'id' | 'addedAt'>): EditorAsset[] {
  const next = [{ ...a, id: crypto.randomUUID(), addedAt: Date.now() }, ...loadAssets()]
  save(next)
  return next
}

export function removeAsset(id: string): EditorAsset[] {
  const next = loadAssets().filter(a => a.id !== id)
  save(next)
  return next
}

// Abre o LegendaPro já com o contexto do vídeo (roteiro + cliente).
// O LegendaPro lê esses params no app.html — integração do lado de lá (projeto video-claude).
export function legendaProUrl(opts: { roteiro?: string; cliente?: string } = {}): string {
  const p = new URLSearchParams({ from: 'dshub' })
  if (opts.cliente) p.set('cliente', opts.cliente)
  if (opts.roteiro) p.set('roteiro', opts.roteiro.slice(0, 2000))
  return `https://legendapro.vercel.app/app.html?${p.toString()}`
}
