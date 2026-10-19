/**
 * Aba 33 — "Agendamento" (2026-09-30).
 *
 * Tudo de agendar num lugar só, para o Social Media:
 *  - Para aprovar: só o que está "Cliente ok" (5) na esteira do Social — vídeo
 *    ou post. O Social revisa e programa; o card vai para Programado (9).
 *  - Agendados: o que está Programado (9) — onde sai, se sai sozinho, falhas;
 *    revisar/remarcar ou desagendar.
 *  - Publicados: os últimos 14 dias, com o link do post quando o painel publicou.
 *  - Conexão Instagram/Facebook dos clientes.
 * Agendar leva o card para o Calendário de postagem (32) — lá ele é visto por dia.
 *
 * 2026-10-19: no estilo do Meta Business Suite, nas cores do painel — planejador
 * em Semana/Mês (lib/agenda), painel lateral (Para aprovar · Falhas · Contas),
 * botão "Criar" com post/reel/carrossel/story e o compositor com prévia do post.
 * A Lista é a tela de antes, inteira. Nenhuma regra de agendamento mudou.
 */
import { useMemo, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Menu, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import PostAddIcon from '@mui/icons-material/PostAdd'
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import InstagramIcon from '@mui/icons-material/Instagram'
import FacebookIcon from '@mui/icons-material/Facebook'
import CollectionsIcon from '@mui/icons-material/Collections'
import type { ContentItem, ContentType, ItemState } from '../types'
import { DS } from '../theme'
import { clickable } from '../shared/a11y'
import { aguardandoSocial, postagemDoCard, textoDoMomento } from '../lib/programacao'
import { NOME_REDE, REDES, useIgStatus, type AgendamentosDoCard, type IgConta, type Rede } from '../lib/instagram'
import { ConexoesIG } from './calendario/ProgramacaoIG'
import CriarPublicacaoDialog, { type NovaPublicacao } from './calendario/CriarPublicacaoDialog'
import { ALL_TYPES } from './producao/shared'
import EscolherQuando from './calendario/EscolherQuando'
import LinkDoMaterial from './calendario/LinkDoMaterial'
import { nomeDoCliente } from '../lib/clientes'
import { diasDaSemana, gradeDoMes, postsPorDia } from '../lib/agenda'
import CalendarioAgenda, { COR_SITUACAO, Miniatura, ROTULO_SITUACAO } from './agendamento/CalendarioAgenda'

type Vista = 'aprovar' | 'agendados' | 'publicados'

const ROTULO = { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: DS.t3 }
const CAMPO = { '& .MuiInputBase-root': { fontSize: '0.78rem', bgcolor: DS.field, borderRadius: '9px', height: 36 } }
const ICONE: Record<Rede, typeof InstagramIcon> = { instagram: InstagramIcon, facebook: FacebookIcon }
const CATORZE_DIAS = 14 * 86_400_000

type Modo = 'semana' | 'mes' | 'lista'
type Lateral = 'aprovar' | 'falhas' | 'contas'
const MODO_KEY = 'sm_agendamento_modo'
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
function lerModo(): Modo {
  try { const m = localStorage.getItem(MODO_KEY); return m === 'mes' || m === 'lista' ? m : 'semana' } catch { return 'semana' }
}

export default function AgendamentoTab({ items, states, clients, podeConectar, onProgramar, onRevisar, onDesagendar, onPubliqueiManual, onCriarPublicacao, onAbrirCalendario }: {
  items: ContentItem[]
  states: Record<number, ItemState>
  clients: string[]
  /** Sócio: conecta e desconecta o Instagram/Facebook dos clientes. */
  podeConectar: boolean
  /** Aprovado pelo cliente → abre a revisão ("Revisar e programar"). */
  onProgramar: (id: number) => void
  /** Já agendado → abre a revisão para mudar descrição, redes ou horário. */
  onRevisar: (id: number) => void
  /** Tira de Programado (volta para "Aprovado pelo cliente") e cancela a publicação automática. */
  onDesagendar: (id: number) => void
  /** O post saiu fora do painel: registra dia e hora (e o link, se houver). */
  onPubliqueiManual: (id: number, quando: number, link?: string) => void
  /** Post que não veio da esteira: cria o card com a mídia anexada e abre a revisão. */
  onCriarPublicacao: (p: NovaPublicacao) => void
  onAbrirCalendario: () => void
}) {
  const [modo, setModoState] = useState<Modo>(lerModo)
  const setModo = (m: Modo) => { setModoState(m); try { localStorage.setItem(MODO_KEY, m) } catch { /* só conveniência */ } }
  const [ref, setRef] = useState(() => new Date())
  const [lateral, setLateral] = useState<Lateral>('aprovar')
  const [vista, setVista] = useState<Vista>('aprovar')
  const [cliente, setCliente] = useState('todos')
  const [tipo, setTipo] = useState<'todos' | ContentType>('todos')
  const [busca, setBusca] = useState('')
  const [conexoes, setConexoes] = useState(false)
  const [manual, setManual] = useState<ContentItem | null>(null)
  const [criando, setCriando] = useState<ContentType | null>(null)
  const [menuCriar, setMenuCriar] = useState<HTMLElement | null>(null)
  const ig = useIgStatus(true)
  const contaDe = (c: string) => ig.conectados.find(x => x.clientName === c)

  const passaFiltro = (it: ContentItem) => {
    const q = busca.trim().toLowerCase()
    return (cliente === 'todos' || it.c === cliente)
      && (tipo === 'todos' || it.tp === tipo)
      && (!q || `${it.c} ${nomeDoCliente(it.c)} ${states[it.i]?.title || ''} ${it.n}`.toLowerCase().includes(q))
  }
  const status = (it: ContentItem) => states[it.i]?.status ?? it.s
  const quando = (it: ContentItem) => postagemDoCard(it, states[it.i]).quando.getTime()

  const paraAprovar = useMemo(() => aguardandoSocial(items, states), [items, states])
  const agendados = useMemo(() => items.filter(it => status(it) === 9).sort((a, b) => quando(a) - quando(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- status/quando só leem items e states
    [items, states])
  const publicados = useMemo(() => {
    const limite = Date.now() - CATORZE_DIAS
    return items
      .filter(it => status(it) === 7 && (states[it.i]?.publishedAt ?? 0) >= limite)
      .sort((a, b) => (states[b.i]?.publishedAt ?? 0) - (states[a.i]?.publishedAt ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- status só lê states
  }, [items, states])
  const comFalha = agendados.filter(it => REDES.some(r => ig.porItem[it.i]?.[r]?.status === 'failed'))

  const lista = (vista === 'aprovar' ? paraAprovar : vista === 'agendados' ? agendados : publicados).filter(passaFiltro)
  const agora = Date.now()
  const hoje = new Date()

  // Calendário (semana/mês): os dias da tela e os posts de cada dia.
  const dias = useMemo(() => modo === 'mes' ? gradeDoMes(ref) : diasDaSemana(ref), [modo, ref])
  const porDia = useMemo(
    () => postsPorDia(items, states, dias[0], dias[dias.length - 1], passaFiltro),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- passaFiltro lê cliente/tipo/busca
    [items, states, dias, cliente, tipo, busca],
  )
  const andar = (d: -1 | 1) => setRef(r => modo === 'mes'
    ? new Date(r.getFullYear(), r.getMonth() + d, 1)
    : new Date(r.getFullYear(), r.getMonth(), r.getDate() + 7 * d))
  const titulo = modo === 'mes' || modo === 'lista'
    ? `${MESES[ref.getMonth()]} ${ref.getFullYear()}`
    : (() => {
      const a = dias[0], b = dias[6]
      return a.getMonth() === b.getMonth()
        ? `${a.getDate()} – ${b.getDate()} de ${MESES[b.getMonth()]} ${b.getFullYear()}`
        : `${a.getDate()} de ${MESES[a.getMonth()].slice(0, 3)} – ${b.getDate()} de ${MESES[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`
    })()

  const desagendar = (id: number) => {
    const it = items.find(x => x.i === id)
    if (it && window.confirm(`Desagendar "${states[id]?.title || it.n}"? Ele volta para "Aprovado pelo cliente" e não sai mais sozinho.`)) onDesagendar(id)
  }
  const acoes = {
    onProgramar, onRevisar, onDesagendar: desagendar,
    onManual: (id: number) => setManual(items.find(x => x.i === id) ?? null),
  }

  const seg = (ativo: boolean) => ({
    px: { xs: 1.2, xl: 1.6 }, height: 34, display: 'flex', alignItems: 'center', cursor: 'pointer', borderRadius: '8px',
    fontSize: { xs: '0.74rem', xl: '0.82rem' }, fontWeight: 700, transition: 'all 0.18s ease',
    ...(ativo ? { bgcolor: `${DS.accent}1f`, color: DS.accent } : { color: DS.t2, '&:hover': { color: DS.t1 } }),
  })

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3.5 }, maxWidth: { xl: 2000 }, mx: 'auto' }}>
      {/* Cabeçalho */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 260 }}>
          <Typography sx={{ fontFamily: DS.fontDisplay, textTransform: 'uppercase', fontSize: { xs: '1.5rem', md: '1.9rem', xl: '2.3rem' }, color: DS.t1, lineHeight: 1 }}>
            Agendamento
          </Typography>
          <Typography sx={{ fontSize: { xs: '0.78rem', xl: '0.88rem' }, color: DS.t2, mt: 0.4 }}>
            Aprove, agende e acompanhe as publicações. Tudo que é agendado aparece no Calendário de postagem.
          </Typography>
        </Box>
        <BotaoNeutro onClick={() => setConexoes(true)} icone={<InstagramIcon sx={{ fontSize: 16 }} />}>
          Instagram e Facebook · {ig.conectados.length} cliente{ig.conectados.length !== 1 ? 's' : ''}
        </BotaoNeutro>
        <BotaoNeutro onClick={onAbrirCalendario}>Calendário de postagem →</BotaoNeutro>
        <Button variant="contained" size="small" onClick={e => setMenuCriar(e.currentTarget)} endIcon={<ArrowDropDownIcon />}
          sx={{ height: 36, px: 2.2, borderRadius: '9px', fontSize: '0.82rem', fontWeight: 800, textTransform: 'none' }}>
          Criar
        </Button>
        <Menu anchorEl={menuCriar} open={!!menuCriar} onClose={() => setMenuCriar(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          {([
            ['Post', 'Criar post', <PostAddIcon key="p" sx={{ fontSize: 18 }} />],
            ['Reel', 'Criar reel', <MovieOutlinedIcon key="r" sx={{ fontSize: 18 }} />],
            ['Carrossel', 'Criar carrossel', <CollectionsIcon key="c" sx={{ fontSize: 18 }} />],
            ['Story', 'Criar story', <AddCircleOutlineIcon key="s" sx={{ fontSize: 18 }} />],
          ] as const).map(([tp, rotulo, icone]) => (
            <MenuItem key={tp} onClick={() => { setMenuCriar(null); setCriando(tp) }} sx={{ gap: 1.2, fontSize: '0.84rem', minWidth: 220 }}>
              <Box sx={{ display: 'flex', color: DS.t2 }}>{icone}</Box>{rotulo}
            </MenuItem>
          ))}
        </Menu>
      </Box>

      {/* Barra do planejador: Semana · Mês · Lista, navegação, filtros */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap', mb: 1.6, p: 1, borderRadius: '12px', bgcolor: DS.surface, border: `1px solid ${DS.border}` }}>
        <Box sx={{ display: 'flex', gap: 0.4, p: 0.4, borderRadius: '10px', bgcolor: DS.field }}>
          {([['semana', 'Semana'], ['mes', 'Mês'], ['lista', 'Lista']] as const).map(([m, rotulo]) => (
            <Box key={m} {...clickable(() => setModo(m))} aria-pressed={modo === m} sx={seg(modo === m)}>{rotulo}</Box>
          ))}
        </Box>
        {modo !== 'lista' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <IconButton size="small" aria-label="Anterior" onClick={() => andar(-1)} sx={{ color: DS.t1 }}><ChevronLeftIcon /></IconButton>
            <Button size="small" onClick={() => setRef(new Date())} sx={{ color: DS.t1, fontWeight: 700, textTransform: 'none', minWidth: 0, px: 1 }}>Hoje</Button>
            <IconButton size="small" aria-label="Próximo" onClick={() => andar(1)} sx={{ color: DS.t1 }}><ChevronRightIcon /></IconButton>
          </Box>
        )}
        <Typography sx={{ flex: 1, textAlign: 'center', minWidth: 180, fontWeight: 800, color: DS.t1, fontSize: { xs: '0.95rem', md: '1.1rem', xl: '1.3rem' } }}>
          {modo === 'lista' ? 'Lista de publicações' : titulo}
        </Typography>
        <TextField select size="small" value={cliente} onChange={e => setCliente(e.target.value)} sx={{ width: { xs: 170, xl: 220 }, ...CAMPO }}>
          <MenuItem value="todos" sx={{ fontSize: '0.75rem' }}>Cliente: todos</MenuItem>
          {clients.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.75rem' }}>{nomeDoCliente(c)}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={tipo} onChange={e => setTipo(e.target.value as 'todos' | ContentType)} sx={{ width: { xs: 150, xl: 180 }, ...CAMPO }}>
          <MenuItem value="todos" sx={{ fontSize: '0.75rem' }}>Tipo de conteúdo: tudo</MenuItem>
          {ALL_TYPES.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '0.75rem' }}>{t}</MenuItem>)}
        </TextField>
        <TextField size="small" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…" sx={{ width: { xs: 140, md: 180 }, ...CAMPO }} />
      </Box>

      {modo === 'lista' ? (
        <>
          {/* Vistas da lista (a tela de antes, inteira) */}
          <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', mb: 1.5 }}>
            {([
              ['aprovar', 'Para aprovar', paraAprovar.length],
              ['agendados', 'Agendados', agendados.length],
              ['publicados', 'Publicados · 14 dias', publicados.length],
            ] as const).map(([v, rotulo, n]) => (
              <Box key={v} {...clickable(() => setVista(v))} aria-pressed={vista === v} sx={{
                display: 'flex', alignItems: 'center', gap: 0.8, px: 1.6, height: 38, borderRadius: '10px', cursor: 'pointer',
                border: `1px solid ${vista === v ? DS.accent : DS.border}`, bgcolor: vista === v ? `${DS.accent}14` : DS.surface,
                transition: 'all 0.18s ease',
              }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: vista === v ? DS.accent : DS.t1 }}>{rotulo}</Typography>
                <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: vista === v ? DS.accent : DS.t3 }}>{n}</Typography>
                {v === 'agendados' && comFalha.length > 0 && (
                  <Tooltip title={`${comFalha.length} não publicou — veja o motivo`}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: DS.red }} />
                  </Tooltip>
                )}
              </Box>
            ))}
          </Box>

          {lista.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center', border: `1px dashed ${DS.border}`, borderRadius: '14px' }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: DS.t1, mb: 0.5 }}>
                {vista === 'aprovar' ? 'Nada aguardando aprovação' : vista === 'agendados' ? 'Nada agendado' : 'Nada publicado nos últimos 14 dias'}
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: DS.t2 }}>
                {vista === 'aprovar' ? 'Quando um vídeo ou post chegar em "Cliente ok" na esteira do Social, ele aparece aqui.' : 'Mude os filtros ou veja as outras listas.'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ borderRadius: '14px', border: `1px solid ${DS.border}`, bgcolor: DS.surface, overflow: 'hidden' }}>
              {vista === 'aprovar' && lista.some(it => quando(it) <= agora) && (
                <Cabecalho texto="Os em vermelho estão com o horário vencido — escolha um novo na revisão." />
              )}
              {lista.map(it => (
                <Linha key={it.i} item={it} st={states[it.i]} conta={contaDe(it.c)} agendamentos={ig.porItem[it.i]} vista={vista}
                  onProgramar={() => onProgramar(it.i)}
                  onRevisar={() => onRevisar(it.i)}
                  onManual={() => setManual(it)}
                  onDesagendar={() => desagendar(it.i)} />
              ))}
            </Box>
          )}
        </>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 300px', xl: 'minmax(0, 1fr) 360px' }, gap: 1.6, alignItems: 'start' }}>
          <Box sx={{ minWidth: 0 }}>
            <CalendarioAgenda modo={modo} dias={dias} mesRef={ref.getMonth()} porDia={porDia} hoje={hoje}
              states={states} contaDe={contaDe} igPorItem={ig.porItem} acoes={acoes} />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
              {(['aprovar', 'agendado', 'publicado'] as const).map(s => (
                <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: COR_SITUACAO[s] }} />
                  <Typography sx={{ fontSize: '0.7rem', color: DS.t2 }}>{ROTULO_SITUACAO[s]}</Typography>
                </Box>
              ))}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: DS.red }} />
                <Typography sx={{ fontSize: '0.7rem', color: DS.t2 }}>Não publicou</Typography>
              </Box>
            </Box>
          </Box>

          {/* Painel lateral — como "Metas · Momentos · Rascunhos" da Meta */}
          <Box sx={{ borderRadius: '14px', border: `1px solid ${DS.border}`, bgcolor: DS.surface, overflow: 'hidden', position: { lg: 'sticky' }, top: { lg: 12 } }}>
            <Box sx={{ display: 'flex', gap: 0.4, p: 0.8, borderBottom: `1px solid ${DS.border}` }}>
              {([['aprovar', 'Para aprovar', paraAprovar.length], ['falhas', 'Falhas', comFalha.length], ['contas', 'Contas', ig.conectados.length]] as const).map(([l, rotulo, n]) => (
                <Box key={l} {...clickable(() => setLateral(l))} aria-pressed={lateral === l} sx={{ ...seg(lateral === l), flex: 1, justifyContent: 'center', gap: 0.5 }}>
                  {rotulo}
                  <Box component="span" sx={{ fontSize: '0.68rem', color: l === 'falhas' && n ? DS.red : 'inherit', opacity: 0.85 }}>{n}</Box>
                </Box>
              ))}
            </Box>
            <Box sx={{ p: 1.2, maxHeight: { lg: 'calc(100vh - 220px)' }, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {lateral === 'aprovar' && (paraAprovar.filter(passaFiltro).length === 0
                ? <Vazio titulo="Nada aguardando" texto={'Quando um conteúdo chegar em "Cliente ok", ele aparece aqui para você programar.'} />
                : paraAprovar.filter(passaFiltro).map(it => (
                  <ItemLateral key={it.i} item={it} st={states[it.i]} vencido={quando(it) <= agora}
                    acao="Aprovar e programar" onAcao={() => onProgramar(it.i)} secundaria="Publiquei manualmente" onSecundaria={() => setManual(it)} />
                )))}
              {lateral === 'falhas' && (comFalha.length === 0
                ? <Vazio titulo="Nenhuma falha" texto="Tudo que está agendado vai sair normalmente." />
                : comFalha.map(it => (
                  <ItemLateral key={it.i} item={it} st={states[it.i]} vencido
                    detalhe={REDES.map(r => ig.porItem[it.i]?.[r]).filter(a => a?.status === 'failed').map(a => `${NOME_REDE[a!.rede]}: ${a!.erro ?? 'erro'}`).join(' · ')}
                    acao="Revisar / remarcar" onAcao={() => onRevisar(it.i)} secundaria="Publiquei manualmente" onSecundaria={() => setManual(it)} />
                )))}
              {lateral === 'contas' && (
                <>
                  <Typography sx={{ fontSize: '0.76rem', color: DS.t2 }}>
                    {ig.conectados.length} cliente{ig.conectados.length !== 1 ? 's' : ''} com Instagram/Facebook conectado — o painel publica sozinho no horário.
                  </Typography>
                  {ig.conectados.map(c => (
                    <Box key={c.clientName} sx={{ p: 1, borderRadius: '9px', bgcolor: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
                      <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 800, color: DS.t1 }}>{nomeDoCliente(c.clientName)}</Typography>
                      <Box sx={{ display: 'flex', gap: 1.2, mt: 0.3 }}>
                        <Typography noWrap sx={{ fontSize: '0.68rem', color: c.perfil ? DS.t2 : DS.t4, display: 'flex', alignItems: 'center', gap: 0.4 }}>
                          <InstagramIcon sx={{ fontSize: 13 }} />{c.perfil || '—'}
                        </Typography>
                        <Typography noWrap sx={{ fontSize: '0.68rem', color: c.pagina ? DS.t2 : DS.t4, display: 'flex', alignItems: 'center', gap: 0.4 }}>
                          <FacebookIcon sx={{ fontSize: 13 }} />{c.pagina || '—'}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                  <Button variant="outlined" size="small" onClick={() => setConexoes(true)} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    Gerenciar conexões
                  </Button>
                </>
              )}
            </Box>
          </Box>
        </Box>
      )}

      <PubliqueiManualDialog item={manual} st={manual ? states[manual.i] : undefined}
        onClose={() => setManual(null)}
        onConfirm={(q, link) => { if (manual) onPubliqueiManual(manual.i, q, link); setManual(null) }} />

      <CriarPublicacaoDialog open={!!criando} tipoInicial={criando ?? 'Post'} clientes={clients} contas={ig.conectados}
        onClose={() => setCriando(null)}
        onContinuar={p => { setCriando(null); onCriarPublicacao(p) }} />

      <ConexoesIG open={conexoes} onClose={() => setConexoes(false)} clientes={clients} conectados={ig.conectados} podeConectar={podeConectar} />
    </Box>
  )
}

function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Box sx={{ py: 4, textAlign: 'center' }}>
      <Typography sx={{ fontSize: '0.86rem', fontWeight: 800, color: DS.t1, mb: 0.4 }}>{titulo}</Typography>
      <Typography sx={{ fontSize: '0.74rem', color: DS.t2 }}>{texto}</Typography>
    </Box>
  )
}

