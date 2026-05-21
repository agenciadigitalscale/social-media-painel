import { useState, useCallback } from 'react'
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button,
  IconButton, Collapse, TextField, ToggleButtonGroup,
  ToggleButton, Tooltip, LinearProgress, Avatar, Badge,
  Divider, Stack, Paper,
} from '@mui/material'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import EditNoteIcon from '@mui/icons-material/EditNote'
import VideocamIcon from '@mui/icons-material/Videocam'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FilterListIcon from '@mui/icons-material/FilterList'
import type { Client } from '../types'
import { NAME_MAP, getDisplayName } from '../lib/users'

// ── Nicho de cada cliente ──────────────────────────────────────────────────
const NICHO: Record<string, string> = {
  'Casa de Ração 2 Irmãos':  'Pet Shop',
  'Chalés Alto da Represa':  'Turismo Rural',
  "Frango d'Água":           'Restaurante',
  'Hidro Elétrica Andrade':  'Elétrica / Solar',
  'Home Elevadores':         'Elevadores Residenciais',
  'Kátia Bigatello':         'Beleza / Maquiagem',
  'Lareiras Grill':          'Restaurante / Grill',
  'Luthita':                 'Moda Feminina',
  'LuzioPan':                'Fornecedor Panificação',
  'Magia dos Temáticos':     'Festas Temáticas',
  'Padaria R.A':             'Padaria Artesanal',
  'Pousada Dukuka':          'Hospedagem / Pousada',
  'Quero Bolo':              'Confeitaria',
  'ViniPlas':                'Comunicação Visual',
  'Rosângela Varas':         'Saúde / Medicina',
  'Compostela':              'Gastronomia',
  'Suh Maya':                'Música / Forró',
}

const NICHO_COLOR: Record<string, string> = {
  'Pet Shop':                  '#00C47A',
  'Turismo Rural':             '#3B8EFF',
  'Restaurante':               '#ff9039',
  'Elétrica / Solar':          '#FFD700',
  'Elevadores Residenciais':   '#C084FC',
  'Beleza / Maquiagem':        '#FB7185',
  'Restaurante / Grill':       '#ff5339',
  'Moda Feminina':             '#E879F9',
  'Fornecedor Panificação':    '#FBBF24',
  'Festas Temáticas':          '#34D399',
  'Padaria Artesanal':         '#F97316',
  'Hospedagem / Pousada':      '#60A5FA',
  'Confeitaria':               '#F472B6',
  'Comunicação Visual':        '#A78BFA',
  'Saúde / Medicina':          '#10B981',
  'Gastronomia':               '#EF4444',
  'Música / Forró':            '#FBBF24',
}

// ── Ideias pré-carregadas para Junho 2026 ─────────────────────────────────
type IdeaStatus = 'ideia' | 'producao' | 'filmado'

interface Ideia {
  id: string
  clientName: string
  title: string
  type: 'Post' | 'Reel'
  description: string
  status: IdeaStatus
  aiGenerated: boolean
}

