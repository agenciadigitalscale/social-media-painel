import { useEffect, useState, useRef } from 'react'
import { Box, Typography, TextField, Button, CircularProgress } from '@mui/material'
import { NAME_MAP } from '../lib/users'
import { DS } from '../theme'

// ── Ordenação dos membros na tela de login ─────────────────
const MEMBER_ORDER = ['pradox', 'testa', 'kaique', 'geovana', 'jhones', 'kerges', 'arthur', 'robson']

// ── Frases motivacionais / versículos diários ──────────────
const DAILY_QUOTES: { text: string; ref: string }[] = [
  { text: 'Tudo posso naquele que me fortalece.', ref: 'Filipenses 4:13' },
  { text: 'O Senhor é meu pastor e nada me faltará.', ref: 'Salmos 23:1' },
  { text: 'Porque Deus não nos deu espírito de covardia, mas de poder, de amor e de moderação.', ref: '2 Timóteo 1:7' },
  { text: 'Não se turbe o vosso coração; credes em Deus, crede também em mim.', ref: 'João 14:1' },
  { text: 'Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.', ref: 'Salmos 37:5' },
  { text: 'O sucesso é a soma de pequenos esforços repetidos dia após dia.', ref: 'R. Collier' },
  { text: 'A excelência não é um ato, mas um hábito.', ref: 'Aristóteles' },
  { text: 'Seja a mudança que você quer ver no mundo.', ref: 'Mahatma Gandhi' },
  { text: 'Grandes realizações são possíveis quando damos importância a pequenos começos.', ref: 'Lao Tsé' },
  { text: 'Não espere por uma crise para descobrir o que é importante em sua vida.', ref: 'Platão' },
  { text: 'Tudo é possível para quem crê.', ref: 'Marcos 9:23' },
  { text: 'Buscai primeiro o reino de Deus, e todas essas coisas vos serão acrescentadas.', ref: 'Mateus 6:33' },
  { text: 'A fé é a certeza daquilo que esperamos e a prova das coisas que não vemos.', ref: 'Hebreus 11:1' },
  { text: 'Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.', ref: 'Provérbios 3:5' },
  { text: 'O trabalho duro vence o talento quando o talento não trabalha duro.', ref: 'Tim Notke' },
  { text: 'Você não falha quando cai; você falha quando decide não se levantar.', ref: 'Provérbio' },
  { text: 'O único jeito de fazer um bom trabalho é amar o que você faz.', ref: 'Steve Jobs' },
  { text: 'Discipline is choosing between what you want now and what you want most.', ref: 'Abraham Lincoln' },
  { text: 'A mente que se abre a uma nova ideia jamais volta ao seu tamanho original.', ref: 'Albert Einstein' },
  { text: 'O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti.', ref: 'Números 6:24-25' },
  { text: 'Não desanimeis de fazer o bem; porque a seu tempo ceifaremos, se não desfalecermos.', ref: 'Gálatas 6:9' },
  { text: 'A coragem não é a ausência do medo, mas o julgamento de que outra coisa é mais importante.', ref: 'Ambrose Redmoon' },
  { text: 'Quem semeia em lágrimas, em cânticos ceifará.', ref: 'Salmos 126:5' },
  { text: 'Porque eu sei os planos que tenho para vós, diz o Senhor, planos de paz e não de mal.', ref: 'Jeremias 29:11' },
  { text: 'Levanta-te, pois esta é a tua missão.', ref: 'Atos 26:16' },
  { text: 'O sucesso é ir de fracasso em fracasso sem perder o entusiasmo.', ref: 'Winston Churchill' },
  { text: 'Hoje é um novo dia — uma nova chance de fazer algo extraordinário.', ref: 'Inspiração' },
  { text: 'Não são os anos em sua vida que contam, mas a vida em seus anos.', ref: 'Abraham Lincoln' },
  { text: 'Todo esforço tem sua recompensa; o tempo é o maior testemunho.', ref: 'Provérbio' },
  { text: 'O Senhor é a minha força e o meu escudo; nele confiou o meu coração.', ref: 'Salmos 28:7' },
]

function getDailyQuote() {
  const start = new Date(new Date().getFullYear(), 0, 0).getTime()
  const dayOfYear = Math.floor((Date.now() - start) / 86_400_000)
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length]
}

