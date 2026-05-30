import { useEffect, useState } from 'react'
import { Box, Typography, LinearProgress, CircularProgress } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import InstagramIcon from '@mui/icons-material/Instagram'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportData {
  token: string
  clientName: string
  clientInitials: string
  clientColor: string
  month: string
  monthKey: string
  generatedAt: number
  generatedBy: string
  agency: { name: string; tagline: string; whatsapp: string; instagram: string }
  stats: {
    postsTotal: number
    postsPublished: number
    reelsTotal: number
    reelsPublished: number
    storiesTotal: number
    storiesPublished: number
    approvedByClient: number
    sentToClient: number
    onTimeCount: number
    totalPlanned: number
    totalDelivered: number
  }
  publishedItems: { title: string; type: string; date: string; link?: string }[]
  highlights: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(a: number, b: number) {
  return b > 0 ? Math.round((a / b) * 100) : 0
}

function StatCard({
  emoji, label, value, total, color,
}: {
  emoji: string; label: string; value: number; total?: number; color: string
}) {
  const p = total !== undefined ? pct(value, total) : undefined
  return (
    <Box sx={{
      flex: '1 1 140px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 3, p: 2.5,
      display: 'flex', flexDirection: 'column', gap: 1,
    }}>
      <Typography sx={{ fontSize: '1.6rem', lineHeight: 1 }}>{emoji}</Typography>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.8 }}>
          <Typography sx={{
            fontSize: '2.2rem', fontWeight: 900, lineHeight: 1,
            color, letterSpacing: '-0.04em',
            textShadow: `0 0 24px ${color}55`,
          }}>
            {value}
          </Typography>
          {total !== undefined && (
            <Typography sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
              /{total}
            </Typography>
          )}
        </Box>
        {p !== undefined && (
          <Box sx={{ mt: 1 }}>
            <LinearProgress variant="determinate" value={p} sx={{
              height: 4, borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.08)',
              '& .MuiLinearProgress-bar': { bgcolor: p === 100 ? '#00C47A' : color, borderRadius: 2 },
            }} />
          </Box>
        )}
      </Box>
      <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
        {p !== undefined && (
          <Box component="span" sx={{ color: p === 100 ? '#00C47A' : color, ml: 0.8, fontWeight: 800 }}>
            {p}%
          </Box>
        )}
      </Typography>
    </Box>
  )
}

