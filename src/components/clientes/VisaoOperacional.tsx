import { useMemo, useState, type ReactNode } from 'react'
import { Box, Typography, Button, TextField, MenuItem, Tooltip, InputAdornment } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import SearchIcon from '@mui/icons-material/Search'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import AddIcon from '@mui/icons-material/Add'
import type { Client, ContentItem, ItemState } from '../../types'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import { InicialCliente } from './CadastroCliente'
import { visaoDoCliente, seloDoCliente, proximaGravacao, type VisaoCliente } from '../../lib/visaoCliente'
import { metaDoMes, padraoDo, type PadroesStore } from '../../lib/padraoEditorial'
import { naCarteira, type CarteiraStore } from '../../lib/planejamentoMes'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const dm = (t: number | null) => { if (t === null) return '—'; const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }
const dma = (t: number | null) => { if (t === null) return '—'; const d = new Date(t); return `${dm(t)}/${d.getFullYear()}` }

const SELO = {
  urgente: { cor: DS.red, rotulo: 'Urgente' },
  atencao: { cor: DS.amber, rotulo: 'Atenção' },
  emdia: { cor: DS.green, rotulo: 'Em dia' },
} as const

function lerGravacoes(): { client: string; date: string }[] {
  try { return JSON.parse(localStorage.getItem('sm_recordings') ?? '[]') } catch { return [] }
}

export interface AcaoCliente { rotulo: string; onClick: (el: HTMLElement) => void }

interface Props {
  clientes: Client[]
  items: ContentItem[]
  states: Record<number, ItemState>
  carteira: CarteiraStore
  padroes: PadroesStore
  ano: number
  mes: number
  mesesDisponiveis: { year: number; month: number }[]
  onMudarMes: (ano: number, mes: number) => void
  ordenacao: 'manual' | 'az' | 'za'
  onOrdenacao: (o: 'manual' | 'az' | 'za') => void
  onNovo: () => void
  onEditar: (cliente: string) => void
  onRemover: (cliente: string) => void
  onVerConteudos: (cliente: string) => void
  acoes: (cliente: string) => AcaoCliente[]
  rodape?: ReactNode
}

