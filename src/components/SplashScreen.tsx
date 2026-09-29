import { useEffect, useState, useRef } from 'react'
import { Box, Typography, TextField, Button, CircularProgress, MenuItem } from '@mui/material'
import { NAME_MAP } from '../lib/users'
import SplashBackdrop from './splash/SplashBackdrop'
import { sessaoExistente } from './splash/googleAuth'
import { CAPA } from './splash/palette'
import { DS, ctaGradient } from '../theme'

// ── Ordenação dos membros na tela de login ─────────────────
const MEMBER_ORDER = ['pradox', 'testa', 'kaique', 'arthur', 'jhones', 'julio', 'kerges', 'robson']

interface Props {
  showLogin: boolean
  onFinish: () => void
  onLogin: (name: string) => void
  currentUser?: string
}

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

export default function SplashScreen({ showLogin, onFinish, onLogin, currentUser }: Props) {
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

  // Sem abertura nem boas-vindas (2026-09-28): eram 2,5 s de logo a cada
  // carregamento para quem já estava logado, ~1 s até o formulário aparecer e
  // mais 2,6 s de tela de "carregando" depois de entrar. Agora é direto.
  useEffect(() => {
    if (!showLogin) onFinish()
  }, [showLogin, onFinish])

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
    onFinish()
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

  if (!showLogin) return null

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
      overflowY: 'auto',
      // O fundo da capa vem do SplashBackdrop; aqui fica só a cor de base, que
      // é o que o mix-blend-mode: screen da logo precisa ter embaixo.
      background: CAPA.fundo,

      // Única animação da tela: o tremido do aviso de senha incorreta.
      '@keyframes shake':       { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-5px)' }, '40%,80%': { transform: 'translateX(5px)' } },
    }}>

      <SplashBackdrop />

      {/* ── Login ── mesmo padrão do painel-facebook: marca, título, nome,
          senha, Entrar. */}
      {(
        <Box sx={{ position: 'relative', zIndex: 10, width: 'clamp(300px, 92vw, 470px)', mx: 'auto', px: { xs: 2, sm: 0 }, pb: { xs: 4, md: 5 } }}>
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
                    MenuProps: {
                      // A splash é `position: fixed` com z-index 9999; o menu do MUI
                      // abre num portal com 1300 e ficava ESCONDIDO atrás dela.
                      sx: { zIndex: 10000 },
                      PaperProps: { sx: { bgcolor: DS.surface, border: `1px solid ${DS.border}`, mt: 0.5 } },
                    },
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

    </Box>
  )
}
