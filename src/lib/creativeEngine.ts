// ── Creative Engine DS ────────────────────────────────────────────────────────
// Motor de criação de criativos do Editor (vive DENTRO da aba do Editor).
// V1: gera resultado a partir de TEMPLATES internos por nicho — sem IA externa.
// A mesma assinatura (generateCreative) vai ser trocada por /api/ai no futuro,
// sem mexer no componente. Persiste em localStorage + sm_creatives.
// ─────────────────────────────────────────────────────────────────────────────

import { syncToCloud } from './storage'

// ── Tipos do briefing (os campos do formulário) ──────────────────────────────
export type Objetivo = 'vendas' | 'agendamento' | 'seguidores' | 'autoridade' | 'leads' | 'engajamento'
export type Formato  = 'reel' | 'story' | 'short' | 'vsl' | 'anuncio' | 'institucional'
export type Tom      = 'direto' | 'emocional' | 'divertido' | 'sofisticado' | 'urgente' | 'educativo'

export interface CreativeBrief {
  cliente: string
  nicho: string          // key do NICHES
  objetivo: Objetivo
  formato: Formato
  duracao: string        // '15s' | '30s' | '45s' | '60s'
  tom: Tom
  produto: string
  publico: string
  objecao: string
  oferta: string
  cta: string
}

export const BRIEF_VAZIO: CreativeBrief = {
  cliente: '', nicho: 'restaurante', objetivo: 'vendas', formato: 'reel',
  duracao: '30s', tom: 'direto', produto: '', publico: '', objecao: '', oferta: '', cta: '',
}

// ── Resultado (os 7 blocos desta versão) ─────────────────────────────────────
export interface RoteiroBloco { tempo: string; acao: string }

export interface CreativeOutput {
  bigIdea: string
  ganchoPrincipal: string
  variacoesGancho: string[]
  roteiro: RoteiroBloco[]
  direcaoEdicao: string[]
  textoNaTela: string[]       // frases prontas pra jogar na tela (LegendaPro/CapCut)
  cta: string
  versaoOusada: string        // take alternativo mais arriscado
  checklist: string[]
}

// Status de produção do criativo (rascunho → aprovado → produção → feito)
export type CreativeStatus = 'rascunho' | 'aprovado' | 'producao' | 'feito'
export interface CreativeStatusMeta { key: CreativeStatus; label: string; emoji: string; color: string }
export const CREATIVE_STATUS: CreativeStatusMeta[] = [
  { key: 'rascunho', label: 'Rascunho',    emoji: '✏️', color: '#A1A1AA' },
  { key: 'aprovado', label: 'Aprovado',    emoji: '✅', color: '#00C47A' },
  { key: 'producao', label: 'Em produção', emoji: '🎬', color: '#3B8EFF' },
  { key: 'feito',    label: 'Feito',       emoji: '🏁', color: '#ff9039' },
]
export function statusMeta(s: CreativeStatus | undefined): CreativeStatusMeta {
  return CREATIVE_STATUS.find(m => m.key === s) ?? CREATIVE_STATUS[0]
}

export interface SavedCreative {
  id: string
  titulo: string
  brief: CreativeBrief
  output: CreativeOutput
  createdAt: number
  createdBy?: string
  status?: CreativeStatus     // default 'rascunho'
}

// ── Opções de listas dos selects ─────────────────────────────────────────────
export const OBJETIVOS: { key: Objetivo; label: string }[] = [
  { key: 'vendas',      label: 'Vender' },
  { key: 'agendamento', label: 'Agendar / reservar' },
  { key: 'leads',       label: 'Gerar leads' },
  { key: 'seguidores',  label: 'Ganhar seguidores' },
  { key: 'autoridade',  label: 'Autoridade' },
  { key: 'engajamento', label: 'Engajamento' },
]
export const FORMATOS: { key: Formato; label: string }[] = [
  { key: 'reel',          label: 'Reel' },
  { key: 'story',         label: 'Story' },
  { key: 'short',         label: 'Short / TikTok' },
  { key: 'vsl',           label: 'VSL' },
  { key: 'anuncio',       label: 'Anúncio (tráfego)' },
  { key: 'institucional', label: 'Institucional' },
]
export const TONS: { key: Tom; label: string }[] = [
  { key: 'direto',      label: 'Direto' },
  { key: 'emocional',   label: 'Emocional' },
  { key: 'divertido',   label: 'Divertido' },
  { key: 'sofisticado', label: 'Sofisticado' },
  { key: 'urgente',     label: 'Urgente' },
  { key: 'educativo',   label: 'Educativo' },
]
export const DURACOES = ['15s', '30s', '45s', '60s']

// ── Registry de nichos (escalável: novo nicho = nova entrada aqui) ────────────
export interface NicheTemplate {
  key: string
  label: string
  emoji: string
  objecoesComuns: string[]
  bigIdeas: string[]
  ganchos: string[]
  cenas: string[]       // o que filmar (vira roteiro + checklist)
  edicao: string[]      // direção de edição específica do nicho
}

