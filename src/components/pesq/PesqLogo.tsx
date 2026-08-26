import { Box } from '@mui/material'
import { PESQ, PESQ_LOGO } from '../../lib/pesq/brand'

/**
 * A logo do PESQ, sempre do mesmo jeito.
 *
 * O arquivo é quadrado e já traz o gradiente da marca embutido, então o único
 * cuidado real é geométrico: largura = altura e `objectFit: contain`. Nenhuma
 * variante recolore, recorta ou distorce o símbolo — o brilho fica SEMPRE
 * atrás dele, num elemento irmão, nunca por cima.
 */
interface Props {
  /** Lado do quadrado, em px. Aceita objeto de breakpoints. */
  size?: number | Record<string, number>
  /** `plain` só a marca · `glow` com halo verde atrás · `soft` sem sombra */
  variant?: 'plain' | 'glow' | 'soft'
  /** A logo é decorativa quando o título ao lado já nomeia a marca. */
  alt?: string
}

export default function PesqLogo({ size = 44, variant = 'plain', alt = '' }: Props) {
  const box = typeof size === 'number' ? { width: size, height: size } : { width: size, height: size }

  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...box }}>
      {variant === 'glow' && (
        <Box aria-hidden sx={{
          position: 'absolute', inset: '-28%', borderRadius: '50%',
          background: `radial-gradient(circle, ${PESQ.greenLum}55 0%, ${PESQ.petrol}22 55%, transparent 72%)`,
          filter: 'blur(10px)',
          animation: 'pesqHalo 5.5s ease-in-out infinite',
        }} />
      )}
      <Box
        component="img"
        src={PESQ_LOGO}
        alt={alt}
        aria-hidden={alt ? undefined : true}
        draggable={false}
        sx={{
          position: 'relative',
          width: '100%', height: '100%',
          objectFit: 'contain',
          borderRadius: `${PESQ.r.logo}px`,
          boxShadow: variant === 'soft' ? 'none' : PESQ.shadowGlow,
          userSelect: 'none',
        }}
      />
    </Box>
  )
}

/**
 * Marca-d'água: a mesma logo, quase invisível, para dar assinatura a áreas
 * grandes e vazias. `aria-hidden` sempre — é textura, não informação.
 */
export function PesqWatermark({ size = 320, opacity = 0.04, right = -60, bottom = -70 }: {
  size?: number; opacity?: number; right?: number; bottom?: number
}) {
  return (
    <Box
      aria-hidden
      component="img"
      src={PESQ_LOGO}
      alt=""
      draggable={false}
      sx={{
        position: 'absolute', right, bottom, width: size, height: size,
        objectFit: 'contain', opacity, pointerEvents: 'none', userSelect: 'none',
        filter: 'grayscale(0.2)', borderRadius: 40,
      }}
    />
  )
}
