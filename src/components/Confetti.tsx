import { useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import { DS } from '../theme'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  rotation: number
  rotationSpeed: number
  size: number
  opacity: number
  shape: 'rect' | 'circle' | 'star'
  lifetime: number
  age: number
}

// Sorteado por peça: valor repetido só desequilibra a mistura (o azul saía o
// dobro das outras cores — outro resto do redesign laranja→azul).
const COLORS = [
  DS.accent, DS.amber, DS.green,
  DS.red, DS.purpleSoft, DS.pink, '#fff',
  DS.cyan, '#00E5FF',
]

interface Props {
  active: boolean
  onDone?: () => void
  /** Number of particles (default 120) */
  count?: number
}

export default function Confetti({ active, onDone, count = 120 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number | null>(null)
  const particles = useRef<Particle[]>([])

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    // Spawn particles from top with slight fan
    particles.current = Array.from({ length: count }, () => {
      const x = canvas.width * (0.2 + Math.random() * 0.6)
      return {
        x,
        y: -10,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 4 + 3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 8 + 4,
        opacity: 1,
        shape: (['rect', 'circle', 'star'] as const)[Math.floor(Math.random() * 3)],
        lifetime: 180 + Math.random() * 80,
        age: 0,
      }
    })

    function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = (i * 4 * Math.PI) / 5 - Math.PI / 2
        const b = (i * 4 * Math.PI) / 5 + (2 * Math.PI) / 5 - Math.PI / 2
        ctx[i === 0 ? 'moveTo' : 'lineTo'](x + r * Math.cos(a), y + r * Math.sin(a))
        ctx.lineTo(x + (r / 2.5) * Math.cos(b), y + (r / 2.5) * Math.sin(b))
      }
      ctx.closePath()
      ctx.fill()
    }

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      let alive = false
      particles.current.forEach(p => {
        if (p.age > p.lifetime) return
        alive = true
        p.age++
        p.x  += p.vx
        p.y  += p.vy
        p.vy += 0.12  // gravity
        p.vx *= 0.995 // air resistance
        p.rotation += p.rotationSpeed
        p.opacity = Math.max(0, 1 - (p.age / p.lifetime) * 1.2)

        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.fillStyle   = p.color
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        } else if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          drawStar(ctx, 0, 0, p.size / 2)
        }

        ctx.restore()
      })

      if (alive) {
        animRef.current = requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        onDone?.()
      }
    }

    animRef.current = requestAnimationFrame(tick)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [active, count, onDone])

  if (!active) return null

  return (
    <Box
      component="canvas"
      ref={canvasRef}
      sx={{
        position: 'fixed', inset: 0, zIndex: 9998,
        pointerEvents: 'none',
        width: '100vw', height: '100vh',
      }}
    />
  )
}
