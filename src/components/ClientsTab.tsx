import { useMemo, useState } from 'react'
import {
  Box, Typography, Card, CardContent, LinearProgress,
  IconButton, Tooltip, Chip, Paper, Divider, Badge, Button,
} from '@mui/material'
import TableChartIcon from '@mui/icons-material/TableChart'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import MovieIcon from '@mui/icons-material/Movie'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import type { ContentItem, ItemState, Roteiro } from '../types'
import { CLIENTS } from '../data'
import HintCard from './HintCard'
import RoteirosModal from './RoteirosModal'
import ClientAvatar from './ClientAvatar'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  roteiros: Record<string, Roteiro[]>
  clientFolders: Record<string, string>
  onAddRoteiro: (clientName: string, r: Omit<Roteiro, 'id' | 'clientName' | 'distributed'>, year: number, month: number) => void
  onRemoveRoteiro: (clientName: string, id: string) => void
  onRedistribute: (clientName: string, year: number, month: number) => void
  onClearDistribution: (clientName: string, year: number, month: number) => void
  onSetClientFolder: (clientName: string, url: string) => void
}

export default function ClientsTab({
  items, states, roteiros, clientFolders,
  onAddRoteiro, onRemoveRoteiro, onRedistribute, onClearDistribution, onSetClientFolder,
}: Props) {
  const [roteiroClient, setRoteiroClient] = useState<string | null>(null)

  const clientStats = useMemo(() => {
    return CLIENTS.map(client => {
      const clientItems    = items.filter(i => i.c === client.name)
      const posts          = clientItems.filter(i => i.tp === 'Post')
      const reels          = clientItems.filter(i => i.tp === 'Reel')
      const postsPublished = posts.filter(i => (states[i.i]?.status ?? i.s) === 3).length
      const reelsPublished = reels.filter(i => (states[i.i]?.status ?? i.s) === 3).length
      const total          = posts.length + reels.length
      const totalDone      = postsPublished + reelsPublished
      const pct            = total > 0 ? Math.round((totalDone / total) * 100) : 0
      const roteiroCount   = (roteiros[client.name] ?? []).length
      const distributed    = (roteiros[client.name] ?? []).some(r => r.distributed)
      const customCount    = items.filter(i => i.c === client.name && i.custom).length

      return {
        ...client,
        postsTotal: posts.length || client.postsPerMonth,
        reelsTotal: reels.length || client.reelsPerMonth,
        postsPublished, reelsPublished, totalDone, total, pct,
        roteiroCount, distributed, customCount,
      }
    }).sort((a, b) => a.pct - b.pct)
  }, [items, states, roteiros])

  const globalStats = useMemo(() => {
    const total = clientStats.reduce((s, c) => s + c.total, 0)
    const done  = clientStats.reduce((s, c) => s + c.totalDone, 0)
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
  }, [clientStats])

  const done100    = clientStats.filter(c => c.pct === 100).length
  const inProgress = clientStats.filter(c => c.pct > 0 && c.pct < 100).length
  const notStarted = clientStats.filter(c => c.pct === 0).length

  const selectedRoteiros      = roteiroClient ? (roteiros[roteiroClient] ?? []) : []
  const selectedDistribCount  = roteiroClient ? items.filter(i => i.c === roteiroClient && i.custom).length : 0
  const selectedFolder        = roteiroClient ? (clientFolders[roteiroClient] ?? '') : ''

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* ── Resumo geral ─────────────────────────────── */}
      <Paper sx={{ p: 2, border: '1px solid rgba(255,144,57,0.15)', background: 'linear-gradient(135deg, #1a1a1a, #1c1408)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <TrendingUpIcon sx={{ color: 'primary.main', fontSize: 18 }} />
          <Typography variant="subtitle2" fontWeight={700}>Progresso Geral — Maio 2026</Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 1.5 }}>
          {[
            { label: 'Concluídos',    value: done100,    color: 'success.main' },
            { label: 'Em andamento',  value: inProgress, color: 'warning.main' },
            { label: 'Não iniciados', value: notStarted, color: 'error.main' },
          ].map(s => (
            <Box key={s.label} sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: s.color, lineHeight: 1 }}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.58rem' }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Total do mês</Typography>
          <Typography variant="caption" fontWeight={700} color={globalStats.pct === 100 ? 'success.main' : 'primary.main'}>
            {globalStats.done}/{globalStats.total} · {globalStats.pct}%
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={globalStats.pct} color={globalStats.pct === 100 ? 'success' : 'primary'} sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.06)' }} />
      </Paper>

      <HintCard text="Toque em 'Roteiros' para adicionar scripts — eles vão direto para o calendário. Cole a pasta do Drive e todos os roteiros herdam o link." />
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

      <Typography variant="overline" color="primary.main" fontWeight={700} sx={{ letterSpacing: 1 }}>
        {CLIENTS.length} Clientes Ativos
      </Typography>

      {/* ── Grid de clientes ─────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
        {clientStats.map(client => {
          const postPct   = client.postsTotal > 0 ? Math.round((client.postsPublished / client.postsTotal) * 100) : 0
          const reelPct   = client.reelsTotal > 0 ? Math.round((client.reelsPublished / client.reelsTotal) * 100) : 0
          const statusColor = client.pct === 100 ? 'success' : client.pct >= 50 ? 'warning' : 'error'
          const hasFolder = !!clientFolders[client.name]

          return (
            <Card
              key={client.name}
              sx={{
                border: '1px solid',
                borderColor: client.pct === 100 ? 'rgba(0,196,122,0.25)' : 'rgba(255,255,255,0.05)',
                position: 'relative', overflow: 'visible',
              }}
            >
              {/* % badge */}
              <Chip label={`${client.pct}%`} size="small" color={statusColor} sx={{ position: 'absolute', top: -8, right: 8, height: 18, fontSize: '0.6rem', fontWeight: 700 }} />

              <CardContent sx={{ p: 1.2, '&:last-child': { pb: 1.2 } }}>
                {/* Avatar + Nome + ícones */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 0.8 }}>
                  <ClientAvatar name={client.name} size={28} />
                  <Typography variant="caption" fontWeight={700} sx={{ flex: 1, fontSize: '0.65rem', lineHeight: 1.3 }} noWrap>
                    {client.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.2, flexShrink: 0 }}>
                    {hasFolder && (
                      <Tooltip title="Pasta Drive configurada">
                        <CheckCircleIcon sx={{ fontSize: 13, color: 'success.main' }} />
                      </Tooltip>
                    )}
                    {client.sheetUrl && (
                      <Tooltip title="Planilha">
                        <IconButton size="small" component="a" href={client.sheetUrl} target="_blank" rel="noopener" sx={{ p: 0.3 }}>
                          <TableChartIcon sx={{ fontSize: 12, color: 'primary.main' }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>

                {/* Barra Posts */}
                <Box sx={{ mb: 0.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.15 }}>
                    <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Posts</Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: postPct === 100 ? 'success.main' : 'text.secondary', fontWeight: 700 }}>{client.postsPublished}/{client.postsTotal}</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={postPct} color={postPct === 100 ? 'success' : 'primary'} sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)' }} />
                </Box>

                {/* Barra Reels */}
                <Box sx={{ mb: 0.8 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.15 }}>
                    <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Reels</Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: reelPct === 100 ? 'success.main' : 'text.secondary', fontWeight: 700 }}>{client.reelsPublished}/{client.reelsTotal}</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={reelPct} color={reelPct === 100 ? 'success' : 'secondary'} sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)' }} />
                </Box>

                {/* Botão Roteiros */}
                <Badge
                  badgeContent={client.roteiroCount || undefined}
                  color="info"
                  sx={{ width: '100%', '& .MuiBadge-badge': { fontSize: '0.5rem', height: 14, minWidth: 14 } }}
                >
                  <Button
                    fullWidth size="small"
                    variant={client.distributed ? 'contained' : 'outlined'}
                    color={client.distributed ? 'success' : 'primary'}
                    startIcon={<MovieIcon sx={{ fontSize: 12 }} />}
                    onClick={() => setRoteiroClient(client.name)}
                    sx={{ fontSize: '0.58rem', py: 0.3, minHeight: 0, fontWeight: 700 }}
                  >
                    {client.distributed
                      ? `✓ ${client.customCount} no calendário`
                      : 'Gerenciar roteiros'}
                  </Button>
                </Badge>
              </CardContent>
            </Card>
          )
        })}
      </Box>

      <HintCard text="Dica da IA: diga 'Distribua 8 posts e 4 reels para o [Cliente]' — a IA cria e agenda tudo automaticamente." />

      {/* ── Modal de roteiros ─────────────────────────── */}
      {roteiroClient && (
        <RoteirosModal
          open
          clientName={roteiroClient}
          roteiros={selectedRoteiros}
          distributedCount={selectedDistribCount}
          driveFolder={selectedFolder || undefined}
          onAdd={(r, year, month) => onAddRoteiro(roteiroClient, r, year, month)}
          onRemove={id => onRemoveRoteiro(roteiroClient, id)}
          onRedistribute={(year, month) => onRedistribute(roteiroClient, year, month)}
          onClearDistribution={(year, month) => onClearDistribution(roteiroClient, year, month)}
          onSetDriveFolder={url => onSetClientFolder(roteiroClient, url)}
          onClose={() => setRoteiroClient(null)}
        />
      )}
    </Box>
  )
}
