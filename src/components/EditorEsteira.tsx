import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import { STATUS_CONFIG, type ContentItem, type ItemState } from '../types'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
}

// Esteira do Editor: a lente de quem executa. Mostra os vídeos DEPOIS da edição
// (com o cliente → aprovado / reprovado → publicado), lendo o mesmo Status que o
// Produções move. Não gerencia — acompanha o resultado do trabalho do editor.
export default function EditorEsteira({ items, states, now }: Props) {
  const dados = useMemo(() => {
    const videos = items.filter(i => i.tp === 'Reel' || i.tp === 'Feed')
    const linha = videos.map(i => {
      const st = states[i.i]?.status ?? i.s
      const s = states[i.i]
      return {
        id: i.i,
        cliente: i.c,
        titulo: s?.title || i.n,
        status: st,
        rejection: s?.rejectionText,
        ts: s?.approvedByClientAt || s?.sentToClientAt || s?.publishedAt || new Date(i.dt).getTime(),
      }
    })
    const por = (st: number) => linha.filter(v => v.status === st).sort((a, b) => b.ts - a.ts)
    return {
      reprovados: por(6),
      comCliente: por(4),
      aprovados:  por(5),
      publicados: por(7),
    }
  }, [items, states])

  // "Landou!" — aprovação do cliente nos últimos 3 dias
  const recente = dados.aprovados.find(v => now.getTime() - v.ts < 3 * 86400000)

  const totalPosEdicao = dados.reprovados.length + dados.comCliente.length + dados.aprovados.length + dados.publicados.length

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>
      <Typography sx={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', mb: 0.4, textTransform: 'uppercase' }}>
        🚀 Esteira · depois da edição
      </Typography>
      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', mb: 2 }}>
        Acompanhe seus vídeos com o cliente — sem sair do Editor.
      </Typography>

      {recente && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.2, mb: 2, p: 1.5, borderRadius: 2.5,
          background: 'linear-gradient(135deg, rgba(52,211,153,0.16), rgba(52,211,153,0.05))',
          border: '1px solid rgba(52,211,153,0.4)',
        }}>
          <Typography sx={{ fontSize: '1.5rem' }}>🎉</Typography>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: '#34D399' }}>Landou! Cliente aprovou</Typography>
            <Typography noWrap sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.8)' }}>{recente.titulo} · {recente.cliente}</Typography>
          </Box>
        </Box>
      )}

      {totalPosEdicao === 0 && (
        <Box sx={{ textAlign: 'center', py: 7, color: 'rgba(255,255,255,0.4)' }}>
          <Typography sx={{ fontSize: '2rem', mb: 1 }}>🚀</Typography>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Nada na esteira ainda</Typography>
          <Typography sx={{ fontSize: '0.72rem' }}>Quando um vídeo for enviado ao cliente, ele aparece aqui.</Typography>
        </Box>
      )}

      <Secao titulo="Precisa refazer" emoji="🔄" cor={STATUS_CONFIG[6].color} videos={dados.reprovados} now={now} mostrarMotivo />
      <Secao titulo="Com o cliente" emoji="📤" cor={STATUS_CONFIG[4].color} videos={dados.comCliente} now={now} />
      <Secao titulo="Aprovados pelo cliente" emoji="🎉" cor={STATUS_CONFIG[5].color} videos={dados.aprovados} now={now} />
      <Secao titulo="Publicados" emoji="🚀" cor={STATUS_CONFIG[7].color} videos={dados.publicados} now={now} limite={12} />
    </Box>
  )
}

interface Video { id: number; cliente: string; titulo: string; status: number; rejection?: string; ts: number }

function Secao({ titulo, emoji, cor, videos, now, mostrarMotivo, limite }: {
  titulo: string; emoji: string; cor: string; videos: Video[]; now: Date; mostrarMotivo?: boolean; limite?: number
}) {
  if (videos.length === 0) return null
  const lista = limite ? videos.slice(0, limite) : videos
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: '0.64rem', letterSpacing: '0.06em', color: cor, fontWeight: 800, mb: 0.8, textTransform: 'uppercase' }}>
        {emoji} {titulo} · {videos.length}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
        {lista.map(v => (
          <Box key={v.id} sx={{
            border: '1px solid rgba(255,255,255,0.08)', borderLeft: `3px solid ${cor}`, borderRadius: 2,
            p: 1.2, bgcolor: 'rgba(255,255,255,0.02)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', flex: 1 }}>{v.titulo}</Typography>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>{v.cliente} · {fromNow(v.ts, now)}</Typography>
            </Box>
            {mostrarMotivo && v.rejection && (
              <Typography sx={{ fontSize: '0.7rem', color: '#FF8080', mt: 0.6, lineHeight: 1.4 }}>
                💬 {v.rejection}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function fromNow(ts: number, now: Date): string {
  const diff = now.getTime() - ts
  if (diff < 0) return ''
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ontem'
  if (d < 30) return `há ${d} d`
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
