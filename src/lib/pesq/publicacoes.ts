/* lib/pesq/publicacoes.ts — Domínio da Central de Publicações PESQ.
   Modelo, máquina de status, matemática dos lembretes e persistência.
   Tudo aqui é puro ou toca só o armazenamento — a tela não decide regra.
*/

import { syncToCloud } from '../storage'
import { PESQ } from './brand'

// ── Chaves de persistência ────────────────────────────────────────────
export const PESQ_PUBS_KEY   = 'sm_pesq_publicacoes'
export const PESQ_CONFIG_KEY = 'sm_pesq_config'

// ── Tipos ─────────────────────────────────────────────────────────────
export type PesqFormato = 'Reels' | 'Carrossel' | 'Foto' | 'Stories'

export type PesqStatus =
  | 'aguardando'       // na fila, esperando o horário / a publicação manual
  | 'lembrete_enviado' // já cutucamos o responsável pelo menos uma vez
  | 'publicado'
  | 'pausado'          // fila suspensa de propósito (cliente pediu para segurar)
  | 'cancelado'
  | 'falha_whatsapp'   // a última tentativa de lembrete não saiu

export type PesqLembreteTipo = 'capa' | 'texto'

export interface PesqLembrete {
  ts: number
  tipo: PesqLembreteTipo
  ok: boolean
  /** Motivo, quando `ok: false` — aparece na tela, então é frase, não código. */
  erro?: string
}

export interface PesqEvento {
  ts: number
  /** Chave do NAME_MAP ou 'sistema' */
  autor: string
  acao: string
}

export interface PesqPublicacao {
  id: string
  codigo: string
  titulo: string
  formato: PesqFormato
  /** Data e horário combinados para a publicação ir ao ar (epoch ms) */
  agendadoPara: number
  driveLink?: string
  /** Miniatura já resolvida (o `/api/thumb` do painel, ou uma URL colada) */
  thumbUrl?: string
  /** Reels que precisa de finalização no Instagram Edits antes de subir */
  finalizarNoEdits: boolean
  status: PesqStatus
  /** Chave do NAME_MAP — quem publica de fato */
  responsavel: string
  intervaloMin: number
  lembretes: PesqLembrete[]
  historico: PesqEvento[]
  observacao?: string
  criadoEm: number
  atualizadoEm: number
  publicadoEm?: number
}

export interface PesqConfig {
  /** Telefone (só dígitos, com DDI) ou link de grupo do WhatsApp */
  destino: string
  /** Como chamar o destino na tela ("Arthur", "Grupo PESQ · Publicações") */
  nomeDestino: string
  intervaloMin: number
  responsavelPadrao: string
}

export const PESQ_CONFIG_PADRAO: PesqConfig = {
  destino: '',
  nomeDestino: 'Arthur',
  intervaloMin: 2,
  responsavelPadrao: 'arthur',
}

export const PESQ_FORMATOS: PesqFormato[] = ['Reels', 'Carrossel', 'Foto', 'Stories']

// ── Aparência de cada status ──────────────────────────────────────────
// `icone` e `label` acompanham a cor SEMPRE: quem não distingue as matizes
// (ou está no sol, ou imprime) continua lendo o estado.
export interface PesqStatusConfig {
  label: string
  curto: string
  cor: string
  icone: string
  /** A fila de lembretes anda neste estado? */
  ativo: boolean
}

export const PESQ_STATUS: Record<PesqStatus, PesqStatusConfig> = {
  aguardando:       { label: 'Aguardando publicação', curto: 'Aguardando', cor: PESQ.amber,    icone: '⏳', ativo: true  },
  lembrete_enviado: { label: 'Lembrete enviado',      curto: 'Lembrete',   cor: PESQ.teal,     icone: '🔔', ativo: true  },
  publicado:        { label: 'Publicado',             curto: 'Publicado',  cor: PESQ.greenLum, icone: '✅', ativo: false },
  pausado:          { label: 'Pausado',               curto: 'Pausado',    cor: PESQ.mute,     icone: '⏸️', ativo: false },
  cancelado:        { label: 'Cancelado',             curto: 'Cancelado',  cor: PESQ.ghost,    icone: '✖️', ativo: false },
  falha_whatsapp:   { label: 'Falha no WhatsApp',     curto: 'Falha',      cor: PESQ.danger,   icone: '⚠️', ativo: true  },
}

export const PESQ_STATUS_ORDEM: PesqStatus[] = [
  'falha_whatsapp', 'aguardando', 'lembrete_enviado', 'pausado', 'publicado', 'cancelado',
]