export const NICHES: NicheTemplate[] = [
  {
    key: 'restaurante', label: 'Restaurante / Food', emoji: '🍽️',
    objecoesComuns: ['acham caro', 'acham que fica longe', 'não conhecem o ambiente'],
    bigIdeas: [
      'Você está pedindo o prato errado a vida inteira',
      'O lugar que vira o seu "almoço de sempre" depois da primeira vez',
      'A foto não faz justiça — e é por isso que esse vídeo existe',
    ],
    ganchos: [
      'Para de pedir sempre a mesma coisa',
      'Esse aqui ninguém pede — e devia',
      'Olha o que acontece quando esse prato chega na mesa',
      'Se você curte {produto}, segura aí 3 segundos',
      'O segredo desse prato não é o tempero',
      'Eu não acreditei até cortar e ver isso',
    ],
    cenas: [
      'close do prato saindo da cozinha, ainda fumegando',
      'o garfo cortando / o queijo ou molho escorrendo em câmera lenta',
      'reação real do cliente na primeira garfada',
      'plano aberto do ambiente cheio / clima do salão',
    ],
    edicao: [
      'abre com o close mais apetitoso nos 3 primeiros segundos, sem logo, sem intro',
      'speed ramp no corte do prato + SFX de "puxa-queijo"/crocância no momento exato',
      'som ambiente real (talheres, fritura) por baixo da trilha, volume baixo',
    ],
  },
  {
    key: 'estetica', label: 'Estética / Beleza', emoji: '💅',
    objecoesComuns: ['medo de não dar certo', 'acham caro', 'medo de doer'],
    bigIdeas: [
      'O antes e depois que faz a cliente marcar antes do vídeo acabar',
      'Não é vaidade, é como ela se vê no espelho todo dia',
      'O detalhe que ninguém te conta antes do procedimento',
    ],
    ganchos: [
      'Se você se incomoda com isso, presta atenção',
      'O resultado em {duracao} de vídeo',
      'Ninguém te avisa isso antes de fazer',
      'Antes e depois sem filtro',
      'Esse é o procedimento que mais transforma',
      'Para de esconder isso nas fotos',
    ],
    cenas: [
      'close do "antes" honesto, boa luz',
      'bastidor do procedimento (mãos, técnica, ambiente limpo)',
      'reveal do "depois" com a reação da cliente',
      'depoimento curto da cliente falando como se sentiu',
    ],
    edicao: [
      'transição de match-cut entre antes e depois no mesmo enquadramento',
      'legenda grande destacando o resultado; trilha suave que cresce no reveal',
      'realce de cor leve no depois, sem exagerar (tem que parecer real)',
    ],
  },
  {
    key: 'academia', label: 'Academia / Fitness', emoji: '💪',
    objecoesComuns: ['acham que não têm tempo', 'vergonha de começar', 'já tentaram e desistiram'],
    bigIdeas: [
      'Não é sobre o corpo — é sobre não desistir de novo',
      'O treino que cabe na sua semana real',
      'A virada começa no dia que você para de esperar segunda',
    ],
    ganchos: [
      'Você não precisa de 2 horas por dia',
      'Para de esperar a segunda-feira',
      'Esse erro trava seu resultado há meses',
      'Olha a diferença de 4 semanas',
      'Se você sempre desiste, é por isso',
      'O treino que ninguém te mostra',
    ],
    cenas: [
      'energia do ambiente / aluno treinando focado',
      'execução correta do exercício em destaque',
      'progresso real (antes/depois ou números)',
      'professor orientando de perto',
    ],
    edicao: [
      'cortes no ritmo da batida, sem plano parado por mais de 2s',
      'legenda de impacto a cada frase; trilha de energia crescente',
      'destaque em câmera lenta no pico do esforço',
    ],
  },
  {
    key: 'clinica', label: 'Clínica / Saúde', emoji: '🩺',
    objecoesComuns: ['medo do procedimento', 'acham caro', 'desconfiam do resultado'],
    bigIdeas: [
      'A dúvida que faz o paciente adiar — respondida em 30 segundos',
      'Cuidar disso agora é mais barato que ignorar',
      'O que ninguém te explica na consulta rápida',
    ],
    ganchos: [
      'Se você sente isso, não ignore',
      'O sinal que a maioria deixa passar',
      'Isso não é normal — e tem solução',
      'A pergunta que todo paciente faz',
      'Você não precisa conviver com isso',
      '3 coisas que ninguém te conta sobre isso',
    ],
    cenas: [
      'profissional falando direto pra câmera, tom de confiança',
      'ambiente limpo e equipado (passa segurança)',
      'explicação simples com apoio visual',
      'depoimento de paciente satisfeito',
    ],
    edicao: [
      'ritmo calmo e claro; legenda para acessibilidade em tudo',
      'destaque visual nos pontos-chave da explicação',
      'trilha discreta; foco na credibilidade, sem efeito chamativo',
    ],
  },
  {
    key: 'varejo', label: 'Loja / Varejo', emoji: '🛍️',
    objecoesComuns: ['acham caro', 'não sabem se vale', 'compram só na concorrência'],
    bigIdeas: [
      'O produto que some toda vez que chega',
      'Por que esse vira presente sem você nem pedir',
      'O motivo de quem compra voltar pra levar outro',
    ],
    ganchos: [
      'Esse aqui esgota toda semana',
      'Para de pagar mais caro por isso',
      'Olha o que vem dentro',
      'Se você procura {produto}, achou',
      'O detalhe que muda tudo',
      'Eu não esperava por esse último',
    ],
    cenas: [
      'unboxing / produto em detalhe girando na mão',
      'produto sendo usado na vida real',
      'comparação rápida (antes/depois ou vs. alternativa)',
      'cliente reagindo ao receber/usar',
    ],
    edicao: [
      'abre com o produto em movimento, close nos detalhes que vendem',
      'texto na tela com preço/benefício; trilha animada no ritmo dos cortes',
      'SFX de "pop" a cada feature aparecendo',
    ],
  },
  {
    key: 'automotivo', label: 'Automotivo', emoji: '🚗',
    objecoesComuns: ['acham caro', 'desconfiam da procedência', 'medo de dor de cabeça depois'],
    bigIdeas: [
      'O detalhe que separa um carro cuidado de um problema caro',
      'Quem entende olha pra isso primeiro',
      'O serviço que se paga sozinho na revenda',
    ],
    ganchos: [
      'Olha isso antes de fechar negócio',
      'Esse erro custa caro depois',
      'O que ninguém checa e devia',
      'Antes e depois desse serviço',
      'Se você tem um desses, presta atenção',
      'O segredo de quem mantém o carro novo',
    ],
    cenas: [
      'detalhe do carro / serviço em close (brilho, acabamento)',
      'processo sendo feito com capricho',
      'resultado final com plano de impacto',
      'cliente recebendo o carro pronto',
    ],
    edicao: [
      'plano de impacto do carro nos 3s iniciais; trilha forte',
      'speed ramp nos detalhes; SFX grave nos cortes',
      'gradação escura e contrastada pra valorizar o brilho',
    ],
  },
  {
    key: 'servicos', label: 'Serviços / Local', emoji: '🔧',
    objecoesComuns: ['acham caro', 'medo de mão de obra ruim', 'já tiveram problema com outro antes'],
    bigIdeas: [
      'O serviço que você só valoriza quando dá problema',
      'Mais barato que o conserto de quem fez errado',
      'O que separa um serviço bem feito de uma dor de cabeça',
    ],
    ganchos: [
      'Se você tem isso em casa, presta atenção',
      'Esse erro custa caro lá na frente',
      'O que ninguém verifica e devia',
      'Antes de chamar qualquer um, olha isso',
      'O sinal de que está na hora de resolver',
      'Para de empurrar esse problema com a barriga',
    ],
    cenas: [
      'o problema real do cliente em close (o "antes")',
      'a equipe trabalhando com capricho e segurança',
      'o resultado final funcionando (o "depois")',
      'cliente satisfeito aprovando o serviço',
    ],
    edicao: [
      'abre com o problema nos 3s; mostra o "antes" sem medo',
      'transição antes/depois no mesmo enquadramento; trilha que cresce no resultado',
      'texto na tela com o benefício prático; selo de garantia + CTA fixo no fim',
    ],
  },
  {
    key: 'turismo', label: 'Turismo / Pousada', emoji: '🏝️',
    objecoesComuns: ['acham caro', 'acham longe', 'medo de não valer a viagem'],
    bigIdeas: [
      'O lugar que faz você esquecer o celular por um fim de semana',
      'A vista que a foto nunca entrega — só o vídeo',
      'O refúgio que vira tradição todo ano',
    ],
    ganchos: [
      'Se você precisa fugir da rotina, olha isso',
      'Esse lugar parece outro país',
      'Acorda com essa vista',
      'O fim de semana que você merece',
      'Ninguém volta de lá igual',
      'Salva esse antes que lote',
    ],
    cenas: [
      'plano aéreo / vista de tirar o fôlego logo na abertura',
      'detalhes da experiência (café, quarto, piscina, pôr do sol)',
      'pessoas curtindo o momento, clima leve',
      'o melhor ângulo do lugar pra fechar',
    ],
    edicao: [
      'abre com o plano mais bonito, sem texto, deixa respirar 2s',
      'cortes no tempo da trilha; transições suaves entre cenas',
      'cor quente e viva; legenda mínima pra não competir com a paisagem',
    ],
  },
  {
    key: 'outro', label: 'Outro / Genérico', emoji: '🎬',
    objecoesComuns: ['acham caro', 'não conhecem a marca', 'estão na concorrência'],
    bigIdeas: [
      'O que faz {publico} escolher você e não o concorrente',
      'A transformação que seu cliente realmente compra',
      'O motivo real de alguém precisar disso hoje',
    ],
    ganchos: [
      'Se você é {publico}, presta atenção',
      'Para de fazer isso do jeito errado',
      'O que ninguém te conta sobre {produto}',
      'Olha a diferença que isso faz',
      'Esse detalhe muda tudo',
      'Você está perdendo tempo com isso',
    ],
    cenas: [
      'rosto/produto em destaque na abertura',
      'o problema do público mostrado de forma concreta',
      'a solução em ação, com prova',
      'fechamento com a chamada clara',
    ],
    edicao: [
      'gancho visual forte nos 3 primeiros segundos, sem intro',
      'um corte a cada frase; legenda grande sempre na tela',
      'trilha no clima do tom escolhido; SFX nos pontos de virada',
    ],
  },
]

