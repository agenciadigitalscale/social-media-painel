import { useEffect, useState, useRef } from 'react'
import { Box, Typography, TextField, Button, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { NAME_MAP, getUserInfo } from '../lib/users'

function detectUser(name: string): typeof NAME_MAP[string] | null {
  return getUserInfo(name)
}

interface Props {
  showLogin: boolean
  onFinish: () => void
  onLogin: (name: string) => void
}

type Phase = 'enter' | 'hold' | 'login' | 'loading' | 'exit'

const LOADING_MSGS = [
  'Sincronizando tarefas...',
  'Analisando aprovações...',
  'Atualizando operação...',
  'Carregando clientes...',
  'Iniciando ScaleOS...',
]

export default function SplashScreen({ showLogin, onFinish, onLogin }: Props) {
  const theme     = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))

  const [phase, setPhase]    = useState<Phase>('enter')
  const [name, setName]      = useState('')
  const [error, setError]    = useState(false)
  const [denied, setDenied]  = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Live clock ──
  const [clockStr, setClockStr] = useState(() =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
  useEffect(() => {
    const id = setInterval(() =>
      setClockStr(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    , 30000)
    return () => clearInterval(id)
  }, [])
  const nowHour = new Date().getHours()
  const greeting = nowHour < 12 ? '☀️ Bom dia' : nowHour < 18 ? '🌤 Boa tarde' : '🌙 Boa noite'
  const todayFull = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  // ── Senha de acesso ──
  const [step, setStep]       = useState<'password' | 'name'>(() =>
    sessionStorage.getItem('sm_pwd_ok') === '1' ? 'name' : 'password'
  )
  const [pwd, setPwd]         = useState('')
  const [pwdError, setPwdError] = useState(false)
  const pwdRef = useRef<HTMLInputElement>(null)

  const detected = detectUser(name)

  // phase transitions — sem piscar: logo entra, painel direito já aparece junto
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 700)
    if (!showLogin) {
      const t2 = setTimeout(() => setPhase('exit'), 2400)
      const t3 = setTimeout(() => onFinish(), 2900)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    } else {
      // Mostra o painel de login já junto com a intro — sem transição abrupta
      const t2 = setTimeout(() => {
        setPhase('login')
      }, 800)
      // Foca o input com delay para não cortar a animação
      const t3 = setTimeout(() => {
        if (step === 'password') pwdRef.current?.focus()
        else inputRef.current?.focus()
      }, 1200)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    }
  }, [showLogin, onFinish]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === 'name' && phase === 'login') {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [step, phase])

  useEffect(() => {
    if (phase !== 'loading') return
    const t = setInterval(() => setLoadingMsg(m => (m + 1) % LOADING_MSGS.length), 520)
    return () => clearInterval(t)
  }, [phase])

  function handleConfirm() {
    const trimmed = name.trim()
    if (!trimmed) { setError(true); setTimeout(() => setError(false), 800); return }
    const match = detectUser(trimmed)
    if (!match) {
      setDenied(true)
      setError(true)
      setTimeout(() => { setError(false); setDenied(false) }, 2500)
      return
    }
    onLogin(trimmed)
    setPhase('loading')
    setTimeout(() => {
      setPhase('exit')
      setTimeout(() => onFinish(), 550)
    }, 1800)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleConfirm()
  }

  function handlePasswordConfirm() {
    if (pwd.trim().toLowerCase() === 'dshub') {
      sessionStorage.setItem('sm_pwd_ok', '1')
      setStep('name')
    } else {
      setPwdError(true)
      setTimeout(() => setPwdError(false), 800)
    }
  }

  function handlePasswordKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handlePasswordConfirm()
  }

  const isLogin = phase === 'login'
  const isExit  = phase === 'exit'

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex',
      flexDirection: isDesktop ? 'row' : 'column',
      alignItems:   isDesktop ? 'stretch' : 'center',
      justifyContent: isDesktop ? 'stretch' : 'center',
      overflowY: (!isDesktop && isLogin) ? 'auto' : 'hidden',
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
        '100%': { opacity: 1, transform: 'scale(1) translateY(0)', filter: 'blur(0) brightness(1)' },
      },
      '@keyframes shimmer': {
        '0%':   { backgroundPosition: '-300% center' },
        '100%': { backgroundPosition: '300% center' },
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
      '@keyframes logoPulse': {
        '0%,100%': { filter: 'drop-shadow(0 0 28px rgba(255,120,30,0.75)) drop-shadow(0 0 70px rgba(255,80,0,0.4))' },
        '50%':     { filter: 'drop-shadow(0 0 48px rgba(255,150,40,1)) drop-shadow(0 0 120px rgba(255,100,0,0.7))' },
      },
      '@keyframes ringPulse': {
        '0%,100%': { transform: 'scale(1)',    opacity: 0.55 },
        '50%':     { transform: 'scale(1.08)', opacity: 0.9  },
      },
      '@keyframes ringPulse2': {
        '0%,100%': { transform: 'scale(1)',    opacity: 0.3  },
        '50%':     { transform: 'scale(1.12)', opacity: 0.65 },
      },
      '@keyframes shake': {
        '0%,100%': { transform: 'translateX(0)' },
        '20%,60%': { transform: 'translateX(-6px)' },
        '40%,80%': { transform: 'translateX(6px)' },
      },
      '@keyframes badgeIn': {
        '0%':   { opacity: 0, transform: 'translateY(8px) scale(0.92)' },
        '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
      },
    }}>

      {/* ══ LEFT / FULL PANEL — branding ══ */}
      <Box sx={{
        position: isDesktop ? 'relative' : 'absolute',
        inset:    isDesktop ? 'auto' : 0,
        width:    isDesktop ? '50%' : '100%',
        height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
        background: 'radial-gradient(ellipse 110% 90% at 40% 55%, #1a0800 0%, #0d0400 55%, #000 100%)',
      }}>
        {/* Fumaça laranja */}
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

        {/* Orbit rings */}
        {!isLogin && [280, 390, 500].map((r, i) => (
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

        {/* Expanding rings on hold */}
        {phase === 'hold' && [0,1,2].map(i => (
          <Box key={i} sx={{
            position: 'absolute', width: 160, height: 160, borderRadius: '50%', pointerEvents: 'none',
            border: `2.5px solid ${['rgba(255,144,57,0.55)','rgba(255,100,30,0.38)','rgba(255,60,0,0.25)'][i]}`,
            animation: `ringExpand 1.8s ${i * 0.4}s ease-out forwards`,
          }} />
        ))}

        {/* Central glow */}
        {!isLogin && (
          <Box sx={{
            position: 'absolute', width: 320, height: 320, borderRadius: '50%', pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(255,120,30,0.32) 0%, rgba(255,60,0,0.12) 50%, transparent 80%)',
            filter: 'blur(32px)', animation: 'glowBreath 3s ease-in-out infinite',
          }} />
        )}

        {/* Partículas */}
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
          gap: isLogin ? 1.5 : 2.5,
          pt: (!isDesktop && isLogin) ? { xs: 6 } : 0,
          opacity: phase === 'enter' ? 0 : 1,
          animation: (phase === 'enter' || phase === 'hold')
            ? 'logoIn 1s cubic-bezier(0.16,1,0.3,1) forwards' : 'none',
        }}>
          <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{
              position: 'absolute',
              width:  isDesktop && isLogin ? 340 : 420, height: isDesktop && isLogin ? 340 : 420,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,110,20,0.28) 0%, rgba(255,60,0,0.1) 45%, transparent 72%)',
              filter: 'blur(24px)', animation: 'ringPulse2 4s ease-in-out infinite', pointerEvents: 'none',
            }} />
            <Box sx={{
              position: 'absolute',
              width:  isDesktop && isLogin ? 260 : 320, height: isDesktop && isLogin ? 260 : 320,
              borderRadius: '50%',
              border: '1.5px solid rgba(255,144,57,0.35)',
              boxShadow: '0 0 18px rgba(255,144,57,0.25), inset 0 0 18px rgba(255,100,0,0.1)',
              animation: 'ringPulse2 3.5s ease-in-out 0.4s infinite', pointerEvents: 'none',
            }} />
            <Box sx={{
              position: 'absolute',
              width:  isDesktop && isLogin ? 190 : 240, height: isDesktop && isLogin ? 190 : 240,
              borderRadius: '50%',
              border: '2px solid rgba(255,120,30,0.55)',
              boxShadow: '0 0 28px rgba(255,120,30,0.4), inset 0 0 24px rgba(255,80,0,0.15)',
              animation: 'ringPulse 2.8s ease-in-out infinite', pointerEvents: 'none',
            }} />
            <Box
              component="img" src="/logotipo.png" alt="Digital Scale"
              sx={{
                position: 'relative', zIndex: 2,
                width: isDesktop && isLogin
                  ? { md: 220, lg: 260, xl: 300 }
                  : isLogin
                  ? { xs: 130, sm: 155 }
                  : { xs: 200, sm: 260 },
                height: 'auto',
                animation: 'logoPulse 3s ease-in-out 1s infinite',
                transition: 'width 0.55s cubic-bezier(0.16,1,0.3,1)',
              }}
            />
          </Box>

          {(!isLogin || isDesktop) && (
            <Box sx={{
              fontSize: isDesktop && isLogin ? { md: '0.78rem', lg: '0.85rem' } : { xs: '0.65rem', sm: '0.72rem' },
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

          {isDesktop && isLogin && (
            <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 40, height: 1, bgcolor: 'rgba(255,144,57,0.35)' }} />
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textAlign: 'center', lineHeight: 1.8 }}>
                PAINEL OPERACIONAL<br />Digital Scale · {new Date().getFullYear()}
              </Typography>
              {/* KPI strip */}
              <Box sx={{ display: 'flex', gap: 2.5, mt: 0.5 }}>
                {[
                  { value: '17', label: 'clientes' },
                  { value: '226', label: 'posts/mês' },
                  { value: 'Maio', label: '2026' },
                ].map(k => (
                  <Box key={k.label} sx={{ textAlign: 'center' }}>
                    <Typography sx={{
                      fontSize: '1.15rem', fontWeight: 900, color: '#ff9039', lineHeight: 1,
                      textShadow: '0 0 14px rgba(255,144,57,0.6)',
                    }}>{k.value}</Typography>
                    <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: 0.8, mt: 0.2 }}>{k.label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* ══ RIGHT PANEL (desktop) — sempre visível, conteúdo aparece ao entrar em 'login' ══ */}
      {isDesktop ? (
        <Box sx={{
          width: '50%', height: '100%',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          px: { md: 6, lg: 9, xl: 11 }, py: { md: 4, lg: 5 },
          background: 'rgba(6,6,6,0.92)',
          borderLeft: '1px solid rgba(255,144,57,0.08)',
          backdropFilter: 'blur(8px)',
          position: 'relative', zIndex: 10,
          opacity: isLogin ? 1 : 0,
          transition: 'opacity 0.6s ease',
        }}>

          {/* ── TOP: Saudação + data + relógio ── */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{
                fontSize: { md: '0.78rem', lg: '0.85rem' },
                fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em',
              }}>
                {greeting}
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.22)', mt: 0.3, textTransform: 'capitalize' }}>
                {todayFull}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{
                fontSize: { md: '1.6rem', lg: '1.9rem' }, fontWeight: 900,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em',
                color: 'rgba(255,255,255,0.12)', lineHeight: 1,
              }}>
                {clockStr}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, justifyContent: 'flex-end', mt: 0.4 }}>
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#00C47A', boxShadow: '0 0 6px #00C47A' }} />
                <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em' }}>
                  SISTEMA ONLINE
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* ── MIDDLE: Formulário ── */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', py: { md: 4, lg: 5 } }}>
            {isLogin && step === 'password' && (
              <PasswordForm
                pwd={pwd} setPwd={setPwd} error={pwdError}
                onConfirm={handlePasswordConfirm} onKeyDown={handlePasswordKeyDown}
                inputRef={pwdRef} compact={false}
              />
            )}
            {isLogin && step === 'name' && (
              <NameForm
                name={name} setName={setName}
                detected={detected} error={error} denied={denied}
                onConfirm={handleConfirm} onKeyDown={handleKeyDown}
                inputRef={inputRef} compact={false}
              />
            )}
          </Box>

          {/* ── BOTTOM: KPI cards + status ── */}
          <Box>
            {/* KPI cards */}
            <Box sx={{ display: 'flex', gap: 1.2, mb: 2.5 }}>
              {[
                { emoji: '👥', value: '17', label: 'Clientes ativos' },
                { emoji: '📱', value: '226', label: 'Posts este mês' },
                { emoji: '🚀', value: 'Maio', label: 'Competência' },
              ].map(kpi => (
                <Box key={kpi.label} sx={{
                  flex: 1, px: 1.5, py: 1.4, borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4,
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(255,144,57,0.05)', borderColor: 'rgba(255,144,57,0.18)' },
                }}>
                  <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{kpi.emoji}</Typography>
                  <Typography sx={{
                    fontSize: '1.1rem', fontWeight: 900, color: '#ff9039', lineHeight: 1,
                    textShadow: '0 0 12px rgba(255,144,57,0.4)',
                  }}>{kpi.value}</Typography>
                  <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.28)', textAlign: 'center', lineHeight: 1.3 }}>
                    {kpi.label}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Status do sistema */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, borderTop: '1px solid rgba(255,255,255,0.05)', pt: 1.5 }}>
              {[
                { label: 'Painel', color: '#00C47A' },
                { label: 'Cloudflare', color: '#00C47A' },
                { label: 'IA', color: '#00C47A' },
              ].map((s, i) => (
                <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mr: 2 }}>
                  <Box sx={{
                    width: 5, height: 5, borderRadius: '50%', bgcolor: s.color,
                    boxShadow: `0 0 6px ${s.color}`,
                    animation: `statusPulse${i} ${2 + i * 0.4}s ease-in-out infinite`,
                    [`@keyframes statusPulse${i}`]: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.45 } },
                  }} />
                  <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)' }}>{s.label}</Typography>
                </Box>
              ))}
              <Box sx={{ flex: 1 }} />
            </Box>
          </Box>
        </Box>

      ) : isLogin ? (
        /* ── MOBILE ── */
        <Box sx={{
          position: 'relative', zIndex: 10,
          width: '100%', maxWidth: 420,
          px: { xs: 2.5, sm: 4 }, pt: 2.5, pb: { xs: 6, sm: 7 },
        }}>
          {step === 'password' ? (
            <PasswordForm
              pwd={pwd} setPwd={setPwd} error={pwdError}
              onConfirm={handlePasswordConfirm} onKeyDown={handlePasswordKeyDown}
              inputRef={pwdRef} compact
            />
          ) : (
            <NameForm
              name={name} setName={setName}
              detected={detected} error={error} denied={denied}
              onConfirm={handleConfirm} onKeyDown={handleKeyDown}
              inputRef={inputRef} compact
            />
          )}
        </Box>
      ) : null}

      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '18%', background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)', pointerEvents: 'none', zIndex: 1 }} />

      {/* ══ LOADING OVERLAY ══ */}
      {phase === 'loading' && (
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 200,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(4,4,4,0.94)', backdropFilter: 'blur(16px)',
          animation: 'fadeInLoad 0.3s ease both',
          '@keyframes fadeInLoad': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
          gap: 3,
        }}>
          {/* Logo pequeno */}
          <Box sx={{
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'pulseLoad 1.4s ease-in-out infinite',
            '@keyframes pulseLoad': { '0%,100%': { filter: 'drop-shadow(0 0 18px rgba(255,144,57,0.7))' }, '50%': { filter: 'drop-shadow(0 0 36px rgba(255,144,57,1))' } },
          }}>
            <Box component="img" src="/logotipo.png" alt="DS" sx={{ width: 72, height: 'auto', opacity: 0.9 }} />
          </Box>

          {/* Dots spinner */}
          <Box sx={{ display: 'flex', gap: 0.9 }}>
            {[0, 1, 2].map(i => (
              <Box key={i} sx={{
                width: 7, height: 7, borderRadius: '50%',
                bgcolor: '#ff9039',
                animation: `dotBounce 1.1s ${i * 0.18}s ease-in-out infinite`,
                '@keyframes dotBounce': {
                  '0%,80%,100%': { transform: 'scale(0.6)', opacity: 0.4 },
                  '40%': { transform: 'scale(1)', opacity: 1 },
                },
              }} />
            ))}
          </Box>

          {/* Cycling message */}
          <Box sx={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{
              fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em',
              fontWeight: 500,
              animation: 'fadeMsg 0.4s ease both',
              '@keyframes fadeMsg': { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
              key: loadingMsg,
            }}>
              {LOADING_MSGS[loadingMsg]}
            </Typography>
          </Box>

          {/* Progress bar */}
          <Box sx={{ width: 180, height: 2, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
            <Box sx={{
              height: '100%', borderRadius: 1,
              background: 'linear-gradient(90deg, #ff9039, #ff5339)',
              animation: 'loadBar 1.8s linear forwards',
              '@keyframes loadBar': { '0%': { width: '0%' }, '100%': { width: '100%' } },
            }} />
          </Box>
        </Box>
      )}
    </Box>
  )
}

