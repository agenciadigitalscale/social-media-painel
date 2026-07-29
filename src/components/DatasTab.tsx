import React from 'react'
import {
  Box, Typography, Paper, Chip, Tooltip, Stack,
  ToggleButtonGroup, ToggleButton,
} from '@mui/material'
import EventIcon from '@mui/icons-material/Event'
import EmptyState from '../shared/ui/EmptyState'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

// ── Types ─────────────────────────────────────────────────────────────────────

type Categoria =
  | 'comercial'     // Datas com alto potencial de vendas
  | 'feriado'       // Feriado nacional
  | 'conscientizacao' // Causas, saúde, diversidade
  | 'sazonal'       // Estações, início de período
  | 'entretenimento' // Halloween, carnaval, festas

interface DataComem {
  id: string
  nome: string
  categoria: Categoria
  descricao: string
  dica: string        // Sugestão de conteúdo
  destaque?: boolean  // Datas de alto impacto para agências
}

// ── Paleta por categoria ───────────────────────────────────────────────────────

const CAT_CFG: Record<Categoria, { label: string; color: string; bg: string; border: string }> = {
  comercial:        { label: '🛍️ Comercial',       color: DS.accent, bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)'  },
  feriado:          { label: '🎉 Feriado',          color: DS.green, bg: 'rgba(49,209,124,0.09)', border: 'rgba(49,209,124,0.28)'  },
  conscientizacao:  { label: '💙 Conscientização',  color: DS.accent, bg: 'rgba(59,130,246,0.09)', border: 'rgba(59,130,246,0.28)' },
  sazonal:          { label: '🌿 Sazonal',          color: '#C084FC', bg: 'rgba(192,132,252,0.09)', border: 'rgba(192,132,252,0.28)' },
  entretenimento:   { label: '🎭 Entretenimento',   color: '#FB7185', bg: 'rgba(251,113,133,0.09)', border: 'rgba(251,113,133,0.28)' },
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// ── Cálculo de Páscoa (algoritmo anônimo gregoriano) ────────────────────────

function calcEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  // n-th weekday (0=Sun) of given month
  const first = new Date(year, month, 1)
  const diff = (weekday - first.getDay() + 7) % 7
  return new Date(year, month, 1 + diff + (n - 1) * 7)
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0)
  const diff = (last.getDay() - weekday + 7) % 7
  return new Date(year, month, last.getDate() - diff)
}

// ── Gerador de datas do ano ───────────────────────────────────────────────────

interface ResolvedDate {
  date: Date
  data: DataComem
}

