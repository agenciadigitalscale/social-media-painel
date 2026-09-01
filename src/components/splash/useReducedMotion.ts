import { useEffect, useState } from 'react'

/**
 * O usuário pediu para o sistema parar de animar?
 *
 * O `CssBaseline` do tema já neutraliza `animation` e `transition` sob
 * `prefers-reduced-motion`, mas isso é CSS: não impede um canvas de continuar
 * desenhando 60 vezes por segundo nem o `mousemove` de seguir o cursor. Aqui a
 * preferência é lida em JavaScript para o laço nem chegar a existir.
 *
 * Escuta a mudança em vez de ler uma vez só: a pessoa pode ligar a preferência
 * no sistema com a aba aberta, e a tela de acesso costuma ficar aberta.
 */
export function useReducedMotion(): boolean {
  const [reduzido, setReduzido] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const ouvir = (e: MediaQueryListEvent) => setReduzido(e.matches)
    mq.addEventListener('change', ouvir)
    return () => mq.removeEventListener('change', ouvir)
  }, [])

  return reduzido
}
