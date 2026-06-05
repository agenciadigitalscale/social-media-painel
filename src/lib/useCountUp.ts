import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, duration = 700, enabled = true): number {
  const [value, setValue] = useState(0)
  const frameRef = useRef<number>(0)
  const startRef = useRef<number>(0)
  const startValRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) { setValue(target); return }
    startValRef.current = 0
    startRef.current = 0
    cancelAnimationFrame(frameRef.current)

    const step = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / duration, 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(startValRef.current + (target - startValRef.current) * eased))
      if (progress < 1) frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration, enabled])

  return value
}
