import { useEffect, useRef, useState } from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'
import { userFromEmail } from '../lib/users'
import { clickable } from '../shared/a11y'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: object) => void
          renderButton: (el: HTMLElement, cfg: object) => void
          prompt: () => void
          /** Faz o Google parar de reusar a última conta — o "trocar de conta". */
          disableAutoSelect: () => void
        }
      }
    }
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

/**
 * Cores da marca, tiradas do próprio logotipo (foguete laranja, rastro amarelo).
 *
 * Esta é a única tela onde laranja é acento — é a capa da Digital Scale. Dentro
 * do painel a regra do manual continua valendo: azul é a marca, laranja só
 * sinaliza atraso.
 */
const BRAND_ORANGE = '#FF7A00'
const BRAND_YELLOW = '#FFD400'

/**
 * Quem entrou pelo Google já entra como o membro dele — sem passar de novo pela
 * splash escolhendo avatar e digitando a senha do cargo. É a conta que diz quem
 * é a pessoa, e não a escolha dela numa lista (onde dava para entrar como outro).
 *
 * E-mail fora do mapa (visitante autorizado, conta nova ainda não cadastrada)
 * cai na splash normalmente — nada trava.
 */
function adoptIdentity(email: string): void {
  const user = userFromEmail(email)
  if (!user) return
  // `sm_tab_user` é o que o App lê para saber quem está logado nesta aba.
  try { sessionStorage.setItem('sm_tab_user', user) }
  catch { /* modo privado sem storage — a splash assume */ }
}

type Phase = 'loading' | 'login' | 'ok'

interface Props {
  children: React.ReactNode
}

/**
 * Sem `VITE_GOOGLE_CLIENT_ID` não há login Google configurado — o painel abre
 * direto. A decisão fica AQUI, antes de qualquer hook: o portão de verdade
 * (abaixo) não pode ter `return` no meio dos hooks.
 */
export default function LoginGate({ children }: Props) {
  if (!CLIENT_ID) return <>{children}</>
  return <GoogleGate>{children}</GoogleGate>
}

/**
 * O `return` antecipado morava no meio deste componente, com dois `useEffect`
 * DEPOIS dele — hook chamado condicionalmente, que é justamente o que quebra a
 * ordem em que o React guarda o estado. Hoje não estoura porque `CLIENT_ID` é
 * constante de módulo e o caminho nunca muda entre renders; passaria a ser uma
 * armadilha real no primeiro `if` que dependesse de estado.
 */
