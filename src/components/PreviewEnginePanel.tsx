import { Box, Typography } from '@mui/material'

export default function PreviewEnginePanel({ compact, onChanged }: { compact?: boolean; onChanged?: () => void }) {
  return (
    <Box sx={{ display: compact ? 'none' : 'block', py: compact ? 0 : 1, px: compact ? 0 : 0.5 }}>
      <Typography sx={{ fontSize: '0.7rem', color: 'rgba(244,247,255,0.65)' }}>
        Preview engine placeholder
      </Typography>
    </Box>
  )
}
