import { useEffect, useRef, useState } from 'react'

/**
 * AnimatedNumber — o número sobe até o valor com desaceleração (easeOutCubic),
 * como o keyframe `countUp` do tema, mas para QUALQUER valor dinâmico, não só na
 * montagem. Anima também quando o valor muda (12 → 15 conta a diferença).
 *
 * Uso: `<KpiCard value={<AnimatedNumber value={atrasados} />} />`.
 * Com formatação: `<AnimatedNumber value={1234} format={n => n.toLocaleString('pt-BR')} />`.
 */
interface AnimatedNumberProps {
  value: number
  /** Duração da subida em ms (default 700). */
  duration?: number
  /** Formata o inteiro exibido (moeda, milhar…). Sem isto, mostra o número cru. */
  format?: (n: number) => string
}

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function AnimatedNumber({ value, duration = 700, format }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)

  useEffect(() => {
    const from = fromRef.current
    if (from === value) return
    if (prefersReduced() || typeof requestAnimationFrame === 'undefined') {
      setDisplay(value); fromRef.current = value; return
    }
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic — desacelera no fim
      setDisplay(from + (value - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  const n = Math.round(display)
  return <>{format ? format(n) : n}</>
}