export function nicheByKey(key: string): NicheTemplate {
  return NICHES.find(n => n.key === key) ?? NICHES[NICHES.length - 1]
}

// Tenta adivinhar o nicho a partir do nome do cliente / produto do card.
// Cai em 'outro' (genérico) quando não reconhece — nunca chuta restaurante.
const NICHE_HINTS: Record<string, string[]> = {
  restaurante: ['restaurante', 'pizz', 'hamburg', 'burg', 'lanch', 'food', 'açaí', 'acai', 'sushi', 'churras', 'padaria', 'confeit', 'gastr', 'cafeteria', 'café', 'cafe', 'marmita', 'espetinho', 'sorvet', 'doceria', 'esfiha', 'temaki'],
  estetica:    ['estétic', 'estetic', 'beleza', 'make', 'maquia', 'sobrancelha', 'cílio', 'cilio', 'salão', 'salao', 'cabelo', 'unha', 'nail', 'spa', 'depil', 'massag', 'botox', 'harmoniz', 'lash', 'barbear', 'barber'],
  academia:    ['academia', 'fitness', 'crossfit', 'gym', 'treino', 'personal', 'pilates', 'musculа', 'musculacao', 'musculação'],
  clinica:     ['clínic', 'clinic', 'odonto', 'dent', 'médic', 'medic', 'saúde', 'saude', 'fisio', 'derma', 'psico', 'nutri', 'vacin', 'exame', 'laborat', 'consultório', 'consultorio'],
  varejo:      ['loja', 'store', 'varejo', 'boutique', 'moda', 'roupa', 'calçad', 'calcad', 'joalh', 'ótica', 'otica', 'presente', 'papelaria', 'pet shop', 'petshop', 'mercado', 'magazine'],
  automotivo:  ['auto', 'carro', 'veícul', 'veicul', 'funilaria', 'lavagem', 'mecânic', 'mecanic', 'pneu', ' moto', 'seminovo', 'concession', 'estética automotiva'],
  servicos:    ['serviç', 'servic', 'elétric', 'eletric', 'hidro', 'hidráulic', 'hidraulic', 'encanad', 'reforma', 'construç', 'constru', 'solar', 'climatiz', 'ar condicionado', 'dedetiz', 'manutenç', 'assistência', 'assistencia', 'conserto', 'instalaç', 'energia', 'elevador', 'vidraç', 'marcenaria', 'serralheria', 'gesso', 'pintura', 'limpeza'],
  turismo:     ['pousada', 'hotel', 'resort', 'chalé', 'chale', 'turismo', 'viagem', 'passeio', 'camping', 'rancho', 'sítio', 'sitio', 'hostel', 'airbnb', 'eco'],
}

