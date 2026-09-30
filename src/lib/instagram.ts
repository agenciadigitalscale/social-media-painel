// ── Publicação automática: Instagram e Página do Facebook do cliente ─────
// Quem publica é o SERVIDOR (cron → /api/instagram action 'run'), nunca a aba
// de alguém aberta: com várias pessoas logadas, publicar pelo navegador sairia
// em duplicidade. Aqui o painel só revisa, agenda, cancela e acompanha.

import { useEffect, useState } from 'react'
import type { ContaMeta } from './vinculoContas'
import type { Anexo } from './anexos'

const API = '/api/instagram'

export type Rede = 'instagram' | 'facebook'
export const REDES: Rede[] = ['instagram', 'facebook']
export const NOME_REDE: Record<Rede, string> = { instagram: 'Instagram', facebook: 'Facebook' }

/** `perfil` = @ do Instagram, `pagina` = nome da Página. Vazio = rede não conectada. */
export interface IgConta { clientName: string; perfil: string; pagina: string; desde: string }

export type IgSituacao = 'pending' | 'publishing' | 'published' | 'failed' | 'cancelled'

export interface IgAgendamento {
  itemId: number
  clientName: string
  quando: string
  tipo: string
  status: IgSituacao
  erro: string | null
  permalink: string | null
  rede: Rede
}

export type AgendamentosDoCard = Partial<Record<Rede, IgAgendamento>>

export interface IgStatus {
  carregado: boolean
  conectados: IgConta[]
  /** O agendamento mais recente de cada card, por rede. */
  porItem: Record<number, AgendamentosDoCard>
}

const VAZIO: IgStatus = { carregado: false, conectados: [], porItem: {} }

// Um poller só no app inteiro, com contagem de quem está olhando — o calendário
// e os cards assinam o mesmo estado sem multiplicar requisição.
let atual: IgStatus = VAZIO
let assinantes = 0
let timer: ReturnType<typeof setInterval> | null = null
const ouvintes = new Set<(s: IgStatus) => void>()

export async function recarregarIg(): Promise<void> {
  try {
    const r = await fetch(`${API}?action=status`)
    if (!r.ok) return
    const d = await r.json() as { ok: boolean; conectados?: IgConta[]; agendamentos?: IgAgendamento[] }
    if (!d.ok) return
    const porItem: Record<number, AgendamentosDoCard> = {}
    for (const a of d.agendamentos ?? []) (porItem[a.itemId] ??= {})[a.rede ?? 'instagram'] = a
    atual = { carregado: true, conectados: d.conectados ?? [], porItem }
    ouvintes.forEach(fn => fn(atual))
  } catch { /* offline: fica o último estado conhecido */ }
}

/** Estado da integração. `ativo = false` para quem não programa (não pergunta ao servidor). */
export function useIgStatus(ativo: boolean): IgStatus {
  const [s, setS] = useState<IgStatus>(atual)
  useEffect(() => {
    if (!ativo) return
    ouvintes.add(setS)
    assinantes++
    if (assinantes === 1) {
      recarregarIg()
      timer = setInterval(() => { if (!document.hidden) recarregarIg() }, 60_000)
    } else setS(atual)
    return () => {
      ouvintes.delete(setS)
      assinantes--
      if (assinantes === 0 && timer) { clearInterval(timer); timer = null }
    }
  }, [ativo])
  return s
}

// ── Prévia: o que sairia em cada rede ────────────────────────────────────

export interface PreviaRede {
  conectado: boolean
  /** @perfil ou nome da Página. */
  destino: string
  ok: boolean
  motivo?: string
  tipo?: string
  pecas?: number
}

export interface Previa {
  ok: boolean
  error?: string
  cliente: string
  tipo: string
  titulo: string
  legenda: string
  /** `url` preenchida = anexo do painel (a prévia sai dele, não do /api/thumb). */
  arquivos: { id: string; name: string; video: boolean; url?: string | null }[]
  motivoCriativo: string | null
  instagram: PreviaRede
  facebook: PreviaRede
}

/** `anexos` = mídia trocada na revisão, ainda não gravada no card. */
export async function previaPublicacao(itemId: number, anexos?: Anexo[]): Promise<Previa | { ok: false; error: string }> {
  try {
    const r = anexos?.length
      ? await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'previa', itemId, anexos }) })
      : await fetch(`${API}?action=previa&itemId=${itemId}`)
    const d = await r.json().catch(() => ({ ok: false, error: `Erro ${r.status}` }))
    return d as Previa
  } catch {
    return { ok: false, error: 'Sem conexão com o servidor.' }
  }
}