function ItemLateral({ item, st, vencido, detalhe, acao, onAcao, secundaria, onSecundaria }: {
  item: ContentItem; st?: ItemState; vencido?: boolean; detalhe?: string
  acao: string; onAcao: () => void; secundaria: string; onSecundaria: () => void
}) {
  const p = postagemDoCard(item, st)
  const quandoTxt = p.hora ? textoDoMomento(p.quando.getTime()) : `${p.quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · sem horário`
  return (
    <Box sx={{ p: 1, borderRadius: '10px', bgcolor: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Miniatura st={st} largura={48} altura={60} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography noWrap sx={{ fontSize: '0.64rem', fontWeight: 700, color: DS.t3 }}>{nomeDoCliente(item.c)} · {item.tp}</Typography>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: DS.t1, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {st?.title || item.n}
          </Typography>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: vencido ? DS.red : DS.t2, mt: 0.2 }}>{quandoTxt}</Typography>
          {detalhe && <Typography sx={{ fontSize: '0.66rem', color: DS.redSoft, mt: 0.2 }}>{detalhe}</Typography>}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.6, mt: 1 }}>
        <Button variant="contained" size="small" onClick={onAcao} sx={{ flex: 1, fontSize: '0.72rem', fontWeight: 800, textTransform: 'none' }}>{acao}</Button>
        <Button size="small" onClick={onSecundaria} sx={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'none', color: DS.t2, '&:hover': { color: DS.t1, bgcolor: 'transparent' } }}>{secundaria}</Button>
      </Box>
    </Box>
  )
}

