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
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        px: 1, pt: 2.5, pb: 2,
        position: 'relative', overflow: 'hidden',

        /* ── keyframes ── */
        '@keyframes ringRotate': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        '@keyframes breatheGlow': {
          '0%,100%': { opacity: 0.55, transform: 'scale(1)' },
          '50%':     { opacity: 1,    transform: 'scale(1.12)' },
        },
        '@keyframes particleDrift': {
          '0%':   { transform: 'translateY(0)   translateX(0)',    opacity: 0   },
          '20%':  { opacity: 0.8 },
          '80%':  { opacity: 0.5 },
          '100%': { transform: 'translateY(-60px) translateX(20px)', opacity: 0 },
        },
        '@keyframes particleDriftB': {
          '0%':   { transform: 'translateY(0)   translateX(0)',     opacity: 0   },
          '25%':  { opacity: 0.6 },
          '75%':  { opacity: 0.3 },
          '100%': { transform: 'translateY(-50px) translateX(-15px)', opacity: 0 },
        },
        '@keyframes hubGlow': {
          '0%,100%': { filter: 'drop-shadow(0 0 5px rgba(255,144,57,0.6))' },
          '50%':     { filter: 'drop-shadow(0 0 12px rgba(255,144,57,1)) drop-shadow(0 0 24px rgba(255,83,57,0.65))' },
        },
        '@keyframes onlineDot': {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(0,196,122,0.5), 0 0 5px rgba(0,196,122,0.7)' },
          '50%':     { boxShadow: '0 0 0 4px rgba(0,196,122,0.1), 0 0 10px rgba(0,196,122,0.9)' },
        },
        '@keyframes aiDot': {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(180,90,255,0.5), 0 0 5px rgba(180,90,255,0.7)' },
          '50%':     { boxShadow: '0 0 0 4px rgba(180,90,255,0.1), 0 0 10px rgba(180,90,255,0.9)' },
        },
      }}>

        {/* ── Radial glow layer behind the logo ── */}
        <Box sx={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          width: 180, height: 180, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(255,144,57,0.18) 0%, rgba(255,83,57,0.08) 45%, transparent 70%)',
          animation: 'breatheGlow 4s ease-in-out infinite',
          zIndex: 0,
        }} />

        {/* ── Floating particles ── */}
        {[
          { left: '22%', top: '68%', delay: '0s',    dur: '3.2s', size: 3, variant: 'A' },
          { left: '68%', top: '72%', delay: '1.1s',  dur: '2.8s', size: 2, variant: 'B' },
          { left: '45%', top: '80%', delay: '0.6s',  dur: '3.6s', size: 2, variant: 'A' },
          { left: '78%', top: '55%', delay: '1.8s',  dur: '2.4s', size: 3, variant: 'B' },
          { left: '15%', top: '60%', delay: '2.2s',  dur: '3.0s', size: 2, variant: 'A' },
        ].map((p, i) => (
          <Box key={i} sx={{
            position: 'absolute', left: p.left, top: p.top, zIndex: 0, pointerEvents: 'none',
            width: p.size, height: p.size, borderRadius: '50%',
            bgcolor: i % 2 === 0 ? 'rgba(255,144,57,0.7)' : 'rgba(180,90,255,0.6)',
            animation: `particleDrift${p.variant} ${p.dur} ${p.delay} ease-in-out infinite`,
          }} />
        ))}

        {/* ── Instagram-style squircle profile photo ── */}
        <Box sx={{ position: 'relative', flexShrink: 0, zIndex: 1 }}>

          {/* Rotating conic gradient ring */}
          <Box sx={{
            position: 'absolute', inset: -3, borderRadius: { md: '30px', xl: '34px' }, zIndex: 0,
            background: 'conic-gradient(from 0deg, #ff9039, #ff5339, #ffd700, #b45aff, #3B8EFF, #ff9039)',
            animation: 'ringRotate 6s linear infinite',
            opacity: 0.9,
          }} />

          {/* Static ring border (always visible) */}
          <Box sx={{
            width: { md: 92, xl: 106 }, height: { md: 92, xl: 106 },
            borderRadius: { md: '28px', xl: '32px' },
            background: 'conic-gradient(from 180deg, #ff9039, #ff5339, #ffd700, #b45aff, #ff9039)',
            p: '2.5px', position: 'relative', zIndex: 1,
          }}>
            {/* Inner avatar box */}
            <Box sx={{
              width: '100%', height: '100%',
              borderRadius: { md: '26px', xl: '30px' },
              background: 'radial-gradient(circle at 30% 20%, rgba(255,144,57,0.06) 0%, #080808 60%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {!imgError ? (
                <img
                  src="/logotipo.png"
                  alt="Digital Scale"
                  style={{ width: '86%', height: '86%', objectFit: 'contain' }}
                  onError={() => setImgError(true)}
                />
              ) : (
                <Typography sx={{
                  fontWeight: 900, fontSize: '1.8rem',
                  background: 'linear-gradient(135deg, #ff9039, #ff5339)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>DS</Typography>
              )}
            </Box>
          </Box>

          {/* Online dot */}
          <Box sx={{
            position: 'absolute', bottom: 3, right: 3, zIndex: 2,
            width: 12, height: 12, borderRadius: '50%',
            bgcolor: '#00C47A', border: '2px solid #080808',
            animation: 'onlineDot 2.5s ease-in-out infinite',
          }} />
        </Box>

        {/* ── DS HUB title ── */}
        <Box sx={{ mt: 1.8, zIndex: 1, animation: 'hubGlow 3.2s ease-in-out infinite' }}>
          <Typography sx={{
            fontSize: { md: '1.32rem', xl: '1.55rem' },
            fontWeight: 900,
            letterSpacing: '0.2em',
            lineHeight: 1,
            background: 'linear-gradient(135deg, #ffffff 0%, #ffe8c0 20%, #ff9039 50%, #ff5339 80%, #cc2200 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textTransform: 'uppercase',
            userSelect: 'none',
            textAlign: 'center',
          }}>
            DS HUB
          </Typography>
        </Box>

        {/* ── Subtitle ── */}
        <Typography sx={{
          fontSize: { md: '0.46rem', xl: '0.52rem' },
          color: 'rgba(255,144,57,0.45)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontWeight: 600,
          mt: 0.4,
          userSelect: 'none',
          zIndex: 1,
          textAlign: 'center',
          lineHeight: 1.2,
        }}>
          Digital Scale Operating System
        </Typography>

        {/* ── Status indicators ── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, mt: 1.2, zIndex: 1, width: '100%', px: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#00C47A', flexShrink: 0, animation: 'onlineDot 2.5s ease-in-out infinite' }} />
            <Typography sx={{ fontSize: { md: '0.52rem', xl: '0.58rem' }, color: '#00C47A', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              System Online
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#b45aff', flexShrink: 0, animation: 'aiDot 2s ease-in-out infinite 0.8s' }} />
            <Typography sx={{ fontSize: { md: '0.52rem', xl: '0.58rem' }, color: '#b45aff', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Scale AI Active
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
