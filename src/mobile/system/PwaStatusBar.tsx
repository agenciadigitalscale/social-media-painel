import { Box, Typography } from '@mui/material'

export default function PwaStatusBar() {
  return (
    <Box sx={{ px: 2, py: 1, background: 'rgba(0,0,0,0.1)' }}>
      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.65)' }}>PWA status não disponível</Typography>
    </Box>
  )
}
