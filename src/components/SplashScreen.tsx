import { useEffect, useState, useRef } from 'react'
import { Box, Typography, TextField, Button, CircularProgress, MenuItem } from '@mui/material'
import { NAME_MAP } from '../lib/users'
import SplashBackdrop from './splash/SplashBackdrop'
import { sessaoExistente } from './splash/googleAuth'
import { CAPA } from './splash/palette'
import { DS, ctaGradient } from '../theme'

// ── Ordenação dos membros na tela de login ─────────────────
const MEMBER_ORDER = ['pradox', 'testa', 'kaique', 'arthur', 'jhones', 'julio', 'kerges', 'robson']

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
}

type Phase = 'enter' | 'hold' | 'login' | 'loading' | 'exit'

/** Campos do login no padrão do painel-facebook: fundo escuro, raio 12, foco laranja. */
const LOGIN_FIELD_SX = {
  '& .MuiInputBase-root': { bgcolor: '#0B0D11', borderRadius: '12px', color: CAPA.t1, fontSize: '0.95rem' },
  '& .MuiInputBase-input': { py: '14px', px: '14px' },
  '& .MuiSelect-select': { py: '14px !important', px: '14px' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: CAPA.borda, borderRadius: '12px' },
  '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,122,0,0.45)' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,122,0,0.85) !important', borderWidth: '1px !important' },
  '& .Mui-focused': { boxShadow: '0 0 0 3px rgba(255,122,0,0.11)' },
  '& .MuiSelect-icon': { color: CAPA.t3 },
} as const

const LOADING_MSGS = [
  'Sincronizando tarefas...',
  'Carregando aprovações...',
  'Atualizando operação...',
  'Carregando clientes...',
  'Tudo pronto!',
]

