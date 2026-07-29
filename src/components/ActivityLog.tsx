import { useState, useEffect, useMemo } from 'react'
import { Box, Typography, Chip, Paper, Button, Tooltip } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { loadActivity, clearActivity, ACTION_LABEL, ACTION_EMOJI, type ActivityEntry } from '../lib/activity'
import { NAME_MAP, getDisplayName } from '../lib/users'

// Formata o timestamp de forma legível
function formatTs(ts: number): string {
  const diff = Date.now() - ts
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return 'agora'
  if (mins  < 60)  return `${mins}min atrás`
  if (hours < 24)  return `${hours}h atrás`
  if (days  < 7)   return `${days}d atrás`
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

interface Props {
  maxEntries?: number
  filterUser?: string
}

export default function ActivityLog({ maxEntries = 50, filterUser }: Props) {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [userFilter, setUserFilter] = useState<string>(filterUser ?? 'all')

  useEffect(() => {
    setEntries(loadActivity())
    // Recarrega a cada 15s para pegar ações de outras abas
    const id = setInterval(() => setEntries(loadActivity()), 15_000)
    return () => clearInterval(id)
  }, [])

  const users = useMemo(() => {
    const set = new Set(entries.map(e => e.user))
    return Array.from(set)
  }, [entries])

  const visible = useMemo(() => {
    return entries
      .filter(e => userFilter === 'all' || e.user === userFilter)
      .slice(0, maxEntries)
  }, [entries, userFilter, maxEntries])

  if (entries.length === 0) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontStyle: 'italic' }}>
          Nenhuma atividade registrada ainda.
        </Typography>
        <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', mt: 0.5 }}>
          As ações da equipe aparecerão aqui.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Filtro por usuário */}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip
          label="Todos"
          size="small"
          onClick={() => setUserFilter('all')}
          sx={{
            height: 20, fontSize: '0.6rem', fontWeight: 700,
            bgcolor: userFilter === 'all' ? 'rgba(59,130,246,0.15)' : 'rgba(244,247,255,0.04)',
            color: userFilter === 'all' ? 'primary.main' : 'text.secondary',
            border: userFilter === 'all' ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(244,247,255,0.06)',
            cursor: 'pointer',
          }}
        />
        {users.map(u => {
          const info = NAME_MAP[u]
          const isActive = userFilter === u
          return (
            <Chip
              key={u}
              label={`${info?.emoji ?? ''} ${getDisplayName(u)}`}
              size="small"
              onClick={() => setUserFilter(isActive ? 'all' : u)}
              sx={{
                height: 20, fontSize: '0.6rem', fontWeight: 700,
                bgcolor: isActive ? `${info?.color ?? '#fff'}18` : 'rgba(244,247,255,0.04)',
                color: isActive ? (info?.color ?? 'primary.main') : 'text.secondary',
                border: isActive ? `1px solid ${info?.color ?? '#fff'}30` : '1px solid rgba(244,247,255,0.06)',
                cursor: 'pointer',
              }}
            />
          )
        })}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Limpar histórico de atividade">
          <Button
            size="small"
            startIcon={<DeleteOutlineIcon sx={{ fontSize: 12 }} />}
            onClick={() => { clearActivity(); setEntries([]) }}
            sx={{ fontSize: '0.58rem', color: 'text.disabled', py: 0.2, minWidth: 0, '&:hover': { color: 'error.main' } }}
          >
            Limpar
          </Button>
        </Tooltip>
      </Box>

      {/* Lista de entradas */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, maxHeight: 380, overflowY: 'auto', pr: 0.5,
        '&::-webkit-scrollbar': { width: 3 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(244,247,255,0.1)', borderRadius: 2 },
      }}>
        {visible.map(entry => {
          const info = NAME_MAP[entry.user]
          const color = info?.color ?? DS.accent
          return (
            <Paper
              key={entry.id}
              elevation={0}
              sx={{
                p: '7px 10px',
                borderRadius: 2,
                bgcolor: 'rgba(244,247,255,0.025)',
                border: '1px solid rgba(244,247,255,0.05)',
                display: 'flex', alignItems: 'flex-start', gap: 1,
                transition: 'background 0.1s',
                '&:hover': { bgcolor: 'rgba(244,247,255,0.04)' },
              }}
            >
              {/* Avatar emoji */}
              <Box sx={{
                width: 24, height: 24, borderRadius: '7px', flexShrink: 0,
                bgcolor: `${color}14`,
                border: `1px solid ${color}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                mt: 0.1,
              }}>
                <Typography sx={{ fontSize: '0.72rem', lineHeight: 1 }}>{info?.emoji ?? '👤'}</Typography>
              </Box>

              {/* Conteúdo */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color, lineHeight: 1.2 }}>
                    {getDisplayName(entry.user)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', lineHeight: 1.2 }}>
                    {ACTION_EMOJI[entry.action]} {ACTION_LABEL[entry.action]}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(244,247,255,0.75)', lineHeight: 1.2 }} noWrap>
                    "{entry.itemTitle}"
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.3 }}>
                  <Typography sx={{ fontSize: '0.58rem', color: 'rgba(59,130,246,0.65)', fontWeight: 600 }}>
                    {entry.clientName}
                  </Typography>
                  {entry.detail && (
                    <>
                      <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'rgba(244,247,255,0.15)', flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>
                        {entry.detail}
                      </Typography>
                    </>
                  )}
                </Box>
              </Box>

              {/* Timestamp */}
              <Typography sx={{ fontSize: '0.55rem', color: 'text.disabled', flexShrink: 0, mt: 0.15 }}>
                {formatTs(entry.ts)}
              </Typography>
            </Paper>
          )
        })}
      </Box>

      {entries.length > maxEntries && (
        <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', textAlign: 'center' }}>
          Mostrando {maxEntries} de {entries.length} entradas
        </Typography>
      )}
    </Box>
  )
}