export function guessNicho(text: string): string {
  const t = ` ${(text || '').toLowerCase()} `
  for (const [key, hints] of Object.entries(NICHE_HINTS)) {
    if (hints.some(h => t.includes(h))) return key
  }
  return 'outro'
}

// ── Geração por template ──────────────────────────────────────────────────────
export interface GenOpts {
  seed?: number            // gira as escolhas (botão "gerar variação")
  especifico?: boolean     // botão "deixar menos genérico"
  anuncio?: boolean        // botão "transformar em anúncio"
  edicaoDetalhada?: boolean // botão "criar direção de edição"
  current?: CreativeOutput // criativo atual (contexto pros botões de refino na IA)
  marca?: string           // referência de tom/marca do cliente (roteiro/caption) pro prompt
}

function fill(t: string, b: CreativeBrief): string {
  return t
    .replace(/\{produto\}/g,  b.produto.trim()  || 'seu produto')
    .replace(/\{oferta\}/g,   b.oferta.trim()   || 'sua oferta')
    .replace(/\{publico\}/g,  b.publico.trim()  || 'seu público')
    .replace(/\{objecao\}/g,  b.objecao.trim()  || 'a principal dúvida')
    .replace(/\{cta\}/g,      b.cta.trim()      || 'chamar no WhatsApp')
    .replace(/\{cliente\}/g,  b.cliente.trim()  || 'a marca')
    .replace(/\{duracao\}/g,  b.duracao)
}

function pick<T>(arr: T[], seed: number): T {
  return arr[((seed % arr.length) + arr.length) % arr.length]
}

