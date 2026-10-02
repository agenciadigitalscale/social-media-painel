import { useId } from 'react'
import { Box } from '@mui/material'

/**
 * O foguete da Proposta (proposta-c1d.pages.dev), em tamanho de ícone: corpo
 * claro, faixas laranja e a chama tremulando. Decoração pura — aria-hidden.
 * As animações são locais (fgFlicker/fgFloat) e o CssBaseline já as desliga
 * sob prefers-reduced-motion.
 */
export default function Foguete({ tamanho = 32, inclinado = true }: { tamanho?: number; inclinado?: boolean }) {
  const id = useId().replace(/:/g, '')
  const g = (n: string) => `fg-${n}-${id}`
  return (
    <Box component="span" aria-hidden sx={{
      display: 'inline-flex', width: tamanho, height: tamanho, flexShrink: 0,
      animation: 'fgFloat 4s ease-in-out infinite',
      '@keyframes fgFloat': { '50%': { transform: 'translate(2px,-3px)' } },
      '@keyframes fgFlicker': {
        '0%': { transform: 'scale(1,1)' }, '35%': { transform: 'scale(.92,1.14)' },
        '70%': { transform: 'scale(1.06,.9)' }, '100%': { transform: 'scale(.96,1.2)' },
      },
      '& .fg-chama': { transformBox: 'fill-box', transformOrigin: '50% 0', animation: 'fgFlicker .16s ease-in-out infinite alternate' },
    }}>
      <svg viewBox="-60 -95 120 260" width="100%" height="100%" style={{ transform: inclinado ? 'rotate(45deg)' : undefined, overflow: 'visible' }}>
        <defs>
          <linearGradient id={g('corpo')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FFFFFF" /><stop offset=".45" stopColor="#F4F1EC" /><stop offset="1" stopColor="#B8AFA6" />
          </linearGradient>
          <linearGradient id={g('laranja')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FF9A3D" /><stop offset=".5" stopColor="#FF6B00" /><stop offset="1" stopColor="#B84A00" />
          </linearGradient>
          <radialGradient id={g('janela')} cx=".35" cy=".35" r=".75">
            <stop offset="0" stopColor="#8FD8FF" /><stop offset=".55" stopColor="#1F5A8A" /><stop offset="1" stopColor="#0A1A2C" />
          </radialGradient>
          <linearGradient id={g('chama')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFD400" /><stop offset=".45" stopColor="#FF6B00" /><stop offset="1" stopColor="#FF3D00" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={g('miolo')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFF3B0" /><stop offset=".5" stopColor="#FFD400" /><stop offset="1" stopColor="#FF8A00" stopOpacity="0" />
          </linearGradient>
          <clipPath id={g('clip')}><path d="M0 -84C22 -64 30 -30 28 10L24 34H-24L-28 10C-30 -30 -22 -64 0 -84Z" /></clipPath>
        </defs>
        <path className="fg-chama" d="M-19 44C-24 80-10 112 0 156C10 112 24 80 19 44Z" fill={`url(#${g('chama')})`} />
        <path className="fg-chama" d="M-13 44C-15 72-6 96 0 124C6 96 15 72 13 44Z" fill={`url(#${g('miolo')})`} />
        <path d="M-15 32H15L20 46H-20Z" fill="#2A221C" />
        <path d="M-25 -2C-44 8-52 30-50 54L-23 34Z" fill={`url(#${g('laranja')})`} />
        <path d="M25 -2C44 8 52 30 50 54L23 34Z" fill={`url(#${g('laranja')})`} />
        <path d="M0 -84C22 -64 30 -30 28 10L24 34H-24L-28 10C-30 -30 -22 -64 0 -84Z" fill={`url(#${g('corpo')})`} />
        <g clipPath={`url(#${g('clip')})`}>
          <rect x="-32" y="-90" width="64" height="44" fill={`url(#${g('laranja')})`} />
          <rect x="-32" y="14" width="64" height="7" fill={`url(#${g('laranja')})`} />
          <rect x="-19" y="-80" width="5" height="110" fill="#FFFFFF" opacity=".45" />
        </g>
        <circle cx="0" cy="-16" r="13.5" fill="#2A221C" />
        <circle cx="0" cy="-16" r="10.5" fill={`url(#${g('janela')})`} />
        <rect x="-3" y="22" width="6" height="30" rx="3" fill={`url(#${g('laranja')})`} />
      </svg>
    </Box>
  )
}
