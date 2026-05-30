import { useRef } from 'react'
import {
  ThemeProvider, CssBaseline, Box, Typography, Button, Container,
} from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import CheckIcon from '@mui/icons-material/Check'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PeopleIcon from '@mui/icons-material/People'
import BarChartIcon from '@mui/icons-material/BarChart'
import theme, { DS } from '../theme'

// ─── Substitua pelo número real da agência ───────────────────────
const WHATSAPP = '5521000000000'
const EMAIL = 'agenciadigitalscale@gmail.com'
const INSTAGRAM = 'https://instagram.com/agenciadigitalscale'

const kf = {
  '@keyframes fadeUp': {
    from: { opacity: 0, transform: 'translateY(28px)' },
    to:   { opacity: 1, transform: 'translateY(0)' },
  },
  '@keyframes glowPulse': {
    '0%,100%': { opacity: 0.5 },
    '50%':     { opacity: 0.9 },
  },
  '@keyframes gradShift': {
    '0%':   { backgroundPosition: '0% 50%' },
    '50%':  { backgroundPosition: '100% 50%' },
    '100%': { backgroundPosition: '0% 50%' },
  },
}

function Navbar({ onGoApp }: { onGoApp: () => void }) {
  return (
    <Box
      component="nav"
      sx={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: { xs: 56, md: 64 },
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: { xs: 2.5, md: 5 },
        bgcolor: 'rgba(8,9,14,0.82)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${DS.border}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          component="img"
          src="/logotipo.png"
          alt="Digital Scale"
          sx={{ height: { xs: 28, md: 34 }, objectFit: 'contain' }}
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2 } }}>
        <Button
          size="small"
          onClick={onGoApp}
          sx={{
            fontSize: { xs: '0.72rem', md: '0.78rem' },
            color: DS.t2,
            fontWeight: 500,
            '&:hover': { color: DS.t1 },
          }}
        >
          Acesso da equipe
        </Button>
        <Button
          size="small"
          variant="outlined"
          href={`https://wa.me/${WHATSAPP}?text=Olá, quero saber mais sobre a Digital Scale!`}
          target="_blank"
          sx={{
            fontSize: { xs: '0.72rem', md: '0.78rem' },
            fontWeight: 700,
            borderColor: `${DS.orange}60`,
            color: DS.orange,
            borderRadius: 2,
            px: { xs: 1.5, md: 2 },
            '&:hover': { borderColor: DS.orange, bgcolor: `${DS.orange}10` },
          }}
        >
          Fale conosco
        </Button>
      </Box>
    </Box>
  )
}

