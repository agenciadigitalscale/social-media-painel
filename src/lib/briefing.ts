/**
 * Schema do briefing do cliente — FONTE ÚNICA compartilhada entre o formulário
 * público (`BriefingForm`, rota /briefing/:token) e a Central de Briefings
 * (aba interna). Mudou um campo aqui, mudou nos dois lugares.
 *
 * Estrutura profissional (2026-09): cobre a operação de verdade — o que a
 * empresa faz, estrutura/capacidade, preços, sazonalidade, produção de conteúdo
 * (o que pode e o que NÃO pode aparecer), acessos e licenças. As chaves antigas
 * (repName, cnpj, igSenha…) foram preservadas para não perder briefing já
 * preenchido; os campos novos são aditivos.
 */

export interface BriefingField {
  key: string
  label: string
  /** Dica curta abaixo do rótulo (placeholder/ajuda). */
  hint?: string
  required?: boolean
  multiline?: boolean
  /** Credencial/dado sigiloso — mascarado por padrão na leitura interna. */
  sensitive?: boolean
  /** Campo de escolha única (renderiza como botões). Sem isto = texto livre. */
  type?: 'choice'
  options?: string[]
}

export interface BriefingSection {
  title: string
  /** Renderiza o bloco de objetivos (multi-seleção) dentro desta seção. */
  hasObjectives?: boolean
  fields: BriefingField[]
}

export const BRIEFING_OBJECTIVES = [
  'Fortalecer marca', 'Atrair clientes', 'Aumentar faturamento',
  'Lotar a alta temporada', 'Vender serviços', 'Vender pacote fechado',
  'Gerar autoridade na região', 'Parecer mais profissional', 'Ser mais conhecido',
]

export const BRIEFING_SECTIONS: BriefingSection[] = [
  {
    title: '🏢 Dados Cadastrais',
    fields: [
      { key: 'repName',      label: 'Nome do Representante Legal', required: true },
      { key: 'razaoSocial',  label: 'Razão Social da Empresa',     required: true },
      { key: 'cpf',          label: 'CPF do Representante',         required: true, sensitive: true },
      { key: 'cnpj',         label: 'CNPJ da Empresa',             sensitive: true },
      { key: 'endereco',     label: 'Endereço Completo' },
      { key: 'telefone',     label: 'Telefone para Contato',       required: true },
      { key: 'email',        label: 'E-mail para Contato',         required: true },
      { key: 'pontoContato', label: 'Ponto de Contato',            hint: 'Quem falamos no dia a dia — nome, cargo e WhatsApp' },
    ],
  },
  {
    title: '🏗️ A Operação Hoje',
    fields: [
      { key: 'nomeEmpresa',    label: 'Nome da Empresa (marca)',        required: true },
      { key: 'servPrincipal',  label: 'Principais Produtos/Serviços',   required: true, multiline: true },
      { key: 'outrosServ',     label: 'Outros Serviços / Pacotes',      multiline: true, hint: 'Passeios fechados, eventos, transfer…' },
      { key: 'estrutura',      label: 'Estrutura / Frota / Capacidade', multiline: true, hint: 'O que você tem para atender (veículos, salas, equipamentos)' },
      { key: 'tempoMercado',   label: 'Tempo de Atuação no Mercado' },
      { key: 'tamanhoEquipe',  label: 'Tamanho da Equipe' },
      { key: 'comoReserva',    label: 'Como o Cliente Compra / Reserva', hint: 'Site, WhatsApp, presencial…' },
      { key: 'quemAtendeLeads', label: 'Quem Atende os Leads' },
      { key: 'diferencial',    label: 'Diferencial em Relação aos Concorrentes', multiline: true },
      { key: 'concorrentes',   label: 'Principais Concorrentes',        multiline: true },
    ],
  },
  {
    title: '🎯 Objetivos com o Projeto',
    hasObjectives: true,
    fields: [
      { key: 'expectativas',   label: 'Expectativa com o Projeto',      multiline: true, hint: 'Onde você quer chegar com a Digital Scale' },
      { key: 'capacidadeAtend', label: 'Capacidade de Atendimento',     hint: 'Quantos clientes/saídas por dia ou semana você consegue atender' },
      { key: 'referencias',    label: 'Referências de Empresas que Admira', multiline: true },
      { key: 'historicoMkt',   label: 'Já Fez Marketing Antes? Qual Resultado?', multiline: true },
    ],
  },
  {
    title: '📍 Público e Região',
    fields: [
      { key: 'publicoAlvo',     label: 'Descreva seu Público-Alvo',     multiline: true },
      { key: 'origemCliente',   label: 'De Onde Vêm os Clientes',       hint: 'Região, cidades, de fora do estado…' },
      { key: 'localAtendimento', label: 'Onde Você Atende / Ponto de Saída' },
      { key: 'precos',          label: 'Preços e Ticket / Mínimo',      multiline: true, hint: 'Valores praticados hoje' },
      { key: 'sazonalidade',    label: 'Sazonalidade',                  multiline: true, hint: 'Melhores épocas, dias mais fortes/fracos' },
      { key: 'naoClientes',     label: 'Tipos de Clientes que NÃO Deseja', multiline: true },
    ],
  },
  {
    title: '🎥 Conteúdo e Produção',
    fields: [
      { key: 'bancoImagens',       label: 'Tem Banco de Imagens/Vídeos?', type: 'choice', options: ['Sim', 'Precisamos renovar', 'Não'] },
      { key: 'arquivosMarca',      label: 'Tem Logo e Arquivos de Marca?', type: 'choice', options: ['Sim', 'Não'] },
      { key: 'gravacaoReal',       label: 'Podemos Gravar Durante o Atendimento Real?', type: 'choice', options: ['Sim', 'Não'] },
      { key: 'depoimentos',        label: 'Topa Depoimentos de Clientes?', type: 'choice', options: ['Sim', 'Não'] },
      { key: 'quemAparece',        label: 'Quem Pode Aparecer nos Vídeos', hint: 'Dono, equipe, clientes…' },
      { key: 'restricoesFilmagem', label: 'Restrições de Filmagem / Drone', multiline: true },
      { key: 'imagensProibidas',   label: 'O que NÃO Pode Aparecer',       multiline: true, hint: 'Cenas, produtos ou situações proibidas' },
    ],
  },
  {
    title: '🔑 Acessos às Redes',
    fields: [
      { key: 'igLogin',       label: 'Instagram (@)' },
      { key: 'igSenha',       label: 'Senha do Instagram',           sensitive: true },
      { key: 'fbLogin',       label: 'Facebook' },
      { key: 'fbSenha',       label: 'Senha do Facebook',            sensitive: true },
      { key: 'gmEmail',       label: 'E-mail do Google Meu Negócio' },
      { key: 'gmSenha',       label: 'Senha do Google Meu Negócio',  sensitive: true },
      { key: 'quemAdminRedes', label: 'Quem Administra as Redes Hoje' },
      { key: 'site',          label: 'Site e Plataformas' },
    ],
  },
  {
    title: '📝 Considerações Finais',
    fields: [
      { key: 'licencas',         label: 'Cadastur, Seguro e Licenças',  multiline: true },
      { key: 'particularidades', label: 'Particularidades Importantes', multiline: true },
      { key: 'infoAdicionais',   label: 'Observações Adicionais',       multiline: true },
    ],
  },
]

