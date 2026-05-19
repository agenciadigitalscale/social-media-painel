import { useEffect, useState } from 'react'
import { Box } from '@mui/material'

interface Props {
  onFinish: () => void
}

export default function SplashScreen({ onFinish }: Props) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600)
    const t2 = setTimeout(() => setPhase('exit'), 2400)
    const t3 = setTimeout(() => onFinish(), 3000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onFinish])

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      background: 'radial-gradient(ellipse 120% 80% at 50% 60%, #1a0a00 0%, #0d0010 55%, #000 100%)',
      opacity: phase === 'exit' ? 0 : 1,
      transition: phase === 'exit' ? 'opacity 0.6s cubic-bezier(0.4,0,0.2,1)' : 'none',
      '@keyframes smokeDrift': {
        '0%':   { transform: 'translateY(0) scale(1)', opacity: 0 },
        '20%':  { opacity: 0.35 },
        '80%':  { opacity: 0.18 },
        '100%': { transform: 'translateY(-120px) scale(1.6)', opacity: 0 },
      },
      '@keyframes particleFloat': {
        '0%':   { transform: 'translateY(0) translateX(0)', opacity: 0 },
        '30%':  { opacity: 1 },
        '100%': { transform: 'translateY(-180px) translateX(var(--dx, 20px))', opacity: 0 },
      },
      '@keyframes ringPulse': {
        '0%':   { transform: 'scale(0.85)', opacity: 0 },
        '50%':  { opacity: 0.35 },
        '100%': { transform: 'scale(1.25)', opacity: 0 },
      },
      '@keyframes logoEnter': {
        '0%':   { transform: 'scale(0.72) translateY(24px)', opacity: 0, filter: 'blur(18px) brightness(2)' },
        '60%':  { filter: 'blur(2px) brightness(1.4)' },
        '100%': { transform: 'scale(1) translateY(0)', opacity: 1, filter: 'blur(0) brightness(1)' },
      },
      '@keyframes glowPulse': {
        '0%,100%': { opacity: 0.5, transform: 'scale(1)' },
        '50%':     { opacity: 0.85, transform: 'scale(1.08)' },
      },
      '@keyframes shimmerText': {
        '0%':   { backgroundPosition: '-200% center' },
        '100%': { backgroundPosition: '200% center' },
      },
    }}>

      {/* ── Nebula smoke blobs ── */}
      {[
        { w: 420, h: 280, x: '10%', y: '55%', color: 'rgba(255,80,0,0.12)', delay: '0s', dur: '4.5s' },
        { w: 360, h: 240, x: '70%', y: '65%', color: 'rgba(120,0,200,0.14)', delay: '0.8s', dur: '5.2s' },
        { w: 300, h: 200, x: '45%', y: '70%', color: 'rgba(255,40,0,0.09)',  delay: '1.4s', dur: '4s'   },
        { w: 500, h: 320, x: '30%', y: '80%', color: 'rgba(80,0,160,0.10)',  delay: '0.3s', dur: '6s'   },
      ].map((s, i) => (
        <Box key={i} sx={{
          position: 'absolute',
          left: s.x, top: s.y,
          width: s.w, height: s.h,
          borderRadius: '50%',
          background: s.color,
          filter: 'blur(60px)',
          animation: `smokeDrift ${s.dur} ${s.delay} infinite ease-in-out`,
          transform: 'translate(-50%, -50%)',
        }} />
      ))}

      {/* ── Outer glow ring ── */}
      {[1, 1.4, 1.8].map((scale, i) => (
        <Box key={i} sx={{
          position: 'absolute',
          width: 340, height: 340,
          borderRadius: '50%',
          border: `1px solid ${i === 0 ? 'rgba(255,100,0,0.25)' : i === 1 ? 'rgba(180,0,255,0.18)' : 'rgba(255,50,0,0.12)'}`,
          animation: `ringPulse ${2.5 + i * 0.7}s ${i * 0.5}s infinite ease-out`,
          transform: `scale(${scale})`,
        }} />
      ))}

      {/* ── Glow behind logo ── */}
      <Box sx={{
        position: 'absolute',
        width: 280, height: 280,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,100,20,0.28) 0%, rgba(140,0,220,0.15) 55%, transparent 80%)',
        filter: 'blur(30px)',
        animation: 'glowPulse 2s 0.6s ease-in-out infinite',
      }} />

      {/* ── Floating particles ── */}
      {Array.from({ length: 18 }, (_, i) => {
        const angle = (i / 18) * Math.PI * 2
        const radius = 80 + Math.random() * 80
        const dx = Math.cos(angle) * (30 + Math.random() * 40)
        return (
          <Box key={i} sx={{
            position: 'absolute',
            width: 2 + Math.random() * 2.5,
            height: 2 + Math.random() * 2.5,
            borderRadius: '50%',
            bgcolor: i % 3 === 0 ? 'rgba(255,144,57,0.9)' : i % 3 === 1 ? 'rgba(180,90,255,0.85)' : 'rgba(255,60,0,0.8)',
            left: `calc(50% + ${Math.cos(angle) * radius}px)`,
            top: `calc(50% + ${Math.sin(angle) * radius}px)`,
            '--dx': `${dx}px`,
            animation: `particleFloat ${2.5 + Math.random() * 2}s ${Math.random() * 2}s infinite ease-out`,
          } as object} />
        )
      })}

      {/* ── Logo ── */}
      <Box sx={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5,
        animation: phase !== 'exit' ? 'logoEnter 0.9s cubic-bezier(0.16,1,0.3,1) forwards' : 'none',
        opacity: phase === 'enter' ? 0 : 1,
      }}>
        <Box
          component="img"
          src="/logotipo.png"
          alt="Digital Scale"
          sx={{
            width: { xs: 160, sm: 200 },
            height: 'auto',
            filter: 'drop-shadow(0 0 28px rgba(255,100,0,0.55)) drop-shadow(0 0 60px rgba(180,0,255,0.3))',
          }}
        />

        {/* ── Shimmer tagline ── */}
        <Box sx={{
          fontSize: { xs: '0.62rem', sm: '0.7rem' },
          fontWeight: 700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          background: 'linear-gradient(90deg, rgba(255,144,57,0.4) 0%, rgba(255,200,120,1) 40%, rgba(255,144,57,0.4) 60%, rgba(200,100,255,0.8) 80%, rgba(255,144,57,0.4) 100%)',
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'shimmerText 2.5s 0.5s linear infinite',
          userSelect: 'none',
        }}>
          Agência de Marketing Digital
        </Box>
      </Box>

      {/* ── Bottom gradient fade ── */}
      <Box sx={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
        pointerEvents: 'none',
      }} />
    </Box>
  )
}
