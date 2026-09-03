import { useMemo, useState } from 'react'
import {
  Box, Typography, Paper, Button, CircularProgress, Chip, Tooltip,
} from '@mui/material'
import PhonelinkIcon from '@mui/icons-material/Phonelink'
import RefreshIcon from '@mui/icons-material/Refresh'
import VisibilityIcon from '@mui/icons-material/Visibility'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import MovieIcon from '@mui/icons-material/Movie'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import type { ContentItem, ItemState } from '../types'
import { DS } from '../theme'
import PageHero from '../shared/ui/PageHero'
import KpiCard from '../shared/ui/KpiCard'
import EmptyState from '../shared/ui/EmptyState'
import {
  describeDetail, describePlatform, refreshViewerEvents, summarize, useViewerEvents,
  type ViewerEvent,
} from '../lib/viewerEvents'
import MirrorCoveragePanel from './MirrorCoveragePanel'

/**
 * O que aconteceu na tela do cliente.
 *
 * O `/api/viewer-log` grava desde 2026-07-22 (abriu, reproduziu, falhou — com
 * plataforma e código do erro), mas **nada lia esse registro**: o dado existia e
 * ninguém conseguia olhar. A pergunta "quem não conseguiu ver e em qual
 * aparelho" continuava sendo respondida por WhatsApp, de memória.
 *
 * Esta tela é a leitura. Ela não inventa métrica de vaidade: mostra contagem
 * crua, quebra por aparelho — que é a pergunta real, iPhone ou Android — e a
 * lista de falhas com cliente, conteúdo e motivo, para dar de agir.
 */

const PERIODS = [
  { key: 7,   label: '7 dias'  },
  { key: 30,  label: '30 dias' },
  { key: 0,   label: 'Tudo'    },
] as const

/** Contagem de um player, para a comparação lado a lado. */
interface PlayerRow {
  aberturas: number
  travadas: number
  completas: number
  /** Só o `stream` produz: é a queda dele para o arquivo original. */
  quedas: number
}

const playerVazio = (): PlayerRow => ({ aberturas: 0, travadas: 0, completas: 0, quedas: 0 })

/** "—" quando não houve abertura: 0% sobre zero afirmaria um fracasso inexistente. */
const pct = (parte: number, total: number): string =>
  total === 0 ? '—' : `${Math.round((parte / total) * 100)}%`

interface PlatformRow {
  name: string
  opened: number
  failed: number
  affected: number
}

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  /** O relógio do App, que já pulsa — usar `Date.now()` aqui congelaria os
   *  "há 2 h" no primeiro render e seria chamada impura durante a renderização. */
  now: Date
}

