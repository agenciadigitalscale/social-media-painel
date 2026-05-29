import { useEffect, useRef, useState } from 'react'
import { Box, Typography, Button, Chip, ThemeProvider, CssBaseline } from '@mui/material'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import InstagramIcon from '@mui/icons-material/Instagram'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import BrushIcon from '@mui/icons-material/Brush'
import VideocamIcon from '@mui/icons-material/Videocam'
import EditNoteIcon from '@mui/icons-material/EditNote'
import CampaignIcon from '@mui/icons-material/Campaign'
import theme from '../theme'

const WA_LINK = 'https://wa.me/5511997295407?text=Olá! Vi o site da Digital Scale e tenho interesse em gerenciar minhas redes sociais.'

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
  { value: '17',  label: 'clientes ativos' },
  { value: '226', label: 'conteúdos por mês' },
  { value: '5',   label: 'serviços integrados' },
  { value: '100%', label: 'foco em resultado' },
]

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
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

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <ThemeProvider theme={theme}><CssBaseline />
      <Box sx={{
        minHeight: '100vh', bgcolor: '#080808', color: 'text.primary',
        fontFamily: '"Inter", system-ui, sans-serif',
        scrollBehavior: 'smooth',
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
            <Button
              href="/"
              size="small"
              sx={{ fontSize: { xs: '0.72rem', xl: '0.82rem' }, color: 'text.secondary', fontWeight: 600,
                '&:hover': { color: 'primary.main' } }}
            >
              Área da equipe
            </Button>
            <Button
              href={WA_LINK} target="_blank" rel="noopener noreferrer"
              variant="contained" size="small"
              startIcon={<WhatsAppIcon sx={{ fontSize: '15px !important' }} />}
              sx={{
                background: 'linear-gradient(135deg, #ff9039, #ff5339)',
                color: '#000', fontWeight: 800,
                fontSize: { xs: '0.72rem', xl: '0.82rem' },
                borderRadius: 2, px: 2,
                boxShadow: '0 4px 14px rgba(255,144,57,0.3)',
                '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
                transition: 'all 0.2s ease',
              }}
            >
              Falar no WhatsApp
            </Button>
          </Box>
        </Box>

        {/* ── Hero ───────────────────────────────────────────────── */}
        <Box sx={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          px: { xs: 3, md: 6, xl: 10 }, textAlign: 'center',
          position: 'relative', overflow: 'hidden',
          pt: 10,
        }}>
          {/* Glow atmosférico */}
          <Box sx={{
            position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
            width: { xs: 400, md: 700, xl: 900 }, height: { xs: 400, md: 700, xl: 900 },
            background: 'radial-gradient(circle, rgba(255,144,57,0.07) 0%, transparent 70%)',
            pointerEvents: 'none',
            animation: 'glowBreath 7s ease-in-out infinite',
            '@keyframes glowBreath': {
              '0%,100%': { opacity: 0.7, transform: 'translate(-50%,-50%) scale(1)' },
              '50%': { opacity: 1, transform: 'translate(-50%,-50%) scale(1.08)' },
            },
          }} />

          <FadeIn>
            <Chip
              label="Agência de Marketing Digital"
              size="small"
              sx={{
                mb: 3, fontSize: { xs: '0.62rem', xl: '0.72rem' }, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                bgcolor: 'rgba(255,144,57,0.1)', color: 'primary.main',
                border: '1px solid rgba(255,144,57,0.3)',
              }}
            />
          </FadeIn>

          <FadeIn delay={0.1}>
            <Typography sx={{
              fontSize: { xs: '2.2rem', sm: '3rem', md: '3.8rem', lg: '4.4rem', xl: '5.2rem' },
              fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.04em',
              mb: 1, maxWidth: { md: 800, xl: 960 },
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
              <Button
                href={WA_LINK} target="_blank" rel="noopener noreferrer"
                variant="contained" size="large"
                startIcon={<WhatsAppIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #ff9039, #ff5339)',
                  color: '#000', fontWeight: 800,
                  fontSize: { xs: '0.9rem', xl: '1rem' },
                  px: { xs: 3, xl: 4 }, py: { xs: 1.4, xl: 1.7 },
                  borderRadius: 2.5,
                  boxShadow: '0 8px 28px rgba(255,144,57,0.35)',
                  '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-2px)', boxShadow: '0 12px 36px rgba(255,144,57,0.45)' },
                  transition: 'all 0.2s ease',
                }}
              >
                Quero começar agora
              </Button>
              <Button
                href="#servicos"
                variant="outlined" size="large"
                sx={{
                  borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)',
                  fontWeight: 700, fontSize: { xs: '0.9rem', xl: '1rem' },
                  px: { xs: 3, xl: 4 }, py: { xs: 1.4, xl: 1.7 },
                  borderRadius: 2.5,
                  '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'rgba(255,144,57,0.06)' },
                  transition: 'all 0.2s ease',
                }}
              >
                Ver serviços
              </Button>
            </Box>
          </FadeIn>

          {/* Scroll indicator */}
          <Box sx={{
            position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
            opacity: 0.3, animation: 'bounce 2s ease-in-out infinite',
            '@keyframes bounce': { '0%,100%': { transform: 'translateX(-50%) translateY(0)' }, '50%': { transform: 'translateX(-50%) translateY(8px)' } },
          }}>
            <Box sx={{ width: 1.5, height: 32, bgcolor: 'rgba(255,255,255,0.4)', borderRadius: 1 }} />
          </Box>
        </Box>

        {/* ── Stats ──────────────────────────────────────────────── */}
        <Box sx={{ px: { xs: 3, md: 6, xl: 10 }, py: { xs: 6, md: 8, xl: 10 } }}>
          <FadeIn>
            <Box sx={{
              display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(4,1fr)' },
              gap: 2,
            }}>
              {STATS.map((s) => (
                <Box key={s.label} sx={{
                  p: { xs: 2.5, xl: 3.5 }, borderRadius: 3, textAlign: 'center',
                  background: 'rgba(255,144,57,0.05)',
                  border: '1px solid rgba(255,144,57,0.12)',
                  backdropFilter: 'blur(20px)',
                }}>
                  <Typography sx={{
                    fontSize: { xs: '2.2rem', md: '2.8rem', xl: '3.4rem' },
                    fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1,
                    background: 'linear-gradient(135deg, #ff9039, #ff5339)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    mb: 0.5,
                  }}>
                    {s.value}
                  </Typography>
                  <Typography sx={{
                    fontSize: { xs: '0.72rem', xl: '0.85rem' },
                    color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    {s.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </FadeIn>
        </Box>

        {/* ── Serviços ───────────────────────────────────────────── */}
        <Box id="servicos" sx={{ px: { xs: 3, md: 6, xl: 10 }, py: { xs: 6, md: 8, xl: 10 } }}>
          <FadeIn>
            <Typography sx={{
              fontSize: { xs: '0.6rem', xl: '0.7rem' }, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'primary.main', mb: 1,
            }}>
              O que fazemos
            </Typography>
            <Typography sx={{
              fontSize: { xs: '1.8rem', md: '2.4rem', xl: '3rem' },
              fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, mb: 1,
            }}>
              Tudo que sua marca precisa,
            </Typography>
            <Typography sx={{
              fontSize: { xs: '1.8rem', md: '2.4rem', xl: '3rem' },
              fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1,
              color: 'rgba(255,255,255,0.35)', mb: 5,
            }}>
              em um único lugar.
            </Typography>
          </FadeIn>

          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)', xl: 'repeat(5,1fr)' },
            gap: 2,
          }}>
            {SERVICES.map((s, i) => (
              <FadeIn key={s.title} delay={i * 0.08}>
                <Box sx={{
                  p: { xs: 2.5, xl: 3 }, borderRadius: 3, height: '100%',
                  background: 'rgba(13,13,13,0.82)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(28px)',
                  transition: 'all 0.2s ease',
                  cursor: 'default',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    border: `1px solid ${s.color}30`,
                    boxShadow: `0 12px 40px ${s.glow}`,
                  },
                }}>
                  <Box sx={{
                    width: 52, height: 52, borderRadius: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: `${s.color}18`, color: s.color, mb: 2,
                    border: `1px solid ${s.color}28`,
                  }}>
                    {s.icon}
                  </Box>
                  <Typography sx={{
                    fontSize: { xs: '0.92rem', xl: '1rem' }, fontWeight: 800,
                    color: 'text.primary', mb: 1,
                  }}>
                    {s.title}
                  </Typography>
                  <Typography sx={{
                    fontSize: { xs: '0.78rem', xl: '0.88rem' },
                    color: 'rgba(255,255,255,0.45)', lineHeight: 1.6,
                  }}>
                    {s.desc}
                  </Typography>
                </Box>
              </FadeIn>
            ))}
          </Box>
        </Box>

        {/* ── Nichos ─────────────────────────────────────────────── */}
        <Box sx={{ px: { xs: 3, md: 6, xl: 10 }, py: { xs: 6, md: 8, xl: 10 } }}>
          <FadeIn>
            <Typography sx={{
              fontSize: { xs: '0.6rem', xl: '0.7rem' }, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'primary.main', mb: 1,
            }}>
              Nichos atendidos
            </Typography>
            <Typography sx={{
              fontSize: { xs: '1.8rem', md: '2.4rem', xl: '3rem' },
              fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, mb: 5,
            }}>
              Seu segmento tem jeito próprio.<br />
              <Box component="span" sx={{ color: 'rgba(255,255,255,0.35)' }}>
                A gente entende o seu.
              </Box>
            </Typography>
          </FadeIn>

          <Box sx={{
            display: 'flex', flexWrap: 'wrap', gap: 1.5,
          }}>
            {NICHOS.map((n, i) => (
              <FadeIn key={n.label} delay={i * 0.05}>
                <Box sx={{
                  px: 2, py: 1.2, borderRadius: 2.5,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', gap: 1,
                  transition: 'all 0.2s ease',
                  cursor: 'default',
                  '&:hover': {
                    bgcolor: 'rgba(255,144,57,0.06)',
                    borderColor: 'rgba(255,144,57,0.2)',
                    transform: 'translateY(-1px)',
                  },
                }}>
                  <Typography sx={{ fontSize: { xs: '1.1rem', xl: '1.3rem' } }}>{n.emoji}</Typography>
                  <Typography sx={{
                    fontSize: { xs: '0.8rem', xl: '0.9rem' },
                    fontWeight: 700, color: 'rgba(255,255,255,0.65)',
                  }}>
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
            <Typography sx={{
              fontSize: { xs: '0.6rem', xl: '0.7rem' }, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'primary.main', mb: 1,
            }}>
              O time
            </Typography>
            <Typography sx={{
              fontSize: { xs: '1.8rem', md: '2.4rem', xl: '3rem' },
              fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, mb: 5,
            }}>
              Especialistas dedicados{' '}
              <Box component="span" sx={{ color: 'rgba(255,255,255,0.35)' }}>
                à sua marca.
              </Box>
            </Typography>
          </FadeIn>

          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(6,1fr)' },
            gap: 2,
          }}>
            {TEAM.map((m, i) => (
              <FadeIn key={m.name} delay={i * 0.07}>
                <Box sx={{
                  p: { xs: 2, xl: 2.5 }, borderRadius: 3, textAlign: 'center',
                  background: 'rgba(13,13,13,0.82)',
                  border: `1px solid ${m.color}18`,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    border: `1px solid ${m.color}40`,
                    boxShadow: `0 8px 28px ${m.color}25`,
                  },
                }}>
                  <Box sx={{
                    width: { xs: 48, xl: 56 }, height: { xs: 48, xl: 56 },
                    borderRadius: '50%', mx: 'auto', mb: 1.2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${m.color}18`,
                    border: `2px solid ${m.color}35`,
                    fontSize: { xs: '1.4rem', xl: '1.7rem' },
                  }}>
                    {m.emoji}
                  </Box>
                  <Typography sx={{
                    fontSize: { xs: '0.82rem', xl: '0.92rem' },
                    fontWeight: 800, color: m.color, mb: 0.3,
                  }}>
                    {m.name}
                  </Typography>
                  <Typography sx={{
                    fontSize: { xs: '0.62rem', xl: '0.7rem' },
                    color: 'rgba(255,255,255,0.35)', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {m.role}
                  </Typography>
                </Box>
              </FadeIn>
            ))}
          </Box>
        </Box>

        {/* ── CTA Final ──────────────────────────────────────────── */}
        <Box sx={{ px: { xs: 3, md: 6, xl: 10 }, py: { xs: 8, md: 12, xl: 14 } }}>
          <FadeIn>
            <Box sx={{
              p: { xs: 4, md: 6, xl: 8 }, borderRadius: 4, textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(255,144,57,0.08) 0%, rgba(255,83,57,0.06) 50%, rgba(8,8,8,0) 100%)',
              border: '1px solid rgba(255,144,57,0.15)',
              backdropFilter: 'blur(20px)',
              position: 'relative', overflow: 'hidden',
            }}>
              <Box sx={{
                position: 'absolute', top: '-40%', right: '-10%',
                width: { xs: 200, md: 400, xl: 500 }, height: { xs: 200, md: 400, xl: 500 },
                background: 'radial-gradient(circle, rgba(255,144,57,0.08) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />

              <Typography sx={{
                fontSize: { xs: '0.6rem', xl: '0.7rem' }, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.12em',
                color: 'primary.main', mb: 2,
              }}>
                Pronto para crescer?
              </Typography>
              <Typography sx={{
                fontSize: { xs: '1.8rem', md: '2.8rem', xl: '3.4rem' },
                fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, mb: 1.5,
              }}>
                Vamos conversar sobre<br />o seu negócio.
              </Typography>
              <Typography sx={{
                fontSize: { xs: '0.9rem', md: '1.1rem', xl: '1.2rem' },
                color: 'rgba(255,255,255,0.45)', mb: 4, lineHeight: 1.6,
              }}>
                Diagnóstico gratuito. Sem compromisso.
              </Typography>

              <Button
                href={WA_LINK} target="_blank" rel="noopener noreferrer"
                variant="contained" size="large"
                startIcon={<WhatsAppIcon sx={{ fontSize: '22px !important' }} />}
                sx={{
                  background: 'linear-gradient(135deg, #ff9039, #ff5339)',
                  color: '#000', fontWeight: 800,
                  fontSize: { xs: '1rem', xl: '1.15rem' },
                  px: { xs: 4, xl: 5 }, py: { xs: 1.6, xl: 2 },
                  borderRadius: 2.5,
                  boxShadow: '0 8px 32px rgba(255,144,57,0.4)',
                  '&:hover': {
                    filter: 'brightness(1.08)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 14px 40px rgba(255,144,57,0.55)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                Falar com a Digital Scale
              </Button>
            </Box>
          </FadeIn>
        </Box>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <Box sx={{
          px: { xs: 3, md: 6, xl: 10 }, py: 3,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 1,
        }}>
          <Box component="img" src="/logotipo.png" sx={{ height: { xs: 22, xl: 26 }, opacity: 0.4 }} />
          <Typography sx={{ fontSize: { xs: '0.62rem', xl: '0.7rem' }, color: 'rgba(255,255,255,0.2)' }}>
            © 2026 Digital Scale · Agência de Marketing Digital
          </Typography>
        </Box>

      </Box>
    </ThemeProvider>
  )
}