function Hero({
  onSelectEmpresa,
  onSelectAgencia,
}: {
  onSelectEmpresa: () => void
  onSelectAgencia: () => void
}) {
  return (
    <Box
      sx={{
        ...kf,
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pt: { xs: 10, md: 12 },
        pb: 10,
        position: 'relative',
        overflow: 'hidden',
        // Grid de fundo
        '&::before': {
          content: '""',
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `
            linear-gradient(${DS.grid} 1px, transparent 1px),
            linear-gradient(90deg, ${DS.grid} 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        },
      }}
    >
      {/* Glows atmosféricos */}
      <Box sx={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: { xs: 400, md: 700 }, height: { xs: 400, md: 700 },
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(249,115,22,0.09) 0%, transparent 65%)',
        pointerEvents: 'none',
        animation: 'glowPulse 6s ease-in-out infinite',
      }} />
      <Box sx={{
        position: 'absolute', bottom: '10%', right: '10%',
        width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(249,115,22,0.05) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        {/* Overline badge */}
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 1,
          px: 2, py: 0.75, borderRadius: 99,
          bgcolor: `${DS.orange}10`, border: `1px solid ${DS.orange}30`,
          mb: 4, animation: 'fadeUp 0.5s ease both',
        }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: DS.orange, boxShadow: `0 0 8px ${DS.orange}` }} />
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: DS.orange, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Agência de Social Media
          </Typography>
        </Box>

        {/* H1 */}
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: '2.4rem', sm: '3.2rem', md: '4rem', xl: '4.8rem' },
            fontWeight: 900,
            letterSpacing: '-0.04em',
            lineHeight: 1.06,
            color: DS.t1,
            mb: 2.5,
            animation: 'fadeUp 0.55s 0.08s ease both',
          }}
        >
          Resultados reais.{' '}
          <Box
            component="span"
            sx={{
              background: `linear-gradient(135deg, ${DS.orange}, #ff5339)`,
              backgroundSize: '200% 200%',
              animation: 'gradShift 4s ease infinite',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Nas redes
          </Box>{' '}
          que importam.
        </Typography>

        {/* Subtítulo */}
        <Typography sx={{
          fontSize: { xs: '1rem', md: '1.15rem', xl: '1.25rem' },
          color: DS.t2, lineHeight: 1.65,
          maxWidth: 580, mx: 'auto', mb: 6,
          animation: 'fadeUp 0.55s 0.16s ease both',
        }}>
          Cuidamos do social media da sua empresa com estratégia, design e consistência.
          E se você for uma agência, temos uma tecnologia que vai transformar sua operação.
        </Typography>

        {/* Audience selector */}
        <Box sx={{
          display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
          gap: 2, justifyContent: 'center', alignItems: 'stretch',
          animation: 'fadeUp 0.55s 0.24s ease both',
        }}>
          <AudienceCard
            emoji="🏢"
            title="Sou uma empresa"
            sub="Quero crescer nas redes sociais"
            onClick={onSelectEmpresa}
            accent={DS.orange}
          />
          <AudienceCard
            emoji="🏛️"
            title="Sou uma agência"
            sub="Quero um painel profissional"
            onClick={onSelectAgencia}
            accent="#C084FC"
          />
        </Box>

        {/* Scroll hint */}
        <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, opacity: 0.3 }}>
          <Box sx={{
            width: 1.5, height: 32, bgcolor: DS.t2, borderRadius: 2,
            position: 'relative', overflow: 'hidden',
            '&::after': {
              content: '""', position: 'absolute', top: '-100%', left: 0, right: 0,
              height: '60%', bgcolor: DS.orange, borderRadius: 2,
              animation: 'scrollDot 1.8s ease-in-out infinite',
            },
            '@keyframes scrollDot': {
              '0%':   { top: '-60%' },
              '100%': { top: '160%' },
            },
          }} />
          <Typography sx={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: DS.t3 }}>
            scroll
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}

function AudienceCard({
  emoji, title, sub, onClick, accent,
}: {
  emoji: string; title: string; sub: string; onClick: () => void; accent: string
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        flex: 1, maxWidth: { sm: 280 },
        p: 3, borderRadius: 3,
        bgcolor: 'rgba(255,255,255,0.025)',
        border: `1px solid rgba(255,255,255,0.07)`,
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1.5,
        transition: 'all 0.22s ease',
        '&:hover': {
          bgcolor: `${accent}0a`,
          border: `1px solid ${accent}40`,
          transform: 'translateY(-3px)',
          boxShadow: `0 12px 32px ${accent}15`,
        },
      }}
    >
      <Typography sx={{ fontSize: '2rem', lineHeight: 1 }}>{emoji}</Typography>
      <Box>
        <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: DS.t1, letterSpacing: '-0.02em' }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', color: DS.t2, mt: 0.5 }}>
          {sub}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: accent, fontSize: '0.78rem', fontWeight: 700, mt: 'auto' }}>
        Ver mais <ArrowForwardIcon sx={{ fontSize: 14 }} />
      </Box>
    </Box>
  )
}