function rotate<T>(arr: T[], seed: number, n: number): T[] {
  const out: T[] = []
  for (let i = 0; i < n; i++) out.push(arr[((seed + i) % arr.length + arr.length) % arr.length])
  return out
}

function parseSeconds(d: string): number {
  const m = d.match(/\d+/)
  return m ? Number(m[0]) : 30
}

function buildCta(b: CreativeBrief): string {
  const acao = b.cta.trim()
  const mapa: Record<Objetivo, string> = {
    vendas:      `Garanta agora: ${b.oferta.trim() || 'a oferta'}. ${acao || 'Toque no link e compre'} — fixe na tela nos últimos 3s com seta apontando.`,
    agendamento: `${acao || 'Agende seu horário'} — diga que veio pelo vídeo e ${b.oferta.trim() || 'aproveite a condição'}. Vagas limitadas essa semana.`,
    leads:       `${acao || 'Comenta "EU QUERO"'} que eu te mando tudo no direct. CTA repetido na fala e na legenda.`,
    seguidores:  `Segue aqui pra não perder os próximos — ${acao || 'toca no seguir'}. Reforça com texto fixo no canto.`,
    autoridade:  `${acao || 'Salva esse vídeo'} pra não esquecer e compartilha com quem precisa ver isso.`,
    engajamento: `${acao || 'Comenta o que você faria'} aqui embaixo — responde todo mundo. Pergunta fixa na tela.`,
  }
  return mapa[b.objetivo]
}

function buildRoteiro(b: CreativeBrief, gancho: string, ctaLinha: string, especifico: boolean, anuncio: boolean): RoteiroBloco[] {
  const T  = parseSeconds(b.duracao)
  const t1 = Math.min(3, Math.max(2, Math.round(T * 0.12)))
  const t2 = Math.max(t1 + 2, Math.round(T * 0.32))
  const t3 = Math.max(t2 + 2, Math.round(T * 0.60))
  const t4 = Math.max(t3 + 2, Math.round(T * 0.82))
  const seg = (a: number, c: number) => `${a}–${c}s`
  const det = especifico ? ' Use close, som ambiente real e um zoom lento de 5%.' : ''

  const blocos: RoteiroBloco[] = [
    { tempo: seg(0, t1),  acao: `GANCHO — "${gancho}" dito olhando pra câmera, sem logo e sem "oi pessoal".${det}` },
    { tempo: seg(t1, t2), acao: `DOR — mostre ${b.publico.trim() || 'o público'} vivendo ${b.objecao.trim() || 'o problema'} de forma concreta (não fale, mostre).` },
    { tempo: seg(t2, t3), acao: `VIRADA — ${b.produto.trim() || 'o produto'} entra resolvendo. Mostre o "como", não só o "o quê".${det}` },
    anuncio
      ? { tempo: seg(t3, t4), acao: `OFERTA + PROVA — destaque ${b.oferta.trim() || 'a oferta'} com depoimento/print de resultado e quebre a objeção "${b.objecao.trim() || 'é caro'}" na hora.` }
      : { tempo: seg(t3, t4), acao: `PROVA — depoimento curto, resultado real ou bastidor que gera confiança.` },
    { tempo: seg(t4, T),  acao: `CTA — ${ctaLinha}` },
  ]
  return blocos
}

function buildEdicao(b: CreativeBrief, niche: NicheTemplate, seed: number, especifico: boolean, anuncio: boolean, detalhada: boolean): string[] {
  const tomTrilha: Record<Tom, string> = {
    direto:      'trilha seca e batida marcada',
    emocional:   'trilha emocional que cresce no clímax',
    divertido:   'trilha animada/meme no ritmo dos cortes',
    sofisticado: 'trilha elegante e minimalista',
    urgente:     'trilha tensa com batida acelerada',
    educativo:   'trilha de fundo discreta, voz em primeiro plano',
  }
  const base = [
    ...niche.edicao.map(e => fill(e, b)),
    `Legenda dinâmica grande e sempre na tela (estilo CapCut), 1 ideia por frase.`,
    `Áudio: ${tomTrilha[b.tom]}; corte qualquer silêncio acima de 0,4s.`,
  ]
  if (especifico) {
    base.push(`Seja concreto: nada de "mostre o produto" — defina o enquadramento exato (ex.: close de 45° no detalhe que vende) e o SFX de cada corte.`)
    base.push(`Texto na tela com a frase mais forte do gancho, fonte pesada, contorno pra ler em mudo.`)
  }
  if (anuncio) {
    base.push(`Versão anúncio: primeiros 3s param o scroll; insira a oferta em texto fixo e um CTA no início E no fim (Meta corta vídeo longo).`)
    base.push(`Gere 2 aberturas A/B (gancho diferente) pra testar no tráfego com o mesmo corpo.`)
  }
  if (detalhada) {
    base.push(`Mapa de cortes: marque o timestamp de cada corte e o SFX correspondente (whoosh na transição, ding no benefício, boom no reveal).`)
    base.push(`Color: aplique a LUT do cliente e iguale o tom de pele entre as cenas.`)
    base.push(`Last frame: segure 1s no CTA com a tela "respirando" pra dar tempo de tocar.`)
  }
  // gira a ordem levemente pra "variação" parecer diferente
  return seed % 2 === 0 ? base : [base[0], ...base.slice(1).reverse()]
}

