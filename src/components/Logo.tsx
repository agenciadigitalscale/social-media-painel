import { Box, Typography } from '@mui/material'
import { useState } from 'react'
import { DS } from '../theme'

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'sidebar'
  variant?: 'full' | 'icon'
}

export default function Logo({ size = 'md', variant = 'full' }: Props) {
  const [imgError, setImgError] = useState(false)

  if (size === 'sidebar') {
    return (
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.4,
        px: 2.2, py: 2,
        '@keyframes onlineDot': {
          '0%,100%': { opacity: 1 },
          '50%':     { opacity: 0.4 },
        },
      }}>

        {/* Logo Digital Scale — imagem direta, sem caixa */}
        {!imgError ? (
          <Box
            component="img"
            src="/logotipo.png"
            alt="Digital Scale"
            onError={() => setImgError(true)}
            sx={{
              height: { md: 52, lg: 58, xl: 68 },
              width: 'auto',
              objectFit: 'contain',
              flexShrink: 0,
            }}
          />
        ) : (
          /* Fallback: caixa azul com iniciais */
          <Box sx={{
            width: { md: 36, xl: 44 }, height: { md: 36, xl: 44 },
            borderRadius: '10px', flexShrink: 0,
            background: `linear-gradient(135deg, ${DS.accent}, ${DS.cyan})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography sx={{ fontWeight: 900, fontSize: { md: '0.9rem', xl: '1.05rem' }, color: '#fff', lineHeight: 1 }}>
              DS
            </Typography>
          </Box>
        )}

        {/* Texto */}
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{
            fontSize: { md: '0.9rem', xl: '1rem' },
            fontWeight: 900,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            background: `linear-gradient(90deg, ${DS.accent} 0%, rgba(244,247,255,0.95) 48%, ${DS.cyan} 100%)`,
            backgroundSize: '200% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'shimmerText 5s linear infinite',
            '@keyframes shimmerText': {
              '0%':   { backgroundPosition: '200% center' },
              '100%': { backgroundPosition: '-200% center' },
            },
          }}>
            DS HUB
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.35 }}>
            <Box sx={{
              width: 5, height: 5, borderRadius: '50%',
              bgcolor: DS.green, flexShrink: 0,
              animation: 'onlineDot 3s ease-in-out infinite',
            }} />
            <Typography sx={{
              fontSize: { md: '0.5rem', xl: '0.56rem' },
              color: DS.t3,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              by Digital Scale
            </Typography>
          </Box>
        </Box>
      </Box>
    )
  }

  // ── Variantes sm / md / lg ────────────────────────────────
  const h = size === 'sm' ? 32 : size === 'lg' ? 64 : 48

  if (!imgError) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <img
          src="/logotipo.png"
          alt="Digital Scale"
          height={h}
          style={{ objectFit: 'contain' }}
          onError={() => setImgError(true)}
        />
        {variant === 'full' && (
          <Typography sx={{ color: DS.t2, fontSize: '0.6rem', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>
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
        background: `linear-gradient(135deg, ${DS.accent}, ${DS.cyan})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 ${4 * scale}px ${8 * scale}px rgba(59,130,246,0.28)`,
        flexShrink: 0,
      }}>
        <Typography sx={{ fontWeight: 900, fontSize: `${13 * scale}px`, color: '#fff' }}>DS</Typography>
      </Box>
      {variant === 'full' && (
        <Box>
          <Typography sx={{
            fontSize: `${9 * scale}px`, fontWeight: 800,
            letterSpacing: `${2 * scale}px`, textTransform: 'uppercase', lineHeight: 1,
            color: 'rgba(244,247,255,0.85)',
          }}>
            Digital Scale
          </Typography>
        </Box>
      )}
    </Box>
  )
}