/**
 * O envio hoje é ASSISTIDO: o painel prepara a mensagem no horário certo e a
 * pessoa manda com um toque. Não existe provedor de API de WhatsApp neste
 * projeto — o `whatsapp.ts` do painel monta link `wa.me` e nada mais. Escrever
 * "conectado" numa integração que não existe seria a pior mentira possível
 * aqui: alguém confiaria que o lembrete saiu sozinho e a publicação não iria
 * ao ar. Quando existir endpoint de envio, entra o modo 'automatico'.
 */
export type PesqEnvioModo = 'assistido' | 'automatico'
export const PESQ_ENVIO_MODO: PesqEnvioModo = 'assistido'

export type PesqConexao = 'assistido' | 'sem_destino'

export function conexaoWhatsapp(config: PesqConfig): PesqConexao {
  return config.destino.trim() ? 'assistido' : 'sem_destino'
}

// ── Código da publicação ──────────────────────────────────────────────
// Base32 Crockford sem I, L, O e U — o mesmo alfabeto do selo de exportação
// do painel, para que ninguém precise decorar duas convenções.
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function codigoDe(n: number): string {
  let v = Math.abs(Math.trunc(n)) % (32 ** 4)
  let out = ''
  for (let i = 0; i < 4; i++) { out = ALFABETO[v % 32] + out; v = Math.floor(v / 32) }
  return `PESQ-${out}`
}

/** Código livre: começa no relógio e anda até não colidir com os existentes. */
export function novoCodigo(existentes: string[], semente = Date.now()): string {
  const usados = new Set(existentes)
  for (let i = 0; i < 1024; i++) {
    const c = codigoDe(semente + i)
    if (!usados.has(c)) return c
  }
  return codigoDe(semente)
}

// ── Criação ───────────────────────────────────────────────────────────
export interface NovaPublicacao {
  titulo: string
  formato: PesqFormato
  agendadoPara: number
  driveLink?: string
  thumbUrl?: string
  finalizarNoEdits?: boolean
  responsavel?: string
  intervaloMin?: number
  observacao?: string
}