function buildChecklist(b: CreativeBrief, niche: NicheTemplate): string[] {
  return [
    ...niche.cenas.map(c => `Gravar: ${fill(c, b)}`),
    `Gravar 2 takes do gancho com energias diferentes`,
    `Conferir áudio limpo (sem vento/eco) antes de fechar a gravação`,
    `Editar: legenda em toda fala + ${b.cta.trim() || 'CTA'} fixo no fim`,
    `Exportar 9:16 1080×1920 e revisar em mudo antes de publicar`,
  ]
}

function buildTextoNaTela(b: CreativeBrief, gancho: string): string[] {
  const up = (s: string) => s.replace(/[.!?]+$/, '').toUpperCase()
  return [
    up(gancho),
    b.produto.trim() ? up(b.produto) : up('o que ninguém te conta'),
    b.objecao.trim() ? `"${b.objecao.trim()}"? olha isso` : 'presta atenção nisso',
    up(b.cta.trim() || 'corre que é por tempo limitado'),
  ]
}

function buildVersaoOusada(b: CreativeBrief, niche: NicheTemplate, seed: number): string {
  const gancho = fill(pick(niche.ganchos, seed + 2), b)
  return `Abra acusando o erro do público de frente: "${gancho}" — sem suavizar. Mostre o problema cru nos 3 primeiros segundos (o "antes" feio), faça uma pausa seca antes da virada e jogue a ${b.oferta.trim() || 'oferta'} como se fosse polêmica ("vão me xingar por entregar isso tão barato"). Fecha provocando: ${b.cta.trim() || 'duvido você não chamar no zap'}.`
}

export function generateCreative(b: CreativeBrief, opts: GenOpts = {}): CreativeOutput {
  const seed   = opts.seed ?? 0
  const niche  = nicheByKey(b.nicho)

  const ganchosPool = niche.ganchos.map(g => fill(g, b))
  const ganchoPrincipal = pick(ganchosPool, seed)
  const variacoesGancho = rotate(ganchosPool, seed + 1, Math.min(5, ganchosPool.length))

  const bigIdea  = fill(pick(niche.bigIdeas, seed), b)
  const ctaLinha = buildCta(b)

  return {
    bigIdea,
    ganchoPrincipal,
    variacoesGancho,
    roteiro:        buildRoteiro(b, ganchoPrincipal, ctaLinha, !!opts.especifico, !!opts.anuncio),
    direcaoEdicao:  buildEdicao(b, niche, seed, !!opts.especifico, !!opts.anuncio, !!opts.edicaoDetalhada),
    textoNaTela:    buildTextoNaTela(b, ganchoPrincipal),
    cta:            ctaLinha,
    versaoOusada:   buildVersaoOusada(b, niche, seed),
    checklist:      buildChecklist(b, niche),
  }
}

// ── Copiar tudo como texto ────────────────────────────────────────────────────
export function creativeToText(b: CreativeBrief, o: CreativeOutput): string {
  const L: string[] = []
  L.push(`🎬 CRIATIVO — ${b.cliente || nicheByKey(b.nicho).label}`)
  L.push(`Formato: ${b.formato} · ${b.duracao} · Tom: ${b.tom} · Objetivo: ${b.objetivo}`)
  L.push('')
  L.push(`💡 BIG IDEA\n${o.bigIdea}`)
  L.push('')
  L.push(`🎣 GANCHO PRINCIPAL\n${o.ganchoPrincipal}`)
  L.push('')
  L.push(`🎣 VARIAÇÕES DE GANCHO\n${o.variacoesGancho.map((g, i) => `${i + 1}. ${g}`).join('\n')}`)
  L.push('')
  L.push(`🎞️ ROTEIRO POR TEMPO\n${o.roteiro.map(r => `[${r.tempo}] ${r.acao}`).join('\n')}`)
  L.push('')
  L.push(`✂️ DIREÇÃO DE EDIÇÃO\n${o.direcaoEdicao.map(e => `• ${e}`).join('\n')}`)
  if (o.textoNaTela?.length) { L.push(''); L.push(`📝 TEXTO NA TELA\n${o.textoNaTela.map(t => `• ${t}`).join('\n')}`) }
  L.push('')
  L.push(`📣 CTA\n${o.cta}`)
  if (o.versaoOusada) { L.push(''); L.push(`🔥 VERSÃO OUSADA\n${o.versaoOusada}`) }
  L.push('')
  L.push(`✅ CHECKLIST\n${o.checklist.map(c => `☐ ${c}`).join('\n')}`)
  return L.join('\n')
}

