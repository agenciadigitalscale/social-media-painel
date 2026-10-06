/**
 * Esteira na altura da tela + arrastar pelo fundo (2026-10-06).
 *
 * 1. ALTURA. A esteira mora dentro da área rolável da aba, que não tem altura
 *    fixa: uma coluna com 99 cards esticava a página inteira (medido: 11.723 px).
 *    Aqui a esteira ganha a altura que sobra na tela abaixo dela — e cada coluna
 *    passa a rolar sozinha, com o cabeçalho (nome, total, menu) parado no topo.
 *
 * 2. ARRASTAR O FUNDO. Segurar o fundo/espaço vazio e arrastar move a esteira
 *    para os lados ("grab"). Começar em cima de um CARD (ou botão, campo, link)
 *    não faz nada aqui — o arraste de card continua sendo do dnd-kit.
 */
import { useEffect, useLayoutEffect, type RefObject } from 'react'

/** Onde o arraste de fundo NÃO começa: card, controles e campos. */
const NAO_PUXA = '[data-kanban-card], button, a, input, textarea, select, [role=button], [role=menuitem], [role=combobox], .MuiChip-root'

function paiRolavel(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll') && p.clientHeight > 0) return p
  }
  return null
}

export function useEsteira(ref: RefObject<HTMLDivElement | null>, opts: { folgaBaixo?: number; minimo?: number; ativo?: boolean } = {}) {
  const { folgaBaixo = 40, minimo = 380, ativo = true } = opts

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !ativo) return
    let ultimo = -1
    const medir = () => {
      const pai = paiRolavel(el)
      const visivel = pai ? pai.clientHeight : window.innerHeight
      const topoNoPai = pai
        ? el.getBoundingClientRect().top - pai.getBoundingClientRect().top + pai.scrollTop
        : el.getBoundingClientRect().top + window.scrollY
      // Cabe na tela quando a área está no topo; se o que vem acima for muito alto,
      // usa pelo menos `minimo` (a página rola um pouco e a esteira fica inteira).
      const h = Math.max(minimo, Math.round(visivel - topoNoPai - folgaBaixo))
      if (h !== ultimo) { ultimo = h; el.style.height = `${h}px` }
    }
    medir()
    const ro = new ResizeObserver(medir)
    const pai = paiRolavel(el)
    if (pai) { ro.observe(pai); if (pai.firstElementChild) ro.observe(pai.firstElementChild) }
    window.addEventListener('resize', medir)
    return () => { ro.disconnect(); window.removeEventListener('resize', medir); el.style.height = '' }
  }, [ref, folgaBaixo, minimo, ativo])

  useEffect(() => {
    const el = ref.current
    if (!el || !ativo) return
    let inicioX = 0, inicioScroll = 0, puxando = false, pointerId = -1
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || e.pointerType === 'touch') return
      if ((e.target as HTMLElement).closest(NAO_PUXA)) return
      puxando = true; pointerId = e.pointerId
      inicioX = e.clientX; inicioScroll = el.scrollLeft
      el.style.cursor = 'grabbing'; el.style.userSelect = 'none'
    }
    const move = (e: PointerEvent) => {
      if (!puxando || e.pointerId !== pointerId) return
      el.scrollLeft = inicioScroll - (e.clientX - inicioX)
    }
    const up = () => {
      if (!puxando) return
      puxando = false; el.style.cursor = ''; el.style.userSelect = ''
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [ref, ativo])
}
