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
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2.2, py: 1.8,
        '@keyframes onlineDot': {
          '0%,100%': { opacity: 1 },
          '50%':     { opacity: 0.4 },
        },
      }}>

        {/* Ícone DS */}
        <Box sx={{
          width: { md: 36, xl: 42 }, height: { md: 36, xl: 42 },
          borderRadius: '10px', flexShrink: 0,
          background: 'linear-gradient(135deg, #ff9039, #ff5339)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(249,115,22,0.25)',
        }}>
          {!imgError ? (
            <Box
              component="img"
              src="/logotipo.png"
              alt="DS"
              onError={() => setImgError(true)}
              sx={{ width: '75%', height: '75%', objectFit: 'contain' }}
            />
          ) : (
            <Typography sx={{ fontWeight: 900, fontSize: { md: '0.85rem', xl: '1rem' }, color: '#fff', lineHeight: 1 }}>
              DS
            </Typography>
          )}
        </Box>

        {/* Texto */}
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{
            fontSize: { md: '0.88rem', xl: '1rem' },
            fontWeight: 800,
            letterSpacing: '-0.01em',
            color: 'rgba(255,255,255,0.92)',
            lineHeight: 1.1,
          }}>
            DS HUB
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.35 }}>
            <Box sx={{
              width: 5, height: 5, borderRadius: '50%',
              bgcolor: '#22C55E', flexShrink: 0,
              animation: 'onlineDot 3s ease-in-out infinite',
            }} />
            <Typography sx={{
              fontSize: { md: '0.48rem', xl: '0.54rem' },
              color: DS.t3,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              Digital Scale
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
        background: 'linear-gradient(135deg, #ff9039, #ff5339)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 ${4 * scale}px ${8 * scale}px rgba(255,80,57,0.25)`,
        flexShrink: 0,
      }}>
        <Typography sx={{ fontWeight: 900, fontSize: `${13 * scale}px`, color: '#fff' }}>DS</Typography>
      </Box>
      {variant === 'full' && (
        <Box>
          <Typography sx={{
            fontSize: `${9 * scale}px`, fontWeight: 800,
            letterSpacing: `${2 * scale}px`, textTransform: 'uppercase', lineHeight: 1,
            color: 'rgba(255,255,255,0.85)',
          }}>
            Digital Scale
          </Typography>
        </Box>
      )}
    </Box>
  )
}