/** Todos os campos, achatados. */
export const BRIEFING_FIELDS: BriefingField[] = BRIEFING_SECTIONS.flatMap(s => s.fields)

/** Chaves de metadados gravadas pelo backend/form (não são perguntas). */
export const BRIEFING_META_KEYS = ['_objectives', '_hasMedia', '_submittedAt', '_clientName'] as const

export type BriefingData = Record<string, unknown>

export interface BriefingCompleteness {
  filled: number
  total: number
  pct: number
  missingRequired: string[]
}

const isFilled = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0

/**
 * Quanto do briefing está preenchido. Conta os campos (texto e escolha) + o
 * bloco de objetivos (conta como 1). Ignora metadados. `missingRequired` lista
 * os rótulos dos obrigatórios ainda em branco.
 */
export function briefingCompleteness(data: BriefingData | null | undefined): BriefingCompleteness {
  const total = BRIEFING_FIELDS.length + 1 // +1 pelo bloco de objetivos
  if (!data) return { filled: 0, total, pct: 0, missingRequired: [] }

  let filled = 0
  const missingRequired: string[] = []
  for (const f of BRIEFING_FIELDS) {
    if (isFilled(data[f.key])) filled++
    else if (f.required) missingRequired.push(f.label)
  }

  const objs = data._objectives
  if (Array.isArray(objs) && objs.length > 0) filled++
  else missingRequired.push('Objetivos')

  const pct = Math.round((filled / total) * 100)
  return { filled, total, pct, missingRequired }
}

export function briefingObjectives(data: BriefingData | null | undefined): string[] {
  const objs = data?._objectives
  return Array.isArray(objs) ? objs.filter((o): o is string => typeof o === 'string') : []
}

export function briefingSubmittedAt(data: BriefingData | null | undefined): number | null {
  const v = data?._submittedAt
  if (typeof v !== 'string') return null
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : null
}

/** Status de briefing de um cliente, do ponto de vista da equipe. */
export type BriefingStatus = 'preenchido' | 'aguardando' | 'nao_iniciado'

export function briefingStatus(hasToken: boolean, hasData: boolean): BriefingStatus {
  if (hasData) return 'preenchido'
  if (hasToken) return 'aguardando'
  return 'nao_iniciado'
}
