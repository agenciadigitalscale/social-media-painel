import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Box, Typography, Button, Chip, ThemeProvider, CssBaseline,
  TextField, MenuItem, Snackbar, Alert,
} from '@mui/material'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import InstagramIcon from '@mui/icons-material/Instagram'
import BrushIcon from '@mui/icons-material/Brush'
import VideocamIcon from '@mui/icons-material/Videocam'
import EditNoteIcon from '@mui/icons-material/EditNote'
import CampaignIcon from '@mui/icons-material/Campaign'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import StarIcon from '@mui/icons-material/Star'
import theme from '../theme'

const WA_BASE = '5511997295407'
const WA_LINK = `https://wa.me/${WA_BASE}?text=${encodeURIComponent('Olá! Vi o site da Digital Scale e tenho interesse em gerenciar minhas redes sociais.')}`
const IG_LINK = 'https://instagram.com/agenciadigitalscale'

const SERVICES = [
  { icon: <InstagramIcon sx={{ fontSize: 28 }} />, color: '#ff9039', glow: 'rgba(255,144,57,0.35)',
    title: 'Social Media', desc: 'Calendário editorial estratégico, gestão diária e relacionamento com o público nas principais redes.' },
  { icon: <BrushIcon sx={{ fontSize: 28 }} />, color: '#C084FC', glow: 'rgba(192,132,252,0.35)',
    title: 'Design', desc: 'Posts, stories, reels e criativos com identidade visual consistente e que convertem.' },
  { icon: <EditNoteIcon sx={{ fontSize: 28 }} />, color: '#FB7185', glow: 'rgba(251,113,133,0.35)',
    title: 'Copy & Legendas', desc: 'Textos estratégicos com tom de voz da marca, CTAs persuasivos e legendas que engajam.' },
  { icon: <CampaignIcon sx={{ fontSize: 28 }} />, color: '#00C47A', glow: 'rgba(0,196,122,0.35)',
    title: 'Tráfego Pago', desc: 'Campanhas no Meta Ads e Google Ads com otimização contínua focada em ROI real.' },
  { icon: <VideocamIcon sx={{ fontSize: 28 }} />, color: '#3B8EFF', glow: 'rgba(59,142,255,0.35)',
    title: 'Gravação de Vídeo', desc: 'Produção de reels profissionais, roteiro, filmagem e edição — tudo pela agência.' },
]

const NICHOS = [
  { emoji: '🍽️', label: 'Restaurantes' },
  { emoji: '🥩', label: 'Churrascarias' },
  { emoji: '🍞', label: 'Padarias' },
  { emoji: '🎂', label: 'Confeitarias' },
  { emoji: '🎉', label: 'Festas & Eventos' },
  { emoji: '🏡', label: 'Hospedagem' },
  { emoji: '💆', label: 'Estética & Saúde' },
  { emoji: '🐾', label: 'Pet Shop' },
  { emoji: '🏗️', label: 'Construção' },
  { emoji: '🏠', label: 'Imóveis' },
  { emoji: '⚡', label: 'Energia' },
  { emoji: '👗', label: 'Moda & Estilo' },
]

const TEAM = [
  { name: 'Kaique',  role: 'Head & Fundador',     emoji: '🎬', color: '#ff9039' },
  { name: 'Geovana', role: 'Social Media',         emoji: '📱', color: '#3B8EFF' },
  { name: 'Jhones',  role: 'Design',               emoji: '🎨', color: '#C084FC' },
  { name: 'Kerges',  role: 'Copy',                 emoji: '✍️', color: '#FB7185' },
  { name: 'Arthur',  role: 'Gestor de Tráfego',    emoji: '📈', color: '#00C47A' },
  { name: 'Robson',  role: 'Gestor de Tráfego',    emoji: '📈', color: '#00C47A' },
]

const STATS = [
  { value: 17,    suffix: '',  label: 'clientes ativos' },
  { value: 226,   suffix: '',  label: 'conteúdos por mês' },
  { value: 5,     suffix: '',  label: 'serviços integrados' },
  { value: 100,   suffix: '%', label: 'foco em resultado' },
]

