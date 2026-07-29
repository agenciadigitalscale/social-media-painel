import { type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import type { Client, ContentType } from '../../types'
import { NAME_MAP } from '../../lib/users'
import { DS } from '../../theme'
import BottomSheet from '../system/BottomSheet'
import { haptic } from '../system/haptics'
import { countActive, type KanbanFilters, type PrazoKey } from './filters'

interface Props {
  open: boolean
  onClose: () => void
  filters: KanbanFilters
  onChange: (f: KanbanFilters) => void
  clients: Client[]
  onClear: () => void
}

const TYPES: ContentType[] = ['Post', 'Reel', 'Story', 'Carrossel', 'Feed']
const PRAZOS: { key: PrazoKey; label: string }[] = [
  { key: 'hoje', label: 'Hoje' }, { key: 'atrasado', label: 'Atrasados' },
  { key: 'semana', label: 'Esta semana' }, { key: 'futuro', label: 'Futuro' },
]

function labelSx() {
  return { fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: DS.t3, mb: 0.8, px: 2.2 } as const
}

function Chip({ label, active, color = DS.orange, onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <Box
      onClick={() => { haptic('selection'); onClick() }}
      sx={{
        flexShrink: 0, px: 1.2, py: 0.6, borderRadius: 2, cursor: 'pointer',
        background: active ? `${color}22` : 'rgba(244,247,255,0.04)',
        border: `1px solid ${active ? `${color}77` : DS.border}`,
        '&:active': { transform: 'scale(0.94)' }, transition: 'transform 0.12s',
      }}
    >
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: active ? color : DS.t2, whiteSpace: 'nowrap' }}>{label}</Typography>
    </Box>
  )
}

function Group({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.7, overflowX: 'auto', px: 2.2, pb: 1.8, '&::-webkit-scrollbar': { display: 'none' } }}>
      {children}
    </Box>
  )
}

export default function MoreFiltersSheet({ open, onClose, filters, onChange, clients, onClear }: Props) {
  const set = (patch: Partial<KanbanFilters>) => onChange({ ...filters, ...patch })
  const active = countActive(filters)

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.98rem', fontWeight: 800, color: DS.t1 }}>Filtros</Typography>
          <Box sx={{ flex: 1 }} />
          {active > 0 && (
            <Box onClick={() => { haptic('light'); onClear() }} sx={{ px: 1.2, py: 0.5, borderRadius: 2, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)', cursor: 'pointer' }}>
              <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: DS.red }}>Limpar ({active})</Typography>
            </Box>
          )}
        </Box>
      }
    >
      <Box sx={{ pt: 1, pb: 2 }}>
        <Typography sx={labelSx()}>Cliente</Typography>
        <Group>
          {clients.map((c) => (
            <Chip key={c.name} label={c.name} active={filters.client === c.name}
              onClick={() => set({ client: filters.client === c.name ? undefined : c.name })} />
          ))}
        </Group>

        <Typography sx={labelSx()}>Responsável</Typography>
        <Group>
          {Object.entries(NAME_MAP).map(([key, info]) => (
            <Chip key={key} label={`${info.emoji} ${key}`} active={filters.responsible === key} color={info.color}
              onClick={() => set({ responsible: filters.responsible === key ? undefined : key })} />
          ))}
        </Group>

        <Typography sx={labelSx()}>Tipo</Typography>
        <Group>
          {TYPES.map((t) => (
            <Chip key={t} label={t} active={filters.type === t}
              onClick={() => set({ type: filters.type === t ? undefined : t })} />
          ))}
        </Group>

        <Typography sx={labelSx()}>Prioridade</Typography>
        <Group>
          {(['alta', 'media', 'baixa'] as const).map((p) => (
            <Chip key={p} label={p} active={filters.priority === p}
              color={p === 'alta' ? DS.red : p === 'media' ? DS.amber : DS.t2}
              onClick={() => set({ priority: filters.priority === p ? undefined : p })} />
          ))}
        </Group>

        <Typography sx={labelSx()}>Prazo</Typography>
        <Group>
          {PRAZOS.map((pz) => (
            <Chip key={pz.key} label={pz.label} active={filters.prazo === pz.key}
              onClick={() => set({ prazo: filters.prazo === pz.key ? undefined : pz.key })} />
          ))}
        </Group>

        <Typography sx={labelSx()}>Criativo e prévia</Typography>
        <Group>
          <Chip label="Sem criativo" active={filters.creative === 'missing'} color={DS.red}
            onClick={() => set({ creative: filters.creative === 'missing' ? undefined : 'missing' })} />
          <Chip label="Processando" active={filters.creative === 'processing'} color={DS.blueSoft}
            onClick={() => set({ creative: filters.creative === 'processing' ? undefined : 'processing' })} />
          <Chip label="Prévia pronta" active={filters.creative === 'ready'} color={DS.green}
            onClick={() => set({ creative: filters.creative === 'ready' ? undefined : 'ready' })} />
        </Group>

        <Typography sx={labelSx()}>Aprovação</Typography>
        <Group>
          <Chip label="Revisão interna" active={filters.approval === 'internal'} color={DS.blueSoft}
            onClick={() => set({ approval: filters.approval === 'internal' ? undefined : 'internal' })} />
          <Chip label="Aguardando cliente" active={filters.approval === 'client'} color={DS.accent}
            onClick={() => set({ approval: filters.approval === 'client' ? undefined : 'client' })} />
          <Chip label="Ajuste solicitado" active={filters.approval === 'adjustment'} color={DS.red}
            onClick={() => set({ approval: filters.approval === 'adjustment' ? undefined : 'adjustment' })} />
          <Chip label="Aprovado" active={filters.approval === 'approved'} color={DS.green}
            onClick={() => set({ approval: filters.approval === 'approved' ? undefined : 'approved' })} />
        </Group>

        <Typography sx={labelSx()}>Nicho</Typography>
        <Group>
          {(['gastronomico', 'variados'] as const).map((n) => (
            <Chip key={n} label={n === 'gastronomico' ? '🍽️ Gastronômico' : '🎯 Variados'} active={filters.nicho === n}
              onClick={() => set({ nicho: filters.nicho === n ? undefined : n })} />
          ))}
        </Group>
      </Box>
    </BottomSheet>
  )
}