// Versão pra WhatsApp: títulos em *negrito* (asterisco simples) e blocos enxutos,
// pronta pra mandar pro cliente aprovar ou pro editor executar.
export function creativeToWhatsApp(b: CreativeBrief, o: CreativeOutput): string {
  const L: string[] = []
  L.push(`🎬 *Criativo — ${b.cliente || nicheByKey(b.nicho).label}*`)
  L.push(`_${b.formato} · ${b.duracao} · tom ${b.tom}_`)
  L.push('')
  L.push(`💡 *Big idea:* ${o.bigIdea}`)
  L.push('')
  L.push(`🎣 *Gancho:* ${o.ganchoPrincipal}`)
  L.push('')
  L.push('🎞️ *Roteiro:*')
  o.roteiro.forEach(r => L.push(`${r.tempo} — ${r.acao}`))
  if (o.textoNaTela?.length) { L.push(''); L.push('📝 *Texto na tela:*'); o.textoNaTela.forEach(t => L.push(`• ${t}`)) }
  L.push('')
  L.push(`📣 *CTA:* ${o.cta}`)
  return L.join('\n')
}

// ── Motor de IA (Claude via /api/ai) com fallback pra template ────────────────
// Mesmo contrato do EditorAI: POST /api/ai { system, messages:[{role,content}] }
// chave em localStorage['sm_anthropic_key'] via header X-Anthropic-Key.
// Sem chave OU se a IA falhar/retornar lixo → cai no generateCreative (template).

const SYSTEM = `Você é uma equipe sênior de criação publicitária brasileira reunida num cérebro só:
1) copywriter de resposta direta, 2) roteirista de vídeos curtos (Reels/TikTok), 3) diretor de edição, 4) estrategista de tráfego pago, 5) designer de conteúdo, 6) especialista em negócios locais.

Missão: tirar o editor de roteiros GENÉRICOS. Cada resposta é uma DIREÇÃO COMPLETA de gravação, edição e venda — não só texto.

REGRAS:
- Português do Brasil, falando com um editor de vídeo.
- Seja SEMPRE específico e concreto. PROIBIDO resposta rasa tipo "mostre o produto", "fale dos benefícios", "use uma música animada", "chame para comprar".
- RUIM: "Mostre o prato e fale que é gostoso."
- BOM: "Comece com um close do garfo cortando a carne, som ambiente do prato, zoom leve no molho escorrendo e o texto na tela 'Esse é o tipo de almoço que muda seu dia.' Corte pro cliente servindo e feche com CTA de reserva."
- Use gancho de 3s, a dor/desejo do público, a cena visual, a edição pra retenção, a frase na tela, a quebra de objeção e a ação final. Adapte tudo ao nicho.

Responda APENAS com um JSON válido, sem texto antes/depois e sem cercas de código, exatamente neste formato:
{"bigIdea":"frase forte","ganchoPrincipal":"primeira frase do vídeo","variacoesGancho":["5 ganchos alternativos"],"roteiro":[{"tempo":"0-3s","acao":"..."}],"direcaoEdicao":["bullets concretos de edição"],"textoNaTela":["frases curtas prontas pra aparecer na tela, em caixa alta quando fizer sentido"],"cta":"CTA final específico com direção de tela","versaoOusada":"um take alternativo mais arriscado/polêmico do mesmo criativo","checklist":["itens de gravação e edição"]}`

function modeInstruction(b: CreativeBrief, opts: GenOpts): string {
  const atual = opts.current ? `\n\nCriativo atual (para refinar):\n${creativeToText(b, opts.current)}` : ''
  if (opts.especifico && opts.current)      return `Este criativo está genérico demais. Reescreva TUDO muito mais específico e concreto, no nível do exemplo BOM (close, SFX, zoom, frase exata na tela). Nada de "mostre o produto".${atual}`
  if (opts.anuncio && opts.current)         return `Transforme num ANÚNCIO de tráfego pago (Meta/TikTok Ads): gancho que para o scroll nos 3s, oferta e prova em destaque, quebra da objeção "${b.objecao || 'principal'}", e CTA no início E no fim.${atual}`
  if (opts.edicaoDetalhada && opts.current) return `Mantenha a ideia, mas detalhe a DIREÇÃO DE EDIÇÃO corte a corte: timestamps, zoom, speed ramp, SFX por momento, estilo de legenda e trilha.${atual}`
  if ((opts.seed ?? 0) > 0)                 return `Gere uma versão COMPLETAMENTE diferente do mesmo briefing — outro ângulo e outro gancho.`
  return ''
}

function buildUserPrompt(b: CreativeBrief, opts: GenOpts): string {
  const n = nicheByKey(b.nicho)
  const linhas = [
    'Crie um criativo a partir deste briefing:',
    `- Cliente: ${b.cliente || '(não informado)'}`,
    `- Nicho: ${n.label}`,
    `- Objetivo: ${b.objetivo}`,
    `- Formato: ${b.formato} · Duração: ${b.duracao} · Tom: ${b.tom}`,
    `- Produto/serviço: ${b.produto || '(não informado)'}`,
    `- Público-alvo: ${b.publico || '(não informado)'}`,
    `- Objeção principal: ${b.objecao || '(não informada)'}`,
    `- Oferta: ${b.oferta || '(não informada)'}`,
    `- CTA desejado: ${b.cta || '(livre)'}`,
  ]
  if (opts.marca && opts.marca.trim()) {
    linhas.push(`- Referência de tom/marca do cliente (use como base, NÃO copie): ${opts.marca.trim().slice(0, 600)}`)
  }
  const extra = modeInstruction(b, opts)
  if (extra) linhas.push('', extra)
  return linhas.join('\n')
}

