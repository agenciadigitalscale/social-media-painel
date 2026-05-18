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
      <Box sx={{ textAlign: 'center', px: 1 }}>
        {/* Logo image grande */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
          {!imgError ? (
            <img
              src="/logo.png"
              alt="Digital Scale"
              height={110}
              style={{
                objectFit: 'contain',
                mixBlendMode: 'screen',
                filter: 'drop-shadow(0 0 22px rgba(255,144,57,0.7)) brightness(1.15)',
              }}
              onError={() => setImgError(true)}
            />
          ) : (
            <Box sx={{
              width: 88, height: 88, borderRadius: 4,
              background: 'linear-gradient(145deg, #ff9039, #ff5339)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(255,144,57,0.5)',
            }}>
              <Typography sx={{ fontWeight: 900, fontSize: '2rem', color: '#fff' }}>DS</Typography>
            </Box>
          )}
        </Box>

        {/* DIGITAL SCALE 🚀 */}
        <Typography sx={{
          fontWeight: 900,
          fontSize: { md: '1.15rem', lg: '1.3rem', xl: '1.5rem' },
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          lineHeight: 1,
          background: 'linear-gradient(135deg, #ffb86c 0%, #ff9039 40%, #ff5339 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: 'none',
          filter: 'drop-shadow(0 0 8px rgba(255,144,57,0.6))',
          mb: 0.4,
        }}>
          🚀 Digital Scale
        </Typography>

        {/* Social Media label */}
        <Typography sx={{
          fontSize: { md: '0.58rem', xl: '0.68rem' },
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.35)',
          fontWeight: 600,
        }}>
          Social Media
        </Typography>
      </Box>
    )
  }

  const h = size === 'sm' ? 32 : size === 'lg' ? 64 : 48

  if (!imgError) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <img
          src="/logo.png"
          alt="Digital Scale"
          height={h}
          style={{ objectFit: 'contain', mixBlendMode: 'screen', filter: 'drop-shadow(0 2px 8px rgba(255,144,57,0.4)) brightness(1.1)' }}
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