// ── Agendar, cancelar, conectar ──────────────────────────────────────────

export interface ResultadoRede { automatico: boolean; destino?: string; motivo?: string; tipo?: string; pecas?: number }
export interface ResultadoAgendamento { ok: boolean; error?: string; instagram?: ResultadoRede; facebook?: ResultadoRede }

export interface OpcoesPublicacao {
  redes: Rede[]
  legenda: string
  colaboradores: string[]
  /** Mídia trocada na revisão — manda sobre o criativo da esteira. */
  anexos?: Anexo[]
}

async function post<T>(body: Record<string, unknown>): Promise<T & { ok: boolean; error?: string }> {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json().catch(() => ({ ok: false, error: `Erro ${r.status}` }))
    return d as T & { ok: boolean; error?: string }
  } catch {
    return { ok: false, error: 'Sem conexão com o servidor.' } as T & { ok: boolean; error?: string }
  }
}

/** Agenda nas redes escolhidas. `redes: []` só cancela o que estava pendente. */
export async function agendarNoInstagram(itemId: number, quando: number, opcoes?: OpcoesPublicacao): Promise<ResultadoAgendamento> {
  const r = await post<ResultadoAgendamento>({ action: 'schedule', itemId, scheduledAt: quando, ...(opcoes ?? {}) })
  recarregarIg()
  return r
}

/** Muda só o horário do que já está agendado — mesmas redes, descrição e colab. */
export async function remarcarNoInstagram(itemId: number, quando: number): Promise<{ ok: boolean; movidos?: number; error?: string }> {
  const ags = Object.values(atual.porItem[itemId] ?? {})
  if (atual.carregado && !ags.some(a => a.status === 'pending')) return { ok: true, movidos: 0 }
  const r = await post<{ movidos?: number }>({ action: 'reschedule', itemId, scheduledAt: quando })
  recarregarIg()
  return r
}

export async function cancelarNoInstagram(itemId: number): Promise<void> {
  // Só incomoda o servidor quando existe algo a cancelar.
  const ags = Object.values(atual.porItem[itemId] ?? {})
  if (atual.carregado && !ags.some(a => a.status === 'pending' || a.status === 'failed')) return
  await post({ action: 'cancel', itemId })
  recarregarIg()
}

export async function conectarInstagram(clientName: string, accessToken: string, igUserId: string, fbPageId: string): Promise<{ ok: boolean; perfil?: string; pagina?: string; error?: string }> {
  const r = await post<{ perfil?: string; pagina?: string }>({ action: 'setup', clientName, accessToken, igUserId, fbPageId })
  recarregarIg()
  return r
}

/** Páginas (e o Instagram ligado a cada uma) que o token enxerga. */
export async function descobrirContas(accessToken: string): Promise<{ ok: boolean; contas?: ContaMeta[]; faltando?: string[]; error?: string }> {
  return post<{ contas?: ContaMeta[]; faltando?: string[] }>({ action: 'discover', accessToken })
}

export async function desconectarInstagram(clientName: string): Promise<{ ok: boolean; error?: string }> {
  const r = await post({ action: 'disconnect', clientName })
  recarregarIg()
  return r
}

/** "Reel", "carrossel de 4", "vídeo na Página" — para os avisos. */
export function descreverTipo(tipo?: string, pecas?: number): string {
  if (tipo === 'REELS') return 'Reel'
  if (tipo === 'STORIES') return 'story'
  if (tipo === 'CAROUSEL') return `carrossel de ${pecas ?? 0}`
  if (tipo === 'VIDEO') return 'vídeo'
  if (tipo === 'FOTOS') return `post com ${pecas ?? 0} fotos`
  return 'post'
}

// ── Compatibilidade: a aba Calendário antiga (5, oculta) ainda lê isto ─────
export interface IGSchedule { item_id: number; scheduled_at: string; status: string }

export async function fetchAllIGSchedules(): Promise<IGSchedule[]> {
  await recarregarIg()
  return Object.values(atual.porItem).flatMap(p => Object.values(p))
    .map(a => ({ item_id: a.itemId, scheduled_at: a.quando, status: a.status }))
}
