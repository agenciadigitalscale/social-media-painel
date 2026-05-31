import { useRef, useCallback } from 'react'
import type { SxProps, Theme } from '@mui/material'

// ── useTilt ───────────────────────────────────────────────
// On mousemove: applies 3D perspective tilt
// On mouseleave: resets smoothly with spring easing

export function useTilt(intensity = 10): {
  ref: React.RefObject<HTMLDivElement | null>
  handlers: {
    onMouseMove: React.MouseEventHandler<HTMLDivElement>
    onMouseLeave: React.MouseEventHandler<HTMLDivElement>
  }
} {
  const ref = useRef<HTMLDivElement | null>(null)

  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = useCallback((e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width  - 0.5   // -0.5 → 0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5
    const rotY =  x * intensity
    const rotX = -y * intensity
    el.style.transition = 'transform 0.18s ease'
    el.style.transform  = `perspective(900px) rotateY(${rotY}deg) rotateX(${rotX}deg) translateZ(6px)`
  }, [intensity])

  const onMouseLeave: React.MouseEventHandler<HTMLDivElement> = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.transition = 'transform 0.45s cubic-bezier(0.16,1,0.3,1)'
    el.style.transform  = 'perspective(900px) rotateY(0deg) rotateX(0deg) translateZ(0px)'
  }, [])

  return { ref, handlers: { onMouseMove, onMouseLeave } }
}

// ── glassRefractionSx ─────────────────────────────────────
// Adds a ::after pseudo-element — 1px top line simulating a glass window reflection

export const glassRefractionSx: SxProps<Theme> = {
  position: 'relative',
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '1px',
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.13) 30%, rgba(255,255,255,0.20) 50%, rgba(255,255,255,0.13) 70%, transparent)',
    pointerEvents: 'none',
    zIndex: 1,
    borderRadius: 'inherit',
  },
}

// ── microLiftSx ───────────────────────────────────────────
// Gentle lift on hover — consistent with the DS HUB motion language

export const microLiftSx: SxProps<Theme> = {
  transition: 'all 0.28s ease',
  '&:hover': {
    transform: 'translateY(-3px)',
    boxShadow: '0 10px 36px rgba(0,0,0,0.55)',
  },
}

// ── glassShimmerKeyframe ──────────────────────────────────
// @keyframes for a diagonal light sweep — use in sx as animation: 'glassShimmer ...'

export const glassShimmerKeyframe = {
  '@keyframes glassShimmer': {
    '0%':   { transform: 'translateX(-120%) skewX(-15deg)', opacity: 0 },
    '40%':  { opacity: 0.7 },
    '100%': { transform: 'translateX(220%) skewX(-15deg)', opacity: 0 },
  },
} as const
