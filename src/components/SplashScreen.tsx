import { useEffect, useState, useRef } from 'react'
import { Box, Typography, TextField, Button, CircularProgress, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'

const TEAM_MEMBERS = [
  { label: 'Sócio',                emoji: '👑', color: '#FFD700', glow: 'rgba(255,215,0,0.3)'   },
  { label: 'Head/editor de vídeo', emoji: '🎬', color: '#ff9039', glow: 'rgba(255,144,57,0.3)'  },
  { label: 'Gestor de tráfego',    emoji: '📈', color: '#00C47A', glow: 'rgba(0,196,122,0.25)'  },
  { label: 'Social media',         emoji: '📱', color: '#3B8EFF', glow: 'rgba(59,142,255,0.25)' },
  { label: 'Design',               emoji: '🎨', color: '#C084FC', glow: 'rgba(192,132,252,0.25)'},
  { label: 'Atendimento',          emoji: '💬', color: '#FB7185', glow: 'rgba(251,113,133,0.25)'},
  { label: 'Outro',                emoji: '👤', color: '#94A3B8', glow: 'rgba(148,163,184,0.18)'},
]

interface Props {
  showLogin: boolean
  onFinish: () => void
  onLogin: (name: string) => void
}

type Phase = 'enter' | 'hold' | 'login' | 'password' | 'exit'

export default function SplashScreen({ showLogin, onFinish, onLogin }: Props) {
  const theme   = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))

  const [phase, setPhase]           = useState<Phase>('enter')
  const [customName, setCustomName] = useState('')
  const [hovered, setHovered]       = useState<string | null>(null)
  const [selecting, setSelecting]   = useState<string | null>(null)

  // password phase
  const [configuredRoles, setConfiguredRoles] = useState<string[]>([])
  const [selectedRole, setSelectedRole]       = useState<typeof TEAM_MEMBERS[0] | null>(null)
  const [passwordInput, setPasswordInput]     = useState('')
  const [pwError, setPwError]                 = useState(false)
  const [pwLoading, setPwLoading]             = useState(false)
  const pwInputRef = useRef<HTMLInputElement>(null)

  // fetch which roles have passwords configured
  useEffect(() => {
    fetch('/api/role-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check' }),
    })
      .then(r => r.json())
      .then((d: { configured?: string[] }) => setConfiguredRoles(d.configured ?? []))
      .catch(() => {})
  }, [])

  // phase transitions
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

  // auto-focus password input when phase switches to 'password'
  useEffect(() => {
    if (phase === 'password') {
      setTimeout(() => pwInputRef.current?.focus(), 200)
    }
  }, [phase])

  function doLogin(name: string) {
    onLogin(name)
    setPhase('exit')
    setTimeout(() => onFinish(), 550)
  }

  function handleSelect(name: string) {
    if (configuredRoles.includes(name)) {
      const member = TEAM_MEMBERS.find(m => m.label === name) ?? null
      setSelectedRole(member)
      setPasswordInput('')
      setPwError(false)
      setPhase('password')
    } else {
      setSelecting(name)
      setTimeout(() => doLogin(name), 300)
    }
  }

  async function handlePasswordSubmit() {
    if (!selectedRole || !passwordInput.trim() || pwLoading) return
    setPwLoading(true)
    try {
      const res  = await fetch('/api/role-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', role: selectedRole.label, password: passwordInput }),
      })
      const data = await res.json() as { ok: boolean }
      if (data.ok) {
        doLogin(selectedRole.label)
      } else {
        setPwError(true)
        setPasswordInput('')
        setTimeout(() => { setPwError(false); pwInputRef.current?.focus() }, 900)
      }
    } catch {
      // API unavailable — let them in
      doLogin(selectedRole.label)
    } finally {
      setPwLoading(false)
    }
  }

  const isLogin    = phase === 'login'
  const isPassword = phase === 'password'
  const isExit     = phase === 'exit'

  // ── Password form (shared between desktop right panel & mobile) ──
  function PasswordForm({ compact = false }: { compact?: boolean }) {
    if (!selectedRole) return null
    const { label, emoji, color, glow } = selectedRole
    return (
      <Box sx={{
        display: 'flex', flexDirection: 'column', gap: 2,
        animation: 'panelSlideIn 0.4s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        {/* Back */}
        <Box
          onClick={() => setPhase('login')}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.8, cursor: 'pointer',
            width: 'fit-content',
            '&:hover span': { color: color },
          }}
        >
          <Typography component="span" sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', transition: 'color 0.15s' }}>←</Typography>
          <Typography component="span" sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', transition: 'color 0.15s' }}>Voltar</Typography>
        </Box>

        {/* Role badge */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: compact ? 1.5 : 2, px: compact ? 2 : 2.5, borderRadius: 2.5, background: `${color}0d`, border: `1.5px solid ${color}30` }}>
          <Box sx={{ width: compact ? 44 : 54, height: compact ? 44 : 54, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}18`, border: `1px solid ${color}40`, fontSize: compact ? '1.5rem' : '1.8rem', boxShadow: `0 4px 20px ${glow}`, flexShrink: 0 }}>
            {emoji}
          </Box>
          <Box>
            <Typography sx={{ fontSize: compact ? '0.65rem' : '0.7rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Entrando como
            </Typography>
            <Typography sx={{ fontSize: compact ? '1rem' : '1.15rem', fontWeight: 800, color, letterSpacing: '-0.02em', textShadow: `0 0 18px ${glow}` }}>
              {label}
            </Typography>
          </Box>
        </Box>

        {/* Password input */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
            Senha de acesso
          </Typography>
          <TextField
            inputRef={pwInputRef}
            fullWidth
            size="small"
            type="password"
            placeholder="••••••••"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit() }}
            autoComplete="current-password"
            error={pwError}
            helperText={pwError ? 'Senha incorreta. Tente novamente.' : ''}
            sx={{
              '@keyframes shake': {
                '0%,100%': { transform: 'translateX(0)' },
                '20%,60%': { transform: 'translateX(-6px)' },
                '40%,80%': { transform: 'translateX(6px)' },
              },
              animation: pwError ? 'shake 0.45s ease' : 'none',
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 2,
                fontSize: '1.05rem',
                letterSpacing: '0.12em',
                '& fieldset': { borderColor: pwError ? '#FF4545' : `${color}30` },
                '&:hover fieldset': { borderColor: pwError ? '#FF4545' : `${color}60` },
                '&.Mui-focused fieldset': { borderColor: pwError ? '#FF4545' : color },
              },
              '& input::placeholder': { color: 'rgba(255,255,255,0.18)', opacity: 1, letterSpacing: '0.06em' },
              '& .MuiFormHelperText-root': { color: '#FF4545', fontSize: '0.7rem', mt: 0.5 },
            }}
          />
        </Box>

        <Button
          variant="contained"
          fullWidth
          onClick={handlePasswordSubmit}
          disabled={!passwordInput.trim() || pwLoading}
          sx={{
            py: 1.3,
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            color: '#000',
            fontWeight: 800,
            fontSize: '0.92rem',
            letterSpacing: '0.04em',
            borderRadius: 2,
            boxShadow: `0 4px 24px ${glow}`,
            '&:hover': { filter: 'brightness(1.1)', boxShadow: `0 6px 32px ${glow}` },
            '&.Mui-disabled': { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.2)' },
          }}
        >
          {pwLoading ? <CircularProgress size={20} sx={{ color: '#000' }} /> : 'Entrar'}
        </Button>

        <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.22)', textAlign: 'center' }}>
          Sem senha definida? Fale com o Sócio.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex',
      flexDirection: isDesktop && (isLogin || isPassword) ? 'row' : 'column',
      alignItems:   isDesktop && (isLogin || isPassword) ? 'stretch' : 'center',
      justifyContent: isDesktop && (isLogin || isPassword) ? 'stretch' : 'center',
      overflowY: (!isDesktop && (isLogin || isPassword)) ? 'auto' : 'hidden',
      background: '#000',
      opacity: isExit ? 0 : 1,
      transition: isExit ? 'opacity 0.55s ease' : 'none',
      '@keyframes nebulaShift': {
        '0%,100%': { transform: 'scale(1) translate(0,0)' },
        '33%':     { transform: 'scale(1.06) translate(2%,-2%)' },
        '66%':     { transform: 'scale(0.97) translate(-1%,2%)' },
      },
      '@keyframes logoIn': {
        '0%':   { opacity: 0, transform: 'scale(0.62) translateY(36px)', filter: 'blur(22px) brightness(3)' },
        '60%':  { filter: 'blur(3px) brightness(1.6)' },
        '100%': { opacity: 1, transform: 'scale(1) translateY(0)',        filter: 'blur(0) brightness(1)' },
      },
      '@keyframes shimmer': {
        '0%':   { backgroundPosition: '-300% center' },
        '100%': { backgroundPosition: '300% center' },
      },
      '@keyframes cardIn': {
        '0%':   { opacity: 0, transform: 'translateX(-24px) rotateY(-8deg)' },
        '100%': { opacity: 1, transform: 'translateX(0) rotateY(0deg)'      },
      },
      '@keyframes orbitSpin': {
        from: { transform: 'rotate(0deg)' },
        to:   { transform: 'rotate(360deg)' },
      },
      '@keyframes particleRise': {
        '0%':   { opacity: 0, transform: 'translateY(0) scale(1)' },
        '20%':  { opacity: 1 },
        '100%': { opacity: 0, transform: 'translateY(-180px) scale(0.5)' },
      },
      '@keyframes ringExpand': {
        '0%':   { transform: 'scale(0.7)', opacity: 0.55 },
        '100%': { transform: 'scale(2.4)', opacity: 0 },
      },
      '@keyframes glowBreath': {
        '0%,100%': { opacity: 0.5, transform: 'scale(1)'   },
        '50%':     { opacity: 0.9, transform: 'scale(1.1)' },
      },
      '@keyframes panelSlideIn': {
        '0%':   { opacity: 0, transform: 'translateX(40px)' },
        '100%': { opacity: 1, transform: 'translateX(0)'    },
      },
    }}>

      {/* ══════════════════════════════════════════════════════
          LEFT / FULL PANEL — branding + visual effects
      ══════════════════════════════════════════════════════ */}
      <Box sx={{
        position: isDesktop && (isLogin || isPassword) ? 'relative' : 'absolute',
        inset:    isDesktop && (isLogin || isPassword) ? 'auto' : 0,
        width:    isDesktop && (isLogin || isPassword) ? '50%' : '100%',
        height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
        background: isDesktop && (isLogin || isPassword)
          ? 'radial-gradient(ellipse 110% 90% at 40% 55%, #1a0800 0%, #0d0400 55%, #000 100%)'
          : 'radial-gradient(ellipse 120% 80% at 50% 60%, #1a0800 0%, #0d0400 55%, #000 100%)',
      }}>
        {/* Fumaça laranja — camadas de névoa degradê */}
        {[
          { w: 900, h: 600, x: '20%',  y: '60%', c: 'radial-gradient(ellipse, rgba(255,120,30,0.18) 0%, rgba(255,60,0,0.06) 50%, transparent 72%)',  d: '11s', del: '0s'   },
          { w: 700, h: 500, x: '75%',  y: '40%', c: 'radial-gradient(ellipse, rgba(255,90,0,0.14)  0%, rgba(200,40,0,0.05) 55%, transparent 72%)',   d: '14s', del: '1.8s' },
          { w: 800, h: 550, x: '50%',  y: '80%', c: 'radial-gradient(ellipse, rgba(255,144,57,0.1) 0%, rgba(255,80,0,0.04) 55%, transparent 72%)',   d: '9s',  del: '0.6s' },
          { w: 600, h: 400, x: '15%',  y: '25%', c: 'radial-gradient(ellipse, rgba(255,70,0,0.12)  0%, rgba(180,30,0,0.04) 55%, transparent 72%)',   d: '16s', del: '2.5s' },
          { w: 500, h: 380, x: '85%',  y: '75%', c: 'radial-gradient(ellipse, rgba(255,160,40,0.1) 0%, rgba(255,100,0,0.03) 55%, transparent 72%)',  d: '12s', del: '1s'   },
        ].map((n, i) => (
          <Box key={i} sx={{
            position: 'absolute', borderRadius: '50%', filter: 'blur(72px)', pointerEvents: 'none',
            width: n.w, height: n.h, left: n.x, top: n.y,
            background: n.c, transform: 'translate(-50%,-50%)',
            animation: `nebulaShift ${n.d} ${n.del} ease-in-out infinite`,
          }} />
        ))}

        {/* Orbit rings (intro only) — só tons quentes */}
        {!isLogin && !isPassword && [280, 390, 500].map((r, i) => (
          <Box key={i} sx={{
            position: 'absolute', width: r, height: r, borderRadius: '50%', pointerEvents: 'none',
            border: `1px solid ${['rgba(255,144,57,0.22)','rgba(255,80,0,0.14)','rgba(255,180,60,0.09)'][i]}`,
            animation: `orbitSpin ${[18,28,42][i]}s linear infinite`,
          }}>
            <Box sx={{
              position: 'absolute', top: -4, left: '50%', width: 7, height: 7, borderRadius: '50%',
              bgcolor: ['#ff9039','#ff5339','#ffb040'][i],
              boxShadow: `0 0 14px 4px ${['rgba(255,144,57,0.7)','rgba(255,83,57,0.6)','rgba(255,176,64,0.55)'][i]}`,
            }} />
          </Box>
        ))}

        {/* Expanding rings on hold — laranja */}
        {phase === 'hold' && [0,1,2].map(i => (
          <Box key={i} sx={{
            position: 'absolute', width: 160, height: 160, borderRadius: '50%', pointerEvents: 'none',
            border: `2.5px solid ${['rgba(255,144,57,0.55)','rgba(255,100,30,0.38)','rgba(255,60,0,0.25)'][i]}`,
            animation: `ringExpand 1.8s ${i * 0.4}s ease-out forwards`,
          }} />
        ))}

        {/* Central glow — laranja puro */}
        {!isLogin && !isPassword && (
          <Box sx={{
            position: 'absolute', width: 320, height: 320, borderRadius: '50%', pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(255,120,30,0.32) 0%, rgba(255,60,0,0.12) 50%, transparent 80%)',
            filter: 'blur(32px)', animation: 'glowBreath 3s ease-in-out infinite',
          }} />
        )}

        {/* Partículas — só laranja e âmbar */}
        {Array.from({ length: 22 }, (_, i) => {
          const angle  = (i / 22) * Math.PI * 2
          const radius = 72 + (i % 5) * 28
          return (
            <Box key={i} sx={{
              position: 'absolute', pointerEvents: 'none',
              width: 2 + (i % 3), height: 2 + (i % 3), borderRadius: '50%',
              bgcolor: ['rgba(255,144,57,0.95)','rgba(255,100,30,0.85)','rgba(255,60,0,0.8)','rgba(255,190,60,0.75)'][i % 4],
              left: `calc(50% + ${Math.cos(angle) * radius}px)`,
              top:  `calc(50% + ${Math.sin(angle) * radius}px)`,
              animation: `particleRise ${2 + (i % 4) * 0.7}s ${(i * 0.14) % 2}s ease-out infinite`,
            }} />
          )
        })}

        {/* ── LOGO ── */}
        <Box sx={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: isLogin || isPassword ? 1.5 : 2.5,
          pt: (!isDesktop && (isLogin || isPassword)) ? { xs: 6 } : 0,
          opacity: phase === 'enter' ? 0 : 1,
          animation: (phase === 'enter' || phase === 'hold')
            ? 'logoIn 1s cubic-bezier(0.16,1,0.3,1) forwards' : 'none',
        }}>
          <Box
            component="img" src="/logotipo.png" alt="Digital Scale"
            sx={{
              width: isDesktop && (isLogin || isPassword)
                ? { md: 200, lg: 240, xl: 280 }
                : (isLogin || isPassword)
                ? { xs: 110, sm: 130 }
                : { xs: 170, sm: 220 },
              height: 'auto',
              filter: 'drop-shadow(0 0 32px rgba(255,120,30,0.7)) drop-shadow(0 0 80px rgba(255,80,0,0.35))',
              transition: 'width 0.55s cubic-bezier(0.16,1,0.3,1)',
            }}
          />

          {(!(isLogin || isPassword) || isDesktop) && (
            <Box sx={{
              fontSize: isDesktop && (isLogin || isPassword) ? { md: '0.78rem', lg: '0.85rem' } : { xs: '0.65rem', sm: '0.72rem' },
              fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase',
              background: 'linear-gradient(90deg, rgba(255,144,57,0.5) 0%, #fff3d6 30%, #ff9039 52%, #ffb347 72%, rgba(255,144,57,0.5) 100%)',
              backgroundSize: '300% auto',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              animation: 'shimmer 3.5s 0.5s linear infinite',
              userSelect: 'none',
            }}>
              Agência de Marketing Digital
            </Box>
          )}

          {isDesktop && (isLogin || isPassword) && (
            <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 40, height: 1, bgcolor: 'rgba(255,144,57,0.35)' }} />
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textAlign: 'center', lineHeight: 1.8 }}>
                PAINEL OPERACIONAL<br />Digital Scale · {new Date().getFullYear()}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* ══════════════════════════════════════════════════════
          RIGHT PANEL (desktop) — login or password
      ══════════════════════════════════════════════════════ */}
      {isDesktop && (isLogin || isPassword) ? (
        <Box sx={{
          width: '50%', height: '100%',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          overflowY: 'auto', px: { md: 5, lg: 7, xl: 9 }, py: 4,
          background: 'rgba(6,6,6,0.92)',
          borderLeft: '1px solid rgba(255,144,57,0.1)',
          animation: 'panelSlideIn 0.55s cubic-bezier(0.16,1,0.3,1) forwards',
          backdropFilter: 'blur(8px)',
          position: 'relative', zIndex: 10,
        }}>
          {isPassword ? (
            <PasswordForm />
          ) : (
            <>
              <Typography sx={{
                fontSize: { md: '1.6rem', lg: '2rem', xl: '2.2rem' },
                fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', mb: 0.5, lineHeight: 1.1,
              }}>
                Quem vai usar
              </Typography>
              <Typography sx={{
                fontSize: { md: '1.6rem', lg: '2rem', xl: '2.2rem' },
                fontWeight: 900, letterSpacing: '-0.03em', mb: 3, lineHeight: 1.1,
                background: 'linear-gradient(135deg, #ff9039, #ff5339)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                hoje?
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: { md: 0.85, lg: 1 }, perspective: '1200px' }}>
                {TEAM_MEMBERS.map(({ label, emoji, color, glow }, idx) => {
                  const isHov = hovered === label
                  const isSel = selecting === label
                  const hasPw = configuredRoles.includes(label)
                  return (
                    <Box
                      key={label}
                      onClick={() => handleSelect(label)}
                      onMouseEnter={() => setHovered(label)}
                      onMouseLeave={() => setHovered(null)}
                      sx={{
                        display: 'flex', alignItems: 'center',
                        gap: { md: 2, lg: 2.5 },
                        px: { md: 2.5, lg: 3 }, py: { md: 1.3, lg: 1.5 },
                        cursor: 'pointer', borderRadius: 2.5,
                        background: isHov ? `linear-gradient(135deg, ${color}14, ${color}07)` : 'rgba(255,255,255,0.03)',
                        border: `1.5px solid ${isHov ? `${color}50` : 'rgba(255,255,255,0.07)'}`,
                        boxShadow: isHov ? `0 8px 36px ${glow}, inset 0 0 24px ${color}07` : 'none',
                        transform: isSel ? 'scale(0.97)' : isHov ? 'translateX(8px) scale(1.01)' : 'none',
                        transition: 'all 0.18s cubic-bezier(0.16,1,0.3,1)',
                        animation: `cardIn 0.45s ${0.04 * idx}s cubic-bezier(0.16,1,0.3,1) both`,
                      }}
                    >
                      <Box sx={{
                        width: { md: 44, lg: 50, xl: 54 }, height: { md: 44, lg: 50, xl: 54 },
                        borderRadius: 2, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isHov ? `${color}15` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isHov ? `${color}40` : 'rgba(255,255,255,0.08)'}`,
                        fontSize: { md: '1.4rem', lg: '1.6rem' },
                        boxShadow: isHov ? `0 4px 20px ${glow}` : 'none',
                        transition: 'all 0.18s ease',
                        transform: isHov ? 'scale(1.1)' : 'scale(1)',
                      }}>
                        {emoji}
                      </Box>
                      <Typography sx={{
                        flex: 1,
                        fontSize: { md: '1rem', lg: '1.1rem', xl: '1.18rem' },
                        fontWeight: 700,
                        color: isHov ? color : 'rgba(255,255,255,0.82)',
                        letterSpacing: '-0.015em',
                        transition: 'color 0.15s',
                        textShadow: isHov ? `0 0 20px ${glow}` : 'none',
                      }}>
                        {label}
                      </Typography>
                      {/* Lock indicator */}
                      {hasPw && (
                        <Typography sx={{ fontSize: '0.7rem', mr: 0.5, opacity: isHov ? 0.9 : 0.35 }}>🔐</Typography>
                      )}
                      <Box sx={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isHov ? `${color}20` : 'transparent',
                        border: `1px solid ${isHov ? `${color}45` : 'rgba(255,255,255,0.1)'}`,
                        transition: 'all 0.18s ease',
                        transform: isHov ? 'translateX(3px)' : 'none',
                      }}>
                        <Typography sx={{ fontSize: '0.78rem', color: isHov ? color : 'rgba(255,255,255,0.2)', lineHeight: 1 }}>→</Typography>
                      </Box>
                    </Box>
                  )
                })}
              </Box>

              <Box sx={{ mt: { md: 2.5, lg: 3 }, pt: 2, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.28)', mb: 1.2, display: 'block' }}>
                  Ou digite seu nome
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth size="small" placeholder="Seu nome..."
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && customName.trim()) handleSelect(customName.trim()) }}
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
                    onClick={() => customName.trim() && handleSelect(customName.trim())}
                    disabled={!customName.trim()}
                    sx={{
                      bgcolor: '#ff9039', color: '#000', fontWeight: 800, borderRadius: 1.5,
                      px: 3, whiteSpace: 'nowrap', flexShrink: 0,
                      '&:hover': { bgcolor: '#ffaa60', boxShadow: '0 4px 20px rgba(255,144,57,0.5)' },
                      '&.Mui-disabled': { bgcolor: 'rgba(255,144,57,0.18)', color: 'rgba(255,255,255,0.2)' },
                    }}
                  >
                    Entrar
                  </Button>
                </Box>
              </Box>
            </>
          )}
        </Box>

      ) : (isLogin || isPassword) ? (
        /* ── MOBILE — single column ── */
        <Box sx={{
          position: 'relative', zIndex: 10,
          width: '100%', maxWidth: 420,
          px: { xs: 2.5, sm: 4 }, pt: 2.5, pb: { xs: 6, sm: 7 },
        }}>
          {isPassword ? (
            <PasswordForm compact />
          ) : (
            <>
              <Typography sx={{
                textAlign: 'center', mb: 2.5,
                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)',
              }}>
                Quem vai usar hoje?
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.9, perspective: '800px' }}>
                {TEAM_MEMBERS.map(({ label, emoji, color, glow }, idx) => {
                  const isSel = selecting === label
                  const hasPw = configuredRoles.includes(label)
                  return (
                    <Box
                      key={label}
                      onClick={() => handleSelect(label)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 2,
                        px: 2.5, py: 1.4, cursor: 'pointer', borderRadius: 2,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1.5px solid rgba(255,144,57,0.13)',
                        transition: 'all 0.15s ease',
                        transform: isSel ? 'scale(0.97)' : 'none',
                        animation: `cardIn 0.45s ${0.05 * idx}s cubic-bezier(0.16,1,0.3,1) both`,
                        '&:active': { background: `${color}15`, borderColor: `${color}50`, transform: 'scale(0.97)' },
                        '&:hover':  { background: `${color}10`, borderColor: `${color}40`, transform: 'translateX(4px)', boxShadow: `0 6px 24px ${glow}` },
                      }}
                    >
                      <Box sx={{ width: 44, height: 44, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}12`, border: `1px solid ${color}30`, fontSize: '1.4rem' }}>
                        {emoji}
                      </Box>
                      <Typography sx={{ flex: 1, fontSize: '1rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                        {label}
                      </Typography>
                      {hasPw && <Typography sx={{ fontSize: '0.65rem', opacity: 0.45 }}>🔐</Typography>}
                      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.2)' }}>→</Typography>
                    </Box>
                  )
                })}
              </Box>

              <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', mb: 1 }}>
                  Ou digite seu nome
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth size="small" placeholder="Seu nome..."
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && customName.trim()) handleSelect(customName.trim()) }}
                    autoComplete="off"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#fff', background: 'rgba(255,255,255,0.04)', borderRadius: 1.5,
                        '& fieldset': { borderColor: 'rgba(255,144,57,0.2)' },
                        '&:hover fieldset': { borderColor: 'rgba(255,144,57,0.45)' },
                        '&.Mui-focused fieldset': { borderColor: '#ff9039' },
                      },
                      '& input::placeholder': { color: 'rgba(255,255,255,0.25)', opacity: 1 },
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={() => customName.trim() && handleSelect(customName.trim())}
                    disabled={!customName.trim()}
                    sx={{
                      bgcolor: '#ff9039', color: '#000', fontWeight: 800, borderRadius: 1.5,
                      px: 2.5, whiteSpace: 'nowrap', flexShrink: 0,
                      '&:hover': { bgcolor: '#ffaa60' },
                      '&.Mui-disabled': { bgcolor: 'rgba(255,144,57,0.18)', color: 'rgba(255,255,255,0.2)' },
                    }}
                  >
                    Entrar
                  </Button>
                </Box>
              </Box>
            </>
          )}
        </Box>
      ) : null}

      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '18%', background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)', pointerEvents: 'none', zIndex: 1 }} />
    </Box>
  )
}