function SectionEmpresas() {
  const benefits = [
    { icon: '📅', title: 'Planejamento mensal', desc: 'Calendário editorial feito para o seu negócio, com antecedência e consistência.' },
    { icon: '🎨', title: 'Design profissional', desc: 'Peças gráficas e vídeos que comunicam e convertem, não só "ficam bonitas".' },
    { icon: '📊', title: 'Resultados mensuráveis', desc: 'Relatório mensal com alcance, engajamento e crescimento real da sua conta.' },
    { icon: '✅', title: 'Aprovação fácil', desc: 'Você aprova cada post antes de publicar pelo nosso portal exclusivo.' },
    { icon: '🤖', title: 'IA na produção', desc: 'Legendas, roteiros e ideias criadas com IA e revisadas pela nossa equipe.' },
    { icon: '💬', title: 'Suporte direto', desc: 'Comunicação ágil via WhatsApp. Sua agência sempre disponível.' },
  ]

  const pains = ['Sem tempo para postar todo dia', 'Conteúdo sem estratégia definida', 'Não sabe se está gerando resultado']

  return (
    <Box sx={{ py: { xs: 10, md: 14 }, bgcolor: 'rgba(249,115,22,0.02)', borderTop: `1px solid ${DS.border}` }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ mb: 8, maxWidth: 600 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box sx={{ width: 3, height: 24, borderRadius: 2, bgcolor: DS.orange }} />
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: DS.orange, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Para empresas
            </Typography>
          </Box>
          <Typography component="h2" sx={{
            fontSize: { xs: '2rem', md: '2.8rem', xl: '3.2rem' },
            fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, color: DS.t1, mb: 2,
          }}>
            Foque no seu negócio.<br />A gente cuida das redes.
          </Typography>
          <Typography sx={{ fontSize: '1rem', color: DS.t2, lineHeight: 1.7 }}>
            Você não precisa entender de algoritmo. Precisa de uma equipe que entenda — e que entregue resultado.
          </Typography>

          {/* Pain chips */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 3 }}>
            {pains.map(p => (
              <Box key={p} sx={{
                px: 1.5, py: 0.6, borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.08)`,
                display: 'flex', alignItems: 'center', gap: 0.75,
              }}>
                <Typography sx={{ fontSize: '0.72rem', color: DS.t3 }}>⚠️ {p}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Benefits grid */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 2, mb: 8,
        }}>
          {benefits.map(b => (
            <Box key={b.title} sx={{
              p: 3, borderRadius: 3,
              bgcolor: DS.surface, border: `1px solid ${DS.border}`,
              transition: 'all 0.2s ease',
              '&:hover': { border: `1px solid ${DS.borderHov}`, transform: 'translateY(-2px)' },
            }}>
              <Typography sx={{ fontSize: '1.6rem', mb: 1.5 }}>{b.icon}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: DS.t1, mb: 0.75 }}>{b.title}</Typography>
              <Typography sx={{ fontSize: '0.82rem', color: DS.t2, lineHeight: 1.6 }}>{b.desc}</Typography>
            </Box>
          ))}
        </Box>

        {/* CTA */}
        <Box sx={{
          p: { xs: 4, md: 6 }, borderRadius: 4,
          background: `linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(255,83,57,0.05) 100%)`,
          border: `1px solid rgba(249,115,22,0.18)`,
          display: 'flex', flexDirection: { xs: 'column', md: 'row' },
          alignItems: { md: 'center' }, justifyContent: 'space-between', gap: 4,
        }}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.3rem', md: '1.6rem' }, color: DS.t1, mb: 1, letterSpacing: '-0.02em' }}>
              Pronto para começar?
            </Typography>
            <Typography sx={{ color: DS.t2, fontSize: '0.92rem' }}>
              Converse com a gente hoje. Sem compromisso, sem enrolação.
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<WhatsAppIcon />}
            href={`https://wa.me/${WHATSAPP}?text=Olá! Quero saber mais sobre a gestão de social media para minha empresa.`}
            target="_blank"
            sx={{
              background: 'linear-gradient(135deg, #25D366, #128C7E)',
              color: '#fff', fontWeight: 800, px: 4, py: 1.75,
              borderRadius: 2.5, fontSize: '0.92rem', whiteSpace: 'nowrap',
              boxShadow: '0 6px 20px rgba(37,211,102,0.25)',
              '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
              flexShrink: 0,
            }}
          >
            Quero uma proposta
          </Button>
        </Box>
      </Container>
    </Box>
  )
}

function SectionAgencias() {
  const features = [
    { icon: <DashboardIcon sx={{ fontSize: 20 }} />, title: 'Kanban por cliente', desc: 'Veja o status de cada conteúdo de todos os clientes em tempo real.' },
    { icon: <PeopleIcon sx={{ fontSize: 20 }} />, title: 'Portal de aprovação', desc: 'O cliente aprova posts online. Sem screenshots, sem WhatsApp lotado.' },
    { icon: <AutoAwesomeIcon sx={{ fontSize: 20 }} />, title: 'IA integrada', desc: 'Gere legendas, roteiros e ideias de pauta com um clique.' },
    { icon: <BarChartIcon sx={{ fontSize: 20 }} />, title: 'Relatórios automáticos', desc: 'Relatório mensal por cliente gerado em segundos com dados reais.' },
  ]

  const checklist = [
    'Gestão de múltiplos clientes em um só lugar',
    'Controle financeiro com alerta de inadimplência',
    'Agendamento visual com drag-and-drop',
    'Histórico completo de aprovações',
    'Notificações push para a equipe',
    'Funciona offline com sync automático',
    'Acesso por cargo com senhas individuais',
    'Deploy em Cloudflare — velocidade global',
  ]

  return (
    <Box sx={{ py: { xs: 10, md: 14 }, borderTop: `1px solid ${DS.border}` }}>
      <Container maxWidth="lg">
        <Box sx={{
          display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gap: { xs: 6, lg: 10 }, alignItems: 'center',
        }}>
          {/* Left: conteúdo */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Box sx={{ width: 3, height: 24, borderRadius: 2, bgcolor: '#C084FC' }} />
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#C084FC', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Para agências
              </Typography>
            </Box>
            <Typography component="h2" sx={{
              fontSize: { xs: '2rem', md: '2.8rem', xl: '3.2rem' },
              fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, color: DS.t1, mb: 2,
            }}>
              O painel que sua agência merecia ter.
            </Typography>
            <Typography sx={{ fontSize: '1rem', color: DS.t2, lineHeight: 1.7, mb: 4 }}>
              Desenvolvemos o DS HUB para gerenciar nossa própria operação com 17 clientes.
              Agora você pode usar a mesma tecnologia na sua agência.
            </Typography>

            {/* Checklist */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 5 }}>
              {checklist.map(item => (
                <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    bgcolor: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CheckIcon sx={{ fontSize: 12, color: '#C084FC' }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.88rem', color: DS.t1 }}>{item}</Typography>
                </Box>
              ))}
            </Box>

            {/* CTA agência */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<WhatsAppIcon />}
                href={`https://wa.me/${WHATSAPP}?text=Olá! Sou de uma agência e quero conhecer o DS HUB.`}
                target="_blank"
                sx={{
                  background: 'linear-gradient(135deg, #C084FC, #9333EA)',
                  color: '#fff', fontWeight: 800, px: 3.5, py: 1.75,
                  borderRadius: 2.5, fontSize: '0.9rem',
                  boxShadow: '0 6px 20px rgba(192,132,252,0.25)',
                  '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
                }}
              >
                Quero conhecer o DS HUB
              </Button>
              <Button
                variant="outlined"
                size="large"
                href={`mailto:${EMAIL}?subject=DS HUB - Interesse`}
                sx={{
                  borderColor: 'rgba(192,132,252,0.4)', color: '#C084FC',
                  fontWeight: 700, px: 3, py: 1.75, borderRadius: 2.5, fontSize: '0.9rem',
                  '&:hover': { borderColor: '#C084FC', bgcolor: 'rgba(192,132,252,0.06)' },
                }}
              >
                Enviar e-mail
              </Button>
            </Box>
          </Box>

          {/* Right: feature cards */}
          <Box sx={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2,
          }}>
            {features.map(f => (
              <Box key={f.title} sx={{
                p: 3, borderRadius: 3,
                bgcolor: DS.surface, border: `1px solid ${DS.border}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  border: '1px solid rgba(192,132,252,0.3)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 24px rgba(192,132,252,0.08)',
                },
              }}>
                <Box sx={{
                  width: 40, height: 40, borderRadius: 2, mb: 2,
                  bgcolor: 'rgba(192,132,252,0.1)', border: '1px solid rgba(192,132,252,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#C084FC',
                }}>
                  {f.icon}
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: DS.t1, mb: 0.75 }}>{f.title}</Typography>
                <Typography sx={{ fontSize: '0.78rem', color: DS.t2, lineHeight: 1.6 }}>{f.desc}</Typography>
              </Box>
            ))}

            {/* Mockup placeholder */}
            <Box sx={{
              gridColumn: '1 / -1', p: 3, borderRadius: 3,
              background: `linear-gradient(135deg, rgba(192,132,252,0.06) 0%, rgba(147,51,234,0.04) 100%)`,
              border: '1px solid rgba(192,132,252,0.12)',
              display: 'flex', alignItems: 'center', gap: 2,
            }}>
              <Typography sx={{ fontSize: '1.8rem' }}>🚀</Typography>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: DS.t1 }}>
                  Tecnologia da Digital Scale
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: DS.t2 }}>
                  React + Cloudflare D1 + Workers · Deploy global em segundos
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}

function Numbers() {
  const stats = [
    { value: '17+', label: 'Clientes ativos', emoji: '🏆' },
    { value: '200+', label: 'Posts por mês', emoji: '📸' },
    { value: '8', label: 'Membros de equipe', emoji: '👥' },
    { value: '100%', label: 'Online & offline', emoji: '☁️' },
  ]

  return (
    <Box sx={{ py: { xs: 8, md: 12 }, borderTop: `1px solid ${DS.border}`, bgcolor: DS.surfaceAlt }}>
      <Container maxWidth="lg">
        <Typography sx={{
          textAlign: 'center', fontSize: '0.7rem', fontWeight: 700,
          color: DS.t3, letterSpacing: '0.1em', textTransform: 'uppercase', mb: 6,
        }}>
          Nossa operação em números
        </Typography>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 3,
        }}>
          {stats.map(s => (
            <Box key={s.label} sx={{
              textAlign: 'center', p: 3, borderRadius: 3,
              bgcolor: DS.surface, border: `1px solid ${DS.border}`,
            }}>
              <Typography sx={{ fontSize: '1.8rem', mb: 1 }}>{s.emoji}</Typography>
              <Typography sx={{
                fontSize: { xs: '2rem', md: '2.4rem', xl: '2.8rem' },
                fontWeight: 900, letterSpacing: '-0.04em',
                background: `linear-gradient(135deg, ${DS.orange}, #ff5339)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                lineHeight: 1.1, mb: 0.75,
              }}>
                {s.value}
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: DS.t2 }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  )
}

function Footer({ onGoApp }: { onGoApp: () => void }) {
  return (
    <Box
      component="footer"
      sx={{ borderTop: `1px solid ${DS.border}`, py: { xs: 6, md: 8 } }}
    >
      <Container maxWidth="lg">
        <Box sx={{
          display: 'flex', flexDirection: { xs: 'column', md: 'row' },
          alignItems: { md: 'center' }, justifyContent: 'space-between',
          gap: 4,
        }}>
          {/* Logo + tagline */}
          <Box>
            <Box
              component="img"
              src="/logotipo.png"
              alt="Digital Scale"
              sx={{ height: 32, objectFit: 'contain', mb: 1.5, display: 'block' }}
            />
            <Typography sx={{ fontSize: '0.82rem', color: DS.t3, maxWidth: 260 }}>
              Gestão de social media que gera resultado.<br />
              Estratégia, design e tecnologia.
            </Typography>
          </Box>

          {/* Links */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: { md: 'flex-end' } }}>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Box
                component="a"
                href={INSTAGRAM}
                target="_blank"
                sx={{ fontSize: '0.82rem', color: DS.t2, textDecoration: 'none', '&:hover': { color: DS.t1 } }}
              >
                Instagram
              </Box>
              <Box
                component="a"
                href={`mailto:${EMAIL}`}
                sx={{ fontSize: '0.82rem', color: DS.t2, textDecoration: 'none', '&:hover': { color: DS.t1 } }}
              >
                E-mail
              </Box>
              <Box
                component="a"
                href={`https://wa.me/${WHATSAPP}`}
                target="_blank"
                sx={{ fontSize: '0.82rem', color: DS.t2, textDecoration: 'none', '&:hover': { color: DS.t1 } }}
              >
                WhatsApp
              </Box>
            </Box>
            <Box
              onClick={onGoApp}
              sx={{
                fontSize: '0.72rem', color: DS.t3, cursor: 'pointer',
                '&:hover': { color: DS.t2 }, transition: 'color 0.2s',
              }}
            >
              Equipe Digital Scale →
            </Box>
          </Box>
        </Box>

        <Box sx={{ mt: 6, pt: 3, borderTop: `1px solid ${DS.border}` }}>
          <Typography sx={{ fontSize: '0.7rem', color: DS.t3, textAlign: 'center' }}>
            © {new Date().getFullYear()} Digital Scale · Todos os direitos reservados
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}

export default function LandingPage() {
  const empresaRef = useRef<HTMLDivElement>(null)
  const agenciaRef = useRef<HTMLDivElement>(null)

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const goToApp = () => {
    window.location.href = '/app'
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ bgcolor: DS.bg, minHeight: '100dvh' }}>
        <Navbar onGoApp={goToApp} />
        <Hero
          onSelectEmpresa={() => scrollTo(empresaRef)}
          onSelectAgencia={() => scrollTo(agenciaRef)}
        />
        <Box ref={empresaRef}>
          <SectionEmpresas />
        </Box>
        <Box ref={agenciaRef}>
          <SectionAgencias />
        </Box>
        <Numbers />
        <Footer onGoApp={goToApp} />
      </Box>
    </ThemeProvider>
  )
}