function parseOutput(text: string): CreativeOutput | null {
  if (!text) return null
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const s = t.indexOf('{'); const e = t.lastIndexOf('}')
  if (s < 0 || e < 0) return null
  try {
    const o = JSON.parse(t.slice(s, e + 1))
    const arr = (x: unknown): string[] => Array.isArray(x) ? x.filter(Boolean).map(v => String(v).trim()) : []
    const roteiro = Array.isArray(o.roteiro)
      ? o.roteiro.map((r: { tempo?: unknown; acao?: unknown } | string) =>
          typeof r === 'string' ? { tempo: '', acao: r } : { tempo: String(r.tempo ?? '').trim(), acao: String(r.acao ?? '').trim() })
        .filter((r: RoteiroBloco) => r.acao)
      : []
    if (!o.bigIdea && !o.ganchoPrincipal && !roteiro.length) return null
    return {
      bigIdea:         String(o.bigIdea ?? '').trim(),
      ganchoPrincipal: String(o.ganchoPrincipal ?? '').trim(),
      variacoesGancho: arr(o.variacoesGancho).slice(0, 5),
      roteiro,
      direcaoEdicao:   arr(o.direcaoEdicao),
      textoNaTela:     arr(o.textoNaTela),
      cta:             String(o.cta ?? '').trim(),
      versaoOusada:    String(o.versaoOusada ?? '').trim(),
      checklist:       arr(o.checklist),
    }
  } catch { return null }
}

export type EngineSource = 'ia' | 'template'

export function hasAIKey(): boolean {
  try { return !!(localStorage.getItem('sm_anthropic_key') || '').trim() } catch { return false }
}

// Gera o criativo: SEMPRE tenta a IA (o servidor pode ter chave de ambiente própria
// na Cloudflare — env ANTHROPIC/GROQ); a chave pessoal vai no header só se existir.
// Se a IA falhar ou não houver chave nenhuma (servidor responde erro), cai no template.
export async function runEngine(b: CreativeBrief, opts: GenOpts = {}): Promise<{ output: CreativeOutput; source: EngineSource }> {
  let key = ''
  try { key = (localStorage.getItem('sm_anthropic_key') || '').trim() } catch { /* sem localStorage */ }
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (key) headers['X-Anthropic-Key'] = key
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers,
      body: JSON.stringify({ system: SYSTEM, messages: [{ role: 'user', content: buildUserPrompt(b, opts) }] }),
    })
    const data = await res.json() as { content?: { text: string }[]; error?: { message: string } }
    if (!data.error) {
      const parsed = parseOutput(data.content?.[0]?.text ?? '')
      if (parsed) return { output: parsed, source: 'ia' }
    }
  } catch { /* cai no template */ }
  return { output: generateCreative(b, opts), source: 'template' }
}

// Texto pronto pra abrir no LegendaPro como legenda dinâmica (gancho + CTA).
export function legendaFromOutput(o: CreativeOutput): string {
  return [o.ganchoPrincipal, o.cta].map(s => (s || '').trim()).filter(Boolean).join('\n')
}

// ── Persistência (sm_creatives) ───────────────────────────────────────────────
const KEY = 'sm_creatives'

export function loadCreatives(): SavedCreative[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function persist(list: SavedCreative[]): void {
  localStorage.setItem(KEY, JSON.stringify(list))
  syncToCloud(KEY, list)
}

export function saveCreative(brief: CreativeBrief, output: CreativeOutput, createdBy?: string): SavedCreative[] {
  const titulo = `${brief.cliente || nicheByKey(brief.nicho).label}${brief.produto ? ' · ' + brief.produto : ''}`
  const atual = loadCreatives()
  const anterior = atual.find(c => c.titulo === titulo)
  const novo: SavedCreative = {
    id: crypto.randomUUID(), titulo, brief, output, createdAt: Date.now(), createdBy,
    status: anterior?.status ?? 'rascunho',   // regenerar mantém o status já definido
  }
  // upsert: substitui um criativo do mesmo cliente+produto em vez de empilhar duplicado
  const next = [novo, ...atual.filter(c => c.titulo !== titulo)].slice(0, 60)
  persist(next)
  return next
}

export function setCreativeStatus(id: string, status: CreativeStatus): SavedCreative[] {
  const next = loadCreatives().map(c => c.id === id ? { ...c, status } : c)
  persist(next)
  return next
}

export function removeCreative(id: string): SavedCreative[] {
  const next = loadCreatives().filter(c => c.id !== id)
  persist(next)
  return next
}
