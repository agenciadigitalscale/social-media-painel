import { Box } from '@mui/material'

/**
 * Carregamento com shimmer, no lugar do spinner.
 *
 * Spinner não diz nada além de "espere"; o esqueleto já mostra a forma do que
 * vem — e, quando a lista chega, ela ocupa o mesmo espaço em vez de empurrar a
 * tela. O gradiente usa o keyframe `shimmer`, global no tema.
 */

interface Props {
  width?: number | string
  height?: number | string
  radius?: number | string
  /** Atraso da onda, para uma lista não pulsar toda junta. */
  delayMs?: number
  sx?: object
}

export default function Skeleton({ width = '100%', height = 14, radius = '8px', delayMs = 0, sx }: Props) {
  return (
    <Box
      aria-hidden
      sx={{
        width, height, borderRadius: radius, flexShrink: 0,
        background: 'linear-gradient(90deg, rgba(148,163,184,0.06) 25%, rgba(148,163,184,0.13) 50%, rgba(148,163,184,0.06) 75%)',
        backgroundSize: '200% 100%',
        animation: `shimmer 1.4s ease-in-out ${delayMs}ms infinite`,
        ...sx,
      }}
    />
  )
}

/** Linhas de lista — o formato que mais se repete no DS HUB. */
export function SkeletonRows({ rows = 3, height = 52, gap = 1 }: { rows?: number; height?: number; gap?: number }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} radius="10px" delayMs={i * 90} />
      ))}
    </Box>
  )
}
