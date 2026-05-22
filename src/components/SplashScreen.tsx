import { useEffect, useState, useRef } from 'react'
import { Box, Typography, TextField, Button } from '@mui/material'
import { NAME_MAP, getUserInfo } from '../lib/users'

function detectUser(name: string): typeof NAME_MAP[string] | null {
  return getUserInfo(name)
}

interface Props {
  showLogin: boolean
  onFinish: () => void
  onLogin: (name: string) => void
  currentUser?: string
}

type Phase = 'enter' | 'hold' | 'login' | 'loading' | 'exit'

const LOADING_MSGS = [
  'Sincronizando tarefas...',
  'Carregando aprovações...',
  'Atualizando operação...',
  'Carregando clientes...',
  'Tudo pronto!',
]

export default function SplashScreen({ showLogin, onFinish, onLogin, currentUser }: Props) {
  const [phase, setPhase]    = useState<Phase>('enter')
  const [name, setName]      = useState('')
  const [error, setError]    = useState(false)
  const [denied, setDenied]  = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const [clockStr, setClockStr] = useState(() =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
  useEffect(() => {
    const id = setInterval(() =>
      setClockStr(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    , 60000)
    return () => clearInterval(id)
  }, [])
  const nowHour  = new Date().getHours()
  const greeting = nowHour < 12 ? '☀️ Bom dia' : nowHour < 18 ? '🌤 Boa tarde' : '🌙 Boa noite'
  const todayFull = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  const [step, setStep] = useState<'password' | 'name'>(() =>
    sessionStorage.getItem('sm_pwd_ok') === '1' ? 'name' : 'password'
  )
  const [pwd, setPwd]       = useState('')
  const [pwdError, setPwdError] = useState(false)
  const pwdRef = useRef<HTMLInputElement>(null)

  const detected = detectUser(name)

  useEffect(() => {
    if (!showLogin) {
      const t1 = setTimeout(() => setPhase('hold'), 600)
      const t2 = setTimeout(() => setPhase('exit'), 2000)
      const t3 = setTimeout(() => onFinish(), 2500)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    } else {
      const t1 = setTimeout(() => setPhase('login'), 950)
      const t2 = setTimeout(() => {
        if (step === 'password') pwdRef.current?.focus()
        else inputRef.current?.focus()
      }, 1200)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [showLogin, onFinish]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === 'name' && phase === 'login') setTimeout(() => inputRef.current?.focus(), 80)
  }, [step, phase])

  useEffect(() => {
    if (phase !== 'loading') return
    const t = setInterval(() => setLoadingMsg(m => (m + 1) % LOADING_MSGS.length), 500)
    return () => clearInterval(t)
  }, [phase])

  function handleConfirm() {
    const trimmed = name.trim()
    if (!trimmed) { setError(true); setTimeout(() => setError(false), 800); return }
    const match = detectUser(trimmed)
    if (!match) {
      setDenied(true); setError(true)
      setTimeout(() => { setError(false); setDenied(false) }, 2500)
      return
    }
    onLogin(trimmed)
    setPhase('loading')
    setTimeout(() => { setPhase('exit'); setTimeout(() => onFinish(), 500) }, 1800)
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

  const isLogin = phase === 'login' || phase === 'loading'
  const isExit  = phase === 'exit'

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: isLogin ? 'flex-start' : 'center',
      overflowY: isLogin ? 'auto' : 'hidden',
      background: 'radial-gradient(ellipse at 50% 25%, #0e0502 0%, #070303 40%, #040303 70%, #030303 100%)',
      opacity: isExit ? 0 : 1,
      transition: isExit ? 'opacity 0.55s ease' : 'none',

      '@keyframes logoIn': {
        '0%':   { opacity: 0, transform: 'scale(0.72) translateY(30px)', filter: 'blur(22px) brightness(2)' },
        '70%':  { filter: 'blur(1px) brightness(1.2)' },
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
        '25%':  { opacity: 0.7 },
        '100%': { opacity: 0, transform: 'translateY(-150px) scale(0.45)' },
      },
      '@keyframes ringExpand': {
        '0%':   { transform: 'scale(0.7)', opacity: 0.5 },
        '100%': { transform: 'scale(2.6)', opacity: 0 },
      },
      '@keyframes glowBreath': {
        '0%,100%': { opacity: 0.38, transform: 'scale(1)'    },
        '50%':     { opacity: 0.6,  transform: 'scale(1.06)' },
      },
      '@keyframes ringPulse': {
        '0%,100%': { transform: 'scale(1)',    opacity: 0.4 },
        '50%':     { transform: 'scale(1.03)', opacity: 0.62 },
      },
      '@keyframes ringPulse2': {
        '0%,100%': { transform: 'scale(1)',    opacity: 0.2 },
        '50%':     { transform: 'scale(1.04)', opacity: 0.4 },
      },
      '@keyframes logoPulse': {
        '0%,100%': { filter: 'drop-shadow(0 0 22px rgba(255,120,30,0.48)) drop-shadow(0 0 55px rgba(255,80,0,0.2))' },
        '50%':     { filter: 'drop-shadow(0 0 36px rgba(255,155,40,0.72)) drop-shadow(0 0 90px rgba(255,100,0,0.36))' },
      },
      '@keyframes shake': {
        '0%,100%': { transform: 'translateX(0)' },
        '20%,60%': { transform: 'translateX(-5px)' },
        '40%,80%': { transform: 'translateX(5px)' },
      },
      '@keyframes badgeIn': {
        '0%':   { opacity: 0, transform: 'translateY(7px) scale(0.94)' },
        '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
      },
      '@keyframes cardSlideUp': {
        '0%':   { opacity: 0, transform: 'translateY(28px) scale(0.97)' },
        '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
      },
      '@keyframes nebulaShift': {
        '0%,100%': { transform: 'scale(1) translate(0,0)' },
        '50%':     { transform: 'scale(1.06) translate(1.5%,-1.5%)' },
      },
      '@keyframes starTwinkle': {
        '0%,100%': { opacity: 0.1 },
        '50%':     { opacity: 0.55 },
      },
      '@keyframes fadeInLoad': {
        '0%': { opacity: 0 }, '100%': { opacity: 1 }
      },
    }}>

      {/* ── Background: atmosfera + estrelas ──────────────────── */}
      <Box sx={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {/* Glow central suave atrás do logo */}
        <Box sx={{
          position: 'absolute',
          width: { xs: 550, sm: 750, md: 1000, lg: 1200 },
          height: { xs: 380, sm: 500, md: 680, lg: 800 },
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255,85,8,0.16) 0%, rgba(200,50,0,0.07) 38%, transparent 68%)',
          filter: 'blur(65px)',
          left: '50%', top: '32%', transform: 'translate(-50%,-50%)',
          animation: 'glowBreath 8s ease-in-out infinite',
        }} />

        {/* Calor de chão */}
        <Box sx={{
          position: 'absolute',
          width: '65%', height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255,70,0,0.04) 0%, transparent 70%)',
          filter: 'blur(55px)',
          bottom: '-4%', left: '18%',
          animation: 'nebulaShift 18s ease-in-out infinite',
        }} />

        {/* Estrelas espalhadas em toda a tela */}
        {Array.from({ length: 60 }, (_, i) => {
          const seed = i * 17.3
          const x = (seed * 1.91) % 100
          const y = (seed * 2.73 + 5) % 100
          const big = i % 6 === 0
          return (
            <Box key={i} sx={{
              position: 'absolute',
              left: `${x}%`, top: `${y}%`,
              width: big ? 2.5 : 1.5, height: big ? 2.5 : 1.5,
              borderRadius: '50%',
              bgcolor: i % 4 === 0 ? 'rgba(255,165,60,0.5)' : 'rgba(255,230,170,0.28)',
              animation: `starTwinkle ${2.8 + (i % 7) * 0.55}s ${(i * 0.21) % 4}s ease-in-out infinite`,
            }} />
          )
        })}
      </Box>

      {/* ── Logo ──────────────────────────────────────────────── */}
      <Box sx={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        pt: isLogin ? { xs: 4, sm: 5, md: 5.5 } : 0,
        pb: isLogin ? { xs: 2, md: 2.5 } : 3,
        opacity: phase === 'enter' ? 0 : 1,
        animation: phase === 'enter' ? 'logoIn 0.95s cubic-bezier(0.16,1,0.3,1) forwards' : 'none',
        transition: 'padding 0.55s ease',
      }}>
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

          {/* Halo de fundo */}
          <Box sx={{
            position: 'absolute',
            width:  isLogin ? { xs: 230, md: 270 } : { xs: 340, sm: 460, md: 560, lg: 620 },
            height: isLogin ? { xs: 230, md: 270 } : { xs: 340, sm: 460, md: 560, lg: 620 },
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,110,20,0.16) 0%, rgba(255,60,0,0.05) 45%, transparent 72%)',
            filter: 'blur(24px)',
            animation: 'ringPulse2 7.5s ease-in-out infinite',
            pointerEvents: 'none',
            transition: 'width 0.6s ease, height 0.6s ease',
          }} />

          {/* Anéis orbitais — só fora do login */}
          {!isLogin && [310, 430, 550].map((r, i) => (
            <Box key={i} sx={{
              position: 'absolute', width: r, height: r, borderRadius: '50%', pointerEvents: 'none',
              border: `1px solid ${['rgba(255,144,57,0.15)','rgba(255,80,0,0.09)','rgba(255,180,60,0.05)'][i]}`,
              animation: `orbitSpin ${[22,36,54][i]}s linear infinite`,
            }}>
              <Box sx={{
                position: 'absolute', top: -4, left: '50%', width: 6, height: 6, borderRadius: '50%',
                bgcolor: ['#ff9039','#ff5339','#ffb040'][i],
                boxShadow: `0 0 12px 3px ${['rgba(255,144,57,0.6)','rgba(255,83,57,0.5)','rgba(255,176,64,0.45)'][i]}`,
              }} />
            </Box>
          ))}

          {/* Anel médio (sempre) */}
          <Box sx={{
            position: 'absolute',
            width:  isLogin ? { xs: 165, md: 195 } : { xs: 240, sm: 320, md: 380, lg: 420 },
            height: isLogin ? { xs: 165, md: 195 } : { xs: 240, sm: 320, md: 380, lg: 420 },
            borderRadius: '50%',
            border: '1.5px solid rgba(255,144,57,0.26)',
            boxShadow: '0 0 14px rgba(255,144,57,0.12), inset 0 0 14px rgba(255,100,0,0.05)',
            animation: 'ringPulse2 6.5s ease-in-out 0.5s infinite',
            pointerEvents: 'none',
            transition: 'width 0.6s ease, height 0.6s ease',
          }} />

          {/* Anel interno (sempre) */}
          <Box sx={{
            position: 'absolute',
            width:  isLogin ? { xs: 120, md: 142 } : { xs: 178, sm: 240, md: 285, lg: 315 },
            height: isLogin ? { xs: 120, md: 142 } : { xs: 178, sm: 240, md: 285, lg: 315 },
            borderRadius: '50%',
            border: '1.5px solid rgba(255,120,30,0.42)',
            boxShadow: '0 0 18px rgba(255,120,30,0.24), inset 0 0 16px rgba(255,80,0,0.08)',
            animation: 'ringPulse 4.8s ease-in-out infinite',
            pointerEvents: 'none',
            transition: 'width 0.6s ease, height 0.6s ease',
          }} />

          {/* Ring expand no hold */}
          {phase === 'hold' && !showLogin && [0,1,2].map(i => (
            <Box key={i} sx={{
              position: 'absolute', width: 180, height: 180, borderRadius: '50%', pointerEvents: 'none',
              border: `2.5px solid ${['rgba(255,144,57,0.5)','rgba(255,100,30,0.32)','rgba(255,60,0,0.18)'][i]}`,
              animation: `ringExpand 1.8s ${i * 0.4}s ease-out forwards`,
            }} />
          ))}

          {/* Partículas orbitais */}
          {Array.from({ length: isLogin ? 10 : 20 }, (_, i) => {
            const angle  = (i / (isLogin ? 10 : 20)) * Math.PI * 2
            const radius = 60 + (i % 5) * 24
            return (
              <Box key={i} sx={{
                position: 'absolute', pointerEvents: 'none',
                width: 2 + (i % 3), height: 2 + (i % 3), borderRadius: '50%',
                bgcolor: ['rgba(255,144,57,0.75)','rgba(255,100,30,0.6)','rgba(255,60,0,0.55)','rgba(255,190,60,0.5)'][i % 4],
                left: `calc(50% + ${Math.cos(angle) * radius}px)`,
                top:  `calc(50% + ${Math.sin(angle) * radius}px)`,
                animation: `particleRise ${2.5 + (i % 4) * 0.8}s ${(i * 0.18) % 2.4}s ease-out infinite`,
              }} />
            )
          })}

          {/* Logo */}
          <Box
            component="img" src="/logotipo.png" alt="Digital Scale"
            sx={{
              position: 'relative', zIndex: 2,
              width: isLogin
                ? { xs: 105, sm: 125, md: 155, lg: 175, xl: 190 }
                : { xs: 210, sm: 270, md: 330, lg: 375, xl: 420 },
              height: 'auto',
              animation: 'logoPulse 5.5s ease-in-out 1.2s infinite',
              transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        </Box>

        {/* Tagline */}
        <Box sx={{
          mt: isLogin ? 1.5 : 2.5,
          fontSize: isLogin
            ? { xs: '0.52rem', md: '0.62rem' }
            : { xs: '0.62rem', sm: '0.7rem', md: '0.78rem', lg: '0.86rem' },
          fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase',
          background: 'linear-gradient(90deg, rgba(255,144,57,0.35) 0%, #fff3d6 28%, #ff9039 52%, #ffb347 72%, rgba(255,144,57,0.35) 100%)',
          backgroundSize: '300% auto',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          animation: 'shimmer 5s 0.8s linear infinite',
          userSelect: 'none',
          transition: 'font-size 0.5s ease, margin 0.5s ease',
        }}>
          Agência de Marketing Digital
        </Box>

        {/* Bem-vindo de volta */}
        {!showLogin && currentUser && (
          <Box sx={{
            mt: 2.5, px: 2.5, py: 1, borderRadius: 2,
            bgcolor: 'rgba(255,144,57,0.07)', border: '1px solid rgba(255,144,57,0.2)',
            animation: 'badgeIn 0.5s 0.7s ease both', opacity: 0,
          }}>
            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,144,57,0.8)', textAlign: 'center', letterSpacing: '0.04em' }}>
              Bem-vindo de volta, <strong style={{ color: '#ff9039' }}>{currentUser}</strong> 👋
            </Typography>
          </Box>
        )}
      </Box>

      {/* ── Painel de login ───────────────────────────────────── */}
      {isLogin && (
        <Box sx={{
          position: 'relative', zIndex: 10,
          width: '100%', maxWidth: { xs: '100%', sm: 490, md: 520 },
          mx: 'auto',
          px: { xs: 2, sm: 0 },
          pb: { xs: 5, md: 5 },
          animation: 'cardSlideUp 0.5s 0.08s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          <Box sx={{
            borderRadius: { xs: 3, sm: 4 },
            background: 'rgba(10,7,7,0.9)',
            backdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,144,57,0.1)',
            boxShadow: '0 12px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,144,57,0.04), inset 0 1px 0 rgba(255,255,255,0.025)',
            overflow: 'hidden',
          }}>

            {/* Cabeçalho: saudação + relógio */}
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: { xs: 3, md: 4 }, pt: { xs: 2.5, md: 3 }, pb: { xs: 2, md: 2.5 },
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <Box>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.42)', letterSpacing: '0.03em' }}>
                  {greeting}
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.18)', mt: 0.25, textTransform: 'capitalize' }}>
                  {todayFull}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{
                  fontSize: { xs: '1.5rem', md: '1.85rem' }, fontWeight: 900,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em',
                  color: 'rgba(255,144,57,0.48)', lineHeight: 1,
                }}>
                  {clockStr}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end', mt: 0.4 }}>
                  <Box sx={{
                    width: 4, height: 4, borderRadius: '50%', bgcolor: '#00C47A',
                    boxShadow: '0 0 5px #00C47A',
                    '@keyframes statusDot': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
                    animation: 'statusDot 3s ease-in-out infinite',
                  }} />
                  <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.16)', letterSpacing: '0.08em' }}>ONLINE</Typography>
                </Box>
              </Box>
            </Box>

            {/* Formulário */}
            <Box sx={{ px: { xs: 3, md: 4 }, py: { xs: 3, md: 3.5 } }}>
              {step === 'password' ? (
                <PasswordForm
                  pwd={pwd} setPwd={setPwd} error={pwdError}
                  onConfirm={handlePasswordConfirm} onKeyDown={handlePasswordKeyDown}
                  inputRef={pwdRef}
                />
              ) : (
                <NameForm
                  name={name} setName={setName}
                  detected={detected} error={error} denied={denied}
                  onConfirm={handleConfirm} onKeyDown={handleKeyDown}
                  inputRef={inputRef}
                />
              )}
            </Box>

            {/* Rodapé: KPIs + status */}
            <Box sx={{
              px: { xs: 3, md: 4 }, pb: { xs: 2.5, md: 3 },
              borderTop: '1px solid rgba(255,255,255,0.04)',
              pt: 0,
            }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                {[
                  { emoji: '👥', value: '17',   label: 'Clientes',  color: '#ff9039' },
                  { emoji: '📱', value: '226',  label: 'Posts/mês', color: '#3B8EFF' },
                  { emoji: '🚀', value: 'Maio', label: '2026',      color: '#00C47A' },
                ].map(kpi => (
                  <Box key={kpi.label} sx={{
                    flex: 1, px: 1, py: 1.1, borderRadius: 2,
                    bgcolor: `${kpi.color}07`,
                    border: `1px solid ${kpi.color}12`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.3,
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: `${kpi.color}0e`, borderColor: `${kpi.color}22` },
                  }}>
                    <Typography sx={{ fontSize: '0.9rem', lineHeight: 1 }}>{kpi.emoji}</Typography>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 900, color: kpi.color, lineHeight: 1 }}>{kpi.value}</Typography>
                    <Typography sx={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.22)', textAlign: 'center' }}>{kpi.label}</Typography>
                  </Box>
                ))}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', pt: 1.2 }}>
                {[
                  { label: 'Painel',     color: '#00C47A', delay: '0s'   },
                  { label: 'Cloudflare', color: '#00C47A', delay: '0.8s' },
                  { label: 'IA',         color: '#00C47A', delay: '1.6s' },
                ].map(s => (
                  <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 1.8 }}>
                    <Box sx={{
                      width: 4, height: 4, borderRadius: '50%', bgcolor: s.color,
                      boxShadow: `0 0 4px ${s.color}`,
                      '@keyframes statusDot2': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
                      animation: `statusDot2 4s ${s.delay} ease-in-out infinite`,
                    }} />
                    <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)' }}>{s.label}</Typography>
                  </Box>
                ))}
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '0.05em' }}>v2.6 · Digital Scale</Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* Gradiente de chão */}
      <Box sx={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '16%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.35), transparent)',
        pointerEvents: 'none', zIndex: 1,
      }} />

      {/* Loading overlay */}
      {phase === 'loading' && (
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 200,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(4,3,3,0.97)', backdropFilter: 'blur(20px)',
          animation: 'fadeInLoad 0.28s ease both',
          gap: 3,
        }}>
          <Box sx={{
            animation: 'pulseLoad 2s ease-in-out infinite',
            '@keyframes pulseLoad': {
              '0%,100%': { filter: 'drop-shadow(0 0 14px rgba(255,144,57,0.55))' },
              '50%':     { filter: 'drop-shadow(0 0 30px rgba(255,144,57,0.9))'  },
            },
          }}>
            <Box component="img" src="/logotipo.png" alt="DS" sx={{ width: 72, height: 'auto', opacity: 0.92 }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 0.9 }}>
            {[0,1,2].map(i => (
              <Box key={i} sx={{
                width: 7, height: 7, borderRadius: '50%', bgcolor: '#ff9039',
                animation: `dotBounce 1.1s ${i * 0.18}s ease-in-out infinite`,
                '@keyframes dotBounce': {
                  '0%,80%,100%': { transform: 'scale(0.55)', opacity: 0.35 },
                  '40%':         { transform: 'scale(1)',    opacity: 1    },
                },
              }} />
            ))}
          </Box>
          <Box sx={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', fontWeight: 500 }}>
              {LOADING_MSGS[loadingMsg]}
            </Typography>
          </Box>
          <Box sx={{ width: 160, height: 2, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
            <Box sx={{
              height: '100%', borderRadius: 1,
              background: 'linear-gradient(90deg, #ff9039, #ff5339)',
              animation: 'loadBar 1.8s ease-in-out forwards',
              '@keyframes loadBar': { '0%': { width: '0%' }, '80%': { width: '90%' }, '100%': { width: '100%' } },
            }} />
          </Box>
        </Box>
      )}
    </Box>
  )
}

