// Motion tokens — curvas e durações nomeadas por INTENÇÃO, não por número solto.
//
// O tema já traz `0.18s ease` como padrão de hover e os keyframes globais
// (fadeInUp, glowPulse, countUp). Isto aqui é o que faltava: um vocabulário de
// movimento reutilizável pelos primitivos (Pressable, Reveal, AnimatedNumber),
// para o desktop parar de reinventar transição inline em cada tela.
//
// Regra: escolher pela intenção ("é um toque" → tactile; "está entrando" →
// spring), nunca colar um cubic-bezier cru no componente.

export const MOTION = {
  ease: {
    /** Entrada spring-like — o mesmo que o CLAUDE.md já usa em entradas. */
    spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
    /** Toque tátil: leve overshoot ao soltar, dá sensação de física real. */
    tactile: 'cubic-bezier(0.34, 1.4, 0.5, 1)',
    /** Padrão do tema, para não destoar do resto. */
    standard: 'ease',
    /** Saída — acelera indo embora. */
    out: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  dur: {
    instant: 90,
    fast: 160,
    base: 220,
    slow: 340,
  },
} as const

/** `@media (prefers-reduced-motion: reduce)` neutralizado — colar no sx de qualquer primitivo. */
export const REDUCED_MOTION = {
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    transform: 'none',
    animation: 'none',
  },
} as const
