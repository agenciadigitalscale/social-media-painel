import { Box, Tooltip } from '@mui/material'

/**
 * A cor sai de `índice do cliente % COLORS.length`, então valor repetido = dois
 * clientes com o mesmo avatar. O redesign laranja→azul deixou DS.accent TRÊS
 * vezes aqui (posições 0, 1 e 8): três dos 17 clientes ficavam idênticos,
 * justamente no elemento que existe para distingui-los de relance.
 */
const COLORS = [
  DS.accent,DS.green,DS.amber,DS.red,
  '#B47AFF','#FF69B4','#00CED1','#7CFC00',
  '#FF6347','#9370DB','#20B2AA','#F08080','#98FB98',
  '#87CEEB','#DDA0DD',
]

const ALL_CLIENTS: string[] = []

export function registerClients(clients: string[]) {
  ALL_CLIENTS.length = 0
  ALL_CLIENTS.push(...clients)
}

function getColor(name: string): string {
  const idx = ALL_CLIENTS.indexOf(name)
  return COLORS[(idx >= 0 ? idx : name.charCodeAt(0)) % COLORS.length]
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
        fontFamily: '"Inter", system-ui, sans-serif',
      }}>
        {initials(name)}
      </Box>
    </Box>
  )

  return tooltip ? <Tooltip title={name}>{avatar}</Tooltip> : avatar
}
