import { Chip, type ChipProps } from '@mui/material'
import type { Status } from '../types'

const STATUS_CONFIG: Record<Status, { label: string; color: ChipProps['color']; variant: ChipProps['variant'] }> = {
  0: { label: 'Pendente',    color: 'default',   variant: 'outlined' },
  1: { label: 'Em edição',   color: 'warning',   variant: 'filled' },
  2: { label: 'Aprovado',    color: 'info',      variant: 'filled' },
  3: { label: 'Publicado',   color: 'success',   variant: 'filled' },
}

interface Props {
  status: Status
  onClick?: (s: Status) => void
  size?: ChipProps['size']
}

export default function StatusChip({ status, onClick, size = 'small' }: Props) {
  const cfg = STATUS_CONFIG[status]
  const next = ((status + 1) % 4) as Status

  return (
    <Chip
      label={cfg.label}
      color={cfg.color}
      variant={cfg.variant}
      size={size}
      onClick={onClick ? () => onClick(next) : undefined}
      sx={{ cursor: onClick ? 'pointer' : 'default', fontWeight: 600, minWidth: 90 }}
    />
  )
}
