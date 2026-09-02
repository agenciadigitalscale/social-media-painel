import { useEffect, useState, useRef } from 'react'
import { Box, Typography, TextField, Button, CircularProgress } from '@mui/material'
import { NAME_MAP } from '../lib/users'
import { clickable } from '../shared/a11y'
import SplashBackdrop from './splash/SplashBackdrop'
import {
  esquecerConta, googleDisponivel, montarBotaoGoogle, sessaoExistente,
} from './splash/googleAuth'
import { CAPA } from './splash/palette'
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
  const [step, setStep]               = useState<'select' | 'metodo' | 'password'>('select')
  const [erroGoogle, setErroGoogle]   = useState('')
  /** Conta Google que entrou, mas é de outro membro (ou de ninguém). */
  const [divergencia, setDivergencia] = useState<{ email: string; membro: string | null } | null>(null)
  const googleBoxRef = useRef<HTMLDivElement>(null)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [configuredUsers, setConfiguredUsers] = useState<string[]>([])
  const [conexao, setConexao] = useState<'checando' | 'online' | 'offline'>('checando')
  /* A checagem de senhas em voo. Enquanto ela não volta, `configuredUsers` é
     uma lista VAZIA — e ler isso como "este cargo não tem senha" deixava quem
     clicasse rápido entrar SEM digitar nada. Guardar a promessa permite
     esperar o resultado no clique, em vez de decidir com a lista vazia. */
  const checagemRef = useRef<Promise<string[] | null> | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [pwd, setPwd]                 = useState('')
  const [pwdError, setPwdError]       = useState('')
  const [pwdLoading, setPwdLoading]   = useState(false)
  const pwdRef = useRef<HTMLInputElement>(null)

  const dailyQuote = getDailyQuote()

  // Carrega quais usuários têm senha configurada no D1. O resultado desta
  // chamada é o ÚNICO sinal real de servidor que esta tela tem antes do login —
  // é ele que alimenta o bloco de status, em vez de um texto fixo dizendo
  // "sincronizado" para quem está sem rede.
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
      // `null` é "não sei", diferente de lista vazia: sem rede o fallback sem
      // senha continua valendo, mas não porque descobrimos que não há senha.
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

  /**
   * Quem já tem sessão viva neste navegador entra sem clicar em nada.
   *
   * Era o que o `LoginGate` fazia antes de ser removido. Sem isto, a equipe
   * teria que escolher o perfil a cada aba nova — o portão do Google saiu,
   * mas a conveniência dele não pode sair junto.
   */
  useEffect(() => {
    if (!showLogin) return
    let vivo = true
    sessaoExistente().then(r => {
      if (vivo && r.ok && r.membro) doLogin(r.membro)
    })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLogin])

  /**
   * Desenha o botão do Google quando a tela chega no passo do método.
   *
   * O botão é renderizado pelo próprio Google dentro do contêiner — por isso
   * ele precisa existir no DOM antes, e por isso este efeito depende do passo.
   */
  useEffect(() => {
    if (step !== 'metodo' || !googleBoxRef.current || !googleDisponivel()) return
    const limpar = montarBotaoGoogle(googleBoxRef.current, r => {
      if (!r.ok) { setErroGoogle(r.erro ?? 'Acesso negado.'); return }
      setErroGoogle('')
      // A conta bate com o perfil escolhido: entra direto.
      if (r.membro && r.membro === selectedUser) { doLogin(r.membro); return }
      // Não bate. NÃO entramos sozinhos como outra pessoa — quem decide é ela.
      setDivergencia({ email: r.email ?? '', membro: r.membro ?? null })
    })
    return limpar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedUser])

  function doLogin(username: string) {
    onLogin(username)
    setPhase('loading')
    setTimeout(() => { setPhase('exit'); setTimeout(() => onFinish(), 500) }, 2600)
  }

  /**
   * Clicar no perfil não entra mais: abre a escolha do método.
   *
   * Antes existiam DOIS portões em fila — o `LoginGate` do Google na frente e
   * esta tela atrás. Quem entrava pelo Google via duas telas de login para o
   * mesmo acesso. O portão foi removido e a escolha passou para cá.
   */
  function handleSelectMember(username: string) {
    setSelectedUser(username)
    setErroGoogle('')
    setDivergencia(null)
    setStep('metodo')
  }

  /** Entrar sem senha — só para cargo que não tem uma configurada. */
  async function entrarDireto(username: string) {
    let lista = configuredUsers
    if (conexao === 'checando') {
      setVerificando(true)
      const r = await checagemRef.current
      setVerificando(false)
      if (r) lista = r
    }
    const hasPassword = lista.includes(username)
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

  const painelRef = useRef<HTMLDivElement>(null)
  const brilhoAtivo = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    brilhoAtivo.current =
      window.matchMedia('(pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])
  const moverBrilho = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!brilhoAtivo.current) return
    const el = painelRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
    el.style.setProperty('--brilho', '1')
  }
  const sairBrilho = () => {
    painelRef.current?.style.setProperty('--brilho', '0')
  }

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

      {/* ── Painel de login ── */}
      {isLogin && phase !== 'loading' && (
        <Box sx={{ position: 'relative', zIndex: 10, width: 'clamp(300px, 94vw, 620px)', mx: 'auto', px: { xs: 2, sm: 0 }, pb: { xs: 4, md: 5 }, animation: 'cardSlideUp 0.5s 0.08s cubic-bezier(0.16,1,0.3,1) both' }}>
          <Box
            ref={painelRef}
            onMouseMove={moverBrilho}
            onMouseLeave={sairBrilho}
            sx={{
            position: 'relative',
            borderRadius: { xs: 3, sm: 4 }, overflow: 'hidden',
            '--mx': '50%', '--my': '0%', '--brilho': '0',
            // Azul-marinho translúcido, não preto: é o que cria a camada entre
            // o fundo petróleo e os cards.
            background: 'linear-gradient(168deg, rgba(22,35,51,0.92) 0%, rgba(17,28,42,0.94) 55%, rgba(13,22,34,0.95) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            // A borda inteira laranja transformava o painel num quadro. Agora ela
            // é azul-acinzentada e o laranja aparece SÓ na quina superior esquerda.
            border: `1px solid ${CAPA.borda}`,
            boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 2px 0 rgba(244,247,251,0.04) inset',
            '&::before': {
              content: '""', position: 'absolute', top: 0, left: 0,
              width: '46%', height: 2, pointerEvents: 'none',
              background: `linear-gradient(90deg, ${CAPA.laranja}, transparent)`,
              opacity: 0.65,
            },
            '&::after': {
              content: '""', position: 'absolute', inset: 0, pointerEvents: 'none',
              background: `
                radial-gradient(circle at 0% 0%, rgba(255,122,0,0.13), transparent 34%),
                radial-gradient(circle 260px at var(--mx) var(--my), rgba(244,247,251,0.05), transparent 70%)
              `,
              opacity: 'calc(0.55 + 0.45 * var(--brilho))',
              transition: 'opacity 0.25s ease',
            },
          }}>

            {/* Cabeçalho */}
            <Box sx={{ position: 'relative', px: { xs: 2.2, md: 3.2 }, pt: { xs: 2, md: 2.4 }, pb: { xs: 1.6, md: 1.9 }, borderBottom: `1px solid ${CAPA.borda}` }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
                  {/* A marca dentro do cabeçalho, não solta num canto. */}
                  <Box component="img" src="/logotipo.png" alt="Digital Scale" sx={{
                    width: { xs: 34, md: 40 }, height: 'auto', flexShrink: 0,
                    filter: 'drop-shadow(0 2px 8px rgba(255,122,0,0.28))',
                  }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: { xs: '0.86rem', md: '0.95rem' }, fontWeight: 800, color: CAPA.t1, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                      {greeting}
                    </Typography>
                    <Typography sx={{ fontSize: { xs: '0.6rem', md: '0.66rem' }, color: CAPA.t2, mt: 0.25, textTransform: 'capitalize' }}>
                      {todayFull}
                    </Typography>
                  </Box>
                </Box>
                <Typography sx={{
                  fontSize: { xs: '1.7rem', md: '2.1rem' }, fontWeight: 800, lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.045em', color: CAPA.t1,
                  ml: { xs: 'auto', sm: 0 }, flexShrink: 0,
                }}>
                  {clockStr}
                </Typography>
              </Box>

              {/* Selos: ícone + texto, nunca só cor. */}
              <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap', mt: 1.3 }}>
                <StatusSelo
                  icone={conexao === 'offline' ? '⚠' : '●'}
                  cor={conexao === 'offline' ? CAPA.amarelo : conexao === 'online' ? CAPA.verde : CAPA.t3}
                  texto={conexao === 'offline' ? 'Modo offline' : conexao === 'online' ? 'Sistema online' : 'Conectando…'}
                  pulsa={conexao === 'online'}
                />
                <StatusSelo icone="👥" cor={CAPA.t2} texto={`${MEMBER_ORDER.length} perfis ativos`} />
                <StatusSelo icone="🛡" cor={CAPA.t2} texto="Ambiente protegido" />
              </Box>
            </Box>

            {/* Formulário */}
            <Box sx={{ px: { xs: 2.5, md: 3.5 }, py: { xs: 2.5, md: 3 } }}>
              {step === 'select' ? (
                <UserSelectForm members={MEMBER_ORDER} configuredUsers={configuredUsers} onSelect={handleSelectMember} />
              ) : step === 'metodo' ? (
                <MetodoForm
                  username={selectedUser!}
                  userInfo={selectedInfo}
                  temSenha={configuredUsers.includes(selectedUser ?? '')}
                  senhaConhecida={conexao === 'online'}
                  verificando={verificando}
                  googleRef={googleBoxRef}
                  googleOn={googleDisponivel()}
                  erroGoogle={erroGoogle}
                  divergencia={divergencia}
                  onSenhaOuDireto={() => entrarDireto(selectedUser!)}
                  onEntrarComoDivergente={() => divergencia?.membro && doLogin(divergencia.membro)}
                  onTrocarConta={() => { esquecerConta(); setDivergencia(null); setErroGoogle(''); window.location.reload() }}
                  onBack={() => { setStep('select'); setSelectedUser(null); setErroGoogle(''); setDivergencia(null) }}
                />
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

            {/* Rodapé — dois blocos: a ação e o estado do ambiente. */}
            {step === 'select' && (
              <Box sx={{
                px: { xs: 2.2, md: 3.2 }, pb: { xs: 2.2, md: 2.6 }, pt: 1.8,
                borderTop: `1px solid ${CAPA.borda}`,
                display: 'grid', gap: 1.2,
                gridTemplateColumns: { xs: '1fr', sm: '1.35fr 1fr' },
              }}>
                {onManagePasswords && (
                  <Box sx={{
                    p: 1.5, borderRadius: '14px',
                    bgcolor: CAPA.superficie, border: `1px solid ${CAPA.borda}`,
                    display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap',
                  }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: CAPA.t1, lineHeight: 1.25 }}>
                        Gerenciamento de acessos
                      </Typography>
                      <Typography sx={{ fontSize: '0.62rem', color: CAPA.t2, mt: 0.25, lineHeight: 1.4 }}>
                        Senhas e permissões da equipe.
                      </Typography>
                    </Box>
                    <Box
                      {...clickable(onManagePasswords)}
                      aria-label="Gerenciar senhas da equipe"
                      sx={{
                        flexShrink: 0, px: 1.6, py: 0.9, borderRadius: '11px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 0.6,
                        background: `linear-gradient(135deg, ${CAPA.laranja}, #FF5E00)`,
                        boxShadow: '0 6px 18px rgba(255,122,0,0.26)',
                        transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s ease',
                        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 26px rgba(255,122,0,0.36)' },
                        '&:focus-visible': { transform: 'translateY(-2px)' },
                        '&:active': { transform: 'translateY(0)' },
                      }}
                    >
                      <Typography sx={{ fontSize: '0.78rem', lineHeight: 1 }}>🔐</Typography>
                      {/* MEDIDO: branco sobre #FF7A00 dá 2,61:1 e reprova em AA —
                          este texto tem ~11px, não é 'texto grande'. O azul
                          petróleo da própria paleta dá 6,9:1 e não fica com cara
                          de faixa de aviso como o preto puro. Não trocar por
                          branco 'porque fica mais bonito': fica ilegível no sol. */}
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: CAPA.fundo, whiteSpace: 'nowrap' }}>
                        Gerenciar senhas
                      </Typography>
                    </Box>
                  </Box>
                )}

                <Box sx={{
                  p: 1.5, borderRadius: '14px',
                  bgcolor: CAPA.superficie, border: `1px solid ${CAPA.borda}`,
                  display: 'flex', alignItems: 'center', gap: 1,
                }}>
                  <Box sx={{
                    width: 30, height: 30, borderRadius: '9px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.85rem', lineHeight: 1, fontWeight: 800,
                    color: conexao === 'online' ? CAPA.verde : CAPA.t2,
                    bgcolor: conexao === 'online' ? 'rgba(46,204,113,0.12)' : 'rgba(169,182,201,0.10)',
                    border: `1px solid ${conexao === 'online' ? 'rgba(46,204,113,0.34)' : CAPA.borda}`,
                  }}>
                    {conexao === 'online' ? '✓' : conexao === 'offline' ? '!' : '…'}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: CAPA.t1, lineHeight: 1.25 }}>
                      {conexao === 'online' ? 'Sistema estável' : conexao === 'offline' ? 'Sem conexão' : 'Verificando…'}
                    </Typography>
                    {/* O texto aqui é o resultado REAL da consulta ao servidor.
                        Antes do login não existe sincronização nenhuma, então
                        escrever "sincronizado" seria inventar estado. */}
                    <Typography sx={{ fontSize: '0.62rem', color: CAPA.t2, mt: 0.25, lineHeight: 1.4 }}>
                      {conexao === 'online'
                        ? 'Servidor respondeu · credenciais conferidas'
                        : conexao === 'offline'
                          ? 'Entrada liberada offline'
                          : 'Consultando o servidor'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
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
      <Box>
        <Typography sx={{ fontSize: { xs: '1.05rem', md: '1.2rem' }, fontWeight: 800, color: CAPA.t1, letterSpacing: '-0.025em', lineHeight: 1.2 }}>
          Quem está acessando?
        </Typography>
        <Typography sx={{ fontSize: { xs: '0.64rem', md: '0.7rem' }, color: CAPA.t2, mt: 0.35 }}>
          Escolha seu perfil para entrar no ambiente da equipe.
        </Typography>
      </Box>

      <Box sx={{
        display: 'grid', gap: { xs: 1, md: 0.9 },
        // Sete pessoas em quatro colunas no desktop; no celular quatro colunas
        // deixariam o nome do cargo ilegível, então caem para duas — e para uma
        // só nos aparelhos realmente estreitos.
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
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
              aria-label={`Entrar como ${username}, ${info.role}${hasLock ? ', protegido por senha' : ''}`}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.7,
                px: 1, py: { xs: 1.6, md: 1.8 }, borderRadius: '14px', cursor: 'pointer',
                minHeight: { xs: 110, md: 120 }, justifyContent: 'center',
                bgcolor: CAPA.superficie,
                border: `1px solid ${CAPA.borda}`,
                transition: 'transform 0.22s cubic-bezier(0.16,1,0.3,1), border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
                position: 'relative', overflow: 'hidden',
                animation: `memberIn 0.35s ${idx * 0.05}s ease both`,
                opacity: 0,
                '&:hover': {
                  bgcolor: CAPA.superficieAlt,
                  borderColor: CAPA.laranjaBorda,
                  transform: 'translateY(-5px)',
                  boxShadow: '0 14px 30px rgba(0,0,0,0.42), 0 0 16px rgba(255,122,0,0.10)',
                },
                '&:focus-visible': {
                  borderColor: CAPA.laranja,
                  transform: 'translateY(-5px)',
                  boxShadow: '0 14px 30px rgba(0,0,0,0.42), 0 0 0 3px rgba(255,122,0,0.22)',
                },
                // Estado de toque: no celular não existe hover, e sem isto o
                // card não dá retorno nenhum entre o dedo e a tela seguinte.
                '&:active': {
                  transform: 'translateY(-1px) scale(0.985)',
                  bgcolor: CAPA.superficieAlt,
                  borderColor: CAPA.laranja,
                },
              }}
            >
              {/* Verde = perfil ATIVO na equipe, não presença. O painel não sabe
                  quem está online, e um ponto verde dizendo "online" para os
                  sete seria inventar informação que ninguém pode conferir. */}
              <Box
                title="Perfil ativo"
                sx={{
                  position: 'absolute', top: 9, left: 9,
                  width: 5, height: 5, borderRadius: '50%',
                  bgcolor: CAPA.verde, boxShadow: `0 0 7px ${CAPA.verde}99`,
                }}
              />
              {hasLock && (
                <Box
                  title="Protegido por senha"
                  sx={{
                    position: 'absolute', top: 6, right: 6,
                    width: 16, height: 16, borderRadius: '5px',
                    bgcolor: 'rgba(169,182,201,0.12)', border: `1px solid ${CAPA.borda}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Typography sx={{ fontSize: '0.5rem', lineHeight: 1 }}>🔒</Typography>
                </Box>
              )}
              <Box sx={{
                width: { xs: 40, md: 44 }, height: { xs: 40, md: 44 }, borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: { xs: '1.35rem', md: '1.5rem' }, lineHeight: 1,
                bgcolor: 'rgba(7,21,34,0.72)',
                border: `1px solid ${CAPA.borda}`,
              }}>
                {info.emoji}
              </Box>
              <Typography sx={{ fontSize: { xs: '0.72rem', md: '0.78rem' }, fontWeight: 800, color: CAPA.t1, textAlign: 'center', lineHeight: 1.15 }}>
                {username.charAt(0).toUpperCase() + username.slice(1)}
              </Typography>
              <Typography sx={{ fontSize: { xs: '0.56rem', md: '0.6rem' }, color: CAPA.t2, textAlign: 'center', lineHeight: 1.25, px: 0.3 }}>
                {info.role}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

/**
 * Escolha do método de entrada — o passo que substituiu o `LoginGate`.
 *
 * A pessoa já disse QUEM é ao clicar no card; aqui ela diz COMO quer provar.
 */
function MetodoForm({
  username, userInfo, temSenha, senhaConhecida, verificando, googleRef, googleOn,
  erroGoogle, divergencia,
  onSenhaOuDireto, onEntrarComoDivergente, onTrocarConta, onBack,
}: {
  username: string
  userInfo: { emoji: string; role: string; color: string } | null
  temSenha: boolean
  /**
   * O servidor RESPONDEU com a lista de cargos que têm senha?
   *
   * Só `online` conta. Offline a lista nunca chegou, e a entrada sem senha que
   * acontece ali é o fallback de rede — não a descoberta de que o cargo não tem
   * senha. Dizer a frase nesse caso é chute com cara de fato.
   */
  senhaConhecida: boolean
  verificando: boolean
  googleRef: React.RefObject<HTMLDivElement | null>
  googleOn: boolean
  erroGoogle: string
  divergencia: { email: string; membro: string | null } | null
  onSenhaOuDireto: () => void
  onEntrarComoDivergente: () => void
  onTrocarConta: () => void
  onBack: () => void
}) {
  const nome = username.charAt(0).toUpperCase() + username.slice(1)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, animation: 'fadeInUp 0.28s cubic-bezier(0.16,1,0.3,1) both' }}>
      {/* Quem foi escolhido — some a dúvida de "cliquei no card certo?" */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: '12px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem',
          bgcolor: 'rgba(7,21,34,0.72)', border: `1px solid ${CAPA.borda}`,
        }}>
          {userInfo?.emoji ?? '👤'}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: CAPA.t1, lineHeight: 1.15 }}>{nome}</Typography>
          <Typography sx={{ fontSize: '0.64rem', color: CAPA.t2 }}>{userInfo?.role ?? ''}</Typography>
        </Box>
        <Box
          {...clickable(onBack)}
          aria-label="Voltar e escolher outro perfil"
          sx={{
            px: 1.1, py: 0.5, borderRadius: '9px', cursor: 'pointer', flexShrink: 0,
            border: `1px solid ${CAPA.borda}`, transition: 'all 0.2s ease',
            '&:hover': { borderColor: CAPA.laranjaBorda, bgcolor: 'rgba(255,122,0,0.06)' },
          }}
        >
          <Typography sx={{ fontSize: '0.64rem', color: CAPA.t2, fontWeight: 600 }}>Trocar</Typography>
        </Box>
      </Box>

      {/* Conta Google que não é deste perfil. NÃO entramos sozinhos como outra
          pessoa — quem decide é ela, e a maioria dos casos é o navegador estar
          logado na conta errada. */}
      {divergencia ? (
        <Box sx={{
          p: 1.6, borderRadius: '12px',
          bgcolor: 'rgba(255,213,77,0.07)', border: '1px solid rgba(255,213,77,0.28)',
          animation: 'fadeInScale 0.22s ease both',
        }}>
          <Typography sx={{ fontSize: '0.76rem', fontWeight: 700, color: CAPA.amarelo, lineHeight: 1.35 }}>
            {divergencia.membro
              ? `Esta conta Google é do ${divergencia.membro.charAt(0).toUpperCase() + divergencia.membro.slice(1)}, não do ${nome}.`
              : 'Esta conta Google não está cadastrada como membro da equipe.'}
          </Typography>
          <Typography sx={{ fontSize: '0.64rem', color: CAPA.t2, mt: 0.5, wordBreak: 'break-all' }}>
            {divergencia.email}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.8, mt: 1.4, flexWrap: 'wrap' }}>
            {divergencia.membro && (
              <Box
                {...clickable(onEntrarComoDivergente)}
                aria-label={`Entrar como ${divergencia.membro}`}
                sx={{
                  px: 1.4, py: 0.75, borderRadius: '10px', cursor: 'pointer',
                  background: `linear-gradient(135deg, ${CAPA.laranja}, #FF5E00)`,
                  transition: 'transform 0.2s ease',
                  '&:hover': { transform: 'translateY(-2px)' },
                }}
              >
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: CAPA.fundo }}>
                  Entrar como {divergencia.membro.charAt(0).toUpperCase() + divergencia.membro.slice(1)}
                </Typography>
              </Box>
            )}
            <Box
              {...clickable(onTrocarConta)}
              aria-label="Entrar com outra conta Google"
              sx={{
                px: 1.4, py: 0.75, borderRadius: '10px', cursor: 'pointer',
                border: `1px solid ${CAPA.borda}`, transition: 'all 0.2s ease',
                '&:hover': { borderColor: CAPA.bordaForte },
              }}
            >
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: CAPA.t2 }}>
                Trocar de conta
              </Typography>
            </Box>
          </Box>
        </Box>
      ) : (
        <>
          <Typography sx={{ fontSize: '0.72rem', color: CAPA.t2 }}>
            Como você quer entrar?
          </Typography>

          {/* O botão é desenhado pelo próprio Google — não dá para estilizá-lo
              por CSS nosso, então ele fica centralizado numa faixa própria. */}
          {googleOn && (
            <Box ref={googleRef} sx={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} />
          )}

          {erroGoogle && (
            <Typography sx={{ fontSize: '0.68rem', color: DS.redSoft, textAlign: 'center' }}>
              {erroGoogle}
            </Typography>
          )}

          {googleOn && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Box sx={{ flex: 1, height: '1px', bgcolor: CAPA.borda }} />
              <Typography sx={{ fontSize: '0.6rem', color: CAPA.t3 }}>ou</Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: CAPA.borda }} />
            </Box>
          )}

          <Box
            {...clickable(onSenhaOuDireto)}
            aria-label={!senhaConhecida ? 'Continuar' : temSenha ? 'Entrar com a senha do cargo' : 'Entrar direto, sem senha'}
            sx={{
              py: 1.1, borderRadius: '11px', cursor: 'pointer', textAlign: 'center',
              bgcolor: CAPA.superficie, border: `1px solid ${CAPA.borda}`,
              transition: 'all 0.2s ease',
              '&:hover': { borderColor: CAPA.laranjaBorda, bgcolor: CAPA.superficieAlt },
              '&:focus-visible': { borderColor: CAPA.laranja },
            }}
          >
            <Typography sx={{ fontSize: '0.76rem', fontWeight: 700, color: CAPA.t1 }}>
              {verificando ? 'Verificando…' : !senhaConhecida ? 'Continuar' : temSenha ? 'Entrar com a senha' : 'Entrar direto'}
            </Typography>
            {/* A frase só aparece quando o servidor de fato respondeu. Ela
                estava saindo durante a consulta, quando a lista ainda está
                vazia — dizendo a quem TEM senha que não tem uma. */}
            {senhaConhecida && !temSenha && (
              <Typography sx={{ fontSize: '0.6rem', color: CAPA.t3, mt: 0.25 }}>
                este perfil não tem senha configurada
              </Typography>
            )}
          </Box>
        </>
      )}
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

/** Selo de status do cabeçalho: ícone + texto, nunca só cor. */
function StatusSelo({ icone, cor, texto, pulsa }: {
  icone: string; cor: string; texto: string; pulsa?: boolean
}) {
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      px: 0.9, py: 0.4, borderRadius: '999px',
      bgcolor: 'rgba(169,182,201,0.07)',
      border: `1px solid ${CAPA.borda}`,
    }}>
      <Box component="span" sx={{
        fontSize: '0.6rem', lineHeight: 1, color: cor,
        animation: pulsa ? 'glowPulse 3s ease-in-out infinite' : 'none',
      }}>
        {icone}
      </Box>
      <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: CAPA.t2, whiteSpace: 'nowrap' }}>
        {texto}
      </Typography>
    </Box>
  )
}