function GoogleGate({ children }: Props) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError]  = useState('')
  const btnRef = useRef<HTMLDivElement>(null)

  // Check existing session on mount
  useEffect(() => {
    fetch('/api/auth', { credentials: 'include' })
      .then(r => r.json())
      .then((d: { ok: boolean; email?: string }) => {
        if (d.ok && d.email) adoptIdentity(d.email)
        setPhase(d.ok ? 'ok' : 'login')
      })
      .catch(() => setPhase('login'))
  }, [])

  // Load GIS and render button when phase switches to 'login'
  useEffect(() => {
    if (phase !== 'login') return

    const initGIS = () => {
      window.google?.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (resp: { credential: string }) => {
          setError('')
          try {
            const res  = await fetch('/api/auth', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: resp.credential }),
            })
            const data = await res.json() as { ok: boolean; error?: string; email?: string }
            if (data.ok) {
              if (data.email) adoptIdentity(data.email)
              setPhase('ok')
            } else {
              setError(data.error ?? 'Acesso negado.')
            }
          } catch {
            setError('Erro de conexão. Tente novamente.')
          }
        },
        ux_mode: 'popup',
        locale: 'pt-BR',
      })

      if (btnRef.current) {
        window.google?.accounts.id.renderButton(btnRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          locale: 'pt-BR',
        })
      }
    }

    if (window.google?.accounts) {
      initGIS()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = initGIS
    document.head.appendChild(script)
  }, [phase])

  if (phase === 'ok') return <>{children}</>

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: '#0A1120',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        // Tech grid background
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        },
      }}
    >
      {/* Brilho ambiente — quente, na cor da marca, bem discreto */}
      <Box sx={{
        position: 'absolute',
        width: 620,
        height: 620,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${BRAND_ORANGE}12 0%, transparent 68%)`,
        top: '42%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        animation: 'glowPulse 7s ease-in-out infinite',
      }} />

      <Box sx={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        p: 5,
        borderRadius: 4,
        bgcolor: 'rgba(22,22,22,0.85)',
        border: '1px solid rgba(59,130,246,0.14)',
        boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        minWidth: 320,
        maxWidth: 380,
      }}>
        {/* Logo da agência — o foguete entra subindo e fica flutuando de leve.
            Aqui a marca é LARANJA de propósito: é a identidade da Digital Scale
            (a UI do painel continua azul; laranja lá é só alerta). */}
        <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', width: '100%' }}>
          {/* Halo quente atrás da logo, respirando */}
          <Box sx={{
            position: 'absolute', top: '50%', left: '50%',
            width: 220, height: 220, borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, ${BRAND_ORANGE}22 0%, transparent 68%)`,
            animation: 'glowPulse 4s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
          <Box
            component="img"
            src="/logotipo.png"
            alt="Digital Scale"
            sx={{
              position: 'relative',
              width: { xs: 190, sm: 215 },
              height: 'auto',
              filter: `drop-shadow(0 6px 22px ${BRAND_ORANGE}55)`,
              animation: 'fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) both, floatUp 5s ease-in-out 0.7s infinite',
              userSelect: 'none',
            }}
          />
        </Box>

        {/* DS HUB — nas cores do foguete: laranja com o amarelo do rastro */}
        <Box sx={{ textAlign: 'center', mt: -1 }}>
          <Typography sx={{
            fontSize: { xs: '2.4rem', sm: '2.8rem' },
            fontWeight: 900,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            background: `linear-gradient(100deg, ${BRAND_ORANGE} 0%, ${BRAND_YELLOW} 50%, ${BRAND_ORANGE} 100%)`,
            backgroundSize: '220% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            // O gradiente desliza devagar: dá vida sem piscar na cara de ninguém.
            animation: 'shimmer 6s linear infinite, fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.15s both',
          }}>
            DS HUB
          </Typography>
          <Typography sx={{
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.34)',
            mt: 1,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 600,
            animation: 'fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.3s both',
          }}>
            Acesso restrito
          </Typography>
        </Box>

        {/* Verificando a sessão. Antes era um círculo azul solto, que destoava da
            marca e não dizia o que estava acontecendo. */}
        {phase === 'loading' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.6, py: 1 }}>
            <Box sx={{ display: 'flex', gap: 0.7 }}>
              {[0, 1, 2].map(i => (
                <Box key={i} sx={{
                  width: 7, height: 7, borderRadius: '50%',
                  bgcolor: i === 1 ? BRAND_YELLOW : BRAND_ORANGE,
                  animation: 'glowPulse 1.1s ease-in-out infinite',
                  animationDelay: `${i * 0.16}s`,
                }} />
              ))}
            </Box>
            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
              Verificando seu acesso…
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%' }}>
            <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
              Entre com seu e-mail Google para acessar
            </Typography>

            {/* Google Sign-In button injected by GIS */}
            <Box ref={btnRef} sx={{ display: 'flex', justifyContent: 'center', width: '100%' }} />

            {/* Erro. Dizer só "sem permissão" deixa a pessoa sem saída — quem
                erra a conta costuma ser quem entrou com o Gmail pessoal. O aviso
                agora diz o que fazer e como trocar de conta. */}
            {error && (
              <Box sx={{
                p: '12px 14px',
                borderRadius: 2,
                bgcolor: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.25)',
                width: '100%',
                animation: 'fadeInScale 0.22s ease both',
              }}>
                <Typography sx={{ fontSize: '0.75rem', color: '#EF4444', textAlign: 'center', fontWeight: 600 }}>
                  {error}
                </Typography>
                {error.includes('permissão') && (
                  <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', textAlign: 'center', mt: 0.8, lineHeight: 1.5 }}>
                    Use a conta Google <strong>da agência</strong>. Se for a sua conta certa,
                    peça ao Kaique para liberá-la.
                  </Typography>
                )}
              </Box>
            )}

            {/* Sair da conta que o Google guardou. Sem isto, quem entrou com o
                Gmail errado fica preso: o Google reusa a conta e não pergunta. */}
            {error && (
              <Box
                {...clickable(() => {
                  try { window.google?.accounts.id.disableAutoSelect() } catch { /* sem GIS */ }
                  window.location.reload()
                })}
                sx={{
                  cursor: 'pointer', mt: -0.5,
                  '&:hover .troca': { color: BRAND_ORANGE },
                }}
              >
                <Typography className="troca" sx={{
                  fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)',
                  textDecoration: 'underline', transition: 'color 0.18s',
                }}>
                  Entrar com outra conta
                </Typography>
              </Box>
            )}

            {/* Quem ainda não tem conta Google cadastrada (jhones, testa) entra
                pela senha do cargo, como sempre. Sem esta saída, ligar o Google
                trancaria essas pessoas fora do painel — o portão vale para todos.
                A proteção não se perde: a senha do cargo agora emite a MESMA
                sessão, então quem não souber a senha continua sem acesso aos dados. */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, width: '100%', mt: 0.5 }}>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.08)' }} />
              <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)' }}>ou</Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.08)' }} />
            </Box>

            <Box
              {...clickable(() => setPhase('ok'))}
              sx={{
                px: 2, py: 1, borderRadius: 2, cursor: 'pointer',
                border: '1px solid rgba(148,163,184,0.22)',
                transition: 'all 0.18s',
                '&:hover': { borderColor: 'rgba(59,130,246,0.4)', bgcolor: 'rgba(59,130,246,0.06)' },
              }}
            >
              <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.62)', fontWeight: 600 }}>
                Entrar com a senha da equipe
              </Typography>
            </Box>
          </Box>
        )}

        {/* Footer */}
        <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.2)', mt: 1 }}>
          © Digital Scale · Uso interno
        </Typography>
      </Box>
    </Box>
  )
}