// ── Formulário de senha ────────────────────────────────
function PasswordForm({
  pwd, setPwd, error, onConfirm, onKeyDown, inputRef, compact,
}: {
  pwd: string
  setPwd: (v: string) => void
  error: boolean
  onConfirm: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  inputRef: React.RefObject<HTMLInputElement>
  compact: boolean
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 2 : 3 }}>

      {/* Título */}
      <Box>
        <Typography sx={{
          fontSize: compact ? '1.4rem' : { md: '1.8rem', lg: '2.2rem', xl: '2.4rem' },
          fontWeight: 900, color: 'rgba(255,255,255,0.45)', letterSpacing: '-0.03em', lineHeight: 1.1, mb: 0.4,
        }}>
          Área restrita
        </Typography>
        <Typography sx={{
          fontSize: compact ? '1.4rem' : { md: '1.8rem', lg: '2.2rem', xl: '2.4rem' },
          fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1,
          background: 'linear-gradient(135deg, #ff9039, #ff5339)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Digite a senha
        </Typography>
      </Box>

      {/* Input */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          type="password"
          placeholder="Senha de acesso..."
          value={pwd}
          onChange={e => setPwd(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoFocus
          sx={{
            animation: error ? 'shake 0.45s ease' : 'none',
            '@keyframes shake': {
              '0%,100%': { transform: 'translateX(0)' },
              '20%,60%': { transform: 'translateX(-6px)' },
              '40%,80%': { transform: 'translateX(6px)' },
            },
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 2.5,
              fontSize: compact ? '1.05rem' : { md: '1.1rem', lg: '1.25rem' },
              fontWeight: 600,
              '& fieldset': { borderColor: error ? '#FF4545' : 'rgba(255,144,57,0.25)', borderWidth: '1.5px' },
              '&:hover fieldset': { borderColor: 'rgba(255,144,57,0.5)' },
              '&.Mui-focused fieldset': { borderColor: '#ff9039', borderWidth: '2px' },
            },
            '& input::placeholder': { color: 'rgba(255,255,255,0.22)', opacity: 1 },
            '& .MuiOutlinedInput-input': { py: compact ? 1.5 : 2, px: 2 },
          }}
        />

        {/* Badge de erro */}
        {error && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 2, py: 1.2, borderRadius: 2,
            background: 'rgba(255,69,69,0.10)',
            border: '1.5px solid rgba(255,69,69,0.35)',
            boxShadow: '0 4px 20px rgba(255,69,69,0.2)',
            animation: 'badgeIn 0.25s ease both',
            '@keyframes badgeIn': {
              '0%':   { opacity: 0, transform: 'translateY(8px) scale(0.92)' },
              '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
            },
          }}>
            <Typography sx={{ fontSize: '1.4rem', lineHeight: 1 }}>🔒</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.62rem', color: '#FF4545', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Acesso negado
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: '-0.01em' }}>
                Senha incorreta
              </Typography>
            </Box>
          </Box>
        )}

        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={!pwd.trim()}
          fullWidth
          sx={{
            py: compact ? 1.3 : 1.6,
            background: pwd.trim()
              ? 'linear-gradient(135deg, #ff9039, #ff5339)'
              : 'rgba(255,255,255,0.06)',
            color: pwd.trim() ? '#000' : 'rgba(255,255,255,0.2)',
            fontWeight: 800,
            fontSize: compact ? '0.95rem' : '1rem',
            borderRadius: 2.5,
            boxShadow: pwd.trim() ? '0 6px 20px rgba(255,144,57,0.4)' : 'none',
            transition: 'all 0.25s ease',
            '&:hover': { filter: 'brightness(1.1)', transform: 'translateY(-1px)' },
            '&.Mui-disabled': { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)' },
          }}
        >
          Acessar →
        </Button>
      </Box>

      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
        Pressione Enter para confirmar
      </Typography>
    </Box>
  )
}

