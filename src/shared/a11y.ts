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

/**
 * Igual ao `clickable`, para um controle que vive DENTRO de outro clicável —
 * o ✎ de renomear em cima do card, o checkbox na linha que também abre.
 *
 * Sem o `stopPropagation` os dois disparam no mesmo toque: renomear a coluna
 * abriria o roteiro junto. O `onPointerDown` existe pelo mesmo motivo no
 * contexto de arraste — o dnd-kit começa a arrastar no pointerdown, e sem
 * barrar ali um clique no botão vira um drag do card inteiro.
 */
export function clickableStop(onClick: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onPointerDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
    onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onClick() },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }
    },
  }
}
