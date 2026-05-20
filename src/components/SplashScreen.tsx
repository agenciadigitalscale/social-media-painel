import { useEffect, useState } from 'react'
import { Box, Typography, TextField, Button } from '@mui/material'

const TEAM_MEMBERS = [
  { label: 'Sócio',                emoji: '👑', color: '#FFD700', glow: 'rgba(255,215,0,0.35)' },
  { label: 'Head/editor de vídeo', emoji: '🎬', color: '#ff9039', glow: 'rgba(255,144,57,0.35)' },
  { label: 'Gestor de tráfego',    emoji: '📈', color: '#00C47A', glow: 'rgba(0,196,122,0.3)'  },
  { label: 'Social media',         emoji: '📱', color: '#3B8EFF', glow: 'rgba(59,142,255,0.3)' },
  { label: 'Design',               emoji: '🎨', color: '#C084FC', glow: 'rgba(192,132,252,0.3)'},
  { label: 'Atendimento',          emoji: '💬', color: '#FB7185', glow: 'rgba(251,113,133,0.3)'},
  { label: 'Outro',                emoji: '👤', color: '#94A3B8', glow: 'rgba(148,163,184,0.2)'},
]

interface Props {
  showLogin: boolean
  onFinish: () => void
  onLogin: (name: string) => void
}

