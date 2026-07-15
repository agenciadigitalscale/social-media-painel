import { Box, Typography, type SxProps } from '@mui/material'
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates'

interface Props {
  text: string
  sx?: SxProps
}

export default function HintCard({ text, sx }: Props) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        px: 1.5,
        py: 1,
        borderRadius: 2,
        bgcolor: 'rgba(59,130,246,0.06)',
        border: '1px solid rgba(59,130,246,0.15)',
        ...sx,
      }}
    >
      <TipsAndUpdatesIcon sx={{ fontSize: 14, color: 'primary.main', mt: 0.1, flexShrink: 0 }} />
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
        {text}
      </Typography>
    </Box>
  )
}
