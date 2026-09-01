/* SplashBackdrop — o fundo da tela de acesso: logo gigante, estrelas, fumaça
   e partículas.

   ── Por que laranja aqui, se o painel é azul ──────────────────────────
   O DS HUB é azul/ciano e o manual proíbe laranja como acento. Esta tela é a
   EXCEÇÃO já registrada: ela é a capa da agência, não o produto — as cores são
   as do logotipo da Digital Scale (foguete laranja, rastro amarelo), a mesma
   razão pela qual o `LoginGate.tsx` é laranja de propósito. Não "corrigir"
   para azul achando que é resíduo do redesign.

   ── Por que mix-blend-mode: screen ────────────────────────────────────
   `public/brand/digital-scale-logo.png` é a arte oficial e é RGB SEM CANAL
   ALFA: o fundo dela é preto sólido, não transparente. Colada direto, ela
   apareceria como um quadrado preto no meio da tela. Com `screen`, preto vira
   neutro (não soma luz) e só o foguete, o rastro e o texto acendem sobre o
   fundo. É por isso que o fundo da página precisa ser escuro — em fundo claro
   este truque não funciona.

   ── Custo ─────────────────────────────────────────────────────────────
   Um canvas só, `requestAnimationFrame`, devicePixelRatio limitado a 2, e o
   laço PARA quando a aba fica oculta. Sob `prefers-reduced-motion` o canvas
   nem é criado: sobra a logo parada.

   Nada aqui recebe clique: a camada inteira é `pointer-events: none`, senão
   ela ficaria por cima dos cards de usuário e engoliria o login.
*/
import { useCallback, useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { useReducedMotion } from './useReducedMotion'

/** Paleta da marca — só vale nesta tela. Ver o cabeçalho. */
export const CAPA = {
  fundo:    '#030711',
  marinho:  '#07101F',
  laranja:  '#FF7200',
  amarelo:  '#FFD500',
  branco:   '#FFFFFF',
  cinza:    '#94A3B8',
} as const

/* Ajustes rápidos — os quatro números que se mexe na prática. */
const AJUSTES = {
  /** Altura da logo de fundo, em vh. */
  alturaLogoVh: 66,
  /** Opacidade da logo de fundo (0–1). */
  opacidadeLogo: 0.16,
  /** Quantas partículas laranjas flutuam ao mesmo tempo no desktop. */
  particulas: 16,
  /** Quantos sopros de fumaça ao mesmo tempo. */
  fumaca: 7,
}

/* Onde o foguete está DENTRO da arte quadrada, em fração de 0–1. Medido na
   imagem: o corpo do foguete ocupa mais ou menos x 27–49%, y 20–38%. É daqui
   que saem o glow, a fumaça e as partículas — se a arte for trocada por outra
   com enquadramento diferente, é este par que muda. */
const FOGUETE = { x: 0.38, y: 0.29 }

interface Particula {
  x: number; y: number; vx: number; vy: number
  vida: number; vidaMax: number; raio: number; tipo: 'brasa' | 'fumaca'
}

interface Estrela { x: number; y: number; r: number; fase: number; brilho: number }

/** Interpolação suave — o cursor puxa, a logo segue com atraso. */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export default function SplashBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const caixaRef  = useRef<HTMLDivElement | null>(null)
  const reduzido  = useReducedMotion()

  // O alvo vem do mouse; o atual persegue o alvo. Ficam em ref porque mudam a
  // 60fps — em estado, re-renderizariam a árvore inteira a cada movimento.
  const alvo   = useRef({ x: 0, y: 0 })
  const atual  = useRef({ x: 0, y: 0 })
  const impulso = useRef(0)        // 0–1, o empurrão do foguete depois do clique
  const [, forcar] = useState(0)

  const particulas = useRef<Particula[]>([])
  const estrelas   = useRef<Estrela[]>([])
  const ondas      = useRef<{ x: number; y: number; t: number }[]>([])
  const rafRef     = useRef<number | null>(null)
  const logoRef    = useRef<HTMLImageElement | null>(null)

  // ── O clique: onda + impulso do foguete + brasas ────────────────────
  const estourar = useCallback((cx: number, cy: number) => {
    if (reduzido) return
    ondas.current.push({ x: cx, y: cy, t: 0 })
    impulso.current = 1
    const caixa = caixaRef.current
    if (!caixa) return
    const r = caixa.getBoundingClientRect()
    const fx = r.width * FOGUETE.x
    const fy = r.height * FOGUETE.y
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2
      const vel = 0.4 + Math.random() * 1.1
      particulas.current.push({
        x: fx + (Math.random() - 0.5) * 40,
        y: fy + (Math.random() - 0.5) * 40,
        vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 0.5,
        vida: 0, vidaMax: 60 + Math.random() * 50,
        raio: 1 + Math.random() * 2, tipo: 'brasa',
      })
    }
    forcar(n => n + 1)
  }, [reduzido])

  // ── Mouse ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (reduzido) return
    const mover = (e: MouseEvent) => {
      const w = window.innerWidth, h = window.innerHeight
      // -1..1 em cada eixo, a partir do centro da tela.
      alvo.current = { x: (e.clientX / w) * 2 - 1, y: (e.clientY / h) * 2 - 1 }
    }
    window.addEventListener('mousemove', mover, { passive: true })
    return () => window.removeEventListener('mousemove', mover)
  }, [reduzido])

  // ── Clique em qualquer lugar do fundo ───────────────────────────────
  // Escuta no window em vez de um elemento próprio: a camada é
  // pointer-events:none e não recebe evento nenhum por conta própria. Assim o
  // clique no painel continua fazendo login E também solta a onda.
  useEffect(() => {
    if (reduzido) return
    const clicar = (e: MouseEvent) => estourar(e.clientX, e.clientY)
    window.addEventListener('click', clicar)
    return () => window.removeEventListener('click', clicar)
  }, [estourar, reduzido])

  // ── O laço ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (reduzido) return
    const canvas = canvasRef.current
    const caixa = caixaRef.current
    if (!canvas || !caixa) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let larg = 0, alt = 0
    // Teto de 2: em telas 3x o canvas quadruplicaria de área sem ganho visível
    // numa imagem que é toda blur e opacidade baixa.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const poucos = window.innerWidth < 700

    const medir = () => {
      const r = caixa.getBoundingClientRect()
      larg = r.width; alt = r.height
      canvas.width = Math.floor(larg * dpr)
      canvas.height = Math.floor(alt * dpr)
      canvas.style.width = `${larg}px`
      canvas.style.height = `${alt}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const qtd = poucos ? 26 : 60
      estrelas.current = Array.from({ length: qtd }, () => ({
        x: Math.random() * larg, y: Math.random() * alt,
        r: Math.random() * 1.1 + 0.3,
        fase: Math.random() * Math.PI * 2,
        brilho: 0.25 + Math.random() * 0.5,
      }))
    }
    medir()
    window.addEventListener('resize', medir)

    const tetoParticulas = poucos ? Math.round(AJUSTES.particulas / 2) : AJUSTES.particulas
    const tetoFumaca     = poucos ? Math.round(AJUSTES.fumaca / 2) : AJUSTES.fumaca

    const nascer = (tipo: 'brasa' | 'fumaca'): Particula => {
      const fx = larg * FOGUETE.x, fy = alt * FOGUETE.y
      const espalha = tipo === 'fumaca' ? 70 : 110
      return {
        x: fx + (Math.random() - 0.5) * espalha,
        y: fy + (Math.random() - 0.5) * espalha + (tipo === 'fumaca' ? 30 : 0),
        vx: (Math.random() - 0.5) * 0.22,
        vy: -0.10 - Math.random() * 0.28,
        vida: 0,
        vidaMax: tipo === 'fumaca' ? 260 + Math.random() * 160 : 150 + Math.random() * 130,
        raio: tipo === 'fumaca' ? 26 + Math.random() * 34 : 1 + Math.random() * 1.8,
        tipo,
      }
    }

    let t = 0
    let rodando = true

    const quadro = () => {
      if (!rodando) return
      t++
      ctx.clearRect(0, 0, larg, alt)

      // Estrelas — piscam devagar e fora de fase, senão a tela inteira pulsa junta.
      for (const e of estrelas.current) {
        const a = e.brilho * (0.6 + 0.4 * Math.sin(t * 0.012 + e.fase))
        ctx.globalAlpha = a
        ctx.fillStyle = CAPA.branco
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1

      // Repõe o que morreu, sem estourar o teto.
      const nFumaca = particulas.current.filter(p => p.tipo === 'fumaca').length
      const nBrasa  = particulas.current.filter(p => p.tipo === 'brasa').length
      if (nFumaca < tetoFumaca && t % 26 === 0) particulas.current.push(nascer('fumaca'))
      if (nBrasa  < tetoParticulas && t % 14 === 0) particulas.current.push(nascer('brasa'))

      const vivas: Particula[] = []
      for (const p of particulas.current) {
        p.vida++
        p.x += p.vx; p.y += p.vy
        if (p.tipo === 'fumaca') { p.vx *= 0.995; p.raio += 0.16 }
        const k = 1 - p.vida / p.vidaMax
        if (k <= 0) continue
        vivas.push(p)

        if (p.tipo === 'fumaca') {
          // Fumaça = gradiente radial bem apagado. Blur de verdade custaria um
          // filtro por sopro; o gradiente dá a mesma leitura de graça.
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.raio)
          g.addColorStop(0, `rgba(255,150,60,${0.05 * k})`)
          g.addColorStop(1, 'rgba(255,150,60,0)')
          ctx.fillStyle = g
          ctx.beginPath(); ctx.arc(p.x, p.y, p.raio, 0, Math.PI * 2); ctx.fill()
        } else {
          ctx.globalAlpha = k * 0.85
          ctx.fillStyle = Math.random() > 0.65 ? CAPA.amarelo : CAPA.laranja
          ctx.shadowBlur = 8
          ctx.shadowColor = CAPA.laranja
          ctx.beginPath(); ctx.arc(p.x, p.y, p.raio, 0, Math.PI * 2); ctx.fill()
          ctx.shadowBlur = 0
          ctx.globalAlpha = 1
        }
      }
      particulas.current = vivas

      // Ondas do clique.
      ondas.current = ondas.current.filter(o => {
        o.t += 0.022
        if (o.t >= 1) return false
        const raio = o.t * 190
        ctx.globalAlpha = (1 - o.t) * 0.4
        ctx.strokeStyle = CAPA.laranja
        ctx.lineWidth = 2 * (1 - o.t) + 0.4
        ctx.beginPath(); ctx.arc(o.x, o.y, raio, 0, Math.PI * 2); ctx.stroke()
        ctx.globalAlpha = 1
        return true
      })

      // A logo persegue o cursor. Fator baixo (0.055) = atraso perceptível,
      // que é o que faz parecer peso em vez de colagem no mouse.
      atual.current.x = lerp(atual.current.x, alvo.current.x, 0.055)
      atual.current.y = lerp(atual.current.y, alvo.current.y, 0.055)
      impulso.current = lerp(impulso.current, 0, 0.045)

      const img = logoRef.current
      if (img) {
        const dx = atual.current.x * 11 + impulso.current * 16
        const dy = atual.current.y * 11 - impulso.current * 20
        const rot = atual.current.x * 1
        const esc = 1 + Math.abs(atual.current.x) * 0.012 + impulso.current * 0.02
        const flutua = Math.sin(t * 0.006) * 7
        img.style.transform =
          `translate3d(${dx}px, ${dy + flutua}px, 0) rotate(${rot}deg) scale(${esc})`
        // O glow respira sozinho e ganha força com o cursor e com o clique.
        const respiro = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.0085))
        img.style.setProperty('--forca-glow', String(respiro + impulso.current * 0.6))
      }

      rafRef.current = requestAnimationFrame(quadro)
    }
    rafRef.current = requestAnimationFrame(quadro)

    // Aba escondida não anima: rAF já costuma ser suspenso, mas o listener
    // garante que nada fique acumulando ao voltar.
    const visibilidade = () => {
      if (document.hidden) {
        rodando = false
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      } else if (!rodando) {
        rodando = true
        rafRef.current = requestAnimationFrame(quadro)
      }
    }
    document.addEventListener('visibilitychange', visibilidade)

    return () => {
      rodando = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', medir)
      document.removeEventListener('visibilitychange', visibilidade)
      particulas.current = []
      ondas.current = []
    }
  }, [reduzido])

  return (
    <Box
      ref={caixaRef}
      aria-hidden
      sx={{
        position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden',
        // A camada inteira é inerte. Sem isto ela cobriria os cards de usuário.
        pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 90% 60% at 50% 42%, ${CAPA.marinho} 0%, transparent 70%),
          radial-gradient(ellipse 60% 45% at 50% 50%, rgba(255,114,0,0.045) 0%, transparent 68%),
          ${CAPA.fundo}
        `,
      }}
    >
      {/* Logo gigante ao fundo. `screen` neutraliza o preto da arte. */}
      <Box
        component="img"
        ref={logoRef}
        src="/brand/digital-scale-logo.png"
        alt=""
        sx={{
          position: 'absolute', left: '50%', top: '46%',
          height: { xs: `${AJUSTES.alturaLogoVh * 0.72}vh`, md: `${AJUSTES.alturaLogoVh}vh` },
          maxWidth: { xs: '90vw', md: '82vw' },
          width: 'auto', objectFit: 'contain',
          marginLeft: 'auto', marginRight: 'auto',
          translate: '-50% -50%',
          opacity: AJUSTES.opacidadeLogo,
          mixBlendMode: 'screen',
          // `screen` sozinho não basta: o "preto" da arte não é #000 puro — ela
          // traz um campo de estrelas discreto — e o resto do quadrado acabava
          // clareando o suficiente para desenhar uma borda reta no meio da tela.
          // A máscara radial dissolve as quinas e deixa só o foguete e o texto.
          maskImage: 'radial-gradient(ellipse 62% 62% at 50% 48%, #000 42%, transparent 76%)',
          WebkitMaskImage: 'radial-gradient(ellipse 62% 62% at 50% 48%, #000 42%, transparent 76%)',
          willChange: 'transform',
          transition: reduzido ? 'none' : 'opacity 0.8s ease',
          '--forca-glow': '0.7',
          filter: reduzido
            ? 'none'
            : `drop-shadow(0 0 calc(28px * var(--forca-glow)) rgba(255,114,0,0.42))
               drop-shadow(0 0 calc(64px * var(--forca-glow)) rgba(255,213,0,0.18))`,
        }}
      />

      {/* Fumaça, brasas, estrelas e a onda do clique. */}
      {!reduzido && (
        <Box
          component="canvas"
          ref={canvasRef}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      )}

      {/* Vinheta: escurece as bordas e joga o olho para o painel no centro. */}
      <Box sx={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 75% 65% at 50% 50%, transparent 40%, ${CAPA.fundo} 100%)`,
      }} />
    </Box>
  )
}
