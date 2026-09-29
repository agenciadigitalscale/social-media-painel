import { Box, Tooltip } from '@mui/material'

/**
 * Avatar NEUTRO (2026-09-28): eram 15 cores de arco-íris por cliente. No padrão
 * sóbrio do painel-facebook, quem identifica o cliente são as INICIAIS; a cor é
 * o cinza claro da identidade. `registerClients` segue exportado — quem chama
 * não precisa mudar.
 */
const AVATAR_COLOR = '#C8CED8'

const ALL_CLIENTS: string[] = []

export function registerClients(clients: string[]) {
  ALL_CLIENTS.length = 0
  ALL_CLIENTS.push(...clients)
}

function getColor(_name: string): string {
  return AVATAR_COLOR
}

function initials(name: string): string {
  const skip = new Set(['de','da','do','e','a','o'])
  const words = name.split(' ').filter(w => !skip.has(w.toLowerCase()))
  if (words.length === 0) return name.slice(0, 2).toUpperCase()
  return words.length === 1
    ? words[0].slice(0, 2).toUpperCase()
    : (words[0][0] + words[1][0]).toUpperCase()
}

interface Props {
  name: string
  size?: number
  tooltip?: boolean
}

export default function ClientAvatar({ name, size = 28, tooltip = false }: Props) {
  const color = getColor(name)
  const bg = `${color}22`

  const avatar = (
    <Box sx={{
      width: size, height: size, borderRadius: '50%',
      bgcolor: bg,
      border: `1.5px solid ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      boxShadow: `0 0 6px ${color}44`,
    }}>
      <Box component="span" sx={{
        fontSize: size * 0.35,
        fontWeight: 800,
        color,
        lineHeight: 1,
        letterSpacing: '-0.02em',
        fontFamily: '"Inter", "Noto Emoji", system-ui, sans-serif',
      }}>
        {initials(name)}
      </Box>
    </Box>
  )

  return tooltip ? <Tooltip title={name}>{avatar}</Tooltip> : avatar
}
