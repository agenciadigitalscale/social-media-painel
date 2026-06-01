// ── DS Agency — Agent definitions ────────────────────────────────────────────
// 4 specialized agents + orchestrator types.

export interface AgentContext {
  clients: string[]
  totalItems: number
  published: number
  pending: number
  late: number
  today: string
  currentUser: string
}

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

export interface QuickAction {
  label: string
  icon: string
  prompt: string
}

export interface SkillField {
  key: string
  label: string
  placeholder: string
  multiline?: boolean
  rows?: number
}

export interface AgentSkill {
  name: string
  icon: string
  badge: string
  description: string
  tip: string
  fields: SkillField[]
  buildPrompt: (inputs: Record<string, string>, ctx: AgentContext) => string
}

export interface DSAgent {
  id: 'copy' | 'design' | 'editor' | 'strategy'
  name: string
  role: string
  emoji: string
  color: string
  glow: string
  description: string
  capabilities: string[]
  quickActions: QuickAction[]
  skill: AgentSkill
  storageKey: string
  buildSystemPrompt: (ctx: AgentContext) => string
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export interface CampaignBrief {
  cliente: string
  tema: string
  objetivo: string
  formato: string
  tom: string
}

export interface OrchestratorStep {
  agentId: DSAgent['id']
  label: string
  emoji: string
  color: string
  output: string
  status: 'idle' | 'running' | 'done' | 'error'
}

// ── Helper: call /api/ai ──────────────────────────────────────────────────────

export async function callAgentAI(
  system: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  groqKey?: string,
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (groqKey) headers['X-Groq-Key'] = groqKey

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers,
    body: JSON.stringify({ system, messages }),
  })
  const data = await res.json() as {
    content?: { text: string }[]
    error?: { message: string }
  }
  if (data.error) throw new Error(data.error.message)
  return data.content?.[0]?.text ?? 'Sem resposta.'
}

// ── Agent definitions ─────────────────────────────────────────────────────────

