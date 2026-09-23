import { Box, type BoxProps } from '@mui/material'
import { Children, useEffect, useRef, useState, type ReactNode } from 'react'
import { MOTION } from './tokens'

/**
 * Reveal — entrada com fade + subida sutil. Por padrão anima na montagem; com
 * `once` anima quando entra no viewport (lista longa que revela ao rolar).
 *
 * Substitui o `animation: fadeInUp ...` colado à mão em cada tela por um
 * primitivo que respeita `prefers-reduced-motion` de graça.
 */
interface RevealProps extends BoxProps {
  /** Atraso em ms — usado pelo Stagger para escalonar. */
  delay?: number
  /** Distância da subida (default 10px). */
  y?: number
  /** Anima só quando entra no viewport, uma vez. */
  once?: boolean
  children?: ReactNode
}

export function Reveal({ delay = 0, y = 10, once = false, sx, children, ...rest }: RevealProps) {
  const [shown, setShown] = useState(!once)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!once) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setShown(true); return }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); io.disconnect() }
    }, { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [once])

  return (
    <Box
      ref={ref}
      sx={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : `translateY(${y}px)`,
        transition: `opacity ${MOTION.dur.base}ms ${MOTION.ease.spring} ${delay}ms, transform ${MOTION.dur.base}ms ${MOTION.ease.spring} ${delay}ms`,
        '@media (prefers-reduced-motion: reduce)': { opacity: 1, transform: 'none', transition: 'none' },
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  )
}

/**
 * Stagger — envolve uma lista e faz cada filho entrar em cascata (delay
 * incremental). Cada filho vira um Reveal; o `step` é o intervalo entre eles.
 */
interface StaggerProps extends BoxProps {
  /** ms entre um filho e o próximo (default 45). */
  step?: number
  /** ms antes do primeiro (default 0). */
  initialDelay?: number
  once?: boolean
  y?: number
  children?: ReactNode
}

export function Stagger({ step = 45, initialDelay = 0, once = false, y = 10, children, ...rest }: StaggerProps) {
  return (
    <Box {...rest}>
      {Children.toArray(children).map((child, i) => (
        <Reveal key={i} delay={initialDelay + i * step} once={once} y={y}>
          {child}
        </Reveal>
      ))}
    </Box>
  )
}
