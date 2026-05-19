import { Box, Typography } from '@mui/material'
import { useState } from 'react'

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'sidebar'
  variant?: 'full' | 'icon'
}

export default function Logo({ size = 'md', variant = 'full' }: Props) {
  const [imgError, setImgError] = useState(false)

  if (size === 'sidebar') {
    return (
      <Box sx={{
        textAlign: 'center', px: 1,
        '@keyframes float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        '@keyframes smokeA': {
          '0%':   { transform: 'translateY(0) scaleX(1)',   opacity: 0.18 },
          '50%':  { transform: 'translateY(-8px) scaleX(1.25)', opacity: 0.08 },
          '100%': { transform: 'translateY(-18px) scaleX(1.5)', opacity: 0 },
        },
        '@keyframes smokeB': {
          '0%':   { transform: 'translateY(0) scaleX(1.1)', opacity: 0.14 },
          '50%':  { transform: 'translateY(-12px) scaleX(1.35)', opacity: 0.06 },
          '100%': { transform: 'translateY(-22px) scaleX(1.6)', opacity: 0 },
        },
        '@keyframes logoPulse': {
          '0%, 100%': { filter: 'drop-shadow(0 0 18px rgba(255,144,57,0.55)) drop-shadow(0 2px 10px rgba(255,83,57,0.35))' },
          '50%':      { filter: 'drop-shadow(0 0 30px rgba(255,144,57,0.85)) drop-shadow(0 4px 18px rgba(255,83,57,0.6))' },
        },
      }}>

        {/* Logo image + fumaça */}
        <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', mb: 1.2 }}>

          {/* Camada de fumaça A */}
          <Box sx={{
            position: 'absolute', bottom: -10, left: '50%',
            transform: 'translateX(-50%)',
            width: 120, height: 40,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,144,57,0.28) 0%, transparent 70%)',
            filter: 'blur(10px)',
            animation: 'smokeA 2.8s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          {/* Camada de fumaça B (desfasada) */}
          <Box sx={{
            position: 'absolute', bottom: -6, left: '50%',
            transform: 'translateX(-50%)',
            width: 90, height: 28,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,83,57,0.22) 0%, transparent 70%)',
            filter: 'blur(8px)',
            animation: 'smokeB 2.8s ease-in-out infinite 1.4s',
            pointerEvents: 'none',
          }} />

          {/* Brilho de chão */}
          <Box sx={{
            position: 'absolute', bottom: -14, left: '50%',
            transform: 'translateX(-50%)',
            width: 160, height: 24,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,144,57,0.15) 0%, transparent 70%)',
            filter: 'blur(14px)',
            pointerEvents: 'none',
          }} />

          {/* Logo flutuante */}
          <Box sx={{
            animation: 'float 3.5s ease-in-out infinite',
            '&:hover img': {
              filter: 'drop-shadow(0 0 36px rgba(255,144,57,1)) drop-shadow(0 0 60px rgba(255,83,57,0.7)) brightness(1.15)',
              transform: 'scale(1.1)',
            },
          }}>
            {!imgError ? (
              <img
                src="/logotipo.png"
                alt="Digital Scale"
                height={210}
                style={{
                  objectFit: 'contain',
                  display: 'block',
                  transition: 'filter 0.3s ease, transform 0.3s ease',
                  animation: 'logoPulse 3.5s ease-in-out infinite',
                }}
                onError={() => setImgError(true)}
              />
            ) : (
              <Box sx={{
                width: 100, height: 100, borderRadius: 4,
                background: 'linear-gradient(145deg, #ff9039, #ff5339)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 24px rgba(255,144,57,0.5)',
              }}>
                <Typography sx={{ fontWeight: 900, fontSize: '2.2rem', color: '#fff' }}>DS</Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* DS HUB — neon 3D animado */}
        <Box sx={{
          position: 'relative',
          mt: 0.8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',

          '@keyframes hubGlow': {
            '0%,100%': { filter: 'drop-shadow(0 0 6px rgba(255,144,57,0.7)) drop-shadow(0 0 14px rgba(255,83,57,0.4))' },
            '50%':     { filter: 'drop-shadow(0 0 16px rgba(255,144,57,1)) drop-shadow(0 0 32px rgba(255,83,57,0.8)) drop-shadow(0 0 48px rgba(255,144,57,0.4))' },
          },
          '@keyframes hubFloat': {
            '0%,100%': { transform: 'perspective(300px) rotateX(4deg) translateY(0px)' },
            '50%':     { transform: 'perspective(300px) rotateX(2deg) translateY(-4px)' },
          },
          '@keyframes hubSmoke': {
            '0%':   { transform: 'translateY(0) scaleX(1)',   opacity: 0.22 },
            '60%':  { transform: 'translateY(-14px) scaleX(1.4)', opacity: 0.08 },
            '100%': { transform: 'translateY(-28px) scaleX(1.8)', opacity: 0 },
          },
          '@keyframes hubSmokeB': {
            '0%':   { transform: 'translateY(0) scaleX(1.2)',  opacity: 0.16 },
            '60%':  { transform: 'translateY(-18px) scaleX(1.6)', opacity: 0.06 },
            '100%': { transform: 'translateY(-34px) scaleX(2)',   opacity: 0 },
          },
        }}>

          {/* Fumaça neon sob o texto */}
          <Box sx={{
            position: 'absolute', bottom: -4, left: '50%',
            transform: 'translateX(-50%)',
            width: 140, height: 20, borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,144,57,0.4) 0%, rgba(255,83,57,0.2) 50%, transparent 70%)',
            filter: 'blur(8px)',
            animation: 'hubSmoke 2.4s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
          <Box sx={{
            position: 'absolute', bottom: -2, left: '50%',
            transform: 'translateX(-50%)',
            width: 100, height: 14, borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,200,80,0.35) 0%, transparent 70%)',
            filter: 'blur(6px)',
            animation: 'hubSmokeB 2.4s ease-in-out infinite 1.2s',
            pointerEvents: 'none',
          }} />

          {/* Texto DS HUB — gradiente + neon + 3D */}
          <Box sx={{
            animation: 'hubGlow 2.6s ease-in-out infinite, hubFloat 3.8s ease-in-out infinite',
          }}>
            <Typography sx={{
              fontSize: { md: '1.45rem', xl: '1.7rem' },
              fontWeight: 900,
              letterSpacing: '0.18em',
              lineHeight: 1,
              background: 'linear-gradient(135deg, #ffffff 0%, #ffe0b0 25%, #ff9039 55%, #ff5339 85%, #cc2200 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textTransform: 'uppercase',
              userSelect: 'none',
            }}>
              DS HUB
            </Typography>
          </Box>
        </Box>
      </Box>
    )
  }

  const h = size === 'sm' ? 32 : size === 'lg' ? 64 : 48

  if (!imgError) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <img
          src="/logotipo.png"
          alt="Digital Scale"
          height={h}
          style={{ objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(255,144,57,0.5))' }}
          onError={() => setImgError(true)}
        />
        {variant === 'full' && (
          <Typography sx={{ color: 'text.secondary', fontSize: '0.6rem', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>
            Social Media
          </Typography>
        )}
      </Box>
    )
  }

  const scale = size === 'sm' ? 0.7 : size === 'lg' ? 1.4 : 1
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 * scale }}>
      <Box sx={{
        width: 36 * scale, height: 36 * scale,
        borderRadius: `${8 * scale}px`,
        background: 'linear-gradient(145deg, #ff9039, #ff5339, #cc3a1f)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 ${4 * scale}px ${8 * scale}px rgba(255,80,57,0.35), inset 0 1px 1px rgba(255,255,255,0.2)`,
        flexShrink: 0,
      }}>
        <Typography sx={{ fontWeight: 900, fontSize: `${13 * scale}px`, color: '#fff' }}>DS</Typography>
      </Box>
      {variant === 'full' && (
        <Box>
          <Typography sx={{ fontSize: `${9 * scale}px`, fontWeight: 800, letterSpacing: `${2 * scale}px`, textTransform: 'uppercase', lineHeight: 1, background: 'linear-gradient(90deg, #ff9039, #ff5339)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Digital Scale
          </Typography>
          <Typography sx={{ fontSize: `${7 * scale}px`, color: 'text.secondary', letterSpacing: `${1 * scale}px`, textTransform: 'uppercase', lineHeight: 1.4 }}>
            Social Media
          </Typography>
        </Box>
      )}
    </Box>
  )
}