export const AGENTS: DSAgent[] = [
  {
    id: 'copy',
    name: 'Kerges Bot',
    role: 'Copywriter & Copy',
    emoji: '✍️',
    color: '#FB7185',
    glow: 'rgba(251,113,133,0.35)',
    description: 'Legendas, roteiros, CTAs, anúncios e e-mails prontos para usar',
    capabilities: ['Legendas Instagram', 'Roteiros de Reels', 'Meta Ads', 'CTAs e hooks', 'WhatsApp copy'],
    storageKey: 'sm_agent_copy_msgs',

    skill: {
      name: 'Clonagem de Voz',
      icon: '🎙️',
      badge: 'Clone de Voz',
      description: 'Analisa o padrão de linguagem do cliente e gera novos conteúdos indistinguíveis do original',
      tip: 'Cole 3-5 legendas publicadas → o agente aprende o estilo e cria novos conteúdos idênticos em tom',
      fields: [
        { key: 'cliente', label: 'Cliente', placeholder: 'Ex: Burger Prime, Studio Fit...' },
        {
          key: 'legendas', label: 'Legendas publicadas (cole 3-5)',
          placeholder: 'Cole aqui as últimas legendas aprovadas e publicadas deste cliente, separadas por ---',
          multiline: true, rows: 7,
        },
        { key: 'novo_tema', label: 'Novo tema para criar', placeholder: 'Ex: promoção de final de semana, lançamento de prato...' },
        { key: 'formato', label: 'Formato', placeholder: 'Post, Reel, Story, Carrossel' },
      ],
      buildPrompt: (v) => `Você é um especialista em clonagem de identidade verbal para social media.

MISSÃO: Analisar o estilo de escrita do cliente "${v.cliente}" e criar novos conteúdos indistinguíveis dos originais.

LEGENDAS REAIS PUBLICADAS:
---
${v.legendas || '(nenhuma fornecida — faça o melhor com as informações disponíveis)'}
---

ANÁLISE DETALHADA OBRIGATÓRIA:
1. Tom de voz: formal/informal/brincalhão/íntimo/urgente
2. Emojis: quais usa, com que frequência, em que posição (início/meio/fim)
3. Estrutura típica: como abre, como desenvolve, como fecha, padrão de CTA
4. Hashtags: quantidade média, tipo (nicho/local/trending), posição no texto
5. Comprimento: curto (<100 chars) / médio (100-300) / longo (300+)
6. Palavras-chave recorrentes e frases características

DEPOIS DA ANÁLISE, crie 3 novas legendas para "${v.formato || 'Post'}" sobre: "${v.novo_tema}"
Cada legenda deve ser IDÊNTICA ao padrão identificado — quem leu os originais não deve perceber diferença.

FORMATO DE SAÍDA:
## 🔍 Análise de Voz — ${v.cliente}
[análise dos 6 pontos acima, 2-3 linhas cada]

## ✍️ Legenda 1
[legenda completa, pronta para publicar]

## ✍️ Legenda 2
[legenda completa, pronta para publicar]

## ✍️ Legenda 3
[legenda completa, pronta para publicar]`,
    },

    quickActions: [
      { label: 'Legenda Reel', icon: '🎬', prompt: 'Crie uma legenda para Reel do cliente [CLIENTE] sobre [TEMA]. Tom: descontraído. Emojis + CTA + 8 hashtags.' },
      { label: 'Roteiro 30s', icon: '📝', prompt: 'Roteiro de Reel 30s para [CLIENTE] sobre [TEMA]. Formato: Gancho 3s → Desenvolvimento → CTA.' },
      { label: 'Anúncio Meta', icon: '📣', prompt: 'Anúncio Meta Ads para [CLIENTE]. Objetivo: [OBJETIVO]. Headline + texto principal (3 parágrafos) + CTA.' },
      { label: '5 CTAs', icon: '🎯', prompt: 'Crie 5 CTAs criativos para [CLIENTE]: urgência, benefício, curiosidade, social proof e exclusividade.' },
      { label: 'Story copy', icon: '⭐', prompt: 'Crie 3 frames de Story para [CLIENTE] sobre [TEMA]. Cada frame: texto curto + emoji + ideia visual.' },
      { label: 'WA cliente', icon: '💬', prompt: 'Mensagem WhatsApp para [CLIENTE] avisando que o conteúdo da semana está pronto para aprovação. Tom profissional.' },
    ],

    buildSystemPrompt: (ctx) => `Você é Kerges Bot, especialista em copywriting da Digital Scale.

HOJE: ${ctx.today}${ctx.currentUser ? ` | USUÁRIO: ${ctx.currentUser}` : ''}
CLIENTES: ${ctx.clients.join(', ')}
MÊS: ${ctx.published} publicados · ${ctx.pending} pendentes · ${ctx.late} atrasados

ENTREGAS:
• Legendas Instagram com emojis, CTA e hashtags (até 30)
• Roteiros de Reels: gancho 3s → desenvolvimento → CTA
• Meta Ads: headline + texto principal + CTA
• CTAs em lote (5 variações por pedido)
• WhatsApp / e-mail para clientes

REGRAS: Entregue PRONTO para copiar. Sem introduções. Se não souber o cliente, pergunte. Português do Brasil.`,
  },

  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'design',
    name: 'Jhones Bot',
    role: 'Diretor de Arte',
    emoji: '🎨',
    color: '#C084FC',
    glow: 'rgba(192,132,252,0.35)',
    description: 'Briefings visuais, prompts de IA generativa, paletas e conceitos criativos',
    capabilities: ['Briefings visuais', 'Prompts Midjourney', 'Paletas HEX', 'Conceitos criativos', 'Kit de feed'],
    storageKey: 'sm_agent_design_msgs',

    skill: {
      name: 'Kit Visual Completo',
      icon: '📖',
      badge: 'Brand Book',
      description: 'Gera um guia visual executável completo para o cliente em menos de 1 minuto',
      tip: 'Informe cliente + nicho + 3 palavras → receba: paleta HEX, tipografia, estética de feed, prompt Midjourney padrão e plano de 4 semanas',
      fields: [
        { key: 'cliente', label: 'Cliente', placeholder: 'Ex: Studio Fit, Bella Estética...' },
        { key: 'nicho', label: 'Nicho / setor', placeholder: 'Ex: academia fitness, clínica estética, restaurante...' },
        { key: 'palavras', label: '3 palavras que definem a marca', placeholder: 'Ex: moderna, acolhedora, premium' },
        { key: 'cores', label: 'Cores já usadas (opcional)', placeholder: 'Ex: azul e branco, ou "sem identidade ainda"' },
        { key: 'publico', label: 'Público-alvo', placeholder: 'Ex: mulheres 25-40, classe B/C, São Paulo' },
      ],
      buildPrompt: (v) => `Você é Jhones Bot, diretor de arte sênior. Crie um Kit Visual Completo profissional para o cliente abaixo.

CLIENTE: ${v.cliente}
NICHO: ${v.nicho}
PALAVRAS DA MARCA: ${v.palavras}
CORES EXISTENTES: ${v.cores || 'sem identidade definida — crie do zero'}
PÚBLICO-ALVO: ${v.publico || 'não informado'}

ENTREGUE EXATAMENTE NESTE FORMATO:

## 🎨 Kit Visual — ${v.cliente}

### 🖌️ Paleta de Cores (5 cores)
| Nome | HEX | Uso |
|---|---|---|
[tabela com: cor principal, secundária, acento, neutra clara, neutra escura]
Justificativa psicológica de cada escolha.

### 🔤 Tipografia
**Display (títulos):** [nome da fonte] — por quê funciona
**Body (textos):** [nome da fonte] — por quê funciona
Sizes recomendados: H1 / H2 / body / caption

### 📱 Estética do Feed Instagram
**Temperatura:** quente / fria / neutra
**Estilo fotográfico:** [descrição em 2 linhas]
**Composição:** [regras de composição]
**Filtro/edição:** [instruções de edição — ex: +10 exposição, -15 saturação, +5 textura]
**O que NUNCA fazer:** [3 proibições visuais]

### 🖼️ Prompt Midjourney Padrão
\`\`\`
[prompt completo em inglês para gerar imagens no estilo da marca, com parâmetros --ar, --style, --v]
\`\`\`

### 📅 Plano de Conteúdo Visual — 4 Semanas
**Semana 1:** [tema + conceito visual]
**Semana 2:** [tema + conceito visual]
**Semana 3:** [tema + conceito visual]
**Semana 4:** [tema + conceito visual]

### 💡 Mood em 10 palavras
[10 palavras separadas por · que capturam a essência visual]`,
    },

    quickActions: [
      { label: 'Briefing visual', icon: '📋', prompt: 'Briefing visual completo para [CLIENTE] sobre [TEMA]: objetivo, referências, paleta, tipografia e mood.' },
      { label: 'Prompt Midjourney', icon: '🖼️', prompt: 'Prompt detalhado Midjourney para [TEMA] de [CLIENTE]. Estilo: [ESTILO]. Inclua parâmetros técnicos.' },
      { label: 'Paleta de cores', icon: '🎨', prompt: 'Paleta de cores para [CLIENTE] do nicho [NICHO]. Inclua: códigos HEX, quando usar e psicologia.' },
      { label: 'Conceito Story', icon: '⭐', prompt: 'Conceito criativo para série de 5 Stories de [CLIENTE] sobre [TEMA]. Descreva cada frame.' },
      { label: 'Layout Carrossel', icon: '🗂️', prompt: 'Layout de Carrossel 7 slides para [CLIENTE] sobre [TEMA]. Slide a slide: visual + texto + CTA final.' },
      { label: 'Referências', icon: '🔍', prompt: 'Sugira 5 referências visuais para [CLIENTE] melhorar o feed. O que copiar de cada uma.' },
    ],

    buildSystemPrompt: (ctx) => `Você é Jhones Bot, diretor de arte da Digital Scale.

HOJE: ${ctx.today} | CLIENTES: ${ctx.clients.join(', ')}

ENTREGAS:
• Briefings visuais: objetivo + referências + paleta + tipografia + mood
• Prompts para Midjourney / Firefly / DALL-E (com parâmetros técnicos)
• Paletas HEX com justificativa psicológica
• Conceitos criativos para séries de conteúdo
• Layout descrito slide a slide

REGRAS: Específico e técnico. Referências concretas. Português do Brasil.`,
  },

  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'editor',
    name: 'Kaique Bot',
    role: 'Editor de Vídeo',
    emoji: '🎬',
    color: '#ff9039',
    glow: 'rgba(255,144,57,0.35)',
    description: 'Roteiros de corte, specs CapCut, legendas SRT e ganchos de abertura',
    capabilities: ['Roteiros de corte', 'Legendas SRT', 'Specs CapCut', 'Ganchos 3s', 'Plano de gravação'],
    storageKey: 'sm_agent_editor_msgs',

    skill: {
      name: 'Plano de Gravação',
      icon: '🎞️',
      badge: 'Breakdown',
      description: 'Transforma um roteiro em um plano completo de produção, takes e pós-produção',
      tip: 'Cole o roteiro → receba: estimativa de duração, lista de takes com timecodes, B-roll, instruções de gravação e checklist de edição',
      fields: [
        { key: 'cliente', label: 'Cliente', placeholder: 'Ex: Burger Prime' },
        { key: 'formato', label: 'Formato e duração', placeholder: 'Ex: Reel 30s, Reel 60s, Vídeo feed 60s' },
        {
          key: 'roteiro', label: 'Roteiro completo (cole aqui)',
          placeholder: 'Cole o roteiro fala a fala, com indicações de texto na tela, ações e transições...',
          multiline: true, rows: 8,
        },
        { key: 'local', label: 'Local de gravação (opcional)', placeholder: 'Ex: cozinha do restaurante, academia, estúdio' },
      ],
      buildPrompt: (v) => `Você é Kaique Bot, editor de vídeo sênior. Faça o breakdown completo de produção para o roteiro abaixo.

CLIENTE: ${v.cliente}
FORMATO: ${v.formato}
LOCAL: ${v.local || 'não especificado'}

ROTEIRO:
---
${v.roteiro || '(roteiro não fornecido — analise com base nas informações disponíveis)'}
---

ENTREGUE EXATAMENTE NESTE FORMATO:

## 🎬 Breakdown de Produção — ${v.cliente}

### ⏱️ Estimativa de Duração
**Total:** X segundos | **Formato ideal:** ${v.formato}
**Margem de corte:** X segundos de material bruto recomendado

### 🎥 Lista de Takes
| # | Timecode | Descrição | Duração | Texto na Tela | Transição |
|---|---|---|---|---|---|
[tabela completa, take por take]

### 🎞️ B-Roll Necessário
[lista numerada de cenas de apoio / cutaways necessários para cobrir cortes]

### 📱 Textos na Tela (Motion Graphics)
[lista de todos os textos que precisam aparecer, com sugestão de timing e estilo]

### 🎙️ Instruções de Gravação
**Câmera:** [enquadramento, movimento, distância focal sugerida]
**Iluminação:** [setup simples com equipamento acessível]
**Áudio:** [microfone, distância, ambiente]
**Figurino/Cenário:** [o que preparar]
**Dicas de performance:** [orientações para quem vai gravar]

### ✂️ Checklist de Edição
- [ ] Cortar takes ruins — manter apenas: [critérios]
- [ ] Sincronizar áudio com: [instruções]
- [ ] Texto na tela com fonte: [sugestão] tamanho: [sugestão]
- [ ] Música de fundo: [sugestão de gênero + como encontrar]
- [ ] Efeitos de som: [onde aplicar]
- [ ] Exportar: 1080×1920 · 30fps · H.264 · sem barras pretas`,
    },

    quickActions: [
      { label: 'Roteiro corte', icon: '✂️', prompt: 'Roteiro de corte para Reel de [CLIENTE] sobre [TEMA]. Duração: [DURAÇÃO]. Timecode → corte → texto → transição.' },
      { label: 'Gancho abertura', icon: '⚡', prompt: '5 opções de gancho de abertura (3 segundos) para Reel de [CLIENTE] sobre [TEMA]. Texto na tela + ação visual.' },
      { label: 'Legenda SRT', icon: '📄', prompt: 'Gere um SRT para Reel 30s de [CLIENTE] com o texto: [TEXTO]. Formato: 00:00:00,000 → 00:00:00,000' },
      { label: 'Specs CapCut', icon: '📱', prompt: 'Configurações ideais no CapCut para [TIPO DE VÍDEO] no Instagram: resolução, fps, codec e exportação.' },
      { label: 'Thumbnail', icon: '🖼️', prompt: 'Conceito de thumbnail para Reel de [CLIENTE] sobre [TEMA]: composição, texto (máx 6 palavras), cores e ação.' },
      { label: 'Trilha sonora', icon: '🎵', prompt: '5 músicas do Instagram/TikTok para vídeo de [CLIENTE] sobre [TEMA]. Por que cada uma funciona + onde encontrar.' },
    ],

    buildSystemPrompt: (ctx) => `Você é Kaique Bot, especialista em edição de vídeo da Digital Scale.

HOJE: ${ctx.today} | CLIENTES: ${ctx.clients.join(', ')}
FILA: ${ctx.totalItems} conteúdos · ${ctx.pending} pendentes de edição

SPECS PADRÃO:
• Reel/Story/TikTok: 1080×1920 (9:16) · 30fps · H.264 · até 90s
• Post/Carrossel: 1080×1080 (1:1) ou 1080×1350 (4:5)
• Feed vídeo: 1080×1080 · máx 60s
• Thumbnail Reel: captura entre 0:02–0:05

ENTREGAS: roteiros de corte · ganchos 3s · SRT · specs CapCut · planos de gravação

REGRAS: Técnico e preciso. Timecodes reais. Mobile-first (90% do consumo). Português do Brasil.`,
  },

  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'strategy',
    name: 'Pradox Bot',
    role: 'Estrategista Digital',
    emoji: '👑',
    color: '#FFD700',
    glow: 'rgba(255,215,0,0.35)',
    description: 'Calendários de conteúdo, análises estratégicas e relatórios executivos',
    capabilities: ['Calendários mensais', 'Análise de performance', 'Estratégia por cliente', 'Relatórios', 'Diagnóstico gaps'],
    storageKey: 'sm_agent_strategy_msgs',

    skill: {
      name: 'Diagnóstico 7 Dias',
      icon: '🔬',
      badge: 'Diagnóstico Real',
      description: 'Análise estratégica profunda com plano de ação dia a dia para os próximos 7 dias',
      tip: 'Informe o cliente + contexto atual → receba diagnóstico situacional + plano de ação 7 dias com tarefas específicas por dia',
      fields: [
        { key: 'cliente', label: 'Cliente para diagnosticar', placeholder: 'Ex: Burger Prime, ou "todos os clientes"' },
        { key: 'publicados', label: 'Conteúdos publicados este mês', placeholder: 'Ex: 8 de 20 previstos' },
        { key: 'atrasados', label: 'Conteúdos em atraso', placeholder: 'Ex: 3 reels e 2 posts atrasados' },
        { key: 'problemas', label: 'Principais problemas / gargalos atuais', placeholder: 'Ex: cliente não aprova, roteiros atrasados, editor sem material...', multiline: true, rows: 3 },
        { key: 'objetivo', label: 'Objetivo principal do cliente', placeholder: 'Ex: crescer seguidores, aumentar vendas, melhorar engajamento' },
      ],
      buildPrompt: (v, ctx) => `Você é Pradox Bot, estrategista sênior da Digital Scale. Faça um diagnóstico estratégico profundo.

CONTEXTO GERAL DA AGÊNCIA — ${ctx.today}:
• Total de clientes: ${ctx.clients.length} (${ctx.clients.join(', ')})
• Mês atual: ${ctx.published} publicados · ${ctx.pending} pendentes · ${ctx.late} em atraso

DIAGNÓSTICO ESPECÍFICO — ${v.cliente}:
• Publicados este mês: ${v.publicados || 'não informado'}
• Em atraso: ${v.atrasados || 'não informado'}
• Problemas reportados: ${v.problemas || 'nenhum reportado'}
• Objetivo do cliente: ${v.objetivo || 'não informado'}

ENTREGUE EXATAMENTE NESTE FORMATO:

## 🔬 Diagnóstico Estratégico — ${v.cliente}

### 📊 Situação Atual (semáforo)
🔴 **Crítico:** [o que está em crise agora]
🟡 **Atenção:** [o que está em risco]
🟢 **OK:** [o que está funcionando]

### 🎯 Diagnóstico Principal
[2-3 parágrafos de análise honesta e direta da situação. Identifique a causa raiz dos problemas, não apenas os sintomas.]

### 📅 Plano de Ação — 7 dias
**Segunda-feira:** [tarefa específica + quem faz + resultado esperado]
**Terça-feira:** [tarefa específica + quem faz + resultado esperado]
**Quarta-feira:** [tarefa específica + quem faz + resultado esperado]
**Quinta-feira:** [tarefa específica + quem faz + resultado esperado]
**Sexta-feira:** [tarefa específica + quem faz + resultado esperado]
**Sábado:** [tarefa específica ou folga estratégica]
**Domingo:** [tarefa específica ou folga estratégica]

### ⚡ Ações Imediatas (faça hoje)
1. [ação concreta com prazo de horas]
2. [ação concreta com prazo de horas]
3. [ação concreta com prazo de horas]

### 📈 Métrica de Sucesso
Se o plano for executado, em 7 dias: [o que deve ter mudado, em números ou fatos concretos]`,
    },

    quickActions: [
      { label: 'Calendário mensal', icon: '📅', prompt: 'Calendário de conteúdo para [CLIENTE] no próximo mês. Mix Posts/Reels/Stories, temas por semana e datas estratégicas.' },
      { label: 'Análise cliente', icon: '📊', prompt: 'Análise estratégica de [CLIENTE]: pontos fortes, gaps, oportunidades e 3 ações prioritárias para o próximo mês.' },
      { label: 'Estratégia Reels', icon: '🎬', prompt: 'Estratégia de Reels para [CLIENTE] do nicho [NICHO]: frequência, temas evergreen, ganchos e métricas.' },
      { label: 'Relatório executivo', icon: '📋', prompt: 'Modelo de relatório executivo mensal de social media para [CLIENTE]: KPIs, destaques, aprendizados e próximos passos.' },
      { label: 'Diagnóstico gap', icon: '🔍', prompt: 'Quais os principais gaps de conteúdo que precisamos resolver para [CLIENTE]? Liste por prioridade e impacto.' },
      { label: 'Mix de conteúdo', icon: '⚖️', prompt: 'Mix ideal de conteúdo para [CLIENTE] do nicho [NICHO] no Instagram 2025: % Posts/Reels/Stories e justificativa.' },
    ],

    buildSystemPrompt: (ctx) => `Você é Pradox Bot, estrategista sênior da Digital Scale.

HOJE: ${ctx.today}${ctx.currentUser ? ` | USUÁRIO: ${ctx.currentUser}` : ''}
CLIENTES (${ctx.clients.length}): ${ctx.clients.join(', ')}
MÊS: ${ctx.published}/${ctx.totalItems} publicados (${ctx.totalItems > 0 ? Math.round((ctx.published / ctx.totalItems) * 100) : 0}%) · ${ctx.late} em atraso

CONTEXTO 2025:
• Reels: 3-4x mais alcance que Posts estáticos
• Frequência mínima: 3-5x/semana para crescimento
• Carrossel: maior tempo de tela, ideal para educar
• Nicho gastronômico: bastidores + produto em uso performam melhor

ENTREGAS: calendários · análises · estratégias · relatórios · diagnósticos

REGRAS: Recomendações concretas. Justifique com lógica de negócio. Pense em resultado para o cliente final. Português do Brasil.`,
  },
]
