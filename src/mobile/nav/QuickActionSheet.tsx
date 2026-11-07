import { type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import BottomSheet from '../system/BottomSheet'
import { DS } from '../../theme'
import { haptic } from '../system/haptics'

export interface AcaoRapida { key: string; label: string; descricao: string; icon: ReactNode; onClick: () => void }

interface Props {
  open: boolean
  onClose: () => void
  acoes: AcaoRapida[]
}

/** O "Criar" do meio da barra. As ações vêm prontas do MobileShell, já filtradas pelo cargo. */
export default function QuickActionSheet({ open, onClose, acoes }: Props) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={<Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: DS.t1 }}>O que você quer fazer?</Typography>}
    >
      <Box sx={{ px: 1.6, pt: 0.5, pb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {acoes.map(a => (
          <Box
            key={a.key}
            role="button"
            onClick={() => { haptic('selection'); onClose(); a.onClick() }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.4, p: 1.4, borderRadius: 3, cursor: 'pointer',
              background: 'rgba(247,247,245,0.03)', border: `1px solid ${DS.border}`,
              transition: 'transform 0.15s ease', '&:active': { transform: 'scale(0.98)' },
            }}
          >
            <Box sx={{
              width: 42, height: 42, borderRadius: 2.5, flexShrink: 0, display: 'grid', placeItems: 'center',
              color: DS.accent, background: 'rgba(255,122,0,0.1)', border: '1px solid rgba(255,122,0,0.25)',
              '& .MuiSvgIcon-root': { fontSize: '1.35rem' },
            }}>
              {a.icon}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: '0.88rem', fontWeight: 800, color: DS.t1 }}>{a.label}</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: DS.t2, lineHeight: 1.3 }}>{a.descricao}</Typography>
            </Box>
            <ChevronRightRoundedIcon sx={{ color: DS.t3, fontSize: 20 }} />
          </Box>
        ))}
      </Box>
    </BottomSheet>
  )
}
