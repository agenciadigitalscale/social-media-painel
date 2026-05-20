import { useEffect, useRef, useState } from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: object) => void
          renderButton: (el: HTMLElement, cfg: object) => void
          prompt: () => void
        }
      }
    }
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

type Phase = 'loading' | 'login' | 'ok'

interface Props {
  children: React.ReactNode
}

export default function LoginGate({ children }: Props) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError]  = useState('')
  const btnRef = useRef<HTMLDivElement>(null)

  // Check existing session on mount
  useEffect(() => {
    fetch('/api/auth', { credentials: 'include' })
      .then(r => r.json())
      .then((d: { ok: boolean }) => setPhase(d.ok ? 'ok' : 'login'))
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
            const data = await res.json() as { ok: boolean; error?: string }
            if (data.ok) {
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
        bgcolor: '#0d0d0d',
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
            linear-gradient(rgba(255,144,57,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,144,57,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        },
      }}
    >
      {/* Ambient glow */}
      <Box sx={{
        position: 'absolute',
        width: 480,
        height: 480,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,144,57,0.08) 0%, transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
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
        border: '1px solid rgba(255,144,57,0.14)',
        boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        minWidth: 320,
        maxWidth: 380,
      }}>
        {/* Logo */}
        <Box sx={{
          width: 72,
          height: 72,
          borderRadius: '22px',
          background: 'linear-gradient(135deg, #ff9039 0%, #ff5339 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 28px rgba(255,144,57,0.45)',
          fontSize: 32,
          fontWeight: 900,
          color: '#fff',
          letterSpacing: '-1px',
          userSelect: 'none',
        }}>
          DS
        </Box>

        {/* Title */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{
            fontSize: '1.75rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #ff9039 0%, #ff5339 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1.1,
            letterSpacing: '-0.5px',
          }}>
            DS HUB
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.38)', mt: 0.5 }}>
            Digital Scale · Acesso restrito
          </Typography>
        </Box>

        {/* Content: spinner OR google button */}
        {phase === 'loading' ? (
          <CircularProgress size={32} sx={{ color: '#ff9039' }} />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%' }}>
            <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
              Entre com seu e-mail Google para acessar
            </Typography>

            {/* Google Sign-In button injected by GIS */}
            <Box ref={btnRef} sx={{ display: 'flex', justifyContent: 'center', width: '100%' }} />

            {/* Error */}
            {error && (
              <Box sx={{
                p: '10px 14px',
                borderRadius: 2,
                bgcolor: 'rgba(255,69,69,0.10)',
                border: '1px solid rgba(255,69,69,0.25)',
                width: '100%',
              }}>
                <Typography sx={{ fontSize: '0.75rem', color: '#FF4545', textAlign: 'center' }}>
                  {error}
                </Typography>
              </Box>
            )}
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
