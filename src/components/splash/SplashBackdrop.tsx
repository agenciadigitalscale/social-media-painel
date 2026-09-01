/* SplashBackdrop — o fundo da tela de acesso.

   Camadas, de trás para a frente:
     1. base azul petróleo + gradiente de luminosidade
     2. glow laranja queimado no canto superior esquerdo (a cor do foguete)
     3. glow azul-arroxeado no canto inferior direito (só profundidade)
     4. grade tecnológica em opacidade muito baixa
     5. granulação fina (SVG turbulence, sem requisição)
     6. a logo oficial, grande, em `screen` + máscara radial
     7. canvas: partículas espaciais lentas, brasas perto do foguete, onda do clique
     8. vinheta, que puxa o olho para o painel

   ── Por que `mix-blend-mode: screen` e ainda uma máscara ──────────────
   `public/brand/digital-scale-logo.png` é a arte oficial e é RGB SEM CANAL
   ALFA: o fundo dela é preto sólido. Colada direto, apareceria como um
   quadrado no meio da tela. Com `screen`, preto vira neutro. Só que o preto
   dela não é #000 puro — traz um campo de estrelas discreto —, e sobrava uma
   borda reta visível. A máscara radial dissolve as quinas. Conferido no
   navegador: sem a máscara, o quadrado aparece.

   ── Custo ─────────────────────────────────────────────────────────────
   Um canvas só, `requestAnimationFrame`, devicePixelRatio limitado a 2, e o
   laço PARA quando a aba fica oculta. Sob `prefers-reduced-motion` o canvas
   nem é criado: sobra o fundo estático.

   Nada aqui recebe clique: a camada é `pointer-events: none`, senão cobriria
   os cards de perfil e engoliria o login.
*/
import { useCallback, useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { useReducedMotion } from './useReducedMotion'
import { CAPA, RUIDO_URI } from './palette'

export { CAPA } from './palette'

/* Os quatro números que se mexe na prática. */
const AJUSTES = {
  /** Altura da logo de fundo, em vh. */
  alturaLogoVh: 62,
  /** Opacidade da logo de fundo (0–1). */
  opacidadeLogo: 0.13,
  /** Partículas espaciais simultâneas no desktop. */
  particulas: 14,
  /** Sopros de fumaça simultâneos. */
  fumaca: 6,
}

/* Onde o foguete está DENTRO da arte quadrada, em fração de 0–1. Daqui saem o
   glow, a fumaça e as brasas — se a arte mudar de enquadramento, muda aqui. */
const FOGUETE = { x: 0.38, y: 0.29 }

interface Particula {
  x: number; y: number; vx: number; vy: number
  vida: number; vidaMax: number; raio: number; tipo: 'brasa' | 'fumaca' | 'poeira'
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export default function SplashBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const caixaRef  = useRef<HTMLDivElement | null>(null)
  const reduzido  = useReducedMotion()

  // Alvo vem do mouse, atual persegue o alvo. Em ref porque mudam a 60fps — em
  // estado, re-renderizariam a árvore inteira a cada movimento do cursor.
  const alvo    = useRef({ x: 0, y: 0 })
  const atual   = useRef({ x: 0, y: 0 })
  const impulso = useRef(0)
  const [, forcar] = useState(0)

  const particulas = useRef<Particula[]>([])
  const ondas      = useRef<{ x: number; y: number; t: number }[]>([])
  const rafRef     = useRef<number | null>(null)
  const logoRef    = useRef<HTMLImageElement | null>(null)

  const estourar = useCallback((cx: number, cy: number) => {
    if (reduzido) return
    ondas.current.push({ x: cx, y: cy, t: 0 })
    impulso.current = 1
    const caixa = caixaRef.current
    if (!caixa) return
    const r = caixa.getBoundingClientRect()
    const fx = r.width * FOGUETE.x
    const fy = r.height * FOGUETE.y
    for (let i = 0; i < 9; i++) {
      const ang = Math.random() * Math.PI * 2
      const vel = 0.4 + Math.random() * 1.1
      particulas.current.push({
        x: fx + (Math.random() - 0.5) * 40,
        y: fy + (Math.random() - 0.5) * 40,
        vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 0.5,
        vida: 0, vidaMax: 55 + Math.random() * 45,
        raio: 1 + Math.random() * 1.8, tipo: 'brasa',
      })
    }
    forcar(n => n + 1)
  }, [reduzido])

  useEffect(() => {
    if (reduzido) return
    const mover = (e: MouseEvent) => {
      alvo.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      }
    }
    window.addEventListener('mousemove', mover, { passive: true })
    return () => window.removeEventListener('mousemove', mover)
  }, [reduzido])

  // Escuta no window porque a camada é pointer-events:none e não recebe evento
  // próprio. Assim o clique no painel continua fazendo login E solta a onda.
  useEffect(() => {
    if (reduzido) return
    const clicar = (e: MouseEvent) => estourar(e.clientX, e.clientY)
    window.addEventListener('click', clicar)
    return () => window.removeEventListener('click', clicar)
  }, [estourar, reduzido])

  useEffect(() => {
    if (reduzido) return
    const canvas = canvasRef.current
    const caixa = caixaRef.current
    if (!canvas || !caixa) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let larg = 0, alt = 0
    // Teto de 2: em telas 3x o canvas quadruplicaria de área sem ganho visível
    // numa imagem que é toda opacidade baixa.
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
    }
    medir()
    window.addEventListener('resize', medir)

    const tetoBrasa  = poucos ? Math.round(AJUSTES.particulas / 2) : AJUSTES.particulas
    const tetoFumaca = poucos ? Math.round(AJUSTES.fumaca / 2) : AJUSTES.fumaca
    const tetoPoeira = poucos ? 14 : 34

    const nascer = (tipo: Particula['tipo']): Particula => {
      if (tipo === 'poeira') {
        // Poeira espacial: nasce em qualquer lugar e atravessa a tela devagar.
        return {
          x: Math.random() * larg, y: Math.random() * alt,
          vx: (Math.random() - 0.5) * 0.09, vy: -0.02 - Math.random() * 0.06,
          vida: 0, vidaMax: 700 + Math.random() * 700,
          raio: 0.4 + Math.random() * 0.9, tipo,
        }
      }
      const fx = larg * FOGUETE.x, fy = alt * FOGUETE.y
      const espalha = tipo === 'fumaca' ? 70 : 110
      return {
        x: fx + (Math.random() - 0.5) * espalha,
        y: fy + (Math.random() - 0.5) * espalha + (tipo === 'fumaca' ? 30 : 0),
        vx: (Math.random() - 0.5) * 0.2,
        vy: -0.09 - Math.random() * 0.25,
        vida: 0,
        vidaMax: tipo === 'fumaca' ? 260 + Math.random() * 160 : 150 + Math.random() * 120,
        raio: tipo === 'fumaca' ? 26 + Math.random() * 32 : 1 + Math.random() * 1.6,
        tipo,
      }
    }

    // A poeira já começa espalhada — nascendo aos poucos, a tela abriria vazia.
    particulas.current = Array.from({ length: tetoPoeira }, () => {
      const p = nascer('poeira')
      p.vida = Math.random() * p.vidaMax * 0.6
      return p
    })

    let t = 0
    let rodando = true

    const quadro = () => {
      if (!rodando) return
      t++
      ctx.clearRect(0, 0, larg, alt)

      const contar = (tipo: Particula['tipo']) =>
        particulas.current.reduce((n, p) => n + (p.tipo === tipo ? 1 : 0), 0)
      if (contar('poeira') < tetoPoeira && t % 40 === 0) particulas.current.push(nascer('poeira'))
      if (contar('fumaca') < tetoFumaca && t % 26 === 0) particulas.current.push(nascer('fumaca'))
      if (contar('brasa')  < tetoBrasa  && t % 15 === 0) particulas.current.push(nascer('brasa'))

      const vivas: Particula[] = []
      for (const p of particulas.current) {
        p.vida++
        p.x += p.vx; p.y += p.vy
        if (p.tipo === 'fumaca') { p.vx *= 0.995; p.raio += 0.15 }
        const k = 1 - p.vida / p.vidaMax
        if (k <= 0) continue
        vivas.push(p)

        if (p.tipo === 'fumaca') {
          // Gradiente radial em vez de blur real: mesma leitura, sem um filtro
          // por sopro (que é o que custa caro num canvas).
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.raio)
          g.addColorStop(0, `rgba(255,140,60,${0.042 * k})`)
          g.addColorStop(1, 'rgba(255,140,60,0)')
          ctx.fillStyle = g
          ctx.beginPath(); ctx.arc(p.x, p.y, p.raio, 0, Math.PI * 2); ctx.fill()
        } else if (p.tipo === 'poeira') {
          // Entra e sai em fade — poeira que some de repente vira cintilação.
          ctx.globalAlpha = Math.min(1, k * 3, (p.vida / p.vidaMax) * 6) * 0.34
          ctx.fillStyle = CAPA.t2
          ctx.beginPath(); ctx.arc(p.x, p.y, p.raio, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = 1
        } else {
          ctx.globalAlpha = k * 0.8
          ctx.fillStyle = Math.random() > 0.7 ? CAPA.amarelo : CAPA.laranja
          ctx.shadowBlur = 8
          ctx.shadowColor = CAPA.laranja
          ctx.beginPath(); ctx.arc(p.x, p.y, p.raio, 0, Math.PI * 2); ctx.fill()
          ctx.shadowBlur = 0
          ctx.globalAlpha = 1
        }
      }
      particulas.current = vivas

      ondas.current = ondas.current.filter(o => {
        o.t += 0.024
        if (o.t >= 1) return false
        ctx.globalAlpha = (1 - o.t) * 0.34
        ctx.strokeStyle = CAPA.laranja
        ctx.lineWidth = 2 * (1 - o.t) + 0.4
        ctx.beginPath(); ctx.arc(o.x, o.y, o.t * 180, 0, Math.PI * 2); ctx.stroke()
        ctx.globalAlpha = 1
        return true
      })

      // Fator baixo = atraso perceptível, que é o que faz parecer peso em vez
      // de a logo estar colada no cursor.
      atual.current.x = lerp(atual.current.x, alvo.current.x, 0.055)
      atual.current.y = lerp(atual.current.y, alvo.current.y, 0.055)
      impulso.current = lerp(impulso.current, 0, 0.045)

      const img = logoRef.current
      if (img) {
        const dx = atual.current.x * 10 + impulso.current * 15
        const dy = atual.current.y * 10 - impulso.current * 19
        const flutua = Math.sin(t * 0.006) * 6
        img.style.transform =
          `translate3d(${dx}px, ${dy + flutua}px, 0) rotate(${atual.current.x}deg) ` +
          `scale(${1 + Math.abs(atual.current.x) * 0.012 + impulso.current * 0.02})`
        const respiro = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.0085))
        img.style.setProperty('--forca-glow', String(respiro + impulso.current * 0.6))
      }

      rafRef.current = requestAnimationFrame(quadro)
    }
    rafRef.current = requestAnimationFrame(quadro)

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
        pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 78% 62% at 14% 8%,  rgba(255,122,0,0.10) 0%, transparent 62%),
          radial-gradient(ellipse 70% 60% at 88% 92%, rgba(76,74,158,0.16) 0%, transparent 62%),
          radial-gradient(ellipse 120% 90% at 50% 42%, ${CAPA.fundoAlto} 0%, ${CAPA.fundo} 68%),
          ${CAPA.fundo}
        `,
      }}
    >
      {/* Grade tecnológica. Precisa ser quase invisível: acima de ~0.05 de
          opacidade ela vira papel milimetrado e o fundo perde a profundidade. */}
      <Box sx={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(${CAPA.t2} 1px, transparent 1px),
          linear-gradient(90deg, ${CAPA.t2} 1px, transparent 1px)
        `,
        backgroundSize: '68px 68px',
        opacity: 0.028,
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, #000 20%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, #000 20%, transparent 80%)',
      }} />

      {/* Granulação — tira o aspecto plástico do gradiente. */}
      <Box sx={{
        position: 'absolute', inset: 0,
        backgroundImage: RUIDO_URI,
        opacity: 0.05,
        mixBlendMode: 'overlay',
      }} />

      {/* A logo oficial. `screen` neutraliza o preto da arte; a máscara mata a
          borda quadrada que sobra do campo de estrelas dela. */}
      <Box
        component="img"
        ref={logoRef}
        src="/brand/digital-scale-logo.png"
        alt=""
        sx={{
          position: 'absolute', left: '50%', top: '46%',
          height: { xs: `${AJUSTES.alturaLogoVh * 0.7}vh`, md: `${AJUSTES.alturaLogoVh}vh` },
          maxWidth: { xs: '90vw', md: '80vw' },
          width: 'auto', objectFit: 'contain',
          translate: '-50% -50%',
          opacity: AJUSTES.opacidadeLogo,
          mixBlendMode: 'screen',
          maskImage: 'radial-gradient(ellipse 62% 62% at 50% 48%, #000 42%, transparent 76%)',
          WebkitMaskImage: 'radial-gradient(ellipse 62% 62% at 50% 48%, #000 42%, transparent 76%)',
          willChange: 'transform',
          '--forca-glow': '0.7',
          filter: reduzido
            ? 'none'
            : `drop-shadow(0 0 calc(26px * var(--forca-glow)) rgba(255,122,0,0.34))
               drop-shadow(0 0 calc(60px * var(--forca-glow)) rgba(255,213,77,0.14))`,
        }}
      />

      {!reduzido && (
        <Box component="canvas" ref={canvasRef}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      )}

      {/* Vinheta: escurece as bordas e joga o olho para o painel. */}
      <Box sx={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 82% 72% at 50% 50%, transparent 42%, ${CAPA.fundo} 100%)`,
      }} />
    </Box>
  )
}
