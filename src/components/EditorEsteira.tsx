import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import { STATUS_CONFIG, isPreClientStatus, type ContentItem, type ItemState } from '../types'
import { DS } from '../theme'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
  editorNome?: string
}

// Esteira do Editor: a lente de quem executa. Mostra os vídeos DEPOIS da edição
// (com o cliente → aprovado / reprovado → publicado), lendo o mesmo Status que o
// Produções move. Não gerencia — acompanha o resultado do trabalho do editor.
export default function EditorEsteira({ items, states, now, editorNome }: Props) {
  const stats = useMemo(() => {
    const videos = items.filter(i => i.tp === 'Reel' || i.tp === 'Feed')
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    let entregues = 0, enviados = 0, aprovados = 0, publicados = 0, naFila = 0, esteMes = 0
    videos.forEach(i => {
      const st = states[i.i]?.status ?? i.s
      const s = states[i.i]
      if (!isPreClientStatus(st)) {
        entregues++; enviados++
        if (st === 5 || st === 7) aprovados++
        if (st === 7) publicados++
        const ts = s?.approvedByClientAt || s?.sentToClientAt || s?.publishedAt || new Date(i.dt).getTime()
        if (ts >= inicioMes) esteMes++
      } else {
        naFila++
      }
    })
    const taxa = enviados > 0 ? Math.round((aprovados / enviados) * 100) : 0
    return { entregues, aprovados, taxa, publicados, naFila, esteMes }
  }, [items, states, now])

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
      <Typography sx={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: 'rgba(244,247,255,0.35)', mb: 0.4, textTransform: 'uppercase' }}>
        🚀 Estúdio{editorNome ? ` do ${editorNome}` : ''} · seus números
      </Typography>
      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.45)', mb: 1.5 }}>
        O resultado do seu trabalho — sem sair do Editor.
      </Typography>

      {/* Stats do editor */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' }, gap: 1, mb: 2.5 }}>
        <StatBox emoji="🎬" valor={stats.entregues} label="Entregues"  cor={DS.accent} />
        <StatBox emoji="✅" valor={`${stats.taxa}%`} label="Aprovação do cliente" cor={DS.green} destaque />
        <StatBox emoji="🔥" valor={stats.esteMes}   label="Este mês"   cor={DS.amber} />
        <StatBox emoji="🚀" valor={stats.publicados} label="Publicados" cor={DS.green} />
        <StatBox emoji="📋" valor={stats.naFila}     label="Na fila"    cor="#60A5FA" />
      </Box>

      <Typography sx={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: 'rgba(244,247,255,0.35)', mb: 1, textTransform: 'uppercase' }}>
        📍 Onde estão seus vídeos
      </Typography>

      {recente && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.2, mb: 2, p: 1.5, borderRadius: 2.5,
          background: 'linear-gradient(135deg, rgba(52,211,153,0.16), rgba(52,211,153,0.05))',
          border: '1px solid rgba(52,211,153,0.4)',
        }}>
          <Typography sx={{ fontSize: '1.5rem' }}>🎉</Typography>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: DS.green }}>Landou! Cliente aprovou</Typography>
            <Typography noWrap sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.8)' }}>{recente.titulo} · {recente.cliente}</Typography>
          </Box>
        </Box>
      )}

      {totalPosEdicao === 0 && (
        <Box sx={{ textAlign: 'center', py: 7, color: 'rgba(244,247,255,0.4)' }}>
          <Typography sx={{ fontSize: '2rem', mb: 1 }}>🚀</Typography>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(244,247,255,0.6)' }}>Nada na esteira ainda</Typography>
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

function StatBox({ emoji, valor, label, cor, destaque }: { emoji: string; valor: number | string; label: string; cor: string; destaque?: boolean }) {
  return (
    <Box sx={{
      p: 1.2, borderRadius: 2.5, textAlign: 'center',
      bgcolor: destaque ? `${cor}14` : 'rgba(244,247,255,0.03)',
      border: `1px solid ${destaque ? cor + '55' : 'rgba(244,247,255,0.07)'}`,
    }}>
      <Typography sx={{ fontSize: '0.85rem', lineHeight: 1, mb: 0.4 }}>{emoji}</Typography>
      <Typography sx={{ fontSize: '1.25rem', fontWeight: 900, color: cor, lineHeight: 1 }}>{valor}</Typography>
      <Typography sx={{ fontSize: '0.56rem', color: 'rgba(244,247,255,0.5)', lineHeight: 1.2, mt: 0.4 }}>{label}</Typography>
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
            border: '1px solid rgba(244,247,255,0.08)', borderLeft: `3px solid ${cor}`, borderRadius: 2,
            p: 1.2, bgcolor: 'rgba(244,247,255,0.02)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', flex: 1 }}>{v.titulo}</Typography>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.35)', whiteSpace: 'nowrap' }}>{v.cliente} · {fromNow(v.ts, now)}</Typography>
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