const JUNHO_IDEAS: Ideia[] = [
  // Casa de Ração 2 Irmãos
  { id: 'jr001', clientName: 'Casa de Ração 2 Irmãos', type: 'Post', status: 'ideia', aiGenerated: false,
    title: '3 cuidados com pets no inverno',
    description: 'Roupinha, hidratação e alimentação reforçada. Mostrar os produtos disponíveis na loja.' },
  { id: 'jr002', clientName: 'Casa de Ração 2 Irmãos', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Seu pet tem frio? Veja o que fazer',
    description: 'Vídeo comparativo: pet sem roupa vs com roupa no inverno. CTA para ir à loja.' },
  { id: 'jr003', clientName: 'Casa de Ração 2 Irmãos', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Meme: pet na festa junina',
    description: 'Meme divertido: dono vai para o arraiá sem o pet. Reação engraçada. Alta viralização.' },

  // Chalés Alto da Represa
  { id: 'jr004', clientName: 'Chalés Alto da Represa', type: 'Post', status: 'ideia', aiGenerated: false,
    title: 'Por que o inverno é a melhor época na represa',
    description: 'Lareira, vista da represa no frio, silêncio da natureza. 3 razões com imagens.' },
  { id: 'jr005', clientName: 'Chalés Alto da Represa', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Tour chalé + lareira + vista inverno',
    description: 'Vídeo curto mostrando o chalé de manhã no frio: fumaça do café, lareira, vista.' },
  { id: 'jr006', clientName: 'Chalés Alto da Represa', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Bastidores surpresa Dia dos Namorados',
    description: 'Preparação do chalé decorado com pétalas e kit romântico. Antes e depois.' },

  // Frango d'Água
  { id: 'jr007', clientName: "Frango d'Água", type: 'Post', status: 'ideia', aiGenerated: false,
    title: '3 razões para o jantar de Dia dos Namorados aqui',
    description: 'Ambiente, frango artesanal e atendimento especial. Texto + foto do prato.' },
  { id: 'jr008', clientName: "Frango d'Água", type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Segredo do frango crocante por fora e suculento por dentro',
    description: 'Mostrar o preparo: tempero, brasa, corte. Técnica que diferencia o restaurante.' },
  { id: 'jr009', clientName: "Frango d'Água", type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Cardápio de inverno — novidades dessa semana',
    description: 'Apresentação dos pratos novos com voz over e close nos pratos. Urgência do mês.' },

  // Hidro Elétrica Andrade
  { id: 'jr010', clientName: 'Hidro Elétrica Andrade', type: 'Post', status: 'ideia', aiGenerated: false,
    title: 'Inverno = conta de luz mais alta. Como evitar?',
    description: 'Dica educativa: aquecedor + chuveiro elétrico no inverno. Solução: painéis solares.' },
  { id: 'jr011', clientName: 'Hidro Elétrica Andrade', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Instalação solar em 1 dia — time lapse',
    description: 'Gravar a equipe instalando do início ao fim em um dia. Acelerar para 60 seg.' },
  { id: 'jr012', clientName: 'Hidro Elétrica Andrade', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Bastidores: equipe de campo em ação',
    description: 'Mostrar o dia a dia da equipe — segurança, profissionalismo, resultado final.' },

  // Home Elevadores
  { id: 'jr013', clientName: 'Home Elevadores', type: 'Post', status: 'ideia', aiGenerated: false,
    title: 'Instalar elevador sem obra pesada — é possível?',
    description: 'Quebrar objeção principal. Mostrar modelos compactos e o processo limpo de instalação.' },
  { id: 'jr014', clientName: 'Home Elevadores', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Instalação de elevador compacto em 60 segundos',
    description: 'Time lapse da instalação do início ao fim. Mostrar o elevador funcionando ao final.' },
  { id: 'jr015', clientName: 'Home Elevadores', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Cliente conta: como o elevador mudou a rotina',
    description: 'Entrevista espontânea com cliente real. Foco em mobilidade, idosos e acessibilidade.' },

  // Kátia Bigatello
  { id: 'jr016', clientName: 'Kátia Bigatello', type: 'Post', status: 'ideia', aiGenerated: false,
    title: '3 cores de make que combinam com o inverno brasileiro',
    description: 'Tons terrosos, uva e bege. Quais produtos usar. Dica de skincare para o frio.' },
  { id: 'jr017', clientName: 'Kátia Bigatello', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Tutorial: make para festa junina do zero',
    description: 'Base, iluminador, lábio vermelho/laranja, olho marcado. Estilo country chic.' },
  { id: 'jr018', clientName: 'Kátia Bigatello', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Transformação: dia natural → noturno romântico',
    description: 'Dia dos Namorados: make simples de dia virada para look sexy noturno. Transição.' },

  // Lareiras Grill
  { id: 'jr019', clientName: 'Lareiras Grill', type: 'Post', status: 'ideia', aiGenerated: false,
    title: 'Inverno + fondue + lareira = combinação perfeita',
    description: 'Texto emocional sobre o ambiente. CTA para reserva. Foto do ambiente com fogo.' },
  { id: 'jr020', clientName: 'Lareiras Grill', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Meme: o que eu peço vs o que meu parceiro pede',
    description: 'Humor no Dia dos Namorados. Dois pratos opostos no mesmo restaurante. Alto engajamento.' },
  { id: 'jr021', clientName: 'Lareiras Grill', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Bastidores: ceia de São João nos bastidores',
    description: 'Cozinha preparando os pratos típicos. Chef apresentando o menu. Clima junino.' },

  // Luthita
  { id: 'jr022', clientName: 'Luthita', type: 'Post', status: 'ideia', aiGenerated: false,
    title: '5 peças de inverno que combinam com tudo',
    description: 'Guia de compras: casaco, blazer, tricô, calça e bota. Looks montados com cada peça.' },
  { id: 'jr023', clientName: 'Luthita', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Haul de inverno: chegaram coisas novas!',
    description: 'Mostrar as peças novas chegando na loja. Experimentar ao vivo. Preços no final.' },
  { id: 'jr024', clientName: 'Luthita', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Look para festa junina com peças Luthita',
    description: 'Montar um look completo country com roupas da loja. Styling rápido e acessível.' },

  // LuzioPan
  { id: 'jr025', clientName: 'LuzioPan', type: 'Post', status: 'ideia', aiGenerated: false,
    title: 'Dono de padaria: quanto você pode lucrar a mais em junho?',
    description: 'Dados sobre festas juninas e consumo de padaria. Posicionar Prodipanni como solução.' },
  { id: 'jr026', clientName: 'LuzioPan', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Bolo de milho perfeito com Prodipanni — do zero ao desenforme',
    description: 'Receita passo a passo. Mostrar a facilidade do mix. Close no desenforme perfeito.' },
  { id: 'jr027', clientName: 'LuzioPan', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'MEME: sua padaria no arraiá vs a concorrência',
    description: 'Formato comparativo humor. Padaria preparada (Prodipanni) vs sem preparação. Viral.' },

  // Magia dos Temáticos
  { id: 'jr028', clientName: 'Magia dos Temáticos', type: 'Post', status: 'ideia', aiGenerated: false,
    title: 'Sua empresa vai fazer festa junina? A gente resolve tudo',
    description: 'B2B: atingir empresas e eventos corporativos. Listar serviços: decoração, buffet, forró.' },
  { id: 'jr029', clientName: 'Magia dos Temáticos', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Antes e depois: decoração junina completa',
    description: 'Salão vazio → salão decorado com bandeirinhas, palha, forró. Timelapse + música.' },
  { id: 'jr030', clientName: 'Magia dos Temáticos', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Meme: arraiá com Magia dos Temáticos vs sem',
    description: 'Comparação humorística. Viralização alta. CTA para orçamento no final.' },

  // Padaria R.A
  { id: 'jr031', clientName: 'Padaria R.A', type: 'Post', status: 'ideia', aiGenerated: false,
    title: 'Pão na chapa + café quentinho = melhor dupla do inverno',
    description: 'Foto do pão fresco com café fumegando. Emocional e aconchegante. Horário de abertura.' },
  { id: 'jr032', clientName: 'Padaria R.A', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'A melhor cuca de festa junina — como fazemos',
    description: 'Receita em vídeo curto. Mostrar a textura. Corte ao vivo. Convite para comprar.' },
  { id: 'jr033', clientName: 'Padaria R.A', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Vem tomar um quentão aqui na padaria',
    description: 'Convite descontraído. Câmera na mão andando pela padaria. Clima de São João.' },

  // Pousada Dukuka
  { id: 'jr034', clientName: 'Pousada Dukuka', type: 'Post', status: 'ideia', aiGenerated: false,
    title: '10 razões para passar o São João na Pousada Dukuka',
    description: 'Fogueira, quadrilha, chalé, café da manhã, natureza. Carrossel. CTA para reservar.' },
  { id: 'jr035', clientName: 'Pousada Dukuka', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Kaique influencer: review honesto da estadia de inverno',
    description: 'Kaique da Digital Scale como influencer visitando a pousada. Opinião autêntica.' },
  { id: 'jr036', clientName: 'Pousada Dukuka', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Surpresa de Dia dos Namorados: chalé decorado + café especial',
    description: 'Mostrar a decoração sendo feita antes do casal chegar. Reação ao entrar no quarto.' },

  // Quero Bolo
  { id: 'jr037', clientName: 'Quero Bolo', type: 'Post', status: 'ideia', aiGenerated: false,
    title: 'Bolo de milho artesanal vs industrial: a diferença é real',
    description: 'Comparação visual e de ingredientes. Posicionar o artesanal como superior. Convencer.' },
  { id: 'jr038', clientName: 'Quero Bolo', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Bolo de arraiá do zero — timelapse da decoração',
    description: 'Gravar a montagem do bolo temático de São João. Xadrez, bandeirinhas, cores de festa.' },
  { id: 'jr039', clientName: 'Quero Bolo', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Tutorial: bolo Dia dos Namorados com decoração de casal',
    description: 'Bolo two-tone, coração, nome do casal. Rápido e detalhado. CTA para encomendar.' },

  // ViniPlas
  { id: 'jr040', clientName: 'ViniPlas', type: 'Post', status: 'ideia', aiGenerated: false,
    title: 'Como adesivos temáticos aumentam o fluxo na festa junina',
    description: 'Cases de clientes com vinil decorativo. Antes e depois. ROI visual para quem decidir.' },
  { id: 'jr041', clientName: 'ViniPlas', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Fachada personalizada para o São João — antes e depois',
    description: 'Empresa cliente recebe decoração temática em vinil. Aplicação ao vivo + resultado.' },
  { id: 'jr042', clientName: 'ViniPlas', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Da arte à aplicação — processo completo',
    description: 'Mostrar design no computador → impressão → corte → aplicação. Profissionalismo.' },

  // Rosângela Varas
  { id: 'jr043', clientName: 'Rosângela Varas', type: 'Post', status: 'ideia', aiGenerated: false,
    title: 'Festa junina e saúde: o que comer sem sair da dieta',
    description: 'Guia dos alimentos juninos mais saudáveis. O que evitar. Dra. dando permissão consciente.' },
  { id: 'jr044', clientName: 'Rosângela Varas', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Inverno e metabolismo: por que engordamos mais no frio?',
    description: 'Explicação científica acessível. Termorregulação e apetite. CTA para consulta.' },
  { id: 'jr045', clientName: 'Rosângela Varas', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Paciente com 3 meses de acompanhamento: resultado real',
    description: 'Com autorização: antes e depois de paciente. Humanizar o tratamento médico.' },

  // Compostela
  { id: 'jr046', clientName: 'Compostela', type: 'Post', status: 'ideia', aiGenerated: false,
    title: 'Jantar de Dia dos Namorados: por que o Compostela é a escolha certa',
    description: 'Ambiente, vinho, prato especial, luz íntima. 4 razões em carrossel. Mesa limitada.' },
  { id: 'jr047', clientName: 'Compostela', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'O ambiente do Compostela em noite fria de inverno',
    description: 'Câmera passeando pelo restaurante à noite. Luzes quentes, música suave, mesas elegantes.' },
  { id: 'jr048', clientName: 'Compostela', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Chef revela: o prato mais pedido do inverno',
    description: 'Entrevista com o chef. Ele mostra o preparo do prato mais popular. Bastidores reais.' },

  // Suh Maya
  { id: 'jr049', clientName: 'Suh Maya', type: 'Post', status: 'ideia', aiGenerated: false,
    title: 'Agenda de shows: São João 2026 — onde vou estar',
    description: 'Carrossel com datas, cidades e contato para contratação. Aquece o mês de junho.' },
  { id: 'jr050', clientName: 'Suh Maya', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'Aquecimento para festa junina: cante junto comigo',
    description: 'Suh cantando um trecho animado. Pede para completar nos comentários. Engajamento alto.' },
  { id: 'jr051', clientName: 'Suh Maya', type: 'Reel', status: 'ideia', aiGenerated: false,
    title: 'TBT: o show que todo mundo ainda pede pra repetir',
    description: 'Clipe de bastidores de um show inesquecível. Nostalgia + teaser de novo show.' },
]

