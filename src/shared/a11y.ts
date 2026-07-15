import type { KeyboardEvent } from 'react'

/**
 * clickable(onClick) — torna um <Box>/<div> onClick acessível por teclado.
 * Espalhe no elemento: `<Box {...clickable(() => setTab(i))} sx={...}>`.
 * Adiciona role="button", tabIndex e ativação por Enter/Espaço. O foco visível
 * vem da regra global :focus-visible no theme (CssBaseline).
 */
export function clickable(onClick: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick()
      }
    },
  }
}