// ── Formulário de senha ────────────────────────────────────
function PasswordForm({
  pwd, setPwd, error, onConfirm, onKeyDown, inputRef,
}: {
  pwd: string; setPwd: (v: string) => void; error: boolean
  onConfirm: () => void; onKeyDown: (e: React.KeyboardEvent) => void
  inputRef: React.RefObject<HTMLInputElement>
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box>
        <Typography sx={{ fontSize: { xs: '1.3rem', md: '1.65rem', lg: '1.9rem' }, fontWeight: 900, color: 'rgba(255,255,255,0.38)', letterSpacing: '-0.03em', lineHeight: 1.1, mb: 0.35 }}>
          Área restrita
        </Typography>
        <Typography sx={{
          fontSize: { xs: '1.3rem', md: '1.65rem', lg: '1.9rem' }, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1,
          background: 'linear-gradient(135deg, #ff9039, #ff5339)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Digite a senha
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.4 }}>
        <TextField
          inputRef={inputRef} fullWidth type="password"
          placeholder="Senha de acesso..."
          value={pwd} onChange={e => setPwd(e.target.value)}
          onKeyDown={onKeyDown} autoComplete="off" autoFocus
          sx={{
            animation: error ? 'shake 0.42s ease' : 'none',
            '& .MuiOutlinedInput-root': {
              color: '#fff', background: 'rgba(255,255,255,0.03)', borderRadius: 2.5,
              fontSize: { xs: '1rem', md: '1.1rem' }, fontWeight: 600,
              '& fieldset': { borderColor: error ? '#FF4545' : 'rgba(255,144,57,0.2)', borderWidth: '1.5px' },
              '&:hover fieldset': { borderColor: 'rgba(255,144,57,0.42)' },
              '&.Mui-focused fieldset': { borderColor: '#ff9039', borderWidth: '2px' },
            },
            '& input::placeholder': { color: 'rgba(255,255,255,0.18)', opacity: 1 },
            '& .MuiOutlinedInput-input': { py: 1.8, px: 2 },
          }}
        />
        {error && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.4,
            px: 2, py: 1.1, borderRadius: 2,
            background: 'rgba(255,69,69,0.08)', border: '1.5px solid rgba(255,69,69,0.28)',
            animation: 'badgeIn 0.22s ease both',
          }}>
            <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }}>🔒</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.58rem', color: '#FF4545', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Acesso negado</Typography>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.58)' }}>Senha incorreta</Typography>
            </Box>
          </Box>
        )}
        <Button variant="contained" onClick={onConfirm} disabled={!pwd.trim()} fullWidth
          sx={{
            py: 1.5,
            background: pwd.trim() ? 'linear-gradient(135deg, #ff9039, #ff5339)' : 'rgba(255,255,255,0.04)',
            color: pwd.trim() ? '#000' : 'rgba(255,255,255,0.16)',
            fontWeight: 800, fontSize: '1rem', borderRadius: 2.5,
            boxShadow: pwd.trim() ? '0 6px 20px rgba(255,144,57,0.32)' : 'none',
            transition: 'all 0.22s ease',
            '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
            '&.Mui-disabled': { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.16)' },
          }}>
          Acessar →
        </Button>
      </Box>
      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.15)', textAlign: 'center' }}>
        Pressione Enter para confirmar
      </Typography>
    </Box>
  )
}