const STATUS_LABEL: Record<IdeaStatus, string> = {
  ideia:    '💡 Ideia',
  producao: '✏️ Em produção',
  filmado:  '🎬 Filmado',
}
const STATUS_COLOR: Record<IdeaStatus, 'default' | 'warning' | 'success'> = {
  ideia:    'default',
  producao: 'warning',
  filmado:  'success',
}

const STORAGE_KEY = 'sm_roteiro_ideias_junho_2026'

function loadIdeas(): Ideia[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Ideia[]
  } catch { /* ignore */ }
  return JUNHO_IDEAS.map(i => ({ ...i }))
}

function saveIdeas(ideas: Ideia[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas)) } catch { /* ignore */ }
}

interface Props {
  allClients: Client[]
}

export default function RoteirosIdeaTab({ allClients }: Props) {
  const [ideas, setIdeas]               = useState<Ideia[]>(loadIdeas)
  const [expanded, setExpanded]         = useState<Record<string, boolean>>({})
  const [aiLoading, setAiLoading]       = useState<Record<string, boolean>>({})
  const [noteText, setNoteText]         = useState<Record<string, string>>({})
  const [filterType, setFilterType]     = useState<'all' | 'Post' | 'Reel'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | IdeaStatus>('all')
  const [copied, setCopied]             = useState<string | null>(null)

  const geovana = NAME_MAP['geovana']
  const kerges  = NAME_MAP['kerges']

  const updateIdea = (id: string, patch: Partial<Ideia>) => {
    const updated = ideas.map(i => i.id === id ? { ...i, ...patch } : i)
    setIdeas(updated)
    saveIdeas(updated)
  }

  const addIdea = (idea: Ideia) => {
    const updated = [...ideas, idea]
    setIdeas(updated)
    saveIdeas(updated)
  }

  const generateAI = useCallback(async (clientName: string) => {
    const nicho = NICHO[clientName] ?? clientName
    setAiLoading(prev => ({ ...prev, [clientName]: true }))
    try {
      const existing = ideas.filter(i => i.clientName === clientName).map(i => i.title).join(', ')
      const prompt = `Você é um estrategista de conteúdo para redes sociais. Gere 3 NOVAS ideias de roteiro para o cliente "${clientName}" (nicho: ${nicho}) para junho de 2026.
Contexto de junho: Dia dos Namorados (12/6), Festa Junina / São João (24/6), inverno, férias escolares em julho.
Ideias já existentes (não repita): ${existing}

Responda APENAS com um JSON válido neste formato, sem markdown nem explicação extra:
[
  { "title": "...", "type": "Reel", "description": "..." },
  { "title": "...", "type": "Post", "description": "..." },
  { "title": "...", "type": "Reel", "description": "..." }
]`
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json() as { response?: string }
      const text = data.response ?? ''
      const match = text.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('No JSON')
      const parsed = JSON.parse(match[0]) as { title: string; type: string; description: string }[]
      parsed.forEach((p, i) => {
        addIdea({
          id: `ai-${clientName}-${Date.now()}-${i}`,
          clientName,
          title: p.title,
          type: (p.type === 'Post' || p.type === 'Reel') ? p.type : 'Reel',
          description: p.description,
          status: 'ideia',
          aiGenerated: true,
        })
      })
    } catch {
      // silently ignore — network might be unavailable
    } finally {
      setAiLoading(prev => ({ ...prev, [clientName]: false }))
    }
  }, [ideas])

  const copyRoteiro = (idea: Ideia) => {
    const note = noteText[idea.id] ?? ''
    const text = `📋 ROTEIRO — ${idea.clientName}\n🎬 ${idea.type}: ${idea.title}\n\n${idea.description}${note ? `\n\n📝 Notas:\n${note}` : ''}`
    navigator.clipboard.writeText(text).catch(() => null)
    setCopied(idea.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const clientNames = allClients.map(c => c.name)

  const filteredIdeas = ideas.filter(i => {
    if (filterType !== 'all' && i.type !== filterType) return false
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    return true
  })

  const ideasByClient = clientNames.reduce<Record<string, Ideia[]>>((acc, name) => {
    acc[name] = filteredIdeas.filter(i => i.clientName === name)
    return acc
  }, {})

  const totalFilmado  = ideas.filter(i => i.status === 'filmado').length
  const totalProducao = ideas.filter(i => i.status === 'producao').length
  const totalIdeia    = ideas.filter(i => i.status === 'ideia').length

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3.5 }, maxWidth: 1800, mx: 'auto' }}>

      {/* ── Header ── */}
      <Paper sx={{
        p: { xs: 2, md: 2.5, xl: 3 },
        mb: 3,
        background: 'linear-gradient(135deg, rgba(251,113,133,0.12) 0%, rgba(59,142,255,0.12) 100%)',
        border: '1px solid rgba(251,113,133,0.2)',
        borderRadius: 3,
      }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" gap={2}>
          <Box>
            <Stack direction="row" alignItems="center" gap={1.5} mb={0.5}>
              <EditNoteIcon sx={{ color: '#FB7185', fontSize: { xs: '1.4rem', xl: '1.8rem' } }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: '1.1rem', xl: '1.5rem' } }}>
                Central de Roteiros — Junho 2026
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.78rem', xl: '0.95rem' } }}>
              Ideias pré-carregadas por cliente · Geração via IA · Controle de produção
            </Typography>
          </Box>

          {/* Equipe responsável */}
          <Stack direction="row" gap={1.5} flexWrap="wrap">
            {(['geovana', 'kerges'] as const).map(key => {
              const u = NAME_MAP[key]
              return (
                <Chip
                  key={key}
                  avatar={<Avatar sx={{ bgcolor: u.color, fontSize: '0.75rem' }}>{u.emoji}</Avatar>}
                  label={`${getDisplayName(key)} · ${u.role}`}
                  size="small"
                  sx={{
                    bgcolor: `${u.color}18`,
                    border: `1px solid ${u.color}40`,
                    color: u.color,
                    fontWeight: 600,
                    fontSize: { xs: '0.72rem', xl: '0.85rem' },
                  }}
                />
              )
            })}
          </Stack>
        </Stack>

        {/* KPIs rápidos */}
        <Stack direction="row" gap={2} mt={2} flexWrap="wrap">
          {[
            { label: 'Ideias',        count: totalIdeia,    color: '#888' },
            { label: 'Em produção',   count: totalProducao, color: '#FFD700' },
            { label: 'Filmados',      count: totalFilmado,  color: '#00C47A' },
            { label: 'Total roteiros',count: ideas.length,  color: '#FB7185' },
          ].map(({ label, count, color }) => (
            <Box key={label} sx={{ textAlign: 'center', minWidth: 70 }}>
              <Typography sx={{ fontSize: { xs: '1.4rem', xl: '2rem' }, fontWeight: 800, color, lineHeight: 1 }}>
                {count}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', xl: '0.78rem' } }}>
                {label}
              </Typography>
            </Box>
          ))}
          <Box sx={{ flex: 1, minWidth: 120 }}>
            <LinearProgress
              variant="determinate"
              value={ideas.length ? (totalFilmado / ideas.length) * 100 : 0}
              sx={{
                mt: 1.5, height: 6, borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.08)',
                '& .MuiLinearProgress-bar': { bgcolor: '#00C47A', borderRadius: 3 },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
              {Math.round(ideas.length ? (totalFilmado / ideas.length) * 100 : 0)}% filmados
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* ── Filtros ── */}
      <Stack direction="row" gap={1.5} mb={3} flexWrap="wrap" alignItems="center">
        <FilterListIcon sx={{ color: 'text.secondary', fontSize: '1.1rem' }} />
        <ToggleButtonGroup
          value={filterType}
          exclusive
          size="small"
          onChange={(_, v) => { if (v) setFilterType(v) }}
          sx={{ '& .MuiToggleButton-root': { fontSize: { xs: '0.7rem', xl: '0.82rem' }, py: 0.4, px: 1.2 } }}
        >
          <ToggleButton value="all">Todos</ToggleButton>
          <ToggleButton value="Post">📷 Post</ToggleButton>
          <ToggleButton value="Reel">🎬 Reel</ToggleButton>
        </ToggleButtonGroup>
        <ToggleButtonGroup
          value={filterStatus}
          exclusive
          size="small"
          onChange={(_, v) => { if (v) setFilterStatus(v) }}
          sx={{ '& .MuiToggleButton-root': { fontSize: { xs: '0.7rem', xl: '0.82rem' }, py: 0.4, px: 1.2 } }}
        >
          <ToggleButton value="all">Todos</ToggleButton>
          <ToggleButton value="ideia">💡 Ideia</ToggleButton>
          <ToggleButton value="producao">✏️ Produção</ToggleButton>
          <ToggleButton value="filmado">🎬 Filmado</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* ── Grade de clientes ── */}
      <Grid container spacing={{ xs: 1.5, md: 2, xl: 2.5 }}>
        {clientNames.map(clientName => {
          const nicho       = NICHO[clientName] ?? '–'
          const nichoColor  = NICHO_COLOR[nicho] ?? '#888'
          const clientIdeas = ideasByClient[clientName] ?? []
          const isExpanded  = expanded[clientName] ?? false
          const isLoading   = aiLoading[clientName] ?? false
          const filmed      = clientIdeas.filter(i => i.status === 'filmado').length

          return (
            <Grid item xs={12} md={6} xl={4} key={clientName}>
              <Card sx={{
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: isExpanded ? `${nichoColor}40` : 'rgba(255,255,255,0.06)',
                borderRadius: 2.5,
                transition: 'border-color 0.2s',
                '&:hover': { borderColor: `${nichoColor}30` },
              }}>
                <CardContent sx={{ p: { xs: 1.5, xl: 2.5 }, '&:last-child': { pb: { xs: 1.5, xl: 2.5 } } }}>

                  {/* Card header */}
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1}>
                    <Box sx={{ flex: 1, mr: 1 }}>
                      <Typography fontWeight={700} sx={{ fontSize: { xs: '0.85rem', xl: '1rem' }, lineHeight: 1.3 }}>
                        {clientName}
                      </Typography>
                      <Chip
                        label={nicho}
                        size="small"
                        sx={{
                          mt: 0.5,
                          height: 18,
                          fontSize: '0.65rem',
                          bgcolor: `${nichoColor}18`,
                          color: nichoColor,
                          border: `1px solid ${nichoColor}30`,
                        }}
                      />
                    </Box>
                    <Stack direction="row" alignItems="center" gap={0.5}>
                      <Badge badgeContent={filmed} color="success" max={99}>
                        <Chip
                          label={`${clientIdeas.length} ideias`}
                          size="small"
                          sx={{ fontSize: '0.65rem', height: 20 }}
                        />
                      </Badge>
                      <IconButton size="small" onClick={() => setExpanded(prev => ({ ...prev, [clientName]: !prev[clientName] }))}>
                        {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </IconButton>
                    </Stack>
                  </Stack>

                  {/* Preview de ideias (colapsado) */}
                  {!isExpanded && clientIdeas.length > 0 && (
                    <Stack gap={0.5}>
                      {clientIdeas.slice(0, 2).map(idea => (
                        <Stack key={idea.id} direction="row" alignItems="center" gap={0.8}>
                          <Typography sx={{ fontSize: '0.7rem', opacity: 0.5 }}>
                            {idea.type === 'Reel' ? '🎬' : '📷'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, fontSize: '0.72rem' }}>
                            {idea.title}
                          </Typography>
                          <Chip
                            label={idea.status === 'ideia' ? '💡' : idea.status === 'producao' ? '✏️' : '✅'}
                            size="small"
                            sx={{ height: 16, fontSize: '0.6rem', minWidth: 24, px: 0 }}
                          />
                        </Stack>
                      ))}
                      {clientIdeas.length > 2 && (
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', pl: 2.5 }}>
                          +{clientIdeas.length - 2} mais…
                        </Typography>
                      )}
                    </Stack>
                  )}

                  {/* Expandido */}
                  <Collapse in={isExpanded}>
                    <Divider sx={{ my: 1.5 }} />
                    <Stack gap={1}>
                      {clientIdeas.map(idea => (
                        <Paper key={idea.id} sx={{
                          p: 1.2,
                          bgcolor: idea.aiGenerated ? 'rgba(59,142,255,0.06)' : 'rgba(255,255,255,0.04)',
                          border: '1px solid',
                          borderColor: idea.status === 'filmado'
                            ? 'rgba(0,196,122,0.25)'
                            : idea.status === 'producao'
                              ? 'rgba(255,215,0,0.25)'
                              : 'rgba(255,255,255,0.08)',
                          borderRadius: 1.5,
                        }}>
                          <Stack direction="row" alignItems="flex-start" gap={0.8} mb={0.5}>
                            <Typography sx={{ fontSize: '0.8rem', mt: 0.1 }}>
                              {idea.type === 'Reel' ? '🎬' : '📷'}
                            </Typography>
                            <Box sx={{ flex: 1 }}>
                              <Typography fontWeight={600} sx={{ fontSize: { xs: '0.78rem', xl: '0.88rem' }, lineHeight: 1.3 }}>
                                {idea.title}
                                {idea.aiGenerated && (
                                  <Chip label="IA" size="small" sx={{ ml: 0.5, height: 14, fontSize: '0.55rem', bgcolor: 'rgba(59,142,255,0.2)', color: '#3B8EFF', px: 0 }} />
                                )}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', xl: '0.78rem' } }}>
                                {idea.description}
                              </Typography>
                            </Box>
                          </Stack>

                          {/* Caixa de notas */}
                          <TextField
                            size="small"
                            multiline
                            minRows={1}
                            maxRows={4}
                            placeholder="Anotações de roteiro..."
                            value={noteText[idea.id] ?? ''}
                            onChange={e => setNoteText(prev => ({ ...prev, [idea.id]: e.target.value }))}
                            sx={{
                              mb: 1, width: '100%',
                              '& .MuiInputBase-input': { fontSize: '0.72rem' },
                              '& .MuiOutlinedInput-root': { borderRadius: 1 },
                            }}
                          />

                          {/* Ações */}
                          <Stack direction="row" gap={0.6} flexWrap="wrap" alignItems="center">
                            {(['ideia', 'producao', 'filmado'] as IdeaStatus[]).map(st => (
                              <Chip
                                key={st}
                                label={STATUS_LABEL[st]}
                                size="small"
                                color={STATUS_COLOR[st]}
                                variant={idea.status === st ? 'filled' : 'outlined'}
                                clickable
                                onClick={() => updateIdea(idea.id, { status: st })}
                                sx={{ height: 20, fontSize: '0.62rem' }}
                              />
                            ))}
                            <Box sx={{ flex: 1 }} />
                            <Tooltip title={copied === idea.id ? 'Copiado!' : 'Copiar roteiro'}>
                              <IconButton size="small" onClick={() => copyRoteiro(idea)} sx={{ p: 0.3 }}>
                                {copied === idea.id
                                  ? <CheckCircleIcon sx={{ fontSize: '0.9rem', color: '#00C47A' }} />
                                  : <ContentCopyIcon sx={{ fontSize: '0.9rem' }} />}
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>

                    {/* Botão gerar IA */}
                    <Button
                      fullWidth
                      size="small"
                      variant="outlined"
                      startIcon={isLoading ? undefined : <AutoAwesomeIcon />}
                      onClick={() => generateAI(clientName)}
                      disabled={isLoading}
                      sx={{
                        mt: 1.5,
                        fontSize: '0.72rem',
                        borderColor: 'rgba(59,142,255,0.4)',
                        color: '#3B8EFF',
                        '&:hover': { borderColor: '#3B8EFF', bgcolor: 'rgba(59,142,255,0.08)' },
                      }}
                    >
                      {isLoading ? 'Gerando ideias com IA…' : 'Gerar mais ideias com IA'}
                    </Button>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>

      <Box sx={{ height: 80 }} />
    </Box>
  )
}