export default function EntregasTab({ items, states, now }: Props) {
  // Mesma fonte que o card usa (`ClientReachStrip`): um poller só no app, e a
  // aba e o card nunca discordam sobre o que aconteceu com o cliente.
  const { events, loading, error } = useViewerEvents()
  const [days, setDays] = useState<number>(7)
  // O botão de recarregar precisa valer para a tela inteira. A cobertura do
  // espelho não tem poller próprio (cada leitura custa um `head` por arquivo no
  // R2), então quem a atualiza é este contador.
  const [reloadKey, setReloadKey] = useState(0)

  const titleOf = useMemo(() => {
    const byId = new Map(items.map(i => [i.i, i.n]))
    return (id: number) => states[id]?.title || byId.get(id) || `Item ${id}`
  }, [items, states])

  const view = useMemo(() => {
    const all = events
    const cutoff = days > 0 ? now.getTime() - days * 24 * 60 * 60 * 1000 : 0
    const window = all.filter(e => e.ts > cutoff)

    const isFail = (e: ViewerEvent) => e.event === 'error' || e.event === 'fallback'

    const opened = window.filter(e => e.event === 'opened').length
    const fails  = window.filter(isFail)

    // ⚠️ Contar EVENTOS `playing` era mentira: ele dispara de novo a cada
    // retomada depois de travar, então um vídeo engasgando oito vezes contava
    // como oito reproduções bem-sucedidas. O número honesto é quantos
    // CRIATIVOS distintos chegaram a rodar.
    const byItem = summarize(window)
    let played = 0
    let stuck  = 0
    for (const s of byItem.values()) {
      if (s.played) played += 1
      if (s.struggles > 0) stuck += 1
    }

    const byPlatform = new Map<string, PlatformRow>()
    for (const e of window) {
      const name = describePlatform(e.platform)
      const row = byPlatform.get(name) ?? { name, opened: 0, failed: 0, affected: 0 }
      if (e.event === 'opened') row.opened += 1
      if (isFail(e)) row.failed += 1
      byPlatform.set(name, row)
    }
    for (const [name, row] of byPlatform) {
      row.affected = new Set(fails.filter(e => describePlatform(e.platform) === name).map(e => e.itemId)).size
      byPlatform.set(name, row)
    }

    const platforms = [...byPlatform.values()].sort((a, b) => b.failed - a.failed || b.opened - a.opened)

    /* Player adaptativo × arquivo original, lado a lado.
       Sem separar, o número enganava: medido em 03/09, travamentos por abertura
       subiram de 0,42 para 0,86 depois da transcodificação, enquanto a taxa de
       quem chega ao FIM quase dobrou. Os dois players contam "travou" de formas
       diferentes — o HLS emite o evento a cada troca de rendição, que é o
       mecanismo que EVITA a parada. Comparados como a mesma coisa, o player que
       funciona parece o pior.
       Eventos anteriores a 03/09 não têm o campo e ficam de fora dos DOIS
       lados: atribuí-los a um chute inventaria a comparação que a separação
       existe para tornar possível. */
    const porPlayer = { stream: playerVazio(), arquivo: playerVazio() }
    for (const e of window) {
      const alvo = e.player === 'stream' ? porPlayer.stream : e.player === 'arquivo' ? porPlayer.arquivo : null
      if (!alvo) continue
      if (e.event === 'opened') alvo.aberturas += 1
      if (e.event === 'stalled') alvo.travadas += 1
      if (e.event === 'ended') alvo.completas += 1
      if (e.event === 'fallback') alvo.quedas += 1
    }

    return {
      total: window.length,
      opened,
      played,
      stuck,
      porPlayer,
      failCount: fails.length,
      platforms,
      recentFails: [...fails].sort((a, b) => b.ts - a.ts).slice(0, 40),
    }
  }, [events, days, now])

  const fmtWhen = (ts: number) => {
    const d = new Date(ts)
    const mins = Math.round((now.getTime() - ts) / 60000)
    if (mins < 60) return `há ${Math.max(mins, 1)} min`
    if (mins < 60 * 24) return `há ${Math.round(mins / 60)} h`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 2.6 } }}>
      <PageHero
        icon={<PhonelinkIcon sx={{ fontSize: { xs: 24, md: 28, xl: 32 } }} />}
        title="Entregas"
        subtitle="Quem abriu o link do criativo, quem conseguiu ver e quem falhou — pelo aparelho do cliente"
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            {PERIODS.map(p => (
              <Button
                key={p.key}
                size="small"
                onClick={() => setDays(p.key)}
                sx={{
                  minWidth: 0, px: 1.4, py: 0.5, borderRadius: '8px',
                  fontSize: { xs: '0.64rem', xl: '0.72rem' }, fontWeight: 700,
                  color: days === p.key ? DS.accent : DS.t2,
                  bgcolor: days === p.key ? 'rgba(59,130,246,0.12)' : 'transparent',
                  border: `1px solid ${days === p.key ? 'rgba(59,130,246,0.3)' : DS.borderSoft}`,
                }}
              >
                {p.label}
              </Button>
            ))}
            <Tooltip title="Recarregar">
              <span>
                <Button
                  size="small"
                  onClick={() => { void refreshViewerEvents(); setReloadKey(n => n + 1) }}
                  disabled={loading}
                  sx={{ minWidth: 0, px: 1.2, py: 0.5, borderRadius: '8px', color: DS.t2, border: `1px solid ${DS.borderSoft}` }}
                >
                  <RefreshIcon sx={{ fontSize: 15 }} />
                </Button>
              </span>
            </Tooltip>
          </Box>
        }
      />

      {/* Antes dos números de quem viu: os criativos no ar realmente saem do
          nosso espelho? Enquanto não saem, o link do cliente depende de o
          arquivo continuar na pasta Publicar. */}
      <MirrorCoveragePanel reloadKey={reloadKey} />

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={26} sx={{ color: DS.accent }} />
        </Box>
      )}

      {!loading && error && (
        <Paper sx={{ p: 2, border: '1px solid rgba(239,68,68,0.28)', bgcolor: 'rgba(239,68,68,0.06)' }}>
          <Typography sx={{ fontSize: '0.78rem', color: DS.redSoft, fontWeight: 700 }}>
            Não consegui ler o registro de visualizações.
          </Typography>
          <Typography sx={{ fontSize: '0.68rem', color: DS.t2, mt: 0.4 }}>
            {error} — isto não quer dizer que não houve falha; quer dizer que não deu para olhar.
          </Typography>
        </Paper>
      )}

      {!loading && !error && view.total === 0 && (
        <EmptyState
          icon={<PhonelinkIcon />}
          title="Nenhum registro no período"
          subtitle="Assim que um cliente abrir um link de criativo, a abertura aparece aqui — e a falha, se houver."
          color={DS.accent}
        />
      )}

      {!loading && !error && view.total > 0 && (
        <>
          <Box sx={{
            display: 'grid', gap: { xs: 1.2, md: 1.6 },
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          }}>
            <KpiCard label="Aberturas" value={view.opened} color={DS.accent} icon={<VisibilityIcon sx={{ fontSize: 17 }} />} />
            <KpiCard
              label="Rodaram" value={view.played} sub="criativos que chegaram a tocar"
              color={DS.green} icon={<PlayCircleIcon sx={{ fontSize: 17 }} />}
            />
            <KpiCard
              label="Travaram" value={view.stuck}
              sub={view.stuck > 0 ? 'abriram, mas engasgaram' : 'nenhum engasgou'}
              color={view.stuck > 0 ? DS.alert : DS.t3}
              icon={<MovieIcon sx={{ fontSize: 17 }} />}
            />
            <KpiCard label="Falhas" value={view.failCount} color={view.failCount > 0 ? DS.red : DS.t3} icon={<ErrorOutlineIcon sx={{ fontSize: 17 }} />} />
          </Box>

          {/* Player adaptativo × arquivo original.
              Só aparece quando HÁ os dois lados para comparar: com um lado
              zerado isto não é comparação, é um número solto com moldura de
              comparação — e moldura de comparação sobre nada engana mais que
              não mostrar. */}
          {(view.porPlayer.stream.aberturas > 0 && view.porPlayer.arquivo.aberturas > 0) && (
            <Paper sx={{ p: { xs: 1.6, md: 2 } }}>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: DS.t2, mb: 0.6 }}>
                Player adaptativo × arquivo original
              </Typography>
              <Typography sx={{ fontSize: '0.66rem', color: DS.t3, mb: 1.2, lineHeight: 1.5 }}>
                Os dois contam "travou" de formas diferentes — o adaptativo marca cada troca
                de qualidade, que é justamente o que evita a parada. Compare a coluna
                <strong> chegou ao fim</strong>, que significa a mesma coisa nos dois.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                {([
                  ['Adaptativo (Cloudflare Stream)', view.porPlayer.stream, DS.green],
                  ['Arquivo original', view.porPlayer.arquivo, DS.t2],
                ] as const).map(([nome, r, cor]) => (
                  <Box key={nome} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap',
                    px: 1.2, py: 0.9, borderRadius: '10px',
                    bgcolor: 'rgba(148,163,184,0.04)', border: `1px solid ${DS.borderSoft}`,
                  }}>
                    <Typography sx={{ fontSize: { xs: '0.76rem', xl: '0.86rem' }, fontWeight: 700, color: cor, flex: 1, minWidth: 120 }} noWrap>
                      {nome}
                    </Typography>
                    <Typography sx={{ fontSize: { xs: '0.66rem', xl: '0.74rem' }, color: DS.t2 }}>
                      {r.aberturas} {r.aberturas === 1 ? 'abertura' : 'aberturas'}
                    </Typography>
                    <Typography sx={{ fontSize: { xs: '0.66rem', xl: '0.74rem' }, color: r.completas > 0 ? DS.green : DS.t3, fontWeight: 700 }}>
                      {pct(r.completas, r.aberturas)} chegou ao fim
                    </Typography>
                    <Typography sx={{ fontSize: { xs: '0.66rem', xl: '0.74rem' }, color: DS.t3 }}>
                      {r.travadas} {r.travadas === 1 ? 'travada' : 'travadas'}
                    </Typography>
                    {r.quedas > 0 && (
                      <Typography sx={{ fontSize: { xs: '0.66rem', xl: '0.74rem' }, color: DS.alert, fontWeight: 700 }}>
                        {r.quedas} {r.quedas === 1 ? 'queda para o arquivo' : 'quedas para o arquivo'}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </Paper>
          )}

          {/* A pergunta real: iPhone, Android, ou os dois? */}
          <Paper sx={{ p: { xs: 1.6, md: 2 } }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: DS.t2, mb: 1.2 }}>
              Por aparelho
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              {view.platforms.map(p => (
                <Box key={p.name} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.2,
                  px: 1.2, py: 0.9, borderRadius: '10px',
                  bgcolor: p.failed > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(148,163,184,0.04)',
                  border: `1px solid ${p.failed > 0 ? 'rgba(239,68,68,0.2)' : DS.borderSoft}`,
                }}>
                  <Typography sx={{ fontSize: { xs: '0.76rem', xl: '0.86rem' }, fontWeight: 700, color: DS.t1, flex: 1, minWidth: 0 }} noWrap>
                    {p.name}
                  </Typography>
                  <Typography sx={{ fontSize: { xs: '0.66rem', xl: '0.74rem' }, color: DS.t2 }}>
                    {p.opened} {p.opened === 1 ? 'abertura' : 'aberturas'}
                  </Typography>
                  {p.failed > 0 ? (
                    <Chip
                      size="small"
                      label={`${p.failed} ${p.failed === 1 ? 'falha' : 'falhas'} · ${p.affected} ${p.affected === 1 ? 'criativo' : 'criativos'}`}
                      sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgba(239,68,68,0.14)', color: DS.redSoft, border: '1px solid rgba(239,68,68,0.3)' }}
                    />
                  ) : (
                    <Chip
                      size="small" icon={<CheckCircleIcon sx={{ fontSize: 12 }} />} label="sem falha"
                      sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgba(49,209,124,0.12)', color: DS.green, border: '1px solid rgba(49,209,124,0.28)', '& .MuiChip-icon': { color: DS.green } }}
                    />
                  )}
                </Box>
              ))}
            </Box>
          </Paper>

          <Paper sx={{ p: { xs: 1.6, md: 2 } }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: DS.t2, mb: 1.2 }}>
              Falhas recentes
            </Typography>

            {view.recentFails.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.4 }}>
                {/* "Nenhuma falha" não é o mesmo que "todo mundo viu": um vídeo
                    que engasga até o cliente desistir não gera falha nenhuma.
                    Foi exatamente essa confusão que fez a reclamação da Kátia
                    chegar por WhatsApp com o painel dizendo que estava tudo bem. */}
                {view.stuck > 0 ? (
                  <>
                    <MovieIcon sx={{ fontSize: 18, color: DS.alert }} />
                    <Typography sx={{ fontSize: '0.76rem', color: DS.t2 }}>
                      Nenhum erro no período — mas {view.stuck}{' '}
                      {view.stuck === 1 ? 'criativo travou' : 'criativos travaram'} durante a
                      reprodução. Travar não gera erro, e mesmo assim o cliente não assiste.
                    </Typography>
                  </>
                ) : (
                  <>
                    <CheckCircleIcon sx={{ fontSize: 18, color: DS.green }} />
                    <Typography sx={{ fontSize: '0.76rem', color: DS.t2 }}>
                      Nenhuma falha no período — todo mundo que abriu conseguiu ver.
                    </Typography>
                  </>
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7 }}>
                {view.recentFails.map((e, n) => (
                  <Box key={`${e.ts}-${e.itemId}-${n}`} sx={{
                    display: 'flex', alignItems: { xs: 'flex-start', md: 'center' },
                    flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 0.4, md: 1.2 },
                    px: 1.2, py: 0.9, borderRadius: '10px',
                    bgcolor: 'rgba(148,163,184,0.04)', border: `1px solid ${DS.borderSoft}`,
                  }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: { xs: '0.74rem', xl: '0.82rem' }, fontWeight: 700, color: DS.t1 }} noWrap>
                        {titleOf(e.itemId)}
                      </Typography>
                      <Typography sx={{ fontSize: { xs: '0.62rem', xl: '0.68rem' }, color: DS.t2 }} noWrap>
                        {e.client} · {describeDetail(e.detail)}
                      </Typography>
                    </Box>
                    <Chip
                      size="small" label={describePlatform(e.platform)}
                      sx={{ height: 19, fontSize: '0.58rem', fontWeight: 700, bgcolor: 'rgba(59,130,246,0.1)', color: DS.accent, border: '1px solid rgba(59,130,246,0.26)' }}
                    />
                    <Tooltip title={new Date(e.ts).toLocaleString('pt-BR')}>
                      <Typography sx={{ fontSize: { xs: '0.6rem', xl: '0.66rem' }, color: DS.t3, flexShrink: 0, minWidth: { md: 74 }, textAlign: { md: 'right' } }}>
                        {fmtWhen(e.ts)}
                      </Typography>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>

          <Typography sx={{ fontSize: '0.62rem', color: DS.t3, textAlign: 'center', pb: 1 }}>
            O registro guarda os últimos 300 eventos, por até 30 dias — serve para achar padrão recente, não para auditoria.
          </Typography>
        </>
      )}
    </Box>
  )
}
