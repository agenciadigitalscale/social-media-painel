// ── IA contextual por cliente ──────────────────────────────
// Armazena o perfil estratégico de cada cliente para uso como
// contexto em prompts de IA (legendas, roteiros, ideias, CTAs).

export interface ClientContext {
  clientName: string
  // Identidade da marca
  tomVoz: string           // "profissional", "descontraído", "inspirador", "técnico"
  publico: string          // Descrição do público-alvo
  segmento: string         // "gastronomia", "beleza", "tech", etc.
  subnicho?: string        // Especificação: "pizzaria artesanal classe A"
  // Conteúdo
  estiloVisual: string     // "clean e minimalista", "vibrante e colorido", etc.
  ctas: string[]           // CTAs recorrentes: ["Reserve já", "Ligue agora", "Marque uma visita"]
  hashtags: string[]       // Hashtags estratégicas do cliente
  restricoes: string[]     // O que NÃO fazer: ["sem menção à concorrência", "sem preços"]
  // Estratégia
  frequenciaPost: number   // Posts por semana
  melhoresHorarios: string // "Seg–Sex 12h e 18h, Sáb 10h"
  objetivoMes: string      // "Aumentar seguidores 10%", "Gerar leads qualificados"
  // Observações livres
  observacoes: string
  // Meta
  updatedAt: number
}

// ── Storage ───────────────────────────────────────────────────

const STORAGE_KEY = 'sm_client_context'

function loadAll(): Record<string, ClientContext> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}

function saveAll(data: Record<string, ClientContext>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export const ClientContextStore = {
  get(clientName: string): ClientContext | null {
    return loadAll()[clientName] ?? null
  },

  save(ctx: ClientContext) {
    const all = loadAll()
    all[ctx.clientName] = { ...ctx, updatedAt: Date.now() }
    saveAll(all)
  },

  getAll(): Record<string, ClientContext> {
    return loadAll()
  },

  delete(clientName: string) {
    const all = loadAll()
    delete all[clientName]
    saveAll(all)
  },
}

// ── PromptBuilder ─────────────────────────────────────────────
// Monta o system prompt contextualizado por cliente para uso nas APIs de IA.

export function buildClientPrompt(
  ctx: ClientContext | null,
  task: 'legenda' | 'roteiro' | 'ideia' | 'hashtags' | 'cta' | 'geral',
): string {
  const base = ctx
    ? `Você é um especialista em marketing digital para ${ctx.clientName}.
Segmento: ${ctx.segmento}${ctx.subnicho ? ` (${ctx.subnicho})` : ''}.
Tom de voz: ${ctx.tomVoz}.
Público-alvo: ${ctx.publico}.
Estilo visual: ${ctx.estiloVisual}.
CTAs frequentes: ${ctx.ctas.join(', ') || 'nenhum definido'}.
Hashtags estratégicas: ${ctx.hashtags.slice(0, 10).join(' ') || 'nenhuma definida'}.
Restrições: ${ctx.restricoes.join('; ') || 'nenhuma'}.
${ctx.objetivoMes ? `Objetivo do mês: ${ctx.objetivoMes}.` : ''}
${ctx.observacoes ? `Observações importantes: ${ctx.observacoes}` : ''}`
    : 'Você é um especialista em marketing digital para agências de social media no Brasil.'

  const taskInstructions: Record<typeof task, string> = {
    legenda: 'Crie uma legenda envolvente para Instagram. Use emojis moderadamente. Termine com CTA e hashtags relevantes. Máximo 2200 caracteres.',
    roteiro: 'Crie um roteiro detalhado para Reel de 15-60 segundos. Inclua: gancho inicial (0-3s), desenvolvimento e CTA final. Formato: seções numeradas.',
    ideia:   'Sugira 3 ideias criativas de conteúdo para Instagram. Para cada uma: título, formato (Post/Reel/Story), conceito em 2 linhas, por que vai engajar.',
    hashtags: 'Sugira 25 hashtags estratégicas: 8 de nicho específico, 10 de nicho amplo, 7 de marca/local. Ordene por relevância.',
    cta:     'Crie 5 CTAs diferentes para essa marca. Variedade: urgência, curiosidade, benefício, prova social, exclusividade.',
    geral:   'Responda de forma direta e prática sobre marketing digital.',
  }

  return `${base}\n\n${taskInstructions[task]}\n\nResponda sempre em português brasileiro.`
}

// ── Valores padrão para novo contexto ─────────────────────────

export function defaultContext(clientName: string): ClientContext {
  return {
    clientName,
    tomVoz: 'profissional e acessível',
    publico: '',
    segmento: '',
    subnicho: '',
    estiloVisual: 'clean e moderno',
    ctas: [],
    hashtags: [],
    restricoes: [],
    frequenciaPost: 5,
    melhoresHorarios: 'Seg–Sex 12h e 18h',
    objetivoMes: '',
    observacoes: '',
    updatedAt: 0,
  }
}
