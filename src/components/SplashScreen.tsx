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
  currentUser?: string  // para mostrar "Bem-vindo de volta" quando já logado
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
  const theme     = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))

  const [phase, setPhase]    = useState<Phase>('enter')
  const [name, setName]      = useState('')
  const [error, setError]    = useState(false)
  const [denied, setDenied]  = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Live clock (atualiza a cada minuto) ──
  const [clockStr, setClockStr] = useState(() =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
  useEffect(() => {
    const id = setInterval(() =>
      setClockStr(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    , 60000)
    return () => clearInterval(id)
  }, [])
  const nowHour = new Date().getHours()
  const greeting = nowHour < 12 ? '☀️ Bom dia' : nowHour < 18 ? '🌤 Boa tarde' : '🌙 Boa noite'
  const todayFull = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  // ── Senha de acesso ──
  const [step, setStep] = useState<'password' | 'name'>(() =>
    sessionStorage.getItem('sm_pwd_ok') === '1' ? 'name' : 'password'
  )
  const [pwd, setPwd]         = useState('')
  const [pwdError, setPwdError] = useState(false)
  const pwdRef = useRef<HTMLInputElement>(null)

  const detected = detectUser(name)

  // ── Transições de fase — sem piscar ──
  useEffect(() => {
    if (!showLogin) {
      // Já logado: branding rápido → sair
      const t1 = setTimeout(() => setPhase('hold'), 600)
      const t2 = setTimeout(() => setPhase('exit'), 2000)
      const t3 = setTimeout(() => onFinish(), 2500)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    } else {
      // Login: enter → login (SEM fase 'hold' → elimina o flash dos anéis)
      const t1 = setTimeout(() => setPhase('login'), 950)
      const t2 = setTimeout(() => {
        if (step === 'password') pwdRef.current?.focus()
        else inputRef.current?.focus()
      }, 1200)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [showLogin, onFinish]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === 'name' && phase === 'login') {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
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
    setTimeout(() => {
      setPhase('exit')
      setTimeout(() => onFinish(), 500)
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

  const isLogin = phase === 'login' || phase === 'loading'
  const isExit  = phase === 'exit'

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex',
      flexDirection: isDesktop ? 'row' : 'column',
      alignItems:   isDesktop ? 'stretch' : 'center',
      justifyContent: isDesktop ? 'stretch' : 'center',
      overflowY: (!isDesktop && isLogin) ? 'auto' : 'hidden',
      // Fundo unificado — calor laranja à esq, escuro natural à dir (sem divisória seca)
      background: 'linear-gradient(108deg, #140700 0%, #0a0300 28%, #040100 52%, #020000 100%)',
      opacity: isExit ? 0 : 1,
      transition: isExit ? 'opacity 0.5s ease' : 'none',

      // ── Keyframes — todos calibrados para não piscar ──
      '@keyframes nebulaShift': {
        '0%,100%': { transform: 'scale(1) translate(0,0)' },
        '50%':     { transform: 'scale(1.05) translate(1.5%,-1.5%)' },
      },
      '@keyframes logoIn': {
        '0%':   { opacity: 0, transform: 'scale(0.7) translateY(28px)', filter: 'blur(18px) brightness(2.5)' },
        '70%':  { filter: 'blur(2px) brightness(1.3)' },
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
        '100%': { opacity: 0, transform: 'translateY(-160px) scale(0.5)' },
      },
      '@keyframes ringExpand': {
        '0%':   { transform: 'scale(0.7)', opacity: 0.45 },
        '100%': { transform: 'scale(2.2)', opacity: 0 },
      },
      // ✅ glowBreath suave — opacidade menor, scale menor
      '@keyframes glowBreath': {
        '0%,100%': { opacity: 0.35, transform: 'scale(1)'    },
        '50%':     { opacity: 0.62, transform: 'scale(1.07)' },
      },
      '@keyframes panelSlideIn': {
        '0%':   { opacity: 0, transform: 'translateX(32px)' },
        '100%': { opacity: 1, transform: 'translateX(0)'    },
      },
      // ✅ logoPulse suave — sem flash visível
      '@keyframes logoPulse': {
        '0%,100%': { filter: 'drop-shadow(0 0 18px rgba(255,120,30,0.5)) drop-shadow(0 0 45px rgba(255,80,0,0.22))' },
        '50%':     { filter: 'drop-shadow(0 0 28px rgba(255,150,40,0.72)) drop-shadow(0 0 70px rgba(255,100,0,0.38))' },
      },
      // ✅ ringPulse suave — amplitude menor, mais lento
      '@keyframes ringPulse': {
        '0%,100%': { transform: 'scale(1)',    opacity: 0.42 },
        '50%':     { transform: 'scale(1.04)', opacity: 0.65 },
      },
      '@keyframes ringPulse2': {
        '0%,100%': { transform: 'scale(1)',    opacity: 0.22 },
        '50%':     { transform: 'scale(1.05)', opacity: 0.42 },
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
      '@keyframes fadeInLoad': {
        '0%': { opacity: 0 }, '100%': { opacity: 1 }
      },
      '@keyframes starTwinkle': {
        '0%,100%': { opacity: 0.15 },
        '50%':     { opacity: 0.6  },
      },
      '@keyframes arcRotate': {
        from: { transform: 'rotate(0deg)' },
        to:   { transform: 'rotate(360deg)' },
      },
      '@keyframes neonPulse': {
        '0%,100%': { opacity: 0.55, filter: 'blur(0px)' },
        '50%':     { opacity: 1,    filter: 'blur(0.5px)' },
      },
      '@keyframes haloBreath': {
        '0%,100%': { opacity: 0.5, transform: 'scaleX(1)'    },
        '50%':     { opacity: 1,   transform: 'scaleX(1.15)' },
      },
    }}>

      {/* ══ CAMADA ATMOSFÉRICA GLOBAL — unifica os dois lados ══ */}
      {isDesktop && (
        <Box sx={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {/* Glow central do logo — sangra para dentro do lado direito */}
          <Box sx={{
            position: 'absolute',
            width: { md: 1100, lg: 1400, xl: 1700 },
            height: { md: 800, lg: 950, xl: 1100 },
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,90,10,0.32) 0%, rgba(220,60,0,0.18) 28%, rgba(120,30,0,0.09) 52%, rgba(40,10,0,0.03) 70%, transparent 85%)',
            filter: 'blur(55px)',
            left: '-8%', top: '50%', transform: 'translateY(-50%)',
            animation: 'glowBreath 6s ease-in-out infinite',
          }} />

          {/* Halo secundário mais frio — puxa para o centro */}
          <Box sx={{
            position: 'absolute',
            width: { md: 500, lg: 600 }, height: { md: 500, lg: 600 }, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,120,30,0.08) 0%, rgba(100,30,0,0.04) 50%, transparent 75%)',
            filter: 'blur(40px)',
            left: '35%', top: '20%',
            animation: 'glowBreath 9s ease-in-out 2s infinite',
          }} />

          {/* Nuvem de calor baixa */}
          <Box sx={{
            position: 'absolute',
            width: '80%', height: 280, borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(180,50,0,0.07) 0%, transparent 70%)',
            filter: 'blur(55px)',
            bottom: '-5%', left: '10%',
            animation: 'nebulaShift 14s ease-in-out infinite',
          }} />

          {/* Arco decorativo gigante — lado direito */}
          {!isLogin && (
            <Box sx={{
              position: 'absolute',
              width: { md: 700, lg: 900 }, height: { md: 700, lg: 900 }, borderRadius: '50%',
              border: '1px solid rgba(255,80,10,0.06)',
              right: '-15%', top: '50%', transform: 'translateY(-50%)',
              animation: 'arcRotate 60s linear infinite',
            }}>
              {/* Ponto brilhante no arco */}
              <Box sx={{
                position: 'absolute', top: '8%', left: '50%',
                width: 4, height: 4, borderRadius: '50%',
                bgcolor: 'rgba(255,140,40,0.4)',
                boxShadow: '0 0 10px rgba(255,140,40,0.5)',
              }} />
            </Box>
          )}
          {!isLogin && (
            <Box sx={{
              position: 'absolute',
              width: { md: 500, lg: 650 }, height: { md: 500, lg: 650 }, borderRadius: '50%',
              border: '1px solid rgba(255,60,0,0.04)',
              right: '-5%', top: '50%', transform: 'translateY(-50%)',
              animation: 'arcRotate 80s linear infinite reverse',
            }} />
          )}

          {/* Estrelinhas lado direito */}
          {!isLogin && Array.from({ length: 28 }, (_, i) => {
            const seed = i * 13.7
            const x = 50 + (seed % 47)
            const y = (seed * 1.8 + 7) % 95
            return (
              <Box key={i} sx={{
                position: 'absolute',
                left: `${x}%`, top: `${y}%`,
                width: i % 4 === 0 ? 2 : 1.5, height: i % 4 === 0 ? 2 : 1.5,
                borderRadius: '50%',
                bgcolor: i % 3 === 0 ? 'rgba(255,150,60,0.5)' : 'rgba(255,200,120,0.35)',
                animation: `starTwinkle ${2.5 + (i % 5) * 0.7}s ${(i * 0.22) % 3}s ease-in-out infinite`,
              }} />
            )
          })}

          {/* ── NEON DIVIDER — luz que une os dois lados ── */}
          {/* Halo difuso largo — aura que emana da linha */}
          <Box sx={{
            position: 'absolute',
            left: 'calc(50% - 80px)', top: 0, width: 160, height: '100%',
            background: 'linear-gradient(to right, transparent 0%, rgba(255,100,20,0.07) 25%, rgba(255,144,57,0.18) 50%, rgba(255,100,20,0.07) 75%, transparent 100%)',
            filter: 'blur(18px)',
            animation: 'haloBreath 5s ease-in-out infinite',
          }} />
          {/* Halo médio — brilho mais concentrado */}
          <Box sx={{
            position: 'absolute',
            left: 'calc(50% - 22px)', top: '5%', width: 44, height: '90%',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(255,130,40,0.2) 15%, rgba(255,144,57,0.35) 40%, rgba(255,160,60,0.4) 50%, rgba(255,144,57,0.35) 60%, rgba(255,130,40,0.2) 85%, transparent 100%)',
            filter: 'blur(6px)',
            animation: 'neonPulse 4s ease-in-out infinite',
          }} />
          {/* Linha neon central — 1px de luz pura */}
          <Box sx={{
            position: 'absolute',
            left: 'calc(50% - 0.5px)', top: '8%', width: 1, height: '84%',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(255,144,57,0.5) 12%, rgba(255,180,80,0.9) 35%, rgba(255,220,120,1) 50%, rgba(255,180,80,0.9) 65%, rgba(255,144,57,0.5) 88%, transparent 100%)',
            boxShadow: '0 0 8px 2px rgba(255,144,57,0.55), 0 0 22px 6px rgba(255,100,20,0.25)',
            animation: 'neonPulse 4s ease-in-out infinite',
            zIndex: 5,
          }} />

          {/* Scan-lines sutis no lado direito — efeito tech */}
          {!isLogin && (
            <Box sx={{
              position: 'absolute',
              right: 0, top: 0, width: '50%', height: '100%',
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 38px, rgba(255,80,10,0.018) 38px, rgba(255,80,10,0.018) 39px)',
              opacity: 0.6,
            }} />
          )}
        </Box>
      )}

      {/* ══ ESQUERDA — branding ══ */}
      <Box sx={{
        position: isDesktop ? 'relative' : 'absolute',
        inset:    isDesktop ? 'auto' : 0,
        width:    isDesktop ? '50%' : '100%',
        height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
        // Transparente — fundo unificado (root) cuida da atmosfera base
        background: 'transparent',
      }}>

        {/* Nebulosidades — 3 no modo login (mais calmo), 5 no modo splash puro */}
        {(isLogin ? [
          { w: 800, h: 520, x: '25%',  y: '55%', c: 'radial-gradient(ellipse, rgba(255,120,30,0.14) 0%, rgba(255,60,0,0.05) 55%, transparent 72%)', d: '14s', del: '0s'   },
          { w: 600, h: 440, x: '72%',  y: '42%', c: 'radial-gradient(ellipse, rgba(255,90,0,0.10)  0%, rgba(200,40,0,0.04) 55%, transparent 72%)', d: '18s', del: '2s'   },
          { w: 700, h: 480, x: '50%',  y: '78%', c: 'radial-gradient(ellipse, rgba(255,144,57,0.08) 0%, rgba(255,80,0,0.03) 55%, transparent 72%)', d: '12s', del: '1s'   },
        ] : [
          { w: 900, h: 600, x: '20%',  y: '60%', c: 'radial-gradient(ellipse, rgba(255,120,30,0.18) 0%, rgba(255,60,0,0.06) 50%, transparent 72%)',  d: '11s', del: '0s'   },
          { w: 700, h: 500, x: '75%',  y: '40%', c: 'radial-gradient(ellipse, rgba(255,90,0,0.14)  0%, rgba(200,40,0,0.05) 55%, transparent 72%)',   d: '14s', del: '1.8s' },
          { w: 800, h: 550, x: '50%',  y: '80%', c: 'radial-gradient(ellipse, rgba(255,144,57,0.1) 0%, rgba(255,80,0,0.04) 55%, transparent 72%)',   d: '9s',  del: '0.6s' },
          { w: 600, h: 400, x: '15%',  y: '25%', c: 'radial-gradient(ellipse, rgba(255,70,0,0.12)  0%, rgba(180,30,0,0.04) 55%, transparent 72%)',   d: '16s', del: '2.5s' },
          { w: 500, h: 380, x: '85%',  y: '75%', c: 'radial-gradient(ellipse, rgba(255,160,40,0.1) 0%, rgba(255,100,0,0.03) 55%, transparent 72%)',  d: '12s', del: '1s'   },
        ]).map((n, i) => (
          <Box key={i} sx={{
            position: 'absolute', borderRadius: '50%', filter: 'blur(72px)', pointerEvents: 'none',
            width: n.w, height: n.h, left: n.x, top: n.y,
            background: n.c, transform: 'translate(-50%,-50%)',
            animation: `nebulaShift ${n.d} ${n.del} ease-in-out infinite`,
          }} />
        ))}

        {/* Anéis orbitais — apenas quando não está no login */}
        {!isLogin && [280, 390, 500].map((r, i) => (
          <Box key={i} sx={{
            position: 'absolute', width: r, height: r, borderRadius: '50%', pointerEvents: 'none',
            border: `1px solid ${['rgba(255,144,57,0.18)','rgba(255,80,0,0.11)','rgba(255,180,60,0.07)'][i]}`,
            animation: `orbitSpin ${[20,32,48][i]}s linear infinite`,
          }}>
            <Box sx={{
              position: 'absolute', top: -4, left: '50%', width: 6, height: 6, borderRadius: '50%',
              bgcolor: ['#ff9039','#ff5339','#ffb040'][i],
              boxShadow: `0 0 12px 3px ${['rgba(255,144,57,0.6)','rgba(255,83,57,0.5)','rgba(255,176,64,0.45)'][i]}`,
            }} />
          </Box>
        ))}

        {/* Anéis expansivos — SOMENTE na fase 'hold' (só quando showLogin=false) */}
        {phase === 'hold' && !showLogin && [0,1,2].map(i => (
          <Box key={i} sx={{
            position: 'absolute', width: 160, height: 160, borderRadius: '50%', pointerEvents: 'none',
            border: `2.5px solid ${['rgba(255,144,57,0.5)','rgba(255,100,30,0.32)','rgba(255,60,0,0.2)'][i]}`,
            animation: `ringExpand 1.8s ${i * 0.4}s ease-out forwards`,
          }} />
        ))}

        {/* Brilho central — apenas fora do login */}
        {!isLogin && (
          <Box sx={{
            position: 'absolute', width: 300, height: 300, borderRadius: '50%', pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(255,120,30,0.26) 0%, rgba(255,60,0,0.09) 50%, transparent 80%)',
            filter: 'blur(28px)', animation: 'glowBreath 5s ease-in-out infinite',
          }} />
        )}

        {/* Partículas — menos intensas (14 no login, 22 no splash puro) */}
        {Array.from({ length: isLogin ? 14 : 22 }, (_, i) => {
          const angle  = (i / (isLogin ? 14 : 22)) * Math.PI * 2
          const radius = 68 + (i % 5) * 26
          return (
            <Box key={i} sx={{
              position: 'absolute', pointerEvents: 'none',
              width: 2 + (i % 3), height: 2 + (i % 3), borderRadius: '50%',
              bgcolor: ['rgba(255,144,57,0.75)','rgba(255,100,30,0.65)','rgba(255,60,0,0.6)','rgba(255,190,60,0.55)'][i % 4],
              left: `calc(50% + ${Math.cos(angle) * radius}px)`,
              top:  `calc(50% + ${Math.sin(angle) * radius}px)`,
              animation: `particleRise ${2.5 + (i % 4) * 0.8}s ${(i * 0.18) % 2.4}s ease-out infinite`,
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
          animation: phase === 'enter' ? 'logoIn 0.95s cubic-bezier(0.16,1,0.3,1) forwards' : 'none',
          transition: 'gap 0.5s ease',
        }}>
          <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Halos de fundo do logo — mais suaves */}
            <Box sx={{
              position: 'absolute',
              width:  isDesktop && isLogin ? 320 : 400, height: isDesktop && isLogin ? 320 : 400,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,110,20,0.20) 0%, rgba(255,60,0,0.07) 45%, transparent 72%)',
              filter: 'blur(22px)', animation: 'ringPulse2 7s ease-in-out infinite', pointerEvents: 'none',
              transition: 'width 0.5s ease, height 0.5s ease',
            }} />
            <Box sx={{
              position: 'absolute',
              width:  isDesktop && isLogin ? 240 : 300, height: isDesktop && isLogin ? 240 : 300,
              borderRadius: '50%',
              border: '1.5px solid rgba(255,144,57,0.28)',
              boxShadow: '0 0 14px rgba(255,144,57,0.16), inset 0 0 14px rgba(255,100,0,0.07)',
              animation: 'ringPulse2 6s ease-in-out 0.6s infinite', pointerEvents: 'none',
              transition: 'width 0.5s ease, height 0.5s ease',
            }} />
            <Box sx={{
              position: 'absolute',
              width:  isDesktop && isLogin ? 175 : 225, height: isDesktop && isLogin ? 175 : 225,
              borderRadius: '50%',
              border: '1.5px solid rgba(255,120,30,0.44)',
              boxShadow: '0 0 20px rgba(255,120,30,0.28), inset 0 0 18px rgba(255,80,0,0.1)',
              animation: 'ringPulse 4.5s ease-in-out infinite', pointerEvents: 'none',
              transition: 'width 0.5s ease, height 0.5s ease',
            }} />
            <Box
              component="img" src="/logotipo.png" alt="Digital Scale"
              sx={{
                position: 'relative', zIndex: 2,
                width: isDesktop && isLogin
                  ? { md: 200, lg: 240, xl: 280 }
                  : isLogin
                  ? { xs: 120, sm: 145 }
                  : { xs: 190, sm: 250 },
                height: 'auto',
                // ✅ logoPulse muito mais suave — sem flash visível
                animation: 'logoPulse 5s ease-in-out 1.2s infinite',
                transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)',
              }}
            />
          </Box>

          {(!isLogin || isDesktop) && (
            <Box sx={{
              fontSize: isDesktop && isLogin ? { md: '0.75rem', lg: '0.82rem' } : { xs: '0.62rem', sm: '0.7rem' },
              fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase',
              background: 'linear-gradient(90deg, rgba(255,144,57,0.4) 0%, #fff3d6 30%, #ff9039 52%, #ffb347 72%, rgba(255,144,57,0.4) 100%)',
              backgroundSize: '300% auto',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              animation: 'shimmer 4.5s 0.8s linear infinite',
              userSelect: 'none',
            }}>
              Agência de Marketing Digital
            </Box>
          )}

          {/* Info compacta no modo login (desktop) */}
          {isDesktop && isLogin && (
            <Box sx={{ mt: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 36, height: 1, bgcolor: 'rgba(255,144,57,0.3)' }} />
              <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em', textAlign: 'center', lineHeight: 1.8 }}>
                PAINEL OPERACIONAL<br />Digital Scale · {new Date().getFullYear()}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2.5, mt: 0.5 }}>
                {[
                  { value: '17',   label: 'clientes' },
                  { value: '226',  label: 'posts/mês' },
                  { value: 'Maio', label: '2026' },
                ].map(k => (
                  <Box key={k.label} sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: '#ff9039', lineHeight: 1, textShadow: '0 0 12px rgba(255,144,57,0.5)' }}>
                      {k.value}
                    </Typography>
                    <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.24)', textTransform: 'uppercase', letterSpacing: 0.8, mt: 0.2 }}>
                      {k.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* "Bem-vindo de volta" quando showLogin=false */}
          {!showLogin && currentUser && isDesktop && (
            <Box sx={{
              mt: 1, px: 2.5, py: 1, borderRadius: 2,
              bgcolor: 'rgba(255,144,57,0.07)', border: '1px solid rgba(255,144,57,0.18)',
              animation: 'badgeIn 0.5s 0.6s ease both', opacity: 0,
            }}>
              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,144,57,0.75)', textAlign: 'center', letterSpacing: '0.04em' }}>
                Bem-vindo de volta, <strong style={{ color: '#ff9039' }}>{currentUser}</strong> 👋
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* ══ DIREITA (desktop) — painel de login ══ */}
      {isDesktop ? (
        <Box sx={{
          width: '50%', height: '100%',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          px: { md: 6, lg: 9, xl: 11 }, py: { md: 4, lg: 5 },
          background: 'linear-gradient(90deg, rgba(6,2,0,0.78) 0%, rgba(7,4,1,0.91) 12%, rgba(7,6,4,0.96) 30%, rgba(6,6,6,0.98) 60%, rgba(4,4,4,1) 100%)',
          backdropFilter: 'blur(12px)',
          position: 'relative', zIndex: 10,
          opacity: isLogin ? 1 : 0,
          transition: 'opacity 0.55s ease',
        }}>

          {/* ── TOPO: Saudação + relógio ── */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{
                fontSize: { md: '0.8rem', lg: '0.88rem' },
                fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em',
              }}>
                {greeting}
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)', mt: 0.3, textTransform: 'capitalize' }}>
                {todayFull}
              </Typography>
            </Box>

            {/* Relógio — mais visível */}
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{
                fontSize: { md: '1.75rem', lg: '2.1rem' }, fontWeight: 900,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em',
                color: 'rgba(255,144,57,0.55)', lineHeight: 1,
              }}>
                {clockStr}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, justifyContent: 'flex-end', mt: 0.5 }}>
                <Box sx={{
                  width: 5, height: 5, borderRadius: '50%', bgcolor: '#00C47A',
                  boxShadow: '0 0 6px #00C47A',
                  animation: 'statusDot 3s ease-in-out infinite',
                  '@keyframes statusDot': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.55 } },
                }} />
                <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em' }}>
                  SISTEMA ONLINE
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* ── MEIO: Formulário ── */}
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

          {/* ── BASE: KPI cards + status ── */}
          <Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
              {[
                { emoji: '👥', value: '17',   label: 'Clientes ativos',   color: '#ff9039' },
                { emoji: '📱', value: '226',  label: 'Posts este mês',    color: '#3B8EFF' },
                { emoji: '🚀', value: 'Maio', label: 'Competência atual', color: '#00C47A' },
              ].map(kpi => (
                <Box key={kpi.label} sx={{
                  flex: 1, px: 1.4, py: 1.3, borderRadius: 2,
                  bgcolor: `${kpi.color}06`,
                  border: `1px solid ${kpi.color}14`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.35,
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: `${kpi.color}0d`, borderColor: `${kpi.color}28` },
                }}>
                  <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>{kpi.emoji}</Typography>
                  <Typography sx={{
                    fontSize: '1.05rem', fontWeight: 900, color: kpi.color, lineHeight: 1,
                    textShadow: `0 0 10px ${kpi.color}44`,
                  }}>{kpi.value}</Typography>
                  <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.24)', textAlign: 'center', lineHeight: 1.3 }}>
                    {kpi.label}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Status inline */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, borderTop: '1px solid rgba(255,255,255,0.04)', pt: 1.5 }}>
              {[
                { label: 'Painel',      color: '#00C47A', delay: '0s'    },
                { label: 'Cloudflare', color: '#00C47A', delay: '0.8s'  },
                { label: 'IA',         color: '#00C47A', delay: '1.6s'  },
              ].map((s) => (
                <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 2 }}>
                  <Box sx={{
                    width: 5, height: 5, borderRadius: '50%', bgcolor: s.color,
                    boxShadow: `0 0 5px ${s.color}`,
                    animation: `statusDot2 4s ${s.delay} ease-in-out infinite`,
                    '@keyframes statusDot2': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.55 } },
                  }} />
                  <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.22)' }}>{s.label}</Typography>
                </Box>
              ))}
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '0.05em' }}>
                v2.6 · Digital Scale
              </Typography>
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

      {/* Gradiente inferior */}
      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '18%', background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)', pointerEvents: 'none', zIndex: 1 }} />

      {/* ══ OVERLAY DE LOADING ══ */}
      {phase === 'loading' && (
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 200,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(4,4,4,0.96)', backdropFilter: 'blur(20px)',
          animation: 'fadeInLoad 0.28s ease both',
          gap: 3,
        }}>
          <Box sx={{
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'pulseLoad 2s ease-in-out infinite',
            '@keyframes pulseLoad': {
              '0%,100%': { filter: 'drop-shadow(0 0 14px rgba(255,144,57,0.55))' },
              '50%':     { filter: 'drop-shadow(0 0 28px rgba(255,144,57,0.9))'  },
            },
          }}>
            <Box component="img" src="/logotipo.png" alt="DS" sx={{ width: 68, height: 'auto', opacity: 0.88 }} />
          </Box>

          <Box sx={{ display: 'flex', gap: 0.9 }}>
            {[0, 1, 2].map(i => (
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
            <Typography sx={{
              fontSize: '0.78rem', color: 'rgba(255,255,255,0.48)', letterSpacing: '0.06em',
              fontWeight: 500,
            }}>
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

// ── Formulário de senha ────────────────────────────────
function PasswordForm({
  pwd, setPwd, error, onConfirm, onKeyDown, inputRef, compact,
}: {
  pwd: string; setPwd: (v: string) => void; error: boolean
  onConfirm: () => void; onKeyDown: (e: React.KeyboardEvent) => void
  inputRef: React.RefObject<HTMLInputElement>; compact: boolean
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 2 : 3 }}>
      <Box>
        <Typography sx={{
          fontSize: compact ? '1.35rem' : { md: '1.75rem', lg: '2.1rem', xl: '2.3rem' },
          fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '-0.03em', lineHeight: 1.1, mb: 0.4,
        }}>
          Área restrita
        </Typography>
        <Typography sx={{
          fontSize: compact ? '1.35rem' : { md: '1.75rem', lg: '2.1rem', xl: '2.3rem' },
          fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1,
          background: 'linear-gradient(135deg, #ff9039, #ff5339)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Digite a senha
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <TextField
          inputRef={inputRef} fullWidth type="password"
          placeholder="Senha de acesso..."
          value={pwd} onChange={e => setPwd(e.target.value)}
          onKeyDown={onKeyDown} autoComplete="off" autoFocus
          sx={{
            animation: error ? 'shake 0.42s ease' : 'none',
            '& .MuiOutlinedInput-root': {
              color: '#fff', background: 'rgba(255,255,255,0.035)', borderRadius: 2.5,
              fontSize: compact ? '1.05rem' : { md: '1.1rem', lg: '1.2rem' }, fontWeight: 600,
              '& fieldset': { borderColor: error ? '#FF4545' : 'rgba(255,144,57,0.22)', borderWidth: '1.5px' },
              '&:hover fieldset': { borderColor: 'rgba(255,144,57,0.45)' },
              '&.Mui-focused fieldset': { borderColor: '#ff9039', borderWidth: '2px' },
            },
            '& input::placeholder': { color: 'rgba(255,255,255,0.2)', opacity: 1 },
            '& .MuiOutlinedInput-input': { py: compact ? 1.5 : 1.9, px: 2 },
          }}
        />

        {error && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 2, py: 1.2, borderRadius: 2,
            background: 'rgba(255,69,69,0.08)', border: '1.5px solid rgba(255,69,69,0.3)',
            animation: 'badgeIn 0.22s ease both',
          }}>
            <Typography sx={{ fontSize: '1.3rem', lineHeight: 1 }}>🔒</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.6rem', color: '#FF4545', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Acesso negado
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                Senha incorreta
              </Typography>
            </Box>
          </Box>
        )}

        <Button variant="contained" onClick={onConfirm} disabled={!pwd.trim()} fullWidth
          sx={{
            py: compact ? 1.3 : 1.55,
            background: pwd.trim() ? 'linear-gradient(135deg, #ff9039, #ff5339)' : 'rgba(255,255,255,0.05)',
            color: pwd.trim() ? '#000' : 'rgba(255,255,255,0.18)',
            fontWeight: 800, fontSize: compact ? '0.95rem' : '1rem', borderRadius: 2.5,
            boxShadow: pwd.trim() ? '0 6px 18px rgba(255,144,57,0.35)' : 'none',
            transition: 'all 0.22s ease',
            '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
            '&.Mui-disabled': { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.18)' },
          }}>
          Acessar →
        </Button>
      </Box>

      <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.18)', textAlign: 'center' }}>
        Pressione Enter para confirmar
      </Typography>
    </Box>
  )
}