function getDatasDoAno(year: number): ResolvedDate[] {
  const easter = calcEaster(year)
  const easterMs = easter.getTime()

  const fixed = (month: number, day: number): Date => new Date(year, month, day)
  const offset = (base: Date, days: number): Date => new Date(base.getTime() + days * 86400000)

  const list: Array<{ date: Date } & DataComem> = [
    // ─── JANEIRO ──────────────────────────────────────────────
    {
      date: fixed(0, 1), id:'ano-novo', nome:'🎆 Ano Novo', categoria:'feriado',
      destaque: true,
      descricao:'Confraternização Universal — feriado nacional.',
      dica:'Crie posts de "chegada do ano", metas 2026, retrospectiva do ano anterior.',
    },
    {
      date: fixed(0, 6), id:'dia-reis', nome:'Dia de Reis', categoria:'sazonal',
      descricao:'Tradicional dia dos Três Reis Magos.',
      dica:'Bom para marcas religiosas ou de família.',
    },
    {
      date: fixed(0, 25), id:'dia-turismo', nome:'🏖️ Dia do Turismo', categoria:'comercial',
      descricao:'Promova experiências, viagens e lazer.',
      dica:'Para clientes de turismo, gastronomia e entretenimento.',
    },

    // ─── FEVEREIRO ────────────────────────────────────────────
    {
      date: offset(easter, -47), id:'carnaval', nome:'🎭 Carnaval', categoria:'entretenimento',
      destaque: true,
      descricao:'Terça-feira de Carnaval — grande festa popular brasileira.',
      dica:'Posts de fantasia, comemoração, bastidores da equipe. Ótimo para engajamento.',
    },
    {
      date: fixed(1, 9), id:'dia-atleta', nome:'🏃 Dia do Atleta', categoria:'conscientizacao',
      descricao:'Celebração do esporte e do atletismo.',
      dica:'Para academias, nutricionistas, suplementação.',
    },

    // ─── MARÇO ────────────────────────────────────────────────
    {
      date: fixed(2, 8), id:'dia-mulher', nome:'👩 Dia da Mulher', categoria:'comercial',
      destaque: true,
      descricao:'Dia Internacional da Mulher — alto potencial comercial e de conscientização.',
      dica:'Posts de empoderamento, promoções para mulheres, homenagens. Engajamento altíssimo.',
    },
    {
      date: fixed(2, 15), id:'dia-consumidor', nome:'🛒 Dia do Consumidor', categoria:'comercial',
      destaque: true,
      descricao:'Excelente data para promoções e campanhas de vendas.',
      dica:'Promoções relâmpago, fidelidade, depoimentos de clientes.',
    },
    {
      date: fixed(2, 20), id:'primeiro-outono', nome:'🍂 Início do Outono', categoria:'sazonal',
      descricao:'Equinócio de outono — início oficial da estação.',
      dica:'Posts sazonais, mudança de cardápio (gastronomia), moda de transição.',
    },
    {
      date: fixed(2, 21), id:'dia-poesia', nome:'📝 Dia da Poesia', categoria:'conscientizacao',
      descricao:'Dia Mundial da Poesia.',
      dica:'Copys criativos, frases impactantes para qualquer nicho.',
    },

    // ─── ABRIL ────────────────────────────────────────────────
    {
      date: fixed(3, 1), id:'dia-mentiras', nome:'😂 Dia das Mentiras', categoria:'entretenimento',
      descricao:'Dia do humor e das pegadinhas.',
      dica:'Post de humor leve, "fake news" divertida sobre a marca, engajamento alto.',
    },
    {
      date: fixed(3, 7), id:'dia-saude', nome:'💊 Dia da Saúde', categoria:'conscientizacao',
      descricao:'Dia Mundial da Saúde — fundação da OMS.',
      dica:'Para clínicas, academias, nutricionistas, bem-estar.',
    },
    {
      date: offset(easter, -2), id:'sexta-santa', nome:'✝️ Sexta-Feira Santa', categoria:'feriado',
      descricao:'Feriado nacional — Paixão de Cristo.',
      dica:'Respeite o tom. Para marcas religiosas: conteúdo de reflexão.',
    },
    {
      date: easter, id:'pascoa', nome:'🐣 Páscoa', categoria:'comercial',
      destaque: true,
      descricao:'Páscoa — data altíssima para vendas de chocolate, cestinhas e família.',
      dica:'Chocolates, cestas, promoções de família, decoração. Prepare 2 semanas antes.',
    },
    {
      date: fixed(3, 20), id:'dia-terra', nome:'🌍 Dia da Terra', categoria:'conscientizacao',
      descricao:'Dia Mundial da Terra — sustentabilidade.',
      dica:'Ações sustentáveis da marca, conteúdo verde, responsabilidade ambiental.',
    },
    {
      date: fixed(3, 21), id:'tiradentes', nome:'⚔️ Tiradentes', categoria:'feriado',
      descricao:'Feriado nacional — mártir da independência.',
      dica:'Conteúdo histórico leve ou apenas comunicar horários.',
    },
    {
      date: fixed(3, 23), id:'dia-livro', nome:'📚 Dia do Livro', categoria:'conscientizacao',
      descricao:'Dia Mundial do Livro e dos Direitos de Autor.',
      dica:'Para livrarias, educação, coaching. "O livro que mudou minha carreira".',
    },

    // ─── MAIO ─────────────────────────────────────────────────
    {
      date: fixed(4, 1), id:'dia-trabalho', nome:'👷 Dia do Trabalho', categoria:'feriado',
      descricao:'Feriado nacional — celebração dos trabalhadores.',
      dica:'Homenagem à equipe, bastidores do trabalho da agência/cliente.',
    },
    {
      date: nthWeekday(year, 4, 0, 2), id:'dia-maes', nome:'💐 Dia das Mães', categoria:'comercial',
      destaque: true,
      descricao:'Uma das maiores datas comerciais do Brasil — 2º domingo de maio.',
      dica:'Presentes, depoimentos de mães, campanha emocional. Começar 3 semanas antes!',
    },
    {
      date: fixed(4, 12), id:'dia-flores', nome:'🌸 Dia das Flores', categoria:'comercial',
      descricao:'Dia Nacional das Flores.',
      dica:'Para floriculturas, eventos, decoração, presenteáveis.',
    },
    {
      date: fixed(4, 5), id:'dia-meio-ambiente', nome:'🌱 Dia do Meio Ambiente', categoria:'conscientizacao',
      descricao:'Dia Mundial do Meio Ambiente (é 5 de junho — movido para maio neste calendário).',
      dica:'Veja junho para a data real.',
    },
    {
      date: fixed(4, 25), id:'dia-comerciante', nome:'💼 Dia do Comerciante', categoria:'comercial',
      descricao:'Dia Nacional do Comerciante.',
      dica:'Para lojas, comércios, autônomos.',
    },

    // ─── JUNHO ────────────────────────────────────────────────
    {
      date: fixed(5, 5), id:'dia-meio-ambiente-real', nome:'🌍 Dia do Meio Ambiente', categoria:'conscientizacao',
      descricao:'Dia Mundial do Meio Ambiente.',
      dica:'Ações sustentáveis, reciclagem, conteúdo verde.',
    },
    {
      date: offset(easter, 60), id:'corpus-christi', nome:'✝️ Corpus Christi', categoria:'feriado',
      descricao:'Feriado nacional — 60 dias após a Páscoa.',
      dica:'Comunique horários alternativos.',
    },
    {
      date: fixed(5, 12), id:'dia-namorados', nome:'💕 Dia dos Namorados', categoria:'comercial',
      destaque: true,
      descricao:'Principal data romântica do Brasil — 12 de junho.',
      dica:'Combos para casais, jantar especial, presenteáveis, experiências. Prepare 2-3 semanas antes!',
    },
    {
      date: fixed(5, 13), id:'santo-antonio', nome:'💒 Santo Antônio', categoria:'sazonal',
      descricao:'Festa do padroeiro dos namorados — Festa Junina começa.',
      dica:'Para bares, restaurantes, eventos: quadrilha, forró, comidas típicas.',
    },
    {
      date: fixed(5, 24), id:'festa-sao-joao', nome:'🎪 Festa de São João', categoria:'entretenimento',
      destaque: true,
      descricao:'Pico das Festas Juninas — grande data cultural nordestina.',
      dica:'Tema junino, milho, fogueira, personagens típicos. Ótimo para gastronomia.',
    },

    // ─── JULHO ────────────────────────────────────────────────
    {
      date: fixed(6, 7), id:'dia-chocolate', nome:'🍫 Dia Mundial do Chocolate', categoria:'comercial',
      destaque: true,
      descricao:'7 de julho — data deliciosa para marcas de alimentos.',
      dica:'Para padarias, cafeterias, confeitarias. Sorteio de chocolate = muito engajamento.',
    },
    {
      date: fixed(6, 26), id:'dia-avos', nome:'👴 Dia dos Avós', categoria:'comercial',
      destaque: true,
      descricao:'26 de julho — celebração dos avós.',
      dica:'Para clínicas, saúde do idoso, família, presentes. Forte apelo emocional.',
    },

    // ─── AGOSTO ───────────────────────────────────────────────
    {
      date: nthWeekday(year, 7, 0, 2), id:'dia-pais', nome:'👔 Dia dos Pais', categoria:'comercial',
      destaque: true,
      descricao:'2º domingo de agosto — segunda maior data comercial do Brasil.',
      dica:'Presentes masculinos, experiências, serviços. Iniciar campanha 3 semanas antes!',
    },
    {
      date: fixed(7, 11), id:'dia-estudante', nome:'📖 Dia do Estudante', categoria:'conscientizacao',
      descricao:'Dia do Estudante.',
      dica:'Para cursos, escolas, plataformas de ensino.',
    },
    {
      date: fixed(7, 13), id:'dia-fotografia', nome:'📷 Dia da Fotografia', categoria:'comercial',
      descricao:'19 de agosto — Dia Mundial da Fotografia (ajuste: 13/ago é Dia Nac. do Fotógrafo).',
      dica:'Bastidores dos fotógrafos da equipe, portfólio, depoimento de clientes.',
    },
    {
      date: fixed(7, 22), id:'primeiro-primavera-prep', nome:'🌸 Pré-Primavera', categoria:'sazonal',
      descricao:'Preparação para a virada de estação.',
      dica:'Conteúdo "chegando a primavera", novidades de coleção, lançamentos sazonais.',
    },

    // ─── SETEMBRO ─────────────────────────────────────────────
    {
      date: fixed(8, 7), id:'independencia', nome:'🇧🇷 Independência do Brasil', categoria:'feriado',
      destaque: true,
      descricao:'7 de setembro — Dia da Independência. Feriado nacional.',
      dica:'Verde e amarelo, orgulho nacional. Para marcas patrióticas ou apenas comunicar horários.',
    },
    {
      date: fixed(8, 15), id:'dia-cliente', nome:'🤝 Dia do Cliente', categoria:'comercial',
      destaque: true,
      descricao:'15 de setembro — ótima data para fidelização e relacionamento.',
      dica:'Agradecimento a clientes, depoimentos, promoções de fidelidade, sorteios.',
    },
    {
      date: fixed(8, 21), id:'primavera', nome:'🌷 Início da Primavera', categoria:'sazonal',
      descricao:'Equinócio de primavera — início da estação das flores.',
      dica:'Renovação, cores vivas, lançamentos de produtos, nova coleção.',
    },

    // ─── OUTUBRO ──────────────────────────────────────────────
    {
      date: fixed(9, 4), id:'dia-animais', nome:'🐾 Dia dos Animais', categoria:'conscientizacao',
      descricao:'4 de outubro — Dia Mundial dos Animais.',
      dica:'Para pet shops, veterinários, produtos pet.',
    },
    {
      date: fixed(9, 12), id:'dia-criancas', nome:'🧒 Dia das Crianças', categoria:'comercial',
      destaque: true,
      descricao:'12 de outubro — grande data comercial + feriado (N. Sra. Aparecida).',
      dica:'Brinquedos, roupas infantis, experiências família. Iniciar semana antes.',
    },
    {
      date: fixed(9, 15), id:'dia-professor', nome:'🍎 Dia do Professor', categoria:'conscientizacao',
      descricao:'15 de outubro — Dia do Professor.',
      dica:'Para escolas, cursos, plataformas edu. Homenagem sempre gera engajamento.',
    },
    {
      date: fixed(9, 31), id:'halloween', nome:'🎃 Halloween', categoria:'entretenimento',
      destaque: true,
      descricao:'31 de outubro — Halloween. Cada vez mais relevante no Brasil.',
      dica:'Decoração, fantasia, conteúdo de terror leve. Ótimo para bares, eventos, alimentação.',
    },

    // ─── NOVEMBRO ─────────────────────────────────────────────
    {
      date: fixed(10, 2), id:'finados', nome:'🕯️ Finados', categoria:'feriado',
      descricao:'Dia de Finados — feriado nacional.',
      dica:'Tom respeitoso. Para clínicas e serviços funerários: conteúdo de apoio à família.',
    },
    {
      date: fixed(10, 11), id:'dia-solteiros', nome:'💛 Dia dos Solteiros', categoria:'comercial',
      descricao:'11/11 — Dia dos Solteiros (origem China, crescendo no Brasil).',
      dica:'E-commerce, autoconhecimento, solteiros e livres. Bom para produtos individuais.',
    },
    {
      date: fixed(10, 15), id:'proclamacao', nome:'🏛️ Proclamação da República', categoria:'feriado',
      descricao:'15 de novembro — Proclamação da República. Feriado nacional.',
      dica:'Comunicar horários alternativos.',
    },
    {
      date: fixed(10, 20), id:'consciencia-negra', nome:'✊ Consciência Negra', categoria:'conscientizacao',
      destaque: true,
      descricao:'20 de novembro — Dia da Consciência Negra. Feriado nacional.',
      dica:'Representatividade, diversidade, cultura afro-brasileira. Conteúdo com cuidado e autenticidade.',
    },
    {
      date: lastWeekday(year, 10, 5), id:'black-friday', nome:'🏷️ Black Friday', categoria:'comercial',
      destaque: true,
      descricao:'Última sexta de novembro — maior data de vendas do e-commerce.',
      dica:'Promoções agressivas, countdown, urgência. Prepare 2 semanas antes.',
    },

    // ─── DEZEMBRO ─────────────────────────────────────────────
    {
      date: fixed(11, 1), id:'aids', nome:'🎗️ Dia Mundial AIDS', categoria:'conscientizacao',
      descricao:'1º de dezembro — Dia Mundial de Luta contra a AIDS.',
      dica:'Para clínicas, saúde, conscientização. Laço vermelho.',
    },
    {
      date: fixed(11, 21), id:'inverno', nome:'❄️ Início do Verão', categoria:'sazonal',
      descricao:'Solstício de dezembro — início do verão no hemisfério sul.',
      dica:'Verão, férias, produtos sazonais, praia, ar livre.',
    },
    {
      date: fixed(11, 25), id:'natal', nome:'🎄 Natal', categoria:'comercial',
      destaque: true,
      descricao:'25 de dezembro — maior feriado do ano e pico de vendas.',
      dica:'Campanha de Natal começa em outubro! Ceia, presentes, confraternização, felicitações.',
    },
    {
      date: fixed(11, 31), id:'reveillon', nome:'🎇 Réveillon', categoria:'feriado',
      destaque: true,
      descricao:'31 de dezembro — Véspera de Ano Novo.',
      dica:'Retrospectiva, agradecimentos, "nos vemos em 2027".',
    },
  ]

  return list.map(({ date, ...data }) => ({ date, data }))
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function DatasTab() {
  const today = React.useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const [year, setYear] = React.useState(today.getFullYear())
  const [viewMonth, setViewMonth] = React.useState<number | null>(null) // null = all
  const [filterCat, setFilterCat] = React.useState<Categoria | 'todas'>('todas')
  const [showDestaques, setShowDestaques] = React.useState(false)

  const allDates = React.useMemo(() => getDatasDoAno(year), [year])

  // Datas nos próximos 60 dias
  const upcoming = React.useMemo(() => {
    const in60 = new Date(today.getTime() + 60 * 86400000)
    return allDates
      .filter(d => d.date >= today && d.date <= in60)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [allDates, today])

  // Datas muito urgentes (próximos 14 dias)
  const urgent = React.useMemo(() => {
    const in14 = new Date(today.getTime() + 14 * 86400000)
    return upcoming.filter(d => d.date <= in14)
  }, [upcoming])

  const filtered = React.useMemo(() => {
    return allDates.filter(d => {
      if (filterCat !== 'todas' && d.data.categoria !== filterCat) return false
      if (showDestaques && !d.data.destaque) return false
      if (viewMonth !== null && d.date.getMonth() !== viewMonth) return false
      return true
    }).sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [allDates, filterCat, showDestaques, viewMonth])

  // Group by month
  const byMonth = React.useMemo(() => {
    const map: Record<number, ResolvedDate[]> = {}
    filtered.forEach(d => {
      const m = d.date.getMonth()
      if (!map[m]) map[m] = []
      map[m].push(d)
    })
    return map
  }, [filtered])

  const months = viewMonth !== null ? [viewMonth] : Array.from({ length: 12 }, (_, i) => i)

  function daysUntil(date: Date): number {
    return Math.round((date.getTime() - today.getTime()) / 86400000)
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3.5 }, display: 'flex', flexDirection: 'column', gap: 2, height: '100%', overflow: 'auto' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <EventIcon sx={{ color: 'primary.main', fontSize: 22 }} />
        <Typography fontWeight={800} sx={{ fontSize: { xs: '1rem', md: '1.1rem' } }}>
          Datas Comemorativas
        </Typography>

        {/* Year navigator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, ml: 1, bgcolor: 'rgba(244,247,255,0.04)', borderRadius: 2, px: 0.8, py: 0.25 }}>
          <Box onClick={() => setYear(y => y - 1)} sx={{ p: 0.3, borderRadius: 1, cursor: 'pointer', color: 'rgba(244,247,255,0.4)', '&:hover': { color: '#fff' }, display: 'flex' }}>
            <ChevronLeftIcon sx={{ fontSize: 16 }} />
          </Box>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, minWidth: 36, textAlign: 'center' }}>{year}</Typography>
          <Box onClick={() => setYear(y => y + 1)} sx={{ p: 0.3, borderRadius: 1, cursor: 'pointer', color: 'rgba(244,247,255,0.4)', '&:hover': { color: '#fff' }, display: 'flex' }}>
            <ChevronRightIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Filtro destaque */}
        <Chip
          label="⭐ Só destaques"
          size="small"
          onClick={() => setShowDestaques(v => !v)}
          sx={{
            fontSize: '0.65rem', height: 24, fontWeight: 600, cursor: 'pointer',
            bgcolor: showDestaques ? 'rgba(59,130,246,0.18)' : 'rgba(244,247,255,0.05)',
            color: showDestaques ? 'primary.main' : 'text.secondary',
            border: '1px solid', borderColor: showDestaques ? 'rgba(59,130,246,0.35)' : 'rgba(244,247,255,0.1)',
          }}
        />
      </Box>

      {/* ── Alerta urgente ──────────────────────────────────────────────────── */}
      {urgent.length > 0 && (
        <Paper sx={{
          p: 1.5, borderRadius: 2,
          background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(59,130,246,0.05))',
          border: '1px solid rgba(59,130,246,0.25)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}>
            <WarningAmberIcon sx={{ fontSize: 16, color: DS.accent }} />
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: DS.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {urgent.length} data{urgent.length !== 1 ? 's' : ''} nos próximos 14 dias — prepare conteúdo agora!
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
            {urgent.map(d => {
              const days = daysUntil(d.date)
              const cfg = CAT_CFG[d.data.categoria]
              return (
                <Box key={d.data.id} sx={{
                  display: 'flex', alignItems: 'center', gap: 0.6,
                  px: 1, py: 0.5, borderRadius: 1.5,
                  bgcolor: days <= 3 ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.08)',
                  border: `1px solid ${days <= 3 ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.2)'}`,
                }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: days <= 3 ? DS.red : DS.accent }}>
                    {days === 0 ? 'HOJE' : days === 1 ? 'amanhã' : `${days}d`}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.primary', fontWeight: 600 }}>
                    {d.data.nome}
                  </Typography>
                  <Typography sx={{ fontSize: '0.62rem', color: cfg.color }}>
                    {formatDate(d.date)}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        </Paper>
      )}

      {/* ── Próximos 60 dias (mini timeline) ─────────────────────────────── */}
      {upcoming.length > 0 && (
        <Paper sx={{ ...cardSx, p: { xs: 1.2, md: 1.8 } }}>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(244,247,255,0.35)', mb: 1.2 }}>
            📅 Próximos 60 dias
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
            {upcoming.map(d => {
              const days = daysUntil(d.date)
              const cfg = CAT_CFG[d.data.categoria]
              const pct = Math.max(0, 100 - (days / 60) * 100)
              return (
                <Box key={d.data.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                  {/* Days badge */}
                  <Box sx={{
                    minWidth: 38, height: 24, borderRadius: 1.5, flexShrink: 0,
                    bgcolor: days <= 7 ? 'rgba(239,68,68,0.12)' : days <= 14 ? 'rgba(59,130,246,0.1)' : 'rgba(244,247,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography sx={{
                      fontSize: '0.58rem', fontWeight: 900,
                      color: days <= 7 ? DS.red : days <= 14 ? DS.accent : 'text.secondary',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {days === 0 ? 'HOJE' : `${days}d`}
                    </Typography>
                  </Box>

                  {/* Progress bar */}
                  <Box sx={{ flex: 1, height: 4, bgcolor: 'rgba(244,247,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: cfg.color, borderRadius: 2, opacity: 0.7, transition: 'width 0.6s ease' }} />
                  </Box>

                  {/* Date + name */}
                  <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 36 }}>
                    {formatDate(d.date)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: d.data.destaque ? 700 : 500, color: d.data.destaque ? 'text.primary' : 'text.secondary', flex: 1.5 }} noWrap>
                    {d.data.nome}
                  </Typography>
                  <Chip label={cfg.label.split(' ')[1]} size="small" sx={{ fontSize: '0.52rem', height: 17, bgcolor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, flexShrink: 0 }} />
                </Box>
              )
            })}
          </Box>
        </Paper>
      )}

      {/* ── Filtros de categoria ────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Filtrar:</Typography>
        {(['todas', ...Object.keys(CAT_CFG)] as Array<Categoria | 'todas'>).map(cat => {
          const cfg = cat === 'todas' ? null : CAT_CFG[cat]
          const active = filterCat === cat
          return (
            <Chip key={cat} size="small"
              label={cat === 'todas' ? 'Todas' : cfg!.label}
              onClick={() => setFilterCat(cat)}
              sx={{
                fontSize: '0.62rem', height: 22, fontWeight: 600, cursor: 'pointer',
                bgcolor: active ? (cfg ? cfg.bg : 'rgba(59,130,246,0.15)') : 'rgba(244,247,255,0.04)',
                color: active ? (cfg ? cfg.color : 'primary.main') : 'text.disabled',
                border: '1px solid', borderColor: active ? (cfg ? cfg.border : 'rgba(59,130,246,0.3)') : 'rgba(244,247,255,0.08)',
              }}
            />
          )
        })}
      </Box>

      {/* ── Filtro de mês ──────────────────────────────────────────────────── */}
      <Box sx={{
        display: 'flex', gap: 0.5, flexWrap: 'wrap',
      }}>
        <Chip size="small" label="Todos os meses"
          onClick={() => setViewMonth(null)}
          sx={{ fontSize: '0.6rem', height: 22, cursor: 'pointer', bgcolor: viewMonth === null ? 'rgba(59,130,246,0.15)' : 'rgba(244,247,255,0.04)', color: viewMonth === null ? 'primary.main' : 'text.disabled', border: '1px solid', borderColor: viewMonth === null ? 'rgba(59,130,246,0.3)' : 'rgba(244,247,255,0.08)' }} />
        {MESES.map((m, i) => {
          const hasUpcoming = allDates.some(d => d.date.getMonth() === i && daysUntil(d.date) >= 0 && daysUntil(d.date) <= 60)
          return (
            <Chip key={m} size="small" label={m.slice(0, 3)}
              onClick={() => setViewMonth(i === viewMonth ? null : i)}
              sx={{
                fontSize: '0.6rem', height: 22, cursor: 'pointer',
                bgcolor: viewMonth === i ? 'rgba(59,130,246,0.15)' : 'rgba(244,247,255,0.04)',
                color: viewMonth === i ? 'primary.main' : hasUpcoming ? 'rgba(59,130,246,0.7)' : 'text.disabled',
                border: '1px solid',
                borderColor: viewMonth === i ? 'rgba(59,130,246,0.3)' : hasUpcoming ? 'rgba(59,130,246,0.2)' : 'rgba(244,247,255,0.08)',
                fontWeight: viewMonth === i ? 700 : 500,
              }} />
          )
        })}
      </Box>

      {/* ── Calendário por mês ─────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {months.map(m => {
          const datas = byMonth[m]
          if (!datas || datas.length === 0) return null
          const isCurrentMonth = m === today.getMonth() && year === today.getFullYear()

          return (
            <Paper key={m} sx={{
              borderRadius: 2.5, overflow: 'hidden',
              border: isCurrentMonth ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(244,247,255,0.06)',
              bgcolor: 'rgba(13,13,13,0.6)',
            }}>
              {/* Month header */}
              <Box sx={{
                px: { xs: 1.5, md: 2 }, py: 1,
                display: 'flex', alignItems: 'center', gap: 1,
                borderBottom: '1px solid rgba(244,247,255,0.05)',
                bgcolor: isCurrentMonth ? 'rgba(59,130,246,0.06)' : 'rgba(244,247,255,0.02)',
              }}>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 800, color: isCurrentMonth ? 'primary.main' : 'text.primary' }}>
                  {MESES[m]}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', fontWeight: 500 }}>
                  {year}
                </Typography>
                {isCurrentMonth && (
                  <Chip label="mês atual" size="small" sx={{ fontSize: '0.55rem', height: 16, bgcolor: 'rgba(59,130,246,0.15)', color: 'primary.main', border: '1px solid rgba(59,130,246,0.3)', ml: 0.5 }} />
                )}
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
                  {datas.length} data{datas.length !== 1 ? 's' : ''}
                </Typography>
              </Box>

              {/* Dates */}
              {datas.map((d, idx) => {
                const days = daysUntil(d.date)
                const isPast = days < 0
                const cfg = CAT_CFG[d.data.categoria]
                const isToday = days === 0
                const isSoon = days > 0 && days <= 14

                return (
                  <Box key={d.data.id} sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 1.5,
                    px: { xs: 1.5, md: 2 }, py: { xs: 1, md: 1.2 },
                    borderBottom: idx < datas.length - 1 ? '1px solid rgba(244,247,255,0.04)' : 'none',
                    opacity: isPast ? 0.45 : 1,
                    transition: 'background 0.15s',
                    '&:hover': { bgcolor: 'rgba(244,247,255,0.022)' },
                    position: 'relative',
                    '&::before': d.data.destaque && !isPast ? {
                      content: '""', position: 'absolute', left: 0, top: '20%', bottom: '20%',
                      width: 2.5, borderRadius: '0 2px 2px 0',
                      bgcolor: cfg.color, opacity: 0.7,
                    } : {},
                  }}>
                    {/* Date badge */}
                    <Box sx={{
                      minWidth: 46, flexShrink: 0,
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      pt: 0.2,
                    }}>
                      <Typography sx={{
                        fontSize: '0.72rem', fontWeight: 800,
                        color: isToday ? DS.red : isSoon ? DS.accent : isPast ? 'rgba(244,247,255,0.25)' : 'text.secondary',
                        lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {formatDate(d.date)}
                      </Typography>
                      {!isPast && (
                        <Typography sx={{
                          fontSize: '0.52rem', fontWeight: 700, mt: 0.2,
                          color: isToday ? DS.red : isSoon ? DS.accent : 'rgba(244,247,255,0.18)',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {isToday ? 'HOJE' : `${days}d`}
                        </Typography>
                      )}
                    </Box>

                    {/* Content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap', mb: 0.3 }}>
                        <Typography sx={{
                          fontSize: '0.82rem',
                          fontWeight: d.data.destaque ? 800 : 600,
                          color: isPast ? 'rgba(244,247,255,0.35)' : 'text.primary',
                          lineHeight: 1.2,
                        }}>
                          {d.data.nome}
                          {d.data.destaque && !isPast && <Box component="span" sx={{ ml: 0.5, fontSize: '0.55rem', color: DS.accent, fontWeight: 900, verticalAlign: 'middle' }}>⭐</Box>}
                        </Typography>
                        <Chip label={cfg.label} size="small" sx={{
                          fontSize: '0.52rem', height: 16, bgcolor: cfg.bg, color: cfg.color,
                          border: `1px solid ${cfg.border}`,
                        }} />
                      </Box>

                      <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', lineHeight: 1.4, mb: isSoon && !isPast ? 0.5 : 0 }}>
                        {d.data.descricao}
                      </Typography>

                      {/* Content suggestion — só mostra quando próxima ou hover */}
                      {(isSoon || isToday) && !isPast && (
                        <Box sx={{
                          mt: 0.5, px: 1, py: 0.5, borderRadius: 1.5,
                          bgcolor: `${cfg.color}0a`,
                          border: `1px solid ${cfg.color}20`,
                        }}>
                          <Typography sx={{ fontSize: '0.62rem', color: cfg.color, fontWeight: 600, mb: 0.2 }}>
                            💡 Sugestão de conteúdo:
                          </Typography>
                          <Typography sx={{ fontSize: '0.62rem', color: 'rgba(244,247,255,0.55)', lineHeight: 1.5 }}>
                            {d.data.dica}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )
              })}
            </Paper>
          )
        })}
      </Box>

      {filtered.length === 0 && (
        <EmptyState
          icon={<EventIcon sx={{ fontSize: 30 }} />}
          title="Nenhuma data encontrada"
          subtitle="Ajuste os filtros acima para ver as datas comemorativas e sazonais do período."
        />
      )}
    </Box>
  )
}

// Card style reutilizado
const cardSx = {
  bgcolor: 'rgba(13,13,13,0.7)',
  border: '1px solid rgba(244,247,255,0.06)',
  borderRadius: 2.5,
}