// ── Formulário de nome ─────────────────────────────────────
function NameForm({
  name, setName, detected, error, denied, onConfirm, onKeyDown, inputRef,
}: {
  name: string; setName: (v: string) => void
  detected: ReturnType<typeof detectUser>; error: boolean; denied: boolean
  onConfirm: () => void; onKeyDown: (e: React.KeyboardEvent) => void
  inputRef: React.RefObject<HTMLInputElement>
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box>
        <Typography sx={{ fontSize: { xs: '1.3rem', md: '1.65rem', lg: '1.9rem' }, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, mb: 0.35 }}>
          Olá! Qual é o
        </Typography>
        <Typography sx={{
          fontSize: { xs: '1.3rem', md: '1.65rem', lg: '1.9rem' }, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1,
          background: 'linear-gradient(135deg, #ff9039, #ff5339)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          seu nome?
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.4 }}>
        <TextField
          inputRef={inputRef} fullWidth
          placeholder="Digite seu nome..."
          value={name} onChange={e => setName(e.target.value)}
          onKeyDown={onKeyDown} autoComplete="off" autoFocus
          sx={{
            animation: error ? 'shake 0.42s ease' : 'none',
            '& .MuiOutlinedInput-root': {
              color: '#fff', background: 'rgba(255,255,255,0.03)', borderRadius: 2.5,
              fontSize: { xs: '1rem', md: '1.1rem' }, fontWeight: 600,
              '& fieldset': { borderColor: error ? '#FF4545' : 'rgba(255,144,57,0.2)', borderWidth: '1.5px' },
              '&:hover fieldset': { borderColor: 'rgba(255,144,57,0.42)' },
              '&.Mui-focused fieldset': { borderColor: '#ff9039', borderWidth: '2px' },
            },
            '& input::placeholder': { color: 'rgba(255,255,255,0.18)', opacity: 1 },
            '& .MuiOutlinedInput-input': { py: 1.8, px: 2 },
          }}
        />

        {denied ? (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.4,
            px: 2, py: 1.1, borderRadius: 2,
            background: 'rgba(255,69,69,0.08)', border: '1.5px solid rgba(255,69,69,0.28)',
            animation: 'badgeIn 0.22s ease both',
          }}>
            <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }}>🚫</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.58rem', color: '#FF4545', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Acesso negado</Typography>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.58)' }}>Nome não autorizado</Typography>
            </Box>
          </Box>
        ) : detected ? (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.4,
            px: 2, py: 1.1, borderRadius: 2,
            background: `${detected.color}0c`, border: `1.5px solid ${detected.color}35`,
            boxShadow: `0 4px 16px ${detected.glow}`,
            animation: 'badgeIn 0.28s cubic-bezier(0.16,1,0.3,1) both',
          }}>
            <Typography sx={{ fontSize: '1.4rem', lineHeight: 1 }}>{detected.emoji}</Typography>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.32)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Cargo detectado</Typography>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 800, color: detected.color, letterSpacing: '-0.01em' }}>{detected.role}</Typography>
            </Box>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: detected.color, boxShadow: `0 0 7px ${detected.glow}`, flexShrink: 0 }} />
          </Box>
        ) : name.trim().length > 0 ? (
          <Box sx={{
            px: 2, py: 1, borderRadius: 2,
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            animation: 'badgeIn 0.18s ease both',
          }}>
            <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>
              👤 Entrando como <strong style={{ color: 'rgba(255,255,255,0.62)' }}>{name.trim()}</strong>
            </Typography>
          </Box>
        ) : null}

        <Button variant="contained" onClick={onConfirm} disabled={!name.trim()} fullWidth
          sx={{
            py: 1.5,
            background: name.trim()
              ? (detected ? `linear-gradient(135deg, ${detected.color}, ${detected.color}cc)` : 'linear-gradient(135deg, #ff9039, #ff5339)')
              : 'rgba(255,255,255,0.04)',
            color: name.trim() ? '#000' : 'rgba(255,255,255,0.16)',
            fontWeight: 800, fontSize: '1rem', borderRadius: 2.5,
            boxShadow: name.trim() && detected ? `0 6px 22px ${detected.glow}` : name.trim() ? '0 6px 20px rgba(255,144,57,0.32)' : 'none',
            transition: 'all 0.22s ease',
            '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
            '&.Mui-disabled': { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.16)' },
          }}>
          Entrar →
        </Button>
      </Box>
      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.15)', textAlign: 'center' }}>
        Pressione Enter para confirmar
      </Typography>
    </Box>
  )
}
