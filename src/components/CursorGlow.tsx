import { useEffect, useRef } from 'react'
import { Box } from '@mui/material'

interface CursorGlowProps {
  color?: string
  size?: number
}

export default function CursorGlow({
  color = 'rgba(255,144,57,0.07)',
  size  = 400,
}: CursorGlowProps) {
  const glowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const glow   = glowRef.current
    if (!glow) return
    const parent = glow.parentElement
    if (!parent) return

    function onMove(e: MouseEvent) {
      if (!glow || !parent) return
      const rect = parent.getBoundingClientRect()
      const x = e.clientX - rect.left - size / 2
      const y = e.clientY - rect.top  - size / 2
      glow.style.transform   = `translate(${x}px, ${y}px)`
      glow.style.opacity     = '1'
    }

    function onLeave() {
      if (!glow) return
      glow.style.opacity = '0'
    }

    parent.addEventListener('mousemove', onMove)
    parent.addEventListener('mouseleave', onLeave)
    return () => {
      parent.removeEventListener('mousemove', onMove)
      parent.removeEventListener('mouseleave', onLeave)
    }
  }, [size])

  return (
    <Box
      ref={glowRef}
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width:  size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: 'blur(30px)',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0,
        transition: 'opacity 0.3s ease',
        willChange: 'transform',
      }}
    />
  )
}
