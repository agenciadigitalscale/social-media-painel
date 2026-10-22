/**
 * Aba 38 — "Última postagem" (2026-10-20), só sócios e Social Media: o aviso
 * para nenhum cliente ficar sem post. Para cada cliente mensal ativo, o último
 * vídeo e a última foto que foram ao ar (Instagram real quando conectado, senão
 * o painel), há quantos dias, e a próxima postagem planejada. O mais urgente
 * vem primeiro. Regras em lib/ultimaPostagem (testadas).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Button, TextField, Tooltip, Typography } from '@mui/material'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import InstagramIcon from '@mui/icons-material/Instagram'
import FacebookIcon from '@mui/icons-material/Facebook'
import RefreshIcon from '@mui/icons-material/Refresh'
import type { ContentItem, ItemState } from '../types'
import { STATUS_CONFIG } from '../types'
import { DS } from '../theme'
import { clickable } from '../shared/a11y'
import { nomeDoCliente, useCarteira } from '../lib/clientes'
import { ativoNoMes, naCarteira } from '../lib/planejamentoMes'
import {
  buscarUltimasIG, ultimasDoCliente, diasDesde, nivelDoAviso, ordenarPorUrgencia, piorNivel, proximaDoCliente,
  ultimasDoPainel, type NivelAviso, type Postagem, type UltimasIG,
} from '../lib/ultimaPostagem'

const COR: Record<NivelAviso, string> = { ok: DS.green, atencao: DS.amber, atrasado: DS.red, nunca: DS.red }
const ROTULO: Record<NivelAviso, string> = { ok: 'Em dia', atencao: 'Atenção', atrasado: 'Atrasado', nunca: 'Sem postagem' }
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const pad = (n: number) => String(n).padStart(2, '0')
const dataCurta = (ts: number) => { const d = new Date(ts); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` }
const CAMPO = { '& .MuiInputBase-root': { fontSize: '0.78rem', bgcolor: DS.field, borderRadius: '9px', height: 36 } }

type Filtro = 'todos' | 'urgentes' | 'atencao' | 'ok'

export default function UltimaPostagemTab({ items, states, clients, now }: {
  items: ContentItem[]
  states: Record<number, ItemState>
  clients: string[]
  now: Date
}) {
  const carteira = useCarteira()
  const [ig, setIg] = useState<UltimasIG[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erroIG, setErroIG] = useState<string | null>(null)
  const [atualizadoEm, setAtualizadoEm] = useState<number | null>(null)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const carregar = useCallback(async () => {
    setCarregando(true)
    const r = await buscarUltimasIG()
    setCarregando(false)
    if (r.ok) { setIg(r.contas); setErroIG(null); setAtualizadoEm(Date.now()) } else setErroIG(r.error ?? 'Não deu para ler o Instagram agora.')
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  const agora = now.getTime()
  const linhas = useMemo(() => {
    const ativos = clients.filter(c => naCarteira(carteira, c).tipo === 'mensal' && ativoNoMes(carteira, c, now.getFullYear(), now.getMonth()))
    return ordenarPorUrgencia(ativos.map(c => {
      const conta = ig.find(x => x.clientName === c)
      const ultimas = ultimasDoCliente(ultimasDoPainel(items, states, c, agora), conta)
      return { id: c, nome: nomeDoCliente(c), ultimas, conta, proxima: proximaDoCliente(items, states, c, agora) }
    }), agora)
  }, [clients, carteira, ig, items, states, agora, now])

  const contagem = { urgentes: 0, atencao: 0, ok: 0 }
  for (const l of linhas) {
    const n = piorNivel(l.ultimas, agora)
    if (n === 'ok') contagem.ok++
    else if (n === 'atencao') contagem.atencao++
    else contagem.urgentes++
  }
  const q = busca.trim().toLowerCase()
  const visiveis = linhas.filter(l => {
    const n = piorNivel(l.ultimas, agora)
    if (filtro === 'urgentes' && n !== 'atrasado' && n !== 'nunca') return false
    if (filtro === 'atencao' && n !== 'atencao') return false
    if (filtro === 'ok' && n !== 'ok') return false
    return !q || `${l.nome} ${l.id}`.toLowerCase().includes(q)
  })

  const pill = (sel: boolean) => ({
    px: 1.4, height: 34, display: 'flex', alignItems: 'center', gap: 0.6, borderRadius: '8px', cursor: 'pointer',
    fontSize: { xs: '0.74rem', xl: '0.82rem' }, fontWeight: 700, transition: 'all 0.18s ease',
    ...(sel ? { bgcolor: `${DS.accent}1f`, color: DS.accent } : { color: DS.t2, '&:hover': { color: DS.t1 } }),
  })
  const conectados = ig.filter(c => !c.erro).length

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3.5 }, maxWidth: { xl: 1900 }, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography sx={{ fontFamily: DS.fontDisplay, textTransform: 'uppercase', fontSize: { xs: '1.5rem', md: '1.9rem', xl: '2.3rem' }, color: DS.t1, lineHeight: 1 }}>
            Última postagem
          </Typography>
          <Typography sx={{ fontSize: { xs: '0.78rem', xl: '0.88rem' }, color: DS.t2, mt: 0.4 }}>
            O último vídeo e a última foto de cada cliente — para nenhum ficar sem post. O mais urgente vem primeiro.
          </Typography>
        </Box>
        <Tooltip title={erroIG ?? (atualizadoEm ? `Lido do Instagram às ${new Date(atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '')}>
          <Button size="small" variant="outlined" onClick={() => void carregar()} disabled={carregando} startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
            sx={{ height: 36, textTransform: 'none', fontWeight: 700, color: DS.t1, borderColor: DS.border }}>
            {carregando ? 'Lendo o Instagram…' : `Atualizar · ${conectados} perfil${conectados === 1 ? '' : 's'} do Instagram`}
          </Button>
        </Tooltip>
      </Box>

      {/* Resumo + filtros */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap', mb: 1.6, p: 1, borderRadius: '12px', bgcolor: DS.surface, border: `1px solid ${DS.border}` }}>
        <Box sx={{ display: 'flex', gap: 0.4, p: 0.4, borderRadius: '10px', bgcolor: DS.field, flexWrap: 'wrap' }}>
          {([
            ['todos', 'Todos', linhas.length, DS.t2],
            ['urgentes', 'Atrasados', contagem.urgentes, DS.red],
            ['atencao', 'Atenção', contagem.atencao, DS.amber],
            ['ok', 'Em dia', contagem.ok, DS.green],
          ] as const).map(([f, r, n, cor]) => (
            <Box key={f} {...clickable(() => setFiltro(f))} aria-pressed={filtro === f} sx={pill(filtro === f)}>
              {f !== 'todos' && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: cor }} />}
              {r} <Box component="span" sx={{ opacity: 0.8 }}>{n}</Box>
            </Box>
          ))}
        </Box>
        <TextField size="small" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente…" sx={{ width: { xs: 180, md: 240 }, ...CAMPO }} />
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: '0.7rem', color: DS.t3 }}>Em dia: até 7 dias · Atenção: 8 a 14 · Atrasado: mais de 14</Typography>
      </Box>
      {erroIG && <Typography sx={{ fontSize: '0.74rem', color: DS.amber, mb: 1.2 }}>Instagram: {erroIG} — mostrando só o que está no painel.</Typography>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(3, 1fr)' }, gap: 1.2 }}>
        {visiveis.map(l => {
          const pior = piorNivel(l.ultimas, agora)
          return (
            <Box key={l.id} sx={{ p: { xs: 1.3, xl: 1.6 }, borderRadius: '14px', bgcolor: DS.surface, border: `1px solid ${pior === 'ok' ? DS.border : `${COR[pior]}66`}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.1 }}>
                <Typography noWrap sx={{ flex: 1, fontSize: { xs: '0.95rem', xl: '1.05rem' }, fontWeight: 800, color: DS.t1 }}>{l.nome}</Typography>
                {l.conta && !l.conta.erro && (
                  <Tooltip title={`Lido ${l.conta.fonte === 'facebook' ? 'da Página' : 'do Instagram'} ${l.conta.perfil}`}>
                    {l.conta.fonte === 'facebook' ? <FacebookIcon sx={{ fontSize: 16, color: DS.t2 }} /> : <InstagramIcon sx={{ fontSize: 16, color: DS.t2 }} />}
                  </Tooltip>
                )}
                <Box sx={{ px: 0.9, py: '2px', borderRadius: '999px', bgcolor: `${COR[pior]}1f`, border: `1px solid ${COR[pior]}66` }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: COR[pior], textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ROTULO[pior]}</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <BlocoPostagem rotulo="Vídeo" icone="video" p={l.ultimas.video} agora={agora} />
                <BlocoPostagem rotulo="Foto" icone="foto" p={l.ultimas.foto} agora={agora} />
              </Box>

              <Box sx={{ mt: 1.1, pt: 1, borderTop: `1px solid ${DS.border}` }}>
                {l.proxima ? (
                  <Typography sx={{ fontSize: '0.74rem', color: DS.t2 }}>
                    <b style={{ color: DS.t1 }}>Próxima:</b> {l.proxima.tp} · {SEMANA[new Date(l.proxima.quando).getDay()]} {dataCurta(l.proxima.quando)} ·{' '}
                    <span style={{ color: STATUS_CONFIG[l.proxima.status as keyof typeof STATUS_CONFIG]?.color }}>{STATUS_CONFIG[l.proxima.status as keyof typeof STATUS_CONFIG]?.shortLabel}</span>
                  </Typography>
                ) : (
                  <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: DS.amber }}>Nada planejado daqui para frente</Typography>
                )}
                {l.conta?.erro && <Typography sx={{ fontSize: '0.68rem', color: DS.redSoft, mt: 0.3 }}>Instagram: {l.conta.erro}</Typography>}
              </Box>
            </Box>
          )
        })}
      </Box>
      {visiveis.length === 0 && (
        <Box sx={{ py: 8, textAlign: 'center', border: `1px dashed ${DS.border}`, borderRadius: '14px' }}>
          <Typography sx={{ color: DS.t2 }}>Nenhum cliente neste filtro.</Typography>
        </Box>
      )}
      <Typography sx={{ mt: 1.4, fontSize: '0.7rem', color: DS.t3 }}>
        Conta conectada: lido direto do Instagram (ou da Página do Facebook, para quem não tem Instagram) — pega até o que foi postado fora do painel. Sem conta: o último card marcado como Publicado, nunca com data futura. Só clientes mensais ativos na carteira.
      </Typography>
    </Box>
  )
}

function BlocoPostagem({ rotulo, icone, p, agora }: { rotulo: string; icone: 'video' | 'foto'; p: Postagem | null; agora: number }) {
  const nivel = nivelDoAviso(p, agora)
  const dias = p ? diasDesde(p.quando, agora) : null
  const Icone = icone === 'video' ? PlayArrowRoundedIcon : ImageOutlinedIcon
  return (
    <Box sx={{ display: 'flex', gap: 0.9, p: 0.9, borderRadius: '10px', bgcolor: DS.surfaceAlt, border: `1px solid ${DS.border}`, minWidth: 0 }}>
      <Box sx={{ width: { xs: 44, xl: 54 }, height: { xs: 56, xl: 68 }, flexShrink: 0, borderRadius: '7px', overflow: 'hidden', bgcolor: DS.field, display: 'grid', placeItems: 'center' }}>
        {p?.capa
          ? <Box component="img" src={p.capa} alt="" loading="lazy" referrerPolicy="no-referrer" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Icone sx={{ fontSize: 20, color: DS.t4 }} />}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{rotulo}</Typography>
        <Typography sx={{ fontSize: { xs: '1rem', xl: '1.15rem' }, fontWeight: 900, color: COR[nivel], lineHeight: 1.15 }}>
          {dias === null ? 'nunca' : dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`}
        </Typography>
        {p && (
          <Typography noWrap sx={{ fontSize: '0.66rem', color: DS.t2 }}>
            {dataCurta(p.quando)} · {p.fonte === 'instagram' ? 'Instagram' : p.fonte === 'facebook' ? 'Facebook' : 'painel'}
            {p.link && <> · <Box component="a" href={p.link} target="_blank" rel="noreferrer" sx={{ color: DS.accent, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>ver ↗</Box></>}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
