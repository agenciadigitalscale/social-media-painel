import { useMemo, useState } from 'react'
import { keyframes } from '@mui/system'
import { Box, Typography, Tooltip, Chip, Paper, Stack } from '@mui/material'
import type { ContentItem, ItemState } from '../types'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
}

// ── Paleta 3D por status ───────────────────────────────
const STATUS_CFG = [
  { base: '#909090', light: '#d8d8d8', dark: '#3a3a3a', glow: '160,160,160' },   // 0 Pendente
  { base: '#FFD700', light: '#fff59d', dark: '#b8860b', glow: '255,215,0'   },   // 1 Em edição
  { base: '#3B8EFF', light: '#a0c4ff', dark: '#1040a0', glow: '59,142,255'  },   // 2 Aprovado
  { base: '#00C47A', light: '#80ffc0', dark: '#005a38', glow: '0,196,122'   },   // 3 Publicado
  { base: '#FF4545', light: '#FF9090', dark: '#8B0000', glow: '255,69,69'   },   // 4 Reprovado
]
const STATUS_LABEL = ['Pendente', 'Em edição', 'Aprovado', 'Publicado', 'Reprovado']
const DAY_W = 46

// ── Animação de explosão neon ──────────────────────────
const burstAnim = keyframes({
  '0%':   { transform: 'scale(1)',   filter: 'brightness(1)   drop-shadow(0 0 0px transparent)' },
  '25%':  { transform: 'scale(2.6)', filter: 'brightness(2.4) drop-shadow(0 0 12px white)'      },
  '55%':  { transform: 'scale(1.2)', filter: 'brightness(1.5) drop-shadow(0 0 6px white)'       },
  '100%': { transform: 'scale(1)',   filter: 'brightness(1)   drop-shadow(0 0 0px transparent)' },
})

const ringAnim = keyframes({
  '0%':   { transform: 'scale(1)',   opacity: 0.8 },
  '100%': { transform: 'scale(3.5)', opacity: 0   },
})

// ── Bolinha 3D individual ──────────────────────────────
function Dot({
  item, status, state, isBursting, onBurst,
}: {
  item: ContentItem
  status: number
  state: ItemState | undefined
  isBursting: boolean
  onBurst: () => void
}) {
  const cfg = STATUS_CFG[status]
  const isReel = item.tp === 'Reel'
  const br = isReel ? '50%' : '30%'

  return (
    <Tooltip
      title={
        <Box sx={{ p: 0.3 }}>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, lineHeight: 1.3 }}>
            {state?.title || item.n}
          </Typography>
          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 0.2 }}>
            {item.c} · {item.tp} · {STATUS_LABEL[status]}
          </Typography>
          <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', mt: 0.1 }}>
            {item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </Typography>
        </Box>
      }
      arrow
      placement="top"
    >
      <Box
        onClick={onBurst}
        sx={{
          position: 'relative',
          width: 15, height: 15,
          flexShrink: 0,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* Anel de explosão neon */}
        {isBursting && (
          <Box sx={{
            position: 'absolute',
            width: 15, height: 15,
            borderRadius: br,
            border: `2px solid rgba(${cfg.glow},0.9)`,
            animation: `${ringAnim} 0.55s ease-out forwards`,
            pointerEvents: 'none',
            zIndex: 10,
          }} />
        )}

        {/* Esfera 3D */}
        <Box sx={{
          width: 15, height: 15,
          borderRadius: br,
          position: 'relative',
          background: `radial-gradient(circle at 33% 26%, ${cfg.light} 0%, ${cfg.base} 52%, ${cfg.dark} 100%)`,
          boxShadow: isBursting
            ? `
                inset 0 2px 4px rgba(255,255,255,0.35),
                inset 0 -3px 6px rgba(0,0,0,0.6),
                0 3px 8px rgba(0,0,0,0.6),
                0 0 20px rgba(${cfg.glow},0.9),
                0 0 40px rgba(${cfg.glow},0.5)
              `
            : `
                inset 0 2px 4px rgba(255,255,255,0.3),
                inset 0 -3px 6px rgba(0,0,0,0.55),
                0 3px 7px rgba(0,0,0,0.55),
                0 0 8px rgba(${cfg.glow},0.45)
              `,
          animation: isBursting ? `${burstAnim} 0.55s cubic-bezier(0.22,0.61,0.36,1) forwards` : 'none',
          transition: 'box-shadow 0.2s',
          '&:hover': {
            boxShadow: `
              inset 0 2px 4px rgba(255,255,255,0.35),
              inset 0 -3px 6px rgba(0,0,0,0.6),
              0 3px 10px rgba(0,0,0,0.6),
              0 0 18px rgba(${cfg.glow},0.8)
            `,
          },
          // Brilho especular (shine)
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '13%', left: '17%',
            width: '40%', height: '28%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.1) 60%, transparent 100%)',
            pointerEvents: 'none',
          },
          // Reflexo inferior tênue
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: '10%', right: '12%',
            width: '22%', height: '16%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 100%)',
            pointerEvents: 'none',
          },
        }} />
      </Box>
    </Tooltip>
  )
}