function ContentRow({ item, index }: { item: ReportData['publishedItems'][0]; index: number }) {
  const typeColor: Record<string, string> = {
    Post: '#F97316', Reel: '#60A5FA', Story: '#C084FC',
    Carrossel: '#FB7185', Feed: '#00C47A',
  }
  const color = typeColor[item.type] ?? '#F97316'

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 2,
      px: 2, py: 1.5,
      bgcolor: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
      borderRadius: 2,
      transition: 'bgcolor 0.15s',
    }}>
      <CheckCircleIcon sx={{ fontSize: 16, color: '#00C47A', flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{
          fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.title || '(sem título)'}
        </Typography>
      </Box>
      <Box sx={{
        px: 1, py: 0.3, borderRadius: 1,
        bgcolor: `${color}15`, border: `1px solid ${color}30`, flexShrink: 0,
      }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color, letterSpacing: '0.04em' }}>
          {item.type}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', flexShrink: 0, minWidth: 70, textAlign: 'right' }}>
        {item.date}
      </Typography>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReportPage({ token }: { token: string }) {
  const [data, setData] = useState<ReportData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/report?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then((res: { ok: boolean; data?: ReportData; error?: string }) => {
        if (res.ok && res.data) setData(res.data)
        else setError(res.error ?? 'Relatório não encontrado')
      })
      .catch(() => setError('Erro ao carregar o relatório'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#08090E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress sx={{ color: '#F97316' }} />
    </Box>
  )

  if (error || !data) return (
    <Box sx={{
      minHeight: '100dvh', bgcolor: '#08090E',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, p: 4,
    }}>
      <Typography sx={{ fontSize: '3rem' }}>📭</Typography>
      <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
        Relatório não encontrado
      </Typography>
      <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
        O link pode ter expirado ou está incorreto.
      </Typography>
    </Box>
  )

  const { stats, publishedItems, agency, highlights } = data
  const deliveryPct = pct(stats.totalDelivered, stats.totalPlanned)
  const approvalPct = pct(stats.approvedByClient, stats.sentToClient)
  const waLink = `https://wa.me/${agency.whatsapp}?text=${encodeURIComponent(`Olá ${agency.name}! Vi meu relatório e quero conversar sobre os próximos passos.`)}`

  return (
    <Box sx={{
      minHeight: '100dvh',
      bgcolor: '#08090E',
      fontFamily: '"Inter", system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased',
      // Grid de fundo
      backgroundImage: `linear-gradient(rgba(249,115,22,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.025) 1px, transparent 1px)`,
      backgroundSize: '48px 48px',
    }}>
      <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>

        {/* ── Header ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box component="img" src="/logotipo.png" alt={agency.name}
              sx={{ height: 32, objectFit: 'contain' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
            <Box>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: 'rgba(255,255,255,0.9)', lineHeight: 1 }}>
                {agency.name}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.2 }}>
                {agency.tagline}
              </Typography>
            </Box>
          </Box>
          <Box sx={{
            px: 1.5, py: 0.6, borderRadius: 99,
            bgcolor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)',
          }}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#F97316', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Relatório Mensal
            </Typography>
          </Box>
        </Box>

        {/* ── Hero ── */}
        <Box sx={{
          mb: 5, p: { xs: 3, md: 4 }, borderRadius: 4,
          background: `linear-gradient(135deg, rgba(249,115,22,0.1) 0%, rgba(255,83,57,0.06) 100%)`,
          border: '1px solid rgba(249,115,22,0.2)',
          position: 'relative', overflow: 'hidden',
          '&::before': {
            content: '""', position: 'absolute', top: -60, right: -60,
            width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          },
        }}>
          {/* Client avatar */}
          <Box sx={{
            width: 52, height: 52, borderRadius: '14px', mb: 2,
            background: `linear-gradient(135deg, ${data.clientColor || '#F97316'}, ${data.clientColor || '#F97316'}99)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 20px ${data.clientColor || '#F97316'}40`,
          }}>
            <Typography sx={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
              {data.clientInitials}
            </Typography>
          </Box>

          <Typography sx={{
            fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5,
          }}>
            {data.month}
          </Typography>
          <Typography sx={{
            fontSize: { xs: '1.8rem', md: '2.4rem' }, fontWeight: 900,
            letterSpacing: '-0.03em', lineHeight: 1.1, color: 'rgba(255,255,255,0.95)',
            mb: 1,
          }}>
            {data.clientName}
          </Typography>
          <Typography sx={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            Sua presença digital em números — produzido com dedicação por {agency.name}.
          </Typography>

          {/* Big delivery number */}
          <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box>
              <Typography sx={{
                fontSize: '3.5rem', fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1,
                background: deliveryPct === 100 ? 'linear-gradient(135deg, #00C47A, #22D96A)' : 'linear-gradient(135deg, #F97316, #FF5339)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {deliveryPct}%
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', mt: 0.3, fontWeight: 600 }}>
                de entregas concluídas
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <LinearProgress variant="determinate" value={deliveryPct} sx={{
                height: 8, borderRadius: 4,
                bgcolor: 'rgba(255,255,255,0.08)',
                '& .MuiLinearProgress-bar': {
                  background: deliveryPct === 100 ? 'linear-gradient(90deg, #00C47A, #22D96A)' : 'linear-gradient(90deg, #F97316, #FF5339)',
                  borderRadius: 4,
                },
              }} />
              <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', mt: 0.8 }}>
                {stats.totalDelivered} de {stats.totalPlanned} conteúdos publicados
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* ── KPI cards ── */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 4 }}>
          <StatCard emoji="📸" label="Posts publicados"   value={stats.postsPublished}  total={stats.postsTotal}  color="#F97316" />
          <StatCard emoji="🎬" label="Reels publicados"   value={stats.reelsPublished}  total={stats.reelsTotal}  color="#60A5FA" />
          {stats.storiesTotal > 0 && (
            <StatCard emoji="⚡" label="Stories publicados" value={stats.storiesPublished} total={stats.storiesTotal} color="#C084FC" />
          )}
          {stats.sentToClient > 0 && (
            <StatCard emoji="✅" label="Aprovação do cliente" value={stats.approvedByClient} total={stats.sentToClient} color="#00C47A" />
          )}
        </Box>

        {/* ── Aprovação rate destaque ── */}
        {stats.sentToClient > 0 && (
          <Box sx={{
            mb: 4, p: 3, borderRadius: 3,
            bgcolor: approvalPct >= 80 ? 'rgba(0,196,122,0.06)' : 'rgba(249,115,22,0.06)',
            border: `1px solid ${approvalPct >= 80 ? 'rgba(0,196,122,0.2)' : 'rgba(249,115,22,0.2)'}`,
            display: 'flex', alignItems: 'center', gap: 2,
          }}>
            <Typography sx={{ fontSize: '2rem' }}>{approvalPct >= 80 ? '🎉' : '📋'}</Typography>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'rgba(255,255,255,0.9)', mb: 0.3 }}>
                {approvalPct >= 80
                  ? `${approvalPct}% de aprovação — excelente colaboração!`
                  : `${approvalPct}% de aprovação no mês`}
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                {stats.approvedByClient} aprovados de {stats.sentToClient} enviados ao cliente
              </Typography>
            </Box>
          </Box>
        )}

        {/* ── Highlights ── */}
        {highlights.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Typography sx={{
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', mb: 2,
            }}>
              Destaques do mês
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {highlights.map((h, i) => (
                <Box key={i} sx={{
                  display: 'flex', alignItems: 'flex-start', gap: 1.5,
                  px: 2, py: 1.5, borderRadius: 2,
                  bgcolor: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.12)',
                }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#F97316', mt: 0.6, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
                    {h}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* ── Lista de publicados ── */}
        {publishedItems.length > 0 && (
          <Box sx={{ mb: 5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{
                fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)',
              }}>
                Conteúdos publicados
              </Typography>
              <Box sx={{ px: 1.2, py: 0.4, borderRadius: 99, bgcolor: 'rgba(255,255,255,0.06)' }}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
                  {publishedItems.length} itens
                </Typography>
              </Box>
            </Box>
            <Box sx={{
              borderRadius: 3, overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              {publishedItems.map((item, i) => (
                <ContentRow key={i} item={item} index={i} />
              ))}
            </Box>
          </Box>
        )}

        {/* ── Divisor ── */}
        <Box sx={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.2), transparent)', mb: 5 }} />

        {/* ── CTA ── */}
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, color: 'rgba(255,255,255,0.9)', mb: 1, letterSpacing: '-0.02em' }}>
            Quer continuar crescendo?
          </Typography>
          <Typography sx={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.45)', mb: 3 }}>
            Fale com a gente e planeje os próximos passos da sua presença digital.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Box
              component="a"
              href={waLink}
              target="_blank"
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 1,
                px: 3, py: 1.5, borderRadius: 99,
                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                color: '#fff', fontWeight: 800, fontSize: '0.9rem',
                textDecoration: 'none',
                boxShadow: '0 4px 20px rgba(37,211,102,0.3)',
                transition: 'all 0.2s',
                '&:hover': { filter: 'brightness(1.1)', transform: 'translateY(-1px)' },
              }}
            >
              <WhatsAppIcon sx={{ fontSize: 18 }} />
              Falar no WhatsApp
            </Box>
            {agency.instagram && (
              <Box
                component="a"
                href={agency.instagram}
                target="_blank"
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 1,
                  px: 3, py: 1.5, borderRadius: 99,
                  bgcolor: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: '0.9rem',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                }}
              >
                <InstagramIcon sx={{ fontSize: 18 }} />
                Instagram
              </Box>
            )}
          </Box>
        </Box>

        {/* ── Footer ── */}
        <Box sx={{ textAlign: 'center', pb: 4 }}>
          <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.2)' }}>
            Relatório gerado em {new Date(data.generatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            {data.generatedBy ? ` por ${data.generatedBy}` : ''}
            {' · '}{agency.name}
          </Typography>
        </Box>

      </Box>
    </Box>
  )
}