// ── Formulário de nome ─────────────────────────────────
function NameForm({
  name, setName, detected, error, denied, onConfirm, onKeyDown, inputRef, compact,
}: {
  name: string; setName: (v: string) => void
  detected: ReturnType<typeof detectUser>; error: boolean; denied: boolean
  onConfirm: () => void; onKeyDown: (e: React.KeyboardEvent) => void
  inputRef: React.RefObject<HTMLInputElement>; compact: boolean
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 2 : 3 }}>
      <Box>
        <Typography sx={{
          fontSize: compact ? '1.35rem' : { md: '1.75rem', lg: '2.1rem', xl: '2.3rem' },
          fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, mb: 0.4,
        }}>
          Olá! Qual é o
        </Typography>
        <Typography sx={{
          fontSize: compact ? '1.35rem' : { md: '1.75rem', lg: '2.1rem', xl: '2.3rem' },
          fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1,
          background: 'linear-gradient(135deg, #ff9039, #ff5339)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          seu nome?
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <TextField
          inputRef={inputRef} fullWidth
          placeholder="Digite seu nome..."
          value={name} onChange={e => setName(e.target.value)}
          onKeyDown={onKeyDown} autoComplete="off" autoFocus
          sx={{
            animation: error ? 'shake 0.42s ease' : 'none',
            '& .MuiOutlinedInput-root': {
              color: '#fff', background: 'rgba(255,255,255,0.035)', borderRadius: 2.5,
              fontSize: compact ? '1.05rem' : { md: '1.1rem', lg: '1.2rem' }, fontWeight: 600,
              '& fieldset': { borderColor: error ? '#FF4545' : 'rgba(255,144,57,0.22)', borderWidth: '1.5px' },
              '&:hover fieldset': { borderColor: 'rgba(255,144,57,0.45)' },
              '&.Mui-focused fieldset': { borderColor: '#ff9039', borderWidth: '2px' },
            },
            '& input::placeholder': { color: 'rgba(255,255,255,0.2)', opacity: 1 },
            '& .MuiOutlinedInput-input': { py: compact ? 1.5 : 1.9, px: 2 },
          }}
        />

        {/* Badge de resultado */}
        {denied ? (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 2, py: 1.2, borderRadius: 2,
            background: 'rgba(255,69,69,0.08)', border: '1.5px solid rgba(255,69,69,0.3)',
            animation: 'badgeIn 0.22s ease both',
          }}>
            <Typography sx={{ fontSize: '1.3rem', lineHeight: 1 }}>🚫</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.6rem', color: '#FF4545', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Acesso negado
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                Nome não autorizado
              </Typography>
            </Box>
          </Box>
        ) : detected ? (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 2, py: 1.2, borderRadius: 2,
            background: `${detected.color}0d`, border: `1.5px solid ${detected.color}38`,
            boxShadow: `0 4px 18px ${detected.glow}`,
            animation: 'badgeIn 0.28s cubic-bezier(0.16,1,0.3,1) both',
          }}>
            <Typography sx={{ fontSize: '1.45rem', lineHeight: 1 }}>{detected.emoji}</Typography>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Cargo detectado
              </Typography>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 800, color: detected.color, letterSpacing: '-0.01em' }}>
                {detected.role}
              </Typography>
            </Box>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: detected.color, boxShadow: `0 0 7px ${detected.glow}`, flexShrink: 0 }} />
          </Box>
        ) : name.trim().length > 0 ? (
          <Box sx={{
            px: 2, py: 1, borderRadius: 2,
            background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
            animation: 'badgeIn 0.18s ease both',
          }}>
            <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.32)' }}>
              👤 Entrando como <strong style={{ color: 'rgba(255,255,255,0.65)' }}>{name.trim()}</strong>
            </Typography>
          </Box>
        ) : null}

        <Button variant="contained" onClick={onConfirm} disabled={!name.trim()} fullWidth
          sx={{
            py: compact ? 1.3 : 1.55,
            background: name.trim()
              ? (detected ? `linear-gradient(135deg, ${detected.color}, ${detected.color}cc)` : 'linear-gradient(135deg, #ff9039, #ff5339)')
              : 'rgba(255,255,255,0.05)',
            color: name.trim() ? '#000' : 'rgba(255,255,255,0.18)',
            fontWeight: 800, fontSize: compact ? '0.95rem' : '1rem', borderRadius: 2.5,
            boxShadow: name.trim() && detected ? `0 6px 24px ${detected.glow}` : name.trim() ? '0 6px 18px rgba(255,144,57,0.35)' : 'none',
            transition: 'all 0.22s ease',
            '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
            '&.Mui-disabled': { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.18)' },
          }}>
          Entrar →
        </Button>
      </Box>

      <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.18)', textAlign: 'center' }}>
        Pressione Enter para confirmar
      </Typography>
    </Box>
  )
}
