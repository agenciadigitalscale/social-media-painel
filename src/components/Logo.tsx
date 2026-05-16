import { Box, Typography } from '@mui/material'
import { useState } from 'react'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'full' | 'icon'
}

export default function Logo({ size = 'md', variant = 'full' }: Props) {
  const [imgError, setImgError] = useState(false)
  const h = size === 'sm' ? 32 : size === 'lg' ? 64 : 48

  if (!imgError) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <img
          src="/logo.png"
          alt="Digital Scale"
          height={h}
          style={{ objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(255,144,57,0.3))' }}
          onError={() => setImgError(true)}
        />
        {variant === 'full' && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: '0.6rem',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Social Media
          </Typography>
        )}
      </Box>
    )
  }

  // Fallback se logo.png não existir
  const scale = size === 'sm' ? 0.7 : size === 'lg' ? 1.4 : 1
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 * scale }}>
      <Box
        sx={{
          width: 36 * scale, height: 36 * scale,
          borderRadius: `${8 * scale}px`,
          background: 'linear-gradient(145deg, #ff9039, #ff5339, #cc3a1f)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 ${4 * scale}px ${8 * scale}px rgba(255,80,57,0.35), inset 0 1px 1px rgba(255,255,255,0.2)`,
          flexShrink: 0,
        }}
      >
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