export function criarPublicacao(
  input: NovaPublicacao,
  config: PesqConfig,
  existentes: PesqPublicacao[],
  autor: string,
  agora = Date.now(),
): PesqPublicacao {
  return {
    id: `pesq_${agora.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    codigo: novoCodigo(existentes.map(p => p.codigo), agora),
    titulo: input.titulo.trim(),
    formato: input.formato,
    agendadoPara: input.agendadoPara,
    driveLink: input.driveLink?.trim() || undefined,
    thumbUrl: input.thumbUrl?.trim() || undefined,
    finalizarNoEdits: input.finalizarNoEdits ?? input.formato === 'Reels',
    status: 'aguardando',
    responsavel: input.responsavel || config.responsavelPadrao,
    intervaloMin: input.intervaloMin ?? config.intervaloMin,
    lembretes: [],
    historico: [{ ts: agora, autor, acao: 'Publicação criada' }],
    observacao: input.observacao?.trim() || undefined,
    criadoEm: agora,
    atualizadoEm: agora,
  }
}

// ── Lembretes ─────────────────────────────────────────────────────────
/**
 * Quando cai o próximo lembrete — `null` quando a fila não anda (publicado,
 * pausado, cancelado).
 *
 * Antes do horário combinado o primeiro aviso é o próprio horário: cutucar
 * alguém às 9h por um conteúdo das 18h treina a pessoa a ignorar o lembrete.
 * Depois disso conta-se a partir da ÚLTIMA tentativa — inclusive a que
 * falhou, senão uma falha faria o relógio parar justo quando ele importa.
 */
export function proximoLembreteEm(pub: PesqPublicacao, agora = Date.now()): number | null {
  if (!PESQ_STATUS[pub.status].ativo) return null
  if (agora < pub.agendadoPara) return pub.agendadoPara
  const ultimo = pub.lembretes.length ? pub.lembretes[pub.lembretes.length - 1].ts : null
  if (ultimo === null) return pub.agendadoPara
  return ultimo + Math.max(1, pub.intervaloMin) * 60_000
}

export function lembreteVencido(pub: PesqPublicacao, agora = Date.now()): boolean {
  const t = proximoLembreteEm(pub, agora)
  return t !== null && t <= agora
}

/** O tipo do PRÓXIMO lembrete: capa só na estreia (ver `mensagens.ts`). */
export function tipoDoProximoLembrete(pub: PesqPublicacao): PesqLembreteTipo {
  return pub.lembretes.some(l => l.ok) ? 'texto' : 'capa'
}

export function lembretesEnviados(pub: PesqPublicacao): number {
  return pub.lembretes.filter(l => l.ok).length
}

export function ultimoLembrete(pub: PesqPublicacao): PesqLembrete | undefined {
  return [...pub.lembretes].reverse().find(l => l.ok)
}

/** Fila do painel de lembretes: vencidos primeiro, depois os mais próximos. */
export function filaDeLembretes(pubs: PesqPublicacao[], agora = Date.now()): PesqPublicacao[] {
  return pubs
    .filter(p => proximoLembreteEm(p, agora) !== null)
    .sort((a, b) => (proximoLembreteEm(a, agora) ?? 0) - (proximoLembreteEm(b, agora) ?? 0))
}

// ── Transições ────────────────────────────────────────────────────────
function tocar(pub: PesqPublicacao, autor: string, acao: string, agora: number): PesqPublicacao {
  return {
    ...pub,
    atualizadoEm: agora,
    historico: [...pub.historico, { ts: agora, autor, acao }].slice(-80),
  }
}

export function registrarLembrete(
  pub: PesqPublicacao,
  resultado: { ok: boolean; tipo: PesqLembreteTipo; erro?: string },
  autor: string,
  agora = Date.now(),
): PesqPublicacao {
  const lembrete: PesqLembrete = { ts: agora, tipo: resultado.tipo, ok: resultado.ok, erro: resultado.erro }
  // "aberto no WhatsApp" e não "entregue": o que o painel sabe é que a conversa
  // abriu com a mensagem pronta. Quem toca em enviar é a pessoa, e o registro
  // não pode afirmar mais do que ele viu acontecer.
  const base = tocar(pub, autor, resultado.ok
    ? `Lembrete ${resultado.tipo === 'capa' ? 'com capa' : 'de texto'} aberto no WhatsApp`
    : `Falha ao abrir o WhatsApp — ${resultado.erro ?? 'motivo desconhecido'}`, agora)
  return {
    ...base,
    lembretes: [...pub.lembretes, lembrete].slice(-60),
    status: resultado.ok ? 'lembrete_enviado' : 'falha_whatsapp',
  }
}

export function confirmarPublicacao(pub: PesqPublicacao, autor: string, agora = Date.now()): PesqPublicacao {
  return { ...tocar(pub, autor, 'Publicação confirmada', agora), status: 'publicado', publicadoEm: agora }
}

export function pausarPublicacao(pub: PesqPublicacao, autor: string, agora = Date.now()): PesqPublicacao {
  return { ...tocar(pub, autor, 'Fila de lembretes pausada', agora), status: 'pausado' }
}

/**
 * Retomar reconta a partir de AGORA em vez de disparar o atrasado na hora:
 * quem despausa acabou de olhar a fila, e uma enxurrada de lembretes
 * retroativos no primeiro segundo seria castigo, não aviso. O marco entra no
 * histórico como retomada — não como lembrete enviado, que seria mentira.
 */
export function retomarPublicacao(pub: PesqPublicacao, autor: string, agora = Date.now()): PesqPublicacao {
  const base = tocar(pub, autor, 'Fila de lembretes retomada', agora)
  return {
    ...base,
    status: pub.lembretes.some(l => l.ok) ? 'lembrete_enviado' : 'aguardando',
    agendadoPara: pub.agendadoPara > agora ? pub.agendadoPara : agora,
    lembretes: pub.lembretes.length
      ? pub.lembretes.map((l, i) => (i === pub.lembretes.length - 1 ? { ...l, ts: agora } : l))
      : pub.lembretes,
  }
}

export function cancelarPublicacao(pub: PesqPublicacao, autor: string, agora = Date.now()): PesqPublicacao {
  return { ...tocar(pub, autor, 'Publicação cancelada', agora), status: 'cancelado' }
}

export function reabrirPublicacao(pub: PesqPublicacao, autor: string, agora = Date.now()): PesqPublicacao {
  return { ...tocar(pub, autor, 'Publicação reaberta', agora), status: 'aguardando', publicadoEm: undefined }
}

export function editarPublicacao(
  pub: PesqPublicacao,
  patch: Partial<NovaPublicacao>,
  autor: string,
  agora = Date.now(),
): PesqPublicacao {
  const base = tocar(pub, autor, 'Dados da publicação editados', agora)
  return {
    ...base,
    titulo:           patch.titulo?.trim() ?? pub.titulo,
    formato:          patch.formato ?? pub.formato,
    agendadoPara:     patch.agendadoPara ?? pub.agendadoPara,
    driveLink:        patch.driveLink !== undefined ? (patch.driveLink.trim() || undefined) : pub.driveLink,
    thumbUrl:         patch.thumbUrl !== undefined ? (patch.thumbUrl.trim() || undefined) : pub.thumbUrl,
    finalizarNoEdits: patch.finalizarNoEdits ?? pub.finalizarNoEdits,
    responsavel:      patch.responsavel ?? pub.responsavel,
    intervaloMin:     patch.intervaloMin ?? pub.intervaloMin,
    observacao:       patch.observacao !== undefined ? (patch.observacao.trim() || undefined) : pub.observacao,
  }
}

// ── Indicadores ───────────────────────────────────────────────────────
export interface PesqResumo {
  aguardando: number
  publicadosHoje: number
  lembretesEnviados: number
  falhas: number
  proximo: { pub: PesqPublicacao; em: number } | null
  vencidos: number
}

export function resumo(pubs: PesqPublicacao[], agora = Date.now()): PesqResumo {
  const inicioDoDia = new Date(agora); inicioDoDia.setHours(0, 0, 0, 0)
  const fila = filaDeLembretes(pubs, agora)
  const proximoPub = fila[0]
  const em = proximoPub ? proximoLembreteEm(proximoPub, agora) : null
  return {
    aguardando: pubs.filter(p => PESQ_STATUS[p.status].ativo).length,
    publicadosHoje: pubs.filter(p => p.publicadoEm && p.publicadoEm >= inicioDoDia.getTime()).length,
    lembretesEnviados: pubs.reduce((n, p) => n + lembretesEnviados(p), 0),
    falhas: pubs.filter(p => p.status === 'falha_whatsapp').length,
    proximo: proximoPub && em !== null ? { pub: proximoPub, em } : null,
    vencidos: fila.filter(p => lembreteVencido(p, agora)).length,
  }
}

// ── Formatação ────────────────────────────────────────────────────────
/** Contagem regressiva curta: "agora", "0:42", "12:05", "3 h 20", "2 d 4 h" */
export function contagem(ms: number): string {
  if (ms <= 0) return 'agora'
  const s = Math.floor(ms / 1000)
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const h = Math.floor(s / 3600)
  if (h < 24) return `${h} h ${Math.floor((s % 3600) / 60)}`
  return `${Math.floor(h / 24)} d ${h % 24} h`
}

/** "agora mesmo", "há 3 min", "há 2 h", "há 4 d" — sem biblioteca de datas. */
export function desde(ts: number, agora = Date.now()): string {
  const s = Math.max(0, Math.floor((agora - ts) / 1000))
  if (s < 60)    return 'agora mesmo'
  if (s < 3600)  return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  return `há ${Math.floor(s / 86400)} d`
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export function quando(ts: number, agora = Date.now()): string {
  const d = new Date(ts)
  const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0)
  const dia = new Date(ts);     dia.setHours(0, 0, 0, 0)
  const delta = Math.round((dia.getTime() - hoje.getTime()) / 86_400_000)
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (delta === 0)  return `hoje, ${hora}`
  if (delta === 1)  return `amanhã, ${hora}`
  if (delta === -1) return `ontem, ${hora}`
  const data = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  return `${DIAS[d.getDay()]} ${data}, ${hora}`
}

/** `datetime-local` ↔ epoch sem escorregar de fuso (o `toISOString` escorrega) */
export function paraInputLocal(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function deInputLocal(valor: string): number | null {
  const t = new Date(valor).getTime()
  return Number.isFinite(t) ? t : null
}

// ── Persistência ──────────────────────────────────────────────────────
// localStorage-first + fila de sync, como todo o resto do painel.
export function carregarPublicacoes(): PesqPublicacao[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PESQ_PUBS_KEY) ?? '[]') as PesqPublicacao[]
    if (!Array.isArray(raw)) return []
    return raw.filter(p => p && typeof p.id === 'string').map(p => ({
      ...p,
      lembretes: Array.isArray(p.lembretes) ? p.lembretes : [],
      historico: Array.isArray(p.historico) ? p.historico : [],
      intervaloMin: Number.isFinite(p.intervaloMin) ? p.intervaloMin : PESQ_CONFIG_PADRAO.intervaloMin,
    }))
  } catch { return [] }
}

export function salvarPublicacoes(list: PesqPublicacao[]): void {
  localStorage.setItem(PESQ_PUBS_KEY, JSON.stringify(list))
  syncToCloud(PESQ_PUBS_KEY, list)
}

export function carregarConfig(): PesqConfig {
  try {
    const raw = JSON.parse(localStorage.getItem(PESQ_CONFIG_KEY) ?? 'null') as Partial<PesqConfig> | null
    return { ...PESQ_CONFIG_PADRAO, ...(raw ?? {}) }
  } catch { return { ...PESQ_CONFIG_PADRAO } }
}

export function salvarConfig(config: PesqConfig): void {
  localStorage.setItem(PESQ_CONFIG_KEY, JSON.stringify(config))
  syncToCloud(PESQ_CONFIG_KEY, config)
}
