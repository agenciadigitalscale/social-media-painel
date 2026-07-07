import type { Transition, Variants } from 'framer-motion'

// Tokens de motion do app mobile. Springs nomeados (feel iOS) + durations 180–280ms.

export const spring: Record<'snappy' | 'gentle' | 'bouncy' | 'settle', Transition> = {
  snappy: { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 },
  gentle: { type: 'spring', stiffness: 300, damping: 30 },
  bouncy: { type: 'spring', stiffness: 440, damping: 20 },
  settle: { type: 'spring', stiffness: 600, damping: 30, mass: 0.9 },
}

export const dur = { fast: 0.18, base: 0.22, slow: 0.28 } as const
export const ease = [0.16, 1, 0.3, 1] as const // spring-like — entrada de elementos

export const fadeSlideUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: dur.base, ease } },
  exit:    { opacity: 0, y: 8, transition: { duration: dur.fast, ease } },
}

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: dur.base, ease } },
  exit:    { opacity: 0, scale: 0.97, transition: { duration: dur.fast, ease } },
}

// Transição entre telas do shell (deslize horizontal suave)
export const screenSwap: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: dur.slow, ease } },
  exit:    { opacity: 0, y: -6, transition: { duration: dur.fast, ease } },
}

// Lista com entrada escalonada (staggered)
export const listStagger: Variants = {
  animate: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
}
export const listItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: dur.base, ease } },
}
