/**
 * O calendário da aba Agendamento (2026-10-19) — semana ou mês, como o
 * planejador do Meta Business Suite, nas cores do painel. Cada post fica no
 * dia em que vai ao ar (ou saiu), com hora, miniatura, cliente e a situação no
 * Instagram e no Facebook. Clicar leva à ação principal; o "⋯" tem o resto.
 */
import { useState } from 'react'
import { Box, IconButton, Menu, MenuItem, Tooltip, Typography } from '@mui/material'
import InstagramIcon from '@mui/icons-material/Instagram'
import FacebookIcon from '@mui/icons-material/Facebook'
import CollectionsIcon from '@mui/icons-material/Collections'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import type { ItemState } from '../../types'
import { STATUS_CONFIG } from '../../types'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import { classifyCreativeLink } from '../../lib/creativeLink'
import { REDES, type AgendamentosDoCard, type IgConta, type Rede } from '../../lib/instagram'
import { chaveDia, type PostDaAgenda, type SituacaoAgenda } from '../../lib/agenda'
import { nomeDoCliente } from '../../lib/clientes'

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const COR_SITUACAO: Record<SituacaoAgenda, string> = {
  aprovar: DS.amber,
  agendado: STATUS_CONFIG[9].color,
  publicado: DS.green,
}
export const ROTULO_SITUACAO: Record<SituacaoAgenda, string> = {
  aprovar: 'Para aprovar',
  agendado: 'Agendado',
  publicado: 'Publicado',
}
const ICONE: Record<Rede, typeof InstagramIcon> = { instagram: InstagramIcon, facebook: FacebookIcon }