function BotaoNeutro({ onClick, icone, children }: { onClick: () => void; icone?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Button size="small" onClick={onClick} startIcon={icone} sx={{
      height: 36, px: 1.6, borderRadius: '9px', fontSize: '0.76rem', fontWeight: 700, textTransform: 'none',
      border: `1px solid ${DS.border}`, bgcolor: DS.surface, color: DS.t1, '&:hover': { borderColor: DS.borderHov, color: DS.accent, bgcolor: DS.surface },
    }}>
      {children}
    </Button>
  )
}

function Cabecalho({ texto }: { texto: string }) {
  return (
    <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${DS.border}` }}>
      <Typography sx={{ ...ROTULO, textTransform: 'none', letterSpacing: 0, fontSize: '0.72rem', fontWeight: 600 }}>{texto}</Typography>
    </Box>
  )
}

/** Onde o post sai (ou saiu) em cada rede, com a situação. */
function Destinos({ conta, agendamentos, st, vista }: { conta?: IgConta; agendamentos?: AgendamentosDoCard; st?: ItemState; vista: Vista }) {
  const linhas = REDES.map(rede => {
    const destino = rede === 'instagram' ? conta?.perfil : conta?.pagina
    const a = agendamentos?.[rede]
    const link = rede === 'instagram' ? st?.igPermalink : st?.fbPermalink
    if (vista === 'publicados') {
      if (!link && a?.status !== 'published') return null
      return { rede, cor: DS.green, texto: destino || NOME_REDE[rede], link: link || a?.permalink || null }
    }
    if (vista === 'agendados') {
      if (!a || a.status === 'cancelled') return null
      if (a.status === 'failed') return { rede, cor: DS.red, texto: `não publicou: ${a.erro ?? 'erro'}`, link: null }
      if (a.status === 'publishing') return { rede, cor: DS.amber, texto: 'publicando agora…', link: null }
      if (a.status === 'published') return { rede, cor: DS.green, texto: `publicado${destino ? ` em ${destino}` : ''}`, link: a.permalink }
      return { rede, cor: DS.t2, texto: `sai sozinho${destino ? ` em ${destino}` : ''}`, link: null }
    }
    return destino ? { rede, cor: DS.t2, texto: destino, link: null } : null
  }).filter(Boolean) as { rede: Rede; cor: string; texto: string; link: string | null }[]

  if (linhas.length === 0) {
    return <Typography sx={{ fontSize: '0.68rem', color: DS.t3, mt: 0.2 }}>{vista === 'publicados' ? 'publicado manualmente' : 'publicação manual'}</Typography>
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.15, mt: 0.2 }}>
      {linhas.map(l => {
        const Icone = ICONE[l.rede]
        return (
          <Box key={l.rede} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <Icone sx={{ fontSize: 13, color: l.cor }} />
            <Typography noWrap title={l.texto} sx={{ fontSize: '0.68rem', color: l.cor }}>{l.texto}</Typography>
            {l.link && (
              <Box component="a" href={l.link} target="_blank" rel="noreferrer"
                sx={{ fontSize: '0.68rem', fontWeight: 700, color: DS.accent, textDecoration: 'none', flexShrink: 0, '&:hover': { textDecoration: 'underline' } }}>
                ver ↗
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

function Linha({ item, st, conta, agendamentos, vista, onProgramar, onRevisar, onDesagendar, onManual }: {
  item: ContentItem; st?: ItemState; conta?: IgConta; agendamentos?: AgendamentosDoCard; vista: Vista
  onProgramar: () => void; onRevisar: () => void; onDesagendar: () => void; onManual: () => void
}) {
  const p = postagemDoCard(item, st)
  const vencido = vista !== 'publicados' && p.quando.getTime() <= Date.now()
  const legenda = (st?.caption ?? '').trim()
  const quando = vista === 'publicados' && st?.publishedAt
    ? `publicado ${textoDoMomento(st.publishedAt)}`
    : p.hora ? textoDoMomento(p.quando.getTime()) : `${p.quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · sem horário`

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: { xs: 1.2, md: 2 }, px: 2, py: 1.3, flexWrap: { xs: 'wrap', md: 'nowrap' },
      borderBottom: `1px solid ${DS.border}`, '&:last-of-type': { borderBottom: 'none' },
      transition: 'background-color 0.18s ease', '&:hover': { bgcolor: 'rgba(146,152,165,0.04)' },
    }}>
      <Miniatura st={st} largura={{ xs: 48, xl: 60 }} altura={{ xs: 60, xl: 75 }} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.2, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: DS.t2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.tp}</Typography>
          <Typography noWrap sx={{ fontSize: '0.7rem', color: DS.t3, fontWeight: 600 }}>{nomeDoCliente(item.c)}</Typography>
        </Box>
        <Typography noWrap sx={{ fontSize: { xs: '0.84rem', xl: '0.95rem' }, fontWeight: 800, color: DS.t1 }}>{st?.title || item.n}</Typography>
        <Typography noWrap sx={{ fontSize: '0.72rem', color: legenda ? DS.t2 : DS.amber }}>
          {legenda ? legenda.replace(/\s+/g, ' ') : 'sem descrição'}
        </Typography>
        <LinkDoMaterial st={st} />
      </Box>

      <Box sx={{ width: { md: 230, xl: 270 }, flexShrink: 0, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: vencido ? DS.red : DS.t1 }}>{quando}</Typography>
        <Destinos conta={conta} agendamentos={agendamentos} st={st} vista={vista} />
      </Box>

      <Box sx={{ display: 'flex', gap: 0.8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {vista !== 'publicados' && (
          <Button size="small" onClick={onManual} sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'none', color: DS.t2, '&:hover': { color: DS.t1, bgcolor: 'transparent' } }}>
            Publiquei manualmente
          </Button>
        )}
        {vista === 'aprovar' && (
          <Button variant="contained" size="small" onClick={onProgramar} sx={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'none', px: 2 }}>
            Aprovar e programar
          </Button>
        )}
        {vista === 'agendados' && (
          <>
            <Button size="small" onClick={onDesagendar} sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'none', color: DS.t3, '&:hover': { color: DS.red, bgcolor: 'transparent' } }}>
              Desagendar
            </Button>
            <Button variant="outlined" size="small" onClick={onRevisar} sx={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'none', px: 1.6 }}>
              Revisar / remarcar
            </Button>
          </>
        )}
      </Box>
    </Box>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * "Publiquei manualmente": o post saiu pelo app ou pelo Business Suite. Registra
 * dia e hora (já vem com AGORA, o caso mais comum) e, se quiser, o link do post.
 */
function PubliqueiManualDialog({ item, st, onClose, onConfirm }: {
  item: ContentItem | null
  st?: ItemState
  onClose: () => void
  onConfirm: (quando: number, link?: string) => void
}) {
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [link, setLink] = useState('')
  const [aberto, setAberto] = useState<number | null>(null)
  // Abriu para outro card: começa com agora.
  if (item && aberto !== item.i) {
    const d = new Date()
    setAberto(item.i)
    setData(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
    setHora(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
    setLink('')
  }
  if (!item && aberto !== null) setAberto(null)

  const quando = data && /^\d{2}:\d{2}$/.test(hora) ? new Date(`${data}T${hora}:00`).getTime() : NaN
  const futuro = Number.isFinite(quando) && quando > Date.now() + 5 * 60_000
  const linkRuim = !!link.trim() && !/^https?:\/\//i.test(link.trim())

  return (
    <Dialog open={!!item} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: DS.t1 }}>Publiquei manualmente</Typography>
        {item && <Typography sx={{ fontSize: '0.74rem', color: DS.t2 }}>{nomeDoCliente(item.c)} · {item.tp} — {st?.title || item.n}</Typography>}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.6, pt: '12px !important' }}>
        <Typography sx={{ fontSize: '0.76rem', color: DS.t2 }}>
          Quando o post foi ao ar? Ele vai para "Publicado" e fica registrado no Calendário de postagem nesse dia e horário.
        </Typography>
        <EscolherQuando data={data} hora={hora} onData={setData} onHora={setHora} direcao="passado" />
        <TextField label="Link do post (opcional)" size="small" value={link} onChange={e => setLink(e.target.value)}
          placeholder="https://www.instagram.com/p/…" error={linkRuim}
          helperText={linkRuim ? 'Cole o link completo, começando com https://' : 'Instagram ou Facebook — aparece como "ver post" no painel.'}
          slotProps={{ inputLabel: { shrink: true } }} sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }} />
        {futuro && <Typography sx={{ fontSize: '0.72rem', color: DS.amber }}>Esse horário ainda não chegou — confira se é mesmo o de publicação.</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: DS.t2 }}>Cancelar</Button>
        <Button variant="contained" disabled={!Number.isFinite(quando) || linkRuim} onClick={() => onConfirm(quando, link.trim() || undefined)}>
          Registrar publicação
        </Button>
      </DialogActions>
    </Dialog>
  )
}