export default function SplashScreen({ showLogin, onFinish, onLogin, currentUser }: Props) {
  const [phase, setPhase]           = useState<Phase>('enter')
  const [loadingMsg, setLoadingMsg] = useState(0)

  // ── Login state ────────────────────────────────────────────
  // Tela no padrão do painel-facebook (2026-09-28): escolhe o nome, digita a
  // senha, Entrar. As senhas são as mesmas de antes (role_passwords, por usuário).
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [configuredUsers, setConfiguredUsers] = useState<string[]>([])
  const [conexao, setConexao] = useState<'checando' | 'online' | 'offline'>('checando')
  /* A checagem de senhas em voo. Enquanto ela não volta, `configuredUsers` é
     uma lista VAZIA — e ler isso como "este cargo não tem senha" deixava quem
     clicasse rápido entrar SEM digitar nada. Guardar a promessa permite
     esperar o resultado no clique, em vez de decidir com a lista vazia. */
  const checagemRef = useRef<Promise<string[] | null> | null>(null)
  const [pwd, setPwd]               = useState('')
  const [loginError, setLoginError] = useState('')
  const [entrando, setEntrando]     = useState(false)
  const pwdRef = useRef<HTMLInputElement>(null)

  const dailyQuote = getDailyQuote()

  // Carrega quais usuários têm senha configurada no D1. É o único sinal real de
  // servidor que esta tela tem antes do login — alimenta a linha de status.
  useEffect(() => {
    checagemRef.current = fetch('/api/role-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check' }),
    })
      .then(r => r.json())
      .then((d: { configured?: string[] }) => {
        const lista = d.configured ?? []
        setConfiguredUsers(lista)
        setConexao('online')
        return lista
      })
      // `null` é "não sei", diferente de lista vazia.
      .catch(() => { setConexao('offline'); return null })
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

  /** Quem já tem sessão viva neste navegador entra sem clicar em nada. */
  useEffect(() => {
    if (!showLogin) return
    let vivo = true
    sessaoExistente().then(r => {
      if (vivo && r.ok && r.membro) doLogin(r.membro)
    })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLogin])

  function doLogin(username: string) {
    onLogin(username)
    setPhase('loading')
    setTimeout(() => { setPhase('exit'); setTimeout(() => onFinish(), 500) }, 2600)
  }

  const roleAuth = (body: Record<string, unknown>) => fetch('/api/role-auth', {
    method: 'POST',
    // `credentials` porque a resposta traz o cookie de sessão.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  /**
   * O único caminho de entrada. Mantém as três regras da tela anterior:
   * 1. espera a checagem de senhas antes de decidir "sem senha";
   * 2. perfil SEM senha: entra (e, se digitou uma, ela vira a senha do perfil —
   *    self-claim; o servidor só deixa enquanto o perfil não tem senha);
   * 3. sem rede, entra offline — o painel funciona assim, e o servidor continua
   *    negando dado a quem não tem sessão.
   */
  async function handleEntrar() {
    if (entrando) return
    if (!selectedUser) { setLoginError('Escolha seu nome.'); return }
    const user = selectedUser
    const senha = pwd.trim()
    setLoginError('')
    setEntrando(true)
    try {
      const lista = conexao === 'online' ? configuredUsers
        : conexao === 'offline' ? null
        : (await checagemRef.current) ?? null
      if (lista === null) { doLogin(user); return }

      if (!lista.includes(user)) {
        if (senha) {
          const res = await roleAuth({ action: 'set', role: user, password: senha })
          const data = await res.json() as { ok: boolean; error?: string }
          if (!data.ok) { setLoginError(data.error || 'Não foi possível criar a senha.'); return }
        }
        await roleAuth({ action: 'verify', role: user, user, ...(senha ? { password: senha } : {}) })
          .catch(() => { /* offline: entra do mesmo jeito, só sem cookie */ })
        doLogin(user)
        return
      }

      if (!senha) { setLoginError('Digite sua senha.'); pwdRef.current?.focus(); return }
      const res = await roleAuth({ action: 'verify', role: user, password: senha, user })
      const data = await res.json() as { ok: boolean }
      if (data.ok) doLogin(user)
      else { setLoginError('Senha incorreta.'); setPwd(''); pwdRef.current?.focus() }
    } catch {
      doLogin(user)
    } finally {
      setEntrando(false)
    }
  }

  const primeiroAcesso = !!selectedUser && conexao === 'online' && !configuredUsers.includes(selectedUser)

  const isLogin = phase === 'login' || phase === 'loading'
  const isExit  = phase === 'exit'
  const selectedInfo = selectedUser ? NAME_MAP[selectedUser] : null

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      // 'safe center' e não 'center': com o painel mais alto que a tela (celular
      // com o teclado aberto, ou tela baixa), o 'center' puro empurra metade do
      // transbordo para CIMA do início da rolagem — e o cabeçalho com relógio e
      // saudação fica INALCANÇÁVEL, porque não se rola para antes do começo.
      // Medido: relógio em top:-10px com scrollTop já em 0. O 'safe' centraliza
      // quando cabe e alinha ao topo quando não cabe.
      justifyContent: 'center',
      '@supports (justify-content: safe center)': { justifyContent: 'safe center' },
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

        {/* Na fase de abertura a logo é a tela inteira. Durante o login ela sai
            daqui: a marca passa a viver DENTRO do cabeçalho do painel, e manter
            as duas seria repetir o logotipo na mesma tela. */}
        {!isLogin && (
          <Box component="img" src="/logotipo.png" alt="Digital Scale" sx={{
            width: { xs: 160, sm: 200, md: 240, lg: 280, xl: 320 },
            height: 'auto', transition: 'width 0.5s ease',
          }} />
        )}
      </Box>

      {/* ── Login ── mesmo padrão do painel-facebook: marca, título, nome,
          senha, Entrar. */}
      {isLogin && phase !== 'loading' && (
        <Box sx={{ position: 'relative', zIndex: 10, width: 'clamp(300px, 92vw, 470px)', mx: 'auto', px: { xs: 2, sm: 0 }, pb: { xs: 4, md: 5 }, animation: 'cardSlideUp 0.5s 0.08s cubic-bezier(0.16,1,0.3,1) both' }}>
          <Box
            component="form"
            noValidate
            onSubmit={(e: React.FormEvent) => { e.preventDefault(); handleEntrar() }}
            sx={{
              position: 'relative', overflow: 'hidden',
              borderRadius: '24px', p: { xs: 3, sm: '30px' },
              background: 'linear-gradient(180deg, rgba(24,27,34,0.985), rgba(12,14,18,0.99))',
              border: `1px solid ${CAPA.borda}`,
              boxShadow: '0 24px 70px rgba(0,0,0,0.38)',
              '&::before': {
                content: '""', position: 'absolute', left: 0, top: 0, width: '100%', height: 3,
                background: `linear-gradient(90deg, ${DS.cyan}, ${DS.accent}, transparent 78%)`,
              },
            }}
          >
            <Box component="img" src="/logotipo.png" alt="Digital Scale" sx={{ width: 200, maxWidth: '70%', height: 'auto', display: 'block', mb: 4 }} />

            <Typography sx={{ fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.18em', color: DS.accent, mb: 1 }}>
              DIGITAL SCALE • SOCIAL MEDIA
            </Typography>
            <Typography component="h1" sx={{ fontSize: { xs: '1.8rem', sm: '2.1rem' }, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.02, color: CAPA.t1 }}>
              Seu centro de produção.
            </Typography>
            <Typography sx={{ fontSize: '0.92rem', color: CAPA.t2, lineHeight: 1.55, mt: 1.2 }}>
              Acesse a produção, os clientes e as entregas da equipe em um só lugar.
            </Typography>

            <Box sx={{ display: 'grid', gap: 2, mt: 3.5 }}>
              <Box>
                <Typography component="label" htmlFor="login-nome" sx={{ display: 'block', fontSize: '0.75rem', color: CAPA.t2, mb: 0.8 }}>Nome</Typography>
                <TextField
                  id="login-nome"
                  select fullWidth
                  value={selectedUser ?? ''}
                  onChange={e => { setSelectedUser(e.target.value || null); setLoginError(''); setTimeout(() => pwdRef.current?.focus(), 80) }}
                  SelectProps={{
                    displayEmpty: true,
                    renderValue: v => v
                      ? (NAME_MAP[v as string]?.fullName ?? String(v))
                      : <Box component="span" sx={{ color: CAPA.t3 }}>Selecione seu nome</Box>,
                    MenuProps: { PaperProps: { sx: { bgcolor: DS.surface, border: `1px solid ${DS.border}`, mt: 0.5 } } },
                  }}
                  sx={LOGIN_FIELD_SX}
                >
                  {MEMBER_ORDER.map(u => NAME_MAP[u] && (
                    <MenuItem key={u} value={u} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, fontSize: '0.9rem' }}>
                      <span>{NAME_MAP[u].fullName}</span>
                      <Box component="span" sx={{ fontSize: '0.72rem', color: DS.t3 }}>{NAME_MAP[u].role}</Box>
                    </MenuItem>
                  ))}
                </TextField>
              </Box>

              <Box>
                <Typography component="label" htmlFor="login-senha" sx={{ display: 'block', fontSize: '0.75rem', color: CAPA.t2, mb: 0.8 }}>Senha</Typography>
                <TextField
                  id="login-senha"
                  type="password" fullWidth
                  autoComplete="current-password"
                  inputRef={pwdRef}
                  value={pwd}
                  onChange={e => { setPwd(e.target.value); setLoginError('') }}
                  placeholder={primeiroAcesso ? 'Crie sua senha' : ''}
                  sx={LOGIN_FIELD_SX}
                />
                {primeiroAcesso && (
                  <Typography sx={{ fontSize: '0.7rem', color: CAPA.t3, mt: 0.8 }}>
                    Primeiro acesso: a senha que você digitar passa a ser a sua.
                  </Typography>
                )}
              </Box>

              {loginError && (
                <Box role="alert" sx={{
                  px: 2, py: 1.4, borderRadius: '12px', fontSize: '0.82rem',
                  border: '1px solid rgba(255,95,109,0.4)', bgcolor: 'rgba(255,95,109,0.08)', color: '#FFD7DB',
                  animation: 'shake 0.35s ease',
                }}>
                  {loginError}
                </Box>
              )}

              <Button
                type="submit" fullWidth disabled={entrando}
                sx={{
                  py: 1.6, borderRadius: '12px', fontWeight: 900, fontSize: '0.95rem', textTransform: 'none',
                  background: ctaGradient(100), color: DS.onAccent,
                  boxShadow: '0 10px 30px rgba(255,122,0,0.18)',
                  '&:hover': { background: ctaGradient(100), filter: 'brightness(1.06)' },
                  '&.Mui-disabled': { background: ctaGradient(100), color: DS.onAccent, opacity: 0.65 },
                }}
              >
                {entrando ? <CircularProgress size={20} sx={{ color: DS.onAccent }} /> : 'Entrar'}
              </Button>
            </Box>
          </Box>

          {/* Estado REAL do servidor, discreto, abaixo do cartão. */}
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8 }}>
            <Box sx={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              bgcolor: conexao === 'online' ? CAPA.verde : conexao === 'offline' ? CAPA.amarelo : CAPA.t3,
            }} />
            <Typography sx={{ fontSize: '0.66rem', color: CAPA.t3 }}>
              {conexao === 'online' ? 'Sistema online' : conexao === 'offline' ? 'Modo offline · entrada liberada' : 'Conectando…'}
              {' · '}Ambiente protegido
            </Typography>
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

          {/* Nome + cargo */}
          {selectedInfo && selectedUser && (
            <Box sx={{ textAlign: 'center', mb: 2.5, animation: 'welcomeIn 0.5s 0.2s cubic-bezier(0.16,1,0.3,1) both', opacity: 0 }}>
              <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.1rem' }, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05, color: selectedInfo.color, mb: 0.4 }}>
                {selectedInfo.fullName}
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