export default function VisaoOperacional(p: Props) {
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [todosAlertas, setTodosAlertas] = useState(false)
  const agora = Date.now()
  const gravacoes = useMemo(() => lerGravacoes(), [])

  const nomeDe = (c: string) => p.carteira[c]?.nome ?? c
  const visoes = useMemo(() => {
    const m = new Map<string, VisaoCliente>()
    for (const c of p.clientes) {
      const meta = metaDoMes(padraoDo(p.padroes, c.name), c)
      m.set(c.name, visaoDoCliente({
        items: p.items, states: p.states, cliente: c.name, ano: p.ano, mes: p.mes,
        meta: { Reel: meta.Reel, Post: meta.Post + meta.Feed }, agora,
      }))
    }
    return m
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.clientes, p.items, p.states, p.padroes, p.ano, p.mes])

  const lista = p.clientes.filter(c => {
    if (!busca.trim()) return true
    const q = busca.trim().toLowerCase()
    const seg = p.carteira[c.name]?.segmento ?? c.subnicho ?? ''
    return nomeDe(c.name).toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || seg.toLowerCase().includes(q)
  })
  const atual = (selecionado && p.clientes.some(c => c.name === selecionado)) ? selecionado : lista[0]?.name ?? null
  const cliente = p.clientes.find(c => c.name === atual)
  const v = atual ? visoes.get(atual) : undefined

  const ciclarOrdem = () => p.onOrdenacao(p.ordenacao === 'manual' ? 'az' : p.ordenacao === 'az' ? 'za' : 'manual')
  const rotuloOrdem = p.ordenacao === 'manual' ? 'Ordem manual' : p.ordenacao === 'az' ? 'A → Z' : 'Z → A'

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '250px 1fr', lg: '270px 1fr', xl: '320px 1fr' }, gap: { xs: 1.5, md: 2 }, alignItems: 'start' }}>
      {/* ── Lista ─────────────────────────────────────────── */}
      <Box sx={{
        position: { md: 'sticky' }, top: { md: 8 }, display: 'flex', flexDirection: 'column',
        maxHeight: { md: 'calc(100vh - 150px)' }, bgcolor: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '14px', overflow: 'hidden',
      }}>
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.2, borderBottom: `1px solid ${DS.border}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Rotulo>Buscar cliente</Rotulo>
            <Tooltip title={`Ordenar: ${rotuloOrdem}`}>
              <Box {...clickable(ciclarOrdem)} aria-label={`Ordenar: ${rotuloOrdem}`} sx={{ width: 26, height: 26, borderRadius: '7px', border: `1px solid ${DS.border}`, display: 'grid', placeItems: 'center', cursor: 'pointer', color: DS.t2, '&:hover': { color: DS.t1, borderColor: DS.borderHov } }}>
                <SwapVertIcon sx={{ fontSize: 15 }} />
              </Box>
            </Tooltip>
          </Box>
          <TextField size="small" placeholder="Nome ou segmento" value={busca} onChange={e => setBusca(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: DS.t3 }} /></InputAdornment> } }} />
          <Rotulo>Carteira em</Rotulo>
          <TextField select size="small" value={`${p.ano}-${p.mes}`}
            onChange={e => { const [a, m] = e.target.value.split('-').map(Number); p.onMudarMes(a, m) }}>
            {p.mesesDisponiveis.map(o => (
              <MenuItem key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`} sx={{ fontSize: '0.8rem' }}>{MESES[o.month]} de {o.year}</MenuItem>
            ))}
          </TextField>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 0.5, minHeight: 120 }}>
          {lista.map(c => {
            const ativo = c.name === atual
            const selo = SELO[seloDoCliente(visoes.get(c.name)?.alertas ?? [])]
            const seg = p.carteira[c.name]?.segmento ?? c.subnicho ?? (c.nicho === 'gastronomico' ? 'Gastronômico' : '')
            return (
              <Box key={c.name} {...clickable(() => { setSelecionado(c.name); setTodosAlertas(false) })} aria-current={ativo || undefined}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.2, px: 1.2, py: 1.1, borderRadius: '10px', cursor: 'pointer',
                  border: `1px solid ${ativo ? DS.accent : 'transparent'}`, bgcolor: ativo ? 'rgba(255,122,0,0.07)' : 'transparent',
                  transition: 'all 0.18s ease', '&:hover': { bgcolor: ativo ? 'rgba(255,122,0,0.09)' : 'rgba(148,163,184,0.06)' },
                }}>
                <InicialCliente nome={nomeDe(c.name)} tamanho={30} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: { xs: '0.8rem', xl: '0.88rem' }, fontWeight: 700, color: DS.t1 }}>{nomeDe(c.name)}</Typography>
                  {seg && <Typography noWrap sx={{ fontSize: { xs: '0.68rem', xl: '0.74rem' }, color: DS.t3 }}>{seg}</Typography>}
                </Box>
                <Tooltip title={selo.rotulo}><Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: selo.cor, flexShrink: 0 }} /></Tooltip>
              </Box>
            )
          })}
          {lista.length === 0 && <Typography sx={{ p: 2, fontSize: '0.75rem', color: DS.t3, textAlign: 'center' }}>Nenhum cliente encontrado</Typography>}
        </Box>

        <Box sx={{ p: 1.2, borderTop: `1px solid ${DS.border}`, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
          <Button variant="contained" fullWidth startIcon={<AddIcon />} onClick={p.onNovo} sx={{ fontWeight: 800 }}>Novo cliente</Button>
          {p.rodape}
        </Box>
      </Box>

      {/* ── Detalhe ───────────────────────────────────────── */}
      {cliente && v ? (
        <Detalhe
          cliente={cliente} nome={nomeDe(cliente.name)} v={v} carteira={p.carteira} padroes={p.padroes}
          proxGravacao={proximaGravacao(gravacoes, cliente.name, agora)}
          todosAlertas={todosAlertas} onTodosAlertas={() => setTodosAlertas(x => !x)}
          onEditar={() => p.onEditar(cliente.name)} onRemover={() => p.onRemover(cliente.name)}
          onVerConteudos={() => p.onVerConteudos(cliente.name)} acoes={p.acoes(cliente.name)}
        />
      ) : (
        <Box sx={{ p: 4, textAlign: 'center', border: `1px dashed ${DS.border}`, borderRadius: '14px' }}>
          <Typography sx={{ color: DS.t2, fontSize: '0.85rem' }}>Nenhum cliente na carteira deste mês.</Typography>
        </Box>
      )}
    </Box>
  )
}