const TESTIMONIALS = [
  {
    text: 'Em 3 meses a Digital Scale transformou nossa presença no Instagram. O engajamento triplicou e as reservas pelo direct aumentaram muito.',
    author: 'Pousada Alto da Represa',
    nicho: 'Hospedagem',
    stars: 5,
    color: '#ff9039',
  },
  {
    text: 'Profissionalismo total. Cada post tem identidade, cada legenda converte. Meus clientes elogiam toda semana.',
    author: 'Kátia Bigatello',
    nicho: 'Estética',
    stars: 5,
    color: '#C084FC',
  },
  {
    text: 'Saímos de 600 para mais de 3.800 seguidores em 6 meses. O tráfego pago trouxe clientes que nunca nos conheceriam.',
    author: 'LuzioPan',
    nicho: 'Panificadora',
    stars: 5,
    color: '#FB7185',
  },
]

const NICHO_OPTIONS = [
  'Restaurante / Lanchonete',
  'Churrascaria / Grill',
  'Padaria / Confeitaria',
  'Hospedagem / Pousada',
  'Estética / Beleza / Saúde',
  'Pet Shop',
  'Moda & Estilo',
  'Imóveis',
  'Festas & Eventos',
  'Construção / Serviços',
  'Outro',
]

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Fix mobile: checa se já está visível antes de montar o observer
    const alreadyVisible = () => {
      const rect = el.getBoundingClientRect()
      return rect.top < window.innerHeight && rect.bottom > 0
    }
    if (alreadyVisible()) { setVisible(true); return }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    )
    obs.observe(el)
    // Fallback: iOS Safari às vezes não dispara IntersectionObserver no load
    const t = setTimeout(() => { if (alreadyVisible()) setVisible(true) }, 400)
    return () => { obs.disconnect(); clearTimeout(t) }
  }, [threshold])
  return { ref, visible }
}

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useInView()
  return (
    <Box ref={ref} sx={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
    }}>
      {children}
    </Box>
  )
}

