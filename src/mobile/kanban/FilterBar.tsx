import { type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import TuneIcon from '@mui/icons-material/Tune'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import AddIcon from '@mui/icons-material/Add'
import { DS } from '../../theme'
import { haptic } from '../system/haptics'
import { QUICK_DEFS, type KanbanFilters, type QuickKey, type SavedFilter } from './filters'

interface Props {
  filters: KanbanFilters
  onToggleQuick: (k: QuickKey) => void
  onOpenMore: () => void
  saved: SavedFilter[]
  onApplySaved: (f: SavedFilter) => void
  onSaveCurrent: () => void
  activeCount: number
  compact: boolean
  onToggleCompact: () => void
  focus: boolean
  onToggleFocus: () => void
}

const scrollRow = {
  display: 'flex', gap: 0.7, overflowX: 'auto', px: 1.6, py: 0.6,
  '&::-webkit-scrollbar': { display: 'none' },
} as const

export default function FilterBar(p: Props) {
  const { filters, onToggleQuick, onOpenMore, saved, onApplySaved, onSaveCurrent, activeCount, compact, onToggleCompact, focus, onToggleFocus } = p
  const hasActive = activeCount > 0

  return (
    <Box sx={{ flexShrink: 0, pt: 0.4 }}>
      {/* filtros salvos — só fora do modo foco */}
      {!focus && (
        <Box sx={scrollRow}>
          {saved.map((sf) => (
            <Box
              key={sf.id}
              onClick={() => { haptic('selection'); onApplySaved(sf) }}
              sx={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.4,
                px: 1.1, py: 0.55, borderRadius: 2, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${DS.border}`,
                '&:active': { transform: 'scale(0.95)' }, transition: 'transform 0.12s',
              }}
            >
              <span style={{ fontSize: '0.78rem' }}>{sf.emoji}</span>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: DS.t2, whiteSpace: 'nowrap' }}>{sf.name}</Typography>
            </Box>
          ))}
          <Box
            onClick={() => { if (hasActive) { haptic('success'); onSaveCurrent() } }}
            sx={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.3,
              px: 1, py: 0.55, borderRadius: 2, cursor: hasActive ? 'pointer' : 'default',
              background: hasActive ? `${DS.orange}16` : 'rgba(255,255,255,0.02)',
              border: `1px dashed ${hasActive ? `${DS.orange}55` : DS.border}`,
              opacity: hasActive ? 1 : 0.5,
            }}
          >
            <AddIcon sx={{ fontSize: 14, color: hasActive ? DS.orange : DS.t3 }} />
            <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: hasActive ? DS.orange : DS.t3, whiteSpace: 'nowrap' }}>Salvar</Typography>
          </Box>
        </Box>
      )}

      {/* chips rápidos + Mais + toggles */}
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ ...scrollRow, flex: 1 }}>
          {QUICK_DEFS.map((q) => {
            const active = filters.quick.includes(q.key)
            return (
              <Box
                key={q.key}
                onClick={() => { haptic('selection'); onToggleQuick(q.key) }}
                sx={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.35,
                  px: 1.05, py: 0.55, borderRadius: 5, cursor: 'pointer',
                  background: active ? `${DS.orange}1e` : 'rgba(255,255,255,0.035)',
                  border: `1px solid ${active ? `${DS.orange}66` : DS.border}`,
                  boxShadow: active ? `0 0 10px ${DS.orange}22` : 'none',
                  '&:active': { transform: 'scale(0.94)' }, transition: 'transform 0.12s, background 0.15s',
                }}
              >
                <span style={{ fontSize: '0.72rem' }}>{q.emoji}</span>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: active ? DS.orange : DS.t2, whiteSpace: 'nowrap' }}>{q.label}</Typography>
              </Box>
            )
          })}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pr: 1.4, pl: 0.5, flexShrink: 0 }}>
          <IconToggle active={compact} onClick={() => { haptic('light'); onToggleCompact() }} title="Compacto"><UnfoldLessIcon sx={{ fontSize: 17 }} /></IconToggle>
          <IconToggle active={focus} onClick={() => { haptic('light'); onToggleFocus() }} title="Foco"><CenterFocusStrongIcon sx={{ fontSize: 17 }} /></IconToggle>
          <Box
            onClick={() => { haptic('light'); onOpenMore() }}
            sx={{
              position: 'relative', display: 'flex', alignItems: 'center', gap: 0.35,
              px: 1.05, py: 0.6, borderRadius: 2, cursor: 'pointer', flexShrink: 0,
              background: hasActive ? `${DS.orange}18` : 'rgba(255,255,255,0.05)',
              border: `1px solid ${hasActive ? `${DS.orange}55` : DS.border}`,
            }}
          >
            <TuneIcon sx={{ fontSize: 15, color: hasActive ? DS.orange : DS.t2 }} />
            <Typography sx={{ fontSize: '0.66rem', fontWeight: 800, color: hasActive ? DS.orange : DS.t2 }}>Mais</Typography>
            {activeCount > 0 && (
              <Box sx={{ minWidth: 15, height: 15, px: 0.3, borderRadius: 8, bgcolor: DS.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: '0.5rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{activeCount}</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

function IconToggle({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <Box
      onClick={onClick}
      title={title}
      sx={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, borderRadius: 2, cursor: 'pointer', flexShrink: 0,
        color: active ? DS.orange : DS.t2,
        background: active ? `${DS.orange}18` : 'rgba(255,255,255,0.05)',
        border: `1px solid ${active ? `${DS.orange}55` : DS.border}`,
        '&:active': { transform: 'scale(0.9)' }, transition: 'transform 0.12s',
      }}
    >
      {children}
    </Box>
  )
}
