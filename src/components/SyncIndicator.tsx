import { useState, useEffect } from 'react'
import { Box, Typography, Tooltip, CircularProgress } from '@mui/material'
import CloudDoneIcon      from '@mui/icons-material/CloudDone'
import CloudOffIcon       from '@mui/icons-material/CloudOff'
import CloudSyncIcon      from '@mui/icons-material/CloudSync'
import ErrorOutlineIcon   from '@mui/icons-material/ErrorOutline'
import { onSyncStatus, forceSync, getPendingCount, getSyncStatus } from '../lib/storage'

export default function SyncIndicator() {
  const [status,  setStatus]  = useState(getSyncStatus)
  const [pending, setPending] = useState(getPendingCount)

  useEffect(() => onSyncStatus((s, p) => { setStatus(s); setPending(p) }), [])

  const cfg = {
    idle:    { icon: <CloudDoneIcon sx={{ fontSize: 15 }} />,    color: 'rgba(255,255,255,0.25)', tip: 'Sincronizado'             },
    syncing: { icon: <CircularProgress size={13} thickness={5} sx={{ color: '#3B82F6' }} />, color: '#3B82F6', tip: 'Salvando no servidor…' },
    synced:  { icon: <CloudDoneIcon sx={{ fontSize: 15 }} />,    color: '#22C55E',               tip: 'Salvo no servidor ✓'        },
    error:   { icon: <ErrorOutlineIcon sx={{ fontSize: 15 }} />, color: '#EF4444',               tip: 'Erro ao salvar — clique para tentar de novo' },
    offline: { icon: <CloudOffIcon sx={{ fontSize: 15 }} />,     color: '#F59E0B',               tip: `Sem conexão — ${pending} mudança${pending !== 1 ? 's' : ''} pendente${pending !== 1 ? 's' : ''}` },
  }[status] ?? { icon: <CloudSyncIcon sx={{ fontSize: 15 }} />, color: 'rgba(255,255,255,0.2)', tip: '' }

  return (
    <Tooltip title={cfg.tip} placement="bottom">
      <Box
        onClick={status === 'error' || status === 'offline' ? () => forceSync() : undefined}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          px: 0.8, py: 0.4, borderRadius: 1.5,
          cursor: (status === 'error' || status === 'offline') ? 'pointer' : 'default',
          color: cfg.color,
          transition: 'color 0.3s',
          '&:hover': (status === 'error' || status === 'offline')
            ? { bgcolor: 'rgba(255,255,255,0.04)' } : {},
        }}
      >
        {cfg.icon}
        {(status === 'offline' && pending > 0) && (
          <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: '#F59E0B', lineHeight: 1 }}>
            {pending}
          </Typography>
        )}
      </Box>
    </Tooltip>
  )
}
