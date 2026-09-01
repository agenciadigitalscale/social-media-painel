import { useEffect, useState, useRef } from 'react'
import { Box, Typography, TextField, Button, CircularProgress } from '@mui/material'
import { NAME_MAP } from '../lib/users'
import { clickable } from '../shared/a11y'
import SplashBackdrop, { CAPA } from './splash/SplashBackdrop'
import { DS } from '../theme'

// ── Ordenação dos membros na tela de login ─────────────────
const MEMBER_ORDER = ['pradox', 'testa', 'kaique', 'arthur', 'jhones', 'kerges', 'robson']

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
  }, [showLogin, onFinish])

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
      /**
       * Sem senha o login era puramente local — nenhuma requisição, nenhum
       * cookie. Essa pessoa ficava sem sessão e seria trancada fora no dia em
       * que o `/api/sync` passar a exigir uma. Agora pedimos a sessão mesmo
       * assim.
       *
       * Sem `await` de propósito: o login não pode depender da rede (o painel
       * entra offline), e a animação de entrada dá tempo de sobra para o
       * Set-Cookie chegar.
       */
      fetch('/api/role-auth', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', role: username, user: username }),
      }).catch(() => { /* offline: entra do mesmo jeito, só sem cookie */ })
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
        // `credentials` porque a resposta agora traz o cookie de sessão: a senha
        // certa passou a valer credencial de verdade, não só conferência local.
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', role: selectedUser, password: pwd, user: selectedUser }),
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
      alignItems: 'center', justifyContent: 'center',
      overflowY: isLogin ? 'auto' : 'hidden',
      // O fundo da capa vem do SplashBackdrop; aqui fica só a cor de base, que
      // é o que o mix-blend-mode: screen da logo precisa ter embaixo.
      background: CAPA.fundo,
      opacity: isExit ? 0 : 1,
      transition: isExit ? 'opacity 0.5s ease' : 'none',

      '@keyframes logoIn':      { '0%': { opacity: 0, transform: 'translateY(16px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      '@keyframes shake':       { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-5px)' }, '40%,80%': { transform: 'translateX(5px)' } },
      '@keyframes badgeIn':     { '0%': { opacity: 0, transform: 'translateY(7px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      '@keyframes cardSlideUp': { '0%': { opacity: 0, transform: 'translateY(20px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      '@keyframes fadeInLoad':  { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
      '@keyframes memberIn':    { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      '@keyframes welcomeIn':   { '0%': { opacity: 0, transform: 'translateY(12px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      '@keyframes quoteIn':     { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
      '@keyframes loadBar':     { '0%': { width: '0%' }, '70%': { width: '85%' }, '100%': { width: '100%' } },
      '@keyframes dotBounce':   { '0%,80%,100%': { transform: 'scale(0.55)', opacity: 0.35 }, '40%': { transform: 'scale(1)', opacity: 1 } },
    }}>

      <SplashBackdrop />

      {/* ── Logo ── */}
      <Box sx={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', pt: isLogin ? { xs: 3.5, sm: 4, md: 5 } : 0, pb: isLogin ? { xs: 1.5, md: 2 } : 3, opacity: phase === 'enter' ? 0 : 1, animation: phase === 'enter' ? 'logoIn 0.55s ease forwards' : 'none', transition: 'padding 0.5s ease' }}>

        <Box component="img" src="/logotipo.png" alt="Digital Scale" sx={{
          width: isLogin ? { xs: 90, sm: 110, md: 130 } : { xs: 160, sm: 200, md: 240, lg: 280, xl: 320 },
          height: 'auto', transition: 'width 0.5s ease', opacity: 1,
        }} />
      </Box>

      {/* ── Painel de login ── */}
      {isLogin && phase !== 'loading' && (
        <Box sx={{ position: 'relative', zIndex: 10, width: 'clamp(300px, 94vw, 620px)', mx: 'auto', px: { xs: 2, sm: 0 }, pb: { xs: 4, md: 5 }, animation: 'cardSlideUp 0.5s 0.08s cubic-bezier(0.16,1,0.3,1) both' }}>
          <Box sx={{
            borderRadius: { xs: 3, sm: 4 }, overflow: 'hidden',
            background: 'rgba(7,13,25,0.86)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255,114,0,0.22)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.55), 0 0 40px rgba(255,114,0,0.08)',
          }}>

            {/* Cabeçalho */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 2.5, md: 3.5 }, pt: { xs: 2, md: 2.5 }, pb: { xs: 1.5, md: 2 }, borderBottom: '1px solid rgba(255,114,0,0.12)' }}>
              <Box>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(244,247,255,0.55)', letterSpacing: '-0.01em' }}>{greeting}</Typography>
                <Typography sx={{ fontSize: '0.58rem', color: DS.t2, mt: 0.2, textTransform: 'capitalize' }}>{todayFull}</Typography>
              </Box>
              <Typography sx={{ fontSize: { xs: '1.4rem', md: '1.7rem' }, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em', color: DS.t2, lineHeight: 1 }}>
                {clockStr}
              </Typography>
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
            <Box sx={{ px: { xs: 2.5, md: 3.5 }, pb: { xs: 2, md: 2.5 }, borderTop: '1px solid rgba(255,114,0,0.12)', pt: 1.2 }}>
              {/* Acesso rápido — gerenciar senhas */}
              {onManagePasswords && step === 'select' && (
                <Box
                  onClick={onManagePasswords}
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8,
                    mt: 1.2, py: 0.9, borderRadius: 2, cursor: 'pointer',
                    border: '1px solid rgba(148,163,184,0.14)',
                    bgcolor: 'rgba(148,163,184,0.04)',
                    transition: 'all 0.2s ease',
                    '&:hover': { bgcolor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.35)' },
                  }}
                >
                  <Typography sx={{ fontSize: '0.78rem', lineHeight: 1 }}>🔐</Typography>
                  <Typography sx={{
                    fontSize: '0.6rem', fontWeight: 700,
                    color: 'rgba(148,163,184,0.6)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    '&:hover': { color: DS.accent },
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
          background: DS.bg,
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
            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(244,247,255,0.22)', lineHeight: 1.6, fontStyle: 'italic', mb: 0.4 }}>
              "{dailyQuote.text}"
            </Typography>
            <Typography sx={{ fontSize: '0.58rem', color: 'rgba(244,247,255,0.15)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              — {dailyQuote.ref}
            </Typography>
          </Box>

          {/* Dots de carregamento */}
          <Box sx={{ display: 'flex', gap: 0.9, mb: 1.5, animation: 'quoteIn 0.5s 0.6s ease both', opacity: 0 }}>
            {[0,1,2].map(i => (
              <Box key={i} sx={{
                width: 7, height: 7, borderRadius: '50%',
                bgcolor: selectedInfo?.color ?? DS.accent,
                animation: `dotBounce 1.1s ${i * 0.18}s ease-in-out infinite`,
              }} />
            ))}
          </Box>

          {/* Barra de progresso */}
          <Box sx={{ width: 180, height: 2, bgcolor: 'rgba(244,247,255,0.06)', borderRadius: 1, overflow: 'hidden', animation: 'quoteIn 0.5s 0.7s ease both', opacity: 0 }}>
            <Box sx={{
              height: '100%', borderRadius: 1,
              background: selectedInfo
                ? `linear-gradient(90deg, ${selectedInfo.color}, ${selectedInfo.color}aa)`
                : `linear-gradient(90deg, ${DS.accent}, ${DS.cyan})`,
              animation: 'loadBar 2.6s ease-in-out forwards',
            }} />
          </Box>

          {/* Msg de loading */}
          <Box sx={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0.5 }}>
            <Typography sx={{ fontSize: '0.68rem', color: 'rgba(244,247,255,0.3)', letterSpacing: '0.06em', fontWeight: 500 }}>
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
      <Typography sx={{ fontSize: { xs: '1rem', md: '1.15rem' }, fontWeight: 700, color: 'rgba(244,247,255,0.85)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
        Quem está acessando?
      </Typography>

      <Box sx={{
        display: 'grid', gap: { xs: 1, md: 0.9 },
        // Sete pessoas em quatro colunas no desktop; no celular quatro colunas
        // deixariam o nome do cargo ilegível, então caem para duas — e para uma
        // só nos aparelhos realmente estreitos.
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
        '@media (max-width: 359px)': { gridTemplateColumns: '1fr' },
      }}>
        {members.map((username, idx) => {
          const info = NAME_MAP[username]
          if (!info) return null
          const hasLock = configuredUsers.includes(username)
          return (
            <Box
              key={username}
              {...clickable(() => onSelect(username))}
              aria-label={`Entrar como ${username}`}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.6,
                p: { xs: 1.3, md: 1.4 }, borderRadius: 2, cursor: 'pointer',
                bgcolor: 'rgba(244,247,255,0.03)',
                border: '1px solid rgba(244,247,255,0.07)',
                transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1), border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
                position: 'relative', overflow: 'hidden',
                animation: `memberIn 0.35s ${idx * 0.05}s ease both`,
                opacity: 0,
                '&:hover': {
                  bgcolor: 'rgba(255,114,0,0.06)',
                  borderColor: 'rgba(255,114,0,0.45)',
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 28px rgba(0,0,0,0.45), 0 0 18px rgba(255,114,0,0.12)',
                },
                // O ponto de luz no canto só acende no hover/foco — aceso sempre,
                // sete pontinhos competiriam com o foguete do fundo.
                '&::after': {
                  content: '""', position: 'absolute', top: 7, left: 7,
                  width: 4, height: 4, borderRadius: '50%',
                  background: CAPA.laranja, boxShadow: `0 0 8px ${CAPA.laranja}`,
                  opacity: 0, transition: 'opacity 0.2s ease',
                },
                '&:hover::after, &:focus-visible::after': { opacity: 1 },
                '&:focus-visible': {
                  borderColor: 'rgba(255,114,0,0.55)',
                  transform: 'translateY(-4px)',
                },
                '&:active': { transform: 'translateY(-1px) scale(0.98)' },
              }}
            >
              {hasLock && (
                <Box sx={{ position: 'absolute', top: 4, right: 4, width: 12, height: 12, borderRadius: '50%', bgcolor: 'rgba(148,163,184,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ fontSize: '0.45rem', lineHeight: 1 }}>🔒</Typography>
                </Box>
              )}
              <Typography sx={{ fontSize: { xs: '1.6rem', md: '1.8rem' }, lineHeight: 1 }}>{info.emoji}</Typography>
              <Typography sx={{ fontSize: { xs: '0.58rem', md: '0.65rem' }, fontWeight: 800, color: 'rgba(244,247,255,0.8)', textAlign: 'center', lineHeight: 1.2 }}>
                {username.charAt(0).toUpperCase() + username.slice(1)}
              </Typography>
              <Typography sx={{ fontSize: '0.45rem', color: DS.t2, textAlign: 'center', lineHeight: 1.2 }}>
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'rgba(244,247,255,0.04)', border: '1px solid rgba(244,247,255,0.09)' }}>
          <Typography sx={{ fontSize: '2rem', lineHeight: 1 }}>{userInfo.emoji}</Typography>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.55rem', color: 'rgba(244,247,255,0.32)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Entrando como</Typography>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: 'rgba(244,247,255,0.88)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              {username.charAt(0).toUpperCase() + username.slice(1)}
            </Typography>
            <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.35)', lineHeight: 1 }}>{userInfo.role}</Typography>
          </Box>
          <Box
            onClick={onBack}
            sx={{ fontSize: '0.58rem', color: 'rgba(244,247,255,0.3)', cursor: 'pointer', px: 1, py: 0.4, borderRadius: 1, '&:hover': { color: 'rgba(244,247,255,0.6)', bgcolor: 'rgba(244,247,255,0.05)' } }}
          >
            ← Trocar
          </Box>
        </Box>
      )}

      <Box>
        <Typography sx={{ fontSize: { xs: '1rem', md: '1.15rem' }, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'rgba(244,247,255,0.85)' }}>
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
              color: '#fff', background: 'rgba(244,247,255,0.03)', borderRadius: 2.5,
              fontSize: { xs: '1rem', md: '1.1rem' }, fontWeight: 600,
              '& fieldset': { borderColor: error ? DS.red : 'rgba(59,130,246,0.2)', borderWidth: '1.5px' },
              '&:hover fieldset': { borderColor: 'rgba(59,130,246,0.42)' },
              '&.Mui-focused fieldset': { borderColor: DS.accent, borderWidth: '2px' },
            },
            '& input::placeholder': { color: 'rgba(244,247,255,0.18)', opacity: 1 },
            '& .MuiOutlinedInput-input': { py: 1.8, px: 2 },
          }}
        />
        {error && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4, px: 2, py: 1.1, borderRadius: 2, background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.28)', animation: 'badgeIn 0.22s ease both' }}>
            <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }}>🔒</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.58rem', color: DS.red, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Acesso negado</Typography>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(244,247,255,0.58)' }}>{error}</Typography>
            </Box>
          </Box>
        )}
        <Button
          variant="contained" onClick={onConfirm}
          disabled={!pwd.trim() || loading} fullWidth
          sx={{
            py: 1.4,
            background: pwd.trim() && !loading ? `linear-gradient(90deg, ${DS.accent}, ${DS.cyan})` : 'rgba(244,247,255,0.05)',
            color: pwd.trim() && !loading ? '#fff' : 'rgba(244,247,255,0.18)',
            fontWeight: 700, fontSize: '0.92rem', borderRadius: 2,
            boxShadow: 'none',
            transition: 'all 0.15s ease',
            '&:hover': { background: pwd.trim() && !loading ? `linear-gradient(90deg, ${DS.accentStrong}, #0891B2)` : 'rgba(244,247,255,0.05)' },
            '&.Mui-disabled': { background: 'rgba(244,247,255,0.04)', color: 'rgba(244,247,255,0.16)' },
          }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Entrar →'}
        </Button>
      </Box>
      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.15)', textAlign: 'center' }}>
        Pressione Enter para confirmar
      </Typography>
    </Box>
  )
}
