import { Box, type BoxProps } from '@mui/material'
import { useState, type ReactNode } from 'react'
import { MOTION } from './tokens'
import { clickable } from '../a11y'

/**
 * Pressable — tocável que "afunda" sob o dedo com spring tátil.
 *
 * O tema já dá esse retorno a Button/IconButton (`:active` scale), mas os ~271
 * `Box onClick` espalhados pelas telas (cards, chips-como-box, áreas custom) não
 * têm feedback nenhum: o dedo toca e a tela não responde até a próxima ação.
 * Este primitivo resolve isso em um lugar só, e ainda traz o `clickable()`
 * embutido (role=button + Enter/Espaço), fechando de quebra o débito de a11y.
 *
 * Uso: `<Pressable onPress={() => setTab(4)} sx={{ ... }}>{conteúdo}</Pressable>`
 */
interface PressableProps extends Omit<BoxProps, 'onClick'> {
  onPress?: () => void
  /** Quanto afunda no toque (default 0.96). Card grande pede menos (0.98). */
  scale?: number
  disabled?: boolean
  children?: ReactNode
}

export function Pressable({ onPress, scale = 0.96, disabled, sx, children, ...rest }: PressableProps) {
  const [down, setDown] = useState(false)
  const release = () => setDown(false)

  return (
    <Box
      {...(onPress && !disabled ? clickable(onPress) : {})}
      onPointerDown={() => { if (!disabled) setDown(true) }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      sx={{
        display: 'inline-flex',
        transformOrigin: 'center',
        transform: down ? `scale(${scale})` : 'scale(1)',
        transition: `transform ${MOTION.dur.fast}ms ${MOTION.ease.tactile}`,
        cursor: disabled ? 'default' : 'pointer',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        opacity: disabled ? 0.5 : 1,
        // Reduced-motion: sem "afundar", mas o clique continua funcionando.
        '@media (prefers-reduced-motion: reduce)': { transition: 'none', transform: 'none' },
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  )
}