/** Miniatura do criativo: o anexo do Social, senão o arquivo do Drive do card. */
export function Miniatura({ st, largura, altura }: { st?: ItemState; largura: number | string | Record<string, number>; altura: number | Record<string, number> }) {
  const link = classifyCreativeLink(st?.link)
  return (
    <Box sx={{ width: largura, height: altura, flexShrink: 0, borderRadius: '7px', overflow: 'hidden', bgcolor: DS.field, border: `1px solid ${DS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {st?.anexos?.length
        ? (st.anexos[0].tipo.startsWith('video/')
            ? <Box component="video" src={st.anexos[0].url} muted preload="metadata" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Box component="img" src={st.anexos[0].url} alt="" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />)
        : link.kind === 'file' && link.id
          ? <Box component="img" src={`/api/thumb?id=${encodeURIComponent(link.id)}`} alt="" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : link.kind === 'folder'
            ? <CollectionsIcon sx={{ fontSize: 16, color: DS.t3 }} />
            : <Typography sx={{ fontSize: '0.5rem', color: DS.t4, textAlign: 'center', px: 0.3 }}>sem mídia</Typography>}
    </Box>
  )
}

export interface AcoesDoPost {
  onProgramar: (id: number) => void
  onRevisar: (id: number) => void
  onDesagendar: (id: number) => void
  onManual: (id: number) => void
}

export default function CalendarioAgenda({ modo, dias, mesRef, porDia, hoje, states, contaDe, igPorItem, acoes }: {
  modo: 'semana' | 'mes'
  dias: Date[]
  /** Mês de referência (na grade do mês, dias de fora ficam apagados). */
  mesRef: number
  porDia: Map<string, PostDaAgenda[]>
  hoje: Date
  states: Record<number, ItemState>
  contaDe: (c: string) => IgConta | undefined
  igPorItem: Record<number, AgendamentosDoCard>
  acoes: AcoesDoPost
}) {
  const [menu, setMenu] = useState<{ el: HTMLElement; post: PostDaAgenda } | null>(null)
  const ehHoje = (d: Date) => chaveDia(d) === chaveDia(hoje)

  const principal = (p: PostDaAgenda) => {
    if (p.situacao === 'aprovar') acoes.onProgramar(p.item.i)
    else if (p.situacao === 'agendado') acoes.onRevisar(p.item.i)
    else {
      const st = states[p.item.i]
      const link = st?.igPermalink || st?.fbPermalink
      if (link) window.open(link, '_blank', 'noopener')
    }
  }

  const redesDoPost = (p: PostDaAgenda) => {
    const conta = contaDe(p.item.c)
    const ag = igPorItem[p.item.i]
    return REDES.map(r => {
      const a = ag?.[r]
      const ligado = r === 'instagram' ? !!conta?.perfil : !!conta?.pagina
      if (!ligado && !a) return null
      const cor = a?.status === 'failed' ? DS.red : a?.status === 'published' ? DS.green : a && a.status !== 'cancelled' ? DS.t1 : DS.t4
      const dica = a?.status === 'failed' ? `não publicou: ${a.erro ?? 'erro'}` : a?.status === 'published' ? 'publicado' : a && a.status !== 'cancelled' ? 'sai sozinho' : 'conectado'
      return { r, cor, dica }
    }).filter(Boolean) as { r: Rede; cor: string; dica: string }[]
  }

  const falhou = (p: PostDaAgenda) => REDES.some(r => igPorItem[p.item.i]?.[r]?.status === 'failed')

  const cartaoSemana = (p: PostDaAgenda) => {
    const st = states[p.item.i]
    const cor = falhou(p) ? DS.red : COR_SITUACAO[p.situacao]
    const vencido = p.situacao !== 'publicado' && p.quando.getTime() <= hoje.getTime() && !!p.hora
    return (
      <Box key={p.item.i} {...clickable(() => principal(p))} sx={{
        position: 'relative', p: 0.9, borderRadius: '9px', cursor: 'pointer', bgcolor: DS.surfaceAlt,
        border: `1px solid ${DS.border}`, borderTop: `2.5px solid ${cor}`, transition: 'all 0.18s ease',
        '&:hover': { borderColor: DS.borderHov, transform: 'translateY(-1px)' },
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.6 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cor, flexShrink: 0 }} />
          <Typography sx={{ fontSize: { xs: '0.66rem', xl: '0.74rem' }, fontWeight: 800, color: vencido ? DS.red : DS.t1 }}>{p.hora ?? 'sem horário'}</Typography>
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" aria-label="Mais ações" onClick={e => { e.stopPropagation(); setMenu({ el: e.currentTarget, post: p }) }}
            sx={{ p: 0.2, color: DS.t3, '&:hover': { color: DS.t1 } }}>
            <MoreHorizIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
        <Miniatura st={st} largura="100%" altura={{ xs: 70, xl: 96 }} />
        <Typography noWrap sx={{ mt: 0.6, fontSize: { xs: '0.6rem', xl: '0.68rem' }, fontWeight: 700, color: DS.t3 }}>{nomeDoCliente(p.item.c)} · {p.item.tp}</Typography>
        <Typography sx={{ fontSize: { xs: '0.7rem', xl: '0.78rem' }, fontWeight: 700, color: DS.t1, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {st?.title || p.item.n}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.6 }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: cor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {falhou(p) ? 'Falhou' : ROTULO_SITUACAO[p.situacao]}
          </Typography>
          <Box sx={{ flex: 1 }} />
          {redesDoPost(p).map(({ r, cor: c, dica }) => {
            const Icone = ICONE[r]
            return <Tooltip key={r} title={dica}><Icone sx={{ fontSize: 14, color: c }} /></Tooltip>
          })}
        </Box>
      </Box>
    )
  }

  const chipMes = (p: PostDaAgenda) => {
    const cor = falhou(p) ? DS.red : COR_SITUACAO[p.situacao]
    const st = states[p.item.i]
    return (
      <Tooltip key={p.item.i} title={`${nomeDoCliente(p.item.c)} · ${st?.title || p.item.n} — ${falhou(p) ? 'falhou' : ROTULO_SITUACAO[p.situacao].toLowerCase()}`} enterDelay={400}>
        <Box {...clickable(() => principal(p))} onContextMenu={e => { e.preventDefault(); setMenu({ el: e.currentTarget, post: p }) }}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.6, py: 0.3, borderRadius: '6px', cursor: 'pointer', bgcolor: DS.surfaceAlt, borderLeft: `2.5px solid ${cor}`, minWidth: 0, '&:hover': { bgcolor: `${DS.accent}14` } }}>
          <Typography sx={{ fontSize: { xs: '0.56rem', xl: '0.64rem' }, fontWeight: 800, color: DS.t1, flexShrink: 0 }}>{p.hora ?? '—'}</Typography>
          <Typography noWrap sx={{ fontSize: { xs: '0.56rem', xl: '0.64rem' }, color: DS.t2, minWidth: 0 }}>{nomeDoCliente(p.item.c)}</Typography>
        </Box>
      </Tooltip>
    )
  }

  return (
    <Box sx={{ borderRadius: '14px', border: `1px solid ${DS.border}`, bgcolor: DS.surface, overflow: 'hidden' }}>
      {/* Cabeçalho dos dias */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: `1px solid ${DS.border}` }}>
        {(modo === 'semana' ? dias : dias.slice(0, 7)).map(d => (
          <Box key={chaveDia(d)} sx={{ py: 1, display: 'flex', justifyContent: 'center' }}>
            <Typography sx={{
              px: 1.4, py: 0.3, borderRadius: '7px', fontSize: { xs: '0.66rem', md: '0.76rem', xl: '0.86rem' }, fontWeight: 700,
              ...(modo === 'semana' && ehHoje(d) ? { bgcolor: DS.accent, color: DS.onAccent } : { color: DS.t2 }),
            }}>
              {modo === 'semana' ? `${SEMANA[d.getDay()]} ${d.getDate()}` : SEMANA[d.getDay()]}
            </Typography>
          </Box>
        ))}
      </Box>

      {modo === 'semana' ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', minHeight: { xs: 360, md: 520, xl: 680 } }}>
          {dias.map((d, i) => {
            const posts = porDia.get(chaveDia(d)) ?? []
            return (
              <Box key={chaveDia(d)} sx={{
                p: 0.7, display: 'flex', flexDirection: 'column', gap: 0.7, minWidth: 0,
                borderLeft: i ? `1px solid ${DS.border}` : 'none',
                bgcolor: ehHoje(d) ? `${DS.accent}0a` : 'transparent',
                boxShadow: ehHoje(d) ? `inset 0 0 0 1px ${DS.accent}55` : 'none',
              }}>
                {posts.map(cartaoSemana)}
              </Box>
            )
          })}
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {dias.map((d, i) => {
            const posts = porDia.get(chaveDia(d)) ?? []
            const fora = d.getMonth() !== mesRef
            return (
              <Box key={chaveDia(d)} sx={{
                minHeight: { xs: 78, md: 104, xl: 130 }, p: 0.6, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.4,
                borderLeft: i % 7 ? `1px solid ${DS.border}` : 'none', borderTop: i >= 7 ? `1px solid ${DS.border}` : 'none',
                opacity: fora ? 0.45 : 1, bgcolor: ehHoje(d) ? `${DS.accent}0a` : 'transparent',
              }}>
                <Typography sx={{
                  alignSelf: 'flex-start', px: 0.6, borderRadius: '6px', fontSize: { xs: '0.66rem', xl: '0.76rem' }, fontWeight: 800,
                  ...(ehHoje(d) ? { bgcolor: DS.accent, color: DS.onAccent } : { color: DS.t2 }),
                }}>{d.getDate()}</Typography>
                {posts.slice(0, 3).map(chipMes)}
                {posts.length > 3 && (
                  <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: DS.t3, px: 0.6 }}>+{posts.length - 3} mais</Typography>
                )}
              </Box>
            )
          })}
        </Box>
      )}

      <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
        {menu?.post.situacao === 'aprovar' && <MenuItem onClick={() => { acoes.onProgramar(menu.post.item.i); setMenu(null) }} sx={{ fontSize: '0.8rem' }}>Aprovar e programar</MenuItem>}
        {menu?.post.situacao === 'agendado' && <MenuItem onClick={() => { acoes.onRevisar(menu.post.item.i); setMenu(null) }} sx={{ fontSize: '0.8rem' }}>Revisar / remarcar</MenuItem>}
        {menu && menu.post.situacao !== 'publicado' && <MenuItem onClick={() => { acoes.onManual(menu.post.item.i); setMenu(null) }} sx={{ fontSize: '0.8rem' }}>Publiquei manualmente</MenuItem>}
        {menu?.post.situacao === 'agendado' && <MenuItem onClick={() => { acoes.onDesagendar(menu.post.item.i); setMenu(null) }} sx={{ fontSize: '0.8rem', color: DS.redSoft }}>Desagendar</MenuItem>}
        {menu?.post.situacao === 'publicado' && <MenuItem disabled sx={{ fontSize: '0.8rem' }}>Publicado — abre o post ao clicar no cartão</MenuItem>}
      </Menu>
    </Box>
  )
}