// ── Formulário de nome ─────────────────────────────────
function NameForm({
  name, setName, detected, error, denied, onConfirm, onKeyDown, inputRef, compact,
}: {
  name: string
  setName: (v: string) => void
  detected: ReturnType<typeof detectUser>
  error: boolean
  denied: boolean
  onConfirm: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  inputRef: React.RefObject<HTMLInputElement>
  compact: boolean
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 2 : 3 }}>

      {/* Título */}
      <Box>
        <Typography sx={{
          fontSize: compact ? '1.4rem' : { md: '1.8rem', lg: '2.2rem', xl: '2.4rem' },
          fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, mb: 0.4,
        }}>
          Olá! Qual é o
        </Typography>
        <Typography sx={{
          fontSize: compact ? '1.4rem' : { md: '1.8rem', lg: '2.2rem', xl: '2.4rem' },
          fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1,
          background: 'linear-gradient(135deg, #ff9039, #ff5339)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          seu nome?
        </Typography>
      </Box>

      {/* Input */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          placeholder="Digite seu nome..."
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoFocus
          sx={{
            animation: error ? 'shake 0.45s ease' : 'none',
            '@keyframes shake': {
              '0%,100%': { transform: 'translateX(0)' },
              '20%,60%': { transform: 'translateX(-6px)' },
              '40%,80%': { transform: 'translateX(6px)' },
            },
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 2.5,
              fontSize: compact ? '1.05rem' : { md: '1.1rem', lg: '1.25rem' },
              fontWeight: 600,
              '& fieldset': { borderColor: error ? '#FF4545' : 'rgba(255,144,57,0.25)', borderWidth: '1.5px' },
              '&:hover fieldset': { borderColor: 'rgba(255,144,57,0.5)' },
              '&.Mui-focused fieldset': { borderColor: '#ff9039', borderWidth: '2px' },
            },
            '& input::placeholder': { color: 'rgba(255,255,255,0.22)', opacity: 1 },
            '& .MuiOutlinedInput-input': { py: compact ? 1.5 : 2, px: 2 },
          }}
        />

        {/* Badge do cargo detectado / acesso negado / digitando */}
        {denied ? (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 2, py: 1.2, borderRadius: 2,
            background: 'rgba(255,69,69,0.10)',
            border: '1.5px solid rgba(255,69,69,0.35)',
            boxShadow: '0 4px 20px rgba(255,69,69,0.2)',
            animation: 'badgeIn 0.25s ease both',
            '@keyframes badgeIn': {
              '0%':   { opacity: 0, transform: 'translateY(8px) scale(0.92)' },
              '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
            },
          }}>
            <Typography sx={{ fontSize: '1.4rem', lineHeight: 1 }}>🚫</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.62rem', color: '#FF4545', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Acesso negado
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: '-0.01em' }}>
                Nome não autorizado
              </Typography>
            </Box>
          </Box>
        ) : detected ? (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 2, py: 1.2, borderRadius: 2,
            background: `${detected.color}10`,
            border: `1.5px solid ${detected.color}40`,
            boxShadow: `0 4px 20px ${detected.glow}`,
            animation: 'badgeIn 0.3s cubic-bezier(0.16,1,0.3,1) both',
            '@keyframes badgeIn': {
              '0%':   { opacity: 0, transform: 'translateY(8px) scale(0.92)' },
              '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
            },
          }}>
            <Typography sx={{ fontSize: '1.5rem', lineHeight: 1 }}>{detected.emoji}</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Cargo detectado
              </Typography>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: detected.color, letterSpacing: '-0.01em' }}>
                {detected.role}
              </Typography>
            </Box>
            <Box sx={{ ml: 'auto', width: 8, height: 8, borderRadius: '50%', bgcolor: detected.color, boxShadow: `0 0 8px ${detected.glow}` }} />
          </Box>
        ) : name.trim().length > 0 ? (
          <Box sx={{
            px: 2, py: 1, borderRadius: 2,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            animation: 'badgeIn 0.2s ease both',
          }}>
            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>
              👤 Entrando como <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{name.trim()}</strong>
            </Typography>
          </Box>
        ) : null}

        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={!name.trim()}
          fullWidth
          sx={{
            py: compact ? 1.3 : 1.6,
            background: name.trim()
              ? (detected ? `linear-gradient(135deg, ${detected.color}, ${detected.color}cc)` : 'linear-gradient(135deg, #ff9039, #ff5339)')
              : 'rgba(255,255,255,0.06)',
            color: name.trim() ? '#000' : 'rgba(255,255,255,0.2)',
            fontWeight: 800,
            fontSize: compact ? '0.95rem' : '1rem',
            borderRadius: 2.5,
            boxShadow: name.trim() && detected ? `0 6px 28px ${detected.glow}` : name.trim() ? '0 6px 20px rgba(255,144,57,0.4)' : 'none',
            transition: 'all 0.25s ease',
            '&:hover': {
              filter: 'brightness(1.1)',
              transform: 'translateY(-1px)',
            },
            '&.Mui-disabled': { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)' },
          }}
        >
          Entrar →
        </Button>
      </Box>

      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
        Pressione Enter para confirmar
      </Typography>
    </Box>
  )
}