function Rotulo({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: { xs: '0.62rem', xl: '0.68rem' }, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: DS.t2 }}>{children}</Typography>
}

function Painel({ titulo, info, acao, children }: { titulo: string; info?: string; acao?: { rotulo: string; onClick: () => void }; children: ReactNode }) {
  return (
    <Box sx={{ bgcolor: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '12px', p: { xs: 1.5, xl: 2 }, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 1.2 }}>
        <Typography sx={{ fontSize: { xs: '0.86rem', xl: '0.95rem' }, fontWeight: 800, color: DS.t1 }}>{titulo}</Typography>
        {info && <Tooltip title={info}><InfoOutlinedIcon sx={{ fontSize: 14, color: DS.t3 }} /></Tooltip>}
        {acao && (
          <Typography {...clickable(acao.onClick)} sx={{ ml: 'auto', fontSize: { xs: '0.74rem', xl: '0.8rem' }, fontWeight: 700, color: DS.accent, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
            {acao.rotulo}
          </Typography>
        )}
      </Box>
      {children}
    </Box>
  )
}

function Kpi({ titulo, info, valor, linhas }: { titulo: string; info: string; valor: string; linhas: string[] }) {
  return (
    <Box sx={{ bgcolor: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '12px', p: { xs: 1.5, xl: 2 }, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 1 }}>
        <Typography sx={{ fontSize: { xs: '0.7rem', xl: '0.76rem' }, fontWeight: 700, color: DS.t2 }}>{titulo}</Typography>
        <Tooltip title={info}><InfoOutlinedIcon sx={{ fontSize: 13, color: DS.t3 }} /></Tooltip>
      </Box>
      <Typography sx={{ fontSize: { xs: '1.25rem', xl: '1.45rem' }, fontWeight: 800, color: DS.t1, letterSpacing: '-0.02em', lineHeight: 1.2, mb: 0.8 }}>{valor}</Typography>
      {linhas.map(l => <Typography key={l} sx={{ fontSize: { xs: '0.72rem', xl: '0.78rem' }, color: DS.t2, lineHeight: 1.6 }}>{l}</Typography>)}
    </Box>
  )
}

function Detalhe(props: {
  cliente: Client; nome: string; v: VisaoCliente; carteira: CarteiraStore; padroes: PadroesStore
  proxGravacao: number | null; todosAlertas: boolean; onTodosAlertas: () => void
  onEditar: () => void; onRemover: () => void; onVerConteudos: () => void; acoes: AcaoCliente[]
}) {
  const { cliente, nome, v, carteira, padroes } = props
  const cad = carteira[cliente.name]
  const pad = padraoDo(padroes, cliente.name)
  const postPadrao = (pad.meta?.Feed ?? 0) > (pad.meta?.Post ?? cliente.postsPerMonth) || (pad.dias.Feed.length > 0 && pad.dias.Post.length === 0) ? 'Feed' : 'Design'
  const tipo = naCarteira(carteira, cliente.name).tipo
  const subtitulo = [
    cad?.segmento ?? cliente.subnicho ?? (cliente.nicho === 'gastronomico' ? 'Gastronômico' : cliente.nicho === 'variados' ? 'Variados' : ''),
    cad?.cidade,
    tipo === 'freelancer' ? 'Freelancer' : `Post padrão: ${postPadrao}`,
  ].filter(Boolean).join(' · ')
  const selo = SELO[seloDoCliente(v.alertas)]
  const urgentes = v.alertas.filter(a => a.nivel === 'urgente').length
  const maxPipe = Math.max(1, ...v.pipeline.map(x => x.total))
  const alertasVisiveis = props.todosAlertas ? v.alertas : v.alertas.slice(0, 3)
  const falta = (m: { meta: number; publicados: number }) => Math.max(0, m.meta - m.publicados)

  const linhaCobertura = (rotulo: string, c: VisaoCliente['cobertura']['Reel']) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 1, py: 1.1, borderTop: `1px solid ${DS.border}` }}>
      <Typography sx={{ fontSize: { xs: '0.74rem', xl: '0.8rem' }, fontWeight: 700, color: DS.t1, alignSelf: 'center' }}>{rotulo}</Typography>
      <Box>
        <Typography sx={{ fontSize: { xs: '0.78rem', xl: '0.84rem' }, fontWeight: 700, color: c.cobertoAte ? DS.t1 : DS.t2 }}>
          {!c.temPauta ? 'Sem pauta futura' : c.cobertoAte ? `Cobertos até ${dm(c.cobertoAte)}` : 'Nenhum pronto ainda'}
        </Typography>
        <Typography sx={{ fontSize: { xs: '0.72rem', xl: '0.78rem' }, color: DS.t2 }}>
          {c.proximaSemCobertura ? `Próxima data sem cobertura: ${dm(c.proximaSemCobertura)}` : c.temPauta ? 'Toda a pauta futura está pronta' : 'Distribua o mês no Calendário'}
        </Typography>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, xl: 2 }, minWidth: 0, animation: 'fadeInUp 0.25s ease both' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Rotulo>Visão operacional</Rotulo>
          <Typography sx={{ fontSize: { xs: '1.5rem', md: '1.75rem', xl: '2rem' }, fontWeight: 800, color: DS.t1, letterSpacing: '-0.03em', lineHeight: 1.15, mt: 0.3 }}>{nome}</Typography>
          {subtitulo && <Typography sx={{ fontSize: { xs: '0.82rem', xl: '0.9rem' }, color: DS.t2, mt: 0.4 }}>{subtitulo}</Typography>}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.7, px: 1.3, height: 30, borderRadius: '999px', border: `1px solid ${selo.cor}66`, bgcolor: `${selo.cor}14` }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: selo.cor }} />
            <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: DS.t1 }}>{selo.rotulo}</Typography>
          </Box>
          <Button size="small" variant="outlined" onClick={props.onEditar} sx={{ color: DS.t1, borderColor: DS.border, fontWeight: 700, '&:hover': { borderColor: DS.borderHov, bgcolor: DS.surfaceAlt } }}>Editar</Button>
          <Button size="small" variant="outlined" onClick={props.onRemover} sx={{ color: DS.redSoft, borderColor: `${DS.red}55`, fontWeight: 700, '&:hover': { borderColor: DS.red, bgcolor: `${DS.red}14` } }}>Remover cliente</Button>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: { xs: 1.2, xl: 1.6 } }}>
        <Kpi titulo="Meta de publicação" info="Meta do mês (padrão editorial ou plano do cliente) contra o que já foi publicado no mês. Post inclui Design, Carrossel e Feed."
          valor={`${v.meta.Reel.meta} Reels + ${v.meta.Post.meta} Posts`}
          linhas={[`Reels: ${v.meta.Reel.publicados}/${v.meta.Reel.meta} · faltam ${falta(v.meta.Reel)}`, `Posts: ${v.meta.Post.publicados}/${v.meta.Post.meta} · faltam ${falta(v.meta.Post)}`]} />
        <Kpi titulo="Entregas totais" info="Tudo que foi publicado neste mês. Extras = publicados fora da meta (Story e afins)."
          valor={String(v.publicadosNoMes)} linhas={[`${v.publicadosNoMes - v.extrasNoMes} ${v.publicadosNoMes - v.extrasNoMes === 1 ? 'publicação' : 'publicações'} · ${v.extrasNoMes} ${v.extrasNoMes === 1 ? 'extra' : 'extras'}`]} />
        <Kpi titulo="Estoque atual" info="Conteúdo pronto que ainda não foi ao ar: aprovado, com o cliente, cliente ok ou programado."
          valor={String(v.estoque.Reel + v.estoque.Post)} linhas={[`${v.estoque.Reel} ${v.estoque.Reel === 1 ? 'Reel disponível' : 'Reels disponíveis'} · ${v.estoque.Post} ${v.estoque.Post === 1 ? 'Post disponível' : 'Posts disponíveis'}`]} />
        <Kpi titulo="Alertas ativos" info="Urgente: entrega vencida ou publicação passada sem ir ao ar. Risco: vai ao ar em até 3 dias e ainda está em produção."
          valor={String(v.alertas.length)} linhas={[v.alertas.length ? `${urgentes} urgente${urgentes === 1 ? '' : 's'}` : 'Nada pendente']} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: { xs: 1.2, xl: 1.6 } }}>
        <Painel titulo="Cobertura" info="Até quando a pauta futura tem conteúdo pronto, sem buraco desde hoje, e a primeira data que ainda depende de produção."
          acao={{ rotulo: 'Ver detalhes', onClick: props.onVerConteudos }}>
          {linhaCobertura('Reels', v.cobertura.Reel)}
          {linhaCobertura('Posts', v.cobertura.Post)}
        </Painel>

        <Painel titulo="Pipeline resumido" acao={{ rotulo: 'Ver detalhes', onClick: props.onVerConteudos }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {v.pipeline.map(x => (
              <Box key={x.chave} sx={{ display: 'grid', gridTemplateColumns: { xs: '150px 1fr 28px', xl: '190px 1fr 32px' }, alignItems: 'center', gap: 1.2 }}>
                <Typography noWrap sx={{ fontSize: { xs: '0.74rem', xl: '0.8rem' }, color: DS.t1 }}>{x.rotulo}</Typography>
                <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(247,247,245,0.07)', overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${(x.total / maxPipe) * 100}%`, bgcolor: DS.accent, borderRadius: 2, transition: 'width 0.28s ease' }} />
                </Box>
                <Typography sx={{ fontSize: { xs: '0.74rem', xl: '0.8rem' }, fontWeight: 800, color: DS.t1, textAlign: 'right' }}>{x.total}</Typography>
              </Box>
            ))}
          </Box>
        </Painel>

        <Painel titulo="Principais alertas"
          acao={v.alertas.length > 3 ? { rotulo: props.todosAlertas ? 'Mostrar menos' : `Ver todos (${v.alertas.length})`, onClick: props.onTodosAlertas } : undefined}>
          {v.alertas.length === 0 && <Typography sx={{ fontSize: '0.78rem', color: DS.t2 }}>Nenhum atraso nem prazo em risco.</Typography>}
          {alertasVisiveis.map((a, idx) => {
            const cor = a.nivel === 'urgente' ? DS.red : DS.amber
            return (
              <Box key={`${a.itemId}-${idx}`} sx={{ display: 'grid', gridTemplateColumns: '10px 1fr auto', gap: 1, py: 1, borderTop: idx ? `1px solid ${DS.border}` : 'none' }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: cor, mt: 0.7 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: { xs: '0.78rem', xl: '0.84rem' }, fontWeight: 800, color: DS.t1 }}>{a.titulo}</Typography>
                  <Typography sx={{ fontSize: { xs: '0.7rem', xl: '0.76rem' }, color: DS.t2, lineHeight: 1.5 }}>{a.detalhe}</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.66rem', fontWeight: 800, color: cor }}>{a.nivel === 'urgente' ? 'Urgente' : 'Risco'}</Typography>
              </Box>
            )
          })}
        </Painel>

        <Painel titulo="Próximas datas" acao={{ rotulo: 'Ver detalhes', onClick: props.onVerConteudos }}>
          {[
            ['Próxima publicação', dm(v.proximaPublicacao)],
            ['Próxima gravação', dm(props.proxGravacao)],
            ['Última movimentação', dma(v.ultimaMovimentacao)],
          ].map(([r, val]) => (
            <Box key={r} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6 }}>
              <Typography sx={{ fontSize: { xs: '0.76rem', xl: '0.82rem' }, color: DS.t2 }}>{r}</Typography>
              <Typography sx={{ fontSize: { xs: '0.76rem', xl: '0.82rem' }, fontWeight: 800, color: DS.t1 }}>{val}</Typography>
            </Box>
          ))}
        </Painel>
      </Box>

      {props.acoes.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
          {props.acoes.map(a => (
            <Button key={a.rotulo} size="small" variant="outlined" onClick={e => a.onClick(e.currentTarget)}
              sx={{ color: DS.t2, borderColor: DS.border, fontWeight: 700, fontSize: { xs: '0.7rem', xl: '0.76rem' }, '&:hover': { color: DS.t1, borderColor: DS.borderHov, bgcolor: DS.surfaceAlt } }}>
              {a.rotulo}
            </Button>
          ))}
        </Box>
      )}
    </Box>
  )
}