export default function SplashScreen({ showLogin, onFinish, onLogin }: Props) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'login' | 'exit'>('enter')
  const [customName, setCustomName] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)
  const [selecting, setSelecting] = useState<string | null>(null)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 700)
    if (!showLogin) {
      const t2 = setTimeout(() => setPhase('exit'), 2400)
      const t3 = setTimeout(() => onFinish(), 2900)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    } else {
      const t2 = setTimeout(() => setPhase('login'), 1500)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [showLogin, onFinish])

  function handleSelect(name: string, color: string) {
    setSelecting(name)
    setTimeout(() => {
      onLogin(name)
      setPhase('exit')
      setTimeout(() => onFinish(), 600)
    }, 350)
  }

  const isLogin = phase === 'login'
  const isExit  = phase === 'exit'

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: isLogin ? 'flex-start' : 'center',
      overflowY: isLogin ? 'auto' : 'hidden',
      background: '#000',
      opacity: isExit ? 0 : 1,
      transition: isExit ? 'opacity 0.6s ease' : 'none',

      /* ─ keyframes ─ */
      '@keyframes nebulaShift': {
        '0%,100%': { transform: 'scale(1) translate(0,0)' },
        '33%':     { transform: 'scale(1.08) translate(2%,-2%)' },
        '66%':     { transform: 'scale(0.96) translate(-2%,3%)' },
      },
      '@keyframes logoIn': {
        '0%':   { opacity: 0, transform: 'scale(0.6) translateY(40px)', filter: 'blur(24px) brightness(3)' },
        '60%':  { filter: 'blur(3px) brightness(1.6)' },
        '100%': { opacity: 1, transform: 'scale(1) translateY(0)',      filter: 'blur(0) brightness(1)' },
      },
      '@keyframes shimmer': {
        '0%':   { backgroundPosition: '-300% center' },
        '100%': { backgroundPosition: '300% center' },
      },
      '@keyframes cardIn': {
        '0%':   { opacity: 0, transform: 'translateX(-32px) rotateY(-12deg)' },
        '100%': { opacity: 1, transform: 'translateX(0)    rotateY(0deg)'    },
      },
      '@keyframes orbitSpin': {
        '0%':   { transform: 'rotate(0deg)'   },
        '100%': { transform: 'rotate(360deg)' },
      },
      '@keyframes particleRise': {
        '0%':   { opacity: 0, transform: 'translateY(0) scale(1)' },
        '20%':  { opacity: 1 },
        '100%': { opacity: 0, transform: 'translateY(-200px) scale(0.5)' },
      },
      '@keyframes ringExpand': {
        '0%':   { transform: 'scale(0.7)', opacity: 0.6 },
        '100%': { transform: 'scale(2.2)', opacity: 0   },
      },
      '@keyframes glowBreath': {
        '0%,100%': { opacity: 0.55, transform: 'scale(1)'    },
        '50%':     { opacity: 0.9,  transform: 'scale(1.12)' },
      },
      '@keyframes selectFlash': {
        '0%':   { opacity: 1 },
        '50%':  { opacity: 0.3 },
        '100%': { opacity: 1 },
      },
    }}>

      {/* ── Deep nebula layers ── */}
      {[
        { w: 700, h: 500, x: '15%',  y: '60%', c: 'radial-gradient(ellipse, rgba(180,40,0,0.22) 0%, transparent 70%)',  d: '8s',  del: '0s'   },
        { w: 600, h: 420, x: '75%',  y: '50%', c: 'radial-gradient(ellipse, rgba(100,0,200,0.2) 0%,  transparent 70%)', d: '11s', del: '1.5s' },
        { w: 800, h: 550, x: '45%',  y: '75%', c: 'radial-gradient(ellipse, rgba(255,60,0,0.12) 0%,  transparent 70%)', d: '9s',  del: '0.8s' },
        { w: 500, h: 350, x: '25%',  y: '30%', c: 'radial-gradient(ellipse, rgba(60,0,140,0.15) 0%,  transparent 70%)', d: '13s', del: '2s'   },
      ].map((n, i) => (
        <Box key={i} sx={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(70px)',
          width: n.w, height: n.h, left: n.x, top: n.y,
          background: n.c,
          transform: 'translate(-50%,-50%)',
          animation: `nebulaShift ${n.d} ${n.del} ease-in-out infinite`,
        }} />
      ))}

      {/* ── Orbit ring (intro only) ── */}
      {!isLogin && [280, 380, 480].map((r, i) => (
        <Box key={i} sx={{
          position: 'absolute', width: r, height: r, borderRadius: '50%',
          border: `1px solid ${['rgba(255,120,0,0.18)','rgba(160,0,255,0.14)','rgba(255,50,0,0.1)'][i]}`,
          animation: `orbitSpin ${[18,28,40][i]}s linear infinite`,
        }}>
          <Box sx={{
            position: 'absolute',
            top: -3, left: '50%',
            width: 6, height: 6, borderRadius: '50%',
            bgcolor: ['#ff9039','#a855f7','#ff5339'][i],
            boxShadow: `0 0 12px 4px ${['rgba(255,144,57,0.6)','rgba(168,85,247,0.6)','rgba(255,83,57,0.6)'][i]}`,
          }} />
        </Box>
      ))}

      {/* ── Expanding rings on logo entrance ── */}
      {phase === 'hold' && [0,1,2].map(i => (
        <Box key={i} sx={{
          position: 'absolute', width: 180, height: 180, borderRadius: '50%',
          border: `2px solid ${['rgba(255,144,57,0.5)','rgba(200,50,255,0.4)','rgba(255,60,0,0.3)'][i]}`,
          animation: `ringExpand 1.8s ${i * 0.4}s ease-out forwards`,
        }} />
      ))}

      {/* ── Central glow ── */}
      {!isLogin && (
        <Box sx={{
          position: 'absolute', width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,110,20,0.32) 0%, rgba(130,0,220,0.18) 50%, transparent 80%)',
          filter: 'blur(28px)',
          animation: 'glowBreath 3s ease-in-out infinite',
        }} />
      )}

      {/* ── Particles ── */}
      {Array.from({ length: 24 }, (_, i) => {
        const angle  = (i / 24) * Math.PI * 2
        const radius = 70 + (i % 5) * 30
        return (
          <Box key={i} sx={{
            position: 'absolute',
            width: 2 + (i % 3),
            height: 2 + (i % 3),
            borderRadius: '50%',
            bgcolor: [
              'rgba(255,144,57,0.95)',
              'rgba(180,80,255,0.9)',
              'rgba(255,60,0,0.85)',
              'rgba(255,200,50,0.8)',
            ][i % 4],
            left: `calc(50% + ${Math.cos(angle) * radius}px)`,
            top:  `calc(50% + ${Math.sin(angle) * radius}px)`,
            animation: `particleRise ${2 + (i % 4) * 0.7}s ${(i * 0.15) % 2}s ease-out infinite`,
          }} />
        )
      })}

      {/* ── LOGO ── */}
      <Box sx={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        pt: isLogin ? { xs: 6, sm: 8 } : 0,
        gap: isLogin ? 0.5 : 2,
        opacity: phase === 'enter' ? 0 : 1,
        animation: (phase === 'hold' || phase === 'enter')
          ? 'logoIn 1s cubic-bezier(0.16,1,0.3,1) forwards'
          : 'none',
        transition: 'padding 0.6s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <Box
          component="img"
          src="/logotipo.png"
          alt="Digital Scale"
          sx={{
            width: isLogin
              ? { xs: 90, sm: 115 }
              : { xs: 170, sm: 220 },
            height: 'auto',
            filter: isLogin
              ? 'drop-shadow(0 0 16px rgba(255,100,0,0.5))'
              : 'drop-shadow(0 0 36px rgba(255,100,0,0.65)) drop-shadow(0 0 80px rgba(160,0,255,0.4))',
            transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1), filter 0.6s ease',
          }}
        />

        {/* Tagline (intro only) */}
        {!isLogin && (
          <Box sx={{
            fontSize: { xs: '0.65rem', sm: '0.72rem' },
            fontWeight: 800, letterSpacing: '0.25em', textTransform: 'uppercase',
            background: 'linear-gradient(90deg, rgba(255,144,57,0.5) 0%, #fff8e1 35%, #ff9039 55%, rgba(200,100,255,0.9) 80%, rgba(255,144,57,0.5) 100%)',
            backgroundSize: '300% auto',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            animation: 'shimmer 3s 0.5s linear infinite',
            userSelect: 'none',
          }}>
            Agência de Marketing Digital
          </Box>
        )}
      </Box>

      {/* ── LOGIN SECTION ── */}
      {isLogin && (
        <Box sx={{
          position: 'relative', zIndex: 10,
          width: '100%', maxWidth: 440,
          px: { xs: 2.5, sm: 4 }, pt: 2.5, pb: { xs: 6, sm: 7 },
        }}>

          {/* Label */}
          <Typography sx={{
            textAlign: 'center', mb: 3,
            fontSize: { xs: '1.1rem', sm: '1.25rem' },
            fontWeight: 900,
            letterSpacing: '-0.01em',
            color: 'rgba(255,255,255,0.9)',
          }}>
            Quem vai usar hoje?
          </Typography>

          {/* Cards 3D */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, perspective: '1000px' }}>
            {TEAM_MEMBERS.map(({ label, emoji, color, glow }, idx) => {
              const isHov = hovered === label
              const isSel = selecting === label
              return (
                <Box
                  key={label}
                  onClick={() => handleSelect(label, color)}
                  onMouseEnter={() => setHovered(label)}
                  onMouseLeave={() => setHovered(null)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 2.5,
                    px: { xs: 2.5, sm: 3 }, py: { xs: 1.5, sm: 1.7 },
                    cursor: 'pointer', borderRadius: 2.5,
                    background: isHov
                      ? `linear-gradient(135deg, ${color}18, ${color}08)`
                      : 'rgba(255,255,255,0.035)',
                    border: `1.5px solid ${isHov ? `${color}55` : 'rgba(255,255,255,0.07)'}`,
                    boxShadow: isHov ? `0 8px 32px ${glow}, inset 0 0 20px ${color}08` : 'none',
                    transform: isSel
                      ? 'scale(0.97)'
                      : isHov
                      ? 'translateX(6px) rotateY(-2deg) scale(1.01)'
                      : 'translateX(0) rotateY(0) scale(1)',
                    transition: 'all 0.18s cubic-bezier(0.16,1,0.3,1)',
                    animation: isSel ? 'selectFlash 0.35s ease' : `cardIn 0.45s ${0.05 * idx}s cubic-bezier(0.16,1,0.3,1) both`,
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {/* Emoji */}
                  <Box sx={{
                    width: { xs: 42, sm: 48 }, height: { xs: 42, sm: 48 },
                    borderRadius: 2, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isHov ? `${color}18` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isHov ? `${color}40` : 'rgba(255,255,255,0.08)'}`,
                    fontSize: { xs: '1.5rem', sm: '1.65rem' },
                    boxShadow: isHov ? `0 4px 20px ${glow}` : 'none',
                    transition: 'all 0.18s ease',
                    transform: isHov ? 'scale(1.1) translateZ(8px)' : 'scale(1) translateZ(0)',
                  }}>
                    {emoji}
                  </Box>

                  {/* Label */}
                  <Typography sx={{
                    flex: 1,
                    fontSize: { xs: '1rem', sm: '1.08rem' },
                    fontWeight: 700,
                    color: isHov ? color : 'rgba(255,255,255,0.85)',
                    letterSpacing: '-0.01em',
                    transition: 'color 0.15s ease',
                    textShadow: isHov ? `0 0 20px ${glow}` : 'none',
                  }}>
                    {label}
                  </Typography>

                  {/* Arrow indicator */}
                  <Box sx={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isHov ? `${color}22` : 'transparent',
                    border: `1px solid ${isHov ? `${color}50` : 'rgba(255,255,255,0.1)'}`,
                    transition: 'all 0.18s ease',
                    transform: isHov ? 'translateX(2px)' : 'none',
                  }}>
                    <Typography sx={{ fontSize: '0.75rem', color: isHov ? color : 'rgba(255,255,255,0.2)', lineHeight: 1 }}>
                      →
                    </Typography>
                  </Box>
                </Box>
              )
            })}
          </Box>

          {/* Custom name */}
          <Box sx={{ mt: 3, pt: 2.5, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', mb: 1.2, display: 'block', textAlign: 'center' }}>
              Ou digite seu nome
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth size="small"
                placeholder="Seu nome..."
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && customName.trim()) handleSelect(customName.trim(), '#ff9039') }}
                autoComplete="off"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff', background: 'rgba(255,255,255,0.04)', borderRadius: 1.5,
                    '& fieldset': { borderColor: 'rgba(255,144,57,0.2)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,144,57,0.4)' },
                    '&.Mui-focused fieldset': { borderColor: '#ff9039' },
                  },
                  '& input::placeholder': { color: 'rgba(255,255,255,0.22)', opacity: 1 },
                }}
              />
              <Button
                variant="contained"
                onClick={() => customName.trim() && handleSelect(customName.trim(), '#ff9039')}
                disabled={!customName.trim()}
                sx={{
                  bgcolor: '#ff9039', color: '#000', fontWeight: 800, borderRadius: 1.5,
                  px: 3, whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.85rem',
                  '&:hover': { bgcolor: '#ffaa60', boxShadow: '0 4px 20px rgba(255,144,57,0.5)' },
                  '&.Mui-disabled': { bgcolor: 'rgba(255,144,57,0.18)', color: 'rgba(255,255,255,0.2)' },
                }}
              >
                Entrar
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Bottom vignette ── */}
      <Box sx={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '20%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
        pointerEvents: 'none', zIndex: 1,
      }} />
    </Box>
  )
}