function AnimatedCounter({ target, suffix = '', duration = 1800 }: { target: number; suffix?: string; duration?: number }) {
  const { ref, visible } = useInView(0.3)
  const [count, setCount] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!visible || started.current) return
    started.current = true
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [visible, target, duration])

  return (
    <Box ref={ref}>
      <Typography sx={{
        fontSize: { xs: '2.2rem', md: '2.8rem', xl: '3.4rem' },
        fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1,
        background: 'linear-gradient(135deg, #ff9039, #ff5339)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        mb: 0.5,
      }}>
        {count}{suffix}
      </Typography>
    </Box>
  )
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [nome, setNome]         = useState('')
  const [telefone, setTelefone] = useState('')
  const [nicho, setNicho]       = useState('')
  const [snack, setSnack]       = useState('')

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const handleContact = useCallback(() => {
    if (!nome.trim() || !telefone.trim()) { setSnack('Preencha nome e telefone.'); return }
    const msg = `Olá! Me chamo *${nome.trim()}* e tenho interesse em gerenciar meu negócio${nicho ? ` de *${nicho}*` : ''} nas redes sociais.\nMeu telefone: ${telefone.trim()}`
    window.open(`https://wa.me/${WA_BASE}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  }, [nome, telefone, nicho])

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'rgba(255,255,255,0.03)',
      borderRadius: 2,
      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
      '&:hover fieldset': { borderColor: 'rgba(255,144,57,0.3)' },
      '&.Mui-focused fieldset': { borderColor: 'primary.main' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' },
    '& .MuiInputLabel-root.Mui-focused': { color: 'primary.main' },
    '& input, & textarea': { color: 'text.primary', fontSize: '0.9rem' },
    '& .MuiSelect-select': { color: 'text.primary', fontSize: '0.9rem' },
  }

  return (
    <ThemeProvider theme={theme}><CssBaseline />
      <Box sx={{
        minHeight: '100vh', bgcolor: '#080808', color: 'text.primary',
        fontFamily: '"Inter", system-ui, sans-serif',
        overflowX: 'hidden',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { background: 'rgba(255,144,57,0.4)', borderRadius: 4 },
      }}>

        {/* ── Navbar ─────────────────────────────────────────────── */}
        <Box component="nav" sx={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          px: { xs: 2, md: 6, xl: 10 }, py: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: scrolled ? 'rgba(8,8,8,0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
          transition: 'all 0.3s ease',
        }}>
          <Box component="img" src="/logotipo.png" sx={{ height: { xs: 28, md: 32, xl: 38 }, objectFit: 'contain' }} />
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Button href={IG_LINK} target="_blank" rel="noopener noreferrer" size="small"
              startIcon={<InstagramIcon sx={{ fontSize: '15px !important' }} />}
              sx={{ fontSize: { xs: '0.7rem', xl: '0.8rem' }, color: 'text.secondary', fontWeight: 600,
                display: { xs: 'none', sm: 'flex' },
                '&:hover': { color: 'primary.main' } }}>
              Instagram
            </Button>
            <Button href="/" size="small"
              sx={{ fontSize: { xs: '0.72rem', xl: '0.82rem' }, color: 'text.secondary', fontWeight: 600,
                '&:hover': { color: 'primary.main' } }}>
              Área da equipe
            </Button>
            <Button href={WA_LINK} target="_blank" rel="noopener noreferrer"
              variant="contained" size="small"
              startIcon={<WhatsAppIcon sx={{ fontSize: '15px !important' }} />}
              sx={{
                background: 'linear-gradient(135deg, #ff9039, #ff5339)', color: '#000', fontWeight: 800,
                fontSize: { xs: '0.72rem', xl: '0.82rem' }, borderRadius: 2, px: 2,
                boxShadow: '0 4px 14px rgba(255,144,57,0.3)',
                '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
                transition: 'all 0.2s ease',
              }}>
              WhatsApp
            </Button>
          </Box>
        </Box>

        {/* ── Hero ───────────────────────────────────────────────── */}
        <Box sx={{
          minHeight: { xs: '100svh', md: '100vh' }, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          px: { xs: 2.5, sm: 3, md: 6, xl: 10 }, textAlign: 'center',
          position: 'relative', overflow: 'hidden',
          pt: { xs: 12, md: 10 }, pb: { xs: 6, md: 0 },
        }}>
          <Box sx={{
            position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
            width: { xs: 400, md: 700, xl: 900 }, height: { xs: 400, md: 700, xl: 900 },
            background: 'radial-gradient(circle, rgba(255,144,57,0.07) 0%, transparent 70%)',
            pointerEvents: 'none',
            animation: 'glowBreath 7s ease-in-out infinite',
            '@keyframes glowBreath': {
              '0%,100%': { opacity: 0.7, transform: 'translate(-50%,-50%) scale(1)' },
              '50%':     { opacity: 1,   transform: 'translate(-50%,-50%) scale(1.08)' },
            },
          }} />

          <FadeIn>
            <Chip label="Agência de Marketing Digital" size="small"
              sx={{ mb: 3, fontSize: { xs: '0.62rem', xl: '0.72rem' }, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                bgcolor: 'rgba(255,144,57,0.1)', color: 'primary.main',
                border: '1px solid rgba(255,144,57,0.3)' }} />
          </FadeIn>

          <FadeIn delay={0.1}>
            <Typography sx={{
              fontSize: { xs: '2.2rem', sm: '3rem', md: '3.8rem', lg: '4.4rem', xl: '5.2rem' },
              fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.04em', mb: 1,
              maxWidth: { md: 800, xl: 960 },
            }}>
              Seu negócio merece mais{' '}
              <Box component="span" sx={{
                background: 'linear-gradient(135deg, #ff9039, #ff5339)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                do que posts.
              </Box>
            </Typography>
            <Typography sx={{
              fontSize: { xs: '2.2rem', sm: '3rem', md: '3.8rem', lg: '4.4rem', xl: '5.2rem' },
              fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.04em',
              mb: 3.5, color: 'rgba(255,255,255,0.85)',
            }}>
              Merece resultados.
            </Typography>
          </FadeIn>

          <FadeIn delay={0.2}>
            <Typography sx={{
              fontSize: { xs: '1rem', md: '1.2rem', xl: '1.4rem' },
              color: 'rgba(255,255,255,0.5)', maxWidth: { md: 560, xl: 680 },
              lineHeight: 1.65, mb: 4.5, letterSpacing: '-0.01em',
            }}>
              A Digital Scale cuida de toda a presença digital do seu negócio — do planejamento à publicação — para você focar no que realmente importa.
            </Typography>
          </FadeIn>

          <FadeIn delay={0.3}>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button href="#contato" variant="contained" size="large"
                startIcon={<WhatsAppIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #ff9039, #ff5339)', color: '#000', fontWeight: 800,
                  fontSize: { xs: '0.9rem', xl: '1rem' }, px: { xs: 3, xl: 4 }, py: { xs: 1.4, xl: 1.7 },
                  borderRadius: 2.5, boxShadow: '0 8px 28px rgba(255,144,57,0.35)',
                  '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-2px)', boxShadow: '0 12px 36px rgba(255,144,57,0.45)' },
                  transition: 'all 0.2s ease',
                }}>
                Quero começar agora
              </Button>
              <Button href="#servicos" variant="outlined" size="large"
                sx={{
                  borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontWeight: 700,
                  fontSize: { xs: '0.9rem', xl: '1rem' }, px: { xs: 3, xl: 4 }, py: { xs: 1.4, xl: 1.7 },
                  borderRadius: 2.5,
                  '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'rgba(255,144,57,0.06)' },
                  transition: 'all 0.2s ease',
                }}>
                Ver serviços
              </Button>
            </Box>
          </FadeIn>

          <Box sx={{
            position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            opacity: 0.3, animation: 'bounce 2s ease-in-out infinite',
            '@keyframes bounce': {
              '0%,100%': { transform: 'translateX(-50%) translateY(0)' },
              '50%':     { transform: 'translateX(-50%) translateY(8px)' },
            },
          }}>
            <Box sx={{ width: 1.5, height: 32, bgcolor: 'rgba(255,255,255,0.4)', borderRadius: 1 }} />
          </Box>
        </Box>

        {/* ── Stats com contador animado ──────────────────────────── */}
        <Box sx={{ px: { xs: 3, md: 6, xl: 10 }, py: { xs: 6, md: 8, xl: 10 } }}>
          <Box sx={{
            display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(4,1fr)' },
            gap: 2,
          }}>
            {STATS.map((s) => (
              <Box key={s.label} sx={{
                p: { xs: 2.5, xl: 3.5 }, borderRadius: 3, textAlign: 'center',
                background: 'rgba(255,144,57,0.05)', border: '1px solid rgba(255,144,57,0.12)',
                backdropFilter: 'blur(20px)',
              }}>
                <AnimatedCounter target={s.value} suffix={s.suffix} />
                <Typography sx={{
                  fontSize: { xs: '0.72rem', xl: '0.85rem' },
                  color: 'rgba(255,255,255,0.45)', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {s.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* ── Serviços ───────────────────────────────────────────── */}
        <Box id="servicos" sx={{ px: { xs: 3, md: 6, xl: 10 }, py: { xs: 6, md: 8, xl: 10 } }}>
          <FadeIn>
            <Typography sx={{ fontSize: { xs: '0.6rem', xl: '0.7rem' }, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em', color: 'primary.main', mb: 1 }}>
              O que fazemos
            </Typography>
            <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.4rem', xl: '3rem' },
              fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, mb: 1 }}>
              Tudo que sua marca precisa,
            </Typography>
            <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.4rem', xl: '3rem' },
              fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1,
              color: 'rgba(255,255,255,0.35)', mb: 5 }}>
              em um único lugar.
            </Typography>
          </FadeIn>
          <Box sx={{ display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)', xl: 'repeat(5,1fr)' },
            gap: 2 }}>
            {SERVICES.map((s, i) => (
              <FadeIn key={s.title} delay={i * 0.08}>
                <Box sx={{
                  p: { xs: 2.5, xl: 3 }, borderRadius: 3, height: '100%',
                  background: 'rgba(13,13,13,0.82)', border: '1px solid rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(28px)', transition: 'all 0.2s ease', cursor: 'default',
                  '&:hover': { transform: 'translateY(-4px)', border: `1px solid ${s.color}30`,
                    boxShadow: `0 12px 40px ${s.glow}` },
                }}>
                  <Box sx={{ width: 52, height: 52, borderRadius: 2, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', bgcolor: `${s.color}18`, color: s.color, mb: 2,
                    border: `1px solid ${s.color}28` }}>
                    {s.icon}
                  </Box>
                  <Typography sx={{ fontSize: { xs: '0.92rem', xl: '1rem' }, fontWeight: 800, mb: 1 }}>
                    {s.title}
                  </Typography>
                  <Typography sx={{ fontSize: { xs: '0.78rem', xl: '0.88rem' },
                    color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                    {s.desc}
                  </Typography>
                </Box>
              </FadeIn>
            ))}
          </Box>
        </Box>

        {/* ── Depoimentos ────────────────────────────────────────── */}
        <Box sx={{ px: { xs: 3, md: 6, xl: 10 }, py: { xs: 6, md: 8, xl: 10 } }}>
          <FadeIn>
            <Typography sx={{ fontSize: { xs: '0.6rem', xl: '0.7rem' }, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em', color: 'primary.main', mb: 1 }}>
              Resultados reais
            </Typography>
            <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.4rem', xl: '3rem' },
              fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, mb: 5 }}>
              Quem confiou,{' '}
              <Box component="span" sx={{ color: 'rgba(255,255,255,0.35)' }}>cresceu.</Box>
            </Typography>
          </FadeIn>
          <Box sx={{ display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3,1fr)' }, gap: 2 }}>
            {TESTIMONIALS.map((t, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <Box sx={{
                  p: { xs: 3, xl: 3.5 }, borderRadius: 3, height: '100%',
                  background: 'rgba(13,13,13,0.82)',
                  border: `1px solid ${t.color}18`,
                  backdropFilter: 'blur(28px)',
                  display: 'flex', flexDirection: 'column', gap: 2,
                  transition: 'all 0.2s ease',
                  '&:hover': { transform: 'translateY(-3px)', border: `1px solid ${t.color}35`,
                    boxShadow: `0 10px 32px ${t.color}15` },
                }}>
                  <FormatQuoteIcon sx={{ color: t.color, opacity: 0.5, fontSize: 32 }} />
                  <Typography sx={{ fontSize: { xs: '0.85rem', xl: '0.95rem' },
                    color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, flex: 1, fontStyle: 'italic' }}>
                    "{t.text}"
                  </Typography>
                  <Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      {Array.from({ length: t.stars }).map((_, si) => (
                        <StarIcon key={si} sx={{ fontSize: 14, color: '#FFD700' }} />
                      ))}
                    </Box>
                    <Typography sx={{ fontSize: { xs: '0.82rem', xl: '0.9rem' }, fontWeight: 800, color: t.color }}>
                      {t.author}
                    </Typography>
                    <Typography sx={{ fontSize: { xs: '0.65rem', xl: '0.72rem' },
                      color: 'rgba(255,255,255,0.3)', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {t.nicho}
                    </Typography>
                  </Box>
                </Box>
              </FadeIn>
            ))}
          </Box>
        </Box>

        {/* ── Nichos ─────────────────────────────────────────────── */}
        <Box sx={{ px: { xs: 3, md: 6, xl: 10 }, py: { xs: 6, md: 8, xl: 10 } }}>
          <FadeIn>
            <Typography sx={{ fontSize: { xs: '0.6rem', xl: '0.7rem' }, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em', color: 'primary.main', mb: 1 }}>
              Nichos atendidos
            </Typography>
            <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.4rem', xl: '3rem' },
              fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, mb: 5 }}>
              Seu segmento tem jeito próprio.{' '}
              <Box component="span" sx={{ color: 'rgba(255,255,255,0.35)' }}>
                A gente entende o seu.
              </Box>
            </Typography>
          </FadeIn>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {NICHOS.map((n, i) => (
              <FadeIn key={n.label} delay={i * 0.05}>
                <Box sx={{
                  px: 2, py: 1.2, borderRadius: 2.5,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', gap: 1,
                  transition: 'all 0.2s ease', cursor: 'default',
                  '&:hover': { bgcolor: 'rgba(255,144,57,0.06)', borderColor: 'rgba(255,144,57,0.2)', transform: 'translateY(-1px)' },
                }}>
                  <Typography sx={{ fontSize: { xs: '1.1rem', xl: '1.3rem' } }}>{n.emoji}</Typography>
                  <Typography sx={{ fontSize: { xs: '0.8rem', xl: '0.9rem' },
                    fontWeight: 700, color: 'rgba(255,255,255,0.65)' }}>
                    {n.label}
                  </Typography>
                </Box>
              </FadeIn>
            ))}
          </Box>
        </Box>

        {/* ── Time ───────────────────────────────────────────────── */}
        <Box sx={{ px: { xs: 3, md: 6, xl: 10 }, py: { xs: 6, md: 8, xl: 10 } }}>
          <FadeIn>
            <Typography sx={{ fontSize: { xs: '0.6rem', xl: '0.7rem' }, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em', color: 'primary.main', mb: 1 }}>
              O time
            </Typography>
            <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.4rem', xl: '3rem' },
              fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, mb: 5 }}>
              Especialistas dedicados{' '}
              <Box component="span" sx={{ color: 'rgba(255,255,255,0.35)' }}>à sua marca.</Box>
            </Typography>
          </FadeIn>
          <Box sx={{ display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(6,1fr)' },
            gap: 2 }}>
            {TEAM.map((m, i) => (
              <FadeIn key={m.name} delay={i * 0.07}>
                <Box sx={{
                  p: { xs: 2, xl: 2.5 }, borderRadius: 3, textAlign: 'center',
                  background: 'rgba(13,13,13,0.82)', border: `1px solid ${m.color}18`,
                  transition: 'all 0.2s ease',
                  '&:hover': { transform: 'translateY(-3px)', border: `1px solid ${m.color}40`,
                    boxShadow: `0 8px 28px ${m.color}25` },
                }}>
                  <Box sx={{ width: { xs: 48, xl: 56 }, height: { xs: 48, xl: 56 },
                    borderRadius: '50%', mx: 'auto', mb: 1.2, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: `${m.color}18`, border: `2px solid ${m.color}35`,
                    fontSize: { xs: '1.4rem', xl: '1.7rem' } }}>
                    {m.emoji}
                  </Box>
                  <Typography sx={{ fontSize: { xs: '0.82rem', xl: '0.92rem' },
                    fontWeight: 800, color: m.color, mb: 0.3 }}>{m.name}</Typography>
                  <Typography sx={{ fontSize: { xs: '0.62rem', xl: '0.7rem' },
                    color: 'rgba(255,255,255,0.35)', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.role}</Typography>
                </Box>
              </FadeIn>
            ))}
          </Box>
        </Box>

        {/* ── Formulário de contato ──────────────────────────────── */}
        <Box id="contato" sx={{ px: { xs: 3, md: 6, xl: 10 }, py: { xs: 6, md: 8, xl: 10 } }}>
          <FadeIn>
            <Box sx={{
              maxWidth: { xs: '100%', md: 640, xl: 760 }, mx: 'auto',
              p: { xs: 3, md: 5, xl: 6 }, borderRadius: 4,
              background: 'rgba(13,13,13,0.9)',
              border: '1px solid rgba(255,144,57,0.15)',
              backdropFilter: 'blur(32px)',
            }}>
              <Typography sx={{ fontSize: { xs: '0.6rem', xl: '0.7rem' }, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em', color: 'primary.main', mb: 1 }}>
                Diagnóstico gratuito
              </Typography>
              <Typography sx={{ fontSize: { xs: '1.5rem', md: '1.9rem', xl: '2.3rem' },
                fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, mb: 0.8 }}>
                Vamos falar sobre<br />o seu negócio?
              </Typography>
              <Typography sx={{ fontSize: { xs: '0.85rem', xl: '0.95rem' },
                color: 'rgba(255,255,255,0.4)', mb: 3.5, lineHeight: 1.6 }}>
                Preencha abaixo e um especialista entra em contato pelo WhatsApp.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Seu nome" fullWidth size="small"
                  value={nome} onChange={e => setNome(e.target.value)}
                  sx={inputSx}
                />
                <TextField
                  label="WhatsApp / Telefone" fullWidth size="small"
                  value={telefone} onChange={e => setTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  sx={inputSx}
                />
                <TextField
                  select label="Segmento do negócio" fullWidth size="small"
                  value={nicho} onChange={e => setNicho(e.target.value)}
                  sx={inputSx}
                  SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: 'rgba(20,20,20,0.98)', border: '1px solid rgba(255,255,255,0.1)' } } } }}
                >
                  {NICHO_OPTIONS.map(o => (
                    <MenuItem key={o} value={o} sx={{ fontSize: '0.85rem' }}>{o}</MenuItem>
                  ))}
                </TextField>

                <Button
                  onClick={handleContact}
                  variant="contained" fullWidth size="large"
                  startIcon={<WhatsAppIcon />}
                  sx={{
                    background: 'linear-gradient(135deg, #ff9039, #ff5339)', color: '#000',
                    fontWeight: 800, fontSize: { xs: '0.95rem', xl: '1.05rem' },
                    py: { xs: 1.4, xl: 1.7 }, borderRadius: 2.5, mt: 0.5,
                    boxShadow: '0 8px 28px rgba(255,144,57,0.35)',
                    '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-2px)', boxShadow: '0 12px 36px rgba(255,144,57,0.5)' },
                    transition: 'all 0.2s ease',
                  }}>
                  Falar com a Digital Scale
                </Button>

                <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.2)',
                  textAlign: 'center', lineHeight: 1.5 }}>
                  Sem compromisso. Seus dados são usados apenas para entrar em contato com você.
                </Typography>
              </Box>
            </Box>
          </FadeIn>
        </Box>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <Box sx={{
          px: { xs: 3, md: 6, xl: 10 }, py: 3,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 2,
        }}>
          <Box component="img" src="/logotipo.png" sx={{ height: { xs: 22, xl: 26 }, opacity: 0.4 }} />
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button href={IG_LINK} target="_blank" rel="noopener noreferrer" size="small"
              startIcon={<InstagramIcon sx={{ fontSize: '14px !important' }} />}
              sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)',
                '&:hover': { color: 'primary.main' } }}>
              @agenciadigitalscale
            </Button>
            <Button href={WA_LINK} target="_blank" rel="noopener noreferrer" size="small"
              startIcon={<WhatsAppIcon sx={{ fontSize: '14px !important' }} />}
              sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)',
                '&:hover': { color: 'primary.main' } }}>
              (11) 99729-5407
            </Button>
          </Box>
          <Typography sx={{ fontSize: { xs: '0.62rem', xl: '0.7rem' }, color: 'rgba(255,255,255,0.15)' }}>
            © 2026 Digital Scale · Marketing Digital
          </Typography>
        </Box>

        <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity="warning" onClose={() => setSnack('')} sx={{ fontSize: '0.82rem' }}>
            {snack}
          </Alert>
        </Snackbar>

      </Box>
    </ThemeProvider>
  )
}