interface Props {
  showLogin: boolean
  onFinish: () => void
  onLogin: (name: string) => void
  currentUser?: string
  onManagePasswords?: () => void
}

type Phase = 'enter' | 'hold' | 'login' | 'loading' | 'exit'

const LOADING_MSGS = [
  'Sincronizando tarefas...',
  'Carregando aprovações...',
  'Atualizando operação...',
  'Carregando clientes...',
  'Tudo pronto!',
]

export default function SplashScreen({ showLogin, onFinish, onLogin, currentUser, onManagePasswords }: Props) {
  const [phase, setPhase]           = useState<Phase>('enter')
  const [loadingMsg, setLoadingMsg] = useState(0)

  const [clockStr, setClockStr] = useState(() =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
  useEffect(() => {
    const id = setInterval(() =>
      setClockStr(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    , 60000)
    return () => clearInterval(id)
  }, [])

  const nowHour   = new Date().getHours()
  const greeting  = nowHour < 12 ? '☀️ Bom dia' : nowHour < 18 ? '🌤 Boa tarde' : '🌙 Boa noite'
  const todayFull = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  // ── Login state ────────────────────────────────────────────
  const [step, setStep]               = useState<'select' | 'password'>('select')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [configuredUsers, setConfiguredUsers] = useState<string[]>([])
  const [pwd, setPwd]                 = useState('')
  const [pwdError, setPwdError]       = useState('')
  const [pwdLoading, setPwdLoading]   = useState(false)
  const pwdRef = useRef<HTMLInputElement>(null)

  const dailyQuote = getDailyQuote()

  // Carrega quais usuários têm senha configurada no D1
  useEffect(() => {
    fetch('/api/role-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check' }),
    })
      .then(r => r.json())
      .then((d: { configured?: string[] }) => setConfiguredUsers(d.configured ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!showLogin) {
      const t1 = setTimeout(() => setPhase('hold'), 600)
      const t2 = setTimeout(() => setPhase('exit'), 2000)
      const t3 = setTimeout(() => onFinish(), 2500)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    } else {
      const t1 = setTimeout(() => setPhase('login'), 950)
      return () => clearTimeout(t1)
    }
  }, [showLogin, onFinish]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'loading') return
    const t = setInterval(() => setLoadingMsg(m => (m + 1) % LOADING_MSGS.length), 500)
    return () => clearInterval(t)
  }, [phase])

  function doLogin(username: string) {
    onLogin(username)
    setPhase('loading')
    setTimeout(() => { setPhase('exit'); setTimeout(() => onFinish(), 500) }, 2600)
  }

  function handleSelectMember(username: string) {
    setSelectedUser(username)
    const hasPassword = configuredUsers.includes(username)
    if (!hasPassword) {
      doLogin(username)
    } else {
      setStep('password')
      setTimeout(() => pwdRef.current?.focus(), 120)
    }
  }

  async function handlePasswordConfirm() {
    if (!pwd.trim() || !selectedUser || pwdLoading) return
    setPwdLoading(true)
    setPwdError('')
    try {
      const res  = await fetch('/api/role-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', role: selectedUser, password: pwd }),
      })
      const data = await res.json() as { ok: boolean }
      if (data.ok) {
        doLogin(selectedUser)
      } else {
        setPwdError('Senha incorreta')
        setPwd('')
        setTimeout(() => { setPwdError(''); pwdRef.current?.focus() }, 1500)
      }
    } catch {
      doLogin(selectedUser)
    } finally {
      setPwdLoading(false)
    }
  }

  const isLogin = phase === 'login' || phase === 'loading'
  const isExit  = phase === 'exit'
  const selectedInfo = selectedUser ? NAME_MAP[selectedUser] : null

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: isLogin ? 'flex-start' : 'center',
      overflowY: isLogin ? 'auto' : 'hidden',
      background: '#08090E',
      opacity: isExit ? 0 : 1,
      transition: isExit ? 'opacity 0.5s ease' : 'none',

      '@keyframes logoIn':      { '0%': { opacity: 0, transform: 'scale(0.88) translateY(20px)' }, '100%': { opacity: 1, transform: 'scale(1) translateY(0)' } },
      '@keyframes shake':       { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-5px)' }, '40%,80%': { transform: 'translateX(5px)' } },
      '@keyframes badgeIn':     { '0%': { opacity: 0, transform: 'translateY(7px) scale(0.94)' }, '100%': { opacity: 1, transform: 'translateY(0) scale(1)' } },
      '@keyframes cardSlideUp': { '0%': { opacity: 0, transform: 'translateY(24px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      '@keyframes fadeInLoad':  { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
      '@keyframes memberIn':    { '0%': { opacity: 0, transform: 'translateY(14px) scale(0.93)' }, '100%': { opacity: 1, transform: 'translateY(0) scale(1)' } },
      '@keyframes welcomeIn':   { '0%': { opacity: 0, transform: 'scale(0.92) translateY(16px)' }, '100%': { opacity: 1, transform: 'scale(1) translateY(0)' } },
      '@keyframes quoteIn':     { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      '@keyframes loadBar':     { '0%': { width: '0%' }, '70%': { width: '85%' }, '100%': { width: '100%' } },
      '@keyframes dotBounce':   { '0%,80%,100%': { transform: 'scale(0.55)', opacity: 0.35 }, '40%': { transform: 'scale(1)', opacity: 1 } },
      '@keyframes statusDot':   { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
      '@keyframes statusDot2':  { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
      '@keyframes glowBreath':  { '0%,100%': { opacity: 0.5 }, '50%': { opacity: 1 } },
      '@keyframes ringExpand':  { '0%': { transform: 'scale(0.75)', opacity: 0 }, '30%': { opacity: 0.6 }, '100%': { transform: 'scale(1.6)', opacity: 0 } },
      '@keyframes statIn':      { '0%': { opacity: 0, transform: 'translateY(16px) scale(0.9)' }, '100%': { opacity: 1, transform: 'translateY(0) scale(1)' } },
      '@keyframes taglineIn':   { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
    }}>

      {/* ── Fundo: grid + glows atmosféricos ── */}
      <Box sx={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
        backgroundImage: `linear-gradient(rgba(249,115,22,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.022) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }}>
        {/* Glow central laranja */}
        <Box sx={{ position: 'absolute', width: 800, height: 600, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(249,115,22,0.10) 0%, transparent 60%)', filter: 'blur(80px)', left: '50%', top: '40%', transform: 'translate(-50%,-50%)', animation: 'glowBreath 6s ease-in-out infinite' }} />
        {/* Glow superior esquerdo — azul */}
        <Box sx={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(96,165,250,0.05) 0%, transparent 65%)', filter: 'blur(100px)', left: '5%', top: '10%', animation: 'glowBreath 9s 2s ease-in-out infinite' }} />
        {/* Glow inferior direito — roxo */}
        <Box sx={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(192,132,252,0.06) 0%, transparent 65%)', filter: 'blur(100px)', right: '5%', bottom: '10%', animation: 'glowBreath 7s 4s ease-in-out infinite' }} />
      </Box>

      {/* ── Logo ── */}
      <Box sx={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', pt: isLogin ? { xs: 3.5, sm: 4, md: 5 } : 0, pb: isLogin ? { xs: 1.5, md: 2 } : 3, opacity: phase === 'enter' ? 0 : 1, animation: phase === 'enter' ? 'logoIn 0.7s cubic-bezier(0.16,1,0.3,1) forwards' : 'none', transition: 'padding 0.5s ease' }}>

        {/* Anéis orbitais — só durante hold, apenas no splash (não login) */}
        {!isLogin && phase === 'hold' && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            {[0, 0.7, 1.4].map((delay, i) => (
              <Box key={i} sx={{
                position: 'absolute',
                width: { xs: 220, md: 280, lg: 340 }, height: { xs: 220, md: 280, lg: 340 },
                borderRadius: '50%',
                border: `1px solid rgba(249,115,22,${0.18 - i * 0.04})`,
                animation: `ringExpand 2.8s ${delay}s ease-out infinite`,
              }} />
            ))}
          </Box>
        )}

        <Box component="img" src="/logotipo.png" alt="Digital Scale" sx={{
          width: isLogin ? { xs: 90, sm: 110, md: 135 } : { xs: 180, sm: 230, md: 280, lg: 320, xl: 360 },
          height: 'auto', transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)', opacity: 0.95,
          filter: !isLogin && phase === 'hold' ? 'drop-shadow(0 0 32px rgba(249,115,22,0.35))' : 'none',
        }} />
        <Typography sx={{ mt: isLogin ? 1 : 2, fontSize: isLogin ? { xs: '0.5rem', md: '0.58rem' } : { xs: '0.58rem', sm: '0.65rem', md: '0.72rem', lg: '0.8rem' }, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(249,115,22,0.55)', userSelect: 'none', transition: 'font-size 0.5s ease, margin 0.5s ease' }}>
          Agência de Marketing Digital
        </Typography>
        {!showLogin && currentUser && (
          <Box sx={{ mt: 2.5, px: 2.5, py: 1, borderRadius: 2, bgcolor: 'rgba(255,144,57,0.07)', border: '1px solid rgba(255,144,57,0.2)', animation: 'badgeIn 0.5s 0.7s ease both', opacity: 0 }}>
            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,144,57,0.8)', textAlign: 'center', letterSpacing: '0.04em' }}>
              Bem-vindo de volta, <strong style={{ color: '#ff9039' }}>{currentUser}</strong> 👋
            </Typography>
          </Box>
        )}
      </Box>

      {/* ── Stats pills — só durante hold (splash pré-login) ── */}
      {!isLogin && phase === 'hold' && (
        <Box sx={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: { xs: 1, md: 1.5 }, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { emoji: '🏆', value: '17',   label: 'clientes ativos',  color: '#F97316', delay: '0s'    },
              { emoji: '📸', value: '226+', label: 'conteúdos/mês',   color: '#3B8EFF', delay: '0.12s' },
              { emoji: '🤖', value: 'IA',   label: 'integrada',        color: '#C084FC', delay: '0.22s' },
              { emoji: '☁️', value: 'Edge', label: 'Cloudflare',       color: '#00C47A', delay: '0.32s' },
            ].map(stat => (
              <Box key={stat.label} sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4,
                px: { xs: 1.8, md: 2.2 }, py: { xs: 1.2, md: 1.6 }, borderRadius: 2.5,
                bgcolor: `${stat.color}09`, border: `1px solid ${stat.color}22`,
                backdropFilter: 'blur(12px)',
                animation: `statIn 0.55s ${stat.delay} cubic-bezier(0.16,1,0.3,1) both`,
                opacity: 0,
              }}>
                <Typography sx={{ fontSize: { xs: '1rem', md: '1.2rem' }, lineHeight: 1 }}>{stat.emoji}</Typography>
                <Typography sx={{ fontSize: { xs: '1rem', md: '1.2rem' }, fontWeight: 900, color: stat.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{stat.value}</Typography>
                <Typography sx={{ fontSize: { xs: '0.5rem', md: '0.55rem' }, color: 'rgba(255,255,255,0.28)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mt: 0.2 }}>{stat.label}</Typography>
              </Box>
            ))}
          </Box>

          <Typography sx={{
            fontSize: { xs: '0.72rem', md: '0.85rem' },
            color: 'rgba(255,255,255,0.22)',
            letterSpacing: '0.08em',
            fontWeight: 400,
            animation: 'taglineIn 0.8s 0.5s ease both',
            opacity: 0,
            textAlign: 'center',
          }}>
            Gestão de social media em tempo real
          </Typography>
        </Box>
      )}

      {/* ── Painel de login ── */}
      {isLogin && phase !== 'loading' && (
        <Box sx={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: { xs: '100%', sm: 520, md: 560 }, mx: 'auto', px: { xs: 1.5, sm: 0 }, pb: { xs: 5, md: 5 }, animation: 'cardSlideUp 0.5s 0.08s cubic-bezier(0.16,1,0.3,1) both' }}>
          <Box sx={{ borderRadius: { xs: 3, sm: 4 }, background: 'rgba(11,12,18,0.98)', backdropFilter: 'blur(32px)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 40px rgba(0,0,0,0.6)', overflow: 'hidden' }}>

            {/* Cabeçalho */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 2.5, md: 3.5 }, pt: { xs: 2, md: 2.5 }, pb: { xs: 1.5, md: 2 }, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <Box>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.42)', letterSpacing: '0.03em' }}>{greeting}</Typography>
                <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.18)', mt: 0.25, textTransform: 'capitalize' }}>{todayFull}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontSize: { xs: '1.5rem', md: '1.85rem' }, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', color: 'rgba(255,144,57,0.48)', lineHeight: 1 }}>{clockStr}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end', mt: 0.4 }}>
                  <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#00C47A', boxShadow: '0 0 5px #00C47A', animation: 'statusDot 3s ease-in-out infinite' }} />
                  <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.16)', letterSpacing: '0.08em' }}>ONLINE</Typography>
                </Box>
              </Box>
            </Box>

            {/* Formulário */}
            <Box sx={{ px: { xs: 2.5, md: 3.5 }, py: { xs: 2.5, md: 3 } }}>
              {step === 'select' ? (
                <UserSelectForm members={MEMBER_ORDER} configuredUsers={configuredUsers} onSelect={handleSelectMember} />
              ) : (
                <UserPasswordForm
                  username={selectedUser!}
                  userInfo={selectedInfo}
                  pwd={pwd} setPwd={setPwd}
                  error={pwdError} loading={pwdLoading}
                  onConfirm={handlePasswordConfirm}
                  onBack={() => { setStep('select'); setSelectedUser(null); setPwd(''); setPwdError('') }}
                  inputRef={pwdRef}
                />
              )}
            </Box>

            {/* Rodapé */}
            <Box sx={{ px: { xs: 2.5, md: 3.5 }, pb: { xs: 2, md: 2.5 }, borderTop: '1px solid rgba(255,255,255,0.04)', pt: 0 }}>
              <Box sx={{ display: 'flex', gap: 0.8, mb: 1.2 }}>
                {[
                  { emoji: '👥', value: '17',   label: 'Clientes',  color: '#ff9039' },
                  { emoji: '📱', value: '226',  label: 'Posts/mês', color: '#3B8EFF' },
                  { emoji: '🚀', value: new Date().toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').replace(/^\w/, c => c.toUpperCase()), label: String(new Date().getFullYear()), color: '#00C47A' },
                ].map(kpi => (
                  <Box key={kpi.label} sx={{ flex: 1, px: 0.8, py: 0.9, borderRadius: 2, bgcolor: `${kpi.color}07`, border: `1px solid ${kpi.color}12`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.2 }}>
                    <Typography sx={{ fontSize: '0.82rem', lineHeight: 1 }}>{kpi.emoji}</Typography>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 900, color: kpi.color, lineHeight: 1 }}>{kpi.value}</Typography>
                    <Typography sx={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.22)', textAlign: 'center' }}>{kpi.label}</Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', pt: 1 }}>
                {[{ label: 'Painel', color: '#00C47A', delay: '0s' }, { label: 'Cloudflare', color: '#00C47A', delay: '0.8s' }, { label: 'IA', color: '#00C47A', delay: '1.6s' }].map(s => (
                  <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 1.8 }}>
                    <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: s.color, boxShadow: `0 0 4px ${s.color}`, animation: `statusDot2 4s ${s.delay} ease-in-out infinite` }} />
                    <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)' }}>{s.label}</Typography>
                  </Box>
                ))}
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '0.05em' }}>v2.8 · Digital Scale</Typography>
              </Box>

              {/* Acesso rápido — gerenciar senhas */}
              {onManagePasswords && step === 'select' && (
                <Box
                  onClick={onManagePasswords}
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8,
                    mt: 1.2, py: 0.9, borderRadius: 2, cursor: 'pointer',
                    border: '1px solid rgba(255,215,0,0.12)',
                    bgcolor: 'rgba(255,215,0,0.04)',
                    transition: 'all 0.2s ease',
                    '&:hover': { bgcolor: 'rgba(255,215,0,0.1)', borderColor: 'rgba(255,215,0,0.3)' },
                  }}
                >
                  <Typography sx={{ fontSize: '0.78rem', lineHeight: 1 }}>🔐</Typography>
                  <Typography sx={{
                    fontSize: '0.6rem', fontWeight: 700,
                    color: 'rgba(255,215,0,0.45)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    '&:hover': { color: '#FFD700' },
                  }}>
                    Gerenciar Senhas da Equipe
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Welcome overlay (loading) ── */}
      {phase === 'loading' && (
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 200,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#08090E',
          animation: 'fadeInLoad 0.3s ease both',
          gap: 0, px: 3,
        }}>
          {/* Logo */}
          <Box component="img" src="/logotipo.png" alt="DS" sx={{ width: 42, height: 'auto', opacity: 0.6, mb: 3 }} />

          {/* Avatar limpo do usuário */}
          {selectedInfo && (
            <Box sx={{
              mb: 2.5,
              animation: 'welcomeIn 0.5s 0.08s cubic-bezier(0.16,1,0.3,1) both',
            }}>
              <Box sx={{
                width: 96, height: 96, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: `${selectedInfo.color}12`,
                border: `2px solid ${selectedInfo.color}30`,
              }}>
                <Typography sx={{ fontSize: '2.8rem', lineHeight: 1 }}>
                  {selectedInfo.emoji}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Nome + cargo */}
          {selectedInfo && selectedUser && (
            <Box sx={{ textAlign: 'center', mb: 2.5, animation: 'welcomeIn 0.5s 0.2s cubic-bezier(0.16,1,0.3,1) both', opacity: 0 }}>
              <Typography sx={{ fontSize: { xs: '0.6rem', md: '0.65rem' }, fontWeight: 700, color: DS.t3, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.4 }}>
                {greeting}
              </Typography>
              <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.1rem' }, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05, color: selectedInfo.color, mb: 0.4 }}>
                {selectedUser.charAt(0).toUpperCase() + selectedUser.slice(1)}
              </Typography>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.7, px: 1.2, py: 0.4, borderRadius: 10, bgcolor: `${selectedInfo.color}10`, border: `1px solid ${selectedInfo.color}25` }}>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: selectedInfo.color, letterSpacing: '0.04em' }}>
                  {selectedInfo.role}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Versículo / frase do dia */}
          <Box sx={{
            maxWidth: 320, textAlign: 'center', mb: 3,
            animation: 'quoteIn 0.7s 0.45s ease both',
            opacity: 0,
          }}>
            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.22)', lineHeight: 1.6, fontStyle: 'italic', mb: 0.4 }}>
              "{dailyQuote.text}"
            </Typography>
            <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.15)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              — {dailyQuote.ref}
            </Typography>
          </Box>

          {/* Dots de carregamento */}
          <Box sx={{ display: 'flex', gap: 0.9, mb: 1.5, animation: 'quoteIn 0.5s 0.6s ease both', opacity: 0 }}>
            {[0,1,2].map(i => (
              <Box key={i} sx={{
                width: 7, height: 7, borderRadius: '50%',
                bgcolor: selectedInfo?.color ?? '#ff9039',
                animation: `dotBounce 1.1s ${i * 0.18}s ease-in-out infinite`,
              }} />
            ))}
          </Box>

          {/* Barra de progresso */}
          <Box sx={{ width: 180, height: 2, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden', animation: 'quoteIn 0.5s 0.7s ease both', opacity: 0 }}>
            <Box sx={{
              height: '100%', borderRadius: 1,
              background: selectedInfo
                ? `linear-gradient(90deg, ${selectedInfo.color}, ${selectedInfo.color}aa)`
                : 'linear-gradient(90deg, #ff9039, #ff5339)',
              animation: 'loadBar 2.6s ease-in-out forwards',
            }} />
          </Box>

          {/* Msg de loading */}
          <Box sx={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0.5 }}>
            <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', fontWeight: 500 }}>
              {LOADING_MSGS[loadingMsg]}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  )
}

// ── Seleção de membro ─────────────────────────────────────────
function UserSelectForm({ members, configuredUsers, onSelect }: {
  members: string[]
  configuredUsers: string[]
  onSelect: (username: string) => void
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography sx={{ fontSize: { xs: '1.1rem', md: '1.4rem' }, fontWeight: 900, color: 'rgba(255,255,255,0.38)', letterSpacing: '-0.03em', lineHeight: 1.1, mb: 0.3 }}>
          Quem está
        </Typography>
        <Typography sx={{ fontSize: { xs: '1.1rem', md: '1.4rem' }, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, background: 'linear-gradient(135deg, #ff9039, #ff5339)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          acessando?
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.8 }}>
        {members.map((username, idx) => {
          const info = NAME_MAP[username]
          if (!info) return null
          const hasLock = configuredUsers.includes(username)
          return (
            <Box
              key={username}
              onClick={() => onSelect(username)}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.6,
                p: { xs: 1.2, md: 1.5 }, borderRadius: 2.5, cursor: 'pointer',
                bgcolor: 'rgba(255,255,255,0.03)',
                border: `1.5px solid rgba(255,255,255,0.07)`,
                transition: 'all 0.18s',
                position: 'relative',
                animation: `memberIn 0.4s ${idx * 0.06}s cubic-bezier(0.16,1,0.3,1) both`,
                '&:hover': {
                  bgcolor: `${info.color}12`,
                  borderColor: `${info.color}50`,
                  transform: 'translateY(-2px)',
                  boxShadow: `0 6px 20px ${info.color}20`,
                },
                '&:active': { transform: 'scale(0.96)' },
              }}
            >
              {hasLock && (
                <Box sx={{ position: 'absolute', top: 4, right: 4, width: 12, height: 12, borderRadius: '50%', bgcolor: 'rgba(255,215,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ fontSize: '0.45rem', lineHeight: 1 }}>🔒</Typography>
                </Box>
              )}
              <Typography sx={{ fontSize: { xs: '1.6rem', md: '1.8rem' }, lineHeight: 1 }}>{info.emoji}</Typography>
              <Typography sx={{ fontSize: { xs: '0.58rem', md: '0.65rem' }, fontWeight: 800, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 1.2 }}>
                {username.charAt(0).toUpperCase() + username.slice(1)}
              </Typography>
              <Typography sx={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.2 }}>
                {info.role}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// ── Formulário de senha pessoal ───────────────────────────────
function UserPasswordForm({ username, userInfo, pwd, setPwd, error, loading, onConfirm, onBack, inputRef }: {
  username: string
  userInfo: typeof NAME_MAP[string] | null
  pwd: string; setPwd: (v: string) => void
  error: string; loading: boolean
  onConfirm: () => void
  onBack: () => void
  inputRef: React.RefObject<HTMLInputElement>
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {userInfo && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2, bgcolor: `${userInfo.color}0e`, border: `1.5px solid ${userInfo.color}35`, boxShadow: `0 4px 16px ${userInfo.glow}` }}>
          <Typography sx={{ fontSize: '2rem', lineHeight: 1 }}>{userInfo.emoji}</Typography>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.32)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Entrando como</Typography>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: userInfo.color, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              {username.charAt(0).toUpperCase() + username.slice(1)}
            </Typography>
            <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1 }}>{userInfo.role}</Typography>
          </Box>
          <Box
            onClick={onBack}
            sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', px: 1, py: 0.4, borderRadius: 1, '&:hover': { color: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.05)' } }}
          >
            ← Trocar
          </Box>
        </Box>
      )}

      <Box>
        <Typography sx={{ fontSize: { xs: '1.1rem', md: '1.4rem' }, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, background: 'linear-gradient(135deg, #ff9039, #ff5339)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Digite sua senha
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
        <TextField
          inputRef={inputRef} fullWidth type="password"
          placeholder="Senha pessoal..."
          value={pwd} onChange={e => setPwd(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onConfirm()}
          autoComplete="current-password"
          disabled={loading}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4, px: 2, py: 1.1, borderRadius: 2, background: 'rgba(255,69,69,0.08)', border: '1.5px solid rgba(255,69,69,0.28)', animation: 'badgeIn 0.22s ease both' }}>
            <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }}>🔒</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.58rem', color: '#FF4545', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Acesso negado</Typography>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.58)' }}>{error}</Typography>
            </Box>
          </Box>
        )}
        <Button
          variant="contained" onClick={onConfirm}
          disabled={!pwd.trim() || loading} fullWidth
          sx={{
            py: 1.5,
            background: pwd.trim() && !loading
              ? (userInfo?.color ? `linear-gradient(135deg, ${userInfo.color}, ${userInfo.color}cc)` : 'linear-gradient(135deg, #ff9039, #ff5339)')
              : 'rgba(255,255,255,0.04)',
            color: pwd.trim() && !loading ? '#000' : 'rgba(255,255,255,0.16)',
            fontWeight: 800, fontSize: '1rem', borderRadius: 2.5,
            boxShadow: pwd.trim() && !loading ? `0 6px 20px ${userInfo?.glow ?? 'rgba(255,144,57,0.32)'}` : 'none',
            transition: 'all 0.22s ease',
            '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
            '&.Mui-disabled': { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.16)' },
          }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: '#000' }} /> : 'Entrar →'}
        </Button>
      </Box>
      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.15)', textAlign: 'center' }}>
        Pressione Enter para confirmar
      </Typography>
    </Box>
  )
}