// ── TimelineTab principal ──────────────────────────────
export default function TimelineTab({ items, states, now }: Props) {
  const [filterClient, setFilterClient] = useState<string | null>(null)
  const [burstId, setBurstId] = useState<number | null>(null)

  const handleBurst = (id: number) => {
    setBurstId(id)
    setTimeout(() => setBurstId(null), 600)
  }

  const year  = now.getFullYear()
  const month = now.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const today = now.getDate()

  const monthItems = useMemo(() =>
    items.filter(i => i.dt.getFullYear() === year && i.dt.getMonth() === month),
    [items, year, month])

  const clients = useMemo(() =>
    Array.from(new Set(monthItems.map(i => i.c))).sort(),
    [monthItems])

  const filtered = filterClient ? clients.filter(c => c === filterClient) : clients

  const getCell = (client: string, day: number) =>
    monthItems.filter(i => i.c === client && i.dt.getDate() === day)

  const totalByDay = useMemo(() =>
    days.map(d => monthItems.filter(i => i.dt.getDate() === d).length),
    [days, monthItems])

  const maxDay = Math.max(...totalByDay, 1)

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: { md: '0.95rem', xl: '1.05rem' } }}>
          Timeline — {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, ml: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
          {STATUS_CFG.map((cfg, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{
                width: 10, height: 10,
                borderRadius: i === 0 || i === 4 ? '30%' : '50%',
                background: `radial-gradient(circle at 33% 26%, ${cfg.light}, ${cfg.base} 55%, ${cfg.dark})`,
                boxShadow: `0 0 6px rgba(${cfg.glow},0.6)`,
              }} />
              <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>{STATUS_LABEL[i]}</Typography>
            </Box>
          ))}
          <Box sx={{ width: 1, height: 14, bgcolor: 'rgba(255,255,255,0.1)', mx: 0.5 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '30%', bgcolor: 'rgba(150,150,150,0.5)', border: '1px dashed rgba(255,255,255,0.2)' }} />
            <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>Post</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'rgba(150,150,150,0.5)', border: '1px dashed rgba(255,255,255,0.2)' }} />
            <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>Reel</Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Filtro de cliente ── */}
      <Stack direction="row" spacing={0.8} sx={{ overflowX: 'auto', pb: 0.5, flexShrink: 0 }}>
        <Chip label="Todos" size="small" variant={filterClient ? 'outlined' : 'filled'} color="primary" onClick={() => setFilterClient(null)} sx={{ flexShrink: 0 }} />
        {clients.map(c => (
          <Chip key={c} label={c} size="small" variant={filterClient === c ? 'filled' : 'outlined'} onClick={() => setFilterClient(c)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }} />
        ))}
      </Stack>

      {/* ── Grid ── */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Box sx={{ minWidth: 200 + daysInMonth * DAY_W, pb: 1 }}>

          {/* Cabeçalho de dias */}
          <Box sx={{ display: 'flex', pl: '200px', mb: 0.5 }}>
            {days.map(d => {
              const date = new Date(year, month, d)
              const isSun = date.getDay() === 0
              const isSat = date.getDay() === 6
              const isTod = d === today
              const load  = totalByDay[d - 1]
              return (
                <Box key={d} sx={{ width: DAY_W, flexShrink: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.2 }}>
                  <Typography sx={{
                    fontSize: '0.52rem', fontWeight: isTod ? 800 : 400,
                    color: isTod ? 'primary.main' : isSun || isSat ? 'rgba(255,100,100,0.6)' : 'text.disabled',
                    textTransform: 'uppercase',
                  }}>
                    {date.toLocaleDateString('pt-BR', { weekday: 'narrow' })}
                  </Typography>
                  <Box sx={{
                    width: 22, height: 22, borderRadius: '50%',
                    bgcolor: isTod ? 'primary.main' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isTod ? '0 0 10px rgba(255,144,57,0.6)' : 'none',
                  }}>
                    <Typography sx={{
                      fontSize: '0.62rem', fontWeight: isTod ? 900 : 400,
                      color: isTod ? '#000' : isSun || isSat ? 'rgba(255,100,100,0.6)' : 'text.secondary',
                    }}>
                      {d}
                    </Typography>
                  </Box>
                  {/* Barra de carga */}
                  <Box sx={{
                    width: 3, height: Math.max(Math.round((load / maxDay) * 14), 1),
                    borderRadius: 1, bgcolor: load > 0 ? `rgba(255,144,57,${0.2 + (load / maxDay) * 0.6})` : 'transparent',
                  }} />
                </Box>
              )
            })}
          </Box>

          {/* Linhas de clientes */}
          {filtered.map((client, ri) => (
            <Paper
              key={client}
              sx={{
                display: 'flex', alignItems: 'stretch', mb: 0.6,
                border: '1px solid rgba(255,255,255,0.05)',
                bgcolor: ri % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                borderRadius: 2, overflow: 'hidden',
                minHeight: 54,
              }}
            >
              {/* Nome do cliente */}
              <Box sx={{
                width: 200, flexShrink: 0,
                px: 1.8, display: 'flex', alignItems: 'center',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                position: 'sticky', left: 0, zIndex: 2,
                bgcolor: ri % 2 === 0 ? 'rgba(14,14,14,0.99)' : 'rgba(10,10,10,0.99)',
                background: ri % 2 === 0
                  ? 'linear-gradient(90deg, rgba(18,10,3,0.99) 0%, rgba(14,14,14,0.99) 100%)'
                  : 'linear-gradient(90deg, rgba(12,8,2,0.99) 0%, rgba(10,10,10,0.99) 100%)',
              }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.primary' }} noWrap>
                  {client}
                </Typography>
              </Box>

              {/* Células de dias */}
              {days.map(d => {
                const cellItems = getCell(client, d)
                const isTod = d === today
                return (
                  <Box
                    key={d}
                    sx={{
                      width: DAY_W, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexWrap: 'wrap', gap: 0.4, py: 0.8,
                      bgcolor: isTod ? 'rgba(255,144,57,0.04)' : 'transparent',
                      borderRight: d === daysInMonth ? 'none' : '1px solid rgba(255,255,255,0.025)',
                    }}
                  >
                    {cellItems.map(ci => {
                      const st = states[ci.i]?.status ?? ci.s
                      return (
                        <Dot
                          key={ci.i}
                          item={ci}
                          status={st}
                          state={states[ci.i]}
                          isBursting={burstId === ci.i}
                          onBurst={() => handleBurst(ci.i)}
                        />
                      )
                    })}
                  </Box>
                )
              })}
            </Paper>
          ))}

          {filtered.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography color="text.disabled">Nenhum conteúdo neste mês</Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
